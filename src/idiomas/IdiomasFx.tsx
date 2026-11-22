/*
  Efeitos de UI e movimento para a aba Idiomas.
  Combina padrões do Magic UI (BorderBeam, ShimmerButton) e física de mola
  (Awwwards motion: stiffness 300, damping 30, mass 1) respeitando
  prefers-reduced-motion via useSoftMotion().
*/
import React, { useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useSoftMotion } from "../motion";

export const SPRING_UI = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 1,
};

export const SPRING_GENTLE = {
  type: "spring" as const,
  stiffness: 220,
  damping: 26,
  mass: 1,
};

/**
 * Feixe de luz animado percorrendo a borda do contêiner (inspirado no Magic UI BorderBeam).
 * Usa mask-composite para ficar estritamente na borda sem vazar no conteúdo.
 */
export function BorderBeam({
  size = 110,
  duration = 7,
  delay = 0,
  colorFrom = "#93a3ff",
  colorTo = "#2fd483",
  borderWidth = 1.5,
  className = "",
}: {
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  borderWidth?: number;
  className?: string;
}) {
  const reduced = useSoftMotion();
  if (reduced) return null;

  return (
    <div
      className={`idi-border-beam ${className}`}
      aria-hidden="true"
      style={
        {
          "--idi-beam-width": `${borderWidth}px`,
          "--idi-beam-size": `${size}px`,
          "--idi-beam-from": colorFrom,
          "--idi-beam-to": colorTo,
          "--idi-beam-duration": `${duration}s`,
          "--idi-beam-delay": `${-delay}s`,
        } as React.CSSProperties
      }
    >
      <span className="idi-border-beam-runner" />
    </div>
  );
}

/**
 * Botão primário com efeito Shimmer (Magic UI) + atração magnética suave (Awwwards motion)
 * e resposta de mola no hover/clique.
 */
export function MagneticShimmerButton({
  children,
  className = "",
  onClick,
  disabled,
  type = "button",
  title,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  title?: string;
  "aria-label"?: string;
}) {
  const reduced = useSoftMotion();
  const ref = useRef<HTMLButtonElement | null>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 300, damping: 24, mass: 0.8 });
  const y = useSpring(rawY, { stiffness: 300, damping: 24, mass: 0.8 });

  const handleMove = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (reduced || disabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = (event.clientX - (rect.left + rect.width / 2)) * 0.12;
    const dy = (event.clientY - (rect.top + rect.height / 2)) * 0.14;
    rawX.set(Math.max(-8, Math.min(8, dx)));
    rawY.set(Math.max(-6, Math.min(6, dy)));
  };

  const handleLeave = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={reduced ? undefined : { x, y }}
      whileHover={reduced || disabled ? undefined : { scale: 1.035 }}
      whileTap={reduced || disabled ? undefined : { scale: 0.965 }}
      transition={SPRING_UI}
      className={`idi-go idi-shimmer-btn ${className}`}
    >
      {!reduced ? (
        <span className="idi-shimmer-spark" aria-hidden="true">
          <span className="idi-shimmer-conic" />
        </span>
      ) : null}
      <span className="idi-shimmer-backdrop" aria-hidden="true" />
      <span className="idi-shimmer-content">{children}</span>
    </motion.button>
  );
}
