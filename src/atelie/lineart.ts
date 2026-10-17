/**
 * Foto → folha de desenho, tudo no aparelho (roda num Web Worker).
 *
 * Dois estilos:
 * - "pintar": a foto vira um punhado de áreas chapadas (Kuwahara + k-means),
 *   e o contorno é a fronteira entre essas áreas. Por construção quase toda
 *   linha fecha uma região, que é o que o balde de tinta precisa.
 * - "esboco": XDoG, o traço de lápis clássico — bom para desenhar por cima.
 *
 * A saída é um RGBA com tinta escura e fundo transparente, do mesmo tamanho
 * da entrada: vira direto a camada de contorno da folha.
 */

export type LineStyle = "pintar" | "esboco";

export type LineArtOptions = {
  style: LineStyle;
  /** 0 = poucas áreas grandes; 1 = muitos detalhes. */
  detail: number;
  /** Espessura do contorno, 1 a 4. */
  thickness: number;
};

const INK: [number, number, number] = [30, 28, 40];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Gerador determinístico: a mesma foto com os mesmos ajustes dá o mesmo desenho. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Luminância de 0 a 1, com o contraste esticado entre os percentis 2 e 98. */
function luminance(src: Uint8ClampedArray, n: number) {
  const gray = new Float32Array(n);
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i += 1) {
    const v = 0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2];
    gray[i] = v;
    hist[Math.min(255, v | 0)] += 1;
  }
  let lo = 0;
  let hi = 255;
  let acc = 0;
  for (let v = 0; v < 256; v += 1) {
    acc += hist[v];
    if (acc >= n * 0.02) { lo = v; break; }
  }
  acc = 0;
  for (let v = 255; v >= 0; v -= 1) {
    acc += hist[v];
    if (acc >= n * 0.02) { hi = v; break; }
  }
  const span = Math.max(24, hi - lo);
  for (let i = 0; i < n; i += 1) gray[i] = Math.min(1, Math.max(0, (gray[i] - lo) / span));
  return gray;
}

/** Desfoque de caixa separável, uma passada em cada eixo. */
function boxBlur(src: Float32Array, w: number, h: number, r: number) {
  if (r < 1) return src.slice();
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const size = r * 2 + 1;
  for (let y = 0; y < h; y += 1) {
    const row = y * w;
    let sum = 0;
    for (let k = -r; k <= r; k += 1) sum += src[row + Math.min(w - 1, Math.max(0, k))];
    for (let x = 0; x < w; x += 1) {
      tmp[row + x] = sum / size;
      sum += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x += 1) {
    let sum = 0;
    for (let k = -r; k <= r; k += 1) sum += tmp[Math.min(h - 1, Math.max(0, k)) * w + x];
    for (let y = 0; y < h; y += 1) {
      out[y * w + x] = sum / size;
      sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/** Gaussiana aproximada por três caixas (Kovesi). */
function gauss(src: Float32Array, w: number, h: number, sigma: number) {
  const ideal = Math.sqrt((12 * sigma * sigma) / 3 + 1);
  let wl = Math.floor(ideal);
  if (wl % 2 === 0) wl -= 1;
  const wu = wl + 2;
  const m = Math.round((12 * sigma * sigma - 3 * wl * wl - 12 * wl - 9) / (-4 * wl - 4));
  let out = src;
  for (let i = 0; i < 3; i += 1) out = boxBlur(out, w, h, ((i < m ? wl : wu) - 1) / 2);
  return out;
}

/**
 * Kuwahara com tabelas de soma: cada pixel fica com a média do quadrante
 * mais uniforme ao redor. Achata texturas e mantém as bordas — a foto fica
 * com cara de pintura, que é o ponto de partida de uma folha de colorir.
 */
function kuwahara(rgb: Float32Array, w: number, h: number, r: number) {
  const W = w + 1;
  const size = W * (h + 1);
  const sR = new Float64Array(size);
  const sG = new Float64Array(size);
  const sB = new Float64Array(size);
  const sL = new Float64Array(size);
  const sL2 = new Float64Array(size);
  for (let y = 0; y < h; y += 1) {
    let aR = 0, aG = 0, aB = 0, aL = 0, aL2 = 0;
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 3;
      const l = 0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2];
      aR += rgb[i]; aG += rgb[i + 1]; aB += rgb[i + 2]; aL += l; aL2 += l * l;
      const o = (y + 1) * W + x + 1;
      const p = y * W + x + 1;
      sR[o] = sR[p] + aR; sG[o] = sG[p] + aG; sB[o] = sB[p] + aB; sL[o] = sL[p] + aL; sL2[o] = sL2[p] + aL2;
    }
  }
  const out = new Float32Array(w * h * 3);
  const box = (t: Float64Array, x0: number, y0: number, x1: number, y1: number) =>
    t[(y1 + 1) * W + x1 + 1] - t[y0 * W + x1 + 1] - t[(y1 + 1) * W + x0] + t[y0 * W + x0];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let best = Infinity;
      let bx0 = 0, by0 = 0, bx1 = 0, by1 = 0;
      for (let q = 0; q < 4; q += 1) {
        const x0 = q & 1 ? x : Math.max(0, x - r);
        const x1 = q & 1 ? Math.min(w - 1, x + r) : x;
        const y0 = q & 2 ? y : Math.max(0, y - r);
        const y1 = q & 2 ? Math.min(h - 1, y + r) : y;
        const n = (x1 - x0 + 1) * (y1 - y0 + 1);
        const mean = box(sL, x0, y0, x1, y1) / n;
        const variance = box(sL2, x0, y0, x1, y1) / n - mean * mean;
        if (variance < best) { best = variance; bx0 = x0; by0 = y0; bx1 = x1; by1 = y1; }
      }
      const n = (bx1 - bx0 + 1) * (by1 - by0 + 1);
      const o = (y * w + x) * 3;
      out[o] = box(sR, bx0, by0, bx1, by1) / n;
      out[o + 1] = box(sG, bx0, by0, bx1, by1) / n;
      out[o + 2] = box(sB, bx0, by0, bx1, by1) / n;
    }
  }
  return out;
}

