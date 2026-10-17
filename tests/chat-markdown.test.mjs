import test from "node:test";
import assert from "node:assert/strict";

import { calloutKind, labelOf, parseBlocks, parseInline } from "../shared/chat-markdown.mjs";

const types = (blocks) => blocks.map((block) => block.type);

test("tabela com e sem bordas vira bloco de tabela com alinhamento", () => {
  const [table] = parseBlocks("| Produto | Preço |\n|---|---:|\n| Caderno | R$ 15,00 |\n| Lápis | R$ 2,00 |");
  assert.equal(table.type, "table");
  assert.deepEqual(table.header, ["Produto", "Preço"]);
  assert.deepEqual(table.align, ["left", "right"]);
  assert.deepEqual(table.rows[1], ["Lápis", "R$ 2,00"]);

  const [loose] = parseBlocks("a | b\n--|--\n1 | 2");
  assert.equal(loose.type, "table");
  assert.deepEqual(loose.rows, [["1", "2"]]);
});

test("barra dentro de formula ou codigo nao separa coluna", () => {
  const [table] = parseBlocks("| Expressão | Valor |\n|---|---|\n| $|x|$ | `a || b` |");
  assert.deepEqual(table.rows[0], ["$|x|$", "`a || b`"]);
});

test("codigo com linguagem, e cerca aberta durante o streaming", () => {
  const [closed] = parseBlocks("```python\nprint('oi')\n```");
  assert.deepEqual(closed, { type: "code", lang: "python", code: "print('oi')", open: false });
  const [open] = parseBlocks("```js\nconst a = 1;", { streaming: true });
  assert.equal(open.type, "code");
  assert.equal(open.open, true);
  assert.equal(open.code, "const a = 1;");
});

test("formula em bloco com $$ e com \\[ \\]", () => {
  assert.deepEqual(parseBlocks("$$x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}$$")[0], {
    type: "math",
    tex: "x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}",
    open: false,
  });
  const [multi] = parseBlocks("$$\na^2 + b^2 = c^2\n$$");
  assert.equal(multi.tex, "a^2 + b^2 = c^2");
  assert.equal(parseBlocks("\\[\nE = mc^2\n\\]")[0].tex, "E = mc^2");
  assert.equal(parseBlocks("$$\nE = mc", { streaming: true })[0].open, true);
});

test("formula inline nao confunde preco em reais", () => {
  const tokens = parseInline("Custa R$ 15,00 e a área é $A = \\pi r^2$ ou $2^3$.");
  const maths = tokens.filter((token) => token.type === "math").map((token) => token.tex);
  assert.deepEqual(maths, ["A = \\pi r^2", "2^3"]);
  assert.equal(parseInline("Paguei R$5,00 ou R$10").some((token) => token.type === "math"), false);
});

test("enfase, marca-texto, link e codigo inline", () => {
  const tokens = parseInline("Use **negrito com $x$**, ==termo-chave==, *itálico*, `code` e [MDN](https://developer.mozilla.org).");
  const kinds = tokens.map((token) => token.type).filter((type) => type !== "text");
  assert.deepEqual(kinds, ["strong", "mark", "em", "code", "link"]);
  assert.equal(tokens.find((token) => token.type === "strong").children.some((token) => token.type === "math"), true);
  // Multiplicacao e snake_case nao viram italico.
  assert.equal(parseInline("2 * 3 * 4 e minha_variavel_x").some((token) => token.type === "em"), false);
  // Link sem http nao vira link.
  assert.equal(parseInline("[x](javascript:alert(1))").some((token) => token.type === "link"), false);
});

