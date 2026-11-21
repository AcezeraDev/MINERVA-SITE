/**
 * Gera public/acervo/livros.json (a "Biblioteca grátis" da aba Livros) a
 * partir do catálogo oficial do Projeto Gutenberg (pg_catalog.csv).
 *
 * Uso:
 *   node scripts/gerar-acervo.mjs caminho/para/pg_catalog.csv
 * O CSV sai do espelho oficial (o site principal recusa robôs):
 *   https://gutenberg.pglaf.org/cache/epub/feeds/pg_catalog.csv.gz
 *
 * Entram: todos os livros em português e espanhol e os "Classics of
 * Literature" em inglês. Cada livro vira { i, t, a, l, g } (ver src/conteudo/acervo.ts).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const entrada = process.argv[2];
if (!entrada) {
  console.error("Passe o caminho do pg_catalog.csv.");
  process.exit(1);
}

function lerCsv(texto) {
  const linhas = [];
  let linha = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i += 1;
        } else aspas = false;
      } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ",") {
      linha.push(campo);
      campo = "";
    } else if (c === "\n") {
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else if (c !== "\r") campo += c;
  }
  if (campo || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

/** "Lopes Neto, J. Simões (João Simões), 1865-1916" → "J. Simões Lopes Neto". */
function autor(bruto) {
  const primeiro = String(bruto || "").split(";")[0].trim();
  if (!primeiro || /^(anonymous|various|unknown)/i.test(primeiro)) return "";
  const limpo = primeiro
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/,?\s*(-?\d{1,4}\??\s*(BCE|BC|AD)?\s*-\s*-?\d{0,4}\??\s*(BCE|BC|AD)?|\d{1,4}\??-?)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/,$/, "");
  const partes = limpo.split(",").map((parte) => parte.trim()).filter(Boolean);
  return (partes.length >= 2 ? `${partes.slice(1).join(" ")} ${partes[0]}` : limpo).slice(0, 80);
}

function titulo(bruto) {
  return String(bruto || "")
    .split(/\r?\n/)[0]
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

// Estante (Bookshelves/Subjects do Gutenberg) → gênero em português. Ordem importa.
const REGRAS = [
  ["Poesia", /poetry|poesia|poems|sonnet/i],
  ["Teatro", /plays|drama|teatro|comed(y|ia)|tragedy/i],
  ["Contos", /short stories|contos|cuentos/i],
  ["Infantojuvenil", /children|juvenile|young adult|infantil|fairy tales/i],
  ["Mistério", /mystery|detective|crime|thrillers|policial/i],
  ["Terror", /horror|ghost|gothic|supernatural/i],
  ["Fantasia e ficção científica", /science[- ]fiction|fantasy|fantastic/i],
  ["Aventura", /adventure|aventura|sea stories|westerns/i],
  ["Filosofia", /philosoph|ethics|filosofia/i],
  ["Ciências", /science - |mathematics|physics|chemistry|biology|astronomy|natural history|botany|geology|medicine|ciência/i],
  ["Religião", /religio|bible|christian|theology|spirituality/i],
  ["Viagens", /travel|voyages|viagens/i],
  ["História e biografia", /history|biograph|histór|memoirs|letters/i],
  ["Romance", /novels|fiction|romance|romances|novela/i],
];

function generos(estantes, assuntos) {
  const fonte = `${estantes} ; ${assuntos}`;
  const achados = REGRAS.filter(([, regra]) => regra.test(fonte)).map(([nome]) => nome);
  // "Literatura" sozinha (sem outro gênero) quase sempre é prosa de ficção.
  if (!achados.length && /literature|literatura/i.test(fonte)) achados.push("Romance");
  return (achados.length ? achados : ["Outros"]).slice(0, 3);
}

const linhas = lerCsv(readFileSync(resolve(entrada), "utf8"));
const cabecalho = linhas[0];
const col = Object.fromEntries(cabecalho.map((nome, index) => [nome, index]));
const livros = [];
const vistos = new Set();

for (const linha of linhas.slice(1)) {
  if (linha[col.Type] !== "Text") continue;
  const id = Number(linha[col["Text#"]]);
  const idioma = String(linha[col.Language] || "").split(";")[0].trim();
  const estantes = linha[col.Bookshelves] || "";
  const entra = idioma === "pt" || idioma === "es" || (idioma === "en" && /Classics of Literature/.test(estantes));
  if (!entra || !id) continue;
  const t = titulo(linha[col.Title]);
  const a = autor(linha[col.Authors]);
  // Mesmo título e autor em várias edições: fica a primeira (menor id).
  const chave = `${idioma}|${t.toLowerCase()}|${a.toLowerCase()}`;
  if (!t || vistos.has(chave)) continue;
  vistos.add(chave);
  // Dicionários, índices e listas não são leitura.
  if (/dicion|diccionario|dictionary|index of the project gutenberg|catalog/i.test(t)) continue;
  livros.push({ i: id, t, a, l: idioma, g: generos(estantes, linha[col.Subjects] || "") });
}

// Português primeiro, depois espanhol e inglês; dentro de cada um, por título.
const ordemIdioma = { pt: 0, es: 1, en: 2 };
livros.sort((x, y) => ordemIdioma[x.l] - ordemIdioma[y.l] || x.t.localeCompare(y.t, "pt"));

const saida = resolve("public/acervo/livros.json");
mkdirSync(dirname(saida), { recursive: true });
writeFileSync(saida, JSON.stringify(livros));
const porIdioma = livros.reduce((soma, livro) => ({ ...soma, [livro.l]: (soma[livro.l] || 0) + 1 }), {});
const porGenero = livros.flatMap((livro) => livro.g).reduce((soma, genero) => ({ ...soma, [genero]: (soma[genero] || 0) + 1 }), {});
console.log(`${livros.length} livros →`, saida);
console.log(porIdioma);
console.log(porGenero);
