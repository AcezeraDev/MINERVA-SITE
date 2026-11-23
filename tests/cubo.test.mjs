import test from "node:test";
import assert from "node:assert/strict";
import {
  aplicarGiros,
  caminhoDeVolta,
  criarCubo,
  criarCuboTipo,
  estaResolvido,
  formatarTempo,
  gerarEmbaralhamento,
  gerarEmbaralhamentoTipo,
  giroDaNotacao,
  mediaDe,
  notacao,
  passoDoEixo,
  planificar,
  resumoTempos,
  simplificar,
} from "../shared/cubo.mjs";
import {
  aplicarGiroPyraminx,
  aplicarGirosPyraminx,
  caminhoDeVoltaPyraminx,
  criarPyraminx,
  estaResolvidoPyraminx,
  gerarEmbaralhamentoPyraminx,
  notacaoPyraminx,
} from "../shared/pyraminx.mjs";

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

test("etapa aponta as peças que faltam e para onde vão", () => {
  const e = etapaDoMetodo(aplicarGiros(criarCubo(3), seq("F2")));
  assert.equal(e.pendentes.length, 1);
  const aresta = e.pendentes[0];
  assert.deepEqual([...aresta.cores].sort(), [0, 2]); // branco e verde
  assert.deepEqual(aresta.onde.map((n) => n.join(",")).sort(), ["0,-1,0", "0,0,1"]); // embaixo, na frente
  assert.deepEqual(aresta.destino.map((n) => n.join(",")).sort(), ["0,0,1", "0,1,0"]); // em cima, na frente
});

test("novos tipos de cubo: 5×5, Mirror, Void e cuboides (2×2×3, 3×3×2)", () => {
  assert.equal(criarCuboTipo("5x5").pecas.length, 98);
  assert.equal(criarCuboTipo("mirror").pecas.length, 26);
  assert.equal(criarCuboTipo("void").pecas.length, 20);
  assert.equal(criarCuboTipo("2x2x3").pecas.length, 12);
  assert.equal(criarCuboTipo("3x3x2").pecas.length, 18);

  // Cuboides: eixo Y gira 90° (passo 1), X e Z giram 180° (passo 2)
  const torre = criarCuboTipo("2x2x3");
  assert.equal(passoDoEixo(torre, "y"), 1);
  assert.equal(passoDoEixo(torre, "x"), 2);
  assert.equal(passoDoEixo(torre, "z"), 2);

  for (const tipo of ["5x5", "mirror", "void", "2x2x3", "3x3x2"]) {
    const giros = gerarEmbaralhamentoTipo(tipo, semente(42));
    const cubo = aplicarGiros(criarCuboTipo(tipo), giros);
    assert.ok(!estaResolvido(cubo), `${tipo} embaralhou`);
    aplicarGiros(cubo, caminhoDeVolta(giros));
    assert.ok(estaResolvido(cubo), `${tipo} voltou`);
  }
});

test("Pyraminx: 14 peças, 3 giros de 120° voltam ao início, embaralhamento + volta resolve", () => {
  const p = criarPyraminx();
  assert.equal(p.pecas.length, 14);
  assert.ok(estaResolvidoPyraminx(p));

  // 3 giros de 120° no mesmo eixo voltam ao resolvido
  for (let i = 0; i < 3; i += 1) aplicarGiroPyraminx(p, { eixo: 0, camada: 2, q: 1 });
  assert.ok(estaResolvidoPyraminx(p));

  // 1 giro desarruma e inverso arruma
  aplicarGiroPyraminx(p, { eixo: 2, camada: 2, q: 1 });
  assert.ok(!estaResolvidoPyraminx(p));
  aplicarGiroPyraminx(p, { eixo: 2, camada: 2, q: -1 });
  assert.ok(estaResolvidoPyraminx(p));

  // Embaralhamento e volta
  const giros = gerarEmbaralhamentoPyraminx(semente(99));
  const emb = aplicarGirosPyraminx(criarPyraminx(), giros);
  assert.ok(!estaResolvidoPyraminx(emb));
  aplicarGirosPyraminx(emb, caminhoDeVoltaPyraminx(giros));
  assert.ok(estaResolvidoPyraminx(emb));
  assert.equal(notacaoPyraminx({ eixo: 0, camada: 2, q: 1 }), "U");
  assert.equal(notacaoPyraminx({ eixo: 2, camada: 1, q: -1 }), "r'");
});
