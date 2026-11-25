/*
 * Voz da Mine em português (25/nov/2026): narração dos slides, podcast da
 * matéria e aula por voz. O áudio vem de /api/mine-voz (NanoGPT, o mesmo da
 * aba Idiomas, com lang "pt"); sem chave, sem cota ou com erro, cai na voz do
 * navegador — nada fica mudo.
 *
 * O texto é cortado em frases de até ~500 letras (o servidor aceita 600) e
 * a próxima frase já é baixada enquanto a atual toca, para não ter pausa.
 */

import { readSession } from "../main";

export type Quem = "mine" | "leo";
/** "chamada" = aula por voz: o servidor usa a voz rápida da conversa. */
type Opcoes = { quem?: Quem; chamada?: boolean };
/** Aula por voz: avisa qual frase começou a tocar (para as legendas). */
type OpcoesFluxo = Opcoes & { aoComecar?: (texto: string) => void };

let vozDaMineFora = false; // 401/429/503: para de tentar nesta visita
let audioAtual: HTMLAudioElement | null = null;
let rodada = 0;

/** Texto de markdown/LaTeX virado em fala. */
export function textoParaFala(texto: string) {
  return texto
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[\[[^\]]*\]\]/g, " ")
    .replace(/\{\{|\}\}/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[\d+\]/g, "")
    .replace(/\$\$?([^$]+)\$\$?/g, (_, tex: string) => tex.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1 sobre $2").replace(/\\cdot|\\times/g, " vezes ").replace(/\^2/g, " ao quadrado").replace(/\\[a-z]+/gi, " ").replace(/[{}_^]/g, " "))
    .replace(/^#+\s*/gm, "")
    .replace(/^>\s*\[![^\]]+\]\s*/gm, "")
    .replace(/^[-*>]\s+/gm, "")
    .replace(/\|/g, ", ")
    .replace(/[*_`~=]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Frases de até `max` letras, sem cortar no meio de palavra. */
export function emFrases(texto: string, max = 480) {
  const frases = texto.match(/[^.!?…]+[.!?…]*\s*/g) || [texto];
  const partes: string[] = [];
  let atual = "";
  for (const frase of frases) {
    if ((atual + frase).length > max && atual) {
      partes.push(atual.trim());
      atual = "";
    }
    if (frase.length > max) {
      for (let i = 0; i < frase.length; i += max) partes.push(frase.slice(i, i + max).trim());
    } else atual += frase;
  }
  if (atual.trim()) partes.push(atual.trim());
  return partes.filter(Boolean);
}

const clipes = new Map<string, Promise<string | null>>();

function baixar(texto: string, quem: Quem, chamada = false) {
  const chave = `${quem}|${chamada ? 1 : 0}|${texto}`;
  const pronto = clipes.get(chave);
  if (pronto) return pronto;
  const pedido = (async () => {
    if (vozDaMineFora) return null;
    const controle = new AbortController();
    const timer = window.setTimeout(() => controle.abort(), 15_000);
    try {
      const resposta = await fetch("/api/mine-voz", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${readSession().token || ""}` },
        body: JSON.stringify({ text: texto, lang: "pt", quem, chamada: chamada || undefined }),
        signal: controle.signal,
      });
      if (!resposta.ok || !(resposta.headers.get("content-type") || "").startsWith("audio/")) {
        if ([401, 429, 503].includes(resposta.status)) vozDaMineFora = true;
        return null;
      }
      return URL.createObjectURL(await resposta.blob());
    } catch {
      return null;
    } finally {
      window.clearTimeout(timer);
    }
  })();
  clipes.set(chave, pedido);
  pedido.then((url) => {
    if (!url) clipes.delete(chave);
  });
  return pedido;
}

// Quem espera o áudio atual acabar: `pararDeFalar` solta a espera, senão a
// promessa de um áudio pausado ficava pendurada para sempre.
let soltarAudioAtual: ((terminou: boolean) => void) | null = null;
const despertadores = new Set<() => void>();

