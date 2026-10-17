// Carregado sob demanda (React.lazy): a aba Idiomas, o intercâmbio da Mine.
import React, { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpenCheck, Highlighter, Lock, MessageCircle, Play, Printer, Star, Stamp, Volume2, X } from "lucide-react";
import { PageHeader, uid, type Session, type User, type useMemoUserData, type AppData } from "../main";
import { useQualityTier, useSoftMotion } from "../motion";
import { celebrateFrom, floatXp, mineSays } from "../caderno";
import { MineFace } from "../caderno/MineFace";
import {
  buildLesson,
  buildReviewLesson,
  englishUnits,
  languageProgress,
  lessonKey,
  lessonResult,
  lessonStages,
  wordOfTheDay,
  wordsToReview,
  type Exercise,
  type LangUnit,
  type LessonResult,
} from "../../shared/idiomas.mjs";
import { LessonPlayer, LessonResultSheet, type LessonFinish } from "./LessonPlayer";
import { Conversa } from "./Conversa";
import { setVoiceSource, speak, voiceSource, type VoiceSource } from "./voz";
import type { CityStop, StopState } from "./CidadePopUp";
import "./idiomas.css";

const CidadePopUp = React.lazy(() => import("./CidadePopUp"));

/** Cor de marca-texto de cada parada, a mesma na cidade 3D e na trilha. */
const toneHex: Record<LangUnit["color"], string> = { lilac: "#b7a6ff", yellow: "#f4e65a", mint: "#7fe7aa", pink: "#ffaabd" };

