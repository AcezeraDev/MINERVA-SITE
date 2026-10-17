import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Code2, Download, Eye, Maximize2, Monitor, Smartphone, X } from "lucide-react";

/*
 * Prévia de site no chat da Mine.
 *
 * Quando a Mine responde com uma página HTML completa (o pedido "faz um site
 * de...", "como ficaria?"), o bloco de código vira esta janela: a página
 * rodando de verdade, com as abas Prévia/Código, visão de computador ou de
 * celular, tela cheia e download do .html.
 *
 * Segurança: a página roda num iframe `sandbox="allow-scripts"` SEM
 * `allow-same-origin`. O código gerado pela IA executa numa origem opaca: não
 * lê o localStorage do Minerva (onde fica a sessão), não acessa o DOM do chat
 * e não abre janelas. Por isso também a tela cheia é um overlay aqui dentro, e
 * não uma aba nova com URL de blob — que teria a origem do site.
 */

export { isSitePage } from "../../shared/code-run.mjs";

// links da página não saem da prévia (navegar para fora trocaria o site por outro)
const GUARD = `<script>document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a)return;var h=a.getAttribute("href")||"";if(h.charAt(0)!=="#"){e.preventDefault();}},true);</script>`;

function withGuard(code: string) {
  return /<\/body>/i.test(code) ? code.replace(/<\/body>/i, `${GUARD}</body>`) : `${code}${GUARD}`;
}

function titleOf(code: string) {
  return (code.match(/<title>([^<]{1,80})<\/title>/i)?.[1] || "meu-site").trim();
}

function fileName(code: string) {
  const base = titleOf(code)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "meu-site"}.html`;
}

export function SiteFrame({ code, title, device }: { code: string; title: string; device: "desktop" | "mobile" }) {
  const srcDoc = useMemo(() => withGuard(code), [code]);
  return (
    <div className={`msp-stage is-${device}`}>
      <iframe className="msp-frame" title={`Prévia: ${title}`} srcDoc={srcDoc} sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer" loading="lazy" />
    </div>
  );
}

export function SitePreview({ code, codeView }: { code: string; codeView: React.ReactNode }) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [full, setFull] = useState(false);
  const title = titleOf(code);

  useEffect(() => {
    if (!full) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFull(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [full]);

  const download = () => {
    const url = URL.createObjectURL(new Blob([code], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName(code);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <figure className="msp">
      <figcaption className="msp-bar">
        <span className="msp-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="msp-url" title={title}>
          {title}
        </span>
        <span className="msp-tabs" role="tablist" aria-label="Ver site">
          <button type="button" role="tab" aria-selected={tab === "preview"} className={tab === "preview" ? "is-on" : ""} onClick={() => setTab("preview")}>
            <Eye aria-hidden /> Prévia
          </button>
          <button type="button" role="tab" aria-selected={tab === "code"} className={tab === "code" ? "is-on" : ""} onClick={() => setTab("code")}>
            <Code2 aria-hidden /> Código
          </button>
        </span>
      </figcaption>

      {tab === "preview" ? (
        <>
          <div className="msp-tools">
            <span className="msp-devices" role="group" aria-label="Tamanho da tela">
              <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} title="Computador">
                <Monitor aria-hidden /> <span>Computador</span>
              </button>
              <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} title="Celular">
                <Smartphone aria-hidden /> <span>Celular</span>
              </button>
            </span>
            <span className="msp-actions">
              <button type="button" onClick={() => setFull(true)}>
                <Maximize2 aria-hidden /> <span>Tela cheia</span>
              </button>
              <button type="button" onClick={download}>
                <Download aria-hidden /> <span>Baixar .html</span>
              </button>
            </span>
          </div>
          <SiteFrame code={code} title={title} device={device} />
        </>
      ) : (
        <div className="msp-code">{codeView}</div>
      )}

      {full
        ? createPortal(
            <div className="msp-full" role="dialog" aria-modal="true" aria-label={`Site em tela cheia: ${title}`}>
              <div className="msp-full-bar">
                <span className="msp-url">{title}</span>
                <button type="button" onClick={download}>
                  <Download aria-hidden /> Baixar
                </button>
                <button type="button" onClick={() => setFull(false)} aria-label="Fechar tela cheia">
                  <X aria-hidden />
                </button>
              </div>
              <SiteFrame code={code} title={title} device="desktop" />
            </div>,
            document.body,
          )
        : null}
    </figure>
  );
}