/* Medidor da voz da Mine (aula por voz): enquanto ligado, cada áudio passa
 * por um AnalyserNode e a bola da chamada cresce com o volume real da fala.
 * Só passa pelo medidor com o AudioContext rodando — com ele suspenso, o
 * áudio roteado ficaria mudo. */
let contexto: AudioContext | null = null;
let analisadorSaida: AnalyserNode | null = null;
let medirSaida = false;

/** O AudioContext da chamada (criado num gesto do usuário). */
export function contextoDeAudio() {
  if (typeof window === "undefined") return null;
  try {
    if (!contexto) {
      const Classe = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Classe) return null;
      contexto = new Classe();
    }
    if (contexto.state === "suspended") void contexto.resume();
    return contexto;
  } catch {
    return null;
  }
}

export function ligarMedidorDeSaida() {
  const ctx = contextoDeAudio();
  if (!ctx) return;
  if (!analisadorSaida) {
    analisadorSaida = ctx.createAnalyser();
    analisadorSaida.fftSize = 512;
    analisadorSaida.smoothingTimeConstant = 0.6;
    analisadorSaida.connect(ctx.destination);
  }
  medirSaida = true;
}
export function desligarMedidorDeSaida() {
  medirSaida = false;
}
/** O analisador da voz que está tocando (null se não dá para medir). */
export const medidorDeSaida = () => (medirSaida && contexto?.state === "running" ? analisadorSaida : null);

function tocar(url: string, minhaRodada: number, velocidade: number) {
  return new Promise<boolean>((resolve) => {
    if (minhaRodada !== rodada) return resolve(true);
    const audio = new Audio(url);
    if (medirSaida && contexto?.state === "running" && analisadorSaida) {
      try {
        contexto.createMediaElementSource(audio).connect(analisadorSaida);
      } catch {
        // sem medidor: o áudio toca direto
      }
    }
    audio.playbackRate = velocidade;
    audioAtual = audio;
    soltarAudioAtual = resolve;
    audio.onended = () => resolve(true);
    audio.onerror = () => resolve(false);
    audio.play().catch(() => resolve(false));
  });
}

function vozDoNavegador(texto: string, quem: Quem, velocidade: number) {
  return new Promise<void>((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve();
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = "pt-BR";
    const vozes = window.speechSynthesis.getVoices().filter((v) => /^pt(-|_)?BR/i.test(v.lang));
    if (vozes.length) fala.voice = vozes[quem === "leo" && vozes.length > 1 ? 1 : 0];
    fala.pitch = quem === "leo" && vozes.length < 2 ? 0.8 : 1;
    fala.rate = velocidade;
    fala.onend = () => resolve();
    fala.onerror = () => resolve();
    window.speechSynthesis.speak(fala);
  });
}

/**
 * Fala o texto inteiro e resolve quando termina (ou quando outra fala começa
 * ou `pararDeFalar` é chamado). Devolve false se foi interrompida.
 */
export async function falarComoMine(texto: string, { quem = "mine", velocidade = 1, chamada = false }: Opcoes & { velocidade?: number } = {}) {
  pararDeFalar();
  const minhaRodada = ++rodada;
  const partes = emFrases(textoParaFala(texto));
  for (let i = 0; i < partes.length; i += 1) {
    if (minhaRodada !== rodada) return false;
    const url = await baixar(partes[i], quem, chamada);
    if (partes[i + 1]) void baixar(partes[i + 1], quem, chamada);
    if (minhaRodada !== rodada) return false;
    if (url && (await tocar(url, minhaRodada, velocidade))) continue;
    if (minhaRodada !== rodada) return false;
    await vozDoNavegador(partes[i], quem, velocidade);
  }
  return minhaRodada === rodada;
}

/** Baixa antes (a próxima fala do podcast, o próximo slide). */
export function prepararFala(texto: string, quem: Quem = "mine") {
  const primeira = emFrases(textoParaFala(texto))[0];
  if (primeira) void baixar(primeira, quem);
}

