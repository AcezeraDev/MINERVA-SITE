// Carregado sob demanda (React.lazy): a aba Redação, com correção da Mine nas 5 competências do ENEM.
//
// Nov/2026: a aba virou um mural de PROPOSTAS PRONTAS, no formato das
// coletâneas da prova (Texto I, II, III, enunciado e gênero), como na
// "Redação Paulista" da escola. Cada proposta guarda o próprio rascunho e a
// primeira entrega vale mais XP (até 70). O tema livre continua disponível.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  ArrowLeft,
  BookOpenText,
  Check,
  ChevronRight,
  FilePlus2,
  History,
  Lightbulb,
  ListChecks,
  Loader2,
  NotebookPen,
  PenLine,
  RotateCcw,
  Shuffle,
  Sparkles,
  Trash2,
  Trophy,
} from "lucide-react";
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
import { apoioDaProposta, elementosIntervencao, montarPropostaCriada, propostasRedacao, type PropostaRedacao, type TextoMotivador } from "../../shared/redacao-propostas.mjs";
import { redacaoPropostaXp, redacaoPropostaXpMax, redacaoXp, redacaoXpMax } from "../../shared/xp.mjs";
import { askMineTask } from "../mineTask";
import { usePreset } from "../chat/presets";
import "../cena3d/cena3d.css";
import "./redacao.css";
import "./redacao-mural.css";

type Rascunho = { temaId: string; temaLivre: string; titulo: string; texto: string };
type RascunhoProposta = { titulo: string; texto: string; atualizado: number };
type Guardada = { id: string; createdAt: number; tema: string; titulo: string; texto: string; correcao: Correcao; propostaId?: string };
type Tela = { tipo: "mural" } | { tipo: "proposta"; id: string } | { tipo: "livre" };
type Filtro = "todas" | "fazer" | "rascunho" | "entregues";

/** Mola das peças: passa um pouco do ponto e assenta. */
const molaPeca = { type: "spring", stiffness: 300, damping: 30, mass: 1 } as const;
const molaSolta = { type: "spring", stiffness: 300, damping: 22, mass: 1 } as const;
const ROMANOS = ["I", "II", "III", "IV", "V", "VI"];

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

function notaDe(session: Session) {
  return (session.notas || []).reduce((soma, nota) => soma + nota, 0);
}

