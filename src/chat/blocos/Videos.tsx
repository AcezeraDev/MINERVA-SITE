import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Play, RefreshCw } from "lucide-react";
import { mineHeaders } from "../../mineAuth";
import { MineInline } from "../MineRichText";
import "./blocos.css";
import "./videos.css";

/*
 * Vídeos do YouTube no chat (23/nov/2026). A Mine não sabe IDs de vídeo, então
 * escreve só o que buscar:
 *
 *   ```videos
 *   {"titulo": "Teorema de Pitágoras", "videos": [{"busca": "teorema de pitagoras explicacao", "sobre": "O conceito"}],
 *    "temas": ["Trigonometria", "Relações métricas"]}
 *   ```
 *
 * O navegador busca cada termo em /api/videos (busca do próprio YouTube, ver
 * mine/estante.mjs), pega o primeiro vídeo ainda não usado e toca no player
 * embutido (youtube-nocookie) aqui mesmo. Os "temas" viram botões que trocam
 * a série de vídeos sem sair do bloco.
 */

type Pedido = { busca: string; sobre: string };
type Achado = { id: string; titulo: string; canal: string; duracao: string; thumb: string; sobre: string };

const str = (value: unknown, max = 200) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

export function lerVideos(data: Record<string, unknown>) {
  const titulo = str(data.titulo, 100) || str(data.tema, 100);
  const brutos = Array.isArray(data.videos) ? data.videos : Array.isArray(data.buscas) ? data.buscas : [];
  const pedidos: Pedido[] = brutos
    .map((raw) => (typeof raw === "string" ? { busca: str(raw, 120), sobre: "" } : raw && typeof raw === "object" ? { busca: str((raw as Record<string, unknown>).busca, 120) || str((raw as Record<string, unknown>).titulo, 120), sobre: str((raw as Record<string, unknown>).sobre, 160) } : { busca: "", sobre: "" }))
    .filter((p) => p.busca.length >= 3)
    .slice(0, 6);
  if (!pedidos.length && titulo) pedidos.push({ busca: `${titulo} aula`, sobre: "" });
  const temas = (Array.isArray(data.temas) ? data.temas : []).map((t) => str(t, 60)).filter(Boolean).slice(0, 8);
  return pedidos.length ? { titulo: titulo || "Vídeos recomendados", pedidos, temas } : null;
}

