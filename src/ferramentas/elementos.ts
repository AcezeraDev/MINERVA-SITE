/**
 * Dados da tabela periódica da aba Ferramentas.
 *
 * Nome e massa vêm de shared/quimica.mjs (a mesma tabela que a Mine usa nas
 * ferramentas do servidor), então os dois nunca discordam. Aqui só entra o
 * que é de desenho e de escola: posição na grade, família, estado físico a
 * 25 °C e a distribuição eletrônica pelo diagrama de Linus Pauling, que é a
 * forma cobrada no ensino médio e no ENEM.
 */
import { element } from "../../shared/quimica.mjs";

export type Categoria =
  | "hidrogenio"
  | "alcalino"
  | "alcalino-terroso"
  | "transicao"
  | "lantanideo"
  | "actinideo"
  | "outro-metal"
  | "semimetal"
  | "ametal"
  | "halogenio"
  | "gas-nobre";

export type Estado = "sólido" | "líquido" | "gasoso";

export type Elemento = {
  numero: number;
  simbolo: string;
  nome: string;
  massa: number;
  /** Linha e coluna na grade de 18 colunas (lantanídeos e actinídeos nas linhas 9 e 10). */
  linha: number;
  coluna: number;
  periodo: number;
  /** Grupo de 1 a 18; null para lantanídeos e actinídeos. */
  grupo: number | null;
  categoria: Categoria;
  estado: Estado;
};

export const CATEGORIAS: Array<{ id: Categoria; nome: string }> = [
  { id: "hidrogenio", nome: "Hidrogênio" },
  { id: "alcalino", nome: "Metais alcalinos" },
  { id: "alcalino-terroso", nome: "Alcalinoterrosos" },
  { id: "transicao", nome: "Metais de transição" },
  { id: "lantanideo", nome: "Lantanídeos" },
  { id: "actinideo", nome: "Actinídeos" },
  { id: "outro-metal", nome: "Outros metais" },
  { id: "semimetal", nome: "Semimetais" },
  { id: "ametal", nome: "Ametais" },
  { id: "halogenio", nome: "Halogênios" },
  { id: "gas-nobre", nome: "Gases nobres" },
];

const SEMIMETAIS = new Set([5, 14, 32, 33, 51, 52, 84]);
const AMETAIS = new Set([6, 7, 8, 15, 16, 34]);
const HALOGENIOS = new Set([9, 17, 35, 53, 85, 117]);
const GASES_NOBRES = new Set([2, 10, 18, 36, 54, 86, 118]);
const GASOSOS = new Set([1, 2, 7, 8, 9, 10, 17, 18, 36, 54, 86]);
const LIQUIDOS = new Set([35, 80]);

function posicao(z: number): { linha: number; coluna: number; periodo: number; grupo: number | null } {
  if (z === 1) return { linha: 1, coluna: 1, periodo: 1, grupo: 1 };
  if (z === 2) return { linha: 1, coluna: 18, periodo: 1, grupo: 18 };
  const bloco = (inicio: number, periodo: number) => {
    const i = z - inicio; // 0 ou 1 = grupos 1-2; o resto pula para 13-18
    const coluna = i < 2 ? i + 1 : i + 11;
    return { linha: periodo, coluna, periodo, grupo: coluna };
  };
  if (z <= 10) return bloco(3, 2);
  if (z <= 18) return bloco(11, 3);
  if (z <= 36) return { linha: 4, coluna: z - 18, periodo: 4, grupo: z - 18 };
  if (z <= 54) return { linha: 5, coluna: z - 36, periodo: 5, grupo: z - 36 };
  if (z <= 56) return { linha: 6, coluna: z - 54, periodo: 6, grupo: z - 54 };
  if (z <= 71) return { linha: 9, coluna: z - 54, periodo: 6, grupo: null };
  if (z <= 86) return { linha: 6, coluna: z - 68, periodo: 6, grupo: z - 68 };
  if (z <= 88) return { linha: 7, coluna: z - 86, periodo: 7, grupo: z - 86 };
  if (z <= 103) return { linha: 10, coluna: z - 86, periodo: 7, grupo: null };
  return { linha: 7, coluna: z - 100, periodo: 7, grupo: z - 100 };
}

function categoria(z: number, grupo: number | null): Categoria {
  if (z === 1) return "hidrogenio";
  if (z >= 57 && z <= 71) return "lantanideo";
  if (z >= 89 && z <= 103) return "actinideo";
  if (GASES_NOBRES.has(z)) return "gas-nobre";
  if (HALOGENIOS.has(z)) return "halogenio";
  if (SEMIMETAIS.has(z)) return "semimetal";
  if (AMETAIS.has(z)) return "ametal";
  if (grupo === 1) return "alcalino";
  if (grupo === 2) return "alcalino-terroso";
  if (grupo !== null && grupo >= 3 && grupo <= 12) return "transicao";
  return "outro-metal";
}

export const ELEMENTOS: Elemento[] = Array.from({ length: 118 }, (_, index) => {
  const numero = index + 1;
  const dados = element(numero)!;
  const pos = posicao(numero);
  return {
    numero,
    simbolo: dados.symbol,
    nome: dados.name,
    massa: dados.mass,
    ...pos,
    categoria: categoria(numero, pos.grupo),
    estado: GASOSOS.has(numero) ? "gasoso" : LIQUIDOS.has(numero) ? "líquido" : "sólido",
  };
});

/** Ordem dos subníveis no diagrama de Linus Pauling. */
const PAULING = ["1s", "2s", "2p", "3s", "3p", "4s", "3d", "4p", "5s", "4d", "5p", "6s", "4f", "5d", "6p", "7s", "5f", "6d", "7p"];
const CAPACIDADE: Record<string, number> = { s: 2, p: 6, d: 10, f: 14 };
const CAMADAS = ["K", "L", "M", "N", "O", "P", "Q"];

