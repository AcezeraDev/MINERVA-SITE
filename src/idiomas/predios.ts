/*
  Os prédios temáticos da cidade pop-up (CidadePopUp.tsx).

  Cada parada tem a cara do lugar, feita só de primitivas e texturas
  desenhadas em <canvas> (nada para baixar), no traço do caderno: cores de
  marca-texto, contorno à caneta, papel. O conjunto inteiro entra numa
  "dobra" (hinge) que a cena levanta da folha; parada fechada recebe as
  mesmas peças em cinza e achatadas, como um recorte ainda dobrado.

  Coordenadas: a dobra fica na borda de trás (z = 0); o prédio ocupa
  x ∈ [-0.85, 0.85], z ∈ [0, 0.95] e cresce em y. A placa da parada fica fora
  daqui (na frente, z ≈ 0.8 do anchor), então nada passa de z = 0.95.
*/
import * as THREE from "three";

type Track = <T extends { dispose: () => void }>(item: T) => T;

export type ThemeOptions = {
  color: string;
  locked: boolean;
  dark: boolean;
  shadows: boolean;
  track: Track;
};

const INK = "#161a22";

function texture(track: Track, width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  draw(ctx);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  map.userData.redraw = () => {
    ctx.clearRect(0, 0, width, height);
    draw(ctx);
    map.needsUpdate = true;
  };
  return track(map);
}

/** Tons das peças: na parada fechada tudo vira o cinza do lápis. */
function palette(options: ThemeOptions) {
  const grey = options.dark ? "#2c344a" : "#d9dfe8";
  const greyDark = options.dark ? "#232a3c" : "#c3cbd7";
  return (hex: string, darker = false) => (options.locked ? (darker ? greyDark : grey) : hex);
}

function stripes(track: Track, a: string, b: string, count = 8, vertical = true) {
  return texture(track, 256, 256, (ctx) => {
    const step = 256 / count;
    for (let index = 0; index < count; index += 1) {
      ctx.fillStyle = index % 2 ? b : a;
      if (vertical) ctx.fillRect(index * step, 0, step, 256);
      else ctx.fillRect(0, index * step, 256, step);
    }
    ctx.strokeStyle = "rgba(22,26,34,.35)";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 250, 250);
  });
}

/** Fachada com janelas e porta; `label` escreve o letreiro no alto. */
function facade(track: Track, color: string, locked: boolean, { cols = 2, rows = 2, label = "", door = true, clock = false } = {}) {
  return texture(track, 256, 256, (ctx) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = locked ? "rgba(120,130,150,.3)" : "rgba(255,255,255,.2)";
    ctx.lineWidth = 2;
    for (let i = -256; i < 256; i += 14) {
      ctx.beginPath();
      ctx.moveTo(i, 256);
      ctx.lineTo(i + 256, 0);
      ctx.stroke();
    }
    const ink = locked ? "rgba(110,120,140,.8)" : INK;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 6;
    ctx.strokeRect(5, 5, 246, 246);
    let top = 24;
    if (label) {
      ctx.fillStyle = locked ? "rgba(255,255,255,.35)" : "#fffaf0";
      ctx.fillRect(28, 16, 200, 46);
      ctx.lineWidth = 4;
      ctx.strokeRect(28, 16, 200, 46);
      ctx.fillStyle = ink;
      ctx.font = "bold 34px 'Anybody Variable', 'Arial Black', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 128, 40, 186);
      top = 76;
    }
    if (clock) {
      ctx.fillStyle = locked ? "rgba(255,255,255,.35)" : "#fffaf0";
      ctx.beginPath();
      ctx.arc(128, top + 30, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(128, top + 30);
      ctx.lineTo(128, top + 12);
      ctx.moveTo(128, top + 30);
      ctx.lineTo(142, top + 36);
      ctx.stroke();
      top += 68;
    }
    ctx.lineWidth = 4;
    const gap = 256 / (cols + 1);
    const usable = (door ? 170 : 236) - top;
    const rowStep = Math.max(46, usable / rows);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = gap * (col + 1) - 17;
        const y = top + row * rowStep;
        if (y + 38 > (door ? 186 : 240)) continue;
        ctx.fillStyle = locked ? "rgba(255,255,255,.25)" : "rgba(255,248,200,.92)";
        ctx.fillRect(x, y, 34, 38);
        ctx.strokeRect(x, y, 34, 38);
      }
    }
    if (door) {
      ctx.fillStyle = locked ? "rgba(110,120,140,.4)" : "#3a2a1f";
      ctx.fillRect(104, 186, 48, 66);
      ctx.strokeRect(104, 186, 48, 66);
    }
  });
}

