/*
  Os prédios temáticos da cidade pop-up (CidadePopUp.tsx).

  Cada parada tem a cara do lugar, feita só de primitivas PBR e texturas
  desenhadas em <canvas> (nada para baixar), no traço do caderno: cores de
  marca-texto, contorno à caneta, janelas acesas à noite (emissiveMap) e
  micro-animações vivas (radar girando, fumaça de café e chaminé, bandeira
  tremulando, balões flutuando, poste aceso).

  Coordenadas: a dobra fica na borda de trás (z = 0); o prédio ocupa
  x ∈ [-0.85, 0.85], z ∈ [0, 0.95] e cresce em y. A placa da parada fica fora
  daqui (na frente, z ≈ 0.82 do anchor), então nada passa de z = 0.95.
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

export type LandmarkResult = {
  group: THREE.Group;
  height: number;
  update?: (elapsed: number, dt: number) => void;
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

/** Tons das peças: na parada fechada tudo vira um traço de lápis azulado/cinza legível. */
function palette(options: ThemeOptions) {
  const grey = options.dark ? "#36415e" : "#d9dfe8";
  const greyDark = options.dark ? "#29324a" : "#c3cbd7";
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

/**
 * Fachada com janelas e porta + mapa emissivo separado para as janelas
 * brilharem suavemente no modo escuro (caderno noturno).
 */
function facade(
  track: Track,
  color: string,
  locked: boolean,
  dark: boolean,
  { cols = 2, rows = 2, label = "", door = true, clock = false } = {},
): { map: THREE.Texture; emissiveMap?: THREE.Texture } {
  const windowRects: Array<[number, number, number, number]> = [];
  let clockCenter: [number, number] | null = null;

  const map = texture(track, 256, 256, (ctx) => {
    windowRects.length = 0;
    clockCenter = null;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 256, 256);

    // textura sutil de papel riscado à mão
    ctx.strokeStyle = locked ? "rgba(150,168,210,.22)" : "rgba(255,255,255,.18)";
    ctx.lineWidth = 2;
    for (let i = -256; i < 256; i += 14) {
      ctx.beginPath();
      ctx.moveTo(i, 256);
      ctx.lineTo(i + 256, 0);
      ctx.stroke();
    }

    const ink = locked ? (dark ? "rgba(155,175,220,.65)" : "rgba(110,120,140,.8)") : INK;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 6;
    ctx.strokeRect(5, 5, 246, 246);

    let top = 24;
    if (label) {
      ctx.fillStyle = locked ? "rgba(255,255,255,.22)" : "#fffaf0";
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
      clockCenter = [128, top + 30];
      ctx.fillStyle = locked ? "rgba(255,255,255,.22)" : "#fff8dc";
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
        windowRects.push([x, y, 34, 38]);
        ctx.fillStyle = locked ? "rgba(255,255,255,.18)" : dark ? "#ffe89e" : "rgba(255,248,200,.95)";
        ctx.fillRect(x, y, 34, 38);
        // reflexo diagonal sutil no vidro
        if (!locked) {
          ctx.fillStyle = "rgba(255,255,255,.35)";
          ctx.fillRect(x + 4, y + 4, 8, 30);
        }
        ctx.strokeRect(x, y, 34, 38);
      }
    }

    if (door) {
      ctx.fillStyle = locked ? "rgba(110,120,140,.4)" : "#3a2a1f";
      ctx.fillRect(104, 186, 48, 66);
      ctx.strokeRect(104, 186, 48, 66);
    }
  });

  if (locked || !dark) return { map };

  const emissiveMap = texture(track, 256, 256, (ctx) => {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#ffdf88";
    for (const [x, y, w, h] of windowRects) {
      ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    }
    if (clockCenter) {
      ctx.fillStyle = "#fff1b8";
      ctx.beginPath();
      ctx.arc(clockCenter[0], clockCenter[1], 24, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  return { map, emissiveMap };
}

class Kit {
  readonly group = new THREE.Group();
  private readonly paint: (hex: string, darker?: boolean) => string;
  private readonly updaters: Array<(elapsed: number, dt: number) => void> = [];

  constructor(private readonly options: ThemeOptions) {
    this.paint = palette(options);
  }

  onUpdate(fn: (elapsed: number, dt: number) => void) {
    this.updaters.push(fn);
  }

  getUpdate(): ((elapsed: number, dt: number) => void) | undefined {
    if (!this.updaters.length || this.options.locked) return undefined;
    const list = this.updaters;
    return (elapsed: number, dt: number) => {
      for (let i = 0; i < list.length; i += 1) list[i](elapsed, dt);
    };
  }

  material(hex: string, extra: THREE.MeshStandardMaterialParameters = {}, darker = false) {
    return this.options.track(
      new THREE.MeshStandardMaterial({
        color: this.paint(hex, darker),
        roughness: 0.78,
        metalness: 0.04,
        ...extra,
      }),
    );
  }

  mapped(map: THREE.Texture, emissiveMap?: THREE.Texture) {
    return this.options.track(
      new THREE.MeshStandardMaterial({
        map,
        roughness: 0.78,
        metalness: 0.04,
        ...(emissiveMap
          ? {
              emissive: new THREE.Color(0xffd97d),
              emissiveMap,
              emissiveIntensity: 0.75,
            }
          : {}),
      }),
    );
  }

  add(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], x: number, y: number, z: number) {
    const mesh = new THREE.Mesh(this.options.track(geometry), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = this.options.shadows;
    mesh.receiveShadow = this.options.shadows;
    this.group.add(mesh);
    return mesh;
  }

  /** Base sutil de papel-cartão para dar peso físico ao recorte pop-up. */
  basePad(w: number, d: number, z = 0.44) {
    const padColor = this.options.locked
      ? this.options.dark
        ? "#222a3e"
        : "#cbd3df"
      : this.options.dark
        ? "#242c44"
        : "#eef2f8";
    const mesh = this.add(
      new THREE.BoxGeometry(w, 0.032, d),
      this.options.track(new THREE.MeshStandardMaterial({ color: padColor, roughness: 0.92 })),
      0,
      0.016,
      z,
    );
    mesh.castShadow = false;
    return mesh;
  }

  /** Caixa com a frente (+z) usando `front` e o resto com a cor lateral. */
  box(
    w: number,
    h: number,
    d: number,
    side: string,
    x: number,
    y: number,
    z: number,
    front?: THREE.Texture | { map: THREE.Texture; emissiveMap?: THREE.Texture },
  ) {
    const sides = this.material(side, {}, true);
    const face = front
      ? "map" in front
        ? this.mapped(front.map, front.emissiveMap)
        : this.mapped(front)
      : this.material(side);
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
    return this.add(geometry, this.material(hex, { roughness: 0.72 }), x, y, z);
  }

  get locked() {
    return this.options.locked;
  }

  get dark() {
    return this.options.dark;
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
  kit.basePad(1.75, 0.92, 0.44);
  // terminal comprido e baixo, com a vidraça luminosa
  const glass = texture(kit.track, 256, 128, (ctx) => {
    ctx.fillStyle = kit.hex(color);
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = kit.locked ? "rgba(255,255,255,.22)" : kit.dark ? "#9be2ff" : "#bfe6ff";
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
  const glassEmissive =
    !kit.locked && kit.dark
      ? texture(kit.track, 256, 128, (ctx) => {
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, 256, 128);
          ctx.fillStyle = "#7dd4ff";
          ctx.fillRect(14, 24, 228, 54);
        })
      : undefined;
  kit.box(1.4, 0.48, 0.7, color, 0.08, 0.03, 0.42, { map: glass, emissiveMap: glassEmissive });

  // torre de controle com vidro brilhante + radar giratório + farol piscando
  kit.add(new THREE.CylinderGeometry(0.09, 0.13, 1.15, 14), kit.material("#f4f1e8", { roughness: 0.65 }), -0.62, 0.605, 0.3);
  kit.add(
    new THREE.CylinderGeometry(0.22, 0.16, 0.22, 14),
    kit.material("#7cc8ff", {
      metalness: 0.35,
      roughness: 0.18,
      emissive: kit.locked ? "#000000" : kit.dark ? "#3898d8" : "#1b4d70",
      emissiveIntensity: kit.dark ? 0.65 : 0.15,
    }),
    -0.62,
    1.29,
    0.3,
  );
  kit.add(new THREE.ConeGeometry(0.24, 0.16, 14), kit.material("#e5484d", { roughness: 0.55 }), -0.62, 1.48, 0.3);

  // radar giratório + luz de aviação
  const radar = new THREE.Group();
  radar.position.set(-0.62, 1.59, 0.3);
  const dish = new THREE.Mesh(kit.track(new THREE.BoxGeometry(0.22, 0.045, 0.03)), kit.material("#f4f1e8", { metalness: 0.45, roughness: 0.3 }));
  const beaconMat = kit.material("#ff4d5a", {
    emissive: kit.locked ? "#000000" : "#ff3344",
    emissiveIntensity: kit.locked ? 0 : 1.4,
    roughness: 0.2,
  });
  const beacon = new THREE.Mesh(kit.track(new THREE.SphereGeometry(0.038, 10, 8)), beaconMat);
  beacon.position.y = 0.065;
  radar.add(dish, beacon);
  kit.group.add(radar);

  // aviãozinho no pátio, com leve flutuação/vibração de motor ligado
  const plane = new THREE.Group();
  const white = kit.material("#ffffff", { roughness: 0.35, metalness: 0.12 });
  const body = new THREE.Mesh(kit.track(new THREE.CylinderGeometry(0.058, 0.062, 0.64, 12)), white);
  body.rotation.z = Math.PI / 2;
  const nose = new THREE.Mesh(kit.track(new THREE.ConeGeometry(0.058, 0.14, 12)), white);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 0.38;
  const wing = new THREE.Mesh(kit.track(new THREE.BoxGeometry(0.16, 0.02, 0.64)), kit.material("#2d44e0", { roughness: 0.45 }));
  const tail = new THREE.Mesh(kit.track(new THREE.BoxGeometry(0.11, 0.16, 0.02)), kit.material("#2d44e0", { roughness: 0.45 }));
  tail.position.set(-0.28, 0.09, 0);
  plane.add(body, nose, wing, tail);
  plane.position.set(0.46, 0.65, 0.42);
  plane.rotation.y = -0.3;
  kit.group.add(plane);

  kit.onUpdate((elapsed) => {
    radar.rotation.y = elapsed * 2.2;
    beaconMat.emissiveIntensity = 0.45 + (Math.sin(elapsed * 5.2) * 0.5 + 0.5) * 1.45;
    plane.position.y = 0.65 + Math.sin(elapsed * 2.6) * 0.022;
    plane.rotation.z = Math.sin(elapsed * 1.9) * 0.035;
  });

  return 1.65;
}

function cafe(kit: Kit, color: string) {
  kit.basePad(1.65, 0.92, 0.44);
  kit.box(1.1, 0.78, 0.72, color, 0, 0.03, 0.38, facade(kit.track, kit.hex(color), kit.locked, kit.dark, { cols: 2, rows: 1, label: "CAFÉ" }));
  // toldo listrado inclinado sobre a vitrine
  const awning = kit.add(new THREE.BoxGeometry(1.16, 0.03, 0.34), kit.mapped(stripes(kit.track, kit.hex("#e5484d"), kit.hex("#ffffff"))), 0, 0.53, 0.86);
  awning.rotation.x = 0.45;
  // a xícara gigante no telhado, com pires e alça em porcelana brilhante
  const porcelain = kit.material("#ffffff", { roughness: 0.25, metalness: 0.06 });
  kit.add(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 20), porcelain, 0, 0.83, 0.38);
  kit.add(new THREE.CylinderGeometry(0.24, 0.19, 0.32, 20), porcelain, 0, 1.01, 0.38);
  kit.add(new THREE.CylinderGeometry(0.2, 0.2, 0.01, 20), kit.material("#6b3f1f", { roughness: 0.2 }), 0, 1.17, 0.38);
  const handle = kit.add(new THREE.TorusGeometry(0.08, 0.025, 10, 18), porcelain, 0.27, 1.01, 0.38);
  handle.rotation.y = Math.PI / 2;

  // vapores animados saindo da xícara
  if (!kit.locked) {
    const puffs: Array<{ mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; phase: number; ox: number }> = [];
    const puffGeo = kit.track(new THREE.SphereGeometry(0.065, 10, 8));
    for (let i = 0; i < 3; i += 1) {
      const mat = kit.track(
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.45,
          roughness: 0.9,
          depthWrite: false,
        }),
      );
      const mesh = new THREE.Mesh(puffGeo, mat);
      kit.group.add(mesh);
      puffs.push({ mesh, mat, phase: i / 3, ox: (i - 1) * 0.06 });
    }
    kit.onUpdate((elapsed) => {
      for (const puff of puffs) {
        const t = (elapsed * 0.42 + puff.phase) % 1;
        puff.mesh.position.set(puff.ox + Math.sin(t * Math.PI * 2 + puff.phase * 4) * 0.04, 1.24 + t * 0.46, 0.38);
        const s = 0.55 + t * 0.95;
        puff.mesh.scale.setScalar(s);
        puff.mat.opacity = Math.sin(t * Math.PI) * 0.45;
      }
    });
  }

  // mesinha com guarda-sol do lado de fora
  kit.add(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), kit.material("#2b2d33", { metalness: 0.4 }), 0.72, 0.28, 0.7);
  kit.add(new THREE.ConeGeometry(0.2, 0.1, 12), kit.material("#f4e65a"), 0.72, 0.55, 0.7);
  return 1.3;
}

function school(kit: Kit, color: string) {
  kit.basePad(1.72, 0.88, 0.42);
  kit.box(1.5, 0.72, 0.6, color, 0, 0.03, 0.36, facade(kit.track, kit.hex(color), kit.locked, kit.dark, { cols: 4, rows: 1, label: "SCHOOL" }));
  kit.gable(1.62, 0.3, 0.66, "#e5484d", 0, 0.75, 0.36);
  // campanário no meio, com o sino dourado
  kit.box(0.28, 0.32, 0.28, "#f4f1e8", 0, 0.91, 0.36);
  kit.add(new THREE.ConeGeometry(0.24, 0.26, 4), kit.material("#1d2bb8"), 0, 1.36, 0.36).rotation.y = Math.PI / 4;
  const bell = kit.add(new THREE.SphereGeometry(0.06, 12, 10), kit.material("#f2b500", { metalness: 0.65, roughness: 0.25 }), 0, 1.06, 0.51);
  // mastro com bandeira tremulando
  kit.add(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 6), kit.material("#2b2d33", { metalness: 0.5 }), 0.62, 1.1, 0.6);
  const flagPivot = new THREE.Group();
  flagPivot.position.set(0.62, 1.36, 0.6);
  const flag = new THREE.Mesh(kit.track(new THREE.PlaneGeometry(0.26, 0.16)), kit.material("#2c42e8", { side: THREE.DoubleSide }));
  flag.position.x = 0.14;
  flagPivot.add(flag);
  kit.group.add(flagPivot);

  kit.onUpdate((elapsed) => {
    flagPivot.rotation.y = -0.2 + Math.sin(elapsed * 3.8) * 0.24;
    bell.position.x = Math.sin(elapsed * 2.2) * 0.018;
  });

  return 1.5;
}

