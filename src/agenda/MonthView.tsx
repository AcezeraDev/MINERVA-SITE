import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Landmark } from "lucide-react";
import { today, type PublicHoliday, type Subject, type Task } from "../main";
import { monthGrid } from "../../shared/agenda.mjs";
import { useSoftMotion } from "../motion";

const monthTitle = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const weekLetters = ["D", "S", "T", "Q", "Q", "S", "S"];

/**
 * O mês como uma folha de calendário. Cada casa mostra até três marcas na cor
 * da matéria e fica mais "grifada" quanto mais cheia; trocar de mês vira a
 * folha para o lado da navegação.
 */
export function MonthView({
  month,
  setMonth,
  tasks,
  subjects,
  holidays,
  selected,
  select,
}: {
  /** Primeiro dia do mês à mostra (meia-noite local). */
  month: number;
  setMonth: (month: number) => void;
  tasks: Task[];
  subjects: Subject[];
  holidays: Map<string, PublicHoliday>;
  selected: number | null;
  select: (day: number | null) => void;
}) {
  const reduced = useSoftMotion();
  const date = new Date(month);
  const last = useRef(month);
  const direction = month >= last.current ? 1 : -1;
  useEffect(() => {
    last.current = month;
  }, [month]);
  const grid = monthGrid(date.getFullYear(), date.getMonth());
  const colorOf = (task: Task) => subjects.find((subject) => subject.id === task.subjectId)?.color || "rgb(var(--pen))";
  const byDay = new Map<number, Task[]>();
  for (const task of tasks) {
    if (task.done) continue;
    const list = byDay.get(task.dueAt);
    if (list) list.push(task);
    else byDay.set(task.dueAt, [task]);
  }
  const busiest = Math.max(1, ...grid.map((cell) => byDay.get(cell.day)?.length || 0));
  const shift = (delta: number) => setMonth(new Date(date.getFullYear(), date.getMonth() + delta, 1).getTime());
  const key = (timestamp: number) => {
    const day = new Date(timestamp);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  };
  const thisMonth = new Date(today());
  const isCurrent = thisMonth.getFullYear() === date.getFullYear() && thisMonth.getMonth() === date.getMonth();

  return (
    <div className="agenda-month">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-xl font-black first-letter:uppercase">{monthTitle.format(date)}</h3>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => shift(-1)} aria-label="Mês anterior" className="agenda-icon-btn">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" disabled={isCurrent} onClick={() => setMonth(new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1).getTime())} className="agenda-chip">
            Este mês
          </button>
          <button type="button" onClick={() => shift(1)} aria-label="Próximo mês" className="agenda-icon-btn">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="agenda-month-head" aria-hidden>
        {weekLetters.map((letter, index) => (
          <span key={index}>{letter}</span>
        ))}
      </div>
      <div className="agenda-month-stage">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={month}
            custom={direction}
            initial={reduced ? { opacity: 0 } : { opacity: 0, rotateY: direction * -35, x: direction * 40 }}
            animate={{ opacity: 1, rotateY: 0, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, rotateY: direction * 35, x: direction * -40 }}
            transition={{ duration: reduced ? 0.15 : 0.42, ease: [0.3, 0.7, 0.2, 1] }}
            className="agenda-month-grid"
            role="grid"
            aria-label={monthTitle.format(date)}
          >
            {grid.map((cell) => {
              const list = byDay.get(cell.day) || [];
              const holiday = holidays.get(key(cell.day));
              const isToday = cell.day === today();
              const active = selected === cell.day;
              const late = cell.day < today() && list.length > 0;
              const exam = list.some((task) => task.kind === "prova");
              return (
                <button
                  key={cell.day}
                  type="button"
                  role="gridcell"
                  aria-selected={active}
                  aria-label={`${new Date(cell.day).getDate()}${holiday ? `, ${holiday.localName}` : ""}: ${list.length ? `${list.length} ${list.length === 1 ? "tarefa" : "tarefas"}` : "livre"}`}
                  onClick={() => select(active ? null : cell.day)}
                  className={`agenda-month-cell ${cell.inMonth ? "" : "is-out"} ${isToday ? "is-today" : ""} ${active ? "is-active" : ""} ${late ? "is-late" : ""}`}
                  style={{ "--load": list.length / busiest } as React.CSSProperties}
                >
                  <span className="agenda-month-num tabular">{new Date(cell.day).getDate()}</span>
                  {exam ? <span className="agenda-month-exam" aria-hidden /> : null}
                  {holiday ? <Landmark aria-hidden className="absolute right-1.5 top-1.5 h-3 w-3 text-pen" /> : null}
                  <span className="agenda-month-marks" aria-hidden>
                    {list.slice(0, 3).map((task) => (
                      <i key={task.id} style={{ background: colorOf(task) }} />
                    ))}
                    {list.length > 3 ? <b>+{list.length - 3}</b> : null}
                  </span>
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
