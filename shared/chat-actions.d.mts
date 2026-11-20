export type ChatActionKind = "salvar" | "agenda" | "duelo" | "atividade" | "redacao" | "leitura" | "fotos-zip";

export type ChatActionRequest = {
  kind: ChatActionKind;
  /** Tema escrito na frase ("duelo sobre Revolução Francesa"); vazio = usar a conversa. */
  topic: string;
  /** A frase aponta para a conversa ("isso", "essa resposta"). */
  refersBack: boolean;
  /** Salvar: nome da matéria pedida ("em História"); vazio = a matéria aberta. */
  destino?: string;
  /** Agenda: a frase da tarefa, do jeito que a aba Agenda entende. */
  tarefa?: string;
};

export function chatActionFromPrompt(value: string): ChatActionRequest | null;
export function plainTextFromReply(reply: string): string;
