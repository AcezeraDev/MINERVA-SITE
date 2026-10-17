import dns from "node:dns/promises";
import net from "node:net";
import { searchImages, webSearchEnabled } from "./mine/web.mjs";
import { normalizeImageStyle, splitImageStyle } from "./shared/chat-media.mjs";

const PUBLIC_ORIGIN = "https://minerva-liart.vercel.app";
const JSON_LIMIT_BYTES = 1_500_000;
const CACHE_MAX_ENTRIES = 200;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 40;

const responseCache = new Map();
const rateBuckets = new Map();

class EducationApiError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "EducationApiError";
    this.status = status;
  }
}

function safeString(value, maxLength = 240) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safeList(values, maxItems = 4, maxLength = 120) {
  if (!Array.isArray(values)) return [];
  return values.map((value) => safeString(value, maxLength)).filter(Boolean).slice(0, maxItems);
}

function queryValue(url, name) {
  return safeString(url.searchParams.get(name), 120);
}

function validatedQuery(url) {
  const query = queryValue(url, "q");
  if (query.length < 2) throw new EducationApiError("Digite pelo menos 2 caracteres para buscar.", 400);
  return query;
}

function validatedLimit(url) {
  const value = Number(url.searchParams.get("limit") || 6);
  if (!Number.isInteger(value)) return 6;
  return Math.min(8, Math.max(1, value));
}

function validatedYear(url) {
  const value = Number(url.searchParams.get("year") || new Date().getFullYear());
  if (!Number.isInteger(value) || value < 2000 || value > 2100) {
    throw new EducationApiError("Ano inválido.", 400);
  }
  return value;
}

function clientKey(req) {
  const forwarded = safeString(req.headers?.["x-forwarded-for"], 160).split(",")[0]?.trim();
  return forwarded || safeString(req.socket?.remoteAddress, 80) || "unknown";
}

function consumeRateLimit(req) {
  const now = Date.now();
  const key = clientKey(req);
  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, remaining: RATE_MAX_REQUESTS - 1, resetAt: now + RATE_WINDOW_MS };
  }
  if (current.count >= RATE_MAX_REQUESTS) return { allowed: false, remaining: 0, resetAt: current.resetAt };
  current.count += 1;
  return { allowed: true, remaining: RATE_MAX_REQUESTS - current.count, resetAt: current.resetAt };
}

function trimCaches() {
  const now = Date.now();
  for (const [key, value] of responseCache) {
    if (value.expiresAt <= now) responseCache.delete(key);
  }
  if (responseCache.size > CACHE_MAX_ENTRIES) {
    for (const key of responseCache.keys()) {
      responseCache.delete(key);
      if (responseCache.size <= CACHE_MAX_ENTRIES) break;
    }
  }
  if (rateBuckets.size > 5_000) {
    for (const [key, value] of rateBuckets) if (value.resetAt <= now) rateBuckets.delete(key);
  }
}

