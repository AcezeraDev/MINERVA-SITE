export type LangWord = { en: string; pt: string; emoji: string };
export type LangPhrase = { en: string; pt: string };
export type LangScriptTurn = { mine: string; options: Array<{ en: string; ok: boolean }> };

export type LangUnit = {
  id: string;
  place: string;
  placeEn: string;
  emoji: string;
  color: "lilac" | "yellow" | "mint" | "pink";
  theme: string;
  role: string;
  rolePt: string;
  words: LangWord[];
  phrases: LangPhrase[];
  script: LangScriptTurn[];
};

export type ChoiceExercise = {
  kind: "escolha";
  mode: "figurinha" | "escuta" | "significado" | "complete";
  prompt: string;
  hint?: string;
  emoji: string;
  audio: string;
  options: string[];
  answer: string;
  word: string;
};
export type TilesExercise = { kind: "monte"; mode: "traduza" | "monte"; prompt: string; audio: string; tiles: string[]; answer: string[]; word: string };
export type PairsExercise = { kind: "pares"; pairs: Array<{ en: string; pt: string }>; left: string[]; right: string[]; word: string };
export type TypingExercise = { kind: "digite"; prompt: string; emoji: string; answer: string; word: string };
export type SpeakExercise = { kind: "fale"; text: string; pt: string; word: string };
export type Exercise = ChoiceExercise | TilesExercise | PairsExercise | TypingExercise | SpeakExercise;

export type Grade = "certo" | "quase" | "errado";
export type Outcome = { kind: Exercise["kind"] | "conversa"; result: Grade | "pulou"; word: string };

export type ConversationReply = { mine: string; correction: string; tip: string; score: number; suggestions: string[] };
export type LangLevel = { code: string; label: string };

export type LessonStep = { key: string; unitId: string; stage: number };

export type LanguageProgress = {
  path: LessonStep[];
  best: Record<string, { accuracy: number; stars: number }>;
  done: Set<string>;
  unlocked: Set<string>;
  next: LessonStep | null;
  stamps: string[];
  totals: { lessons: number; correct: number; answered: number; spoke: number; xp: number };
  learnedWords: number;
  level: LangLevel;
};

export type LessonResult = {
  correct: number;
  total: number;
  accuracy: number;
  stars: number;
  xp: number;
  wordsRight: string[];
  wordsMissed: string[];
  spoke: number;
};

type SessionLike = {
  kind: string;
  createdAt: number;
  lang?: string;
  lessonKey?: string;
  accuracy?: number;
  correctAnswers?: number;
  questionsAnswered?: number;
  spoke?: number;
  xpEarned?: number;
  wordsRight?: string[];
  wordsMissed?: string[];
};

export const englishUnits: LangUnit[];
export const lessonStages: Array<{ stage: number; id: string; label: string; hint: string }>;
export const conversationTurns: number;
export const passAccuracy: number;

export function lessonKey(unitId: string, stage: number, lang?: string): string;
export function lessonPath(units?: LangUnit[]): LessonStep[];
export function seededRandom(seed: number): () => number;
export function sentenceTiles(sentence: string): string[];
export function buildLesson(unit: LangUnit, stage: number, seed?: number, review?: string[]): Exercise[];
export function buildReviewLesson(missed: string[], seed?: number, units?: LangUnit[]): Exercise[];
export function normalizeAnswer(text: string): string;
export function editDistance(a: string, b: string): number;
export function gradeTyped(expected: string, given: string): Grade;
export function speechScore(expected: string, heard: string): number;
export function gradeSpeech(expected: string, heard: string): Grade;
export function checkExercise(exercise: Exercise, value: unknown): { result: Grade; expected: string };
export function countsAsRight(result: Grade | "pulou"): boolean;
export function parseConversationReply(text: string): ConversationReply | null;
export function conversationContext(unit: LangUnit, level: LangLevel): string;
export function vocabulary(units?: LangUnit[]): Set<string>;
export function starsFor(accuracy: number): number;
export function languageProgress(sessions: SessionLike[], units?: LangUnit[], lang?: string): LanguageProgress;
export function languageLevel(doneCount: number): LangLevel;
export function wordsToReview(sessions: SessionLike[], lang?: string, units?: LangUnit[]): string[];
export function lessonResult(outcomes: Outcome[]): LessonResult;
export function wordOfTheDay(now?: number, units?: LangUnit[]): LangWord & { unitId: string };