class Kit {
  readonly group = new THREE.Group();
  private readonly paint: (hex: string, darker?: boolean) => string;

  constructor(private readonly options: ThemeOptions) {
    this.paint = palette(options);
  }

  material(hex: string, extra: THREE.MeshStandardMaterialParameters = {}, darker = false) {
    return this.options.track(new THREE.MeshStandardMaterial({ color: this.paint(hex, darker), roughness: 0.85, ...extra }));
  }

  mapped(map: THREE.Texture) {
    return this.options.track(new THREE.MeshStandardMaterial({ map, roughness: 0.85 }));
  }

  add(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], x: number, y: number, z: number) {
    const mesh = new THREE.Mesh(this.options.track(geometry), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = this.options.shadows;
    this.group.add(mesh);
    return mesh;
  }

  /** Caixa com a frente (+z) usando `front` e o resto com a cor lateral. */
  box(w: number, h: number, d: number, side: string, x: number, y: number, z: number, front?: THREE.Texture) {
    const sides = this.material(side, {}, true);
    const face = front ? this.mapped(front) : this.material(side);
    return this.add(new THREE.BoxGeometry(w, h, d), [sides, sides, this.material(side), sides, face, sides], x, y + h / 2, z);
  }

  /** Telhado de duas águas: um prisma triangular deitado no eixo z. */
  gable(w: number, h: number, d: number, hex: string, x: number, y: number, z: number) {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(0, h);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    geometry.translate(0, 0, -d / 2);
    return this.add(geometry, this.material(hex), x, y, z);
  }

  get locked() {
    return this.options.locked;
  }

  get track() {
    return this.options.track;
  }

  hex(hex: string) {
    return this.paint(hex);
  }
}

/* ───────────────────────────── as paradas ───────────────────────────── */

function airport(kit: Kit, color: string) {
  // terminal comprido e baixo, com a vidraça
  const glass = texture(kit.track, 256, 128, (ctx) => {
    ctx.fillStyle = kit.hex(color);
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = kit.locked ? "rgba(255,255,255,.3)" : "#bfe6ff";
    ctx.fillRect(12, 22, 232, 58);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 22, 232, 58);
    for (let x = 44; x < 244; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 22);
      ctx.lineTo(x, 80);
      ctx.stroke();
    }
    ctx.fillStyle = INK;
    ctx.font = "bold 22px 'Anybody Variable', sans-serif";
    ctx.fillText("ARRIVALS", 80, 112);
  });
  kit.box(1.4, 0.48, 0.7, color, 0.08, 0, 0.42, glass);
  // torre de controle
  kit.add(new THREE.CylinderGeometry(0.09, 0.12, 1.15, 12), kit.material("#f4f1e8"), -0.62, 0.575, 0.3);
  kit.add(new THREE.CylinderGeometry(0.22, 0.16, 0.22, 12), kit.material("#7cc8ff", { metalness: 0.2, roughness: 0.3 }), -0.62, 1.26, 0.3);
  kit.add(new THREE.ConeGeometry(0.24, 0.16, 12), kit.material("#e5484d"), -0.62, 1.45, 0.3);
  // aviãozinho no pátio, na frente do terminal
  const plane = new THREE.Group();
  const white = kit.material("#ffffff");
  const body = new THREE.Mesh(kit.track(new THREE.CylinderGeometry(0.06, 0.06, 0.62, 10)), white);
  body.rotation.z = Math.PI / 2;
  const wing = new THREE.Mesh(kit.track(new THREE.BoxGeometry(0.16, 0.02, 0.62)), kit.material("#1d2bb8"));
  const tail = new THREE.Mesh(kit.track(new THREE.BoxGeometry(0.1, 0.16, 0.02)), kit.material("#1d2bb8"));
  tail.position.set(-0.28, 0.09, 0);
  plane.add(body, wing, tail);
  plane.position.set(0.48, 0.62, 0.42);
  plane.rotation.y = -0.3;
  kit.group.add(plane);
  return 1.5;
}

