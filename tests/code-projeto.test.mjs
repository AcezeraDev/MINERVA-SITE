import test from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { asksForCode } from "../shared/code-intent.mjs";
import { buildPreviewHtml, parseProject, safePath, slug } from "../shared/projeto.mjs";
import { crc32, makeZip } from "../shared/zip.mjs";
import { MINE_CODE_MODEL } from "../mine/models.mjs";
import { buildCodeInstruction } from "../mine/prompts.mjs";

test("pedido de código: site, python e outros", () => {
  assert.equal(asksForCode("faz um site de portfolio pra mim"), "site");
  assert.equal(asksForCode("cria uma landing page para uma padaria"), "site");
  assert.equal(asksForCode("Faça um jogo da cobrinha"), "site");
  assert.equal(asksForCode("quero uma calculadora de IMC"), "site");
  assert.equal(asksForCode("cria uma página html sobre o sistema solar"), "site");
  assert.equal(asksForCode("faz um programa em python que calcula a media"), "python");
  assert.equal(asksForCode("escreve um código em python de jogo da forca"), "python");
  assert.equal(asksForCode("me da um codigo em java de bubble sort"), "codigo");
  assert.equal(asksForCode("cria um algoritmo de busca binaria"), "codigo");
});

test("conversa não vira pedido de código", () => {
  for (const prompt of [
    "o que é HTML?",
    "como funciona um for em python?",
    "me explica esse código",
    "faz um resumo sobre a função do fígado",
    "faz um programa de estudos para o enem",
    "o que diz o código civil sobre herança?",
    "faz uma simulação de prova de matemática",
    "qual a diferença entre java e python",
    "cria um mapa mental de citologia",
  ]) {
    assert.equal(asksForCode(prompt), "", prompt);
  }
});

test("ajuste logo depois de um projeto continua no modo código", () => {
  const history = [
    { role: "user", text: "faz um site de receitas" },
    { role: "assistant", text: "Pronto!\n````projeto\n=== arquivo: index.html ===\n<!doctype html>\n````" },
  ];
  assert.equal(asksForCode("muda a cor do botão para azul", history), "site");
  assert.equal(asksForCode("coloca um modo escuro", history), "site");
  assert.equal(asksForCode("obrigado!", history), "");
  assert.equal(asksForCode("muda a cor do botão para azul"), "");
  const python = [{ role: "assistant", text: "```python\nprint(1)\n```" }];
  assert.equal(asksForCode("adiciona um placar", python), "python");
});

const SAMPLE = `=== projeto: Quiz de Biologia ===
=== arquivo: index.html ===
<!doctype html>
<html><head><title>Quiz</title><link rel="stylesheet" href="style.css"></head>
<body><main id="app"></main><script src="./js/app.js"></script></body></html>
=== arquivo: style.css ===
body { color: red; }
=== arquivo: js/app.js ===
console.log("</script> dentro de string");
=== arquivo: README.md ===
Abra o index.html.`;

test("lê o projeto com vários arquivos", () => {
  const project = parseProject(SAMPLE);
  assert.equal(project.name, "Quiz de Biologia");
  assert.equal(project.kind, "site");
  assert.equal(project.entry, "index.html");
  assert.deepEqual(project.files.map((file) => file.path), ["index.html", "style.css", "js/app.js", "README.md"]);
  assert.equal(project.files[2].language, "javascript");
  assert.ok(project.files.every((file) => !file.writing));
});

test("bloco chegando marca o último arquivo como em escrita", () => {
  const project = parseProject("=== arquivo: main.py ===\nprint('oi')\n=== arquivo: util.py ===\ndef f(", { open: true });
  assert.equal(project.kind, "python");
  assert.equal(project.entry, "main.py");
  assert.equal(project.files[0].writing, false);
  assert.equal(project.files[1].writing, true);
});

