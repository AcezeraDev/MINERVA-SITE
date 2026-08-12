import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Globo de conhecimento — o objeto 3D interativo da home.
 *
 * A geometria é 3D de verdade (rotação + projeção em perspectiva feitas à mão),
 * mas o desenho é Canvas 2D: o fundo da página já consome um contexto WebGL e
 * aqui a malha é pequena o bastante para o 2D render sair de graça.
 *
 * Os nós das matérias NÃO são pintados no canvas — são <button> reais
 * posicionados por transform a cada quadro. Isso mantém teclado, foco e leitor
 * de tela funcionando: o canvas é só o cenário, a interação é HTML.
 */

export type GlobeNode = {
  id: string;
  label: string;
  color: string;
  /** número mostrado no nó (ex.: conteúdos da matéria) */
  value: number;
  /** 0–100, preenche o anel do nó */
  progress: number;
  /** linha secundária no rótulo */
  hint?: string;
  /** destaque em âmbar (ex.: revisões vencidas) */
  alert?: number;
};

type Vec3 = [number, number, number];

function rgbOf(hex: string) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return match ? [Number.parseInt(match[1], 16), Number.parseInt(match[2], 16), Number.parseInt(match[3], 16)] as const : [57, 245, 154] as const;
}

function rgba(rgb: readonly [number, number, number], alpha: number) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

/* ------------------------------------------------------------------ geometria */

/** Distribuição em espiral de Fibonacci: espaçamento parelho para qualquer N. */
function fibonacciSphere(count: number): Vec3[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - ((i + 0.5) / count) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    return [Math.cos(theta) * r, y, Math.sin(theta) * r] as Vec3;
  });
}

/** Yaw em torno de Y, depois pitch em torno de X. */
function rotate(p: Vec3, yaw: number, pitch: number): Vec3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = p[0] * cy + p[2] * sy;
  const z1 = -p[0] * sy + p[2] * cy;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return [x1, p[1] * cp - z1 * sp, p[1] * sp + z1 * cp];
}

/** Ângulos que trazem um ponto para a frente da câmera (usado no foco). */
function anglesFacing(p: Vec3) {
  return { yaw: Math.atan2(-p[0], p[2]), pitch: Math.atan2(p[1], Math.hypot(p[0], p[2])) };
}

function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-4) return [a[0], a[1], a[2]];
  const so = Math.sin(omega);
  const k0 = Math.sin((1 - t) * omega) / so;
  const k1 = Math.sin(t * omega) / so;
  return [a[0] * k0 + b[0] * k1, a[1] * k0 + b[1] * k1, a[2] * k0 + b[2] * k1];
}

const CAM = 3.05;
const FOCAL = 2;

/* --------------------------------------------------------------- componente */

