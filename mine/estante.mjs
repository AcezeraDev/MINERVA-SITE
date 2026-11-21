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
