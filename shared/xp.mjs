/**
 * Regras de XP, conquistas e níveis.
 *
 * Fonte única: a tela Progresso (src/main.tsx) e o ranking calculado no
 * servidor (data-server.mjs) importam daqui. Se cada lado tivesse a sua cópia
 * da fórmula, o XP que o amigo vê no ranking divergiria do XP que o dono da
 * conta vê no próprio perfil — e um placar em que os números não batem não
 * serve para nada.
 *
 * Arquivo em JavaScript de propósito: o navegador passa pelo Vite e o servidor
 * o carrega direto como ESM de Node. Os tipos vivem ao lado, em xp.d.mts.
 */

export const dayMs = 86400000;

/** Quanto vale cada ação. Mexer aqui muda o app inteiro de uma vez. */
export const xpPerAction = {
  subject: 15,
  material: 10,
  studied: 15,
  taskDone: 20,
  focus: 25,
  prova: 30,
  game: 5,
  mineMessage: 3,
  cardReview: 5,
};

/** A mesma tabela em forma de lista, para a tela "Como ganhar XP". */
export const xpActions = [
  ["Criar uma matéria", xpPerAction.subject],
  ["Adicionar um conteúdo", xpPerAction.material],
  ["Marcar conteúdo como estudado", xpPerAction.studied],
  ["Concluir uma tarefa", xpPerAction.taskDone],
  ["Completar uma sessão de foco", xpPerAction.focus],
  ["Concluir um simulado", xpPerAction.prova],
  ["Acertar uma pergunta nos jogos", xpPerAction.game],
  ["Conversar com a Mine", xpPerAction.mineMessage],
  ["Revisar um flashcard", xpPerAction.cardReview],
];

export const levelTitles = [
  { level: 1, title: "Iniciante" },
  { level: 3, title: "Aprendiz" },
  { level: 5, title: "Estudante dedicado" },
  { level: 8, title: "Explorador do saber" },
  { level: 12, title: "Veterano de provas" },
  { level: 16, title: "Mestre do foco" },
  { level: 22, title: "Sábio da Minerva" },
  { level: 30, title: "Lenda da Minerva" },
];

/**
 * Conquistas. `stat` diz qual número de `gamificationStats` conta para ela —
 * é o que permite avaliar a lista inteira sem um `if` por conquista. O ícone
 * fica no frontend, porque o servidor não desenha nada.
 */
export const achievementList = [
  { id: "subject-1", title: "Primeira matéria", text: "Crie sua primeira matéria.", xp: 20, target: 1, stat: "subjects" },
  { id: "subject-5", title: "Colecionador", text: "Tenha 5 matérias criadas.", xp: 40, target: 5, stat: "subjects" },
  { id: "material-1", title: "Primeiro conteúdo", text: "Adicione um conteúdo de estudo.", xp: 20, target: 1, stat: "materials" },
  { id: "material-15", title: "Biblioteca viva", text: "Reúna 15 conteúdos.", xp: 60, target: 15, stat: "materials" },
  { id: "studied-1", title: "Primeiro estudo", text: "Marque um conteúdo como estudado.", xp: 20, target: 1, stat: "studied" },
  { id: "studied-10", title: "Devorador de conteúdo", text: "Estude 10 conteúdos.", xp: 60, target: 10, stat: "studied" },
  { id: "task-1", title: "Missão cumprida", text: "Conclua sua primeira tarefa.", xp: 20, target: 1, stat: "tasksDone" },
  { id: "task-20", title: "Agenda em dia", text: "Conclua 20 tarefas.", xp: 80, target: 20, stat: "tasksDone" },
  { id: "focus-1", title: "Primeiro foco", text: "Complete uma sessão de foco.", xp: 20, target: 1, stat: "focus" },
  { id: "focus-10", title: "Foco de aço", text: "Complete 10 sessões de foco.", xp: 60, target: 10, stat: "focus" },
  { id: "focus-25", title: "Maratonista", text: "Complete 25 sessões de foco.", xp: 100, target: 25, stat: "focus" },
  { id: "mine-1", title: "Oi, Mine!", text: "Converse com a Mine pela primeira vez.", xp: 20, target: 1, stat: "mineMessages" },
  { id: "mine-30", title: "Melhores amigas", text: "Envie 30 mensagens para a Mine.", xp: 60, target: 30, stat: "mineMessages" },
  { id: "prova-1", title: "Modo prova ativado", text: "Conclua um simulado.", xp: 30, target: 1, stat: "provas" },
  { id: "prova-5", title: "Gabaritando", text: "Conclua 5 simulados.", xp: 80, target: 5, stat: "provas" },
  { id: "cards-10", title: "Revisor", text: "Revise flashcards 10 vezes.", xp: 40, target: 10, stat: "cardReviews" },
  { id: "cards-100", title: "Memória de elefante", text: "Revise flashcards 100 vezes.", xp: 100, target: 100, stat: "cardReviews" },
  { id: "card-master-1", title: "Cartão dominado", text: "Domine um flashcard até o nível máximo.", xp: 40, target: 1, stat: "mastered" },
  { id: "streak-3", title: "Ritmo constante", text: "Estude 3 dias seguidos.", xp: 40, target: 3, stat: "streakDays" },
  { id: "streak-7", title: "Semana perfeita", text: "Estude 7 dias seguidos.", xp: 100, target: 7, stat: "streakDays" },
  { id: "games-5", title: "Jogador de plantão", text: "Termine 5 partidas nos jogos da Mine.", xp: 40, target: 5, stat: "games" },
  { id: "games-25", title: "Veterano da arena", text: "Termine 25 partidas nos jogos da Mine.", xp: 80, target: 25, stat: "games" },
];

