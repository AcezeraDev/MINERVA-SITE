export type TextoMotivador =
  | { tipo: "texto"; titulo?: string; corpo: string[]; fonte: string }
  | { tipo: "lei"; titulo: string; corpo: string[]; fonte: string }
  | { tipo: "tabela"; titulo: string; colunas: string[]; linhas: string[][]; fonte: string }
  | { tipo: "lista"; titulo: string; itens: string[]; fonte: string };

export type PropostaRedacao = {
  id: string;
  numero: number;
  titulo: string;
  eixo: string;
  cor: string;
  textos: TextoMotivador[];
  repertorio: string[];
  genero: string;
  enunciado: string;
  /** Proposta que a Mine montou a partir do tema digitado. */
  criada?: boolean;
  temaDigitado?: string;
  criadaEm?: number;
};

export const GENERO_ENEM: string;
export const propostasRedacao: PropostaRedacao[];
export function apoioDaProposta(proposta: PropostaRedacao): string[];
export function elementosIntervencao(texto: string): { agente: boolean; acao: boolean; meio: boolean; finalidade: boolean; detalhamento: boolean };
export function montarPropostaCriada(resposta: unknown, opcoes?: { temaDigitado?: string; id?: string; numero?: number; criadaEm?: number }): PropostaRedacao | null;
