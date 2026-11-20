import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ExternalLink, Globe, Lock, MousePointer2, Play, RotateCw, Search, X } from "lucide-react";
import type { MineSearchStatus, MineSource } from "./MineSources";
import "./mine-controle.css";

/**
 * Controle Mine (nov/2026): o estudante liga no "+" do chat e assiste a Mine
 * navegar — pesquisa, clica nos resultados, abre a página (com print) e
 * "assiste" vídeos pela legenda. Quem abre as páginas é o servidor
 * (mine/router.mjs, openControlLinks); aqui é a janela que mostra isso, com o
 * cursor da Mine indo até cada link e clicando.
 *
 * As páginas aparecem de verdade (/api/mine-pagina devolve o HTML sem
 * scripts e ele abre num iframe sandbox): a Mine rola até os trechos que leu e
 * grifa. Vídeo abre no player do YouTube e pula para os minutos que ela cita.
 * O print (thum.io/Microlink) ficou para o cartão e para quando a página não abre.
 */

export type MineVisit = {
  url: string;
  title?: string;
  domain?: string;
  kind: "page" | "video";
  ok: boolean;
  note?: string;
  /** Trechos que a Mine leu; o painel rola até eles e grifa. */
  highlights?: string[];
  /** Duração do vídeo, para o cursor achar o ponto na barra. */
  seconds?: number;
};

export function cleanVisits(value: unknown): MineVisit[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is MineVisit => Boolean(item) && typeof item.url === "string" && /^https?:\/\//i.test(item.url))
    .map((item): MineVisit => ({
      url: item.url,
      title: typeof item.title === "string" ? item.title.slice(0, 160) : "",
      domain: typeof item.domain === "string" ? item.domain : hostOf(item.url),
      kind: item.kind === "video" ? "video" : "page",
      ok: item.ok === true,
      note: typeof item.note === "string" ? item.note.slice(0, 80) : undefined,
      highlights: Array.isArray(item.highlights) ? item.highlights.filter((text): text is string => typeof text === "string").slice(0, 3).map((text) => text.slice(0, 200)) : undefined,
      seconds: typeof item.seconds === "number" && item.seconds > 0 ? item.seconds : undefined,
    }))
    .slice(0, 8);
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Endereço como a pessoa leria (Fotoss%C3%ADntese → Fotossíntese). */
function readableUrl(url: string) {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
}

function youtubeIdOf(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return parsed.pathname.slice(1, 12);
    if (parsed.pathname === "/watch") return parsed.searchParams.get("v") || "";
    return parsed.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1] || "";
  } catch {
    return "";
  }
}

/**
 * Serviços de print, na ordem: thum.io devolve o PNG direto (rápido); o
 * Microlink (50 por dia por IP, contado no aparelho do estudante) é a reserva.
 * O mShots do WordPress foi testado e descartado: 403 ou "gerando" para sempre.
 */
function shotUrls(url: string) {
  return [
    `https://image.thum.io/get/width/1024/crop/640/noanimate/${url}`,
    `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`,
  ];
}

/** Print da página; se um serviço falhar, tenta o próximo. */
export function SitePrint({ visit, className = "" }: { visit: MineVisit; className?: string }) {
  const videoId = visit.kind === "video" ? youtubeIdOf(visit.url) : "";
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const sources = shotUrls(visit.url);
  const failed = attempt >= sources.length;

  if (videoId) {
    return (
      <span className={`mine-print mine-print--video ${className}`}>
        <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" loading="lazy" referrerPolicy="no-referrer" onLoad={() => setReady(true)} />
        <span className="mine-print__play" aria-hidden><Play className="h-4 w-4" /></span>
      </span>
    );
  }
  // Página que o servidor não conseguiu abrir: sem print (seria a tela de erro).
  if (failed || (!visit.ok && visit.note)) {
    return (
      <span className={`mine-print mine-print--empty ${className}`}>
        <Globe className="h-5 w-5" aria-hidden />
        <span>{visit.domain || hostOf(visit.url)}</span>
      </span>
    );
  }
  return (
    <span className={`mine-print ${ready ? "is-ready" : ""} ${className}`}>
      <img
        key={attempt}
        src={sources[attempt]}
        alt={`Print de ${visit.domain || hostOf(visit.url)}`}
        referrerPolicy="no-referrer"
        onLoad={(event) => {
          // Imagem minúscula = aviso do serviço, não um print.
          if (event.currentTarget.naturalWidth >= 300) setReady(true);
          else setAttempt((value) => value + 1);
        }}
        onError={() => setAttempt((value) => value + 1)}
      />
      {!ready ? <span className="mine-print__wait">tirando print…</span> : null}
    </span>
  );
}

