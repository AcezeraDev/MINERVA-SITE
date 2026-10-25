import test from "node:test";
import assert from "node:assert/strict";

import { contarLinhas, lerCorrecao, marcarTrechos, situacaoFolha } from "../shared/redacao.mjs";
import { atividadesExemplo, corrigirObjetiva, lerAtividade, lerNumero, pontuar, respondida } from "../shared/atividades.mjs";
import { atividadeXp, gamificationStats, redacaoXp, xpSince } from "../shared/xp.mjs";
import { replyQualityIssue } from "../mine/quality.mjs";

const redacao = "A desinformação se espalha rápido.\nPor isso, a escola deve ensinar a checar fontes.";

const correcao = {
  competencias: [
    { nota: 150, comentario: "Poucos desvios." },
    { nota: 160, comentario: "Tema bem compreendido." },
    { nota: 120, comentario: "Argumentos previsíveis." },
    { nota: 120, comentario: "Conectivos repetidos." },
    { nota: 80, comentario: "Faltou agente e meio." },
  ],
  trechos: [
    { trecho: "se espalha rápido", tipo: "acerto", competencia: 2, comentario: "Boa tese." },
    { trecho: "trecho que não existe", tipo: "erro", competencia: 1, comentario: "Inventado." },
    { trecho: "a escola deve ensinar", tipo: "erro", competencia: 5, comentario: "Detalhe o meio.", sugestao: "a escola, por meio de oficinas, deve ensinar" },
  ],
  resumo: "Texto curto.",
  proximoPasso: "Detalhe a proposta.",
};

test("correção: arredonda para o degrau do ENEM e descarta trecho inventado", () => {
  const lida = lerCorrecao(JSON.stringify(correcao), redacao);
  assert.equal(lida.notas[0].nota, 160);
  assert.equal(lida.total, 640);
  assert.equal(lida.trechos.length, 2);
  assert.ok(lida.trechos.every((item) => redacao.includes(item.trecho)));
});

test("correção: aceita cercas de markdown e recusa competência faltando", () => {
  assert.ok(lerCorrecao("```json\n" + JSON.stringify(correcao) + "\n```", redacao));
  assert.equal(lerCorrecao(JSON.stringify({ ...correcao, competencias: correcao.competencias.slice(0, 4) }), redacao), null);
  assert.equal(replyQualityIssue({ task: "redacao", reply: "texto solto", prompt: redacao }), "correcao de redacao fora do formato");
  assert.equal(replyQualityIssue({ task: "redacao", reply: JSON.stringify(correcao), prompt: redacao }), "");
});

test("grifos: pedaços cobrem o texto inteiro, na ordem", () => {
  const lida = lerCorrecao(correcao, redacao);
  const partes = marcarTrechos(redacao, lida.trechos);
  assert.equal(partes.map((parte) => parte.texto).join(""), redacao);
  assert.equal(partes.filter((parte) => parte.marca >= 0).length, 2);
});

test("folha: menos de 7 linhas não pode ser corrigida", () => {
  assert.equal(situacaoFolha("curta").ok, false);
  const longa = Array.from({ length: 8 }, () => "x".repeat(70)).join("\n");
  assert.equal(contarLinhas(longa), 8);
  assert.equal(situacaoFolha(longa).ok, true);
});

test("exemplos: as duas atividades prontas passam no leitor com todos os tipos", () => {
  const tipos = new Set();
  for (const exemplo of atividadesExemplo) {
    const atividade = lerAtividade(exemplo);
    assert.ok(atividade, exemplo.titulo);
    assert.equal(atividade.questoes.length, exemplo.questoes.length);
    atividade.questoes.forEach((questao) => tipos.add(questao.tipo));
  }
  assert.deepEqual([...tipos].sort(), ["categorias", "dissertativa", "lacunas", "ligar", "multipla", "numerica", "ordenar", "sequencia", "vf"]);
  assert.equal(replyQualityIssue({ task: "atividade", reply: JSON.stringify(atividadesExemplo[0]) }), "");
  assert.equal(replyQualityIssue({ task: "atividade", reply: "{}" }), "atividade incompleta ou fora do formato");
});

