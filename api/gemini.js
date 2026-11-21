import { handleGeminiRequest, loadLocalEnv } from "../gemini-server.mjs";
import { mineSessionOk } from "../data-server.mjs";

loadLocalEnv();

export default async function handler(req, res) {
  // Caminho legado da Mine: mesma regra de login do /api/mine/chat.
  if (!(await mineSessionOk(req, res))) return;
  await handleGeminiRequest(req, res);
}
