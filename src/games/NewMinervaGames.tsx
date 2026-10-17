import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle2,
  CircleDot,
  Link2,
  Orbit,
  RotateCcw,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import {
  connectionReward,
  correctSequencePositions,
  moveSequenceItem,
  sequenceReward,
  type SequencePuzzle,
} from "../../shared/game-core.mjs";
import type { GameAnswer } from "../../shared/game-meta.mjs";
import { useSoftMotion } from "../motion";
import { celebrateFrom } from "../caderno";
import "./new-games.css";

export type ConceptPair = { term: string; definition: string };

function answerId() {
  return `answer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function NexusHud({ score, energy, streak, progress }: { score: number; energy: number; streak: number; progress: string }) {
  return (
    <div className="nexus-hud" aria-label="Estado da partida">
      <span><strong>{progress}</strong><small>conexões</small></span>
      <span><strong>{score}</strong><small>pontos</small></span>
      <span><strong>{streak}x</strong><small>pulso</small></span>
      <span className={energy <= 1 ? "is-alert" : ""}><strong>{energy}/3</strong><small>energia</small></span>
    </div>
  );
}

export function NexusGame({ pairs, onFinish }: { pairs: ConceptPair[]; onFinish: (score: number, correctAnswers: number, answers: GameAnswer[]) => void }) {
  const reduced = useSoftMotion();
  const usablePairs = useMemo(() => pairs, [pairs]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [energy, setEnergy] = useState(3);
  const [streak, setStreak] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [resolved, setResolved] = useState(false);
  const [eligibleForXp, setEligibleForXp] = useState(true);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [feedback, setFeedback] = useState("Escolha a definição que completa o conceito central.");
  const finished = useRef(false);
  const answersRef = useRef<GameAnswer[]>([]);
  const current = usablePairs[index];

  const options = useMemo(() => {
    if (!current) return [];
    const decoys = shuffled(usablePairs.filter((_, pairIndex) => pairIndex !== index)).slice(0, 2);
    return shuffled([current, ...decoys]);
  }, [current, index, usablePairs]);

  const finish = useCallback((finalScore: number, finalCorrectAnswers: number) => {
    if (finished.current) return;
    finished.current = true;
    onFinish(finalScore, finalCorrectAnswers, answersRef.current);
  }, [onFinish]);

  const choose = useCallback((option: ConceptPair) => {
    if (!current || resolved || wrong.includes(option.definition) || finished.current) return;
    if (option.term === current.term) {
      const reward = connectionReward(streak);
      const nextScore = score + reward;
      setScore(nextScore);
      setStreak((value) => value + 1);
      if (eligibleForXp) setCorrectAnswers((value) => value + 1);
      answersRef.current = [...answersRef.current, { id: answerId(), prompt: `Qual definição pertence a “${current.term}”?`, userAnswer: option.definition, correctAnswer: current.definition, explanation: `${current.term} — ${current.definition}`, correct: eligibleForXp }];
      setResolved(true);
      setFeedback(`Conexão formada: ${current.term} — ${current.definition}`);
      celebrateFrom(document.querySelector(".nexus-core"), { count: 22 });
      return;
    }

    const nextEnergy = energy - 1;
    setEnergy(nextEnergy);
    setStreak(0);
    setEligibleForXp(false);
    setWrong((items) => [...items, option.definition]);
    setFeedback(`Esse sinal pertence a “${option.term}”. Tente outra ligação.`);
    if (nextEnergy <= 0) {
      answersRef.current = [...answersRef.current, { id: answerId(), prompt: `Qual definição pertence a “${current.term}”?`, userAnswer: option.definition, correctAnswer: current.definition, explanation: `${current.term} — ${current.definition}`, correct: false }];
      finish(score, correctAnswers);
    }
  }, [correctAnswers, current, eligibleForXp, energy, finish, resolved, score, streak, wrong]);

  const advance = useCallback(() => {
    if (!resolved || !current) return;
    if (index >= usablePairs.length - 1) {
      finish(score + energy * 50, correctAnswers);
      return;
    }
    setIndex((value) => value + 1);
    setWrong([]);
    setResolved(false);
    setEligibleForXp(true);
    setFeedback("Novo sinal detectado. Encontre a conexão correta.");
  }, [correctAnswers, current, energy, finish, index, resolved, score, usablePairs.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (resolved && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        advance();
        return;
      }
      const optionIndex = Number(event.key) - 1;
      if (optionIndex >= 0 && optionIndex < options.length) choose(options[optionIndex]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, choose, options, resolved]);

  if (!current) return <p className="game-inline-error">A Mine não encontrou conexões suficientes para esta partida.</p>;

  return (
    <section className="nexus-game" aria-labelledby="nexus-title">
      <header className="new-game-heading">
        <div><p>Rede semântica · Bioma {index + 1}</p><h2 id="nexus-title">Nexo Vivo</h2></div>
        <NexusHud score={score} energy={energy} streak={streak} progress={`${index + (resolved ? 1 : 0)}/${usablePairs.length}`} />
      </header>

      <div className="nexus-stage">
        <div className="nexus-grid" aria-hidden />
        <motion.div
          className={`nexus-core ${resolved ? "is-linked" : ""}`}
          animate={reduced ? undefined : resolved ? { scale: [1, 1.12, 1], rotate: [0, -6, 4, 0] } : { y: [0, -5, 0], rotate: [0, 1.5, 0] }}
          transition={resolved ? { duration: 0.55 } : { duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <Orbit aria-hidden />
          <span>conceito-alvo</span>
          <strong>{current.term}</strong>
        </motion.div>

        <div className="nexus-options" role="group" aria-label={`Definições possíveis para ${current.term}`}>
          {options.map((option, optionIndex) => {
            const isWrong = wrong.includes(option.definition);
            const isCorrect = resolved && option.term === current.term;
            return (
              <motion.button
                type="button"
                key={`${current.term}-${option.definition}`}
                className={`nexus-node ${isWrong ? "is-wrong" : ""} ${isCorrect ? "is-correct" : ""}`}
                onClick={() => choose(option)}
                disabled={resolved || isWrong}
                whileTap={reduced ? undefined : { scale: 0.97 }}
                initial={reduced ? false : { opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: reduced ? 0 : optionIndex * 0.06 }}
              >
                <span className="nexus-node-key">{optionIndex + 1}</span>
                {isCorrect ? <Check aria-hidden /> : isWrong ? <X aria-hidden /> : <CircleDot aria-hidden />}
                <span>{option.definition}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className={`nexus-feedback ${resolved ? "is-success" : ""}`} role="status" aria-live="polite">
        <Link2 aria-hidden />
        <p>{feedback}</p>
        {resolved ? <button type="button" onClick={advance}>{index === usablePairs.length - 1 ? "Fechar constelação" : "Seguir o pulso"}<ArrowRight aria-hidden /></button> : null}
      </div>
    </section>
  );
}

function scramblePuzzle(puzzle: SequencePuzzle) {
  const shift = (puzzle.title.length % 3) + 1;
  const rotated = [...puzzle.steps.slice(shift), ...puzzle.steps.slice(0, shift)];
  return rotated.every((step, index) => step === puzzle.steps[index]) ? [...puzzle.steps].reverse() : rotated;
}

export function SequenceForgeGame({ puzzles, onFinish }: { puzzles: SequencePuzzle[]; onFinish: (score: number, correctAnswers: number, answers: GameAnswer[]) => void }) {
  const reduced = useSoftMotion();
  const usable = useMemo(() => puzzles, [puzzles]);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const puzzle = usable[puzzleIndex];
  const [order, setOrder] = useState<string[]>(() => puzzle ? scramblePuzzle(puzzle) : []);
  const [moves, setMoves] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [score, setScore] = useState(0);
  const [solved, setSolved] = useState(false);
  const [eligibleForXp, setEligibleForXp] = useState(true);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [feedback, setFeedback] = useState("Mova as etapas e acione o núcleo quando o processo fizer sentido.");
  const dragIndex = useRef<number | null>(null);
  const finished = useRef(false);
  const answersRef = useRef<GameAnswer[]>([]);

  useEffect(() => {
    if (!puzzle) return;
    setOrder(scramblePuzzle(puzzle));
    setMoves(0);
    setAttempts(0);
    setSolved(false);
    setEligibleForXp(true);
    setFeedback("Mova as etapas e acione o núcleo quando o processo fizer sentido.");
  }, [puzzle]);

  const move = (from: number, to: number) => {
    if (solved || from === to || to < 0 || to >= order.length) return;
    setOrder((items) => moveSequenceItem(items, from, to));
    setMoves((value) => value + 1);
    setFeedback(`Etapa movida para a posição ${to + 1}.`);
  };

  const verify = () => {
    if (!puzzle || solved) return;
    const positions = correctSequencePositions(order, puzzle.steps);
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    if (positions === puzzle.steps.length) {
      const reward = sequenceReward(moves, nextAttempts);
      setScore((value) => value + reward);
      if (eligibleForXp) setCorrectAnswers((value) => value + 1);
      answersRef.current = [...answersRef.current, { id: answerId(), prompt: `Ordene o processo: ${puzzle.title}`, userAnswer: order.join(" → "), correctAnswer: puzzle.steps.join(" → "), explanation: puzzle.explanation, correct: eligibleForXp }];
      setSolved(true);
      setFeedback(puzzle.explanation);
      celebrateFrom(document.querySelector(".forge-reactor-core"), { count: 26 });
      return;
    }
    setEligibleForXp(false);
    setFeedback(`${positions} de ${puzzle.steps.length} etapas estão no lugar certo. Reorganize as demais.`);
  };

  const continueGame = () => {
    if (!solved || !puzzle) return;
    if (puzzleIndex >= usable.length - 1) {
      if (!finished.current) {
        finished.current = true;
        onFinish(score, correctAnswers, answersRef.current);
      }
      return;
    }
    setPuzzleIndex((value) => value + 1);
  };

  if (!puzzle) return <p className="game-inline-error">A Mine não encontrou processos suficientes para esta partida.</p>;

  return (
    <section className="forge-game" aria-labelledby="forge-title">
      <header className="new-game-heading">
        <div><p>Oficina causal · Mecanismo {puzzleIndex + 1}/{usable.length}</p><h2 id="forge-title">Forja de Sequências</h2></div>
        <div className="forge-score"><Sparkles aria-hidden /><strong>{score}</strong><span>pontos</span></div>
      </header>

      <div className="forge-layout">
        <aside className="forge-reactor" aria-label="Processo atual">
          <motion.div className={`forge-reactor-core ${solved ? "is-solved" : ""}`} animate={reduced ? undefined : solved ? { rotate: 360, scale: [1, 1.08, 1] } : { rotate: [0, 8, 0, -8, 0] }} transition={{ duration: solved ? 0.8 : 5, repeat: solved ? 0 : Infinity }}>
            {solved ? <CheckCircle2 aria-hidden /> : <Zap aria-hidden />}
          </motion.div>
          <p>processo em análise</p>
          <h3>{puzzle.title}</h3>
          <div className="forge-metrics"><span><strong>{moves}</strong>movimentos</span><span><strong>{attempts}</strong>testes</span></div>
        </aside>

        <div className="forge-track" aria-label="Etapas do processo em ordem ajustável">
          <AnimatePresence initial={false}>
            {order.map((step, index) => (
              <motion.article
                layout
                key={step}
                className={`forge-step ${solved ? "is-solved" : ""}`}
                draggable={!solved}
                onDragStart={() => { dragIndex.current = index; }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => { if (dragIndex.current !== null) move(dragIndex.current, index); dragIndex.current = null; }}
                transition={{ layout: reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 } }}
              >
                <span className="forge-number">{index + 1}</span>
                <p>{step}</p>
                <div className="forge-controls">
                  <button type="button" onClick={() => move(index, index - 1)} disabled={solved || index === 0} aria-label={`Mover “${step}” para cima`}><ArrowUp aria-hidden /></button>
                  <button type="button" onClick={() => move(index, index + 1)} disabled={solved || index === order.length - 1} aria-label={`Mover “${step}” para baixo`}><ArrowDown aria-hidden /></button>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className={`forge-feedback ${solved ? "is-success" : ""}`} role="status" aria-live="polite">
        <div>{solved ? <CheckCircle2 aria-hidden /> : <Link2 aria-hidden />}<p>{feedback}</p></div>
        {solved ? (
          <button type="button" onClick={continueGame}>{puzzleIndex === usable.length - 1 ? "Concluir forja" : "Próximo mecanismo"}<ArrowRight aria-hidden /></button>
        ) : (
          <div className="forge-actions">
            <button type="button" className="is-quiet" onClick={() => { setOrder(scramblePuzzle(puzzle)); setMoves(0); setFeedback("Sequência embaralhada novamente."); }}><RotateCcw aria-hidden />Embaralhar</button>
            <button type="button" onClick={verify}><Sparkles aria-hidden />Acionar núcleo</button>
          </div>
        )}
      </div>
    </section>
  );
}
