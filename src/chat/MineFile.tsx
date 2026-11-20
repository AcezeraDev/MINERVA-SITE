/*
  Arquivo criado pela Mine (nov/2026): o bloco ```arquivo de uma resposta vira
  um cartão com prévia da página e botões para baixar em PDF, Word, HTML ou
  Excel/CSV. Os bytes saem de shared/chat-files.mjs, no próprio navegador:
  nada vai para o servidor e nada fica guardado além do texto da conversa.

  PDF: a página diagramada abre na impressão do navegador ("Salvar como PDF"),
  que mantém o texto selecionável e a fonte nítida, melhor que um PDF de
  imagem. Word e Excel são arquivos de verdade, que abrem sem reparo.
*/
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Eye, FileCode2, FileSpreadsheet, FileText, Loader2, Printer, X } from "lucide-react";
import {
  buildDocx,
  buildXlsx,
  displayRows,
  fileBaseName,
  fileHtml,
  parseFileBlock,
  sheetCsv,
  sheetsFromMarkdown,
  type FileKind,
} from "../../shared/chat-files.mjs";
import "./mine-file.css";

const LOOKS: Record<FileKind, { label: string; icon: typeof FileText; tone: string }> = {
  pdf: { label: "PDF", icon: FileText, tone: "#E5533D" },
  word: { label: "Word", icon: FileText, tone: "#2B6CD8" },
  excel: { label: "Excel", icon: FileSpreadsheet, tone: "#1F8A4C" },
  html: { label: "HTML", icon: FileCode2, tone: "#C9741A" },
};

function save(data: BlobPart, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Abre a impressão do navegador só com a página do arquivo. */
function printAsPdf(html: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;";
  frame.srcdoc = html;
  frame.onload = () => {
    window.setTimeout(() => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } finally {
        window.setTimeout(() => frame.remove(), 60_000);
      }
    }, 150);
  };
  document.body.appendChild(frame);
}

