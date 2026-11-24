import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bookmark, Check, ChevronLeft, ChevronRight, ExternalLink, Loader2, Play, RefreshCw, Shuffle } from "lucide-react";
import { mineHeaders } from "../../mineAuth";
import { MineInline } from "../MineRichText";
import "./blocos.css";
import "./videos.css";

/*
 * Vídeos do YouTube no chat e na aba Vídeos. A Mine não inventa IDs de vídeo,
 * escreve só o que buscar:
 *
 *   ```videos
 *   {"titulo": "Teorema de Pitágoras", "videos": [{"busca": "teorema de pitagoras explicacao", "sobre": "O conceito"}],
 *    "temas": ["Trigonometria", "Relações métricas"]}
 *   ```
 *
 * O navegador busca cada termo em /api/videos (busca do próprio YouTube, ver
 * mine/estante.mjs), pega o primeiro vídeo ainda não usado (guardando os
 * demais como reserva para o botão "Outro vídeo") e toca no player embutido
 * (youtube-nocookie) aqui mesmo.
 */

export type Pedido = { busca: string; sobre: string };
export type VideoBase = { id: string; titulo: string; canal: string; duracao: string; thumb: string };
export type Achado = VideoBase & { sobre: string; extras?: VideoBase[] };
export type PuloTempo = { segundos: number; chave: number };

const str = (value: unknown, max = 200) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Extrai o ID de 11 caracteres de um link do YouTube colado pelo estudante, ou "". */
export function extrairYoutubeId(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(String(rawUrl || "").trim());
  } catch {
    return "";
  }
  const host = url.hostname.replace(/^www\.|^m\.|^music\./, "");
  let id = "";
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0] || "";
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
    else id = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/)?.[1] || "";
  }
  return /^[\w-]{11}$/.test(id) ? id : "";
}

/** Trilha pedagógica em 4 etapas: entender, ver exemplos, praticar e revisar. */
export function pedidosPorTopico(topico: string, materiaNome?: string): Pedido[] {
  const limpo = str(topico, 90);
  const mat = str(materiaNome, 50);
  const contexto = mat && !limpo.toLowerCase().includes(mat.toLowerCase()) ? ` ${mat}` : "";
  return [
    { busca: `${limpo}${contexto} aula explicação`, sobre: "A explicação" },
    { busca: `${limpo}${contexto} exemplos`, sobre: "Exemplos práticos" },
    { busca: `${limpo}${contexto} exercícios resolvidos`, sobre: "Exercícios resolvidos" },
    { busca: `${limpo} resumo ENEM`, sobre: "Revisão rápida" },
  ];
}

export function lerVideos(data: Record<string, unknown>) {
  const titulo = str(data.titulo, 100) || str(data.tema, 100);
  const brutos = Array.isArray(data.videos) ? data.videos : Array.isArray(data.buscas) ? data.buscas : [];
  const pedidos: Pedido[] = brutos
    .map((raw) =>
      typeof raw === "string"
        ? { busca: str(raw, 120), sobre: "" }
        : raw && typeof raw === "object"
          ? { busca: str((raw as Record<string, unknown>).busca, 120) || str((raw as Record<string, unknown>).titulo, 120), sobre: str((raw as Record<string, unknown>).sobre, 160) }
          : { busca: "", sobre: "" },
    )
    .filter((p) => p.busca.length >= 3)
    .slice(0, 6);
  if (!pedidos.length && titulo) pedidos.push({ busca: `${titulo} aula`, sobre: "" });
  const temas = (Array.isArray(data.temas) ? data.temas : []).map((t) => str(t, 60)).filter(Boolean).slice(0, 8);
  return pedidos.length ? { titulo: titulo || "Vídeos recomendados", pedidos, temas } : null;
}

