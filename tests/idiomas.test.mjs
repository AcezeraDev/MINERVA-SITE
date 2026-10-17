import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLesson,
  buildReviewLesson,
  checkExercise,
  englishUnits,
  conversationContext,
  gradeSpeech,
  isTeaching,
  languageStreak,
  seededRandom,
  sentenceDistractors,
  gradeTyped,
  languageProgress,
  lessonKey,
  lessonPath,
  lessonResult,
  normalizeAnswer,
  parseConversationReply,
  sentenceTiles,
  speechScore,
  wordOfTheDay,
  wordsToReview,
} from "../shared/idiomas.mjs";
import { gamificationStats, lessonXp, totalXp, xpSince } from "../shared/xp.mjs";
import { buildLanguageChatInstruction, buildInstructionForTask } from "../mine/prompts.mjs";
import { replyQualityIssue } from "../mine/quality.mjs";

const airport = englishUnits[0];

test("o roteiro tem 8 paradas completas e sem palavra repetida dentro da parada", () => {
  assert.equal(englishUnits.length, 8);
  for (const unit of englishUnits) {
    assert.ok(unit.words.length >= 8, unit.id);
    assert.ok(unit.phrases.length >= 6, unit.id);
    assert.equal(unit.script.length, 4, unit.id);
    assert.ok(unit.character && unit.tip?.rule, unit.id);
    assert.equal(unit.missions.length, 3, unit.id);
    assert.equal(unit.scriptMissions.length, unit.script.length, unit.id);
    // toda missão é cumprida por alguma fala do roteiro de reserva
    for (let mission = 0; mission < unit.missions.length; mission += 1) assert.ok(unit.scriptMissions.includes(mission), `${unit.id}: missão ${mission}`);
    assert.equal(new Set(unit.words.map((word) => word.en)).size, unit.words.length, unit.id);
    for (const turn of unit.script) assert.equal(turn.options.filter((option) => option.ok).length, 1, `${unit.id}: ${turn.mine}`);
  }
  assert.equal(lessonPath().length, 24);
});

test("a mesma semente monta a mesma lição, e cada exercício tem resposta entre as opções", () => {
  for (const unit of englishUnits) {
    for (const stage of [1, 2]) {
      const first = buildLesson(unit, stage, 42);
      assert.deepEqual(buildLesson(unit, stage, 42), first);
      // 8 exercícios valendo nota, com cartões de ensino antes
      assert.equal(first.filter((exercise) => !isTeaching(exercise)).length, 8, `${unit.id} ${stage}`);
      assert.ok(isTeaching(first[0]), "a lição começa ensinando");
      for (const exercise of first) {
        if (exercise.kind === "escolha") {
          const size = exercise.mode === "qual" ? 3 : 4;
          assert.equal(exercise.options.length, size, `${unit.id} ${exercise.mode}`);
          assert.ok(exercise.options.includes(exercise.answer));
          assert.equal(new Set(exercise.options).size, size);
        }
        if (exercise.kind === "monte") {
          // todas as peças da resposta estão no banco de peças
          const bank = [...exercise.tiles];
          for (const piece of exercise.answer) {
            const at = bank.indexOf(piece);
            assert.ok(at >= 0, `${unit.id}: falta a peça ${piece}`);
            bank.splice(at, 1);
          }
        }
        if (exercise.kind === "escolha" && exercise.mode === "complete") assert.match(exercise.prompt, /___/);
      }
    }
  }
});

test("palavras grifadas entram primeiro, e a etapa 1 apresenta as 8 palavras", () => {
  const lesson = buildLesson(airport, 1, 7, ["suitcase"]);
  assert.equal(lesson[0].kind, "aprenda");
  assert.equal(lesson[0].words[0].en, "suitcase");
  const taught = lesson.filter((item) => item.kind === "aprenda").flatMap((item) => item.words.map((word) => word.en));
  assert.equal(new Set(taught).size, 8);
});

test("a etapa 2 começa com a dica de gramática e tem ditado e 'qual frase'", () => {
  const lesson = buildLesson(airport, 2, 11);
  assert.equal(lesson[0].kind, "dica");
  assert.equal(lesson[0].title, airport.tip.title);
  assert.ok(lesson.some((item) => item.kind === "digite" && item.mode === "ditado"));
  assert.ok(lesson.some((item) => item.kind === "escolha" && item.mode === "qual"));
});

test("frases-armadilha são diferentes da certa e entre si", () => {
  for (const unit of englishUnits) {
    for (const phrase of unit.phrases) {
      const wrong = sentenceDistractors(phrase, unit, seededRandom(3));
      assert.equal(wrong.length, 2, `${unit.id}: ${phrase.en}`);
      for (const item of wrong) assert.notEqual(normalizeAnswer(item), normalizeAnswer(phrase.en));
      assert.notEqual(normalizeAnswer(wrong[0]), normalizeAnswer(wrong[1]));
    }
  }
});

