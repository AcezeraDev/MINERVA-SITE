export type EixoPyraminx = 0 | 1 | 2 | 3;
export type GiroPyraminx = { eixo: EixoPyraminx; camada: 1 | 2; q: 1 | -1 };
export type AdesivoPyraminx = { face: number; cor: number; localFace: number };
export type PecaPyraminx = {
  id: number;
  tipo: "tip" | "center" | "edge";
  slot: number[];
  slotInicial: number[];
  perm: [number, number, number, number];
  adesivos: AdesivoPyraminx[];
};
export type Pyraminx = { pecas: PecaPyraminx[] };

export const pyraminxVertices: Array<[number, number, number]>;
export const pyraminxEixos: ["U", "B", "R", "L"];
export const pyraminxCoresHex: string[];
export const pyraminxCorNomes: string[];

export function mapearIndice(i: number, eixo: EixoPyraminx, q: number): number;
export function criarPyraminx(): Pyraminx;
export function clonarPyraminx(p: Pyraminx): Pyraminx;
export function pecaNoGiroPyraminx(peca: PecaPyraminx, giro: GiroPyraminx): boolean;
export function aplicarGiroPyraminx(p: Pyraminx, giro: GiroPyraminx): Pyraminx;
export function aplicarGirosPyraminx(p: Pyraminx, giros: GiroPyraminx[]): Pyraminx;
export function estaResolvidoPyraminx(p: Pyraminx): boolean;
export function inversoPyraminx(giro: GiroPyraminx): GiroPyraminx;
export function simplificarPyraminx(giros: GiroPyraminx[]): GiroPyraminx[];
export function caminhoDeVoltaPyraminx(historico: GiroPyraminx[]): GiroPyraminx[];
export function notacaoPyraminx(giro: GiroPyraminx): string;
export function textoDosGirosPyraminx(giros: GiroPyraminx[]): string;
export function gerarEmbaralhamentoPyraminx(aleatorio?: () => number, tamanho?: number): GiroPyraminx[];
