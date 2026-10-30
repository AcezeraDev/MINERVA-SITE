// Carregado sob demanda (React.lazy): a aba Provas — fazer a prova, ver o que errou e estudar aquilo.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, Flag, Layers, Lightbulb, Loader2, NotebookTabs, RotateCcw, Send, Sparkles, Target, Wand2, X } from "lucide-react";
import { PageHeader, subjectContentContext, uid, type AppData, type Flashcard, type Session, type User, type useMemoUserData } from "../main";
import { useSoftMotion } from "../motion";
import { celebrateFrom, floatXp, mineSays } from "../caderno";
import { parseQuiz, type QuizQuestion } from "../../shared/study-parsers.mjs";
import {
  anotarErros,
  contextoEstudo,
  corrigirProva,
  dificuldadesProva,
  embaralharAlternativas,
  lerEstudo,
  letrasProva,
  provaExemplo,
  quantidadesProva,
  registrarIrma,
  resumoCaderno,
  type ErroCaderno,
  type EstudoErro,
} from "../../shared/provas.mjs";
import { xpPerAction } from "../../shared/xp.mjs";
import { askMineTask } from "../mineTask";
import "./provas.css";

type Dados = ReturnType<typeof useMemoUserData>;
type Atualizar = (next: (draft: AppData) => AppData) => void;

type ProvaAtual = {
  id: string;
  assunto: string;
  subjectId: string;
  questoes: QuizQuestion[];
  respostas: Array<number | null>;
  duvidas: boolean[];
  inicio: number;
  /** Refação montada do caderno: não volta a anotar erro, só atualiza o estado de cada um. */
  refacao?: string[];
};

type ProvaFeita = { id: string; assunto: string; acertos: number; total: number; nota: number; quando: number; refacao?: boolean };
type Guardado = { caderno: ErroCaderno[]; historico: ProvaFeita[]; atual: ProvaAtual | null };
type Fase = "inicio" | "prova" | "resultado" | "estudo";

/** Mola padrão do site: passa um pouco do ponto e assenta. */
const mola = { type: "spring", stiffness: 300, damping: 30, mass: 1 } as const;
const molaSolta = { type: "spring", stiffness: 300, damping: 20, mass: 1 } as const;
const maxPorEstudo = 6;
const gerandoProva = ["Lendo o assunto…", "Escrevendo as questões…", "Inventando alternativas que enganam…", "Conferindo o gabarito…"];
const gerandoEstudo = ["Relendo o que você marcou…", "Achando onde a pegadinha pegou…", "Preparando a mini-aula…", "Criando questões-irmãs…"];

function lerGuardado(chave: string): Guardado {
  try {
    const bruto = localStorage.getItem(chave);
    const valor = bruto ? (JSON.parse(bruto) as Partial<Guardado>) : {};
    return { caderno: Array.isArray(valor.caderno) ? valor.caderno : [], historico: Array.isArray(valor.historico) ? valor.historico : [], atual: valor.atual || null };
  } catch {
    return { caderno: [], historico: [], atual: null };
  }
}

function gravar(chave: string, valor: Guardado) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem armazenamento local o caderno vale só enquanto a aba está aberta.
  }
}

/** A prova de exemplo já traz o estudo escrito: abre sem IA, inclusive na demonstração. */
const estudosExemplo = lerEstudo(provaExemplo.estudos);
function estudoDoExemplo(questao: QuizQuestion): EstudoErro | undefined {
  const posicao = provaExemplo.questoes.findIndex((item) => item.question === questao.question);
  return posicao >= 0 ? estudosExemplo.find((item) => item.erro === posicao + 1) : undefined;
}

/** Sem estudo da Mine o erro ainda é estudável: explicação original e a própria questão embaralhada. */
function estudoReserva(erro: ErroCaderno): EstudoErro {
  return {
    erro: 0,
    conceito: "Revendo a questão",
    porque: erro.marcada === null ? "Você deixou esta em branco." : `Você marcou "${erro.questao.options[erro.marcada]}", mas a certa é "${erro.questao.options[erro.questao.correct]}".`,
    aula: erro.questao.explanation || `A resposta certa é "${erro.questao.options[erro.questao.correct]}".`,
    macete: "",
    irma: embaralharAlternativas(erro.questao, erro.atualizadoEm + 7),
  };
}

function formatarTempo(segundos: number) {
  return `${String(Math.floor(segundos / 60)).padStart(2, "0")}:${String(segundos % 60).padStart(2, "0")}`;
}

