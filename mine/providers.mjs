import { redactSecrets } from "./env.mjs";

// Adapter unico de provedor. Nenhuma outra parte do projeto fala HTTP de chat
// com a NanoGPT (documento, secao 14). A busca na web usa `nanogptApiUrl`.

export class MineError extends Error {
  constructor(message, { code = "error", status = 0, retryable = false, cooldownMs = 0 } = {}) {
    super(redactSecrets(message));
    this.name = "MineError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.cooldownMs = cooldownMs;
  }
}

export function parseProviderKeys(...values) {
  const keys = values
    .flatMap((value) => String(value || "").split(/[;,\n]/))
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => !/^(cole-|sua-chave|troque-)/i.test(value));
  return [...new Set(keys)];
}

export function nanogptKeys() {
  return parseProviderKeys(process.env.NANOGPT_API_KEYS, process.env.NANOGPT_API_KEY);
}

/** Base OpenAI-compatible da NanoGPT (`.../api/v1`). */
export function nanogptBaseUrl() {
  return String(process.env.NANOGPT_BASE_URL || "https://nano-gpt.com/api/v1").trim().replace(/\/$/, "");
}

/**
 * Endpoints fora do formato OpenAI (busca na web) moram em `/api/...` na mesma
 * origem: `https://nano-gpt.com/api/v1` -> `https://nano-gpt.com/api/web`.
 */
export function nanogptApiUrl(path) {
  const root = nanogptBaseUrl().replace(/\/v1$/i, "");
  return `${root}/${String(path).replace(/^\//, "")}`;
}

const PROVIDERS = {
  nanogpt: {
    label: "nanogpt",
    baseUrl: nanogptBaseUrl,
    apiKeys: nanogptKeys,
    apiKey: () => selectProviderKey("nanogpt"),
    extraHeaders: () => ({}),
    // Os modelos de raciocinio da OpenAI recusam `temperature`/`top_p`, entao
    // eles nao vao. `max_tokens` inclui o raciocinio oculto e serve tambem de
    // trava de custo por pedido.
    requestBody: ({ model, messages, maxTokens, stream, providerParams, tools, toolChoice }) => ({
      model,
      messages,
      max_tokens: maxTokens,
      stream,
      ...(stream ? { stream_options: { include_usage: true } } : {}),
      ...(tools?.length ? { tools, tool_choice: toolChoice || "auto" } : {}),
      ...(providerParams || {}),
    }),
  },
};

function providerHeaders(entry, apiKey) {
  return entry.authHeaders?.(apiKey) || { authorization: `Bearer ${apiKey}` };
}

function providerRequestBody(entry, { providerModel, messages, maxTokens, stream, providerParams, tools, toolChoice }) {
  return entry.requestBody({ model: providerModel, messages, maxTokens, stream, providerParams, tools, toolChoice });
}

/**
 * Pedidos de ferramenta ja montados: `{ name, arguments }` com os argumentos
 * em JSON lido. Argumento ilegivel vira objeto vazio — quem chama decide o
 * que fazer sem consulta.
 */
function finishToolCalls(raw) {
  return raw
    .filter((call) => call?.name)
    .map((call) => {
      let args = {};
      try {
        args = JSON.parse(call.arguments || "{}") || {};
      } catch {
        args = {};
      }
      return { name: call.name, arguments: args };
    });
}

// O texto do raciocinio muda de nome conforme o modelo por tras da NanoGPT.
function reasoningDelta(delta) {
  const value = delta?.reasoning ?? delta?.reasoning_content ?? delta?.thinking;
  return typeof value === "string" ? value : "";
}

export function providerConfigured(provider) {
  const entry = PROVIDERS[provider];
  return Boolean(entry && (entry.isConfigured ? entry.isConfigured() : entry.apiKeys().length));
}

const keyHealth = new Map();
const providerCursor = new Map();

function keyState(provider, apiKey) {
  const id = `${provider}:${apiKey}`;
  if (!keyHealth.has(id)) keyHealth.set(id, { cooldownUntil: 0, failures: 0 });
  return keyHealth.get(id);
}

