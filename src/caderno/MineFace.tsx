import { useEffect, useRef, type CSSProperties } from "react";

/**
 * O rosto da Mine desenhado à caneta, o mesmo da margem do caderno.
 *
 * Pisca sozinha por CSS (cada instância com um atraso diferente, para uma
 * conversa cheia de avatares não piscar em coro). Com `track`, os olhos
 * seguem o cursor: a escrita vai direto no atributo `transform`, uma vez por
 * quadro, sem passar pelo React.
 */
export function MineFace({
  track = false,
  thinking = false,
  draw = false,
  className = "",
}: {
  track?: boolean;
  thinking?: boolean;
  /** Entra sendo desenhada: contorno à caneta, cor depois, olhos abrindo. */
  draw?: boolean;
  className?: string;
}) {
  const eyes = useRef<SVGGElement | null>(null);
  const root = useRef<SVGSVGElement | null>(null);
  const blinkDelay = useRef(`${(Math.random() * 4).toFixed(2)}s`);

  useEffect(() => {
    if (!track) return;
    if (document.documentElement.classList.contains("no-motion") || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let last: PointerEvent | null = null;
    const paint = () => {
      frame = 0;
      if (!eyes.current || !root.current || !last) return;
      const rect = root.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.5;
      const angle = Math.atan2(last.clientY - cy, last.clientX - cx);
      const reach = Math.min(1, Math.hypot(last.clientX - cx, last.clientY - cy) / 420);
      eyes.current.setAttribute("transform", `translate(${(Math.cos(angle) * 8 * reach).toFixed(2)} ${(Math.sin(angle) * 6 * reach).toFixed(2)})`);
    };
    const onMove = (event: PointerEvent) => {
      last = event;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [track]);

  return (
    <svg
      ref={root}
      viewBox="0 0 120 120"
      className={`caderno-mineface ${thinking ? "is-thinking" : ""} ${draw ? "is-drawing" : ""} ${className}`}
      style={{ "--blink-delay": blinkDelay.current } as CSSProperties}
      aria-hidden
    >
      <line className="f-stroke" pathLength={1} x1="60" y1="14" x2="60" y2="30" />
      <circle className="f-bulb f-stroke" pathLength={1} cx="60" cy="11" r="7" />
      <rect className="f-ear f-stroke" x="10" pathLength={1} y="54" width="14" height="30" rx="6" />
      <rect className="f-ear f-stroke" x="96" pathLength={1} y="54" width="14" height="30" rx="6" />
      <rect className="f-head f-stroke" pathLength={1} x="20" y="30" width="80" height="80" rx="26" />
      <rect className="f-visor f-stroke" pathLength={1} x="31" y="46" width="58" height="42" rx="16" />
      <g ref={eyes}>
        <g className="f-eyes">
          <ellipse className="f-eye" cx="47" cy="64" rx="5" ry="6.5" />
          <ellipse className="f-eye" cx="73" cy="64" rx="5" ry="6.5" />
        </g>
      </g>
      <path className="f-stroke f-thin" pathLength={1} d="M52 77 Q60 84 68 77" />
    </svg>
  );
}
