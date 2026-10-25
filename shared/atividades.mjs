/**
 * Aba Atividades: tarefas no formato das plataformas da rede estadual
 * (aquecimento, treino para a prova e linha de chegada), geradas pela Mine.
 *
 * Tipos de questão:
 * - ordenar: o aluno monta a frase com as palavras embaralhadas;
 * - lacunas: um parágrafo com [1], [2]... e uma lista de opções em cada;
 * - vf: cartas de verdadeiro ou falso;
 * - multipla: alternativas A a E;
 * - ligar: duas colunas para ligar com uma linha;
 * - categorias: itens para arrastar até a caixa certa;
 * - sequencia: etapas ou acontecimentos para pôr em ordem (linha do tempo);
 * - numerica: conta com resposta em número;
 * - dissertativa: resposta escrita, corrigida pela Mine (task "atividade-correcao").
 *
 * Respostas guardadas (o que o aluno fez em cada tipo):
 * ordenar → posições originais das palavras escolhidas; lacunas → opção de
 * cada lacuna; vf → true/false por afirmação; multipla → alternativa;
 * ligar → para cada item da esquerda, o índice do par da direita;
 * categorias → caixa de cada item; sequencia → ordem dos índices originais;
 * numerica e dissertativa → texto.
 *
 * A Mine devolve JSON (task "atividade" em mine/prompts.mjs). `lerAtividade`
 * confere cada questão e descarta as quebradas; o servidor usa a mesma
 * função no controle de qualidade.
 */

import { extrairJson } from "./redacao.mjs";

export const pontosPorQuestao = 10;

export const secoes = [
  { id: "aquecimento", emoji: "🔥", titulo: "Aquecimento" },
  { id: "treino", emoji: "🏃", titulo: "Treinando para a Prova" },
  { id: "chegada", emoji: "🏁", titulo: "Linha de chegada" },
];

export const materias = [
  "Língua Portuguesa",
  "Matemática",
  "História",
  "Geografia",
  "Biologia",
  "Química",
  "Física",
  "Inglês",
  "Filosofia",
  "Sociologia",
  "Arte",
  "Educação Financeira",
];

export const series = ["6º ano", "7º ano", "8º ano", "9º ano", "1ª série EM", "2ª série EM", "3ª série EM"];

/** Assuntos sugeridos quando o aluno não escreve nenhum. */
export const assuntosSugeridos = {
  "Língua Portuguesa": ["Figuras de linguagem", "Colocação pronominal", "Gêneros textuais", "Modernismo brasileiro"],
  Matemática: ["Porcentagem", "Função do 1º grau", "Probabilidade", "Área e perímetro"],
  História: ["Revolução Industrial", "Era Vargas", "Brasil Colônia", "Guerra Fria"],
  Geografia: ["Urbanização", "Clima e vegetação do Brasil", "Globalização", "Matriz energética"],
  Biologia: ["Célula", "Ecologia", "Genética básica", "Sistema imunológico"],
  Química: ["Tabela periódica", "Ligações químicas", "Reações químicas", "Soluções"],
  Física: ["Velocidade média", "Leis de Newton", "Energia", "Eletricidade"],
  Inglês: ["Simple present", "Past tense", "Leitura de notícias", "False friends"],
  Filosofia: ["Ética", "Sócrates e Platão", "Iluminismo", "Liberdade"],
  Sociologia: ["Cidadania", "Desigualdade social", "Movimentos sociais", "Cultura"],
  Arte: ["Arte moderna", "Semana de 22", "Arte urbana", "Cores e composição"],
  "Educação Financeira": ["Orçamento pessoal", "Juros", "Consumo consciente", "Poupança"],
};

function frase(valor, limite = 1200) {
  return String(valor ?? "").replace(/[ \t]+/g, " ").trim().slice(0, limite);
}

function secaoValida(valor, fallback) {
  return secoes.some((item) => item.id === valor) ? valor : fallback;
}

/** Normaliza para comparar respostas: sem acento, caixa e espaços extras. */
export function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** "12,5", "R$ 1.200,00" e "1200.5" viram número. */
export function lerNumero(valor) {
  if (typeof valor === "number") return valor;
  let texto = String(valor ?? "").replace(/[^\d,.-]/g, "");
  if (texto.includes(",")) texto = texto.replace(/\./g, "").replace(",", ".");
  return texto && /\d/.test(texto) ? Number(texto) : NaN;
}

