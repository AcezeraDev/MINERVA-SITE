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

/*
 * Projeto Gutenberg Austrália (opcional): autores mortos até 1954, em domínio
 * público no Brasil (70 anos após a morte) e na Austrália, como George Orwell
 * ("1984"), F. Scott Fitzgerald e Virginia Woolf. Escolha do dono do site em
 * 21/nov/2026, sabendo que parte dessas obras ainda é protegida nos EUA.
 *   node scripts/gerar-acervo.mjs pg_catalog.csv --au gutindex_aus.txt --au-categorias pasta/
 * A pasta tem as páginas de categoria do site (crime-mystery.html etc.),
 * usadas só para dar gênero aos livros.
 */
const argAu = process.argv.indexOf("--au");
const argCategorias = process.argv.indexOf("--au-categorias");
let australianos = 0;
if (argAu > 0) {
  const indice = readFileSync(resolve(process.argv[argAu + 1]), "utf8");
  const generoPorId = new Map();
  if (argCategorias > 0) {
    const pasta = resolve(process.argv[argCategorias + 1]);
    const categorias = {
      "sfproject.html": "Fantasia e ficção científica",
      "crime-mystery.html": "Mistério",
      "drama.html": "Teatro",
      "westerns.html": "Aventura",
      "biography.html": "História e biografia",
      "explorers.html": "História e biografia",
      "aust-history.html": "História e biografia",
      "voyagesandtravels.html": "Viagens",
    };
    for (const [arquivo, genero] of Object.entries(categorias)) {
      let html = "";
      try {
        html = readFileSync(resolve(pasta, arquivo), "utf8");
      } catch {
        continue;
      }
      for (const achado of html.matchAll(/ebooks\d{2}\/(\d{7})/g)) {
        const lista = generoPorId.get(achado[1]) || [];
        if (!lista.includes(genero)) generoPorId.set(achado[1], [...lista, genero]);
      }
    }
  }
  const jaTem = new Set(livros.filter((livro) => livro.l === "en").map((livro) => `${livro.t}|${livro.a}`.toLowerCase().replace(/[^a-z0-9|]+/g, "")));
  // "Aug 2001 Nineteen eighty-four, by George Orwell     [010002xx.xxx] 0002A"
  for (const linha of indice.split(/\r?\n/)) {
    const achado = linha.match(/^[A-Z][a-z]{2}\s+\d{4}\s+(.+?)\s+\[(\d{6})xx\.xxx\]/);
    if (!achado) continue;
    const corpo = achado[1].trim();
    const id = `${achado[2]}1`;
    const virgula = corpo.lastIndexOf(", ");
    if (virgula < 1) continue;
    const t = titulo(corpo.slice(0, virgula));
    const a = corpo.slice(virgula + 2).replace(/^by\s+/i, "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!t || /abridged|index|catalogue/i.test(t)) continue;
    const chave = `${t}|${a}`.toLowerCase().replace(/[^a-z0-9|]+/g, "");
    if (jaTem.has(chave)) continue;
    jaTem.add(chave);
    let g = generoPorId.get(id) || [];
    if (!g.length) g = /poems|verse|ballads|poetry/i.test(t) ? ["Poesia"] : /stories|tales/i.test(t) ? ["Contos"] : /essays|letters/i.test(t) ? ["Filosofia"] : ["Romance"];
    // id numérico deslocado em 10 milhões: o cliente sabe que é da Austrália.
    livros.push({ i: 10_000_000 + Number(id), t, a, l: "en", g, f: "au" });
    australianos += 1;
  }
}

/*
 * Nomes em português dos clássicos estrangeiros mais lidos na escola: entram
 * no campo `s` (busca e a Mine sugerindo "A Revolução dos Bichos" acham o
 * "Animal Farm"). Chave: título em inglês/espanhol sem acento e minúsculo.
 */
const NOMES_PT = {
  "nineteen eighty-four": "1984 mil novecentos e oitenta e quatro",
  "animal farm": "a revolução dos bichos a fazenda dos animais",
  "the great gatsby": "o grande gatsby",
  "tender is the night": "suave é a noite",
  "mrs dalloway": "mrs dalloway senhora dalloway",
  "to the lighthouse": "ao farol",
  "a room of one's own": "um teto todo seu",
  "pride and prejudice": "orgulho e preconceito",
  "sense and sensibility": "razão e sensibilidade",
  "emma": "emma",
  "frankenstein; or, the modern prometheus": "frankenstein o prometeu moderno",
  "dracula": "drácula",
  "alice's adventures in wonderland": "alice no país das maravilhas",
  "through the looking-glass": "alice através do espelho",
  "the time machine": "a máquina do tempo",
  "the war of the worlds": "a guerra dos mundos",
  "the invisible man": "o homem invisível",
  "the island of doctor moreau": "a ilha do doutor moreau",
  "treasure island": "a ilha do tesouro",
  "the strange case of dr. jekyll and mr. hyde": "o médico e o monstro",
  "robinson crusoe": "robinson crusoé",
  "gulliver's travels": "as viagens de gulliver",
  "the picture of dorian gray": "o retrato de dorian gray",
  "the importance of being earnest": "a importância de ser prudente",
  "the adventures of sherlock holmes": "as aventuras de sherlock holmes",
  "the hound of the baskervilles": "o cão dos baskerville",
  "a study in scarlet": "um estudo em vermelho",
  "moby dick; or, the whale": "moby dick a baleia",
  "the adventures of tom sawyer": "as aventuras de tom sawyer",
  "adventures of huckleberry finn": "as aventuras de huckleberry finn",
  "little women": "mulherzinhas adoráveis mulheres",
  "the jungle book": "o livro da selva",
  "peter pan": "peter pan",
  "the secret garden": "o jardim secreto",
  "jane eyre: an autobiography": "jane eyre",
  "wuthering heights": "o morro dos ventos uivantes",
  "great expectations": "grandes esperanças",
  "a christmas carol": "um conto de natal",
  "oliver twist": "oliver twist",
  "a tale of two cities": "um conto de duas cidades",
  "the call of the wild": "o chamado da floresta",
  "white fang": "caninos brancos",
  "heart of darkness": "o coração das trevas",
  "the metamorphosis": "a metamorfose",
  "metamorphosis": "a metamorfose",
  "the trial": "o processo",
  "romeo and juliet": "romeu e julieta",
  "hamlet, prince of denmark": "hamlet",
  "macbeth": "macbeth",
  "the odyssey": "a odisseia",
  "the iliad": "a ilíada",
  "the art of war": "a arte da guerra",
  "the prince": "o príncipe maquiavel",
  "twenty thousand leagues under the seas: an underwater tour of the world": "vinte mil léguas submarinas",
  "around the world in eighty days": "a volta ao mundo em oitenta dias 80 dias",
  "a journey to the centre of the earth": "viagem ao centro da terra",
  "from the earth to the moon, direct in ninety-seven hours and twenty minutes: and a trip round it": "da terra à lua",
  "don quijote": "dom quixote",
  "the count of monte cristo": "o conde de monte cristo",
  "the three musketeers": "os três mosqueteiros",
  "les misérables": "os miseráveis",
  "crime and punishment": "crime e castigo",
  "the brothers karamazov": "os irmãos karamazov",
  "war and peace": "guerra e paz",
  "anna karenina": "anna kariênina",
  "the old man and the sea": "o velho e o mar",
  "the little prince": "o pequeno príncipe",
};
const semAcento = (texto) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
for (const livro of livros) {
  const nome = NOMES_PT[semAcento(livro.t)];
  if (nome) livro.s = nome;
}

// Português primeiro, depois espanhol e inglês; dentro de cada um, por título.
const ordemIdioma = { pt: 0, es: 1, en: 2 };
livros.sort((x, y) => ordemIdioma[x.l] - ordemIdioma[y.l] || x.t.localeCompare(y.t, "pt"));

const saida = resolve("public/acervo/livros.json");
mkdirSync(dirname(saida), { recursive: true });
writeFileSync(saida, JSON.stringify(livros));
const porIdioma = livros.reduce((soma, livro) => ({ ...soma, [livro.l]: (soma[livro.l] || 0) + 1 }), {});
const porGenero = livros.flatMap((livro) => livro.g).reduce((soma, genero) => ({ ...soma, [genero]: (soma[genero] || 0) + 1 }), {});
console.log(`${livros.length} livros (${australianos} da Austrália) →`, saida);
console.log(porIdioma);
console.log(porGenero);
