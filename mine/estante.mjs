/**
 * Prévias da página da matéria (21/nov/2026): vídeos do YouTube e livros.
 *
 * Vídeos: busca do próprio YouTube (innertube, cliente WEB), a mesma API que
 * o site do YouTube usa. Não gasta a busca na web da NanoGPT e devolve IDs
 * reais, que o site toca no player embutido (youtube-nocookie).
 *
 * Livros: Google Livros primeiro (capa e prévia oficial quando a editora
 * permite) e Open Library / Internet Archive como reserva (capa e, para obra
 * em domínio público, o livro inteiro). Nada de cópia pirata: só o que as
 * próprias plataformas liberam para leitura embutida.
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

async function getJson(url, { method = "GET", body, headers = {}, timeoutMs = 7000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method, body, headers: { accept: "application/json", "user-agent": UA, ...headers }, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

const cache = new Map();
function lembrar(key, valor) {
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  cache.set(key, { valor, ate: Date.now() + 6 * 60 * 60 * 1000 });
  return valor;
}
function lembrado(key) {
  const hit = cache.get(key);
  return hit && hit.ate > Date.now() ? hit.valor : undefined;
}

const texto = (value, max = 200) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

/** Até `max` vídeos do YouTube para a consulta. */
export async function buscarVideos(query, { max = 6 } = {}) {
  const q = texto(query, 160);
  if (q.length < 2) return [];
  const key = `v:${q}`;
  const salvo = lembrado(key);
  if (salvo) return salvo.slice(0, max);
  const data = await getJson("https://www.youtube.com/youtubei/v1/search?prettyPrint=false", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: "2.20241101.00.00", hl: "pt", gl: "BR" } }, query: q }),
  });
  const videos = [];
  (function andar(no) {
    if (!no || typeof no !== "object" || videos.length >= 12) return;
    if (no.videoRenderer) {
      const v = no.videoRenderer;
      const id = String(v.videoId || "");
      // Ao vivo e vídeo sem duração (lives, estreias) ficam de fora.
      if (/^[\w-]{11}$/.test(id) && v.lengthText?.simpleText) {
        videos.push({
          id,
          titulo: texto(v.title?.runs?.map((run) => run.text).join(""), 140),
          canal: texto(v.ownerText?.runs?.[0]?.text, 60),
          duracao: texto(v.lengthText.simpleText, 10),
          thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
        });
      }
      return;
    }
    for (const chave of Object.keys(no)) andar(no[chave]);
  })(data);
  return lembrar(key, videos).slice(0, max);
}

function palavras(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);
}

/** Pelo menos 70% das palavras do título pedido aparecem no título encontrado. */
function parecido(encontrado, pedido) {
  const alvo = palavras(pedido);
  if (!alvo.length) return false;
  const achadas = new Set(palavras(encontrado));
  return alvo.filter((word) => achadas.has(word)).length / alvo.length >= 0.7;
}

