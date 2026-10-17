/**
 * Idiomas: o intercâmbio da Mine.
 *
 * Tudo o que a aba #/idiomas precisa decidir sem tela fica aqui — o roteiro de
 * inglês, a montagem das lições, a correção das respostas, a leitura das
 * falas da Mine no roleplay e o progresso calculado a partir das sessões.
 *
 * As lições básicas não dependem da IA: o roteiro está escrito abaixo e cada
 * rodada é sorteada com semente, então a aula funciona mesmo sem rede ou sem
 * cota. A Mine entra onde ela faz diferença: conversar no papel de um
 * personagem e explicar um erro quando o aluno pede.
 *
 * JavaScript de propósito (como xp.mjs): o navegador passa pelo Vite e os
 * testes carregam direto no Node. Os tipos vivem em idiomas.d.mts.
 */

import { lessonXp } from "./xp.mjs";

/* ───────────────────────────── roteiro ───────────────────────────── */

/**
 * Oito paradas de um intercâmbio, na ordem em que a viagem acontece. Cada
 * parada tem palavras (com figurinha), frases e um roteiro de conversa que
 * vale quando a Mine não responde a tempo.
 */
export const englishUnits = [
  {
    id: "airport",
    place: "Aeroporto",
    placeEn: "Airport",
    emoji: "✈️",
    color: "lilac",
    theme: "cumprimentos e apresentações",
    role: "an airport officer checking passports",
    rolePt: "agente do aeroporto",
    character: "Officer Jones",
    characterPt: "o agente Jones, do aeroporto",
    missions: ["dizer seu nome", "dizer de onde você é", "entregar o passaporte"],
    scriptMissions: [0, 1, 2, -1],
    tip: {
      title: "Me apresentando",
      rule: "Para se apresentar: \"My name is...\" ou \"I am...\". O \"I\" (eu) é sempre maiúsculo, até no meio da frase.",
      en: "I am Davi. I am from Brazil.",
      pt: "Eu sou o Davi. Eu sou do Brasil.",
    },
    words: [
      { en: "hello", pt: "olá", emoji: "👋" },
      { en: "goodbye", pt: "tchau", emoji: "🙋" },
      { en: "name", pt: "nome", emoji: "🏷️" },
      { en: "passport", pt: "passaporte", emoji: "🛂" },
      { en: "friend", pt: "amigo", emoji: "🧑‍🤝‍🧑" },
      { en: "suitcase", pt: "mala", emoji: "🧳" },
      { en: "plane", pt: "avião", emoji: "✈️" },
      { en: "thank you", pt: "obrigado", emoji: "🙏" },
    ],
    phrases: [
      { en: "Hello, my name is Ana.", pt: "Olá, meu nome é Ana." },
      { en: "Nice to meet you.", pt: "Prazer em conhecer você." },
      { en: "I am from Brazil.", pt: "Eu sou do Brasil." },
      { en: "Here is my passport.", pt: "Aqui está meu passaporte." },
      { en: "How are you?", pt: "Como você está?" },
      { en: "I am fine, thank you.", pt: "Estou bem, obrigado." },
    ],
    script: [
      {
        mine: "Hello! Welcome to London. What is your name?",
        options: [
          { en: "Hello, my name is Ana.", ok: true },
          { en: "I am a suitcase.", ok: false },
          { en: "Goodbye, plane.", ok: false },
        ],
      },
      {
        mine: "Nice to meet you! Where are you from?",
        options: [
          { en: "I am from Brazil.", ok: true },
          { en: "My name is Brazil.", ok: false },
          { en: "Thank you, passport.", ok: false },
        ],
      },
      {
        mine: "Great! Can I see your passport, please?",
        options: [
          { en: "Here is my passport.", ok: true },
          { en: "How are you?", ok: false },
          { en: "I am a friend.", ok: false },
        ],
      },
      {
        mine: "Perfect. Enjoy your trip!",
        options: [
          { en: "Thank you! Goodbye.", ok: true },
          { en: "Hello, my suitcase.", ok: false },
          { en: "I am from passport.", ok: false },
        ],
      },
    ],
  },
  {
    id: "cafe",
    place: "Cafeteria",
    placeEn: "Café",
    emoji: "☕",
    color: "yellow",
    theme: "comidas, bebidas e fazer um pedido",
    role: "a friendly barista in a London café",
    rolePt: "atendente da cafeteria",
    character: "Lily",
    characterPt: "a Lily, atendente da cafeteria",
    missions: ["pedir uma bebida", "pedir algo para comer", "agradecer"],
    scriptMissions: [0, 1, -1, 2],
    tip: {
      title: "Pedindo com educação",
      rule: "\"I would like...\" é o jeito educado de pedir. Coloque \"please\" no fim e pronto!",
      en: "I would like a tea, please.",
      pt: "Eu gostaria de um chá, por favor.",
    },
    words: [
      { en: "coffee", pt: "café", emoji: "☕" },
      { en: "water", pt: "água", emoji: "💧" },
      { en: "bread", pt: "pão", emoji: "🍞" },
      { en: "cake", pt: "bolo", emoji: "🍰" },
      { en: "juice", pt: "suco", emoji: "🧃" },
      { en: "milk", pt: "leite", emoji: "🥛" },
      { en: "sandwich", pt: "sanduíche", emoji: "🥪" },
      { en: "tea", pt: "chá", emoji: "🍵" },
    ],
    phrases: [
      { en: "I would like a coffee, please.", pt: "Eu gostaria de um café, por favor." },
      { en: "Can I have some water?", pt: "Posso tomar um pouco de água?" },
      { en: "How much is the cake?", pt: "Quanto custa o bolo?" },
      { en: "I am hungry.", pt: "Estou com fome." },
      { en: "The juice is cold.", pt: "O suco está gelado." },
      { en: "Thank you very much.", pt: "Muito obrigado." },
    ],
    script: [
      {
        mine: "Good morning! What would you like?",
        options: [
          { en: "I would like a coffee, please.", ok: true },
          { en: "I am a coffee.", ok: false },
          { en: "Where is the airport?", ok: false },
        ],
      },
      {
        mine: "Sure! Anything to eat?",
        options: [
          { en: "Yes, a sandwich, please.", ok: true },
          { en: "Yes, a passport, please.", ok: false },
          { en: "No, I am water.", ok: false },
        ],
      },
      {
        mine: "That is five pounds. Anything else?",
        options: [
          { en: "No, thank you.", ok: true },
          { en: "How are you name?", ok: false },
          { en: "The cake is my friend.", ok: false },
        ],
      },
      {
        mine: "Here you are. Have a nice day!",
        options: [
          { en: "Thank you very much!", ok: true },
          { en: "I am hungry juice.", ok: false },
          { en: "Hello, goodbye milk.", ok: false },
        ],
      },
    ],
  },
  {
    id: "school",
    place: "Escola",
    placeEn: "School",
    emoji: "🏫",
    color: "mint",
    theme: "material escolar e cores",
    role: "a teacher on the first day at an English school",
    rolePt: "professora da escola",
    character: "Ms. Clarke",
    characterPt: "a professora Clarke",
    missions: ["mostrar seu material", "dizer uma cor", "pedir ajuda"],
    scriptMissions: [0, 1, 2, -1],
    tip: {
      title: "A cor vem antes",
      rule: "Em inglês a cor vem ANTES da coisa: \"a blue pencil\" é \"um lápis azul\".",
      en: "I have a red backpack.",
      pt: "Eu tenho uma mochila vermelha.",
    },
    words: [
      { en: "book", pt: "livro", emoji: "📕" },
      { en: "pencil", pt: "lápis", emoji: "✏️" },
      { en: "notebook", pt: "caderno", emoji: "📓" },
      { en: "teacher", pt: "professor", emoji: "🧑‍🏫" },
      { en: "blue", pt: "azul", emoji: "🔵" },
      { en: "red", pt: "vermelho", emoji: "🔴" },
      { en: "green", pt: "verde", emoji: "🟢" },
      { en: "backpack", pt: "mochila", emoji: "🎒" },
    ],
    phrases: [
      { en: "This is my notebook.", pt: "Este é meu caderno." },
      { en: "My pencil is blue.", pt: "Meu lápis é azul." },
      { en: "Can you help me?", pt: "Você pode me ajudar?" },
      { en: "I do not understand.", pt: "Eu não entendo." },
      { en: "Open your book.", pt: "Abra seu livro." },
      { en: "The teacher is nice.", pt: "A professora é legal." },
    ],
    script: [
      {
        mine: "Welcome to class! Do you have a notebook?",
        options: [
          { en: "Yes, this is my notebook.", ok: true },
          { en: "Yes, I am a notebook.", ok: false },
          { en: "No, coffee please.", ok: false },
        ],
      },
      {
        mine: "Good. What color is your pencil?",
        options: [
          { en: "My pencil is blue.", ok: true },
          { en: "My pencil is hungry.", ok: false },
          { en: "Blue is my name.", ok: false },
        ],
      },
      {
        mine: "Please open your book on page ten.",
        options: [
          { en: "Sorry, I do not understand.", ok: true },
          { en: "Ten is my backpack.", ok: false },
          { en: "Goodbye, book.", ok: false },
        ],
      },
      {
        mine: "No problem! Page ten. I can help you.",
        options: [
          { en: "Thank you, teacher!", ok: true },
          { en: "I am from page ten.", ok: false },
          { en: "Red green blue.", ok: false },
        ],
      },
    ],
  },
  {
    id: "home",
    place: "Casa da família",
    placeEn: "Host family",
    emoji: "🏡",
    color: "pink",
    theme: "família e a casa",
    role: "the host mother of an exchange student",
    rolePt: "mãe da família anfitriã",
    character: "Mrs. Brown",
    characterPt: "a Sra. Brown, mãe da família anfitriã",
    missions: ["falar da sua família", "elogiar a casa", "perguntar do quarto"],
    scriptMissions: [0, 1, -1, 2],
    tip: {
      title: "I have e this is",
      rule: "Use \"I have\" para o que você tem (\"I have one sister\") e \"this is\" para apresentar alguém ou algo (\"this is my dog\").",
      en: "This is my brother. I have one brother.",
      pt: "Este é meu irmão. Eu tenho um irmão.",
    },
    words: [
      { en: "mother", pt: "mãe", emoji: "👩" },
      { en: "father", pt: "pai", emoji: "👨" },
      { en: "brother", pt: "irmão", emoji: "👦" },
      { en: "sister", pt: "irmã", emoji: "👧" },
      { en: "house", pt: "casa", emoji: "🏠" },
      { en: "dog", pt: "cachorro", emoji: "🐶" },
      { en: "bed", pt: "cama", emoji: "🛏️" },
      { en: "kitchen", pt: "cozinha", emoji: "🍳" },
    ],
    phrases: [
      { en: "I have one brother.", pt: "Eu tenho um irmão." },
      { en: "This is my mother.", pt: "Esta é minha mãe." },
      { en: "The dog is in the kitchen.", pt: "O cachorro está na cozinha." },
      { en: "Your house is beautiful.", pt: "Sua casa é linda." },
      { en: "I am tired.", pt: "Estou cansado." },
      { en: "Where is my room?", pt: "Onde fica meu quarto?" },
    ],
    script: [
      {
        mine: "Hi, dear! Welcome to our house. Do you have brothers or sisters?",
        options: [
          { en: "Yes, I have one brother.", ok: true },
          { en: "Yes, I have one kitchen.", ok: false },
          { en: "No, I am a dog.", ok: false },
        ],
      },
      {
        mine: "How nice! This is our dog, Max.",
        options: [
          { en: "Hello, Max! Your house is beautiful.", ok: true },
          { en: "Max is my passport.", ok: false },
          { en: "I would like a bed coffee.", ok: false },
        ],
      },
      {
        mine: "Thank you! Are you tired after the trip?",
        options: [
          { en: "Yes, I am tired.", ok: true },
          { en: "Yes, I am kitchen.", ok: false },
          { en: "No, my mother is blue.", ok: false },
        ],
      },
      {
        mine: "Come, I will show you your room.",
        options: [
          { en: "Thank you! Where is my room?", ok: true },
          { en: "The dog is my father.", ok: false },
          { en: "Goodbye, house.", ok: false },
        ],
      },
    ],
  },
  {
    id: "city",
    place: "Centro da cidade",
    placeEn: "Downtown",
    emoji: "🚌",
    color: "mint",
    theme: "lugares da cidade e direções",
    role: "a helpful person on a London street",
    rolePt: "pessoa na rua",
    character: "Tom",
    characterPt: "o Tom, um morador de Londres",
    missions: ["perguntar onde fica o museu", "perguntar se é longe", "agradecer a ajuda"],
    scriptMissions: [0, 1, 2, -1],
    tip: {
      title: "Perguntando o caminho",
      rule: "\"Where is the...?\" pergunta onde fica algo. Direções: left (esquerda), right (direita), straight ahead (em frente).",
      en: "Where is the bank? Turn right.",
      pt: "Onde fica o banco? Vire à direita.",
    },
    words: [
      { en: "street", pt: "rua", emoji: "🛣️" },
      { en: "bus", pt: "ônibus", emoji: "🚌" },
      { en: "bank", pt: "banco", emoji: "🏦" },
      { en: "hospital", pt: "hospital", emoji: "🏥" },
      { en: "left", pt: "esquerda", emoji: "⬅️" },
      { en: "right", pt: "direita", emoji: "➡️" },
      { en: "map", pt: "mapa", emoji: "🗺️" },
      { en: "museum", pt: "museu", emoji: "🏛️" },
    ],
    phrases: [
      { en: "Where is the museum?", pt: "Onde fica o museu?" },
      { en: "Turn left at the bank.", pt: "Vire à esquerda no banco." },
      { en: "The bus stop is near here.", pt: "O ponto de ônibus fica perto daqui." },
      { en: "Go straight ahead.", pt: "Siga em frente." },
      { en: "I am lost.", pt: "Estou perdido." },
      { en: "Is it far?", pt: "É longe?" },
    ],
    script: [
      {
        mine: "Hi! You look lost. Can I help you?",
        options: [
          { en: "Yes, please. Where is the museum?", ok: true },
          { en: "Yes, I am a museum.", ok: false },
          { en: "No, I am a bus.", ok: false },
        ],
      },
      {
        mine: "Go straight ahead and turn left at the bank.",
        options: [
          { en: "Is it far?", ok: true },
          { en: "The bank is my sister.", ok: false },
          { en: "I would like a left, please.", ok: false },
        ],
      },
      {
        mine: "No, it is near. Five minutes walking.",
        options: [
          { en: "Great! Thank you very much.", ok: true },
          { en: "Five is my street.", ok: false },
          { en: "Goodbye, hospital map.", ok: false },
        ],
      },
      {
        mine: "You are welcome. Enjoy the museum!",
        options: [
          { en: "Thanks! Have a nice day.", ok: true },
          { en: "I am lost my bread.", ok: false },
          { en: "Right left right.", ok: false },
        ],
      },
    ],
  },
  {
    id: "market",
    place: "Feira",
    placeEn: "Market",
    emoji: "🍎",
    color: "yellow",
    theme: "frutas, números e preços",
    role: "a fruit seller at a street market",
    rolePt: "vendedor da feira",
    character: "Mr. Patel",
    characterPt: "o Sr. Patel, vendedor da feira",
    missions: ["pedir uma fruta", "perguntar o preço", "pagar"],
    scriptMissions: [0, 1, -1, 2],
    tip: {
      title: "Quanto custa?",
      rule: "\"How much is...?\" para uma coisa e \"How much are...?\" para várias. O plural quase sempre ganha -s: apple → apples.",
      en: "How much are the apples?",
      pt: "Quanto custam as maçãs?",
    },
    words: [
      { en: "apple", pt: "maçã", emoji: "🍎" },
      { en: "banana", pt: "banana", emoji: "🍌" },
      { en: "orange", pt: "laranja", emoji: "🍊" },
      { en: "grapes", pt: "uvas", emoji: "🍇" },
      { en: "two", pt: "dois", emoji: "2️⃣" },
      { en: "five", pt: "cinco", emoji: "5️⃣" },
      { en: "ten", pt: "dez", emoji: "🔟" },
      { en: "money", pt: "dinheiro", emoji: "💵" },
    ],
    phrases: [
      { en: "How much are the apples?", pt: "Quanto custam as maçãs?" },
      { en: "I want two bananas.", pt: "Eu quero duas bananas." },
      { en: "It is too expensive.", pt: "Está caro demais." },
      { en: "Here is the money.", pt: "Aqui está o dinheiro." },
      { en: "The oranges are fresh.", pt: "As laranjas estão frescas." },
      { en: "Do you have grapes?", pt: "Você tem uvas?" },
    ],
    script: [
      {
        mine: "Fresh fruit! Fresh fruit! What do you want today?",
        options: [
          { en: "I want two bananas, please.", ok: true },
          { en: "I want two hospitals.", ok: false },
          { en: "My name is banana.", ok: false },
        ],
      },
      {
        mine: "Here you are. Anything else?",
        options: [
          { en: "How much are the apples?", ok: true },
          { en: "How old are the apples?", ok: false },
          { en: "Where is my apple room?", ok: false },
        ],
      },
      {
        mine: "The apples are ten pounds a bag.",
        options: [
          { en: "Oh, it is too expensive!", ok: true },
          { en: "Oh, it is too banana!", ok: false },
          { en: "Ten is my mother.", ok: false },
        ],
      },
      {
        mine: "Okay, for you, five pounds!",
        options: [
          { en: "Great! Here is the money.", ok: true },
          { en: "Great! Here is the grapes dog.", ok: false },
          { en: "Goodbye, five.", ok: false },
        ],
      },
    ],
  },
  {
    id: "park",
    place: "Parque",
    placeEn: "Park",
    emoji: "🌳",
    color: "mint",
    theme: "animais, tempo e dias da semana",
    role: "a park ranger who loves animals",
    rolePt: "guarda do parque",
    character: "Ranger Amy",
    characterPt: "a guarda Amy, do parque",
    missions: ["dizer de que animal gosta", "dizer onde está o gato", "falar do tempo"],
    scriptMissions: [0, 1, 2, -1],
    tip: {
      title: "Falando do tempo",
      rule: "Para o tempo use \"It is\": It is sunny (ensolarado), It is cold (frio), It is hot (quente).",
      en: "It is very hot today.",
      pt: "Está muito quente hoje.",
    },
    words: [
      { en: "bird", pt: "pássaro", emoji: "🐦" },
      { en: "cat", pt: "gato", emoji: "🐱" },
      { en: "tree", pt: "árvore", emoji: "🌳" },
      { en: "sun", pt: "sol", emoji: "☀️" },
      { en: "rain", pt: "chuva", emoji: "🌧️" },
      { en: "cold", pt: "frio", emoji: "🥶" },
      { en: "hot", pt: "quente", emoji: "🥵" },
      { en: "Sunday", pt: "domingo", emoji: "📅" },
    ],
    phrases: [
      { en: "It is sunny today.", pt: "Está ensolarado hoje." },
      { en: "I like birds.", pt: "Eu gosto de pássaros." },
      { en: "It is very cold.", pt: "Está muito frio." },
      { en: "The cat is under the tree.", pt: "O gato está debaixo da árvore." },
      { en: "We go to the park on Sunday.", pt: "Nós vamos ao parque no domingo." },
      { en: "Look at the sky!", pt: "Olhe para o céu!" },
    ],
    script: [
      {
        mine: "Good afternoon! It is a beautiful day. Do you like animals?",
        options: [
          { en: "Yes, I like birds.", ok: true },
          { en: "Yes, I like rain coffee.", ok: false },
          { en: "No, I am a tree.", ok: false },
        ],
      },
      {
        mine: "Look! There is a cat. Where is it?",
        options: [
          { en: "The cat is under the tree.", ok: true },
          { en: "The cat is my passport.", ok: false },
          { en: "The cat is Sunday.", ok: false },
        ],
      },
      {
        mine: "Yes! How is the weather in Brazil now?",
        options: [
          { en: "It is very hot.", ok: true },
          { en: "It is very sister.", ok: false },
          { en: "It is my name.", ok: false },
        ],
      },
      {
        mine: "Lucky you! Come back on Sunday for the bird show.",
        options: [
          { en: "Great! I will come on Sunday.", ok: true },
          { en: "Great! I am the bird show.", ok: false },
          { en: "Sunday is cold juice.", ok: false },
        ],
      },
    ],
  },
  {
    id: "party",
    place: "Festa de despedida",
    placeEn: "Goodbye party",
    emoji: "🎉",
    color: "pink",
    theme: "sentimentos, gostos e hobbies",
    role: "a new friend at the farewell party",
    rolePt: "amiga nova na festa",
    character: "Zoe",
    characterPt: "a Zoe, amiga nova da festa",
    missions: ["dizer como se sente", "contar um hobby", "agradecer o presente"],
    scriptMissions: [0, 1, 2, -1],
    tip: {
      title: "Do que você gosta",
      rule: "\"I like to + verbo\" conta o que você gosta de fazer: I like to dance, I like to play soccer.",
      en: "I like to play video games.",
      pt: "Eu gosto de jogar videogame.",
    },
    words: [
      { en: "happy", pt: "feliz", emoji: "😄" },
      { en: "sad", pt: "triste", emoji: "😢" },
      { en: "music", pt: "música", emoji: "🎵" },
      { en: "dance", pt: "dançar", emoji: "💃" },
      { en: "soccer", pt: "futebol", emoji: "⚽" },
      { en: "game", pt: "jogo", emoji: "🎮" },
      { en: "gift", pt: "presente", emoji: "🎁" },
      { en: "photo", pt: "foto", emoji: "📸" },
    ],
    phrases: [
      { en: "I like to play soccer.", pt: "Eu gosto de jogar futebol." },
      { en: "I am happy to be here.", pt: "Estou feliz de estar aqui." },
      { en: "Do you want to dance?", pt: "Você quer dançar?" },
      { en: "This gift is for you.", pt: "Este presente é para você." },
      { en: "I will miss you.", pt: "Vou sentir sua falta." },
      { en: "Let's take a photo!", pt: "Vamos tirar uma foto!" },
    ],
    script: [
      {
        mine: "Hey! Are you happy with your trip?",
        options: [
          { en: "Yes, I am happy to be here.", ok: true },
          { en: "Yes, I am a gift.", ok: false },
          { en: "No, I am soccer.", ok: false },
        ],
      },
      {
        mine: "What do you like to do in your free time?",
        options: [
          { en: "I like to play soccer.", ok: true },
          { en: "I like to play bank.", ok: false },
          { en: "My free time is blue.", ok: false },
        ],
      },
      {
        mine: "Cool! This gift is for you. A souvenir from London!",
        options: [
          { en: "Thank you! I will miss you.", ok: true },
          { en: "Thank you! I am a photo.", ok: false },
          { en: "Goodbye, gift music.", ok: false },
        ],
      },
      {
        mine: "I will miss you too! Let's take a photo!",
        options: [
          { en: "Yes! Let's take a photo!", ok: true },
          { en: "Yes! Let's take a bus dance.", ok: false },
          { en: "I am sad cake.", ok: false },
        ],
      },
    ],
  },
];

