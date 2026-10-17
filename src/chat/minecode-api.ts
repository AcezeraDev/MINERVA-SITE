/*
 * Chat do MineCode: pede código à Mine (task "minecode" em /api/mine/chat,
 * prompt em mine/prompts.mjs) e entrega o texto aos pedaços enquanto ela
 * escreve — é o que faz o editor ir se preenchendo ao vivo.
 */

export type MineCodeTurn = { role: "user" | "assistant"; text: string };

export async function streamMineCode(
  payload: { prompt: string; context: string; history: MineCodeTurn[]; attachments?: Array<{ name: string; type: string; dataUrl: string }> },
  options: { signal: AbortSignal; onText: (text: string) => void },
): Promise<string> {
  const response = await fetch("/api/mine/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ task: "minecode", prompt: payload.prompt, context: payload.context, history: payload.history, attachments: payload.attachments, stream: true, maxOutputTokens: 16000 }),
    signal: options.signal,
  });
  const type = response.headers.get("content-type") || "";
  if (!response.ok || !response.body || !type.includes("event-stream")) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "A Mine não conseguiu programar agora. Tente de novo.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamed = "";
  let final = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    let split: number;
    while ((split = buffer.indexOf("\n\n")) >= 0) {
      const raw = buffer.slice(0, split).trim();
      buffer = buffer.slice(split + 2);
      if (!raw.startsWith("data:")) continue;
      let event: { type?: string; text?: string; reply?: string; error?: string };
      try {
        event = JSON.parse(raw.slice(5).trim());
      } catch {
        continue;
      }
      if (event.type === "delta") {
        streamed += event.text || "";
        options.onText(streamed);
      } else if (event.type === "done") {
        final = event.reply || streamed;
      } else if (event.type === "error") {
        throw new Error(event.error || "A Mine parou no meio. Tente de novo.");
      }
    }
  }
  return final || streamed;
}
