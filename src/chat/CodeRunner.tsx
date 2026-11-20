import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { CornerDownLeft, Loader2, Play, SquareTerminal, Trash2 } from "lucide-react";
import { runCode, type RunExtras, type RunLanguage, type RunLine } from "./runner";
import "./mine-code-blocks.css";

/*
 * Terminal de saída do código: o botão Executar e o que o programa imprimiu.
 * Usado embaixo dos blocos de código do chat e no Console do monitor.
 *
 * input() é interativo: quando o programa pede uma resposta, o terminal mostra
 * um campo na última linha. Por baixo, o programa roda de novo com todas as
 * respostas dadas até ali (mesma semente do random, então a saída se repete
 * igual); a tela só troca quando a saída nova passa da antiga, sem piscar.
 */

export type RunStatus = "idle" | "loading" | "running";

export function useRunner() {
  const [lines, setLines] = useState<RunLine[]>([]);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [waiting, setWaiting] = useState(false);
  const busy = useRef(false);
  const session = useRef<{ language: RunLanguage; code: string; extras: RunExtras; answers: string[] } | null>(null);
  const shown = useRef(0);

  const execute = async (replay: boolean) => {
    const current = session.current;
    if (!current || busy.current) return;
    busy.current = true;
    setWaiting(false);
    setElapsed(null);
    if (!replay) {
      setLines([]);
      shown.current = 0;
    }
    setStatus(current.language === "python" ? "loading" : "running");
    const buffer: RunLine[] = [];
    const flush = () => {
      shown.current = buffer.length;
      setLines([...buffer]);
    };
    let needInput = false;
    const ms = await runCode(
      current.language,
      current.code,
      {
        onLine: (line) => {
          buffer.push(line);
          if (!replay || buffer.length > shown.current) flush();
        },
        onStatus: (next) => setStatus(next),
        onNeedInput: () => {
          needInput = true;
        },
      },
      current.answers,
      current.extras,
    );
    flush();
    setStatus("idle");
    busy.current = false;
    if (needInput) setWaiting(true);
    else setElapsed(ms);
  };

  return {
    lines,
    status,
    elapsed,
    waiting,
    run: (language: RunLanguage, code: string, extras: RunExtras = {}) => {
      if (busy.current) return Promise.resolve();
      session.current = { language, code, extras: { ...extras, seed: Math.floor(Math.random() * 2 ** 31) }, answers: [] };
      return execute(false);
    },
    answer: (text: string) => {
      if (!session.current || busy.current) return;
      session.current.answers.push(text);
      void execute(true);
    },
    clear: () => {
      setLines([]);
      setElapsed(null);
      setWaiting(false);
      shown.current = 0;
    },
  };
}

export type Runner = ReturnType<typeof useRunner>;

function InputLine({ onAnswer }: { onAnswer: (text: string) => void }) {
  const [value, setValue] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onAnswer(value);
    setValue("");
  };
  return (
    <form className="mcr-ask" onSubmit={submit}>
      <input autoFocus value={value} onChange={(event) => setValue(event.target.value)} aria-label="Resposta para o programa" placeholder="digite a resposta e aperte Enter" spellCheck={false} autoComplete="off" />
      <button type="submit" aria-label="Enviar resposta">
        <CornerDownLeft aria-hidden />
      </button>
    </form>
  );
}

export function RunOutput({ runner, onClear, standalone = false }: { runner: Runner; onClear?: () => void; standalone?: boolean }) {
  const { lines, status, elapsed, waiting } = runner;
  if (!standalone && status === "idle" && elapsed === null && !lines.length && !waiting) return null;
  const failed = lines.some((line) => line.kind === "error");
  return (
    <div className={`mcr-out ${failed ? "has-error" : ""} ${standalone ? "is-standalone" : ""}`} role="log" aria-live="polite" aria-label="Saída do programa">
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
        ) : waiting ? (
          <span className="mcr-out__status is-waiting">esperando sua resposta</span>
        ) : elapsed !== null ? (
          <span className="mcr-out__status">
            {failed ? "terminou com erro" : "terminou"} · {elapsed < 1000 ? `${elapsed} ms` : `${(elapsed / 1000).toFixed(1)} s`}
          </span>
        ) : null}
        {onClear && lines.length && status === "idle" ? (
          <button type="button" className="mcr-out__clear" onClick={onClear} aria-label="Limpar saída">
            <Trash2 aria-hidden />
          </button>
        ) : null}
      </div>
      <pre className="mcr-out__pre">
        {lines.length ? (
          lines.map((line, index) =>
            line.kind === "image" ? (
              <img key={index} className="mcr-out__img" src={`data:image/png;base64,${line.text}`} alt="Gráfico gerado pelo programa" />
            ) : (
              <span key={index} className={`is-${line.kind}`}>
                {line.kind === "result" ? "← " : ""}
                {line.text}
                {line.raw || line.text.endsWith("\n") ? "" : "\n"}
              </span>
            ),
          )
        ) : status === "idle" && !waiting && elapsed !== null ? (
          <span className="is-info">(o programa não imprimiu nada — use print() para ver resultados)</span>
        ) : standalone && status === "idle" && !waiting ? (
          <span className="is-info">Aperte Executar para rodar o programa.</span>
        ) : null}
        {waiting && status === "idle" ? <InputLine onAnswer={runner.answer} /> : null}
      </pre>
    </div>
  );
}

/** Barra "Executar" + saída, embaixo de um bloco de código do chat. */
export function InlineRunner({ language, code, extra }: { language: RunLanguage; code: string; extra?: ReactNode }) {
  const runner = useRunner();
  const busy = runner.status !== "idle";
  return (
    <div className="mcr-inline">
      <div className="mcr-inline__bar">
        <button type="button" className="mcr-run" onClick={() => void runner.run(language, code)} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
          {busy ? "Rodando…" : "Executar"}
        </button>
        {extra}
      </div>
      <RunOutput runner={runner} onClear={runner.clear} />
    </div>
  );
}
