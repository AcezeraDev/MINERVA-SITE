/*
  Fotos de verdade nos sites do MineCode.

  A Mine escreve <img data-mine-imagem="descrição da foto" ...> sem src (regra
  da skill de front-end). O código do editor fica só com o marcador — leve, e
  a Mine continua lendo a descrição nas próximas mensagens. Na hora de mostrar
  no monitor (ou baixar), withSiteImages coloca no src a foto criada por
  /api/mine-imagem com { uso: "site" } (cota própria do servidor).

  Cada foto é reduzida a 1280px em JPEG e guardada no IndexedDB do aparelho
  (imageStore, chave do prompt), então reabrir o site não gasta a cota de novo.
*/
import { imageKey, loadImage, saveImage } from "./imageStore";

export const SITE_IMAGE_LIMIT = 4;
const ATTR = "data-mine-imagem";
const IMG_WITH_MARKER = /<img\b([^>]*?)\sdata-mine-imagem\s*=\s*"([^"]*)"([^>]*)>/gi;

function decode(text: string) {
  return text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").trim();
}

/** Descrições das fotos pedidas no código, sem repetir, até o limite. */
export function sitePhotoPrompts(code: string): string[] {
  const found: string[] = [];
  for (const match of code.matchAll(IMG_WITH_MARKER)) {
    const prompt = decode(match[2]);
    if (prompt && !found.includes(prompt)) found.push(prompt);
    if (found.length >= SITE_IMAGE_LIMIT) break;
  }
  return found;
}

/** Placeholder enquanto a foto não chega (ou se ela falhar). */
function placeholder(label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#1b2420"/><stop offset="1" stop-color="#0d1210"/></linearGradient></defs><rect width="1200" height="900" fill="url(#g)"/><text x="600" y="460" fill="#2fd483" fill-opacity=".7" font-family="monospace" font-size="34" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Troca cada marcador pela foto pronta (ou por um placeholder). */
export function withSiteImages(code: string, photos: Record<string, string>, failed: Record<string, boolean> = {}) {
  let index = 0;
  return code.replace(IMG_WITH_MARKER, (_all, before: string, raw: string, after: string) => {
    const prompt = decode(raw);
    const rest = `${before} ${ATTR}="${raw}"${after}`.replace(/\ssrc\s*=\s*"[^"]*"/i, "");
    index += 1;
    const url = photos[prompt] || placeholder(failed[prompt] ? "sem foto agora" : index > SITE_IMAGE_LIMIT ? "foto extra" : "criando a foto…");
    return `<img src="${url}"${rest}>`;
  });
}

function sessionToken() {
  try {
    return (JSON.parse(localStorage.getItem("minerva-session-v1") || "{}") as { token?: string }).token || "";
  } catch {
    return "";
  }
}

async function shrink(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((out) => resolve(out || blob), "image/jpeg", 0.85));
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export class SitePhotoError extends Error {
  quota: boolean;
  constructor(message: string, quota = false) {
    super(message);
    this.quota = quota;
  }
}

const memory = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

/** Uma foto do site: do cache, do aparelho ou criada agora. Devolve um data URL. */
export function sitePhoto(prompt: string): Promise<string> {
  const cached = memory.get(prompt);
  if (cached) return Promise.resolve(cached);
  const running = inflight.get(prompt);
  if (running) return running;
  const key = imageKey(`site:${prompt}`);
  const job = (async () => {
    const stored = await loadImage(key).catch(() => undefined);
    let blob = stored?.blob;
    if (!blob) {
      let response: Response;
      try {
        response = await fetch("/api/mine-imagem", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${sessionToken()}` },
          body: JSON.stringify({ prompt: `${prompt}. Fotografia profissional para site, alta qualidade, sem texto escrito na imagem.`, uso: "site" }),
        });
      } catch {
        throw new SitePhotoError("Sem conexão para criar as fotos agora.");
      }
      const payload = (await response.json().catch(() => ({}))) as { image?: string; error?: string; code?: string };
      if (!response.ok || !payload.image) throw new SitePhotoError(payload.error || "A Mine não conseguiu criar a foto agora.", payload.code === "quota");
      blob = await shrink(await (await fetch(payload.image)).blob());
      await saveImage({ key, blob, prompt, createdAt: Date.now() }).catch(() => undefined);
    }
    const url = await toDataUrl(blob);
    memory.set(prompt, url);
    return url;
  })();
  inflight.set(prompt, job);
  job.finally(() => inflight.delete(prompt)).catch(() => undefined);
  return job;
}

/** Já tem tudo guardado? (não precisa mostrar "criando fotos"). */
export function cachedSitePhoto(prompt: string) {
  return memory.get(prompt);
}
