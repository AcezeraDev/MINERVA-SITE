/**
 * Aba Redação: temas, contagem da folha e leitura da correção da Mine.
 *
 * A correção segue as 5 competências do ENEM (0 a 200 cada, em degraus de
 * 40). A Mine devolve JSON (task "redacao" em mine/prompts.mjs) e este
 * arquivo confere tudo antes de chegar na tela: nota fora do degrau é
 * arredondada, trecho que não existe no texto é descartado. O servidor usa o
 * mesmo parser no controle de qualidade (mine/quality.mjs), então uma
 * resposta quebrada vai para o modelo de reserva em vez de virar nota errada.
 */

export const competencias = [
  { id: 1, curta: "Norma culta", texto: "Domínio da escrita formal da língua portuguesa." },
  { id: 2, curta: "Tema e tipo textual", texto: "Compreender a proposta e desenvolver o tema no texto dissertativo-argumentativo." },
  { id: 3, curta: "Argumentação", texto: "Selecionar, relacionar e organizar informações e argumentos em defesa de um ponto de vista." },
  { id: 4, curta: "Coesão", texto: "Usar os mecanismos linguísticos que ligam as partes do texto (conectivos, retomadas)." },
  { id: 5, curta: "Proposta de intervenção", texto: "Propor uma solução detalhada e que respeite os direitos humanos: agente, ação, meio, finalidade e detalhamento." },
];

/** Temas no estilo ENEM. Os textos de apoio são curtos e escritos pelo Minerva. */
export const temasRedacao = [
  {
    id: "lixo-eletronico",
    titulo: "Desafios para o descarte correto do lixo eletrônico no Brasil",
    apoio: [
      "Celulares, carregadores e pilhas guardam metais pesados que contaminam o solo quando vão para o lixo comum.",
      "Poucos municípios têm pontos de coleta, e muita gente não sabe onde entregar um aparelho velho.",
    ],
  },
  {
    id: "saude-mental-jovens",
    titulo: "Caminhos para cuidar da saúde mental dos jovens brasileiros",
    apoio: [
      "Ansiedade e tristeza constante aparecem cada vez mais cedo entre estudantes.",
      "Escolas com psicólogo ainda são exceção, e o assunto muitas vezes vira tabu dentro de casa.",
    ],
  },
  {
    id: "desinformacao",
    titulo: "O combate à desinformação nas redes sociais",
    apoio: [
      "Notícias falsas se espalham mais rápido que as verdadeiras porque provocam emoção forte.",
      "Checar a fonte antes de compartilhar é um hábito que pode ser ensinado na escola.",
    ],
  },
  {
    id: "evasao-escolar",
    titulo: "Evasão escolar no ensino médio: causas e caminhos",
    apoio: [
      "Muitos jovens deixam a escola para trabalhar e ajudar em casa.",
      "Quando o aluno não vê sentido no que aprende, a vontade de continuar diminui.",
    ],
  },
  {
    id: "agua",
    titulo: "Desafios para garantir o acesso à água potável a todos os brasileiros",
    apoio: [
      "Milhões de pessoas ainda vivem sem água tratada chegando pela torneira.",
      "Desperdício na distribuição e falta de saneamento agravam o problema nas periferias.",
    ],
  },
  {
    id: "inclusao-digital",
    titulo: "A inclusão digital como direito de todos os estudantes",
    apoio: [
      "Durante o ensino remoto, muitos alunos só tinham o celular da família para estudar.",
      "Internet de qualidade virou condição para pesquisar, se inscrever em vestibulares e conseguir emprego.",
    ],
  },
  {
    id: "idosos",
    titulo: "O respeito e a valorização da pessoa idosa na sociedade brasileira",
    apoio: [
      "A população brasileira está envelhecendo rapidamente.",
      "Idosos relatam solidão e dificuldade para usar serviços que migraram para aplicativos.",
    ],
  },
  {
    id: "alimentacao",
    titulo: "Os impactos dos alimentos ultraprocessados na saúde da população",
    apoio: [
      "Salgadinhos, refrigerantes e embutidos são baratos, práticos e cheios de propaganda.",
      "O consumo frequente está ligado a obesidade e diabetes, inclusive em crianças.",
    ],
  },
];

/** Notas possíveis em cada competência. */
export const degraus = [0, 40, 80, 120, 160, 200];

export function contarPalavras(texto) {
  return (String(texto || "").match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu) || []).length;
}

/**
 * Linhas que o texto ocuparia na folha do ENEM. A folha oficial tem cerca de
 * 75 caracteres por linha, e cada parágrafo começa numa linha nova.
 */
