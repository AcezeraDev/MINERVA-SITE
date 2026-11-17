import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ChevronDown, Coffee, Pause, Play, Square, Timer } from "lucide-react";
import {
  finishFocusPhase,
  focusRemainingOf,
  focusTotalOf,
  formatClock,
  isFocusActive,
  stopFocusSession,
  toggleFocusRunning,
  useFocusState,
  writeFocusState,
  type FocusState,
} from "./focus-store";
import "./focus-widget.css";

/*
 * Ficha do Foco no canto da tela (nov/2026).
 *
 * Aparece em qualquer tela menos a do Foco enquanto há uma sessão: rodando,
 * pausada no meio, com uma pausa esperando ou recém-terminada. É uma ficha de
 * caderno presa com fita: os minutos, um recado à mão e o mesmo lápis da aba
 * Foco, que encolhe deixando o traço de grafite.
 *
 * Arrasta para qualquer canto e gruda no mais próximo; desvia sozinha do que é
 * fixo na tela (a Mine flutuante, a barra do celular, o topo e a caixa de
 * escrever do chat — marcados com `data-focus-avoid`). Recolhe numa pílula.
 */

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type Prefs = { corner?: Corner; collapsed?: boolean };

const PREFS_KEY = "minerva-foco-widget-v1";
const CORNERS: Corner[] = ["top-right", "bottom-right", "bottom-left", "top-left"];
const EDGE = 16;
const GAP = 10;

function readPrefs(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") as Prefs;
  } catch {
    return {};
  }
}

function writePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // sem armazenamento: o canto vale só nesta visita
  }
}

/** Canto inicial: embaixo à direita no computador; no celular, em cima (embaixo moram a barra e a Mine). */
function defaultCorner(): Corner {
  return typeof window !== "undefined" && window.innerWidth < 768 ? "top-right" : "bottom-right";
}

/**
 * Onde a ficha fica naquele canto, em px, desviando dos elementos marcados.
 * Um elemento atrapalha um canto quando está na mesma metade (cima/baixo) e
 * cruza a faixa horizontal que a ficha ocuparia.
 */
function anchorFor(corner: Corner, width: number, height: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const right = corner.endsWith("right");
  const bottom = corner.startsWith("bottom");
  const left = right ? vw - width - EDGE : EDGE;
  let top = EDGE;
  let bottomInset = EDGE;
  document.querySelectorAll<HTMLElement>("[data-focus-avoid]").forEach((element) => {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const crossesColumn = rect.right > left && rect.left < left + width;
    if (!crossesColumn) return;
    if (bottom && rect.top > vh * 0.5) bottomInset = Math.max(bottomInset, vh - rect.top + GAP);
    if (!bottom && rect.bottom < vh * 0.5) top = Math.max(top, rect.bottom + GAP);
  });
  const y = bottom ? vh - height - bottomInset : top;
  return { x: Math.max(EDGE, left), y: Math.max(EDGE, Math.min(y, vh - height - EDGE)) };
}

function nearestCorner(centerX: number, centerY: number): Corner {
  const right = centerX > window.innerWidth / 2;
  const bottom = centerY > window.innerHeight / 2;
  return `${bottom ? "bottom" : "top"}-${right ? "right" : "left"}` as Corner;
}

/** O lápis da aba Foco em miniatura: o corpo encolhe e a ponta deixa grafite para trás. */
function MiniPencil({ fraction, phase }: { fraction: number; phase: FocusState["phase"] }) {
  const f = Math.max(0, Math.min(1, fraction));
  const width = 220;
  const eraser = 10;
  const ferrule = 7;
  const cone = 14;
  const fullBody = width - eraser - ferrule - cone - 4;
  const body = Math.max(6, fullBody * f);
  const tipX = width - eraser - ferrule - body - cone;
  return (
    <svg className="focus-card__pencil" viewBox={`0 0 ${width} 16`} aria-hidden preserveAspectRatio="none">
      {/* traço de grafite: do começo da folha até onde a ponta chegou */}
      <path d={`M2 11.5 Q ${tipX / 2} 10.6 ${tipX + 1} 11.5`} className="focus-card__graphite" fill="none" />
      <g className="focus-card__pencil-body" data-phase={phase} style={{ transform: `translateX(${tipX}px)` }}>
        <polygon points={`0,8 ${cone},2 ${cone},14`} className="focus-card__wood" />
        <polygon points={`0,8 4.5,6.3 4.5,9.7`} className="focus-card__lead" />
        <rect x={cone} y={2} width={body} height={12} className="focus-card__paint" />
        <rect x={cone} y={2} width={body} height={4} className="focus-card__paint-shine" />
        <rect x={cone + body} y={2} width={ferrule} height={12} className="focus-card__ferrule" />
        <rect x={cone + body + ferrule} y={2} width={eraser} height={12} rx={2.5} className="focus-card__eraser" />
      </g>
    </svg>
  );
}