/** k-means em cor (com a luz pesando mais), treinado numa amostra e aplicado a todos. */
function quantize(rgb: Float32Array, n: number, k: number) {
  const random = rng(n * 31 + k);
  const feature = (i: number, out: Float32Array, o: number) => {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    out[o] = (0.299 * r + 0.587 * g + 0.114 * b) * 1.6;
    out[o + 1] = (r - g) * 0.8;
    out[o + 2] = ((r + g) / 2 - b) * 0.8;
  };
  const sampleSize = Math.min(n, 9000);
  const sample = new Float32Array(sampleSize * 3);
  for (let s = 0; s < sampleSize; s += 1) feature(Math.floor(random() * n), sample, s * 3);

  // k-means++: cada centro novo nasce longe dos que já existem.
  const centers = new Float32Array(k * 3);
  const first = Math.floor(random() * sampleSize);
  centers.set(sample.subarray(first * 3, first * 3 + 3), 0);
  const dist = new Float32Array(sampleSize).fill(Infinity);
  for (let c = 1; c < k; c += 1) {
    let total = 0;
    for (let s = 0; s < sampleSize; s += 1) {
      const d0 = sample[s * 3] - centers[(c - 1) * 3];
      const d1 = sample[s * 3 + 1] - centers[(c - 1) * 3 + 1];
      const d2 = sample[s * 3 + 2] - centers[(c - 1) * 3 + 2];
      dist[s] = Math.min(dist[s], d0 * d0 + d1 * d1 + d2 * d2);
      total += dist[s];
    }
    let pick = random() * total;
    let chosen = 0;
    for (let s = 0; s < sampleSize; s += 1) {
      pick -= dist[s];
      if (pick <= 0) { chosen = s; break; }
    }
    centers.set(sample.subarray(chosen * 3, chosen * 3 + 3), c * 3);
  }

  const nearest = (f: Float32Array, o: number) => {
    let best = 0;
    let bestD = Infinity;
    for (let c = 0; c < k; c += 1) {
      const d0 = f[o] - centers[c * 3];
      const d1 = f[o + 1] - centers[c * 3 + 1];
      const d2 = f[o + 2] - centers[c * 3 + 2];
      const d = d0 * d0 + d1 * d1 + d2 * d2;
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  };

  const sums = new Float64Array(k * 4);
  for (let iter = 0; iter < 12; iter += 1) {
    sums.fill(0);
    for (let s = 0; s < sampleSize; s += 1) {
      const c = nearest(sample, s * 3);
      sums[c * 4] += sample[s * 3];
      sums[c * 4 + 1] += sample[s * 3 + 1];
      sums[c * 4 + 2] += sample[s * 3 + 2];
      sums[c * 4 + 3] += 1;
    }
    for (let c = 0; c < k; c += 1) {
      const count = sums[c * 4 + 3];
      if (!count) continue;
      centers[c * 3] = sums[c * 4] / count;
      centers[c * 3 + 1] = sums[c * 4 + 1] / count;
      centers[c * 3 + 2] = sums[c * 4 + 2] / count;
    }
  }

  const labels = new Uint8Array(n);
  const f = new Float32Array(3);
  for (let i = 0; i < n; i += 1) {
    feature(i, f, 0);
    labels[i] = nearest(f, 0);
  }
  return labels;
}

/** Filtro de maioria (3×3 com r = 1): some com o chuvisco e alisa as bordas. */
function majority(labels: Uint8Array, w: number, h: number, k: number, r = 1) {
  const out = new Uint8Array(labels.length);
  const count = new Uint8Array(k);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      count.fill(0);
      for (let dy = -r; dy <= r; dy += 1) {
        const yy = Math.min(h - 1, Math.max(0, y + dy));
        for (let dx = -r; dx <= r; dx += 1) {
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          count[labels[yy * w + xx]] += 1;
        }
      }
      const own = labels[y * w + x];
      let best = own;
      for (let c = 0; c < k; c += 1) if (count[c] > count[best]) best = c;
      out[y * w + x] = best;
    }
  }
  return out;
}

