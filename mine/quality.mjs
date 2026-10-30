// Validacao deterministica das respostas estruturadas. Modelos gratuitos sao
// trocados com frequencia e podem devolver somente o primeiro caractere de uma
// dica/definicao; esses lotes nao podem chegar aos jogos ou simulados.

import { Script } from "node:vm";

import { readCodeReply } from "../shared/code-run.mjs";
import { parseSequencePuzzles } from "../shared/game-core.mjs";
import { lerAtividade, lerCorrecaoDissertativa } from "../shared/atividades.mjs";
import { lerCorrecao } from "../shared/redacao.mjs";
import { lerEstudo } from "../shared/provas.mjs";

function matches(text, pattern) {
  return [...String(text || "").matchAll(pattern)];
}

function expectedCount(task, prompt) {
  const source = String(prompt || "");
  // "pelo menos N" vence "crie N" em qualquer task: os jogos pedem itens a mais
  // do que a partida usa, porque o cliente descarta o que ja saiu em rodadas
  // anteriores. Sem esta regra o controle de qualidade cobraria a folga e
  // rejeitaria um lote que era perfeitamente jogavel.
  const minimum = source.match(/pelo\s+menos\s+(\d+)/i);
  if (minimum) return Number(minimum[1]);
  const requested = source.match(/(?:gere|crie|escolha)\s+(\d+)/i);
  if (requested) return Number(requested[1]);
  return { vf: 3, pares: 3, forca: 1, caca: 4, quiz: 3, flashcards: 3, sequencia: 3 }[task] || 1;
}

function itemBlocks(text, prefix) {
  return String(text || "")
    .split(new RegExp(`(?=^${prefix}:)`, "gmi"))
    .map((item) => item.trim())
    .filter((item) => new RegExp(`^${prefix}:`, "i").test(item));
}

function normalizeWord(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
}

function validateTrueFalse(reply, minimum) {
  const blocks = itemBlocks(reply, "A");
  const valid = blocks.filter((block) => {
    const statement = block.match(/^A:\s*(.+)$/im)?.[1]?.trim() || "";
    const answer = block.match(/^R:\s*([VF])\s*$/im)?.[1];
    const explanation = block.match(/^EXPLICA\S*:\s*(.+)$/im)?.[1]?.trim() || "";
    return statement.length >= 12 && Boolean(answer) && explanation.length >= 12;
  });
  return valid.length >= minimum ? "" : `verdadeiro/falso incompleto (${valid.length}/${minimum})`;
}

function validatePairs(reply, minimum) {
  const blocks = itemBlocks(reply, "TERMO");
  const valid = blocks.filter((block) => {
    const term = block.match(/^TERMO:\s*(.+)$/im)?.[1]?.trim() || "";
    const definition = block.match(/^DEFINI\S*:\s*(.+)$/im)?.[1]?.trim() || "";
    const definitionWords = definition.split(/\s+/).filter(Boolean);
    const cleanGrammar = !/[-_:;,()[\]{}]/.test(definition) && /^\p{L}.+\p{L}$/u.test(definition);
    return (
      term.length >= 2 &&
      term.length <= 36 &&
      definition.length >= 6 &&
      definitionWords.length >= 3 &&
      definitionWords.length <= 8 &&
      cleanGrammar &&
      !definition.toLowerCase().includes(term.toLowerCase())
    );
  });
  return valid.length >= minimum ? "" : `pares incompletos (${valid.length}/${minimum})`;
}

function validateHangman(reply, minimum) {
  const blocks = itemBlocks(reply, "PALAVRA");
  const valid = blocks.filter((block) => {
    const rawWord = block.match(/^PALAVRA:\s*(.+)$/im)?.[1]?.trim() || "";
    const word = normalizeWord(rawWord);
    const hint = block.match(/^DICA:\s*(.+)$/im)?.[1]?.trim() || "";
    return word.length >= 4 && word.length <= 14 && hint.length >= 12 && !normalizeWord(hint).includes(word);
  });
  return valid.length >= minimum ? "" : `palavras da forca incompletas (${valid.length}/${minimum})`;
}

function validateWordSearch(reply, minimum) {
  const blocks = itemBlocks(reply, "PALAVRA");
  const seen = new Set();
  const valid = blocks.filter((block) => {
    const rawWord = block.match(/^PALAVRA:\s*(.+)$/im)?.[1]?.trim() || "";
    const word = normalizeWord(rawWord);
    const meaning = block.match(/^SIGNIFICADO:\s*(.+)$/im)?.[1]?.trim() || "";
    if (/\s|-/.test(rawWord) || seen.has(word)) return false;
    seen.add(word);
    return word.length >= 4 && word.length <= 12 && meaning.length >= 24;
  });
  return valid.length >= minimum ? "" : `caca-palavras incompleto (${valid.length}/${minimum})`;
}

