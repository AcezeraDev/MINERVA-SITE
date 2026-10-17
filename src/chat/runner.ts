/*
 * Executa o código das respostas da Mine e do MineCode.
 *
 * - Python: Pyodide num Web Worker (python.worker.ts). Um worker só, reaproveitado
 *   entre execuções (o Pyodide demora para carregar); passou do tempo, o worker
 *   é encerrado e o próximo começa do zero.
 * - JavaScript: num iframe `sandbox="allow-scripts"` sem `allow-same-origin`,
 *   criado e destruído a cada execução. O código roda numa origem opaca: não
 *   vê o localStorage do Minerva (sessão), nem o chat, nem cookies.
 * - HTML: não executa aqui; vira a prévia de site (SitePreview.tsx).
 */

export type RunLanguage = "python" | "javascript";
/** `raw`: pedaço cru do Python (já traz as próprias quebras de linha). */
export type RunLine = { kind: "stdout" | "stderr" | "error" | "result" | "info"; text: string; raw?: boolean };
export type RunHandlers = { onLine: (line: RunLine) => void; onStatus?: (status: "loading" | "running") => void };

const PYTHON_TIMEOUT_MS = 20_000;
const JS_TIMEOUT_MS = 6_000;

export { runnableLanguage } from "../../shared/code-run.mjs";

let pythonWorker: Worker | null = null;
let pythonId = 0;

function worker() {
  if (!pythonWorker) pythonWorker = new Worker(new URL("./python.worker.ts", import.meta.url), { type: "module" });
  return pythonWorker;
}

function runPython(code: string, stdin: string[], handlers: RunHandlers) {
  return new Promise<void>((resolve) => {
    const id = ++pythonId;
    const target = worker();
    let started = false;
    let timer = 0;
    const finish = () => {
      window.clearTimeout(timer);
      target.removeEventListener("message", onMessage);
      resolve();
    };
    const onMessage = (event: MessageEvent<{ id: number; type: string; text: string }>) => {
      const message = event.data;
      if (message.id !== id) return;
      if (message.type === "status") {
        handlers.onStatus?.(message.text as "loading" | "running");
        // o relógio só começa quando o Python está pronto: baixar o Pyodide não conta
        if (message.text === "running" && !started) {
          started = true;
          timer = window.setTimeout(() => {
            target.terminate();
            pythonWorker = null;
            handlers.onLine({ kind: "error", text: `Parei o programa: passou de ${PYTHON_TIMEOUT_MS / 1000} segundos. Tem um laço que nunca termina?` });
            finish();
          }, PYTHON_TIMEOUT_MS);
        }
      } else if (message.type === "done") finish();
      else if (message.type === "raw") handlers.onLine({ kind: "stdout", text: message.text, raw: true });
      else handlers.onLine({ kind: message.type as RunLine["kind"], text: message.text });
    };
    target.addEventListener("message", onMessage);
    target.addEventListener(
      "error",
      () => {
        handlers.onLine({ kind: "error", text: "Não consegui carregar o Python. Confira a internet e tente de novo." });
        pythonWorker = null;
        finish();
      },
      { once: true },
    );
    target.postMessage({ id, code, stdin });
  });
}

const JS_HOST = `<!doctype html><meta charset="utf-8"><script>
(function(){
  var send=function(kind,args){var text=Array.prototype.map.call(args,function(v){try{if(typeof v==="string")return v;if(v instanceof Error)return v.name+": "+v.message;return JSON.stringify(v,null,1)}catch(e){return String(v)}}).join(" ");parent.postMessage({minecode:true,kind:kind,text:text},"*")};
  console.log=function(){send("stdout",arguments)};console.info=console.log;console.debug=console.log;
  console.warn=function(){send("stderr",arguments)};console.error=function(){send("stderr",arguments)};
  window.onerror=function(m){send("error",[m]);};
  window.addEventListener("unhandledrejection",function(e){send("error",[e.reason&&e.reason.message?e.reason.message:String(e.reason)])});
  window.alert=function(m){send("info",["alert: "+m])};
  window.addEventListener("message",function(e){if(!e.data||e.data.minecodeRun!==true)return;try{var r=(0,eval)(e.data.code);var finish=function(v){if(v!==undefined)send("result",[v]);parent.postMessage({minecode:true,kind:"done"},"*")};if(r&&typeof r.then==="function"){r.then(finish,function(err){send("error",[err&&err.message?err.message:String(err)]);parent.postMessage({minecode:true,kind:"done"},"*")})}else setTimeout(function(){finish(r)},30)}catch(err){send("error",[err&&err.name?err.name+": "+err.message:String(err)]);parent.postMessage({minecode:true,kind:"done"},"*")}});
  parent.postMessage({minecode:true,kind:"ready"},"*");
})();
<\/script>`;

function runJavaScript(code: string, handlers: RunHandlers) {
  return new Promise<void>((resolve) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none";
    let timer = 0;
    const finish = () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      frame.remove();
      resolve();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || !event.data?.minecode) return;
      const { kind, text } = event.data as { kind: string; text: string };
      if (kind === "ready") {
        handlers.onStatus?.("running");
        frame.contentWindow?.postMessage({ minecodeRun: true, code }, "*");
      } else if (kind === "done") finish();
      else handlers.onLine({ kind: kind as RunLine["kind"], text });
    };
    window.addEventListener("message", onMessage);
    timer = window.setTimeout(() => {
      handlers.onLine({ kind: "error", text: `Parei o programa: passou de ${JS_TIMEOUT_MS / 1000} segundos.` });
      finish();
    }, JS_TIMEOUT_MS);
    frame.srcdoc = JS_HOST;
    document.body.appendChild(frame);
  });
}

export async function runCode(language: RunLanguage, code: string, handlers: RunHandlers, stdin: string[] = []) {
  const started = performance.now();
  if (language === "python") await runPython(code, stdin, handlers);
  else await runJavaScript(code, handlers);
  return Math.round(performance.now() - started);
}

/** Abre o código na aba MineCode do chat (MineView escuta o evento). */
export function openInMineCode(code: string, lang: string) {
  window.dispatchEvent(new CustomEvent("minecode:open", { detail: { code, lang } }));
}
