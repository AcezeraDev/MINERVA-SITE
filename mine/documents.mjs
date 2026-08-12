// Estrategia de contexto para arquivos enviados (documento, secoes 11 e 12).
//
// A extracao de texto acontece no navegador (PDF via pdfjs, DOCX/PPTX via
// parser proprio em src/main.tsx). Aqui o servidor decide QUANTO desse texto
// entra no pedido e QUAL parte entra — mandar um material inteiro sempre e o
// jeito mais facil de estourar contexto, gastar cota e deixar a resposta lenta.
//
// A selecao e proposital simples e sem dependencia: divide em blocos, pontua
// por palavras em comum com a pergunta e monta o recorte na ordem original.
// Trocar por embeddings/RAG depois so exige reescrever selectExcerpts.

/** Teto somado de texto de arquivo por pedido. */
export const TOTAL_DOCUMENT_BUDGET = 24_000;
/** Teto por arquivo, para um material gigante nao engolir os outros. */
export const PER_DOCUMENT_BUDGET = 12_000;

const CHUNK_SIZE = 1_200;
const GAP_MARK = "\n[...]\n";

const STOPWORDS = new Set([
  "a","o","as","os","um","uma","uns","umas","de","do","da","dos","das","em","no","na","nos","nas",
  "por","para","com","sem","sobre","entre","ao","aos","e","ou","que","qual","quais","quando","como",
  "isso","este","esta","esse","essa","aquilo","meu","minha","seu","sua","me","se","the","of",
  "explique","explica","resuma","resumo","fale","diga","faca","faça","quero","preciso","pode","poderia",
  "arquivo","arquivos","conteudo","conteúdo","material","texto","documento","anexo","anexos",
]);

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function keywords(prompt) {
  const words = normalize(prompt)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOPWORDS.has(word));
  return new Set(words);
}

function splitChunks(text) {
  const chunks = [];
  // Corta preferencialmente em quebra de paragrafo perto do tamanho alvo, para
  // nao partir frase no meio.
  let cursor = 0;
  while (cursor < text.length) {
    let end = Math.min(cursor + CHUNK_SIZE, text.length);
    if (end < text.length) {
      const window = text.slice(cursor, end);
      const breakAt = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), window.lastIndexOf(". "));
      if (breakAt > CHUNK_SIZE * 0.5) end = cursor + breakAt + 1;
    }
    chunks.push({ index: chunks.length, start: cursor, text: text.slice(cursor, end) });
    cursor = end;
  }
  return chunks;
}

function scoreChunk(chunk, terms) {
  if (!terms.size) return 0;
  const body = normalize(chunk.text);
  let score = 0;
  for (const term of terms) {
    // Ocorrencias contam, mas com retorno decrescente: um bloco que repete a
    // mesma palavra 40 vezes nao vale 40 blocos diferentes.
    const hits = body.split(term).length - 1;
    if (hits > 0) score += 1 + Math.log(hits);
  }
  return score;
}

/**
 * Escolhe ate `budget` caracteres do texto, priorizando o que conversa com a
 * pergunta. Sem pergunta util (ex.: "resuma este arquivo"), pega trechos
 * espalhados para cobrir o documento inteiro em vez de so o comeco.
 */
export function selectExcerpts(text, prompt, budget) {
  const source = String(text || "");
  if (source.length <= budget) return source;

  const chunks = splitChunks(source);
  const terms = keywords(prompt);
  const chosen = new Set([0]); // o inicio quase sempre tem titulo e tema
  let used = chunks[0].text.length;

  const scored = chunks
    .slice(1)
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const { chunk } of scored) {
    if (used + chunk.text.length > budget) continue;
    chosen.add(chunk.index);
    used += chunk.text.length;
  }

  // Ainda sobra espaco (ou a pergunta nao tinha palavra util): completa com
  // blocos distribuidos ao longo do documento.
  if (used < budget * 0.9) {
    const step = Math.max(1, Math.floor(chunks.length / Math.max(1, Math.floor(budget / CHUNK_SIZE))));
    for (let index = 0; index < chunks.length; index += step) {
      if (chosen.has(index)) continue;
      const chunk = chunks[index];
      if (used + chunk.text.length > budget) break;
      chosen.add(index);
      used += chunk.text.length;
    }
  }

  const ordered = [...chosen].sort((a, b) => a - b);
  let out = "";
  let previous = -1;
  for (const index of ordered) {
    if (previous >= 0 && index !== previous + 1) out += GAP_MARK;
    out += chunks[index].text;
    previous = index;
  }
  return out;
}

/**
 * Monta o bloco de texto dos anexos respeitando o orcamento total.
 * Arquivos pequenos entram inteiros; o que sobra do orcamento e dividido entre
 * os grandes, entao um PDF de 200 paginas nao apaga um resumo de meia pagina.
 */
export function buildAttachmentContext(attachments, prompt) {
  const items = (Array.isArray(attachments) ? attachments : []).map((item) => ({
    name: String(item?.name || "arquivo").slice(0, 120),
    type: String(item?.type || "tipo desconhecido"),
    size: Number(item?.size || 0),
    text: String(item?.text || "").trim(),
  }));

  if (!items.length) return { text: "", trimmed: [] };

  const withText = items.filter((item) => item.text);
  let remaining = TOTAL_DOCUMENT_BUDGET;
  const shares = new Map();

  // Duas passadas: primeiro quem cabe inteiro, depois divide o resto por igual.
  let pending = [...withText];
  let changed = true;
  while (changed && pending.length) {
    changed = false;
    const fair = Math.floor(remaining / pending.length);
    const fits = pending.filter((item) => Math.min(item.text.length, PER_DOCUMENT_BUDGET) <= fair);
    for (const item of fits) {
      const share = Math.min(item.text.length, PER_DOCUMENT_BUDGET);
      shares.set(item, share);
      remaining -= share;
      changed = true;
    }
    pending = pending.filter((item) => !fits.includes(item));
  }
  const fairRest = pending.length ? Math.floor(remaining / pending.length) : 0;
  for (const item of pending) shares.set(item, Math.min(fairRest, PER_DOCUMENT_BUDGET));

  const trimmed = [];
  const lines = ["Arquivos anexados pelo usuario:"];

  for (const item of items) {
    const head = `- ${item.name} (${item.type}, ${item.size} bytes)`;
    if (!item.text) {
      lines.push(head);
      continue;
    }
    const budget = shares.get(item) || 0;
    const excerpt = selectExcerpts(item.text, prompt, budget);
    const wasTrimmed = excerpt.length < item.text.length;
    if (wasTrimmed) trimmed.push(item.name);
    lines.push(
      `${head}${wasTrimmed ? " — trecho selecionado do arquivo, nao o texto completo" : ""}\n  Conteudo do arquivo:\n${excerpt}`,
    );
  }

  return { text: lines.join("\n"), trimmed };
}
