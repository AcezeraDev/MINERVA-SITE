export type TaskKind = "prova" | "trabalho" | "licao" | "revisao" | "leitura";
export type TaskPriority = "alta" | "media" | "baixa";
export type TaskRepeat = "daily" | "weekly";

export const taskKinds: Array<{ id: TaskKind; label: string; words: string[] }>;
export const taskPriorities: Array<{ id: TaskPriority; label: string }>;

export type QuickTask = {
  title: string;
  dueAt: number | null;
  time: string | null;
  priority: TaskPriority | null;
  kind: TaskKind | null;
  subjectId: string | null;
  repeat: TaskRepeat | null;
};

type TaskLike = {
  id: string;
  dueAt: number;
  done: boolean;
  doneAt?: number;
  createdAt: number;
  repeat?: TaskRepeat;
  spawnedNext?: string;
  steps?: Array<{ id: string; text: string; done: boolean }>;
};

export function startOfDay(timestamp: number): number;
export function shiftDays(timestamp: number, days: number): number;
export function daysBetween(from: number, to: number): number;
export function nextWeekday(base: number, weekday: number, strict?: boolean): number;
export function kindOf(title: string): TaskKind | null;
export function parseQuickTask(text: string, options?: { now?: number; subjects?: Array<{ id: string; name: string }> }): QuickTask;
export function nextOccurrence(task: { dueAt: number; repeat?: TaskRepeat }, now?: number): number | null;
export function setTaskDone<T extends TaskLike>(tasks: T[], id: string, done?: boolean, now?: number): T[];
export function monthGrid(year: number, monthIndex: number): Array<{ day: number; inMonth: boolean }>;
export function parseSteps(text: string): string[];
export function buildIcs(
  tasks: Array<TaskLike & { title: string; subjectId: string; note?: string; time?: string; priority?: TaskPriority }>,
  subjects?: Array<{ id: string; name: string }>,
  now?: number,
): string;