function https(url) {
  const value = String(url || "").replace(/^http:\/\//, "https://");
  return value.startsWith("https://") ? value : "";
}

async function doGoogle(titulo, autor) {
  const q = [`intitle:${titulo}`, autor ? `inauthor:${autor.split(/,| e /)[0]}` : ""].filter(Boolean).join(" ");
  const params = new URLSearchParams({ q, maxResults: "5", printType: "books" });
  if (process.env.GOOGLE_BOOKS_API_KEY) params.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  const data = await getJson(`https://www.googleapis.com/books/v1/volumes?${params}`, { timeoutMs: 5000 });
  const itens = Array.isArray(data?.items) ? data.items : [];
  if (!itens.length) return null;
  const legivel = itens.find((item) => item.accessInfo?.embeddable && ["PARTIAL", "ALL_PAGES"].includes(item.accessInfo?.viewability));
  const comCapa = itens.find((item) => item.volumeInfo?.imageLinks?.thumbnail) || itens[0];
  const capa = https(comCapa.volumeInfo?.imageLinks?.thumbnail).replace("&edge=curl", "");
  if (legivel) {
    return {
      capa: https(legivel.volumeInfo?.imageLinks?.thumbnail).replace("&edge=curl", "") || capa,
      leitura: {
        url: `https://books.google.com/books?id=${encodeURIComponent(legivel.id)}&printsec=frontcover&output=embed`,
        tipo: legivel.accessInfo.viewability === "ALL_PAGES" ? "completo" : "previa",
        fonte: "Google Livros",
      },
    };
  }
  return capa ? { capa, leitura: null } : null;
}

async function doOpenLibrary(titulo, autor) {
  const params = new URLSearchParams({ q: `${titulo} ${autor || ""}`.trim(), limit: "8", fields: "title,author_name,cover_i,ia,ebook_access" });
  const data = await getJson(`https://openlibrary.org/search.json?${params}`, { headers: { "user-agent": "Minerva-Escola/1.0" }, timeoutMs: 6000 });
  const todos = Array.isArray(data?.docs) ? data.docs : [];
  // A busca da Open Library é solta: para LER, só vale obra cujo título bate.
  const docs = todos.filter((doc) => parecido(doc.title, titulo));
  // Para a CAPA, a obra mais relevante do mesmo autor também serve (é comum a
  // edição em português não ter capa e a original, em inglês, ter).
  const sobrenome = palavras(autor).slice(-1)[0];
  const doAutor = sobrenome ? todos.slice(0, 2).find((doc) => doc.cover_i && palavras((doc.author_name || []).join(" ")).includes(sobrenome)) : null;
  const comCapa = docs.find((doc) => doc.cover_i) || doAutor;
  const capa = comCapa?.cover_i ? `https://covers.openlibrary.org/b/id/${comCapa.cover_i}-M.jpg` : "";
  if (!docs.length) return capa ? { capa, leitura: null } : null;
  const publico = docs.find((doc) => doc.ebook_access === "public" && Array.isArray(doc.ia) && doc.ia.length);
  if (publico) {
    // A lista `ia` mistura cópias de empréstimo (bwb_*, isbn_*) com a digitalização
    // livre: o archive.org diz qual não tem restrição de acesso.
    const candidatos = publico.ia.filter((id) => typeof id === "string").slice(0, 6);
    const checados = await Promise.all(
      candidatos.map((id) =>
        getJson(`https://archive.org/metadata/${encodeURIComponent(id)}/metadata`, { timeoutMs: 5000 })
          .then((data) => {
            const meta = data?.result;
            if (!meta) return "";
            const colecoes = [meta.collection, meta.collection_set].flat().map(String).join(" ");
            const restrito = /true/i.test(String(meta["access-restricted-item"] || "")) || /inlibrary|printdisabled|lendinglibrary/.test(colecoes);
            if (restrito) return "";
            // Marca a edição em português para ela vencer a tradução.
            return /por|portug/i.test([meta.language].flat().map(String).join(" ")) ? `pt:${id}` : id;
          })
          .catch(() => ""),
      ),
    );
    const livre = (checados.find((id) => id.startsWith("pt:")) || checados.find(Boolean) || "").replace(/^pt:/, "");
    if (livre) {
      return {
        capa: publico.cover_i ? `https://covers.openlibrary.org/b/id/${publico.cover_i}-M.jpg` : capa,
        leitura: { url: `https://archive.org/embed/${encodeURIComponent(livre)}`, tipo: "completo", fonte: "Internet Archive (domínio público)" },
      };
    }
  }
  return capa ? { capa, leitura: null } : null;
}

/* ───────── Texto integral do Projeto Gutenberg (leitor da Mine) ───────── */

const textos = new Map();
const GUTENBERG_ESPELHO = "https://gutenberg.pglaf.org";
/** Espelhos oficiais rápidos (medidos em 21/nov/2026), na ordem de tentativa. */
const GUTENBERG_RAPIDOS = [
  "https://mirror.csclub.uwaterloo.ca/gutenberg",
  "https://mirrors.xmission.com/gutenberg",
  "https://ftp.mirrorservice.org/sites/ftp.ibiblio.org/pub/docs/books/gutenberg",
];

/** 55752 → "5/5/7/5/55752"; ids de um dígito ficam em "0/7". */
function pastaGutenberg(id) {
  const s = String(id);
  return s.length === 1 ? `0/${s}` : `${s.slice(0, -1).split("").join("/")}/${s}`;
}

/** Tira o cabeçalho e o rodapé de licença; o aviso de domínio público fica na interface. */
function semLicenca(texto) {
  const inicio = texto.search(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i);
  const fim = texto.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i);
  let corpo = texto;
  if (inicio >= 0) corpo = corpo.slice(corpo.indexOf("\n", inicio) + 1);
  if (fim >= 0) corpo = corpo.slice(0, corpo.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i));
  return corpo.replace(/\r\n/g, "\n").trim();
}

