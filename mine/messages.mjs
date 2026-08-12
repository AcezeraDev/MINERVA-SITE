// Montagem das mensagens enviadas ao modelo: historico, anexos de texto e
// imagens. Fica separado do roteador para que as regras de contexto possam
// crescer (chunking, selecao de trechos) sem mexer no resto.

import { buildAttachmentContext } from "./documents.mjs";

export const MAX_HISTORY_MESSAGES = 10;
export const MAX_HISTORY_CHARS = 2_400;
export const MAX_HISTORY_TOTAL_CHARS = 12_000;
export const MAX_PROMPT_CHARS = 6_000;
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
  const messages = [{ role: "system", content: systemContent }];

  for (const extra of extraSystem) {
    const text = String(extra || "").trim();
    if (text) messages.push({ role: "system", content: text });
  }

  const lastMessages = Array.isArray(history) ? history.slice(-MAX_HISTORY_MESSAGES) : [];
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
  const text = [String(prompt || "").slice(0, MAX_PROMPT_CHARS), summary].filter(Boolean).join("\n\n");
  const images = allowImages ? imagePartsFromAttachments(attachments) : [];

  messages.push({
    role: "user",
    content: images.length ? [{ type: "text", text }, ...images] : text,
  });

  return messages;
}
