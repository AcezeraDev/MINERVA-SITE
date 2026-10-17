import test from "node:test";
import assert from "node:assert/strict";

import { redactSecrets } from "../mine/env.mjs";
import { buildMessages, MAX_HISTORY_MESSAGES, MAX_PROMPT_CHARS } from "../mine/messages.mjs";
import { MAX_PROMPT_LENGTH, validateChatPayload } from "../mine/limits.mjs";
import { buildFlashcardsInstruction, buildQuizInstruction, buildSystemInstruction } from "../mine/prompts.mjs";
import { parseBlocks } from "../shared/chat-markdown.mjs";
import { xpPerAction } from "../shared/xp.mjs";
import { MINE_FAST_MODEL, MINE_MODEL, MINE_TASK_MODEL } from "../mine/models.mjs";
import { callProvider, nanogptApiUrl, parseProviderKeys } from "../mine/providers.mjs";
import { replyQualityIssue } from "../mine/quality.mjs";
import { cleanReply, runMineRequest } from "../mine/router.mjs";
import { buildSearchQuery, matchesSourceScope, normalizeSearchPayload, searchSourcePolicy, shouldSearchWeb } from "../mine/web.mjs";

const NANO_ENV = ["NANOGPT_API_KEY", "NANOGPT_API_KEYS", "NANOGPT_BASE_URL", "NANOGPT_MODEL", "MINE_WEB_SEARCH", "MINE_WEB_SEARCH_AUTO", "MINE_WEB_READ_PAGES", "MINE_WEB_TOOL"];

