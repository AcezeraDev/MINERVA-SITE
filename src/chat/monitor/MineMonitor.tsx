import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Code2, Copy, Download, Eye, Loader2, Lock, Maximize2, Monitor, Play, RotateCw, Smartphone, SquareTerminal, X } from "lucide-react";
import { buildPreviewHtml, slug, type Project } from "../../../shared/projeto.mjs";
import { closeMonitor, selectVersion, useMonitor, versionOf, type MonitorEntry } from "./store";
import { downloadFile, downloadZip } from "./download";
import { RunOutput, useRunner } from "../CodeRunner";
import "./mine-monitor.css";

/*
 * Monitor da Mine: painel ao lado do chat (tela cheia no celular) com o
 * projeto que ela escreveu. Abas Prévia (site rodando numa janela de
 * navegador), Console (saída do Python/JS ou erros do site) e Código
 * (arquivos em abas, com número de linha), versões da conversa e .zip.
 *
 * Segurança: o site roda num iframe `sandbox="allow-scripts allow-forms"`
 * SEM `allow-same-origin` — origem opaca, sem acesso à sessão do Minerva.
 */

type Tab = "preview" | "console" | "code";
type SiteLog = { kind: "log" | "warn" | "error"; text: string };

// Links não tiram a prévia do lugar; console e erros do site vão para a aba Console.
const SITE_BRIDGE = `<script>(function(){
document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a)return;var h=a.getAttribute("href")||"";if(h.charAt(0)!=="#"){e.preventDefault();}},true);
var send=function(kind,args){try{var t=Array.prototype.map.call(args,function(v){try{if(typeof v==="string")return v;if(v instanceof Error)return v.name+": "+v.message;return JSON.stringify(v)}catch(x){return String(v)}}).join(" ");parent.postMessage({mineSite:true,kind:kind,text:t.slice(0,2000)},"*")}catch(x){}};
var l=console.log,w=console.warn,er=console.error;
console.log=function(){send("log",arguments);l.apply(console,arguments)};console.info=console.log;
console.warn=function(){send("warn",arguments);w.apply(console,arguments)};
console.error=function(){send("error",arguments);er.apply(console,arguments)};
window.addEventListener("error",function(e){send("error",[e.message+(e.lineno?" (linha "+e.lineno+")":"")])});
window.addEventListener("unhandledrejection",function(e){send("error",[e.reason&&e.reason.message?e.reason.message:String(e.reason)])});
})();<\/script>`;

function withBridge(html: string) {
  // Antes de qualquer script da página, para pegar até o primeiro erro.
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (tag) => `${tag}${SITE_BRIDGE}`);
  return `${SITE_BRIDGE}${html}`;
}

const LANG_LABEL: Record<string, string> = { html: "HTML", css: "CSS", javascript: "JS", python: "PY", markdown: "MD", json: "JSON", text: "TXT" };

function FileDot({ language }: { language: string }) {
  return <i className={`mmo-dot is-${language}`} aria-hidden />;
}

function SiteFrame({ html, device, reloadKey, frameRef, title }: { html: string; device: "desktop" | "mobile"; reloadKey: number; frameRef?: React.RefObject<HTMLIFrameElement>; title: string }) {
  const srcDoc = useMemo(() => withBridge(html), [html]);
  return <iframe key={`${reloadKey}-${device}`} ref={frameRef} className="mmo-frame" title={`Prévia: ${title}`} srcDoc={srcDoc} sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer" />;
}

/** Janela de navegador (computador) ou celular em volta da prévia. */
function Device({ project, device, children, onReload, onFull, ready }: { project: Project; device: "desktop" | "mobile"; children: React.ReactNode; onReload: () => void; onFull: () => void; ready: boolean }) {
  const address = `${slug(project.name)}.minerva/${project.entry || "index.html"}`;
  if (device === "mobile") {
    return (
      <div className="mmo-phone">
        <span className="mmo-phone__island" aria-hidden />
        <div className="mmo-phone__screen">{children}</div>
      </div>
    );
  }
  return (
    <div className="mmo-browser">
      <div className="mmo-browser__bar">
        <span className="mmo-browser__dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="mmo-browser__address" title={address}>
          <Lock aria-hidden />
          <span>{address}</span>
        </span>
        <span className="mmo-browser__tools">
          <button type="button" onClick={onReload} aria-label="Recarregar prévia" title="Recarregar" disabled={!ready}>
            <RotateCw aria-hidden />
          </button>
          <button type="button" onClick={onFull} aria-label="Abrir em tela cheia" title="Tela cheia" disabled={!ready}>
            <Maximize2 aria-hidden />
          </button>
        </span>
      </div>
      <div className="mmo-browser__view">{children}</div>
    </div>
  );
}

