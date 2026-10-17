import test from "node:test";
import assert from "node:assert/strict";
import {
  asksForImage,
  asksToGenerateImage,
  continuesGeneration,
  describeImageMarkers,
  splitMessageMedia,
  stripImageMarkers,
  stripPendingMarker,
} from "../shared/chat-media.mjs";

test("pedidos de criar imagem são reconhecidos", () => {
  for (const text of [
    "cria uma imagem de um gato astronauta",
    "gera uma foto de um dragão de cristal",
    "faz um desenho da célula animal pra mim",
    "desenha um robô estudando",
    "crie um logo para o meu grupo de estudos",
    "pode criar um wallpaper do sistema solar?",
    "faça uma ilustração da fotossíntese",
    "gere um cartaz sobre a dengue",
  ]) {
    assert.equal(asksToGenerateImage(text), true, text);
  }
});

test("busca de foto e pedidos de texto não viram criação", () => {
  for (const text of [
    "manda uma foto do Einstein",
    "mostra imagens da Torre Eiffel",
    "faz um resumo de fotossíntese",
    "cria uma lista de exercícios de frações",
    "o que tem nessa imagem que eu mandei?",
    "o que é fotossíntese?",
  ]) {
    assert.equal(asksToGenerateImage(text), false, text);
  }
  assert.equal(asksForImage("manda uma foto do Einstein"), true);
});

test("o marcador de criação vira um pedaço próprio, um por resposta", () => {
  const text = "Aqui está!\n[[gerar_imagem: a cute cat astronaut floating in space, watercolor | Gato astronauta]]\nGostou?\n[[gerar_imagem: second | extra]]";
  const segments = splitMessageMedia(text);
  assert.deepEqual(
    segments.map((segment) => segment.type),
    ["text", "generate", "text"],
  );
  const generated = segments.find((segment) => segment.type === "generate");
  assert.equal(generated.prompt, "a cute cat astronaut floating in space, watercolor");
  assert.equal(generated.caption, "Gato astronauta");
  assert.equal(generated.edit, false);
  assert.equal(stripImageMarkers(text).includes("gerar_imagem"), false);
});

test("o terceiro campo editar liga a edição da imagem anterior", () => {
  const [segment] = splitMessageMedia("[[gerar_imagem: same cat, blue background | Fundo azul | editar]]");
  assert.equal(segment.type, "generate");
  assert.equal(segment.edit, true);
});

test("marcador de criação pela metade some durante o streaming", () => {
  assert.equal(stripPendingMarker("Vou desenhar.\n[[gerar_im"), "Vou desenhar.\n");
  assert.equal(stripPendingMarker("Vou desenhar.\n[[gerar_imagem: a cat in"), "Vou desenhar.\n");
});

test("o histórico lembra a imagem criada e a continuação vira edição", () => {
  const note = describeImageMarkers("Pronto!\n[[gerar_imagem: a cat astronaut | Gato]]");
  assert.match(note, /\(imagem criada pela Mine: a cat astronaut\)/);
  const history = [
    { role: "user", text: "cria um gato astronauta" },
    { role: "assistant", text: note },
  ];
  assert.equal(continuesGeneration("deixa o fundo azul", history), "a cat astronaut");
  assert.equal(continuesGeneration("agora em estilo anime", history), "a cat astronaut");
  assert.equal(continuesGeneration("quem foi Einstein?", history), "");
  assert.equal(continuesGeneration("deixa o fundo azul", [{ role: "assistant", text: "Oi" }]), "");
});

test("o pedido ao modelo de imagem segue o formato de cada família", async () => {
  const { requestBody, cleanPrompt } = await import("../mine/image-gen.mjs");
  const flux = requestBody({ model: "blackforestlabs/flux-3/klein/text-to-image", prompt: "a cat" });
  assert.equal(flux.size, "1024x1024");
  assert.equal(flux.imageDataUrl, undefined);
  const qwenEdit = requestBody({ model: "qwen-image-2.1/edit", prompt: "a cat", reference: "data:image/png;base64,AAAA" });
  assert.equal(qwenEdit.resolution, "1k");
  assert.equal(qwenEdit.aspect_ratio, "auto");
  assert.equal(qwenEdit.imageDataUrl, "data:image/png;base64,AAAA");
  assert.equal(cleanPrompt("  diagram of sexual reproduction in flowers  "), "diagram of sexual reproduction in flowers");
  assert.throws(() => cleanPrompt("naked person"), /não pode criar/);
  assert.throws(() => cleanPrompt("a"), /Descreva/);
});

test("imagem com letra legível vai para o modelo que escreve bem", async () => {
  const { needsLegibleText } = await import("../mine/image-gen.mjs");
  assert.equal(needsLegibleText('A school poster with the title "Ciclo da Agua", flat vector'), true);
  assert.equal(needsLegibleText("An Excel spreadsheet with sales data"), true);
  assert.equal(needsLegibleText("Diagram of a plant cell with labels"), true);
  assert.equal(needsLegibleText("A cute cat astronaut among planets, watercolor, no text"), false);
  assert.equal(needsLegibleText("A robot studying at a wooden desk"), false);
});
