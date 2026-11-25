import { useCallback, useEffect, useRef, useState } from "react";
import { Captions, Headphones, Keyboard, Mic, MicOff, Send, X } from "lucide-react";
import {
  baixarFalaDaChamada,
  contextoDeAudio,
  criarFalaEmFluxo,
  desligarMedidorDeSaida,
  ligarMedidorDeSaida,
  medidorDeSaida,
  pararDeFalar,
  tocarSolto,
  type FalaEmFluxo,
} from "./vozMine";
import "./chamada.css";

/*
 * Aula por voz com a Mine (25/nov/2026, no jeito do modo de voz do ChatGPT).
 * A tela inteira vira a bola da Mine; a conversa continua escrita no chat por
 * baixo, como transcrição.
 *
 * - A bola cresce com o volume REAL: da voz da Mine quando ela fala (um
 *   AnalyserNode em vozMine.ts) e do microfone quando o aluno fala (no
 *   computador; no celular o microfone fica só com o reconhecimento de voz).
 * - O microfone fica ligado enquanto o aluno fala (reconhecimento contínuo do
 *   navegador). A fala termina por silêncio medido aqui (~0,8 s).
 * - Enquanto a Mine fala, o microfone DESLIGA e volta ~0,7 s depois: o
 *   reconhecimento do navegador não cancela o som da caixa e a Mine respondia
 *   a si mesma (testado em 25/nov/2026). Para interromper, toca-se na bola
 *   (ou Espaço). Com "Estou de fone" ligado não há eco, então o microfone
 *   continua aberto e dá para interromper falando por cima, como no ChatGPT.
 * - Enquanto o aluno fala, a Mine solta um "uhum" numa pausa longa; assim que
 *   ele termina, toca um "hum…" pronto, e a resposta é falada frase por frase
 *   enquanto ainda chega (`criarFalaEmFluxo`). As legendas mostram a frase que
 *   está tocando, não o texto que ainda nem foi falado.
 */

type Reconhecimento = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onstart?: (() => void) | null;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
};

type Fase = "comecando" | "ouvindo" | "pensando" | "falando" | "mudo";

function classeDoReconhecimento() {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Reconhecimento; webkitSpeechRecognition?: new () => Reconhecimento };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}
function criarReconhecimento(): Reconhecimento | null {
  const Classe = classeDoReconhecimento();
  return Classe ? new Classe() : null;
}

/* Clipes curtos da voz da chamada. Ficam prontos em /voz-chamada/ (tocam na
 * hora e não gastam a cota); sem o arquivo, são gerados uma vez pela API. */
const CLIPES = {
  oi: { arquivo: "oi", texto: "Oi! Tô te ouvindo. Pode perguntar o que quiser." },
  escuta: [
    { arquivo: "uhum", texto: "Uhum." },
    { arquivo: "aham", texto: "Aham." },
  ],
  pensando: [
    { arquivo: "hum", texto: "Hum…" },
    { arquivo: "entendi", texto: "Entendi." },
    { arquivo: "deixa-eu-ver", texto: "Deixa eu ver…" },
    { arquivo: "ta", texto: "Tá." },
  ],
};
type Clipe = { arquivo: string; texto: string };

const clipesProntos = new Map<string, Promise<string | null>>();
function urlDoClipe(clipe: Clipe) {
  let pronto = clipesProntos.get(clipe.arquivo);
  if (!pronto) {
    pronto = (async () => {
      try {
        const resposta = await fetch(`/voz-chamada/${clipe.arquivo}.mp3`);
        if (resposta.ok && (resposta.headers.get("content-type") || "").startsWith("audio/")) return URL.createObjectURL(await resposta.blob());
      } catch {
        // sem o arquivo pronto: gera pela API
      }
      return baixarFalaDaChamada(clipe.texto);
    })();
    clipesProntos.set(clipe.arquivo, pronto);
  }
  return pronto;
}
const sortear = <T,>(lista: T[]) => lista[Math.floor(Math.random() * lista.length)];

