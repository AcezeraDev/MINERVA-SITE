/**
 * Contas de verdade para a Mine: um interpretador pequeno e seguro de
 * expressões matemáticas (sem eval) e um resolvedor numérico de equações.
 *
 * Usado pelo servidor (ferramentas `calcular` e `resolver_equacao`) e pelo
 * navegador (gráfico de função com controles deslizantes, bloco ```funcao).
 *
 * Aceita: números (2.5 ou 2,5 sozinho), + - * / ^ e ** , % no fim de um número
 * (vira /100), fatorial (5!), parênteses, multiplicação implícita (2x, 3(x+1),
 * (a+b)(a-b)), constantes pi, π, e, funções sqrt raiz cbrt sin sen cos tan tg
 * asin acos atan sinh cosh tanh ln log log2 log10 exp abs floor ceil round
 * sign, sind/cosd/tand (graus), e variáveis de um escopo.
 */

const FUNCTIONS = {
  sqrt: Math.sqrt,
  raiz: Math.sqrt,
  cbrt: Math.cbrt,
  sin: Math.sin,
  sen: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  tg: Math.tan,
  asin: Math.asin,
  arcsen: Math.asin,
  acos: Math.acos,
  arccos: Math.acos,
  atan: Math.atan,
  arctg: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  ln: Math.log,
  log: Math.log10,
  log10: Math.log10,
  log2: Math.log2,
  exp: Math.exp,
  abs: Math.abs,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
  sind: (x) => Math.sin((x * Math.PI) / 180),
  cosd: (x) => Math.cos((x * Math.PI) / 180),
  tand: (x) => Math.tan((x * Math.PI) / 180),
};

const CONSTANTS = { pi: Math.PI, "π": Math.PI, e: Math.E };

export class CalcError extends Error {}

function factorial(n) {
  if (!Number.isInteger(n) || n < 0) throw new CalcError("Fatorial só de inteiro maior ou igual a zero.");
  if (n > 170) return Infinity;
  let value = 1;
  for (let i = 2; i <= n; i += 1) value *= i;
  return value;
}

function tokenize(source) {
  const text = String(source || "")
    .replace(/[×·]/g, "*")
    .replace(/[÷:]/g, "/")
    .replace(/−/g, "-")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/√/g, "sqrt")
    // "2,5" vira 2.5 quando a vírgula está entre dígitos e não há função com vários argumentos.
    .replace(/(\d),(\d)/g, "$1.$2");
  const tokens = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    const number = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(text.slice(index));
    if (number) {
      tokens.push({ type: "num", value: Number(number[0]) });
      index += number[0].length;
      continue;
    }
    const word = /^[a-zA-Zπ_][a-zA-Z0-9_]*/.exec(text.slice(index));
    if (word) {
      tokens.push({ type: "id", value: word[0] });
      index += word[0].length;
      continue;
    }
    if (text.startsWith("**", index)) {
      tokens.push({ type: "op", value: "^" });
      index += 2;
      continue;
    }
    if ("+-*/^()!%".includes(char)) {
      tokens.push({ type: char === "(" || char === ")" ? char : "op", value: char });
      index += 1;
      continue;
    }
    throw new CalcError(`Não entendi o símbolo "${char}".`);
  }
  return tokens;
}

/**
 * Árvore da expressão. Gramática (do mais fraco ao mais forte):
 *   soma    := termo (("+"|"-") termo)*
 *   termo   := unario (("*"|"/"| implícito) unario)*
 *   unario  := ("-"|"+") unario | potencia
 *   potencia:= posfixo ("^" unario)?        (à direita: 2^3^2 = 2^9)
 *   posfixo := primario ("!"|"%")*
 */
export function parse(source) {
  const tokens = tokenize(source);
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];

  const startsPrimary = (token) => token && (token.type === "num" || token.type === "id" || token.type === "(");

  function soma() {
    let node = termo();
    while (peek()?.type === "op" && (peek().value === "+" || peek().value === "-")) {
      const op = take().value;
      node = { k: "bin", op, a: node, b: termo() };
    }
    return node;
  }
  function termo() {
    let node = unario();
    for (;;) {
      const token = peek();
      if (token?.type === "op" && (token.value === "*" || token.value === "/")) {
        take();
        node = { k: "bin", op: token.value, a: node, b: unario() };
      } else if (startsPrimary(token)) {
        node = { k: "bin", op: "*", a: node, b: potencia() };
      } else break;
    }
    return node;
  }
  function unario() {
    const token = peek();
    if (token?.type === "op" && (token.value === "-" || token.value === "+")) {
      take();
      const inner = unario();
      return token.value === "-" ? { k: "neg", a: inner } : inner;
    }
    return potencia();
  }
  function potencia() {
    const base = posfixo();
    if (peek()?.type === "op" && peek().value === "^") {
      take();
      return { k: "bin", op: "^", a: base, b: unario() };
    }
    return base;
  }
  function posfixo() {
    let node = primario();
    while (peek()?.type === "op" && (peek().value === "!" || peek().value === "%")) {
      node = { k: take().value === "!" ? "fat" : "pct", a: node };
    }
    return node;
  }
  function primario() {
    const token = take();
    if (!token) throw new CalcError("A expressão terminou no meio.");
    if (token.type === "num") return { k: "num", v: token.value };
    if (token.type === "(") {
      const inner = soma();
      if (take()?.type !== ")") throw new CalcError("Faltou fechar um parêntese.");
      return inner;
    }
    if (token.type === "id") {
      const name = token.value;
      const lower = name.toLowerCase();
      if (FUNCTIONS[lower] && (peek()?.type === "(" || startsPrimary(peek()))) {
        const arg = peek()?.type === "(" ? primario() : potencia();
        return { k: "fn", f: lower, a: arg };
      }
      if (lower in CONSTANTS && name !== "E") return { k: "num", v: CONSTANTS[lower] };
      return { k: "var", name };
    }
    throw new CalcError(`Não esperava "${token.value}" aqui.`);
  }

  if (!tokens.length) throw new CalcError("Expressão vazia.");
  const tree = soma();
  if (pos < tokens.length) throw new CalcError(`Sobrou "${tokens[pos].value}" no fim da expressão.`);
  return tree;
}

