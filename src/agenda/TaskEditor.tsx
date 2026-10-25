import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Clock, Loader2, Plus, Repeat, Save, Sparkles, Trash2, X } from "lucide-react";
import { Input, PrimaryButton, requestAssistantResponse, today, uid, type AppData, type Subject, type Task, type TaskStep, type User } from "../main";
import { kindOf, nextWeekday, parseSteps, shiftDays, taskKinds, taskPriorities, type TaskKind, type TaskPriority, type TaskRepeat } from "../../shared/agenda.mjs";
import { spring, useSoftMotion } from "../motion";
import { InkCheck, mineSays } from "../caderno";
import "./agenda.css";

function dateKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fromDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day).getTime() : null;
}

/**
 * Criar e editar tarefa no mesmo formulário. Abre com `initial.taskId` para
 * editar, ou com `dueAt`/`title` pré-preenchidos quando vem do calendário ou da
 * frase rápida.
 */
export function TaskEditor({
  user,
  subjects,
  tasks,
  initial,
  update,
  close,
  notify,
}: {
  user: User;
  subjects: Subject[];
  tasks: Task[];
  initial: { subjectId?: string; taskId?: string; dueAt?: number; title?: string };
  update: (next: (draft: AppData) => AppData) => void;
  close: () => void;
  notify: (message: string) => void;
}) {
  const editing = initial.taskId ? tasks.find((task) => task.id === initial.taskId) : undefined;
  const reduced = useSoftMotion();
  const [title, setTitle] = useState(editing?.title ?? initial.title ?? "");
  const [subject, setSubject] = useState(editing?.subjectId || initial.subjectId || subjects[0]?.id || "");
  const [dueAt, setDueAt] = useState(editing?.dueAt ?? initial.dueAt ?? shiftDays(today(), 1));
  const [time, setTime] = useState(editing?.time || "");
  const [kind, setKind] = useState<TaskKind | null>(editing?.kind ?? (initial.title ? kindOf(initial.title) : null));
  const [kindTouched, setKindTouched] = useState(Boolean(editing?.kind));
  const [priority, setPriority] = useState<TaskPriority>(editing?.priority || "media");
  const [repeat, setRepeat] = useState<TaskRepeat | "">(editing?.repeat || "");
  const [note, setNote] = useState(editing?.note || "");
  const [steps, setSteps] = useState<TaskStep[]>(editing?.steps || []);
  const [stepDraft, setStepDraft] = useState("");
  const [thinking, setThinking] = useState(false);

  const base = today();
  const quickDates = [
    { label: "Hoje", value: base },
    { label: "Amanhã", value: shiftDays(base, 1) },
    { label: "Sexta", value: nextWeekday(base, 5) },
    { label: "Em 1 semana", value: shiftDays(base, 7) },
  ];

  const changeTitle = (value: string) => {
    setTitle(value);
    // Enquanto a pessoa não escolheu o tipo, ele acompanha o título.
    if (!kindTouched) setKind(kindOf(value));
  };

  const addStep = () => {
    const text = stepDraft.trim();
    if (!text) return;
    setSteps((list) => [...list, { id: uid("step"), text, done: false }]);
    setStepDraft("");
  };

  const askMine = async () => {
    if (!title.trim() || thinking) return;
    setThinking(true);
    try {
      const subjectName = subjects.find((item) => item.id === subject)?.name || "";
      const days = Math.max(0, Math.round((dueAt - base) / 86400000));
      const response = await requestAssistantResponse({
        prompt: [
          `Divida esta tarefa escolar em 3 a 6 passos curtos e práticos, na ordem de fazer: "${title.trim()}"${subjectName ? ` (matéria: ${subjectName})` : ""}.`,
          `Prazo: ${days === 0 ? "hoje" : `${days} dias`}.`,
          "Responda só com a lista, um passo por linha, começando com verbo, sem introdução nem conclusão.",
        ].join(" "),
        history: [],
        context: "",
      });
      const found = parseSteps(response.reply);
      if (!found.length) {
        notify("A Mine não conseguiu dividir agora. Tente de novo.");
        return;
      }
      setSteps((list) => [...list, ...found.map((text) => ({ id: uid("step"), text, done: false }))]);
      mineSays("Dividi em passos menores!", "happy");
    } catch (error) {
      notify(error instanceof Error ? error.message : "A Mine não respondeu agora.");
    } finally {
      setThinking(false);
    }
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !subject) return;
    const fields = {
      subjectId: subject,
      title: title.trim(),
      note: note.trim(),
      dueAt,
      time: time || undefined,
      kind: kind || undefined,
      priority: priority === "media" ? undefined : priority,
      repeat: repeat || undefined,
      steps: steps.length ? steps : undefined,
    };
    if (editing) {
      update((draft) => ({ ...draft, tasks: draft.tasks.map((task) => (task.id === editing.id ? { ...task, ...fields } : task)) }));
      notify("Tarefa atualizada.");
    } else {
      update((draft) => ({ ...draft, tasks: [...draft.tasks, { id: uid("task"), userId: user.id, done: false, createdAt: Date.now(), ...fields }] }));
      notify("Tarefa criada.");
    }
    close();
  };

  const remove = () => {
    if (!editing) return;
    update((draft) => ({ ...draft, tasks: draft.tasks.filter((task) => task.id !== editing.id) }));
    notify("Tarefa excluída.");
    close();
  };

  return (
    <form onSubmit={save} className="agenda-editor space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="caderno-note">{editing ? "editar bilhete" : "novo bilhete"}</p>
          <h2 className="font-display text-3xl font-black">{editing ? "Editar tarefa" : "Nova tarefa"}</h2>
        </div>
        {editing ? (
          <button type="button" onClick={remove} className="agenda-chip is-danger" aria-label={`Excluir ${editing.title}`}>
            <Trash2 className="h-4 w-4" /> Excluir
          </button>
        ) : null}
      </div>

      <Input label="Título" value={title} onChange={changeTitle} placeholder="Ex: Prova de química" />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-[13px] font-black text-white/70">Matéria</span>
          <select value={subject} onChange={(event) => setSubject(event.target.value)} className="agenda-field h-12 w-full">
            {subjects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="mb-2 block text-[13px] font-black text-white/70">Prioridade</legend>
          <div className="agenda-segment" role="radiogroup" aria-label="Prioridade">
            {taskPriorities.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={priority === item.id}
                onClick={() => setPriority(item.id)}
                className={`agenda-segment-btn ${priority === item.id ? "is-on" : ""} is-${item.id}`}
              >
                {priority === item.id ? <motion.span layoutId={reduced ? undefined : "editor-priority"} transition={spring.snappy} className="agenda-segment-pill" /> : null}
                <span className="relative">{item.label}</span>
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <fieldset>
        <legend className="mb-2 block text-[13px] font-black text-white/70">Tipo</legend>
        <div className="flex flex-wrap gap-2">
          {taskKinds.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={kind === item.id}
              onClick={() => {
                setKindTouched(true);
                setKind(kind === item.id ? null : item.id);
              }}
              className={`agenda-chip agenda-kind-chip is-${item.id} ${kind === item.id ? "is-on" : ""}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <fieldset>
          <legend className="mb-2 flex items-center gap-1.5 text-[13px] font-black text-white/70">
            <CalendarDays className="h-4 w-4" /> Prazo
          </legend>
          <div className="flex flex-wrap items-center gap-2">
            {quickDates.map((item) => (
              <button key={item.label} type="button" aria-pressed={dueAt === item.value} onClick={() => setDueAt(item.value)} className={`agenda-chip ${dueAt === item.value ? "is-on" : ""}`}>
                {item.label}
              </button>
            ))}
            <input
              type="date"
              value={dateKey(dueAt)}
              onChange={(event) => {
                const value = fromDateKey(event.target.value);
                if (value !== null) setDueAt(value);
              }}
              aria-label="Escolher data"
              className="agenda-field h-10 px-3"
            />
          </div>
        </fieldset>
        <label className="block">
          <span className="mb-2 flex items-center gap-1.5 text-[13px] font-black text-white/70">
            <Clock className="h-4 w-4" /> Hora
          </span>
          <span className="flex items-center gap-1">
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="agenda-field h-10 px-3" aria-label="Hora (opcional)" />
            {time ? (
              <button type="button" onClick={() => setTime("")} className="grid h-9 w-9 place-items-center rounded-lg text-white/40 hover:text-white" aria-label="Tirar hora">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </span>
        </label>
      </div>

      <fieldset>
        <legend className="mb-2 flex items-center gap-1.5 text-[13px] font-black text-white/70">
          <Repeat className="h-4 w-4" /> Repetir
        </legend>
        <div className="flex flex-wrap gap-2">
          {([
            ["", "Não repete"],
            ["daily", "Todo dia"],
            ["weekly", "Toda semana"],
          ] as const).map(([value, label]) => (
            <button key={value || "none"} type="button" aria-pressed={repeat === value} onClick={() => setRepeat(value)} className={`agenda-chip ${repeat === value ? "is-on" : ""}`}>
              {label}
            </button>
          ))}
        </div>
        {repeat ? <p className="mt-2 text-[12px] text-white/45">Ao concluir, a próxima já aparece na agenda.</p> : null}
      </fieldset>

      <section aria-label="Passos">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[13px] font-black text-white/70">Passos {steps.length ? `(${steps.filter((step) => step.done).length}/${steps.length})` : ""}</span>
          <button type="button" onClick={askMine} disabled={!title.trim() || thinking} className="agenda-chip is-mine">
            {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {thinking ? "A Mine está pensando..." : "Dividir com a Mine"}
          </button>
        </div>
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {steps.map((step) => (
              <motion.li
                key={step.id}
                layout={!reduced}
                initial={reduced ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, x: 12 }}
                transition={spring.snappy}
                className="agenda-step"
              >
                <button
                  type="button"
                  aria-pressed={step.done}
                  aria-label={step.done ? `Desmarcar ${step.text}` : `Marcar ${step.text}`}
                  onClick={() => setSteps((list) => list.map((item) => (item.id === step.id ? { ...item, done: !item.done } : item)))}
                  className="grid h-8 w-8 shrink-0 place-items-center"
                >
                  <InkCheck checked={step.done} className="caderno-inkcheck-sm" />
                </button>
                <span className={`caderno-strike min-w-0 flex-1 text-sm ${step.done ? "is-struck" : ""}`}>{step.text}</span>
                <button type="button" onClick={() => setSteps((list) => list.filter((item) => item.id !== step.id))} aria-label={`Tirar ${step.text}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/30 hover:text-roseGlow">
                  <X className="h-4 w-4" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <div className="mt-2 flex gap-2">
          <input
            value={stepDraft}
            onChange={(event) => setStepDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addStep();
              }
            }}
            placeholder="Adicionar passo"
            aria-label="Novo passo"
            className="agenda-field h-10 min-w-0 flex-1 px-3"
          />
          <button type="button" onClick={addStep} disabled={!stepDraft.trim()} className="agenda-chip" aria-label="Adicionar passo">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </section>

      <label className="block">
        <span className="mb-2 block text-[13px] font-black text-white/70">Anotação</span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Capítulos, sala, o que levar..." className="agenda-field w-full resize-y p-3" />
      </label>

      <PrimaryButton icon={editing ? Save : Plus}>{editing ? "Salvar tarefa" : "Criar tarefa"}</PrimaryButton>
    </form>
  );
}