function orderedProviderKeys(provider) {
  const entry = PROVIDERS[provider];
  if (!entry) return [];
  const keys = entry.apiKeys();
  if (!keys.length) return [];
  const cursor = providerCursor.get(provider) || 0;
  return [...keys.slice(cursor % keys.length), ...keys.slice(0, cursor % keys.length)];
}

function readyProviderKeys(provider) {
  const now = Date.now();
  return orderedProviderKeys(provider).filter((apiKey) => keyState(provider, apiKey).cooldownUntil <= now);
}

function selectProviderKey(provider) {
  const keys = readyProviderKeys(provider);
  if (!keys.length) return "";
  const selected = keys[0];
  const all = PROVIDERS[provider]?.apiKeys() || [];
  const index = all.indexOf(selected);
  if (index >= 0 && all.length > 1) providerCursor.set(provider, (index + 1) % all.length);
  return selected;
}

export function providerAvailable(provider) {
  return readyProviderKeys(provider).length > 0;
}

function markKeySuccess(provider, apiKey) {
  const state = keyState(provider, apiKey);
  state.cooldownUntil = 0;
  state.failures = 0;
  const keys = PROVIDERS[provider]?.apiKeys() || [];
  const index = keys.indexOf(apiKey);
  if (index >= 0 && keys.length > 1) providerCursor.set(provider, (index + 1) % keys.length);
}

function markKeyFailure(provider, apiKey, error) {
  if (!apiKey || !["rate_limit", "quota", "auth"].includes(error?.code)) return;
  const state = keyState(provider, apiKey);
  state.failures += 1;
  const fallback = error.code === "auth" ? 30 * 60_000 : error.code === "quota" ? 15 * 60_000 : 60_000;
  state.cooldownUntil = Date.now() + Math.max(fallback, Number(error.cooldownMs) || 0);
}

// Um modelo aposentado ou renomeado no catalogo da NanoGPT volta como 400
// "model ... not found", e nao 404 — sem tratar isso como retentavel, a
// reserva seria pulada justo quando ela mais serve.
function looksLikeModelProblem(detail) {
  return /\bmodel\b/i.test(String(detail || ""));
}

function classifyStatus(status, detail, retryAfterMs = 0) {
  if (status === 429) return { code: "rate_limit", retryable: true, cooldownMs: retryAfterMs };
  if (status === 402) return { code: "quota", retryable: true, cooldownMs: Math.max(retryAfterMs, 15 * 60_000) };
  // Credencial invalida derruba apenas esta chave/provedor; outros provedores
  // ainda podem responder, por isso o erro precisa atravessar o fallback.
  if (status === 401 || status === 403) return { code: "auth", retryable: true, cooldownMs: 30 * 60_000 };
  if (status === 404) return { code: "model_missing", retryable: true };
  if (status === 400 && looksLikeModelProblem(detail)) return { code: "model_missing", retryable: true };
  if (status === 408 || status === 409 || status >= 500) return { code: "unavailable", retryable: true };
  return { code: "error", retryable: false };
}

function retryAfterMs(response) {
  const raw = String(response?.headers?.get?.("retry-after") || "").trim();
  if (!raw) return 0;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

function pickMessageText(message) {
  const content = message?.content;
  if (typeof content === "string") return content;
  // Alguns modelos devolvem content como lista de partes.
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("")
      .trim();
  }
  return "";
}

