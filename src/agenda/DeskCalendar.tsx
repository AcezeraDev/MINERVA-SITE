import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, GraduationCap, Landmark } from "lucide-react";
import { go, today, type PublicHoliday, type Subject, type Task } from "../main";
import { daysBetween, shiftDays } from "../../shared/agenda.mjs";
import { useQualityTier, useSoftMotion } from "../motion";

const monthShort = new Intl.DateTimeFormat("pt-BR", { month: "long" });
const weekdayLong = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });

/**
 * Folhinha de mesa em CSS 3D: base inclinada, espiral e um bloco de folhas.
 * Trocar o dia vira a folha por cima da espiral (para frente) ou faz a folha
 * anterior cair de volta (para trás). Só transform/opacity; a inclinação pelo
 * ponteiro escreve variáveis CSS direto no nó, sem setState por pointermove.
 */
export function DeskCalendar({
  day,
  setDay,
  tasks,
  holiday,
}: {
  day: number;
  setDay: (day: number) => void;
  tasks: Task[];
  holiday?: PublicHoliday;
}) {
  const reduced = useSoftMotion();
  const tier = useQualityTier();
  const flat = reduced || tier === "low";
  const ref = useRef<HTMLDivElement>(null);
  const rect = useRef<DOMRect | null>(null);
  const last = useRef(day);
  const direction = day >= last.current ? 1 : -1;
  useEffect(() => {
    last.current = day;
  }, [day]);

  const open = tasks.filter((task) => !task.done && task.dueAt === day);
  const exams = open.filter((task) => task.kind === "prova").length;
  const date = new Date(day);
  const isToday = day === today();
  const offset = daysBetween(today(), day);

  const onPointerMove = (event: React.PointerEvent) => {
    const node = ref.current;
    const box = rect.current;
    if (!node || !box || flat) return;
    node.style.setProperty("--tilt-x", `${((event.clientY - box.top) / box.height - 0.5) * -10}deg`);
    node.style.setProperty("--tilt-y", `${((event.clientX - box.left) / box.width - 0.5) * 14}deg`);
  };
  const onPointerLeave = () => {
    ref.current?.style.setProperty("--tilt-x", "0deg");
    ref.current?.style.setProperty("--tilt-y", "0deg");
  };

  const page = {
    enter: (dir: number) => (flat ? { opacity: 0 } : dir > 0 ? { rotateX: 0, opacity: 1, zIndex: 1 } : { rotateX: 118, opacity: 0, zIndex: 3 }),
    center: { rotateX: 0, opacity: 1, zIndex: 2 },
    exit: (dir: number) => (flat ? { opacity: 0 } : dir > 0 ? { rotateX: 118, opacity: 0, zIndex: 3 } : { opacity: 1, zIndex: 1, transition: { duration: 0.01, delay: 0.5 } }),
  };

  return (
    <div className="agenda-desk-wrap">
      <div
        ref={ref}
        className={`agenda-desk ${flat ? "is-flat" : ""}`}
        onPointerEnter={() => {
          rect.current = ref.current?.getBoundingClientRect() ?? null;
        }}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <div className="agenda-desk-body">
          <span className="agenda-desk-back" aria-hidden />
          <span className="agenda-desk-stack" aria-hidden />
          <span className="agenda-desk-rings" aria-hidden>
            {Array.from({ length: 7 }, (_, index) => (
              <i key={index} />
            ))}
          </span>
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={day}
              custom={direction}
              variants={page}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: flat ? 0.18 : 0.62, ease: [0.3, 0.7, 0.2, 1] }}
              className="agenda-desk-page"
              aria-live="polite"
            >
              <span className="agenda-desk-month">
                {monthShort.format(date)} {date.getFullYear() !== new Date().getFullYear() ? date.getFullYear() : ""}
              </span>
              <span className={`agenda-desk-day tabular ${isToday ? "is-today" : ""}`}>{date.getDate()}</span>
              <span className="agenda-desk-weekday">{isToday ? "hoje" : offset === 1 ? "amanhã" : offset === -1 ? "ontem" : weekdayLong.format(date)}</span>
              <span className="agenda-desk-foot">
                {holiday ? (
                  <span className="inline-flex items-center gap-1">
                    <Landmark className="h-3 w-3" aria-hidden /> {holiday.localName}
                  </span>
                ) : open.length ? (
                  `${open.length} ${open.length === 1 ? "tarefa" : "tarefas"}${exams ? ` · ${exams} ${exams === 1 ? "prova" : "provas"}` : ""}`
                ) : (
                  "dia livre"
                )}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div className="agenda-desk-nav">
        <button type="button" onClick={() => setDay(shiftDays(day, -1))} aria-label="Dia anterior" className="agenda-icon-btn">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setDay(today())} disabled={isToday} className="agenda-chip">
          Hoje
        </button>
        <button type="button" onClick={() => setDay(shiftDays(day, 1))} aria-label="Próximo dia" className="agenda-icon-btn">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Um dígito que vira como placar de aeroporto quando o número muda. */
