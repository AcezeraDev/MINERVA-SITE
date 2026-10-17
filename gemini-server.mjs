// Camada HTTP da Mine.
//
// O nome do arquivo e legado (a IA ja foi Gemini, NVIDIA, OpenRouter e Azure;
// desde set/2026 e a NanoGPT). O endpoint continua sendo /api/gemini para nao quebrar o que ja
// esta no ar; /api/mine/chat aponta para o mesmo handler.
//
// Toda a inteligencia de modelos vive em ./mine/*. Aqui so tem HTTP:
// ler o corpo, validar, chamar o roteador e traduzir erro em mensagem amigavel.

import { loadLocalEnv, redactSecrets } from "./mine/env.mjs";
import { checkRateLimit, resolveIdentity, validateChatPayload } from "./mine/limits.mjs";
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
  // GET diz a interface o que o servidor oferece. Nao ha mais catalogo de
  // modelos: a Mine e um modelo so, e o ID tecnico nunca sai do servidor.
  if (req.method === "GET") {
    writeJson(res, 200, {
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
    // O cliente pode pedir menos, nunca ultrapassar o teto do servidor. Isso e
    // importante porque tokens de raciocinio tambem sao cobrados como saida e
    // contam dentro de max_tokens.
    // O chat comum pede 1500 tokens no cliente. O teto maior existe para
    // artefatos estruturados (mapa mental, simulado e jogos), que precisam
    // terminar todas as linhas para passar pelo controle de qualidade.
    // Out/2026: o teto subiu de 2600 para 8000. Com raciocinio "medium" o
    // modelo gastava boa parte dos 1500 pedidos pelo chat so pensando, e
    // explicacoes longas saiam cortadas ou encurtadas.
    const serverTokenCap = clampNumber(process.env.MINE_MAX_OUTPUT_TOKENS, 256, 16000, 8000);
    const requestedTokens = clampNumber(payload.maxOutputTokens, 256, 16000, serverTokenCap);
    const maxTokens = Math.min(requestedTokens, serverTokenCap);
    const wantsStream = payload.stream === true;

    if (wantsStream) {
      await streamResponse(req, res, { task, payload, maxTokens });
      return true;
    }

    const result = await runMineRequest({
      task,
      prompt: payload.prompt,
      context: payload.context,
      history: payload.history,
      attachments: payload.attachments,
      webSearch: payload.webSearch === true,
      photos: payload.photos === true,
      tutor: payload.tutor === true,
      maxTokens,
    });

    writeJson(res, 200, {
      reply: result.reply,
      actions: [],
      suggestions: result.suggestions || [],
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

async function streamResponse(req, res, { task, payload, maxTokens }) {
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
  const open = () => {
    if (opened) return;
    openEventStream(res);
    opened = true;
  };
  // Jogos e geradores estruturados precisam de um lote completo e validado.
  // Enviar o primeiro fragmento fazia a interface congelar dicas como ":" ou
  // definicoes como "C" antes de o modelo terminar a linha.
  const deliverDeltas = !String(task || "").trim();

  try {
    const result = await runMineRequest({
      task,
      prompt: payload.prompt,
      context: payload.context,
      history: payload.history,
      attachments: payload.attachments,
      webSearch: payload.webSearch === true,
      photos: payload.photos === true,
      tutor: payload.tutor === true,
      maxTokens,
      signal: controller.signal,
      onDelta: deliverDeltas
        ? (text) => {
            open();
            sendEvent(res, { type: "delta", text });
          }
        : undefined,
      // Etapas da pesquisa e o raciocinio vao para a tela enquanto acontecem,
      // como nos chats grandes ("Pesquisando...", "Lendo 6 fontes").
      onStatus: deliverDeltas
        ? (status) => {
            open();
            sendEvent(res, { type: "status", ...status });
          }
        : undefined,
      onReasoning: deliverDeltas
        ? (text) => {
            open();
            sendEvent(res, { type: "reasoning", text });
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
      queries: result.queries || [],
      reasoning: String(result.reasoning || "").slice(0, 20_000),
      suggestions: result.suggestions || [],
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
