import { EMERGENCY_MODEL, MINE_FALLBACKS, MINE_MODELS, RESILIENCE_MODELS, VISION_AUX_ALIAS, resolveMineModel } from "./models.mjs";
import { buildMessages, imageAttachments, imagePartsFromAttachments } from "./messages.mjs";
import { buildInstructionForTask, buildVisionDescriptionInstruction } from "./prompts.mjs";
import { replyQualityIssue } from "./quality.mjs";
import { webSearchEnabled, webSearchInstruction, webSearchPlugin } from "./web.mjs";
import { callProvider, callProviderStream, MineError, providerAvailable, providerConfigured } from "./providers.mjs";
import { redactSecrets } from "./env.mjs";

// Camada de roteamento da Mine: recebe um alias de nivel, decide como atender e
// devolve texto limpo. Quem chama nunca precisa saber qual modelo real rodou.

function extractFirstJsonObject(text) {
  const source = String(text || "");
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (start < 0) {
      if (char === "{") {
        start = index;
        depth = 1;
      }
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }

  return "";
}

function coerceJson(text) {
  const clean = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    const objectText = extractFirstJsonObject(clean);
    if (objectText) {
      try {
        return JSON.parse(objectText);
      } catch {
        // A interface nunca deve receber detalhe de parser.
      }
    }
    return null;
  }
}

