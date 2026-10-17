import test from "node:test";
import assert from "node:assert/strict";

import { fetchBrazilHolidays, handleEducationRequest, searchBooks, searchEducationalImage, searchImageGallery, searchResearch } from "../education-server.mjs";

// Estes testes cobrem a Wikipédia e as APIs públicas. A busca de imagens da web
// (NanoGPT) entra na galeria quando há chave no ambiente, e mudaria o número de
// chamadas esperado; ela é ligada só nos testes da galeria, lá embaixo.
const WEB_ENV = ["MINE_WEB_SEARCH", "NANOGPT_API_KEY", "NANOGPT_API_KEYS"];
const savedWebEnv = Object.fromEntries(WEB_ENV.map((name) => [name, process.env[name]]));
process.env.MINE_WEB_SEARCH = "off";

function withWebSearch(fn) {
  return async () => {
    process.env.MINE_WEB_SEARCH = "on";
    process.env.NANOGPT_API_KEY = "nano_galeria_teste";
    try {
      await fn();
    } finally {
      process.env.MINE_WEB_SEARCH = "off";
      if (savedWebEnv.NANOGPT_API_KEY === undefined) delete process.env.NANOGPT_API_KEY;
      else process.env.NANOGPT_API_KEY = savedWebEnv.NANOGPT_API_KEY;
    }
  };
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function responseRecorder() {
  return {
    status: 0,
    headers: {},
    body: "",
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body = "") {
      this.body = body;
    },
  };
}