function home(kit: Kit, color: string) {
  kit.basePad(1.68, 0.94, 0.46);
  kit.box(1.0, 0.7, 0.7, color, 0, 0.03, 0.38, facade(kit.track, kit.hex(color), kit.locked, kit.dark, { cols: 2, rows: 1 }));
  kit.gable(1.16, 0.46, 0.78, "#e5484d", 0, 0.73, 0.38);
  kit.box(0.14, 0.32, 0.14, "#9a6b4f", 0.28, 0.87, 0.26);
  // fumacinha aconchegante na chaminé
  if (!kit.locked) {
    const puffs: Array<{ mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; phase: number }> = [];
    const puffGeo = kit.track(new THREE.SphereGeometry(0.055, 10, 8));
    for (let i = 0; i < 3; i += 1) {
      const mat = kit.track(
        new THREE.MeshStandardMaterial({
          color: 0xe8eefc,
          transparent: true,
          opacity: 0.4,
          roughness: 0.95,
          depthWrite: false,
        }),
      );
      const mesh = new THREE.Mesh(puffGeo, mat);
      kit.group.add(mesh);
      puffs.push({ mesh, mat, phase: i / 3 });
    }
    kit.onUpdate((elapsed) => {
      for (const puff of puffs) {
        const t = (elapsed * 0.34 + puff.phase) % 1;
        puff.mesh.position.set(0.28 + t * 0.12 + Math.sin(t * 5) * 0.03, 1.24 + t * 0.42, 0.26);
        puff.mesh.scale.setScalar(0.5 + t * 0.9);
        puff.mat.opacity = Math.sin(t * Math.PI) * 0.38;
      }
    });
  }
  // cerquinha branca na frente
  const white = kit.material("#ffffff");
  for (let index = 0; index < 7; index += 1) kit.add(new THREE.BoxGeometry(0.035, 0.2, 0.03), white, -0.6 + index * 0.2, 0.13, 0.9);
  kit.add(new THREE.BoxGeometry(1.24, 0.03, 0.025), white, 0, 0.17, 0.9);
  // casinha do Max, o cachorro da família
  kit.box(0.2, 0.15, 0.2, "#c98a5a", 0.7, 0.03, 0.56);
  kit.gable(0.26, 0.1, 0.24, "#7b1f2b", 0.7, 0.18, 0.56);
  return 1.3;
}

