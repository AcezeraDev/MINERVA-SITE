/**
 * O raciocínio da Mine aparece na tela ("Ver raciocínio", "Pensou por 6 s").
 * O prompt manda pensar em português, mas modelo de reserva (e às vezes o
 * próprio Claude, com material em inglês) pensa em inglês. Texto em inglês
 * não é mostrado: fica só o "Pensou por N s".
 *
 * Contagem de palavras-função das duas línguas: barata, roda a cada pedaço do
 * streaming e não confunde citação curta em inglês com pensamento em inglês.
 */

const EN = new Set(["the", "and", "is", "are", "to", "of", "that", "this", "it", "i", "need", "should", "user", "with", "for", "be", "there", "it's", "i'm", "i'll", "let", "me", "they", "their", "what", "which", "about", "seems", "just", "but", "so", "will", "can", "an", "not", "be"]);
const PT = new Set(["o", "a", "os", "as", "e", "é", "de", "do", "da", "dos", "das", "que", "para", "com", "não", "um", "uma", "em", "no", "na", "eu", "preciso", "usuário", "estudante", "isso", "ele", "ela", "mas", "então", "vou", "por", "se", "como", "mais", "está", "são"]);

/** O pensamento está escrito em inglês? Pouco texto ainda: não decide (false). */
export function looksEnglish(text) {
  const words = String(text || "")
    .toLowerCase()
    .slice(0, 1200)
    .match(/[\p{L}']+/gu);
  if (!words || words.length < 12) return false;
  let en = 0;
  let pt = 0;
  for (const word of words) {
    if (EN.has(word)) en += 1;
    if (PT.has(word)) pt += 1;
  }
  return en >= 4 && en > pt * 1.5;
}

/** O raciocínio que pode ir para a tela ("" quando está em inglês). */
export function visibleReasoning(text) {
  const value = String(text || "");
  return looksEnglish(value) ? "" : value;
}
