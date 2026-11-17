import test from "node:test";
import assert from "node:assert/strict";

import { chartToCsv, formatValue, niceTicks, parseChartSpec, prepareSvg, toNumber } from "../shared/chart-spec.mjs";
import { parseBlocks } from "../shared/chat-markdown.mjs";
import { asksToGenerateImage } from "../shared/chat-media.mjs";

test("bloco grafico de barras vira grafico com rotulos e serie", () => {
  const { chart } = parseChartSpec('{"tipo": "barras", "titulo": "Populacao", "rotulos": ["2000", "2010"], "series": [{"nome": "Brasil", "valores": [169.8, 190.8]}], "unidade": "mi"}');
  assert.equal(chart.kind, "bar");
  assert.equal(chart.title, "Populacao");
  assert.deepEqual(chart.labels, ["2000", "2010"]);
  assert.deepEqual(chart.series[0].values, [169.8, 190.8]);
  assert.equal(chart.unit, "mi");
});

test("JSON de modelo com virgula sobrando e numero em texto ainda funciona", () => {
  const { chart } = parseChartSpec('{"tipo": "linhas", "rotulos": ["a", "b", "c",], "series": [{"nome": "x", "valores": ["1,5", "R$ 2,00", 3],}],}');
  assert.equal(chart.kind, "line");
  assert.deepEqual(chart.series[0].values, [1.5, 2, 3]);
});

test("grafico de funcao usa pontos com x numerico", () => {
  const { chart } = parseChartSpec('{"tipo": "linhas", "series": [{"nome": "y = x²", "pontos": [[-1, 1], [0, 0], [1, 1]]}]}');
  assert.equal(chart.xy, true);
  assert.deepEqual(chart.series[0].points, [[-1, 1], [0, 0], [1, 1]]);
});

test("pizza descarta fatia zerada e negativa", () => {
  const { chart } = parseChartSpec('{"tipo": "pizza", "rotulos": ["A", "B", "C"], "series": [{"valores": [3, 0, -1]}]}');
  assert.equal(chart.kind, "pie");
  assert.deepEqual(chart.labels, ["A"]);
});

test("grafico sem dados devolve erro em vez de quebrar", () => {
  assert.ok(parseChartSpec("{tipo: barras").error);
  assert.ok(parseChartSpec('{"tipo": "barras", "series": []}').error);
});

test("numeros no jeito brasileiro", () => {
  assert.equal(toNumber("1.234,5"), 1234.5);
  assert.equal(toNumber("12%"), 12);
  assert.equal(toNumber("abc"), null);
  assert.equal(formatValue(3.5, "R$"), "R$ 3,5");
  assert.equal(formatValue(42, "%"), "42%");
});

test("escala bonita comeca e termina em numero redondo", () => {
  const ticks = niceTicks(0, 203.1, 5);
  assert.equal(ticks[0], 0);
  assert.ok(ticks[ticks.length - 1] >= 203.1);
  assert.ok(ticks.every((tick) => tick % 50 === 0));
});

test("CSV usa ponto e virgula e virgula decimal", () => {
  const { chart } = parseChartSpec('{"rotulos": ["a"], "series": [{"nome": "s", "valores": [1.5]}]}');
  assert.equal(chartToCsv(chart), ";s\na;1,5");
});

test("SVG perde script e evento e ganha xmlns", () => {
  const svg = prepareSvg('<svg viewBox="0 0 10 10" onload="alert(1)"><script>alert(1)</script><circle r="2"/></svg>');
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.doesNotMatch(svg, /script|onload/);
  assert.equal(prepareSvg("nao e svg"), "");
});

test("cerca com acento abre bloco de grafico", () => {
  const [block] = parseBlocks('```gráfico\n{"series": [{"valores": [1]}]}\n```');
  assert.equal(block.type, "code");
  assert.equal(block.lang, "gráfico");
});

test("grafico e esquema nao vao para o gerador de imagem", () => {
  assert.equal(asksToGenerateImage("desenha um gráfico da população do Brasil"), false);
  assert.equal(asksToGenerateImage("faz um esquema do ciclo da água"), false);
  assert.equal(asksToGenerateImage("desenha um gato astronauta"), true);
});
