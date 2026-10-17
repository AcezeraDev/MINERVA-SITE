/**
 * Deteccao de intencao das mensagens do chat da Mine.
 *
 * Mora em shared para o navegador e os testes Node usarem a mesma
 * implementacao. Sao regexes com risco real de falso positivo: "me explica essa
 * questao" e conversa normal e nao pode virar uma prova; "mapa mental" nao pode
 * ser confundido com uma mencao solta a "mental". Por isso cada gatilho tem
 * teste, e nao apenas leitura atenta.
 */

export function normalizeIntentText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

/**
 * Pedido de mapa mental. Tolerante a erros comuns de digitacao ("mapa mentl",
 * "mapa metnal"), mas a palavra "mapa" continua obrigatoria.
 */
export function isMindMapRequest(value) {
  const normalized = normalizeIntentText(value);
  return /\b(?:mapa\s+(?:ment[a-z]*|metnal|de\s+ideias|conceitual)|mind\s*map)\b/.test(normalized);
}

/**
 * Pedido de prova/simulado.
 *
 * "questao" no singular fica de fora de proposito: "me explica essa questao" e
 * conversa. No plural exige-se um verbo de criacao por perto, que e o que
 * separa o pedido de uma mencao ("essas questoes estao dificeis").
 */
export function isQuizRequest(value) {
  const normalized = normalizeIntentText(value);
  if (/\b(?:prova|simulad[ao]s?|teste\s+de\s+conhecimento)\b/.test(normalized)) return true;
  return /\b(?:cri[ae]|criar|faz|faca|fazer|monte?|montar|gere?|gerar|elabore?|quero|preciso\s+de)\b[^.?!]{0,24}\b(?:quest(?:oes|ao)|exercicios?|perguntas)\b/.test(
    normalized,
  );
}

/** Pedido de flashcards. "cartao" sozinho e ambiguo demais; exige contexto. */
export function isFlashcardRequest(value) {
  const normalized = normalizeIntentText(value);
  if (/\bflash\s*cards?\b/.test(normalized)) return true;
  return /\b(?:cart(?:oes|ao)|fichas?)\s+(?:de\s+)?(?:estudo|revisao|memoriza)/.test(normalized);
}

/**
 * Qualificadores do pedido que grudam na frente do tema.
 *
 * "monte uma prova dificil de 10 questoes de biologia" captura tudo depois de
 * "prova de", entao o tema sairia como "dificil de 10 questoes de biologia".
 * Estes sao os pedacos que descrevem o PEDIDO, nao o assunto. Aceita as duas
 * grafias porque a extracao roda sobre o texto original, com acento.
 */
const REQUEST_QUALIFIER =
  /^(?:(?:muito\s+)?(?:f[áa]ceis|f[áa]cil|dif[íi]ceis|dif[íi]cil|m[ée]dias?|m[ée]dios?|simples|b[áa]sicas?|b[áa]sicos?|avan[çc]adas?|avan[çc]ados?|complexas?|complexos?|puxadas?|puxados?)|\d{1,2}\s*(?:quest[õo]es|quest[ãa]o|perguntas?|exerc[íi]cios?|cart[õo]es|cart[ãa]o|flash\s*cards?)|(?:de|do|da|dos|das|com|sobre|em)(?=\s))\s*/i;

/**
 * Descasca os qualificadores ate sobrar o assunto.
 *
 * Descascar tudo devolve vazio de proposito: se a frase inteira era qualificador
 * ("monte uma prova dificil"), entao nao havia assunto nenhum, e quem chama
 * pergunta sobre o que a pessoa quer. Devolver "Dificil" como tema seria montar
 * uma prova sobre a palavra dificil.
 */
function stripRequestQualifiers(topic) {
  let out = topic;
  for (let index = 0; index < 6; index += 1) {
    const next = out.replace(REQUEST_QUALIFIER, "").trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

/** Extrai o tema depois do gatilho e limpa o que sobra de linguagem falada. */
export function topicAfter(value, gatilho) {
  const match = String(value || "").trim().match(gatilho);
  const topic = match?.[1]
    ?.replace(/[?!.]+$/g, "")
    // `(?:^|\s+)` e nao `\s+`: em "quero uma prova pra mim" o complemento e a
    // captura inteira, sem espaco antes, e exigir o espaco fazia "pra mim"
    // virar o tema da prova.
    .replace(/(?:^|\s+)(?:por favor|pra mim|para mim|agora)$/i, "")
    .replace(/^(?:o|a|os|as)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const limpo = topic ? stripRequestQualifiers(topic) : "";
  if (!limpo || limpo.length < 2 || /^(?:um|uma|uns|umas|isso|isto|esse|essa|mim)$/i.test(limpo)) return "";
  return limpo.charAt(0).toLocaleUpperCase("pt-BR") + limpo.slice(1);
}

export function mindMapTopicFromPrompt(value) {
  return topicAfter(
    value,
    /\b(?:mapa\s+(?:ment[a-zà-ÿ]*|metnal|de\s+id[eé]ias|conceitual)|mind\s*map)\b\s*(?:(?:sobre|de|do|da|dos|das)\s+)?(.+)$/i,
  );
}

export function quizTopicFromPrompt(value) {
  return topicAfter(
    value,
    /\b(?:prova|simulad[oa]|quest[oõ]es|exerc[ií]cios|perguntas)\b\s*(?:(?:de|do|da|dos|das|sobre|em)\s+)?(.+)$/i,
  );
}

export function flashcardTopicFromPrompt(value) {
  return topicAfter(value, /\b(?:flash\s*cards?|cart[oõ]es|fichas)\b\s*(?:(?:de|do|da|dos|das|sobre)\s+)?(.+)$/i);
}

/** Quantidade pedida em texto livre: "prova de 10 questoes" -> 10. */
export function countFromPrompt(value, fallback, ceiling) {
  const match = normalizeIntentText(value).match(/\b(\d{1,2})\s*(?:quest|pergunt|cart|exerc|flash)/);
  const number = Number(match?.[1]);
  return Number.isInteger(number) && number > 0 ? Math.min(ceiling, number) : fallback;
}

/** Dificuldade pedida em texto livre. Sem mencao, media. */
export function difficultyFromPrompt(value) {
  const normalized = normalizeIntentText(value);
  if (/\b(?:dificil|dificeis|avancad|complex|puxad)/.test(normalized)) return "dificil";
  if (/\b(?:facil|faceis|simples|basic|iniciant)/.test(normalized)) return "facil";
  return "medio";
}
