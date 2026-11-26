export type PalavraDificil = { palavra: string; significado: string };
export type PerguntaLeitura = { pergunta: string; alternativas: string[]; correta: number; explicacao: string; trecho: string; inconsistente?: boolean };
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
export function conferirGabarito(pergunta: { alternativas: string[]; correta: number; explicacao?: string; trecho?: string; resposta?: string }): { correta: number; inconsistente: boolean };
export function placarLeitura(perguntas: PerguntaLeitura[], respostas: number[], reportadas?: number[]): { acertos: number; total: number };
export function lerLeitura(resposta: unknown, texto?: string): Leitura | null;
export function marcarPalavras(texto: string, palavras: PalavraDificil[]): Array<{ texto: string; marca: number }>;
export function contextoLeitura(input?: { titulo?: string; objetivo?: string; nivel?: string }): string;
export const objetivosLeitura: Array<{ id: string; nome: string; contexto: string }>;
export const niveisLeitura: Array<{ id: string; nome: string; contexto: string }>;
export type Faixa = { inicio: number; fim: number };
export function acharTrecho(texto: string, trecho: string): Faixa | null;
export type SegmentoLeitura = { texto: string; inicio: number; marca: number; primeiro: boolean; prova: boolean; grifo: boolean };
export function segmentosLeitura(texto: string, palavras: PalavraDificil[], faixas?: Array<Faixa & { tipo: "prova" | "grifo" }>): SegmentoLeitura[];
export function juntarGrifos(grifos: Faixa[]): Faixa[];
export const textosExemplo: Array<{ id: string; titulo: string; autor: string; texto: string }>;
