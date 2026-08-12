// Fonte unica de verdade dos modelos da Mine.
//
// O frontend so conhece os alias (terra, lua, sol, supernova, verso). Os IDs
// tecnicos vivem aqui e nunca chegam ao navegador, entao trocar de provedor ou
// de modelo nao exige mexer na interface.
//
// Os IDs abaixo foram conferidos em 2026-08-07 na API do OpenRouter
// (GET /api/v1/models) e medidos com um prompt real de tutoria em portugues.
// Latencias sao a mediana observada nesse teste; os campos existem para o
// roteador decidir sem chutar.

// Os nemotron-3 sao hibridos de raciocinio e as vezes despejam o monologo
// interno em ingles dentro do texto da resposta ("Okay, the user just said...").
// Medido em 2026-08-07: sem parametro vazou em 1 de 3 respostas curtas;
// `reasoning.exclude` nao resolveu (so tira o campo separado, nao o texto
// embutido); `reasoning.enabled: false` zerou o vazamento. Num teste de 3
// problemas de raciocinio o acerto ficou igual (3/3 nos dois modos), entao o
// custo de desligar nao apareceu — e um estudante vendo raciocinio em ingles
// percebe na hora. Amostra pequena: se aparecer queda em conta dificil, rever.
const NO_INNER_MONOLOGUE = { reasoning: { enabled: false } };

export const MINE_MODELS = {
  terra: {
    alias: "terra",
    displayName: "Mine Terra",
    tagline: "Rápido e eficiente",
    description: "Ideal para tarefas do dia a dia.",
    tier: 1,
    provider: "openrouter",
    providerModel: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    providerParams: NO_INNER_MONOLOGUE,
    contextTokens: 256_000,
    latencyMs: 4_400,
    capabilities: { text: true, image: true, video: true, audio: true, pdf: true, tools: true, reasoning: true },
  },
  lua: {
    alias: "lua",
    displayName: "Mine Lua",
    tagline: "Inteligente e versátil",
    description: "Ótimo para estudos, escrita e programação.",
    tier: 2,
    provider: "openrouter",
    providerModel: "google/gemma-4-26b-a4b-it:free",
    contextTokens: 262_144,
    latencyMs: 21_700,
    capabilities: { text: true, image: true, video: true, audio: false, pdf: true, tools: true, reasoning: false },
  },
  sol: {
    alias: "sol",
    displayName: "Mine Sol",
    tagline: "Inteligência avançada",
    description: "Mais capacidade para raciocínio e conteúdo multimodal.",
    tier: 3,
    provider: "openrouter",
    providerModel: "google/gemma-4-31b-it:free",
    contextTokens: 262_144,
    latencyMs: 21_300,
    capabilities: { text: true, image: true, video: true, audio: false, pdf: true, tools: true, reasoning: false },
  },
  supernova: {
    alias: "supernova",
    displayName: "Mine SuperNova",
    tagline: "Raciocínio avançado",
    description: "Para problemas e projetos complexos.",
    tier: 4,
    provider: "openrouter",
    providerModel: "nvidia/nemotron-3-super-120b-a12b:free",
    providerParams: NO_INNER_MONOLOGUE,
    contextTokens: 262_144,
    latencyMs: 11_200,
    capabilities: { text: true, image: false, video: false, audio: false, pdf: true, tools: true, reasoning: true },
  },
  verso: {
    alias: "verso",
    displayName: "Mine Verso",
    tagline: "Máxima inteligência",
    description: "O modelo mais poderoso da família Mine.",
    tier: 5,
    provider: "openrouter",
    providerModel: "nvidia/nemotron-3-ultra-550b-a55b:free",
    providerParams: NO_INNER_MONOLOGUE,
    contextTokens: 1_000_000,
    latencyMs: 22_300,
    capabilities: { text: true, image: false, video: false, audio: false, pdf: true, tools: true, reasoning: true },
  },
};

export const MINE_ALIASES = Object.keys(MINE_MODELS);

