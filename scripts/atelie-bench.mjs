// Compara modelos de edição de imagem da NanoGPT para o Ateliê (foto → folha
// de colorir). Roda localmente com NANOGPT_API_KEY no .env.local.
//
//   node scripts/atelie-bench.mjs <pasta-de-saida> foto1.jpg foto2.jpg ...
//
// Gera <saida>/<modelo>__<foto>.png e um comparativo.html lado a lado.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { loadLocalEnv } from "../gemini-server.mjs";

loadLocalEnv();
const { coloringPageFromPhoto } = await import("../atelie-ia.mjs");

const models = (process.env.BENCH_MODELS ||
  "step-image-edit-2,minimax-image-01,meta/muse-image/edit,pruna-ai/p-image/edit,flux-2-klein-base-4b/edit,flux-2-klein-base-9b/edit,qwen-image,bytedance/seedream-v5.0-flash/edit,nano-banana-edit")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const [outDir, ...photos] = process.argv.slice(2);
if (!outDir || !photos.length) {
  console.error("uso: node scripts/atelie-bench.mjs <saida> foto1.jpg [foto2.jpg ...]");
  process.exit(1);
}
await mkdir(outDir, { recursive: true });

const safe = (text) => text.replace(/[^a-z0-9.-]+/gi, "_");
const rows = [];
for (const photo of photos) {
  const type = extname(photo).toLowerCase() === ".png" ? "png" : "jpeg";
  const image = `data:image/${type};base64,${(await readFile(photo)).toString("base64")}`;
  const name = basename(photo, extname(photo));
  // Os modelos de uma foto rodam juntos; fotos em sequência.
  const results = await Promise.all(
    models.map(async (model) => {
      try {
        const result = await coloringPageFromPhoto({ image, model, signal: AbortSignal.timeout(120_000) });
        const [, mime, b64] = result.image.match(/^data:image\/([a-z]+);base64,(.*)$/) || [];
        const file = `${safe(model)}__${safe(name)}.${mime === "jpeg" ? "jpg" : mime || "png"}`;
        await writeFile(join(outDir, file), Buffer.from(b64, "base64"));
        console.log(`ok   ${model.padEnd(36)} ${name.padEnd(14)} ${(result.ms / 1000).toFixed(1)}s`);
        return { model, file, ms: result.ms };
      } catch (error) {
        console.log(`erro ${model.padEnd(36)} ${name.padEnd(14)} ${error.message}`);
        return { model, error: error.message };
      }
    }),
  );
  rows.push({ photo, name, results });
}

const html = `<!doctype html><meta charset="utf-8"><title>Ateliê: comparativo</title>
<style>body{font:14px system-ui;margin:16px;background:#f3f4f6}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px;vertical-align:top;background:#fff;text-align:center}img{width:220px;display:block}small{color:#666}</style>
<table><tr><th>modelo</th>${rows.map((row) => `<th>${row.name}<img src="${row.photo.replace(/\\/g, "/")}"></th>`).join("")}</tr>
${models
  .map(
    (model) =>
      `<tr><th>${model}</th>${rows
        .map((row) => {
          const result = row.results.find((item) => item.model === model);
          return `<td>${result?.file ? `<img src="${result.file}"><small>${(result.ms / 1000).toFixed(1)} s</small>` : `<small>${result?.error || "-"}</small>`}</td>`;
        })
        .join("")}</tr>`,
  )
  .join("\n")}</table>`;
await writeFile(join(outDir, "comparativo.html"), html);
console.log(`\ncomparativo: ${join(outDir, "comparativo.html")}`);
