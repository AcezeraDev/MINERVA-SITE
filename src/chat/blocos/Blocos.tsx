import { createContext, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Headphones, Lightbulb, MapPin, Pause, Play, RotateCcw, Volume2, X } from "lucide-react";
import { MineInline } from "../MineRichText";
import { compile, tidyNumber } from "../../../shared/calc.mjs";
import { prettyFormula } from "./formula";
import { askMineTask } from "../../mineTask";
import { lerCorrecaoDissertativa } from "../../../shared/atividades.mjs";
import "./blocos.css";

/*
 * Blocos interativos do chat da Mine (nov/2026). A Mine escreve JSON num
 * bloco de código (```quiz, ```linha-do-tempo, ```mapa, ```funcao, ```timer,
 * ```ditado) e a tela desenha a peça. Formatos em mine/prompts.mjs
 * (buildToolsInstruction). JSON inválido volta a ser código comum.
 */

export const BLOCO_LANGS = new Set(["quiz", "linha-do-tempo", "linhadotempo", "timeline", "mapa", "map", "funcao", "função", "timer", "ditado"]);

const str = (value: unknown, max = 600) => (typeof value === "string" ? value.trim().slice(0, max) : typeof value === "number" ? String(value) : "");
const num = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : Number.isFinite(Number(value)) && value !== "" && value !== null ? Number(value) : fallback);

function readJson(code: string): Record<string, unknown> | null {
  const text = code.trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(text.slice(start, end + 1));
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Quem quiser saber do resultado de um quiz (a Sala de estudo conta para o
 * grupo) põe um provedor em volta; no chat comum não há ninguém ouvindo.
 */
/**
 * O que um bloco pode pedir ao chat principal: mandar uma mensagem nova,
 * salvar flashcards numa matéria ou levar um plano para a Agenda. Só o chat da
 * Mine fornece; na Sala de estudo os botões que dependem disso não aparecem.
 */
export type BlocoAcoes = {
  enviar?: (texto: string) => void;
  salvarFlashcards?: (baralho: { titulo: string; cartoes: { frente: string; verso: string }[] }) => void;
  levarParaAgenda?: (plano: { titulo: string; materia: string; dias: { titulo: string; texto: string; dia: number }[] }) => void;
  /** "Entendi melhor esse" do bloco dois-jeitos: vai para a ficha do aluno. */
  anotarPreferencia?: (preferencia: string) => void;
  /** Erro de quiz no chat: entra no caderno de erros da aba Provas. */
  registrarErro?: (erro: { assunto: string; pergunta: string; opcoes: string[]; correta: number; marcada: number }) => void;
};
export const BlocoAcoesContext = createContext<BlocoAcoes | null>(null);

export const QuizResultadoContext = createContext<((r: { titulo: string; acertos: number; total: number }) => void) | null>(null);

// ── Quiz ────────────────────────────────────────────────────────────────────
// Nov/2026 (21): no estilo do simulado do ChatGPT. Cada alternativa pode ter o
// seu "porquê" (aparece debaixo da marcada e da certa), a lâmpada mostra uma
// dica antes de responder, fórmula sai desenhada (KaTeX) e o fim lista cada
// questão com ✓/✗, o que a pessoa marcou e a explicação.
// Nov/2026 (25): tipos novos, como no NotebookLM — verdadeiro ou falso
// ("vf"), várias certas ("varias"), completar a lacuna ("lacuna") e resposta
// curta ("curta", que o próprio estudante confere com o gabarito ou pede a
// correção da Mine). Errou: "Por que errei?" pergunta à Mine e o erro entra
// no caderno de erros da aba Provas.
type TipoPergunta = "multipla" | "vf" | "varias" | "lacuna" | "curta";
type Pergunta = {
  tipo: TipoPergunta;
  pergunta: string;
  opcoes: string[];
  correta: number;
  corretas: number[];
  respostas: string[];
  esperado: string;
  explicacao: string;
  porques: string[];
  dica: string;
};
/** Correção da Mine numa resposta "curta" (mesma task das Atividades). */
type CorrecaoCurta = { nota: number; comentario: string; faltou: string };
type Resposta = { certa: boolean; escolha?: number; escolhas?: number[]; texto?: string; correcao?: CorrecaoCurta } | null;

/** A Mine corrige a resposta escrita: nota de 0 a 10, o que ficou bom e o que faltou. */
async function corrigirComAMine(titulo: string, p: { pergunta: string; esperado: string; explicacao?: string }, texto: string): Promise<CorrecaoCurta> {
  const resposta = await askMineTask(
    {
      task: "atividade-correcao",
      prompt: texto,
      context: [`Quiz: ${titulo}`, `Pergunta: ${p.pergunta.replace(/\$/g, "")}`, `Uma boa resposta precisa: ${p.esperado.replace(/\$/g, "")}`, p.explicacao ? `Explicacao do gabarito: ${p.explicacao.replace(/\$/g, "")}` : ""].filter(Boolean).join(" | "),
      outputTokens: 600,
    },
    { timeoutMs: 60_000 },
  );
  const correcao = lerCorrecaoDissertativa(resposta);
  if (!correcao) throw new Error("A correção veio incompleta.");
  return { nota: correcao.nota, comentario: correcao.comentario, faltou: correcao.faltou };
}

const notaBr = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/**
 * O quiz escreve fórmula com KaTeX ($...$); o que vier em LaTeX solto, sem
 * cifrão ("\frac{1}{2}" no meio da frase), ganha os cifrões para não aparecer cru.
 */
function comFormula(texto: string) {
  if (texto.includes("$")) return texto;
  return /\\(frac|sqrt|cdot|times|div|pi|alpha|beta|Delta|theta)\b/.test(texto) ? `$${texto}$` : texto;
}

function lerQuiz(data: Record<string, unknown>) {
  const perguntas = (Array.isArray(data.perguntas) ? data.perguntas : [])
    .map((item): Pergunta => {
      const raw = item as Record<string, unknown>;
      const tipoBruto = str(raw.tipo, 20).toLowerCase();
      // Alternativa pode vir como texto ou como {texto, porque}.
      const brutas = Array.isArray(raw.opcoes) ? raw.opcoes : [];
      let opcoes = brutas.map((op) => comFormula(str(typeof op === "object" && op ? (op as Record<string, unknown>).texto : op, 240))).slice(0, 6);
      const respostas = (Array.isArray(raw.respostas) ? raw.respostas : typeof raw.resposta === "string" ? [raw.resposta] : []).map((r) => str(r, 80)).filter(Boolean).slice(0, 6);
      const corretas = (Array.isArray(raw.corretas) ? raw.corretas : []).map((n) => Math.round(num(n, -1))).filter((n) => n >= 0 && n < opcoes.length);
      const tipo: TipoPergunta =
        tipoBruto === "lacuna" && respostas.length
          ? "lacuna"
          : tipoBruto === "curta"
            ? "curta"
            : (tipoBruto === "varias" || tipoBruto === "várias") && corretas.length
              ? "varias"
              : tipoBruto === "vf" || tipoBruto === "verdadeiro-falso"
                ? "vf"
                : "multipla";
      if (tipo === "vf" && opcoes.length < 2) opcoes = ["Verdadeiro", "Falso"];
      const porquesSoltos = Array.isArray(raw.porques) ? raw.porques : [];
      const porques = opcoes.map((_, i) => {
        const op = brutas[i];
        const dentro = typeof op === "object" && op ? str((op as Record<string, unknown>).porque, 400) : "";
        return comFormula(dentro || str(porquesSoltos[i], 400));
      });
      return {
        tipo,
        pergunta: comFormula(str(raw.pergunta, 700)),
        opcoes: tipo === "lacuna" || tipo === "curta" ? [] : opcoes,
        correta: Math.round(num(raw.correta, -1)),
        corretas,
        respostas,
        esperado: comFormula(str(raw.esperado ?? raw.explicacao, 600)),
        explicacao: comFormula(str(raw.explicacao, 600)),
        porques,
        dica: comFormula(str(raw.dica, 300)),
      };
    })
    .filter((item) => {
      if (!item.pergunta) return false;
      if (item.tipo === "lacuna") return item.respostas.length > 0;
      if (item.tipo === "curta") return Boolean(item.esperado);
      if (item.tipo === "varias") return item.opcoes.length >= 2 && item.corretas.length > 0;
      return item.opcoes.length >= 2 && item.opcoes.every(Boolean) && item.correta >= 0 && item.correta < item.opcoes.length;
    })
    .slice(0, 10);
  return perguntas.length ? { titulo: str(data.titulo, 120) || "Quiz rápido", perguntas } : null;
}

const letra = (i: number) => String.fromCharCode(65 + i);

function semAcentoQuiz(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Uma letra trocada passa ("fotosintese"); mais que isso, não. */
function quaseIgual(a: string, b: string) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 5) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i += 1;
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1);
}