/** Roda `fn` com as variaveis da NanoGPT trocadas e o fetch substituido. */
async function withNano(env, fetchImpl, fn) {
  const previousFetch = globalThis.fetch;
  const previousEnv = Object.fromEntries(NANO_ENV.map((name) => [name, process.env[name]]));
  for (const name of NANO_ENV) delete process.env[name];
  Object.assign(process.env, env);
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

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

test("pool de chaves separa, limpa e remove duplicatas", () => {
  assert.deepEqual(parseProviderKeys(" a , b;b\nc ", "b", "cole-sua-chave-aqui"), ["a", "b", "c"]);
});

test("a Mine tem um modelo so, gpt-6-luna na NanoGPT, com reserva interna", () => {
  const previous = process.env.NANOGPT_MODEL;
  delete process.env.NANOGPT_MODEL;
  try {
    assert.equal(MINE_MODEL.provider, "nanogpt");
    assert.equal(MINE_MODEL.providerModel, "openai/gpt-6-luna");
    assert.equal(MINE_TASK_MODEL.providerModel, "openai/gpt-6-luna");
    assert.equal(MINE_TASK_MODEL.providerParams.reasoning_effort, "low");
    assert.equal(MINE_FAST_MODEL.provider, "nanogpt");
  } finally {
    if (previous !== undefined) process.env.NANOGPT_MODEL = previous;
  }
});

test("NanoGPT usa Bearer, endpoint v1 e nao manda temperatura", async () => {
  let captured;
  await withNano(
    { NANOGPT_API_KEY: "nano-chave-teste-123" },
    async (url, options) => {
      captured = { url, headers: options.headers, body: JSON.parse(options.body) };
      return jsonResponse({ choices: [{ message: { content: "Resposta NanoGPT" } }] });
    },
    async () => {
      const result = await callProvider({
        provider: "nanogpt",
        providerModel: "openai/gpt-6-luna",
        providerParams: { reasoning_effort: "medium" },
        messages: [{ role: "user", content: "oi" }],
        maxTokens: 900,
        timeoutMs: 2_000,
      });
      assert.equal(result.content, "Resposta NanoGPT");
    },
  );
  assert.equal(captured.url, "https://nano-gpt.com/api/v1/chat/completions");
  assert.equal(captured.headers.authorization, "Bearer nano-chave-teste-123");
  assert.equal(captured.body.model, "openai/gpt-6-luna");
  assert.equal(captured.body.max_tokens, 900);
  assert.equal(captured.body.temperature, undefined);
  assert.equal(captured.body.top_p, undefined);
  assert.equal(captured.body.reasoning_effort, "medium");
});

test("endpoint de busca fica na mesma origem da API", async () => {
  await withNano({ NANOGPT_BASE_URL: "https://api.nano-gpt.com/api/v1/" }, globalThis.fetch, async () => {
    assert.equal(nanogptApiUrl("web"), "https://api.nano-gpt.com/api/web");
  });
});

test("uma chave limitada entra em cooldown e a proxima assume", async () => {
  const authorizations = [];
  await withNano(
    { NANOGPT_API_KEYS: "nano_limitada_1,nano_reserva_2" },
    async (_url, options) => {
      authorizations.push(options.headers.authorization);
      if (authorizations.length === 1) return jsonResponse({ error: { message: "rate limit" } }, 429, { "retry-after": "30" });
      return jsonResponse({ choices: [{ message: { content: "Resposta completa" }, finish_reason: "stop" }], usage: { total_tokens: 8 } });
    },
    async () => {
      const request = { provider: "nanogpt", providerModel: "modelo-teste", messages: [{ role: "user", content: "oi" }], timeoutMs: 2_000 };
      await assert.rejects(callProvider(request), (error) => error?.code === "rate_limit");
      const result = await callProvider(request);
      assert.equal(result.content, "Resposta completa");
    },
  );
  assert.match(authorizations[0], /nano_limitada_1/);
  assert.match(authorizations[1], /nano_reserva_2/);
});

test("roteador repete o mesmo modelo com a segunda chave dentro do pedido", async () => {
  const models = [];
  await withNano(
    { NANOGPT_API_KEYS: "nano_router_limitada,nano_router_reserva", MINE_WEB_SEARCH: "off" },
    async (_url, options) => {
      models.push(JSON.parse(options.body).model);
      if (models.length === 1) return jsonResponse({ error: { message: "rate limit" } }, 429);
      return jsonResponse({ choices: [{ message: { content: "Resposta completa e correta." } }] });
    },
    async () => {
      const result = await runMineRequest({ prompt: "Explique de forma curta o que e DNA." });
      assert.equal(result.reply, "Resposta completa e correta.");
      assert.equal(result.alias, "mine");
    },
  );
  assert.deepEqual(models, ["openai/gpt-6-luna", "openai/gpt-6-luna"]);
});

test("se o principal falha, a reserva interna responde", async () => {
  const models = [];
  await withNano(
    { NANOGPT_API_KEY: "nano_reserva_teste", MINE_WEB_SEARCH: "off" },
    async (_url, options) => {
      models.push(JSON.parse(options.body).model);
      if (models.length === 1) return jsonResponse({ error: { message: "upstream down" } }, 503);
      return jsonResponse({ choices: [{ message: { content: "Resposta da reserva, completa." } }] });
    },
    async () => {
      const result = await runMineRequest({ prompt: "O que e fotossintese?" });
      assert.equal(result.reply, "Resposta da reserva, completa.");
      assert.equal(result.displayName, "Mine");
    },
  );
  assert.deepEqual(models, ["openai/gpt-6-luna", "openai/gpt-5.4-mini"]);
});

test("busca na web injeta resultados numerados e devolve as fontes", async () => {
  const calls = [];
  await withNano(
    { NANOGPT_API_KEY: "nano_web_teste" },
    async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ url, body });
      if (String(url).endsWith("/api/web")) {
        return jsonResponse({
          data: [
            { name: "Calendario do Enem 2026", url: "https://www.gov.br/inep/enem", content: "As provas serao em 8 e 15 de novembro." },
            { name: "Enem 2026 datas", url: "https://g1.globo.com/enem", content: "Datas confirmadas pelo Inep." },
          ],
          metadata: { cost: 0.006 },
        });
      }
      return jsonResponse({ choices: [{ message: { content: "As provas serao em 8 e 15 de novembro [1]." } }] });
    },
    async () => {
      const result = await runMineRequest({ prompt: "Quando e o Enem 2026?", webSearch: true });
      assert.equal(result.sources.length, 2);
      assert.deepEqual(result.sources[0], { url: "https://www.gov.br/inep/enem", title: "Calendario do Enem 2026", domain: "gov.br", snippet: "As provas serao em 8 e 15 de novembro." });
      assert.equal(result.notice, "");
    },
  );
  const search = calls.find((call) => String(call.url).endsWith("/api/web"));
  assert.equal(search.url, "https://nano-gpt.com/api/web");
  assert.equal(search.body.outputType, "searchResults");
  const answer = calls.filter((call) => String(call.url).endsWith("/chat/completions")).at(-1);
  const system = answer.body.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n");
  assert.match(system, /\[1\] Calendario do Enem 2026 \(gov\.br\)/);
});

