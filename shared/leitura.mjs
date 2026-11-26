/**
 * Aba Leitura (nov/2026): o aluno cola um texto (ou abre um PDF) e a Mine
 * devolve resumo, ideias principais, palavras difíceis e perguntas de
 * interpretação. Este arquivo é o contrato dos dois lados: o prompt em
 * mine/prompts.mjs pede este formato, mine/quality.mjs recusa o que não passa
 * em `lerLeitura` e a tela usa o mesmo leitor.
 */
import { extrairJson } from "./redacao.mjs";

/**
 * Teto do texto mandado para a Mine: cabe um capítulo, não um livro. Fica
 * abaixo de MAX_CHAT_PROMPT_CHARS (12 mil), senão o servidor recusa o pedido.
 */
export const leituraMaxChars = 11000;
export const leituraMinPalavras = 60;

export function contarPalavrasLeitura(texto) {
  return (String(texto || "").match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) || []).length;
}

/** 200 palavras por minuto é o ritmo de leitura de estudo do ensino médio. */
export function minutosLeitura(texto) {
  return Math.max(1, Math.round(contarPalavrasLeitura(texto) / 200));
}

/** Tira hifenização de PDF, espaços repetidos e linhas quebradas no meio da frase. */
export function limparTextoLeitura(texto) {
  return String(texto || "")
    .replace(/\r/g, "")
    .replace(/(\p{L})-\n(\p{L})/gu, "$1$2")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, leituraMaxChars);
}

function frase(valor, limite = 500) {
  return String(valor ?? "").replace(/\s+/g, " ").trim().slice(0, limite);
}

