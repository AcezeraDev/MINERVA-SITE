/**
 * Marcador de imagem nas respostas da Mine.
 *
 * A Mine ilustra a resposta escrevendo `[[imagem: Nikola Tesla | legenda]]` no
 * meio do texto; o navegador troca esse pedaco por uma foto real buscada em
 * /api/image. Mora em shared porque o mesmo texto e lido em tres lugares que
 * nao podem divergir: o balao da conversa (que renderiza a foto), o "copiar" e
 * o historico enviado de volta ao modelo (que precisam do texto limpo).
 *
 * Duas armadilhas guiaram o formato:
 *
 * 1. Streaming. O texto chega token a token, entao a tela mostra `[[imagem: Nik`
 *    por alguns instantes se ninguem cortar. Dai `stripPendingMarker`.
 * 2. Modelo repetitivo. Um modelo que gosta do brinquedo enche a resposta de
 *    marcadores. Por isso o limite nao e uma sugestao no prompt: os excedentes
 *    sao removidos aqui, e a conversa nunca vira um album de fotos.
 */

/**
 * `imagem` e a forma ensinada no prompt; `foto`/`image` entram por tolerancia.
 * Um marcador escrito com sinonimo tem que virar foto ou sumir — o que nao pode
 * e vazar `[[foto: ...]]` cru na tela.
 */
// `image(?:m|ns)` e nao `imagens?`: o plural de "imagem" e "imagens", com N.
const IMAGE_MARKER = /\[\[\s*(?:image(?:m|ns)|fotos?|images?)\s*:\s*([^\]|]+?)\s*(?:\|\s*([^\]]*?)\s*)?\]\]/gi;

/**
 * Imagem CRIADA pela IA (out/2026), como o "criar imagem" do ChatGPT:
 * `[[gerar_imagem: prompt detalhado em ingles | legenda | editar]]`.
 * O navegador troca o marcador por um cartão que pede a imagem a
 * /api/mine-imagem. O terceiro campo "editar" usa a última imagem criada na
 * conversa como referência ("deixa o fundo azul").
 */
const GENERATE_MARKER = /\[\[\s*(?:gerar[_ ]imagem|gerar|criar[_ ]imagem|generate[_ ]image)\s*:\s*([^\]|]+?)\s*(?:\|\s*([^\]]*?)\s*)?\]\]/gi;
const MAX_PROMPT_CHARS = 1200;

// ---------------------------------------------------------------------------
// Estilo da imagem (out/2026)
//
// "Pesquise icons da Ellie Williams" trazia fotos comuns da personagem: o
// prompt mandava tirar "icone" do termo (a palavra nao aparece no titulo das
// fotos e a busca voltava vazia), o filtro anti-logotipo descartava tudo com
// "icon" no titulo e a Wikipedia abria a galeria com a foto da atriz. Agora o
// marcador tem um terceiro campo — `[[imagem: assunto | legenda | icone]]` —
// e o servidor busca, filtra e ordena de acordo com ele.

export const IMAGE_STYLES = ["icone", "wallpaper", "desenho", "logo"];

// Palavra de estilo -> estilo. Vale para a frase do estudante e para um termo
// em que o modelo deixou a palavra escapar ("Ellie Williams icon").
const STYLE_WORDS = [
  ["icone", String.raw`icons?|ícones?|icones?|pfps?|avatar(?:es|s)?|fotos?\s+de\s+perfil|profile\s+pic(?:ture)?s?|foto\s+pra\s+perfil`],
  ["wallpaper", String.raw`wallpapers?|pap[eé](?:l|is)\s+de\s+parede|planos?\s+de\s+fundo|fundos?\s+de\s+tela|lock\s*screen|tela\s+de\s+bloqueio`],
  ["desenho", String.raw`fan\s*arts?|fanarts?|desenhos?|ilustra[cç](?:ão|ao|ões|oes)|artes?\s+(?:de\s+f[aã]|digita(?:l|is))|drawings?|sketch(?:es)?`],
  // "logo" sozinho e tambem advérbio ("logo depois"): so conta com "do/da" ou no plural.
  ["logo", String.raw`logos|logotipos?|logomarcas?|logo(?=\s+d[aeo]s?\s)|s[ií]mbolos?\s+oficia(?:l|is)`],
];
const STYLE_PATTERNS = STYLE_WORDS.map(([style, words]) => [style, new RegExp(String.raw`(?<![\p{L}])(?:${words})(?![\p{L}])`, "iu")]);

/** Estilo pedido numa frase ("icons da Ellie" -> "icone"), ou "" para foto comum. */
export function imageStyleFrom(text) {
  const value = String(text || "");
  for (const [style, pattern] of STYLE_PATTERNS) if (pattern.test(value)) return style;
  return "";
}

