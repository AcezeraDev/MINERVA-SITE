// Carregado sob demanda (React.lazy): a aba Leitura, onde a Mine resume um
// texto, grifa as palavras difíceis e faz perguntas de interpretação.
//
// Nov/2026 (26): "ler de verdade". O resumo só aparece depois das perguntas
// (ou com dicas, uma ideia por vez), o texto fica fixo ao lado das perguntas,
// a resposta é confirmada antes de valer, dá para selecionar um trecho e
// pedir explicação à Mine ou grifar (os grifos ficam salvos), ouvir o texto,
// usar uma régua de leitura e mudar letra, espaço e fundo. No fim, uma
// pergunta aberta corrigida pela Mine, os erros vão para o caderno de erros
// (aba Provas) e as palavras difíceis viram flashcards.
import "@fontsource-variable/literata/wght.css";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Bot,
  CheckCircle2,
  Clock,
  FileUp,
  Highlighter,
  History,
  Library,
  Lightbulb,
  Lock,
  Minus,
  Pause,
  Plus,
  Ruler,
  RotateCcw,
  Sparkles,
  Type,
  Volume2,
  XCircle,
} from "lucide-react";
import { BibliotecaGratis } from "../conteudo/Livros";
import { lerEmVoz, vozDisponivel, type Leitura as LeituraEmVoz } from "../conteudo/voz";
import { PageHeader, registrarErroDoChat, uid, type Session, type User, type useMemoUserData, type AppData } from "../main";
import { useSoftMotion } from "../motion";
import { celebrateFrom, floatXp, mineConversa, mineSays } from "../caderno";
import { askMineTask } from "../mineTask";
import { usePreset } from "../chat/presets";
import { leituraXp, leiturasPorDia } from "../../shared/xp.mjs";
import { lerCorrecaoDissertativa } from "../../shared/atividades.mjs";
import {
  acharTrecho,
  conferirGabarito,
  contarPalavrasLeitura,
  contextoLeitura,
  juntarGrifos,
  leituraMaxChars,
  leituraMinPalavras,
  lerLeitura,
  limparTextoLeitura,
  minutosLeitura,
  niveisLeitura,
  objetivosLeitura,
  placarLeitura,
  segmentosLeitura,
  textosExemplo,
  type Faixa,
  type Leitura,
} from "../../shared/leitura.mjs";
import "./leitura.css";

type Correcao = { nota: number; comentario: string; faltou: string };
type Guardada = {
  id: string;
  createdAt: number;
  texto: string;
  leitura: Leitura;
  respostas: number[];
  terminada: boolean;
  reportadas?: number[];
  /** Trechos que o aluno grifou (posições no texto). */
  grifos?: Faixa[];
  /** "Explique com suas palavras", corrigida pela Mine. */
  aberta?: { texto: string; correcao?: Correcao };
};
type Rascunho = { titulo: string; texto: string; objetivo?: string; nivel?: string };

/** Ajustes de leitura, guardados neste navegador. */
type Preferencias = { fonte: number; entrelinha: number; letra: "livro" | "clara"; sepia: boolean; regua: boolean };
const PREFERENCIAS = "minerva:leitura-preferencias";
const ENTRELINHAS = [1.6, 1.85, 2.1];
function lerPreferencias(): Preferencias {
  const padrao: Preferencias = { fonte: 1.06, entrelinha: 1.85, letra: "livro", sepia: false, regua: false };
  try {
    const salvo = JSON.parse(localStorage.getItem(PREFERENCIAS) || "{}");
    return {
      fonte: Math.min(1.5, Math.max(0.9, Number(salvo.fonte) || padrao.fonte)),
      entrelinha: ENTRELINHAS.includes(Number(salvo.entrelinha)) ? Number(salvo.entrelinha) : padrao.entrelinha,
      letra: salvo.letra === "clara" ? "clara" : "livro",
      sepia: Boolean(salvo.sepia),
      regua: Boolean(salvo.regua),
    };
  } catch {
    return padrao;
  }
}

/**
 * Leituras guardadas antes da conferência do gabarito (22/nov/2026) passam
 * pela mesma checagem ao abrir: a questão que se contradiz sai da nota.
 */
function perguntasConferidas(leitura: Leitura) {
  return leitura.perguntas.map((pergunta) => {
    const conferida = conferirGabarito(pergunta);
    return { ...pergunta, inconsistente: Boolean(pergunta.inconsistente || conferida.inconsistente) };
  });
}

function placarDe(item: Guardada) {
  return placarLeitura(perguntasConferidas(item.leitura), item.respostas, item.reportadas || []);
}

const etapas = ["Lendo o texto com calma…", "Sublinhando as ideias principais…", "Caçando palavras difíceis…", "Montando perguntas no estilo ENEM…", "Conferindo as respostas…"];

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
    // Sem armazenamento local a leitura vale só enquanto a aba está aberta.
  }
}

async function textoDoArquivo(arquivo: File): Promise<string> {
  if (arquivo.type === "application/pdf" || /\.pdf$/i.test(arquivo.name)) {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()), standardFontDataUrl: "/standard_fonts/" }).promise;
    try {
      const partes: string[] = [];
      let tamanho = 0;
      for (let pagina = 1; pagina <= Math.min(doc.numPages, 30) && tamanho < leituraMaxChars; pagina += 1) {
        const conteudo = await (await doc.getPage(pagina)).getTextContent();
        const texto = conteudo.items.map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "")).join("");
        partes.push(texto);
        tamanho += texto.length;
      }
      return partes.join("\n\n");
    } finally {
      await doc.destroy();
    }
  }
  return arquivo.text();
}

