/**
 * Busca em todas as conversas da Mine (nov/2026): procura no título e no texto
 * de cada mensagem, em todas as matérias, ignorando acento e maiúscula.
 * Devolve a conversa, onde ela mora e um trecho em volta do que bateu.
 */

function fold(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// O texto guardado tem marcadores e marcação de markdown; o trecho não.
function readable(text) {
  return String(text || "")
    .replace(/\[\[[^\]]*\]\]/g, " ")
    .replace(/```[\w-]*\n?/g, " ")
    .replace(/==|[#*_`>$|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(text, at, length) {
  const start = Math.max(0, at - 50);
  const end = Math.min(text.length, at + length + 70);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/**
 * @param {Array<{ subjectId?: string, threadId?: string, role: string, text: string, createdAt: number, threadTitle?: string, threadPinned?: boolean }>} chats
 * @param {string} query
 * @param {{ limit?: number }} [options]
 */
export function searchConversations(chats, query, { limit = 30 } = {}) {
  const needle = fold(query).trim();
  if (needle.length < 2) return [];
  const words = needle.split(/\s+/).filter(Boolean);
  const groups = new Map();
  for (const message of chats) {
    const key = `${message.subjectId || ""}::${message.threadId || ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(message);
  }
  const results = [];
  for (const messages of groups.values()) {
    const first = messages[0];
    const title = messages.find((item) => item.threadTitle)?.threadTitle || readable(messages.find((item) => item.role === "user")?.text || first.text).slice(0, 58) || "Conversa";
    const updatedAt = Math.max(...messages.map((item) => item.createdAt));
    const titleHit = words.every((word) => fold(title).includes(word));
    let best = null;
    for (const message of messages) {
      const text = readable(message.text);
      const folded = fold(text);
      if (!words.every((word) => folded.includes(word))) continue;
      const at = folded.indexOf(words[0]);
      best = { snippet: excerpt(text, at, words[0].length), role: message.role, createdAt: message.createdAt };
      if (message.role === "mine") break;
    }
    if (!titleHit && !best) continue;
    results.push({
      subjectId: first.subjectId || undefined,
      threadId: first.threadId || undefined,
      title,
      updatedAt,
      pinned: messages.some((item) => item.threadPinned),
      snippet: best?.snippet || "",
      score: (titleHit ? 2 : 0) + (best ? 1 : 0),
    });
  }
  return results.sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt).slice(0, limit);
}
