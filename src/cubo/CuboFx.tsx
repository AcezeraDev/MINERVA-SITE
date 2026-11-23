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

/**
 * Cartão interativo inspirado no Magic UI `MagicCard`:
 * spotlight radial que acompanha o cursor + mola Awwwards no clique/hover.
 */
export function CuboMagicCard({
  children,
  active = false,
  disabled = false,
  colorA = "#8e9eff",
  colorB = "#2fd483",
  className = "",
  onClick,
  role,
  "aria-checked": ariaChecked,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  colorA?: string;
  colorB?: string;
  className?: string;
  onClick?: () => void;
  role?: string;
  "aria-checked"?: boolean;
  title?: string;
}) {
  const reduced = useSoftMotion();
  const ref = useRef<HTMLButtonElement | null>(null);

  const handleMove = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    ref.current.style.setProperty("--mx", `${px}px`);
    ref.current.style.setProperty("--my", `${py}px`);
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      role={role}
      aria-checked={ariaChecked}
      disabled={disabled}
      title={title}
      onClick={onClick}
      onMouseMove={handleMove}
      whileHover={reduced || disabled ? undefined : { y: -3, scale: 1.02 }}
      whileTap={reduced || disabled ? undefined : { scale: 0.97 }}
      transition={CUBO_SPRING}
      className={`cubo-magic-card ${active ? "is-ativo" : ""} ${className}`}
      style={
        {
          "--card-a": colorA,
          "--card-b": colorB,
        } as React.CSSProperties
      }
    >
      <span className="cubo-magic-spotlight" aria-hidden="true" />
      {children}
    </motion.button>
  );
}
