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
