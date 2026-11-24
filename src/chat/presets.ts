import { useEffect, useState } from "react";

/*
 * Preenchimento que o chat da Mine deixa para uma aba ("cria um duelo sobre
 * isso" abre o Duelo já com o tema). Vive na memória e no sessionStorage, vale
 * por pouco tempo e é lido uma vez: quem entra na aba depois, sozinho, vê a
 * aba como sempre.
 *
 * A leitura não apaga na hora: o StrictMode chama o inicializador do useState
 * duas vezes, e apagar na primeira deixaria a segunda sem nada. A aba apaga
 * num efeito, depois de montar.
 */

export type PresetView = "duelo" | "atividades" | "redacao" | "leitura" | "videos";

type Guardado = { view: PresetView; dados: Record<string, string>; em: number };

const CHAVE = "minerva:chat-preset";
const VALIDADE_MS = 30_000;
let memoria: Guardado | null = null;

export function deixarPreset(view: PresetView, dados: Record<string, string>) {
  memoria = { view, dados, em: Date.now() };
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(memoria));
  } catch {
    // Sem sessionStorage (aba privada): a memória basta, a troca de aba não recarrega a página.
  }
}

function lerPreset(view: PresetView): Record<string, string> | null {
  let guardado = memoria;
  if (!guardado) {
    try {
      const bruto = sessionStorage.getItem(CHAVE);
      guardado = bruto ? (JSON.parse(bruto) as Guardado) : null;
    } catch {
      guardado = null;
    }
  }
  if (!guardado || guardado.view !== view || Date.now() - guardado.em > VALIDADE_MS) return null;
  return guardado.dados;
}

function apagarPreset(view: PresetView) {
  if (memoria?.view === view) memoria = null;
  try {
    const bruto = sessionStorage.getItem(CHAVE);
    if (bruto && (JSON.parse(bruto) as Guardado).view === view) sessionStorage.removeItem(CHAVE);
  } catch {
    // nada a apagar
  }
}

/** O que o chat deixou para esta aba, lido uma vez na montagem. */
export function usePreset(view: PresetView): Record<string, string> | null {
  const [dados] = useState(() => lerPreset(view));
  useEffect(() => {
    apagarPreset(view);
  }, [view]);
  return dados;
}
