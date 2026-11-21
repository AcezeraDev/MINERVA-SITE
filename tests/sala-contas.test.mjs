import test from "node:test";
import assert from "node:assert/strict";
import { conferirLinhas, normalizarConta, verificacaoParaMine } from "../shared/sala-contas.mjs";

test("normaliza símbolos do teclado de contas", () => {
  assert.equal(normalizarConta("3×4 − 2² ÷ 2"), "3*4 - 2^2 / 2");
  assert.equal(normalizarConta("√16 + 1,5"), "sqrt(16) + 1.5");
});

test("conta simples vira resultado", () => {
  const [l] = conferirLinhas("2×(3+4)");
  assert.equal(l.tipo, "valor");
  assert.equal(l.detalhe, "= 14");
});

test("pega o passo em que o sinal trocou", () => {
  const r = conferirLinhas("3x − 5 = 16\n3x = 16 − 5\n3x = 11\nx = 11/3");
  assert.equal(r[0].tipo, "equacao");
  assert.equal(r[0].ok, null); // primeira linha: nada para comparar
  assert.equal(r[1].ok, false); // aqui o -5 passou sem trocar o sinal
  assert.equal(r[2].ok, true); // conta certa a partir do passo errado
  assert.equal(r[3].tipo, "resposta");
  assert.equal(r[3].ok, true);
});

test("resolução certa fica toda certa", () => {
  const r = conferirLinhas("3x - 5 = 16\n3x = 21\nx = 7");
  assert.deepEqual(r.map((l) => l.ok), [null, true, true]);
});

test("igualdade numérica e texto solto", () => {
  const r = conferirLinhas("primeiro eu somei\n2 + 2 = 5\n10/4 = 2,5");
  assert.equal(r[0].tipo, "texto");
  assert.equal(r[1].ok, false);
  assert.equal(r[2].ok, true);
});

test("verificação para a Mine só quando há conta", () => {
  assert.equal(verificacaoParaMine("oi gente"), "");
  assert.match(verificacaoParaMine("3x - 5 = 16\n3x = 11"), /linha 2 .*ERRADO/);
});
