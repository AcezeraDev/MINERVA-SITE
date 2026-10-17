/*
  Tour guiado da Mine: na primeira visita ela mostra o caderno, aba por aba.

  Cada passo acende um pedaço da tela (o resto escurece, como uma lanterna),
  circula o alvo com um rabisco de caneta e fala num balão ao lado. Os alvos
  são marcados com `data-tour` na barra lateral e na barra do celular; vale o
  primeiro que estiver visível. Sem alvo, o balão fica no meio da tela.

  Teclado: → / Enter avança, ← volta, Esc pula.
*/
import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { MineFace } from "./MineFace";
import { Doodle, celebrate } from "./index";
import { playPageFlip } from "./sons";

export type TourStep = { target?: string; title: string; text: string };

type Box = { x: number; y: number; w: number; h: number };

function findTarget(target?: string): HTMLElement | null {
  if (!target) return null;
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`));
  return (
    all.find((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
    }) || null
  );
}

export function MineTour({ name, steps, onDone }: { name: string; steps: TourStep[]; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  const measure = useCallback(() => {
    const el = findTarget(step?.target);
    if (!el) {
      setBox(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const pad = 8;
    setBox({ x: rect.left - pad, y: rect.top - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 });
  }, [step?.target]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  const next = useCallback(() => {
    if (last) {
      celebrate(window.innerWidth / 2, window.innerHeight / 2, { count: 60, spread: 1.6 });
      onDone();
      return;
    }
    playPageFlip();
    setIndex((value) => value + 1);
  }, [last, onDone]);

  const back = useCallback(() => setIndex((value) => Math.max(0, value - 1)), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDone();
      else if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, next, onDone]);

  if (!step) return null;

  // O balão fica ao lado do alvo; sem espaço à direita, vai para baixo/cima.
  const bubbleWidth = Math.min(340, window.innerWidth - 32);
  let bubbleStyle: React.CSSProperties = { left: "50%", top: "50%", translate: "-50% -50%", width: bubbleWidth };
  if (box) {
    const rightRoom = window.innerWidth - (box.x + box.w);
    if (rightRoom > bubbleWidth + 40) {
      bubbleStyle = { left: box.x + box.w + 24, top: Math.max(16, Math.min(box.y, window.innerHeight - 280)), width: bubbleWidth };
    } else if (box.y > window.innerHeight / 2) {
      bubbleStyle = { left: Math.max(16, Math.min(box.x, window.innerWidth - bubbleWidth - 16)), bottom: window.innerHeight - box.y + 20, width: bubbleWidth };
    } else {
      bubbleStyle = { left: Math.max(16, Math.min(box.x, window.innerWidth - bubbleWidth - 16)), top: box.y + box.h + 20, width: bubbleWidth };
    }
  }

  return (
    <div className="caderno-tour" role="dialog" aria-modal="true" aria-label="Tour pelo caderno">
      {box ? (
        <motion.div
          className="caderno-tour-hole"
          initial={false}
          animate={{ left: box.x, top: box.y, width: box.w, height: box.h }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
        >
          <Doodle key={index} kind="circle" className="caderno-tour-ring" duration={700} strokeWidth={2.6} stretch />
        </motion.div>
      ) : (
        <div className="caderno-tour-dim" />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          className="caderno-tour-bubble"
          style={bubbleStyle}
          initial={{ opacity: 0, y: 14, rotate: 2 }}
          animate={{ opacity: 1, y: 0, rotate: -0.8 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
        >
          <span className="caderno-tour-tape" aria-hidden />
          <div className="flex items-start gap-3">
            <MineFace className="caderno-tour-face" />
            <div className="min-w-0">
              <p className="caderno-tour-count">{index + 1} de {steps.length}</p>
              <p className="caderno-tour-title">{index === 0 ? step.title.replace("{nome}", name) : step.title}</p>
            </div>
          </div>
          <p className="caderno-tour-text">{step.text}</p>
          <div className="caderno-tour-dots" aria-hidden>
            {steps.map((_, dot) => <i key={dot} className={dot === index ? "is-on" : dot < index ? "is-done" : ""} />)}
          </div>
          <div className="caderno-tour-actions">
            <button type="button" className="caderno-tour-skip" onClick={onDone}>pular tour</button>
            <div className="flex gap-2">
              {index > 0 ? (
                <button type="button" className="caderno-tour-btn" onClick={back} aria-label="Voltar">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : null}
              <button type="button" className="caderno-tour-btn is-pen" onClick={next} autoFocus>
                {last ? "Bora estudar!" : "Próximo"}
                {last ? null : <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Os passos do caderno. `{nome}` vira o primeiro nome da pessoa. */
export const tourSteps: TourStep[] = [
  { title: "Oi, {nome}! Eu sou a Mine.", text: "Esse é o seu caderno de estudos. Deixa eu te mostrar onde fica cada coisa? Leva menos de um minuto." },
  { target: "home", title: "Início", text: "Sua página do dia: o que merece atenção agora, a sequência de estudos e as matérias." },
  { target: "agenda", title: "Agenda", text: "Tarefas e provas num quadro de post-its. Dá pra arrastar de um dia pro outro." },
  { target: "foco", title: "Foco", text: "Um lápis que vai sendo gasto enquanto você estuda. Cada sessão vale XP." },
  { target: "mine", title: "Conversar comigo", text: "Me pergunta qualquer coisa. Eu também faço mapa mental, prova e flashcards da sua matéria." },
  { target: "games", title: "Games", text: "Jogos montados com o conteúdo das suas matérias. Estudar jogando também conta!" },
  { target: "ranking", title: "Ranking", text: "A estante da turma: cada livro é XP. Quanto mais você estuda, mais alta fica a sua pilha." },
  { target: "buddy", title: "Eu fico aqui", text: "Moro no canto da folha. Me chama quando precisar, tá? Bons estudos!" },
];
