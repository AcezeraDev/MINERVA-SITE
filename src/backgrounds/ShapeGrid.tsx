import { useEffect, useRef, type CSSProperties } from "react";

type Shape = "square" | "hexagon" | "circle" | "triangle";
type Direction = "diagonal" | "up" | "right" | "down" | "left";

interface ShapeGridProps {
  direction?: Direction;
  speed?: number;
  borderColor?: string;
  squareSize?: number;
  hoverFillColor?: string;
  shape?: Shape;
  hoverTrailAmount?: number;
  vignetteColor?: string;
  className?: string;
  style?: CSSProperties;
}

type Cell = { x: number; y: number };

export default function ShapeGrid({
  direction = "diagonal",
  speed = 0.35,
  borderColor = "rgba(52, 211, 153, 0.18)",
  squareSize = 46,
  hoverFillColor = "rgba(52, 211, 153, 0.2)",
  shape = "hexagon",
  hoverTrailAmount = 5,
  vignetteColor = "#050807",
  className = "",
  style,
}: ShapeGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const offset = { x: 0, y: 0 };
    const size = { width: 1, height: 1, dpr: 1 };
    const pointer = { x: -9999, y: -9999, inside: false };
    const trail: Cell[] = [];
    const opacities = new Map<string, number>();
    let raf: number | null = null;
    let visible = true;
    let pageVisible = !document.hidden;
    let lastTime = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      size.width = Math.max(1, rect.width);
      size.height = Math.max(1, rect.height);
      size.dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(size.width * size.dpr);
      canvas.height = Math.round(size.height * size.dpr);
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    };

    const pathCell = (cx: number, cy: number, flip = false) => {
      ctx.beginPath();
      if (shape === "circle") {
        ctx.arc(cx, cy, squareSize * 0.34, 0, Math.PI * 2);
      } else if (shape === "triangle") {
        const half = squareSize / 2;
        ctx.moveTo(cx, cy + (flip ? half : -half));
        ctx.lineTo(cx + half, cy + (flip ? -half : half));
        ctx.lineTo(cx - half, cy + (flip ? -half : half));
        ctx.closePath();
      } else if (shape === "hexagon") {
        for (let index = 0; index < 6; index += 1) {
          const angle = (Math.PI / 3) * index;
          const x = cx + squareSize * 0.52 * Math.cos(angle);
          const y = cy + squareSize * 0.52 * Math.sin(angle);
          if (!index) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      } else {
        ctx.rect(cx - squareSize / 2, cy - squareSize / 2, squareSize, squareSize);
      }
    };

    const cellAtPointer = (): Cell | null => {
      if (!pointer.inside) return null;
      if (shape === "hexagon") {
        const stepX = squareSize * 1.5;
        const stepY = squareSize * Math.sqrt(3);
        const x = Math.round((pointer.x - offset.x) / stepX);
        const shift = x % 2 ? stepY / 2 : 0;
        return { x, y: Math.round((pointer.y - offset.y - shift) / stepY) };
      }
      const stepX = shape === "triangle" ? squareSize / 2 : squareSize;
      return {
        x: Math.round((pointer.x - offset.x) / stepX),
        y: Math.round((pointer.y - offset.y) / squareSize),
      };
    };

    const updateTrail = () => {
      const current = cellAtPointer();
      if (current) {
        const previous = trail[0];
        if (!previous || previous.x !== current.x || previous.y !== current.y) {
          trail.unshift(current);
          trail.length = Math.min(trail.length, hoverTrailAmount + 1);
        }
      }
      const targets = new Map<string, number>();
      trail.forEach((cell, index) => targets.set(`${cell.x},${cell.y}`, 1 - index / (trail.length + 1)));
      for (const key of targets.keys()) if (!opacities.has(key)) opacities.set(key, 0);
      for (const [key, opacity] of opacities) {
        const next = opacity + ((targets.get(key) || 0) - opacity) * 0.14;
        if (next < 0.006) opacities.delete(key);
        else opacities.set(key, next);
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, size.width, size.height);
      const stepX = shape === "hexagon" ? squareSize * 1.5 : shape === "triangle" ? squareSize / 2 : squareSize;
      const stepY = shape === "hexagon" ? squareSize * Math.sqrt(3) : squareSize;
      const startX = -Math.ceil(Math.abs(offset.x) / stepX) - 2;
      const startY = -Math.ceil(Math.abs(offset.y) / stepY) - 2;
      const columns = Math.ceil(size.width / stepX) + 6;
      const rows = Math.ceil(size.height / stepY) + 6;

      ctx.lineWidth = 1;
      for (let column = startX; column < columns; column += 1) {
        for (let row = startY; row < rows; row += 1) {
          const x = column * stepX + offset.x;
          const y = row * stepY + offset.y + (shape === "hexagon" && column % 2 ? stepY / 2 : 0);
          pathCell(x, y, Boolean((column + row) % 2));
          const alpha = opacities.get(`${column},${row}`);
          if (alpha) {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = hoverFillColor;
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          ctx.strokeStyle = borderColor;
          ctx.stroke();
        }
      }

      const radius = Math.hypot(size.width, size.height) * 0.58;
      const vignette = ctx.createRadialGradient(size.width / 2, size.height / 2, 0, size.width / 2, size.height / 2, radius);
      vignette.addColorStop(0, "rgba(5, 8, 7, 0)");
      vignette.addColorStop(1, vignetteColor);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, size.width, size.height);
    };

    const frame = (time: number) => {
      const factor = Math.min(2, (time - lastTime) / 16.67);
      lastTime = time;
      const movement = Math.max(0.05, speed) * factor;
      if (direction === "right" || direction === "diagonal") offset.x -= movement;
      if (direction === "left") offset.x += movement;
      if (direction === "up" || direction === "diagonal") offset.y += movement;
      if (direction === "down") offset.y -= movement;
      const wrapX = shape === "hexagon" ? squareSize * 3 : squareSize;
      const wrapY = shape === "hexagon" ? squareSize * Math.sqrt(3) : squareSize * (shape === "triangle" ? 2 : 1);
      offset.x = ((offset.x % wrapX) + wrapX) % wrapX;
      offset.y = ((offset.y % wrapY) + wrapY) % wrapY;
      updateTrail();
      draw();
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf !== null || !visible || !pageVisible) return;
      lastTime = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
    };
    const onPointerMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.inside = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= rect.width && pointer.y <= rect.height;
      if (!pointer.inside) trail.length = 0;
    };
    const onVisibility = () => {
      pageVisible = !document.hidden;
      pageVisible ? start() : stop();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      visible ? start() : stop();
    });
    intersectionObserver.observe(canvas);
    window.addEventListener("mousemove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    resize();
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("mousemove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [borderColor, direction, hoverFillColor, hoverTrailAmount, shape, speed, squareSize, vignetteColor]);

  return <canvas ref={canvasRef} aria-hidden className={`block h-full w-full border-0 ${className}`} style={style} />;
}
