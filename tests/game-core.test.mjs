import test from "node:test";
import assert from "node:assert/strict";
import {
  connectionReward,
  correctSequencePositions,
  mergeSeen,
  moveSequenceItem,
  noveltyKey,
  parseSequencePuzzles,
  pickUnseen,
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


test("ineditismo ignora acento, caixa e pontuacao ao comparar", () => {
  assert.equal(noveltyKey("Fotossíntese"), noveltyKey("FOTOSSINTESE"));
  assert.equal(noveltyKey("Ciclo celular."), noveltyKey("ciclo  celular"));
  assert.notEqual(noveltyKey("Mitose"), noveltyKey("Meiose"));
  assert.equal(noveltyKey("   "), "");
});

test("o filtro descarta o que ja saiu e o que se repete dentro do lote", () => {
  const lote = [
    { term: "Mitose" },
    { term: "FOTOSSINTESE" },
    { term: "Meiose" },
    { term: "mitose" },
    { term: "Osmose" },
  ];
  const vistos = new Set([noveltyKey("Fotossíntese")]);
  const novos = pickUnseen(lote, (item) => item.term, vistos);

  assert.deepEqual(
    novos.map((item) => item.term),
    ["Mitose", "Meiose", "Osmose"],
    "o termo ja visto sai, e a segunda Mitose do proprio lote tambem",
  );
});

test("o filtro preserva a ordem de chegada e aceita memoria vazia", () => {
  const lote = [{ w: "beta" }, { w: "alfa" }, { w: "gama" }];
  assert.deepEqual(
    pickUnseen(lote, (item) => item.w, []).map((item) => item.w),
    ["beta", "alfa", "gama"],
  );
});

test("um item sem chave util nunca entra na partida", () => {
  const lote = [{ w: "" }, { w: "  ." }, { w: "Valido" }];
  assert.deepEqual(
    pickUnseen(lote, (item) => item.w, []).map((item) => item.w),
    ["Valido"],
  );
});

test("a memoria guarda o mais recente na frente, sem duplicata e com teto", () => {
  const memoria = mergeSeen(["Mitose", "Meiose"], ["Osmose", "mitose"], 3);
  assert.deepEqual(memoria, ["Osmose", "mitose", "Meiose"], "o novo entra na frente e a Mitose antiga sai por ser a mesma");
  assert.equal(mergeSeen([], [], 10).length, 0);
});

test("a memoria nao cresce alem do teto mesmo com lotes grandes", () => {
  const anteriores = Array.from({ length: 90 }, (_, index) => `antigo-${index}`);
  const novos = Array.from({ length: 20 }, (_, index) => `novo-${index}`);
  const memoria = mergeSeen(anteriores, novos, 90);
  assert.equal(memoria.length, 90);
  assert.equal(memoria[0], "novo-0", "o lote recente ocupa o topo, que e o que vai para o prompt");
});
