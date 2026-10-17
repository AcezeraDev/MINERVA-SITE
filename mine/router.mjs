import { MINE_CODE_MODEL, MINE_FAST_MODEL, MINE_MODEL, MINE_TASK_MODEL } from "./models.mjs";
import { buildMessages } from "./messages.mjs";
import { pickCodeSkills } from "./minecode-skills.mjs";
import { buildImageGenerationInstruction, buildImageRequestInstruction, buildImageStyleInstruction, buildInstructionForTask, buildMorePhotosInstruction, buildPhotoModeInstruction, buildSuggestionsInstruction, buildTutorInstruction } from "./prompts.mjs";
import { asksForImage, asksToGenerateImage, continuesGallery, continuesGeneration, extractSuggestions, imageStyleFrom, previousGalleryStyle, withImageStyle } from "../shared/chat-media.mjs";
import { repairMineCode, replyQualityIssue } from "./quality.mjs";
import { buildSearchQuery, cleanQueries, freshenQueries, matchesSearchTopic, matchesSourceScope, planSearchQueries, resultLimit, searchMany, searchSourcePolicy, searchWeb, WEB_SEARCH_TOOL, webSearchFailedInstruction, webSearchInstruction, webSearchMode } from "./web.mjs";
import { readTopPages } from "./page-reader.mjs";
import { callProvider, callProviderStream, MineError, providerAvailable, providerConfigured } from "./providers.mjs";
import { redactSecrets } from "./env.mjs";

// Camada de roteamento da Mine: decide qual modelo atende (principal ou reserva
// interna), pesquisa na web quando faz sentido e devolve texto limpo. Quem
// chama nunca precisa saber qual modelo real rodou.