async function buscar(q: string): Promise<VideoBase[]> {
  const response = await fetch("/api/videos", { method: "POST", headers: mineHeaders(), body: JSON.stringify({ q }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não consegui buscar vídeos agora.");
  return Array.isArray(data.videos) ? data.videos : [];
}

/** Vídeo infantil (desenho, "para crianças") vai para o fim: o público é o ensino médio. */
const INFANTIL = /crian[cç]as|infantil| kids |show da luna|desenho animado|para pequenos|educa[cç][aã]o infantil|ensino fundamental 1/i;
const paraEnsinoMedio = <T extends { titulo: string; canal: string }>(lista: T[]) => [
  ...lista.filter((v) => !INFANTIL.test(`${v.titulo} ${v.canal}`)),
  ...lista.filter((v) => INFANTIL.test(`${v.titulo} ${v.canal}`)),
];

/** Um vídeo por pedido, sem repetir, guardando candidatos reservas para trocar se precisar. */
async function montarSerie(pedidos: Pedido[]): Promise<Achado[]> {
  const respostas = await Promise.all(pedidos.map((p) => buscar(p.busca).then(paraEnsinoMedio).catch(() => [])));
  const usados = new Set<string>();
  const serie: Achado[] = [];
  respostas.forEach((lista, i) => {
    const video = lista.find((v) => !usados.has(v.id));
    if (!video) return;
    usados.add(video.id);
    const extras = lista.filter((v) => v.id !== video.id && !usados.has(v.id)).slice(0, 4);
    serie.push({ ...video, sobre: pedidos[i].sobre, extras });
  });
  // Uma busca só rende uma série de até 5 vídeos.
  if (pedidos.length === 1) {
    for (const video of respostas[0] || []) {
      if (serie.length >= 5) break;
      if (!usados.has(video.id)) {
        usados.add(video.id);
        serie.push({ ...video, sobre: "", extras: [] });
      }
    }
  }
  return serie;
}

function Player({ video, pulo }: { video: Achado; pulo?: PuloTempo | null }) {
  const [tocando, setTocando] = useState(false);
  const [inicio, setInicio] = useState(0);
  const [chaveIframe, setChaveIframe] = useState(0);

  useEffect(() => {
    setTocando(false);
    setInicio(0);
  }, [video.id]);

  useEffect(() => {
    if (!pulo || !pulo.chave) return;
    setInicio(Math.max(0, Math.floor(pulo.segundos)));
    setTocando(true);
    setChaveIframe(pulo.chave);
  }, [pulo]);

  const params = new URLSearchParams({ autoplay: "1", rel: "0", modestbranding: "1" });
  if (inicio > 0) params.set("start", String(inicio));

  return (
    <div className="mbk-vid__tela">
      {tocando ? (
        <iframe
          key={`${video.id}:${chaveIframe}`}
          src={`https://www.youtube-nocookie.com/embed/${video.id}?${params.toString()}`}
          title={video.titulo}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button type="button" className="mbk-vid__capa" onClick={() => setTocando(true)} aria-label={`Assistir: ${video.titulo}`}>
          <img src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} alt="" loading="lazy" referrerPolicy="no-referrer" />
          <span className="mbk-vid__play" aria-hidden>
            <Play />
          </span>
          {video.duracao ? <span className="mbk-vid__dur">{video.duracao}</span> : null}
        </button>
      )}
    </div>
  );
}

export type SerieDeVideosProps = NonNullable<ReturnType<typeof lerVideos>> & {
  /** Quando o estudante colou um link direto do YouTube, já vem pronto sem buscar. */
  videosProntos?: Achado[];
  /** Na aba Vídeos usa os tokens de papel/painel do Caderno Vivo. */
  variante?: "chat" | "aba";
  /** Pulo de minutagem disparado pelo resumo da Mine. */
  pulo?: PuloTempo | null;
  /** IDs de vídeos marcados como assistidos pelo estudante. */
  vistos?: Set<string>;
  onToggleVisto?: (video: Achado, element: HTMLElement) => void;
  /** IDs de vídeos favoritados pelo estudante. */
  favoritos?: Set<string>;
  onToggleFavorito?: (video: Achado) => void;
  /** Avisa a aba Vídeos qual aula está aberta no palco agora. */
  onVideoChange?: (video: Achado | null, contexto: { indice: number; total: number; temaAtual: string }) => void;
};

export function SerieDeVideos({
  titulo,
  pedidos,
  temas,
  videosProntos,
  variante = "chat",
  pulo,
  vistos,
  onToggleVisto,
  favoritos,
  onToggleFavorito,
  onVideoChange,
}: SerieDeVideosProps) {
  const [tema, setTema] = useState("");
  const [serie, setSerie] = useState<Achado[] | null>(() => (videosProntos?.length ? videosProntos : null));
  const [erro, setErro] = useState(false);
  const [atual, setAtual] = useState(0);
  const [tentativa, setTentativa] = useState(0);
  const topo = useRef<HTMLElement>(null);
  const chave = useMemo(() => pedidos.map((p) => p.busca).join("|"), [pedidos]);
  const chaveProntos = useMemo(() => (videosProntos || []).map((v) => `${v.id}:${v.titulo}`).join("|"), [videosProntos]);

  useEffect(() => {
    if (videosProntos?.length && !tema) {
      setSerie(videosProntos);
      setErro(false);
      setAtual(0);
      return;
    }
    let ativo = true;
    setSerie(null);
    setErro(false);
    setAtual(0);
    // Nos temas vizinhos, mantém a trilha didática de 4 etapas se a série original tinha etapas.
    const lista = tema ? (pedidos.length > 1 ? pedidosPorTopico(tema) : [{ busca: `${tema} aula explicação`, sobre: "" }]) : pedidos;
    montarSerie(lista)
      .then((achados) => {
        if (!ativo) return;
        setSerie(achados);
        setErro(!achados.length);
      })
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, [chave, chaveProntos, tema, tentativa]); // eslint-disable-line react-hooks/exhaustive-deps

  const video = serie?.[atual] || null;
  const nome = tema || titulo;

  useEffect(() => {
    onVideoChange?.(video, { indice: atual, total: serie?.length || 0, temaAtual: nome });
  }, [video, atual, serie?.length, nome]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pulo?.chave) topo.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [pulo?.chave]);

  const escolher = (i: number) => {
    setAtual(i);
    topo.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const trocarVideoAtual = () => {
    if (!serie || !video?.extras?.length) return;
    const [proximo, ...resto] = video.extras;
    const atualComoReserva: VideoBase = { id: video.id, titulo: video.titulo, canal: video.canal, duracao: video.duracao, thumb: video.thumb };
    const nova = serie.map((item, idx) => (idx === atual ? { ...proximo, sobre: item.sobre, extras: [...resto, atualComoReserva] } : item));
    setSerie(nova);
  };

  const vistosNaSerie = serie && vistos ? serie.filter((v) => vistos.has(v.id)).length : 0;
  const vistoAtual = Boolean(video && vistos?.has(video.id));
  const favoritoAtual = Boolean(video && favoritos?.has(video.id));

  return (
    <section className={`mbk mbk-vid${variante === "aba" ? " is-aba" : ""}`} aria-label={`Vídeos: ${nome}`} ref={topo}>
      <header className="mbk-head">
        <strong>{nome}</strong>
        <span className="mbk-meta">
          {serie?.length
            ? `${atual + 1} de ${serie.length}${vistos && vistosNaSerie > 0 ? ` · ${vistosNaSerie} vista${vistosNaSerie > 1 ? "s" : ""}` : ""} · YouTube`
            : "YouTube"}
        </span>
      </header>

      {temas.length ? (
        <div className="mbk-vid__temas" role="group" aria-label="Temas relacionados">
          <button type="button" className={!tema ? "is-on" : ""} onClick={() => setTema("")} aria-pressed={!tema}>
            {titulo}
          </button>
          {temas.map((t) => (
            <button key={t} type="button" className={tema === t ? "is-on" : ""} onClick={() => setTema(t)} aria-pressed={tema === t}>
              {t}
            </button>
          ))}
        </div>
      ) : null}

      {serie === null && !erro ? (
        <div className="mbk-vid__carregando" role="status">
          <Loader2 className="mbk-vid__giro" aria-hidden /> Procurando as melhores videoaulas…
        </div>
      ) : erro || !video || !serie ? (
        <div className="mbk-vid__carregando" role="status">
          Não achei vídeos agora.
          <button type="button" className="mbk-btn" onClick={() => setTentativa((n) => n + 1)}>
            <RefreshCw aria-hidden /> Tentar de novo
          </button>
          <a className="mbk-btn is-ghost" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(pedidos[0]?.busca || nome)}`} target="_blank" rel="noreferrer noopener">
            <ExternalLink aria-hidden /> Buscar no YouTube
          </a>
        </div>
      ) : (
        <>
          <Player video={video} pulo={pulo} />
          <div className="mbk-vid__info">
            <div>
              <strong>{video.titulo}</strong>
              <span className="mbk-meta">
                {video.canal}
                {video.sobre ? (
                  <>
                    {" · "}
                    <MineInline text={video.sobre} />
                  </>
                ) : null}
              </span>
            </div>
            <div className="mbk-vid__nav">
              {onToggleVisto ? (
                <button
                  type="button"
                  className={`mbk-vid__chip-acao${vistoAtual ? " is-on" : ""}`}
                  onClick={(e) => onToggleVisto(video, e.currentTarget)}
                  aria-pressed={vistoAtual}
                  title={vistoAtual ? "Desmarcar como vista" : "Marcar aula como vista"}
                >
                  <Check aria-hidden />
                  <span>{vistoAtual ? "Vista" : "Marcar vista"}</span>
                </button>
              ) : null}
              {onToggleFavorito ? (
                <button
                  type="button"
                  className={`mbk-icon${favoritoAtual ? " is-fav" : ""}`}
                  onClick={() => onToggleFavorito(video)}
                  aria-pressed={favoritoAtual}
                  aria-label={favoritoAtual ? "Remover dos favoritos" : "Guardar nos favoritos"}
                  title={favoritoAtual ? "Guardado nos favoritos" : "Guardar nos favoritos"}
                >
                  <Bookmark aria-hidden />
                </button>
              ) : null}
              {video.extras?.length ? (
                <button
                  type="button"
                  className="mbk-icon"
                  onClick={trocarVideoAtual}
                  aria-label="Trocar por outro vídeo desta etapa"
                  title="Outro vídeo para esta etapa"
                >
                  <Shuffle aria-hidden />
                </button>
              ) : null}
              {serie.length > 1 ? (
                <>
                  <button type="button" className="mbk-icon" onClick={() => escolher(Math.max(0, atual - 1))} disabled={atual === 0} aria-label="Vídeo anterior" title="Vídeo anterior">
                    <ChevronLeft aria-hidden />
                  </button>
                  <button type="button" className="mbk-icon" onClick={() => escolher(Math.min(serie.length - 1, atual + 1))} disabled={atual >= serie.length - 1} aria-label="Próximo vídeo" title="Próximo vídeo">
                    <ChevronRight aria-hidden />
                  </button>
                </>
              ) : null}
              <a className="mbk-icon" href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer noopener" aria-label="Abrir no YouTube" title="Abrir no YouTube">
                <ExternalLink aria-hidden />
              </a>
            </div>
          </div>
          {serie.length > 1 ? (
            <ol className="mbk-vid__lista">
              {serie.map((item, i) => {
                const itemVisto = Boolean(vistos?.has(item.id));
                return (
                  <li key={item.id}>
                    <button type="button" className={`${i === atual ? "is-on" : ""}${itemVisto ? " is-visto" : ""}`} onClick={() => escolher(i)} aria-current={i === atual}>
                      <span className="mbk-vid__mini">
                        <img src={item.thumb || `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`} alt="" loading="lazy" referrerPolicy="no-referrer" />
                        <span className="mbk-vid__passo" aria-hidden>
                          {itemVisto ? <Check /> : i + 1}
                        </span>
                        {item.duracao ? <span className="mbk-vid__dur">{item.duracao}</span> : null}
                      </span>
                      <span className="mbk-vid__texto">
                        <span className="mbk-vid__nome">{item.titulo}</span>
                        <span className="mbk-meta">
                          {item.sobre ? `${item.sobre} · ${item.canal}` : item.canal}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : null}
        </>
      )}
    </section>
  );
}

/** Bloco ```videos do chat; JSON que não servir volta a ser código comum. */
export function BlocoVideos({ code, fallback }: { code: string; fallback: ReactNode }) {
  const parsed = useMemo(() => {
    const text = code.trim();
    try {
      const data = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
      return data && typeof data === "object" && !Array.isArray(data) ? lerVideos(data as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }, [code]);
  return parsed ? <SerieDeVideos {...parsed} /> : <>{fallback}</>;
}
