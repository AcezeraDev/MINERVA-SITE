// Versões de uma conversa (out/2026).
//
// Antes, editar uma pergunta ou refazer uma resposta apagava o que vinha
// depois. Agora, como no ChatGPT, o trecho que sai vira um "galho" guardado na
// pergunta nova (`branches`), e as setas ‹ 1/2 › trocam entre eles. Cada galho
// é o trecho inteiro da conversa a partir daquela pergunta; só a primeira
// mensagem do trecho visível carrega a lista dos outros. Nada muda no banco:
// `chats` é gravado como vem.

import { inThread } from "./threads";

type BranchMessage = {
  id: string;
  userId: string;
  subjectId?: string;
  threadId?: string;
  role: "user" | "mine";
  text: string;
  createdAt: number;
  branches?: BranchMessage[][];
  threadTitle?: string;
};

/** Mensagens da conversa a partir de `cutAt` (inclusive), na ordem em que aparecem. */
export function branchSlice<T extends BranchMessage>(chats: T[], userId: string, subjectId: string | undefined, threadId: string | undefined, cutAt: number): T[] {
  return chats.filter((item) => item.userId === userId && inThread(item, subjectId, threadId) && item.createdAt >= cutAt);
}

/** Todas as versões de uma pergunta, da mais antiga para a mais nova. */
export function allVersions<T extends BranchMessage>(message: T): T[] {
  const firsts = [...(message.branches || []).map((branch) => branch[0] as T), message].filter(Boolean);
  return firsts.sort((a, b) => a.createdAt - b.createdAt);
}

/** Posição da versão visível e total, ou null quando só existe uma. */
export function versionInfo<T extends BranchMessage>(message: T) {
  if (!message.branches?.length) return null;
  const versions = allVersions(message);
  return {
    index: versions.findIndex((item) => item.id === message.id),
    total: versions.length,
    // Refazer mantém a pergunta igual: aí as setas ficam na resposta.
    sameQuestion: versions.every((item) => item.text.trim() === message.text.trim()),
  };
}

/** Troca o trecho visível a partir de `currentId` pela versão `target`. */
export function switchBranch<T extends BranchMessage>(chats: T[], currentId: string, target: number): T[] {
  const current = chats.find((item) => item.id === currentId);
  if (!current?.branches?.length) return chats;
  const tail = branchSlice(chats, current.userId, current.subjectId, current.threadId, current.createdAt);
  const visible = [{ ...current, branches: undefined }, ...tail.filter((item) => item.id !== current.id)] as T[];
  const versions = [...(current.branches as T[][]), visible].filter((branch) => branch.length).sort((a, b) => a[0].createdAt - b[0].createdAt);
  const chosen = versions[target];
  if (!chosen || chosen[0].id === current.id) return chats;
  const others = versions.filter((branch) => branch !== chosen);
  const nextTail = [{ ...chosen[0], branches: others, threadTitle: current.threadTitle ?? chosen[0].threadTitle }, ...chosen.slice(1)] as T[];
  const removed = new Set(tail.map((item) => item.id));
  return [...chats.filter((item) => !removed.has(item.id)), ...nextTail];
}
