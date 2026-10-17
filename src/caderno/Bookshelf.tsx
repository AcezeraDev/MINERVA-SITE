import React from "react";
import { motion } from "framer-motion";

export type ShelfEntry = {
  id: string;
  name: string;
  position: number;
  score: number;
  unit: string;
  avatar: React.ReactNode;
  subtitle: string;
};

const spineColors = ["var(--hl-mint)", "var(--hl-lilac)", "var(--hl-pink)", "var(--hl-yellow)", "var(--pen)"];

/**
 * Pódio em forma de estante: cada pessoa é uma pilha de livros, com altura
 * proporcional à pontuação do líder. Os livros caem um a um, de baixo para
 * cima; trocar o período (`stackKey`) derruba e reempilha tudo.
 */
export function BookshelfPodium({
  entries,
  leader,
  stackKey,
  reduced,
  onOpen,
}: {
  entries: ShelfEntry[];
  leader: number;
  stackKey: string;
  reduced: boolean;
  onOpen: (id: string) => void;
}) {
  const maxBooks = 13;
  return (
    <div className="caderno-shelf" role="list">
      {entries.map((entry, column) => {
        const books = Math.max(1, Math.round((leader > 0 ? entry.score / leader : 0) * maxBooks));
        return (
          <motion.button
            key={`${stackKey}-${entry.id}`}
            type="button"
            role="listitem"
            className={`caderno-shelf-stack is-place-${entry.position}`}
            onClick={() => onOpen(entry.id)}
            whileHover={reduced ? undefined : { y: -4 }}
            aria-label={`${entry.position}º lugar: ${entry.name}, ${entry.score.toLocaleString("pt-BR")} ${entry.unit}. Abrir perfil.`}
          >
            <span className="caderno-shelf-who">
              <motion.span
                className="caderno-shelf-avatar"
                initial={reduced ? false : { y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: reduced ? 0 : 0.25 + column * 0.12 + books * 0.05, type: "spring", stiffness: 420, damping: 18 }}
              >
                {entry.avatar}
                {entry.position === 1 ? <span className="caderno-shelf-crown" aria-hidden>♛</span> : null}
              </motion.span>
              <span className="caderno-shelf-name">{entry.name}</span>
              <span className="caderno-shelf-sub">{entry.subtitle}</span>
            </span>
            <span className="caderno-shelf-books" aria-hidden>
              {Array.from({ length: books }, (_, index) => {
                const seed = (entry.id.charCodeAt(index % entry.id.length) + index * 7) % 11;
                return (
                  <motion.i
                    key={index}
                    style={{
                      "--spine": `rgb(${spineColors[(index + column * 2) % spineColors.length]})`,
                      "--w": `${78 + seed * 2}%`,
                      "--tilt": `${(seed % 3) - 1}deg`,
                      "--shift": `${(seed % 5) - 2}px`,
                    } as React.CSSProperties}
                    initial={reduced ? false : { y: -220, opacity: 0, rotate: seed * 3 - 15 }}
                    animate={{ y: 0, opacity: 1, rotate: 0 }}
                    transition={{ delay: reduced ? 0 : column * 0.12 + index * 0.05, type: "spring", stiffness: 520, damping: 26 }}
                  />
                );
              })}
            </span>
            <span className="caderno-shelf-place">{entry.position}º</span>
            <span className="caderno-shelf-score">
              {entry.score.toLocaleString("pt-BR")} <small>{entry.unit}</small>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
