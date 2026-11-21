/**
 * Ferramentas que a Mine chama sozinha (function calling), além da
 * pesquisa na web (mine/web.mjs).
 *
 * - Do aluno: agenda, conteúdos das matérias, caderno de erros, progresso e
 *   criar tarefa. Os dados vêm do navegador junto com o pedido (`aluno`,
 *   montado em src/chat/aluno.ts), já filtrados e com tamanho limitado: o
 *   servidor não lê o banco aqui.
 * - De conta e dados: calcular, resolver equação, química, questões reais do
 *   ENEM (api.enem.dev) e população do IBGE.
 *
 * Cada execução devolve texto JSON curto para o modelo. Erro vira texto
 * também ("erro": ...), para a Mine explicar em vez de inventar.
 */

import { CalcError, compile, solveEquation, tidyNumber } from "../shared/calc.mjs";
import { QuimicaError, balance, element, molarMass } from "../shared/quimica.mjs";

const fn = (name, description, properties = {}, required = []) => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});

export const STUDENT_TOOLS = [
  fn("ver_agenda", "Lista as tarefas e provas do PROPRIO estudante na Agenda do Minerva: atrasadas, de hoje e dos proximos dias. Use quando ele perguntar o que tem para fazer/estudar, quando e uma prova, o que esta atrasado ou para montar um plano com base na agenda dele.", {
    dias: { type: "integer", description: "Quantos dias para frente olhar (padrao 7, maximo 60)." },
    incluir_feitas: { type: "boolean", description: "Tambem listar as ja concluidas (padrao false)." },
  }),
  fn("buscar_meus_conteudos", "Procura nos conteudos que o PROPRIO estudante cadastrou nas materias dele (anotacoes, textos de PDF, resumos). Use quando ele falar do 'meu conteudo', 'o que eu salvei', 'minha anotacao de X' ou quando a resposta deve se basear no material dele.", {
    termo: { type: "string", description: "Palavras para procurar (assunto, titulo ou trecho)." },
    materia: { type: "string", description: "Opcional: nome da materia para limitar a busca." },
  }, ["termo"]),
  fn("meus_erros", "Questoes que o estudante errou nas provas da aba Provas (caderno de erros), com o assunto, a resposta que ele marcou e a certa. Use para 'no que eu mais erro', 'me ajuda nos meus erros', revisao personalizada.", {
    materia_ou_assunto: { type: "string", description: "Opcional: filtrar por materia ou assunto." },
  }),
  fn("meu_progresso", "XP, nivel, sequencia de dias estudando, conteudos estudados, tarefas feitas e notas das ultimas provas do estudante. Use para 'como estou indo', 'meu nivel', 'quanto XP eu tenho'."),
  fn("criar_tarefa", "Cria uma tarefa ou prova na Agenda do estudante. Use SO quando ele pedir para anotar/lembrar/agendar algo. Depois confirme em uma frase o que foi criado.", {
    titulo: { type: "string", description: "Titulo curto da tarefa, ex.: 'Prova de Fisica - cinematica'." },
    materia: { type: "string", description: "Nome da materia, se houver." },
    dias_ate_o_prazo: { type: "integer", description: "0 = hoje, 1 = amanha, etc. Calcule a partir da data de hoje." },
    observacao: { type: "string", description: "Detalhe opcional." },
  }, ["titulo"]),
];