export type Distribuicao = {
  /** Subníveis na ordem de preenchimento: [["1s", 2], ["2s", 2], ...]. */
  subniveis: Array<[string, number]>;
  /** Elétrons por camada, de K até a última ocupada. */
  camadas: Array<[string, number]>;
  /** Camada de valência e quantos elétrons ela tem. */
  valencia: { camada: string; eletrons: number };
  /** Subnível mais energético (o último preenchido). */
  maisEnergetico: string;
};

/**
 * Distribuição pelo diagrama de Pauling, sem as exceções reais (Cr, Cu...),
 * como a escola ensina. A ficha do elemento avisa isso.
 */
export function distribuicao(z: number): Distribuicao {
  let resta = z;
  const subniveis: Array<[string, number]> = [];
  for (const sub of PAULING) {
    if (resta <= 0) break;
    const n = Math.min(resta, CAPACIDADE[sub[1]]);
    subniveis.push([sub, n]);
    resta -= n;
  }
  const porCamada = new Map<number, number>();
  for (const [sub, n] of subniveis) {
    const camada = Number(sub[0]);
    porCamada.set(camada, (porCamada.get(camada) || 0) + n);
  }
  const ultima = Math.max(...porCamada.keys());
  const camadas: Array<[string, number]> = [];
  for (let i = 1; i <= ultima; i += 1) camadas.push([CAMADAS[i - 1], porCamada.get(i) || 0]);
  const [subFinal, nFinal] = subniveis[subniveis.length - 1];
  return {
    subniveis,
    camadas,
    valencia: { camada: CAMADAS[ultima - 1], eletrons: porCamada.get(ultima) || 0 },
    maisEnergetico: `${subFinal}${sobrescrito(nFinal)}`,
  };
}

const DIGITOS_SOBRESCRITOS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export function sobrescrito(n: number) {
  return String(n).replace(/\d/g, (d) => DIGITOS_SOBRESCRITOS[Number(d)]);
}

export function textoDistribuicao(d: Distribuicao) {
  return d.subniveis.map(([sub, n]) => `${sub}${sobrescrito(n)}`).join(" ");
}

/** Onde o elemento aparece no dia a dia: só os mais cobrados e conhecidos. */
export const USOS: Record<string, string> = {
  H: "Combustível de foguetes e das células a hidrogênio; forma a água com o oxigênio.",
  He: "Enche balões e resfria os ímãs das máquinas de ressonância magnética.",
  Li: "Baterias de celular e de carro elétrico.",
  C: "Base de toda a química orgânica: está no grafite, no diamante e em todo ser vivo.",
  N: "78% do ar; vira fertilizante (amônia) e conserva alimentos em embalagens.",
  O: "21% do ar; essencial para a respiração e para a combustão.",
  F: "Está no flúor da pasta de dente (fluoreto) e no Teflon das panelas.",
  Ne: "Os letreiros luminosos vermelho-alaranjados de neon.",
  Na: "Forma o sal de cozinha (NaCl) e as lâmpadas amarelas de rua.",
  Mg: "Ligas leves para rodas e notebooks; está na clorofila das plantas.",
  Al: "Latinhas, papel-alumínio e estrutura de aviões; muito reciclado no Brasil.",
  Si: "Chips de computador, painéis solares e o vidro (como sílica).",
  P: "Fertilizantes, palito de fósforo e o DNA.",
  S: "Ácido sulfúrico da indústria, pólvora e vulcanização da borracha.",
  Cl: "Tratamento da água e de piscinas; forma o sal de cozinha com o sódio.",
  Ar: "Gás de lâmpadas incandescentes e da soldagem.",
  K: "Fertilizantes e o funcionamento dos nervos; a banana é rica em potássio.",
  Ca: "Ossos, dentes, cal e cimento.",
  Ti: "Próteses, piercings e peças de avião: leve e resistente.",
  Cr: "Cromagem de peças e o aço inoxidável.",
  Fe: "Aço da construção civil; está na hemoglobina do sangue.",
  Co: "Baterias de lítio e o ímã de alto-falantes; está na vitamina B12.",
  Ni: "Moedas, aço inox e baterias recarregáveis.",
  Cu: "Fios elétricos e encanamentos; com o zinco forma o latão.",
  Zn: "Galvanização (protege o ferro da ferrugem) e pilhas.",
  Br: "Um dos dois elementos líquidos à temperatura ambiente; usado em retardantes de chama.",
  Ag: "Joias, espelhos e contatos elétricos; é o melhor condutor de eletricidade.",
  Sn: "Solda de eletrônicos e a folha-de-flandres das latas de conserva.",
  I: "Sal iodado (previne o bócio) e antisséptico.",
  Xe: "Faróis de carro de luz branca forte e anestesia.",
  W: "Filamento das lâmpadas antigas: tem o maior ponto de fusão dos metais.",
  Pt: "Catalisador dos carros e joias.",
  Au: "Joias, reserva de valor e contatos de eletrônicos: não enferruja.",
  Hg: "Único metal líquido à temperatura ambiente; termômetros antigos. Tóxico.",
  Pb: "Baterias de carro e proteção contra raio X. Tóxico.",
  Rn: "Gás radioativo que pode se acumular em porões.",
  U: "Combustível das usinas nucleares, como Angra 1 e 2.",
  Pu: "Combustível nuclear e baterias de sondas espaciais.",
  Nb: "O Brasil tem a maior reserva do mundo; usado em aços especiais e ímãs supercondutores.",
};