export function RedacaoView({ data, user, update }: { data: ReturnType<typeof useMemoUserData>; user: User; update: (next: (draft: AppData) => AppData) => void }) {
  const reduced = useSoftMotion();
  const chaveRascunho = `minerva:redacao:${user.id}`;
  const chavePropostas = `minerva:redacao-propostas:${user.id}`;
  const chaveGuardadas = `minerva:redacoes:${user.id}`;
  const chaveCriadas = `minerva:redacao-criadas:${user.id}`;
  // "quero treinar uma redação sobre X" no chat abre o tema livre já escrito
  const preset = usePreset("redacao");
  const [tela, setTela] = useState<Tela>(() => (preset?.tema ? { tipo: "livre" } : { tipo: "mural" }));
  const [rascunho, setRascunho] = useState<Rascunho>(() => {
    const guardado = lerLocal(chaveRascunho, { temaId: temasRedacao[0].id, temaLivre: "", titulo: "", texto: "" });
    return preset?.tema ? { ...guardado, temaId: "livre", temaLivre: preset.tema } : guardado;
  });
  const [rascunhos, setRascunhos] = useState<Record<string, RascunhoProposta>>(() => lerLocal(chavePropostas, {}));
  // Propostas que a Mine montou a partir do tema digitado (ficam neste aparelho).
  const [criadas, setCriadas] = useState<PropostaRedacao[]>(() => lerLocal<PropostaRedacao[]>(chaveCriadas, []).filter((item) => item?.criada && Array.isArray(item.textos)));
  const [criando, setCriando] = useState(false);
  const [erroCriar, setErroCriar] = useState("");
  const criarRef = useRef<AbortController | null>(null);
  const [fase, setFase] = useState<"escrever" | "corrigindo" | "resultado">("escrever");
  const [resultado, setResultado] = useState<Guardada | null>(null);
  const [erro, setErro] = useState("");
  const [passo, setPasso] = useState(0);
  const notaRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => gravarLocal(chaveRascunho, rascunho), [chaveRascunho, rascunho]);
  useEffect(() => gravarLocal(chavePropostas, rascunhos), [chavePropostas, rascunhos]);
  useEffect(() => gravarLocal(chaveCriadas, criadas), [chaveCriadas, criadas]);
  useEffect(
    () => () => {
      abortRef.current?.abort();
      criarRef.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (fase !== "corrigindo") return;
    const timer = window.setInterval(() => setPasso((valor) => (valor + 1) % lendo.length), 2600);
    return () => window.clearInterval(timer);
  }, [fase]);

  const historico = useMemo(
    () => data.sessions.filter((item) => item.kind === "Redação").sort((a, b) => a.createdAt - b.createdAt),
    [data.sessions],
  );
  const guardadas = useMemo(() => lerLocal<Guardada[]>(chaveGuardadas, []), [chaveGuardadas, resultado]);
  const entregasPorProposta = useMemo(() => {
    const mapa = new Map<string, Session[]>();
    for (const item of historico) {
      const chave = item.propostaId || item.propostaCriadaId;
      if (!chave) continue;
      mapa.set(chave, [...(mapa.get(chave) || []), item]);
    }
    return mapa;
  }, [historico]);

  const todasPropostas = useMemo(() => [...propostasRedacao, ...criadas], [criadas]);
  const proposta = tela.tipo === "proposta" ? todasPropostas.find((item) => item.id === tela.id) : undefined;
  // Proposta criada vale o XP do tema livre: o servidor não tem como conferir
  // um texto que nasceu no aparelho, então ela não leva o bônus da primeira entrega.
  const propostaPronta = proposta && !proposta.criada ? proposta : undefined;
  const temaLivre = temasRedacao.find((item) => item.id === rascunho.temaId);
  const temaTexto = proposta ? proposta.titulo : rascunho.temaId === "livre" ? rascunho.temaLivre.trim() : temaLivre?.titulo || "";
  const folhaAtual = proposta ? rascunhos[proposta.id] || { titulo: "", texto: "", atualizado: 0 } : { titulo: rascunho.titulo, texto: rascunho.texto, atualizado: 0 };

  const mudarFolha = (parcial: { titulo?: string; texto?: string }) => {
    if (proposta) {
      setRascunhos((atual) => ({ ...atual, [proposta.id]: { ...(atual[proposta.id] || { titulo: "", texto: "" }), ...parcial, atualizado: Date.now() } }));
    } else setRascunho((atual) => ({ ...atual, ...parcial }));
  };

  const abrir = (proximo: Tela) => {
    setTela(proximo);
    setResultado(null);
    setFase("escrever");
    setErro("");
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  const corrigir = async () => {
    const texto = folhaAtual.texto.trim();
    if (!situacaoFolha(texto).ok || !temaTexto) return;
    setErro("");
    setFase("corrigindo");
    setPasso(0);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const titulo = folhaAtual.titulo.trim();
    const apoio = proposta ? apoioDaProposta(proposta) : rascunho.temaId === "livre" ? [] : temaLivre?.apoio || [];
    try {
      const resposta = await askMineTask(
        { task: "redacao", prompt: texto, context: contextoCorrecao({ tema: temaTexto, apoio, titulo, texto }), outputTokens: 2600 },
        { signal: controller.signal, timeoutMs: 120_000 },
      );
      const correcao = lerCorrecao(resposta, texto);
      if (!correcao) throw new Error("A correção veio incompleta. Tente de novo.");
      const guardada: Guardada = { id: uid("redacao"), createdAt: Date.now(), tema: temaTexto, titulo, texto, correcao, propostaId: proposta?.id };
      // Proposta pronta vale mais só na primeira entrega (o servidor confere).
      const primeira = propostaPronta && !entregasPorProposta.has(propostaPronta.id);
      const xp = primeira ? redacaoPropostaXp(correcao.total) : redacaoXp(correcao.total);
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
        ...(propostaPronta ? { propostaId: propostaPronta.id } : proposta ? { propostaCriadaId: proposta.id } : {}),
      };
      update((draft) => ({ ...draft, sessions: [...draft.sessions, session] }));
      gravarLocal(chaveGuardadas, [guardada, ...lerLocal<Guardada[]>(chaveGuardadas, [])].slice(0, 30));
      setResultado(guardada);
      setFase("resultado");
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      window.setTimeout(() => {
        floatXp(`+${xp} XP`, notaRef.current);
        if (correcao.total >= 700) celebrateFrom(notaRef.current, { count: 40 });
      }, reduced ? 50 : 900);
      mineSays(correcao.total >= 800 ? `${correcao.total}? Que redação!` : primeira ? "Proposta entregue! XP em dobro." : "Corrigida! Olha os grifos.", correcao.total >= 700 ? "wow" : "happy");
    } catch (error) {
      if (controller.signal.aborted) return;
      setErro(error instanceof Error ? error.message : "A Mine não conseguiu corrigir agora.");
      setFase("escrever");
    }
  };

  const criarProposta = async (tema: string) => {
    const pedido = tema.trim();
    if (pedido.length < 4 || criando) return;
    setErroCriar("");
    setCriando(true);
    criarRef.current?.abort();
    const controller = new AbortController();
    criarRef.current = controller;
    try {
      const resposta = await askMineTask(
        { task: "redacao-proposta", prompt: `Monte uma proposta de redação modelo ENEM sobre este tema: ${pedido}`, context: "", outputTokens: 2200 },
        { signal: controller.signal, timeoutMs: 120_000 },
      );
      const numero = propostasRedacao.length + criadas.length + 1;
      const nova = montarPropostaCriada(resposta, { temaDigitado: pedido, id: uid("criada"), numero });
      if (!nova) throw new Error("A Mine não conseguiu montar a proposta. Tente de novo ou escreva o tema de outro jeito.");
      setCriadas((atual) => [...atual, nova]);
      mineSays("Proposta pronta! Lê os textos antes de escrever.", "happy");
      abrir({ tipo: "proposta", id: nova.id });
    } catch (error) {
      if (controller.signal.aborted) return;
      setErroCriar(error instanceof Error ? error.message : "A Mine não conseguiu montar a proposta agora.");
    } finally {
      if (criarRef.current === controller) setCriando(false);
    }
  };

  const apagarCriada = (id: string) => {
    setCriadas((atual) => atual.filter((item) => item.id !== id));
    setRascunhos((atual) => {
      const resto = { ...atual };
      delete resto[id];
      return resto;
    });
    abrir({ tipo: "mural" });
  };

  const reabrir = (item: Guardada) => {
    setTela(item.propostaId ? { tipo: "proposta", id: item.propostaId } : { tipo: "livre" });
    setResultado(item);
    setFase("resultado");
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  const folha = (
    <Folha
      tema={temaTexto}
      titulo={folhaAtual.titulo}
      texto={folhaAtual.texto}
      cor={proposta?.cor}
      xpMax={propostaPronta && !entregasPorProposta.has(propostaPronta.id) ? redacaoPropostaXpMax : redacaoXpMax}
      corrigindo={fase === "corrigindo"}
      erro={erro}
      onMudar={mudarFolha}
      onCorrigir={corrigir}
    />
  );

  return (
    <div className="red-page">
      {tela.tipo === "mural" ? (
        <PageHeader
          eyebrow="Redação · ENEM"
          title="Redação com a Mine"
          subtitle="Propostas prontas no formato da prova, com textos motivadores. Escreva na folha pautada e a Mine corrige nas cinco competências, com grifos no seu texto."
        />
      ) : (
        <nav className="rdm-trilha" aria-label="Caminho">
          <button type="button" onClick={() => abrir({ tipo: "mural" })}>
            <ArrowLeft className="h-4 w-4" /> Redação
          </button>
          <span aria-hidden>/</span>
          <span>{proposta ? `${proposta.criada ? "Sua proposta" : "Proposta"} ${String(proposta.numero).padStart(2, "0")}` : "Tema livre"}</span>
          {proposta?.criada && fase !== "resultado" ? (
            <button
              type="button"
              className="red-link rdm-trilha-acao"
              onClick={() => {
                if (window.confirm("Apagar esta proposta? O rascunho dela também sai.")) apagarCriada(proposta.id);
              }}
            >
              <Trash2 className="h-4 w-4" /> apagar proposta
            </button>
          ) : null}
          {fase === "resultado" ? (
            <button
              type="button"
              className="red-btn caderno-btn-pen rdm-trilha-acao"
              onClick={() => {
                mudarFolha({ titulo: "", texto: "" });
                setResultado(null);
                setFase("escrever");
              }}
            >
              <FilePlus2 className="h-4 w-4" /> Escrever de novo
            </button>
          ) : null}
        </nav>
      )}

      {fase === "resultado" && resultado ? (
        <motion.div key={`resultado-${resultado.id}`} initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Resultado
            guardada={resultado}
            notaRef={notaRef}
            onReescrever={() => {
              mudarFolha({ texto: resultado.texto, titulo: resultado.titulo });
              setFase("escrever");
            }}
          />
        </motion.div>
      ) : tela.tipo === "mural" ? (
        <Mural
          historico={historico}
          guardadas={guardadas}
          rascunhos={rascunhos}
          criadas={criadas}
          entregas={entregasPorProposta}
          criando={criando}
          erroCriar={erroCriar}
          onCriar={criarProposta}
          onAbrir={(id) => abrir({ tipo: "proposta", id })}
          onLivre={() => abrir({ tipo: "livre" })}
          onReabrir={reabrir}
        />
      ) : proposta ? (
        <motion.div key={`proposta-${proposta.id}`} className="rdm-coletanea" initial={reduced ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={molaPeca}>
          <Coletanea proposta={proposta} entregas={entregasPorProposta.get(proposta.id) || []} folha={folha} />
        </motion.div>
      ) : (
        <motion.div key="livre" className="red-grid" initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <aside className="red-aside">
            <div className="red-card">
              <div className="red-card-top">
                <p className="caderno-note">treino rápido</p>
                <button
                  type="button"
                  className="red-link"
                  onClick={() => {
                    const outros = temasRedacao.filter((item) => item.id !== rascunho.temaId);
                    setRascunho((atual) => ({ ...atual, temaId: outros[Math.floor(Math.random() * outros.length)].id }));
                  }}
                >
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
                    onClick={() => setRascunho((atual) => ({ ...atual, temaId: item.id }))}
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
                  onClick={() => setRascunho((atual) => ({ ...atual, temaId: "livre" }))}
                >
                  ✏️ Tema livre (o da sua professora, por exemplo)
                </button>
              </div>
              {rascunho.temaId === "livre" ? (
                <input
                  className="red-input"
                  value={rascunho.temaLivre}
                  onChange={(event) => setRascunho((atual) => ({ ...atual, temaLivre: event.target.value.slice(0, 200) }))}
                  placeholder="Escreva o tema da proposta"
                  aria-label="Tema livre"
                />
              ) : temaLivre ? (
                <div className="red-apoio">
                  <p className="red-apoio-label">
                    <BookOpenText className="h-4 w-4" /> textos motivadores
                  </p>
                  {temaLivre.apoio.map((linha) => (
                    <p key={linha}>{linha}</p>
                  ))}
                </div>
              ) : null}
            </div>
            <GuiaCompetencias />
          </aside>
          {folha}
        </motion.div>
      )}

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

// ---------------------------------------------------------------------------
// Mural de propostas

function Mural({
  historico,
  guardadas,
  rascunhos,
  criadas,
  entregas,
  criando,
  erroCriar,
  onCriar,
  onAbrir,
  onLivre,
  onReabrir,
}: {
  historico: Session[];
  guardadas: Guardada[];
  rascunhos: Record<string, RascunhoProposta>;
  criadas: PropostaRedacao[];
  entregas: Map<string, Session[]>;
  criando: boolean;
  erroCriar: string;
  onCriar: (tema: string) => void;
  onAbrir: (id: string) => void;
  onLivre: () => void;
  onReabrir: (item: Guardada) => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const estado = (id: string) => (entregas.has(id) ? "entregue" : rascunhos[id]?.texto?.trim() ? "rascunho" : "fazer");
  const [temaNovo, setTemaNovo] = useState("");
  const lista = [...propostasRedacao, ...criadas].filter((item) => {
    const atual = estado(item.id);
    return filtro === "todas" || (filtro === "fazer" && atual === "fazer") || (filtro === "rascunho" && atual === "rascunho") || (filtro === "entregues" && atual === "entregue");
  });
  const entregues = propostasRedacao.filter((item) => entregas.has(item.id)).length;
  const melhor = historico.length ? Math.max(...historico.map(notaDe)) : 0;
  const xpPropostas = historico.filter((item) => item.propostaId).reduce((soma, item) => soma + (item.xpEarned || 0), 0);
  const contagem: Record<Filtro, number> = {
    todas: propostasRedacao.length,
    fazer: propostasRedacao.filter((item) => estado(item.id) === "fazer").length,
    rascunho: propostasRedacao.filter((item) => estado(item.id) === "rascunho").length,
    entregues,
  };

  return (
    <div className="rdm-mural">
      <section className="rdm-placar" aria-label="Seu progresso nas propostas">
        <div className="rdm-placar-item">
          <span className="rdm-anel" style={{ "--rdm-p": entregues / propostasRedacao.length } as React.CSSProperties} aria-hidden>
            <span>{entregues}</span>
          </span>
          <span>
            <b>de {propostasRedacao.length} propostas</b>
            <small>entregues</small>
          </span>
        </div>
        <div className="rdm-placar-item">
          <Trophy className="rdm-placar-icone" aria-hidden />
          <span>
            <b>{melhor || "—"}</b>
            <small>melhor nota</small>
          </span>
        </div>
        <div className="rdm-placar-item">
          <Sparkles className="rdm-placar-icone" aria-hidden />
          <span>
            <b>{xpPropostas} XP</b>
            <small>ganhos com propostas</small>
          </span>
        </div>
        <p className="rdm-placar-dica">
          <span className="caderno-note">vale mais!</span> A primeira entrega de cada proposta rende até <b>{redacaoPropostaXpMax} XP</b> (tema livre: {redacaoXpMax}).
        </p>
      </section>

      <div className="rdm-filtros" role="tablist" aria-label="Filtrar propostas">
        {(
          [
            ["todas", "Todas"],
            ["fazer", "A fazer"],
            ["rascunho", "Rascunho"],
            ["entregues", "Entregues"],
          ] as Array<[Filtro, string]>
        ).map(([id, nome]) => (
          <button key={id} type="button" role="tab" aria-selected={filtro === id} className={filtro === id ? "is-on" : ""} onClick={() => setFiltro(id)}>
            {filtro === id ? <motion.span layoutId="rdm-filtro" className="rdm-filtro-grifo" transition={molaPeca} /> : null}
            <span className="relative">
              {nome} <small>{contagem[id]}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="rdm-grade">
        {lista.map((item, indice) => (
          <CartaoProposta key={item.id} proposta={item} indice={indice} estado={estado(item.id)} entregas={entregas.get(item.id) || []} rascunho={rascunhos[item.id]} onAbrir={() => onAbrir(item.id)} />
        ))}
        {filtro === "todas" || filtro === "fazer" ? (
          <motion.form
            className="rdm-cartao rdm-cartao-livre rdm-cartao-criar"
            onSubmit={(event) => {
              event.preventDefault();
              onCriar(temaNovo);
            }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...molaSolta, delay: Math.min(0.5, lista.length * 0.04) }}
            aria-busy={criando}
          >
            <NotebookPen className="rdm-livre-icone" aria-hidden />
            <span className="rdm-cartao-titulo">Crie sua proposta</span>
            <span className="rdm-cartao-texto">Digite o tema (o que a professora passou, por exemplo) e a Mine monta a coletânea igual às outras.</span>
            <label className="sr-only" htmlFor="rdm-tema-novo">
              Tema da proposta
            </label>
            <textarea
              id="rdm-tema-novo"
              className="rdm-criar-campo"
              value={temaNovo}
              onChange={(event) => setTemaNovo(event.target.value.slice(0, 200))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onCriar(temaNovo);
                }
              }}
              placeholder="Ex.: o uso do celular nas escolas"
              rows={2}
              disabled={criando}
            />
            {erroCriar ? (
              <span className="rdm-criar-erro" role="alert">
                {erroCriar}
              </span>
            ) : null}
            <span className="rdm-cartao-rodape">
              <span className="rdm-xp is-livre">até {redacaoXpMax} XP</span>
              <button type="submit" className="red-btn caderno-btn-pen rdm-criar-btn" disabled={criando || temaNovo.trim().length < 4}>
                {criando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> montando…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Criar proposta
                  </>
                )}
              </button>
            </span>
            <button type="button" className="red-link rdm-criar-treino" onClick={onLivre} disabled={criando}>
              ou treino rápido, sem textos motivadores
            </button>
          </motion.form>
        ) : null}
        {!lista.length ? <p className="rdm-vazio">Nenhuma proposta aqui ainda. Que tal começar uma?</p> : null}
      </div>

      <div className="rdm-rodape-grade">
        {historico.length ? <Historico historico={historico} guardadas={guardadas} onAbrir={onReabrir} /> : null}
        <GuiaCompetencias />
      </div>
    </div>
  );
}

/** Cartão da proposta: inclina com o mouse (mola) e mostra o status como na escola. */
function CartaoProposta({
  proposta,
  indice,
  estado,
  entregas,
  rascunho,
  onAbrir,
}: {
  proposta: PropostaRedacao;
  indice: number;
  estado: "fazer" | "rascunho" | "entregue";
  entregas: Session[];
  rascunho?: RascunhoProposta;
  onAbrir: () => void;
}) {
  const reduced = useSoftMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]), { stiffness: 300, damping: 30, mass: 1 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 300, damping: 30, mass: 1 });
  const melhor = entregas.length ? Math.max(...entregas.map(notaDe)) : 0;
  const palavras = rascunho ? contarPalavras(rascunho.texto) : 0;

  return (
    <motion.button
      type="button"
      className={`rdm-cartao is-${estado}`}
      style={{ "--rdm-cor": proposta.cor, rotateX: reduced ? 0 : rotateX, rotateY: reduced ? 0 : rotateY } as React.CSSProperties & Record<string, unknown>}
      onPointerMove={(event) => {
        if (reduced || event.pointerType !== "mouse") return;
        const caixa = event.currentTarget.getBoundingClientRect();
        x.set((event.clientX - caixa.left) / caixa.width - 0.5);
        y.set((event.clientY - caixa.top) / caixa.height - 0.5);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      onClick={onAbrir}
      initial={reduced ? false : { opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduced ? undefined : { y: -6 }}
      whileTap={{ scale: 0.98 }}
      transition={{ ...molaSolta, delay: Math.min(0.5, indice * 0.04) }}
      aria-label={`Proposta ${proposta.numero}: ${proposta.titulo}. ${estado === "entregue" ? `Entregue, melhor nota ${melhor}` : estado === "rascunho" ? "Rascunho começado" : "A fazer"}`}
    >
      <span className="rdm-cartao-faixa">
        <span className="rdm-eixo">{proposta.eixo}</span>
        <span className={`rdm-status is-${estado}`}>{estado === "entregue" ? `Nota ${melhor}` : estado === "rascunho" ? "Rascunho" : "A fazer"}</span>
      </span>
      <span className="rdm-cartao-num">
        {proposta.criada ? "Sua proposta" : "Proposta"} {String(proposta.numero).padStart(2, "0")}
      </span>
      <span className="rdm-cartao-titulo">{proposta.titulo}</span>
      <span className="rdm-cartao-textos" aria-hidden>
        {proposta.textos.map((texto, posicao) => (
          <span key={posicao} title={`Texto ${ROMANOS[posicao]}`}>
            {ROMANOS[posicao]}
          </span>
        ))}
        <small>textos motivadores</small>
      </span>
      <span className="rdm-cartao-rodape">
        {estado === "entregue" ? (
          <span className="rdm-xp is-ganho">
            <Check className="h-3.5 w-3.5" /> XP garantido
          </span>
        ) : (
          <span className="rdm-xp">até {proposta.criada ? redacaoXpMax : redacaoPropostaXpMax} XP</span>
        )}
        {estado === "rascunho" ? <span className="rdm-palavras">{palavras} palavras</span> : null}
        <ChevronRight className="h-4 w-4" aria-hidden />
      </span>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Coletânea: textos motivadores + folha

function Coletanea({ proposta, entregas, folha }: { proposta: PropostaRedacao; entregas: Session[]; folha: React.ReactNode }) {
  const [aba, setAba] = useState<"textos" | "folha">("textos");
  const melhor = entregas.length ? Math.max(...entregas.map(notaDe)) : 0;
  return (
    <>
      <div className="rdm-abas" role="tablist" aria-label="Coletânea ou folha">
        {(
          [
            ["textos", "Textos motivadores"],
            ["folha", "Escrever"],
          ] as const
        ).map(([id, nome]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} className={aba === id ? "is-on" : ""} onClick={() => setAba(id)}>
            {aba === id ? <motion.span layoutId="rdm-aba" className="rdm-filtro-grifo" transition={molaPeca} /> : null}
            <span className="relative">{nome}</span>
          </button>
        ))}
      </div>
      <div className="rdm-coletanea-grade" data-aba={aba}>
        <article className="rdm-textos" style={{ "--rdm-cor": proposta.cor } as React.CSSProperties}>
          <header className="rdm-cabeca">
            <span className="rdm-cabeca-num">
              {proposta.criada ? "Sua proposta" : "Proposta"} {String(proposta.numero).padStart(2, "0")} · {proposta.eixo}
            </span>
            {proposta.criada && proposta.temaDigitado ? <span className="rdm-cabeca-pedido">criada pela Mine a partir de “{proposta.temaDigitado}”</span> : null}
            <h2>{proposta.titulo}</h2>
            {melhor ? (
              <span className="rdm-cabeca-feito">
                <Check className="h-4 w-4" /> Você já entregou esta proposta · melhor nota <b>{melhor}</b>
              </span>
            ) : null}
          </header>
          {proposta.textos.map((texto, indice) => (
            <TextoMotivadorView key={indice} texto={texto} rotulo={`Texto ${ROMANOS[indice]}`} indice={indice} />
          ))}
          <motion.section className="rdm-enunciado" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={molaPeca}>
            <span className="rdm-enunciado-rotulo">Enunciado</span>
            <p>{realcarTema(proposta.enunciado, proposta.titulo)}</p>
          </motion.section>
          <Repertorio itens={proposta.repertorio} />
          <p className="rdm-genero">
            <b>Gênero textual:</b> {proposta.genero}
          </p>
        </article>
        <div className="rdm-folha-col">{folha}</div>
      </div>
    </>
  );
}

function realcarTema(enunciado: string, tema: string) {
  const [antes, depois] = enunciado.split(`“${tema}”`);
  if (depois === undefined) return enunciado;
  return (
    <>
      {antes}
      <strong>“{tema}”</strong>
      {depois}
    </>
  );
}

function TextoMotivadorView({ texto, rotulo, indice }: { texto: TextoMotivador; rotulo: string; indice: number }) {
  const reduced = useSoftMotion();
  return (
    <motion.section
      className={`rdm-texto is-${texto.tipo}`}
      initial={reduced ? false : { opacity: 0, y: 24, rotateX: -8 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ ...molaPeca, delay: indice * 0.04 }}
    >
      <p className="rdm-texto-rotulo">{rotulo}</p>
      {texto.tipo === "tabela" ? (
        <div className="rdm-tabela" role="region" aria-label={texto.titulo} tabIndex={0}>
          <table>
            <caption>{texto.titulo}</caption>
            <thead>
              <tr>
                {texto.colunas.map((coluna) => (
                  <th key={coluna}>{coluna}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {texto.linhas.map((linha, posicao) => (
                <tr key={posicao}>
                  {linha.map((celula, coluna) => (
                    <td key={coluna}>{celula}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : texto.tipo === "lista" ? (
        <>
          <p className="rdm-texto-titulo">{texto.titulo}</p>
          <ul className="rdm-lista">
            {texto.itens.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : (
        <>
          {texto.titulo ? <p className="rdm-texto-titulo">{texto.titulo}</p> : null}
          <div className={texto.tipo === "lei" ? "rdm-lei" : "rdm-corpo"}>
            {texto.corpo.map((paragrafo) => (
              <p key={paragrafo}>{paragrafo}</p>
            ))}
          </div>
        </>
      )}
      <p className="rdm-fonte">{texto.fonte}</p>
    </motion.section>
  );
}

/** Repertório como cartas: vira a carta para ver a dica de uso. */
function Repertorio({ itens }: { itens: string[] }) {
  const [abertas, setAbertas] = useState<number[]>([]);
  return (
    <section className="rdm-repertorio" aria-label="Repertório que combina">
      <p className="rdm-repertorio-titulo">
        <Lightbulb className="h-4 w-4" /> Repertório que combina <small>toque para virar</small>
      </p>
      <div className="rdm-cartas">
        {itens.map((item, indice) => {
          const aberta = abertas.includes(indice);
          return (
            <button
              key={item}
              type="button"
              className="rdm-carta-cena"
              aria-pressed={aberta}
              onClick={() => setAbertas((lista) => (aberta ? lista.filter((valor) => valor !== indice) : [...lista, indice]))}
            >
              <motion.span className="rdm-carta" animate={{ rotateY: aberta ? 180 : 0 }} transition={molaPeca}>
                <span className="rdm-carta-face is-frente">
                  <span className="caderno-note">carta {indice + 1}</span>
                  <span className="rdm-carta-pista">?</span>
                </span>
                <span className="rdm-carta-face is-verso">{item}</span>
              </motion.span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Folha pautada + checklist da estrutura

function Folha({
  tema,
  titulo,
  texto,
  cor,
  xpMax,
  corrigindo,
  erro,
  onMudar,
  onCorrigir,
}: {
  tema: string;
  titulo: string;
  texto: string;
  cor?: string;
  xpMax: number;
  corrigindo: boolean;
  erro: string;
  onMudar: (parcial: { titulo?: string; texto?: string }) => void;
  onCorrigir: () => void;
}) {
  const folha = situacaoFolha(texto);
  const palavras = contarPalavras(texto);
  const paragrafos = contarParagrafos(texto);
  const intervencao = elementosIntervencao(texto);
  const checklist = [
    { ok: paragrafos >= 1, rotulo: "Introdução com tese" },
    { ok: paragrafos >= 3, rotulo: "Dois parágrafos de desenvolvimento" },
    { ok: paragrafos >= 4, rotulo: "Conclusão" },
    { ok: folha.linhas >= 7 && folha.linhas <= 30, rotulo: "Entre 7 e 30 linhas" },
  ];
  const elementos: Array<[keyof typeof intervencao, string]> = [
    ["agente", "quem"],
    ["acao", "o quê"],
    ["meio", "como"],
    ["finalidade", "para quê"],
    ["detalhamento", "detalhe"],
  ];

  return (
    <section className="red-folha-wrap" aria-label="Folha de redação" style={cor ? ({ "--rdm-cor": cor } as React.CSSProperties) : undefined}>
      <div className="red-folha">
        <p className="red-folha-tema">
          <span className="caderno-note">proposta</span> {tema || "escolha ou escreva um tema"}
        </p>
        <input className="red-titulo" value={titulo} onChange={(event) => onMudar({ titulo: event.target.value.slice(0, 120) })} placeholder="Título (opcional)" aria-label="Título da redação" />
        <textarea
          className="red-texto"
          value={texto}
          onChange={(event) => onMudar({ texto: event.target.value.slice(0, 6000) })}
          placeholder={"Comece pela introdução: apresente o tema e a sua tese.\n\nDepois, dois parágrafos de desenvolvimento com argumentos e repertório.\n\nNa conclusão, a proposta de intervenção: quem faz, o quê, como, para quê e um detalhe."}
          aria-label="Texto da redação"
          spellCheck
        />
      </div>

      <div className="rdm-checklist" aria-label="Estrutura da redação">
        <p className="rdm-checklist-titulo">
          <ListChecks className="h-4 w-4" /> Estrutura
        </p>
        <ul>
          {checklist.map((item) => (
            <li key={item.rotulo} className={item.ok ? "is-ok" : ""}>
              <motion.span className="rdm-check" animate={{ scale: item.ok ? [1.35, 1] : 1 }} transition={molaSolta} aria-hidden>
                {item.ok ? <Check className="h-3 w-3" /> : null}
              </motion.span>
              {item.rotulo}
            </li>
          ))}
        </ul>
        <p className="rdm-checklist-titulo">Proposta de intervenção (último parágrafo)</p>
        <div className="rdm-intervencao">
          {elementos.map(([chave, nome]) => (
            <motion.span key={chave} className={`rdm-elemento ${intervencao[chave] ? "is-ok" : ""}`} animate={{ y: intervencao[chave] ? [-4, 0] : 0 }} transition={molaSolta}>
              {intervencao[chave] ? <Check className="h-3 w-3" aria-hidden /> : null}
              {nome}
            </motion.span>
          ))}
        </div>
        <p className="rdm-checklist-nota">Pistas automáticas para você conferir; a nota de verdade vem da Mine.</p>
      </div>

      <div className="red-rodape">
        <div className="red-contadores" aria-live="polite">
          <span>
            <strong>{palavras}</strong> palavras
          </span>
          <span>
            <strong>{paragrafos}</strong> {paragrafos === 1 ? "parágrafo" : "parágrafos"}
          </span>
          <span className="red-linhas" title="Linhas estimadas na folha oficial do ENEM (cerca de 75 letras por linha)">
            <strong>{folha.linhas}</strong>/30 linhas
            <span className="red-linhas-bar" aria-hidden>
              <span style={{ transform: `scaleX(${Math.min(1, folha.linhas / 30)})` }} className={folha.linhas >= 7 && folha.linhas <= 30 ? "is-ok" : ""} />
            </span>
          </span>
        </div>
        {folha.aviso ? <p className="red-aviso">{folha.aviso}</p> : null}
        {erro ? (
          <p className="red-erro" role="alert">
            {erro}
          </p>
        ) : null}
        <button type="button" className="red-btn caderno-btn-pen red-corrigir" disabled={!folha.ok || !tema || corrigindo} onClick={onCorrigir}>
          <PenLine className="h-4 w-4" /> Entregar para a Mine corrigir <span className="rdm-btn-xp">até {xpMax} XP</span>
        </button>
      </div>
    </section>
  );
}

function GuiaCompetencias() {
  return (
    <details className="red-card red-comp-guia">
      <summary>
        <Lightbulb className="h-4 w-4" /> O que a Mine avalia
      </summary>
      <ol>
        {competencias.map((item) => (
          <li key={item.id}>
            <strong>
              C{item.id} · {item.curta}
            </strong>
            <span>{item.texto}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Resultado da correção e histórico (sem mudanças de comportamento)

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
              <Sparkles className="h-4 w-4" />{" "}
              <span>
                <b>Próximo passo:</b> {correcao.proximoPasso}
              </span>
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
              <span className="red-comp-nota">
                {item.nota}
                <small>/200</small>
              </span>
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
            <span>
              <mark className="red-mark is-erro">rosa</mark> para melhorar
            </span>
            <span>
              <mark className="red-mark is-acerto">verde</mark> mandou bem
            </span>
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
              <p className="caderno-note">
                C{trecho.competencia} · {trecho.tipo === "erro" ? "pode melhorar" : "mandou bem"}
              </p>
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
                  <span>
                    {(ativo ?? 0) + 1}/{correcao.trechos.length}
                  </span>
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
  const totais = historico.map(notaDe);
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
        <span className="red-melhor">
          melhor: <b>{melhor}</b>
        </span>
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
          return (
            <li key={item.id}>
              <button type="button" disabled={!guardada} onClick={() => guardada && onAbrir(guardada)} title={guardada ? "Abrir a correção" : "A correção completa ficou em outro aparelho"}>
                <span className="red-hist-tema">{item.tema || item.title}</span>
                <span className="red-hist-nota">{notaDe(item)}</span>
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