test("o modelo rapido escreve as consultas e as buscas rodam em paralelo", async () => {
  const queries = [];
  const statuses = [];
  await withNano(
    { NANOGPT_API_KEY: "nano_plano_teste", MINE_WEB_READ_PAGES: "off" },
    async (url, options) => {
      const body = JSON.parse(options.body);
      if (String(url).endsWith("/api/web")) {
        queries.push(body.query);
        return jsonResponse({ data: [{ name: `Resultado ${body.query}`, url: `https://exemplo.com/${queries.length}`, content: "Trecho." }] });
      }
      if (body.model === "openai/gpt-5.4-mini") {
        return jsonResponse({ choices: [{ message: { content: '{"consultas": ["resultado enem 2026 data", "inep divulga notas enem 2026"]}' } }] });
      }
      return jsonResponse({ choices: [{ message: { content: "O resultado sai em janeiro [1][2]." } }] });
    },
    async () => {
      const result = await runMineRequest({ prompt: "vc sabe qnd sai o resultado do enem?", webSearch: true, onStatus: (status) => statuses.push(status) });
      // A terceira busca e o refinamento oficial (nenhum resultado era do Inep).
      assert.equal(result.sources.length, 3);
      assert.deepEqual(result.queries, ["site:gov.br/inep resultado enem 2026 data", "inep divulga notas enem 2026"]);
    },
  );
  // Enem tem orgao oficial: a primeira consulta vira busca dirigida ao Inep.
  assert.deepEqual(queries.slice(0, 2).sort(), ["inep divulga notas enem 2026", "site:gov.br/inep resultado enem 2026 data"]);
  assert.deepEqual(statuses.map((status) => status.stage), ["searching", "reading"]);
});

test("no modo automatico a Mine pede a pesquisa pela ferramenta", async () => {
  const requests = [];
  await withNano(
    { NANOGPT_API_KEY: "nano_ferramenta_teste", MINE_WEB_READ_PAGES: "off" },
    async (url, options) => {
      const body = JSON.parse(options.body);
      if (String(url).endsWith("/api/web")) return jsonResponse({ data: [{ name: "Copa 2026", url: "https://exemplo.com/copa", content: "A final foi em 19 de julho." }] });
      requests.push(body);
      if (requests.length === 1) {
        return jsonResponse({ choices: [{ message: { content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "pesquisar_web", arguments: '{"consultas":["final copa do mundo 2026 placar"]}' } }] }, finish_reason: "tool_calls" }] });
      }
      return jsonResponse({ choices: [{ message: { content: "A final foi em 19 de julho [1]." } }] });
    },
    async () => {
      const result = await runMineRequest({ prompt: "Como foi a final da Copa do Mundo?" });
      assert.equal(result.reply, "A final foi em 19 de julho [1].");
      assert.equal(result.sources[0].url, "https://exemplo.com/copa");
    },
  );
  assert.equal(requests[0].tools[0].function.name, "pesquisar_web");
  assert.equal(requests[1].tools, undefined);
  assert.match(requests[1].messages.map((message) => message.content).join("\n"), /A final foi em 19 de julho/);
});

test("provedor que recusa ferramenta: a mesma pergunta repete sem ela", async () => {
  const requests = [];
  await withNano(
    { NANOGPT_API_KEY: "nano_sem_ferramenta" },
    async (_url, options) => {
      const body = JSON.parse(options.body);
      requests.push(body);
      if (body.tools) return jsonResponse({ error: { message: "tools are not supported" } }, 400);
      return jsonResponse({ choices: [{ message: { content: "Mitose e a divisao celular." } }] });
    },
    async () => {
      const result = await runMineRequest({ prompt: "O que e mitose?" });
      assert.equal(result.reply, "Mitose e a divisao celular.");
    },
  );
  assert.equal(requests.length, 2);
});

test("o prompt do chat leva a data de hoje", async () => {
  let system = "";
  await withNano({ NANOGPT_API_KEY: "nano_data_teste", MINE_WEB_SEARCH: "off" }, async (_url, options) => {
    system = JSON.parse(options.body).messages[0].content;
    return jsonResponse({ choices: [{ message: { content: "Resposta completa." } }] });
  }, async () => {
    await runMineRequest({ prompt: "Quantos dias faltam para o Natal?" });
  });
  assert.match(system, /Hoje e .*\d{4}/);
});

