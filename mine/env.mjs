import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Carrega .env.local / .env em dev e no servidor node. Na Vercel as variaveis ja
// vem do ambiente, entao aqui nada e sobrescrito: variavel ja definida vence.
export function loadLocalEnv(root = process.cwd()) {
  for (const file of [".env.local", ".env"]) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (!key || process.env[key]) continue;
      process.env[key] = rest.join("=").replace(/^['"]|['"]$/g, "");
    }
  }
}

// Remove qualquer credencial que tenha escapado para dentro de uma mensagem de
// erro antes dela virar log ou resposta HTTP (documento, secoes 24 e 25).
export function redactSecrets(text) {
  return String(text || "")
    .replace(/sk-or-v1-[A-Za-z0-9]+/g, "[chave-removida]")
    .replace(/nvapi-[A-Za-z0-9_-]+/g, "[chave-removida]")
    .replace(/gsk_[A-Za-z0-9_-]+/g, "[chave-removida]")
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, "[chave-removida]")
    .replace(/Bearer\s+[A-Za-z0-9._-]{12,}/gi, "Bearer [chave-removida]");
}
