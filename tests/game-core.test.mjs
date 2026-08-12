import test from "node:test";
import assert from "node:assert/strict";
import {
  connectionReward,
  correctSequencePositions,
  moveSequenceItem,
  parseSequencePuzzles,
  sequenceReward,
} from "../shared/game-core.mjs";

const validSequence = `PROCESSO: Fotossíntese
PASSO: As raízes absorvem água e sais minerais do solo
PASSO: O xilema transporta água até as folhas
PASSO: A clorofila capta a energia presente na luz
PASSO: A célula produz glicose e libera oxigênio
PORQUE: A água precisa chegar às folhas antes que a energia luminosa sustente a produção de glicose.

PROCESSO: Cicatrização
PASSO: Os vasos lesionados reduzem o fluxo de sangue
PASSO: As plaquetas formam um tampão temporário
PASSO: Células de defesa removem resíduos do ferimento
PASSO: O tecido novo ocupa e fecha a região
PORQUE: O organismo primeiro contém a perda, limpa a área e depois reconstrói o tecido danificado.`;

test("parser aceita processos completos e rejeita blocos truncados", () => {
  const parsed = parseSequencePuzzles(validSequence);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].steps.length, 4);
  assert.deepEqual(parseSequencePuzzles("PROCESSO: Curto\nPASSO: um\nPORQUE: nada"), []);
});

test("movimento de etapa é determinístico e não altera a lista original", () => {
  const source = ["a", "b", "c", "d"];
  assert.deepEqual(moveSequenceItem(source, 3, 1), ["a", "d", "b", "c"]);
  assert.deepEqual(source, ["a", "b", "c", "d"]);
  assert.deepEqual(moveSequenceItem(source, -1, 2), source);
});

test("pontuação premia domínio sem crescer sem limite", () => {
  assert.equal(connectionReward(0), 100);
  assert.equal(connectionReward(20), 200);
  assert.ok(sequenceReward(4, 1) > sequenceReward(12, 3));
  assert.equal(sequenceReward(999, 999), 80);
});

test("diagnóstico informa quantas etapas ocupam a posição certa", () => {
  assert.equal(correctSequencePositions(["a", "c", "b", "d"], ["a", "b", "c", "d"]), 2);
});