/** Cursor da Mine: seta menta com a etiqueta "Mine"; `clicking` faz o anel. */
function MineCursor({ x, y, clicking }: { x: number; y: number; clicking: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className="mine-cursor"
      aria-hidden
      initial={false}
      animate={{ left: `${x}%`, top: `${y}%` }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 70, damping: 16, mass: 0.9 }}
    >
      {clicking ? <span key={`${x}-${y}`} className="mine-cursor__ring" /> : null}
      <MousePointer2 className={`mine-cursor__arrow ${clicking ? "is-clicking" : ""}`} />
      <span className="mine-cursor__tag">Mine</span>
    </motion.span>
  );
}

type Point = { x: number; y: number };
type PanelPage = { html: string; title?: string; url?: string };

/**
 * Página de verdade para o painel, buscada pelo servidor (/api/mine-pagina,
 * já sem scripts). Fica em cache por endereço: o painel começa a buscar
 * assim que a visita chega, antes de a cena dela aparecer.
 */
const pageCache = new Map<string, Promise<PanelPage | null>>();

function sessionToken() {
  try {
    return (JSON.parse(localStorage.getItem("minerva-session-v1") || "{}") as { token?: string }).token || "";
  } catch {
    return "";
  }
}

function loadPanelPage(url: string) {
  const cached = pageCache.get(url);
  if (cached) return cached;
  const job = fetch("/api/mine-pagina", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${sessionToken()}` },
    body: JSON.stringify({ url }),
  })
    .then((response) => (response.ok ? (response.json() as Promise<PanelPage>) : null))
    .then((page) => (page && typeof page.html === "string" && page.html.length > 200 ? page : null))
    .catch(() => null);
  pageCache.set(url, job);
  if (pageCache.size > 24) pageCache.delete(pageCache.keys().next().value as string);
  return job;
}

/** Largura "de computador" em que a página é desenhada antes de encolher. */
const PAGE_WIDTH = 960;
const squash = (text: string) => text.replace(/\s+/g, "").toLocaleLowerCase("pt-BR");

/** O bloco da página que contém o trecho (o menor que contém). */
function findPassage(doc: Document, passage: string) {
  const needle = squash(passage).slice(0, 48);
  if (needle.length < 16) return null;
  const pick = (selector: string) => {
    let best: HTMLElement | null = null;
    let bestLength = Infinity;
    const nodes = Array.from(doc.body?.querySelectorAll<HTMLElement>(selector) || []).slice(0, 5000);
    for (const node of nodes) {
      const text = node.textContent || "";
      if (text.length >= bestLength || text.length < needle.length) continue;
      if (squash(text).includes(needle)) {
        best = node;
        bestLength = text.length;
      }
    }
    return best;
  };
  return pick("p,li,h1,h2,h3,h4,h5,h6,td,th,blockquote,dd,dt,pre,figcaption") || pick("div,section,article,span");
}

/** Marca-texto: o conteúdo do bloco vai para um span que pinta linha a linha. */
function markPassage(doc: Document, element: HTMLElement, instant: boolean) {
  if (element.querySelector(".mine-grifo")) return;
  const mark = doc.createElement("span");
  mark.className = "mine-grifo";
  while (element.firstChild) mark.appendChild(element.firstChild);
  element.appendChild(mark);
  // Força o layout antes de ligar: a transição do grifo roda mesmo sem rAF
  // (aba em segundo plano).
  if (!instant) void mark.offsetWidth;
  mark.classList.add("is-on");
}

/**
 * A página aberta de verdade, dentro de um iframe `sandbox` sem scripts. A
 * Mine rola até cada trecho que leu, aponta com o cursor e grifa. Sem a
 * página (site bloqueou, login), cai no print.
 */
function LivePage({
  visit,
  reduce,
  onCursor,
  onDone,
}: {
  visit: MineVisit;
  reduce: boolean;
  onCursor: (point: Point, clicking?: boolean) => void;
  onDone: () => void;
}) {
  const [page, setPage] = useState<PanelPage | null | "loading">("loading");
  const [scale, setScale] = useState(0.5);
  const [loaded, setLoaded] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const callbacks = useRef({ onCursor, onDone });
  callbacks.current = { onCursor, onDone };
  // A lista de visitas é refeita a cada evento; a chave evita recomeçar a leitura.
  const highlightKey = (visit.highlights || []).join("\n");

  useEffect(() => {
    let alive = true;
    // Ainda abrindo no servidor: espera. Falhou: print.
    if (!visit.ok) {
      setPage(visit.note ? null : "loading");
      return;
    }
    loadPanelPage(visit.url).then((value) => alive && setPage(value));
    return () => {
      alive = false;
    };
  }, [visit.url, visit.ok]);

  // A página é desenhada a 960 px e encolhida para caber na janela.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const update = () => setScale(Math.max(0.25, box.clientWidth / PAGE_WIDTH));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // Sem página: o print fica ~2,6 s e a cena acaba.
  useEffect(() => {
    if (page !== null) return;
    callbacks.current.onCursor({ x: 78, y: 72 });
    const id = window.setTimeout(() => callbacks.current.onDone(), reduce ? 300 : 2600);
    return () => window.clearTimeout(id);
  }, [page, reduce]);

  // Página carregada: rola até cada trecho, aponta e grifa, um por vez.
  useEffect(() => {
    if (!loaded) return;
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    const win = frame?.contentWindow;
    if (!frame || !doc || !win) {
      callbacks.current.onDone();
      return;
    }
    const timers: number[] = [];
    const later = (ms: number, run: () => void) => timers.push(window.setTimeout(run, reduce ? 0 : ms));
    const passages = (highlightKey ? highlightKey.split("\n") : []).map((text) => findPassage(doc, text)).filter((node): node is HTMLElement => Boolean(node));
    const viewHeight = () => win.innerHeight || frame.clientHeight / scale;
    const pointAt = (element: HTMLElement): Point => {
      const rect = element.getBoundingClientRect();
      return {
        x: Math.min(92, Math.max(4, ((rect.left + Math.min(rect.width * 0.12, 48)) / PAGE_WIDTH) * 100)),
        y: Math.min(90, Math.max(6, ((rect.top + Math.min(rect.height / 2, 16)) / viewHeight()) * 100)),
      };
    };
    let at = 500;
    if (!passages.length) {
      // Nada achado: a Mine desce lendo a página.
      later(at, () => {
        win.scrollTo({ top: viewHeight() * 0.9, behavior: (reduce ? "instant" : "smooth") as ScrollBehavior });
        callbacks.current.onCursor({ x: 70, y: 62 });
      });
      later(at + 2200, () => callbacks.current.onDone());
    } else {
      passages.forEach((element) => {
        later(at, () => {
          const top = element.getBoundingClientRect().top + win.scrollY - viewHeight() * 0.3;
          win.scrollTo({ top: Math.max(0, top), behavior: (reduce ? "instant" : "smooth") as ScrollBehavior });
        });
        later(at + 750, () => callbacks.current.onCursor(pointAt(element)));
        later(at + 1250, () => {
          callbacks.current.onCursor(pointAt(element), true);
          markPassage(doc, element, reduce);
        });
        at += 2300;
      });
      later(at, () => callbacks.current.onDone());
    }
    return () => timers.forEach((id) => window.clearTimeout(id));
    // `scale` só muda o tamanho visual; não reinicia a leitura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, highlightKey, reduce]);

  if (page === null) return <SitePrint visit={visit} className="mine-controle__shot is-reading" />;
  return (
    <div ref={boxRef} className="mine-controle__live">
      {page !== "loading" ? (
        <iframe
          ref={frameRef}
          title={`Página aberta pela Mine: ${visit.title || visit.domain || hostOf(visit.url)}`}
          className="mine-controle__frame"
          sandbox="allow-same-origin"
          referrerPolicy="no-referrer"
          srcDoc={page.html}
          tabIndex={-1}
          onLoad={() => setLoaded(true)}
          style={{ width: PAGE_WIDTH, height: `${100 / scale}%`, transform: `scale(${scale})` }}
        />
      ) : null}
      {!loaded ? <span className="mine-print__wait">abrindo a página…</span> : null}
    </div>
  );
}

/** Marca de tempo mais recente no texto que a Mine está escrevendo ([03:20]). */
export function lastTimestamp(text: string) {
  let seconds = -1;
  for (const match of String(text || "").matchAll(/[[(](?:(\d{1,2}):)?(\d{1,2}):(\d{2})[\])]/g)) {
    seconds = Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  }
  return seconds;
}

/**
 * O vídeo de verdade (player do YouTube, mudo). Enquanto a Mine escreve o
 * resumo, cada marca de tempo nova faz o player pular para aquele ponto e o
 * cursor clica na barra de progresso.
 */
function LiveVideo({
  visit,
  seek,
  reduce,
  onCursor,
  onDone,
}: {
  visit: MineVisit;
  seek: number;
  reduce: boolean;
  onCursor: (point: Point, clicking?: boolean) => void;
  onDone: () => void;
}) {
  const id = youtubeIdOf(visit.url);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const callbacks = useRef({ onCursor, onDone });
  callbacks.current = { onCursor, onDone };

  useEffect(() => {
    callbacks.current.onCursor({ x: 50, y: 50 });
    const play = window.setTimeout(() => callbacks.current.onCursor({ x: 50, y: 50 }, true), reduce ? 0 : 900);
    const done = window.setTimeout(() => callbacks.current.onDone(), reduce ? 300 : 3400);
    return () => {
      window.clearTimeout(play);
      window.clearTimeout(done);
    };
  }, [visit.url, reduce]);

  useEffect(() => {
    if (!ready || seek < 0) return;
    const send = (func: string, args: unknown[] = []) =>
      frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "https://www.youtube-nocookie.com");
    send("seekTo", [seek, true]);
    send("playVideo");
    const total = visit.seconds && visit.seconds > 0 ? visit.seconds : 0;
    const x = total ? 4 + Math.min(1, seek / total) * 92 : 50;
    callbacks.current.onCursor({ x, y: 90 }, true);
  }, [seek, ready, visit.seconds]);

  // O player avisa por mensagem quando o vídeo não pode tocar fora do
  // YouTube (dono bloqueou, restrição de idade): aí fica a capa.
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const frame = frameRef.current?.contentWindow;
    frame?.postMessage(JSON.stringify({ event: "listening", id: "mine", channel: "widget" }), "https://www.youtube-nocookie.com");
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube-nocookie.com" || event.source !== frame) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.event === "onError") setBlocked(true);
      } catch {
        /* mensagem que não é do player */
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [ready]);

  if (!id || blocked) {
    return (
      <>
        <SitePrint visit={visit} className="mine-controle__shot" />
        <span className="mine-controle__caption">{blocked ? "Esse vídeo só toca no YouTube · a Mine leu a legenda" : "Lendo a legenda do vídeo…"}</span>
      </>
    );
  }
  return (
    <div className="mine-controle__live">
      <iframe
        ref={frameRef}
        className="mine-controle__video"
        title={`Vídeo aberto pela Mine: ${visit.title || "YouTube"}`}
        src={`https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`}
        allow="autoplay; encrypted-media; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => setReady(true)}
      />
      {seek < 0 ? <span className="mine-controle__caption">Lendo a legenda do vídeo…</span> : null}
    </div>
  );
}

type Scene =
  | { kind: "search"; queries: string[]; results: MineSource[] }
  | { kind: "visit"; visit: MineVisit };

/**
 * Janela ao vivo. As visitas chegam em rajada (o servidor abre as páginas em
 * paralelo); cada uma ganha a sua cena, na ordem em que chegou, e a próxima
 * só entra quando a Mine termina de ler (grifar) a atual.
 */
export function MineControlePanel({
  status,
  visits,
  answering,
  answerText = "",
}: {
  status: MineSearchStatus | null;
  visits: MineVisit[];
  answering: boolean;
  answerText?: string;
}) {
  const [shown, setShown] = useState(0);
  const [sceneDone, setSceneDone] = useState(true);
  const [phase, setPhase] = useState<"move" | "click" | "open">("move");
  const [pointer, setPointer] = useState<{ point: Point; clicking: boolean } | null>(null);
  const reduce = Boolean(useReducedMotion());

  // As páginas começam a carregar assim que a visita chega.
  useEffect(() => {
    visits.filter((visit) => visit.kind === "page" && visit.ok).forEach((visit) => void loadPanelPage(visit.url));
  }, [visits]);

  // Próxima cena quando a atual terminou (com teto, para nunca travar).
  useEffect(() => {
    if (shown >= visits.length) return;
    const advance = () => {
      setShown((value) => value + 1);
      setSceneDone(false);
      setPointer(null);
    };
    if (shown === 0 || sceneDone) {
      const id = window.setTimeout(advance, reduce ? 150 : shown === 0 ? 400 : 500);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(advance, 14_000);
    return () => window.clearTimeout(id);
  }, [shown, visits.length, sceneDone, reduce]);

  // Enquanto escreve o resumo de um vídeo, a cena volta para ele.
  const seek = lastTimestamp(answerText);
  const videoVisit = [...visits].reverse().find((visit) => visit.kind === "video" && visit.ok);
  const current = seek >= 0 && videoVisit && shown >= visits.length ? videoVisit : shown > 0 ? visits[shown - 1] : undefined;
  const results = status?.sources || [];
  const scene: Scene = current ? { kind: "visit", visit: current } : { kind: "search", queries: status?.queries || [], results };

  // Ciclo do cursor: vai até o alvo, clica, a página abre.
  const sceneKey = scene.kind === "visit" ? `v-${scene.visit.url}` : `s-${results.length}`;
  useEffect(() => {
    setPhase("move");
    const click = window.setTimeout(() => setPhase("click"), reduce ? 0 : 900);
    const open = window.setTimeout(() => setPhase("open"), reduce ? 0 : 1300);
    return () => {
      window.clearTimeout(click);
      window.clearTimeout(open);
    };
  }, [sceneKey, reduce]);

  const nextResult = Math.max(0, visits[shown]?.url ? results.findIndex((item) => item.url === visits[shown].url) : 0);
  // O alvo na busca é medido na tela: o título do resultado que vai abrir.
  const viewportRef = useRef<HTMLDivElement>(null);
  const [hit, setHit] = useState<Point | null>(null);
  useEffect(() => {
    const box = viewportRef.current;
    const row = box?.querySelector<HTMLElement>(`[data-mc-result="${nextResult}"] .mine-controle__result-title`);
    if (!box || !row) {
      setHit(null);
      return;
    }
    const outer = box.getBoundingClientRect();
    const inner = row.getBoundingClientRect();
    setHit({
      x: ((inner.left - outer.left + Math.min(inner.width * 0.45, 140)) / outer.width) * 100,
      y: ((inner.top - outer.top + inner.height * 0.6) / outer.height) * 100,
    });
  }, [nextResult, results.length, scene.kind]);

  const onCursor = (point: Point, clicking = false) => setPointer({ point, clicking });
  const onDone = () => setSceneDone(true);
  const cursor = scene.kind === "search" ? hit || { x: 62, y: 20 } : pointer?.point || (scene.visit.kind === "video" ? { x: 50, y: 50 } : { x: 46, y: 9 });
  const clicking = scene.kind === "search" ? phase === "click" : Boolean(pointer?.clicking);

  const address = scene.kind === "visit" ? readableUrl(scene.visit.url) :scene.queries[0] ? `busca: ${scene.queries[0]}` : "minerva://controle-mine";

  const log = useMemo(() => {
    const lines: Array<{ text: string; state: "ok" | "fail" | "now" }> = [];
    if (status?.queries?.length) lines.push({ text: `Pesquisou “${status.queries[0]}”`, state: "ok" });
    visits.slice(0, shown).forEach((visit, index) => {
      const nome = visit.title || visit.domain || hostOf(visit.url);
      const reading = index === shown - 1 && !sceneDone;
      const host = visit.domain || hostOf(visit.url);
      lines.push({
        text: visit.kind === "video"
          ? visit.ok ? `${reading ? "Assistindo" : "Assistiu"} “${nome}” (${visit.note || "legenda"})` : !visit.note ? `Abrindo o vídeo ${nome}` : `Vídeo sem legenda: ${nome}`
          : visit.ok ? reading ? `Lendo ${host} e grifando` : `Leu ${host}` : !visit.note ? `Abrindo ${host}` : `Não conseguiu abrir ${host}`,
        state: reading ? "now" : visit.ok ? "ok" : visit.note ? "fail" : "now",
      });
    });
    if (seek >= 0 && videoVisit) {
      const m = Math.floor(seek / 60);
      lines.push({ text: `Voltou o vídeo em ${m}:${String(seek % 60).padStart(2, "0")}`, state: "now" });
    } else if (answering && shown >= visits.length) lines.push({ text: "Escrevendo a resposta", state: "now" });
    return lines.slice(-4);
  }, [status?.queries, visits, shown, sceneDone, answering, seek, videoVisit]);

  return (
    <div className="mine-controle">
      <div className="mine-controle__chrome">
        <span className="mine-controle__dots" aria-hidden><i /><i /><i /></span>
        <span className="mine-controle__address">
          {scene.kind === "visit" ? <Lock className="h-3 w-3" aria-hidden /> : <Search className="h-3 w-3" aria-hidden />}
          <motion.span key={address} className="mine-controle__url" initial={reduce ? false : { clipPath: "inset(0 100% 0 0)" }} animate={{ clipPath: "inset(0 0% 0 0)" }} transition={{ duration: 0.7, ease: "easeOut" }}>
            {address}
          </motion.span>
        </span>
        <RotateCw className={`mine-controle__reload h-3.5 w-3.5 ${phase !== "open" ? "is-spinning" : ""}`} aria-hidden />
        <span className="mine-controle__badge">Controle Mine</span>
      </div>

      <div className="mine-controle__viewport" ref={viewportRef}>
        {scene.kind === "search" ? (
          <div className="mine-controle__search">
            <div className="mine-controle__searchbox">
              <Search className="h-3.5 w-3.5" aria-hidden />
              <span>{scene.queries[0] || "Abrindo os links que você mandou…"}</span>
            </div>
            {results.length ? (
              <ul className="mine-controle__results">
                {results.slice(0, 4).map((item, index) => (
                  <li key={item.url} data-mc-result={index} className={index === nextResult && phase !== "move" ? "is-hit" : ""}>
                    <span className="mine-controle__result-domain">{item.domain || hostOf(item.url)}</span>
                    <span className="mine-controle__result-title">{item.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mine-controle__skeleton" aria-hidden><i /><i /><i /></div>
            )}
          </div>
        ) : (
          <motion.div
            key={scene.visit.url}
            className="mine-controle__page"
            initial={reduce ? false : { opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
          >
            {scene.visit.kind === "video" ? (
              <LiveVideo visit={scene.visit} seek={seek} reduce={reduce} onCursor={onCursor} onDone={onDone} />
            ) : (
              <LivePage visit={scene.visit} reduce={reduce} onCursor={onCursor} onDone={onDone} />
            )}
          </motion.div>
        )}
        <MineCursor x={cursor.x} y={cursor.y} clicking={clicking} />
      </div>

      <ol className="mine-controle__log" aria-live="polite">
        {log.map((line, index) => (
          <li key={`${line.text}-${index}`} className={`is-${line.state}`}>
            <span className="mine-controle__mark" aria-hidden>
              {line.state === "ok" ? <Check className="h-3 w-3" /> : line.state === "fail" ? <X className="h-3 w-3" /> : <span className="mine-controle__pulse" />}
            </span>
            {line.text}
          </li>
        ))}
        {!log.length ? (
          <li className="is-now">
            <span className="mine-controle__mark" aria-hidden><span className="mine-controle__pulse" /></span>
            Abrindo o navegador
          </li>
        ) : null}
      </ol>
    </div>
  );
}

/** Depois da resposta: o que a Mine abriu, com o print de cada página. */
export function MineControleVisits({ visits }: { visits: MineVisit[] }) {
  if (!visits.length) return null;
  const videos = visits.filter((visit) => visit.kind === "video").length;
  const pages = visits.length - videos;
  const resumo = [pages ? `${pages} ${pages === 1 ? "site" : "sites"}` : "", videos ? `${videos} ${videos === 1 ? "vídeo" : "vídeos"}` : ""].filter(Boolean).join(" e ");
  return (
    <details className="mine-visits">
      <summary>
        <MousePointer2 className="h-3.5 w-3.5" aria-hidden />
        <span>Controle Mine · abriu {resumo}</span>
      </summary>
      <ul className="mine-visits__list">
        {visits.map((visit) => (
          <li key={visit.url}>
            <a href={visit.url} target="_blank" rel="noopener noreferrer" className="mine-visits__card">
              <SitePrint visit={visit} />
              <span className="mine-visits__meta">
                <span className="mine-visits__title">{visit.title || visit.domain || hostOf(visit.url)}</span>
                <span className="mine-visits__domain">
                  {visit.domain || hostOf(visit.url)}
                  {!visit.ok ? <em> · {visit.note || "não abriu"}</em> : visit.kind === "video" && visit.note ? <em> · {visit.note}</em> : null}
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
