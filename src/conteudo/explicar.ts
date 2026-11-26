/**
 * "Explicar" do trecho selecionado no leitor de livros (nov/2026): resposta
 * curta da Mine que aparece no próprio leitor, sem sair do livro. Usa o
 * mesmo /api/mine/chat do balão de conversa.
 */
import { mineHeaders } from "../mineAuth";

const instrucao =
  "Voce esta explicando um trecho de livro para um estudante de ensino medio que esta lendo agora. Responda em portugues do Brasil, curto (no maximo 5 frases ou uma lista de ate 4 itens), sem titulos e sem repetir o trecho inteiro. Se for uma palavra ou expressao, diga o significado NAQUELE contexto e de um sinonimo simples. Nao termine com pergunta nem ofereca mais ajuda: o estudante nao responde neste cartao.";

export async function explicarTrecho(trecho: string, { titulo = "", autor = "", palavra = false, signal }: { titulo?: string; autor?: string; palavra?: boolean; signal?: AbortSignal } = {}): Promise<string> {
  const obra = titulo ? `"${titulo}"${autor ? `, de ${autor}` : ""}` : "o texto";
  const prompt = palavra
    ? `O que significa "${trecho}" neste trecho de ${obra}?`
    : `Me explica de forma simples este trecho de ${obra}: o que acontece e o que ele quer dizer.\n\n"""\n${trecho}\n"""`;
  const response = await fetch("/api/mine/chat", {
    method: "POST",
    headers: mineHeaders(),
    signal,
    body: JSON.stringify({ prompt, context: `${instrucao}\n\nLivro: ${obra}.`, history: [], maxOutputTokens: 700 }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "A Mine não respondeu agora.");
  const resposta = String(data.reply || "").trim();
  if (!resposta) throw new Error("A Mine não respondeu agora.");
  // O cartão do leitor mostra texto corrido: tira marcação de markdown.
  return resposta
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|\s)\*([^*\n]+)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}
