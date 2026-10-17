import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { celebrateFrom, mineSays } from "./index";
import { playStamp } from "./sons";
import "./caderno-conquistas.css";

/**
 * Carimbo de nível: entra batendo no papel (escala grande → assenta com um
 * tremor), solta respingos e uma onda de tinta, e fica levemente torto, como
 * carimbo de professor. A tinta tem falhas (filtro de ruído no SVG, estático).
 * Clicar carimba de novo: a marca anterior fica clarinha no papel.
 */
const splats = [
  [18, 30, 3.2], [182, 44, 2.4], [170, 176, 3.6], [26, 160, 2.2], [100, 4, 2], [196, 112, 1.8], [8, 96, 2.6], [140, 196, 1.6],
] as const;

function StampArt({ level, title, arcId }: { level: number; title: string; arcId: string }) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden>
      <defs>
        <path id={arcId} d="M100 100 m-70 0 a70 70 0 1 1 140 0 a70 70 0 1 1 -140 0" />
      </defs>
      <g filter="url(#caderno-ink-rough)">
        <circle cx="100" cy="100" r="92" className="ring" />
        <circle cx="100" cy="100" r="80" className="ring thin" />
        <text className="arc">
          <textPath href={`#${arcId}`} startOffset="4%">
            {`★ ${title.toUpperCase()} ★ MINERVA `}
          </textPath>
        </text>
        <text x="100" y="92" className="lbl">NÍVEL</text>
        <text x="100" y="138" className="num">{level}</text>
      </g>
    </svg>
  );
}

export function LevelStamp({ level, title, reduced }: { level: number; title: string; reduced: boolean }) {
  // cada batida é uma impressão; as antigas ficam clarinhas por baixo
  const [hits, setHits] = useState<Array<{ id: number; rotate: number; x: number; y: number }>>([{ id: 0, rotate: -9, x: 0, y: 0 }]);
  const delay = reduced ? 0 : 0.45;
  const current = hits[hits.length - 1];

  const stampAgain = () => {
    if (reduced) return;
    playStamp();
    setHits((list) => [
      ...list.slice(-2),
      { id: list[list.length - 1].id + 1, rotate: -16 + Math.random() * 14, x: Math.random() * 10 - 5, y: Math.random() * 10 - 5 },
    ]);
  };

  return (
    <button type="button" className="caderno-stamp" onClick={stampAgain} aria-label={`Nível ${level}: ${title}. Carimbar de novo`}>
      <svg className="caderno-stamp-defs" aria-hidden>
        <filter id="caderno-ink-rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="3" result="blots" />
          <feColorMatrix in="blots" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 2.55" result="mask" />
          <feComposite in="rough" in2="mask" operator="in" />
        </filter>
      </svg>
      {hits.slice(0, -1).map((hit) => (
        <span
          key={hit.id}
          className="caderno-stamp-impression is-ghost"
          style={{ transform: `translate(${hit.x}px, ${hit.y}px) rotate(${hit.rotate}deg)` }}
        >
          <StampArt level={level} title={title} arcId={`caderno-stamp-arc-${hit.id}`} />
        </span>
      ))}
      <motion.span
        key={current.id}
        className="caderno-stamp-impression"
        initial={reduced ? false : { scale: 2.1, rotate: current.rotate - 15, opacity: 0, x: current.x, y: current.y }}
        animate={{ scale: 1, rotate: current.rotate, opacity: 1, x: current.x, y: current.y }}
        transition={reduced ? { duration: 0 } : { delay: current.id ? 0 : delay, type: "spring", stiffness: 520, damping: 16 }}
      >
        <StampArt level={level} title={title} arcId={`caderno-stamp-arc-${current.id}`} />
      </motion.span>
      {reduced ? null : (
        <React.Fragment key={`fx-${current.id}`}>
          <span className="caderno-stamp-ripple" style={{ animationDelay: `${(current.id ? 0 : delay) + 0.12}s` }} />
          <svg className="caderno-stamp-splat" viewBox="0 0 200 200" aria-hidden>
            {splats.map(([cx, cy, r], index) => (
              <circle key={index} cx={cx} cy={cy} r={r} style={{ animationDelay: `${(current.id ? 0 : delay) + 0.1 + index * 0.015}s` }} />
            ))}
          </svg>
        </React.Fragment>
      )}
      <span className="caderno-stamp-tip" aria-hidden>carimbar!</span>
    </button>
  );
}

/**
 * Gráfico da semana feito à mão: cada dia é um traço de marca-texto que sobe,
 * e uma linha de caneta liga os topos, desenhando-se depois das barras.
 */
