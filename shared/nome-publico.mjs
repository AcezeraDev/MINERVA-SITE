/**
 * Nome que os OUTROS veem no ranking e no perfil público.
 *
 * Relatório de QA de 16/11: a lista mostrava a todos o nome completo de uma
 * pessoa real e um apelido de baixo calão. Agora quem olha de fora vê só o
 * primeiro nome e a inicial do último ("Maria S."), e um nome com palavrão
 * vira "Estudante". O próprio dono continua vendo o nome inteiro.
 */

// Palavrões comuns, já sem acento e em minúsculas. A comparação é por palavra
// inteira (e pela palavra sem letras repetidas), para "Cuca" ou "computador"
// não caírem no filtro por conterem um pedaço de palavrão.
const PALAVROES = new Set([
  "porra", "caralho", "krl", "crl", "pqp", "puta", "puto", "putinha", "putaria",
  "buceta", "boceta", "xoxota", "xereca", "piroca", "pica", "rola", "pau",
  "cu", "cuzao", "cuzinho", "arrombado", "arrombada", "fdp", "foda", "fodase",
  "foder", "fudido", "fudida", "merda", "bosta", "viado", "viadinho", "bicha",
  "sapatao", "vadia", "vagabunda", "vagabundo", "piranha", "corno", "corna",
  "otario", "otaria", "babaca", "escroto", "escrota", "punheta", "punheteiro",
  "broxa", "cacete", "desgraca", "desgracado", "desgracada", "retardado",
  "retardada", "mongol", "macaco", "nazista", "hitler", "estupro", "estuprador",
  "fuck", "fucker", "shit", "bitch", "dick", "pussy", "nigger", "nigga", "cunt",
  "asshole", "porn", "porno", "sexo", "xvideos", "pornhub",
]);

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    // leetspeak comum: p0rr4, m3rd4, 5exo
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/@/g, "a")
    .replace(/\$/g, "s");
}

/** Verdadeiro quando o nome contém um palavrão como palavra (ou colado: "fodase", "pqpmano" não). */
export function nomeOfensivo(nome) {
  const texto = normalizar(nome);
  const palavras = texto.split(/[^a-z]+/).filter(Boolean);
  for (const palavra of palavras) {
    if (PALAVROES.has(palavra)) return true;
    const semRepeticao = palavra.replace(/(.)\1+/g, "$1");
    if (PALAVROES.has(semRepeticao)) return true;
  }
  // Palavrões longos e inconfundíveis contam mesmo grudados em outra palavra.
  const colado = texto.replace(/[^a-z]+/g, "");
  return /(porra|caralh|buceta|boceta|arrombad|desgracad|punhet|xvideos|pornhub|estupr)/.test(colado);
}

/**
 * "Maria Souza Lima" -> "Maria L."; "maria" -> "Maria"; palavrão -> "Estudante".
 * `inteiro` é para o próprio dono: devolve o nome como está (só tira espaços).
 */
export function nomePublico(nome, { inteiro = false } = {}) {
  const limpo = String(nome || "").replace(/\s+/g, " ").trim();
  if (!limpo) return "Estudante";
  if (inteiro) return limpo;
  if (nomeOfensivo(limpo)) return "Estudante";
  const partes = limpo.split(" ");
  const primeiro = partes[0].charAt(0).toLocaleUpperCase("pt-BR") + partes[0].slice(1);
  if (partes.length === 1) return primeiro.slice(0, 24);
  const ultimo = partes[partes.length - 1];
  const inicial = ultimo.charAt(0).toLocaleUpperCase("pt-BR");
  return `${primeiro.slice(0, 24)} ${inicial}.`;
}
