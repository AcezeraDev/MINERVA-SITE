import { useEffect, useRef } from "react";

/**
 * Cronômetro do Foco em forma de lápis. O corpo encolhe conforme o tempo passa,
 * a ponta recua junto e deixa para trás uma linha de grafite: a sessão
 * "escreve" enquanto acontece. Rodando, soltam lascas de madeira de vez em
 * quando. Na pausa o lápis descansa e aparece uma caneca com vapor.
 *
 * Tudo é transform com transição de 1s linear, a mesma cadência do relógio,
 * então o lápis desliza em vez de pular de segundo em segundo.
 */
export function PencilTimer({
  fraction,
  running,
  phase,
  reduced,
  label,
}: {
  fraction: number;
  running: boolean;
  phase: "focus" | "break";
  reduced: boolean;
  label: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const f = Math.max(0.0001, Math.min(1, fraction));
  const bodyLength = 420;
  const tipShift = -(1 - f) * bodyLength;

  // lascas de madeira saindo da ponta enquanto roda
  const fractionRef = useRef(f);
  fractionRef.current = f;
  useEffect(() => {
    if (!running || reduced || phase !== "focus") return;
    const id = window.setInterval(() => {
      const wrap = wrapRef.current;
      const svg = svgRef.current;
      if (!wrap || !svg) return;
      const box = svg.getBoundingClientRect();
      const host = wrap.getBoundingClientRect();
      const scale = box.width / 640;
      const tipX = (600 - (1 - fractionRef.current) * bodyLength) * scale + (box.left - host.left);
      const tipY = 48 * scale + (box.top - host.top);
      for (let index = 0; index < 3; index += 1) {
        const chip = document.createElement("i");
        chip.className = "caderno-shaving";
        chip.style.left = `${tipX}px`;
        chip.style.top = `${tipY}px`;
        wrap.appendChild(chip);
        chip
          .animate(
            [
              { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
              { transform: `translate(${10 + Math.random() * 46}px, ${40 + Math.random() * 40}px) rotate(${180 + Math.random() * 260}deg)`, opacity: 0 },
            ],
            { duration: 1100 + Math.random() * 400, easing: "cubic-bezier(.3,.2,.6,1)" },
          )
          .finished.catch(() => undefined)
          .finally(() => chip.remove());
      }
    }, 2600);
    return () => window.clearInterval(id);
  }, [running, reduced, phase]);

  return (
    <div ref={wrapRef} className={`caderno-pencil-wrap ${running ? "is-running" : ""}`} role="img" aria-label={label}>
      {phase === "focus" ? (
        <svg ref={svgRef} viewBox="0 0 640 110" className="caderno-pencil" aria-hidden>
          {/* linha de grafite escrita pela ponta */}
          <path
            className="caderno-pencil-line"
            d="M600 96 C 560 86, 540 104, 500 96 S 440 86, 400 96 S 340 104, 300 96 S 240 86, 200 96 S 196 100, 180 96"
            pathLength={1}
            style={{ strokeDashoffset: f }}
          />
          <rect x="0" y="22" width="60" height="52" rx="12" className="caderno-pencil-eraser" />
          <rect x="54" y="18" width="30" height="60" className="caderno-pencil-ferrule" />
          <g className="caderno-pencil-body" style={{ transform: `scaleX(${f})` }}>
            <rect x="84" y="18" width={bodyLength} height="60" className="body" />
            <rect x="84" y="18" width={bodyLength} height="18" className="shine" />
            <rect x="84" y="58" width={bodyLength} height="20" className="shade" />
          </g>
          <g className="caderno-pencil-tip" style={{ transform: `translateX(${tipShift}px)` }}>
            <path d="M504 18 L600 48 L504 78 Z" className="wood" />
            <path d="M570 38.6 L600 48 L570 57.4 Z" className="lead" />
          </g>
        </svg>
      ) : (
        <svg viewBox="0 0 220 160" className="caderno-mug" aria-hidden>
          <path className="steam s1" d="M80 50 C 70 38, 92 30, 82 16" />
          <path className="steam s2" d="M105 50 C 95 36, 118 28, 106 10" />
          <path className="steam s3" d="M130 50 C 120 38, 142 30, 132 16" />
          <path className="cup" d="M58 62 L152 62 L144 138 Q142 150 128 150 L82 150 Q68 150 66 138 Z" />
          <path className="handle" d="M150 78 C 178 76, 180 118, 146 118" />
          <path className="coffee" d="M62 72 L148 72" />
        </svg>
      )}
    </div>
  );
}