function cafe(kit: Kit, color: string) {
  kit.box(1.1, 0.78, 0.72, color, 0, 0, 0.38, facade(kit.track, kit.hex(color), kit.locked, { cols: 2, rows: 1, label: "CAFÉ" }));
  // toldo listrado inclinado sobre a vitrine
  const awning = kit.add(new THREE.BoxGeometry(1.16, 0.03, 0.34), kit.mapped(stripes(kit.track, kit.hex("#e5484d"), kit.hex("#ffffff"))), 0, 0.5, 0.86);
  awning.rotation.x = 0.45;
  // a xícara gigante no telhado, com pires e alça
  kit.add(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 18), kit.material("#ffffff"), 0, 0.8, 0.38);
  kit.add(new THREE.CylinderGeometry(0.24, 0.19, 0.32, 18), kit.material("#ffffff"), 0, 0.98, 0.38);
  kit.add(new THREE.CylinderGeometry(0.2, 0.2, 0.01, 18), kit.material("#6b3f1f"), 0, 1.14, 0.38);
  const handle = kit.add(new THREE.TorusGeometry(0.08, 0.025, 8, 16), kit.material("#ffffff"), 0.27, 0.98, 0.38);
  handle.rotation.y = Math.PI / 2;
  // mesinha com guarda-sol do lado de fora
  kit.add(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), kit.material("#2b2d33"), 0.72, 0.25, 0.7);
  kit.add(new THREE.ConeGeometry(0.2, 0.1, 10), kit.material("#f4e65a"), 0.72, 0.52, 0.7);
  return 1.15;
}

function school(kit: Kit, color: string) {
  kit.box(1.5, 0.72, 0.6, color, 0, 0, 0.36, facade(kit.track, kit.hex(color), kit.locked, { cols: 4, rows: 1, label: "SCHOOL" }));
  kit.gable(1.62, 0.3, 0.66, "#e5484d", 0, 0.72, 0.36);
  // campanário no meio, com o sino
  kit.box(0.28, 0.32, 0.28, "#f4f1e8", 0, 0.88, 0.36);
  kit.add(new THREE.ConeGeometry(0.24, 0.26, 4), kit.material("#1d2bb8"), 0, 1.33, 0.36).rotation.y = Math.PI / 4;
  kit.add(new THREE.SphereGeometry(0.06, 10, 8), kit.material("#f2b500", { metalness: 0.4, roughness: 0.35 }), 0, 1.03, 0.51);
  // mastro com bandeira
  kit.add(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 6), kit.material("#2b2d33"), 0.62, 1.07, 0.6);
  const flag = kit.add(new THREE.PlaneGeometry(0.26, 0.16), kit.material("#1d2bb8", { side: THREE.DoubleSide }), 0.76, 1.33, 0.6);
  flag.rotation.y = -0.2;
  return 1.45;
}

function home(kit: Kit, color: string) {
  kit.box(1.0, 0.7, 0.7, color, 0, 0, 0.38, facade(kit.track, kit.hex(color), kit.locked, { cols: 2, rows: 1 }));
  kit.gable(1.16, 0.46, 0.78, "#e5484d", 0, 0.7, 0.38);
  kit.box(0.14, 0.32, 0.14, "#9a6b4f", 0.28, 0.84, 0.26);
  // cerquinha branca na frente
  const white = kit.material("#ffffff");
  for (let index = 0; index < 7; index += 1) kit.add(new THREE.BoxGeometry(0.035, 0.2, 0.03), white, -0.6 + index * 0.2, 0.1, 0.9);
  kit.add(new THREE.BoxGeometry(1.24, 0.03, 0.025), white, 0, 0.14, 0.9);
  // casinha do Max, o cachorro da família
  kit.box(0.2, 0.15, 0.2, "#c98a5a", 0.7, 0, 0.56);
  kit.gable(0.26, 0.1, 0.24, "#7b1f2b", 0.7, 0.15, 0.56);
  return 1.25;
}