function lerQuestao(item, indice, total) {
  const tipo = String(item?.tipo || "").toLowerCase();
  const fallbackSecao = indice < 2 ? "aquecimento" : indice === total - 1 ? "chegada" : "treino";
  const base = {
    tipo,
    secao: secaoValida(item?.secao, fallbackSecao),
    enunciado: frase(item?.enunciado),
    textoBase: frase(item?.textoBase, 1600),
    fonte: frase(item?.fonte, 200),
  };
  if (!base.enunciado) return null;

  if (tipo === "ordenar") {
    const resposta = frase(item?.frase, 220);
    const palavras = resposta.split(" ").filter(Boolean);
    if (palavras.length < 4 || palavras.length > 18) return null;
    return { ...base, frase: resposta, palavras };
  }

  if (tipo === "lacunas") {
    const texto = frase(item?.texto, 900);
    const lacunas = (Array.isArray(item?.lacunas) ? item.lacunas : [])
      .map((lacuna) => {
        const opcoes = (Array.isArray(lacuna?.opcoes) ? lacuna.opcoes : []).map((opcao) => frase(opcao, 80)).filter(Boolean);
        const correta = Math.floor(Number(lacuna?.correta));
        return opcoes.length >= 2 && correta >= 0 && correta < opcoes.length ? { opcoes, correta } : null;
      });
    const marcadores = (texto.match(/\[\d+\]/g) || []).length;
    if (!lacunas.length || lacunas.includes(null) || marcadores !== lacunas.length) return null;
    return { ...base, texto, lacunas };
  }

  if (tipo === "multipla") {
    const alternativas = (Array.isArray(item?.alternativas) ? item.alternativas : [])
      .map((alt) => frase(alt, 400).replace(/^[A-Ea-e]\)\s*/, ""))
      .filter(Boolean);
    const correta = Math.floor(Number(item?.correta));
    if (alternativas.length < 4 || alternativas.length > 5 || !(correta >= 0 && correta < alternativas.length)) return null;
    if (new Set(alternativas.map(normalizar)).size !== alternativas.length) return null;
    return { ...base, alternativas, correta, explicacao: frase(item?.explicacao, 500) };
  }

  if (tipo === "vf") {
    const afirmacoes = (Array.isArray(item?.afirmacoes) ? item.afirmacoes : [])
      .map((afirmacao) => ({ texto: frase(afirmacao?.texto, 300), verdadeira: afirmacao?.verdadeira === true || afirmacao?.verdadeira === "true", explicacao: frase(afirmacao?.explicacao, 300) }))
      .filter((afirmacao) => afirmacao.texto);
    if (afirmacoes.length < 3 || afirmacoes.length > 6) return null;
    // tudo verdadeiro ou tudo falso vira chute fácil
    if (afirmacoes.every((afirmacao) => afirmacao.verdadeira) || afirmacoes.every((afirmacao) => !afirmacao.verdadeira)) return null;
    return { ...base, afirmacoes };
  }

  if (tipo === "ligar") {
    const pares = (Array.isArray(item?.pares) ? item.pares : [])
      .map((par) => ({ esquerda: frase(par?.esquerda, 120), direita: frase(par?.direita, 160) }))
      .filter((par) => par.esquerda && par.direita);
    if (pares.length < 3 || pares.length > 6) return null;
    if (new Set(pares.map((par) => normalizar(par.direita))).size !== pares.length) return null;
    return { ...base, pares };
  }

  if (tipo === "categorias") {
    const categorias = (Array.isArray(item?.categorias) ? item.categorias : []).map((nome) => frase(nome, 60)).filter(Boolean);
    if (categorias.length < 2 || categorias.length > 3) return null;
    const itens = (Array.isArray(item?.itens) ? item.itens : [])
      .map((entrada) => ({ texto: frase(entrada?.texto, 90), categoria: Math.floor(Number(entrada?.categoria)) }))
      .filter((entrada) => entrada.texto && entrada.categoria >= 0 && entrada.categoria < categorias.length);
    if (itens.length < 4 || itens.length > 8) return null;
    if (categorias.some((_, indice) => !itens.some((entrada) => entrada.categoria === indice))) return null;
    return { ...base, categorias, itens };
  }

  if (tipo === "sequencia") {
    const itens = (Array.isArray(item?.itens) ? item.itens : []).map((etapa) => frase(etapa, 160)).filter(Boolean);
    if (itens.length < 4 || itens.length > 6) return null;
    if (new Set(itens.map(normalizar)).size !== itens.length) return null;
    return { ...base, itens };
  }

  if (tipo === "numerica") {
    const resposta = lerNumero(item?.resposta);
    if (!Number.isFinite(resposta)) return null;
    const tolerancia = Math.abs(Number(item?.tolerancia) || 0);
    return { ...base, resposta, tolerancia, unidade: frase(item?.unidade, 20), explicacao: frase(item?.explicacao, 500) };
  }

  if (tipo === "dissertativa") {
    const esperado = frase(item?.esperado, 700);
    if (!esperado) return null;
    return { ...base, esperado, minimo: Math.max(1, Math.min(400, Math.floor(Number(item?.minimo) || 40))) };
  }

  return null;
}

