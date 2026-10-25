import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CornerDownLeft,
  Download,
  Flame,
  LayoutGrid,
  List,
  Plus,
  Repeat,
  Search,
  SlidersHorizontal,
  Sparkles,
  StickyNote,
  Tag,
  X,
} from "lucide-react";
import {
  apiJson,
  EmptyState,
  GlassCard,
  go,
  PageHeader,
  PrimaryButton,
  SectionTitle,
  shortDate,
  TaskRow,
  today,
  uid,
  type AppData,
  type Modal,
  type PublicHoliday,
  type Subject,
  type Task,
  type User,
  type useMemoUserData,
} from "../main";
import { buildIcs, parseQuickTask, setTaskDone, shiftDays, startOfDay, taskKinds, type QuickTask } from "../../shared/agenda.mjs";
import { AnimatedBar, CountUp, Reveal, spring, Stagger, StaggerItem, useSoftMotion } from "../motion";
import { celebrateFrom, Doodle, mineSays } from "../caderno";
import { DeskCalendar, ExamCountdown } from "./DeskCalendar";
import { WeekBoard } from "./WeekBoard";
import { MonthView } from "./MonthView";
import "./agenda.css";

type AgendaMode = "semana" | "mes" | "lista";
const modeKey = "minerva-agenda-vista-v1";
const modes: Array<{ id: AgendaMode; label: string; icon: typeof List }> = [
  { id: "semana", label: "Semana", icon: StickyNote },
  { id: "mes", label: "Mês", icon: LayoutGrid },
  { id: "lista", label: "Lista", icon: List },
];
const priorityRank = { alta: 0, media: 1, baixa: 2 } as const;
const weekdayLong = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });
const examples = ["prova de química sexta 14h !", "ler capítulo 4 de história amanhã", "lista de matemática toda quarta", "seminário em 10 dias #port", "revisar biologia dia 12"];

