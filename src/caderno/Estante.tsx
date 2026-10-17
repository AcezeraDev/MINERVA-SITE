/*
  Estante de matérias: cada matéria é um caderno em pé na prateleira.

  O caderno é uma caixa de CSS 3D (lombada, capa e o topo das folhas). Passar
  o mouse ou focar puxa o caderno para fora e gira o suficiente para mostrar a
  capa; clicar termina o giro e abre a matéria. Nada de WebGL: são três divs
  com transform, então roda até no celular. Com movimento reduzido ou no tier
  baixo, a estante continua lá, só sem a terceira dimensão.

  O que a lombada conta (cada sinal é um objeto de caderno, não um selo):
  - altura do marca-texto na base = quanto da matéria já foi estudado;
  - grossura do caderno = quantos conteúdos ele tem;
  - post-it amarelo saindo do topo = revisões vencidas;
  - aba vermelha = tarefa atrasada;
  - estrelinha = favorita.
*/
import React, { useRef, useState } from "react";
import { useQualityTier, useSoftMotion } from "../motion";
import "./caderno-estante.css";

export type EstanteBook = {
  id: string;
  name: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  materials: number;
  studiedPercent: number;
  dueReviews: number;
  overdueTasks: number;
  favorite?: boolean;
  nextAction?: string;
};

/** Altura estável por matéria: a estante não "pula" a cada render. */
function heightFor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) | 0;
  return 180 + (Math.abs(hash) % 36);
}

function thicknessFor(materials: number) {
  return Math.round(44 + Math.min(materials, 24) * 1.4);
}

export function Estante({
  books,
  onOpen,
  onCreate,
}: {
  books: EstanteBook[];
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const reduced = useSoftMotion();
  const tier = useQualityTier();
  const flat = reduced || tier === "low";
  const [opening, setOpening] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const open = (id: string) => {
    if (opening) return;
    if (flat) {
      onOpen(id);
      return;
    }
    setOpening(id);
    timer.current = window.setTimeout(() => onOpen(id), 460);
  };

  return (
    <div className={`caderno-estante ${flat ? "is-flat" : ""}`}>
      <ul className="caderno-estante-shelf" aria-label="Estante de matérias">
        {books.map((book, index) => {
          const Icon = book.icon;
          const height = heightFor(book.id);
          const thick = thicknessFor(book.materials);
          const label = [
            book.name,
            `${book.materials} ${book.materials === 1 ? "conteúdo" : "conteúdos"}`,
            `${book.studiedPercent}% estudado`,
            book.overdueTasks ? `${book.overdueTasks} ${book.overdueTasks === 1 ? "tarefa atrasada" : "tarefas atrasadas"}` : "",
            book.dueReviews ? `${book.dueReviews} ${book.dueReviews === 1 ? "revisão" : "revisões"} para hoje` : "",
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <li
              key={book.id}
              className="caderno-estante-slot"
              style={{ "--h": `${height}px`, "--w": `${thick}px`, "--c": book.color, "--i": index } as React.CSSProperties}
            >
              <button
                type="button"
                className={`caderno-book ${opening === book.id ? "is-opening" : ""}`}
                onClick={() => open(book.id)}
                aria-label={`Abrir ${label}`}
                title={book.nextAction ? `Próxima ação: ${book.nextAction}` : book.name}
              >
                <span className="caderno-book-box" aria-hidden>
                  {/* lombada */}
                  <span className="caderno-book-spine">
                    <span className="caderno-book-icon">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="caderno-book-label">{book.name}</span>
                    <span className="caderno-book-fill" style={{ height: `${Math.max(4, book.studiedPercent)}%` }} />
                    {book.favorite ? <span className="caderno-book-star">★</span> : null}
                    {book.overdueTasks ? <span className="caderno-book-tab">{book.overdueTasks}</span> : null}
                    {!book.overdueTasks && book.dueReviews ? <span className="caderno-book-postit">{book.dueReviews}</span> : null}
                  </span>
                  {/* capa (lado direito, aparece quando o caderno gira) */}
                  <span className="caderno-book-cover">
                    <span className="caderno-book-cover-tag">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="caderno-book-cover-name" lang="pt-BR">{book.name}</span>
                    <span className="caderno-book-cover-meta">
                      {book.materials} {book.materials === 1 ? "conteúdo" : "conteúdos"} · {book.studiedPercent}%
                    </span>
                  </span>
                  {/* topo: as folhas vistas de cima */}
                  <span className="caderno-book-top" />
                </span>
              </button>
            </li>
          );
        })}
        <li className="caderno-estante-slot is-new" style={{ "--h": "190px", "--w": "52px" } as React.CSSProperties}>
          <button type="button" className="caderno-book-new" onClick={onCreate} aria-label="Criar nova matéria">
            <span aria-hidden>+</span>
          </button>
        </li>
      </ul>
    </div>
  );
}
