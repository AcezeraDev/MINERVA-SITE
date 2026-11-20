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
 * O print vem do mShots (serviço público do WordPress que fotografa uma URL):
 * só endereços públicos que a própria Mine abriu vão para ele, nunca dado do
 * estudante.
 */

export type MineVisit = {
  url: string;
  title?: string;
  domain?: string;
  kind: "page" | "video";
  ok: boolean;
  note?: string;
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

type Scene =
  | { kind: "search"; queries: string[]; results: MineSource[]; target: number }
  | { kind: "visit"; visit: MineVisit; done: boolean };

/**
 * Janela ao vivo. As visitas chegam em rajada (o servidor abre as páginas em
 * paralelo), então cada uma fica na tela pelo menos ~2,6 s, na ordem em que
 * chegou — dá tempo de ver o cursor clicar e o print aparecer.
 */
export function MineControlePanel({
  status,
  visits,
  answering,
}: {
  status: MineSearchStatus | null;
  visits: MineVisit[];
  answering: boolean;
}) {
  const [shown, setShown] = useState(0);
  const [phase, setPhase] = useState<"move" | "click" | "open">("move");
  const reduce = useReducedMotion();

  // Avança uma visita por vez.
  useEffect(() => {
    if (shown >= visits.length) return;
    const wait = shown === 0 ? 400 : 2600;
    const id = window.setTimeout(() => setShown((value) => value + 1), reduce ? 200 : wait);
    return () => window.clearTimeout(id);
  }, [shown, visits.length, reduce]);

  const current = shown > 0 ? visits[shown - 1] : undefined;
  const results = status?.sources || [];
  const scene: Scene = current
    ? { kind: "visit", visit: current, done: current.ok || Boolean(current.note) }
    : { kind: "search", queries: status?.queries || [], results, target: 0 };

  // Ciclo do cursor em cada cena: vai até o alvo, clica, a página abre.
  const sceneKey = scene.kind === "visit" ? `v-${shown}` : `s-${results.length}`;
  useEffect(() => {
    setPhase("move");
    const click = window.setTimeout(() => setPhase("click"), reduce ? 0 : 900);
    const open = window.setTimeout(() => setPhase("open"), reduce ? 0 : 1300);
    return () => {
      window.clearTimeout(click);
      window.clearTimeout(open);
    };
  }, [sceneKey, reduce]);

  // Onde o cursor está: no resultado que vai abrir, no play do vídeo, ou
  // "lendo" a página (desce devagar).
  const nextResult = Math.max(0, visits[shown]?.url ? results.findIndex((item) => item.url === visits[shown].url) : 0);
  // O alvo na busca é medido na tela: o título do resultado que vai abrir.
  const viewportRef = useRef<HTMLDivElement>(null);
  const [hit, setHit] = useState<{ x: number; y: number } | null>(null);
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
  const cursor =
    scene.kind === "search"
      ? hit || { x: 62, y: 20 }
      : scene.visit.kind === "video"
        ? phase === "open" ? { x: 70, y: 78 } : { x: 50, y: 50 }
        : phase === "open" ? { x: 78, y: 72 } : { x: 46, y: 9 };

  const address = scene.kind === "visit"
    ? scene.visit.url
    : scene.queries[0]
      ? `busca: ${scene.queries[0]}`
      : "minerva://controle-mine";

  const log = useMemo(() => {
    const lines: Array<{ text: string; state: "ok" | "fail" | "now" }> = [];
    if (status?.queries?.length) lines.push({ text: `Pesquisou “${status.queries[0]}”`, state: "ok" });
    visits.slice(0, shown).forEach((visit, index) => {
      const nome = visit.title || visit.domain || hostOf(visit.url);
      const now = index === shown - 1 && !visit.ok && !visit.note;
      lines.push({
        text: visit.kind === "video"
          ? visit.ok ? `Assistiu “${nome}” (${visit.note || "legenda"})` : now ? `Abrindo o vídeo ${nome}` : `Vídeo sem legenda: ${nome}`
          : visit.ok ? `Abriu ${visit.domain || hostOf(visit.url)} e tirou print` : now ? `Abrindo ${visit.domain || hostOf(visit.url)}` : `Não conseguiu abrir ${visit.domain || hostOf(visit.url)}`,
        state: now ? "now" : visit.ok ? "ok" : "fail",
      });
    });
    if (answering && shown >= visits.length) lines.push({ text: "Escrevendo a resposta", state: "now" });
    return lines.slice(-4);
  }, [status?.queries, visits, shown, answering]);

  return (
    <div className="mine-controle" aria-live="polite">
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
            <SitePrint visit={scene.visit} className={`mine-controle__shot ${phase === "open" && scene.visit.kind === "page" ? "is-reading" : ""}`} />
            {scene.visit.kind === "video" && phase === "open" ? <span className="mine-controle__caption">Lendo a legenda do vídeo…</span> : null}
          </motion.div>
        )}
        <MineCursor x={cursor.x} y={cursor.y} clicking={phase === "click"} />
        {/* Os prints das próximas páginas já vão sendo tirados. */}
        <span className="mine-controle__preload" aria-hidden>
          {visits.slice(shown).filter((visit) => visit.kind === "page").map((visit) => (
            <img key={visit.url} src={shotUrls(visit.url)[0]} alt="" referrerPolicy="no-referrer" />
          ))}
        </span>
      </div>

      <ol className="mine-controle__log">
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