test("falha da busca nao derruba o chat", async () => {
  await withNano(
    { NANOGPT_API_KEY: "nano_web_falha" },
    async (url) => {
      if (String(url).endsWith("/api/web")) return jsonResponse({ error: "sem saldo" }, 402);
      return jsonResponse({ choices: [{ message: { content: "Resposta sem web, completa." } }] });
    },
    async () => {
      const result = await runMineRequest({ prompt: "Noticias de hoje sobre astronomia", webSearch: true });
      assert.equal(result.reply, "Resposta sem web, completa.");
      assert.deepEqual(result.sources, []);
      assert.match(result.notice, /web/);
    },
  );
});

test("busca automatica so em pergunta sobre coisa recente, e nunca em tarefa", async () => {
  await withNano({ NANOGPT_API_KEY: "nano_auto" }, globalThis.fetch, async () => {
    assert.equal(shouldSearchWeb({ prompt: "Explique a mitose" }), false);
    assert.equal(shouldSearchWeb({ prompt: "Quais as noticias de hoje sobre o Enem?" }), true);
    assert.equal(shouldSearchWeb({ prompt: "pesquise na internet sobre buracos negros" }), true);
    assert.equal(shouldSearchWeb({ prompt: "Explique a mitose", requested: true }), true);
    assert.equal(shouldSearchWeb({ prompt: "noticias de hoje", task: "quiz", requested: true }), false);
    process.env.MINE_WEB_SEARCH = "off";
    assert.equal(shouldSearchWeb({ prompt: "noticias de hoje", requested: true }), false);
  });
});

test("pergunta de seguimento curta ganha o contexto da anterior", () => {
  const query = buildSearchQuery("e o segundo colocado?", [{ role: "user", text: "Quem ganhou a Copa do Mundo de 2026?" }]);
  assert.match(query, /Copa do Mundo de 2026/);
  assert.match(query, /segundo colocado/);
  assert.equal(buildSearchQuery("pesquise na internet sobre o telescopio James Webb"), "o telescopio James Webb");
});

test("resultados de busca aceitam formatos diferentes e separam imagens", () => {
  const { results, images } = normalizeSearchPayload({
    data: {
      results: [
        { type: "text", name: "Artigo", url: "https://exemplo.com/a", content: "texto" },
        { type: "text", name: "Repetido", url: "https://exemplo.com/a", content: "texto" },
        { type: "image", name: "Foto do telescopio", url: "https://img.exemplo.com/webb.jpg" },
        { type: "image", name: "Insegura", url: "http://img.exemplo.com/x.jpg" },
        { name: "Sem url" },
      ],
    },
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].domain, "exemplo.com");
  assert.deepEqual(images.map((image) => image.url), ["https://img.exemplo.com/webb.jpg"]);
});

test("imagem da Brave usa imageUrl como arquivo e url como pagina de origem", () => {
  const { images } = normalizeSearchPayload({
    data: [
      {
        type: "image",
        title: "Garrafa Stanley Quencher 887ml",
        url: "https://www.netshoes.com.br/busca/garrafa-stanley",
        imageUrl: "https://imgs.search.brave.com/abc/rs:fit:500:0:1:0/g:ce/xyz",
        source: "netshoes.com.br",
        width: 326,
        height: 326,
      },
    ],
  });
  assert.deepEqual(images, [
    {
      url: "https://imgs.search.brave.com/abc/rs:fit:500:0:1:0/g:ce/xyz",
      // "xyz" nao e um endereco em base64: sem original, fica so a miniatura.
      original: "",
      title: "Garrafa Stanley Quencher 887ml",
      pageUrl: "https://www.netshoes.com.br/busca/garrafa-stanley",
      source: "netshoes.com.br",
      width: 326,
      height: 326,
    },
  ]);
});

test("segredos da NanoGPT nunca aparecem em logs", () => {
  const previous = process.env.NANOGPT_API_KEY;
  process.env.NANOGPT_API_KEY = "1234567890abcdef1234567890abcdef";
  try {
    const text = redactSecrets("sk-nano-abc123def456 gsk_abcdefghijklmnopqrstuvwxyz 1234567890abcdef1234567890abcdef");
    assert.equal(text.includes("sk-nano-abc"), false);
    assert.equal(text.includes("gsk_"), false);
    assert.equal(text.includes("1234567890abcdef"), false);
  } finally {
    if (previous === undefined) delete process.env.NANOGPT_API_KEY;
    else process.env.NANOGPT_API_KEY = previous;
  }
});

