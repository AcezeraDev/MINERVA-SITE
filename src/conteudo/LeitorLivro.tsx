/**
 * Leitor da Mine (nov/2026): lê livros em domínio público (Projeto
 * Gutenberg e Wikisource) dentro do site.
 *
 * - Páginas MEDIDAS: os parágrafos são medidos num bloco escondido com a
 *   mesma largura e letra da página, e cada página recebe só o que cabe na
 *   altura da tela (nada de rolar dentro da página). Parágrafo que não cabe
 *   é partido em frases. Título de capítulo nunca fica sozinho no pé da página.
 * - Tela larga: livro aberto, duas páginas lado a lado, com cabeçalho corrido
 *   (título à esquerda, capítulo à direita), as folhas lidas empilhadas na
 *   borda esquerda e as que faltam na direita. Celular: uma página, com
 *   deslizar para virar.
 * - Ajustes ("Aa"): tamanho e tipo de letra (de livro ou a Atkinson, fácil de
 *   ler), espaço entre linhas, tema papel/sépia/escuro e modo foco (esconde os
 *   botões). Tudo guardado neste navegador, junto com a página onde parou.
 * - Ouvir: a voz do navegador lê as páginas e vira sozinha (src/conteudo/voz.ts).
 * - Selecionou um trecho: "Explicar" responde ali mesmo, sem sair do livro.
 * - Traduzir: livro que não é em português ganha o botão "Traduzir"; a Mine
 *   traduz as páginas na tela e já adianta as próximas (cache por página).
 *
 * Vai para o <body> por portal: a página da matéria tem cartões animados com
 * transform, e `position: fixed` dentro deles ficaria preso ao cartão.
 */