function validateQuiz(reply, minimum) {
  const blocks = itemBlocks(reply, "P");
  const valid = blocks.filter((block) => {
    const options = matches(block, /^[A-D][).\-]\s*.+$/gim);
    const correct = block.match(/^CORRETA:\s*([A-D])\s*$/im);
    const explanation = block.match(/^EXPLICA\S*:\s*(.+)$/im)?.[1]?.trim() || "";
    return options.length === 4 && Boolean(correct) && explanation.length >= 10;
  });
  return valid.length >= minimum ? "" : `simulado incompleto (${valid.length}/${minimum})`;
}

function validateFlashcards(reply, minimum) {
  const blocks = itemBlocks(reply, "F");
  const valid = blocks.filter((block) => {
    const front = block.match(/^F:\s*(.+)$/im)?.[1]?.trim() || "";
    const back = block.match(/^V:\s*(.+)$/im)?.[1]?.trim() || "";
    return front.length >= 5 && back.length >= 8;
  });
  return valid.length >= minimum ? "" : `flashcards incompletos (${valid.length}/${minimum})`;
}

/**
 * Correcao do roleplay que trocou a pessoa: o aluno falou de si ("i from
 * brazil") e a correcao voltou "You are from Brazil". Ensina errado, entao a
 * resposta e recusada e a proxima tentativa entra.
 */
