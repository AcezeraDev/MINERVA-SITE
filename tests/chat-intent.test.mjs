import test from "node:test";
import assert from "node:assert/strict";
import {
  countFromPrompt,
  difficultyFromPrompt,
  flashcardTopicFromPrompt,
  isFlashcardRequest,
  isMindMapRequest,
  isQuizRequest,
  mindMapTopicFromPrompt,
  quizTopicFromPrompt,
} from "../shared/chat-intent.mjs";

test("pedido de prova e reconhecido nas formas que as pessoas escrevem", () => {
  for (const frase of [
    "monte uma prova de biologia",
    "Monte um simulado",
    "quero um simulado de história",
    "crie questões de física",
    "faça 10 perguntas sobre a revolução francesa",
    "gere exercícios de matemática",
    "preciso de questões para praticar",
  ]) {
    assert.equal(isQuizRequest(frase), true, `deveria virar prova: ${frase}`);
  }
});

test("conversa normal com a palavra questao NAO vira prova", () => {
  // Este e o falso positivo que importa: a pessoa esta pedindo explicacao,
  // nao uma prova, e transformar isso em prova sequestra a conversa.
  for (const frase of [
    "me explica essa questão",
    "não entendi a questão 3",
    "essa é uma questão de interpretação",
    "as questões que você mandou estavam difíceis",
    "qual é a questão central do texto?",
  ]) {
    assert.equal(isQuizRequest(frase), false, `nao deveria virar prova: ${frase}`);
  }
});

test("flashcards sao reconhecidos, e cartao solto nao dispara nada", () => {
  assert.equal(isFlashcardRequest("crie flashcards de biologia"), true);
  assert.equal(isFlashcardRequest("faz uns flash cards sobre mitose"), true);
  assert.equal(isFlashcardRequest("quero cartões de estudo de química"), true);
  assert.equal(isFlashcardRequest("me manda o cartão do aluno"), false);
  assert.equal(isFlashcardRequest("qual o cartão de crédito aceito?"), false);
});

test("mapa mental continua ganhando de prova na mesma frase", () => {
  // A ordem de precedencia vive no chamador, mas o gatilho tem de reconhecer:
  // "mapa mental com questoes" e um mapa, nao uma prova.
  assert.equal(isMindMapRequest("crie um mapa mental de biologia com questões"), true);
  assert.equal(isMindMapRequest("mapa mentl de fisica"), true);
  assert.equal(isMindMapRequest("estou com preparo mental para a prova"), false);
});

test("o tema sai limpo do pedido", () => {
  assert.equal(quizTopicFromPrompt("monte uma prova de biologia celular"), "Biologia celular");
  assert.equal(quizTopicFromPrompt("crie questões sobre a revolução francesa"), "Revolução francesa");
  assert.equal(flashcardTopicFromPrompt("crie flashcards de fotossíntese por favor"), "Fotossíntese");
  assert.equal(mindMapTopicFromPrompt("mapa mental de história do Brasil"), "História do Brasil");
});

test("pedido sem tema devolve vazio em vez de um tema inventado", () => {
  assert.equal(quizTopicFromPrompt("monte uma prova"), "");
  assert.equal(flashcardTopicFromPrompt("crie flashcards"), "");
  assert.equal(quizTopicFromPrompt("quero uma prova pra mim"), "");
});

test("quantidade e dificuldade saem do texto livre, com teto", () => {
  assert.equal(countFromPrompt("prova de 10 questões", 5, 15), 10);
  assert.equal(countFromPrompt("crie 20 flashcards", 8, 20), 20);
  assert.equal(countFromPrompt("crie 99 questões", 5, 15), 15, "o teto protege o orçamento de tokens");
  assert.equal(countFromPrompt("monte uma prova", 5, 15), 5, "sem número, o padrão");

  assert.equal(difficultyFromPrompt("prova difícil de biologia"), "dificil");
  assert.equal(difficultyFromPrompt("questões fáceis para começar"), "facil");
  assert.equal(difficultyFromPrompt("monte uma prova de biologia"), "medio");
});

test("os qualificadores do pedido nao entram no tema", () => {
  // Este era o bug visto na tela: o tema saia como
  // "Difícil de 10 questoes de biologia celular".
  assert.equal(quizTopicFromPrompt("monte uma prova dificil de 10 questoes de biologia celular"), "Biologia celular");
  assert.equal(quizTopicFromPrompt("monte uma prova difícil de 10 questões de biologia celular"), "Biologia celular");
  assert.equal(quizTopicFromPrompt("crie uma prova fácil sobre mitose"), "Mitose");
  assert.equal(quizTopicFromPrompt("prova de 5 perguntas de história"), "História");
  assert.equal(flashcardTopicFromPrompt("crie 20 flashcards de fotossíntese"), "Fotossíntese");
});

test("um tema que comeca com uma palavra de dificuldade sobrevive", () => {
  // "média aritmética" e assunto de verdade: a limpeza tira o qualificador da
  // frente, mas nao pode engolir o tema inteiro.
  assert.equal(quizTopicFromPrompt("monte uma prova de média aritmética"), "Aritmética");
  assert.equal(flashcardTopicFromPrompt("crie flashcards de básico de python"), "Python");
});

test("pedido so com qualificador nao inventa tema", () => {
  assert.equal(quizTopicFromPrompt("monte uma prova difícil"), "");
  assert.equal(quizTopicFromPrompt("monte uma prova de 10 questões"), "");
});

test("os proprios atalhos do app nao disparam o fluxo errado", () => {
  // Estes textos sao enviados por botoes da interface. Um deles disparando o
  // fluxo de prova por acidente cria uma prova sobre a frase do botao — foi o
  // que aconteceu com "Crie 5 questoes para eu praticar...".
  const viramProva = [
    "Monte uma prova de Biologia",
    "Monte uma prova",
  ];
  const naoViramProva = [
    "Crie um plano de estudos para a semana",
    "Explique esta matéria do zero",
    "Resuma os conteúdos de Biologia",
    "Monte um plano de revisão de Biologia",
    "Explique de outro jeito, com um exemplo simples e prático.",
    "Traga 5 exercícios de prática sobre o assunto da sua resposta anterior, com gabarito comentado.",
  ];
  const viramFlashcards = ["Crie flashcards de Biologia", "Crie flashcards"];

  for (const frase of viramProva) assert.equal(isQuizRequest(frase), true, frase);
  for (const frase of naoViramProva) assert.equal(isQuizRequest(frase), false, frase);
  for (const frase of viramFlashcards) assert.equal(isFlashcardRequest(frase), true, frase);
  for (const frase of naoViramProva) assert.equal(isFlashcardRequest(frase), false, frase);
  for (const frase of naoViramProva) assert.equal(isMindMapRequest(frase), false, frase);
});
