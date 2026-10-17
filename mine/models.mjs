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

const CAPABILITIES = { text: true, image: true, video: false, audio: false, pdf: true, tools: true, reasoning: true };

/** Modelo principal: responde o chat. */
export const MINE_MODEL = {
  alias: "mine",
  displayName: "Mine",
  provider: "nanogpt",
  get providerModel() {
    return envModel("NANOGPT_MODEL", "openai/gpt-6-luna");
  },
  get providerParams() {
    return { reasoning_effort: envEffort("MINE_REASONING_EFFORT", "medium") };
  },
  capabilities: CAPABILITIES,
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
    return { reasoning_effort: envEffort("MINE_TASK_REASONING_EFFORT", "low") };
  },
};

/**
 * Out/2026: o MineCode tem modelo proprio, feito para programar. GLM-5.3 Flash
 * custa US$ 0,10/0,30 por milhao (entrada/saida), abaixo do principal na
 * saida, que e quase todo o custo de gerar codigo. Ele so aceita raciocinio
 * low/high/max. Se falhar, o principal assume.
 */
export const MINE_CODE_MODEL = {
  alias: "mine",
  displayName: "Mine",
  provider: "nanogpt",
  get providerModel() {
    return envModel("NANOGPT_CODE_MODEL", "z-ai/glm-5.3-flash");
  },
  get providerParams() {
    return { reasoning_effort: envEffort("MINE_CODE_REASONING_EFFORT", "low") };
  },
  capabilities: CAPABILITIES,
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
