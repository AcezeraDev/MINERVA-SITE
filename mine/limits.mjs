// Rate limit e validacao de payload (documento, secoes 21 e 40).
//
// O contador vive na memoria do processo. Em servidor unico isso e exato; em
// funcoes serverless cada instancia tem o seu, entao o limite real fica um
// pouco mais frouxo que o configurado. Serve como primeira barreira contra
// abuso — nao substitui o limite do provedor, complementa. Para um limite
// exato entre instancias, trocar `buckets` por Redis mantendo esta interface.

import { MAX_CHAT_PROMPT_CHARS } from "../shared/chat-limits.mjs";

const buckets = new Map();

const WINDOWS = [
  { name: "minuto", ms: 60_000, envKey: "MINE_RATE_PER_MINUTE", fallback: 20 },
  { name: "hora", ms: 3_600_000, envKey: "MINE_RATE_PER_HOUR", fallback: 120 },
];

function limitFor(window) {
  const raw = Number(process.env[window.envKey]);
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : window.fallback;
}

// Identidade do pedido. Hoje e o IP; quando houver sessao obrigatoria no
// endpoint, basta devolver o id do usuario aqui.
export function resolveIdentity(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "");
  const ip = forwarded.split(",")[0].trim() || req.socket?.remoteAddress || "desconhecido";
  return `ip:${ip}`;
}

function prune(now) {
  const maxWindow = Math.max(...WINDOWS.map((window) => window.ms));
  for (const [key, hits] of buckets) {
    const alive = hits.filter((time) => now - time < maxWindow);
    if (alive.length) buckets.set(key, alive);
    else buckets.delete(key);
  }
}

/**
 * Registra uma tentativa e diz se ela pode seguir.
 * Devolve { allowed, retryAfterSeconds, window }.
 */
export function checkRateLimit(identity) {
  const now = Date.now();
  // Limpeza barata: so quando o mapa cresce, para nao varrer a cada pedido.
  if (buckets.size > 500) prune(now);

  const hits = (buckets.get(identity) || []).filter((time) => now - time < WINDOWS[WINDOWS.length - 1].ms);

  for (const window of WINDOWS) {
    const limit = limitFor(window);
    const recent = hits.filter((time) => now - time < window.ms);
    if (recent.length >= limit) {
      const oldest = recent[0];
      return {
        allowed: false,
        window: window.name,
        retryAfterSeconds: Math.max(1, Math.ceil((window.ms - (now - oldest)) / 1000)),
      };
    }
  }

  hits.push(now);
  buckets.set(identity, hits);
  return { allowed: true };
}

export const MAX_ATTACHMENTS = 6;
export const MAX_ATTACHMENT_BYTES = 8_000_000;
export const MAX_PROMPT_LENGTH = MAX_CHAT_PROMPT_CHARS;

const ALLOWED_MIME_PREFIXES = ["image/", "text/", "application/pdf", "application/vnd.openxmlformats", "application/msword"];

function mimeAllowed(type) {
  const clean = String(type || "").toLowerCase();
  if (!clean) return true; // texto ja extraido no cliente pode vir sem tipo
  return ALLOWED_MIME_PREFIXES.some((prefix) => clean.startsWith(prefix));
}

/**
 * Valida o que o cliente mandou. Devolve mensagem de erro amigavel ou null.
 * Nada aqui confia no frontend: o usuario pode editar a requisicao na mao.
 */
export function validateChatPayload(payload) {
  const prompt = String(payload?.prompt || "");
  const attachments = Array.isArray(payload?.attachments) ? payload.attachments : [];

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return "Sua mensagem é longa demais. Tente dividir em partes menores.";
  }
  if (!prompt.trim() && !attachments.length) {
    return "Escreva uma pergunta ou anexe um arquivo.";
  }
  if (attachments.length > MAX_ATTACHMENTS) {
    return `Você pode enviar até ${MAX_ATTACHMENTS} anexos por mensagem.`;
  }
  for (const item of attachments) {
    if (Number(item?.size || 0) > MAX_ATTACHMENT_BYTES) {
      return "Este arquivo excede o limite permitido.";
    }
    if (!mimeAllowed(item?.type)) {
      return "Não consigo processar este tipo de arquivo. Envie imagem, PDF, texto ou documento do Office.";
    }
  }
  return null;
}