function noteOf(state: FocusState, left: number) {
  if (state.justFinished === "focus") return "sessão concluída!";
  if (state.justFinished === "break") return "pausa acabou — bora?";
  if (state.phase === "break") return state.running ? "respira um pouco…" : state.longBreak ? "pausa longa merecida" : "hora do café";
  if (!state.running) return left > 0 ? "lápis em pausa" : "lápis apontado";
  return "escrevendo…";
}

export function FocusWidget({
  userId,
  route,
  subjects,
  onPhaseDone,
}: {
  userId: string;
  route: string;
  subjects: Array<{ id: string; name: string; color?: string }>;
  /** O tempo de uma fase acabou com o aluno fora da aba Foco. */
  onPhaseDone: (finished: FocusState, result: { finishedFocus: boolean; isLong: boolean }, anchor: Element | null) => void;
}) {
  const state = useFocusState(userId);
  const reduced = useReducedMotion();
  const [prefs, setPrefs] = useState<Prefs>(() => readPrefs());
  const corner = prefs.corner || defaultCorner();
  const collapsed = Boolean(prefs.collapsed);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(-9999);
  const y = useMotionValue(-9999);
  const placed = useRef(false);
  const dragging = useRef(false);
  const handledEnd = useRef<number | null>(null);

  const onFocusPage = route === "foco";
  const visible = !onFocusPage && isFocusActive(state);
  const left = state ? focusRemainingOf(state) : 0;

  // Fecha a fase quando o tempo acaba (na aba Foco quem fecha é ela).
  useEffect(() => {
    if (onFocusPage || !state?.running || left > 0) return;
    const key = state.endsAt ?? 0;
    if (handledEnd.current === key) return;
    handledEnd.current = key;
    const result = finishFocusPhase(state);
    writeFocusState(userId, result.next);
    onPhaseDone(state, { finishedFocus: result.finishedFocus, isLong: result.isLong }, cardRef.current);
  }, [onFocusPage, state, left, userId, onPhaseDone]);

  // Tempo no título da aba, como a aba Foco faz.
  useEffect(() => {
    if (onFocusPage || !state?.running) return;
    document.title = `${formatClock(left)} · ${state.phase === "focus" ? "Foco" : "Pausa"} — Minerva`;
    return () => {
      document.title = "Minerva";
    };
  }, [onFocusPage, state?.running, state?.phase, left]);

  const place = useCallback(
    (target: Corner, instant = false) => {
      const element = cardRef.current;
      if (!element || dragging.current) return;
      const { x: tx, y: ty } = anchorFor(target, element.offsetWidth, element.offsetHeight);
      if (instant || !placed.current || reduced) {
        x.set(tx);
        y.set(ty);
        placed.current = true;
        return;
      }
      const spring = { type: "spring" as const, stiffness: 420, damping: 38, mass: 0.9 };
      animate(x, tx, spring);
      animate(y, ty, spring);
    },
    [reduced, x, y],
  );

  // Recalcula o lugar ao aparecer, ao trocar de canto/tamanho e com a janela.
  useLayoutEffect(() => {
    if (!visible) {
      placed.current = false;
      return;
    }
    place(corner, !placed.current);
  }, [visible, corner, collapsed, route, place]);

  useEffect(() => {
    if (!visible) return;
    const onResize = () => place(corner, true);
    window.addEventListener("resize", onResize);
    // a Mine flutuante abre e fecha balões; confere o desvio de tempos em tempos
    const timer = window.setInterval(() => place(corner), 1500);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearInterval(timer);
    };
  }, [visible, corner, place]);

  const savePrefs = (next: Prefs) => {
    setPrefs(next);
    writePrefs(next);
  };

  const cycleCorner = () => {
    const index = CORNERS.indexOf(corner);
    savePrefs({ ...prefs, corner: CORNERS[(index + 1) % CORNERS.length] });
  };

  if (!state) return null;
  const total = focusTotalOf(state);
  const fraction = total > 0 ? left / total : 0;
  const subject = subjects.find((item) => item.id === state.subjectId);
  const isBreak = state.phase === "break";
  const phaseLabel = isBreak ? (state.longBreak ? "pausa longa" : "pausa") : "foco";
  const startLabel = state.justFinished === "focus" ? "Começar a pausa" : state.justFinished === "break" ? "Começar o próximo ciclo" : state.running ? "Pausar" : "Continuar";
  const time = formatClock(left);
  const spoken = `${isBreak ? "Pausa" : "Foco"}${subject && !isBreak ? ` de ${subject.name}` : ""}: ${left > 0 ? `faltam ${Math.floor(left / 60)} minutos e ${left % 60} segundos` : "tempo esgotado"}`;

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="focus-card"
          ref={cardRef}
          className="focus-float"
          data-phase={state.phase}
          data-collapsed={collapsed ? "" : undefined}
          style={{ x, y }}
          drag
          dragMomentum={false}
          dragElastic={0}
          onDragStart={() => {
            dragging.current = true;
          }}
          onDragEnd={() => {
            dragging.current = false;
            const element = cardRef.current;
            if (!element) return;
            const rect = element.getBoundingClientRect();
            const next = nearestCorner(rect.left + rect.width / 2, rect.top + rect.height / 2);
            if (next === corner) place(corner);
            else savePrefs({ ...prefs, corner: next });
          }}
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, rotate: -4 }}
          animate={{ opacity: 1, scale: 1, rotate: collapsed ? 0 : -0.8 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, transition: { duration: 0.16 } }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          role="region"
          aria-label="Sessão de foco em andamento"
        >
          {collapsed ? (
            <button
              type="button"
              className="focus-pill"
              onClick={() => !dragging.current && savePrefs({ ...prefs, collapsed: false })}
              aria-label={`${spoken}. Abrir a ficha do foco.`}
            >
              {isBreak ? <Coffee aria-hidden /> : <Timer aria-hidden />}
              <span className="focus-pill__time">{time}</span>
              {state.running ? <span className="focus-pill__live" aria-hidden /> : <Pause aria-hidden className="focus-pill__paused" />}
            </button>
          ) : (
            <div className="focus-card">
              <span className="focus-card__tape" aria-hidden />
              <div className="focus-card__head">
                <p className="focus-card__label">
                  <span>{phaseLabel}</span>
                  {subject && !isBreak ? (
                    <>
                      <span aria-hidden> · </span>
                      <span className="focus-card__subject">{subject.name}</span>
                    </>
                  ) : null}
                </p>
                <button type="button" className="focus-card__icon focus-card__icon--quiet" onClick={() => savePrefs({ ...prefs, collapsed: true })} aria-label="Recolher a ficha do foco" title="Recolher">
                  <ChevronDown aria-hidden />
                </button>
              </div>

              <div className="focus-card__row">
                <p className="focus-card__time" aria-label={spoken} role="timer">
                  {time.slice(0, 2)}
                  <span className={state.running ? "focus-card__colon is-ticking" : "focus-card__colon"}>:</span>
                  {time.slice(3)}
                </p>
                <div className="focus-card__actions">
                  <button
                    type="button"
                    className="focus-card__icon focus-card__icon--main"
                    onClick={() => toggleFocusRunning(userId)}
                    aria-label={startLabel}
                    title={startLabel}
                  >
                    {state.running ? <Pause aria-hidden /> : <Play aria-hidden />}
                  </button>
                  <a className="focus-card__icon" href="#/foco" aria-label="Abrir a tela do Foco" title="Abrir o Foco">
                    <ArrowUpRight aria-hidden />
                  </a>
                  <button type="button" className="focus-card__icon" onClick={() => stopFocusSession(userId)} aria-label="Encerrar a sessão de foco" title="Encerrar">
                    <Square aria-hidden />
                  </button>
                </div>
              </div>

              <MiniPencil fraction={fraction} phase={state.phase} />

              <div className="focus-card__foot">
                <span className="focus-card__note">{noteOf(state, left)}</span>
                <button type="button" className="focus-card__move" onClick={cycleCorner} aria-label="Mudar a ficha de canto" title="Arraste ou toque para mudar de canto">
                  <span aria-hidden />
                  <span aria-hidden />
                  <span aria-hidden />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
