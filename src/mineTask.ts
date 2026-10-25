/**
 * Pedido de uma tarefa estruturada à Mine (redação, atividade, correção).
 * Usa o mesmo /api/mine/chat do resto do site; o prompt de cada task está em
 * mine/prompts.mjs e o servidor já confere o formato antes de devolver.
 */

// modelos de raciocínio gastam parte do teto pensando antes de escrever
const reasoningReserve = 1200;

export async function askMineTask(
  payload: { task: "redacao" | "atividade" | "atividade-correcao"; prompt: string; context: string; outputTokens: number },
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<string> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort);
  const timer = window.setTimeout(abort, options.timeoutMs ?? 90_000);
  try {
    const response = await fetch("/api/mine/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        task: payload.task,
        prompt: payload.prompt,
        context: payload.context,
        history: [],
        maxOutputTokens: reasoningReserve + payload.outputTokens,
      }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "A Mine não respondeu agora.");
    const reply = String(data.reply || "").trim();
    if (!reply) throw new Error("A Mine não respondeu agora.");
    return reply;
  } catch (error) {
    if (controller.signal.aborted && !options.signal?.aborted) throw new Error("A Mine demorou demais. Tente de novo em instantes.");
    throw error;
  } finally {
    window.clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
