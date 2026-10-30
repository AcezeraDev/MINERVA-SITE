/**
 * Aba Provas: fazer a prova, ver o que errou e estudar exatamente aquilo.
 *
 * A prova usa a task "quiz" (formato P:/A)/CORRETA:/EXPLICACAO: lido por
 * parseQuiz). O estudo dos erros usa a task "prova-estudo": para cada erro a
 * Mine explica por que a alternativa marcada engana, da uma mini-aula, um
 * macete e uma questao-irma inedita. Acertar a irma e o que tira o erro do
 * caderno — reler a explicacao nao basta.
 *
 * Fica em shared porque o mesmo leitor e o controle de qualidade do servidor
 * (mine/quality.mjs) e o teste em tests/provas.test.mjs.
 */

import { parseQuiz } from "./study-parsers.mjs";

export const letrasProva = ["A", "B", "C", "D"];
export const quantidadesProva = [5, 10, 15];
export const dificuldadesProva = [
  { id: "facil", label: "Fácil", prompt: "facil" },
  { id: "medio", label: "Média", prompt: "media" },
  { id: "dificil", label: "Difícil", prompt: "dificil" },
];
/** O caderno guarda no aparelho; sem teto ele cresceria para sempre. */
export const limiteCaderno = 120;

function texto(valor) {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

/** Embaralha as alternativas mantendo o gabarito: refazer a mesma questão não pode ser decorar a letra. */
export function embaralharAlternativas(questao, semente = Date.now()) {
  let s = Math.floor(Math.abs(Number(semente) || 1)) % 2147483647 || 1;
  const sorteio = () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
  const ordem = questao.options.map((_, indice) => indice);
  for (let i = ordem.length - 1; i > 0; i -= 1) {
    const j = Math.floor(sorteio() * (i + 1));
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
  }
  return {
    ...questao,
    options: ordem.map((indice) => questao.options[indice]),
    correct: ordem.indexOf(questao.correct),
  };
}

/** Prova entregue: questão em branco conta como erro, porque também é algo a estudar. */
export function corrigirProva(questoes, respostas) {
  const itens = questoes.map((questao, indice) => {
    const marcada = Number.isInteger(respostas[indice]) ? respostas[indice] : null;
    return { indice, questao, marcada, certa: marcada === questao.correct };
  });
  const acertos = itens.filter((item) => item.certa).length;
  const total = questoes.length;
  return {
    itens,
    acertos,
    total,
    erros: itens.filter((item) => !item.certa),
    // nota de 0 a 10 com uma casa, como no boletim
    nota: total ? Math.round((acertos / total) * 100) / 10 : 0,
  };
}

function chaveQuestao(questao) {
  return texto(questao.question).toLowerCase();
}

/**
 * Junta os erros de uma prova ao caderno. A mesma questão errada de novo não
 * duplica: volta a ficar pendente e soma uma reincidência — é o sinal mais
 * forte de que aquele ponto precisa de estudo.
 */
export function anotarErros(caderno, erros, meta) {
  const lista = Array.isArray(caderno) ? [...caderno] : [];
  const agora = Number(meta.agora) || Date.now();
  erros.forEach((erro, posicao) => {
    const chave = chaveQuestao(erro.questao);
    const existente = lista.findIndex((item) => chaveQuestao(item.questao) === chave);
    if (existente >= 0) {
      const antigo = lista[existente];
      lista[existente] = { ...antigo, marcada: erro.marcada, status: "pendente", vezes: (antigo.vezes || 1) + 1, atualizadoEm: agora, estudo: antigo.estudo };
      return;
    }
    lista.unshift({
      id: `${meta.provaId}-${erro.indice}-${posicao}`,
      provaId: meta.provaId,
      assunto: meta.assunto,
      subjectId: meta.subjectId || "",
      questao: erro.questao,
      marcada: erro.marcada,
      status: "pendente",
      vezes: 1,
      criadoEm: agora,
      atualizadoEm: agora,
    });
  });
  return lista.slice(0, limiteCaderno);
}

/** Resultado da questão-irmã: acertou, o erro está dominado; errou, continua pendente. */
export function registrarIrma(caderno, id, acertou, agora = Date.now()) {
  return caderno.map((item) =>
    item.id === id
      ? { ...item, status: acertou ? "dominado" : "estudado", tentativas: (item.tentativas || 0) + 1, atualizadoEm: agora }
      : item,
  );
}

export function resumoCaderno(caderno) {
  const lista = Array.isArray(caderno) ? caderno : [];
  const contar = (status) => lista.filter((item) => item.status === status).length;
  const porAssunto = new Map();
  for (const item of lista) {
    if (item.status === "dominado") continue;
    porAssunto.set(item.assunto, (porAssunto.get(item.assunto) || 0) + 1);
  }
  return {
    total: lista.length,
    pendentes: contar("pendente") + contar("estudado"),
    dominados: contar("dominado"),
    assuntos: [...porAssunto.entries()].sort((a, b) => b[1] - a[1]).map(([assunto, quantos]) => ({ assunto, quantos })),
  };
}

/** O que a Mine recebe para estudar os erros: a questão, o que a pessoa marcou e o gabarito. */
export function contextoEstudo(erros) {
  return erros
    .map((erro, posicao) => {
      const q = erro.questao;
      const alternativas = q.options.map((opcao, indice) => `${letrasProva[indice]}) ${opcao}`).join("\n");
      const marcada = erro.marcada === null || erro.marcada === undefined ? "deixou em branco" : `${letrasProva[erro.marcada]}) ${q.options[erro.marcada]}`;
      return [
        `ERRO ${posicao + 1} (assunto: ${erro.assunto})`,
        `Pergunta: ${q.question}`,
        alternativas,
        `O estudante marcou: ${marcada}`,
        `Resposta certa: ${letrasProva[q.correct]}) ${q.options[q.correct]}`,
        q.explanation ? `Explicacao original: ${q.explanation}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

/**
 * Formato da task "prova-estudo", um bloco por erro:
 * ERRO: n / CONCEITO: / POR QUE: / AULA: / MACETE: / P: A) B) C) D) / CORRETA: / EXPLICACAO:
 * Um bloco só entra com aula de verdade e uma questão-irmã válida de 4
 * alternativas; sem a irmã não há como conferir se a pessoa aprendeu.
 */
export function lerEstudo(text) {
  const blocos = String(text || "")
    .split(/(?=^\s*ERRO:)/gim)
    .map((bloco) => bloco.trim())
    .filter((bloco) => /^ERRO:/i.test(bloco));
  const estudos = [];
  for (const bloco of blocos) {
    const campo = (rotulo) => texto(bloco.match(new RegExp(`^\\s*${rotulo}\\s*:\\s*(.+)$`, "im"))?.[1]);
    const numero = Number(bloco.match(/^ERRO:\s*(\d+)/i)?.[1]);
    const irma = parseQuiz(bloco.slice(Math.max(0, bloco.search(/^\s*P:/im))))[0];
    const aula = campo("AULA");
    if (!Number.isInteger(numero) || numero < 1 || aula.length < 20 || !irma || irma.options.length !== 4) continue;
    estudos.push({
      erro: numero,
      conceito: campo("CONCEITO") || "O ponto da questão",
      porque: campo("POR\\s*QUE"),
      aula,
      macete: campo("MACETE"),
      irma,
    });
  }
  // a Mine às vezes repete um número; vale o primeiro bloco de cada erro
  const vistos = new Set();
  return estudos.filter((item) => (vistos.has(item.erro) ? false : (vistos.add(item.erro), true)));
}

/**
 * Prova pronta para testar sem IA (demonstração e conta sem chave). Cada
 * questão traz o estudo já escrito, no mesmo formato que a Mine devolve.
 */
export const provaExemplo = {
  assunto: "Célula e organelas",
  questoes: [
    {
      question: "Qual organela é responsável pela respiração celular e pela produção da maior parte do ATP?",
      options: ["Ribossomo", "Mitocôndria", "Complexo golgiense", "Lisossomo"],
      correct: 1,
      explanation: "A mitocôndria realiza a respiração celular aeróbica, que gera a maior parte do ATP da célula.",
    },
    {
      question: "O que diferencia uma célula procariótica de uma eucariótica?",
      options: ["A procariótica não tem membrana plasmática", "A eucariótica não tem ribossomos", "A procariótica não tem núcleo delimitado por membrana", "A eucariótica não tem DNA"],
      correct: 2,
      explanation: "Na célula procariótica o DNA fica no citoplasma, sem um núcleo envolto por membrana (carioteca).",
    },
    {
      question: "Qual estrutura está presente na célula vegetal e ausente na célula animal?",
      options: ["Parede celular de celulose", "Membrana plasmática", "Mitocôndria", "Ribossomo"],
      correct: 0,
      explanation: "A parede celular de celulose dá sustentação à célula vegetal; a célula animal não tem.",
    },
    {
      question: "Os ribossomos participam de qual processo?",
      options: ["Digestão intracelular", "Síntese de proteínas", "Fotossíntese", "Armazenamento de lipídios"],
      correct: 1,
      explanation: "Os ribossomos leem o RNA mensageiro e unem aminoácidos, produzindo proteínas.",
    },
    {
      question: "Qual organela realiza a fotossíntese?",
      options: ["Vacúolo", "Centríolo", "Cloroplasto", "Peroxissomo"],
      correct: 2,
      explanation: "O cloroplasto tem clorofila e transforma luz, água e gás carbônico em glicose.",
    },
  ],
  estudos: `ERRO: 1
CONCEITO: Mitocôndria, a usina da célula
POR QUE: O ribossomo também "produz" algo, mas produz proteínas, não energia; por isso engana quem lembra só da palavra produção.
AULA: A mitocôndria quebra a glicose usando oxigênio na respiração celular aeróbica. Dessa quebra sai energia guardada em moléculas de ATP, que a célula usa para tudo: contrair músculo, transportar substâncias e se dividir.
MACETE: Mitocôndria = motor: as duas palavras começam com M e as duas dão energia.
P: Uma célula muscular, que gasta muita energia, deve ter grande quantidade de qual organela?
A) Lisossomos
B) Cloroplastos
C) Mitocôndrias
D) Vacúolos
CORRETA: C
EXPLICACAO: Quem gasta muito ATP precisa de muitas mitocôndrias, que produzem esse ATP.

ERRO: 2
CONCEITO: Núcleo organizado ou não
POR QUE: Todas as células têm membrana plasmática, ribossomos e DNA; a diferença está só em como o DNA é guardado.
AULA: Procarioto vem do grego "antes do núcleo": bactérias têm o DNA solto no citoplasma, numa região chamada nucleoide. Eucariotos (animais, plantas, fungos) guardam o DNA dentro de um núcleo envolvido pela carioteca.
MACETE: PROcarioto = PRimitivo, sem a "casa" do núcleo; EUcarioto = "EU tenho núcleo".
P: Uma bactéria é classificada como procarionte porque
A) não possui ribossomos
B) seu DNA não fica envolvido por uma carioteca
C) não possui material genético
D) não tem membrana plasmática
CORRETA: B
EXPLICACAO: A bactéria tem DNA, ribossomos e membrana; só não tem núcleo delimitado por membrana.

