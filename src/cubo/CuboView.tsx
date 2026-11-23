// Carregado sob demanda (React.lazy): a aba Cubo Mágico. Cubo 3D para girar
// na tela (arrasto ou teclado), embaralhar, cronometrar e guardar recordes;
// e um modo "cubo de verdade", em que o site só embaralha e cronometra.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Box, Compass, Hand, Keyboard, RotateCcw, Shuffle, Timer, Trash2, Undo2, Wand2 } from "lucide-react";
import { PageHeader, uid, type User } from "../main";
import { useSoftMotion } from "../motion";
import { celebrateFrom, mineConversa, mineSays } from "../caderno";
import {
  aplicarGiros,
  caminhoDeVolta,
  coresHex,
  corNomes,
  criarCuboTipo,
  etapaDoMetodo,
  formatarTempo,
  gerarEmbaralhamentoTipo,
  infoTipoCubo,
  inverso,
  planificar,
  resumoTempos,
  textoDosGirosTipo,
  tiposDeCubo,
  type Face,
  type Giro,
  type Planificacao,
  type Solve,
  type TipoCubo,
} from "../../shared/cubo.mjs";
import {
  caminhoDeVoltaPyraminx,
  gerarEmbaralhamentoPyraminx,
  inversoPyraminx,
  textoDosGirosPyraminx,
  type GiroPyraminx,
} from "../../shared/pyraminx.mjs";
import { CuboCena, isGiroPyraminx, type Movimento } from "./CuboCena";
import { CuboBorderBeam, CuboShimmerButton } from "./CuboFx";
import { CuboSeletor, IconeCubo } from "./CuboSeletor";
import { perguntarMineCubo, type TurnoTutor } from "./mineTutor";
import { AulaDaMine, FichasAlgoritmo } from "./AulaDaMine";
import { elogio, explicarToken, instrucao, lerToken, passosAula, teclaDoToken, type PassoAula } from "./aula";
import "./cubo.css";

type Modo = "tela" | "real";
type Fase = "livre" | "embaralhando" | "inspecao" | "pronto" | "valendo" | "resolvido" | "volta" | "segurando" | "liberado" | "treino";
type AulaViva = {
  tipo: "demo" | "treino";
  passo: PassoAula;
  setup: number;
  feitos: number;
  /** Treino: próximo giro do algoritmo, quartos já feitos de um giro duplo e giros errados ainda não desfeitos. */
  idx: number;
  meio: number;
  desvio: Giro[];
  acertos: number;
} | null;
type Fala = { texto: string; humor: "fala" | "ok" | "erro" | "dica" | "festa"; n: number };
const quartos = (q: number) => ((q % 4) + 4) % 4;
const chaveAula = (userId: string) => `minerva-cubo-aula-v1:${userId}`;
type Prefs = { n: number; tipo: TipoCubo; modo: Modo; inspecao: boolean };

const TIPOS_VALIDOS = new Set<string>(tiposDeCubo.map((t) => t.id));
function normalizarTipo(tipo?: string, n?: number): TipoCubo {
  if (tipo && TIPOS_VALIDOS.has(tipo)) return tipo as TipoCubo;
  if (n === 2) return "2x2";
  if (n === 4) return "4x4";
  if (n === 5) return "5x5";
  return "3x3";
}
function tipoDoSolve(s: Solve): TipoCubo {
  return normalizarTipo(s.tipo, s.n);
}

const INSPECAO_MS = 15000;
const SEGURAR_MS = 300;
const mola = { type: "spring" as const, stiffness: 300, damping: 30, mass: 1 };

const chavePrefs = "minerva-cubo-prefs-v1";
const chaveTempos = (userId: string) => `minerva-cubo-v1:${userId}`;

function ler<T>(chave: string, reserva: T): T {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? { ...reserva, ...JSON.parse(bruto) } : reserva;
  } catch {
    return reserva;
  }
}
function lerLista(chave: string): Solve[] {
  try {
    const bruto = localStorage.getItem(chave);
    const lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}
function gravar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* modo anônimo: os tempos valem só nesta visita */
  }
}

const tempoDe = (s: Solve) => (s.dnf ? null : s.ms + (s.mais2 ? 2000 : 0));
const mostrar = (ms: number | null | undefined) => (ms === Infinity ? "DNF" : formatarTempo(ms ?? null));