export const KNOWLEDGE_TOOLS = [
  fn("calcular", "Calcula uma expressao matematica com precisao (nao faca conta de cabeca). Aceita + - * / ^, parenteses, %, fatorial (5!), sqrt, sin/cos/tan (radianos), sind/cosd/tand (graus), ln, log (base 10), pi, e, e variaveis com valores. Use para TODA conta numerica de exercicio, porcentagem, juros, fisica, estatistica.", {
    expressoes: { type: "array", items: { type: "string" }, description: "Uma ou mais expressoes, ex.: ['1500*(1+0.02)^12', '9.8*2.5^2/2']." },
    variaveis: { type: "object", description: "Valores das variaveis usadas, ex.: {\"m\": 2, \"v\": 3}.", additionalProperties: { type: "number" } },
  }, ["expressoes"]),
  fn("resolver_equacao", "Encontra as raizes reais de uma equacao de uma variavel (1o grau, 2o grau, exponencial, trigonometrica...). Use para conferir o resultado antes de responder.", {
    equacao: { type: "string", description: "Ex.: 'x^2 - 5x + 6 = 0' ou '2^x = 32'." },
    variavel: { type: "string", description: "Padrao x." },
    minimo: { type: "number", description: "Inicio do intervalo de busca (padrao -1000)." },
    maximo: { type: "number", description: "Fim do intervalo de busca (padrao 1000)." },
  }, ["equacao"]),
  fn("quimica", "Quimica exata: massa molar de uma formula, balanceamento de equacao quimica ou dados de um elemento da tabela periodica.", {
    acao: { type: "string", enum: ["massa_molar", "balancear", "elemento"] },
    entrada: { type: "string", description: "Formula (ex.: 'Ca(OH)2'), equacao (ex.: 'C3H8 + O2 -> CO2 + H2O') ou elemento (nome, simbolo ou numero atomico)." },
  }, ["acao", "entrada"]),
  fn("questoes_enem", "Busca questoes REAIS de provas anteriores do ENEM (2009 a 2023), com alternativas e gabarito oficial. Use quando o estudante pedir questoes do ENEM, exercicio de vestibular real ou simulado com questoes oficiais.", {
    disciplina: { type: "string", enum: ["matematica", "ciencias-natureza", "ciencias-humanas", "linguagens"] },
    tema: { type: "string", description: "Opcional: palavra-chave do assunto (ex.: 'porcentagem', 'fotossintese')." },
    ano: { type: "integer", description: "Opcional: ano da prova (2009 a 2023)." },
    quantidade: { type: "integer", description: "1 a 3 (padrao 1)." },
  }, ["disciplina"]),
  fn("dados_ibge", "Populacao oficial estimada pelo IBGE do Brasil, de um estado ou de um municipio, nos ultimos anos. Use para Geografia e para graficos com dados reais.", {
    local: { type: "string", description: "'Brasil', nome ou sigla do estado (ex.: 'SP') ou municipio (ex.: 'Maua')." },
    uf: { type: "string", description: "Sigla do estado do municipio, quando houver (ex.: 'SP')." },
    anos: { type: "integer", description: "Quantos anos de serie (1 a 10, padrao 5)." },
  }, ["local"]),
];

export const TOOL_LABELS = {
  ver_agenda: "Olhando sua agenda",
  buscar_meus_conteudos: "Procurando nos seus conteúdos",
  meus_erros: "Abrindo seu caderno de erros",
  meu_progresso: "Vendo seu progresso",
  criar_tarefa: "Anotando na sua agenda",
  calcular: "Fazendo as contas",
  resolver_equacao: "Resolvendo a equação",
  quimica: "Consultando a tabela periódica",
  questoes_enem: "Buscando questões do ENEM",
  dados_ibge: "Consultando o IBGE",
};

// ── dados do aluno ──────────────────────────────────────────────────────────

const text = (value, max = 400) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const list = (value, max) => (Array.isArray(value) ? value.slice(0, max) : []);

