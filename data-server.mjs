import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import pg from "pg";
import { loadLocalEnv } from "./gemini-server.mjs";
import { gamificationStats, levelFromXp, rankingWindows, totalXp, unlockedAchievements, xpSince } from "./shared/xp.mjs";
import { dailyChallengeKey, leagueFromPoints, seasonPoints } from "./shared/game-meta.mjs";
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
// Fotos dos sites do MineCode ({ uso: "site" }) têm cota própria: um site
// pede até 4 de uma vez e não pode comer as imagens do chat.
const MINE_SITE_IMAGE_DAILY_LIMIT = Math.max(0, Number(process.env.MINE_SITE_IMAGE_DAILY_LIMIT || 24) || 24);

async function handleMineImage(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  const site = req.method === "GET" ? new URL(req.url, "http://x").searchParams.get("uso") === "site" : false;
  if (req.method === "GET") {
    const bucket = site ? "minecode-imagem" : "mine-imagem";
    sendJson(req, res, 200, { used: await quotaUsed(session.userId, bucket), limit: site ? MINE_SITE_IMAGE_DAILY_LIMIT : MINE_IMAGE_DAILY_LIMIT });
    return;
  }
  const body = await readJson(req);
  const forSite = body.uso === "site";
  const bucket = forSite ? "minecode-imagem" : "mine-imagem";
  const limit = forSite ? MINE_SITE_IMAGE_DAILY_LIMIT : MINE_IMAGE_DAILY_LIMIT;
  const used = await takeQuota(session.userId, bucket, limit);
  if (used === null) {
    const error = forSite ? `Hoje os seus sites já usaram as ${limit} fotos do dia. Amanhã tem mais!` : `Hoje você já criou as ${limit} imagens do dia. Amanhã tem mais!`;
    sendJson(req, res, 429, { error, code: "quota", used: limit, limit });
    return;
  }
  try {
    const result = await generateMineImage({ prompt: body.prompt, reference: body.reference });
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
    settings: defaultSettings(name),
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

function publicName(user) {
  return String(user.settings?.displayName || user.name || "").trim() || String(user.name || "");
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
    name: user.name,
    displayName: publicName(user),
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
      friend: friendNames.has(String(user.name || "").trim().toLowerCase()),
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
    name: alvo.name,
    displayName: publicName(alvo),
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

    if (url.pathname === "/api/mine-voz" && req.method === "POST") {
      await handleMineVoice(req, res);
      return true;
    }

    if (url.pathname === "/api/atelie-ia" && (req.method === "POST" || req.method === "GET")) {
      await handleAtelieIa(req, res);
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
