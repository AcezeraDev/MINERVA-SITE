/*
  Efeitos de UI e movimento para a aba Cubo Mágico.
  Combina padrões do Magic UI (BorderBeam, ShimmerButton) e física de mola
  (Awwwards motion: stiffness 300, damping 30, mass 1) respeitando
  prefers-reduced-motion via useSoftMotion().
*/
import React, { useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useSoftMotion } from "../motion";

export const CUBO_SPRING = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 1,
};

/** Feixe de luz animado percorrendo a borda do contêiner (Magic UI BorderBeam). */
export function CuboBorderBeam({
  size = 130,
  duration = 7.5,
  delay = 0,
  colorFrom = "#93a3ff",
  colorTo = "#2fd483",
  borderWidth = 1.5,
  radius = "1.25rem",
  className = "",
}: {
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  borderWidth?: number;
  radius?: string;
  className?: string;
}) {
  const reduced = useSoftMotion();
  if (reduced) return null;

  return (
    <div
      className={`cubo-border-beam ${className}`}
      aria-hidden="true"
      style={
        {
          "--cubo-beam-width": `${borderWidth}px`,
          "--cubo-beam-size": `${size}px`,
          "--cubo-beam-from": colorFrom,
          "--cubo-beam-to": colorTo,
          "--cubo-beam-duration": `${duration}s`,
          "--cubo-beam-delay": `${-delay}s`,
          "--cubo-beam-radius": radius,
        } as React.CSSProperties
      }
    >
      <span className="cubo-border-beam-runner" />
    </div>
  );
}

/** Botão primário com Shimmer (Magic UI) + atração magnética suave (Awwwards motion). */
export function CuboShimmerButton({
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
    rawX.set(Math.max(-7, Math.min(7, dx)));
    rawY.set(Math.max(-5, Math.min(5, dy)));
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
      whileTap={reduced || disabled ? undefined : { scale: 0.96 }}
      transition={CUBO_SPRING}
      className={`cubo-btn is-primario cubo-shimmer-btn ${className}`}
    >
      {!reduced ? (
        <span className="cubo-shimmer-spark" aria-hidden="true">
          <span className="cubo-shimmer-conic" />
        </span>
      ) : null}
      <span className="cubo-shimmer-backdrop" aria-hidden="true" />
      <span className="cubo-shimmer-content">{children}</span>
    </motion.button>
  );
}
