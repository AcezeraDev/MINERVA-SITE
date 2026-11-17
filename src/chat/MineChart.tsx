import React, { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Check, Copy, Download, Shapes, Table2 } from "lucide-react";
import { chartToCsv, formatValue, niceTicks, parseChartSpec, prepareSvg, type Chart } from "../../shared/chart-spec.mjs";
import "./mine-chart.css";

/*
 * Gráfico e figura desenhados pela Mine (nov/2026).
 *
 * ```grafico  -> MineChart: barras, linhas, área, pizza, rosca, dispersão.
 * ```svg      -> MineSvgFigure: esquema, figura geométrica, diagrama.
 *
 * As cores vêm da paleta categórica validada (8 tons, ordem fixa, versões
 * próprias para o caderno de dia e à noite, conferidas para daltonismo contra
 * o fundo do cartão). Elas vão como cor literal no SVG — não variável CSS —
 * para o "Baixar PNG" sair igual à tela.
 */

const PALETTE = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9", "#e66767"],
};

const INK = {
  light: { surface: "#ffffff", text: "#16181d", muted: "#5a6272", grid: "#e3e8ef", axis: "#b9c3d1" },
  dark: { surface: "#1a2030", text: "#e8ecf4", muted: "#9aa3b6", grid: "#2a3550", axis: "#43517a" },
};

type Theme = "light" | "dark";

function readTheme(): Theme {
  return typeof document !== "undefined" && document.documentElement.classList.contains("theme-light") ? "light" : "dark";
}

/** O tema do Minerva é uma classe no <html>; troca sem recarregar a página. */
function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(560);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(240, Math.round(element.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setDone(false), 1600);
    return () => window.clearTimeout(timer);
  }, [done]);
  return (
    <button
      type="button"
      className="mviz-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
        } catch {
          // área de transferência bloqueada
        }
      }}
    >
      {done ? <Check aria-hidden /> : <Copy aria-hidden />}
      <span>{done ? "Copiado" : label}</span>
    </button>
  );
}

