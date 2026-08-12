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
