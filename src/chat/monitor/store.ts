import { useSyncExternalStore } from "react";
import type { Project } from "../../../shared/projeto.mjs";

/*
 * Estado do monitor de código da Mine.
 *
 * Cada bloco ````projeto (ou página ```html) renderizado no chat se registra
 * aqui enquanto está na tela. A lista, na ordem da conversa, vira as
 * "versões" do monitor. Trocar de conversa desmonta os blocos e o monitor
 * fecha sozinho quando fica vazio.
 *
 * `pinned` é a versão que a pessoa escolheu; null = acompanhar a mais nova
 * (é o que acontece quando a Mine está escrevendo uma versão nova).
 */

export type MonitorEntry = { key: string; seq: number; project: Project; streaming: boolean };

type State = { entries: MonitorEntry[]; open: boolean; pinned: string | null };

let state: State = { entries: [], open: false, pinned: null };
let seq = 0;
const listeners = new Set<() => void>();
const autoOpened = new Set<string>();

function emit(next: State) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const wide = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

export function registerProject(key: string, project: Project, streaming: boolean) {
  const existing = state.entries.find((entry) => entry.key === key);
  let entries: MonitorEntry[];
  if (existing) {
    if (existing.project === project && existing.streaming === streaming) return;
    entries = state.entries.map((entry) => (entry.key === key ? { ...entry, project, streaming } : entry));
  } else {
    entries = [...state.entries, { key, seq: ++seq, project, streaming }].sort((a, b) => a.seq - b.seq);
  }
  let { open, pinned } = state;
  // A Mine começou a escrever: o monitor abre (em tela larga) e segue a versão nova.
  if (streaming && !autoOpened.has(key)) {
    autoOpened.add(key);
    pinned = null;
    if (wide()) open = true;
  }
  emit({ entries, open, pinned });
}

export function unregisterProject(key: string) {
  if (!state.entries.some((entry) => entry.key === key)) return;
  const entries = state.entries.filter((entry) => entry.key !== key);
  emit({ ...state, entries, pinned: state.pinned === key ? null : state.pinned });
  // Quando a resposta termina, o bloco é remontado (sai e volta no mesmo
  // instante): só fecha se continuar vazio depois disso.
  if (!entries.length) {
    window.setTimeout(() => {
      if (!state.entries.length && state.open) emit({ ...state, open: false });
    }, 0);
  }
}

export function openMonitor(key?: string) {
  emit({ ...state, open: true, pinned: key ?? state.pinned });
}

export function selectVersion(key: string) {
  const latest = state.entries[state.entries.length - 1]?.key;
  emit({ ...state, pinned: key === latest ? null : key });
}

export function closeMonitor() {
  emit({ ...state, open: false });
}

export function useMonitor() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state);
  const current = (snapshot.pinned && snapshot.entries.find((entry) => entry.key === snapshot.pinned)) || snapshot.entries[snapshot.entries.length - 1] || null;
  return { ...snapshot, current };
}

/** Número da versão: posição entre os projetos com o mesmo nome na conversa. */
export function versionOf(entries: MonitorEntry[], entry: MonitorEntry) {
  const name = entry.project.name.toLowerCase();
  const same = entries.filter((item) => item.project.name.toLowerCase() === name);
  return { number: same.indexOf(entry) + 1, total: same.length };
}