/** Confere e corta o que veio do navegador: nada de campo inesperado nem texto gigante. */
export function sanitizeAluno(raw) {
  if (!raw || typeof raw !== "object") return null;
  let budget = 60_000;
  const materias = list(raw.materias, 40).map((materia) => ({
    nome: text(materia?.nome, 80),
    conteudos: list(materia?.conteudos, 60).map((item) => {
      const corpo = String(item?.texto ?? "").slice(0, Math.max(0, Math.min(3000, budget)));
      budget -= corpo.length;
      return { titulo: text(item?.titulo, 160), texto: corpo, estudado: Boolean(item?.estudado) };
    }),
  }));
  return {
    hoje: text(raw.hoje, 10),
    tarefas: list(raw.tarefas, 80).map((item) => ({
      titulo: text(item?.titulo, 160),
      materia: text(item?.materia, 80),
      prazo: text(item?.prazo, 10),
      hora: text(item?.hora, 5),
      feita: Boolean(item?.feita),
      tipo: text(item?.tipo, 20),
    })),
    materias,
    erros: list(raw.erros, 40).map((item) => ({
      assunto: text(item?.assunto, 120),
      materia: text(item?.materia, 80),
      pergunta: text(item?.pergunta, 500),
      marcada: text(item?.marcada, 300),
      correta: text(item?.correta, 300),
      status: text(item?.status, 20),
      vezes: Number(item?.vezes) || 1,
    })),
    provas: list(raw.provas, 12).map((item) => ({ assunto: text(item?.assunto, 120), nota: Number(item?.nota) || 0, acertos: Number(item?.acertos) || 0, total: Number(item?.total) || 0, quando: text(item?.quando, 10) })),
    progresso: raw.progresso && typeof raw.progresso === "object"
      ? Object.fromEntries(Object.entries(raw.progresso).slice(0, 12).map(([key, value]) => [text(key, 30), typeof value === "number" ? value : text(value, 60)]))
      : {},
  };
}