export function contarLinhas(texto, porLinha = 75) {
  return String(texto || "")
    .split(/\n/)
    .map((paragrafo) => paragrafo.trim())
    .filter(Boolean)
    .reduce((total, paragrafo) => total + Math.max(1, Math.ceil(paragrafo.length / porLinha)), 0);
}

export function contarParagrafos(texto) {
  return String(texto || "").split(/\n/).filter((linha) => linha.trim()).length;
}

/** O ENEM pede de 7 a 30 linhas; abaixo de 7 a redação recebe zero. */
export function situacaoFolha(texto) {
  const linhas = contarLinhas(texto);
  if (linhas === 0) return { linhas, ok: false, aviso: "A folha está em branco." };
  if (linhas < 7) return { linhas, ok: false, aviso: `Faltam ${7 - linhas} ${7 - linhas === 1 ? "linha" : "linhas"} para o mínimo de 7.` };
  if (linhas > 30) return { linhas, ok: true, aviso: "Passou de 30 linhas: no ENEM o que sobra não é lido." };
  return { linhas, ok: true, aviso: "" };
}

export function arredondarDegrau(valor) {
  const numero = Math.max(0, Math.min(200, Number(valor) || 0));
  return Math.round(numero / 40) * 40;
}

/** Tira o primeiro objeto JSON de uma resposta que pode vir com cercas ou texto em volta. */
export function extrairJson(texto) {
  const bruto = String(texto || "").replace(/```(?:json)?/gi, "");
  const inicio = bruto.indexOf("{");
  const fim = bruto.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) return null;
  try {
    return JSON.parse(bruto.slice(inicio, fim + 1));
  } catch {
    return null;
  }
}

function frase(valor, limite = 600) {
  return String(valor ?? "").replace(/\s+/g, " ").trim().slice(0, limite);
}

/**
 * Lê a correção. `redacao` é o texto do aluno: só ficam os trechos que
 * existem nele, para o grifo cair no lugar certo.
 * Devolve null quando a resposta não tem as cinco competências.
 */
export function lerCorrecao(resposta, redacao = "") {
  const json = typeof resposta === "string" ? extrairJson(resposta) : resposta;
  if (!json || !Array.isArray(json.competencias) || json.competencias.length < 5) return null;
  const notas = json.competencias.slice(0, 5).map((item, index) => ({
    id: index + 1,
    nota: arredondarDegrau(item?.nota),
    comentario: frase(item?.comentario, 500),
  }));
  if (notas.some((item) => !item.comentario)) return null;
  const texto = String(redacao || "");
  const trechos = (Array.isArray(json.trechos) ? json.trechos : [])
    .map((item) => ({
      trecho: frase(item?.trecho, 240),
      tipo: item?.tipo === "acerto" ? "acerto" : "erro",
      competencia: Math.max(1, Math.min(5, Math.round(Number(item?.competencia) || 1))),
      comentario: frase(item?.comentario, 300),
      sugestao: frase(item?.sugestao, 300),
    }))
    .filter((item) => item.trecho.length >= 3 && item.comentario && (!texto || texto.includes(item.trecho)))
    .slice(0, 12);
  return {
    notas,
    total: notas.reduce((soma, item) => soma + item.nota, 0),
    resumo: frase(json.resumo, 600),
    proximoPasso: frase(json.proximoPasso, 400),
    trechos,
  };
}

/**
 * Divide a redação em pedaços para pintar os trechos marcados. Trechos que se
 * sobrepõem ficam com a primeira marca que aparece no texto.
 */
export function marcarTrechos(texto, trechos) {
  const fonte = String(texto || "");
  const achados = [];
  (trechos || []).forEach((item, indice) => {
    const inicio = fonte.indexOf(item.trecho);
    if (inicio >= 0) achados.push({ inicio, fim: inicio + item.trecho.length, indice });
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

export function faixaNota(total) {
  const nota = Number(total) || 0;
  if (nota >= 900) return "Nota de destaque";
  if (nota >= 700) return "Muito bem";
  if (nota >= 500) return "No caminho certo";
  if (nota >= 300) return "Dá para subir bastante";
  return "Bora reescrever juntas";
}

/** Contexto mandado para a Mine junto com a redação. */
export function contextoCorrecao({ tema, apoio = [], titulo = "", texto }) {
  return [
    `Tema: ${tema || "tema livre escolhido pelo estudante"}`,
    apoio.length ? `Textos de apoio:\n${apoio.map((item) => `- ${item}`).join("\n")}` : "",
    titulo ? `Título dado pelo estudante: ${titulo}` : "",
    `Linhas estimadas na folha do ENEM: ${contarLinhas(texto)}; palavras: ${contarPalavras(texto)}; parágrafos: ${contarParagrafos(texto)}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
