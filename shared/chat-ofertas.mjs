// Resposta de um toque (25/nov/2026, visto no Gemini).
//
// Quando a Mine termina oferecendo um próximo passo numa pergunta de sim ou
// não ("Quer que eu monte um quiz de 4 questões?"), a tela põe um botão com o
// "sim" já escrito. Aqui só se decide SE a última frase é uma oferta e qual o
// texto do botão; quem envia é o chat.

const OFERTA = /^(?:e\s+a[ií],\s*)?(?:quer(?:\s+que\s+eu)?|você\s+quer|voce\s+quer|posso|gostaria(?:\s+que\s+eu)?|que\s+tal|bora|vamos|topa|prefere\s+que\s+eu|se\s+quiser,?\s+(?:eu\s+)?posso)\b/i;

/** Última frase de verdade do texto, sem blocos de código, marcadores e markdown. */
function ultimaFrase(text) {
  const limpo = String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[\[[^\]]*\]\]/g, " ")
    .replace(/[*_`>#]/g, "")
    .trim();
  const linhas = limpo.split(/\n+/).map((linha) => linha.trim()).filter(Boolean);
  const ultima = linhas[linhas.length - 1] || "";
  const frases = ultima.match(/[^.!?]+[.!?]*/g) || [ultima];
  return (frases[frases.length - 1] || "").trim();
}

/**
 * Devolve { pergunta, botao, envio } quando a resposta termina numa oferta,
 * ou null. `botao` é curto (cabe num chip); `envio` é o que vai para a Mine.
 */
export function ofertaFinal(text) {
  const frase = ultimaFrase(text);
  if (!frase.endsWith("?") || frase.length > 180 || !OFERTA.test(frase)) return null;
  // O verbo da oferta decide o "sim":
  //   "Quer que eu monte um quiz?"  -> "Sim, monte um quiz"
  //   "Posso fazer um resumo?"      -> "Sim, pode fazer um resumo"
  //   "Quer fazer um quiz?"         -> "Sim, quero fazer um quiz"
  const inicio = frase.match(OFERTA)?.[0].toLowerCase() || "";
  const pedido = frase
    .replace(/\?$/, "")
    .replace(OFERTA, "")
    .replace(/^\s*(?:que\s+eu\s+)?/i, "")
    .trim();
  const prefixo = /que\s+eu/.test(inicio) || /^(?:que\s+tal|bora|vamos|topa)/.test(inicio)
    ? "Sim,"
    : /posso/.test(inicio)
      ? "Sim, pode"
      : /quer/.test(inicio)
        ? "Sim, quero"
        : "Sim,";
  const curto = pedido.length > 3 && pedido.length <= 44 ? pedido : "";
  const botao = curto ? `${prefixo} ${curto}` : "Sim, quero";
  return { pergunta: frase, botao, envio: `${botao}.` };
}
