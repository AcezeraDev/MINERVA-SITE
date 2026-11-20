/**
 * Química para a Mine: tabela periódica, massa molar e balanceamento de
 * equações por álgebra linear (frações exatas), sem depender do modelo
 * "fazer de cabeça". Usado pelas ferramentas do servidor (mine/tools.mjs).
 */

// número atômico = posição + 1; massa atômica padrão (IUPAC, arredondada)
const ELEMENTS = [
  ["H", "Hidrogênio", 1.008], ["He", "Hélio", 4.0026], ["Li", "Lítio", 6.94], ["Be", "Berílio", 9.0122], ["B", "Boro", 10.81],
  ["C", "Carbono", 12.011], ["N", "Nitrogênio", 14.007], ["O", "Oxigênio", 15.999], ["F", "Flúor", 18.998], ["Ne", "Neônio", 20.18],
  ["Na", "Sódio", 22.99], ["Mg", "Magnésio", 24.305], ["Al", "Alumínio", 26.982], ["Si", "Silício", 28.085], ["P", "Fósforo", 30.974],
  ["S", "Enxofre", 32.06], ["Cl", "Cloro", 35.45], ["Ar", "Argônio", 39.948], ["K", "Potássio", 39.098], ["Ca", "Cálcio", 40.078],
  ["Sc", "Escândio", 44.956], ["Ti", "Titânio", 47.867], ["V", "Vanádio", 50.942], ["Cr", "Cromo", 51.996], ["Mn", "Manganês", 54.938],
  ["Fe", "Ferro", 55.845], ["Co", "Cobalto", 58.933], ["Ni", "Níquel", 58.693], ["Cu", "Cobre", 63.546], ["Zn", "Zinco", 65.38],
  ["Ga", "Gálio", 69.723], ["Ge", "Germânio", 72.63], ["As", "Arsênio", 74.922], ["Se", "Selênio", 78.971], ["Br", "Bromo", 79.904],
  ["Kr", "Criptônio", 83.798], ["Rb", "Rubídio", 85.468], ["Sr", "Estrôncio", 87.62], ["Y", "Ítrio", 88.906], ["Zr", "Zircônio", 91.224],
  ["Nb", "Nióbio", 92.906], ["Mo", "Molibdênio", 95.95], ["Tc", "Tecnécio", 98], ["Ru", "Rutênio", 101.07], ["Rh", "Ródio", 102.91],
  ["Pd", "Paládio", 106.42], ["Ag", "Prata", 107.87], ["Cd", "Cádmio", 112.41], ["In", "Índio", 114.82], ["Sn", "Estanho", 118.71],
  ["Sb", "Antimônio", 121.76], ["Te", "Telúrio", 127.6], ["I", "Iodo", 126.9], ["Xe", "Xenônio", 131.29], ["Cs", "Césio", 132.91],
  ["Ba", "Bário", 137.33], ["La", "Lantânio", 138.91], ["Ce", "Cério", 140.12], ["Pr", "Praseodímio", 140.91], ["Nd", "Neodímio", 144.24],
  ["Pm", "Promécio", 145], ["Sm", "Samário", 150.36], ["Eu", "Európio", 151.96], ["Gd", "Gadolínio", 157.25], ["Tb", "Térbio", 158.93],
  ["Dy", "Disprósio", 162.5], ["Ho", "Hólmio", 164.93], ["Er", "Érbio", 167.26], ["Tm", "Túlio", 168.93], ["Yb", "Itérbio", 173.05],
  ["Lu", "Lutécio", 174.97], ["Hf", "Háfnio", 178.49], ["Ta", "Tântalo", 180.95], ["W", "Tungstênio", 183.84], ["Re", "Rênio", 186.21],
  ["Os", "Ósmio", 190.23], ["Ir", "Irídio", 192.22], ["Pt", "Platina", 195.08], ["Au", "Ouro", 196.97], ["Hg", "Mercúrio", 200.59],
  ["Tl", "Tálio", 204.38], ["Pb", "Chumbo", 207.2], ["Bi", "Bismuto", 208.98], ["Po", "Polônio", 209], ["At", "Astato", 210],
  ["Rn", "Radônio", 222], ["Fr", "Frâncio", 223], ["Ra", "Rádio", 226], ["Ac", "Actínio", 227], ["Th", "Tório", 232.04],
  ["Pa", "Protactínio", 231.04], ["U", "Urânio", 238.03], ["Np", "Netúnio", 237], ["Pu", "Plutônio", 244], ["Am", "Amerício", 243],
  ["Cm", "Cúrio", 247], ["Bk", "Berquélio", 247], ["Cf", "Califórnio", 251], ["Es", "Einstênio", 252], ["Fm", "Férmio", 257],
  ["Md", "Mendelévio", 258], ["No", "Nobélio", 259], ["Lr", "Laurêncio", 266], ["Rf", "Rutherfórdio", 267], ["Db", "Dúbnio", 268],
  ["Sg", "Seabórgio", 269], ["Bh", "Bóhrio", 270], ["Hs", "Hássio", 269], ["Mt", "Meitnério", 278], ["Ds", "Darmstádio", 281],
  ["Rg", "Roentgênio", 282], ["Cn", "Copernício", 285], ["Nh", "Nihônio", 286], ["Fl", "Fleróvio", 289], ["Mc", "Moscóvio", 290],
  ["Lv", "Livermório", 293], ["Ts", "Tenesso", 294], ["Og", "Oganessônio", 294],
];

