import { handleDataRequest } from "../data-server.mjs";

export default async function handler(req, res) {
  await handleDataRequest(req, res);
}
