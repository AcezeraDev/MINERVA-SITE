import { gamificationStats, levelFromXp, totalXp } from "../../shared/xp.mjs";
import type { AppData } from "../main";

/*
 * Retrato do estudante que vai junto com cada pergunta à Mine, para as
 * ferramentas dela (mine/tools.mjs): agenda, conteúdos, caderno de erros e
 * progresso. Só o que é dele, já cortado: o servidor confere e corta de novo.
 *
 * O caderno de erros mora no localStorage (aba Provas), por isso sai daqui e
 * não do banco.
 */

type Scope = Pick<AppData, "subjects" | "materials" | "tasks" | "sessions" | "flashcards">;

function isoDay(time: number) {
  const date = new Date(time);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

type ErroGuardado = {
  assunto?: string;
  subjectId?: string;
  questao?: { question?: string; options?: string[]; correct?: number };
  marcada?: number | null;
  status?: string;
  vezes?: number;
  atualizadoEm?: number;
};
type ProvaGuardada = { assunto?: string; nota?: number; acertos?: number; total?: number; quando?: number };

function cadernoDeErros(userId: string): { caderno: ErroGuardado[]; historico: ProvaGuardada[] } {
  try {
    const raw = window.localStorage.getItem(`minerva:provas:${userId}`);
    const data = raw ? (JSON.parse(raw) as { caderno?: unknown; historico?: unknown }) : {};
    return {
      caderno: Array.isArray(data.caderno) ? (data.caderno as ErroGuardado[]) : [],
      historico: Array.isArray(data.historico) ? (data.historico as ProvaGuardada[]) : [],
    };
  } catch {
    return { caderno: [], historico: [] };
  }
}

export function buildAlunoSnapshot(scope: Scope, userId: string, now = Date.now()) {
  const subjectName = (id: string) => scope.subjects.find((subject) => subject.id === id)?.name || "";
  const cutoff = now - 30 * 86_400_000;

  const tarefas = scope.tasks
    .filter((task) => !task.done || (task.doneAt || task.dueAt) >= cutoff)
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, 80)
    .map((task) => ({
      titulo: task.title,
      materia: subjectName(task.subjectId),
      prazo: isoDay(task.dueAt),
      hora: task.time || "",
      feita: task.done,
      tipo: task.kind || "",
    }));

  // Conteúdos mais recentes primeiro; o servidor corta em ~60 mil caracteres.
  let budget = 60_000;
  const materias = scope.subjects.slice(0, 40).map((subject) => ({
    nome: subject.name,
    conteudos: scope.materials
      .filter((item) => item.subjectId === subject.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 60)
      .map((item) => {
        const texto = (item.content?.trim() || item.detail?.trim() || "").slice(0, Math.max(0, Math.min(3000, budget)));
        budget -= texto.length;
        return { titulo: item.title, texto, estudado: item.studied };
      }),
  }));

  const { caderno, historico } = cadernoDeErros(userId);
  const erros = caderno
    .filter((item) => item.status !== "dominado")
    .sort((a, b) => (b.atualizadoEm || 0) - (a.atualizadoEm || 0))
    .slice(0, 40)
    .map((item) => {
      const options = item.questao?.options || [];
      return {
        assunto: item.assunto || "",
        materia: subjectName(item.subjectId || ""),
        pergunta: item.questao?.question || "",
        marcada: typeof item.marcada === "number" ? options[item.marcada] || "" : "",
        correta: typeof item.questao?.correct === "number" ? options[item.questao.correct] || "" : "",
        status: item.status || "",
        vezes: item.vezes || 1,
      };
    });

  const stats = gamificationStats(scope as Parameters<typeof gamificationStats>[0], now) as ReturnType<typeof gamificationStats> & { streakDays?: number; studied?: number; tasksDone?: number };
  const xp = totalXp(stats);
  const level = levelFromXp(xp);

  return {
    hoje: isoDay(now),
    tarefas,
    materias,
    erros,
    provas: historico
      .slice(-12)
      .reverse()
      .map((prova) => ({ assunto: prova.assunto || "", nota: prova.nota || 0, acertos: prova.acertos || 0, total: prova.total || 0, quando: prova.quando ? isoDay(prova.quando) : "" })),
    progresso: {
      xp,
      nivel: level.level,
      titulo_do_nivel: level.title || "",
      xp_no_nivel: level.levelXp ?? 0,
      xp_para_subir: level.levelNeed ?? 0,
      dias_seguidos: stats.streakDays ?? 0,
      conteudos_estudados: stats.studied ?? 0,
      tarefas_feitas: stats.tasksDone ?? 0,
    },
  };
}
