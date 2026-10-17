/**
 * Imagens criadas pela Mine (out/2026), o "criar imagem" do ChatGPT.
 *
 * A Mine escreve `[[gerar_imagem: prompt | legenda | editar]]` na resposta e o
 * navegador pede a imagem aqui, por /api/mine-imagem. Fica fora do pedido do
 * chat de propósito: a resposta em texto chega na hora e a imagem (10–20 s)
 * aparece depois, num cartão "A Mine está desenhando", como no ChatGPT.
 *
 * Modelos (escolhidos pela tabela da NanoGPT em 16/out/2026):
 * - FLUX.3 Klein: cria do zero E edita a partir de referência, US$ 0,009 por
 *   imagem 1024², com bom controle de layout e texto. É o padrão.
 * - Qwen Image 2.1: reserva; escreve bem texto em português dentro da imagem.
 * Para a qualidade do ChatGPT, troque por `gpt-image-2` (≈ US$ 0,065) em
 * MINE_IMAGE_MODEL / MINE_IMAGE_EDIT_MODEL.
 *
 * Cada imagem custa dinheiro: o servidor impõe um teto diário por conta
 * (MINE_IMAGE_DAILY_LIMIT), contado no mesmo banco das cotas do Ateliê.
 */
import { nanogptBaseUrl, nanogptKeys } from "./providers.mjs";

export const MINE_IMAGE_MODEL = String(process.env.MINE_IMAGE_MODEL || "blackforestlabs/flux-3/klein/text-to-image").trim();
export const MINE_IMAGE_EDIT_MODEL = String(process.env.MINE_IMAGE_EDIT_MODEL || "blackforestlabs/flux-3/klein/edit-image").trim();
export const MINE_IMAGE_FALLBACK_MODEL = String(process.env.MINE_IMAGE_FALLBACK_MODEL || "qwen-image-2.1/text-to-image").trim();
export const MINE_IMAGE_FALLBACK_EDIT_MODEL = String(process.env.MINE_IMAGE_FALLBACK_EDIT_MODEL || "qwen-image-2.1/edit").trim();
export const MINE_IMAGE_DAILY_LIMIT = Math.max(0, Number(process.env.MINE_IMAGE_DAILY_LIMIT) || 8);
// Imagem que precisa de letra legível (título num cartaz, rótulos num esquema)
// vai para o modelo que escreve bem. O FLUX Klein desenha o "jeito" de letra e
// devolve texto embaralhado — foi o que estragou a planilha de 17/out/2026.
export const MINE_IMAGE_TEXT_MODEL = String(process.env.MINE_IMAGE_TEXT_MODEL || "gpt-image-2").trim();

const LEGIBLE_TEXT = /"[^"]{2,}"|“[^”]{2,}”|\b(?:text|title[sd]?|heading|label(?:s|ed|led)?|caption|lettering|typography|words?|written|writing|sign(?:age)?|poster|banner|infographic|chart|graph|table|spreadsheet|menu|logo\s+with|name\s+on|quote)\b/i;
const NO_TEXT = /\bno\s+(?:text|words|letters|lettering|labels)\b|\bwithout\s+(?:text|words|letters|labels)\b|\btextless\b/i;

/** O prompt pede letra que precisa ser lida? ("no text" desliga.) */
export function needsLegibleText(prompt) {
  const value = String(prompt || "");
  if (NO_TEXT.test(value) && !/"[^"]{2,}"|“[^”]{2,}”/.test(value)) return false;
  return LEGIBLE_TEXT.test(value);
}

const MAX_PROMPT_CHARS = 1200;
const MAX_REFERENCE_CHARS = 3_000_000;
const TIMEOUT_MS = 90_000;

export class MineImageError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// O modelo escreve o prompt, mas a ideia vem do estudante: o mesmo filtro de
// palavras que protege a busca de fotos vale para a criação. Os modelos da
// lista também recusam conteúdo adulto (`nsfw: false` na tabela da NanoGPT).
// "sex" só como palavra solta: "sexual reproduction" (biologia) e "sexta" passam.
const BLOCKED = /\b(?:nud[eo]s?|naked|nsfw|porn\w*|sex|sexy|er[oó]tic\w*|hentai|r34|rule\s*34|gore|nazi\w*|su[ií]c[ií]dio|suicide|self[\s-]?harm|beheading|decapita\w*)\b/i;