function run(node, scope) {
  switch (node.k) {
    case "num":
      return node.v;
    case "var": {
      if (Object.prototype.hasOwnProperty.call(scope, node.name)) return Number(scope[node.name]);
      throw new CalcError(`A variável "${node.name}" não tem valor.`);
    }
    case "neg":
      return -run(node.a, scope);
    case "fat":
      return factorial(run(node.a, scope));
    case "pct":
      return run(node.a, scope) / 100;
    case "fn":
      return FUNCTIONS[node.f](run(node.a, scope));
    case "bin": {
      const a = run(node.a, scope);
      const b = run(node.b, scope);
      if (node.op === "+") return a + b;
      if (node.op === "-") return a - b;
      if (node.op === "*") return a * b;
      if (node.op === "/") return a / b;
      return Math.pow(a, b);
    }
    default:
      throw new CalcError("Expressão inválida.");
  }
}

/** Variáveis livres da expressão (sem constantes nem funções). */
export function variablesOf(source) {
  const found = new Set();
  const walk = (node) => {
    if (!node) return;
    if (node.k === "var") found.add(node.name);
    walk(node.a);
    walk(node.b);
  };
  walk(parse(source));
  return [...found];
}

/** Compila uma vez e avalia muitas (o gráfico chama milhares de vezes). */
export function compile(source) {
  const tree = parse(source);
  return (scope = {}) => run(tree, scope);
}

export function evaluate(source, scope = {}) {
  return compile(source)(scope);
}

/** Número para mostrar: sem 0.30000000000000004, até 10 algarismos significativos. */
export function tidyNumber(value) {
  if (!Number.isFinite(value)) return value > 0 ? "infinito" : value < 0 ? "-infinito" : "indefinido";
  if (Math.abs(value) < 1e-12) return "0";
  const rounded = Number(value.toPrecision(12));
  const text = Math.abs(rounded) >= 1e15 || Math.abs(rounded) < 1e-6 ? rounded.toExponential(8).replace(/\.?0+e/, "e") : String(Number(rounded.toPrecision(10)));
  return text;
}

/**
 * Raízes reais de "lado esquerdo = lado direito" na variável, por varredura
 * e bisseção no intervalo. Encontra também raízes de multiplicidade par
 * (onde a curva só encosta no zero) pela busca de mínimos de |f|.
 */
export function solveEquation(equation, variable = "x", { min = -1000, max = 1000, steps = 40000 } = {}) {
  const [left, right = "0", ...rest] = String(equation || "").split("=");
  if (rest.length) throw new CalcError("A equação tem mais de um sinal de igual.");
  const f = compile(`(${left})-(${right})`);
  const at = (x) => {
    try {
      const value = f({ [variable]: x });
      return Number.isFinite(value) ? value : NaN;
    } catch (error) {
      if (error instanceof CalcError && /não tem valor/.test(error.message)) throw error;
      return NaN;
    }
  };
  const roots = [];
  const push = (x) => {
    const clean = Math.abs(x) < 1e-10 ? 0 : x;
    if (!roots.some((root) => Math.abs(root - clean) < 1e-6 * Math.max(1, Math.abs(clean)))) roots.push(clean);
  };
  const width = (max - min) / steps;
  let prevX = min;
  let prev = at(prevX);
  for (let i = 1; i <= steps && roots.length < 12; i += 1) {
    const x = min + i * width;
    const value = at(x);
    if (Number.isFinite(prev) && Number.isFinite(value)) {
      if (prev === 0) push(prevX);
      else if (Math.sign(prev) !== Math.sign(value) && value !== 0) {
        let a = prevX;
        let b = x;
        let fa = prev;
        for (let k = 0; k < 80; k += 1) {
          const mid = (a + b) / 2;
          const fm = at(mid);
          if (!Number.isFinite(fm)) break;
          if (Math.sign(fm) === Math.sign(fa)) {
            a = mid;
            fa = fm;
          } else b = mid;
        }
        const root = (a + b) / 2;
        // Assíntota (1/x) também troca de sinal: só vale se o valor for pequeno.
        if (Math.abs(at(root)) < 1e-6) push(root);
      }
    }
    prevX = x;
    prev = value;
  }
  // Raiz que só encosta (x² = 0): mínimo local de |f| perto de zero.
  for (let i = 1; i < steps && roots.length < 12; i += 50) {
    const x = min + i * width;
    const here = Math.abs(at(x));
    if (here < 1e-3 && here <= Math.abs(at(x - 50 * width)) && here <= Math.abs(at(x + 50 * width))) {
      let a = x - 50 * width;
      let b = x + 50 * width;
      for (let k = 0; k < 100; k += 1) {
        const m1 = a + (b - a) / 3;
        const m2 = b - (b - a) / 3;
        if (Math.abs(at(m1)) < Math.abs(at(m2))) b = m2;
        else a = m1;
      }
      const root = (a + b) / 2;
      if (Math.abs(at(root)) < 1e-9) push(Math.round(root * 1e9) / 1e9);
    }
  }
  return roots.sort((a, b) => a - b);
}
