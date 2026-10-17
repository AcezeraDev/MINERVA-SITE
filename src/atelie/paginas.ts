/**
 * Folhas de colorir desenhadas pela Mine.
 *
 * Cada página desenha num espaço de 200 × 260 (proporção de folha) e quem
 * chama escala para o tamanho real. As formas são fechadas de propósito:
 * o balde de tinta para nas linhas, então área aberta vazaria a cor.
 */

export const PAGE_W = 200;
export const PAGE_H = 260;

export type MinePage = {
  id: string;
  title: string;
  /** `seed` só importa para páginas que mudam a cada vez (a mandala). */
  draw: (ctx: CanvasRenderingContext2D, seed: number) => void;
  varies?: boolean;
};

const INK = "#1e1c28";

function shape(ctx: CanvasRenderingContext2D, build: () => void, fill?: string) {
  ctx.beginPath();
  build();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.stroke();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill?: string) {
  shape(ctx, () => ctx.arc(x, y, r, 0, Math.PI * 2), fill);
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0, fill?: string) {
  shape(ctx, () => ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2), fill);
}

function path(ctx: CanvasRenderingContext2D, d: string, fill?: string) {
  const p = new Path2D(d);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill(p);
  }
  ctx.stroke(p);
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, points = 5) {
  shape(ctx, () => {
    for (let i = 0; i < points * 2; i += 1) {
      const radius = i % 2 ? r * 0.45 : r;
      const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(a) * radius;
      const py = y + Math.sin(a) * radius;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
  });
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  shape(ctx, () => {
    ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.3, y, x - s * 0.7, y - s * 0.95, x, y - s * 0.3);
    ctx.bezierCurveTo(x + s * 0.7, y - s * 0.95, x + s * 1.3, y, x, y + s * 0.9);
    ctx.closePath();
  });
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  path(ctx, "M-20 6 Q-26 -6 -14 -8 Q-12 -20 2 -16 Q10 -26 20 -14 Q30 -12 26 0 Q30 8 20 10 L-14 10 Q-22 10 -20 6 Z");
  ctx.restore();
}

/* ─────────────────────────────── páginas ─────────────────────────────── */

const coruja: MinePage = {
  id: "coruja",
  title: "Coruja da Minerva",
  draw(ctx) {
    // Lua e estrelas
    path(ctx, "M168 22 A20 20 0 1 0 184 56 A16 16 0 1 1 168 22 Z");
    star(ctx, 28, 30, 8);
    star(ctx, 58, 18, 5);
    star(ctx, 140, 44, 5);
    // Galho
    path(ctx, "M4 214 Q100 200 196 206 L196 218 Q100 214 4 228 Z");
    ellipse(ctx, 30, 206, 10, 5, -0.5);
    ellipse(ctx, 170, 201, 10, 5, 0.45);
    // Corpo
    ellipse(ctx, 100, 145, 56, 66);
    // Asas
    path(ctx, "M58 122 Q42 160 68 192 Q76 158 58 122 Z");
    path(ctx, "M142 122 Q158 160 132 192 Q124 158 142 122 Z");
    // Barriga com penas
    ellipse(ctx, 100, 176, 32, 30);
    for (let row = 0; row < 3; row += 1) {
      const y = 162 + row * 12;
      const span = row === 1 ? 4 : 3;
      for (let i = 0; i < span; i += 1) {
        const x = 100 + (i - (span - 1) / 2) * 14;
        shape(ctx, () => ctx.arc(x, y, 6, 0.15 * Math.PI, 0.85 * Math.PI));
      }
    }
    // Rosto
    circle(ctx, 78, 118, 21);
    circle(ctx, 122, 118, 21);
    circle(ctx, 78, 118, 11);
    circle(ctx, 122, 118, 11);
    circle(ctx, 80, 120, 5, INK);
    circle(ctx, 124, 120, 5, INK);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(78, 117, 1.8, 0, Math.PI * 2);
    ctx.arc(122, 117, 1.8, 0, Math.PI * 2);
    ctx.fill();
    path(ctx, "M92 134 L108 134 L100 149 Z");
    // Capelo
    path(ctx, "M84 82 L84 92 Q100 99 116 92 L116 82 Z");
    path(ctx, "M66 76 L100 62 L134 76 L100 90 Z");
    path(ctx, "M100 76 L130 80 L130 96");
    circle(ctx, 130, 99, 3.5);
    // Pés
    for (const x of [86, 114]) {
      ellipse(ctx, x - 6, 208, 4, 6);
      ellipse(ctx, x, 209, 4, 6);
      ellipse(ctx, x + 6, 208, 4, 6);
    }
  },
};

