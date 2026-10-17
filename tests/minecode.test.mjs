import test from "node:test";
import assert from "node:assert/strict";

import { isSitePage, mineCodeLanguage, runnableLanguage } from "../shared/code-run.mjs";
import { buildSystemInstruction, buildLanguageChatInstruction } from "../mine/prompts.mjs";
import { languageCorrectionIssue, replyQualityIssue } from "../mine/quality.mjs";

const page = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Loja</title><style>body{margin:0}</style></head>
<body><main><h1>Olá, mundo!</h1><p>Minha primeira página.</p></main></body></html>`;

test("página HTML completa vira prévia; trecho solto de tag continua código", () => {
  assert.equal(isSitePage(page, "html"), true);
  assert.equal(isSitePage("<p>oi</p>", "html"), false);
  assert.equal(isSitePage(page, "python"), false);
  const sem = `<style>.card{padding:20px;border-radius:12px;background:#eee;font-family:system-ui}</style>
<div class="card"><h2>Cartão</h2><p>Sem doctype, mas com estilo e estrutura de página.</p></div>`;
  assert.equal(isSitePage(sem, "html"), true);
});

test("linguagens que rodam e as da aba MineCode", () => {
  assert.equal(runnableLanguage("Python"), "python");
  assert.equal(runnableLanguage("js"), "javascript");
  assert.equal(runnableLanguage("java"), null);
  assert.equal(mineCodeLanguage("html"), "html");
  assert.equal(mineCodeLanguage("py"), "python");
  assert.equal(mineCodeLanguage("css"), null);
});

test("o chat manda a Mine entregar site em HTML completo e nunca em ASCII", () => {
  const prompt = buildSystemInstruction("");
  assert.match(prompt, /UM arquivo HTML completo/);
  assert.match(prompt, /NUNCA desenhe a pagina em ASCII/);
  assert.match(prompt, /MineCode/);
  assert.match(prompt, /botao Executar/);
});

test("correção do roleplay que troca 'I' por 'you' é recusada", () => {
  const reply = (correction) => `MINE: Oh, you're from Brazil!\nCORRECAO: ${correction}\nNOTA: 1`;
  assert.notEqual(languageCorrectionIssue("i from brazil, sao paulo", reply("You are from Brazil, São Paulo.")), "");
  assert.equal(languageCorrectionIssue("i from brazil, sao paulo", reply("I'm from Sao Paulo, Brazil.")), "");
  assert.equal(languageCorrectionIssue("[COMECAR]", reply("OK")), "");
  assert.equal(languageCorrectionIssue("is very expensive", reply("It is very expensive.")), "");
  assert.notEqual(replyQualityIssue({ task: "idioma-conversa", prompt: "my name is davi", reply: reply("Your name is Davi.") }), "");
});

test("o roleplay proíbe a Mine de falar as frases do aluno e traz um exemplo completo", () => {
  const prompt = buildLanguageChatInstruction("ctx");
  assert.match(prompt, /Nunca fale as frases que sao do estudante/);
  assert.match(prompt, /nunca vira "You are/);
  assert.match(prompt, /Exemplo \(parada do aeroporto/);
});

test("chat do MineCode: separa explicação e código, inclusive com o bloco ainda chegando", async () => {
  const { readCodeReply } = await import("../shared/code-run.mjs");
  const fence = "```";
  const full = readCodeReply(["Pronto! Fiz a calculadora.", "", `${fence}python`, "a = 1", "print(a)", fence, "", "- digite os números em Entradas"].join("\n"));
  assert.equal(full.lang, "python");
  assert.equal(full.code, "a = 1\nprint(a)\n");
  assert.equal(full.open, false);
  assert.match(full.explanation, /Pronto!/);
  assert.match(full.explanation, /Entradas/);
  assert.doesNotMatch(full.explanation, /print/);

  const partial = readCodeReply(["Escrevendo o site…", `${fence}html`, "<!doctype html>", "<h1>Oi"].join("\n"));
  assert.equal(partial.lang, "html");
  assert.equal(partial.open, true);
  assert.equal(partial.code, "<!doctype html>\n<h1>Oi");

  assert.equal(readCodeReply("Uma lista guarda vários valores.").lang, null);
  // bloco de saída (text) não conta; vale o último bloco que roda
  const two = readCodeReply([`${fence}text`, "erro", fence, `${fence}js`, "console.log(1)", fence].join("\n"));
  assert.equal(two.lang, "javascript");
});

test("o prompt do MineCode exige o arquivo completo e respeita o que roda no navegador", async () => {
  const { buildInstructionForTask } = await import("../mine/prompts.mjs");
  const prompt = buildInstructionForTask("minecode", "Linguagem aberta no editor: Python");
  assert.match(prompt, /ARQUIVO COMPLETO/);
  assert.match(prompt, /nada de tkinter/);
  assert.match(prompt, /Linguagem aberta no editor: Python/);
});

test("skills do MineCode: entram só quando o pedido pede site, animação ou 3D", async () => {
  const { pickCodeSkills } = await import("../mine/minecode-skills.mjs");
  const { buildInstructionForTask } = await import("../mine/prompts.mjs");
  const py = "Linguagem aberta no editor: Python (arquivo main.py).";
  const html = "Linguagem aberta no editor: HTML (arquivo index.html).";
  assert.deepEqual(pickCodeSkills({ prompt: "faz um jogo da forca com menu", context: py }), []);
  assert.deepEqual(pickCodeSkills({ prompt: "o que é uma lista?", context: py }), []);
  assert.deepEqual(pickCodeSkills({ prompt: "faz um site de padaria", context: py }), ["frontend"]);
  assert.deepEqual(pickCodeSkills({ prompt: "coloca animações bonitas", context: html }), ["frontend", "motion"]);
  assert.deepEqual(pickCodeSkills({ prompt: "cria um sistema solar em 3D", context: py }), ["frontend", "motion", "three"]);
  // arquivo que já usa three.js continua 3D no pedido seguinte
  const threeCode = `${html}\nimport * as THREE from "three";`;
  assert.deepEqual(pickCodeSkills({ prompt: "deixa mais rápido", context: threeCode }), ["frontend", "motion", "three"]);
  // a fala anterior do estudante também conta
  assert.ok(pickCodeSkills({ prompt: "muda a cor", context: py, history: [{ role: "user", text: "faz um cubo girando" }] }).includes("three"));

  const pyPrompt = buildInstructionForTask("minecode", py, { prompt: "soma dois números" });
  assert.doesNotMatch(pyPrompt, /SKILL/);
  const threePrompt = buildInstructionForTask("minecode", py, { prompt: "planeta 3d girando" });
  assert.match(threePrompt, /SKILL 3D/);
  assert.match(threePrompt, /three@0\.170\.0/);
  assert.match(threePrompt, /SKILL FRONT-END/);
  assert.ok(threePrompt.indexOf("SKILL") < threePrompt.indexOf("Contexto:"));
});
