/**
 * Propostas prontas de redação (nov/2026), no formato das coletâneas da prova:
 * tema, textos motivadores (Texto I, II, III…), enunciado e gênero.
 *
 * Os textos são escritos pelo Minerva. Leis aparecem como "trecho adaptado"
 * (o sentido do artigo, não a redação oficial) e só as que existem de fato;
 * nenhuma estatística é inventada — tabelas trazem informação qualitativa ou
 * números que estão na própria lei. A primeira entrega de cada proposta vale
 * mais XP (shared/xp.mjs, redacaoPropostaXp).
 */

const ENUNCIADO = (tema) =>
  `A partir da leitura dos textos motivadores e com base nos conhecimentos construídos ao longo de sua formação, redija um texto dissertativo-argumentativo em modalidade escrita formal da língua portuguesa sobre o tema “${tema}”, apresentando proposta de intervenção que respeite os direitos humanos. Selecione, organize e relacione, de forma coerente e coesa, argumentos e fatos para a defesa de seu ponto de vista.`;

export const GENERO_ENEM = "Dissertação argumentativa · modelo ENEM";

export const propostasRedacao = [
  {
    id: "apostas-online",
    numero: 1,
    titulo: "Os impactos sociais da expansão das apostas on-line no Brasil",
    eixo: "Sociedade",
    cor: "#F97316",
    textos: [
      {
        tipo: "texto",
        corpo: [
          "As apostas esportivas de quota fixa, conhecidas como “bets”, saíram dos bastidores e entraram na rotina do torcedor: estampam camisas de clubes, aparecem nos intervalos dos jogos e chegam ao celular em forma de notificação com bônus de boas-vindas.",
          "Em dezembro de 2023, a Lei nº 14.790 passou a regulamentar esse mercado no país, exigindo autorização do governo federal para as empresas funcionarem e regras para a publicidade. O debate, porém, vai além da economia: envolve saúde, educação financeira e proteção de quem é mais vulnerável.",
        ],
        fonte: "Texto elaborado para o Minerva.",
      },
      {
        tipo: "tabela",
        titulo: "Sinais de alerta do jogo problemático",
        colunas: ["O que a pessoa faz", "Por que preocupa"],
        linhas: [
          ["Aposta para recuperar o que perdeu", "Cria um ciclo de perdas cada vez maiores"],
          ["Esconde os gastos da família", "Mostra perda de controle e gera conflitos"],
          ["Pede dinheiro emprestado para apostar", "Leva ao endividamento"],
          ["Fica irritada quando não consegue apostar", "Indica comportamento parecido com dependência"],
        ],
        fonte: "Elaborado para o Minerva com base em critérios usados por serviços de saúde mental.",
      },
      {
        tipo: "texto",
        corpo: [
          "Especialistas em saúde mental lembram que a aposta ativa o mesmo sistema de recompensa do cérebro envolvido em outros vícios. A diferença é o acesso: o “cassino” agora fica no bolso, aberto 24 horas, a um toque de distância — inclusive para adolescentes, que não deveriam apostar, e para famílias que comprometem o orçamento do mês.",
        ],
        fonte: "Texto elaborado para o Minerva.",
      },
    ],
    repertorio: [
      "Constituição de 1988: a saúde como direito de todos (art. 196).",
      "Conceito de sociedade de consumo e publicidade dirigida.",
      "Educação financeira como tema transversal na escola.",
    ],
  },
  {
    id: "cyberbullying",
    numero: 2,
    titulo: "Desafios para o combate ao cyberbullying entre os jovens brasileiros",
    eixo: "Tecnologia",
    cor: "#8B5CF6",
    textos: [
      {
        tipo: "lei",
        titulo: "Lei nº 13.185/2015 — Programa de Combate à Intimidação Sistemática (trecho adaptado)",
        corpo: [
          "Considera-se intimidação sistemática (bullying) todo ato de violência física ou psicológica, intencional e repetitivo, praticado por um indivíduo ou grupo contra uma ou mais pessoas, para intimidá-las ou agredi-las.",
          "Há intimidação sistemática na rede mundial de computadores (cyberbullying) quando se usam os instrumentos que lhe são próprios para depreciar, incitar a violência, adulterar fotos e dados pessoais com o intuito de criar meios de constrangimento psicossocial.",
        ],
        fonte: "BRASIL. Lei nº 13.185, de 6 de novembro de 2015. Adaptado.",
      },
      {
        tipo: "lista",
        titulo: "Como o cyberbullying costuma aparecer",
        itens: [
          "Perfis falsos criados para ridicularizar alguém",
          "Fotos ou vídeos compartilhados sem autorização",
          "Grupos de mensagens feitos para excluir um colega",
          "Comentários humilhantes repetidos em publicações",
          "Ameaças em mensagens privadas",
        ],
        fonte: "Elaborado para o Minerva.",
      },
      {
        tipo: "texto",
        corpo: [
          "Diferente da provocação no pátio, a agressão virtual não termina quando o sinal toca: ela acompanha a vítima até o quarto, alcança mais pessoas em minutos e pode ficar registrada por anos. Muitos jovens não contam o que sofrem por vergonha ou por medo de perder o celular.",
        ],
        fonte: "Texto elaborado para o Minerva.",
      },
    ],
    repertorio: [
      "Estatuto da Criança e do Adolescente (Lei nº 8.069/1990): proteção integral.",
      "Marco Civil da Internet (Lei nº 12.965/2014): direitos e deveres na rede.",
      "Ideia de empatia e responsabilidade digital na escola.",
    ],
  },
  {
    id: "celulares-infancia",
    numero: 3,
    titulo: "O uso excessivo de celulares por crianças e adolescentes",
    eixo: "Educação",
    cor: "#0EA5E9",
    textos: [
      {
        tipo: "lei",
        titulo: "Lei nº 15.100/2025 (trecho adaptado)",
        corpo: [
          "Fica proibido o uso, por estudantes, de aparelhos eletrônicos portáteis pessoais durante a aula, o recreio e os intervalos nas escolas de educação básica, salvo para fins pedagógicos, de acessibilidade, de saúde ou em situações de necessidade.",
        ],
        fonte: "BRASIL. Lei nº 15.100, de 13 de janeiro de 2025. Adaptado.",
      },
      {
        tipo: "tabela",
        titulo: "Tempo de tela em excesso: o que pode mudar",
        colunas: ["Área", "Efeito observado com frequência"],
        linhas: [
          ["Sono", "Dormir mais tarde e acordar cansado"],
          ["Atenção", "Dificuldade de manter o foco em tarefas longas"],
          ["Convivência", "Menos conversa e brincadeira presencial"],
          ["Corpo", "Mais tempo parado e postura ruim"],
        ],
        fonte: "Elaborado para o Minerva a partir de orientações de pediatras.",
      },
      {
        tipo: "texto",
        corpo: [
          "O celular também é ferramenta de pesquisa, de criação e de contato com a família. O desafio não é demonizar a tecnologia, mas ensinar a usá-la com limite — e isso inclui os adultos, que muitas vezes dão o exemplo contrário à mesa do jantar.",
        ],
        fonte: "Texto elaborado para o Minerva.",
      },
    ],
    repertorio: [
      "Conceito de economia da atenção.",
      "Estatuto da Criança e do Adolescente: dever de proteção da família, da sociedade e do Estado.",
      "Filme ou série sobre redes sociais que você conheça.",
    ],
  },
  {
    id: "desinformacao",
    numero: 4,
    titulo: "Caminhos para combater a desinformação nas redes sociais",
    eixo: "Cidadania",
    cor: "#EF4444",
    textos: [
      {
        tipo: "texto",
        corpo: [
          "Notícias falsas costumam viajar mais rápido que as verdadeiras porque provocam emoção forte: medo, raiva ou indignação. Quem compartilha nem sempre quer enganar — muitas vezes acredita estar alertando amigos e parentes.",
        ],
        fonte: "Texto elaborado para o Minerva.",
      },
      {
        tipo: "lista",
        titulo: "Antes de compartilhar, confira",
        itens: [
          "Quem publicou? A fonte existe e é confiável?",
          "A data é atual ou a notícia é antiga e foi requentada?",
          "Outros veículos sérios contam a mesma coisa?",
          "O título bate com o texto da notícia?",
          "A imagem foi tirada do contexto ou editada?",
        ],
        fonte: "Elaborado para o Minerva.",
      },
      {
        tipo: "lei",
        titulo: "Marco Civil da Internet — Lei nº 12.965/2014 (trecho adaptado)",
        corpo: [
          "O uso da internet no Brasil tem como fundamentos, entre outros, o respeito à liberdade de expressão, os direitos humanos, o exercício da cidadania em meios digitais e a finalidade social da rede.",
        ],
        fonte: "BRASIL. Lei nº 12.965, de 23 de abril de 2014. Adaptado.",
      },
    ],
    repertorio: [
      "Conceito de pós-verdade.",
      "Liberdade de expressão x responsabilidade (Constituição, art. 5º).",
      "Educação midiática nas escolas.",
    ],
  },
  {
    id: "pessoa-idosa",
    numero: 5,
    titulo: "Desafios para a valorização da pessoa idosa na sociedade brasileira",
    eixo: "Cidadania",
    cor: "#14B8A6",
    textos: [
      {
        tipo: "lei",
        titulo: "Estatuto da Pessoa Idosa — Lei nº 10.741/2003 (trecho adaptado)",
        corpo: [
          "É obrigação da família, da comunidade, da sociedade e do poder público assegurar à pessoa idosa, com absoluta prioridade, a efetivação do direito à vida, à saúde, à alimentação, à educação, à cultura, ao esporte, ao lazer, ao trabalho, à cidadania, à liberdade, à dignidade, ao respeito e à convivência familiar e comunitária.",
        ],
        fonte: "BRASIL. Lei nº 10.741, de 1º de outubro de 2003. Adaptado.",
      },
      {
        tipo: "tabela",
        titulo: "Barreiras do dia a dia",
        colunas: ["Situação", "O que dificulta"],
        linhas: [
          ["Banco e serviços públicos só por aplicativo", "Falta de familiaridade com a tecnologia"],
          ["Transporte e calçadas", "Degraus altos, buracos e pouco tempo para atravessar"],
          ["Mercado de trabalho", "Preconceito com a idade (etarismo)"],
          ["Convivência", "Solidão quando a família mora longe"],
        ],
        fonte: "Elaborado para o Minerva.",
      },
      {
        tipo: "texto",
        corpo: [
          "O Brasil está envelhecendo: a cada ano, há mais pessoas com mais de 60 anos e menos crianças. Uma sociedade que trata a velhice como problema desperdiça experiência, memória e afeto — e prepara um futuro ruim para todos, já que envelhecer é o destino de quem tem sorte.",
        ],
        fonte: "Texto elaborado para o Minerva.",
      },
    ],
    repertorio: [
      "Conceito de etarismo.",
      "Inclusão digital como direito.",
      "Convivência entre gerações (projetos intergeracionais).",
    ],
  },
  {
    id: "lixo-eletronico",
    numero: 6,
    titulo: "Desafios para o descarte correto do lixo eletrônico no Brasil",
    eixo: "Meio ambiente",
    cor: "#22C55E",
    textos: [
      {
        tipo: "lei",
        titulo: "Política Nacional de Resíduos Sólidos — Lei nº 12.305/2010 (trecho adaptado)",
        corpo: [
          "Fabricantes, importadores, distribuidores e comerciantes de pilhas, baterias e produtos eletroeletrônicos devem estruturar sistemas de logística reversa, recebendo os produtos após o uso pelo consumidor, de forma independente do serviço público de limpeza urbana.",
        ],
        fonte: "BRASIL. Lei nº 12.305, de 2 de agosto de 2010. Adaptado.",
      },
      {
        tipo: "lista",
        titulo: "O que um aparelho velho pode esconder",
        itens: [
          "Chumbo, em placas e soldas",
          "Mercúrio, em lâmpadas e telas antigas",
          "Cádmio, em algumas baterias",
          "Metais valiosos que poderiam ser reciclados, como cobre e ouro",
        ],
        fonte: "Elaborado para o Minerva.",
      },
      {
        tipo: "texto",
        corpo: [
          "Celulares parados na gaveta, carregadores quebrados e pilhas jogadas no lixo comum são parte de um problema que cresce junto com o consumo. Muita gente quer descartar certo, mas não sabe onde: pontos de coleta ainda são raros fora dos grandes centros.",
        ],
        fonte: "Texto elaborado para o Minerva.",
      },
    ],
    repertorio: [
      "Obsolescência programada.",
      "Princípio dos 3 Rs: reduzir, reutilizar, reciclar.",
      "Agenda 2030 da ONU (ODS 12: consumo e produção responsáveis).",
    ],
  },
  {
    id: "saude-mental",
    numero: 7,
    titulo: "Caminhos para cuidar da saúde mental dos jovens no Brasil",
    eixo: "Saúde",
    cor: "#EC4899",
    textos: [
      {
        tipo: "lei",
        titulo: "Constituição Federal de 1988, art. 196 (trecho adaptado)",
        corpo: [
          "A saúde é direito de todos e dever do Estado, garantido por políticas sociais e econômicas que visem à redução do risco de doença e ao acesso universal e igualitário às ações e serviços para sua promoção, proteção e recuperação.",
        ],
        fonte: "BRASIL. Constituição da República Federativa do Brasil de 1988. Adaptado.",
      },
      {
        tipo: "lista",
        titulo: "Sinais que merecem atenção",
        itens: [
          "Tristeza ou irritação que dura semanas",
          "Isolamento dos amigos e da família",
          "Mudanças fortes no sono ou no apetite",
          "Queda no rendimento e perda de interesse por tudo",
        ],
        fonte: "Elaborado para o Minerva.",
      },
      {
        tipo: "texto",
        corpo: [
          "Falar de ansiedade e depressão ainda é tabu em muitas casas e escolas. Enquanto isso, a pressão por resultados, a comparação constante nas redes e a incerteza sobre o futuro pesam sobre os estudantes. Pedir ajuda é um sinal de força — e a rede pública conta com serviços como os Centros de Atenção Psicossocial (CAPS).",
        ],
        fonte: "Texto elaborado para o Minerva.",
      },
    ],
    repertorio: [
      "Setembro Amarelo e a valorização da vida.",
      "Estigma em torno do sofrimento psíquico.",
      "Papel da escola como espaço de acolhimento.",
    ],
  },
  {
    id: "pcd-trabalho",
    numero: 8,
    titulo: "A inclusão das pessoas com deficiência no mercado de trabalho brasileiro",
    eixo: "Cidadania",
    cor: "#6366F1",
    textos: [
      {
        tipo: "tabela",
        titulo: "Lei nº 8.213/1991, art. 93 — a Lei de Cotas",
        colunas: ["Empresa com…", "Vagas para pessoas com deficiência ou reabilitadas"],
        linhas: [
          ["100 a 200 empregados", "2%"],
          ["201 a 500 empregados", "3%"],
          ["501 a 1.000 empregados", "4%"],
          ["mais de 1.000 empregados", "5%"],
        ],
        fonte: "BRASIL. Lei nº 8.213, de 24 de julho de 1991.",
      },
      {
        tipo: "lei",
        titulo: "Lei Brasileira de Inclusão — Lei nº 13.146/2015 (trecho adaptado)",
        corpo: [
          "A pessoa com deficiência tem direito ao trabalho de sua livre escolha e aceitação, em ambiente acessível e inclusivo, em igualdade de oportunidades com as demais pessoas.",
        ],
        fonte: "BRASIL. Lei nº 13.146, de 6 de julho de 2015. Adaptado.",
      },
      {
        tipo: "texto",
        corpo: [
          "Cumprir a cota não basta quando o prédio não tem rampa, o sistema não funciona com leitor de tela e a equipe nunca conversou sobre capacitismo. Incluir de verdade é adaptar o ambiente — e não esperar que a pessoa se adapte sozinha a um lugar pensado sem ela.",
        ],
        fonte: "Texto elaborado para o Minerva.",
      },
    ],
    repertorio: [
      "Conceito de capacitismo.",
      "Acessibilidade e desenho universal.",
      "Constituição: igualdade e dignidade da pessoa humana.",
    ],
  },
  {
    id: "desperdicio-alimentos",
    numero: 9,
    titulo: "O desafio de combater o desperdício de alimentos no Brasil",
    eixo: "Sociedade",
    cor: "#EAB308",
    textos: [
      {
        tipo: "texto",
        corpo: [
          "O Brasil é um dos maiores produtores de alimentos do mundo e, ao mesmo tempo, convive com famílias que não sabem se terão a próxima refeição. Parte do que é produzido se perde no caminho: na colheita, no transporte, nas prateleiras e na geladeira de casa.",
        ],
        fonte: "Texto elaborado para o Minerva.",
      },
      {
        tipo: "lei",
        titulo: "Lei nº 14.016/2020 (trecho adaptado)",
        corpo: [
          "Estabelecimentos que produzem ou fornecem alimentos ficam autorizados a doar os excedentes não vendidos, desde que estejam dentro do prazo de validade e em condições adequadas de consumo, para pessoas, famílias ou grupos em situação de vulnerabilidade.",
        ],
        fonte: "BRASIL. Lei nº 14.016, de 23 de junho de 2020. Adaptado.",
      },
      {
        tipo: "tabela",
        titulo: "Onde o alimento se perde",
        colunas: ["Etapa", "Exemplo de desperdício"],
        linhas: [
          ["Campo", "Frutas fora do padrão de tamanho deixadas na lavoura"],
          ["Transporte", "Estradas ruins e embalagens que amassam o produto"],
          ["Mercado", "Itens descartados perto do vencimento"],
          ["Casa", "Comida que estraga por compra em excesso"],
        ],
        fonte: "Elaborado para o Minerva.",
      },
    ],
    repertorio: [
      "Direito à alimentação (Constituição, art. 6º).",
      "Agenda 2030 da ONU (ODS 2: fome zero).",
      "Aproveitamento integral dos alimentos.",
    ],
  },
  {
    id: "formacao-leitores",
    numero: 10,
    titulo: "Caminhos para formar mais leitores no Brasil",
    eixo: "Educação",
    cor: "#A855F7",
    textos: [
      {
        tipo: "lei",
        titulo: "Constituição Federal de 1988, art. 205 (trecho adaptado)",
        corpo: [
          "A educação, direito de todos e dever do Estado e da família, será promovida e incentivada com a colaboração da sociedade, visando ao pleno desenvolvimento da pessoa, seu preparo para o exercício da cidadania e sua qualificação para o trabalho.",
        ],
        fonte: "BRASIL. Constituição da República Federativa do Brasil de 1988. Adaptado.",
      },
      {
        tipo: "texto",
        corpo: [
          "Muitos jovens dizem que não gostam de ler, mas passam horas lendo legendas, fanfics, roteiros de jogos e conversas. O problema talvez não seja a leitura em si, e sim o acesso a livros que façam sentido para eles e a falta de tempo, de bibliotecas abertas e de adultos leitores por perto.",
        ],
        fonte: "Texto elaborado para o Minerva.",
      },
      {
        tipo: "lista",
        titulo: "O que costuma aproximar alguém dos livros",
        itens: [
          "Escolher o que ler, e não só cumprir lista obrigatória",
          "Ver familiares e professores lendo",
          "Bibliotecas e salas de leitura abertas e acolhedoras",
          "Clubes de leitura e conversas sobre o livro",
        ],
        fonte: "Elaborado para o Minerva.",
      },
    ],
    repertorio: [
      "Leitura como direito e ferramenta de cidadania.",
      "Bibliotecas comunitárias.",
      "Um livro que marcou você e por quê.",
    ],
  },
].map((proposta) => ({ ...proposta, genero: GENERO_ENEM, enunciado: ENUNCIADO(proposta.titulo) }));