/**
 * Texto puro de um livro do Projeto Gutenberg. O site principal recusa
 * servidor (503), então vai pelo espelho oficial pglaf; tenta UTF-8, depois
 * o arquivo latin-1 e por fim o ASCII. Cache dos últimos 20 livros.
 */
/* ── Projeto Gutenberg Austrália (ids do catálogo deslocados em 10 milhões) ── */

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…", eacute: "é", egrave: "è", agrave: "à", aacute: "á", ccedil: "ç", ouml: "ö", uuml: "ü", auml: "ä", pound: "£", shy: "" };

function decodificar(texto) {
  return texto
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (todo, nome) => ENTIDADES[nome.toLowerCase()] ?? todo);
}

/** HTML simples do Gutenberg Austrália → texto com parágrafos separados por linha em branco. */
function htmlParaTexto(html) {
  const inicio = html.search(/<h1[\s>]/i);
  let corpo = html.slice(inicio >= 0 ? inicio : 0);
  const fim = corpo.search(/<\/body>/i);
  if (fim >= 0) corpo = corpo.slice(0, fim);
  return decodificar(
    corpo
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|h[1-6]|div|li|blockquote)>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+\n/g, "\n"),
  )
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n*Project Gutenberg Australia\s*$/i, "")
    .trim();
}

/** Tira o bloco de licença do começo e o "Project Gutenberg Australia" do fim. */
function semLicencaAustralia(texto) {
  let corpo = texto.replace(/\r\n/g, "\n");
  const contato = corpo.search(/To contact Project Gutenberg of Australia[^\n]*\n/i);
  if (contato >= 0) corpo = corpo.slice(corpo.indexOf("\n", contato) + 1);
  return corpo.replace(/\n+\s*Project Gutenberg (of )?Australia\s*$/i, "").trim();
}

async function textoAustralia(numero) {
  const codigo = String(numero).padStart(7, "0");
  const base = `https://gutenberg.net.au/ebooks${codigo.slice(0, 2)}/${codigo}`;
  for (const [url, ehHtml] of [
    [`${base}.txt`, false],
    [`${base}h.html`, true],
  ]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(url, { headers: { "user-agent": "Minerva-Escola/1.0" }, signal: controller.signal });
      if (!response.ok) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      // Arquivos antigos vêm em windows-1252: se o UTF-8 der caractere inválido, relê.
      let bruto = new TextDecoder("utf-8").decode(bytes);
      if (bruto.includes("�")) bruto = new TextDecoder("windows-1252").decode(bytes);
      const texto = (ehHtml ? htmlParaTexto(bruto) : semLicencaAustralia(bruto)).slice(0, 3_000_000);
      if (texto.length >= 200) return texto;
    } catch {
      // tenta o HTML
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("texto indisponível");
}

/* ── Wikisource em português (ids do catálogo deslocados em 20 milhões) ── */

const VAZIAS = new Set(["br", "img", "hr", "meta", "link", "input", "wbr", "source", "col", "area"]);

/**
 * Tira do HTML os elementos cujos atributos batem com `teste`, com tudo o que
 * há dentro (conta as tags do mesmo nome para achar o fechamento certo).
 */
function semElementos(html, teste) {
  const tag = /<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi;
  let saida = "";
  let cursor = 0;
  let fora = null; // { nome, nivel } enquanto estiver dentro de um elemento removido
  for (let achado = tag.exec(html); achado; achado = tag.exec(html)) {
    const [inteira, fecha, nomeBruto, atributos] = achado;
    const nome = nomeBruto.toLowerCase();
    const vazia = VAZIAS.has(nome) || /\/\s*$/.test(atributos);
    if (fora) {
      if (nome !== fora.nome || vazia) continue;
      fora.nivel += fecha ? -1 : 1;
      if (fora.nivel === 0) {
        fora = null;
        cursor = achado.index + inteira.length;
      }
      continue;
    }
    if (!fecha && !vazia && teste(atributos)) {
      saida += html.slice(cursor, achado.index);
      fora = { nome, nivel: 1 };
    }
  }
  return fora ? saida : saida + html.slice(cursor);
}

/** Navegação, cabeçalhos de capítulo, números de página e links de edição. */
const ENFEITES = /class="[^"]*\b(noprint|ws-noexport|mw-editsection|pagenum|ws-pagenum|wst-dhr|reference|mw-references-wrap|reflist|metadata|ws-summary)\b|id="(modernizar|ws-data|navigationHeader|navigationNotes)"|display:\s*none/i;

