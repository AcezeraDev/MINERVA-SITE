/**
 * Leitura das respostas estruturadas de estudo: prova e flashcards.
 *
 * Mesmo padrao "ROTULO: valor" por linha usado pelos jogos — modelo pequeno
 * erra JSON e acerta isto. Fica em shared para o navegador e os testes Node
 * usarem a mesma implementacao: sao estes parsers que decidem se um lote da IA
 * vira material de estudo ou vai para o lixo, entao nao podem ter uma segunda
 * versao divergindo em silencio.
 */

/**
 * Formato "P: enunciado / A) ... B) ... / CORRETA: B / EXPLICACAO: ...".
 *
 * Uma questao so entra com enunciado, ao menos duas alternativas e um gabarito
 * que aponta para uma alternativa que existe. Sem essa ultima checagem um
 * "CORRETA: D" num bloco de tres alternativas viraria uma questao impossivel de
 * acertar.
 */
export function parseQuiz(text) {
  const questions = [];
  let current = null;
  const flush = () => {
    if (current && current.question && current.options.length >= 2 && current.correct >= 0 && current.correct < current.options.length) {
      questions.push(current);
    }
    current = null;
  };
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const ask = line.match(/^P:\s*(.+)$/i);
    if (ask) {
      flush();
      current = { question: ask[1].trim(), options: [], correct: -1, explanation: "" };
      continue;
    }
    if (!current) continue;
    const option = line.match(/^([A-D])[)\.\-]\s*(.+)$/i);
    if (option) {
      current.options.push(option[2].trim());
      continue;
    }
    const correct = line.match(/^CORRETA:?\s*([A-D])/i);
    if (correct) {
      current.correct = correct[1].toUpperCase().charCodeAt(0) - 65;
      continue;
    }
    const explanation = line.match(/^EXPLICA\S*:?\s*(.+)$/i);
    if (explanation) {
      current.explanation = explanation[1].trim();
      continue;
    }
  }
  flush();
  return questions;
}

/**
 * Formato "F: frente / V: verso".
 * Linha solta depois de um verso e continuacao dele: o modelo quebra frases
 * longas em duas linhas e cortar ali deixaria o cartao pela metade.
 */
export function parseFlashcards(text) {
  const cards = [];
  let front = "";
  let back = "";
  const flush = () => {
    if (front.trim() && back.trim()) cards.push({ front: front.trim(), back: back.trim() });
    front = "";
    back = "";
  };
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    const frontMatch = line.match(/^F:\s*(.+)$/i);
    if (frontMatch) {
      flush();
      front = frontMatch[1];
      continue;
    }
    const backMatch = line.match(/^V:\s*(.+)$/i);
    if (backMatch) {
      back = back ? `${back} ${backMatch[1]}` : backMatch[1];
      continue;
    }
    if (line && back) back += ` ${line}`;
  }
  flush();
  return cards;
}
