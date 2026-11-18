export type PalavraDificil = { palavra: string; significado: string };
export type PerguntaLeitura = { pergunta: string; alternativas: string[]; correta: number; explicacao: string; trecho: string };
export type Leitura = {
  titulo: string;
  genero: string;
  resumo: string;
  ideias: string[];
  palavras: PalavraDificil[];
  perguntas: PerguntaLeitura[];
};

export const leituraMaxChars: number;
export const leituraMinPalavras: number;
export function contarPalavrasLeitura(texto: string): number;
export function minutosLeitura(texto: string): number;
export function limparTextoLeitura(texto: string): string;
export function lerLeitura(resposta: unknown, texto?: string): Leitura | null;
export function marcarPalavras(texto: string, palavras: PalavraDificil[]): Array<{ texto: string; marca: number }>;
export function contextoLeitura(input?: { titulo?: string; objetivo?: string }): string;
export const textosExemplo: Array<{ id: string; titulo: string; autor: string; texto: string }>;
