import React, { useEffect, useId, useMemo, useState } from "react";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import { useQualityTier } from "../motion";
import { Doodle } from "./index";
import { MineFace } from "./MineFace";
import "./caderno-splash.css";

const Splash3D = React.lazy(() => import("./Splash3D"));

/*
  Abertura do Minerva: a mesa de estudo ganha vida em 2D + 3D e o caderno se abre.

  Linha do tempo (s):
  0.00–0.9  camada 3D (átomo, cristal, mini cubo, partículas GLSL) + objetos do
            estojo 2D entram com física de mola (stiffness 300, damping 30)
  0.10–0.8  o caderno cai na mesa com quique + brilho especular deslizante
  0.35–1.0  figurinhas colam na capa com mola, a etiqueta se escreve
  0.95–1.25 o elástico estica e escapa com efeito elástico
  1.20–2.1  a capa abre com reflexo dinâmico; três folhas passam; papel picado
            2D + pulso de partículas 3D explodem juntos
  2.00–3.0  a primeira página se escreve: data, "Oi, fulano!", grifo, estrela
  2.10–3.1  a Mine é desenhada no canto da página
  3.8       a câmera mergulha na folha (saída do AnimatePresence)
*/

const spring = (delay: number, stiffness = 300, damping = 24): Transition => ({
  type: "spring",
  stiffness,
  damping,
  mass: 1,
  delay,
});

function webglReady() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

class Splash3DBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Pencil() {
  return (
    <svg viewBox="0 0 220 40" aria-hidden>
      <rect x="0" y="8" width="26" height="24" rx="6" fill="rgb(var(--hl-pink))" />
      <rect x="24" y="6" width="14" height="28" fill="#b8c1ce" />
      <rect x="38" y="6" width="140" height="28" fill="rgb(var(--hl-yellow))" />
      <rect x="38" y="6" width="140" height="9" fill="#fff" opacity=".38" />
      <path d="M178 6 L214 20 L178 34 Z" fill="#e9c58d" />
      <path d="M202 15.5 L214 20 L202 24.5 Z" fill="#2b2d33" />
    </svg>
  );
}

function Highlighter() {
  return (
    <svg viewBox="0 0 200 44" aria-hidden>
      <rect x="0" y="6" width="150" height="32" rx="10" fill="rgb(var(--mint))" />
      <rect x="12" y="12" width="90" height="6" rx="3" fill="#fff" opacity=".45" />
      <rect x="146" y="10" width="30" height="24" rx="4" fill="#1f2330" />
      <path d="M176 14 L196 18 L196 26 L176 30 Z" fill="rgb(var(--mint))" />
    </svg>
  );
}

