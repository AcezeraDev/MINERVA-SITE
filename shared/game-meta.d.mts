export type GameAnswer = {
  id: string;
  prompt: string;
  userAnswer: string;
  correctAnswer: string;
  explanation?: string;
  correct: boolean;
  gameId?: string;
  gameName?: string;
  subjectId?: string;
  sessionId?: string;
  createdAt?: number;
};

export type GameSessionLike = {
  id?: string;
  kind?: string;
  title?: string;
  gameId?: string;
  gameName?: string;
  subjectId?: string;
  createdAt?: number;
  correctAnswers?: number;
  questionsAnswered?: number;
  xpEarned?: number;
  dailyChallenge?: boolean;
  dailyKey?: string;
  answers?: GameAnswer[];
  reviewedErrorIds?: string[];
  reviewCount?: number;
};

export type DailyQuestion = { id: string; prompt: string; options: string[]; answer: string; explanation: string };
export type League = { id: string; name: string; min: number; color: string; next: null | { id: string; name: string; min: number; color: string }; progress: number; points: number };

export const gameProgressionVersion: number;
export const gameNames: Readonly<Record<string, string>>;
export const gameAchievementRules: ReadonlyArray<{ id: string; name: string; description: string; icon: string }>;
export function dailyChallengeKey(value?: number | string | Date): string;
export function currentSeason(value?: number | string | Date): { id: string; name: string; startAt: number; endAt: number };
export function leagueFromPoints(points?: number): League;
export function gameSessions<T extends GameSessionLike>(sessions?: T[]): T[];
export function seasonPoints(sessions?: GameSessionLike[], value?: number | string | Date): number;
export function dailyChallengeQuestions(value?: number | string | Date, count?: number): DailyQuestion[];
export function reviewedErrorIds(sessions?: GameSessionLike[]): Set<string>;
export function unresolvedGameErrors(sessions?: GameSessionLike[]): GameAnswer[];
export function dailyMissionProgress(sessions?: GameSessionLike[], value?: number | string | Date): Array<{ id: string; title: string; description: string; current: number; goal: number; reward: number; completed: boolean }>;
export function unlockedGameAchievementIds(sessions?: GameSessionLike[], value?: number | string | Date): Set<string>;
