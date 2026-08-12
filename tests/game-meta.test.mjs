import test from "node:test";
import assert from "node:assert/strict";
import {
  currentSeason,
  dailyChallengeKey,
  dailyChallengeQuestions,
  dailyMissionProgress,
  leagueFromPoints,
  seasonPoints,
  unlockedGameAchievementIds,
  unresolvedGameErrors,
} from "../shared/game-meta.mjs";

const noon = new Date(2026, 7, 12, 12).getTime();

test("o desafio diário é igual para o mesmo dia e muda no dia seguinte", () => {
  const first = dailyChallengeQuestions(noon).map((item) => item.id);
  const again = dailyChallengeQuestions(noon + 3_600_000).map((item) => item.id);
  const nextDay = dailyChallengeQuestions(noon + 86_400_000).map((item) => item.id);
  assert.deepEqual(first, again);
  assert.notDeepEqual(first, nextDay);
  assert.equal(first.length, 5);
});

test("caderno omite erros marcados como revisados", () => {
  const sessions = [
    { id: "g1", kind: "Games", createdAt: noon, answers: [{ id: "a1", prompt: "2+2", userAnswer: "5", correctAnswer: "4", correct: false }] },
    { id: "r1", kind: "GameReview", createdAt: noon + 1, reviewedErrorIds: ["a1"], reviewCount: 1 },
  ];
  assert.equal(unresolvedGameErrors(sessions).length, 0);
});

test("missões e pontos da temporada são derivados sem alterar XP", () => {
  const key = dailyChallengeKey(noon);
  const sessions = [
    { id: "g1", kind: "Games", createdAt: noon, correctAnswers: 5, questionsAnswered: 5, xpEarned: 25, dailyChallenge: true, dailyKey: key },
    { id: "g2", kind: "Games", createdAt: noon + 1000, correctAnswers: 2, questionsAnswered: 4, xpEarned: 10 },
    { id: "r1", kind: "GameReview", createdAt: noon + 2000, reviewedErrorIds: ["a1", "a2"], reviewCount: 2 },
  ];
  assert.equal(dailyMissionProgress(sessions, noon).every((mission) => mission.completed), true);
  assert.equal(seasonPoints(sessions, noon), 70 + 20 + 55);
  assert.equal(sessions.reduce((sum, item) => sum + (item.xpEarned || 0), 0), 35);
});

test("ligas e conquistas usam limites explícitos", () => {
  assert.equal(leagueFromPoints(299).name, "Bronze");
  assert.equal(leagueFromPoints(300).name, "Prata");
  const season = currentSeason(noon);
  const sessions = Array.from({ length: 5 }, (_, index) => ({ id: `g${index}`, kind: "Games", createdAt: season.startAt + 50_000 + index, gameId: "forca", correctAnswers: 8, questionsAnswered: 8, xpEarned: 40 }));
  const unlocked = unlockedGameAchievementIds(sessions, noon);
  assert.equal(unlocked.has("torre-perfeita"), true);
  assert.equal(unlocked.has("liga-prata"), true);
});