test("cartoes de destaque: sintaxe [!TIPO] e rotulo no inicio da linha", () => {
  const [bracket] = parseBlocks("> [!ATENÇÃO] Cuidado com o sinal\n> O delta negativo não tem raiz real.");
  assert.equal(bracket.type, "callout");
  assert.equal(bracket.kind, "warning");
  assert.equal(bracket.title, "Cuidado com o sinal");
  assert.equal(bracket.children[0].text, "O delta negativo não tem raiz real.");

  const [labeled] = parseBlocks("**Dica:** decore a fórmula pelo desenho.\ncontinua aqui");
  assert.equal(labeled.kind, "tip");
  assert.equal(labeled.children.length, 2);

  assert.equal(calloutKind("Erro comum"), "mistake");
  assert.equal(calloutKind("Resposta"), null);
  // "Resposta:" continua sendo rotulo de paragrafo, nao cartao.
  assert.deepEqual(types(parseBlocks("Resposta: 42")), ["paragraph"]);
  assert.equal(labelOf("Resposta: 42").label, "Resposta");
});

test("citacao comum continua citacao", () => {
  const [quote] = parseBlocks("> Penso, logo existo.\n> — Descartes");
  assert.equal(quote.type, "quote");
  assert.equal(quote.children.length, 2);
});

test("listas aninhadas por indentacao e numeradas", () => {
  const [list] = parseBlocks("1. Primeiro\n2. Segundo\n   - detalhe a\n   - detalhe b\n3. Terceiro");
  assert.equal(list.ordered, true);
  assert.equal(list.items.length, 3);
  assert.equal(list.items[1].children[0].items.length, 2);
  assert.equal(list.items[1].children[0].ordered, false);
});

test("titulos, regra e paragrafos em sequencia", () => {
  const blocks = parseBlocks("## Fotossíntese\nTexto um.\n\n---\n### Etapas\nTexto dois.");
  assert.deepEqual(types(blocks), ["heading", "paragraph", "rule", "heading", "paragraph"]);
  assert.equal(blocks[0].level, 2);
  assert.equal(blocks[3].level, 3);
});

test("rotulo com negrito em volta ou depois nao deixa asterisco solto", () => {
  const texto = (line) => parseBlocks(line)[0].children[0].text;
  assert.equal(texto("Resumo: **calcule o delta primeiro**. Depois use a fórmula."), "**calcule o delta primeiro**. Depois use a fórmula.");
  assert.equal(texto("**Resumo:** calcule o delta."), "calcule o delta.");
  assert.equal(texto("**Resumo: o delta decide tudo**; depois, use a fórmula."), "**o delta decide tudo**; depois, use a fórmula.");
  assert.equal(labelOf("**Resposta:** as raízes são 2 e 3").rest, "as raízes são 2 e 3");
  assert.equal(labelOf("Resposta: **as raízes** são 2 e 3").rest, "**as raízes** são 2 e 3");
});

test("formula sozinha na linha com cifrao simples vira formula em destaque", () => {
  assert.deepEqual(parseBlocks("$\\Delta = b^2 - 4ac$")[0], { type: "math", tex: "\\Delta = b^2 - 4ac", open: false });
  assert.equal(parseBlocks("\\(x = 2\\)")[0].type, "math");
  // Frase com formula no meio continua paragrafo.
  assert.equal(parseBlocks("A área é $A = \\pi r^2$ para o círculo.")[0].type, "paragraph");
  // Palavra solta entre cifroes nao e formula.
  assert.equal(parseBlocks("$texto$")[0].type, "paragraph");
});

test("citacoes [n] da pesquisa viram tokens proprios, sem pegar indice de vetor nem link", () => {
  assert.deepEqual(parseInline("As provas sao em novembro [1][2]."), [
    { type: "text", text: "As provas sao em novembro " },
    { type: "cite", index: 1 },
    { type: "cite", index: 2 },
    { type: "text", text: "." },
  ]);
  assert.deepEqual(parseInline("lista[1] e v[2]"), [{ type: "text", text: "lista[1] e v[2]" }]);
  assert.equal(parseInline("[1](https://exemplo.com)")[0].type, "link");
  assert.equal(parseInline("`a[1]`")[0].type, "code");
});