/** HTML da versão para impressão do Wikisource → texto com parágrafos separados por linha em branco. */
export function htmlWikisourceParaTexto(html) {
  let corpo = String(html || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
  corpo = semElementos(corpo, (atributos) => ENFEITES.test(atributos));
  // O índice de capítulos (só links) não é leitura: sai até o próximo título.
  corpo = corpo.replace(/<div class="mw-heading[^"]*"><h2 id="[ÍI]ndice"[\s\S]*?(?=<div class="mw-heading|<h2[\s>])/i, "");
  // Lista feita só de links (os capítulos do índice, com ou sem título "Índice").
  corpo = corpo.replace(/<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi, (lista, _tag, dentro) => {
    const itens = (dentro.match(/<li\b/gi) || []).length;
    const foraDosLinks = dentro.replace(/<a\b[\s\S]*?<\/a>/gi, "").replace(/<[^>]+>/g, "").replace(/[\s.,;:–—\-]+/g, "");
    return itens >= 3 && /<a\b/i.test(dentro) && !foraDosLinks ? "" : lista;
  });
  const texto = decodificar(
    corpo
      // Dentro do parágrafo, a quebra de linha é só da página escaneada.
      .replace(/\s*\n\s*/g, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|h[1-6]|div|li|blockquote|dd|dt|tr|table|center)>/gi, "\n\n")
      .replace(/<(h[1-6])[^>]*>/gi, "\n\n")
      .replace(/<[^>]+>/g, ""),
  );
  const blocos = texto
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .split(/\n{2,}/)
    .map((bloco) => bloco.trim())
    // Setas "↑" das notas de rodapé e títulos "Notas" vazios não são leitura.
    .filter((bloco) => bloco && !/^[↑\s^]+$/.test(bloco));
  const limpos = [];
  for (let i = 0; i < blocos.length; i += 1) {
    const bloco = blocos[i];
    if (/^notas?$/i.test(bloco) && (!blocos[i + 1] || blocos[i + 1].length > 200 || /\n/.test(blocos[i + 1]))) continue;
    // "Índice" seguido da lista de capítulos (linhas curtas, sem verso): sai tudo.
    if (/^(í?n+dice|i+n+dice|sumário|sumario|conteúdo)$/i.test(bloco)) {
      let fim = i + 1;
      while (fim < blocos.length && blocos[fim].length < 70 && !blocos[fim].includes("\n")) fim += 1;
      // Sem lista embaixo (os links já saíram no HTML), sai só o título.
      if (fim - i - 1 >= 3) i = fim - 1;
      continue;
    }
    limpos.push(bloco);
  }
  return limpos.join("\n\n");
}

async function textoWikisource(pageid) {
  const url = `https://pt.wikisource.org/w/api.php?${new URLSearchParams({ action: "parse", pageid: String(pageid), prop: "text", format: "json", formatversion: "2" })}`;
  const pedir = () => fetch(url, { headers: { "user-agent": "MinervaEstudos/1.0 (site escolar; leitor de livros)" }, signal: AbortSignal.timeout(40_000) });
  // Obras grandes levam alguns segundos para o Wikisource montar a página inteira.
  let response = await pedir();
  // 429: a Wikimedia pede uma pausa (Retry-After, em geral 10 s). Espera e tenta mais uma vez.
  if (response.status === 429) {
    const espera = Math.min(15, Number(response.headers.get("retry-after")) || 5);
    await new Promise((fim) => setTimeout(fim, espera * 1000));
    response = await pedir();
  }
  if (!response.ok) throw new Error("texto indisponível");
  const dados = await response.json();
  // Só a versão para impressão (Anexo:Imprimir/…): outro pageid não é um livro do catálogo.
  if (!String(dados?.parse?.title || "").startsWith("Anexo:Imprimir/")) throw new Error("livro inválido");
  const texto = htmlWikisourceParaTexto(dados.parse.text).slice(0, 3_000_000);
  if (texto.length < 200) throw new Error("texto indisponível");
  return texto;
}

