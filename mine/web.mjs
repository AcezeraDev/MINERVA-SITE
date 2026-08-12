// Pesquisa na web como camada separada e desligavel (documento, secao 13).
//
// IMPORTANTE: o modelo ser `:free` no OpenRouter NAO torna a busca gratuita.
// O plugin de web e cobrado a parte (por resultado retornado), entao ele fica
// atras de uma flag, desligado por padrao. Ligar sem credito na conta faz o
// provedor recusar o pedido — por isso a busca nunca derruba o chat: se ela
// falhar, a resposta sai mesmo assim, so que sem fontes.

export const WEB_SEARCH_MAX_RESULTS = 3;

/** Interruptor global. Sem a variavel ligada, nada de busca. */
export function webSearchEnabled() {
  return String(process.env.MINE_WEB_SEARCH || "").trim().toLowerCase() === "on";
}

/**
 * Configuracao do plugin mandada junto do pedido de chat.
 * Usar a ferramenta nativa do provedor evita manter uma segunda integracao de
 * busca e mantem as citacoes alinhadas com o texto gerado.
 */
export function webSearchPlugin() {
  const maxResults = Number(process.env.MINE_WEB_SEARCH_MAX_RESULTS) || WEB_SEARCH_MAX_RESULTS;
  return [{ id: "web", max_results: Math.max(1, Math.min(10, maxResults)) }];
}

/** Instrucao extra para a Mine citar o que encontrou. */
export function webSearchInstruction() {
  return `Voce recebeu resultados de busca na web para esta pergunta. Use-os quando forem relevantes, prefira informacao recente e diga a data quando ela importar. Se os resultados nao responderem, diga isso em vez de inventar. Nao invente enderecos de sites.`;
}

/**
 * Extrai as fontes citadas da resposta do provedor.
 * O OpenRouter devolve as citacoes em `message.annotations` no formato
 * `url_citation`. Formatos desconhecidos sao ignorados de proposito: fonte
 * duvidosa e pior que nenhuma fonte.
 */
export function extractSources(message) {
  const annotations = Array.isArray(message?.annotations) ? message.annotations : [];
  const seen = new Set();
  const sources = [];

  for (const item of annotations) {
    const citation = item?.type === "url_citation" ? item.url_citation : null;
    const url = String(citation?.url || "").trim();
    if (!url || seen.has(url)) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    seen.add(url);
    sources.push({
      url,
      title: String(citation.title || url).slice(0, 160),
    });
    if (sources.length >= 10) break;
  }

  return sources;
}
