import React, { memo, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookMarked,
  Check,
  Code2,
  Copy,
  ExternalLink,
  FlaskConical,
  Info,
  Lightbulb,
  ListChecks,
  Sigma,
  Sparkles,
  Star,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { MineCitation } from "./MineSources";
import { CALLOUT_TITLES, labelOf, parseBlocks, parseInline, type Block, type CalloutKind, type InlineToken, type ListBlock } from "../../shared/chat-markdown.mjs";

/*
 * Corpo escrito de uma resposta da Mine, com a cara de um caderno de estudo:
 * fórmula em quadro quadriculado, código numa janela com a linguagem e o botão
 * de copiar, cartões de dica/atenção/definição, tabela com cabeçalho fixo e
 * marca-texto de verdade. O que é cada pedaço vem de shared/chat-markdown.mjs;
 * aqui só se decide a aparência.
 *
 * KaTeX e highlight.js são baixados sob demanda, na primeira resposta que tiver
 * fórmula ou código. Até lá o bloco aparece com o texto cru em fonte mono, sem
 * pular de lugar quando o módulo chega.
 */

// ---------------------------------------------------------------------------
// Carregamento sob demanda

type KatexRender = (tex: string, options: { displayMode: boolean; throwOnError: boolean; strict: string; output: string }) => string;
type Highlighter = (code: string, lang: string) => string | null;

function lazyModule<T>(load: () => Promise<T>) {
  let value: T | null = null;
  let promise: Promise<T> | null = null;
  const listeners = new Set<() => void>();
  const get = () => {
    if (!promise) {
      promise = load().then((loaded) => {
        value = loaded;
        listeners.forEach((listener) => listener());
        return loaded;
      });
      promise.catch(() => {
        // Sem rede no meio do caminho: o texto cru continua na tela.
        promise = null;
      });
    }
    return value;
  };
  return function useModule(enabled: boolean): T | null {
    const [, force] = useState(0);
    useEffect(() => {
      if (!enabled) return;
      const listener = () => force((tick) => tick + 1);
      listeners.add(listener);
      get();
      return () => {
        listeners.delete(listener);
      };
    }, [enabled]);
    return enabled ? value : null;
  };
}

const useKatex = lazyModule<KatexRender>(async () => {
  const [katex] = await Promise.all([import("katex"), import("katex/dist/katex.min.css")]);
  return katex.default.renderToString as unknown as KatexRender;
});

const useHighlighter = lazyModule<Highlighter>(async () => (await import("./highlight")).highlightCode);

// ---------------------------------------------------------------------------
// Inline

function renderTokens(tokens: InlineToken[], keyPrefix = "t"): React.ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (token.type) {
      case "cite": {
        // "[2][3]" vira um selo só: o primeiro número de uma sequência leva
        // todos, e os seguintes não desenham nada.
        if (tokens[index - 1]?.type === "cite") return null;
        const indexes: number[] = [];
        for (let next = index; tokens[next]?.type === "cite"; next += 1) indexes.push((tokens[next] as { index: number }).index);
        return <MineCitation key={key} indexes={indexes} />;
      }
      case "text":
        return <React.Fragment key={key}>{token.text}</React.Fragment>;
      case "code":
        return <code key={key} className="mrt-code-inline">{token.text}</code>;
      case "math":
        return <InlineMath key={key} tex={token.tex} />;
      case "strong":
        return <strong key={key}>{renderTokens(token.children, key)}</strong>;
      case "em":
        return <em key={key}>{renderTokens(token.children, key)}</em>;
      case "mark":
        return <mark key={key} className="mrt-mark">{renderTokens(token.children, key)}</mark>;
      case "del":
        return <del key={key}>{renderTokens(token.children, key)}</del>;
      case "link":
        return (
          <a key={key} href={token.href} target="_blank" rel="noreferrer noopener" className="mrt-link">
            {renderTokens(token.children, key)}
            <ExternalLink aria-hidden className="mrt-link__icon" />
          </a>
        );
      default:
        return null;
    }
  });
}

function Inline({ text }: { text: string }) {
  const tokens = useMemo(() => parseInline(text), [text]);
  return <>{renderTokens(tokens)}</>;
}

const InlineMath = memo(function InlineMath({ tex }: { tex: string }) {
  const render = useKatex(true);
  const html = useMemo(() => {
    if (!render) return null;
    try {
      return render(tex, { displayMode: false, throwOnError: false, strict: "ignore", output: "htmlAndMathml" });
    } catch {
      return null;
    }
  }, [render, tex]);
  if (!html) return <code className="mrt-code-inline mrt-tex-raw">{tex}</code>;
  // Saída do KaTeX com trust desligado (padrão): não aceita \href nem HTML cru.
  return <span className="mrt-math-inline" dangerouslySetInnerHTML={{ __html: html }} />;
});

