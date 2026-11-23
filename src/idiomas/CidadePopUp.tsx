/*
  A cidade pop-up do intercâmbio (three.js).

  Diorama interativo de Londres sobre a folha do caderno:
  - iluminação 3 pontos + IBL procedural (RoomEnvironment via PMREMGenerator) +
    luz dinâmica que desliza com física de mola até o prédio em foco;
  - shaders GLSL próprios: trilha luminosa pulsante em tubo 3D, anel de
    radar/pulso no chão sob a próxima parada e no hover, e partículas
    atmosféricas sutis (tier alto);
  - física de mola real (oscilador harmônico amortecido) para pop-up dos
    prédios, elevação no hover/clique e rotação/inclinação da câmera;
  - micro-animações vivas por prédio (radar, vapor do café, fumaça, bandeira,
    ônibus, balões) + aviãozinho de papel com rastro suave;
  - laço sob demanda com IntersectionObserver e visibilitychange.
*/
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { criarAmbienteEstudio } from "../cena3d/estudio";
import { Compass, RotateCcw } from "lucide-react";
import { buildLandmark } from "./predios";
import { aoCutucar } from "../pets/bus";

export type StopState = "locked" | "open" | "next" | "done";
export type CityStop = { id: string; emoji: string; label: string; place: string; color: string; state: StopState };

const SPOTS: Array<[number, number]> = [
  [-5.3, 1.45],
  [-3.7, -1.25],
  [-2.0, 1.3],
  [-0.4, -1.3],
  [1.25, 1.25],
  [2.85, -1.25],
  [4.35, 1.15],
  [5.7, -1.0],
];

/** Oscilador harmônico amortecido (física de mola). */
class Spring {
  value: number;
  velocity = 0;
  target: number;

  constructor(
    initial: number,
    private readonly stiffness = 220,
    private readonly damping = 20,
  ) {
    this.value = initial;
    this.target = initial;
  }

  step(dt: number): boolean {
    const force = -this.stiffness * (this.value - this.target);
    const damp = -this.damping * this.velocity;
    this.velocity += (force + damp) * dt;
    this.value += this.velocity * dt;
    if (Math.abs(this.value - this.target) < 0.0006 && Math.abs(this.velocity) < 0.0006) {
      this.value = this.target;
      this.velocity = 0;
      return false;
    }
    return true;
  }
}

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.userData.redraw = () => {
    ctx.clearRect(0, 0, width, height);
    draw(ctx);
    texture.needsUpdate = true;
  };
  return texture;
}

/** A folha pautada com margem vermelha e gradiente suave, nos dois temas do caderno. */
function pageTexture(dark: boolean) {
  return canvasTexture(2048, 1500, (ctx) => {
    const grad = ctx.createRadialGradient(1024, 680, 140, 1024, 720, 1280);
    if (dark) {
      grad.addColorStop(0, "#1d253b");
      grad.addColorStop(0.65, "#151b2c");
      grad.addColorStop(1, "#0f1422");
    } else {
      grad.addColorStop(0, "#fcfdff");
      grad.addColorStop(0.7, "#f5f8fc");
      grad.addColorStop(1, "#eaeff7");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2048, 1500);

    // linhas pautadas suaves
    ctx.strokeStyle = dark ? "rgba(102,126,184,.28)" : "rgba(150,178,215,.62)";
    ctx.lineWidth = 2.5;
    for (let y = 70; y < 1500; y += 54) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(2048, y);
      ctx.stroke();
    }

    // margem vermelha de caderno
    ctx.strokeStyle = dark ? "rgba(255,107,111,.48)" : "rgba(229,72,77,.62)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(154, 0);
    ctx.lineTo(154, 1500);
    ctx.stroke();

    // rosa dos ventos desenhada à caneta no canto superior direito
    ctx.strokeStyle = dark ? "rgba(147,163,255,.55)" : "rgba(29,43,184,.5)";
    ctx.lineWidth = 4.5;
    ctx.lineCap = "round";
    const cx = 1865;
    const cy = 190;
    ctx.beginPath();
    ctx.arc(cx, cy, 68, 0, Math.PI * 2);
    ctx.moveTo(cx, cy - 106);
    ctx.lineTo(cx, cy + 106);
    ctx.moveTo(cx - 106, cy);
    ctx.lineTo(cx + 106, cy);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.font = "62px 'Gochi Hand', cursive";
    ctx.textAlign = "center";
    ctx.fillText("N", cx, cy - 120);

    // título manuscrito posicionado com folga acima da barra inferior
    ctx.fillStyle = dark ? "rgba(162,178,255,.72)" : "rgba(29,43,184,.65)";
    ctx.font = "76px 'Gochi Hand', cursive";
    ctx.textAlign = "left";
    ctx.fillText("London ~ my exchange trip", 220, 1175);
  });
}

