export type GlossaryTerm = { term: string; def: string };
export type GlossaryPart = { type: "text"; text: string } | { type: "term"; text: string; term: string; def: string };

export const GLOSSARY_MARKER: RegExp;
export function extractGlossary(text: string): { text: string; terms: GlossaryTerm[] };
export function stripGlossary(text: string): string;
export const GLOSS_OPEN: string;
export const GLOSS_CLOSE: string;
export function markGlossary(markdown: string, terms: GlossaryTerm[]): string;
export function splitMarked(text: string): Array<{ type: "text" | "term"; text: string }>;
export function definitionOf(text: string, terms: GlossaryTerm[]): string;
export function splitGlossaryTerms(text: string, terms: GlossaryTerm[], used?: Set<string>): GlossaryPart[];