function city(kit: Kit, color: string) {
  kit.basePad(1.72, 0.88, 0.42);
  // Big Ben: torre alta com o relógio iluminado
  kit.box(0.36, 1.3, 0.36, "#e8c98a", -0.55, 0.03, 0.3, facade(kit.track, kit.hex("#e8c98a"), kit.locked, kit.dark, { cols: 1, rows: 3, clock: true, door: false }));
  kit.add(new THREE.ConeGeometry(0.3, 0.42, 4), kit.material("#3c5a4a", { roughness: 0.65 }), -0.55, 1.54, 0.3).rotation.y = Math.PI / 4;
  kit.add(new THREE.ConeGeometry(0.03, 0.18, 8), kit.material("#f2b500", { metalness: 0.7, roughness: 0.2 }), -0.55, 1.83, 0.3);
  // prédio de esquina
  kit.box(0.46, 0.8, 0.4, color, 0.55, 0.03, 0.22, facade(kit.track, kit.hex(color), kit.locked, kit.dark, { cols: 2, rows: 2 }));
  // ônibus vermelho de dois andares
  const bus = texture(kit.track, 256, 128, (ctx) => {
    ctx.fillStyle = kit.hex("#e5484d");
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = kit.locked ? "rgba(255,255,255,.25)" : "#fff6cf";
    for (let x = 14; x < 240; x += 40) {
      ctx.fillRect(x, 12, 30, 34);
      ctx.fillRect(x, 66, 30, 34);
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 124);
  });
  const busGroup = new THREE.Group();
  const side = kit.mapped(bus);
  const red = kit.material("#e5484d", { roughness: 0.42, metalness: 0.1 });
  const busBody = new THREE.Mesh(kit.track(new THREE.BoxGeometry(0.62, 0.36, 0.22)), [red, red, red, red, side, side]);
  busBody.position.set(0.02, 0.27, 0.34);
  busBody.castShadow = !kit.locked;
  busGroup.add(busBody);
  const tyre = kit.material("#2b2d33", { roughness: 0.9 });
  for (const dx of [-0.18, 0.22]) {
    const wheel = new THREE.Mesh(kit.track(new THREE.CylinderGeometry(0.06, 0.06, 0.24, 12)), tyre);
    wheel.position.set(dx, 0.09, 0.34);
    wheel.rotation.x = Math.PI / 2;
    busGroup.add(wheel);
  }
  kit.group.add(busGroup);

  kit.onUpdate((elapsed) => {
    busBody.position.y = 0.27 + Math.sin(elapsed * 5.5) * 0.008;
    busGroup.position.x = Math.sin(elapsed * 1.1) * 0.06;
  });

  return 1.65;
}

