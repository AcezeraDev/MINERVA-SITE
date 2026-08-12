/**
 * Regras puras dos jogos mais novos do Minerva.
 *
 * Este arquivo fica em shared para que o navegador e os testes Node usem a
 * mesma implementacao. A interface anima o resultado; ela nao decide a regra.
 */

export function parseSequencePuzzles(source) {
  const blocks = String(source || "")
    .split(/(?=^PROCESSO:)/gim)
    .map((block) => block.trim())
    .filter((block) => /^PROCESSO:/i.test(block));

  return blocks.flatMap((block) => {
    const title = block.match(/^PROCESSO:\s*(.+)$/im)?.[1]?.trim() || "";
    const steps = [...block.matchAll(/^PASSO:\s*(.+)$/gim)].map((match) => match[1].trim());
    const explanation = block.match(/^PORQUE:\s*(.+)$/im)?.[1]?.trim() || "";
    if (title.length < 3 || steps.length !== 4 || steps.some((step) => step.length < 5) || explanation.length < 16) return [];
    if (new Set(steps.map((step) => step.toLocaleLowerCase("pt-BR"))).size !== 4) return [];
    return [{ title, steps, explanation }];
  });
}

export function moveSequenceItem(items, from, to) {
  const copy = [...items];
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= copy.length || to >= copy.length || from === to) {
    return copy;
  }
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function correctSequencePositions(order, answer) {
  return order.reduce((total, item, index) => total + (item === answer[index] ? 1 : 0), 0);
}

export function connectionReward(streak) {
  return 100 + Math.min(5, Math.max(0, Number(streak) || 0)) * 20;
}

export function sequenceReward(moves, attempts) {
  const movePenalty = Math.max(0, (Number(moves) || 0) - 3) * 8;
  const attemptPenalty = Math.max(0, (Number(attempts) || 0) - 1) * 35;
  return Math.max(80, 320 - movePenalty - attemptPenalty);
}