export function pararDeFalar() {
  rodada += 1;
  if (audioAtual) {
    audioAtual.pause();
    audioAtual = null;
  }
  const soltar = soltarAudioAtual;
  soltarAudioAtual = null;
  soltar?.(true);
  for (const acordar of [...despertadores]) acordar();
  despertadores.clear();
  // Os "uhum" soltos também param ao interromper ou encerrar.
  for (const audio of [...soltos]) audio.pause();
  soltos.clear();
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** O áudio que está tocando agora (a bola da aula por voz mede o volume dele). */
export const audioTocando = () => audioAtual;

export type FalaEmFluxo = {
  /** Texto novo (uma ou mais frases completas). */
  adicionar: (texto: string) => void;
  /** Um clipe já pronto (o "Hum…" do começo da resposta). */
  adicionarClipe: (url: string) => void;
  /** Não vem mais nada: quando a fila acabar, `terminou` resolve. */
  fechar: () => void;
  /** true = falou tudo; false = foi interrompida. */
  terminou: Promise<boolean>;
};

/**
 * Fala em fluxo (aula por voz, 25/nov/2026): as frases entram enquanto a
 * resposta ainda está chegando e já começam a baixar em paralelo — a voz tem
 * uma demora fixa por pedido, então pedir tudo junto esconde essa demora.
 */
export function criarFalaEmFluxo({ quem = "mine", chamada = true, aoComecar }: OpcoesFluxo = {}): FalaEmFluxo {
  pararDeFalar();
  const minhaRodada = ++rodada;
  const fila: { texto: string; url: Promise<string | null> }[] = [];
  let fechada = false;
  let acordar: (() => void) | null = null;
  const sinal = () => {
    const fn = acordar;
    acordar = null;
    if (fn) {
      despertadores.delete(fn);
      fn();
    }
  };
  const esperar = () =>
    new Promise<void>((resolve) => {
      acordar = resolve;
      despertadores.add(resolve);
    });
  const terminou = (async () => {
    for (let i = 0; ; i += 1) {
      while (i >= fila.length && !fechada && minhaRodada === rodada) await esperar();
      if (minhaRodada !== rodada) return false;
      if (i >= fila.length) return true;
      const item = fila[i];
      const url = await item.url;
      if (minhaRodada !== rodada) return false;
      if (item.texto) aoComecar?.(item.texto);
      if (url && (await tocar(url, minhaRodada, 1))) continue;
      if (minhaRodada !== rodada) return false;
      if (item.texto) await vozDoNavegador(item.texto, quem, 1);
    }
  })();
  return {
    adicionar(texto) {
      if (minhaRodada !== rodada) return;
      const limpo = textoParaFala(texto);
      if (!/[a-zà-ú0-9]/i.test(limpo)) return;
      for (const parte of emFrases(limpo, 300)) fila.push({ texto: parte, url: baixar(parte, quem, chamada) });
      sinal();
    },
    adicionarClipe(url) {
      if (minhaRodada !== rodada) return;
      fila.push({ texto: "", url: Promise.resolve(url) });
      sinal();
    },
    fechar() {
      fechada = true;
      sinal();
    },
    terminou,
  };
}

/** Clipe curto por cima da escuta ("uhum"), sem parar a fala nem a fila. */
const soltos = new Set<HTMLAudioElement>();
export function tocarSolto(url: string, volume = 0.75) {
  const audio = new Audio(url);
  audio.volume = volume;
  soltos.add(audio);
  const fim = () => soltos.delete(audio);
  return audio.play().then(
    () => new Promise<void>((resolve) => { audio.onended = () => { fim(); resolve(); }; audio.onerror = () => { fim(); resolve(); }; audio.onpause = () => { fim(); resolve(); }; }),
    () => { fim(); },
  );
}

/** Baixa e devolve a URL de um áudio da voz da chamada (para os "uhum" sem clipe pronto). */
export function baixarFalaDaChamada(texto: string) {
  return baixar(texto, "mine", true);
}

export const podeFalar = () => typeof window !== "undefined" && (typeof Audio !== "undefined" || "speechSynthesis" in window);
