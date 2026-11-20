/**
 * Ações do chat da Mine: frases que pedem para FAZER algo no site em vez de
 * conversar. "salva isso em História", "me lembra de estudar amanhã",
 * "cria um duelo sobre isso", "quero treinar uma redação sobre...".
 *
 * Mesma regra de shared/chat-intent.mjs: cada gatilho tem risco de falso
 * positivo ("como eu salvo um arquivo?" é pergunta), então a frase precisa
 * COMEÇAR pelo pedido, e cada caso tem teste em tests/chat-actions.test.mjs.
 *
 * A dobra de acentos é feita caractere a caractere para os índices do texto
 * dobrado baterem com os do original: o tema sai do original, com acento.
 */

import { parseQuickTask } from "./agenda.mjs";

function fold(text) {
  return text
    .split("")
    .map((char) => char.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().charAt(0) || char)
    .join("");
}

// "mine, por favor, você pode ..." antes do verbo
const LEAD = String.raw`^(?:(?:ei|oi|ok|okay|beleza|blz|entao|agora|tambem|e|ah)\s*,?\s+)*(?:mine\s*[,!:]?\s*)?(?:(?:por\s+favor|pfv|pf)\s*,?\s*)?(?:(?:voce\s+)?(?:pode|podia|poderia|consegue)\s+(?:me\s+)?)?`;

const REFERS_BACK = /\b(?:isso|isto|disso|nisso|desse|dessa|deste|desta|esse\s+(?:texto|assunto|tema|conteudo|resumo)|essa\s+(?:resposta|explicacao|materia|conversa|parte)|tudo\s+isso)\b/;

const AGENDA_VERB = String.raw`(?:coloca|coloque|colocar|poe|ponha|bota|bote|botar|anota|anote|anotar|adiciona|adicione|adicionar|marca|marque|marcar|salva|salve|salvar|agenda|agende|agendar|cria|crie|criar|inclui|inclua)`;
const SAVE_VERB = String.raw`(?:salva|salve|salvar|guarda|guarde|guardar|anota|anote|anotar|registra|registre|registrar|arquiva|arquive)`;
const SAVE_OBJECT = String.raw`(?:isso|isto|tudo\s+isso|(?:ess|est)[ae]s?(?:\s+(?:resposta|explicacao|resumo|texto|parte|conteudo|materia)s?)?|(?:a|o)\s+(?:sua\s+|seu\s+)?(?:ultim[ao]\s+)?(?:resposta|explicacao|resumo|texto)|resposta|explicacao|resumo)`;
const START_VERB = String.raw`(?:cria|crie|criar|abre|abra|abrir|comeca|comece|comecar|inicia|inicie|iniciar|faz|faca|fazer|monta|monte|montar|marca|marque|gera|gere|gerar|prepara|prepare|quero|queria|manda|mande|me\s+da|me\s+de|bora|vamos|vamo)`;

/** Palavras de ligação e de referência que sobram em volta do tema. */
function cleanTopic(raw) {
  let topic = String(raw || "")
    .replace(/[?!.;]+\s*$/g, "")
    .replace(/(?:^|\s+)(?:por\s+favor|pra\s+mim|para\s+mim|agora|a[ií]|pfv?)\s*$/i, "")
    .trim();
  for (let index = 0; index < 5; index += 1) {
    const next = topic
      .replace(/^(?:contra\s+(?:a\s+)?mine|comigo|com\s+(?:a\s+)?mine|pra\s+mim|para\s+mim)\b\s*/i, "")
      .replace(/^(?:sobre|de|do|da|dos|das|em|no|na|com\s+o\s+tema|com\s+tema|no\s+tema|do\s+tema|de\s+tema|tema|assunto|com|uma?)\s+/i, "")
      .replace(/^[:,\-–]\s*/, "")
      .trim();
    if (next === topic) break;
    topic = next;
  }
  if (/^(?:isso|isto|disso|nisso|tudo\s+isso|(?:d?ess|d?est)[ae]s?(?:\s+\S+)?|mim)$/i.test(topic)) return "";
  return topic.length >= 2 ? topic.charAt(0).toLocaleUpperCase("pt-BR") + topic.slice(1) : "";
}

