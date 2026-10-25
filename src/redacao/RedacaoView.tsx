// Carregado sob demanda (React.lazy): a aba Redação, com correção da Mine nas 5 competências do ENEM.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpenText, ChevronRight, FilePlus2, History, Lightbulb, PenLine, RotateCcw, Shuffle, Sparkles } from "lucide-react";
import { PageHeader, uid, type Session, type User, type useMemoUserData, type AppData } from "../main";
import { useSoftMotion } from "../motion";
import { celebrateFrom, floatXp, mineSays } from "../caderno";
import { CenaFolha } from "../cena3d/Cena3D";
import {
  competencias,
  contarPalavras,
  contarParagrafos,
  contextoCorrecao,
  faixaNota,
  lerCorrecao,
  marcarTrechos,
  situacaoFolha,
  temasRedacao,
  type Correcao,
} from "../../shared/redacao.mjs";
import { redacaoXp } from "../../shared/xp.mjs";
import { askMineTask } from "../mineTask";
import "../cena3d/cena3d.css";
import "./redacao.css";

type Rascunho = { temaId: string; temaLivre: string; titulo: string; texto: string };
type Guardada = { id: string; createdAt: number; tema: string; titulo: string; texto: string; correcao: Correcao };

/** Mola das peças: passa um pouco do ponto e assenta. */
const molaPeca = { type: "spring", stiffness: 300, damping: 30, mass: 1 } as const;

const lendo = [
  "Lendo a introdução…",
  "Procurando o repertório…",
  "Contando os conectivos…",
  "Conferindo a norma culta…",
  "Checando a proposta de intervenção…",
  "Somando as competências…",
];

function lerLocal<T>(chave: string, padrao: T): T {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravarLocal(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem armazenamento local o rascunho vale só enquanto a aba está aberta.
  }
}

