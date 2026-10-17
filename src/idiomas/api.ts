/**
 * Pedidos à Mine feitos pela aba Idiomas. Usa o mesmo /api/mine/chat do
 * resto do site, com as tasks "idioma-conversa" (roleplay) e "idioma-dica"
 * (explicar um erro). Os prompts estão em mine/prompts.mjs.
 */

export type MineTurn = { role: "user" | "assistant"; text: string };

// modelos de raciocínio gastam parte do teto pensando antes de escrever
const reasoningReserve = 900;

export async function askLanguageMine(
  payload: { task: "idioma-conversa" | "idioma-dica"; prompt: string; context: string; history?: MineTurn[] },
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<string> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort);
  const timer = window.setTimeout(abort, options.timeoutMs ?? 30_000);
  try {
    const response = await fetch("/api/mine/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        task: payload.task,
        prompt: payload.prompt,
        context: payload.context,
        history: payload.history || [],
        maxOutputTokens: reasoningReserve + (payload.task === "idioma-conversa" ? 260 : 220),
        fast: true,
      }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "A Mine não respondeu agora.");
    const reply = String(data.reply || "").trim();
    if (!reply) throw new Error("A Mine não respondeu agora.");
    return reply;
  } finally {
    window.clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