function fold(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function dayDiff(fromIso, toIso) {
  const a = Date.parse(`${fromIso}T12:00:00Z`);
  const b = Date.parse(`${toIso}T12:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86_400_000) : null;
}

function verAgenda(aluno, args) {
  const dias = Math.min(60, Math.max(1, Number(args?.dias) || 7));
  const hoje = aluno.hoje;
  const linhas = aluno.tarefas
    .map((item) => ({ ...item, emDias: dayDiff(hoje, item.prazo) }))
    .filter((item) => item.emDias !== null && (args?.incluir_feitas || !item.feita) && item.emDias <= dias && (item.emDias >= -30 || !item.feita))
    .sort((a, b) => a.emDias - b.emDias);
  return {
    hoje,
    atrasadas: linhas.filter((item) => item.emDias < 0 && !item.feita),
    hoje_e_proximos: linhas.filter((item) => item.emDias >= 0),
    observacao: linhas.length ? undefined : "Nenhuma tarefa aberta nesse periodo.",
  };
}

function buscarConteudos(aluno, args) {
  const palavras = fold(args?.termo).split(/[^a-z0-9]+/).filter((word) => word.length > 2);
  const filtro = fold(args?.materia);
  const achados = [];
  for (const materia of aluno.materias) {
    if (filtro && !fold(materia.nome).includes(filtro)) continue;
    for (const item of materia.conteudos) {
      const titulo = fold(item.titulo);
      const corpo = fold(item.texto);
      let pontos = 0;
      let melhor = -1;
      for (const word of palavras) {
        if (titulo.includes(word)) pontos += 3;
        const at = corpo.indexOf(word);
        if (at >= 0) {
          pontos += 1 + Math.min(3, corpo.split(word).length - 2);
          if (melhor < 0) melhor = at;
        }
      }
      if (!palavras.length) pontos = 1;
      if (pontos > 0) {
        const inicio = Math.max(0, melhor - 250);
        achados.push({ materia: materia.nome, titulo: item.titulo, estudado: item.estudado, trecho: item.texto.slice(inicio, inicio + 900), pontos });
      }
    }
  }
  achados.sort((a, b) => b.pontos - a.pontos);
  return achados.length
    ? { encontrados: achados.slice(0, 5).map(({ pontos, ...rest }) => rest) }
    : { encontrados: [], observacao: "Nada nos conteudos do estudante bate com isso. Diga isso a ele e ofereca explicar com o seu conhecimento." };
}

function meusErros(aluno, args) {
  const filtro = fold(args?.materia_ou_assunto);
  const erros = aluno.erros.filter((item) => !filtro || fold(`${item.assunto} ${item.materia}`).includes(filtro));
  const porAssunto = {};
  for (const item of erros) porAssunto[item.assunto || "sem assunto"] = (porAssunto[item.assunto || "sem assunto"] || 0) + item.vezes;
  return {
    total: erros.length,
    assuntos_que_mais_erra: Object.entries(porAssunto).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([assunto, vezes]) => ({ assunto, vezes })),
    questoes: erros.slice(0, 10),
    observacao: erros.length ? undefined : "O caderno de erros esta vazio (ou nada bate com o filtro). Ele enche quando o estudante faz provas na aba Provas.",
  };
}

// ── conta e química ─────────────────────────────────────────────────────────

function calcular(args) {
  const expressoes = (Array.isArray(args?.expressoes) ? args.expressoes : [args?.expressoes ?? args?.expressao]).filter(Boolean).slice(0, 8);
  const variaveis = args?.variaveis && typeof args.variaveis === "object" ? args.variaveis : {};
  return {
    resultados: expressoes.map((expressao) => {
      try {
        return { expressao, resultado: tidyNumber(compile(String(expressao))(variaveis)) };
      } catch (error) {
        return { expressao, erro: error instanceof CalcError ? error.message : "nao consegui calcular" };
      }
    }),
  };
}

function resolver(args) {
  const variavel = text(args?.variavel || "x", 12) || "x";
  const min = Number.isFinite(Number(args?.minimo)) ? Number(args.minimo) : -1000;
  const max = Number.isFinite(Number(args?.maximo)) ? Number(args.maximo) : 1000;
  try {
    const raizes = solveEquation(String(args?.equacao || ""), variavel, { min, max });
    return { equacao: args?.equacao, variavel, intervalo: [min, max], raizes: raizes.map(tidyNumber), observacao: raizes.length ? undefined : "Nenhuma raiz real nesse intervalo." };
  } catch (error) {
    return { erro: error instanceof CalcError ? error.message : "nao consegui resolver" };
  }
}

function quimica(args) {
  try {
    if (args?.acao === "balancear") return balance(args.entrada);
    if (args?.acao === "elemento") {
      const item = element(args.entrada);
      return item ? { simbolo: item.symbol, nome: item.name, numeroAtomico: item.number, massaAtomica: item.mass } : { erro: "Elemento nao encontrado." };
    }
    return molarMass(args?.entrada);
  } catch (error) {
    return { erro: error instanceof QuimicaError ? error.message : "nao consegui" };
  }
}

// ── APIs públicas ───────────────────────────────────────────────────────────

async function getJson(url, signal, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener?.("abort", onAbort);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: "application/json", "user-agent": "Minerva-Escola/1.0" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", onAbort);
  }
}

// Ordem das áreas na prova do ENEM (as 5 primeiras questões de linguagens têm inglês e espanhol).
const ENEM_OFFSET = { linguagens: 0, "ciencias-humanas": 45, "ciencias-natureza": 90, matematica: 135 };

export async function questoesEnem(args, { signal, max = 3, imagens = false } = {}) {
  const disciplina = ENEM_OFFSET[args?.disciplina] !== undefined ? args.disciplina : "matematica";
  const quantidade = Math.min(max, Math.max(1, Number(args?.quantidade) || 1));
  const tema = fold(args?.tema).split(/[^a-z0-9]+/).filter((word) => word.length > 3);
  const anos = Number(args?.ano) >= 2009 && Number(args?.ano) <= 2023 ? [Number(args.ano)] : [2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016].sort(() => Math.random() - 0.5).slice(0, tema.length ? 4 : 1);
  const achadas = [];
  for (const ano of anos) {
    const offset = ENEM_OFFSET[disciplina] + (disciplina === "linguagens" ? 0 : 5);
    const data = await getJson(`https://api.enem.dev/v1/exams/${ano}/questions?limit=50&offset=${offset}`, signal).catch(() => null);
    const questoes = list(data?.questions, 50).filter((q) => q?.discipline === disciplina && (!q.language || q.language === "ingles" || disciplina !== "linguagens"));
    for (const q of questoes) {
      const corpo = fold(`${q.context || ""} ${q.alternativesIntroduction || ""}`);
      const pontos = tema.length ? tema.filter((word) => corpo.includes(word)).length : 1;
      // Questao com figura nao aparece no chat: fica para o fim da fila.
      const temFigura = String(q.context || "").includes("![") || list(q.files, 5).length > 0 || list(q.alternatives, 5).some((alt) => alt?.file);
      if (pontos > 0) achadas.push({ q, pontos: pontos + Math.random() * 0.5 - (temFigura && !imagens ? 2 : 0) });
    }
    if (achadas.length >= quantidade * 3) break;
  }
  achadas.sort((a, b) => b.pontos - a.pontos);
  const escolhidas = achadas.slice(0, quantidade).map(({ q }) => {
    // A aba Questões da matéria mostra as figuras (só https do próprio enem.dev).
    if (imagens) {
      const figuras = list(q.files, 5).filter((url) => typeof url === "string" && url.startsWith("https://"));
      const corpo = String(q.context || "").trim();
      return {
        titulo: q.title,
        ano: q.year,
        texto_base: corpo.slice(0, 4000) + (corpo.length > 4000 ? "…" : ""),
        figuras: figuras.filter((url) => !corpo.includes(url)),
        tem_imagem: false,
        comando: q.alternativesIntroduction,
        alternativas: list(q.alternatives, 5).map((alt) => ({ letra: alt.letter, texto: alt.text || "", imagem: typeof alt.file === "string" && alt.file.startsWith("https://") ? alt.file : "" })),
        gabarito: q.correctAlternative,
        fonte: `ENEM ${q.year}, ${q.title}`,
      };
    }
    const contexto = String(q.context || "").replace(/!\[[^\]]*\]\([^)]*\)/g, "[imagem na prova original]").trim();
    return {
      titulo: q.title,
      ano: q.year,
      texto_base: contexto.slice(0, 2200) + (contexto.length > 2200 ? "…" : ""),
      tem_imagem: /!\[/.test(String(q.context || "")) || list(q.files, 5).length > 0,
      comando: q.alternativesIntroduction,
      alternativas: list(q.alternatives, 5).map((alt) => `${alt.letter}) ${alt.text || (alt.file ? "[alternativa em imagem]" : "")}`),
      gabarito: q.correctAlternative,
      fonte: `ENEM ${q.year}, ${q.title}`,
    };
  });
  return escolhidas.length
    ? { questoes: escolhidas, observacao: "Questoes oficiais. Se tem_imagem for true, avise que a questao original tem figura. Nao revele o gabarito antes de o estudante tentar, a menos que ele peca." }
    : { questoes: [], observacao: "Nao encontrei questao com esse tema; tente sem tema ou outra disciplina." };
}

