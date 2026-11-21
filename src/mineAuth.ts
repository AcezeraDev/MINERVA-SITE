/**
 * Cabeçalhos dos pedidos à Mine (/api/mine/chat). Desde 21/nov/2026 o servidor
 * só responde quem está logado, então todo pedido leva o token da sessão.
 * Lê direto do localStorage (mesma chave de `readSession` em main.tsx) para
 * não criar import circular com main.tsx.
 */
const SESSION_KEY = "minerva-session-v1";

export function mineSessionToken(): string | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}") as { token?: unknown };
    return typeof parsed.token === "string" && parsed.token ? parsed.token : null;
  } catch {
    return null;
  }
}

export function mineHeaders(): Record<string, string> {
  const token = mineSessionToken();
  return token ? { "content-type": "application/json", authorization: `Bearer ${token}` } : { "content-type": "application/json" };
}
