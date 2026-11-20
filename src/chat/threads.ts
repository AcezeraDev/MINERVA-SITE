// Conversas da Mine (set/2026).
//
// Antes cada matéria tinha UMA conversa, e "Nova conversa" apagava a atual.
// Agora cada mensagem pode carregar um `threadId`. Mensagens antigas, sem ele,
// formam a conversa principal da matéria — nada que já existia muda de lugar
// e o banco não precisou de migração (a coleção `chats` é gravada como veio).

type ThreadMessage = {
  subjectId?: string;
  threadId?: string;
  role: "user" | "mine";
  text: string;
  createdAt: number;
  /** Título escrito pela IA depois da primeira resposta (out/2026). */
  threadTitle?: string;
  /** Conversa fixada no topo da lista (nov/2026); fica na primeira mensagem. */
  threadPinned?: boolean;
};

export type ChatThread = {
  /** `undefined` é a conversa principal da matéria (mensagens sem threadId). */
  id: string | undefined;
  subjectId?: string;
  title: string;
  updatedAt: number;
  count: number;
  pinned: boolean;
};

export function inSubject(message: { subjectId?: string }, subjectId?: string) {
  return (message.subjectId || undefined) === (subjectId || undefined);
}

export function inThread(message: { subjectId?: string; threadId?: string }, subjectId: string | undefined, threadId: string | undefined) {
  return inSubject(message, subjectId) && (message.threadId || undefined) === (threadId || undefined);
}

function titleFrom(text: string) {
  const clean = text
    .replace(/\[\[[^\]]*\]\]/g, "")
    // Só marcação: "==" do marca-texto sai, mas o "=" de uma equação fica.
    .replace(/==|[#*_`>$]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "Conversa";
  return clean.length > 58 ? `${clean.slice(0, 55).trimEnd()}…` : clean;
}

/** Conversas de uma matéria, da mais recente para a mais antiga. */
export function threadsOf<T extends ThreadMessage>(chats: T[], subjectId: string | undefined): ChatThread[] {
  const groups = new Map<string, { id: string | undefined; messages: T[] }>();
  for (const message of chats) {
    if (!inSubject(message, subjectId)) continue;
    const key = message.threadId || "__principal__";
    if (!groups.has(key)) groups.set(key, { id: message.threadId || undefined, messages: [] });
    groups.get(key)!.messages.push(message);
  }
  return Array.from(groups.values())
    .map(({ id, messages }) => {
      const firstQuestion = messages.find((message) => message.role === "user");
      return {
        id,
        subjectId,
        title: messages.find((message) => message.threadTitle)?.threadTitle || titleFrom(firstQuestion?.text || messages[0]?.text || ""),
        updatedAt: Math.max(...messages.map((message) => message.createdAt)),
        count: messages.length,
        pinned: messages.some((message) => message.threadPinned),
      };
    })
    // Fixadas primeiro; dentro de cada grupo, a mais recente em cima.
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
}

/** Liga/desliga o alfinete: a marca mora na primeira mensagem da conversa. */
export function togglePinned<T extends ThreadMessage & { id: string }>(chats: T[], subjectId: string | undefined, threadId: string | undefined): T[] {
  const inside = chats.filter((message) => inThread(message, subjectId, threadId));
  if (!inside.length) return chats;
  const pinned = inside.some((message) => message.threadPinned);
  const first = inside.reduce((oldest, message) => (message.createdAt < oldest.createdAt ? message : oldest));
  return chats.map((message) => {
    if (!inThread(message, subjectId, threadId)) return message;
    if (pinned) return message.threadPinned ? { ...message, threadPinned: undefined } : message;
    return message.id === first.id ? { ...message, threadPinned: true } : message;
  });
}