export function CuboView({ user }: { user: User }) {
  const reduzido = useSoftMotion();
  const [prefs, setPrefs] = useState<Prefs>(() => {
    const salvo = ler<Partial<Prefs>>(chavePrefs, { n: 3, tipo: "3x3", modo: "tela", inspecao: false });
    const tipo = normalizarTipo(salvo.tipo, salvo.n);
    const info = infoTipoCubo(tipo);
    return {
      n: Math.max(...info.dims),
      tipo,
      modo: salvo.modo === "real" ? "real" : "tela",
      inspecao: !!salvo.inspecao,
    };
  });
  const [solves, setSolves] = useState<Solve[]>(() => lerLista(chaveTempos(user.id)));
  const [fase, setFase] = useState<Fase>("livre");
  const [embaralhamento, setEmbaralhamento] = useState<Movimento[]>([]);
  const [giros, setGiros] = useState(0);
  const [ultimo, setUltimo] = useState<{ ms: number; giros: number; recorde: boolean } | null>(null);
  const [planif, setPlanif] = useState<Planificacao>(() => planificar(criarCuboTipo(prefs.tipo === "pyraminx" ? "3x3" : prefs.tipo)));
  const [ajuda, setAjuda] = useState(false);
  const [passoAtual, setPassoAtual] = useState(0);
  const [ficha, setFicha] = useState(-1);
  const [aulaViva, setAulaViva] = useState<{ tipo: "demo" | "treino"; passo: PassoAula } | null>(null);
  const [aprendidos, setAprendidos] = useState<string[]>(() => {
    try {
      const lista = JSON.parse(localStorage.getItem(chaveAula(user.id)) || "[]");
      return Array.isArray(lista) ? lista : [];
    } catch {
      return [];
    }
  });
  useEffect(() => gravar(chaveAula(user.id), aprendidos), [aprendidos, user.id]);
  const aula = useRef<AulaViva>(null);
  const [fala, setFala] = useState<Fala | null>(null);
  const falar = useCallback((texto: string, humor: Fala["humor"] = "fala") => setFala((f) => ({ texto, humor, n: (f?.n ?? 0) + 1 })), []);

  /* ---------- a Mine de verdade (IA) falando em tempo real ---------- */

  const [pensando, setPensando] = useState(false);
  const [aoVivo, setAoVivo] = useState(false);
  const aoVivoLigado = useRef(false);
  const olharEtapaRef = useRef<() => unknown>(() => null);
  aoVivoLigado.current = aoVivo;
  const [pergunta, setPergunta] = useState("");
  const [ultimaPergunta, setUltimaPergunta] = useState("");
  const iaSeq = useRef(0);
  const iaAbort = useRef<AbortController | null>(null);
  const iaEspera = useRef<number | undefined>(undefined);
  const iaFalhas = useRef(0);
  const historicoIA = useRef<TurnoTutor[]>([]);
  const contextoRef = useRef<() => string>(() => "");

  /**
   * Manda o evento para a Mine (IA) e mostra a resposta no balão. `reserva`
   * é a fala pronta do site: aparece se a IA falhar ou demorar, e sempre se a
   * IA já falhou duas vezes seguidas (sem chave, sem internet).
   */
  const falarIA = useCallback(
    (evento: string, reserva: string, humor: Fala["humor"] = "fala", opcoes: { pergunta?: boolean; atraso?: number } = {}) => {
      window.clearTimeout(iaEspera.current);
      const seq = ++iaSeq.current;
      if (iaFalhas.current >= 2 && !opcoes.pergunta) {
        iaAbort.current?.abort();
        setPensando(false);
        falar(reserva, humor);
        return;
      }
      const disparar = () => {
        iaAbort.current?.abort();
        const controle = new AbortController();
        iaAbort.current = controle;
        setPensando(true);
        const demorou = window.setTimeout(() => {
          if (iaSeq.current === seq && !opcoes.pergunta) falar(reserva, humor);
        }, 7000);
        perguntarMineCubo({ evento, contexto: contextoRef.current(), historico: historicoIA.current, pergunta: opcoes.pergunta }, controle.signal)
          .then((texto) => {
            iaFalhas.current = 0;
            historicoIA.current = [...historicoIA.current, { role: "user" as const, text: evento }, { role: "assistant" as const, text: texto }].slice(-10);
            if (iaSeq.current === seq) falar(texto, humor);
          })
          .catch(() => {
            if (controle.signal.aborted && iaAbort.current !== controle) return;
            iaFalhas.current += 1;
            if (iaSeq.current === seq) falar(reserva, humor);
          })
          .finally(() => {
            window.clearTimeout(demorou);
            if (iaSeq.current === seq) setPensando(false);
          });
      };
      if (opcoes.atraso) iaEspera.current = window.setTimeout(disparar, opcoes.atraso);
      else disparar();
    },
    [falar],
  );

  const calarIA = useCallback(() => {
    window.clearTimeout(iaEspera.current);
    iaSeq.current += 1;
    iaAbort.current?.abort();
    setPensando(false);
  }, []);
  useEffect(() => () => calarIA(), [calarIA]);

  const palcoRef = useRef<HTMLDivElement>(null);
  const relogioRef = useRef<HTMLSpanElement>(null);
  const cenaRef = useRef<CuboCena | null>(null);
  // estado lido pelos callbacks da cena e do teclado sem recriar a cena
  const vivo = useRef({ fase: "livre" as Fase, inicio: 0, giros: 0, historico: [] as Movimento[], meus: [] as Movimento[], prefs, embaralhamento: [] as Movimento[] });
  vivo.current.prefs = prefs;

  const mudarFase = useCallback((f: Fase) => {
    vivo.current.fase = f;
    setFase(f);
  }, []);

  useEffect(() => gravar(chavePrefs, prefs), [prefs]);
  useEffect(() => gravar(chaveTempos(user.id), solves), [solves, user.id]);

  const infoAtivo = useMemo(() => infoTipoCubo(prefs.tipo), [prefs.tipo]);
  const doTamanho = useMemo(() => solves.filter((s) => tipoDoSolve(s) === prefs.tipo && s.modo === prefs.modo), [solves, prefs.tipo, prefs.modo]);
  const resumo = useMemo(() => resumoTempos(doTamanho), [doTamanho]);

  /* ---------- registrar um tempo ---------- */

  const registrar = useCallback(
    (ms: number, qtdGiros: number) => {
      const v = vivo.current;
      const tipo = v.prefs.tipo;
      const info = infoTipoCubo(tipo);
      const anteriores = solves.filter((s) => tipoDoSolve(s) === tipo && s.modo === v.prefs.modo);
      const melhor = resumoTempos(anteriores).melhor;
      const recorde = anteriores.length > 0 && (melhor == null || ms < melhor);
      const embTexto =
        tipo === "pyraminx"
          ? textoDosGirosPyraminx(v.embaralhamento as GiroPyraminx[])
          : textoDosGirosTipo(v.embaralhamento as Giro[], tipo);
      const novo: Solve = { id: uid("cubo"), n: v.prefs.n, tipo, ms, giros: qtdGiros, em: Date.now(), modo: v.prefs.modo, embaralhamento: embTexto };
      setSolves((lista) => [...lista, novo].slice(-300));
      setUltimo({ ms, giros: qtdGiros, recorde });
      if (relogioRef.current) relogioRef.current.textContent = formatarTempo(ms);
      celebrateFrom(relogioRef.current, { count: recorde ? 40 : 22 });
      mineSays(recorde ? `Recorde! ${formatarTempo(ms)} no ${info.nome}.` : `Montou o ${info.nome} em ${formatarTempo(ms)}!`, "wow");
    },
    [solves],
  );
  const registrarRef = useRef(registrar);
  registrarRef.current = registrar;

  /* ---------- cena ---------- */

  useEffect(() => {
    const host = palcoRef.current;
    if (!host) return;
    const cena = new CuboCena(host, {
      tipo: vivo.current.prefs.tipo,
      reduzido,
      onGiro: (giro, { origem, resolvido }) => {
        const v = vivo.current;
        if (origem !== "volta") v.historico.push(giro);
        if (origem !== "usuario" || v.prefs.modo === "real") return;
        v.meus.push(giro);
        if (v.fase === "treino") {
          if (resolvido) aulaOkRef.current();
          else if (!isGiroPyraminx(giro)) treinadorRef.current(giro);
          return;
        }
        if (v.fase === "inspecao" || v.fase === "pronto") {
          v.inicio = performance.now();
          v.giros = 0;
          mudarFase("valendo");
        }
        if (v.fase === "valendo") {
          v.giros += 1;
          setGiros(v.giros);
          if (resolvido) {
            const ms = performance.now() - v.inicio;
            mudarFase("resolvido");
            registrarRef.current(ms, v.giros);
            cena.comemorar();
          }
          else aoVivoRef.current();
        } else if (!resolvido) aoVivoRef.current();
        else if (v.historico.length > 1) {
          mineSays("Montado! Embaralha de novo e cronometra?", "happy");
          cena.comemorar();
          v.historico = [];
        }
      },
      onOcioso: () => {
        const v = vivo.current;
        if (v.fase === "embaralhando") {
          cena.travado = v.prefs.modo === "real";
          v.meus = [];
          if (v.prefs.modo === "real") mudarFase("pronto");
          else if (v.prefs.inspecao) {
            v.inicio = performance.now() + INSPECAO_MS;
            mudarFase("inspecao");
          } else mudarFase("pronto");
        } else if (v.fase === "volta") {
          cena.travado = v.prefs.modo === "real";
          const a = aula.current;
          if (a?.tipo === "treino") {
            // caso montado: agora é a vez da pessoa, com a Mine junto
            v.meus = [];
            mudarFase("treino");
            const primeiro = a.passo.algoritmo[0];
            setFicha(0);
            cena.destacar(esperadoRef.current());
            falarIA("EVENTO: comecou o treino agora. Anime o aluno em uma frase e diga o primeiro giro.", `Sua vez! São ${a.passo.algoritmo.length} giros e eu vou falando um por um. Primeiro ${instrucao(primeiro)}`);
            return;
          }
          v.historico = [];
          if (a?.tipo === "demo") {
            aula.current = null;
            setAoVivo(true);
            window.setTimeout(() => {
              if (aula.current) return;
              setAulaViva(null);
              setFicha(-1);
            }, 4000);
          }
          mudarFase("livre");
        }
      },
      onAnimado: () => {
        const a = aula.current;
        if (a?.tipo !== "demo") return;
        a.feitos += 1;
        const i = a.feitos - a.setup - 1;
        if (i === -1) falar("Pronto, bagunçado. Agora presta atenção nos giros que trazem de volta:");
        if (i >= 0) {
          setFicha(i);
          const t = a.passo.algoritmo[i];
          falar(i === a.passo.algoritmo.length - 1 ? `E por último ${t}: ${explicarToken(t)}. Viu? Voltou! Agora treina você.` : `${t}: ${explicarToken(t)}.`);
        }
      },
    });
    cena.travado = vivo.current.prefs.modo === "real";
    cenaRef.current = cena;
    return () => {
      cena.destruir();
      cenaRef.current = null;
    };
    // a cena nasce uma vez; tamanho e modo mudam por métodos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => cenaRef.current?.setReduzido(reduzido), [reduzido]);

  /* ---------- relógio (escreve direto no nó, sem setState por quadro) ---------- */

  useEffect(() => {
    const no = relogioRef.current;
    if (!no) return;
    if (fase !== "valendo" && fase !== "inspecao") return;
    let quadro = 0;
    const laco = () => {
      const v = vivo.current;
      const agora = performance.now();
      if (v.fase === "inspecao") {
        const falta = v.inicio - agora;
        if (falta <= 0) {
          v.inicio = agora;
          v.giros = 0;
          mudarFase("valendo");
          return;
        }
        no.textContent = String(Math.ceil(falta / 1000));
      } else no.textContent = formatarTempo(agora - v.inicio);
      quadro = requestAnimationFrame(laco);
    };
    quadro = requestAnimationFrame(laco);
    return () => cancelAnimationFrame(quadro);
  }, [fase, mudarFase]);

  /* ---------- aula da Mine ---------- */

  const palcoCardRef = useRef<HTMLElement>(null);

  const aulaOk = useCallback(() => {
    const a = aula.current;
    if (!a) return;
    aula.current = null;
    cenaRef.current?.destacar(null);
    setFicha(a.passo.algoritmo.length);
    setAoVivo(true);
    window.setTimeout(() => {
      if (aula.current) return;
      setAulaViva(null);
      setFicha(-1);
    }, 3200);
    mudarFase("livre");
    vivo.current.historico = [];
    setAprendidos((lista) => (lista.includes(a.passo.id) ? lista : [...lista, a.passo.id]));
    cenaRef.current?.comemorar();
    celebrateFrom(palcoCardRef.current, { count: 26 });
    const i = passosAula.findIndex((p) => p.id === a.passo.id);
    const ultimo = i === passosAula.length - 1;
    falarIA(`EVENTO: terminou! O cubo voltou inteiro e o passo \"${a.passo.titulo}\" foi treinado. Comemore e diga em uma frase para que esse passo serve no metodo${ultimo ? " (era o ultimo passo da aula)" : ""}.`, ultimo ? "Você treinou o método inteiro! Agora embaralha e monta sozinho, eu fico torcendo." : `Montou! O passo "${a.passo.titulo}" está no papo. Já deixei o próximo aberto aqui embaixo.`, "festa");
    mineSays(ultimo ? "Método inteiro treinado!" : "Passo treinado!", "wow");
    if (!ultimo) setPassoAtual(i + 1);
  }, [mudarFase]);
  const aulaOkRef = useRef(aulaOk);
  aulaOkRef.current = aulaOk;

  /** Giro que a Mine espera agora (na vista atual: R é sempre a direita da tela). */
  const esperado = useCallback((): Giro | null => {
    const a = aula.current;
    const cena = cenaRef.current;
    if (!a || !cena || a.idx >= a.passo.algoritmo.length) return null;
    const { face, linha } = lerToken(a.passo.algoritmo[a.idx]);
    const g = cena.giroVisual(face, linha);
    return isGiroPyraminx(g) ? null : g;
  }, []);
  const esperadoRef = useRef(esperado);
  esperadoRef.current = esperado;

  /** A Mine confere cada giro do treino e fala o próximo. */
  const treinador = useCallback(
    (giro: Giro) => {
      const a = aula.current;
      const cena = cenaRef.current;
      if (!a || a.tipo !== "treino" || !cena) return;
      const alg = a.passo.algoritmo;
      const mesmaCamada = (x: Giro, y: Giro) => x.eixo === y.eixo && x.camada === y.camada;

      if (a.desvio.length) {
        const ultimoErrado = a.desvio[a.desvio.length - 1];
        if (mesmaCamada(ultimoErrado, giro) && quartos(ultimoErrado.q + giro.q) === 0) {
          a.desvio.pop();
          if (a.desvio.length) falarIA(`EVENTO: desfez um giro errado, mas ainda faltam ${a.desvio.length} para desfazer antes de continuar.`, `Isso, desfez um. Ainda falta desfazer ${a.desvio.length === 1 ? "mais um" : `mais ${a.desvio.length}`} (Ctrl+Z ajuda).`, "dica");
          else {
            falarIA("EVENTO: desfez o erro e voltou ao caminho certo.", `Boa, voltou ao caminho! Agora ${instrucao(alg[a.idx])}`, "ok");
            cena.destacar(esperado());
          }
          return;
        }
        a.desvio.push(giro);
        falarIA(`EVENTO: errou de novo; ja sao ${a.desvio.length} giros fora do caminho para desfazer.`, `Calma! Já são ${a.desvio.length} giros fora do caminho. Aperta Desfazer (ou Ctrl+Z) ${a.desvio.length} vezes e a gente continua de onde parou.`, "erro");
        return;
      }

      const exp = esperado();
      if (!exp) return;
      const alvoQ = quartos(exp.q);
      if (mesmaCamada(exp, giro)) {
        const total = quartos(a.meio + giro.q);
        if (total === alvoQ) {
          a.idx += 1;
          a.meio = 0;
          a.acertos += 1;
          setFicha(a.idx);
          if (a.idx >= alg.length) {
            falarIA("EVENTO: fez todos os giros do algoritmo, mas o cubo nao voltou inteiro (algum giro saiu para o lado errado). Sugira montar o caso de novo.", "Fez o algoritmo inteiro! Hmm, o cubo ainda não voltou… confere se algum giro foi para o outro lado e tenta de novo.", "dica");
            cena.destacar(null);
            return;
          }
          const falta = alg.length - a.idx;
          const animo = falta === 1 ? "Só falta um!" : falta === 2 ? "Faltam dois!" : "";
          falarIA(`EVENTO: acertou o giro ${alg[a.idx - 1]}. Faltam ${alg.length - a.idx} giros.`, `${elogio(a.acertos)} ${animo} Agora ${instrucao(alg[a.idx])}`.replace("  ", " "), "ok", { atraso: 350 });
          cena.destacar(esperado());
          return;
        }
        if (alvoQ === 2 && a.meio === 0) {
          a.meio = quartos(giro.q);
          falarIA(`EVENTO: fez metade do giro duplo ${alg[a.idx]}; falta girar a mesma face mais uma vez para o mesmo lado.`, "Isso, metade! Gira essa mesma face mais uma vez para o mesmo lado.", "ok");
          return;
        }
        if (total === 0) {
          // girou para o lado errado e voltou sozinho: zera a meia-volta
          a.meio = 0;
          falarIA("EVENTO: girou a camada certa e voltou para o comeco deste giro.", `Voltou ao começo deste giro. ${instrucao(alg[a.idx])}`, "dica");
          return;
        }
        a.desvio.push(giro);
        falarIA("EVENTO: girou a camada certa, mas para o lado contrario.", `Quase! Era essa camada, mas para o outro lado. Desfaz (Ctrl+Z) e ${explicarToken(alg[a.idx])} (tecla ${alg[a.idx].endsWith("'") ? "Shift+" + alg[a.idx][0] : alg[a.idx][0]}).`, "erro");
        return;
      }
      a.desvio.push(giro);
      falarIA("EVENTO: girou uma camada errada.", `Opa, essa não era a camada! Desfaz com Ctrl+Z (ou o botão Desfazer) e depois ${explicarToken(alg[a.idx])}.`, "erro");
    },
    [esperado, falar],
  );
  const treinadorRef = useRef(treinador);
  treinadorRef.current = treinador;

  // travou? depois de um tempinho parado a Mine dá uma dica
  useEffect(() => {
    if (fase !== "treino" || !fala) return;
    const t = window.setTimeout(() => {
      const a = aula.current;
      if (!a || a.tipo !== "treino" || vivo.current.fase !== "treino") return;
      if (a.desvio.length) falarIA("EVENTO: o aluno esta parado ha 10 segundos com giros errados ainda por desfazer.", `Dica: aperta Desfazer ${a.desvio.length === 1 ? "uma vez" : `${a.desvio.length} vezes`} para voltar ao caminho.`, "dica");
      else {
        const t = a.passo.algoritmo[a.idx];
        falarIA("EVENTO: o aluno esta parado ha 10 segundos sem girar (travou). De uma dica concreta.", `Sem pressa! Olha a camada brilhando no cubo: ${explicarToken(t)}. No teclado é ${t.endsWith("2") ? t[0] + " duas vezes" : t.endsWith("'") ? "Shift+" + t[0] : t[0]}; com o mouse, arraste uma peça dela nessa direção.`, "dica");
      }
    }, 10000);
    return () => window.clearTimeout(t);
  }, [fala, fase, falar]);

  /** O que a Mine (IA) enxerga agora: passo, próximo giro certo, erros e o estado do cubo. */
  contextoRef.current = () => {
    const cena = cenaRef.current;
    const v = vivo.current;
    const a = aula.current;
    const linhas: string[] = [`Quebra-cabeça: ${infoTipoCubo(v.prefs.tipo).nome}, notacao vista de frente (R = face da direita na tela).`];
    if (a) {
      const alg = a.passo.algoritmo;
      const ordem = passosAula.findIndex((p) => p.id === a.passo.id) + 1;
      linhas.push(`${a.tipo === "treino" ? "TREINO" : "DEMONSTRACAO"} do passo ${ordem} de ${passosAula.length} da aula do metodo de camadas: "${a.passo.titulo}" (${a.passo.resumo}). Algoritmo: ${alg.join(" ")}.`);
      if (a.tipo === "treino") {
        linhas.push(`Giros certos feitos: ${Math.min(a.idx, alg.length)} de ${alg.length}.`);
        if (a.desvio.length) linhas.push(`Giros errados ainda nao desfeitos: ${a.desvio.length}. Antes de seguir ele precisa desfazer (botao Desfazer ou Ctrl+Z).`);
        if (a.idx < alg.length) {
          const t = alg[a.idx];
          linhas.push(`PROXIMO GIRO CERTO: ${t} = ${explicarToken(t)}; tecla ${teclaDoToken(t)}; a camada que deve girar esta brilhando em lilas no cubo.`);
        }
      }
    } else if (v.fase === "valendo") linhas.push("Montagem cronometrada valendo agora: seja breve e nao atrapalhe.");
    if (cena && v.prefs.tipo === "3x3") {
      const estado = cena.estado();
      const etapa = etapaDoMetodo(estado);
      if (etapa) {
        linhas.push(`Pelo estado do cubo, a proxima etapa do metodo de camadas e: ${etapa.nome} (${etapa.feitas} de ${etapa.total} pecas dessa etapa ja certas).`);
        if (!a && etapa.pendentes.length) {
          const lado = (n: number[]) => cena.ladoNaTela(n as [number, number, number]);
          const faces = (ns: number[][]) => ns.map((n) => `face ${lado(n)}`).join(" e ");
          linhas.push("Pecas que ainda faltam nessa etapa (estao BRILHANDO em lilas no cubo; lados como o aluno ve na tela agora):");
          etapa.pendentes.slice(0, 4).forEach((p) => {
            const nome = `${p.cores.length === 2 ? "aresta" : "canto"} ${p.cores.map((c) => corNomes[c]).join("-")}`;
            const viradas = p.viradas.map((v) => `${corNomes[v.cor]} virado para a face ${lado(v.n)}`).join(", ");
            linhas.push(`- ${nome}: esta entre a ${faces(p.onde)} (${viradas}); o lugar certo dela e entre a ${faces(p.destino)}, com cada cor virada para o centro da mesma cor.`);
          });
        }
      }
      linhas.push(`Estado (face: linhas de cima para baixo, iniciais das cores; centro da face U = cor de cima): ${resumoEstado(planificar(estado))}`);
    }
    return linhas.join("\n");
  };

  // Montagem livre com a Mine ao vivo: depois de uma pausa nos giros ela
  // comenta se a etapa do método avançou ou voltou; parado muito tempo, dá dica.
  const etapaVista = useRef<number | null>(null);
  const [etapaInfo, setEtapaInfo] = useState<{ nome: string; feitas: number; total: number; indice: number } | null>(null);

  /** Peças que faltam na etapa: brilham no cubo e viram texto para a Mine. */
  const olharEtapa = useCallback(() => {
    const cena = cenaRef.current;
    if (!cena || vivo.current.prefs.tipo !== "3x3") {
      setEtapaInfo(null);
      return null;
    }
    const etapa = etapaDoMetodo(cena.estado());
    if (!etapa) return null;
    setEtapaInfo({ nome: etapa.nome, feitas: etapa.feitas, total: etapa.total, indice: etapa.indice });
    if (!aula.current) cena.destacarPecas(etapa.pendentes.map((p) => p.id));
    return etapa;
  }, []);
  olharEtapaRef.current = olharEtapa;
  const pausaGiros = useRef<number | undefined>(undefined);
  const aoVivoRef = useRef<() => void>(() => {});
  aoVivoRef.current = () => {
    if (!aoVivo || aula.current || vivo.current.prefs.tipo !== "3x3") return;
    window.clearTimeout(pausaGiros.current);
    pausaGiros.current = window.setTimeout(() => {
      const cena = cenaRef.current;
      if (!cena || aula.current) return;
      const etapa = olharEtapa();
      if (!etapa || etapa.indice === etapaVista.current) return;
      const antes = etapaVista.current;
      etapaVista.current = etapa.indice;
      if (antes === null) return;
      if (etapa.indice > antes)
        falarIA(`EVENTO: o aluno avancou no metodo e agora a proxima etapa e: ${etapa.nome}. Comemore curto e diga a ideia dessa etapa.`, `Boa! Agora é a etapa "${etapa.nome}". Quer ver como faz? Abre o passo na Aula da Mine aqui embaixo.`, "ok");
      else
        falarIA(`EVENTO: o aluno desmanchou parte do que tinha feito; voltou para a etapa: ${etapa.nome}. Sem bronca, explique como nao perder o que ja montou.`, `Opa, desmanchou um pedaço: voltamos para "${etapa.nome}". Acontece! Desfazer (Ctrl+Z) ajuda.`, "dica");
    }, 1400);
  };
  useEffect(() => {
    if (!aoVivo) return;
    etapaVista.current = olharEtapa()?.indice ?? null;
    if (!aula.current && !fala)
      falarIA("EVENTO: o aluno ligou a Mine ao vivo para montar o cubo. Diga em que etapa o cubo esta e como comecar.", "Tô aqui! Gira o cubo que eu vou acompanhando. Pode me perguntar qualquer coisa aqui embaixo.");
    return () => window.clearTimeout(pausaGiros.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aoVivo]);

  const enviarPergunta = (e: React.FormEvent) => {
    e.preventDefault();
    const texto = pergunta.trim();
    if (!texto) return;
    setPergunta("");
    setUltimaPergunta(texto);
    falarIA(`PERGUNTA DO ALUNO: ${texto}`, "Não consegui pensar agora. Tenta perguntar de novo?", "fala", { pergunta: true });
  };

  /** Monta o caso do passo (o algoritmo ao contrário) e, na demonstração, toca o algoritmo devagar. */
  const comecarAula = useCallback(
    (passo: PassoAula, tipo: "demo" | "treino") => {
      const cena = cenaRef.current;
      if (!cena) return;
      const v = vivo.current;
      if (v.prefs.tipo !== "3x3" || v.prefs.modo !== "tela") {
        const novo: Prefs = { ...v.prefs, n: 3, tipo: "3x3", modo: "tela" };
        v.prefs = novo;
        setPrefs(novo);
        cena.setTipo("3x3");
      }
      cena.resetar();
      cena.vistaPadrao(passo.amareloEmCima);
      v.historico = [];
      v.meus = [];
      v.embaralhamento = [];
      setEmbaralhamento([]);
      setUltimo(null);
      setGiros(0);
      if (relogioRef.current) relogioRef.current.textContent = "0.00";
      const setup = [...passo.algoritmo].reverse().map((t) => {
        const { face, linha } = lerToken(t);
        return cena.giroVisual(face, linha === 2 ? 2 : linha === 1 ? -1 : 1);
      });
      aula.current = { tipo, passo, setup: setup.length, feitos: 0, idx: 0, meio: 0, desvio: [], acertos: 0 };
      calarIA();
      historicoIA.current = [];
      setUltimaPergunta("");
      cena.destacar(null);
      falar(tipo === "demo" ? "Olha só: vou bagunçar um pouquinho e te mostrar como volta." : "Vou montar um caso para você treinar. Espera eu bagunçar…");
      setAulaViva({ tipo, passo });
      setFicha(-1);
      cena.travado = true;
      mudarFase("volta");
      cena.esperar(0.5); // dá tempo de o cubo virar para a vista do passo
      setup.forEach((g) => cena.girar(g, "aula", true));
      if (tipo === "demo") {
        cena.esperar(0.9);
        passo.algoritmo.forEach((t) => {
          const { face, linha } = lerToken(t);
          cena.girar(cena.giroVisual(face, linha), "aula", false);
          cena.esperar(0.32);
        });
      }
      palcoCardRef.current?.scrollIntoView({ behavior: reduzido ? "auto" : "smooth", block: "center" });
    },
    [mudarFase, reduzido, calarIA],
  );

  const sairDaAula = useCallback(() => {
    aula.current = null;
    cenaRef.current?.destacar(null);
    setEtapaInfo(null);
    calarIA();
    setFala(null);
    setAoVivo(false);
    setAulaViva(null);
    setFicha(-1);
    if (vivo.current.fase === "treino") mudarFase("livre");
  }, [mudarFase, calarIA]);

  // "Perguntar à Mine" da aula: a resposta vem no balão ao vivo, ao lado do cubo
  const perguntarPasso = (passo: PassoAula) => {
    setAoVivo(true);
    setUltimaPergunta(passo.pergunta);
    falarIA(`PERGUNTA DO ALUNO sobre o passo "${passo.titulo}" da aula (algoritmo ${passo.algoritmo.join(" ") || "nenhum"}): ${passo.pergunta}`, "Não consegui pensar agora. Tenta perguntar de novo?", "fala", { pergunta: true });
    palcoCardRef.current?.scrollIntoView({ behavior: reduzido ? "auto" : "smooth", block: "center" });
  };

  /* ---------- ações ---------- */

  const mostrarEstado = useCallback(() => {
    const cena = cenaRef.current;
    if (cena) setPlanif(planificar(cena.estado()));
  }, []);

  const embaralhar = useCallback(() => {
    const cena = cenaRef.current;
    if (!cena) return;
    aula.current = null;
    cena.destacar(null);
    setFala(null);
    setAulaViva(null);
    setFicha(-1);
    cena.vistaPadrao(false);
    const v = vivo.current;
    const tipo = v.prefs.tipo;
    const seq: Movimento[] = tipo === "pyraminx" ? gerarEmbaralhamentoPyraminx() : gerarEmbaralhamentoTipo(tipo);
    cena.resetar();
    v.historico = [];
    v.meus = [];
    v.giros = 0;
    v.embaralhamento = seq;
    setEmbaralhamento(seq);
    setGiros(0);
    setUltimo(null);
    cena.travado = true;
    mudarFase("embaralhando");
    if (relogioRef.current) relogioRef.current.textContent = v.prefs.inspecao && v.prefs.modo === "tela" ? "15" : "0.00";
    seq.forEach((g) => cena.girar(g, "embaralhar", true));
    etapaVista.current = tipo === "3x3" ? etapaDoMetodo(cena.estado())?.indice ?? null : null;
    if (aoVivoLigado.current) olharEtapaRef.current();
    if (tipo !== "pyraminx") {
      setPlanif(planificar(aplicarGiros(criarCuboTipo(tipo), seq as Giro[])));
    }
  }, [mudarFase]);

  const desfazer = useCallback(() => {
    const cena = cenaRef.current;
    const v = vivo.current;
    if (!cena || v.prefs.modo === "real" || v.fase === "embaralhando" || v.fase === "volta") return;
    const giro = v.meus.pop();
    if (!giro) return;
    cena.girar(isGiroPyraminx(giro) ? inversoPyraminx(giro) : inverso(giro), "usuario");
    v.meus.pop(); // o desfazer não conta como giro novo para desfazer de novo
  }, []);

  const resolverSozinho = useCallback(() => {
    const cena = cenaRef.current;
    const v = vivo.current;
    if (!cena || v.fase === "embaralhando" || v.fase === "volta") return;
    const volta: Movimento[] =
      v.prefs.tipo === "pyraminx"
        ? caminhoDeVoltaPyraminx(v.historico as GiroPyraminx[])
        : caminhoDeVolta(v.historico as Giro[]);
    if (!volta.length) return;
    cena.travado = true;
    mudarFase("volta");
    setUltimo(null);
    if (relogioRef.current) relogioRef.current.textContent = "0.00";
    volta.forEach((g) => cena.girar(g, "volta", volta.length > 30));
  }, [mudarFase]);

  const recomecar = useCallback(() => {
    const cena = cenaRef.current;
    if (!cena) return;
    aula.current = null;
    cena.destacar(null);
    setFala(null);
    setAulaViva(null);
    setFicha(-1);
    const v = vivo.current;
    cena.resetar();
    cena.travado = v.prefs.modo === "real";
    v.historico = [];
    v.meus = [];
    v.embaralhamento = [];
    setEmbaralhamento([]);
    setGiros(0);
    setUltimo(null);
    if (v.prefs.tipo !== "pyraminx") {
      setPlanif(planificar(criarCuboTipo(v.prefs.tipo)));
    }
    etapaVista.current = v.prefs.tipo === "3x3" ? 7 : null;
    if (aoVivoLigado.current) olharEtapaRef.current();
    if (relogioRef.current) relogioRef.current.textContent = "0.00";
    mudarFase("livre");
  }, [mudarFase]);

  const trocarTipo = (tipo: TipoCubo) => {
    if (tipo === prefs.tipo) return;
    const info = infoTipoCubo(tipo);
    const n = Math.max(...info.dims);
    const novo: Prefs = { ...prefs, tipo, n };
    setPrefs(novo);
    vivo.current.prefs = novo;
    cenaRef.current?.setTipo(tipo);
    recomecar();
  };

  const trocarModo = (modo: Modo) => {
    if (modo === prefs.modo) return;
    setPrefs((p) => ({ ...p, modo }));
    vivo.current.prefs = { ...vivo.current.prefs, modo };
    recomecar();
    if (modo === "real") embaralhar();
  };

  /* ---------- cronômetro do cubo de verdade (segurar e soltar) ---------- */

  const seguraDesde = useRef(0);
  const liberarTimer = useRef<number | undefined>(undefined);

  const apertarReal = useCallback(() => {
    const v = vivo.current;
    if (v.prefs.modo !== "real") return;
    if (v.fase === "valendo") {
      const ms = performance.now() - v.inicio;
      mudarFase("resolvido");
      registrarRef.current(ms, 0);
      return;
    }
    if (v.fase !== "pronto" && v.fase !== "resolvido" && v.fase !== "livre") return;
    seguraDesde.current = performance.now();
    mudarFase("segurando");
    window.clearTimeout(liberarTimer.current);
    liberarTimer.current = window.setTimeout(() => {
      if (vivo.current.fase === "segurando") mudarFase("liberado");
    }, SEGURAR_MS);
  }, [mudarFase]);

  const soltarReal = useCallback(() => {
    const v = vivo.current;
    window.clearTimeout(liberarTimer.current);
    if (v.fase === "liberado") {
      v.inicio = performance.now();
      setUltimo(null);
      mudarFase("valendo");
    } else if (v.fase === "segurando") mudarFase(v.embaralhamento.length ? "pronto" : "livre");
  }, [mudarFase]);

  // depois de um tempo no cubo de verdade, já deixa o próximo embaralhamento pronto
  useEffect(() => {
    if (prefs.modo !== "real" || fase !== "resolvido") return;
    const t = window.setTimeout(() => {
      if (vivo.current.fase === "resolvido") embaralhar();
    }, 1600);
    return () => window.clearTimeout(t);
  }, [fase, prefs.modo, embaralhar]);

  /* ---------- teclado ---------- */

  useEffect(() => {
    const faces: Record<string, Face> = { u: "U", d: "D", l: "L", r: "R", f: "F", b: "B" };
    const digitando = (alvo: EventTarget | null) =>
      alvo instanceof HTMLElement && (alvo.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName));
    const baixo = (e: KeyboardEvent) => {
      if (digitando(e.target) || e.metaKey) return;
      const cena = cenaRef.current;
      const v = vivo.current;
      if (!cena) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (e.repeat) return;
        if (v.prefs.modo === "real") apertarReal();
        else if (v.fase !== "embaralhando" && v.fase !== "volta") embaralhar();
        return;
      }
      if (v.prefs.modo === "real" && v.fase === "valendo") {
        apertarReal();
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        desfazer();
        return;
      }
      if (e.ctrlKey || e.altKey && !faces[e.key.toLowerCase()]) return;
      const setas: Record<string, ["x" | "y", number]> = { ArrowLeft: ["y", -1], ArrowRight: ["y", 1], ArrowUp: ["x", -1], ArrowDown: ["x", 1] };
      if (setas[e.key]) {
        e.preventDefault();
        cena.virar(setas[e.key][0], setas[e.key][1]);
        return;
      }
      const tecla = e.key.toLowerCase();
      if (tecla === "x" || tecla === "y" || tecla === "z") {
        cena.virar(tecla, e.shiftKey ? -1 : 1);
        return;
      }
      const face = faces[tecla];
      if (!face || cena.travado || v.prefs.modo === "real") return;
      e.preventDefault();
      cena.girar(cena.giroVisual(face, e.shiftKey ? -1 : 1, e.altKey), "usuario");
    };
    const cima = (e: KeyboardEvent) => {
      if (e.code === "Space" && vivo.current.prefs.modo === "real") soltarReal();
    };
    window.addEventListener("keydown", baixo);
    window.addEventListener("keyup", cima);
    return () => {
      window.removeEventListener("keydown", baixo);
      window.removeEventListener("keyup", cima);
    };
  }, [apertarReal, soltarReal, embaralhar, desfazer]);

  /* ---------- tempos ---------- */

  const marcar = (id: string, campo: "mais2" | "dnf") =>
    setSolves((lista) => lista.map((s) => (s.id === id ? { ...s, [campo]: !s[campo] } : s)));
  const apagar = (id: string) => setSolves((lista) => lista.filter((s) => s.id !== id));
  const limparTudo = () => {
    if (!window.confirm(`Apagar todos os tempos do ${infoAtivo.nome} (${prefs.modo === "real" ? "cubo de verdade" : "no site"})? Não dá para desfazer.`)) return;
    setSolves((lista) => lista.filter((s) => !(tipoDoSolve(s) === prefs.tipo && s.modo === prefs.modo)));
  };

  const irParaAula = () => {
    document.getElementById("aula-da-mine")?.scrollIntoView({ behavior: reduzido ? "auto" : "smooth", block: "start" });
  };

  /* ---------- tela ---------- */

  const correndo = fase === "valendo" || fase === "inspecao";
  const ocupada = fase === "embaralhando" || fase === "volta";
  const textoEmbaralhamento = embaralhamento.length
    ? prefs.tipo === "pyraminx"
      ? textoDosGirosPyraminx(embaralhamento as GiroPyraminx[])
      : textoDosGirosTipo(embaralhamento as Giro[], prefs.tipo)
    : "";
  const recentes = doTamanho.slice(-12).reverse();
  const legenda =
    prefs.modo === "real"
      ? {
          livre: "Embaralhe para começar.",
          pronto: "Segure espaço (ou o relógio) e solte para começar.",
          segurando: "Segure mais um pouco…",
          liberado: "Pode soltar!",
          valendo: "Aperte qualquer tecla (ou toque) para parar.",
          resolvido: "Próximo embaralhamento já vem.",
          embaralhando: "Embaralhando…",
          inspecao: "",
          volta: "",
          treino: "",
        }[fase]
      : {
          livre: "Gire à vontade ou embaralhe para valer tempo.",
          embaralhando: "Embaralhando…",
          inspecao: "Inspeção: o tempo começa no primeiro giro.",
          pronto: "O tempo começa no primeiro giro.",
          valendo: "Valendo!",
          resolvido: "Montado!",
          volta: "Mostrando o caminho de volta…",
          segurando: "",
          liberado: "",
          treino: "Sua vez: faça o algoritmo do passo e o cubo volta inteiro.",
        }[fase];

  return (
    <div
      className="cubo-page"
      style={
        {
          "--active-a": infoAtivo.corA,
          "--active-b": infoAtivo.corB,
        } as React.CSSProperties
      }
    >
      <PageHeader
        eyebrow="Desafio de lógica · 9 cubos 3D"
        title="Cubo Mágico"
        subtitle="Arraste uma peça para girar a camada, arraste o fundo para virar o cubo."
        action={
          <div className="cubo-badge-ativo" aria-live="polite">
            <span className="cubo-badge-icone" style={{ color: infoAtivo.corA }}>
              <IconeCubo tipo={infoAtivo.id} corA={infoAtivo.corA} corB={infoAtivo.corB} className="h-5 w-5" />
            </span>
            <span className="cubo-badge-texto">
              <strong>{infoAtivo.nome}</strong>
              <small>{infoAtivo.pecas} peças</small>
            </span>
          </div>
        }
      />

      <CuboSeletor ativo={prefs.tipo} desabilitado={correndo || ocupada} onSelecionar={trocarTipo} />

      <div className="cubo-grade">
        <motion.section
          ref={palcoCardRef}
          className="cubo-palco-card"
          aria-label={`${infoAtivo.nome} 3D`}
          initial={reduzido ? false : { opacity: 0, y: 14, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={mola}
        >
          <CuboBorderBeam size={150} duration={8} colorFrom={infoAtivo.corA} colorTo={infoAtivo.corB} borderWidth={1.5} radius="1.25rem" />
          <div className="cubo-palco-topo">
            <div className="cubo-seg cubo-seg-modo" role="radiogroup" aria-label="Modo">
              {([["tela", "No site", Box], ["real", "Cubo de verdade", Hand]] as const).map(([id, rotulo, Icone]) => (
                <button key={id} type="button" role="radio" aria-checked={prefs.modo === id} className="cubo-seg-item" disabled={correndo || ocupada} onClick={() => trocarModo(id)}>
                  {prefs.modo === id ? <motion.span layoutId="cubo-modo" className="cubo-seg-grifo" transition={mola} /> : null}
                  <span className="relative inline-flex items-center gap-1.5"><Icone className="h-4 w-4" aria-hidden />{rotulo}</span>
                </button>
              ))}
            </div>
            <span className="cubo-legenda" aria-live="polite">{legenda}</span>
          </div>

          <div className="cubo-palco-stage">
            <div className="relative">
              <div ref={palcoRef} className={`cubo-palco ${prefs.modo === "real" ? "is-real" : ""}`} />
              <AnimatePresence mode="wait">
                <motion.div
                  key={infoAtivo.id}
                  className="cubo-hud-info"
                  initial={reduzido ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduzido ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={mola}
                >
                  <span className="cubo-hud-dot" style={{ background: infoAtivo.corA }} aria-hidden />
                  <span className="cubo-hud-nome">{infoAtivo.nome}</span>
                  <span className="cubo-hud-sep" aria-hidden>·</span>
                  <span className="cubo-hud-desc">{infoAtivo.descricao}</span>
                </motion.div>
              </AnimatePresence>
              <button
                type="button"
                className="cubo-vista-btn"
                onClick={() => cenaRef.current?.vistaPadrao(false)}
                title="Centralizar ângulo do cubo"
              >
                <Compass className="h-3.5 w-3.5" aria-hidden /> Centralizar
              </button>
            </div>
            <AnimatePresence>
              {aulaViva || aoVivo ? (
                <motion.div
                  className="cubo-faixa-aula"
                  initial={reduzido ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  transition={mola}
                >
                  <div className="cubo-faixa-topo">
                    <span className="cubo-faixa-selo"><span className="cubo-faixa-ponto" aria-hidden /> Mine ao vivo</span>
                    <span className="min-w-0 truncate">
                      {aulaViva ? (
                        <>
                          {aulaViva.tipo === "demo" ? "mostrando" : "treino"} · <strong>{aulaViva.passo.titulo}</strong>
                        </>
                      ) : (
                        "acompanhando sua montagem"
                      )}
                    </span>
                    <button type="button" className="cubo-link ml-auto shrink-0" onClick={sairDaAula} disabled={fase === "volta"}>
                      {aulaViva ? "sair do treino" : "desligar"}
                    </button>
                  </div>
                  <div className={`cubo-faixa-fala is-${fala?.humor ?? "fala"}`}>
                    <span className="cubo-faixa-mine" aria-hidden><Bot className="h-5 w-5" /></span>
                    <div className="cubo-faixa-balao" aria-live="polite">
                      {ultimaPergunta ? <p className="cubo-faixa-voce">Você: {ultimaPergunta}</p> : null}
                      {pensando ? (
                        <p className="cubo-faixa-pensando" aria-label="A Mine está pensando">
                          <span /><span /><span />
                        </p>
                      ) : fala ? (
                        <motion.p key={fala.n} initial={reduzido ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={mola}>
                          {fala.texto}
                        </motion.p>
                      ) : (
                        <p>Tô olhando o cubo…</p>
                      )}
                    </div>
                  </div>
                  {aulaViva?.tipo === "treino" && ficha >= 0 && ficha < aulaViva.passo.algoritmo.length ? (
                    <p className="cubo-faixa-proximo">
                      <span>Próximo giro</span> {instrucao(aulaViva.passo.algoritmo[ficha])}
                    </p>
                  ) : null}
                  {!aulaViva && etapaInfo ? (
                    <p className="cubo-faixa-proximo">
                      <span>Etapa agora</span>
                      {etapaInfo.indice >= 7
                        ? "cubo montado!"
                        : `${etapaInfo.nome}: ${etapaInfo.feitas} de ${etapaInfo.total} peças certas. As peças brilhando em lilás ainda não estão no lugar.`}
                    </p>
                  ) : null}
                  {aulaViva ? <FichasAlgoritmo algoritmo={aulaViva.passo.algoritmo} ativo={ficha} compacto /> : null}
                  <form className="cubo-faixa-pergunta" onSubmit={enviarPergunta}>
                    <input
                      value={pergunta}
                      onChange={(e) => setPergunta(e.target.value)}
                      placeholder="Pergunte à Mine: por que esse giro? como faço a cruz?"
                      aria-label="Pergunta para a Mine"
                      maxLength={300}
                    />
                    <button type="submit" className="cubo-btn is-primario" disabled={!pergunta.trim()}>Perguntar</button>
                  </form>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {prefs.modo === "real" && embaralhamento.length && prefs.tipo !== "pyraminx" && prefs.tipo !== "mirror" ? (
            <div className="cubo-planif-wrap">
              <Planificado planif={planif} />
            </div>
          ) : null}

          <div className="cubo-acoes">
            <CuboShimmerButton onClick={embaralhar} disabled={ocupada || correndo}>
              <Shuffle className="h-4 w-4" aria-hidden /> Embaralhar
            </CuboShimmerButton>
            {prefs.modo === "tela" ? (
              <>
                <motion.button type="button" className="cubo-btn" onClick={desfazer} disabled={ocupada} whileHover={reduzido ? undefined : { y: -2 }} whileTap={reduzido ? undefined : { scale: 0.96 }} transition={mola}>
                  <Undo2 className="h-4 w-4" aria-hidden /> Desfazer
                </motion.button>
                <motion.button type="button" className="cubo-btn" onClick={resolverSozinho} disabled={ocupada} title="Refaz o caminho de volta, giro por giro (não vale tempo)" whileHover={reduzido ? undefined : { y: -2 }} whileTap={reduzido ? undefined : { scale: 0.96 }} transition={mola}>
                  <Wand2 className="h-4 w-4" aria-hidden /> Mostrar a volta
                </motion.button>
              </>
            ) : null}
            {prefs.modo === "tela" && !aoVivo && !aulaViva ? (
              <motion.button type="button" className="cubo-btn is-mine" onClick={() => setAoVivo(true)} whileHover={reduzido ? undefined : { y: -2, scale: 1.02 }} whileTap={reduzido ? undefined : { scale: 0.96 }} transition={mola}>
                <Bot className="h-4 w-4" aria-hidden /> Mine ao vivo
              </motion.button>
            ) : null}
            <motion.button type="button" className="cubo-btn" onClick={recomecar} disabled={ocupada} whileHover={reduzido ? undefined : { y: -2 }} whileTap={reduzido ? undefined : { scale: 0.96 }} transition={mola}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Recomeçar
            </motion.button>
          </div>
        </motion.section>

        <aside className="cubo-lado">
          <section
            className={`cubo-relogio is-${fase}`}
            aria-label="Cronômetro"
            onPointerDown={prefs.modo === "real" ? (e) => { e.preventDefault(); apertarReal(); } : undefined}
            onPointerUp={prefs.modo === "real" ? soltarReal : undefined}
            onPointerCancel={prefs.modo === "real" ? soltarReal : undefined}
          >
            {fase === "valendo" || fase === "liberado" || fase === "inspecao" ? (
              <CuboBorderBeam
                size={110}
                duration={3.5}
                colorFrom={fase === "inspecao" ? "#ffaabd" : "#2fd483"}
                colorTo="#93a3ff"
                borderWidth={2}
                radius="1.1rem"
              />
            ) : null}
            <p className="cubo-relogio-rotulo">
              <Timer className="h-4 w-4" aria-hidden /> {fase === "inspecao" ? "inspeção" : "tempo"}
            </p>
            <span ref={relogioRef} className="cubo-relogio-digitos font-display" aria-live="off">0.00</span>
            <div className="cubo-relogio-rodape">
              {prefs.modo === "tela" ? <span><strong>{giros}</strong> giros</span> : <span>segure e solte</span>}
              <AnimatePresence>
                {ultimo?.recorde ? (
                  <motion.span
                    className="cubo-carimbo"
                    initial={reduzido ? false : { scale: 1.6, opacity: 0, rotate: -18 }}
                    animate={{ scale: 1, opacity: 1, rotate: -8 }}
                    exit={{ opacity: 0 }}
                    transition={mola}
                  >
                    recorde!
                  </motion.span>
                ) : null}
              </AnimatePresence>
              {ultimo && prefs.modo === "tela" && ultimo.giros > 0 ? (
                <span>{(ultimo.giros / (ultimo.ms / 1000)).toFixed(2)} giros/s</span>
              ) : null}
            </div>
            {prefs.modo === "tela" ? (
              <label className="cubo-check">
                <input
                  type="checkbox"
                  checked={prefs.inspecao}
                  disabled={correndo || ocupada}
                  onChange={(e) => setPrefs((p) => ({ ...p, inspecao: e.target.checked }))}
                />
                15 s de inspeção antes de valer
              </label>
            ) : null}
          </section>

          {textoEmbaralhamento ? (
            <section className="cubo-card">
              <h2 className="cubo-card-titulo">Embaralhamento</h2>
              <p className="cubo-embaralhamento">{textoEmbaralhamento}</p>
            </section>
          ) : null}

          <section className="cubo-card">
            <h2 className="cubo-card-titulo">
              Seus números · {infoAtivo.nome} {prefs.modo === "real" ? "de verdade" : "no site"}
            </h2>
            <dl className="cubo-stats">
              <div className="is-destaque"><dt>melhor</dt><dd>{mostrar(resumo.melhor)}</dd></div>
              <div><dt>média de 5</dt><dd>{mostrar(resumo.ao5)}</dd></div>
              <div><dt>média de 12</dt><dd>{mostrar(resumo.ao12)}</dd></div>
              <div><dt>montagens</dt><dd>{resumo.total}</dd></div>
            </dl>
            {recentes.length ? (
              <ol className="cubo-lista">
                {recentes.map((s, i) => (
                  <li key={s.id} className={s.dnf ? "is-dnf" : ""}>
                    <span className="cubo-lista-n">{doTamanho.length - i}</span>
                    <span className="cubo-lista-t" title={s.embaralhamento}>
                      {s.dnf ? "DNF" : formatarTempo(tempoDe(s))}
                      {s.mais2 && !s.dnf ? <small>+2</small> : null}
                    </span>
                    {s.giros ? <span className="cubo-lista-g">{s.giros} giros</span> : <span className="cubo-lista-g" />}
                    <span className="cubo-lista-acoes">
                      <button type="button" aria-pressed={!!s.mais2} onClick={() => marcar(s.id, "mais2")} title="Somar 2 s de penalidade">+2</button>
                      <button type="button" aria-pressed={!!s.dnf} onClick={() => marcar(s.id, "dnf")} title="Não terminou (DNF)">DNF</button>
                      <button type="button" onClick={() => apagar(s.id)} aria-label="Apagar este tempo"><Trash2 className="h-3.5 w-3.5" /></button>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="cubo-vazio">Nenhum tempo ainda. Embaralhe e monte para aparecer aqui.</p>
            )}
            {recentes.length ? (
              <button type="button" className="cubo-link" onClick={limparTudo}>Apagar estes tempos</button>
            ) : null}
          </section>

          <section className="cubo-card">
            <button type="button" className="cubo-ajuda-topo" aria-expanded={ajuda} onClick={() => setAjuda((a) => !a)}>
              <Keyboard className="h-4 w-4" aria-hidden /> Como mexer
              <span className="ml-auto text-xs opacity-60">{ajuda ? "esconder" : "mostrar"}</span>
            </button>
            <AnimatePresence initial={false}>
              {ajuda ? (
                <motion.div
                  key="ajuda"
                  initial={reduzido ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={mola}
                  className="overflow-hidden"
                >
                  <ul className="cubo-teclas">
                    <li><kbd>U</kbd><kbd>D</kbd><kbd>L</kbd><kbd>R</kbd><kbd>F</kbd><kbd>B</kbd> giram a face de cima, baixo, esquerda, direita, frente e trás (como você está vendo).</li>
                    <li><kbd>Shift</kbd> + letra gira ao contrário. <kbd>Alt</kbd> + letra gira camada interna (4×4, 5×5) ou pontas (Pyraminx).</li>
                    <li><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> ou <kbd>X</kbd><kbd>Y</kbd><kbd>Z</kbd> viram o quebra-cabeça inteiro.</li>
                    <li><kbd>Espaço</kbd> embaralha (no cubo de verdade: segure e solte). <kbd>Ctrl</kbd>+<kbd>Z</kbd> desfaz.</li>
                  </ul>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <button type="button" className="cubo-btn mt-3 w-full justify-center" onClick={irParaAula}>
              <Bot className="h-4 w-4" aria-hidden /> Aula da Mine: aprender a montar
            </button>
          </section>
        </aside>
      </div>

      <AulaDaMine
        atual={passoAtual}
        setAtual={setPassoAtual}
        ficha={ficha}
        aprendidos={aprendidos}
        ocupado={ocupada || correndo}
        emAula={aulaViva && aulaViva.passo.id === passosAula[passoAtual].id ? aulaViva.tipo : null}
        eh3x3={prefs.tipo === "3x3"}
        reduzido={reduzido}
        onVer={(p) => comecarAula(p, "demo")}
        onTreinar={(p) => comecarAula(p, "treino")}
        onPerguntar={perguntarPasso}
        onUsar3={() => trocarTipo("3x3")}
      />
    </div>
  );
}

/** Estado em texto curto para a Mine: face e linhas com as iniciais das cores. */
function resumoEstado(estado: Planificacao) {
  return (["U", "F", "R", "B", "L", "D"] as Face[])
    .map((f) => `${f}: ${estado[f].map((linha) => linha.map((c) => corNomes[c]?.[0] ?? "?").join("")).join("/")}`)
    .join("; ");
}

/** Cruz U / L F R B / D com o estado embaralhado (suporta cubos N×N e cuboides). */
function Planificado({ planif }: { planif: Planificacao }) {
  const lado = 10;
  const maxC = Math.max(...(Object.values(planif).map((g) => Math.max(g.length, g[0]?.length ?? 0))));
  const face = maxC * lado + 3;
  const posicoes: Record<Face, [number, number]> = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
  return (
    <svg className="cubo-planif" viewBox={`0 0 ${face * 4} ${face * 3}`} role="img" aria-label="Como o cubo deve ficar depois do embaralhamento (verde na frente, branco em cima)">
      {(Object.keys(posicoes) as Face[]).map((f) => {
        const [cx, cy] = posicoes[f];
        const linhas = planif[f].length;
        const cols = planif[f][0]?.length ?? 0;
        const offX = ((maxC - cols) * lado) / 2;
        const offY = ((maxC - linhas) * lado) / 2;
        return (
          <g key={f} transform={`translate(${cx * face + 1.5 + offX} ${cy * face + 1.5 + offY})`}>
            {planif[f].map((linha, i) =>
              linha.map((cor, j) =>
                cor < 0 ? null : (
                  <rect key={`${i}-${j}`} x={j * lado + 0.5} y={i * lado + 0.5} width={lado - 1} height={lado - 1} rx={1.6} fill={coresHex[cor] ?? "#888"} />
                ),
              ),
            )}
          </g>
        );
      })}
    </svg>
  );
}