function fileSlug(title: string, fallback: string) {
  return (
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || fallback
  );
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** SVG na tela -> PNG em 2x, com o título por cima e o fundo do cartão. */
async function svgToPng(svg: SVGSVGElement, { title, surface, text }: { title: string; surface: string; text: string }) {
  const width = svg.viewBox.baseVal.width || svg.clientWidth;
  const height = svg.viewBox.baseVal.height || svg.clientHeight;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("font-family", "Inter, system-ui, sans-serif");
  const data = new XMLSerializer().serializeToString(clone);
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`;
  await image.decode();
  const scale = 2;
  const head = title ? 40 : 12;
  const canvas = document.createElement("canvas");
  canvas.width = (width + 24) * scale;
  canvas.height = (height + head + 12) * scale;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(scale, scale);
  context.fillStyle = surface;
  context.fillRect(0, 0, width + 24, height + head + 12);
  if (title) {
    context.fillStyle = text;
    context.font = "600 16px Inter, system-ui, sans-serif";
    context.fillText(title, 12, 26);
  }
  context.drawImage(image, 12, head, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (blob) downloadBlob(blob, `${fileSlug(title, "grafico")}.png`);
}

// ---------------------------------------------------------------------------
// Geometria

/** Barra com só a ponta arredondada (a base fica reta, presa no eixo). */
function barPath(x: number, y: number, w: number, h: number, r: number, horizontal: boolean, negative: boolean) {
  const radius = Math.max(0, Math.min(r, (horizontal ? h : w) / 2, horizontal ? w : h));
  if (!horizontal) {
    if (h <= 0) return "";
    if (!negative) return `M${x},${y + h}V${y + radius}Q${x},${y} ${x + radius},${y}H${x + w - radius}Q${x + w},${y} ${x + w},${y + radius}V${y + h}Z`;
    return `M${x},${y}V${y + h - radius}Q${x},${y + h} ${x + radius},${y + h}H${x + w - radius}Q${x + w},${y + h} ${x + w},${y + h - radius}V${y}Z`;
  }
  if (w <= 0) return "";
  if (!negative) return `M${x},${y}H${x + w - radius}Q${x + w},${y} ${x + w},${y + radius}V${y + h - radius}Q${x + w},${y + h} ${x + w - radius},${y + h}H${x}Z`;
  return `M${x + w},${y}H${x + radius}Q${x},${y} ${x},${y + radius}V${y + h - radius}Q${x},${y + h} ${x + radius},${y + h}H${x + w}Z`;
}

function arcPath(cx: number, cy: number, outer: number, inner: number, start: number, end: number) {
  const sweep = end - start;
  if (sweep >= Math.PI * 2 - 1e-6) end = start + Math.PI * 2 - 1e-4;
  const large = end - start > Math.PI ? 1 : 0;
  const p = (radius: number, angle: number) => `${cx + radius * Math.sin(angle)},${cy - radius * Math.cos(angle)}`;
  if (inner <= 0) return `M${cx},${cy}L${p(outer, start)}A${outer},${outer} 0 ${large} 1 ${p(outer, end)}Z`;
  return `M${p(outer, start)}A${outer},${outer} 0 ${large} 1 ${p(outer, end)}L${p(inner, end)}A${inner},${inner} 0 ${large} 0 ${p(inner, start)}Z`;
}

function truncate(label: string, maxChars: number) {
  if (label.length <= maxChars) return label;
  return `${label.slice(0, Math.max(1, maxChars - 1))}…`;
}

const CHAR_PX = 6.6;

type Tip = { x: number; y: number; title: string; rows: Array<{ color?: string; name: string; value: string }> };

// ---------------------------------------------------------------------------
// Plotagens

type PlotProps = { chart: Chart; width: number; theme: Theme; colors: string[]; onTip: (tip: Tip | null) => void; svgRef: React.Ref<SVGSVGElement> };

function CartesianPlot({ chart, width, theme, colors, onTip, svgRef }: PlotProps) {
  const ink = INK[theme];
  const narrow = width < 440;
  const height = narrow ? 250 : 300;
  const horizontal = chart.kind === "hbar";
  const categorical = !chart.xy;
  const labels = chart.labels;
  const count = labels.length;

  // Domínio do valor (y; no horizontal, x).
  const values: number[] = [];
  if (chart.xy) {
    for (const serie of chart.series) for (const [, y] of serie.points || []) values.push(y);
  } else if (chart.stacked) {
    for (let index = 0; index < count; index += 1) {
      let up = 0;
      let down = 0;
      for (const serie of chart.series) {
        const value = serie.values?.[index] ?? 0;
        if (value >= 0) up += value;
        else down += value;
      }
      values.push(up, down);
    }
  } else {
    for (const serie of chart.series) for (const value of serie.values || []) if (value !== null) values.push(value);
  }
  const barLike = chart.kind === "bar" || chart.kind === "hbar" || chart.kind === "area";
  let low = Math.min(...values);
  let high = Math.max(...values);
  if (barLike) {
    low = Math.min(0, low);
    high = Math.max(0, high);
  }
  const ticks = niceTicks(low, high, narrow ? 4 : 5);
  const vMin = ticks[0];
  const vMax = ticks[ticks.length - 1];

  // Domínio do x numérico (pontos).
  let xTicks: number[] = [];
  let xMin = 0;
  let xMax = 1;
  if (chart.xy) {
    const xs = chart.series.flatMap((serie) => (serie.points || []).map(([x]) => x));
    xTicks = niceTicks(Math.min(...xs), Math.max(...xs), narrow ? 4 : 6);
    xMin = xTicks[0];
    xMax = xTicks[xTicks.length - 1];
  }

  const tickText = ticks.map((tick) => formatValue(tick, chart.unit, { compact: true }));
  const longestTick = Math.max(...tickText.map((label) => label.length));
  const longestLabel = Math.max(0, ...labels.map((label) => label.length));
  const left = horizontal ? Math.min(width * 0.38, 16 + Math.min(longestLabel, 22) * CHAR_PX) : 14 + longestTick * CHAR_PX + (chart.yLabel ? 16 : 0);
  const bottom = 30 + (chart.xLabel ? 18 : 0);
  const top = 14;
  const right = 18;
  const plotW = Math.max(40, width - left - right);
  const plotH = Math.max(60, height - top - bottom);

  const valueScale = (value: number) => (horizontal ? left + ((value - vMin) / (vMax - vMin || 1)) * plotW : top + plotH - ((value - vMin) / (vMax - vMin || 1)) * plotH);
  const band = (horizontal ? plotH : plotW) / Math.max(1, count);
  const bandStart = (index: number) => (horizontal ? top : left) + index * band;
  const pointX = (index: number) => (count <= 1 ? left + plotW / 2 : left + (chart.kind === "line" || chart.kind === "area" ? (index / (count - 1)) * plotW : bandStart(index) - left + band / 2));
  const xScale = (x: number) => left + ((x - xMin) / (xMax - xMin || 1)) * plotW;

  // Rótulos de categoria: pula quando não cabem, corta quando são longos.
  const maxLabelChars = horizontal ? Math.max(4, Math.floor((left - 12) / CHAR_PX)) : Math.max(3, Math.floor((band - 4) / CHAR_PX));
  const every = horizontal ? Math.max(1, Math.ceil(14 / band)) : Math.max(1, Math.ceil((Math.min(longestLabel, 10) * CHAR_PX + 8) / band));

  const zero = valueScale(Math.max(vMin, Math.min(vMax, 0)));
  const nodes: React.ReactNode[] = [];

  // Grade e eixo de valores.
  ticks.forEach((tick, index) => {
    const position = valueScale(tick);
    nodes.push(
      horizontal ? (
        <g key={`t${index}`}>
          <line x1={position} x2={position} y1={top} y2={top + plotH} stroke={ink.grid} strokeWidth={1} />
          <text x={position} y={top + plotH + 16} textAnchor="middle" fontSize={11} fill={ink.muted}>{tickText[index]}</text>
        </g>
      ) : (
        <g key={`t${index}`}>
          <line x1={left} x2={left + plotW} y1={position} y2={position} stroke={ink.grid} strokeWidth={1} />
          <text x={left - 8} y={position + 4} textAnchor="end" fontSize={11} fill={ink.muted}>{tickText[index]}</text>
        </g>
      ),
    );
  });
  if (chart.xy) {
    xTicks.forEach((tick, index) => {
      const position = xScale(tick);
      nodes.push(
        <g key={`xt${index}`}>
          <line x1={position} x2={position} y1={top} y2={top + plotH} stroke={ink.grid} strokeWidth={1} strokeDasharray="2 4" />
          <text x={position} y={top + plotH + 16} textAnchor="middle" fontSize={11} fill={ink.muted}>{formatValue(tick, "", { compact: true })}</text>
        </g>,
      );
    });
    // Eixo y = 0 quando ele está dentro do gráfico (gráfico de função).
    if (xMin < 0 && xMax > 0) nodes.push(<line key="x0" x1={xScale(0)} x2={xScale(0)} y1={top} y2={top + plotH} stroke={ink.axis} strokeWidth={1.2} />);
  }
  // Linha do zero.
  nodes.push(
    horizontal ? (
      <line key="zero" x1={zero} x2={zero} y1={top} y2={top + plotH} stroke={ink.axis} strokeWidth={1.2} />
    ) : (
      <line key="zero" x1={left} x2={left + plotW} y1={zero} y2={zero} stroke={ink.axis} strokeWidth={1.2} />
    ),
  );

  // Rótulos de categoria.
  if (categorical) {
    labels.forEach((label, index) => {
      if (index % every !== 0) return;
      nodes.push(
        horizontal ? (
          <text key={`l${index}`} x={left - 8} y={bandStart(index) + band / 2 + 4} textAnchor="end" fontSize={11.5} fill={ink.muted}>
            <title>{label}</title>
            {truncate(label, maxLabelChars)}
          </text>
        ) : (
          <text key={`l${index}`} x={pointX(index)} y={top + plotH + 17} textAnchor="middle" fontSize={11.5} fill={ink.muted}>
            <title>{label}</title>
            {truncate(label, Math.max(maxLabelChars * every, 4))}
          </text>
        ),
      );
    });
  }

  // Títulos dos eixos.
  if (chart.xLabel) nodes.push(<text key="xl" x={left + plotW / 2} y={height - 6} textAnchor="middle" fontSize={11.5} fontWeight={600} fill={ink.muted}>{horizontal ? chart.yLabel || chart.xLabel : chart.xLabel}</text>);
  if (chart.yLabel && !horizontal) nodes.push(<text key="yl" transform={`translate(12 ${top + plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={11.5} fontWeight={600} fill={ink.muted}>{chart.yLabel}</text>);

  const tipRowsAt = (index: number) =>
    chart.series.map((serie, serieIndex) => ({ color: colors[serieIndex], name: serie.name || chart.yLabel || "Valor", value: formatValue(serie.values?.[index] ?? null, chart.unit) }));

  // Ponto mais alto da categoria: a dica nasce ali, em cima da barra ou do ponto.
  const peakAt = (index: number) => {
    let total = 0;
    let best = Infinity;
    for (const serie of chart.series) {
      const value = serie.values?.[index];
      if (value === null || value === undefined) continue;
      total += value;
      best = Math.min(best, valueScale(chart.stacked ? total : barLike ? Math.max(value, 0) : value));
    }
    return Number.isFinite(best) ? best : top + plotH / 2;
  };

  // Marcas.
  if (chart.kind === "bar" || chart.kind === "hbar") {
    const seriesCount = chart.series.length;
    const groupW = band * (count > 16 ? 0.86 : 0.72);
    const gap = 2;
    const barW = chart.stacked ? groupW : Math.max(1, (groupW - gap * (seriesCount - 1)) / seriesCount);
    for (let index = 0; index < count; index += 1) {
      let up = 0;
      let down = 0;
      chart.series.forEach((serie, serieIndex) => {
        const value = serie.values?.[index];
        if (value === null || value === undefined) return;
        let from = 0;
        let to = value;
        if (chart.stacked) {
          from = value >= 0 ? up : down;
          to = from + value;
          if (value >= 0) up = to;
          else down = to;
        }
        const a = valueScale(from);
        const b = valueScale(to);
        const offset = (band - groupW) / 2 + (chart.stacked ? 0 : serieIndex * (barW + gap));
        const isTop = !chart.stacked || serieIndex === chart.series.length - 1 || chart.series.slice(serieIndex + 1).every((next) => !next.values?.[index]);
        const radius = isTop ? Math.min(4, barW / 3) : 0;
        const d = horizontal
          ? barPath(Math.min(a, b), bandStart(index) + offset, Math.abs(b - a), barW, radius, true, value < 0)
          : barPath(bandStart(index) + offset, Math.min(a, b), barW, Math.abs(b - a), radius, false, value < 0);
        if (!d) return;
        nodes.push(<path key={`b${index}-${serieIndex}`} d={d} fill={colors[serieIndex]} stroke={chart.stacked ? ink.surface : "none"} strokeWidth={chart.stacked ? 1 : 0} />);
      });
      // Alvo do hover: a faixa inteira da categoria, maior que a barra.
      nodes.push(
        <rect
          key={`h${index}`}
          x={horizontal ? left : bandStart(index)}
          y={horizontal ? bandStart(index) : top}
          width={horizontal ? plotW : band}
          height={horizontal ? band : plotH}
          fill="transparent"
          onPointerEnter={() => onTip({ x: horizontal ? left + plotW * 0.6 : bandStart(index) + band / 2, y: horizontal ? bandStart(index) + band / 2 : peakAt(index), title: labels[index], rows: tipRowsAt(index) })}
          onPointerLeave={() => onTip(null)}
        />,
      );
    }
    // Valor escrito na ponta, só quando há poucas barras (nunca em todas as de um gráfico cheio).
    if (seriesCount === 1 && count <= 12 && !chart.stacked) {
      chart.series[0].values?.forEach((value, index) => {
        if (value === null) return;
        const end = valueScale(value);
        const label = formatValue(value, chart.unit, { compact: true });
        if (horizontal) {
          if (band < 14) return;
          nodes.push(<text key={`v${index}`} x={end + (value >= 0 ? 6 : -6)} y={bandStart(index) + band / 2 + 4} textAnchor={value >= 0 ? "start" : "end"} fontSize={11} fontWeight={600} fill={ink.text}>{label}</text>);
        } else {
          if (label.length * CHAR_PX > band) return;
          nodes.push(<text key={`v${index}`} x={bandStart(index) + band / 2} y={end + (value >= 0 ? -6 : 14)} textAnchor="middle" fontSize={11} fontWeight={600} fill={ink.text}>{label}</text>);
        }
      });
    }
  }

  if (chart.kind === "line" || chart.kind === "area" || chart.kind === "scatter") {
    const showMarkers = chart.kind === "scatter" || (chart.xy ? chart.series.every((serie) => (serie.points?.length || 0) <= 30) : count <= 24);
    const stackBase = new Array(count).fill(0);
    chart.series.forEach((serie, serieIndex) => {
      const color = colors[serieIndex];
      const coords: Array<[number, number] | null> = chart.xy
        ? (serie.points || []).slice().sort((a, b) => a[0] - b[0]).map(([x, y]) => [xScale(x), valueScale(y)])
        : (serie.values || []).map((value, index) => {
            if (value === null) return null;
            const base = chart.stacked ? stackBase[index] : 0;
            if (chart.stacked) stackBase[index] += value;
            return [pointX(index), valueScale(base + value)];
          });
      if (chart.kind !== "scatter") {
        // Linha quebra onde falta valor, em vez de inventar a ligação.
        let d = "";
        let pen = false;
        for (const point of coords) {
          if (!point) {
            pen = false;
            continue;
          }
          d += `${pen ? "L" : "M"}${point[0].toFixed(1)},${point[1].toFixed(1)}`;
          pen = true;
        }
        if (chart.kind === "area") {
          const valid = coords.filter(Boolean) as Array<[number, number]>;
          if (valid.length > 1) {
            const area = `M${valid[0][0]},${zero}${valid.map(([x, y]) => `L${x},${y}`).join("")}L${valid[valid.length - 1][0]},${zero}Z`;
            nodes.push(<path key={`a${serieIndex}`} d={area} fill={color} fillOpacity={chart.series.length > 1 ? 0.18 : 0.24} />);
          }
        }
        nodes.push(<path key={`p${serieIndex}`} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />);
      }
      if (showMarkers) {
        coords.forEach((point, index) => {
          if (!point) return;
          const rows = chart.xy
            ? [{ color, name: serie.name || chart.yLabel || "y", value: formatValue(serie.points?.slice().sort((a, b) => a[0] - b[0])[index]?.[1] ?? null, chart.unit) }]
            : tipRowsAt(index);
          const title = chart.xy ? `${chart.xLabel || "x"} = ${formatValue(serie.points?.slice().sort((a, b) => a[0] - b[0])[index]?.[0] ?? null)}` : labels[index];
          nodes.push(
            <circle
              key={`m${serieIndex}-${index}`}
              cx={point[0]}
              cy={point[1]}
              r={chart.kind === "scatter" ? 4.5 : 4}
              fill={color}
              stroke={ink.surface}
              strokeWidth={2}
              onPointerEnter={() => onTip({ x: point[0], y: point[1], title, rows })}
              onPointerLeave={() => onTip(null)}
            />,
          );
        });
      }
    });
    // Linhas categóricas: a régua vertical acompanha o mouse e mostra todas as séries.
    if (!chart.xy && chart.kind !== "scatter") {
      for (let index = 0; index < count; index += 1) {
        const x = pointX(index);
        const half = count <= 1 ? plotW / 2 : plotW / (count - 1) / 2;
        nodes.push(
          <rect
            key={`hv${index}`}
            x={x - half}
            y={top}
            width={half * 2}
            height={plotH}
            fill="transparent"
            className="mviz-hover-col"
            onPointerEnter={() => onTip({ x, y: peakAt(index), title: labels[index], rows: tipRowsAt(index) })}
            onPointerLeave={() => onTip(null)}
          />,
        );
      }
    }
  }

  return (
    <svg ref={svgRef} className="mviz-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={chart.title || "Gráfico"} fontFamily="Inter, system-ui, sans-serif">
      {nodes}
    </svg>
  );
}

function PiePlot({ chart, width, theme, colors, onTip, svgRef }: PlotProps) {
  const ink = INK[theme];
  const values = (chart.series[0]?.values || []).map((value) => value || 0);
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  const size = Math.min(width, 280);
  const height = size;
  const cx = width / 2;
  const cy = height / 2;
  const outer = size / 2 - 8;
  const inner = chart.kind === "donut" ? outer * 0.58 : 0;
  let angle = 0;
  const nodes: React.ReactNode[] = [];
  values.forEach((value, index) => {
    const start = angle;
    const end = angle + (value / total) * Math.PI * 2;
    angle = end;
    const share = value / total;
    nodes.push(
      <path
        key={`s${index}`}
        d={arcPath(cx, cy, outer, inner, start, end)}
        fill={colors[index % colors.length]}
        stroke={ink.surface}
        strokeWidth={2}
        strokeLinejoin="round"
        onPointerEnter={() => {
          const middle = (start + end) / 2;
          const radius = inner ? (outer + inner) / 2 : outer * 0.6;
          onTip({ x: cx + radius * Math.sin(middle), y: cy - radius * Math.cos(middle), title: chart.labels[index], rows: [{ color: colors[index % colors.length], name: formatValue(value, chart.unit), value: `${formatValue(share * 100, "%")}` }] });
        }}
        onPointerLeave={() => onTip(null)}
      />,
    );
    // Percentual escrito na fatia só quando ela tem espaço.
    if (share >= 0.07) {
      const middle = (start + end) / 2;
      const radius = inner ? (outer + inner) / 2 : outer * 0.64;
      nodes.push(
        <text key={`p${index}`} x={cx + radius * Math.sin(middle)} y={cy - radius * Math.cos(middle) + 4} textAnchor="middle" fontSize={11.5} fontWeight={700} fill="#ffffff" pointerEvents="none" style={{ paintOrder: "stroke" }} stroke="rgba(0,0,0,0.35)" strokeWidth={2.5}>
          {formatValue(share * 100, "%")}
        </text>,
      );
    }
  });
  // Total no meio só quando soma algo de verdade ("100%" não diz nada).
  if (inner && chart.unit !== "%") {
    nodes.push(
      <g key="center" pointerEvents="none">
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize={18} fontWeight={700} fill={ink.text}>{formatValue(total, chart.unit, { compact: true })}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize={11} fill={ink.muted}>total</text>
      </g>,
    );
  }
  return (
    <svg ref={svgRef} className="mviz-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={chart.title || "Gráfico de pizza"} fontFamily="Inter, system-ui, sans-serif">
      {nodes}
    </svg>
  );
}

function DataTable({ chart }: { chart: Chart }) {
  if (chart.xy) {
    return (
      <div className="mviz-table">
        <table>
          <thead>
            <tr>
              <th>Série</th>
              <th>{chart.xLabel || "x"}</th>
              <th>{chart.yLabel || "y"}</th>
            </tr>
          </thead>
          <tbody>
            {chart.series.flatMap((serie, serieIndex) =>
              (serie.points || []).map(([x, y], index) => (
                <tr key={`${serieIndex}-${index}`}>
                  <td>{serie.name}</td>
                  <td className="mviz-num">{formatValue(x)}</td>
                  <td className="mviz-num">{formatValue(y, chart.unit)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="mviz-table">
      <table>
        <thead>
          <tr>
            <th>{chart.xLabel || ""}</th>
            {chart.series.map((serie, index) => (
              <th key={index} className="mviz-num">{serie.name || chart.yLabel || "Valor"}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.labels.map((label, index) => (
            <tr key={index}>
              <td>{label}</td>
              {chart.series.map((serie, serieIndex) => (
                <td key={serieIndex} className="mviz-num">{formatValue(serie.values?.[index] ?? null, chart.unit)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const MineChart = memo(function MineChart({ source, fallback }: { source: string; fallback: React.ReactNode }) {
  const parsed = useMemo(() => parseChartSpec(source), [source]);
  const theme = useTheme();
  const [boxRef, width] = useWidth<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [showTable, setShowTable] = useState(false);

  if (!parsed.chart) {
    return (
      <div className="mviz-broken">
        <p className="mviz-broken__note">{parsed.error} Os dados crus estão abaixo.</p>
        {fallback}
      </div>
    );
  }
  const chart = parsed.chart;
  const pie = chart.kind === "pie" || chart.kind === "donut";
  const colors = PALETTE[theme];
  const legend = pie ? chart.labels.map((label, index) => ({ label, color: colors[index % colors.length], value: chart.series[0]?.values?.[index] ?? null })) : chart.series.length > 1 ? chart.series.map((serie, index) => ({ label: serie.name, color: colors[index], value: null })) : [];
  const Plot = pie ? PiePlot : CartesianPlot;

  return (
    <figure className="mviz" data-kind={chart.kind}>
      <figcaption className="mviz__head">
        <span className="mviz__chip">
          <BarChart3 aria-hidden />
          Gráfico
        </span>
        <span className="mviz__titles">
          {chart.title ? <strong className="mviz__title">{chart.title}</strong> : null}
          {chart.subtitle ? <span className="mviz__subtitle">{chart.subtitle}</span> : null}
        </span>
      </figcaption>
      {legend.length ? (
        <ul className="mviz__legend" aria-label="Legenda">
          {legend.map((item, index) => (
            <li key={index}>
              <i style={{ background: item.color }} aria-hidden />
              <span>{item.label}</span>
              {pie && item.value !== null ? <b>{formatValue(item.value, chart.unit, { compact: true })}</b> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mviz__plot" ref={boxRef} onPointerLeave={() => setTip(null)}>
        <Plot chart={chart} width={width} theme={theme} colors={colors} onTip={setTip} svgRef={svgRef} />
        {tip ? (
          <div className="mviz-tip" style={{ left: Math.min(Math.max(tip.x, 80), width - 80), top: Math.max(tip.y, 30 + tip.rows.length * 18) }} role="status">
            <p className="mviz-tip__title">{tip.title}</p>
            {tip.rows.map((row, index) => (
              <p key={index} className="mviz-tip__row">
                {row.color ? <i style={{ background: row.color }} aria-hidden /> : null}
                <span>{row.name}</span>
                <b>{row.value}</b>
              </p>
            ))}
          </div>
        ) : null}
      </div>
      {showTable ? <DataTable chart={chart} /> : null}
      <div className="mviz__foot">
        {chart.source ? <span className="mviz__source">Fonte: {chart.source}</span> : <span />}
        <span className="mviz__actions">
          <button type="button" className="mviz-btn" aria-pressed={showTable} onClick={() => setShowTable((value) => !value)}>
            <Table2 aria-hidden />
            <span>{showTable ? "Esconder tabela" : "Tabela"}</span>
          </button>
          <CopyButton text={chartToCsv(chart)} label="Copiar dados" />
          <button
            type="button"
            className="mviz-btn"
            onClick={() => {
              if (svgRef.current) void svgToPng(svgRef.current, { title: chart.title, surface: INK[theme].surface, text: INK[theme].text }).catch(() => undefined);
            }}
          >
            <Download aria-hidden />
            <span>PNG</span>
          </button>
        </span>
      </div>
    </figure>
  );
});

/** Figura em SVG feita pela Mine: sempre num papel claro, como desenho no caderno. */
export const MineSvgFigure = memo(function MineSvgFigure({ source, fallback }: { source: string; fallback: React.ReactNode }) {
  const svg = useMemo(() => prepareSvg(source), [source]);
  const [showCode, setShowCode] = useState(false);
  const title = useMemo(() => svg.match(/<title>([^<]{1,80})<\/title>/i)?.[1]?.trim() || "", [svg]);
  const src = useMemo(() => (svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : ""), [svg]);
  if (!svg) return <>{fallback}</>;
  return (
    <figure className="mviz mviz--figure">
      <figcaption className="mviz__head">
        <span className="mviz__chip">
          <Shapes aria-hidden />
          Esquema
        </span>
        {title ? <strong className="mviz__title">{title}</strong> : null}
      </figcaption>
      <div className="mviz__paper">
        <img src={src} alt={title || "Esquema desenhado pela Mine"} draggable={false} />
      </div>
      {showCode ? fallback : null}
      <div className="mviz__foot">
        <span />
        <span className="mviz__actions">
          <button type="button" className="mviz-btn" aria-pressed={showCode} onClick={() => setShowCode((value) => !value)}>
            <span>{showCode ? "Esconder código" : "Ver código"}</span>
          </button>
          <button type="button" className="mviz-btn" onClick={() => downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${fileSlug(title, "esquema")}.svg`)}>
            <Download aria-hidden />
            <span>SVG</span>
          </button>
        </span>
      </div>
    </figure>
  );
});