// Defensivo: se o modelo insistir em embrulhar a resposta em JSON, desembrulha.
export function cleanReply(text) {
  let out = String(text || "").trim().replace(/^```(?:json|text)?\s*/i, "").replace(/```$/i, "").trim();
  if (out.startsWith("{") && /"reply"\s*:/.test(out)) {
    const parsed = coerceJson(out);
    if (parsed && typeof parsed.reply === "string" && parsed.reply.trim()) {
      out = parsed.reply.trim();
    }
  }
  return out;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

export function resolveTimeoutMs() {
  return clampNumber(process.env.AI_TIMEOUT_MS, 8_000, 120_000, 45_000);
}

// Orcamento total do pedido, somando todas as tentativas. Precisa caber no
// limite da plataforma: na Vercel o vercel.json corta a funcao em 60s, entao o
// padrao deixa uma folga para o handler responder antes do corte.
function resolveBudgetMs() {
  return clampNumber(process.env.MINE_TOTAL_BUDGET_MS, 10_000, 300_000, 55_000);
}

// Abaixo disso nao vale comecar outra tentativa: so gastaria o resto do tempo
// para estourar no meio.
const MIN_ATTEMPT_MS = 6_000;

// Log de uma linha, sem segredo e sem conteudo do usuario (documento, secao 25).
export function logMineCall(entry) {
  const parts = [
    `mine=${entry.alias}`,
    `provider=${entry.provider}`,
    `model=${entry.providerModel}`,
    `status=${entry.status}`,
    `ms=${entry.durationMs}`,
  ];
  if (entry.task) parts.push(`task=${entry.task}`);
  if (entry.fallbackFrom) parts.push(`fallbackDe=${entry.fallbackFrom}`);
  if (entry.tokens) parts.push(`tokens=${entry.tokens}`);
  if (entry.errorCode) parts.push(`erro=${entry.errorCode}`);
  console.log(`[mine] ${redactSecrets(parts.join(" "))}`);
}

/**
 * Le as imagens com um modelo de visao e devolve uma descricao textual.
 *
 * Serve para os niveis que nao aceitam imagem (SuperNova e Verso): o usuario
 * escolheu aquele nivel e continua vendo o nome dele, mas por baixo a imagem
 * passa por um modelo auxiliar antes (documento, secoes 8 e 10).
 */
async function describeImages({ attachments, prompt, timeoutMs, signal, requestedAlias }) {
  const aux = MINE_MODELS[VISION_AUX_ALIAS];
  const startedAt = Date.now();

  const messages = [
    { role: "system", content: buildVisionDescriptionInstruction() },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Descreva e transcreva as imagens abaixo. O usuario perguntou: "${String(prompt || "").slice(0, 500)}"`,
        },
        ...imagePartsFromAttachments(attachments),
      ],
    },
  ];

  try {
    const result = await callProvider({
      provider: aux.provider,
      providerModel: aux.providerModel,
      messages,
      maxTokens: 1200,
      timeoutMs,
      signal,
      providerParams: aux.providerParams,
    });
    logMineCall({
      alias: `${aux.alias}(visao)`,
      provider: aux.provider,
      providerModel: aux.providerModel,
      status: "ok",
      durationMs: result.durationMs,
      task: "visao",
      fallbackFrom: requestedAlias,
      tokens: result.usage.totalTokens,
    });
    return result.content;
  } catch (error) {
    logMineCall({
      alias: `${aux.alias}(visao)`,
      provider: aux.provider,
      providerModel: aux.providerModel,
      status: "erro",
      durationMs: Date.now() - startedAt,
      task: "visao",
      fallbackFrom: requestedAlias,
      errorCode: error?.code || "error",
    });
    throw error;
  }
}

/**
 * Tarefas que alimentam os jogos. Elas rodam quentes de proposito: com a
 * temperatura padrao (0.3) o modelo devolvia praticamente a mesma lista de
 * conceitos a cada partida, e a segunda partida virava copia da primeira.
 * O resto do app continua frio, porque ali repetir e o comportamento certo.
 */
const GAME_TASKS = new Set(["vf", "pares", "forca", "caca", "sequencia"]);

function gameBudgetMs() {
  return clampNumber(process.env.MINE_GAME_BUDGET_MS, 8_000, 30_000, 18_000);
}

function gameAttemptMs() {
  // O navegador libera a partida assim que o lote mínimo chega pelo stream.
  // Alguns modelos gratuitos começam em ~2 s, mas precisam de 10–12 s para
  // fechar cinco itens válidos; cortar em 9 s descartava um lote quase pronto.
  return clampNumber(process.env.MINE_GAME_TIMEOUT_MS, 5_000, 18_000, 12_000);
}

function temperatureForTask(task) {
  return GAME_TASKS.has(String(task || "").trim()) ? 0.95 : 0.3;
}

/**
 * Uma tentativa contra um modelo ja resolvido.
 * Com `onDelta` a resposta vem em streaming; sem ele, de uma vez so.
 */
async function attemptModel({ model, task, prompt, context, history, attachments, maxTokens, timeoutMs, signal, fallbackFrom, extraSystem = [], onDelta, plugins }) {
  if (!providerConfigured(model.provider)) {
    throw new MineError(`Provedor ${model.provider} sem credencial no servidor.`, { code: "config" });
  }

  const systemContent = buildInstructionForTask(task, context);
  const messages = buildMessages({
    systemContent,
    history,
    prompt,
    attachments,
    allowImages: model.capabilities.image,
    extraSystem,
  });

  const startedAt = Date.now();
  try {
    const call = onDelta ? callProviderStream : callProvider;
    const result = await call({
      provider: model.provider,
      providerModel: model.providerModel,
      messages,
      maxTokens,
      temperature: temperatureForTask(task),
      timeoutMs,
      signal,
      onDelta,
      plugins,
      providerParams: model.providerParams,
    });

    logMineCall({
      alias: model.alias,
      provider: model.provider,
      providerModel: model.providerModel,
      status: "ok",
      durationMs: result.durationMs,
      task,
      fallbackFrom,
      tokens: result.usage.totalTokens,
    });

    const reply = cleanReply(result.content);
    const qualityIssue = replyQualityIssue({ task, reply, prompt });
    if (qualityIssue) {
      throw new MineError(`Resposta rejeitada pelo controle de qualidade: ${qualityIssue}.`, {
        code: "empty",
        retryable: true,
      });
    }

    return {
      reply,
      alias: model.alias,
      displayName: model.displayName,
      sources: result.sources || [],
      usage: result.usage,
      durationMs: result.durationMs,
    };
  } catch (error) {
    logMineCall({
      alias: model.alias,
      provider: model.provider,
      providerModel: model.providerModel,
      status: "erro",
      durationMs: Date.now() - startedAt,
      task,
      fallbackFrom,
      errorCode: error?.code || "error",
    });
    throw error;
  }
}

/**
 * Executa um pedido da Mine com fallback.
 *
 * Tenta o nivel escolhido; se ele falhar de um jeito que vale retentar, desce
 * pela cadeia de niveis parecidos e, no fim, cai no provedor de emergencia.
 * Tudo dentro de um orcamento de tempo unico, para nunca estourar o limite da
 * plataforma no meio da terceira tentativa.
 */
export async function runMineRequest({
  alias,
  task = "",
  prompt = "",
  context = "",
  history = [],
  attachments = [],
  maxTokens = 1024,
  signal,
  onDelta,
  webSearch = false,
}) {
  const requested = resolveMineModel(alias);
  const gameTask = GAME_TASKS.has(String(task || "").trim());
  // Busca so acontece com as duas coisas juntas: o usuario pedindo e a flag do
  // servidor ligada. O servidor sempre tem a ultima palavra — a busca e paga.
  const useWeb = Boolean(webSearch) && webSearchEnabled();
  // Jogos precisam liberar a primeira rodada depressa. Um modelo gratuito que
  // trava nao pode segurar a tela por quase um minuto antes do fallback.
  const deadline = Date.now() + (gameTask ? gameBudgetMs() : resolveBudgetMs());
  const perAttemptMs = gameTask ? gameAttemptMs() : resolveTimeoutMs();

  // Medição real com os formatos dos jogos: o endpoint direto da NVIDIA entrega
  // o primeiro token em ~1 s e um lote curto em ~3,5 s. Nos jogos ele vem
  // primeiro; os níveis da família Mine continuam intactos no chat normal.
  const candidates = gameTask ? [EMERGENCY_MODEL, requested] : [requested];
  // Lua e Sol sao bons no chat, mas lentos para listas curtas. Se o provedor
  // rapido falhar, ainda tentamos o nivel pedido e a SuperNova.
  const fallbackAliases = gameTask ? ["supernova"] : MINE_FALLBACKS[requested.alias] || [];
  for (const nextAlias of fallbackAliases) {
    const model = MINE_MODELS[nextAlias];
    if (model && model !== requested) candidates.push(model);
  }
  // Gemini e Groq possuem cotas e infraestrutura independentes. Entram depois
  // dos niveis equivalentes, antes da rede de emergencia final.
  candidates.push(...RESILIENCE_MODELS);
  // Ultimo recurso, outro provedor: cobre o caso de o OpenRouter inteiro estar
  // fora do ar ou sem cota diaria.
  if (!gameTask) candidates.push(EMERGENCY_MODEL);

  // Modelo de provedor sem credencial sai da cadeia AQUI, e nao no meio da
  // tentativa: falta de credencial nao e erro retentavel, entao se ela fosse
  // descoberta durante o laco o pedido inteiro morreria em vez de descer para o
  // proximo. E exatamente o que aconteceria num ambiente que tem a chave de um
  // provedor e nao a do outro.
  const seenCandidates = new Set();
  const chain = candidates.filter((model) => {
    const key = `${model.provider}:${model.providerModel}`;
    if (seenCandidates.has(key) || !providerConfigured(model.provider)) return false;
    seenCandidates.add(key);
    return true;
  });

  if (!chain.length) {
    throw new MineError("Nenhum provedor de IA tem credencial configurada no servidor.", { code: "config" });
  }

  let lastError = null;
  let committed = false;

  // Descricao das imagens: calculada no maximo uma vez por pedido, e so se
  // algum modelo da cadeia precisar dela.
  const hasImages = imageAttachments(attachments).length > 0;
  let visionNote = null;

  async function visionContext(remaining) {
    if (!hasImages) return [];
    if (visionNote !== null) return visionNote ? [visionNote] : [];
    try {
      const description = await describeImages({
        attachments,
        prompt,
        timeoutMs: Math.min(perAttemptMs, remaining),
        signal,
        requestedAlias: requested.alias,
      });
      visionNote = `Descricao das imagens enviadas pelo usuario (leitura automatica; trate como o conteudo real das imagens):\n${description}`;
    } catch (error) {
      if (error?.code === "aborted") throw error;
      // Ler a imagem falhou: melhor a Mine assumir isso do que inventar o que
      // estava nela.
      visionNote =
        "O usuario enviou imagens, mas nao foi possivel ler o conteudo delas. Diga isso com clareza e peca para reenviar ou descrever o que aparece. Nunca invente o que estava na imagem.";
    }
    return [visionNote];
  }

  // A busca pode ser desligada no meio do pedido: se ela falhar, o mesmo modelo
  // e tentado de novo sem web, para a pergunta ser respondida assim mesmo
  // (documento, secao 13 — falha da ferramenta nao derruba o chat).
  let webActive = useWeb;
  let webNotice = "";

  for (let index = 0; index < chain.length; index += 1) {
    const model = chain[index];
    // Uma chave que recebeu 429/402/401 entra em cooldown. Os outros modelos do
    // mesmo provedor sao pulados sem desperdicarem o orcamento do pedido.
    if (!providerAvailable(model.provider)) continue;
    const remaining = deadline - Date.now();
    if (remaining < (gameTask ? 3_500 : MIN_ATTEMPT_MS)) break;

    try {
      const modelUsesWeb = webActive && model.provider === "openrouter";
      // Modelo que enxerga recebe a imagem direto; os outros recebem a
      // descricao textual gerada pelo auxiliar.
      const extraSystem = [
        ...(model.capabilities.image ? [] : await visionContext(remaining)),
        ...(modelUsesWeb ? [webSearchInstruction()] : []),
      ];
      const afterVision = deadline - Date.now();
      if (afterVision < (gameTask ? 3_500 : MIN_ATTEMPT_MS)) break;

      // Assim que o primeiro pedaco sai para o navegador, este modelo esta
      // escolhido: trocar por outro agora emendaria duas respostas diferentes.
      committed = false;
      const result = await attemptModel({
        model,
        task,
        prompt,
        context,
        history,
        attachments,
        maxTokens,
        timeoutMs: Math.min(perAttemptMs, afterVision),
        signal,
        fallbackFrom: model === requested ? undefined : requested.alias,
        extraSystem,
        plugins: modelUsesWeb ? webSearchPlugin() : undefined,
        onDelta: onDelta
          ? (text) => {
              committed = true;
              onDelta(text);
            }
          : undefined,
      });

      // O usuario escolheu um nivel: se outro respondeu, ele fica sabendo, sem
      // ver nome tecnico de modelo (documento, secao 20).
      const usedFallback = model !== requested;
      const hiddenReserve = model === EMERGENCY_MODEL || RESILIENCE_MODELS.includes(model);
      const fallbackWebNotice = useWeb && !modelUsesWeb ? "Não foi possível consultar a web nesta resposta." : "";
      return {
        ...result,
        // O nivel mostrado continua sendo o que o usuario escolheu quando a
        // reserva responde, porque ela nao e um nivel escolhivel.
        alias: hiddenReserve ? requested.alias : result.alias,
        notice:
          [
            usedFallback
              ? `${requested.displayName} está temporariamente indisponível. A resposta foi gerada por um modelo alternativo.`
              : "",
            webNotice || fallbackWebNotice,
          ]
            .filter(Boolean)
            .join(" ") || "",
      };
    } catch (error) {
      lastError = error;
      // Texto ja entregue ao navegador: nao da para recomecar com outro modelo.
      if (committed) throw error;

      // A chamada marcou a chave limitada/invalida em cooldown. Se existe outra
      // chave pronta no mesmo pool, repete o mesmo modelo antes de trocar a
      // qualidade ou o provedor da resposta.
      if (["rate_limit", "quota", "auth"].includes(error?.code) && providerAvailable(model.provider)) {
        index -= 1;
        continue;
      }

      // Primeira suspeita quando a busca esta ligada: a propria busca. Ela e
      // paga e recusa o pedido inteiro se a conta nao tiver credito. Desliga e
      // repete o MESMO modelo antes de culpar o modelo.
      if (webActive && error?.code !== "aborted") {
        webActive = false;
        webNotice = "Não foi possível consultar a web neste momento.";
        index -= 1;
        continue;
      }

      // Erro definitivo (credencial errada, pedido invalido, cancelamento):
      // insistir em outro modelo nao resolve.
      if (!error?.retryable) throw error;
    }
  }

  throw lastError || new MineError("Nenhum modelo conseguiu responder.", { code: "unavailable" });
}

export { MINE_MODELS };