export function cleanPrompt(value) {
  const prompt = String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PROMPT_CHARS);
  if (prompt.length < 3) throw new MineImageError(400, "Descreva a imagem que a Mine deve criar.");
  if (BLOCKED.test(prompt)) throw new MineImageError(422, "Essa imagem a Mine não pode criar. Que tal outra ideia?");
  return prompt;
}

function cleanReference(value) {
  if (!value) return "";
  const image = String(value);
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) throw new MineImageError(400, "A imagem de referência veio num formato inválido.");
  if (image.length > MAX_REFERENCE_CHARS) throw new MineImageError(413, "A imagem de referência é grande demais.");
  return image;
}

/**
 * Corpo do pedido para cada família de modelo. A NanoGPT aceita o formato da
 * OpenAI (`size`), mas o Qwen mede em "1k" + proporção.
 */
export function requestBody({ model, prompt, reference }) {
  const body = { model, prompt, n: 1, response_format: "b64_json" };
  if (/^qwen-image/.test(model)) Object.assign(body, { resolution: "1k", aspect_ratio: reference ? "auto" : "1:1" });
  else body.size = "1024x1024";
  if (reference) body.imageDataUrl = reference;
  return body;
}

async function askModel({ model, prompt, reference, signal }) {
  const key = nanogptKeys()[0];
  if (!key) throw new MineImageError(503, "A criação de imagens não está configurada no servidor.");
  const started = Date.now();
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const response = await fetch(`${nanogptBaseUrl()}/images/generations`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(requestBody({ model, prompt, reference })),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    // corpo não-JSON: tratado abaixo
  }
  if (!response.ok) {
    console.error(`[mine-imagem] ${model} status=${response.status} ${text.slice(0, 300)}`);
    if (response.status === 429) throw new MineImageError(429, "A IA de imagens está ocupada. Tente em um minuto.");
    if (/safety|moderat|nsfw|content.?polic|sensitive/i.test(text)) throw new MineImageError(422, "O modelo recusou essa imagem. Tente descrever de outro jeito.");
    throw new MineImageError(502, "A Mine não conseguiu desenhar agora.");
  }
  const item = payload?.data?.[0] || {};
  let image = "";
  if (item.b64_json) {
    image = `data:image/png;base64,${item.b64_json}`;
  } else if (item.url) {
    const file = await fetch(item.url, { signal: timeout });
    if (!file.ok) throw new MineImageError(502, "A imagem foi criada, mas não chegou.");
    const type = file.headers.get("content-type") || "image/png";
    image = `data:${type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  }
  if (!image) throw new MineImageError(502, "A IA não devolveu imagem.");
  return { image, model, ms: Date.now() - started };
}

/**
 * Cria (ou edita, com `reference`) uma imagem. Tenta o modelo principal e,
 * se ele falhar por algo que não seja recusa de conteúdo, a reserva.
 */
export async function generateMineImage({ prompt, reference, signal }) {
  const cleanText = cleanPrompt(prompt);
  const cleanRef = cleanReference(reference);
  const primary = cleanRef ? MINE_IMAGE_EDIT_MODEL : needsLegibleText(cleanText) && MINE_IMAGE_TEXT_MODEL ? MINE_IMAGE_TEXT_MODEL : MINE_IMAGE_MODEL;
  const fallback = cleanRef ? MINE_IMAGE_FALLBACK_EDIT_MODEL : MINE_IMAGE_FALLBACK_MODEL;
  try {
    return await askModel({ model: primary, prompt: cleanText, reference: cleanRef, signal });
  } catch (error) {
    const refused = error instanceof MineImageError && (error.status === 422 || error.status === 503);
    if (refused || !fallback || fallback === primary || signal?.aborted) throw error;
    return askModel({ model: fallback, prompt: cleanText, reference: cleanRef, signal });
  }
}
