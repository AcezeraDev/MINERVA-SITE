/**
 * Canal entre a Mine (src/pets/engine.ts) e as cenas 3D do site.
 *
 * Fica num módulo minúsculo e sem dependências para as cenas não precisarem
 * baixar o motor da Mine: elas só leem a posição dela e ouvem os cutucões.
 * Sem a Mine ligada nada aqui se mexe (`minePos.vis` fica false).
 */

/** Onde a Mine está agora, em coordenadas da janela (pés no y). */
export const minePos = { x: 0, y: 0, vis: false };

export type Cutucao = { x: number; y: number; forca: number };
type Ouvinte = (c: Cutucao) => void;
const ouvintes = new Set<Ouvinte>();

/** A cena se inscreve para saber quando a Mine bate, pula ou chuta perto dela. */
export function aoCutucar(fn: Ouvinte) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

export function cutucar(c: Cutucao) {
  ouvintes.forEach((fn) => {
    try { fn(c); } catch { /* cena com defeito não derruba a Mine */ }
  });
}

/** Quantas cenas estão ouvindo (a Mine só procura 3D se alguém responde). */
export const ouvindo = () => ouvintes.size;

/** A Mine está a até `folga` px do retângulo? */
export function perto(r: DOMRect, folga = 0) {
  return minePos.vis && minePos.x > r.left - folga && minePos.x < r.right + folga && minePos.y > r.top - folga && minePos.y < r.bottom + folga + 90;
}