function city(kit: Kit, color: string) {
  // Big Ben: torre alta com o relógio
  kit.box(0.36, 1.3, 0.36, "#e8c98a", -0.55, 0, 0.3, facade(kit.track, kit.hex("#e8c98a"), kit.locked, { cols: 1, rows: 3, clock: true, door: false }));
  kit.add(new THREE.ConeGeometry(0.3, 0.42, 4), kit.material("#3c5a4a"), -0.55, 1.51, 0.3).rotation.y = Math.PI / 4;
  kit.add(new THREE.ConeGeometry(0.03, 0.18, 6), kit.material("#f2b500"), -0.55, 1.8, 0.3);
  // prédio de esquina
  kit.box(0.46, 0.8, 0.4, color, 0.55, 0, 0.22, facade(kit.track, kit.hex(color), kit.locked, { cols: 2, rows: 2 }));
  // ônibus vermelho de dois andares
  const bus = texture(kit.track, 256, 128, (ctx) => {
    ctx.fillStyle = kit.hex("#e5484d");
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = kit.locked ? "rgba(255,255,255,.3)" : "#fff6cf";
    for (let x = 14; x < 240; x += 40) {
      ctx.fillRect(x, 12, 30, 34);
      ctx.fillRect(x, 66, 30, 34);
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 124);
  });
  const side = kit.mapped(bus);
  const red = kit.material("#e5484d");
  // o ônibus fica entre a torre e o prédio, de lado para a câmera, acima da placa
  const busBody = kit.add(new THREE.BoxGeometry(0.62, 0.36, 0.22), [red, red, red, red, side, side], 0.02, 0.24, 0.34);
  const tyre = kit.material("#2b2d33");
  for (const dx of [-0.18, 0.22]) kit.add(new THREE.CylinderGeometry(0.06, 0.06, 0.24, 10), tyre, dx, 0.06, 0.34).rotation.x = Math.PI / 2;
  return 1.6;
}

function market(kit: Kit, color: string) {
  const wood = kit.material("#9a6b4f");
  // quatro postes da barraca
  for (const [x, z] of [[-0.62, 0.15], [0.62, 0.15], [-0.62, 0.78], [0.62, 0.78]]) kit.add(new THREE.CylinderGeometry(0.025, 0.025, 0.86, 6), wood, x, 0.43, z);
  // toldo listrado em duas águas
  kit.gable(1.42, 0.3, 0.86, color, 0, 0.86, 0.46);
  const canopy = kit.add(new THREE.BoxGeometry(1.42, 0.03, 0.3), kit.mapped(stripes(kit.track, kit.hex("#2fb36d"), kit.hex("#ffffff"))), 0, 0.84, 0.9);
  canopy.rotation.x = 0.35;
  // balcão com caixotes de fruta
  kit.box(1.2, 0.34, 0.4, "#c98a5a", 0, 0, 0.5);
  const fruits = ["#e5484d", "#f4e65a", "#ff9f43", "#8e44ad"];
  fruits.forEach((hex, crate) => {
    const cx = -0.42 + crate * 0.28;
    kit.box(0.24, 0.07, 0.26, "#b07a4a", cx, 0.34, 0.52);
    const fruit = kit.material(hex, { roughness: 0.5 });
    for (let k = 0; k < 4; k += 1) kit.add(new THREE.SphereGeometry(0.045, 10, 8), fruit, cx - 0.05 + (k % 2) * 0.1, 0.45, 0.47 + Math.floor(k / 2) * 0.1);
  });
  // placa de preço
  kit.add(new THREE.BoxGeometry(0.22, 0.14, 0.02), kit.material("#fffaf0"), 0.5, 0.58, 0.72);
  return 1.2;
}

