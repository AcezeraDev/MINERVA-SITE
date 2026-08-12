// Validacao deterministica das respostas estruturadas. Modelos gratuitos sao
// trocados com frequencia e podem devolver somente o primeiro caractere de uma
// dica/definicao; esses lotes nao podem chegar aos jogos ou simulados.

import { parseSequencePuzzles } from "../shared/game-core.mjs";

function matches(text, pattern) {
  return [...String(text || "").matchAll(pattern)];
}

function expectedCount(task, prompt) {
  const source = String(prompt || "");
  if (task === "caca") {
    const minimum = source.match(/pelo\s+menos\s+(\d+)/i);
    if (minimum) return Number(minimum[1]);
  }
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

export function replyQualityIssue({ task = "", reply = "", prompt = "" } = {}) {
  const cleanTask = String(task || "").trim();
  const text = String(reply || "").trim();
  if (!text) return "resposta vazia";

  if (!cleanTask) {
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
  if (cleanTask === "mindmap") {
    const branches = matches(text, /^RAMO:\s*.+$/gim).length;
    const items = matches(text, /^-\s+.+:\s+.+$/gim).length;
    return branches === 6 && items === 24 ? "" : `mapa mental incompleto (${branches} ramos, ${items} itens)`;
  }
  if (cleanTask === "plan") {
    return /^DIA\s+\d+\s*\|\s*.+\|\s*.+\|\s*.+$/im.test(text) ? "" : "plano de estudos fora do formato";
  }
  return "";
}
