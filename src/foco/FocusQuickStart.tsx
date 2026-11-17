import React, { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Pause, Play, Square, Timer } from "lucide-react";
import {
  focusRemainingOf,
  formatClock,
  isFocusActive,
  readFocusState,
  startFocusSession,
  stopFocusSession,
  toggleFocusRunning,
  useFocusState,
} from "./focus-store";
import "./focus-widget.css";

/*
 * Foco sem sair do chat da Mine (nov/2026). Um botão no topo do chat abre um
 * painel com os três ritmos da aba Foco; um toque começa a sessão e a ficha
 * do canto (FocusWidget) assume. Com uma sessão já rodando, o botão mostra os
 * minutos e o painel vira controle (pausar, encerrar, abrir o Foco).
 */

const PRESETS = [
  { name: "Pomodoro", focus: 25, rest: 5 },
  { name: "Sprint", focus: 15, rest: 3 },
  { name: "Estudo longo", focus: 50, rest: 10 },
] as const;

export function FocusQuickStart({
  userId,
  subjectId,
  subjectName,
}: {
  userId: string;
  /** Matéria da conversa; a sessão conta para ela. */
  subjectId?: string;
  subjectName?: string;
}) {
  const state = useFocusState(userId);
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const firstRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  const active = isFocusActive(state);
  const left = state ? focusRemainingOf(state) : 0;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    const focusTimer = window.setTimeout(() => firstRef.current?.focus(), 40);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  const start = (focus: number, rest: number) => {
    // sem matéria na conversa, a sessão vai para a mesma da última vez (se houver)
    startFocusSession(userId, { focusMin: focus, breakMin: rest, subjectId: subjectId || readFocusState(userId)?.subjectId });
    setOpen(false);
  };

  const triggerLabel = active && state ? `${state.phase === "focus" ? "Foco" : "Pausa"}: ${formatClock(left)}. Abrir controles do foco` : "Começar uma sessão de foco sem sair do chat";

  return (
    <div className="focus-quick" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="focus-quick__trigger"
        data-active={active ? "" : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={triggerLabel}
        title={active ? "Controles do foco" : "Modo foco"}
        onClick={() => setOpen((value) => !value)}
      >
        <Timer aria-hidden />
        {active ? <span className="focus-quick__clock">{formatClock(left)}</span> : <span className="focus-quick__word">Foco</span>}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            id={panelId}
            role="dialog"
            aria-label="Modo foco"
            className="focus-quick__panel"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
          >
            {active && state ? (
              <>
                <p className="focus-quick__title">{state.phase === "focus" ? "Sessão de foco" : state.longBreak ? "Pausa longa" : "Pausa"}</p>
                <div className="focus-quick__live">
                  <span className="focus-quick__live-time" role="timer">{formatClock(left)}</span>
                </div>
                <div className="focus-quick__buttons">
                  <button ref={firstRef} type="button" className="focus-quick__btn focus-quick__btn--main" onClick={() => toggleFocusRunning(userId)}>
                    {state.running ? <Pause aria-hidden /> : <Play aria-hidden />}
                    {state.running ? "Pausar" : state.justFinished === "focus" ? "Começar a pausa" : "Continuar"}
                  </button>
                  <button
                    type="button"
                    className="focus-quick__btn"
                    onClick={() => {
                      stopFocusSession(userId);
                      setOpen(false);
                    }}
                  >
                    <Square aria-hidden />
                    Encerrar
                  </button>
                </div>
                <a className="focus-quick__link" href="#/foco">
                  Abrir a tela do Foco
                </a>
              </>
            ) : (
              <>
                <p className="focus-quick__title">Foco sem sair do chat</p>
                <p className="focus-quick__hint">
                  O tempo fica numa ficha no canto da tela enquanto você conversa com a Mine.
                  {subjectName ? (
                    <>
                      {" "}
                      Conta para <strong>{subjectName}</strong>.
                    </>
                  ) : null}
                </p>
                <ul className="focus-quick__options">
                  {PRESETS.map((preset, index) => (
                    <li key={preset.name}>
                      <button ref={index === 0 ? firstRef : undefined} type="button" className="focus-quick__option" onClick={() => start(preset.focus, preset.rest)}>
                        <span className="focus-quick__minutes">
                          {preset.focus}
                          <small>min</small>
                        </span>
                        <span>
                          <span className="focus-quick__name">{preset.name}</span>
                          <span className="focus-quick__detail">depois {preset.rest} min de pausa</span>
                        </span>
                        <ChevronRight aria-hidden className="focus-quick__go" />
                      </button>
                    </li>
                  ))}
                </ul>
                <a className="focus-quick__link" href="#/foco">
                  Outro tempo? Ajuste na tela do Foco
                </a>
              </>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
