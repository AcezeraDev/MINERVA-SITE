import { makeZip } from "../../../shared/zip.mjs";
import { slug, type Project } from "../../../shared/projeto.mjs";

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Baixa o projeto inteiro num .zip (uma pasta com o nome do projeto dentro). */
export function downloadZip(project: Project) {
  const folder = slug(project.name);
  const bytes = makeZip(project.files.map((file) => ({ path: `${folder}/${file.path}`, content: file.content })));
  save(new Blob([bytes], { type: "application/zip" }), `${folder}.zip`);
}

export function downloadFile(path: string, content: string) {
  save(new Blob([content], { type: "text/plain;charset=utf-8" }), path.split("/").pop() || "arquivo.txt");
}
