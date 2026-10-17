/**
 * Leitor de markdown das respostas da Mine.
 *
 * Mora em shared (JS puro, sem React) para ser testado com `node --test`: a
 * tela so decide COMO desenhar cada bloco; O QUE e cada pedaco de texto e
 * decidido aqui. E um leitor proprio, e nao uma biblioteca de markdown, por
 * tres motivos:
 *
 * 1. Streaming. O texto chega token a token. Uma cerca de codigo aberta, uma
 *    formula `$$` sem fechamento ou uma tabela sem a linha separadora precisam
 *    virar algo apresentavel a cada quadro, e nao piscar como texto cru.
 * 2. Dialeto da Mine. "Dica:" no comeco da linha vira um cartao de dica,
 *    `> [!ATENCAO]` vira um alerta, `==termo==` vira marca-texto. Nada disso e
 *    markdown padrao.
 * 3. Seguranca. Nenhum HTML do modelo chega ao DOM: o resultado e uma arvore
 *    de objetos, e a tela monta elementos React a partir dela.
 */

// ---------------------------------------------------------------------------
// Cartoes de destaque (callouts)

/** Tipos de cartao e as palavras que os abrem, sem acento e em minusculas. */
const CALLOUT_ALIASES = {
  tip: ["dica", "dicas", "macete"],
  warning: ["atencao", "cuidado", "aviso", "alerta"],
  important: ["importante", "essencial", "fundamental"],
  example: ["exemplo", "exemplos", "exemplo pratico", "na pratica"],
  definition: ["definicao", "conceito", "significado"],
  summary: ["resumo", "em resumo", "resumindo", "sintese"],
  fun: ["curiosidade", "voce sabia", "sabia que"],
  mistake: ["erro comum", "pegadinha", "armadilha", "erros comuns"],
  note: ["nota", "observacao", "lembre", "lembrete", "lembre-se"],
};

/** Titulo mostrado quando o modelo nao escreve um. */
export const CALLOUT_TITLES = {
  tip: "Dica",
  warning: "Atenção",
  important: "Importante",
  example: "Exemplo",
  definition: "Definição",
  summary: "Resumo",
  fun: "Curiosidade",
  mistake: "Erro comum",
  note: "Nota",
};

