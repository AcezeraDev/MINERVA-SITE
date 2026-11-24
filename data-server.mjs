import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import pg from "pg";
import { loadLocalEnv } from "./gemini-server.mjs";
import { gamificationStats, levelFromXp, rankingWindows, totalXp, unlockedAchievements, xpSince } from "./shared/xp.mjs";
import { dailyChallengeKey, leagueFromPoints, melhorPorJogo, seasonPoints } from "./shared/game-meta.mjs";
import { nomePublico } from "./shared/nome-publico.mjs";
import { parseQuiz } from "./shared/study-parsers.mjs";
import {
  PERGUNTAS_POR_DUELO,
  SALA_EXPIRA_MS,
  abandonar,
  avancar,
  codigoValido,
  conferirSumico,
  criarDuelo,
  embaralharPergunta,
  entrarNoDuelo,
  lerConferencia,
  limparPerguntas,
  novoCodigo,
  perguntasConferidas,
  textoParaConferir,
  responder,
  vistaDe,
} from "./shared/duelo.mjs";
import { perguntasDaReserva } from "./shared/duelo-reserva.mjs";
import {
  chamaMine,
  codigoSalaValido,
  conversaParaMine,
  criarSala,
  entrarNaSala,
  fotoValida,
  limparTextoMensagem,
  novoCodigoSala,
  sairDaSala,
  tocarNaSala,
  vistaSala,
} from "./shared/sala.mjs";
import { verificacaoParaMine } from "./shared/sala-contas.mjs";
import { runMineRequest } from "./mine/router.mjs";
import { pageForPanel } from "./mine/page-reader.mjs";
import { questoesEnem } from "./mine/tools.mjs";
import { searchWeb, webSearchEnabled } from "./mine/web.mjs";
import { buscarLivro, buscarVideos, textoDoLivro } from "./mine/estante.mjs";
import { readYoutubeVideo, youtubeId } from "./mine/video.mjs";
import { ATELIE_DAILY_LIMIT, AtelieError, coloringPageFromPhoto } from "./atelie-ia.mjs";
import { MINE_IMAGE_DAILY_LIMIT, MineImageError, generateMineImage } from "./mine/image-gen.mjs";
import { MINE_VOICE_DAILY_LIMIT, MineVoiceError, synthesizeVoice } from "./mine/voice.mjs";

const { Pool } = pg;
const scrypt = promisify(scryptCallback);
loadLocalEnv();
const localStorePath = resolve(process.cwd(), ".data/minerva-db.json");
function normalizeDatabaseUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    const sslMode = url.searchParams.get("sslmode");
    if (["prefer", "require", "verify-ca"].includes(sslMode || "")) {
      url.searchParams.set("sslmode", "verify-full");
    }
    return url.toString();
  } catch {
    return value;
  }
}

/**
 * Escotilha de desenvolvimento: com `MINERVA_LOCAL_DB=1` o servidor ignora o
 * DATABASE_URL e guarda tudo em `.data/minerva-db.json`.
 *
 * Existe porque o `.env.local` deste projeto traz o banco de PRODUÇÃO — o
 * `npm run dev` fala com o Neon real sem avisar, e um cadastro de teste vira
 * uma conta de verdade no site. Com esta variável dá para brincar à vontade.
 */
const forceLocalStore = process.env.MINERVA_LOCAL_DB === "1";
const databaseUrl = forceLocalStore ? "" : normalizeDatabaseUrl(process.env.DATABASE_URL || "");
const usePostgres = Boolean(databaseUrl);
const sessionTtlMs = 1000 * 60 * 60 * 24 * 30;
const pool =
  usePostgres
    ? new Pool({
        connectionString: databaseUrl,
        // O certificado do servidor e validado de verdade. Antes ficava em
        // `rejectUnauthorized: false`, o que anulava o `sslmode=verify-full`
        // que `normalizeDatabaseUrl` acabou de forcar na URL: a conexao ia
        // cifrada, mas sem conferir quem estava do outro lado. Banco que nao
        // apresenta cadeia confiavel deve usar `DATABASE_SSL=false` de forma
        // explicita, nunca uma validacao desligada em silencio.
        ssl:
          process.env.DATABASE_SSL === "false" || databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")
            ? false
            : { rejectUnauthorized: true },
      })
    : null;

let databaseReady = false;

function emptyData() {
  return {
    users: [],
    currentUserId: null,
    currentAdminUserId: null,
    subjects: [],
    materials: [],
    tasks: [],
    chats: [],
    sessions: [],
    flashcards: [],
    comments: [],
    suggestions: [],
    updates: [],
  };
}

function defaultSettings(name) {
  return {
    displayName: name,
    dailyGoal: 60,
    focusMinutes: 25,
    mineStyle: "equilibrada",
    reminders: true,
    themeMode: "light",
    accentColor: "#39F59A",
  };
}

/** Uma foto vinda da tela de perfil tem ~15KB. O teto é folga, não alvo. */
const avatarStoreLimit = 400_000;

function safeUser(user) {
  const { password: _password, ...rest } = user || {};
  const name = String(rest.name || "").trim();
  const settings = {
    ...defaultSettings(name),
    ...(rest.settings || {}),
    displayName: String(rest.settings?.displayName || name),
  };
  // O estado inteiro é um JSON só, com PUT limitado a 10MB: uma foto solta
  // grande demais derrubaria o salvamento de tudo, não só o dela.
  if (typeof settings.avatar !== "string" || !settings.avatar.startsWith("data:image/") || settings.avatar.length > avatarStoreLimit) {
    delete settings.avatar;
  }
  if (typeof settings.bio === "string") settings.bio = settings.bio.slice(0, 280);
  else delete settings.bio;
  return {
    id: String(rest.id || uid("user")),
    name,
    isAdmin: Boolean(rest.isAdmin),
    createdAt: Number(rest.createdAt || Date.now()),
    settings,
  };
}

