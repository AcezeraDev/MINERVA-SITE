import assert from "node:assert/strict";
import test from "node:test";

import { anotarErros, contextoEstudo, corrigirProva, embaralharAlternativas, lerEstudo, provaExemplo, registrarIrma, resumoCaderno } from "../shared/provas.mjs";
import { replyQualityIssue } from "../mine/quality.mjs";
import { buildInstructionForTask } from "../mine/prompts.mjs";

const questoes = provaExemplo.questoes;

test("corrigirProva conta branco como erro e dá nota de 0 a 10", () => {
  const resultado = corrigirProva(questoes, [1, 0, null, 1, 2]);
  assert.equal(resultado.acertos, 3);
  assert.equal(resultado.nota, 6);
  assert.deepEqual(resultado.erros.map((item) => item.indice), [1, 2]);
  assert.equal(resultado.erros[1].marcada, null);
});

test("embaralharAlternativas mantém a mesma resposta certa", () => {
  for (const semente of [1, 7, 99, 12345]) {
    const nova = embaralharAlternativas(questoes[0], semente);
    assert.equal(nova.options[nova.correct], questoes[0].options[questoes[0].correct]);
    assert.deepEqual([...nova.options].sort(), [...questoes[0].options].sort());
  }
});

test("anotarErros não duplica a questão que voltou a ser errada", () => {
  const { erros } = corrigirProva(questoes, [0, 0, 0, 0, 0]);
  let caderno = anotarErros([], erros, { provaId: "p1", assunto: "Célula", agora: 1 });
  assert.equal(caderno.length, 4);
  caderno = registrarIrma(caderno, caderno[0].id, true, 2);
  assert.equal(resumoCaderno(caderno).dominados, 1);
  caderno = anotarErros(caderno, erros, { provaId: "p2", assunto: "Célula", agora: 3 });
  assert.equal(caderno.length, 4);
  assert.equal(resumoCaderno(caderno).dominados, 0);
  assert.ok(caderno.every((item) => item.vezes === 2));
});

test("lerEstudo lê o exemplo inteiro com questão-irmã válida", () => {
  const estudos = lerEstudo(provaExemplo.estudos);
  assert.equal(estudos.length, 5);
  for (const estudo of estudos) {
    assert.equal(estudo.irma.options.length, 4);
    assert.ok(estudo.aula.length > 40);
    assert.ok(estudo.macete);
    assert.ok(estudo.porque);
  }
  assert.equal(estudos[2].irma.correct, 0);
});

test("lerEstudo descarta bloco sem questão-irmã e número repetido", () => {
  const texto = `ERRO: 1
CONCEITO: Algo
AULA: Esta aula tem tamanho suficiente, mas falta a questão-irmã embaixo.

ERRO: 2
CONCEITO: Outro
AULA: Esta aula tem tamanho suficiente e vem com a questão-irmã logo abaixo.
P: Pergunta nova?
A) um
B) dois
C) três
D) quatro
CORRETA: D
EXPLICACAO: Porque sim, com explicação.

ERRO: 2
AULA: Repetida, esta não deve entrar no resultado final da leitura.
P: Outra?
A) a
B) b
C) c
D) d
CORRETA: A`;
  const estudos = lerEstudo(texto);
  assert.equal(estudos.length, 1);
  assert.equal(estudos[0].erro, 2);
  assert.equal(estudos[0].irma.correct, 3);
});

test("contextoEstudo diz o que foi marcado e o gabarito", () => {
  const contexto = contextoEstudo([{ questao: questoes[0], marcada: 0, assunto: "Célula" }, { questao: questoes[1], marcada: null, assunto: "Célula" }]);
  assert.match(contexto, /ERRO 1/);
  assert.match(contexto, /marcou: A\) Ribossomo/);
  assert.match(contexto, /Resposta certa: B\) Mitocôndria/);
  assert.match(contexto, /deixou em branco/);
});

test("controle de qualidade cobra um bloco por erro pedido", () => {
  assert.equal(replyQualityIssue({ task: "prova-estudo", prompt: "Crie 5 blocos de estudo, um para cada erro.", reply: provaExemplo.estudos }), "");
  assert.match(replyQualityIssue({ task: "prova-estudo", prompt: "Crie 6 blocos de estudo, um para cada erro.", reply: provaExemplo.estudos }), /incompleto \(5\/6\)/);
  assert.match(buildInstructionForTask("prova-estudo", "ERRO 1"), /questao-irma INEDITA/);
});