/** Cada parada tem três etapas: palavras, frases e a conversa com a Mine. */
export const lessonStages = [
  { stage: 1, id: "palavras", label: "Palavras", hint: "figurinhas, escuta e pronúncia" },
  { stage: 2, id: "frases", label: "Frases", hint: "montar, completar e falar" },
  { stage: 3, id: "conversa", label: "Conversa", hint: "roleplay com a Mine" },
];

export const conversationTurns = 4;

/** Acerto mínimo para a etapa contar como feita e abrir a próxima. */
export const passAccuracy = 0.5;

export function lessonKey(unitId, stage, lang = "en") {
  return `${lang}/${unitId}/${stage}`;
}

/** A trilha inteira em ordem: parada 1 etapas 1-3, parada 2 etapas 1-3… */
export function lessonPath(units = englishUnits) {
  return units.flatMap((unit) => lessonStages.map(({ stage }) => ({ key: lessonKey(unit.id, stage), unitId: unit.id, stage })));
}

/* ───────────────────────────── sorteio ───────────────────────────── */

/** Gerador com semente (mulberry32): a mesma semente monta a mesma lição. */
export function seededRandom(seed) {
  let state = (Number(seed) >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, random) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function pickOthers(pool, exclude, count, random) {
  const seen = new Set([String(exclude).toLowerCase()]);
  const result = [];
  for (const item of shuffle(pool, random)) {
    const key = String(item).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= count) break;
  }
  return result;
}