const mine: MinePage = {
  id: "mine",
  title: "A Mine estudando",
  draw(ctx) {
    star(ctx, 26, 34, 9);
    star(ctx, 176, 30, 7);
    heart(ctx, 172, 120, 9);
    heart(ctx, 26, 132, 7);
    // Antena
    path(ctx, "M100 40 L100 58");
    circle(ctx, 100, 34, 8);
    // Orelhas e cabeça (o rosto da Mine, ampliado)
    shape(ctx, () => ctx.roundRect(36, 92, 16, 38, 7));
    shape(ctx, () => ctx.roundRect(148, 92, 16, 38, 7));
    shape(ctx, () => ctx.roundRect(48, 58, 104, 100, 32));
    shape(ctx, () => ctx.roundRect(62, 78, 76, 56, 20));
    ellipse(ctx, 83, 102, 6.5, 8.5, 0, INK);
    ellipse(ctx, 117, 102, 6.5, 8.5, 0, INK);
    path(ctx, "M90 119 Q100 128 110 119");
    // Bochechas
    ellipse(ctx, 70, 140, 8, 5);
    ellipse(ctx, 130, 140, 8, 5);
    // Corpo e braços
    // O corpo e os braços terminam onde o livro começa: linha passando por
    // trás do livro viraria um monte de áreas sem sentido para pintar.
    path(ctx, "M66 192 L66 178 Q66 160 84 160 L116 160 Q134 160 134 178 L134 192");
    shape(ctx, () => ctx.roundRect(38, 166, 18, 28, 9));
    shape(ctx, () => ctx.roundRect(144, 166, 18, 28, 9));
    // Livro aberto
    path(ctx, "M52 196 Q76 186 100 196 Q124 186 148 196 L148 228 Q124 218 100 228 Q76 218 52 228 Z");
    path(ctx, "M100 196 L100 228");
    for (let i = 0; i < 3; i += 1) {
      path(ctx, `M62 ${204 + i * 7} Q76 ${199 + i * 7} 92 ${204 + i * 7}`);
      path(ctx, `M108 ${204 + i * 7} Q124 ${199 + i * 7} 138 ${204 + i * 7}`);
    }
    // Rodinhas
    ellipse(ctx, 82, 238, 14, 7);
    ellipse(ctx, 118, 238, 14, 7);
  },
};

const atomo: MinePage = {
  id: "atomo",
  title: "Átomo",
  draw(ctx) {
    const cx = 100;
    const cy = 128;
    for (const rot of [0, Math.PI / 3, (2 * Math.PI) / 3]) ellipse(ctx, cx, cy, 84, 30, rot);
    const nucleus: Array<[number, number]> = [[0, 0], [-10, -6], [10, -6], [-9, 8], [9, 8], [0, -13], [0, 13]];
    for (const [dx, dy] of nucleus) circle(ctx, cx + dx, cy + dy, 8);
    // Elétrons sobre as órbitas
    const spots: Array<[number, number]> = [[0, 0.6], [Math.PI / 3, 2.6], [(2 * Math.PI) / 3, 4.4], [0, 3.6]];
    for (const [rot, t] of spots) {
      const ex = 84 * Math.cos(t);
      const ey = 30 * Math.sin(t);
      circle(ctx, cx + ex * Math.cos(rot) - ey * Math.sin(rot), cy + ex * Math.sin(rot) + ey * Math.cos(rot), 7);
    }
    star(ctx, 24, 28, 8);
    star(ctx, 178, 34, 6);
    star(ctx, 30, 226, 6);
    star(ctx, 172, 230, 9);
    // Frasco e tubo de ensaio no rodapé
    path(ctx, "M88 200 L88 214 L72 244 Q70 250 76 250 L124 250 Q130 250 128 244 L112 214 L112 200 Z");
    path(ctx, "M80 232 L120 232");
    path(ctx, "M84 196 L116 196 L116 202 L84 202 Z");
    circle(ctx, 94, 240, 3);
    circle(ctx, 106, 236, 2.5);
  },
};

