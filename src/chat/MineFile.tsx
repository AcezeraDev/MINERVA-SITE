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
import { BookOpenText, Download, Eye, FileCode2, FileSpreadsheet, FileText, Loader2, Printer, RotateCcw, Telescope, X } from "lucide-react";
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
import { useMineQueries, useMineSources } from "./MineSources";
import { DossieProgresso } from "./DossieProgresso";
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

/** Abre a impressão do navegador só com a página do arquivo, sugerindo o nome no PDF. */
function printAsPdf(html: string, baseName?: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;";
  frame.srcdoc = html;
  frame.onload = () => {
    window.setTimeout(() => {
      const previousTitle = document.title;
      if (baseName) document.title = baseName;
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } finally {
        window.setTimeout(() => {
          if (baseName && document.title === baseName) document.title = previousTitle;
        }, 1200);
        window.setTimeout(() => frame.remove(), 60_000);
      }
    }, 150);
  };
  document.body.appendChild(frame);
}

export const MineFileCard = memo(function MineFileCard({ code, open, cortado = false }: { code: string; open: boolean; cortado?: boolean }) {
  const file = useMemo(() => parseFileBlock(code), [code]);
  const sources = useMineSources();
  const queries = useMineQueries();
  const [preview, setPreview] = useState(false);
  const [hint, setHint] = useState("");
  const isDossier = file.modelo === "pesquisa";
  const html = useMemo(() => (open ? "" : fileHtml(file, { sources, queries })), [file, open, sources, queries]);
  const sheets = useMemo(() => (file.tipo === "excel" && !open ? sheetsFromMarkdown(file.corpo) : []), [file, open]);
  const look = isDossier ? { label: "Dossiê em PDF", icon: Telescope, tone: "#168A58" } : LOOKS[file.tipo];
  const Icon = look.icon;
  const base = fileBaseName(file.titulo);

  useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(() => setHint(""), 6000);
    return () => window.clearTimeout(timer);
  }, [hint]);

  if (open && isDossier) {
    return <DossieProgresso fase="escrevendo" queries={queries} sources={sources} corpo={file.corpo} titulo={file.titulo} />;
  }

  if (open) {
    const headings = file.corpo.match(/^##\s+(.+)$/gm) || [];
    const liveSecs = headings.length;
    const lastSec = headings.length ? headings[headings.length - 1].replace(/^##\s+/, "").trim() : "";
    return (
      <div className={`mfile is-building${isDossier ? " is-pesquisa" : ""}`} role="status" aria-live="polite">
        <span className="mfile__icon" style={{ "--mfile-tone": look.tone } as React.CSSProperties}>
          <Loader2 className="mfile__spin" aria-hidden />
        </span>
        <span className="mfile__body">
          <strong>{isDossier ? "Montando o PDF do dossiê…" : `Montando o ${look.label}…`}</strong>
          <small>
            {lastSec
              ? `${file.titulo !== "Arquivo da Mine" ? `${file.titulo} · ` : ""}seção ${liveSecs}: ${lastSec}`
              : file.titulo !== "Arquivo da Mine"
                ? file.titulo
                : "a Mine está escrevendo e organizando o conteúdo"}
          </small>
        </span>
      </div>
    );
  }

  const meta =
    file.tipo === "excel"
      ? `${sheets.length || 1} ${sheets.length === 1 ? "aba" : "abas"} · ${sheets.reduce((sum, sheet) => sum + sheet.rows.length - 1, 0)} linhas`
      : (() => {
          const secoes = (file.corpo.match(/^##\s/gm) || []).length || 1;
          const pags = Math.max(1, Math.round(file.corpo.split(/\s+/).length / 360));
          const refs = sources?.length ? ` · ${sources.length} ${sources.length === 1 ? "fonte" : "fontes"}` : "";
          return `${secoes} ${secoes === 1 ? "seção" : "seções"} · ${pags} pág. aprox.${refs}`;
        })();

  const pdf = () => {
    printAsPdf(html, base);
    setHint("Na janela de impressão que abriu, escolha “Salvar como PDF” para guardar o documento diagramado.");
  };
  const downloadHtml = () => save(html, "text/html;charset=utf-8", `${base}.html`);
  const actions: Array<{ key: string; label: string; run: () => void }> =
    file.tipo === "excel"
      ? [
          { key: "xlsx", label: "Excel (.xlsx)", run: () => save(buildXlsx(file), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `${base}.xlsx`) },
          ...(sheets[0] ? [{ key: "csv", label: sheets.length > 1 ? "CSV (1ª aba)" : "CSV", run: () => save(sheetCsv(sheets[0]), "text/csv;charset=utf-8", `${base}.csv`) }] : []),
          { key: "pdf", label: "PDF", run: pdf },
        ]
      : [
          { key: "pdf", label: "PDF", run: pdf },
          // O dossiê da Pesquisa aprofundada sai só em PDF: o HTML é a forma de
          // diagramar a página, não um formato a mais para o estudante.
          ...(isDossier ? [] : [{ key: "html", label: "HTML", run: downloadHtml }]),
          ...(isDossier ? [] : [{ key: "docx", label: "Word (.docx)", run: () => save(buildDocx(file, { sources }), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", `${base}.docx`) }]),
        ];
  const primaryKey = { pdf: "pdf", word: "docx", excel: "xlsx", html: "html" }[file.tipo];
  const primary = actions.find((action) => action.key === primaryKey) || actions[0];
  const others = actions.filter((action) => action !== primary);

  return (
    <figure className={`mfile${isDossier ? " mfile--pesquisa" : ""}`} style={{ "--mfile-tone": look.tone } as React.CSSProperties}>
      <button type="button" className="mfile__sheet" onClick={() => setPreview(true)} aria-label={`Ver prévia de ${file.titulo}`}>
        {isDossier ? (
          <span className="mfile__badge">
            <Telescope aria-hidden />
            Pesquisa aprofundada · PDF
          </span>
        ) : null}
        {file.tipo === "excel" && sheets[0] ? <SheetThumb rows={displayRows(sheets[0])} /> : <PageThumb html={html} title={file.titulo} />}
        <span className="mfile__peek">
          <Eye aria-hidden />
          {isDossier ? "Ler dossiê" : "Ver"}
        </span>
      </button>
      <figcaption className="mfile__info">
        <span className="mfile__icon">
          <Icon aria-hidden />
        </span>
        <span className="mfile__body">
          {isDossier && file.materia ? <span className="mfile__eyebrow">{file.materia}</span> : null}
          <strong>{file.titulo}</strong>
          {isDossier && file.subtitulo ? <span className="mfile__sub">{file.subtitulo}</span> : null}
          <small>
            {look.label} · {meta}
          </small>
        </span>
        <span className="mfile__actions">
          <button type="button" className="mfile__primary" onClick={primary.run}>
            {primary.key === "pdf" ? <Printer aria-hidden /> : <Download aria-hidden />}
            {isDossier ? "Salvar em PDF" : `Baixar ${primary.label.replace(/\s*\(.*\)/, "")}`}
          </button>
          {isDossier ? (
            <button type="button" className="mfile__read" onClick={() => setPreview(true)}>
              <BookOpenText aria-hidden />
              Ver o PDF
            </button>
          ) : null}
          <span className="mfile__more" aria-label="Outros formatos">
            {others.map((action) => (
              <button key={action.key} type="button" onClick={action.run}>
                {action.key === "html" ? `Baixar ${action.label}` : action.label}
              </button>
            ))}
          </span>
        </span>
        {cortado ? (
          <span className="mfile__hint is-cortado" role="status">
            <span>Este arquivo chegou incompleto: dá para baixar o que veio, ou pedir de novo.</span>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("mine:escrever", { detail: `Refaça o arquivo "${file.titulo}" completo, um pouco mais curto.` }))}
            >
              <RotateCcw aria-hidden /> Pedir o arquivo completo
            </button>
          </span>
        ) : null}
        {hint ? (
          <span className="mfile__hint" role="status">
            {hint}
          </span>
        ) : null}
      </figcaption>
      {preview ? <PreviewDialog html={html} title={file.titulo} onClose={() => setPreview(false)} onPdf={pdf} onDownloadHtml={file.tipo !== "excel" && !isDossier ? downloadHtml : undefined} /> : null}
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

function PreviewDialog({
  html,
  title,
  onClose,
  onPdf,
  onDownloadHtml,
}: {
  html: string;
  title: string;
  onClose: () => void;
  onPdf: () => void;
  onDownloadHtml?: () => void;
}) {
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
          {onDownloadHtml ? (
            <button type="button" className="is-ghost" onClick={onDownloadHtml}>
              <Download aria-hidden />
              Baixar HTML
            </button>
          ) : null}
          <button type="button" onClick={onPdf}>
            <Printer aria-hidden />
            Salvar em PDF
          </button>
          <button ref={closeRef} type="button" className="is-close" onClick={onClose} aria-label="Fechar prévia">
            <X aria-hidden />
          </button>
        </header>
        <iframe title={`Prévia: ${title}`} srcDoc={html} sandbox="allow-popups allow-popups-to-escape-sandbox" />
      </div>
    </div>,
    document.body,
  );
}