function normalizar(valor) {
  return String(valor || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const palavrasVazias = new Set(
  "a o as os um uma uns umas de do da dos das em no na nos nas por pelo pela pelos pelas para pra com sem que se nao sim e ou mas como mais menos muito muita muitos muitas ja ainda isso esse essa esses essas este esta estes estas aquele aquela aqueles aquelas ele ela eles elas seu sua seus suas lhe lhes era eram foi foram ser sao esta estao tem tinha texto trecho autor alternativa alternativas resposta correta certa errada porque pois quando onde sobre entre ate apenas outro outra outros outras mesmo mesma todo toda todos todas".split(" "),
);

/** Radicais das palavras de conteúdo: "descreve" e "descritivo" caem em "descr". */
function radicais(valor) {
  const fora = new Set();
  for (const palavra of normalizar(valor).match(/[a-z0-9]+/g) || []) {
    if (palavrasVazias.has(palavra)) continue;
    if (/^\d+$/.test(palavra)) {
      fora.add(palavra);
      continue;
    }
    if (palavra.length < 4) continue;
    fora.add(palavra.slice(0, 5));
  }
  return fora;
}

function semelhanca(a, b) {
  const ra = radicais(a);
  const rb = radicais(b);
  if (!ra.size || !rb.size) return normalizar(a).trim() === normalizar(b).trim() && normalizar(a).trim() ? 1 : 0;
  let comuns = 0;
  for (const r of ra) if (rb.has(r)) comuns++;
  return comuns / Math.max(ra.size, rb.size);
}

/** Índice da alternativa que é cópia (ou quase) de `resposta`, ou -1. */
function alternativaDoTexto(alternativas, resposta) {
  const alvo = normalizar(resposta).replace(/\s+/g, " ").trim();
  if (!alvo) return -1;
  const exata = alternativas.findIndex((alt) => normalizar(alt).replace(/\s+/g, " ").trim() === alvo);
  if (exata >= 0) return exata;
  let melhor = -1;
  let nota = 0;
  alternativas.forEach((alt, j) => {
    const s = semelhanca(alt, resposta);
    if (s > nota) {
      nota = s;
      melhor = j;
    }
  });
  return nota >= 0.75 ? melhor : -1;
}

/**
 * Quantas palavras de conteúdo que só a alternativa j tem aparecem na
 * explicação e no trecho. Serve para ver de qual alternativa a explicação
 * realmente fala.
 */
function apoioDaExplicacao(alternativas, explicacao, trecho) {
  const base = radicais(`${explicacao} ${trecho}`);
  const conjuntos = alternativas.map((alt) => radicais(alt));
  return conjuntos.map((proprios, j) => {
    let pontos = 0;
    for (const r of proprios) {
      if (!base.has(r)) continue;
      if (conjuntos.some((outro, k) => k !== j && outro.has(r))) continue;
      pontos++;
    }
    return pontos;
  });
}

/**
 * Confere o gabarito de uma pergunta (P1 da auditoria de 22/nov/2026: a Mine
 * marcava A e explicava B). O texto copiado em `resposta` vale mais que o
 * índice, porque o modelo erra o número com mais frequência que o texto. Se a
 * explicação e o trecho apontam claramente para outra alternativa, a questão
 * fica `inconsistente` e sai da nota.
 */
export function conferirGabarito(pergunta) {
  const alternativas = Array.isArray(pergunta?.alternativas) ? pergunta.alternativas : [];
  let correta = Math.floor(Number(pergunta?.correta));
  const peloTexto = alternativaDoTexto(alternativas, pergunta?.resposta);
  const apoio = apoioDaExplicacao(alternativas, pergunta?.explicacao || "", pergunta?.trecho || "");
  let inconsistente = false;
  if (peloTexto >= 0 && peloTexto !== correta) {
    // Índice e texto discordam: desempata a explicação.
    if (apoio[peloTexto] > (apoio[correta] ?? 0)) correta = peloTexto;
    else if (apoio[peloTexto] === (apoio[correta] ?? 0)) {
      correta = peloTexto;
      inconsistente = true;
    }
  } else if (pergunta?.resposta && peloTexto < 0) {
    inconsistente = true;
  }
  if (!(correta >= 0 && correta < alternativas.length)) return { correta: 0, inconsistente: true };
  const melhor = Math.max(...apoio);
  const outras = apoio.filter((pontos, j) => j !== correta && pontos === melhor).length;
  // A explicação e o trecho falam de outra alternativa e nada da escolhida.
  if (melhor >= 1 && apoio[correta] === 0 && outras > 0) inconsistente = true;
  return { correta, inconsistente };
}

/** Acertos e total que contam na nota: questões inconsistentes ou reportadas ficam fora. */
export function placarLeitura(perguntas, respostas, reportadas = []) {
  let acertos = 0;
  let total = 0;
  (perguntas || []).forEach((pergunta, i) => {
    if (pergunta.inconsistente || reportadas.includes(i)) return;
    total++;
    if (respostas?.[i] === pergunta.correta) acertos++;
  });
  return { acertos, total };
}

/**
 * Lê a resposta da Mine. `texto` é o original: só ficam as palavras que
 * aparecem nele, para o grifo cair no lugar certo. Devolve null quando falta
 * o resumo ou quando sobram menos de 3 perguntas com gabarito coerente.
 */
export function lerLeitura(resposta, texto = "") {
  const json = typeof resposta === "string" ? extrairJson(resposta) : resposta;
  if (!json || typeof json !== "object") return null;
  const resumo = frase(json.resumo, 1200);
  if (resumo.length < 40) return null;
  const fonte = normalizar(texto);
  const vistas = new Set();
  const palavras = (Array.isArray(json.palavras) ? json.palavras : [])
    .map((item) => ({ palavra: frase(item?.palavra, 40), significado: frase(item?.significado, 220) }))
    .filter((item) => {
      const chave = normalizar(item.palavra);
      if (!chave || item.significado.length < 4 || vistas.has(chave)) return false;
      if (texto && !fonte.includes(chave)) return false;
      vistas.add(chave);
      return true;
    })
    .slice(0, 12);
  const perguntas = (Array.isArray(json.perguntas) ? json.perguntas : [])
    .map((item) => ({
      pergunta: frase(item?.pergunta, 400),
      alternativas: (Array.isArray(item?.alternativas) ? item.alternativas : []).map((alt) => frase(alt, 240)).filter(Boolean),
      correta: Math.floor(Number(item?.correta)),
      explicacao: frase(item?.explicacao, 400),
      trecho: frase(item?.trecho, 300),
      resposta: frase(item?.resposta, 240),
    }))
    .filter((item) => item.pergunta.length >= 8 && item.alternativas.length === 4 && item.correta >= 0 && item.correta <= 3 && item.explicacao.length >= 8)
    .map(({ resposta, ...item }) => ({ ...item, ...conferirGabarito({ ...item, resposta }) }))
    .slice(0, 6);
  if (perguntas.filter((item) => !item.inconsistente).length < 3) return null;
  const ideias = (Array.isArray(json.ideias) ? json.ideias : []).map((item) => frase(item, 260)).filter((item) => item.length >= 8).slice(0, 6);
  return {
    titulo: frase(json.titulo, 120) || "Texto sem título",
    genero: frase(json.genero, 60),
    resumo,
    ideias,
    palavras,
    perguntas,
  };
}

/**
 * Corta o texto em pedaços, marcando cada ocorrência das palavras difíceis
 * (sem diferenciar maiúscula e acento). `marca` é o índice da palavra ou -1.
 */
export function marcarPalavras(texto, palavras) {
  const fonte = String(texto || "");
  const base = normalizar(fonte);
  const achados = [];
  (palavras || []).forEach((item, indice) => {
    const alvo = normalizar(item.palavra);
    if (!alvo) return;
    let de = 0;
    while (de <= base.length) {
      const inicio = base.indexOf(alvo, de);
      if (inicio < 0) break;
      const antes = base[inicio - 1] || " ";
      const depois = base[inicio + alvo.length] || " ";
      // Só a palavra inteira: "ato" não grifa dentro de "contato".
      if (!/[\p{L}\p{N}]/u.test(antes) && !/[\p{L}\p{N}]/u.test(depois)) achados.push({ inicio, fim: inicio + alvo.length, indice });
      de = inicio + alvo.length;
    }
  });
  achados.sort((a, b) => a.inicio - b.inicio);
  const partes = [];
  let cursor = 0;
  for (const achado of achados) {
    if (achado.inicio < cursor) continue;
    if (achado.inicio > cursor) partes.push({ texto: fonte.slice(cursor, achado.inicio), marca: -1 });
    partes.push({ texto: fonte.slice(achado.inicio, achado.fim), marca: achado.indice });
    cursor = achado.fim;
  }
  if (cursor < fonte.length) partes.push({ texto: fonte.slice(cursor), marca: -1 });
  return partes;
}

/** Para que o aluno vai usar a leitura (nov/2026): muda o tom das perguntas. */
export const objetivosLeitura = [
  { id: "entender", nome: "Só entender", contexto: "entender bem o texto, sem pressa de prova" },
  { id: "escola", nome: "Prova da escola", contexto: "prova da escola: perguntas claras, no nivel da sala de aula" },
  { id: "enem", nome: "ENEM", contexto: "ENEM: perguntas no estilo do ENEM, com distratores plausiveis e foco em interpretacao" },
  { id: "vestibular", nome: "Vestibular", contexto: "vestibular (Fuvest, Unicamp, Unesp): perguntas mais exigentes, com inferencia fina e linguagem" },
];

/** Série do aluno: o fundamental recebe linguagem e perguntas mais diretas. */
export const niveisLeitura = [
  { id: "fundamental", nome: "Fundamental", contexto: "estudante do ensino fundamental II (11 a 14 anos): linguagem simples e perguntas diretas" },
  { id: "medio", nome: "Médio", contexto: "estudante do ensino medio" },
];

/** Contexto mandado junto com o texto. `objetivo` e `nivel` são ids das listas acima. */
export function contextoLeitura({ titulo = "", objetivo = "", nivel = "" } = {}) {
  const alvo = objetivosLeitura.find((item) => item.id === objetivo);
  const serie = niveisLeitura.find((item) => item.id === nivel);
  return [
    titulo ? `Título informado pelo estudante: ${titulo}` : "",
    alvo ? `Para que o estudante vai usar a leitura: ${alvo.contexto}` : "",
    serie ? `Nível: ${serie.contexto}` : "",
  ]
    .filter(Boolean)
    .join("\n") || "Leitura de estudo do ensino médio.";
}

const escapar = (valor) => valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Onde o `trecho` está no `texto` ({ inicio, fim } ou null). A Mine copia o
 * trecho com os espaços juntados numa linha só, então a busca aceita quebra
 * de linha e espaço duplo entre as palavras, e tenta sem a pontuação final.
 */
export function acharTrecho(texto, trecho) {
  const fonte = String(texto || "");
  const alvo = String(trecho || "").trim();
  if (alvo.length < 4) return null;
  const exato = fonte.indexOf(alvo);
  if (exato >= 0) return { inicio: exato, fim: exato + alvo.length };
  const flexivel = new RegExp(alvo.split(/\s+/).map(escapar).join("\\s+"));
  const achado = flexivel.exec(fonte);
  if (achado) return { inicio: achado.index, fim: achado.index + achado[0].length };
  const semPontuacao = alvo.replace(/[\s.,;:!?…"'“”‘’«»]+$/u, "");
  return semPontuacao !== alvo ? acharTrecho(fonte, semPontuacao) : null;
}

/**
 * Pedaços do texto para a tela: cada um sabe a posição no texto (`inicio`),
 * se é palavra difícil (`marca`, índice ou -1, `primeiro` no começo da
 * palavra) e se está no trecho que prova a resposta ou num grifo do aluno.
 * `faixas`: [{ inicio, fim, tipo: "prova" | "grifo" }].
 */
export function segmentosLeitura(texto, palavras, faixas = []) {
  const fonte = String(texto || "");
  const cortes = new Set();
  faixas.forEach((faixa) => {
    cortes.add(faixa.inicio);
    cortes.add(faixa.fim);
  });
  const saida = [];
  let posicao = 0;
  for (const parte of marcarPalavras(fonte, palavras)) {
    const inicio = posicao;
    const fim = posicao + parte.texto.length;
    posicao = fim;
    const pontos = [inicio, ...[...cortes].filter((corte) => corte > inicio && corte < fim).sort((a, b) => a - b), fim];
    for (let i = 0; i < pontos.length - 1; i += 1) {
      const de = pontos[i];
      const ate = pontos[i + 1];
      if (ate <= de) continue;
      const tipos = faixas.filter((faixa) => faixa.inicio < ate && faixa.fim > de).map((faixa) => faixa.tipo);
      saida.push({ texto: fonte.slice(de, ate), inicio: de, marca: parte.marca, primeiro: de === inicio, prova: tipos.includes("prova"), grifo: tipos.includes("grifo") });
    }
  }
  return saida;
}

/** Junta grifos que se encostam ou se sobrepõem (o aluno grifa por partes). */
export function juntarGrifos(grifos) {
  const ordem = [...(grifos || [])].filter((g) => g.fim > g.inicio).sort((a, b) => a.inicio - b.inicio);
  const saida = [];
  for (const grifo of ordem) {
    const ultimo = saida[saida.length - 1];
    if (ultimo && grifo.inicio <= ultimo.fim) ultimo.fim = Math.max(ultimo.fim, grifo.fim);
    else saida.push({ inicio: grifo.inicio, fim: grifo.fim });
  }
  return saida;
}

/** Textos curtos de domínio público para quem quer testar sem colar nada. */
export const textosExemplo = [
  {
    id: "cortico",
    titulo: "O Cortiço (trecho)",
    autor: "Aluísio Azevedo, 1890",
    texto:
      "Eram cinco horas da manhã e o cortiço acordava, abrindo, não os olhos, mas a sua infinidade de portas e janelas alinhadas. Um acordar alegre e farto de quem dormiu de uma assentada sete horas de chumbo. Como que se sentiam ainda na indolência de neblina as derradeiras notas da última guitarra da noite antecedente, dissolvendo-se à luz loura e tenra da aurora, que nem um suspiro de saudade perdido em terra alheia.\n\nA roupa lavada, que ficara de véspera nos coradouros, umedecia o ar e punha-lhe um farto acre de sabão ordinário. As pedras do chão, esbranquiçadas no lugar da lavagem e em alguns pontos azuladas pelo anil, mostravam uma palidez grisalha e triste, feita de acumulações de espumas secas.\n\nEntretanto, das portas surgiam cabeças congestionadas de sono; ouviam-se amplos bocejos, fortes como o marulhar das ondas; pigarreava-se grosso por toda a parte; começavam as xícaras a tilintar; o cheiro quente do café aquecia, suplantando todos os outros; trocavam-se de janela para janela as primeiras palavras, os bons-dias; reatavam-se conversas interrompidas à noite; a pequenada cá fora traquinava já, e lá dentro das casas vinham choros abafados de crianças que ainda não andam.",
  },
  {
    id: "carta",
    titulo: "Carta de Pero Vaz de Caminha (trecho)",
    autor: "Pero Vaz de Caminha, 1500",
    texto:
      "Esta terra, Senhor, me parece que da ponta que mais contra o sul vimos até a outra ponta que contra o norte vem, de que nós deste porto houvemos vista, será tamanha que haverá nela bem vinte ou vinte e cinco léguas por costa. Tem, ao longo do mar, nalgumas partes, grandes barreiras, delas vermelhas, delas brancas; e a terra por cima toda chã e muito cheia de grandes arvoredos.\n\nDe ponta a ponta, é tudo praia parma, muito chã e muito formosa. Pelo sertão nos pareceu, vista do mar, muito grande, porque, a estender olhos, não podíamos ver senão terra com arvoredos, que nos parecia muito longa.\n\nNela, até agora, não pudemos saber que haja ouro, nem prata, nem coisa alguma de metal ou ferro; nem lha vimos. Porém a terra em si é de muito bons ares, assim frios e temperados como os de Entre Doiro e Minho, porque neste tempo de agora assim os achávamos como os de lá. Águas são muitas; infindas. E em tal maneira é graciosa que, querendo-a aproveitar, dar-se-á nela tudo, por bem das águas que tem.\n\nPorém o melhor fruto, que nela se pode fazer, me parece que será salvar esta gente. E esta deve ser a principal semente que Vossa Alteza em ela deve lançar.",
  },
];
