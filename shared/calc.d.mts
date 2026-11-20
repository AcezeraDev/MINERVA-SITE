export class CalcError extends Error {}
export function parse(source: string): unknown;
export function variablesOf(source: string): string[];
export function compile(source: string): (scope?: Record<string, number>) => number;
export function evaluate(source: string, scope?: Record<string, number>): number;
export function tidyNumber(value: number): string;
export function solveEquation(equation: string, variable?: string, options?: { min?: number; max?: number; steps?: number }): number[];
