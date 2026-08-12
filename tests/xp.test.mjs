import test from "node:test";
import assert from "node:assert/strict";
import { gameXpFromCorrectAnswers, gamificationStats, totalXp, xpSince } from "../shared/xp.mjs";

test("jogos rendem 5 XP somente por resposta correta", () => {
  assert.equal(gameXpFromCorrectAnswers(0), 0);
  assert.equal(gameXpFromCorrectAnswers(1), 5);
  assert.equal(gameXpFromCorrectAnswers(7), 35);
});

test("terminar uma partida sem acertos não concede XP", () => {
  const sessions = [
    { kind: "Games", createdAt: 1_000, xpEarned: 0 },
    { kind: "Games", createdAt: 2_000 },
  ];
  const stats = gamificationStats({ sessions }, 2_000);
  assert.equal(stats.games, 2);
  assert.equal(stats.gameXp, 0);
  assert.equal(totalXp(stats), 0);
});

test("XP dos jogos usa o valor persistido por acertos no total e no ranking", () => {
  const sessions = [
    { kind: "Games", createdAt: 1_000, xpEarned: 15 },
    { kind: "Games", createdAt: 2_000, xpEarned: 10 },
    { kind: "Games", createdAt: 3_000, xpEarned: -50 },
  ];
  const stats = gamificationStats({ sessions }, 3_000);
  assert.equal(stats.gameXp, 25);
  assert.equal(totalXp(stats), 25);
  assert.equal(xpSince({ sessions }, 1_500), 10);
});
