/*
 * Progresso da Pesquisa aprofundada (25/nov/2026): em vez de um spinner, a
 * tela mostra o que a Mine está fazendo de verdade — as buscas que ela
 * escreveu, os sites em que está entrando, a seção do dossiê que está
 * escrevendo agora (tabela, gráfico, linha do tempo...) e quais fontes já
 * citou. Tudo sai do status do servidor (buscas e fontes) e do texto que
 * está chegando; nada é inventado.
 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BarChart3, Check, FileText, Globe, History, ListOrdered, PenLine, Quote, Search, Sparkles, Table2, Telescope } from "lucide-react";
import { domainOf, SourceIcon, type MineSource } from "./MineSources";
import "./dossie-progresso.css";

type Passo = "planejar" | "buscar" | "ler" | "escrever" | "diagramar";

const ORDEM: Passo[] = ["planejar", "buscar", "ler", "escrever", "diagramar"];

/** Quantas páginas o servidor abre de verdade na Pesquisa aprofundada (mine/router.mjs). */
const PAGINAS_ABERTAS = 6;

function caminhoCurto(url: string) {
  try {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname).replace(/\/$/, "");
    return path.length > 42 ? `${path.slice(0, 40)}…` : path || "/";
  } catch {
    return "";
  }
}

/** O que a Mine está escrevendo agora, lido do fim do texto que chegou. */
function atividadeAtual(corpo: string, sources?: MineSource[]) {
  const linhas = corpo.split("\n");
  const ultimas = linhas.slice(-6).join("\n");
  const ultima = [...linhas].reverse().find((l) => l.trim()) || "";
  // Bloco especial aberto mais recente (o último "> [!X]" ainda em andamento).
  const blocos = Array.from(corpo.matchAll(/^>\s*\[!([A-ZÇÃÕÉÍ ]+)\]\s*(.*)$/gim));
  const bloco = blocos[blocos.length - 1];
  const dentroDoBloco = bloco && /^>/.test(ultima.trim());
  if (dentroDoBloco) {
    const tipo = bloco[1].toUpperCase();
    const nome = bloco[2].trim();
    if (tipo.startsWith("GRAF")) return { icon: BarChart3, texto: `Desenhando o gráfico${nome ? `: ${nome}` : ""}` };
    if (tipo.startsWith("LINHA")) return { icon: History, texto: `Montando a linha do tempo${nome ? `: ${nome}` : ""}` };
    if (tipo.startsWith("DADOS")) return { icon: ListOrdered, texto: `Separando os indicadores${nome ? `: ${nome}` : ""}` };
    return { icon: Sparkles, texto: `Destacando: ${nome || tipo.toLowerCase()}` };
  }
  if (/^\s*\|/.test(ultima)) return { icon: Table2, texto: "Montando a tabela comparativa" };
  const sub = ultima.match(/^###\s+(.+)/);
  if (sub) return { icon: PenLine, texto: `Abrindo o subtópico “${sub[1].trim()}”` };
  const cites = Array.from(ultimas.matchAll(/\[(\d{1,2})\]/g));
  const n = cites.length ? Number(cites[cites.length - 1][1]) : 0;
  const fonte = n && sources?.[n - 1];
  if (fonte) return { icon: Quote, texto: `Citando a fonte ${n} · ${domainOf(fonte)}`, fonte };
  return { icon: PenLine, texto: "Escrevendo e conferindo os dados com as fontes" };
}

export function DossieProgresso({
  fase,
  queries = [],
  sources = [],
  corpo = "",
  titulo = "",
  cronometro = false,
}: {
  /** "buscando" e "lendo" vêm do servidor; "escrevendo" é quando o bloco do PDF já chegou. */
  fase: "planejando" | "buscando" | "lendo" | "escrevendo";
  queries?: string[];
  sources?: MineSource[];
  corpo?: string;
  titulo?: string;
  /** Mostra o tempo desde que o pedido saiu. */
  cronometro?: boolean;
}) {
  const reduce = useReducedMotion();
  const [inicio] = useState(() => Date.now());
  const [agoraMs, setAgoraMs] = useState(() => Date.now());
  useEffect(() => {
    if (!cronometro) return;
    const timer = window.setInterval(() => setAgoraMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [cronometro]);
  const segundos = cronometro ? Math.max(0, Math.round((agoraMs - inicio) / 1000)) : undefined;
  const passoAtual: Passo = fase === "planejando" ? "planejar" : fase === "buscando" ? "buscar" : fase === "lendo" ? "ler" : "escrever";
  const indiceAtual = ORDEM.indexOf(passoAtual);
  const estado = (p: Passo) => (ORDEM.indexOf(p) < indiceAtual ? "feito" : p === passoAtual ? "agora" : "depois");

  // Páginas que o servidor abre: as primeiras da lista, uma de cada vez na tela.
  const abertas = sources.slice(0, PAGINAS_ABERTAS);
  const [lendo, setLendo] = useState(0);
  useEffect(() => {
    if (fase !== "lendo") return;
    setLendo(0);
    const timer = window.setInterval(() => setLendo((i) => Math.min(i + 1, abertas.length)), 1500);
    return () => window.clearInterval(timer);
  }, [fase, abertas.length]);

  const secoes = useMemo(() => (corpo.match(/^##\s+(.+)$/gm) || []).map((h) => h.replace(/^##\s+/, "").replace(/[*_`]/g, "").trim()), [corpo]);
  const citadas = useMemo(() => new Set(Array.from(corpo.matchAll(/\[(\d{1,2})\]/g)).map((m) => Number(m[1]))), [corpo]);
  const palavras = corpo ? corpo.split(/\s+/).filter(Boolean).length : 0;
  const atividade = fase === "escrevendo" ? atividadeAtual(corpo, sources) : null;
  const temTabela = /^\s*\|.+\|/m.test(corpo);
  const temGrafico = /\[!GRAF/i.test(corpo);
  const temLinha = /\[!LINHA/i.test(corpo);

  const passos: Array<{ id: Passo; icon: typeof Search; titulo: string; detalhe: string }> = [
    { id: "planejar", icon: Sparkles, titulo: "Planejar a pesquisa", detalhe: fase === "planejando" ? "Decidindo o que buscar" : `${queries.length || 1} ${queries.length === 1 ? "busca planejada" : "buscas planejadas"}` },
    { id: "buscar", icon: Search, titulo: "Pesquisar na web", detalhe: sources.length ? `${sources.length} resultados encontrados` : "Procurando nos buscadores" },
    { id: "ler", icon: Globe, titulo: "Entrar nos sites e ler", detalhe: abertas.length ? `${abertas.length} páginas abertas por inteiro` : "As melhores páginas" },
    { id: "escrever", icon: PenLine, titulo: "Escrever o dossiê", detalhe: secoes.length ? `${secoes.length} ${secoes.length === 1 ? "seção" : "seções"} · ${palavras.toLocaleString("pt-BR")} palavras` : "Síntese, seções e dados" },
    { id: "diagramar", icon: FileText, titulo: "Diagramar o PDF", detalhe: "Capa, sumário, gráficos e fontes numeradas" },
  ];

  return (
    <div className="dsp" role="status" aria-live="polite" aria-label="Progresso da pesquisa aprofundada">
      <header className="dsp__head">
        <span className="dsp__badge" aria-hidden>
          <Telescope />
        </span>
        <span className="dsp__headtext">
          <strong>{fase === "escrevendo" ? "Montando o dossiê em PDF" : "Pesquisa aprofundada"}</strong>
          <small>{titulo && titulo !== "Arquivo da Mine" ? titulo : "A Mine mostra cada passo enquanto trabalha"}</small>
        </span>
        {segundos !== undefined && segundos >= 2 ? <span className="dsp__time">{segundos < 60 ? `${segundos} s` : `${Math.floor(segundos / 60)} min ${segundos % 60} s`}</span> : null}
      </header>

      <div className="dsp__grid">
        <ol className="dsp__steps">
          {passos.map((p) => {
            const st = estado(p.id);
            const Icon = p.icon;
            return (
              <li key={p.id} className={`dsp__step is-${st}`}>
                <span className="dsp__dot" aria-hidden>
                  {st === "feito" ? <Check /> : <Icon />}
                </span>
                <span className="dsp__steptext">
                  <b>{p.titulo}</b>
                  <small>{p.detalhe}</small>
                </span>

                {/* Buscas que a Mine escreveu */}
                {p.id === "buscar" && queries.length && st !== "depois" ? (
                  <span className="dsp__queries">
                    {queries.slice(0, 5).map((q, i) => (
                      <motion.span
                        key={q}
                        className="dsp__query"
                        initial={reduce ? false : { opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: reduce ? 0 : i * 0.12 }}
                      >
                        <Search aria-hidden /> {q.replace(/^site:\S+\s*/, "")}
                      </motion.span>
                    ))}
                  </span>
                ) : null}

                {/* Sites em que está entrando */}
                {p.id === "ler" && abertas.length && st === "feito" ? (
                  <span className="dsp__lidos">
                    {abertas.map((s) => (
                      <span key={s.url} className="dsp__lido" title={s.title}>
                        <SourceIcon source={s} size={14} />
                        {domainOf(s)}
                      </span>
                    ))}
                  </span>
                ) : null}
                {p.id === "ler" && abertas.length && st === "agora" ? (
                  <ul className="dsp__sites">
                    {abertas.map((s, i) => {
                      const visto = i < lendo;
                      const agora = i === lendo;
                      return (
                        <motion.li
                          key={s.url}
                          className={`dsp__site${visto ? " is-lido" : ""}${agora ? " is-agora" : ""}`}
                          initial={reduce ? false : { opacity: 0, x: -6 }}
                          animate={{ opacity: visto || agora ? 1 : 0.45, x: 0 }}
                          transition={{ delay: reduce ? 0 : i * 0.06 }}
                        >
                          <SourceIcon source={s} size={14} />
                          <span className="dsp__sitedomain">{domainOf(s)}</span>
                          <span className="dsp__sitepath">{agora ? `entrando em ${caminhoCurto(s.url)}` : visto ? s.title : ""}</span>
                          {visto ? <Check className="dsp__sitecheck" aria-hidden /> : null}
                        </motion.li>
                      );
                    })}
                    {st === "agora" && lendo >= abertas.length ? <li className="dsp__site is-agora dsp__site--cruzando">Cruzando o que cada fonte diz…</li> : null}
                  </ul>
                ) : null}

                {/* Seções sendo escritas */}
                {p.id === "escrever" && st === "agora" ? (
                  <div className="dsp__writing">
                    {secoes.length ? (
                      <ul className="dsp__secoes">
                        {secoes.map((s, i) => (
                          <li key={`${i}-${s}`} className={i === secoes.length - 1 ? "is-agora" : "is-feito"}>
                            {i === secoes.length - 1 ? <span className="dsp__pen" aria-hidden /> : <Check aria-hidden />}
                            {s}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {atividade ? (
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.p
                          key={atividade.texto}
                          className="dsp__activity"
                          initial={reduce ? false : { opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduce ? undefined : { opacity: 0, y: -6 }}
                          transition={{ duration: 0.22 }}
                        >
                          {"fonte" in atividade && atividade.fonte ? <SourceIcon source={atividade.fonte} size={14} /> : <atividade.icon aria-hidden />}
                          {atividade.texto}
                        </motion.p>
                      </AnimatePresence>
                    ) : null}
                    {sources.length ? (
                      <p className="dsp__cited">
                        <span className="dsp__citedicons" aria-hidden>
                          {sources.slice(0, 10).map((s, i) => (
                            <span key={s.url} className={citadas.has(i + 1) ? "is-on" : ""} title={domainOf(s)}>
                              <SourceIcon source={s} size={14} />
                            </span>
                          ))}
                        </span>
                        {citadas.size ? `${Math.min(citadas.size, sources.length)} de ${sources.length} fontes já citadas` : "Nenhuma fonte citada ainda"}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>

        {/* A folha crescendo: uma faixa por seção, com tabela/gráfico quando aparecem. */}
        <div className="dsp__paper" aria-hidden>
          <div className="dsp__sheet">
            <span className="dsp__sheet-kicker" />
            <span className="dsp__sheet-title" />
            <span className="dsp__sheet-title is-short" />
            <span className="dsp__sheet-box" />
            {fase === "escrevendo"
              ? secoes.slice(-5).map((s, i, arr) => (
                  <motion.span
                    key={`${s}-${i}`}
                    className={`dsp__sheet-sec${i === arr.length - 1 ? " is-agora" : ""}`}
                    initial={reduce ? false : { opacity: 0, scaleX: 0.3 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    transition={{ duration: 0.4 }}
                  >
                    <i />
                    <i />
                    <i className="is-short" />
                  </motion.span>
                ))
              : [0, 1, 2].map((i) => (
                  <span key={i} className="dsp__sheet-sec is-ghost">
                    <i />
                    <i />
                    <i className="is-short" />
                  </span>
                ))}
            {temTabela ? <span className="dsp__sheet-table" /> : null}
            {temGrafico ? (
              <span className="dsp__sheet-chart">
                <i style={{ width: "86%" }} />
                <i style={{ width: "58%" }} />
                <i style={{ width: "34%" }} />
              </span>
            ) : null}
            {temLinha ? <span className="dsp__sheet-timeline" /> : null}
          </div>
          <span className="dsp__paperlabel">{fase === "escrevendo" ? `${secoes.length || 0} ${secoes.length === 1 ? "seção" : "seções"}` : "PDF"}</span>
        </div>
      </div>
    </div>
  );
}
