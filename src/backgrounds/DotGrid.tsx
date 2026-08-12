import { useEffect, useMemo, useRef, type CSSProperties } from "react";

interface DotGridProps {
  dotSize?: number;
  gap?: number;
  baseColor?: string;
  activeColor?: string;
  proximity?: number;
  shockRadius?: number;
  shockStrength?: number;
  returnDuration?: number;
  className?: string;
  style?: CSSProperties;
}

type Dot = { x: number; y: number; ox: number; oy: number; vx: number; vy: number };

function rgb(hex: string) {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : [255, 255, 255];
}

export default function DotGrid({
  dotSize = 2.4,
  gap = 22,
  baseColor = "#173c31",
  activeColor = "#34d399",
  proximity = 130,
  shockRadius = 210,
  shockStrength = 1.5,
  returnDuration = 1.2,
  className = "",
  style,
}: DotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseRgb = useMemo(() => rgb(baseColor), [baseColor]);
  const activeRgb = useMemo(() => rgb(activeColor), [activeColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dots: Dot[] = [];
    const pointer = { x: -9999, y: -9999, inside: false };
    const size = { width: 1, height: 1, dpr: 1 };
    let raf: number | null = null;
    let visible = true;
    let pageVisible = !document.hidden;

    const rebuild = () => {
      const rect = canvas.getBoundingClientRect();
      size.width = Math.max(1, rect.width);
      size.height = Math.max(1, rect.height);
      size.dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(size.width * size.dpr);
      canvas.height = Math.round(size.height * size.dpr);
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      dots.length = 0;
      const cell = dotSize + gap;
      const columns = Math.ceil(size.width / cell);
      const rows = Math.ceil(size.height / cell);
      const startX = (size.width - (columns - 1) * cell) / 2;
      const startY = (size.height - (rows - 1) * cell) / 2;
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          dots.push({ x: startX + column * cell, y: startY + row * cell, ox: 0, oy: 0, vx: 0, vy: 0 });
        }
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, size.width, size.height);
      const proximitySquared = proximity * proximity;
      for (const dot of dots) {
        const dx = dot.x - pointer.x;
        const dy = dot.y - pointer.y;
        const distanceSquared = dx * dx + dy * dy;
        const blend = pointer.inside && distanceSquared < proximitySquared ? 1 - Math.sqrt(distanceSquared) / proximity : 0;
        const r = Math.round(baseRgb[0] + (activeRgb[0] - baseRgb[0]) * blend);
        const g = Math.round(baseRgb[1] + (activeRgb[1] - baseRgb[1]) * blend);
        const b = Math.round(baseRgb[2] + (activeRgb[2] - baseRgb[2]) * blend);
        const stiffness = Math.min(0.22, 0.055 / Math.max(0.3, returnDuration));
        dot.vx += -dot.ox * stiffness;
        dot.vy += -dot.oy * stiffness;
        dot.vx *= 0.86;
        dot.vy *= 0.86;
        dot.ox += dot.vx;
        dot.oy += dot.vy;
        ctx.beginPath();
        ctx.arc(dot.x + dot.ox, dot.y + dot.oy, dotSize * (0.72 + blend * 0.42), 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    const start = () => {
      if (raf !== null || !visible || !pageVisible) return;
      raf = requestAnimationFrame(draw);
    };
    const stop = () => {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
    };
    const updatePointer = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.inside = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= rect.width && pointer.y <= rect.height;
    };
    const shock = (event: MouseEvent) => {
      if (!pointer.inside || (event.target as HTMLElement | null)?.closest("input, textarea, select")) return;
      for (const dot of dots) {
        const dx = dot.x - pointer.x;
        const dy = dot.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (!distance || distance >= shockRadius) continue;
        const force = (1 - distance / shockRadius) * shockStrength;
        dot.vx += (dx / distance) * force * 8;
        dot.vy += (dy / distance) * force * 8;
      }
    };
    const onVisibility = () => {
      pageVisible = !document.hidden;
      pageVisible ? start() : stop();
    };

    const resizeObserver = new ResizeObserver(rebuild);
    resizeObserver.observe(canvas);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      visible ? start() : stop();
    });
    intersectionObserver.observe(canvas);
    window.addEventListener("mousemove", updatePointer, { passive: true });
    window.addEventListener("click", shock);
    document.addEventListener("visibilitychange", onVisibility);
    rebuild();
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("mousemove", updatePointer);
      window.removeEventListener("click", shock);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activeRgb, baseRgb, dotSize, gap, proximity, returnDuration, shockRadius, shockStrength]);

  return <canvas ref={canvasRef} aria-hidden className={`block h-full w-full ${className}`} style={style} />;
}
