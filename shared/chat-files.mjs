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

const FILE_VERB = String.raw`(?:continu[ae]|continuar|termin[ae]|terminar|refa[cz]\w*|complet[ae]|completar|cri[ae]|criar|faz|faca|fazer|ger[ae]|gerar|mont[ae]|montar|export[ae]|exportar|transform[ae]|transformar|convert[ae]|converter|pass[ae]|passar|coloc[ae]|colocar|salv[ae]|salvar|me\s+d[aeê]|mand[ae]|mandar|quero|queria|preciso(?:\s+de)?|baix[ae]|baixar|gostaria\s+de|elabor[ae]|prepar[ae]|organiz[ae]|organizar|escrev[ae]|escrever)`;

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
  // "continua o arquivo" / "refaça o arquivo completo": retomada de um arquivo cortado
  if (/\b(?:continu[ae]|continuar|termin[ae]|terminar|refa[cz]\w*|complet[ae]|completar)\b[^.?!\n]{0,40}?\barquivo\b/.test(value)) return "pdf";
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

const KINDS = {
  pdf: "pdf",
  relatorio: "pdf",
  dossie: "pdf",
  pesquisa: "pdf",
  word: "word",
  docx: "word",
  doc: "word",
  documento: "word",
  excel: "excel",
  xlsx: "excel",
  planilha: "excel",
  csv: "excel",
  html: "html",
  pagina: "html",
};

const HEADER_KEYS = {
  tipo: "tipo",
  type: "tipo",
  formato: "tipo",
  titulo: "titulo",
  title: "titulo",
  modelo: "modelo",
  estilo: "modelo",
  layout: "modelo",
  subtitulo: "subtitulo",
  subtitle: "subtitulo",
  materia: "materia",
  disciplina: "materia",
  area: "materia",
  resumo: "resumo",
  sintese: "resumo",
};

