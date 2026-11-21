/*
  Imagem criada pela Mine no chat — o "criar imagem" do ChatGPT, no caderno.

  Ciclo de um marcador [[gerar_imagem: prompt | legenda | editar | paisagem]]:
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
  edição ajusta em vez de desenhar do zero ("deixa o fundo azul"). Com
  "anexo" (nov/2026), a referência é a foto que o estudante mandou na
  pergunta ("transforma essa foto em anime"). "paisagem"/"retrato" mudam o
  formato da imagem nova.
*/
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Expand, PencilLine, RefreshCw, X } from "lucide-react";
import { imageKey, loadImage, saveImage } from "./imageStore";
import "./mine-generated.css";

type Formato = "paisagem" | "retrato" | undefined;
type Quota = { used: number; limit: number };

const freshKeys = new Set<string>();
const inflight = new Map<string, Promise<{ blob: Blob; quota?: Quota }>>();
let lastImageKey = "";

/** O texto que identifica a imagem: o prompt e, se houver, o formato. */
function keySource(prompt: string, formato: Formato) {
  return formato ? `${prompt} [${formato}]` : prompt;
}

/**
 * Chamado pelo balão em streaming: este prompt nasceu agora, pode gerar. Vale
 * pelo prompt só: a versão final da resposta pode chegar com o formato ou o
 * "anexo" que o servidor completou, e ainda é a mesma imagem nova.
 */
export function markFreshImage(prompt: string) {
  freshKeys.add(prompt);
}

/** Escreve na caixa do chat (MineView escuta), para pedir um ajuste. */
export function askToAdjust(text: string) {
  window.dispatchEvent(new CustomEvent("mine:escrever", { detail: text }));
}

function sessionToken() {
  try {
    return (JSON.parse(localStorage.getItem("minerva-session-v1") || "{}") as { token?: string }).token || "";
  } catch {
    return "";
  }
}

