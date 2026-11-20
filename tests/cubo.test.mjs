import test from "node:test";
import assert from "node:assert/strict";
import {
  aplicarGiros,
  caminhoDeVolta,
  criarCubo,
  estaResolvido,
  formatarTempo,
  gerarEmbaralhamento,
  giroDaNotacao,
  mediaDe,
  notacao,
  planificar,
  resumoTempos,
  simplificar,
} from "../shared/cubo.mjs";

const seq = (texto, n = 3) => texto.split(" ").map((t) => giroDaNotacao(t, n));

function semente(s) {
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

test("cubo novo está resolvido e tem as peças certas", () => {
  assert.equal(criarCubo(2).pecas.length, 8);
  assert.equal(criarCubo(3).pecas.length, 26);
  assert.equal(criarCubo(4).pecas.length, 56);
  assert.ok(estaResolvido(criarCubo(3)));
});

test("sexy move seis vezes volta ao início", () => {
  const cubo = criarCubo(3);
  for (let i = 0; i < 6; i += 1) aplicarGiros(cubo, seq("R U R' U'"));
  assert.ok(estaResolvido(cubo));
});

test("um giro desarruma e o inverso arruma", () => {
  const cubo = aplicarGiros(criarCubo(3), seq("R"));
  assert.ok(!estaResolvido(cubo));
  aplicarGiros(cubo, seq("R'"));
  assert.ok(estaResolvido(cubo));
});

test("girar o cubo inteiro não desarruma", () => {
  assert.ok(estaResolvido(aplicarGiros(criarCubo(3), seq("x y2 z'"))));
});

test("R deixa a cor da frente em cima (verde sobe)", () => {
  const net = planificar(aplicarGiros(criarCubo(3), seq("R")));
  // coluna da direita do U vira verde (2); coluna da direita do F vira amarelo (1)
  assert.deepEqual(net.U.map((linha) => linha[2]), [2, 2, 2]);
  assert.deepEqual(net.F.map((linha) => linha[2]), [1, 1, 1]);
  assert.deepEqual(net.U.map((linha) => linha[0]), [0, 0, 0]);
});

test("U leva a frente para a esquerda", () => {
  const net = planificar(aplicarGiros(criarCubo(3), seq("U")));
  assert.deepEqual(net.L[0], [2, 2, 2]);
  assert.deepEqual(net.F[0], [4, 4, 4]);
});

test("embaralhamento + caminho de volta resolve (2×2, 3×3, 4×4)", () => {
  for (const n of [2, 3, 4]) {
    const giros = gerarEmbaralhamento(n, semente(n * 7));
    const cubo = aplicarGiros(criarCubo(n), giros);
    assert.ok(!estaResolvido(cubo), `n=${n} embaralhou`);
    aplicarGiros(cubo, caminhoDeVolta(giros));
    assert.ok(estaResolvido(cubo), `n=${n} voltou`);
    for (let i = 1; i < giros.length; i += 1) assert.notEqual(giros[i].eixo, giros[i - 1].eixo);
  }
});

test("notação de ida e volta", () => {
  for (const t of ["R", "R'", "R2", "L", "U'", "D2", "F", "B'", "x", "y'", "z2"]) {
    assert.equal(notacao(giroDaNotacao(t)), t);
  }
  assert.equal(notacao(giroDaNotacao("2R", 4), 4), "2R");
  assert.equal(notacao({ eixo: "x", camada: 0, q: 1 }), "M");
});

test("simplificar junta e anula", () => {
  assert.deepEqual(simplificar(seq("R R")), seq("R2"));
  assert.deepEqual(simplificar(seq("R R'")), []);
  assert.deepEqual(simplificar(seq("U R R' U'")), []);
});

test("tempos e médias", () => {
  assert.equal(formatarTempo(12345), "12.34");
  assert.equal(formatarTempo(62340), "1:02.34");
  assert.equal(mediaDe([10, 20, 30, 40, 50], 5), 30);
  assert.equal(mediaDe([10, 20, null, 40, 50], 5), 110 / 3);
  assert.equal(mediaDe([10, null, null, 40, 50], 5), Infinity);
  assert.equal(mediaDe([1, 2], 5), null);
  const r = resumoTempos([{ ms: 9000 }, { ms: 8000, mais2: true }, { ms: 1, dnf: true }]);
  assert.equal(r.melhor, 9000);
  assert.equal(r.total, 3);
});

import { etapaDoMetodo } from "../shared/cubo.mjs";

test("etapa do método reconhece o progresso", () => {
  assert.equal(etapaDoMetodo(criarCubo(3)).indice, 7);
  assert.equal(etapaDoMetodo(criarCubo(2)), null);
  // mexer só a face amarela (D) mantém as duas primeiras camadas prontas
  const soTopo = aplicarGiros(criarCubo(3), seq("D"));
  assert.equal(etapaDoMetodo(soTopo).indice, 4, "duas camadas prontas, falta acertar as arestas amarelas");
  // F2 tira uma aresta branca do lugar: volta para a cruz
  const semCruz = aplicarGiros(criarCubo(3), seq("F2"));
  assert.equal(etapaDoMetodo(semCruz).indice, 0);
  assert.equal(etapaDoMetodo(semCruz).feitas, 3);
  // virar o cubo inteiro não muda nada
  assert.equal(etapaDoMetodo(aplicarGiros(criarCubo(3), seq("x2 y"))).indice, 7);
});
