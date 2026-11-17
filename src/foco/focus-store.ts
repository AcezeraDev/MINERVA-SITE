import { useEffect, useState } from "react";

/*
 * Estado do modo Foco, guardado no aparelho (nov/2026).
 *
 * Antes o cronômetro só "andava" dentro da aba Foco: fora dela havia um selo
 * de leitura, e uma sessão que acabava com o aluno no chat só era registrada
 * quando ele voltava. Agora a aba Foco (FocusView, em main.tsx) e o widget do
 * canto (FocusWidget) leem e escrevem o mesmo estado, e quem estiver na tela
 * fecha a fase quando o tempo acaba. Nunca os dois juntos: o widget não
 * aparece na rota #/foco.
 *
 * O tempo conta pelo horário de término (`endsAt`), então segue certo com a
 * aba em segundo plano ou depois de recarregar.
 */

export type FocusPhase = "focus" | "break";

export type FocusState = {
  phase: FocusPhase;
  longBreak: boolean;
  cycles: number;
  focusMin: number;
  breakMin: number;
  subjectId?: string;
  running: boolean;
  endsAt?: number;
  remaining: number;
  /** Fase que acabou de terminar fora da aba Foco (o widget avisa até a próxima ação). */
  justFinished?: FocusPhase;
};

export const FOCUS_EVENT = "minerva-foco";

export const focusStateKey = (userId: string) => `minerva-foco-v1-${userId}`;

export function readFocusState(userId: string): FocusState | null {
  try {
    const value = JSON.parse(localStorage.getItem(focusStateKey(userId)) || "null") as FocusState | null;
    if (!value || (value.phase !== "focus" && value.phase !== "break")) return null;
    return value;
  } catch {
    return null;
  }
}

export function writeFocusState(userId: string, state: FocusState) {
  try {
    localStorage.setItem(focusStateKey(userId), JSON.stringify(state));
  } catch {
    // armazenamento cheio ou bloqueado: o cronômetro da tela continua
  }
  window.dispatchEvent(new Event(FOCUS_EVENT));
}

export function focusRemainingOf(state: FocusState) {
  if (state.running && state.endsAt) return Math.max(0, Math.round((state.endsAt - Date.now()) / 1000));
  return Math.max(0, Math.round(state.remaining || 0));
}

/** Duração cheia da fase atual, em segundos (a pausa longa vale 3 pausas). */
export function focusTotalOf(state: FocusState) {
  return state.phase === "focus" ? state.focusMin * 60 : state.breakMin * (state.longBreak ? 3 : 1) * 60;
}

/**
 * Há algo para o widget mostrar? Rodando, pausado no meio, com uma pausa
 * esperando para começar, ou uma pausa que acabou de terminar.
 */
export function isFocusActive(state: FocusState | null): state is FocusState {
  if (!state) return false;
  if (state.running) return true;
  if (state.justFinished) return true;
  const left = focusRemainingOf(state);
  if (state.phase === "break") return left > 0;
  return left > 0 && left < focusTotalOf(state);
}

/** Começa uma sessão nova de foco (o atalho do chat da Mine). */
export function startFocusSession(
  userId: string,
  { focusMin, breakMin, subjectId }: { focusMin: number; breakMin: number; subjectId?: string },
) {
  const previous = readFocusState(userId);
  const remaining = focusMin * 60;
  writeFocusState(userId, {
    phase: "focus",
    longBreak: false,
    cycles: previous?.cycles ?? 0,
    focusMin,
    breakMin,
    subjectId,
    running: true,
    endsAt: Date.now() + remaining * 1000,
    remaining,
  });
}

/** Liga ou pausa a fase atual sem perder o tempo que falta. */
export function toggleFocusRunning(userId: string) {
  const state = readFocusState(userId);
  if (!state) return;
  const left = focusRemainingOf(state);
  if (state.running) {
    writeFocusState(userId, { ...state, running: false, endsAt: undefined, remaining: left, justFinished: undefined });
  } else {
    const remaining = left > 0 ? left : focusTotalOf(state);
    writeFocusState(userId, { ...state, running: true, endsAt: Date.now() + remaining * 1000, remaining, justFinished: undefined });
  }
}

/** Encerra: volta ao começo de um ciclo de foco, parado. Os ciclos feitos ficam. */
export function stopFocusSession(userId: string) {
  const state = readFocusState(userId);
  if (!state) return;
  writeFocusState(userId, {
    ...state,
    phase: "focus",
    longBreak: false,
    running: false,
    endsAt: undefined,
    remaining: state.focusMin * 60,
    justFinished: undefined,
  });
}

/**
 * O tempo da fase acabou: calcula a fase seguinte, com as mesmas regras da aba
 * Foco (pausa longa a cada 4 ciclos, a próxima fase começa parada).
 */
export function finishFocusPhase(state: FocusState): { next: FocusState; finishedFocus: boolean; isLong: boolean } {
  if (state.phase === "focus") {
    const cycles = state.cycles + 1;
    const isLong = cycles % 4 === 0;
    return {
      finishedFocus: true,
      isLong,
      next: {
        ...state,
        cycles,
        phase: "break",
        longBreak: isLong,
        running: false,
        endsAt: undefined,
        remaining: state.breakMin * (isLong ? 3 : 1) * 60,
        justFinished: "focus",
      },
    };
  }
  return {
    finishedFocus: false,
    isLong: false,
    next: {
      ...state,
      phase: "focus",
      longBreak: false,
      running: false,
      endsAt: undefined,
      remaining: state.focusMin * 60,
      justFinished: "break",
    },
  };
}

/** Estado do foco que acompanha mudanças (de qualquer aba) e anda a cada segundo enquanto roda. */
export function useFocusState(userId: string) {
  const [state, setState] = useState(() => readFocusState(userId));
  const [, setTick] = useState(0);
  useEffect(() => {
    const reload = () => setState(readFocusState(userId));
    reload();
    window.addEventListener(FOCUS_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(FOCUS_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, [userId]);
  const running = Boolean(state?.running);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  return state;
}

export function formatClock(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}
