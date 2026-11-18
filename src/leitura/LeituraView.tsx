// Carregado sob demanda (React.lazy): a aba Leitura, onde a Mine resume um
// texto, grifa as palavras difíceis e faz perguntas de interpretação.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Bot, CheckCircle2, Clock, FileUp, History, Lightbulb, RotateCcw, Sparkles, Type, XCircle } from "lucide-react";
import { PageHeader, uid, type Session, type User, type useMemoUserData, type AppData } from "../main";
import { useSoftMotion } from "../motion";
import { celebrateFrom, floatXp, mineConversa, mineSays } from "../caderno";
import { askMineTask } from "../mineTask";
import { leituraXp, leiturasPorDia } from "../../shared/xp.mjs";
import {
  contarPalavrasLeitura,
  contextoLeitura,
  leituraMaxChars,
  leituraMinPalavras,
  lerLeitura,
  limparTextoLeitura,
  marcarPalavras,
  minutosLeitura,
  textosExemplo,
  type Leitura,
} from "../../shared/leitura.mjs";
import "./leitura.css";

type Guardada = { id: string; createdAt: number; texto: string; leitura: Leitura; respostas: number[]; terminada: boolean };

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
  const [rascunho, setRascunho] = useState(() => lerLocal(chaveRascunho, { titulo: "", texto: "" }));
  const [fase, setFase] = useState<"colar" | "lendo" | "resultado">("colar");
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
      setRascunho({ titulo: arquivo.name.replace(/\.[^.]+$/, ""), texto });
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
        { task: "leitura", prompt: texto, context: contextoLeitura({ titulo: rascunho.titulo.trim() }), outputTokens: 3000 },
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
      mineSays("Li junto com você! Passa o mouse nas palavras grifadas.", "happy");
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
        subtitle="Cole um texto ou abra um PDF. A Mine resume, grifa as palavras difíceis com o significado e faz perguntas de interpretação no estilo ENEM."
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

      {fase === "resultado" && atual ? (
        <motion.div initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Resultado
            key={atual.id}
            item={atual}
            onMudar={(item) => {
              setAtual(item);
              guardar(item);
            }}
            onTerminar={(item, acertos, alvo) => {
              const ja = item.terminada;
              const novo = { ...item, terminada: true };
              setAtual(novo);
              guardar(novo);
              if (ja) return;
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
                questionsAnswered: item.leitura.perguntas.length,
              };
              update((draft) => ({ ...draft, sessions: [...draft.sessions, session] }));
              window.setTimeout(() => {
                floatXp(`+${xp} XP`, alvo);
                if (acertos === item.leitura.perguntas.length) celebrateFrom(alvo, { count: 36 });
              }, 60);
              mineSays(acertos === item.leitura.perguntas.length ? "Gabaritou a interpretação!" : `${acertos} de ${item.leitura.perguntas.length}! Olha as explicações.`, acertos === item.leitura.perguntas.length ? "wow" : "happy");
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
                  <button key={item.id} type="button" className="lei-exemplo" onClick={() => setRascunho({ titulo: item.titulo, texto: item.texto })}>
                    <strong>{item.titulo}</strong>
                    <span>{item.autor}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="lei-card">
              <p className="caderno-note">o que você recebe</p>
              <ul className="lei-lista">
                <li>Resumo e ideias principais na ordem do texto</li>
                <li>Palavras difíceis grifadas, com o significado naquele contexto</li>
                <li>4 perguntas de interpretação: ideia central, informação, inferência e linguagem</li>
                <li>Até {leituraXp(4)} XP por leitura (até {leiturasPorDia} por dia)</li>
              </ul>
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
                          {new Date(item.createdAt).toLocaleDateString("pt-BR")} · {item.terminada ? `${item.respostas.filter((r, i) => r === item.leitura.perguntas[i]?.correta).length}/${item.leitura.perguntas.length} certas` : "perguntas abertas"}
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

function Resultado({
  item,
  onMudar,
  onTerminar,
}: {
  item: Guardada;
  onMudar: (item: Guardada) => void;
  onTerminar: (item: Guardada, acertos: number, alvo: Element | null) => void;
}) {
  const { leitura } = item;
  const [aberta, setAberta] = useState<number | null>(null);
  const [fonte, setFonte] = useState(1);
  const [prova, setProva] = useState<string>("");
  const textoRef = useRef<HTMLDivElement>(null);
  const placarRef = useRef<HTMLDivElement>(null);
  const partes = useMemo(() => marcarPalavras(item.texto, leitura.palavras), [item.texto, leitura.palavras]);
  const respondidas = item.respostas.filter((r) => r >= 0).length;
  const acertos = item.respostas.filter((r, i) => r === leitura.perguntas[i].correta).length;

  // Grifa no texto o trecho que prova a resposta e rola até ele.
  useEffect(() => {
    if (!prova) return;
    const marca = textoRef.current?.querySelector(".lei-prova");
    marca?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [prova]);

  const paragrafos = useMemo(() => {
    // Quebra as partes grifadas em parágrafos sem perder as marcas.
    const saida: Array<Array<{ texto: string; marca: number }>> = [[]];
    for (const parte of partes) {
      const pedacos = parte.texto.split(/\n+/);
      pedacos.forEach((pedaco, i) => {
        if (i > 0) saida.push([]);
        if (pedaco) saida[saida.length - 1].push({ texto: pedaco, marca: parte.marca });
      });
    }
    return saida.filter((p) => p.length);
  }, [partes]);

  const realcarProva = (texto: string) => {
    if (!prova || !texto.includes(prova)) return texto;
    const i = texto.indexOf(prova);
    return (
      <>
        {texto.slice(0, i)}
        <mark className="lei-prova">{prova}</mark>
        {texto.slice(i + prova.length)}
      </>
    );
  };

  return (
    <div className="lei-resultado">
      <section className="lei-leitura" aria-label="Texto com as palavras grifadas">
        <div className="lei-leitura-top">
          <div>
            <p className="caderno-note">{leitura.genero || "texto"}</p>
            <h2>{leitura.titulo}</h2>
            <p className="lei-meta">
              <Clock className="inline h-4 w-4" /> {minutosLeitura(item.texto)} min · {contarPalavrasLeitura(item.texto)} palavras · {leitura.palavras.length} palavras grifadas
            </p>
          </div>
          <div className="lei-fonte" role="group" aria-label="Tamanho da letra">
            {[0.92, 1, 1.12, 1.25].map((tam) => (
              <button key={tam} type="button" aria-pressed={fonte === tam} className={fonte === tam ? "is-on" : ""} onClick={() => setFonte(tam)} style={{ fontSize: `${0.75 * tam}rem` }}>
                <Type className="h-4 w-4" style={{ width: `${tam}em`, height: `${tam}em` }} aria-hidden /> <span className="sr-only">tamanho {tam}</span>
              </button>
            ))}
          </div>
        </div>
        <div ref={textoRef} className="lei-corpo" style={{ fontSize: `${fonte * 1.06}rem` }}>
          {paragrafos.map((paragrafo, i) => (
            <p key={i}>
              {paragrafo.map((parte, j) =>
                parte.marca < 0 ? (
                  <React.Fragment key={j}>{realcarProva(parte.texto)}</React.Fragment>
                ) : (
                  <button
                    key={j}
                    type="button"
                    className={`lei-palavra ${aberta === parte.marca ? "is-on" : ""}`}
                    onClick={() => setAberta(aberta === parte.marca ? null : parte.marca)}
                    aria-expanded={aberta === parte.marca}
                    title={leitura.palavras[parte.marca].significado}
                  >
                    {parte.texto}
                    {aberta === parte.marca ? (
                      <span className="lei-balao" role="tooltip">
                        {leitura.palavras[parte.marca].significado}
                      </span>
                    ) : null}
                  </button>
                ),
              )}
            </p>
          ))}
        </div>
      </section>

      <aside className="lei-lado">
        <div className="lei-card lei-resumo">
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
        </div>
        {leitura.palavras.length ? (
          <div className="lei-card">
            <p className="caderno-note">glossário</p>
            <dl className="lei-glossario">
              {leitura.palavras.map((p, i) => (
                <div key={p.palavra} className={aberta === i ? "is-on" : ""}>
                  <dt>
                    <button type="button" onClick={() => setAberta(aberta === i ? null : i)}>
                      {p.palavra}
                    </button>
                  </dt>
                  <dd>{p.significado}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
        <button
          type="button"
          className="lei-mine"
          onClick={() =>
            mineConversa(
              "Me ajuda a entender melhor este texto? Quero saber o contexto, a intenção do autor e como ele pode cair numa prova.",
              `O estudante esta na aba Leitura do Minerva lendo "${leitura.titulo}"${leitura.genero ? ` (${leitura.genero})` : ""}. Resumo: ${leitura.resumo}\n\nTrecho inicial do texto:\n${item.texto.slice(0, 3500)}`,
              leitura.titulo,
            )
          }
        >
          <Bot className="h-5 w-5" />
          <span>
            <strong>Conversar sobre o texto</strong>
            <span>Tire dúvidas com a Mine no chat.</span>
          </span>
        </button>
      </aside>

      <section className="lei-perguntas" aria-label="Perguntas de interpretação">
        <div className="lei-perguntas-top">
          <h3>Perguntas de interpretação</h3>
          <div ref={placarRef} className="lei-placar" aria-live="polite">
            {item.terminada ? `${acertos}/${leitura.perguntas.length} certas` : `${respondidas}/${leitura.perguntas.length} respondidas`}
          </div>
        </div>
        <ol className="lei-lista-perguntas">
          {leitura.perguntas.map((pergunta, i) => {
            const escolha = item.respostas[i];
            const respondida = escolha >= 0;
            return (
              <li key={i} className="lei-pergunta">
                <p className="lei-enunciado">
                  <span className="lei-num">{i + 1}</span> {pergunta.pergunta}
                </p>
                <div className="lei-alternativas" role="radiogroup" aria-label={`Pergunta ${i + 1}`}>
                  {pergunta.alternativas.map((alt, j) => {
                    const certa = respondida && j === pergunta.correta;
                    const errada = respondida && j === escolha && j !== pergunta.correta;
                    return (
                      <button
                        key={j}
                        type="button"
                        role="radio"
                        aria-checked={escolha === j}
                        disabled={respondida}
                        className={`lei-alt ${certa ? "is-certa" : ""} ${errada ? "is-errada" : ""}`}
                        onClick={() => {
                          const respostas = [...item.respostas];
                          respostas[i] = j;
                          onMudar({ ...item, respostas });
                          if (j !== pergunta.correta && pergunta.trecho) setProva(pergunta.trecho);
                        }}
                      >
                        <span className="lei-letra">{String.fromCharCode(65 + j)}</span>
                        <span>{alt}</span>
                        {certa ? <CheckCircle2 className="ml-auto h-5 w-5 flex-none" aria-label="certa" /> : null}
                        {errada ? <XCircle className="ml-auto h-5 w-5 flex-none" aria-label="sua resposta, errada" /> : null}
                      </button>
                    );
                  })}
                </div>
                {respondida ? (
                  <div className={`lei-explica ${escolha === pergunta.correta ? "is-certa" : "is-errada"}`}>
                    <p>
                      <strong>{escolha === pergunta.correta ? "Isso!" : "Quase."}</strong> {pergunta.explicacao}
                    </p>
                    {pergunta.trecho && item.texto.includes(pergunta.trecho) ? (
                      <button type="button" className="lei-link" onClick={() => setProva(pergunta.trecho)}>
                        mostrar no texto onde está a resposta
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
        <div className="lei-fim">
          {item.terminada ? (
            <p className="lei-fim-texto">
              Leitura concluída com {acertos} de {leitura.perguntas.length}. {acertos < leitura.perguntas.length ? "Releia os trechos marcados e tente explicar com suas palavras." : "Interpretação afiada!"}
            </p>
          ) : (
            <button type="button" className="lei-btn caderno-btn-pen" disabled={respondidas < leitura.perguntas.length} onClick={() => onTerminar(item, acertos, placarRef.current)}>
              <CheckCircle2 className="h-4 w-4" /> Terminar leitura
            </button>
          )}
          {item.terminada ? (
            <button type="button" className="lei-link" onClick={() => onMudar({ ...item, respostas: leitura.perguntas.map(() => -1) })}>
              <RotateCcw className="inline h-4 w-4" /> refazer as perguntas (sem XP)
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
