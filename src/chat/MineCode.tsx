// Carregado sob demanda (React.lazy) pela aba MineCode do chat da Mine.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Bug, Code2, Lightbulb, Loader2, Play, RotateCcw, Sparkles, Wand2 } from "lucide-react";
import { RunOutput, useRunner, usesInput } from "./CodeRunner";
import { SiteFrame } from "./SitePreview";
import { mineCodeLanguage } from "../../shared/code-run.mjs";
import "./minecode.css";

/*
 * MineCode: o caderno de programação do chat. Um editor simples (textarea com
 * números de linha, Tab vira espaços, Ctrl+Enter executa), a saída do
 * programa e, para HTML, a página ao vivo. O código de qualquer resposta da
 * Mine abre aqui pelo botão "MineCode", e daqui volta para a conversa com
 * "Explicar", "Corrigir" ou "Melhorar".
 */

export type MineCodeLanguage = "python" | "javascript" | "html";

const LANGUAGES: Array<{ id: MineCodeLanguage; label: string; file: string }> = [
  { id: "python", label: "Python", file: "main.py" },
  { id: "javascript", label: "JavaScript", file: "script.js" },
  { id: "html", label: "HTML", file: "index.html" },
];

const EXAMPLES: Record<MineCodeLanguage, Array<{ title: string; code: string }>> = {
  python: [
    {
      title: "Tabuada",
      code: `numero = int(input("Qual tabuada? "))\n\nfor i in range(1, 11):\n    print(f"{numero} x {i} = {numero * i}")\n`,
    },
    {
      title: "Média da turma",
      code: `notas = [7.5, 8.0, 6.5, 9.0, 10.0]\n\nmedia = sum(notas) / len(notas)\nprint(f"Média: {media:.1f}")\n\nfor nota in notas:\n    situacao = "aprovado" if nota >= 7 else "recuperação"\n    print(f"{nota:>4} -> {situacao}")\n`,
    },
    {
      title: "Adivinhe o número",
      code: `import random\n\nsecreto = random.randint(1, 10)\nchute = int(input("Chute um número de 1 a 10: "))\n\nif chute == secreto:\n    print("Acertou!")\nelse:\n    print(f"Errou! Era {secreto}.")\n`,
    },
  ],
  javascript: [
    {
      title: "Lista de compras",
      code: `const compras = ["arroz", "feijão", "banana"];\ncompras.push("leite");\n\ncompras.forEach((item, i) => console.log(\`\${i + 1}. \${item}\`));\nconsole.log("Total de itens:", compras.length);\n`,
    },
    {
      title: "Fibonacci",
      code: `function fibonacci(n) {\n  const seq = [0, 1];\n  while (seq.length < n) seq.push(seq.at(-1) + seq.at(-2));\n  return seq.slice(0, n);\n}\n\nconsole.log(fibonacci(12).join(", "));\n`,
    },
  ],
  html: [
    {
      title: "Cartão de apresentação",
      code: `<!doctype html>\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Meu cartão</title>\n  <style>\n    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif; background: linear-gradient(135deg, #1d2bb8, #7c3aed); }\n    .card { background: #fff; padding: 32px 40px; border-radius: 20px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,.25); }\n    h1 { margin: 0 0 8px; }\n    button { margin-top: 16px; padding: 10px 18px; border: 0; border-radius: 999px; background: #1d2bb8; color: #fff; font-weight: 700; cursor: pointer; }\n  </style>\n</head>\n<body>\n  <div class="card">\n    <h1>Olá, eu sou a Ana!</h1>\n    <p>Estudante do 9º ano · adoro programar</p>\n    <button onclick="this.textContent = 'Valeu! 💙'">Mandar um oi</button>\n  </div>\n</body>\n</html>\n`,
    },
  ],
};

const STORAGE = "minerva-minecode-v1";

