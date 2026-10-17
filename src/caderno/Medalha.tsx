/*
  Roseta de feltro: o laço de premiação de feira de ciências, em 3D.

  É uma moeda de CSS 3D: a frente (nível), o verso (título) e uma pilha de
  camadas finas no meio que dão a grossura do feltro quando ela gira. Entra
  girando ao aparecer e dá para girar arrastando; ao soltar, ela continua no
  embalo e para de frente. Só transform anima, e o giro é um MotionValue:
  arrastar não re-renderiza nada no React.
*/
import React, { useEffect, useRef } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useSoftMotion } from "../motion";
import "./caderno-medalha.css";

const LAYERS = 7;

/** Contorno franzido do feltro: um círculo com 18 ondinhas. */
function pleatPath(radius: number, depth: number, waves = 18) {
  const points: string[] = [];
  const steps = waves * 8;
  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    const r = radius + Math.sin(angle * waves) * depth;
    points.push(`${(100 + Math.cos(angle) * r).toFixed(2)},${(100 + Math.sin(angle) * r).toFixed(2)}`);
  }
  return `M${points.join("L")}Z`;
}

const outer = pleatPath(88, 6);
const inner = pleatPath(66, 3.5, 26);

function Face({ children, back }: { children: React.ReactNode; back?: boolean }) {
  return (
    <span className={`caderno-medalha-face ${back ? "is-back" : ""}`}>
      <svg viewBox="0 0 200 200" aria-hidden>
        <path d={outer} className="felt" />
        <path d={outer} className="felt-stitch" />
        <path d={inner} className="felt-2" />
        <circle cx="100" cy="100" r="46" className="disc" />
        <circle cx="100" cy="100" r="40" className="disc-ring" />
      </svg>
      <span className="caderno-medalha-text">{children}</span>
    </span>
  );
}

export function Medalha({ level, title, delay = 0.35 }: { level: number; title: string; delay?: number }) {
  const reduced = useSoftMotion();
  const spin = useMotionValue(reduced ? 0 : -540);
  const tilt = useTransform(spin, (value) => Math.sin((value * Math.PI) / 180) * 6);
  const drag = useRef<{ x: number; start: number; last: number; t: number; v: number } | null>(null);

  useEffect(() => {
    if (reduced) return;
    const controls = animate(spin, 0, { type: "spring", stiffness: 38, damping: 11, delay });
    return () => controls.stop();
  }, [reduced, spin, delay]);

  const settle = (velocity: number) => {
    // continua no embalo e para na frente mais próxima do ponto de parada
    const target = Math.round((spin.get() + velocity * 0.35) / 360) * 360;
    animate(spin, target, { type: "spring", stiffness: 60, damping: 13, velocity });
  };

  return (
    <div className="caderno-medalha" role="img" aria-label={`Roseta do nível ${level}: ${title}`}>
      <span className="caderno-medalha-tails" aria-hidden>
        <i />
        <i />
      </span>
      <motion.span
        className="caderno-medalha-coin"
        style={{ rotateY: spin, rotateZ: tilt }}
        onPointerDown={(event) => {
          if (reduced) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, start: spin.get(), last: event.clientX, t: performance.now(), v: 0 };
        }}
        onPointerMove={(event) => {
          const state = drag.current;
          if (!state) return;
          const now = performance.now();
          const dt = Math.max(1, now - state.t);
          state.v = ((event.clientX - state.last) * 1.4 * 1000) / dt;
          state.last = event.clientX;
          state.t = now;
          spin.set(state.start + (event.clientX - state.x) * 1.4);
        }}
        onPointerUp={() => {
          const state = drag.current;
          drag.current = null;
          if (state) settle(state.v);
        }}
        onPointerCancel={() => {
          drag.current = null;
          settle(0);
        }}
      >
        {Array.from({ length: LAYERS }, (_, index) => (
          <span key={index} className="caderno-medalha-layer" style={{ "--z": `${index - (LAYERS - 1) / 2}px` } as React.CSSProperties}>
            <svg viewBox="0 0 200 200" aria-hidden>
              <path d={outer} />
            </svg>
          </span>
        ))}
        <Face>
          <small>nível</small>
          <strong>{level}</strong>
        </Face>
        <Face back>
          <small>Minerva</small>
          <em>{title}</em>
        </Face>
      </motion.span>
    </div>
  );
}