/** Lê o cabeçalho do bloco. Sem cabeçalho, é um PDF com o texto todo. */
export function parseFileBlock(code) {
  const lines = String(code || "").replace(/\r/g, "").split("\n");
  const header = {};
  let index = 0;
  for (; index < Math.min(lines.length, 12); index += 1) {
    const line = lines[index].trim();
    if (!line && Object.keys(header).length) continue;
    if (/^-{3,}$/.test(line)) {
      index += 1;
      break;
    }
    const match = line.match(/^([\p{L}_-]{3,16})\s*:\s*(.+)$/u);
    if (!match) break;
    const key = HEADER_KEYS[fold(match[1]).replace(/[^a-z]/g, "")];
    if (!key) break;
    header[key] = match[2].trim();
  }
  const rawTipo = fold(header.tipo || "").replace(/[^a-z]/g, "");
  const tipo = KINDS[rawTipo] || "pdf";
  const rawModelo = fold(header.modelo || "").replace(/[^a-z]/g, "");
  const modelo = /^(?:pesquisa|relatorio|dossie|academico|aprofundad)/.test(rawModelo) || /^(?:relatorio|dossie|pesquisa)$/.test(rawTipo) ? "pesquisa" : "";
  const corpo = lines.slice(index).join("\n").trim();
  const cleanMeta = (value, max) => String(value || "").replace(/[*_`#]/g, "").trim().slice(0, max);
  const titulo = cleanMeta(header.titulo || firstHeading(corpo) || "Arquivo da Mine", 140);
  const subtitulo = cleanMeta(header.subtitulo, 180);
  const materia = cleanMeta(header.materia, 60);
  const resumo = String(header.resumo || "").trim().slice(0, 900);
  return {
    tipo,
    titulo,
    corpo,
    ...(modelo ? { modelo } : {}),
    ...(subtitulo ? { subtitulo } : {}),
    ...(materia ? { materia } : {}),
    ...(resumo ? { resumo } : {}),
  };
}

function firstHeading(markdown) {
  return markdown.match(/^#{1,3}\s+(.+)$/m)?.[1] || "";
}

function cleanHeadingTitle(text) {
  return String(text || "")
    .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, "")
    .replace(/^\d{1,2}\s*[.)\-–—:]\s*/, "")
    .trim();
}

/**
 * Garante que toda resposta de Pesquisa Aprofundada tenha um bloco ```arquivo
 * com `modelo: pesquisa` pronto para virar PDF/HTML, mesmo se o modelo esquecer
 * o cabeçalho `modelo: pesquisa` ou escrever o relatório direto no markdown.
 */
export function ensureDeepResearchFile(reply, { prompt = "", subjectName = "" } = {}) {
  const source = String(reply || "").trim();
  if (!source) return source;

  // Já veio com ```arquivo: apenas garante `modelo: pesquisa` no cabeçalho se for PDF/HTML.
  if (/```arquivo\b/i.test(source)) {
    return source.replace(/```arquivo[ \t]*\r?\n([\s\S]*?)```/i, (full, inner) => {
      const parsed = parseFileBlock(inner);
      if (parsed.tipo === "excel" || parsed.modelo === "pesquisa") return full;
      const lines = String(inner || "").replace(/\r/g, "").split("\n");
      const sepIndex = lines.findIndex((line, idx) => idx < 12 && /^-{3,}$/.test(line.trim()));
      if (sepIndex >= 0) {
        lines.splice(sepIndex, 0, "modelo: pesquisa");
        return `\`\`\`arquivo\n${lines.join("\n")}\`\`\``;
      }
      return `\`\`\`arquivo\ntipo: pdf\nmodelo: pesquisa\ntitulo: ${parsed.titulo}\n---\n${parsed.corpo}\n\`\`\``;
    });
  }

  // Sem ```arquivo: só embrulha se for de fato um relatório estruturado (não uma recusa curta).
  const headings = source.match(/^#{1,3}\s+.+$/gm) || [];
  if (headings.length < 2 && source.length < 700) return source;

  // Separa marcador final de sugestões/glossário para continuar fora do arquivo.
  const trailing = [];
  const mainBody = source
    .replace(/\n*\[\[(?:sugestoes|sugestões|glossario|glossário):[^\]]*\]\]\s*/gi, (match) => {
      trailing.push(match.trim());
      return "\n";
    })
    .trim();

  const blocks = mainBody.split(/\n{2,}/);
  const firstHeadingAt = blocks.findIndex((chunk) => /^#{1,3}\s+/.test(chunk.trim()));
  const intro = firstHeadingAt > 0 ? blocks.slice(0, Math.min(2, firstHeadingAt)).join("\n\n").trim() : "";
  const rawTitle = cleanHeadingTitle(firstHeading(mainBody)) || cleanHeadingTitle(prompt).slice(0, 90) || "Relatório de Pesquisa";
  const materiaLine = subjectName ? `materia: ${String(subjectName).replace(/\r?\n/g, " ").trim().slice(0, 60)}\n` : "";
  const lead = intro || `Preparei o relatório completo sobre **${rawTitle}** em PDF e HTML logo abaixo.`;
  const fileBlock = `\`\`\`arquivo\ntipo: pdf\nmodelo: pesquisa\ntitulo: ${rawTitle}\n${materiaLine}---\n${mainBody}\n\`\`\``;
  return [lead, fileBlock, ...trailing].filter(Boolean).join("\n\n");
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

function sourceDomain(source) {
  if (source?.domain) return String(source.domain).replace(/^www\./, "");
  try {
    return new URL(String(source?.url || "")).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function inlineHtml(text, ctx = {}) {
  const sources = Array.isArray(ctx.sources) ? ctx.sources : [];
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
            return /^https?:\/\//i.test(token.href) ? `<a href="${escapeHtml(token.href)}" target="_blank" rel="noreferrer noopener">${render(token.children)}</a>` : render(token.children);
          case "cite": {
            const n = Number(token.index);
            if (!Number.isFinite(n) || n < 1) return "";
            const src = sources[n - 1];
            if (src) {
              const tip = `${n}. ${src.title || sourceDomain(src)}${sourceDomain(src) ? ` (${sourceDomain(src)})` : ""}`;
              return `<a href="#ref-${n}" class="cite" title="${escapeHtml(tip)}">[${n}]</a>`;
            }
            return `<sup class="cite">[${n}]</sup>`;
          }
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

const NUMERIC_COL = /^[-+−]?\s*(?:R\$|US\$|\$|€)?\s*[\d.,]+\s*(?:%|°C?|km²?|kg|m|cm|mm|g|s|h|min|mi|bi|tri|mil)?$/i;

function isNumericColumn(rows, column) {
  const filled = rows.map((row) => String(row[column] ?? "").replace(/\*\*/g, "").trim()).filter((cell) => cell && cell !== "-" && cell !== "—");
  return filled.length > 0 && filled.every((cell) => NUMERIC_COL.test(cell));
}

/**
 * Blocos ricos dentro de `> [!TIPO] Título` nos arquivos da Mine:
 * - `[!DADOS]` / `[!NUMEROS]` / `[!INDICADORES]`: grade de cartões de indicadores
 * - `[!GRAFICO]` / `[!BARRAS]`: gráfico de barras horizontais em HTML/CSS puro
 * - `[!LINHA DO TEMPO]` / `[!CRONOLOGIA]`: linha do tempo editorial conectada
 * - Outros `[!DEBATE]`, `[!CONCLUSAO]`, `[!PARA APROFUNDAR]`: cartão de destaque
 */
function parseSpecialQuote(block) {
  if (block.type !== "quote" || !block.children?.length) return null;
  const first = block.children[0];
  if (first.type !== "paragraph") return null;
  const match = String(first.text || "").match(/^\s*\[!\s*([\p{L} -]{3,28})\s*\]\s*(.*)$/u);
  if (!match) return null;
  const rawTag = fold(match[1]).replace(/[-_\s]+/g, " ").trim();
  const title = match[2].trim();
  const rest = block.children.slice(1);
  const rawItems = [];
  for (const child of rest) {
    if (child.type === "list") {
      for (const item of child.items) rawItems.push(item.text);
    } else if (child.type === "paragraph" && child.text.trim()) {
      rawItems.push(child.text.replace(/^[-*•]\s+/, "").trim());
    }
  }
  if (/^(?:dados|numeros|indicadores|estatisticas|panorama)$/.test(rawTag) && rawItems.length) {
    const items = rawItems
      .map((line) => {
        if (line.includes("|")) {
          const [val, label, ...note] = line.split("|").map((part) => part.trim());
          return { value: val.replace(/^\*\*|\*\*$/g, "").trim(), label: label || "", note: note.join(" · ").trim() };
        }
        const pair = line.match(/^(?:\*\*(.+?)\*\*|([^:—–-]{1,24}))\s*[:—–-]\s*(.+)$/);
        if (pair) return { value: (pair[1] || pair[2] || "").trim(), label: pair[3].trim(), note: "" };
        return null;
      })
      .filter((item) => item && item.value && item.label);
    if (items.length) return { kind: "kpi", title, items };
  }
  if (/^(?:grafico|barras|comparativo)$/.test(rawTag) && rawItems.length) {
    const rows = rawItems
      .map((line) => {
        const parts = line.split("|").map((part) => part.trim());
        if (parts.length < 2) return null;
        const rawNum = parts[1].replace(/[*%R$US€\s]/gi, "");
        const parsed = cellValue(rawNum);
        const num = parsed.kind === "number" ? (parsed.percent ? parsed.value * 100 : parsed.value) : Number(rawNum.replace(/\./g, "").replace(",", "."));
        if (!Number.isFinite(num) || num < 0) return null;
        return { label: parts[0].replace(/^\*\*|\*\*$/g, "").trim(), display: parts[1].replace(/^\*\*|\*\*$/g, "").trim(), num, note: parts.slice(2).join(" · ").trim() };
      })
      .filter(Boolean);
    if (rows.length >= 2) return { kind: "chart", title, rows };
  }
  if (/^(?:linha do tempo|cronologia|historico|marcos)$/.test(rawTag) && rawItems.length) {
    const events = rawItems
      .map((line) => {
        if (line.includes("|")) {
          const [when, head, ...detail] = line.split("|").map((part) => part.trim());
          const bodyText = detail.length ? detail.join(" ").trim() : "";
          return {
            when: when.replace(/^\*\*|\*\*$/g, "").trim(),
            head: bodyText ? head.replace(/^\*\*|\*\*$/g, "").trim() : "",
            text: bodyText || head,
          };
        }
        const full = line.match(/^\*\*(.+?)\*\*\s*(?:[—–-]\s*\*\*(.+?)\*\*\s*[:—–-]?\s*|[—–:-]\s*)(.+)$/);
        if (full) return { when: full[1].trim(), head: (full[2] || "").trim(), text: full[3].trim() };
        return null;
      })
      .filter((event) => event && event.when && (event.text || event.head));
    if (events.length) return { kind: "timeline", title, events };
  }
  const CALLOUT_MAP = {
    debate: ["debate", "Visões e debates"],
    controversia: ["debate", "Controvérsia"],
    visoes: ["debate", "Diferentes visões"],
    conclusao: ["summary", "Conclusão"],
    "para aprofundar": ["note", "Para aprofundar"],
    metodologia: ["note", "Metodologia"],
    contexto: ["definition", "Contexto"],
  };
  const mapped = CALLOUT_MAP[rawTag] || ["note", match[1].trim()];
  return { kind: "callout", tone: mapped[0], label: mapped[1], title, children: rest };
}

function blocksHtml(blocks, ctx = {}) {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading": {
          const level = Math.min(4, Math.max(2, block.level + (block.level === 1 ? 1 : 0)));
          if (level === 2 && ctx.isResearch) {
            ctx.secCounter = (ctx.secCounter || 0) + 1;
            const num = String(ctx.secCounter).padStart(2, "0");
            const clean = cleanHeadingTitle(block.text) || block.text;
            return `<h2 id="sec-${ctx.secCounter}" class="sec-h2"><span class="sec-num">${num}</span><span>${inlineHtml(clean, ctx)}</span></h2>`;
          }
          return `<h${level}>${inlineHtml(block.text, ctx)}</h${level}>`;
        }
        case "paragraph":
          return `<p>${inlineHtml(block.text, ctx)}</p>`;
        case "chips":
          return `<p class="chips">${block.items.map((item) => `<span class="chip">${inlineHtml(item, ctx)}</span>`).join("")}</p>`;
        case "rule":
          return "<hr>";
        case "code":
          return `<pre><code>${escapeHtml(block.code)}</code></pre>`;
        case "math":
          return `<p class="math-block">${escapeHtml(block.tex)}</p>`;
        case "table": {
          const numeric = block.header.map((_, column) => isNumericColumn(block.rows, column));
          return `<div class="table-wrap"><table><thead><tr>${block.header
            .map((cell, column) => `<th${numeric[column] ? ' class="num"' : ""}>${inlineHtml(cell, ctx)}</th>`)
            .join("")}</tr></thead><tbody>${block.rows
            .map((row) => `<tr>${row.map((cell, column) => `<td${numeric[column] ? ' class="num"' : ""}>${inlineHtml(cell, ctx)}</td>`).join("")}</tr>`)
            .join("")}</tbody></table></div>`;
        }
        case "callout":
          return `<aside class="callout callout-${block.kind}"><p class="callout-title">${escapeHtml(CALLOUT_TITLES[block.kind] || "Nota")}${block.title ? ` · ${inlineHtml(block.title, ctx)}` : ""}</p>${blocksHtml(block.children, ctx)}</aside>`;
        case "quote": {
          const special = parseSpecialQuote(block);
          if (special?.kind === "kpi") {
            return `<section class="kpi-section">${special.title ? `<p class="eyebrow-label">${inlineHtml(special.title, ctx)}</p>` : ""}<div class="kpi-grid">${special.items
              .slice(0, 6)
              .map(
                (item) =>
                  `<div class="kpi-card"><strong class="kpi-val">${escapeHtml(item.value)}</strong><span class="kpi-label">${inlineHtml(item.label, ctx)}</span>${
                    item.note ? `<small class="kpi-note">${inlineHtml(item.note, ctx)}</small>` : ""
                  }</div>`,
              )
              .join("")}</div></section>`;
          }
          if (special?.kind === "chart") {
            const max = Math.max(...special.rows.map((r) => r.num), 1);
            return `<figure class="chart-box">${special.title ? `<figcaption class="chart-title">${inlineHtml(special.title, ctx)}</figcaption>` : ""}<div class="chart-rows">${special.rows
              .slice(0, 8)
              .map((row) => {
                const pct = Math.max(4, Math.min(100, Math.round((row.num / max) * 1000) / 10));
                return `<div class="chart-row"><div class="chart-head"><span class="chart-label">${inlineHtml(row.label, ctx)}</span><strong class="chart-val">${escapeHtml(row.display)}</strong></div><div class="chart-track"><span class="chart-fill" style="width:${pct}%"></span></div>${
                  row.note ? `<p class="chart-note">${inlineHtml(row.note, ctx)}</p>` : ""
                }</div>`;
              })
              .join("")}</div></figure>`;
          }
          if (special?.kind === "timeline") {
            return `<section class="timeline-section">${special.title ? `<p class="eyebrow-label">${inlineHtml(special.title, ctx)}</p>` : ""}<ol class="timeline">${special.events
              .slice(0, 12)
              .map(
                (ev) =>
                  `<li class="tl-item"><span class="tl-when">${escapeHtml(ev.when)}</span><div class="tl-body">${ev.head ? `<strong class="tl-head">${inlineHtml(ev.head, ctx)}</strong>` : ""}<p>${inlineHtml(ev.text, ctx)}</p></div></li>`,
              )
              .join("")}</ol></section>`;
          }
          if (special?.kind === "callout") {
            return `<aside class="callout callout-${special.tone}"><p class="callout-title">${escapeHtml(special.label)}${special.title ? ` · ${inlineHtml(special.title, ctx)}` : ""}</p>${blocksHtml(special.children, ctx)}</aside>`;
          }
          return `<blockquote>${blocksHtml(block.children, ctx)}</blockquote>`;
        }
        case "list":
          return listHtml(block, ctx);
        default:
          return "";
      }
    })
    .join("\n");
}

function listHtml(list, ctx = {}) {
  const tag = list.ordered ? "ol" : "ul";
  const start = list.ordered && list.start !== 1 ? ` start="${list.start}"` : "";
  const checklist = !list.ordered && list.items.every((item) => checkbox(item.text));
  return `<${tag}${start}${checklist ? ' class="checklist"' : ""}>${list.items
    .map((item) => {
      const box = checklist ? checkbox(item.text) : null;
      const body = box ? `<span class="box">${box.done ? "✓" : ""}</span>${inlineHtml(box.text, ctx)}` : inlineHtml(item.text, ctx);
      return `<li>${body}${(item.children || []).map((child) => listHtml(child, ctx)).join("")}</li>`;
    })
    .join("")}</${tag}>`;
}

const PAGE_CSS = `
@page { size: A4; margin: 15mm 15mm 17mm; }
:root {
  --ink: #0f2119;
  --text: #1d2622;
  --muted: #58665f;
  --accent: #147a4d;
  --accent-bright: #2fd483;
  --accent-soft: #e7f6ee;
  --line: #d4e0d9;
  --surface: #f6faf8;
}
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; scroll-behavior: smooth; }
body { margin: 0; background: #e8edea; color: var(--text); font: 10.5pt/1.62 "Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; }
.page { max-width: 210mm; margin: 0 auto; padding: 17mm 18mm 20mm; background: #fff; min-height: 100vh; box-shadow: 0 12px 42px rgba(15, 33, 25, .08); }
.top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 10px; border-bottom: 3px solid var(--accent-bright); margin-bottom: 18px; }
.brand { font-size: 8.5pt; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); }
.date { font-size: 8.5pt; color: var(--muted); font-variant-numeric: tabular-nums; }

/* Cabeçalho editorial do Dossiê de Pesquisa */
.dossier-cover { position: relative; padding: 14px 16px 16px; margin-bottom: 18px; border-radius: 10px; border: 1px solid var(--line); border-top: 4px solid var(--ink); background: linear-gradient(180deg, #f7fbf9 0%, #ffffff 100%); break-inside: avoid; }
.dossier-cover::after { content: ""; position: absolute; top: -4px; left: 0; width: 92px; height: 4px; background: var(--accent-bright); border-top-left-radius: 10px; }
.dossier-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.dossier-badges { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.dossier-kicker { display: inline-block; padding: 2px 8px; border-radius: 999px; background: var(--ink); color: #fff; font-size: 7.5pt; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
.dossier-subject { display: inline-block; padding: 2px 9px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); border: 1px solid #bfe4cf; font-size: 7.8pt; font-weight: 700; }
.dossier-cover h1 { font-family: Georgia, "Iowan Old Style", "Palatino Linotype", "Times New Roman", serif; font-size: 23pt; line-height: 1.13; margin: 0 0 6px; letter-spacing: -.015em; color: var(--ink); }
.dossier-sub { margin: 0 0 10px; font-size: 11pt; line-height: 1.45; color: #3d4d45; }
.dossier-stats { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 10px; border-top: 1px dashed var(--line); }
.stat-pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 6px; background: #f2f6f4; border: 1px solid #dfe8e3; font-size: 8pt; font-weight: 600; color: #394840; font-variant-numeric: tabular-nums; }

.exec-summary { margin: 0 0 16px; padding: 12px 15px 10px; border-radius: 9px; border: 1px solid #c6e6d5; border-left: 4px solid var(--accent); background: #f3fbf6; break-inside: avoid; }
.exec-label, .eyebrow-label, .toc-title { margin: 0 0 5px; font-size: 8pt; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); }
.exec-summary p:last-child { margin-bottom: 0; }

.toc { margin: 0 0 20px; padding: 11px 14px 12px; border-radius: 9px; border: 1px solid var(--line); background: var(--surface); break-inside: avoid; }
.toc-list { list-style: none; margin: 4px 0 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px 18px; }
.toc-list li { margin: 0; min-width: 0; }
.toc-list a { display: flex; align-items: baseline; gap: 7px; text-decoration: none; color: var(--ink); font-size: 9.2pt; line-height: 1.35; padding: 2px 0; border-bottom: 1px dotted #d6e1db; }
.toc-list a:hover { color: var(--accent); }
.toc-num { font-family: Consolas, "DM Mono", monospace; font-size: 8pt; font-weight: 700; color: var(--accent); flex-shrink: 0; }
.toc-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

h1 { font-size: 21pt; line-height: 1.15; margin: 0 0 14px; letter-spacing: -.01em; color: var(--ink); }
h2 { font-size: 13.5pt; margin: 22px 0 8px; padding-bottom: 5px; border-bottom: 1.5px solid #d5e9de; color: #124d36; break-after: avoid; page-break-after: avoid; }
h2.sec-h2 { display: flex; align-items: baseline; gap: 9px; font-size: 14pt; margin: 24px 0 10px; padding-bottom: 6px; border-bottom: 1.5px solid var(--ink); color: var(--ink); }
.sec-num { display: inline-block; padding: 1px 6px; border-radius: 4px; background: var(--accent-soft); color: var(--accent); font: 800 8.5pt/1.3 Consolas, "DM Mono", monospace; letter-spacing: .04em; flex-shrink: 0; }
h3 { font-size: 11.5pt; margin: 15px 0 6px; color: #1c3d2f; break-after: avoid; page-break-after: avoid; }
h4 { font-size: 10.5pt; margin: 12px 0 4px; break-after: avoid; }
p { margin: 0 0 9px; }
ul, ol { margin: 0 0 10px; padding-left: 22px; }
li { margin: 3.5px 0; }
ul.checklist { list-style: none; padding-left: 4px; }
ul.checklist .box { display: inline-block; width: 12px; height: 12px; margin-right: 8px; border: 1.5px solid #3b8f68; border-radius: 3px; font-size: 9px; line-height: 10px; text-align: center; vertical-align: -1px; }

.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 12px; }
.chip { display: inline-block; padding: 2px 9px; border-radius: 999px; background: #eef5f1; border: 1px solid #d3e2da; font-size: 8pt; font-weight: 700; color: #2b4a3c; }
.cite { display: inline-block; margin-left: 1px; padding: 0 4px; border-radius: 4px; background: #e8f3fe; color: #18559b; font: 700 7.5pt/1.35 Consolas, "DM Mono", monospace; text-decoration: none; vertical-align: super; }
.cite:hover { background: #d0e7fd; }

/* Grade de indicadores (KPIs) */
.kpi-section { margin: 12px 0 16px; break-inside: avoid; }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 9px; }
.kpi-card { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--line); border-top: 3px solid var(--accent); background: #fbfdfc; break-inside: avoid; }
.kpi-val { font-family: Georgia, "Times New Roman", serif; font-size: 16.5pt; line-height: 1.1; color: var(--ink); font-variant-numeric: tabular-nums; }
.kpi-label { font-size: 9pt; font-weight: 700; line-height: 1.3; color: #24332c; }
.kpi-note { font-size: 7.8pt; line-height: 1.3; color: var(--muted); }

/* Gráfico de barras horizontais em HTML/CSS puro */
.chart-box { margin: 12px 0 16px; padding: 12px 14px; border-radius: 9px; border: 1px solid var(--line); background: #fbfdfc; break-inside: avoid; }
.chart-title { font-size: 9pt; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--ink); margin-bottom: 9px; }
.chart-rows { display: flex; flex-direction: column; gap: 8px; }
.chart-row { break-inside: avoid; }
.chart-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; font-size: 9.3pt; margin-bottom: 3px; }
.chart-label { font-weight: 600; color: var(--text); }
.chart-val { font-variant-numeric: tabular-nums; color: var(--ink); font-size: 9.3pt; }
.chart-track { height: 8px; width: 100%; border-radius: 999px; background: #e6efea; overflow: hidden; }
.chart-fill { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #147a4d, #2fd483); }
.chart-note { margin: 2px 0 0; font-size: 7.8pt; color: var(--muted); }

/* Linha do tempo conectada */
.timeline-section { margin: 12px 0 16px; }
.timeline { list-style: none; margin: 6px 0 0; padding: 0 0 0 14px; border-left: 2px solid #b5d9c6; }
.tl-item { position: relative; margin: 0 0 10px; padding: 0 0 2px 12px; break-inside: avoid; }
.tl-item:last-child { margin-bottom: 0; }
.tl-item::before { content: ""; position: absolute; left: -19px; top: 4px; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); border: 2px solid #fff; box-shadow: 0 0 0 1.5px var(--accent); }
.tl-when { display: inline-block; margin-bottom: 2px; padding: 1px 7px; border-radius: 4px; background: var(--accent-soft); color: var(--accent); font: 800 8pt/1.35 Consolas, "DM Mono", monospace; }
.tl-head { display: block; font-size: 9.8pt; color: var(--ink); margin-bottom: 1px; }
.tl-body p { margin: 0; font-size: 9.5pt; line-height: 1.48; color: #2d3b34; }

mark { background: #fff2a8; padding: 0 3px; border-radius: 2px; }
code, pre, .math, .math-block { font-family: "Cascadia Mono", Consolas, "DM Mono", monospace; font-size: 9.2pt; }
code { background: #f1f4f2; padding: 1px 4px; border-radius: 3px; }
pre { background: #f6f8f7; border: 1px solid #e1e7e3; border-radius: 6px; padding: 10px 12px; white-space: pre-wrap; break-inside: avoid; }
pre code { background: none; padding: 0; }
.math-block { text-align: center; background: #f7faf8; border-radius: 6px; padding: 8px; break-inside: avoid; }
.table-wrap { margin: 8px 0 14px; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 9.5pt; break-inside: auto; }
thead { display: table-header-group; }
th, td { border: 1px solid #cfdad3; padding: 6px 8px; text-align: left; vertical-align: top; }
thead th { background: #e3f5eb; color: #124d36; font-weight: 700; }
tbody tr:nth-child(even) td { background: #f8fbf9; }
tr { break-inside: avoid; page-break-inside: avoid; }
th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
blockquote { margin: 0 0 10px; padding: 5px 0 5px 13px; border-left: 3px solid #b9cbc1; color: #425048; font-style: italic; }

.callout { margin: 10px 0 13px; padding: 10px 13px 5px; border-radius: 8px; border: 1px solid #d5ebe0; border-left: 4px solid #2fd483; background: #effaf4; break-inside: avoid; page-break-inside: avoid; }
.callout-title { font-size: 8.5pt; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; margin-bottom: 4px; color: #14513a; }
.callout-tip, .callout-example { border-color: #f3e2a9; border-left-color: #e0a100; background: #fff9e6; }
.callout-tip .callout-title, .callout-example .callout-title { color: #8a6000; }
.callout-warning, .callout-mistake { border-color: #f7cdc8; border-left-color: #e5533d; background: #fff1ef; }
.callout-warning .callout-title, .callout-mistake .callout-title { color: #a33324; }
.callout-important { border-color: #dcd6fc; border-left-color: #6d5ce8; background: #f4f2ff; }
.callout-important .callout-title { color: #4738ad; }
.callout-definition, .callout-note, .callout-summary { border-color: #cbe3f8; border-left-color: #2b86d6; background: #eef7fe; }
.callout-definition .callout-title, .callout-note .callout-title, .callout-summary .callout-title { color: #1b598f; }
.callout-debate { border-color: #f4d9be; border-left-color: #d97706; background: #fff8f1; }
.callout-debate .callout-title { color: #9a4d06; }

/* Referências verificadas */
.refs { margin-top: 26px; padding-top: 14px; border-top: 2px solid var(--ink); }
.refs h2 { margin-top: 0; }
.ref-list { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 7px; }
.ref-item { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px; padding: 7px 10px; border-radius: 7px; border: 1px solid #e2ebe6; background: #fafcfb; font-size: 8.8pt; line-height: 1.42; break-inside: avoid; }
.ref-num { font: 800 8pt/1.4 Consolas, "DM Mono", monospace; color: var(--accent); padding: 1px 5px; border-radius: 4px; background: var(--accent-soft); height: fit-content; }
.ref-meta { min-width: 0; }
.ref-title { font-weight: 700; color: var(--ink); }
.ref-domain { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 999px; background: #eef3f0; color: var(--muted); font: 600 7.5pt/1.4 Consolas, "DM Mono", monospace; }
.ref-url { display: block; margin-top: 1px; color: #1d6f50; font-size: 7.8pt; word-break: break-all; text-decoration: none; }
.ref-url:hover { text-decoration: underline; }
.ref-queries { margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--line); font-size: 7.8pt; color: var(--muted); }
.ref-queries strong { color: #394840; }

hr { border: 0; border-top: 1px dashed #cdd8d1; margin: 16px 0; }
a { color: #186647; }
.foot { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; margin-top: 26px; padding-top: 8px; border-top: 1px solid #e1e8e4; font-size: 8pt; color: #7b8780; }
@media print {
  body { background: #fff; }
  .page { padding: 0; max-width: none; min-height: 0; box-shadow: none; }
  a { text-decoration: none; }
}
@media (max-width: 640px) {
  .page { padding: 18px 15px; }
  .dossier-cover h1, h1 { font-size: 18pt; }
  .toc-list { grid-template-columns: 1fr; }
}
`;

/** Página HTML completa e diagramada: é o arquivo .html e a base do PDF. */
export function fileHtml(
  { titulo, corpo, tipo = "pdf", modelo = "", subtitulo = "", materia = "", resumo = "" },
  { date = new Date(), sources = [], queries = [] } = {},
) {
  const cleanSources = (Array.isArray(sources) ? sources : []).filter((item) => item && /^https?:\/\//i.test(String(item.url || "")));
  const cleanQueries = (Array.isArray(queries) ? queries : []).map((q) => String(q || "").replace(/^site:\S+\s*/, "").trim()).filter(Boolean);
  const blocks = parseBlocks(String(corpo || ""));
  // Um "# Título" igual ao título do arquivo seria repetido logo abaixo do h1.
  let body = blocks[0]?.type === "heading" && fold(cleanHeadingTitle(blocks[0].text)) === fold(cleanHeadingTitle(titulo)) ? blocks.slice(1) : blocks;
  const isResearch = modelo === "pesquisa";

  // Na pesquisa aprofundada, chips iniciais e resumo executivo sobem para a capa.
  let coverChips = [];
  if (isResearch && body[0]?.type === "chips") {
    coverChips = body[0].items;
    body = body.slice(1);
  }
  let execHtml = "";
  if (isResearch) {
    if (resumo) {
      execHtml = `<section class="exec-summary"><p class="exec-label">Síntese executiva</p><p>${inlineHtml(resumo, { sources: cleanSources })}</p></section>`;
    } else if (body[0]?.type === "callout" && body[0].kind === "summary") {
      execHtml = `<section class="exec-summary"><p class="exec-label">${escapeHtml(body[0].title || "Síntese executiva")}</p>${blocksHtml(body[0].children, { sources: cleanSources })}</section>`;
      body = body.slice(1);
    }
  }

  const sheets = tipo === "excel" ? sheetsFromMarkdown(corpo) : [];
  const ctx = { isResearch, secCounter: 0, sources: cleanSources };
  const h2Titles = isResearch
    ? body
        .filter((block) => block.type === "heading" && Math.min(4, Math.max(2, block.level + (block.level === 1 ? 1 : 0))) === 2)
        .map((block) => cleanHeadingTitle(block.text) || block.text)
    : [];

  const content = sheets.length
    ? sheets
        .map((sheet) => {
          const shown = displayRows(sheet);
          const numeric = sheet.rows[0].map((_, column) => sheet.rows.slice(1).some((row) => cellValue(row[column]).kind !== "text"));
          return `<h2>${escapeHtml(sheet.name)}</h2>${sheet.note ? `<p>${inlineHtml(sheet.note, ctx)}</p>` : ""}<div class="table-wrap"><table><thead><tr>${shown[0]
            .map((cell, column) => `<th${numeric[column] ? ' class="num"' : ""}>${escapeHtml(cell)}</th>`)
            .join("")}</tr></thead><tbody>${shown
            .slice(1)
            .map((row) => `<tr>${row.map((cell, column) => `<td${numeric[column] ? ' class="num"' : ""}>${escapeHtml(cell)}</td>`).join("")}</tr>`)
            .join("")}</tbody></table></div>`;
        })
        .join("\n")
    : blocksHtml(body, ctx);

  const hasCitedRefs = /\[\d{1,2}\]/.test(String(corpo || "")) || isResearch;
  const showRefs = !sheets.length && cleanSources.length > 0 && hasCitedRefs;
  const refsSecNum = isResearch ? String((ctx.secCounter || 0) + 1).padStart(2, "0") : "";
  const tocEntries = [
    ...h2Titles.map((text, idx) => ({ href: `#sec-${idx + 1}`, num: String(idx + 1).padStart(2, "0"), text })),
    ...(showRefs && isResearch ? [{ href: "#referencias", num: refsSecNum, text: "Referências e fontes consultadas" }] : []),
  ];
  const tocHtml =
    isResearch && tocEntries.length >= 3
      ? `<nav class="toc" aria-label="Sumário"><p class="toc-title">Sumário do relatório</p><ol class="toc-list">${tocEntries
          .map((item) => `<li><a href="${item.href}"><span class="toc-num">${item.num}</span><span class="toc-text">${escapeHtml(item.text)}</span></a></li>`)
          .join("")}</ol></nav>`
      : "";

  const refsHtml = showRefs
    ? `<section class="refs" id="referencias">${
        isResearch
          ? `<h2 class="sec-h2"><span class="sec-num">${refsSecNum}</span><span>Referências e fontes consultadas</span></h2>`
          : `<h2>Fontes consultadas</h2>`
      }<ol class="ref-list">${cleanSources
        .map((src, idx) => {
          const dom = sourceDomain(src);
          return `<li class="ref-item" id="ref-${idx + 1}"><span class="ref-num">[${idx + 1}]</span><div class="ref-meta"><span class="ref-title">${escapeHtml(src.title || dom || src.url)}</span>${
            dom ? `<span class="ref-domain">${escapeHtml(dom)}</span>` : ""
          }<a class="ref-url" href="${escapeHtml(src.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(src.url)}</a></div></li>`;
        })
        .join("")}</ol>${
        cleanQueries.length
          ? `<p class="ref-queries"><strong>Buscas realizadas:</strong> ${cleanQueries.map((q) => escapeHtml(q)).join(" · ")}</p>`
          : ""
      }</section>`
    : "";

  const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
  const wordsCount = String(corpo || "").trim().split(/\s+/).filter(Boolean).length;
  const readingMin = Math.max(1, Math.round(wordsCount / 210));
  const stats = isResearch
    ? [
        h2Titles.length ? `${h2Titles.length} ${h2Titles.length === 1 ? "seção" : "seções"}` : "",
        cleanSources.length ? `${cleanSources.length} ${cleanSources.length === 1 ? "fonte verificada" : "fontes verificadas"}` : "",
        `~${readingMin} min de leitura`,
        ...coverChips.slice(0, 3),
      ].filter(Boolean)
    : [];

  const headerHtml = isResearch
    ? `<header class="dossier-cover"><div class="dossier-bar"><div class="dossier-badges"><span class="dossier-kicker">Minerva · Pesquisa aprofundada</span>${
        materia ? `<span class="dossier-subject">${escapeHtml(materia)}</span>` : ""
      }</div><span class="date">${escapeHtml(dia)}</span></div><h1>${escapeHtml(titulo)}</h1>${
        subtitulo ? `<p class="dossier-sub">${escapeHtml(subtitulo)}</p>` : ""
      }${stats.length ? `<div class="dossier-stats">${stats.map((item) => `<span class="stat-pill">${escapeHtml(item)}</span>`).join("")}</div>` : ""}</header>${execHtml}${tocHtml}`
    : `<div class="top"><span class="brand">Minerva · feito com a Mine</span><span class="date">${escapeHtml(dia)}</span></div>\n<h1>${escapeHtml(titulo)}</h1>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(titulo)}</title>
