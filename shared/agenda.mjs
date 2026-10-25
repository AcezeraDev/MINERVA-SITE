/**
 * Regras da Agenda que não dependem de tela: ler uma frase solta ("prova de
 * química sexta 14h !") e transformar em tarefa, repetir tarefas, montar a grade
 * do mês e exportar para .ics.
 *
 * Mora em shared para os testes Node usarem a mesma implementação do navegador.
 * Datas são sempre meia-noite LOCAL (como `today()` do app): somar dias com
 * setDate em vez de 86400000 evita o dia "pular" em fuso com horário de verão.
 */

const DAY = 86400000;

export const taskKinds = [
  { id: "prova", label: "Prova", words: ["prova", "provao", "avaliacao", "simulado", "teste", "p1", "p2", "vestibular", "enem"] },
  { id: "trabalho", label: "Trabalho", words: ["trabalho", "seminario", "apresentacao", "projeto", "redacao", "maquete", "cartaz", "feira"] },
  { id: "licao", label: "Lição", words: ["licao", "dever", "exercicio", "exercicios", "atividade", "atividades", "lista", "questoes"] },
  { id: "revisao", label: "Revisão", words: ["revisar", "revisao", "estudar", "estudo", "resumo", "flashcards"] },
  { id: "leitura", label: "Leitura", words: ["ler", "leitura", "livro", "capitulo", "texto"] },
];

export const taskPriorities = [
  { id: "alta", label: "Urgente" },
  { id: "media", label: "Normal" },
  { id: "baixa", label: "Sem pressa" },
];

const weekdays = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

/** Minúsculas e sem acento, caractere a caractere, para os índices baterem com o texto original. */
function fold(text) {
  let out = "";
  for (const ch of String(text || "")) {
    const plain = ch.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    out += plain.length === ch.length ? plain : ch.toLowerCase().slice(0, ch.length).padEnd(ch.length, " ");
  }
  return out;
}

export function startOfDay(timestamp) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function shiftDays(timestamp, days) {
  const date = new Date(startOfDay(timestamp));
  date.setDate(date.getDate() + days);
  return date.getTime();
}

export function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY);
}

function dateOf(year, monthIndex, day) {
  const date = new Date(year, monthIndex, day);
  // new Date(2026, 1, 31) vira 3 de março: data inválida, não serve.
  if (date.getMonth() !== ((monthIndex % 12) + 12) % 12 || date.getDate() !== day) return null;
  return date.getTime();
}

/**
 * Lê uma frase e devolve o que deu para entender. O título é o que sobra
 * depois de tirar as marcas de data, hora, prioridade e repetição; palavras
 * como "prova" e o nome da matéria ficam no título porque fazem parte dele.
 *
 * @param {string} text
 * @param {{ now?: number, subjects?: Array<{ id: string, name: string }> }} [options]
 */
