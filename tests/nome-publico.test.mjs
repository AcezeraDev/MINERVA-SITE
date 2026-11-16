import test from "node:test";
import assert from "node:assert/strict";
import { nomeOfensivo, nomePublico } from "../shared/nome-publico.mjs";

test("outros veem so o primeiro nome e a inicial do ultimo", () => {
  assert.equal(nomePublico("Maria Souza Lima"), "Maria L.");
  assert.equal(nomePublico("joão pedro"), "João P.");
  assert.equal(nomePublico("Ana"), "Ana");
  assert.equal(nomePublico("   "), "Estudante");
});

test("o dono ve o proprio nome inteiro", () => {
  assert.equal(nomePublico("Maria Souza Lima", { inteiro: true }), "Maria Souza Lima");
});

test("nome com palavrao vira Estudante", () => {
  for (const nome of ["porra", "Cuzao 123", "m3rd4", "PQP mano", "o arrombado", "caralhooo", "Fodase"]) {
    assert.equal(nomeOfensivo(nome), true, nome);
    assert.equal(nomePublico(nome), "Estudante", nome);
  }
});

test("nomes comuns nao caem no filtro por conter um pedaco de palavrao", () => {
  for (const nome of ["Cuca", "Computador", "Paula", "Picasso", "Rolando", "Pietra Bichara", "Escuta", "Curitiba", "Teste UX Minerva 1611B"]) {
    assert.equal(nomeOfensivo(nome), false, nome);
  }
});
