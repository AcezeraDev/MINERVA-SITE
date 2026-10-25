import test from "node:test";
import assert from "node:assert/strict";
import { buildIcs, monthGrid, nextOccurrence, parseQuickTask, parseSteps, setTaskDone, shiftDays, startOfDay } from "../shared/agenda.mjs";

// Domingo, 25 de outubro de 2026, 10h.
const now = new Date(2026, 9, 25, 10).getTime();
const base = startOfDay(now);
const subjects = [
  { id: "qui", name: "Química" },
  { id: "hist", name: "História" },
  { id: "mat", name: "Matemática" },
];
const parse = (text) => parseQuickTask(text, { now, subjects });

test("frase completa vira tarefa com dia, hora, prioridade e matéria", () => {
  const task = parse("prova de química sexta 14h !");
  assert.equal(task.title, "Prova de química");
  assert.equal(task.dueAt, shiftDays(base, 5));
  assert.equal(task.time, "14:00");
  assert.equal(task.priority, "alta");
  assert.equal(task.kind, "prova");
  assert.equal(task.subjectId, "qui");
});

test("datas relativas", () => {
  assert.equal(parse("ler capítulo 3 amanhã").dueAt, shiftDays(base, 1));
  assert.equal(parse("ler capítulo 3 amanhã").title, "Ler capítulo 3");
  assert.equal(parse("lista depois de amanhã").dueAt, shiftDays(base, 2));
  assert.equal(parse("resumo para hoje").dueAt, base);
  assert.equal(parse("resumo para hoje").title, "Resumo");
  assert.equal(parse("trabalho em 10 dias").dueAt, shiftDays(base, 10));
  assert.equal(parse("seminário semana que vem").dueAt, shiftDays(base, 7));
});

test("dia da semana igual a hoje cai na semana que vem", () => {
  assert.equal(parse("revisar domingo").dueAt, shiftDays(base, 7));
  assert.equal(parse("revisar segunda-feira").dueAt, shiftDays(base, 1));
  assert.equal(parse("revisar na terça").title, "Revisar");
});

test("datas com dia e mês", () => {
  assert.equal(parse("prova 12/11").dueAt, new Date(2026, 10, 12).getTime());
  assert.equal(parse("prova dia 30").dueAt, new Date(2026, 9, 30).getTime());
  // dia 3 já passou neste mês: vai para novembro
  assert.equal(parse("prova dia 3").dueAt, new Date(2026, 10, 3).getTime());
  // 10/01 já passou este ano: ano que vem
  assert.equal(parse("prova 10/01").dueAt, new Date(2027, 0, 10).getTime());
  assert.equal(parse("prova 31/02").dueAt, null);
});

test("horas em vários formatos", () => {
  assert.equal(parse("aula 9h30").time, "09:30");
  assert.equal(parse("aula 18:45").time, "18:45");
  assert.equal(parse("aula às 7").time, "07:00");
  assert.equal(parse("aula às 7").title, "Aula");
  assert.equal(parse("capítulo 25 de história").time, null);
});

test("repetição", () => {
  const weekly = parse("lição de matemática toda quarta");
  assert.equal(weekly.repeat, "weekly");
  assert.equal(weekly.dueAt, shiftDays(base, 3));
  assert.equal(weekly.title, "Lição de matemática");
  assert.equal(weekly.subjectId, "mat");
  const daily = parse("flashcards todo dia");
  assert.equal(daily.repeat, "daily");
  assert.equal(daily.dueAt, base);
});

test("hashtag escolhe a matéria e some do título", () => {
  const task = parse("resumo da guerra fria #hist");
  assert.equal(task.subjectId, "hist");
  assert.equal(task.title, "Resumo da guerra fria");
});

test("frase sem marcas fica intacta", () => {
  const task = parse("fazer o cartaz do grupo");
  assert.equal(task.title, "Fazer o cartaz do grupo");
  assert.equal(task.dueAt, null);
  assert.equal(task.priority, null);
});

test("concluir tarefa que repete cria a próxima uma vez só", () => {
  const tasks = [{ id: "a", dueAt: shiftDays(base, -3), done: false, createdAt: 1, repeat: "weekly", steps: [{ id: "s", text: "x", done: true }] }];
  const once = setTaskDone(tasks, "a", true, now);
  assert.equal(once.length, 2);
  assert.equal(once[0].done, true);
  assert.equal(once[1].done, false);
  assert.equal(once[1].dueAt, shiftDays(base, 4));
  assert.equal(once[1].steps[0].done, false);
  const reopened = setTaskDone(once, "a", false, now);
  const again = setTaskDone(reopened, "a", true, now);
  assert.equal(again.length, 2);
});

test("alternar sem repetição", () => {
  const tasks = [{ id: "a", dueAt: base, done: false, createdAt: 1 }];
  const done = setTaskDone(tasks, "a", undefined, now);
  assert.equal(done[0].done, true);
  assert.equal(done[0].doneAt, now);
  assert.equal(setTaskDone(done, "a", undefined, now)[0].doneAt, undefined);
});

test("próxima ocorrência nunca fica no passado", () => {
  assert.equal(nextOccurrence({ dueAt: shiftDays(base, -10), repeat: "daily" }, now), base);
  assert.equal(nextOccurrence({ dueAt: base, repeat: "weekly" }, now), shiftDays(base, 7));
  assert.equal(nextOccurrence({ dueAt: base }, now), null);
});

test("grade do mês começa no domingo e tem 42 casas", () => {
  const grid = monthGrid(2026, 9);
  assert.equal(grid.length, 42);
  assert.equal(new Date(grid[0].day).getDay(), 0);
  assert.equal(grid.find((cell) => cell.inMonth).day, new Date(2026, 9, 1).getTime());
  assert.equal(grid.filter((cell) => cell.inMonth).length, 31);
});

test("passos da Mine", () => {
  assert.deepEqual(parseSteps("Passos:\n1. Ler o resumo\n- **Fazer** exercícios\n* Revisar erros\nok"), ["Ler o resumo", "Fazer exercícios", "Revisar erros"]);
});

test("ics com evento de dia inteiro, com hora e repetição", () => {
  const ics = buildIcs(
    [
      { id: "a", title: "Prova, química", subjectId: "qui", dueAt: new Date(2026, 9, 30).getTime(), done: false, createdAt: 1 },
      { id: "b", title: "Aula", subjectId: "mat", dueAt: new Date(2026, 9, 26).getTime(), time: "09:30", repeat: "weekly", done: false, createdAt: 1 },
      { id: "c", title: "Feita", subjectId: "mat", dueAt: base, done: true, createdAt: 1 },
    ],
    subjects,
    now,
  );
  assert.match(ics, /DTSTART;VALUE=DATE:20261030/);
  assert.match(ics, /DTEND;VALUE=DATE:20261031/);
  assert.match(ics, /SUMMARY:Prova\\, química/);
  assert.match(ics, /DTSTART:20261026T093000/);
  assert.match(ics, /DTEND:20261026T103000/);
  assert.match(ics, /RRULE:FREQ=WEEKLY/);
  assert.doesNotMatch(ics, /Feita/);
  assert.ok(ics.includes("\r\n"));
});