const BY_SYMBOL = new Map(ELEMENTS.map(([symbol, name, mass], index) => [symbol, { symbol, name, mass, number: index + 1 }]));

function fold(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

export class QuimicaError extends Error {}

/** Elemento por símbolo ("Fe"), nome ("ferro") ou número atômico (26). */
export function element(query) {
  const value = String(query || "").trim();
  if (/^\d+$/.test(value)) {
    const row = ELEMENTS[Number(value) - 1];
    return row ? BY_SYMBOL.get(row[0]) : null;
  }
  if (BY_SYMBOL.has(value)) return BY_SYMBOL.get(value);
  const cap = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  if (BY_SYMBOL.has(cap)) return BY_SYMBOL.get(cap);
  const name = fold(value);
  for (const item of BY_SYMBOL.values()) if (fold(item.name) === name) return item;
  return null;
}

/**
 * Conta os átomos de uma fórmula: "Ca(OH)2", "CuSO4·5H2O", "[Fe(CN)6]4-".
 * Cargas (+/-) no fim são ignoradas para a contagem.
 */
export function parseFormula(formula) {
  const text = String(formula || "")
    .replace(/\s+/g, "")
    .replace(/[₀-₉]/g, (d) => String("₀₁₂₃₄₅₆₇₈₉".indexOf(d)))
    .replace(/\^?\d*[+-]$/, "");
  if (!text) throw new QuimicaError("Fórmula vazia.");
  const parts = text.split(/[·.*]/);
  const total = {};
  for (const part of parts) {
    const lead = /^(\d+)(.*)$/.exec(part);
    const times = lead ? Number(lead[1]) : 1;
    const counts = parseGroup(lead ? lead[2] : part);
    for (const [symbol, n] of Object.entries(counts)) total[symbol] = (total[symbol] || 0) + n * times;
  }
  return total;
}

function parseGroup(text) {
  const stack = [{}];
  let i = 0;
  const add = (map, symbol, n) => {
    map[symbol] = (map[symbol] || 0) + n;
  };
  const readNumber = () => {
    const match = /^\d+/.exec(text.slice(i));
    if (!match) return 1;
    i += match[0].length;
    return Number(match[0]);
  };
  while (i < text.length) {
    const char = text[i];
    if (char === "(" || char === "[") {
      stack.push({});
      i += 1;
    } else if (char === ")" || char === "]") {
      i += 1;
      const group = stack.pop();
      if (!group || !stack.length) throw new QuimicaError("Parênteses desencontrados na fórmula.");
      const n = readNumber();
      for (const [symbol, count] of Object.entries(group)) add(stack[stack.length - 1], symbol, count * n);
    } else if (/[A-Z]/.test(char)) {
      const match = /^[A-Z][a-z]?/.exec(text.slice(i));
      let symbol = match[0];
      if (!BY_SYMBOL.has(symbol) && symbol.length === 2 && BY_SYMBOL.has(symbol[0])) symbol = symbol[0];
      if (!BY_SYMBOL.has(symbol)) throw new QuimicaError(`"${symbol}" não é um elemento químico.`);
      i += symbol.length;
      add(stack[stack.length - 1], symbol, readNumber());
    } else {
      throw new QuimicaError(`Não entendi "${char}" na fórmula.`);
    }
  }
  if (stack.length !== 1) throw new QuimicaError("Faltou fechar um parêntese na fórmula.");
  return stack[0];
}

/** Massa molar em g/mol, com a conta de cada elemento. */
export function molarMass(formula) {
  const counts = parseFormula(formula);
  const parts = Object.entries(counts).map(([symbol, n]) => {
    const item = BY_SYMBOL.get(symbol);
    return { symbol, nome: item.name, quantidade: n, massaAtomica: item.mass, subtotal: Math.round(item.mass * n * 1000) / 1000 };
  });
  const total = Math.round(parts.reduce((sum, part) => sum + part.subtotal, 0) * 1000) / 1000;
  return { formula: String(formula).trim(), massaMolar: total, unidade: "g/mol", elementos: parts };
}

// ── frações exatas para o balanceamento ────────────────────────────────────
const gcd = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
const lcm = (a, b) => (a / gcd(a, b)) * b;
const frac = (n, d = 1) => {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
};
const fsub = (a, b) => frac(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const fmul = (a, b) => frac(a[0] * b[0], a[1] * b[1]);
const fdiv = (a, b) => frac(a[0] * b[1], a[1] * b[0]);

/**
 * Balanceia "Fe + O2 -> Fe2O3" (aceita ->, →, =, ⟶). Devolve os menores
 * coeficientes inteiros e a equação escrita.
 */
export function balance(equation) {
  const [left, right, ...rest] = String(equation || "").split(/\s*(?:->|→|⟶|=|⇌|<=>)\s*/);
  if (!left || !right || rest.length) throw new QuimicaError("Escreva a equação com uma seta, como: Fe + O2 -> Fe2O3.");
  const side = (text) => text.split(/\s+\+\s+|\s*\+\s*(?=[A-Z(\[\d])/).map((item) => item.trim()).filter(Boolean).map((item) => item.replace(/^\d+(?=[A-Z(\[])/, ""));
  const reagentes = side(left);
  const produtos = side(right);
  const species = [...reagentes, ...produtos];
  const counts = species.map((formula) => parseFormula(formula));
  const symbols = [...new Set(counts.flatMap((map) => Object.keys(map)))];
  // Matriz elementos x espécies (produtos com sinal negativo).
  const rows = symbols.map((symbol) => species.map((_, j) => frac((counts[j][symbol] || 0) * (j < reagentes.length ? 1 : -1))));
  const cols = species.length;
  // Escalonamento (Gauss-Jordan) em frações.
  const pivots = [];
  let r = 0;
  for (let c = 0; c < cols && r < rows.length; c += 1) {
    const p = rows.findIndex((row, i) => i >= r && row[c][0] !== 0);
    if (p < 0) continue;
    [rows[r], rows[p]] = [rows[p], rows[r]];
    const pivot = rows[r][c];
    rows[r] = rows[r].map((value) => fdiv(value, pivot));
    for (let i = 0; i < rows.length; i += 1) {
      if (i === r || rows[i][c][0] === 0) continue;
      const factor = rows[i][c];
      rows[i] = rows[i].map((value, k) => fsub(value, fmul(factor, rows[r][k])));
    }
    pivots.push(c);
    r += 1;
  }
  const free = [...Array(cols).keys()].filter((c) => !pivots.includes(c));
  if (free.length !== 1) throw new QuimicaError(free.length ? "Essa equação tem mais de um jeito de balancear; separe em reações menores." : "Essa equação não fecha: confira as fórmulas.");
  const f = free[0];
  const solution = Array(cols).fill(null);
  solution[f] = frac(1);
  pivots.forEach((c, i) => {
    solution[c] = frac(-rows[i][f][0], rows[i][f][1]);
  });
  const denom = solution.reduce((acc, value) => lcm(acc, value[1]), 1);
  let ints = solution.map((value) => (value[0] * denom) / value[1]);
  if (ints.some((value) => value <= 0)) {
    if (ints.every((value) => value < 0)) ints = ints.map((value) => -value);
    else throw new QuimicaError("Não existe balanceamento com todos os coeficientes positivos; confira reagentes e produtos.");
  }
  const g = ints.reduce((acc, value) => gcd(acc, value), 0);
  ints = ints.map((value) => value / g);
  const write = (list, offset) => list.map((formula, i) => `${ints[offset + i] === 1 ? "" : ints[offset + i]}${formula}`).join(" + ");
  return {
    equacao: `${write(reagentes, 0)} → ${write(produtos, reagentes.length)}`,
    coeficientes: species.map((formula, i) => ({ formula, coeficiente: ints[i] })),
  };
}
