export type Competencia = { id: number; curta: string; texto: string };
export type TemaRedacao = { id: string; titulo: string; apoio: string[] };
export type NotaCompetencia = { id: number; nota: number; comentario: string };
export type TrechoMarcado = { trecho: string; tipo: "erro" | "acerto"; competencia: number; comentario: string; sugestao: string };
export type Correcao = { notas: NotaCompetencia[]; total: number; resumo: string; proximoPasso: string; trechos: TrechoMarcado[] };

export const competencias: Competencia[];
export const temasRedacao: TemaRedacao[];
export const degraus: number[];
export function contarPalavras(texto: string): number;
export function contarLinhas(texto: string, porLinha?: number): number;
export function contarParagrafos(texto: string): number;
export function situacaoFolha(texto: string): { linhas: number; ok: boolean; aviso: string };
export function arredondarDegrau(valor: unknown): number;
export function extrairJson(texto: string): any;
export function lerCorrecao(resposta: unknown, redacao?: string): Correcao | null;
export function marcarTrechos(texto: string, trechos: TrechoMarcado[]): Array<{ texto: string; marca: number }>;
export function faixaNota(total: number): string;
export function contextoCorrecao(input: { tema?: string; apoio?: string[]; titulo?: string; texto: string }): string;
