import test from "node:test";
import assert from "node:assert/strict";

import { hasImageMarker, splitMessageMedia, stripImageMarkers, stripPendingMarker } from "../shared/chat-media.mjs";

test("a foto entra no lugar exato em que a Mine pediu", () => {
  const resposta = [
    "Nikola Tesla foi um engenheiro sérvio-americano.",
    "[[imagem: Nikola Tesla | Tesla desenvolveu o sistema de corrente alternada]]",
    "Ele criou o motor de indução, base dos motores elétricos de hoje.",
  ].join("\n\n");

  assert.deepEqual(splitMessageMedia(resposta), [
    { type: "text", text: "Nikola Tesla foi um engenheiro sérvio-americano." },
    { type: "image", query: "Nikola Tesla", caption: "Tesla desenvolveu o sistema de corrente alternada" },
    { type: "text", text: "Ele criou o motor de indução, base dos motores elétricos de hoje." },
  ]);
});

test("marcador sem legenda e marcador no fim do texto funcionam", () => {
  assert.deepEqual(splitMessageMedia("O Coliseu ficava em Roma.\n[[imagem: Coliseu]]"), [
    { type: "text", text: "O Coliseu ficava em Roma." },
    { type: "image", query: "Coliseu", caption: "" },
  ]);
});

test("duas fotos passam, porque uma resposta pode comparar duas coisas", () => {
  const segments = splitMessageMedia(
    "A mitocôndria produz energia.\n[[imagem: Mitocôndria]]\nJá o cloroplasto faz fotossíntese.\n[[imagem: Cloroplasto]]",
  );
  assert.deepEqual(
    segments.filter((item) => item.type === "image").map((item) => item.query),
    ["Mitocôndria", "Cloroplasto"],
  );
});

test("da terceira foto em diante o marcador some, e sem partir o texto em pedacos", () => {
  // Um modelo empolgado pede foto a cada paragrafo. O teto e aplicado aqui, e
  // nao no prompt, porque o prompt e um pedido e isto e uma garantia.
  const segments = splitMessageMedia(
    "Um.\n[[imagem: Mitocôndria]]\nDois.\n[[imagem: Cloroplasto]]\nTrês e o [[imagem: Ribossomo]] ribossomo.",
  );
  assert.deepEqual(segments, [
    { type: "text", text: "Um." },
    { type: "image", query: "Mitocôndria", caption: "" },
    { type: "text", text: "Dois." },
    { type: "image", query: "Cloroplasto", caption: "" },
    { type: "text", text: "Três e o ribossomo." },
  ]);
});

test("o teto continua ajustavel para quem so quer uma foto", () => {
  const segments = splitMessageMedia("Um.\n[[imagem: Mitocôndria]]\nDois.\n[[imagem: Cloroplasto]]", { limit: 1 });
  assert.deepEqual(
    segments.filter((item) => item.type === "image").map((item) => item.query),
    ["Mitocôndria"],
  );
});

test("termo escrito como pedido vira o nome do assunto", () => {
  assert.deepEqual(splitMessageMedia("Texto.\n[[imagem: uma foto de Nikola Tesla]]")[1], {
    type: "image",
    query: "Nikola Tesla",
    caption: "",
  });
});

test("marcador sem termo util some sem deixar buraco no texto", () => {
  // O espaco duplo que sobra no lugar do marcador tambem e costurado.
  assert.deepEqual(splitMessageMedia("Antes. [[imagem: ]] Depois."), [{ type: "text", text: "Antes. Depois." }]);
});

test("marcador pela metade no streaming nao aparece na tela", () => {
  // O texto chega token a token: sem este corte a pessoa ve "[[imagem: Nik"
  // escrito no meio da resposta ate o marcador fechar.
  for (const parcial of ["Tesla nasceu em 1856. [[", "Tesla nasceu em 1856. [[imagem", "Tesla nasceu em 1856. [[imagem: Nik"]) {
    assert.deepEqual(splitMessageMedia(parcial, { streaming: true }), [{ type: "text", text: "Tesla nasceu em 1856." }]);
  }
});

test("colchete duplo que nao e marcador de imagem sobrevive ao streaming", () => {
  assert.equal(stripPendingMarker("veja a nota [[3"), "veja a nota [[3");
});

test("copiar e salvar levam o texto sem o marcador", () => {
  const resposta = "Tesla foi um inventor.\n\n[[imagem: Nikola Tesla | O inventor da corrente alternada]]\n\nEle morreu em 1943.";
  assert.equal(stripImageMarkers(resposta), "Tesla foi um inventor.\n\nEle morreu em 1943.");
  assert.equal(hasImageMarker(resposta), true);
  assert.equal(hasImageMarker("Tesla foi um inventor."), false);
});

test("sinonimos que o modelo inventa viram foto em vez de vazar na tela", () => {
  for (const marcador of ["[[foto: Coliseu]]", "[[imagens: Coliseu]]", "[[image: Coliseu]]"]) {
    const segments = splitMessageMedia(`Roma antiga. ${marcador}`);
    assert.equal(segments.at(-1)?.type, "image", `deveria virar imagem: ${marcador}`);
  }
});

test("texto sem marcador nenhum continua sendo um pedaco so", () => {
  assert.deepEqual(splitMessageMedia("Uma resposta comum, sem foto."), [
    { type: "text", text: "Uma resposta comum, sem foto." },
  ]);
  assert.deepEqual(splitMessageMedia(""), []);
});

test("pedido explícito de imagem liga a busca mesmo com o modo fotos desligado", async () => {
  const { asksForImage } = await import("../shared/chat-media.mjs");
  for (const pedido of [
    "poderia me mandar foto de uma planilha simples no exel?",
    "mostra uma imagem de uma célula animal",
    "quero ver uma foto do Machu Picchu",
    "tem algum print do scratch?",
  ]) {
    assert.equal(asksForImage(pedido), true, pedido);
  }
  for (const outro of ["o que tem nessa foto que eu mandei?", "analise a imagem que enviei", "a foto ficou boa?", "explique fotossíntese"]) {
    assert.equal(asksForImage(outro), false, outro);
  }
});

test("busca de imagem descritiva vai para a web; nome próprio vai para a Wikipédia", async () => {
  const { isDescriptiveImageQuery } = await import("../education-server.mjs");
  assert.equal(isDescriptiveImageQuery("planilha simples no Excel"), true);
  assert.equal(isDescriptiveImageQuery("esquema das fases da mitose"), true);
  assert.equal(isDescriptiveImageQuery("tela do Scratch com blocos de código"), true);
  assert.equal(isDescriptiveImageQuery("Nikola Tesla"), false);
  assert.equal(isDescriptiveImageQuery("Microsoft Excel"), false);
  assert.equal(isDescriptiveImageQuery("Machu Picchu"), false);
});