function FlipDigit({ value, flat }: { value: string; flat: boolean }) {
  return (
    <span className="agenda-flip">
      <AnimatePresence initial={false}>
        <motion.span
          key={value}
          className="agenda-flip-face"
          initial={flat ? { opacity: 0 } : { rotateX: -92, opacity: 0.4 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={flat ? { opacity: 0 } : { rotateX: 92, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
      <span className="agenda-flip-hinge" aria-hidden />
    </span>
  );
}

function FlipNumber({ value, digits = 2 }: { value: number; digits?: number }) {
  const reduced = useSoftMotion();
  const text = String(Math.max(0, value)).padStart(digits, "0");
  return (
    <span className="inline-flex gap-1" aria-hidden>
      {text.split("").map((digit, index) => (
        <FlipDigit key={`${text.length}-${index}`} value={digit} flat={reduced} />
      ))}
    </span>
  );
}

/**
 * Contagem até a próxima prova. Com hora marcada e menos de dois dias, mostra
 * horas e minutos; senão, dias. A preparação soma os passos da prova e as
 * revisões da mesma matéria antes dela.
 */
export function ExamCountdown({ tasks, subjects, openTask }: { tasks: Task[]; subjects: Subject[]; openTask: (task: Task) => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const exam = tasks
    .filter((task) => !task.done && task.kind === "prova" && task.dueAt >= today())
    .sort((a, b) => a.dueAt - b.dueAt || (a.time || "").localeCompare(b.time || ""))[0];

  if (!exam) {
    return (
      <div className="agenda-countdown is-empty">
        <GraduationCap className="h-5 w-5" aria-hidden />
        <p className="text-sm">
          Nenhuma prova marcada. Escreva <span className="caderno-hand">“prova de … sexta”</span> lá em cima e a contagem começa.
        </p>
      </div>
    );
  }

  const subject = subjects.find((item) => item.id === exam.subjectId);
  const [hours, minutes] = (exam.time || "").split(":").map(Number);
  const target = exam.time ? new Date(exam.dueAt).setHours(hours, minutes) : exam.dueAt;
  const diffMs = Math.max(0, target - now);
  const days = daysBetween(today(), exam.dueAt);
  const short = Boolean(exam.time) && diffMs < 2 * 86400000;
  const prep = [
    ...(exam.steps || []),
    ...tasks.filter((task) => task.id !== exam.id && task.subjectId === exam.subjectId && task.kind === "revisao" && task.dueAt <= exam.dueAt).map((task) => ({ done: task.done })),
  ];
  const prepDone = prep.filter((item) => item.done).length;

  return (
    <div className="agenda-countdown" style={{ "--subject": subject?.color || "rgb(var(--margin-line))" } as React.CSSProperties}>
      <span className="caderno-note block">próxima prova{subject ? ` · ${subject.name}` : ""}</span>
      <button type="button" onClick={() => openTask(exam)} className="block w-full truncate text-left font-display text-lg font-black leading-tight hover:underline">
        {exam.title}
      </button>
      <span className="mt-2 flex items-end gap-3" aria-label={short ? `Faltam ${Math.floor(diffMs / 3600000)} horas` : `Faltam ${days} dias`}>
        {short ? (
          <>
            <span className="agenda-countdown-unit">
              <FlipNumber value={Math.floor(diffMs / 3600000)} />
              <small>horas</small>
            </span>
            <span className="agenda-countdown-unit">
              <FlipNumber value={Math.floor((diffMs % 3600000) / 60000)} />
              <small>min</small>
            </span>
          </>
        ) : (
          <span className="agenda-countdown-unit">
            <FlipNumber value={days} />
            <small>{days === 0 ? "é hoje!" : days === 1 ? "dia" : "dias"}</small>
          </span>
        )}
      </span>
      {prep.length ? (
        <span className="mt-3 block">
          <span className="mb-1 flex justify-between text-[11px] font-black opacity-70">
            <span>preparação</span>
            <span className="tabular">
              {prepDone}/{prep.length}
            </span>
          </span>
          <span className="agenda-prep-bar">
            <span style={{ transform: `scaleX(${prepDone / prep.length})` }} />
          </span>
        </span>
      ) : (
        <button type="button" onClick={() => go("plan")} className="mt-3 block text-[12px] font-black underline decoration-dotted underline-offset-4 opacity-80 hover:opacity-100">
          Montar plano de revisão →
        </button>
      )}
    </div>
  );
}
