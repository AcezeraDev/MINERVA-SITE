/**
 * Glossário da resposta (nov/2026): a Mine lista no fim os termos difíceis
 *
 *   [[glossario: estômatos = poros da folha que deixam o ar entrar ; clorofila = pigmento verde que capta luz]]
 *
 * e a tela grifa a primeira vez que cada termo aparece, com a explicação ao
 * passar o mouse (ou tocar, no celular). O marcador fica guardado no texto da
 * mensagem e sai na hora de mostrar, copiar e mandar no histórico.
 */

export const GLOSSARY_MARKER = /\[\[\s*gloss[aá]rio\s*:\s*([^\]]*)\]\]/gi;
const MAX_TERMS = 6;

function fold(char) {
  return char.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().charAt(0) || char;
}

/** Separa o marcador do texto. */
export function extractGlossary(text) {
  const terms = [];
  const clean = String(text || "").replace(new RegExp(GLOSSARY_MARKER.source, "gi"), (_, list) => {
    for (const item of String(list).split(/\s*;\s*/)) {
      const at = item.search(/\s[=:–—-]\s|=/);
      if (at < 0) continue;
      const term = item.slice(0, at).replace(/^["“”'*]+|["“”'*]+$/g, "").trim();
      const def = item.slice(at).replace(/^\s*[=:–—-]\s*/, "").trim().slice(0, 180);
      if (term.length < 2 || term.length > 40 || def.length < 3) continue;
      if (terms.some((other) => other.term.toLowerCase() === term.toLowerCase())) continue;
      terms.push({ term, def });
    }
    return "";
  });
  return { text: clean.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(), terms: terms.slice(0, MAX_TERMS) };
}

/** Só tira o marcador (copiar, salvar, histórico). */
export function stripGlossary(text) {
  return String(text || "").replace(new RegExp(GLOSSARY_MARKER.source, "gi"), "").replace(/\n{3,}/g, "\n\n").trim();
}

// Marcas invisíveis (área de uso privado do Unicode) em volta do termo grifado.
export const GLOSS_OPEN = "";
export const GLOSS_CLOSE = "";

/**
 * Marca no markdown a primeira vez que cada termo aparece em texto corrido,
 * fora de código, fórmula, link e marcador. Feito antes de desenhar, a tela
 * só lê as marcas: nada muda durante a renderização.
 */
export function markGlossary(markdown, terms) {
  const source = String(markdown || "");
  if (!terms?.length || !source) return source;
  const protectedRanges = [];
  const guard = /```[\s\S]*?(?:```|$)|`[^`\n]*`|\$\$[\s\S]*?\$\$|(?<![A-Za-z])\$[^$\n]+\$|\]\([^)]*\)|\[\[[^\]]*\]\]|^#{1,6}[^\n]*$/gm;
  for (let match = guard.exec(source); match; match = guard.exec(source)) {
    protectedRanges.push([match.index, match.index + match[0].length]);
    if (match[0].length === 0) guard.lastIndex += 1;
  }
  const inside = (start, end) => protectedRanges.some(([a, b]) => start < b && end > a);
  const folded = source.split("").map(fold).join("");
  const hits = [];
  for (const item of terms) {
    const needle = item.term.split("").map(fold).join("");
    for (let from = 0; from <= folded.length; ) {
      const index = folded.indexOf(needle, from);
      if (index < 0) break;
      const end = index + needle.length;
      const boundary = !/[\p{L}\d]/u.test(folded[index - 1] || " ") && !/[\p{L}\d]/u.test(folded[end] || " ");
      if (boundary && !inside(index, end) && !hits.some((hit) => index < hit.end && end > hit.start)) {
        hits.push({ start: index, end });
        break;
      }
      from = index + 1;
    }
  }
  hits.sort((a, b) => b.start - a.start);
  let out = source;
  for (const hit of hits) out = `${out.slice(0, hit.start)}${GLOSS_OPEN}${out.slice(hit.start, hit.end)}${GLOSS_CLOSE}${out.slice(hit.end)}`;
  return out;
}

/** Quebra um texto já marcado em pedaços: texto comum e termo grifado. */
export function splitMarked(text) {
  const parts = [];
  const pattern = new RegExp(`${GLOSS_OPEN}([^${GLOSS_CLOSE}]*)${GLOSS_CLOSE}`, "g");
  let cursor = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > cursor) parts.push({ type: "text", text: text.slice(cursor, match.index) });
    parts.push({ type: "term", text: match[1] });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push({ type: "text", text: text.slice(cursor) });
  return parts;
}

/** Explicação do termo grifado (comparando sem acento e sem maiúscula). */
export function definitionOf(text, terms) {
  const key = String(text || "").split("").map(fold).join("");
  return terms.find((item) => item.term.split("").map(fold).join("") === key)?.def || "";
}

/**
 * Quebra um trecho de texto em pedaços comuns e termos do glossário. Só a
 * primeira ocorrência de cada termo vira grifo (`used` guarda os já usados),
 * comparando sem acento e sem maiúscula, e só palavra inteira.
 */
export function splitGlossaryTerms(text, terms, used = new Set()) {
  const source = String(text || "");
  const pending = terms.filter((item) => !used.has(item.term.toLowerCase()));
  if (!source || !pending.length) return [{ type: "text", text: source }];
  const folded = source.split("").map(fold).join("");
  const hits = [];
  for (const item of pending) {
    const needle = item.term.split("").map(fold).join("");
    let from = 0;
    while (from <= folded.length) {
      const index = folded.indexOf(needle, from);
      if (index < 0) break;
      const before = folded[index - 1] || " ";
      const after = folded[index + needle.length] || " ";
      if (!/[\p{L}\d]/u.test(before) && !/[\p{L}\d]/u.test(after)) {
        hits.push({ start: index, end: index + needle.length, item });
        break;
      }
      from = index + 1;
    }
  }
  hits.sort((a, b) => a.start - b.start);
  const parts = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start < cursor) continue;
    if (hit.start > cursor) parts.push({ type: "text", text: source.slice(cursor, hit.start) });
    parts.push({ type: "term", text: source.slice(hit.start, hit.end), term: hit.item.term, def: hit.item.def });
    used.add(hit.item.term.toLowerCase());
    cursor = hit.end;
  }
  if (cursor < source.length) parts.push({ type: "text", text: source.slice(cursor) });
  return parts;
}
