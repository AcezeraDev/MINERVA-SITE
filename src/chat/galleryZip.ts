import { makeZip } from "../../shared/zip.mjs";
import { slug } from "../../shared/projeto.mjs";

/*
 * Fotos da Mine num .zip, montado no navegador.
 *
 * Cada foto vem pelo próprio servidor (/api/image-download), que já baixa a
 * imagem do site de origem: o navegador não esbarra em CORS e o zip sai com
 * os bytes de verdade. Foto que falhar fica de fora e entra na contagem.
 */

export type ZipPhoto = { url: string; full: string; title: string };
export type PhotoGroup = { query: string; style?: string; images?: ZipPhoto[] };

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif", "image/svg+xml": "svg" };

function downloadUrl(image: ZipPhoto, name: string) {
  const params = new URLSearchParams({ src: image.full || image.url, name });
  if (image.full && image.full !== image.url) params.set("fallback", image.url);
  return `/api/image-download?${params.toString()}`;
}

/** Fotos de uma galeria (o mesmo /api/image que a galeria usa; o navegador reaproveita o cache). */
export async function photosFor(query: string, style = ""): Promise<ZipPhoto[]> {
  const response = await fetch(`/api/image?q=${encodeURIComponent(query)}${style ? `&estilo=${encodeURIComponent(style)}` : ""}`);
  if (!response.ok) return [];
  const data = (await response.json()) as { images?: Array<Record<string, unknown>>; image?: Record<string, unknown> } | Array<Record<string, unknown>>;
  const list = Array.isArray(data) ? data : data.images || (data.image ? [data.image] : []);
  return list
    .map((item) => ({ url: String(item.url || ""), full: String(item.full || item.url || ""), title: String(item.title || "") }))
    .filter((item) => item.url.startsWith("https://"))
    .slice(0, 8);
}

/**
 * Baixa as fotos e salva um .zip. Devolve quantas entraram e quantas falharam.
 * `onProgress(feitas, total)` a cada foto.
 */
export async function downloadPhotosZip(groups: PhotoGroup[], name: string, onProgress?: (done: number, total: number) => void) {
  const filled = await Promise.all(groups.map(async (group) => ({ ...group, images: group.images?.length ? group.images : await photosFor(group.query, group.style).catch(() => []) })));
  const items = filled.flatMap((group) => (group.images || []).map((image, index) => ({ image, base: `${slug(group.query, "foto")}-${String(index + 1).padStart(2, "0")}`, folder: filled.length > 1 ? `${slug(group.query, "fotos")}/` : "" })));
  const files: { path: string; content: Uint8Array }[] = [];
  let done = 0;
  onProgress?.(0, items.length);
  // Três de cada vez: rápido sem sobrecarregar o servidor.
  for (let start = 0; start < items.length; start += 3) {
    await Promise.all(
      items.slice(start, start + 3).map(async ({ image, base, folder }) => {
        try {
          const response = await fetch(downloadUrl(image, base));
          if (!response.ok) return;
          const type = (response.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
          if (!type.startsWith("image/")) return;
          files.push({ path: `${folder}${base}.${EXT[type] || "jpg"}`, content: new Uint8Array(await response.arrayBuffer()) });
        } catch {
          /* foto bloqueada na origem: fica de fora */
        } finally {
          done += 1;
          onProgress?.(done, items.length);
        }
      }),
    );
  }
  if (!files.length) return { saved: 0, failed: items.length };
  files.sort((a, b) => a.path.localeCompare(b.path));
  const bytes = makeZip(files);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slug(name, "fotos")}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { saved: files.length, failed: items.length - files.length };
}
