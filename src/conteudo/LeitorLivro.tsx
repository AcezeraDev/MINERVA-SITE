/**
 * Leitor da Mine (nov/2026): lê livros em domínio público do Projeto
 * Gutenberg dentro do site, em páginas, com tamanho de letra, tema papel ou
 * escuro, progresso guardado neste navegador e "perguntar à Mine" sobre a
 * página (ou o trecho selecionado).
 *
 * Vai para o <body> por portal: a página da matéria tem cartões animados com
 * transform, e `position: fixed` dentro deles ficaria preso ao cartão.
 */
import { ChevronLeft, ChevronRight, Loader2, Minus, Moon, Plus, Sparkles, Sun, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { paginar, paragrafos, textoDoAcervo } from "./acervo";

export type LivroParaLer = { id: number; titulo: string; autor: string };

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

export function LeitorLivro({
  livro,
  fechar,
  perguntarMine,
  aoMudarPagina,
}: {
  livro: LivroParaLer;
  fechar: () => void;
  perguntarMine: (prompt: string) => void;
  /** Avisa a estante da matéria em que página o aluno está (ex.: "p. 12 de 180"). */
  aoMudarPagina?: (pagina: number, total: number) => void;
}) {
  const [estado, setEstado] = useState<{ status: "carregando" | "pronto" | "erro"; texto: string; erro?: string }>({ status: "carregando", texto: "" });
  const [preferencias, setPreferencias] = useState(lerPreferencias);
  // Letra maior = páginas menores, para a página continuar cabendo na tela.
  const tamanhoPagina = Math.round(2600 * (19 / preferencias.fonte) ** 1.6);
  const paginas = useMemo(() => (estado.texto ? paginar(paragrafos(estado.texto), tamanhoPagina) : []), [estado.texto, tamanhoPagina]);
  const [pagina, setPagina] = useState(0);
  const folha = useRef<HTMLDivElement>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);

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

  // Volta para onde parou: o progresso é guardado como fração do livro, para
  // continuar valendo quando o tamanho da letra muda o número de páginas.
  useEffect(() => {
    if (!paginas.length) return;
    let fracao = 0;
    try {
      fracao = Number(JSON.parse(localStorage.getItem(chave(livro.id)) || "{}").fracao) || 0;
    } catch {
      fracao = 0;
    }
    setPagina(Math.min(paginas.length - 1, Math.max(0, Math.round(fracao * (paginas.length - 1)))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginas.length, livro.id]);

  useEffect(() => {
    if (!paginas.length) return;
    try {
      localStorage.setItem(chave(livro.id), JSON.stringify({ fracao: paginas.length > 1 ? pagina / (paginas.length - 1) : 0, em: Date.now() }));
    } catch {
      // sem armazenamento (aba anônima): só não lembra a página
    }
    aoMudarPagina?.(pagina + 1, paginas.length);
    folha.current?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, paginas.length]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFERENCIAS, JSON.stringify(preferencias));
    } catch {
      // ignora
    }
  }, [preferencias]);

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    fecharRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") fechar();
      const alvo = event.target as HTMLElement | null;
      if (alvo && /input|textarea|select/i.test(alvo.tagName)) return;
      if (event.key === "ArrowRight") setPagina((atual) => Math.min(atual + 1, Math.max(paginas.length - 1, 0)));
      if (event.key === "ArrowLeft") setPagina((atual) => Math.max(atual - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      anterior?.focus?.();
    };
  }, [fechar, paginas.length]);

  function perguntar() {
    const selecionado = String(window.getSelection?.() || "").trim();
    const trecho = (selecionado || (paginas[pagina] || []).join("\n\n")).slice(0, 1800);
    if (!trecho) return;
    perguntarMine(`Explique de forma simples este trecho do livro "${livro.titulo}"${livro.autor ? `, de ${livro.autor}` : ""}: o que acontece, palavras difíceis e o contexto da obra.\n\n"""\n${trecho}\n"""`);
    fechar();
  }

  const total = paginas.length;
  const porcento = total > 1 ? Math.round((pagina / (total - 1)) * 100) : 0;

  return createPortal(
    <div className={`leitor-mine ${preferencias.escuro ? "is-escuro" : ""}`} role="dialog" aria-modal="true" aria-label={`Lendo ${livro.titulo}`}>
      <header className="leitor-mine-topo">
        <div className="min-w-0 flex-1">
          <p className="leitor-mine-fonte">domínio público · Projeto Gutenberg</p>
          <h2>{livro.titulo}</h2>
          {livro.autor ? <p className="leitor-mine-autor">{livro.autor}</p> : null}
        </div>
        <div className="leitor-mine-ajustes" role="group" aria-label="Ajustes de leitura">
          <button type="button" onClick={() => setPreferencias((atual) => ({ ...atual, fonte: Math.max(15, atual.fonte - 2) }))} aria-label="Letra menor" title="Letra menor">
            <Minus className="h-4 w-4" />
          </button>
          <span className="tabular" aria-live="polite">{preferencias.fonte}px</span>
          <button type="button" onClick={() => setPreferencias((atual) => ({ ...atual, fonte: Math.min(26, atual.fonte + 2) }))} aria-label="Letra maior" title="Letra maior">
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPreferencias((atual) => ({ ...atual, escuro: !atual.escuro }))}
            aria-label={preferencias.escuro ? "Tema papel" : "Tema escuro"}
            title={preferencias.escuro ? "Tema papel" : "Tema escuro"}
          >
            {preferencias.escuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
        <button ref={fecharRef} type="button" onClick={fechar} className="leitor-mine-fechar" aria-label="Fechar o livro">
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="leitor-mine-folha" ref={folha} style={{ fontSize: `${preferencias.fonte}px` }}>
        {estado.status === "carregando" ? (
          <p className="leitor-mine-aviso">
            <Loader2 className="h-5 w-5 animate-spin" /> abrindo o livro…
          </p>
        ) : estado.status === "erro" ? (
          <p className="leitor-mine-aviso">{estado.erro}</p>
        ) : (
          <article className="leitor-mine-texto" lang="und">
            {(paginas[pagina] || []).map((paragrafo, index) => (
              <p key={`${pagina}-${index}`} className={paragrafo.includes("\n") ? "is-verso" : ""}>
                {paragrafo}
              </p>
            ))}
          </article>
        )}
      </div>

      <footer className="leitor-mine-rodape">
        <button type="button" onClick={() => setPagina((atual) => Math.max(atual - 1, 0))} disabled={pagina === 0 || !total} className="leitor-mine-virar" aria-label="Página anterior">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="leitor-mine-progresso">
          <input
            type="range"
            min={0}
            max={Math.max(total - 1, 0)}
            value={pagina}
            onChange={(event) => setPagina(Number(event.target.value))}
            disabled={!total}
            aria-label="Ir para a página"
          />
          <span className="tabular">{total ? `página ${pagina + 1} de ${total} · ${porcento}%` : "…"}</span>
        </div>
        <button type="button" onClick={perguntar} disabled={!total} className="leitor-mine-perguntar" title="Explica a página (ou o trecho que você selecionar)">
          <Sparkles className="h-4 w-4" /> Perguntar à Mine
        </button>
        <button type="button" onClick={() => setPagina((atual) => Math.min(atual + 1, Math.max(total - 1, 0)))} disabled={pagina >= total - 1} className="leitor-mine-virar" aria-label="Próxima página">
          <ChevronRight className="h-5 w-5" />
        </button>
      </footer>
    </div>,
    document.body,
  );
}