/** Regiões menores que `minArea` são engolidas pela vizinha mais presente. */
function mergeSmallRegions(labels: Uint8Array, w: number, h: number, k: number, minArea: number) {
  const n = w * h;
  const seen = new Uint8Array(n);
  const queue = new Int32Array(n);
  const near = new Uint32Array(k);
  for (let start = 0; start < n; start += 1) {
    if (seen[start]) continue;
    const label = labels[start];
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    seen[start] = 1;
    near.fill(0);
    while (head < tail) {
      const i = queue[head++];
      const x = i % w;
      const neighbors = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
      for (const j of neighbors) {
        if (j < 0 || j >= n) continue;
        if (labels[j] === label) {
          if (!seen[j]) { seen[j] = 1; queue[tail++] = j; }
        } else {
          near[labels[j]] += 1;
        }
      }
    }
    if (tail >= minArea) continue;
    let target = label;
    for (let c = 0; c < k; c += 1) if (c !== label && near[c] > (target === label ? 0 : near[target])) target = c;
    if (target === label) continue;
    for (let q = 0; q < tail; q += 1) labels[queue[q]] = target;
  }
}

/** Apaga pedacinhos de traço (componentes 8-conectados menores que `minSize`). */
function dropSpecks(mask: Uint8Array, w: number, h: number, minSize: number) {
  const n = w * h;
  const seen = new Uint8Array(n);
  const queue = new Int32Array(n);
  for (let start = 0; start < n; start += 1) {
    if (!mask[start] || seen[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    seen[start] = 1;
    while (head < tail) {
      const i = queue[head++];
      const x = i % w;
      const y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (mask[j] && !seen[j]) { seen[j] = 1; queue[tail++] = j; }
        }
      }
    }
    if (tail < minSize) for (let q = 0; q < tail; q += 1) mask[queue[q]] = 0;
  }
}

/** Engrossa a máscara com um disco de raio `r`. */
function dilate(mask: Uint8Array, w: number, h: number, r: number) {
  if (r <= 0) return mask;
  const out = new Uint8Array(mask.length);
  const offsets: Array<[number, number]> = [];
  for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy += 1) {
    for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx += 1) {
      if (dx * dx + dy * dy <= r * r + 0.5) offsets.push([dx, dy]);
    }
  }
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!mask[y * w + x]) continue;
      for (const [dx, dy] of offsets) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < w && yy >= 0 && yy < h) out[yy * w + xx] = 1;
      }
    }
  }
  return out;
}