let estadosCache = null;
const municipiosCache = new Map();

async function estados(signal) {
  if (!estadosCache) estadosCache = await getJson("https://servicodados.ibge.gov.br/api/v1/localidades/estados", signal);
  return estadosCache;
}

async function dadosIbge(args, { signal }) {
  const local = text(args?.local, 80);
  const anos = Math.min(10, Math.max(1, Number(args?.anos) || 5));
  let codigo = "N1%5Ball%5D";
  let nome = "Brasil";
  if (fold(local) !== "brasil" && local) {
    const lista = await estados(signal);
    const estado = lista.find((item) => fold(item.sigla) === fold(local) || fold(item.nome) === fold(local));
    if (estado) {
      codigo = `N3%5B${estado.id}%5D`;
      nome = estado.nome;
    } else {
      const uf = lista.find((item) => fold(item.sigla) === fold(args?.uf) || fold(item.nome) === fold(args?.uf));
      const chave = uf ? uf.sigla : "todos";
      if (!municipiosCache.has(chave)) {
        municipiosCache.set(chave, await getJson(uf ? `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf.sigla}/municipios` : "https://servicodados.ibge.gov.br/api/v1/localidades/municipios", signal, 15000));
      }
      const municipios = municipiosCache.get(chave) || [];
      const candidatos = municipios.filter((item) => fold(item.nome) === fold(local));
      if (!candidatos.length) return { erro: `Nao achei "${local}" no IBGE. Confira o nome ou informe a UF.` };
      if (candidatos.length > 1 && !uf) return { erro: `Ha mais de um municipio chamado ${local}. Informe a UF.`, opcoes: candidatos.slice(0, 6).map((item) => item.microrregiao?.mesorregiao?.UF?.sigla) };
      codigo = `N6%5B${candidatos[0].id}%5D`;
      nome = `${candidatos[0].nome} (${candidatos[0].microrregiao?.mesorregiao?.UF?.sigla || uf?.sigla || ""})`;
    }
  }
  const data = await getJson(`https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-${anos}/variaveis/9324?localidades=${codigo}`, signal, 12000);
  const serie = data?.[0]?.resultados?.[0]?.series?.[0]?.serie || {};
  const pontos = Object.entries(serie)
    .filter(([, valor]) => /^\d+$/.test(String(valor)))
    .map(([ano, valor]) => ({ ano: Number(ano), populacao: Number(valor) }));
  return pontos.length
    ? { local: nome, indicador: "Populacao residente estimada (pessoas)", fonte: "IBGE, Estimativas da Populacao (tabela 6579)", serie: pontos, observacao: "Anos de censo podem nao ter estimativa." }
    : { erro: "O IBGE nao devolveu dados agora." };
}

