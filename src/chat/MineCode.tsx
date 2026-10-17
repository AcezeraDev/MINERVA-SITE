// Carregado sob demanda (React.lazy) pela aba MineCode do chat da Mine.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Bug, Check, Code2, Lightbulb, Loader2, Play, RotateCcw, Send, Square, Trash2, Undo2, Wand2 } from "lucide-react";
import { RunOutput, useRunner, usesInput } from "./CodeRunner";
import { SiteFrame } from "./SitePreview";
import { MineRichText } from "./MineRichText";
import { MineFace } from "../caderno/MineFace";
import { streamMineCode } from "./minecode-api";
import { mineCodeLanguage, readCodeReply } from "../../shared/code-run.mjs";
import "./minecode.css";

/*
 * MineCode: o caderno de programação do chat. Um editor simples (textarea com
 * números de linha, Tab vira espaços, Ctrl+Enter executa), a saída do
 * programa ou, para HTML, a página ao vivo — e, ao lado, o chat com a Mine:
 * você pede, ela escreve o arquivo inteiro direto no editor (ao vivo, pelo
 * streaming), e o resultado roda sozinho. Cada resposta tem Desfazer. O
 * código de qualquer resposta da conversa abre aqui pelo botão "MineCode".
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

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Código que a resposta escreveu no editor, com o que havia antes (para Desfazer). */
  applied?: { lang: MineCodeLanguage; lines: number; previous: string; undone?: boolean };
  error?: boolean;
};

const CHAT_STORAGE = "minerva-minecode-chat-v1";

const STARTERS: Record<MineCodeLanguage, string[]> = {
  python: ["Faz uma calculadora", "Cria um jogo de adivinhar o número", "Faz um quiz de capitais"],
  javascript: ["Mostra a tabuada do 7", "Ordena uma lista de nomes", "Conta as vogais de uma frase"],
  html: ["Faz um site de portfólio", "Cria um jogo da velha", "Faz uma página de receitas"],
};

function loadChat(): ChatMessage[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAT_STORAGE) || "[]");
    return Array.isArray(parsed) ? parsed.slice(-30) : [];
  } catch {
    return [];
  }
}

