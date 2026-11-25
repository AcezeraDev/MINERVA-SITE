import { test } from "node:test";
import assert from "node:assert/strict";
import { ofertaFinal } from "../shared/chat-ofertas.mjs";

test("oferta no fim vira botão de um toque", () => {
  assert.equal(ofertaFinal("Explicação.\n\nQuer que eu monte um quiz de 4 questões?")?.botao, "Sim, monte um quiz de 4 questões");
  assert.equal(ofertaFinal("Posso fazer um resumo?")?.botao, "Sim, pode fazer um resumo");
  assert.equal(ofertaFinal("Quer fazer um quiz?")?.botao, "Sim, quero fazer um quiz");
  assert.equal(ofertaFinal("Se quiser, posso montar um cartaz com os animais?")?.botao, "Sim, pode montar um cartaz com os animais");
});

test("oferta comprida vira só 'Sim, quero'", () => {
  const oferta = ofertaFinal("Quer fazer um quiz de 4 questões estilo prova do 9º ano sobre fotossíntese?");
  assert.equal(oferta?.botao, "Sim, quero");
  assert.equal(oferta?.envio, "Sim, quero.");
});

test("pergunta que não é oferta não ganha botão", () => {
  assert.equal(ofertaFinal("O que você acha?"), null);
  assert.equal(ofertaFinal("Isso é tudo."), null);
  assert.equal(ofertaFinal("Quer que eu monte um quiz?\n\n```quiz\n{}\n```\n\nBoa prova!"), null);
});

test("marcadores e blocos não atrapalham a última frase", () => {
  assert.equal(ofertaFinal("Texto.\n\nQuer que eu faça os flashcards?\n[[sugestoes: a | b | c]]")?.botao, "Sim, faça os flashcards");
});
