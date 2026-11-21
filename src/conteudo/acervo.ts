/**
 * Biblioteca grátis (nov/2026): catálogo do Projeto Gutenberg (domínio
 * público) gerado por scripts/gerar-acervo.mjs em public/acervo/livros.json.
 * O catálogo é carregado uma vez e filtrado no navegador (busca instantânea);
 * só o texto do livro vem do servidor, por /api/acervo?id=.
 */
import { mineHeaders } from "../mineAuth";

export type LivroAcervo = {
  /** id do Projeto Gutenberg */
  i: number;
  /** título */
  t: string;
  /** autor (já no formato "Nome Sobrenome") */
  a: string;
  /** idioma: pt, es, en, fr… */
  l: string;
  /** gêneros em português (ver GENEROS) */
  g: string[];
};

export const GENEROS = [
  "Romance",
  "Contos",
  "Poesia",
  "Teatro",
  "Aventura",
  "Mistério",
  "Fantasia e ficção científica",
  "Terror",
  "Infantojuvenil",
  "História e biografia",
  "Filosofia",
  "Ciências",
  "Religião",
  "Viagens",
  "Outros",
] as const;

export const IDIOMAS: Record<string, string> = { pt: "Português", es: "Español", en: "English", fr: "Français" };

let catalogo: Promise<LivroAcervo[]> | null = null;

export function carregarAcervo(): Promise<LivroAcervo[]> {
  if (!catalogo) {
    catalogo = fetch("/acervo/livros.json")
      .then((response) => {
        if (!response.ok) throw new Error("catálogo indisponível");
        return response.json() as Promise<LivroAcervo[]>;
      })
      .catch((error) => {
        catalogo = null;
        throw error;
      });
  }
  return catalogo;
}

/** Capa pelo espelho oficial: o www.gutenberg.org recusa muitos acessos (503). */
export function capaAcervo(id: number): string {
  return `https://gutenberg.pglaf.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
}

export function dobrar(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const palavras = (value: string) => dobrar(value).split(" ").filter((word) => word.length > 2);

/**
 * Procura no catálogo o livro sugerido pela Mine: o título precisa bater
 * (70% das palavras) e, se veio autor, o sobrenome também.
 */
export function acharNoAcervo(lista: LivroAcervo[], titulo: string, autor: string): LivroAcervo | null {
  const alvo = palavras(titulo.replace(/\(.*?\)/g, ""));
  if (!alvo.length) return null;
  const sobrenome = palavras(autor).slice(-1)[0];
  let melhor: { livro: LivroAcervo; nota: number } | null = null;
  for (const livro of lista) {
    const tituloLivro = new Set(palavras(livro.t));
    const acertos = alvo.filter((word) => tituloLivro.has(word)).length / alvo.length;
    if (acertos < 0.7) continue;
    if (sobrenome && !dobrar(livro.a).includes(sobrenome)) continue;
    const nota = acertos + (livro.l === "pt" ? 0.2 : 0);
    if (!melhor || nota > melhor.nota) melhor = { livro, nota };
  }
  return melhor?.livro || null;
}

/** Texto do livro (sem a licença do Gutenberg), com cache por sessão de página. */
const textos = new Map<number, Promise<string>>();
export function textoDoAcervo(id: number): Promise<string> {
  if (!textos.has(id)) {
    const pedido = fetch(`/api/acervo?id=${id}`, { headers: mineHeaders() })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || typeof data.texto !== "string") throw new Error(data.error || "Não consegui abrir este livro agora.");
        return data.texto as string;
      })
      .catch((error) => {
        textos.delete(id);
        throw error;
      });
    textos.set(id, pedido);
  }
  return textos.get(id)!;
}

/**
 * Parágrafos para o leitor. O Gutenberg quebra as linhas em ~70 caracteres:
 * prosa volta a ser um parágrafo corrido; poesia (linhas curtas) mantém as
 * quebras de verso.
 */
export function paragrafos(texto: string): string[] {
  return texto
    .split(/\n[ \t]*\n+/)
    .map((bloco) => {
      const linhas = bloco.split("\n").map((linha) => linha.trimEnd());
      const curtas = linhas.filter((linha) => linha.trim().length && linha.trim().length < 48).length;
      const verso = linhas.length > 1 && curtas / linhas.length > 0.6;
      return verso ? linhas.map((linha) => linha.trim()).join("\n") : linhas.map((linha) => linha.trim()).join(" ").replace(/\s{2,}/g, " ");
    })
    // _itálico_ do texto puro sai sem os sublinhados; "--" de diálogo vira travessão.
    .map((bloco) => bloco.replace(/_([^_]+)_/g, "$1").replace(/--/g, "—").trim())
    .filter(Boolean);
}

/** Junta parágrafos em páginas de ~`tamanho` caracteres (parágrafo longo é dividido em frases). */
export function paginar(lista: string[], tamanho = 2200): string[][] {
  const paginas: string[][] = [];
  let atual: string[] = [];
  let soma = 0;
  const empurrar = (pedaco: string) => {
    if (soma + pedaco.length > tamanho && atual.length) {
      paginas.push(atual);
      atual = [];
      soma = 0;
    }
    atual.push(pedaco);
    soma += pedaco.length;
  };
  for (const paragrafo of lista) {
    if (paragrafo.length <= tamanho) {
      empurrar(paragrafo);
      continue;
    }
    let resto = "";
    for (const frase of paragrafo.split(/(?<=[.!?…])\s+/)) {
      if (resto.length + frase.length > tamanho && resto) {
        empurrar(resto.trim());
        resto = "";
      }
      resto += `${frase} `;
    }
    if (resto.trim()) empurrar(resto.trim());
  }
  if (atual.length) paginas.push(atual);
  return paginas;
}
