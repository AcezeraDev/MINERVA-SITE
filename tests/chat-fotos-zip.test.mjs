import test from "node:test";
import assert from "node:assert/strict";
import { chatActionFromPrompt } from "../shared/chat-actions.mjs";

const kind = (frase) => chatActionFromPrompt(frase)?.kind ?? null;

test("fotos num zip: pedido vira ação do site", () => {
  for (const frase of [
    "poderia colocar todas essas fotos em um .zip? pra mim baixar elas",
    "coloca essas fotos num zip",
    "baixa todas as fotos",
    "me manda as imagens zipadas",
    "compacta as fotos pra mim",
    "salva as fotos num zip",
    "Mine, você consegue colocar elas num zip?",
  ]) {
    assert.equal(kind(frase), "fotos-zip", frase);
  }
});

test("fotos num zip: dúvida e outros pedidos continuam como antes", () => {
  assert.equal(kind("o que é um arquivo zip?"), null);
  assert.equal(kind("como eu abro um zip?"), null);
  assert.equal(kind("manda mais fotos"), null);
  assert.equal(kind("salva isso em História"), "salvar");
});