function market(kit: Kit, color: string) {
  kit.basePad(1.66, 0.92, 0.48);
  const wood = kit.material("#9a6b4f");
  // quatro postes da barraca
  for (const [x, z] of [[-0.62, 0.15], [0.62, 0.15], [-0.62, 0.78], [0.62, 0.78]]) kit.add(new THREE.CylinderGeometry(0.025, 0.025, 0.86, 8), wood, x, 0.46, z);
  // toldo listrado em duas águas
  kit.gable(1.42, 0.3, 0.86, color, 0, 0.89, 0.46);
  const canopy = kit.add(new THREE.BoxGeometry(1.42, 0.03, 0.3), kit.mapped(stripes(kit.track, kit.hex("#2fb36d"), kit.hex("#ffffff"))), 0, 0.87, 0.9);
  canopy.rotation.x = 0.35;
  // balcão com caixotes de fruta
  kit.box(1.2, 0.34, 0.4, "#c98a5a", 0, 0.03, 0.5);
  const fruits = ["#e5484d", "#f4e65a", "#ff9f43", "#8e44ad"];
  fruits.forEach((hex, crate) => {
    const cx = -0.42 + crate * 0.28;
    kit.box(0.24, 0.07, 0.26, "#b07a4a", cx, 0.37, 0.52);
    const fruit = kit.material(hex, { roughness: 0.32, metalness: 0.05 });
    for (let k = 0; k < 4; k += 1) kit.add(new THREE.SphereGeometry(0.045, 10, 8), fruit, cx - 0.05 + (k % 2) * 0.1, 0.48, 0.47 + Math.floor(k / 2) * 0.1);
  });
  // placa de preço
  kit.add(new THREE.BoxGeometry(0.22, 0.14, 0.02), kit.material("#fffaf0"), 0.5, 0.61, 0.72);

  kit.onUpdate((elapsed) => {
    canopy.rotation.x = 0.35 + Math.sin(elapsed * 2.1) * 0.03;
  });

  return 1.25;
}