async function buscar(q: string): Promise<Omit<Achado, "sobre">[]> {
  const response = await fetch("/api/videos", { method: "POST", headers: mineHeaders(), body: JSON.stringify({ q }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não consegui buscar vídeos agora.");
  return Array.isArray(data.videos) ? data.videos : [];
}

/** Vídeo infantil (desenho, "para crianças") vai para o fim: o público é o ensino médio. */
const INFANTIL = /crian[cç]as|infantil|kids|show da luna|desenho animado|para pequenos|educa[cç][aã]o infantil|ensino fundamental 1/i;
const paraEnsinoMedio = <T extends { titulo: string; canal: string }>(lista: T[]) => [...lista.filter((v) => !INFANTIL.test(`${v.titulo} ${v.canal}`)), ...lista.filter((v) => INFANTIL.test(`${v.titulo} ${v.canal}`))];

/** Um vídeo por pedido, sem repetir; pedido sem resultado novo completa com sobras. */
async function montarSerie(pedidos: Pedido[]): Promise<Achado[]> {
  const respostas = await Promise.all(pedidos.map((p) => buscar(p.busca).then(paraEnsinoMedio).catch(() => [])));
  const usados = new Set<string>();
  const serie: Achado[] = [];
  respostas.forEach((lista, i) => {
    const video = lista.find((v) => !usados.has(v.id));
    if (!video) return;
    usados.add(video.id);
    serie.push({ ...video, sobre: pedidos[i].sobre });
  });
  // Uma busca só (tema escolhido num botão) rende uma série de até 5.
  if (pedidos.length === 1) {
    for (const video of respostas[0] || []) {
      if (serie.length >= 5) break;
      if (!usados.has(video.id)) {
        usados.add(video.id);
        serie.push({ ...video, sobre: "" });
      }
    }
  }
  return serie;
}

function Player({ video }: { video: Achado }) {
  const [tocando, setTocando] = useState(false);
  useEffect(() => setTocando(false), [video.id]);
  return (
    <div className="mbk-vid__tela">
      {tocando ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1`}
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

export function SerieDeVideos({ titulo, pedidos, temas }: NonNullable<ReturnType<typeof lerVideos>>) {
  const [tema, setTema] = useState("");
  const [serie, setSerie] = useState<Achado[] | null>(null);
  const [erro, setErro] = useState(false);
  const [atual, setAtual] = useState(0);
  const [tentativa, setTentativa] = useState(0);
  const topo = useRef<HTMLElement>(null);
  const chave = useMemo(() => pedidos.map((p) => p.busca).join("|"), [pedidos]);

  useEffect(() => {
    let ativo = true;
    setSerie(null);
    setErro(false);
    setAtual(0);
    const lista = tema ? [{ busca: `${tema} aula explicação`, sobre: "" }] : pedidos;
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
  }, [chave, tema, tentativa]); // eslint-disable-line react-hooks/exhaustive-deps

  const escolher = (i: number) => {
    setAtual(i);
    topo.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const video = serie?.[atual];
  const nome = tema || titulo;

  return (
    <section className="mbk mbk-vid" aria-label={`Vídeos: ${nome}`} ref={topo}>
      <header className="mbk-head">
        <strong>{nome}</strong>
        <span className="mbk-meta">{serie?.length ? `${atual + 1} de ${serie.length} · YouTube` : "YouTube"}</span>
      </header>

      {temas.length ? (
        <div className="mbk-vid__temas" role="group" aria-label="Escolha um tema">
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
          <Loader2 className="mbk-vid__giro" aria-hidden /> Procurando os melhores vídeos…
        </div>
      ) : erro || !video ? (
        <div className="mbk-vid__carregando" role="status">
          Não achei vídeos agora.
          <button type="button" className="mbk-btn" onClick={() => setTentativa((n) => n + 1)}>
            <RefreshCw aria-hidden /> Tentar de novo
          </button>
          <a className="mbk-btn" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(pedidos[0]?.busca || nome)}`} target="_blank" rel="noreferrer noopener">
            <ExternalLink aria-hidden /> Buscar no YouTube
          </a>
        </div>
      ) : (
        <>
          <Player video={video} />
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
              <button type="button" className="mbk-icon" onClick={() => escolher(Math.max(0, atual - 1))} disabled={atual === 0} aria-label="Vídeo anterior">
                <ChevronLeft aria-hidden />
              </button>
              <button type="button" className="mbk-icon" onClick={() => escolher(Math.min(serie!.length - 1, atual + 1))} disabled={atual >= serie!.length - 1} aria-label="Próximo vídeo">
                <ChevronRight aria-hidden />
              </button>
              <a className="mbk-icon" href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer noopener" aria-label="Abrir no YouTube" title="Abrir no YouTube">
                <ExternalLink aria-hidden />
              </a>
            </div>
          </div>
          {serie!.length > 1 ? (
            <ol className="mbk-vid__lista">
              {serie!.map((item, i) => (
                <li key={item.id}>
                  <button type="button" className={i === atual ? "is-on" : ""} onClick={() => escolher(i)} aria-current={i === atual}>
                    <span className="mbk-vid__mini">
                      <img src={item.thumb || `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`} alt="" loading="lazy" referrerPolicy="no-referrer" />
                      {item.duracao ? <span className="mbk-vid__dur">{item.duracao}</span> : null}
                    </span>
                    <span className="mbk-vid__texto">
                      <span className="mbk-vid__nome">{item.titulo}</span>
                      <span className="mbk-meta">{item.sobre || item.canal}</span>
                    </span>
                  </button>
                </li>
              ))}
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
