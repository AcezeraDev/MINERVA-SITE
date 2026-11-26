/**
 * Junta ao public/acervo/livros.json as obras completas do Wikisource em
 * português (nov/2026). Entram as páginas "Anexo:Imprimir/<obra>", que trazem
 * o livro inteiro numa página só, e o texto é lido pelo servidor em
 * /api/acervo (mine/estante.mjs, textoWikisource).
 *
 * Uso: node scripts/gerar-acervo-wikisource.mjs
 *
 * Cada obra vira { i: 20_000_000 + pageid, t, a, l: "pt", g, f: "ws" }.
 * Leis e constituições ficam de fora, e uma obra que o Projeto Gutenberg já
 * tem em português (mesmo título e autor) não entra de novo. Rodar de novo
 * troca só as obras do Wikisource: as do Gutenberg não mudam.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const API = "https://pt.wikisource.org/w/api.php";
// A política da Wikimedia pede um User-Agent que identifique o programa.
const CABECALHO = { "user-agent": "MinervaEstudos/1.0 (site escolar; catalogo de livros)" };
const DESLOCAMENTO = 20_000_000;
const arquivo = resolve("public/acervo/livros.json");

const esperar = (ms) => new Promise((fim) => setTimeout(fim, ms));

/**
 * Um pedido por vez, com 1 s de folga entre eles: a Wikimedia responde 429
 * ("too many requests") a quem dispara vários juntos. No 429 espera o
 * Retry-After (ou 30 s, 60 s…) e tenta de novo.
 */
async function api(parametros) {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", maxlag: "5", ...parametros })}`;
  for (let tentativa = 0; tentativa < 5; tentativa += 1) {
    await esperar(1000);
    try {
      const resposta = await fetch(url, { headers: CABECALHO, signal: AbortSignal.timeout(30_000) });
      if (resposta.ok) {
        const dados = await resposta.json();
        if (dados.error?.code === "maxlag") {
          await esperar(5000);
          continue;
        }
        return dados;
      }
      if (resposta.status === 429 || resposta.status >= 500) {
        const pedido = Number(resposta.headers.get("retry-after")) || 30 * (tentativa + 1);
        process.stdout.write(`\n(esperando ${pedido} s: ${resposta.status})\n`);
        await esperar(pedido * 1000);
      }
    } catch {
      await esperar(3000);
    }
  }
  throw new Error(`falhou: ${url}`);
}

const dobrar = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const FORA = /^(Lei Federal|Constitui[çc][ãa]o)/i;