function requestSetup({ provider, apiKey: requestedApiKey, timeoutMs, signal }) {
  const entry = PROVIDERS[provider];
  if (!entry) throw new MineError(`Provedor desconhecido: ${provider}`, { code: "config" });

  const apiKey = requestedApiKey || entry.apiKey();
  if (!apiKey) {
    if (entry.apiKeys().length) {
      throw new MineError(`As credenciais do provedor ${provider} estao em pausa temporaria.`, {
        code: "rate_limit",
        retryable: true,
      });
    }
    throw new MineError(`Credencial do provedor ${provider} nao configurada no servidor.`, { code: "config" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }

  return {
    entry,
    apiKey,
    controller,
    // Abortar corta a leitura do corpo, entao o erro precisa ser classificado
    // pelo motivo do abort — nao como "resposta vazia".
    abortError: () =>
      signal?.aborted
        ? new MineError("Geração cancelada.", { code: "aborted" })
        : new MineError("O modelo demorou demais para responder.", { code: "timeout", retryable: true }),
    cleanup: () => {
      clearTimeout(timeout);
      if (signal) signal.removeEventListener("abort", onAbort);
    },
  };
}

/**
 * Versao em streaming: chama `onDelta(texto)` a cada pedaco recebido e devolve
 * o mesmo formato de `callProvider` no final.
 *
 * O primeiro delta e o ponto sem volta do roteador: dali em diante ja saiu
 * texto para o navegador e nao da mais para trocar de modelo por baixo.
 */
export async function callProviderStream({
  provider,
  providerModel,
  messages,
  maxTokens = 1024,
  timeoutMs = 45_000,
  signal,
  onDelta,
  onReasoning,
  providerParams,
  tools,
  toolChoice,
}) {
  const { entry, apiKey, controller, abortError, cleanup } = requestSetup({ provider, timeoutMs, signal });
  const startedAt = Date.now();

  try {
    const response = await fetch(`${entry.baseUrl().replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
        ...providerHeaders(entry, apiKey),
        ...entry.extraHeaders(),
      },
      body: JSON.stringify(
        providerRequestBody(entry, {
          providerModel,
          messages,
          maxTokens,
          stream: true,
          providerParams,
          tools,
          toolChoice,
        }),
      ),
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const data = await response.json();
        detail = data?.error?.message || data?.detail || detail;
      } catch {
        if (controller.signal.aborted) throw abortError();
      }
      const { code, retryable, cooldownMs } = classifyStatus(response.status, detail, retryAfterMs(response));
      throw new MineError(typeof detail === "string" ? detail : `HTTP ${response.status}`, {
        code,
        status: response.status,
        retryable,
        cooldownMs,
      });
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let reasoning = "";
    let usage = {};
    let finishReason = "";
    let resolvedModel = providerModel;
    // Pedidos de ferramenta chegam em pedacos, por indice: o nome no primeiro
    // e os argumentos (JSON) espalhados pelos seguintes.
    const rawToolCalls = [];

    for await (const piece of response.body) {
      buffer += decoder.decode(piece, { stream: true });

      // SSE: eventos separados por linha; o provedor tambem manda comentarios
      // (linhas iniciadas por ":") como keep-alive.
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line || line.startsWith(":")) continue;
        if (!line.startsWith("data:")) continue;

        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;

        let event;
        try {
          event = JSON.parse(payload);
        } catch {
          continue;
        }

        if (event?.error) {
          const status = Number(event.error.code) || 0;
          const { code, retryable, cooldownMs } = classifyStatus(status, event.error.message);
          throw new MineError(event.error.message || "Erro do provedor.", { code, status, retryable, cooldownMs });
        }

        const choice = event?.choices?.[0];
        const thought = reasoningDelta(choice?.delta);
        if (thought) {
          reasoning += thought;
          onReasoning?.(thought);
        }
        const delta = choice?.delta?.content;
        if (typeof delta === "string" && delta) {
          content += delta;
          onDelta?.(delta);
        }
        for (const part of Array.isArray(choice?.delta?.tool_calls) ? choice.delta.tool_calls : []) {
          const index = Number.isInteger(part?.index) ? part.index : rawToolCalls.length;
          const slot = (rawToolCalls[index] ||= { name: "", arguments: "" });
          if (part?.function?.name) slot.name += part.function.name;
          if (typeof part?.function?.arguments === "string") slot.arguments += part.function.arguments;
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        if (event?.usage) usage = event.usage;
        if (event?.model) resolvedModel = event.model;
      }
    }

    const toolCalls = finishToolCalls(rawToolCalls);
    if (!content.trim() && !toolCalls.length) {
      throw new MineError("O modelo respondeu vazio.", { code: "empty", retryable: true });
    }

    markKeySuccess(provider, apiKey);
    return {
      content: content.trim(),
      toolCalls,
      reasoning: reasoning.trim(),
      provider,
      providerModel,
      resolvedModel,
      finishReason,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const normalized =
      error instanceof MineError
        ? error
        : error?.name === "AbortError" || controller.signal.aborted
          ? abortError()
          : new MineError(error?.message || "Falha de rede ao chamar o provedor.", { code: "network", retryable: true });
    markKeyFailure(provider, apiKey, normalized);
    throw normalized;
  } finally {
    cleanup();
  }
}

/**
 * Chama um modelo em um provedor compativel com a API OpenAI.
 * Devolve sempre a mesma forma, independente do provedor.
 */
export async function callProvider({
  provider,
  providerModel,
  messages,
  maxTokens = 1024,
  timeoutMs = 45_000,
  signal,
  providerParams,
  tools,
  toolChoice,
}) {
  const entry = PROVIDERS[provider];
  if (!entry) throw new MineError(`Provedor desconhecido: ${provider}`, { code: "config" });

  const apiKey = entry.apiKey();
  if (!apiKey) {
    if (entry.apiKeys().length) {
      throw new MineError(`As credenciais do provedor ${provider} estao em pausa temporaria.`, {
        code: "rate_limit",
        retryable: true,
      });
    }
    throw new MineError(`Credencial do provedor ${provider} nao configurada no servidor.`, { code: "config" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }

  // Abortar corta a leitura do corpo, entao o erro precisa ser classificado
  // pelo motivo do abort — nao como "resposta vazia".
  const abortError = () =>
    signal?.aborted
      ? new MineError("Geração cancelada.", { code: "aborted" })
      : new MineError("O modelo demorou demais para responder.", { code: "timeout", retryable: true });

  const startedAt = Date.now();
  try {
    const response = await fetch(`${entry.baseUrl().replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...providerHeaders(entry, apiKey),
        ...entry.extraHeaders(),
      },
      body: JSON.stringify(
        providerRequestBody(entry, {
          providerModel,
          messages,
          maxTokens,
          stream: false,
          providerParams,
          tools,
          toolChoice,
        }),
      ),
    });

    let data = {};
    try {
      data = await response.json();
    } catch (bodyError) {
      if (controller.signal.aborted) throw abortError();
      if (response.ok) {
        throw new MineError("Resposta ilegível do provedor.", { code: "unavailable", retryable: true });
      }
    }

    if (!response.ok) {
      const detail = data?.error?.message || data?.detail || data?.message || `HTTP ${response.status}`;
      const { code, retryable, cooldownMs } = classifyStatus(response.status, detail, retryAfterMs(response));
      throw new MineError(typeof detail === "string" ? detail : `HTTP ${response.status}`, {
        code,
        status: response.status,
        retryable,
        cooldownMs,
      });
    }

    // Provedores agregadores podem responder 200 com erro no corpo.
    if (data?.error) {
      const status = Number(data.error.code) || 0;
      const { code, retryable, cooldownMs } = classifyStatus(status, data.error.message);
      throw new MineError(data.error.message || "Erro do provedor.", { code, status, retryable, cooldownMs });
    }

    const message = data?.choices?.[0]?.message || {};
    const content = pickMessageText(message).trim();
    const toolCalls = finishToolCalls(
      (Array.isArray(message.tool_calls) ? message.tool_calls : []).map((call) => ({
        name: call?.function?.name || "",
        arguments: call?.function?.arguments || "",
      })),
    );

    // Modelos de raciocinio as vezes gastam todo o orcamento pensando e voltam
    // com content vazio. Isso e falha aproveitavel: deixa o fallback tentar
    // outro nivel em vez de mostrar uma bolha em branco.
    if (!content && !toolCalls.length) {
      throw new MineError("O modelo respondeu vazio.", { code: "empty", retryable: true });
    }

    markKeySuccess(provider, apiKey);
    return {
      content,
      toolCalls,
      reasoning: String(message.reasoning || "").trim(),
      provider,
      providerModel,
      resolvedModel: data?.model || providerModel,
      finishReason: data?.choices?.[0]?.finish_reason || "",
      usage: {
        promptTokens: data?.usage?.prompt_tokens,
        completionTokens: data?.usage?.completion_tokens,
        totalTokens: data?.usage?.total_tokens,
      },
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const normalized =
      error instanceof MineError
        ? error
        : error?.name === "AbortError" || controller.signal.aborted
          ? abortError()
          : new MineError(error?.message || "Falha de rede ao chamar o provedor.", {
              code: "network",
              retryable: true,
            });
    markKeyFailure(provider, apiKey, normalized);
    throw normalized;
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}