test("normaliza contrações, pontuação e acentos", () => {
  assert.equal(normalizeAnswer("I'm fine, thank you!"), "i am fine thank you");
  assert.equal(normalizeAnswer("Let’s take a photo"), "let us take a photo");
  assert.equal(normalizeAnswer("  Café  "), "cafe");
});

test("digitação aceita um erro pequeno como 'quase'", () => {
  assert.equal(gradeTyped("passport", "passport"), "certo");
  assert.equal(gradeTyped("passport", "pasport"), "quase");
  assert.equal(gradeTyped("suitcase", "sutcase"), "quase");
  assert.equal(gradeTyped("cat", "car"), "errado");
  assert.equal(gradeTyped("hello", "goodbye"), "errado");
  assert.equal(gradeTyped("hello", ""), "errado");
  // ditado de frase longa tolera até três letras trocadas
  assert.equal(gradeTyped("The bus stop is near here.", "the bus stop is neer hear"), "quase");
  assert.equal(gradeTyped("The bus stop is near here.", "the bus is here"), "errado");
});

test("fala compara palavras na ordem e pune palavras a mais", () => {
  assert.equal(speechScore("Nice to meet you.", "nice to meet you"), 1);
  assert.equal(gradeSpeech("I am from Brazil.", "I'm from Brazil"), "certo");
  assert.equal(gradeSpeech("Here is my passport.", "here is my"), "quase");
  assert.equal(gradeSpeech("Here is my passport.", "banana"), "errado");
  assert.ok(speechScore("hello", "hello hello hello hello") < 0.5);
});

test("corrige cada tipo de exercício", () => {
  const tiles = { kind: "monte", mode: "traduza", prompt: "", audio: "I am from Brazil.", tiles: [], answer: sentenceTiles("I am from Brazil."), word: "" };
  assert.equal(checkExercise(tiles, ["I", "am", "from", "Brazil"]).result, "certo");
  assert.equal(checkExercise(tiles, ["am", "I", "from", "Brazil"]).result, "errado");
  assert.equal(checkExercise({ kind: "escolha", answer: "dog" }, "dog").result, "certo");
  assert.equal(checkExercise({ kind: "escolha", answer: "dog" }, "cat").result, "errado");
  const pairs = { kind: "pares", pairs: [{ en: "a", pt: "b" }] };
  assert.equal(checkExercise(pairs, 0).result, "certo");
  assert.equal(checkExercise(pairs, 1).result, "quase");
  assert.equal(checkExercise(pairs, 3).result, "errado");
});

test("lê a fala da Mine no roleplay, com e sem rótulos", () => {
  const reply = parseConversationReply(
    "MINE: Nice to meet you! Where are you from?\nCORRECAO: Hello, my name is Davi.\nDICA: Faltou o \"is\" depois de name.\nNOTA: 1\nSUGESTOES: I am from Brazil. | I'm from São Paulo | Brazil!",
  );
  assert.equal(reply.mine, "Nice to meet you! Where are you from?");
  assert.equal(reply.correction, "Hello, my name is Davi.");
  assert.equal(reply.score, 1);
  assert.deepEqual(reply.suggestions, ["I am from Brazil.", "I'm from São Paulo", "Brazil!"]);

  const ok = parseConversationReply("**MINE:** Great!\nCORREÇÃO: OK\nNOTA: 2");
  assert.equal(ok.mine, "Great!");
  assert.equal(ok.correction, "");
  assert.equal(ok.score, 2);

  assert.equal(parseConversationReply("Hello there, welcome!\nNOTA: 2").mine, "Hello there, welcome!");
  assert.equal(parseConversationReply(""), null);

  const full = parseConversationReply(
    [
      "MINE: Hi, I'm Lily! What would you like?",
      "TRADUCAO: Oi, eu sou a Lily! O que você gostaria?",
      "CORRECAO: OK",
      "DICA: Boa!",
      "NOTA: 2",
      "MISSOES: 1, 3",
      "SUGESTOES: A tea, please. | Coffee! | Water",
    ].join("\n"),
  );
  assert.deepEqual(full.missions, [0, 2]);
  assert.equal(full.translation, "Oi, eu sou a Lily! O que você gostaria?");
  assert.deepEqual(parseConversationReply(["MINE: Hi!", "MISSOES: 0"].join("\n")).missions, []);
});

test("progresso: etapa feita com metade de acerto abre a próxima e carimba a parada", () => {
  const empty = languageProgress([]);
  assert.equal(empty.next.key, lessonKey("airport", 1));
  assert.ok(!empty.unlocked.has(lessonKey("airport", 2)));

  const sessions = [1, 2, 3].map((stage, index) => ({ kind: "Idiomas", lang: "en", lessonKey: lessonKey("airport", stage), accuracy: 0.75, createdAt: index + 1 }));
  sessions.push({ kind: "Idiomas", lang: "en", lessonKey: lessonKey("cafe", 1), accuracy: 0.25, createdAt: 9 });
  const progress = languageProgress(sessions);
  assert.deepEqual(progress.stamps, ["airport"]);
  assert.ok(progress.unlocked.has(lessonKey("cafe", 1)));
  assert.ok(!progress.done.has(lessonKey("cafe", 1)));
  assert.equal(progress.next.key, lessonKey("cafe", 1));
  assert.equal(progress.best[lessonKey("airport", 1)].stars, 1);
  assert.equal(progress.level.code, "A1");
});

