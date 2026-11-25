/**
 * Bloco interativo escrito como marcador (25/nov/2026).
 *
 * Os blocos (quiz, flashcards, slides, podcast...) são ensinados como cercas
 * ```quiz {...}```, mas o modelo às vezes os escreve no formato dos marcadores
 * de imagem: `[[quiz: {"titulo": ...}]]`. Aí o JSON inteiro vazava cru na
 * tela. Aqui o marcador vira a cerca certa antes de renderizar.
 *
 * O JSON tem colchetes por dentro (listas), então uma regex não acha o fim:
 * o fecho é encontrado contando chaves, respeitando as strings.
 */

const NOMES = [
  "quiz", "flashcards", "plano", "numeros", "números", "colunas", "texto", "avaliacao", "avaliação", "calculadora",
  "lista-imagens", "linha-do-tempo", "linhadotempo", "timeline", "mapa", "funcao", "função", "timer", "ditado",
  "simulacao", "simulação", "laboratorio", "passos", "roteiro", "dois-jeitos", "correcao", "correção", "podcast",
  "slides", "grafico", "gráfico", "videos", "vídeos",
];

const INICIO = new RegExp(String.raw`\[\[\s*(${NOMES.join("|")})\s*:\s*(?=[{\[])`, "giu");

/** Índice logo depois do `}`/`]` que fecha o JSON aberto em `start`, ou -1. */
function fimDoJson(text, start) {
  const pilha = [];
  let emString = false;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (emString) {
      if (c === "\\") i += 1;
      else if (c === '"') emString = false;
      continue;
    }
    if (c === '"') emString = true;
    else if (c === "{" || c === "[") pilha.push(c);
    else if (c === "}" || c === "]") {
      pilha.pop();
      if (!pilha.length) return i + 1;
    }
  }
  return -1;
}

/**
 * Troca `[[quiz: {...}]]` por uma cerca ```quiz. Durante o streaming, um
 * marcador ainda sem fim vira cerca aberta (a tela mostra "chegando").
 */
export function colchetesParaBlocos(text) {
  const source = String(text || "");
  if (!source.includes("[[")) return source;
  let out = "";
  let cursor = 0;
  INICIO.lastIndex = 0;
  let match;
  while ((match = INICIO.exec(source))) {
    const nome = match[1].toLowerCase();
    const jsonStart = match.index + match[0].length;
    const jsonEnd = fimDoJson(source, jsonStart);
    out += source.slice(cursor, match.index);
    if (jsonEnd < 0) {
      out += `\n\n\`\`\`${nome}\n${source.slice(jsonStart)}`;
      return out;
    }
    const fecho = source.slice(jsonEnd).match(/^\s*\]{0,2}/)?.[0] || "";
    out += `\n\n\`\`\`${nome}\n${source.slice(jsonStart, jsonEnd)}\n\`\`\`\n\n`;
    cursor = jsonEnd + fecho.length;
    INICIO.lastIndex = cursor;
  }
  return out + source.slice(cursor);
}