function fold(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[*_!?]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function calloutKind(label) {
  const key = fold(label);
  for (const [kind, aliases] of Object.entries(CALLOUT_ALIASES)) {
    if (aliases.includes(key)) return kind;
  }
  return null;
}

// "Dica: texto" e "**Dica:** texto" no inicio da linha. O resto vem cru
// (com os asteriscos) e `balanceBold` acerta o negrito depois.
const LABELED_CALLOUT = /^\s*(?:\*\*|__)?\s*([\p{L} -]{3,20}?)\s*(?:\*\*|__)?\s*[:：]\s*(.*)$/u;
// `[!DICA] Titulo opcional` na primeira linha de um bloco `>`.
const BRACKET_CALLOUT = /^\s*\[!\s*([\p{L} -]{3,20})\s*\]\s*(.*)$/u;

/**
 * O modelo mistura negrito e rotulo de varios jeitos: "**Dica:** texto",
 * "**Dica**: texto", "Dica: **termo** texto" e "**Resumo: frase inteira**".
 * Tirar o rotulo pode deixar um `**` sem par no resto; aqui ele e devolvido
 * ou retirado para o negrito continuar fechado.
 */
function balanceBold(rest) {
  const value = String(rest || "").trim();
  const count = (value.match(/\*\*/g) || []).length;
  if (count % 2 === 0) return value;
  if (value.startsWith("**")) return value.slice(2).trim();
  return `**${value}`;
}

function calloutFromLine(line) {
  const bracket = line.match(BRACKET_CALLOUT);
  if (bracket) {
    const kind = calloutKind(bracket[1]);
    if (kind) return { kind, title: bracket[2].trim(), rest: "" , bracket: true };
  }
  const labeled = line.match(LABELED_CALLOUT);
  if (labeled) {
    const kind = calloutKind(labeled[1]);
    if (kind) return { kind, title: "", rest: balanceBold(labeled[2]), bracket: false };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Blocos

const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([\w#+.-]*)\s*$/;
const HEADING = /^\s{0,3}(#{1,4})\s+(.+?)\s*#*\s*$/;
const RULE = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const LIST_ITEM = /^(\s*)([-*+•]|\d{1,3}[.)])\s+(.*)$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function isTableRow(line) {
  const trimmed = line.trim();
  // Uma barra solta ("a | b") tambem conta: o modelo nem sempre fecha as bordas.
  return trimmed.includes("|") && !/^\|?\s*$/.test(trimmed);
}

function splitRow(line) {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|") && !trimmed.endsWith("\\|")) trimmed = trimmed.slice(0, -1);
  const cells = [];
  let current = "";
  let inCode = false;
  let inMath = false;
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char === "\\" && trimmed[index + 1] === "|") {
      current += "|";
      index += 1;
      continue;
    }
    if (char === "`") inCode = !inCode;
    if (char === "$") inMath = !inMath;
    // Barra dentro de codigo ou formula (|x|, a || b) nao separa coluna.
    if (char === "|" && !inCode && !inMath) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function alignmentOf(cell) {
  const value = cell.trim();
  const left = value.startsWith(":");
  const right = value.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  return "left";
}

function startsBlock(line, next) {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    RULE.test(line) ||
    QUOTE.test(line) ||
    LIST_ITEM.test(line) ||
    isMathOpen(line) ||
    (isTableRow(line) && next !== undefined && TABLE_SEPARATOR.test(next))
  );
}

function isMathOpen(line) {
  const trimmed = line.trim();
  return trimmed.startsWith("$$") || trimmed === "\\[" || trimmed.startsWith("\\[");
}

/** Le uma formula em bloco: `$$...$$` numa linha ou em varias, ou `\[ ... \]`. */
function readMath(lines, start) {
  const first = lines[start].trim();
  const bracket = first.startsWith("\\[");
  const open = bracket ? "\\[" : "$$";
  const close = bracket ? "\\]" : "$$";
  const afterOpen = first.slice(open.length);
  const sameLineClose = afterOpen.indexOf(close);
  if (sameLineClose >= 0) {
    return { block: { type: "math", tex: afterOpen.slice(0, sameLineClose).trim(), open: false }, next: start + 1 };
  }
  const body = afterOpen ? [afterOpen] : [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const at = line.indexOf(close);
    if (at >= 0) {
      body.push(line.slice(0, at));
      return { block: { type: "math", tex: body.join("\n").trim(), open: false }, next: index + 1 };
    }
    body.push(line);
  }
  return { block: { type: "math", tex: body.join("\n").trim(), open: true }, next: lines.length };
}

function readFence(lines, start) {
  const [, marker, lang] = lines[start].match(FENCE);
  const body = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().startsWith(marker[0].repeat(marker.length)) && line.trim().replace(/[`~]/g, "") === "") {
      return { block: { type: "code", lang: lang.toLowerCase(), code: body.join("\n"), open: false }, next: index + 1 };
    }
    body.push(line);
  }
  // Cerca ainda aberta: durante o streaming o codigo aparece enquanto chega.
  return { block: { type: "code", lang: lang.toLowerCase(), code: body.join("\n"), open: true }, next: lines.length };
}

function readTable(lines, start) {
  const header = splitRow(lines[start]);
  const align = splitRow(lines[start + 1]).map(alignmentOf);
  const rows = [];
  let index = start + 2;
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || !isTableRow(line)) break;
    rows.push(splitRow(line));
  }
  const width = Math.max(header.length, ...rows.map((row) => row.length));
  const pad = (row) => Array.from({ length: width }, (_, column) => row[column] ?? "");
  return {
    block: {
      type: "table",
      header: pad(header),
      align: Array.from({ length: width }, (_, column) => align[column] || "left"),
      rows: rows.map(pad),
    },
    next: index,
  };
}

function readQuote(lines, start, streaming) {
  const inner = [];
  let index = start;
  for (; index < lines.length; index += 1) {
    const match = lines[index].match(QUOTE);
    if (!match) break;
    inner.push(match[1]);
  }
  const head = inner.length ? calloutFromLine(inner[0]) : null;
  if (head) {
    const rest = head.bracket ? inner.slice(1) : [head.rest, ...inner.slice(1)];
    return {
      block: { type: "callout", kind: head.kind, title: head.title, children: parseBlocks(rest.join("\n"), { streaming }) },
      next: index,
    };
  }
  return { block: { type: "quote", children: parseBlocks(inner.join("\n"), { streaming }) }, next: index };
}

/**
 * Lista com aninhamento pela indentacao. Linhas continuadas (indentadas, sem
 * marcador) juntam-se ao item anterior. Uma linha em branco so encerra a
 * lista se a proxima linha nao for outro item.
 */
function readList(lines, start) {
  const items = [];
  let index = start;
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      const next = lines[index + 1];
      if (next !== undefined && LIST_ITEM.test(next)) continue;
      break;
    }
    const match = line.match(LIST_ITEM);
    if (match) {
      const indent = match[1].replace(/\t/g, "    ").length;
      const marker = match[2];
      items.push({ indent, ordered: /\d/.test(marker), number: /\d/.test(marker) ? Number.parseInt(marker, 10) : 0, text: match[3] });
      continue;
    }
    if (/^\s{2,}\S/.test(line) && items.length) {
      items[items.length - 1].text += ` ${line.trim()}`;
      continue;
    }
    break;
  }
  return { block: nestList(items), next: index };
}

function nestList(flat) {
  const baseIndent = Math.min(...flat.map((item) => item.indent));
  const root = { type: "list", ordered: flat[0]?.ordered || false, start: flat[0]?.number || 1, items: [] };
  // Pilha de (indentacao, lista): um item mais indentado que o anterior abre
  // uma sub-lista dentro dele.
  const stack = [{ indent: baseIndent, list: root }];
  for (const item of flat) {
    while (stack.length > 1 && item.indent < stack[stack.length - 1].indent) stack.pop();
    let top = stack[stack.length - 1];
    if (item.indent > top.indent) {
      const parentItems = top.list.items;
      const parent = parentItems[parentItems.length - 1];
      if (parent) {
        const child = { type: "list", ordered: item.ordered, start: item.number || 1, items: [] };
        parent.children = parent.children || [];
        parent.children.push(child);
        stack.push({ indent: item.indent, list: child });
        top = stack[stack.length - 1];
      }
    }
    top.list.items.push({ text: item.text, children: undefined });
  }
  return root;
}

/**
 * Transforma o texto em blocos.
 *
 * Tipos: heading, paragraph, callout, list, table, code, math, quote, rule.
 * Cada linha solta vira um paragrafo proprio: e assim que a Mine escreve
 * ("Enunciado: ...", "Resposta: ...") e juntar linhas colaria rotulos no meio
 * de frases.
 */
export function parseBlocks(text, { streaming = false } = {}) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const next = lines[index + 1];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (FENCE.test(line)) {
      const result = readFence(lines, index);
      blocks.push(result.block);
      index = result.next;
      continue;
    }

    if (isMathOpen(line)) {
      const result = readMath(lines, index);
      blocks.push(result.block);
      index = result.next;
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      blocks.push({ type: "heading", level: Math.min(heading[1].length, 3), text: heading[2].replace(/\*\*/g, "") });
      index += 1;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ type: "rule" });
      index += 1;
      continue;
    }

    if (isTableRow(line) && next !== undefined && TABLE_SEPARATOR.test(next)) {
      const result = readTable(lines, index);
      blocks.push(result.block);
      index = result.next;
      continue;
    }

    if (QUOTE.test(line)) {
      const result = readQuote(lines, index, streaming);
      blocks.push(result.block);
      index = result.next;
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const result = readList(lines, index);
      blocks.push(result.block);
      index = result.next;
      continue;
    }

    // "Dica: ..." numa linha comum vira um cartao compacto, com as linhas
    // seguintes que nao abrem outro bloco. E o habito mais comum do modelo, e
    // deixa a resposta bonita mesmo quando ele nao usa a sintaxe `> [!DICA]`.
    const callout = calloutFromLine(line);
    if (callout && !callout.bracket && callout.rest) {
      const body = [callout.rest];
      let cursor = index + 1;
      while (cursor < lines.length && lines[cursor].trim() && !startsBlock(lines[cursor], lines[cursor + 1]) && !calloutFromLine(lines[cursor])) {
        body.push(lines[cursor]);
        cursor += 1;
      }
      blocks.push({ type: "callout", kind: callout.kind, title: "", children: body.map((text) => ({ type: "paragraph", text: text.trim() })) });
      index = cursor;
      continue;
    }

    // Formula sozinha na linha, mesmo escrita com um cifrao so ($...$ ou
    // \(...\)): e uma formula em destaque, nao uma frase.
    const loneMath = line.trim().match(/^(?:\$(?!\$)([^$]+)\$|\\\((.+)\\\))[.,;:]?$/);
    if (loneMath && /[\\^_=]|\d/.test(loneMath[1] ?? loneMath[2])) {
      blocks.push({ type: "math", tex: (loneMath[1] ?? loneMath[2]).trim(), open: false });
      index += 1;
      continue;
    }

    blocks.push({ type: "paragraph", text: line.trim() });
    index += 1;
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Inline

// Ordem importa: codigo antes de tudo (nada dentro dele e formatado), formula
// antes de enfase (x_1 * y_2 nao e italico).
const INLINE =
  /(`+)([^`]+?)\1|\$\$([^$]+?)\$\$|\\\((.+?)\\\)|\$(?!\s)([^$\n]+?)(?<![\s\\])\$(?!\d)|\*\*(.+?)\*\*|__(.+?)__|==(.+?)==|~~(.+?)~~|(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])|(?<![\w])_(?!\s)(.+?)(?<!\s)_(?![\w])|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(?<![\w\]])((?:\[\d{1,2}\])+)(?![(\w])/g;

/**
 * Quebra uma linha em pedacos: text, code, math, strong, em, mark, del, link.
 * strong/em/mark/del carregam `children` ja quebrados, entao **negrito com $x$**
 * mantem a formula dentro do negrito.
 */
export function parseInline(text) {
  const source = String(text || "");
  const tokens = [];
  let cursor = 0;
  // Regex propria por chamada: a funcao e recursiva (negrito com formula
  // dentro), e um `lastIndex` compartilhado faria a chamada externa recomecar
  // do zero para sempre.
  const pattern = new RegExp(INLINE.source, "g");
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    if (match.index > cursor) tokens.push({ type: "text", text: source.slice(cursor, match.index) });
    cursor = match.index + match[0].length;
    if (match[2] !== undefined) tokens.push({ type: "code", text: match[2] });
    else if (match[3] !== undefined) tokens.push({ type: "math", tex: match[3].trim(), display: true });
    else if (match[4] !== undefined) tokens.push({ type: "math", tex: match[4].trim(), display: false });
    else if (match[5] !== undefined) tokens.push({ type: "math", tex: match[5].trim(), display: false });
    else if (match[6] !== undefined || match[7] !== undefined) tokens.push({ type: "strong", children: parseInline(match[6] ?? match[7]) });
    else if (match[8] !== undefined) tokens.push({ type: "mark", children: parseInline(match[8]) });
    else if (match[9] !== undefined) tokens.push({ type: "del", children: parseInline(match[9]) });
    else if (match[10] !== undefined || match[11] !== undefined) tokens.push({ type: "em", children: parseInline(match[10] ?? match[11]) });
    else if (match[12] !== undefined) tokens.push({ type: "link", href: match[13], children: parseInline(match[12]) });
    // Citacao da pesquisa na web: "[1]" ou "[2][3]" logo depois da frase. A
    // tela troca pelo selo da fonte; sem fontes na mensagem, volta a ser texto.
    else if (match[14] !== undefined) {
      for (const number of match[14].match(/\d+/g)) tokens.push({ type: "cite", index: Number(number) });
    }
  }
  if (cursor < source.length) tokens.push({ type: "text", text: source.slice(cursor) });
  return tokens;
}

/**
 * Rotulo curto que abre a linha ("Resposta:", "Passo 2:"). Ate duas palavras:
 * "Vamos ver assim: primeiro..." e frase, nao rotulo.
 */
export function labelOf(line) {
  const match = String(line || "").match(/^(?:\*\*)?([^:.,;!?\n*]{2,28})(?:\*\*)?:(?=\s|\*\*)\s*(.+)$/);
  if (!match) return null;
  const label = match[1].trim();
  if (!label || label.split(/\s+/).length > 2 || !/^[\p{L}\d]/u.test(label)) return null;
  return { label, rest: balanceBold(match[2]) };
}

/** Texto limpo para leitores de tela, copiar e salvar: sem marcacao. */
export function plainText(text) {
  return String(text || "")
    .replace(/^\s*```[\w#+.-]*\s*$/gm, "")
    .replace(/^\s*>\s?\[![^\]]+\]\s*/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/==(.+?)==/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1");
}