test("controle de qualidade rejeita definicao e dica truncadas", () => {
  const pairReply = [
    "TERMO: DNA\nDEFINICAO: C",
    "TERMO: RNA\nDEFINICAO: Atua na expressao genetica",
    "TERMO: Mitose\nDEFINICAO: Gera duas celulas semelhantes",
  ].join("\n\n");
  assert.match(replyQualityIssue({ task: "pares", reply: pairReply, prompt: "Crie 3 pares" }), /incompletos/);

  const hangmanReply = "PALAVRA: TRANSCRITO\nDICA: :";
  assert.match(replyQualityIssue({ task: "forca", reply: hangmanReply, prompt: "Escolha 1 palavra" }), /incompletas/);
});

test("controle de qualidade rejeita pares com frase quebrada", () => {
  const reply = `TERMO: Mitose
DEFINICAO: Divisão celular com duas células-igual`;
  assert.match(replyQualityIssue({ task: "pares", reply, prompt: "Crie 1 par" }), /incompletos/);
});

test("controle de qualidade aceita um lote completo de jogo", () => {
  const reply = [
    "A: O DNA armazena informacao genetica.\nR: V\nEXPLICACAO: O DNA carrega instrucoes hereditarias.",
    "A: A mitose gera quatro celulas diferentes.\nR: F\nEXPLICACAO: A mitose normalmente gera duas celulas semelhantes.",
    "A: O RNA participa da expressao dos genes.\nR: V\nEXPLICACAO: Diferentes tipos de RNA atuam na sintese proteica.",
  ].join("\n\n");
  assert.equal(replyQualityIssue({ task: "vf", reply, prompt: "Gere 3 afirmacoes" }), "");
});

test("controle de qualidade valida desafios de sequência", () => {
  const reply = `PROCESSO: Formação da chuva
PASSO: A água recebe calor e evapora da superfície
PASSO: O vapor sobe e encontra camadas mais frias
PASSO: Pequenas gotas se agrupam formando nuvens densas
PASSO: As gotas pesadas caem em forma de chuva
PORQUE: A mudança de temperatura transforma água líquida em vapor e depois reúne gotas até ocorrer precipitação.`;
  assert.equal(replyQualityIssue({ task: "sequencia", reply, prompt: "Crie 1 processo" }), "");
  assert.match(replyQualityIssue({ task: "sequencia", reply: "PROCESSO: Chuva\nPASSO: Evapora", prompt: "Crie 1 processo" }), /incompletas/);
});

test("historico conserva mais contexto recente sem ultrapassar o limite de mensagens", () => {
  const history = Array.from({ length: 40 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    text: `mensagem-${index}`,
  }));
  const messages = buildMessages({ systemContent: "sistema", history, prompt: "pergunta" });
  const conversation = messages.filter((message) => message.role !== "system").slice(0, -1);
  assert.equal(conversation.length, MAX_HISTORY_MESSAGES);
  assert.equal(conversation[0].content, `mensagem-${40 - MAX_HISTORY_MESSAGES}`);
  assert.equal(conversation.at(-1).content, "mensagem-39");
});

test("mensagens antigas viram um resumo das perguntas ja feitas", () => {
  const history = Array.from({ length: MAX_HISTORY_MESSAGES + 6 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    text: index % 2 ? "resposta longa" : `pergunta antiga ${index}`,
  }));
  const messages = buildMessages({ systemContent: "sistema", history, prompt: "pergunta" });
  const summary = messages.find((message) => message.role === "system" && message.content.includes("Resumo automatico"));
  assert.ok(summary);
  assert.match(summary.content, /pergunta antiga 0/);
  assert.match(summary.content, /pergunta antiga 4/);
  assert.doesNotMatch(summary.content, /resposta longa/);
});

test("mensagem longa do historico chega inteira ate o teto novo", () => {
  const long = "x".repeat(5_000);
  const messages = buildMessages({ systemContent: "s", history: [{ role: "assistant", text: long }], prompt: "p" });
  assert.equal(messages[1].content.length, 5_000);
});

test("o controle de qualidade cobra o minimo pedido, nao a folga", () => {
  // Os jogos pedem itens a mais do que a partida usa, porque o cliente descarta
  // o que ja saiu em rodadas anteriores. O lote abaixo tem 3 pares validos para
  // um pedido de 6 com minimo de 3: precisa passar.
  const reply = [
    "TERMO: DNA\nDEFINICAO: Molecula que guarda a informacao genetica",
    "TERMO: RNA\nDEFINICAO: Atua na expressao dos genes",
    "TERMO: Mitose\nDEFINICAO: Divisao que gera duas celulas semelhantes",
  ].join("\n\n");

  assert.equal(
    replyQualityIssue({ task: "pares", reply, prompt: "Crie 6 pares sobre Biologia. Entregue pelo menos 3 pares validos." }),
    "",
    "com 'pelo menos 3' o lote de 3 e aceito",
  );
  assert.match(
    replyQualityIssue({ task: "pares", reply, prompt: "Crie 6 pares sobre Biologia." }),
    /incompletos/,
    "sem 'pelo menos' o pedido de 6 continua cobrando 6",
  );
});