export function ProvasView({ data, user, update }: { data: Dados; user: User; update: Atualizar }) {
  const reduced = useSoftMotion();
  const chave = `minerva:provas:${user.id}`;
  const [guardado, setGuardado] = useState<Guardado>(() => lerGuardado(chave));
  const [fase, setFase] = useState<Fase>(() => (lerGuardado(chave).atual ? "prova" : "inicio"));
  const [resultado, setResultado] = useState<{ prova: ProvaAtual; xp: number } | null>(null);
  const [estudando, setEstudando] = useState<ErroCaderno[]>([]);
  const [carregando, setCarregando] = useState<"" | "prova" | "estudo">("");
  const [passo, setPasso] = useState(0);
  const [erro, setErro] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const materias = useMemo(() => data.subjects.filter((item) => item.userId === user.id), [data.subjects, user.id]);
  const [subjectId, setSubjectId] = useState<string>("");
  const [tema, setTema] = useState("");
  const [quantidade, setQuantidade] = useState(quantidadesProva[0]);
  const [dificuldade, setDificuldade] = useState<"facil" | "medio" | "dificil">("medio");

  useEffect(() => gravar(chave, guardado), [chave, guardado]);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (!carregando) return;
    const timer = window.setInterval(() => setPasso((valor) => valor + 1), 2600);
    return () => window.clearInterval(timer);
  }, [carregando]);

  const resumo = useMemo(() => resumoCaderno(guardado.caderno), [guardado.caderno]);
  const pendentes = useMemo(() => guardado.caderno.filter((item) => item.status !== "dominado"), [guardado.caderno]);
  const materia = materias.find((item) => item.id === subjectId);
  const assunto = materia?.name || tema.trim();

  const topo = () => window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });

  const comecar = (questoes: QuizQuestion[], meta: { assunto: string; subjectId: string; refacao?: string[] }) => {
    const prova: ProvaAtual = { id: uid("prova"), ...meta, questoes, respostas: questoes.map(() => null), duvidas: questoes.map(() => false), inicio: Date.now() };
    setGuardado((atual) => ({ ...atual, atual: prova }));
    setFase("prova");
    topo();
  };

  const gerarProva = async () => {
    if (!assunto) {
      setErro("Escolha uma matéria ou escreva o assunto da prova.");
      return;
    }
    setErro("");
    setPasso(0);
    setCarregando("prova");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const nivel = dificuldadesProva.find((item) => item.id === dificuldade)?.prompt || "media";
    try {
      const resposta = await askMineTask(
        {
          task: "quiz",
          prompt: `Gere ${quantidade} questoes de multipla escolha sobre ${assunto}, com nivel de dificuldade ${nivel}; use enunciados variados e alternativas erradas plausiveis, como numa prova de verdade. Distribua a letra correta entre A, B, C e D.`,
          context: materia ? subjectContentContext(materia, data.materials.filter((item) => item.subjectId === materia.id)) : `Tema solicitado: ${assunto}. Use conhecimento geral confiavel e adequado ao estudo do tema.`,
          outputTokens: Math.max(1600, quantidade * 230),
        },
        { signal: controller.signal, timeoutMs: 120_000 },
      );
      const questoes = parseQuiz(resposta).filter((item) => item.options.length === 4).slice(0, quantidade);
      if (questoes.length < Math.min(3, quantidade)) throw new Error("A prova veio incompleta. Tente gerar de novo.");
      comecar(questoes, { assunto, subjectId: materia?.id || "" });
      mineSays("Prova na mesa! Sem pressa e sem colar 😉", "happy");
    } catch (error) {
      if (!controller.signal.aborted) setErro(error instanceof Error ? error.message : "A Mine não conseguiu montar a prova agora.");
    } finally {
      setCarregando("");
    }
  };

  const entregar = (prova: ProvaAtual) => {
    const nota = corrigirProva(prova.questoes, prova.respostas);
    let xp = 0;
    setGuardado((atual) => {
      let caderno = atual.caderno;
      if (prova.refacao) {
        // refação: acertar de novo também prova que o erro foi superado
        prova.refacao.forEach((id, indice) => {
          caderno = registrarIrma(caderno, id, nota.itens[indice]?.certa === true);
        });
      } else {
        caderno = anotarErros(caderno, nota.erros, { provaId: prova.id, assunto: prova.assunto, subjectId: prova.subjectId });
      }
      const feita: ProvaFeita = { id: prova.id, assunto: prova.assunto, acertos: nota.acertos, total: nota.total, nota: nota.nota, quando: Date.now(), refacao: Boolean(prova.refacao) };
      return { caderno, historico: [feita, ...atual.historico].slice(0, 20), atual: null };
    });
    // Sessão só com matéria de verdade, como no simulado da matéria: tema solto
    // não tem a quem ser atribuído no Progresso e no ranking.
    const subject = materias.find((item) => item.id === prova.subjectId);
    if (subject && !prova.refacao) {
      xp = xpPerAction.prova;
      const session: Session = {
        id: uid("session"),
        userId: user.id,
        subjectId: subject.id,
        title: `Prova de ${subject.name}: ${nota.acertos}/${nota.total}`,
        kind: "Prova",
        createdAt: Date.now(),
        correctAnswers: nota.acertos,
        questionsAnswered: nota.total,
      };
      update((draft) => ({ ...draft, sessions: [...draft.sessions, session] }));
    }
    setResultado({ prova, xp });
    setFase("resultado");
    topo();
    if (nota.acertos === nota.total) mineSays("Gabaritou! Nem precisei corrigir 🤩", "wow");
    else mineSays(`${nota.erros.length} ${nota.erros.length === 1 ? "erro" : "erros"} pra virar acerto. Bora estudar?`, "think");
  };

  const estudar = async (lista: ErroCaderno[]) => {
    const alvo = lista.slice(0, maxPorEstudo);
    if (!alvo.length) return;
    setErro("");
    // o que já tem estudo (guardado ou do exemplo) não volta para a Mine
    const prontos = alvo.map((item) => ({ ...item, estudo: item.estudo || estudoDoExemplo(item.questao) }));
    const faltam = prontos.filter((item) => !item.estudo);
    if (faltam.length) {
      setPasso(0);
      setCarregando("estudo");
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const resposta = await askMineTask(
          {
            task: "prova-estudo",
            prompt: `Crie ${faltam.length} blocos de estudo, um para cada erro, na ordem do contexto.`,
            context: contextoEstudo(faltam),
            outputTokens: 600 + faltam.length * 420,
          },
          { signal: controller.signal, timeoutMs: 150_000 },
        );
        const estudos = lerEstudo(resposta);
        faltam.forEach((item, indice) => {
          item.estudo = estudos.find((estudo) => estudo.erro === indice + 1);
        });
      } catch (error) {
        if (controller.signal.aborted) {
          setCarregando("");
          return;
        }
        setErro(`${error instanceof Error ? error.message : "A Mine não respondeu."} Vou te mostrar a explicação da própria prova.`);
      } finally {
        setCarregando("");
      }
    }
    const comEstudo = prontos.map((item) => ({ ...item, estudo: item.estudo || estudoReserva(item) }));
    // guarda o estudo da Mine para não gastar outra geração na próxima revisão
    setGuardado((atual) => ({
      ...atual,
      caderno: atual.caderno.map((item) => {
        const novo = comEstudo.find((estudo) => estudo.id === item.id);
        return novo && novo.estudo.erro > 0 ? { ...item, estudo: novo.estudo } : item;
      }),
    }));
    setEstudando(comEstudo);
    setFase("estudo");
    topo();
  };

  const refazer = () => {
    const lista = pendentes.slice(0, 10);
    comecar(
      lista.map((item, indice) => embaralharAlternativas(item.questao, Date.now() + indice * 31)),
      { assunto: "Refação dos erros", subjectId: "", refacao: lista.map((item) => item.id) },
    );
  };

  const virarFlashcards = (lista: ErroCaderno[]) => {
    const comMateria = lista.filter((item) => materias.some((materiaItem) => materiaItem.id === item.subjectId));
    if (!comMateria.length) return 0;
    const agora = Date.now();
    const novos: Flashcard[] = comMateria.map((item) => ({
      id: uid("flashcard"),
      userId: user.id,
      subjectId: item.subjectId,
      front: item.questao.question,
      back: `${item.questao.options[item.questao.correct]}. ${item.estudo?.macete || item.questao.explanation}`.trim(),
      level: 0,
      dueAt: agora,
      reps: 0,
      lapses: 0,
      createdAt: agora,
    }));
    update((draft) => {
      const frentes = new Set(draft.flashcards.filter((card) => card.userId === user.id).map((card) => card.front));
      return { ...draft, flashcards: [...draft.flashcards, ...novos.filter((card) => !frentes.has(card.front))] };
    });
    return novos.length;
  };

  // o rascunho atrasado de uma prova já entregue não pode ressuscitá-la
  const salvarProva = (prova: ProvaAtual) => setGuardado((atual) => (atual.atual?.id === prova.id ? { ...atual, atual: prova } : atual));

  let tela: React.ReactNode;
  if (fase === "prova" && guardado.atual) {
    tela = (
      <FolhaProva
        key={guardado.atual.id}
        inicial={guardado.atual}
        onSalvar={salvarProva}
        onEntregar={entregar}
        onSair={() => {
          setFase("inicio");
          topo();
        }}
        onDescartar={() => {
          setGuardado((atual) => ({ ...atual, atual: null }));
          setFase("inicio");
        }}
      />
    );
  } else if (fase === "resultado" && resultado) {
    // só o que foi errado nesta prova, não tudo que ela tem em comum com o caderno
    const ids = new Set(corrigirProva(resultado.prova.questoes, resultado.prova.respostas).erros.map((item) => item.questao.question.trim().toLowerCase()));
    const errosDaProva = guardado.caderno.filter((item) => ids.has(item.questao.question.trim().toLowerCase()) && item.status !== "dominado");
    tela = (
      <Resultado
        prova={resultado.prova}
        xp={resultado.xp}
        erro={erro}
        onEstudar={() => estudar(errosDaProva)}
        podeEstudar={errosDaProva.length > 0}
        onVoltar={() => {
          setFase("inicio");
          setErro("");
          topo();
        }}
      />
    );
  } else if (fase === "estudo" && estudando.length) {
    tela = (
      <Estudo
        key={estudando.map((item) => item.id).join("|")}
        itens={estudando}
        aviso={erro}
        onIrma={(id, acertou) => setGuardado((atual) => ({ ...atual, caderno: registrarIrma(atual.caderno, id, acertou) }))}
        onFlashcards={virarFlashcards}
        onVoltar={() => {
          setFase("inicio");
          setErro("");
          topo();
        }}
      />
    );
  } else {
    tela = (
      <div className="prv-home">
        <PageHeader
          eyebrow="Provas · erros · estudo"
          title="Prova da Mine"
          subtitle="Faça a prova, veja exatamente onde errou e estude só aquilo. Cada erro vira uma mini-aula com um macete e uma questão-irmã; acertou a irmã, o erro sai do caderno."
        />

        <Trilha reduced={reduced} resumo={resumo} />

        {guardado.atual ? (
          <motion.button type="button" className="prv-continuar" onClick={() => setFase("prova")} whileHover={reduced ? undefined : { y: -3 }} transition={mola}>
            <span className="prv-continuar-tag">prova em andamento</span>
            <span className="prv-continuar-titulo">{guardado.atual.assunto}</span>
            <span className="prv-continuar-info">
              {guardado.atual.respostas.filter((item) => item !== null).length} de {guardado.atual.questoes.length} respondidas — continuar
            </span>
          </motion.button>
        ) : null}

        <div className="prv-grade">
          <section className="prv-card prv-config" aria-label="Montar prova">
            <p className="caderno-note">nova prova</p>
            {materias.length ? (
              <>
                <p className="prv-label">Das suas matérias (vale XP)</p>
                <LayoutGroup id="prv-materias">
                  <div className="prv-chips" role="radiogroup" aria-label="Matéria">
                    {materias.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="radio"
                        aria-checked={subjectId === item.id}
                        className={`prv-chip ${subjectId === item.id ? "is-on" : ""}`}
                        onClick={() => {
                          setSubjectId(subjectId === item.id ? "" : item.id);
                          setTema("");
                        }}
                      >
                        {subjectId === item.id ? <motion.span layoutId="prv-chip-grifo" className="prv-chip-grifo" transition={mola} /> : null}
                        <span className="prv-chip-cor" style={{ background: item.color }} aria-hidden />
                        <span className="relative">{item.name}</span>
                      </button>
                    ))}
                  </div>
                </LayoutGroup>
              </>
            ) : null}

            <label className="prv-campo">
              <span className="prv-label">{materias.length ? "…ou qualquer assunto" : "Assunto da prova"}</span>
              <input
                value={tema}
                onChange={(event) => {
                  setTema(event.target.value.slice(0, 120));
                  setSubjectId("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") gerarProva();
                }}
                placeholder="Ex.: equações do 2º grau, Revolução Francesa, present perfect"
              />
            </label>

            <div className="prv-linha">
              <div>
                <p className="prv-label">Questões</p>
                <div className="prv-segmento" role="radiogroup" aria-label="Quantidade de questões">
                  {quantidadesProva.map((item) => (
                    <button key={item} type="button" role="radio" aria-checked={quantidade === item} className={quantidade === item ? "is-on" : ""} onClick={() => setQuantidade(item)}>
                      {quantidade === item ? <motion.span layoutId="prv-qtd" className="prv-segmento-bolha" transition={mola} /> : null}
                      <span className="relative">{item}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="prv-label">Dificuldade</p>
                <div className="prv-segmento" role="radiogroup" aria-label="Dificuldade">
                  {dificuldadesProva.map((item) => (
                    <button key={item.id} type="button" role="radio" aria-checked={dificuldade === item.id} className={dificuldade === item.id ? "is-on" : ""} onClick={() => setDificuldade(item.id)}>
                      {dificuldade === item.id ? <motion.span layoutId="prv-dif" className="prv-segmento-bolha" transition={mola} /> : null}
                      <span className="relative">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {erro ? (
              <p className="prv-erro" role="alert">
                {erro}
              </p>
            ) : null}
            <div className="prv-acoes">
              <motion.button type="button" className="prv-btn caderno-btn-pen" onClick={gerarProva} disabled={Boolean(carregando)} whileTap={{ scale: 0.96 }} transition={mola}>
                <Wand2 className="h-4 w-4" /> Gerar prova
              </motion.button>
              <button type="button" className="prv-btn prv-btn-ghost" onClick={() => comecar(provaExemplo.questoes, { assunto: provaExemplo.assunto, subjectId: "" })}>
                <BookOpenCheck className="h-4 w-4" /> Prova de exemplo
              </button>
            </div>
            {guardado.atual ? <p className="prv-dica">Gerar uma nova substitui a prova em andamento.</p> : null}
          </section>

          <CadernoErros
            caderno={guardado.caderno}
            resumo={resumo}
            reduced={reduced}
            ocupado={Boolean(carregando)}
            onEstudar={() => estudar(pendentes)}
            onRefazer={refazer}
            onEstudarUm={(item) => estudar([item])}
            historico={guardado.historico}
          />
        </div>
      </div>
    );
  }

  const mensagens = carregando === "estudo" ? gerandoEstudo : gerandoProva;
  return (
    <div className="prv-page">
      {/* Só entrada, sem AnimatePresence: a saída em mode="wait" travava com a
          prova (relógio e animações internas) e a tela seguinte nunca montava.
          Só y e opacidade: parado, o transform volta a "none" e não prende os
          elementos fixed (a armadilha da virada de página do App). */}
      <motion.div key={fase} initial={reduced ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={mola}>
        {tela}
      </motion.div>

      <AnimatePresence>
        {carregando ? (
          <motion.div className="prv-overlay" role="status" aria-live="polite" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="prv-overlay-card" initial={reduced ? false : { scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} transition={molaSolta}>
              <FolhaVoando reduced={reduced} />
              <p className="caderno-note">{carregando === "estudo" ? "preparando seu estudo" : "montando sua prova"}</p>
              <AnimatePresence mode="wait">
                <motion.p key={passo % mensagens.length} className="prv-overlay-passo" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                  {mensagens[passo % mensagens.length]}
                </motion.p>
              </AnimatePresence>
              <button
                type="button"
                className="prv-link"
                onClick={() => {
                  abortRef.current?.abort();
                  setCarregando("");
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

/** As três etapas da aba, ligadas por um traço de caneta que se desenha. */
function Trilha({ reduced, resumo }: { reduced: boolean; resumo: ReturnType<typeof resumoCaderno> }) {
  const etapas = [
    { icone: Target, titulo: "Faça a prova", texto: "Da sua matéria ou de qualquer assunto, sem ver a resposta." },
    { icone: X, titulo: "Veja o que errou", texto: "O que você marcou, a certa e por quê." },
    { icone: Lightbulb, titulo: "Estude o erro", texto: "Mini-aula, macete e uma questão-irmã para conferir." },
  ];
  return (
    <section className="prv-trilha" aria-label="Como funciona">
      <svg className="prv-trilha-traco" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden>
        <motion.path
          d="M20 22 C 180 4, 320 36, 500 20 S 820 6, 980 22"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </svg>
      {etapas.map((etapa, indice) => {
        const Icone = etapa.icone;
        return (
          <motion.div
            key={etapa.titulo}
            className={`prv-etapa prv-etapa-${indice + 1}`}
            initial={reduced ? false : { opacity: 0, y: 22, rotate: indice % 2 ? 3 : -3, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, rotate: indice % 2 ? 0.8 : -0.8, scale: 1 }}
            whileHover={reduced ? undefined : { y: -5, rotate: 0 }}
            transition={{ ...molaSolta, delay: 0.12 + indice * 0.12 }}
          >
            <span className="prv-etapa-num">{indice + 1}</span>
            <Icone className="prv-etapa-icone" aria-hidden />
            <b>{etapa.titulo}</b>
            <span>{etapa.texto}</span>
          </motion.div>
        );
      })}
      {resumo.total ? (
        <motion.p className="prv-trilha-placar" initial={reduced ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...molaSolta, delay: 0.5 }}>
          <b>{resumo.dominados}</b> de <b>{resumo.total}</b> erros já viraram acerto
        </motion.p>
      ) : null}
    </section>
  );
}

function FolhaVoando({ reduced }: { reduced: boolean }) {
  return (
    <div className="prv-folhas" aria-hidden>
      {[0, 1, 2].map((indice) => (
        <motion.span
          key={indice}
          className="prv-folha"
          style={{ x: (indice - 1) * 26 }}
          animate={reduced ? undefined : { y: [0, -14, 0], rotate: [indice * 6 - 6, indice * 6 - 2, indice * 6 - 6] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: indice * 0.18, ease: "easeInOut" }}
        >
          <i />
          <i />
          <i />
        </motion.span>
      ))}
    </div>
  );
}

function FolhaProva({
  inicial,
  onSalvar,
  onEntregar,
  onSair,
  onDescartar,
}: {
  inicial: ProvaAtual;
  onSalvar: (prova: ProvaAtual) => void;
  onEntregar: (prova: ProvaAtual) => void;
  onSair: () => void;
  onDescartar: () => void;
}) {
  const reduced = useSoftMotion();
  const [prova, setProva] = useState(inicial);
  const [indice, setIndice] = useState(() => Math.max(0, inicial.respostas.findIndex((item) => item === null)));
  const [direcao, setDirecao] = useState(1);
  const [confirmar, setConfirmar] = useState(false);
  const [segundos, setSegundos] = useState(() => Math.floor((Date.now() - inicial.inicio) / 1000));
  const total = prova.questoes.length;
  const questao = prova.questoes[indice];
  const feitas = prova.respostas.filter((item) => item !== null).length;
  const brancos = total - feitas;

  useEffect(() => {
    const timer = window.setTimeout(() => onSalvar(prova), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prova]);
  useEffect(() => {
    const timer = window.setInterval(() => setSegundos(Math.floor((Date.now() - prova.inicio) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [prova.inicio]);

  const ir = (novo: number) => {
    if (novo < 0 || novo >= total) return;
    setDirecao(novo > indice ? 1 : -1);
    setIndice(novo);
    setConfirmar(false);
  };

  const marcar = (opcao: number) => {
    setProva((atual) => ({ ...atual, respostas: atual.respostas.map((item, posicao) => (posicao === indice ? (item === opcao ? null : opcao) : item)) }));
    setConfirmar(false);
  };

  useEffect(() => {
    const tecla = (event: KeyboardEvent) => {
      const alvo = event.target as HTMLElement | null;
      if (alvo && /input|textarea|select/i.test(alvo.tagName)) return;
      const letra = event.key.toUpperCase();
      const posicao = letrasProva.indexOf(letra);
      if (posicao >= 0 && posicao < questao.options.length) marcar(posicao);
      else if (/^[1-4]$/.test(event.key)) marcar(Number(event.key) - 1);
      else if (event.key === "ArrowRight") ir(indice + 1);
      else if (event.key === "ArrowLeft") ir(indice - 1);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  return (
    <div className="prv-folha-prova">
      <div className="prv-barra">
        <button type="button" className="prv-link" onClick={onSair}>
          <ArrowLeft className="h-4 w-4" /> sair (fica salva)
        </button>
        <span className="prv-barra-assunto">{prova.assunto}</span>
        <span className="prv-relogio" aria-label="Tempo de prova">
          {formatarTempo(segundos)}
        </span>
      </div>

      <div className="prv-pontos" role="tablist" aria-label="Questões">
        {prova.questoes.map((_, posicao) => (
          <button
            key={posicao}
            type="button"
            role="tab"
            aria-selected={posicao === indice}
            aria-label={`Questão ${posicao + 1}${prova.respostas[posicao] !== null ? ", respondida" : ""}${prova.duvidas[posicao] ? ", com dúvida" : ""}`}
            className={`prv-ponto ${prova.respostas[posicao] !== null ? "is-feita" : ""} ${prova.duvidas[posicao] ? "is-duvida" : ""}`}
            onClick={() => ir(posicao)}
          >
            {posicao === indice ? <motion.span layoutId="prv-ponto-atual" className="prv-ponto-atual" transition={mola} /> : null}
            <span className="relative">{posicao + 1}</span>
          </button>
        ))}
      </div>

      <div className="prv-questao-palco">
        {/* popLayout: a próxima questão entra na hora; com "wait" ela ficava
            esperando a saída da anterior, que travava com o rAF lento */}
        <AnimatePresence mode="popLayout" custom={direcao} initial={false}>
          <motion.article
            key={indice}
            className="prv-questao"
            custom={direcao}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: 60 * direcao, rotateY: 12 * direcao }}
            animate={{ opacity: 1, x: 0, rotateY: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: -60 * direcao, rotateY: -12 * direcao }}
            transition={mola}
          >
            <p className="prv-questao-num">
              Questão {indice + 1} <small>de {total}</small>
            </p>
            <h2 className="prv-enunciado">{questao.question}</h2>
            <LayoutGroup id={`prv-q-${indice}`}>
              <ul className="prv-alternativas">
                {questao.options.map((opcao, posicao) => {
                  const marcada = prova.respostas[indice] === posicao;
                  return (
                    <li key={posicao}>
                      <motion.button
                        type="button"
                        className={`prv-alt ${marcada ? "is-marcada" : ""}`}
                        aria-pressed={marcada}
                        onClick={() => marcar(posicao)}
                        whileHover={reduced ? undefined : { x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        transition={mola}
                      >
                        {marcada ? <motion.span layoutId="prv-alt-grifo" className="prv-alt-grifo" transition={mola} /> : null}
                        <span className="prv-alt-letra">{letrasProva[posicao]}</span>
                        <span className="prv-alt-texto">{opcao}</span>
                      </motion.button>
                    </li>
                  );
                })}
              </ul>
            </LayoutGroup>
          </motion.article>
        </AnimatePresence>
      </div>

      <div className="prv-rodape">
        <button
          type="button"
          className={`prv-btn prv-btn-ghost ${prova.duvidas[indice] ? "is-on" : ""}`}
          aria-pressed={prova.duvidas[indice]}
          onClick={() => setProva((atual) => ({ ...atual, duvidas: atual.duvidas.map((item, posicao) => (posicao === indice ? !item : item)) }))}
        >
          <Flag className="h-4 w-4" /> {prova.duvidas[indice] ? "Com dúvida" : "Marcar dúvida"}
        </button>
        <div className="prv-rodape-nav">
          <button type="button" className="prv-btn prv-btn-ghost" onClick={() => ir(indice - 1)} disabled={indice === 0} aria-label="Questão anterior">
            <ArrowLeft className="h-4 w-4" />
          </button>
          {indice < total - 1 ? (
            <button type="button" className="prv-btn caderno-btn-pen" onClick={() => ir(indice + 1)}>
              Próxima <ArrowRight className="h-4 w-4" />
            </button>
          ) : null}
          <motion.button
            type="button"
            className={`prv-btn ${indice === total - 1 ? "caderno-btn-pen" : "prv-btn-ghost"}`}
            whileTap={{ scale: 0.96 }}
            transition={mola}
            onClick={() => {
              if (brancos > 0 && !confirmar) setConfirmar(true);
              else onEntregar(prova);
            }}
          >
            <Send className="h-4 w-4" /> Entregar
          </motion.button>
        </div>
      </div>
      <AnimatePresence>
        {confirmar ? (
          <motion.p className="prv-aviso" role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            Faltam {brancos} {brancos === 1 ? "questão" : "questões"} em branco — elas contam como erro. Aperte <b>Entregar</b> de novo para confirmar.
          </motion.p>
        ) : null}
      </AnimatePresence>
      <p className="prv-dica">
        Atalhos: A–D ou 1–4 marcam, ← → trocam de questão. ·{" "}
        <button type="button" className="prv-link" onClick={onDescartar}>
          descartar prova
        </button>
      </p>
    </div>
  );
}

/** Nota que sobe de 0 até o valor, como quem confere o placar. */
function NotaContando({ valor, reduced }: { valor: number; reduced: boolean }) {
  const [mostrado, setMostrado] = useState(reduced ? valor : 0);
  useEffect(() => {
    if (reduced) {
      setMostrado(valor);
      return;
    }
    let quadro = 0;
    const inicio = performance.now();
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / 900);
      setMostrado(valor * (1 - Math.pow(1 - t, 3)));
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, reduced]);
  return <>{mostrado.toFixed(1).replace(".", ",")}</>;
}

function Resultado({ prova, xp, erro, podeEstudar, onEstudar, onVoltar }: { prova: ProvaAtual; xp: number; erro: string; podeEstudar: boolean; onEstudar: () => void; onVoltar: () => void }) {
  const reduced = useSoftMotion();
  const nota = useMemo(() => corrigirProva(prova.questoes, prova.respostas), [prova]);
  const [filtro, setFiltro] = useState<"erros" | "todas">(nota.erros.length ? "erros" : "todas");
  const [aberta, setAberta] = useState<number | null>(nota.erros[0]?.indice ?? null);
  const carimboRef = useRef<HTMLDivElement>(null);
  const comDuvida = nota.itens.filter((item) => item.certa && prova.duvidas[item.indice]).length;
  const tom = nota.nota >= 7 ? "bom" : nota.nota >= 5 ? "medio" : "baixo";

  useEffect(() => {
    if (!carimboRef.current) return;
    if (xp) floatXp(`+${xp} XP`, carimboRef.current);
    if (nota.nota >= 7) celebrateFrom(carimboRef.current, { count: nota.acertos === nota.total ? 48 : 28 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lista = filtro === "erros" ? nota.erros : nota.itens;

  return (
    <div className="prv-resultado">
      <button type="button" className="prv-link prv-voltar" onClick={onVoltar}>
        <ArrowLeft className="h-4 w-4" /> voltar
      </button>
      <section className="prv-placar">
        <motion.div
          ref={carimboRef}
          className={`prv-carimbo is-${tom}`}
          initial={reduced ? false : { scale: 2.4, rotate: -24, opacity: 0 }}
          animate={{ scale: 1, rotate: -8, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 16, mass: 1, delay: 0.15 }}
        >
          <span className="prv-carimbo-nota">
            <NotaContando valor={nota.nota} reduced={reduced} />
          </span>
          <span className="prv-carimbo-rotulo">nota</span>
        </motion.div>
        <div className="prv-placar-texto">
          <p className="caderno-note">{prova.refacao ? "refação dos erros" : prova.assunto}</p>
          <h1>
            {nota.acertos} de {nota.total} certas
          </h1>
          <div className="prv-placar-chips">
            <span className="is-certa">
              <Check className="h-4 w-4" /> {nota.acertos} acertos
            </span>
            <span className="is-errada">
              <X className="h-4 w-4" /> {nota.erros.length} erros
            </span>
            {comDuvida ? (
              <span className="is-duvida">
                <Flag className="h-4 w-4" /> {comDuvida} certas no chute
              </span>
            ) : null}
          </div>
          {erro ? (
            <p className="prv-erro" role="alert">
              {erro}
            </p>
          ) : null}
          <div className="prv-acoes">
            {podeEstudar ? (
              <motion.button
                type="button"
                className="prv-btn caderno-btn-pen prv-btn-grande"
                onClick={onEstudar}
                initial={reduced ? false : { scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={reduced ? undefined : { scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={{ ...molaSolta, delay: 0.6 }}
              >
                <Sparkles className="h-4 w-4" /> Estudar o que errei
              </motion.button>
            ) : nota.erros.length ? null : (
              <p className="prv-dica">Nenhum erro para estudar. Que tal uma prova mais difícil?</p>
            )}
            <button type="button" className="prv-btn prv-btn-ghost" onClick={onVoltar}>
              Nova prova
            </button>
          </div>
        </div>
      </section>

      <div className="prv-filtro" role="tablist" aria-label="Mostrar">
        {(["erros", "todas"] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={filtro === item} className={filtro === item ? "is-on" : ""} onClick={() => setFiltro(item)}>
            {filtro === item ? <motion.span layoutId="prv-filtro" className="prv-segmento-bolha" transition={mola} /> : null}
            <span className="relative">{item === "erros" ? `Só os erros (${nota.erros.length})` : `Todas (${nota.total})`}</span>
          </button>
        ))}
      </div>

      <motion.ul className="prv-correcao" layout>
        <AnimatePresence initial={false}>
          {lista.map((item, ordem) => {
            const aberto = aberta === item.indice;
            return (
              <motion.li
                key={item.indice}
                layout
                className={`prv-corrigida ${item.certa ? "is-certa" : "is-errada"}`}
                initial={reduced ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ ...mola, delay: reduced ? 0 : Math.min(ordem, 8) * 0.05 }}
              >
                <button type="button" className="prv-corrigida-topo" aria-expanded={aberto} onClick={() => setAberta(aberto ? null : item.indice)}>
                  <span className="prv-corrigida-marca">{item.certa ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}</span>
                  <span className="prv-corrigida-q">
                    <small>Questão {item.indice + 1}</small>
                    {item.questao.question}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {aberto ? (
                    <motion.div className="prv-corrigida-corpo" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={mola}>
                      <ul>
                        {item.questao.options.map((opcao, posicao) => (
                          <li
                            key={posicao}
                            className={`${posicao === item.questao.correct ? "is-gabarito" : ""} ${posicao === item.marcada && !item.certa ? "is-sua" : ""}`}
                          >
                            <b>{letrasProva[posicao]}</b> {opcao}
                            {posicao === item.questao.correct ? <em>certa</em> : posicao === item.marcada ? <em>sua</em> : null}
                          </li>
                        ))}
                      </ul>
                      {item.marcada === null ? <p className="prv-branco">Você deixou em branco.</p> : null}
                      {item.questao.explanation ? <p className="prv-explicacao">{item.questao.explanation}</p> : null}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </motion.ul>
    </div>
  );
}

function Estudo({
  itens,
  aviso,
  onIrma,
  onFlashcards,
  onVoltar,
}: {
  itens: ErroCaderno[];
  aviso: string;
  onIrma: (id: string, acertou: boolean) => void;
  onFlashcards: (lista: ErroCaderno[]) => number;
  onVoltar: () => void;
}) {
  const reduced = useSoftMotion();
  const [posicao, setPosicao] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [cartoes, setCartoes] = useState<number | null>(null);
  const fim = posicao >= itens.length;
  const item = itens[Math.min(posicao, itens.length - 1)];
  const estudo = item.estudo as EstudoErro;
  const escolhida = respostas[item.id];
  const respondeu = escolhida !== undefined;
  const acertos = itens.filter((erro) => respostas[erro.id] === erro.estudo?.irma.correct).length;
  const temMateria = itens.some((erro) => erro.subjectId);

  const responder = (opcao: number, alvo: Element | null) => {
    if (respondeu) return;
    const acertou = opcao === estudo.irma.correct;
    setRespostas((atual) => ({ ...atual, [item.id]: opcao }));
    onIrma(item.id, acertou);
    if (acertou) {
      celebrateFrom(alvo, { count: 22, spread: 0.8 });
      mineSays(["Aprendeu!", "Agora foi!", "Erro virou acerto!"][Math.floor(Math.random() * 3)], "happy");
    } else mineSays("Ainda não. Relê o macete comigo.", "think");
  };

  if (fim) {
    return (
      <div className="prv-estudo-fim">
        <motion.div className="prv-card prv-fim-card" initial={reduced ? false : { scale: 0.85, rotate: -2, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={molaSolta}>
          <p className="caderno-note">estudo concluído</p>
          <h1>
            {acertos} de {itens.length} {acertos === 1 ? "erro virou" : "erros viraram"} acerto
          </h1>
          <p className="prv-dica">
            {acertos === itens.length
              ? "Tudo dominado. Esses erros saíram do caderno."
              : "Os que ainda não foram ficam no caderno de erros para a próxima rodada."}
          </p>
          <div className="prv-acoes">
            {temMateria ? (
              <button
                type="button"
                className="prv-btn prv-btn-ghost"
                disabled={cartoes !== null}
                onClick={(event) => {
                  const feitos = onFlashcards(itens);
                  setCartoes(feitos);
                  if (feitos) floatXp(`${feitos} flashcards`, event.currentTarget);
                }}
              >
                <Layers className="h-4 w-4" /> {cartoes === null ? "Virar flashcards" : `${cartoes} flashcards na revisão`}
              </button>
            ) : null}
            <button type="button" className="prv-btn caderno-btn-pen" onClick={onVoltar}>
              <NotebookTabs className="h-4 w-4" /> Voltar ao caderno
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="prv-estudo">
      <div className="prv-barra">
        <button type="button" className="prv-link" onClick={onVoltar}>
          <ArrowLeft className="h-4 w-4" /> sair do estudo
        </button>
        <span className="prv-barra-assunto">
          Erro {posicao + 1} de {itens.length}
        </span>
        <span className="prv-progresso" aria-hidden>
          <motion.i animate={{ scaleX: (posicao + (respondeu ? 1 : 0)) / itens.length }} transition={mola} />
        </span>
      </div>
      {aviso ? <p className="prv-erro">{aviso}</p> : null}

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={item.id}
          className="prv-estudo-grade"
          initial={reduced ? { opacity: 0 } : { opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, x: -50 }}
          transition={mola}
        >
          <section className="prv-card prv-licao">
            <p className="caderno-note">{item.assunto}</p>
            <h2 className="prv-conceito">
              <span>{estudo.conceito}</span>
            </h2>
            <div className="prv-original">
              <p>{item.questao.question}</p>
              <p className="is-sua">
                <X className="h-4 w-4" /> {item.marcada === null ? "Em branco" : `${letrasProva[item.marcada]}) ${item.questao.options[item.marcada]}`}
              </p>
              <p className="is-gabarito">
                <Check className="h-4 w-4" /> {letrasProva[item.questao.correct]}) {item.questao.options[item.questao.correct]}
              </p>
            </div>
            {estudo.porque ? (
              <motion.div className="prv-bloco prv-porque" initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...mola, delay: 0.1 }}>
                <b>Por que você caiu</b>
                <p>{estudo.porque}</p>
              </motion.div>
            ) : null}
            <motion.div className="prv-bloco prv-aula" initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...mola, delay: 0.2 }}>
              <b>Mini-aula</b>
              <p>{estudo.aula}</p>
            </motion.div>
            {estudo.macete ? (
              <motion.div
                className="prv-postit"
                initial={reduced ? false : { opacity: 0, scale: 0.6, rotate: -14, y: -20 }}
                animate={{ opacity: 1, scale: 1, rotate: -2.5, y: 0 }}
                whileHover={reduced ? undefined : { rotate: 0, scale: 1.03 }}
                transition={{ ...molaSolta, delay: 0.35 }}
              >
                <Lightbulb className="h-4 w-4" aria-hidden />
                <span>
                  <b>Macete</b> {estudo.macete}
                </span>
              </motion.div>
            ) : null}
          </section>

          <section className="prv-card prv-irma" aria-label="Questão-irmã">
            <p className="caderno-note">agora prova que aprendeu</p>
            <h3 className="prv-enunciado">{estudo.irma.question}</h3>
            <ul className="prv-alternativas">
              {estudo.irma.options.map((opcao, opcaoIndice) => {
                const certa = opcaoIndice === estudo.irma.correct;
                const marcada = escolhida === opcaoIndice;
                const estado = respondeu ? (certa ? "is-certa" : marcada ? "is-errada" : "is-apagada") : "";
                return (
                  <li key={opcaoIndice}>
                    <motion.button
                      type="button"
                      className={`prv-alt ${estado}`}
                      disabled={respondeu}
                      onClick={(event) => responder(opcaoIndice, event.currentTarget)}
                      whileHover={respondeu || reduced ? undefined : { x: 4 }}
                      animate={respondeu && marcada && !certa && !reduced ? { x: [0, -8, 8, -5, 5, 0] } : undefined}
                      transition={respondeu ? { duration: 0.4 } : mola}
                    >
                      <span className="prv-alt-letra">{letrasProva[opcaoIndice]}</span>
                      <span className="prv-alt-texto">{opcao}</span>
                    </motion.button>
                  </li>
                );
              })}
            </ul>
            <AnimatePresence>
              {respondeu ? (
                <motion.div className={`prv-retorno ${escolhida === estudo.irma.correct ? "is-certa" : "is-errada"}`} initial={reduced ? false : { opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={molaSolta}>
                  <b>{escolhida === estudo.irma.correct ? "Erro virou acerto!" : "Ainda não — fica no caderno."}</b>
                  {estudo.irma.explanation ? <p>{estudo.irma.explanation}</p> : null}
                  <button type="button" className="prv-btn caderno-btn-pen" onClick={() => setPosicao((valor) => valor + 1)}>
                    {posicao + 1 < itens.length ? "Próximo erro" : "Ver resumo"} <ArrowRight className="h-4 w-4" />
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function CadernoErros({
  caderno,
  resumo,
  reduced,
  ocupado,
  historico,
  onEstudar,
  onRefazer,
  onEstudarUm,
}: {
  caderno: ErroCaderno[];
  resumo: ReturnType<typeof resumoCaderno>;
  reduced: boolean;
  ocupado: boolean;
  historico: ProvaFeita[];
  onEstudar: () => void;
  onRefazer: () => void;
  onEstudarUm: (item: ErroCaderno) => void;
}) {
  const [verDominados, setVerDominados] = useState(false);
  const lista = caderno.filter((item) => (verDominados ? item.status === "dominado" : item.status !== "dominado")).slice(0, 12);
  const progresso = resumo.total ? resumo.dominados / resumo.total : 0;

  return (
    <div className="prv-lateral">
      <section className="prv-card prv-caderno" aria-label="Caderno de erros">
        <div className="prv-caderno-topo">
          <p className="caderno-note">caderno de erros</p>
          <span className="prv-anel" style={{ "--p": progresso } as React.CSSProperties} aria-label={`${resumo.dominados} de ${resumo.total} dominados`}>
            <svg viewBox="0 0 36 36" aria-hidden>
              <circle cx="18" cy="18" r="15" className="prv-anel-fundo" />
              <motion.circle cx="18" cy="18" r="15" className="prv-anel-traco" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: progresso }} transition={mola} />
            </svg>
            <b>{resumo.pendentes}</b>
          </span>
        </div>
        {resumo.total ? (
          <>
            <p className="prv-dica">
              {resumo.pendentes ? `${resumo.pendentes} para estudar` : "Tudo dominado"} · {resumo.dominados} dominados
            </p>
            {resumo.assuntos.length ? (
              <div className="prv-assuntos">
                {resumo.assuntos.slice(0, 5).map((item) => (
                  <span key={item.assunto}>
                    {item.assunto} <b>{item.quantos}</b>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="prv-acoes">
              <button type="button" className="prv-btn caderno-btn-pen" onClick={onEstudar} disabled={!resumo.pendentes || ocupado}>
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Estudar pendentes
              </button>
              <button type="button" className="prv-btn prv-btn-ghost" onClick={onRefazer} disabled={!resumo.pendentes || ocupado}>
                <RotateCcw className="h-4 w-4" /> Refazer como prova
              </button>
            </div>
            <div className="prv-caderno-abas">
              <button type="button" className={!verDominados ? "is-on" : ""} onClick={() => setVerDominados(false)}>
                pendentes
              </button>
              <button type="button" className={verDominados ? "is-on" : ""} onClick={() => setVerDominados(true)}>
                dominados
              </button>
            </div>
            <ul className="prv-erros">
              <AnimatePresence initial={false}>
                {lista.map((item) => (
                  <motion.li key={item.id} layout initial={reduced ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={mola}>
                    <button type="button" onClick={() => onEstudarUm(item)} disabled={ocupado || item.status === "dominado"}>
                      <span className={`prv-status is-${item.status}`}>{item.status === "dominado" ? "dominado" : item.status === "estudado" ? "revisar" : "novo"}</span>
                      <span className="prv-erro-q">{item.questao.question}</span>
                      {item.vezes > 1 ? <span className="prv-vezes">errou {item.vezes}×</span> : null}
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
              {!lista.length ? <li className="prv-vazio">{verDominados ? "Nenhum erro dominado ainda." : "Nada pendente por aqui."}</li> : null}
            </ul>
          </>
        ) : (
          <p className="prv-vazio">
            <NotebookTabs className="h-5 w-5" /> Os erros das suas provas aparecem aqui, prontos para estudar. Comece pela prova de exemplo.
          </p>
        )}
      </section>

      {historico.length ? (
        <aside className="prv-card prv-historico" aria-label="Provas feitas">
          <p className="caderno-note">provas feitas</p>
          <ul>
            {historico.slice(0, 6).map((item) => (
              <li key={item.id}>
                <span>{item.refacao ? "Refação dos erros" : item.assunto}</span>
                <b>{item.nota.toFixed(1).replace(".", ",")}</b>
                <small>{new Date(item.quando).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</small>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}