function useHighlight() {
  const [fn, setFn] = useState<((code: string, lang: string) => string | null) | null>(null);
  useEffect(() => {
    let alive = true;
    void import("../highlight").then((module) => alive && setFn(() => module.highlightCode));
    return () => {
      alive = false;
    };
  }, []);
  return fn;
}

const HL_LANG: Record<string, string> = { html: "xml", markdown: "", text: "" };

function CodeView({ project, writingPath }: { project: Project; writingPath?: string }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const highlight = useHighlight();
  // Enquanto a Mine escreve, a aba acompanha o arquivo que está chegando.
  const path = writingPath || (chosen && project.files.some((file) => file.path === chosen) ? chosen : project.entry || project.files[0]?.path);
  const file = project.files.find((item) => item.path === path) || project.files[0];
  const html = useMemo(() => {
    if (!file || file.writing || !highlight) return null;
    const lang = HL_LANG[file.language] ?? file.language;
    return lang ? highlight(file.content, lang) : null;
  }, [file, highlight]);
  const lineCount = file ? file.content.split("\n").length : 0;
  const gutter = useMemo(() => Array.from({ length: lineCount }, (_, index) => index + 1).join("\n"), [lineCount]);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (file?.writing && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [file?.content, file?.writing]);
  if (!file) return <p className="mmo-empty">Nenhum arquivo ainda.</p>;
  const copy = () => {
    void navigator.clipboard?.writeText(file.content).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  };
  return (
    <div className="mmo-codeview">
      <div className="mmo-files" role="tablist" aria-label="Arquivos do projeto">
        {project.files.map((item) => (
          <button key={item.path} type="button" role="tab" aria-selected={item.path === file.path} className={item.path === file.path ? "is-on" : ""} onClick={() => setChosen(item.path)}>
            {item.writing ? <Loader2 className="animate-spin" aria-hidden /> : <FileDot language={item.language} />}
            {item.path}
          </button>
        ))}
      </div>
      <div className="mmo-sheet">
        <div className="mmo-sheet__bar">
          <span className="mmo-sheet__meta">
            <span className="mmo-lang">{LANG_LABEL[file.language] || file.language.toUpperCase()}</span>
            {lineCount} {lineCount === 1 ? "linha" : "linhas"}
          </span>
          <span className="mmo-sheet__tools">
            <button type="button" onClick={copy} disabled={file.writing}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copiado" : "Copiar"}
            </button>
            <button type="button" onClick={() => downloadFile(file.path, file.content)} disabled={file.writing} aria-label={`Baixar ${file.path}`} title={`Baixar só ${file.path}`}>
              <Download aria-hidden />
            </button>
          </span>
        </div>
        <div ref={scroller} className="mmo-code mrt-codebox" tabIndex={0} aria-label={`Código de ${file.path}`}>
          <pre className="mmo-gutter" aria-hidden>
            {gutter}
          </pre>
          <pre className="mmo-source">
            {html ? <code dangerouslySetInnerHTML={{ __html: html }} /> : <code>{file.content}</code>}
            {file.writing ? <span className="mmo-caret" aria-hidden /> : null}
          </pre>
        </div>
      </div>
    </div>
  );
}

function RunPanel({ project }: { project: Project }) {
  const runner = useRunner();
  const busy = runner.status !== "idle";
  const language = project.kind === "python" ? "python" : "javascript";
  const entry = project.files.find((file) => file.path === project.entry);
  const run = () => {
    if (!entry) return;
    if (language === "python") void runner.run("python", entry.content, { files: project.files.filter((file) => file.language === "python").map(({ path, content }) => ({ path, content })) });
    // JavaScript sem página: os outros .js entram antes do principal.
    else void runner.run("javascript", [...project.files.filter((file) => file.language === "javascript" && file !== entry), entry].map((file) => file.content).join("\n;\n"));
  };
  const writing = project.files.some((file) => file.writing);
  return (
    <div className="mmo-run">
      <div className="mmo-run__bar">
        <button type="button" className="mcr-run" onClick={run} disabled={busy || writing || !entry}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
          {busy ? "Rodando…" : `Executar ${project.entry}`}
        </button>
        <span className="mmo-hint">{language === "python" ? "Roda aqui no navegador. Se o programa perguntar algo, responda na saída." : "Roda isolado, sem página."}</span>
      </div>
      <RunOutput runner={runner} onClear={runner.clear} standalone />
    </div>
  );
}