/** Imagem reduzida a 1024px em JPEG: é o que vai como referência de edição. */
async function shrink(source: Blob) {
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

async function referenceFrom(key: string, attachment?: string) {
  if (attachment) return shrink(await (await fetch(attachment)).blob());
  if (!key) return "";
  const stored = await loadImage(key);
  return stored ? shrink(stored.blob) : "";
}

class ImageError extends Error {
  quota: boolean;
  constructor(message: string, quota = false) {
    super(message);
    this.quota = quota;
  }
}

async function requestImage(
  options: { prompt: string; edit: boolean; key: string; formato: Formato; attachment?: string },
  force = false,
): Promise<{ blob: Blob; quota?: Quota }> {
  const { prompt, edit, key, formato, attachment } = options;
  const running = inflight.get(key);
  if (running && !force) return running;
  const job = (async () => {
    const reference = attachment || edit ? await referenceFrom(lastImageKey, attachment).catch(() => "") : "";
    let response: Response;
    try {
      response = await fetch("/api/mine-imagem", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${sessionToken()}` },
        body: JSON.stringify({ prompt, ...(reference ? { reference } : {}), ...(formato ? { formato } : {}) }),
      });
    } catch {
      throw new ImageError("Sem conexão com o servidor agora.");
    }
    const payload = (await response.json().catch(() => ({}))) as { image?: string; error?: string; code?: string; used?: number; limit?: number };
    if (!response.ok || !payload.image) throw new ImageError(payload.error || "A Mine não conseguiu desenhar agora.", payload.code === "quota");
    const blob = await (await fetch(payload.image)).blob();
    await saveImage({ key, blob, prompt, createdAt: Date.now() });
    const quota = typeof payload.used === "number" && typeof payload.limit === "number" ? { used: payload.used, limit: payload.limit } : undefined;
    return { blob, quota };
  })();
  inflight.set(key, job);
  job.finally(() => inflight.delete(key)).catch(() => undefined);
  return job;
}

type State =
  | { kind: "loading" }
  | { kind: "drawing"; started: number }
  | { kind: "done"; url: string; type: string; quota?: Quota; fresh?: boolean }
  | { kind: "missing" }
  | { kind: "error"; message: string; quota: boolean };

/** O rabisco do lápis: traços que se desenham e se apagam em ciclo. */
function Sketching({ started, caption, shape, editing }: { started: number; caption?: string; shape: string; editing: boolean }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [started]);
  return (
    <div className={`mine-gen-card is-drawing ${shape}`} role="status" aria-live="polite">
      <span className="mine-gen-dots" aria-hidden />
      <svg className="mine-gen-sketch" viewBox="0 0 200 200" aria-hidden>
        <path pathLength={1} d="M40 150 C 60 90, 90 60, 130 70 S 170 120, 150 150" />
        <path pathLength={1} d="M70 120 C 80 100, 110 95, 120 115" />
        <path pathLength={1} d="M55 60 l 20 -12 M 140 45 l 14 10 M 100 30 v 14" />
        <circle pathLength={1} cx="100" cy="105" r="46" />
      </svg>
      <span className="mine-gen-pencil" aria-hidden>✏️</span>
      <p className="mine-gen-status">
        {editing ? "A Mine está editando a imagem" : "A Mine está desenhando"}
        {caption ? `: ${caption}` : ""}…
        <small>{seconds > 2 ? `${seconds}s · costuma levar uns 15s` : "começando o rascunho"}</small>
      </p>
    </div>
  );
}

export function MineGeneratedImage({
  prompt,
  caption,
  edit = false,
  streaming = false,
  formato,
  attachment,
}: {
  prompt: string;
  caption?: string;
  edit?: boolean;
  streaming?: boolean;
  formato?: Formato;
  /** Foto que o estudante anexou na pergunta (marcador com "anexo"). */
  attachment?: string;
}) {
  const key = imageKey(keySource(prompt, formato), edit);
  const shape = formato ? `is-${formato}` : "";
  const [state, setState] = useState<State>(streaming ? { kind: "drawing", started: Date.now() } : { kind: "loading" });
  const [zoom, setZoom] = useState(false);
  const urlRef = useRef("");

  const show = useCallback(
    (blob: Blob, quota?: Quota, fresh = false) => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      lastImageKey = key;
      setState({ kind: "done", url: urlRef.current, type: blob.type, quota, fresh });
    },
    [key],
  );

  const generate = useCallback(
    (force = false) => {
      setState({ kind: "drawing", started: Date.now() });
      requestImage({ prompt, edit, key, formato, attachment }, force)
        .then((result) => show(result.blob, result.quota, true))
        .catch((error: unknown) =>
          setState({ kind: "error", message: error instanceof Error ? error.message : "A Mine não conseguiu desenhar agora.", quota: error instanceof ImageError && error.quota }),
        );
    },
    [prompt, edit, key, formato, attachment, show],
  );

  useEffect(() => {
    if (streaming) {
      markFreshImage(prompt);
      return;
    }
    let alive = true;
    loadImage(key).then((stored) => {
      if (!alive) return;
      if (stored) show(stored.blob);
      else if (freshKeys.has(prompt) || inflight.has(key)) {
        freshKeys.delete(prompt);
        generate();
      } else setState({ kind: "missing" });
    });
    return () => {
      alive = false;
    };
  }, [key, streaming, prompt, edit, formato, show, generate]);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setZoom(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  if (state.kind === "loading") return <div className={`mine-gen-card is-loading ${shape}`} aria-hidden />;
  if (state.kind === "drawing") return <Sketching started={state.started} caption={caption} shape={shape} editing={edit} />;
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

  const extension = state.type === "image/jpeg" ? "jpg" : state.type === "image/webp" ? "webp" : "png";
  const fileName = `mine-${(caption || "imagem").toLowerCase().replace(/[^a-z0-9à-ú]+/gi, "-").slice(0, 40)}.${extension}`;
  const left = state.quota ? Math.max(0, state.quota.limit - state.quota.used) : null;
  return (
    <figure className={`mine-gen-figure ${shape}`}>
      <button type="button" className={`mine-gen-frame${state.fresh ? " is-fresca" : ""}`} onClick={() => setZoom(true)} aria-label={`Ampliar imagem${caption ? `: ${caption}` : ""}`}>
        <img src={state.url} alt={caption || "Imagem criada pela Mine"} />
      </button>
      <figcaption>
        <span className="mine-gen-caption">
          {caption || "Imagem criada pela Mine"}
          {left !== null ? <small>{left === 0 ? "era a última imagem de hoje" : `${left} ${left === 1 ? "imagem restante" : "imagens restantes"} hoje`}</small> : null}
        </span>
        <span className="mine-gen-actions">
          <button type="button" onClick={() => askToAdjust("Ajuste a imagem: ")} aria-label="Pedir um ajuste nesta imagem" title="Ajustar (escreva o que mudar)">
            <PencilLine className="h-4 w-4" />
          </button>
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