test("Open Library usa host fixo e normaliza somente os campos permitidos", async () => {
  const previousFetch = globalThis.fetch;
  let requestUrl;
  globalThis.fetch = async (url, options) => {
    requestUrl = new URL(url);
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    return jsonResponse({
      docs: [{
        key: "https://evil.example/roubo",
        title: "  Física\u0000 para todos  ",
        author_name: ["Ada   Lovelace", "\u0007Alan Turing"],
        first_publish_year: 1843,
        cover_i: 123,
        isbn: ["978-0-00"],
        edition_count: 9,
        ignored: "não deve sair",
      }],
    });
  };

  try {
    const results = await searchBooks("física & ciência", 1);
    assert.equal(requestUrl.hostname, "openlibrary.org");
    assert.equal(requestUrl.searchParams.get("q"), "física & ciência");
    assert.deepEqual(results[0], {
      id: "https://evil.example/roubo",
      title: "Física para todos",
      authors: ["Ada Lovelace", "Alan Turing"],
      year: 1843,
      coverUrl: "https://covers.openlibrary.org/b/id/123-M.jpg",
      isbn: "978-0-00",
      editionCount: 9,
      sourceUrl: "https://openlibrary.org",
      source: "Open Library",
    });
    assert.equal("ignored" in results[0], false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("Crossref nunca repassa URL arbitrária recebida da fonte", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(new URL(url).hostname, "api.crossref.org");
    return jsonResponse({
      message: {
        items: [{
          title: ["Aprendizagem ativa"],
          author: [{ given: "Ana", family: "Silva" }],
          published: { "date-parts": [[2025, 3, 10]] },
          "container-title": ["Revista Educação"],
          type: "journal-article",
          URL: "https://evil.example/phishing",
        }],
      },
    });
  };

  try {
    const [result] = await searchResearch("aprendizagem", 1);
    const safeUrl = new URL(result.sourceUrl);
    assert.equal(safeUrl.hostname, "search.crossref.org");
    assert.equal(result.authors[0], "Ana Silva");
    assert.equal(result.year, 2025);
    assert.equal(result.container, "Revista Educação");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("Nager.Date mantém apenas datas válidas e campos públicos normalizados", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(new URL(url).href, "https://date.nager.at/api/v3/PublicHolidays/2026/BR");
    return jsonResponse([
      { date: "2026-09-07", localName: "Independência do Brasil", name: "Independence Day", global: true, types: ["Public"] },
      { date: "07/09/2026", localName: "inválido" },
    ]);
  };

  try {
    const results = await fetchBrazilHolidays(2026);
    assert.equal(results.length, 1);
    assert.equal(results[0].date, "2026-09-07");
    assert.equal(results[0].source, "Nager.Date");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("rotas educacionais rejeitam método e consulta inválidos sem chamar terceiros", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("fetch não deveria ser chamado");
  };

  try {
    const methodResponse = responseRecorder();
    assert.equal(await handleEducationRequest({ method: "POST", url: "/api/library", headers: { host: "localhost" } }, methodResponse), true);
    assert.equal(methodResponse.status, 405);

    const queryResponse = responseRecorder();
    assert.equal(await handleEducationRequest({ method: "GET", url: "/api/library?q=x", headers: { host: "localhost", "x-forwarded-for": "test-invalid-query" } }, queryResponse), true);
    assert.equal(queryResponse.status, 400);
    assert.match(JSON.parse(queryResponse.body).error, /2 caracteres/);

    const unknownResponse = responseRecorder();
    assert.equal(await handleEducationRequest({ method: "GET", url: "/api/desconhecida", headers: { host: "localhost" } }, unknownResponse), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

/**
 * A foto que a Mine manda no meio da resposta.
 *
 * Os dois casos abaixo sao os erros que a implementacao cometeu de verdade
 * antes de existirem: recusar a miniatura por causa do host (`thumb` e tao
 * legitimo quanto `upload`, e e de onde vem todo artigo ilustrado com SVG) e
 * cair no proximo resultado da busca, entregando a foto de outro assunto.
 */
function wikiPage(overrides = {}) {
  return {
    pageid: 1,
    index: 1,
    title: "Mitocôndria",
    canonicalurl: "https://pt.wikipedia.org/wiki/Mitoc%C3%B4ndria",
    thumbnail: { source: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/Animal_Cell.svg/960px-Animal_Cell.svg.png", width: 960, height: 554 },
    ...overrides,
  };
}

test("a foto vem do artigo com o nome exato, sem passar pela busca", async () => {
  const previousFetch = globalThis.fetch;
  const chamadas = [];
  globalThis.fetch = async (url) => {
    chamadas.push(new URL(url));
    return jsonResponse({ query: { pages: [wikiPage()] } });
  };

  try {
    const image = await searchEducationalImage("Mitocôndria");
    assert.equal(chamadas.length, 1, "com o artigo exato encontrado, a busca nem chega a ser feita");
    assert.equal(chamadas[0].hostname, "pt.wikipedia.org");
    assert.equal(chamadas[0].searchParams.get("titles"), "Mitocôndria");
    // O host `thumb` precisa passar: e dele que vem a miniatura de SVG.
    assert.match(image.url, /^https:\/\/thumb\.wikimedia\.org\//);
    assert.equal(image.title, "Mitocôndria");
    assert.equal(image.pageUrl, "https://pt.wikipedia.org/wiki/Mitoc%C3%B4ndria");
    assert.equal(image.source, "Wikipédia");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("resultado de busca sobre outro assunto nao vira foto", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const target = new URL(url);
    if (target.searchParams.get("titles")) return jsonResponse({ query: { pages: [{ title: "Mitocôndria", missing: true }] } });
    return jsonResponse({ query: { pages: [wikiPage({ title: "Eukaryota" })] } });
  };

  try {
    // Uma foto errada e pior que nenhuma: a Mine escreve sobre mitocondria e o
    // leitor veria um cartaz de eucariontes.
    assert.equal(await searchEducationalImage("Mitocôndria"), null);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("miniatura hospedada fora da Wikimedia e descartada", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    jsonResponse({
      query: { pages: [wikiPage({ thumbnail: { source: "https://evil.example/foto.jpg", width: 960, height: 554 } })] },
    });

  try {
    // A URL vai direto para o `src` de um `<img>` na conversa.
    assert.equal(await searchEducationalImage("Mitocôndria"), null);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("icone pequeno demais nao serve de ilustracao", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    jsonResponse({
      query: {
        pages: [wikiPage({ thumbnail: { source: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Flag.png", width: 40, height: 26 } })],
      },
    });

  try {
    assert.equal(await searchEducationalImage("Mitocôndria"), null);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test(
  "galeria: foto do artigo primeiro, depois as da web relevantes e sem repetir",
  withWebSearch(async () => {
    const previousFetch = globalThis.fetch;
    const original = "https://site.com/tesla.jpg";
    const thumb = `https://imgs.search.brave.com/assinatura/rs:fit:500:0:1:0/g:ce/${Buffer.from(original).toString("base64url")}`;
    globalThis.fetch = async (url) => {
      const target = new URL(url);
      if (target.hostname.endsWith("wikipedia.org")) {
        return jsonResponse({ query: { pages: [wikiPage({ title: "Nikola Tesla", canonicalurl: "https://pt.wikipedia.org/wiki/Nikola_Tesla" })] } });
      }
      if (target.pathname.endsWith("/api/web")) {
        return jsonResponse({
          data: [
            { type: "image", title: "Nikola Tesla em 1890", url: "https://site.com/tesla", imageUrl: thumb, source: "site.com", width: 500, height: 400 },
            { type: "image", title: "Nikola Tesla em 1890", url: "https://site.com/tesla", imageUrl: thumb, source: "site.com", width: 500, height: 400 },
            { type: "image", title: "Thomas Edison no laboratório", url: "https://outro.com/edison", imageUrl: "https://imgs.search.brave.com/x/y", source: "outro.com", width: 500, height: 400 },
          ],
        });
      }
      throw new Error(`fetch inesperado: ${url}`);
    };
    try {
      const images = await searchImageGallery("Nikola Tesla");
      assert.equal(images.length, 2);
      assert.equal(images[0].source, "Wikipédia");
      assert.equal(images[1].url, thumb);
      assert.equal(images[1].full, original, "a foto original sai do endereço da miniatura da Brave");
    } finally {
      globalThis.fetch = previousFetch;
    }
  }),
);

test("download de foto recusa endereço interno, http e o que não é imagem", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } });
  try {
    for (const [src, status] of [
      ["https://127.0.0.1/foto.jpg", 400],
      ["https://169.254.169.254/latest/meta-data", 400],
      ["https://[::1]/foto.jpg", 400],
      ["http://upload.wikimedia.org/foto.jpg", 400],
      ["https://93.184.215.14/pagina", 415],
    ]) {
      const response = responseRecorder();
      await handleEducationRequest(
        { method: "GET", url: `/api/image-download?src=${encodeURIComponent(src)}`, headers: { host: "localhost", "x-forwarded-for": `download-${status}-${src}` } },
        response,
      );
      assert.equal(response.status, status, src);
    }
  } finally {
    globalThis.fetch = previousFetch;
  }
});