test("sugestoes saem do texto e o modo tutor entra no prompt do chat", async () => {
  let systemText = "";
  await withNano(
    { NANOGPT_API_KEY: "nano_sugestoes", MINE_WEB_SEARCH: "off" },
    async (_url, options) => {
      const body = JSON.parse(options.body);
      systemText = body.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n");
      return jsonResponse({
        choices: [{ message: { content: "Qual grandeza o enunciado pede?\n\n[[sugestoes: Me da mais uma dica | Confere minha resposta | Mostra a resolucao]]" } }],
      });
    },
    async () => {
      const result = await runMineRequest({ prompt: "Resolva 2x + 4 = 10", tutor: true });
      assert.equal(result.reply, "Qual grandeza o enunciado pede?");
      assert.deepEqual(result.suggestions, ["Me da mais uma dica", "Confere minha resposta", "Mostra a resolucao"]);
    },
  );
  assert.match(systemText, /MODO TUTOR LIGADO/);
  assert.match(systemText, /PROXIMAS PERGUNTAS/);
});

test("tarefas estruturadas nao recebem sugestoes nem modo tutor", async () => {
  let systemText = "";
  await withNano(
    { NANOGPT_API_KEY: "nano_tarefa", MINE_WEB_SEARCH: "off" },
    async (_url, options) => {
      systemText = JSON.parse(options.body).messages.filter((message) => message.role === "system").map((message) => message.content).join("\n");
      return jsonResponse({ choices: [{ message: { content: "F: Frente\nV: Verso completo do cartao." } }] });
    },
    async () => {
      const result = await runMineRequest({ task: "flashcards", prompt: "Crie 1 flashcard", tutor: true });
      assert.deepEqual(result.suggestions, []);
    },
  );
  assert.doesNotMatch(systemText, /MODO TUTOR|PROXIMAS PERGUNTAS/);
});

test("mensagem aceita de 12000 caracteres chega inteira ao modelo e ao historico", () => {
  const prompt = "x".repeat(MAX_PROMPT_LENGTH - 10) + "LARANJA-37";
  assert.equal(MAX_PROMPT_LENGTH, MAX_PROMPT_CHARS);
  assert.equal(validateChatPayload({ prompt }), null);
  const messages = buildMessages({ systemContent: "s", prompt, history: [{ role: "user", text: prompt }] });
  assert.equal(messages.at(-1).content, prompt);
  assert.equal(messages[1].content, prompt);
  assert.ok(validateChatPayload({ prompt: prompt + "x" }));
  assert.throws(() => buildMessages({ systemContent: "s", prompt: prompt + "x" }), /longa demais/);
});

test("limpeza conserva codigo, indentacao, JSON didatico e texto depois do bloco", () => {
  const code = "```python\ndef somar(a, b):\n    return a + b\n```";
  for (const reply of [code, code + "\n\nExemplo: somar(1, 2).", "```javascript\nconst obj = {reply: 'exemplo'};\n```", '```json\n{"dados": [1,2]}\n```']) {
    assert.equal(cleanReply(reply), reply);
  }
  assert.equal(parseBlocks(cleanReply(code))[0].code, "def somar(a, b):\n    return a + b");
  assert.equal(cleanReply('{"reply":"Uma explicacao completa."}'), "Uma explicacao completa.");
  assert.equal(cleanReply('```json\n{"reply":"Uma explicacao completa."}\n```'), "Uma explicacao completa.");
  const example = '```json\n{"reply":"exemplo didatico"}\n```';
  assert.equal(cleanReply(example, { prompt: "Mostre um exemplo de JSON." }), example);
});

test("prompt ensina idiomas e orienta a criar materia sem prometer salvar", () => {
  const system = buildSystemInstruction("");
  assert.match(system, /idioma estudado ou solicitado/);
  assert.match(system, /tres pares completos/);
  assert.match(system, /ensine o caminho real na mesma resposta/);
  assert.doesNotMatch(system, /Escreva 100%|nunca use palavras em ingles|terminar jogo 20/);
  assert.match(buildQuizInstruction("Inglês"), /idioma estudado/);
  assert.match(buildFlashcardsInstruction("Inglês"), /idioma estudado/);
});