const palavras = (texto: string) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 1);

/** Ponto onde termina a última frase completa (seguida de espaço). */
function fimDaUltimaFrase(texto: string) {
  let fim = -1;
  const re = /[.!?…:](?=\s)/g;
  for (let m = re.exec(texto); m; m = re.exec(texto)) fim = m.index + 1;
  return fim;
}

/** Começo da resposta: se a primeira frase for longa, corta na primeira
 * vírgula. A voz demora mais quanto maior o pedaço (~1 s numa frase curta,
 * 2–3 s numa longa), e o modelo nem sempre abre com a frase curta pedida. */
function primeiroCorte(texto: string) {
  const primeiraFrase = /[.!?…:](?=\s)/.exec(texto);
  const fim = primeiraFrase ? primeiraFrase.index + 1 : -1;
  const ate = fim > 0 ? fim : texto.length;
  if (ate <= 70) return fim;
  const virgula = /,\s/g;
  for (let m = virgula.exec(texto); m && m.index < Math.min(ate, 90); m = virgula.exec(texto)) {
    if (m.index >= 18) return m.index + 1;
  }
  return fim;
}

/** O texto ouvido é a própria Mine (eco)? Quase todas as palavras estão na fala dela. */
function pareceEco(ouvido: string, falaDaMine: string) {
  const dela = new Set(palavras(falaDaMine));
  const minhas = palavras(ouvido);
  if (!minhas.length || !dela.size) return false;
  const iguais = minhas.filter((p) => dela.has(p)).length;
  return iguais / minhas.length >= 0.7;
}

/* Sons curtos de entrar e sair (gerados na hora, sem arquivo nem cota). */
function bipe(tipo: "entra" | "sai") {
  const ctx = contextoDeAudio();
  if (!ctx || ctx.state !== "running") return;
  const agora = ctx.currentTime;
  const notas = tipo === "entra" ? [660, 880] : [700, 520];
  notas.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = agora + i * 0.09;
    ganho.gain.setValueAtTime(0.0001, t);
    ganho.gain.exponentialRampToValueAtTime(0.07, t + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(ganho).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  });
}

