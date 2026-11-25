import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Eye, Headphones, Pause, Play, RotateCcw, SkipForward, Square } from "lucide-react";
import { MineInline } from "../MineRichText";
import { compile, tidyNumber } from "../../../shared/calc.mjs";
import { BlocoAcoesContext } from "./Blocos";
import { falarComoMine, pararDeFalar, podeFalar, prepararFala } from "../vozMine";
import "./novos.css";

/*
 * Blocos novos do chat da Mine (25/nov/2026), da pesquisa "Mine contra as
 * grandes IAs": laboratório para mexer, passo a passo que se revela, página
 * tipo revista, dois jeitos de explicar, correção em cima da foto, podcast e
 * vídeo-resumo narrado. Formatos em mine/prompts.mjs (buildToolsInstruction).
 * JSON que não serve volta a ser código comum.
 */

export const NOVOS_LANGS = new Set(["simulacao", "simulação", "laboratorio", "passos", "roteiro", "dois-jeitos", "correcao", "correção", "podcast", "slides"]);

/** Foto que o estudante mandou junto da pergunta, para o bloco de correção. */
export const AnexoDaPerguntaContext = createContext<string | undefined>(undefined);

const str = (value: unknown, max = 600) => (typeof value === "string" ? value.trim().slice(0, max) : typeof value === "number" ? String(value) : "");
const num = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : value !== "" && value !== null && Number.isFinite(Number(value)) ? Number(value) : fallback);

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

function hashOf(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(36);
}

function lerLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function gravarLocal(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sem armazenamento (aba anônima): o bloco funciona, só não lembra.
  }
}

// ── Laboratório ─────────────────────────────────────────────────────────────

type Param = { nome: string; rotulo: string; unidade: string; min: number; max: number; valor: number; passo: number };
type Leitura = { rotulo: string; expressao: string; unidade: string };
type Lab = {
  titulo: string;
  expressao: string;
  x: { nome: string; unidade: string; min: number; max: number; valor: number };
  y: { nome: string; unidade: string };
  parametros: Param[];
  leituras: Leitura[];
  nota: string;
};

const P = (nome: string, rotulo: string, unidade: string, min: number, max: number, valor: number, passo: number): Param => ({ nome, rotulo, unidade, min, max, valor, passo });

