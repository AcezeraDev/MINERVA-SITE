/** Ajudantes de "Mais da matéria" usados pela página e pela aba Livros. */

export const novoId = () => `x_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const texto = (value: unknown, max = 400) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** Texto corrido não renderiza LaTeX: troca os comandos comuns por símbolos. */
export function semLatex(value: string): string {
  return value
    .replace(/\\cdot/g, "·")
    .replace(/\\times/g, "×")
    .replace(/\\Delta/g, "Δ")
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2")
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/[{}$]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Tira cercas de código e pega do primeiro `[`/`{` até o último `]`/`}`. */
export function lerJson(reply: string): unknown {
  const limpo = reply.replace(/```(?:json)?/gi, "").trim();
  const inicio = limpo.search(/[[{]/);
  const fim = Math.max(limpo.lastIndexOf("]"), limpo.lastIndexOf("}"));
  if (inicio < 0 || fim < inicio) throw new Error("A Mine respondeu fora do formato. Tente de novo.");
  return JSON.parse(limpo.slice(inicio, fim + 1));
}

export function listaDe(value: unknown, chave: string): Record<string, unknown>[] {
  const lista = Array.isArray(value) ? value : value && typeof value === "object" ? (value as Record<string, unknown>)[chave] : null;
  return Array.isArray(lista) ? lista.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
}
