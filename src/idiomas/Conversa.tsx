import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Languages, Loader2, Mic, MicOff, Send, X } from "lucide-react";
import { useSoftMotion } from "../motion";
import { MineFace } from "../caderno/MineFace";
import { playChime, playPop } from "../caderno";
import {
  conversationContext,
  conversationTurns,
  parseConversationReply,
  type LangLevel,
  type LangUnit,
  type Outcome,
} from "../../shared/idiomas.mjs";
import { askLanguageMine, type MineTurn } from "./api";
import { canListen, listen, speak, stopSpeaking, type Listening } from "./voz";
import type { LessonFinish } from "./LessonPlayer";

type Line =
  | { id: string; from: "mine"; text: string; translation?: string }
  | { id: string; from: "aluno"; text: string; correction?: string; tip?: string; score?: number; spoken?: boolean };

/**
 * Roleplay da etapa 3. A Mine interpreta um personagem da parada e corrige
 * cada fala do aluno com caneta vermelha. Se ela não responder (sem rede,
 * sem cota, formato quebrado), a conversa continua pelo roteiro da parada
 * com respostas para escolher — a lição nunca trava.
 */
export function Conversa({
  unit,
  level,
  studentName = "",
  onClose,
  onFinish,
}: {
  unit: LangUnit;
  level: LangLevel;
  studentName?: string;
  onClose: () => void;
  onFinish: (result: LessonFinish) => void;
}) {
  const reduced = useSoftMotion();
  const [lines, setLines] = useState<Line[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [mode, setMode] = useState<"ia" | "roteiro">("ia");
  const [waiting, setWaiting] = useState(true);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [spokenDraft, setSpokenDraft] = useState(false);
  const history = useRef<MineTurn[]>([]);
  const outcomes = useRef<Outcome[]>([]);
  const turn = useRef(0);
  const startedAt = useRef(Date.now());
  const mic = useRef<Listening | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const abort = useRef<AbortController | null>(null);
  const context = conversationContext(unit, level, studentName.trim().split(/\s+/)[0] || "");
  const finishing = useRef(false);
  // missões cumpridas: a Mine manda a lista inteira a cada fala; no roteiro, cada resposta certa cumpre a sua
  const [missions, setMissions] = useState<number[]>([]);
  const missionsRef = useRef<number[]>([]);
  const [translated, setTranslated] = useState<string[]>([]);

  const markMissions = (found: number[]) => {
    const valid = found.filter((item) => item >= 0 && item < unit.missions.length && !missionsRef.current.includes(item));
    if (!valid.length) return;
    missionsRef.current = [...missionsRef.current, ...valid].sort((a, b) => a - b);
    setMissions(missionsRef.current);
    playChime();
  };

  const mineLine = (text: string, translation = "") => {
    setLines((current) => [...current, { id: `m${current.length}`, from: "mine", text, translation }]);
    history.current.push({ role: "assistant", text });
    void speak(text);
  };

  const followScript = (at: number) => {
    setMode("roteiro");
    const step = unit.script[Math.min(at, unit.script.length - 1)];
    mineLine(step.mine);
    setSuggestions(step.options.map((option) => option.en).sort(() => 0.5 - Math.random()));
    setWaiting(false);
  };

  const finish = () => {
    if (finishing.current) return;
    finishing.current = true;
    // cada missão vira um item da nota: cumprir as três vale tanto quanto falar bem
    const missionOutcomes: Outcome[] = unit.missions.map((_, index) => ({ kind: "missao", result: missionsRef.current.includes(index) ? "certo" : "errado", word: "" }));
    window.setTimeout(
      () => onFinish({ outcomes: [...outcomes.current, ...missionOutcomes], durationMs: Date.now() - startedAt.current, missions: missionsRef.current.length }),
      reduced ? 300 : 1600,
    );
  };

  // abertura da cena
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    askLanguageMine({ task: "idioma-conversa", prompt: "[COMECAR]", context }, { signal: controller.signal, timeoutMs: 45_000 })
      .then((reply) => {
        // resposta que chegou depois de a tela fechar (ou do remonte do StrictMode) não entra
        if (controller.signal.aborted) return;
        const parsed = parseConversationReply(reply);
        if (!parsed) throw new Error("formato");
        mineLine(parsed.mine, parsed.translation);
        setSuggestions(parsed.suggestions);
        setWaiting(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) followScript(0);
      });
    return () => {
      controller.abort();
      stopSpeaking();
      mic.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [lines, waiting, reduced]);

  const send = async (text: string, spoken = false) => {
    const clean = text.trim();
    if (!clean || waiting || turn.current >= conversationTurns) return;
    playPop();
    stopSpeaking();
    setDraft("");
    setSpokenDraft(false);
    setSuggestions([]);
    const id = `a${turn.current}`;
    setLines((current) => [...current, { id, from: "aluno", text: clean, spoken }]);
    const at = turn.current;
    turn.current += 1;
    const last = turn.current >= conversationTurns;

    const grade = (score: number, correction = "", tip = "") => {
      outcomes.current.push({ kind: "conversa", result: score >= 2 ? "certo" : score === 1 ? "quase" : "errado", word: "" });
      setLines((current) => current.map((line) => (line.id === id && line.from === "aluno" ? { ...line, score, correction, tip } : line)));
      if (score >= 1) playChime();
    };

    if (mode === "roteiro") {
      const step = unit.script[Math.min(at, unit.script.length - 1)];
      const chosen = step.options.find((option) => option.en === clean);
      const right = step.options.find((option) => option.ok)!;
      grade(chosen?.ok ? 2 : 0, chosen?.ok ? "" : right.en, chosen?.ok ? "Resposta certinha para a cena!" : "Essa resposta não combina com o que foi perguntado.");
      if (chosen?.ok) markMissions([unit.scriptMissions[at] ?? -1]);
      if (last) {
        mineLine("That was great! See you at the next stop!");
        finish();
      } else {
        setWaiting(true);
        window.setTimeout(() => followScript(at + 1), reduced ? 100 : 700);
      }
      return;
    }

    setWaiting(true);
    const prompt = last ? `${clean}\n\n(Esta e a ultima fala do estudante: avalie e encerre a cena com uma despedida curta no personagem, sem nova pergunta.)` : clean;
    const previous = [...history.current];
    history.current.push({ role: "user", text: clean });
    try {
      const reply = await askLanguageMine({ task: "idioma-conversa", prompt, context, history: previous }, { signal: abort.current?.signal, timeoutMs: 45_000 });
      const parsed = parseConversationReply(reply);
      if (!parsed) throw new Error("formato");
      grade(parsed.score, parsed.correction, parsed.tip);
      markMissions(parsed.missions);
      mineLine(parsed.mine, parsed.translation);
      setWaiting(false);
      if (last) finish();
      else setSuggestions(parsed.suggestions);
    } catch {
      if (abort.current?.signal.aborted) return;
      // sem a Mine: avalia pela proximidade com a melhor resposta do roteiro
      const step = unit.script[Math.min(at, unit.script.length - 1)];
      const right = step.options.find((option) => option.ok)!;
      const english = /^[\x20-\x7e’]+$/.test(clean) && clean.split(/\s+/).length >= 2;
      grade(english ? 1 : 0, right.en, "A Mine ficou sem sinal; essa é uma resposta modelo para a cena.");
      if (english) markMissions([unit.scriptMissions[at] ?? -1]);
      if (last) {
        mineLine("Great talk! See you soon!");
        setWaiting(false);
        finish();
      } else followScript(at + 1);
    }
  };

  const toggleMic = () => {
    if (listening) {
      mic.current?.stop();
      return;
    }
    const running = listen({
      onText: (text) => {
        setDraft(text);
        setSpokenDraft(true);
      },
      onDone: (text) => {
        setListening(false);
        mic.current = null;
        if (text) void send(text, true);
      },
    });
    if (running) {
      mic.current = running;
      setListening(true);
    }
  };

  const remaining = Math.max(0, conversationTurns - turn.current);

  return (
    <motion.div
      className="idi-lesson"
      role="dialog"
      aria-modal="true"
      aria-label={`Conversa: ${unit.placeEn}`}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <div className="idi-lesson-sheet idi-chat-sheet">
        <header className="idi-lesson-top idi-chat-top">
          <button type="button" className="idi-close" onClick={onClose} aria-label="Sair da conversa">
            <X />
          </button>
          <div className="idi-chat-scene">
            <span className="idi-chat-scene-emoji" aria-hidden>
              {unit.emoji}
            </span>
            <div>
              <p className="idi-chat-scene-title">{unit.placeEn}</p>
              <p className="idi-chat-scene-role">a Mine é {unit.characterPt}</p>
            </div>
          </div>
          <span className="idi-turns" aria-label={`${remaining} falas restantes`}>
            {Array.from({ length: conversationTurns }, (_, index) => (
              <span key={index} className={index < turn.current ? "is-used" : ""} />
            ))}
          </span>
          <ol className="idi-missions" aria-label="Missões da cena">
            {unit.missions.map((mission, index) => {
              const done = missions.includes(index);
              return (
                <li key={mission} className={done ? "is-done" : ""}>
                  <motion.span className="idi-mission-box" animate={done && !reduced ? { scale: [1, 1.35, 1], rotate: [0, -12, 0] } : undefined} transition={{ duration: 0.45 }}>
                    {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </motion.span>
                  <span className="idi-mission-text">{mission}</span>
                </li>
              );
            })}
          </ol>
        </header>

        <div className="idi-chat" ref={scroller} aria-live="polite">
          <AnimatePresence initial={false}>
            {lines.map((line) =>
              line.from === "mine" ? (
                <motion.div key={line.id} className="idi-msg is-mine" initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
                  <MineFace className="idi-msg-face" />
                  <div className="idi-msg-col">
                    <div className="idi-msg-bubble" lang="en">
                      {line.text}
                      <button type="button" className="idi-msg-listen" onClick={() => void speak(line.text)} aria-label="Ouvir de novo">
                        🔊
                      </button>
                    </div>
                    {line.translation ? (
                      translated.includes(line.id) ? (
                        <p className="idi-msg-translation">{line.translation}</p>
                      ) : (
                        <button type="button" className="idi-msg-translate" onClick={() => setTranslated((current) => [...current, line.id])}>
                          <Languages className="h-3.5 w-3.5" aria-hidden /> ver em português
                        </button>
                      )
                    ) : null}
                  </div>
                </motion.div>
              ) : (
                <motion.div key={line.id} className="idi-msg is-aluno" initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
                  <div className={`idi-msg-bubble ${line.correction ? "has-correction" : ""}`} lang="en">
                    {line.spoken ? <Mic className="idi-msg-mic" aria-label="falado" /> : null}
                    <span className={line.correction ? "idi-struck-soft" : ""}>{line.text}</span>
                    {line.correction ? <span className="idi-redpen idi-redpen-inline">{line.correction}</span> : null}
                  </div>
                  {typeof line.score === "number" ? (
                    <p className={`idi-msg-tip is-${line.score}`}>
                      <span className="idi-msg-score">{line.score === 2 ? "✓✓" : line.score === 1 ? "✓" : "✗"}</span> {line.tip}
                    </p>
                  ) : null}
                </motion.div>
              ),
            )}
          </AnimatePresence>
          {waiting ? (
            <div className="idi-msg is-mine is-typing">
              <MineFace thinking className="idi-msg-face" />
              <div className="idi-msg-bubble">
                <span className="idi-dots" aria-label="A Mine está escrevendo">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {remaining > 0 ? (
          <div className="idi-chat-input">
            {suggestions.length ? (
              <div className="idi-suggestions" aria-label="Respostas sugeridas">
                {suggestions.map((suggestion) => (
                  <button key={suggestion} type="button" className="idi-chip" lang="en" disabled={waiting} onClick={() => (mode === "roteiro" ? void send(suggestion) : setDraft(suggestion))}>
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
            {mode === "ia" ? (
              <form
                className="idi-chat-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send(draft, spokenDraft);
                }}
              >
                {canListen() ? (
                  <button type="button" className={`idi-mic is-small ${listening ? "is-on" : ""}`} onClick={toggleMic} disabled={waiting} aria-pressed={listening} aria-label={listening ? "Parar de ouvir" : "Responder falando"}>
                    {listening ? <MicOff /> : <Mic />}
                    <span className="idi-mic-wave" aria-hidden />
                  </button>
                ) : null}
                <input
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setSpokenDraft(false);
                  }}
                  placeholder={listening ? "Pode falar…" : "Answer in English…"}
                  lang="en"
                  disabled={waiting}
                  aria-label="Sua resposta em inglês"
                />
                <button type="submit" className="idi-send" disabled={waiting || !draft.trim()} aria-label="Enviar">
                  {waiting ? <Loader2 className="animate-spin" /> : <Send />}
                </button>
              </form>
            ) : (
              <p className="caderno-note idi-chat-note">a Mine está sem sinal — escolha a melhor resposta</p>
            )}
          </div>
        ) : (
          <p className="caderno-note idi-chat-note">cena encerrada! carimbando…</p>
        )}
      </div>
    </motion.div>
  );
}