// ── execução ────────────────────────────────────────────────────────────────

/**
 * Roda as chamadas de ferramenta do modelo. `ctx.aluno` é o retrato do
 * estudante (sanitizeAluno); `ctx.actions` recebe as ações para o navegador
 * aplicar (criar tarefa). Devolve [{ name, label, result }].
 */
export async function runTools(calls, ctx) {
  const results = [];
  for (const call of calls.slice(0, 6)) {
    const args = call.arguments || {};
    let result;
    try {
      const aluno = ctx.aluno;
      const needsAluno = STUDENT_TOOLS.some((tool) => tool.function.name === call.name);
      if (needsAluno && !aluno) result = { erro: "Os dados do estudante nao vieram neste pedido." };
      else if (call.name === "ver_agenda") result = verAgenda(aluno, args);
      else if (call.name === "buscar_meus_conteudos") result = buscarConteudos(aluno, args);
      else if (call.name === "meus_erros") result = meusErros(aluno, args);
      else if (call.name === "meu_progresso") result = { ...aluno.progresso, ultimas_provas: aluno.provas };
      else if (call.name === "criar_tarefa") {
        const titulo = text(args.titulo, 140);
        if (!titulo) result = { erro: "Sem titulo." };
        else {
          const dias = Math.max(0, Math.min(365, Math.round(Number(args.dias_ate_o_prazo) || 0)));
          const materia = text(args.materia, 80);
          const nota = text(args.observacao, 300);
          ctx.actions.push({ type: "create_task", title: titulo, ...(materia ? { subjectName: materia } : {}), ...(nota ? { note: nota } : {}), dueInDays: dias });
          result = { criada: true, titulo, prazo_em_dias: dias, observacao: "A tarefa aparece na Agenda assim que a resposta chegar." };
        }
      } else if (call.name === "calcular") result = calcular(args);
      else if (call.name === "resolver_equacao") result = resolver(args);
      else if (call.name === "quimica") result = quimica(args);
      else if (call.name === "questoes_enem") result = await questoesEnem(args, ctx);
      else if (call.name === "dados_ibge") result = await dadosIbge(args, ctx);
      else result = { erro: `Ferramenta desconhecida: ${call.name}` };
    } catch (error) {
      result = { erro: `A ferramenta falhou agora (${error?.message || "erro"}). Diga isso ao estudante sem inventar o resultado.` };
    }
    const json = JSON.stringify(result);
    results.push({ name: call.name, label: TOOL_LABELS[call.name] || call.name, args, result: json.length > 7000 ? `${json.slice(0, 7000)}…` : json });
  }
  return results;
}

/** Bloco de sistema com os resultados, para a próxima rodada do modelo. */
export function toolResultsInstruction(results) {
  return `RESULTADOS DAS FERRAMENTAS (dados reais, calculados ou consultados agora)
Use estes resultados na resposta, sem contradizer e sem inventar alem deles. Nao mencione nomes de ferramentas nem JSON; fale com naturalidade ("olhei sua agenda", "fiz a conta"). Se um resultado tiver "erro", explique o problema ao estudante.
${results.map((item) => `- ${item.name}(${JSON.stringify(item.args).slice(0, 300)}) => ${item.result}`).join("\n")}`;
}
