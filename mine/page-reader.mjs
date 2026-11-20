// Leitura das paginas encontradas na busca (out/2026).
//
// A busca devolve trechos de ~900 caracteres. Para pergunta de detalhe (uma
// data no meio do edital, a tabela de um artigo) o trecho quase nunca traz o
// dado, e a Mine respondia "as fontes nao informam". Os chats grandes abrem as
// melhores paginas antes de responder; aqui o servidor faz o mesmo com as
// primeiras, guardando so os paragrafos que falam do que foi perguntado.
//
// Seguranca: o endereco vem de um resultado de busca, ou seja, de terceiros.
// So https publico (DNS checado a cada redirecionamento, sem IP privado), so
// HTML/texto, corpo limitado e tempo curto. Falhar aqui nunca derruba a
// resposta: a pagina fica so com o trecho da busca.

import dns from "node:dns/promises";
import net from "node:net";

const MAX_BYTES = 1_500_000;
const PAGE_TIMEOUT_MS = 4_500;
export const PAGE_TEXT_CHARS = 3_500;

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const lower = address.toLowerCase();
  return (
    lower === "::" || lower === "::1" ||
    lower.startsWith("fc") || lower.startsWith("fd") ||
    lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb") ||
    (lower.startsWith("::ffff:") && isPrivateAddress(lower.slice(7)))
  );
}