function park(kit: Kit, color: string) {
  // gramado redondo
  kit.add(new THREE.CylinderGeometry(0.84, 0.88, 0.055, 32), kit.material("#7fe7aa"), 0, 0.028, 0.47);
  const trunk = kit.material("#8a5a3b");
  const leaves = [kit.material("#2fb36d"), kit.material("#4fcf86"), kit.material(color)];
  const trees: Array<[number, number, number]> = [[-0.48, 0.28, 0.6], [0.2, 0.18, 0.75], [0.55, 0.62, 0.55]];
  const crowns: THREE.Mesh[] = [];
  trees.forEach(([x, z, size], index) => {
    kit.add(new THREE.CylinderGeometry(0.04, 0.05, 0.42 * size + 0.2, 8), trunk, x, (0.42 * size + 0.2) / 2 + 0.05, z);
    const crown = kit.add(new THREE.IcosahedronGeometry(0.28 * size + 0.08, 0), leaves[index % leaves.length], x, 0.42 * size + 0.42, z);
    crowns.push(crown);
  });
  // banco
  const bench = kit.material("#c98a5a");
  kit.add(new THREE.BoxGeometry(0.42, 0.03, 0.12), bench, -0.1, 0.18, 0.82);
  kit.add(new THREE.BoxGeometry(0.42, 0.1, 0.02), bench, -0.1, 0.25, 0.76);
  for (const dx of [-0.28, 0.08]) kit.add(new THREE.BoxGeometry(0.03, 0.14, 0.1), kit.material("#2b2d33"), dx, 0.1, 0.82);
  // poste de luz com lâmpada pulsante
  kit.add(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 8), kit.material("#2b2d33", { metalness: 0.5 }), 0.62, 0.4, 0.86);
  const lampMat = kit.material("#fff3b0", {
    emissive: kit.locked ? "#000000" : "#ffd65a",
    emissiveIntensity: kit.locked ? 0 : kit.dark ? 1.4 : 0.4,
    roughness: 0.2,
  });
  kit.add(new THREE.SphereGeometry(0.065, 12, 10), lampMat, 0.62, 0.78, 0.86);

  kit.onUpdate((elapsed) => {
    crowns.forEach((crown, idx) => {
      crown.rotation.z = Math.sin(elapsed * 1.6 + idx * 1.4) * 0.055;
    });
    if (kit.dark) {
      lampMat.emissiveIntensity = 1.15 + Math.sin(elapsed * 2.8) * 0.35;
    }
  });

  return 1.05;
}

