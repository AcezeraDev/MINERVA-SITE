import { handleDataRequest } from "../data-server.mjs";
import { handleEducationRequest } from "../education-server.mjs";

export default async function handler(req, res) {
  if (await handleEducationRequest(req, res)) return;
  await handleDataRequest(req, res);
}
