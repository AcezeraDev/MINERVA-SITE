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

// --- Palavras perdidas no código (out/2026: "erate" no CSS, "researcher" no JS) ---

const FENCE = "```";

/** Site bom, no estilo do que as skills pedem: three.js por importmap, GSAP por CDN. */
const goodSite = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Planeta</title>
<style>
  /* tema */
  :root {
    --bg: #0b0b12;
    --fg: #f4f4f4;
  }
  html,
  body
  {
    margin: 0;
    background: var(--bg);
    font-family:
      Inter,
      system-ui,
      sans-serif;
  }
  h1, h2 { color: var(--fg); }
  @keyframes sobe {
    from
    { opacity: 0; }
    to { opacity: 1; }
  }
  @media (max-width: 600px) {
    .card { padding: 12px; }
  }
</style>
<script type="importmap">
{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/" } }
</script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
</head>
<body>
<h1>Planeta</h1>
<canvas id="c"></canvas>
<script type="module">
import * as THREE from "three";
import {
  OrbitControls
} from "three/addons/controls/OrbitControls.js";

const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
const controls = new OrbitControls(camera, canvas);
const planeta = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 48), new THREE.MeshStandardMaterial({ color: 0x66ccaa }));
scene.add(planeta);
const texture = await new THREE.TextureLoader().loadAsync(new URL("./mapa.png", import.meta.url).href).catch(() => null);
function animar() {
  planeta.rotation.y += 0.01;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animar);
}
animar();
</script>
<script>
  class Contador {
    total = 0;
    somar() {
      this.total += 1;
      return this.total;
    }
  }
  const contador = new Contador();
  const estado = {
    contador
  };
  const html = \`
    <p>
      Bem-vindo
    </p>\`;
  gsap.from("h1", { y: 40, opacity: 0, duration: 1 });
  document.body.insertAdjacentHTML("beforeend", html);
  console.log(estado.contador.somar());
</script>
</body>
</html>`;

const reply = (code, lang = "html") => `Pronto! Fiz o site do planeta.\n\n${FENCE}${lang}\n${code}\n${FENCE}\n\n- gire o planeta com o mouse`;

test("MineCode: site bom com three.js (importmap) e GSAP passa no controle de qualidade", async () => {
  const { mineCodeIssues } = await import("../mine/quality.mjs");
  assert.deepEqual(mineCodeIssues(reply(goodSite)), { issue: "", strayLines: [], syntax: "" });
  assert.equal(replyQualityIssue({ task: "minecode", reply: reply(goodSite) }), "");
  // Python não é conferido, e resposta só de explicação também passa.
  assert.equal(replyQualityIssue({ task: "minecode", reply: reply("print('oi')\nresearcher", "python") }), "");
  assert.equal(replyQualityIssue({ task: "minecode", reply: "Uma lista guarda vários valores." }), "");
  // JS puro com import/export e await de topo também passa.
  const js = "import { a } from './a.js';\nexport const b = await a();\nexport default b;\nconsole.log(b);";
  assert.equal(replyQualityIssue({ task: "minecode", reply: reply(js, "javascript") }), "");
});

test("MineCode: 'erate' solto no CSS e 'researcher' solto no JS são barrados", async () => {
  const { mineCodeIssues } = await import("../mine/quality.mjs");
  const css = goodSite.replace("    margin: 0;\n", "    margin: 0;\n    erate\n");
  const cssIssue = mineCodeIssues(reply(css));
  assert.match(cssIssue.issue, /"erate"/);
  assert.equal(css.split("\n")[cssIssue.strayLines[0] - 1].trim(), "erate");

  const js = goodSite.replace("scene.add(planeta);\n", "scene.add(planeta);\nresearcher\n");
  const jsIssue = mineCodeIssues(reply(js));
  assert.match(jsIssue.issue, /"researcher"/);
  assert.equal(js.split("\n")[jsIssue.strayLines[0] - 1].trim(), "researcher");

  // No meio de um objeto a palavra quebra a sintaxe: o parser pega.
  const broken = goodSite.replace("  const estado = {\n    contador\n  };", "  const estado = {\n    contador\n    researcher: 1 erate\n  };");
  assert.match(replyQualityIssue({ task: "minecode", reply: reply(broken) }), /erro de sintaxe/);
  assert.match(replyQualityIssue({ task: "minecode", reply: reply("const a = 1\nconst b = a researcher;", "javascript") }), /sintaxe/);
});