export const MineFileCard = memo(function MineFileCard({ code, open }: { code: string; open: boolean }) {
  const file = useMemo(() => parseFileBlock(code), [code]);
  const [preview, setPreview] = useState(false);
  const [hint, setHint] = useState("");
  const html = useMemo(() => (open ? "" : fileHtml(file)), [file, open]);
  const sheets = useMemo(() => (file.tipo === "excel" && !open ? sheetsFromMarkdown(file.corpo) : []), [file, open]);
  const look = LOOKS[file.tipo];
  const Icon = look.icon;
  const base = fileBaseName(file.titulo);

  useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(() => setHint(""), 6000);
    return () => window.clearTimeout(timer);
  }, [hint]);

  if (open) {
    return (
      <div className="mfile is-building" role="status" aria-live="polite">
        <span className="mfile__icon" style={{ "--mfile-tone": look.tone } as React.CSSProperties}>
          <Loader2 className="mfile__spin" aria-hidden />
        </span>
        <span className="mfile__body">
          <strong>Montando o {look.label}…</strong>
          <small>{file.titulo !== "Arquivo da Mine" ? file.titulo : "a Mine está escrevendo o conteúdo"}</small>
        </span>
      </div>
    );
  }

  const meta =
    file.tipo === "excel"
      ? `${sheets.length || 1} ${sheets.length === 1 ? "aba" : "abas"} · ${sheets.reduce((sum, sheet) => sum + sheet.rows.length - 1, 0)} linhas`
      : (() => {
          const secoes = (file.corpo.match(/^#{2,3}\s/gm) || []).length || 1;
          return `${secoes} ${secoes === 1 ? "seção" : "seções"} · ${Math.max(1, Math.round(file.corpo.split(/\s+/).length / 380))} pág. aprox.`;
        })();

  const pdf = () => {
    printAsPdf(html);
    setHint("Na janela que abriu, escolha “Salvar como PDF” como impressora.");
  };
  const actions: Array<{ key: string; label: string; run: () => void }> =
    file.tipo === "excel"
      ? [
          { key: "xlsx", label: "Excel (.xlsx)", run: () => save(buildXlsx(file), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `${base}.xlsx`) },
          ...(sheets[0] ? [{ key: "csv", label: sheets.length > 1 ? "CSV (1ª aba)" : "CSV", run: () => save(sheetCsv(sheets[0]), "text/csv;charset=utf-8", `${base}.csv`) }] : []),
          { key: "pdf", label: "PDF", run: pdf },
        ]
      : [
          { key: "pdf", label: "PDF", run: pdf },
          { key: "docx", label: "Word (.docx)", run: () => save(buildDocx(file), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", `${base}.docx`) },
          { key: "html", label: "HTML", run: () => save(html, "text/html;charset=utf-8", `${base}.html`) },
        ];
  const primaryKey = { pdf: "pdf", word: "docx", excel: "xlsx", html: "html" }[file.tipo];
  const primary = actions.find((action) => action.key === primaryKey) || actions[0];
  const others = actions.filter((action) => action !== primary);

  return (
    <figure className="mfile" style={{ "--mfile-tone": look.tone } as React.CSSProperties}>
      <button type="button" className="mfile__sheet" onClick={() => setPreview(true)} aria-label={`Ver prévia de ${file.titulo}`}>
        {file.tipo === "excel" && sheets[0] ? <SheetThumb rows={displayRows(sheets[0])} /> : <PageThumb html={html} title={file.titulo} />}
        <span className="mfile__peek">
          <Eye aria-hidden />
          Ver
        </span>
      </button>
      <figcaption className="mfile__info">
        <span className="mfile__icon">
          <Icon aria-hidden />
        </span>
        <span className="mfile__body">
          <strong>{file.titulo}</strong>
          <small>
            {look.label} · {meta}
          </small>
        </span>
        <span className="mfile__actions">
          <button type="button" className="mfile__primary" onClick={primary.run}>
            {primary.key === "pdf" ? <Printer aria-hidden /> : <Download aria-hidden />}
            Baixar {primary.label.replace(/\s*\(.*\)/, "")}
          </button>
          <span className="mfile__more" aria-label="Outros formatos">
            {others.map((action) => (
              <button key={action.key} type="button" onClick={action.run}>
                {action.label}
              </button>
            ))}
          </span>
        </span>
        {hint ? (
          <span className="mfile__hint" role="status">
            {hint}
          </span>
        ) : null}
      </figcaption>
      {preview ? <PreviewDialog html={html} title={file.titulo} onClose={() => setPreview(false)} onPdf={pdf} /> : null}
    </figure>
  );
});

/** O topo da página, em miniatura (a página de verdade, num iframe reduzido). */
function PageThumb({ html, title }: { html: string; title: string }) {
  return (
    <span className="mfile__page" aria-hidden>
      <iframe title={`Miniatura: ${title}`} srcDoc={html} tabIndex={-1} loading="lazy" sandbox="" />
    </span>
  );
}

function SheetThumb({ rows }: { rows: string[][] }) {
  const shown = rows.slice(0, 6);
  const columns = Math.min(5, rows[0]?.length || 0);
  return (
    <span className="mfile__grid" aria-hidden style={{ gridTemplateColumns: `2rem repeat(${columns}, minmax(0, 1fr))` }}>
      <span className="is-corner" />
      {Array.from({ length: columns }, (_, column) => (
        <span key={`h${column}`} className="is-col">
          {String.fromCharCode(65 + column)}
        </span>
      ))}
      {shown.map((row, rowIndex) => (
        <React.Fragment key={rowIndex}>
          <span className="is-row">{rowIndex + 1}</span>
          {row.slice(0, columns).map((cell, column) => (
            <span key={column} className={rowIndex === 0 ? "is-head" : /^[-\d.,%R$\s]+$/.test(cell) && cell.trim() ? "is-num" : ""}>
              {cell}
            </span>
          ))}
        </React.Fragment>
      ))}
    </span>
  );
}

function PreviewDialog({ html, title, onClose, onPdf }: { html: string; title: string; onClose: () => void; onPdf: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return createPortal(
    <div className="mfile-dialog" role="dialog" aria-modal="true" aria-label={`Prévia: ${title}`} onClick={onClose}>
      <div className="mfile-dialog__panel" onClick={(event) => event.stopPropagation()}>
        <header>
          <strong>{title}</strong>
          <button type="button" onClick={onPdf}>
            <Printer aria-hidden />
            Salvar em PDF
          </button>
          <button ref={closeRef} type="button" className="is-close" onClick={onClose} aria-label="Fechar prévia">
            <X aria-hidden />
          </button>
        </header>
        <iframe title={`Prévia: ${title}`} srcDoc={html} sandbox="" />
      </div>
    </div>,
    document.body,
  );
}