function sanitizeData(data) {
  const source = data || {};
  return {
    users: Array.isArray(source.users) ? source.users.map(safeUser) : [],
    currentUserId: null,
    currentAdminUserId: null,
    subjects: Array.isArray(source.subjects) ? source.subjects : [],
    materials: Array.isArray(source.materials) ? source.materials : [],
    tasks: Array.isArray(source.tasks) ? source.tasks : [],
    chats: Array.isArray(source.chats) ? source.chats : [],
    sessions: Array.isArray(source.sessions) ? source.sessions : [],
    flashcards: Array.isArray(source.flashcards) ? source.flashcards : [],
    comments: Array.isArray(source.comments) ? source.comments : [],
    suggestions: Array.isArray(source.suggestions) ? source.suggestions : [],
    updates: Array.isArray(source.updates) ? source.updates : [],
  };
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function ensurePostgres() {
  if (!pool || databaseReady) return;
  await pool.query(`
    create table if not exists minerva_state (
      id text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )
  `);
  await pool.query(`
    create table if not exists minerva_credentials (
      user_id text primary key,
      password_hash text not null,
      updated_at timestamptz not null default now()
    )
  `);
  await pool.query(`
    create table if not exists minerva_sessions (
      token text primary key,
      user_id text not null,
      is_admin boolean not null default false,
      expires_at timestamptz not null
    )
  `);
  await pool.query(`
    create table if not exists minerva_quota (
      user_id text not null,
      kind text not null,
      day date not null,
      used integer not null default 0,
      primary key (user_id, kind, day)
    )
  `);
  await pool.query(
    `insert into minerva_state (id, data) values ($1, $2::jsonb) on conflict (id) do nothing`,
    ["main", JSON.stringify(emptyData())],
  );
  databaseReady = true;
}

async function readStore() {
  if (pool) {
    await ensurePostgres();
    const [stateResult, credentialsResult] = await Promise.all([
      pool.query(`select data from minerva_state where id = $1`, ["main"]),
      pool.query(`select user_id, password_hash from minerva_credentials`),
    ]);
    return {
      data: sanitizeData(stateResult.rows[0]?.data || emptyData()),
      credentials: Object.fromEntries(credentialsResult.rows.map((row) => [row.user_id, row.password_hash])),
    };
  }

  try {
    const raw = await readFile(localStorePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      data: sanitizeData(parsed.data || emptyData()),
      credentials: parsed.credentials || {},
      sessions: parsed.sessions || {},
    };
  } catch {
    return { data: emptyData(), credentials: {}, sessions: {} };
  }
}

async function writeLocalStore(store) {
  await mkdir(dirname(localStorePath), { recursive: true });
  await writeFile(localStorePath, JSON.stringify(store, null, 2), "utf8");
}

async function saveData(data) {
  const safe = sanitizeData(data);
  if (pool) {
    await ensurePostgres();
    await pool.query(
      `insert into minerva_state (id, data, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (id) do update set data = excluded.data, updated_at = now()`,
      ["main", JSON.stringify(safe)],
    );
    return safe;
  }

  const store = await readStore();
  await writeLocalStore({ ...store, data: safe });
  return safe;
}

async function saveCredential(userId, passwordHash) {
  if (pool) {
    await ensurePostgres();
    await pool.query(
      `insert into minerva_credentials (user_id, password_hash, updated_at)
       values ($1, $2, now())
       on conflict (user_id) do update set password_hash = excluded.password_hash, updated_at = now()`,
      [userId, passwordHash],
    );
    return;
  }

  const store = await readStore();
  await writeLocalStore({ ...store, credentials: { ...store.credentials, [userId]: passwordHash } });
}

async function deleteCredential(userId) {
  if (pool) {
    await ensurePostgres();
    await pool.query(`delete from minerva_credentials where user_id = $1`, [userId]);
    return;
  }
  const store = await readStore();
  const credentials = { ...store.credentials };
  delete credentials[userId];
  await writeLocalStore({ ...store, credentials });
}

async function deleteUserSessions(userId) {
  if (pool) {
    await ensurePostgres();
    await pool.query(`delete from minerva_sessions where user_id = $1`, [userId]);
    return;
  }
  const store = await readStore();
  const sessions = Object.fromEntries(Object.entries(store.sessions || {}).filter(([, session]) => session.userId !== userId));
  await writeLocalStore({ ...store, sessions });
}

function dataForSession(data, session) {
  const safe = sanitizeData(data);
  const userId = session.userId;
  const sessionUser = safe.users.find((user) => user.id === userId);
  if (session.isAdmin || sessionUser?.isAdmin) return safe;
  return {
    ...safe,
    users: safe.users.filter((user) => user.id === userId),
    subjects: safe.subjects.filter((item) => item.userId === userId),
    materials: safe.materials.filter((item) => item.userId === userId),
    tasks: safe.tasks.filter((item) => item.userId === userId),
    chats: safe.chats.filter((item) => item.userId === userId),
    sessions: safe.sessions.filter((item) => item.userId === userId),
    flashcards: safe.flashcards.filter((item) => item.userId === userId),
    // Comentários e sugestões são públicos: todos os clientes veem os de todos (moderação no admin).
  };
}

function mergeUserData(currentData, incomingData, session) {
  const current = sanitizeData(currentData);
  const incoming = sanitizeData(incomingData);
  const userId = session.userId;
  const existingUser = current.users.find((user) => user.id === userId);
  // Clientes antigos (bundle em cache) podem enviar dados sem campos novos;
  // nesse caso preserva os dados atuais em vez de zerar tudo.
  const incomingHasComments = Array.isArray(incomingData?.comments);
  const incomingHasSuggestions = Array.isArray(incomingData?.suggestions);
  const incomingHasUpdates = Array.isArray(incomingData?.updates);
  const adminSession = session.isAdmin || existingUser?.isAdmin;
  const incomingUserIds = new Set(incoming.users.map((user) => user.id));
  // Um snapshot administrativo completo precisa carregar todos os usuarios que
  // ja existem. Isso impede que uma atualizacao parcial de perfil/avatar seja
  // confundida com o banco inteiro e apague as outras contas.
  const completeAdminSnapshot = adminSession && current.users.every((user) => incomingUserIds.has(user.id));
  if (completeAdminSnapshot) {
    return {
      ...incoming,
      comments: incomingHasComments ? incoming.comments : current.comments,
      suggestions: incomingHasSuggestions ? incoming.suggestions : current.suggestions,
      updates: incomingHasUpdates ? incoming.updates : current.updates,
    };
  }
  const incomingUser = incoming.users.find((user) => user.id === userId);
  const mergedUser = existingUser
    ? { ...existingUser, ...(incomingUser || {}), id: userId, isAdmin: existingUser.isAdmin }
    : incomingUser;

  return {
    ...current,
    users: mergedUser ? [...current.users.filter((user) => user.id !== userId), mergedUser] : current.users,
    subjects: [...current.subjects.filter((item) => item.userId !== userId), ...incoming.subjects.filter((item) => item.userId === userId)],
    materials: [...current.materials.filter((item) => item.userId !== userId), ...incoming.materials.filter((item) => item.userId === userId)],
    tasks: [...current.tasks.filter((item) => item.userId !== userId), ...incoming.tasks.filter((item) => item.userId === userId)],
    chats: [...current.chats.filter((item) => item.userId !== userId), ...incoming.chats.filter((item) => item.userId === userId)],
    sessions: [...current.sessions.filter((item) => item.userId !== userId), ...incoming.sessions.filter((item) => item.userId === userId)],
    flashcards: [...current.flashcards.filter((item) => item.userId !== userId), ...incoming.flashcards.filter((item) => item.userId === userId)],
    comments: incomingHasComments
      ? [...current.comments.filter((item) => item.userId !== userId), ...incoming.comments.filter((item) => item.userId === userId)]
      : current.comments,
    suggestions: incomingHasSuggestions
      ? [...current.suggestions.filter((item) => item.userId !== userId), ...incoming.suggestions.filter((item) => item.userId === userId)]
      : current.suggestions,
    // Atualizações são publicadas apenas por administradores; clientes comuns nunca as alteram.
    updates: current.updates,
  };
}

/**
 * Atualiza o documento central sob bloqueio de linha no Postgres. Sem esse
 * bloqueio, duas pessoas salvando quase juntas podem ler a mesma versão e a
 * última gravação apagar a primeira, mesmo quando o merge por usuário está
 * correto.
 */
async function mutateData(mutator) {
  if (pool) {
    await ensurePostgres();
    const client = await pool.connect();
    try {
      await client.query("begin");
      const result = await client.query(`select data from minerva_state where id = $1 for update`, ["main"]);
      const current = sanitizeData(result.rows[0]?.data || emptyData());
      const next = sanitizeData(await mutator(current));
      await client.query(`update minerva_state set data = $2::jsonb, updated_at = now() where id = $1`, ["main", JSON.stringify(next)]);
      await client.query("commit");
      return next;
    } catch (error) {
      await client.query("rollback").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  const store = await readStore();
  const next = sanitizeData(await mutator(store.data));
  await writeLocalStore({ ...store, data: next });
  return next;
}

async function createSession(userId, isAdmin) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + sessionTtlMs);
  if (pool) {
    await ensurePostgres();
    await pool.query(`insert into minerva_sessions (token, user_id, is_admin, expires_at) values ($1, $2, $3, $4)`, [
      token,
      userId,
      Boolean(isAdmin),
      expiresAt,
    ]);
    return token;
  }

  const store = await readStore();
  await writeLocalStore({
    ...store,
    sessions: {
      ...store.sessions,
      [token]: { userId, isAdmin: Boolean(isAdmin), expiresAt: expiresAt.getTime() },
    },
  });
  return token;
}

function bearerToken(req) {
  const header = String(req.headers.authorization || "");
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function readSession(req) {
  const token = bearerToken(req);
  if (!token) return null;

  if (pool) {
    await ensurePostgres();
    const result = await pool.query(`select user_id, is_admin from minerva_sessions where token = $1 and expires_at > now()`, [token]);
    const row = result.rows[0];
    return row ? { token, userId: row.user_id, isAdmin: Boolean(row.is_admin) } : null;
  }

  const store = await readStore();
  const session = store.sessions?.[token];
  if (!session || Number(session.expiresAt || 0) < Date.now()) return null;
  return { token, userId: session.userId, isAdmin: Boolean(session.isAdmin) };
}

/**
 * A Mine (/api/mine/chat e o legado /api/gemini) gasta saldo da NanoGPT a cada
 * pergunta: so responde quem esta logado. GET continua aberto porque so diz se
 * a busca na web esta ligada. Devolve false quando ja respondeu com erro.
 */
export async function mineSessionOk(req, res) {
  if (req.method !== "POST") return true;
  try {
    if (await readSession(req)) return true;
  } catch (error) {
    console.error("[mine] sessao", error);
    sendJson(req, res, 503, { error: "Não consegui conferir sua sessão agora. Tente de novo em instantes.", code: "session_check" });
    return false;
  }
  sendJson(req, res, 401, { error: "Entre na sua conta para conversar com a Mine.", code: "login_required" });
  return false;
}

async function requireSession(req, res) {
  const session = await readSession(req);
  if (!session) {
    sendError(req, res, 401, "Sessão expirada. Entre novamente.");
    return null;
  }
  return session;
}

/**
 * Cota diária por conta para o que custa dinheiro a cada uso (a IA de
 * imagens do Ateliê). Fica no banco porque a memória da função na Vercel não
 * sobrevive entre instâncias. Devolve o total usado contando este uso, ou
 * `null` quando o teto já foi atingido.
 */
const localQuota = new Map();
function quotaDay() {
  return new Date().toISOString().slice(0, 10);
}
async function takeQuota(userId, kind, limit) {
  const day = quotaDay();
  if (pool) {
    await ensurePostgres();
    const result = await pool.query(
      `insert into minerva_quota (user_id, kind, day, used) values ($1, $2, $3, 1)
       on conflict (user_id, kind, day) do update set used = minerva_quota.used + 1
       where minerva_quota.used < $4
       returning used`,
      [userId, kind, day, limit],
    );
    return result.rows[0] ? Number(result.rows[0].used) : null;
  }
  const key = `${userId}:${kind}:${day}`;
  const used = localQuota.get(key) || 0;
  if (used >= limit) return null;
  localQuota.set(key, used + 1);
  return used + 1;
}
async function giveBackQuota(userId, kind) {
  const day = quotaDay();
  if (pool) {
    await pool.query(`update minerva_quota set used = greatest(0, used - 1) where user_id = $1 and kind = $2 and day = $3`, [userId, kind, day]);
    return;
  }
  const key = `${userId}:${kind}:${day}`;
  localQuota.set(key, Math.max(0, (localQuota.get(key) || 0) - 1));
}
async function quotaUsed(userId, kind) {
  if (pool) {
    await ensurePostgres();
    const result = await pool.query(`select used from minerva_quota where user_id = $1 and kind = $2 and day = $3`, [userId, kind, quotaDay()]);
    return Number(result.rows[0]?.used || 0);
  }
  return localQuota.get(`${userId}:${kind}:${quotaDay()}`) || 0;
}

async function handleAtelieIa(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  if (req.method === "GET") {
    sendJson(req, res, 200, { used: await quotaUsed(session.userId, "atelie-ia"), limit: ATELIE_DAILY_LIMIT });
    return;
  }
  const body = await readJson(req);
  const used = await takeQuota(session.userId, "atelie-ia", ATELIE_DAILY_LIMIT);
  if (used === null) {
    sendJson(req, res, 429, { error: `Hoje você já usou as ${ATELIE_DAILY_LIMIT} conversões com IA. Amanhã tem mais!`, used: ATELIE_DAILY_LIMIT, limit: ATELIE_DAILY_LIMIT });
    return;
  }
  try {
    const result = await coloringPageFromPhoto({ image: body.image });
    sendJson(req, res, 200, { image: result.image, ms: result.ms, used, limit: ATELIE_DAILY_LIMIT });
  } catch (error) {
    // Falhou: o uso não conta.
    await giveBackQuota(session.userId, "atelie-ia").catch(() => undefined);
    const status = error instanceof AtelieError ? error.status : 502;
    sendJson(req, res, status, { error: error instanceof AtelieError ? error.message : "A IA não conseguiu desenhar essa foto agora.", used: used - 1, limit: ATELIE_DAILY_LIMIT });
  }
}

/**
 * Imagem criada pela Mine no chat ([[gerar_imagem: ...]]). GET devolve o uso
 * do dia; POST { prompt, reference? } cria. Falha não conta na cota.
 */
async function handleMineImage(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  if (req.method === "GET") {
    sendJson(req, res, 200, { used: await quotaUsed(session.userId, "mine-imagem"), limit: MINE_IMAGE_DAILY_LIMIT });
    return;
  }
  const body = await readJson(req);
  const bucket = "mine-imagem";
  const limit = MINE_IMAGE_DAILY_LIMIT;
  const used = await takeQuota(session.userId, bucket, limit);
  if (used === null) {
    const error = `Hoje você já criou as ${limit} imagens do dia. Amanhã tem mais!`;
    sendJson(req, res, 429, { error, code: "quota", used: limit, limit });
    return;
  }
  try {
    const result = await generateMineImage({ prompt: body.prompt, reference: body.reference, formato: body.formato });
    sendJson(req, res, 200, { image: result.image, ms: result.ms, used, limit });
  } catch (error) {
    await giveBackQuota(session.userId, bucket).catch(() => undefined);
    const status = error instanceof MineImageError ? error.status : 502;
    if (!(error instanceof MineImageError)) console.error("[mine-imagem]", error);
    sendJson(req, res, status, { error: error instanceof MineImageError ? error.message : "A Mine não conseguiu desenhar agora.", used: used - 1, limit });
  }
}

/**
 * Voz da Mine na aba Idiomas. POST { text, slow? } devolve o MP3. Áudio que
 * já estava no cache do servidor não conta na cota. Qualquer falha responde
 * JSON com erro e a tela usa a voz do navegador.
 */
async function handleMineVoice(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  const body = await readJson(req);
  const used = await takeQuota(session.userId, "mine-voz", MINE_VOICE_DAILY_LIMIT);
  if (used === null) {
    sendJson(req, res, 429, { error: "A voz da Mine descansou por hoje.", code: "quota" });
    return;
  }
  try {
    const result = await synthesizeVoice({ text: body.text, slow: body.slow === true });
    if (result.cached) await giveBackQuota(session.userId, "mine-voz").catch(() => undefined);
    const origin = process.env.PUBLIC_APP_ORIGIN || req.headers.origin || "*";
    res.writeHead(200, {
      "content-type": result.type,
      "content-length": String(result.audio.length),
      "cache-control": "private, max-age=86400",
      "access-control-allow-origin": origin,
      vary: "Origin",
    });
    res.end(result.audio);
  } catch (error) {
    await giveBackQuota(session.userId, "mine-voz").catch(() => undefined);
    if (!(error instanceof MineVoiceError)) console.error("[mine-voz]", error);
    sendJson(req, res, error instanceof MineVoiceError ? error.status : 502, { error: error instanceof MineVoiceError ? error.message : "A voz da Mine falhou agora." });
  }
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string" || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const expected = Buffer.from(hash, "hex");
  const actual = await scrypt(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function readJson(req) {
  if ("body" in req && req.body !== undefined) {
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString("utf8") || "{}");
    if (typeof req.body === "string") return req.body ? JSON.parse(req.body) : {};
    if (req.body && typeof req.body === "object") return req.body;
    return {};
  }

  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 10_000_000) throw new Error("Payload muito grande.");
  }
  return body ? JSON.parse(body) : {};
}

/**
 * Sem `ADMIN_ACCESS_PASSWORD` configurada nao existe senha administrativa
 * nenhuma: o acesso admin simplesmente fecha.
 *
 * Aqui havia uma senha fixa no codigo como ultimo recurso. Ela transformava
 * "esqueci de configurar a variavel" em "quem le o repositorio vira admin do
 * site em producao" — e admin enxerga a conta e as conversas de todo mundo.
 * Falhar fechado e barulhento e melhor que continuar aberto em silencio.
 *
 * A comparacao e de tempo constante para nao vazar o tamanho da senha nem o
 * prefixo correto atraves do tempo de resposta.
 */
function adminPasswordMatches(value) {
  const expected = String(process.env.ADMIN_ACCESS_PASSWORD || "");
  if (!expected) return false;
  const provided = Buffer.from(String(value || ""), "utf8");
  const target = Buffer.from(expected, "utf8");
  return provided.length === target.length && timingSafeEqual(provided, target);
}

function sendJson(req, res, status, payload) {
  const origin = process.env.PUBLIC_APP_ORIGIN || req.headers.origin || "*";
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
    "vary": "Origin",
  });
  res.end(JSON.stringify(payload));
}

