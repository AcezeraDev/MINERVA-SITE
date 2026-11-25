import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProfileInstruction, buildSuggestionsInstruction, buildToolsInstruction } from "../mine/prompts.mjs";
import { sanitizeAluno } from "../mine/tools.mjs";

test("a ficha do aluno vira instrução só com o que foi preenchido", () => {
  assert.equal(buildProfileInstruction(null), "");
  assert.equal(buildProfileInstruction({ nome: "", preferencias: [] }), "");
  const texto = buildProfileInstruction({ nome: "Davi", serie: "9º ano", aprendo: "Passo a passo", preferencias: ["Analogia (em Fotossíntese)"] });
  assert.match(texto, /Como chamar: Davi/);
  assert.match(texto, /9º ano/);
  assert.match(texto, /Analogia \(em Fotossíntese\)/);
  assert.doesNotMatch(texto, /Objetivo/);
  assert.equal(texto.split("\n").length, 5);
});

test("o servidor confere e corta o perfil que vem do navegador", () => {
  const aluno = sanitizeAluno({ perfil: { nome: "x".repeat(200), serie: "1º ano", preferencias: Array(20).fill("a"), extra: "não passa" } });
  assert.equal(aluno.perfil.nome.length, 60);
  assert.equal(aluno.perfil.preferencias.length, 8);
  assert.equal("extra" in aluno.perfil, false);
  assert.equal(sanitizeAluno({}).perfil, null);
});

test("os blocos novos e os tipos de quiz estão nas instruções", () => {
  const tools = buildToolsInstruction({ ferramentas: false });
  for (const bloco of ["```simulacao", "```passos", "```roteiro", "```dois-jeitos", "```correcao", "```podcast", "```slides"]) assert.ok(tools.includes(bloco), bloco);
  assert.match(tools, /"tipo": "lacuna"/);
  assert.match(tools, /de onde veio cada pergunta/);
});

test("a Mine é orientada a fechar com uma oferta de sim ou não", () => {
  assert.match(buildSuggestionsInstruction(), /botao de um toque/);
});

test("o formato dos blocos novos só vai quando o pedido combina", () => {
  const comum = buildToolsInstruction({ ferramentas: false, pedido: "qual a capital da França?" });
  assert.equal(comum.includes("```podcast"), false);
  assert.equal(comum.includes("```simulacao"), false);
  assert.ok(comum.includes("```quiz"));
  assert.ok(buildToolsInstruction({ ferramentas: false, pedido: "faz um podcast sobre isso" }).includes("```podcast"));
  assert.ok(buildToolsInstruction({ ferramentas: false, pedido: "resolve 3x - 5 = 10" }).includes("```passos"));
  assert.ok(buildToolsInstruction({ ferramentas: false, pedido: "Sim, quero.\nQuer que eu faça um vídeo-resumo em slides?" }).includes("```slides"));
  assert.ok(buildToolsInstruction({ ferramentas: false, pedido: "corrige", anexoImagem: true }).includes("```correcao"));
});

test("aula por voz pede resposta curta e sem formatação", async () => {
  const { buildVoiceCallInstruction } = await import("../mine/prompts.mjs");
  assert.match(buildVoiceCallInstruction(), /2 a 4 frases/);
  assert.match(buildVoiceCallInstruction(), /Nada de markdown/);
});
