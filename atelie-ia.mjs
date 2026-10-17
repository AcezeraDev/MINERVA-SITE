/**
 * Ateliê da Mine: foto → folha de colorir por um modelo de edição de imagem
 * da NanoGPT (mesma chave da Mine).
 *
 * O conversor local do navegador continua sendo o padrão; este é o botão
 * "Caprichar com a Mine". Cada chamada custa dinheiro, então o servidor
 * impõe um teto diário por conta (`dailyLimit`), contado no banco.
 */
import { nanogptBaseUrl, nanogptKeys } from "./mine/providers.mjs";

// Escolhidos num teste comparativo (30/set/2026, 9 modelos × gato, retrato e
// paisagem): o Step Image Edit 2 foi o de traço mais limpo e o mais barato
// (US$ 0,003, ~15 s); o P-Image Edit (US$ 0,01) ficou em segundo e entra se o
// primeiro falhar. Seedream recusou o retrato por "conteúdo sensível", e
// Nano Banana saiu com traço fraco e lento; por isso ficaram de fora.
export const ATELIE_MODEL = String(process.env.ATELIE_IMAGE_MODEL || "step-image-edit-2").trim();
export const ATELIE_FALLBACK_MODEL = String(process.env.ATELIE_IMAGE_FALLBACK_MODEL || "pruna-ai/p-image/edit").trim();
export const ATELIE_DAILY_LIMIT = Math.max(0, Number(process.env.ATELIE_DAILY_LIMIT) || 3);

export const COLORING_PROMPT =
  "Turn this photo into a clean black-and-white coloring book page. " +
  "Use only bold, smooth, continuous black outlines on a pure white background. " +
  "Every shape must be a closed outline that can be filled with color. " +
  "No shading, no gray tones, no hatching, no color, no text, no border. " +
  "Keep the main subject recognizable with the same pose and framing; simplify the background into a few simple shapes.";

const MAX_INPUT_CHARS = 3_000_000;

export class AtelieError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function validImage(value) {
  const image = String(value || "");
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) throw new AtelieError(400, "Mande a foto como imagem JPG, PNG ou WebP.");
  if (image.length > MAX_INPUT_CHARS) throw new AtelieError(413, "Foto grande demais.");
  return image;
}

/**
 * Folha de colorir a partir da foto. Sem `model`, tenta o modelo principal e,
 * se ele falhar (fora do ar, recusa), o reserva.
 */
export async function coloringPageFromPhoto({ image, model, signal }) {
  if (model) return askModel({ image, model, signal });
  try {
    return await askModel({ image, model: ATELIE_MODEL, signal });
  } catch (error) {
    if (!ATELIE_FALLBACK_MODEL || ATELIE_FALLBACK_MODEL === ATELIE_MODEL || signal?.aborted) throw error;
    return askModel({ image, model: ATELIE_FALLBACK_MODEL, signal });
  }
}

/** Chama um modelo e devolve a folha como data URL (PNG ou JPG). */
async function askModel({ image, model, signal }) {
  const key = nanogptKeys()[0];
  if (!key) throw new AtelieError(503, "A IA de imagens não está configurada.");
  const started = Date.now();
  const response = await fetch(`${nanogptBaseUrl()}/images/generations`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, prompt: COLORING_PROMPT, imageDataUrl: validImage(image), n: 1, response_format: "b64_json" }),
    signal,
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    // corpo não-JSON: tratado abaixo
  }
  if (!response.ok) {
    console.error(`[atelie] ${model} status=${response.status} ${text.slice(0, 300)}`);
    throw new AtelieError(response.status === 429 ? 429 : 502, response.status === 429 ? "A IA está ocupada. Tente em um minuto." : "A IA não conseguiu desenhar essa foto agora.");
  }
  const item = payload?.data?.[0] || {};
  let dataUrl = "";
  if (item.b64_json) {
    dataUrl = `data:image/png;base64,${item.b64_json}`;
  } else if (item.url) {
    const file = await fetch(item.url, { signal });
    if (!file.ok) throw new AtelieError(502, "A IA desenhou, mas a imagem não chegou.");
    const type = file.headers.get("content-type") || "image/png";
    dataUrl = `data:${type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  }
  if (!dataUrl) throw new AtelieError(502, "A IA não devolveu imagem.");
  return { image: dataUrl, model, ms: Date.now() - started, cost: payload?.cost ?? payload?.metadata?.cost ?? null };
}
