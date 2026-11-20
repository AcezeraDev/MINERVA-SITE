// Fonte unica de verdade do modelo da Mine.
//
// Set/2026: a Mine deixou de ter niveis escolhiveis (Terra/Lua/Sol/SuperNova/
// Verso). Existe UM modelo principal, servido pela NanoGPT, e o usuario so ve
// "Mine". Os IDs tecnicos vivem aqui e nunca chegam ao navegador, entao trocar
// de modelo e so mudar a variavel de ambiente.

function envModel(name, fallback) {
  return String(process.env[name] || fallback).trim();
}

function envEffort(name, fallback) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  return ["none", "minimal", "low", "medium", "high", "xhigh"].includes(value) ? value : fallback;
}

// Os modelos da Anthropic na NanoGPT so aceitam low/medium/high/xhigh/max:
// "none" e "minimal" (validos na OpenAI) viram "low" em vez de erro 400.
function effortFor(modelId, effort) {
  if (/^anthropic\//i.test(modelId) && (effort === "none" || effort === "minimal")) return "low";
  // GLM na NanoGPT: so low/high/max.
  if (/^z-ai\/glm/i.test(modelId)) return ["high", "xhigh"].includes(effort) ? "high" : effort === "max" ? "max" : "low";
  return effort;
}

const CAPABILITIES = { text: true, image: true, video: false, audio: false, pdf: true, tools: true, reasoning: true };

/**
 * Modelo principal: responde o chat.
 *
 * Nov/2026: trocou do openai/gpt-6-luna para o Claude Haiku 5.5. Mesmo preco
 * na NanoGPT (US$ 0,10/0,50 por milhao), le imagem e PDF, chama ferramentas, e
 * escreve melhor os blocos visuais do chat (grafico, SVG, tabela, pagina).
 * Acima de 100 mil tokens de contexto o preco sobe 5x: o historico ja e cortado
 * bem antes disso (messages.mjs).
 */
export const MINE_MODEL = {
  alias: "mine",
  displayName: "Mine",
  provider: "nanogpt",
  get providerModel() {
    return envModel("NANOGPT_MODEL", "anthropic/claude-haiku-5.5");
  },
  get providerParams() {
    return { reasoning_effort: effortFor(this.providerModel, envEffort("MINE_REASONING_EFFORT", "medium")) };
  },
  capabilities: CAPABILITIES,
};

/**
 * Modelo de codigo: sites, jogos, programas e ajustes no codigo que a Mine
 * acabou de mandar (deteccao em shared/code-intent.mjs).
 *
 * Nov/2026: GLM-5.3 Flash (z-ai/glm-5.3-flash) na NanoGPT, US$ 0,10/0,30 por
 * milhao, feito para codigo, le imagem (print de um site) e tem 1M de
 * contexto. Mais barato que o Haiku do chat. Nao le PDF: com PDF anexado o
 * texto extraido continua indo como texto. Se ele falhar antes de escrever,
 * a resposta cai para o modelo principal.
 */
export const MINE_CODE_MODEL = {
  alias: "mine",
  displayName: "Mine",
  provider: "nanogpt",
  get providerModel() {
    return envModel("NANOGPT_CODE_MODEL", "z-ai/glm-5.3-flash");
  },
  get providerParams() {
    return { reasoning_effort: effortFor(this.providerModel, envEffort("MINE_CODE_REASONING_EFFORT", "low")) };
  },
  capabilities: { ...CAPABILITIES, pdf: false },
};

/**
 * Mesmo modelo principal com raciocinio curto, para simulado, mapa mental,
 * flashcards e plano. Essas tarefas tem formato rigido e precisam caber no
 * corte de 60 s da Vercel; raciocinio longo so as deixava lentas.
 */
export const MINE_TASK_MODEL = {
  ...MINE_MODEL,
  get providerModel() {
    return MINE_MODEL.providerModel;
  },
  get providerParams() {
    return { reasoning_effort: effortFor(MINE_MODEL.providerModel, envEffort("MINE_TASK_REASONING_EFFORT", "low")) };
  },
};


/**
 * Reserva interna, nunca escolhivel: entra quando o principal falha e abre os
 * jogos, que precisam de uma rodada em poucos segundos. Para o usuario a
 * resposta continua sendo "da Mine".
 */
export const MINE_FAST_MODEL = {
  alias: "mine",
  displayName: "Mine",
  provider: "nanogpt",
  get providerModel() {
    return envModel("NANOGPT_FAST_MODEL", "openai/gpt-5.4-mini");
  },
  providerParams: { reasoning_effort: "low" },
  capabilities: CAPABILITIES,
};
