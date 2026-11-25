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
// Nov/2026 (25): a Mine também fala português — narração dos slides, podcast
// da matéria e a aula por voz. Trechos maiores, cortados em frases no navegador.
export const MINE_VOICE_MAX_CHARS_PT = 600;

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

// Nov/2026 (25): o português tem modelo próprio. A voz americana do
// gpt-4o-mini-tts lendo português soava estrangeira; a Camila (ByteDance Seed
// TTS 3.0, pt-BR nativa, US$ 0,02 por mil letras) foi a escolhida. O inglês
// da aba Idiomas continua no modelo de cima.
export function voiceModelPt() {
  return String(process.env.MINE_TTS_MODEL_PT || "bytedance/seed-tts-3.0").trim();
}

export function voiceNamePt() {
  return String(process.env.MINE_TTS_VOICE_PT || "camila_pt_br").trim();
}

// Aula por voz: a Camila leva ~8 s para começar qualquer frase (medido em
// 25/nov/2026, até "Uhum."), o que mata a conversa. Na chamada vai a Maitê
// (Inworld TTS 1.5 max, brasileira): ~1 s numa frase curta, US$ 0,02 por mil
// letras. A Sarah do ElevenLabs soa bem, mas pela NanoGPT o Turbo 2.5 vem
// em fila (3,4 s numa frase curta) e o v4 leva ~8 s.
// Podcast e slides baixam antes, então lá a demora da Camila não aparece.
// 25/nov/2026 (tarde): o Davi trocou para a Sarah. Pedida com `stream: true`
// na rota /audio/speech, ela NÃO entra na fila: o áudio volta direto em
// ~1,4 a 1,8 s (curta ou longa), contra 3,4 a 9 s pela fila. Se mesmo assim
// vier um tíquete da fila, `esperarFila` busca o áudio.
export function voiceModelCall() {
  return String(process.env.MINE_TTS_MODEL_CHAMADA || "Elevenlabs-Turbo-V2.5").trim();
}

export function voiceNameCall() {
  return String(process.env.MINE_TTS_VOICE_CHAMADA || "Sarah").trim();
}

/** ElevenLabs pela NanoGPT: sem `stream` o pedido vai para uma fila assíncrona. */
function modelUsesQueue(model) {
  return /elevenlabs/i.test(model);
}

/** Tíquete da fila ({ runId, status: "pending" }): consulta até o áudio ficar pronto. */
async function esperarFila({ ticket, model, apiKey, fetchImpl, ate }) {
  const raiz = nanogptBaseUrl().replace(/\/v1$/, "");
  while (Date.now() < ate) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const url = `${raiz}/tts/status?runId=${encodeURIComponent(ticket.runId)}&model=${encodeURIComponent(model)}`;
    const resposta = await fetchImpl(url, { headers: { "x-api-key": apiKey, authorization: `Bearer ${apiKey}` } });
    const estado = await resposta.json().catch(() => ({}));
    if (estado.status === "error") break;
    if (estado.status === "completed" && estado.audioUrl) {
      const audio = await fetchImpl(estado.audioUrl);
      if (!audio.ok) break;
      return { audio: Buffer.from(await audio.arrayBuffer()), type: String(audio.headers.get("content-type") || "audio/mpeg") };
    }
  }
  throw new MineVoiceError("A voz da Mine demorou demais.", 504);
}

/** Voz do Leo, o colega do podcast: outra voz para dar para distinguir. */
export function partnerVoiceName() {
  return String(process.env.MINE_TTS_VOICE_LEO || "arthur_pt_br").trim();
}

/** Os modelos da OpenAI aceitam instruções de estilo; os outros recusam o campo. */
function modelAcceptsInstructions(model) {
  return /tts/i.test(model) && !model.includes("/");
}

// Lida em português, "Mine" vira "Míni". Só o áudio recebe a grafia que soa
// "Máine"; o texto na tela não muda. Ajustável por MINE_TTS_NOME_FALADO.
export function spokenName() {
  return String(process.env.MINE_TTS_NOME_FALADO || "Máine").trim();
}

export function forPronunciation(text) {
  const nome = spokenName();
  return nome ? text.replace(/\bMine\b|\bMINE\b/g, nome) : text;
}

export function voiceConfigured() {
  return nanogptKeys().length > 0;
}

