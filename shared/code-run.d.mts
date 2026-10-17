export function runnableLanguage(lang: string): "python" | "javascript" | null;
export function isSitePage(code: string, lang: string): boolean;
export function mineCodeLanguage(lang: string): "python" | "javascript" | "html" | null;
export function readCodeReply(text: string): { explanation: string; code: string; lang: "python" | "javascript" | "html" | null; open: boolean };