const foguete: MinePage = {
  id: "foguete",
  title: "Foguete no espaço",
  draw(ctx) {
    // Planeta com anel
    circle(ctx, 158, 206, 22);
    ellipse(ctx, 158, 206, 38, 9, -0.35);
    path(ctx, "M140 196 Q158 190 176 198");
    // Lua com crateras
    circle(ctx, 34, 214, 18);
    circle(ctx, 28, 208, 4);
    circle(ctx, 40, 220, 3);
    for (const [x, y, r] of [[30, 34, 7], [168, 30, 9], [154, 92, 5], [36, 120, 6], [24, 164, 4], [178, 140, 6]] as const) star(ctx, x, y, r);
    ctx.save();
    ctx.translate(100, 125);
    ctx.rotate(0.28);
    ctx.translate(-100, -125);
    path(ctx, "M88 172 Q92 196 100 214 Q108 196 112 172 Z");
    path(ctx, "M94 172 Q97 188 100 198 Q103 188 106 172 Z");
    path(ctx, "M76 124 L54 164 L56 180 L78 160 Z");
    path(ctx, "M124 124 L146 164 L144 180 L122 160 Z");
    path(ctx, "M100 36 C126 66 130 110 124 162 L76 162 C70 110 74 66 100 36 Z");
    path(ctx, "M84 162 L116 162 L112 174 L88 174 Z");
    path(ctx, "M86 60 Q100 54 114 60");
    circle(ctx, 100, 98, 15);
    circle(ctx, 100, 98, 9);
    path(ctx, "M75 134 Q100 140 125 134");
    path(ctx, "M100 140 L100 162");
    ctx.restore();
  },
};

const jardim: MinePage = {
  id: "jardim",
  title: "Jardim do sol",
  draw(ctx) {
    // Sol
    circle(ctx, 162, 42, 18);
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      path(ctx, `M${162 + Math.cos(a) * 23} ${42 + Math.sin(a) * 23} L${162 + Math.cos(a) * 31} ${42 + Math.sin(a) * 31}`);
    }
    cloud(ctx, 48, 46, 1.3);
    cloud(ctx, 112, 26, 0.9);
    // Chão
    path(ctx, "M0 222 Q50 210 100 220 Q150 230 200 214 L200 260 L0 260 Z");
    // Girassol do meio
    path(ctx, "M98 222 Q94 180 100 132");
    path(ctx, "M97 192 Q78 176 70 186 Q82 200 97 192 Z");
    path(ctx, "M98 172 Q118 156 128 166 Q114 180 98 172 Z");
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      ellipse(ctx, 100 + Math.cos(a) * 26, 112 + Math.sin(a) * 26, 8, 14, a + Math.PI / 2);
    }
    circle(ctx, 100, 112, 15);
    circle(ctx, 95, 108, 2);
    circle(ctx, 105, 110, 2);
    circle(ctx, 100, 117, 2);
    // Tulipas
    for (const [x, h] of [[42, 170], [158, 176]] as const) {
      path(ctx, `M${x} 224 Q${x - 2} ${h + 20} ${x} ${h}`);
      path(ctx, `M${x - 1} 206 Q${x - 18} 196 ${x - 22} 204 Q${x - 12} 214 ${x - 1} 206 Z`);
      path(ctx, `M${x - 12} ${h} Q${x - 14} ${h - 20} ${x - 7} ${h - 24} L${x} ${h - 14} L${x + 7} ${h - 24} Q${x + 14} ${h - 20} ${x + 12} ${h} Q${x} ${h + 8} ${x - 12} ${h} Z`);
    }
    // Borboleta
    ctx.save();
    ctx.translate(48, 112);
    ctx.rotate(-0.25);
    ellipse(ctx, -9, -7, 10, 8, -0.5);
    ellipse(ctx, 9, -7, 10, 8, 0.5);
    ellipse(ctx, -7, 7, 7, 6, 0.4);
    ellipse(ctx, 7, 7, 7, 6, -0.4);
    ellipse(ctx, 0, 0, 2.5, 12);
    path(ctx, "M-1 -11 Q-4 -20 -8 -21");
    path(ctx, "M1 -11 Q4 -20 8 -21");
    ctx.restore();
    // Joaninha na grama
    ctx.save();
    ctx.translate(140, 238);
    shape(ctx, () => ctx.arc(0, 0, 9, Math.PI, 0));
    path(ctx, "M-9 0 L9 0");
    path(ctx, "M0 -9 L0 0");
    circle(ctx, -4, -4, 1.8, INK);
    circle(ctx, 4, -5, 1.8, INK);
    ctx.restore();
  },
};