/** Texto dos motivadores para a correção da Mine (vai no contexto). */
export function apoioDaProposta(proposta) {
  return proposta.textos.map((texto, indice) => {
    const rotulo = `Texto ${["I", "II", "III", "IV", "V"][indice] || indice + 1}`;
    if (texto.tipo === "tabela") return `${rotulo} (${texto.titulo}): ${texto.linhas.map((linha) => linha.join(" — ")).join("; ")}`;
    if (texto.tipo === "lista") return `${rotulo} (${texto.titulo}): ${texto.itens.join("; ")}`;
    return `${rotulo}${texto.titulo ? ` (${texto.titulo})` : ""}: ${texto.corpo.join(" ")}`;
  });
}

/**
 * Proposta de intervenção completa tem 5 elementos (ENEM, competência 5).
 * Leitura por pistas no texto, só para o checklist da folha (a nota vem da Mine).
 */
export function elementosIntervencao(texto) {
  const valor = String(texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const ultimo = valor.split(/\n\s*\n/).filter((parte) => parte.trim()).pop() || "";
  return {
    agente: /\b(governo|estado|ministerio|escola|escolas|midia|familia|familias|ong|ongs|empresas?|prefeituras?|poder publico|sociedade civil|congresso|secretarias?)\b/.test(ultimo),
    acao: /\b(deve|devem|cabe|caberia|precisa|precisam|e necessario|e preciso|compete)\b/.test(ultimo),
    meio: /\b(por meio de|por intermedio de|atraves de|mediante|com o uso de|via)\b/.test(ultimo),
    finalidade: /\b(a fim de|para que|com o objetivo de|com a finalidade de|de modo a|visando)\b/.test(ultimo),
    detalhamento: /\b(como|ou seja|isto e|por exemplo|especialmente|sobretudo|tais como)\b/.test(ultimo) || /,\s*(que|o qual|a qual)\b/.test(ultimo),
  };
}