export function parseQuickTask(text, options = {}) {
  const now = options.now ?? Date.now();
  const base = startOfDay(now);
  const raw = String(text || "").normalize("NFC");
  const folded = fold(raw);
  const cut = [];
  const take = (match, start = match.index, length = match[0].length) => cut.push([start, start + length]);

  let dueAt = null;
  let time = null;
  let priority = null;
  let repeat = null;

  // Repetição antes do dia da semana: "toda sexta" é repetição E data.
  const repeatWeekly = /(?:^|\s)(toda semana|todas as semanas|semanalmente|semanal|tod[ao]s? (?:as |os )?(domingo|segunda|terca|quarta|quinta|sexta|sabado)s?(?:-feiras?)?)(?=\s|$|[,.!])/.exec(folded);
  const repeatDaily = /(?:^|\s)(todo dia|todos os dias|diariamente|diaria)(?=\s|$|[,.!])/.exec(folded);
  if (repeatWeekly) {
    repeat = "weekly";
    take(repeatWeekly, repeatWeekly.index + repeatWeekly[0].indexOf(repeatWeekly[1]), repeatWeekly[1].length);
    if (repeatWeekly[2]) dueAt = nextWeekday(base, weekdays.indexOf(repeatWeekly[2]), true);
  } else if (repeatDaily) {
    repeat = "daily";
    take(repeatDaily, repeatDaily.index + repeatDaily[0].indexOf(repeatDaily[1]), repeatDaily[1].length);
  }

  const free = (index) => !cut.some(([a, b]) => index >= a && index < b);
  const find = (regex) => {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(folded))) {
      if (free(match.index + (match[0].length - match[0].trimStart().length))) return match;
      if (!regex.global) return null;
    }
    return null;
  };

  // Prioridade: "!", "!!", "urgente". "sem pressa" baixa.
  const high = find(/(?:^|\s)(!{1,3}|urgente|importante|prioridade alta)(?=\s|$)/g);
  const low = find(/(?:^|\s)(sem pressa|prioridade baixa|tranquilo)(?=\s|$)/g);
  if (high) {
    priority = "alta";
    take(high, high.index + high[0].indexOf(high[1]), high[1].length);
  } else if (low) {
    priority = "baixa";
    take(low, low.index + low[0].indexOf(low[1]), low[1].length);
  }

  // Hora: "14h", "14h30", "14:30", "às 9".
  const clock = find(/(?:^|\s)((?:as\s+|a\s+partir\s+das\s+)?(\d{1,2})(?:\s?h\s?(\d{2})?|:(\d{2}))(?:min)?)(?=\s|$|[,.!])/g) || find(/(?:^|\s)(as\s+(\d{1,2}))(?=\s|$|[,.!])/g);
  if (clock) {
    const hours = Number(clock[2]);
    const minutes = Number(clock[3] || clock[4] || 0);
    if (hours <= 23 && minutes <= 59) {
      time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      take(clock, clock.index + clock[0].indexOf(clock[1]), clock[1].length);
    }
  }

  if (dueAt === null) {
    const rules = [
      [/(?:^|\s)((?:para |pra |ate )?depois de amanha)(?=\s|$|[,.!])/g, () => shiftDays(base, 2)],
      [/(?:^|\s)((?:para |pra |ate )?amanha)(?=\s|$|[,.!])/g, () => shiftDays(base, 1)],
      [/(?:^|\s)((?:para |pra |ate )?hoje)(?=\s|$|[,.!])/g, () => base],
      [/(?:^|\s)((?:em|daqui a|daqui)\s+(\d{1,2})\s+dias?)(?=\s|$|[,.!])/g, (m) => shiftDays(base, Number(m[2]))],
      [/(?:^|\s)((?:na |para a |pra )?(?:semana que vem|proxima semana))(?=\s|$|[,.!])/g, () => shiftDays(base, 7)],
      [
        /(?:^|\s)((?:(?:para |pra |ate )?(?:n[ao]|nest[ae]|proxim[ao]|essa|esse|ess[ae]) )?(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira| feira)?(?: que vem)?)(?=\s|$|[,.!])/g,
        (m) => nextWeekday(base, weekdays.indexOf(m[2]), true),
      ],
      [
        /(?:^|\s)((?:(?:para |pra |ate |em |no )?(?:o )?(?:dia )?)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?)(?=\s|$|[,.!])/g,
        (m) => {
          const day = Number(m[2]);
          const month = Number(m[3]) - 1;
          const today = new Date(base);
          if (m[4]) {
            const year = Number(m[4].length === 2 ? `20${m[4]}` : m[4]);
            return dateOf(year, month, day);
          }
          const sameYear = dateOf(today.getFullYear(), month, day);
          if (sameYear !== null && sameYear >= base) return sameYear;
          return dateOf(today.getFullYear() + 1, month, day);
        },
      ],
      [
        /(?:^|\s)((?:para |pra |ate |no )?(?:o )?dia (\d{1,2}))(?=\s|$|[,.!])/g,
        (m) => {
          const day = Number(m[2]);
          const today = new Date(base);
          for (let offset = 0; offset < 3; offset += 1) {
            const candidate = dateOf(today.getFullYear(), today.getMonth() + offset, day);
            if (candidate !== null && candidate >= base) return candidate;
          }
          return null;
        },
      ],
    ];
    for (const [regex, resolve] of rules) {
      const match = find(regex);
      if (!match) continue;
      const value = resolve(match);
      if (value === null || value === undefined) continue;
      dueAt = value;
      take(match, match.index + match[0].indexOf(match[1]), match[1].length);
      break;
    }
  }
  if (dueAt === null && repeat === "daily") dueAt = base;

  // Matéria: "#mat" vence; senão o nome cadastrado que aparecer na frase.
  let subjectId = null;
  const subjects = options.subjects || [];
  const hashtag = find(/(?:^|\s)(#([\p{L}\p{N}_-]+))/gu);
  if (hashtag) {
    const tag = hashtag[2];
    const hit = subjects.find((subject) => fold(subject.name).replace(/\s+/g, "").startsWith(tag));
    if (hit) {
      subjectId = hit.id;
      take(hashtag, hashtag.index + hashtag[0].indexOf(hashtag[1]), hashtag[1].length);
    }
  }
  if (!subjectId) {
    const byLength = [...subjects].sort((a, b) => b.name.length - a.name.length);
    for (const subject of byLength) {
      const name = fold(subject.name).trim();
      if (name.length < 3) continue;
      const pattern = new RegExp(`(?:^|[^\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}])`, "u");
      if (pattern.test(folded)) {
        subjectId = subject.id;
        break;
      }
    }
  }

  let title = "";
  for (let index = 0; index < raw.length; index += 1) title += free(index) ? raw[index] : " ";
  title = title
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/[\s,;-]+$/g, "")
    .replace(/\s+(?:para|pra|ate|até|no|na|em|de|do|da|às|as|a)$/i, "")
    .replace(/^[\s,;-]+/, "")
    .trim();
  if (title) title = title[0].toLocaleUpperCase("pt-BR") + title.slice(1);

  return { title, dueAt, time, priority, kind: kindOf(raw), subjectId, repeat };
}

/** Próximo dia da semana a partir de `base`. Com `strict`, hoje não conta (sexta numa sexta = semana que vem). */
export function nextWeekday(base, weekday, strict = false) {
  const current = new Date(base).getDay();
  let diff = (weekday - current + 7) % 7;
  if (diff === 0 && strict) diff = 7;
  return shiftDays(base, diff);
}