async function publicHttps(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) return isPrivateAddress(host) ? null : url;
  const addresses = await dns.lookup(host, { all: true }).catch(() => []);
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) return null;
  return url;
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»" };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, code) => {
    if (code[0] === "#") {
      const value = code[1].toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(value) && value > 31 && value < 0x110000 ? String.fromCodePoint(value) : " ";
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/**
 * HTML -> paragrafos de texto. Sem parser de DOM: o bastante para artigo,
 * noticia e pagina de orgao publico, que e o que a busca devolve.
 */
export function htmlToParagraphs(html) {
  let body = String(html || "");
  // O miolo da pagina, quando ela marca onde fica.
  const main = body.match(/<(article|main)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2];
  if (main && main.length > 800) body = main;
  body = body
    .replace(/<(script|style|noscript|svg|template|iframe|form|nav|header|footer|aside|button|select)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // Fim de bloco vira quebra; celula de tabela vira separador.
    .replace(/<\/(p|div|section|li|h[1-6]|tr|blockquote|pre|dd|dt|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(body)
    .split(/\n+/)
    .map((line) => line.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").replace(/(\s*\|\s*)+$/, "").trim())
    .filter((line) => line.length >= 40 || (/\d/.test(line) && line.length >= 12));
}

function words(text) {
  return String(text || "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 || /^\d{2,}$/.test(word));
}

/**
 * Os paragrafos que mais falam da pergunta, na ordem em que aparecem na
 * pagina, ate `limit` caracteres. Sem palavra em comum, o comeco da pagina.
 */
export function relevantText(paragraphs, query, limit = PAGE_TEXT_CHARS) {
  const asked = new Set(words(query));
  const scored = paragraphs.map((text, index) => {
    const own = words(text);
    const hits = own.filter((word) => asked.has(word)).length;
    return { text, index, score: hits / Math.sqrt(own.length + 4) };
  });
  const anyHit = scored.some((item) => item.score > 0);
  const order = anyHit ? [...scored].sort((a, b) => b.score - a.score || a.index - b.index) : scored;
  const picked = [];
  let used = 0;
  for (const item of order) {
    if (used >= limit) break;
    if (anyHit && item.score === 0) break;
    const text = item.text.slice(0, Math.max(0, limit - used));
    picked.push({ ...item, text });
    used += text.length + 1;
  }
  return picked.sort((a, b) => a.index - b.index).map((item) => item.text).join("\n");
}

async function readBody(response) {
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > MAX_BYTES) break;
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  const declared = String(response.headers.get("content-type") || "").match(/charset=([\w-]+)/i)?.[1];
  const sniffed = buffer.subarray(0, 2048).toString("latin1").match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  try {
    return new TextDecoder(declared || sniffed || "utf-8").decode(buffer);
  } catch {
    return buffer.toString("utf8");
  }
}

/** Texto util de uma pagina, ou "" se nao deu para ler. */
export async function readPage(rawUrl, query, options = {}) {
  return (await openPage(rawUrl, query, options)).text;
}

/**
 * Baixa uma pagina publica (https, DNS checado a cada redirecionamento).
 * Devolve `{ raw, type, url }` ou null.
 */
async function fetchPublicPage(rawUrl, { signal, timeoutMs = PAGE_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    let current = await publicHttps(rawUrl);
    for (let hop = 0; current && hop < 4; hop += 1) {
      const response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; MinervaMine/1.0; +https://minerva.app)",
          accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
          "accept-language": "pt-BR,pt;q=0.9,en;q=0.6",
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        current = location ? await publicHttps(new URL(location, current).toString()) : null;
        continue;
      }
      if (!response.ok) return null;
      const type = String(response.headers.get("content-type") || "").toLowerCase();
      if (!type.includes("html") && !type.startsWith("text/plain")) return null;
      return { raw: await readBody(response), type, url: current.toString() };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function pageTitle(raw) {
  return decodeEntities(raw.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim().slice(0, 160);
}

/**
 * Os `count` paragrafos que mais falam da pergunta, na ordem da pagina, cortados
 * em ~160 caracteres. E o que o Controle Mine grifa na pagina ao vivo; sem
 * palavra em comum, os primeiros paragrafos.
 */
export function pageHighlights(paragraphs, query, count = 3) {
  const asked = new Set(words(query));
  const scored = paragraphs
    .map((text, index) => {
      const own = words(text);
      return { text, index, score: own.filter((word) => asked.has(word)).length / Math.sqrt(own.length + 4) };
    })
    .filter((item) => item.text.length >= 60);
  const anyHit = scored.some((item) => item.score > 0);
  const picked = anyHit ? [...scored].filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, count) : scored.slice(0, Math.min(2, count));
  return picked.sort((a, b) => a.index - b.index).map((item) => item.text.slice(0, 160));
}

/**
 * Abre uma pagina e devolve `{ text, title, url, highlights }` (url final,
 * depois dos redirecionamentos). Em falha, `text` vem vazio.
 */
export async function openPage(rawUrl, query, { signal, timeoutMs = PAGE_TIMEOUT_MS, limit = PAGE_TEXT_CHARS } = {}) {
  const empty = { text: "", title: "", url: String(rawUrl || ""), highlights: [] };
  const page = await fetchPublicPage(rawUrl, { signal, timeoutMs });
  if (!page) return empty;
  const paragraphs = page.type.startsWith("text/plain")
    ? page.raw.split(/\n{2,}/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean)
    : htmlToParagraphs(page.raw);
  return { text: relevantText(paragraphs, query, limit), title: pageTitle(page.raw), url: page.url, highlights: pageHighlights(paragraphs, query) };
}

const PANEL_HTML_BYTES = 900_000;

/**
 * HTML de terceiros pronto para o painel do Controle Mine. A barreira de
 * seguranca e o iframe com `sandbox` sem `allow-scripts` (nada roda la
 * dentro); a limpeza daqui e a segunda camada e deixa a pagina leve: sem
 * scripts, frames, eventos inline nem redirecionamento, com <base> apontando
 * para o site (CSS e imagens relativos funcionam) e links abrindo fora.
 */
export function sanitizePageHtml(raw, baseUrl) {
  let html = String(raw || "")
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*>/gi, "")
    .replace(/<(iframe|frame|frameset|object|embed|applet|portal)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(iframe|frame|object|embed|applet|portal|base)\b[^>]*>/gi, "")
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?(refresh|content-security-policy|set-cookie)[^>]*>/gi, "")
    .replace(/<link\b[^>]*rel\s*=\s*["']?(preload|prefetch|modulepreload|manifest|serviceworker)[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src|action|formaction)\s*=\s*(["']?)\s*javascript:[^"'\s>]*/gi, '$1=$2#')
    // Imagem "preguiçosa" que dependia de script para aparecer.
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const lazy = tag.match(/\sdata-(?:src|lazy-src|original)\s*=\s*("[^"]*"|'[^']*')/i)?.[1];
      if (!lazy) return tag;
      const hasRealSrc = /\ssrc\s*=\s*["'](?!data:)[^"']+["']/i.test(tag);
      return hasRealSrc ? tag : tag.replace(/\ssrc\s*=\s*("[^"]*"|'[^']*')/i, "").replace(/<img\b/i, `<img src=${lazy}`);
    });
  const safeBase = String(baseUrl || "").replace(/"/g, "%22");
  const head = `<meta charset="utf-8"><base href="${safeBase}" target="_blank"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'"><style>html{scroll-behavior:smooth;scrollbar-width:none}html::-webkit-scrollbar{display:none}.mine-grifo{background:linear-gradient(transparent 12%,rgba(57,245,154,.55) 12%,rgba(57,245,154,.55) 88%,transparent 88%) no-repeat 0 0/0% 100%;transition:background-size 1.1s ease-out;border-radius:2px}.mine-grifo.is-on{background-size:100% 100%}</style>`;
  html = /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, (tag) => `${tag}${head}`) : `${head}${html}`;
  return html.length > PANEL_HTML_BYTES ? html.slice(0, PANEL_HTML_BYTES) : html;
}

/** Pagina limpa para o painel: `{ html, title, url }` ou null. */
export async function pageForPanel(rawUrl, { signal, timeoutMs = 7_000 } = {}) {
  const page = await fetchPublicPage(rawUrl, { signal, timeoutMs });
  if (!page) return null;
  const html = page.type.startsWith("text/plain")
    ? `<pre style="white-space:pre-wrap;font:15px/1.6 system-ui;padding:16px">${page.raw.slice(0, 200_000).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`
    : page.raw;
  return { html: sanitizePageHtml(html, page.url), title: pageTitle(page.raw), url: page.url };
}

/**
 * Le as `count` primeiras paginas em paralelo e devolve os resultados com
 * `content` preenchido nas que deram certo. O tempo e o da pagina mais lenta,
 * limitado por `timeoutMs`.
 */
export async function readTopPages(results, query, { count = 3, signal, timeoutMs = PAGE_TIMEOUT_MS } = {}) {
  const head = results.slice(0, count);
  const pages = await Promise.all(head.map((item) => openPage(item.url, `${query} ${item.title}`, { signal, timeoutMs })));
  return results.map((item, index) => {
    const page = index < count ? pages[index] : null;
    // `highlights`: os trechos que o Controle Mine grifa na pagina ao vivo.
    return page?.text && page.text.length > (item.snippet || "").length ? { ...item, content: page.text, highlights: page.highlights } : item;
  });
}
