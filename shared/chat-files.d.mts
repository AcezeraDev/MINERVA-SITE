export type FileKind = "pdf" | "word" | "excel" | "html";
export type FileModel = "" | "pesquisa";
export type FileSource = { url: string; title: string; domain?: string; snippet?: string };
export type MineFile = {
  tipo: FileKind;
  titulo: string;
  corpo: string;
  modelo?: FileModel;
  subtitulo?: string;
  materia?: string;
  resumo?: string;
};
export type Sheet = { name: string; note?: string; rows: string[][] };
export type FileRenderOptions = { date?: Date; sources?: FileSource[]; queries?: string[] };

export function asksForFile(text: string): FileKind | "";
export function asksForStudySheet(text: string): boolean;
export function parseFileBlock(code: string): MineFile;
export function ensureDeepResearchFile(reply: string, options?: { prompt?: string; subjectName?: string }): string;
export function fileBaseName(titulo: string): string;
export function escapeHtml(value: unknown): string;
export function fileHtml(file: { titulo: string; corpo: string; tipo?: FileKind; modelo?: FileModel; subtitulo?: string; materia?: string; resumo?: string }, options?: FileRenderOptions): string;
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
export function docxFiles(file: { titulo: string; corpo: string; subtitulo?: string; materia?: string; resumo?: string }, options?: FileRenderOptions): Record<string, string>;
export function buildDocx(file: { titulo: string; corpo: string; subtitulo?: string; materia?: string; resumo?: string }, options?: FileRenderOptions): Uint8Array<ArrayBuffer>;
export function buildXlsx(file: { titulo: string; corpo: string }): Uint8Array<ArrayBuffer>;