/** Placa da parada: figurinha + nome em inglês + destaque de estado. */
function signTexture(stop: CityStop, dark: boolean) {
  return canvasTexture(512, 208, (ctx) => {
    const locked = stop.state === "locked";
    const isNext = stop.state === "next";
    const isDone = stop.state === "done";

    ctx.fillStyle = dark ? (locked ? "rgba(28,36,56,.92)" : "#1f2940") : "#ffffff";
    ctx.beginPath();
    ctx.roundRect(8, 8, 496, 192, 28);
    ctx.fill();

    // faixa colorida sutil no topo da placa desbloqueada
    if (!locked) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(8, 8, 496, 192, 28);
      ctx.clip();
      ctx.fillStyle = isNext ? "#2fd483" : stop.color;
      ctx.fillRect(8, 8, 496, 12);
      ctx.restore();
    }

    ctx.lineWidth = isNext ? 7 : 5.5;
    ctx.strokeStyle = locked
      ? dark
        ? "rgba(120,136,172,.55)"
        : "rgba(120,130,150,.65)"
      : isNext
        ? "#2fd483"
        : isDone
          ? "#f4b942"
          : dark
            ? "#93a3ff"
            : "#1d2bb8";
    ctx.stroke();

    ctx.globalAlpha = locked ? 0.58 : 1;
    ctx.font = "88px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(locked ? "🔒" : stop.emoji, 34, 110);

    ctx.fillStyle = dark ? "#eef2fb" : "#16181d";
    ctx.font = "62px 'Gochi Hand', cursive";
    ctx.fillText(stop.label, 154, 96, 330);

    ctx.font = "34px 'Patrick Hand', cursive";
    ctx.fillStyle = dark ? "#a8b4ce" : "#5a6272";
    ctx.fillText(stop.place, 156, 154, 330);
    ctx.globalAlpha = 1;
  });
}

function stampTexture() {
  return canvasTexture(256, 160, (ctx) => {
    ctx.fillStyle = "#fffaf0";
    ctx.fillRect(0, 0, 256, 160);
    ctx.strokeStyle = "#d9363e";
    ctx.fillStyle = "#d9363e";
    ctx.lineWidth = 8;
    ctx.strokeRect(14, 14, 228, 132);
    ctx.font = "bold 58px 'Anybody Variable', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("OK!", 128, 82);
  });
}

