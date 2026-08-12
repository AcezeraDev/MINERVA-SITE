import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { handleGeminiRequest, loadLocalEnv } from "./gemini-server.mjs";
import { handleDataRequest } from "./data-server.mjs";

const appRoot = resolve(process.cwd());
const root = resolve(process.env.STATIC_DIR || (existsSync(join(appRoot, "dist")) ? join(appRoot, "dist") : appRoot));
loadLocalEnv(resolve(appRoot, ".."));
loadLocalEnv(appRoot);
const port = Number(process.env.PORT || process.argv[2] || 5174);
const host = process.env.HOST || "0.0.0.0";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};

createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  // /api/gemini e o caminho legado; /api/mine/chat e o nome novo. Mesmo handler.
  if (url.pathname === "/api/gemini" || url.pathname === "/api/mine/chat") {
    await handleGeminiRequest(req, res);
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    await handleDataRequest(req, res);
    return;
  }

  const requested = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = resolve(join(root, requested === "/" ? "index.html" : requested));

  if (!file.startsWith(root) || !existsSync(file)) {
    file = resolve(join(root, "index.html"));
  }

  if (statSync(file).isDirectory()) {
    file = join(file, "index.html");
  }

  res.writeHead(200, {
    "content-type": types[extname(file).toLowerCase()] || "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(file).pipe(res);
}).listen(port, host, () => {
  console.log(`Minerva web: http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}`);
});