/**
 * Limpa e valida o texto. Só inglês curto: é a pronúncia de uma palavra, de
 * uma frase da lição ou de uma fala do roleplay — nunca um texto qualquer.
 */
export function cleanVoiceText(text, lang = "en") {
  const value = String(text || "")
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) throw new MineVoiceError("Nada para falar.");
  if (lang === "pt") {
    if (value.length > MINE_VOICE_MAX_CHARS_PT) throw new MineVoiceError("Texto longo demais para a voz.");
    if (!/[a-zà-ú]/i.test(value)) throw new MineVoiceError("Nada para falar.");
    return value;
  }
  if (value.length > MINE_VOICE_MAX_CHARS) throw new MineVoiceError("Texto longo demais para a voz.");
  if (!/[a-z]/i.test(value)) throw new MineVoiceError("A voz da Mine só lê inglês.");
  return value;
}

export function voiceInstructions(slow, lang = "en", quem = "mine") {
  if (lang === "pt") {
    return quem === "leo"
      ? "Voce e o Leo, um estudante brasileiro curioso de 15 anos conversando com a professora num podcast escolar. Fale portugues do Brasil natural, animado e espontaneo, em ritmo normal."
      : "Voce e a Mine, professora particular brasileira, calorosa e paciente, falando com um estudante de escola. Fale portugues do Brasil natural e claro, em ritmo calmo, com entonacao de quem explica com carinho.";
  }
  return slow
    ? "You are a warm, patient English teacher for Brazilian kids. Speak VERY slowly, separating each word clearly, with natural British pronunciation."
    : "You are a warm, friendly English teacher for Brazilian school students. Speak clearly at a calm, slightly slow pace, with natural British pronunciation.";
}

export function voiceCacheKey(text, slow, model = voiceModel(), voice = voiceName(), lang = "en") {
  return createHash("sha256").update(`${model}|${voice}|${slow ? 1 : 0}|${lang}|${text.toLowerCase()}`).digest("hex").slice(0, 32);
}

/** Devolve { audio: Buffer, type, cached }. */
export async function synthesizeVoice({ text, slow = false, lang = "en", quem = "mine", chamada = false, fetchImpl = fetch } = {}) {
  const idioma = lang === "pt" ? "pt" : "en";
  const pessoa = quem === "leo" ? "leo" : "mine";
  const naChamada = idioma === "pt" && pessoa === "mine" && chamada === true;
  const clean = cleanVoiceText(text, idioma);
  const input = idioma === "pt" ? forPronunciation(clean) : clean;
  const model = naChamada ? voiceModelCall() : idioma === "pt" ? voiceModelPt() : voiceModel();
  const voice = naChamada ? voiceNameCall() : idioma === "pt" ? (pessoa === "leo" ? partnerVoiceName() : voiceNamePt()) : voiceName();
  const key = voiceCacheKey(input, slow, model, voice, idioma);
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
      body: JSON.stringify({
        model,
        voice,
        input,
        ...(modelAcceptsInstructions(model) ? { instructions: voiceInstructions(slow, idioma, pessoa) } : {}),
        ...(idioma === "pt" && /^bytedance\//i.test(model) ? { language: "pt-BR" } : {}),
        ...(modelUsesQueue(model) ? { stream: true } : {}),
        response_format: "mp3",
      }),
      signal: controller.signal,
    });
  } catch {
    throw new MineVoiceError("A voz da Mine não respondeu a tempo.", 504);
  } finally {
    clearTimeout(timer);
  }
  const type = String(response.headers.get("content-type") || "");
  if (response.ok && type.includes("json") && modelUsesQueue(model)) {
    const ticket = await response.json().catch(() => ({}));
    if (ticket?.runId) {
      const pronto = await esperarFila({ ticket, model, apiKey, fetchImpl, ate: Date.now() + 15_000 });
      return guardar(key, pronto.audio, pronto.type);
    }
    throw new MineVoiceError("A voz da Mine falhou agora.", 502);
  }
  if (!response.ok || type.includes("json")) {
    const detail = await response.text().catch(() => "");
    console.error("[mine-voz]", response.status, detail.slice(0, 300));
    throw new MineVoiceError("A voz da Mine falhou agora.", response.status === 429 ? 429 : 502);
  }
  return guardar(key, Buffer.from(await response.arrayBuffer()), type);
}

function guardar(key, audio, type) {
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
