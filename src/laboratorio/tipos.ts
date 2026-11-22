import type { Circuito, Lancamento, Plano } from "./simulacoes";

export type ExpId = "plano" | "circuito" | "ph" | "lancamento";

export type Valores = {
  plano: Plano;
  circuito: Circuito;
  ph: { acido: number; base: number };
  lancamento: Lancamento & { gid: string };
};

/** O que a bancada 3D precisa saber a cada mudança da tela. */
export type EstadoLab = {
  exp: ExpId;
  valores: Valores;
  /** Lançamento em andamento (performance.now() do disparo). */
  lance: { inicio: number } | null;
  /** Alvo do desafio do lançamento, em metros. */
  alvo: number | null;
  /** Sobe a cada desafio cumprido: a Mine comemora. */
  comemorar: number;
};

/** O que a bancada 3D pede de volta para a tela (arrastar, tocar, lançar). */
export type AcaoLab =
  | { tipo: "plano"; parcial: Partial<Valores["plano"]> }
  | { tipo: "circuito"; parcial: Partial<Valores["circuito"]> }
  | { tipo: "ph"; parcial: Partial<Valores["ph"]> }
  | { tipo: "lancamento"; parcial: Partial<Valores["lancamento"]> }
  | { tipo: "lancar" };
