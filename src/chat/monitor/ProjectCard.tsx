import { useEffect, useId, useMemo } from "react";
import { Code2, Download, FileCode2, Globe2, Loader2, PanelRightOpen, Terminal } from "lucide-react";
import { parseProject, projectFromHtml } from "../../../shared/projeto.mjs";
import { openMonitor, registerProject, unregisterProject, useMonitor, versionOf } from "./store";
import { downloadZip } from "./download";
import "./mine-monitor.css";

/*
 * Cartão do projeto dentro da resposta da Mine. O projeto em si abre no
 * monitor ao lado (MineMonitor.tsx); aqui ficam o nome, os arquivos, a versão
 * e os botões "Abrir no monitor" e "Baixar .zip".
 *
 * `source`: "projeto" (bloco ````projeto) ou "html" (página ```html inteira,
 * o formato antigo, tratada como projeto de um arquivo só).
 */
export function ProjectCard({ code, source, open, streaming }: { code: string; source: "projeto" | "html"; open: boolean; streaming: boolean }) {
  const key = useId();
  const writing = open && streaming;
  const project = useMemo(() => {
    if (source === "projeto") return parseProject(code, { open: writing });
    const page = projectFromHtml(code);
    page.files[0].writing = writing;
    return page;
  }, [code, source, writing]);
  const monitor = useMonitor();

  useEffect(() => {
    if (project.files.length) registerProject(key, project, writing);
  }, [key, project, writing]);
  useEffect(() => () => unregisterProject(key), [key]);

  const entry = monitor.entries.find((item) => item.key === key);
  const version = entry ? versionOf(monitor.entries, entry) : null;
  const active = monitor.open && monitor.current?.key === key;
  const busyFile = project.files.find((file) => file.writing)?.path;
  const Icon = project.kind === "site" ? Globe2 : project.kind === "python" || project.kind === "javascript" ? Terminal : Code2;
  const kindLabel = project.kind === "site" ? "Site" : project.kind === "python" ? "Python" : project.kind === "javascript" ? "JavaScript" : "Código";
  const cut = open && !streaming;

  return (
    <figure className={`mpc ${active ? "is-active" : ""}`}>
      <div className="mpc-head">
        <span className="mpc-icon" aria-hidden>
          {writing ? <Loader2 className="animate-spin" /> : <Icon />}
        </span>
        <span className="mpc-title">
          <strong>{project.name}</strong>
          <small>
            {kindLabel} · {project.files.length} {project.files.length === 1 ? "arquivo" : "arquivos"}
            {version && version.total > 1 ? ` · versão ${version.number}` : ""}
          </small>
        </span>
      </div>
      <ul className="mpc-files" aria-label="Arquivos do projeto">
        {project.files.map((file) => (
          <li key={file.path} className={file.writing ? "is-writing" : ""}>
            <FileCode2 aria-hidden /> {file.path}
          </li>
        ))}
      </ul>
      {writing ? <p className="mpc-status">Escrevendo {busyFile || "o projeto"}…</p> : null}
      {cut ? <p className="mpc-status is-warn">A resposta parou antes do fim. Peça "continua o projeto" ou "manda de novo".</p> : null}
      <div className="mpc-actions">
        <button type="button" className="mpc-primary" onClick={() => openMonitor(key)} disabled={!project.files.length}>
          <PanelRightOpen aria-hidden /> {active ? "Aberto no monitor" : "Abrir no monitor"}
        </button>
        <button type="button" onClick={() => downloadZip(project)} disabled={writing || !project.files.length}>
          <Download aria-hidden /> Baixar .zip
        </button>
      </div>
    </figure>
  );
}