function Paperclip() {
  return (
    <svg viewBox="0 0 40 90" aria-hidden>
      <path
        d="M28 22 L28 70 C 28 84, 10 84, 10 70 L 10 16 C 10 6, 22 6, 22 16 L 22 64"
        fill="none"
        stroke="#aeb8c9"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CadernoSplash({ onSkip, name, brand }: { onSkip: () => void; name?: string; brand: React.ReactNode }) {
  const reduce = Boolean(useReducedMotion()) || (typeof document !== "undefined" && document.documentElement.classList.contains("no-motion"));
  const tier = useQualityTier();
  const [canWebgl] = useState(() => (typeof window !== "undefined" ? webglReady() : false));
  const show3d = useMemo(() => !reduce && tier !== "low" && canWebgl, [reduce, tier, canWebgl]);

  const titleId = useId();
  const first = (name || "").trim().split(/\s+/)[0];
  const longName = first.length > 9;
  const shift = typeof window !== "undefined" && window.innerWidth >= 760 ? "50%" : "0%";
  const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date()).replace(".", "");

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onSkip]);

  const t = (value: Transition): Transition => (reduce ? { duration: 0 } : value);
  const from = (value: Record<string, number | string>) => (reduce ? false : value);

  return (
    <motion.div
      className={`caderno-splash ${reduce ? "is-static" : ""}`}
      role="dialog"
      aria-labelledby={titleId}
      initial={{ opacity: 1 }}
      exit={reduce ? { opacity: 0, transition: { duration: 0.2 } } : { opacity: 0, scale: 1.32, transition: { duration: 0.62, ease: [0.5, 0, 0.3, 1] } }}
      onClick={onSkip}
    >
      {/* ───────── camada 3D em Three.js (elementos PBR + shaders GLSL) ───────── */}
      {show3d ? (
        <Splash3DBoundary>
          <React.Suspense fallback={null}>
            <Splash3D />
          </React.Suspense>
        </Splash3DBoundary>
      ) : null}

      <motion.button
        type="button"
        className="caderno-splash-skip"
        onClick={(event) => {
          event.stopPropagation();
          onSkip();
        }}
        whileHover={reduce ? undefined : { scale: 1.05, y: -1 }}
        whileTap={reduce ? undefined : { scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
      >
        pular →
      </motion.button>

      {/* ───────── a mesa 2D: objetos do estojo com entrada em mola ───────── */}
      <div className="splash-desk" aria-hidden>
        <motion.span className="splash-item splash-pencil" initial={from({ x: -380, y: 120, rotate: -65, scale: 0.85 })} animate={{ x: 0, y: 0, rotate: -22, scale: 1 }} transition={t(spring(0.05, 190, 20))}>
          <span className="splash-float">
            <Pencil />
          </span>
        </motion.span>
        <motion.span className="splash-item splash-marker" initial={from({ x: 380, y: -70, rotate: 75, scale: 0.85 })} animate={{ x: 0, y: 0, rotate: 16, scale: 1 }} transition={t(spring(0.14, 190, 20))}>
          <span className="splash-float">
            <Highlighter />
          </span>
        </motion.span>
        <motion.span className="splash-item splash-note splash-note-a" initial={from({ y: 320, rotate: -32, scale: 0.82 })} animate={{ y: 0, rotate: 6, scale: 1 }} transition={t(spring(0.22, 210, 20))}>
          <span className="splash-float">
            <span className="splash-note-paper">
              prova sexta!
              <Doodle kind="star" className="splash-note-star" delay={reduce ? 0 : 850} duration={560} strokeWidth={3} />
            </span>
          </span>
        </motion.span>
        <motion.span className="splash-item splash-note splash-note-b" initial={from({ y: -300, rotate: 34, scale: 0.82 })} animate={{ y: 0, rotate: -5, scale: 1 }} transition={t(spring(0.3, 210, 20))}>
          <span className="splash-float">
            <span className="splash-note-paper is-pink">
              revisar mitose
              <Doodle kind="check" className="splash-note-check" delay={reduce ? 0 : 1050} duration={480} strokeWidth={4} />
            </span>
          </span>
        </motion.span>
        <motion.span className="splash-item splash-clip" initial={from({ y: -260, x: 110, rotate: 110, scale: 0.7 })} animate={{ y: 0, x: 0, rotate: 22, scale: 1 }} transition={t(spring(0.36, 220, 19))}>
          <span className="splash-float">
            <Paperclip />
          </span>
        </motion.span>
        <motion.span className="splash-item splash-eraser" initial={from({ x: 260, y: 240, rotate: 85, scale: 0.8 })} animate={{ x: 0, y: 0, rotate: -14, scale: 1 }} transition={t(spring(0.42, 220, 19))}>
          <span className="splash-float">
            <span className="splash-eraser-block">
              <i />
            </span>
          </span>
        </motion.span>
        {[
          { kind: "sparkle" as const, cls: "splash-spark-a", delay: 650 },
          { kind: "star" as const, cls: "splash-spark-b", delay: 900 },
          { kind: "heart" as const, cls: "splash-spark-c", delay: 1150 },
          { kind: "spiral" as const, cls: "splash-spark-d", delay: 1400 },
        ].map((item) => (
          <span key={item.cls} className={`splash-item splash-spark ${item.cls}`}>
            <Doodle kind={item.kind} delay={reduce ? 0 : item.delay} duration={750} strokeWidth={2.6} />
          </span>
        ))}
      </div>

      {/* ───────── o caderno (com quique de mola) ───────── */}
      <motion.div
        className="splash-book-wrap"
        initial={from({ y: -480, x: "0%", rotate: -14, scale: 0.86 })}
        animate={{ y: 0, x: reduce ? shift : ["0%", "0%", shift], rotate: -2.5, scale: 1 }}
        transition={
          reduce
            ? { duration: 0 }
            : {
                ...spring(0.08, 175, 16),
                x: { duration: 2.1, times: [0, 0.56, 1], ease: [0.55, 0, 0.25, 1] },
              }
        }
      >
        <motion.span
          className="splash-book-shadow"
          aria-hidden
          initial={from({ scaleX: 0.28, opacity: 0 })}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={t(spring(0.28, 160, 18))}
        />
        <div className="splash-book">
          {/* primeira página */}
          <div className="splash-page">
            <motion.p className="splash-page-date" initial={from({ opacity: 0, x: 10 })} animate={{ opacity: 1, x: 0 }} transition={t(spring(1.92, 260, 26))}>
              {date}
            </motion.p>
            <motion.p
              className="splash-page-hello"
              initial={from({ clipPath: "inset(0 100% 0 0)" })}
              animate={{ clipPath: "inset(0 0% 0 0)" }}
              transition={t({ delay: 2.02, duration: 0.72, ease: [0.22, 1, 0.36, 1] })}
            >
              <span className={longName ? "is-long" : undefined}>{first ? `Oi, ${first}!` : "Oi!"}</span>
            </motion.p>
            <motion.p
              className="splash-page-line"
              initial={from({ clipPath: "inset(0 100% 0 0)" })}
              animate={{ clipPath: "inset(0 0% 0 0)" }}
              transition={t({ delay: 2.66, duration: 0.52, ease: [0.22, 1, 0.36, 1] })}
            >
              <span className="splash-page-hl">bora estudar?</span>
            </motion.p>
            <Doodle kind="underline" className="splash-page-underline" delay={reduce ? 0 : 3050} duration={450} strokeWidth={3} />
            <Doodle kind="star" className="splash-page-star" delay={reduce ? 0 : 2950} duration={500} strokeWidth={3} />
            <span className="splash-page-mine">
              <MineFace draw={!reduce} />
            </span>
          </div>

          {/* folhas passando com sombreado de dobra */}
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              className="splash-leaf"
              aria-hidden
              style={{ zIndex: 5 - index }}
              initial={from({ rotateY: 0 })}
              animate={{ rotateY: -176 + index * 3 }}
              transition={t({ delay: 1.32 + index * 0.13, duration: 0.84, ease: [0.48, 0, 0.22, 1] })}
            >
              {index === 2 ? (
                <div className="splash-leaf-back">
                  <p className="splash-owner-kicker">este caderno pertence a</p>
                  <p className={`splash-owner-name ${longName ? "is-long" : ""}`}>{first || "você"}</p>
                  <p className="splash-owner-line">
                    turma <span />
                  </p>
                  <div className="splash-goals">
                    <span className="splash-polaroid-tape" />
                    <p className="splash-goals-title">metas</p>
                    <p className="is-done">
                      <span className="splash-goals-check" aria-hidden>✓</span> abrir o caderno
                    </p>
                    <p>
                      <span className="splash-goals-box" /> estudar um pouco
                    </p>
                    <p>
                      <span className="splash-goals-box" /> perguntar à Mine
                    </p>
                  </div>
                  <p className="splash-owner-note">se achar, devolva! :)</p>
                </div>
              ) : null}
            </motion.div>
          ))}

          {/* capa com brilho especular deslizante */}
          <motion.div
            className="splash-cover"
            initial={from({ rotateY: 0 })}
            animate={{ rotateY: -178 }}
            transition={t({ delay: 1.18, duration: 0.94, ease: [0.52, 0, 0.22, 1] })}
          >
            <div className="splash-cover-front">
              <span className="splash-cover-sheen" aria-hidden />
              <span className="splash-cover-brand">{brand}</span>
              {[
                { cls: "is-star", text: "★", delay: 0.42 },
                { cls: "is-heart", text: "♥", delay: 0.54 },
                { cls: "is-grade", text: "A+", delay: 0.66 },
              ].map((sticker) => (
                <motion.span
                  key={sticker.cls}
                  className={`splash-sticker ${sticker.cls}`}
                  aria-hidden
                  initial={from({ scale: 0, rotate: -40 })}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={t(spring(sticker.delay, 420, 16))}
                >
                  {sticker.text}
                </motion.span>
              ))}
              <motion.span
                className="splash-sticker is-mine"
                aria-hidden
                initial={from({ scale: 0, rotate: 40 })}
                animate={{ scale: 1, rotate: -8 }}
                transition={t(spring(0.78, 420, 16))}
              >
                <MineFace />
              </motion.span>
              <div className="splash-cover-label">
                <p id={titleId} className="splash-cover-title">
                  Minerva
                </p>
                <motion.p
                  className="splash-cover-owner"
                  initial={from({ clipPath: "inset(0 100% 0 0)" })}
                  animate={{ clipPath: "inset(0 0% 0 0)" }}
                  transition={t({ delay: 0.52, duration: 0.58, ease: [0.22, 1, 0.36, 1] })}
                >
                  {first ? `caderno de ${first}` : "meu caderno"}
                </motion.p>
              </div>
            </div>
            <div className="splash-cover-back" />
          </motion.div>

          <span className="splash-spiral" aria-hidden />

          {/* elástico com esticada e escape físico */}
          <motion.span
            className="splash-band"
            aria-hidden
            initial={from({ x: 0, rotate: 0, scaleX: 1, opacity: 1 })}
            animate={reduce ? { opacity: 0 } : { x: [0, -8, 96], rotate: [0, -3, 18], scaleX: [1, 1.35, 0.7], opacity: [1, 1, 0] }}
            transition={t({ delay: 0.9, duration: 0.42, times: [0, 0.25, 1], ease: [0.4, 0, 0.2, 1] })}
          />
        </div>

        {/* papel picado sincronizado com a abertura da capa */}
        {!reduce ? (
          <span className="splash-confetti" aria-hidden>
            {Array.from({ length: 24 }, (_, index) => (
              <i
                key={index}
                style={
                  {
                    "--a": `${index * 15}deg`,
                    "--d": `${115 + (index % 5) * 38}px`,
                    "--c": `rgb(var(${["--hl-yellow", "--hl-pink", "--mint", "--hl-lilac"][index % 4]}))`,
                  } as React.CSSProperties
                }
              />
            ))}
          </span>
        ) : null}
      </motion.div>

      <motion.p
        className="splash-hint"
        initial={from({ opacity: 0, y: 12 })}
        animate={{ opacity: 1, y: 0 }}
        transition={t(spring(1.55, 240, 26))}
      >
        toque para entrar
      </motion.p>
    </motion.div>
  );
}