async function cached(key, ttlMs, load) {
  trimCaches();
  const entry = responseCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value;
  const value = await load();
  responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

function appUserAgent() {
  const origin = safeString(process.env.PUBLIC_APP_ORIGIN || PUBLIC_ORIGIN, 200);
  const email = contactEmail();
  return email ? `Minerva/2.0 (${origin}; mailto:${email})` : `Minerva/2.0 (${origin})`;
}

function contactEmail() {
  const value = safeString(process.env.PUBLIC_API_CONTACT_EMAIL, 160);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : "";
}

async function fetchJsonOnce(url, { timeoutMs = 15_000, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json", "user-agent": appUserAgent(), ...headers },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new EducationApiError("A fonte externa está temporariamente indisponível.", 502);
    const raw = await response.text();
    if (raw.length > JSON_LIMIT_BYTES) throw new EducationApiError("A fonte externa retornou dados demais.", 502);
    try {
      return JSON.parse(raw);
    } catch {
      throw new EducationApiError("A fonte externa retornou uma resposta inválida.", 502);
    }
  } catch (error) {
    if (error instanceof EducationApiError) throw error;
    if (controller.signal.aborted) throw new EducationApiError("A fonte externa demorou demais para responder.", 504);
    throw new EducationApiError("Não foi possível consultar a fonte externa agora.", 502);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, { attempts = 2, ...options } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetchJsonOnce(url, options);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function openLibraryUrl(key) {
  const value = safeString(key, 100);
  return /^\/(works|books)\/[A-Za-z0-9._-]+$/.test(value) ? `https://openlibrary.org${value}` : "https://openlibrary.org";
}

function doiUrl(doi) {
  const value = safeString(doi, 180);
  if (!/^10\.\d{4,9}\/\S+$/i.test(value)) return "";
  return `https://doi.org/${value.split("/").map(encodeURIComponent).join("/")}`;
}

function yearFromDateParts(value) {
  const year = Number(value?.["date-parts"]?.[0]?.[0]);
  return Number.isInteger(year) && year >= 1000 && year <= 2100 ? year : undefined;
}

export async function searchBooks(query, limit = 6) {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("lang", "pt");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("fields", "key,title,author_name,first_publish_year,cover_i,isbn,edition_count");
  const data = await fetchJson(url, { attempts: 3 });
  const results = Array.isArray(data?.docs) ? data.docs : [];
  return results.slice(0, limit).map((item, index) => {
    const coverId = Number(item?.cover_i);
    const isbn = safeList(item?.isbn, 1, 24)[0];
    const year = Number(item?.first_publish_year);
    return {
      id: safeString(item?.key, 100) || `book-${index}`,
      title: safeString(item?.title, 220) || "Livro sem título",
      authors: safeList(item?.author_name),
      year: Number.isInteger(year) && year >= 1000 && year <= 2100 ? year : undefined,
      coverUrl: Number.isInteger(coverId) && coverId > 0 ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : undefined,
      isbn,
      editionCount: Math.max(0, Number(item?.edition_count) || 0),
      sourceUrl: openLibraryUrl(item?.key),
      source: "Open Library",
    };
  });
}

export async function searchResearch(query, limit = 6) {
  const url = new URL("https://api.crossref.org/works");
  url.searchParams.set("query.bibliographic", query);
  url.searchParams.set("rows", String(Math.min(16, limit * 2)));
  url.searchParams.set("select", "DOI,title,author,published,created,container-title,type,URL");
  const contact = contactEmail();
  if (contact) url.searchParams.set("mailto", contact);
  const data = await fetchJson(url);
  const items = Array.isArray(data?.message?.items) ? data.message.items : [];
  return items.map((item, index) => {
    const authors = Array.isArray(item?.author)
      ? item.author.map((author) => safeString([author?.given, author?.family].filter(Boolean).join(" "), 120)).filter(Boolean).slice(0, 4)
      : [];
    const doi = safeString(item?.DOI, 180);
    const sourceUrl = doiUrl(doi) || `https://search.crossref.org/?q=${encodeURIComponent(safeString(item?.title?.[0], 180))}`;
    const title = safeString(item?.title?.[0], 260);
    return {
      id: doi || `work-${index}`,
      title,
      authors,
      year: yearFromDateParts(item?.published) || yearFromDateParts(item?.created),
      container: safeString(item?.["container-title"]?.[0], 180),
      doi: doi || undefined,
      type: safeString(item?.type, 60),
      sourceUrl,
      source: "Crossref",
    };
  }).filter((item) => item.title.length >= 3 && !/^https?:\/\//i.test(item.title)).slice(0, limit);
}

/**
 * Foto que ilustra uma resposta da Mine.
 *
 * A Wikipedia foi escolhida por tres motivos praticos: e gratuita e sem chave,
 * a foto e real (a Mine ensina Tesla, nao um retrato inventado por um gerador
 * de imagem) e ja vem com uma pagina de origem para creditar. O termo de busca
 * vem do marcador que a Mine escreve na resposta.
 *
 * Portugues primeiro, ingles como reserva: muito artigo em pt-BR nao tem foto
 * associada, e cair no en.wikipedia salva o caso sem mudar o assunto — a foto e
 * a mesma do Commons.
 */
const IMAGE_LANGS = ["pt", "en"];
// Os dois hosts de arquivo da Wikimedia. `thumb` nao e detalhe: e de onde vem a
// miniatura de artigo ilustrado com SVG (celula, esquema, mapa) — justamente os
// assuntos escolares. Com so `upload` na lista, "Mitocondria" era recusada e a
// busca caia no proximo resultado, devolvendo a foto de outro artigo.
const IMAGE_FILE_HOSTS = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);
const IMAGE_MIN_SIDE = 120;

/**
 * A URL da foto vem de fora e vai direto para o `src` de um `<img>` no
 * navegador. So passa o que estiver num host de arquivos da Wikimedia, em
 * https: um redirecionamento para outro dominio nao pode virar imagem no chat.
 */
function wikimediaFileUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || !IMAGE_FILE_HOSTS.has(url.hostname)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeTitle(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const TITLE_STOPWORDS = new Set(["de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas", "um", "uma", "the", "of"]);

function significantWords(value) {
  return normalizeTitle(value)
    .split(" ")
    .filter((word) => word.length >= 3 && !TITLE_STOPWORDS.has(word));
}

/**
 * O resultado da busca fala do assunto pedido?
 *
 * Uma foto errada e pior que nenhuma: a Mine escreve sobre mitocondria e o
 * leitor ve um cartaz de eucariontes.
 *
 * A comparacao e por palavra e nao por trecho: "Constituicao de 1988" e
 * respondida pelo artigo "Constituicao brasileira de 1988", que nao contem o
 * termo como pedaco de texto por causa do "brasileira" no meio. Vale nos dois
 * sentidos porque o titulo pode ser mais curto que o pedido — "Coracao"
 * responde "Coracao humano".
 */
function titleAnswersQuery(title, query) {
  const found = significantWords(title);
  const asked = significantWords(query);
  if (!found.length || !asked.length) return false;
  const contem = (lista, palavras) => palavras.every((palavra) => lista.includes(palavra));
  return contem(found, asked) || contem(asked, found);
}

function wikipediaPageUrl(value, lang) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.hostname !== `${lang}.wikipedia.org`) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function wikipediaApiUrl(lang, params) {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("prop", "pageimages|info");
  url.searchParams.set("piprop", "thumbnail");
  url.searchParams.set("pithumbsize", "960");
  url.searchParams.set("inprop", "url");
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  return url;
}

function imageFromPage(page, lang) {
  const source = wikimediaFileUrl(page?.thumbnail?.source);
  const width = Number(page?.thumbnail?.width) || 0;
  const height = Number(page?.thumbnail?.height) || 0;
  // Icone de bandeirinha ou selo de artigo nao ilustra nada.
  if (!source || width < IMAGE_MIN_SIDE || height < IMAGE_MIN_SIDE) return null;
  return {
    url: source,
    width,
    height,
    title: safeString(page?.title, 160),
    pageUrl: wikipediaPageUrl(page?.canonicalurl || page?.fullurl, lang),
    source: lang === "pt" ? "Wikipédia" : "Wikipedia (inglês)",
  };
}

/**
 * Nome de arquivo que denuncia marca, e nao a coisa em si.
 *
 * Artigo de produto, marca, empresa, time ou jogo costuma ter o LOGOTIPO como
 * imagem de abertura. Foi o que aconteceu com "Nintendo Switch 2": o aluno
 * perguntou como o console e e recebeu um retangulo vermelho escrito Switch 2.
 * Nao adianta cair para o ingles — o artigo de la abre com o mesmo logotipo.
 */
const LOGO_FILENAME = /(?:^|[ _-])(?:logo|logotipo|logotype|wordmark|marca|emblema?|brasao|escudo|simbolo|symbol|icone|icon|seal|crest|badge)(?:[ _.-]|$)/i;

function looksLikeLogo(filename) {
  return LOGO_FILENAME.test(String(filename || "").normalize("NFD").replace(/\p{Diacritic}/gu, ""));
}

/**
 * Foto de verdade dentro do artigo, para quando a de abertura e logotipo.
 *
 * O filtro que carrega o peso e a sobreposicao de palavras com o titulo: ela
 * elimina sozinha a tralha de interface que todo artigo carrega ("Symbol
 * category class", "Crystal Clear app package games", "Elongated circle"), sem
 * precisar de uma lista de icones da Wikipedia que envelheceria.
 */
async function articlePhoto(title, lang) {
  const data = await fetchJson(
    wikipediaApiUrl(lang, {
      titles: title,
      redirects: "1",
      generator: "images",
      gimlimit: "25",
      prop: "imageinfo",
      iiprop: "url|size",
      iiurlwidth: "960",
    }),
  );
  const pages = Array.isArray(data?.query?.pages) ? data.query.pages : [];
  const desejadas = significantWords(title);
  const candidatas = [];

  for (let ordem = 0; ordem < pages.length; ordem += 1) {
    const page = pages[ordem];
    // "Ficheiro:"/"File:" sai do titulo; o que sobra e o nome do arquivo.
    const nome = safeString(page?.title, 200).replace(/^[^:]+:/, "");
    if (!nome || looksLikeLogo(nome)) continue;
    const info = Array.isArray(page?.imageinfo) ? page.imageinfo[0] : null;
    const url = wikimediaFileUrl(info?.thumburl);
    const width = Number(info?.thumbwidth) || 0;
    const height = Number(info?.thumbheight) || 0;
    if (!url || width < IMAGE_MIN_SIDE || height < IMAGE_MIN_SIDE) continue;
    const encaixe = significantWords(nome).filter((palavra) => desejadas.includes(palavra)).length;
    if (!encaixe) continue;
    // Deitada antes de em pe: o cartao da conversa e mais largo que alto, e uma
    // foto muito vertical costuma ser detalhe de uma peca, nao a coisa inteira.
    candidatas.push({ url, width, height, ordem, encaixe, deitada: width >= height * 0.8 ? 0 : 1 });
  }

  candidatas.sort((a, b) => b.encaixe - a.encaixe || a.deitada - b.deitada || a.ordem - b.ordem);
  return candidatas[0] || null;
}

async function pageImageByTitle(title, lang) {
  const data = await fetchJson(wikipediaApiUrl(lang, { titles: title, redirects: "1", piprop: "thumbnail|name" }));
  const page = Array.isArray(data?.query?.pages) ? data.query.pages[0] : null;
  if (!page || page.missing) return null;

  const image = imageFromPage(page, lang);
  if (image && !looksLikeLogo(page.pageimage)) return image;

  // A de abertura e logotipo: procura no resto do artigo antes de desistir dela.
  const foto = await articlePhoto(page.title || title, lang);
  if (foto) {
    return {
      url: foto.url,
      width: foto.width,
      height: foto.height,
      title: safeString(page.title, 160),
      pageUrl: wikipediaPageUrl(page.canonicalurl || page.fullurl, lang),
      source: lang === "pt" ? "Wikipédia" : "Wikipedia (inglês)",
    };
  }
  // Sem foto melhor, o logotipo ainda diz mais que nada.
  return image;
}

/**
 * "Existe um artigo com esse nome?", perguntado do jeito tolerante.
 *
 * O `nearmatch` da Wikipedia ignora acento e maiuscula e atravessa
 * redirecionamento, que e exatamente o que falta ao titulo cru: a Mine escreve
 * "Violao" (sem til, como modelo costuma escrever) e o artigo se chama
 * "Guitarra classica". Para uma palavra inventada ele nao devolve nada, entao
 * continua sendo uma resposta confiavel e nao um chute.
 */
async function nearMatchTitle(query, lang) {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("list", "search");
  url.searchParams.set("srwhat", "nearmatch");
  url.searchParams.set("srlimit", "1");
  url.searchParams.set("srsearch", query);
  const data = await fetchJson(url);
  return safeString(data?.query?.search?.[0]?.title, 200);
}

/**
 * Tres tentativas, da mais confiavel para a menos.
 *
 * 1. O artigo com aquele nome exato — a Mine e instruida a escrever o termo
 *    como titulo de enciclopedia, entao quase sempre acerta aqui.
 * 2. O nome aproximado, que resolve acento faltando e sinonimo com
 *    redirecionamento. Ainda e "o artigo daquele nome", entao vale sem filtro.
 * 3. A busca em texto completo, para o resto. Aqui o resultado pode ser um
 *    artigo que apenas MENCIONA o assunto, e por isso passa pelo filtro de
 *    relevancia antes de virar foto.
 */
async function searchWikipediaImage(query, lang) {
  const exato = await pageImageByTitle(query, lang);
  if (exato) return exato;

  // A comparacao e com o texto cru, e nao normalizado: "Violao" e "VIOLÃO" sao
  // a mesma coisa depois de normalizar, mas e exatamente a diferenca de acento
  // e caixa que faz o segundo achar o redirecionamento que o primeiro perdeu.
  const aproximado = await nearMatchTitle(query, lang);
  if (aproximado && aproximado !== query) {
    const image = await pageImageByTitle(aproximado, lang);
    if (image) return image;
  }

  const found = await fetchJson(
    wikipediaApiUrl(lang, { generator: "search", gsrsearch: query, gsrlimit: "6", gsrnamespace: "0" }),
  );
  const pages = Array.isArray(found?.query?.pages) ? found.query.pages : [];
  // O gerador devolve as paginas fora de ordem; `index` e a posicao na busca.
  const ordered = [...pages].sort((a, b) => (Number(a?.index) || 99) - (Number(b?.index) || 99));

  for (const page of ordered) {
    if (!titleAnswersQuery(page?.title, query)) continue;
    const image = imageFromPage(page, lang);
    if (image) return image;
  }
  return null;
}


// Palavras que denunciam um pedido de CENA, nao de uma coisa com nome: um
// exemplo, uma tela de programa, um esquema. A Wikipedia responde isso com o
// artigo do assunto, e a imagem de abertura do artigo e o logotipo ou uma foto
// generica — "planilha simples no Excel" nao pode virar o icone do Excel.
const DESCRIPTIVE_IMAGE_WORDS = new Set([
  "exemplo", "exemplos", "planilha", "tela", "captura", "print", "screenshot", "grafico", "graficos",
  "diagrama", "esquema", "modelo", "tabela", "interface", "passo", "tutorial", "fases", "etapas",
  "estrutura", "desenho", "ilustracao", "mapa", "circuito", "experimento", "funcionando", "dentro",
]);

/** O pedido descreve uma cena (web primeiro) ou nomeia uma coisa (Wikipedia primeiro)? */
export function isDescriptiveImageQuery(query) {
  const words = significantWords(query);
  if (words.some((word) => DESCRIPTIVE_IMAGE_WORDS.has(word))) return true;
  // Nome proprio raramente passa de tres palavras significativas; frase passa.
  return words.length >= 4;
}

async function searchWikipediaAnyLang(query) {
  let searched = false;
  let lastError;
  for (const lang of IMAGE_LANGS) {
    try {
      const image = await searchWikipediaImage(query, lang);
      searched = true;
      if (image) return { image, searched };
    } catch (error) {
      // Um idioma fora do ar nao impede a tentativa no outro.
      lastError = error;
    }
  }
  return { image: null, searched, lastError };
}

// ---------------------------------------------------------------------------
// Galeria de fotos da Mine (set/2026)
//
// Cada marcador `[[imagem: termo]]` vira uma galeria, como a do ChatGPT: varias
// fotos do mesmo assunto, abertas num visualizador com download. A primeira e a
// da Wikipedia quando o termo e um nome (a foto "oficial" do artigo); as demais
// vem da busca de imagens da web, filtradas pela mesma regra de relevancia.

const GALLERY_MAX = 8;

// ---------------------------------------------------------------------------
// Segurança e relevância das fotos da web
//
// A busca de imagens da NanoGPT (Brave) não aceita o parâmetro de filtro de
// conteúdo adulto, e em set/2026 uma busca por "Ellie Williams" trouxe uma foto
// com "R34" no título. Minerva é usado por estudantes a partir de 12 anos: o
// filtro mora aqui, em cima do título, do endereço e da fonte de cada foto, e
// vale também para o termo pedido (termo impróprio não vira galeria nenhuma).

const UNSAFE_TERMS = [
  "r34", "rule34", "rule 34", "nsfw", "nude", "nudes", "nudity", "naked", "nua", "nuas", "nu frontal",
  "porn", "porno", "pornografia", "pornographic", "xxx", "hentai", "ecchi", "lewd", "erotic", "erotica",
  "erotico", "erotica", "sex", "sexo", "sexy", "sensual", "onlyfans", "fansly", "fetish", "fetiche",
  "lingerie", "topless", "boobs", "tits", "thong", "futa", "18+", "adult only", "only adults",
  "playboy", "camgirl", "stripper", "bdsm", "yiff", "waifu nsfw",
];
const UNSAFE_HOSTS = [
  "rule34", "e621.net", "gelbooru", "danbooru", "nhentai", "hentai", "pornhub", "xvideos", "xnxx", "xhamster",
  "redtube", "youporn", "onlyfans", "fansly", "sankakucomplex", "f95zone", "motherless",
];

function foldText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function hasUnsafeTerm(text) {
  const folded = ` ${foldText(text).replace(/[^a-z0-9+]+/g, " ")} `;
  return UNSAFE_TERMS.some((term) => folded.includes(` ${term} `));
}

export function isUnsafeImage(image) {
  let decoded = `${image.pageUrl || ""} ${image.full || ""}`;
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // endereço com % solto: confere como veio
  }
  const hosts = foldText(`${image.pageUrl || ""} ${image.full || ""} ${image.source || ""}`);
  if (UNSAFE_HOSTS.some((host) => hosts.includes(host))) return true;
  return hasUnsafeTerm(`${image.title || ""} ${decoded} ${image.source || ""}`);
}

export function isUnsafeQuery(query) {
  return hasUnsafeTerm(query);
}

// Título que não descreve nada: comentário do Reddit, "resultado de imagem".
// Só entra se o próprio título citar o assunto — o endereço não basta.
const GENERIC_TITLE = /^(?:imagem|imagen|image|foto|photo|picture|pic)(?:\s+(?:do|de|del|result|resultado|of|the))?(?:\s+(?:comentario|comentário|comment|result|resultado))?\.?$/i;

// Coisas que parecem o assunto mas mostram outra pessoa: cosplay, "recast"
// (outra atriz no papel), montagem de fã. Entram só se o pedido citar.
const LOOKALIKE = ["cosplay", "cosplayer", "recast", "fancast", "fan cast", "deepfake", "lookalike", "sosia", "sósia"];

/**
 * Pontua uma foto para o termo pedido. `null` = descartar.
 * O título pesa mais que o endereço da página: o endereço de um post do Reddit
 * cita o assunto mesmo quando a foto do comentário é de outra coisa.
 */
export function scoreImage(image, asked, query, { loose = false } = {}) {
  if (!asked.length) return null;
  const title = String(image.title || "").trim();
  const titleWords = significantWords(title);
  let pageText = String(image.pageUrl || "");
  try {
    pageText = decodeURIComponent(pageText);
  } catch {
    // compara como veio
  }
  const pageWords = significantWords(pageText);
  const inTitle = asked.filter((word) => titleWords.includes(word)).length;
  const inAny = asked.filter((word) => titleWords.includes(word) || pageWords.includes(word)).length;
  // Folga só com 3+ palavras: "Lucia Caminos GTA 6 trailer" ainda exige metade,
  // e um nome de duas palavras continua exigindo as duas.
  const required = asked.length <= 2 ? asked.length : Math.ceil(asked.length * (loose ? 0.5 : 0.6));

  if (!title || GENERIC_TITLE.test(title)) {
    if (inTitle === 0) return null;
  }
  // O título precisa citar o assunto; o endereço só completa.
  if (inTitle === 0) return null;
  if (inAny < required) return null;

  const askedText = foldText(query);
  const titleText = foldText(title);
  if (LOOKALIKE.some((term) => titleText.includes(term) && !askedText.includes(term))) return null;

  return inTitle * 2 + inAny;
}

// Post de rede social junta foto de qualquer coisa nos comentários: o endereço
// do post citar o assunto não garante nada sobre a foto.
const SOCIAL_HOSTS = /(?:^|\.)(?:reddit\.com|redd\.it|x\.com|twitter\.com|tiktok\.com|facebook\.com|instagram\.com|threads\.net|tumblr\.com|youtube\.com)$/i;

/**
 * Última tentativa, para galeria que ficaria com menos de 3 fotos: aceita foto
 * de título vazio ("Image result") quando a PÁGINA é sobre o assunto — o
 * endereço (site + caminho) cita a maior parte das palavras pedidas, como
 * wikigta6.com/lucia2/ para "Lucia GTA 6". Rede social fica de fora.
 */
export function scoreByPage(image, asked) {
  let page;
  try {
    page = new URL(image.pageUrl);
  } catch {
    return null;
  }
  if (SOCIAL_HOSTS.test(page.hostname)) return null;
  let path = page.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // compara como veio
  }
  const haystack = foldText(`${page.hostname} ${path}`).replace(/[^a-z0-9]+/g, " ");
  const hits = asked.filter((word) => haystack.includes(word)).length;
  const required = asked.length <= 2 ? asked.length : Math.ceil(asked.length * 0.5);
  return hits >= required ? 1 : null;
}

// ---------------------------------------------------------------------------
// Estilos de imagem (out/2026)
//
// Cada estilo muda as tres coisas que decidem uma galeria: o que se digita na
// busca (a palavra de estilo em ingles, que e como os titulos do Pinterest e
// dos sites de wallpaper estao escritos), o que se descarta (icone e logo nao
// podem cair no filtro anti-logotipo) e o que sobe na ordem (formato
// quadrado para icone, paisagem grande para wallpaper). Wikipedia fica de
// fora: a foto do artigo e da atriz, nao o icone da personagem.

const STYLE_PROFILES = {
  icone: {
    searches: ["icon", "pfp"],
    allowLogo: true,
    minSide: 150,
    words: ["icon", "icons", "pfp", "pfps", "avatar", "profile", "icone", "icones", "matching"],
    shape: (ratio) => (ratio >= 0.8 && ratio <= 1.25 ? 4 : ratio > 1.7 || ratio < 0.5 ? -3 : 0),
  },
  wallpaper: {
    searches: ["wallpaper 4k", "wallpaper"],
    allowLogo: false,
    minSide: 700,
    words: ["wallpaper", "wallpapers", "4k", "background", "backgrounds", "hd", "1080p", "desktop", "iphone", "phone"],
    shape: (ratio, width) => (ratio >= 1.5 || ratio <= 0.62 ? 3 : 0) + (width >= 1600 ? 2 : 0),
  },
  desenho: {
    searches: ["fan art", "drawing illustration"],
    allowLogo: false,
    minSide: 200,
    words: ["art", "fanart", "drawing", "illustration", "sketch", "artwork", "desenho", "ilustracao", "deviantart", "artstation"],
    shape: () => 0,
  },
  logo: {
    searches: ["logo", "logo png"],
    allowLogo: true,
    minSide: 100,
    words: ["logo", "logotipo", "emblem", "crest", "escudo", "symbol", "brand"],
    shape: (ratio) => (ratio >= 0.6 && ratio <= 1.7 ? 1 : 0),
  },
};

/** Sites onde a imagem costuma ser do estilo pedido (bonus pequeno, nunca obrigatorio). */
const STYLE_HOSTS = {
  icone: /(?:^|\.)(?:pinterest\.[a-z.]+|pinimg\.com|tumblr\.com|we-heart-it\.com|weheartit\.com)$/i,
  wallpaper: /(?:^|\.)(?:wallpaperaccess\.com|wallpapercave\.com|wallpaperflare\.com|wallhaven\.cc|alphacoders\.com|uhdpaper\.com|hdqwalls\.com|wallpapers\.com)$/i,
  desenho: /(?:^|\.)(?:deviantart\.com|artstation\.com|pixiv\.net|tumblr\.com|pinterest\.[a-z.]+)$/i,
  logo: /(?:^|\.)(?:wikimedia\.org|wikipedia\.org|seeklogo\.com|logowik\.com|1000logos\.net|logos-world\.net|brandsoftheworld\.com)$/i,
};

function hostOfUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Pontuacao para um estilo. O assunto ainda manda: o titulo ou a pagina
 * precisam citar as palavras do NOME (as duas primeiras significativas — o
 * resto do termo, como a obra, so soma). Exigir 60% de "Ellie Williams The
 * Last of Us Part II" derrubava justamente os icones, que tem titulo curto
 * ("ellie icon"). `null` = descartar.
 */
export function scoreStyledImage(image, asked, query, style) {
  const profile = STYLE_PROFILES[style];
  if (!profile || !asked.length) return null;
  const title = String(image.title || "").trim();
  let pageText = String(image.pageUrl || "");
  try {
    pageText = decodeURIComponent(pageText);
  } catch {
    // compara como veio
  }
  const titleWords = significantWords(title);
  const pageWords = significantWords(pageText);
  const core = asked.slice(0, Math.min(2, asked.length));
  const coreHits = core.filter((word) => titleWords.includes(word) || pageWords.includes(word)).length;
  // Nome de duas palavras: basta uma no titulo e a outra em qualquer lugar
  // ("ellie icon" numa pagina /ellie-williams-tlou/).
  if (!core.some((word) => titleWords.includes(word))) return null;
  if (coreHits < core.length) return null;
  const askedText = foldText(query);
  const titleText = foldText(title);
  if (LOOKALIKE.some((term) => titleText.includes(term) && !askedText.includes(term))) return null;

  const restHits = asked.slice(core.length).filter((word) => titleWords.includes(word) || pageWords.includes(word)).length;
  const styleText = ` ${foldText(`${title} ${pageText}`).replace(/[^a-z0-9]+/g, " ")} `;
  const styleHit = profile.words.some((word) => styleText.includes(` ${word} `));
  const ratio = image.width && image.height ? image.width / image.height : 0;
  const host = hostOfUrl(image.pageUrl);
  return coreHits * 3 + restHits + (styleHit ? 4 : 0) + (ratio ? profile.shape(ratio, image.width || 0) : 0) + (STYLE_HOSTS[style]?.test(host) ? 1 : 0);
}

async function searchWebImageList(query, style = "") {
  if (!webSearchEnabled() || isUnsafeQuery(query)) return [];
  const asked = significantWords(query);
  if (!asked.length) return [];
  const profile = STYLE_PROFILES[style];
  // Com estilo, duas buscas em paralelo ("Ellie Williams icon", "... pfp"):
  // uma so traz poucas imagens do estilo e a galeria fica com 2 ou 3.
  const searches = profile ? profile.searches.map((suffix) => `${query} ${suffix}`) : [query];
  const settled = await Promise.allSettled(searches.map((term) => searchImages(term)));
  const fulfilled = settled.filter((item) => item.status === "fulfilled");
  if (!fulfilled.length) throw settled[0]?.reason || new Error("busca de imagens falhou");
  const lists = fulfilled.map((item) => item.value.images);
  // Intercala os resultados das buscas, sem repetir arquivo.
  const images = [];
  const seenUrls = new Set();
  for (let rankIndex = 0; lists.some((list) => rankIndex < list.length); rankIndex += 1) {
    for (const list of lists) {
      const image = list[rankIndex];
      if (!image || seenUrls.has(image.url)) continue;
      seenUrls.add(image.url);
      images.push(image);
    }
  }
  const minSide = profile?.minSide ?? IMAGE_MIN_SIDE;
  const candidates = [];
  images.forEach((image, order) => {
    const candidate = {
      url: image.url,
      full: image.original || image.url,
      width: image.width,
      height: image.height,
      title: safeString(image.title || query, 160),
      pageUrl: image.pageUrl.startsWith("https://") ? image.pageUrl : "",
      source: safeString(image.source || "Web", 80),
    };
    if (isUnsafeImage(candidate)) return;
    if (!profile?.allowLogo && looksLikeLogo(`${image.title} ${image.pageUrl}`)) return;
    if ((image.width && image.width < minSide) || (image.height && image.height < minSide)) return;
    candidates.push({ candidate, order });
  });
  if (profile) {
    const scored = candidates
      .map(({ candidate, order }) => ({ candidate, order, score: scoreStyledImage(candidate, asked, query, style) }))
      .filter((item) => item.score !== null)
      .sort((a, b) => b.score - a.score || a.order - b.order);
    console.log(`[image] web estilo=${style} buscas=${searches.length} imagens=${images.length} aceitas=${scored.length}`);
    return scored.map((item) => item.candidate);
  }
  const rank = (loose) =>
    candidates
      .map(({ candidate, order }) => ({ candidate, order, score: scoreImage(candidate, asked, query, { loose }) }))
      .filter((item) => item.score !== null);
  // Galeria com menos de 3 fotos parece quebrada: se a regra estrita deixou
  // pouco, tenta de novo com metade das palavras (o título ainda precisa citar
  // o assunto, e o filtro de conteúdo já passou).
  let scored = rank(false);
  if (scored.length < 3) scored = rank(true);
  if (scored.length < 3) {
    const seen = new Set(scored.map((item) => item.candidate.url));
    for (const { candidate, order } of candidates) {
      if (seen.has(candidate.url)) continue;
      const score = scoreByPage(candidate, asked);
      if (score !== null) scored.push({ candidate, order, score });
    }
  }
  // Mais relevante primeiro; empate mantém a ordem da busca.
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  console.log(`[image] web imagens=${images.length} aceitas=${scored.length}`);
  return scored.map((item) => item.candidate);
}

async function searchWebImage(query) {
  return (await searchWebImageList(query))[0] || null;
}

/**
 * Galeria para um termo: ate 8 fotos, sem repetir pagina nem arquivo.
 * Lanca erro so quando NENHUMA fonte pode ser consultada (a lista vazia de
 * "procurei e nao achei" fica em cache; a falha de rede nao).
 */
export async function searchImageGallery(query, style = "") {
  // Estilo pedido (icone, wallpaper, desenho, logo): so a busca da web, com
  // as regras daquele estilo. A Wikipedia traria a foto do artigo.
  if (STYLE_PROFILES[style]) {
    if (!webSearchEnabled()) return [];
    let list = await searchWebImageList(query, style);
    // Estilo raro para o assunto: completa com a busca comum da web em vez de
    // mostrar uma galeria vazia (ainda sem Wikipedia).
    if (list.length < 3) list = [...list, ...(await searchWebImageList(query).catch(() => []))];
    const seenFiles = new Set();
    return list.filter((image) => {
      const key = image.full || image.url;
      if (seenFiles.has(key)) return false;
      seenFiles.add(key);
      return true;
    }).slice(0, GALLERY_MAX);
  }
  const webFirst = isDescriptiveImageQuery(query);
  let searched = false;
  let lastError;

  const fromWeb = async () => {
    try {
      const list = await searchWebImageList(query);
      if (webSearchEnabled()) searched = true;
      return list;
    } catch (error) {
      lastError = lastError || error;
      return [];
    }
  };
  const fromWikipedia = async () => {
    const result = await searchWikipediaAnyLang(query);
    searched = searched || result.searched;
    lastError = lastError || result.lastError;
    const image = result.image ? { ...result.image, full: result.image.url } : null;
    return image && !isUnsafeImage(image) && !isUnsafeQuery(query) ? [image] : [];
  };

  // Cena ("planilha simples no Excel") vai para a web; nome ("Nikola Tesla")
  // abre com a foto do artigo e completa com a web. As duas buscas rodam juntas.
  const [first, second] = await Promise.all(webFirst ? [fromWeb(), fromWikipedia()] : [fromWikipedia(), fromWeb()]);
  const merged = webFirst && first.length ? first : [...first, ...second];

  const seen = new Set();
  const images = [];
  for (const image of merged) {
    const key = (image.pageUrl || "") + "|" + (image.full || image.url);
    const fileKey = image.full || image.url;
    if (seen.has(key) || seen.has(fileKey)) continue;
    seen.add(key);
    seen.add(fileKey);
    images.push(image);
    if (images.length >= GALLERY_MAX) break;
  }

  if (!images.length && !searched) throw lastError || new EducationApiError("Não foi possível buscar a imagem agora.", 502);
  return images;
}

export async function searchEducationalImage(query) {
  return (await searchImageGallery(query))[0] || null;
}

// ---------------------------------------------------------------------------
// Download de foto
//
// O navegador so respeita `<a download>` na mesma origem: uma foto de
// pinimg.com ou wikimedia.org abria numa aba em vez de baixar. Esta rota busca
// a foto no servidor e devolve como anexo. Como ela busca um endereco que veio
// de fora, fecha as portas de SSRF: so https, nada de IP privado ou local (o
// DNS e checado a cada salto de redirecionamento), so conteudo de imagem, e
// ate 4,4 MB — o teto de resposta de uma funcao na Vercel e 4,5 MB.

const DOWNLOAD_MAX_BYTES = 4_400_000;
const DOWNLOAD_TIMEOUT_MS = 12_000;

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const lower = address.toLowerCase();
  return (
    lower === "::" || lower === "::1" ||
    lower.startsWith("fc") || lower.startsWith("fd") ||
    lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb") ||
    (lower.startsWith("::ffff:") && isPrivateAddress(lower.slice(7)))
  );
}