function sendError(req, res, status, message) {
  sendJson(req, res, status, { error: message });
}

async function handleRegister(req, res) {
  const body = await readJson(req);
  const name = String(body.name || "").trim();
  const password = String(body.password || "");
  const wantsAdmin = Boolean(body.adminMode);

  if (!name || password.length < 3) {
    sendError(req, res, 400, "Preencha nome e senha com pelo menos 3 caracteres.");
    return;
  }
  if (wantsAdmin && !adminPasswordMatches(String(body.adminPassword || ""))) {
    sendError(req, res, 403, "Senha administrativa incorreta.");
    return;
  }

  const store = await readStore();
  if (store.data.users.some((user) => user.name.toLowerCase() === name.toLowerCase())) {
    sendError(req, res, 409, "Já existe uma conta com esse nome.");
    return;
  }

  const user = safeUser({
    id: uid("user"),
    name,
    isAdmin: wantsAdmin,
    createdAt: Date.now(),
    // Conta nova nao aparece para os outros ate a pessoa ligar "Aparecer no
    // ranking" no Perfil (relatorio de QA de 16/11). As contas antigas ficam
    // como estavam: o padrao geral (defaultSettings) nao mudou.
    settings: { ...defaultSettings(name), hideFromRanking: true },
  });
  const nextData = await saveData({ ...store.data, users: [...store.data.users, user] });
  await saveCredential(user.id, await hashPassword(password));
  const token = await createSession(user.id, wantsAdmin);
  sendJson(req, res, 201, { token, user, data: dataForSession(nextData, { userId: user.id, isAdmin: wantsAdmin }) });
}

async function handleLogin(req, res) {
  const body = await readJson(req);
  const name = String(body.name || "").trim();
  const password = String(body.password || "");
  const wantsAdmin = Boolean(body.adminMode);
  const store = await readStore();
  const user = store.data.users.find((item) => item.name.toLowerCase() === name.toLowerCase());

  if (!user || !(await verifyPassword(password, store.credentials[user.id]))) {
    sendError(req, res, 401, "Conta não encontrada ou senha incorreta.");
    return;
  }
  if (wantsAdmin && !adminPasswordMatches(String(body.adminPassword || ""))) {
    sendError(req, res, 403, "Senha administrativa incorreta.");
    return;
  }

  let nextUser = user;
  let nextData = store.data;
  if (wantsAdmin && !user.isAdmin) {
    nextUser = { ...user, isAdmin: true };
    nextData = await saveData({ ...store.data, users: store.data.users.map((item) => (item.id === user.id ? nextUser : item)) });
  }

  const sessionIsAdmin = wantsAdmin || Boolean(nextUser.isAdmin);
  const token = await createSession(nextUser.id, sessionIsAdmin);
  sendJson(req, res, 200, { token, user: nextUser, data: dataForSession(nextData, { userId: nextUser.id, isAdmin: sessionIsAdmin }) });
}

/**
 * Ranking e perfil público.
 *
 * `dataForSession` corta tudo que não é do dono da sessão — e é isso que mantém
 * os dados de cada um privados. Então comparar progresso com outra pessoa só
 * pode acontecer aqui dentro, onde a base inteira está visível: o servidor lê
 * os dados de cada conta, calcula o XP com as mesmas regras da tela Progresso
 * (shared/xp.mjs) e devolve SÓ números e o cartão de perfil. Nenhuma matéria,
 * conteúdo, tarefa ou conversa de ninguém atravessa esta fronteira.
 */
