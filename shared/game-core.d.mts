export type SequencePuzzle = {
  title: string;
  steps: string[];
  explanation: string;
};

export function parseSequencePuzzles(source: string): SequencePuzzle[];
export function moveSequenceItem<T>(items: T[], from: number, to: number): T[];
export function correctSequencePositions<T>(order: T[], answer: T[]): number;
export function connectionReward(streak: number): number;
export function sequenceReward(moves: number, attempts: number): number;
export function noveltyKey(value: string): string;
export function pickUnseen<T>(items: T[], keyOf: (item: T) => string, seenKeys: Iterable<string>): T[];
export function mergeSeen(previous: string[], incoming: string[], limit: number): string[];