const estante: MinePage = {
  id: "estante",
  title: "Hora de estudar",
  draw(ctx) {
    // Mesa
    path(ctx, "M6 206 L194 206 L194 218 L6 218 Z");
    path(ctx, "M18 218 L18 256 L30 256 L30 218");
    path(ctx, "M170 218 L170 256 L182 256 L182 218");
    // Pilha de livros
    shape(ctx, () => ctx.roundRect(20, 182, 92, 24, 4));
    path(ctx, "M30 182 L30 206");
    path(ctx, "M44 190 L96 190 L96 198 L44 198 Z");
    shape(ctx, () => ctx.roundRect(28, 160, 78, 22, 4));
    path(ctx, "M96 160 L96 182");
    path(ctx, "M38 167 L84 167 L84 175 L38 175 Z");
    shape(ctx, () => ctx.roundRect(24, 140, 84, 20, 4));
    path(ctx, "M34 140 L34 160");
    heart(ctx, 70, 151, 5);
    // Maçã em cima
    path(ctx, "M66 138 Q50 140 52 122 Q54 108 66 114 Q78 108 80 122 Q82 140 66 138 Z");
    path(ctx, "M66 114 Q66 106 70 102");
    path(ctx, "M68 108 Q78 100 84 106 Q76 112 68 108 Z");
    // Caneca de lápis
    path(ctx, "M128 160 L128 206 L170 206 L170 160 Z");
    path(ctx, "M170 172 Q186 172 186 184 Q186 196 170 194");
    star(ctx, 149, 184, 8);
    // Lápis
    for (const [x, rot] of [[136, -0.18], [150, 0.02], [162, 0.2]] as const) {
      ctx.save();
      ctx.translate(x, 160);
      ctx.rotate(rot);
      path(ctx, "M-5 0 L-5 -54 L5 -54 L5 0 Z");
      path(ctx, "M-5 -54 L0 -68 L5 -54 Z");
      path(ctx, "M-2 -63 L0 -68 L2 -63 Z", INK);
      path(ctx, "M-5 -10 L5 -10");
      ctx.restore();
    }
    // Quadro com fórmulas
    shape(ctx, () => ctx.roundRect(28, 22, 144, 74, 8));
    shape(ctx, () => ctx.roundRect(36, 30, 128, 58, 4));
    ctx.save();
    ctx.lineWidth = 1.2;
    path(ctx, "M48 48 L58 48 M53 43 L53 53");
    path(ctx, "M66 44 L76 52 M76 44 L66 52");
    path(ctx, "M88 50 Q96 36 104 50 Q112 64 120 50");
    path(ctx, "M134 44 L150 44 M134 52 L150 52");
    path(ctx, "M50 72 L150 72");
    ctx.restore();
    star(ctx, 186, 120, 6);
    star(ctx, 14, 112, 5);
  },
};

const mandala: MinePage = {
  id: "mandala",
  title: "Mandala surpresa",
  varies: true,
  draw(ctx, seed) {
    let s = seed >>> 0 || 7;
    const random = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const cx = 100;
    const cy = 130;
    const n = [8, 10, 12, 16][Math.floor(random() * 4)];
    const rings = [12, 26, 44, 62, 80, 94];
    circle(ctx, cx, cy, rings[0]);
    for (let r = 1; r < rings.length; r += 1) {
      const inner = rings[r - 1];
      const outer = rings[r];
      const count = r === 1 ? n / 2 : n;
      const kind = Math.floor(random() * 4);
      const offset = r % 2 ? Math.PI / count : 0;
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2 + offset;
        const mid = (inner + outer) / 2;
        const px = cx + Math.cos(a) * mid;
        const py = cy + Math.sin(a) * mid;
        const span = (outer - inner) / 2;
        if (kind === 0) {
          ellipse(ctx, px, py, span * 0.92, Math.min(span * 0.5, (Math.PI * mid) / count * 0.8), a);
        } else if (kind === 1) {
          circle(ctx, px, py, Math.min(span * 0.75, (Math.PI * mid) / count * 0.7));
        } else if (kind === 2) {
          const half = (Math.PI / count) * 0.92;
          shape(ctx, () => {
            ctx.moveTo(cx + Math.cos(a - half) * inner, cy + Math.sin(a - half) * inner);
            ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
            ctx.lineTo(cx + Math.cos(a + half) * inner, cy + Math.sin(a + half) * inner);
          });
        } else {
          const half = Math.PI / count;
          shape(ctx, () => {
            ctx.moveTo(cx + Math.cos(a - half) * inner, cy + Math.sin(a - half) * inner);
            ctx.quadraticCurveTo(cx + Math.cos(a) * (outer + 6), cy + Math.sin(a) * (outer + 6), cx + Math.cos(a + half) * inner, cy + Math.sin(a + half) * inner);
          });
        }
      }
      circle(ctx, cx, cy, outer);
    }
    star(ctx, 18, 22, 9);
    star(ctx, 182, 22, 9);
    star(ctx, 18, 238, 9);
    star(ctx, 182, 238, 9);
  },
};

export const minePages: MinePage[] = [coruja, mine, jardim, foguete, atomo, estante, mandala];

/** Desenha a página inteira num contexto de `w × h` (proporção 200:260). */
export function drawMinePage(ctx: CanvasRenderingContext2D, page: MinePage, w: number, h: number, seed = 1) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.scale(w / PAGE_W, h / PAGE_H);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.7;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  page.draw(ctx, seed);
  ctx.restore();
}
