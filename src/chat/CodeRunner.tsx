import { useRef, useState } from "react";
import { Loader2, Play, SquareTerminal, Trash2 } from "lucide-react";
import { runCode, type RunLanguage, type RunLine } from "./runner";
import "./mine-code-blocks.css";

/*
 * Terminal de saída do código: o botão Executar, as "Entradas" para input()
 * e o que o programa imprimiu. Usado embaixo dos blocos de código do chat e
 * na aba MineCode.
 */

export function usesInput(language: RunLanguage, code: string) {
  return language === "python" ? /\binput\s*\(/.test(code) : /\bprompt\s*\(/.test(code);
}

export function useRunner() {
  const [lines, setLines] = useState<RunLine[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "running">("idle");
  const [elapsed, setElapsed] = useState<number | null>(null);
  const busy = useRef(false);

  const run = async (language: RunLanguage, code: string, stdin: string[] = []) => {
    if (busy.current) return;
    busy.current = true;
    setLines([]);
    setElapsed(null);
    setStatus(language === "python" ? "loading" : "running");
    const ms = await runCode(
      language,
      code,
      {
        onLine: (line) => setLines((current) => [...current, line]),
        onStatus: (next) => setStatus(next),
      },
      stdin,
    );
    setElapsed(ms);
    setStatus("idle");
    busy.current = false;
  };

  return {
    lines,
    status,
    elapsed,
    run,
    clear: () => {
      setLines([]);
      setElapsed(null);
    },
  };
}

export function RunOutput({ lines, status, elapsed, onClear }: { lines: RunLine[]; status: "idle" | "loading" | "running"; elapsed: number | null; onClear?: () => void }) {
  if (status === "idle" && elapsed === null && !lines.length) return null;
  const failed = lines.some((line) => line.kind === "error");
  return (
    <div className={`mcr-out ${failed ? "has-error" : ""}`} role="log" aria-live="polite" aria-label="Saída do programa">
      <div className="mcr-out__bar">
        <SquareTerminal aria-hidden />
        <span>Saída</span>
        {status === "loading" ? (
          <span className="mcr-out__status">
            <Loader2 className="animate-spin" aria-hidden /> preparando o Python (só demora na primeira vez)…
          </span>
        ) : status === "running" ? (
          <span className="mcr-out__status">
            <Loader2 className="animate-spin" aria-hidden /> rodando…
          </span>
        ) : elapsed !== null ? (
          <span className="mcr-out__status">{failed ? "terminou com erro" : "terminou"} · {elapsed < 1000 ? `${elapsed} ms` : `${(elapsed / 1000).toFixed(1)} s`}</span>
        ) : null}
        {onClear && lines.length && status === "idle" ? (
          <button type="button" className="mcr-out__clear" onClick={onClear} aria-label="Limpar saída">
            <Trash2 aria-hidden />
          </button>
        ) : null}
      </div>
      <pre className="mcr-out__pre">
        {lines.length ? (
          lines.map((line, index) => (
            <span key={index} className={`is-${line.kind}`}>
              {line.kind === "result" ? "← " : ""}
              {line.text}
              {line.text.endsWith("\n") ? "" : "\n"}
            </span>
          ))
        ) : status === "idle" ? (
          <span className="is-info">(o programa não imprimiu nada — use print() para ver resultados)</span>
        ) : null}
      </pre>
    </div>
  );
}

/** Barra "Executar" + entradas + saída, embaixo de um bloco de código do chat. */
export function InlineRunner({ language, code }: { language: RunLanguage; code: string }) {
  const runner = useRunner();
  const needsInput = usesInput(language, code);
  const [stdin, setStdin] = useState("");
  const busy = runner.status !== "idle";
  return (
    <div className="mcr-inline">
      <div className="mcr-inline__bar">
        <button type="button" className="mcr-run" onClick={() => void runner.run(language, code, stdin.split("\n"))} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
          {busy ? "Rodando…" : "Executar"}
        </button>
        {needsInput ? (
          <label className="mcr-stdin">
            <span>Entradas (uma por linha)</span>
            <textarea value={stdin} onChange={(event) => setStdin(event.target.value)} rows={1} placeholder="ex.: 10" spellCheck={false} />
          </label>
        ) : null}
      </div>
      <RunOutput lines={runner.lines} status={runner.status} elapsed={runner.elapsed} onClear={runner.clear} />
    </div>
  );
}