test("guia de XP da Mine acompanha a fonte de verdade do aplicativo", () => {
  const system = buildSystemInstruction("");
  assert.ok(system.includes(`Cada acerto valido nos jogos rende ${xpPerAction.game} XP`));
  assert.ok(system.includes(`Tres acertos rendem ${3 * xpPerAction.game} XP`));
  assert.match(system, /sem bonus fixo por terminar/);
});

test("gatilhos distinguem traducao, acao local, cargo atual e pergunta historica", async () => {
  await withNano({ NANOGPT_API_KEY: "nano_intencao_auditoria" }, globalThis.fetch, async () => {
    for (const prompt of ['Crie uma matéria chamada Química na minha conta agora e me confirme quando estiver salva.', 'Como se escreve "eu fui à escola ontem" em inglês?', 'Escreva 3 frases em inglês no simple past com a palavra ontem.', 'Quem foi o presidente dos Estados Unidos em 2010?']) {
      assert.equal(shouldSearchWeb({ prompt }), false, prompt);
    }
    for (const prompt of ['Quem é o presidente dos Estados Unidos?', 'Qual é o prefeito de São Paulo?', 'Qual é a data de hoje?', 'Quero as datas oficiais do Enem.']) {
      assert.equal(shouldSearchWeb({ prompt }), true, prompt);
    }
    assert.equal(shouldSearchWeb({ prompt: 'Traduza a frase de ontem', requested: true }), true);
    const history = [{ role: 'user', text: 'Quem é o presidente dos Estados Unidos?' }];
    assert.equal(shouldSearchWeb({ prompt: 'E o vice-presidente?', history }), true);
    assert.equal(shouldSearchWeb({ prompt: 'Qual é a soma de 1/2 e 1/3?', history }), false);
    assert.equal(buildSearchQuery('Quem é o presidente do Brasil?', history), 'Quem é o presidente do Brasil?');
  });
});

test("fontes oficiais verificam dominio e caminho sem aceitar sites parecidos", () => {
  const policy = searchSourcePolicy('Use o Inep como fonte para as datas oficiais do Enem 2026.');
  assert.equal(policy.required, true);
  assert.equal(matchesSourceScope('https://www.gov.br/inep/pt-br/noticias/a', policy.scopes), true);
  assert.equal(matchesSourceScope('https://enem.inep.gov.br/', policy.scopes), true);
  for (const url of ['https://gov.br.exemplo.com/inep/', 'https://www.gov.br/inep-falso/', 'https://www.gov.br/outro-orgao/', 'https://exemplo.com/?url=https://gov.br/inep/']) {
    assert.equal(matchesSourceScope(url, policy.scopes), false, url);
  }
});

test("busca refina uma consulta e descarta terceiros quando o estudante exige Inep", async () => {
  const queries = []; let system = '';
  await withNano({ NANOGPT_API_KEY: 'nano_fonte_oficial_auditoria' }, async (url, options) => {
    const body = JSON.parse(options.body);
    if (String(url).endsWith('/api/web')) {
      queries.push(body.query);
      return jsonResponse({ data: queries.length === 1
        ? [{ title: 'Blog não oficial', url: 'https://blog.exemplo.com/enem-refinamento', content: 'Datas não confirmadas' }]
        : [{ title: 'Edital Enamed', url: 'https://www.gov.br/inep/pt-br/enamed-refinamento', content: 'Outro exame.' }, { title: 'Edital do Enem', url: 'https://www.gov.br/inep/pt-br/edital-refinamento', content: 'Informação oficial para teste.' }] });
    }
    system = body.messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
    return jsonResponse({ choices: [{ message: { content: 'A fonte consultada é o edital [1].' } }] });
  }, async () => {
    const result = await runMineRequest({ prompt: 'Pesquise as datas oficiais do Enem 2027 usando o Inep como fonte.' });
    assert.equal(result.sources.length, 1);
    assert.equal(result.sources[0].domain, 'gov.br');
    assert.match(queries[0], /site:gov\.br\/inep/);
    assert.match(queries[1], /site:inep\.gov\.br/);
    assert.match(system, /pagina exata consultada/);
    assert.doesNotMatch(system, /blog\.exemplo/);
  });
});