function fold(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function dateKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function readMode(): AgendaMode {
  try {
    const value = localStorage.getItem(modeKey);
    if (value === "semana" || value === "mes" || value === "lista") return value;
  } catch {
    // armazenamento bloqueado: fica o padrão
  }
  return "semana";
}

function byDue(a: Task, b: Task) {
  return (
    a.dueAt - b.dueAt ||
    priorityRank[a.priority || "media"] - priorityRank[b.priority || "media"] ||
    (a.time || "99").localeCompare(b.time || "99") ||
    a.createdAt - b.createdAt
  );
}

export function AgendaView({
  data,
  user,
  setModal,
  update,
  notify,
}: {
  data: ReturnType<typeof useMemoUserData>;
  user: User;
  setModal: (modal: Modal) => void;
  update: (next: (draft: AppData) => AppData) => void;
  notify: (message: string) => void;
}) {
  const [mode, setModeState] = useState<AgendaMode>(readMode);
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [month, setMonth] = useState(() => {
    const now = new Date(today());
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  });
  const [showDone, setShowDone] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [holidays, setHolidays] = useState<Map<string, PublicHoliday>>(new Map());
  const [holidaysUnavailable, setHolidaysUnavailable] = useState(false);
  const fetchedYears = useRef(new Set<number>());
  const reduced = useSoftMotion();

  const setMode = (next: AgendaMode) => {
    setModeState(next);
    try {
      localStorage.setItem(modeKey, next);
    } catch {
      // sem armazenamento, a escolha vale só nesta visita
    }
  };

  const weekStart = shiftDays(today(), weekOffset * 7);
  const focusDay = dayFilter ?? today();

  // Feriados por ano, buscados só quando a vista precisa daquele ano.
  const neededYears = useMemo(
    () => Array.from(new Set([new Date(weekStart).getFullYear(), new Date(shiftDays(weekStart, 6)).getFullYear(), new Date(month).getFullYear(), new Date(focusDay).getFullYear()])),
    [weekStart, month, focusDay],
  );
  useEffect(() => {
    const missing = neededYears.filter((year) => !fetchedYears.current.has(year));
    if (!missing.length) return;
    missing.forEach((year) => fetchedYears.current.add(year));
    Promise.allSettled(missing.map((year) => apiJson<{ results: PublicHoliday[] }>(`/api/holidays?year=${year}`))).then((responses) => {
      const found = responses.flatMap((response) => (response.status === "fulfilled" ? response.value.results : []));
      if (found.length) setHolidays((current) => new Map([...current, ...found.map((holiday) => [holiday.date, holiday] as const)]));
      if (responses.every((response) => response.status === "rejected")) setHolidaysUnavailable(true);
    });
  }, [neededYears]);

  const subjectName = (task: Task) => data.subjects.find((subject) => subject.id === task.subjectId)?.name || "";
  const needle = fold(query.trim());
  const tasks = data.tasks.filter((task) => {
    if (subjectFilter && task.subjectId !== subjectFilter) return false;
    if (kindFilter && task.kind !== kindFilter) return false;
    if (urgentOnly && task.priority !== "alta") return false;
    if (needle) {
      const haystack = fold([task.title, task.note, subjectName(task), ...(task.steps || []).map((step) => step.text)].join(" "));
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
  const filtering = Boolean(subjectFilter || kindFilter || urgentOnly || needle);
  const open = tasks.filter((task) => !task.done);
  const overdue = open.filter((task) => task.dueAt < today()).sort(byDue);
  const todayOpen = open.filter((task) => task.dueAt === today()).sort(byDue);
  const weekOpen = open.filter((task) => task.dueAt > today() && task.dueAt <= shiftDays(today(), 7)).sort(byDue);
  const laterOpen = open.filter((task) => task.dueAt > shiftDays(today(), 7)).sort(byDue);
  const doneTasks = tasks.filter((task) => task.done).sort((a, b) => (b.doneAt || b.dueAt) - (a.doneAt || a.dueAt));
  const doneTodayCount = data.tasks.filter((task) => task.done && task.dueAt === today()).length;
  const todayTotal = data.tasks.filter((task) => !task.done && task.dueAt === today()).length + doneTodayCount;

  const week = Array.from({ length: 7 }, (_, index) => {
    const day = shiftDays(weekStart, index);
    return { day, holiday: holidays.get(dateKey(day)) };
  });
  const dayTasks = dayFilter !== null ? tasks.filter((task) => task.dueAt === dayFilter).sort((a, b) => Number(a.done) - Number(b.done) || byDue(a, b)) : [];

  const openTask = (task: Task) => setModal({ type: "task", taskId: task.id });
  const newTask = (dueAt?: number) => setModal({ type: "task", subjectId: subjectFilter || undefined, dueAt });
  const toggleTask = (task: Task) => update((draft) => ({ ...draft, tasks: setTaskDone(draft.tasks, task.id, undefined) }));
  const removeTask = (task: Task) => {
    update((draft) => ({ ...draft, tasks: draft.tasks.filter((item) => item.id !== task.id) }));
    notify("Tarefa excluída.");
  };
  const postponeTask = (task: Task) => {
    update((draft) => ({ ...draft, tasks: draft.tasks.map((item) => (item.id === task.id ? { ...item, dueAt: today() } : item)) }));
    notify("Tarefa reagendada para hoje.");
  };
  const bringAllToToday = () => {
    const ids = new Set(overdue.map((task) => task.id));
    update((draft) => ({ ...draft, tasks: draft.tasks.map((item) => (ids.has(item.id) ? { ...item, dueAt: today() } : item)) }));
    notify(`${ids.size} ${ids.size === 1 ? "tarefa veio" : "tarefas vieram"} para hoje.`);
    mineSays("Bora zerar isso hoje!", "happy");
  };
  const exportIcs = () => {
    const file = new Blob([buildIcs(data.tasks, data.subjects)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "agenda-minerva.ics";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Agenda exportada. Abra o arquivo no Google Agenda ou no calendário do celular.");
  };
  const renderTask = (task: Task, options?: { postpone?: boolean }) => (
    <TaskRow
      key={task.id}
      task={task}
      subject={data.subjects.find((subject) => subject.id === task.subjectId)}
      toggle={() => toggleTask(task)}
      remove={() => removeTask(task)}
      postpone={options?.postpone ? () => postponeTask(task) : undefined}
      open={() => openTask(task)}
    />
  );
  const selectDay = (day: number | null) => {
    setDayFilter(day);
    if (day !== null) {
      const date = new Date(day);
      setMonth(new Date(date.getFullYear(), date.getMonth(), 1).getTime());
      const offset = Math.floor((startOfDay(day) - today()) / (7 * 86400000));
      if (day < weekStart || day > shiftDays(weekStart, 6)) setWeekOffset(offset);
    }
  };

  const groups: Array<{ title: string; tasks: Task[]; empty?: string }> = [
    { title: `Hoje (${todayOpen.length})`, tasks: todayOpen, empty: filtering ? "Nada com esse filtro hoje." : "Nada para hoje. Aproveite para adiantar a semana ou revisar flashcards." },
    { title: `Próximos 7 dias (${weekOpen.length})`, tasks: weekOpen },
    { title: `Depois (${laterOpen.length})`, tasks: laterOpen },
  ];

  const dayPanel =
    dayFilter !== null ? (
      <GlassCard>
        <SectionTitle
          icon={CalendarDays}
          title={`${weekdayLong.format(new Date(dayFilter))} · ${shortDate(dayFilter)}`}
          hint={holidays.get(dateKey(dayFilter))?.localName}
          action={
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => newTask(dayFilter)} className="agenda-chip">
                <Plus className="h-4 w-4" /> Neste dia
              </button>
              <button type="button" onClick={() => setDayFilter(null)} className="text-sm font-black text-mint transition hover:text-white">
                Fechar
              </button>
            </div>
          }
        />
        <Stagger className="mt-4 space-y-2.5" gap={0.045}>
          {dayTasks.map((task) => (
            <StaggerItem key={task.id}>{renderTask(task)}</StaggerItem>
          ))}
        </Stagger>
        {!dayTasks.length ? <p className="mt-4 text-sm text-white/45">Nenhuma tarefa para este dia.</p> : null}
      </GlassCard>
    ) : null;

  return (
    <>
      <PageHeader
        eyebrow="Agenda"
        title="Sua rotina"
        subtitle={overdue.length ? `${overdue.length} ${overdue.length === 1 ? "tarefa atrasada" : "tarefas atrasadas"} esperando por você.` : "Semana organizada. Escolha um dia para focar."}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={exportIcs} disabled={!data.tasks.some((task) => !task.done)} className="agenda-chip h-11 px-4" title="Baixar .ics para o Google Agenda ou o calendário do celular">
              <Download className="h-4 w-4" /> Exportar
            </button>
            <PrimaryButton icon={Plus} onClick={() => newTask()}>
              Nova tarefa
            </PrimaryButton>
          </div>
        }
      />
      <div className="grid gap-5">
        <Reveal>
          <QuickAdd subjects={data.subjects} defaultSubject={subjectFilter} user={user} update={update} notify={notify} openDetails={(parsed) => setModal({ type: "task", title: parsed.title, dueAt: parsed.dueAt ?? undefined, subjectId: parsed.subjectId ?? subjectFilter ?? undefined })} />
        </Reveal>

        <Reveal delay={0.04}>
          <div className="agenda-hero">
            <GlassCard className="agenda-hero-desk">
              <DeskCalendar day={focusDay} setDay={selectDay} tasks={data.tasks} holiday={holidays.get(dateKey(focusDay))} />
            </GlassCard>
            <GlassCard>
              <WeekStats tasks={data.tasks} />
              {todayTotal ? (
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-[13px] font-bold text-white/52">
                    <span>Progresso de hoje</span>
                    <span className="tabular text-mint">
                      {doneTodayCount} de {todayTotal}
                    </span>
                  </div>
                  <AnimatedBar value={todayTotal ? Math.round((doneTodayCount / todayTotal) * 100) : 0} height={9} />
                </div>
              ) : null}
              <div className="mt-5">
                <ExamCountdown tasks={data.tasks} subjects={data.subjects} openTask={openTask} />
              </div>
            </GlassCard>
          </div>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="agenda-toolbar">
            <div className="agenda-segment" role="tablist" aria-label="Vista da agenda">
              {modes.map((item) => {
                const Icon = item.icon;
                const active = mode === item.id;
                return (
                  <button key={item.id} type="button" role="tab" aria-selected={active} onClick={() => setMode(item.id)} className={`agenda-segment-btn ${active ? "is-on" : ""}`}>
                    {active ? <motion.span layoutId={reduced ? undefined : "agenda-mode-pill"} transition={spring.snappy} className="agenda-segment-pill" /> : null}
                    <Icon className="relative h-4 w-4" />
                    <span className="relative">{item.label}</span>
                  </button>
                );
              })}
            </div>
            <label className="agenda-search">
              <Search className="h-4 w-4 shrink-0" aria-hidden />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tarefa, matéria, passo..." aria-label="Buscar tarefas" />
              {query ? (
                <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca" className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/10">
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </label>
            <button type="button" onClick={() => setFiltersOpen((value) => !value)} aria-expanded={filtersOpen} className={`agenda-chip h-11 px-4 ${filtering && !needle ? "is-on" : ""}`}>
              <SlidersHorizontal className="h-4 w-4" /> Filtros
              <motion.span animate={{ rotate: filtersOpen ? 180 : 0 }} transition={spring.snappy} className="grid place-items-center">
                <ChevronDown className="h-4 w-4" />
              </motion.span>
            </button>
          </div>
          <AnimatePresence initial={false}>
            {filtersOpen ? (
              <motion.div
                key="filters"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.24 }}
                className="overflow-hidden"
              >
                <div className="agenda-filters">
                  {data.subjects.length > 1 ? (
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Matéria">
                      <button type="button" aria-pressed={!subjectFilter} onClick={() => setSubjectFilter(null)} className={`agenda-chip ${!subjectFilter ? "is-on" : ""}`}>
                        Todas
                      </button>
                      {data.subjects.map((subject: Subject) => {
                        const active = subjectFilter === subject.id;
                        return (
                          <button key={subject.id} type="button" aria-pressed={active} onClick={() => setSubjectFilter(active ? null : subject.id)} className={`agenda-chip ${active ? "is-on" : ""}`}>
                            <span className="h-2 w-2 rounded-full" style={{ background: subject.color }} />
                            {subject.name}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo">
                    <Tag className="mt-2 h-4 w-4 text-white/40" aria-hidden />
                    {taskKinds.map((kind) => (
                      <button key={kind.id} type="button" aria-pressed={kindFilter === kind.id} onClick={() => setKindFilter(kindFilter === kind.id ? null : kind.id)} className={`agenda-chip agenda-kind-chip is-${kind.id} ${kindFilter === kind.id ? "is-on" : ""}`}>
                        {kind.label}
                      </button>
                    ))}
                    <button type="button" aria-pressed={urgentOnly} onClick={() => setUrgentOnly((value) => !value)} className={`agenda-chip ${urgentOnly ? "is-on" : ""}`}>
                      <Flame className="h-4 w-4" /> Só urgentes
                    </button>
                    {filtering ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSubjectFilter(null);
                          setKindFilter(null);
                          setUrgentOnly(false);
                          setQuery("");
                        }}
                        className="agenda-chip is-danger"
                      >
                        Limpar filtros
                      </button>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </Reveal>

        {!data.tasks.length ? (
          <EmptyState
            icon={CalendarDays}
            title="Agenda vazia"
            text="Escreva uma tarefa na linha de cima, do jeito que você falaria, ou gere um plano de estudos."
            action={
              <PrimaryButton icon={Plus} onClick={() => newTask()}>
                Criar primeira tarefa
              </PrimaryButton>
            }
          />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="grid gap-5"
            >
              {mode === "semana" ? (
                <>
                  <GlassCard>
                    <SectionTitle
                      icon={StickyNote}
                      title={weekOffset === 0 ? "Próximos 7 dias" : `Semana de ${shortDate(weekStart)}`}
                      hint="arraste um bilhete para mudar o dia · duplo clique edita"
                      action={
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => setWeekOffset((value) => value - 1)} aria-label="Semana anterior" className="agenda-icon-btn">
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button type="button" disabled={weekOffset === 0} onClick={() => setWeekOffset(0)} className="agenda-chip">
                            Agora
                          </button>
                          <button type="button" onClick={() => setWeekOffset((value) => value + 1)} aria-label="Próxima semana" className="agenda-icon-btn">
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      }
                    />
                    <WeekBoard
                      days={week}
                      overdue={weekOffset === 0 ? overdue : []}
                      open={open}
                      subjects={data.subjects}
                      dayFilter={dayFilter}
                      setDayFilter={setDayFilter}
                      update={update}
                      openTask={openTask}
                    />
                    {holidaysUnavailable ? <p className="mt-3 text-xs text-white/35">Os feriados não puderam ser atualizados agora; suas tarefas continuam disponíveis normalmente.</p> : null}
                  </GlassCard>
                  {dayPanel}
                </>
              ) : null}

              {mode === "mes" ? (
                <>
                  <GlassCard>
                    <MonthView month={month} setMonth={setMonth} tasks={tasks} subjects={data.subjects} holidays={holidays} selected={dayFilter} select={selectDay} />
                  </GlassCard>
                  {dayPanel}
                </>
              ) : null}

              {mode === "lista" ? (
                <>
                  {dayPanel}
                  {overdue.length ? (
                    <section className="agenda-late-card">
                      <div className="relative flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amberGlow/15 text-amberGlow">
                            <Flame className="h-5 w-5" />
                          </span>
                          <h2 className="font-display text-[1.35rem] font-black md:text-2xl">Atrasadas ({overdue.length})</h2>
                        </div>
                        <button type="button" onClick={bringAllToToday} className="agenda-chip is-warn">
                          <CalendarPlus className="h-4 w-4" /> Trazer todas para hoje
                        </button>
                      </div>
                      <Stagger className="relative mt-4 space-y-2.5" gap={0.045}>
                        {overdue.map((task) => (
                          <StaggerItem key={task.id}>{renderTask(task, { postpone: true })}</StaggerItem>
                        ))}
                      </Stagger>
                    </section>
                  ) : null}
                  {groups.map(({ title, tasks: groupTasks, empty }) =>
                    groupTasks.length || empty ? (
                      <GlassCard key={title}>
                        <SectionTitle icon={CalendarRange} title={title} />
                        <Stagger className="mt-4 space-y-2.5" gap={0.04}>
                          {groupTasks.map((task) => (
                            <StaggerItem key={task.id}>{renderTask(task)}</StaggerItem>
                          ))}
                        </Stagger>
                        {!groupTasks.length && empty ? <p className="mt-4 text-sm text-white/45">{empty}</p> : null}
                      </GlassCard>
                    ) : null,
                  )}
                  {doneTasks.length ? (
                    <GlassCard>
                      <SectionTitle
                        icon={CheckCircle2}
                        title={`Concluídas (${doneTasks.length})`}
                        action={
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() =>
                                setModal({
                                  type: "confirm",
                                  title: "Excluir tarefas concluídas?",
                                  body: `${doneTasks.length} ${doneTasks.length === 1 ? "tarefa concluída será removida" : "tarefas concluídas serão removidas"} da agenda. Essa ação não tem volta.`,
                                  onConfirm: () => {
                                    const ids = new Set(doneTasks.map((task) => task.id));
                                    update((draft) => ({ ...draft, tasks: draft.tasks.filter((item) => !ids.has(item.id)) }));
                                    notify("Tarefas concluídas removidas.");
                                  },
                                })
                              }
                              className="text-[13px] font-black text-white/45 transition hover:text-roseGlow"
                            >
                              Limpar
                            </button>
                            <button type="button" onClick={() => setShowDone((value) => !value)} aria-expanded={showDone} className="inline-flex items-center gap-1 text-[13px] font-black text-mint transition hover:text-white">
                              {showDone ? "Ocultar" : "Mostrar"}
                              <motion.span animate={{ rotate: showDone ? 180 : 0 }} transition={spring.snappy} className="grid place-items-center">
                                <ChevronDown className="h-4 w-4" />
                              </motion.span>
                            </button>
                          </div>
                        }
                      />
                      <AnimatePresence initial={false}>
                        {showDone ? (
                          <motion.div key="done-list" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35 }} className="overflow-hidden">
                            <div className="mt-4 space-y-2.5">{doneTasks.map((task) => renderTask(task))}</div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </GlassCard>
                  ) : null}
                </>
              ) : null}
            </motion.div>
          </AnimatePresence>
        )}

        <Reveal delay={0.08}>
          {/* Ficha presa com fita: um mini calendário com o dia da prova
              circulado à caneta e uma seta rabiscada puxando para o plano. */}
          <motion.button onClick={() => go("plan")} whileHover={{ y: -4, rotate: -0.4 }} whileTap={{ scale: 0.98 }} transition={spring.soft} className="caderno-plan-cta group">
            <span className="caderno-plan-tape" aria-hidden />
            <span className="caderno-plan-cal" aria-hidden>
              <span className="caderno-plan-cal-top">prova</span>
              <span className="caderno-plan-cal-day">{new Date(shiftDays(today(), 14)).getDate()}</span>
              <Doodle kind="circle" className="caderno-plan-cal-ring" duration={900} delay={250} strokeWidth={2.6} stretch />
            </span>
            <span className="min-w-0 flex-1">
              <span className="caderno-note block">plano de estudos</span>
              <span className="caderno-plan-title">Cronograma até a prova</span>
              <span className="caderno-plan-sub">Monte um plano de revisão e mande tudo pra agenda.</span>
            </span>
            <Doodle kind="arrow" className="caderno-plan-arrow hidden sm:block" duration={800} delay={500} strokeWidth={2.6} redraw />
          </motion.button>
        </Reveal>
      </div>
    </>
  );
}

/**
 * Linha de "escreve do jeito que fala": a frase vira tarefa ao apertar Enter,
 * e as fichinhas embaixo mostram, enquanto digita, o que a agenda entendeu.
 */
function QuickAdd({
  subjects,
  defaultSubject,
  user,
  update,
  notify,
  openDetails,
}: {
  subjects: Subject[];
  defaultSubject: string | null;
  user: User;
  update: (next: (draft: AppData) => AppData) => void;
  notify: (message: string) => void;
  openDetails: (parsed: QuickTask) => void;
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [example, setExample] = useState(0);
  const reduced = useSoftMotion();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const parsed = useMemo(() => parseQuickTask(text, { subjects }), [text, subjects]);
  const subjectId = parsed.subjectId || defaultSubject || subjects[0]?.id || "";
  const subject = subjects.find((item) => item.id === subjectId);
  const dueAt = parsed.dueAt ?? today();
  const ready = Boolean(parsed.title && subjectId);

  useEffect(() => {
    if (text || focused || reduced) return;
    const timer = window.setInterval(() => setExample((value) => (value + 1) % examples.length), 3800);
    return () => window.clearInterval(timer);
  }, [text, focused, reduced]);

  const create = () => {
    if (!ready) return;
    update((draft) => ({
      ...draft,
      tasks: [
        ...draft.tasks,
        {
          id: uid("task"),
          userId: user.id,
          subjectId,
          title: parsed.title,
          note: "",
          dueAt,
          done: false,
          createdAt: Date.now(),
          time: parsed.time || undefined,
          kind: parsed.kind || undefined,
          priority: parsed.priority || undefined,
          repeat: parsed.repeat || undefined,
        },
      ],
    }));
    if (buttonRef.current) celebrateFrom(buttonRef.current, { count: 14, spread: 0.6 });
    const offset = Math.round((dueAt - today()) / 86400000);
    notify(`Anotado para ${offset === 0 ? "hoje" : offset === 1 ? "amanhã" : `${weekdayLong.format(new Date(dueAt))}, ${shortDate(dueAt)}`}.`);
    setText("");
  };

  const chips: Array<{ key: string; icon: typeof Clock; label: string; tone?: string }> = [];
  if (text.trim()) {
    const offset = Math.round((dueAt - today()) / 86400000);
    chips.push({ key: "date", icon: CalendarDays, label: parsed.dueAt === null ? "hoje (padrão)" : offset === 0 ? "hoje" : offset === 1 ? "amanhã" : `${weekdayLong.format(new Date(dueAt)).replace("-feira", "")} ${shortDate(dueAt)}` });
    if (parsed.time) chips.push({ key: "time", icon: Clock, label: parsed.time });
    if (subject) chips.push({ key: "subject", icon: Tag, label: subject.name, tone: subject.color });
    if (parsed.kind) chips.push({ key: "kind", icon: Sparkles, label: taskKinds.find((kind) => kind.id === parsed.kind)?.label || "" });
    if (parsed.priority === "alta") chips.push({ key: "prio", icon: Flame, label: "urgente" });
    if (parsed.priority === "baixa") chips.push({ key: "prio", icon: Flame, label: "sem pressa" });
    if (parsed.repeat) chips.push({ key: "repeat", icon: Repeat, label: parsed.repeat === "daily" ? "todo dia" : "toda semana" });
  }

  return (
    <div className={`agenda-quick ${focused ? "is-focused" : ""}`}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          create();
        }}
        className="flex items-center gap-2"
      >
        <span className="agenda-quick-pen" aria-hidden>
          <Sparkles className="h-5 w-5" />
        </span>
        <span className="relative min-w-0 flex-1">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label="Escreva uma tarefa do jeito que você falaria"
            aria-describedby="agenda-quick-help"
            className="agenda-quick-input"
            maxLength={160}
          />
          {!text ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={example}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="agenda-quick-placeholder"
                aria-hidden
              >
                {examples[example]}
              </motion.span>
            </AnimatePresence>
          ) : null}
        </span>
        {text.trim() ? (
          <button type="button" onClick={() => openDetails(parsed)} className="agenda-chip hidden sm:inline-flex">
            Detalhes
          </button>
        ) : null}
        <button ref={buttonRef} type="submit" disabled={!ready} className="agenda-quick-go" aria-label="Anotar tarefa">
          <CornerDownLeft className="h-5 w-5" />
        </button>
      </form>
      <div id="agenda-quick-help" className="agenda-quick-chips" aria-live="polite">
        {chips.length ? (
          <AnimatePresence initial={false} mode="popLayout">
            {chips.map((chip) => {
              const Icon = chip.icon;
              return (
                <motion.span
                  key={`${chip.key}-${chip.label}`}
                  layout={!reduced}
                  initial={reduced ? false : { opacity: 0, scale: 0.6, rotate: -6 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={spring.snappy}
                  className="agenda-quick-chip"
                  style={chip.tone ? ({ "--chip": chip.tone } as React.CSSProperties) : undefined}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {chip.label}
                </motion.span>
              );
            })}
          </AnimatePresence>
        ) : (
          <span className="text-[12px] text-white/40">
            {subjects.length ? (
              <>
                Escreva do jeito que você falaria: dia (<i>sexta</i>, <i>amanhã</i>, <i>12/11</i>), hora (<i>14h</i>), <i>!</i> para urgente, <i>toda semana</i>, <i>#matéria</i>.
              </>
            ) : (
              "Crie uma matéria primeiro para anotar tarefas nela."
            )}
          </span>
        )}
      </div>
    </div>
  );
}

/** Números da semana: concluídas nos últimos 7 dias, sequência e um gráfico de tinta. */
function WeekStats({ tasks }: { tasks: Task[] }) {
  const reduced = useSoftMotion();
  const base = today();
  const days = Array.from({ length: 7 }, (_, index) => shiftDays(base, index - 6));
  const doneOn = (day: number) => tasks.filter((task) => task.done && task.doneAt && startOfDay(task.doneAt) === day).length;
  const counts = days.map(doneOn);
  const peak = Math.max(1, ...counts);
  const total = counts.reduce((sum, value) => sum + value, 0);
  let streak = 0;
  for (let day = counts[6] ? base : shiftDays(base, -1); doneOn(day) > 0 && streak < 365; day = shiftDays(day, -1)) streak += 1;
  const openCount = tasks.filter((task) => !task.done).length;
  const exams = tasks.filter((task) => !task.done && task.kind === "prova" && task.dueAt >= base && task.dueAt <= shiftDays(base, 14)).length;
  const letters = ["D", "S", "T", "Q", "Q", "S", "S"];

  return (
    <div>
      <p className="caderno-note">semana em números</p>
      <div className="agenda-stats">
        <div>
          <span className="agenda-stat-value tabular">
            <CountUp value={total} />
          </span>
          <span className="agenda-stat-label">feitas em 7 dias</span>
        </div>
        <div>
          <span className="agenda-stat-value tabular">
            <CountUp value={streak} />
          </span>
          <span className="agenda-stat-label">{streak === 1 ? "dia seguido" : "dias seguidos"}</span>
        </div>
        <div>
          <span className="agenda-stat-value tabular">
            <CountUp value={openCount} />
          </span>
          <span className="agenda-stat-label">abertas</span>
        </div>
        <div>
          <span className="agenda-stat-value tabular">
            <CountUp value={exams} />
          </span>
          <span className="agenda-stat-label">provas em 14 dias</span>
        </div>
      </div>
      <svg viewBox="0 0 280 74" className="agenda-ink-chart" role="img" aria-label={`Tarefas feitas por dia: ${counts.join(", ")}`}>
        <line x1="0" x2="280" y1="58" y2="58" className="agenda-ink-base" />
        {counts.map((value, index) => {
          const x = 20 + index * 40;
          const height = value ? 8 + (value / peak) * 42 : 0;
          return (
            <g key={index}>
              <motion.path
                d={value ? `M${x} 58 L${x + 1.5} ${58 - height}` : `M${x - 6} 58 L${x + 6} 58`}
                className={`agenda-ink-bar ${index === 6 ? "is-today" : ""} ${value ? "" : "is-zero"}`}
                initial={reduced ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: reduced ? 0 : 0.15 + index * 0.06, ease: [0.3, 0.7, 0.2, 1] }}
              />
              {value ? (
                <text x={x} y={52 - height} className="agenda-ink-num" textAnchor="middle">
                  {value}
                </text>
              ) : null}
              <text x={x} y={72} className="agenda-ink-day" textAnchor="middle">
                {letters[new Date(days[index]).getDay()]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
