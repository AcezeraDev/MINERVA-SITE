/**
 * Gráficos no chat da Mine (nov/2026).
 *
 * A Mine escreve um bloco ```grafico com um JSON pequeno e o chat desenha o
 * gráfico de verdade (src/chat/MineChart.tsx): barras, linhas, área, pizza,
 * rosca e dispersão, com legenda, dica no hover e tabela. Dado nunca vira
 * desenho de modelo de imagem — número desenhado por IA sai embaralhado.
 *
 * Este arquivo só lê e normaliza a especificação; é puro para ter teste.
 *
 * Formato (chaves em português, que é como a Mine pensa a resposta):
 * {
 *   "tipo": "barras" | "barras-horizontais" | "linhas" | "area" | "pizza" | "rosca" | "dispersao",
 *   "titulo": "População do Brasil",
 *   "eixoX": "Ano", "eixoY": "Milhões de pessoas", "unidade": "mi",
 *   "rotulos": ["2000", "2010", "2022"],
 *   "series": [{ "nome": "Brasil", "valores": [170, 191, 203] }],
 *   "empilhado": false,
 *   "fonte": "IBGE"
 * }
 * Linhas e dispersão também aceitam pontos (x numérico): "series": [{ "nome": "y = x²", "pontos": [[-2, 4], [0, 0], [2, 4]] }].
 */

const KIND_ALIASES = {
  barras: "bar",
  barra: "bar",
  colunas: "bar",
  coluna: "bar",
  bar: "bar",
  bars: "bar",
  column: "bar",
  "barras-horizontais": "hbar",
  "barras horizontais": "hbar",
  horizontal: "hbar",
  hbar: "hbar",
  linhas: "line",
  linha: "line",
  line: "line",
  funcao: "line",
  função: "line",
  area: "area",
  área: "area",
  pizza: "pie",
  setores: "pie",
  pie: "pie",
  rosca: "donut",
  donut: "donut",
  dispersao: "scatter",
  dispersão: "scatter",
  pontos: "scatter",
  scatter: "scatter",
};

export const CHART_KINDS = ["bar", "hbar", "line", "area", "pie", "donut", "scatter"];

const MAX_SERIES = 8;
const MAX_LABELS = 60;
const MAX_POINTS = 600;

function text(value, max = 120) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** "1.234,5" (pt-BR), "1,234.5", "12%" e "R$ 3,50" viram número; o resto, null. */
export function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let raw = value.replace(/[^\d,.\-−+eE]/g, "").replace("−", "-");
  if (!raw || !/\d/.test(raw)) return null;
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  if (comma > -1 && dot > -1) raw = comma > dot ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  else if (comma > -1) raw = /,\d{3}$/.test(raw) && raw.split(",").length > 2 ? raw.replace(/,/g, "") : raw.replace(",", ".");
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

/** JSON escrito por modelo: aceita vírgula sobrando e comentário de linha. */
function parseLooseJson(source) {
  const body = String(source || "").trim();
  try {
    return JSON.parse(body);
  } catch {
    const relaxed = body
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/([{,]\s*)([A-Za-zÀ-ÿ_][\wÀ-ÿ-]*)\s*:/g, '$1"$2":');
    return JSON.parse(relaxed);
  }
}

function pick(object, ...keys) {
  for (const key of keys) if (object?.[key] !== undefined) return object[key];
  return undefined;
}

/**
 * Lê o bloco. Devolve `{ chart }` ou `{ error }` com uma frase para a tela —
 * um JSON quebrado mostra o código cru com o aviso, nunca some.
 */
export function parseChartSpec(source) {
  let spec;
  try {
    spec = parseLooseJson(source);
  } catch {
    return { error: "Os dados do gráfico vieram incompletos." };
  }
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) return { error: "Os dados do gráfico vieram num formato inesperado." };

  const rawKind = text(pick(spec, "tipo", "type", "kind") || "barras", 40).toLowerCase();
  const kind = KIND_ALIASES[rawKind] || KIND_ALIASES[rawKind.normalize("NFD").replace(/\p{Diacritic}/gu, "")] || "bar";

  const labels = (Array.isArray(pick(spec, "rotulos", "rótulos", "labels", "categorias", "x")) ? pick(spec, "rotulos", "rótulos", "labels", "categorias", "x") : [])
    .slice(0, MAX_LABELS)
    .map((label) => text(label, 48));

  let rawSeries = pick(spec, "series", "séries", "dados", "data", "datasets");
  // Uma série só, escrita direto como "valores".
  if (!Array.isArray(rawSeries) && Array.isArray(pick(spec, "valores", "values"))) {
    rawSeries = [{ nome: pick(spec, "nome", "name") || "", valores: pick(spec, "valores", "values") }];
  }
  if (!Array.isArray(rawSeries) || !rawSeries.length) return { error: "O gráfico veio sem dados." };

  const series = [];
  for (const [index, raw] of rawSeries.slice(0, MAX_SERIES).entries()) {
    const name = text(pick(raw, "nome", "name", "label", "rotulo") || (rawSeries.length > 1 ? `Série ${index + 1}` : ""), 60);
    const rawPoints = pick(raw, "pontos", "points", "xy");
    if (Array.isArray(rawPoints)) {
      const points = rawPoints
        .slice(0, MAX_POINTS)
        .map((point) => (Array.isArray(point) ? [toNumber(point[0]), toNumber(point[1])] : [toNumber(point?.x), toNumber(point?.y)]))
        .filter(([x, y]) => x !== null && y !== null);
      if (points.length) series.push({ name, points });
      continue;
    }
    const values = (Array.isArray(pick(raw, "valores", "values", "data")) ? pick(raw, "valores", "values", "data") : []).slice(0, MAX_LABELS).map(toNumber);
    if (values.some((value) => value !== null)) series.push({ name, values });
  }
  if (!series.length) return { error: "O gráfico veio sem números." };

  const xy = series.some((serie) => serie.points);
  // Pontos só fazem sentido em linhas e dispersão; o resto ganha linhas.
  const finalKind = xy && !["line", "area", "scatter"].includes(kind) ? "line" : kind;
  if (xy) {
    // Misturar série de pontos com série de categorias não tem eixo comum.
    const pointsOnly = series.filter((serie) => serie.points);
    return { chart: base(spec, finalKind, [], pointsOnly, true) };
  }

  // Categorias: os rótulos dão o comprimento; sem rótulos, 1, 2, 3...
  const length = Math.max(labels.length, ...series.map((serie) => serie.values.length));
  const fullLabels = Array.from({ length }, (_, index) => labels[index] || String(index + 1));
  const padded = series.map((serie) => ({ ...serie, values: Array.from({ length }, (_, index) => serie.values[index] ?? null) }));

  if (finalKind === "pie" || finalKind === "donut") {
    // Pizza é uma série; fatia negativa ou nula não existe.
    const only = padded[0];
    const slices = fullLabels
      .map((label, index) => ({ label, value: only.values[index] }))
      .filter((slice) => slice.value !== null && slice.value > 0);
    if (!slices.length) return { error: "O gráfico de pizza precisa de valores positivos." };
    return { chart: { ...base(spec, finalKind, slices.map((slice) => slice.label), [{ name: only.name, values: slices.map((slice) => slice.value) }], false) } };
  }
  return { chart: base(spec, finalKind, fullLabels, padded, false) };
}

