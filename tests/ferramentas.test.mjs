import test from "node:test";
import assert from "node:assert/strict";
import { evaluate, solveEquation, tidyNumber, variablesOf } from "../shared/calc.mjs";
import { balance, element, molarMass } from "../shared/quimica.mjs";
import { KNOWLEDGE_TOOLS, STUDENT_TOOLS, runTools, sanitizeAluno } from "../mine/tools.mjs";
import { buildToolsInstruction } from "../mine/prompts.mjs";

const conta = (expressao, escopo) => tidyNumber(evaluate(expressao, escopo));

test("calcular: precedência, implícita, porcentagem, graus e arredondamento", () => {
  assert.equal(conta("0.1+0.2"), "0.3");
  assert.equal(conta("2^3^2"), "512");
  assert.equal(conta("-2^2"), "-4");
  assert.equal(conta("2x+1", { x: 3 }), "7");
  assert.equal(conta("3(4+1)"), "15");
  assert.equal(conta("(1+2)(3+4)"), "21");
  assert.equal(conta("15% * 200"), "30");
  assert.equal(conta("sqrt(16)+5!"), "124");
  assert.equal(conta("cosd(60)"), "0.5");
  assert.equal(conta("2,5*2"), "5");
  assert.equal(conta("1500*(1+0.02)^12"), "1902.362692");
  assert.deepEqual(variablesOf("a*x^2+b*x+c").sort(), ["a", "b", "c", "x"]);
  assert.throws(() => evaluate("2 +* 3"));
  assert.throws(() => evaluate("y + 1"), /variável/);
});

test("resolver equação: raízes reais, dupla e sem raiz", () => {
  assert.deepEqual(solveEquation("x^2-5x+6=0"), [2, 3]);
  assert.deepEqual(solveEquation("x^2=0"), [0]);
  assert.deepEqual(solveEquation("2^x=32").map(tidyNumber), ["5"]);
  assert.deepEqual(solveEquation("x^2+1=0"), []);
  assert.deepEqual(solveEquation("1/x=0"), []);
});

test("química: massa molar, balanceamento e elemento", () => {
  assert.equal(molarMass("H2O").massaMolar, 18.015);
  assert.equal(molarMass("CuSO4·5H2O").massaMolar, 249.677);
  assert.equal(balance("C3H8 + O2 -> CO2 + H2O").equacao, "C3H8 + 5O2 → 3CO2 + 4H2O");
  assert.equal(balance("KMnO4 + HCl -> KCl + MnCl2 + Cl2 + H2O").equacao, "2KMnO4 + 16HCl → 2KCl + 2MnCl2 + 5Cl2 + 8H2O");
  assert.equal(balance("Ca(OH)2 + H3PO4 -> Ca3(PO4)2 + H2O").equacao, "3Ca(OH)2 + 2H3PO4 → Ca3(PO4)2 + 6H2O");
  assert.equal(element("ferro").symbol, "Fe");
  assert.equal(element("79").name, "Ouro");
  assert.throws(() => molarMass("Xy2"));
});

test("ferramentas do aluno leem só o retrato enviado e criar_tarefa vira ação", async () => {
  const aluno = sanitizeAluno({
    hoje: "2026-11-20",
    tarefas: [
      { titulo: "Prova de Física", materia: "Física", prazo: "2026-11-24", tipo: "prova" },
      { titulo: "Lista atrasada", materia: "Matemática", prazo: "2026-11-18" },
      { titulo: "Bem longe", materia: "Química", prazo: "2027-03-01" },
    ],
    materias: [{ nome: "Biologia", conteudos: [{ titulo: "Fotossíntese", texto: "Ocorre nos cloroplastos." }] }],
    erros: [{ assunto: "Cinemática", materia: "Física", vezes: 3 }],
    progresso: { xp: 340, nivel: 4 },
    extra: "ignorado",
  });
  assert.equal(aluno.extra, undefined);
  const ctx = { aluno, actions: [] };
  const [agenda, busca, erros, progresso, tarefa] = await runTools(
    [
      { name: "ver_agenda", arguments: { dias: 7 } },
      { name: "buscar_meus_conteudos", arguments: { termo: "cloroplastos" } },
      { name: "meus_erros", arguments: {} },
      { name: "meu_progresso", arguments: {} },
      { name: "criar_tarefa", arguments: { titulo: "Revisar MRU", materia: "Física", dias_ate_o_prazo: 2 } },
    ],
    ctx,
  );
  const a = JSON.parse(agenda.result);
  assert.deepEqual(a.atrasadas.map((item) => item.titulo), ["Lista atrasada"]);
  assert.deepEqual(a.hoje_e_proximos.map((item) => item.titulo), ["Prova de Física"]);
  assert.equal(JSON.parse(busca.result).encontrados[0].titulo, "Fotossíntese");
  assert.equal(JSON.parse(erros.result).assuntos_que_mais_erra[0].assunto, "Cinemática");
  assert.equal(JSON.parse(progresso.result).xp, 340);
  assert.equal(JSON.parse(tarefa.result).criada, true);
  assert.deepEqual(ctx.actions, [{ type: "create_task", title: "Revisar MRU", subjectName: "Física", dueInDays: 2 }]);
});

test("sem retrato do aluno as ferramentas dele avisam em vez de inventar", async () => {
  const [res] = await runTools([{ name: "ver_agenda", arguments: {} }], { aluno: null, actions: [] });
  assert.match(res.result, /erro/);
});

test("definições e instrução das ferramentas", () => {
  const names = [...STUDENT_TOOLS, ...KNOWLEDGE_TOOLS].map((tool) => tool.function.name);
  assert.deepEqual(new Set(names).size, names.length);
  assert.ok(names.includes("questoes_enem") && names.includes("dados_ibge") && names.includes("calcular"));
  const comAluno = buildToolsInstruction({ ferramentas: true, aluno: true });
  assert.match(comAluno, /ver_agenda/);
  assert.match(comAluno, /```quiz/);
  const semFerramentas = buildToolsInstruction({ ferramentas: false });
  assert.doesNotMatch(semFerramentas, /FERRAMENTAS\n/);
  assert.match(semFerramentas, /```mapa/);
});
