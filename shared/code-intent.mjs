/**
 * Pedido de código no chat da Mine.
 *
 * Quando a pessoa pede um site, um jogo, um programa ou um ajuste no código que
 * a Mine acabou de mandar, a resposta sai pelo modelo de código (GLM-5.3 Flash)
 * com o "modo designer" no prompt e no formato ```projeto, que abre no monitor
 * ao lado do chat e baixa em .zip.
 *
 * Devolve o tipo do pedido:
 *   "site"   — página, site, landing, portfólio, jogo ou app que roda no navegador
 *   "python" — programa em Python
 *   "codigo" — outro código (JavaScript, Java, C, SQL, "faz um programa")
 *   ""       — conversa normal
 *
 * Dúvida não é pedido: "o que é HTML?", "como funciona um for em Python?" e
 * "me explica esse código" seguem com o modelo do chat.
 */

function fold(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const VERB = String.raw`(?:cri[ae]|criar|faz|faca|fazer|fa[cz]a|mont[ae]|montar|ger[ae]|gerar|desenvolv[ae]|desenvolver|program[ae]|programar|cod[ae]|codar|codifi\w*|escrev[ae]|escrever|construa|construir|implement\w*|quero|queria|preciso(?:\s+de)?|gostaria\s+de|mand[ae]|me\s+d[aeê]|bota|poe)`;

const SITE_NOUN = String.raw`(?:sites?|websites?|paginas?(?:\s+(?:web|html|inicial))?|landing(?:\s*page)?|portfolio|blog|loja\s+virtual|e-?commerce|dashboard|interface|tela\s+de\s+login|formulario|cardapio\s+digital|jogo|joguinho|game|app\s+web|aplicativo\s+web|calculadora|quiz\s+interativo|simula(?:cao|dor)(?!\s+(?:de|do|da)\s+(?:prova|enem|vestibular|simulado))|animacao\s+(?:em|com)\s+(?:css|js|javascript|html)|html|css)`;
const PY_NOUN = String.raw`(?:python|py\b|script\s+em\s+python|programa\s+em\s+python)`;
const CODE_NOUN = String.raw`(?:codigos?(?!\s+(?:civil|penal|genetic\w*|de\s+etica|de\s+transito|morse|de\s+barras|do\s+consumidor|florestal|eleitoral))|programas?(?!\s+(?:de|do|da)\s+(?!computador))|scripts?|algoritmos?|javascript|js\b|typescript|java\b|c\+\+|c#|linguagem\s+c\b|sql\b|react\b)`;

const QUESTION = /^\s*(?:o\s+que|oq|que\s+e|qual|quais|por\s*que|pq|quando|onde|quem|me\s+explica|explica|explique|como\s+(?:funciona|e\s+que|eu\s+(?:aprendo|estudo)|aprend)|diferenca|pra\s+que\s+serve|para\s+que\s+serve)\b/;

// "muda a cor do botão", "coloca um placar", "deixa o fundo escuro" logo depois de um código.
const EDIT = /\b(?:muda|mude|mudar|troca|troque|trocar|coloca|coloque|colocar|poe|ponha|bota|adiciona|adicione|adicionar|acrescenta|tira|tire|remove|remova|deixa|deixe|aumenta|diminui|melhora|melhore|arruma|arrume|conserta|conserte|corrige|corrija|ajusta|ajuste|refaz|refaca|faz\s+(?:o|a|os|as|um|uma)\b|agora\s+(?:faz|poe|coloca)|e\s+se|anima|animar|centraliza)\b/;
const EDIT_TARGET = /\b(?:cor(?:es)?|fundo|botao|botoes|fonte|letra|titulo|texto|menu|cabecalho|rodape|layout|tela|pagina|site|jogo|placar|pontos?|nivel|fase|animac\w+|imagem|icone|card|cards|secao|modo\s+escuro|tema|responsivo|celular|codigo|programa|funcao|loop|erro|bug|som|musica|personagem|inimigo|velocidade|mapa|grafico|input|pergunta)\b/;

const CODE_FENCE = /```+(?:projeto|html|python|py|javascript|js)\b/;

function lastAssistantHadCode(history) {
  const list = Array.isArray(history) ? history : [];
  for (let index = list.length - 1; index >= 0 && index >= list.length - 4; index -= 1) {
    const item = list[index];
    if (!item || item.role === "user") continue;
    const text = String(item.text || item.content || "");
    return CODE_FENCE.test(text) ? (/```+projeto|```+html/.test(text) ? "site" : /```+(?:python|py)\b/.test(text) ? "python" : "codigo") : "";
  }
  return "";
}

export function asksForCode(prompt, history = []) {
  const value = fold(prompt).replace(/\s+/g, " ").trim();
  if (!value || value.length > 1500) return "";

  // Ajuste no código da resposta anterior.
  const previous = lastAssistantHadCode(history);
  if (previous && !QUESTION.test(value) && EDIT.test(value) && (EDIT_TARGET.test(value) || value.length < 60)) return previous;

  if (QUESTION.test(value)) return "";

  const verbThen = (noun) => new RegExp(String.raw`\b${VERB}\b[^.?!\n]{0,50}?\b${noun}`).test(value);
  const asTitle = (noun) => new RegExp(String.raw`^(?:uma?\s+)?${noun}\b[^?]{0,80}\b(?:sobre|de|do|da|para|pra|com|que)\b`).test(value);

  if (verbThen(PY_NOUN) || /\bem\s+python\b/.test(value) && verbThen(String.raw`(?:${CODE_NOUN}|${SITE_NOUN})`)) return "python";
  if (verbThen(SITE_NOUN) || asTitle(SITE_NOUN)) return "site";
  if (verbThen(CODE_NOUN)) return "codigo";
  return "";
}
