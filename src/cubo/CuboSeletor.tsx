/**
 * Dock horizontal compacto de seleção de cubos mágicos (9 tipos em uma única
 * faixa equilibrada no desktop, mantendo o palco 3D 100% acima da dobra).
 * Usa MagicCard spotlight (Magic UI) + mola Awwwards + ícones SVG sob medida.
 */
import React from "react";
import { motion } from "framer-motion";
import { tiposDeCubo, type TipoCubo } from "../../shared/cubo.mjs";
import { CUBO_SPRING, CuboMagicCard } from "./CuboFx";

/** Ícone vetorial geométrico exclusivo para cada tipo de quebra-cabeça. */
export function IconeCubo({ tipo, corA, corB, className = "cubo-tipo-svg" }: { tipo: TipoCubo; corA: string; corB: string; className?: string }) {
  if (tipo === "pyraminx") {
    return (
      <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
        <polygon points="18,4 32,29 4,29" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" opacity="0.35" />
        <polygon points="18,4 22.7,12.3 13.3,12.3" fill={corA} opacity="0.95" />
        <polygon points="13.3,12.3 18,20.7 8.7,20.7" fill={corB} opacity="0.88" />
        <polygon points="22.7,12.3 27.3,20.7 18,20.7" fill={corA} opacity="0.72" />
        <polygon points="18,20.7 13.3,12.3 22.7,12.3" fill="currentColor" opacity="0.22" />
        <polygon points="8.7,20.7 13.3,29 4,29" fill={corA} opacity="0.82" />
        <polygon points="18,20.7 22.7,29 13.3,29" fill={corB} opacity="0.92" />
        <polygon points="27.3,20.7 32,29 22.7,29" fill={corA} opacity="0.65" />
      </svg>
    );
  }

  if (tipo === "mirror") {
    return (
      <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
        <defs>
          <linearGradient id="mirrorGradDock" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
        </defs>
        <rect x="4" y="5" width="7" height="10" rx="1.6" fill="url(#mirrorGradDock)" opacity="0.95" />
        <rect x="12.5" y="4" width="11" height="11" rx="1.6" fill="url(#mirrorGradDock)" opacity="0.78" />
        <rect x="25" y="7" width="7" height="8" rx="1.6" fill="url(#mirrorGradDock)" opacity="0.88" />
        <rect x="4" y="16.5" width="12" height="7" rx="1.6" fill="url(#mirrorGradDock)" opacity="0.72" />
        <rect x="17.5" y="16.5" width="7.5" height="7" rx="1.6" fill="url(#mirrorGradDock)" opacity="0.95" />
        <rect x="26.5" y="16.5" width="5.5" height="14" rx="1.6" fill="url(#mirrorGradDock)" opacity="0.82" />
        <rect x="4" y="25" width="9" height="6.5" rx="1.6" fill="url(#mirrorGradDock)" opacity="0.9" />
        <rect x="14.5" y="25" width="10.5" height="6.5" rx="1.6" fill="url(#mirrorGradDock)" opacity="0.68" />
      </svg>
    );
  }

  if (tipo === "void") {
    const cells = [
      [0, 0], [1, 0], [2, 0],
      [0, 1],         [2, 1],
      [0, 2], [1, 2], [2, 2],
    ];
    return (
      <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
        {cells.map(([cx, cy], i) => (
          <rect
            key={i}
            x={5 + cx * 9}
            y={5 + cy * 9}
            width="7.5"
            height="7.5"
            rx="1.6"
            fill={i % 2 === 0 ? corA : corB}
            opacity="0.92"
          />
        ))}
        <circle cx="18" cy="18" r="3.4" fill="none" stroke={corA} strokeWidth="1.6" strokeDasharray="2 1.5" />
      </svg>
    );
  }

  if (tipo === "2x2x3") {
    return (
      <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
        {[0, 1].map((cx) =>
          [0, 1, 2].map((cy) => (
            <rect
              key={`${cx}-${cy}`}
              x={9 + cx * 9.5}
              y={4 + cy * 9.5}
              width="8"
              height="8"
              rx="1.8"
              fill={(cx + cy) % 2 === 0 ? corA : corB}
              opacity="0.92"
            />
          )),
        )}
      </svg>
    );
  }

  if (tipo === "3x3x2") {
    return (
      <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
        {[0, 1, 2].map((cx) =>
          [0, 1].map((cy) => (
            <rect
              key={`${cx}-${cy}`}
              x={4 + cx * 9.5}
              y={9 + cy * 9.5}
              width="8"
              height="8"
              rx="1.8"
              fill={(cx + cy) % 2 === 0 ? corA : corB}
              opacity="0.92"
            />
          )),
        )}
      </svg>
    );
  }

  // Grade N×N (2×2, 3×3, 4×4, 5×5)
  const n = tipo === "2x2" ? 2 : tipo === "4x4" ? 4 : tipo === "5x5" ? 5 : 3;
  const pad = 4;
  const gap = n >= 5 ? 1.2 : 1.8;
  const cell = (36 - pad * 2 - gap * (n - 1)) / n;
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      {Array.from({ length: n }).map((_, cx) =>
        Array.from({ length: n }).map((__, cy) => (
          <rect
            key={`${cx}-${cy}`}
            x={pad + cx * (cell + gap)}
            y={pad + cy * (cell + gap)}
            width={cell}
            height={cell}
            rx={n >= 5 ? 1 : 1.8}
            fill={(cx + cy) % 2 === 0 ? corA : corB}
            opacity={0.78 + ((cx + cy) % 2) * 0.18}
          />
        )),
      )}
    </svg>
  );
}

export function CuboSeletor({
  ativo,
  desabilitado,
  onSelecionar,
}: {
  ativo: TipoCubo;
  desabilitado: boolean;
  onSelecionar: (tipo: TipoCubo) => void;
}) {
  return (
    <nav className="cubo-dock-wrap" aria-label="Escolher tipo de cubo mágico">
      <div className="cubo-dock" role="radiogroup" aria-label="Tipo de cubo mágico">
        {tiposDeCubo.map((item) => {
          const sel = item.id === ativo;
          return (
            <CuboMagicCard
              key={item.id}
              role="radio"
              aria-checked={sel}
              active={sel}
              disabled={desabilitado}
              colorA={item.corA}
              colorB={item.corB}
              title={`${item.nome} (${item.pecas} peças) — ${item.descricao}`}
              className="cubo-dock-item"
              onClick={() => onSelecionar(item.id)}
            >
              {sel ? <motion.span layoutId="cubo-tipo-ativo" className="cubo-magic-active-ring" transition={CUBO_SPRING} /> : null}
              <span className="cubo-dock-icone" style={{ color: item.corA }}>
                <IconeCubo tipo={item.id} corA={item.corA} corB={item.corB} />
              </span>
              <span className="cubo-dock-rotulo">{item.curto}</span>
              <span className="cubo-dock-dif" aria-hidden="true">
                {[1, 2, 3, 4].map((d) => (
                  <span key={d} className={d <= item.dificuldade ? "is-on" : ""} />
                ))}
              </span>
            </CuboMagicCard>
          );
        })}
      </div>
    </nav>
  );
}