// ---------------------------------------------------------------------------
// Blocos

function CopyChip({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      className="mrt-copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          // Área de transferência bloqueada: nada a fazer em silêncio.
        }
      }}
      aria-label={copied ? "Copiado" : label}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      <span>{copied ? "Copiado" : "Copiar"}</span>
    </button>
  );
}

const MathBlock = memo(function MathBlock({ tex, open }: { tex: string; open: boolean }) {
  const render = useKatex(!open);
  const html = useMemo(() => {
    if (!render || open) return null;
    try {
      return render(tex, { displayMode: true, throwOnError: false, strict: "ignore", output: "htmlAndMathml" });
    } catch {
      return null;
    }
  }, [render, tex, open]);
  // Fórmula curta (uma igualdade, uma lista de valores) não precisa de
  // cabeçalho: um quadro inteiro por "a = 2" deixava a resolução comprida e
  // repetitiva. Fica só o quadriculado, com o copiar aparecendo no hover.
  const compact = !open && tex.length <= 80 && !tex.includes("\\\\") && !tex.includes("\\begin");
  if (compact) {
    return (
      <figure className="mrt-formula mrt-formula--compact">
        <Sigma aria-hidden className="mrt-formula__mark" />
        {html ? (
          <div className="mrt-formula__body" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <div className="mrt-formula__body">
            <code className="mrt-tex-raw">{tex}</code>
          </div>
        )}
        <span className="mrt-formula__copy">
          <CopyChip text={tex} label="Copiar fórmula em LaTeX" />
        </span>
      </figure>
    );
  }
  return (
    <figure className="mrt-formula">
      <figcaption className="mrt-formula__bar">
        <span className="mrt-chip">
          <Sigma aria-hidden />
          Fórmula
        </span>
        {!open ? <CopyChip text={tex} label="Copiar fórmula em LaTeX" /> : null}
      </figcaption>
      {html ? (
        <div className="mrt-formula__body" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="mrt-formula__body">
          <code className="mrt-tex-raw">{tex}</code>
        </div>
      )}
    </figure>
  );
});

const LANGUAGE_NAMES: Record<string, string> = {
  js: "JavaScript",
  javascript: "JavaScript",
  jsx: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  tsx: "TypeScript",
  py: "Python",
  python: "Python",
  java: "Java",
  c: "C",
  cpp: "C++",
  "c++": "C++",
  cs: "C#",
  csharp: "C#",
  html: "HTML",
  xml: "XML",
  css: "CSS",
  sql: "SQL",
  bash: "Terminal",
  sh: "Terminal",
  shell: "Terminal",
  json: "JSON",
  php: "PHP",
  kotlin: "Kotlin",
  kt: "Kotlin",
};