function base(spec, kind, labels, series, xy) {
  return {
    kind,
    xy,
    title: text(pick(spec, "titulo", "título", "title"), 120),
    subtitle: text(pick(spec, "subtitulo", "subtítulo", "subtitle", "descricao"), 160),
    xLabel: text(pick(spec, "eixoX", "eixo_x", "xLabel", "xlabel"), 60),
    yLabel: text(pick(spec, "eixoY", "eixo_y", "yLabel", "ylabel"), 60),
    unit: text(pick(spec, "unidade", "unit"), 12),
    source: text(pick(spec, "fonte", "source"), 120),
    stacked: Boolean(pick(spec, "empilhado", "stacked")) && (kind === "bar" || kind === "hbar" || kind === "area") && series.length > 1,
    labels,
    series,
  };
}

/** Escala "bonita": 0, 50, 100, 150 em vez de 0, 47, 94. */
export function niceTicks(min, max, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    const pad = Math.abs(min) || 1;
    min -= pad;
    max += pad;
  }
  const span = max - min;
  const rough = span / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((candidate) => span / candidate <= count) || 10 * power;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks = [];
  for (let value = start; value <= end + step / 2; value += step) ticks.push(Number(value.toPrecision(12)));
  return ticks;
}

/** Número no jeito brasileiro, com a unidade: "1.234,5 mi", "R$ 3,50", "42%". */
export function formatValue(value, unit = "", { compact = false } = {}) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const options = compact && Math.abs(value) >= 10_000 ? { notation: "compact", maximumFractionDigits: 1 } : { maximumFractionDigits: Math.abs(value) < 10 ? 2 : 1 };
  const number = new Intl.NumberFormat("pt-BR", options).format(value);
  if (!unit) return number;
  if (/^(?:R\$|US\$|\$|€|£)$/.test(unit)) return `${unit} ${number}`;
  if (unit === "%" || unit === "°" || unit === "°C") return `${number}${unit}`;
  return `${number} ${unit}`;
}

/** CSV (ponto e vírgula, como o Excel brasileiro abre) para o botão de copiar. */
export function chartToCsv(chart) {
  const escape = (value) => (/[;"\n]/.test(String(value)) ? `"${String(value).replace(/"/g, '""')}"` : String(value));
  const number = (value) => (value === null || value === undefined ? "" : String(value).replace(".", ","));
  if (chart.xy) {
    const rows = [["série", chart.xLabel || "x", chart.yLabel || "y"]];
    for (const serie of chart.series) for (const [x, y] of serie.points) rows.push([serie.name, number(x), number(y)]);
    return rows.map((row) => row.map(escape).join(";")).join("\n");
  }
  const rows = [[chart.xLabel || "", ...chart.series.map((serie) => serie.name || chart.yLabel || "valor")]];
  chart.labels.forEach((label, index) => rows.push([label, ...chart.series.map((serie) => number(serie.values[index]))]));
  return rows.map((row) => row.map(escape).join(";")).join("\n");
}

/**
 * SVG que a Mine desenhou (esquema, figura geométrica, diagrama). Vai para um
 * <img>, que não roda script nem busca arquivo de fora; aqui só garantimos que
 * é um <svg> fechado e com o xmlns que o <img> exige.
 */
export function prepareSvg(source) {
  const code = String(source || "").trim();
  const start = code.search(/<svg[\s>]/i);
  const end = code.toLowerCase().lastIndexOf("</svg>");
  if (start < 0 || end < start) return "";
  let svg = code.slice(start, end + 6);
  if (svg.length > 200_000) return "";
  svg = svg
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  if (!/^<svg[^>]*\sxmlns\s*=/i.test(svg)) svg = svg.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return svg;
}
