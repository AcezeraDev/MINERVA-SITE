import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Doodle, type DoodleKind } from "./index";
import { MineFace } from "./MineFace";

export type WelcomePrompt = {
  key: string;
  title: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
};

/**
 * Rabiscos de estudo em volta da Mine. `x`/`y` em % da cena, `depth` é o
 * quanto cada um segue o mouse (os mais "perto" andam mais).
 */
const scribbles: Array<{ kind?: DoodleKind; text?: string; x: number; y: number; size: number; depth: number; tilt: number; tone: string }> = [
  { text: "π", x: 8, y: 14, size: 2.4, depth: 14, tilt: -10, tone: "pen" },
  { kind: "star", x: 88, y: 10, size: 2.2, depth: 18, tilt: 12, tone: "yellow" },
  { text: "E = mc²", x: 80, y: 30, size: 1.35, depth: 10, tilt: 6, tone: "pen" },
  { kind: "bulb", x: 14, y: 40, size: 2.4, depth: 16, tilt: -8, tone: "mint" },
  { text: "H₂O", x: 4, y: 64, size: 1.5, depth: 8, tilt: 4, tone: "pen" },
  { kind: "sparkle", x: 92, y: 56, size: 1.9, depth: 20, tilt: 0, tone: "pink" },
  { text: "√x", x: 90, y: 80, size: 1.8, depth: 12, tilt: -6, tone: "pen" },
  { kind: "spiral", x: 16, y: 86, size: 2, depth: 10, tilt: 8, tone: "lilac" },
  { text: "a² + b² = c²", x: 70, y: 92, size: 1.2, depth: 6, tilt: -3, tone: "pen" },
  { kind: "heart", x: 30, y: 6, size: 1.6, depth: 12, tilt: -12, tone: "pink" },
  { kind: "bolt", x: 62, y: 4, size: 1.7, depth: 9, tilt: 10, tone: "yellow" },
  { text: "Δ", x: 46, y: 96, size: 1.7, depth: 7, tilt: 5, tone: "pen" },
];

/**
 * A entrada da Mine: uma cena curta (~2 s) que termina interativa. A página
 * ganha rabiscos de estudo, a Mine é desenhada à caneta e acena, o título
 * cai palavra por palavra com grifo, e as sugestões são distribuídas como
 * fichas saindo dela. Com movimento reduzido, tudo aparece pronto.
 */
