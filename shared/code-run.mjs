/**
 * Que bloco de código do chat dá para rodar ou mostrar como site.
 * Usado pela tela (src/chat/*) e pelos testes; tipos em code-run.d.mts.
 */

/** Linguagem executável a partir da etiqueta da cerca (```python). */
export function runnableLanguage(lang) {
  const value = String(lang || "").toLowerCase();
  if (["python", "py", "python3"].includes(value)) return "python";
  if (["javascript", "js", "node", "mjs"].includes(value)) return "javascript";
  return null;
}

/** O bloco é uma página que dá para mostrar funcionando (e não um trecho solto de tag)? */
export function isSitePage(code, lang) {
  const language = String(lang || "").toLowerCase();
  if (!["html", "htm", "xhtml"].includes(language)) return false;
  const text = String(code || "");
  if (text.length < 120) return false;
  return /<!doctype html|<html[\s>]|<body[\s>]/i.test(text) || (/<style[\s>]/i.test(text) && /<(div|section|main|header)[\s>]/i.test(text));
}

/** Linguagem da aba MineCode (Python, JavaScript ou HTML) a partir da cerca. */
export function mineCodeLanguage(lang) {
  const runnable = runnableLanguage(lang);
  if (runnable) return runnable;
  return ["html", "htm", "xhtml"].includes(String(lang || "").toLowerCase()) ? "html" : null;
}

const FENCE_LANGS = { python: "python", py: "python", python3: "python", javascript: "javascript", js: "javascript", node: "javascript", mjs: "javascript", html: "html", htm: "html", xhtml: "html" };

/**
 * Lê a resposta da Mine no chat do MineCode: separa a explicação do código.
 * Vale também no meio do streaming — com o bloco ainda aberto, `open` é true e
 * `code` traz o que já chegou, para o editor ir se escrevendo ao vivo.
 * Pega o ÚLTIMO bloco de uma linguagem que o MineCode roda.
 */
export function readCodeReply(text) {
  const source = String(text || "").replace(/\r/g, "");
  const fence = /```([a-zA-Z0-9+#-]*)[^\n]*\n([\s\S]*?)(```|$)/g;
  let found = null;
  let match;
  while ((match = fence.exec(source))) {
    const lang = FENCE_LANGS[String(match[1] || "").toLowerCase()];
    if (lang) found = { lang, code: match[2], open: match[3] !== "```", start: match.index, end: match.index + match[0].length };
    if (match[0].length === 0) break;
  }
  if (!found) return { explanation: source.trim(), code: "", lang: null, open: false };
  const explanation = (source.slice(0, found.start) + "\n\n" + source.slice(found.end))
    .replace(/```[\s\S]*?(```|$)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { explanation, code: found.code.replace(/\s+$/, "") + (found.open ? "" : "\n"), lang: found.lang, open: found.open };
}