const CHAVE_FONE = "minerva-voz-fone";
const ehCelular = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export function MineChamada({
  loading,
  textoAoVivo,
  ultimaResposta,
  enviar,
  parar,
  onFechar,
}: {
  loading: boolean;
  /** A resposta enquanto chega (streaming). */
  textoAoVivo: string;
  ultimaResposta: { id: string; text: string } | null;
  enviar: (texto: string) => void;
  /** Interrompe a resposta que está chegando. */
  parar: () => void;
  onFechar: () => void;
}) {
  const [fase, setFase] = useState<Fase>("comecando");
  const [ouvido, setOuvido] = useState("");
  const [legendas, setLegendas] = useState(false);
  const [digitado, setDigitado] = useState("");
  const [teclado, setTeclado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [micAtivo, setMicAtivo] = useState(false);
  const [falaAtual, setFalaAtual] = useState("");
  const [respostas, setRespostas] = useState(0);
  const [saindo, setSaindo] = useState(false);
  const [fone, setFone] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_FONE) === "1";
    } catch {
      return false;
    }
  });
  const [microfone] = useState(() => Boolean(classeDoReconhecimento()));

  const aberta = useRef(true);
  const faseRef = useRef<Fase>("comecando");
  const mudo = useRef(false);
  const foneRef = useRef(fone);
  foneRef.current = fone;
  const reconhecimento = useRef<Reconhecimento | null>(null);
  const base = useRef(0); // resultados já usados nesta sessão do reconhecimento
  const silencio = useRef<number | null>(null);
  const uhumTimer = useRef<number | null>(null);
  const ultimoUhum = useRef(0);
  const palavrasDesdeUhum = useRef(0);

  // Medidor do microfone (só para a bola reagir; o texto vem do reconhecimento)
  const micStream = useRef<MediaStream | null>(null);
  const micAnalisador = useRef<AnalyserNode | null>(null);
  const pulso = useRef(0);

  // Resposta em andamento
  const fluxo = useRef<FalaEmFluxo | null>(null);
  const esperando = useRef(false);
  const viuCarregar = useRef(false);
  const falado = useRef(""); // prefixo da resposta ao vivo que já entrou na fila
  const falaDaMine = useRef(""); // tudo o que a Mine está dizendo (para o filtro de eco)
  const idAntes = useRef<string | undefined>(ultimaResposta?.id);
  const pendente = useRef("");
  const ultimaFalaAluno = useRef(""); // o resto dela ainda chega depois do envio: não é interrupção
  const nivel = useRef<HTMLButtonElement | null>(null);
  const falhasSeguidas = useRef(0);
  const retomada = useRef<number | null>(null);

  const mudarFase = (nova: Fase) => {
    faseRef.current = nova;
    setFase(nova);
  };

  const limparTimers = () => {
    if (silencio.current) window.clearTimeout(silencio.current);
    if (uhumTimer.current) window.clearTimeout(uhumTimer.current);
    silencio.current = null;
    uhumTimer.current = null;
  };

  const novaFala = () =>
    criarFalaEmFluxo({
      chamada: true,
      aoComecar: (texto) => {
        if (aberta.current) setFalaAtual((atual) => (atual ? `${atual} ${texto}` : texto));
      },
    });

  const voltarAOuvir = useCallback(() => {
    if (!aberta.current) return;
    falaDaMine.current = "";
    setOuvido("");
    mudarFase(mudo.current ? "mudo" : microfone ? "ouvindo" : "mudo");
    // O microfone só volta depois que a caixa de som silencia, senão ele
    // pega o fim da fala da Mine e ela responde a ela mesma. De fone, já está ligado.
    window.setTimeout(() => {
      if (faseRef.current === "ouvindo") ligarRef.current();
    }, foneRef.current ? 0 : 700);
  }, [microfone]);

  // ---- enviar a fala do aluno -------------------------------------------
  const disparar = useCallback(
    (texto: string) => {
      if (!foneRef.current) desligarMicRef.current();
      idAntes.current = ultimaResposta?.id;
      esperando.current = true;
      viuCarregar.current = false;
      falado.current = "";
      falaDaMine.current = "";
      setFalaAtual("");
      const meu = novaFala();
      fluxo.current = meu;
      // "Hum…" logo depois que ele termina, se a resposta ainda não começou.
      window.setTimeout(() => {
        if (fluxo.current !== meu || falado.current) return;
        void urlDoClipe(sortear(CLIPES.pensando)).then((url) => {
          if (url && fluxo.current === meu && !falado.current) meu.adicionarClipe(url);
        });
      }, 350);
      void meu.terminou.then((terminou) => {
        if (fluxo.current !== meu) return;
        fluxo.current = null;
        if (terminou) {
          setRespostas((n) => n + 1);
          voltarAOuvir();
        }
      });
      enviar(texto);
    },
    [enviar, ultimaResposta?.id, voltarAOuvir], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const mandar = useCallback(
    (texto: string) => {
      const limpo = texto.trim();
      if (!limpo || !aberta.current) return;
      limparTimers();
      ultimaFalaAluno.current = limpo;
      setOuvido(limpo);
      mudarFase("pensando");
      if (loading) {
        // Interrompeu a Mine no meio da resposta: corta e manda quando ela parar.
        pendente.current = limpo;
        parar();
        return;
      }
      disparar(limpo);
    },
    [loading, parar, disparar],
  );
  const mandarRef = useRef(mandar);
  mandarRef.current = mandar;

  const interromperMine = () => {
    pararDeFalar();
    fluxo.current = null;
    esperando.current = false;
    if (loading) parar();
    falaDaMine.current = "";
    setOuvido("");
    setFalaAtual("");
    setRespostas((n) => n + 1);
    mudarFase(mudo.current || !microfone ? "mudo" : "ouvindo");
    window.setTimeout(() => {
      if (faseRef.current === "ouvindo") ligarRef.current();
    }, 250);
  };
  const interromperRef = useRef(interromperMine);
  interromperRef.current = interromperMine;

  // ---- microfone ----------------------------------------------------------
  const ligarMicrofone = useCallback(() => {
    if (!aberta.current || mudo.current || reconhecimento.current) return;
    // Sem fone, o microfone só abre ouvindo: com a Mine falando ele pegaria a voz dela.
    if (faseRef.current !== "ouvindo" && !(foneRef.current && faseRef.current !== "mudo")) return;
    const r = criarReconhecimento();
    if (!r) return;
    r.lang = "pt-BR";
    r.continuous = true;
    r.interimResults = true;
    base.current = 0;
    r.onstart = () => {
      if (reconhecimento.current === r) setMicAtivo(true);
    };
    r.onresult = (event) => {
      let final = "";
      let parcial = "";
      for (let i = base.current; i < event.results.length; i += 1) {
        const resultado = event.results[i];
        if (resultado.isFinal) final += resultado[0].transcript;
        else parcial += resultado[0].transcript;
      }
      // Os "uhum" da própria Mine podem entrar pelo microfone: saem do texto.
      const texto = `${final} ${parcial}`.replace(/(uhum|aham|hum+)[.,!…]*/gi, " ").replace(/\s+/g, " ").trim();
      if (!texto) return;
      const total = event.results.length;
      falhasSeguidas.current = 0;
      pulso.current = Math.max(pulso.current, 0.5); // a bola pulsa mesmo sem medidor do microfone

      // De fone: falar por cima interrompe a Mine (como no ChatGPT).
      if (faseRef.current === "falando" || faseRef.current === "pensando") {
        if (!foneRef.current) return;
        const fala = palavras(texto);
        const resto = palavras(ultimaFalaAluno.current).join(" ");
        if (fala.length < 2 || resto.endsWith(fala.join(" ")) || pareceEco(texto, falaDaMine.current)) return;
        interromperRef.current();
      }
      if (faseRef.current !== "ouvindo") return;

      setOuvido(texto);
      limparTimers();
      // Fim da fala: silêncio curto depois de um trecho final.
      silencio.current = window.setTimeout(() => {
        if (reconhecimento.current === r) base.current = total;
        mandarRef.current(texto);
      }, parcial ? 1300 : 750);
      // "Uhum" numa pausa no meio de uma fala comprida.
      const novas = palavras(texto).length;
      if (novas - palavrasDesdeUhum.current >= 12 && Date.now() - ultimoUhum.current > 7000) {
        uhumTimer.current = window.setTimeout(() => {
          ultimoUhum.current = Date.now();
          palavrasDesdeUhum.current = novas;
          void urlDoClipe(sortear(CLIPES.escuta)).then((url) => {
            if (url && faseRef.current === "ouvindo") void tocarSolto(url, 0.6);
          });
        }, 450);
      }
    };
    r.onerror = (event) => {
      const erro = event?.error || "";
      if (erro === "no-speech" || erro === "aborted") return;
      const mensagem =
        erro === "not-allowed" || erro === "service-not-allowed"
          ? "O navegador não liberou o microfone. Libere no cadeado da barra de endereço ou escreva abaixo."
          : erro === "audio-capture"
            ? "Não achei um microfone funcionando. Veja se ele está ligado e escolhido no Windows, ou escreva abaixo."
            : erro === "network"
              ? "O reconhecimento de voz deste navegador não está respondendo (no Brave e em alguns navegadores ele não funciona). Use o Chrome ou o Edge, ou escreva abaixo."
              : `O reconhecimento de voz falhou (${erro || "erro desconhecido"}). Escreva abaixo ou tente de novo.`;
      setAviso(mensagem);
      if (erro === "not-allowed" || erro === "service-not-allowed" || erro === "audio-capture") {
        mudo.current = true;
        mudarFase("mudo");
      }
    };
    r.onend = () => {
      // O navegador encerra a escuta contínua de tempos em tempos: religa.
      // Se ela cai sem ouvir nada várias vezes seguidas, para e avisa.
      reconhecimento.current = null;
      setMicAtivo(false);
      palavrasDesdeUhum.current = 0;
      // Só conta como falha quando cai logo depois de ligar (erro, microfone ocupado);
      // o fim normal depois de um tempo em silêncio não conta.
      falhasSeguidas.current = Date.now() - ligadoEm < 1500 ? falhasSeguidas.current + 1 : 0;
      if (falhasSeguidas.current > 8) {
        setAviso((atual) => atual || "O microfone parou de ouvir. Toque em Tentar de novo ou escreva abaixo.");
        mudo.current = true;
        mudarFase("mudo");
        return;
      }
      if (aberta.current && !mudo.current) {
        retomada.current = window.setTimeout(() => {
          retomada.current = null;
          ligarRef.current(); // revalida a fase lá dentro
        }, 150);
      }
    };
    reconhecimento.current = r;
    const ligadoEm = Date.now();
    try {
      r.start();
    } catch {
      reconhecimento.current = null;
    }
  }, []);

  const ligarRef = useRef(ligarMicrofone);
  ligarRef.current = ligarMicrofone;

  const desligarMicrofone = () => {
    if (retomada.current) window.clearTimeout(retomada.current);
    retomada.current = null;
    const r = reconhecimento.current;
    reconhecimento.current = null;
    setMicAtivo(false);
    limparTimers();
    if (!r) return;
    r.onend = null;
    r.onresult = null;
    r.onerror = null;
    r.onstart = null;
    try {
      r.abort ? r.abort() : r.stop();
    } catch {
      // já parado
    }
  };

  const desligarMicRef = useRef(desligarMicrofone);
  desligarMicRef.current = desligarMicrofone;

  /** Medidor de volume do microfone, só no computador: no celular, abrir o
   * microfone duas vezes pode derrubar o reconhecimento de voz. */
  const ligarMedidorDoMicrofone = async () => {
    if (ehCelular() || micStream.current || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const ctx = contextoDeAudio();
      if (!aberta.current || !ctx) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const analisador = ctx.createAnalyser();
      analisador.fftSize = 512;
      analisador.smoothingTimeConstant = 0.5;
      const silenciador = ctx.createGain();
      silenciador.gain.value = 0;
      ctx.createMediaStreamSource(stream).connect(analisador).connect(silenciador).connect(ctx.destination);
      stream.getTracks().forEach((t) => (t.enabled = !mudo.current));
      micStream.current = stream;
      micAnalisador.current = analisador;
    } catch {
      // sem medidor: a bola pulsa a cada pedaço reconhecido
    }
  };

  // ---- começo e fim da chamada ------------------------------------------
  useEffect(() => {
    aberta.current = true;
    ligarMedidorDeSaida();
    bipe("entra");
    void ligarMedidorDoMicrofone();
    for (const clipe of [...CLIPES.escuta, ...CLIPES.pensando]) void urlDoClipe(clipe);
    void (async () => {
      const url = await urlDoClipe(CLIPES.oi);
      if (!aberta.current) return;
      mudarFase("falando");
      falaDaMine.current = CLIPES.oi.texto;
      const meu = novaFala();
      fluxo.current = meu;
      if (url) meu.adicionarClipe(url);
      else meu.adicionar(CLIPES.oi.texto);
      meu.fechar();
      if (foneRef.current) ligarRef.current();
      await meu.terminou;
      if (fluxo.current === meu) fluxo.current = null;
      if (faseRef.current === "falando") voltarAOuvir();
    })();
    const tecla = (event: KeyboardEvent) => {
      if (event.key === "Escape") desligarRef.current();
      if (event.key === " " && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        if (faseRef.current === "falando" || faseRef.current === "pensando") interromperRef.current();
        else alternarMudoRef.current();
      }
    };
    window.addEventListener("keydown", tecla);
    return () => {
      aberta.current = false;
      window.removeEventListener("keydown", tecla);
      desligarMicrofone();
      pararDeFalar();
      desligarMedidorDeSaida();
      micStream.current?.getTracks().forEach((t) => t.stop());
      micStream.current = null;
      micAnalisador.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- a bola acompanha o volume ----------------------------------------
  useEffect(() => {
    const quieto = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const amostras = new Uint8Array(512);
    let suave = 0;
    let quadro = 0;
    const medir = (analisador: AnalyserNode | null) => {
      if (!analisador) return 0;
      analisador.getByteTimeDomainData(amostras);
      let soma = 0;
      for (let i = 0; i < amostras.length; i += 1) {
        const v = (amostras[i] - 128) / 128;
        soma += v * v;
      }
      return Math.min(1, Math.sqrt(soma / amostras.length) * 5);
    };
    const passo = () => {
      quadro = window.requestAnimationFrame(passo);
      const bola = nivel.current;
      if (!bola) return;
      const f = faseRef.current;
      const saida = f === "falando" ? medidorDeSaida() : null;
      let alvo = saida ? medir(saida) : f === "ouvindo" && !mudo.current ? medir(micAnalisador.current) : 0;
      // Sem medidor (voz do navegador, áudio sem AudioContext): pulso no ritmo da fala.
      if (f === "falando" && !saida) alvo = 0.22 + 0.18 * Math.sin(performance.now() / 140);
      alvo = Math.max(alvo, pulso.current);
      pulso.current *= 0.9;
      suave += (alvo - suave) * (alvo > suave ? 0.3 : 0.07);
      bola.style.setProperty("--nivel", quieto ? "0" : suave.toFixed(3));
    };
    quadro = window.requestAnimationFrame(passo);
    return () => window.cancelAnimationFrame(quadro);
  }, []);

  // ---- nuvens mais rápidas pensando e falando ----------------------------
  useEffect(() => {
    const bola = nivel.current;
    if (!bola?.getAnimations) return;
    const vel = fase === "pensando" ? 2.6 : fase === "falando" ? 1.7 : 1;
    for (const animacao of bola.getAnimations({ subtree: true })) animacao.updatePlaybackRate(vel);
  }, [fase]);

  // ---- resposta chegando: fala frase por frase --------------------------
  useEffect(() => {
    if (loading && esperando.current) viuCarregar.current = true;
    const meu = fluxo.current;
    if (!meu || !esperando.current || !loading || !textoAoVivo) return;
    if (!textoAoVivo.startsWith(falado.current)) return;
    const fim = falado.current ? fimDaUltimaFrase(textoAoVivo) : primeiroCorte(textoAoVivo);
    if (fim <= falado.current.length) return;
    const novo = textoAoVivo.slice(falado.current.length, fim);
    falado.current = textoAoVivo.slice(0, fim);
    falaDaMine.current += ` ${novo}`;
    meu.adicionar(novo);
    if (faseRef.current === "pensando") mudarFase("falando");
  }, [textoAoVivo, loading]);

  // ---- resposta terminou ------------------------------------------------
  useEffect(() => {
    if (loading) return;
    if (pendente.current) {
      const texto = pendente.current;
      pendente.current = "";
      disparar(texto);
      return;
    }
    if (!esperando.current || !viuCarregar.current) return;
    esperando.current = false;
    const meu = fluxo.current;
    if (!meu) return;
    const nova = ultimaResposta && ultimaResposta.id !== idAntes.current ? ultimaResposta.text : "";
    idAntes.current = ultimaResposta?.id;
    const resto = nova.startsWith(falado.current) ? nova.slice(falado.current.length) : falado.current ? "" : nova;
    if (resto.trim()) {
      falaDaMine.current += ` ${resto}`;
      meu.adicionar(resto);
      if (faseRef.current === "pensando") mudarFase("falando");
    }
    meu.fechar();
    if (!nova && !falado.current) voltarAOuvir();
  }, [loading, ultimaResposta, disparar, voltarAOuvir]);

  const alternarMudo = () => {
    if (mudo.current) {
      mudo.current = false;
      falhasSeguidas.current = 0;
      setAviso("");
      micStream.current?.getTracks().forEach((t) => (t.enabled = true));
      if (faseRef.current === "mudo") mudarFase("ouvindo");
      // Sem fone e com a Mine falando, o microfone volta sozinho quando ela terminar.
      ligarMicrofone();
    } else {
      mudo.current = true;
      desligarMicrofone();
      micStream.current?.getTracks().forEach((t) => (t.enabled = false));
      if (faseRef.current === "ouvindo") mudarFase("mudo");
    }
  };
  const alternarMudoRef = useRef(alternarMudo);
  alternarMudoRef.current = alternarMudo;

  const alternarFone = () => {
    const novo = !fone;
    setFone(novo);
    foneRef.current = novo;
    try {
      localStorage.setItem(CHAVE_FONE, novo ? "1" : "0");
    } catch {
      // sem armazenamento: vale só nesta chamada
    }
    if (novo && faseRef.current !== "mudo") ligarMicrofone();
    if (!novo && faseRef.current !== "ouvindo") desligarMicrofone();
  };

  const desligar = () => {
    if (!aberta.current) return;
    aberta.current = false;
    desligarMicrofone();
    pararDeFalar();
    bipe("sai");
    setSaindo(true);
    window.setTimeout(onFechar, 180);
  };
  const desligarRef = useRef(desligar);
  desligarRef.current = desligar;

  const semMicrofone = !microfone || Boolean(aviso);
  const podeInterromper = fase === "falando" || fase === "pensando";

  // Para leitores de tela, o estado completo; na tela, só uma dica curta.
  const status =
    fase === "ouvindo"
      ? "Ouvindo"
      : fase === "pensando"
        ? "Pensando"
        : fase === "falando"
          ? "A Mine está falando"
          : fase === "comecando"
            ? "Conectando"
            : semMicrofone
              ? "Escreva para a Mine; ela responde falando"
              : "Microfone desligado";
  const dica =
    fase === "comecando"
      ? "Conectando…"
      : fase === "ouvindo"
        ? ouvido
          ? ""
          : micAtivo
            ? "Pode falar"
            : ""
        : fase === "falando" && respostas < 2
          ? fone
            ? "Fale ou toque para interromper"
            : "Toque para interromper"
          : fase === "mudo"
            ? aviso
              ? ""
              : semMicrofone
                ? "Escreva; a Mine responde falando"
                : "Microfone desligado"
            : "";

  const legendaMine = falaAtual.replace(/\s+/g, " ").trim();

  return (
    <section
      className={`mch is-${fase}${semMicrofone ? " sem-microfone" : ""}${legendas ? " com-legendas" : ""}${saindo ? " is-saindo" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Aula por voz com a Mine"
    >
      <header className="mch-topo">
        <div className="mch-titulo">
          <strong>Mine</strong>
          <span>Aula por voz</span>
        </div>
        <div className="mch-topo-botoes">
          {microfone && !aviso ? (
            <button type="button" className={`mch-chip${fone ? " is-on" : ""}`} onClick={alternarFone} aria-pressed={fone} title="De fone, dá para interromper a Mine falando por cima">
              <Headphones aria-hidden />
              <span className="mch-chip-longo">Estou de fone</span>
              <span className="mch-chip-curto">Fone</span>
            </button>
          ) : null}
          <button type="button" className={`mch-icone${legendas ? " is-on" : ""}`} onClick={() => setLegendas((v) => !v)} aria-pressed={legendas} title={legendas ? "Esconder legendas" : "Mostrar legendas"}>
            <Captions aria-hidden />
          </button>
        </div>
      </header>

      <div className="mch-palco">
        <div className="mch-orbe">
          <button
            type="button"
            className="mch-bola"
            ref={nivel}
            onClick={() => (podeInterromper ? interromperMine() : undefined)}
            aria-label={podeInterromper ? "Interromper a Mine e falar" : "Mine"}
            tabIndex={podeInterromper ? 0 : -1}
          >
            <span className="mch-ceu" />
            <span className="mch-nuvem mch-nuvem-a" />
            <span className="mch-nuvem mch-nuvem-b" />
            <span className="mch-nuvem mch-nuvem-c" />
            <span className="mch-nuvem mch-nuvem-d" />
            <span className="mch-brilho" />
          </button>
        </div>
        <p className="sr-only" aria-live="polite">
          {status}
        </p>
        <p className={`mch-dica${dica ? "" : " is-vazia"}`} aria-hidden>
          {dica || " "}
        </p>
        {!legendas && fase === "ouvindo" && ouvido ? <p className="mch-ouvindo">{ouvido}</p> : null}
        {legendas ? (
          <div className="mch-legendas" aria-live="off">
            {ouvido && fase !== "falando" ? <p className="mch-voce">{ouvido}</p> : null}
            {legendaMine && fase !== "ouvindo" ? <p className="mch-mine">{legendaMine.length > 240 ? `…${legendaMine.slice(-240).replace(/^\S*\s/, "")}` : legendaMine}</p> : null}
            {!ouvido && !legendaMine ? <p className="mch-voce">As legendas aparecem aqui.</p> : null}
          </div>
        ) : null}
      </div>

      {aviso ? (
        <div className="mch-aviso" role="alert">
          <p>{aviso}</p>
          {microfone ? (
            <button type="button" onClick={alternarMudo}>
              Tentar de novo
            </button>
          ) : null}
        </div>
      ) : null}

      {semMicrofone || teclado ? (
        <form
          className="mch-texto"
          onSubmit={(event) => {
            event.preventDefault();
            mandar(digitado);
            setDigitado("");
          }}
        >
          <input id="mch-texto" value={digitado} onChange={(event) => setDigitado(event.target.value)} placeholder="Escreva sua pergunta…" aria-label="Escrever para a Mine" autoFocus={teclado} />
          <button type="submit" disabled={!digitado.trim()} aria-label="Enviar">
            <Send aria-hidden />
          </button>
        </form>
      ) : null}

      <div className="mch-botoes">
        {microfone ? (
          <button
            type="button"
            className={`mch-btn${fase === "mudo" ? " is-off" : ""}`}
            onClick={alternarMudo}
            aria-pressed={fase === "mudo"}
            aria-label={fase === "mudo" ? "Ligar o microfone" : "Desligar o microfone"}
            title={fase === "mudo" ? "Ligar o microfone (Espaço)" : "Desligar o microfone (Espaço)"}
          >
            {fase === "mudo" ? <MicOff aria-hidden /> : <Mic aria-hidden />}
          </button>
        ) : null}
        {microfone && !aviso ? (
          <button type="button" className={`mch-btn${teclado ? " is-on" : ""}`} onClick={() => setTeclado((v) => !v)} aria-pressed={teclado} aria-label="Escrever em vez de falar" title="Escrever em vez de falar">
            <Keyboard aria-hidden />
          </button>
        ) : null}
        <button type="button" className="mch-btn is-desligar" onClick={desligar} aria-label="Encerrar a aula por voz" title="Encerrar (Esc)">
          <X aria-hidden />
        </button>
      </div>
    </section>
  );
}
