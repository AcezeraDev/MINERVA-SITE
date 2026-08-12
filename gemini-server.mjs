// Camada HTTP da Mine.
//
// O nome do arquivo e legado (a IA ja foi Gemini, depois NVIDIA, agora
// OpenRouter). O endpoint continua sendo /api/gemini para nao quebrar o que ja
// esta no ar; /api/mine/chat aponta para o mesmo handler.
//
// Toda a inteligencia de modelos vive em ./mine/*. Aqui so tem HTTP:
// ler o corpo, validar, chamar o roteador e traduzir erro em mensagem amigavel.

import { loadLocalEnv, redactSecrets } from "./mine/env.mjs";
import { checkRateLimit, resolveIdentity, validateChatPayload } from "./mine/limits.mjs";
import { DEFAULT_MINE_ALIAS, TASK_DEFAULT_ALIAS, isMineAlias, publicModelCatalog } from "./mine/models.mjs";
import { runMineRequest } from "./mine/router.mjs";
import { webSearchEnabled } from "./mine/web.mjs";

export { loadLocalEnv };

function writeJson(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function readRequestBody(req) {
  if ("body" in req && req.body !== undefined) {
    if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body.toString("utf8"));
    if (typeof req.body === "string") return Promise.resolve(req.body);
    return Promise.resolve(JSON.stringify(req.body || {}));
  }

  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 6_000_000) {
        reject(new Error("Payload muito grande."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

// O cliente pode mandar qualquer coisa. So alias da allowlist passam; qualquer
// outra coisa cai no nivel padrao em vez de virar erro (documento, secao 39).
function pickAlias(value, task) {
  if (isMineAlias(value)) return value;
  return task ? TASK_DEFAULT_ALIAS : DEFAULT_MINE_ALIAS;
}

function openEventStream(res) {
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    // Impede que proxies segurem o corpo ate o fim, o que mataria o streaming.
    "x-accel-buffering": "no",
  });
}

function sendEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

const FRIENDLY_ERRORS = {
  rate_limit: {
    status: 429,
    message: "A Mine atingiu o limite de uso por alguns instantes. Tente novamente em seguida.",
  },
  quota: {
    status: 429,
    message: "A Mine atingiu o limite de uso de hoje. Tente novamente mais tarde.",
  },
  timeout: {
    status: 504,
    message: "A Mine demorou demais para responder. Tente uma pergunta mais curta.",
  },
  unavailable: {
    status: 503,
    message: "A Mine está temporariamente indisponível. Tente de novo em alguns instantes.",
  },
  model_missing: {
    status: 503,
    message: "A Mine está temporariamente indisponível. Tente de novo em alguns instantes.",
  },
  empty: {
    status: 502,
    message: "Não consegui montar uma resposta agora. Tente reformular a pergunta.",
  },
  network: {
    status: 503,
    message: "Não consegui falar com a Mine agora. Verifique a conexão e tente de novo.",
  },
  aborted: { status: 499, message: "Geração cancelada." },
};

// auth e config sao problema do servidor: loga o detalhe, devolve texto neutro.
const SERVER_SIDE_CODES = new Set(["auth", "config"]);

function respondWithError(res, error) {
  const code = error?.code || "error";
  if (SERVER_SIDE_CODES.has(code)) {
    console.error(`[mine] configuracao: ${redactSecrets(error?.message || "")}`);
    writeJson(res, 500, {
      error: "A Mine está fora do ar no momento. Já estamos vendo isso.",
      code: "unavailable",
    });
    return;
  }
  const friendly = FRIENDLY_ERRORS[code];
  if (friendly) {
    writeJson(res, friendly.status, { error: friendly.message, code });
    return;
  }
  console.error(`[mine] erro nao mapeado: ${redactSecrets(error?.message || "")}`);
  writeJson(res, 500, {
    error: "Tive um problema para responder agora. Tente novamente em alguns instantes.",
    code: "error",
  });
}

export async function handleGeminiRequest(req, res) {
  // GET devolve o catalogo publico: nomes de marca, sem ID tecnico de modelo.
  if (req.method === "GET") {
    writeJson(res, 200, {
      models: publicModelCatalog(),
      default: DEFAULT_MINE_ALIAS,
      // A interface so mostra o botao de pesquisar na web se o servidor tiver
      // a busca ligada — botao que sempre falha e pior que botao nenhum.
      webSearch: webSearchEnabled(),
    });
    return true;
  }

  if (req.method !== "POST") {
    writeJson(res, 405, { error: "Use POST." });
    return true;
  }

  try {
    const limit = checkRateLimit(resolveIdentity(req));
    if (!limit.allowed) {
      res.setHeader?.("retry-after", String(limit.retryAfterSeconds));
      writeJson(res, 429, {
        error: "A Mine está recebendo muitas solicitações agora. Tente novamente em alguns instantes.",
        code: "rate_limit",
      });
      return true;
    }

    const raw = await readRequestBody(req);
    const payload = raw ? JSON.parse(raw) : {};

    const invalid = validateChatPayload(payload);
    if (invalid) {
      writeJson(res, 400, { error: invalid, code: "invalid_request" });
      return true;
    }

    const task = String(payload.task || "").trim();
    const alias = pickAlias(payload.model, task);
    const maxTokens = clampNumber(payload.maxOutputTokens || process.env.MINE_MAX_OUTPUT_TOKENS, 256, 4096, 1024);
    const wantsStream = payload.stream === true;

    if (wantsStream) {
      await streamResponse(req, res, { alias, task, payload, maxTokens });
      return true;
    }

    const result = await runMineRequest({
      alias,
      task,
      prompt: payload.prompt,
      context: payload.context,
      history: payload.history,
      attachments: payload.attachments,
      webSearch: payload.webSearch === true,
      maxTokens,
    });

    writeJson(res, 200, {
      reply: result.reply,
      actions: [],
      suggestions: [],
      model: result.alias,
      modelDisplayName: result.displayName,
      notice: result.notice || "",
      sources: result.sources || [],
    });
  } catch (error) {
    respondWithError(res, error);
  }
  return true;
}

async function streamResponse(req, res, { alias, task, payload, maxTokens }) {
  // Se o usuario fechar a aba ou apertar parar, o fetch para o provedor cai
  // junto em vez de continuar consumindo cota.
  //
  // O sinal tem que vir do `res`: em POST o `req` emite "close" assim que o
  // corpo termina de chegar, ainda com a resposta em andamento, entao ele nao
  // distingue "cliente foi embora" de "pedido lido por inteiro". O `res` fecha
  // quando a conexao cai de verdade — `writableEnded` separa isso do fim
  // normal, em que nos mesmos encerramos.
  const controller = new AbortController();
  const onClose = () => {
    if (!res.writableEnded) {
      console.log("[mine] cliente desconectou: cancelando a geração");
      controller.abort();
    }
  };
  res.on("close", onClose);
  req.on("aborted", onClose);

  let opened = false;
  // Jogos e geradores estruturados precisam de um lote completo e validado.
  // Enviar o primeiro fragmento fazia a interface congelar dicas como ":" ou
  // definicoes como "C" antes de o modelo terminar a linha.
  const deliverDeltas = !String(task || "").trim();

  try {
    const result = await runMineRequest({
      alias,
      task,
      prompt: payload.prompt,
      context: payload.context,
      history: payload.history,
      attachments: payload.attachments,
      webSearch: payload.webSearch === true,
      maxTokens,
      signal: controller.signal,
      onDelta: deliverDeltas
        ? (text) => {
            if (!opened) {
              openEventStream(res);
              opened = true;
            }
            sendEvent(res, { type: "delta", text });
          }
        : undefined,
    });

    if (!opened) {
      openEventStream(res);
      opened = true;
    }
    // O texto final e a versao limpa e vale mais que a soma dos pedacos.
    sendEvent(res, {
      type: "done",
      reply: result.reply,
      model: result.alias,
      modelDisplayName: result.displayName,
      notice: result.notice || "",
      sources: result.sources || [],
    });
    res.end();
  } catch (error) {
    const code = error?.code || "error";
    if (opened) {
      // O cabecalho ja foi: o erro vira evento e o texto parcial fica na tela.
      if (code !== "aborted") {
        sendEvent(res, { type: "error", error: friendlyMessage(error), code });
      }
      res.end();
      return;
    }
    if (code === "aborted") {
      res.end();
      return;
    }
    respondWithError(res, error);
  } finally {
    res.off?.("close", onClose);
  }
}

function friendlyMessage(error) {
  const code = error?.code || "error";
  if (SERVER_SIDE_CODES.has(code)) return "A Mine está fora do ar no momento. Já estamos vendo isso.";
  return FRIENDLY_ERRORS[code]?.message || "Tive um problema para responder agora. Tente novamente em alguns instantes.";
}

export const handleMineChatRequest = handleGeminiRequest;
