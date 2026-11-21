/**
 * "Mais da matéria" (21/nov/2026): cinco abas no pé da página da matéria.
 *
 * - Trilha: os temas da matéria em ordem, cada um "falta / estudando / feito".
 * - Livros: didáticos, paradidáticos e obras de vestibular sugeridos pela Mine,
 *   com estado de leitura e uma anotação (o capítulo em que parou).
 * - Fórmulas: fórmulas (em LaTeX) ou conceitos-chave, com alfinete e impressão.
 * - Vídeos e links: vêm das FONTES da busca na web da Mine, então as URLs são
 *   reais (nada inventado pelo modelo).
 * - Questões: questões oficiais do ENEM (api.enem.dev via /api/enem).
 *
 * Trilha, livros, fórmulas e links ficam salvos em `subject.extras`, dentro do
 * mesmo AppData do resto do site. As questões do ENEM não são salvas.
 */
import { ArrowRight, BookMarked, BookOpen, Check, ExternalLink, Loader2, Pin, PinOff, Play, Plus, Printer, RefreshCw, Route, Sigma, Target, Trash2, Video, X, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MineRichText } from "../chat/MineRichText";
import { mineHeaders } from "../mineAuth";
import { askMineTask } from "../mineTask";
import "../caderno/caderno-materia-extras.css";

type Id = string;

export type TrilhaItem = { id: Id; titulo: string; resumo: string; estado: "falta" | "estudando" | "feito" };
export type LivroItem = {
  id: Id;
  titulo: string;
  autor: string;
  tipo: "didatico" | "paradidatico" | "vestibular" | "aprofundar";
  porque: string;
  /** "sugerido" = a Mine sugeriu e o aluno ainda não escolheu nada. */
  estado: "sugerido" | "quero" | "lendo" | "lido";
  /** O aluno escolheu o estado (até nov/2026 "quero" era o padrão de todo livro sugerido). */
  marcado?: boolean;
  nota?: string;
  /** Capa e leitor legal (Google Livros ou Internet Archive), vindos de /api/livro. */
  capa?: string;
  leitura?: Leitura | null;
  /** Versão da busca de capa/prévia que já rodou (ver LIVRO_VERSAO). */
  buscado?: boolean | number;
};

/** Subir quando a busca de capas melhorar: livros antigos são procurados de novo. */
const LIVRO_VERSAO = 2;
export type Leitura = { url: string; tipo: "previa" | "completo"; fonte: string };
export type FormulaItem = { id: Id; nome: string; expressao: string; explica: string; tipo: "formula" | "conceito"; fixado?: boolean };
export type LinkItem = {
  id: Id;
  titulo: string;
  url: string;
  dominio: string;
  resumo: string;
  tipo: "video" | "site";
  /** Vídeo do YouTube que toca no player embutido. */
  videoId?: string;
  canal?: string;
  duracao?: string;
};

type Visor = { tipo: "video" | "livro"; titulo: string; url: string; fonte: string; link?: string };

/** ID de 11 caracteres de um link do YouTube (watch, youtu.be, shorts, embed). */
function idDoYoutube(url: string): string {
  const match = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return match ? match[1] : "";
}