/** Palavras de uma frase, sem pontuação, preservando "I" e nomes próprios. */
export function sentenceTiles(sentence) {
  return String(sentence || "")
    .replace(/[.,!?;:]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/* ───────────────────────────── montagem ───────────────────────────── */

function wordChoice(mode, word, unit, random) {
  const pool = unit.words;
  if (mode === "significado") {
    const others = pickOthers(pool.map((item) => item.pt), word.pt, 3, random);
    return { kind: "escolha", mode, prompt: word.en, audio: word.en, emoji: "", options: shuffle([word.pt, ...others], random), answer: word.pt, word: word.en };
  }
  const others = pickOthers(pool.map((item) => item.en), word.en, 3, random);
  return {
    kind: "escolha",
    mode,
    prompt: mode === "figurinha" ? word.pt : "",
    emoji: mode === "figurinha" ? word.emoji : "",
    audio: word.en,
    options: shuffle([word.en, ...others], random),
    answer: word.en,
    word: word.en,
  };
}

function buildTiles(mode, phrase, unit, random) {
  const answer = sentenceTiles(phrase.en);
  const answerSet = new Set(answer.map((item) => item.toLowerCase()));
  const extra = unit.phrases
    .filter((item) => item.en !== phrase.en)
    .flatMap((item) => sentenceTiles(item.en))
    .filter((item) => !answerSet.has(item.toLowerCase()));
  const distractors = pickOthers(extra, "", Math.min(3, extra.length), random);
  return {
    kind: "monte",
    mode,
    prompt: mode === "traduza" ? phrase.pt : "",
    audio: phrase.en,
    tiles: shuffle([...answer, ...distractors], random),
    answer,
    word: phrase.en,
  };
}

/** Frase com uma palavra da parada no lugar do buraco. */
function buildComplete(phrase, unit, random) {
  const tiles = sentenceTiles(phrase.en);
  const vocab = new Set(unit.words.map((item) => item.en.toLowerCase()));
  // prefere tirar uma palavra do vocabulário; se a frase não tem, a mais longa
  const candidates = tiles.filter((tile) => vocab.has(tile.toLowerCase()));
  const target = candidates.length ? candidates[Math.floor(random() * candidates.length)] : [...tiles].sort((a, b) => b.length - a.length)[0];
  const blanked = phrase.en.replace(new RegExp(`\\b${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`), "___");
  const others = pickOthers(
    unit.words.map((item) => item.en).filter((item) => !item.includes(" ")),
    target,
    3,
    random,
  );
  return { kind: "escolha", mode: "complete", prompt: blanked, hint: phrase.pt, audio: phrase.en, emoji: "", options: shuffle([target, ...others], random), answer: target, word: phrase.en };
}

function buildPairs(items, random) {
  const pairs = items.slice(0, 4).map((item) => ({ en: item.en, pt: item.pt }));
  return { kind: "pares", pairs, left: shuffle(pairs.map((item) => item.en), random), right: shuffle(pairs.map((item) => item.pt), random), word: "" };
}

function buildTyping(word) {
  return { kind: "digite", prompt: word.pt, emoji: word.emoji, answer: word.en, word: word.en };
}

function buildSpeak(item) {
  return { kind: "fale", text: item.en, pt: item.pt, word: item.en };
}

/** Ditado: ouve a frase e escreve. Mais difícil que montar com peças. */
function buildDictation(phrase) {
  return { kind: "digite", mode: "ditado", prompt: phrase.pt, emoji: "", audio: phrase.en, answer: phrase.en, word: phrase.en };
}

/** Cartões de apresentação: a Mine ensina as palavras antes de cobrar. */
function buildLearn(words) {
  return { kind: "aprenda", words: words.map((item) => ({ en: item.en, pt: item.pt, emoji: item.emoji })), word: "" };
}

/** Dica de gramática da parada, com duas frases-modelo para ouvir. */
function buildTip(unit, phrases) {
  return { kind: "dica", title: unit.tip.title, rule: unit.tip.rule, en: unit.tip.en, pt: unit.tip.pt, phrases: phrases.map((item) => ({ en: item.en, pt: item.pt })), word: "" };
}

function joinSentence(tiles, original) {
  const end = String(original).trim().match(/[.?!]$/)?.[0] || "";
  const text = tiles.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1) + end;
}

/**
 * Frases erradas que parecem certas, para "Qual frase está certa?": duas
 * palavras trocadas de lugar e uma palavra trocada por outra da parada. São
 * os erros que um brasileiro comete de verdade (ordem e escolha de palavra).
 */
export function sentenceDistractors(phrase, unit, random) {
  const tiles = sentenceTiles(phrase.en);
  const right = normalizeAnswer(phrase.en);
  const found = [];
  const add = (candidate) => {
    const key = normalizeAnswer(candidate);
    if (key && key !== right && !found.some((item) => normalizeAnswer(item) === key)) found.push(candidate);
  };
  if (tiles.length >= 3) {
    const at = 1 + Math.floor(random() * (tiles.length - 2));
    const swapped = [...tiles];
    [swapped[at - 1], swapped[at]] = [swapped[at], swapped[at - 1]];
    add(joinSentence(swapped, phrase.en));
  }
  const verbs = { am: "is", is: "are", are: "am", do: "does", have: "has" };
  const verbAt = tiles.findIndex((tile) => verbs[tile.toLowerCase()]);
  if (verbAt >= 0) {
    const changed = [...tiles];
    changed[verbAt] = verbs[tiles[verbAt].toLowerCase()];
    add(joinSentence(changed, phrase.en));
  }
  const vocab = unit.words.map((item) => item.en).filter((item) => !item.includes(" "));
  const wordAt = tiles.findIndex((tile) => vocab.some((item) => item.toLowerCase() === tile.toLowerCase()));
  const target = wordAt >= 0 ? wordAt : tiles.length - 1;
  for (const other of shuffle(vocab, random)) {
    if (found.length >= 2) break;
    if (other.toLowerCase() === String(tiles[target]).toLowerCase()) continue;
    const changed = [...tiles];
    changed[target] = other;
    add(joinSentence(changed, phrase.en));
  }
  return found.slice(0, 2);
}

function buildChooseSentence(phrase, unit, random) {
  const options = shuffle([phrase.en, ...sentenceDistractors(phrase, unit, random)], random);
  return { kind: "escolha", mode: "qual", prompt: phrase.pt, emoji: "", audio: phrase.en, options, answer: phrase.en, word: phrase.en };
}

/** Itens que não valem nota: só ensinam. */
export function isTeaching(exercise) {
  return exercise?.kind === "aprenda" || exercise?.kind === "dica";
}

/**
 * Monta uma lição: 8 exercícios valendo nota, com cartões de ensino antes.
 * Palavras: a Mine apresenta 4 palavras, cobra, apresenta mais 4, cobra.
 * Frases: dica de gramática da parada e depois as frases.
 * `review` são palavras grifadas (erradas antes) — entram primeiro.
 */
export function buildLesson(unit, stage, seed = Date.now(), review = []) {
  const random = seededRandom(seed);
  const reviewSet = new Set((review || []).map((item) => String(item).toLowerCase()));
  const prioritized = (list) => {
    const mixed = shuffle(list, random);
    return [...mixed.filter((item) => reviewSet.has(item.en.toLowerCase())), ...mixed.filter((item) => !reviewSet.has(item.en.toLowerCase()))];
  };

  if (Number(stage) === 1) {
    const words = prioritized(unit.words);
    const at = (index) => words[index % words.length];
    const first = [at(0), at(1), at(2), at(3)];
    const second = [at(4), at(5), at(6), at(7)];
    return [
      buildLearn(first),
      wordChoice("figurinha", first[0], unit, random),
      wordChoice("escuta", first[1], unit, random),
      wordChoice("significado", first[2], unit, random),
      buildPairs(shuffle(first, random), random),
      buildLearn(second),
      wordChoice("figurinha", second[0], unit, random),
      wordChoice("escuta", second[1], unit, random),
      buildTyping(second[2]),
      buildSpeak(second[3]),
    ];
  }

  const phrases = prioritized(unit.phrases);
  const at = (index) => phrases[index % phrases.length];
  return [
    buildTip(unit, [at(0), at(2)]),
    buildTiles("traduza", at(0), unit, random),
    buildComplete(at(1), unit, random),
    buildChooseSentence(at(2), unit, random),
    buildTiles("monte", at(3), unit, random),
    buildDictation(at(4)),
    buildTiles("traduza", at(5), unit, random),
    buildPairs(shuffle(unit.words, random), random),
    buildSpeak(at(0)),
  ];
}

/**
 * Revisão grifada: palavras erradas em qualquer parada, misturadas. Precisa
 * de pelo menos 4 para valer a pena.
 */
export function buildReviewLesson(missed, seed = Date.now(), units = englishUnits) {
  const random = seededRandom(seed);
  const all = units.flatMap((unit) => unit.words.map((word) => ({ word, unit })));
  const wanted = new Set((missed || []).map((item) => String(item).toLowerCase()));
  const chosen = shuffle(all.filter(({ word }) => wanted.has(word.en.toLowerCase())), random).slice(0, 8);
  if (chosen.length < 4) return [];
  const modes = ["figurinha", "escuta", "digite", "significado", "figurinha", "fale", "escuta", "digite"];
  return chosen.map(({ word, unit }, index) => {
    const mode = modes[index % modes.length];
    if (mode === "digite") return buildTyping(word);
    if (mode === "fale") return buildSpeak(word);
    return wordChoice(mode, word, unit, random);
  });
}

/* ───────────────────────────── correção ───────────────────────────── */

const contractions = [
  [/\bi'm\b/g, "i am"],
  [/\byou're\b/g, "you are"],
  [/\bit's\b/g, "it is"],
  [/\bhe's\b/g, "he is"],
  [/\bshe's\b/g, "she is"],
  [/\bwe're\b/g, "we are"],
  [/\bthey're\b/g, "they are"],
  [/\blet's\b/g, "let us"],
  [/\bdon't\b/g, "do not"],
  [/\bdoesn't\b/g, "does not"],
  [/\bcan't\b/g, "can not"],
  [/\bcannot\b/g, "can not"],
  [/\bisn't\b/g, "is not"],
  [/\baren't\b/g, "are not"],
  [/\bi'll\b/g, "i will"],
  [/\bwhere's\b/g, "where is"],
  [/\bwhat's\b/g, "what is"],
];

/** Minúsculas, sem pontuação e sem contração: "I'm fine!" = "i am fine". */
export function normalizeAnswer(text) {
  let value = String(text || "")
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  for (const [pattern, replacement] of contractions) value = value.replace(pattern, replacement);
  return value
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Distância de edição (Levenshtein), para aceitar um erro de digitação. */
export function editDistance(a, b) {
  const left = String(a);
  const right = String(b);
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[right.length];
}

/**
 * Resposta digitada: igual = certo; uma letra fora em palavra de 4+ letras
 * (duas em 8+, três numa frase de ditado de 20+) = quase, que conta como
 * acerto com a grafia corrigida.
 */
export function gradeTyped(expected, given) {
  const want = normalizeAnswer(expected);
  const got = normalizeAnswer(given);
  if (!got) return "errado";
  if (want === got) return "certo";
  const allowed = want.length >= 20 ? 3 : want.length >= 8 ? 2 : want.length >= 4 ? 1 : 0;
  return editDistance(want, got) <= allowed ? "quase" : "errado";
}

/**
 * Quanto do que o reconhecimento de voz ouviu bate com a frase, de 0 a 1.
 * Conta palavras na ordem (maior subsequência comum), porque o reconhecedor
 * às vezes junta ou separa palavras e a ordem importa mais que a grafia.
 */
export function speechScore(expected, heard) {
  const want = normalizeAnswer(expected).split(" ").filter(Boolean);
  const got = normalizeAnswer(heard).split(" ").filter(Boolean);
  if (!want.length || !got.length) return 0;
  const table = Array.from({ length: want.length + 1 }, () => new Array(got.length + 1).fill(0));
  for (let i = 1; i <= want.length; i += 1) {
    for (let j = 1; j <= got.length; j += 1) {
      const same = want[i - 1] === got[j - 1] || (want[i - 1].length > 3 && editDistance(want[i - 1], got[j - 1]) <= 1);
      table[i][j] = same ? table[i - 1][j - 1] + 1 : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }
  const common = table[want.length][got.length];
  // dividir pelo maior lado pune quem fala palavras a mais
  return common / Math.max(want.length, got.length);
}

export function gradeSpeech(expected, heard) {
  const score = speechScore(expected, heard);
  if (score >= 0.8) return "certo";
  if (score >= 0.5) return "quase";
  return "errado";
}

/**
 * Corrige qualquer exercício. `value` depende do tipo:
 * escolha → opção escolhida; monte → lista de peças na ordem; digite → texto;
 * fale → o que o reconhecedor ouviu; pares → quantos erros a pessoa cometeu.
 */
export function checkExercise(exercise, value) {
  if (!exercise || isTeaching(exercise)) return { result: "errado", expected: "" };
  if (exercise.kind === "escolha") {
    return { result: String(value) === exercise.answer ? "certo" : "errado", expected: exercise.answer };
  }
  if (exercise.kind === "monte") {
    const expected = exercise.answer.join(" ");
    const given = Array.isArray(value) ? value.join(" ") : String(value || "");
    return { result: normalizeAnswer(given) === normalizeAnswer(expected) ? "certo" : "errado", expected: exercise.audio || expected };
  }
  if (exercise.kind === "digite") return { result: gradeTyped(exercise.answer, value), expected: exercise.answer };
  if (exercise.kind === "fale") return { result: gradeSpeech(exercise.text, value), expected: exercise.text };
  if (exercise.kind === "pares") {
    const mistakes = Math.max(0, Math.floor(Number(value) || 0));
    return { result: mistakes === 0 ? "certo" : mistakes === 1 ? "quase" : "errado", expected: exercise.pairs.map((item) => `${item.en} = ${item.pt}`).join(" · ") };
  }
  return { result: "errado", expected: "" };
}

export function countsAsRight(result) {
  return result === "certo" || result === "quase";
}

/* ───────────────────────────── conversa ───────────────────────────── */

function field(text, name) {
  // aceita "MINE:", "**MINE:**" e "**MINE**:" — o modelo às vezes negrita o rótulo
  const match = String(text || "").match(new RegExp(`^\\s*\\**\\s*${name}\\s*\\**\\s*:\\s*\\**\\s*(.+)$`, "im"));
  return match ? match[1].trim().replace(/^["“]|["”]$/g, "").trim() : "";
}

/**
 * Lê a fala da Mine no roleplay. O formato vem de mine/prompts.mjs
 * (buildLanguageChatInstruction):
 *   MINE: fala em inglês
 *   CORRECAO: versão corrigida da fala do aluno, ou OK
 *   DICA: dica curta em português
 *   NOTA: 0, 1 ou 2
 *   MISSOES: números das missões já cumpridas (ex.: 1, 3) ou 0
 *   TRADUCAO: a fala da Mine em português
 *   SUGESTOES: a | b | c
 * Devolve null quando não há fala nenhuma — aí a tela cai no roteiro.
 */
export function parseConversationReply(text) {
  const raw = String(text || "").replace(/\r/g, "");
  let mine = field(raw, "MINE");
  if (!mine) {
    // modelo que esqueceu os rótulos: a primeira linha com texto vira a fala
    const first = raw
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !/^\**\s*(CORRE[CÇ][AÃ]O|DICA|NOTA|SUGEST[OÕ]ES|MISS[OÕ]ES|TRADU[CÇ][AÃ]O)\s*\**\s*:/i.test(line));
    mine = first || "";
  }
  if (!mine) return null;
  const correctionRaw = field(raw, "CORRE[CÇ][AÃ]O");
  const correction = /^(ok|okay|nenhuma|-|—)\.?$/i.test(correctionRaw) ? "" : correctionRaw;
  const scoreMatch = field(raw, "NOTA").match(/[0-2]/);
  const score = scoreMatch ? Number(scoreMatch[0]) : correction ? 1 : 2;
  const suggestions = field(raw, "SUGEST[OÕ]ES")
    .split("|")
    .map((item) => item.trim().replace(/^["“]|["”]$/g, "").trim())
    .filter((item) => item.length > 1 && item.length <= 80)
    .slice(0, 3);
  // missões vêm numeradas a partir de 1; viram índices 0, 1, 2
  const missions = [...new Set((field(raw, "MISS[OÕ]ES").match(/[1-9]/g) || []).map((item) => Number(item) - 1))].sort((a, b) => a - b);
  return {
    mine: mine.slice(0, 280),
    correction: correction.slice(0, 200),
    tip: field(raw, "DICA").slice(0, 240),
    score,
    suggestions,
    missions,
    translation: field(raw, "TRADU[CÇ][AÃ]O").slice(0, 280),
  };
}

/** Contexto enviado à Mine para o roleplay de uma parada. */
export function conversationContext(unit, level, studentName = "") {
  return [
    `Cenario: intercambio em Londres, parada "${unit.placeEn}" (${unit.place}).`,
    `Seu personagem: ${unit.character}, ${unit.role}. Apresente-se pelo nome na primeira fala.`,
    studentName ? `Nome do estudante: ${studentName}. Use o nome dele de vez em quando, com naturalidade.` : "",
    `Tema da parada: ${unit.theme}.`,
    `Nivel do estudante: ${level.code} (${level.label}).`,
    `Palavras da parada: ${unit.words.map((item) => item.en).join(", ")}.`,
    `Frases modelo: ${unit.phrases.map((item) => item.en).join(" / ")}.`,
    `Missoes do estudante nesta cena (conduza a conversa para que ele consiga cumprir cada uma): ${unit.missions.map((item, index) => `${index + 1}. ${item}`).join("; ")}.`,
    `Ponto de gramatica da parada: ${unit.tip.rule}`,
    `A conversa tem ${conversationTurns} falas do estudante.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/* ───────────────────────────── progresso ───────────────────────────── */

/** As palavras com figurinha (frases ficam de fora da contagem e da revisão). */
export function vocabulary(units = englishUnits) {
  return new Set(units.flatMap((unit) => unit.words.map((word) => word.en.toLowerCase())));
}

function langSessions(sessions, lang = "en") {
  return (Array.isArray(sessions) ? sessions : []).filter((item) => item?.kind === "Idiomas" && (item.lang || "en") === lang);
}

export function starsFor(accuracy) {
  const value = Number(accuracy) || 0;
  if (value >= 0.999) return 3;
  if (value >= 0.8) return 2;
  if (value >= passAccuracy) return 1;
  return 0;
}

/**
 * Progresso da trilha a partir das sessões salvas: melhor resultado de cada
 * etapa, quais estão abertas e qual é a próxima. Nada fica guardado à parte —
 * o que vale é o histórico, como no resto do site.
 */
export function languageProgress(sessions, units = englishUnits, lang = "en") {
  const path = lessonPath(units);
  const own = langSessions(sessions, lang);
  const best = {};
  for (const item of own) {
    if (!item.lessonKey) continue;
    const accuracy = Number(item.accuracy) || 0;
    if (!best[item.lessonKey] || accuracy > best[item.lessonKey].accuracy) best[item.lessonKey] = { accuracy, stars: starsFor(accuracy) };
  }
  const done = new Set(path.filter((step) => (best[step.key]?.accuracy || 0) >= passAccuracy).map((step) => step.key));
  const unlocked = new Set();
  path.forEach((step, index) => {
    if (index === 0 || done.has(path[index - 1].key) || done.has(step.key)) unlocked.add(step.key);
  });
  const next = path.find((step) => unlocked.has(step.key) && !done.has(step.key)) || null;
  const stamps = units.filter((unit) => lessonStages.every(({ stage }) => done.has(lessonKey(unit.id, stage, lang)))).map((unit) => unit.id);
  const totals = own.reduce(
    (sum, item) => ({
      lessons: sum.lessons + 1,
      correct: sum.correct + (Number(item.correctAnswers) || 0),
      answered: sum.answered + (Number(item.questionsAnswered) || 0),
      spoke: sum.spoke + (Number(item.spoke) || 0),
      xp: sum.xp + (Number(item.xpEarned) || 0),
    }),
    { lessons: 0, correct: 0, answered: 0, spoke: 0, xp: 0 },
  );
  const vocab = vocabulary(units);
  const learned = new Set(
    own
      .flatMap((item) => (Array.isArray(item.wordsRight) ? item.wordsRight : []))
      .map((item) => String(item).toLowerCase())
      .filter((item) => vocab.has(item)),
  );
  return { path, best, done, unlocked, next, stamps, totals, learnedWords: learned.size, level: languageLevel(done.size), ...languageStreak(own) };
}

function dayIndex(timestamp) {
  const date = new Date(Number(timestamp) || 0);
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / 86400000);
}

/**
 * Ofensiva da aba: dias seguidos com pelo menos uma lição. Hoje ainda sem
 * lição não quebra a sequência de ontem (o dia não acabou) — como no Duolingo.
 */
export function languageStreak(sessions, now = Date.now()) {
  const days = new Set((Array.isArray(sessions) ? sessions : []).filter((item) => item?.kind === "Idiomas").map((item) => dayIndex(item.createdAt)));
  const today = dayIndex(now);
  const todayLessons = (Array.isArray(sessions) ? sessions : []).filter((item) => item?.kind === "Idiomas" && dayIndex(item.createdAt) === today).length;
  let cursor = days.has(today) ? today : today - 1;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return { streak, todayLessons };
}

/** Nível pelo número de etapas feitas. São 24 na trilha de inglês. */
export function languageLevel(doneCount) {
  const count = Number(doneCount) || 0;
  if (count >= 18) return { code: "A2", label: "Já se vira na viagem" };
  if (count >= 9) return { code: "A1+", label: "Conversando no básico" };
  if (count >= 3) return { code: "A1", label: "Primeiras frases" };
  return { code: "Pré-A1", label: "Primeiros passos" };
}

/**
 * Palavras grifadas para revisar: erradas em alguma sessão e não acertadas
 * numa sessão posterior. Ordem: o erro mais recente primeiro.
 */
export function wordsToReview(sessions, lang = "en", units = englishUnits) {
  const vocab = vocabulary(units);
  const ordered = [...langSessions(sessions, lang)].sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
  const state = new Map();
  for (const item of ordered) {
    for (const word of Array.isArray(item.wordsMissed) ? item.wordsMissed : []) state.set(String(word).toLowerCase(), Number(item.createdAt) || 0);
    for (const word of Array.isArray(item.wordsRight) ? item.wordsRight : []) {
      const key = String(word).toLowerCase();
      if ((Array.isArray(item.wordsMissed) ? item.wordsMissed : []).some((missed) => String(missed).toLowerCase() === key)) continue;
      state.delete(key);
    }
  }
  return [...state.entries()]
    .filter(([word]) => vocab.has(word))
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
}

/** Resultado final de uma lição: o que vai para a sessão salva. */
export function lessonResult(outcomes) {
  // a repetição de um erro (no fim da lição) ajuda a aprender, mas a nota é a
  // da primeira tentativa: refazer não pode apagar o erro do histórico
  const list = Array.isArray(outcomes) ? outcomes.filter((item) => item && item.result !== "pulou" && !item.retry) : [];
  const correct = list.filter((item) => countsAsRight(item.result)).length;
  const total = list.length;
  const accuracy = total ? correct / total : 0;
  const words = (filter) => [...new Set(list.filter(filter).map((item) => item.word).filter(Boolean))];
  return {
    correct,
    total,
    accuracy,
    stars: starsFor(accuracy),
    xp: lessonXp(correct, total),
    wordsRight: words((item) => countsAsRight(item.result)),
    wordsMissed: words((item) => !countsAsRight(item.result)),
    spoke: list.filter((item) => item.kind === "fale" && countsAsRight(item.result)).length,
  };
}

/** Palavra do dia: a mesma para todo mundo no mesmo dia. */
export function wordOfTheDay(now = Date.now(), units = englishUnits) {
  const all = units.flatMap((unit) => unit.words.map((word) => ({ ...word, unitId: unit.id })));
  const day = Math.floor((Number(now) - new Date(Number(now)).getTimezoneOffset() * 60000) / 86400000);
  return all[((day % all.length) + all.length) % all.length];
}
