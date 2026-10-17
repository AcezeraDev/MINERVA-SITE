import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export type HandGame = {
  id: string;
  name: string;
  tagline: string;
  goal: string;
  howTo: string[];
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
};

/**
 * Os jogos como cartas numa mão. Fechada, é um leque apertado; com o mouse
 * (ou o foco do teclado) em cima, o leque abre. Clicar numa carta traz ela
 * para o centro e vira: no verso, como jogar e o botão de começar.
 */
export function GameHand({ games, onPlay, reduced }: { games: HandGame[]; onPlay: (id: string) => void; reduced: boolean }) {
  const [open, setOpen] = useState<number>(-1);
  const [spread, setSpread] = useState(false);
  const [hover, setHover] = useState(-1);
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < 760);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [boxWidth, setBoxWidth] = useState(900);
  useEffect(() => {
    const node = boxRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 760);
    window.addEventListener("resize", onResize);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const middle = (games.length - 1) / 2;
  // O leque aberto ocupa a largura disponível sem estourar as pontas.
  const cardWidth = narrow ? 154 : 192;
  const openStep = Math.max(24, Math.min(150, (boxWidth - cardWidth - 24) / Math.max(1, games.length - 1)));

  return (
    <div
      ref={boxRef}
      className="caderno-hand-of-cards"
      onPointerEnter={() => setSpread(true)}
      onPointerLeave={() => {
        setSpread(false);
        setHover(-1);
      }}
    >
      {games.map((game, index) => {
        const offset = index - middle;
        const isOpen = open === index;
        const anyOpen = open >= 0;
        const wide = spread || anyOpen;
        const x = offset * (wide ? openStep : Math.min(44, openStep * 0.4));
        const rotate = isOpen ? 0 : offset * (wide ? 5 : 8);
        const y = isOpen ? -30 : anyOpen ? 46 : hover === index ? -30 : Math.abs(offset) * (wide ? 8 : 5);
        const Icon = game.icon;
        return (
          <motion.div
            key={game.id}
            className={`caderno-game-card ${isOpen ? "is-open" : ""}`}
            style={{ "--card": game.accent, zIndex: isOpen ? 30 : hover === index ? 20 : index } as React.CSSProperties}
            initial={reduced ? false : { y: 260, rotate: 0, opacity: 0 }}
            animate={{ x: isOpen ? 0 : x, y, rotate, scale: isOpen ? 1.12 : anyOpen ? 0.9 : 1, opacity: anyOpen && !isOpen ? 0.55 : 1 }}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 24, delay: 0 }}
            onPointerEnter={() => setHover(index)}
          >
            <motion.div
              className="caderno-game-inner"
              animate={{ rotateY: isOpen ? 180 : 0 }}
              transition={reduced ? { duration: 0 } : { duration: 0.6, ease: [0.3, 0.7, 0.2, 1] }}
            >
              <button
                type="button"
                className="caderno-game-face"
                onClick={() => setOpen(index)}
                onFocus={() => {
                  setSpread(true);
                  setHover(index);
                }}
                tabIndex={isOpen ? -1 : 0}
                aria-label={`${game.name}: ver como jogar`}
              >
                <span className="caderno-game-icon">
                  <Icon className="h-7 w-7" />
                </span>
                <span className="caderno-game-name">{game.name}</span>
                <span className="caderno-game-tag">{game.tagline}</span>
              </button>
              <div className="caderno-game-back" aria-hidden={!isOpen}>
                <p className="caderno-note !text-[1.1rem]">como jogar</p>
                <p className="mt-1 font-display text-lg font-black leading-tight">{game.name}</p>
                <ol className="caderno-game-steps">
                  {game.howTo.slice(0, 3).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p className="caderno-game-goal">{game.goal}</p>
                <div className="mt-auto flex gap-2">
                  <button type="button" className="caderno-btn-pen rounded-lg px-3 py-2 text-sm font-black" tabIndex={isOpen ? 0 : -1} onClick={() => onPlay(game.id)}>
                    Jogar
                  </button>
                  <button type="button" className="rounded-lg px-3 py-2 text-sm font-bold text-white/60 hover:bg-white/[0.06]" tabIndex={isOpen ? 0 : -1} onClick={() => setOpen(-1)}>
                    Voltar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}
