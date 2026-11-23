/**
 * Galeria seletora de tipos de Cubo Mágico com MagicCard spotlight (Magic UI),
 * ícones geométricos SVG sob medida e transições por física de mola (Awwwards motion).
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { tiposDeCubo, type CategoriaCubo, type TipoCubo } from "../../shared/cubo.mjs";
import { CUBO_SPRING, CuboMagicCard } from "./CuboFx";

type Filtro = "todos" | CategoriaCubo;

const FILTROS: Array<{ id: Filtro; rotulo: string }> = [
  { id: "todos", rotulo: "Todos (9)" },
  { id: "classicos", rotulo: "Clássicos" },
  { id: "especiais", rotulo: "Especiais" },
  { id: "cuboides", rotulo: "Cuboides" },
  { id: "poliedros", rotulo: "Poliedros" },
];

const ETIQUETA_CAT: Record<CategoriaCubo, string> = {
  classicos: "Clássico",
  especiais: "Especial",
  cuboides: "Cuboide",
  poliedros: "Poliedro",
};

/** Ícone vetorial geométrico exclusivo para cada tipo de quebra-cabeça. */
function IconeCubo({ tipo, corA, corB }: { tipo: TipoCubo; corA: string; corB: string }) {
  if (tipo === "pyraminx") {
    return (
      <svg viewBox="0 0 36 36" className="cubo-tipo-svg" aria-hidden="true">
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
      <svg viewBox="0 0 36 36" className="cubo-tipo-svg" aria-hidden="true">
        <defs>
          <linearGradient id="mirrorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
        </defs>
        <rect x="4" y="5" width="7" height="10" rx="1.6" fill="url(#mirrorGrad)" opacity="0.95" />
        <rect x="12.5" y="4" width="11" height="11" rx="1.6" fill="url(#mirrorGrad)" opacity="0.78" />
        <rect x="25" y="7" width="7" height="8" rx="1.6" fill="url(#mirrorGrad)" opacity="0.88" />
        <rect x="4" y="16.5" width="12" height="7" rx="1.6" fill="url(#mirrorGrad)" opacity="0.72" />
        <rect x="17.5" y="16.5" width="7.5" height="7" rx="1.6" fill="url(#mirrorGrad)" opacity="0.95" />
        <rect x="26.5" y="16.5" width="5.5" height="14" rx="1.6" fill="url(#mirrorGrad)" opacity="0.82" />
        <rect x="4" y="25" width="9" height="6.5" rx="1.6" fill="url(#mirrorGrad)" opacity="0.9" />
        <rect x="14.5" y="25" width="10.5" height="6.5" rx="1.6" fill="url(#mirrorGrad)" opacity="0.68" />
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
      <svg viewBox="0 0 36 36" className="cubo-tipo-svg" aria-hidden="true">
        {cells.map(([cx, cy], i) => (
          <rect
            key={i}
            x={5 + cx * 9}
            y={5 + cy * 9}
            width="7.5"
            height="7.5"
            rx="1.6"
            fill={i % 2 === 0 ? corA : corB}
            opacity="0.9"
          />
        ))}
        <circle cx="18" cy="18" r="3.4" fill="none" stroke={corA} strokeWidth="1.6" strokeDasharray="2 1.5" />
      </svg>
    );
  }

  if (tipo === "2x2x3") {
    return (
      <svg viewBox="0 0 36 36" className="cubo-tipo-svg" aria-hidden="true">
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
              opacity="0.9"
            />
          )),
        )}
      </svg>
    );
  }

  if (tipo === "3x3x2") {
    return (
      <svg viewBox="0 0 36 36" className="cubo-tipo-svg" aria-hidden="true">
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
              opacity="0.9"
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
    <svg viewBox="0 0 36 36" className="cubo-tipo-svg" aria-hidden="true">
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
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const visiveis = filtro === "todos" ? tiposDeCubo : tiposDeCubo.filter((t) => t.categoria === filtro);

  return (
    <section className="cubo-colecao" aria-label="Coleção de cubos mágicos">
      <div className="cubo-colecao-topo">
        <div className="cubo-colecao-titulo-wrap">
          <span className="cubo-colecao-eyebrow">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Coleção 3D Interativa
          </span>
          <span className="cubo-colecao-hint">Escolha o desafio — cada cubo tem física, geometria e recordes próprios</span>
        </div>

        <div className="cubo-cat-pills" role="tablist" aria-label="Filtrar por categoria">
          {FILTROS.map((f) => {
            const sel = filtro === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={sel}
                className={`cubo-cat-pill ${sel ? "is-ativo" : ""}`}
                onClick={() => setFiltro(f.id)}
              >
                {sel ? <motion.span layoutId="cubo-cat-ativo" className="cubo-cat-pill-bg" transition={CUBO_SPRING} /> : null}
                <span className="relative z-10">{f.rotulo}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="cubo-tipos-grid" role="radiogroup" aria-label="Tipo de cubo mágico">
        {visiveis.map((item) => {
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
              title={item.descricao}
              onClick={() => onSelecionar(item.id)}
            >
              {sel ? <motion.span layoutId="cubo-tipo-ativo" className="cubo-magic-active-ring" transition={CUBO_SPRING} /> : null}
              <div className="cubo-tipo-cabeca">
                <span className="cubo-tipo-icone" style={{ color: item.corA }}>
                  <IconeCubo tipo={item.id} corA={item.corA} corB={item.corB} />
                </span>
                <div className="cubo-tipo-meta">
                  <span className="cubo-tipo-nome">{item.nome}</span>
                  <span className="cubo-tipo-sub">
                    {ETIQUETA_CAT[item.categoria]} · {item.pecas} peças
                  </span>
                </div>
                <span className="cubo-tipo-dif" aria-label={`Dificuldade ${item.dificuldade} de 4`}>
                  {[1, 2, 3, 4].map((d) => (
                    <span key={d} className={d <= item.dificuldade ? "is-on" : ""} />
                  ))}
                </span>
              </div>
              <p className="cubo-tipo-desc">{item.descricao}</p>
            </CuboMagicCard>
          );
        })}
      </div>
    </section>
  );
}
