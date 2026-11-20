/**
 * Fórmula com os valores do gráfico, escrita como no caderno:
 * "(-2)*x^2 + (0)*x + (-4)" vira "−2x² − 4".
 */
export function prettyFormula(text: string) {
  let out = text.replace(/\s+/g, "");
  out = out.replace(/\(([-\d.]+)\)/g, "$1");
  out = out.replace(/\^2(?!\d)/g, "²").replace(/\^3(?!\d)/g, "³");
  // termo com coeficiente zero some
  out = out.replace(/(^|[+-])0\*[a-zA-Z][\w²³^]*/g, "$1").replace(/(^|[+-])0(?=[+-]|$)/g, "$1");
  // sequência de sinais vira um só (+- = -, -- = +)
  out = out.replace(/[+-]{2,}/g, (run) => ((run.match(/-/g) || []).length % 2 ? "-" : "+"));
  out = out.replace(/(^|[+\-(])1\*(?=[a-zA-Z])/g, "$1").replace(/\*/g, "");
  out = out.replace(/^\+/, "").replace(/[+-]+$/, "");
  out = out.replace(/(?<=[^(])([+-])/g, " $1 ").replace(/-/g, "−").trim();
  return out || "0";
}