// Obras de verso que o Wikisource não marca com categoria de gênero.
const POESIA = /lus[ií]adas|mar[ií]lia de dirceu|^eu \(|^mensagem|flores do mal|folhas ca[ií]das|timbiras|primaveras|il[ií]ada|eneida|divina com[eé]dia|sonetos|suspiros po[eé]ticos|cancioneiro|cantigas|clepsydra|ocidentais|ces[aá]rio verde|noturnas|sons de viola|vila rica|raios de extincta luz/i;

function genero(titulo, categorias) {
  const todas = categorias.join(" | ");
  if (POESIA.test(titulo) || /poesia|poemas|sonetos|epopeia|po[eé]tic/i.test(todas)) return ["Poesia"];
  if (/teatro|com[eé]dia|drama|pe[çc]as/i.test(todas)) return ["Teatro"];
  if (/contos|^contos|outros contos/i.test(`${todas} | ${titulo}`)) return ["Contos"];
  if (/romance|novela/i.test(todas)) return ["Romance"];
  if (/hist[oó]ria|biografia|cr[oô]nica/i.test(`${todas} | ${titulo}`)) return ["História e biografia"];
  if (/viage|pa[ií]s dos ianques|fran[çc]a ao jap/i.test(titulo)) return ["Viagens"];
  if (/infan|alice|gulliver|minas de salom|piolho viajante/i.test(titulo)) return ["Infantojuvenil"];
  if (/tao te ching|gheranda|reflex[oõ]es/i.test(titulo)) return ["Filosofia"];
  return ["Romance"];
}
/**
 * Páginas de impressão com livro de verdade dentro. Algumas são só o índice:
 * incluem capítulos que nunca foram criados (A Moreninha, nov/2026). Vale a
 * página que inclui ao menos um capítulo existente ou que tem o texto escrito
 * nela mesma (wikitexto grande).
 */
async function comConteudo(pageids) {
  const incluidas = new Map();
  const tamanho = new Map();
  for (let i = 0; i < pageids.length; i += 50) {
    let continuar = {};
    do {
      const dados = await api({ action: "query", prop: "templates|info", pageids: pageids.slice(i, i + 50).join("|"), tlnamespace: "0|106", tllimit: "max", ...continuar });
      for (const p of dados.query?.pages || []) {
        if (p.length) tamanho.set(p.pageid, p.length);
        incluidas.set(p.pageid, [...(incluidas.get(p.pageid) || []), ...(p.templates || []).map((t) => t.title)]);
      }
      continuar = dados.continue || null;
    } while (continuar);
  }
  // Basta o primeiro capítulo de cada livro existir.
  const primeiros = [...new Set([...incluidas.values()].map((lista) => lista[0]).filter(Boolean))];
  const existe = new Set();
  for (let i = 0; i < primeiros.length; i += 50) {
    const dados = await api({ action: "query", prop: "info", titles: primeiros.slice(i, i + 50).join("|") });
    const normal = new Map((dados.query?.normalized || []).map((n) => [n.to, n.from]));
    for (const p of dados.query?.pages || []) if (!p.missing) existe.add(normal.get(p.title) || p.title);
  }
  return new Set(pageids.filter((id) => existe.has((incluidas.get(id) || [])[0]) || (tamanho.get(id) || 0) >= 5000));
}

// Só confere o catálogo atual: tira as obras do Wikisource que estão vazias.
if (process.argv.includes("--so-conferir")) {
  const todos = JSON.parse(readFileSync(arquivo, "utf8"));
  const ws = todos.filter((livro) => livro.f === "ws");
  const boas = await comConteudo(ws.map((livro) => livro.i - DESLOCAMENTO));
  const fora = ws.filter((livro) => !boas.has(livro.i - DESLOCAMENTO));
  writeFileSync(arquivo, JSON.stringify(todos.filter((livro) => livro.f !== "ws" || boas.has(livro.i - DESLOCAMENTO))));
  console.log(`${fora.length} obras vazias saíram: ${fora.map((livro) => livro.t).join(", ") || "nenhuma"}.`);
  process.exit(0);
}

// 1. Todas as páginas "Anexo:Imprimir/…" (o espaço Anexo é o 110).
const paginas = [];
let continuar = {};
do {
  const dados = await api({ action: "query", list: "allpages", apprefix: "Imprimir/", apnamespace: "110", aplimit: "max", ...continuar });
  paginas.push(...dados.query.allpages);
  continuar = dados.continue || null;
} while (continuar);
console.log(`${paginas.length} páginas para impressão`);

// 2. Autor (links para "Autor:…") e gênero (categorias) em lote: 25 obras por
// pedido, cada uma com a página de impressão e a página principal da obra.
// Pedir a página inteira (parse) faz o Wikisource montar o livro todo e leva
// ao 429; assim são uns 10 pedidos para o catálogo inteiro.
const semLeis = paginas.filter((pagina) => !FORA.test(pagina.title.replace("Anexo:Imprimir/", "")));
const cheias = await comConteudo(semLeis.map((pagina) => pagina.pageid));
const escolhidas = semLeis.filter((pagina) => cheias.has(pagina.pageid));
console.log(`${semLeis.length - escolhidas.length} páginas vazias (só o índice) ficaram de fora`);
const autoresPor = new Map();
const categoriasPor = new Map();
for (let i = 0; i < escolhidas.length; i += 25) {
  process.stdout.write(`\rlote ${i / 25 + 1}/${Math.ceil(escolhidas.length / 25)}`);
  const titulos = escolhidas.slice(i, i + 25).flatMap((p) => [p.title, p.title.replace("Anexo:Imprimir/", "")]);
  let continuar = {};
  const nomes = new Map(titulos.map((t) => [t, t]));
  do {
    const dados = await api({ action: "query", prop: "links|categories", titles: titulos.join("|"), plnamespace: "102", pllimit: "max", cllimit: "max", redirects: "1", ...continuar });
    // Redirecionamento troca o título pedido pelo destino: guarda pelo pedido.
    for (const r of dados.query?.redirects || []) for (const [pedido, atual] of nomes) if (atual === r.from) nomes.set(pedido, r.to);
    for (const p of dados.query?.pages || []) {
      const autores = autoresPor.get(p.title) || [];
      for (const l of p.links || []) {
        const nome = l.title.replace(/^Autor:/, "");
        if (!autores.includes(nome)) autores.push(nome);
      }
      autoresPor.set(p.title, autores);
      categoriasPor.set(p.title, [...(categoriasPor.get(p.title) || []), ...(p.categories || []).map((c) => c.title.replace("Categoria:", ""))]);
    }
    continuar = dados.continue || null;
  } while (continuar);
  for (const [pedido, atual] of nomes) {
    if (pedido === atual) continue;
    autoresPor.set(pedido, autoresPor.get(atual) || []);
    categoriasPor.set(pedido, categoriasPor.get(atual) || []);
  }
}
process.stdout.write("\n");

function autorDa(pagina) {
  const titulo = pagina.title.replace("Anexo:Imprimir/", "");
  // "Demônios (Aluísio Azevedo)": o autor já vem no título.
  const entre = titulo.match(/\(([^)]+)\)\s*$/)?.[1] || "";
  const daObra = autoresPor.get(titulo) || [];
  const daImpressao = autoresPor.get(pagina.title) || [];
  if (entre && [...daObra, ...daImpressao].some((a) => a === entre)) return entre;
  // A página principal costuma ligar só o autor; a de impressão também liga prefaciadores.
  if (daObra.length === 1) return daObra[0];
  if (daImpressao.length === 1) return daImpressao[0];
  const comuns = daObra.filter((a) => daImpressao.includes(a));
  return comuns[0] || daObra[0] || daImpressao[0] || "";
}

