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

/**
 * Lê a resposta da Mine. `texto` é o original: só ficam as palavras que
 * aparecem nele, para o grifo cair no lugar certo. Devolve null quando falta
 * o resumo ou quando sobram menos de 3 perguntas inteiras.
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
    }))
    .filter((item) => item.pergunta.length >= 8 && item.alternativas.length === 4 && item.correta >= 0 && item.correta <= 3 && item.explicacao.length >= 8)
    .slice(0, 6);
  if (perguntas.length < 3) return null;
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

/** Contexto mandado junto com o texto. */
export function contextoLeitura({ titulo = "", objetivo = "" } = {}) {
  return [
    titulo ? `Título informado pelo estudante: ${titulo}` : "",
    objetivo ? `Para que o estudante vai usar a leitura: ${objetivo}` : "",
  ]
    .filter(Boolean)
    .join("\n") || "Leitura de estudo do ensino médio.";
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
