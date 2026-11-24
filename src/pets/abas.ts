/**
 * O que a Mine sabe de cada aba do site.
 *
 * Cada aba tem: fala de chegada, falas soltas, atividades preferidas (pesos
 * sobre as atividades do motor), uma reação própria ao clique e um "truque"
 * que só acontece ali (desenhado em engine.ts, tabela TRUQUES). `ler` olha a
 * página só para LER (nunca mexe no texto que o React controla) e devolve uma
 * fala sob medida, como o nível no Progresso ou o nome na saudação do Início.
 */

export type Truque =
  | "sol" | "riscar" | "mao" | "corrigir" | "linhas" | "meditar" | "carimbo" | "podio" | "fliperama"
  | "pintar" | "hello" | "flashcard" | "lupa" | "ideia" | "conversa" | "selfie" | "mostrar" | "orgulho" | "calendario";

export type Aba = {
  chegada: string[];
  falas: string[];
  /** peso extra das atividades do motor nesta aba (1 = normal, 0 = nunca) */
  acts?: Partial<Record<"read" | "write" | "phone" | "coffee" | "music" | "magnify" | "sleep" | "dance", number>>;
  clique: string[];
  truque: Truque;
  /** prefere ficar no card mais alto da página (ranking) */
  topo?: boolean;
  /** fala menos (foco) */
  quieta?: boolean;
  ler?: () => string | null;
};

const h1 = () => (document.querySelector("main h1")?.textContent || "").replace(/\s+/g, " ").trim();
const hora = () => new Date().getHours();
const periodo = () => (hora() < 12 ? "bom dia" : hora() < 18 ? "boa tarde" : "boa noite");

