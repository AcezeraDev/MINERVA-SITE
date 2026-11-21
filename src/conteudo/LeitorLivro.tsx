/**
 * Leitor da Mine (nov/2026): lê livros em domínio público do Projeto
 * Gutenberg dentro do site.
 *
 * - Páginas MEDIDAS: os parágrafos são medidos num bloco escondido com a
 *   mesma largura e letra da página, e cada página recebe só o que cabe na
 *   altura da tela (nada de rolar dentro da página). Parágrafo que não cabe
 *   é partido em frases.
 * - Tela larga: livro aberto, duas páginas lado a lado. Celular: uma página,
 *   com deslizar para virar.
 * - Traduzir: livro que não é em português ganha o botão "Traduzir"; a Mine
 *   traduz as páginas na tela e já adianta as próximas (cache por página).
 * - Letra, tema papel/escuro, progresso guardado neste navegador e
 *   "Perguntar à Mine" sobre a página ou o trecho selecionado.
 *
 * Vai para o <body> por portal: a página da matéria tem cartões animados com
 * transform, e `position: fixed` dentro deles ficaria preso ao cartão.
 */
import { ChevronLeft, ChevronRight, Languages, Loader2, Minus, Moon, Plus, Sparkles, Sun, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { askMineTask } from "../mineTask";
import { IDIOMAS, paragrafos, textoDoAcervo } from "./acervo";

export type LivroParaLer = { id: number; titulo: string; autor: string; /** pt, en, es… (sem idioma: não oferece tradução) */ idioma?: string; /** "Projeto Gutenberg" ou "Projeto Gutenberg Austrália" */ fonte?: string };

const chave = (id: number) => `minerva-leitura-${id}`;
const PREFERENCIAS = "minerva-leitor-preferencias";

function lerPreferencias(): { fonte: number; escuro: boolean } {
  try {
    const salvo = JSON.parse(localStorage.getItem(PREFERENCIAS) || "{}");
    return { fonte: Math.min(26, Math.max(15, Number(salvo.fonte) || 19)), escuro: Boolean(salvo.escuro) };
  } catch {
    return { fonte: 19, escuro: false };
  }
}

/** Uma página = lista de parágrafos (ou pedaços de parágrafo) que cabem na altura. */
type Pagina = string[];

/** Marca invisível no começo de um pedaço que continua o parágrafo da página anterior. */
const CONTINUA = "⁣";

/**
 * Reparte os parágrafos em páginas pela altura medida de cada um.
 * `alturas[i]` é a altura do parágrafo i (com a margem de cima já incluída).
 */
function repartir(lista: string[], alturas: number[], alturaPagina: number, espaco: number): Pagina[] {
  const paginas: Pagina[] = [];
  let atual: string[] = [];
  let usado = 0;
  const fechar = () => {
    if (atual.length) paginas.push(atual);
    atual = [];
    usado = 0;
  };
  lista.forEach((paragrafo, index) => {
    let resto = paragrafo;
    let altura = alturas[index] || 0;
    // Pedaço que continua um parágrafo da página anterior: sem recuo de 1ª linha.
    let continua = false;
    const marcar = (texto: string) => (continua ? `${CONTINUA}${texto}` : texto);
    const margem = () => (atual.length ? espaco : 0);
    const verso = paragrafo.includes("\n");
    while (resto) {
      const livre = alturaPagina - usado - margem();
      if (altura <= livre) {
        usado += margem() + altura;
        atual.push(marcar(resto));
        return;
      }
      // Não cabe inteiro: parte pela proporção de altura que sobra (com folga,
      // porque a proporção é por caracteres). Verso parte entre versos.
      const fracao = (livre / altura) * 0.88;
      if (fracao < 0.1 || resto.length < 120) {
        if (!atual.length) {
          // sozinho numa página e ainda grande demais: vai assim mesmo
          atual.push(marcar(resto));
          fechar();
          return;
        }
        fechar();
        continue;
      }
      const corte = Math.floor(resto.length * fracao);
      let fim = -1;
      for (const achado of resto.matchAll(verso ? /\n/g : /(?<=[.!?;:…])\s+/g)) {
        if ((achado.index ?? 0) > corte) break;
        fim = (achado.index ?? 0) + achado[0].length;
      }
      // Fim de frase longe demais do corte (frases longas, tela estreita):
      // parte entre palavras para a página não ficar meio vazia.
      if (!verso && fim < corte * 0.7) {
        const espacoAntes = resto.lastIndexOf(" ", corte);
        if (espacoAntes > 40 && espacoAntes + 1 > fim) fim = espacoAntes + 1;
      }
      if (fim <= 0) {
        if (!atual.length) {
          atual.push(marcar(resto));
          fechar();
          return;
        }
        fechar();
        continue;
      }
      atual.push(marcar(resto.slice(0, fim).trim()));
      const parte = fim / resto.length;
      resto = resto.slice(fim).trim();
      altura = altura * (1 - parte);
      continua = true;
      fechar();
    }
  });
  fechar();
  return paginas;
}

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
  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const [pagina, setPagina] = useState(0);
  const [duplo, setDuplo] = useState(false);
  const [traduzir, setTraduzir] = useState(false);
  const [traducoes, setTraducoes] = useState<Record<string, string | "erro" | "carregando">>({});
  const palco = useRef<HTMLDivElement>(null);
  const molde = useRef<HTMLDivElement>(null);
  const medida = useRef<HTMLDivElement>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const [tamanho, setTamanho] = useState({ largura: 0, altura: 0 });
  const traduzivel = Boolean(livro.idioma && livro.idioma !== "pt");
  const nomeIdioma = livro.idioma ? IDIOMAS[livro.idioma] || livro.idioma : "";

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

  // Mede todos os parágrafos de uma vez e reparte em páginas.
  useLayoutEffect(() => {
    const folhaModelo = molde.current;
    const bloco = medida.current;
    if (!lista.length || !folhaModelo || !bloco || !tamanho.altura) return;
    const alturaPagina = folhaModelo.clientHeight;
    const filhos = Array.from(bloco.children) as HTMLElement[];
    const caixas = filhos.map((filho) => filho.getBoundingClientRect());
    const alturas = caixas.map((caixa) => caixa.height);
    // Espaço real entre parágrafos (margem do CSS), medido entre os dois primeiros.
    const espaco = caixas.length > 1 ? Math.max(0, caixas[1].top - caixas[0].bottom) : preferencias.fonte;
    // Folga de ~2/3 de linha: o corte de parágrafo é estimado por caracteres,
    // e sem a folga a última linha da página às vezes ficava cortada.
    const linha = parseFloat(getComputedStyle(bloco).lineHeight) || preferencias.fonte * 1.7;
    setPaginas(repartir(lista, alturas, alturaPagina - linha * 0.7, espaco));
  }, [lista, tamanho, preferencias.fonte, duplo]);

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
    (direcao: 1 | -1) => setPagina((atual) => Math.min(Math.max(atual + direcao * passo, 0), Math.max(total - 1, 0) - (duplo ? (Math.max(total - 1, 0) % 2) : 0))),
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
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") fechar();
      const alvo = event.target as HTMLElement | null;
      if (alvo && /input|textarea|select/i.test(alvo.tagName)) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") virar(1);
      if (event.key === "ArrowLeft" || event.key === "PageUp") virar(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fechar, virar]);

  // Deslizar no celular.
  const toque = useRef<number | null>(null);

  // ── Tradução ──
  const chaveTraducao = (indice: number) => `${indice}:${(paginas[indice] || []).join("").length}:${(paginas[indice] || [""])[0].slice(0, 24)}`;
  const traduzirPagina = useCallback(
    (indice: number) => {
      const conteudo = paginas[indice];
      if (!conteudo?.length) return;
      const k = `${indice}:${conteudo.join("").length}:${conteudo[0].slice(0, 24)}`;
      setTraducoes((atual) => {
        if (atual[k] && atual[k] !== "erro") return atual;
        void askMineTask({ task: "traducao", prompt: conteudo.map((parte) => parte.replace(CONTINUA, "")).join("\n\n"), context: `${livro.titulo}${livro.autor ? `, de ${livro.autor}` : ""}`, outputTokens: 2400 })
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

  function textoDaPagina(indice: number): { texto: string[]; status: "original" | "carregando" | "erro" | "traduzido" } {
    const original = paginas[indice] || [];
    if (!traduzir) return { texto: original, status: "original" };
    const valor = traducoes[chaveTraducao(indice)];
    if (!valor || valor === "carregando") return { texto: original, status: "carregando" };
    if (valor === "erro") return { texto: original, status: "erro" };
    return { texto: valor.split(/\n[ \t]*\n+/).filter(Boolean), status: "traduzido" };
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

  function perguntar() {
    const selecionado = String(window.getSelection?.() || "").trim();
    if (aoInterpretar) {
      // Interpretação precisa de texto suficiente: a página na tela e as
      // seguintes até ~2.500 caracteres (ou o trecho selecionado, se for grande).
      const partes: string[] = [];
      for (let indice = pagina; indice < total && partes.join("\n\n").length < 2500; indice += 1) {
        partes.push(...textoDaPagina(indice).texto.map((parte) => parte.replace(CONTINUA, "")));
      }
      const trecho = selecionado.length > 600 ? selecionado : partes.join("\n\n");
      aoInterpretar(trecho.slice(0, 6000));
      fechar();
      return;
    }
    const visiveis = [pagina, pagina + 1].slice(0, passo).flatMap((indice) => textoDaPagina(indice).texto);
    const trecho = (selecionado || visiveis.join("\n\n")).slice(0, 1800);
    if (!trecho) return;
    perguntarMine(`Explique de forma simples este trecho do livro "${livro.titulo}"${livro.autor ? `, de ${livro.autor}` : ""}: o que acontece, palavras difíceis e o contexto da obra.\n\n"""\n${trecho}\n"""`);
    fechar();
  }

  const ultima = Math.min(pagina + passo, total);
  const porcento = total > 1 ? Math.round((Math.min(pagina + passo - 1, total - 1) / (total - 1)) * 100) : 0;
  const visiveis = [pagina, pagina + 1].slice(0, passo);
  const traduzindo = traduzir && visiveis.some((indice) => indice < total && textoDaPagina(indice).status === "carregando");
  const falhou = traduzir && visiveis.some((indice) => indice < total && textoDaPagina(indice).status === "erro");

  return createPortal(
    <div className={`leitor-mine ${preferencias.escuro ? "is-escuro" : ""}`} role="dialog" aria-modal="true" aria-label={`Lendo ${livro.titulo}`} style={{ "--fonte": `${preferencias.fonte}px` } as CSSProperties}>
      <header className="leitor-mine-topo">
        <div className="min-w-0 flex-1">
          <p className="leitor-mine-fonte">
            domínio público · {livro.fonte || "Projeto Gutenberg"}
            {nomeIdioma ? ` · ${nomeIdioma}` : ""}
          </p>
          <h2>{livro.titulo}</h2>
          {livro.autor ? <p className="leitor-mine-autor">{livro.autor}</p> : null}
        </div>
        {traduzivel ? (
          <button type="button" onClick={() => setTraduzir((atual) => !atual)} aria-pressed={traduzir} className="leitor-mine-traduzir" title={traduzir ? "Voltar para o texto original" : "A Mine traduz as páginas para o português"}>
            {traduzindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
            {traduzir ? "Ver original" : "Traduzir"}
          </button>
        ) : null}
        <div className="leitor-mine-ajustes" role="group" aria-label="Ajustes de leitura">
          <button type="button" onClick={() => setPreferencias((atual) => ({ ...atual, fonte: Math.max(15, atual.fonte - 2) }))} aria-label="Letra menor" title="Letra menor">
            <Minus className="h-4 w-4" />
          </button>
          <span className="tabular" aria-live="polite">
            {preferencias.fonte}px
          </span>
          <button type="button" onClick={() => setPreferencias((atual) => ({ ...atual, fonte: Math.min(26, atual.fonte + 2) }))} aria-label="Letra maior" title="Letra maior">
            <Plus className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setPreferencias((atual) => ({ ...atual, escuro: !atual.escuro }))} aria-label={preferencias.escuro ? "Tema papel" : "Tema escuro"} title={preferencias.escuro ? "Tema papel" : "Tema escuro"}>
            {preferencias.escuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
        <button ref={fecharRef} type="button" onClick={fechar} className="leitor-mine-fechar" aria-label="Fechar o livro">
          <X className="h-5 w-5" />
        </button>
      </header>

      <div
        className="leitor-mine-palco"
        ref={palco}
        onTouchStart={(event) => {
          toque.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const inicio = toque.current;
          const fim = event.changedTouches[0]?.clientX;
          toque.current = null;
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
            {visiveis.map((indice) => {
              const { texto, status } = textoDaPagina(indice);
              return (
                <article key={indice} className={`leitor-mine-pagina ${status === "carregando" ? "is-traduzindo" : status === "traduzido" ? "is-traduzido" : ""}`} lang={status === "traduzido" ? "pt-BR" : livro.idioma || undefined}>
                  {indice < total ? (
                    <>
                      <div className="leitor-mine-texto">
                        {texto.map((paragrafo, ordem) => (
                          <p
                            key={`${indice}-${ordem}`}
                            className={`${paragrafo.includes("\n") ? "is-verso" : ""} ${paragrafo.startsWith(CONTINUA) ? "is-continua" : ""}`}
                          >
                            {paragrafo.replace(CONTINUA, "")}
                          </p>
                        ))}
                      </div>
                      <span className="leitor-mine-numero tabular">{indice + 1}</span>
                    </>
                  ) : null}
                </article>
              );
            })}
            <button type="button" className="leitor-mine-borda is-direita" onClick={() => virar(1)} disabled={ultima >= total} aria-label="Próxima página" />
          </>
        )}

        {/* Molde invisível DENTRO do livro (mesmo tamanho exato): mede a altura útil e cada parágrafo. */}
        <div className="leitor-mine-molde" aria-hidden>
          <article className="leitor-mine-pagina">
            {/* área útil da página: a altura que cada página pode ocupar */}
            <div className="leitor-mine-texto leitor-mine-area" ref={molde} />
            <span className="leitor-mine-numero tabular">0</span>
            {/* todos os parágrafos, na mesma largura, só para medir */}
            <div className="leitor-mine-texto leitor-mine-medida" ref={medida}>
              {lista.map((paragrafo, index) => (
                <p key={index} className={paragrafo.includes("\n") ? "is-verso" : ""}>
                  {paragrafo}
                </p>
              ))}
            </div>
          </article>
        </div>
        </div>
      </div>

      <footer className="leitor-mine-rodape">
        <button type="button" onClick={() => virar(-1)} disabled={pagina === 0 || !total} className="leitor-mine-virar" aria-label="Página anterior">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="leitor-mine-progresso">
          <input
            type="range"
            min={0}
            max={Math.max(total - 1, 0)}
            step={passo}
            value={pagina}
            onChange={(event) => {
              const valor = Number(event.target.value);
              setPagina(duplo ? valor - (valor % 2) : valor);
            }}
            disabled={!total}
            aria-label="Ir para a página"
          />
          <span className="tabular">
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
      </footer>
    </div>,
    document.body,
  );
}