// Onde o primeiro link "Autor:" é de tradutor, editor ou prefaciador.
const CORRECOES = {
  "A Carne": "Júlio Ribeiro",
  "As Primaveras": "Casimiro de Abreu",
  "A Retirada da Laguna": "Visconde de Taunay",
  "Ilíada": "Homero (trad. Odorico Mendes)",
  "Eneida Brazileira": "Virgílio (trad. Odorico Mendes)",
  "Comentários sobre a Guerra Gálica": "Júlio César",
  "Cantigas de Martim Codax, presumido jogral do século XIII": "Martim Codax",
  "Flores do Mal": "Charles Baudelaire",
  "Livro do Desassossego": "Fernando Pessoa (Bernardo Soares)",
};

const obras = escolhidas.map((pagina) => {
  const titulo = pagina.title.replace("Anexo:Imprimir/", "");
  // "Demônios (Aluísio Azevedo)" → "Demônios"; o autor já vai no campo a.
  const t = titulo.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const categorias = [...(categoriasPor.get(titulo) || []), ...(categoriasPor.get(pagina.title) || [])];
  return { i: DESLOCAMENTO + pagina.pageid, t, a: (CORRECOES[t] || autorDa(pagina)).slice(0, 80), l: "pt", g: genero(t, categorias), f: "ws" };
});

// 3. Junta ao catálogo: tira duplicatas (mesmo título e autor) e o que o Gutenberg já tem.
const atual = JSON.parse(readFileSync(arquivo, "utf8")).filter((livro) => livro.f !== "ws");
const chave = (livro) => `${dobrar(livro.t)}|${dobrar(livro.a).split(" ").slice(-1)[0] || ""}`;
const vistos = new Set(atual.filter((livro) => livro.l === "pt").map(chave));
const tituloGutenberg = new Set(atual.filter((livro) => livro.l === "pt").map((livro) => dobrar(livro.t)));
let novos = 0;
let repetidos = 0;
for (const obra of obras) {
  if (!obra) continue;
  // Sem autor no Wikisource, basta o título já existir no Gutenberg.
  if (vistos.has(chave(obra)) || (!obra.a && tituloGutenberg.has(dobrar(obra.t)))) {
    repetidos += 1;
    continue;
  }
  vistos.add(chave(obra));
  atual.push(obra);
  novos += 1;
}
writeFileSync(arquivo, JSON.stringify(atual));
console.log(`${novos} obras do Wikisource entraram, ${repetidos} já estavam no catálogo. Total: ${atual.length}.`);
