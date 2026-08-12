import { handleMineChatRequest, loadLocalEnv } from "../../gemini-server.mjs";

loadLocalEnv();

export default async function handler(req, res) {
  await handleMineChatRequest(req, res);
}