<style>${PAGE_CSS}</style>
</head>
<body>
<main class="page${isResearch ? " is-research" : ""}">
${headerHtml}
${content}
${refsHtml}
<p class="foot"><span>${isResearch ? "Dossiê gerado pela Mine · Plataforma Minerva" : "Criado pela Mine, a tutora do Minerva."}</span><span>Confira os dados nas fontes citadas e no seu material de aula.</span></p>
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
        if (token.type === "cite") return run(`[${token.index}]`, { ...style, bold: true, color: "18559B" });
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
  debate: ["D97706", "FFF8F1"],
  fun: ["2FD483", "EFFAF4"],
};

function docxBlocks(blocks, context = {}) {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return para(runsXml(cleanHeadingTitle(block.text) || block.text), { style: block.level <= 2 ? "Heading1" : block.level === 3 ? "Heading2" : "Heading3", keepNext: true });
        case "paragraph":
          return para(runsXml(block.text), { shade: context.shade, border: context.border });
        case "chips":
          return para(runsXml(block.items.join("  ·  "), { bold: true, color: "2B4A3C" }), { spacingAfter: 120 });
        case "rule":
          return para("", { style: "Divisor" });
        case "code":
          return block.code.split("\n").map((line) => para(run(line || " ", { mono: true }), { shade: "F6F8F7", spacingAfter: 0 })).join("");
        case "math":
          return para(run(block.tex, { mono: true }), { shade: "F7FAF8" });
        case "list":
          return docxList(block, 0, context);
        case "quote": {
          const special = parseSpecialQuote(block);
          if (special?.kind === "kpi") {
            return docxTable({
              header: ["Indicador", "Descrição", "Detalhe / Fonte"],
              rows: special.items.map((item) => [`**${item.value}**`, item.label, item.note || "—"]),
            });
          }
          if (special?.kind === "chart") {
            return docxTable({
              header: [special.title || "Item", "Valor", "Observação"],
              rows: special.rows.map((row) => [row.label, `**${row.display}**`, row.note || "—"]),
            });
          }
          if (special?.kind === "timeline") {
            return (
              (special.title ? para(run(special.title.toUpperCase(), { bold: true, color: "14513A" }), { spacingAfter: 60 }) : "") +
              special.events.map((ev) => para(`${run(`${ev.when} — `, { bold: true, color: "14513A" })}${ev.head ? run(`${ev.head}: `, { bold: true }) : ""}${runsXml(ev.text)}`, { border: "2FD483", shade: "F7FBF9", spacingAfter: 80 })).join("")
            );
          }
          if (special?.kind === "callout") {
            const [border, shade] = CALLOUT_COLORS[special.tone] || CALLOUT_COLORS.note;
            const head = para(run(`${special.label}${special.title ? ` · ${special.title.replace(/[*=`]/g, "")}` : ""}`.toUpperCase(), { bold: true, color: border }), { shade, border, spacingAfter: 40 });
            return head + docxBlocks(special.children, { shade, border });
          }
          return docxBlocks(block.children, { ...context, border: "C9D6CE" });
        }
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
export function docxFiles({ titulo, corpo, subtitulo = "", materia = "", resumo = "" }, { date = new Date(), sources = [] } = {}) {
  const cleanSources = (Array.isArray(sources) ? sources : []).filter((item) => item && /^https?:\/\//i.test(String(item.url || "")));
  const blocks = parseBlocks(String(corpo || ""));
  const body = blocks[0]?.type === "heading" && fold(cleanHeadingTitle(blocks[0].text)) === fold(cleanHeadingTitle(titulo)) ? blocks.slice(1) : blocks;
  const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
  const subtitleText = ["Minerva · feito com a Mine", materia, dia].filter(Boolean).join(" · ");
  const subPara = subtitulo ? para(run(subtitulo, { italic: true, color: "3D4D45" }), { spacingAfter: 180 }) : "";
  const execPara = resumo
    ? para(run("SÍNTESE EXECUTIVA", { bold: true, color: "14513A" }), { border: "2FD483", shade: "EFFAF4", spacingAfter: 40 }) +
      para(runsXml(resumo), { border: "2FD483", shade: "EFFAF4", spacingAfter: 180 })
    : "";
  const refsXml =
    cleanSources.length && /\[\d{1,2}\]/.test(String(corpo || ""))
      ? para(run("Referências e fontes consultadas"), { style: "Heading1", keepNext: true }) +
        cleanSources
          .map((src, idx) =>
            para(
              `${run(`[${idx + 1}] `, { bold: true, color: "14513A" })}${run(src.title || sourceDomain(src) || src.url, { bold: true })}${
                sourceDomain(src) ? run(` (${sourceDomain(src)})`, { color: "58665F" }) : ""
              }${run(` — ${src.url}`, { link: true })}`,
              { spacingAfter: 80 },
            ),
          )
          .join("")
      : "";
  const document = `${XML_HEAD}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${para(run(subtitleText), { style: "Subtitle" })}${para(run(titulo), { style: "Title" })}${subPara}${execPara}${docxBlocks(body)}${refsXml}${para(run("Criado pela Mine, a tutora do Minerva. Confira as informações com o seu material de aula."), { style: "Rodape" })}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
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
