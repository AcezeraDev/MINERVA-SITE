import test from "node:test";
import assert from "node:assert/strict";
import { apoioDaProposta, elementosIntervencao, propostasRedacao } from "../shared/redacao-propostas.mjs";
import { gamificationStats, redacaoPropostaXp, redacaoPropostaXpMax, redacaoXp, redacaoXpMax } from "../shared/xp.mjs";

test("as propostas prontas são coletâneas completas e únicas", () => {
  assert.equal(propostasRedacao.length, 10);
  assert.equal(new Set(propostasRedacao.map((item) => item.id)).size, 10);
  propostasRedacao.forEach((proposta, indice) => {
    assert.equal(proposta.numero, indice + 1);
    assert.ok(proposta.textos.length >= 3, proposta.id);
    assert.ok(proposta.enunciado.includes(`“${proposta.titulo}”`), proposta.id);
    assert.ok(proposta.repertorio.length >= 2, proposta.id);
    for (const texto of proposta.textos) {
      assert.ok(texto.fonte, `${proposta.id} sem fonte`);
      if (texto.tipo === "tabela") assert.ok(texto.linhas.every((linha) => linha.length === texto.colunas.length), `${proposta.id} tabela torta`);
    }
    assert.equal(apoioDaProposta(proposta).length, proposta.textos.length);
  });
});

test("checklist da proposta de intervenção lê o último parágrafo", () => {
  const texto = "Introdução.\n\nDesenvolvimento.\n\nPortanto, o Ministério da Educação deve criar oficinas nas escolas por meio de parcerias com universidades, a fim de formar leitores, como clubes de leitura semanais.";
  assert.deepEqual(elementosIntervencao(texto), { agente: true, acao: true, meio: true, finalidade: true, detalhamento: true });
  assert.deepEqual(elementosIntervencao("Só uma frase sem proposta."), { agente: false, acao: false, meio: false, finalidade: false, detalhamento: false });
});

test("proposta pronta vale mais, mas só na primeira entrega", () => {
  assert.equal(redacaoPropostaXp(1000), redacaoPropostaXpMax);
  assert.ok(redacaoPropostaXp(600) > redacaoXp(600));
  const dia = new Date(2026, 10, 20, 10).getTime();
  const sessao = (id, xp, propostaId, minutos) => ({ id, kind: "Redação", xpEarned: xp, createdAt: dia + minutos * 60_000, ...(propostaId ? { propostaId } : {}) });
  // primeira entrega da proposta: até 70; a segunda da mesma volta a 40; tema livre: 40
  const stats = gamificationStats({ sessions: [sessao("a", 70, "agua", 0), sessao("b", 70, "agua", 10), sessao("c", 99, undefined, 20)] }, dia);
  assert.equal(stats.redacaoXp, redacaoPropostaXpMax + redacaoXpMax + redacaoXpMax);
  assert.equal(stats.propostas, 1);
});

test("proposta criada pela Mine sai no formato das prontas", async () => {
  const { montarPropostaCriada } = await import("../shared/redacao-propostas.mjs");
  const resposta = "```json\n" + JSON.stringify({
    titulo: "Desafios do uso do celular nas escolas brasileiras",
    eixo: "Educação",
    textos: [
      { tipo: "texto", corpo: ["O celular virou parte da rotina dos estudantes.", ""], fonte: "" },
      { tipo: "tabela", titulo: "Usos", colunas: ["Uso", "Efeito"], linhas: [["Pesquisa", "Ajuda"], ["Redes", "Distrai"], ["só uma coluna"]] },
      { tipo: "lista", titulo: "Pontos", itens: ["um"] },
      { tipo: "lei", corpo: ["sem título vira texto"] },
      { tipo: "desconhecido" },
    ],
    repertorio: ["Paulo Freire", "", "ECA"],
  }) + "\n```";
  const proposta = montarPropostaCriada(resposta, { temaDigitado: "celular na escola", id: "criada-1", numero: 11 });
  assert.ok(proposta);
  assert.equal(proposta.criada, true);
  assert.equal(proposta.numero, 11);
  assert.equal(proposta.textos.length, 3);
  assert.deepEqual(proposta.textos.map((item) => item.tipo), ["texto", "tabela", "texto"]);
  assert.equal(proposta.textos[1].linhas.length, 2);
  assert.equal(proposta.textos[0].fonte, "Texto elaborado para o Minerva.");
  assert.deepEqual(proposta.repertorio, ["Paulo Freire", "ECA"]);
  assert.ok(proposta.enunciado.includes(`“${proposta.titulo}”`));
  assert.ok(apoioDaProposta(proposta).length === 3);
  assert.equal(montarPropostaCriada("não é json"), null);
  assert.equal(montarPropostaCriada({ titulo: "x", textos: [{ tipo: "texto", corpo: ["só um"] }] }), null);
});