test("projeto separado por cercas (sem marcadores) também é lido", () => {
  const code = [
    "```html",
    '<!doctype html><html><head><link rel="stylesheet" href="style.css"></head><body><script src="script.js"></script></body></html>',
    "```",
    "",
    "**dados.js**",
    "```javascript",
    "const x = 1;",
    "```",
    "```css",
    "body{}",
    "```",
    "```javascript",
    "console.log(x);",
    "```",
  ].join("\n");
  const project = parseProject(code);
  assert.deepEqual(project.files.map((file) => file.path), ["index.html", "dados.js", "style.css", "script.js"]);
  assert.equal(project.kind, "site");
  const html = buildPreviewHtml(project.files, project.entry);
  assert.match(html, /data-arquivo="style.css"/);
  assert.match(html, /data-arquivo="script.js"/);
});

test("a prévia junta CSS e JS dentro do HTML", () => {
  const project = parseProject(SAMPLE);
  const html = buildPreviewHtml(project.files, project.entry);
  assert.match(html, /<style data-arquivo="style.css">\s*body \{ color: red; \}/);
  assert.match(html, /<script data-arquivo="js\/app.js">/);
  assert.match(html, /<\\\/script> dentro de string/);
  assert.doesNotMatch(html, /href="style.css"/);
});

test("caminhos perigosos ficam dentro do projeto", () => {
  assert.equal(safePath("../../etc/passwd"), "etc/passwd");
  assert.equal(safePath("/abs/index.html"), "abs/index.html");
  assert.equal(safePath("C:\\Windows\\x.js"), "C/Windows/x.js");
  assert.equal(slug("Portfólio da Ana!"), "portfolio-da-ana");
});

test("o .zip abre e guarda os arquivos certos", () => {
  const zip = makeZip([
    { path: "site/index.html", content: "<h1>Olá</h1>" },
    { path: "site/style.css", content: "h1{}" },
  ]);
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  // fim do diretório central: 2 arquivos
  const end = zip.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 10, true), 2);
  // primeiro arquivo: nome e conteúdo e CRC conferem
  const nameLength = view.getUint16(26, true);
  const name = new TextDecoder().decode(zip.slice(30, 30 + nameLength));
  assert.equal(name, "site/index.html");
  const size = view.getUint32(18, true);
  const data = zip.slice(30 + nameLength, 30 + nameLength + size);
  assert.equal(new TextDecoder().decode(data), "<h1>Olá</h1>");
  assert.equal(view.getUint32(14, true), crc32(data));
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  assert.ok(inflateRawSync); // sem compressão: nada a inflar
});

test("modelo de código é o GLM-5.3 Flash com esforço aceito", () => {
  const previous = process.env.NANOGPT_CODE_MODEL;
  delete process.env.NANOGPT_CODE_MODEL;
  assert.equal(MINE_CODE_MODEL.providerModel, "z-ai/glm-5.3-flash");
  assert.ok(["low", "high", "max"].includes(MINE_CODE_MODEL.providerParams.reasoning_effort));
  if (previous !== undefined) process.env.NANOGPT_CODE_MODEL = previous;
});

test("instrução de código pede o bloco projeto e o modo designer", () => {
  const text = buildCodeInstruction("site");
  assert.match(text, /````projeto/);
  assert.match(text, /=== arquivo: index.html ===/);
  assert.match(text, /MODO DESIGNER/);
  assert.match(text, /prefers-reduced-motion/);
});

test("cerca com o nome do projeto na mesma linha vira bloco projeto", async () => {
  const { parseBlocks } = await import("../shared/chat-markdown.mjs");
  const text = ["Pronto!", "", "````projeto: Memória dos Animais", "=== arquivo: index.html ===", "<!doctype html>", "````", "", "Divirta-se."].join("\n");
  const block = parseBlocks(text).find((item) => item.type === "code");
  assert.equal(block.lang, "projeto");
  assert.equal(block.open, false);
  const project = parseProject(block.code);
  assert.equal(project.name, "Memória dos Animais");
  assert.deepEqual(project.files.map((file) => file.path), ["index.html"]);
});