/** Capa e leitor de um livro; falha vira "sem prévia" (nunca trava a lista). */
async function infoDoLivro(livro: { titulo: string; autor: string }): Promise<Pick<LivroItem, "capa" | "leitura" | "buscado">> {
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

async function videosDoYoutube(q: string): Promise<Array<{ id: string; titulo: string; canal: string; duracao: string }>> {
  const response = await fetch("/api/videos", { method: "POST", headers: mineHeaders(), body: JSON.stringify({ q }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não consegui buscar vídeos agora.");
  return Array.isArray(data.videos) ? data.videos : [];
}

export type SubjectExtras = {
  trilha?: { itens: TrilhaItem[]; geradoEm: number };
  livros?: { itens: LivroItem[]; geradoEm: number };
  formulas?: { itens: FormulaItem[]; geradoEm: number };
  links?: { itens: LinkItem[]; geradoEm: number };
};

type Aba = "trilha" | "livros" | "formulas" | "links" | "enem";

const ABAS: Array<{ id: Aba; label: string; icon: LucideIcon; tone: string }> = [
  { id: "trilha", label: "Trilha", icon: Route, tone: "mint" },
  { id: "livros", label: "Livros", icon: BookMarked, tone: "yellow" },
  { id: "formulas", label: "Fórmulas", icon: Sigma, tone: "lilac" },
  { id: "links", label: "Vídeos e links", icon: Video, tone: "pink" },
  { id: "enem", label: "Questões ENEM", icon: Target, tone: "sky" },
];

const novoId = () => `x_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const texto = (value: unknown, max = 400) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** Texto corrido não renderiza LaTeX: troca os comandos comuns por símbolos. */
function semLatex(value: string): string {
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
function lerJson(reply: string): unknown {
  const limpo = reply.replace(/```(?:json)?/gi, "").trim();
  const inicio = limpo.search(/[[{]/);
  const fim = Math.max(limpo.lastIndexOf("]"), limpo.lastIndexOf("}"));
  if (inicio < 0 || fim < inicio) throw new Error("A Mine respondeu fora do formato. Tente de novo.");
  return JSON.parse(limpo.slice(inicio, fim + 1));
}

function listaDe(value: unknown, chave: string): Record<string, unknown>[] {
  const lista = Array.isArray(value) ? value : value && typeof value === "object" ? (value as Record<string, unknown>)[chave] : null;
  return Array.isArray(lista) ? lista.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
}

/** Área do ENEM a partir do ícone ou do nome da matéria. */
function areaEnem(nome: string, icone: string): string {
  const n = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (icone === "math" || /matem|algebra|geometr/.test(n)) return "matematica";
  if (["physics", "chemistry", "biology", "science"].includes(icone) || /fisic|quimic|biolog|cienc/.test(n)) return "ciencias-natureza";
  if (["history", "geography"].includes(icone) || /histor|geograf|sociolog|filosof/.test(n)) return "ciencias-humanas";
  return "linguagens";
}

const AREAS_ENEM: Record<string, string> = {
  matematica: "Matemática",
  "ciencias-natureza": "Ciências da Natureza",
  "ciencias-humanas": "Ciências Humanas",
  linguagens: "Linguagens",
};

export function MateriaExtras({
  nome,
  icone,
  conteudos,
  extras,
  salvar,
  perguntarMine,
  notify,
}: {
  nome: string;
  icone: string;
  /** Títulos (e um trecho) dos conteúdos da matéria, para a Mine priorizar. */
  conteudos: string[];
  extras: SubjectExtras;
  /** Aceita o objeto novo ou uma função sobre o valor mais recente (usada pelas capas que chegam depois). */
  salvar: (next: SubjectExtras | ((atual: SubjectExtras) => SubjectExtras)) => void;
  perguntarMine: (prompt: string) => void;
  notify: (message: string) => void;
}) {
  const [aba, setAba] = useState<Aba>("trilha");
  const [carregando, setCarregando] = useState<Aba | null>(null);
  const [visor, setVisor] = useState<Visor | null>(null);
  const fecharVisor = useCallback(() => setVisor(null), []);
  // Livros salvos antes das capas (ou cuja busca falhou na hora): completa ao abrir a aba.
  const pendentes = (extras.livros?.itens || []).filter((livro) => livro.buscado !== LIVRO_VERSAO).map((livro) => livro.id).join(",");
  useEffect(() => {
    if (aba !== "livros" || !pendentes) return;
    let vivo = true;
    const alvos = (extras.livros?.itens || []).filter((livro) => livro.buscado !== LIVRO_VERSAO);
    void Promise.all(alvos.map(async (livro) => [livro.id, await infoDoLivro(livro)] as const)).then((resultados) => {
      if (!vivo) return;
      const porId = new Map(resultados);
      salvar((atual) => ({
        ...atual,
        livros: atual.livros ? { ...atual.livros, itens: atual.livros.itens.map((livro) => (porId.has(livro.id) ? { ...livro, ...porId.get(livro.id) } : livro)) } : atual.livros,
      }));
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, pendentes]);
  const contexto = `Materia: ${nome}.\nConteudos ja cadastrados pelo estudante:\n${conteudos.length ? conteudos.map((item) => `- ${item}`).join("\n") : "- nenhum ainda"}`;

  async function gerar(alvo: Aba, executar: () => Promise<void>) {
    if (carregando) return;
    setCarregando(alvo);
    try {
      await executar();
    } catch (error) {
      notify(error instanceof Error ? error.message : "A Mine não conseguiu agora. Tente de novo.");
    } finally {
      setCarregando(null);
    }
  }

  const gerarTrilha = () =>
    gerar("trilha", async () => {
      const reply = await askMineTask({
        task: "materia-extra",
        prompt: `Monte a trilha de estudo de ${nome} para o ensino medio: de 6 a 10 temas, na ordem em que fazem sentido estudar (do basico ao avancado). Formato: {"trilha":[{"titulo":"nome curto do tema","resumo":"uma frase com o que se aprende, em texto simples, sem formulas nem LaTeX"}]}`,
        context: contexto,
        outputTokens: 1200,
      });
      const antigos = new Map((extras.trilha?.itens || []).map((item) => [item.titulo.toLowerCase(), item.estado]));
      const itens = listaDe(lerJson(reply), "trilha")
        .map((item) => ({ id: novoId(), titulo: texto(item.titulo, 80), resumo: semLatex(texto(item.resumo, 220)), estado: antigos.get(texto(item.titulo, 80).toLowerCase()) || ("falta" as const) }))
        .filter((item) => item.titulo)
        .slice(0, 12);
      if (!itens.length) throw new Error("A Mine não montou a trilha. Tente de novo.");
      salvar({ ...extras, trilha: { itens, geradoEm: Date.now() } });
    });

  const gerarLivros = () =>
    gerar("livros", async () => {
      const reply = await askMineTask({
        task: "materia-extra",
        prompt: `Sugira de 6 a 8 livros REAIS para estudar ${nome} no ensino medio, misturando: livro didatico conhecido, paradidatico gostoso de ler, obra cobrada em vestibular (so se a materia tiver) e um para aprofundar. Formato: {"livros":[{"titulo":"","autor":"","tipo":"didatico|paradidatico|vestibular|aprofundar","porque":"uma frase dizendo por que vale ler"}]}`,
        context: contexto,
        outputTokens: 1400,
      });
      const tipos = ["didatico", "paradidatico", "vestibular", "aprofundar"] as const;
      const meus = (extras.livros?.itens || []).filter((item) => estadoDe(item) !== "sugerido" || item.nota);
      const vistos = new Set(meus.map((item) => item.titulo.toLowerCase()));
      const novos = listaDe(lerJson(reply), "livros")
        .map((item) => {
          const tipo = tipos.find((valor) => valor === texto(item.tipo, 20)) || "aprofundar";
          return { id: novoId(), titulo: texto(item.titulo, 120), autor: texto(item.autor, 80), tipo, porque: semLatex(texto(item.porque, 220)), estado: "sugerido" as const };
        })
        .filter((item) => item.titulo && !vistos.has(item.titulo.toLowerCase()));
      if (!novos.length) throw new Error("A Mine não sugeriu livros agora. Tente de novo.");
      // Capa e prévia de cada livro antes de mostrar a lista (em paralelo).
      const completos = await Promise.all(novos.map(async (livro) => ({ ...livro, ...(await infoDoLivro(livro)) })));
      salvar({ ...extras, livros: { itens: [...meus, ...completos].slice(0, 16), geradoEm: Date.now() } });
    });

  const gerarFormulas = () =>
    gerar("formulas", async () => {
      const reply = await askMineTask({
        task: "materia-extra",
        prompt: `Monte a folha de consulta de ${nome}: de 8 a 14 itens. Se a materia usa formulas (exatas e ciencias da natureza), traga as formulas mais cobradas com tipo "formula" e a expressao em LaTeX. Se nao usa, traga conceitos-chave com tipo "conceito" e expressao vazia. Formato: {"itens":[{"nome":"","tipo":"formula|conceito","expressao":"","explica":"uma frase: o que significa e quando usar"}]}`,
        context: contexto,
        outputTokens: 1600,
      });
      const fixados = (extras.formulas?.itens || []).filter((item) => item.fixado);
      const vistos = new Set(fixados.map((item) => item.nome.toLowerCase()));
      const novos = listaDe(lerJson(reply), "itens")
        .map((item) => ({
          id: novoId(),
          nome: texto(item.nome, 80),
          tipo: texto(item.tipo, 12) === "formula" && texto(item.expressao, 300) ? ("formula" as const) : ("conceito" as const),
          expressao: texto(item.expressao, 300).replace(/^\$+|\$+$/g, ""),
          explica: semLatex(texto(item.explica, 260)),
        }))
        .filter((item) => item.nome && !vistos.has(item.nome.toLowerCase()));
      if (!novos.length) throw new Error("A Mine não montou a folha agora. Tente de novo.");
      salvar({ ...extras, formulas: { itens: [...fixados, ...novos].slice(0, 24), geradoEm: Date.now() } });
    });

  const gerarLinks = () =>
    gerar("links", async () => {
      const foco = conteudos[0] ? `${nome}, principalmente ${conteudos[0].split(":")[0]}` : nome;
      // Vídeos: busca do próprio YouTube, um pedido por tema da trilha que
      // ainda não foi feito (até 3); sem trilha, o foco da matéria.
      const temas = (extras.trilha?.itens || []).filter((item) => item.estado !== "feito").map((item) => item.titulo).slice(0, 3);
      const consultas = temas.length ? temas.map((tema) => `videoaula ${tema} ${nome} ensino médio`) : [`videoaula ${foco} ensino médio ENEM`];
      const [listasDeVideos, sitesWeb] = await Promise.all([
        Promise.all(consultas.map((consulta) => videosDoYoutube(consulta).catch(() => []))),
        fontesDaWeb(`${foco} explicação ensino médio Brasil Escola Khan Academy Toda Matéria`).catch(() => null),
      ]);
      const vistos = new Set<string>();
      const porTema = listasDeVideos.map((lista) => lista.slice(0, temas.length > 1 ? 3 : 6));
      const videos: LinkItem[] = porTema
        .flat()
        .filter((video) => !vistos.has(video.id) && vistos.add(video.id))
        .map((video) => ({
          id: novoId(),
          titulo: texto(video.titulo, 140),
          url: `https://www.youtube.com/watch?v=${video.id}`,
          dominio: "youtube.com",
          resumo: "",
          tipo: "video" as const,
          videoId: video.id,
          canal: texto(video.canal, 60),
          duracao: texto(video.duracao, 10),
        }));
      const sites: LinkItem[] = sitesWeb
        ? sitesWeb
            .filter((fonte) => fonte.url && !idDoYoutube(fonte.url) && !vistos.has(fonte.url) && vistos.add(fonte.url))
            .map((fonte) => ({
              id: novoId(),
              titulo: texto(fonte.title, 140) || fonte.domain || fonte.url,
              url: fonte.url,
              dominio: texto(fonte.domain, 60),
              resumo: texto(fonte.snippet, 200),
              tipo: "site" as const,
            }))
            .slice(0, 6)
        : atalhosDePesquisa(nome, []).filter((item) => item.tipo === "site");
      // Sem vídeo nenhum (YouTube fora do ar): atalhos de pesquisa no YouTube.
      const itens = [...(videos.length ? videos : atalhosDePesquisa(nome, temas).filter((item) => item.tipo === "video")), ...sites];
      if (!itens.length) throw new Error("Não encontrei vídeos nem links agora. Tente de novo em instantes.");
      salvar({ ...extras, links: { itens, geradoEm: Date.now() } });
    });

  return (
    <section className="caderno-mx" aria-label={`Mais de ${nome}`}>
      <header className="caderno-mx-head">
        <div>
          <p className="caderno-note">mais da matéria</p>
          <h2 className="mt-1 font-display text-xl font-black tracking-[-.03em]">
            Trilha, livros, fórmulas, vídeos e <span className="caderno-hl">questões reais</span>.
          </h2>
        </div>
      </header>

      <div className="caderno-mx-tabs" role="tablist" aria-label="Seções extras da matéria">
        {ABAS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`mx-tab-${item.id}`}
            aria-selected={aba === item.id}
            aria-controls={`mx-painel-${item.id}`}
            onClick={() => setAba(item.id)}
            className={`caderno-mx-tab is-${item.tone}`}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden />
            {item.label}
          </button>
        ))}
      </div>

      <div className="caderno-mx-body" role="tabpanel" id={`mx-painel-${aba}`} aria-labelledby={`mx-tab-${aba}`}>
        {aba === "trilha" ? (
          <Trilha
            itens={extras.trilha?.itens || []}
            carregando={carregando === "trilha"}
            gerar={gerarTrilha}
            mudar={(itens) => salvar({ ...extras, trilha: { itens, geradoEm: extras.trilha?.geradoEm || Date.now() } })}
            estudar={(item) => perguntarMine(`Me ensine o tema "${item.titulo}" de ${nome} do zero, com exemplos`)}
          />
        ) : null}
        {aba === "livros" ? (
          <Livros
            itens={extras.livros?.itens || []}
            carregando={carregando === "livros"}
            gerar={gerarLivros}
            mudar={(itens) => salvar({ ...extras, livros: { itens, geradoEm: extras.livros?.geradoEm || Date.now() } })}
            notify={notify}
            abrir={(livro) =>
              livro.leitura &&
              setVisor({ tipo: "livro", titulo: livro.titulo, url: livro.leitura.url, fonte: livro.leitura.tipo === "completo" ? `Livro completo · ${livro.leitura.fonte}` : `Prévia oficial · ${livro.leitura.fonte}` })
            }
          />
        ) : null}
        {aba === "formulas" ? (
          <Formulas
            nome={nome}
            itens={extras.formulas?.itens || []}
            carregando={carregando === "formulas"}
            gerar={gerarFormulas}
            mudar={(itens) => salvar({ ...extras, formulas: { itens, geradoEm: extras.formulas?.geradoEm || Date.now() } })}
          />
        ) : null}
        {aba === "links" ? (
          <Links
            itens={extras.links?.itens || []}
            carregando={carregando === "links"}
            gerar={gerarLinks}
            abrir={(item, videoId) => setVisor({ tipo: "video", titulo: item.titulo, url: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`, fonte: item.canal ? `${item.canal} · YouTube` : "YouTube", link: item.url })}
            remover={(id) => salvar({ ...extras, links: { itens: (extras.links?.itens || []).filter((item) => item.id !== id), geradoEm: extras.links?.geradoEm || Date.now() } })}
          />
        ) : null}
        {aba === "enem" ? <Enem nome={nome} icone={icone} temas={(extras.trilha?.itens || []).map((item) => item.titulo)} /> : null}
      </div>
      {visor ? <VisorEmbutido visor={visor} fechar={fecharVisor} /> : null}
    </section>
  );
}

type Fonte = { url: string; title?: string; domain?: string; snippet?: string };

/** Pede uma pesquisa à Mine e devolve só as fontes que a busca encontrou. */
/** Atalhos de pesquisa (YouTube, Khan Academy, Toda Matéria, Brasil Escola) para a matéria e os temas da trilha. */
function atalhosDePesquisa(nome: string, temas: string[]): LinkItem[] {
  const q = (texto: string) => encodeURIComponent(texto);
  const assuntos = temas.length ? temas.map((tema) => `${tema} ${nome}`) : [nome];
  const videos: LinkItem[] = assuntos.map((assunto) => ({
    id: novoId(),
    titulo: `Videoaulas: ${assunto}`,
    url: `https://www.youtube.com/results?search_query=${q(`videoaula ${assunto} ensino médio`)}`,
    dominio: "youtube.com",
    resumo: "Pesquisa pronta no YouTube com aulas sobre o tema.",
    tipo: "video",
  }));
  const sites: LinkItem[] = [
    { dominio: "pt.khanacademy.org", titulo: `Khan Academy: ${nome}`, url: `https://pt.khanacademy.org/search?page_search_query=${q(nome)}`, resumo: "Vídeos curtos e exercícios com correção na hora." },
    { dominio: "todamateria.com.br", titulo: `Toda Matéria: ${nome}`, url: `https://www.google.com/search?q=${q(`site:todamateria.com.br ${nome}`)}`, resumo: "Resumos e listas de exercícios resolvidos." },
    { dominio: "brasilescola.uol.com.br", titulo: `Brasil Escola: ${nome}`, url: `https://www.google.com/search?q=${q(`site:brasilescola.uol.com.br ${nome}`)}`, resumo: "Explicações por tema e questões de vestibular." },
  ].map((item) => ({ ...item, id: novoId(), tipo: "site" as const }));
  return [...videos, ...sites];
}

async function fontesDaWeb(q: string): Promise<Fonte[]> {
  const response = await fetch("/api/busca", { method: "POST", headers: mineHeaders(), body: JSON.stringify({ q }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "A busca não respondeu agora.");
  return (Array.isArray(data.results) ? data.results : []).filter((fonte: Fonte) => typeof fonte?.url === "string" && /^https:\/\//.test(fonte.url));
}

function Vazio({ icon: Icon, titulo, texto: corpo, botao, carregando, gerar }: { icon: LucideIcon; titulo: string; texto: string; botao: string; carregando: boolean; gerar: () => void }) {
  return (
    <div className="caderno-mx-vazio">
      <Icon className="h-7 w-7 opacity-60" aria-hidden />
      <div>
        <strong>{titulo}</strong>
        <p>{corpo}</p>
      </div>
      <button type="button" onClick={gerar} disabled={carregando} className="caderno-subj-next">
        {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        {carregando ? "A Mine está montando…" : botao}
      </button>
    </div>
  );
}

function Refazer({ carregando, gerar, label = "Gerar de novo" }: { carregando: boolean; gerar: () => void; label?: string }) {
  return (
    <button type="button" onClick={gerar} disabled={carregando} className="caderno-mx-mini">
      {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
      {carregando ? "montando…" : label}
    </button>
  );
}

/* ───────── Trilha ───────── */

const PROXIMO: Record<TrilhaItem["estado"], TrilhaItem["estado"]> = { falta: "estudando", estudando: "feito", feito: "falta" };
const ROTULO: Record<TrilhaItem["estado"], string> = { falta: "falta", estudando: "estudando", feito: "feito" };

function Trilha({ itens, carregando, gerar, mudar, estudar }: { itens: TrilhaItem[]; carregando: boolean; gerar: () => void; mudar: (itens: TrilhaItem[]) => void; estudar: (item: TrilhaItem) => void }) {
  if (!itens.length)
    return <Vazio icon={Route} titulo="A matéria em ordem, do básico ao avançado" texto="A Mine monta a sequência de temas e você marca o que já foi feito." botao="Montar a trilha" carregando={carregando} gerar={gerar} />;
  const feitos = itens.filter((item) => item.estado === "feito").length;
  return (
    <>
      <div className="caderno-mx-bar">
        <span className="tabular">
          {feitos} de {itens.length} temas feitos
        </span>
        <Refazer carregando={carregando} gerar={gerar} label="Refazer trilha" />
      </div>
      <ol className="caderno-mx-trilha">
        {itens.map((item, index) => (
          <li key={item.id} className={`is-${item.estado}`}>
            <span className="caderno-mx-trilha-num tabular" aria-hidden>
              {item.estado === "feito" ? <Check className="h-4 w-4" /> : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <strong>{item.titulo}</strong>
              {item.resumo ? <p>{item.resumo}</p> : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => mudar(itens.map((atual) => (atual.id === item.id ? { ...atual, estado: PROXIMO[atual.estado] } : atual)))}
                className={`caderno-mx-estado is-${item.estado}`}
                title="Trocar o estado"
              >
                {ROTULO[item.estado]}
              </button>
              <button type="button" onClick={() => estudar(item)} className="caderno-mx-mini">
                estudar com a Mine <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

/* ───────── Livros ───────── */

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

function Livros({ itens, carregando, gerar, mudar, abrir, notify }: { itens: LivroItem[]; carregando: boolean; gerar: () => void; mudar: (itens: LivroItem[]) => void; abrir: (livro: LivroItem) => void; notify: (message: string) => void }) {
  const [novo, setNovo] = useState({ titulo: "", autor: "" });
  const alterar = (id: string, parcial: Partial<LivroItem>) => mudar(itens.map((item) => (item.id === id ? { ...item, ...parcial } : item)));
  const ordem = { lendo: 0, quero: 1, sugerido: 2, lido: 3 } as const;
  const lista = itens.slice().sort((a, b) => ordem[estadoDe(a)] - ordem[estadoDe(b)]);
  const contar = (estado: LivroItem["estado"]) => itens.filter((item) => estadoDe(item) === estado).length;
  // Clicar no estado marcado desmarca (volta a sugerido); clicar em outro marca e avisa.
  const marcar = (livro: LivroItem, estado: "quero" | "lendo" | "lido") => {
    if (estadoDe(livro) === estado) {
      alterar(livro.id, { estado: "sugerido", marcado: false });
      notify(`"${livro.titulo}" voltou para as sugestões.`);
      return;
    }
    alterar(livro.id, { estado, marcado: true });
    notify(`"${livro.titulo}" ${ESTADO_AVISO[estado]}`);
  };
  return (
    <>
      {!itens.length ? (
        <Vazio icon={BookMarked} titulo="A estante desta matéria" texto="Livros didáticos, paradidáticos e obras de vestibular, com o que você está lendo e onde parou." botao="Sugerir livros" carregando={carregando} gerar={gerar} />
      ) : (
        <>
          <div className="caderno-mx-bar">
            <span className="tabular">
              {contar("quero")} quero ler · {contar("lendo")} lendo · {contar("lido")} lidos
            </span>
            <Refazer carregando={carregando} gerar={gerar} label="Sugerir mais" />
          </div>
          <div className="caderno-mx-livros">
            {lista.map((livro) => (
              <article key={livro.id} className={`caderno-mx-livro is-${livro.tipo}`}>
                <span className="caderno-mx-lombada" aria-hidden />
                {/* Capa: abre o leitor quando há prévia; sem capa, um livrinho desenhado. */}
                <button
                  type="button"
                  className={`caderno-mx-capa ${livro.leitura ? "is-legivel" : ""} ${livro.buscado !== LIVRO_VERSAO ? "is-carregando" : ""}`}
                  onClick={() => livro.leitura && abrir(livro)}
                  disabled={!livro.leitura}
                  aria-label={livro.leitura ? `Ler ${livro.titulo}` : `Capa de ${livro.titulo}`}
                  tabIndex={livro.leitura ? 0 : -1}
                >
                  {livro.capa ? <img src={livro.capa} alt="" loading="lazy" /> : <BookOpen className="h-6 w-6 opacity-50" aria-hidden />}
                </button>
                <div className="min-w-0 flex-1">
                  <span className="caderno-mx-chip">{TIPO_LIVRO[livro.tipo]}</span>
                  <h3>{livro.titulo}</h3>
                  {livro.autor ? <p className="caderno-mx-autor">{livro.autor}</p> : null}
                  {livro.porque ? <p className="caderno-mx-porque">{livro.porque}</p> : null}
                  {livro.leitura ? (
                    <button type="button" onClick={() => abrir(livro)} className="caderno-mx-ler">
                      <BookOpen className="h-4 w-4" />
                      {livro.leitura.tipo === "completo" ? "Ler o livro aqui" : "Ler a prévia aqui"}
                    </button>
                  ) : livro.buscado === LIVRO_VERSAO ? (
                    <p className="caderno-mx-semprevia">sem prévia grátis: procure na biblioteca da escola</p>
                  ) : (
                    <p className="caderno-mx-semprevia">procurando capa e prévia…</p>
                  )}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5" role="group" aria-label={`Leitura de ${livro.titulo}`}>
                    {(["quero", "lendo", "lido"] as const).map((estado) => {
                      const ativo = estadoDe(livro) === estado;
                      return (
                        <button
                          key={estado}
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => marcar(livro, estado)}
                          className="caderno-mx-seg"
                          title={ativo ? "Clique de novo para desmarcar" : undefined}
                        >
                          {ativo ? <Check className="h-3.5 w-3.5" aria-hidden /> : estado === "quero" ? <Plus className="h-3.5 w-3.5" aria-hidden /> : null}
                          {estado === "quero" ? "quero ler" : estado}
                        </button>
                      );
                    })}
                  </div>
                  {estadoDe(livro) === "lendo" || estadoDe(livro) === "lido" ? (
                    <input
                      className="caderno-mx-nota"
                      defaultValue={livro.nota || ""}
                      placeholder="onde parei (ex.: capítulo 4)"
                      aria-label={`Anotação de ${livro.titulo}`}
                      onBlur={(event) => {
                        const nota = event.currentTarget.value.trim().slice(0, 120);
                        if (nota !== (livro.nota || "")) alterar(livro.id, { nota });
                      }}
                    />
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
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
                  <button type="button" onClick={() => mudar(itens.filter((item) => item.id !== livro.id))} className="caderno-mx-icone" aria-label={`Tirar ${livro.titulo} da estante`} title="Tirar da estante">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      <form
        className="caderno-mx-add"
        onSubmit={(event) => {
          event.preventDefault();
          if (!novo.titulo.trim()) return;
          mudar([{ id: novoId(), titulo: novo.titulo.trim().slice(0, 120), autor: novo.autor.trim().slice(0, 80), tipo: "didatico", porque: "", estado: "lendo", marcado: true }, ...itens]);
          setNovo({ titulo: "", autor: "" });
        }}
      >
        <input value={novo.titulo} onChange={(event) => setNovo({ ...novo, titulo: event.target.value })} placeholder="Colocar um livro meu (título)" aria-label="Título do livro" />
        <input value={novo.autor} onChange={(event) => setNovo({ ...novo, autor: event.target.value })} placeholder="autor" aria-label="Autor do livro" />
        <button type="submit" className="caderno-mx-mini" disabled={!novo.titulo.trim()}>
          <Plus className="h-3.5 w-3.5" /> colocar
        </button>
      </form>
    </>
  );
}

/* ───────── Fórmulas ───────── */

function Formulas({ nome, itens, carregando, gerar, mudar }: { nome: string; itens: FormulaItem[]; carregando: boolean; gerar: () => void; mudar: (itens: FormulaItem[]) => void }) {
  const folha = useRef<HTMLDivElement>(null);
  const lista = useMemo(() => itens.slice().sort((a, b) => Number(Boolean(b.fixado)) - Number(Boolean(a.fixado))), [itens]);
  if (!itens.length)
    return <Vazio icon={Sigma} titulo="A folha de consulta da matéria" texto="Fórmulas mais cobradas (ou conceitos-chave), cada uma com quando usar. Fixe as importantes e imprima." botao="Montar a folha" carregando={carregando} gerar={gerar} />;

  function imprimir() {
    if (!folha.current) return;
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) return;
    const estilos = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((node) => node.outerHTML).join("");
    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Fórmulas — ${nome}</title>${estilos}<style>body{background:#fff;color:#111;padding:24px;font-family:system-ui,sans-serif}.caderno-mx-formula{break-inside:avoid;border:1px solid #ccc;box-shadow:none;background:#fff;color:#111}.caderno-mx-icone{display:none}</style></head><body><h1 style="font-size:22px;margin:0 0 16px">Folha de consulta — ${nome}</h1>${folha.current.innerHTML}</body></html>`,
    );
    doc.close();
    window.setTimeout(() => {
      frame.contentWindow?.print();
      window.setTimeout(() => frame.remove(), 1000);
    }, 400);
  }

  return (
    <>
      <div className="caderno-mx-bar">
        <span className="tabular">{itens.filter((item) => item.fixado).length} fixadas</span>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={imprimir} className="caderno-mx-mini">
            <Printer className="h-3.5 w-3.5" /> imprimir
          </button>
          <Refazer carregando={carregando} gerar={gerar} label="Refazer (mantém as fixadas)" />
        </div>
      </div>
      <div className="caderno-mx-formulas" ref={folha}>
        {lista.map((item) => (
          <article key={item.id} className={`caderno-mx-formula ${item.fixado ? "is-fixado" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <h3>{item.nome}</h3>
              <button
                type="button"
                onClick={() => mudar(itens.map((atual) => (atual.id === item.id ? { ...atual, fixado: !atual.fixado } : atual)))}
                className="caderno-mx-icone"
                aria-pressed={Boolean(item.fixado)}
                aria-label={item.fixado ? `Desafixar ${item.nome}` : `Fixar ${item.nome}`}
                title={item.fixado ? "Desafixar" : "Fixar no topo"}
              >
                {item.fixado ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </button>
            </div>
            {item.tipo === "formula" && item.expressao ? (
              <div className="caderno-mx-expr">
                <MineRichText text={`$$${item.expressao}$$`} />
              </div>
            ) : null}
            {item.explica ? <p>{item.explica}</p> : null}
          </article>
        ))}
      </div>
    </>
  );
}

/* ───────── Vídeos e links ───────── */

function Links({
  itens,
  carregando,
  gerar,
  abrir,
  remover,
}: {
  itens: LinkItem[];
  carregando: boolean;
  gerar: () => void;
  abrir: (item: LinkItem, videoId: string) => void;
  remover: (id: string) => void;
}) {
  if (!itens.length)
    return <Vazio icon={Video} titulo="Videoaulas e sites que valem a pena" texto="Vídeos do YouTube que tocam aqui mesmo, um por tema da trilha, e sites confiáveis para ler." botao="Buscar vídeos e links" carregando={carregando} gerar={gerar} />;
  // Vídeo com ID toca no player; atalho de pesquisa do YouTube continua como link.
  const tocaveis = itens.map((item) => ({ item, id: item.videoId || idDoYoutube(item.url) }));
  const videos = tocaveis.filter(({ id }) => id);
  const outros = tocaveis.filter(({ id }) => !id).map(({ item }) => item);
  return (
    <>
      <div className="caderno-mx-bar">
        <span className="tabular">
          {videos.length} vídeos · {outros.length} links
        </span>
        <Refazer carregando={carregando} gerar={gerar} label="Buscar de novo" />
      </div>
      {videos.length ? (
        <div className="caderno-mx-videos">
          {videos.map(({ item, id }) => (
            <article key={item.id} className="caderno-mx-video">
              <button type="button" onClick={() => abrir(item, id)} className="caderno-mx-video-capa" aria-label={`Assistir: ${item.titulo}`}>
                <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" loading="lazy" />
                <span className="caderno-mx-play" aria-hidden>
                  <Play className="h-5 w-5" />
                </span>
                {item.duracao ? <span className="caderno-mx-duracao tabular">{item.duracao}</span> : null}
              </button>
              <div className="flex items-start gap-1.5 pt-2">
                <button type="button" onClick={() => abrir(item, id)} className="min-w-0 flex-1 text-left">
                  <h3>{item.titulo}</h3>
                  {item.canal ? <p>{item.canal}</p> : null}
                </button>
                <button type="button" onClick={() => remover(item.id)} className="caderno-mx-icone" aria-label={`Tirar ${item.titulo}`} title="Tirar da lista">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {outros.length ? (
      <div className="caderno-mx-links mt-4">
        {outros.map((item) => (
          <article key={item.id} className={`caderno-mx-link is-${item.tipo}`}>
            <a href={item.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
              <span className="caderno-mx-chip">{item.tipo === "video" ? "▶ vídeo" : item.dominio || "site"}</span>
              <h3>{item.titulo}</h3>
              {item.resumo ? <p>{item.resumo}</p> : null}
            </a>
            <button type="button" onClick={() => remover(item.id)} className="caderno-mx-icone" aria-label={`Tirar ${item.titulo}`} title="Tirar da lista">
              <Trash2 className="h-4 w-4" />
            </button>
          </article>
        ))}
      </div>
      ) : null}
    </>
  );
}

/**
 * Leitor de livro / player de vídeo por cima da página. Vai para o <body> por
 * portal: os cartões animados têm transform, e `position: fixed` dentro deles
 * ficaria preso ao cartão.
 */
function VisorEmbutido({ visor, fechar }: { visor: Visor; fechar: () => void }) {
  const fecharRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    fecharRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") fechar();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      anterior?.focus?.();
    };
  }, [fechar]);
  return createPortal(
    <div className="caderno-mx-visor" role="dialog" aria-modal="true" aria-label={visor.titulo} onClick={(event) => event.target === event.currentTarget && fechar()}>
      <div className={`caderno-mx-visor-caixa is-${visor.tipo}`}>
        <header>
          <div className="min-w-0">
            <p className="caderno-mx-visor-fonte">{visor.fonte}</p>
            <h2>{visor.titulo}</h2>
          </div>
          {visor.link ? (
            <a href={visor.link} target="_blank" rel="noreferrer" className="caderno-mx-icone" aria-label="Abrir no YouTube" title="Abrir no YouTube">
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}
          <button ref={fecharRef} type="button" onClick={fechar} className="caderno-mx-icone" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="caderno-mx-visor-tela">
          <iframe
            src={visor.url}
            title={visor.titulo}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ───────── Questões do ENEM ───────── */

type QuestaoEnem = {
  titulo: string;
  ano: number;
  texto_base: string;
  figuras?: string[];
  comando: string;
  alternativas: Array<{ letra: string; texto: string; imagem: string }>;
  gabarito: string;
  fonte: string;
};

/** O texto-base do enem.dev é markdown com figuras `![](url)`: texto pelo MineRichText, figura como <img>. */
function TextoComFiguras({ texto: corpo }: { texto: string }) {
  const partes = corpo.split(/!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/);
  return (
    <>
      {partes.map((parte, index) =>
        index % 2 ? (
          <img key={`${parte}-${index}`} src={parte} alt="Figura da questão" loading="lazy" className="caderno-mx-figura" />
        ) : parte.trim() ? (
          <MineRichText key={index} text={parte.replace(/!\[[^\]]*\]\([^)]*\)/g, "")} />
        ) : null,
      )}
    </>
  );
}

function Enem({ nome, icone, temas }: { nome: string; icone: string; temas: string[] }) {
  const [area, setArea] = useState(() => areaEnem(nome, icone));
  const [tema, setTema] = useState("");
  const [estado, setEstado] = useState<{ status: "idle" | "loading" | "done" | "error"; questoes: QuestaoEnem[]; erro?: string }>({ status: "idle", questoes: [] });
  const [respostas, setRespostas] = useState<Record<number, string>>({});

  async function buscar() {
    setEstado({ status: "loading", questoes: [] });
    setRespostas({});
    try {
      const response = await fetch("/api/enem", { method: "POST", headers: mineHeaders(), body: JSON.stringify({ disciplina: area, tema, quantidade: 5 }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não consegui buscar questões agora.");
      const questoes = (Array.isArray(data.questoes) ? data.questoes : []) as QuestaoEnem[];
      setEstado({ status: "done", questoes, erro: questoes.length ? undefined : "Nenhuma questão com esse tema. Tente outro tema ou deixe em branco." });
    } catch (error) {
      setEstado({ status: "error", questoes: [], erro: error instanceof Error ? error.message : "Não consegui buscar questões agora." });
    }
  }

  const acertos = estado.questoes.filter((questao, index) => respostas[index] && respostas[index] === questao.gabarito).length;
  const respondidas = Object.keys(respostas).length;

  return (
    <>
      <form
        className="caderno-mx-enem-busca"
        onSubmit={(event) => {
          event.preventDefault();
          void buscar();
        }}
      >
        <label>
          <span>área</span>
          <select value={area} onChange={(event) => setArea(event.target.value)}>
            {Object.entries(AREAS_ENEM).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 flex-1">
          <span>tema (opcional)</span>
          <input value={tema} onChange={(event) => setTema(event.target.value)} placeholder="ex.: energia, eletricidade, ondas" list="mx-temas" />
          <datalist id="mx-temas">
            {temas.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>
        <button type="submit" className="caderno-subj-next" disabled={estado.status === "loading"}>
          {estado.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
          {estado.questoes.length ? "Outras questões" : "Buscar questões"}
        </button>
      </form>

      {estado.status === "idle" ? <p className="caderno-mx-dica">Questões oficiais de provas do ENEM de 2009 a 2023, com o gabarito. Responda antes de conferir.</p> : null}
      {estado.erro ? <p className="caderno-mx-dica">{estado.erro}</p> : null}

      {estado.questoes.length ? (
        <>
          <p className="caderno-mx-placar tabular" aria-live="polite">
            {respondidas ? `${acertos} de ${respondidas} certas` : `${estado.questoes.length} questões`}
          </p>
          <ol className="caderno-mx-questoes">
            {estado.questoes.map((questao, index) => {
              const marcada = respostas[index];
              return (
                <li key={`${questao.fonte}-${index}`} className="caderno-mx-questao">
                  <p className="caderno-mx-chip">{questao.fonte}</p>
                  {questao.texto_base ? (
                    <div className="caderno-mx-texto">
                      <TextoComFiguras texto={questao.texto_base} />
                    </div>
                  ) : null}
                  {(questao.figuras || []).map((url) => (
                    <img key={url} src={url} alt="Figura da questão" loading="lazy" className="caderno-mx-figura" />
                  ))}
                  {questao.comando ? <p className="caderno-mx-comando">{questao.comando}</p> : null}
                  <div className="grid gap-1.5" role="group" aria-label={`Alternativas da questão ${index + 1}`}>
                    {questao.alternativas.map((alternativa) => {
                      const letra = alternativa.letra;
                      const resultado = !marcada ? "" : letra === questao.gabarito ? "is-certa" : letra === marcada ? "is-errada" : "";
                      return (
                        <button
                          key={letra}
                          type="button"
                          disabled={Boolean(marcada)}
                          aria-pressed={marcada === letra}
                          aria-label={alternativa.texto ? undefined : `Alternativa ${letra} (imagem)`}
                          onClick={() => setRespostas((atual) => ({ ...atual, [index]: letra }))}
                          className={`caderno-mx-alt ${resultado}`}
                        >
                          <strong className="mr-1.5">{letra})</strong>
                          {alternativa.texto}
                          {alternativa.imagem ? <img src={alternativa.imagem} alt="" loading="lazy" className="caderno-mx-figura is-alt" /> : null}
                        </button>
                      );
                    })}
                  </div>
                  {marcada ? (
                    <p className={`caderno-mx-resultado ${marcada === questao.gabarito ? "is-certa" : "is-errada"}`}>
                      {marcada === questao.gabarito ? "Acertou!" : `Resposta certa: ${questao.gabarito}.`}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      ) : null}
    </>
  );
}