/**
 * Lê a atividade da Mine. Devolve null quando sobram menos de 5 questões
 * boas ou quando não há uma dissertativa para a linha de chegada. Uma
 * questão quebrada é descartada sozinha, sem derrubar a atividade.
 */
export function lerAtividade(resposta) {
  const json = typeof resposta === "string" ? extrairJson(resposta) : resposta;
  if (!json || !Array.isArray(json.questoes)) return null;
  const brutas = json.questoes.slice(0, 9);
  const questoes = brutas.map((item, indice) => lerQuestao(item, indice, brutas.length)).filter(Boolean);
  if (questoes.length < 5) return null;
  if (!questoes.some((item) => item.tipo === "dissertativa")) return null;
  const ordem = Object.fromEntries(secoes.map((item, indice) => [item.id, indice]));
  questoes.sort((a, b) => ordem[a.secao] - ordem[b.secao]);
  return {
    titulo: frase(json.titulo, 140) || "Atividade da Mine",
    habilidade: frase(json.habilidade, 400),
    introducao: frase(json.introducao, 900),
    questoes,
  };
}

/** Embaralha as palavras de uma questão de ordenar sem nunca devolver a frase já pronta. */
export function embaralhar(palavras, semente = 1) {
  const lista = palavras.map((texto, indice) => ({ texto, indice }));
  let estado = Math.abs(Math.floor(semente)) % 2147483647 || 1;
  const sorteio = () => {
    estado = (estado * 48271) % 2147483647;
    return estado / 2147483647;
  };
  for (let tentativa = 0; tentativa < 5; tentativa += 1) {
    for (let i = lista.length - 1; i > 0; i -= 1) {
      const j = Math.floor(sorteio() * (i + 1));
      [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    if (lista.some((item, posicao) => item.indice !== posicao)) break;
  }
  return lista;
}

/**
 * Corrige uma questão objetiva (ordenar recebe as palavras, não as posições).
 * Devolve a fração de acerto (0 a 1); as questões com várias partes
 * (lacunas, vf, ligar, categorias, sequencia) valem parcial.
 */
export function corrigirObjetiva(questao, resposta) {
  if (!questao) return 0;
  if (questao.tipo === "ordenar") {
    const montada = Array.isArray(resposta) ? resposta.join(" ") : "";
    return normalizar(montada).replace(/[.,;!?]/g, "") === normalizar(questao.frase).replace(/[.,;!?]/g, "") ? 1 : 0;
  }
  if (questao.tipo === "lacunas") {
    const escolhas = Array.isArray(resposta) ? resposta : [];
    const certas = questao.lacunas.filter((lacuna, indice) => escolhas[indice] === lacuna.correta).length;
    return certas / questao.lacunas.length;
  }
  if (questao.tipo === "multipla") return resposta === questao.correta ? 1 : 0;
  const lista = Array.isArray(resposta) ? resposta : [];
  if (questao.tipo === "vf") return questao.afirmacoes.filter((afirmacao, indice) => lista[indice] === afirmacao.verdadeira).length / questao.afirmacoes.length;
  if (questao.tipo === "ligar") return questao.pares.filter((_, indice) => lista[indice] === indice).length / questao.pares.length;
  if (questao.tipo === "categorias") return questao.itens.filter((entrada, indice) => lista[indice] === entrada.categoria).length / questao.itens.length;
  if (questao.tipo === "sequencia") {
    if (lista.length !== questao.itens.length) return 0;
    return lista.filter((original, posicao) => original === posicao).length / questao.itens.length;
  }
  if (questao.tipo === "numerica") {
    const valor = lerNumero(resposta);
    if (!Number.isFinite(valor)) return 0;
    const folga = Math.max(questao.tolerancia, Math.abs(questao.resposta) * 1e-6, 1e-9);
    return Math.abs(valor - questao.resposta) <= folga ? 1 : 0;
  }
  return 0;
}

export function respondida(questao, resposta) {
  if (questao.tipo === "ordenar") return Array.isArray(resposta) && resposta.length === questao.palavras.length;
  if (questao.tipo === "lacunas") return Array.isArray(resposta) && questao.lacunas.every((_, indice) => Number.isInteger(resposta[indice]));
  if (questao.tipo === "multipla") return Number.isInteger(resposta);
  if (questao.tipo === "dissertativa") return String(resposta || "").trim().length >= questao.minimo;
  const lista = Array.isArray(resposta) ? resposta : [];
  if (questao.tipo === "vf") return questao.afirmacoes.every((_, indice) => typeof lista[indice] === "boolean");
  if (questao.tipo === "ligar") return questao.pares.every((_, indice) => Number.isInteger(lista[indice]));
  if (questao.tipo === "categorias") return questao.itens.every((_, indice) => Number.isInteger(lista[indice]));
  // a sequência sempre tem uma ordem; conta como respondida depois que o aluno mexe
  if (questao.tipo === "sequencia") return lista.length === questao.itens.length;
  if (questao.tipo === "numerica") return Number.isFinite(lerNumero(resposta));
  return false;
}

/** Correção da dissertativa: nota de 0 a 10, o que ficou bom e o que faltou. */
export function lerCorrecaoDissertativa(resposta) {
  const json = typeof resposta === "string" ? extrairJson(resposta) : resposta;
  if (!json) return null;
  const nota = Number(json.nota);
  if (!Number.isFinite(nota)) return null;
  const comentario = frase(json.comentario, 600);
  if (!comentario) return null;
  return {
    nota: Math.max(0, Math.min(10, Math.round(nota * 2) / 2)),
    comentario,
    faltou: frase(json.faltou, 500),
    respostaModelo: frase(json.respostaModelo, 800),
  };
}

/** Pontos da atividade inteira: cada questão vale 10. */
export function pontuar(questoes, respostas, correcoes = {}) {
  let pontos = 0;
  let acertos = 0;
  questoes.forEach((questao, indice) => {
    const fracao =
      questao.tipo === "dissertativa"
        ? (Number(correcoes[indice]?.nota) || 0) / 10
        : corrigirObjetiva(questao, respostas[indice]);
    pontos += fracao * pontosPorQuestao;
    if (fracao >= 0.6) acertos += 1;
  });
  return { pontos: Math.round(pontos * 10) / 10, maximo: questoes.length * pontosPorQuestao, acertos };
}

export function contextoAtividade({ materia, serie, assunto }) {
  return [
    `Componente: ${materia}`,
    `Ano/série: ${serie}`,
    `Assunto: ${assunto || `escolha um assunto importante de ${materia} para ${serie}`}`,
  ].join("\n");
}


/**
 * Atividades prontas, escritas pelo Minerva. Abrem na hora (sem IA), usam
 * todos os tipos de questão e seguram a aba quando a Mine está fora do ar.
 */
export const atividadesExemplo = [
  {
    materia: "Língua Portuguesa",
    serie: "1ª série EM",
    titulo: "Figuras de linguagem no dia a dia",
    habilidade: "Reconhecer figuras de linguagem (metáfora, hipérbole, ironia, personificação e eufemismo) e explicar o efeito de sentido que elas criam em textos variados.",
    introducao: "📝 A gente usa figuras de linguagem o tempo todo sem perceber: \"morri de rir\", \"o sol beijava a janela\", \"que dia lindo\" debaixo de chuva. Elas deixam o texto mais expressivo e mudam o jeito como o leitor sente a mensagem.",
    questoes: [
      {
        tipo: "ordenar",
        secao: "aquecimento",
        enunciado: "Ordene as palavras para formar a definição de metáfora.",
        frase: "A metáfora compara dois elementos sem usar o conectivo como.",
      },
      {
        tipo: "vf",
        secao: "aquecimento",
        enunciado: "Vire as cartas: cada afirmação é verdadeira ou falsa?",
        afirmacoes: [
          { texto: "Na metáfora, a comparação aparece sem o conectivo \"como\".", verdadeira: true, explicacao: "Com \"como\" ela vira comparação (ou símile)." },
          { texto: "Hipérbole é uma figura que suaviza uma ideia desagradável.", verdadeira: false, explicacao: "Hipérbole é exagero. Quem suaviza é o eufemismo." },
          { texto: "Em \"o sol sorriu para nós\" há personificação.", verdadeira: true, explicacao: "O sol ganhou uma ação humana: sorrir." },
          { texto: "Ironia é dizer exatamente o que se pensa, sem duplo sentido.", verdadeira: false, explicacao: "Ironia é dizer o contrário do que se quer dizer." },
        ],
      },
      {
        tipo: "ligar",
        secao: "treino",
        enunciado: "Ligue cada figura de linguagem à frase em que ela aparece.",
        pares: [
          { esquerda: "Metáfora", direita: "Meu irmão é uma enciclopédia ambulante." },
          { esquerda: "Hipérbole", direita: "Já te liguei um milhão de vezes!" },
          { esquerda: "Ironia", direita: "Que ótimo, a internet caiu bem na hora da prova." },
          { esquerda: "Personificação", direita: "O vento cantava na janela do quarto." },
          { esquerda: "Eufemismo", direita: "Ele partiu desta para uma melhor." },
        ],
      },
      {
        tipo: "multipla",
        secao: "treino",
        enunciado: "Que figura de linguagem está presente no trecho e que efeito ela produz?",
        textoBase: "\"A cidade acordou de mau humor: buzinas resmungavam e as calçadas, cansadas, empurravam as pessoas para o trabalho.\"",
        fonte: "Texto escrito para esta atividade.",
        alternativas: [
          "Hipérbole, porque exagera o tamanho da cidade para impressionar o leitor.",
          "Personificação, porque dá sentimentos humanos à cidade, às buzinas e às calçadas, deixando a cena mais viva.",
          "Ironia, porque elogia a cidade quando, na verdade, quer criticá-la.",
          "Comparação, porque usa o conectivo \"como\" para aproximar a cidade de uma pessoa.",
          "Eufemismo, porque suaviza um problema grave da cidade.",
        ],
        correta: 1,
        explicacao: "Cidade, buzinas e calçadas \"acordam\", \"resmungam\" e ficam \"cansadas\": ações e sentimentos humanos dados a seres inanimados são personificação.",
      },
      {
        tipo: "categorias",
        secao: "treino",
        enunciado: "Arraste cada frase para a caixa certa: linguagem literal ou figurada?",
        categorias: ["Linguagem literal", "Linguagem figurada"],
        itens: [
          { texto: "O ônibus atrasou dez minutos.", categoria: 0 },
          { texto: "Estou morrendo de fome.", categoria: 1 },
          { texto: "A loja abre às nove horas.", categoria: 0 },
          { texto: "Ela tem um coração de ouro.", categoria: 1 },
          { texto: "Chorei rios de lágrimas.", categoria: 1 },
          { texto: "Comprei dois cadernos novos.", categoria: 0 },
        ],
      },
      {
        tipo: "lacunas",
        secao: "treino",
        enunciado: "Leia o parágrafo e complete as lacunas com a figura de linguagem correta.",
        texto: "Em \"já falei isso um milhão de vezes\", o exagero caracteriza uma [1]. Em \"o vento cantava na janela\", o vento ganha ação humana, o que caracteriza uma [2]. Já em \"que beleza, perdi o ônibus de novo\", dizer o contrário do que se pensa caracteriza uma [3].",
        lacunas: [
          { opcoes: ["metáfora", "hipérbole", "ironia"], correta: 1 },
          { opcoes: ["personificação", "hipérbole", "comparação"], correta: 0 },
          { opcoes: ["metonímia", "personificação", "ironia"], correta: 2 },
        ],
      },
      {
        tipo: "dissertativa",
        secao: "chegada",
        enunciado: "Escolha uma figura de linguagem estudada nesta tarefa, explique com suas palavras o que ela é e crie uma frase sua usando essa figura.",
        esperado: "Nomeia uma figura (metáfora, hipérbole, ironia, personificação ou eufemismo), define corretamente o recurso e apresenta uma frase original em que a figura aparece de fato.",
        minimo: 40,
      },
    ],
  },
  {
    materia: "Matemática",
    serie: "9º ano",
    titulo: "Porcentagem no supermercado",
    habilidade: "Resolver problemas com porcentagem, incluindo aumentos e descontos sucessivos, em situações do cotidiano.",
    introducao: "📝 Liquidação, juros do cartão, nota da prova, bateria do celular: a porcentagem está em todo lugar. Saber calcular rápido é o que separa uma promoção de verdade de uma pegadinha.",
    questoes: [
      {
        tipo: "ordenar",
        secao: "aquecimento",
        enunciado: "Ordene as palavras para formar a definição de porcentagem.",
        frase: "Porcentagem é uma razão cujo denominador é igual a cem.",
      },
      {
        tipo: "vf",
        secao: "aquecimento",
        enunciado: "Verdadeiro ou falso? Pense antes de virar a carta.",
        afirmacoes: [
          { texto: "10% de 250 é 25.", verdadeira: true, explicacao: "250 ÷ 10 = 25." },
          { texto: "Dois descontos seguidos de 20% equivalem a um desconto de 40%.", verdadeira: false, explicacao: "Sobra 0,8 × 0,8 = 0,64 do preço: o desconto total é de 36%." },
          { texto: "50% de um valor é a metade dele.", verdadeira: true, explicacao: "50/100 = 1/2." },
          { texto: "Aumentar 10% e depois diminuir 10% volta ao valor inicial.", verdadeira: false, explicacao: "100 → 110 → 99: o segundo 10% é calculado sobre um valor maior." },
        ],
      },
      {
        tipo: "numerica",
        secao: "treino",
        enunciado: "Um tênis custa R$ 180,00 e está com 15% de desconto. Quanto você vai pagar?",
        resposta: 153,
        tolerancia: 0.01,
        unidade: "R$",
        explicacao: "15% de 180 = 27. Então 180 − 27 = 153 (ou 180 × 0,85 = 153).",
      },
      {
        tipo: "multipla",
        secao: "treino",
        enunciado: "Um celular de R$ 1.200,00 teve um aumento de 5%. Qual é o novo preço?",
        alternativas: ["R$ 1.205,00", "R$ 1.250,00", "R$ 1.260,00", "R$ 1.300,00", "R$ 1.320,00"],
        correta: 2,
        explicacao: "5% de 1.200 = 60. Novo preço: 1.200 + 60 = 1.260.",
      },
      {
        tipo: "categorias",
        secao: "treino",
        enunciado: "Arraste cada situação para a caixa certa: o valor final aumenta ou diminui?",
        categorias: ["Aumenta o valor", "Diminui o valor"],
        itens: [
          { texto: "Reajuste de 8% no aluguel", categoria: 0 },
          { texto: "Liquidação com 30% off", categoria: 1 },
          { texto: "Juros de 2% ao mês no cartão", categoria: 0 },
          { texto: "Cupom de 10% na primeira compra", categoria: 1 },
          { texto: "Taxa de entrega de 5%", categoria: 0 },
          { texto: "Cashback de 3% devolvido", categoria: 1 },
        ],
      },
      {
        tipo: "sequencia",
        secao: "treino",
        enunciado: "Arraste os passos para a ordem certa no cálculo de 12% de 350.",
        itens: [
          "Escrever 12% como a fração 12/100",
          "Multiplicar 350 por 12",
          "Chegar a 4.200",
          "Dividir 4.200 por 100",
          "Encontrar o resultado: 42",
        ],
      },
      {
        tipo: "numerica",
        secao: "treino",
        enunciado: "Numa turma de 40 alunos, 26 foram à excursão. Qual porcentagem da turma foi?",
        resposta: 65,
        tolerancia: 0.1,
        unidade: "%",
        explicacao: "26 ÷ 40 = 0,65, ou seja, 65%.",
      },
      {
        tipo: "dissertativa",
        secao: "chegada",
        enunciado: "Uma loja anuncia \"20% de desconto + mais 20% no caixa\" e diz que isso dá 40% de desconto. Explique por que o anúncio está errado e qual é o desconto real.",
        esperado: "Explica que o segundo desconto é calculado sobre o preço já reduzido (0,8 × 0,8 = 0,64), então o cliente paga 64% e o desconto real é de 36%, não 40%.",
        minimo: 60,
      },
    ],
  },
];