export function MineWelcome({
  title,
  subtitle,
  prompts,
  reduced,
}: {
  title: string;
  subtitle: string;
  prompts: WelcomePrompt[];
  reduced: boolean;
}) {
  const sceneRef = useRef<HTMLDivElement | null>(null);

  // Parallax dos rabiscos: uma escrita de CSS var por quadro, sem React.
  useEffect(() => {
    if (reduced) return;
    const scene = sceneRef.current;
    if (!scene) return;
    let frame = 0;
    let px = 0;
    let py = 0;
    const paint = () => {
      frame = 0;
      scene.style.setProperty("--px", px.toFixed(3));
      scene.style.setProperty("--py", py.toFixed(3));
    };
    const onMove = (event: PointerEvent) => {
      const rect = scene.getBoundingClientRect();
      px = (event.clientX - rect.left) / rect.width - 0.5;
      py = (event.clientY - rect.top) / rect.height - 0.5;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [reduced]);

  const words = title.trim().split(/\s+/);
  const punct = words.length ? words[words.length - 1].match(/[?!.]+$/)?.[0] || "" : "";
  if (punct) words[words.length - 1] = words[words.length - 1].slice(0, -punct.length);
  const cut = Math.max(1, words.length - 2);
  const head = words.slice(0, cut);
  const tail = words.slice(cut).join(" ");
  const titleStart = 1.05;

  return (
    <div ref={sceneRef} className={`mine-welcome-scene ${reduced ? "is-static" : ""}`}>
      {/* constelação de estudo */}
      <div className="mine-welcome-scribbles" aria-hidden>
        {scribbles.map((item, index) => (
          <span
            key={index}
            className={`mine-scribble tone-${item.tone}`}
            style={
              {
                left: `${item.x}%`,
                top: `${item.y}%`,
                "--size": `${item.size}rem`,
                "--depth": item.depth,
                "--tilt": `${item.tilt}deg`,
                "--delay": `${0.05 + index * 0.09}s`,
                "--float": `${4.5 + (index % 4) * 0.8}s`,
              } as React.CSSProperties
            }
          >
            <span className="mine-scribble__float">
              {item.kind ? (
                <Doodle kind={item.kind} delay={reduced ? 0 : 80 + index * 90} duration={900} strokeWidth={2.4} />
              ) : (
                <span className="mine-scribble__text">{item.text}</span>
              )}
            </span>
          </span>
        ))}
      </div>

      <div className="mine-welcome-stage">
        {/* a Mine, desenhada e acenando */}
        <div className="mine-welcome-hero">
          <motion.div
            className="mine-welcome-face"
            initial={reduced ? false : { scale: 0.6, rotate: -8, y: 18 }}
            animate={{ scale: 1, rotate: 0, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
          >
            <MineFace track draw={!reduced} />
            <span className="mine-welcome-sparks" aria-hidden>
              {Array.from({ length: 8 }, (_, index) => (
                <i key={index} style={{ "--a": `${index * 45}deg` } as React.CSSProperties} />
              ))}
            </span>
            <svg className="mine-welcome-hand" viewBox="0 0 40 40" aria-hidden>
              <path pathLength={1} d="M14 34 C 8 28, 8 20, 10 14 C 11 11, 15 11, 15 15 L 15 8 C 15 4, 20 4, 20 8 L 20 6 C 20 2, 25 2, 25 6 L 25 9 C 25 5, 30 5, 30 9 L 30 22 C 30 30, 24 36, 14 34 Z" />
            </svg>
          </motion.div>
          <p className="mine-welcome-hello" aria-hidden>
            Oi! Eu sou a Mine
          </p>
        </div>

        <h2 className="mine-welcome-title" aria-label={title}>
          {head.map((word, index) => (
            <motion.span
              key={`${word}-${index}`}
              className="mine-welcome-word"
              aria-hidden
              initial={reduced ? false : { y: "-70%", opacity: 0, rotate: -8 }}
              animate={{ y: "0%", opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 18, delay: titleStart + index * 0.07 }}
            >
              {word}
            </motion.span>
          ))}
          <motion.span
            className="mine-welcome-word"
            aria-hidden
            initial={reduced ? false : { y: "-70%", opacity: 0, rotate: 6 }}
            animate={{ y: "0%", opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 18, delay: titleStart + head.length * 0.07 }}
          >
            <span className="mine-welcome-hl" style={{ "--hl-delay": `${reduced ? 0 : titleStart + head.length * 0.07 + 0.25}s` } as React.CSSProperties}>
              {tail}
            </span>
            {punct}
          </motion.span>
        </h2>

        <motion.p
          className="mine-welcome-sub"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: reduced ? 0 : titleStart + 0.5 }}
        >
          {subtitle}
        </motion.p>

        {/* as sugestões são distribuídas como fichas saindo da Mine */}
        <div className="mine-welcome-cards">
          {prompts.map((prompt, index) => {
            const Icon = prompt.icon;
            const tilt = [-2.2, 1.6, 1.2, -1.4][index % 4];
            return (
              <motion.button
                key={prompt.key}
                type="button"
                onClick={prompt.onClick}
                className="mine-welcome-card-item"
                style={{ "--tilt": `${tilt}deg`, "--tape": ["var(--hl-yellow)", "var(--hl-pink)", "var(--hl-mint)", "var(--hl-lilac)"][index % 4] } as React.CSSProperties}
                initial={reduced ? false : { opacity: 0, y: -260, x: index % 2 ? -120 : 120, rotate: index % 2 ? 24 : -24, scale: 0.55 }}
                animate={{ opacity: 1, y: 0, x: 0, rotate: tilt, scale: 1 }}
                whileHover={reduced ? undefined : { y: -6, rotate: 0, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 300, damping: 20, delay: reduced ? 0 : titleStart + 0.55 + index * 0.1 }}
              >
                <span className="mine-welcome-card-icon">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="mine-welcome-card-title">{prompt.title}</span>
                  <span className="mine-welcome-card-detail">{prompt.detail}</span>
                </span>
                <span className="mine-welcome-card-arrow" aria-hidden>
                  →
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
