export type FileKind = "pdf" | "word" | "excel" | "html";
export type MineFile = { tipo: FileKind; titulo: string; corpo: string };
export type Sheet = { name: string; note?: string; rows: string[][] };

export function asksForFile(text: string): FileKind | "";
export function asksForStudySheet(text: string): boolean;
export function parseFileBlock(code: string): MineFile;
export function fileBaseName(titulo: string): string;
export function escapeHtml(value: unknown): string;
export function fileHtml(file: { titulo: string; corpo: string; tipo?: FileKind }, options?: { date?: Date }): string;
export function sheetsFromMarkdown(markdown: string): Sheet[];
export function sheetCsv(sheet: Sheet): string;
export function cellValue(raw: string):
  | { kind: "formula"; formula: string }
  | { kind: "number"; value: number; percent: boolean }
  | { kind: "text"; value: string };
export function excelFormula(formula: string): string;
export function displayRows(sheet: Sheet): string[][];
export function zipFiles(files: Record<string, string | Uint8Array>): Uint8Array<ArrayBuffer>;
export function xlsxFiles(file: { titulo: string; corpo: string }): Record<string, string>;
export function docxFiles(file: { titulo: string; corpo: string }, options?: { date?: Date }): Record<string, string>;
export function buildDocx(file: { titulo: string; corpo: string }, options?: { date?: Date }): Uint8Array<ArrayBuffer>;
export function buildXlsx(file: { titulo: string; corpo: string }): Uint8Array<ArrayBuffer>;