class CityBoundary extends React.Component<{ onFail: () => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** A cidade sem WebGL: prédios de papel em CSS, que também sobem da folha. */
function CidadePlana({ stops, onSelect }: { stops: CityStop[]; onSelect: (id: string) => void }) {
  return (
    <div className="idi-city2d" role="list" aria-label="Paradas do intercâmbio">
      <svg className="idi-city2d-path" viewBox="0 0 800 200" preserveAspectRatio="none" aria-hidden>
        <path d="M20 150 C 120 20, 200 20, 260 120 S 420 200, 480 80 S 640 10, 780 120" pathLength={1} />
      </svg>
      {stops.map((stop, index) => (
        <button
          key={stop.id}
          type="button"
          role="listitem"
          className={`idi-house is-${stop.state}`}
          style={{ "--i": index, "--tone": stop.color } as React.CSSProperties}
          onClick={() => onSelect(stop.id)}
          aria-label={`${stop.place}${stop.state === "locked" ? ", fechada" : stop.state === "done" ? ", carimbada" : ""}`}
        >
          <span className="idi-house-roof" aria-hidden />
          <span className="idi-house-body" aria-hidden>
            <span className="idi-house-emoji">{stop.state === "locked" ? "🔒" : stop.emoji}</span>
          </span>
          <span className="idi-house-label">{stop.label}</span>
          {stop.state === "next" ? <span className="idi-house-pin" aria-hidden /> : null}
          {stop.state === "done" ? <span className="idi-house-flag" aria-hidden>OK!</span> : null}
        </button>
      ))}
    </div>
  );
}

type Active =
  | { kind: "licao"; unit: LangUnit; stage: number; exercises: Exercise[] }
  | { kind: "conversa"; unit: LangUnit }
  | { kind: "revisao"; exercises: Exercise[] };

type Finished = { title: string; result: LessonResult; stamped: boolean; retry: () => void; missions?: { done: number; total: number } };

export function IdiomasView({ data, user, update }: { data: ReturnType<typeof useMemoUserData>; user: User; update: (next: (draft: AppData) => AppData) => void }) {
  const reduced = useSoftMotion();
  const tier = useQualityTier();
  const [cityFailed, setCityFailed] = useState(false);
  const [active, setActive] = useState<Active | null>(null);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [passport, setPassport] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [voice, setVoice] = useState<VoiceSource>(() => voiceSource());
  const xpRef = useRef<HTMLParagraphElement | null>(null);
  const trailRef = useRef<HTMLDivElement | null>(null);

  const sessions = data.sessions;
  const studentName = user.settings?.displayName || user.name || "";
  const progress = useMemo(() => languageProgress(sessions), [sessions]);
  const review = useMemo(() => wordsToReview(sessions), [sessions]);
  const word = useMemo(() => wordOfTheDay(), []);
  const use3d = useMemo(() => tier !== "low" && !reduced && !cityFailed && webglAvailable(), [tier, reduced, cityFailed]);

  const unitState = (unit: LangUnit): StopState => {
    if (progress.stamps.includes(unit.id)) return "done";
    if (progress.next?.unitId === unit.id) return "next";
    return lessonStages.some(({ stage }) => progress.unlocked.has(lessonKey(unit.id, stage))) ? "open" : "locked";
  };
  const stops: CityStop[] = englishUnits.map((unit) => ({ id: unit.id, emoji: unit.emoji, label: unit.placeEn, place: unit.place, color: toneHex[unit.color], state: unitState(unit) }));
  const nextUnit = progress.next ? englishUnits.find((unit) => unit.id === progress.next!.unitId) || null : null;
  const accuracy = progress.totals.answered ? Math.round((progress.totals.correct / progress.totals.answered) * 100) : 0;

  const startStage = (unit: LangUnit, stage: number) => {
    if (!progress.unlocked.has(lessonKey(unit.id, stage))) {
      mineSays("Essa etapa abre quando você terminar a anterior!", "think");
      return;
    }
    setFinished(null);
    if (stage === 3) setActive({ kind: "conversa", unit });
    else setActive({ kind: "licao", unit, stage, exercises: buildLesson(unit, stage, Date.now(), review) });
  };

  const selectStop = (id: string) => {
    const unit = englishUnits.find((item) => item.id === id);
    if (!unit) return;
    setFocusId(id);
    const card = trailRef.current?.querySelector<HTMLElement>(`[data-unit="${id}"]`);
    card?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    card?.classList.remove("is-flash");
    void card?.offsetWidth;
    card?.classList.add("is-flash");
    if (unitState(unit) === "locked") mineSays(`${unit.place} ainda está fechada. Siga a trilha!`, "think");
  };

  const startReview = () => {
    const exercises = buildReviewLesson(review, Date.now());
    if (!exercises.length) {
      mineSays("Ainda não tem palavra grifada suficiente. Erra umas aí! 😄", "happy");
      return;
    }
    setFinished(null);
    setActive({ kind: "revisao", exercises });
  };

  const save = (current: Active, finish: LessonFinish) => {
    const result = lessonResult(finish.outcomes);
    const unit = current.kind === "revisao" ? null : current.unit;
    const stage = current.kind === "licao" ? current.stage : current.kind === "conversa" ? 3 : 0;
    const key = unit ? lessonKey(unit.id, stage) : "en/revisao";
    const title = unit ? `${unit.placeEn} · ${lessonStages[stage - 1].label}` : "Revisão grifada";
    const session: Session = {
      id: uid("session"),
      userId: user.id,
      subjectId: "idiomas",
      title: `Inglês: ${title}`,
      kind: "Idiomas",
      createdAt: Date.now(),
      xpEarned: result.xp,
      correctAnswers: result.correct,
      questionsAnswered: result.total,
      accuracy: result.accuracy,
      durationMs: finish.durationMs,
      lang: "en",
      lessonKey: key,
      wordsRight: result.wordsRight,
      wordsMissed: result.wordsMissed,
      spoke: result.spoke,
    };
    if (result.total > 0) update((draft) => ({ ...draft, sessions: [...draft.sessions, session] }));
    const after = languageProgress([...sessions, session]);
    const stamped = Boolean(unit && after.stamps.includes(unit.id) && !progress.stamps.includes(unit.id));
    setActive(null);
    setFinished({
      title,
      result,
      stamped,
      missions: current.kind === "conversa" && unit ? { done: finish.missions || 0, total: unit.missions.length } : undefined,
      retry: () => {
        if (current.kind === "licao") startStage(current.unit, current.stage);
        else if (current.kind === "conversa") setActive({ kind: "conversa", unit: current.unit });
        else startReview();
        setFinished(null);
      },
    });
    window.setTimeout(() => {
      if (xpRef.current && result.xp > 0) {
        floatXp(`+${result.xp} XP`, xpRef.current);
        celebrateFrom(xpRef.current, { count: result.stars >= 2 ? 30 : 14, spread: 1 });
      }
    }, reduced ? 50 : 1100);
    mineSays(stamped ? `Passaporte carimbado: ${unit!.placeEn}!` : result.stars ? "Mais um passo na viagem!" : "Bora tentar de novo?", stamped ? "wow" : "happy");
  };

  return (
    <div className="idi-page">
      <PageHeader
        eyebrow="Idiomas · inglês"
        title="Intercâmbio da Mine"
        subtitle="Uma viagem a Londres em oito paradas. Aprenda palavras com figurinhas, monte frases, fale no microfone e converse com a Mine no papel de quem você encontra pelo caminho."
        action={
          <button type="button" className="idi-passport-btn" onClick={() => setPassport(true)}>
            <BookOpenCheck className="h-5 w-5" /> Meu passaporte
          </button>
        }
      />

      <div className="idi-langs" role="tablist" aria-label="Idioma">
        <button type="button" role="tab" aria-selected className="idi-lang is-on">
          <span className="idi-lang-code" aria-hidden>EN</span> Inglês
        </button>
        <span className="idi-lang is-soon" aria-disabled>
          <span className="idi-lang-code" aria-hidden>ES</span> Espanhol <small>em breve</small>
        </span>
        <span className="idi-lang is-soon" aria-disabled>
          <span className="idi-lang-code" aria-hidden>FR</span> Francês <small>em breve</small>
        </span>
        <button
          type="button"
          className="idi-voice-toggle"
          aria-pressed={voice === "mine"}
          onClick={() => {
            const next: VoiceSource = voice === "mine" ? "navegador" : "mine";
            setVoiceSource(next);
            setVoice(next);
            void speak(next === "mine" ? "Hi! This is my voice." : "Hello! This is the browser voice.");
          }}
          title="Trocar a voz das lições"
        >
          <Volume2 className="h-4 w-4" /> voz: {voice === "mine" ? "Mine (IA)" : "navegador"}
        </button>
      </div>

      <section className="idi-hero" aria-label="Mapa do intercâmbio">
        {use3d ? (
          <CityBoundary onFail={() => setCityFailed(true)}>
            <React.Suspense fallback={<div className="idi-city3d" />}>
              <CidadePopUp stops={stops} onSelect={selectStop} quality={tier === "high" ? "high" : "medium"} focusId={focusId} />
            </React.Suspense>
          </CityBoundary>
        ) : (
          <CidadePlana stops={stops} onSelect={selectStop} />
        )}
        <div className="idi-hero-card">
          <MineFace track={!reduced} className="idi-hero-face" />
          <div>
            <p className="caderno-note">{nextUnit ? "próxima parada" : "viagem completa!"}</p>
            <p className="idi-hero-title">{nextUnit ? `${nextUnit.emoji} ${nextUnit.placeEn}` : "🎓 Graduated!"}</p>
            <p className="idi-hero-sub">{nextUnit ? `${nextUnit.place} · ${lessonStages[progress.next!.stage - 1].label}` : "Todas as paradas carimbadas."}</p>
          </div>
          <div className="idi-hero-stats" aria-label="Sua sequência">
            <span className={`idi-streak ${progress.streak ? "is-on" : ""}`} title="Dias seguidos com pelo menos uma lição">
              <span className="idi-streak-flame" aria-hidden>
                🔥
              </span>
              <strong>{progress.streak}</strong>
              <small>{progress.streak === 1 ? "dia" : "dias"}</small>
            </span>
            <span className={`idi-goal ${progress.todayLessons >= 1 ? "is-done" : ""}`} title="Meta do dia: uma lição">
              <svg viewBox="0 0 36 36" aria-hidden>
                <circle cx="18" cy="18" r="15" />
                <circle cx="18" cy="18" r="15" pathLength={1} style={{ strokeDashoffset: progress.todayLessons >= 1 ? 0 : 1 }} />
              </svg>
              <small>{progress.todayLessons >= 1 ? "meta feita!" : "meta: 1 lição"}</small>
            </span>
          </div>
          {nextUnit ? (
            <button type="button" className="idi-go" onClick={() => startStage(nextUnit, progress.next!.stage)}>
              <Play className="h-4 w-4" /> {progress.totals.lessons ? "Continuar" : "Começar a viagem"}
            </button>
          ) : null}
        </div>
        {use3d ? <p className="idi-hero-hint caderno-note">arraste para girar a cidade · clique num prédio</p> : null}
      </section>

      <div className="idi-strip">
        <button type="button" className={`idi-postcard ${flipped ? "is-flipped" : ""}`} onClick={() => { setFlipped((value) => !value); void speak(word.en); }} aria-label={`Palavra do dia: ${word.en}, ${word.pt}. Toque para virar e ouvir.`}>
          <span className="idi-postcard-face is-front">
            <span className="caderno-note">word of the day</span>
            <span className="idi-postcard-emoji" aria-hidden>{word.emoji}</span>
            <span className="idi-postcard-word" lang="en">{word.en}</span>
            <span className="idi-postcard-hint"><Volume2 className="h-4 w-4" /> toque para virar</span>
          </span>
          <span className="idi-postcard-face is-back" aria-hidden>
            <span className="caderno-note">significa</span>
            <span className="idi-postcard-word">{word.pt}</span>
            <span className="idi-postcard-stamp">LONDON</span>
          </span>
        </button>

        <div className="idi-card idi-level">
          <p className="caderno-note">seu nível</p>
          <p className="idi-level-code">{progress.level.code}</p>
          <p className="idi-level-label">{progress.level.label}</p>
          <div className="idi-level-bar" aria-label={`${progress.done.size} de ${progress.path.length} etapas`}>
            <span style={{ transform: `scaleX(${progress.done.size / progress.path.length})` }} />
          </div>
          <dl className="idi-mini-stats">
            <div><dt>palavras</dt><dd>{progress.learnedWords}</dd></div>
            <div><dt>acerto</dt><dd>{accuracy}%</dd></div>
            <div><dt>falou</dt><dd>{progress.totals.spoke}</dd></div>
          </dl>
        </div>

        <div className="idi-card idi-review">
          <p className="caderno-note">revisão grifada</p>
          <p className="idi-review-count">
            <Highlighter className="h-5 w-5" /> {review.length} {review.length === 1 ? "palavra" : "palavras"}
          </p>
          <p className="idi-review-words">
            {review.length ? review.slice(0, 6).map((item) => <mark key={item} className="caderno-mark" lang="en">{item}</mark>) : <span>O que você errar fica grifado aqui e volta para revisar.</span>}
          </p>
          <button type="button" className="idi-link" onClick={startReview} disabled={review.length < 4}>
            {review.length < 4 ? `revisão abre com 4 palavras` : "Revisar agora"}
          </button>
        </div>
      </div>

      <section className="idi-trail" ref={trailRef} aria-label="Trilha de paradas">
        {englishUnits.map((unit, index) => {
          const state = unitState(unit);
          return (
            <motion.article
              key={unit.id}
              data-unit={unit.id}
              className={`idi-stop is-${state} ${index % 2 ? "is-right" : "is-left"}`}
              style={{ "--tone": toneHex[unit.color] } as React.CSSProperties}
              initial={reduced ? false : { opacity: 0, y: 26, rotate: index % 2 ? 1.5 : -1.5 }}
              whileInView={{ opacity: 1, y: 0, rotate: index % 2 ? 0.6 : -0.6 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="idi-stop-sticker" aria-hidden>{state === "locked" ? "🔒" : unit.emoji}</span>
              <div className="idi-stop-head">
                <p className="caderno-note">parada {index + 1}</p>
                <h3 className="idi-stop-title" lang="en">{unit.placeEn}</h3>
                <p className="idi-stop-sub">{unit.place} · {unit.theme}</p>
                {state !== "locked" ? (
                  <p className="idi-stop-meta">
                    <span>
                      <mark className="caderno-mark">dica</mark> {unit.tip.title}
                    </span>
                    <span>
                      conversa com <strong lang="en">{unit.character}</strong>
                    </span>
                  </p>
                ) : null}
              </div>
              <div className="idi-stages">
                {lessonStages.map(({ stage, label, hint }) => {
                  const key = lessonKey(unit.id, stage);
                  const open = progress.unlocked.has(key);
                  const done = progress.done.has(key);
                  const isNext = progress.next?.key === key;
                  const stars = progress.best[key]?.stars || 0;
                  const Icon = stage === 3 ? MessageCircle : stage === 2 ? BookOpenCheck : Star;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`idi-stage ${done ? "is-done" : ""} ${isNext ? "is-next" : ""} ${open ? "" : "is-locked"}`}
                      onClick={() => startStage(unit, stage)}
                      aria-disabled={!open}
                      aria-label={`${label}: ${hint}${done ? `, ${stars} estrelas` : open ? "" : ", fechada"}`}
                    >
                      <span className="idi-stage-dot">{open ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}</span>
                      <span className="idi-stage-label">{label}</span>
                      <span className="idi-stage-stars" aria-hidden>
                        {[1, 2, 3].map((n) => <i key={n} className={n <= stars ? "is-on" : ""} />)}
                      </span>
                    </button>
                  );
                })}
              </div>
              {state === "done" ? <span className="idi-stop-stamp" aria-label="carimbada">STAMPED<small>{unit.placeEn}</small></span> : null}
            </motion.article>
          );
        })}
      </section>

      {/* As janelas vão direto para o <body>: no celular um contêiner da página
          tem transform, e aí position: fixed passaria a medir esse contêiner
          (a lição ficava com a altura da página inteira). */}
      {createPortal(
      <AnimatePresence>
        {active?.kind === "licao" ? (
          <LessonPlayer
            key="licao"
            unit={active.unit}
            title={`${active.unit.placeEn} · ${lessonStages[active.stage - 1].label}`}
            exercises={active.exercises}
            studentName={studentName}
            onClose={() => setActive(null)}
            onFinish={(finish) => save(active, finish)}
          />
        ) : null}
        {active?.kind === "revisao" ? (
          <LessonPlayer key="revisao" unit={null} title="Revisão grifada" exercises={active.exercises} studentName={studentName} onClose={() => setActive(null)} onFinish={(finish) => save(active, finish)} />
        ) : null}
        {active?.kind === "conversa" ? (
          <Conversa key="conversa" unit={active.unit} level={progress.level} studentName={studentName} onClose={() => setActive(null)} onFinish={(finish) => save(active, finish)} />
        ) : null}
        {finished ? (
          <LessonResultSheet
            key="resultado"
            title={finished.title}
            correct={finished.result.correct}
            total={finished.result.total}
            stars={finished.result.stars}
            xp={finished.result.xp}
            spoke={finished.result.spoke}
            wordsMissed={finished.result.wordsMissed}
            stamped={finished.stamped}
            missions={finished.missions}
            xpRef={xpRef}
            onRetry={finished.retry}
            onClose={() => setFinished(null)}
          />
        ) : null}
        {passport ? (
          <motion.div key="passaporte" className="idi-lesson" role="dialog" aria-modal="true" aria-label="Passaporte" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(event) => event.target === event.currentTarget && setPassport(false)}>
            <motion.div className="idi-passport idi-print" initial={reduced ? false : { rotateY: -80, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
              <button type="button" className="idi-close idi-noprint" onClick={() => setPassport(false)} aria-label="Fechar passaporte">
                <X />
              </button>
              <header className="idi-passport-head">
                <p className="idi-passport-kicker">MINERVA · EXCHANGE PASSPORT</p>
                <h2 className="idi-passport-name">{user.settings?.displayName || user.name}</h2>
                <p className="idi-passport-sub">Inglês · nível {progress.level.code} — {progress.level.label}</p>
              </header>
              <dl className="idi-passport-stats">
                <div><dt>lições feitas</dt><dd>{progress.totals.lessons}</dd></div>
                <div><dt>etapas da trilha</dt><dd>{progress.done.size}/{progress.path.length}</dd></div>
                <div><dt>acerto geral</dt><dd>{accuracy}%</dd></div>
                <div><dt>palavras aprendidas</dt><dd>{progress.learnedWords}</dd></div>
                <div><dt>frases faladas</dt><dd>{progress.totals.spoke}</dd></div>
                <div><dt>XP em idiomas</dt><dd>{progress.totals.xp}</dd></div>
              </dl>
              <div className="idi-passport-stamps">
                {englishUnits.map((unit, index) => {
                  const stamped = progress.stamps.includes(unit.id);
                  return (
                    <div key={unit.id} className={`idi-pstamp ${stamped ? "is-on" : ""}`} style={{ "--r": `${((index * 47) % 22) - 11}deg` } as React.CSSProperties}>
                      {stamped ? (
                        <>
                          <Stamp className="h-4 w-4" />
                          <strong>{unit.placeEn}</strong>
                          <small>{unit.emoji}</small>
                        </>
                      ) : (
                        <small>{unit.place}</small>
                      )}
                    </div>
                  );
                })}
              </div>
              {review.length ? (
                <p className="idi-passport-review">
                  <strong>Para revisar:</strong> {review.slice(0, 12).join(", ")}
                </p>
              ) : null}
              <div className="idi-passport-actions idi-noprint">
                <button type="button" className="idi-go" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> Imprimir para o professor
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
