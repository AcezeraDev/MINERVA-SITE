/**
 * Voz da aba Idiomas: ouvir a pronúncia e falar no microfone. A pronúncia
 * usa a voz da Mine (IA da NanoGPT, por /api/mine-voz) e cai na voz do
 * navegador (Web Speech API) quando ela não vem. O microfone é só local.
 *
 * Os dois lados variam muito por navegador — o reconhecimento só existe no
 * Chrome/Edge/Safari — então cada função diz se está disponível e a tela
 * oferece outra saída quando não está (digitar, pular).
 */

import { readSession } from "../main";

let cachedVoice: SpeechSynthesisVoice | null | undefined;

function englishVoice() {
  if (cachedVoice !== undefined && cachedVoice !== null) return cachedVoice;
  const voices = typeof speechSynthesis !== "undefined" ? speechSynthesis.getVoices() : [];
  const english = voices.filter((voice) => /^en[-_]/i.test(voice.lang));
  // vozes "natural"/"neural" soam bem melhor; depois en-GB (a viagem é em Londres)
  cachedVoice =
    english.find((voice) => /natural|neural|online/i.test(voice.name) && /GB/i.test(voice.lang)) ||
    english.find((voice) => /natural|neural|online/i.test(voice.name)) ||
    english.find((voice) => /GB/i.test(voice.lang)) ||
    english[0] ||
    null;
  return cachedVoice;
}

if (typeof speechSynthesis !== "undefined") {
  speechSynthesis.addEventListener?.("voiceschanged", () => {
    cachedVoice = undefined;
  });
}

/* ─────────────── voz da Mine (IA da NanoGPT, via /api/mine-voz) ─────────────── */

const voicePrefKey = "minerva-idiomas-voz";
const clips = new Map<string, Promise<string | null>>();
let aiDown = false; // sem chave/cota no servidor: para de tentar nesta visita
let current: HTMLAudioElement | null = null;
let playToken = 0;

export type VoiceSource = "mine" | "navegador";

export function voiceSource(): VoiceSource {
  try {
    return localStorage.getItem(voicePrefKey) === "navegador" ? "navegador" : "mine";
  } catch {
    return "mine";
  }
}

export function setVoiceSource(source: VoiceSource) {
  try {
    localStorage.setItem(voicePrefKey, source);
  } catch {
    // sem armazenamento: vale só nesta visita
  }
  if (source === "mine") aiDown = false;
}

/** MP3 da frase (URL de blob), ou null quando a voz da IA não está disponível. */
function mineClip(text: string, slow: boolean) {
  const key = `${slow ? 1 : 0}|${text}`;
  const cached = clips.get(key);
  if (cached) return cached;
  const request = (async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch("/api/mine-voz", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${readSession().token || ""}` },
        body: JSON.stringify({ text, slow }),
        signal: controller.signal,
      });
      if (!response.ok || !(response.headers.get("content-type") || "").startsWith("audio/")) {
        // 503 = sem chave, 429 = cota do dia, 401 = sem sessão: não adianta insistir
        if ([401, 429, 503].includes(response.status)) aiDown = true;
        return null;
      }
      return URL.createObjectURL(await response.blob());
    } catch {
      return null;
    } finally {
      window.clearTimeout(timer);
    }
  })();
  clips.set(key, request);
  // falha não fica no cache: a próxima vez tenta de novo
  request.then((url) => {
    if (!url) clips.delete(key);
  });
  return request;
}

function playClip(url: string, token: number) {
  return new Promise<boolean>((resolve) => {
    if (token !== playToken) return resolve(true);
    const audio = new Audio(url);
    current = audio;
    audio.onended = () => resolve(true);
    audio.onerror = () => resolve(false);
    audio.play().catch(() => resolve(false));
  });
}

export function canSpeak() {
  return typeof window !== "undefined" && ("speechSynthesis" in window || typeof Audio !== "undefined");
}

/**
 * Fala o texto em inglês. `slow` é o botão da tartaruga. Primeiro a voz da
 * Mine (IA); se ela não vier, a voz do navegador — a lição nunca fica muda.
 */
export async function speak(text: string, { slow = false }: { slow?: boolean } = {}) {
  if (!text) return;
  stopSpeaking();
  const token = ++playToken;
  if (voiceSource() === "mine" && !aiDown) {
    const url = await mineClip(text, slow);
    if (token !== playToken) return; // outra fala começou enquanto esta carregava
    if (url && (await playClip(url, token))) return;
  }
  if (token !== playToken) return;
  await browserSpeak(text, slow);
}

/** Baixa o áudio antes de precisar (ex.: as opções da questão seguinte). */
export function preloadSpeech(texts: string[]) {
  if (voiceSource() !== "mine" || aiDown) return;
  for (const text of texts.slice(0, 6)) void mineClip(text, false);
}

function browserSpeak(text: string, slow: boolean) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve();
  speechSynthesis.cancel();
  return new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = englishVoice();
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || "en-GB";
    utterance.rate = slow ? 0.6 : 0.92;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    speechSynthesis.speak(utterance);
    // alguns navegadores nunca disparam onend: a promessa não pode ficar pendurada
    window.setTimeout(resolve, 600 + text.length * (slow ? 140 : 90));
  });
}

export function stopSpeaking() {
  playToken += 1;
  if (current) {
    current.pause();
    current = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) speechSynthesis.cancel();
}

type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function recognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const host = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
  return host.SpeechRecognition || host.webkitSpeechRecognition || null;
}

export function canListen() {
  return Boolean(recognitionCtor());
}

export type Listening = { stop: () => void };

/**
 * Escuta uma fala em inglês. `onText` recebe o parcial enquanto a pessoa fala
 * e `onDone` o texto final (vazio quando não ouviu nada ou deu erro).
 */
export function listen({ onText, onDone }: { onText: (text: string) => void; onDone: (text: string, error?: string) => void }): Listening | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;
  recognition.continuous = false;
  let latest = "";
  let finished = false;
  let failure: string | undefined;
  recognition.onresult = (event) => {
    latest = Array.from(event.results)
      .map((result) => result[0]?.transcript || "")
      .join(" ")
      .trim();
    onText(latest);
  };
  recognition.onerror = (event) => {
    failure = event.error || "erro";
  };
  recognition.onend = () => {
    if (finished) return;
    finished = true;
    onDone(latest, latest ? undefined : failure);
  };
  try {
    stopSpeaking();
    recognition.start();
  } catch {
    return null;
  }
  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        // já tinha parado
      }
    },
  };
}
