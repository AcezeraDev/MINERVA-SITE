import { redactSecrets } from "./env.mjs";
import { extractSources } from "./web.mjs";

// Adapter unico de provedor. Nenhuma outra parte do projeto fala HTTP com
// OpenRouter, Gemini, Groq ou NVIDIA (documento, secao 14).

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

function googleGeminiKeys() {
  const legacy = String(process.env.GEMINI_API_KEY || "").trim();
  return parseProviderKeys(
    process.env.GOOGLE_GEMINI_API_KEYS,
    process.env.GOOGLE_GEMINI_API_KEY,
    process.env.GEMINI_API_KEYS,
    legacy && !legacy.startsWith("nvapi-") ? legacy : "",
  );
}

function nvidiaKeys() {
  const legacy = String(process.env.GEMINI_API_KEY || "").trim();
  return parseProviderKeys(
    process.env.NVIDIA_API_KEYS,
    process.env.NVIDIA_API_KEY,
    legacy.startsWith("nvapi-") ? legacy : "",
  );
}

const PROVIDERS = {
  openrouter: {
    label: "openrouter",
    baseUrl: () => String(process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").trim(),
    apiKeys: () => parseProviderKeys(process.env.OPENROUTER_API_KEYS, process.env.OPENROUTER_API_KEY),
    apiKey: () => selectProviderKey("openrouter"),
    // O OpenRouter usa esses dois cabecalhos para atribuir o trafego ao app.
    extraHeaders: () => ({
      "HTTP-Referer": String(process.env.PUBLIC_APP_ORIGIN || "https://minerva-web.vercel.app"),
      "X-Title": "Minerva",
    }),
  },
  nvidia: {
    label: "nvidia",
    baseUrl: () => String(process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").trim(),
    apiKeys: nvidiaKeys,
    apiKey: () => selectProviderKey("nvidia"),
    extraHeaders: () => ({}),
  },
  gemini: {
    label: "gemini",
    baseUrl: () => String(process.env.GOOGLE_GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai").trim(),
    apiKeys: googleGeminiKeys,
    apiKey: () => selectProviderKey("gemini"),
    extraHeaders: () => ({}),
  },
  groq: {
    label: "groq",
    baseUrl: () => String(process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").trim(),
    apiKeys: () => parseProviderKeys(process.env.GROQ_API_KEYS, process.env.GROQ_API_KEY),
    apiKey: () => selectProviderKey("groq"),
    extraHeaders: () => ({}),
  },
};

export function providerConfigured(provider) {
  const entry = PROVIDERS[provider];
  return Boolean(entry && entry.apiKeys().length);
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

// Um modelo aposentado e o modo de falha mais provavel aqui: o catalogo de
// modelos gratuitos muda sozinho. O OpenRouter responde 400 "is not a valid
// model ID" nesse caso, e nao 404 — sem tratar isso como retentavel, a cadeia
// de fallback inteira seria pulada justo quando ela mais serve.
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
  temperature = 0.3,
  timeoutMs = 45_000,
  signal,
  onDelta,
  plugins,
  providerParams,
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
        authorization: `Bearer ${apiKey}`,
        ...entry.extraHeaders(),
      },
      body: JSON.stringify({
        model: providerModel,
        messages,
        temperature,
        top_p: 0.9,
        max_tokens: maxTokens,
        stream: true,
        ...(plugins ? { plugins } : {}),
        ...(providerParams || {}),
      }),
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
    let usage = {};
    let finishReason = "";
    let resolvedModel = providerModel;
    let sources = [];

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
        const delta = choice?.delta?.content;
        if (typeof delta === "string" && delta) {
          content += delta;
          onDelta?.(delta);
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        if (event?.usage) usage = event.usage;
        if (event?.model) resolvedModel = event.model;
        // As citacoes podem vir no delta ou na mensagem consolidada.
        const found = extractSources(choice?.delta || choice?.message);
        if (found.length) sources = found;
      }
    }

    if (!content.trim()) {
      throw new MineError("O modelo respondeu vazio.", { code: "empty", retryable: true });
    }

    markKeySuccess(provider, apiKey);
    return {
      content: content.trim(),
      reasoning: "",
      sources,
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
  temperature = 0.3,
  timeoutMs = 45_000,
  signal,
  plugins,
  providerParams,
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
        authorization: `Bearer ${apiKey}`,
        ...entry.extraHeaders(),
      },
      body: JSON.stringify({
        model: providerModel,
        messages,
        temperature,
        top_p: 0.9,
        max_tokens: maxTokens,
        stream: false,
        ...(plugins ? { plugins } : {}),
        ...(providerParams || {}),
      }),
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

    // O OpenRouter pode responder 200 com erro no corpo.
    if (data?.error) {
      const status = Number(data.error.code) || 0;
      const { code, retryable, cooldownMs } = classifyStatus(status, data.error.message);
      throw new MineError(data.error.message || "Erro do provedor.", { code, status, retryable, cooldownMs });
    }

    const message = data?.choices?.[0]?.message || {};
    const content = pickMessageText(message).trim();

    // Modelos de raciocinio as vezes gastam todo o orcamento pensando e voltam
    // com content vazio. Isso e falha aproveitavel: deixa o fallback tentar
    // outro nivel em vez de mostrar uma bolha em branco.
    if (!content) {
      throw new MineError("O modelo respondeu vazio.", { code: "empty", retryable: true });
    }

    markKeySuccess(provider, apiKey);
    return {
      content,
      reasoning: String(message.reasoning || "").trim(),
      sources: extractSources(message),
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
