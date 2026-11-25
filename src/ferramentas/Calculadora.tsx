import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Delete, History, Trash2 } from "lucide-react";
import { compile, evaluate, solveEquation, tidyNumber, variablesOf } from "../../shared/calc.mjs";

/**
 * Calculadora científica da aba Ferramentas.
 *
 * As contas passam pelo mesmo interpretador da Mine (shared/calc.mjs, sem
 * eval), então "2x", "√9", "5!" e "sen(30)" funcionam igual aqui e no chat.
 * O que o aluno digita decide o modo:
 *  - conta sem letra      → resultado
 *  - tem "x" e um "="     → raízes da equação
 *  - tem "x" e não tem "=" → gráfico de y = f(x)
 */

type Registro = { expr: string; resultado: string; quando: number };

const LIMITE_HISTORICO = 20;
const chaveHistorico = (userId: string) => `minerva:calc-historico:${userId}`;

function lerHistorico(userId: string): Registro[] {
  try {
    const bruto = JSON.parse(localStorage.getItem(chaveHistorico(userId)) || "[]");
    return Array.isArray(bruto) ? bruto.slice(0, LIMITE_HISTORICO) : [];
  } catch {
    return [];
  }
}

/**
 * Em graus, sen/cos/tg viram as versões em graus do interpretador e as
 * inversas devolvem graus. A troca só pega o nome da função seguido de "(".
 */