export function startOfDay(timestamp) {
  const date = new Date(Number(timestamp) || 0);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Dias seguidos com pelo menos uma sessão registrada, contando de hoje para trás. */
export function streakDays(sessions, now = Date.now()) {
  const days = new Set((sessions || []).map((item) => startOfDay(item.createdAt)));
  let total = 0;
  let cursor = startOfDay(now);
  while (days.has(cursor)) {
    total += 1;
    cursor -= dayMs;
  }
  return total;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * `scope` são as coleções já filtradas para uma única conta.
 * O servidor filtra por userId antes de chamar; o frontend já recebe assim.
 */
export function gamificationStats(scope, now = Date.now()) {
  const sessions = list(scope?.sessions);
  const flashcards = list(scope?.flashcards);
  return {
    subjects: list(scope?.subjects).length,
    materials: list(scope?.materials).length,
    studied: list(scope?.materials).filter((item) => item.studied).length,
    tasksDone: list(scope?.tasks).filter((item) => item.done).length,
    focus: sessions.filter((item) => item.kind === "Foco").length,
    provas: sessions.filter((item) => item.kind === "Prova").length,
    games: sessions.filter((item) => item.kind === "Games").length,
    gameXp: sessions
      .filter((item) => item.kind === "Games")
      .reduce((sum, item) => sum + Math.max(0, Math.floor(Number(item.xpEarned) || 0)), 0),
    mineMessages: list(scope?.chats).filter((item) => item.role === "user").length,
    cardReviews: flashcards.reduce((sum, card) => sum + (Number(card.reps) || 0), 0),
    mastered: flashcards.filter((card) => (Number(card.level) || 0) >= 4).length,
    streakDays: streakDays(sessions, now),
  };
}

export function unlockedAchievements(stats) {
  return achievementList.filter((item) => (Number(stats?.[item.stat]) || 0) >= item.target);
}

export function totalXp(stats) {
  const base =
    stats.subjects * xpPerAction.subject +
    stats.materials * xpPerAction.material +
    stats.studied * xpPerAction.studied +
    stats.tasksDone * xpPerAction.taskDone +
    stats.focus * xpPerAction.focus +
    stats.provas * xpPerAction.prova +
    (Number(stats.gameXp) || 0) +
    stats.mineMessages * xpPerAction.mineMessage +
    stats.cardReviews * xpPerAction.cardReview;
  return base + unlockedAchievements(stats).reduce((sum, item) => sum + item.xp, 0);
}

export function levelFromXp(xp) {
  let level = 1;
  let remaining = Math.max(0, Number(xp) || 0);
  let need = 100;
  while (remaining >= need && level < 60) {
    remaining -= need;
    level += 1;
    need = 100 + (level - 1) * 50;
  }
  const title = [...levelTitles].reverse().find((item) => level >= item.level)?.title || levelTitles[0].title;
  return { level, levelXp: remaining, levelNeed: need, title };
}

/**
 * XP conquistado a partir de um instante — é o que o ranking mostra por dia e
 * por semana.
 *
 * Só entra o que tem data própria. Conquistas ficam de fora de propósito:
 * elas são um bônus acumulado pela conta inteira, e jogá-las na janela faria
 * um dia comum render centenas de XP de uma vez. Revisão de flashcard conta
 * pela última revisão de cada cartão, que é o que o registro guarda.
 */
export function xpSince(scope, since) {
  const from = Number(since) || 0;
  const after = (value) => Number(value) > 0 && Number(value) >= from;
  const materials = list(scope?.materials);
  const sessions = list(scope?.sessions);
  return (
    list(scope?.subjects).filter((item) => after(item.createdAt)).length * xpPerAction.subject +
    materials.filter((item) => after(item.createdAt)).length * xpPerAction.material +
    materials.filter((item) => item.studied && after(item.studiedAt)).length * xpPerAction.studied +
    list(scope?.tasks).filter((item) => item.done && after(item.doneAt)).length * xpPerAction.taskDone +
    sessions.filter((item) => item.kind === "Foco" && after(item.createdAt)).length * xpPerAction.focus +
    sessions.filter((item) => item.kind === "Prova" && after(item.createdAt)).length * xpPerAction.prova +
    sessions
      .filter((item) => item.kind === "Games" && after(item.createdAt))
      .reduce((sum, item) => sum + Math.max(0, Math.floor(Number(item.xpEarned) || 0)), 0) +
    list(scope?.chats).filter((item) => item.role === "user" && after(item.createdAt)).length * xpPerAction.mineMessage +
    list(scope?.flashcards).filter((item) => after(item.lastReviewedAt)).length * xpPerAction.cardReview
  );
}

/** Jogos premiam apenas respostas corretas; concluir ou errar não rende XP. */
export function gameXpFromCorrectAnswers(correctAnswers) {
  return Math.max(0, Math.floor(Number(correctAnswers) || 0)) * xpPerAction.game;
}

/** Começo do dia de hoje e dos últimos 7 dias — os dois recortes do ranking. */
export function rankingWindows(now = Date.now()) {
  const day = startOfDay(now);
  return { day, week: day - 6 * dayMs };
}
