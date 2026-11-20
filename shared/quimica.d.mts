export class QuimicaError extends Error {}
export type Elemento = { symbol: string; name: string; mass: number; number: number };
export function element(query: string | number): Elemento | null;
export function parseFormula(formula: string): Record<string, number>;
export function molarMass(formula: string): { formula: string; massaMolar: number; unidade: string; elementos: { symbol: string; nome: string; quantidade: number; massaAtomica: number; subtotal: number }[] };
export function balance(equation: string): { equacao: string; coeficientes: { formula: string; coeficiente: number }[] };
