export const gameProgressionVersion = 1;

export const gameNames = Object.freeze({
  corrida: "Corrida do Conhecimento",
  memoria: "Arquivo da Memória",
  forca: "Torre dos Códigos",
  caca: "Caça-Palavras da Mine",
  nexo: "Nexo de Ideias",
  sequencia: "Forja de Sequências",
  daily: "Desafio diário",
});

const leagueRules = Object.freeze([
  { id: "explorador", name: "Explorador", min: 0, color: "#94A3B8" },
  { id: "bronze", name: "Bronze", min: 100, color: "#D97746" },
  { id: "prata", name: "Prata", min: 300, color: "#CBD5E1" },
  { id: "ouro", name: "Ouro", min: 700, color: "#FBBF24" },
  { id: "diamante", name: "Diamante", min: 1400, color: "#67E8F9" },
  { id: "lendario", name: "Lendário", min: 2500, color: "#C084FC" },
]);

function validDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : new Date(0);
}

export function dailyChallengeKey(value = Date.now()) {
  const date = validDate(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function currentSeason(value = Date.now()) {
  const date = validDate(value);
  const year = date.getFullYear();
  const month = date.getMonth();
  const startAt = new Date(year, month, 1).getTime();
  const endAt = new Date(year, month + 1, 1).getTime();
  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(date);
  return {
    id: `${year}-${String(month + 1).padStart(2, "0")}`,
    name: `Temporada de ${monthName}`,
    startAt,
    endAt,
  };
}

export function leagueFromPoints(points = 0) {
  const safePoints = Math.max(0, Number(points) || 0);
  let league = leagueRules[0];
  for (const rule of leagueRules) if (safePoints >= rule.min) league = rule;
  const currentIndex = leagueRules.indexOf(league);
  const next = leagueRules[currentIndex + 1] || null;
  return {
    ...league,
    next,
    progress: next ? Math.min(1, (safePoints - league.min) / (next.min - league.min)) : 1,
    points: safePoints,
  };
}

export function gameSessions(sessions = []) {
  return sessions.filter((session) => session?.kind === "Games");
}

export function seasonPoints(sessions = [], value = Date.now()) {
  const season = currentSeason(value);
  const games = gameSessions(sessions).filter((session) => {
    const createdAt = Number(session.createdAt || 0);
    return createdAt >= season.startAt && createdAt < season.endAt;
  });
  const playPoints = games.reduce((sum, session) => {
    const correct = Math.max(0, Number(session.correctAnswers || 0));
    const total = Math.max(0, Number(session.questionsAnswered || 0));
    const perfect = total > 0 && correct === total ? 20 : 0;
    return sum + correct * 10 + perfect;
  }, 0);
  const seasonSessions = sessions.filter((session) => {
    const createdAt = Number(session?.createdAt || 0);
    return createdAt >= season.startAt && createdAt < season.endAt;
  });
  const activeDays = new Set(seasonSessions.map((session) => dailyChallengeKey(session.createdAt)));
  const missionPoints = [...activeDays].reduce(
    (sum, day) => sum + dailyMissionProgress(seasonSessions, new Date(`${day}T12:00:00`)).filter((mission) => mission.completed).reduce((reward, mission) => reward + mission.reward, 0),
    0,
  );
  return playPoints + missionPoints;
}

const dailyBank = Object.freeze([
  { id: "agua", prompt: "Qual é a fórmula química da água?", options: ["H₂O", "CO₂", "O₂", "NaCl"], answer: "H₂O", explanation: "Uma molécula de água reúne dois átomos de hidrogênio e um de oxigênio." },
  { id: "brasil", prompt: "Qual é a capital do Brasil?", options: ["Brasília", "Salvador", "Rio de Janeiro", "São Paulo"], answer: "Brasília", explanation: "Brasília tornou-se a capital federal em 1960." },
  { id: "primo", prompt: "Qual destes números é primo?", options: ["29", "21", "27", "33"], answer: "29", explanation: "29 só é divisível por 1 e por ele mesmo." },
  { id: "verbo", prompt: "Em “Nós estudamos hoje”, qual é o verbo?", options: ["estudamos", "nós", "hoje", "em"], answer: "estudamos", explanation: "“Estudamos” expressa a ação realizada pelo sujeito." },
  { id: "fotossintese", prompt: "Que gás as plantas absorvem na fotossíntese?", options: ["Gás carbônico", "Oxigênio", "Hidrogênio", "Hélio"], answer: "Gás carbônico", explanation: "As plantas usam dióxido de carbono, água e luz para produzir glicose." },
  { id: "continente", prompt: "Em qual continente fica o Egito?", options: ["África", "Ásia", "Europa", "Oceania"], answer: "África", explanation: "A maior parte do território egípcio está no nordeste da África." },
  { id: "fracao", prompt: "Quanto é 3/4 de 20?", options: ["15", "12", "16", "18"], answer: "15", explanation: "20 dividido por 4 é 5; multiplicando por 3, temos 15." },
  { id: "celula", prompt: "Qual estrutura controla as atividades da célula eucariótica?", options: ["Núcleo", "Membrana", "Citoplasma", "Ribossomo"], answer: "Núcleo", explanation: "O núcleo abriga o DNA e coordena grande parte das atividades celulares." },
  { id: "independencia", prompt: "Em que ano foi proclamada a Independência do Brasil?", options: ["1822", "1889", "1500", "1808"], answer: "1822", explanation: "A Independência foi proclamada em 7 de setembro de 1822." },
  { id: "sinonimo", prompt: "Qual palavra é sinônimo de “rápido”?", options: ["veloz", "lento", "pesado", "quieto"], answer: "veloz", explanation: "“Veloz” e “rápido” têm sentidos equivalentes nesse contexto." },
  { id: "angulo", prompt: "Um ângulo reto mede quantos graus?", options: ["90°", "45°", "180°", "360°"], answer: "90°", explanation: "Por definição, um ângulo reto mede 90 graus." },
  { id: "planeta", prompt: "Qual planeta é conhecido como Planeta Vermelho?", options: ["Marte", "Vênus", "Júpiter", "Mercúrio"], answer: "Marte", explanation: "Óxidos de ferro na superfície dão a Marte sua aparência avermelhada." },
  { id: "oceano", prompt: "Qual é o maior oceano da Terra?", options: ["Pacífico", "Atlântico", "Índico", "Ártico"], answer: "Pacífico", explanation: "O oceano Pacífico ocupa a maior área oceânica do planeta." },
  { id: "porcentagem", prompt: "Quanto é 25% de 80?", options: ["20", "25", "15", "30"], answer: "20", explanation: "25% equivale a um quarto; um quarto de 80 é 20." },
  { id: "estado", prompt: "A passagem direta do estado sólido para o gasoso chama-se: ", options: ["sublimação", "fusão", "condensação", "solidificação"], answer: "sublimação", explanation: "Na sublimação, a matéria passa do sólido ao gasoso sem virar líquido." },
  { id: "sujeito", prompt: "Em “A turma venceu o desafio”, qual é o sujeito?", options: ["A turma", "venceu", "o desafio", "desafio"], answer: "A turma", explanation: "“A turma” é o termo sobre o qual se declara a ação de vencer." },
  { id: "potencia", prompt: "Quanto é 2⁵?", options: ["32", "10", "16", "25"], answer: "32", explanation: "2 × 2 × 2 × 2 × 2 = 32." },
  { id: "sangue", prompt: "Qual órgão bombeia o sangue pelo corpo?", options: ["Coração", "Pulmão", "Fígado", "Rim"], answer: "Coração", explanation: "As contrações do coração impulsionam o sangue pelo sistema circulatório." },
]);

function seededNumber(text) {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function dailyChallengeQuestions(value = Date.now(), count = 5) {
  const key = dailyChallengeKey(value);
  return [...dailyBank]
    .map((question) => ({ question, order: seededNumber(`${key}:${question.id}`) }))
    .sort((a, b) => a.order - b.order)
    .slice(0, Math.max(1, Math.min(Number(count) || 5, dailyBank.length)))
    .map(({ question }) => question);
}

export function reviewedErrorIds(sessions = []) {
  return new Set(sessions.filter((session) => session?.kind === "GameReview").flatMap((session) => Array.isArray(session.reviewedErrorIds) ? session.reviewedErrorIds : []));
}

export function unresolvedGameErrors(sessions = []) {
  const reviewed = reviewedErrorIds(sessions);
  return gameSessions(sessions)
    .flatMap((session) => (Array.isArray(session.answers) ? session.answers.map((answer) => ({ ...answer, gameId: session.gameId, gameName: session.gameName || gameNames[session.gameId] || session.title, subjectId: session.subjectId, sessionId: session.id, createdAt: session.createdAt })) : []))
    .filter((answer) => answer.correct === false && !reviewed.has(answer.id))
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

export function dailyMissionProgress(sessions = [], value = Date.now()) {
  const key = dailyChallengeKey(value);
  const todaysGames = gameSessions(sessions).filter((session) => dailyChallengeKey(session.createdAt) === key);
  const reviews = sessions.filter((session) => session?.kind === "GameReview" && dailyChallengeKey(session.createdAt) === key);
  const correct = todaysGames.reduce((sum, session) => sum + Math.max(0, Number(session.correctAnswers || 0)), 0);
  const xp = todaysGames.reduce((sum, session) => sum + Math.max(0, Number(session.xpEarned || 0)), 0);
  const reviewed = reviews.reduce((sum, session) => sum + Math.max(0, Number(session.reviewCount || 0)), 0);
  const dailyDone = todaysGames.some((session) => session.dailyChallenge && session.dailyKey === key);
  return [
    { id: "correct-5", title: "Mente afiada", description: "Acerte 5 perguntas em jogos", current: correct, goal: 5, reward: 10 },
    { id: "play-2", title: "Dupla jornada", description: "Conclua 2 partidas", current: todaysGames.length, goal: 2, reward: 10 },
    { id: "daily", title: "Mesmo desafio", description: "Conclua o desafio diário", current: dailyDone ? 1 : 0, goal: 1, reward: 15 },
    { id: "review-2", title: "Aprender com o erro", description: "Revise 2 respostas erradas", current: reviewed, goal: 2, reward: 10 },
    { id: "xp-25", title: "Cinco acertos", description: "Ganhe 25 XP respondendo certo", current: xp, goal: 25, reward: 10 },
  ].map((mission) => ({ ...mission, current: Math.min(mission.current, mission.goal), completed: mission.current >= mission.goal }));
}

export const gameAchievementRules = Object.freeze([
  { id: "primeira-partida", name: "Primeira centelha", description: "Conclua sua primeira partida.", icon: "spark" },
  { id: "perfeito", name: "Sem uma rachadura", description: "Termine qualquer partida com 100% de acerto.", icon: "target" },
  { id: "seis-mundos", name: "Cartógrafo da Mine", description: "Jogue os seis jogos da Minerva.", icon: "map" },
  { id: "torre-perfeita", name: "Mestre dos códigos", description: "Decifre uma Torre dos Códigos sem errar.", icon: "tower" },
  { id: "nexo-perfeito", name: "Rede cristalina", description: "Complete um Nexo de Ideias com 100% de acerto.", icon: "link" },
  { id: "diario", name: "Presença do dia", description: "Conclua um desafio diário.", icon: "calendar" },
  { id: "diario-perfeito", name: "Resposta coletiva", description: "Acerte as cinco questões do desafio diário.", icon: "crown" },
  { id: "liga-prata", name: "Ascensão prateada", description: "Alcance a liga Prata em uma temporada.", icon: "medal" },
]);

export function unlockedGameAchievementIds(sessions = [], value = Date.now()) {
  const games = gameSessions(sessions);
  const perfect = (session) => Number(session.questionsAnswered || 0) > 0 && Number(session.correctAnswers || 0) === Number(session.questionsAnswered || 0);
  const ids = new Set();
  if (games.length) ids.add("primeira-partida");
  if (games.some(perfect)) ids.add("perfeito");
  const played = new Set(games.map((session) => session.gameId).filter((id) => id && id !== "daily"));
  if (["corrida", "memoria", "forca", "caca", "nexo", "sequencia"].every((id) => played.has(id))) ids.add("seis-mundos");
  if (games.some((session) => session.gameId === "forca" && perfect(session))) ids.add("torre-perfeita");
  if (games.some((session) => session.gameId === "nexo" && perfect(session))) ids.add("nexo-perfeito");
  if (games.some((session) => session.dailyChallenge)) ids.add("diario");
  if (games.some((session) => session.dailyChallenge && perfect(session))) ids.add("diario-perfeito");
  if (seasonPoints(sessions, value) >= 300) ids.add("liga-prata");
  return ids;
}
