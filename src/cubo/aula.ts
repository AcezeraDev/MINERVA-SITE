/**
 * Aula da Mine: o método de camadas (o "de iniciante") para o 3×3, em oito
 * passos. Cada passo traz a fala da Mine, dicas e um algoritmo escrito na
 * notação de quem está olhando o cubo (R é sempre a face da direita na tela).
 *
 * O treino de cada passo monta um caso de propósito: parte do cubo montado e
 * aplica o algoritmo ao contrário. Quem fizer o algoritmo certinho vê o cubo
 * voltar inteiro, e é assim que a aba sabe que o passo foi aprendido.
 */
export type PassoAula = {
  id: string;
  titulo: string;
  resumo: string;
  /** O que a Mine fala, parágrafo a parágrafo. */
  fala: string[];
  dicas: string[];
  /** Algoritmo do treino e da demonstração, em notação visual. Vazio = passo só de leitura. */
  algoritmo: string[];
  /** Quando o caso aparece com o amarelo para cima (do passo 3 em diante, o branco fica embaixo). */
  amareloEmCima: boolean;
  /** Frase pronta para perguntar à Mine sobre este passo. */
  pergunta: string;
};

export const passosAula: PassoAula[] = [
  {
    id: "notacao",
    titulo: "Conhecer o cubo",
    resumo: "Centros, peças e as letras dos giros.",
    fala: [
      "Primeiro, um segredo: os centros nunca saem do lugar. O centro branco sempre fica do lado oposto ao amarelo, o verde do azul, e o vermelho do laranja. Então a cor de uma face é a cor do centro dela.",
      "Cada letra é uma face, olhando o cubo de frente: R (direita), L (esquerda), U (cima), D (baixo), F (frente) e B (trás). A letra sozinha gira no sentido do relógio, como se você olhasse para aquela face. Com apóstrofo (R') gira ao contrário, e com 2 (R2) dá meia-volta.",
      "Aperte \"Ver no cubo\" para ver R U R' U' acontecendo devagar. Depois treine: o cubo fica bagunçado e você faz esses quatro giros para ele voltar.",
    ],
    dicas: ["Use o teclado: R, U, Shift+R, Shift+U.", "Ou arraste uma peça na direção em que a camada deve andar."],
    algoritmo: ["R", "U", "R'", "U'"],
    amareloEmCima: false,
    pergunta: "Como funciona a notação do cubo mágico (R, U, F, R', U2)? Me dá um exemplo simples.",
  },
  {
    id: "cruz",
    titulo: "Cruz branca",
    resumo: "As quatro arestas brancas em volta do centro branco.",
    fala: [
      "Agora vamos montar a cruz branca em cima. As arestas são as peças com duas cores. A gente quer as quatro arestas brancas encostadas no centro branco.",
      "Mas não basta o branco estar em cima: a outra cor da aresta tem que bater com o centro do lado. Aresta branco-verde fica entre o centro branco e o centro verde.",
      "Esse passo é mais de pensar do que de decorar. No treino, uma aresta caiu lá para baixo: gire a frente duas vezes (F2) para trazer de volta.",
    ],
    dicas: [
      "Se a aresta está na camada de baixo, gire o D até ela ficar embaixo do centro certo e faça F2 (ou R2, L2, B2).",
      "Se ela está do lado, uma volta só da face (F ou F') costuma resolver.",
    ],
    algoritmo: ["F2"],
    amareloEmCima: false,
    pergunta: "Me ensina a montar a cruz branca do cubo mágico 3x3, com dicas para arestas que estão na camada de baixo e do lado.",
  },
  {
    id: "cantos-brancos",
    titulo: "Cantos brancos",
    resumo: "Completar a face branca com R U R' U'.",
    fala: [
      "Com a cruz pronta, vire o cubo: branco embaixo, amarelo em cima. É assim que a gente segue até o fim.",
      "Ache um canto com branco na camada de cima. Gire o U até ele ficar bem em cima do lugar dele (na frente, à direita). Agora repita R U R' U' até o canto entrar certinho. Às vezes é uma vez, às vezes são cinco. Ele sempre entra.",
      "No treino o canto precisa de uma repetição só.",
    ],
    dicas: ["O lugar do canto é onde as três cores dele batem com os três centros.", "Se um canto está no lugar mas virado, faça R U R' U' até ele acertar."],
    algoritmo: ["R", "U", "R'", "U'"],
    amareloEmCima: true,
    pergunta: "Como colocar os cantos brancos do cubo mágico usando R U R' U'? Explica por que repetir funciona.",
  },
  {
    id: "segunda-camada",
    titulo: "Segunda camada",
    resumo: "Arestas do meio, pela direita ou pela esquerda.",
    fala: [
      "A primeira camada está pronta! Agora as arestas do meio, as que não têm amarelo.",
      "Ache uma aresta sem amarelo na camada de cima e gire o U até a cor da frente dela bater com o centro da frente (formando um T de cabeça para baixo). Se a cor de cima dela é a do centro da direita, ela vai para a direita: U R U' R' U' F' U F.",
      "Se é a do centro da esquerda, vai para a esquerda: U' L' U L U F U' F'. O treino é o da direita.",
    ],
    dicas: ["Aresta presa no meio, mas errada? Faça o algoritmo com qualquer aresta amarela para tirar ela de lá.", "Os dois algoritmos são espelhos um do outro."],
    algoritmo: ["U", "R", "U'", "R'", "U'", "F'", "U", "F"],
    amareloEmCima: true,
    pergunta: "Me explica a segunda camada do cubo mágico 3x3: quando usar U R U' R' U' F' U F e quando usar o da esquerda.",
  },
  {
    id: "cruz-amarela",
    titulo: "Cruz amarela",
    resumo: "F R U R' U' F' até aparecer a cruz.",
    fala: [
      "Agora o topo amarelo. Primeiro só a cruz, sem ligar para os lados.",
      "Olhe as arestas amarelas em cima. Se tem um ponto só, faça F R U R' U' F' uma vez e vira um L. Se é um L, segure ele na esquerda e atrás (como os ponteiros às 9h e 12h) e faça de novo. Se é uma linha, deixe ela deitada e faça de novo. Pronto: cruz!",
    ],
    dicas: ["Ponto → L → linha → cruz. Cada vez é o mesmo algoritmo.", "O meio do algoritmo é o R U R' U' que você já conhece."],
    algoritmo: ["F", "R", "U", "R'", "U'", "F'"],
    amareloEmCima: true,
    pergunta: "Como fazer a cruz amarela do cubo mágico com F R U R' U' F'? O que fazer com o ponto, o L e a linha?",
  },
  {
    id: "arestas-amarelas",
    titulo: "Arestas no lugar",
    resumo: "Fazer as arestas amarelas baterem com os centros.",
    fala: [
      "A cruz está lá, mas as cores dos lados das arestas talvez não batam com os centros.",
      "Gire o U até pelo menos duas arestas baterem. Se as duas certas estão lado a lado, segure uma atrás e a outra na direita e faça R U R' U R U2 R' U. Se estão uma em frente da outra, faça o algoritmo uma vez de qualquer jeito e tente de novo.",
    ],
    dicas: ["Sempre gire o U antes para ver quantas batem.", "Esse algoritmo troca a aresta da frente com a da esquerda."],
    algoritmo: ["R", "U", "R'", "U", "R", "U2", "R'", "U"],
    amareloEmCima: true,
    pergunta: "Me explica o passo das arestas amarelas no lugar com R U R' U R U2 R' U no cubo mágico.",
  },
  {
    id: "cantos-lugar",
    titulo: "Cantos no lugar",
    resumo: "Levar os cantos amarelos para as casas certas.",
    fala: [
      "Agora os cantos amarelos. Por enquanto não importa se estão virados, só se estão na casa certa (as três cores batem com os três centros em volta).",
      "Ache um canto que já está na casa certa e segure ele na frente, à direita. Faça U R U' L' U R' U' L. Os outros três dão uma volta. Se ainda não deu, faça de novo. Se nenhum está certo, faça uma vez com qualquer canto ali.",
    ],
    dicas: ["Olhe as cores do canto, não para onde o amarelo aponta.", "Duas vezes no máximo resolve."],
    algoritmo: ["U", "R", "U'", "L'", "U", "R'", "U'", "L"],
    amareloEmCima: true,
    pergunta: "Como colocar os cantos amarelos na posição certa com U R U' L' U R' U' L?",
  },
  {
    id: "cantos-virar",
    titulo: "Virar os cantos",
    resumo: "O último passo: R' D' R D até o amarelo subir.",
    fala: [
      "Último passo! Segure um canto que precisa virar na frente, à direita, em cima. Repita R' D' R D até o amarelo dele ficar para cima. No meio o cubo parece todo bagunçado. Calma, é assim mesmo!",
      "Depois gire só o U (não o cubo inteiro) para trazer o próximo canto errado para a frente-direita e repita. Quando o último virar, gire o U e... cubo montado!",
    ],
    dicas: ["Nunca vire o cubo inteiro no meio deste passo, só o U.", "Cada canto precisa de 2 ou 4 repetições."],
    algoritmo: ["R'", "D'", "R", "D", "R'", "D'", "R", "D"],
    amareloEmCima: true,
    pergunta: "Me explica o último passo do cubo mágico: virar os cantos amarelos com R' D' R D sem se perder.",
  },
];

