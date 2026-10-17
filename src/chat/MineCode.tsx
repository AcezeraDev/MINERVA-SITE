// Carregado sob demanda (React.lazy) pela aba MineCode do chat da Mine.
import React, { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  ArrowLeft,
  Bug,
  Check,
  Code2,
  Minus,
  PanelRightClose,
  PanelRightOpen,
  FileCode2,
  Lightbulb,
  Loader2,
  Maximize2,
  Minimize2,
  Monitor as MonitorIcon,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Smartphone,
  Square,
  Terminal as TerminalIcon,
  Trash2,
  Undo2,
  Wand2,
} from "lucide-react";
import { RunOutput, useRunner, usesInput } from "./CodeRunner";
import { SiteFrame } from "./SitePreview";
import { MineRichText } from "./MineRichText";
import { MineFace } from "../caderno/MineFace";
import { streamMineCode } from "./minecode-api";
import { isSitePage, mineCodeLanguage, readCodeReply } from "../../shared/code-run.mjs";
import "./minecode.css";

/*
 * MineCode: um terminal e um monitor. No terminal, a aba "conversa" é o chat
 * com a Mine (você pede, ela escreve o arquivo inteiro, ao vivo pelo
 * streaming) e a aba do arquivo é o editor (números de linha, Tab vira
 * espaços, Ctrl+Enter executa). O monitor ao lado mostra o site pronto ou a
 * saída do programa, com visão de celular e tela cheia. Cada resposta tem
 * Desfazer. O código de qualquer resposta da conversa abre aqui pelo botão
 * "MineCode".
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

const PREVIEW_STORAGE = "minerva-minecode-preview-v1";

export function MineCode({
  incoming,
  onExit,
}: {
  /** Código vindo de uma resposta da Mine (botão "MineCode"). */
  incoming: { code: string; lang: string; at: number } | null;
  onAsk?: (text: string) => void;
  busy?: boolean;
  /** Volta para a conversa normal (o MineCode ocupa a tela inteira). */
  onExit?: () => void;
}) {
  const saved = useMemo(loadSaved, []);
  const [language, setLanguage] = useState<MineCodeLanguage>(saved.language);
  const [codes, setCodes] = useState<Partial<Record<MineCodeLanguage, string>>>(() => ({
    python: saved.code.python ?? EXAMPLES.python[0].code,
    javascript: saved.code.javascript ?? EXAMPLES.javascript[0].code,
    html: saved.code.html ?? EXAMPLES.html[0].code,
  }));
  const [stdin, setStdin] = useState("");
  // ao abrir, o monitor já mostra o site que estava no editor
  const [htmlRun, setHtmlRun] = useState<string | null>(() => {
    const html = saved.code.html ?? "";
    return saved.language === "html" && isSitePage(html, "html") ? html : null;
  });
  const [previewOpen, setPreviewOpen] = useState(() => {
    try {
      return localStorage.getItem(PREVIEW_STORAGE) !== "fechada";
    } catch {
      return true;
    }
  });
  const [messages, setMessages] = useState<ChatMessage[]>(loadChat);
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState<string | null>(null);
  const [pane, setPane] = useState<"chat" | "code">("chat");
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

  useEffect(() => {
    try {
      localStorage.setItem(PREVIEW_STORAGE, previewOpen ? "aberta" : "fechada");
    } catch {
      // idem
    }
  }, [previewOpen]);

  // trocar para HTML mostra no monitor o site que já está no editor
  useEffect(() => {
    if (language !== "html" || htmlRun || writing) return;
    const html = codes.html ?? "";
    if (isSitePage(html, "html")) setHtmlRun(html);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

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
    setPane("code");
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
        setPreviewOpen(true);
        if (lang === "html") setHtmlRun(read.code);
        else if (!usesInput(lang, read.code)) void runner.run(lang, read.code, []);
        else setHtmlRun(null);
        // no celular o monitor fica embaixo do terminal: desce até ele
        if (window.matchMedia("(max-width: 900px)").matches) {
          window.setTimeout(() => document.querySelector(".mc-monitor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
        }
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
  const liveTail = liveRead?.code ? liveRead.code.replace(/\s+$/, "").split("\n").slice(-8).join("\n") : "";

  return (
    <section className="minecode" aria-label="MineCode">
      <header className="mc-top">
        {onExit ? (
          <button type="button" className="mc-top-back" onClick={onExit} title="Voltar para a conversa com a Mine">
            <ArrowLeft aria-hidden /> <span>Conversa</span>
          </button>
        ) : null}
        <span className="mc-top-brand">
          <Code2 aria-hidden /> MineCode
        </span>
        <span className={`mc-top-status ${writing ? "is-busy" : ""}`}>
          <i aria-hidden /> {writing ? "a Mine está escrevendo…" : "pronta"}
        </span>
        <button type="button" className={`mc-top-toggle ${previewOpen ? "is-on" : ""}`} onClick={() => setPreviewOpen((open) => !open)} aria-pressed={previewOpen} title={previewOpen ? "Minimizar a prévia" : "Mostrar a prévia"}>
          {previewOpen ? <PanelRightClose aria-hidden /> : <PanelRightOpen aria-hidden />}
          <span>{previewOpen ? "Minimizar prévia" : "Mostrar prévia"}</span>
        </button>
      </header>
      <div className={`mc-desk ${previewOpen ? "" : "is-solo"}`}>
        {/* ───────── terminal: conversa com a Mine + editor ───────── */}
        <div className={`mc-term ${writing ? "is-writing" : ""}`}>
          <div className="mc-term-bar">
            <span className="mc-dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span className="mc-term-title">
              <TerminalIcon aria-hidden /> mine@minecode: ~/{meta.file}
            </span>
            <span className="mc-langs" role="tablist" aria-label="Linguagem">
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
            </span>
          </div>

          <div className="mc-tabs" role="tablist" aria-label="Painel do terminal">
            <button type="button" role="tab" aria-selected={pane === "chat"} className={pane === "chat" ? "is-on" : ""} onClick={() => setPane("chat")}>
              <span className="mc-prompt-glyph" aria-hidden>
                ❯
              </span>{" "}
              conversa
            </button>
            <button type="button" role="tab" aria-selected={pane === "code"} className={pane === "code" ? "is-on" : ""} onClick={() => setPane("code")}>
              <FileCode2 aria-hidden /> {meta.file}
              {writing ? <i className="mc-tab-dot" aria-label="sendo escrito" /> : null}
            </button>
            {pane === "chat" && messages.length && !writing ? (
              <button type="button" className="mc-tab-tool" onClick={() => setMessages([])} title="Limpar conversa">
                <Trash2 aria-hidden /> <span>clear</span>
              </button>
            ) : null}
            {pane === "code" && !writing ? (
              <label className="mc-tab-tool mc-examples">
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
            ) : null}
          </div>

          {pane === "chat" ? (
            <>
              <div className="mc-log" ref={chatScroll} aria-live="polite">
                <div className="mc-welcome">
                  <MineFace thinking={writing} className="mc-face" />
                  <div>
                    <p className="mc-welcome-title">MineCode · Mine programadora</p>
                    <p className="mc-dim">{writing ? "escrevendo o código…" : "diga o que quer criar; o resultado aparece no monitor ao lado"}</p>
                  </div>
                </div>
                {!messages.length && !writing ? (
                  <div className="mc-starters">
                    <p className="mc-dim"># tente um destes:</p>
                    {STARTERS[language].map((item) => (
                      <button key={item} type="button" onClick={() => void ask(item)}>
                        <span className="mc-ps">$</span> {item}
                      </button>
                    ))}
                  </div>
                ) : null}
                {messages.map((message) =>
                  message.role === "user" ? (
                    <p key={message.id} className="mc-cmd">
                      <span className="mc-ps">aluno@minerva ~ $</span> {message.text}
                    </p>
                  ) : (
                    <div key={message.id} className={`mc-out ${message.error ? "is-error" : ""}`}>
                      <span className="mc-who">{message.error ? "erro" : "mine"}</span>
                      <MineRichText text={message.text} />
                      {message.applied ? (
                        <div className={`mc-applied ${message.applied.undone ? "is-undone" : ""}`}>
                          <Check aria-hidden />
                          <span>
                            {message.applied.undone ? "desfeito" : `${message.applied.lines} linhas →`} {LANGUAGES.find((item) => item.id === message.applied!.lang)?.file}
                          </span>
                          {!message.applied.undone ? (
                            <>
                              <button type="button" onClick={() => setPane("code")}>
                                ver código
                              </button>
                              <button type="button" onClick={() => undo(message)} disabled={writing}>
                                <Undo2 aria-hidden /> desfazer
                              </button>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ),
                )}
                {liveRead ? (
                  <div className="mc-out is-live">
                    <span className="mc-who">mine</span>
                    {liveRead.explanation ? <MineRichText text={liveRead.explanation} streaming /> : null}
                    {liveRead.code ? (
                      <>
                        <p className="mc-dim">
                          <Loader2 className="animate-spin" aria-hidden /> escrevendo {meta.file}… {liveRead.code.split("\n").length} linhas
                        </p>
                        <pre className="mc-stream">
                          {liveTail}
                          <span className="mc-caret" aria-hidden />
                        </pre>
                      </>
                    ) : (
                      <p className="mc-dim">
                        <Loader2 className="animate-spin" aria-hidden /> pensando…
                      </p>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="mc-input">
                <div className="mc-quick">
                  <button type="button" onClick={() => void ask("Me explica este código parte por parte, como se eu estivesse começando.")} disabled={writing}>
                    <Lightbulb aria-hidden /> explicar
                  </button>
                  <button type="button" className={failed ? "is-hot" : ""} onClick={() => void ask("Corrige o erro do meu código e me explica o que estava errado.")} disabled={writing}>
                    <Bug aria-hidden /> corrigir
                  </button>
                  <button type="button" onClick={() => void ask("Melhora este código e me conta o que mudou.")} disabled={writing}>
                    <Wand2 aria-hidden /> melhorar
                  </button>
                </div>
                <form
                  className="mc-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void ask(draft);
                  }}
                >
                  <span className="mc-ps" aria-hidden>
                    ❯
                  </span>
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void ask(draft);
                      }
                    }}
                    rows={1}
                    placeholder={language === "html" ? "faz um site da minha banda com galeria" : "faz um jogo de perguntas com placar"}
                    aria-label="Pedido para a Mine"
                    disabled={writing}
                  />
                  {writing ? (
                    <button type="button" className="mc-send is-stop" onClick={() => abort.current?.abort()} aria-label="Parar">
                      <Square aria-hidden />
                    </button>
                  ) : (
                    <button type="submit" className="mc-send" disabled={!draft.trim()} aria-label="Enviar pedido">
                      <Send aria-hidden />
                    </button>
                  )}
                </form>
              </div>
            </>
          ) : (
            <>
              <div className="mc-code">
                <div className="mc-gutter" ref={gutter} aria-hidden>
                  {Array.from({ length: lineCount }, (_, index) => (
                    <span key={index}>{index + 1}</span>
                  ))}
                </div>
                <textarea
                  className="mc-textarea"
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
              {language !== "html" && usesInput(language, code) ? (
                <label className="mc-stdin">
                  <span>Entradas para {language === "python" ? "input()" : "prompt()"} — uma por linha</span>
                  <textarea value={stdin} onChange={(event) => setStdin(event.target.value)} rows={2} spellCheck={false} placeholder="ex.: 7" />
                </label>
              ) : null}
              <div className="mc-actions">
                <button type="button" className="minecode-run" onClick={run} disabled={runner.status !== "idle" || writing}>
                  {runner.status !== "idle" ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
                  {language === "html" ? "Ver no monitor" : runner.status !== "idle" ? "Rodando…" : "Executar"}
                  <kbd>Ctrl ↵</kbd>
                </button>
                <button
                  type="button"
                  className="mc-ghost"
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
            </>
          )}
        </div>

        {/* ───────── monitor: o site pronto ou a saída do programa ───────── */}
        {previewOpen ? (
        <MineMonitor
          onMinimize={() => setPreviewOpen(false)}
          file={meta.file}
          isHtml={language === "html"}
          html={htmlRun}
          writing={writing}
          busy={runner.status !== "idle"}
          onRun={run}
          output={
            runner.lines.length || runner.status !== "idle" || runner.elapsed !== null ? (
              <RunOutput lines={runner.lines} status={runner.status} elapsed={runner.elapsed} onClear={runner.clear} />
            ) : null
          }
          emptyHint={language === "html" ? "Peça um site no terminal ou toque em ▶ para ver a página aqui." : `Toque em ▶ para rodar o programa. O que ele imprimir com ${language === "python" ? "print()" : "console.log()"} aparece aqui.`}
        />
        ) : null}
      </div>
    </section>
  );
}

/*
 * O monitor ao lado do terminal. Tela cheia de verdade (Fullscreen API) na
 * moldura inteira; onde o navegador não deixa (iPhone), vira um overlay fixo.
 * O iframe continua sendo o SiteFrame isolado (sandbox sem same-origin).
 */
function MineMonitor({
  onMinimize,
  file,
  isHtml,
  html,
  writing,
  busy,
  onRun,
  output,
  emptyHint,
}: {
  onMinimize: () => void;
  file: string;
  isHtml: boolean;
  html: string | null;
  writing: boolean;
  busy: boolean;
  onRun: () => void;
  output: React.ReactNode;
  emptyHint: string;
}) {
  const frame = useRef<HTMLDivElement | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [reload, setReload] = useState(0);
  const [full, setFull] = useState(false);
  const [fakeFull, setFakeFull] = useState(false);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!fakeFull) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFakeFull(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [fakeFull]);

  const expanded = full || fakeFull;
  const toggleFull = async () => {
    if (expanded) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      setFakeFull(false);
      return;
    }
    const node = frame.current;
    if (node?.requestFullscreen) {
      // alguns navegadores embutidos nunca resolvem o pedido: depois de um
      // instante sem tela cheia, cai no overlay
      const ok = await Promise.race([
        node.requestFullscreen().then(
          () => true,
          () => false,
        ),
        new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 700)),
      ]);
      if (ok || document.fullscreenElement === node) return;
    }
    setFakeFull(true);
  };

  const showing = isHtml ? Boolean(html) : Boolean(output);

  return (
    <div className="mc-monitor">
      <div ref={frame} className={`mc-screen-frame ${fakeFull ? "is-fake-full" : ""} ${expanded ? "is-full" : ""}`}>
        <div className="mc-screen-bar">
          <span className={`mc-led ${writing || busy ? "is-busy" : showing ? "is-on" : ""}`} aria-hidden />
          <span className="mc-url">{isHtml ? `minerva.app/${file}` : `saída de ${file}`}</span>
          {isHtml ? (
            <span className="mc-devices" role="group" aria-label="Tamanho da tela">
              <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} title="Computador">
                <MonitorIcon aria-hidden />
              </button>
              <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} title="Celular">
                <Smartphone aria-hidden />
              </button>
            </span>
          ) : null}
          <button type="button" className="mc-screen-btn" onClick={onRun} disabled={busy || writing} title={isHtml ? "Atualizar com o código do editor" : "Rodar o programa"}>
            {isHtml ? <RefreshCw aria-hidden /> : <Play aria-hidden />}
          </button>
          {isHtml && html ? (
            <button type="button" className="mc-screen-btn" onClick={() => setReload((value) => value + 1)} title="Recarregar a página">
              <RotateCcw aria-hidden />
            </button>
          ) : null}
          <button type="button" className="mc-screen-btn is-full-btn" onClick={() => void toggleFull()} title={expanded ? "Sair da tela cheia (Esc)" : "Tela cheia"}>
            {expanded ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
            <span>{expanded ? "Sair" : "Tela cheia"}</span>
          </button>
          {!expanded ? (
            <button type="button" className="mc-screen-btn" onClick={onMinimize} title="Minimizar a prévia">
              <Minus aria-hidden />
            </button>
          ) : null}
        </div>
        <div className="mc-screen">
          {isHtml && html ? (
            <SiteFrame key={reload} code={html} title={file} device={device} />
          ) : !isHtml && output ? (
            output
          ) : (
            <div className="mc-standby">
              {writing ? <Loader2 className="animate-spin" aria-hidden /> : <MonitorIcon aria-hidden />}
              <p>{writing ? "A Mine está escrevendo… o resultado aparece aqui quando ela terminar." : emptyHint}</p>
            </div>
          )}
        </div>
      </div>
      <div className="mc-chin" aria-hidden>
        <span>MineView</span>
      </div>
      <div className="mc-neck" aria-hidden />
      <div className="mc-base" aria-hidden />
    </div>
  );
}