/** Normaliza o terceiro campo do marcador ("ícone", "icon", "pfp" -> "icone"). */
export function normalizeImageStyle(value) {
  const clean = String(value || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (IMAGE_STYLES.includes(clean)) return clean;
  return imageStyleFrom(value);
}

/**
 * Tira do termo as palavras de estilo e devolve o estilo que elas indicavam:
 * "Ellie Williams icon pfp" -> { query: "Ellie Williams", style: "icone" }.
 */
export function splitImageStyle(query) {
  let clean = String(query || "");
  let style = "";
  for (const [name, pattern] of STYLE_PATTERNS) {
    const global = new RegExp(pattern.source, "giu");
    if (global.test(clean)) {
      style = style || name;
      clean = clean.replace(global, " ");
    }
  }
  clean = clean
    .replace(/\b(?:aesthetic|hd|4k|1:1|quadrad[oa]s?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    // "desenho da celula animal" -> "celula animal"
    .replace(/^(?:d[aeo]s?|of|the)\s+/i, "")
    .trim();
  return { query: clean.length >= 2 ? clean : String(query || "").trim(), style };
}

/**
 * Garante o estilo nos marcadores da resposta pronta. O modelo as vezes
 * esquece o terceiro campo; o servidor sabe o que o estudante pediu e completa.
 */
export function withImageStyle(text, style) {
  if (!style) return String(text || "");
  return String(text || "").replace(IMAGE_MARKER, (marker, query, rest) => {
    const parts = String(rest || "").split("|").map((part) => part.trim());
    if (parts[1] && normalizeImageStyle(parts[1])) return marker;
    const prefix = marker.match(/^\[\[\s*([^:]+?)\s*:/)?.[1] || "imagem";
    return `[[${prefix}: ${String(query).trim()} | ${parts[0] || ""} | ${style}]]`;
  });
}

/**
 * Marcador ainda incompleto no fim do texto que esta chegando por streaming.
 * Exige o prefixo de "imagem"/"foto" para nao engolir um `[[` legitimo.
 */
const PENDING_MARKER =
  /\[\[\s*(?:i|im|ima|imag|image|imagem|imagens|f|fo|fot|foto|fotos|s|su|sug|suge|sugest|sugesto|sugestõ|sugestoe|sugestõe|sugestoes|sugestões|g|ge|ger|gera|gerar|gerar[_ ][a-z]{0,6}|c|cr|cri|cria|criar|criar[_ ][a-z]{0,6})?\s*(?::[^\]]*\]?)?$/i;

/**
 * Proximas perguntas sugeridas: `[[sugestoes: pergunta 1 | pergunta 2]]` no
 * fim da resposta. O servidor tira o marcador e manda as perguntas a parte;
 * aqui ele so precisa sumir do que e mostrado, caso escape.
 */
const SUGGESTION_MARKER = /\[\[\s*sugest(?:o|õ)es\s*:\s*([^\]]*)\]\]/gi;
const MAX_SUGGESTIONS = 3;
const MAX_SUGGESTION_CHARS = 70;

export function extractSuggestions(text) {
  const suggestions = [];
  const clean = String(text || "").replace(SUGGESTION_MARKER, (_, list) => {
    for (const item of String(list).split("|")) {
      const value = cleanField(item.trim().replace(/^["“”']+|["“”']+$/g, ""), MAX_SUGGESTION_CHARS);
      if (value.length >= 3 && !suggestions.includes(value)) suggestions.push(value);
    }
    return "";
  });
  return { text: tidy(clean), suggestions: suggestions.slice(0, MAX_SUGGESTIONS) };
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
const MAX_QUERY_CHARS = 80;
const MAX_CAPTION_CHARS = 140;

function cleanField(value, maxLength) {
  return String(value || "")
    .replace(CONTROL_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** O termo de busca precisa ser um nome, nao uma frase de pedido. */
function usableQuery(value) {
  const query = cleanField(value, MAX_QUERY_CHARS)
    // Modelos as vezes escrevem "[[imagem: foto de Nikola Tesla]]".
    .replace(/^(?:uma?\s+)?(?:foto|imagem|figura|ilustra[cç][aã]o)\s+(?:de|do|da|dos|das)\s+/i, "")
    .replace(/[.,;:]+$/, "")
    .trim();
  return query.length >= 2 ? query : "";
}

export function hasImageMarker(text) {
  IMAGE_MARKER.lastIndex = 0;
  return IMAGE_MARKER.test(String(text || ""));
}

/**
 * Fecha as costuras que a remocao de um marcador deixa: o espaco duplo de um
 * marcador tirado do meio da frase e a linha em branco a mais de um marcador
 * que ocupava a linha inteira.
 */
function tidyProse(text) {
  return text
    .replace(/(\S)[ \t]{2,}/g, "$1 ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

// Dentro de um bloco de codigo o espaco e conteudo: juntar espacos duplos
// destruiria a indentacao de um programa em Python. So o texto fora das cercas
// passa pela limpeza — e a cerca ainda aberta (streaming) tambem e poupada.
const CODE_FENCE_REGION = /(^|\n)([ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n[ \t]*\3[ \t]*(?=\n|$)|$))/g;

function tidy(text) {
  const source = String(text || "");
  let out = "";
  let cursor = 0;
  CODE_FENCE_REGION.lastIndex = 0;
  for (let match = CODE_FENCE_REGION.exec(source); match; match = CODE_FENCE_REGION.exec(source)) {
    const start = match.index + match[1].length;
    out += tidyProse(source.slice(cursor, start)) + match[2];
    cursor = start + match[2].length;
  }
  out += tidyProse(source.slice(cursor));
  return out.trim();
}

/** Texto sem nenhum marcador: e o que vai para o "copiar", o "salvar" e o historico. */
export function stripImageMarkers(text) {
  // O marcador costuma ficar sozinho numa linha; tirar so ele deixaria tres
  // quebras seguidas e um buraco no meio do texto, dai o `tidy`.
  return tidy(String(text || "").replace(IMAGE_MARKER, "").replace(GENERATE_MARKER, "").replace(SUGGESTION_MARKER, ""));
}

/** Corta um marcador que ainda esta sendo escrito, para ele nao piscar na tela. */
export function stripPendingMarker(text) {
  return String(text || "").replace(PENDING_MARKER, "");
}

/**
 * Quebra o texto em pedacos de texto e imagem, na ordem em que aparecem.
 *
 * `limit` e o teto de imagens que viram foto; marcadores alem disso saem do
 * texto sem virar nada — e sem partir o paragrafo em dois, porque o texto ao
 * redor de um marcador descartado continua no mesmo pedaco. Com `streaming`,
 * um marcador pela metade no fim e cortado: ele volta inteiro no proximo token.
 *
 * Duas e o teto porque existe resposta que compara duas coisas (celula animal e
 * vegetal, Marte e Terra) e uma foto so conta metade da historia. Da terceira
 * em diante e um modelo empolgado, e a conversa viraria um album.
 */
export function splitMessageMedia(text, { limit = 2, streaming = false } = {}) {
  const withoutSuggestions = String(text || "").replace(SUGGESTION_MARKER, "");
  const source = streaming ? stripPendingMarker(withoutSuggestions) : withoutSuggestions;
  const segments = [];
  let buffer = "";
  let cursor = 0;
  let used = 0;

  const flushText = () => {
    const clean = tidy(buffer);
    buffer = "";
    if (clean) segments.push({ type: "text", text: clean });
  };

  // Uma imagem criada por resposta, como no ChatGPT: cada uma custa dinheiro.
  let generated = 0;
  const markers = new RegExp(`${IMAGE_MARKER.source}|${GENERATE_MARKER.source}`, "gi");
  for (let match = markers.exec(source); match; match = markers.exec(source)) {
    buffer += source.slice(cursor, match.index);
    cursor = match.index + match[0].length;
    if (match[3] !== undefined) {
      const prompt = generated < 1 ? cleanField(match[3], MAX_PROMPT_CHARS) : "";
      if (prompt.length < 3) continue;
      flushText();
      const [caption, mode] = String(match[4] || "").split("|");
      segments.push({ type: "generate", prompt, caption: cleanField(caption, MAX_CAPTION_CHARS), edit: /^\s*edit/i.test(mode || "") });
      generated += 1;
      continue;
    }
    const raw = used < limit ? usableQuery(match[1]) : "";
    if (!raw) continue;
    flushText();
    const [caption, styleField] = String(match[2] || "").split("|");
    const split = splitImageStyle(raw);
    const style = normalizeImageStyle(styleField) || split.style;
    // Sem estilo, o pedaco fica como sempre foi: so termo e legenda.
    segments.push({ type: "image", query: split.query, caption: cleanField(caption, MAX_CAPTION_CHARS), ...(style ? { style } : {}) });
    used += 1;
  }

  buffer += source.slice(cursor);
  flushText();
  return segments;
}

// Substantivo de imagem precedido de um pedido ("manda uma foto", "quero ver
// uma imagem", "tem algum print"). So o substantivo nao basta: "o que tem
// nessa foto?" e "analise a imagem que enviei" falam de um anexo.
// "icon", "pfp", "wallpaper": é assim que o estudante pede foto de perfil e
// papel de parede. Sem essas palavras, "me mande mais icons" não virava
// galeria e a Mine respondia "encontrei uma imagem" sem mostrar nada.
const IMAGE_NOUN = String.raw`(?:fotos?|fotinhas?|imagens?|imagem|figuras?|prints?|capturas?\s+de\s+tela|screenshots?|ilustra[cç](?:ão|ao|ões|oes)|icons?|ícones?|icones?|pfps?|avatar(?:es|s)?|wallpapers?|pap[eé](?:l|is)\s+de\s+parede|desenhos?)`;
const IMAGE_REQUEST = new RegExp(
  String.raw`(?:^|[^\p{L}])(?:mand\w*|mostr\w*|envi\w*|exib\w*|ver|veja|quero|queria|gostaria|busc\w*|procur\w*|pesquis\w*|encontr\w*|consegu\w*|coloc\w*|traz\w*|traga|ache|achar|arranj\w*|me\s+d[aáê]|tem\s+(?:uma?|alguma?|como)|pode(?:ria)?)(?![\p{L}])[^.?!\n]{0,40}?(?:^|[^\p{L}])${IMAGE_NOUN}(?![\p{L}])`,
  "iu",
);
const ATTACHMENT_REFERENCE = new RegExp(String.raw`\b(?:ness[ae]|dess[ae]|est[ae]|na|da)\s+${IMAGE_NOUN}\s+(?:que\s+)?(?:eu\s+)?(?:mandei|enviei|anexei|acima|anexad[ao])`, "i");

/**
 * A pessoa pediu para VER uma imagem? Liga a instrucao de imagem mesmo com o
 * modo fotos desligado — o marcador e renderizado em qualquer conversa.
 */
export function asksForImage(text) {
  const value = String(text || "");
  if (ATTACHMENT_REFERENCE.test(value)) return false;
  return IMAGE_REQUEST.test(value);
}

/**
 * Texto de uma resposta como ele vai para o histórico enviado ao modelo: cada
 * marcador vira uma nota "(galeria de fotos: termo)". Apagar o marcador fazia a
 * Mine esquecer que tinha mostrado fotos, e "manda mais" ou "outras dela" não
 * viravam galeria; manter o marcador cru a convidava a ilustrar tudo.
 */
export function describeImageMarkers(text) {
  return tidy(
    String(text || "")
      .replace(IMAGE_MARKER, (_, query, rest) => {
        const style = normalizeImageStyle(String(rest || "").split("|")[1]) || splitImageStyle(query).style;
        const noun = { icone: "icones", wallpaper: "wallpapers", desenho: "desenhos", logo: "logos" }[style] || "fotos";
        return `(galeria de ${noun}: ${cleanField(query, MAX_QUERY_CHARS)})`;
      })
      // A Mine precisa lembrar o que desenhou para "deixa o fundo azul" virar
      // uma edição da mesma imagem, e não um desenho novo do zero.
      .replace(GENERATE_MARKER, (_, prompt) => `(imagem criada pela Mine: ${cleanField(prompt, MAX_PROMPT_CHARS)})`)
      .replace(SUGGESTION_MARKER, ""),
  );
}

const GALLERY_NOTE = /\(galeria de (fotos|icones|wallpapers|desenhos|logos):\s*([^)]+)\)/i;
const NOTE_STYLE = { icones: "icone", wallpapers: "wallpaper", desenhos: "desenho", logos: "logo" };

/** Estilo da última galeria da conversa ("manda mais" continua em ícones). */
export function previousGalleryStyle(history = []) {
  const last = [...(Array.isArray(history) ? history : [])].reverse().find((message) => message?.role !== "user");
  const note = String(last?.text || last?.content || "").match(GALLERY_NOTE);
  return note ? NOTE_STYLE[note[1].toLowerCase()] || "" : "";
}
const MORE_PHOTOS = /(?:^|[^\p{L}])(?:mais|outr[ao]s?|diferentes?|nov[ao]s?|melhor(?:es)?|maior(?:es)?|quadrad[ao]s?|dela|dele|delas|deles|desse|dessa|mesm[ao])(?![\p{L}])|1:1|\bhd\b/iu;

/**
 * "Manda mais", "outras dela", "em 1:1" logo depois de uma galeria: o pedido
 * continua sendo de foto, mesmo sem a palavra "foto". Devolve o termo da
 * galeria anterior, ou "" quando não é esse o caso.
 */
export function continuesGallery(text, history = []) {
  const last = [...(Array.isArray(history) ? history : [])].reverse().find((message) => message?.role !== "user");
  const note = String(last?.text || last?.content || "").match(GALLERY_NOTE);
  if (!note) return "";
  const value = String(text || "");
  if (value.length > 160 || !MORE_PHOTOS.test(value)) return "";
  return note[2].trim();
}

// ---------------------------------------------------------------------------
// Pedido para CRIAR uma imagem (out/2026)
//
// "Manda uma foto do Einstein" é busca (a foto existe); "cria uma imagem de um
// gato astronauta" é criação. O que separa os dois é o verbo: gerar, criar,
// fazer, desenhar, ilustrar, pintar, montar, imaginar. Sem verbo de criação,
// continua sendo busca, como sempre foi.
const CREATE_VERB = String.raw`(?:ger[ae]\w*|cri[ae]\w*|fa[zç]\w*|fazer|desenh\w*|ilustr\w*|pint[ae]\w*|mont[ae]\w*|imagin[ae]\w*|produz\w*|elabor\w*|design\w*)`;
const CREATE_NOUN = String.raw`(?:imagens?|imagem|fotos?|desenhos?|ilustra[cç](?:ão|ao|ões|oes)|artes?|pinturas?|logos?|logotipos?|wallpapers?|pap[eé]is?\s+de\s+parede|p[oô]sters?|cartaz(?:es)?|capas?|banners?|figurinhas?|stickers?|avatar(?:es|s)?|ícones?|icones?|icons?|mascotes?|personagens?|cen[aá]rios?|quadrinhos?|tirinhas?|infogr[aá]ficos?)`;
const CREATE_REQUEST = new RegExp(String.raw`(?:^|[^\p{L}])${CREATE_VERB}(?![\p{L}])[^.?!\n]{0,30}?(?:^|[^\p{L}])${CREATE_NOUN}(?![\p{L}])`, "iu");
// "Desenhe" sozinho ("desenha um gato pra mim") também é pedido de imagem.
const DRAW_ALONE = /(?:^|[^\p{L}])(?:desenh[ae]|desenhar|ilustr[ae]|ilustrar|pint[ae])(?![\p{L}])\s+(?:uma?|o|a|meu|minha|pra|para|me)\b/iu;
// "Faz um resumo com imagem" ou "cria uma lista": o substantivo aparece, mas o
// pedido é de texto. Esses casos ficam com a busca/texto.
const TEXT_FIRST = /(?:^|[^\p{L}])(?:resumo|lista|texto|reda[cç][aã]o|exerc[ií]cios?|quest(?:ão|ao|ões|oes)|prova|plano|tabela|mapa\s+mental|flashcards?)(?![\p{L}])/iu;

/** A pessoa pediu para a Mine CRIAR uma imagem (e não buscar uma foto)? */
export function asksToGenerateImage(text) {
  const value = String(text || "");
  if (!value.trim() || ATTACHMENT_REFERENCE.test(value)) return false;
  if (TEXT_FIRST.test(value) && !/(?:^|[^\p{L}])(?:imagem|desenho|ilustra[cç][aã]o)\s+(?:de|do|da|com)(?![\p{L}])/iu.test(value)) return false;
  return CREATE_REQUEST.test(value) || DRAW_ALONE.test(value);
}

const GENERATED_NOTE = /\(imagem criada pela Mine:\s*([^)]+)\)/i;
const EDIT_WORDS = /(?:^|[^\p{L}])(?:mud[ae]\w*|troc[ae]\w*|coloc[ae]\w*|coloque|deix[ae]\w*|adicion\w*|acrescent\w*|tir[ae]\w*|remov\w*|apag[ae]\w*|aument\w*|diminu\w*|agora|mais|menos|sem|com|cor(?:es)?|fundo|estilo|vers[aã]o|refa[zç]\w*|de\s+novo|outra|melhor[ae]\w*|ajust\w*|corrig\w*|realista|cartoon|anime|pixel|aquarela|escur\w*|clar[ao]\w*)(?![\p{L}])/iu;

/**
 * Logo depois de uma imagem criada, "deixa o fundo azul" ou "agora em estilo
 * anime" continua o desenho. Devolve o prompt da imagem anterior, ou "".
 */
export function continuesGeneration(text, history = []) {
  const last = [...(Array.isArray(history) ? history : [])].reverse().find((message) => message?.role !== "user");
  const note = String(last?.text || last?.content || "").match(GENERATED_NOTE);
  if (!note) return "";
  const value = String(text || "");
  if (value.length > 220 || !EDIT_WORDS.test(value)) return "";
  return note[1].trim();
}
