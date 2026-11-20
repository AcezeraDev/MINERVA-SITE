// Carregado sob demanda (React.lazy): a aba Atividades, tarefas no formato da rede estadual geradas pela Mine.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, Reorder, useDragControls } from "framer-motion";
import { ArrowDown, ArrowUp, BookMarked, Check, ChevronDown, ChevronRight, ClipboardList, Eraser, Flame, GripVertical, Loader2, Save, Send, Sparkles, Star, Target, Wand2, X } from "lucide-react";
import { PageHeader, uid, type Session, type User, type useMemoUserData, type AppData } from "../main";
import { useSoftMotion } from "../motion";
import { celebrateFrom, floatXp, mineSays } from "../caderno";
import { CenaPrancheta } from "../cena3d/Cena3D";
import { usePreset } from "../chat/presets";
import {
  assuntosSugeridos,
  atividadesExemplo,
  contextoAtividade,
  corrigirObjetiva,
  embaralhar,
  lerAtividade,
  lerCorrecaoDissertativa,
  lerNumero,
  materias,
  pontosPorQuestao,
  pontuar,
  respondida,
  secoes,
  series,
  type Atividade,
  type CorrecaoDissertativa,
  type Questao,
  type QuestaoCategorias,
  type QuestaoDissertativa,
  type QuestaoLacunas,
  type QuestaoLigar,
  type QuestaoMultipla,
  type QuestaoNumerica,
  type QuestaoOrdenar,
  type QuestaoSequencia,
  type QuestaoVF,
} from "../../shared/atividades.mjs";
import { atividadeXp } from "../../shared/xp.mjs";
import { askMineTask } from "../mineTask";
import "../cena3d/cena3d.css";
import "./atividades.css";
import "./missao.css";

/** O que o aluno fez em cada questão; o formato de cada tipo está em shared/atividades.mjs. */
type Resposta = unknown;

type EmAndamento = {
  id: string;
  materia: string;
  serie: string;
  atividade: Atividade;
  respostas: Resposta[];
  correcoes: Record<number, CorrecaoDissertativa | undefined>;
  tentativas: Record<number, number>;
  semente: number;
  finalizada?: { pontos: number; maximo: number; acertos: number; xp: number };
  /** Modo missão (nov/2026): questão aberta, questões já conferidas e sequência de acertos. */
  atual?: number;
  conferidas?: number[];
  combo?: number;
  melhorCombo?: number;
};

/** O que fazer em cada tipo, dito em uma linha na barra de baixo. */
const instrucoes: Record<string, string> = {
  ordenar: "Toque nas palavras na ordem certa para montar a frase.",
  lacunas: "Escolha a palavra que completa cada lacuna.",
  vf: "Marque verdadeiro ou falso em cada carta.",
  multipla: "Escolha uma alternativa.",
  ligar: "Ligue cada item da esquerda ao par da direita.",
  categorias: "Leve cada item para a caixa certa.",
  sequencia: "Coloque as etapas na ordem certa.",
  numerica: "Faça a conta e digite o resultado.",
  dissertativa: "Escreva sua resposta; a Mine lê e dá a nota.",
};

/** Mola padrão das peças: passa um pouco do ponto e assenta. */
const molaPeca = { type: "spring", stiffness: 300, damping: 30, mass: 1 } as const;
const molaSolta = { type: "spring", stiffness: 300, damping: 22, mass: 1 } as const;

const tentativasAssistente = 2;
const letras = ["A", "B", "C", "D", "E"];
const tons = ["mint", "lilac", "yellow", "pink", "pen", "mint"];
const gerando = ["Escolhendo o assunto…", "Escrevendo os textos-base…", "Embaralhando as peças…", "Montando as alternativas…", "Conferindo o gabarito…", "Grampeando a folha…"];
const tiposLegenda = [
  ["🧩", "ordenar palavras"],
  ["🃏", "cartas V ou F"],
  ["🔗", "ligar colunas"],
  ["📦", "arrastar para caixas"],
  ["⏳", "linha do tempo"],
  ["🔢", "conta com número"],
  ["🅰️", "alternativas"],
  ["✍️", "resposta escrita"],
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
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem armazenamento local o rascunho vale só enquanto a aba está aberta.
  }
}

/** Ordenar guarda posições; a correção compara palavras. */
function paraCorrecao(questao: Questao, resposta: Resposta) {
  if (questao.tipo === "ordenar") return Array.isArray(resposta) ? resposta.map((indice) => questao.palavras[indice as number]) : [];
  return resposta;
}

function dois(numero: number) {
  return String(numero).padStart(2, "0");
}