async function assertPublicHttps(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new EducationApiError("Endereço de imagem inválido.", 400);
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new EducationApiError("Endereço de imagem não permitido.", 400);
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new EducationApiError("Endereço de imagem não permitido.", 400);
    return url;
  }
  const addresses = await dns.lookup(host, { all: true }).catch(() => []);
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new EducationApiError("Endereço de imagem não permitido.", 400);
  }
  return url;
}

async function fetchImageBytes(rawUrl) {
  let current = await assertPublicHttps(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    for (let hop = 0; hop < 4; hop += 1) {
      const response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": appUserAgent(), accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8" },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new EducationApiError("A imagem não pôde ser baixada.", 502);
        current = await assertPublicHttps(new URL(location, current).toString());
        continue;
      }
      if (!response.ok) throw new EducationApiError("A imagem não pôde ser baixada.", 502);
      const type = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!type.startsWith("image/") || type.includes("svg")) throw new EducationApiError("O endereço não é uma imagem.", 415);
      const declared = Number(response.headers.get("content-length") || 0);
      if (declared > DOWNLOAD_MAX_BYTES) throw new EducationApiError("A imagem é grande demais.", 413);
      const chunks = [];
      let total = 0;
      for await (const chunk of response.body) {
        total += chunk.length;
        if (total > DOWNLOAD_MAX_BYTES) throw new EducationApiError("A imagem é grande demais.", 413);
        chunks.push(chunk);
      }
      return { type, bytes: Buffer.concat(chunks) };
    }
    throw new EducationApiError("A imagem não pôde ser baixada.", 502);
  } finally {
    clearTimeout(timer);
  }
}

