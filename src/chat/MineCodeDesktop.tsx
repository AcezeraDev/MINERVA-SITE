import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDownToLine, ArrowUpRight, Monitor, X } from "lucide-react";
import release from "./minecode-release.json";
import "./minecode-desktop.css";

export const DOWNLOAD_URL = "https://github.com/AcezeraDev/minecode-releases/releases/latest/download/MineCodeSetup.exe";
const dismissedKey = "minerva-minecode-novidade-v1";

export function openMineCodeDesktop() {
  window.dispatchEvent(new Event("minecode:desktop"));
}

export function MineCodeLogo() {
  return <svg className="caderno-minecode-logo" viewBox="3 1 58 58" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g stroke="#2FD483" strokeLinecap="round" strokeLinejoin="round"><path d="M32 9V15" strokeWidth="3"/><circle cx="32" cy="6" r="3" fill="#2FD483" fillOpacity=".35" strokeWidth="2.6"/><rect x="6" y="30" width="6" height="13" rx="2.6" fill="#2FD483" fillOpacity=".35" strokeWidth="2.6"/><rect x="52" y="30" width="6" height="13" rx="2.6" fill="#2FD483" fillOpacity=".35" strokeWidth="2.6"/><rect x="10" y="15" width="44" height="42" rx="14" fill="#13201A" strokeWidth="3"/><rect x="16" y="23" width="32" height="26" rx="9" fill="#050807" strokeWidth="2.6"/><path d="M23 30L29.5 36L23 42" fill="none" strokeWidth="4"/><path d="M33 42H41" strokeWidth="4"/><path d="M27.5 52.2Q32 55 36.5 52.2" fill="none" strokeWidth="2.4"/></g></svg>;
}

function Wordmark() {
  return <span className="caderno-minecode-wordmark">mine<span>code</span></span>;
}

export function MineCodeDesktopButton() {
  return <button type="button" className="caderno-minecode-entry" onClick={openMineCodeDesktop} aria-haspopup="dialog">
    <Monitor size={17} aria-hidden="true" />
    <span>MineCode Desktop <small>· Baixar para Windows</small></span>
    <ArrowDownToLine size={16} aria-hidden="true" />
  </button>;
}

export function MineCodeNews() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(dismissedKey) === "1"; } catch { return false; }
  });
  if (dismissed) return null;
  return <aside className="caderno-minecode-news" aria-label="Novidade: MineCode">
    <span className="caderno-minecode-tape" aria-hidden="true" />
    <button className="caderno-minecode-close" type="button" aria-label="Fechar novidade do MineCode" onClick={() => {
      setDismissed(true);
      try { localStorage.setItem(dismissedKey, "1"); } catch { /* Vale nesta visita quando o armazenamento está indisponível. */ }
    }}><X size={20} /></button>
    <div className="caderno-minecode-news-title"><MineCodeLogo /><div><p className="caderno-minecode-hand">página nova no caderno!</p><h2><Wordmark /> <span>com a Mine</span></h2></div></div>
    <div className="caderno-minecode-news-copy"><p><strong>MineCode web</strong> — programe com a Mine aqui no site.</p><p><strong>MineCode Desktop</strong> — a versão completa para o seu computador.</p></div>
    <div className="caderno-minecode-actions">
      <a className="caderno-minecode-button" href="#/mine/code">Abrir MineCode <ArrowUpRight size={17} aria-hidden="true" /></a>
      <button className="caderno-minecode-button caderno-minecode-secondary" type="button" onClick={openMineCodeDesktop}>Baixar o Desktop <ArrowDownToLine size={17} aria-hidden="true" /></button>
    </div>
  </aside>;
}

const features = [
  ["Criar sites e programas com a Mine", true],
  ["Editor, terminal e prévia no navegador", true],
  ["Agente que planeja, programa, testa e corrige, com limite de passos e pausa", false],
  ["Navegador próprio da IA, que você acompanha ao vivo", false],
  ["Terminal e arquivos reais no computador, com permissões", false],
  ["Modelos de nuvem e modelos locais pelo Ollama", false],
  ["Tempo e custo, limite diário em reais e resumo semanal", false],
  ["Janela rápida com atalho global e ditado", false],
  ["Atualização automática do aplicativo", false],
] as const;

