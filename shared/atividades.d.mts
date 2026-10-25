export type SecaoId = "aquecimento" | "treino" | "chegada";
type Base = { secao: SecaoId; enunciado: string; textoBase?: string; fonte?: string };
export type QuestaoOrdenar = Base & { tipo: "ordenar"; frase: string; palavras: string[] };
export type QuestaoLacunas = Base & { tipo: "lacunas"; texto: string; lacunas: Array<{ opcoes: string[]; correta: number }> };
export type QuestaoVF = Base & { tipo: "vf"; afirmacoes: Array<{ texto: string; verdadeira: boolean; explicacao: string }> };
export type QuestaoMultipla = Base & { tipo: "multipla"; alternativas: string[]; correta: number; explicacao?: string };
export type QuestaoLigar = Base & { tipo: "ligar"; pares: Array<{ esquerda: string; direita: string }> };
export type QuestaoCategorias = Base & { tipo: "categorias"; categorias: string[]; itens: Array<{ texto: string; categoria: number }> };
export type QuestaoSequencia = Base & { tipo: "sequencia"; itens: string[] };
export type QuestaoNumerica = Base & { tipo: "numerica"; resposta: number; tolerancia: number; unidade: string; explicacao: string };
export type QuestaoDissertativa = Base & { tipo: "dissertativa"; esperado: string; minimo: number };
export type Questao =
  | QuestaoOrdenar
  | QuestaoLacunas
  | QuestaoVF
  | QuestaoMultipla
  | QuestaoLigar
  | QuestaoCategorias
  | QuestaoSequencia
  | QuestaoNumerica
  | QuestaoDissertativa;
export type Atividade = { titulo: string; habilidade: string; introducao: string; questoes: Questao[] };
export type CorrecaoDissertativa = { nota: number; comentario: string; faltou: string; respostaModelo: string };

export const pontosPorQuestao: number;
export const secoes: Array<{ id: SecaoId; emoji: string; titulo: string }>;
export const materias: string[];
export const series: string[];
export const assuntosSugeridos: Record<string, string[]>;
export function normalizar(texto: string): string;
export function lerNumero(valor: unknown): number;
export function lerAtividade(resposta: unknown): Atividade | null;
export function embaralhar<T>(palavras: T[], semente?: number): Array<{ texto: T; indice: number }>;
export function corrigirObjetiva(questao: Questao, resposta: unknown): number;
export function respondida(questao: Questao, resposta: unknown): boolean;
export function lerCorrecaoDissertativa(resposta: unknown): CorrecaoDissertativa | null;
export function pontuar(questoes: Questao[], respostas: unknown[], correcoes?: Record<number, CorrecaoDissertativa | undefined>): { pontos: number; maximo: number; acertos: number };
export function contextoAtividade(input: { materia: string; serie: string; assunto?: string }): string;
export const atividadesExemplo: Array<{ materia: string; serie: string; titulo: string; habilidade: string; introducao: string; questoes: unknown[] }>;