test("palavra errada fica grifada até ser acertada depois", () => {
  const sessions = [
    { kind: "Idiomas", createdAt: 1, wordsMissed: ["passport", "dog"], wordsRight: ["hello"] },
    { kind: "Idiomas", createdAt: 2, wordsMissed: [], wordsRight: ["passport"] },
    { kind: "Idiomas", createdAt: 3, wordsMissed: ["I am from Brazil."], wordsRight: [] },
  ];
  assert.deepEqual(wordsToReview(sessions), ["dog"]);
  assert.equal(buildReviewLesson(["dog"]).length, 0);
  const review = buildReviewLesson(["dog", "cat", "apple", "passport", "tea"], 3);
  assert.equal(review.length, 5);
});

test("repetição do erro não conta na nota; missões contam", () => {
  const result = lessonResult([
    { kind: "escolha", result: "errado", word: "dog" },
    { kind: "escolha", result: "certo", word: "cat" },
    { kind: "escolha", result: "certo", word: "dog", retry: true },
    { kind: "missao", result: "certo", word: "" },
  ]);
  assert.equal(result.total, 3);
  assert.equal(result.correct, 2);
  assert.deepEqual(result.wordsMissed, ["dog"]);
});

test("contexto do roleplay leva personagem, nome do aluno e missões", () => {
  const context = conversationContext(englishUnits[1], { code: "A1", label: "x" }, "Davi");
  assert.match(context, /Lily/);
  assert.match(context, /Davi/);
  assert.match(context, /1\. pedir uma bebida/);
});

test("ofensiva: dias seguidos; hoje sem lição não quebra a sequência de ontem", () => {
  const day = 86_400_000;
  const now = new Date(2026, 9, 17, 15).getTime();
  const sessions = [now - 2 * day, now - day].map((createdAt) => ({ kind: "Idiomas", createdAt }));
  assert.deepEqual(languageStreak(sessions, now), { streak: 2, todayLessons: 0 });
  assert.deepEqual(languageStreak([...sessions, { kind: "Idiomas", createdAt: now }], now), { streak: 3, todayLessons: 1 });
  assert.equal(languageStreak([{ kind: "Idiomas", createdAt: now - 3 * day }], now).streak, 0);
});

test("resultado da lição e XP: só acerto rende, lição perfeita ganha bônus", () => {
  const result = lessonResult([
    { kind: "escolha", result: "certo", word: "hello" },
    { kind: "digite", result: "quase", word: "passport" },
    { kind: "fale", result: "certo", word: "friend" },
    { kind: "escolha", result: "errado", word: "plane" },
    { kind: "fale", result: "pulou", word: "name" },
  ]);
  assert.equal(result.total, 4);
  assert.equal(result.correct, 3);
  assert.equal(result.spoke, 1);
  assert.deepEqual(result.wordsMissed, ["plane"]);
  assert.equal(result.xp, 12);
  assert.equal(lessonXp(8, 8), 42);
  assert.equal(lessonXp(0, 8), 0);
  assert.equal(lessonXp(999, 999), 60);
});

test("sessões de idioma contam no XP total, no ranking por janela e nas conquistas", () => {
  const sessions = [{ kind: "Idiomas", createdAt: 5_000, xpEarned: 30 }];
  const stats = gamificationStats({ sessions }, 6_000);
  assert.equal(stats.idiomas, 1);
  assert.equal(stats.idiomaXp, 30);
  // 30 da lição + 20 da conquista "Hello, world!"
  assert.equal(totalXp(stats), 50);
  assert.equal(xpSince({ sessions }, 4_000), 30);
  assert.equal(xpSince({ sessions }, 5_001), 0);
});

test("prompt do roleplay existe como task e o controle de qualidade exige a fala", () => {
  assert.equal(buildInstructionForTask("idioma-conversa", "ctx"), buildLanguageChatInstruction("ctx"));
  assert.match(buildLanguageChatInstruction("x"), /SUGESTOES:/);
  assert.equal(replyQualityIssue({ task: "idioma-conversa", reply: "MINE: Hi!\nNOTA: 2" }), "");
  assert.notEqual(replyQualityIssue({ task: "idioma-conversa", reply: "Hi there" }), "");
});

test("palavra do dia é estável no mesmo dia", () => {
  const noon = new Date(2026, 9, 17, 12).getTime();
  assert.deepEqual(wordOfTheDay(noon), wordOfTheDay(noon + 3_600_000));
  assert.ok(wordOfTheDay(noon).en);
});
