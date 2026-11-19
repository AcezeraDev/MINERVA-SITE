import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTAGEM_MS,
  MINE_ID,
  TEMPO_PERGUNTA_MS,
  TEMPO_REVELACAO_MS,
  abandonar,
  avancar,
  codigoValido,
  criarDuelo,
  entrarNoDuelo,
  limparPerguntas,
  novoCodigo,
  responder,
  resultadoDe,
  vistaDe,
} from "../shared/duelo.mjs";
import { lerLeitura, marcarPalavras, minutosLeitura } from "../shared/leitura.mjs";
import { dueloXp, gamificationStats, leituraXp, totalXp } from "../shared/xp.mjs";

const perguntas = limparPerguntas(
  Array.from({ length: 5 }, (_, i) => ({ question: `Pergunta ${i}?`, options: ["a", "b", "c", "d"], correct: i % 4, explanation: "porque sim" })),
);

test("código tem 5 letras sem as confusas", () => {
  for (let i = 0; i < 50; i += 1) assert.ok(codigoValido(novoCodigo()));
  assert.equal(codigoValido("ABCD0"), false);
});

test("duelo entre duas pessoas: placar, gabarito escondido e fim", () => {
  const t0 = 1_000_000;
  const estado = criarDuelo({ codigo: "ABCDE", tema: "Biologia", dono: { id: "u1", nome: "Ana" }, perguntas, agora: t0 });
  assert.equal(estado.status, "sala");
  assert.ok(entrarNoDuelo(estado, { id: "u2", nome: "Bia" }, t0 + 1000).ok);
  assert.equal(estado.status, "jogando");
  const inicio = t0 + 1000 + CONTAGEM_MS;
  // antes da contagem acabar nem a pergunta aparece
  assert.equal(vistaDe(estado, "u1", inicio - 10).perguntas[0], null);
  assert.equal(responder(estado, "u1", 0, 0, inicio + 2000).ok, true);
  const vistaBia = vistaDe(estado, "u2", inicio + 2100);
  assert.equal(vistaBia.perguntas[0].correta, -1, "gabarito escondido enquanto a pergunta está aberta");
  assert.equal(vistaBia.jogadores.find((j) => j.id === "u1").respostas[0].escolha, -2, "escolha do adversário escondida");
  assert.equal(vistaBia.jogadores.find((j) => j.id === "u1").pontos, 0, "placar não entrega o acerto escondido");
  assert.equal(responder(estado, "u2", 0, 1, inicio + 3000).ok, true);
  assert.ok(estado.revelandoAte > 0);
  assert.equal(vistaDe(estado, "u2", inicio + 3100).perguntas[0].correta, 0);
  // ninguém mais responde: o tempo leva até o fim
  avancar(estado, inicio + 10 * (TEMPO_PERGUNTA_MS + TEMPO_REVELACAO_MS));
  assert.equal(estado.status, "fim");
  assert.equal(resultadoDe(estado, "u1"), "vitoria");
  assert.equal(resultadoDe(estado, "u2"), "derrota");
});

test("contra a Mine o duelo começa sozinho e a Mine responde", () => {
  const estado = criarDuelo({ codigo: "MINE2", tema: "História", dono: { id: "u1", nome: "Ana" }, perguntas, contraMine: true, agora: 0 });
  assert.equal(estado.status, "jogando");
  avancar(estado, CONTAGEM_MS + 14_000);
  const mine = estado.jogadores.find((j) => j.id === MINE_ID);
  assert.equal(mine.respostas.length, 1);
  avancar(estado, 10_000_000);
  assert.equal(estado.status, "fim");
});

test("quem sai perde", () => {
  const estado = criarDuelo({ codigo: "SAIUU", tema: "x", dono: { id: "u1", nome: "Ana" }, perguntas, agora: 0 });
  entrarNoDuelo(estado, { id: "u2", nome: "Bia" }, 10);
  abandonar(estado, "u2", "saiu", 20);
  assert.equal(estado.abandono, "saiu");
  assert.equal(resultadoDe(estado, "u1"), "vitoria");
});

test("leitura: só ficam palavras que existem no texto e 3+ perguntas", () => {
  const texto = "O cortiço acordava com a indolência da manhã. ".repeat(10);
  const pergunta = { pergunta: "Qual a ideia central?", alternativas: ["a", "b", "c", "d"], correta: 1, explicacao: "Porque o texto diz.", trecho: "" };
  const resposta = JSON.stringify({
    titulo: "O Cortiço",
    resumo: "O texto descreve o despertar de um cortiço no Rio de Janeiro, com detalhes sensoriais.",
    ideias: ["O cortiço acorda cedo"],
    palavras: [{ palavra: "indolencia", significado: "preguiça, moleza" }, { palavra: "inexistente", significado: "não está no texto" }],
    perguntas: [pergunta, pergunta, pergunta],
  });
  const leitura = lerLeitura(resposta, texto);
  assert.ok(leitura);
  assert.equal(leitura.palavras.length, 1);
  const partes = marcarPalavras(texto, leitura.palavras);
  assert.equal(partes.filter((p) => p.marca === 0).length, 10);
  assert.equal(lerLeitura(JSON.stringify({ resumo: "curto", perguntas: [] }), texto), null);
  assert.equal(minutosLeitura("palavra ".repeat(600)), 3);
});

test("XP novo entra no total com teto diário", () => {
  const agora = Date.now();
  const sessions = [
    ...Array.from({ length: 10 }, (_, i) => ({ kind: "Duelo", createdAt: agora - i, xpEarned: 999 })),
    { kind: "Leitura", createdAt: agora, xpEarned: leituraXp(4) },
    { kind: "Laboratório", createdAt: agora, xpEarned: 10 },
  ];
  const stats = gamificationStats({ sessions }, agora);
  assert.equal(stats.dueloXp, 6 * dueloXp("vitoria"));
  assert.equal(stats.leituraXp, 26);
  assert.equal(stats.labXp, 10);
  assert.ok(totalXp(stats) >= stats.dueloXp + stats.leituraXp + stats.labXp);
});

test("gabarito confiável: embaralha levando a correta e só fica o que a conferência confirma", async () => {
  const { embaralharPergunta, lerConferencia, perguntasConferidas, textoParaConferir } = await import("../shared/duelo.mjs");
  const base = { pergunta: "Qual mob explode?", alternativas: ["Creeper", "Zumbi", "Aranha", "Esqueleto"], correta: 0, explicacao: "O creeper explode." };
  for (let s = 0; s < 20; s += 1) {
    let x = s / 20;
    const p = embaralharPergunta(base, () => ((x = (x * 9301 + 0.49297) % 1)));
    assert.equal(p.alternativas[p.correta], "Creeper");
    assert.deepEqual([...p.alternativas].sort(), [...base.alternativas].sort());
  }
  const lista = [base, { ...base, correta: 2 }, { ...base, correta: 3 }];
  const texto = textoParaConferir(lista);
  assert.match(texto, /^1\. Qual mob explode\?\nA\) Creeper/);
  assert.doesNotMatch(texto, /explode\./);
  const respostas = lerConferencia("1: A\n2: ?\nQuestão 3) D", 3);
  assert.deepEqual(respostas, [0, -1, 3]);
  assert.equal(perguntasConferidas(lista, respostas).length, 2);
});