// Nivel usado no chat quando o pedido nao traz alias (chamadas antigas e o
// primeiro acesso de quem nunca escolheu nada).
export const DEFAULT_MINE_ALIAS = "lua";

// Simulado, mapa mental, flashcards e plano nao tem seletor na tela e exigem
// formato rigido (P:/CORRETA:, RAMO:, F:/V:, DIA n |). Medido em 2026-08-07:
// pelo nivel padrao o simulado levou 47s — perigoso perto do corte de 60s da
// Vercel; por este nivel caiu para 11,6s com o formato intacto nas 4 tarefas.
// Vale por ser text-only: nenhuma dessas tarefas manda imagem.
export const TASK_DEFAULT_ALIAS = "supernova";

// Modelo auxiliar de visao: entra quando o nivel escolhido nao le imagem.
// O usuario continua vendo o nome que escolheu (documento, secao 8).
export const VISION_AUX_ALIAS = "terra";

// Cadeia de fallback quando um nivel falha. Prioriza manter qualidade parecida
// antes de descer de nivel (documento, secao 19).
export const MINE_FALLBACKS = {
  terra: ["lua", "supernova"],
  lua: ["sol", "terra"],
  sol: ["lua", "supernova"],
  supernova: ["verso", "sol"],
  verso: ["supernova", "sol"],
};

// Provedores independentes. Eles nao aparecem como niveis na interface: entram
// somente quando a familia principal do OpenRouter falha ou fica sem cota.
// Manter provedores diferentes e mais importante do que empilhar modelos sob a
// mesma chave, pois uma cota esgotada afeta todos os modelos daquela conta.
export const RESILIENCE_MODELS = [
  {
    alias: "reserva-gemini",
    displayName: "Mine",
    provider: "gemini",
    get providerModel() {
      return String(process.env.MINE_GEMINI_MODEL || "gemini-3.6-flash").trim();
    },
    contextTokens: 1_000_000,
    latencyMs: 8_000,
    capabilities: { text: true, image: true, video: false, audio: false, pdf: true, tools: true, reasoning: true },
  },
  {
    alias: "reserva-groq",
    displayName: "Mine",
    provider: "groq",
    get providerModel() {
      return String(process.env.MINE_GROQ_MODEL || "openai/gpt-oss-120b").trim();
    },
    providerParams: { reasoning_effort: "medium", reasoning_format: "hidden" },
    contextTokens: 131_072,
    latencyMs: 5_000,
    capabilities: { text: true, image: false, video: false, audio: false, pdf: true, tools: true, reasoning: true },
  },
];

// Ultimo recurso: a chave NVIDIA que o Minerva ja usava antes do OpenRouter.
// Fica fora da familia Mine porque nao e um nivel escolhivel, e sim uma rede de
// seguranca quando o OpenRouter inteiro esta indisponivel ou sem cota.
export const EMERGENCY_MODEL = {
  alias: "emergencia",
  displayName: "Mine",
  provider: "nvidia",
  get providerModel() {
    return String(process.env.NVIDIA_MODEL || "nvidia/nemotron-nano-12b-v2-vl").trim();
  },
  contextTokens: 128_000,
  latencyMs: 21_000,
  capabilities: { text: true, image: true, video: false, audio: false, pdf: true, tools: false, reasoning: false },
};

export function isMineAlias(value) {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(MINE_MODELS, value);
}

// Nunca aceita providerModel vindo do cliente: so alias da allowlist
// (documento, secao 39).
export function resolveMineModel(alias) {
  if (isMineAlias(alias)) return MINE_MODELS[alias];
  return MINE_MODELS[DEFAULT_MINE_ALIAS];
}

// O catalogo que o frontend pode ver: nomes de marca, sem ID tecnico.
export function publicModelCatalog() {
  return MINE_ALIASES.map((alias) => {
    const model = MINE_MODELS[alias];
    return {
      id: model.alias,
      name: model.displayName,
      tagline: model.tagline,
      description: model.description,
      tier: model.tier,
      supportsImage: model.capabilities.image,
    };
  });
}