/** "R'" → { face: "R", linha: -1 }; "U2" → { face: "U", linha: 2 }. */
export function lerToken(token: string) {
  const face = token[0] as "U" | "D" | "L" | "R" | "F" | "B";
  const linha: 1 | -1 | 2 = token.endsWith("2") ? 2 : token.endsWith("'") ? -1 : 1;
  return { face, linha };
}

/* ---------- a Mine acompanhando o treino ---------- */

const direcao: Record<string, string> = {
  R: "a face da direita para cima",
  "R'": "a face da direita para baixo",
  L: "a face da esquerda para baixo",
  "L'": "a face da esquerda para cima",
  U: "a face de cima para a esquerda",
  "U'": "a face de cima para a direita",
  D: "a face de baixo para a direita",
  "D'": "a face de baixo para a esquerda",
  F: "a face da frente no sentido do relógio",
  "F'": "a face da frente contra o relógio",
  B: "a face de trás (de onde você olha, ela anda contra o relógio)",
  "B'": "a face de trás (de onde você olha, ela anda no sentido do relógio)",
};

const nomeFace: Record<string, string> = { R: "da direita", L: "da esquerda", U: "de cima", D: "de baixo", F: "da frente", B: "de trás" };

/** "R'" → "gire a face da direita para baixo". */
export function explicarToken(token: string) {
  if (token.endsWith("2")) return `dê meia-volta na face ${nomeFace[token[0]]} (dois giros para o mesmo lado)`;
  return `gire ${direcao[token] ?? token}`;
}

/** Tecla que faz o giro: "R", "Shift+R" ou "R duas vezes". */
export function teclaDoToken(token: string) {
  const f = token[0];
  if (token.endsWith("2")) return `${f} duas vezes`;
  return token.endsWith("'") ? `Shift+${f}` : f;
}

const elogios = ["Isso!", "Boa!", "Mandou bem!", "Perfeito!", "Aí sim!", "Certinho!"];
export function elogio(i: number) {
  return elogios[i % elogios.length];
}

/** Instrução completa do próximo giro, como a Mine fala. */
export function instrucao(token: string) {
  return `${token}: ${explicarToken(token)} (tecla ${teclaDoToken(token)}). A camada brilhando é a que gira.`;
}