const IMAGE_EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };

function downloadName(value, type) {
  const base =
    String(value || "imagem")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "imagem";
  return `${base}.${IMAGE_EXTENSIONS[type] || "jpg"}`;
}

/** Tenta a foto original; se ela falhar (grande, bloqueada, fora do ar), a miniatura. */
async function handleImageDownload(url, res, rate) {
  const sources = [url.searchParams.get("src"), url.searchParams.get("fallback")].filter(Boolean).slice(0, 2);
  if (!sources.length) {
    sendJson(res, 400, { error: "Informe a imagem." }, { rate });
    return;
  }
  let lastError;
  for (const source of sources) {
    try {
      const { type, bytes } = await fetchImageBytes(source);
      const name = downloadName(url.searchParams.get("name"), type);
      res.writeHead(200, {
        "content-type": type,
        "content-length": String(bytes.length),
        "content-disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'",
      });
      res.end(bytes);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  const status = lastError instanceof EducationApiError ? lastError.status : 502;
  sendJson(res, status, { error: lastError instanceof EducationApiError ? lastError.message : "A imagem não pôde ser baixada." }, { rate });
}

export async function fetchBrazilHolidays(year) {
  const url = new URL(`https://date.nager.at/api/v3/PublicHolidays/${year}/BR`);
  const data = await fetchJson(url);
  if (!Array.isArray(data)) return [];
  return data
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(String(item?.date || "")))
    .map((item) => ({
      date: String(item.date),
      localName: safeString(item?.localName, 140) || safeString(item?.name, 140) || "Feriado",
      name: safeString(item?.name, 140),
      global: Boolean(item?.global),
      counties: safeList(item?.counties, 16, 16),
      types: safeList(item?.types, 8, 40),
      source: "Nager.Date",
    }));
}

function sendJson(res, status, payload, { cacheSeconds = 0, rate } = {}) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
    "cache-control": cacheSeconds
      ? `public, max-age=60, s-maxage=${cacheSeconds}, stale-while-revalidate=86400`
      : "no-store",
  };
  if (rate) {
    headers["x-ratelimit-limit"] = String(RATE_MAX_REQUESTS);
    headers["x-ratelimit-remaining"] = String(rate.remaining);
    headers["x-ratelimit-reset"] = String(Math.ceil(rate.resetAt / 1000));
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
}

