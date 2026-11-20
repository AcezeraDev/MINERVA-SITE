import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Code2, Copy, Download, Eye, Loader2, Maximize2, Monitor, Play, RotateCw, Smartphone, SquareTerminal, X } from "lucide-react";
import { buildPreviewHtml, type Project } from "../../../shared/projeto.mjs";
import { closeMonitor, selectVersion, useMonitor, versionOf, type MonitorEntry } from "./store";
import { downloadFile, downloadZip } from "./download";
import { RunOutput, useRunner } from "../CodeRunner";
import "./mine-monitor.css";

/*
 * Monitor da Mine: painel ao lado do chat (tela cheia no celular) com o
 * projeto que ela escreveu. Abas Prévia (site rodando), Console (saída do
 * Python/JS ou erros do site) e Código (arquivos em abas), versões da
 * conversa e "Baixar .zip".
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

function SiteFrame({ html, device, reloadKey, frameRef, title }: { html: string; device: "desktop" | "mobile"; reloadKey: number; frameRef?: React.RefObject<HTMLIFrameElement>; title: string }) {
  const srcDoc = useMemo(() => withBridge(html), [html]);
  return (
    <div className={`mmo-stage is-${device}`}>
      <iframe key={reloadKey} ref={frameRef} className="mmo-frame" title={`Prévia: ${title}`} srcDoc={srcDoc} sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer" />
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
  const scroller = useRef<HTMLPreElement>(null);
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
      <div className="mmo-files" role="tablist" aria-label="Arquivos">
        {project.files.map((item) => (
          <button key={item.path} type="button" role="tab" aria-selected={item.path === file.path} className={item.path === file.path ? "is-on" : ""} onClick={() => setChosen(item.path)}>
            {item.writing ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {item.path}
          </button>
        ))}
        <span className="mmo-files__tools">
          <button type="button" onClick={copy} disabled={file.writing} title="Copiar arquivo">
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />} <span>{copied ? "Copiado" : "Copiar"}</span>
          </button>
          <button type="button" onClick={() => downloadFile(file.path, file.content)} disabled={file.writing} title="Baixar só este arquivo">
            <Download aria-hidden />
          </button>
        </span>
      </div>
      <pre ref={scroller} className="mmo-code mrt-codebox">
        {html ? <code dangerouslySetInnerHTML={{ __html: html }} /> : <code>{file.content}</code>}
      </pre>
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
        <span className="mmo-hint">{language === "python" ? "Python roda aqui mesmo, no navegador. input() pergunta na saída." : "JavaScript roda isolado, sem página."}</span>
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
        <p className="mmo-empty">Nada por aqui. O que o site escrever com console.log() e os erros dele aparecem nesta aba.</p>
      )}
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
  const version = versionOf(entries, entry);

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

  return (
    <>
      <header className="mmo-head">
        <div className="mmo-title">
          <strong title={project.name}>{project.name}</strong>
          {entries.length > 1 ? (
            <label className="mmo-version">
              <span className="sr-only">Versão</span>
              <select value={entry.key} onChange={(event) => selectVersion(event.target.value)}>
                {entries.map((item) => {
                  const v = versionOf(entries, item);
                  return (
                    <option key={item.key} value={item.key}>
                      {item.project.name.slice(0, 28)} · v{v.number}
                    </option>
                  );
                })}
              </select>
            </label>
          ) : version.total > 1 ? (
            <small>v{version.number}</small>
          ) : null}
        </div>
        <div className="mmo-head__actions">
          <button type="button" className="mmo-zip" onClick={() => downloadZip(project)} disabled={streaming}>
            <Download aria-hidden /> <span>Baixar .zip</span>
          </button>
          <button type="button" className="mmo-icon" onClick={closeMonitor} aria-label="Fechar monitor" title="Fechar monitor">
            <X aria-hidden />
          </button>
        </div>
      </header>

      <nav className="mmo-tabs" role="tablist" aria-label="Ver projeto">
        {isSite ? (
          <button type="button" role="tab" aria-selected={tab === "preview"} className={tab === "preview" ? "is-on" : ""} onClick={() => setTab("preview")}>
            <Eye aria-hidden /> Prévia
          </button>
        ) : null}
        {isSite || runnable ? (
          <button type="button" role="tab" aria-selected={tab === "console"} className={tab === "console" ? "is-on" : ""} onClick={() => setTab("console")}>
            <SquareTerminal aria-hidden /> Console
            {errors ? <span className="mmo-badge" aria-label={`${errors} erros`}>{errors}</span> : null}
          </button>
        ) : null}
        <button type="button" role="tab" aria-selected={tab === "code"} className={tab === "code" ? "is-on" : ""} onClick={() => setTab("code")}>
          <Code2 aria-hidden /> Código
        </button>
        {streaming ? (
          <span className="mmo-writing">
            <Loader2 className="animate-spin" aria-hidden /> escrevendo {writingPath || ""}…
          </span>
        ) : null}
      </nav>

      <div className="mmo-body">
        {isSite ? (
          <div className="mmo-pane" hidden={tab !== "preview"}>
            <div className="mmo-tools">
              <span className="mmo-seg" role="group" aria-label="Tamanho da tela">
                <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} title="Computador">
                  <Monitor aria-hidden /> <span>Computador</span>
                </button>
                <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} title="Celular">
                  <Smartphone aria-hidden /> <span>Celular</span>
                </button>
              </span>
              <span className="mmo-tools__right">
                <button type="button" onClick={() => setReloadKey((value) => value + 1)} title="Recarregar" aria-label="Recarregar prévia" disabled={!html}>
                  <RotateCw aria-hidden />
                </button>
                <button type="button" onClick={() => setFull(true)} title="Tela cheia" aria-label="Tela cheia" disabled={!html}>
                  <Maximize2 aria-hidden />
                </button>
              </span>
            </div>
            {html ? (
              <SiteFrame html={html} device={device} reloadKey={reloadKey} frameRef={frameRef} title={project.name} />
            ) : (
              <p className="mmo-empty mmo-wait">
                <Loader2 className="animate-spin" aria-hidden /> A prévia aparece quando a Mine terminar de escrever.
              </p>
            )}
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
