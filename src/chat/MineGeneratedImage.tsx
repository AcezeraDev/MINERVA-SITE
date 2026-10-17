/*
  Imagem criada pela Mine no chat — o "criar imagem" do ChatGPT, no caderno.

  Ciclo de um marcador [[gerar_imagem: prompt | legenda | editar]]:
  1. Enquanto a resposta chega (streaming), o cartão mostra a Mine rabiscando
     a lápis e marca o prompt como "novo" (freshKeys).
  2. Quando a resposta termina, o cartão definitivo vê que o prompt é novo e
     pede a imagem a /api/mine-imagem (uma vez só, mesmo que remonte: o
     pedido em andamento fica em `inflight`).
  3. A imagem vai para o IndexedDB do aparelho (imageStore). Reabrir a
     conversa mostra a mesma imagem sem gastar a cota de novo.
  4. Mensagem antiga sem imagem guardada (outro aparelho, cache limpo) não
     gasta nada sozinha: mostra "Criar de novo".

  Com "editar", a última imagem mostrada vai como referência e o modelo de
  edição ajusta em vez de desenhar do zero ("deixa o fundo azul").
*/
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Expand, RefreshCw, X } from "lucide-react";
import { imageKey, loadImage, saveImage } from "./imageStore";
import "./mine-generated.css";

const freshKeys = new Set<string>();
const inflight = new Map<string, Promise<Blob>>();
let lastImageKey = "";

/** Chamado pelo balão em streaming: este prompt nasceu agora, pode gerar. */
export function markFreshImage(prompt: string, edit: boolean) {
  freshKeys.add(imageKey(prompt, edit));
}

function sessionToken() {
  try {
    return (JSON.parse(localStorage.getItem("minerva-session-v1") || "{}") as { token?: string }).token || "";
  } catch {
    return "";
  }
}

