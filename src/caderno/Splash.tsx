import React, { useEffect, useId } from "react";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import { Doodle } from "./index";
import { MineFace } from "./MineFace";
import "./caderno-splash.css";

/*
  Abertura do Minerva: a mesa de estudo ganha vida e o caderno se abre.

  Linha do tempo (s):
  0.00–0.9  objetos do estojo deslizam para a mesa (lápis, marca-texto,
            post-its, clipe, borracha) e ficam flutuando de leve
  0.10–0.8  o caderno cai na mesa com um quique; a sombra amassa no impacto
  0.35–1.0  figurinhas colam na capa, a etiqueta se escreve
  0.95–1.2  o elástico escorrega
  1.20–2.1  a capa abre; três folhas passam logo atrás; papel picado
  2.00–3.0  a primeira página se escreve: data, "Oi, fulano!", grifo, estrela
  2.10–3.1  a Mine é desenhada no canto da página
  3.8       a câmera mergulha na folha (saída do AnimatePresence)
*/

const spring = (delay: number, stiffness = 170, damping = 16): Transition => ({ type: "spring", stiffness, damping, delay });

function Pencil() {
  return (
    <svg viewBox="0 0 220 40" aria-hidden>
      <rect x="0" y="8" width="26" height="24" rx="6" fill="rgb(var(--hl-pink))" />
      <rect x="24" y="6" width="14" height="28" fill="#b8c1ce" />
      <rect x="38" y="6" width="140" height="28" fill="rgb(var(--hl-yellow))" />
      <rect x="38" y="6" width="140" height="9" fill="#fff" opacity=".35" />
      <path d="M178 6 L214 20 L178 34 Z" fill="#e9c58d" />
      <path d="M202 15.5 L214 20 L202 24.5 Z" fill="#2b2d33" />
    </svg>
  );
}

