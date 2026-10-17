export function runnableLanguage(lang: string): "python" | "javascript" | null;
export function isSitePage(code: string, lang: string): boolean;
export function mineCodeLanguage(lang: string): "python" | "javascript" | "html" | null;
