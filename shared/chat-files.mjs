/**
 * Arquivos criados pela Mine (nov/2026): PDF, Word, Excel e página HTML.
 *
 * A Mine escreve o conteúdo num bloco de código ```arquivo:
 *
 *   ```arquivo
 *   tipo: pdf | word | excel | html
 *   titulo: Resumo de Fotossíntese
 *   ---
 *   ## Seção        (markdown do chat; no Excel, "## Aba" + tabela)
 *   ```
 *
 * e o navegador monta o arquivo aqui, sem biblioteca: .docx e .xlsx são
 * pastas zipadas de XML (Office Open XML), e o PDF sai da página HTML
 * diagramada (impressão do navegador, texto selecionável). Tudo puro, para os
 * testes em Node gerarem os mesmos bytes que o navegador.
 */

import { CALLOUT_TITLES, parseBlocks, parseInline } from "./chat-markdown.mjs";

// ---------------------------------------------------------------------------
// Pedido de arquivo no chat

function fold(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const FILE_VERB = String.raw`(?:cri[ae]|criar|faz|faca|fazer|ger[ae]|gerar|mont[ae]|montar|export[ae]|exportar|transform[ae]|transformar|convert[ae]|converter|pass[ae]|passar|coloc[ae]|colocar|salv[ae]|salvar|me\s+d[aeê]|mand[ae]|mandar|quero|queria|preciso(?:\s+de)?|baix[ae]|baixar|gostaria\s+de|elabor[ae]|prepar[ae]|organiz[ae]|organizar|escrev[ae]|escrever)`;

/**
 * A pessoa pediu um arquivo? Devolve o tipo ("pdf", "word", "excel", "html")
 * ou "" para seguir como conversa. Exige verbo de pedido perto do formato:
 * "como faço uma planilha no Excel?" é dúvida, não pedido de arquivo.
 */
export function asksForFile(text) {
  const value = fold(text);
  if (!value.trim() || value.length > 600) return "";
  if (/^\s*(?:o\s+que|como\s+(?:eu\s+)?(?:fa[cç]o|abro|uso|converto|crio|edito)|qual|quais|por\s*que|onde)\b/.test(value)) return "";
  const near = (noun) => new RegExp(String.raw`\b${FILE_VERB}\b[^.?!\n]{0,60}?\b${noun}\b`).test(value) || new RegExp(String.raw`\b(?:em|num|numa|no|na|como|formato|arquivo(?:\s+(?:de|do|em))?)\s+(?:um\s+|uma\s+)?${noun}\b`).test(value) && new RegExp(String.raw`\b${FILE_VERB}\b`).test(value);
  if (near(String.raw`(?:excel|planilhas?|xlsx|xls|csv)`)) return "excel";
  if (near(String.raw`(?:word|docx|doc|documento\s+(?:do|de)\s+word)`)) return "word";
  if (near(String.raw`(?:html|pagina\s+(?:web|html))`)) return "html";
  if (near(String.raw`(?:pdf|pdfs|apostila|arquivo\s+para\s+imprimir|folha\s+para\s+imprimir)`)) return "pdf";
  return "";
}

/** "Transforma essa conversa em resumo de prova", "folha de revisão". */
export function asksForStudySheet(text) {
  const value = fold(text);
  if (!value.trim() || value.length > 300) return false;
  if (/\b(?:resumo|folha|ficha)\s+(?:de|para|pra)\s+(?:a\s+)?(?:prova|revisao|vespera)\b/.test(value) && new RegExp(String.raw`\b${FILE_VERB}\b|^\s*(?:um\s+|uma\s+)?(?:resumo|folha|ficha)\b`).test(value)) return true;
  return /\b(?:transform\w*|vir[ae]\w*|convert\w*|pass[ae]\w*)\s+(?:essa|esta|a|nossa|toda\s+(?:essa|esta)?)?\s*conversa\s+(?:em|num|numa|para|pra)\b/.test(value);
}

// ---------------------------------------------------------------------------
// Bloco ```arquivo

const KINDS = { pdf: "pdf", word: "word", docx: "word", doc: "word", documento: "word", excel: "excel", xlsx: "excel", planilha: "excel", csv: "excel", html: "html", pagina: "html" };

/** Lê o cabeçalho do bloco. Sem cabeçalho, é um PDF com o texto todo. */
export function parseFileBlock(code) {
  const lines = String(code || "").replace(/\r/g, "").split("\n");
  const header = {};
  let index = 0;
  for (; index < Math.min(lines.length, 8); index += 1) {
    const line = lines[index].trim();
    if (/^-{3,}$/.test(line)) {
      index += 1;
      break;
    }
    const match = line.match(/^(tipo|titulo|título|title|type|formato)\s*:\s*(.+)$/i);
    if (!match) break;
    header[fold(match[1]).replace("title", "titulo").replace("type", "tipo").replace("formato", "tipo")] = match[2].trim();
  }
  const tipo = KINDS[fold(header.tipo || "").replace(/[^a-z]/g, "")] || "pdf";
  const corpo = lines.slice(index).join("\n").trim();
  const titulo = (header.titulo || firstHeading(corpo) || "Arquivo da Mine").replace(/[*_`#]/g, "").trim().slice(0, 90);
  return { tipo, titulo, corpo };
}

function firstHeading(markdown) {
  return markdown.match(/^#{1,3}\s+(.+)$/m)?.[1] || "";
}

/** Nome de arquivo sem acento nem símbolo: "Resumo de Fotossíntese" → "resumo-de-fotossintese". */
export function fileBaseName(titulo) {
  const base = fold(String(titulo || "").replace(/º/g, "o").replace(/ª/g, "a")).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return base || "arquivo-da-mine";
}

// ---------------------------------------------------------------------------
// Markdown → HTML (a mesma leitura do chat, em HTML puro e escapado)

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function inlineHtml(text) {
  const render = (tokens) =>
    tokens
      .map((token) => {
        switch (token.type) {
          case "text":
            return escapeHtml(token.text);
          case "code":
            return `<code>${escapeHtml(token.text)}</code>`;
          case "math":
            return `<span class="math">${escapeHtml(token.tex)}</span>`;
          case "strong":
            return `<strong>${render(token.children)}</strong>`;
          case "em":
            return `<em>${render(token.children)}</em>`;
          case "mark":
            return `<mark>${render(token.children)}</mark>`;
          case "del":
            return `<del>${render(token.children)}</del>`;
          case "link":
            return /^https?:\/\//i.test(token.href) ? `<a href="${escapeHtml(token.href)}">${render(token.children)}</a>` : render(token.children);
          default:
            return "";
        }
      })
      .join("");
  return render(parseInline(String(text || "")));
}

function checkbox(text) {
  const match = String(text).match(/^\[( |x|X)\]\s+(.*)$/);
  return match ? { done: match[1] !== " ", text: match[2] } : null;
}

function blocksHtml(blocks) {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading": {
          const level = Math.min(4, Math.max(2, block.level + (block.level === 1 ? 1 : 0)));
          return `<h${level}>${inlineHtml(block.text)}</h${level}>`;
        }
        case "paragraph":
          return `<p>${inlineHtml(block.text)}</p>`;
        case "rule":
          return "<hr>";
        case "code":
          return `<pre><code>${escapeHtml(block.code)}</code></pre>`;
        case "math":
          return `<p class="math-block">${escapeHtml(block.tex)}</p>`;
        case "table":
          return `<table><thead><tr>${block.header.map((cell) => `<th>${inlineHtml(cell)}</th>`).join("")}</tr></thead><tbody>${block.rows
            .map((row) => `<tr>${row.map((cell) => `<td>${inlineHtml(cell)}</td>`).join("")}</tr>`)
            .join("")}</tbody></table>`;
        case "callout":
          return `<aside class="callout callout-${block.kind}"><p class="callout-title">${escapeHtml(CALLOUT_TITLES[block.kind] || "Nota")}${block.title ? ` · ${inlineHtml(block.title)}` : ""}</p>${blocksHtml(block.children)}</aside>`;
        case "quote":
          return `<blockquote>${blocksHtml(block.children)}</blockquote>`;
        case "list":
          return listHtml(block);
        default:
          return "";
      }
    })
    .join("\n");
}

function listHtml(list) {
  const tag = list.ordered ? "ol" : "ul";
  const start = list.ordered && list.start !== 1 ? ` start="${list.start}"` : "";
  const checklist = !list.ordered && list.items.every((item) => checkbox(item.text));
  return `<${tag}${start}${checklist ? ' class="checklist"' : ""}>${list.items
    .map((item) => {
      const box = checklist ? checkbox(item.text) : null;
      const body = box ? `<span class="box">${box.done ? "✓" : ""}</span>${inlineHtml(box.text)}` : inlineHtml(item.text);
      return `<li>${body}${(item.children || []).map(listHtml).join("")}</li>`;
    })
    .join("")}</${tag}>`;
}

const PAGE_CSS = `
@page { size: A4; margin: 16mm 16mm 18mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; background: #eef1ee; color: #1d2320; font: 11pt/1.55 "Segoe UI", "Helvetica Neue", Arial, sans-serif; }
.page { max-width: 210mm; margin: 0 auto; padding: 18mm 18mm 20mm; background: #fff; min-height: 100vh; }
.top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 10px; border-bottom: 3px solid #2fd483; margin-bottom: 18px; }
.brand { font-size: 8.5pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #3b8f68; }
.date { font-size: 8.5pt; color: #6b756f; }
h1 { font-size: 22pt; line-height: 1.15; margin: 0 0 14px; letter-spacing: -.01em; color: #10221a; }
h2 { font-size: 14pt; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 1.5px solid #d5e9de; color: #14513a; break-after: avoid; }
h3 { font-size: 12pt; margin: 16px 0 6px; color: #1f3b2f; break-after: avoid; }
h4 { font-size: 11pt; margin: 12px 0 4px; }
p { margin: 0 0 9px; }
ul, ol { margin: 0 0 10px; padding-left: 22px; }
li { margin: 3px 0; }
ul.checklist { list-style: none; padding-left: 4px; }
ul.checklist .box { display: inline-block; width: 12px; height: 12px; margin-right: 8px; border: 1.5px solid #3b8f68; border-radius: 3px; font-size: 9px; line-height: 10px; text-align: center; vertical-align: -1px; }
mark { background: #fff2a8; padding: 0 2px; border-radius: 2px; }
code, pre, .math, .math-block { font-family: Consolas, "DM Mono", monospace; font-size: 9.5pt; }
code { background: #f1f4f2; padding: 1px 4px; border-radius: 3px; }
pre { background: #f6f8f7; border: 1px solid #e1e7e3; border-radius: 6px; padding: 10px 12px; white-space: pre-wrap; break-inside: avoid; }
pre code { background: none; padding: 0; }
.math-block { text-align: center; background: #f7faf8; border-radius: 6px; padding: 8px; }
table { width: 100%; border-collapse: collapse; margin: 6px 0 14px; font-size: 10pt; break-inside: auto; }
th, td { border: 1px solid #cfdad3; padding: 6px 8px; text-align: left; vertical-align: top; }
thead th { background: #e3f5eb; color: #14513a; font-weight: 700; }
tbody tr:nth-child(even) td { background: #f8fbf9; }
tr { break-inside: avoid; }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
blockquote { margin: 0 0 10px; padding: 4px 0 4px 12px; border-left: 3px solid #c9d6ce; color: #46524b; }
.callout { margin: 10px 0 12px; padding: 10px 12px 4px; border-radius: 8px; border-left: 4px solid #2fd483; background: #effaf4; break-inside: avoid; }
.callout-title { font-size: 9pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 4px; color: #14513a; }
.callout-tip, .callout-example { border-color: #f2b705; background: #fff9e6; }
.callout-tip .callout-title, .callout-example .callout-title { color: #8a6500; }
.callout-warning, .callout-mistake { border-color: #ef6b5b; background: #fff1ef; }
.callout-warning .callout-title, .callout-mistake .callout-title { color: #a33a2c; }
.callout-important { border-color: #7c6cf2; background: #f3f1ff; }
.callout-important .callout-title { color: #4b3fb3; }
.callout-definition, .callout-note, .callout-summary { border-color: #3aa0e8; background: #eef7fe; }
.callout-definition .callout-title, .callout-note .callout-title, .callout-summary .callout-title { color: #1d5f8f; }
hr { border: 0; border-top: 1px dashed #cdd8d1; margin: 16px 0; }
a { color: #1d6f50; }
.foot { margin-top: 26px; padding-top: 8px; border-top: 1px solid #e3e9e5; font-size: 8pt; color: #8a948e; }
@media print { body { background: #fff; } .page { padding: 0; max-width: none; min-height: 0; } }
@media (max-width: 640px) { .page { padding: 18px 16px; } h1 { font-size: 18pt; } }
`;

/** Página HTML completa e diagramada: é o arquivo .html e a base do PDF. */
export function fileHtml({ titulo, corpo, tipo = "pdf" }, { date = new Date() } = {}) {
  const blocks = parseBlocks(String(corpo || ""));
  // Um "# Título" igual ao título do arquivo seria repetido logo abaixo do h1.
  const body = blocks[0]?.type === "heading" && fold(blocks[0].text) === fold(titulo) ? blocks.slice(1) : blocks;
  const sheets = tipo === "excel" ? sheetsFromMarkdown(corpo) : [];
  const content = sheets.length
    ? sheets.map((sheet) => {
        const shown = displayRows(sheet);
        const numeric = sheet.rows[0].map((_, column) => sheet.rows.slice(1).some((row) => cellValue(row[column]).kind !== "text"));
        return `<h2>${escapeHtml(sheet.name)}</h2>${sheet.note ? `<p>${inlineHtml(sheet.note)}</p>` : ""}<table><thead><tr>${shown[0].map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead><tbody>${shown
          .slice(1)
          .map((row) => `<tr>${row.map((cell, column) => `<td${numeric[column] ? ' class="num"' : ""}>${escapeHtml(cell)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`;
      }).join("\n")
    : blocksHtml(body);
  const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(titulo)}</title>
<style>${PAGE_CSS}</style>
</head>
<body>
<main class="page">
<div class="top"><span class="brand">Minerva · feito com a Mine</span><span class="date">${escapeHtml(dia)}</span></div>
<h1>${escapeHtml(titulo)}</h1>
${content}
<p class="foot">Criado pela Mine, a tutora do Minerva. Confira as informações com o seu material de aula.</p>
</main>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Planilha: tabelas do markdown viram abas

function plainCell(cell) {
  return String(cell ?? "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/==(.+?)==/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/\\\|/g, "|")
    .trim();
}

/** Abas da planilha: cada tabela, com o título "## …" que veio antes dela. */
export function sheetsFromMarkdown(markdown) {
  const blocks = parseBlocks(String(markdown || ""));
  const sheets = [];
  let name = "";
  let note = "";
  for (const block of blocks) {
    if (block.type === "heading") {
      name = plainCell(block.text);
      note = "";
    } else if (block.type === "paragraph" && !note) {
      note = block.text;
    } else if (block.type === "table") {
      sheets.push({ name: name || `Planilha ${sheets.length + 1}`, note, rows: [block.header.map(plainCell), ...block.rows.map((row) => block.header.map((_, column) => plainCell(row[column])))] });
      name = "";
      note = "";
    }
  }
  // Nomes de aba: até 31 letras, sem []:*?/\ e sem repetir.
  const seen = new Set();
  for (const sheet of sheets) {
    let clean = sheet.name.replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Planilha";
    let candidate = clean;
    for (let n = 2; seen.has(candidate.toLowerCase()); n += 1) candidate = `${clean.slice(0, 27)} (${n})`;
    seen.add(candidate.toLowerCase());
    sheet.name = candidate;
  }
  return sheets;
}

/** CSV com ponto e vírgula (o Excel brasileiro abre direto), com BOM. */
export function sheetCsv(sheet) {
  const quote = (cell) => (/[;"\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
  return `﻿${sheet.rows.map((row) => row.map((cell) => quote(String(cell))).join(";")).join("\r\n")}`;
}

/**
 * Valor de uma célula: número ("1.234,56", "R$ 10", "15%") vira número de
 * verdade para o Excel somar; "=SOMA(B2:B4)" vira fórmula.
 */
export function cellValue(raw) {
  const text = String(raw ?? "").trim();
  if (/^=/.test(text) && text.length > 1) return { kind: "formula", formula: excelFormula(text.slice(1)) };
  const money = text.replace(/^(?:R\$|US\$|\$|€)\s*/i, "");
  const percent = /%$/.test(money);
  const core = money.replace(/%$/, "").trim();
  let number = NaN;
  if (/^[-+−]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(core)) number = Number(core.replace(/−/g, "-").replace(/\./g, "").replace(",", "."));
  else if (/^[-+−]?\d+(?:,\d+)?$/.test(core)) number = Number(core.replace(/−/g, "-").replace(",", "."));
  else if (/^[-+−]?\d+\.\d+$/.test(core)) number = Number(core.replace(/−/g, "-"));
  if (Number.isFinite(number) && core) return { kind: "number", value: percent ? number / 100 : number, percent };
  return { kind: "text", value: text };
}

// Nomes em português que o modelo usa → nomes que o arquivo .xlsx guarda.
const FORMULA_NAMES = {
  SOMA: "SUM", "MÉDIA": "AVERAGE", MEDIA: "AVERAGE", "MÁXIMO": "MAX", MAXIMO: "MAX", "MÍNIMO": "MIN", MINIMO: "MIN",
  SE: "IF", "CONT.SE": "COUNTIF", "CONT.VALORES": "COUNTA", "CONT.NÚM": "COUNT", "CONT.NUM": "COUNT", SOMASE: "SUMIF",
  "MÉDIASE": "AVERAGEIF", MEDIASE: "AVERAGEIF", ARRED: "ROUND", PROCV: "VLOOKUP", PROCH: "HLOOKUP", HOJE: "TODAY",
  AGORA: "NOW", E: "AND", OU: "OR", "NÃO": "NOT", NAO: "NOT", CONCATENAR: "CONCATENATE", ABS: "ABS", RAIZ: "SQRT",
  POTÊNCIA: "POWER", POTENCIA: "POWER", INT: "INT", TRUNCAR: "TRUNC", "MED": "MEDIAN", MODO: "MODE",
};

export function excelFormula(formula) {
  return String(formula)
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/;/g, ",")
    .replace(/([A-ZÀ-Ú][A-ZÀ-Ú.]*)\s*\(/g, (match, name) => `${FORMULA_NAMES[name] || name}(`);
}

/**
 * Valores para MOSTRAR a planilha (prévia, PDF, HTML): fórmula vira o
 * resultado. Entende o básico de uma planilha escolar: + - * / ^, parênteses,
 * células (B2), intervalos (B2:B6) e SUM/AVERAGE/MIN/MAX/COUNT/ROUND. O que
 * não entender continua aparecendo como a fórmula escrita; o Excel de verdade
 * recalcula tudo ao abrir o .xlsx.
 */
export function displayRows(sheet) {
  const rows = sheet.rows;
  const cache = new Map();
  const visiting = new Set();

  const numberAt = (column, row) => {
    const key = `${column}:${row}`;
    if (cache.has(key)) return cache.get(key);
    if (visiting.has(key)) return null;
    visiting.add(key);
    const cell = cellValue(rows[row]?.[column] ?? "");
    let value = null;
    if (cell.kind === "number") value = cell.value;
    else if (cell.kind === "formula") value = evaluate(cell.formula);
    else if (!cell.value) value = 0;
    visiting.delete(key);
    cache.set(key, value);
    return value;
  };

  const refIndex = (ref) => {
    const match = ref.match(/^\$?([A-Z]{1,3})\$?(\d+)$/);
    if (!match) return null;
    const column = match[1].split("").reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
    return { column, row: Number(match[2]) - 1 };
  };

  function evaluate(formula) {
    const tokens = String(formula).toUpperCase().match(/\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?|[A-Z][A-Z.]*(?=\s*\()|\d+(?:\.\d+)?|[-+*/^(),%]/g) || [];
    let at = 0;
    const peek = () => tokens[at];
    const next = () => tokens[at++];
    const list = () => {
      const values = [];
      if (peek() === ")") return values;
      for (;;) {
        const token = peek();
        if (/:/.test(token || "")) {
          next();
          const [from, to] = token.split(":").map(refIndex);
          if (!from || !to) throw new Error("intervalo");
          for (let r = Math.min(from.row, to.row); r <= Math.max(from.row, to.row); r += 1) {
            for (let c = Math.min(from.column, to.column); c <= Math.max(from.column, to.column); c += 1) {
              const cell = cellValue(rows[r]?.[c] ?? "");
              if (cell.kind === "text") continue;
              const value = numberAt(c, r);
              if (value !== null) values.push(value);
            }
          }
        } else values.push(expression());
        if (peek() !== ",") break;
        next();
      }
      return values;
    };
    const primary = () => {
      const token = next();
      if (token === undefined) throw new Error("fim");
      if (token === "(") {
        const value = expression();
        if (next() !== ")") throw new Error("parêntese");
        return value;
      }
      if (token === "-") return -primary();
      if (token === "+") return primary();
      if (/^\d/.test(token)) return Number(token);
      if (/^[A-Z][A-Z.]*$/.test(token) && peek() === "(") {
        next();
        const values = list();
        if (next() !== ")") throw new Error("parêntese");
        const sum = values.reduce((total, value) => total + value, 0);
        if (token === "SUM") return sum;
        if (token === "AVERAGE") return values.length ? sum / values.length : 0;
        if (token === "MIN") return values.length ? Math.min(...values) : 0;
        if (token === "MAX") return values.length ? Math.max(...values) : 0;
        if (token === "COUNT") return values.length;
        if (token === "ROUND") return Math.round(values[0] * 10 ** (values[1] || 0)) / 10 ** (values[1] || 0);
        if (token === "ABS") return Math.abs(values[0]);
        if (token === "SQRT") return Math.sqrt(values[0]);
        if (token === "POWER") return values[0] ** values[1];
        throw new Error("função");
      }
      const ref = refIndex(token);
      if (ref) {
        const value = numberAt(ref.column, ref.row);
        if (value === null) throw new Error("célula");
        return value;
      }
      throw new Error("token");
    };
    const power = () => {
      let value = primary();
      while (peek() === "%") {
        next();
        value /= 100;
      }
      while (peek() === "^") {
        next();
        value **= primary();
      }
      return value;
    };
    const term = () => {
      let value = power();
      while (peek() === "*" || peek() === "/") value = next() === "*" ? value * power() : value / power();
      return value;
    };
    function expression() {
      let value = term();
      while (peek() === "+" || peek() === "-") value = next() === "+" ? value + term() : value - term();
      return value;
    }
    try {
      const value = expression();
      return at === tokens.length && Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }

  // Coluna com centavos mostra todos os valores com duas casas ("2,00", não "2").
  const values = rows.map((row, rowIndex) =>
    row.map((raw, column) => {
      if (rowIndex === 0) return null;
      const cell = cellValue(raw);
      if (cell.kind === "formula") return { value: numberAt(column, rowIndex), percent: false };
      return cell.kind === "number" ? { value: cell.value, percent: cell.percent } : null;
    }),
  );
  const cents = (rows[0] || []).map((header, column) => /R\$|US\$|€|\bpre[cç]os?\b|\bvalor(?:es)?\b/i.test(String(header || "")) || values.some((row) => row[column] && !row[column].percent && row[column].value !== null && !Number.isInteger(row[column].value)));
  const format = (value, percent, column) =>
    percent
      ? `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value * 100)}%`
      : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: cents[column] ? 2 : 0 }).format(value);

  return rows.map((row, rowIndex) =>
    row.map((raw, column) => {
      if (rowIndex === 0) return String(raw ?? "");
      const shown = values[rowIndex][column];
      if (!shown) return String(cellValue(raw).value ?? raw ?? "");
      return shown.value === null ? String(raw) : format(shown.value, shown.percent, column);
    }),
  );
}

// ---------------------------------------------------------------------------
// ZIP sem compressão (o formato dos arquivos do Office)

const encoder = new TextEncoder();
let crcTable = null;

function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Monta um .zip "stored" a partir de { caminho: texto | bytes }. */
export function zipFiles(files) {
  const entries = Object.entries(files).map(([name, data]) => {
    const bytes = typeof data === "string" ? encoder.encode(data) : data;
    return { name: encoder.encode(name), bytes, crc: crc32(bytes) };
  });
  const chunks = [];
  const central = [];
  let offset = 0;
  const DOS_DATE = 0x5b74; // 2025-11-20; o Office não liga para a data
  for (const entry of entries) {
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, 0, true);
    local.setUint16(12, DOS_DATE, true);
    local.setUint32(14, entry.crc, true);
    local.setUint32(18, entry.bytes.length, true);
    local.setUint32(22, entry.bytes.length, true);
    local.setUint16(26, entry.name.length, true);
    local.setUint16(28, 0, true);
    chunks.push(new Uint8Array(local.buffer), entry.name, entry.bytes);
    const record = new DataView(new ArrayBuffer(46));
    record.setUint32(0, 0x02014b50, true);
    record.setUint16(4, 20, true);
    record.setUint16(6, 20, true);
    record.setUint16(8, 0x0800, true);
    record.setUint16(10, 0, true);
    record.setUint16(12, 0, true);
    record.setUint16(14, DOS_DATE, true);
    record.setUint32(16, entry.crc, true);
    record.setUint32(20, entry.bytes.length, true);
    record.setUint32(24, entry.bytes.length, true);
    record.setUint16(28, entry.name.length, true);
    record.setUint32(42, offset, true);
    central.push(new Uint8Array(record.buffer), entry.name);
    offset += 30 + entry.name.length + entry.bytes.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  const parts = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Excel (.xlsx)

function xml(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
}

function columnName(index) {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

function sheetXml(sheet) {
  const widths = sheet.rows[0].map((_, column) => Math.min(60, Math.max(8, ...sheet.rows.map((row) => String(row[column] ?? "").length + 2))));
  const rows = sheet.rows
    .map((row, rowIndex) => {
      const cells = row
        .map((raw, column) => {
          const ref = `${columnName(column)}${rowIndex + 1}`;
          if (rowIndex === 0) return `<c r="${ref}" t="inlineStr" s="1"><is><t xml:space="preserve">${xml(raw)}</t></is></c>`;
          const cell = cellValue(raw);
          if (cell.kind === "formula") return `<c r="${ref}" s="3"><f>${xml(cell.formula)}</f></c>`;
          if (cell.kind === "number") return `<c r="${ref}" s="${cell.percent ? 2 : 3}"><v>${cell.value}</v></c>`;
          if (!cell.value) return "";
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(cell.value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  const last = `${columnName(sheet.rows[0].length - 1)}${sheet.rows.length}`;
  return `${XML_HEAD}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${widths
    .map((width, column) => `<col min="${column + 1}" max="${column + 1}" width="${width}" customWidth="1"/>`)
    .join("")}</cols><sheetData>${rows}</sheetData>${sheet.rows.length > 1 ? `<autoFilter ref="A1:${last}"/>` : ""}</worksheet>`;
}

const XLSX_STYLES = `${XML_HEAD}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.##"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FF14513A"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE3F5EB"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF2FD483"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

/** Arquivos de dentro do .xlsx. Sem tabela, uma aba com o texto linha a linha. */
export function xlsxFiles({ titulo, corpo }) {
  let sheets = sheetsFromMarkdown(corpo);
  if (!sheets.length) {
    const linhas = String(corpo || "").split("\n").map((line) => line.trim()).filter(Boolean);
    sheets = [{ name: "Planilha", rows: [[titulo || "Conteúdo"], ...linhas.map((line) => [plainCell(line.replace(/^[-*#>\s]+/, ""))])] }];
  }
  const files = {
    "[Content_Types].xml": `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
      .map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join("")}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
    "_rels/.rels": `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
    "docProps/core.xml": coreXml(titulo),
    "xl/workbook.xml": `${XML_HEAD}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
      .map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
      .join("")}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
    "xl/_rels/workbook.xml.rels": `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
      .map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`)
      .join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": XLSX_STYLES,
  };
  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = sheetXml(sheet);
  });
  return files;
}

function coreXml(titulo) {
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  return `${XML_HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(titulo)}</dc:title><dc:creator>Mine · Minerva</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`;
}

// ---------------------------------------------------------------------------
// Word (.docx)

function runsXml(text, base = {}) {
  const render = (tokens, style) =>
    tokens
      .map((token) => {
        if (token.type === "text") return run(token.text, style);
        if (token.type === "code" || token.type === "math") return run(token.type === "code" ? token.text : token.tex, { ...style, mono: true });
        if (token.type === "strong") return render(token.children, { ...style, bold: true });
        if (token.type === "em") return render(token.children, { ...style, italic: true });
        if (token.type === "mark") return render(token.children, { ...style, mark: true });
        if (token.type === "del") return render(token.children, { ...style, strike: true });
        if (token.type === "link") return render(token.children, { ...style, link: true });
        return "";
      })
      .join("");
  return render(parseInline(String(text || "")), base);
}

function run(text, style = {}) {
  if (!text) return "";
  const props = [
    style.bold ? "<w:b/>" : "",
    style.italic ? "<w:i/>" : "",
    style.strike ? "<w:strike/>" : "",
    style.mono ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="20"/>' : "",
    style.color ? `<w:color w:val="${style.color}"/>` : style.link ? '<w:color w:val="1D6F50"/><w:u w:val="single"/>' : "",
    style.mark ? '<w:highlight w:val="yellow"/>' : "",
  ].join("");
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
}

function para(content, { style = "", indent = 0, shade = "", border = "", spacingAfter = null, keepNext = false } = {}) {
  const props = [
    style ? `<w:pStyle w:val="${style}"/>` : "",
    keepNext ? "<w:keepNext/>" : "",
    border ? `<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="${border}"/></w:pBdr>` : "",
    shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : "",
    spacingAfter !== null ? `<w:spacing w:after="${spacingAfter}"/>` : "",
    indent ? `<w:ind w:left="${indent}" w:hanging="${Math.min(indent, 280)}"/>` : "",
  ].join("");
  return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ""}${content}</w:p>`;
}

const CALLOUT_COLORS = {
  tip: ["F2B705", "FFF9E6"],
  example: ["F2B705", "FFF9E6"],
  warning: ["EF6B5B", "FFF1EF"],
  mistake: ["EF6B5B", "FFF1EF"],
  important: ["7C6CF2", "F3F1FF"],
  definition: ["3AA0E8", "EEF7FE"],
  note: ["3AA0E8", "EEF7FE"],
  summary: ["3AA0E8", "EEF7FE"],
  fun: ["2FD483", "EFFAF4"],
};

function docxBlocks(blocks, context = {}) {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return para(runsXml(block.text), { style: block.level <= 2 ? "Heading1" : block.level === 3 ? "Heading2" : "Heading3", keepNext: true });
        case "paragraph":
          return para(runsXml(block.text), { shade: context.shade, border: context.border });
        case "rule":
          return para("", { style: "Divisor" });
        case "code":
          return block.code.split("\n").map((line) => para(run(line || " ", { mono: true }), { shade: "F6F8F7", spacingAfter: 0 })).join("");
        case "math":
          return para(run(block.tex, { mono: true }), { shade: "F7FAF8" });
        case "list":
          return docxList(block, 0, context);
        case "quote":
          return docxBlocks(block.children, { ...context, border: "C9D6CE" });
        case "callout": {
          const [border, shade] = CALLOUT_COLORS[block.kind] || CALLOUT_COLORS.note;
          const title = para(run(`${CALLOUT_TITLES[block.kind] || "Nota"}${block.title ? ` · ${block.title.replace(/[*=`]/g, "")}` : ""}`.toUpperCase(), { bold: true, color: border }), { shade, border, spacingAfter: 40 });
          return title + docxBlocks(block.children, { shade, border });
        }
        case "table":
          return docxTable(block);
        default:
          return "";
      }
    })
    .join("");
}

function docxList(list, depth, context) {
  return list.items
    .map((item, index) => {
      const box = checkbox(item.text);
      const marker = list.ordered ? `${list.start + index}.` : box ? (box.done ? "☑" : "☐") : depth ? "◦" : "•";
      const body = runsXml(box ? box.text : item.text);
      return (
        para(`${run(`${marker}\t`)}${body}`, { indent: 360 + depth * 360, shade: context.shade, border: context.border, spacingAfter: 60 }) +
        (item.children || []).map((child) => docxList(child, depth + 1, context)).join("")
      );
    })
    .join("");
}

function docxTable(block) {
  const columns = block.header.length;
  const width = Math.floor(9000 / Math.max(1, columns));
  const cell = (text, header, stripe) =>
    `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${header ? '<w:shd w:val="clear" w:color="auto" w:fill="E3F5EB"/>' : stripe ? '<w:shd w:val="clear" w:color="auto" w:fill="F8FBF9"/>' : ""}</w:tcPr>${para(runsXml(text, header ? { bold: true, color: "14513A" } : {}), { spacingAfter: 0 })}</w:tc>`;
  const rows = [
    `<w:tr><w:trPr><w:tblHeader/></w:trPr>${block.header.map((text) => cell(text, true, false)).join("")}</w:tr>`,
    ...block.rows.map((row, index) => `<w:tr>${block.header.map((_, column) => cell(row[column] || "", false, index % 2 === 1)).join("")}</w:tr>`),
  ].join("");
  const border = (side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="CFDAD3"/>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(border).join("")}</w:tblBorders><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${block.header
    .map(() => `<w:gridCol w:w="${width}"/>`)
    .join("")}</w:tblGrid>${rows}</w:tbl>${para("", { spacingAfter: 120 })}`;
}

const DOCX_STYLES = `${XML_HEAD}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="18" w:space="6" w:color="2FD483"/></w:pBdr><w:spacing w:after="240"/></w:pPr><w:rPr><w:b/><w:color w:val="10221A"/><w:sz w:val="44"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:caps/><w:color w:val="3B8F68"/><w:spacing w:val="20"/><w:sz w:val="16"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="D5E9DE"/></w:pBdr><w:spacing w:before="320" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="14513A"/><w:sz w:val="30"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="220" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="1F3B2F"/><w:sz w:val="25"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Divisor"><w:name w:val="Divisor"/><w:basedOn w:val="Normal"/><w:pPr><w:pBdr><w:bottom w:val="dashed" w:sz="4" w:space="1" w:color="CDD8D1"/></w:pBdr></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Rodape"><w:name w:val="Rodape"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="8A948E"/><w:sz w:val="16"/></w:rPr></w:style></w:styles>`;

/** Arquivos de dentro do .docx. */
export function docxFiles({ titulo, corpo }, { date = new Date() } = {}) {
  const blocks = parseBlocks(String(corpo || ""));
  const body = blocks[0]?.type === "heading" && fold(blocks[0].text) === fold(titulo) ? blocks.slice(1) : blocks;
  const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
  const document = `${XML_HEAD}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${para(run(`Minerva · feito com a Mine · ${dia}`), { style: "Subtitle" })}${para(run(titulo), { style: "Title" })}${docxBlocks(body)}${para(run("Criado pela Mine, a tutora do Minerva. Confira as informações com o seu material de aula."), { style: "Rodape" })}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  return {
    "[Content_Types].xml": `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
    "_rels/.rels": `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
    "docProps/core.xml": coreXml(titulo),
    "word/_rels/document.xml.rels": `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "word/styles.xml": DOCX_STYLES,
    "word/document.xml": document,
  };
}

/** Bytes prontos de cada formato. */
export function buildDocx(file, options) {
  return zipFiles(docxFiles(file, options));
}

export function buildXlsx(file) {
  return zipFiles(xlsxFiles(file));
}
