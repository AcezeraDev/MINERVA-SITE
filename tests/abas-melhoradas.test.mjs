// Nov/2026: caderno de erros que vai com a conta e placar por jogo.
import test from "node:test";
import assert from "node:assert/strict";
import { juntarCadernos, juntarHistorico, limiteCadernoConta } from "../shared/provas.mjs";
import { compararPartidas, melhorPorJogo } from "../shared/game-meta.mjs";

const erro = (id, status, atualizadoEm) => ({ id, status, atualizadoEm, assunto: "x", questao: { question: id, options: [], correct: 0 } });

test("juntar cadernos: por id vence a versão mais recente", () => {
  const local = [erro("a", "pendente", 10), erro("b", "pendente", 10)];
  const conta = [erro("a", "dominado", 20), erro("c", "estudado", 5)];
  const junto = juntarCadernos(local, conta);
  assert.equal(junto.length, 3);
  assert.equal(junto.find((item) => item.id === "a").status, "dominado");
});

test("juntar cadernos: o corte guarda os pendentes antes dos dominados", () => {
  const muitos = Array.from({ length: limiteCadernoConta + 10 }, (_, i) => erro(`d${i}`, "dominado", 1000 + i));
  const junto = juntarCadernos(muitos, [erro("p", "pendente", 1)]);
  assert.equal(junto.length, limiteCadernoConta);
  assert.equal(junto[0].id, "p");
});

test("juntar cadernos aceita lista vazia ou ausente", () => {
  assert.deepEqual(juntarCadernos(undefined, null, []), []);
});

test("juntar histórico: sem repetição e mais recente primeiro", () => {
  const h = juntarHistorico([{ id: "1", quando: 5 }], [{ id: "1", quando: 5 }, { id: "2", quando: 9 }]);
  assert.deepEqual(h.map((item) => item.id), ["2", "1"]);
});

test("melhor por jogo: precisão primeiro, depois acertos, depois tempo", () => {
  const s = (gameId, c, t, ms) => ({ kind: "Games", gameId, correctAnswers: c, questionsAnswered: t, durationMs: ms });
  const melhor = melhorPorJogo([s("corrida", 5, 8, 30000), s("corrida", 7, 8, 90000), s("corrida", 7, 8, 60000), s("memoria", 3, 3, 20000)]);
  assert.deepEqual(melhor.corrida, { c: 7, t: 8, ms: 60000, n: 3 });
  assert.equal(melhor.memoria.n, 1);
});

test("melhor por jogo: desafio diário tem placar próprio e partida vazia não conta", () => {
  const melhor = melhorPorJogo([
    { kind: "Games", gameId: "daily", dailyChallenge: true, correctAnswers: 4, questionsAnswered: 5, durationMs: 1 },
    { kind: "Games", gameId: "corrida", correctAnswers: 0, questionsAnswered: 0 },
    { kind: "Foco", gameId: "corrida", correctAnswers: 9, questionsAnswered: 9 },
  ]);
  assert.deepEqual(Object.keys(melhor), ["daily"]);
});

test("comparar partidas ordena do melhor para o pior", () => {
  const lista = [{ c: 5, t: 8, ms: 1 }, { c: 8, t: 8, ms: 99 }, { c: 8, t: 8, ms: 50 }].sort(compararPartidas);
  assert.deepEqual(lista.map((p) => p.ms), [50, 99, 1]);
});