function inkFromMask(mask: Uint8Array, w: number, h: number) {
  // Uma passada de desfoque leve vira antisserrilhado: a linha sai lisa.
  const soft = boxBlur(Float32Array.from(mask), w, h, 1);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    const a = Math.min(1, soft[i] * 1.7);
    out[i * 4] = INK[0];
    out[i * 4 + 1] = INK[1];
    out[i * 4 + 2] = INK[2];
    out[i * 4 + 3] = Math.round(a * 255);
  }
  return out;
}

function paintStyle(src: Uint8ClampedArray, w: number, h: number, opts: LineArtOptions) {
  const n = w * h;
  const detail = Math.min(1, Math.max(0, opts.detail));
  const rgb = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    rgb[i * 3] = src[i * 4];
    rgb[i * 3 + 1] = src[i * 4 + 1];
    rgb[i * 3 + 2] = src[i * 4 + 2];
  }
  const scale = Math.max(w, h) / 1000;
  const radius = Math.max(2, Math.round(lerp(6, 2, detail) * scale));
  let flat = kuwahara(rgb, w, h, radius);
  flat = kuwahara(flat, w, h, Math.max(2, radius - 1));

  const k = Math.round(lerp(5, 13, detail));
  let labels = quantize(flat, n, k);
  labels = majority(labels, w, h, k);
  labels = majority(labels, w, h, k);
  const minArea = Math.round(n * lerp(0.0018, 0.00025, detail));
  mergeSmallRegions(labels, w, h, k, minArea);
  mergeSmallRegions(labels, w, h, k, minArea);
  // Depois de juntar as regiões, uma maioria mais larga tira o serrilhado
  // que a textura da foto (pelo, folhas) deixa na fronteira.
  labels = majority(labels, w, h, k, Math.max(2, Math.round(2 * scale)));

  const edges = new Uint8Array(n);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      if ((x < w - 1 && labels[i] !== labels[i + 1]) || (y < h - 1 && labels[i] !== labels[i + w])) edges[i] = 1;
    }
  }

  // Com detalhe alto, os traços fortes da foto (olhos, dobras) entram também.
  if (detail > 0.45) {
    const gray = luminance(src, n);
    const sigma = lerp(2.2, 1.1, detail) * scale;
    const g1 = gauss(gray, w, h, sigma);
    const g2 = gauss(gray, w, h, sigma * 1.6);
    const limit = lerp(0.06, 0.035, (detail - 0.45) / 0.55);
    for (let i = 0; i < n; i += 1) if (g2[i] - g1[i] > limit) edges[i] = 1;
  }

  dropSpecks(edges, w, h, Math.round(lerp(40, 14, detail) * scale));
  const thick = dilate(edges, w, h, Math.max(0, opts.thickness - 1) * 0.9 * Math.max(1, scale));
  return inkFromMask(thick, w, h);
}

function sketchStyle(src: Uint8ClampedArray, w: number, h: number, opts: LineArtOptions) {
  const n = w * h;
  const detail = Math.min(1, Math.max(0, opts.detail));
  const scale = Math.max(w, h) / 1000;
  const gray = luminance(src, n);
  const sigma = lerp(2.4, 0.9, detail) * scale;
  const g1 = gauss(gray, w, h, sigma);
  const g2 = gauss(gray, w, h, sigma * 1.6);
  // Traço onde o ponto é mais escuro que a vizinhança (o "DoG" do XDoG), e
  // um cinza leve nas áreas bem escuras, como lápis deitado. Sem o
  // preenchimento chapado do XDoG clássico, que deixava a folha preta demais.
  const gain = lerp(18, 34, detail) * (0.7 + opts.thickness * 0.15);
  const shadeBase = gauss(gray, w, h, sigma * 3);
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i += 1) {
    // O piso tira o chuvisco que a textura do fundo deixaria.
    const edge = Math.max(0, g2[i] - g1[i] - 0.0045) * gain;
    const line = Math.pow(Math.min(1, edge), 0.8);
    const shade = Math.max(0, 0.42 - shadeBase[i]) * 0.55;
    const a = Math.min(1, line + shade);
    out[i * 4] = 52;
    out[i * 4 + 1] = 52;
    out[i * 4 + 2] = 64;
    out[i * 4 + 3] = Math.round(a * 255);
  }
  return out;
}

export function photoToLineArt(src: Uint8ClampedArray, w: number, h: number, opts: LineArtOptions) {
  return opts.style === "esboco" ? sketchStyle(src, w, h, opts) : paintStyle(src, w, h, opts);
}
