export type QuizQuestion = {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

export function parseQuiz(text: string): QuizQuestion[];
export function parseFlashcards(text: string): Array<{ front: string; back: string }>;