// Defensivo: se o modelo insistir em embrulhar a resposta em JSON, desembrulha.
export function cleanReply(text, { prompt = "" } = {}) {
  const out = String(text || "").trim();
  if (/\b(json|c[oó]digo|programa[cç][aã]o)\b/i.test(prompt)) return out;
  // Codigo e JSON didatico sao conteudo: so desembrulhe um envelope de reply.
  const envelope = out.match(/^```(?:json|text)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i)?.[1] || out;
  if (envelope.startsWith("{") && /"reply"\s*:/.test(envelope)) {
    try {
      const parsed = JSON.parse(envelope);
      if (parsed && typeof parsed.reply === "string" && parsed.reply.trim() && Object.keys(parsed).every((key) => ["reply", "actions", "suggestions"].includes(key))) {
        return parsed.reply.trim();
      }
    } catch { /* Preserve conteudo que nao e um envelope JSON valido. */ }
  }
  return out;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

// Out/2026: respostas longas (ate ~6 mil tokens, com raciocinio) levam mais
// de um minuto inteiro em streaming. O teto por tentativa subiu junto com o
// maxDuration da funcao no vercel.json (300 s).
export function resolveTimeoutMs() {
  return clampNumber(process.env.AI_TIMEOUT_MS, 8_000, 240_000, 150_000);
}

// Orcamento total do pedido, somando todas as tentativas. Precisa caber no
// limite da plataforma: na Vercel o vercel.json corta a funcao em 300 s, entao
// o padrao deixa uma folga para o handler responder antes do corte.
function resolveBudgetMs() {
  return clampNumber(process.env.MINE_TOTAL_BUDGET_MS, 10_000, 290_000, 270_000);
}

// Leitura das paginas encontradas (mine/page-reader.mjs). MINE_WEB_READ_PAGES=off desliga.
function pageReadingEnabled() {
  return String(process.env.MINE_WEB_READ_PAGES || "").trim().toLowerCase() !== "off";
}

// Ferramenta de pesquisa no modo "auto". Se o provedor recusar ferramentas, o
// servidor deixa de oferecer por uma hora em vez de pagar um 400 por pergunta.
// MINE_WEB_TOOL=off desliga de vez (o modo "auto" vira so a regra de palavras).
let toolsBlockedUntil = 0;
function toolsSupported() {
  if (String(process.env.MINE_WEB_TOOL || "").trim().toLowerCase() === "off") return false;
  return Date.now() >= toolsBlockedUntil;
}
function markToolsUnsupported() {
  toolsBlockedUntil = Date.now() + 60 * 60_000;
  console.log("[mine] ferramenta=recusada pelo provedor; pausada por 1h");
}

// Abaixo disso nao vale comecar outra tentativa: so gastaria o resto do tempo
// para estourar no meio.
const MIN_ATTEMPT_MS = 6_000;

// Log de uma linha, sem segredo e sem conteudo do usuario (documento, secao 25).
export function logMineCall(entry) {
  const parts = [
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
 * Tarefas que alimentam os jogos.
 *
 * Identificam as tarefas de jogo no roteamento (reserva rapida primeiro) e no
 * orcamento de tempo, que e mais curto que o do chat.
 */
const GAME_TASKS = new Set(["vf", "pares", "forca", "caca", "sequencia"]);
// O titulo da conversa tambem vai pela reserva rapida: e uma linha so.
// A dica do "Por que?" da aba Idiomas tambem: sao tres frases. A conversa
// (idioma-conversa) NAO entra: testada em out/2026, a reserva rapida errava
// ingles ("I check your passport now") e trocava a pessoa na correcao; o
// ingles da Mine e o modelo que o aluno copia, entao vai no modelo principal.
const FAST_TASKS = new Set([...GAME_TASKS, "title", "idioma-dica"]);

// Medido em producao em 2026-09-04, `caca` com 6 perguntas no gpt-5-mini:
// 14,4 s para o pedido antigo e 17,0 s com a folga de ineditismo. O padrao de
// 18 s de orcamento com 12 s por tentativa vinha dos modelos gratuitos do
// OpenRouter e nao cabia mais nem antes desta mudanca — o pedido completo
// (com angulo e lista de bloqueio) devolvia 504 em 18,4 s. Os numeros abaixo
// deixam uma tentativa inteira caber com folga e ainda sobra para o fallback,
// bem dentro dos 55 s de orcamento total e dos 60 s da funcao na Vercel.
function gameBudgetMs() {
  return clampNumber(process.env.MINE_GAME_BUDGET_MS, 8_000, 30_000, 28_000);
}

function gameAttemptMs() {
  return clampNumber(process.env.MINE_GAME_TIMEOUT_MS, 5_000, 18_000, 17_000);
}

// Nao existe temperatura por tarefa: os modelos de raciocinio da OpenAI
// recusam o parametro. A variacao das partidas vem do prompt e do filtro de
// ineditismo no cliente.

/**
 * Sites (skill de front-end) pedem mais raciocinio: com "low" o GLM entregava
 * paginas genericas. Codigo curto de Python/JS segue com o padrao do modelo.
 * MINE_CODE_SITE_REASONING_EFFORT troca o nivel dos sites.
 */
function codeModelFor({ prompt, context, history }) {
  if (!pickCodeSkills({ prompt, context, history }).includes("frontend")) return MINE_CODE_MODEL;
  const effort = String(process.env.MINE_CODE_SITE_REASONING_EFFORT || "high").trim().toLowerCase();
  return { ...MINE_CODE_MODEL, providerParams: { reasoning_effort: ["low", "high", "max"].includes(effort) ? effort : "high" } };
}

/**
 * Uma tentativa contra um modelo ja resolvido.
 * Com `onDelta` a resposta vem em streaming; sem ele, de uma vez so.
 */
async function attemptModel({ model, task, prompt, context, history, attachments, maxTokens, timeoutMs, signal, fallback, extraSystem = [], onDelta, onReasoning, tools, toolChoice }) {
  const systemContent = buildInstructionForTask(task, context, { prompt, history });
  const messages = buildMessages({ systemContent, history, prompt, attachments, allowImages: model.capabilities.image, extraSystem });

  const startedAt = Date.now();
  try {
    const call = onDelta ? callProviderStream : callProvider;
    const result = await call({
      provider: model.provider,
      providerModel: model.providerModel,
      messages,
      maxTokens,
      timeoutMs,
      signal,
      onDelta,
      onReasoning,
      providerParams: model.providerParams,
      tools,
      toolChoice,
    });

    logMineCall({
      provider: model.provider,
      providerModel: model.providerModel,
      status: "ok",
      durationMs: result.durationMs,
      task,
      fallbackFrom: fallback ? "principal" : undefined,
      tokens: result.usage.totalTokens,
    });

    // Pediu uma pesquisa e ainda nao escreveu nada: quem chama pesquisa e
    // pergunta de novo, entao nao ha resposta para avaliar.
    const search = (result.toolCalls || []).find((call) => call.name === WEB_SEARCH_TOOL.function.name);
    if (search && !String(result.content || "").trim()) {
      return { toolQueries: cleanQueries(search.arguments?.consultas ?? search.arguments?.consulta), reasoning: result.reasoning, usage: result.usage, durationMs: result.durationMs };
    }

    let reply = cleanReply(result.content, { prompt });
    let qualityIssue = replyQualityIssue({ task, reply, prompt, finishReason: result.finishReason });
    // MineCode com palavra perdida no codigo: se tirar as linhas da palavra
    // deixa o arquivo limpo, o conserto sai daqui mesmo, sem outra chamada.
    if (qualityIssue && task === "minecode" && result.finishReason !== "length") {
      const repaired = repairMineCode(reply);
      if (repaired) {
        console.log(`[mine] minecode=consertado model=${model.providerModel} ${qualityIssue.replace(/"[^"]*"/g, "\"…\"")}`);
        reply = repaired;
        qualityIssue = "";
      }
    }
    if (qualityIssue) {
      const error = new MineError(`Resposta rejeitada pelo controle de qualidade: ${qualityIssue}.`, { code: "empty", retryable: true });
      // O codigo com defeito ainda serve de ultimo recurso: e melhor que nada
      // se nenhum outro modelo conseguir refazer a tempo.
      if (task === "minecode" && result.finishReason !== "length") Object.assign(error, { badCode: { reply, issue: qualityIssue, reasoning: result.reasoning, usage: result.usage, durationMs: result.durationMs } });
      throw error;
    }

    return { reply, reasoning: result.reasoning, usage: result.usage, durationMs: result.durationMs };
  } catch (error) {
    logMineCall({
      provider: model.provider,
      providerModel: model.providerModel,
      status: "erro",
      durationMs: Date.now() - startedAt,
      task,
      fallbackFrom: fallback ? "principal" : undefined,
      errorCode: error?.code || "error",
    });
    throw error;
  }
}

/**
 * Pesquisa na web antes de responder. Devolve a instrucao extra para o modelo,
 * as fontes para o navegador e um aviso quando a busca falhou.
 */
async function prepareWebContext({ prompt, history, signal, deadline, queries: givenQueries = [], onStatus }) {
  const policy = searchSourcePolicy(prompt, history);
  const originalQuery = buildSearchQuery(prompt, history);
  const startedAt = Date.now();
  try {
    // A busca nao pode comer o tempo da resposta: fica com no maximo 14 s
    // (plano, consultas e leitura das paginas) e sempre deixa uns 30 s de
    // orcamento para o modelo.
    const searchDeadline = Math.min(deadline - 30_000, Date.now() + 14_000);
    // As consultas sao do modelo — as que ele pediu pela ferramenta ou as que
    // o modelo rapido escreveu. Com orgao oficial no assunto (Inep, IBGE...),
    // a primeira vira consulta dirigida (site:); se a fonte oficial foi
    // exigida, so ela roda, para nao entregar terceiros como oficiais.
    const planned = freshenQueries(
      givenQueries.length
        ? givenQueries
        : await planSearchQueries(prompt, history, { signal, timeoutMs: Math.min(6_000, Math.max(1, searchDeadline - Date.now() - 6_000)) }),
      prompt,
    );
    const first = planned[0] || originalQuery;
    const queries = policy.scopes.length
      ? [`site:${policy.scopes[0]} ${first}`, ...(policy.required ? [] : planned.slice(1))]
      : planned.length ? planned : [originalQuery];
    const query = queries[0];
    onStatus?.({ stage: "searching", queries });
    let { results } = await searchMany(queries, { signal, timeoutMs: Math.max(1, searchDeadline - Date.now()) });
    const official = (items) => items.filter((item) => matchesSourceScope(item.url, policy.scopes) && matchesSearchTopic(item, policy));
    // Um refinamento no mesmo orcamento: nunca entregue terceiros como fonte oficial.
    if (policy.scopes.length && !official(results).length && searchDeadline - Date.now() >= 2_000) {
      const scope = policy.scopes[1] || policy.scopes[0];
      const terms = policy.topic ? `${policy.topic} ${originalQuery.match(/\b20\d{2}\b/)?.[0] || ""} datas provas inscrições edital` : originalQuery.replace(/(?:por favor|pesquise|na internet|use o inep como fonte|e forneça o link)/gi, " ");
      const refined = `site:${scope} ${terms.replace(/\s+/g, " ").trim()}`;
      try {
        const second = await searchWeb(refined, { signal, timeoutMs: searchDeadline - Date.now() });
        results = [...results, ...second.results].filter((item, index, all) => all.findIndex((other) => other.url === item.url) === index);
      } catch (error) {
        if (error?.code === "aborted") throw error;
        // Preserve o que a primeira consulta encontrou se o refinamento falhar.
        console.log(`[mine] web=refinamento_falhou codigo=${error?.code || "erro"}`);
      }
    }
    if (policy.scopes.length) {
      results = policy.required ? official(results) : [...official(results), ...results.filter((item) => !matchesSourceScope(item.url, policy.scopes))];
    }
    results = results.filter((item) => matchesSearchTopic(item, policy));
    results = results.slice(0, resultLimit());
    if (!results.length) {
      console.log(`[mine] web=vazio consultas=${queries.length} ms=${Date.now() - startedAt}`);
      return { extraSystem: [webSearchFailedInstruction(policy)], sources: [], queries, notice: policy.required ? "Não encontrei uma fonte oficial que confirme esta informação." : "A busca na web não encontrou resultados para esta pergunta." };
    }
    const sources = results.map(({ url, title, domain, snippet }) => ({ url, title, domain, snippet: String(snippet || "").slice(0, 240) }));
    onStatus?.({ stage: "reading", queries, sources });
    // As melhores paginas sao abertas: o trecho da busca raramente traz o
    // detalhe (a data no meio do edital, o numero da tabela).
    const readMs = searchDeadline - Date.now();
    if (pageReadingEnabled() && readMs >= 1_500) {
      results = await readTopPages(results, queries.join(" "), { count: 3, signal, timeoutMs: Math.min(4_500, readMs) });
    }
    if (signal?.aborted) throw new MineError("Geração cancelada.", { code: "aborted" });
    const read = results.filter((item) => item.content).length;
    console.log(`[mine] web=ok consultas=${queries.length} resultados=${results.length} lidas=${read} ms=${Date.now() - startedAt}`);
    return {
      extraSystem: [webSearchInstruction(results, query, policy)],
      sources,
      queries,
      notice: "",
    };
  } catch (error) {
    if (error?.code === "aborted" || signal?.aborted) throw new MineError("Geração cancelada.", { code: "aborted" });
    console.log(`[mine] ${redactSecrets(`web=erro codigo=${error?.code || "erro"} ms=${Date.now() - startedAt} ${error?.message || ""}`)}`);
    return { extraSystem: [webSearchFailedInstruction(policy)], sources: [], queries: [], notice: "Não foi possível consultar a web neste momento." };
  }
}

/**
 * Executa um pedido da Mine.
 *
 * Chat: modelo principal, com a reserva interna se ele falhar. Tarefas
 * estruturadas: o principal com raciocinio curto. Jogos: a reserva rapida
 * primeiro, porque a rodada precisa sair em segundos. Tudo dentro de um
 * orcamento de tempo unico, para nunca estourar o limite da plataforma.
 */
export async function runMineRequest({
  task = "",
  prompt = "",
  context = "",
  history = [],
  attachments = [],
  maxTokens = 1024,
  signal,
  onDelta,
  onReasoning,
  onStatus,
  webSearch = false,
  photos = false,
  tutor = false,
}) {
  const cleanTask = String(task || "").trim();
  const gameTask = FAST_TASKS.has(cleanTask);
  const deadline = Date.now() + (gameTask ? gameBudgetMs() : resolveBudgetMs());
  // Tarefas estruturadas sao curtas e sem streaming: 60 s por tentativa basta
  // e deixa a reserva entrar a tempo se o principal travar.
  // o MineCode escreve arquivos inteiros em streaming (um site 3D passa de 1
  // minuto): fica com o teto do chat, nao com os 60 s das tarefas curtas
  const perAttemptMs = gameTask ? gameAttemptMs() : cleanTask && cleanTask !== "minecode" ? Math.min(60_000, resolveTimeoutMs()) : resolveTimeoutMs();
  const minAttemptMs = gameTask ? 3_500 : MIN_ATTEMPT_MS;

  const principal = cleanTask ? MINE_TASK_MODEL : MINE_MODEL;
  const candidates = gameTask
    ? [MINE_FAST_MODEL, MINE_TASK_MODEL]
    : cleanTask === "minecode"
      ? [codeModelFor({ prompt, context, history }), MINE_TASK_MODEL]
      : [principal, MINE_FAST_MODEL];
  const seen = new Set();
  const chain = candidates.filter((model) => {
    const key = `${model.provider}:${model.providerModel}:${model.providerParams?.reasoning_effort || ""}`;
    if (seen.has(key) || !providerConfigured(model.provider)) return false;
    seen.add(key);
    return true;
  });
  if (!chain.length) {
    throw new MineError("Nenhum provedor de IA tem credencial configurada no servidor.", { code: "config" });
  }

  // Web em tres jeitos (ver webSearchMode). No "force" a busca acontece uma
  // vez, antes da primeira tentativa: a reserva, se entrar, recebe os mesmos
  // resultados e as fontes nao mudam. No "auto" a Mine recebe a ferramenta
  // `pesquisar_web` e decide sozinha; se pedir, a busca roda e a mesma
  // tentativa recomeca ja com os resultados.
  const mode = webSearchMode({ requested: webSearch, prompt, task: cleanTask, history });
  const empty = { extraSystem: [], sources: [], queries: [], notice: "" };
  let web = mode === "force" ? await prepareWebContext({ prompt, history, signal, deadline, onStatus }) : empty;
  let offerTool = mode === "auto" && toolsSupported();

  // Criar imagem ("cria um gato astronauta") ou ajustar a que acabou de ser
  // criada ("deixa o fundo azul") vence a busca de fotos: o verbo de criação
  // diz que a imagem ainda não existe.
  const previousGenerated = cleanTask ? "" : continuesGeneration(prompt, history);
  const wantsGeneration = !cleanTask && (asksToGenerateImage(prompt) || Boolean(previousGenerated));
  const previousGallery = cleanTask || wantsGeneration ? "" : continuesGallery(prompt, history);
  // "Icons da Ellie": o estilo pedido vai para o marcador. Vale tambem para
  // "manda mais" depois de uma galeria de icones.
  const wantsImage = !cleanTask && !wantsGeneration && (photos || asksForImage(prompt) || Boolean(previousGallery));
  const imageStyle = wantsImage ? imageStyleFrom(prompt) || (previousGallery ? previousGalleryStyle(history) : "") : "";
  const baseSystem = [
    ...(wantsGeneration ? [buildImageGenerationInstruction({ previousPrompt: previousGenerated })] : []),
    // Modo fotos e do chat livre: uma task (simulado, mapa, jogo) tem formato
    // proprio, e um marcador de imagem no meio dela quebraria o parser.
    ...(cleanTask || wantsGeneration ? [] : photos ? [buildPhotoModeInstruction()] : asksForImage(prompt) || previousGallery ? [buildImageRequestInstruction()] : []),
    // "Manda mais" depois de uma galeria: o mesmo termo devolveria as mesmas
    // fotos (a galeria fica em cache por termo), então a Mine varia o termo.
    ...(cleanTask || !previousGallery ? [] : [buildMorePhotosInstruction(previousGallery)]),
    ...(imageStyle ? [buildImageStyleInstruction(imageStyle)] : []),
    // Tutor e sugestoes sao do chat livre: tarefas tem formato proprio.
    ...(cleanTask ? [] : tutor ? [buildTutorInstruction()] : []),
    ...(cleanTask ? [] : [buildSuggestionsInstruction({ tutor: Boolean(tutor) })]),
  ];

  let lastError = null;
  let committed = false;
  let reasoning = "";
  // MineCode com codigo quebrado (palavra perdida, erro de sintaxe) que o
  // conserto local nao resolveu. O editor ja recebeu o texto ao vivo, mas o
  // evento final ("done") substitui tudo no cliente: entao o proximo modelo
  // da cadeia refaz o arquivo SEM streaming, e a versao dele vai no "done".
  // Se nenhum conseguir, a primeira versao e entregue como antes.
  let badCode = null;
  let streamOff = false;
  let fixNote = [];

  const deliver = (result) => {
    // O marcador de sugestoes sai do texto e vira lista a parte; nas tarefas
    // ele nunca foi pedido, entao a resposta passa intacta.
    const { text: extracted, suggestions } = cleanTask ? { text: result.reply, suggestions: [] } : extractSuggestions(result.reply);
    // O modelo as vezes esquece o terceiro campo; a versao final (que vale
    // mais que o streaming) sai com o estilo que o estudante pediu.
    const reply = imageStyle ? withImageStyle(extracted, imageStyle) : extracted;
    return {
      ...result,
      reply: reply || result.reply,
      reasoning: (reasoning || result.reasoning || "").trim(),
      suggestions,
      alias: MINE_MODEL.alias,
      displayName: MINE_MODEL.displayName,
      sources: web.sources,
      queries: web.queries || [],
      notice: web.notice,
    };
  };

  for (let index = 0; index < chain.length; index += 1) {
    const model = chain[index];
    // Chave que recebeu 429/402/401 esta em cooldown: nao repete em vao.
    if (!providerAvailable(model.provider)) continue;
    const remaining = deadline - Date.now();
    if (remaining < minAttemptMs) break;

    const tools = offerTool ? [WEB_SEARCH_TOOL] : undefined;
    try {
      committed = false;
      const result = await attemptModel({
        model,
        task: cleanTask,
        prompt,
        context,
        history,
        attachments,
        maxTokens,
        // Refazer o arquivo inteiro sem streaming demora mais que uma
        // tentativa comum de tarefa: usa o que sobra do orcamento.
        timeoutMs: Math.min(badCode ? resolveTimeoutMs() : perAttemptMs, remaining),
        signal,
        fallback: index > 0 && !gameTask,
        extraSystem: [...web.extraSystem, ...baseSystem, ...fixNote],
        tools,
        onDelta: onDelta && !streamOff
          ? (text) => {
              committed = true;
              onDelta(text);
            }
          : undefined,
        onReasoning: onReasoning && !streamOff
          ? (text) => {
              reasoning += text;
              onReasoning(text);
            }
          : undefined,
      });
      if (result.toolQueries) {
        // A Mine pediu para pesquisar: busca com as consultas dela e a mesma
        // tentativa recomeca, agora sem a ferramenta (uma rodada so).
        offerTool = false;
        web = await prepareWebContext({ prompt, history, signal, deadline, queries: result.toolQueries, onStatus });
        index -= 1;
        continue;
      }
      return deliver(result);
    } catch (error) {
      lastError = error;
      if (error?.badCode) {
        badCode ||= error.badCode;
        fixNote = [`Atencao: uma versao anterior deste arquivo saiu com defeito (${error.badCode.issue}). Escreva o arquivo inteiro de novo, revisando que nenhuma palavra solta fique no meio do CSS ou do JavaScript e que a sintaxe esteja valida.`];
        // Ja foi para a tela: as proximas tentativas vem inteiras, sem streaming.
        if (committed) streamOff = true;
      } else if (committed) {
        // Texto ja entregue ao navegador: nao da para recomecar com outro modelo.
        throw error;
      }
      // Provedor que nao aceita ferramentas responde 400: a mesma tentativa
      // repete sem ela, e o servidor para de oferecer por um tempo.
      if (tools && !error?.retryable && (error?.status === 400 || error?.status === 422)) {
        markToolsUnsupported();
        offerTool = false;
        index -= 1;
        continue;
      }
      // A chave limitada entrou em cooldown; se ha outra pronta no pool, repete
      // o mesmo modelo antes de cair para a reserva.
      if (["rate_limit", "quota", "auth"].includes(error?.code) && providerAvailable(model.provider)) {
        index -= 1;
        continue;
      }
      if (!error?.retryable) {
        if (badCode && error?.code !== "aborted") break;
        throw error;
      }
    }
  }

  if (badCode && !signal?.aborted) {
    console.log("[mine] minecode=entregue_com_defeito nenhum modelo refez o arquivo a tempo");
    return deliver(badCode);
  }
  throw lastError || new MineError("Nenhum modelo conseguiu responder.", { code: "unavailable" });
}
