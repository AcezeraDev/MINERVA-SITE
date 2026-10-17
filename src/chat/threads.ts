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
};

export type ChatThread = {
  /** `undefined` é a conversa principal da matéria (mensagens sem threadId). */
  id: string | undefined;
  subjectId?: string;
  title: string;
  updatedAt: number;
  count: number;
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
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
