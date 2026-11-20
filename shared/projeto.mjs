/**
 * Bloco ````projeto do chat da Mine: um projeto com vários arquivos.
 *
 *   ````projeto
 *   === projeto: Portfólio da Ana ===
 *   === arquivo: index.html ===
 *   <!doctype html>...
 *   === arquivo: style.css ===
 *   body { ... }
 *   ````
 *
 * Daqui saem a lista de arquivos (monitor e .zip), o tipo do projeto e a
 * página única da prévia (CSS e JS colocados dentro do HTML, para rodar no
 * iframe isolado sem servidor). Usado pelo navegador e pelos testes Node.
 */

const MARK = /^\s*={3,}\s*(projeto|arquivo|file)\s*:\s*(.+?)\s*={3,}\s*$/i;

const LANG_BY_EXT = {
  html: "html",
  htm: "html",
  css: "css",
  js: "javascript",
  mjs: "javascript",
  json: "json",
  py: "python",
  md: "markdown",
  txt: "text",
  svg: "xml",
  xml: "xml",
  java: "java",
  c: "c",
  cpp: "cpp",
  h: "c",
  cs: "csharp",
  sql: "sql",
  ts: "typescript",
  sh: "bash",
};

/** Caminho seguro dentro do zip: sem "..", sem barra no começo, só caracteres comuns. */
export function safePath(path) {
  const parts = String(path || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim().replace(/[^\w.\- ]+/g, "").replace(/^\.+/, ""))
    .filter((part) => part && part !== "." && part !== "..");
  return parts.join("/").slice(0, 120);
}

export function languageOf(path) {
  const ext = String(path || "").toLowerCase().split(".").pop() || "";
  return LANG_BY_EXT[ext] || ext || "text";
}

/** Tira uma cerca de código que o modelo às vezes põe em volta de um arquivo. */
function unwrap(content) {
  const lines = content.replace(/\r/g, "").split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (lines.length >= 2 && /^\s*(`{3,}|~{3,})[\w#+.-]*\s*$/.test(lines[0]) && /^\s*(`{3,}|~{3,})\s*$/.test(lines[lines.length - 1])) {
    lines.shift();
    lines.pop();
  }
  return lines.join("\n");
}

/**
 * Lê o bloco. `open` (bloco ainda chegando) marca o último arquivo como
 * incompleto, para o monitor mostrar "escrevendo style.css…".
 */
