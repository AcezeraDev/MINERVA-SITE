/// <reference lib="webworker" />
/*
 * Python das respostas da Mine, rodando no navegador (Pyodide) dentro de um Web Worker:
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
  globals: { set: (name: string, value: unknown) => void };
  FS: { writeFile: (path: string, data: string) => void; mkdirTree: (path: string) => void };
};

type ProjectFile = { path: string; content: string };

const HOME = "/home/pyodide";

// Gráfico do matplotlib vira PNG e aparece no console (no worker não há tela).
const MATPLOTLIB_SETUP = `
import os as _os
_os.environ["MPLBACKEND"] = "AGG"
import matplotlib as _mpl
_mpl.use("agg")
import matplotlib.pyplot as _plt, io as _io, base64 as _b64
def _mine_show(*_a, **_k):
    for _n in _plt.get_fignums():
        _f = _plt.figure(_n)
        _buf = _io.BytesIO()
        _f.savefig(_buf, format="png", dpi=110, bbox_inches="tight")
        _mine_emit_png(_b64.b64encode(_buf.getvalue()).decode())
    _plt.close("all")
_plt.show = _mine_show
`;

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

self.onmessage = async (event: MessageEvent<{ id: number; code: string; stdin: string[]; files?: ProjectFile[]; seed?: number }>) => {
  const { id, code, stdin, files = [], seed } = event.data;
  const post = (type: string, text = "") => (self as DedicatedWorkerGlobalScope).postMessage({ id, type, text });
  let waitingInput = false;
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
    // cada resposta lida aparece na saída depois da pergunta, como num terminal.
    // Acabaram as respostas: o console pergunta ao estudante e roda de novo
    // com a resposta nova (mesma semente do random, então a saída se repete).
    pyodide.setStdin({
      stdin: () => {
        if (!queue.length) {
          waitingInput = true;
          return null;
        }
        const answer = queue.shift() as string;
        post("raw", `${answer}\n`);
        return answer;
      },
      isatty: false,
    });

    // Projeto com vários arquivos: cada .py vai para o disco virtual, e o
    // import entre eles funciona. Módulos de uma execução anterior saem do cache.
    const modules: string[] = [];
    for (const file of files) {
      const dir = file.path.includes("/") ? `${HOME}/${file.path.slice(0, file.path.lastIndexOf("/"))}` : HOME;
      pyodide.FS.mkdirTree(dir);
      pyodide.FS.writeFile(`${HOME}/${file.path}`, file.content);
      if (/\.py$/i.test(file.path)) modules.push(file.path.replace(/\.py$/i, "").split("/")[0]);
    }
    pyodide.globals.set("_mine_modules", modules);
    pyodide.globals.set("_mine_seed", typeof seed === "number" ? seed : null);
    await pyodide.runPythonAsync(`
import sys as _sys, importlib as _importlib, os as _os2, random as _random
_os2.chdir("${HOME}")
if "${HOME}" not in _sys.path: _sys.path.insert(0, "${HOME}")
for _m in list(_mine_modules): _sys.modules.pop(_m, None)
_importlib.invalidate_caches()
if _mine_seed is not None: _random.seed(_mine_seed)
`);

    const allCode = [code, ...files.map((file) => file.content)].join("\n");
    // pacotes como numpy entram sozinhos quando o código importa
    await pyodide.loadPackagesFromImports(allCode).catch(() => undefined);
    const plots = /\b(?:matplotlib|pylab)\b/.test(allCode);
    if (plots) {
      pyodide.globals.set("_mine_emit_png", (png: string) => post("image", png));
      await pyodide.runPythonAsync(MATPLOTLIB_SETUP).catch(() => undefined);
    }
    const result = await pyodide.runPythonAsync(code);
    if (plots) await pyodide.runPythonAsync("_mine_show()").catch(() => undefined);
    if (result !== undefined && result !== null) post("result", String(result));
    post("done");
  } catch (error) {
    if (waitingInput) {
      post("input");
      post("done");
      return;
    }
    const text = error instanceof Error ? error.message : String(error);
    // o Pyodide devolve o traceback inteiro; as linhas do próprio Pyodide não ajudam o aluno
    const clean = text
      .split("\n")
      .filter((line) => !/\/lib\/python3|_pyodide|pyodide\.asm|File "<exec>", line \d+, in <module>\s*$/.test(line) || /<exec>/.test(line))
      .join("\n")
      .replace(/File "<exec>"/g, "Linha do seu código")
      .trim();
    post("error", clean);
    post("done");
  }
};
