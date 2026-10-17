import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, HelpCircle, Keyboard, Loader2, Mic, MicOff, RotateCcw, SkipForward, Turtle, Volume2, X } from "lucide-react";
import { useSoftMotion } from "../motion";
import { MineFace } from "../caderno/MineFace";
import { playChime, playPop, playStamp } from "../caderno";
import {
  checkExercise,
  countsAsRight,
  gradeSpeech,
  type ChoiceExercise,
  type Exercise,
  type Grade,
  type LangUnit,
  type Outcome,
  type PairsExercise,
  type SpeakExercise,
  type TilesExercise,
  type TypingExercise,
} from "../../shared/idiomas.mjs";
import { askLanguageMine } from "./api";
import { canListen, canSpeak, listen, preloadSpeech, speak, stopSpeaking, type Listening } from "./voz";

type Feedback = { result: Grade; expected: string; given: string };

const cheers: Record<Grade, string[]> = {
  certo: ["Nice!", "Great job!", "Perfect!", "Isso aí!", "Well done!", "Mandou bem!"],
  quase: ["Quase perfeito! Olha a grafia.", "Almost! Só um detalhe.", "Valeu, mas confere a letra."],
  errado: ["Sem drama: grifei pra revisar.", "Errar faz parte da viagem.", "Anotei na margem. Bora!", "Next one is yours!"],
};

function pick<T>(list: T[], salt: number) {
  return list[Math.abs(salt) % list.length];
}