export function parseProject(code, { open = false } = {}) {
  const lines = String(code || "").replace(/\r/g, "").split("\n");
  let name = "";
  const files = [];
  let current = null;
  const intro = [];
  for (const line of lines) {
    const match = line.match(MARK);
    if (match) {
      const kind = match[1].toLowerCase();
      if (kind === "projeto") {
        name = match[2].trim().slice(0, 80);
        continue;
      }
      const path = safePath(match[2]);
      if (!path) continue;
      current = { path, body: [] };
      files.push(current);
      continue;
    }
    if (current) current.body.push(line);
    else if (line.trim()) intro.push(line);
  }
  // Sem marcadores, mas com cercas por arquivo (```html, ```css...): o modelo
  // às vezes separa assim. Cada cerca vira um arquivo com o nome de costume.
  if (!files.length && intro.length) {
    const fenced = filesFromFences(lines);
    if (fenced.length) files.push(...fenced);
  }
  // Sem marcadores nem cercas: um arquivo só, adivinhando o tipo pelo conteúdo.
  if (!files.length && intro.length) {
    const text = intro.join("\n");
    const path = /<html|<!doctype|<body/i.test(text) ? "index.html" : /^\s*(?:def |import |from |print\()/m.test(text) ? "main.py" : "index.html";
    files.push({ path, body: intro });
  }
  // Mesmo caminho duas vezes: vale a última versão.
  const byPath = new Map();
  files.forEach((file, index) => {
    byPath.set(file.path, {
      path: file.path,
      language: languageOf(file.path),
      content: unwrap(file.body.join("\n")),
      writing: open && index === files.length - 1,
    });
  });
  const list = [...byPath.values()];
  return { name: name || guessName(list), files: list, kind: kindOf(list), entry: entryOf(list) };
}

const DEFAULT_NAME = { html: "index.html", htm: "index.html", css: "style.css", javascript: "script.js", js: "script.js", python: "main.py", py: "main.py", markdown: "README.md", md: "README.md", json: "data.json", java: "Main.java", c: "main.c", cpp: "main.cpp", sql: "script.sql" };
const FILE_HINT = /([\w\-./]+\.[a-z0-9]{1,5})/i;

function filesFromFences(lines) {
  const out = [];
  let index = 0;
  while (index < lines.length) {
    const opener = lines[index].match(/^\s*(`{3,}|~{3,})\s*([\w#+.-]*)\s*(.*)$/);
    if (!opener || !opener[2] && !opener[3]) {
      index += 1;
      continue;
    }
    const marker = opener[1];
    const lang = opener[2].toLowerCase();
    // Nome do arquivo: na própria cerca (```css style.css) ou na linha de cima ("**style.css**").
    let hint = (opener[3].match(FILE_HINT) || [])[1] || "";
    if (!hint) {
      for (let back = index - 1; back >= 0 && back >= index - 2; back -= 1) {
        if (!lines[back].trim()) continue;
        if (lines[back].trim().length < 60) hint = (lines[back].match(FILE_HINT) || [])[1] || "";
        break;
      }
    }
    const body = [];
    index += 1;
    for (; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (line.startsWith(marker[0].repeat(marker.length)) && !line.replace(/[`~]/g, "")) {
        index += 1;
        break;
      }
      body.push(lines[index]);
    }
    let path = safePath(hint) || DEFAULT_NAME[lang] || `arquivo.${lang || "txt"}`;
    if (out.some((file) => file.path === path)) path = path.replace(/(\.[^.]+)?$/, (ext) => `-${out.length + 1}${ext || ""}`);
    out.push({ path, body });
  }
  return out;
}

function guessName(files) {
  const html = files.find((file) => file.language === "html");
  const title = html?.content.match(/<title>([^<]{1,80})<\/title>/i)?.[1]?.trim();
  if (title) return title;
  return files.some((file) => file.language === "python") ? "Programa em Python" : "Meu projeto";
}

/** "site" (tem HTML), "python" (tem .py), "javascript" (só JS) ou "outro". */
export function kindOf(files) {
  if (files.some((file) => file.language === "html")) return "site";
  if (files.some((file) => file.language === "python")) return "python";
  if (files.some((file) => file.language === "javascript")) return "javascript";
  return "outro";
}

export function entryOf(files) {
  const kind = kindOf(files);
  const pick = (test) => files.find(test)?.path || "";
  if (kind === "site") return pick((file) => /(^|\/)index\.html?$/i.test(file.path)) || pick((file) => file.language === "html");
  if (kind === "python") return pick((file) => /(^|\/)main\.py$/i.test(file.path)) || pick((file) => file.language === "python");
  if (kind === "javascript") return pick((file) => /(^|\/)(main|index|app)\.m?js$/i.test(file.path)) || pick((file) => file.language === "javascript");
  return files[0]?.path || "";
}

/** Nome de arquivo a partir do nome do projeto: "Portfólio da Ana" → "portfolio-da-ana". */
export function slug(text, fallback = "projeto") {
  const value = String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return value || fallback;
}

function resolve(fromPath, ref) {
  const clean = String(ref || "").split(/[?#]/)[0].trim();
  if (!clean || /^(?:[a-z]+:)?\/\//i.test(clean) || /^(?:data|blob|https?):/i.test(clean)) return "";
  const base = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/") + 1) : "";
  const parts = [];
  for (const part of (clean.startsWith("/") ? clean.slice(1) : base + clean).split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

const closeTag = (text, tag) => text.replace(new RegExp(`</${tag}`, "gi"), `<\\/${tag}`);

/**
 * Página única da prévia: troca <link href="style.css"> e <script src="app.js">
 * pelo conteúdo dos arquivos do projeto. Referências externas (CDN) ficam como
 * estão. Sem HTML no projeto, devolve "".
 */
export function buildPreviewHtml(files, entry = entryOf(files)) {
  const page = files.find((file) => file.path === entry && file.language === "html");
  if (!page) return "";
  const byPath = new Map(files.map((file) => [file.path, file]));
  let html = page.content;
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) return tag;
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    const file = href ? byPath.get(resolve(page.path, href)) : null;
    return file ? `<style data-arquivo="${file.path}">\n${closeTag(file.content, "style")}\n</style>` : tag;
  });
  html = html.replace(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, before, src, after) => {
    const file = byPath.get(resolve(page.path, src));
    if (!file) return tag;
    const attrs = `${before} ${after}`.replace(/\s+/g, " ").trim();
    return `<script${attrs ? ` ${attrs}` : ""} data-arquivo="${file.path}">\n${closeTag(file.content, "script")}\n</script>`;
  });
  return html;
}

/** Bloco ```html de página inteira (formato antigo) visto como projeto de um arquivo. */
export function projectFromHtml(code) {
  const files = [{ path: "index.html", language: "html", content: String(code || ""), writing: false }];
  return { name: guessName(files), files, kind: "site", entry: "index.html" };
}