ERRO: 3
CONCEITO: Parede celular das plantas
POR QUE: Membrana plasmática, mitocôndria e ribossomo existem nas duas células, então não servem para diferenciar.
AULA: A célula vegetal tem, por fora da membrana plasmática, uma parede de celulose rígida que sustenta a planta e evita que a célula estoure ao absorver água. A célula animal não tem essa parede, por isso é mais flexível.
MACETE: Planta fica de pé sem esqueleto porque cada célula tem a sua "parede".
P: A rigidez do caule de uma árvore se deve principalmente
A) à parede celular de celulose das suas células
B) aos centríolos das células vegetais
C) à ausência de membrana plasmática
D) ao grande número de lisossomos
CORRETA: A
EXPLICACAO: A parede celular de celulose é rígida e dá sustentação à planta.

ERRO: 4
CONCEITO: Ribossomo fabrica proteína
POR QUE: Digestão é papel do lisossomo e fotossíntese do cloroplasto; misturar as funções das organelas é o erro mais comum.
AULA: O ribossomo é a fábrica de proteínas: ele lê a sequência do RNA mensageiro e vai encaixando aminoácidos na ordem certa. Ele fica solto no citoplasma ou grudado no retículo endoplasmático rugoso, que por isso tem aspecto "granuloso".
MACETE: O ribossomo monta proteína como quem enfia contas num colar: cada conta é um aminoácido.
P: O retículo endoplasmático rugoso recebe esse nome porque tem aderidos a ele
A) lisossomos
B) ribossomos, que fazem síntese de proteínas
C) cloroplastos
D) vacúolos de gordura
CORRETA: B
EXPLICACAO: Os ribossomos presos ao retículo dão o aspecto rugoso e produzem proteínas.

ERRO: 5
CONCEITO: Cloroplasto e fotossíntese
POR QUE: O vacúolo também é típico de planta, mas ele guarda água e substâncias; não produz alimento.
AULA: O cloroplasto tem clorofila, o pigmento verde que capta a luz do sol. Com essa energia ele junta gás carbônico e água para formar glicose e libera oxigênio — é a fotossíntese, que alimenta a planta.
MACETE: CLOROplasto tem CLOROfila: o nome já entrega o verde e a luz.
P: Uma célula da raiz de uma planta, que fica no escuro da terra, normalmente não tem
A) mitocôndrias
B) ribossomos
C) cloroplastos ativos
D) membrana plasmática
CORRETA: C
EXPLICACAO: Sem luz não há fotossíntese, então a raiz praticamente não tem cloroplastos ativos.`,
};
