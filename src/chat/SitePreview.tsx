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

// Foto da página para a revisão visual do MineCode. Roda DENTRO do iframe
// (origem opaca): o editor manda {type:"mc-capture", id}, a página se desenha
// com html-to-image (até 3 telas de altura) e devolve um JPEG pelo postMessage.
// O html2canvas não serve aqui: ele clona a página num iframe interno, que o
// sandbox sem allow-same-origin bloqueia. <img> sem src (lightbox vazio) é
// pulado: senão a biblioteca baixa a própria página como "imagem" e falha.
// O editor só aceita a resposta vinda desse iframe.
const CAPTURE = `<script src="https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js"></script><script>addEventListener("message",function(e){var d=e.data||{};if(d.type!=="mc-capture")return;var reply=function(img,err){parent.postMessage({type:"mc-capture-result",id:d.id,image:img||"",error:err||""},"*")};try{scrollTo(0,0);var b=document.body,h=Math.min(Math.max(b.scrollHeight,document.documentElement.scrollHeight),innerHeight*3),bg=getComputedStyle(b).backgroundColor;if(!bg||bg==="rgba(0, 0, 0, 0)")bg=getComputedStyle(document.documentElement).backgroundColor||"#ffffff";htmlToImage.toCanvas(b,{width:innerWidth,height:h,pixelRatio:1,backgroundColor:bg,cacheBust:false,imagePlaceholder:"data:image/gif;base64,R0lGODlhAQABAAAAACw=",filter:function(n){var t=n.tagName;return!((t==="IMG"&&!(n.getAttribute("src")||"").trim())||t==="IFRAME"||t==="VIDEO")}}).then(function(c){var w=Math.min(1100,c.width),k=w/c.width,o=document.createElement("canvas");o.width=w;o.height=Math.round(c.height*k);var g=o.getContext("2d");g.fillStyle=bg;g.fillRect(0,0,o.width,o.height);g.drawImage(c,0,0,o.width,o.height);reply(o.toDataURL("image/jpeg",0.72))}).catch(function(x){reply("",String(x&&x.message||x))})}catch(x){reply("",String(x))}});</script>`;

export function SiteFrame({
  code,
  title,
  device,
  capture = false,
  frameRef,
}: {
  code: string;
  title: string;
  device: "desktop" | "mobile";
  /** Inclui o script que fotografa a página (revisão visual do MineCode). */
  capture?: boolean;
  frameRef?: React.Ref<HTMLIFrameElement>;
}) {
  const srcDoc = useMemo(() => {
    const guarded = withGuard(code);
    return capture ? (/<\/body>/i.test(guarded) ? guarded.replace(/<\/body>/i, `${CAPTURE}</body>`) : `${guarded}${CAPTURE}`) : guarded;
  }, [code, capture]);
  return (
    <div className={`msp-stage is-${device}`}>
      <iframe ref={frameRef} className="msp-frame" title={`Prévia: ${title}`} srcDoc={srcDoc} sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer" loading="lazy" />
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