export async function handleEducationRequest(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers?.host || "localhost"}`);
  const routes = new Set(["/api/library", "/api/research", "/api/holidays", "/api/image", "/api/image-download"]);
  if (!routes.has(url.pathname)) return false;

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Método não permitido." });
    return true;
  }

  const rate = consumeRateLimit(req);
  if (!rate.allowed) {
    sendJson(res, 429, { error: "Muitas consultas em pouco tempo. Aguarde um minuto e tente novamente." }, { rate });
    return true;
  }

  try {
    if (url.pathname === "/api/library") {
      const query = validatedQuery(url);
      const limit = validatedLimit(url);
      const results = await cached(`library:${query.toLocaleLowerCase("pt-BR")}:${limit}`, 15 * 60_000, () => searchBooks(query, limit));
      sendJson(res, 200, { results, source: "Open Library" }, { cacheSeconds: 900, rate });
      return true;
    }
    if (url.pathname === "/api/research") {
      const query = validatedQuery(url);
      const limit = validatedLimit(url);
      const results = await cached(`research:${query.toLocaleLowerCase("pt-BR")}:${limit}`, 15 * 60_000, () => searchResearch(query, limit));
      sendJson(res, 200, { results, source: "Crossref" }, { cacheSeconds: 900, rate });
      return true;
    }

    if (url.pathname === "/api/image-download") {
      await handleImageDownload(url, res, rate);
      return true;
    }

    if (url.pathname === "/api/image") {
      // Palavra de estilo que escapou para o termo ("Ellie icon") vira estilo.
      const split = splitImageStyle(validatedQuery(url));
      const query = split.query;
      const style = normalizeImageStyle(queryValue(url, "estilo")) || split.style;
      // Cache de um dia: a mesma conversa reaberta, e conversas diferentes sobre
      // o mesmo assunto, nao precisam bater na Wikipedia de novo. `image: null`
      // tambem entra no cache — assunto sem foto boa continua sem foto.
      const images = await cached(`gallery:${style}:${query.toLocaleLowerCase("pt-BR")}`, 24 * 60 * 60_000, () =>
        searchImageGallery(query, style),
      );
      // `image` continua existindo para quem ainda le uma foto so.
      sendJson(res, 200, { image: images[0] || null, images, query, style }, { cacheSeconds: 86_400, rate });
      return true;
    }

    const year = validatedYear(url);
    const results = await cached(`holidays:${year}`, 24 * 60 * 60_000, () => fetchBrazilHolidays(year));
    sendJson(res, 200, { results, year, source: "Nager.Date" }, { cacheSeconds: 86_400, rate });
    return true;
  } catch (error) {
    const status = error instanceof EducationApiError ? error.status : 500;
    const message = error instanceof EducationApiError ? error.message : "Não foi possível concluir a consulta agora.";
    sendJson(res, status, { error: message }, { rate });
    return true;
  }
}