/** Shader GLSL do tubo de rota luminosa tracejada com pulso animado. */
function createRouteMaterial(dark: boolean, progressRatio: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uDraw: { value: 0 },
      uProgress: { value: progressRatio },
      uActiveColor: { value: new THREE.Color(dark ? 0x62f2b0 : 0x1d2bb8) },
      uPulseColor: { value: new THREE.Color(dark ? 0xb7a6ff : 0x5c73ff) },
      uLockedColor: { value: new THREE.Color(dark ? 0x566894 : 0x9aa8c4) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDraw;
      uniform float uProgress;
      uniform vec3 uActiveColor;
      uniform vec3 uPulseColor;
      uniform vec3 uLockedColor;
      varying vec2 vUv;

      void main() {
        if (vUv.x > uDraw) discard;

        float dash = step(0.36, fract(vUv.x * 46.0 - uTime * 0.45));
        float isUnlocked = 1.0 - smoothstep(uProgress - 0.04, uProgress + 0.04, vUv.x);

        // pulso de energia correndo pelo trecho ativo
        float pulsePos = fract(uTime * 0.28) * max(0.18, uProgress);
        float pulse = exp(-pow((vUv.x - pulsePos) * 14.0, 2.0)) * isUnlocked;

        vec3 baseCol = mix(uLockedColor, uActiveColor, isUnlocked);
        vec3 color = mix(baseCol, uPulseColor, pulse * 0.85) + vec3(0.35) * pulse;
        float alpha = mix(0.32, 0.92, isUnlocked) * mix(0.18, 1.0, dash);
        alpha = max(alpha, pulse * 0.95);

        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}

/** Shader GLSL de anel pulsante no chão (próxima parada e hover). */
function createBeaconMaterial(hex: number, speed = 1.35) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uColor: { value: new THREE.Color(hex) },
      uSpeed: { value: speed },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uColor;
      uniform float uSpeed;
      varying vec2 vUv;

      void main() {
        float dist = length(vUv - vec2(0.5)) * 2.0;
        if (dist > 1.0) discard;

        float core = exp(-dist * dist * 5.2) * 0.38;
        float wave1 = fract(uTime * uSpeed * 0.45);
        float wave2 = fract(uTime * uSpeed * 0.45 + 0.5);

        float ring1 = smoothstep(0.06, 0.0, abs(dist - wave1)) * (1.0 - wave1);
        float ring2 = smoothstep(0.055, 0.0, abs(dist - wave2)) * (1.0 - wave2);
        float rim = smoothstep(0.05, 0.0, abs(dist - 0.72)) * 0.35;

        float strength = (core + ring1 * 0.8 + ring2 * 0.65 + rim) * uOpacity;
        gl_FragColor = vec4(uColor, clamp(strength, 0.0, 0.9));
      }
    `,
  });
}

/** Partículas atmosféricas suaves com GLSL (tier alto). */
function createAmbientParticles(dark: boolean, track: <T extends { dispose: () => void }>(item: T) => T) {
  const count = 88;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 14.5;
    positions[i * 3 + 1] = 0.45 + Math.random() * 3.4;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 7.2;
    seeds[i] = Math.random() * Math.PI * 2;
  }
  const geometry = track(new THREE.BufferGeometry());
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

  const material = track(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColorA: { value: new THREE.Color(dark ? 0x93a3ff : 0x5c73ff) },
        uColorB: { value: new THREE.Color(dark ? 0x62f2b0 : 0xf4b942) },
        uAlpha: { value: dark ? 0.52 : 0.28 },
      },
      vertexShader: `
        attribute float aSeed;
        uniform float uTime;
        varying float vMix;
        varying float vTwinkle;
        void main() {
          vec3 pos = position;
          pos.y += sin(uTime * 0.65 + aSeed) * 0.22;
          pos.x += cos(uTime * 0.35 + aSeed * 1.3) * 0.18;
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = (24.0 + 12.0 * sin(uTime + aSeed)) / -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
          vMix = 0.5 + 0.5 * sin(aSeed * 3.0);
          vTwinkle = 0.45 + 0.55 * sin(uTime * 1.6 + aSeed * 2.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform float uAlpha;
        varying float vMix;
        varying float vTwinkle;
        void main() {
          float d = distance(gl_PointCoord, vec2(0.5));
          float strength = pow(clamp(1.0 - d * 2.0, 0.0, 1.0), 2.5);
          vec3 col = mix(uColorA, uColorB, vMix);
          gl_FragColor = vec4(col, strength * vTwinkle * uAlpha);
        }
      `,
    }),
  );

  return { points: new THREE.Points(geometry, material), material };
}

type Building = {
  id: string;
  x: number;
  z: number;
  height: number;
  hinge: THREE.Group;
  sign: THREE.Mesh;
  popSpring: Spring;
  liftSpring: Spring;
  target: number;
  delay: number;
  state: StopState;
  update?: (elapsed: number, dt: number) => void;
};

export default function CidadePopUp({
  stops,
  onSelect,
  quality,
  focusId,
}: {
  stops: CityStop[];
  onSelect: (id: string) => void;
  quality: "medium" | "high";
  focusId?: string | null;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const tip = useRef<HTMLDivElement | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const focusRef = useRef<(id: string | null | undefined) => void>(() => undefined);
  const resetCamRef = useRef<() => void>(() => undefined);
  const [ready, setReady] = useState(false);
  const [hoveredTip, setHoveredTip] = useState<{ emoji: string; label: string; place: string; state: StopState } | null>(null);

  const stopsKey = stops.map((stop) => `${stop.id}:${stop.state}`).join("|");
  const nextStopId = stops.find((stop) => stop.state === "next")?.id ?? stops[0]?.id ?? null;

  // as texturas são desenhadas com as cores do tema: trocar de tema refaz a cena
  const [themeKey, setThemeKey] = useState(() => document.documentElement.classList.contains("theme-light"));
  useEffect(() => {
    const observer = new MutationObserver(() => setThemeKey(document.documentElement.classList.contains("theme-light")));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let disposed = false;
    const dark = !document.documentElement.classList.contains("theme-light");
    const high = quality === "high";

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 2 : 1.5));
    renderer.shadowMap.enabled = high;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = dark ? 1.18 : 1.12;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(dark ? 0x111625 : 0xeef3fa, dark ? 0.024 : 0.014);

    // IBL de estúdio HDR procedural (dá brilho real em vidro e metal dos prédios)
    const envTarget = criarAmbienteEstudio(renderer, { acento: 0x7ca2ff, modo: dark ? "escuro" : "claro", sigma: 0.024 });
    scene.environment = envTarget;
    scene.environmentIntensity = dark ? 0.68 : 0.82;

    const camera = new THREE.PerspectiveCamera(32, 2, 0.1, 100);
    const baseCamPos = new THREE.Vector3(0, 7.8, 11.4);
    camera.position.copy(baseCamPos);
    camera.lookAt(0, 0.1, 0.65);

    // Iluminação 3 pontos (Hemisphere + Key Sun + Rim Light) + Accent dinâmico
    scene.add(new THREE.HemisphereLight(dark ? 0x9ab0ff : 0xffffff, dark ? 0x171d30 : 0xc8d2e0, dark ? 1.05 : 1.45));

    const sun = new THREE.DirectionalLight(dark ? 0xffe9cc : 0xfff5e4, dark ? 1.75 : 2.1);
    sun.position.set(-5.5, 9.5, 6.2);
    sun.castShadow = high;
    sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
    sun.shadow.camera.left = -9;
    sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 6;
    sun.shadow.camera.bottom = -6;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 28;
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.025;
    scene.add(sun);

    // luz de recorte (rim light) atrás-direita para dar profundidade às silhuetas
    const rimLight = new THREE.DirectionalLight(dark ? 0x7c93ff : 0xdbe6ff, dark ? 0.95 : 0.55);
    rimLight.position.set(7, 5, -6);
    scene.add(rimLight);

    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(item: T) => {
      disposables.push(item);
      return item;
    };
    disposables.push(envTarget);

    const world = new THREE.Group();
    scene.add(world);

    // luz de destaque dinâmica que desliza com mola sobre o prédio em foco
    const focusLight = new THREE.PointLight(dark ? 0x7ef2c2 : 0xfff3d4, dark ? 2.4 : 0.9, 6.5, 1.6);
    focusLight.position.set(SPOTS[0][0], 2.2, SPOTS[0][1]);
    world.add(focusLight);
    const lightX = new Spring(SPOTS[0][0], 110, 16);
    const lightZ = new Spring(SPOTS[0][1], 110, 16);

    const page = new THREE.Mesh(
      track(new THREE.PlaneGeometry(16, 11.6)),
      track(new THREE.MeshStandardMaterial({ map: track(pageTexture(dark)), roughness: 0.92, metalness: 0.02 })),
    );
    page.rotation.x = -Math.PI / 2;
    page.position.z = 1.1;
    page.receiveShadow = true;
    world.add(page);

    // ── trilha luminosa em tubo 3D com shader GLSL ──
    const activeIndex = Math.max(
      0,
      stops.findIndex((s) => s.state === "next"),
    );
    const progressRatio = stops.length > 1 ? Math.min(1, (activeIndex + 0.15) / (stops.length - 1)) : 1;
    const curve = new THREE.CatmullRomCurve3(
      SPOTS.slice(0, stops.length).map(([x, z]) => new THREE.Vector3(x, 0.026, z + 0.72)),
    );
    const routeGeo = track(new THREE.TubeGeometry(curve, 220, 0.036, 8, false));
    const routeMat = track(createRouteMaterial(dark, progressRatio));
    const routeMesh = new THREE.Mesh(routeGeo, routeMat);
    world.add(routeMesh);
    let pathDrawn = 0;

    // ── anel de hover (shader GLSL) ──
    const hoverBeaconMat = track(createBeaconMaterial(dark ? 0x93a3ff : 0x3f54e8, 1.5));
    hoverBeaconMat.uniforms.uOpacity.value = 0;
    const hoverBeacon = new THREE.Mesh(track(new THREE.PlaneGeometry(2.25, 2.25)), hoverBeaconMat);
    hoverBeacon.rotation.x = -Math.PI / 2;
    hoverBeacon.position.y = 0.018;
    world.add(hoverBeacon);
    const hoverBeaconOpacity = new Spring(0, 180, 22);

    // ── prédios ──
    const buildings: Building[] = [];
    const hitTargets: THREE.Object3D[] = [];
    const signGeometry = track(new THREE.PlaneGeometry(1.52, 0.616));
    const stamp = track(stampTexture());
    let pin: THREE.Group | null = null;
    let pinBase = 0;
    let nextBeaconMat: THREE.ShaderMaterial | null = null;
    let nextSpotCoords: [number, number] = SPOTS[0];

    stops.forEach((stop, index) => {
      const [x, z] = SPOTS[index % SPOTS.length];
      const locked = stop.state === "locked";
      const anchor = new THREE.Group();
      anchor.position.set(x, 0, z);
      world.add(anchor);

      // a dobra fica na base de trás: o prédio se ergue da folha como livro pop-up
      const hinge = new THREE.Group();
      hinge.position.z = -0.45;
      anchor.add(hinge);

      const landmark = buildLandmark(stop.id, { color: stop.color, locked, dark, shadows: high, track });
      const height = landmark.height;
      hinge.add(landmark.group);
      if (locked) hinge.scale.z = 0.18;

      const sign = new THREE.Mesh(
        signGeometry,
        track(
          new THREE.MeshStandardMaterial({
            map: track(signTexture(stop, dark)),
            roughness: 0.72,
            metalness: 0.05,
            transparent: true,
          }),
        ),
      );
      sign.position.set(0, 0.34, 0.8);
      sign.rotation.x = -0.22;
      anchor.add(sign);

      if (stop.state === "done") {
        const pole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.02, 0.02, 0.72, 8)), track(new THREE.MeshStandardMaterial({ color: 0x16181d, metalness: 0.4 })));
        pole.position.set(-0.78, 0.36, 0.12);
        hinge.add(pole);
        const flag = new THREE.Mesh(track(new THREE.PlaneGeometry(0.46, 0.29)), track(new THREE.MeshStandardMaterial({ map: stamp, side: THREE.DoubleSide })));
        flag.position.set(-0.55, 0.56, 0.12);
        hinge.add(flag);
      }

      if (stop.state === "next") {
        nextSpotCoords = [x, z];
        lightX.value = x;
        lightX.target = x;
        lightZ.value = z;
        lightZ.target = z;

        // anel pulsante luminoso no chão da próxima parada
        nextBeaconMat = track(createBeaconMaterial(dark ? 0x2fd483 : 0x16a34a, 1.15));
        const nextBeacon = new THREE.Mesh(track(new THREE.PlaneGeometry(2.55, 2.55)), nextBeaconMat);
        nextBeacon.rotation.x = -Math.PI / 2;
        nextBeacon.position.set(x, 0.015, z + 0.05);
        world.add(nextBeacon);

        // alfinete flutuante centralizado sobre o prédio da próxima parada
        pin = new THREE.Group();
        const head = new THREE.Mesh(
          track(new THREE.SphereGeometry(0.15, 20, 16)),
          track(
            new THREE.MeshStandardMaterial({
              color: dark ? 0x3ef098 : 0x22b86d,
              emissive: 0x146e42,
              emissiveIntensity: dark ? 1.1 : 0.45,
              roughness: 0.22,
              metalness: 0.15,
            }),
          ),
        );
        const ring = new THREE.Mesh(
          track(new THREE.TorusGeometry(0.21, 0.018, 10, 24)),
          track(
            new THREE.MeshStandardMaterial({
              color: 0xa7ffd2,
              emissive: 0x2fd483,
              emissiveIntensity: 0.9,
              roughness: 0.3,
            }),
          ),
        );
        ring.rotation.x = Math.PI / 2;
        const needle = new THREE.Mesh(
          track(new THREE.ConeGeometry(0.052, 0.36, 12)),
          track(new THREE.MeshStandardMaterial({ color: 0xc2ccdf, metalness: 0.75, roughness: 0.2 })),
        );
        needle.rotation.x = Math.PI;
        needle.position.y = -0.24;
        pin.add(head, ring, needle);
        pinBase = height + 0.78;
        pin.position.set(x, pinBase, z);
        world.add(pin);
      }

      landmark.group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.userData.stop = index;
          hitTargets.push(child);
        }
      });
      sign.userData.stop = index;
      hitTargets.push(sign);

      buildings.push({
        id: stop.id,
        x,
        z,
        height,
        hinge,
        sign,
        popSpring: new Spring(0, 155, 13.5),
        liftSpring: new Spring(0, 280, 19),
        target: locked ? 0.04 : 1,
        delay: 0.18 + index * 0.1,
        state: stop.state,
        update: landmark.update,
      });
      hinge.rotation.x = -Math.PI / 2;
    });

    // ── partículas atmosféricas + aviãozinho de papel com rastro (tier alto) ──
    const ambient = high ? createAmbientParticles(dark, track) : null;
    if (ambient) world.add(ambient.points);

    let plane: THREE.Mesh | null = null;
    const trailCount = 22;
    const trailPositions = new Float32Array(trailCount * 3);
    let trailGeo: THREE.BufferGeometry | null = null;
    let trailHead = 0;
    let trailTimer = 0;

    if (high) {
      const shape = new THREE.BufferGeometry();
      shape.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [
            0, 0, 0.48, -0.3, 0, -0.28, 0, 0.04, -0.18,
            0, 0, 0.48, 0.3, 0, -0.28, 0, 0.04, -0.18,
            0, 0, 0.48, 0, 0.04, -0.18, 0, -0.12, -0.22,
          ],
          3,
        ),
      );
      shape.computeVertexNormals();
      plane = new THREE.Mesh(
        track(shape),
        track(
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: dark ? 0x303b66 : 0x000000,
            emissiveIntensity: 0.45,
            side: THREE.DoubleSide,
            roughness: 0.55,
          }),
        ),
      );
      plane.castShadow = true;
      world.add(plane);

      trailGeo = track(new THREE.BufferGeometry());
      for (let i = 0; i < trailCount; i += 1) {
        trailPositions[i * 3] = 999;
        trailPositions[i * 3 + 1] = 999;
        trailPositions[i * 3 + 2] = 999;
      }
      trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
      const trailMat = track(
        new THREE.PointsMaterial({
          color: dark ? 0x93a3ff : 0x3b4ee8,
          size: 0.09,
          transparent: true,
          opacity: dark ? 0.55 : 0.35,
          depthWrite: false,
        }),
      );
      world.add(new THREE.Points(trailGeo, trailMat));
    }

    // ── interação com física de mola ──
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(9, 9);
    let pointerInside = false;
    let hovered: Building | null = null;
    const yawSpring = new Spring(0, 115, 16);
    const pitchSpring = new Spring(0, 115, 16);
    const tiltSpring = new Spring(0, 95, 14);
    let drag: { x: number; y: number; yaw: number; pitch: number; moved: boolean } | null = null;

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.fov = camera.aspect < 1.9 ? 32 * (1.9 / camera.aspect) ** 0.62 : 32;
      camera.updateProjectionMatrix();
      wake();
    };

    const setPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      if (tip.current) {
        const tx = Math.min(rect.width - 190, Math.max(12, event.clientX - rect.left + 16));
        const ty = Math.min(rect.height - 64, Math.max(12, event.clientY - rect.top - 14));
        tip.current.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
      }
    };

    const onDown = (event: PointerEvent) => {
      drag = { x: event.clientX, y: event.clientY, yaw: yawSpring.target, pitch: pitchSpring.target, moved: false };
      canvas.style.cursor = "grabbing";
    };

    const onMove = (event: PointerEvent) => {
      setPointer(event);
      pointerInside = true;
      tiltSpring.target = pointer.x * 0.055;
      if (drag) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) drag.moved = true;
        yawSpring.target = THREE.MathUtils.clamp(drag.yaw + dx * 0.0042, -0.58, 0.58);
        pitchSpring.target = THREE.MathUtils.clamp(drag.pitch + dy * 0.0022, -0.14, 0.16);
      }
      wake();
    };

    const onUp = () => {
      const wasDrag = drag?.moved;
      drag = null;
      canvas.style.cursor = hovered ? "pointer" : "grab";
      if (wasDrag || !hovered) return;
      if (hovered.state === "locked") {
        hovered.liftSpring.velocity = -2.2; // tremidinha física de parada fechada
        wake();
      } else {
        hovered.liftSpring.velocity = 5.4; // salto de mola ao abrir
        wake();
      }
      const id = hovered.id;
      window.setTimeout(() => selectRef.current(id), 170);
    };

    const onLeave = () => {
      pointerInside = false;
      drag = null;
      pointer.set(9, 9);
      tiltSpring.target = 0;
      canvas.style.cursor = "grab";
      wake();
    };

    const canvas = renderer.domElement;
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onLeave);

    // a Mine (pets) pulou ou chutou perto: o prédio mais próximo dela salta com mola
    const projetado = new THREE.Vector3();
    const pararMine = aoCutucar((c) => {
      const rect = canvas.getBoundingClientRect();
      if (c.x < rect.left - 60 || c.x > rect.right + 60 || c.y < rect.top - 140 || c.y > rect.bottom + 140 || drag) return;
      const nx = ((c.x - rect.left) / rect.width) * 2 - 1;
      let melhor: Building | null = null;
      let dist = 0.35;
      for (const building of buildings) {
        building.hinge.getWorldPosition(projetado).project(camera);
        const d = Math.abs(projetado.x - nx);
        if (d < dist) {
          dist = d;
          melhor = building;
        }
      }
      if (melhor) melhor.liftSpring.velocity = Math.max(melhor.liftSpring.velocity, 3.8 + 2.4 * Math.min(1, c.forca));
      if (!pointerInside) {
        tiltSpring.target = THREE.MathUtils.clamp(nx, -1, 1) * 0.06 * Math.min(1, c.forca + 0.3);
        window.setTimeout(() => {
          if (!disposed && !pointerInside) {
            tiltSpring.target = 0;
            wake();
          }
        }, 1400);
      }
      wake();
    });

    focusRef.current = (id) => {
      const index = stops.findIndex((stop) => stop.id === id);
      if (index < 0) return;
      yawSpring.target = THREE.MathUtils.clamp(-SPOTS[index][0] * 0.058, -0.45, 0.45);
      pitchSpring.target = 0.03;
      buildings[index].liftSpring.velocity = 5.2;
      lightX.target = SPOTS[index][0];
      lightZ.target = SPOTS[index][1];
      wake();
    };

    resetCamRef.current = () => {
      yawSpring.target = 0;
      pitchSpring.target = 0;
      tiltSpring.target = 0;
      lightX.target = nextSpotCoords[0];
      lightZ.target = nextSpotCoords[1];
      wake();
    };

    // ── laço sob demanda ──
    let raf = 0;
    let frames = 0;
    let visible = true;
    const start = performance.now();
    const clock = new THREE.Clock();
    const planePos = new THREE.Vector3();
    const planeAhead = new THREE.Vector3();

    function wake() {
      frames = Math.max(frames, 90);
      if (!raf && visible && !disposed) raf = requestAnimationFrame(tick);
    }

    function tick() {
      raf = 0;
      const dt = Math.min(0.04, clock.getDelta());
      const elapsed = (performance.now() - start) / 1000;
      let moving = false;

      // shaders contínuos
      routeMat.uniforms.uTime.value = elapsed;
      if (pathDrawn < 1) {
        pathDrawn = Math.min(1, pathDrawn + dt * 0.62);
        routeMat.uniforms.uDraw.value = pathDrawn;
        moving = true;
      }
      if (nextBeaconMat) {
        nextBeaconMat.uniforms.uTime.value = elapsed;
        moving = true;
      }
      hoverBeaconMat.uniforms.uTime.value = elapsed;
      if (ambient) {
        ambient.material.uniforms.uTime.value = elapsed;
        moving = true;
      }

      // hover via raycaster
      raycaster.setFromCamera(pointer, camera);
      const hit = pointerInside ? raycaster.intersectObjects(hitTargets, false)[0] : undefined;
      const next = hit ? buildings[hit.object.userData.stop as number] : null;
      if (next !== hovered) {
        hovered = next;
        canvas.style.cursor = hovered ? "pointer" : drag ? "grabbing" : "grab";
        if (hovered) {
          const stop = stops.find((item) => item.id === hovered!.id) || null;
          setHoveredTip(stop ? { emoji: stop.emoji, label: stop.label, place: stop.place, state: stop.state } : null);
          hoverBeacon.position.set(hovered.x, 0.018, hovered.z + 0.05);
          hoverBeaconOpacity.target = hovered.state === "locked" ? 0.45 : 1;
          lightX.target = hovered.x;
          lightZ.target = hovered.z;
        } else {
          setHoveredTip(null);
          hoverBeaconOpacity.target = 0;
          lightX.target = nextSpotCoords[0];
          lightZ.target = nextSpotCoords[1];
        }
      }

      if (hoverBeaconOpacity.step(dt)) moving = true;
      hoverBeaconMat.uniforms.uOpacity.value = hoverBeaconOpacity.value;

      if (lightX.step(dt)) moving = true;
      if (lightZ.step(dt)) moving = true;
      focusLight.position.set(lightX.value, 2.1 + Math.sin(elapsed * 2) * 0.1, lightZ.value + 0.35);

      for (const building of buildings) {
        if (elapsed > building.delay) {
          building.popSpring.target = building.target;
          if (building.popSpring.step(dt)) moving = true;
        } else {
          moving = true;
        }
        // dobra pop-up controlada diretamente pela mola real (overshoot natural!)
        building.hinge.rotation.x = (-Math.PI / 2) * (1 - building.popSpring.value);

        building.liftSpring.target = hovered === building ? (building.state === "locked" ? 0.06 : 0.24) : 0;
        if (building.liftSpring.step(dt)) moving = true;
        building.hinge.position.y = Math.max(-0.08, building.liftSpring.value);
        // placa acompanha suavemente o hover
        building.sign.position.y = 0.34 + Math.max(0, building.liftSpring.value) * 0.35;

        if (building.update) {
          building.update(elapsed, dt);
          moving = true;
        }
      }

      if (yawSpring.step(dt)) moving = true;
      if (pitchSpring.step(dt)) moving = true;
      if (tiltSpring.step(dt)) moving = true;
      world.rotation.y = yawSpring.value;
      world.rotation.x = pitchSpring.value;
      world.rotation.z = -tiltSpring.value * 0.32;

      if (pin) {
        pin.position.y = pinBase + Math.sin(elapsed * 2.5) * 0.11;
        pin.rotation.y = elapsed * 1.3;
        moving = true;
      }

      if (plane && trailGeo) {
        const t = elapsed * 0.13;
        const angle = t * Math.PI * 2;
        const aheadAngle = (t + 0.012) * Math.PI * 2;
        planePos.set(Math.cos(angle) * 5.6, 1.95 + Math.sin(angle * 2) * 0.24, Math.sin(angle) * 2.65);
        planeAhead.set(Math.cos(aheadAngle) * 5.6, 1.95 + Math.sin(aheadAngle * 2) * 0.24, Math.sin(aheadAngle) * 2.65);
        plane.position.copy(planePos);
        plane.lookAt(planeAhead);
        plane.rotateZ(-0.32);

        trailTimer += dt;
        if (trailTimer > 0.075) {
          trailTimer = 0;
          trailPositions[trailHead * 3] = planePos.x;
          trailPositions[trailHead * 3 + 1] = planePos.y;
          trailPositions[trailHead * 3 + 2] = planePos.z;
          trailHead = (trailHead + 1) % trailCount;
          trailGeo.attributes.position.needsUpdate = true;
        }
        moving = true;
      }

      renderer.render(scene, camera);
      frames -= 1;
      if ((moving || frames > 0) && visible && !disposed) raf = requestAnimationFrame(tick);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && document.visibilityState === "visible";
      if (visible) wake();
    });
    io.observe(container);
    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      if (visible) wake();
    };
    document.addEventListener("visibilitychange", onVisibility);

    document.fonts?.ready.then(() => {
      if (disposed) return;
      disposables.forEach((item) => (item as unknown as THREE.Texture).userData?.redraw?.());
      setReady(true);
      wake();
    });
    canvas.style.cursor = "grab";
    resize();
    wake();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      pararMine();
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
    // a cena é refeita quando o estado das paradas muda (volta de uma lição)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopsKey, quality, themeKey]);

  useEffect(() => {
    focusRef.current(focusId);
  }, [focusId]);

  return (
    <div className={`idi-city3d ${ready ? "is-ready" : ""}`}>
      <div ref={host} className="idi-city3d-canvas" />
      <div className="idi-city3d-controls">
        {nextStopId ? (
          <button
            type="button"
            className="idi-cam-btn"
            onClick={() => focusRef.current(nextStopId)}
            title="Focar na próxima parada"
          >
            <Compass className="h-3.5 w-3.5" /> Próxima
          </button>
        ) : null}
        <button
          type="button"
          className="idi-cam-btn"
          onClick={() => resetCamRef.current()}
          title="Centralizar mapa 3D"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Centralizar
        </button>
      </div>
      <div ref={tip} className={`idi-city3d-tip ${hoveredTip ? "is-on" : ""}`} aria-hidden>
        {hoveredTip ? (
          <>
            <span className="idi-tip-emoji">{hoveredTip.state === "locked" ? "🔒" : hoveredTip.emoji}</span>
            <span className="idi-tip-copy">
              <strong>{hoveredTip.label}</strong>
              <small>
                {hoveredTip.place} ·{" "}
                {hoveredTip.state === "locked" ? "ainda fechada" : hoveredTip.state === "done" ? "carimbada ✓" : "abrir parada"}
              </small>
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