/** Experimentos prontos: a Mine só escolhe o nome e o assunto já vem certo. */
const MODELOS: Record<string, Omit<Lab, "titulo"> & { titulo: string }> = {
  charles: {
    titulo: "Lei de Charles: volume × temperatura",
    expressao: "V0 * x / T0",
    x: { nome: "Temperatura", unidade: "K", min: 100, max: 600, valor: 300 },
    y: { nome: "Volume", unidade: "L" },
    parametros: [P("V0", "Volume inicial", "L", 1, 10, 2, 0.5), P("T0", "Temperatura inicial", "K", 200, 400, 273, 1)],
    leituras: [{ rotulo: "Volume agora", expressao: "V0 * x / T0", unidade: "L" }, { rotulo: "Em °C", expressao: "x - 273", unidade: "°C" }],
    nota: "Com a pressão constante, dobrar a temperatura (em kelvin) dobra o volume.",
  },
  boyle: {
    titulo: "Lei de Boyle: pressão × volume",
    expressao: "k / x",
    x: { nome: "Volume", unidade: "L", min: 0.5, max: 10, valor: 2 },
    y: { nome: "Pressão", unidade: "atm" },
    parametros: [P("k", "Constante P·V", "atm·L", 1, 40, 10, 1)],
    leituras: [{ rotulo: "Pressão agora", expressao: "k / x", unidade: "atm" }, { rotulo: "P × V", expressao: "k", unidade: "atm·L" }],
    nota: "Com a temperatura constante, apertar o gás pela metade dobra a pressão.",
  },
  "juros-compostos": {
    titulo: "Juros compostos",
    expressao: "C * (1 + i/100)^x",
    x: { nome: "Tempo", unidade: "meses", min: 0, max: 60, valor: 12 },
    y: { nome: "Montante", unidade: "R$" },
    parametros: [P("C", "Capital", "R$", 100, 10000, 1000, 100), P("i", "Taxa", "% ao mês", 0.1, 5, 1, 0.1)],
    leituras: [{ rotulo: "Montante", expressao: "C * (1 + i/100)^x", unidade: "R$" }, { rotulo: "Só de juros", expressao: "C * (1 + i/100)^x - C", unidade: "R$" }],
    nota: "Os juros entram no valor e passam a render juros também: a curva sobe cada vez mais rápido.",
  },
  "juros-simples": {
    titulo: "Juros simples",
    expressao: "C * (1 + i/100 * x)",
    x: { nome: "Tempo", unidade: "meses", min: 0, max: 60, valor: 12 },
    y: { nome: "Montante", unidade: "R$" },
    parametros: [P("C", "Capital", "R$", 100, 10000, 1000, 100), P("i", "Taxa", "% ao mês", 0.1, 5, 1, 0.1)],
    leituras: [{ rotulo: "Montante", expressao: "C * (1 + i/100 * x)", unidade: "R$" }, { rotulo: "Só de juros", expressao: "C * i/100 * x", unidade: "R$" }],
    nota: "Os juros são sempre calculados sobre o capital inicial: a linha é reta.",
  },
  "area-circulo": {
    titulo: "Área do círculo",
    expressao: "pi * x^2",
    x: { nome: "Raio", unidade: "cm", min: 0, max: 10, valor: 3 },
    y: { nome: "Área", unidade: "cm²" },
    parametros: [],
    leituras: [{ rotulo: "Área", expressao: "pi * x^2", unidade: "cm²" }, { rotulo: "Comprimento", expressao: "2 * pi * x", unidade: "cm" }],
    nota: "Dobrar o raio quadruplica a área, porque o raio entra ao quadrado.",
  },
  ohm: {
    titulo: "Lei de Ohm: corrente × resistência",
    expressao: "U / x",
    x: { nome: "Resistência", unidade: "Ω", min: 1, max: 100, valor: 10 },
    y: { nome: "Corrente", unidade: "A" },
    parametros: [P("U", "Tensão", "V", 1, 24, 12, 1)],
    leituras: [{ rotulo: "Corrente", expressao: "U / x", unidade: "A" }, { rotulo: "Potência", expressao: "U^2 / x", unidade: "W" }],
    nota: "Com a mesma tensão, mais resistência deixa passar menos corrente.",
  },
  mru: {
    titulo: "Movimento uniforme: posição × tempo",
    expressao: "s0 + v * x",
    x: { nome: "Tempo", unidade: "s", min: 0, max: 20, valor: 5 },
    y: { nome: "Posição", unidade: "m" },
    parametros: [P("s0", "Posição inicial", "m", 0, 100, 10, 1), P("v", "Velocidade", "m/s", -10, 30, 5, 0.5)],
    leituras: [{ rotulo: "Posição", expressao: "s0 + v * x", unidade: "m" }, { rotulo: "Distância percorrida", expressao: "abs(v * x)", unidade: "m" }],
    nota: "Velocidade constante desenha uma reta; a inclinação é a velocidade.",
  },
  "queda-livre": {
    titulo: "Queda livre: altura × tempo",
    expressao: "h0 - g * x^2 / 2",
    x: { nome: "Tempo", unidade: "s", min: 0, max: 6, valor: 2 },
    y: { nome: "Altura", unidade: "m" },
    parametros: [P("h0", "Altura inicial", "m", 10, 200, 80, 5), P("g", "Gravidade", "m/s²", 1.6, 25, 9.8, 0.1)],
    leituras: [{ rotulo: "Altura", expressao: "h0 - g * x^2 / 2", unidade: "m" }, { rotulo: "Velocidade", expressao: "g * x", unidade: "m/s" }],
    nota: "Na Lua (g = 1,6) a mesma queda demora bem mais.",
  },
  densidade: {
    titulo: "Densidade: massa × volume",
    expressao: "d * x",
    x: { nome: "Volume", unidade: "cm³", min: 0, max: 100, valor: 20 },
    y: { nome: "Massa", unidade: "g" },
    parametros: [P("d", "Densidade", "g/cm³", 0.5, 20, 1, 0.1)],
    leituras: [{ rotulo: "Massa", expressao: "d * x", unidade: "g" }],
    nota: "Água tem densidade 1; ferro, 7,9; ouro, 19,3. Mais densidade, reta mais inclinada.",
  },
  pitagoras: {
    titulo: "Teorema de Pitágoras",
    expressao: "sqrt(a^2 + x^2)",
    x: { nome: "Cateto b", unidade: "cm", min: 0, max: 20, valor: 4 },
    y: { nome: "Hipotenusa", unidade: "cm" },
    parametros: [P("a", "Cateto a", "cm", 0, 20, 3, 0.5)],
    leituras: [{ rotulo: "Hipotenusa", expressao: "sqrt(a^2 + x^2)", unidade: "cm" }, { rotulo: "a² + b²", expressao: "a^2 + x^2", unidade: "cm²" }],
    nota: "Com a = 3 e b = 4, a hipotenusa dá exatamente 5.",
  },
  "fotossintese-luz": {
    titulo: "Fotossíntese × intensidade da luz",
    expressao: "Pmax * x / (k + x)",
    x: { nome: "Luz", unidade: "µmol/m²·s", min: 0, max: 1500, valor: 300 },
    y: { nome: "Taxa de fotossíntese", unidade: "unid." },
    parametros: [P("Pmax", "Taxa máxima", "unid.", 5, 50, 30, 1), P("k", "Luz para metade da taxa", "µmol/m²·s", 50, 600, 200, 10)],
    leituras: [{ rotulo: "Taxa", expressao: "Pmax * x / (k + x)", unidade: "unid." }, { rotulo: "% do máximo", expressao: "100 * x / (k + x)", unidade: "%" }],
    nota: "No começo mais luz acelera muito; depois a planta satura e a curva achata (ponto de saturação luminosa).",
  },
  lancamento: {
    titulo: "Lançamento oblíquo: trajetória",
    expressao: "x * tan(ang * pi / 180) - 9.8 * x^2 / (2 * v^2 * cos(ang * pi / 180)^2)",
    x: { nome: "Distância", unidade: "m", min: 0, max: 100, valor: 20 },
    y: { nome: "Altura", unidade: "m" },
    parametros: [P("v", "Velocidade", "m/s", 5, 40, 20, 1), P("ang", "Ângulo", "°", 5, 85, 45, 1)],
    leituras: [{ rotulo: "Alcance", expressao: "v^2 * sin(2 * ang * pi / 180) / 9.8", unidade: "m" }, { rotulo: "Altura máxima", expressao: "(v * sin(ang * pi / 180))^2 / (2 * 9.8)", unidade: "m" }],
    nota: "Sem resistência do ar, 45° é o ângulo que vai mais longe.",
  },
};