export function AtividadesView({ data, user, update }: { data: ReturnType<typeof useMemoUserData>; user: User; update: (next: (draft: AppData) => AppData) => void }) {
  const reduced = useSoftMotion();
  const chave = `minerva:atividade:${user.id}`;
  const [atual, setAtual] = useState<EmAndamento | null>(() => lerLocal<EmAndamento | null>(chave, null));
  const [aberta, setAberta] = useState(false);
  // Pedido feito no chat da Mine ("faz uma atividade disso") já vem preenchido.
  const preset = usePreset("atividades");
  const [materia, setMateria] = useState(() => materias.find((item) => item === preset?.materia) || materias[0]);
  const [serie, setSerie] = useState("1ª série EM");
  const [assunto, setAssunto] = useState(() => (preset?.assunto || "").slice(0, 120));
  const [carregando, setCarregando] = useState(false);
  const [passo, setPasso] = useState(0);
  const [erro, setErro] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (!carregando) return;
    const timer = window.setInterval(() => setPasso((valor) => (valor + 1) % gerando.length), 2800);
    return () => window.clearInterval(timer);
  }, [carregando]);

  const historico = useMemo(
    () => data.sessions.filter((item) => item.kind === "Atividade").sort((a, b) => b.createdAt - a.createdAt).slice(0, 8),
    [data.sessions],
  );

  const iniciar = (atividade: Atividade, materiaEscolhida: string, serieEscolhida: string) => {
    const nova: EmAndamento = {
      id: uid("atividade"),
      materia: materiaEscolhida,
      serie: serieEscolhida,
      atividade,
      respostas: atividade.questoes.map(() => undefined),
      correcoes: {},
      tentativas: {},
      semente: Math.floor(Math.random() * 1e9) + 1,
    };
    setAtual(nova);
    gravarLocal(chave, nova);
    setAberta(true);
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  const gerar = async () => {
    setErro("");
    setCarregando(true);
    setPasso(0);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const resposta = await askMineTask(
        {
          task: "atividade",
          prompt: `Crie a atividade de ${materia} para o ${serie}${assunto.trim() ? ` sobre ${assunto.trim()}` : ""}.`,
          context: contextoAtividade({ materia, serie, assunto: assunto.trim() }),
          outputTokens: 4200,
        },
        { signal: controller.signal, timeoutMs: 200_000 },
      );
      const atividade = lerAtividade(resposta);
      if (!atividade) throw new Error("A atividade veio incompleta. Tente gerar de novo.");
      iniciar(atividade, materia, serie);
      mineSays("Atividade fresquinha na mesa!", "happy");
    } catch (error) {
      if (!controller.signal.aborted) setErro(error instanceof Error ? error.message : "A Mine não conseguiu criar a atividade agora.");
    } finally {
      setCarregando(false);
    }
  };

  if (atual && aberta) {
    return (
      <Missao
        key={atual.id}
        inicial={atual}
        user={user}
        onSalvar={(estado) => {
          setAtual(estado);
          gravarLocal(chave, estado);
        }}
        onVoltar={() => setAberta(false)}
        onFinalizar={(estado, session) => {
          setAtual(estado);
          gravarLocal(chave, estado);
          update((draft) => ({ ...draft, sessions: [...draft.sessions, session] }));
        }}
        onDescartar={() => {
          setAtual(null);
          gravarLocal(chave, null);
          setAberta(false);
        }}
      />
    );
  }

  return (
    <div className="atv-page">
      <PageHeader
        eyebrow="Atividades · tarefa"
        title="Atividades da Mine"
        subtitle="Cada tarefa vira uma missão: uma questão por vez, de mexer (arrastar, ligar, virar cartas, montar frases), conferida na hora, com sequência de acertos, XP subindo e estrelas no final."
      />

      <section className="atv-hero">
        {!carregando ? <CenaPrancheta modo="parada" className="atv-hero-cena" /> : <div className="atv-hero-cena" />}
        <div className="atv-hero-texto">
          <p className="caderno-note">o que tem na folha</p>
          <ul className="atv-tipos">
            {tiposLegenda.map(([emoji, nome], indice) => (
              <motion.li key={nome} initial={reduced ? false : { opacity: 0, y: 14, rotateX: -50 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ ...molaSolta, delay: 0.15 + indice * 0.05 }}>
                <span aria-hidden>{emoji}</span> {nome}
              </motion.li>
            ))}
          </ul>
        </div>
      </section>

      {atual ? (
        <motion.button type="button" className="atv-continuar" onClick={() => setAberta(true)} whileHover={reduced ? undefined : { y: -3, rotateX: 4 }} transition={molaPeca}>
          <span className="atv-continuar-tag">{atual.finalizada ? "finalizada" : "em andamento"}</span>
          <span className="atv-continuar-titulo">{atual.materia} · {atual.atividade.titulo}</span>
          <span className="atv-continuar-info">
            {atual.finalizada
              ? `${atual.finalizada.pontos}/${atual.finalizada.maximo} pontos — ver correção`
              : `${atual.respostas.filter((resposta, indice) => respondida(atual.atividade.questoes[indice], paraCorrecao(atual.atividade.questoes[indice], resposta))).length} de ${atual.atividade.questoes.length} respondidas — continuar`}
          </span>
        </motion.button>
      ) : null}

      <div className="atv-home">
        <section className="atv-card atv-gerador" aria-label="Gerar atividade">
          <p className="caderno-note">nova tarefa</p>
          <p className="atv-label">Componente</p>
          <div className="atv-chips" role="radiogroup" aria-label="Componente">
            {materias.map((item) => (
              <button key={item} type="button" role="radio" aria-checked={materia === item} className={`atv-chip ${materia === item ? "is-on" : ""}`} onClick={() => setMateria(item)}>
                {materia === item ? <motion.span layoutId="atv-chip-grifo" className="atv-chip-grifo" transition={molaPeca} /> : null}
                <span className="relative">{item}</span>
              </button>
            ))}
          </div>

          <div className="atv-linha">
            <label className="atv-campo">
              <span className="atv-label">Ano / série</span>
              <span className="atv-select">
                <select value={serie} onChange={(event) => setSerie(event.target.value)}>
                  {series.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <ChevronDown className="h-4 w-4" aria-hidden />
              </span>
            </label>
            <label className="atv-campo atv-campo-grande">
              <span className="atv-label">Assunto (opcional)</span>
              <input value={assunto} onChange={(event) => setAssunto(event.target.value.slice(0, 120))} placeholder={`Ex.: ${(assuntosSugeridos[materia] || [])[0] || "o que caiu na prova"}`} />
            </label>
          </div>
          <div className="atv-sugestoes">
            {(assuntosSugeridos[materia] || []).map((item) => (
              <button key={item} type="button" onClick={() => setAssunto(item)} className={assunto === item ? "is-on" : ""}>
                {item}
              </button>
            ))}
          </div>

          {erro ? <p className="atv-erro" role="alert">{erro}</p> : null}
          <div className="atv-acoes">
            <motion.button type="button" className="atv-btn caderno-btn-pen" onClick={gerar} disabled={carregando} whileTap={{ scale: 0.96 }} transition={molaPeca}>
              <Wand2 className="h-4 w-4" /> Gerar atividade
            </motion.button>
          </div>
          {atual && !atual.finalizada ? <p className="atv-dica">Gerar uma nova substitui a atividade em andamento.</p> : null}
        </section>

        <div className="atv-lateral">
          <section className="atv-card atv-exemplos" aria-label="Atividades prontas">
            <p className="caderno-note">prontas pra testar</p>
            {atividadesExemplo.map((exemplo) => (
              <motion.button
                key={exemplo.titulo}
                type="button"
                className="atv-exemplo"
                whileHover={reduced ? undefined : { x: 4 }}
                transition={molaPeca}
                onClick={() => {
                  const atividade = lerAtividade(exemplo);
                  if (atividade) iniciar(atividade, exemplo.materia, exemplo.serie);
                }}
              >
                <BookMarked className="h-4 w-4" />
                <span>
                  <b>{exemplo.titulo}</b>
                  <small>{exemplo.materia} · {exemplo.serie} · {exemplo.questoes.length} questões</small>
                </span>
              </motion.button>
            ))}
          </section>

          <aside className="atv-card atv-historico" aria-label="Atividades entregues">
            <p className="caderno-note">entregues</p>
            {historico.length ? (
              <ul>
                {historico.map((item) => (
                  <li key={item.id}>
                    <span className="atv-hist-titulo">{item.title}</span>
                    <span className="atv-hist-nota">{item.pontos ?? 0}<small>/{item.pontosMax ?? 70}</small></span>
                    <span className="atv-hist-data">{new Date(item.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="atv-vazio">
                <ClipboardList className="h-5 w-5" /> As atividades que você finalizar aparecem aqui, com a nota.
              </p>
            )}
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {carregando ? (
          <motion.div className="atv-overlay" role="status" aria-live="polite" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="atv-overlay-card" initial={reduced ? false : { scale: 0.9, rotateX: 18, y: 30 }} animate={{ scale: 1, rotateX: 0, y: 0 }} transition={molaSolta}>
              <CenaPrancheta modo="gerando" className="atv-overlay-cena" />
              <p className="caderno-note">preparando sua tarefa</p>
              <AnimatePresence mode="wait">
                <motion.p key={passo} className="atv-overlay-step" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                  {gerando[passo]}
                </motion.p>
              </AnimatePresence>
              <button
                type="button"
                className="atv-link"
                onClick={() => {
                  abortRef.current?.abort();
                  setCarregando(false);
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
// Modo missão (nov/2026): uma questão por vez, conferida na hora.
//
// A folha longa com as 7 questões e a correção só no fim virou um palco: a
// questão entra deslizando, o aluno responde e toca em "Conferir"; a carta
// mostra o gabarito (os componentes já tinham o modo corrigido), a barra de
// baixo fica verde ou rosa, o XP sobe e a sequência de acertos vira combo.
// No fim, estrelas pela nota. A folha completa continua como "ver correção".

type MissaoProps = {
  inicial: EmAndamento;
  user: User;
  onSalvar: (estado: EmAndamento) => void;
  onVoltar: () => void;
  onFinalizar: (estado: EmAndamento, session: Session) => void;
  onDescartar: () => void;
};

function fracaoDaQuestao(estado: EmAndamento, indice: number) {
  const questao = estado.atividade.questoes[indice];
  if (questao.tipo === "dissertativa") return (estado.correcoes[indice]?.nota || 0) / 10;
  return corrigirObjetiva(questao, paraCorrecao(questao, estado.respostas[indice]));
}

function Missao(props: MissaoProps) {
  const { inicial, user, onSalvar, onVoltar, onFinalizar, onDescartar } = props;
  const reduced = useSoftMotion();
  const [estado, setEstado] = useState(inicial);
  const [revisar, setRevisar] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const [aviso, setAviso] = useState("");
  const [tremor, setTremor] = useState(0);
  const palcoRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const { atividade } = estado;
  const total = atividade.questoes.length;
  const conferidas = estado.conferidas || [];
  const atual = Math.max(0, Math.min(total - 1, estado.atual ?? 0));
  const questao = atividade.questoes[atual];
  const conferida = conferidas.includes(atual);
  const pronta = respondida(questao, paraCorrecao(questao, estado.respostas[atual]));
  const fracao = conferida ? fracaoDaQuestao(estado, atual) : null;
  const acertos = conferidas.filter((indice) => fracaoDaQuestao(estado, indice) >= 0.99).length;
  const combo = estado.combo || 0;
  const secao = secoes.find((item) => item.id === questao.secao);

  // rascunho automático, como na folha
  useEffect(() => {
    const timer = window.setTimeout(() => onSalvar(estado), 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const responder = (valor: Resposta) => {
    if (conferida) return;
    setAviso("");
    setEstado((anterior) => {
      const respostas = [...anterior.respostas];
      respostas[atual] = valor;
      const correcoes = { ...anterior.correcoes };
      if (anterior.atividade.questoes[atual].tipo === "dissertativa") delete correcoes[atual];
      return { ...anterior, respostas, correcoes };
    });
  };

  const corrigirDissertativa = async () => {
    const pergunta = questao as QuestaoDissertativa;
    const texto = String(estado.respostas[atual] || "").trim();
    const resposta = await askMineTask(
      {
        task: "atividade-correcao",
        prompt: texto,
        context: [`Componente: ${estado.materia} (${estado.serie})`, `Pergunta: ${pergunta.enunciado}`, pergunta.textoBase ? `Texto-base: ${pergunta.textoBase}` : "", `Uma boa resposta precisa: ${pergunta.esperado}`].filter(Boolean).join("\n"),
        outputTokens: 700,
      },
      { timeoutMs: 90_000 },
    );
    const correcao = lerCorrecaoDissertativa(resposta);
    if (!correcao) throw new Error("A correção veio incompleta. Tente conferir de novo.");
    return correcao;
  };

  const conferir = async () => {
    if (!pronta || conferida || conferindo) return;
    let correcaoNova: CorrecaoDissertativa | undefined;
    if (questao.tipo === "dissertativa" && !estado.correcoes[atual]) {
      setConferindo(true);
      try {
        correcaoNova = await corrigirDissertativa();
      } catch (error) {
        setAviso(error instanceof Error ? error.message : "A Mine não conseguiu ler agora. Tente de novo.");
        setConferindo(false);
        return;
      }
      setConferindo(false);
    }
    const proximo: EmAndamento = {
      ...estado,
      correcoes: correcaoNova ? { ...estado.correcoes, [atual]: correcaoNova } : estado.correcoes,
      conferidas: [...conferidas, atual],
    };
    const nota = fracaoDaQuestao(proximo, atual);
    const certa = nota >= 0.99;
    const novoCombo = certa ? combo + 1 : 0;
    setEstado({ ...proximo, combo: novoCombo, melhorCombo: Math.max(estado.melhorCombo || 0, novoCombo) });
    if (certa) {
      floatXp("+5 XP", hudRef.current);
      if (!reduced) celebrateFrom(palcoRef.current, { count: novoCombo >= 3 ? 26 : 14, spread: 0.5 });
      if (novoCombo === 3) mineSays("3 seguidas! Tá voando!", "wow");
      else if (novoCombo === 5) mineSays("5 em sequência!!", "wow");
    } else {
      setTremor((valor) => valor + 1);
      if (nota > 0) mineSays("Quase! Olha o que faltou.", "happy");
    }
  };

  const finalizar = (base: EmAndamento) => {
    const respostas = base.atividade.questoes.map((item, indice) => paraCorrecao(item, base.respostas[indice]));
    const nota = pontuar(base.atividade.questoes, respostas, base.correcoes);
    const xp = atividadeXp(nota.acertos);
    const fim: EmAndamento = { ...base, finalizada: { ...nota, xp } };
    setEstado(fim);
    const session: Session = {
      id: base.id,
      userId: user.id,
      subjectId: "atividades",
      title: `${base.materia}: ${base.atividade.titulo}`.slice(0, 140),
      kind: "Atividade",
      createdAt: Date.now(),
      xpEarned: xp,
      correctAnswers: nota.acertos,
      questionsAnswered: total,
      accuracy: Math.round((nota.acertos / total) * 100),
      materia: base.materia,
      pontos: nota.pontos,
      pontosMax: nota.maximo,
    };
    onFinalizar(fim, session);
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  const irPara = (indice: number) => {
    setAviso("");
    setEstado((anterior) => ({ ...anterior, atual: indice }));
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  const continuar = () => {
    const ordem = [...Array(total).keys()];
    const depois = ordem.slice(atual + 1).concat(ordem.slice(0, atual + 1));
    const proxima = depois.find((indice) => !conferidas.includes(indice));
    if (proxima === undefined) finalizar(estado);
    else irPara(proxima);
  };

  // Enter confere e depois avança (fora de caixas de texto)
  const atalho = useRef<() => void>(() => undefined);
  atalho.current = () => (conferida ? continuar() : void conferir());
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      const alvo = event.target as HTMLElement | null;
      if (alvo && (alvo.tagName === "TEXTAREA" || alvo.tagName === "INPUT" || alvo.tagName === "SELECT" || alvo.tagName === "BUTTON")) return;
      event.preventDefault();
      atalho.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (estado.finalizada && revisar) {
    return <Folha {...props} inicial={estado} onVoltar={() => setRevisar(false)} />;
  }
  if (estado.finalizada) {
    return <FimDaMissao estado={estado} onRevisar={() => setRevisar(true)} onNova={onDescartar} onVoltar={onVoltar} />;
  }

  const resultado = fracao === null ? "neutro" : fracao >= 0.99 ? "certa" : fracao > 0 ? "parcial" : "errada";
  const ultima = conferidas.length + (conferida ? 0 : 1) >= total;

  return (
    <div className="atv-page msn-page">
      <header className="msn-hud" ref={hudRef}>
        <button type="button" className="msn-sair" onClick={onVoltar} aria-label="Sair da missão (o progresso fica salvo)">
          <X className="h-5 w-5" />
        </button>
        <div className="msn-trilha" role="list" aria-label="Questões da missão">
          {atividade.questoes.map((item, indice) => {
            const feita = conferidas.includes(indice);
            const nota = feita ? fracaoDaQuestao(estado, indice) : null;
            const tom = nota === null ? "" : nota >= 0.99 ? "is-certa" : nota > 0 ? "is-parcial" : "is-errada";
            return (
              <button
                key={indice}
                type="button"
                role="listitem"
                className={`msn-no ${tom} ${indice === atual ? "is-atual" : ""}`}
                onClick={() => irPara(indice)}
                aria-label={`Questão ${indice + 1}${feita ? (nota! >= 0.99 ? ", certa" : nota! > 0 ? ", parcial" : ", errada") : ""}`}
                aria-current={indice === atual ? "step" : undefined}
              >
                {indice === atual ? <motion.span layoutId="msn-no-atual" className="msn-no-anel" transition={molaSolta} /> : null}
                <span className="relative">{feita ? (nota! >= 0.99 ? <Check className="h-3.5 w-3.5" /> : nota! > 0 ? "½" : <X className="h-3.5 w-3.5" />) : indice + 1}</span>
              </button>
            );
          })}
        </div>
        <div className="msn-stats">
          <AnimatePresence>
            {combo >= 2 ? (
              <motion.span key="combo" className="msn-combo" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={molaSolta}>
                <Flame className="h-4 w-4" aria-hidden /> x{combo}
              </motion.span>
            ) : null}
          </AnimatePresence>
          <motion.span key={acertos} className="msn-xp" initial={reduced ? false : { scale: 1.35 }} animate={{ scale: 1 }} transition={molaSolta}>
            <Sparkles className="h-4 w-4" aria-hidden /> {acertos * 5} XP
          </motion.span>
        </div>
      </header>

      <div className="msn-progresso" aria-hidden>
        <motion.span animate={{ scaleX: conferidas.length / total }} transition={molaPeca} />
      </div>

      <section className="msn-palco" ref={palcoRef}>
        <motion.div key={`tremor-${tremor}`} animate={tremor && !reduced ? { x: [0, -12, 12, -8, 8, -3, 0] } : undefined} transition={{ duration: 0.45 }}>
          <motion.article
            key={atual}
            className={`msn-carta is-${resultado}`}
            initial={reduced ? false : { opacity: 0, x: 70, rotate: 2.5, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
            transition={molaSolta}
          >
            <div className="msn-carta-topo">
              <span className="msn-secao">
                <span aria-hidden>{secao?.emoji}</span> {secao?.titulo}
              </span>
              <span className="msn-contagem">
                Questão <b>{dois(atual + 1)}</b> de {dois(total)}
              </span>
            </div>
            {questao.textoBase ? (
              <>
                <blockquote className="atv-texto-base">{questao.textoBase}</blockquote>
                {questao.fonte ? <p className="atv-fonte">Fonte: {questao.fonte}</p> : null}
              </>
            ) : null}
            <p className="msn-enunciado">{questao.enunciado}</p>
            <Questao
              id={`${estado.id}-${atual}`}
              questao={questao}
              resposta={estado.respostas[atual]}
              semente={estado.semente + atual * 7919}
              fechada={conferida}
              onChange={responder}
              dissertativa={{ correcao: estado.correcoes[atual], tentativas: -1, corrigindo: conferindo, onAssistente: () => undefined }}
            />
          </motion.article>
        </motion.div>
      </section>

      <motion.footer className={`msn-barra is-${resultado}`} layout transition={molaPeca} aria-live="polite">
        <div className="msn-barra-texto">
          {resultado === "neutro" ? (
            <>
              <span className="msn-barra-icone">
                <Target className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <b>{aviso || instrucoes[questao.tipo] || "Responda e confira."}</b>
                <small>{pronta ? "Pronto? Toque em Conferir (ou Enter)." : "Responda para liberar o Conferir."}</small>
              </span>
            </>
          ) : (
            <>
              <motion.span className="msn-barra-icone" initial={reduced ? false : { scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={molaSolta}>
                {resultado === "certa" ? <Check className="h-5 w-5" /> : resultado === "parcial" ? <Star className="h-5 w-5" /> : <X className="h-5 w-5" />}
              </motion.span>
              <span>
                <b>{resultado === "certa" ? (combo >= 3 ? `Mandou bem! ${combo} seguidas 🔥` : "Mandou bem! +5 XP") : resultado === "parcial" ? "Quase! Parte certa." : "Não foi dessa vez."}</b>
                <small>{resultado === "certa" ? "A explicação está na carta, se quiser revisar." : "Veja na carta a resposta certa e a explicação."}</small>
              </span>
            </>
          )}
        </div>
        {conferida ? (
          <motion.button type="button" className="msn-botao" onClick={continuar} whileTap={{ scale: 0.95 }} transition={molaPeca} autoFocus>
            {ultima && conferidas.length >= total ? "Ver resultado" : "Continuar"} <ChevronRight className="h-4 w-4" />
          </motion.button>
        ) : (
          <motion.button type="button" className="msn-botao" onClick={() => void conferir()} disabled={!pronta || conferindo} whileTap={{ scale: 0.95 }} transition={molaPeca}>
            {conferindo ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {conferindo ? "A Mine está lendo…" : "Conferir"}
          </motion.button>
        )}
      </motion.footer>
    </div>
  );
}

function FimDaMissao({ estado, onRevisar, onNova, onVoltar }: { estado: EmAndamento; onRevisar: () => void; onNova: () => void; onVoltar: () => void }) {
  const reduced = useSoftMotion();
  const placarRef = useRef<HTMLDivElement>(null);
  const fim = estado.finalizada!;
  const total = estado.atividade.questoes.length;
  const porcentagem = fim.maximo ? fim.pontos / fim.maximo : 0;
  const estrelas = porcentagem >= 0.95 ? 3 : porcentagem >= 0.75 ? 2 : porcentagem >= 0.45 ? 1 : 0;
  const frase = ["Bora treinar mais um pouco!", "Boa! Dá pra subir mais.", "Muito bem!", "Gabaritou! Perfeito!"][estrelas];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      floatXp(`+${fim.xp} XP`, placarRef.current);
      if (estrelas >= 2) celebrateFrom(placarRef.current, { count: estrelas === 3 ? 50 : 32 });
      mineSays(frase, estrelas >= 2 ? "wow" : "happy");
    }, reduced ? 50 : 1100);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="atv-page msn-page">
      <section className="msn-fim" ref={placarRef}>
        <p className="caderno-note">missão cumprida · {estado.materia}</p>
        <h2 className="msn-fim-titulo">{estado.atividade.titulo}</h2>
        <div className="msn-estrelas" aria-label={`${estrelas} de 3 estrelas`}>
          {[0, 1, 2].map((indice) => (
            <motion.span
              key={indice}
              className={`msn-estrela ${indice < estrelas ? "is-on" : ""}`}
              initial={reduced ? false : { scale: 0, rotate: -120, y: 30 }}
              animate={{ scale: indice === 1 ? 1.25 : 1, rotate: 0, y: indice === 1 ? -10 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 14, mass: 1, delay: 0.3 + indice * 0.22 }}
            >
              <Star />
            </motion.span>
          ))}
        </div>
        <p className="msn-fim-frase">{frase}</p>
        <div className="msn-fim-numeros">
          <span>
            <b>{String(fim.pontos).replace(".", ",")}</b>
            <small>de {fim.maximo} pontos</small>
          </span>
          <span>
            <b>
              {fim.acertos}/{total}
            </b>
            <small>questões certas</small>
          </span>
          <span>
            <b>x{estado.melhorCombo || 0}</b>
            <small>maior sequência</small>
          </span>
          <span>
            <b>+{fim.xp}</b>
            <small>XP ganho</small>
          </span>
        </div>
        <div className="msn-fim-acoes">
          <button type="button" className="atv-btn caderno-btn-pen" onClick={onNova}>
            <Sparkles className="h-4 w-4" /> Nova missão
          </button>
          <button type="button" className="atv-btn atv-btn-ghost" onClick={onRevisar}>
            <ClipboardList className="h-4 w-4" /> Ver correção completa
          </button>
          <button type="button" className="atv-btn atv-btn-ghost" onClick={onVoltar}>
            Voltar
          </button>
        </div>
      </section>
    </div>
  );
}

function Folha({
  inicial,
  user,
  onSalvar,
  onVoltar,
  onFinalizar,
  onDescartar,
}: {
  inicial: EmAndamento;
  user: User;
  onSalvar: (estado: EmAndamento) => void;
  onVoltar: () => void;
  onFinalizar: (estado: EmAndamento, session: Session) => void;
  onDescartar: () => void;
}) {
  const reduced = useSoftMotion();
  const [estado, setEstado] = useState(inicial);
  const [detalhes, setDetalhes] = useState(true);
  const [aviso, setAviso] = useState("");
  const [pendentes, setPendentes] = useState<number[]>([]);
  const [corrigindo, setCorrigindo] = useState<number | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const placarRef = useRef<HTMLDivElement>(null);
  const { atividade } = estado;
  const total = atividade.questoes.length;
  const fechada = Boolean(estado.finalizada);
  const nome = user.settings?.displayName || user.name;
  const feitas = atividade.questoes.filter((questao, indice) => respondida(questao, paraCorrecao(questao, estado.respostas[indice]))).length;

  // rascunho automático: cada resposta já fica guardada no aparelho
  useEffect(() => {
    const timer = window.setTimeout(() => onSalvar(estado), 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const responder = (indice: number, valor: Resposta) => {
    if (fechada) return;
    setPendentes((lista) => lista.filter((item) => item !== indice));
    setEstado((atual) => {
      const respostas = [...atual.respostas];
      respostas[indice] = valor;
      const correcoes = { ...atual.correcoes };
      // a correção do assistente vale para o texto que foi corrigido
      if (atividade.questoes[indice].tipo === "dissertativa") delete correcoes[indice];
      return { ...atual, respostas, correcoes };
    });
  };

  const corrigirDissertativa = async (indice: number, contaTentativa: boolean) => {
    const questao = atividade.questoes[indice] as QuestaoDissertativa;
    const texto = String(estado.respostas[indice] || "").trim();
    setCorrigindo(indice);
    try {
      const resposta = await askMineTask(
        {
          task: "atividade-correcao",
          prompt: texto,
          context: [`Componente: ${estado.materia} (${estado.serie})`, `Pergunta: ${questao.enunciado}`, questao.textoBase ? `Texto-base: ${questao.textoBase}` : "", `Uma boa resposta precisa: ${questao.esperado}`].filter(Boolean).join("\n"),
          outputTokens: 700,
        },
        { timeoutMs: 90_000 },
      );
      const correcao = lerCorrecaoDissertativa(resposta);
      if (!correcao) throw new Error("A correção veio incompleta.");
      setEstado((atual) => ({
        ...atual,
        correcoes: { ...atual.correcoes, [indice]: correcao },
        tentativas: contaTentativa ? { ...atual.tentativas, [indice]: (atual.tentativas[indice] || 0) + 1 } : atual.tentativas,
      }));
      return correcao;
    } finally {
      setCorrigindo(null);
    }
  };

  const finalizar = async (forcar = false) => {
    setAviso("");
    const faltando = atividade.questoes
      .map((questao, indice) => (respondida(questao, paraCorrecao(questao, estado.respostas[indice])) ? -1 : indice))
      .filter((indice) => indice >= 0);
    if (faltando.length && !forcar) {
      setPendentes(faltando);
      setAviso(`Falta responder ${faltando.length === 1 ? "a questão" : "as questões"} ${faltando.map((item) => dois(item + 1)).join(", ")}.`);
      document.getElementById(`atv-q-${faltando[0]}`)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      return;
    }
    setFinalizando(true);
    try {
      const correcoes = { ...estado.correcoes };
      for (const [indice, questao] of atividade.questoes.entries()) {
        if (questao.tipo !== "dissertativa" || correcoes[indice]) continue;
        if (!String(estado.respostas[indice] || "").trim()) continue;
        correcoes[indice] = await corrigirDissertativa(indice, false);
      }
      const respostas = atividade.questoes.map((questao, indice) => paraCorrecao(questao, estado.respostas[indice]));
      const nota = pontuar(atividade.questoes, respostas, correcoes);
      const xp = atividadeXp(nota.acertos);
      const fim: EmAndamento = { ...estado, correcoes, finalizada: { ...nota, xp } };
      setEstado(fim);
      const session: Session = {
        id: estado.id,
        userId: user.id,
        subjectId: "atividades",
        title: `${estado.materia}: ${atividade.titulo}`.slice(0, 140),
        kind: "Atividade",
        createdAt: Date.now(),
        xpEarned: xp,
        correctAnswers: nota.acertos,
        questionsAnswered: total,
        accuracy: Math.round((nota.acertos / total) * 100),
        materia: estado.materia,
        pontos: nota.pontos,
        pontosMax: nota.maximo,
      };
      onFinalizar(fim, session);
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      window.setTimeout(() => {
        floatXp(`+${xp} XP`, placarRef.current);
        if (nota.pontos >= nota.maximo * 0.7) celebrateFrom(placarRef.current, { count: 36 });
      }, reduced ? 50 : 900);
      mineSays(nota.pontos >= nota.maximo * 0.8 ? "Arrasou na tarefa!" : "Entregue! Confere a correção.", nota.pontos >= nota.maximo * 0.8 ? "wow" : "happy");
    } catch (error) {
      setAviso(error instanceof Error ? `${error.message} Tente finalizar de novo.` : "A Mine não conseguiu corrigir agora. Tente finalizar de novo.");
    } finally {
      setFinalizando(false);
    }
  };

  let numero = 0;

  return (
    <div className="atv-page atv-folha-page">
      <nav className="atv-trilha" aria-label="Caminho">
        <button type="button" onClick={onVoltar}>Atividades</button>
        <span aria-hidden>/</span>
        <span>{estado.materia} - {estado.serie}</span>
      </nav>

      {!fechada ? (
        <div className="atv-progresso" aria-label={`${feitas} de ${total} respondidas`}>
          <motion.span animate={{ scaleX: feitas / total }} transition={molaPeca} />
          <small>{feitas}/{total}</small>
        </div>
      ) : null}

      <div className="atv-moldura">
        <motion.section className="atv-cabecalho" initial={reduced ? false : { rotateX: -24, y: 24, opacity: 0 }} animate={{ rotateX: 0, y: 0, opacity: 1 }} transition={molaSolta}>
          <div className="atv-cabecalho-materia">
            {estado.materia} - {estado.serie}
          </div>
          <div className="atv-cabecalho-corpo">
            <p className="atv-cabecalho-titulo">Tarefa: {atividade.titulo}</p>
            <AnimatePresence initial={false}>
              {detalhes ? (
                <motion.div className="atv-cabecalho-detalhes" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={molaPeca}>
                  {atividade.habilidade ? (
                    <p>
                      <b>Aprendizagem Essencial:</b> {atividade.habilidade}
                    </p>
                  ) : null}
                  <p>
                    <b>Usuário:</b> {nome}
                  </p>
                  <p>
                    <b>Autor:</b> Mine (Minerva)
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <button type="button" className="atv-cabecalho-toggle" onClick={() => setDetalhes((valor) => !valor)} aria-expanded={detalhes} aria-label={detalhes ? "Recolher detalhes" : "Mostrar detalhes"}>
              <ChevronDown className={`h-4 w-4 transition-transform ${detalhes ? "rotate-180" : ""}`} />
            </button>
          </div>
        </motion.section>

        {estado.finalizada ? (
          <section className="atv-placar" ref={placarRef}>
            <motion.div
              className="atv-placar-nota"
              initial={reduced ? false : { scale: 2.4, rotate: -24, opacity: 0, z: 200 }}
              animate={{ scale: 1, rotate: -4, opacity: 1, z: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 16, mass: 1, delay: 0.25 }}
            >
              <span className="caderno-note">nota da tarefa</span>
              <strong>{String(estado.finalizada.pontos).replace(".", ",")}</strong>
              <small>de {estado.finalizada.maximo} pontos</small>
            </motion.div>
            <div className="atv-placar-info">
              <p>
                <b>{estado.finalizada.acertos}</b> de {total} questões certas · <b>+{estado.finalizada.xp} XP</b>
              </p>
              <p>Role a folha para ver a correção de cada questão, o gabarito e a explicação da Mine.</p>
              <div className="atv-acoes">
                <button type="button" className="atv-btn caderno-btn-pen" onClick={onDescartar}>
                  <Sparkles className="h-4 w-4" /> Fazer outra atividade
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {secoes.map((secao) => {
          const lista = atividade.questoes.map((questao, indice) => ({ questao, indice })).filter((item) => item.questao.secao === secao.id);
          if (!lista.length) return null;
          return (
            <React.Fragment key={secao.id}>
              <motion.div className="atv-secao" initial={reduced ? false : { rotateX: -70, opacity: 0 }} whileInView={{ rotateX: 0, opacity: 1 }} viewport={{ once: true, margin: "-40px" }} transition={molaSolta}>
                <span aria-hidden>{secao.emoji}</span> {secao.titulo}
              </motion.div>
              {secao.id === "aquecimento" && atividade.introducao ? <div className="atv-intro">{atividade.introducao}</div> : null}
              {lista.map(({ questao, indice }) => {
                numero += 1;
                const resposta = estado.respostas[indice];
                const fracao = fechada
                  ? questao.tipo === "dissertativa"
                    ? (estado.correcoes[indice]?.nota || 0) / 10
                    : corrigirObjetiva(questao, paraCorrecao(questao, resposta))
                  : null;
                const semente = estado.semente + indice * 7919;
                return (
                  <motion.article
                    key={indice}
                    id={`atv-q-${indice}`}
                    className={`atv-questao ${pendentes.includes(indice) ? "is-pendente" : ""}`}
                    initial={reduced ? false : { opacity: 0, y: 40, rotateX: 12 }}
                    whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={molaPeca}
                  >
                    <header className="atv-questao-topo">
                      <span>
                        Questão <b>{dois(numero)}</b> de {dois(total)}
                      </span>
                      <span className="atv-questao-pontos">
                        <span className="atv-obrigatoria" aria-label="obrigatória">*</span>
                        {fracao === null ? (
                          <span className="atv-pontos">{pontosPorQuestao} PONTOS</span>
                        ) : (
                          <motion.span
                            className={`atv-pontos ${fracao >= 0.99 ? "is-certa" : fracao > 0 ? "is-parcial" : "is-errada"}`}
                            initial={reduced ? false : { scale: 1.8, rotate: -12, opacity: 0 }}
                            whileInView={{ scale: 1, rotate: 0, opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ type: "spring", stiffness: 320, damping: 15 }}
                          >
                            {fracao >= 0.99 ? <Check className="h-3.5 w-3.5" /> : fracao > 0 ? null : <X className="h-3.5 w-3.5" />}
                            {String(Math.round(fracao * pontosPorQuestao * 10) / 10).replace(".", ",")}/{pontosPorQuestao}
                          </motion.span>
                        )}
                      </span>
                    </header>
                    <div className="atv-questao-corpo">
                      {questao.textoBase ? (
                        <>
                          <p className="atv-leia">Leia o texto a seguir para responder à questão:</p>
                          <blockquote className="atv-texto-base">{questao.textoBase}</blockquote>
                          {questao.fonte ? <p className="atv-fonte">Fonte: {questao.fonte}</p> : null}
                        </>
                      ) : null}
                      <p className="atv-enunciado">{questao.enunciado}</p>
                      <Questao
                        id={`${estado.id}-${indice}`}
                        questao={questao}
                        resposta={resposta}
                        semente={semente}
                        fechada={fechada}
                        onChange={(valor) => responder(indice, valor)}
                        dissertativa={{
                          correcao: estado.correcoes[indice],
                          tentativas: tentativasAssistente - (estado.tentativas[indice] || 0),
                          corrigindo: corrigindo === indice,
                          onAssistente: () => void corrigirDissertativa(indice, true).catch((error) => setAviso(error instanceof Error ? error.message : "A Mine não conseguiu corrigir agora.")),
                        }}
                      />
                    </div>
                  </motion.article>
                );
              })}
            </React.Fragment>
          );
        })}

        {!fechada ? (
          <footer className="atv-rodape">
            <AnimatePresence>
              {aviso ? (
                <motion.div className="atv-aviso" role="alert" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={molaPeca}>
                  <span>{aviso}</span>
                  {pendentes.length ? (
                    <button type="button" className="atv-link" onClick={() => void finalizar(true)}>
                      finalizar mesmo assim
                    </button>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>
            <div className="atv-rodape-botoes">
              <button type="button" className="atv-btn atv-btn-ghost" onClick={onVoltar}>
                Voltar
              </button>
              <button
                type="button"
                className="atv-btn atv-btn-ghost"
                onClick={() => {
                  onSalvar(estado);
                  mineSays("Rascunho salvo!", "happy");
                }}
              >
                <Save className="h-4 w-4" /> Salvar Rascunho
              </button>
              <motion.button type="button" className="atv-btn caderno-btn-pen" onClick={() => void finalizar()} disabled={finalizando} whileTap={{ scale: 0.95 }} transition={molaPeca}>
                {finalizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Finalizar
              </motion.button>
            </div>
          </footer>
        ) : null}
      </div>
    </div>
  );
}

type QuestaoProps = {
  id: string;
  questao: Questao;
  resposta: Resposta;
  semente: number;
  fechada: boolean;
  onChange: (valor: Resposta) => void;
  dissertativa: { correcao?: CorrecaoDissertativa; tentativas: number; corrigindo: boolean; onAssistente: () => void };
};

function Questao({ id, questao, resposta, semente, fechada, onChange, dissertativa }: QuestaoProps) {
  switch (questao.tipo) {
    case "ordenar":
      return <Ordenar id={id} questao={questao} semente={semente} valor={resposta as number[] | undefined} fechada={fechada} onChange={onChange} />;
    case "lacunas":
      return <Lacunas questao={questao} valor={resposta as number[] | undefined} fechada={fechada} onChange={onChange} />;
    case "vf":
      return <VerdadeiroFalso questao={questao} valor={resposta as boolean[] | undefined} fechada={fechada} onChange={onChange} />;
    case "multipla":
      return <Multipla id={id} questao={questao} valor={resposta as number | undefined} fechada={fechada} onChange={onChange} />;
    case "ligar":
      return <Ligar questao={questao} semente={semente} valor={resposta as number[] | undefined} fechada={fechada} onChange={onChange} />;
    case "categorias":
      return <Categorias id={id} questao={questao} semente={semente} valor={resposta as number[] | undefined} fechada={fechada} onChange={onChange} />;
    case "sequencia":
      return <Sequencia questao={questao} semente={semente} valor={resposta as number[] | undefined} fechada={fechada} onChange={onChange} />;
    case "numerica":
      return <Numerica questao={questao} valor={String(resposta ?? "")} fechada={fechada} onChange={onChange} />;
    default:
      return <Dissertativa questao={questao} valor={String(resposta || "")} fechada={fechada} onChange={onChange} {...dissertativa} />;
  }
}

/** As palavras voam do banco para a resposta (layoutId compartilhado). */
function Ordenar({ id, questao, semente, valor, fechada, onChange }: { id: string; questao: QuestaoOrdenar; semente: number; valor?: number[]; fechada: boolean; onChange: (valor: number[] | undefined) => void }) {
  const banco = useMemo(() => embaralhar(questao.palavras, semente), [questao.palavras, semente]);
  const escolhidas = valor || [];
  const certa = fechada && corrigirObjetiva(questao, escolhidas.map((indice) => questao.palavras[indice])) === 1;
  return (
    <LayoutGroup id={`ordenar-${id}`}>
      <div className="atv-ordenar">
        <div className={`atv-resposta ${fechada ? (certa ? "is-certa" : "is-errada") : ""}`} aria-label="Resposta do aluno">
          <p className="atv-resposta-label">Resposta do Aluno</p>
          <div className="atv-palavras">
            {escolhidas.length ? (
              escolhidas.map((indice, posicao) => (
                <motion.button
                  layoutId={`p-${indice}`}
                  key={indice}
                  type="button"
                  className="atv-palavra is-escolhida"
                  disabled={fechada}
                  transition={molaSolta}
                  onClick={() => onChange(escolhidas.filter((_, item) => item !== posicao))}
                  aria-label={`Tirar ${questao.palavras[indice]}`}
                >
                  {questao.palavras[indice]}
                </motion.button>
              ))
            ) : (
              <span className="atv-placeholder">Toque nas palavras abaixo na ordem certa.</span>
            )}
          </div>
        </div>
        {!fechada ? (
          <>
            <div className="atv-palavras atv-banco">
              {banco.map((item) =>
                escolhidas.includes(item.indice) ? (
                  <span key={item.indice} className="atv-palavra is-vaga" aria-hidden>
                    {item.texto}
                  </span>
                ) : (
                  <motion.button
                    layoutId={`p-${item.indice}`}
                    key={item.indice}
                    type="button"
                    className="atv-palavra"
                    transition={molaSolta}
                    whileHover={{ y: -3, rotate: -2 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => onChange([...escolhidas, item.indice])}
                  >
                    {item.texto}
                  </motion.button>
                ),
              )}
            </div>
            <button type="button" className="atv-limpar" onClick={() => onChange(undefined)} disabled={!escolhidas.length}>
              Limpar <Eraser className="h-4 w-4" />
            </button>
          </>
        ) : !certa ? (
          <p className="atv-gabarito">
            <b>Resposta certa:</b> {questao.frase}
          </p>
        ) : null}
      </div>
    </LayoutGroup>
  );
}

function Lacunas({ questao, valor, fechada, onChange }: { questao: QuestaoLacunas; valor?: number[]; fechada: boolean; onChange: (valor: number[] | undefined) => void }) {
  const escolhas = valor || [];
  const partes = questao.texto.split(/\[(\d+)\]/);
  return (
    <div className="atv-lacunas">
      <p className="atv-lacunas-texto">
        {partes.map((parte, indice) => {
          if (indice % 2 === 0) return <React.Fragment key={indice}>{parte}</React.Fragment>;
          const lacuna = Number(parte) - 1;
          const config = questao.lacunas[lacuna];
          if (!config) return null;
          const escolhida = escolhas[lacuna];
          const estado = fechada ? (escolhida === config.correta ? "is-certa" : "is-errada") : Number.isInteger(escolhida) ? "is-preenchida" : "";
          return (
            <span key={indice} className={`atv-lacuna ${estado}`}>
              <select
                value={Number.isInteger(escolhida) ? String(escolhida) : ""}
                disabled={fechada}
                aria-label={`Lacuna ${lacuna + 1}`}
                onChange={(event) => {
                  const proximas = [...escolhas];
                  proximas[lacuna] = Number(event.target.value);
                  onChange(proximas);
                }}
              >
                <option value="" disabled>
                  {" "}
                </option>
                {config.opcoes.map((opcao, posicao) => (
                  <option key={posicao} value={posicao}>
                    {opcao}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-4 w-4" aria-hidden />
              {fechada && escolhida !== config.correta ? <span className="atv-lacuna-certa">{config.opcoes[config.correta]}</span> : null}
            </span>
          );
        })}
      </p>
      {!fechada ? (
        <button type="button" className="atv-limpar" onClick={() => onChange(undefined)} disabled={!escolhas.length}>
          Limpar <Eraser className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

/** Cartas: o aluno escolhe V ou F; ao finalizar, cada carta vira e mostra o porquê. */
function VerdadeiroFalso({ questao, valor, fechada, onChange }: { questao: QuestaoVF; valor?: boolean[]; fechada: boolean; onChange: (valor: boolean[]) => void }) {
  const reduced = useSoftMotion();
  const escolhas = valor || [];
  return (
    <div className="atv-vf">
      {questao.afirmacoes.map((afirmacao, indice) => {
        const escolha = escolhas[indice];
        const certa = escolha === afirmacao.verdadeira;
        return (
          <div key={indice} className="atv-carta-cena">
            <motion.div
              className="atv-carta"
              animate={{ rotateY: fechada ? 180 : 0, rotateZ: !fechada && typeof escolha === "boolean" ? (escolha ? -1.5 : 1.5) : 0 }}
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30, mass: 1, delay: fechada ? indice * 0.12 : 0 }}
            >
              <div className={`atv-carta-face is-frente ${typeof escolha === "boolean" ? (escolha ? "is-v" : "is-f") : ""}`}>
                <p>{afirmacao.texto}</p>
                <div className="atv-carta-botoes">
                  {[true, false].map((opcao) => (
                    <motion.button
                      key={String(opcao)}
                      type="button"
                      className={`atv-vf-btn ${opcao ? "is-v" : "is-f"} ${escolha === opcao ? "is-on" : ""}`}
                      aria-pressed={escolha === opcao}
                      disabled={fechada}
                      whileTap={{ scale: 0.9 }}
                      transition={molaPeca}
                      onClick={() => {
                        const proximas = [...escolhas];
                        proximas[indice] = opcao;
                        onChange(proximas);
                      }}
                    >
                      {opcao ? "Verdadeiro" : "Falso"}
                    </motion.button>
                  ))}
                </div>
                <AnimatePresence>
                  {typeof escolha === "boolean" ? (
                    <motion.span
                      key={String(escolha)}
                      className={`atv-carimbo ${escolha ? "is-v" : "is-f"}`}
                      initial={reduced ? false : { scale: 2, opacity: 0, rotate: -30 }}
                      animate={{ scale: 1, opacity: 1, rotate: -12 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{ type: "spring", stiffness: 340, damping: 14 }}
                      aria-hidden
                    >
                      {escolha ? "V" : "F"}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </div>
              <div className={`atv-carta-face is-verso ${certa ? "is-certa" : "is-errada"}`} aria-hidden={!fechada}>
                <span className="atv-carta-icone">{certa ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}</span>
                <p className="atv-carta-resposta">É {afirmacao.verdadeira ? "VERDADEIRA" : "FALSA"}</p>
                <p>{afirmacao.texto}</p>
                {afirmacao.explicacao ? <p className="atv-carta-explicacao">{afirmacao.explicacao}</p> : null}
              </div>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

function Multipla({ id, questao, valor, fechada, onChange }: { id: string; questao: QuestaoMultipla; valor?: number; fechada: boolean; onChange: (valor: number) => void }) {
  return (
    <LayoutGroup id={`multipla-${id}`}>
      <div className="atv-multipla" role="radiogroup">
        {questao.alternativas.map((alternativa, indice) => {
          const marcada = valor === indice;
          const estado = fechada ? (indice === questao.correta ? "is-certa" : marcada ? "is-errada" : "") : marcada ? "is-marcada" : "";
          return (
            <motion.button
              key={indice}
              type="button"
              role="radio"
              aria-checked={marcada}
              disabled={fechada}
              className={`atv-alternativa ${estado}`}
              onClick={() => onChange(indice)}
              whileHover={fechada ? undefined : { x: 4 }}
              whileTap={fechada ? undefined : { scale: 0.98 }}
              transition={molaPeca}
            >
              {marcada && !fechada ? <motion.span layoutId="grifo" className="atv-alternativa-grifo" transition={molaSolta} /> : null}
              <span className="atv-letra">{letras[indice]}</span>
              <span className="relative">{alternativa}</span>
            </motion.button>
          );
        })}
        {fechada && questao.explicacao ? (
          <p className="atv-explicacao">
            <b>Por quê:</b> {questao.explicacao}
          </p>
        ) : null}
      </div>
    </LayoutGroup>
  );
}

/** Ligar colunas: toque num item da esquerda e depois no par da direita; a linha é desenhada em SVG. */
function Ligar({ questao, semente, valor, fechada, onChange }: { questao: QuestaoLigar; semente: number; valor?: number[]; fechada: boolean; onChange: (valor: number[]) => void }) {
  const reduced = useSoftMotion();
  const direita = useMemo(() => embaralhar(questao.pares.map((par) => par.direita), semente), [questao.pares, semente]);
  const ligacoes = valor || [];
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const esquerdaRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const direitaRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [linhas, setLinhas] = useState<Array<{ d: string; esquerda: number; certa: boolean }>>([]);

  const medir = () => {
    const caixa = caixaRef.current?.getBoundingClientRect();
    if (!caixa) return;
    const novas: Array<{ d: string; esquerda: number; certa: boolean }> = [];
    ligacoes.forEach((original, esquerda) => {
      if (!Number.isInteger(original)) return;
      const a = esquerdaRefs.current[esquerda]?.getBoundingClientRect();
      const posicao = direita.findIndex((item) => item.indice === original);
      const b = direitaRefs.current[posicao]?.getBoundingClientRect();
      if (!a || !b) return;
      const x1 = a.right - caixa.left;
      const y1 = a.top + a.height / 2 - caixa.top;
      const x2 = b.left - caixa.left;
      const y2 = b.top + b.height / 2 - caixa.top;
      const meio = (x2 - x1) / 2;
      novas.push({ d: `M${x1},${y1} C${x1 + meio},${y1} ${x2 - meio},${y2} ${x2},${y2}`, esquerda, certa: original === esquerda });
    });
    setLinhas(novas);
  };

  useLayoutEffect(medir, [valor, direita]);
  useEffect(() => {
    const caixa = caixaRef.current;
    if (!caixa) return;
    const ro = new ResizeObserver(medir);
    ro.observe(caixa);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, direita]);

  const ligar = (posicaoDireita: number) => {
    if (fechada || selecionado === null) return;
    const original = direita[posicaoDireita].indice;
    // cada item da direita só tem uma linha: quem já estava ligado nele solta
    const proximas = questao.pares.map((_, indice) => (ligacoes[indice] === original ? undefined : ligacoes[indice])) as number[];
    proximas[selecionado] = original;
    onChange(proximas);
    setSelecionado(null);
  };

  return (
    <div className="atv-ligar">
      <div className="atv-ligar-caixa" ref={caixaRef}>
        <svg className="atv-ligar-svg" aria-hidden>
          <AnimatePresence>
            {linhas.map((linha) => (
              <motion.path
                key={`${linha.esquerda}-${linha.d}`}
                d={linha.d}
                className={`atv-linha tom-${tons[linha.esquerda % tons.length]} ${fechada ? (linha.certa ? "is-certa" : "is-errada") : ""}`}
                initial={reduced ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            ))}
          </AnimatePresence>
        </svg>
        <div className="atv-ligar-coluna">
          {questao.pares.map((par, indice) => (
            <motion.button
              key={indice}
              ref={(no) => {
                esquerdaRefs.current[indice] = no;
              }}
              type="button"
              disabled={fechada}
              className={`atv-ligar-item is-esquerda tom-${tons[indice % tons.length]} ${selecionado === indice ? "is-selecionado" : ""} ${Number.isInteger(ligacoes[indice]) ? "is-ligado" : ""}`}
              onClick={() => setSelecionado(selecionado === indice ? null : indice)}
              animate={selecionado === indice ? { scale: 1.04 } : { scale: 1 }}
              transition={molaSolta}
            >
              {par.esquerda}
              <span className="atv-ligar-ponto" aria-hidden />
            </motion.button>
          ))}
        </div>
        <div className="atv-ligar-coluna">
          {direita.map((item, posicao) => {
            const dono = ligacoes.findIndex((original) => original === item.indice);
            return (
              <motion.button
                key={item.indice}
                ref={(no) => {
                  direitaRefs.current[posicao] = no;
                }}
                type="button"
                disabled={fechada || selecionado === null}
                className={`atv-ligar-item is-direita ${dono >= 0 ? `is-ligado tom-${tons[dono % tons.length]}` : ""} ${selecionado !== null ? "is-alvo" : ""}`}
                onClick={() => ligar(posicao)}
                whileHover={selecionado !== null ? { x: -4 } : undefined}
                transition={molaPeca}
              >
                <span className="atv-ligar-ponto" aria-hidden />
                {item.texto}
              </motion.button>
            );
          })}
        </div>
      </div>
      {!fechada ? (
        <p className="atv-dica">{selecionado === null ? "Toque num item da esquerda e depois no par dele na direita." : `Agora toque no par de “${questao.pares[selecionado].esquerda}”.`}</p>
      ) : linhas.some((linha) => !linha.certa) || ligacoes.length < questao.pares.length ? (
        <ul className="atv-gabarito atv-gabarito-lista">
          {questao.pares.map((par, indice) => (ligacoes[indice] === indice ? null : <li key={indice}><b>{par.esquerda}</b> → {par.direita}</li>))}
        </ul>
      ) : null}
    </div>
  );
}

/** Categorias: arraste a ficha até a caixa (ou toque na ficha e depois na caixa). */
function Categorias({ id, questao, semente, valor, fechada, onChange }: { id: string; questao: QuestaoCategorias; semente: number; valor?: number[]; fechada: boolean; onChange: (valor: number[]) => void }) {
  const ordem = useMemo(() => embaralhar(questao.itens, semente), [questao.itens, semente]);
  const caixas = valor || [];
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  // a última caixa sob a ficha: vale como alvo se o ponto do fim do arraste não achar nenhuma
  const sobreRef = useRef<number | null>(null);

  const colocar = (item: number, caixa: number | undefined) => {
    const proximas = questao.itens.map((_, indice) => caixas[indice]) as number[];
    if (caixa === undefined) delete proximas[item];
    else proximas[item] = caixa;
    onChange(proximas);
    setSelecionado(null);
  };

  const caixaNoPonto = (x: number, y: number) => {
    const alvo = document.elementsFromPoint(x, y).find((no) => (no as HTMLElement).dataset?.caixa !== undefined) as HTMLElement | undefined;
    return alvo && alvo.dataset.grupo === id ? Number(alvo.dataset.caixa) : undefined;
  };

  const ficha = (item: { texto: { texto: string; categoria: number }; indice: number }) => {
    const certa = fechada && caixas[item.indice] === item.texto.categoria;
    return (
      <motion.button
        layoutId={`ficha-${item.indice}`}
        key={item.indice}
        type="button"
        disabled={fechada}
        className={`atv-ficha ${selecionado === item.indice ? "is-selecionada" : ""} ${fechada ? (certa ? "is-certa" : "is-errada") : ""}`}
        drag={!fechada}
        dragSnapToOrigin
        dragElastic={0.9}
        whileDrag={{ scale: 1.08, rotate: -3, zIndex: 30, boxShadow: "0 18px 30px -12px rgba(0,0,0,0.45)" }}
        onDrag={(event) => {
          const { clientX, clientY } = event as PointerEvent;
          const caixa = caixaNoPonto(clientX, clientY) ?? null;
          sobreRef.current = caixa;
          setSobre(caixa);
        }}
        onDragEnd={(event) => {
          const { clientX, clientY } = event as PointerEvent;
          const caixa = caixaNoPonto(clientX, clientY) ?? sobreRef.current ?? undefined;
          sobreRef.current = null;
          setSobre(null);
          if (caixa !== undefined) colocar(item.indice, caixa);
        }}
        onClick={() => {
          if (Number.isInteger(caixas[item.indice])) colocar(item.indice, undefined);
          else setSelecionado(selecionado === item.indice ? null : item.indice);
        }}
        transition={molaSolta}
      >
        {item.texto.texto}
        {fechada && !certa ? <small className="atv-ficha-certa">→ {questao.categorias[item.texto.categoria]}</small> : null}
      </motion.button>
    );
  };

  const soltas = ordem.filter((item) => !Number.isInteger(caixas[item.indice]));

  return (
    <LayoutGroup id={`categorias-${id}`}>
      <div className="atv-categorias">
        {!fechada ? (
          <div className="atv-fichas" aria-label="Fichas para arrastar">
            {soltas.length ? soltas.map(ficha) : <span className="atv-placeholder">Tudo nas caixas! Toque numa ficha para tirá-la.</span>}
          </div>
        ) : null}
        <div className="atv-caixas" style={{ gridTemplateColumns: `repeat(${questao.categorias.length}, minmax(0, 1fr))` }}>
          {questao.categorias.map((nome, caixa) => (
            <motion.div
              key={caixa}
              data-caixa={caixa}
              data-grupo={id}
              role="button"
              tabIndex={fechada ? -1 : 0}
              aria-label={`Caixa ${nome}`}
              className={`atv-caixa tom-${tons[(caixa + 1) % tons.length]} ${sobre === caixa ? "is-sobre" : ""} ${selecionado !== null ? "is-alvo" : ""}`}
              onClick={() => selecionado !== null && colocar(selecionado, caixa)}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && selecionado !== null) {
                  event.preventDefault();
                  colocar(selecionado, caixa);
                }
              }}
              animate={sobre === caixa ? { scale: 1.03, rotateX: 6 } : { scale: 1, rotateX: 0 }}
              transition={molaSolta}
            >
              <p className="atv-caixa-nome">{nome}</p>
              <div className="atv-caixa-fichas">{ordem.filter((item) => caixas[item.indice] === caixa).map(ficha)}</div>
            </motion.div>
          ))}
        </div>
        {!fechada ? <p className="atv-dica">Arraste as fichas até a caixa certa, ou toque na ficha e depois na caixa.</p> : null}
      </div>
    </LayoutGroup>
  );
}

/** Linha do tempo: arraste as etapas (ou use as setas) até a ordem certa. */
function Sequencia({ questao, semente, valor, fechada, onChange }: { questao: QuestaoSequencia; semente: number; valor?: number[]; fechada: boolean; onChange: (valor: number[]) => void }) {
  const inicial = useMemo(() => embaralhar(questao.itens, semente).map((item) => item.indice), [questao.itens, semente]);
  const ordem = valor && valor.length === questao.itens.length ? valor : inicial;
  const mexeu = Boolean(valor && valor.length === questao.itens.length);

  const mover = (de: number, para: number) => {
    if (para < 0 || para >= ordem.length) return;
    const proxima = [...ordem];
    const [item] = proxima.splice(de, 1);
    proxima.splice(para, 0, item);
    onChange(proxima);
  };

  return (
    <div className="atv-sequencia">
      <Reorder.Group axis="y" values={ordem} onReorder={(proxima: number[]) => !fechada && onChange(proxima)} className="atv-linha-tempo">
        {ordem.map((original, posicao) => (
          <Etapa key={original} original={original} posicao={posicao} texto={questao.itens[original]} total={ordem.length} fechada={fechada} certa={original === posicao} onMover={mover} />
        ))}
      </Reorder.Group>
      {!fechada && !mexeu ? (
        <button type="button" className="atv-link" onClick={() => onChange([...ordem])}>
          esta já é a minha ordem
        </button>
      ) : null}
      {fechada && ordem.some((original, posicao) => original !== posicao) ? (
        <ol className="atv-gabarito atv-gabarito-lista">
          {questao.itens.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function Etapa({ original, posicao, texto, total, fechada, certa, onMover }: { original: number; posicao: number; texto: string; total: number; fechada: boolean; certa: boolean; onMover: (de: number, para: number) => void }) {
  const controles = useDragControls();
  return (
    <Reorder.Item
      value={original}
      dragListener={false}
      dragControls={controles}
      className={`atv-etapa ${fechada ? (certa ? "is-certa" : "is-errada") : ""}`}
      whileDrag={{ scale: 1.04, rotate: -1, zIndex: 20, boxShadow: "0 22px 34px -16px rgba(0,0,0,0.5)" }}
      transition={molaSolta}
    >
      <span className="atv-etapa-numero">{posicao + 1}</span>
      {!fechada ? (
        <span className="atv-etapa-alca" onPointerDown={(event) => controles.start(event)} aria-hidden>
          <GripVertical className="h-4 w-4" />
        </span>
      ) : null}
      <span className="atv-etapa-texto">{texto}</span>
      {!fechada ? (
        <span className="atv-etapa-setas">
          <button type="button" onClick={() => onMover(posicao, posicao - 1)} disabled={posicao === 0} aria-label={`Subir “${texto}”`}>
            <ArrowUp className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onMover(posicao, posicao + 1)} disabled={posicao === total - 1} aria-label={`Descer “${texto}”`}>
            <ArrowDown className="h-4 w-4" />
          </button>
        </span>
      ) : certa ? (
        <Check className="h-4 w-4 text-mint" />
      ) : (
        <X className="h-4 w-4" />
      )}
    </Reorder.Item>
  );
}

function Numerica({ questao, valor, fechada, onChange }: { questao: QuestaoNumerica; valor: string; fechada: boolean; onChange: (valor: string) => void }) {
  const prefixo = /^R\$$/i.test(questao.unidade);
  const certa = fechada && corrigirObjetiva(questao, valor) === 1;
  const formato = (numero: number) => numero.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
  return (
    <div className="atv-numerica">
      <label className={`atv-numero ${fechada ? (certa ? "is-certa" : "is-errada") : ""}`}>
        {prefixo ? <span className="atv-unidade">{questao.unidade}</span> : null}
        <input
          inputMode="decimal"
          value={valor}
          disabled={fechada}
          onChange={(event) => onChange(event.target.value.replace(/[^\d,.\-]/g, "").slice(0, 16))}
          placeholder="0"
          aria-label="Sua resposta em número"
        />
        {!prefixo && questao.unidade ? <span className="atv-unidade">{questao.unidade}</span> : null}
      </label>
      {!fechada && valor && !Number.isFinite(lerNumero(valor)) ? <p className="atv-dica">Escreva só o número (pode usar vírgula).</p> : null}
      {fechada ? (
        <p className="atv-explicacao">
          {!certa ? (
            <>
              <b>Resposta certa:</b> {prefixo ? `${questao.unidade} ` : ""}
              {formato(questao.resposta)}
              {!prefixo && questao.unidade ? ` ${questao.unidade}` : ""}.{" "}
            </>
          ) : null}
          {questao.explicacao}
        </p>
      ) : null}
    </div>
  );
}

function Dissertativa({
  questao,
  valor,
  fechada,
  correcao,
  tentativas,
  corrigindo,
  onChange,
  onAssistente,
}: {
  questao: QuestaoDissertativa;
  valor: string;
  fechada: boolean;
  correcao?: CorrecaoDissertativa;
  tentativas: number;
  corrigindo: boolean;
  onChange: (valor: string) => void;
  onAssistente: () => void;
}) {
  const curta = valor.trim().length < questao.minimo;
  return (
    <div className="atv-dissertativa">
      <textarea value={valor} onChange={(event) => onChange(event.target.value.slice(0, 2000))} disabled={fechada} rows={6} placeholder="Escreva sua resposta aqui." aria-label="Sua resposta" />
      <div className="atv-dissertativa-info">
        <span>N° mínimo de caracteres: {questao.minimo}</span>
        <span className={curta ? "" : "is-ok"}>{valor.trim().length} {valor.trim().length === 1 ? "caractere" : "caracteres"}</span>
      </div>
      {!fechada && tentativas >= 0 ? (
        <div className="atv-assistente">
          <button type="button" className="atv-btn atv-btn-ghost" onClick={onAssistente} disabled={curta || tentativas <= 0 || corrigindo || Boolean(correcao)}>
            {corrigindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Assistente de correção
          </button>
          <span>Tentativas restantes: {tentativas}</span>
        </div>
      ) : null}
      <AnimatePresence>
        {correcao ? (
          <motion.div className="atv-correcao" initial={{ opacity: 0, y: 10, rotateX: -20 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} exit={{ opacity: 0 }} transition={molaSolta}>
            <p className="caderno-note">a Mine leu: {String(correcao.nota).replace(".", ",")}/10</p>
            <p>{correcao.comentario}</p>
            {correcao.faltou ? (
              <p>
                <b>Para melhorar:</b> {correcao.faltou}
              </p>
            ) : null}
            {!fechada && tentativas > 0 ? <p className="atv-dica">Mude a resposta e peça uma nova leitura, se quiser.</p> : null}
            {fechada && correcao.respostaModelo ? (
              <p className="atv-modelo">
                <b>Resposta modelo:</b> {correcao.respostaModelo}
              </p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