function semReferencia(tarefa) {
  return tarefa
    .replace(/(?:^|\s+)(?:tudo\s+isso|isso|isto)(?=[\s,.!?]|$)/gi, " ")
    .replace(/^\s*(?:de|que|para|pra)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lê a frase e devolve a ação pedida, ou null para seguir como conversa.
 *
 * @param {string} value
 */
export function chatActionFromPrompt(value) {
  const original = String(value || "").normalize("NFC").trim();
  if (!original || original.length > 400) return null;
  const firstLine = original.split("\n")[0];
  const text = fold(firstLine);
  const refersBack = REFERS_BACK.test(text);
  // Pedaço do texto ORIGINAL (com acento) que um grupo da regex pegou.
  const grupo = (match, index) => (match.indices?.[index] ? firstLine.slice(match.indices[index][0], match.indices[index][1]) : "");
  const re = (source) => new RegExp(source, "d");

  // ── fotos num .zip: "coloca essas fotos num zip", "baixa todas as fotos" ───
  // Pergunta sobre zip ("o que é um arquivo zip?") segue como conversa.
  const pergunta = /^(?:o\s+que|oq|que\s+e|como\s+(?:eu\s+)?(?:abro|faco|crio|uso|descompact)|qual|quais|pra\s+que|para\s+que)\b/.test(text);
  const fotos = /\b(?:fotos?|fotinhas?|imagens?|figuras?|wallpapers?|icones?)\b/;
  const pacote = /(?:\.zip\b|\bzip\b|\bzipad\w*|\bzipa\w*|\bcompact(?:a|e|ar|ad\w*)\b|\bnum\s+pacote\b|\bem\s+um\s+pacote\b)/;
  const todas = /\bbaix\w*\b[^.?!]{0,24}\btod[ao]s\s+(?:as\s+|os\s+|ess[ae]s\s+)?(?:fotos|imagens|figuras|icones|wallpapers)\b/;
  if (!pergunta && ((pacote.test(text) && (fotos.test(text) || /\b(?:essas|elas|todas)\b/.test(text))) || todas.test(text))) {
    return { kind: "fotos-zip", topic: "", refersBack: true };
  }

  // ── agenda: "coloca na agenda ...", "me lembra de ... amanhã" ─────────────
  const agenda = re(`${LEAD}${AGENDA_VERB}\\b(.*?)\\b(?:n[ao]|em|pr[ao]|para\\s+[ao])\\s+(?:minha\\s+)?agenda\\b(.*)$`).exec(text);
  if (agenda) {
    const tarefa = `${grupo(agenda, 1)} ${grupo(agenda, 2)}`.replace(/^[\s:,\-–]+|[\s:,\-–.!]+$/g, "");
    return { kind: "agenda", topic: "", refersBack, tarefa: semReferencia(tarefa) };
  }
  const lembra = re(`${LEAD}(?:me\\s+)?lembr(?:a|e|ar)(?:-me)?\\s+(?:de\\s+|que\\s+|para\\s+|pra\\s+)?(.+)$`).exec(text);
  if (lembra && !/^(?:o\s+que|do\s+que|como|qual|quais|quem|quando|onde|por\s*que|a\s+formula)\b/.test(lembra[1])) {
    const tarefa = semReferencia(grupo(lembra, 1).replace(/[.!]+$/, ""));
    const parsed = parseQuickTask(tarefa);
    // "me lembra a fórmula de Bhaskara" é pergunta; tarefa de verdade tem quando.
    if (parsed.dueAt !== null || parsed.time || parsed.repeat) return { kind: "agenda", topic: "", refersBack, tarefa };
  }

  // ── salvar nos conteúdos da matéria ────────────────────────────────────────
  const salvar = re(`${LEAD}${SAVE_VERB}\\s+(?:(${SAVE_OBJECT})\\b\\s*)?(?:(?:n[ao]s?|em|pr[ao]s?|para\\s+[ao]s?)\\s+(.+))?$`).exec(text);
  // "salva isso em PDF" é pedido de arquivo para a Mine (shared/chat-files.mjs).
  if (salvar && (salvar[1] || salvar[2]) && !/\b(?:pdf|word|docx|excel|planilhas?|xlsx|html|csv|arquivo|zip)\b/.test(text)) {
    const destino = grupo(salvar, 2)
      .replace(/[?!.]+$/, "")
      .replace(/^(?:minhas?|meus?|a|o|as|os)\s+/i, "")
      .replace(/^(?:aba|pasta|mat[ée]rias?|caderno|conte[úu]dos?|anota[çc][õo]es)(?:\s+(?:de|do|da|dos|das))?(?:\s+|$)/i, "")
      .replace(/^(?:minhas?|meus?)\s+/i, "")
      .trim();
    return { kind: "salvar", topic: "", refersBack: true, destino: /^(?:conte[úu]dos?|mat[ée]rias?|anota[çc][õo]es)$/i.test(destino) ? "" : destino };
  }

  // ── duelo ──────────────────────────────────────────────────────────────────
  const duelo = re(`${LEAD}(?:${START_VERB}|me\\s+desafi[ae])\\b(?:(?!\\b(?:saber|entender|como|explica)\\b)[^.?!]){0,30}?\\bduelos?\\b(.*)$`).exec(text);
  if (duelo) return { kind: "duelo", topic: cleanTopic(grupo(duelo, 1)), refersBack };

  // ── atividade ─────────────────────────────────────────────────────────────
  const atividade = re(`${LEAD}${START_VERB}\\b(?:(?!\\b(?:saber|entender|como|explica|corrig\\w*)\\b)[^.?!]){0,24}?\\batividades?\\b(?!\\s+fisica)(.*)$`).exec(text);
  if (atividade) return { kind: "atividade", topic: cleanTopic(grupo(atividade, 1)), refersBack };

  // ── redação: só quando ELE vai escrever ("faz uma redação" é pedido de texto) ─
  const redacao = re(`${LEAD}(?:(?:quero|queria|vou|preciso|bora|vamos|deixa\\s+eu|me\\s+deixa)\\s+(?:escrever|treinar|praticar|fazer|comecar)|abre|abra|abrir|treina|treinar|pratica|praticar)\\b[^.?!]{0,20}?\\breda(?:cao|coes)\\b(.*)$`).exec(text);
  if (redacao) return { kind: "redacao", topic: cleanTopic(grupo(redacao, 1)), refersBack };

  // ── leitura: levar um texto para a aba Leitura ─────────────────────────────
  const leitura = re(`${LEAD}(?:(?:quero|queria|vou|bora|vamos)\\s+)?(?:leva|leve|levar|manda|mande|mandar|joga|jogue|coloca|coloque|abre|abra|abrir|passa|passe|usa|use|treina|treinar|pratica|praticar)\\b[^.?!]{0,40}?\\b(?:aba\\s+(?:de\\s+|da\\s+)?)?leitura\\b(.*)$`).exec(text);
  if (leitura) return { kind: "leitura", topic: "", refersBack: refersBack || !grupo(leitura, 1).trim() };

  return null;
}

/** Texto de uma resposta da Mine sem marcação, para virar texto de leitura. */
export function plainTextFromReply(reply) {
  return String(reply || "")
    .replace(/```[\s\S]*?(?:```|$)/g, "")
    .replace(/\[\[[^\]]*\]\]/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/^[ \t]*[-*+][ \t]+/gm, "• ")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\$\$?([^$]+)\$\$?/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