function textoCerto(p: Pergunta) {
  if (p.tipo === "lacuna") return p.respostas[0];
  if (p.tipo === "curta") return p.esperado;
  if (p.tipo === "varias") return p.corretas.map((i) => `${letra(i)}) ${p.opcoes[i]}`).join("; ");
  return `${letra(p.correta)}) ${p.opcoes[p.correta]}`;
}

function textoMarcado(p: Pergunta, r: Resposta) {
  if (!r) return "";
  if (r.texto !== undefined) return r.texto;
  if (r.escolhas) return r.escolhas.map((i) => `${letra(i)}) ${p.opcoes[i]}`).join("; ");
  return r.escolha !== undefined ? `${letra(r.escolha)}) ${p.opcoes[r.escolha]}` : "";
}

function Quiz({ titulo, perguntas }: { titulo: string; perguntas: Pergunta[] }) {
  const [index, setIndex] = useState(0);
  const [respostas, setRespostas] = useState<Resposta[]>(() => perguntas.map(() => null));
  const [dicaAberta, setDicaAberta] = useState(false);
  const [fim, setFim] = useState(false);
  const [marcadas, setMarcadas] = useState<number[]>([]);
  const [digitado, setDigitado] = useState("");
  const [vendoGabarito, setVendoGabarito] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);
  const [erroCorrecao, setErroCorrecao] = useState("");
  const avisarResultado = useContext(QuizResultadoContext);
  const acoes = useContext(BlocoAcoesContext);
  const atual = perguntas[index];
  const resposta = respostas[index];
  const acertos = respostas.filter((r) => r?.certa).length;

  const responder = (r: NonNullable<Resposta>) => {
    if (resposta) return;
    setRespostas((lista) => lista.map((item, i) => (i === index ? r : item)));
    // Erro de alternativa vai para o caderno de erros (aba Provas).
    if (!r.certa && atual.opcoes.length && acoes?.registrarErro) {
      const marcada = r.escolha ?? r.escolhas?.find((i) => !atual.corretas.includes(i)) ?? 0;
      acoes.registrarErro({ assunto: titulo, pergunta: atual.pergunta.replace(/\$/g, ""), opcoes: atual.opcoes.map((o) => o.replace(/\$/g, "")), correta: atual.tipo === "varias" ? atual.corretas[0] : atual.correta, marcada });
    }
  };
  const conferirVarias = () => {
    const certas = [...atual.corretas].sort().join(",");
    responder({ certa: [...marcadas].sort().join(",") === certas, escolhas: marcadas });
  };
  const conferirLacuna = () => {
    const alvo = semAcentoQuiz(digitado);
    responder({ certa: atual.respostas.some((r) => quaseIgual(semAcentoQuiz(r), alvo)), texto: digitado.trim() });
  };
  // Resposta escrita: a Mine dá a nota; 6 ou mais conta como acerto.
  const corrigirCurta = async () => {
    const texto = digitado.trim();
    if (!texto || corrigindo) return;
    setCorrigindo(true);
    setErroCorrecao("");
    try {
      const correcao = await corrigirComAMine(titulo, atual, texto);
      responder({ certa: correcao.nota >= 6, texto, correcao });
    } catch (error) {
      setErroCorrecao(error instanceof Error ? error.message : "A Mine não conseguiu corrigir agora.");
      setVendoGabarito(true);
    } finally {
      setCorrigindo(false);
    }
  };
  const proxima = () => {
    setErroCorrecao("");
    setDicaAberta(false);
    setMarcadas([]);
    setDigitado("");
    setVendoGabarito(false);
    if (index + 1 >= perguntas.length) {
      setFim(true);
      avisarResultado?.({ titulo, acertos, total: perguntas.length });
    } else setIndex(index + 1);
  };
  const refazer = () => {
    setIndex(0);
    setRespostas(perguntas.map(() => null));
    setDicaAberta(false);
    setMarcadas([]);
    setDigitado("");
    setVendoGabarito(false);
    setFim(false);
  };
  const porQueErrei = (p: Pergunta, r: Resposta) =>
    acoes?.enviar?.(
      `No quiz "${titulo}", na pergunta "${p.pergunta.replace(/\$/g, "").slice(0, 300)}", eu respondi "${textoMarcado(p, r).replace(/\$/g, "")}" e a certa era "${textoCerto(p).replace(/\$/g, "")}". Me explica por que eu errei (qual raciocínio me levou a isso) e me dá uma questão parecida para eu tentar de novo.`,
    );
  const errados = perguntas.filter((_, i) => respostas[i] && !respostas[i]?.certa);

  if (fim) {
    const frase = acertos === perguntas.length ? "Gabaritou! Pode subir o nível." : acertos >= perguntas.length / 2 ? "Mandou bem. Revise o que errou abaixo." : "Vale rever o assunto. Errar aqui é treino.";
    return (
      <section className="mbk mbk-quiz" aria-label={`Resultado do quiz: ${titulo}`}>
        <header className="mbk-head">
          <strong>{titulo}</strong>
          <span className="mbk-meta">Resultado</span>
        </header>
        <div className="mbk-quiz__placar">
          <p className="mbk-quiz__nota">
            {acertos} de {perguntas.length}
          </p>
          <p className="mbk-muted">{frase}</p>
        </div>
        <ol className="mbk-quiz__revisao">
          {perguntas.map((p, i) => {
            const r = respostas[i];
            const certa = Boolean(r?.certa);
            return (
              <li key={i} className={certa ? "is-certa" : "is-errada"}>
                <span className="mbk-letra" aria-label={certa ? "Acertou" : "Errou"}>
                  {certa ? <Check aria-hidden /> : <X aria-hidden />}
                </span>
                <div>
                  <p className="mbk-quiz__rev-pergunta">
                    <MineInline text={p.pergunta} />
                  </p>
                  {!certa && r ? (
                    <p className="mbk-quiz__rev-sua">
                      Você respondeu: <MineInline text={textoMarcado(p, r)} />
                    </p>
                  ) : null}
                  <p className="mbk-quiz__rev-certa">
                    Resposta: <MineInline text={textoCerto(p)} />
                  </p>
                  {p.explicacao || p.porques[p.correta] ? (
                    <p className="mbk-muted">
                      <MineInline text={p.explicacao || p.porques[p.correta]} />
                    </p>
                  ) : null}
                  {!certa && acoes?.enviar ? (
                    <button type="button" className="mbk-link" onClick={() => porQueErrei(p, r)}>
                      Por que errei?
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
        <div className="mbk-row">
          <button type="button" className="mbk-btn is-ghost" onClick={refazer}>
            <RotateCcw aria-hidden /> Tentar de novo
          </button>
          {acoes?.enviar ? (
            <button
              type="button"
              className="mbk-btn"
              onClick={() =>
                acoes.enviar?.(
                  errados.length
                    ? `Faz outro quiz de ${perguntas.length} questões sobre "${titulo}", focando no que eu errei: ${errados.map((p) => p.pergunta.replace(/\$/g, "").slice(0, 90)).join(" | ")}`
                    : `Faz outro quiz de ${perguntas.length} questões sobre "${titulo}", um pouco mais difícil.`,
                )
              }
            >
              Próximo quiz <ChevronRight aria-hidden />
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  const escolhaUnica = resposta?.escolha;
  return (
    <section className="mbk mbk-quiz" aria-label={`Quiz: ${titulo}`}>
      <header className="mbk-head">
        <strong>{titulo}</strong>
        <span className="mbk-quiz__topo">
          <span className="mbk-meta">
            {index + 1} de {perguntas.length}
          </span>
          {atual.dica ? (
            <button type="button" className={`mbk-icon mbk-quiz__dica-btn${dicaAberta ? " is-on" : ""}`} onClick={() => setDicaAberta((v) => !v)} aria-expanded={dicaAberta} aria-label="Mostrar dica" title="Dica">
              <Lightbulb aria-hidden />
            </button>
          ) : null}
        </span>
      </header>
      <div className="mbk-progress" aria-hidden>
        <i style={{ width: `${((index + (resposta ? 1 : 0)) / perguntas.length) * 100}%` }} />
      </div>
      {atual.tipo === "varias" ? <p className="mbk-quiz__tipo">Marque todas as corretas</p> : atual.tipo === "lacuna" ? <p className="mbk-quiz__tipo">Complete a lacuna</p> : atual.tipo === "curta" ? <p className="mbk-quiz__tipo">Responda com suas palavras</p> : atual.tipo === "vf" ? <p className="mbk-quiz__tipo">Verdadeiro ou falso?</p> : null}
      <p className="mbk-quiz__pergunta">
        <MineInline text={atual.pergunta} />
      </p>
      {dicaAberta && atual.dica ? (
        <p className="mbk-quiz__dica" role="note">
          <Lightbulb aria-hidden /> <MineInline text={atual.dica} />
        </p>
      ) : null}

      {atual.tipo === "lacuna" || atual.tipo === "curta" ? (
        <div className="mbk-quiz__escrever">
          {atual.tipo === "lacuna" ? (
            <input
              type="text"
              value={resposta?.texto ?? digitado}
              onChange={(event) => setDigitado(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && digitado.trim() && !resposta && conferirLacuna()}
              disabled={Boolean(resposta)}
              placeholder="Escreva a palavra que falta"
              aria-label="Sua resposta"
              className={resposta ? (resposta.certa ? "is-certa" : "is-errada") : ""}
            />
          ) : (
            <textarea value={resposta?.texto ?? digitado} onChange={(event) => setDigitado(event.target.value)} disabled={Boolean(resposta) || vendoGabarito || corrigindo} rows={3} placeholder="Escreva sua resposta em 1 ou 2 frases" aria-label="Sua resposta" />
          )}
          {!resposta && atual.tipo === "lacuna" ? (
            <button type="button" className="mbk-btn" onClick={conferirLacuna} disabled={!digitado.trim()}>
              Conferir
            </button>
          ) : null}
          {!resposta && atual.tipo === "curta" && !vendoGabarito ? (
            <div className="mbk-row">
              <button type="button" className="mbk-btn" onClick={() => void corrigirCurta()} disabled={!digitado.trim() || corrigindo} aria-busy={corrigindo}>
                {corrigindo ? (
                  <>
                    <span className="mbk-quiz__lendo" aria-hidden /> A Mine está lendo sua resposta…
                  </>
                ) : (
                  <>
                    <Check aria-hidden /> Corrigir com a Mine
                  </>
                )}
              </button>
              {!corrigindo ? (
                <button type="button" className="mbk-link" onClick={() => setVendoGabarito(true)} disabled={!digitado.trim()}>
                  Comparar sozinho
                </button>
              ) : null}
            </div>
          ) : null}
          {erroCorrecao && !resposta ? <p className="mbk-muted">{erroCorrecao} Compare com a resposta esperada abaixo.</p> : null}
          {atual.tipo === "curta" && vendoGabarito && !resposta ? (
            <div className="mbk-quiz__esperado">
              <p>
                <b>Uma boa resposta tem:</b> <MineInline text={atual.esperado} />
              </p>
              <div className="mbk-row">
                <button type="button" className="mbk-btn" onClick={() => responder({ certa: true, texto: digitado.trim() })}>
                  <Check aria-hidden /> Acertei
                </button>
                <button type="button" className="mbk-btn is-ghost" onClick={() => responder({ certa: false, texto: digitado.trim() })}>
                  <X aria-hidden /> Errei ou faltou algo
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <ol className="mbk-quiz__opcoes">
          {atual.opcoes.map((op, i) => {
            const varias = atual.tipo === "varias";
            const ehCerta = varias ? atual.corretas.includes(i) : i === atual.correta;
            const marcou = varias ? (resposta?.escolhas || marcadas).includes(i) : escolhaUnica === i;
            const estado = !resposta ? (varias && marcou ? "is-marcada" : "") : ehCerta ? "is-certa" : marcou ? "is-errada" : "is-apagada";
            const porque = resposta && (marcou || ehCerta) ? atual.porques[i] : "";
            return (
              <li key={i}>
                <button
                  type="button"
                  className={estado}
                  onClick={() => (varias ? setMarcadas((lista) => (lista.includes(i) ? lista.filter((n) => n !== i) : [...lista, i])) : responder({ certa: i === atual.correta, escolha: i }))}
                  disabled={Boolean(resposta)}
                  aria-pressed={marcou}
                >
                  <span className="mbk-letra" aria-hidden>
                    {estado === "is-certa" ? <Check /> : estado === "is-errada" ? <X /> : letra(i)}
                  </span>
                  <span className="mbk-quiz__op">
                    <MineInline text={op} />
                    {porque ? (
                      <small className="mbk-quiz__porque">
                        <MineInline text={porque} />
                      </small>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {atual.tipo === "varias" && !resposta ? (
        <div className="mbk-row">
          <button type="button" className="mbk-btn" onClick={conferirVarias} disabled={!marcadas.length}>
            Conferir
          </button>
        </div>
      ) : null}
      {resposta ? (
        <div className={`mbk-quiz__feedback ${resposta.certa ? "is-certa" : "is-errada"}`} role="status">
          {resposta.correcao ? (
            <div className="mbk-quiz__correcao">
              <p className="mbk-quiz__nota-mine">
                <span>
                  {notaBr(resposta.correcao.nota)}
                  <small>/10</small>
                </span>
                <b>{resposta.correcao.nota >= 9 ? "Excelente!" : resposta.correcao.nota >= 6 ? "Boa resposta!" : resposta.correcao.nota >= 3 ? "Quase lá" : "Vamos rever"}</b>
              </p>
              <p>
                <MineInline text={resposta.correcao.comentario} />
              </p>
              {resposta.correcao.faltou ? (
                <p className="mbk-quiz__faltou">
                  <b>Faltou:</b> <MineInline text={resposta.correcao.faltou} />
                </p>
              ) : null}
              <p className="mbk-muted">
                <b>Resposta esperada:</b> <MineInline text={atual.esperado} />
              </p>
            </div>
          ) : null}
          <strong>{resposta.correcao ? "" : resposta.certa ? "Certa!" : atual.tipo === "multipla" || atual.tipo === "vf" ? `A certa é a ${letra(atual.correta)}.` : atual.tipo === "lacuna" ? `Resposta: ${atual.respostas[0]}.` : atual.tipo === "varias" ? `Certas: ${atual.corretas.map(letra).join(", ")}.` : "Anotado."}</strong>
          {atual.explicacao && !atual.porques[atual.correta] ? (
            <span>
              {" "}
              <MineInline text={atual.explicacao} />
            </span>
          ) : null}
          {!resposta.certa && acoes?.enviar ? (
            <button type="button" className="mbk-link" onClick={() => porQueErrei(atual, resposta)}>
              Por que errei?
            </button>
          ) : null}
          <button type="button" className="mbk-btn" onClick={proxima}>
            {index + 1 >= perguntas.length ? "Ver resultado" : "Próxima"} <ChevronRight aria-hidden />
          </button>
        </div>
      ) : null}
    </section>
  );
}

// ── Linha do tempo ──────────────────────────────────────────────────────────
type Evento = { data: string; titulo: string; texto: string };

function lerLinha(data: Record<string, unknown>) {
  const eventos = (Array.isArray(data.eventos) ? data.eventos : [])
    .map((item) => {
      const raw = item as Record<string, unknown>;
      return { data: str(raw.data, 40), titulo: str(raw.titulo, 140), texto: str(raw.texto, 600) };
    })
    .filter((item) => item.data && item.titulo)
    .slice(0, 16);
  return eventos.length >= 2 ? { titulo: str(data.titulo, 120) || "Linha do tempo", eventos } : null;
}

function LinhaDoTempo({ titulo, eventos }: { titulo: string; eventos: Evento[] }) {
  const [ativo, setAtivo] = useState(0);
  const trilho = useRef<HTMLOListElement>(null);
  useEffect(() => {
    trilho.current?.querySelector<HTMLElement>(`[data-i="${ativo}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [ativo]);
  const onKey = (event: ReactKeyboardEvent) => {
    if (event.key === "ArrowRight") setAtivo((value) => Math.min(eventos.length - 1, value + 1));
    if (event.key === "ArrowLeft") setAtivo((value) => Math.max(0, value - 1));
  };
  const evento = eventos[ativo];
  return (
    <section className="mbk mbk-linha" aria-label={`Linha do tempo: ${titulo}`} onKeyDown={onKey}>
      <header className="mbk-head">
        <strong>{titulo}</strong>
        <span className="mbk-meta">
          {eventos[0].data} – {eventos[eventos.length - 1].data}
        </span>
      </header>
      <ol className="mbk-linha__trilho" ref={trilho} role="tablist" aria-label="Eventos">
        {eventos.map((item, i) => (
          <li key={i} data-i={i}>
            <button type="button" role="tab" aria-selected={i === ativo} className={i === ativo ? "is-on" : i < ativo ? "is-passado" : ""} onClick={() => setAtivo(i)}>
              <span className="mbk-linha__data">{item.data}</span>
              <span className="mbk-linha__ponto" aria-hidden />
              <span className="mbk-linha__nome">{item.titulo}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="mbk-linha__card" role="tabpanel" aria-live="polite">
        <span className="mbk-linha__quando">{evento.data}</span>
        <strong>{evento.titulo}</strong>
        {evento.texto ? <p>{evento.texto}</p> : null}
        <div className="mbk-linha__nav">
          <button type="button" className="mbk-icon" onClick={() => setAtivo(Math.max(0, ativo - 1))} disabled={ativo === 0} aria-label="Evento anterior">
            <ChevronLeft aria-hidden />
          </button>
          <span className="mbk-meta">
            {ativo + 1} / {eventos.length}
          </span>
          <button type="button" className="mbk-icon" onClick={() => setAtivo(Math.min(eventos.length - 1, ativo + 1))} disabled={ativo === eventos.length - 1} aria-label="Próximo evento">
            <ChevronRight aria-hidden />
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Mapa ────────────────────────────────────────────────────────────────────
type Lugar = { nome: string; lat: number; lon: number; texto: string };

function lerMapa(data: Record<string, unknown>) {
  const lugares = (Array.isArray(data.lugares) ? data.lugares : [])
    .map((item) => {
      const raw = item as Record<string, unknown>;
      return { nome: str(raw.nome, 100), lat: num(raw.lat, NaN), lon: num(raw.lon ?? raw.lng, NaN), texto: str(raw.texto, 400) };
    })
    .filter((item) => item.nome && Math.abs(item.lat) <= 90 && Math.abs(item.lon) <= 180)
    .slice(0, 12);
  return lugares.length ? { titulo: str(data.titulo, 120) || "Mapa", lugares } : null;
}

function embedUrl(lugares: Lugar[], foco: Lugar | null) {
  const pts = foco ? [foco] : lugares;
  const lats = pts.map((p) => p.lat);
  const lons = pts.map((p) => p.lon);
  const pad = foco ? 0.6 : 2;
  const box = [Math.max(-180, Math.min(...lons) - pad), Math.max(-85, Math.min(...lats) - pad), Math.min(180, Math.max(...lons) + pad), Math.min(85, Math.max(...lats) + pad)];
  const marker = foco || lugares[0];
  return `https://www.openstreetmap.org/export/embed.html?bbox=${box.map((n) => n.toFixed(4)).join("%2C")}&layer=mapnik&marker=${marker.lat.toFixed(5)}%2C${marker.lon.toFixed(5)}`;
}

function Mapa({ titulo, lugares }: { titulo: string; lugares: Lugar[] }) {
  const [foco, setFoco] = useState<number | null>(lugares.length === 1 ? 0 : null);
  const lugar = foco === null ? null : lugares[foco];
  return (
    <section className="mbk mbk-mapa" aria-label={`Mapa: ${titulo}`}>
      <header className="mbk-head">
        <strong>{titulo}</strong>
        <span className="mbk-meta">OpenStreetMap</span>
      </header>
      <div className="mbk-mapa__view">
        <iframe title={`Mapa: ${lugar?.nome || titulo}`} src={embedUrl(lugares, lugar)} loading="lazy" referrerPolicy="no-referrer" />
      </div>
      <ul className="mbk-mapa__lugares">
        {lugares.length > 1 ? (
          <li>
            <button type="button" aria-pressed={foco === null} onClick={() => setFoco(null)}>
              Todos
            </button>
          </li>
        ) : null}
        {lugares.map((item, i) => (
          <li key={i}>
            <button type="button" aria-pressed={foco === i} onClick={() => setFoco(i)}>
              <MapPin aria-hidden /> {item.nome}
            </button>
          </li>
        ))}
      </ul>
      {lugar?.texto ? <p className="mbk-mapa__texto">{lugar.texto}</p> : null}
    </section>
  );
}

// ── Gráfico de função ───────────────────────────────────────────────────────
type Param = { nome: string; min: number; max: number; valor: number; passo: number };

function lerFuncao(data: Record<string, unknown>) {
  const expressao = str(data.expressao, 200);
  if (!expressao) return null;
  const raw = data.parametros && typeof data.parametros === "object" ? (data.parametros as Record<string, Record<string, unknown>>) : {};
  const parametros: Param[] = Object.entries(raw)
    .slice(0, 5)
    .map(([nome, p]) => {
      const min = num(p?.min, -10);
      const max = num(p?.max, 10);
      return { nome: nome.slice(0, 8), min: Math.min(min, max), max: Math.max(min, max), valor: Math.min(Math.max(num(p?.valor, (min + max) / 2), Math.min(min, max)), Math.max(min, max)), passo: Math.abs(num(p?.passo, 0.1)) || 0.1 };
    });
  const xs = Array.isArray(data.x) ? data.x : [-10, 10];
  let x0 = num(xs[0], -10);
  let x1 = num(xs[1], 10);
  if (x1 <= x0) [x0, x1] = [-10, 10];
  try {
    const fn = compile(expressao);
    fn({ x: (x0 + x1) / 2, ...Object.fromEntries(parametros.map((p) => [p.nome, p.valor])) });
    return { titulo: str(data.titulo, 120) || `y = ${expressao}`, expressao, parametros, x0, x1, fn };
  } catch {
    return null;
  }
}

const W = 560;
const H = 340;
const PAD = 34;

function niceStep(span: number) {
  const raw = span / 8;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * pow;
}

function Funcao({ titulo, expressao, parametros, x0, x1, fn }: NonNullable<ReturnType<typeof lerFuncao>>) {
  const [valores, setValores] = useState<Record<string, number>>(() => Object.fromEntries(parametros.map((p) => [p.nome, p.valor])));
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const amostra = (scope: Record<string, number>) => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 480; i += 1) {
      const x = x0 + ((x1 - x0) * i) / 480;
      let y = NaN;
      try {
        y = fn({ ...scope, x });
      } catch {
        y = NaN;
      }
      pts.push([x, y]);
    }
    return pts;
  };
  // Faixa de y fixa (calculada com os valores iniciais): mexer no controle mostra a curva mudando.
  const [yRange, setYRange] = useState<[number, number]>(() => rangeOf(amostra(valores)));
  function rangeOf(pts: Array<[number, number]>): [number, number] {
    const ys = pts.map((p) => p[1]).filter((y) => Number.isFinite(y)).sort((a, b) => a - b);
    if (!ys.length) return [-10, 10];
    let lo = ys[Math.floor(ys.length * 0.03)];
    let hi = ys[Math.ceil(ys.length * 0.97) - 1];
    if (hi - lo < 1e-9) [lo, hi] = [lo - 5, hi + 5];
    const pad = (hi - lo) * 0.15;
    return [Math.min(lo - pad, 0 - pad * 0.2), Math.max(hi + pad, 0 + pad * 0.2)];
  }
  const pontos = useMemo(() => amostra(valores), [valores]); // eslint-disable-line react-hooks/exhaustive-deps
  const [y0, y1] = yRange;
  const sx = (x: number) => PAD + ((x - x0) / (x1 - x0)) * (W - 2 * PAD);
  const sy = (y: number) => H - PAD - ((y - y0) / (y1 - y0)) * (H - 2 * PAD);
  let d = "";
  let pen = false;
  for (const [x, y] of pontos) {
    if (!Number.isFinite(y) || y < y0 - (y1 - y0) * 3 || y > y1 + (y1 - y0) * 3) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`;
    pen = true;
  }
  const stepX = niceStep(x1 - x0);
  const stepY = niceStep(y1 - y0);
  const ticksX: number[] = [];
  for (let v = Math.ceil(x0 / stepX) * stepX; v <= x1 + 1e-9; v += stepX) ticksX.push(Number(v.toPrecision(10)));
  const ticksY: number[] = [];
  for (let v = Math.ceil(y0 / stepY) * stepY; v <= y1 + 1e-9; v += stepY) ticksY.push(Number(v.toPrecision(10)));
  const formula = prettyFormula(parametros.reduce((text, p) => text.replace(new RegExp(`\\b${p.nome}\\b`, "g"), `(${tidyNumber(valores[p.nome])})`), expressao));
  const onMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = x0 + (((event.clientX - box.left) / box.width) * W - PAD) / (W - 2 * PAD) * (x1 - x0);
    if (x < x0 || x > x1) return setHover(null);
    try {
      const y = fn({ ...valores, x });
      setHover(Number.isFinite(y) ? { x, y } : null);
    } catch {
      setHover(null);
    }
  };
  return (
    <section className="mbk mbk-funcao" aria-label={`Gráfico: ${titulo}`}>
      <header className="mbk-head">
        <strong>{titulo}</strong>
        <button type="button" className="mbk-link" onClick={() => setYRange(rangeOf(pontos))}>
          Ajustar zoom
        </button>
      </header>
      <svg viewBox={`0 0 ${W} ${H}`} className="mbk-funcao__svg" role="img" aria-label={`Gráfico de y = ${formula}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticksX.map((v) => (
          <line key={`gx${v}`} x1={sx(v)} x2={sx(v)} y1={PAD} y2={H - PAD} className="mbk-grid" />
        ))}
        {ticksY.map((v) => (
          <line key={`gy${v}`} x1={PAD} x2={W - PAD} y1={sy(v)} y2={sy(v)} className="mbk-grid" />
        ))}
        {y0 < 0 && y1 > 0 ? <line x1={PAD} x2={W - PAD} y1={sy(0)} y2={sy(0)} className="mbk-eixo" /> : null}
        {x0 < 0 && x1 > 0 ? <line x1={sx(0)} x2={sx(0)} y1={PAD} y2={H - PAD} className="mbk-eixo" /> : null}
        {ticksX.map((v) => (
          <text key={`tx${v}`} x={sx(v)} y={H - PAD + 16} textAnchor="middle" className="mbk-tick">
            {tidyNumber(v)}
          </text>
        ))}
        {ticksY.map((v) => (
          <text key={`ty${v}`} x={PAD - 6} y={sy(v) + 4} textAnchor="end" className="mbk-tick">
            {tidyNumber(v)}
          </text>
        ))}
        <path d={d} className="mbk-curva" />
        {hover && hover.y >= y0 && hover.y <= y1 ? (
          <g>
            <circle cx={sx(hover.x)} cy={sy(hover.y)} r={5} className="mbk-ponto" />
            <text x={Math.min(sx(hover.x) + 10, W - 120)} y={Math.max(sy(hover.y) - 10, PAD + 12)} className="mbk-hover">
              ({tidyNumber(Number(hover.x.toFixed(2)))}; {tidyNumber(Number(hover.y.toFixed(3)))})
            </text>
          </g>
        ) : null}
      </svg>
      <p className="mbk-funcao__formula">
        y = <span>{formula}</span>
      </p>
      {parametros.length ? (
        <div className="mbk-funcao__controles">
          {parametros.map((p) => (
            <label key={p.nome}>
              <span>
                <b>{p.nome}</b> = {tidyNumber(valores[p.nome])}
              </span>
              <input type="range" min={p.min} max={p.max} step={p.passo} value={valores[p.nome]} onChange={(event) => setValores((current) => ({ ...current, [p.nome]: Number(event.target.value) }))} />
            </label>
          ))}
        </div>
      ) : null}
    </section>
  );
}

// ── Timer de foco ───────────────────────────────────────────────────────────
function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.25, 0.5].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.22);
    });
  } catch {
    /* sem áudio: o aviso na tela basta */
  }
}

function TimerFoco({ minutos, pausa, tarefa }: { minutos: number; pausa: number; tarefa: string }) {
  const [fase, setFase] = useState<"foco" | "pausa">("foco");
  const total = (fase === "foco" ? minutos : pausa) * 60_000;
  const [restante, setRestante] = useState(total);
  const [rodando, setRodando] = useState(false);
  const [ciclos, setCiclos] = useState(0);
  const fimEm = useRef(0);
  useEffect(() => {
    if (!rodando) return undefined;
    fimEm.current = Date.now() + restante;
    const timer = window.setInterval(() => {
      const left = Math.max(0, fimEm.current - Date.now());
      setRestante(left);
      if (left <= 0) {
        window.clearInterval(timer);
        beep();
        setRodando(false);
        if (fase === "foco") {
          setCiclos((value) => value + 1);
          setFase("pausa");
          setRestante(pausa * 60_000);
        } else {
          setFase("foco");
          setRestante(minutos * 60_000);
        }
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [rodando]); // eslint-disable-line react-hooks/exhaustive-deps
  const mm = String(Math.floor(restante / 60_000)).padStart(2, "0");
  const ss = String(Math.floor((restante % 60_000) / 1000)).padStart(2, "0");
  const frac = 1 - restante / total;
  const R = 54;
  const C = 2 * Math.PI * R;
  return (
    <section className={`mbk mbk-timer is-${fase}`} aria-label="Timer de foco">
      <div className="mbk-timer__ring">
        <svg viewBox="0 0 128 128" aria-hidden>
          <circle cx="64" cy="64" r={R} className="mbk-timer__trilho" />
          <circle cx="64" cy="64" r={R} className="mbk-timer__arco" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
        </svg>
        <div className="mbk-timer__tempo" role="timer" aria-live="off">
          <span>
            {mm}:{ss}
          </span>
          <small>{fase === "foco" ? "foco" : "pausa"}</small>
        </div>
      </div>
      <div className="mbk-timer__info">
        <strong>{fase === "foco" ? tarefa || "Hora de focar" : "Pausa: levanta, bebe água"}</strong>
        <p className="mbk-muted">
          {minutos} min de foco · {pausa} min de pausa{ciclos ? ` · ${ciclos} ${ciclos === 1 ? "ciclo feito" : "ciclos feitos"}` : ""}
        </p>
        <div className="mbk-row">
          <button type="button" className="mbk-btn" onClick={() => setRodando((value) => !value)}>
            {rodando ? <Pause aria-hidden /> : <Play aria-hidden />} {rodando ? "Pausar" : restante < total ? "Continuar" : "Começar"}
          </button>
          <button
            type="button"
            className="mbk-btn is-ghost"
            onClick={() => {
              setRodando(false);
              setFase("foco");
              setRestante(minutos * 60_000);
            }}
          >
            <RotateCcw aria-hidden /> Zerar
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Ditado ──────────────────────────────────────────────────────────────────
type Palavra = { palavra: string; traducao: string };

function semAcento(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9' -]/g, "").replace(/\s+/g, " ").trim();
}

function Ditado({ idioma, palavras }: { idioma: string; palavras: Palavra[] }) {
  const [index, setIndex] = useState(0);
  const [resposta, setResposta] = useState("");
  const [conferida, setConferida] = useState<null | boolean>(null);
  const [acertos, setAcertos] = useState(0);
  const suporte = typeof window !== "undefined" && "speechSynthesis" in window;
  const atual = palavras[index];
  const falar = (devagar = false) => {
    if (!suporte || !atual) return;
    window.speechSynthesis.cancel();
    const fala = new SpeechSynthesisUtterance(atual.palavra);
    fala.lang = idioma;
    fala.rate = devagar ? 0.6 : 0.9;
    window.speechSynthesis.speak(fala);
  };
  const conferir = () => {
    if (conferida !== null || !resposta.trim()) return;
    const certo = semAcento(resposta) === semAcento(atual.palavra);
    setConferida(certo);
    if (certo) setAcertos((value) => value + 1);
  };
  const proxima = () => {
    setIndex(index + 1);
    setResposta("");
    setConferida(null);
  };
  if (!atual) {
    return (
      <section className="mbk mbk-ditado" aria-label="Ditado">
        <header className="mbk-head">
          <strong>Ditado</strong>
          <span className="mbk-meta">Resultado</span>
        </header>
        <p className="mbk-quiz__nota">
          {acertos} de {palavras.length}
        </p>
        <button
          type="button"
          className="mbk-btn"
          onClick={() => {
            setIndex(0);
            setAcertos(0);
            setResposta("");
            setConferida(null);
          }}
        >
          <RotateCcw aria-hidden /> Refazer
        </button>
      </section>
    );
  }
  return (
    <section className="mbk mbk-ditado" aria-label="Ditado">
      <header className="mbk-head">
        <strong>
          <Headphones aria-hidden /> Ditado
        </strong>
        <span className="mbk-meta">
          {index + 1} de {palavras.length}
        </span>
      </header>
      <div className="mbk-progress" aria-hidden>
        <i style={{ width: `${(index / palavras.length) * 100}%` }} />
      </div>
      {suporte ? (
        <div className="mbk-row">
          <button type="button" className="mbk-btn" onClick={() => falar(false)}>
            <Volume2 aria-hidden /> Ouvir
          </button>
          <button type="button" className="mbk-btn is-ghost" onClick={() => falar(true)}>
            Devagar
          </button>
        </div>
      ) : (
        <p className="mbk-muted">Este navegador não fala em voz alta. A palavra aparece depois de conferir.</p>
      )}
      <form
        className="mbk-ditado__form"
        onSubmit={(event) => {
          event.preventDefault();
          if (conferida === null) conferir();
          else proxima();
        }}
      >
        <input value={resposta} onChange={(event) => setResposta(event.target.value)} placeholder="Escreva o que ouviu" aria-label="Sua resposta" autoComplete="off" spellCheck={false} disabled={conferida !== null} lang={idioma} />
        <button type="submit" className="mbk-btn">
          {conferida === null ? "Conferir" : "Próxima"}
        </button>
      </form>
      {conferida !== null ? (
        <p className={`mbk-quiz__feedback ${conferida ? "is-certa" : "is-errada"}`} role="status">
          <strong>{conferida ? "Isso!" : "Quase."}</strong> {atual.palavra}
          {atual.traducao ? <span className="mbk-muted"> · {atual.traducao}</span> : null}
        </p>
      ) : null}
    </section>
  );
}

function lerDitado(data: Record<string, unknown>) {
  const palavras = (Array.isArray(data.palavras) ? data.palavras : [])
    .map((item) => {
      const raw = (typeof item === "string" ? { palavra: item } : item) as Record<string, unknown>;
      return { palavra: str(raw.palavra, 60), traducao: str(raw.traducao, 80) };
    })
    .filter((item) => item.palavra)
    .slice(0, 15);
  const idioma = /^[a-z]{2}(-[A-Z]{2})?$/.test(str(data.idioma, 8)) ? str(data.idioma, 8) : "en-US";
  return palavras.length ? { idioma, palavras } : null;
}

/** Desenha o bloco; devolve null se o JSON não servir (aí vira código comum). */
export function BlocoInterativo({ lang, code, fallback }: { lang: string; code: string; fallback: ReactNode }) {
  const data = useMemo(() => readJson(code), [code]);
  const kind = lang === "linhadotempo" || lang === "timeline" ? "linha-do-tempo" : lang === "map" ? "mapa" : lang === "função" ? "funcao" : lang;
  const parsed = useMemo(() => {
    if (!data) return null;
    if (kind === "quiz") return lerQuiz(data);
    if (kind === "linha-do-tempo") return lerLinha(data);
    if (kind === "mapa") return lerMapa(data);
    if (kind === "funcao") return lerFuncao(data);
    if (kind === "ditado") return lerDitado(data);
    if (kind === "timer") return { minutos: Math.min(180, Math.max(1, Math.round(num(data.minutos, 25)))), pausa: Math.min(60, Math.max(1, Math.round(num(data.pausa, 5)))), tarefa: str(data.tarefa, 120) };
    return null;
  }, [data, kind]);
  if (!parsed) return <>{fallback}</>;
  if (kind === "quiz") return <Quiz {...(parsed as NonNullable<ReturnType<typeof lerQuiz>>)} />;
  if (kind === "linha-do-tempo") return <LinhaDoTempo {...(parsed as NonNullable<ReturnType<typeof lerLinha>>)} />;
  if (kind === "mapa") return <Mapa {...(parsed as NonNullable<ReturnType<typeof lerMapa>>)} />;
  if (kind === "funcao") return <Funcao {...(parsed as NonNullable<ReturnType<typeof lerFuncao>>)} />;
  if (kind === "ditado") return <Ditado {...(parsed as NonNullable<ReturnType<typeof lerDitado>>)} />;
  return <TimerFoco {...(parsed as { minutos: number; pausa: number; tarefa: string })} />;
}