export function LeituraView({ user, update }: { data: ReturnType<typeof useMemoUserData>; user: User; update: (next: (draft: AppData) => AppData) => void }) {
  const reduced = useSoftMotion();
  const chaveRascunho = `minerva:leitura:${user.id}`;
  const chaveGuardadas = `minerva:leituras:${user.id}`;
  // "manda esse texto pra leitura" no chat: a resposta da Mine vira o texto colado
  const preset = usePreset("leitura");
  const [rascunho, setRascunho] = useState<Rascunho>(() =>
    preset?.texto ? { titulo: preset.titulo || "", texto: preset.texto } : lerLocal<Rascunho>(chaveRascunho, { titulo: "", texto: "" }),
  );
  const [fase, setFase] = useState<"colar" | "lendo" | "resultado">("colar");
  // Nov/2026: a Biblioteca grátis (livros em domínio público) também mora aqui.
  const [modo, setModo] = useState<"texto" | "biblioteca">("texto");
  const [atual, setAtual] = useState<Guardada | null>(null);
  const [erro, setErro] = useState("");
  const [passo, setPasso] = useState(0);
  const [carregandoArquivo, setCarregandoArquivo] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => gravarLocal(chaveRascunho, rascunho), [chaveRascunho, rascunho]);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (fase !== "lendo") return;
    const timer = window.setInterval(() => setPasso((valor) => (valor + 1) % etapas.length), 2400);
    return () => window.clearInterval(timer);
  }, [fase]);

  const guardadas = useMemo(() => lerLocal<Guardada[]>(chaveGuardadas, []), [chaveGuardadas, atual]);
  const palavras = contarPalavrasLeitura(rascunho.texto);
  const cortado = rascunho.texto.length > leituraMaxChars;
  const pronto = palavras >= leituraMinPalavras;
  const objetivo = rascunho.objetivo || "enem";
  const nivel = rascunho.nivel || "medio";

  const guardar = (item: Guardada) => {
    const lista = lerLocal<Guardada[]>(chaveGuardadas, []).filter((g) => g.id !== item.id);
    gravarLocal(chaveGuardadas, [item, ...lista].slice(0, 10));
  };

  const abrirArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setErro("");
    setCarregandoArquivo(true);
    try {
      const texto = limparTextoLeitura(await textoDoArquivo(arquivo));
      if (contarPalavrasLeitura(texto) < leituraMinPalavras) throw new Error("Não achei texto suficiente nesse arquivo. Se for um PDF escaneado (foto), copie o texto e cole aqui.");
      setRascunho((r) => ({ ...r, titulo: arquivo.name.replace(/\.[^.]+$/, ""), texto }));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não consegui abrir esse arquivo.");
    } finally {
      setCarregandoArquivo(false);
    }
  };

  const ler = async () => {
    if (!pronto) return;
    setErro("");
    setFase("lendo");
    setPasso(0);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const texto = limparTextoLeitura(rascunho.texto);
    try {
      const resposta = await askMineTask(
        { task: "leitura", prompt: texto, context: contextoLeitura({ titulo: rascunho.titulo.trim(), objetivo, nivel }), outputTokens: 3000 },
        { signal: controller.signal, timeoutMs: 120_000 },
      );
      const leitura = lerLeitura(resposta, texto);
      if (!leitura) throw new Error("A leitura veio incompleta. Tente de novo.");
      if (rascunho.titulo.trim()) leitura.titulo = rascunho.titulo.trim();
      const item: Guardada = { id: uid("leitura"), createdAt: Date.now(), texto, leitura, respostas: leitura.perguntas.map(() => -1), terminada: false };
      guardar(item);
      setAtual(item);
      setFase("resultado");
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      mineSays("Li junto com você! Leia o texto e responda: o resumo eu mostro no fim.", "happy");
    } catch (error) {
      if (controller.signal.aborted) return;
      setErro(error instanceof Error ? error.message : "A Mine não conseguiu ler agora.");
      setFase("colar");
    }
  };

  const reabrir = (item: Guardada) => {
    setAtual(item);
    setFase("resultado");
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div className="lei-page">
      <PageHeader
        eyebrow="Leitura · Interpretação de texto"
        title="Leitura com a Mine"
        subtitle="Cole um texto, abra um PDF ou escolha um livro grátis na Biblioteca. Você lê, responde perguntas de interpretação no estilo ENEM e só depois vê o resumo da Mine."
        action={
          fase === "resultado" ? (
            <button
              type="button"
              className="lei-btn caderno-btn-pen"
              onClick={() => {
                setAtual(null);
                setFase("colar");
              }}
            >
              <BookOpen className="h-4 w-4" /> Nova leitura
            </button>
          ) : undefined
        }
      />

      <div className="caderno-lv-vistas lei-modos" role="tablist" aria-label="Leitura">
        <button type="button" role="tab" aria-selected={modo === "texto"} onClick={() => setModo("texto")} className="caderno-lv-vista">
          <Type className="h-4 w-4" aria-hidden /> Interpretar um texto
        </button>
        <button type="button" role="tab" aria-selected={modo === "biblioteca"} onClick={() => setModo("biblioteca")} className="caderno-lv-vista">
          <Library className="h-4 w-4" aria-hidden /> Biblioteca grátis
        </button>
      </div>

      {modo === "biblioteca" ? (
        <section className="lei-biblioteca" aria-label="Biblioteca grátis">
          <BibliotecaGratis
            aoInterpretar={(trecho, livro) => {
              // O trecho do livro vira o texto da interpretação desta aba.
              setRascunho((r) => ({ ...r, titulo: `${livro.titulo}${livro.autor ? ` (${livro.autor})` : ""}`.slice(0, 120), texto: trecho }));
              setAtual(null);
              setFase("colar");
              setModo("texto");
              window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
              mineSays("Trecho pronto! Clique em “Ler com a Mine” que eu interpreto com você.", "happy");
            }}
          />
        </section>
      ) : fase === "resultado" && atual ? (
        <motion.div initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Resultado
            key={atual.id}
            item={atual}
            onMudar={(item) => {
              setAtual(item);
              guardar(item);
            }}
            onReportar={(item, indice) => {
              const pergunta = item.leitura.perguntas[indice];
              const marcada = pergunta?.alternativas[pergunta.correta] || "";
              const escolhida = item.respostas[indice] >= 0 ? pergunta?.alternativas[item.respostas[indice]] : "(em branco)";
              const texto = [
                `[Leitura · gabarito] ${item.leitura.titulo}`,
                `Pergunta ${indice + 1}: ${pergunta?.pergunta}`,
                `Gabarito do site: ${String.fromCharCode(65 + (pergunta?.correta ?? 0))}) ${marcada}`,
                `Resposta do aluno: ${escolhida}`,
                `Explicação: ${pergunta?.explicacao}`,
                pergunta?.trecho ? `Trecho: ${pergunta.trecho}` : "",
              ]
                .filter(Boolean)
                .join(String.fromCharCode(10))
                .slice(0, 700);
              update((draft) => ({
                ...draft,
                suggestions: [
                  ...draft.suggestions,
                  { id: uid("suggestion"), userId: user.id, name: user.settings.displayName || user.name, category: "erro", text: texto, status: "nova", createdAt: Date.now() },
                ],
              }));
              const novo = { ...item, reportadas: [...new Set([...(item.reportadas || []), indice])] };
              setAtual(novo);
              guardar(novo);
              mineSays("Valeu! Essa pergunta saiu da nota e foi para revisão.", "happy");
            }}
            onTerminar={(item, acertos, total, alvo) => {
              const ja = item.terminada;
              const novo = { ...item, terminada: true };
              setAtual(novo);
              guardar(novo);
              if (ja) return 0;
              // Cada pergunta errada (que conta na nota) vai para o caderno de erros da aba Provas.
              const conferidas = perguntasConferidas(item.leitura);
              let erros = 0;
              conferidas.forEach((pergunta, i) => {
                if (pergunta.inconsistente || (item.reportadas || []).includes(i)) return;
                const marcada = item.respostas[i];
                if (marcada < 0 || marcada === pergunta.correta) return;
                registrarErroDoChat(user.id, { assunto: `Leitura: ${item.leitura.titulo}`.slice(0, 120), pergunta: pergunta.pergunta, opcoes: pergunta.alternativas, correta: pergunta.correta, marcada });
                erros += 1;
              });
              const xp = leituraXp(acertos);
              const session: Session = {
                id: item.id,
                userId: user.id,
                subjectId: "leitura",
                title: `Leitura: ${item.leitura.titulo}`.slice(0, 140),
                kind: "Leitura",
                createdAt: Date.now(),
                xpEarned: xp,
                correctAnswers: acertos,
                questionsAnswered: total,
              };
              update((draft) => ({ ...draft, sessions: [...draft.sessions, session] }));
              window.setTimeout(() => {
                floatXp(`+${xp} XP`, alvo);
                if (total > 0 && acertos === total) celebrateFrom(alvo, { count: 36 });
              }, 60);
              mineSays(total > 0 && acertos === total ? "Gabaritou a interpretação! Agora veja o resumo." : `${acertos} de ${total}! O resumo já está liberado.`, total > 0 && acertos === total ? "wow" : "happy");
              return erros;
            }}
          />
        </motion.div>
      ) : (
        <div className="lei-grid">
          <section className="lei-folha-wrap" aria-label="Texto para ler">
            <div className="lei-folha">
              <input
                className="lei-titulo"
                value={rascunho.titulo}
                onChange={(event) => setRascunho((r) => ({ ...r, titulo: event.target.value.slice(0, 120) }))}
                placeholder="Título do texto (opcional)"
                aria-label="Título do texto"
              />
              <textarea
                className="lei-texto"
                value={rascunho.texto}
                onChange={(event) => setRascunho((r) => ({ ...r, texto: event.target.value.slice(0, leituraMaxChars + 4000) }))}
                placeholder={"Cole aqui o texto que você precisa entender: um capítulo do livro, uma crônica, uma notícia, o texto de apoio da prova…"}
                aria-label="Texto"
                spellCheck={false}
              />
            </div>
            <div className="lei-rodape">
              <div className="lei-contadores" aria-live="polite">
                <span>
                  <strong>{palavras}</strong> palavras
                </span>
                <span>
                  <Clock className="inline h-4 w-4" /> <strong>{minutosLeitura(rascunho.texto)}</strong> min de leitura
                </span>
                <label className="lei-arquivo">
                  <FileUp className="h-4 w-4" /> {carregandoArquivo ? "abrindo…" : "abrir PDF ou .txt"}
                  <input type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={(event) => abrirArquivo(event.target.files?.[0])} disabled={carregandoArquivo} />
                </label>
              </div>
              <div className="lei-escolhas">
                <div className="lei-escolha" role="radiogroup" aria-label="Para que é a leitura">
                  <span className="lei-escolha-rotulo">Para quê?</span>
                  {objetivosLeitura.map((item) => (
                    <button key={item.id} type="button" role="radio" aria-checked={objetivo === item.id} onClick={() => setRascunho((r) => ({ ...r, objetivo: item.id }))}>
                      {item.nome}
                    </button>
                  ))}
                </div>
                <div className="lei-escolha" role="radiogroup" aria-label="Seu nível">
                  <span className="lei-escolha-rotulo">Nível</span>
                  {niveisLeitura.map((item) => (
                    <button key={item.id} type="button" role="radio" aria-checked={nivel === item.id} onClick={() => setRascunho((r) => ({ ...r, nivel: item.id }))}>
                      {item.nome}
                    </button>
                  ))}
                </div>
              </div>
              {!pronto && palavras > 0 ? <p className="lei-aviso">Cole pelo menos {leituraMinPalavras} palavras para a Mine ter o que interpretar.</p> : null}
              {cortado ? <p className="lei-aviso">O texto é grande: a Mine lê os primeiros {leituraMaxChars.toLocaleString("pt-BR")} caracteres (mais ou menos {Math.round(leituraMaxChars / 6)} palavras).</p> : null}
              {erro ? <p className="lei-erro" role="alert">{erro}</p> : null}
              <button type="button" className="lei-btn caderno-btn-pen" disabled={!pronto || fase === "lendo"} onClick={ler}>
                <Sparkles className="h-4 w-4" /> Ler com a Mine
              </button>
            </div>
          </section>

          <aside className="lei-lado">
            <div className="lei-card">
              <p className="caderno-note">sem texto à mão?</p>
              <p className="lei-card-texto">Experimente com um trecho clássico que cai em vestibular:</p>
              <div className="lei-exemplos">
                {textosExemplo.map((item) => (
                  <button key={item.id} type="button" className="lei-exemplo" onClick={() => setRascunho((r) => ({ ...r, titulo: item.titulo, texto: item.texto }))}>
                    <strong>{item.titulo}</strong>
                    <span>{item.autor}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="lei-card">
              <p className="caderno-note">como funciona</p>
              <ol className="lei-lista is-passos">
                <li>Você lê o texto: toque nas palavras grifadas para ver o significado, selecione um trecho para a Mine explicar ou para grifar</li>
                <li>Responde 4 perguntas de interpretação: ideia central, informação, inferência e linguagem</li>
                <li>Só então vê o resumo e as ideias principais (ou pede uma dica antes)</li>
                <li>Até {leituraXp(4)} XP por leitura (até {leiturasPorDia} por dia); os erros vão para o caderno de erros</li>
              </ol>
            </div>
            {guardadas.length ? (
              <div className="lei-card">
                <p className="caderno-note">
                  <History className="inline h-4 w-4" /> leituras recentes
                </p>
                <ul className="lei-historico">
                  {guardadas.map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => reabrir(item)}>
                        <strong>{item.leitura.titulo}</strong>
                        <span>
                          {new Date(item.createdAt).toLocaleDateString("pt-BR")} · {item.terminada ? `${placarDe(item).acertos}/${placarDe(item).total} certas` : "perguntas abertas"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      )}

      <AnimatePresence>
        {fase === "lendo" ? (
          <motion.div className="lei-overlay" role="status" aria-live="polite" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="lei-overlay-card" initial={{ scale: 0.92, y: 24 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
              <div className="lei-livro" aria-hidden>
                <span />
                <span />
                <span />
              </div>
              <p className="caderno-note">lendo com marca-texto</p>
              <AnimatePresence mode="wait">
                <motion.p key={passo} className="lei-overlay-passo" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                  {etapas[passo]}
                </motion.p>
              </AnimatePresence>
              <button
                type="button"
                className="lei-link"
                onClick={() => {
                  abortRef.current?.abort();
                  setFase("colar");
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

type Selecao = { texto: string; inicio: number; fim: number; x: number; y: number; grifo: boolean };

function Resultado({
  item,
  onMudar,
  onTerminar,
  onReportar,
}: {
  item: Guardada;
  onMudar: (item: Guardada) => void;
  /** Devolve quantas perguntas erradas foram para o caderno de erros. */
  onTerminar: (item: Guardada, acertos: number, total: number, alvo: Element | null) => number;
  onReportar: (item: Guardada, indice: number) => void;
}) {
  const leitura = useMemo(() => ({ ...item.leitura, perguntas: perguntasConferidas(item.leitura) }), [item.leitura]);
  const reportadas = item.reportadas || [];
  const grifos = item.grifos || [];
  const [aberta, setAberta] = useState<number | null>(null);
  const [preferencias, setPreferencias] = useState(lerPreferencias);
  const [prova, setProva] = useState<Faixa | null>(null);
  const [aba, setAba] = useState<"perguntas" | "palavras" | "resumo">("perguntas");
  const [pendentes, setPendentes] = useState<Record<number, number>>({});
  const [resumoAberto, setResumoAberto] = useState(false);
  const [dicas, setDicas] = useState(0);
  const [selecao, setSelecao] = useState<Selecao | null>(null);
  const [ouvindo, setOuvindo] = useState(false);
  const [lendo, setLendo] = useState<number | null>(null);
  const [errosNoCaderno, setErrosNoCaderno] = useState<number | null>(null);
  const [cartoesSalvos, setCartoesSalvos] = useState(false);
  const [explique, setExplique] = useState(item.aberta?.texto || "");
  const [corrigindo, setCorrigindo] = useState(false);
  const [erroCorrecao, setErroCorrecao] = useState("");
  const textoRef = useRef<HTMLDivElement>(null);
  const reguaRef = useRef<HTMLDivElement>(null);
  const placarRef = useRef<HTMLDivElement>(null);
  const vozRef = useRef<LeituraEmVoz | null>(null);
  const temVoz = useMemo(vozDisponivel, []);
  const respondidas = item.respostas.filter((r) => r >= 0).length;
  const { acertos, total } = placarLeitura(leitura.perguntas, item.respostas, reportadas);
  const resumoLiberado = item.terminada || resumoAberto;

  useEffect(() => gravarLocal(PREFERENCIAS, preferencias), [preferencias]);
  const mudar = (parcial: Partial<Preferencias>) => setPreferencias((atual) => ({ ...atual, ...parcial }));

  // Pedaços do texto: palavras difíceis, trecho que prova a resposta e grifos do aluno.
  const paragrafos = useMemo(() => {
    const faixas = [...grifos.map((g) => ({ ...g, tipo: "grifo" as const })), ...(prova ? [{ ...prova, tipo: "prova" as const }] : [])];
    const saida: Array<Array<ReturnType<typeof segmentosLeitura>[number]>> = [[]];
    for (const segmento of segmentosLeitura(item.texto, leitura.palavras, faixas)) {
      // Quebra em parágrafos sem perder a posição de cada pedaço no texto.
      let deslocamento = 0;
      segmento.texto.split(/(\n+)/).forEach((pedaco) => {
        if (/^\n+$/.test(pedaco)) {
          saida.push([]);
        } else if (pedaco) {
          saida[saida.length - 1].push({ ...segmento, texto: pedaco, inicio: segmento.inicio + deslocamento, primeiro: segmento.primeiro && deslocamento === 0 });
        }
        deslocamento += pedaco.length;
      });
    }
    return saida.filter((p) => p.length);
  }, [item.texto, leitura.palavras, grifos, prova]);

  // Grifa no texto o trecho que prova a resposta e rola até ele.
  useEffect(() => {
    if (!prova) return;
    const marca = textoRef.current?.querySelector(".lei-prova");
    marca?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [prova]);

  // Balão da palavra: fecha com Esc ou clicando fora dele.
  useEffect(() => {
    if (aberta === null && !selecao) return;
    const tecla = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAberta(null);
      setSelecao(null);
    };
    const fora = (event: PointerEvent) => {
      const alvo = event.target as HTMLElement | null;
      if (alvo?.closest(".lei-palavra, .lei-glossario, .lei-selecao")) return;
      setAberta(null);
    };
    window.addEventListener("keydown", tecla);
    window.addEventListener("pointerdown", fora);
    return () => {
      window.removeEventListener("keydown", tecla);
      window.removeEventListener("pointerdown", fora);
    };
  }, [aberta, selecao]);

  // Voz para quando sai da tela.
  useEffect(() => () => vozRef.current?.parar(), []);

  const ouvir = () => {
    if (ouvindo) {
      vozRef.current?.parar();
      return;
    }
    const textos = paragrafos.map((paragrafo) => paragrafo.map((parte) => parte.texto).join(""));
    setOuvindo(true);
    vozRef.current = lerEmVoz(textos, {
      aoParagrafo: setLendo,
      aoAcabar: () => {
        setOuvindo(false);
        setLendo(null);
      },
    });
  };

  // Seleção no texto: posição no texto original pelas marcas data-o dos pedaços.
  const lerSelecao = () => {
    window.setTimeout(() => {
      const sel = window.getSelection?.();
      const texto = String(sel || "").trim();
      if (!sel || sel.isCollapsed || texto.length < 2 || !textoRef.current?.contains(sel.anchorNode)) {
        setSelecao(null);
        return;
      }
      const faixa = sel.getRangeAt(0);
      const posicao = (no: Node, desloc: number) => {
        const elemento = (no.nodeType === Node.TEXT_NODE ? no.parentElement : (no as Element))?.closest<HTMLElement>("[data-o]");
        return elemento && no.nodeType === Node.TEXT_NODE ? Number(elemento.dataset.o) + desloc : -1;
      };
      let inicio = posicao(faixa.startContainer, faixa.startOffset);
      let fim = posicao(faixa.endContainer, faixa.endOffset);
      if (inicio < 0 || fim <= inicio) {
        const achado = acharTrecho(item.texto, texto);
        if (!achado) return setSelecao(null);
        inicio = achado.inicio;
        fim = achado.fim;
      }
      const caixa = faixa.getBoundingClientRect();
      setSelecao({
        texto: item.texto.slice(inicio, fim).replace(/\s+/g, " ").trim().slice(0, 1500),
        inicio,
        fim,
        x: Math.min(Math.max(caixa.left + caixa.width / 2, 140), window.innerWidth - 140),
        y: Math.max(caixa.top, 60),
        grifo: grifos.some((g) => g.inicio < fim && g.fim > inicio),
      });
    }, 0);
  };

  const grifar = () => {
    if (!selecao) return;
    onMudar({ ...item, grifos: juntarGrifos([...grifos, { inicio: selecao.inicio, fim: selecao.fim }]) });
    window.getSelection?.()?.removeAllRanges();
    setSelecao(null);
  };
  const tirarGrifo = () => {
    if (!selecao) return;
    onMudar({ ...item, grifos: grifos.filter((g) => !(g.inicio < selecao.fim && g.fim > selecao.inicio)) });
    window.getSelection?.()?.removeAllRanges();
    setSelecao(null);
  };
  const explicar = () => {
    if (!selecao) return;
    const curto = selecao.texto.split(/\s+/).length <= 4;
    mineConversa(
      curto ? `O que significa "${selecao.texto}" neste texto?` : `Me explica este trecho: "${selecao.texto}"`,
      `O estudante esta na aba Leitura do Minerva lendo "${leitura.titulo}"${leitura.genero ? ` (${leitura.genero})` : ""} e selecionou um trecho. Explique de forma simples, no contexto do texto, sem entregar as respostas das perguntas de interpretacao.\n\nTrecho inicial do texto:\n${item.texto.slice(0, 3000)}`,
      leitura.titulo,
    );
    window.getSelection?.()?.removeAllRanges();
    setSelecao(null);
  };

  // Régua de leitura: uma faixa da altura de uma linha segue o ponteiro.
  const quadro = useRef(0);
  const moverRegua = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!preferencias.regua || event.pointerType === "touch") return;
    const y = event.clientY - event.currentTarget.getBoundingClientRect().top;
    cancelAnimationFrame(quadro.current);
    quadro.current = requestAnimationFrame(() => {
      if (reguaRef.current) reguaRef.current.style.transform = `translateY(${Math.round(y)}px)`;
    });
  };

  const corrigirAberta = async () => {
    const texto = explique.trim();
    if (texto.length < 15 || corrigindo) return;
    setCorrigindo(true);
    setErroCorrecao("");
    try {
      const resposta = await askMineTask(
        {
          task: "atividade-correcao",
          prompt: texto,
          context: [
            `Leitura: ${leitura.titulo}`,
            "Pergunta: Explique com suas palavras a ideia central do texto e o que o autor quis mostrar.",
            `Uma boa resposta precisa: ${leitura.resumo}`,
            leitura.ideias.length ? `Explicacao do gabarito: ideias principais - ${leitura.ideias.join("; ")}` : "",
          ]
            .filter(Boolean)
            .join(" | "),
          outputTokens: 600,
        },
        { timeoutMs: 60_000 },
      );
      const correcao = lerCorrecaoDissertativa(resposta);
      if (!correcao) throw new Error("A correção veio incompleta. Tente de novo.");
      onMudar({ ...item, aberta: { texto, correcao: { nota: correcao.nota, comentario: correcao.comentario, faltou: correcao.faltou } } });
    } catch (error) {
      setErroCorrecao(error instanceof Error ? error.message : "A Mine não conseguiu corrigir agora.");
    } finally {
      setCorrigindo(false);
    }
  };

  const salvarCartoes = () => {
    window.dispatchEvent(
      new CustomEvent("mine:salvar-flashcards", {
        detail: { titulo: "Português", cartoes: leitura.palavras.map((p) => ({ frente: p.palavra, verso: `${p.significado} (em “${leitura.titulo}”)` })) },
      }),
    );
    setCartoesSalvos(true);
  };

  const estiloTexto = { fontSize: `${preferencias.fonte}rem`, lineHeight: String(preferencias.entrelinha) } as React.CSSProperties;

  return (
    <div className="lei-resultado">
      <section className={`lei-leitura letra-${preferencias.letra} ${preferencias.sepia ? "is-sepia" : ""}`} aria-label="Texto com as palavras grifadas">
        <div className="lei-leitura-top">
          <div className="min-w-0">
            <p className="caderno-note">{leitura.genero || "texto"}</p>
            <h2>{leitura.titulo}</h2>
            <p className="lei-meta">
              <Clock className="inline h-4 w-4" /> {minutosLeitura(item.texto)} min · {contarPalavrasLeitura(item.texto)} palavras · {leitura.palavras.length} palavras grifadas
            </p>
          </div>
        </div>
        <div className="lei-ferramentas" role="toolbar" aria-label="Ajustes de leitura">
          <div className="lei-ferramenta-grupo" role="group" aria-label="Tamanho da letra">
            <button type="button" onClick={() => mudar({ fonte: Math.max(0.9, +(preferencias.fonte - 0.08).toFixed(2)) })} aria-label="Letra menor" title="Letra menor" disabled={preferencias.fonte <= 0.9}>
              <Minus className="h-4 w-4" />
            </button>
            <span aria-hidden>A</span>
            <button type="button" onClick={() => mudar({ fonte: Math.min(1.5, +(preferencias.fonte + 0.08).toFixed(2)) })} aria-label="Letra maior" title="Letra maior" disabled={preferencias.fonte >= 1.5}>
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            className="lei-ferramenta"
            onClick={() => mudar({ entrelinha: ENTRELINHAS[(ENTRELINHAS.indexOf(preferencias.entrelinha) + 1) % ENTRELINHAS.length] })}
            title="Espaço entre as linhas"
          >
            <span className="lei-linhas" aria-hidden style={{ gap: `${(preferencias.entrelinha - 1.4) * 5}px` }}>
              <i />
              <i />
              <i />
            </span>
            Espaço
          </button>
          <button type="button" className="lei-ferramenta" aria-pressed={preferencias.letra === "clara"} onClick={() => mudar({ letra: preferencias.letra === "clara" ? "livro" : "clara" })} title="Letra fácil de ler (Atkinson Hyperlegible, boa para dislexia)">
            <Type className="h-4 w-4" /> Fácil de ler
          </button>
          <button type="button" className="lei-ferramenta" aria-pressed={preferencias.sepia} onClick={() => mudar({ sepia: !preferencias.sepia })} title="Fundo sépia, que cansa menos a vista">
            <span className="lei-amostra-sepia" aria-hidden /> Sépia
          </button>
          <button type="button" className="lei-ferramenta is-regua" aria-pressed={preferencias.regua} onClick={() => mudar({ regua: !preferencias.regua })} title="Régua: destaca a linha onde está o mouse">
            <Ruler className="h-4 w-4" /> Régua
          </button>
          {temVoz ? (
            <button type="button" className="lei-ferramenta" aria-pressed={ouvindo} onClick={ouvir} title={ouvindo ? "Parar a leitura em voz alta" : "Ouvir o texto"}>
              {ouvindo ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />} {ouvindo ? "Pausar" : "Ouvir"}
            </button>
          ) : null}
        </div>
        <div className="lei-corpo-wrap" onPointerMove={moverRegua}>
          {preferencias.regua ? <div className="lei-regua" ref={reguaRef} style={{ height: `${preferencias.fonte * preferencias.entrelinha}rem` }} aria-hidden /> : null}
          <div ref={textoRef} className="lei-corpo" style={estiloTexto} onMouseUp={lerSelecao} onTouchEnd={lerSelecao}>
            {paragrafos.map((paragrafo, i) => (
              <p key={i} className={lendo === i ? "is-lendo" : ""}>
                {paragrafo.map((parte, j) => {
                  const classes = `${parte.prova ? "lei-prova" : ""} ${parte.grifo ? "lei-grifo" : ""}`.trim();
                  if (parte.marca < 0) {
                    return (
                      <span key={j} data-o={parte.inicio} className={classes || undefined}>
                        {parte.texto}
                      </span>
                    );
                  }
                  const palavra = leitura.palavras[parte.marca];
                  const alternar = () => {
                    if (String(window.getSelection?.() || "").trim()) return;
                    setAberta(aberta === parte.marca ? null : parte.marca);
                  };
                  // <span role="button"> e não <button>: o botão é uma caixa
                  // fechada na linha e deixava a vírgula depois dele cair
                  // sozinha na linha de baixo.
                  return (
                    <span
                      key={j}
                      role="button"
                      tabIndex={0}
                      data-o={parte.inicio}
                      className={`lei-palavra ${aberta === parte.marca ? "is-on" : ""} ${classes}`}
                      onClick={alternar}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        alternar();
                      }}
                      aria-expanded={aberta === parte.marca}
                      aria-label={`${parte.texto}: ${palavra.significado}`}
                    >
                      {parte.texto}
                      {aberta === parte.marca && parte.primeiro ? (
                        <span className="lei-balao" role="tooltip">
                          {palavra.significado}
                        </span>
                      ) : null}
                    </span>
                  );
                })}
              </p>
            ))}
          </div>
        </div>
        <p className="lei-dica-texto">
          <Highlighter className="inline h-4 w-4" /> Selecione um trecho para a Mine explicar ou para grifar. Toque nas palavras marcadas para ver o significado.
        </p>
      </section>

      {selecao ? (
        <div className="lei-selecao" style={{ left: selecao.x, top: selecao.y }} role="toolbar" aria-label="Trecho selecionado" onMouseDown={(event) => event.preventDefault()}>
          <button type="button" onClick={explicar}>
            <Sparkles className="h-4 w-4" /> {selecao.texto.split(/\s+/).length <= 4 ? "O que significa?" : "Explicar"}
          </button>
          {selecao.grifo ? (
            <button type="button" onClick={tirarGrifo}>
              <Highlighter className="h-4 w-4" /> Tirar grifo
            </button>
          ) : (
            <button type="button" onClick={grifar}>
              <Highlighter className="h-4 w-4" /> Grifar
            </button>
          )}
          {temVoz ? (
            <button
              type="button"
              onClick={() => {
                vozRef.current?.parar();
                vozRef.current = lerEmVoz([selecao.texto]);
                setSelecao(null);
              }}
            >
              <Volume2 className="h-4 w-4" /> Ouvir
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="lei-painel" aria-label="Perguntas, palavras e resumo">
        <div className="lei-abas" role="tablist" aria-label="Painel da leitura">
          <button type="button" role="tab" aria-selected={aba === "perguntas"} onClick={() => setAba("perguntas")}>
            Perguntas <span className="lei-aba-conta">{respondidas}/{leitura.perguntas.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={aba === "palavras"} onClick={() => setAba("palavras")}>
            Palavras <span className="lei-aba-conta">{leitura.palavras.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={aba === "resumo"} onClick={() => setAba("resumo")}>
            Resumo {resumoLiberado ? null : <Lock className="h-3.5 w-3.5" aria-label="bloqueado até terminar" />}
          </button>
        </div>

        {aba === "perguntas" ? (
          <div className="lei-perguntas" role="tabpanel">
            <div className="lei-perguntas-top">
              <h3>Perguntas de interpretação</h3>
              <div ref={placarRef} className="lei-placar" aria-live="polite">
                {item.terminada ? `${acertos}/${total} certas` : `${respondidas}/${leitura.perguntas.length} respondidas`}
              </div>
            </div>
            <ol className="lei-lista-perguntas">
              {leitura.perguntas.map((pergunta, i) => {
                const escolha = item.respostas[i];
                const respondida = escolha >= 0;
                const pendente = pendentes[i];
                const foraDaNota = Boolean(pergunta.inconsistente || reportadas.includes(i));
                const lugar = pergunta.trecho ? acharTrecho(item.texto, pergunta.trecho) : null;
                return (
                  <li key={i} className="lei-pergunta">
                    <p className="lei-enunciado">
                      <span className="lei-num">{i + 1}</span> {pergunta.pergunta}
                    </p>
                    <div className="lei-alternativas" role="radiogroup" aria-label={`Pergunta ${i + 1}`}>
                      {pergunta.alternativas.map((alt, j) => {
                        // Gabarito em dúvida: mostra só a escolha, sem julgar certo ou errado.
                        const certa = respondida && !foraDaNota && j === pergunta.correta;
                        const errada = respondida && !foraDaNota && j === escolha && j !== pergunta.correta;
                        return (
                          <button
                            key={j}
                            type="button"
                            role="radio"
                            aria-checked={respondida ? escolha === j : pendente === j}
                            disabled={respondida}
                            className={`lei-alt ${certa ? "is-certa" : ""} ${errada ? "is-errada" : ""} ${!respondida && pendente === j ? "is-marcada" : ""} ${respondida && foraDaNota && escolha === j ? "is-marcada" : ""}`}
                            onClick={() => setPendentes((atual) => ({ ...atual, [i]: j }))}
                          >
                            <span className="lei-letra">{String.fromCharCode(65 + j)}</span>
                            <span>{alt}</span>
                            {certa ? <CheckCircle2 className="ml-auto h-5 w-5 flex-none" aria-label="certa" /> : null}
                            {errada ? <XCircle className="ml-auto h-5 w-5 flex-none" aria-label="sua resposta, errada" /> : null}
                          </button>
                        );
                      })}
                    </div>
                    {!respondida && pendente !== undefined ? (
                      <div className="lei-confirmar">
                        <button
                          type="button"
                          className="lei-btn caderno-btn-pen"
                          onClick={() => {
                            const respostas = [...item.respostas];
                            respostas[i] = pendente;
                            onMudar({ ...item, respostas });
                            if ((foraDaNota || pendente !== pergunta.correta) && lugar) setProva(lugar);
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4" /> Confirmar {String.fromCharCode(65 + pendente)}
                        </button>
                        <span>Pode trocar antes de confirmar.</span>
                      </div>
                    ) : null}
                    {respondida ? (
                      <div className={`lei-explica ${foraDaNota ? "is-revisao" : escolha === pergunta.correta ? "is-certa" : "is-errada"}`}>
                        {foraDaNota ? (
                          <p>
                            <strong>Gabarito em revisão.</strong> {reportadas.includes(i) ? "Você reportou esta pergunta" : "A explicação desta pergunta não bate com a alternativa marcada como certa"}, então ela não conta na sua nota. Decida pelo texto: {pergunta.explicacao}
                          </p>
                        ) : (
                          <p>
                            <strong>{escolha === pergunta.correta ? "Isso!" : "Quase."}</strong> {pergunta.explicacao}
                          </p>
                        )}
                        <div className="lei-explica-acoes">
                          {lugar ? (
                            <button type="button" className="lei-link" onClick={() => setProva({ ...lugar })}>
                              mostrar no texto onde está a resposta
                            </button>
                          ) : null}
                          {reportadas.includes(i) ? (
                            <span className="lei-reportada">gabarito reportado</span>
                          ) : (
                            <button type="button" className="lei-link" onClick={() => onReportar(item, i)}>
                              reportar gabarito
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>

            {/* Pergunta aberta: o aluno escreve, a Mine corrige (não entra no XP). */}
            <div className="lei-aberta">
              <p className="lei-enunciado">
                <span className="lei-num is-aberta">✎</span> Explique com suas palavras: qual é a ideia central do texto e o que o autor quis mostrar?
              </p>
              {item.aberta?.correcao ? (
                <div className={`lei-explica ${item.aberta.correcao.nota >= 6 ? "is-certa" : "is-errada"}`}>
                  <p className="lei-aberta-sua">“{item.aberta.texto}”</p>
                  <p>
                    <strong>Nota {item.aberta.correcao.nota.toLocaleString("pt-BR")}/10.</strong> {item.aberta.correcao.comentario}
                  </p>
                  {item.aberta.correcao.faltou ? (
                    <p>
                      <strong>Faltou:</strong> {item.aberta.correcao.faltou}
                    </p>
                  ) : null}
                  <button type="button" className="lei-link" onClick={() => onMudar({ ...item, aberta: { texto: item.aberta?.texto || "" } })}>
                    <RotateCcw className="inline h-4 w-4" /> reescrever
                  </button>
                </div>
              ) : (
                <>
                  <textarea className="lei-aberta-campo" value={explique} onChange={(event) => setExplique(event.target.value.slice(0, 1200))} placeholder="Escreva 2 ou 3 frases. Vale mais do que decorar o resumo!" aria-label="Sua explicação do texto" rows={3} />
                  <div className="lei-aberta-acoes">
                    <button type="button" className="lei-btn caderno-btn-pen" onClick={corrigirAberta} disabled={corrigindo || explique.trim().length < 15}>
                      <Sparkles className="h-4 w-4" /> {corrigindo ? "A Mine está lendo…" : "Corrigir com a Mine"}
                    </button>
                    <span>{explique.trim().length < 15 ? "Escreva pelo menos uma frase." : "Opcional: não muda o seu XP."}</span>
                  </div>
                  {erroCorrecao ? (
                    <p className="lei-erro" role="alert">
                      {erroCorrecao}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            <div className="lei-fim">
              {item.terminada ? (
                <p className="lei-fim-texto">
                  Leitura concluída com {acertos} de {total}
                  {total < leitura.perguntas.length ? ` (${leitura.perguntas.length - total} em revisão, fora da nota)` : ""}. {acertos < total ? "Releia os trechos marcados e tente explicar com suas palavras." : "Interpretação afiada!"}
                  {errosNoCaderno ? ` ${errosNoCaderno === 1 ? "A pergunta errada foi" : `As ${errosNoCaderno} perguntas erradas foram`} para o caderno de erros (aba Provas).` : ""}
                </p>
              ) : (
                <button
                  type="button"
                  className="lei-btn caderno-btn-pen"
                  disabled={respondidas < leitura.perguntas.length}
                  onClick={() => {
                    setErrosNoCaderno(onTerminar(item, acertos, total, placarRef.current));
                    setAba("resumo");
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" /> Terminar e ver o resumo
                </button>
              )}
              {item.terminada ? (
                <button type="button" className="lei-link" onClick={() => onMudar({ ...item, respostas: leitura.perguntas.map(() => -1) })}>
                  <RotateCcw className="inline h-4 w-4" /> refazer as perguntas (sem XP)
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {aba === "palavras" ? (
          <div className="lei-card lei-palavras" role="tabpanel">
            {leitura.palavras.length ? (
              <>
                <p className="lei-card-texto">Toque numa palavra para ver onde ela aparece no texto.</p>
                <dl className="lei-glossario">
                  {leitura.palavras.map((p, i) => (
                    <div key={p.palavra} className={aberta === i ? "is-on" : ""}>
                      <dt>
                        <button
                          type="button"
                          onClick={() => {
                            setAberta(aberta === i ? null : i);
                            // Leva o texto até a 1ª vez que a palavra aparece.
                            const marcas = Array.from(textoRef.current?.querySelectorAll<HTMLElement>(".lei-palavra") || []);
                            marcas.find((el) => el.textContent?.toLowerCase().startsWith(p.palavra.toLowerCase()))?.scrollIntoView({ block: "center", behavior: "smooth" });
                          }}
                        >
                          {p.palavra}
                        </button>
                      </dt>
                      <dd>{p.significado}</dd>
                    </div>
                  ))}
                </dl>
                <button type="button" className="lei-btn caderno-btn-pen lei-salvar-cartoes" onClick={salvarCartoes} disabled={cartoesSalvos}>
                  <Sparkles className="h-4 w-4" /> {cartoesSalvos ? "Salvas nos flashcards de Português" : "Salvar como flashcards"}
                </button>
              </>
            ) : (
              <p className="lei-card-texto">A Mine não achou palavras difíceis neste texto.</p>
            )}
          </div>
        ) : null}

        {aba === "resumo" ? (
          <div className="lei-card lei-resumo" role="tabpanel">
            {resumoLiberado ? (
              <>
                <p className="caderno-note">resumo</p>
                <p>{leitura.resumo}</p>
                {leitura.ideias.length ? (
                  <>
                    <p className="caderno-note mt-4">
                      <Lightbulb className="inline h-4 w-4" /> ideias principais
                    </p>
                    <ol>
                      {leitura.ideias.map((ideia) => (
                        <li key={ideia}>{ideia}</li>
                      ))}
                    </ol>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <p className="lei-trava">
                  <Lock className="h-4 w-4" /> O resumo aparece quando você terminar as perguntas: ele entrega as respostas. Leia o texto primeiro!
                </p>
                {dicas > 0 ? (
                  <ol className="lei-dicas">
                    {leitura.ideias.slice(0, dicas).map((ideia) => (
                      <li key={ideia}>{ideia}</li>
                    ))}
                  </ol>
                ) : null}
                <div className="lei-trava-acoes">
                  {dicas < leitura.ideias.length ? (
                    <button type="button" className="lei-btn caderno-btn-pen" onClick={() => setDicas((n) => n + 1)}>
                      <Lightbulb className="h-4 w-4" /> {dicas ? "Mais uma dica" : "Quero uma dica"}
                    </button>
                  ) : null}
                  <button type="button" className="lei-link" onClick={() => setResumoAberto(true)}>
                    mostrar o resumo mesmo assim
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}

        <button
          type="button"
          className="lei-mine"
          onClick={() =>
            mineConversa(
              "Me ajuda a entender melhor este texto? Quero saber o contexto, a intenção do autor e como ele pode cair numa prova.",
              `O estudante esta na aba Leitura do Minerva lendo "${leitura.titulo}"${leitura.genero ? ` (${leitura.genero})` : ""}.${item.terminada ? ` Resumo: ${leitura.resumo}` : " Ele ainda nao respondeu as perguntas de interpretacao: nao entregue as respostas."}\n\nTrecho inicial do texto:\n${item.texto.slice(0, 3500)}`,
              leitura.titulo,
            )
          }
        >
          <Bot className="h-5 w-5" />
          <span>
            <strong>Conversar sobre o texto</strong>
            <span>Tire dúvidas com a Mine sem sair daqui.</span>
          </span>
        </button>
      </section>
    </div>
  );
}