/** Referência para edição: a última imagem, reduzida a 1024px em JPEG. */
async function referenceFrom(key: string) {
  if (!key) return "";
  const stored = await loadImage(key);
  if (!stored) return "";
  const bitmap = await createImageBitmap(stored.blob);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

class ImageError extends Error {
  quota: boolean;
  constructor(message: string, quota = false) {
    super(message);
    this.quota = quota;
  }
}

async function requestImage(prompt: string, edit: boolean, key: string, force = false): Promise<Blob> {
  const running = inflight.get(key);
  if (running && !force) return running;
  const job = (async () => {
    const reference = edit ? await referenceFrom(lastImageKey).catch(() => "") : "";
    let response: Response;
    try {
      response = await fetch("/api/mine-imagem", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${sessionToken()}` },
        body: JSON.stringify({ prompt, ...(reference ? { reference } : {}) }),
      });
    } catch {
      throw new ImageError("Sem conexão com o servidor agora.");
    }
    const payload = (await response.json().catch(() => ({}))) as { image?: string; error?: string; code?: string };
    if (!response.ok || !payload.image) throw new ImageError(payload.error || "A Mine não conseguiu desenhar agora.", payload.code === "quota");
    const blob = await (await fetch(payload.image)).blob();
    await saveImage({ key, blob, prompt, createdAt: Date.now() });
    return blob;
  })();
  inflight.set(key, job);
  job.finally(() => inflight.delete(key)).catch(() => undefined);
  return job;
}

type State =
  | { kind: "loading" }
  | { kind: "drawing"; started: number }
  | { kind: "done"; url: string }
  | { kind: "missing" }
  | { kind: "error"; message: string; quota: boolean };

/** O rabisco do lápis: traços que se desenham e se apagam em ciclo. */
function Sketching({ started, caption }: { started: number; caption?: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [started]);
  return (
    <div className="mine-gen-card is-drawing" role="status" aria-live="polite">
      <svg className="mine-gen-sketch" viewBox="0 0 200 200" aria-hidden>
        <path pathLength={1} d="M40 150 C 60 90, 90 60, 130 70 S 170 120, 150 150" />
        <path pathLength={1} d="M70 120 C 80 100, 110 95, 120 115" />
        <path pathLength={1} d="M55 60 l 20 -12 M 140 45 l 14 10 M 100 30 v 14" />
        <circle pathLength={1} cx="100" cy="105" r="46" />
      </svg>
      <span className="mine-gen-pencil" aria-hidden>✏️</span>
      <p className="mine-gen-status">
        A Mine está desenhando{caption ? `: ${caption}` : ""}…
        <small>{seconds > 2 ? `${seconds}s` : "começando o rascunho"}</small>
      </p>
    </div>
  );
}

export function MineGeneratedImage({
  prompt,
  caption,
  edit = false,
  streaming = false,
}: {
  prompt: string;
  caption?: string;
  edit?: boolean;
  streaming?: boolean;
}) {
  const key = imageKey(prompt, edit);
  const [state, setState] = useState<State>(streaming ? { kind: "drawing", started: Date.now() } : { kind: "loading" });
  const [zoom, setZoom] = useState(false);
  const urlRef = useRef("");

  const show = useCallback(
    (blob: Blob) => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      lastImageKey = key;
      setState({ kind: "done", url: urlRef.current });
    },
    [key],
  );

  const generate = useCallback(
    (force = false) => {
      setState({ kind: "drawing", started: Date.now() });
      requestImage(prompt, edit, key, force)
        .then(show)
        .catch((error: unknown) =>
          setState({ kind: "error", message: error instanceof Error ? error.message : "A Mine não conseguiu desenhar agora.", quota: error instanceof ImageError && error.quota }),
        );
    },
    [prompt, edit, key, show],
  );

  useEffect(() => {
    if (streaming) {
      markFreshImage(prompt, edit);
      return;
    }
    let alive = true;
    loadImage(key).then((stored) => {
      if (!alive) return;
      if (stored) show(stored.blob);
      else if (freshKeys.has(key) || inflight.has(key)) {
        freshKeys.delete(key);
        generate();
      } else setState({ kind: "missing" });
    });
    return () => {
      alive = false;
    };
  }, [key, streaming, prompt, edit, show, generate]);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setZoom(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  if (state.kind === "loading") return <div className="mine-gen-card is-loading" aria-hidden />;
  if (state.kind === "drawing") return <Sketching started={state.started} caption={caption} />;
  if (state.kind === "missing" || state.kind === "error") {
    return (
      <div className={`mine-gen-card is-note ${state.kind === "error" ? "is-error" : ""}`}>
        <p>
          {state.kind === "error" ? state.message : "Esta imagem foi criada em outro aparelho ou momento."}
          {caption ? <small>{caption}</small> : null}
        </p>
        {state.kind === "error" && state.quota ? null : (
          <button type="button" onClick={() => generate(true)}>
            <RefreshCw className="h-4 w-4" />
            {state.kind === "error" ? "Tentar de novo" : "Criar de novo"}
          </button>
        )}
      </div>
    );
  }

  const fileName = `mine-${(caption || "imagem").toLowerCase().replace(/[^a-z0-9à-ú]+/gi, "-").slice(0, 40)}.png`;
  return (
    <figure className="mine-gen-figure">
      <button type="button" className="mine-gen-frame" onClick={() => setZoom(true)} aria-label={`Ampliar imagem${caption ? `: ${caption}` : ""}`}>
        <img src={state.url} alt={caption || "Imagem criada pela Mine"} />
      </button>
      <figcaption>
        <span>{caption || "Imagem criada pela Mine"}</span>
        <span className="mine-gen-actions">
          <button type="button" onClick={() => setZoom(true)} aria-label="Ampliar" title="Ampliar">
            <Expand className="h-4 w-4" />
          </button>
          <a href={state.url} download={fileName} aria-label="Baixar" title="Baixar">
            <Download className="h-4 w-4" />
          </a>
          <button type="button" onClick={() => generate(true)} aria-label="Criar outra versão" title="Criar outra versão">
            <RefreshCw className="h-4 w-4" />
          </button>
        </span>
      </figcaption>
      {zoom
        ? createPortal(
            <div className="mine-gen-lightbox" role="dialog" aria-modal="true" aria-label="Imagem ampliada" onClick={() => setZoom(false)}>
              <img src={state.url} alt={caption || "Imagem criada pela Mine"} onClick={(event) => event.stopPropagation()} />
              <button type="button" className="mine-gen-close" onClick={() => setZoom(false)} aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>,
            document.body,
          )
        : null}
    </figure>
  );
}
