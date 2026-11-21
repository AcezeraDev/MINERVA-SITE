/**
 * Aba "Livros" da página da matéria (refeita em 21/nov/2026).
 *
 * Duas vistas:
 * - Estante da matéria: livros sugeridos pela Mine e os que o aluno pôs, com
 *   filtro (todos / grátis para ler / sem leitura grátis / minha lista) e
 *   "quero ler / lendo / lido". A Mine sugere de dois jeitos, à escolha:
 *   só livros grátis para ler aqui (domínio público achado no acervo) ou
 *   qualquer livro (didáticos etc., com capa e prévia oficial quando há).
 * - Biblioteca grátis: ~2.500 livros em domínio público do Projeto Gutenberg
 *   (português, espanhol e clássicos em inglês), com busca, idioma e gênero.
 *
 * Livro do acervo abre no leitor da própria Mine (LeitorLivro); prévia do
 * Google Livros / Internet Archive continua no visor embutido.
 */
import { BookMarked, BookOpen, Check, ExternalLink, Gift, Library, Loader2, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import "../caderno/caderno-livros.css";
import "../caderno/caderno-materia-extras.css";
import { mineHeaders } from "../mineAuth";
import { askMineTask } from "../mineTask";
import { GENEROS, IDIOMAS, acharNoAcervo, capaAcervo, carregarAcervo, dobrar, type LivroAcervo } from "./acervo";
import { lerJson, listaDe, novoId, semLatex, texto } from "./extrasUtil";
import { LeitorLivro, type LivroParaLer } from "./LeitorLivro";

export type Leitura = {
  url: string;
  tipo: "previa" | "completo";
  fonte: string;
  /** Livro do Projeto Gutenberg: abre no leitor da Mine, não num iframe. */
  gutenbergId?: number;
};

export type LivroItem = {
  id: string;
  titulo: string;
  autor: string;
  tipo: "didatico" | "paradidatico" | "vestibular" | "aprofundar";
  porque: string;
  /** "sugerido" = a Mine sugeriu e o aluno ainda não escolheu nada. */
  estado: "sugerido" | "quero" | "lendo" | "lido";
  /** O aluno escolheu o estado (até nov/2026 "quero" era o padrão de todo livro sugerido). */
  marcado?: boolean;
  nota?: string;
  /** "p. 12 de 180", gravado ao fechar o leitor da Mine. */
  progresso?: string;
  capa?: string;
  leitura?: Leitura | null;
  /** Versão da busca de capa/leitura que já rodou (ver LIVRO_VERSAO). */
  buscado?: boolean | number;
};

/** Subir quando a busca de capas/leitura melhorar: livros antigos são procurados de novo. */
const LIVRO_VERSAO = 3;

/** Livro antigo com "quero" que ninguém escolheu conta como sugerido. */
function estadoDe(livro: LivroItem): LivroItem["estado"] {
  return livro.estado === "quero" && !livro.marcado ? "sugerido" : livro.estado;
}

const ESTADO_AVISO: Record<"quero" | "lendo" | "lido", string> = {
  quero: "está na sua lista de quero ler.",
  lendo: "marcado como lendo. Anote onde parou.",
  lido: "marcado como lido. Boa!",
};

const TIPO_LIVRO: Record<LivroItem["tipo"], string> = { didatico: "didático", paradidatico: "paradidático", vestibular: "vestibular", aprofundar: "para aprofundar" };

function leituraDoAcervo(livro: LivroAcervo): Leitura {
  return { url: "", tipo: "completo", fonte: "Projeto Gutenberg (domínio público)", gutenbergId: livro.i };
}

/** Capa e leitura de um livro: primeiro o acervo grátis, depois Google Livros / Internet Archive. */
async function infoDoLivro(livro: { titulo: string; autor: string }, acervo: LivroAcervo[]): Promise<Pick<LivroItem, "capa" | "leitura" | "buscado">> {
  const noAcervo = acharNoAcervo(acervo, livro.titulo, livro.autor);
  if (noAcervo) return { buscado: LIVRO_VERSAO, capa: capaAcervo(noAcervo.i), leitura: leituraDoAcervo(noAcervo) };
  try {
    const response = await fetch("/api/livro", { method: "POST", headers: mineHeaders(), body: JSON.stringify({ titulo: livro.titulo, autor: livro.autor }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { buscado: LIVRO_VERSAO, capa: "", leitura: null };
    const leitura = data.leitura && typeof data.leitura.url === "string" && data.leitura.url.startsWith("https://") ? (data.leitura as Leitura) : null;
    return { buscado: LIVRO_VERSAO, capa: typeof data.capa === "string" && data.capa.startsWith("https://") ? data.capa : "", leitura };
  } catch {
    return { buscado: LIVRO_VERSAO, capa: "", leitura: null };
  }
}

type Filtro = "todos" | "gratis" | "pagos" | "minha";

export function AbaLivros({
  nome,
  contexto,
  itens,
  salvarLivros,
  notify,
  perguntarMine,
  abrirEmbed,
}: {
  nome: string;
  contexto: string;
  itens: LivroItem[];
  /** Sempre sobre a lista mais recente (capas e progresso chegam depois). */
  salvarLivros: (atualizar: (atual: LivroItem[]) => LivroItem[]) => void;
  notify: (message: string) => void;
  perguntarMine: (prompt: string) => void;
  /** Prévia do Google Livros / Internet Archive (iframe). */
  abrirEmbed: (livro: LivroItem) => void;
}) {
  const [vista, setVista] = useState<"estante" | "biblioteca">("estante");
  const [acervo, setAcervo] = useState<LivroAcervo[] | null>(null);
  const [erroAcervo, setErroAcervo] = useState("");
  const [carregando, setCarregando] = useState<"gratis" | "qualquer" | null>(null);
  const [leitor, setLeitor] = useState<(LivroParaLer & { estanteId?: string }) | null>(null);
  const ultimaPagina = useRef<{ pagina: number; total: number } | null>(null);

  useEffect(() => {
    let vivo = true;
    carregarAcervo()
      .then((lista) => vivo && setAcervo(lista))
      .catch(() => vivo && setErroAcervo("Não consegui carregar a biblioteca agora. Tente recarregar a página."));
    return () => {
      vivo = false;
    };
  }, []);

  // Livros salvos antes das capas (ou de uma versão antiga da busca): completa ao abrir a aba.
  const pendentes = itens.filter((livro) => livro.buscado !== LIVRO_VERSAO).map((livro) => livro.id).join(",");
  useEffect(() => {
    if (!pendentes || !acervo) return;
    let vivo = true;
    const alvos = itens.filter((livro) => livro.buscado !== LIVRO_VERSAO);
    void Promise.all(alvos.map(async (livro) => [livro.id, await infoDoLivro(livro, acervo)] as const)).then((resultados) => {
      if (!vivo) return;
      const porId = new Map(resultados);
      salvarLivros((atual) => atual.map((livro) => (porId.has(livro.id) ? { ...livro, ...porId.get(livro.id) } : livro)));
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendentes, acervo]);

  async function sugerir(modo: "gratis" | "qualquer") {
    if (carregando) return;
    setCarregando(modo);
    try {
      const lista = acervo || (await carregarAcervo());
      const reply = await askMineTask({
        task: "materia-extra",
        prompt:
          modo === "gratis"
            ? `Sugira de 10 a 14 livros em DOMINIO PUBLICO (autores mortos ha mais de 70 anos, obras classicas) que ajudem a estudar ${nome} ou que sejam leitura gostosa ligada a ela. Prefira obras brasileiras e portuguesas; tambem valem classicos estrangeiros em espanhol ou ingles. Use o titulo como aparece no Projeto Gutenberg. Formato: {"livros":[{"titulo":"","autor":"","tipo":"paradidatico|vestibular|aprofundar","porque":"uma frase dizendo por que vale ler"}]}`
            : `Sugira de 6 a 8 livros REAIS para estudar ${nome} no ensino medio, misturando: livro didatico conhecido, paradidatico gostoso de ler, obra cobrada em vestibular (so se a materia tiver) e um para aprofundar. Formato: {"livros":[{"titulo":"","autor":"","tipo":"didatico|paradidatico|vestibular|aprofundar","porque":"uma frase dizendo por que vale ler"}]}`,
        context: contexto,
        outputTokens: modo === "gratis" ? 1800 : 1400,
      });
      const tipos = ["didatico", "paradidatico", "vestibular", "aprofundar"] as const;
      const vistos = new Set(itens.map((item) => dobrar(item.titulo)));
      let novos: LivroItem[] = listaDe(lerJson(reply), "livros")
        .map((item) => ({
          id: novoId(),
          titulo: texto(item.titulo, 120),
          autor: texto(item.autor, 80),
          tipo: tipos.find((valor) => valor === texto(item.tipo, 20)) || ("aprofundar" as const),
          porque: semLatex(texto(item.porque, 220)),
          estado: "sugerido" as const,
        }))
        .filter((item) => item.titulo && !vistos.has(dobrar(item.titulo)));
      if (modo === "gratis") {
        // Só fica o que existe de verdade no acervo grátis (dá para ler aqui).
        novos = novos.flatMap((livro) => {
          const achado = acharNoAcervo(lista, livro.titulo, livro.autor);
          if (!achado || itens.some((item) => item.leitura?.gutenbergId === achado.i)) return [];
          return [{ ...livro, titulo: achado.t, autor: achado.a || livro.autor, capa: capaAcervo(achado.i), leitura: leituraDoAcervo(achado), buscado: LIVRO_VERSAO }];
        });
        if (!novos.length) {
          notify(`Não achei livros grátis sobre ${nome} no acervo agora. Procure na Biblioteca grátis.`);
          setVista("biblioteca");
          return;
        }
      } else {
        novos = await Promise.all(novos.map(async (livro) => ({ ...livro, ...(await infoDoLivro(livro, lista)) })));
      }
      if (!novos.length) throw new Error("A Mine não sugeriu livros agora. Tente de novo.");
      salvarLivros((atual) => [...atual, ...novos].slice(-24));
      notify(modo === "gratis" ? `${novos.length} livros grátis para ler aqui.` : `${novos.length} livros sugeridos.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "A Mine não conseguiu agora. Tente de novo.");
    } finally {
      setCarregando(null);
    }
  }

  const abrir = (livro: LivroItem) => {
    if (livro.leitura?.gutenbergId) {
      ultimaPagina.current = null;
      const gid = livro.leitura.gutenbergId;
      setLeitor({ id: gid, titulo: livro.titulo, autor: livro.autor, estanteId: livro.id, idioma: acervo?.find((item) => item.i === gid)?.l });
    } else if (livro.leitura) abrirEmbed(livro);
  };

  const fecharLeitor = useCallback(() => {
    const aberto = leitor;
    const visto = ultimaPagina.current;
    setLeitor(null);
    // Grava o progresso na estante só ao fechar (cada gravação reenvia os dados da conta).
    if (aberto?.estanteId && visto && visto.pagina > 1) {
      salvarLivros((atual) =>
        atual.map((livro) =>
          livro.id === aberto.estanteId
            ? {
                ...livro,
                progresso: `p. ${visto.pagina} de ${visto.total}`,
                ...(estadoDe(livro) === "sugerido" || estadoDe(livro) === "quero" ? { estado: "lendo" as const, marcado: true } : {}),
              }
            : livro,
        ),
      );
    }
  }, [leitor, salvarLivros]);

  const aoMudarPagina = useCallback((pagina: number, total: number) => {
    ultimaPagina.current = { pagina, total };
  }, []);

  const porNaEstante = (livro: LivroAcervo) => {
    if (itens.some((item) => item.leitura?.gutenbergId === livro.i)) {
      notify("Esse livro já está na estante.");
      return;
    }
    const ficcao = livro.g.some((genero) => ["Romance", "Contos", "Poesia", "Teatro", "Aventura", "Infantojuvenil", "Mistério", "Terror", "Fantasia e ficção científica"].includes(genero));
    salvarLivros((atual) => [
      {
        id: novoId(),
        titulo: livro.t,
        autor: livro.a,
        tipo: ficcao ? "paradidatico" : "aprofundar",
        porque: `${livro.g.join(", ")} · ${IDIOMAS[livro.l] || livro.l}`,
        estado: "quero",
        marcado: true,
        capa: capaAcervo(livro.i),
        leitura: leituraDoAcervo(livro),
        buscado: LIVRO_VERSAO,
      },
      ...atual,
    ]);
    notify(`"${livro.t}" foi para a estante de ${nome}.`);
  };

  return (
    <>
      <div className="caderno-lv-vistas" role="tablist" aria-label="Livros">
        <button type="button" role="tab" aria-selected={vista === "estante"} onClick={() => setVista("estante")} className="caderno-lv-vista">
          <BookMarked className="h-4 w-4" aria-hidden /> Estante de {nome}
          <span className="caderno-lv-conta tabular">{itens.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={vista === "biblioteca"} onClick={() => setVista("biblioteca")} className="caderno-lv-vista">
          <Library className="h-4 w-4" aria-hidden /> Biblioteca grátis
          {acervo ? <span className="caderno-lv-conta tabular">{acervo.length.toLocaleString("pt-BR")}</span> : null}
        </button>
      </div>

      {vista === "estante" ? (
        <Estante
          nome={nome}
          itens={itens}
          carregando={carregando}
          sugerir={sugerir}
          abrir={abrir}
          mudar={salvarLivros}
          notify={notify}
          irParaBiblioteca={() => setVista("biblioteca")}
        />
      ) : (
        <Biblioteca acervo={acervo} erro={erroAcervo} naEstante={new Set(itens.map((item) => item.leitura?.gutenbergId).filter(Boolean) as number[])} ler={(livro) => {
            // Se o livro também está na estante, o progresso vai para lá ao fechar.
            ultimaPagina.current = null;
            setLeitor({ id: livro.i, titulo: livro.t, autor: livro.a, idioma: livro.l, estanteId: itens.find((item) => item.leitura?.gutenbergId === livro.i)?.id });
          }} porNaEstante={porNaEstante} />
      )}

      {leitor ? <LeitorLivro livro={leitor} fechar={fecharLeitor} perguntarMine={perguntarMine} aoMudarPagina={aoMudarPagina} /> : null}
    </>
  );
}

/* ───────── Estante da matéria ───────── */

function Estante({
  nome,
  itens,
  carregando,
  sugerir,
  abrir,
  mudar,
  notify,
  irParaBiblioteca,
}: {
  nome: string;
  itens: LivroItem[];
  carregando: "gratis" | "qualquer" | null;
  sugerir: (modo: "gratis" | "qualquer") => void;
  abrir: (livro: LivroItem) => void;
  mudar: (atualizar: (atual: LivroItem[]) => LivroItem[]) => void;
  notify: (message: string) => void;
  irParaBiblioteca: () => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const alterar = (id: string, parcial: Partial<LivroItem>) => mudar((atual) => atual.map((item) => (item.id === id ? { ...item, ...parcial } : item)));
  const marcar = (livro: LivroItem, estado: "quero" | "lendo" | "lido") => {
    if (estadoDe(livro) === estado) {
      alterar(livro.id, { estado: "sugerido", marcado: false });
      notify(`"${livro.titulo}" voltou para as sugestões.`);
      return;
    }
    alterar(livro.id, { estado, marcado: true });
    notify(`"${livro.titulo}" ${ESTADO_AVISO[estado]}`);
  };

  const gratis = (livro: LivroItem) => livro.leitura?.tipo === "completo";
  const contagem: Record<Filtro, number> = {
    todos: itens.length,
    gratis: itens.filter(gratis).length,
    pagos: itens.filter((livro) => !gratis(livro)).length,
    minha: itens.filter((livro) => estadoDe(livro) !== "sugerido").length,
  };
  const ordem = { lendo: 0, quero: 1, sugerido: 2, lido: 3 } as const;
  const lista = itens
    .filter((livro) => (filtro === "gratis" ? gratis(livro) : filtro === "pagos" ? !gratis(livro) : filtro === "minha" ? estadoDe(livro) !== "sugerido" : true))
    .sort((a, b) => ordem[estadoDe(a)] - ordem[estadoDe(b)]);

  const botoesSugerir = (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => sugerir("gratis")} disabled={Boolean(carregando)} className="caderno-lv-sugerir is-gratis">
        {carregando === "gratis" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
        {carregando === "gratis" ? "procurando…" : "Sugerir grátis para ler aqui"}
      </button>
      <button type="button" onClick={() => sugerir("qualquer")} disabled={Boolean(carregando)} className="caderno-lv-sugerir">
        {carregando === "qualquer" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {carregando === "qualquer" ? "procurando…" : "Sugerir qualquer livro"}
      </button>
    </div>
  );

  if (!itens.length) {
    return (
      <div className="caderno-mx-vazio">
        <BookMarked className="h-7 w-7 opacity-60" aria-hidden />
        <div>
          <strong>A estante de {nome}</strong>
          <p>Peça sugestões à Mine: só livros grátis para ler aqui mesmo, ou qualquer livro (didáticos, paradidáticos, vestibular). Ou escolha direto na Biblioteca grátis.</p>
        </div>
        {botoesSugerir}
        <button type="button" onClick={irParaBiblioteca} className="caderno-mx-mini">
          <Library className="h-3.5 w-3.5" /> abrir a Biblioteca grátis
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="caderno-lv-barra">
        <div className="caderno-lv-filtros" role="group" aria-label="Filtrar a estante">
          {(
            [
              ["todos", "Todos"],
              ["gratis", "Grátis para ler aqui"],
              ["pagos", "Sem leitura grátis"],
              ["minha", "Minha lista"],
            ] as const
          ).map(([valor, rotulo]) => (
            <button key={valor} type="button" aria-pressed={filtro === valor} onClick={() => setFiltro(valor)} className="caderno-mx-seg">
              {rotulo} <span className="tabular opacity-70">{contagem[valor]}</span>
            </button>
          ))}
        </div>
        {botoesSugerir}
      </div>

      {!lista.length ? (
        <p className="caderno-mx-dica">
          {filtro === "gratis" ? "Nenhum livro grátis na estante ainda. Use “Sugerir grátis para ler aqui” ou a Biblioteca grátis." : "Nada neste filtro."}
        </p>
      ) : (
        <div className="caderno-mx-livros">
          {lista.map((livro) => {
            const estado = estadoDe(livro);
            return (
              <article key={livro.id} className={`caderno-mx-livro is-${livro.tipo}`}>
                <span className="caderno-mx-lombada" aria-hidden />
                <Capa livro={livro} abrir={() => abrir(livro)} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="caderno-mx-chip">{TIPO_LIVRO[livro.tipo]}</span>
                    {gratis(livro) ? <span className="caderno-mx-chip is-gratis">grátis</span> : null}
                  </div>
                  <h3>{livro.titulo}</h3>
                  {livro.autor ? <p className="caderno-mx-autor">{livro.autor}</p> : null}
                  {livro.porque ? <p className="caderno-mx-porque">{livro.porque}</p> : null}
                  {livro.leitura ? (
                    <button type="button" onClick={() => abrir(livro)} className="caderno-mx-ler">
                      <BookOpen className="h-4 w-4" />
                      {livro.leitura.gutenbergId ? (livro.progresso ? `Continuar (${livro.progresso})` : "Ler aqui na Mine") : livro.leitura.tipo === "completo" ? "Ler o livro aqui" : "Ler a prévia aqui"}
                    </button>
                  ) : livro.buscado === LIVRO_VERSAO ? (
                    <p className="caderno-mx-semprevia">sem leitura grátis: procure na biblioteca da escola</p>
                  ) : (
                    <p className="caderno-mx-semprevia">procurando capa e leitura…</p>
                  )}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5" role="group" aria-label={`Leitura de ${livro.titulo}`}>
                    {(["quero", "lendo", "lido"] as const).map((valor) => {
                      const ativo = estado === valor;
                      return (
                        <button key={valor} type="button" aria-pressed={ativo} onClick={() => marcar(livro, valor)} className="caderno-mx-seg" title={ativo ? "Clique de novo para desmarcar" : undefined}>
                          {ativo ? <Check className="h-3.5 w-3.5" aria-hidden /> : valor === "quero" ? <Plus className="h-3.5 w-3.5" aria-hidden /> : null}
                          {valor === "quero" ? "quero ler" : valor}
                        </button>
                      );
                    })}
                  </div>
                  {estado === "lendo" || estado === "lido" ? (
                    <input
                      className="caderno-mx-nota"
                      defaultValue={livro.nota || ""}
                      placeholder="anotação (ex.: parei no capítulo 4)"
                      aria-label={`Anotação de ${livro.titulo}`}
                      onBlur={(event) => {
                        const nota = event.currentTarget.value.trim().slice(0, 120);
                        if (nota !== (livro.nota || "")) alterar(livro.id, { nota });
                      }}
                    />
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {!livro.leitura?.gutenbergId ? (
                    <a
                      href={`https://www.google.com/search?tbm=bks&q=${encodeURIComponent(`${livro.titulo} ${livro.autor}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="caderno-mx-icone"
                      aria-label={`Procurar ${livro.titulo} no Google Livros`}
                      title="Procurar no Google Livros"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                  <button type="button" onClick={() => mudar((atual) => atual.filter((item) => item.id !== livro.id))} className="caderno-mx-icone" aria-label={`Tirar ${livro.titulo} da estante`} title="Tirar da estante">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

function Capa({ livro, abrir }: { livro: LivroItem; abrir: () => void }) {
  const [falhou, setFalhou] = useState(false);
  return (
    <button
      type="button"
      className={`caderno-mx-capa ${livro.leitura ? "is-legivel" : ""} ${livro.buscado !== LIVRO_VERSAO ? "is-carregando" : ""}`}
      onClick={() => livro.leitura && abrir()}
      disabled={!livro.leitura}
      aria-label={livro.leitura ? `Ler ${livro.titulo}` : `Capa de ${livro.titulo}`}
      tabIndex={livro.leitura ? 0 : -1}
    >
      {livro.capa && !falhou ? <img src={livro.capa} alt="" loading="lazy" onError={() => setFalhou(true)} /> : <CapaDesenhada titulo={livro.titulo} />}
    </button>
  );
}

/** Capa de reserva: o título em letra de caderno sobre uma cor tirada do próprio título. */
function CapaDesenhada({ titulo }: { titulo: string }) {
  let soma = 0;
  for (const letra of titulo) soma = (soma * 31 + letra.charCodeAt(0)) % 360;
  return (
    <span className="caderno-lv-capa-desenho" style={{ "--h": soma } as CSSProperties}>
      {titulo.slice(0, 48)}
    </span>
  );
}

/* ───────── Biblioteca grátis (Projeto Gutenberg) ───────── */

const POR_PAGINA = 24;

/**
 * O catálogo não tem popularidade: sem busca, os autores cobrados na escola e
 * no vestibular vêm primeiro (na ordem desta lista), o resto em ordem alfabética.
 */
const DESTAQUES = [
  "machado de assis",
  "jose de alencar",
  "jose martiniano de alencar",
  "aluisio azevedo",
  "eca de queiros",
  "eca de queiroz",
  "luis de camoes",
  "manuel antonio de almeida",
  "raul pompeia",
  "bernardo guimaraes",
  "castro alves",
  "goncalves dias",
  "alvares de azevedo",
  "olavo bilac",
  "lima barreto",
  "joaquim manuel de macedo",
  "almeida garrett",
  "camilo castelo branco",
  "julio dinis",
  "antero de quental",
  "gil vicente",
  "padre antonio vieira",
  "miguel de cervantes",
  "william shakespeare",
  "jane austen",
  "mary shelley",
  "charles dickens",
  "arthur conan doyle",
  "jules verne",
  "lewis carroll",
];

function destaque(livro: LivroAcervo): number {
  const autor = dobrar(livro.a);
  const posicao = DESTAQUES.findIndex((nome) => autor.includes(nome));
  return posicao < 0 ? DESTAQUES.length : posicao;
}

function Biblioteca({
  acervo,
  erro,
  naEstante,
  ler,
  porNaEstante,
}: {
  acervo: LivroAcervo[] | null;
  erro: string;
  naEstante?: Set<number>;
  ler: (livro: LivroAcervo) => void;
  /** Sem estante (aba Leitura): o botão "+ estante" não aparece. */
  porNaEstante?: (livro: LivroAcervo) => void;
}) {
  const [busca, setBusca] = useState("");
  const [idioma, setIdioma] = useState("pt");
  const [genero, setGenero] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);

  const resultado = useMemo(() => {
    if (!acervo) return [];
    const termos = dobrar(busca).split(" ").filter(Boolean);
    const filtrados = acervo.filter((livro) => {
      if (idioma && livro.l !== idioma) return false;
      if (genero && !livro.g.includes(genero)) return false;
      if (!termos.length) return true;
      const alvo = dobrar(`${livro.t} ${livro.a}`);
      return termos.every((termo) => alvo.includes(termo));
    });
    // sort estável: dentro do mesmo autor (ou dos demais) segue a ordem alfabética do catálogo
    return filtrados.slice().sort((a, b) => destaque(a) - destaque(b));
  }, [acervo, busca, idioma, genero]);

  useEffect(() => setLimite(POR_PAGINA), [busca, idioma, genero]);

  const generosComLivros = useMemo(() => {
    if (!acervo) return [];
    const doIdioma = acervo.filter((livro) => !idioma || livro.l === idioma);
    return GENEROS.map((nomeGenero) => [nomeGenero, doIdioma.filter((livro) => livro.g.includes(nomeGenero)).length] as const).filter(([, total]) => total > 0);
  }, [acervo, idioma]);

  if (erro) return <p className="caderno-mx-dica">{erro}</p>;
  if (!acervo)
    return (
      <p className="caderno-mx-dica">
        <Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> carregando a biblioteca…
      </p>
    );

  return (
    <>
      <p className="caderno-mx-dica mt-0">
        Livros em domínio público do Projeto Gutenberg: grátis e legais para ler inteiros, aqui mesmo na Mine. Clássicos como Machado de Assis, Camões, José de Alencar, Eça de Queirós e Aluísio Azevedo.
      </p>
      <div className="caderno-lv-busca">
        <label className="caderno-lv-campo">
          <Search className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
          <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="título ou autor (ex.: Machado, Iracema)" aria-label="Buscar na biblioteca" />
        </label>
        <select value={idioma} onChange={(event) => setIdioma(event.target.value)} aria-label="Idioma">
          {Object.entries(IDIOMAS)
            .filter(([codigo]) => acervo.some((livro) => livro.l === codigo))
            .map(([codigo, rotulo]) => (
              <option key={codigo} value={codigo}>
                {rotulo}
              </option>
            ))}
          <option value="">Todos os idiomas</option>
        </select>
      </div>
      <div className="caderno-lv-generos" role="group" aria-label="Gênero">
        <button type="button" aria-pressed={!genero} onClick={() => setGenero("")} className="caderno-mx-seg">
          Todos
        </button>
        {generosComLivros.map(([nomeGenero, total]) => (
          <button key={nomeGenero} type="button" aria-pressed={genero === nomeGenero} onClick={() => setGenero(genero === nomeGenero ? "" : nomeGenero)} className="caderno-mx-seg">
            {nomeGenero} <span className="tabular opacity-70">{total}</span>
          </button>
        ))}
      </div>

      <p className="caderno-mx-placar tabular" aria-live="polite">
        {resultado.length.toLocaleString("pt-BR")} {resultado.length === 1 ? "livro" : "livros"}
      </p>
      {resultado.length ? (
        <div className="caderno-lv-grade">
          {resultado.slice(0, limite).map((livro) => (
            <article key={livro.i} className="caderno-lv-item">
              <button type="button" onClick={() => ler(livro)} className="caderno-lv-item-capa" aria-label={`Ler ${livro.t}`}>
                <CapaAcervo livro={livro} />
              </button>
              <h3 title={livro.t}>{livro.t}</h3>
              {livro.a ? <p className="caderno-mx-autor">{livro.a}</p> : null}
              <p className="caderno-lv-item-genero">{livro.g.join(" · ")}</p>
              <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                <button type="button" onClick={() => ler(livro)} className="caderno-mx-ler mt-0">
                  <BookOpen className="h-4 w-4" /> Ler
                </button>
                {!porNaEstante ? null : naEstante?.has(livro.i) ? (
                  <span className="caderno-mx-seg" aria-pressed="true">
                    <Check className="h-3.5 w-3.5" /> na estante
                  </span>
                ) : (
                  <button type="button" onClick={() => porNaEstante(livro)} className="caderno-mx-seg" title="Guardar na estante desta matéria">
                    <Plus className="h-3.5 w-3.5" /> estante
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <BuscaVazia acervo={acervo} busca={busca} idioma={idioma} genero={genero} verOutrosIdiomas={() => setIdioma("")} />
      )}
      {resultado.length > limite ? (
        <button type="button" onClick={() => setLimite((atual) => atual + POR_PAGINA)} className="caderno-mx-mini mx-auto mt-4 flex">
          mostrar mais ({(resultado.length - limite).toLocaleString("pt-BR")} restantes)
        </button>
      ) : null}
    </>
  );
}

/**
 * Busca sem resultado: se o livro existe em outro idioma, oferece trocar; se
 * não está no acervo (obra protegida por direito autoral, como "1984" nos EUA
 * ou livros recentes), explica e aponta onde procurar.
 */
function BuscaVazia({ acervo, busca, idioma, genero, verOutrosIdiomas }: { acervo: LivroAcervo[]; busca: string; idioma: string; genero: string; verOutrosIdiomas: () => void }) {
  const termos = dobrar(busca).split(" ").filter(Boolean);
  const emOutros =
    idioma && termos.length
      ? acervo.filter((livro) => livro.l !== idioma && (!genero || livro.g.includes(genero)) && termos.every((termo) => dobrar(`${livro.t} ${livro.a}`).includes(termo))).length
      : 0;
  const q = encodeURIComponent(busca.trim());
  return (
    <div className="caderno-mx-vazio">
      <Search className="h-6 w-6 opacity-60" aria-hidden />
      <div>
        {emOutros ? (
          <>
            <strong>
              Nada em {IDIOMAS[idioma] || idioma}, mas achei {emOutros} {emOutros === 1 ? "livro" : "livros"} em outros idiomas.
            </strong>
            <p>Os livros em outra língua têm o botão Traduzir no leitor.</p>
          </>
        ) : busca.trim() ? (
          <>
            <strong>“{busca.trim()}” não está na Biblioteca grátis.</strong>
            <p>
              Aqui só entram livros em domínio público (autores que morreram há mais de 70 anos e obras antigas). Livros recentes ou ainda protegidos por direito autoral, como muitos best-sellers, não podem ser lidos de graça aqui. Procure na biblioteca da escola ou nos links ao lado.
            </p>
          </>
        ) : (
          <strong>Nenhum livro neste gênero e idioma.</strong>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {emOutros ? (
          <button type="button" onClick={verOutrosIdiomas} className="caderno-subj-next mt-0">
            Ver em todos os idiomas
          </button>
        ) : null}
        {busca.trim() && !emOutros ? (
          <>
            <a href={`https://openlibrary.org/search?q=${q}`} target="_blank" rel="noreferrer" className="caderno-mx-mini">
              <ExternalLink className="h-3.5 w-3.5" /> Open Library (empréstimo grátis)
            </a>
            <a href={`https://www.google.com/search?tbm=bks&q=${q}`} target="_blank" rel="noreferrer" className="caderno-mx-mini">
              <ExternalLink className="h-3.5 w-3.5" /> Google Livros
            </a>
          </>
        ) : null}
      </div>
    </div>
  );
}

function CapaAcervo({ livro }: { livro: LivroAcervo }) {
  const [falhou, setFalhou] = useState(false);
  return !falhou ? <img src={capaAcervo(livro.i)} alt="" loading="lazy" onError={() => setFalhou(true)} /> : <CapaDesenhada titulo={livro.t} />;
}

/**
 * Biblioteca grátis sozinha (aba Leitura): acervo + leitor da Mine, sem a
 * estante de uma matéria. O botão da Mine no leitor leva o trecho para a
 * interpretação da aba (`aoInterpretar`).
 */
export function BibliotecaGratis({ aoInterpretar }: { aoInterpretar: (trecho: string, livro: { titulo: string; autor: string }) => void }) {
  const [acervo, setAcervo] = useState<LivroAcervo[] | null>(null);
  const [erro, setErro] = useState("");
  const [leitor, setLeitor] = useState<LivroParaLer | null>(null);
  const fechar = useCallback(() => setLeitor(null), []);

  useEffect(() => {
    let vivo = true;
    carregarAcervo()
      .then((lista) => vivo && setAcervo(lista))
      .catch(() => vivo && setErro("Não consegui carregar a biblioteca agora. Tente recarregar a página."));
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <>
      <Biblioteca acervo={acervo} erro={erro} ler={(livro) => setLeitor({ id: livro.i, titulo: livro.t, autor: livro.a, idioma: livro.l })} />
      {leitor ? (
        <LeitorLivro
          livro={leitor}
          fechar={fechar}
          perguntarMine={() => undefined}
          aoInterpretar={(trecho) => aoInterpretar(trecho, { titulo: leitor.titulo, autor: leitor.autor })}
        />
      ) : null}
    </>
  );
}