const rankingCollections = ["subjects", "materials", "tasks", "chats", "sessions", "flashcards"];

/** Teto de contas no placar. Existe para o payload não crescer sem limite. */
const leaderboardLimit = 200;

function scopesByUser(data, ids) {
  const wanted = new Set(ids);
  const map = new Map(ids.map((id) => [id, { subjects: [], materials: [], tasks: [], chats: [], sessions: [], flashcards: [] }]));
  for (const key of rankingCollections) {
    for (const item of data[key] || []) {
      if (item && wanted.has(item.userId)) map.get(item.userId)[key].push(item);
    }
  }
  return map;
}

function publicName(user, { own = false } = {}) {
  const nome = String(user.settings?.displayName || user.name || "").trim() || String(user.name || "");
  // Quem olha de fora ve "Maria S." (e "Estudante" no lugar de palavrao); o
  // dono ve o proprio nome inteiro.
  return nomePublico(nome, { inteiro: own });
}

/* ------------------------------------------------------------------------ *
 * Duelo (nov/2026). As regras vivem em shared/duelo.mjs; aqui só guarda e
 * busca o estado. Tabela própria, fora do JSON central: o duelo muda a cada
 * segundo e regravar o site inteiro a cada resposta seria caro e brigaria
 * com os salvamentos de todo mundo.
 * ------------------------------------------------------------------------ */
const DUELO_DIARIO = 20;
const duelosLocais = new Map();
let duelosProntos = false;

async function prepararDuelos() {
  if (!pool || duelosProntos) return;
  await ensurePostgres();
  await pool.query(`
    create table if not exists minerva_duelos (
      codigo text primary key,
      dados jsonb not null,
      atualizado timestamptz not null default now()
    )
  `);
  duelosProntos = true;
}

