// Voz da Mine na aba Idiomas: texto em inglês -> MP3 pela NanoGPT
// (rota OpenAI-compatível /audio/speech). O navegador chama /api/mine-voz;
// sem chave, sem cota ou com erro, a tela volta para a voz do próprio
// navegador (src/idiomas/voz.ts), então nada aqui pode travar a lição.
//
// Modelo padrão: gpt-4o-mini-tts — o mais barato da lista da NanoGPT
// (US$ 0,0006 por mil caracteres em out/2026) e o único que aceita
// instruções de estilo, que é como sai a fala "devagar" (ele ignora `speed`).

import { createHash } from "node:crypto";
import { nanogptBaseUrl, nanogptKeys } from "./providers.mjs";

export const MINE_VOICE_DAILY_LIMIT = clampInt(process.env.MINE_VOICE_DAILY_LIMIT, 20, 5000, 400);
export const MINE_VOICE_MAX_CHARS = 220;

const CACHE_LIMIT = 300;
const cache = new Map();

export class MineVoiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function clampInt(value, min, max, fallback) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

export function voiceModel() {
  return String(process.env.MINE_TTS_MODEL || "gpt-4o-mini-tts").trim();
}

export function voiceName() {
  return String(process.env.MINE_TTS_VOICE || "coral").trim();
}

export function voiceConfigured() {
  return nanogptKeys().length > 0;
}

/**
 * Limpa e valida o texto. Só inglês curto: é a pronúncia de uma palavra, de
 * uma frase da lição ou de uma fala do roleplay — nunca um texto qualquer.
 */
export function cleanVoiceText(text) {
  const value = String(text || "")
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) throw new MineVoiceError("Nada para falar.");
  if (value.length > MINE_VOICE_MAX_CHARS) throw new MineVoiceError("Texto longo demais para a voz.");
  if (!/[a-z]/i.test(value)) throw new MineVoiceError("A voz da Mine só lê inglês.");
  return value;
}

export function voiceInstructions(slow) {
  return slow
    ? "You are a warm, patient English teacher for Brazilian kids. Speak VERY slowly, separating each word clearly, with natural British pronunciation."
    : "You are a warm, friendly English teacher for Brazilian school students. Speak clearly at a calm, slightly slow pace, with natural British pronunciation.";
}

export function voiceCacheKey(text, slow, model = voiceModel(), voice = voiceName()) {
  return createHash("sha256").update(`${model}|${voice}|${slow ? 1 : 0}|${text.toLowerCase()}`).digest("hex").slice(0, 32);
}

/** Devolve { audio: Buffer, type, cached }. */
export async function synthesizeVoice({ text, slow = false, fetchImpl = fetch } = {}) {
  const input = cleanVoiceText(text);
  const key = voiceCacheKey(input, slow);
  const hit = cache.get(key);
  if (hit) {
    // reinsere no fim: o Map vira uma fila de "usado por último"
    cache.delete(key);
    cache.set(key, hit);
    return { ...hit, cached: true };
  }
  const apiKey = nanogptKeys()[0];
  if (!apiKey) throw new MineVoiceError("A voz da Mine não está configurada no servidor.", 503);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let response;
  try {
    response = await fetchImpl(`${nanogptBaseUrl()}/audio/speech`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: voiceModel(), voice: voiceName(), input, instructions: voiceInstructions(slow), response_format: "mp3" }),
      signal: controller.signal,
    });
  } catch {
    throw new MineVoiceError("A voz da Mine não respondeu a tempo.", 504);
  } finally {
    clearTimeout(timer);
  }
  const type = String(response.headers.get("content-type") || "");
  if (!response.ok || type.includes("json")) {
    const detail = await response.text().catch(() => "");
    console.error("[mine-voz]", response.status, detail.slice(0, 300));
    throw new MineVoiceError("A voz da Mine falhou agora.", response.status === 429 ? 429 : 502);
  }
  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length < 200) throw new MineVoiceError("A voz da Mine veio vazia.", 502);
  const entry = { audio, type: type.startsWith("audio/") ? type : "audio/mpeg" };
  cache.set(key, entry);
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  return { ...entry, cached: false };
}

/** Só para os testes. */
export function clearVoiceCache() {
  cache.clear();
}