function park(kit: Kit, color: string) {
  // gramado redondo
  kit.add(new THREE.CylinderGeometry(0.82, 0.86, 0.05, 28), kit.material("#7fe7aa"), 0, 0.025, 0.47);
  const trunk = kit.material("#8a5a3b");
  const leaves = [kit.material("#2fb36d"), kit.material("#4fcf86"), kit.material(color)];
  const trees: Array<[number, number, number]> = [[-0.48, 0.28, 0.6], [0.2, 0.18, 0.75], [0.55, 0.62, 0.55]];
  trees.forEach(([x, z, size], index) => {
    kit.add(new THREE.CylinderGeometry(0.04, 0.05, 0.42 * size + 0.2, 6), trunk, x, (0.42 * size + 0.2) / 2 + 0.05, z);
    kit.add(new THREE.IcosahedronGeometry(0.28 * size + 0.08, 0), leaves[index % leaves.length], x, 0.42 * size + 0.42, z);
  });
  // banco
  const bench = kit.material("#c98a5a");
  kit.add(new THREE.BoxGeometry(0.42, 0.03, 0.12), bench, -0.1, 0.18, 0.82);
  kit.add(new THREE.BoxGeometry(0.42, 0.1, 0.02), bench, -0.1, 0.25, 0.76);
  for (const dx of [-0.28, 0.08]) kit.add(new THREE.BoxGeometry(0.03, 0.14, 0.1), kit.material("#2b2d33"), dx, 0.1, 0.82);
  // poste de luz
  kit.add(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 6), kit.material("#2b2d33"), 0.62, 0.4, 0.86);
  kit.add(new THREE.SphereGeometry(0.06, 10, 8), kit.material("#fff3b0", { emissive: kit.locked ? "#000000" : "#806a10" }), 0.62, 0.78, 0.86);
  return 1.0;
}

function party(kit: Kit, color: string) {
  // tenda listrada: paredes + teto cônico
  const tent = stripes(kit.track, kit.hex(color), kit.hex("#ffffff"), 10);
  kit.add(new THREE.CylinderGeometry(0.55, 0.55, 0.55, 20, 1, true), kit.track(new THREE.MeshStandardMaterial({ map: tent, side: THREE.DoubleSide, roughness: 0.85 })), 0, 0.275, 0.45);
  kit.add(new THREE.ConeGeometry(0.62, 0.5, 20), kit.material("#e5484d"), 0, 0.8, 0.45);
  kit.add(new THREE.ConeGeometry(0.025, 0.2, 6), kit.material("#f2b500"), 0, 1.15, 0.45);
  // bandeirinhas
  const flags = ["#f4e65a", "#7fe7aa", "#b7a6ff", "#ffaabd", "#7cc8ff"];
  for (let index = 0; index < 7; index += 1) {
    const flag = kit.add(new THREE.ConeGeometry(0.05, 0.1, 3), kit.material(flags[index % flags.length]), -0.6 + index * 0.2, 0.95 - Math.sin((index / 6) * Math.PI) * 0.12, 0.92);
    flag.rotation.x = Math.PI;
  }
  // balões com cordinha
  const balloons: Array<[number, number, string]> = [[0.68, 1.15, "#e5484d"], [0.82, 1.02, "#1d2bb8"], [0.6, 0.95, "#f2b500"]];
  for (const [x, y, hex] of balloons) {
    kit.add(new THREE.SphereGeometry(0.1, 12, 10), kit.material(hex, { roughness: 0.35 }), x, y, 0.7);
    kit.add(new THREE.CylinderGeometry(0.004, 0.004, y - 0.1, 4), kit.material("#2b2d33"), x, (y - 0.1) / 2, 0.7);
  }
  return 1.25;
}

const themes: Record<string, (kit: Kit, color: string) => number> = { airport, cafe, school, home, city, market, park, party };

/**
 * Monta o prédio da parada `id`. Devolve o grupo (já com todas as malhas) e a
 * altura do topo, usada para pôr a bandeirinha de carimbo e o alfinete.
 */
export function buildLandmark(id: string, options: ThemeOptions): { group: THREE.Group; height: number } {
  const kit = new Kit(options);
  const build = themes[id];
  let height = 1;
  if (build) height = build(kit, options.color);
  else {
    kit.box(1.1, 1, 0.9, options.color, 0, 0, 0.45, facade(options.track, options.color, options.locked));
    height = 1;
  }
  return { group: kit.group, height };
}