function party(kit: Kit, color: string) {
  kit.basePad(1.66, 0.94, 0.48);
  // tenda listrada: paredes + teto cônico
  const tent = stripes(kit.track, kit.hex(color), kit.hex("#ffffff"), 10);
  kit.add(new THREE.CylinderGeometry(0.55, 0.55, 0.55, 24, 1, true), kit.track(new THREE.MeshStandardMaterial({ map: tent, side: THREE.DoubleSide, roughness: 0.8 })), 0, 0.305, 0.45);
  kit.add(new THREE.ConeGeometry(0.62, 0.5, 24), kit.material("#e5484d"), 0, 0.83, 0.45);
  kit.add(new THREE.ConeGeometry(0.025, 0.2, 8), kit.material("#f2b500", { metalness: 0.65, roughness: 0.25 }), 0, 1.18, 0.45);
  // bandeirinhas
  const flags = ["#f4e65a", "#7fe7aa", "#b7a6ff", "#ffaabd", "#7cc8ff"];
  for (let index = 0; index < 7; index += 1) {
    const flag = kit.add(new THREE.ConeGeometry(0.05, 0.1, 3), kit.material(flags[index % flags.length]), -0.6 + index * 0.2, 0.98 - Math.sin((index / 6) * Math.PI) * 0.12, 0.92);
    flag.rotation.x = Math.PI;
  }
  // balões com cordinha flutuando em fases diferentes
  const balloons: Array<[number, number, string]> = [[0.68, 1.18, "#e5484d"], [0.82, 1.05, "#2d44e0"], [0.6, 0.98, "#f2b500"]];
  const balloonMeshes: Array<{ mesh: THREE.Mesh; baseY: number; phase: number }> = [];
  balloons.forEach(([x, y, hex], idx) => {
    const mesh = kit.add(new THREE.SphereGeometry(0.1, 14, 12), kit.material(hex, { roughness: 0.22, metalness: 0.1 }), x, y, 0.7);
    kit.add(new THREE.CylinderGeometry(0.004, 0.004, y - 0.1, 4), kit.material("#2b2d33"), x, (y - 0.1) / 2, 0.7);
    balloonMeshes.push({ mesh, baseY: y, phase: idx * 2.1 });
  });

  kit.onUpdate((elapsed) => {
    for (const b of balloonMeshes) {
      b.mesh.position.y = b.baseY + Math.sin(elapsed * 2.3 + b.phase) * 0.045;
    }
  });

  return 1.3;
}

const themes: Record<string, (kit: Kit, color: string) => number> = { airport, cafe, school, home, city, market, park, party };

/**
 * Monta o prédio da parada `id`. Devolve o grupo (já com todas as malhas),
 * a altura do topo e um callback `update` opcional para micro-animações vivas.
 */
export function buildLandmark(id: string, options: ThemeOptions): LandmarkResult {
  const kit = new Kit(options);
  const build = themes[id];
  let height = 1;
  if (build) height = build(kit, options.color);
  else {
    kit.box(1.1, 1, 0.9, options.color, 0, 0, 0.45, facade(options.track, options.color, options.locked, options.dark));
    height = 1;
  }
  return { group: kit.group, height, update: kit.getUpdate() };
}
