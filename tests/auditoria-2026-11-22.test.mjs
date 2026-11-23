import assert from "node:assert/strict";
import test from "node:test";

import { conferirGabarito, lerLeitura, placarLeitura } from "../shared/leitura.mjs";
import { anotarErros, corrigirProva, provaExemplo } from "../shared/provas.mjs";
import { replyQualityIssue } from "../mine/quality.mjs";

// Casos reais da auditoria de 22/nov/2026: a Mine marcava uma alternativa e
// explicava outra.
const cortico = {
  alternativas: [
    "Os moradores viviam isolados, cada um fechado em sua casa.",
    "Os moradores viviam próximos e conversavam entre as janelas.",
    "O cortiço estava abandonado durante a manhã.",
    "As crianças eram proibidas de brincar fora.",
  ],
  correta: 0,
  explicacao: "Os moradores conversavam de janela para janela porque viviam próximos uns dos outros.",
  trecho: "trocavam-se de janela para janela as primeiras palavras, os bons-dias",
};

const leguas = {
  alternativas: ["Entre cinco e dez léguas.", "Cerca de vinte ou vinte e cinco léguas.", "Mais de cem léguas.", "Não é possível saber."],
  correta: 0,
  explicacao: "O narrador estima que a costa teria bem vinte ou vinte e cinco léguas.",
  trecho: "haverá nela bem vinte ou vinte e cinco léguas por costa",
};

test("conferirGabarito marca como inconsistente a explicação que defende outra alternativa", () => {
  assert.equal(conferirGabarito(cortico).inconsistente, true);
  assert.equal(conferirGabarito(leguas).inconsistente, true);
});

test("conferirGabarito confia no texto copiado da resposta quando o índice erra", () => {
  const resultado = conferirGabarito({ ...leguas, resposta: "Cerca de vinte ou vinte e cinco léguas." });
  assert.deepEqual(resultado, { correta: 1, inconsistente: false });
});

test("conferirGabarito mantém pergunta coerente", () => {
  const resultado = conferirGabarito({ ...leguas, correta: 1 });
  assert.deepEqual(resultado, { correta: 1, inconsistente: false });
});

test("placarLeitura deixa fora da nota as perguntas inconsistentes e reportadas", () => {
  const perguntas = [
    { correta: 0, inconsistente: false },
    { correta: 1, inconsistente: true },
    { correta: 2, inconsistente: false },
    { correta: 3, inconsistente: false },
  ];
  assert.deepEqual(placarLeitura(perguntas, [0, 1, 2, 0]), { acertos: 2, total: 3 });
  assert.deepEqual(placarLeitura(perguntas, [0, 1, 2, 0], [3]), { acertos: 2, total: 2 });
});

function leituraJson(perguntas) {
  return JSON.stringify({
    titulo: "Carta",
    genero: "carta",
    resumo: "O narrador descreve a terra encontrada e diz que o melhor fruto seria salvar a gente que vive nela.",
    ideias: ["A terra é grande e bonita."],
    palavras: [],
    perguntas: perguntas.map((item) => ({ pergunta: "Qual é o tamanho da costa segundo o texto?", ...item })),
  });
}

test("controle de qualidade da leitura pede de novo quando o gabarito se contradiz", () => {
  const boa = { ...leguas, correta: 1 };
  assert.equal(replyQualityIssue({ task: "leitura", reply: leituraJson([boa, boa, boa, boa]) }), "");
  assert.match(replyQualityIssue({ task: "leitura", reply: leituraJson([boa, boa, leguas, cortico]) }), /contraditorio|coerentes/);
  const lida = lerLeitura(leituraJson([boa, boa, boa, cortico]));
  assert.equal(lida.perguntas.filter((item) => item.inconsistente).length, 1);
});

test("caderno de erros descarta o estudo antigo quando a marcação muda", () => {
  const questoes = provaExemplo.questoes;
  const meta = { provaId: "p1", assunto: "Célula", agora: 1 };
  let caderno = anotarErros([], corrigirProva(questoes, [2, 0, 1, 1, 2]).erros, meta);
  caderno = caderno.map((item) => ({ ...item, estudo: { porque: "Você marcou vacúolo." } }));
  // Mesma questão, agora em branco: o "por que você caiu" antigo não vale mais.
  const novo = anotarErros(caderno, corrigirProva(questoes, [null, 0, 1, 1, 2]).erros, { ...meta, provaId: "p2", agora: 2 });
  const item = novo.find((erro) => erro.questao.question === questoes[0].question);
  assert.equal(item.marcada, null);
  assert.equal(item.estudo, undefined);
});