test("MineCode: as linhas da palavra solta saem sem outra chamada; erro de sintaxe não tem conserto local", async () => {
  const { repairMineCode, mineCodeIssues } = await import("../mine/quality.mjs");
  const both = goodSite.replace("    margin: 0;\n", "    margin: 0;\n    erate\n").replace("scene.add(planeta);\n", "scene.add(planeta);\nresearcher\n");
  const fixed = repairMineCode(reply(both));
  assert.equal(fixed, reply(goodSite));
  assert.equal(mineCodeIssues(fixed).issue, "");
  const broken = goodSite.replace("scene.add(planeta);", "scene.add(planeta) researcher;");
  assert.equal(repairMineCode(reply(broken)), "");
});

// Fluxo no router: o MineCode chega ao vivo (streaming) e o "done" substitui tudo.

const NANO_ENV = ["NANOGPT_API_KEY", "NANOGPT_API_KEYS", "NANOGPT_BASE_URL", "NANOGPT_MODEL", "NANOGPT_CODE_MODEL", "MINE_WEB_SEARCH", "MINE_WEB_TOOL"];

async function withNano(fetchImpl, fn) {
  const previousFetch = globalThis.fetch;
  const previousEnv = Object.fromEntries(NANO_ENV.map((name) => [name, process.env[name]]));
  for (const name of NANO_ENV) delete process.env[name];
  Object.assign(process.env, { NANOGPT_API_KEY: "nano_minecode_teste", MINE_WEB_SEARCH: "off", MINE_WEB_TOOL: "off" });
  globalThis.fetch = fetchImpl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = previousFetch;
    for (const name of NANO_ENV) {
      if (previousEnv[name] === undefined) delete process.env[name];
      else process.env[name] = previousEnv[name];
    }
  }
}

function sseResponse(text) {
  const events = [...text.match(/[\s\S]{1,200}/g).map((piece) => ({ choices: [{ delta: { content: piece } }] })), { choices: [{ delta: {}, finish_reason: "stop" }] }];
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function jsonReply(text) {
  return new Response(JSON.stringify({ choices: [{ message: { content: text }, finish_reason: "stop" }] }), { status: 200, headers: { "content-type": "application/json" } });
}

test("MineCode no router: palavra solta é tirada na hora, sem chamar outro modelo", async () => {
  const { runMineRequest } = await import("../mine/router.mjs");
  const calls = [];
  const stray = goodSite.replace("    margin: 0;\n", "    margin: 0;\n    erate\n");
  await withNano(async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return sseResponse(reply(stray));
  }, async () => {
    let streamed = "";
    const result = await runMineRequest({ task: "minecode", prompt: "faz um planeta 3d", onDelta: (text) => { streamed += text; } });
    assert.equal(streamed, reply(stray));
    assert.equal(result.reply, reply(goodSite));
  });
  assert.equal(calls.length, 1);
});

test("MineCode no router: erro de sintaxe depois do streaming é refeito pelo gpt-6-luna sem streaming", async () => {
  const { runMineRequest } = await import("../mine/router.mjs");
  const calls = [];
  const broken = goodSite.replace("scene.add(planeta);", "scene.add(planeta) researcher;");
  await withNano(async (_url, options) => {
    const body = JSON.parse(options.body);
    calls.push(body);
    return body.stream ? sseResponse(reply(broken)) : jsonReply(reply(goodSite));
  }, async () => {
    let streamed = "";
    const result = await runMineRequest({ task: "minecode", prompt: "faz um planeta 3d", onDelta: (text) => { streamed += text; } });
    assert.equal(streamed, reply(broken));
    assert.equal(result.reply, reply(goodSite));
  });
  assert.deepEqual(calls.map((call) => [call.model, Boolean(call.stream)]), [["z-ai/glm-5.3-flash", true], ["openai/gpt-6-luna", false]]);
  assert.match(JSON.stringify(calls[1].messages), /versao anterior deste arquivo saiu com defeito/);
});

test("MineCode no router: se ninguém refizer, o aluno recebe a primeira versão em vez de um erro", async () => {
  const { runMineRequest } = await import("../mine/router.mjs");
  const broken = goodSite.replace("scene.add(planeta);", "scene.add(planeta) researcher;");
  await withNano(async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.stream) return sseResponse(reply(broken));
    return new Response(JSON.stringify({ error: { message: "bad request" } }), { status: 400, headers: { "content-type": "application/json" } });
  }, async () => {
    const result = await runMineRequest({ task: "minecode", prompt: "faz um planeta 3d", onDelta: () => {} });
    assert.equal(result.reply, reply(broken));
  });
});