export async function textoDoLivro(idBruto) {
  const id = Number(idBruto);
  const valido = Number.isInteger(id) && ((id >= 1 && id <= 200000) || (id >= 10_000_000 && id <= 29_999_999));
  if (!valido) throw new Error("livro inválido");
  if (textos.has(id)) return textos.get(id);
  if (id >= 20_000_000) {
    const texto = await textoWikisource(id - 20_000_000);
    if (textos.size >= 20) textos.delete(textos.keys().next().value);
    textos.set(id, texto);
    return texto;
  }
  if (id >= 10_000_000) {
    const texto = await textoAustralia(id - 10_000_000);
    if (textos.size >= 20) textos.delete(textos.keys().next().value);
    textos.set(id, texto);
    return texto;
  }
  const pasta = pastaGutenberg(id);
  const arquivos = [
    { nome: `${id}-0.txt`, encoding: "utf-8" },
    { nome: `${id}-8.txt`, encoding: "latin1" },
    { nome: `${id}.txt`, encoding: "utf-8" },
  ];
  // Os três primeiros espelhos entregam ~900 KB em ~2 s; o pglaf leva 8-15 s
  // e fica por último (é o único com a pasta cache/epub).
  const tentativas = [
    ...GUTENBERG_RAPIDOS.map((base) => arquivos.map((arquivo) => ({ url: `${base}/${pasta}/${arquivo.nome}`, encoding: arquivo.encoding, base }))),
    [
      { url: `${GUTENBERG_ESPELHO}/${pasta}/${id}-0.txt`, encoding: "utf-8", base: GUTENBERG_ESPELHO },
      { url: `${GUTENBERG_ESPELHO}/cache/epub/${id}/pg${id}.txt`, encoding: "utf-8", base: GUTENBERG_ESPELHO },
      { url: `${GUTENBERG_ESPELHO}/${pasta}/${id}-8.txt`, encoding: "latin1", base: GUTENBERG_ESPELHO },
    ],
  ];
  for (const doEspelho of tentativas) {
    for (const { url, encoding } of doEspelho) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      try {
        const response = await fetch(url, { headers: { "user-agent": "Minerva-Escola/1.0" }, signal: controller.signal });
        // 404: este formato não existe aqui, tenta o próximo formato no mesmo espelho.
        if (!response.ok) continue;
        const bytes = new Uint8Array(await response.arrayBuffer());
        const bruto = new TextDecoder(encoding).decode(bytes);
        if (/<!DOCTYPE html/i.test(bruto.slice(0, 200))) continue;
        // Teto de 3 MB: a resposta da Vercel não passa de 4,5 MB.
        const texto = semLicenca(bruto).slice(0, 3_000_000);
        if (texto.length < 200) continue;
        if (textos.size >= 20) textos.delete(textos.keys().next().value);
        textos.set(id, texto);
        return texto;
      } catch {
        // espelho fora do ar ou lento: pula para o próximo espelho
        break;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  throw new Error("texto indisponível");
}

/** Capa e, se existir, um leitor embutido legal para o livro. */
export async function buscarLivro(tituloBruto, autorBruto = "") {
  const titulo = texto(tituloBruto, 120).replace(/\(.*?\)/g, "").trim();
  const autor = texto(autorBruto, 80).replace(/ e outros autores/i, "");
  if (titulo.length < 2) return { capa: "", leitura: null };
  const key = `l:${titulo}|${autor}`.toLowerCase();
  const salvo = lembrado(key);
  if (salvo) return salvo;
  const [google, openLibrary] = await Promise.all([doGoogle(titulo, autor).catch(() => null), doOpenLibrary(titulo, autor).catch(() => null)]);
  const resultado = {
    capa: google?.capa || openLibrary?.capa || "",
    leitura: google?.leitura || openLibrary?.leitura || null,
  };
  return lembrar(key, resultado);
}