export function languageCorrectionIssue(prompt, reply) {
  const said = String(prompt || "").split("\n")[0].trim().toLowerCase();
  const correction = (String(reply || "").match(/^\s*\**\s*CORRE[CÇ][AÃ]O\s*\**\s*:\s*(.+)$/im)?.[1] || "").trim().toLowerCase();
  if (!said || said === "[comecar]" || !correction || /^ok\b/.test(correction)) return "";
  const aboutSelf = /^(hi|hello|yes|no|ok|okay|oh|well|um)?[\s,!.]*(i\b|i'm\b|im\b|my\b)/.test(said);
  const nowYou = /^(oh,?\s*)?(you\b|you're\b|your\b)/.test(correction);
  return aboutSelf && nowYou ? "correcao trocou a pessoa (I virou you)" : "";
}

// ---------------------------------------------------------------------------
// MineCode (out/2026): o z-ai/glm-5.3-flash as vezes deixa uma palavra perdida
// no meio do arquivo ("erate" numa linha do CSS, "researcher" no JS). O CSS
// segue funcionando pela metade e a palavra no JS da ReferenceError so quando
// roda, entao nada disso aparece no streaming. Aqui o ultimo bloco de codigo da
// resposta e conferido: sintaxe do JS e palavras sozinhas no CSS e no JS.
// Python passa direto (nao ha parser dele no servidor).

const JS_SCRIPT_TYPES = new Set(["", "text/javascript", "application/javascript", "text/ecmascript", "application/ecmascript", "module"]);

// Palavras que podem ficar sozinhas numa linha de JS valido.
const JS_LONE_KEYWORDS = new Set(["break", "continue", "return", "debugger", "else", "try", "finally", "do", "default", "this", "super", "null", "true", "false", "undefined", "async", "await", "yield", "static", "get", "set", "let", "var", "const", "new", "case", "throw", "typeof", "void", "delete", "in", "of", "instanceof", "function", "class", "extends", "import", "export", "from", "as"]);

const LONE_WORD = /^[A-Za-z_$][\w$-]*$/;

function lineAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function blankKeepingLines(text) {
  return text.replace(/[^\n]/g, " ");
}

/** Pedacos do arquivo que dao para conferir: o JS inteiro, ou os <script>/<style> do HTML. */
function checkableParts(code, lang) {
  if (lang === "javascript") return [{ kind: "js", code, firstLine: 1 }];
  if (lang !== "html") return [];
  const parts = [];
  for (const match of code.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const type = (match[1].match(/\btype\s*=\s*["']?([^"'\s>]*)/i)?.[1] || "").toLowerCase();
    // importmap, JSON, text/babel e afins nao sao JS puro.
    if (!JS_SCRIPT_TYPES.has(type) || !match[2].trim()) continue;
    const start = match.index + match[0].indexOf(">") + 1;
    parts.push({ kind: "js", code: match[2], firstLine: lineAt(code, start) });
  }
  for (const match of code.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
    const start = match.index + match[0].indexOf(">") + 1;
    parts.push({ kind: "css", code: match[1], firstLine: lineAt(code, start) });
  }
  return parts;
}

/**
 * Sintaxe do JS sem executar nada: o vm so compila. import/export saem antes
 * (o Script do vm nao conhece modulo) e o corpo vai dentro de uma funcao
 * async, que aceita o await de topo dos <script type="module">.
 */
function jsSyntaxIssue(source) {
  const body = source
    .replace(/^[ \t]*import\b(?![ \t]*[.(])[\s\S]*?["'][^"'\n]*["'][ \t]*;?/gm, blankKeepingLines)
    .replace(/^[ \t]*export[ \t]*(?:\*[^;\n]*|\{[^}]*\}[^;\n]*);?/gm, blankKeepingLines)
    .replace(/^([ \t]*)export[ \t]+default\b/gm, "$1void")
    .replace(/^([ \t]*)export\b/gm, "$1      ")
    .replace(/\bimport\.meta\b/g, "__meta__");
  try {
    new Script(`(async function () {\n${body}\n})`, { filename: "minecode.js" });
    return null;
  } catch (error) {
    const line = Number(String(error?.stack || "").match(/minecode\.js:(\d+)/)?.[1] || 0);
    return { message: String(error?.message || "erro de sintaxe"), line: line > 1 ? line - 1 : 0 };
  }
}

function previousLine(lines, index) {
  for (let i = index - 1; i >= 0; i -= 1) if (lines[i].trim()) return lines[i].trim();
  return "";
}

function nextLine(lines, index) {
  for (let i = index + 1; i < lines.length; i += 1) if (lines[i].trim()) return lines[i].trim();
  return "";
}

/**
 * Linha com uma palavra so entre duas declaracoes de CSS. Seletor quebrado em
 * linhas ("h1,\nh2 {") e valor que continua ("font-family:\n  serif;") nao
 * entram: a linha anterior termina em ; { } (ou e o comeco do <style>) e a
 * seguinte nao abre regra.
 */
function strayCssLines(css) {
  const lines = css.replace(/\/\*[\s\S]*?\*\//g, blankKeepingLines).split("\n");
  const stray = [];
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!LONE_WORD.test(line)) return;
    const before = previousLine(lines, index);
    const after = nextLine(lines, index);
    if (before && !/[;{}]$/.test(before)) return;
    if (/^[{,]/.test(after) || /^[^;]*\{/.test(after)) return;
    stray.push(index);
  });
  return stray;
}

/**
 * Identificador sozinho numa linha de JS, entre comandos, que nao aparece em
 * mais nenhum lugar do script: e sintaxe valida ("researcher" vira uma
 * expressao), mas so serve para dar ReferenceError quando roda.
 */
function strayJsLines(js) {
  const lines = js.split("\n");
  const stray = [];
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!/^[A-Za-z_$][\w$]*$/.test(line) || JS_LONE_KEYWORDS.has(line)) return;
    const before = previousLine(lines, index).replace(/\s*\/\/.*$/, "");
    const after = nextLine(lines, index);
    if (before && !/[;{})]$/.test(before)) return;
    if (/^[.([`=+\-*/%?:,&|<>]/.test(after) && !/^\/[/*]/.test(after)) return;
    const uses = js.match(new RegExp(`(?<![\\w$])${line.replace(/\$/g, "\\$")}(?![\\w$])`, "g"))?.length || 0;
    if (uses > 1) return;
    stray.push(index);
  });
  return stray;
}

/**
 * Problemas do codigo final de uma resposta do MineCode.
 * `strayLines` sao linhas (base 1, no bloco de codigo) que so tem a palavra
 * perdida; `syntax` e o erro do parser de JS, quando sobra algum.
 */
export function mineCodeIssues(reply) {
  const { code, lang, open } = readCodeReply(reply);
  if (!lang || !code.trim()) return { issue: "", strayLines: [], syntax: "" };
  if (open) return { issue: "bloco de codigo incompleto", strayLines: [], syntax: "" };
  const strayLines = [];
  let syntax = "";
  for (const part of checkableParts(code, lang)) {
    const found = part.kind === "css" ? strayCssLines(part.code) : strayJsLines(part.code);
    for (const index of found) strayLines.push(part.firstLine + index);
    if (part.kind === "js" && !syntax) {
      const error = jsSyntaxIssue(part.code);
      if (error) syntax = `${error.message}${error.line ? ` (linha ${part.firstLine + error.line - 1})` : ""}`;
    }
  }
  strayLines.sort((a, b) => a - b);
  const words = strayLines.map((line) => `"${code.split("\n")[line - 1].trim()}" na linha ${line}`);
  const problems = [...(words.length ? [`palavra solta no codigo: ${words.join(", ")}`] : []), ...(syntax ? [`erro de sintaxe no JavaScript: ${syntax}`] : [])];
  return { issue: problems.join("; "), strayLines, syntax };
}

/**
 * Conserto sem gastar outra chamada: tira as linhas que so tem a palavra
 * perdida. So vale se o arquivo sai limpo depois; erro de sintaxe que sobra
 * fica para o proximo modelo. Devolve "" quando nao da para consertar assim.
 */
export function repairMineCode(reply) {
  const text = String(reply || "").replace(/\r/g, "");
  const { strayLines, syntax } = mineCodeIssues(text);
  if (!strayLines.length || syntax) return "";
  const { code } = readCodeReply(text);
  const at = text.lastIndexOf(code.replace(/\n$/, ""));
  if (at < 0) return "";
  const drop = new Set(strayLines.map((line) => line - 1));
  const fixed = code.split("\n").filter((_line, index) => !drop.has(index)).join("\n");
  const repaired = text.slice(0, at) + fixed.replace(/\n$/, "") + text.slice(at + code.replace(/\n$/, "").length);
  return mineCodeIssues(repaired).issue ? "" : repaired;
}

export function replyQualityIssue({ task = "", reply = "", prompt = "", finishReason = "" } = {}) {
  const cleanTask = String(task || "").trim();
  const text = String(reply || "").trim();
  if (!text) return "resposta vazia";
  if (finishReason === "length") return "resposta interrompida pelo limite de saida";

  if (!cleanTask) {
    if ((text.match(/^\s*```/gm) || []).length % 2) return "bloco de codigo incompleto";
    if (/^(okay|we need answer|the user|assistant analysis)\b/i.test(text)) return "raciocinio interno exposto";
    if (String(prompt || "").trim().length > 30 && text.length < 8) return "resposta curta demais";
    return "";
  }

  const minimum = expectedCount(cleanTask, prompt);
  if (cleanTask === "vf") return validateTrueFalse(text, minimum);
  if (cleanTask === "pares") return validatePairs(text, minimum);
  if (cleanTask === "forca") return validateHangman(text, minimum);
  if (cleanTask === "caca") return validateWordSearch(text, minimum);
  if (cleanTask === "quiz") return validateQuiz(text, minimum);
  if (cleanTask === "flashcards") return validateFlashcards(text, minimum);
  if (cleanTask === "sequencia") {
    const valid = parseSequencePuzzles(text).length;
    return valid >= minimum ? "" : `sequencias incompletas (${valid}/${minimum})`;
  }
  if (cleanTask === "idioma-conversa") {
    if (!/^\s*MINE\s*:\s*\S/im.test(text)) return "fala do roleplay sem o rotulo MINE";
    return languageCorrectionIssue(prompt, text);
  }
  if (cleanTask === "mindmap") {
    const branches = matches(text, /^RAMO:\s*.+$/gim).length;
    const items = matches(text, /^-\s+.+:\s+.+$/gim).length;
    return branches === 6 && items === 24 ? "" : `mapa mental incompleto (${branches} ramos, ${items} itens)`;
  }
  if (cleanTask === "minecode") return mineCodeIssues(text).issue;
  // A redacao vem no prompt: os trechos grifados precisam existir nela.
  if (cleanTask === "redacao") return lerCorrecao(text, prompt) ? "" : "correcao de redacao fora do formato";
  if (cleanTask === "atividade") return lerAtividade(text) ? "" : "atividade incompleta ou fora do formato";
  if (cleanTask === "atividade-correcao") return lerCorrecaoDissertativa(text) ? "" : "correcao da dissertativa fora do formato";
  if (cleanTask === "prova-estudo") {
    const valid = lerEstudo(text).length;
    return valid >= minimum ? "" : `estudo dos erros incompleto (${valid}/${minimum})`;
  }
  if (cleanTask === "plan") {
    return /^DIA\s+\d+\s*\|\s*.+\|\s*.+\|\s*.+$/im.test(text) ? "" : "plano de estudos fora do formato";
  }
  return "";
}