export function KnowledgeGlobe({
  nodes,
  reduced = false,
  accentColor = "#39F59A",
  light = false,
  onSelect,
  onEmpty,
  emptyLabel = "Criar primeira matéria",
  className = "",
}: {
  nodes: GlobeNode[];
  reduced?: boolean;
  accentColor?: string;
  light?: boolean;
  onSelect: (id: string) => void;
  onEmpty?: () => void;
  emptyLabel?: string;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chipRefs = useRef(new Map<string, HTMLElement>());
  const [active, setActive] = useState<string | null>(null);

  const activeRef = useRef<string | null>(null);
  activeRef.current = active;

  // posições-base: só mudam quando a lista de matérias muda de tamanho/ordem
  const layout = useMemo(() => {
    const points = fibonacciSphere(Math.max(nodes.length, 1));
    const map = new Map<string, Vec3>();
    nodes.forEach((node, index) => map.set(node.id, points[index]));

    // cada nó liga no vizinho mais próximo — desenha a "rede" sem virar teia
    const links: Array<[string, string]> = [];
    const seen = new Set<string>();
    for (const node of nodes) {
      const from = map.get(node.id);
      if (!from) continue;
      let bestId = "";
      let bestDot = -Infinity;
      for (const other of nodes) {
        if (other.id === node.id) continue;
        const to = map.get(other.id);
        if (!to) continue;
        const dot = from[0] * to[0] + from[1] * to[1] + from[2] * to[2];
        if (dot > bestDot) {
          bestDot = dot;
          bestId = other.id;
        }
      }
      if (!bestId) continue;
      const pair = node.id < bestId ? `${node.id}|${bestId}` : `${bestId}|${node.id}`;
      if (seen.has(pair)) continue;
      seen.add(pair);
      links.push([node.id, bestId]);
    }

    return { map, links };
  }, [nodes]);

  // Poeira neural determinística: acrescenta profundidade sem criar estado ou
  // números aleatórios durante a renderização.
  const neuralDust = useMemo(
    () => fibonacciSphere(42).map((point, index) => {
      const radius = 0.48 + ((index * 37) % 53) / 100;
      return [point[0] * radius, point[1] * radius, point[2] * radius] as Vec3;
    }),
    [],
  );

  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const accentRef = useRef(accentColor);
  accentRef.current = accentColor;
  const lightRef = useRef(light);
  lightRef.current = light;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const setChipRef = useCallback((id: string) => (el: HTMLElement | null) => {
    if (el) chipRefs.current.set(id, el);
    else chipRefs.current.delete(id);
  }, []);

  // câmera: alvo (para onde queremos ir) + valor suavizado a cada quadro
  const cam = useRef({ yaw: 0.5, pitch: 0.26, targetYaw: 0.5, targetPitch: 0.26, spin: 0, vel: 0 });
  const drag = useRef({ on: false, x: 0, y: 0, moved: false, id: -1 });

  /** Gira o globo até o nó ficar de frente (usado ao focar pelo teclado). */
  const faceNode = useCallback((id: string) => {
    const point = layoutRef.current.map.get(id);
    if (!point) return;
    const { yaw, pitch } = anglesFacing(point);
    const state = cam.current;
    // caminho curto: nunca dar a volta longa por causa do módulo 2π
    const wrapped = yaw + Math.round((state.yaw - state.spin - yaw) / (Math.PI * 2)) * Math.PI * 2;
    state.targetYaw = wrapped;
    state.targetPitch = Math.max(-1, Math.min(1, pitch));
    state.spin = 0;
    state.vel = 0;
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let raf = 0;
    let running = true;
    let last = performance.now();
    let lastPaint = 0;
    let clock = 0;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(rect.width, 1);
      height = Math.max(rect.height, 1);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const frame = (now: number) => {
      if (!running) return;
      if (lastPaint && now - lastPaint < 32) {
        raf = requestAnimationFrame(frame);
        return;
      }
      lastPaint = now;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      clock += dt;

      // host ainda sem tamanho (primeiro layout, painel colapsado): desenhar
      // agora só produziria NaN nas projeções
      if (width < 8 || height < 8) {
        raf = requestAnimationFrame(frame);
        return;
      }

      const state = cam.current;
      const soft = reducedRef.current;

      if (!soft) {
        if (!drag.current.on) {
          // inércia do arrasto, depois volta ao giro lento de repouso
          state.spin += state.vel * dt;
          state.vel *= Math.exp(-2.6 * dt);
          if (Math.abs(state.vel) < 0.02 && !activeRef.current) state.spin += dt * 0.11;
        }
      }

      state.yaw += (state.targetYaw + state.spin - state.yaw) * Math.min(1, dt * 6);
      state.pitch += (state.targetPitch - state.pitch) * Math.min(1, dt * 6);

      const cx = width / 2;
      const cy = height / 2;
      // a largura pesa mais que a altura: é nela que os rótulos podem estourar
      const R = Math.min(width * 0.34, height * 0.37);
      const unit = (R * CAM) / FOCAL;

      const project = (p: Vec3) => {
        const s = FOCAL / (CAM - p[2]);
        return { x: cx + p[0] * s * unit, y: cy - p[1] * s * unit, s };
      };

      ctx.clearRect(0, 0, width, height);

      const yaw = state.yaw;
      const pitch = state.pitch;
      const breathe = soft ? 1 : 1 + Math.sin(clock * 0.9) * 0.006;
      const accentRgb = rgbOf(accentRef.current);
      const contrast = lightRef.current ? 1.42 : 1;
      const signalRgb: [number, number, number] = [
        Math.round(accentRgb[0] + (255 - accentRgb[0]) * 0.48),
        Math.round(accentRgb[1] + (255 - accentRgb[1]) * 0.48),
        Math.round(accentRgb[2] + (255 - accentRgb[2]) * 0.48),
      ];

      /* 0 — volume e atmosfera: a luz deslocada cria uma esfera, não um disco. */
      ctx.save();
      const volume = ctx.createRadialGradient(cx - R * 0.28, cy - R * 0.34, R * 0.04, cx, cy, R * 1.08);
      volume.addColorStop(0, rgba(signalRgb, 0.14));
      volume.addColorStop(0.3, rgba(accentRgb, 0.075));
      volume.addColorStop(0.72, rgba(accentRgb, 0.025));
      volume.addColorStop(1, rgba(accentRgb, 0));
      ctx.fillStyle = volume;
      ctx.shadowColor = rgba(accentRgb, 0.34);
      ctx.shadowBlur = R * 0.22;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.035, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Pontos em profundidades diferentes fazem a superfície parecer habitada.
      for (let index = 0; index < neuralDust.length; index++) {
        const raw = neuralDust[index];
        const p = rotate(raw, yaw + (soft ? 0 : clock * 0.018), pitch);
        const point = project(p);
        const depth = p[2] * 0.5 + 0.5;
        const shimmer = soft ? 0.65 : 0.52 + Math.sin(clock * 1.4 + index * 1.7) * 0.16;
        ctx.globalAlpha = Math.min(1, Math.max(0.05, depth * shimmer) * contrast);
        ctx.fillStyle = index % 5 === 0 ? rgba(signalRgb, 0.9) : rgba(accentRgb, 0.72);
        ctx.beginPath();
        ctx.arc(point.x, point.y, 0.8 + depth * 1.25, 0, Math.PI * 2);
        ctx.fill();
      }

      /* 1 — malha da esfera: paralelos e meridianos, metade de trás mais fraca */
      const drawCurve = (points: Vec3[], front: boolean, alpha: number, color: string, lineWidth: number) => {
        ctx.beginPath();
        let started = false;
        for (const raw of points) {
          const p = rotate(raw, yaw, pitch);
          const isFront = p[2] >= 0;
          if (isFront !== front) {
            started = false;
            continue;
          }
          const { x, y } = project([p[0] * breathe, p[1] * breathe, p[2] * breathe]);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.globalAlpha = Math.min(1, alpha * contrast);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      };

      const SEG = 72;
      for (let ring = 1; ring <= 6; ring++) {
        const phi = (ring / 7) * Math.PI - Math.PI / 2;
        const r = Math.cos(phi);
        const y = Math.sin(phi);
        const points: Vec3[] = Array.from({ length: SEG + 1 }, (_, i) => {
          const t = (i / SEG) * Math.PI * 2;
          return [Math.cos(t) * r, y, Math.sin(t) * r] as Vec3;
        });
        drawCurve(points, false, 0.065, rgba(signalRgb, 1), 0.8);
        drawCurve(points, true, 0.3, rgba(accentRgb, 1), 1.05);
      }

      for (let mer = 0; mer < 8; mer++) {
        const a = (mer / 8) * Math.PI;
        const points: Vec3[] = Array.from({ length: SEG + 1 }, (_, i) => {
          const t = (i / SEG) * Math.PI * 2;
          return [Math.cos(t) * Math.cos(a), Math.sin(t), Math.cos(t) * Math.sin(a)] as Vec3;
        });
        drawCurve(points, false, 0.05, rgba(accentRgb, 1), 0.8);
        drawCurve(points, true, 0.2, rgba(signalRgb, 1), 1);
      }

      /* 2 — anel orbital inclinado: dá o eixo do objeto e um pouco de vida */
      const tilt = 0.42;
      const orbit: Vec3[] = Array.from({ length: SEG + 1 }, (_, i) => {
        const t = (i / SEG) * Math.PI * 2 + (soft ? 0 : clock * 0.18);
        const x = Math.cos(t) * 1.28;
        const z = Math.sin(t) * 1.28;
        return [x, z * Math.sin(tilt), z * Math.cos(tilt)] as Vec3;
      });
      drawCurve(orbit, false, 0.09, rgba(signalRgb, 1), 1.1);
      drawCurve(orbit, true, 0.54, rgba(signalRgb, 1), 1.35);

      /* 3 — arcos entre matérias vizinhas */
      const list = nodesRef.current;
      const map = layoutRef.current.map;
      const activeId = activeRef.current;

      for (const [fromId, toId] of layoutRef.current.links) {
        const a = map.get(fromId);
        const b = map.get(toId);
        if (!a || !b) continue;
        const lit = activeId === fromId || activeId === toId;
        ctx.beginPath();
        let started = false;
        let depth = 0;
        for (let i = 0; i <= 18; i++) {
          const t = i / 18;
          const base = slerp(a, b, t);
          // levanta o arco no meio para ele não colar na malha
          const lift = 1 + Math.sin(Math.PI * t) * 0.16;
          const p = rotate([base[0] * lift, base[1] * lift, base[2] * lift], yaw, pitch);
          depth += p[2];
          const { x, y } = project(p);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        const avg = depth / 19;
        ctx.globalAlpha = Math.min(1, (lit ? 0.85 : 0.32) * (0.35 + 0.65 * (avg * 0.5 + 0.5)) * contrast);
        ctx.strokeStyle = lit ? rgba(accentRgb, 1) : rgba(signalRgb, 1);
        ctx.lineWidth = lit ? 1.8 : 1;
        ctx.stroke();
      }

      /* 4 — raios do núcleo até cada matéria */
      for (let nodeIndex = 0; nodeIndex < list.length; nodeIndex++) {
        const node = list[nodeIndex];
        const base = map.get(node.id);
        if (!base) continue;
        const p = rotate(base, yaw, pitch);
        const inner = project([p[0] * 0.14, p[1] * 0.14, p[2] * 0.14]);
        const outer = project(p);
        const lit = activeId === node.id;
        const grad = ctx.createLinearGradient(inner.x, inner.y, outer.x, outer.y);
        grad.addColorStop(0, rgba(accentRgb, 0));
        grad.addColorStop(1, node.color);
        ctx.globalAlpha = Math.min(1, (lit ? 0.9 : 0.34) * (0.3 + 0.7 * (p[2] * 0.5 + 0.5)) * contrast);
        ctx.strokeStyle = grad;
        ctx.lineWidth = lit ? 1.7 : 1;
        ctx.beginPath();
        ctx.moveTo(inner.x, inner.y);
        ctx.lineTo(outer.x, outer.y);
        ctx.stroke();

        // Um sinal percorre cada ligação: a matéria parece trocar informação
        // com a mente, em vez de apenas ficar presa à malha.
        const travel = soft ? 0.58 : (clock * 0.22 + nodeIndex / Math.max(list.length, 1)) % 1;
        const distance = 0.12 + travel * 0.88;
        const packet = rotate([base[0] * distance, base[1] * distance, base[2] * distance], yaw, pitch);
        const packetPoint = project(packet);
        ctx.save();
        ctx.globalAlpha = Math.min(1, (0.34 + (packet[2] * 0.5 + 0.5) * 0.66) * contrast);
        ctx.fillStyle = rgba(signalRgb, 1);
        ctx.shadowColor = rgba(accentRgb, 0.9);
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(packetPoint.x, packetPoint.y, lit ? 2.8 : 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      /* 5 — mente neural: um pequeno sol 3D, sem card ou rótulo no centro. */
      const pulse = soft ? 0.5 : 0.5 + Math.sin(clock * 1.6) * 0.16;
      const coreR = R * 0.31;
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      halo.addColorStop(0, rgba(signalRgb, 0.22 + pulse * 0.18));
      halo.addColorStop(0.4, rgba(accentRgb, 0.15));
      halo.addColorStop(1, rgba(accentRgb, 0));
      ctx.globalAlpha = 1;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      const mindR = R * (0.105 + pulse * 0.012);
      const mind = ctx.createRadialGradient(cx - mindR * 0.34, cy - mindR * 0.4, mindR * 0.06, cx, cy, mindR);
      mind.addColorStop(0, "rgba(255,255,255,0.98)");
      mind.addColorStop(0.22, rgba(signalRgb, 0.96));
      mind.addColorStop(0.62, rgba(accentRgb, 0.88));
      mind.addColorStop(1, rgba(accentRgb, 0.06));
      ctx.save();
      ctx.fillStyle = mind;
      ctx.shadowColor = rgba(accentRgb, 0.9);
      ctx.shadowBlur = R * 0.14;
      ctx.beginPath();
      ctx.arc(cx, cy, mindR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      for (let ring = 0; ring < 3; ring++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((soft ? 0.34 : clock * (0.18 + ring * 0.045)) + ring * 1.05);
        ctx.globalAlpha = 0.22 + ring * 0.08;
        ctx.strokeStyle = ring === 1 ? rgba(signalRgb, 1) : rgba(accentRgb, 1);
        ctx.lineWidth = 0.8 + ring * 0.25;
        ctx.beginPath();
        ctx.ellipse(0, 0, mindR * (1.55 + ring * 0.5), mindR * (0.42 + ring * 0.12), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Contorno atmosférico com brilho frontal deslocado.
      const rim = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      rim.addColorStop(0, rgba(signalRgb, 0.12));
      rim.addColorStop(0.45, rgba(accentRgb, 0.7));
      rim.addColorStop(1, rgba(accentRgb, 0.08));
      ctx.globalAlpha = Math.min(1, 0.72 * contrast);
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.01, 0, Math.PI * 2);
      ctx.stroke();

      /* 6 — pontos das matérias sob os rótulos + posicionamento dos <button> */
      for (const node of list) {
        const base = map.get(node.id);
        if (!base) continue;
        const p = rotate(base, yaw, pitch);
        const { x, y, s } = project(p);
        const front = p[2] >= -0.12;
        const depth = p[2] * 0.5 + 0.5;

        ctx.globalAlpha = 0.18 + 0.55 * depth;
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2.5, 5 * s), 0, Math.PI * 2);
        ctx.fill();

        if (activeId === node.id) {
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = node.color;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(9, 16 * s), 0, Math.PI * 2);
          ctx.stroke();
        }

        const chip = chipRefs.current.get(node.id);
        if (chip) {
          const scale = 0.78 + 0.34 * depth;
          // Rótulo cresce para dentro do globo: encostado na borda direita ele
          // se ancora à direita, na esquerda à esquerda. Em % do próprio chip,
          // então não precisa medir largura (nada de reflow por quadro).
          const bias = Math.max(-1, Math.min(1, (x - cx) / Math.max(R, 1)));
          const anchor = -50 - bias * 42;
          chip.style.transform = `translate3d(${x}px, ${y}px, 0) translate(${anchor.toFixed(1)}%, -50%) scale(${scale.toFixed(3)})`;
          chip.style.opacity = front ? String(0.5 + 0.5 * depth) : "0.16";
          chip.style.zIndex = String(10 + Math.round(depth * 40));
          chip.style.pointerEvents = front ? "auto" : "none";
        }
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  /* --------------------------------------------------------------- arrasto */

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    drag.current = { on: true, x: event.clientX, y: event.clientY, moved: false, id: event.pointerId };
    cam.current.vel = 0;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag.current.on) return;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    drag.current.x = event.clientX;
    drag.current.y = event.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true;
    const state = cam.current;
    state.targetYaw += dx * 0.0065;
    state.targetPitch = Math.max(-1.05, Math.min(1.05, state.targetPitch + dy * 0.005));
    state.vel = dx * 0.09;
  };

  const endDrag = (event: React.PointerEvent) => {
    if (!drag.current.on) return;
    drag.current.on = false;
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture?.(drag.current.id)) target.releasePointerCapture(drag.current.id);
  };

  const hasNodes = nodes.length > 0;

  return (
    <div
      ref={hostRef}
      className={`relative touch-pan-y select-none ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      <p aria-hidden className="pointer-events-none absolute inset-x-0 top-4 z-[55] text-center text-[9px] font-black uppercase tracking-[.24em] text-mint/55">
        rede neural ativa
      </p>

      {nodes.map((node) => (
        <button
          key={node.id}
          type="button"
          ref={setChipRef(node.id)}
          onClick={() => {
            if (drag.current.moved) return;
            onSelect(node.id);
          }}
          onPointerEnter={() => setActive(node.id)}
          onPointerLeave={() => setActive((current) => (current === node.id ? null : current))}
          onFocus={() => {
            setActive(node.id);
            faceNode(node.id);
          }}
          onBlur={() => setActive((current) => (current === node.id ? null : current))}
          aria-label={`${node.label}: ${node.value} ${node.value === 1 ? "conteúdo" : "conteúdos"}, ${node.progress}% estudado${
            node.alert ? `, ${node.alert} ${node.alert === 1 ? "revisão pendente" : "revisões pendentes"}` : ""
          }`}
          className="absolute left-0 top-0 flex min-h-11 max-w-[10.5rem] items-center gap-2 rounded-lg border border-white/12 bg-black/78 px-2.5 py-1.5 text-left shadow-panel backdrop-blur-xl transition-colors duration-200 hover:border-white/35 hover:bg-black/90"
          style={{ willChange: "transform, opacity" }}
        >
          <span
            aria-hidden
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[11px] font-black tabular text-black"
            style={{ backgroundColor: node.color, boxShadow: `0 0 16px ${node.color}66` }}
          >
            {node.value}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-black leading-tight">{node.label}</span>
            <span className="block truncate text-[10px] font-bold text-white/45">{node.hint ?? `${node.progress}% estudado`}</span>
          </span>
          {node.alert ? (
            <span
              aria-hidden
              className="shrink-0 rounded-full bg-amberGlow/20 px-1.5 text-[10px] font-black tabular text-amberGlow"
            >
              {node.alert}
            </span>
          ) : null}
        </button>
      ))}

      {!hasNodes ? (
        <button
          type="button"
          onClick={() => onEmpty?.()}
          className="absolute bottom-5 left-1/2 z-[60] flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-lg border border-dashed border-mint/45 bg-black/50 px-4 text-xs font-black text-mint backdrop-blur-md transition hover:bg-mint/10"
        >
          {emptyLabel}
        </button>
      ) : null}

      {hasNodes ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-3 z-[60] text-center text-[10px] font-black uppercase tracking-[.2em] text-white/25">
          arraste para girar
        </p>
      ) : null}
    </div>
  );
}

export default KnowledgeGlobe;
