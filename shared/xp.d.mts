export type XpStatKey =
  | "subjects"
  | "materials"
  | "studied"
  | "tasksDone"
  | "focus"
  | "provas"
  | "games"
  | "gameXp"
  | "mineMessages"
  | "cardReviews"
  | "mastered"
  | "streakDays";

export type XpStats = Record<XpStatKey, number>;

export type AchievementRule = {
  id: string;
  title: string;
  text: string;
  xp: number;
  target: number;
  stat: XpStatKey;
};

/** As coleções de uma única conta. Campos ausentes contam como lista vazia. */
export type XpScope = {
  subjects?: Array<{ createdAt: number }>;
  materials?: Array<{ createdAt: number; studied?: boolean; studiedAt?: number }>;
  tasks?: Array<{ done?: boolean; doneAt?: number }>;
  chats?: Array<{ role: string; createdAt: number }>;
  sessions?: Array<{ kind: string; createdAt: number; xpEarned?: number }>;
  flashcards?: Array<{ reps?: number; level?: number; lastReviewedAt?: number }>;
};

export const dayMs: number;
export const xpPerAction: Record<
  "subject" | "material" | "studied" | "taskDone" | "focus" | "prova" | "game" | "mineMessage" | "cardReview",
  number
>;
export const xpActions: Array<[string, number]>;
export const levelTitles: ReadonlyArray<{ level: number; title: string }>;
export const achievementList: ReadonlyArray<AchievementRule>;

export function startOfDay(timestamp: number): number;
export function streakDays(sessions: Array<{ createdAt: number }>, now?: number): number;
export function gamificationStats(scope: XpScope, now?: number): XpStats;
export function unlockedAchievements(stats: XpStats): AchievementRule[];
export function totalXp(stats: XpStats): number;
export function levelFromXp(xp: number): { level: number; levelXp: number; levelNeed: number; title: string };
export function xpSince(scope: XpScope, since: number): number;
export function rankingWindows(now?: number): { day: number; week: number };
export function gameXpFromCorrectAnswers(correctAnswers: number): number;