function Highlighter() {
  return (
    <svg viewBox="0 0 200 44" aria-hidden>
      <rect x="0" y="6" width="150" height="32" rx="10" fill="rgb(var(--mint))" />
      <rect x="12" y="12" width="90" height="6" rx="3" fill="#fff" opacity=".4" />
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
        stroke="#9aa3b2"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CadernoSplash({ onSkip, name, brand }: { onSkip: () => void; name?: string; brand: React.ReactNode }) {
  const reduce = Boolean(useReducedMotion()) || (typeof document !== "undefined" && document.documentElement.classList.contains("no-motion"));
  const titleId = useId();
  const first = (name || "").trim().split(/\s+/)[0];
  // nome comprido (ou login como "maria2026") não pode estourar a folha
  const longName = first.length > 9;
  // no celular o caderno aberto não cabe: fica parado e mostra a página do "Oi!"
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
      exit={reduce ? { opacity: 0, transition: { duration: 0.2 } } : { opacity: 0, scale: 1.35, transition: { duration: 0.65, ease: [0.5, 0, 0.3, 1] } }}
      onClick={onSkip}
    >
      <button type="button" className="caderno-splash-skip" onClick={onSkip}>
        pular →
      </button>

      {/* ───────── a mesa: objetos do estojo ───────── */}
      <div className="splash-desk" aria-hidden>
        <motion.span className="splash-item splash-pencil" initial={from({ x: -420, y: 120, rotate: -70 })} animate={{ x: 0, y: 0, rotate: -24 }} transition={t(spring(0.05, 90, 15))}>
          <span className="splash-float">
            <Pencil />
          </span>
        </motion.span>
        <motion.span className="splash-item splash-marker" initial={from({ x: 420, y: -80, rotate: 80 })} animate={{ x: 0, y: 0, rotate: 18 }} transition={t(spring(0.15, 90, 15))}>
          <span className="splash-float">
            <Highlighter />
          </span>
        </motion.span>
        <motion.span className="splash-item splash-note splash-note-a" initial={from({ y: -380, rotate: -40 })} animate={{ y: 0, rotate: 7 }} transition={t(spring(0.25, 110, 14))}>
          <span className="splash-float">
            <span className="splash-note-paper">
              prova sexta!
              <Doodle kind="star" className="splash-note-star" delay={reduce ? 0 : 900} duration={600} strokeWidth={3} />
            </span>
          </span>
        </motion.span>
        <motion.span className="splash-item splash-note splash-note-b" initial={from({ y: 380, rotate: 40 })} animate={{ y: 0, rotate: -6 }} transition={t(spring(0.35, 110, 14))}>
          <span className="splash-float">
            <span className="splash-note-paper is-pink">
              revisar mitose
              <Doodle kind="check" className="splash-note-check" delay={reduce ? 0 : 1100} duration={500} strokeWidth={4} />
            </span>
          </span>
        </motion.span>
        <motion.span className="splash-item splash-clip" initial={from({ y: -300, x: 120, rotate: 120 })} animate={{ y: 0, x: 0, rotate: 22 }} transition={t(spring(0.4, 120, 13))}>
          <span className="splash-float">
            <Paperclip />
          </span>
        </motion.span>
        <motion.span className="splash-item splash-eraser" initial={from({ x: 300, y: 260, rotate: 90 })} animate={{ x: 0, y: 0, rotate: -14 }} transition={t(spring(0.5, 120, 13))}>
          <span className="splash-float">
            <span className="splash-eraser-block">
              <i />
            </span>
          </span>
        </motion.span>
        {[
          { kind: "sparkle" as const, cls: "splash-spark-a", delay: 700 },
          { kind: "star" as const, cls: "splash-spark-b", delay: 950 },
          { kind: "heart" as const, cls: "splash-spark-c", delay: 1200 },
          { kind: "spiral" as const, cls: "splash-spark-d", delay: 1450 },
        ].map((item) => (
          <span key={item.cls} className={`splash-item splash-spark ${item.cls}`}>
            <Doodle kind={item.kind} delay={reduce ? 0 : item.delay} duration={800} strokeWidth={2.6} />
          </span>
        ))}
      </div>

      {/* ───────── o caderno ───────── */}
      {/* quando a capa abre, o caderno anda meia capa para a direita: aberto,
          ele fica no centro da mesa em vez de cobrir o lápis e o post-it */}
      <motion.div
        className="splash-book-wrap"
        initial={from({ y: -520, x: "0%", rotate: -14, scale: 0.9 })}
        animate={{ y: 0, x: reduce ? shift : ["0%", "0%", shift], rotate: -3, scale: 1 }}
        transition={reduce ? { duration: 0 } : { ...spring(0.1, 120, 13), x: { duration: 2.15, times: [0, 0.56, 1], ease: [0.55, 0, 0.25, 1] } }}
      >
        <motion.span
          className="splash-book-shadow"
          aria-hidden
          initial={from({ scaleX: 0.3, opacity: 0 })}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={t({ delay: 0.35, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] })}
        />
        <div className="splash-book">
          {/* primeira página */}
          <div className="splash-page">
            <motion.p className="splash-page-date" initial={from({ opacity: 0, x: 10 })} animate={{ opacity: 1, x: 0 }} transition={t({ delay: 1.95, duration: 0.4 })}>
              {date}
            </motion.p>
            <motion.p
              className="splash-page-hello"
              initial={from({ clipPath: "inset(0 100% 0 0)" })}
              animate={{ clipPath: "inset(0 0% 0 0)" }}
              transition={t({ delay: 2.05, duration: 0.75, ease: "linear" })}
            >
              <span className={longName ? "is-long" : undefined}>{first ? `Oi, ${first}!` : "Oi!"}</span>
            </motion.p>
            <motion.p
              className="splash-page-line"
              initial={from({ clipPath: "inset(0 100% 0 0)" })}
              animate={{ clipPath: "inset(0 0% 0 0)" }}
              transition={t({ delay: 2.7, duration: 0.55, ease: "linear" })}
            >
              <span className="splash-page-hl">bora estudar?</span>
            </motion.p>
            <Doodle kind="underline" className="splash-page-underline" delay={reduce ? 0 : 3100} duration={450} strokeWidth={3} />
            <Doodle kind="star" className="splash-page-star" delay={reduce ? 0 : 3000} duration={500} strokeWidth={3} />
            <span className="splash-page-mine">
              <MineFace draw={!reduce} />
            </span>
          </div>

          {/* folhas passando */}
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              className="splash-leaf"
              aria-hidden
              style={{ zIndex: 5 - index }}
              initial={from({ rotateY: 0 })}
              animate={{ rotateY: -176 + index * 3 }}
              transition={t({ delay: 1.34 + index * 0.13, duration: 0.85, ease: [0.5, 0, 0.25, 1] })}
            >
              {/* a última folha a virar é a página da esquerda do caderno aberto */}
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

          {/* capa */}
          <motion.div
            className="splash-cover"
            initial={from({ rotateY: 0 })}
            animate={{ rotateY: -178 }}
            transition={t({ delay: 1.2, duration: 0.95, ease: [0.55, 0, 0.25, 1] })}
          >
            <div className="splash-cover-front">
              <span className="splash-cover-brand">{brand}</span>
              {[
                { cls: "is-star", text: "★", delay: 0.45 },
                { cls: "is-heart", text: "♥", delay: 0.58 },
                { cls: "is-grade", text: "A+", delay: 0.71 },
              ].map((sticker) => (
                <motion.span
                  key={sticker.cls}
                  className={`splash-sticker ${sticker.cls}`}
                  aria-hidden
                  initial={from({ scale: 0, rotate: -40 })}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={t(spring(sticker.delay, 500, 14))}
                >
                  {sticker.text}
                </motion.span>
              ))}
              <motion.span className="splash-sticker is-mine" aria-hidden initial={from({ scale: 0, rotate: 40 })} animate={{ scale: 1, rotate: -8 }} transition={t(spring(0.84, 500, 14))}>
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
                  transition={t({ delay: 0.55, duration: 0.6, ease: "linear" })}
                >
                  {first ? `caderno de ${first}` : "meu caderno"}
                </motion.p>
              </div>
            </div>
            <div className="splash-cover-back" />
          </motion.div>

          <span className="splash-spiral" aria-hidden />

          {/* elástico */}
          <motion.span
            className="splash-band"
            aria-hidden
            initial={from({ x: 0, rotate: 0, opacity: 1 })}
            animate={{ x: 90, rotate: 14, opacity: 0 }}
            transition={t({ delay: 0.95, duration: 0.4, ease: [0.5, 0, 0.8, 0.4] })}
          />
        </div>

        {/* papel picado quando o caderno abre */}
        {!reduce ? (
          <span className="splash-confetti" aria-hidden>
            {Array.from({ length: 16 }, (_, index) => (
              <i
                key={index}
                style={
                  {
                    "--a": `${index * 22.5}deg`,
                    "--d": `${120 + (index % 4) * 40}px`,
                    "--c": `rgb(var(${["--hl-yellow", "--hl-pink", "--mint", "--hl-lilac"][index % 4]}))`,
                  } as React.CSSProperties
                }
              />
            ))}
          </span>
        ) : null}
      </motion.div>

      <motion.p className="splash-hint" initial={from({ opacity: 0 })} animate={{ opacity: 1 }} transition={t({ delay: 1.6, duration: 0.6 })}>
        toque para entrar
      </motion.p>
    </motion.div>
  );
}