function lerLab(data: Record<string, unknown>): Lab | null {
  const nomeModelo = str(data.modelo, 40).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");
  const modelo = MODELOS[nomeModelo];
  if (modelo) return { ...modelo, titulo: str(data.titulo, 120) || modelo.titulo, nota: str(data.nota, 300) || modelo.nota };
  const expressao = str(data.expressao, 200);
  if (!expressao) return null;
  const xRaw = (data.x && typeof data.x === "object" ? data.x : {}) as Record<string, unknown>;
  const yRaw = (data.y && typeof data.y === "object" ? data.y : {}) as Record<string, unknown>;
  let min = num(xRaw.min, 0);
  let max = num(xRaw.max, 10);
  if (max <= min) [min, max] = [0, 10];
  const raw = data.parametros && typeof data.parametros === "object" ? (data.parametros as Record<string, Record<string, unknown>>) : {};
  const parametros = Object.entries(raw)
    .slice(0, 4)
    .map(([nome, p]) => {
      const a = num(p?.min, 0);
      const b = num(p?.max, 10);
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      return P(nome.slice(0, 10), str(p?.rotulo, 40) || nome, str(p?.unidade, 16), lo, hi, Math.min(hi, Math.max(lo, num(p?.valor, (lo + hi) / 2))), Math.abs(num(p?.passo, (hi - lo) / 100)) || 0.1);
    });
  const leituras = (Array.isArray(data.leituras) ? data.leituras : [])
    .map((item) => {
      const l = item as Record<string, unknown>;
      return { rotulo: str(l.rotulo, 40), expressao: str(l.expressao, 200), unidade: str(l.unidade, 16) };
    })
    .filter((l) => l.rotulo && l.expressao)
    .slice(0, 4);
  return {
    titulo: str(data.titulo, 120) || "Laboratório",
    expressao,
    x: { nome: str(xRaw.nome, 30) || "x", unidade: str(xRaw.unidade, 16), min, max, valor: Math.min(max, Math.max(min, num(xRaw.valor, (min + max) / 2))) },
    y: { nome: str(yRaw.nome, 30) || "y", unidade: str(yRaw.unidade, 16) },
    parametros,
    leituras,
    nota: str(data.nota, 300),
  };
}

const LW = 560;
const LH = 300;
const LP = 42;

function passoBonito(span: number) {
  const raw = span / 6;
  const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const n = raw / pow;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * pow;
}

const fmt = (value: number) => (Number.isFinite(value) ? (Math.abs(value) >= 1000 ? value.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })) : "—");