export function RedacaoView({ data, user, update }: { data: ReturnType<typeof useMemoUserData>; user: User; update: (next: (draft: AppData) => AppData) => void }) {
  const reduced = useSoftMotion();
  const chaveRascunho = `minerva:redacao:${user.id}`;
  const chaveGuardadas = `minerva:redacoes:${user.id}`;
  const [rascunho, setRascunho] = useState<Rascunho>(() => lerLocal(chaveRascunho, { temaId: temasRedacao[0].id, temaLivre: "", titulo: "", texto: "" }));
  const [fase, setFase] = useState<"escrever" | "corrigindo" | "resultado">("escrever");
  const [resultado, setResultado] = useState<Guardada | null>(null);
  const [erro, setErro] = useState("");
  const [passo, setPasso] = useState(0);
  const notaRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => gravarLocal(chaveRascunho, rascunho), [chaveRascunho, rascunho]);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (fase !== "corrigindo") return;
    const timer = window.setInterval(() => setPasso((valor) => (valor + 1) % lendo.length), 2600);
    return () => window.clearInterval(timer);
  }, [fase]);

  const tema = temasRedacao.find((item) => item.id === rascunho.temaId);
  const temaTexto = rascunho.temaId === "livre" ? rascunho.temaLivre.trim() : tema?.titulo || "";
  const folha = situacaoFolha(rascunho.texto);
  const palavras = contarPalavras(rascunho.texto);
  const paragrafos = contarParagrafos(rascunho.texto);
  const historico = useMemo(
    () => data.sessions.filter((item) => item.kind === "Redação").sort((a, b) => a.createdAt - b.createdAt),
    [data.sessions],
  );
  const guardadas = useMemo(() => lerLocal<Guardada[]>(chaveGuardadas, []), [chaveGuardadas, resultado]);

  const mudar = (parcial: Partial<Rascunho>) => setRascunho((atual) => ({ ...atual, ...parcial }));

  const sortear = () => {
    const outros = temasRedacao.filter((item) => item.id !== rascunho.temaId);
    mudar({ temaId: outros[Math.floor(Math.random() * outros.length)].id });
  };

  const corrigir = async () => {
    if (!folha.ok || !temaTexto) return;
    setErro("");
    setFase("corrigindo");
    setPasso(0);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const texto = rascunho.texto.trim();
    try {
      const resposta = await askMineTask(
        {
          task: "redacao",
          prompt: texto,
          context: contextoCorrecao({ tema: temaTexto, apoio: rascunho.temaId === "livre" ? [] : tema?.apoio, titulo: rascunho.titulo.trim(), texto }),
          outputTokens: 2600,
        },
        { signal: controller.signal, timeoutMs: 120_000 },
      );
      const correcao = lerCorrecao(resposta, texto);
      if (!correcao) throw new Error("A correção veio incompleta. Tente de novo.");
      const guardada: Guardada = { id: uid("redacao"), createdAt: Date.now(), tema: temaTexto, titulo: rascunho.titulo.trim(), texto, correcao };
      const xp = redacaoXp(correcao.total);
      const session: Session = {
        id: guardada.id,
        userId: user.id,
        subjectId: "redacao",
        title: `Redação: ${temaTexto}`.slice(0, 140),
        kind: "Redação",
        createdAt: guardada.createdAt,
        xpEarned: xp,
        tema: temaTexto,
        notas: correcao.notas.map((item) => item.nota),
      };
      update((draft) => ({ ...draft, sessions: [...draft.sessions, session] }));
      gravarLocal(chaveGuardadas, [guardada, ...lerLocal<Guardada[]>(chaveGuardadas, [])].slice(0, 15));
      setResultado(guardada);
      setFase("resultado");
      window.setTimeout(() => {
        floatXp(`+${xp} XP`, notaRef.current);
        if (correcao.total >= 700) celebrateFrom(notaRef.current, { count: 40 });
      }, reduced ? 50 : 900);
      mineSays(correcao.total >= 800 ? `${correcao.total}? Que redação!` : "Corrigida! Olha os grifos.", correcao.total >= 700 ? "wow" : "happy");
    } catch (error) {
      if (controller.signal.aborted) return;
      setErro(error instanceof Error ? error.message : "A Mine não conseguiu corrigir agora.");
      setFase("escrever");
    }
  };

  const reabrir = (item: Guardada) => {
    setResultado(item);
    setFase("resultado");
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div className="red-page">
      <PageHeader
        eyebrow="Redação · ENEM"
        title="Redação com a Mine"
        subtitle="Escreva na folha pautada e a Mine corrige como no ENEM: nota de 0 a 1000 nas cinco competências, com os trechos grifados direto no seu texto."
        action={
          fase === "resultado" ? (
            <button
              type="button"
              className="red-btn caderno-btn-pen"
              onClick={() => {
                mudar({ titulo: "", texto: "" });
                setResultado(null);
                setFase("escrever");
              }}
            >
              <FilePlus2 className="h-4 w-4" /> Nova redação
            </button>
          ) : undefined
        }
      />

      <AnimatePresence mode="wait" initial={false}>
        {fase === "resultado" && resultado ? (
          <motion.div key="resultado" initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <Resultado
              guardada={resultado}
              notaRef={notaRef}
              onReescrever={() => {
                mudar({ texto: resultado.texto, titulo: resultado.titulo });
                setFase("escrever");
              }}
            />
          </motion.div>
        ) : (
          <motion.div key="escrever" className="red-grid" initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <aside className="red-aside">
              <div className="red-hero">
                {fase === "escrever" ? <CenaFolha modo="escrevendo" className="red-hero-cena" /> : <div className="red-hero-cena" />}
                <p className="red-hero-legenda">
                  <span className="caderno-note">nota de 0 a 1000</span> 5 competências · grifos no seu texto
                </p>
              </div>
              <div className="red-card">
                <div className="red-card-top">
                  <p className="caderno-note">tema da vez</p>
                  <button type="button" className="red-link" onClick={sortear}>
                    <Shuffle className="h-4 w-4" /> sortear
                  </button>
                </div>
                <div className="red-temas" role="radiogroup" aria-label="Tema da redação">
                  {temasRedacao.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={rascunho.temaId === item.id}
                      className={`red-tema ${rascunho.temaId === item.id ? "is-on" : ""}`}
                      onClick={() => mudar({ temaId: item.id })}
                    >
                      {rascunho.temaId === item.id ? <motion.span layoutId="red-tema-grifo" className="red-tema-grifo" transition={molaPeca} /> : null}
                      <span className="relative">{item.titulo}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={rascunho.temaId === "livre"}
                    className={`red-tema is-livre ${rascunho.temaId === "livre" ? "is-on" : ""}`}
                    onClick={() => mudar({ temaId: "livre" })}
                  >
                    ✏️ Tema livre (o da sua professora, por exemplo)
                  </button>
                </div>
                {rascunho.temaId === "livre" ? (
                  <input
                    className="red-input"
                    value={rascunho.temaLivre}
                    onChange={(event) => mudar({ temaLivre: event.target.value.slice(0, 200) })}
                    placeholder="Escreva o tema da proposta"
                    aria-label="Tema livre"
                  />
                ) : tema ? (
                  <div className="red-apoio">
                    <p className="red-apoio-label">
                      <BookOpenText className="h-4 w-4" /> textos motivadores
                    </p>
                    {tema.apoio.map((linha) => (
                      <p key={linha}>{linha}</p>
                    ))}
                  </div>
                ) : null}
              </div>

              <details className="red-card red-comp-guia">
                <summary>
                  <Lightbulb className="h-4 w-4" /> O que a Mine avalia
                </summary>
                <ol>
                  {competencias.map((item) => (
                    <li key={item.id}>
                      <strong>C{item.id} · {item.curta}</strong>
                      <span>{item.texto}</span>
                    </li>
                  ))}
                </ol>
              </details>

              {historico.length ? <Historico historico={historico} guardadas={guardadas} onAbrir={reabrir} /> : null}
            </aside>

            <section className="red-folha-wrap" aria-label="Folha de redação">
              <div className="red-folha">
                <p className="red-folha-tema">
                  <span className="caderno-note">proposta</span> {temaTexto || "escolha ou escreva um tema"}
                </p>
                <input
                  className="red-titulo"
                  value={rascunho.titulo}
                  onChange={(event) => mudar({ titulo: event.target.value.slice(0, 120) })}
                  placeholder="Título (opcional)"
                  aria-label="Título da redação"
                />
                <textarea
                  className="red-texto"
                  value={rascunho.texto}
                  onChange={(event) => mudar({ texto: event.target.value.slice(0, 6000) })}
                  placeholder={"Comece pela introdução: apresente o tema e a sua tese.\n\nDepois, dois parágrafos de desenvolvimento com argumentos e repertório.\n\nNa conclusão, a proposta de intervenção: quem faz, o quê, como, para quê e um detalhe."}
                  aria-label="Texto da redação"
                  spellCheck
                />
              </div>

              <div className="red-rodape">
                <div className="red-contadores" aria-live="polite">
                  <span><strong>{palavras}</strong> palavras</span>
                  <span><strong>{paragrafos}</strong> {paragrafos === 1 ? "parágrafo" : "parágrafos"}</span>
                  <span className="red-linhas" title="Linhas estimadas na folha oficial do ENEM (cerca de 75 letras por linha)">
                    <strong>{folha.linhas}</strong>/30 linhas
                    <span className="red-linhas-bar" aria-hidden>
                      <span style={{ transform: `scaleX(${Math.min(1, folha.linhas / 30)})` }} className={folha.linhas >= 7 && folha.linhas <= 30 ? "is-ok" : ""} />
                    </span>
                  </span>
                </div>
                {folha.aviso ? <p className="red-aviso">{folha.aviso}</p> : null}
                {erro ? <p className="red-erro" role="alert">{erro}</p> : null}
                <button type="button" className="red-btn caderno-btn-pen red-corrigir" disabled={!folha.ok || !temaTexto || fase === "corrigindo"} onClick={corrigir}>
                  <PenLine className="h-4 w-4" /> Corrigir com a Mine
                </button>
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {fase === "corrigindo" ? (
          <motion.div className="red-overlay" role="status" aria-live="polite" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="red-overlay-card" initial={{ scale: 0.9, rotateX: 18, y: 30 }} animate={{ scale: 1, rotateX: 0, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 22, mass: 1 }}>
              <CenaFolha modo="corrigindo" className="red-overlay-cena" />
              <p className="caderno-note">corrigindo com caneta vermelha</p>
              <AnimatePresence mode="wait">
                <motion.p key={passo} className="red-overlay-step" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                  {lendo[passo]}
                </motion.p>
              </AnimatePresence>
              <button
                type="button"
                className="red-link"
                onClick={() => {
                  abortRef.current?.abort();
                  setFase("escrever");
                }}
              >
                cancelar
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Resultado({ guardada, notaRef, onReescrever }: { guardada: Guardada; notaRef: React.RefObject<HTMLDivElement>; onReescrever: () => void }) {
  const reduced = useSoftMotion();
  const { correcao } = guardada;
  const [ativo, setAtivo] = useState<number | null>(correcao.trechos.length ? 0 : null);
  const [contagem, setContagem] = useState(reduced ? correcao.total : 0);
  const partes = useMemo(() => marcarTrechos(guardada.texto, correcao.trechos), [guardada.texto, correcao.trechos]);

  useEffect(() => {
    if (reduced) return;
    let quadro = 0;
    const inicio = performance.now();
    const tick = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / 1100);
      setContagem(Math.round(correcao.total * (1 - Math.pow(1 - t, 3))));
      if (t < 1) quadro = requestAnimationFrame(tick);
    };
    quadro = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(quadro);
  }, [correcao.total, reduced]);

  const trecho = ativo !== null ? correcao.trechos[ativo] : null;

  return (
    <div className="red-resultado">
      <section className="red-placar">
        <motion.div
          className="red-nota"
          ref={notaRef}
          aria-label={`Nota ${correcao.total} de 1000`}
          initial={reduced ? false : { scale: 2.6, rotate: -26, opacity: 0, rotateX: 40 }}
          animate={{ scale: 1, rotate: -4, opacity: 1, rotateX: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 15, mass: 1, delay: 0.15 }}
        >
          <span className="caderno-note">sua nota</span>
          <strong>{contagem}</strong>
          <small>de 1000</small>
          <span className="red-faixa">{faixaNota(correcao.total)}</span>
        </motion.div>
        <div className="red-placar-texto">
          <p className="red-placar-tema">{guardada.titulo || guardada.tema}</p>
          {correcao.resumo ? <p>{correcao.resumo}</p> : null}
          {correcao.proximoPasso ? (
            <p className="red-proximo">
              <Sparkles className="h-4 w-4" /> <span><b>Próximo passo:</b> {correcao.proximoPasso}</span>
            </p>
          ) : null}
          <button type="button" className="red-btn red-btn-ghost" onClick={onReescrever}>
            <RotateCcw className="h-4 w-4" /> Reescrever esta redação
          </button>
        </div>
      </section>

      <section className="red-comps" aria-label="Notas por competência">
        {correcao.notas.map((item, indice) => (
          <motion.div
            key={item.id}
            className="red-comp"
            initial={reduced ? false : { opacity: 0, y: 30, rotateX: 14 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ ...molaPeca, delay: 0.3 + indice * 0.08 }}
          >
            <div className="red-comp-top">
              <span className="red-comp-nome">
                <b>C{item.id}</b> {competencias[item.id - 1].curta}
              </span>
              <span className="red-comp-nota">{item.nota}<small>/200</small></span>
            </div>
            <div className="red-comp-bar" aria-hidden>
              <motion.span
                initial={reduced ? false : { scaleX: 0 }}
                animate={{ scaleX: item.nota / 200 }}
                transition={{ type: "spring", stiffness: 120, damping: 18, delay: 0.45 + indice * 0.1 }}
                data-faixa={item.nota >= 160 ? "alta" : item.nota >= 120 ? "media" : "baixa"}
              />
            </div>
            <p>{item.comentario}</p>
          </motion.div>
        ))}
      </section>

      <section className="red-corrigida">
        <div className="red-folha red-folha-lida">
          <div className="red-legenda">
            <span className="caderno-note">texto corrigido</span>
            <span><mark className="red-mark is-erro">rosa</mark> para melhorar</span>
            <span><mark className="red-mark is-acerto">verde</mark> mandou bem</span>
          </div>
          {guardada.titulo ? <p className="red-lida-titulo">{guardada.titulo}</p> : null}
          <div className="red-lida">
            {partes.map((parte, indice) =>
              parte.marca < 0 ? (
                <React.Fragment key={indice}>{parte.texto}</React.Fragment>
              ) : (
                <button
                  key={indice}
                  type="button"
                  className={`red-mark is-${correcao.trechos[parte.marca].tipo} ${ativo === parte.marca ? "is-ativo" : ""}`}
                  onClick={() => setAtivo(parte.marca)}
                >
                  {parte.texto}
                </button>
              ),
            )}
          </div>
        </div>
        <aside className="red-nota-lateral" aria-live="polite">
          {trecho ? (
            <motion.div key={ativo} className={`red-post is-${trecho.tipo}`} initial={reduced ? false : { opacity: 0, rotate: -3, y: 8 }} animate={{ opacity: 1, rotate: -1, y: 0 }}>
              <p className="caderno-note">C{trecho.competencia} · {trecho.tipo === "erro" ? "pode melhorar" : "mandou bem"}</p>
              <p className="red-post-trecho">“{trecho.trecho}”</p>
              <p>{trecho.comentario}</p>
              {trecho.sugestao ? (
                <p className="red-post-sugestao">
                  <b>Sugestão:</b> {trecho.sugestao}
                </p>
              ) : null}
              {correcao.trechos.length > 1 ? (
                <div className="red-post-nav">
                  <button type="button" onClick={() => setAtivo(((ativo ?? 0) - 1 + correcao.trechos.length) % correcao.trechos.length)}>
                    ← anterior
                  </button>
                  <span>{(ativo ?? 0) + 1}/{correcao.trechos.length}</span>
                  <button type="button" onClick={() => setAtivo(((ativo ?? 0) + 1) % correcao.trechos.length)}>
                    próximo →
                  </button>
                </div>
              ) : null}
            </motion.div>
          ) : (
            <p className="red-post-vazio">Toque num trecho grifado para ver o comentário da Mine.</p>
          )}
        </aside>
      </section>
    </div>
  );
}

function Historico({ historico, guardadas, onAbrir }: { historico: Session[]; guardadas: Guardada[]; onAbrir: (item: Guardada) => void }) {
  const totais = historico.map((item) => (item.notas || []).reduce((soma, nota) => soma + nota, 0));
  const ultimas = [...historico].reverse().slice(0, 5);
  const largura = 220;
  const altura = 56;
  const pontos = totais.slice(-10);
  const caminho = pontos
    .map((total, indice) => {
      const x = pontos.length === 1 ? largura / 2 : (indice / (pontos.length - 1)) * largura;
      const y = altura - 4 - (total / 1000) * (altura - 8);
      return `${indice ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const melhor = Math.max(...totais);

  return (
    <div className="red-card red-historico">
      <div className="red-card-top">
        <p className="caderno-note">
          <History className="mr-1 inline h-4 w-4" /> suas redações
        </p>
        <span className="red-melhor">melhor: <b>{melhor}</b></span>
      </div>
      <svg viewBox={`0 0 ${largura} ${altura}`} className="red-spark" role="img" aria-label={`Evolução das notas: ${pontos.join(", ")}`}>
        <line x1="0" x2={largura} y1={altura - 4 - 0.6 * (altura - 8)} y2={altura - 4 - 0.6 * (altura - 8)} className="red-spark-meta" />
        <path d={caminho} className="red-spark-linha" />
        {pontos.map((total, indice) => (
          <circle key={indice} r="3" cx={pontos.length === 1 ? largura / 2 : (indice / (pontos.length - 1)) * largura} cy={altura - 4 - (total / 1000) * (altura - 8)} />
        ))}
      </svg>
      <ul>
        {ultimas.map((item) => {
          const guardada = guardadas.find((salva) => salva.id === item.id);
          const total = (item.notas || []).reduce((soma, nota) => soma + nota, 0);
          return (
            <li key={item.id}>
              <button type="button" disabled={!guardada} onClick={() => guardada && onAbrir(guardada)} title={guardada ? "Abrir a correção" : "A correção completa ficou em outro aparelho"}>
                <span className="red-hist-tema">{item.tema || item.title}</span>
                <span className="red-hist-nota">{total}</span>
                <span className="red-hist-data">{new Date(item.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                {guardada ? <ChevronRight className="red-hist-abrir h-3.5 w-3.5" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
