import test from "node:test";
import assert from "node:assert/strict";
import { colchetesParaBlocos } from "../shared/chat-blocos-colchete.mjs";

test("[[quiz: {...}]] vira cerca ```quiz mesmo com colchetes no JSON", () => {
  const json = '{"titulo":"Agentes","perguntas":[{"pergunta":"x?","opcoes":["a","b]"],"correta":1}]}';
  const out = colchetesParaBlocos(`Bora treinar:\n\n[[quiz: ${json}]]\n\nBoa sorte!`);
  assert.match(out, /```quiz\n/);
  assert.ok(out.includes(json));
  assert.ok(!out.includes("[[quiz"));
  assert.match(out, /Boa sorte!$/);
});

test("marcador ainda chegando vira cerca aberta", () => {
  const out = colchetesParaBlocos('Oi [[slides: {"titulo":"A","sli');
  assert.match(out, /```slides\n\{"titulo"/);
});

test("marcadores de imagem e texto comum ficam iguais", () => {
  assert.equal(colchetesParaBlocos("[[imagem: gato | legenda]] ok"), "[[imagem: gato | legenda]] ok");
  assert.equal(colchetesParaBlocos("nada aqui"), "nada aqui");
});
