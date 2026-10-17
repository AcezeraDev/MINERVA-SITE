/// <reference lib="webworker" />
/*
 * Python do MineCode, rodando no navegador (Pyodide) dentro de um Web Worker:
 * o código do aluno não trava a tela, e um laço infinito é resolvido
 * encerrando o worker (runner.ts faz isso no tempo limite).
 *
 * O Pyodide (~10 MB) vem da CDN na primeira execução e fica no cache do
 * navegador. `input()` lê das "entradas" que a pessoa escreveu antes de rodar.
 */

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

type Pyodide = {
  setStdout: (options: { batched?: (text: string) => void; write?: (buffer: Uint8Array) => number }) => void;
  setStderr: (options: { batched: (text: string) => void }) => void;
  setStdin: (options: { stdin: () => string | null; isatty?: boolean }) => void;
  runPythonAsync: (code: string) => Promise<unknown>;
  loadPackagesFromImports: (code: string) => Promise<void>;
};

let ready: Promise<Pyodide> | null = null;

function load() {
  if (!ready) {
    ready = (async () => {
      const module = (await import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`)) as { loadPyodide: (options: { indexURL: string }) => Promise<Pyodide> };
      return module.loadPyodide({ indexURL: PYODIDE_URL });
    })();
  }
  return ready;
}

self.onmessage = async (event: MessageEvent<{ id: number; code: string; stdin: string[] }>) => {
  const { id, code, stdin } = event.data;
  const post = (type: string, text = "") => (self as DedicatedWorkerGlobalScope).postMessage({ id, type, text });
  try {
    post("status", "loading");
    const pyodide = await load();
    post("status", "running");
    // sem buffer de linha: a pergunta do input() ("Seu nome: ") aparece antes da resposta ecoada
    const decoder = new TextDecoder();
    pyodide.setStdout({
      write: (buffer: Uint8Array) => {
        post("raw", decoder.decode(buffer, { stream: true }));
        return buffer.length;
      },
    });
    pyodide.setStderr({ batched: (text) => post("stderr", text) });
    const queue = [...(stdin || [])];
    // cada resposta lida aparece na saída depois da pergunta, como num terminal
    pyodide.setStdin({
      stdin: () => {
        if (!queue.length) return null;
        const answer = queue.shift() as string;
        post("raw", `${answer}\n`);
        return answer;
      },
      isatty: false,
    });
    // pacotes como numpy entram sozinhos quando o código importa
    await pyodide.loadPackagesFromImports(code).catch(() => undefined);
    const result = await pyodide.runPythonAsync(code);
    if (result !== undefined && result !== null) post("result", String(result));
    post("done");
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    // o Pyodide devolve o traceback inteiro; as linhas do próprio Pyodide não ajudam o aluno
    const clean = text
      .split("\n")
      .filter((line) => !/\/lib\/python3|_pyodide|pyodide\.asm|File "<exec>", line \d+, in <module>\s*$/.test(line) || /<exec>/.test(line))
      .join("\n")
      .replace(/File "<exec>"/g, "Linha do seu código")
      .trim();
    post("error", /EOFError/.test(clean) ? `${clean}\n\nO programa pediu input() e as entradas acabaram. Escreva as respostas em "Entradas", uma por linha.` : clean);
    post("done");
  }
};