const CodeBlock = memo(function CodeBlock({ code, lang, open }: { code: string; lang: string; open: boolean }) {
  // Enquanto o bloco ainda está chegando, realçar a cada token só gastaria
  // CPU: a cor entra de uma vez quando a cerca fecha.
  const highlight = useHighlighter(Boolean(lang) && !open);
  const html = useMemo(() => (highlight && !open ? highlight(code, lang) : null), [highlight, code, lang, open]);
  const lines = code.split("\n").length;
  const name = LANGUAGE_NAMES[lang] || (lang ? lang.toUpperCase() : "Código");
  return (
    <figure className="mrt-codebox">
      <figcaption className="mrt-codebox__bar">
        <span className="mrt-codebox__dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="mrt-chip">
          <Code2 aria-hidden />
          {name}
        </span>
        <span className="mrt-codebox__meta">{lines} {lines === 1 ? "linha" : "linhas"}</span>
        {!open ? <CopyChip text={code} label={`Copiar código ${name}`} /> : null}
      </figcaption>
      <div className="mrt-codebox__scroll">
        <div className="mrt-codebox__gutter" aria-hidden>
          {Array.from({ length: lines }, (_, index) => (
            <span key={index}>{index + 1}</span>
          ))}
        </div>
        {html ? (
          <pre className="mrt-codebox__pre">
            <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
          </pre>
        ) : (
          <pre className="mrt-codebox__pre">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </figure>
  );
});

// Coluna numérica ("R$ 15,00", "42%", "3,14") alinha à direita com algarismos
// de largura fixa, como numa planilha.
const NUMERIC_CELL = /^[-+−]?\s*(?:R\$|US\$|\$|€)?\s*[\d.,]+\s*(?:%|°C?|km|kg|m|cm|mm|g|s|h|min)?$/i;

function TableBlock({ block }: { block: Extract<Block, { type: "table" }> }) {
  const numeric = block.header.map((_, column) => {
    const cells = block.rows.map((row) => row[column]).filter((cell) => cell && cell !== "-" && cell !== "—");
    return cells.length > 0 && cells.every((cell) => NUMERIC_CELL.test(cell.replace(/\*\*/g, "")));
  });
  return (
    <div className="mrt-table" role="region" aria-label="Tabela" tabIndex={0}>
      <table>
        <thead>
          <tr>
            {block.header.map((cell, column) => (
              <th key={column} style={{ textAlign: numeric[column] ? "right" : block.align[column] }}>
                <Inline text={cell} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, column) => (
                <td
                  key={column}
                  className={numeric[column] ? "mrt-num" : undefined}
                  style={{ textAlign: numeric[column] ? "right" : block.align[column] }}
                >
                  <Inline text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CALLOUT_ICONS: Record<CalloutKind, LucideIcon> = {
  tip: Lightbulb,
  warning: AlertTriangle,
  important: Star,
  example: FlaskConical,
  definition: BookMarked,
  summary: ListChecks,
  fun: Sparkles,
  mistake: XCircle,
  note: Info,
};

function CalloutBlock({ block, streaming }: { block: Extract<Block, { type: "callout" }>; streaming: boolean }) {
  const Icon = CALLOUT_ICONS[block.kind];
  return (
    <aside className={`mrt-callout mrt-callout--${block.kind}`} aria-label={CALLOUT_TITLES[block.kind]}>
      <span className="mrt-callout__icon" aria-hidden>
        <Icon />
      </span>
      <div className="mrt-callout__body">
        <p className="mrt-callout__title">
          <span>{CALLOUT_TITLES[block.kind]}</span>
          {block.title ? (
            <>
              <span aria-hidden className="mrt-callout__sep">·</span>
              <span className="mrt-callout__subtitle"><Inline text={block.title} /></span>
            </>
          ) : null}
        </p>
        <Blocks blocks={block.children} streaming={streaming} />
      </div>
    </aside>
  );
}

function ListView({ list, depth = 0 }: { list: ListBlock; depth?: number }) {
  const Tag = list.ordered ? "ol" : "ul";
  return (
    <Tag
      className={`mrt-list ${list.ordered ? "mrt-list--steps" : "mrt-list--bullets"} ${depth ? "mrt-list--nested" : ""}`}
      start={list.ordered && list.start !== 1 ? list.start : undefined}
    >
      {list.items.map((item, index) => (
        <li key={index} className="mrt-list__item">
          {list.ordered ? (
            <span className="mrt-list__marker" aria-hidden>
              {list.start + index}
            </span>
          ) : (
            <span className="mrt-list__bullet" aria-hidden />
          )}
          <div className="mrt-list__content">
            <Paragraph text={item.text} bare />
            {item.children?.map((child, childIndex) => (
              <ListView key={childIndex} list={child} depth={depth + 1} />
            ))}
          </div>
        </li>
      ))}
    </Tag>
  );
}

function Paragraph({ text, bare = false }: { text: string; bare?: boolean }) {
  const label = labelOf(text);
  const content = label ? (
    <>
      <span className="mrt-label">{label.label}</span> <Inline text={label.rest} />
    </>
  ) : (
    <Inline text={text} />
  );
  if (bare) return <p className="mrt-p mrt-p--bare">{content}</p>;
  return <p className="mrt-p">{content}</p>;
}

function Blocks({ blocks, streaming }: { blocks: Block[]; streaming: boolean }) {
  return (
    <>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        switch (block.type) {
          case "heading":
            return block.level <= 2 ? (
              <h3 key={key} className="mrt-h2">
                <span className="mrt-h2__mark" aria-hidden />
                <Inline text={block.text} />
              </h3>
            ) : (
              <h4 key={key} className="mrt-h3">
                <Inline text={block.text} />
              </h4>
            );
          case "paragraph":
            return <Paragraph key={key} text={block.text} />;
          case "rule":
            return <hr key={key} className="mrt-rule" />;
          case "code":
            return <CodeBlock key={key} code={block.code} lang={block.lang} open={block.open} />;
          case "math":
            return <MathBlock key={key} tex={block.tex} open={block.open} />;
          case "table":
            return <TableBlock key={key} block={block} />;
          case "callout":
            return <CalloutBlock key={key} block={block} streaming={streaming} />;
          case "quote":
            return (
              <blockquote key={key} className="mrt-quote">
                <Blocks blocks={block.children} streaming={streaming} />
              </blockquote>
            );
          case "list":
            return <ListView key={key} list={block} />;
          default:
            return null;
        }
      })}
    </>
  );
}

/** Texto de uma resposta da Mine, já sem os marcadores de imagem. */
export function MineRichText({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const blocks = useMemo(() => parseBlocks(text, { streaming }), [text, streaming]);
  if (!blocks.length) return null;
  return (
    <div className="mrt">
      <Blocks blocks={blocks} streaming={streaming} />
    </div>
  );
}