test("busca oficial sem confirmacao devolve aviso e nao passa fontes de terceiros", async () => {
  let system = '';
  await withNano({ NANOGPT_API_KEY: 'nano_oficial_sem_resultado_auditoria' }, async (url, options) => {
    if (String(url).endsWith('/api/web')) return jsonResponse({ data: [{ title: 'Blog', url: 'https://blog.exemplo.com/enem-sem-oficial', content: 'Palpite' }] });
    system = JSON.parse(options.body).messages.map(m => m.content).join('\n');
    return jsonResponse({ choices: [{ message: { content: 'Não consegui confirmar no órgão oficial.' } }] });
  }, async () => {
    const result = await runMineRequest({ prompt: 'Quais as datas oficiais do Enem 2028? Use o Inep.' });
    assert.deepEqual(result.sources, []);
    assert.match(result.notice, /fonte oficial/);
    assert.match(system, /nao apresente datas/);
  });
});

test("controle de qualidade rejeita codigo aberto e limite de saida mesmo com texto longo", () => {
  assert.match(replyQualityIssue({ reply: '```python\ndef soma(a, b):\n    return a + b' }), /codigo incompleto/);
  assert.match(replyQualityIssue({ reply: 'Uma resposta que parece completa.', finishReason: 'length' }), /limite de saida/);
  assert.equal(replyQualityIssue({ reply: '```python\ndef soma(a, b):\n    return a + b\n```', finishReason: 'stop' }), '');
});

test("fallback substitui resposta cortada antes de publicar texto como completo", async () => {
  let count = 0;
  await withNano({ NANOGPT_API_KEY: 'nano_resposta_cortada_auditoria', MINE_WEB_SEARCH: 'off' }, async () => {
    count++;
    return jsonResponse({ choices: [{ message: { content: count === 1 ? 'Explicação cortada no meio de' : 'Explicação completa e correta.' }, finish_reason: count === 1 ? 'length' : 'stop' }] });
  }, async () => {
    const result = await runMineRequest({ prompt: 'Explique a fotossíntese.' });
    assert.equal(result.reply, 'Explicação completa e correta.');
    assert.equal(count, 2);
  });
});

test("leitor de pagina fica com o miolo e com os paragrafos da pergunta", async () => {
  const { htmlToParagraphs, relevantText } = await import("../mine/page-reader.mjs");
  const html = `<html><head><script>var x = "nao";</script></head><body><nav>Menu Inicio Contato e mais itens do menu do site</nav>
    <article><h1>Calendario do Enem 2026</h1><p>O Inep publicou nesta semana o cronograma completo do exame nacional.</p>
    <p>As provas do Enem 2026 serao aplicadas nos dias 8 e 15 de novembro em todo o pais.</p>
    <p>Texto sobre outro assunto qualquer que nao tem relacao com a pergunta feita aqui hoje.</p>
    ${"<p>Paragrafo de enchimento para o artigo ficar com tamanho de artigo de verdade.</p>".repeat(12)}</article>
    <footer>Rodape com direitos reservados e links institucionais</footer></body></html>`;
  const paragraphs = htmlToParagraphs(html);
  assert.ok(paragraphs.some((line) => /8 e 15 de novembro/.test(line)));
  assert.ok(!paragraphs.some((line) => /Menu Inicio|Rodape|var x/.test(line)));
  const text = relevantText(paragraphs, "datas provas enem 2026", 200);
  assert.match(text, /8 e 15 de novembro/);
  assert.ok(text.length <= 210);
});

test("pergunta sobre o ultimo/atual troca ano antigo da consulta pelo de hoje", async () => {
  const { freshenQueries } = await import("../mine/web.mjs");
  const now = new Date("2026-10-02T12:00:00-03:00");
  assert.deepEqual(
    freshenQueries(["Copa do Mundo FIFA masculina 2022 campeão", "FIFA World Cup 2022 winner"], "Quem ganhou a última Copa do Mundo?", now),
    ["Copa do Mundo FIFA masculina 2026 campeão", "FIFA World Cup 2026 winner"],
  );
  // Ano dito pelo estudante manda; sem "ultimo/atual" a consulta fica como veio.
  assert.deepEqual(freshenQueries(["copa 2022 final"], "Como foi a última partida da Copa de 2022?", now), ["copa 2022 final"]);
  assert.deepEqual(freshenQueries(["revolucao francesa 1789"], "Explique a Revolução Francesa", now), ["revolucao francesa 1789"]);
});
