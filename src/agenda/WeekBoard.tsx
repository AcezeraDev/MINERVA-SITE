import React, { useState } from "react";
import { LayoutGroup, motion } from "framer-motion";
import { Landmark } from "lucide-react";
import { today, type AppData, type PublicHoliday, type Subject, type Task } from "../main";
import { setTaskDone, shiftDays } from "../../shared/agenda.mjs";
import { xpPerAction } from "../../shared/xp.mjs";
import { useSoftMotion } from "../motion";
import { cheer, InkCheck, mineSays } from "../caderno";

/**
 * A semana como um quadro de bilhetes. Cada tarefa aberta é um post-it na cor
 * da matéria; arrastar para outra coluna reagenda de verdade (muda o dueAt).
 * O mesmo gesto existe no teclado: Enter pega o bilhete, ← → trocam o dia,
 * Enter ou Esc soltam. `layoutId` faz o bilhete viajar até a coluna nova.
 * Duplo clique (ou E com o bilhete em foco) abre o editor.
 */
export function WeekBoard({
  days,
  overdue,
  open,
  subjects,
  dayFilter,
  setDayFilter,
  update,
  openTask,
}: {
  days: Array<{ day: number; holiday?: PublicHoliday }>;
  overdue: Task[];
  open: Task[];
  subjects: Subject[];
  dayFilter: number | null;
  setDayFilter: (day: number | null) => void;
  update: (next: (draft: AppData) => AppData) => void;
  openTask: (task: Task) => void;
}) {
  const reduced = useSoftMotion();
  const [picked, setPicked] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [crumpling, setCrumpling] = useState<string[]>([]);
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
  const weekdayLong = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });
  const colorOf = (task: Task) => subjects.find((subject) => subject.id === task.subjectId)?.color || "#F4F05A";
  const nameOf = (task: Task) => subjects.find((subject) => subject.id === task.subjectId)?.name || "Matéria";
  const first = days[0]?.day ?? today();
  const lastDay = days[days.length - 1]?.day ?? today();

  const moveTo = (task: Task, day: number) => {
    if (task.dueAt === day) return;
    update((draft) => ({ ...draft, tasks: draft.tasks.map((item) => (item.id === task.id ? { ...item, dueAt: day } : item)) }));
    const label = weekdayLong.format(new Date(day));
    setStatus(`${task.title} foi para ${label}.`);
    mineSays(`Anotado pra ${label}!`, "happy");
  };
  const complete = (task: Task, target: HTMLElement) => {
    cheer(target, xpPerAction.taskDone);
    setCrumpling((list) => [...list, task.id]);
    window.setTimeout(() => {
      update((draft) => ({ ...draft, tasks: setTaskDone(draft.tasks, task.id, true) }));
      setCrumpling((list) => list.filter((id) => id !== task.id));
    }, reduced ? 0 : 420);
  };
  const dayUnder = (x: number, y: number) => {
    const column = document.elementsFromPoint(x, y).find((node) => (node as HTMLElement).dataset?.boardDay) as HTMLElement | undefined;
    return column ? Number(column.dataset.boardDay) : null;
  };

  const columns: Array<{ key: string; day: number | null; title: string; sub: string; tasks: Task[]; holiday?: PublicHoliday; late?: boolean }> = [
    ...(overdue.length ? [{ key: "late", day: null, title: "!", sub: "atrasadas", tasks: overdue, late: true }] : []),
    ...days.map(({ day, holiday }) => ({
      key: String(day),
      day,
      title: String(new Date(day).getDate()),
      sub: day === today() ? "hoje" : weekday.format(new Date(day)).replace(".", ""),
      tasks: open.filter((task) => task.dueAt === day),
      holiday,
    })),
  ];

  const note = (task: Task, index: number) => {
    const isPicked = picked === task.id;
    const tilt = ((task.id.charCodeAt(task.id.length - 1) % 5) - 2) * 1.1;
    const gone = crumpling.includes(task.id);
    return (
      <motion.div
        key={task.id}
        layoutId={reduced ? undefined : `sticky-${task.id}`}
        layout={!reduced}
        drag={!reduced && !gone}
        dragSnapToOrigin
        dragElastic={0.6}
        dragMomentum={false}
        whileDrag={{ scale: 1.07, rotate: -4, zIndex: 60, boxShadow: "0 24px 30px -14px rgba(0,0,0,.45)" }}
        onDrag={(event) => {
          const point = event as PointerEvent;
          if ("clientX" in point) setOverDay(dayUnder(point.clientX, point.clientY));
        }}
        onDragEnd={(event) => {
          const point = event as PointerEvent;
          setOverDay(null);
          if (!("clientX" in point)) return;
          const day = dayUnder(point.clientX, point.clientY);
          if (day !== null) moveTo(task, day);
        }}
        onDoubleClick={() => openTask(task)}
        initial={reduced ? false : { opacity: 0, y: -14, rotate: tilt - 6 }}
        animate={gone ? { opacity: 0, scale: 0.3, rotate: 40 } : { opacity: 1, y: 0, scale: 1, rotate: tilt }}
        transition={{ type: "spring", stiffness: 420, damping: 28, delay: reduced || gone ? 0 : index * 0.04 }}
        tabIndex={0}
        role="button"
        aria-roledescription="bilhete arrastável"
        aria-label={`${task.title}, ${nameOf(task)}${task.time ? `, às ${task.time}` : ""}. Enter para pegar e setas para mudar o dia; E para editar.`}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setPicked(isPicked ? null : task.id);
            setStatus(isPicked ? "Bilhete solto." : "Bilhete pego: use as setas para trocar o dia.");
          } else if (isPicked && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
            event.preventDefault();
            const base = task.dueAt < first ? shiftDays(first, -1) : task.dueAt;
            const next = shiftDays(base, event.key === "ArrowRight" ? 1 : -1);
            if (next >= first && next <= lastDay) moveTo(task, next);
          } else if (event.key === "Escape") {
            setPicked(null);
          } else if (event.key === "e" || event.key === "E") {
            event.preventDefault();
            openTask(task);
          }
        }}
        className={`caderno-sticky ${isPicked ? "is-picked" : ""} ${task.priority === "alta" ? "is-urgent" : ""}`}
        style={{ "--sticky": colorOf(task) } as React.CSSProperties}
      >
        {task.kind === "prova" ? <span className="agenda-sticky-stamp" aria-hidden>prova</span> : null}
        <p className="line-clamp-3 text-[13px] font-bold leading-snug">
          {task.priority === "alta" ? <b className="mr-1 text-[#c8102e]">!</b> : null}
          {task.title}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-1">
          <span className="truncate font-mono text-[10px] opacity-70">{task.time ? `${task.time} · ` : ""}{nameOf(task)}</span>
          <button
            type="button"
            onPointerDownCapture={(event) => event.stopPropagation()}
            onClick={(event) => complete(task, event.currentTarget)}
            aria-label={`Concluir ${task.title}`}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md hover:bg-black/10"
          >
            <InkCheck checked={gone} className="caderno-inkcheck-sm" />
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="mt-5">
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
      <LayoutGroup>
        <div className="caderno-board minerva-scroll">
          {columns.map((column) => {
            const active = column.day !== null && dayFilter === column.day;
            const isToday = column.day === today();
            return (
              <div
                key={column.key}
                data-board-day={column.day ?? undefined}
                className={`caderno-board-col ${column.late ? "is-late" : ""} ${overDay !== null && overDay === column.day ? "is-over" : ""} ${active ? "is-active" : ""}`}
              >
                <button
                  type="button"
                  disabled={column.day === null}
                  onClick={() => column.day !== null && setDayFilter(active ? null : column.day)}
                  aria-pressed={column.day === null ? undefined : active}
                  className="caderno-board-head"
                  title={column.holiday ? `Feriado: ${column.holiday.localName}` : column.day !== null ? "Ver as tarefas deste dia" : undefined}
                >
                  <span className="font-mono text-[10px] uppercase tracking-[.1em]">{column.sub}</span>
                  <span className={`font-display text-xl font-black ${isToday ? "caderno-hl" : ""}`}>{column.title}</span>
                  {column.holiday ? <Landmark aria-hidden className="absolute right-2 top-2 h-3 w-3 text-pen" /> : null}
                </button>
                <div className="grid gap-2">
                  {column.tasks.slice(0, 5).map((task, index) => note(task, index))}
                  {column.tasks.length > 5 ? <p className="caderno-hand text-center text-base">+{column.tasks.length - 5} bilhetes</p> : null}
                  {!column.tasks.length ? (
                    <span className="caderno-board-empty" aria-hidden>
                      {column.holiday ? "feriado" : "livre"}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </LayoutGroup>
    </div>
  );
}