function Laboratorio(lab: Lab) {
  const fn = useMemo(() => compile(lab.expressao), [lab.expressao]);
  const leituras = useMemo(() => lab.leituras.map((l) => ({ ...l, fn: (() => { try { return compile(l.expressao); } catch { return null; } })() })), [lab.leituras]);
  const [valores, setValores] = useState<Record<string, number>>(() => Object.fromEntries(lab.parametros.map((p) => [p.nome, p.valor])));
  const [x, setX] = useState(lab.x.valor);
  const avaliar = (scope: Record<string, number>, xv: number) => {
    try {
      return fn({ ...scope, x: xv });
    } catch {
      return NaN;
    }
  };
  // Escala de y: fica parada enquanto a curva cabe (dá para ver ela subir e
  // descer) e só se ajusta quando a curva sai muito da tela ou fica pequena demais.
  const faixaDe = (scope: Record<string, number>): [number, number] => {
    const ys: number[] = [];
    for (let i = 0; i <= 80; i += 1) ys.push(avaliar(scope, lab.x.min + ((lab.x.max - lab.x.min) * i) / 80));
    const ok = ys.filter(Number.isFinite).sort((a, b) => a - b);
    if (!ok.length) return [0, 10];
    const lo = Math.min(0, ok[Math.floor(ok.length * 0.02)]);
    let hi = Math.max(0, ok[Math.ceil(ok.length * 0.98) - 1]);
    if (hi - lo < 1e-9) hi = lo + 1;
    const pad = (hi - lo) * 0.12;
    return [lo < 0 ? lo - pad : lo, hi + pad];
  };
  const [faixa, setFaixa] = useState<[number, number]>(() => faixaDe(Object.fromEntries(lab.parametros.map((p) => [p.nome, p.valor]))));
  useEffect(() => {
    const [lo, hi] = faixaDe(valores);
    const [a, b] = faixa;
    if (hi > b * 1.05 + 1e-9 || lo < a - 1e-9 || (b - a) > (hi - lo) * 4) setFaixa([lo, hi]);
  }, [valores]); // eslint-disable-line react-hooks/exhaustive-deps
  const [y0, y1] = faixa;
  const sx = (v: number) => LP + ((v - lab.x.min) / (lab.x.max - lab.x.min)) * (LW - LP - 16);
  const sy = (v: number) => LH - 30 - ((v - y0) / (y1 - y0)) * (LH - 30 - 16);
  let d = "";
  let pen = false;
  for (let i = 0; i <= 240; i += 1) {
    const xv = lab.x.min + ((lab.x.max - lab.x.min) * i) / 240;
    const yv = avaliar(valores, xv);
    if (!Number.isFinite(yv) || yv < y0 - (y1 - y0) || yv > y1 + (y1 - y0)) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${sx(xv).toFixed(1)} ${sy(Math.min(y1, Math.max(y0, yv))).toFixed(1)}`;
    pen = true;
  }
  const yAgora = avaliar(valores, x);
  const stepX = passoBonito(lab.x.max - lab.x.min);
  const stepY = passoBonito(y1 - y0);
  const ticksX: number[] = [];
  for (let v = Math.ceil(lab.x.min / stepX) * stepX; v <= lab.x.max + 1e-9; v += stepX) ticksX.push(Number(v.toPrecision(10)));
  const ticksY: number[] = [];
  for (let v = Math.ceil(y0 / stepY) * stepY; v <= y1 + 1e-9; v += stepY) ticksY.push(Number(v.toPrecision(10)));
  const restaurar = () => {
    setValores(Object.fromEntries(lab.parametros.map((p) => [p.nome, p.valor])));
    setX(lab.x.valor);
  };
  const escopo = { ...valores, x, y: yAgora };
  return (
    <section className="mbk mbk-lab" aria-label={`Laboratório: ${lab.titulo}`}>
      <header className="mbk-head">
        <strong>{lab.titulo}</strong>
        <button type="button" className="mbk-link" onClick={restaurar}>
          <RotateCcw aria-hidden /> Recomeçar
        </button>
      </header>
      <svg viewBox={`0 0 ${LW} ${LH}`} className="mbk-lab__svg" role="img" aria-label={`${lab.y.nome} em função de ${lab.x.nome}. Agora: ${fmt(yAgora)} ${lab.y.unidade}`}>
        {ticksY.map((v) => (
          <g key={`y${v}`}>
            <line x1={LP} x2={LW - 16} y1={sy(v)} y2={sy(v)} className="mbk-grid" />
            <text x={LP - 6} y={sy(v) + 4} textAnchor="end" className="mbk-tick">
              {tidyNumber(v)}
            </text>
          </g>
        ))}
        {ticksX.map((v) => (
          <text key={`x${v}`} x={sx(v)} y={LH - 12} textAnchor="middle" className="mbk-tick">
            {tidyNumber(v)}
          </text>
        ))}
        <line x1={LP} x2={LW - 16} y1={sy(Math.max(y0, 0))} y2={sy(Math.max(y0, 0))} className="mbk-eixo" />
        <path d={d} className="mbk-curva" />
        {Number.isFinite(yAgora) && yAgora >= y0 && yAgora <= y1 ? (
          <g>
            <line x1={sx(x)} x2={sx(x)} y1={sy(yAgora)} y2={sy(Math.max(y0, 0))} className="mbk-lab__guia" />
            <circle cx={sx(x)} cy={sy(yAgora)} r={6} className="mbk-ponto" />
          </g>
        ) : null}
      </svg>
      <p className="mbk-lab__eixos">
        <span>↑ {lab.y.nome}{lab.y.unidade ? ` (${lab.y.unidade})` : ""}</span>
        <span>{lab.x.nome}{lab.x.unidade ? ` (${lab.x.unidade})` : ""} →</span>
      </p>
      {leituras.length ? (
        <div className="mbk-lab__leituras" aria-live="polite">
          {leituras.map((l) => {
            let valor = NaN;
            try {
              valor = l.fn ? l.fn(escopo) : NaN;
            } catch {
              valor = NaN;
            }
            return (
              <div key={l.rotulo}>
                <span>{l.rotulo}</span>
                <b>
                  {fmt(valor)} <small>{l.unidade}</small>
                </b>
              </div>
            );
          })}
        </div>
      ) : null}
      <div className="mbk-funcao__controles">
        <label>
          <span>
            <b>{lab.x.nome}</b> = {fmt(x)} {lab.x.unidade}
          </span>
          <input type="range" min={lab.x.min} max={lab.x.max} step={(lab.x.max - lab.x.min) / 200} value={x} onChange={(event) => setX(Number(event.target.value))} />
        </label>
        {lab.parametros.map((p) => (
          <label key={p.nome}>
            <span>
              <b>{p.rotulo}</b> = {fmt(valores[p.nome])} {p.unidade}
            </span>
            <input type="range" min={p.min} max={p.max} step={p.passo} value={valores[p.nome]} onChange={(event) => setValores((atual) => ({ ...atual, [p.nome]: Number(event.target.value) }))} />
          </label>
        ))}
      </div>
      {lab.nota ? (
        <p className="mbk-lab__nota">
          <MineInline text={lab.nota} />
        </p>
      ) : null}
    </section>
  );
}

// ── Passo a passo que se revela ─────────────────────────────────────────────

type Passo = { expressao: string; texto: string };

function lerPassos(data: Record<string, unknown>) {
  const passos = (Array.isArray(data.passos) ? data.passos : [])
    .map((item) => {
      const p = item as Record<string, unknown>;
      return { expressao: str(p.expressao, 400).replace(/^\$+|\$+$/g, ""), texto: str(p.texto ?? p.explicacao, 400) };
    })
    .filter((p) => p.expressao || p.texto)
    .slice(0, 10);
  return passos.length >= 2 ? { titulo: str(data.titulo, 120) || "Passo a passo", passos } : null;
}

/** Pedaços da expressão nova que não estavam na anterior ganham cor. */
function destacarMudanca(antes: string, agora: string) {
  if (!antes) return agora;
  const velhos = new Map<string, number>();
  for (const token of antes.split(/\s+/)) velhos.set(token, (velhos.get(token) || 0) + 1);
  return agora
    .split(/\s+/)
    .map((token) => {
      const resta = velhos.get(token) || 0;
      if (resta > 0) {
        velhos.set(token, resta - 1);
        return token;
      }
      return /^[=+\-−·×÷]$/.test(token) ? token : `{\\color{#e0782b}${token}}`;
    })
    .join(" ");
}

function Passos({ titulo, passos }: { titulo: string; passos: Passo[] }) {
  const [vistos, setVistos] = useState(1);
  const [tentar, setTentar] = useState(false);
  const proximo = () => {
    setTentar(false);
    setVistos((n) => Math.min(passos.length, n + 1));
  };
  return (
    <section className="mbk mbk-passos" aria-label={`Passo a passo: ${titulo}`}>
      <header className="mbk-head">
        <strong>{titulo}</strong>
        <span className="mbk-meta">
          {vistos} de {passos.length}
        </span>
      </header>
      <ol className="mbk-passos__lista">
        {passos.slice(0, vistos).map((p, i) => (
          <li key={i} className={i === vistos - 1 ? "is-novo" : ""}>
            <span className="mbk-letra" aria-hidden>
              {i + 1}
            </span>
            <div>
              {p.expressao ? (
                <p className="mbk-passos__expr">
                  <MineInline text={`$${i > 0 && i === vistos - 1 ? destacarMudanca(passos[i - 1].expressao, p.expressao) : p.expressao}$`} />
                </p>
              ) : null}
              {p.texto ? (
                <p className="mbk-muted">
                  <MineInline text={p.texto} />
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {vistos < passos.length ? (
        tentar ? (
          <div className="mbk-passos__tentar" role="status">
            <p>Pense no próximo passo: o que você faria agora? Depois confira.</p>
            <button type="button" className="mbk-btn" onClick={proximo}>
              <Eye aria-hidden /> Conferir o passo {vistos + 1}
            </button>
          </div>
        ) : (
          <div className="mbk-row">
            <button type="button" className="mbk-btn is-ghost" onClick={() => setTentar(true)}>
              Quero tentar antes
            </button>
            <button type="button" className="mbk-btn" onClick={proximo}>
              Próximo passo <ChevronRight aria-hidden />
            </button>
            <button type="button" className="mbk-link" onClick={() => setVistos(passos.length)}>
              Ver tudo
            </button>
          </div>
        )
      ) : (
        <div className="mbk-row">
          <button type="button" className="mbk-btn is-ghost" onClick={() => setVistos(1)}>
            <RotateCcw aria-hidden /> Ver de novo
          </button>
        </div>
      )}
    </section>
  );
}

// ── Roteiro (página tipo revista) ───────────────────────────────────────────

type Cartao = { icone: string; titulo: string; texto: string; itens: string[]; quem: string };

function lerRoteiro(data: Record<string, unknown>, code: string) {
  const cartoes = (Array.isArray(data.cartoes) ? data.cartoes : [])
    .map((item) => {
      const c = item as Record<string, unknown>;
      return {
        icone: str(c.icone, 8),
        titulo: str(c.titulo, 100),
        texto: str(c.texto, 500),
        itens: (Array.isArray(c.itens) ? c.itens : []).map((i) => str(i, 160)).filter(Boolean).slice(0, 8),
        quem: str(c.quem, 40),
      };
    })
    .filter((c) => c.titulo)
    .slice(0, 12);
  return cartoes.length ? { titulo: str(data.titulo, 120) || "Roteiro", subtitulo: str(data.subtitulo, 200), cartoes, chave: `minerva:roteiro:${hashOf(code)}` } : null;
}

function Roteiro({ titulo, subtitulo, cartoes, chave }: NonNullable<ReturnType<typeof lerRoteiro>>) {
  const [feitos, setFeitos] = useState<Record<string, boolean>>(() => lerLocal(chave, {}));
  const [aberto, setAberto] = useState<number | null>(null);
  const total = cartoes.reduce((soma, c) => soma + c.itens.length, 0);
  const marcados = Object.values(feitos).filter(Boolean).length;
  const marcar = (id: string) => {
    setFeitos((atual) => {
      const novo = { ...atual, [id]: !atual[id] };
      gravarLocal(chave, novo);
      return novo;
    });
  };
  return (
    <section className="mbk mbk-roteiro" aria-label={`Roteiro: ${titulo}`}>
      <header className="mbk-roteiro__capa">
        <strong>{titulo}</strong>
        {subtitulo ? <span>{subtitulo}</span> : null}
        {total ? (
          <span className="mbk-meta">
            {marcados}/{total} feitos
          </span>
        ) : null}
      </header>
      <div className="mbk-roteiro__grade">
        {cartoes.map((c, i) => (
          <article key={i} className={`mbk-roteiro__cartao${aberto === i ? " is-aberto" : ""}`}>
            <button type="button" className="mbk-roteiro__topo" onClick={() => setAberto(aberto === i ? null : i)} aria-expanded={aberto === i}>
              {c.icone ? <span className="mbk-roteiro__icone" aria-hidden>{c.icone}</span> : null}
              <span>
                <b>{c.titulo}</b>
                {c.quem ? <small>{c.quem}</small> : null}
              </span>
            </button>
            {c.texto ? (
              <p className="mbk-muted">
                <MineInline text={c.texto} />
              </p>
            ) : null}
            {c.itens.length ? (
              <ul className="mbk-roteiro__itens">
                {c.itens.map((item, j) => {
                  const id = `${i}-${j}`;
                  return (
                    <li key={id}>
                      <label>
                        <input type="checkbox" checked={Boolean(feitos[id])} onChange={() => marcar(id)} />
                        <span className={feitos[id] ? "is-feito" : ""}>
                          <MineInline text={item} />
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

// ── Dois jeitos de explicar ─────────────────────────────────────────────────

function lerDoisJeitos(data: Record<string, unknown>) {
  const jeitos = (Array.isArray(data.jeitos) ? data.jeitos : [])
    .map((item) => {
      const j = item as Record<string, unknown>;
      return { estilo: str(j.estilo, 40) || "Jeito", texto: str(j.texto, 2000) };
    })
    .filter((j) => j.texto)
    .slice(0, 3);
  return jeitos.length >= 2 ? { assunto: str(data.assunto, 100), jeitos } : null;
}

function DoisJeitos({ assunto, jeitos }: NonNullable<ReturnType<typeof lerDoisJeitos>>) {
  const acoes = useContext(BlocoAcoesContext);
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const escolher = (i: number) => {
    setEscolhido(i);
    acoes?.anotarPreferencia?.(`${jeitos[i].estilo}${assunto ? ` (em ${assunto})` : ""}`);
  };
  return (
    <section className="mbk mbk-jeitos" aria-label={`Dois jeitos de explicar${assunto ? `: ${assunto}` : ""}`}>
      <header className="mbk-head">
        <strong>{assunto ? `${assunto}: dois jeitos` : "Dois jeitos de explicar"}</strong>
        <span className="mbk-meta">Qual ficou mais claro?</span>
      </header>
      <div className="mbk-jeitos__colunas">
        {jeitos.map((j, i) => (
          <article key={i} className={escolhido === i ? "is-escolhido" : escolhido !== null ? "is-outro" : ""}>
            <span className="mbk-jeitos__estilo">{j.estilo}</span>
            {j.texto.split(/\n{2,}/).map((par, k) => (
              <p key={k}>
                <MineInline text={par} />
              </p>
            ))}
            <button type="button" className={`mbk-btn${escolhido === i ? "" : " is-ghost"}`} onClick={() => escolher(i)} aria-pressed={escolhido === i}>
              {escolhido === i ? <Check aria-hidden /> : null} Entendi melhor esse
            </button>
          </article>
        ))}
      </div>
      {escolhido !== null ? (
        <p className="mbk-muted" role="status">
          Anotado: daqui em diante a Mine usa mais o jeito "{jeitos[escolhido].estilo}" com você.
        </p>
      ) : null}
    </section>
  );
}

// ── Correção em cima da foto ────────────────────────────────────────────────

type Marca = { x: number; y: number; r: number; tipo: "erro" | "acerto" | "dica"; texto: string };

function lerCorrecao(data: Record<string, unknown>) {
  const marcas = (Array.isArray(data.marcas) ? data.marcas : [])
    .map((item) => {
      const m = item as Record<string, unknown>;
      const tipo = str(m.tipo, 10).toLowerCase();
      const clamp = (v: number) => Math.min(1, Math.max(0, v));
      return {
        x: clamp(num(m.x, 0.5)),
        y: clamp(num(m.y, 0.5)),
        r: Math.min(0.2, Math.max(0.02, num(m.r, 0.06))),
        tipo: (tipo === "acerto" ? "acerto" : tipo === "dica" ? "dica" : "erro") as Marca["tipo"],
        texto: str(m.texto, 300),
      };
    })
    .filter((m) => m.texto)
    .slice(0, 8);
  return marcas.length ? { titulo: str(data.titulo, 120) || "Correção na sua foto", marcas } : null;
}

function Correcao({ titulo, marcas }: NonNullable<ReturnType<typeof lerCorrecao>>) {
  const foto = useContext(AnexoDaPerguntaContext);
  const [ativa, setAtiva] = useState<number | null>(null);
  if (!foto) {
    return (
      <section className="mbk mbk-correcao" aria-label={titulo}>
        <header className="mbk-head">
          <strong>{titulo}</strong>
        </header>
        <ol className="mbk-correcao__lista">
          {marcas.map((m, i) => (
            <li key={i} className={`is-${m.tipo}`}>
              <MineInline text={m.texto} />
            </li>
          ))}
        </ol>
      </section>
    );
  }
  return (
    <section className="mbk mbk-correcao" aria-label={titulo}>
      <header className="mbk-head">
        <strong>{titulo}</strong>
        <span className="mbk-meta">
          {marcas.filter((m) => m.tipo === "erro").length} para corrigir
        </span>
      </header>
      <div className="mbk-correcao__foto">
        <img src={foto} alt="A foto que você mandou, com as marcações da Mine" />
        {marcas.map((m, i) => (
          <button
            key={i}
            type="button"
            className={`mbk-correcao__marca is-${m.tipo}${ativa === i ? " is-ativa" : ""}`}
            style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.r * 200}%`, aspectRatio: "1" }}
            onClick={() => setAtiva(ativa === i ? null : i)}
            aria-label={`Marca ${i + 1}: ${m.texto}`}
          >
            <span>{i + 1}</span>
          </button>
        ))}
      </div>
      <ol className="mbk-correcao__lista">
        {marcas.map((m, i) => (
          <li key={i} className={`is-${m.tipo}${ativa === i ? " is-ativa" : ""}`} onMouseEnter={() => setAtiva(i)} onMouseLeave={() => setAtiva(null)}>
            <b>{i + 1}</b> <MineInline text={m.texto} />
          </li>
        ))}
      </ol>
    </section>
  );
}

// ── Voz (podcast e slides) ──────────────────────────────────────────────────
// A voz é a da Mine (src/chat/vozMine.ts); sem ela, a do navegador.

function limparFala(texto: string) {
  return texto.replace(/\$+/g, "").replace(/\*\*/g, "").replace(/\\[a-z]+/gi, " ").replace(/[{}_^]/g, " ");
}

// ── Podcast ─────────────────────────────────────────────────────────────────

function lerPodcast(data: Record<string, unknown>) {
  const falas = (Array.isArray(data.falas) ? data.falas : [])
    .map((item) => {
      const f = item as Record<string, unknown>;
      return { quem: str(f.quem, 20) || "Mine", texto: str(f.texto, 800) };
    })
    .filter((f) => f.texto)
    .slice(0, 30);
  return falas.length >= 2 ? { titulo: str(data.titulo, 120) || "Podcast da Mine", falas } : null;
}

function Podcast({ titulo, falas }: NonNullable<ReturnType<typeof lerPodcast>>) {
  const [atual, setAtual] = useState<number | null>(null);
  const [velocidade, setVelocidade] = useState(1);
  const tocando = useRef(false);
  const lista = useRef<HTMLOListElement | null>(null);
  const pessoas = useMemo(() => Array.from(new Set(falas.map((f) => f.quem))), [falas]);
  // A Mine fala com a voz dela; quem mais aparecer (o Leo) com a voz do colega.
  const vozDe = (quem: string) => (/^mine$/i.test(quem.trim()) ? "mine" : "leo") as "mine" | "leo";
  const parar = () => {
    tocando.current = false;
    pararDeFalar();
    setAtual(null);
  };
  useEffect(() => () => parar(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const tocar = async (desde = 0) => {
    if (!podeFalar()) return;
    tocando.current = true;
    for (let i = desde; i < falas.length; i += 1) {
      if (!tocando.current) return;
      setAtual(i);
      lista.current?.children[i]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      if (falas[i + 1]) prepararFala(falas[i + 1].texto, vozDe(falas[i + 1].quem));
      const terminou = await falarComoMine(falas[i].texto, { quem: vozDe(falas[i].quem), velocidade });
      if (!terminou) return;
    }
    tocando.current = false;
    setAtual(null);
  };
  const minutos = Math.max(1, Math.round(falas.reduce((soma, f) => soma + f.texto.split(/\s+/).length, 0) / 150));
  return (
    <section className="mbk mbk-podcast" aria-label={`Podcast: ${titulo}`}>
      <header className="mbk-head">
        <strong>
          <Headphones aria-hidden /> {titulo}
        </strong>
        <span className="mbk-meta">
          ~{minutos} min · {pessoas.join(" e ")}
        </span>
      </header>
      {podeFalar() ? (
        <div className="mbk-row">
          {atual === null ? (
            <button type="button" className="mbk-btn" onClick={() => void tocar(0)}>
              <Play aria-hidden /> Ouvir
            </button>
          ) : (
            <>
              <button type="button" className="mbk-btn" onClick={parar}>
                <Square aria-hidden /> Parar
              </button>
              <button type="button" className="mbk-btn is-ghost" onClick={() => void tocar(Math.min(falas.length - 1, (atual ?? 0) + 1))}>
                <SkipForward aria-hidden /> Pular fala
              </button>
            </>
          )}
          <label className="mbk-podcast__vel">
            Velocidade
            <select value={velocidade} onChange={(event) => setVelocidade(Number(event.target.value))}>
              <option value={0.85}>0,85×</option>
              <option value={1}>1×</option>
              <option value={1.2}>1,2×</option>
              <option value={1.4}>1,4×</option>
            </select>
          </label>
        </div>
      ) : (
        <p className="mbk-muted">Este navegador não lê em voz alta; a conversa está escrita abaixo.</p>
      )}
      <ol className="mbk-podcast__falas" ref={lista}>
        {falas.map((f, i) => (
          <li key={i} className={`${atual === i ? "is-atual " : ""}${pessoas.indexOf(f.quem) % 2 ? "is-b" : "is-a"}`}>
            <button type="button" onClick={() => void tocar(i)} aria-label={`Ouvir a partir daqui: ${f.quem}`}>
              <b>{f.quem}</b>
            </button>
            <span>
              <MineInline text={f.texto} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ── Vídeo-resumo narrado ────────────────────────────────────────────────────

function lerSlides(data: Record<string, unknown>) {
  const slides = (Array.isArray(data.slides) ? data.slides : [])
    .map((item) => {
      const s = item as Record<string, unknown>;
      return {
        titulo: str(s.titulo, 100),
        topicos: (Array.isArray(s.topicos) ? s.topicos : []).map((t) => str(t, 160)).filter(Boolean).slice(0, 5),
        fala: str(s.fala, 900),
      };
    })
    .filter((s) => s.titulo)
    .slice(0, 12);
  return slides.length ? { titulo: str(data.titulo, 120) || "Vídeo-resumo", slides } : null;
}

function Slides({ titulo, slides }: NonNullable<ReturnType<typeof lerSlides>>) {
  const [i, setI] = useState(0);
  const [tocando, setTocando] = useState(false);
  const ativo = useRef(false);
  const parar = () => {
    ativo.current = false;
    setTocando(false);
    pararDeFalar();
  };
  useEffect(() => () => parar(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const falaDe = (n: number) => slides[n].fala || `${slides[n].titulo}. ${slides[n].topicos.join(". ")}`;
  const tocar = async (desde: number) => {
    if (!podeFalar()) return;
    ativo.current = true;
    setTocando(true);
    for (let n = desde; n < slides.length; n += 1) {
      if (!ativo.current) return;
      setI(n);
      if (slides[n + 1]) prepararFala(falaDe(n + 1));
      const terminou = await falarComoMine(falaDe(n));
      if (!terminou) return;
      if (ativo.current) await new Promise((r) => setTimeout(r, 500));
    }
    ativo.current = false;
    setTocando(false);
  };
  const ir = (n: number) => {
    parar();
    setI(Math.min(slides.length - 1, Math.max(0, n)));
  };
  const s = slides[i];
  return (
    <section className="mbk mbk-slides" aria-label={`Vídeo-resumo: ${titulo}`}>
      <header className="mbk-head">
        <strong>{titulo}</strong>
        <span className="mbk-meta">
          Slide {i + 1} de {slides.length}
        </span>
      </header>
      <div className="mbk-slides__tela" aria-live="polite">
        <span className="mbk-slides__num" aria-hidden>
          {String(i + 1).padStart(2, "0")}
        </span>
        <h4>{s.titulo}</h4>
        {s.topicos.length ? (
          <ul>
            {s.topicos.map((t, k) => (
              <li key={k}>
                <MineInline text={t} />
              </li>
            ))}
          </ul>
        ) : null}
        {s.fala ? <p className="mbk-slides__legenda">{limparFala(s.fala)}</p> : null}
        <div className="mbk-progress" aria-hidden>
          <i style={{ width: `${((i + 1) / slides.length) * 100}%` }} />
        </div>
      </div>
      <div className="mbk-row">
        <button type="button" className="mbk-icon" onClick={() => ir(i - 1)} disabled={i === 0} aria-label="Slide anterior">
          <ChevronLeft aria-hidden />
        </button>
        {podeFalar() ? (
          tocando ? (
            <button type="button" className="mbk-btn" onClick={parar}>
              <Pause aria-hidden /> Pausar
            </button>
          ) : (
            <button type="button" className="mbk-btn" onClick={() => void tocar(i)}>
              <Play aria-hidden /> {i === 0 ? "Assistir narrado" : "Continuar narrando"}
            </button>
          )
        ) : null}
        <button type="button" className="mbk-icon" onClick={() => ir(i + 1)} disabled={i >= slides.length - 1} aria-label="Próximo slide">
          <ChevronRight aria-hidden />
        </button>
      </div>
    </section>
  );
}

// ── Entrada ─────────────────────────────────────────────────────────────────

export function BlocoNovo({ lang, code, fallback }: { lang: string; code: string; fallback: ReactNode }) {
  const data = useMemo(() => readJson(code), [code]);
  const kind = lang === "simulação" || lang === "laboratorio" ? "simulacao" : lang === "correção" ? "correcao" : lang;
  const parsed = useMemo(() => {
    if (!data) return null;
    try {
      if (kind === "simulacao") {
        const lab = lerLab(data);
        if (lab) compile(lab.expressao)({ x: lab.x.valor, ...Object.fromEntries(lab.parametros.map((p) => [p.nome, p.valor])) });
        return lab;
      }
    } catch {
      return null;
    }
    if (kind === "passos") return lerPassos(data);
    if (kind === "roteiro") return lerRoteiro(data, code);
    if (kind === "dois-jeitos") return lerDoisJeitos(data);
    if (kind === "correcao") return lerCorrecao(data);
    if (kind === "podcast") return lerPodcast(data);
    if (kind === "slides") return lerSlides(data);
    return null;
  }, [data, kind, code]);
  if (!parsed) return <>{fallback}</>;
  if (kind === "simulacao") return <Laboratorio {...(parsed as Lab)} />;
  if (kind === "passos") return <Passos {...(parsed as NonNullable<ReturnType<typeof lerPassos>>)} />;
  if (kind === "roteiro") return <Roteiro {...(parsed as NonNullable<ReturnType<typeof lerRoteiro>>)} />;
  if (kind === "dois-jeitos") return <DoisJeitos {...(parsed as NonNullable<ReturnType<typeof lerDoisJeitos>>)} />;
  if (kind === "correcao") return <Correcao {...(parsed as NonNullable<ReturnType<typeof lerCorrecao>>)} />;
  if (kind === "podcast") return <Podcast {...(parsed as NonNullable<ReturnType<typeof lerPodcast>>)} />;
  return <Slides {...(parsed as NonNullable<ReturnType<typeof lerSlides>>)} />;
}

export const NOMES_NOVOS_CHEGANDO: Record<string, string> = {
  simulacao: "Montando o laboratório…",
  passos: "Separando os passos…",
  roteiro: "Montando o roteiro…",
  "dois-jeitos": "Escrevendo dois jeitos…",
  correcao: "Marcando sua foto…",
  podcast: "Gravando o podcast…",
  slides: "Montando os slides…",
};
