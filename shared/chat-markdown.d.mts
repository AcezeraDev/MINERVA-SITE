export type CalloutKind = "tip" | "warning" | "important" | "example" | "definition" | "summary" | "fun" | "mistake" | "note";

export type InlineToken =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "math"; tex: string; display: boolean }
  | { type: "strong" | "em" | "mark" | "del"; children: InlineToken[] }
  | { type: "link"; href: string; children: InlineToken[] }
  | { type: "cite"; index: number };

export type ListBlock = { type: "list"; ordered: boolean; start: number; items: Array<{ text: string; children?: ListBlock[] }> };

export type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "rule" }
  | { type: "code"; lang: string; code: string; open: boolean }
  | { type: "math"; tex: string; open: boolean }
  | { type: "table"; header: string[]; align: Array<"left" | "right" | "center">; rows: string[][] }
  | { type: "callout"; kind: CalloutKind; title: string; children: Block[] }
  | { type: "quote"; children: Block[] }
  | ListBlock;

export const CALLOUT_TITLES: Record<CalloutKind, string>;
export function calloutKind(label: string): CalloutKind | null;
export function parseBlocks(text: string, options?: { streaming?: boolean }): Block[];
export function parseInline(text: string): InlineToken[];
export function labelOf(line: string): { label: string; rest: string } | null;
export function plainText(text: string): string;