function paraGraus(expr: string) {
  return expr
    .replace(/\b(sen|sin)\s*\(/g, "sind(")
    .replace(/\bcos\s*\(/g, "cosd(")
    .replace(/\b(tg|tan)\s*\(/g, "tand(")
    .replace(/\b(arcsen|asin|arccos|acos|arctg|atan)\s*\(/g, (_m, nome: string) => `(180/pi)*${nome}(`);
}

type Teclas = Array<{ rotulo: string; insere?: string; acao?: "limpar" | "apagar" | "igual"; tipo?: "num" | "op" | "fn" | "igual" | "limpar"; titulo?: string }>;

const TECLAS: Teclas = [
  { rotulo: "sen", insere: "sen(", tipo: "fn", titulo: "Seno" },
  { rotulo: "cos", insere: "cos(", tipo: "fn", titulo: "Cosseno" },
  { rotulo: "tg", insere: "tg(", tipo: "fn", titulo: "Tangente" },
  { rotulo: "C", acao: "limpar", tipo: "limpar", titulo: "Limpar" },
  { rotulo: "⌫", acao: "apagar", tipo: "limpar", titulo: "Apagar o último" },

  { rotulo: "√", insere: "√(", tipo: "fn", titulo: "Raiz quadrada" },
  { rotulo: "xʸ", insere: "^", tipo: "fn", titulo: "Potência" },
  { rotulo: "x²", insere: "^2", tipo: "fn", titulo: "Ao quadrado" },
  { rotulo: "(", insere: "(", tipo: "op" },
  { rotulo: ")", insere: ")", tipo: "op" },

  { rotulo: "log", insere: "log(", tipo: "fn", titulo: "Logaritmo na base 10" },
  { rotulo: "7", insere: "7", tipo: "num" },
  { rotulo: "8", insere: "8", tipo: "num" },
  { rotulo: "9", insere: "9", tipo: "num" },
  { rotulo: "÷", insere: "÷", tipo: "op", titulo: "Dividir" },

  { rotulo: "ln", insere: "ln(", tipo: "fn", titulo: "Logaritmo natural" },
  { rotulo: "4", insere: "4", tipo: "num" },
  { rotulo: "5", insere: "5", tipo: "num" },
  { rotulo: "6", insere: "6", tipo: "num" },
  { rotulo: "×", insere: "×", tipo: "op", titulo: "Multiplicar" },

  { rotulo: "π", insere: "π", tipo: "fn", titulo: "Pi" },
  { rotulo: "1", insere: "1", tipo: "num" },
  { rotulo: "2", insere: "2", tipo: "num" },
  { rotulo: "3", insere: "3", tipo: "num" },
  { rotulo: "−", insere: "-", tipo: "op", titulo: "Subtrair" },

  { rotulo: "n!", insere: "!", tipo: "fn", titulo: "Fatorial" },
  { rotulo: "0", insere: "0", tipo: "num" },
  { rotulo: ",", insere: ".", tipo: "num", titulo: "Vírgula" },
  { rotulo: "=", acao: "igual", tipo: "igual", titulo: "Calcular" },
  { rotulo: "+", insere: "+", tipo: "op", titulo: "Somar" },

  { rotulo: "x", insere: "x", tipo: "fn", titulo: "Variável x (equação ou gráfico)" },
  { rotulo: "= ", insere: "=", tipo: "fn", titulo: "Sinal de igual da equação" },
  { rotulo: "%", insere: "%", tipo: "fn", titulo: "Porcentagem" },
  { rotulo: "e", insere: "e", tipo: "fn", titulo: "Número de Euler" },
  { rotulo: "ans", insere: "ans", tipo: "fn", titulo: "Último resultado" },
];

type Saida =
  | { tipo: "vazio" }
  | { tipo: "erro"; texto: string }
  | { tipo: "numero"; texto: string; valor: number }
  | { tipo: "equacao"; raizes: number[] }
  | { tipo: "grafico"; fn: (x: number) => number };

function analisar(expr: string, graus: boolean, ans: number): Saida {
  const limpa = expr.trim();
  if (!limpa) return { tipo: "vazio" };
  try {
    const fonte = graus ? paraGraus(limpa) : limpa;
    if (fonte.includes("=")) {
      const raizes = solveEquation(fonte, "x", { min: -1000, max: 1000, steps: 40000 });
      return { tipo: "equacao", raizes };
    }
    const vars = variablesOf(fonte).filter((nome) => nome !== "ans");
    if (vars.length === 1 && vars[0] === "x") {
      const f = compile(fonte);
      return { tipo: "grafico", fn: (x: number) => f({ x, ans }) };
    }
    if (vars.length) return { tipo: "erro", texto: `Não conheço "${vars[0]}". Use x para equação ou gráfico.` };
    const valor = evaluate(fonte, { ans });
    return { tipo: "numero", texto: tidyNumber(valor).replace(".", ","), valor };
  } catch (erro) {
    return { tipo: "erro", texto: (erro as Error).message || "Conta incompleta." };
  }
}

export function Calculadora({ userId, askMine }: { userId: string; askMine: (text: string) => void }) {
  const [expr, setExpr] = useState("");
  const [graus, setGraus] = useState(true);
  const [ans, setAns] = useState(0);
  const [historico, setHistorico] = useState<Registro[]>(() => lerHistorico(userId));
  const [confirmada, setConfirmada] = useState<Saida | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(chaveHistorico(userId), JSON.stringify(historico));
    } catch {
      // Sem armazenamento local o histórico vale só enquanto a aba está aberta.
    }
  }, [historico, userId]);

  // Prévia ao vivo enquanto digita; o "=" fixa o resultado e guarda no histórico.
  const previa = useMemo(() => analisar(expr, graus, ans), [expr, graus, ans]);
  const saida = confirmada ?? previa;

  function inserir(texto: string) {
    const input = campo.current;
    setConfirmada(null);
    if (!input) {
      setExpr((antes) => antes + texto);
      return;
    }
    const inicio = input.selectionStart ?? expr.length;
    const fim = input.selectionEnd ?? expr.length;
    const novo = expr.slice(0, inicio) + texto + expr.slice(fim);
    setExpr(novo);
    requestAnimationFrame(() => {
      input.focus();
      const pos = inicio + texto.length;
      input.setSelectionRange(pos, pos);
    });
  }

  function calcular() {
    const resultado = analisar(expr, graus, ans);
    setConfirmada(resultado);
    if (resultado.tipo === "numero") {
      setAns(resultado.valor);
      setHistorico((antes) => [{ expr: expr.trim(), resultado: resultado.texto, quando: Date.now() }, ...antes.filter((r) => r.expr !== expr.trim())].slice(0, LIMITE_HISTORICO));
    } else if (resultado.tipo === "equacao") {
      const texto = resultado.raizes.length ? resultado.raizes.map((r) => `x = ${tidyNumber(r).replace(".", ",")}`).join("; ") : "sem raiz real";
      setHistorico((antes) => [{ expr: expr.trim(), resultado: texto, quando: Date.now() }, ...antes.filter((r) => r.expr !== expr.trim())].slice(0, LIMITE_HISTORICO));
    }
  }

  function tecla(t: Teclas[number]) {
    if (t.acao === "limpar") {
      setExpr("");
      setConfirmada(null);
      campo.current?.focus();
    } else if (t.acao === "apagar") {
      setConfirmada(null);
      setExpr((antes) => antes.slice(0, -1));
      campo.current?.focus();
    } else if (t.acao === "igual") {
      calcular();
    } else if (t.insere) {
      inserir(t.insere);
    }
  }

  const pedirMine = () => {
    const conta = expr.trim();
    if (!conta) return;
    askMine(`Me explica passo a passo como resolver: ${conta}${graus ? " (ângulos em graus)" : ""}`);
  };

  return (
    <div className="calc">
      <div className="calc-corpo">
        <div className="calc-visor">
          <div className="calc-visor-topo">
            <div className="calc-modo" role="group" aria-label="Unidade dos ângulos">
              <button type="button" aria-pressed={graus} onClick={() => setGraus(true)}>
                Graus
              </button>
              <button type="button" aria-pressed={!graus} onClick={() => setGraus(false)}>
                Radianos
              </button>
            </div>
            <span className="calc-ans" title="Último resultado (tecla ans)">
              ans = {tidyNumber(ans).replace(".", ",")}
            </span>
          </div>
          <input
            ref={campo}
            className="calc-campo"
            value={expr}
            onChange={(event) => {
              setExpr(event.target.value);
              setConfirmada(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                calcular();
              } else if (event.key === "Escape") {
                setExpr("");
                setConfirmada(null);
              }
            }}
            placeholder="Digite uma conta, ex.: 2x + 3 = 11"
            aria-label="Conta"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="calc-resultado" aria-live="polite" data-confirmado={confirmada ? "" : undefined}>
            {saida.tipo === "vazio" ? <span className="calc-dica">O resultado aparece aqui enquanto você digita.</span> : null}
            {saida.tipo === "erro" ? <span className="calc-erro">{expr.trim() && !confirmada ? "…" : saida.texto}</span> : null}
            {saida.tipo === "numero" ? <strong>= {saida.texto}</strong> : null}
            {saida.tipo === "equacao" ? (
              <strong>
                {saida.raizes.length
                  ? saida.raizes.map((r) => `x = ${tidyNumber(r).replace(".", ",")}`).join("   ·   ")
                  : "Nenhuma raiz real entre −1000 e 1000."}
              </strong>
            ) : null}
            {saida.tipo === "grafico" ? <span className="calc-dica">Gráfico de y = {expr.trim()} logo abaixo. Ponha "= algo" para resolver a equação.</span> : null}
          </div>
        </div>

        <div className="calc-teclado">
          {TECLAS.map((t) => (
            <button key={t.rotulo} type="button" className="calc-tecla" data-tipo={t.tipo} title={t.titulo} aria-label={t.titulo || t.rotulo} onClick={() => tecla(t)}>
              {t.acao === "apagar" ? <Delete className="mx-auto h-5 w-5" aria-hidden /> : t.rotulo.trim()}
            </button>
          ))}
        </div>

        <button type="button" className="calc-mine" onClick={pedirMine} disabled={!expr.trim()}>
          <Bot className="h-4 w-4" aria-hidden /> Perguntar à Mine o passo a passo
        </button>
      </div>

      <aside className="calc-lado">
        {saida.tipo === "grafico" ? <Grafico fn={saida.fn} rotulo={expr.trim()} /> : <Exemplos onUsar={(e) => { setExpr(e); setConfirmada(null); campo.current?.focus(); }} />}
        <div className="calc-historico">
          <div className="calc-historico-topo">
            <h3>
              <History className="h-4 w-4" aria-hidden /> Histórico
            </h3>
            {historico.length ? (
              <button type="button" onClick={() => setHistorico([])} title="Apagar histórico">
                <Trash2 className="h-4 w-4" aria-hidden />
                <span className="sr-only">Apagar histórico</span>
              </button>
            ) : null}
          </div>
          {historico.length ? (
            <ul>
              {historico.map((r) => (
                <li key={r.quando}>
                  <button type="button" onClick={() => { setExpr(r.expr); setConfirmada(null); campo.current?.focus(); }} title="Usar de novo">
                    <span>{r.expr}</span>
                    <strong>{r.resultado}</strong>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="calc-dica">As contas que você fizer ficam aqui, só neste aparelho.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

const EXEMPLOS = [
  { conta: "2x + 3 = 11", o: "equação do 1º grau" },
  { conta: "x^2 - 5x + 6 = 0", o: "equação do 2º grau" },
  { conta: "x^2 - 4", o: "gráfico de uma parábola" },
  { conta: "sen(30) + cos(60)", o: "trigonometria em graus" },
  { conta: "√(144) + 3^4", o: "raiz e potência" },
  { conta: "15% * 240", o: "porcentagem" },
];

function Exemplos({ onUsar }: { onUsar: (expr: string) => void }) {
  return (
    <div className="calc-exemplos">
      <h3>Experimente</h3>
      <ul>
        {EXEMPLOS.map((e) => (
          <li key={e.conta}>
            <button type="button" onClick={() => onUsar(e.conta)}>
              <code>{e.conta}</code>
              <small>{e.o}</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const W = 360;
const H = 260;

/** Gráfico de y = f(x) em SVG, com zoom pelos botões e leitura do ponto sob o dedo. */
function Grafico({ fn, rotulo }: { fn: (x: number) => number; rotulo: string }) {
  const [alcance, setAlcance] = useState(10);
  const [ponto, setPonto] = useState<{ x: number; y: number } | null>(null);
  const x0 = -alcance;
  const x1 = alcance;

  const { caminho, y0, y1 } = useMemo(() => {
    const amostras: Array<[number, number]> = [];
    const n = 400;
    for (let i = 0; i <= n; i += 1) {
      const x = x0 + ((x1 - x0) * i) / n;
      let y = NaN;
      try {
        y = fn(x);
      } catch {
        y = NaN;
      }
      amostras.push([x, y]);
    }
    const finitos = amostras.map(([, y]) => y).filter((y) => Number.isFinite(y)).sort((a, b) => a - b);
    // Corta os 2% das pontas para uma assíntota (1/x, tg) não achatar o resto.
    let lo = finitos.length ? finitos[Math.floor(finitos.length * 0.02)] : -alcance;
    let hi = finitos.length ? finitos[Math.ceil(finitos.length * 0.98) - 1] : alcance;
    if (!(hi > lo)) {
      lo -= 1;
      hi += 1;
    }
    const folga = (hi - lo) * 0.1;
    lo -= folga;
    hi += folga;
    const px = (x: number) => ((x - x0) / (x1 - x0)) * W;
    const py = (y: number) => H - ((y - lo) / (hi - lo)) * H;
    let d = "";
    let levantada = true;
    for (const [x, y] of amostras) {
      if (!Number.isFinite(y) || y < lo - (hi - lo) * 2 || y > hi + (hi - lo) * 2) {
        levantada = true;
        continue;
      }
      d += `${levantada ? "M" : "L"}${px(x).toFixed(1)},${py(y).toFixed(1)}`;
      levantada = false;
    }
    return { caminho: d, y0: lo, y1: hi };
  }, [fn, x0, x1, alcance]);

  const px = (x: number) => ((x - x0) / (x1 - x0)) * W;
  const py = (y: number) => H - ((y - y0) / (y1 - y0)) * H;
  const eixoX = y0 <= 0 && y1 >= 0 ? py(0) : null;
  const eixoY = px(0);

  return (
    <figure className="calc-grafico">
      <figcaption>
        y = {rotulo}
        <span className="calc-zoom">
          <button type="button" onClick={() => setAlcance((a) => Math.max(1, a / 2))} aria-label="Aproximar">+</button>
          <button type="button" onClick={() => setAlcance((a) => Math.min(1000, a * 2))} aria-label="Afastar">−</button>
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Gráfico de y = ${rotulo} com x de ${x0} a ${x1}`}
        onPointerMove={(event) => {
          const caixa = event.currentTarget.getBoundingClientRect();
          const x = x0 + ((event.clientX - caixa.left) / caixa.width) * (x1 - x0);
          let y = NaN;
          try {
            y = fn(x);
          } catch {
            y = NaN;
          }
          setPonto(Number.isFinite(y) ? { x, y } : null);
        }}
        onPointerLeave={() => setPonto(null)}
      >
        {eixoX !== null ? <line x1={0} x2={W} y1={eixoX} y2={eixoX} className="calc-eixo" /> : null}
        <line x1={eixoY} x2={eixoY} y1={0} y2={H} className="calc-eixo" />
        <path d={caminho} className="calc-curva" />
        {ponto ? <circle cx={px(ponto.x)} cy={py(ponto.y)} r={5} className="calc-ponto" /> : null}
      </svg>
      <p className="calc-leitura">
        {ponto ? `x = ${tidyNumber(ponto.x).replace(".", ",")}  →  y = ${tidyNumber(ponto.y).replace(".", ",")}` : `x de ${x0} a ${x1}. Passe o dedo ou o mouse na curva.`}
      </p>
    </figure>
  );
}
