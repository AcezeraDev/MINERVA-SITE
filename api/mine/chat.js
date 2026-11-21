import { handleMineChatRequest, loadLocalEnv } from "../../gemini-server.mjs";
import { mineSessionOk } from "../../data-server.mjs";

loadLocalEnv();

export default async function handler(req, res) {
  // Só quem está logado gasta saldo da Mine.
  if (!(await mineSessionOk(req, res))) return;
  await handleMineChatRequest(req, res);
}
