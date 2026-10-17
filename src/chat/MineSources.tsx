import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  Brain,
  ChevronDown,
  ExternalLink,
  Globe,
  Search,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import "./mine-sources.css";

/*
 * Pesquisa na web do jeito dos chats grandes (out/2026):
 * - selo da fonte no meio do texto no lugar de "[1]", com cartão ao passar o
 *   mouse (ou tocar);
 * - botão "Fontes" com os ícones dos sites empilhados, que abre a lista;
 * - "Pesquisando na web" / "Lendo 6 fontes" enquanto o servidor busca;
 * - "Pensou por 6 s", que abre o raciocínio quando o modelo o devolve.
 */

export type MineSource = {
  url: string;
  title: string;
  domain?: string;
  snippet?: string;
};

export type MineSearchStatus = {
  stage: "searching" | "reading";
  queries?: string[];
  sources?: MineSource[];
};

const SourcesContext = createContext<MineSource[] | undefined>(undefined);

export function MineSourcesProvider({
  sources,
  children,
}: {
  sources?: MineSource[];
  children: React.ReactNode;
}) {
  return (
    <SourcesContext.Provider value={sources?.length ? sources : undefined}>
      {children}
    </SourcesContext.Provider>
  );
}

export function domainOf(source: MineSource) {
  if (source.domain) return source.domain.replace(/^www\./, "");
  try {
    return new URL(source.url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Nome curto do site no selo: "pt.wikipedia.org" -> "wikipedia",
 * "g1.globo.com" -> "globo", "uol.com.br" -> "uol", "gov.br" -> "gov.br".
 */
export function siteLabel(source: MineSource) {
  const domain = domainOf(source);
  const parts = domain.split(".");
  if (parts.length <= 2 && /^(gov|edu|org|jus|leg|mil)$/.test(parts[0]))
    return domain;
  // Sufixo duplo (com.br, gov.br, org.br, co.uk): o nome vem antes dele.
  const doubleSuffix =
    parts.length >= 3 &&
    /^(com|gov|org|edu|net|art|jus|leg|mil|co|ac)$/.test(
      parts[parts.length - 2],
    );
  return (
    (doubleSuffix ? parts[parts.length - 3] : parts[parts.length - 2]) || domain
  );
}

export function SourceIcon({
  source,
  size = 16,
}: {
  source: MineSource;
  size?: number;
}) {
  const domain = domainOf(source);
  const [failed, setFailed] = useState(!domain);
  if (failed) {
    return (
      <span
        className="mine-src-icon mine-src-icon--letter"
        style={{ width: size, height: size, fontSize: size * 0.6 }}
        aria-hidden
      >
        {(domain || "?").charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      className="mine-src-icon"
      src={`https://icons.duckduckgo.com/ip3/${domain}.ico`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

/**
 * Selo de citação: um ou mais números seguidos ("[2][3]") viram um selo só,
 * "g1 +1", como no ChatGPT. Sem as fontes da mensagem, os números voltam a
 * ser texto — melhor que um selo que não leva a lugar nenhum.
 */
export function MineCitation({ indexes }: { indexes: number[] }) {
  const sources = useContext(SourcesContext);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);
  const cardId = useId();
  const cited = (
    sources ? indexes.map((index) => sources[index - 1]).filter(Boolean) : []
  ) as MineSource[];

  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  if (!cited.length)
    return <>{indexes.map((index) => `[${index}]`).join("")}</>;
  const first = cited[0];
  return (
    <span
      ref={ref}
      className={`mine-cite ${open ? "is-open" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <a
        href={first.url}
        target="_blank"
        rel="noreferrer noopener"
        className="mine-cite__chip"
        aria-describedby={open ? cardId : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(event) => {
          // No toque o primeiro clique só abre o cartão; o segundo segue o link.
          if (window.matchMedia("(hover: none)").matches && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {siteLabel(first)}
        {cited.length > 1 ? (
          <span className="mine-cite__more">+{cited.length - 1}</span>
        ) : null}
      </a>
      {open ? (
        <span id={cardId} role="tooltip" className="mine-cite__card">
          {cited.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer noopener"
              className="mine-cite__item"
            >
              <span className="mine-cite__site">
                <SourceIcon source={source} size={14} />
                {domainOf(source)}
              </span>
              <span className="mine-cite__title">{source.title}</span>
              {source.snippet ? (
                <span className="mine-cite__snippet">{source.snippet}</span>
              ) : null}
            </a>
          ))}
        </span>
      ) : null}
    </span>
  );
}

/** Ícones dos sites empilhados (até 4), como no botão de fontes do ChatGPT. */
function IconStack({ sources }: { sources: MineSource[] }) {
  const unique = sources
    .filter(
      (source, index) =>
        sources.findIndex((other) => domainOf(other) === domainOf(source)) ===
        index,
    )
    .slice(0, 4);
  return (
    <span className="mine-src-stack" aria-hidden>
      {unique.map((source) => (
        <span key={source.url} className="mine-src-stack__item">
          <SourceIcon source={source} size={16} />
        </span>
      ))}
    </span>
  );
}

/**
 * Botão "Fontes" embaixo da resposta. Abre um painel com cada página
 * consultada e as buscas que a Mine fez.
 */
export function MineSourcesButton({
  sources,
  queries,
}: {
  sources?: MineSource[];
  queries?: string[];
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      triggerRef.current?.focus();
    };
  }, [open]);
  if (!sources?.length) return null;
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="mine-src-button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <IconStack sources={sources} />
        <span>Fontes</span>
        <span className="mine-src-button__count">{sources.length}</span>
      </button>
      {/* No body: a mensagem tem transform (animação de entrada), e um
          position: fixed dentro dela ficaria preso à mensagem, não à tela. */}
      {createPortal(
        <AnimatePresence>
          {open ? (
            <>
              <motion.div
                className="mine-src-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setOpen(false)}
              />
              <motion.aside
                role="dialog"
                aria-modal="true"
                aria-label="Fontes da resposta"
                className="mine-src-panel"
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 28 }}
                transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
              >
                <header className="mine-src-panel__head">
                  <div>
                    <p className="mine-src-panel__eyebrow">
                      <Globe aria-hidden className="h-3 w-3" /> Pesquisa na web
                    </p>
                    <h2>
                      {sources.length}{" "}
                      {sources.length === 1 ? "fonte" : "fontes"}
                    </h2>
                  </div>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Fechar fontes"
                    className="mine-src-panel__close"
                  >
                    <X className="h-[18px] w-[18px]" />
                  </button>
                </header>
                {queries?.length ? (
                  <div className="mine-src-panel__queries">
                    {queries.map((query) => (
                      <span key={query} className="mine-src-query">
                        <Search aria-hidden className="h-3 w-3" />
                        {query.replace(/^site:\S+\s*/, "")}
                      </span>
                    ))}
                  </div>
                ) : null}
                <ol className="mine-src-panel__list">
                  {sources.map((source, index) => (
                    <li key={source.url}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mine-src-card"
                      >
                        <span className="mine-src-card__site">
                          <span className="mine-src-card__n">{index + 1}</span>
                          <SourceIcon source={source} size={16} />
                          <span className="truncate">{domainOf(source)}</span>
                          <ExternalLink
                            aria-hidden
                            className="mine-src-card__out"
                          />
                        </span>
                        <span className="mine-src-card__title">
                          {source.title}
                        </span>
                        {source.snippet ? (
                          <span className="mine-src-card__snippet">
                            {source.snippet}
                          </span>
                        ) : null}
                      </a>
                    </li>
                  ))}
                </ol>
              </motion.aside>
            </>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

function useElapsed(running: boolean) {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  return Math.max(0, Math.round((now - startedAt) / 1000));
}

/**
 * O que a Mine está fazendo antes do texto aparecer: pensando (com o tempo
 * correndo e o raciocínio, se o modelo mandar), pesquisando ou lendo fontes.
 */
export function MineWorking({
  status,
  reasoning,
}: {
  status: MineSearchStatus | null;
  reasoning: string;
}) {
  const seconds = useElapsed(true);
  const [showReasoning, setShowReasoning] = useState(false);
  const label =
    status?.stage === "reading"
      ? `Lendo ${status.sources?.length || 0} ${status.sources?.length === 1 ? "fonte" : "fontes"}`
      : status?.stage === "searching"
        ? "Pesquisando na web"
        : "Pensando";
  return (
    <div className="mine-working" aria-live="polite">
      <div className="mine-working__row">
        <span className="mine-working__icon" aria-hidden>
          {status ? (
            <Globe className="h-3.5 w-3.5" />
          ) : (
            <Brain className="h-3.5 w-3.5" />
          )}
        </span>
        <span className="mine-working__label">{label}</span>
        {seconds >= 2 ? (
          <span className="mine-working__time">{seconds} s</span>
        ) : null}
        {status?.stage === "reading" && status.sources?.length ? (
          <IconStack sources={status.sources} />
        ) : null}
        {reasoning ? (
          <button
            type="button"
            className="mine-working__toggle"
            onClick={() => setShowReasoning((value) => !value)}
            aria-expanded={showReasoning}
          >
            {showReasoning ? "Ocultar" : "Ver raciocínio"}
            <ChevronDown
              aria-hidden
              className={`h-3.5 w-3.5 transition-transform ${showReasoning ? "rotate-180" : ""}`}
            />
          </button>
        ) : null}
      </div>
      {status?.stage === "searching" && status.queries?.length ? (
        <div className="mine-working__queries">
          {status.queries.map((query) => (
            <span key={query} className="mine-src-query">
              <Search aria-hidden className="h-3 w-3" />
              {query.replace(/^site:\S+\s*/, "")}
            </span>
          ))}
        </div>
      ) : null}
      {reasoning && showReasoning ? (
        <p className="mine-thought__text">{reasoning.slice(-1800)}</p>
      ) : null}
    </div>
  );
}

/** "Pensou por 6 s" acima da resposta pronta; abre o raciocínio guardado. */
export function MineThought({
  reasoning,
  seconds,
}: {
  reasoning?: string;
  seconds?: number;
}) {
  const [open, setOpen] = useState(false);
  if (!reasoning && !seconds) return null;
  const label = seconds
    ? `Pensou por ${seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`}`
    : "Raciocínio";
  if (!reasoning)
    return (
      <p className="mine-thought__label mine-thought__label--static">{label}</p>
    );
  return (
    <div className="mine-thought">
      <button
        type="button"
        className="mine-thought__label"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <Brain aria-hidden className="h-3.5 w-3.5" />
        {label}
        <ChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? <p className="mine-thought__text">{reasoning}</p> : null}
    </div>
  );
}