test("questões interativas: acerto, parcial e null vindo do rascunho", () => {
  const [portugues, matematica] = atividadesExemplo.map((exemplo) => lerAtividade(exemplo));
  const porTipo = (atividade, tipo) => atividade.questoes.find((questao) => questao.tipo === tipo);

  const vf = porTipo(portugues, "vf");
  assert.equal(corrigirObjetiva(vf, [true, false, true, false]), 1);
  assert.equal(corrigirObjetiva(vf, [true, true, true, true]), 0.5);

  const ligar = porTipo(portugues, "ligar");
  assert.equal(corrigirObjetiva(ligar, [0, 1, 2, 3, 4]), 1);
  // JSON transforma ligação vazia em null; null não pode valer como o par 0
  assert.equal(corrigirObjetiva(ligar, [null, 1, 2, 3, 4]), 0.8);
  assert.equal(respondida(ligar, [null, 1, 2, 3, 4]), false);

  const categorias = porTipo(portugues, "categorias");
  assert.equal(corrigirObjetiva(categorias, [0, 1, 0, 1, 1, 0]), 1);
  assert.equal(corrigirObjetiva(categorias, [null, 1, 0, 1, 1, 0]), 5 / 6);

  const sequencia = porTipo(matematica, "sequencia");
  assert.equal(corrigirObjetiva(sequencia, [0, 1, 2, 3, 4]), 1);
  assert.equal(corrigirObjetiva(sequencia, [1, 0, 2, 3, 4]), 0.6);

  const numerica = porTipo(matematica, "numerica");
  assert.equal(corrigirObjetiva(numerica, "153"), 1);
  assert.equal(corrigirObjetiva(numerica, "153,00"), 1);
  assert.equal(corrigirObjetiva(numerica, "152"), 0);
  assert.equal(lerNumero("R$ 1.200,50"), 1200.5);

  const ordenar = porTipo(portugues, "ordenar");
  assert.equal(corrigirObjetiva(ordenar, ordenar.frase.split(" ")), 1);
  assert.equal(corrigirObjetiva(ordenar, [...ordenar.frase.split(" ")].reverse()), 0);

  const lacunas = porTipo(portugues, "lacunas");
  assert.equal(corrigirObjetiva(lacunas, [null, 0, 2]), 2 / 3);
});

test("pontos: dissertativa entra pela nota da Mine", () => {
  const atividade = lerAtividade(atividadesExemplo[1]);
  const respostas = atividade.questoes.map((questao) => {
    if (questao.tipo === "ordenar") return questao.frase.split(" ");
    if (questao.tipo === "vf") return questao.afirmacoes.map((item) => item.verdadeira);
    if (questao.tipo === "multipla") return questao.correta;
    if (questao.tipo === "categorias") return questao.itens.map((item) => item.categoria);
    if (questao.tipo === "sequencia") return questao.itens.map((_, indice) => indice);
    if (questao.tipo === "numerica") return String(questao.resposta);
    return "texto";
  });
  const indiceDissertativa = atividade.questoes.findIndex((questao) => questao.tipo === "dissertativa");
  const nota = pontuar(atividade.questoes, respostas, { [indiceDissertativa]: { nota: 5 } });
  assert.equal(nota.maximo, 80);
  assert.equal(nota.pontos, 75);
  assert.equal(nota.acertos, 7);
});

test("XP: redação e atividade têm teto por envio e por dia", () => {
  assert.equal(redacaoXp(0), 10);
  assert.equal(redacaoXp(1000), 40);
  assert.equal(atividadeXp(7), 40);
  const dia = new Date(2026, 9, 25, 12).getTime();
  const sessions = [
    ...Array.from({ length: 5 }, (_, i) => ({ kind: "Redação", createdAt: dia + i, xpEarned: 40 })),
    { kind: "Atividade", createdAt: dia, xpEarned: 9999 },
  ];
  const stats = gamificationStats({ sessions }, dia);
  assert.equal(stats.redacoes, 5);
  assert.equal(stats.redacaoXp, 120);
  assert.equal(stats.atividadeXp, 40);
  assert.equal(xpSince({ sessions }, dia - 1), 160);
});
