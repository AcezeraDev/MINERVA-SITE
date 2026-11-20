export type ConversationHit = {
  subjectId?: string;
  threadId?: string;
  title: string;
  updatedAt: number;
  pinned: boolean;
  snippet: string;
  score: number;
};

export function searchConversations(
  chats: Array<{ subjectId?: string; threadId?: string; role: string; text: string; createdAt: number; threadTitle?: string; threadPinned?: boolean }>,
  query: string,
  options?: { limit?: number },
): ConversationHit[];