export const ABAS: Record<string, Aba> = {
  home: {
    chegada: ["que caderno bonito!", "bora começar?"],
    falas: ["qual matéria hoje?", "cria uma matéria nova!", "eu faço resumo, viu?", "tô aqui se precisar!"],
    acts: { read: 1.5, coffee: 1.5 },
    clique: ["oi! bora estudar?", "me abre no chat!", "eu moro aqui no canto!"],
    truque: "sol",
    ler: () => {
      const m = h1().match(/,\s*([^\s!.,]+)/);
      return m ? `${periodo()}, ${m[1]}!` : `${periodo()}!`;
    },
  },
  subject: {
    chegada: ["matéria nova? bora resumir!", "eu faço os flashcards!"],
    falas: ["pede um resumo pra mim!", "flashcard ajuda muito!", "quer um mapa mental?", "isso cai na prova!"],
    acts: { read: 3, write: 2, magnify: 1.5, dance: 0.3 },
    clique: ["pergunta pra mim!", "quer um quiz?", "sei tudo dessa matéria!"],
    truque: "flashcard",
    ler: () => { const t = h1(); return t && t.length < 28 ? `bora de ${t}!` : null; },
  },
  agenda: {
    chegada: ["quanta tarefa...", "uma de cada vez!"],
    falas: ["anota tudo aqui!", "o que vence hoje?", "prazo é prazo, hein!", "tarefa feita, risca!"],
    acts: { write: 3, phone: 1.5, sleep: 0.2 },
    clique: ["me fala uma tarefa!", "escreve: prova sexta", "eu lembro pra você!"],
    truque: "riscar",
  },
  atividades: {
    chegada: ["lição de casa?", "bora fazer junto!"],
    falas: ["essa eu sei!", "lê o enunciado com calma", "uma de cada vez!", "vale XP, hein!"],
    acts: { write: 2.5, read: 2, sleep: 0.2 },
    clique: ["professora, eu sei!", "posso responder?", "me escolhe!"],
    truque: "mao",
  },
  provas: {
    chegada: ["prova chegando?", "calma, a gente revisa."],
    falas: ["erro também ensina!", "revisa os erros!", "olha o caderno de erros", "respira fundo"],
    acts: { magnify: 3, read: 2, write: 1.5, dance: 0.3, sleep: 0.1 },
    clique: ["sem cola, hein!", "marca a C!", "brincadeira, lê direito!"],
    truque: "corrigir",
  },
  redacao: {
    chegada: ["tema do ENEM!", "introdução, desenvolvimento..."],
    falas: ["tese clara, hein!", "conectivo é tudo!", "proposta de intervenção!", "trinta linhas!"],
    acts: { write: 3.5, read: 1.5, coffee: 1.5, dance: 0.3 },
    clique: ["nota mil vem aí!", "cuidado com a vírgula!", "repertório!"],
    truque: "linhas",
  },
  foco: {
    chegada: ["shhh... foco!", "25 minutinhos!"],
    falas: ["shhh...", "respira...", "quase lá!", "celular longe!"],
    acts: { read: 2.5, coffee: 1.2, phone: 0, dance: 0, music: 0.5, sleep: 0.4 },
    clique: ["shhh! tô focada", "depois a gente brinca!", "foco, foco!"],
    truque: "meditar",
    quieta: true,
  },
  progress: {
    chegada: ["olha esse XP!", "tá subindo, hein!"],
    falas: ["cada estudo vale XP!", "olha quanta conquista!", "sequência de dias!", "bora pro próximo nível!"],
    acts: { dance: 1.5, read: 1, sleep: 0.3 },
    clique: ["+10 XP pra você!", "orgulho!", "nível novo vem aí!"],
    truque: "carimbo",
    ler: () => {
      const m = h1().match(/n[ií]vel\s*(\d+)/i);
      return m ? `nível ${m[1]}! bora pro ${+m[1] + 1}!` : null;
    },
  },
  ranking: {
    chegada: ["quem tá em primeiro?", "bora subir no ranking!"],
    falas: ["o topo é nosso!", "estuda mais um pouco!", "olha a concorrência!", "primeiro lugar!"],
    acts: { dance: 2, phone: 1.5, sleep: 0.2 },
    clique: ["sou campeã!", "pódio!", "bora subir!"],
    truque: "podio",
    topo: true,
  },
  games: {
    chegada: ["hora do jogo!", "vale XP, hein!"],
    falas: ["bora mais uma?", "eu ganho de você!", "GG!", "esse é fácil!"],
    acts: { dance: 3, phone: 2, music: 2, sleep: 0.1 },
    clique: ["joga comigo!", "me desafia!", "player 2!"],
    truque: "fliperama",
  },
  atelie: {
    chegada: ["vou pintar tudo!", "que cor eu uso?"],
    falas: ["azul ou verde?", "pinta sem sair da linha!", "que obra de arte!", "artista!"],
    acts: { write: 2, music: 2, dance: 1.2 },
    clique: ["sujei você de tinta!", "pinta comigo!", "ops, respingou!"],
    truque: "pintar",
  },
  idiomas: {
    chegada: ["how are you?", "let's study!"],
    falas: ["nice to meet you!", "I love English!", "say it with me!", "good job!"],
    acts: { phone: 2, music: 2, read: 1.5 },
    clique: ["hello, friend!", "what's up?", "thank you!"],
    truque: "hello",
  },
  videos: {
    chegada: ["hora da videoaula!", "prepara o caderno!"],
    falas: ["eu leio a legenda e resumo!", "anota com suas palavras!", "faz o quiz da aula que vale XP!", "clica no minuto pra pular!"],
    acts: { read: 2.5, write: 2, coffee: 1.4, sleep: 0.1 },
    clique: ["quer que eu resuma a aula?", "pausa e anota!", "testa com o quiz!"],
    truque: "mostrar",
  },
  search: {
    chegada: ["procurando algo?", "eu acho pra você!"],
    falas: ["digita ali em cima!", "hmm, onde está?", "achei? não..."],
    acts: { magnify: 4, read: 1.5 },
    clique: ["achei você!", "busca rápida!"],
    truque: "lupa",
  },
  plan: {
    chegada: ["plano de estudos!", "organização é tudo!"],
    falas: ["um pouco por dia!", "segunda: matemática!", "descanso também conta!"],
    acts: { write: 3, coffee: 1.5 },
    clique: ["me fala sua meta!", "eu monto o plano!"],
    truque: "calendario",
  },
  comments: {
    chegada: ["fofoca boa?", "o que a turma disse?"],
    falas: ["comenta também!", "que legal isso!", "respeito sempre, tá?"],
    acts: { phone: 3, read: 1.5 },
    clique: ["comenta aí!", "eu li tudo!"],
    truque: "conversa",
  },
  suggestions: {
    chegada: ["ideia nova?", "sugere aí!"],
    falas: ["toda ideia vale!", "a equipe lê tudo!", "e se tivesse...?"],
    acts: { write: 2, magnify: 1.5 },
    clique: ["tive uma ideia!", "anota essa!"],
    truque: "ideia",
  },
  "como-usar": {
    chegada: ["vou te mostrar!", "é bem fácil!"],
    falas: ["olha esse aqui!", "rola pra baixo!", "viu como é fácil?"],
    acts: { magnify: 1.5, read: 1.5 },
    clique: ["eu te ensino!", "pergunta à vontade!"],
    truque: "mostrar",
  },
  about: {
    chegada: ["essa é a minha história!", "prazer, Mine!"],
    falas: ["feita por alunos!", "Minerva é demais!", "a deusa da sabedoria!"],
    acts: { read: 2, dance: 1.5 },
    clique: ["prazer, sou a Mine!", "obrigada por vir!"],
    truque: "orgulho",
  },
  perfil: {
    chegada: ["que perfil legal!", "ficou chique!"],
    falas: ["troca a foto!", "não me desliga, tá?", "escolhe um tema!"],
    acts: { phone: 2.5 },
    clique: ["tira foto comigo!", "sorria!"],
    truque: "selfie",
  },
};

export const abaDe = (route: string): Aba => ABAS[route] || ABAS[route === "settings" ? "perfil" : "home"];
