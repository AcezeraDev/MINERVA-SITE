import type { QuizQuestion } from "./study-parsers.mjs";

export type StatusErro = "pendente" | "estudado" | "dominado";
export type EstudoErro = { erro: number; conceito: string; porque: string; aula: string; macete: string; irma: QuizQuestion };
export type ErroCaderno = {
  id: string;
  provaId: string;
  assunto: string;
  subjectId: string;
  questao: QuizQuestion;
  marcada: number | null;
  status: StatusErro;
  vezes: number;
  tentativas?: number;
  estudo?: EstudoErro;
  criadoEm: number;
  atualizadoEm: number;
};
export type ItemCorrigido = { indice: number; questao: QuizQuestion; marcada: number | null; certa: boolean };
export type ErroParaEstudo = { questao: QuizQuestion; marcada: number | null; assunto: string };

export const letrasProva: string[];
export const quantidadesProva: number[];
export const dificuldadesProva: Array<{ id: "facil" | "medio" | "dificil"; label: string; prompt: string }>;
export const limiteCaderno: number;
export function embaralharAlternativas(questao: QuizQuestion, semente?: number): QuizQuestion;
export function corrigirProva(
  questoes: QuizQuestion[],
  respostas: Array<number | null>,
): { itens: ItemCorrigido[]; acertos: number; total: number; erros: ItemCorrigido[]; nota: number };
export function anotarErros(
  caderno: ErroCaderno[],
  erros: ItemCorrigido[],
  meta: { provaId: string; assunto: string; subjectId?: string; agora?: number },
): ErroCaderno[];
export function registrarIrma(caderno: ErroCaderno[], id: string, acertou: boolean, agora?: number): ErroCaderno[];
export function resumoCaderno(caderno: ErroCaderno[]): {
  total: number;
  pendentes: number;
  dominados: number;
  assuntos: Array<{ assunto: string; quantos: number }>;
};
export function contextoEstudo(erros: ErroParaEstudo[]): string;
export function lerEstudo(text: string): EstudoErro[];
export const provaExemplo: { assunto: string; questoes: QuizQuestion[]; estudos: string };
