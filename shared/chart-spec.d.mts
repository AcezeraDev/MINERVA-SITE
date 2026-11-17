export type ChartKind = "bar" | "hbar" | "line" | "area" | "pie" | "donut" | "scatter";

export type ChartSeries = { name: string; values: Array<number | null>; points?: undefined } | { name: string; points: Array<[number, number]>; values?: undefined };

export type Chart = {
  kind: ChartKind;
  xy: boolean;
  title: string;
  subtitle: string;
  xLabel: string;
  yLabel: string;
  unit: string;
  source: string;
  stacked: boolean;
  labels: string[];
  series: ChartSeries[];
};

export const CHART_KINDS: ChartKind[];
export function toNumber(value: unknown): number | null;
export function parseChartSpec(source: string): { chart: Chart; error?: undefined } | { error: string; chart?: undefined };
export function niceTicks(min: number, max: number, count?: number): number[];
export function formatValue(value: number | null | undefined, unit?: string, options?: { compact?: boolean }): string;
export function chartToCsv(chart: Chart): string;
export function prepareSvg(source: string): string;
