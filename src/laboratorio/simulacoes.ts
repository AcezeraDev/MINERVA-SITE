/**
 * Física e química das simulações do Laboratório. Funções puras: a tela só
 * desenha o que sai daqui, e os números que aparecem nos quadros batem com o
 * que o desenho mostra.
 */

export const G_TERRA = 9.8;

export const gravidades = [
  { id: "terra", nome: "Terra", g: 9.8 },
  { id: "lua", nome: "Lua", g: 1.62 },
  { id: "marte", nome: "Marte", g: 3.71 },
  { id: "jupiter", nome: "Júpiter", g: 24.8 },
] as const;

/* ---------------- plano inclinado ---------------- */

export type Plano = { anguloGraus: number; massa: number; atrito: number };

export function plano({ anguloGraus, massa, atrito }: Plano) {
  const a = (anguloGraus * Math.PI) / 180;
  const peso = massa * G_TERRA;
  const px = peso * Math.sin(a);
  const normal = peso * Math.cos(a);
  const atritoMax = atrito * normal;
  const desliza = px > atritoMax + 1e-9;
  const resultante = desliza ? px - atritoMax : 0;
  return {
    peso,
    px,
    normal,
    atrito: desliza ? atritoMax : px,
    resultante,
    aceleracao: resultante / massa,
    desliza,
    anguloCritico: (Math.atan(atrito) * 180) / Math.PI,
  };
}

/* ---------------- circuito ---------------- */

export type Circuito = { tensao: number; r1: number; r2: number; ligacao: "serie" | "paralelo" };

export function circuito({ tensao, r1, r2, ligacao }: Circuito) {
  const req = ligacao === "serie" ? r1 + r2 : (r1 * r2) / (r1 + r2);
  const corrente = tensao / req;
  const i1 = ligacao === "serie" ? corrente : tensao / r1;
  const i2 = ligacao === "serie" ? corrente : tensao / r2;
  const v1 = i1 * r1;
  const v2 = i2 * r2;
  return { req, corrente, i1, i2, v1, v2, potencia: tensao * corrente, p1: v1 * i1, p2: v2 * i2 };
}

/* ---------------- titulação ácido-base ---------------- */

/** HCl e NaOH a 0,1 mol/L, ácido forte com base forte. Volumes em mL. */
export function ph(acidoMl: number, baseMl: number, conc = 0.1) {
  const total = (acidoMl + baseMl) / 1000;
  if (total <= 0) return 7;
  const h = (acidoMl / 1000) * conc;
  const oh = (baseMl / 1000) * conc;
  const sobra = h - oh;
  if (Math.abs(sobra) < 1e-12) return 7;
  if (sobra > 0) return Math.max(0, -Math.log10(sobra / total));
  return Math.min(14, 14 + Math.log10(-sobra / total));
}

/** Cor do indicador de repolho roxo em cada faixa de pH. */
export function corRepolho(valor: number) {
  const faixas: Array<[number, string, string]> = [
    [2, "#e0245e", "vermelho"],
    [4, "#f0508c", "rosa"],
    [6, "#b25bd6", "lilás"],
    [7.6, "#7b5bd6", "roxo"],
    [9, "#4a6fe0", "azul"],
    [11, "#1fb39a", "verde-azulado"],
    [12.5, "#2fbf4a", "verde"],
    [15, "#e6c229", "amarelo"],
  ];
  const faixa = faixas.find(([limite]) => valor < limite) || faixas[faixas.length - 1];
  return { cor: faixa[1], nome: faixa[2] };
}

export function classificaPh(valor: number) {
  if (valor < 6.5) return "ácida";
  if (valor > 7.5) return "básica";
  return "neutra";
}

/* ---------------- lançamento oblíquo ---------------- */

export type Lancamento = { velocidade: number; anguloGraus: number; g: number };

export function lancamento({ velocidade, anguloGraus, g }: Lancamento) {
  const a = (anguloGraus * Math.PI) / 180;
  const vx = velocidade * Math.cos(a);
  const vy = velocidade * Math.sin(a);
  const tempoVoo = (2 * vy) / g;
  return { vx, vy, tempoVoo, alcance: vx * tempoVoo, alturaMax: (vy * vy) / (2 * g) };
}

export function posicaoNoTempo({ velocidade, anguloGraus, g }: Lancamento, t: number) {
  const a = (anguloGraus * Math.PI) / 180;
  return { x: velocidade * Math.cos(a) * t, y: velocidade * Math.sin(a) * t - (g * t * t) / 2 };
}

export function fmt(valor: number, casas = 1) {
  if (!Number.isFinite(valor)) return "—";
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
