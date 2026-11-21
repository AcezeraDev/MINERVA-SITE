// Contas no chat da sala de estudo: o aluno escreve a resolução linha por
// linha e o site confere cada passo com a calculadora (shared/calc.mjs, sem
// eval). O resultado vai para a Mine como "verificação automática", então
// ela aponta o passo errado com certeza, em vez de fazer conta de cabeça.
import { evaluate, solveEquation, tidyNumber, variablesOf } from "./calc.mjs";

/** "3×4 − 2² ÷ 2" → "3*4 - 2^2 / 2". */
export function normalizarConta(linha) {
  return String(linha || "")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/√\s*\(/g, "sqrt(")
    .replace(/√\s*([0-9.,]+)/g, "sqrt($1)")
    .replace(/π/g, "pi")
    .replace(/(\d),(\d)/g, "$1.$2")
    .trim();
}

const perto = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const mesmoConjunto = (a, b) => a.length === b.length && a.every((x) => b.some((y) => perto(x, y)));
const fmt = (n) => tidyNumber(n).replace(".", ",");

function variaveis(partes) {
  const todas = new Set();
  for (const p of partes) for (const v of variablesOf(p)) todas.add(v);
  todas.delete("pi");
  todas.delete("e");
  return [...todas];
}

/**
 * Confere a resolução linha a linha. Cada item:
 * - "valor": conta sem "=" (o site mostra o resultado);
 * - "igualdade": conta com "=" sem letras (2+3 = 5): ok se os lados batem;
 * - "equacao": tem incógnita; ok se tem as MESMAS soluções da equação anterior
 *   (passo válido) — é assim que se pega "o sinal trocou na linha 3";
 * - "resposta": "x = 7"; ok se é solução da última equação;
 * - "texto": linha que não é conta.
 */
export function conferirLinhas(texto) {
  const saida = [];
  let anterior = null; // { variavel, solucoes }
  const linhas = String(texto || "").split(/\n/);
  linhas.forEach((bruta, i) => {
    const linha = bruta.trim();
    if (!linha) return;
    const n = normalizarConta(linha.replace(/^[a-z]?\)\s*|^\d+[).]\s+/i, ""));
    const base = { linha: i + 1, texto: linha };
    try {
      const partes = n.split("=").map((p) => p.trim());
      if (partes.some((p) => !p)) throw new Error("vazio");
      const vars = variaveis(partes);
      if (partes.length === 1) {
        if (vars.length) throw new Error("sem igual");
        const valor = evaluate(partes[0]);
        if (!Number.isFinite(valor)) throw new Error("infinito");
        saida.push({ ...base, tipo: "valor", valor, detalhe: `= ${fmt(valor)}` });
        return;
      }
      if (!vars.length) {
        const valores = partes.map((p) => evaluate(p));
        const ok = valores.every((v, k) => k === 0 || perto(v, valores[k - 1]));
        saida.push({ ...base, tipo: "igualdade", ok, detalhe: valores.map(fmt).join(" = ") });
        return;
      }
      if (vars.length !== 1 || partes.length !== 2) throw new Error("muitas letras");
      const v = vars[0];
      // "x = 7": resposta
      if (partes[0] === v && !variablesOf(partes[1]).filter((x) => x !== "pi").length) {
        const valor = evaluate(partes[1]);
        const ok = anterior && anterior.variavel === v ? anterior.solucoes.some((s) => perto(s, valor)) : null;
        saida.push({ ...base, tipo: "resposta", variavel: v, valor, ok, detalhe: anterior?.variavel === v ? `solução certa: ${v} = ${anterior.solucoes.map(fmt).join(" ou ") || "nenhuma real"}` : `${v} = ${fmt(valor)}` });
        return;
      }
      const solucoes = solveEquation(`${partes[0]} = ${partes[1]}`, v).map((s) => Math.round(s * 1e9) / 1e9);
      const ok = anterior && anterior.variavel === v ? mesmoConjunto(solucoes, anterior.solucoes) : null;
      saida.push({ ...base, tipo: "equacao", variavel: v, solucoes, ok, detalhe: `soluções: ${solucoes.length ? solucoes.map((s) => `${v} = ${fmt(s)}`).join(", ") : "nenhuma real"}` });
      anterior = { variavel: v, solucoes };
    } catch {
      saida.push({ ...base, tipo: "texto" });
    }
  });
  return saida;
}

/** Texto curto da conferência para o contexto da Mine (só quando há conta). */
export function verificacaoParaMine(texto) {
  const itens = conferirLinhas(texto).filter((it) => it.tipo !== "texto");
  if (!itens.length) return "";
  return itens
    .map((it) => {
      const veredito = it.ok === true ? "CERTO" : it.ok === false ? "ERRADO" : "";
      if (it.tipo === "valor") return `linha ${it.linha} (${it.texto}): vale ${it.detalhe.slice(2)}`;
      if (it.tipo === "igualdade") return `linha ${it.linha} (${it.texto}): ${veredito} (${it.detalhe})`;
      if (it.tipo === "equacao") return `linha ${it.linha} (${it.texto}): ${it.detalhe}${veredito ? `; passo ${veredito} em relacao a equacao anterior` : ""}`;
      return `linha ${it.linha} (${it.texto}): ${veredito || "resposta"} (${it.detalhe})`;
    })
    .join("\n");
}