function loadSaved(): { language: MineCodeLanguage; code: Partial<Record<MineCodeLanguage, string>> } {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE) || "{}");
    const language = LANGUAGES.some((item) => item.id === parsed.language) ? parsed.language : "python";
    return { language, code: parsed.code && typeof parsed.code === "object" ? parsed.code : {} };
  } catch {
    return { language: "python", code: {} };
  }
}

export const languageFromFence = mineCodeLanguage;

export function MineCode({
  incoming,
  onAsk,
  busy,
}: {
  /** Código vindo de uma resposta da Mine (botão "MineCode"). */
  incoming: { code: string; lang: string; at: number } | null;
  /** Manda uma pergunta para a conversa (e volta para a aba Conversa). */
  onAsk: (text: string) => void;
  busy: boolean;
}) {
  const saved = useMemo(loadSaved, []);
  const [language, setLanguage] = useState<MineCodeLanguage>(saved.language);
  const [codes, setCodes] = useState<Partial<Record<MineCodeLanguage, string>>>(() => ({
    python: saved.code.python ?? EXAMPLES.python[0].code,
    javascript: saved.code.javascript ?? EXAMPLES.javascript[0].code,
    html: saved.code.html ?? EXAMPLES.html[0].code,
  }));
  const [stdin, setStdin] = useState("");
  const [htmlRun, setHtmlRun] = useState<string | null>(null);
  const runner = useRunner();
  const editor = useRef<HTMLTextAreaElement | null>(null);
  const gutter = useRef<HTMLDivElement | null>(null);
  const code = codes[language] ?? "";
  const lineCount = code.split("\n").length;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ language, code: codes }));
    } catch {
      // sem armazenamento: o código vale só nesta visita
    }
  }, [language, codes]);

  useEffect(() => {
    if (!incoming) return;
    const target = languageFromFence(incoming.lang);
    if (!target) return;
    setLanguage(target);
    setCodes((current) => ({ ...current, [target]: incoming.code.replace(/\s+$/, "") + "\n" }));
    runner.clear();
    setHtmlRun(target === "html" ? incoming.code : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming?.at]);

  const setCode = (value: string) => setCodes((current) => ({ ...current, [language]: value }));

  const run = () => {
    if (language === "html") {
      setHtmlRun(code);
      return;
    }
    void runner.run(language, code, stdin.split("\n"));
  };

  const output = runner.lines.map((line) => line.text).join("").trim().slice(-1500);
  const failed = runner.lines.some((line) => line.kind === "error");
  const label = LANGUAGES.find((item) => item.id === language)!.label;
  const ask = (kind: "explicar" | "corrigir" | "melhorar") => {
    const question =
      kind === "corrigir"
        ? "Deu erro. Me explica o erro em português simples e me manda o código corrigido completo."
        : kind === "melhorar"
          ? "Como posso melhorar este código? Me mostra a versão melhorada completa e explica o que mudou."
          : "Me explica o que este código faz, parte por parte, como se eu estivesse começando.";
    const fence = language === "html" ? "html" : language;
    const ran = language !== "html" && (runner.lines.length || runner.elapsed !== null) ? `\n\nA saída foi:\n\`\`\`text\n${output || "(nada impresso)"}\n\`\`\`` : "";
    onAsk(`No MineCode eu tenho este código ${label}:\n\n\`\`\`${fence}\n${code.trimEnd()}\n\`\`\`${ran}\n\n${question}`);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      run();
      return;
    }
    if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      const target = event.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const indent = language === "python" ? "    " : "  ";
      const next = code.slice(0, start) + indent + code.slice(end);
      setCode(next);
      requestAnimationFrame(() => target.setSelectionRange(start + indent.length, start + indent.length));
    }
  };

  return (
    <section className="minecode" aria-label="MineCode">
      <header className="minecode-head">
        <div className="minecode-brand">
          <span className="minecode-logo" aria-hidden>
            <Code2 />
          </span>
          <div>
            <p className="minecode-title">MineCode</p>
            <p className="minecode-sub">escreva, rode e peça ajuda à Mine</p>
          </div>
        </div>
        <div className="minecode-langs" role="tablist" aria-label="Linguagem">
          {LANGUAGES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={language === item.id}
              className={language === item.id ? "is-on" : ""}
              onClick={() => {
                setLanguage(item.id);
                runner.clear();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div className="minecode-body">
        <div className="minecode-editor">
          <div className="minecode-tabbar">
            <span className="minecode-file">{LANGUAGES.find((item) => item.id === language)!.file}</span>
            <label className="minecode-examples">
              <Lightbulb aria-hidden />
              <select
                value=""
                onChange={(event) => {
                  const example = EXAMPLES[language].find((item) => item.title === event.target.value);
                  if (example) {
                    setCode(example.code);
                    runner.clear();
                    setHtmlRun(null);
                  }
                }}
                aria-label="Carregar um exemplo"
              >
                <option value="">exemplos…</option>
                {EXAMPLES[language].map((item) => (
                  <option key={item.title} value={item.title}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="minecode-code">
            <div className="minecode-gutter" ref={gutter} aria-hidden>
              {Array.from({ length: lineCount }, (_, index) => (
                <span key={index}>{index + 1}</span>
              ))}
            </div>
            <textarea
              ref={editor}
              className="minecode-textarea"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={onKeyDown}
              onScroll={(event) => {
                if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop;
              }}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              aria-label={`Código ${label}`}
            />
          </div>
          <div className="minecode-actions">
            <button type="button" className="minecode-run" onClick={run} disabled={runner.status !== "idle"}>
              {runner.status !== "idle" ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
              {language === "html" ? "Ver página" : runner.status !== "idle" ? "Rodando…" : "Executar"}
              <kbd>Ctrl ↵</kbd>
            </button>
            <button
              type="button"
              className="minecode-ghost"
              onClick={() => {
                setCode(EXAMPLES[language][0].code);
                runner.clear();
                setHtmlRun(null);
              }}
              title="Voltar ao exemplo"
            >
              <RotateCcw aria-hidden /> Recomeçar
            </button>
          </div>
          {language !== "html" && usesInput(language, code) ? (
            <label className="minecode-stdin">
              <span>Entradas para {language === "python" ? "input()" : "prompt()"} — uma por linha</span>
              <textarea value={stdin} onChange={(event) => setStdin(event.target.value)} rows={2} spellCheck={false} placeholder="ex.: 7" />
            </label>
          ) : null}
        </div>

        <div className="minecode-side">
          {language === "html" ? (
            htmlRun ? (
              <div className="minecode-preview">
                <SiteFrame code={htmlRun} title="index.html" device="desktop" />
              </div>
            ) : (
              <p className="minecode-empty">Toque em “Ver página” para ver o site funcionando aqui.</p>
            )
          ) : runner.lines.length || runner.status !== "idle" || runner.elapsed !== null ? (
            <RunOutput lines={runner.lines} status={runner.status} elapsed={runner.elapsed} onClear={runner.clear} />
          ) : (
            <p className="minecode-empty">A saída do programa aparece aqui. Use print() {language === "javascript" ? "(ou console.log())" : ""} para ver resultados.</p>
          )}
          <div className="minecode-mine">
            <p className="minecode-mine-title">
              <Sparkles aria-hidden /> Pedir à Mine
            </p>
            <div className="minecode-mine-actions">
              <button type="button" onClick={() => ask("explicar")} disabled={busy}>
                <Lightbulb aria-hidden /> Explicar
              </button>
              <button type="button" onClick={() => ask("corrigir")} disabled={busy} className={failed ? "is-hot" : ""}>
                <Bug aria-hidden /> Corrigir erro
              </button>
              <button type="button" onClick={() => ask("melhorar")} disabled={busy}>
                <Wand2 aria-hidden /> Melhorar
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