function SiteConsole({ logs, onClear }: { logs: SiteLog[]; onClear: () => void }) {
  return (
    <div className="mmo-sitelog" role="log" aria-live="polite">
      <div className="mmo-sitelog__bar">
        <SquareTerminal aria-hidden /> Console do site
        {logs.length ? (
          <button type="button" onClick={onClear}>
            Limpar
          </button>
        ) : null}
      </div>
      {logs.length ? (
        <ol>
          {logs.map((log, index) => (
            <li key={index} className={`is-${log.kind}`}>
              {log.text}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mmo-empty">Tudo limpo. O que o site escrever com console.log() e os erros dele aparecem aqui.</p>
      )}
    </div>
  );
}

/** Enquanto a Mine escreve: a janela vazia mostra o progresso arquivo por arquivo. */
function Writing({ project }: { project: Project }) {
  const done = project.files.filter((file) => !file.writing).length;
  const current = project.files.find((file) => file.writing)?.path;
  return (
    <div className="mmo-writingstate">
      <ol className="mmo-writingstate__files">
        {project.files.map((file) => (
          <li key={file.path} className={file.writing ? "is-now" : "is-done"}>
            {file.writing ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
            {file.path}
          </li>
        ))}
      </ol>
      <p>
        A Mine está escrevendo {current || "o projeto"}. A prévia liga quando ela terminar
        {project.files.length > 1 ? ` (${done} de ${project.files.length} prontos)` : ""}.
      </p>
    </div>
  );
}

function MonitorBody({ entry, entries }: { entry: MonitorEntry; entries: MonitorEntry[] }) {
  const { project, streaming } = entry;
  const isSite = project.kind === "site";
  const runnable = project.kind === "python" || project.kind === "javascript";
  const writingPath = project.files.find((file) => file.writing)?.path;
  const [tab, setTab] = useState<Tab>(isSite ? "preview" : runnable ? "console" : "code");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [reloadKey, setReloadKey] = useState(0);
  const [full, setFull] = useState(false);
  const [logs, setLogs] = useState<SiteLog[]>([]);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const fullRef = useRef<HTMLIFrameElement>(null);

  // Escrevendo: mostra o código chegando. Terminou: vai para a prévia/console.
  useEffect(() => {
    setTab(streaming ? "code" : isSite ? "preview" : runnable ? "console" : "code");
  }, [streaming, entry.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const html = useMemo(() => (isSite && !streaming ? buildPreviewHtml(project.files, project.entry) : ""), [isSite, streaming, project]);
  useEffect(() => setLogs([]), [html, reloadKey]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!event.data?.mineSite) return;
      if (event.source !== frameRef.current?.contentWindow && event.source !== fullRef.current?.contentWindow) return;
      const { kind, text } = event.data as SiteLog;
      setLogs((current) => [...current, { kind, text: String(text) }].slice(-200));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!full) return undefined;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  const errors = logs.filter((log) => log.kind === "error").length;
  // Versões do MESMO projeto viram chips; outros projetos da conversa, um seletor.
  const name = project.name.toLowerCase();
  const versions = entries.filter((item) => item.project.name.toLowerCase() === name);
  // Um item por projeto da conversa (a versão mais nova de cada).
  const latestByName = new Map(entries.map((item) => [item.project.name.toLowerCase(), item]));
  const others = [...latestByName.values()];
  const kindLabel = isSite ? "Site" : project.kind === "python" ? "Python" : project.kind === "javascript" ? "JavaScript" : "Código";

  return (
    <>
      <header className="mmo-head">
        <div className="mmo-title">
          {others.length > 1 ? (
            <label className="mmo-switch">
              <span className="sr-only">Projeto da conversa</span>
              <select value={others.find((item) => item.project.name.toLowerCase() === name)?.key} onChange={(event) => selectVersion(event.target.value)}>
                {others.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.project.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <strong title={project.name}>{project.name}</strong>
          )}
          <span className="mmo-kind">
            {kindLabel} · {project.files.length} {project.files.length === 1 ? "arquivo" : "arquivos"}
          </span>
        </div>
        <div className="mmo-head__actions">
          <button type="button" className="mmo-zip" onClick={() => downloadZip(project)} disabled={streaming}>
            <Download aria-hidden /> <span>Baixar .zip</span>
          </button>
          <button type="button" className="mmo-icon" onClick={closeMonitor} aria-label="Fechar monitor" title="Fechar (Esc)">
            <X aria-hidden />
          </button>
        </div>
      </header>

      <nav className="mmo-tabs" aria-label="Ver projeto">
        <span role="tablist" className="mmo-tabs__list">
          {isSite ? (
            <button type="button" role="tab" aria-selected={tab === "preview"} className={tab === "preview" ? "is-on" : ""} onClick={() => setTab("preview")}>
              <Eye aria-hidden /> Prévia
            </button>
          ) : null}
          {isSite || runnable ? (
            <button type="button" role="tab" aria-selected={tab === "console"} className={tab === "console" ? "is-on" : ""} onClick={() => setTab("console")}>
              <SquareTerminal aria-hidden /> Console
              {errors ? <span className="mmo-badge" aria-label={`${errors} ${errors === 1 ? "erro" : "erros"}`}>{errors}</span> : null}
            </button>
          ) : null}
          <button type="button" role="tab" aria-selected={tab === "code"} className={tab === "code" ? "is-on" : ""} onClick={() => setTab("code")}>
            <Code2 aria-hidden /> Código
          </button>
        </span>
        {versions.length > 1 ? (
          <span className="mmo-versions" role="group" aria-label="Versões">
            {versions.map((item, index) => (
              <button key={item.key} type="button" aria-pressed={item.key === entry.key} onClick={() => selectVersion(item.key)} title={`Versão ${index + 1}`}>
                v{index + 1}
              </button>
            ))}
          </span>
        ) : null}
        {isSite && tab === "preview" && !streaming ? (
          <span className="mmo-seg" role="group" aria-label="Tamanho da tela">
            <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} aria-label="Computador" title="Computador">
              <Monitor aria-hidden />
            </button>
            <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} aria-label="Celular" title="Celular">
              <Smartphone aria-hidden />
            </button>
          </span>
        ) : null}
      </nav>

      <div className="mmo-body">
        {isSite ? (
          <div className="mmo-pane mmo-desk" hidden={tab !== "preview"}>
            <Device project={project} device={device} onReload={() => setReloadKey((value) => value + 1)} onFull={() => setFull(true)} ready={Boolean(html)}>
              {html ? (
                <div className="mmo-boot" key={`${html.length}-${reloadKey}`}>
                  <SiteFrame html={html} device={device} reloadKey={reloadKey} frameRef={frameRef} title={project.name} />
                </div>
              ) : (
                <Writing project={project} />
              )}
            </Device>
          </div>
        ) : null}
        {isSite ? (
          <div className="mmo-pane" hidden={tab !== "console"}>
            <SiteConsole logs={logs} onClear={() => setLogs([])} />
          </div>
        ) : runnable ? (
          <div className="mmo-pane" hidden={tab !== "console"}>
            <RunPanel project={project} />
          </div>
        ) : null}
        <div className="mmo-pane" hidden={tab !== "code"}>
          <CodeView project={project} writingPath={writingPath} />
        </div>
      </div>

      {full && html
        ? createPortal(
            <div className="mmo-full" role="dialog" aria-modal="true" aria-label={`Site em tela cheia: ${project.name}`}>
              <div className="mmo-full__bar">
                <strong>{project.name}</strong>
                <span>Esc para sair</span>
                <button type="button" onClick={() => setFull(false)} aria-label="Fechar tela cheia">
                  <X aria-hidden />
                </button>
              </div>
              <SiteFrame html={html} device="desktop" reloadKey={reloadKey} frameRef={fullRef} title={project.name} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

const WIDTH_KEY = "minerva.monitor.width";

function readWidth() {
  try {
    const value = Number(window.localStorage.getItem(WIDTH_KEY));
    return value >= 360 && value <= 1400 ? value : 0;
  } catch {
    return 0;
  }
}

/** Painel do monitor. Fica dentro do chat; some sozinho quando não há projeto. */
export function MineMonitor() {
  const monitor = useMonitor();
  const [width, setWidth] = useState(readWidth);
  const dragging = useRef(false);

  useEffect(() => {
    if (!monitor.open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(".mmo-full")) closeMonitor();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [monitor.open]);

  if (!monitor.open || !monitor.current) return null;

  // Arrastar a borda esquerda muda a largura (fica salva neste navegador).
  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const panel = event.currentTarget.parentElement;
    if (!panel) return;
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const right = panel.getBoundingClientRect().right;
    const move = (moveEvent: PointerEvent) => {
      if (!dragging.current) return;
      setWidth(Math.round(Math.min(Math.max(right - moveEvent.clientX, 360), window.innerWidth - 480)));
    };
    const up = () => {
      dragging.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setWidth((value) => {
        try {
          window.localStorage.setItem(WIDTH_KEY, String(value));
        } catch {
          /* sem armazenamento: a largura vale só agora */
        }
        return value;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <aside className="mmo" aria-label="Monitor da Mine" style={width ? ({ "--mmo-w": `${width}px` } as React.CSSProperties) : undefined}>
      <div className="mmo-resize" onPointerDown={startResize} role="separator" aria-orientation="vertical" aria-label="Arrastar para mudar a largura do monitor" />
      <MonitorBody key={monitor.current.key} entry={monitor.current} entries={monitor.entries} />
    </aside>
  );
}

/** O monitor está aberto? (o chat abre espaço para ele na grade). */
export function useMonitorOpen() {
  const monitor = useMonitor();
  return monitor.open && Boolean(monitor.current);
}