/** Lê, muda e grava um duelo sob bloqueio de linha: duas respostas no mesmo segundo não se apagam. */
async function mudarDuelo(codigo, mutador) {
  if (pool) {
    await prepararDuelos();
    const client = await pool.connect();
    try {
      await client.query("begin");
      const linha = await client.query(`select dados from minerva_duelos where codigo = $1 for update`, [codigo]);
      if (!linha.rows[0]) {
        await client.query("rollback");
        return null;
      }
      const estado = linha.rows[0].dados;
      const saida = await mutador(estado);
      await client.query(`update minerva_duelos set dados = $2::jsonb, atualizado = now() where codigo = $1`, [codigo, JSON.stringify(estado)]);
      await client.query("commit");
      return { estado, saida };
    } catch (error) {
      await client.query("rollback").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
  const estado = duelosLocais.get(codigo);
  if (!estado) return null;
  const saida = await mutador(estado);
  return { estado, saida };
}

async function guardarNovoDuelo(estado) {
  if (pool) {
    await prepararDuelos();
    // Faxina barata: duelos de ontem não servem para mais nada.
    await pool.query(`delete from minerva_duelos where atualizado < now() - interval '1 day'`);
    const feito = await pool.query(`insert into minerva_duelos (codigo, dados) values ($1, $2::jsonb) on conflict (codigo) do nothing returning codigo`, [estado.codigo, JSON.stringify(estado)]);
    return feito.rowCount > 0;
  }
  if (duelosLocais.has(estado.codigo)) return false;
  duelosLocais.set(estado.codigo, estado);
  return true;
}

async function salasAbertas() {
  const limite = Date.now() - SALA_EXPIRA_MS;
  const lista = pool
    ? (await (async () => {
        await prepararDuelos();
        const r = await pool.query(`select dados from minerva_duelos where dados->>'status' = 'sala' and atualizado > now() - interval '15 minutes' order by atualizado desc limit 12`);
        return r.rows.map((row) => row.dados);
      })())
    : [...duelosLocais.values()].filter((item) => item.status === "sala");
  return lista
    .filter((item) => Number(item.criadoEm) > limite)
    .map((item) => ({ codigo: item.codigo, tema: item.tema, dono: item.jogadores[0]?.nome || "Alguém", donoId: item.jogadores[0]?.id || "", criadoEm: item.criadoEm }));
}

// Pede de sobra: a conferência descarta as questões em que o gabarito não bate.
const PERGUNTAS_GERADAS = PERGUNTAS_POR_DUELO + 3;

async function perguntasDoDuelo(tema) {
  const resultado = await runMineRequest({
    task: "quiz",
    // A certa vai SEMPRE em A e o servidor embaralha (ver shared/duelo.mjs):
    // pedir ao modelo para espalhar a letra fazia o gabarito apontar a errada.
    prompt: `Gere ${PERGUNTAS_GERADAS} questoes de multipla escolha sobre o tema "${tema}", com nivel de dificuldade media. Todas as questoes precisam ser exatamente sobre esse tema, nada de outros assuntos. E um duelo de rapidez: enunciados curtos (ate 25 palavras) e alternativas curtas. Use apenas fatos que voce tem certeza que sao verdadeiros; se nao tiver certeza de um fato, troque a questao. A alternativa correta deve ser SEMPRE a A, e as outras tres claramente erradas para quem conhece o assunto. A letra sera embaralhada depois, entao escreva sempre CORRETA: A.`,
    context: `Tema solicitado: ${tema}. Use conhecimento geral confiavel e adequado ao ensino medio brasileiro.`,
    maxTokens: 4000,
  });
  const geradas = limparPerguntas(parseQuiz(resultado?.reply || ""), PERGUNTAS_GERADAS).map((item) => embaralharPergunta(item));
  if (geradas.length < 3) return geradas;
  let respostas = null;
  try {
    const conferencia = await runMineRequest({
      task: "duelo-conferir",
      prompt: textoParaConferir(geradas),
      context: `Tema: ${tema}`,
      maxTokens: 600,
    });
    respostas = lerConferencia(conferencia?.reply || "", geradas.length);
  } catch {
    respostas = null;
  }
  // Sem conferência (IA fora do ar) vale o gabarito com a certa em A, que já
  // não sofre da troca de letra; com ela, só o que as duas leituras concordam.
  const conferidas = respostas && respostas.some((r) => r >= 0) ? perguntasConferidas(geradas, respostas) : geradas;
  return conferidas.slice(0, PERGUNTAS_POR_DUELO);
}

async function handleDuelo(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  const body = await readJson(req).catch(() => ({}));
  const acao = String(body.acao || "");
  const agora = Date.now();
  const store = await readStore();
  const user = store.data.users.find((item) => item.id === session.userId);
  if (!user) {
    sendError(req, res, 401, "Conta não encontrada. Entre novamente.");
    return;
  }
  const eu = { id: user.id, nome: publicName(user) };

  if (acao === "abertas") {
    const salas = (await salasAbertas()).map((sala) => ({ ...sala, minha: sala.donoId === eu.id }));
    sendJson(req, res, 200, { salas: salas.map(({ donoId: _id, ...resto }) => resto) });
    return;
  }

  if (acao === "criar") {
    const tema = String(body.tema || "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (tema.length < 3) {
      sendError(req, res, 400, "Escolha um tema para o duelo.");
      return;
    }
    const usado = await takeQuota(eu.id, "duelo", DUELO_DIARIO);
    if (usado === null) {
      sendJson(req, res, 429, { error: `Você já criou ${DUELO_DIARIO} duelos hoje. Entre na sala de um colega ou volte amanhã!`, code: "quota" });
      return;
    }
    let perguntas = [];
    try {
      perguntas = await perguntasDoDuelo(tema);
    } catch {
      perguntas = [];
    }
    // A Mine falhou: o duelo sai com a reserva de conhecimentos gerais.
    const daReserva = perguntas.length < 3;
    if (daReserva) perguntas = perguntasDaReserva(PERGUNTAS_POR_DUELO);
    const temaFinal = daReserva ? "Conhecimentos gerais" : tema;
    for (let tentativa = 0; tentativa < 6; tentativa += 1) {
      const estado = criarDuelo({ codigo: novoCodigo(), tema: temaFinal, dono: eu, perguntas, contraMine: Boolean(body.contraMine), agora: Date.now() });
      if (await guardarNovoDuelo(estado)) {
        sendJson(req, res, 200, {
          duelo: vistaDe(estado, eu.id, Date.now()),
          aviso: daReserva ? `A Mine não conseguiu criar perguntas sobre "${tema}" agora, então o duelo usa perguntas de conhecimentos gerais.` : "",
        });
        return;
      }
    }
    sendError(req, res, 500, "Não deu para abrir a sala agora. Tente de novo.");
    return;
  }

  const codigo = String(body.codigo || "").trim().toUpperCase();
  if (!codigoValido(codigo)) {
    sendError(req, res, 400, "Código de sala inválido. São 5 letras e números.");
    return;
  }

  const feito = await mudarDuelo(codigo, (estado) => {
    if (acao === "entrar") {
      const r = entrarNoDuelo(estado, eu, agora);
      if (!r.ok) return r;
    } else if (!estado.jogadores.some((item) => item.id === eu.id)) {
      return { ok: false, erro: "Você não está neste duelo." };
    }
    estado.vistoEm = { ...(estado.vistoEm || {}), [eu.id]: agora };
    if (acao === "responder") return responder(estado, eu.id, Math.floor(Number(body.indice)), Number(body.escolha), agora);
    if (acao === "sair") {
      abandonar(estado, eu.id, "saiu", agora);
      return { ok: true };
    }
    avancar(estado, agora);
    conferirSumico(estado, agora);
    return { ok: true };
  });
  if (!feito) {
    sendError(req, res, 404, "Sala não encontrada. Confira o código.");
    return;
  }
  if (!feito.saida.ok && acao !== "responder") {
    sendError(req, res, 409, feito.saida.erro || "Não deu para fazer isso agora.");
    return;
  }
  sendJson(req, res, 200, { duelo: vistaDe(feito.estado, eu.id, agora), aviso: feito.saida.ok ? "" : feito.saida.erro || "" });
}


/* ------------------------------------------------------------------------ *
 * Sala de estudo em grupo (nov/2026): chat com a Mine, fotos e chamada de
 * voz direta entre os navegadores. As regras vivem em shared/sala.mjs.
 *
 * Três tabelas próprias (fora do JSON central, como o Duelo): o estado da
 * sala (quem está, quem está na chamada), as mensagens e os "sinais" da
 * chamada — os recados que dois navegadores trocam para se conectar
 * (oferta/resposta WebRTC). O servidor só repassa os sinais; a voz em si
 * vai de um navegador ao outro e não passa por aqui.
 * ------------------------------------------------------------------------ */
const SALA_DIARIA = 15;
const SALA_MINE_DIARIA = 80;
const salasLocais = new Map();
const mensagensLocais = [];
const sinaisLocais = [];
let sequenciaLocal = 0;
let salasProntas = false;

async function prepararSalas() {
  if (!pool || salasProntas) return;
  await ensurePostgres();
  await pool.query(`
    create table if not exists minerva_salas (
      codigo text primary key,
      dados jsonb not null,
      atualizado timestamptz not null default now()
    );
    create table if not exists minerva_sala_msgs (
      id bigserial primary key,
      codigo text not null,
      autor_id text not null,
      autor text not null,
      tipo text not null,
      texto text not null default '',
      foto text,
      criado timestamptz not null default now()
    );
    create index if not exists minerva_sala_msgs_codigo on minerva_sala_msgs (codigo, id);
    alter table minerva_sala_msgs add column if not exists resposta_a bigint;
    create table if not exists minerva_sala_sinais (
      id bigserial primary key,
      codigo text not null,
      de text not null,
      para text not null,
      dados jsonb not null,
      criado timestamptz not null default now()
    );
    create index if not exists minerva_sala_sinais_para on minerva_sala_sinais (codigo, para, id);
  `);
  salasProntas = true;
}

/** Lê, muda e grava a sala sob bloqueio de linha (duas consultas no mesmo segundo não se apagam). */
async function mudarSala(codigo, mutador) {
  if (pool) {
    await prepararSalas();
    const client = await pool.connect();
    try {
      await client.query("begin");
      const linha = await client.query(`select dados from minerva_salas where codigo = $1 for update`, [codigo]);
      if (!linha.rows[0]) {
        await client.query("rollback");
        return null;
      }
      const estado = linha.rows[0].dados;
      const saida = await mutador(estado);
      await client.query(`update minerva_salas set dados = $2::jsonb, atualizado = now() where codigo = $1`, [codigo, JSON.stringify(estado)]);
      await client.query("commit");
      return { estado, saida };
    } catch (error) {
      await client.query("rollback").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
  const estado = salasLocais.get(codigo);
  if (!estado) return null;
  return { estado, saida: await mutador(estado) };
}

async function lerSala(codigo) {
  if (pool) {
    await prepararSalas();
    const r = await pool.query(`select dados from minerva_salas where codigo = $1`, [codigo]);
    return r.rows[0]?.dados || null;
  }
  return salasLocais.get(codigo) || null;
}

async function guardarNovaSala(estado) {
  if (pool) {
    await prepararSalas();
    // Faxina barata: sala parada há dois dias não volta mais.
    await pool.query(`delete from minerva_sala_msgs where codigo in (select codigo from minerva_salas where atualizado < now() - interval '2 days')`);
    await pool.query(`delete from minerva_salas where atualizado < now() - interval '2 days'`);
    await pool.query(`delete from minerva_sala_sinais where criado < now() - interval '10 minutes'`);
    const feito = await pool.query(`insert into minerva_salas (codigo, dados) values ($1, $2::jsonb) on conflict (codigo) do nothing returning codigo`, [estado.codigo, JSON.stringify(estado)]);
    return feito.rowCount > 0;
  }
  if (salasLocais.has(estado.codigo)) return false;
  salasLocais.set(estado.codigo, estado);
  return true;
}

async function gravarMensagem({ codigo, autorId, autor, tipo, texto = "", foto = null, respostaA = null }) {
  if (pool) {
    await prepararSalas();
    const r = await pool.query(
      `insert into minerva_sala_msgs (codigo, autor_id, autor, tipo, texto, foto, resposta_a) values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [codigo, autorId, autor, tipo, texto, foto, respostaA],
    );
    return Number(r.rows[0].id);
  }
  const id = ++sequenciaLocal;
  mensagensLocais.push({ id, codigo, autorId, autor, tipo, texto, foto, respostaA, em: Date.now() });
  return id;
}

/** Uma mensagem inteira (com a foto), para a Mine conferir ou para saber a quem se responde. */
async function mensagemPorId(codigo, id) {
  if (pool) {
    await prepararSalas();
    const r = await pool.query(`select id, autor_id, autor, tipo, texto, foto, resposta_a, criado from minerva_sala_msgs where codigo = $1 and id = $2`, [codigo, id]);
    return r.rows[0] ? { ...linhaMensagem(r.rows[0]), foto: r.rows[0].foto || "" } : null;
  }
  const m = mensagensLocais.find((item) => item.codigo === codigo && item.id === id);
  return m ? { ...linhaMensagem(m), foto: m.foto || "" } : null;
}

const linhaMensagem = (m) => ({
  id: Number(m.id),
  tipo: m.tipo,
  autorId: m.autor_id ?? m.autorId,
  autor: m.autor,
  texto: m.texto || "",
  temFoto: Boolean(m.tem_foto ?? m.foto),
  respostaA: Number(m.resposta_a ?? m.respostaA) || 0,
  em: m.criado ? new Date(m.criado).getTime() : m.em,
});

/** Mensagens depois de `desde` (sem a foto: ela vem à parte, sob pedido). Na primeira consulta, as últimas 50. */
async function mensagensDesde(codigo, desde, limite = 50) {
  if (pool) {
    await prepararSalas();
    const r = desde > 0
      ? await pool.query(`select id, autor_id, autor, tipo, texto, foto is not null as tem_foto, resposta_a, criado from minerva_sala_msgs where codigo = $1 and id > $2 order by id asc limit $3`, [codigo, desde, limite])
      : await pool.query(`select * from (select id, autor_id, autor, tipo, texto, foto is not null as tem_foto, resposta_a, criado from minerva_sala_msgs where codigo = $1 order by id desc limit $2) t order by id asc`, [codigo, limite]);
    return r.rows.map(linhaMensagem);
  }
  const daSala = mensagensLocais.filter((m) => m.codigo === codigo);
  return (desde > 0 ? daSala.filter((m) => m.id > desde).slice(0, limite) : daSala.slice(-limite)).map(linhaMensagem);
}

async function fotoDaMensagem(codigo, id) {
  if (pool) {
    await prepararSalas();
    const r = await pool.query(`select foto from minerva_sala_msgs where codigo = $1 and id = $2`, [codigo, id]);
    return r.rows[0]?.foto || "";
  }
  return mensagensLocais.find((m) => m.codigo === codigo && m.id === id)?.foto || "";
}

async function gravarSinal(codigo, de, para, dados) {
  if (pool) {
    await prepararSalas();
    await pool.query(`insert into minerva_sala_sinais (codigo, de, para, dados) values ($1, $2, $3, $4::jsonb)`, [codigo, de, para, JSON.stringify(dados)]);
    return;
  }
  sinaisLocais.push({ id: ++sequenciaLocal, codigo, de, para, dados, em: Date.now() });
}

/** Sinais para mim; quem lê, apaga (cada recado é entregue uma vez). */
async function pegarSinais(codigo, para) {
  if (pool) {
    await prepararSalas();
    const r = await pool.query(`delete from minerva_sala_sinais where codigo = $1 and para = $2 and criado > now() - interval '2 minutes' returning id, de, dados`, [codigo, para]);
    return r.rows.sort((a, b) => Number(a.id) - Number(b.id)).map((row) => ({ de: row.de, dados: row.dados }));
  }
  const meus = [];
  for (let i = sinaisLocais.length - 1; i >= 0; i -= 1) {
    const item = sinaisLocais[i];
    if (item.codigo === codigo && item.para === para) {
      meus.unshift({ de: item.de, dados: item.dados });
      sinaisLocais.splice(i, 1);
    }
  }
  return meus;
}

/** A Mine lê a conversa (e a foto mais recente) e responde ao grupo. */
async function mineNaSala(codigo, pedido, foco = null) {
  await mudarSala(codigo, (sala) => {
    sala.mineDigitando = Date.now();
    return { ok: true };
  });
  let texto = "";
  try {
    const recentes = await mensagensDesde(codigo, 0, 30);
    const comFoto = foco?.temFoto ? null : [...recentes].reverse().slice(0, 8).find((m) => m.temFoto && m.tipo !== "mine");
    const foto = foco?.temFoto ? foco.foto : comFoto ? await fotoDaMensagem(codigo, comFoto.id) : "";
    let contexto = conversaParaMine(recentes);
    if (foco) {
      contexto += `\n\nMENSAGEM EM FOCO (de ${foco.autor}${foco.tipo === "conta" ? ", escrita no teclado de contas, linha por linha" : ""}):\n${foco.texto || "(so a foto)"}`;
      if (foco.pergunta) contexto += `\n\nELA RESPONDE A ESTA MENSAGEM DA MINE:\n${foco.pergunta}`;
      const verificacao = verificacaoParaMine(foco.texto || "");
      if (verificacao) contexto += `\n\nVERIFICACAO AUTOMATICA DAS CONTAS (calculadora do site; confie nela, nao refaca de cabeca):\n${verificacao}`;
    }
    const tipoFoto = /^data:(image\/[a-z]+);/.exec(foto)?.[1] || "image/jpeg";
    const resultado = await runMineRequest({
      task: "sala-grupo",
      prompt: pedido,
      context: contexto,
      attachments: foto ? [{ type: tipoFoto, name: "foto-do-grupo.jpg", dataUrl: foto }] : [],
      maxTokens: 2000,
    });
    texto = String(resultado?.reply || "").trim();
  } catch {
    texto = "";
  }
  await gravarMensagem({ codigo, autorId: "mine", autor: "Mine", tipo: "mine", texto: texto || "Não consegui pensar agora. Me chamem de novo daqui a pouquinho!" });
  await mudarSala(codigo, (sala) => {
    sala.mineDigitando = 0;
    return { ok: true };
  });
}

async function handleSala(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  const body = await readJson(req).catch(() => ({}));
  const acao = String(body.acao || "");
  const agora = Date.now();
  const euId = session.userId;

  // criar e entrar precisam do nome e da foto; o resto só do id da sessão
  const quemSou = async () => {
    const store = await readStore();
    const user = store.data.users.find((item) => item.id === euId);
    return user ? { id: user.id, nome: publicName(user), avatar: publicAvatarUrl(user) } : null;
  };

  if (acao === "criar") {
    const eu = await quemSou();
    if (!eu) return sendError(req, res, 401, "Conta não encontrada. Entre novamente.");
    if ((await takeQuota(euId, "sala", SALA_DIARIA)) === null) {
      return sendJson(req, res, 429, { error: `Você já abriu ${SALA_DIARIA} salas hoje. Entre na sala de um colega ou volte amanhã!`, code: "quota" });
    }
    for (let tentativa = 0; tentativa < 6; tentativa += 1) {
      const estado = criarSala({ codigo: novoCodigoSala(), nome: body.nome, dono: eu, agora });
      if (await guardarNovaSala(estado)) {
        await gravarMensagem({ codigo: estado.codigo, autorId: "sistema", autor: "", tipo: "sistema", texto: `${eu.nome} abriu a sala` });
        return sendJson(req, res, 200, { sala: vistaSala(estado, euId, agora) });
      }
    }
    return sendError(req, res, 500, "Não deu para abrir a sala agora. Tente de novo.");
  }

  const codigo = String(body.codigo || "").trim().toUpperCase();
  if (!codigoSalaValido(codigo)) return sendError(req, res, 400, "Código de sala inválido. São 6 letras e números.");

  if (acao === "entrar") {
    const eu = await quemSou();
    if (!eu) return sendError(req, res, 401, "Conta não encontrada. Entre novamente.");
    const feito = await mudarSala(codigo, (sala) => entrarNaSala(sala, eu, agora));
    if (!feito) return sendError(req, res, 404, "Sala não encontrada. Confira o código.");
    if (!feito.saida.ok) return sendError(req, res, 409, feito.saida.erro);
    if (feito.saida.novo) await gravarMensagem({ codigo, autorId: "sistema", autor: "", tipo: "sistema", texto: `${eu.nome} entrou na sala` });
    return sendJson(req, res, 200, { sala: vistaSala(feito.estado, euId, agora) });
  }

  if (acao === "sync") {
    const feito = await mudarSala(codigo, (sala) =>
      tocarNaSala(sala, euId, agora, {
        naChamada: typeof body.naChamada === "boolean" ? body.naChamada : undefined,
        mudo: typeof body.mudo === "boolean" ? body.mudo : undefined,
        digitando: Boolean(body.digitando),
      }),
    );
    if (!feito) return sendError(req, res, 404, "Essa sala não existe mais.");
    if (!feito.saida.ok) return sendError(req, res, 403, feito.saida.erro);
    const [mensagens, sinais] = await Promise.all([mensagensDesde(codigo, Math.max(0, Number(body.desde) || 0)), pegarSinais(codigo, euId)]);
    return sendJson(req, res, 200, { sala: vistaSala(feito.estado, euId, agora), mensagens, sinais, aviso: feito.saida.aviso || "" });
  }

  // daqui para baixo, só quem é da sala
  const sala = await lerSala(codigo);
  if (!sala) return sendError(req, res, 404, "Essa sala não existe mais.");
  const eu = sala.membros.find((m) => m.id === euId);
  if (!eu) return sendError(req, res, 403, "Você não está nesta sala.");

  if (acao === "enviar") {
    const texto = limparTextoMensagem(body.texto);
    const foto = body.foto ? String(body.foto) : "";
    if (foto && !fotoValida(foto)) return sendError(req, res, 400, "Essa foto não deu para mandar. Tente uma imagem menor.");
    if (!texto && !foto) return sendError(req, res, 400, "Mensagem vazia.");
    const tipo = body.tipo === "conta" && texto ? "conta" : "texto";
    // a quem responde: um id pedido de propósito, ou (sem pedir) a pergunta da
    // Mine logo acima, quando a última mensagem da sala foi ela perguntando
    const antes = (await mensagensDesde(codigo, 0, 1))[0];
    let alvo = Number(body.respostaA) > 0 ? await mensagemPorId(codigo, Math.floor(Number(body.respostaA))) : null;
    if (!alvo && antes?.tipo === "mine" && /\?/.test(antes.texto) && Date.now() - antes.em < 10 * 60_000) alvo = antes;
    const id = await gravarMensagem({ codigo, autorId: euId, autor: eu.nome, tipo, texto, foto: foto || null, respostaA: alvo?.id || null });
    const respondeMine = alvo?.tipo === "mine";
    const pedeMine = Boolean(body.mine) || chamaMine(texto) || respondeMine;
    if (pedeMine) {
      if ((await takeQuota(euId, "sala-mine", SALA_MINE_DIARIA)) === null) {
        await gravarMensagem({ codigo, autorId: "sistema", autor: "", tipo: "sistema", texto: `${eu.nome} já chamou a Mine ${SALA_MINE_DIARIA} vezes hoje` });
      } else {
        const foco = { autor: eu.nome, tipo, texto, temFoto: Boolean(foto), foto, pergunta: respondeMine ? alvo.texto : "" };
        await mineNaSala(
          codigo,
          respondeMine
            ? `${eu.nome} RESPONDEU a sua pergunta (mensagem em foco). Avalie a resposta: diga se esta certa; se errou, mostre onde (use a verificacao automatica quando houver) e de uma dica para ele tentar de novo, sem entregar a resposta. Se acertou, comemore e, se fizer sentido, proponha o proximo desafio.`
            : tipo === "conta"
              ? `${eu.nome} mandou uma conta e te chamou. Confira linha por linha e responda.`
              : `${eu.nome} chamou voce na ultima mensagem. Responda ao grupo.`,
          foco,
        );
      }
    }
    return sendJson(req, res, 200, { ok: true, id });
  }

  if (acao === "conferir") {
    const alvo = await mensagemPorId(codigo, Math.floor(Number(body.id)));
    if (!alvo || alvo.tipo === "sistema" || alvo.tipo === "mine") return sendError(req, res, 404, "Mensagem não encontrada.");
    if ((await takeQuota(euId, "sala-mine", SALA_MINE_DIARIA)) === null) return sendError(req, res, 429, "A Mine já respondeu muito por hoje nesta conta.");
    await gravarMensagem({ codigo, autorId: "sistema", autor: "", tipo: "sistema", texto: `${eu.nome} pediu para a Mine conferir a mensagem de ${alvo.autor}` });
    await mineNaSala(
      codigo,
      `${eu.nome} pediu para voce CONFERIR a mensagem em foco (de ${alvo.autor}). Diga se a resolucao esta certa. Se houver erro, aponte a LINHA exata e o que aconteceu (ex.: "na linha 2 o -5 passou para o outro lado sem trocar o sinal"), explique a regra e deixe o aluno corrigir; nao reescreva a solucao inteira. Se estiver certa, elogie o que foi bem feito.`,
      alvo,
    );
    return sendJson(req, res, 200, { ok: true });
  }

  if (acao === "quiz") {
    const titulo = String(body.titulo || "quiz").replace(/\s+/g, " ").trim().slice(0, 80);
    const total = Math.max(1, Math.min(8, Math.floor(Number(body.total) || 0)));
    const acertos = Math.max(0, Math.min(total, Math.floor(Number(body.acertos) || 0)));
    await gravarMensagem({ codigo, autorId: "sistema", autor: "", tipo: "sistema", texto: `${eu.nome} fez o quiz "${titulo}": ${acertos} de ${total}${acertos === total ? " — gabaritou!" : ""}` });
    return sendJson(req, res, 200, { ok: true });
  }

  if (acao === "resumo") {
    if ((await takeQuota(euId, "sala-mine", SALA_MINE_DIARIA)) === null) return sendError(req, res, 429, "A Mine já respondeu muito por hoje nesta conta.");
    await mineNaSala(codigo, `${eu.nome} pediu um RESUMO DA SESSAO: faca um resumo do que o grupo estudou, o que ficou claro, o que ainda gerou duvida e 3 perguntas rapidas para revisar.`);
    return sendJson(req, res, 200, { ok: true });
  }

  if (acao === "foto") {
    const foto = await fotoDaMensagem(codigo, Math.floor(Number(body.id)));
    if (!foto) return sendError(req, res, 404, "Foto não encontrada.");
    return sendJson(req, res, 200, { foto });
  }

  if (acao === "sinal") {
    const para = String(body.para || "");
    const dados = body.dados && typeof body.dados === "object" ? body.dados : null;
    if (!dados || !sala.membros.some((m) => m.id === para) || JSON.stringify(dados).length > 30_000) {
      return sendError(req, res, 400, "Sinal inválido.");
    }
    await gravarSinal(codigo, euId, para, dados);
    return sendJson(req, res, 200, { ok: true });
  }

  if (acao === "sair") {
    await mudarSala(codigo, (s) => ({ ok: sairDaSala(s, euId) }));
    await gravarMensagem({ codigo, autorId: "sistema", autor: "", tipo: "sistema", texto: `${eu.nome} saiu da sala` });
    return sendJson(req, res, 200, { ok: true });
  }

  return sendError(req, res, 400, "Ação desconhecida.");
}

function publicAvatarUrl(user) {
  return user.settings?.avatar ? `/api/avatar?userId=${encodeURIComponent(user.id)}` : "";
}

function leaderboardRow(user, scope, windows, { you = false, friend = false } = {}) {
  const stats = gamificationStats(scope);
  const xp = totalXp(stats);
  const { level, title } = levelFromXp(xp);
  const seasonScore = seasonPoints(scope.sessions || []);
  const todayKey = dailyChallengeKey();
  const dailySession = (scope.sessions || [])
    .filter((item) => item?.kind === "Games" && item.dailyChallenge && item.dailyKey === todayKey)
    .sort((a, b) => Number(a.durationMs || Infinity) - Number(b.durationMs || Infinity))[0];
  return {
    id: user.id,
    // O nome da conta e o login: so vai para o proprio dono e para quem ja e
    // amigo (que digitou esse nome). Os demais recebem vazio e sao marcados
    // como amigo pelo id.
    name: you || friend ? user.name : "",
    displayName: publicName(user, { own: you }),
    avatar: publicAvatarUrl(user),
    you: Boolean(you),
    friend: Boolean(friend),
    xp,
    level,
    title,
    dayXp: xpSince(scope, windows.day),
    weekXp: xpSince(scope, windows.week),
    streak: stats.streakDays,
    focus: stats.focus,
    tasksDone: stats.tasksDone,
    seasonPoints: seasonScore,
    league: leagueFromPoints(seasonScore).name,
    dailyCorrect: Number(dailySession?.correctAnswers || 0),
    dailyDurationMs: Number(dailySession?.durationMs || 0),
    // Placar por jogo da aba Games: a melhor partida de cada jogo, só números.
    games: melhorPorJogo(scope.sessions || []),
  };
}

/**
 * Placar de todo mundo que usa o site.
 *
 * Era só entre amigos digitados à mão, e o efeito prático era um ranking vazio:
 * ninguém sabe o nome de conta de ninguém. Agora a lista vem inteira e a de
 * amigos virou um filtro em cima dela. Continua valendo o `hideFromRanking`:
 * quem desligou não entra na lista de ninguém.
 */
async function handleLeaderboard(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  const body = await readJson(req);
  const store = await readStore();
  const me = store.data.users.find((user) => user.id === session.userId);
  if (!me) {
    sendError(req, res, 404, "Conta não encontrada.");
    return;
  }

  const friendNames = new Set(
    (Array.isArray(body.friends) ? body.friends : [])
      .slice(0, 200)
      .map((name) => String(name || "").trim().toLowerCase())
      .filter(Boolean),
  );

  // O dono da sessão entra sempre, mesmo tendo desligado a visibilidade: o
  // ajuste esconde o progresso dos outros, não dele mesmo.
  const visiveis = store.data.users.filter((user) => user.id === me.id || !user.settings?.hideFromRanking);
  const escolhidos = visiveis.slice(0, leaderboardLimit);

  const windows = rankingWindows();
  const scopes = scopesByUser(store.data, escolhidos.map((user) => user.id));
  const rows = escolhidos.map((user) =>
    leaderboardRow(user, scopes.get(user.id), windows, {
      you: user.id === me.id,
      friend: friendNames.has(String(user.name || "").trim().toLowerCase()) || friendNames.has(String(user.id).toLowerCase()),
    }),
  );

  sendJson(req, res, 200, {
    rows,
    total: visiveis.length,
    ocultos: store.data.users.length - visiveis.length,
    updatedAt: Date.now(),
  });
}

/**
 * Cartão público de uma conta. Números e apresentação, nunca conteúdo.
 */
async function handleProfile(req, res, targetId) {
  const session = await requireSession(req, res);
  if (!session) return;

  const store = await readStore();
  const alvo = store.data.users.find((user) => user.id === targetId);
  if (!alvo) {
    sendError(req, res, 404, "Perfil não encontrado.");
    return;
  }

  const eu = alvo.id === session.userId;
  const base = {
    id: alvo.id,
    name: eu ? alvo.name : "",
    displayName: publicName(alvo, { own: eu }),
    avatar: publicAvatarUrl(alvo),
    bio: String(alvo.settings?.bio || ""),
    createdAt: Number(alvo.createdAt || 0),
    you: eu,
  };

  // Quem desligou a visibilidade mantém nome e foto, mas não o progresso.
  if (!eu && alvo.settings?.hideFromRanking) {
    sendJson(req, res, 200, { profile: { ...base, hidden: true } });
    return;
  }

  const scope = scopesByUser(store.data, [alvo.id]).get(alvo.id);
  const stats = gamificationStats(scope);
  const xp = totalXp(stats);
  const windows = rankingWindows();
  sendJson(req, res, 200, {
    profile: {
      ...base,
      hidden: false,
      xp,
      ...levelFromXp(xp),
      dayXp: xpSince(scope, windows.day),
      weekXp: xpSince(scope, windows.week),
      stats,
      unlocked: unlockedAchievements(stats).map((item) => item.id),
    },
  });
}

/**
 * A foto é pública porque já faz parte do cartão público de perfil. Servi-la
 * separadamente mantém o ranking leve e evita descartar imagens por tamanho.
 */
async function handleAvatar(req, res, targetId) {
  const store = await readStore();
  const user = store.data.users.find((item) => item.id === targetId);
  const avatar = String(user?.settings?.avatar || "");
  const match = avatar.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([a-z0-9+/=]+)$/i);
  if (!match) {
    sendError(req, res, 404, "Foto não encontrada.");
    return;
  }

  const image = Buffer.from(match[2], "base64");
  res.writeHead(200, {
    "content-type": match[1].toLowerCase(),
    "content-length": image.length,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(image);
}

async function handleOwnProfileUpdate(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  const body = await readJson(req);
  const rawAvatar = body.avatar;
  const avatar = rawAvatar === null || rawAvatar === "" ? undefined : String(rawAvatar || "");
  if (avatar && !/^data:image\/(?:jpeg|png|webp|gif);base64,[a-z0-9+/=]+$/i.test(avatar)) {
    sendError(req, res, 400, "Formato de foto invalido.");
    return;
  }
  if (avatar && avatar.length > 3_000_000) {
    sendError(req, res, 413, "A foto e grande demais.");
    return;
  }

  let updated = null;
  await mutateData((currentData) => {
    const current = currentData.users.find((user) => user.id === session.userId);
    if (!current) return currentData;
    updated = safeUser({
      ...current,
      settings: { ...current.settings, avatar },
    });
    return {
      ...currentData,
      users: currentData.users.map((user) => (user.id === updated.id ? updated : user)),
    };
  });
  if (!updated) {
    sendError(req, res, 404, "Conta nao encontrada.");
    return;
  }
  sendJson(req, res, 200, { user: updated });
}

async function handleDeleteUser(req, res, targetId) {
  const session = await requireSession(req, res);
  if (!session) return;

  const store = await readStore();
  const actor = store.data.users.find((user) => user.id === session.userId);
  if (!session.isAdmin && !actor?.isAdmin) {
    sendError(req, res, 403, "Apenas administradores podem excluir contas.");
    return;
  }
  if (targetId === session.userId) {
    sendError(req, res, 400, "Você não pode excluir a conta que está usando agora.");
    return;
  }
  const target = store.data.users.find((user) => user.id === targetId);
  if (!target) {
    sendError(req, res, 404, "Conta não encontrada.");
    return;
  }

  const nextData = await saveData({
    ...store.data,
    users: store.data.users.filter((user) => user.id !== targetId),
    subjects: store.data.subjects.filter((item) => item.userId !== targetId),
    materials: store.data.materials.filter((item) => item.userId !== targetId),
    tasks: store.data.tasks.filter((item) => item.userId !== targetId),
    chats: store.data.chats.filter((item) => item.userId !== targetId),
    sessions: store.data.sessions.filter((item) => item.userId !== targetId),
    flashcards: store.data.flashcards.filter((item) => item.userId !== targetId),
    comments: store.data.comments.filter((item) => item.userId !== targetId),
    suggestions: store.data.suggestions.filter((item) => item.userId !== targetId),
  });
  await deleteCredential(targetId);
  await deleteUserSessions(targetId);
  sendJson(req, res, 200, { ok: true, data: dataForSession(nextData, session), database: pool ? "postgres" : "local-file" });
}

export async function handleDataRequest(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    sendJson(req, res, 204, {});
    return true;
  }

  try {
    if (url.pathname === "/api/health" && req.method === "GET") {
      sendJson(req, res, 200, { ok: true, database: pool ? "postgres" : "local-file" });
      return true;
    }

    if (url.pathname === "/api/data" && req.method === "GET") {
      const session = await requireSession(req, res);
      if (!session) return true;
      const store = await readStore();
      sendJson(req, res, 200, { data: dataForSession(store.data, session), database: pool ? "postgres" : "local-file" });
      return true;
    }

    if (url.pathname === "/api/data" && req.method === "PUT") {
      const session = await requireSession(req, res);
      if (!session) return true;
      const body = await readJson(req);
      const nextData = await mutateData((currentData) => mergeUserData(currentData, body.data || body, session));
      sendJson(req, res, 200, { data: dataForSession(nextData, session), database: pool ? "postgres" : "local-file" });
      return true;
    }

    if (url.pathname === "/api/mine-imagem" && (req.method === "POST" || req.method === "GET")) {
      await handleMineImage(req, res);
      return true;
    }

    // Controle Mine: a página de verdade, limpa (sem scripts), para o painel
    // mostrar ao vivo num iframe sandbox. Só https público (page-reader.mjs).
    if (url.pathname === "/api/mine-pagina" && req.method === "POST") {
      const session = await requireSession(req, res);
      if (!session) return true;
      const body = await readJson(req);
      const page = typeof body.url === "string" && body.url.length < 2048 ? await pageForPanel(body.url) : null;
      if (!page) sendError(req, res, 422, "Não deu para abrir esta página.");
      else sendJson(req, res, 200, page);
      return true;
    }

    // Questões reais do ENEM para a aba "Questões" da matéria (21/nov/2026).
    // Mesma busca da ferramenta questoes_enem da Mine, com até 5 por pedido.
    if (url.pathname === "/api/enem" && req.method === "POST") {
      const session = await requireSession(req, res);
      if (!session) return true;
      const body = await readJson(req);
      const tema = typeof body.tema === "string" ? body.tema.slice(0, 120) : "";
      try {
        const result = await questoesEnem({ disciplina: body.disciplina, tema, quantidade: Number(body.quantidade) || 5 }, { max: 5, imagens: true });
        sendJson(req, res, 200, result);
      } catch {
        sendError(req, res, 502, "Não consegui buscar questões do ENEM agora.");
      }
      return true;
    }

    // Busca na web sem passar pelo modelo: a aba "Vídeos e links" da matéria
    // só precisa das fontes (URLs reais), não de uma resposta escrita.
    if (url.pathname === "/api/busca" && req.method === "POST") {
      const session = await requireSession(req, res);
      if (!session) return true;
      if (!webSearchEnabled()) {
        sendError(req, res, 503, "A busca na web está desligada neste servidor.");
        return true;
      }
      const body = await readJson(req);
      const query = typeof body.q === "string" ? body.q.slice(0, 200) : "";
      try {
        const { results } = await searchWeb(query, { maxResults: 10 });
        sendJson(req, res, 200, { results });
      } catch {
        sendError(req, res, 502, "A busca não respondeu agora.");
      }
      return true;
    }

    // Prévias da página da matéria e estúdio da aba Vídeos: busca do YouTube
    // (miniatura + player embutido) e leitura de metadados/legenda de um vídeo
    // específico (mine/video.mjs) para resumo com minutagem e quiz da Mine.
    if (url.pathname === "/api/videos" && req.method === "POST") {
      const session = await requireSession(req, res);
      if (!session) return true;
      const body = await readJson(req);
      const rawAlvo = typeof body.url === "string" && body.url.trim()
        ? body.url.trim()
        : typeof body.videoId === "string" && body.videoId.trim()
          ? `https://www.youtube.com/watch?v=${body.videoId.trim()}`
          : "";
      if (rawAlvo) {
        const id = youtubeId(rawAlvo);
        if (!id) {
          sendError(req, res, 400, "Link do YouTube inválido.");
          return true;
        }
        const cacheKey = id;
        const now = Date.now();
        globalThis.__minervaVideoCache ||= new Map();
        const videoCache = globalThis.__minervaVideoCache;
        const cached = videoCache.get(cacheKey);
        if (cached && cached.ate > now) {
          sendJson(req, res, 200, { video: cached.valor });
          return true;
        }
        try {
          const info = await readYoutubeVideo(`https://www.youtube.com/watch?v=${id}`);
          if (videoCache.size > 150) videoCache.delete(videoCache.keys().next().value);
          videoCache.set(cacheKey, { valor: info, ate: now + 6 * 60 * 60 * 1000 });
          sendJson(req, res, 200, { video: info });
        } catch {
          sendError(req, res, 502, "Não consegui ler os detalhes deste vídeo agora.");
        }
        return true;
      }
      try {
        sendJson(req, res, 200, { videos: await buscarVideos(typeof body.q === "string" ? body.q : "", { max: 8 }) });
      } catch {
        sendError(req, res, 502, "Não consegui buscar vídeos agora.");
      }
      return true;
    }
    // Texto integral de um livro em domínio público (Projeto Gutenberg) para o
    // leitor da Mine. Um segmento só: /api/acervo?id=55752.
    if (url.pathname === "/api/acervo" && req.method === "GET") {
      const session = await requireSession(req, res);
      if (!session) return true;
      try {
        const texto = await textoDoLivro(url.searchParams.get("id"));
        sendJson(req, res, 200, { texto });
      } catch {
        sendError(req, res, 502, "Não consegui abrir este livro agora. Tente de novo em instantes.");
      }
      return true;
    }
    if (url.pathname === "/api/livro" && req.method === "POST") {
      const session = await requireSession(req, res);
      if (!session) return true;
      const body = await readJson(req);
      try {
        sendJson(req, res, 200, await buscarLivro(typeof body.titulo === "string" ? body.titulo : "", typeof body.autor === "string" ? body.autor : ""));
      } catch {
        sendJson(req, res, 200, { capa: "", leitura: null });
      }
      return true;
    }

    if (url.pathname === "/api/mine-voz" && req.method === "POST") {
      await handleMineVoice(req, res);
      return true;
    }

    if (url.pathname === "/api/atelie-ia" && (req.method === "POST" || req.method === "GET")) {
      await handleAtelieIa(req, res);
      return true;
    }

    if (url.pathname === "/api/duelo" && req.method === "POST") {
      await handleDuelo(req, res);
      return true;
    }

    if (url.pathname === "/api/sala" && req.method === "POST") {
      await handleSala(req, res);
      return true;
    }

    if (url.pathname === "/api/leaderboard" && req.method === "POST") {
      await handleLeaderboard(req, res);
      return true;
    }

    if (url.pathname === "/api/avatar" && req.method === "GET") {
      const targetId = String(url.searchParams.get("userId") || "");
      if (!targetId) {
        sendError(req, res, 400, "Perfil não informado.");
        return true;
      }
      await handleAvatar(req, res, targetId);
      return true;
    }

    if (url.pathname === "/api/profile" && req.method === "PUT") {
      await handleOwnProfileUpdate(req, res);
      return true;
    }

    // `/api/profile?userId=` e não `/api/profile/<id>`: na Vercel o catch-all
    // `api/[...path].js` só atende caminhos de um segmento — qualquer coisa
    // com uma barra a mais morre num 404 da plataforma antes de chegar aqui.
    // É a mesma razão pela qual `/api/delete-user?userId=` existe ao lado de
    // `/api/admin/users/<id>`. A forma com barra fica valendo para o servidor
    // Express local, que roteia tudo.
    if ((url.pathname === "/api/profile" || url.pathname.startsWith("/api/profile/")) && req.method === "GET") {
      const targetId =
        url.pathname === "/api/profile"
          ? String(url.searchParams.get("userId") || "")
          : decodeURIComponent(url.pathname.slice("/api/profile/".length));
      if (!targetId) {
        sendError(req, res, 400, "Perfil não informado.");
        return true;
      }
      await handleProfile(req, res, targetId);
      return true;
    }

    if ((url.pathname.startsWith("/api/admin/users/") || url.pathname === "/api/delete-user") && req.method === "DELETE") {
      const targetId = url.pathname === "/api/delete-user"
        ? String(url.searchParams.get("userId") || "")
        : decodeURIComponent(url.pathname.slice("/api/admin/users/".length));
      if (!targetId) {
        sendError(req, res, 400, "Conta não informada.");
        return true;
      }
      await handleDeleteUser(req, res, targetId);
      return true;
    }

    if ((url.pathname === "/api/auth/register" || url.pathname === "/api/register") && req.method === "POST") {
      await handleRegister(req, res);
      return true;
    }

    if ((url.pathname === "/api/auth/login" || url.pathname === "/api/login") && req.method === "POST") {
      await handleLogin(req, res);
      return true;
    }
  } catch (error) {
    sendError(req, res, 500, error instanceof Error ? error.message : "Erro interno no servidor.");
    return true;
  }

  sendError(req, res, 404, "Rota de API não encontrada.");
  return true;
}
