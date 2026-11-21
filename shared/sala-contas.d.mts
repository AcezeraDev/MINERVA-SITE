export type LinhaConferida = {
  linha: number;
  texto: string;
  tipo: "valor" | "igualdade" | "equacao" | "resposta" | "texto";
  ok?: boolean | null;
  valor?: number;
  variavel?: string;
  solucoes?: number[];
  detalhe?: string;
};
export function normalizarConta(linha: string): string;
export function conferirLinhas(texto: string): LinhaConferida[];
export function verificacaoParaMine(texto: string): string;