/** Tipo de tarefa pelas palavras do título. */
export function kindOf(title) {
  const words = fold(title).split(/[^a-z0-9]+/).filter(Boolean);
  for (const kind of taskKinds) {
    if (kind.words.some((word) => words.includes(word))) return kind.id;
  }
  return null;
}

function newTaskId() {
  return `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Data da próxima vez de uma tarefa que repete; nunca no passado. */
export function nextOccurrence(task, now = Date.now()) {
  const step = task.repeat === "daily" ? 1 : task.repeat === "weekly" ? 7 : 0;
  if (!step) return null;
  const base = startOfDay(now);
  let next = shiftDays(task.dueAt, step);
  while (next < base) next = shiftDays(next, step);
  return next;
}

/**
 * Concluir ou reabrir uma tarefa (`done` indefinido alterna). Concluir uma
 * tarefa que repete cria a próxima; `spawnedNext` impede uma segunda cópia
 * quando a pessoa reabre e conclui de novo.
 */
export function setTaskDone(tasks, id, done, now = Date.now()) {
  let spawned = null;
  const next = tasks.map((task) => {
    if (task.id !== id) return task;
    const value = done === undefined ? !task.done : done;
    if (value && !task.done && task.repeat && !task.spawnedNext) {
      const dueAt = nextOccurrence(task, now);
      if (dueAt !== null) {
        spawned = {
          ...task,
          id: newTaskId(),
          dueAt,
          done: false,
          doneAt: undefined,
          createdAt: now,
          spawnedNext: undefined,
          steps: Array.isArray(task.steps) ? task.steps.map((step) => ({ ...step, done: false })) : task.steps,
        };
        return { ...task, done: true, doneAt: now, spawnedNext: spawned.id };
      }
    }
    return { ...task, done: value, doneAt: value ? now : undefined };
  });
  return spawned ? [...next, spawned] : next;
}

/** 42 casas (6 semanas, começando no domingo) do mês pedido. */
export function monthGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const start = shiftDays(first.getTime(), -first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = shiftDays(start, index);
    return { day, inMonth: new Date(day).getMonth() === first.getMonth() };
  });
}

/** Linhas de uma resposta da Mine viram passos: sem marcadores, sem números, 2 a 8 itens. */
export function parseSteps(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*(?:[-*•·]|\d{1,2}[.)]|\[\s?\])\s*/, "")
        .replace(/\*\*/g, "")
        .trim(),
    )
    .filter((line) => line.length >= 3 && !/:$/.test(line))
    .map((line) => (line.length > 90 ? `${line.slice(0, 87).trimEnd()}…` : line))
    .slice(0, 8);
}

function icsText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/([,;])/g, "\\$1");
}

function icsFold(line) {
  const parts = [];
  let rest = line;
  while (rest.length > 73) {
    parts.push(rest.slice(0, 73));
    rest = ` ${rest.slice(73)}`;
  }
  parts.push(rest);
  return parts.join("\r\n");
}

function icsDate(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Arquivo de calendário (RFC 5545) com as tarefas abertas. Sem hora vira
 * evento de dia inteiro; com hora, uma hora de duração no fuso de quem abrir.
 */
export function buildIcs(tasks, subjects = [], now = Date.now()) {
  const stamp = new Date(now).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Minerva//Agenda//PT-BR", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Agenda Minerva"];
  for (const task of tasks) {
    if (task.done) continue;
    const subject = subjects.find((item) => item.id === task.subjectId);
    const description = [
      subject ? `Matéria: ${subject.name}` : "",
      task.note || "",
      ...(Array.isArray(task.steps) ? task.steps.map((step) => `${step.done ? "[x]" : "[ ]"} ${step.text}`) : []),
    ]
      .filter(Boolean)
      .join("\n");
    lines.push("BEGIN:VEVENT", `UID:${task.id}@minerva`, `DTSTAMP:${stamp}`);
    if (task.time && /^\d{2}:\d{2}$/.test(task.time)) {
      const [hours, minutes] = task.time.split(":");
      const end = new Date(task.dueAt);
      end.setHours(Number(hours) + 1, Number(minutes));
      lines.push(`DTSTART:${icsDate(task.dueAt)}T${hours}${minutes}00`, `DTEND:${icsDate(end.getTime())}T${String(end.getHours()).padStart(2, "0")}${String(end.getMinutes()).padStart(2, "0")}00`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(task.dueAt)}`, `DTEND;VALUE=DATE:${icsDate(shiftDays(task.dueAt, 1))}`);
    }
    lines.push(icsFold(`SUMMARY:${icsText(task.title)}`));
    if (description) lines.push(icsFold(`DESCRIPTION:${icsText(description)}`));
    if (task.repeat === "daily") lines.push("RRULE:FREQ=DAILY");
    if (task.repeat === "weekly") lines.push("RRULE:FREQ=WEEKLY");
    if (task.priority === "alta") lines.push("PRIORITY:1");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
