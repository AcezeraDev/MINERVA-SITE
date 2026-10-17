/**
 * Balde de tinta.
 *
 * Decide a região olhando a folha como ela aparece (papel branco + pintura +
 * contorno), mas escreve só na camada de pintura. Assim a tinta para tanto
 * nas linhas do desenho quanto nos traços que a pessoa fez à mão.
 */

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const value = Number.parseInt(full, 16) || 0;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** A folha como se vê: branco, depois pintura, depois contorno. */
function composite(paint: Uint8ClampedArray, lines: Uint8ClampedArray | null, n: number) {
  const out = new Uint8Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    const p = i * 4;
    const pa = paint[p + 3] / 255;
    let r = 255 + (paint[p] - 255) * pa;
    let g = 255 + (paint[p + 1] - 255) * pa;
    let b = 255 + (paint[p + 2] - 255) * pa;
    if (lines) {
      const la = lines[p + 3] / 255;
      r += (lines[p] - r) * la;
      g += (lines[p + 1] - g) * la;
      b += (lines[p + 2] - b) * la;
    }
    out[i * 3] = r;
    out[i * 3 + 1] = g;
    out[i * 3 + 2] = b;
  }
  return out;
}

/**
 * Pinta a região em volta de (x, y). Devolve `false` quando não há o que
 * mudar (toque em cima do contorno, ou a área já tem essa cor).
 */
export function floodFill(
  paint: ImageData,
  lines: ImageData | null,
  x: number,
  y: number,
  rgb: [number, number, number],
  tolerance = 46,
) {
  const { width: w, height: h } = paint;
  const n = w * h;
  const seed = y * w + x;
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  if (lines && lines.data[seed * 4 + 3] > 150) return false;
  const view = composite(paint.data, lines ? lines.data : null, n);
  const tr = view[seed * 3];
  const tg = view[seed * 3 + 1];
  const tb = view[seed * 3 + 2];
  if (Math.abs(tr - rgb[0]) + Math.abs(tg - rgb[1]) + Math.abs(tb - rgb[2]) < 6 && paint.data[seed * 4 + 3] === 255) return false;

  const mask = new Uint8Array(n);
  const like = (i: number) =>
    !mask[i] && Math.abs(view[i * 3] - tr) + Math.abs(view[i * 3 + 1] - tg) + Math.abs(view[i * 3 + 2] - tb) <= tolerance;

  // Preenchimento por varredura de linhas: pilha pequena, sem recursão.
  const stack: number[] = [seed];
  while (stack.length) {
    const start = stack.pop() as number;
    if (!like(start)) continue;
    const row = Math.floor(start / w);
    let left = start;
    while (left % w > 0 && like(left - 1)) left -= 1;
    let upOpen = false;
    let downOpen = false;
    for (let i = left; i < row * w + w && like(i); i += 1) {
      mask[i] = 1;
      if (row > 0) {
        const up = like(i - w);
        if (up && !upOpen) stack.push(i - w);
        upOpen = up;
      }
      if (row < h - 1) {
        const down = like(i + w);
        if (down && !downOpen) stack.push(i + w);
        downOpen = down;
      }
    }
  }

  // A borda do contorno é antisserrilhada: sem avançar por baixo dela, fica
  // um fio branco entre a tinta e a linha. Avança 1 px em tudo e mais 2 px
  // por baixo do contorno (que fica por cima e esconde o excesso).
  for (let pass = 0; pass < 3; pass += 1) {
    const grow: number[] = [];
    for (let i = 0; i < n; i += 1) {
      if (mask[i]) continue;
      const col = i % w;
      const touches = (col > 0 && mask[i - 1] === 1) || (col < w - 1 && mask[i + 1] === 1) || (i >= w && mask[i - w] === 1) || (i < n - w && mask[i + w] === 1);
      if (!touches) continue;
      if (pass === 0 || (lines && lines.data[i * 4 + 3] > 0)) grow.push(i);
    }
    for (const i of grow) mask[i] = 1;
  }

  const data = paint.data;
  for (let i = 0; i < n; i += 1) {
    if (!mask[i]) continue;
    data[i * 4] = rgb[0];
    data[i * 4 + 1] = rgb[1];
    data[i * 4 + 2] = rgb[2];
    data[i * 4 + 3] = 255;
  }
  return true;
}