import "@fontsource-variable/literata/wght.css";
import { ChevronLeft, ChevronRight, Languages, Loader2, Maximize2, Minimize2, Minus, Pause, Plus, Sparkles, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { askMineTask } from "../mineTask";
import { IDIOMAS, paragrafos, textoDoAcervo } from "./acervo";
import { explicarTrecho } from "./explicar";
import { lerEmVoz, vozDisponivel } from "./voz";

export type LivroParaLer = { id: number; titulo: string; autor: string; /** pt, en, es… (sem idioma: não oferece tradução) */ idioma?: string; /** "Projeto Gutenberg", "Projeto Gutenberg Austrália" ou "Wikisource" */ fonte?: string };

const chave = (id: number) => `minerva-leitura-${id}`;
const PREFERENCIAS = "minerva-leitor-preferencias";

type Tema = "papel" | "sepia" | "escuro";
type Letra = "livro" | "clara";
type Preferencias = { fonte: number; tema: Tema; entrelinha: number; letra: Letra; foco: boolean };
const ENTRELINHAS = [
  { valor: 1.5, nome: "Junta" },
  { valor: 1.7, nome: "Normal" },
  { valor: 1.95, nome: "Solta" },
];
const TEMAS: { valor: Tema; nome: string }[] = [
  { valor: "papel", nome: "Papel" },
  { valor: "sepia", nome: "Sépia" },
  { valor: "escuro", nome: "Escuro" },
];

function lerPreferencias(): Preferencias {
  const padrao: Preferencias = { fonte: 19, tema: "papel", entrelinha: 1.7, letra: "livro", foco: false };
  try {
    const salvo = JSON.parse(localStorage.getItem(PREFERENCIAS) || "{}");
    // Antes de nov/2026 o tema era só `escuro: true/false`.
    const tema: Tema = salvo.tema === "sepia" || salvo.tema === "escuro" || salvo.tema === "papel" ? salvo.tema : salvo.escuro ? "escuro" : "papel";
    const entrelinha = ENTRELINHAS.some((item) => item.valor === Number(salvo.entrelinha)) ? Number(salvo.entrelinha) : padrao.entrelinha;
    return { fonte: Math.min(26, Math.max(15, Number(salvo.fonte) || 19)), tema, entrelinha, letra: salvo.letra === "clara" ? "clara" : "livro", foco: Boolean(salvo.foco) };
  } catch {
    return padrao;
  }
}

/** Tipo de cada parágrafo do livro: título de capítulo, subtítulo, 1º parágrafo do capítulo ou texto. */
type Tipo = "titulo" | "subtitulo" | "abertura" | "";
/** Um pedaço de página: o parágrafo (ou parte dele) e como ele aparece. */
type Bloco = { texto: string; tipo: Tipo; continua: boolean };
type Pagina = Bloco[];

const ROMANO = /^[IVXLCDM]{1,7}\.?$/;
const ABRE_TITULO = /^(cap[ií]tulo|chapter|cap\.|parte|part|livro|book|canto|ato|cena|pr[oó]logo|ep[ií]logo|pref[aá]cio|introdu[çc][ãa]o|advert[eê]ncia|dedicat[oó]ria|primeira parte|segunda parte|terceira parte|quarta parte)\b/i;

/** Linhas curtas que abrem capítulo: "XII", "Capítulo III: Golias", "PRIMEIRA PARTE". */
function tipos(lista: string[]): Tipo[] {
  const saida: Tipo[] = [];
  lista.forEach((bruto, indice) => {
    const texto = bruto.trim();
    const anterior = saida[indice - 1];
    const curto = !texto.includes("\n") && texto.length <= 80;
    const palavras = texto.split(/\s+/).length;
    // Linha toda em maiúsculas ("O SECULO") é título; endereço e data da folha
    // de rosto ("RUA MOREIRA CEZAR, 71") e palavras soltas ("POR") não.
    const maiusculas = /\p{Lu}{2}/u.test(texto) && !/\p{Ll}/u.test(texto) && texto.length >= 4 && texto.length <= 60 && palavras <= 9 && !/\d|,/.test(texto);
    if (curto && (ROMANO.test(texto) || /^\d{1,3}\.?$/.test(texto) || (ABRE_TITULO.test(texto) && palavras <= 12) || maiusculas)) {
      saida.push("titulo");
      return;
    }
    // "Do titulo." logo depois do "I": subtítulo do capítulo.
    if ((anterior === "titulo") && curto && texto.length <= 70 && palavras <= 9 && !/^[—–\-"“«]/.test(texto)) {
      saida.push("subtitulo");
      return;
    }
    saida.push(anterior === "titulo" || anterior === "subtitulo" ? "abertura" : "");
  });
  return saida;
}

function classeDo(bloco: Bloco): string {
  return [
    bloco.texto.includes("\n") ? "is-verso" : "",
    bloco.continua ? "is-continua" : "",
    bloco.tipo === "titulo" ? "is-titulo" : "",
    bloco.tipo === "subtitulo" ? "is-subtitulo" : "",
    bloco.tipo === "abertura" && !bloco.continua ? "is-abertura" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Reparte os parágrafos em páginas pela altura medida de cada um.
 * `alturas[i]` é a altura do parágrafo i sem margem; `margens[i]` é o espaço
 * acima dele quando não abre a página; `linha` é a altura de uma linha.
 */
function repartir(
  lista: string[],
  tiposDe: Tipo[],
  alturas: number[],
  margens: number[],
  alturaPagina: number,
  linha: number,
  /**
   * `medir(bloco)` põe o pedaço na sonda escondida e devolve a altura dele;
   * `ate(posicao)` diz a altura do começo do texto da sonda até aquela letra.
   */
  medicao: { medir: (bloco: Bloco) => number; ate: (posicao: number) => number },
): Pagina[] {
  const paginas: Pagina[] = [];
  let atual: Bloco[] = [];
  let usado = 0;
  const fechar = () => {
    if (atual.length) paginas.push(atual);
    atual = [];
    usado = 0;
  };
  lista.forEach((paragrafo, index) => {
    const tipo = tiposDe[index] || "";
    let resto = paragrafo;
    let altura = alturas[index] || 0;
    // Pedaço que continua um parágrafo da página anterior: sem recuo de 1ª linha.
    let continua = false;
    const margem = () => (atual.length ? margens[index] || 0 : 0);
    const verso = paragrafo.includes("\n");

    // Título e subtítulo puxam o texto junto: sem espaço para ao menos 3
    // linhas depois deles, vão para a página seguinte (com o título, se o
    // subtítulo é que não coube).
    if (tipo === "titulo" || tipo === "subtitulo") {
      const sobra = alturaPagina - usado - margem() - altura;
      if (atual.length && sobra < linha * (tipo === "titulo" ? 3 : 2)) {
        const titulo = tipo === "subtitulo" && atual[atual.length - 1]?.tipo === "titulo" ? atual.pop() : undefined;
        fechar();
        if (titulo) {
          atual.push(titulo);
          usado = alturas[index - 1] || linha;
        }
      }
    }

    while (resto) {
      const livre = alturaPagina - usado - margem();
      if (altura <= livre) {
        usado += margem() + altura;
        atual.push({ texto: resto, tipo, continua });
        return;
      }
      // Não cabe inteiro. Sobra menos de 2 linhas, ou o parágrafo é curto:
      // vai todo para a página seguinte (sem linha órfã no pé da página).
      if (livre < linha * 1.6 || resto.length < 120) {
        if (!atual.length) {
          // sozinho numa página e ainda grande demais: vai assim mesmo
          atual.push({ texto: resto, tipo, continua });
          fechar();
          return;
        }
        fechar();
        continue;
      }
      // Onde partir: o resto do parágrafo vai inteiro para a sonda (uma
      // medida só) e a busca binária entre as palavras (verso: entre versos)
      // lê onde termina a linha de cada palavra, sem medir de novo. As linhas
      // do começo de um parágrafo são as mesmas com ou sem o final dele.
      medicao.medir({ texto: resto, tipo, continua });
      const fronteiras: { corte: number; fimTexto: number }[] = [];
      for (const achado of resto.matchAll(verso ? /\n/g : /\s+/g)) fronteiras.push({ corte: (achado.index ?? 0) + achado[0].length, fimTexto: achado.index ?? 0 });
      let baixo = 0;
      let alto = fronteiras.length - 1;
      let melhor = -1;
      while (baixo <= alto) {
        const meio = (baixo + alto) >> 1;
        if (medicao.ate(fronteiras[meio].fimTexto) <= livre) {
          melhor = meio;
          baixo = meio + 1;
        } else alto = meio - 1;
      }
      let fim = melhor >= 0 ? fronteiras[melhor].corte : -1;
      // Prosa: se uma frase termina na mesma linha do corte, parte nela (fica
      // mais bonito e não desperdiça linha da página).
      if (!verso && fim > 0) {
        let frase: { corte: number; fimTexto: number } | null = null;
        for (const achado of resto.slice(0, fim).matchAll(/(?<=[.!?;:…])\s+/g)) frase = { corte: (achado.index ?? 0) + achado[0].length, fimTexto: achado.index ?? 0 };
        if (frase && medicao.ate(frase.fimTexto) >= medicao.ate(fronteiras[melhor].fimTexto) - 1) fim = frase.corte;
      }
      const pedaco = fim > 0 ? resto.slice(0, fim).trim() : "";
      if (!pedaco) {
        if (!atual.length) {
          atual.push({ texto: resto, tipo, continua });
          fechar();
          return;
        }
        fechar();
        continue;
      }
      atual.push({ texto: pedaco, tipo, continua });
      resto = resto.slice(fim).trim();
      altura = resto ? medicao.medir({ texto: resto, tipo, continua: true }) : 0;
      continua = true;
      fechar();
    }
  });
  fechar();
  return paginas;
}

const contarPalavras = (texto: string) => (texto.match(/[\p{L}\p{N}]+/gu) || []).length;

function tempoBr(minutos: number): string {
  if (minutos < 1) return "menos de 1 min";
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

const VOZ_DO_IDIOMA: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES", fr: "fr-FR" };

export function LeitorLivro({
  livro,
  fechar,
  perguntarMine,
  aoMudarPagina,
  aoInterpretar,
}: {
  livro: LivroParaLer;
  fechar: () => void;
  perguntarMine: (prompt: string) => void;
  /** Aba Leitura: o botão da Mine vira "Interpretar este trecho" e entrega o texto das páginas. */
  aoInterpretar?: (trecho: string) => void;
  /** Avisa a estante da matéria em que página o aluno está (ex.: "p. 12 de 180"). */
  aoMudarPagina?: (pagina: number, total: number) => void;
}) {
  const [estado, setEstado] = useState<{ status: "carregando" | "pronto" | "erro"; texto: string; erro?: string }>({ status: "carregando", texto: "" });
  const [preferencias, setPreferencias] = useState(lerPreferencias);
  const lista = useMemo(() => (estado.texto ? paragrafos(estado.texto) : []), [estado.texto]);
  const tiposDaLista = useMemo(() => tipos(lista), [lista]);
  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const [pagina, setPagina] = useState(0);
  const [duplo, setDuplo] = useState(false);
  const [traduzir, setTraduzir] = useState(false);
  const [traducoes, setTraducoes] = useState<Record<string, string | "erro" | "carregando">>({});
  const [ajustes, setAjustes] = useState(false);
  const [virada, setVirada] = useState<1 | -1 | 0>(0);
  const [ouvindo, setOuvindo] = useState(false);
  const [lendo, setLendo] = useState<{ pagina: number; bloco: number } | null>(null);
  const [selecao, setSelecao] = useState<{ texto: string; x: number; y: number } | null>(null);
  const [explicacao, setExplicacao] = useState<{ trecho: string; status: "carregando" | "pronto" | "erro"; texto: string } | null>(null);
  const palco = useRef<HTMLDivElement>(null);
  const molde = useRef<HTMLDivElement>(null);
  const medida = useRef<HTMLDivElement>(null);
  const sondaRef = useRef<HTMLDivElement>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const ajustesRef = useRef<HTMLDivElement>(null);
  const explicarRef = useRef<AbortController | null>(null);
  const [tamanho, setTamanho] = useState({ largura: 0, altura: 0 });
  const traduzivel = Boolean(livro.idioma && livro.idioma !== "pt");
  const nomeIdioma = livro.idioma ? IDIOMAS[livro.idioma] || livro.idioma : "";
  const temVoz = useMemo(vozDisponivel, []);

  useEffect(() => {
    let vivo = true;
    setEstado({ status: "carregando", texto: "" });
    textoDoAcervo(livro.id)
      .then((texto) => vivo && setEstado({ status: "pronto", texto }))
      .catch((error) => vivo && setEstado({ status: "erro", texto: "", erro: error instanceof Error ? error.message : "Não consegui abrir este livro agora." }));
    return () => {
      vivo = false;
    };
  }, [livro.id]);

  // Tamanho da área de leitura: decide uma ou duas páginas e a altura útil.
  useLayoutEffect(() => {
    const alvo = palco.current;
    if (!alvo) return;
    const medir = () => {
      const caixa = alvo.getBoundingClientRect();
      setDuplo(caixa.width >= 1000);
      setTamanho({ largura: Math.round(caixa.width), altura: Math.round(caixa.height) });
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);

  // A letra do livro (Literata) chega depois do texto: quando ela (ou a
  // "fácil de ler") termina de carregar, as larguras mudam e é preciso medir
  // de novo, senão a última linha da página fica cortada.
  const [fontes, setFontes] = useState(0);
  useEffect(() => {
    const lista = document.fonts;
    if (!lista) return;
    let vivo = true;
    const pronto = () => vivo && setFontes((n) => n + 1);
    void lista.ready.then(pronto);
    lista.addEventListener?.("loadingdone", pronto);
    return () => {
      vivo = false;
      lista.removeEventListener?.("loadingdone", pronto);
    };
  }, []);

  // Mede todos os parágrafos de uma vez e reparte em páginas.
  useLayoutEffect(() => {
    const folhaModelo = molde.current;
    const bloco = medida.current;
    if (!lista.length || !folhaModelo || !bloco || !tamanho.altura) return;
    const alturaPagina = folhaModelo.clientHeight;
    const filhos = Array.from(bloco.children) as HTMLElement[];
    const alturas = filhos.map((filho) => filho.getBoundingClientRect().height);
    // Margem de cima de cada parágrafo (título tem mais espaço que texto).
    const margens = filhos.map((filho) => parseFloat(getComputedStyle(filho).marginTop) || 0);
    const linha = parseFloat(getComputedStyle(bloco).lineHeight) || preferencias.fonte * preferencias.entrelinha;
    // Sonda: caixa própria e isolada (CSS `contain`) para medir os pedaços
    // partidos. Dentro do bloco com o livro inteiro, cada medida recalculava
    // milhares de parágrafos (13 s para paginar Dom Casmurro).
    const caixaSonda = sondaRef.current;
    if (!caixaSonda) return;
    const sonda = document.createElement("p");
    caixaSonda.replaceChildren(sonda);
    const faixa = document.createRange();
    let topo = 0;
    let alturaSonda = 0;
    const medir = (pedaco: Bloco) => {
      const classe = classeDo(pedaco);
      if (sonda.className !== classe) sonda.className = classe;
      if (sonda.textContent !== pedaco.texto) sonda.textContent = pedaco.texto;
      const caixa = sonda.getBoundingClientRect();
      topo = caixa.top;
      alturaSonda = caixa.height;
      linhaSonda = parseFloat(getComputedStyle(sonda).lineHeight) || linha;
      return alturaSonda;
    };
    let linhaSonda = linha;
    // Só lê a posição da linha (o texto já está medido): não recalcula nada.
    const ate = (posicao: number) => {
      const texto = sonda.firstChild;
      if (!texto) return alturaSonda;
      faixa.setStart(texto, 0);
      faixa.setEnd(texto, Math.min(Math.max(posicao, 1), texto.textContent?.length || 0));
      const linhas = faixa.getClientRects();
      const ultima = linhas[linhas.length - 1];
      // A caixa da letra é mais baixa que a linha: soma a metade do entrelinha.
      return ultima ? ultima.bottom + Math.max(0, linhaSonda - ultima.height) / 2 - topo : alturaSonda;
    };
    // Folga pequena (1/4 de linha) só para arredondamentos de pixel.
    const novas = repartir(lista, tiposDaLista, alturas, margens, alturaPagina - linha * 0.25, linha, { medir, ate });
    caixaSonda.replaceChildren();
    setPaginas(novas);
  }, [lista, tiposDaLista, tamanho, preferencias.fonte, preferencias.entrelinha, preferencias.letra, preferencias.foco, duplo, fontes]);

  // Volta para onde parou: progresso guardado como fração do livro, que
  // continua valendo quando a letra ou a tela mudam o número de páginas.
  useEffect(() => {
    if (!paginas.length) return;
    let fracao = 0;
    try {
      fracao = Number(JSON.parse(localStorage.getItem(chave(livro.id)) || "{}").fracao) || 0;
    } catch {
      fracao = 0;
    }
    const alvo = Math.min(paginas.length - 1, Math.max(0, Math.round(fracao * (paginas.length - 1))));
    setVirada(0);
    setPagina(duplo ? alvo - (alvo % 2) : alvo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginas, livro.id]);

  useEffect(() => {
    if (!paginas.length) return;
    try {
      localStorage.setItem(chave(livro.id), JSON.stringify({ fracao: paginas.length > 1 ? pagina / (paginas.length - 1) : 0, em: Date.now() }));
    } catch {
      // sem armazenamento (aba anônima): só não lembra a página
    }
    aoMudarPagina?.(Math.min(pagina + (duplo ? 2 : 1), paginas.length), paginas.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, paginas.length]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFERENCIAS, JSON.stringify(preferencias));
    } catch {
      // ignora
    }
  }, [preferencias]);

  const passo = duplo ? 2 : 1;
  const total = paginas.length;
  const virar = useCallback(
    (direcao: 1 | -1) => {
      setSelecao(null);
      setVirada(direcao);
      setPagina((atual) => Math.min(Math.max(atual + direcao * passo, 0), Math.max(total - 1, 0) - (duplo ? (Math.max(total - 1, 0) % 2) : 0)));
    },
    [passo, total, duplo],
  );

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    fecharRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      anterior?.focus?.();
      explicarRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Esc fecha primeiro o que está por cima: ajustes, explicação, seleção.
        if (ajustes) return setAjustes(false);
        if (explicacao) return setExplicacao(null);
        if (selecao) return setSelecao(null);
        return fechar();
      }
      const alvo = event.target as HTMLElement | null;
      if (alvo && /input|textarea|select/i.test(alvo.tagName)) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") virar(1);
      if (event.key === "ArrowLeft" || event.key === "PageUp") virar(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fechar, virar, ajustes, explicacao, selecao]);

  // Painel "Aa": fecha ao clicar fora.
  useEffect(() => {
    if (!ajustes) return;
    const fora = (event: PointerEvent) => {
      if (!ajustesRef.current?.contains(event.target as Node)) setAjustes(false);
    };
    window.addEventListener("pointerdown", fora);
    return () => window.removeEventListener("pointerdown", fora);
  }, [ajustes]);

  // Deslizar no celular.
  const toque = useRef<number | null>(null);

  // ── Tradução ──
  const chaveDe = (indice: number, conteudo: Pagina | undefined) => `${indice}:${(conteudo || []).map((b) => b.texto).join("").length}:${(conteudo?.[0]?.texto || "").slice(0, 24)}`;
  const traduzirPagina = useCallback(
    (indice: number) => {
      const conteudo = paginas[indice];
      if (!conteudo?.length) return;
      const k = chaveDe(indice, conteudo);
      setTraducoes((atual) => {
        if (atual[k] && atual[k] !== "erro") return atual;
        void askMineTask({ task: "traducao", prompt: conteudo.map((parte) => parte.texto).join("\n\n"), context: `${livro.titulo}${livro.autor ? `, de ${livro.autor}` : ""}`, outputTokens: 2400 })
          .then((traducao) => setTraducoes((depois) => ({ ...depois, [k]: traducao.trim() })))
          .catch(() => setTraducoes((depois) => ({ ...depois, [k]: "erro" })));
        return { ...atual, [k]: "carregando" };
      });
    },
    [paginas, livro.titulo, livro.autor],
  );

  // Traduz as páginas na tela e adianta as próximas.
  // Espera um instante: virar várias páginas seguidas ou girar a tela não
  // dispara uma tradução para cada página que só passou pela tela.
  useEffect(() => {
    if (!traduzir || !total) return;
    const timer = window.setTimeout(() => {
      for (let indice = pagina; indice < Math.min(pagina + passo * 2, total); indice += 1) traduzirPagina(indice);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [traduzir, pagina, passo, total, traduzirPagina]);

  const tentarDeNovo = () => {
    setTraducoes((atual) => Object.fromEntries(Object.entries(atual).filter(([, valor]) => valor !== "erro")));
    for (let indice = pagina; indice < Math.min(pagina + passo, total); indice += 1) traduzirPagina(indice);
  };

  // Letra ou tela mudaram: as páginas mudam e as traduções antigas não servem mais.
  useEffect(() => setTraducoes({}), [paginas]);

  function textoDaPagina(indice: number): { texto: Bloco[]; status: "original" | "carregando" | "erro" | "traduzido" } {
    const original = paginas[indice] || [];
    if (!traduzir) return { texto: original, status: "original" };
    const valor = traducoes[chaveDe(indice, original)];
    if (!valor || valor === "carregando") return { texto: original, status: "carregando" };
    if (valor === "erro") return { texto: original, status: "erro" };
    return { texto: valor.split(/\n[ \t]*\n+/).filter(Boolean).map((texto) => ({ texto, tipo: "" as Tipo, continua: false })), status: "traduzido" };
  }

  // A tradução costuma sair mais longa que o original: diminui um pouco a
  // letra da página traduzida até caber (no máximo 18%); se nem assim couber,
  // a página rola em vez de cortar a última linha.
  useLayoutEffect(() => {
    const alvo = palco.current;
    if (!alvo) return;
    alvo.querySelectorAll<HTMLElement>(".leitor-mine-livro > .leitor-mine-pagina .leitor-mine-texto").forEach((texto) => {
      texto.style.fontSize = "";
      texto.style.overflowY = "";
      if (!texto.closest(".is-traduzido")) return;
      let escala = 1;
      while (texto.scrollHeight > texto.clientHeight + 1 && escala > 0.83) {
        escala -= 0.03;
        texto.style.fontSize = `calc(var(--fonte) * ${escala.toFixed(2)})`;
      }
      if (texto.scrollHeight > texto.clientHeight + 1) texto.style.overflowY = "auto";
    });
  });

  // ── Capítulos: em que capítulo cada página está e quantas palavras tem ──
  const capitulos = useMemo(() => {
    const nomes: string[] = [];
    const ids: number[] = [];
    const palavras: number[] = [];
    let nome = "";
    let id = 0;
    paginas.forEach((conteudo, indice) => {
      conteudo.forEach((bloco, j) => {
        if (bloco.tipo === "titulo" && !bloco.continua) {
          id += 1;
          const seguinte = conteudo[j + 1] || paginas[indice + 1]?.[0];
          nome = seguinte?.tipo === "subtitulo" ? `${bloco.texto} · ${seguinte.texto}` : bloco.texto;
        }
      });
      nomes.push(nome);
      ids.push(id);
      palavras.push(conteudo.reduce((soma, bloco) => soma + contarPalavras(bloco.texto), 0));
    });
    return { nomes, ids, palavras };
  }, [paginas]);

  const ultima = Math.min(pagina + passo, total);
  const porcento = total > 1 ? Math.round((Math.min(pagina + passo - 1, total - 1) / (total - 1)) * 100) : 0;
  const visiveis = [pagina, pagina + 1].slice(0, passo);
  const traduzindo = traduzir && visiveis.some((indice) => indice < total && textoDaPagina(indice).status === "carregando");
  const falhou = traduzir && visiveis.some((indice) => indice < total && textoDaPagina(indice).status === "erro");
  const capituloAtual = capitulos.nomes[Math.min(ultima - 1, total - 1)] || "";

  // Minutos (200 palavras por minuto) até o fim do capítulo e do livro.
  const faltam = useMemo(() => {
    if (!total) return { capitulo: 0, livro: 0, temCapitulo: false };
    const id = capitulos.ids[Math.min(ultima - 1, total - 1)];
    let capitulo = 0;
    let resto = 0;
    for (let indice = ultima; indice < total; indice += 1) {
      resto += capitulos.palavras[indice];
      if (capitulos.ids[indice] === id) capitulo += capitulos.palavras[indice];
    }
    return { capitulo: Math.round(capitulo / 200), livro: Math.round(resto / 200), temCapitulo: id > 0 && capitulos.ids.some((outro) => outro > id) };
  }, [capitulos, ultima, total]);

  // ── Ouvir: lê as páginas na tela e vira sozinho no fim ──
  useEffect(() => {
    if (!ouvindo || !total) return;
    const fila: { pagina: number; bloco: number; texto: string }[] = [];
    for (const indice of visiveis) {
      if (indice >= total) continue;
      textoDaPagina(indice).texto.forEach((bloco, j) => fila.push({ pagina: indice, bloco: j, texto: bloco.texto }));
    }
    const leitura = lerEmVoz(
      fila.map((item) => item.texto),
      {
        idioma: traduzir ? "pt-BR" : VOZ_DO_IDIOMA[livro.idioma || "pt"] || "pt-BR",
        aoParagrafo: (i) => setLendo({ pagina: fila[i].pagina, bloco: fila[i].bloco }),
        aoAcabar: (completo) => {
          setLendo(null);
          if (!completo) return;
          if (ultima < total) virar(1);
          else setOuvindo(false);
        },
      },
    );
    return () => leitura.parar();
    // Só recomeça quando a página muda (não a cada tradução que chega).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvindo, pagina, paginas, traduzir]);

  // ── Seleção: mini barra em cima do trecho marcado ──
  const lerSelecao = () => {
    window.setTimeout(() => {
      const sel = window.getSelection?.();
      const texto = String(sel || "").replace(/\s+/g, " ").trim();
      if (!sel || sel.isCollapsed || texto.length < 2 || !palco.current?.contains(sel.anchorNode)) {
        setSelecao(null);
        return;
      }
      const caixa = sel.getRangeAt(0).getBoundingClientRect();
      setSelecao({ texto: texto.slice(0, 1800), x: Math.min(Math.max(caixa.left + caixa.width / 2, 120), window.innerWidth - 120), y: Math.max(caixa.top, 70) });
    }, 0);
  };

  const explicar = async (trecho: string) => {
    setSelecao(null);
    window.getSelection?.()?.removeAllRanges();
    explicarRef.current?.abort();
    const controller = new AbortController();
    explicarRef.current = controller;
    setExplicacao({ trecho, status: "carregando", texto: "" });
    try {
      const texto = await explicarTrecho(trecho, { titulo: livro.titulo, autor: livro.autor, palavra: trecho.split(/\s+/).length <= 4, signal: controller.signal });
      if (!controller.signal.aborted) setExplicacao({ trecho, status: "pronto", texto });
    } catch (error) {
      if (!controller.signal.aborted) setExplicacao({ trecho, status: "erro", texto: error instanceof Error ? error.message : "A Mine não respondeu agora." });
    }
  };

  function perguntar() {
    const selecionado = String(window.getSelection?.() || "").trim();
    if (aoInterpretar) {
      // Interpretação precisa de texto suficiente: a página na tela e as
      // seguintes até ~2.500 caracteres (ou o trecho selecionado, se for grande).
      const partes: string[] = [];
      for (let indice = pagina; indice < total && partes.join("\n\n").length < 2500; indice += 1) {
        partes.push(...textoDaPagina(indice).texto.map((parte) => parte.texto));
      }
      const trecho = selecionado.length > 600 ? selecionado : partes.join("\n\n");
      aoInterpretar(trecho.slice(0, 6000));
      fechar();
      return;
    }
    const textoVisivel = visiveis.flatMap((indice) => textoDaPagina(indice).texto.map((parte) => parte.texto));
    const trecho = (selecionado || textoVisivel.join("\n\n")).slice(0, 1800);
    if (!trecho) return;
    perguntarMine(`Explique de forma simples este trecho do livro "${livro.titulo}"${livro.autor ? `, de ${livro.autor}` : ""}: o que acontece, palavras difíceis e o contexto da obra.\n\n"""\n${trecho}\n"""`);
    fechar();
  }

  const mudar = (parcial: Partial<Preferencias>) => setPreferencias((atual) => ({ ...atual, ...parcial }));
  const estilo = {
    "--fonte": `${preferencias.fonte}px`,
    "--entrelinha": String(preferencias.entrelinha),
    "--lido": String(total > 1 ? Math.min(pagina + passo - 1, total - 1) / (total - 1) : 0),
  } as CSSProperties;

  return createPortal(
    <div
      className={`leitor-mine tema-${preferencias.tema} letra-${preferencias.letra} ${preferencias.foco ? "is-foco" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Lendo ${livro.titulo}`}
      style={estilo}
    >
      <header className="leitor-mine-topo">
        <div className="leitor-mine-obra">
          <p className="leitor-mine-fonte">
            domínio público · {livro.fonte || "Projeto Gutenberg"}
            {nomeIdioma ? ` · ${nomeIdioma}` : ""}
          </p>
          <h2>{livro.titulo}</h2>
          {livro.autor ? <p className="leitor-mine-autor">{livro.autor}</p> : null}
        </div>
        {traduzivel ? (
          <button type="button" onClick={() => setTraduzir((atual) => !atual)} aria-pressed={traduzir} className="leitor-mine-chip" title={traduzir ? "Voltar para o texto original" : "A Mine traduz as páginas para o português"}>
            {traduzindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
            {traduzir ? "Ver original" : "Traduzir"}
          </button>
        ) : null}
        {temVoz ? (
          <button
            type="button"
            onClick={() => setOuvindo((atual) => !atual)}
            aria-pressed={ouvindo}
            className="leitor-mine-chip"
            title={ouvindo ? "Parar a leitura em voz alta" : "Ouvir: a voz do navegador lê as páginas e vira sozinha"}
            disabled={!total}
          >
            {ouvindo ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {ouvindo ? "Pausar" : "Ouvir"}
          </button>
        ) : null}
        <div className="leitor-mine-ajustes-wrap" ref={ajustesRef}>
          <button type="button" className="leitor-mine-chip leitor-mine-aa" onClick={() => setAjustes((atual) => !atual)} aria-expanded={ajustes} aria-haspopup="dialog" title="Letra, espaço e tema">
            <span aria-hidden>Aa</span>
            <span className="sr-only">Ajustes de leitura</span>
          </button>
          {ajustes ? (
            <div className="leitor-mine-painel" role="dialog" aria-label="Ajustes de leitura">
              <p className="leitor-mine-painel-rotulo">Tamanho da letra</p>
              <div className="leitor-mine-tamanho">
                <button type="button" onClick={() => mudar({ fonte: Math.max(15, preferencias.fonte - 1) })} aria-label="Letra menor" disabled={preferencias.fonte <= 15}>
                  <Minus className="h-4 w-4" />
                </button>
                <span className="tabular" aria-live="polite">
                  {preferencias.fonte}
                </span>
                <button type="button" onClick={() => mudar({ fonte: Math.min(26, preferencias.fonte + 1) })} aria-label="Letra maior" disabled={preferencias.fonte >= 26}>
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <p className="leitor-mine-painel-rotulo">Letra</p>
              <div className="leitor-mine-opcoes" role="radiogroup" aria-label="Letra">
                <button type="button" role="radio" aria-checked={preferencias.letra === "livro"} onClick={() => mudar({ letra: "livro" })} className="is-livro">
                  <strong>Aa</strong> De livro
                </button>
                <button type="button" role="radio" aria-checked={preferencias.letra === "clara"} onClick={() => mudar({ letra: "clara" })} className="is-clara" title="Atkinson Hyperlegible: letras bem diferentes umas das outras, boa para dislexia">
                  <strong>Aa</strong> Fácil de ler
                </button>
              </div>
              <p className="leitor-mine-painel-rotulo">Espaço entre linhas</p>
              <div className="leitor-mine-opcoes is-tres" role="radiogroup" aria-label="Espaço entre linhas">
                {ENTRELINHAS.map((item) => (
                  <button key={item.valor} type="button" role="radio" aria-checked={preferencias.entrelinha === item.valor} onClick={() => mudar({ entrelinha: item.valor })}>
                    <span className="leitor-mine-linhas" style={{ gap: `${(item.valor - 1.2) * 6}px` }} aria-hidden>
                      <i />
                      <i />
                      <i />
                    </span>
                    {item.nome}
                  </button>
                ))}
              </div>
              <p className="leitor-mine-painel-rotulo">Tema</p>
              <div className="leitor-mine-opcoes is-tres" role="radiogroup" aria-label="Tema">
                {TEMAS.map((item) => (
                  <button key={item.valor} type="button" role="radio" aria-checked={preferencias.tema === item.valor} onClick={() => mudar({ tema: item.valor })}>
                    <span className={`leitor-mine-amostra is-${item.valor}`} aria-hidden>
                      Aa
                    </span>
                    {item.nome}
                  </button>
                ))}
              </div>
              <label className="leitor-mine-foco-opcao">
                <input type="checkbox" checked={preferencias.foco} onChange={(event) => mudar({ foco: event.target.checked })} />
                <span>
                  <strong>Modo foco</strong> esconde os botões enquanto você lê
                </span>
              </label>
            </div>
          ) : null}
        </div>
        <button ref={fecharRef} type="button" onClick={fechar} className="leitor-mine-fechar" aria-label="Fechar o livro" title="Fechar (Esc)">
          <X className="h-5 w-5" />
        </button>
      </header>

      {preferencias.foco ? (
        <div className="leitor-mine-foco-barra">
          <button type="button" onClick={() => mudar({ foco: false })} title="Mostrar os botões">
            <Minimize2 className="h-4 w-4" /> sair do foco
          </button>
          <button type="button" onClick={fechar} aria-label="Fechar o livro">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div
        className="leitor-mine-palco"
        ref={palco}
        onMouseUp={lerSelecao}
        onTouchStart={(event) => {
          toque.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const inicio = toque.current;
          const fim = event.changedTouches[0]?.clientX;
          toque.current = null;
          lerSelecao();
          if (String(window.getSelection?.() || "").trim()) return;
          if (inicio === null || fim === undefined || Math.abs(fim - inicio) < 50) return;
          virar(fim < inicio ? 1 : -1);
        }}
      >
        <div className={`leitor-mine-livro ${duplo ? "is-duplo" : ""}`}>
          {estado.status !== "pronto" || !total ? (
            <p className="leitor-mine-aviso">
              {estado.status === "erro" ? (
                estado.erro
              ) : (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> abrindo o livro…
                </>
              )}
            </p>
          ) : (
            <>
              <button type="button" className="leitor-mine-borda is-esquerda" onClick={() => virar(-1)} disabled={pagina === 0} aria-label="Página anterior" />
              {visiveis.map((indice, lado) => {
                const { texto, status } = textoDaPagina(indice);
                const esquerda = duplo && lado === 0;
                // A folha que "vira": a da direita indo para a frente, a da esquerda voltando.
                const anima = virada === 0 ? "" : virada === 1 ? (esquerda ? "vira-fade" : "vira-frente") : esquerda || !duplo ? "vira-tras" : "vira-fade";
                const cabeca = esquerda || !capitulos.nomes[indice] ? livro.titulo : capitulos.nomes[indice];
                return (
                  <article
                    key={`${indice}-${virada}`}
                    className={`leitor-mine-pagina ${duplo ? (esquerda ? "is-esquerda" : "is-direita") : ""} ${anima} ${status === "carregando" ? "is-traduzindo" : status === "traduzido" ? "is-traduzido" : ""}`}
                    lang={status === "traduzido" ? "pt-BR" : livro.idioma || undefined}
                  >
                    {indice < total ? (
                      <>
                        <p className="leitor-mine-cabeca" aria-hidden>
                          {cabeca}
                        </p>
                        <div className="leitor-mine-texto">
                          {texto.map((bloco, ordem) => (
                            <p key={`${indice}-${ordem}`} className={`${classeDo(bloco)} ${lendo?.pagina === indice && lendo.bloco === ordem ? "is-lendo" : ""}`}>
                              {bloco.texto}
                            </p>
                          ))}
                        </div>
                        <span className="leitor-mine-numero tabular">{indice + 1}</span>
                      </>
                    ) : (
                      <div className="leitor-mine-fim">
                        <p>fim</p>
                      </div>
                    )}
                  </article>
                );
              })}
              <button type="button" className="leitor-mine-borda is-direita" onClick={() => virar(1)} disabled={ultima >= total} aria-label="Próxima página" />
            </>
          )}

          {/* Molde invisível DENTRO do livro (mesmo tamanho exato): mede a altura útil e cada parágrafo. */}
          <div className="leitor-mine-molde" aria-hidden>
            <article className="leitor-mine-pagina">
              <p className="leitor-mine-cabeca">0</p>
              {/* área útil da página: a altura que cada página pode ocupar */}
              <div className="leitor-mine-texto leitor-mine-area" ref={molde} />
              <span className="leitor-mine-numero tabular">0</span>
              {/* todos os parágrafos, na mesma largura, só para medir */}
              <div className="leitor-mine-texto leitor-mine-medida" ref={medida}>
                {lista.map((paragrafo, index) => (
                  <p key={index} className={classeDo({ texto: paragrafo, tipo: tiposDaLista[index], continua: false })}>
                    {paragrafo}
                  </p>
                ))}
              </div>
              {/* sonda isolada: mede pedaços de parágrafo um de cada vez */}
              <div className="leitor-mine-texto leitor-mine-medida leitor-mine-sonda" ref={sondaRef} />
            </article>
          </div>
        </div>
      </div>

      {selecao ? (
        <div className="leitor-mine-selecao" style={{ left: selecao.x, top: selecao.y }} role="toolbar" aria-label="Trecho selecionado" onMouseDown={(event) => event.preventDefault()}>
          <button type="button" onClick={() => explicar(selecao.texto)}>
            <Sparkles className="h-4 w-4" /> {selecao.texto.split(/\s+/).length <= 4 ? "O que significa?" : "Explicar"}
          </button>
          {temVoz ? (
            <button
              type="button"
              onClick={() => {
                setOuvindo(false);
                lerEmVoz([selecao.texto], { idioma: VOZ_DO_IDIOMA[livro.idioma || "pt"] || "pt-BR" });
                setSelecao(null);
              }}
            >
              <Volume2 className="h-4 w-4" /> Ouvir
            </button>
          ) : null}
          {aoInterpretar && selecao.texto.length >= 300 ? (
            <button
              type="button"
              onClick={() => {
                aoInterpretar(selecao.texto.slice(0, 6000));
                fechar();
              }}
            >
              Interpretar
            </button>
          ) : null}
        </div>
      ) : null}

      {explicacao ? (
        <aside className="leitor-mine-explica" aria-live="polite">
          <header>
            <span className="leitor-mine-explica-mine" aria-hidden>
              <Sparkles className="h-4 w-4" />
            </span>
            <p>
              <strong>Mine</strong>
              <span>sobre “{explicacao.trecho.length > 70 ? `${explicacao.trecho.slice(0, 70)}…` : explicacao.trecho}”</span>
            </p>
            <button type="button" onClick={() => setExplicacao(null)} aria-label="Fechar a explicação">
              <X className="h-4 w-4" />
            </button>
          </header>
          {explicacao.status === "carregando" ? (
            <p className="leitor-mine-explica-texto is-carregando">
              <Loader2 className="h-4 w-4 animate-spin" /> pensando…
            </p>
          ) : (
            <p className={`leitor-mine-explica-texto ${explicacao.status === "erro" ? "is-erro" : ""}`}>{explicacao.texto}</p>
          )}
          {explicacao.status === "erro" ? (
            <button type="button" className="leitor-mine-tentar" onClick={() => explicar(explicacao.trecho)}>
              tentar de novo
            </button>
          ) : null}
        </aside>
      ) : null}

      <footer className="leitor-mine-rodape">
        <button type="button" onClick={() => virar(-1)} disabled={pagina === 0 || !total} className="leitor-mine-virar" aria-label="Página anterior">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="leitor-mine-progresso">
          <p className="leitor-mine-capitulo">
            {total ? (
              <>
                <span className="leitor-mine-capitulo-nome">{capituloAtual || livro.titulo}</span>
                <span className="leitor-mine-capitulo-falta">
                  {faltam.temCapitulo ? `${tempoBr(faltam.capitulo)} até o fim do capítulo` : `${tempoBr(faltam.livro)} até o fim do livro`}
                </span>
              </>
            ) : (
              "…"
            )}
          </p>
          <input
            type="range"
            min={0}
            max={Math.max(total - 1, 0)}
            step={passo}
            value={pagina}
            onChange={(event) => {
              const valor = Number(event.target.value);
              setVirada(0);
              setPagina(duplo ? valor - (valor % 2) : valor);
            }}
            disabled={!total}
            aria-label="Ir para a página"
            style={{ "--progresso": `${porcento}%` } as CSSProperties}
          />
          <span className="tabular leitor-mine-pagina-de">
            {total ? `${passo === 2 && ultima > pagina + 1 ? `páginas ${pagina + 1}–${ultima}` : `página ${pagina + 1}`} de ${total} · ${porcento}%` : "…"}
            {traduzindo ? " · traduzindo…" : ""}
            {falhou ? (
              <>
                {" · não deu para traduzir · "}
                <button type="button" onClick={tentarDeNovo} className="leitor-mine-tentar">
                  tentar de novo
                </button>
              </>
            ) : null}
          </span>
        </div>
        <button
          type="button"
          onClick={perguntar}
          disabled={!total}
          className="leitor-mine-perguntar"
          title={aoInterpretar ? "Leva este trecho para a interpretação: resumo, palavras difíceis e perguntas" : "Explica a página (ou o trecho que você selecionar)"}
        >
          <Sparkles className="h-4 w-4" /> {aoInterpretar ? "Interpretar este trecho" : "Perguntar à Mine"}
        </button>
        <button type="button" onClick={() => virar(1)} disabled={ultima >= total} className="leitor-mine-virar" aria-label="Próxima página">
          <ChevronRight className="h-5 w-5" />
        </button>
        {!preferencias.foco ? (
          <button type="button" onClick={() => mudar({ foco: true })} className="leitor-mine-virar leitor-mine-entrar-foco" aria-label="Modo foco" title="Modo foco: esconde os botões">
            <Maximize2 className="h-4 w-4" />
          </button>
        ) : null}
      </footer>
      {preferencias.foco && total ? <div className="leitor-mine-foco-progresso" style={{ width: `${porcento}%` }} aria-hidden /> : null}
    </div>,
    document.body,
  );
}