export function MineCode({
  incoming,
}: {
  /** Código vindo de uma resposta da Mine (botão "MineCode"). */
  incoming: { code: string; lang: string; at: number } | null;
  onAsk?: (text: string) => void;
  busy?: boolean;
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
  const [messages, setMessages] = useState<ChatMessage[]>(loadChat);
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState<string | null>(null);
  const runner = useRunner();
  const gutter = useRef<HTMLDivElement | null>(null);
  const chatScroll = useRef<HTMLDivElement | null>(null);
  const abort = useRef<AbortController | null>(null);
  const code = codes[language] ?? "";
  const lineCount = code.split("\n").length;
  const writing = live !== null;
  const meta = LANGUAGES.find((item) => item.id === language)!;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ language, code: codes }));
    } catch {
      // sem armazenamento: o código vale só nesta visita
    }
  }, [language, codes]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE, JSON.stringify(messages.slice(-30)));
    } catch {
      // idem
    }
  }, [messages]);

  useEffect(() => () => abort.current?.abort(), []);

  useEffect(() => {
    chatScroll.current?.scrollTo({ top: chatScroll.current.scrollHeight, behavior: "smooth" });
  }, [messages, live]);

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

  const runCode = (lang: MineCodeLanguage, source: string) => {
    if (lang === "html") {
      setHtmlRun(source);
      return;
    }
    void runner.run(lang, source, stdin.split("\n"));
  };
  const run = () => runCode(language, code);

  const output = runner.lines.map((line) => line.text).join("").trim().slice(-1500);
  const failed = runner.lines.some((line) => line.kind === "error");

  /** Manda um pedido para a Mine; a resposta escreve o código no editor. */
  const ask = async (request: string) => {
    const text = request.trim();
    if (!text || writing) return;
    const fence = language;
    const ran = runner.lines.length || runner.elapsed !== null;
    const context = [
      `Linguagem aberta no editor: ${meta.label} (arquivo ${meta.file}).`,
      `Codigo atual do editor:\n\`\`\`${fence}\n${code.trimEnd().slice(0, 12000)}\n\`\`\``,
      language === "html" ? "" : ran ? `Ultima saida do programa${failed ? " (deu erro)" : ""}:\n\`\`\`text\n${output || "(nada impresso)"}\n\`\`\`` : "O programa ainda nao foi executado.",
    ]
      .filter(Boolean)
      .join("\n\n");
    const history = messages.slice(-8).map((item) => ({ role: item.role, text: item.text }));
    const before = { ...codes };
    let switched: MineCodeLanguage | null = null;
    setMessages((current) => [...current, { id: `u${Date.now()}`, role: "user", text }]);
    setDraft("");
    setLive("");
    const controller = new AbortController();
    abort.current = controller;
    try {
      const reply = await streamMineCode(
        { prompt: text, context, history },
        {
          signal: controller.signal,
          onText: (partial) => {
            setLive(partial);
            const read = readCodeReply(partial);
            if (!read.lang || !read.code) return;
            // o código vai aparecendo no editor enquanto a Mine escreve
            if (switched !== read.lang) {
              switched = read.lang;
              setLanguage(read.lang);
            }
            const lang = read.lang;
            setCodes((current) => ({ ...current, [lang]: read.code }));
          },
        },
      );
      const read = readCodeReply(reply);
      let applied: ChatMessage["applied"];
      if (read.lang && read.code.trim()) {
        const lang = read.lang;
        setLanguage(lang);
        setCodes((current) => ({ ...current, [lang]: read.code }));
        applied = { lang, lines: read.code.trimEnd().split("\n").length, previous: before[lang] ?? "" };
        runner.clear();
        // roda sozinho para mostrar o resultado (se o programa não pedir input)
        if (lang === "html") setHtmlRun(read.code);
        else if (!usesInput(lang, read.code)) void runner.run(lang, read.code, []);
        else setHtmlRun(null);
      }
      setMessages((current) => [...current, { id: `a${Date.now()}`, role: "assistant", text: read.explanation || "Pronto! Coloquei o código no editor.", applied }]);
    } catch (error) {
      // o que já tinha sido escrito ao vivo volta ao que era
      setCodes(before);
      if (switched) setLanguage(language);
      if (!controller.signal.aborted) {
        setMessages((current) => [...current, { id: `e${Date.now()}`, role: "assistant", text: error instanceof Error ? error.message : "A Mine não conseguiu programar agora.", error: true }]);
      }
    } finally {
      setLive(null);
      abort.current = null;
    }
  };

  const undo = (message: ChatMessage) => {
    if (!message.applied || message.applied.undone) return;
    const { lang, previous } = message.applied;
    setLanguage(lang);
    setCodes((current) => ({ ...current, [lang]: previous }));
    setMessages((current) => current.map((item) => (item.id === message.id && item.applied ? { ...item, applied: { ...item.applied, undone: true } } : item)));
    runner.clear();
    setHtmlRun(null);
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

  const liveRead = live !== null ? readCodeReply(live) : null;

  return (
    <section className="minecode" aria-label="MineCode">
      <header className="minecode-head">
        <div className="minecode-brand">
          <span className="minecode-logo" aria-hidden>
            <Code2 />
          </span>
          <div>
            <p className="minecode-title">MineCode</p>
            <p className="minecode-sub">peça e a Mine programa com você</p>
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
              disabled={writing}
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
        <div className="minecode-work">
          <div className={`minecode-editor ${writing ? "is-writing" : ""}`}>
            <div className="minecode-tabbar">
              <span className="minecode-file">{meta.file}</span>
              {writing ? (
                <span className="minecode-writing">
                  <Loader2 className="animate-spin" aria-hidden /> a Mine está escrevendo…
                </span>
              ) : (
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
              )}
            </div>
            <div className="minecode-code">
              <div className="minecode-gutter" ref={gutter} aria-hidden>
                {Array.from({ length: lineCount }, (_, index) => (
                  <span key={index}>{index + 1}</span>
                ))}
              </div>
              <textarea
                className="minecode-textarea"
                value={code}
                readOnly={writing}
                onChange={(event) => setCode(event.target.value)}
                onKeyDown={onKeyDown}
                onScroll={(event) => {
                  if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop;
                }}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                aria-label={`Código ${meta.label}`}
              />
            </div>
            <div className="minecode-actions">
              <button type="button" className="minecode-run" onClick={run} disabled={runner.status !== "idle" || writing}>
                {runner.status !== "idle" ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
                {language === "html" ? "Ver página" : runner.status !== "idle" ? "Rodando…" : "Executar"}
                <kbd>Ctrl ↵</kbd>
              </button>
              <button
                type="button"
                className="minecode-ghost"
                disabled={writing}
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

          {language === "html" ? (
            htmlRun ? (
              <div className="minecode-preview">
                <SiteFrame code={htmlRun} title={meta.file} device="desktop" />
              </div>
            ) : (
              <p className="minecode-empty">Toque em “Ver página” para ver o site funcionando aqui.</p>
            )
          ) : runner.lines.length || runner.status !== "idle" || runner.elapsed !== null ? (
            <RunOutput lines={runner.lines} status={runner.status} elapsed={runner.elapsed} onClear={runner.clear} />
          ) : (
            <p className="minecode-empty">A saída do programa aparece aqui. Use print() {language === "javascript" ? "(ou console.log())" : ""} para ver resultados.</p>
          )}
        </div>

        <aside className="minecode-chat" aria-label="Chat com a Mine">
          <div className="minecode-chat-head">
            <MineFace thinking={writing} className="minecode-chat-face" />
            <div>
              <p className="minecode-chat-title">Mine programadora</p>
              <p className="minecode-chat-sub">{writing ? "escrevendo o código…" : "diz o que você quer e eu escrevo"}</p>
            </div>
            {messages.length && !writing ? (
              <button type="button" className="minecode-chat-clear" onClick={() => setMessages([])} title="Limpar conversa">
                <Trash2 aria-hidden />
              </button>
            ) : null}
          </div>

          <div className="minecode-chat-log" ref={chatScroll} aria-live="polite">
            {!messages.length && !writing ? (
              <div className="minecode-chat-empty">
                <p>Me pede um programa e eu escrevo direto no editor. Depois é só rodar, mexer e me pedir ajustes.</p>
                <div className="minecode-starters">
                  {STARTERS[language].map((item) => (
                    <button key={item} type="button" onClick={() => void ask(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {messages.map((message) =>
              message.role === "user" ? (
                <p key={message.id} className="minecode-msg is-user">
                  {message.text}
                </p>
              ) : (
                <div key={message.id} className={`minecode-msg is-mine ${message.error ? "is-error" : ""}`}>
                  <MineRichText text={message.text} />
                  {message.applied ? (
                    <div className={`minecode-applied ${message.applied.undone ? "is-undone" : ""}`}>
                      <Check aria-hidden />
                      <span>
                        {message.applied.undone ? "desfeito" : `${message.applied.lines} linhas no editor`} · {LANGUAGES.find((item) => item.id === message.applied!.lang)?.file}
                      </span>
                      {!message.applied.undone ? (
                        <button type="button" onClick={() => undo(message)} disabled={writing}>
                          <Undo2 aria-hidden /> Desfazer
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ),
            )}
            {liveRead ? (
              <div className="minecode-msg is-mine is-live">
                {liveRead.explanation ? <MineRichText text={liveRead.explanation} streaming /> : null}
                <p className="minecode-live">
                  <Loader2 className="animate-spin" aria-hidden />
                  {liveRead.code ? `escrevendo no editor… ${liveRead.code.split("\n").length} linhas` : "pensando…"}
                </p>
              </div>
            ) : null}
          </div>

          <div className="minecode-chat-input">
            <div className="minecode-quick">
              <button type="button" onClick={() => void ask("Me explica este código parte por parte, como se eu estivesse começando.")} disabled={writing}>
                <Lightbulb aria-hidden /> Explicar
              </button>
              <button type="button" className={failed ? "is-hot" : ""} onClick={() => void ask("Corrige o erro do meu código e me explica o que estava errado.")} disabled={writing}>
                <Bug aria-hidden /> Corrigir erro
              </button>
              <button type="button" onClick={() => void ask("Melhora este código e me conta o que mudou.")} disabled={writing}>
                <Wand2 aria-hidden /> Melhorar
              </button>
            </div>
            <form
              className="minecode-chat-form"
              onSubmit={(event) => {
                event.preventDefault();
                void ask(draft);
              }}
            >
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void ask(draft);
                  }
                }}
                rows={2}
                placeholder={language === "html" ? "Ex.: faz um site da minha banda com galeria" : "Ex.: faz um jogo de perguntas com placar"}
                aria-label="Pedido para a Mine"
                disabled={writing}
              />
              {writing ? (
                <button type="button" className="minecode-send is-stop" onClick={() => abort.current?.abort()} aria-label="Parar">
                  <Square aria-hidden />
                </button>
              ) : (
                <button type="submit" className="minecode-send" disabled={!draft.trim()} aria-label="Enviar pedido">
                  <Send aria-hidden />
                </button>
              )}
            </form>
          </div>
        </aside>
      </div>
    </section>
  );
}
