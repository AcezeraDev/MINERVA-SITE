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


/**
 * Chave de comparacao para decidir se um item ja saiu.
 *
 * Ignora acento, caixa e pontuacao: "Fotossintese", "FOTOSSINTESE" e
 * "fotossintese." sao o mesmo termo. Sem isso a lista de bloqueio nao reconhece
 * o proprio conteudo de volta, porque o modelo alterna a grafia entre rodadas.
 */
export function noveltyKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Fica so com o que ainda nao saiu, preservando a ordem de chegada.
 *
 * A lista de bloqueio ja vai no prompt, mas pedir nunca bastou: o modelo
 * devolve o mesmo conceito central com outra roupagem e a partida repete assim
 * mesmo. Aqui a regra e deterministica — o que ja saiu nao entra, e um lote com
 * itens duplicados internamente tambem e limpo.
 */
export function pickUnseen(items, keyOf, seenKeys) {
  const seen = seenKeys instanceof Set ? seenKeys : new Set(seenKeys || []);
  const inBatch = new Set();
  const fresh = [];
  for (const item of items || []) {
    const key = noveltyKey(keyOf(item));
    if (!key || seen.has(key) || inBatch.has(key)) continue;
    inBatch.add(key);
    fresh.push(item);
  }
  return fresh;
}

/**
 * Junta o lote novo a memoria, sem duplicatas e com teto.
 * O mais recente fica na frente: e ele que vai para o prompt.
 */
export function mergeSeen(previous, incoming, limit) {
  const seen = new Set();
  const merged = [];
  for (const item of [...(incoming || []), ...(previous || [])]) {
    const key = noveltyKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= limit) break;
  }
  return merged;
}
