/**
 * A Mine de verdade (IA, /api/mine/chat com a task "cubo-tutor") falando com
 * o aluno enquanto ele mexe no cubo. O site já conferiu o giro e manda no
 * contexto o que aconteceu e qual é o próximo giro certo; a IA só fala.
 *
 * Um pedido novo cancela o anterior: num cubo, o que importa é o agora.
 */
export type TurnoTutor = { role: "user" | "assistant"; text: string };

// modelos de raciocínio gastam parte do teto pensando antes de escrever
const reservaRaciocinio = 700;

export async function perguntarMineCubo(
  pedido: { evento: string; contexto: string; historico: TurnoTutor[]; pergunta?: boolean },
  sinal: AbortSignal,
): Promise<string> {
  const controle = new AbortController();
  const abortar = () => controle.abort();
  sinal.addEventListener("abort", abortar);
  const relogio = window.setTimeout(abortar, 25_000);
  try {
    const resposta = await fetch("/api/mine/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        task: "cubo-tutor",
        prompt: pedido.evento,
        context: pedido.contexto,
        history: pedido.historico.slice(-8),
        maxOutputTokens: reservaRaciocinio + (pedido.pergunta ? 380 : 200),
      }),
      signal: controle.signal,
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.error || "A Mine não respondeu agora.");
    const texto = String(dados.reply || "")
      .replace(/[*_#`]/g, "")
      .trim();
    if (!texto) throw new Error("A Mine não respondeu agora.");
    return texto;
  } finally {
    window.clearTimeout(relogio);
    sinal.removeEventListener("abort", abortar);
  }
}
