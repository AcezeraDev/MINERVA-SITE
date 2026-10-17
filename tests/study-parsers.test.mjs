import test from "node:test";
import assert from "node:assert/strict";
import { parseFlashcards, parseQuiz } from "../shared/study-parsers.mjs";

const provaValida = `P: Qual organela produz a maior parte do ATP da célula?
A) Ribossomo
B) Mitocôndria
C) Lisossomo
D) Complexo de Golgi
CORRETA: B
EXPLICACAO: A mitocôndria realiza a respiração celular e gera a maior parte do ATP.

P: O que a fotossíntese produz a partir de gás carbônico e água?
A) Glicose e oxigênio
B) Apenas água
C) Ácido lático
D) Proteínas
CORRETA: A
EXPLICACAO: A fotossíntese converte energia luminosa em glicose, liberando oxigênio.`;

test("prova completa vira questões utilizáveis", () => {
  const questoes = parseQuiz(provaValida);
  assert.equal(questoes.length, 2);
  assert.equal(questoes[0].options.length, 4);
  assert.equal(questoes[0].correct, 1, "CORRETA: B é o índice 1");
  assert.equal(questoes[0].options[questoes[0].correct], "Mitocôndria");
  assert.match(questoes[1].explanation, /fotossíntese/i);
});

test("gabarito apontando para alternativa inexistente derruba a questão", () => {
  // Sem esta checagem a questão iria para a tela impossível de acertar.
  const impossivel = `P: Quantas fases tem a mitose?
A) Duas
B) Quatro
C) Seis
CORRETA: D
EXPLICACAO: A mitose tem quatro fases principais.`;
  assert.equal(parseQuiz(impossivel).length, 0);
});

test("questão sem alternativas suficientes é descartada", () => {
  // Duas alternativas é o mínimo: uma questão com uma opção só não é escolha.
  const duas = `P: O que é osmose?
A) Passagem de água
B) Outra coisa
CORRETA: A`;
  const uma = `P: O que é osmose?
A) Passagem de água
CORRETA: A`;
  const nenhuma = `P: O que é osmose?
CORRETA: A`;
  assert.equal(parseQuiz(duas).length, 1);
  assert.equal(parseQuiz(uma).length, 0);
  assert.equal(parseQuiz(nenhuma).length, 0);
  assert.equal(parseQuiz("").length, 0);
});

test("alternativas aceitam os separadores que o modelo usa", () => {
  const comPonto = `P: Qual é a unidade da célula?
A. Tecido
B. Célula
CORRETA: B`;
  assert.equal(parseQuiz(comPonto)[0].options[1], "Célula");
});

test("flashcards saem em pares frente e verso", () => {
  const cartoes = parseFlashcards(`F: O que é mitocôndria?
V: Organela responsável pela respiração celular e produção de ATP.

F: O que é osmose?
V: Passagem de água através de uma membrana semipermeável.`);
  assert.equal(cartoes.length, 2);
  assert.equal(cartoes[0].front, "O que é mitocôndria?");
  assert.match(cartoes[1].back, /membrana/);
});

test("verso quebrado em duas linhas continua inteiro", () => {
  // O modelo quebra frases longas; cortar na quebra deixaria o cartão pela metade.
  const cartoes = parseFlashcards(`F: O que é fotossíntese?
V: Processo pelo qual as plantas convertem energia luminosa
em glicose, liberando oxigênio para a atmosfera.`);
  assert.equal(cartoes.length, 1);
  assert.match(cartoes[0].back, /liberando oxigênio/);
});

test("cartão sem verso não vira flashcard", () => {
  assert.equal(parseFlashcards("F: O que é mitose?").length, 0);
  assert.equal(parseFlashcards("").length, 0);
});
