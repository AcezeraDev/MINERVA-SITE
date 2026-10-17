import React, { useEffect, useMemo, useRef, useState } from "react";
import { MineFace } from "./MineFace";
import "./caderno-mindmap.css";

export type MindNode = {
  id: string;
  label: string;
  color: string;
  /** conteúdos da matéria */
  value: number;
  /** 0–100: quanto já foi estudado */
  progress: number;
  hint?: string;
  /** revisões vencidas */
  alert?: number;
  /** títulos de conteúdos recentes, viram folhinhas do ramo */
  leaves?: string[];
};

type Point = { x: number; y: number };

/**
 * Mapa mental vivo da Início: a Mine no centro e cada matéria como um post-it
 * ligado por um ramo desenhado à caneta (com traço de marca-texto por baixo).
 * "Pensamentos" percorrem os ramos da Mine até as matérias. Os post-its são
 * arrastáveis — o ramo estica junto — e clicar abre a matéria.
 *
 * O desenho usa as medidas reais da caixa (ResizeObserver), em pixels: assim
 * as curvas não deformam e o SVG e os post-its (HTML) ficam no mesmo espaço.
 */
export function LiveMindMap({
  nodes,
  reduced,
  onSelect,
  onEmpty,
}: {
  nodes: MindNode[];
  reduced: boolean;
  onSelect: (id: string) => void;
  onEmpty: () => void;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 640, h: 480 });
  const [offsets, setOffsets] = useState<Record<string, Point>>({});
  const [hover, setHover] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [drawn, setDrawn] = useState(reduced);
  const drag = useRef<{ id: string; x: number; y: number; base: Point; moved: boolean } | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    const node = boxRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // os ramos só se desenham quando a seção aparece na tela
  useEffect(() => {
    if (reduced) {
      setDrawn(true);
      return;
    }
    const node = boxRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setDrawn(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setDrawn(true);
        observer.disconnect();
      }
    }, { threshold: 0.25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  const shown = nodes.slice(0, 8);
  const compact = size.w < 520;
  const center: Point = { x: size.w / 2, y: size.h / 2 };
  const showLeaves = shown.length <= 6 && !compact;

  const layout = useMemo(() => {
    const count = Math.max(shown.length, 1);
    const rx = size.w * (compact ? 0.33 : 0.3);
    const ry = size.h * 0.32;
    return shown.map((node, index) => {
      const angle = -Math.PI / 2 + (index / count) * Math.PI * 2 + (count === 2 ? Math.PI / 5 : 0);
      const base = { x: center.x + Math.cos(angle) * rx, y: center.y + Math.sin(angle) * ry };
      const off = offsets[node.id] || { x: 0, y: 0 };
      const pad = compact ? 58 : 76;
      const pos = {
        x: Math.min(size.w - pad, Math.max(pad, base.x + off.x)),
        y: Math.min(size.h - 44, Math.max(44, base.y + off.y)),
      };
      const leaves = (showLeaves ? node.leaves || [] : []).slice(0, 2).map((title, leafIndex) => {
        const spread = (leafIndex === 0 ? -1 : 1) * 0.42;
        const la = angle + spread;
        const lr = 1.48;
        return {
          title,
          x: Math.min(size.w - 60, Math.max(60, center.x + Math.cos(la) * rx * lr + off.x * 0.6)),
          y: Math.min(size.h - 22, Math.max(22, center.y + Math.sin(la) * ry * lr + off.y * 0.6)),
        };
      });
      return { node, angle, pos, leaves, index };
    });
  }, [shown, size.w, size.h, offsets, compact, showLeaves, center.x, center.y]);

  /** Curva à mão: sai da Mine e chega ao post-it com uma barriga para o lado. */
  const branch = (to: Point, index: number) => {
    const mx = (center.x + to.x) / 2;
    const my = (center.y + to.y) / 2;
    const dx = to.x - center.x;
    const dy = to.y - center.y;
    const len = Math.hypot(dx, dy) || 1;
    const bend = (index % 2 ? 1 : -1) * Math.min(38, len * 0.18);
    const cx = mx + (-dy / len) * bend;
    const cy = my + (dx / len) * bend;
    return `M${center.x.toFixed(1)},${center.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${to.x.toFixed(1)},${to.y.toFixed(1)}`;
  };

  const onPointerDown = (event: React.PointerEvent, id: string) => {
    if (event.button !== 0) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = { id, x: event.clientX, y: event.clientY, base: offsets[id] || { x: 0, y: 0 }, moved: false };
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.moved && Math.hypot(dx, dy) < 5) return;
    current.moved = true;
    if (dragging !== current.id) setDragging(current.id);
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      setOffsets((prev) => ({ ...prev, [current.id]: { x: current.base.x + dx, y: current.base.y + dy } }));
    });
  };
  const onPointerUp = (id: string) => {
    const current = drag.current;
    drag.current = null;
    setDragging(null);
    if (current && !current.moved) onSelect(id);
  };

  return (
    <div ref={boxRef} className={`caderno-mindmap ${drawn ? "is-drawn" : ""} ${hover ? "has-hover" : ""} ${reduced ? "is-static" : ""}`}>
      <svg className="caderno-mindmap-svg" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden>
        {layout.map(({ node, pos, leaves, index }) => {
          const d = branch(pos, index);
          const active = hover === node.id || dragging === node.id;
          return (
            <g key={node.id} className={`mm-branch ${active ? "is-active" : ""}`} style={{ "--c": node.color, "--i": index } as React.CSSProperties}>
              <path className="mm-hl" d={d} pathLength={1} />
              <path className="mm-ink" d={d} pathLength={1} />
              {leaves.map((leaf, leafIndex) => (
                <path key={leafIndex} className="mm-leafline" d={`M${pos.x},${pos.y} L${leaf.x},${leaf.y}`} />
              ))}
              {!reduced ? (
                <circle className="mm-pulse" r={active ? 5 : 3.6}>
                  <animateMotion dur={`${2.6 + (index % 3) * 0.5}s`} begin={`${1.4 + index * 0.45}s`} repeatCount="indefinite" path={d} />
                </circle>
              ) : null}
            </g>
          );
        })}
        {!shown.length
          ? [0, 1, 2].map((index) => {
              const angle = -Math.PI / 2 + (index / 3) * Math.PI * 2;
              const to = { x: center.x + Math.cos(angle) * size.w * 0.3, y: center.y + Math.sin(angle) * size.h * 0.3 };
              return <path key={index} className="mm-ghost" d={branch(to, index)} />;
            })
          : null}
      </svg>

      {/* folhinhas: conteúdos recentes de cada matéria */}
      {layout.flatMap(({ node, leaves, index }) =>
        leaves.map((leaf, leafIndex) => (
          <span
            key={`${node.id}-${leafIndex}`}
            className={`mm-leaf ${hover === node.id ? "is-active" : ""}`}
            style={{ left: leaf.x, top: leaf.y, "--delay": `${0.9 + index * 0.12 + leafIndex * 0.1}s` } as React.CSSProperties}
            title={leaf.title}
          >
            {leaf.title}
          </span>
        )),
      )}

      {/* a Mine no centro */}
      <div className="mm-center" style={{ left: center.x, top: center.y }}>
        <span className="mm-center-ring" aria-hidden />
        <span className="mm-center-face">
          <MineFace track={!reduced} />
        </span>
        <span className="mm-center-label">você + Mine</span>
      </div>

      {/* matérias como post-its */}
      {layout.map(({ node, pos, index }) => (
        <button
          key={node.id}
          type="button"
          className={`mm-note ${dragging === node.id ? "is-dragging" : ""}`}
          style={{ left: pos.x, top: pos.y, "--c": node.color, "--delay": `${0.45 + index * 0.12}s`, "--tilt": `${((index * 53) % 9) - 4}deg` } as React.CSSProperties}
          onPointerDown={(event) => onPointerDown(event, node.id)}
          onPointerMove={onPointerMove}
          onPointerUp={() => onPointerUp(node.id)}
          onPointerCancel={() => {
            drag.current = null;
            setDragging(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelect(node.id);
            }
          }}
          onPointerEnter={() => setHover(node.id)}
          onPointerLeave={() => setHover((value) => (value === node.id ? null : value))}
          onFocus={() => setHover(node.id)}
          onBlur={() => setHover(null)}
          aria-label={`${node.label}: ${node.hint || ""}${node.alert ? `, ${node.alert} revisões vencidas` : ""}. Abrir matéria.`}
        >
          <span className="mm-note-inner">
            {node.alert ? <span className="mm-note-alert">{node.alert}</span> : null}
            <span className="mm-note-name">{node.label}</span>
            <span className="mm-note-bar">
              <i style={{ transform: `scaleX(${Math.max(0.04, node.progress / 100)})` }} />
            </span>
            <span className="mm-note-hint">{node.hint}</span>
          </span>
        </button>
      ))}

      {!shown.length ? (
        <button type="button" className="mm-note is-empty" style={{ left: center.x, top: Math.min(size.h - 50, center.y + size.h * 0.32), "--c": "#F4F05A", "--delay": "0.5s", "--tilt": "-3deg" } as React.CSSProperties} onClick={onEmpty}>
          <span className="mm-note-inner">
            <span className="mm-note-name">+ Nova matéria</span>
            <span className="mm-note-hint">a primeira ideia do mapa</span>
          </span>
        </button>
      ) : null}

      <p className="mm-hint">{shown.length ? "arraste os post-its · clique para abrir" : "crie uma matéria para o mapa crescer"}</p>
    </div>
  );
}
