import test from "node:test";
import assert from "node:assert/strict";

import { redactSecrets } from "../mine/env.mjs";
import { buildMessages, MAX_HISTORY_MESSAGES } from "../mine/messages.mjs";
import { callProvider, parseProviderKeys } from "../mine/providers.mjs";
import { replyQualityIssue } from "../mine/quality.mjs";
import { runMineRequest } from "../mine/router.mjs";

test("pool de chaves separa, limpa e remove duplicatas", () => {
  assert.deepEqual(parseProviderKeys(" a , b;b\nc ", "b", "cole-sua-chave-aqui"), ["a", "b", "c"]);
});

test("uma chave limitada entra em cooldown e a proxima assume", async () => {
  const previousFetch = globalThis.fetch;
  process.env.GROQ_API_KEYS = "gsk_chave_limitada,gsk_chave_reserva";
  const authorizations = [];
  globalThis.fetch = async (_url, options) => {
    authorizations.push(options.headers.authorization);
    if (authorizations.length === 1) {
      return new Response(JSON.stringify({ error: { message: "rate limit" } }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "30" },
      });
    }
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "Resposta completa" }, finish_reason: "stop" }],
        usage: { total_tokens: 8 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const request = {
      provider: "groq",
      providerModel: "modelo-teste",
      messages: [{ role: "user", content: "oi" }],
      timeoutMs: 2_000,
    };
    await assert.rejects(callProvider(request), (error) => error?.code === "rate_limit");
    const result = await callProvider(request);
    assert.equal(result.content, "Resposta completa");
    assert.match(authorizations[0], /chave_limitada/);
    assert.match(authorizations[1], /chave_reserva/);
  } finally {
    globalThis.fetch = previousFetch;
    delete process.env.GROQ_API_KEYS;
  }
});

test("roteador repete o mesmo modelo com a chave reserva dentro do pedido", async () => {
  const previousFetch = globalThis.fetch;
  const envNames = ["OPENROUTER_API_KEY", "OPENROUTER_API_KEYS", "GOOGLE_GEMINI_API_KEY", "GROQ_API_KEY", "GROQ_API_KEYS", "NVIDIA_API_KEY"];
  const previousEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  for (const name of envNames) delete process.env[name];
  process.env.GROQ_API_KEYS = "gsk_router_limitada,gsk_router_reserva";
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ error: { message: "rate limit" } }), {
        status: 429,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: "Resposta completa e correta." } }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await runMineRequest({ alias: "terra", prompt: "Explique de forma curta o que e DNA." });
    assert.equal(result.reply, "Resposta completa e correta.");
    assert.equal(result.alias, "terra");
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = previousFetch;
    for (const name of envNames) {
      if (previousEnv[name] === undefined) delete process.env[name];
      else process.env[name] = previousEnv[name];
    }
  }
});

test("segredos dos novos provedores nunca aparecem em logs", () => {
  const text = redactSecrets("gsk_abcdefghijklmnopqrstuvwxyz AIzaabcdefghijklmnopqrstuvwxyz123456");
  assert.equal(text.includes("gsk_"), false);
  assert.equal(text.includes("AIza"), false);
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
  const history = Array.from({ length: 20 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    text: `mensagem-${index}`,
  }));
  const messages = buildMessages({ systemContent: "sistema", history, prompt: "pergunta" });
  const conversation = messages.slice(1, -1);
  assert.equal(conversation.length, MAX_HISTORY_MESSAGES);
  assert.equal(conversation[0].content, "mensagem-10");
  assert.equal(conversation.at(-1).content, "mensagem-19");
});
