import { handleGeminiRequest, loadLocalEnv } from "../gemini-server.mjs";

loadLocalEnv();

export default async function handler(req, res) {
  await handleGeminiRequest(req, res);
}
