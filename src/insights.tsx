import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useSoftMotion, ease } from "./motion";

/**
 * Camada de dados da home: gráficos pequenos, lidos de perto e sem biblioteca.
 *
 * Regras que valem para tudo aqui:
 *  - cor nunca é a única informação — todo item traz número ou rótulo junto;
 *  - todo elemento hoverável tem `title` (funciona no toque via foco/leitor);
 *  - com "menos movimento" ativo, as barras já nascem no valor final.
 */

export type SessionLike = { id: string; subjectId: string; title: string; kind: string; createdAt: number };

const DAY = 86400000;

function startOfDay(ms: number) {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Sessões por dia, indexadas pelo timestamp da meia-noite local. */
function countByDay(sessions: SessionLike[]) {
  const map = new Map<number, number>();
  for (const session of sessions) {
    const key = startOfDay(session.createdAt);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

/**
 * Minutos de foco acumulados. A duração só existe dentro do título gravado
 * pela sessão de foco ("Sessão de foco (25 min)"), então é de lá que ela sai.
 */
export function focusMinutes(sessions: SessionLike[]) {
  return sessions.reduce((total, session) => {
    if (session.kind !== "Foco") return total;
    const match = /\((\d+)\s*min\)/.exec(session.title);
    return total + (match ? Number(match[1]) : 25);
  }, 0);
}

/** Formata minutos como "1h20" / "45 min". */
export function humanMinutes(total: number) {
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}

/* ------------------------------------------------------- mapa de consistência */

const WEEK_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function ConsistencyHeatmap({ sessions, weeks = 14 }: { sessions: SessionLike[]; weeks?: number }) {
  const cells = useMemo(() => {
    const counts = countByDay(sessions);
    const now = startOfDay(Date.now());
    const sunday = now - new Date(now).getDay() * DAY;
    const first = sunday - (weeks - 1) * 7 * DAY;
    return Array.from({ length: weeks * 7 }, (_, index) => {
      const time = first + index * DAY;
      return { time, count: counts.get(time) || 0, future: time > now, today: time === now };
    });
  }, [sessions, weeks]);

  const active = cells.filter((cell) => cell.count > 0).length;
  const past = cells.filter((cell) => !cell.future).length;

  return (
    <div>
      <div className="flex gap-1.5">
        <div className="flex shrink-0 flex-col gap-[3px] pt-[1px]">
          {WEEK_LABELS.map((label, index) => (
            <span
              key={index}
              aria-hidden
              className="grid h-[11px] w-3 place-items-center text-[8px] font-black leading-none text-white/25"
            >
              {index % 2 ? label : ""}
            </span>
          ))}
        </div>

        {/* rola dentro do próprio card em telas estreitas — a página nunca
            ganha rolagem horizontal por causa do mapa */}
        <div className="minerva-scroll min-w-0 flex-1 overflow-x-auto pb-1">
          <div
            className="grid w-max grid-flow-col gap-[3px]"
            style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))" }}
            role="img"
            aria-label={`Mapa de consistência: ${active} dias com estudo nas últimas ${weeks} semanas.`}
          >
            {cells.map((cell) => (
              <span
                key={cell.time}
                title={`${new Date(cell.time).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} · ${
                  cell.future ? "ainda não chegou" : `${cell.count} ${cell.count === 1 ? "sessão" : "sessões"}`
                }`}
                className={`h-[11px] w-[11px] rounded-[2px] transition-colors duration-200 ${heatClass(cell.count, cell.future)} ${
                  cell.today ? "ring-1 ring-mint/70" : ""
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[10px] font-bold text-white/35">
        <span className="tabular">
          {active} de {past} dias com estudo
        </span>
        <span className="flex items-center gap-1">
          menos
          <span className="h-[9px] w-[9px] rounded-[2px] bg-white/[0.06]" />
          <span className="h-[9px] w-[9px] rounded-[2px] bg-mint/25" />
          <span className="h-[9px] w-[9px] rounded-[2px] bg-mint/50" />
          <span className="h-[9px] w-[9px] rounded-[2px] bg-mint/75" />
          <span className="h-[9px] w-[9px] rounded-[2px] bg-mint" />
          mais
        </span>
      </div>
    </div>
  );
}

function heatClass(count: number, future: boolean) {
  if (future) return "bg-white/[0.02]";
  if (!count) return "bg-white/[0.06]";
  if (count === 1) return "bg-mint/25";
  if (count === 2) return "bg-mint/50";
  if (count <= 4) return "bg-mint/75";
  return "bg-mint shadow-glowSoft";
}

/* ------------------------------------------------------------ ritmo recente */

export function ActivityChart({ sessions, days = 14 }: { sessions: SessionLike[]; days?: number }) {
  const reduced = useSoftMotion();
  const bars = useMemo(() => {
    const counts = countByDay(sessions);
    const now = startOfDay(Date.now());
    return Array.from({ length: days }, (_, index) => {
      const time = now - (days - 1 - index) * DAY;
      return { time, count: counts.get(time) || 0 };
    });
  }, [sessions, days]);

  const peak = Math.max(1, ...bars.map((bar) => bar.count));
  const total = bars.reduce((sum, bar) => sum + bar.count, 0);

  return (
    <div>
      <div className="flex h-28 items-end gap-[3px]">
        {bars.map((bar, index) => {
          const height = bar.count ? Math.max(9, (bar.count / peak) * 100) : 4;
          const label = new Date(bar.time).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
          return (
            <div
              key={bar.time}
              title={`${label} · ${bar.count} ${bar.count === 1 ? "sessão" : "sessões"}`}
              className="group relative flex h-full flex-1 items-end"
            >
              <motion.div
                className={`w-full rounded-[3px] ${
                  bar.count ? "bg-gradient-to-t from-mintDeep via-mint to-cyanGlow" : "bg-white/[0.07]"
                }`}
                initial={reduced ? false : { height: "4%" }}
                animate={{ height: `${height}%` }}
                transition={{ duration: 0.7, delay: Math.min(index * 0.03, 0.3), ease: ease.out }}
              />
              <span className="pointer-events-none absolute -top-6 left-1/2 z-10 -translate-x-1/2 rounded bg-black/90 px-1.5 py-0.5 text-[10px] font-black tabular text-mint opacity-0 transition-opacity group-hover:opacity-100">
                {bar.count}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-white/35">
        <span>{days} dias</span>
        <span className="tabular">{total} sessões no período</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- mistura de sessões */

const MIX_TONES: Record<string, string> = {
  Foco: "#34D399",
  Mine: "#38BDF8",
  Prova: "#FBBF24",
  Revisão: "#A78BFA",
};

export function SessionMix({ sessions }: { sessions: SessionLike[] }) {
  const slices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of sessions) {
      const key = session.kind || "Outros";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([kind, count]) => ({ kind, count, color: MIX_TONES[kind] || "#94A3B8" }))
      .sort((a, b) => b.count - a.count);
  }, [sessions]);

  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  const size = 132;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  if (!total) {
    return (
      <p className="py-8 text-center text-[13px] font-bold text-white/35">
        Nenhuma sessão registrada ainda. Toda sessão de foco, simulado ou conversa com a Mine aparece aqui.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={`${total} sessões distribuídas por tipo.`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={stroke} />
          {slices.map((slice) => {
            const portion = slice.count / total;
            const dash = portion * circumference;
            const element = (
              <circle
                key={slice.kind}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(dash - 3, 1)} ${circumference}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 6px ${slice.color}55)` }}
              />
            );
            offset += dash;
            return element;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-2xl font-black leading-none tabular">{total}</p>
            <p className="text-[9px] font-black uppercase tracking-[.16em] text-white/40">sessões</p>
          </div>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-2">
        {slices.map((slice) => (
          <li key={slice.kind} className="flex items-center gap-2.5">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-white/70">{slice.kind}</span>
            <span className="shrink-0 text-[13px] font-black tabular">{slice.count}</span>
            <span className="w-10 shrink-0 text-right text-[11px] font-bold tabular text-white/38">
              {Math.round((slice.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------ domínio por matéria */

export type MasteryRow = { id: string; name: string; color: string; done: number; total: number };

export function MasteryBars({ rows, onSelect }: { rows: MasteryRow[]; onSelect?: (id: string) => void }) {
  const reduced = useSoftMotion();

  if (!rows.length) {
    return <p className="py-6 text-center text-[13px] font-bold text-white/35">Crie uma matéria para acompanhar o domínio de cada uma.</p>;
  }

  return (
    <ul className="space-y-3">
      {rows.map((row, index) => {
        const pct = row.total ? Math.round((row.done / row.total) * 100) : 0;
        return (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onSelect?.(row.id)}
              className="group w-full rounded-lg px-1 py-1 text-left transition-colors hover:bg-white/[0.04]"
            >
              <div className="flex items-baseline gap-2">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-black">{row.name}</span>
                <span className="shrink-0 text-[11px] font-bold tabular text-white/45">
                  {row.done}/{row.total}
                </span>
                <span className="w-9 shrink-0 text-right text-[13px] font-black tabular" style={{ color: row.color }}>
                  {pct}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${row.color}, #38BDF8)` }}
                  initial={reduced ? false : { width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.85, delay: Math.min(index * 0.06, 0.4), ease: ease.out }}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* --------------------------------------------------------------- linha viva */

/** Sparkline em SVG: tendência de N dias, sem eixo — serve de contexto, não de leitura exata. */
export function Sparkline({ values, color = "#34D399", height = 34 }: { values: number[]; color?: string; height?: number }) {
  if (values.length < 2) return null;
  const peak = Math.max(1, ...values);
  const width = 100;
  const step = width / (values.length - 1);
  const points = values.map((value, index) => [index * step, height - (value / peak) * (height - 4) - 2]);
  const line = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const id = `spark-${color.replace("#", "")}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ---------------------------------------------------------------- stat tile */

export function StatTile({
  label,
  value,
  detail,
  accent = "#34D399",
  spark,
  onClick,
}: {
  label: string;
  value: string | number;
  detail?: string;
  accent?: string;
  spark?: number[];
  onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      {...(onClick ? { type: "button" as const, onClick } : {})}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      className={`card-motion-surface depth-panel relative flex h-full min-h-[6.5rem] w-full flex-col justify-between overflow-hidden rounded-lg border border-white/10 bg-black/40 p-3.5 text-left transition-colors duration-300 ${
        onClick ? "hover:border-white/25" : ""
      }`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-2xl transition-opacity duration-500"
        style={{ background: accent, opacity: hover ? 0.28 : 0.12 }}
      />
      <p className="relative text-[10px] font-black uppercase tracking-[.16em] text-white/40">{label}</p>
      <p className="relative mt-1 font-display text-[1.7rem] font-black leading-none tabular" style={{ color: accent }}>
        {value}
      </p>
      {detail ? <p className="relative mt-1 truncate text-[11px] font-bold text-white/45">{detail}</p> : null}
      {spark && spark.length > 1 ? (
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-9 opacity-70">
          <Sparkline values={spark} color={accent} />
        </span>
      ) : null}
    </Wrapper>
  );
}

/** Contagem de sessões por dia, do mais antigo ao mais recente — alimenta o Sparkline. */
export function dailySeries(sessions: SessionLike[], days = 14) {
  const counts = countByDay(sessions);
  const now = startOfDay(Date.now());
  return Array.from({ length: days }, (_, index) => counts.get(now - (days - 1 - index) * DAY) || 0);
}
