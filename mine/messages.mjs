// Montagem das mensagens enviadas ao modelo: historico, anexos de texto e
// imagens. Fica separado do roteador para que as regras de contexto possam
// crescer (chunking, selecao de trechos) sem mexer no resto.

import { buildAttachmentContext } from "./documents.mjs";
import { MAX_CHAT_PROMPT_CHARS } from "../shared/chat-limits.mjs";

// Memoria da conversa (set/2026). Antes eram 10 mensagens de ate 2.400
// caracteres: uma explicacao longa chegava cortada ao meio na pergunta
// seguinte e a Mine "esquecia" o comeco da conversa. O modelo atual aceita
// muito mais contexto; os tetos abaixo continuam existindo porque cada token
// de entrada e cobrado.
export const MAX_HISTORY_MESSAGES = 16;
export const MAX_HISTORY_CHARS = MAX_CHAT_PROMPT_CHARS;
export const MAX_HISTORY_TOTAL_CHARS = 48_000;
// Mensagens mais antigas que a janela viram uma lista de assuntos ja tratados.
export const MAX_EARLIER_TOPICS = 20;
const EARLIER_TOPIC_CHARS = 160;
export const MAX_PROMPT_CHARS = MAX_CHAT_PROMPT_CHARS;
export const MAX_IMAGE_PARTS = 4;

export function attachmentSummary(attachments, prompt = "") {
  if (!(Array.isArray(attachments) ? attachments : []).length) return "";
  return buildAttachmentContext(attachments, prompt).text;
}

export function imageAttachments(attachments) {
  return (Array.isArray(attachments) ? attachments : []).filter(
    (item) =>
      String(item.type || "").startsWith("image/") && String(item.dataUrl || "").startsWith("data:image/"),
  );
}

export function imagePartsFromAttachments(attachments) {
  return imageAttachments(attachments)
    .slice(0, MAX_IMAGE_PARTS)
    .map((item) => ({ type: "image_url", image_url: { url: String(item.dataUrl) } }));
}

/**
 * Monta o array de mensagens no formato OpenAI.
 * `allowImages` desliga as partes de imagem quando o modelo escolhido nao le
 * imagem — nesse caso o roteador ja terá injetado a descricao textual.
 */
export function buildMessages({ systemContent, history, prompt, attachments = [], allowImages = true, extraSystem = [] }) {
  const fullPrompt = String(prompt || "");
  if (fullPrompt.length > MAX_PROMPT_CHARS) {
    throw new RangeError("Sua mensagem é longa demais. Tente dividir em partes menores.");
  }
  const messages = [{ role: "system", content: systemContent }];

  for (const extra of extraSystem) {
    const text = String(extra || "").trim();
    if (text) messages.push({ role: "system", content: text });
  }

  const allHistory = Array.isArray(history) ? history : [];
  const lastMessages = allHistory.slice(-MAX_HISTORY_MESSAGES);

  // O que ficou fora da janela nao some: as perguntas antigas entram como um
  // resumo curto, para a Mine saber do que ja se falou ("como no exemplo do
  // comeco") sem pagar pelo texto inteiro de cada resposta.
  const earlier = allHistory
    .slice(0, -MAX_HISTORY_MESSAGES)
    .filter((message) => message?.role === "user")
    .map((message) => String(message.text || message.content || "").replace(/\s+/g, " ").trim().slice(0, EARLIER_TOPIC_CHARS))
    .filter(Boolean)
    .slice(-MAX_EARLIER_TOPICS);
  if (earlier.length) {
    messages.push({
      role: "system",
      content: `Resumo automatico do inicio desta conversa (mensagens antigas que nao cabem mais inteiras). O estudante ja perguntou, nesta ordem:
${earlier.map((topic) => `- ${topic}`).join("\n")}
Use isso para manter a continuidade; se ele se referir a algo daqui, retome sem pedir para repetir.`,
    });
  }
  const selectedHistory = [];
  let historyBudget = MAX_HISTORY_TOTAL_CHARS;
  for (const message of [...lastMessages].reverse()) {
    if (historyBudget <= 0) break;
    const content = String(message.text || message.content || "")
      .slice(0, Math.min(MAX_HISTORY_CHARS, historyBudget))
      .trim();
    if (!content) continue;
    selectedHistory.unshift({ role: message.role === "user" ? "user" : "assistant", content });
    historyBudget -= content.length;
  }
  messages.push(...selectedHistory);

  // A pergunta entra na selecao de trechos: o recorte do arquivo e feito em
  // funcao do que o usuario pediu.
  const summary = attachmentSummary(attachments, prompt);
  const text = [fullPrompt, summary].filter(Boolean).join("\n\n");
  const images = allowImages ? imagePartsFromAttachments(attachments) : [];

  messages.push({
    role: "user",
    content: images.length ? [{ type: "text", text }, ...images] : text,
  });

  return messages;
}