export function MineCodeDesktopPanel() {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const open = () => { if (!dialog.current?.open) dialog.current?.showModal(); };
    const fromHash = () => { if (window.location.hash === "#/mine/desktop") open(); };
    window.addEventListener("minecode:desktop", open);
    window.addEventListener("hashchange", fromHash);
    fromHash();
    return () => {
      window.removeEventListener("minecode:desktop", open);
      window.removeEventListener("hashchange", fromHash);
      dialog.current?.close();
    };
  }, []);
  return createPortal(<dialog ref={dialog} className="caderno-minecode-dialog" aria-labelledby="minecode-desktop-title" aria-describedby="minecode-desktop-description" onClick={(event) => {
    if (event.target === event.currentTarget) {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close();
    }
  }}>
    <div className="caderno-minecode-page">
      <button type="button" className="caderno-minecode-close" aria-label="Fechar painel de download" onClick={() => dialog.current?.close()} autoFocus><X size={22} /></button>
      <header className="caderno-minecode-intro">
        <MineCodeLogo />
        <p className="caderno-minecode-hand">do caderno para o computador</p>
        <h2 id="minecode-desktop-title"><Wordmark /> <span>Desktop</span></h2>
        <p id="minecode-desktop-description">A Mine programando no seu computador, não só no navegador</p>
        <a className="caderno-minecode-button" href={DOWNLOAD_URL}><ArrowDownToLine size={20} aria-hidden="true" /> Baixar para Windows</a>
        <p className="caderno-minecode-meta">Versão {release.version} · {release.size} MB<br />Windows 10/11, 64 bits</p>
      </header>
      <section className="caderno-minecode-section" aria-labelledby="minecode-compare-title">
        <h3 id="minecode-compare-title">Qual página você quer abrir?</h3>
        <p>Comece no site. Leve a Mine para o Desktop quando quiser trabalhar nos seus próprios projetos.</p>
        <table className="caderno-minecode-table">
          <caption>MineCode web × Desktop <span>✓ disponível · — exclusivo do Desktop</span></caption>
          <thead><tr><th scope="col">O que dá para fazer</th><th scope="col">Web</th><th scope="col">Desktop</th></tr></thead>
          <tbody>{features.map(([label, web]) => <tr key={label}><th scope="row">{web ? label : <mark>{label}</mark>}</th><td><span aria-label={web ? "Disponível na web" : "Exclusivo do Desktop"}>{web ? "✓" : "—"}</span></td><td><span aria-label="Disponível no Desktop">✓</span></td></tr>)}</tbody>
        </table>
      </section>
      <section className="caderno-minecode-section" aria-labelledby="minecode-install-title">
        <h3 id="minecode-install-title">Como instalar</h3>
        <ol className="caderno-minecode-steps">
          <li><strong>Baixe e abra o instalador.</strong><p>O arquivo se chama MineCodeSetup.exe. Confira se o download veio de github.com/AcezeraDev/minecode-releases.</p></li>
          <li><strong>Leia o aviso do Windows.</strong><p>O app ainda não tem assinatura digital. O SmartScreen pode mostrar “O Windows protegeu o computador”. Se você conferiu a origem e decidiu instalar, escolha “Mais informações” → “Executar assim mesmo”. Em computadores gerenciados, a instalação pode depender do administrador.</p></li>
          <li><strong>Abra o MineCode e escolha um modelo.</strong><p>Conecte seu provedor de IA ou configure o Ollama para usar um modelo local. Autorize o acesso aos arquivos e ao terminal conforme o projeto precisar.</p></li>
        </ol>
      </section>
      <section className="caderno-minecode-section" aria-labelledby="minecode-faq-title">
        <h3 id="minecode-faq-title">Antes de baixar</h3>
        <details><summary>É grátis?</summary><p>O download e o aplicativo são gratuitos. Modelos de nuvem podem cobrar pelo uso, conforme o provedor escolhido. Você pode acompanhar o custo no app.</p></details>
        <details><summary>Precisa de chave de API?</summary><p>Depende do modelo. Provedores de nuvem podem pedir uma chave de API ou login na sua conta. Com o Ollama local, não precisa de chave de um provedor de nuvem. O instalador não inclui chaves nem contas configuradas.</p></details>
        <details><summary>Funciona sem internet?</summary><p>Sim, com o Ollama instalado e um modelo já baixado no computador. O desempenho depende da sua máquina. Modelos de nuvem, navegação em sites e atualizações precisam de internet.</p></details>
      </section>
      <footer className="caderno-minecode-footer"><a href="https://github.com/AcezeraDev/minecode-releases/releases/latest" target="_blank" rel="noreferrer">Ver versão e arquivos no GitHub <ArrowUpRight size={15} aria-hidden="true" /></a><span>feito para programar junto.</span></footer>
    </div>
  </dialog>, document.body);
}