/** Botão de ouvir: toque normal e a tartaruga para devagar. */
function Listen({ text, auto = false, big = false }: { text: string; auto?: boolean; big?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const play = useCallback(
    async (slow = false) => {
      setPlaying(true);
      await speak(text, { slow });
      setPlaying(false);
    },
    [text],
  );
  useEffect(() => {
    if (auto && canSpeak()) {
      const timer = window.setTimeout(() => void play(false), 380);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [auto, play]);
  if (!canSpeak()) return null;
  return (
    <span className="idi-listen">
      <button type="button" className={`idi-speaker ${big ? "is-big" : ""} ${playing ? "is-playing" : ""}`} onClick={() => void play(false)} aria-label="Ouvir em inglês">
        <Volume2 />
        {big ? <span className="idi-speaker-rings" aria-hidden /> : null}
      </button>
      <button type="button" className="idi-turtle" onClick={() => void play(true)} aria-label="Ouvir devagar">
        <Turtle />
      </button>
    </span>
  );
}

/* ─────────────────────────── exercícios ─────────────────────────── */

const choiceTitles: Record<ChoiceExercise["mode"], string> = {
  figurinha: "Qual é a figurinha?",
  escuta: "O que você ouviu?",
  significado: "O que significa?",
  complete: "Complete a frase",
};

function ChoiceView({ exercise, value, onChange, locked }: { exercise: ChoiceExercise; value: string | null; onChange: (value: string) => void; locked: boolean }) {
  useEffect(() => {
    if (locked) return undefined;
    const onKey = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      if (index >= 0 && index < exercise.options.length && !(event.target instanceof HTMLInputElement)) onChange(exercise.options[index]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exercise, locked, onChange]);

  return (
    <div className="idi-ex">
      <h2 className="idi-ex-title">{choiceTitles[exercise.mode]}</h2>
      {exercise.mode === "figurinha" ? (
        <div className="idi-sticker-stage">
          <span className="idi-sticker" aria-hidden>
            {exercise.emoji}
          </span>
          <p className="idi-ex-hint">
            Como se diz <mark className="caderno-mark">{exercise.prompt}</mark> em inglês?
          </p>
        </div>
      ) : null}
      {exercise.mode === "escuta" ? (
        <div className="idi-sticker-stage">
          <Listen text={exercise.audio} auto big />
          <p className="idi-ex-hint">Toque para ouvir de novo. A tartaruga fala devagar.</p>
        </div>
      ) : null}
      {exercise.mode === "significado" ? (
        <div className="idi-sticker-stage">
          <p className="idi-english idi-english-xl" lang="en">
            {exercise.prompt}
          </p>
          <Listen text={exercise.audio} auto />
        </div>
      ) : null}
      {exercise.mode === "complete" ? (
        <div className="idi-sticker-stage">
          <p className="idi-english idi-english-lg" lang="en">
            {exercise.prompt.split("___").map((part, index, all) => (
              <React.Fragment key={index}>
                {part}
                {index < all.length - 1 ? <span className={`idi-blank ${value ? "is-filled" : ""}`}>{value || " "}</span> : null}
              </React.Fragment>
            ))}
          </p>
          <p className="idi-ex-hint">{exercise.hint}</p>
        </div>
      ) : null}
      <div className="idi-options" role="radiogroup" aria-label="Opções">
        {exercise.options.map((option, index) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            disabled={locked}
            className={`idi-option ${value === option ? "is-picked" : ""}`}
            onClick={() => {
              onChange(option);
              if (exercise.mode !== "significado") void speak(option);
            }}
            lang={exercise.mode === "significado" ? "pt-BR" : "en"}
          >
            <span className="idi-option-key" aria-hidden>
              {index + 1}
            </span>
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

type Tile = { id: string; text: string };

function TilesView({ exercise, onChange, locked }: { exercise: TilesExercise; onChange: (value: string[]) => void; locked: boolean }) {
  const reduced = useSoftMotion();
  const all = useMemo<Tile[]>(() => exercise.tiles.map((text, index) => ({ id: `t${index}`, text })), [exercise]);
  const [placed, setPlaced] = useState<string[]>([]);
  useEffect(() => setPlaced([]), [exercise]);
  useEffect(() => onChange(placed.map((id) => all.find((tile) => tile.id === id)!.text)), [placed, all, onChange]);
  const toggle = (id: string) => {
    if (locked) return;
    playPop();
    setPlaced((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };
  return (
    <div className="idi-ex">
      <h2 className="idi-ex-title">{exercise.mode === "traduza" ? "Monte em inglês" : "Monte o que você ouviu"}</h2>
      <div className="idi-sticker-stage">
        {exercise.mode === "traduza" ? (
          <p className="idi-pt-line">
            <MineFace className="idi-mini-face" /> “{exercise.prompt}”
          </p>
        ) : null}
        <Listen text={exercise.audio} auto={exercise.mode === "monte"} big={exercise.mode === "monte"} />
      </div>
      {/* Sem layoutId de propósito: peças com layout compartilhado dentro do
          AnimatePresence mode="wait" travavam a saída do cartão e a próxima
          questão nunca entrava. A peça só "cai" na linha. */}
      <div className="idi-answer-lines" aria-label="Sua frase">
        {placed.map((id) => {
          const tile = all.find((item) => item.id === id)!;
          return (
            <motion.button
              key={id}
              type="button"
              className="idi-tile is-placed"
              onClick={() => toggle(id)}
              disabled={locked}
              lang="en"
              initial={reduced ? false : { y: 26, scale: 0.8, rotate: -6, opacity: 0 }}
              animate={{ y: 0, scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 520, damping: 26 }}
            >
              {tile.text}
            </motion.button>
          );
        })}
      </div>
        <div className="idi-bank" aria-label="Peças">
          {all.map((tile) =>
            placed.includes(tile.id) ? (
              <span key={tile.id} className="idi-tile is-ghost" aria-hidden>
                {tile.text}
              </span>
            ) : (
              <button key={tile.id} type="button" className="idi-tile" onClick={() => toggle(tile.id)} disabled={locked} lang="en">
                {tile.text}
              </button>
            ),
          )}
        </div>
    </div>
  );
}

function PairsView({ exercise, onDone, locked }: { exercise: PairsExercise; onDone: (mistakes: number) => void; locked: boolean }) {
  const [left, setLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);
  const mistakes = useRef(0);
  useEffect(() => {
    setLeft(null);
    setMatched([]);
    mistakes.current = 0;
  }, [exercise]);

  const choose = (pt: string) => {
    if (!left || locked) return;
    const pair = exercise.pairs.find((item) => item.en === left);
    if (pair?.pt === pt) {
      playChime();
      const next = [...matched, left];
      setMatched(next);
      setLeft(null);
      if (next.length === exercise.pairs.length) window.setTimeout(() => onDone(mistakes.current), 350);
    } else {
      mistakes.current += 1;
      setWrong(pt);
      window.setTimeout(() => setWrong(null), 420);
    }
  };
  const ptMatched = exercise.pairs.filter((item) => matched.includes(item.en)).map((item) => item.pt);

  return (
    <div className="idi-ex">
      <h2 className="idi-ex-title">Ligue os pares</h2>
      <p className="idi-ex-hint">Toque numa palavra em inglês e depois no significado.</p>
      <div className="idi-pairs">
        <div className="idi-pairs-col">
          {exercise.left.map((en) => (
            <button
              key={en}
              type="button"
              lang="en"
              disabled={locked || matched.includes(en)}
              className={`idi-pair ${left === en ? "is-picked" : ""} ${matched.includes(en) ? "is-matched" : ""}`}
              onClick={() => {
                setLeft(en);
                void speak(en);
              }}
            >
              {en}
            </button>
          ))}
        </div>
        <div className="idi-pairs-col">
          {exercise.right.map((pt) => (
            <button
              key={pt}
              type="button"
              disabled={locked || ptMatched.includes(pt)}
              className={`idi-pair ${ptMatched.includes(pt) ? "is-matched" : ""} ${wrong === pt ? "is-wrong" : ""}`}
              onClick={() => choose(pt)}
            >
              {pt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TypingView({ exercise, value, onChange, onSubmit, locked }: { exercise: TypingExercise; value: string; onChange: (value: string) => void; onSubmit: () => void; locked: boolean }) {
  const input = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, [exercise]);
  return (
    <div className="idi-ex">
      <h2 className="idi-ex-title">Escreva em inglês</h2>
      <div className="idi-sticker-stage">
        <span className="idi-sticker" aria-hidden>
          {exercise.emoji}
        </span>
        <p className="idi-ex-hint">
          <mark className="caderno-mark">{exercise.prompt}</mark>
        </p>
      </div>
      <form
        className="idi-type"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input
          ref={input}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={locked}
          lang="en"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="type here…"
          aria-label="Resposta em inglês"
        />
      </form>
    </div>
  );
}

function SpeakView({ exercise, value, onChange, locked }: { exercise: SpeakExercise; value: string; onChange: (value: string) => void; locked: boolean }) {
  const [listening, setListening] = useState(false);
  const [typing, setTyping] = useState(!canListen());
  const [problem, setProblem] = useState("");
  const session = useRef<Listening | null>(null);
  useEffect(() => () => session.current?.stop(), []);
  useEffect(() => {
    setTyping(!canListen());
    setProblem("");
  }, [exercise]);

  const start = () => {
    if (listening) {
      session.current?.stop();
      return;
    }
    setProblem("");
    const running = listen({
      onText: (text) => onChange(text),
      onDone: (text, error) => {
        setListening(false);
        session.current = null;
        if (!text && error) setProblem(error === "not-allowed" ? "O microfone está bloqueado. Libere no navegador ou digite." : "Não ouvi nada. Tenta de novo, mais perto do microfone.");
      },
    });
    if (!running) {
      setTyping(true);
      return;
    }
    session.current = running;
    setListening(true);
  };

  const live = value ? gradeSpeech(exercise.text, value) : null;

  return (
    <div className="idi-ex">
      <h2 className="idi-ex-title">Fale em voz alta</h2>
      <div className="idi-sticker-stage">
        <p className="idi-english idi-english-lg" lang="en">
          {exercise.text}
        </p>
        <p className="idi-ex-hint">{exercise.pt}</p>
        <Listen text={exercise.text} />
      </div>
      {typing ? (
        <div className="idi-type">
          <input value={value} onChange={(event) => onChange(event.target.value)} disabled={locked} lang="en" placeholder="Seu navegador não ouve — digite a frase" aria-label="Frase em inglês" />
        </div>
      ) : (
        <div className="idi-mic-row">
          <button type="button" className={`idi-mic ${listening ? "is-on" : ""}`} onClick={start} disabled={locked} aria-pressed={listening} aria-label={listening ? "Parar de ouvir" : "Falar no microfone"}>
            {listening ? <MicOff /> : <Mic />}
            <span className="idi-mic-wave" aria-hidden />
          </button>
          <p className={`idi-heard ${live ? `is-${live}` : ""}`} aria-live="polite">
            {value ? (
              <>
                <span className="caderno-note">ouvi:</span> <span lang="en">{value}</span>
              </>
            ) : listening ? (
              "Pode falar…"
            ) : (
              "Toque no microfone e leia a frase."
            )}
          </p>
          <button type="button" className="idi-link" onClick={() => setTyping(true)}>
            <Keyboard className="h-4 w-4" /> digitar
          </button>
        </div>
      )}
      {problem ? <p className="idi-problem">{problem}</p> : null}
    </div>
  );
}

/* ─────────────────────────── a lição ─────────────────────────── */

export type LessonFinish = { outcomes: Outcome[]; durationMs: number };

export function LessonPlayer({
  unit,
  title,
  exercises,
  onClose,
  onFinish,
}: {
  unit: LangUnit | null;
  title: string;
  exercises: Exercise[];
  onClose: () => void;
  onFinish: (result: LessonFinish) => void;
}) {
  const reduced = useSoftMotion();
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState<unknown>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [combo, setCombo] = useState(0);
  const [balloon, setBalloon] = useState<{ text: string; mood: "happy" | "think" | "wow" }>({ text: unit ? `Próxima parada: ${unit.placeEn}! Let's go.` : "Hora de revisar o que ficou grifado.", mood: "happy" });
  const [why, setWhy] = useState<{ loading: boolean; text: string } | null>(null);
  const startedAt = useRef(Date.now());
  const sheet = useRef<HTMLDivElement | null>(null);
  const exercise = exercises[index];

  useEffect(() => () => stopSpeaking(), []);
  // a voz da Mine vem do servidor: baixa a frase e as opções em inglês antes do toque
  useEffect(() => {
    const ex = exercises[index];
    if (!ex) return;
    const texts =
      ex.kind === "escolha"
        ? [ex.audio, ...(ex.mode === "significado" ? [] : ex.options)]
        : ex.kind === "monte"
          ? [ex.audio]
          : ex.kind === "fale"
            ? [ex.text]
            : ex.kind === "digite"
              ? [ex.answer]
              : ex.pairs.map((pair) => pair.en);
    preloadSpeech(texts.filter(Boolean));
  }, [exercises, index]);
  useEffect(() => {
    sheet.current?.focus({ preventScroll: true });
  }, []);

  const ready =
    exercise &&
    (exercise.kind === "escolha"
      ? typeof value === "string"
      : exercise.kind === "monte"
        ? Array.isArray(value) && value.length > 0
        : exercise.kind === "digite" || exercise.kind === "fale"
          ? typeof value === "string" && value.trim().length > 0
          : false);

  const grade = (given: unknown) => {
    if (!exercise || feedback) return;
    const checked = checkExercise(exercise, given);
    const nextCombo = countsAsRight(checked.result) ? combo + 1 : 0;
    setCombo(nextCombo);
    setOutcomes((current) => [...current, { kind: exercise.kind, result: checked.result, word: exercise.word }]);
    const shown = Array.isArray(given) ? given.join(" ") : exercise.kind === "pares" ? "" : String(given ?? "");
    setFeedback({ result: checked.result, expected: checked.expected, given: shown });
    setWhy(null);
    if (countsAsRight(checked.result)) {
      playChime();
      setBalloon({ text: nextCombo >= 3 && nextCombo % 3 === 0 ? `${nextCombo} seguidas! You're on fire!` : pick(cheers[checked.result], index + nextCombo), mood: nextCombo >= 3 ? "wow" : "happy" });
      if (exercise.kind === "escolha" || exercise.kind === "digite") void speak(checked.expected);
    } else {
      setBalloon({ text: pick(cheers.errado, index), mood: "think" });
    }
  };

  const skip = () => {
    if (!exercise || feedback) return;
    setOutcomes((current) => [...current, { kind: exercise.kind, result: "pulou", word: exercise.word }]);
    setBalloon({ text: "Tudo bem, essa fica pra próxima.", mood: "happy" });
    advance(true);
  };

  const advance = (skipped = false) => {
    stopSpeaking();
    if (index >= exercises.length - 1) {
      const finalOutcomes = skipped ? [...outcomes, { kind: exercise.kind, result: "pulou" as const, word: exercise.word }] : outcomes;
      onFinish({ outcomes: finalOutcomes, durationMs: Date.now() - startedAt.current });
      return;
    }
    setIndex((current) => current + 1);
    setValue(null);
    setFeedback(null);
    setWhy(null);
  };

  const askWhy = async () => {
    if (!exercise || !feedback) return;
    setWhy({ loading: true, text: "" });
    setBalloon({ text: "Deixa eu pensar…", mood: "think" });
    const prompt = `Tipo de exercicio: ${exercise.kind}. ${
      exercise.kind === "escolha" ? `Enunciado: ${exercise.prompt || exercise.audio}. ` : exercise.kind === "monte" ? `Frase em portugues: ${exercise.prompt}. ` : ""
    }Resposta do estudante: "${feedback.given || "(vazia)"}". Resposta certa: "${feedback.expected}".`;
    try {
      const text = await askLanguageMine({ task: "idioma-dica", prompt, context: unit ? `Parada ${unit.placeEn}: ${unit.theme}.` : "Revisao de vocabulario." });
      setWhy({ loading: false, text });
      setBalloon({ text: "Explicadinho aí embaixo!", mood: "happy" });
    } catch {
      setWhy({ loading: false, text: `A resposta certa é “${feedback.expected}”. Não consegui falar com a Mine agora, mas essa palavra volta na Revisão grifada.` });
      setBalloon({ text: "Fiquei sem sinal, mas anotei.", mood: "think" });
    }
  };

  // Enter confere e depois continua
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Enter" || event.target instanceof HTMLButtonElement) return;
      if (feedback) {
        event.preventDefault();
        advance();
      } else if (ready && !(event.target instanceof HTMLInputElement && exercise?.kind === "digite")) {
        event.preventDefault();
        grade(value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const progress = (index + (feedback ? 1 : 0)) / Math.max(1, exercises.length);
  const locked = Boolean(feedback);

  return (
    <motion.div
      className="idi-lesson"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="idi-lesson-sheet" ref={sheet} tabIndex={-1}>
        <header className="idi-lesson-top">
          <button type="button" className="idi-close" onClick={onClose} aria-label="Sair da lição">
            <X />
          </button>
          <div className="idi-pencil-track" aria-label={`Exercício ${index + 1} de ${exercises.length}`}>
            <span className="idi-pencil-fill" style={{ transform: `scaleX(${Math.max(0.03, progress)})` }} />
            <span className="idi-pencil-tip" style={{ transform: `translateX(calc(${progress * 100}% - 50%))` }} aria-hidden>
              ✏️
            </span>
          </div>
          <span className={`idi-combo ${combo >= 3 ? "is-hot" : ""}`} aria-label={`${combo} acertos seguidos`}>
            <span aria-hidden>🔥</span>
            {combo}
          </span>
        </header>

        <div className="idi-lesson-body">
          <aside className="idi-mine-corner" aria-live="polite">
            <MineFace thinking={balloon.mood === "think"} track={!reduced} className={`idi-mine-face is-${balloon.mood}`} />
            <AnimatePresence mode="wait">
              <motion.p
                key={balloon.text}
                className="idi-balloon"
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85, rotate: -3 }}
                animate={{ opacity: 1, scale: 1, rotate: -1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                {balloon.text}
              </motion.p>
            </AnimatePresence>
          </aside>

          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              className="idi-ex-wrap"
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: 60, rotateY: -14 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: -60, rotateY: 12 }}
              transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            >
              {exercise?.kind === "escolha" ? <ChoiceView exercise={exercise} value={typeof value === "string" ? value : null} onChange={setValue} locked={locked} /> : null}
              {exercise?.kind === "monte" ? <TilesView exercise={exercise} onChange={setValue} locked={locked} /> : null}
              {exercise?.kind === "pares" ? <PairsView exercise={exercise} onDone={(mistakes) => grade(mistakes)} locked={locked} /> : null}
              {exercise?.kind === "digite" ? <TypingView exercise={exercise} value={typeof value === "string" ? value : ""} onChange={setValue} onSubmit={() => ready && grade(value)} locked={locked} /> : null}
              {exercise?.kind === "fale" ? <SpeakView exercise={exercise} value={typeof value === "string" ? value : ""} onChange={setValue} locked={locked} /> : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {feedback ? (
            <motion.div
              key="fb"
              className={`idi-feedback is-${feedback.result}`}
              initial={reduced ? { opacity: 0 } : { y: "100%" }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduced ? { opacity: 0 } : { y: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              role="status"
            >
              <div className="idi-feedback-text">
                {countsAsRight(feedback.result) ? (
                  <p className="idi-feedback-title">
                    <span className="idi-hl-sweep">{feedback.result === "certo" ? "Isso!" : "Quase!"}</span>
                  </p>
                ) : (
                  <p className="idi-feedback-title idi-redpen-title">Ops, corrigindo…</p>
                )}
                {feedback.result !== "certo" ? (
                  <p className="idi-correction">
                    {feedback.given ? (
                      <span className="idi-struck" lang="en">
                        {feedback.given}
                      </span>
                    ) : null}
                    <span className="idi-redpen" lang="en">
                      {feedback.expected}
                    </span>
                  </p>
                ) : null}
                {why ? <p className="idi-why">{why.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : why.text}</p> : null}
              </div>
              <div className="idi-feedback-actions">
                {!countsAsRight(feedback.result) && !why ? (
                  <button type="button" className="idi-why-btn" onClick={() => void askWhy()}>
                    <HelpCircle className="h-4 w-4" /> Por quê?
                  </button>
                ) : null}
                <button type="button" className="idi-go" onClick={() => advance()} autoFocus>
                  Continuar
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="act" className="idi-actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {exercise?.kind === "fale" || exercise?.kind === "digite" ? (
                <button type="button" className="idi-link" onClick={skip}>
                  <SkipForward className="h-4 w-4" /> {exercise.kind === "fale" ? "Não posso falar agora" : "Pular"}
                </button>
              ) : (
                <span />
              )}
              {exercise?.kind !== "pares" ? (
                <button type="button" className="idi-go" disabled={!ready} onClick={() => grade(value)}>
                  <Check className="h-5 w-5" /> Conferir
                </button>
              ) : (
                <span className="caderno-note">ligue todos os pares</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────── resultado ─────────────────────────── */

export function LessonResultSheet({
  title,
  correct,
  total,
  stars,
  xp,
  spoke,
  wordsMissed,
  stamped,
  onClose,
  onRetry,
  xpRef,
}: {
  title: string;
  correct: number;
  total: number;
  stars: number;
  xp: number;
  spoke: number;
  wordsMissed: string[];
  stamped: boolean;
  onClose: () => void;
  onRetry: () => void;
  xpRef?: React.Ref<HTMLParagraphElement>;
}) {
  const reduced = useSoftMotion();
  useEffect(() => {
    const timer = window.setTimeout(() => playStamp(), reduced ? 0 : 520);
    return () => window.clearTimeout(timer);
  }, [reduced]);
  const passed = stars > 0;
  const line = !passed ? "Essa parada pede mais uma volta. Os erros ficaram grifados!" : stars === 3 ? "Gabaritou! A Mine ficou orgulhosa." : stars === 2 ? "Muito bem! Quase perfeito." : "Passou! Dá pra buscar mais estrelas.";
  return (
    <motion.div className="idi-lesson" role="dialog" aria-modal="true" aria-label={`Resultado: ${title}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="idi-result-sheet">
        <motion.div
          className={`idi-result-stamp ${passed ? "" : "is-retry"}`}
          initial={reduced ? { opacity: 0 } : { scale: 2.4, rotate: -24, opacity: 0 }}
          animate={{ scale: 1, rotate: -8, opacity: 1 }}
          transition={reduced ? { duration: 0.2 } : { delay: 0.35, type: "spring", stiffness: 520, damping: 18 }}
        >
          <span>{passed ? (stamped ? "STAMPED" : "PASSED") : "TRY AGAIN"}</span>
          <small>{title}</small>
        </motion.div>
        <div className="idi-stars" aria-label={`${stars} de 3 estrelas`}>
          {[1, 2, 3].map((star) => (
            <motion.svg
              key={star}
              viewBox="0 0 24 24"
              className={`idi-star ${star <= stars ? "is-on" : ""}`}
              initial={reduced ? false : { scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.75 + star * 0.16, type: "spring", stiffness: 380, damping: 14 }}
              aria-hidden
            >
              <path pathLength={1} d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
            </motion.svg>
          ))}
        </div>
        <p className="idi-result-line">{line}</p>
        <div className="idi-result-stats">
          <div>
            <p className="idi-stat-num">
              {correct}/{total}
            </p>
            <p className="idi-stat-label">acertos</p>
          </div>
          <div>
            <p className="idi-stat-num idi-stat-xp" ref={xpRef}>
              +{xp}
            </p>
            <p className="idi-stat-label">XP</p>
          </div>
          <div>
            <p className="idi-stat-num">{spoke}</p>
            <p className="idi-stat-label">frases faladas</p>
          </div>
        </div>
        {wordsMissed.length ? (
          <p className="idi-result-missed">
            <span className="caderno-note">grifei pra revisar:</span>{" "}
            {wordsMissed.slice(0, 6).map((word) => (
              <mark key={word} className="caderno-mark" lang="en">
                {word}
              </mark>
            ))}
          </p>
        ) : null}
        <div className="idi-result-actions">
          <button type="button" className="idi-link" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" /> Fazer de novo
          </button>
          <button type="button" className="idi-go" onClick={onClose} autoFocus>
            Continuar a viagem
          </button>
        </div>
      </div>
    </motion.div>
  );
}