export function InkBarChart({ bars, reduced }: { bars: Array<{ label: string; count: number }>; reduced: boolean }) {
  const peak = Math.max(1, ...bars.map((bar) => bar.count));
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(reduced);
  useEffect(() => {
    if (reduced || !ref.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [reduced]);

  const points = bars.map((bar, index) => {
    const x = ((index + 0.5) / bars.length) * 100;
    const y = 100 - Math.max(6, (bar.count / peak) * 100);
    return [x, y] as const;
  });
  let path = `M${points[0][0]},${points[0][1]}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[index + 1];
    const mid = (x1 + x2) / 2;
    path += ` C${mid},${y1} ${mid},${y2} ${x2},${y2}`;
  }

  return (
    <div ref={ref} className={`caderno-inkchart ${visible ? "is-visible" : ""}`}>
      <div className="caderno-inkchart-plot">
        {bars.map((bar, index) => (
          <div key={bar.label} className="caderno-inkchart-col" title={`${bar.label}: ${bar.count} ${bar.count === 1 ? "sessão" : "sessões"}`}>
            <span
              className="caderno-inkchart-bar"
              style={{ height: `${Math.max(6, (bar.count / peak) * 100)}%`, transitionDelay: `${index * 70}ms` }}
            />
            <span className="caderno-inkchart-val" style={{ bottom: `calc(${Math.max(6, (bar.count / peak) * 100)}% + .35rem)`, transitionDelay: `${500 + index * 70}ms` }}>
              {bar.count}
            </span>
          </div>
        ))}
        <svg className="caderno-inkchart-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <path d={path} pathLength={1} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="caderno-inkchart-labels">
        {bars.map((bar) => (
          <span key={bar.label}>{bar.label}</span>
        ))}
      </div>
    </div>
  );
}

export type StickerItem = {
  id: string;
  title: string;
  text: string;
  xp: number;
  value: number;
  target: number;
  icon: React.ComponentType<{ className?: string }>;
};

const stickerTones = ["var(--hl-mint)", "var(--hl-yellow)", "var(--hl-pink)", "var(--hl-lilac)"];

/*
  Figurinha descolando: o ponteiro inclina a figurinha (--mx/--my) e, quanto
  mais perto do canto de baixo à direita, mais ela descola (--peel). Tudo vai
  direto para o style do botão; o React não re-renderiza a cada movimento.
*/
function peelTowards(event: React.PointerEvent<HTMLButtonElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const mx = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  const my = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
  const corner = Math.max(0, mx + my - 0.9);
  const style = event.currentTarget.style;
  style.setProperty("--mx", mx.toFixed(3));
  style.setProperty("--my", my.toFixed(3));
  style.setProperty("--peel", `${Math.round(26 + corner * 28)}px`);
}

function peelReset(event: React.PointerEvent<HTMLButtonElement>) {
  const style = event.currentTarget.style;
  style.removeProperty("--mx");
  style.removeProperty("--my");
  style.removeProperty("--peel");
}

/** Clique: a figurinha sai do papel e é colada de novo com um tapa. */
function restick(button: HTMLElement) {
  const peel = button.querySelector<HTMLElement>(".caderno-sticker-peel");
  peel?.animate(
    [
      { transform: "none" },
      { transform: "translateY(-14px) scale(1.14) rotate(-8deg)", offset: 0.45 },
      { transform: "translateY(1px) scale(0.96)", offset: 0.8 },
      { transform: "none" },
    ],
    { duration: 520, easing: "cubic-bezier(.3,.7,.3,1)" },
  );
}

/**
 * Álbum de figurinhas: conquista liberada é uma figurinha colada (entra
 * girando, descola um pouco no hover, solta confete no clique); a que falta
 * é o contorno tracejado com o quanto ainda falta.
 */
export function StickerBook({ items, reduced }: { items: StickerItem[]; reduced: boolean }) {
  return (
    <div className="caderno-stickers">
      {items.map((item, index) => {
        const Icon = item.icon;
        const done = item.value >= item.target;
        const tilt = ((index * 37) % 13) - 6;
        return (
          <motion.button
            key={item.id}
            type="button"
            className={`caderno-sticker ${done ? "is-done" : "is-locked"}`}
            style={{ "--tone": stickerTones[index % stickerTones.length], "--tilt": `${tilt}deg` } as React.CSSProperties}
            initial={reduced ? false : { opacity: 0, scale: 0.6, rotate: tilt - 30 }}
            whileInView={{ opacity: 1, scale: 1, rotate: tilt }}
            viewport={{ once: true, margin: "0px 0px -10% 0px" }}
            transition={{ type: "spring", stiffness: 380, damping: 17, delay: reduced ? 0 : (index % 6) * 0.06 }}
            onPointerMove={done && !reduced ? peelTowards : undefined}
            onPointerLeave={done && !reduced ? peelReset : undefined}
            onClick={(event) => {
              if (done) {
                if (!reduced) restick(event.currentTarget);
                celebrateFrom(event.currentTarget, { count: 22 });
                mineSays(`Figurinha "${item.title}"! +${item.xp} XP`, "wow");
              } else {
                mineSays(`Faltam ${item.target - Math.min(item.value, item.target)} para "${item.title}".`, "think");
              }
            }}
            aria-label={`${item.title}: ${item.text}. ${done ? `Conquistada, +${item.xp} XP.` : `${Math.min(item.value, item.target)} de ${item.target}.`}`}
          >
            <span className="caderno-sticker-peel">
              <span className="caderno-sticker-disc">
                <Icon className="h-7 w-7" />
              </span>
              {done ? <span className="caderno-sticker-flap" aria-hidden /> : null}
            </span>
            <span className="caderno-sticker-title">{item.title}</span>
            <span className="caderno-sticker-meta">{done ? `+${item.xp} XP` : `${Math.min(item.value, item.target)}/${item.target}`}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
