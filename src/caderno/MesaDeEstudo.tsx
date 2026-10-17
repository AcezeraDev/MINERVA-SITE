/*
  Mesa de estudo em WebGL (three.js), a abertura da Home no computador.

  A mesa é o atalho do dia: cada objeto leva a um lugar do site.
  - cadernos empilhados = as três matérias mais urgentes (abrem a matéria)
  - planner = Plano de estudos · lápis = Foco · celular = Mine · lupa = Busca
  - luminária: clicar apaga e acende; a luz segue o ponteiro pela mesa.

  Tudo é feito de primitivas e texturas desenhadas em <canvas> na hora (sem
  modelo para baixar). O chunk só é carregado no computador, fora do tier
  baixo e sem movimento reduzido; quem decide é a Home. Custo:
  - render sob demanda: o laço só roda enquanto há algo mudando (queda
    inicial, hover, luz andando) e para fora da tela ou com a aba escondida;
  - DPR limitado a 1.5, uma luz com sombra (1024²);
  - o canvas é cenário (aria-hidden): os mesmos destinos existem como
    botões de verdade logo abaixo, para teclado e leitor de tela.
*/
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
// o CSS (caderno-mesa.css) vem no pacote principal: o espaço da mesa
// precisa ter altura antes deste pedaço carregar

export type MesaAction = { kind: "mine" | "plan" | "foco" | "search" } | { kind: "subject"; id: string };

export type MesaSubject = { id: string; name: string; color: string };

type Interactive = {
  root: THREE.Object3D;
  rest: THREE.Vector3;
  restRot: number;
  label: string;
  action: MesaAction | "lamp";
  drop: number; // atraso da queda inicial (s)
  lift: number;
  box: THREE.Box3; // caixa na posição de repouso, um pouco mais alta (cobre o objeto erguido)
};

const INK = "#161a22";

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void, hasText = true) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  // texto desenhado antes de a fonte carregar sai na letra do sistema:
  // a cena chama isto de novo quando document.fonts fica pronto
  if (hasText) {
    texture.userData.redraw = () => {
      ctx.clearRect(0, 0, width, height);
      draw(ctx);
      texture.needsUpdate = true;
    };
  }
  return texture;
}

function woodTexture(dark: boolean) {
  return canvasTexture(1024, 512, (ctx) => {
    ctx.fillStyle = dark ? "#3a2a20" : "#d8b78a";
    ctx.fillRect(0, 0, 1024, 512);
    // veios: linhas longas e onduladas, cada tábua com um tom
    for (let plank = 0; plank < 4; plank += 1) {
      ctx.fillStyle = dark ? `rgba(0,0,0,${0.06 + plank * 0.03})` : `rgba(120,70,30,${0.04 + (plank % 2) * 0.05})`;
      ctx.fillRect(0, plank * 128, 1024, 128);
      ctx.fillStyle = dark ? "rgba(0,0,0,.45)" : "rgba(90,50,20,.35)";
      ctx.fillRect(0, plank * 128, 1024, 2);
    }
    for (let line = 0; line < 140; line += 1) {
      const y = Math.random() * 512;
      ctx.strokeStyle = dark ? `rgba(255,220,180,${Math.random() * 0.05})` : `rgba(110,60,25,${0.05 + Math.random() * 0.1})`;
      ctx.lineWidth = 0.6 + Math.random() * 1.6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 1024; x += 32) ctx.lineTo(x, y + Math.sin(x / (60 + line)) * 5 + Math.sin(x / 13) * 0.8);
      ctx.stroke();
    }
  }, false);
}

function notebookCover(subject: MesaSubject) {
  return canvasTexture(512, 660, (ctx) => {
    ctx.fillStyle = subject.color;
    ctx.fillRect(0, 0, 512, 660);
    // faixa da lombada
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.fillRect(0, 0, 54, 660);
    // etiqueta de papel
    ctx.fillStyle = "#fffdf6";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(110, 210, 340, 180, 18);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(29,43,184,.25)";
    ctx.lineWidth = 3;
    for (let y = 270; y < 380; y += 40) {
      ctx.beginPath();
      ctx.moveTo(130, y);
      ctx.lineTo(430, y);
      ctx.stroke();
    }
    ctx.fillStyle = "#1d2bb8";
    ctx.font = '64px "Gochi Hand", cursive';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const name = subject.name.length > 12 ? `${subject.name.slice(0, 11)}…` : subject.name;
    ctx.fillText(name, 280, 300);
  });
}

function plannerCover() {
  return canvasTexture(512, 640, (ctx) => {
    ctx.fillStyle = "#2f49d1";
    ctx.fillRect(0, 0, 512, 640);
    ctx.fillStyle = "#fffdf6";
    ctx.font = '70px "Gochi Hand", cursive';
    ctx.textAlign = "center";
    ctx.fillText("meu plano", 256, 130);
    // grade de calendário
    ctx.strokeStyle = "rgba(255,255,255,.7)";
    ctx.lineWidth = 4;
    const x0 = 76;
    const y0 = 200;
    const cell = 52;
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 7; col += 1) {
        ctx.strokeRect(x0 + col * cell, y0 + row * cell, cell, cell);
      }
    }
    ctx.fillStyle = "#f7ee6b";
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x0 + 3 * cell + 4, y0 + 2 * cell + 4, cell - 8, cell - 8);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#ff5a5f";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(x0 + 5.5 * cell, y0 + 3.5 * cell, 30, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function phoneScreen() {
  return canvasTexture(360, 720, (ctx) => {
    const grd = ctx.createLinearGradient(0, 0, 0, 720);
    grd.addColorStop(0, "#eef2ff");
    grd.addColorStop(1, "#dfe7ff");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 360, 720);
    // a Mine: cabeça de robô, olhos e sorriso
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8;
    ctx.fillStyle = "#fffdf6";
    ctx.beginPath();
    ctx.roundRect(70, 200, 220, 190, 60);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#2fd483";
    ctx.beginPath();
    ctx.roundRect(46, 250, 30, 80, 12);
    ctx.roundRect(284, 250, 30, 80, 12);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(180, 200);
    ctx.lineTo(180, 160);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(180, 150, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1a2236";
    ctx.beginPath();
    ctx.roundRect(98, 228, 164, 130, 40);
    ctx.fill();
    ctx.fillStyle = "#c9f7e0";
    ctx.beginPath();
    ctx.roundRect(132, 268, 20, 34, 10);
    ctx.roundRect(208, 268, 20, 34, 10);
    ctx.fill();
    ctx.strokeStyle = "#c9f7e0";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(180, 312, 26, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
    // balão
    ctx.fillStyle = "#fffdf6";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(40, 450, 280, 120, 28);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1d2bb8";
    ctx.font = '50px "Gochi Hand", cursive';
    ctx.textAlign = "center";
    ctx.fillText("bora estudar?", 180, 525);
  });
}

function rulerTexture() {
  return canvasTexture(1024, 96, (ctx) => {
    ctx.fillStyle = "#f4ead0";
    ctx.fillRect(0, 0, 1024, 96);
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.font = "18px monospace";
    for (let mm = 0; mm <= 300; mm += 1) {
      const x = 12 + mm * 3.33;
      const h = mm % 10 === 0 ? 34 : mm % 5 === 0 ? 24 : 14;
      ctx.lineWidth = mm % 10 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      if (mm % 10 === 0) ctx.fillText(String(mm / 10), x - 5, 58);
    }
  });
}

const easeOutBounce = (x: number) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};

export default function MesaDeEstudo({
  subjects,
  onAction,
}: {
  subjects: MesaSubject[];
  onAction: (action: MesaAction) => void;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const tip = useRef<HTMLDivElement | null>(null);
  const actionRef = useRef(onAction);
  actionRef.current = onAction;
  const [ready, setReady] = useState(false);
  const subjectsKey = subjects.map((subject) => `${subject.id}:${subject.name}:${subject.color}`).join("|");

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let disposed = false;
    const dark = !document.documentElement.classList.contains("theme-light");

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = dark ? 1.05 : 1.15;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 2, 0.1, 100);
    camera.position.set(0, 10.5, 7.4);
    camera.lookAt(0, 0, 0.35);

    // ── luz ──
    scene.add(new THREE.HemisphereLight(dark ? 0x6c7aa8 : 0xffffff, dark ? 0x1a1208 : 0xb59a78, dark ? 0.75 : 1.25));
    const fill = new THREE.DirectionalLight(dark ? 0x9fb0ff : 0xffffff, dark ? 0.35 : 0.7);
    fill.position.set(-4, 8, 6);
    scene.add(fill);
    const lampLight = new THREE.SpotLight(0xffe2b0, dark ? 70 : 38, 18, Math.PI / 4.2, 0.55, 1.4);
    lampLight.castShadow = true;
    lampLight.shadow.mapSize.set(1024, 1024);
    lampLight.shadow.bias = -0.0004;
    lampLight.shadow.radius = 4;
    scene.add(lampLight);
    scene.add(lampLight.target);

    // ── mesa ──
    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(item: T) => {
      disposables.push(item);
      return item;
    };
    const wood = track(woodTexture(dark));
    wood.wrapS = THREE.RepeatWrapping;
    wood.repeat.set(1.5, 1);
    const desk = new THREE.Mesh(
      track(new THREE.BoxGeometry(22, 0.4, 12)),
      track(new THREE.MeshStandardMaterial({ map: wood, roughness: 0.78 })),
    );
    desk.position.y = -0.2;
    desk.receiveShadow = true;
    scene.add(desk);

    const mat = (color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) =>
      track(new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra }));
    const shadowed = <T extends THREE.Object3D>(object: T) => {
      object.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      return object;
    };

    const interactives: Interactive[] = [];
    const add = (root: THREE.Object3D, label: string, action: Interactive["action"], drop: number) => {
      shadowed(root);
      root.userData.interactive = interactives.length;
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      box.max.y += 0.35;
      interactives.push({ root, rest: root.position.clone(), restRot: root.rotation.y, label, action, drop, lift: 0, box });
      scene.add(root);
    };

    // ── o relógio de verdade ──
    // De dia (tema claro) entra sol por uma persiana fora do quadro e as
    // ripas desenham listras na mesa; o ângulo e a cor seguem a hora. No fim
    // da tarde o sol fica baixo e dourado; à noite só a luminária trabalha.
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    const daylight = !dark && hour >= 6.5 && hour < 18.5;
    if (daylight) {
      const t = (hour - 6.5) / 12; // 0 = manhã, 1 = fim da tarde
      const golden = t > 0.75 ? (t - 0.75) / 0.25 : t < 0.12 ? 1 - t / 0.12 : 0;
      const sun = new THREE.DirectionalLight(new THREE.Color().lerpColors(new THREE.Color(0xfff6e6), new THREE.Color(0xffb36b), golden), 1.6 + (1 - golden) * 0.8);
      // o sol anda da esquerda (manhã) para a direita (tarde), sempre pela janela do fundo
      sun.position.set(-11 + t * 22, 7 - golden * 2.5, -9);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -9;
      sun.shadow.camera.right = 9;
      sun.shadow.camera.top = 7;
      sun.shadow.camera.bottom = -7;
      sun.shadow.bias = -0.0005;
      sun.shadow.radius = 3;
      scene.add(sun);
      sun.target.position.set(0, 0, 0.5);
      scene.add(sun.target);
      // ripas da persiana: invisíveis para a câmera, mas fazem sombra
      const slatMaterial = track(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
      const slatGeometry = track(new THREE.BoxGeometry(14, 0.05, 0.22));
      const blinds = new THREE.Group();
      for (let slat = 0; slat < 16; slat += 1) {
        const mesh = new THREE.Mesh(slatGeometry, slatMaterial);
        mesh.position.y = slat * 0.42;
        mesh.rotation.x = 0.5;
        mesh.castShadow = true;
        blinds.add(mesh);
      }
      // a meio caminho entre o sol e a mesa, fora do quadro da câmera
      blinds.position.copy(sun.position).multiplyScalar(0.55);
      blinds.position.y -= 3.2;
      blinds.lookAt(sun.position);
      scene.add(blinds);
      lampLight.intensity *= 0.6;
    }

    // cadernos das matérias, empilhados e um pouco tortos
    const pageMat = mat(0xf7f3e8, { roughness: 0.9 });
    subjects.slice(0, 3).forEach((subject, index) => {
      const group = new THREE.Group();
      const coverTexture = track(notebookCover(subject));
      const side = mat(subject.color);
      const coverMat = track(new THREE.MeshStandardMaterial({ map: coverTexture, roughness: 0.55 }));
      // faces da caixa: +x, -x, +y (capa), -y, +z, -z
      const book = new THREE.Mesh(track(new THREE.BoxGeometry(2.1, 0.2, 2.75)), [pageMat, side, coverMat, side, pageMat, pageMat]);
      group.add(book);
      // espiral: anéis na borda esquerda
      const ringGeo = track(new THREE.TorusGeometry(0.075, 0.016, 6, 14));
      const ringMat = mat(0x9aa3b5, { metalness: 0.8, roughness: 0.3 });
      for (let ring = 0; ring < 11; ring += 1) {
        const torus = new THREE.Mesh(ringGeo, ringMat);
        torus.rotation.y = Math.PI / 2;
        torus.position.set(-1.05, 0, -1.2 + ring * 0.24);
        group.add(torus);
      }
      group.position.set(-4.1 + index * 0.12, 0.1 + index * 0.215, 0.35 - index * 0.08);
      group.rotation.y = [0.12, -0.08, 0.2][index];
      add(group, `Caderno de ${subject.name}`, { kind: "subject", id: subject.id }, 0.05 + index * 0.1);
    });

    // planner (Plano de estudos)
    {
      const group = new THREE.Group();
      const cover = track(new THREE.MeshStandardMaterial({ map: track(plannerCover()), roughness: 0.5 }));
      const side = mat(0x2f49d1);
      const box = new THREE.Mesh(track(new THREE.BoxGeometry(1.75, 0.26, 2.2)), [pageMat, side, cover, side, pageMat, pageMat]);
      group.add(box);
      const band = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.28, 2.22)), mat(0xff5a5f));
      band.position.x = 0.62;
      group.add(band);
      group.position.set(-1.35, 0.13, -0.75);
      group.rotation.y = -0.18;
      add(group, "Planner · Plano de estudos", { kind: "plan" }, 0.35);
    }

    // lápis (Foco)
    {
      const group = new THREE.Group();
      const body = new THREE.Mesh(track(new THREE.CylinderGeometry(0.1, 0.1, 2.6, 6)), mat(0xf6c533, { roughness: 0.45 }));
      body.rotation.z = Math.PI / 2;
      group.add(body);
      const wood = new THREE.Mesh(track(new THREE.ConeGeometry(0.1, 0.32, 6)), mat(0xe9c79a));
      wood.rotation.z = -Math.PI / 2;
      wood.position.x = 1.46;
      group.add(wood);
      const lead = new THREE.Mesh(track(new THREE.ConeGeometry(0.035, 0.11, 8)), mat(0x2b2b2b));
      lead.rotation.z = -Math.PI / 2;
      lead.position.x = 1.6;
      group.add(lead);
      const ferrule = new THREE.Mesh(track(new THREE.CylinderGeometry(0.105, 0.105, 0.2, 12)), mat(0xc7ccd6, { metalness: 0.85, roughness: 0.3 }));
      ferrule.rotation.z = Math.PI / 2;
      ferrule.position.x = -1.4;
      group.add(ferrule);
      const eraser = new THREE.Mesh(track(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 12)), mat(0xff8fa3));
      eraser.rotation.z = Math.PI / 2;
      eraser.position.x = -1.6;
      group.add(eraser);
      group.position.set(0.7, 0.1, 1.55);
      group.rotation.y = 0.32;
      add(group, "Lápis · Sessão de foco", { kind: "foco" }, 0.5);
    }

    // celular com a Mine
    {
      const group = new THREE.Group();
      const shell = new THREE.Mesh(track(new THREE.BoxGeometry(1.05, 0.09, 2.05)), mat(0x1b1f2a, { roughness: 0.35, metalness: 0.3 }));
      group.add(shell);
      const screen = new THREE.Mesh(
        track(new THREE.PlaneGeometry(0.93, 1.86)),
        track(new THREE.MeshStandardMaterial({ map: track(phoneScreen()), emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0.0, roughness: 0.25 })),
      );
      (screen.material as THREE.MeshStandardMaterial).emissiveMap = (screen.material as THREE.MeshStandardMaterial).map;
      (screen.material as THREE.MeshStandardMaterial).emissiveIntensity = dark ? 0.55 : 0.2;
      screen.rotation.x = -Math.PI / 2;
      screen.position.y = 0.047;
      group.add(screen);
      group.position.set(2.45, 0.05, -0.15);
      group.rotation.y = -0.22;
      add(group, "Celular · Conversar com a Mine", { kind: "mine" }, 0.65);
    }

    // lupa (Busca)
    {
      const group = new THREE.Group();
      const rim = new THREE.Mesh(track(new THREE.TorusGeometry(0.42, 0.06, 10, 32)), mat(0x2b2f3a, { metalness: 0.5, roughness: 0.35 }));
      rim.rotation.x = Math.PI / 2;
      group.add(rim);
      const glass = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 32)),
        track(new THREE.MeshStandardMaterial({ color: 0xd8f3ff, transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.1 })),
      );
      glass.castShadow = false;
      group.add(glass);
      const handle = new THREE.Mesh(track(new THREE.CylinderGeometry(0.065, 0.075, 1.0, 12)), mat(0x7a4a2a, { roughness: 0.5 }));
      handle.rotation.z = Math.PI / 2;
      handle.position.x = 0.95;
      group.add(handle);
      group.position.set(0.85, 0.07, -1.55);
      group.rotation.y = 0.6;
      add(group, "Lupa · Buscar em tudo", { kind: "search" }, 0.8);
    }

    // luminária: base, braço e cúpula; clicar apaga/acende
    const lampHead = new THREE.Group();
    {
      const group = new THREE.Group();
      const metal = mat(0x2f49d1, { metalness: 0.35, roughness: 0.4 });
      const base = new THREE.Mesh(track(new THREE.CylinderGeometry(0.55, 0.62, 0.14, 28)), metal);
      group.add(base);
      const arm1 = new THREE.Mesh(track(new THREE.CylinderGeometry(0.045, 0.045, 1.7, 10)), metal);
      arm1.position.set(-0.25, 0.85, 0.12);
      arm1.rotation.z = 0.3;
      group.add(arm1);
      const arm2 = new THREE.Mesh(track(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 10)), metal);
      arm2.position.set(-1.1, 1.9, 0.12);
      arm2.rotation.z = 1.2;
      group.add(arm2);
      const shade = new THREE.Mesh(track(new THREE.ConeGeometry(0.42, 0.62, 28, 1, true)), track(new THREE.MeshStandardMaterial({ color: 0x2f49d1, side: THREE.DoubleSide, metalness: 0.35, roughness: 0.4 })));
      lampHead.add(shade);
      const bulb = new THREE.Mesh(track(new THREE.SphereGeometry(0.16, 16, 12)), track(new THREE.MeshStandardMaterial({ color: 0xfff3d1, emissive: 0xffd68a, emissiveIntensity: 2.2 })));
      bulb.position.y = -0.2;
      lampHead.add(bulb);
      lampHead.position.set(-1.75, 1.95, 0.12);
      group.add(lampHead);
      group.position.set(5.0, 0.07, -1.55);
      add(group, "Luminária · apagar ou acender", "lamp", 0.9);
    }

    // caneca e régua: só cenário
    {
      const mug = new THREE.Group();
      const cup = new THREE.Mesh(track(new THREE.CylinderGeometry(0.42, 0.38, 0.9, 28)), mat(0xfffdf6, { roughness: 0.4 }));
      cup.position.y = 0.45;
      mug.add(cup);
      const coffee = new THREE.Mesh(track(new THREE.CircleGeometry(0.37, 24)), mat(0x5a3820, { roughness: 0.2 }));
      coffee.rotation.x = -Math.PI / 2;
      coffee.position.y = 0.82;
      mug.add(coffee);
      const handle = new THREE.Mesh(track(new THREE.TorusGeometry(0.2, 0.05, 8, 16, Math.PI * 1.2)), mat(0xfffdf6));
      handle.position.set(0.46, 0.45, 0);
      handle.rotation.z = -Math.PI * 0.6;
      mug.add(handle);
      mug.position.set(4.5, 0, 1.2);
      scene.add(shadowed(mug));

      const ruler = new THREE.Mesh(
        track(new THREE.BoxGeometry(3.4, 0.03, 0.34)),
        [mat(0xf4ead0), mat(0xf4ead0), track(new THREE.MeshStandardMaterial({ map: track(rulerTexture()), roughness: 0.5 })), mat(0xf4ead0), mat(0xf4ead0), mat(0xf4ead0)],
      );
      ruler.position.set(-1.0, 0.015, 2.35);
      ruler.rotation.y = -0.05;
      scene.add(shadowed(ruler));
    }

    // ── interação ──
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(9, 9);
    const deskPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const aim = new THREE.Vector3(1, 0, 0.5);
    const aimTarget = aim.clone();
    let hovered: Interactive | null = null;
    let lampOn = true;
    let lampPower = 1;
    let pointerInside = false;
    let frames = 0;
    const start = performance.now();
    const introEnd = 1.8;

    const findInteractive = (object: THREE.Object3D | null): Interactive | null => {
      let current: THREE.Object3D | null = object;
      while (current) {
        if (typeof current.userData.interactive === "number") return interactives[current.userData.interactive];
        current = current.parent;
      }
      return null;
    };

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      // mesa larga sempre cabe: em tela estreita a câmera recua
      camera.fov = camera.aspect < 2.2 ? 30 * (2.2 / camera.aspect) ** 0.55 : 30;
      camera.updateProjectionMatrix();
      wake();
    };

    const onMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      pointerInside = true;
      if (tip.current) {
        tip.current.style.transform = `translate(${event.clientX - rect.left + 14}px, ${event.clientY - rect.top + 12}px)`;
      }
      wake();
    };
    const onLeave = () => {
      pointerInside = false;
      pointer.set(9, 9);
      wake();
    };
    const onClick = () => {
      if (!hovered) return;
      if (hovered.action === "lamp") {
        lampOn = !lampOn;
        wake();
        return;
      }
      hovered.lift = 0.9; // pula antes de sair
      const action = hovered.action;
      wake();
      window.setTimeout(() => actionRef.current(action), 180);
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerleave", onLeave);
    renderer.domElement.addEventListener("click", onClick);

    // ── laço sob demanda ──
    let raf = 0;
    let visible = true;
    const clock = new THREE.Clock();
    function wake() {
      frames = Math.max(frames, 90);
      if (!raf && visible && !disposed) raf = requestAnimationFrame(tick);
    }

    const headDir = new THREE.Vector3();
    function tick() {
      raf = 0;
      const dt = Math.min(0.05, clock.getDelta());
      const elapsed = (performance.now() - start) / 1000;

      // hover
      raycaster.setFromCamera(pointer, camera);
      const hit = pointerInside ? raycaster.intersectObjects(interactives.map((item) => item.root), true)[0] : undefined;
      // histerese: quem está erguido continua em hover enquanto o ponteiro
      // estiver sobre a caixa dele em repouso; sem isso o objeto sobe, sai de
      // baixo do ponteiro, cai, volta a ser atingido e fica piscando
      let nextHover = hit ? findInteractive(hit.object) : null;
      if (!nextHover && hovered && pointerInside && raycaster.ray.intersectsBox(hovered.box)) nextHover = hovered;
      if (nextHover !== hovered) {
        hovered = nextHover;
        renderer.domElement.style.cursor = hovered ? "pointer" : "";
        if (tip.current) {
          tip.current.textContent = hovered?.label || "";
          tip.current.dataset.show = hovered ? "1" : "";
        }
      }
      // a luz segue o ponteiro pela mesa
      if (pointerInside) raycaster.ray.intersectPlane(deskPlane, aimTarget);
      aimTarget.x = THREE.MathUtils.clamp(aimTarget.x, -5.5, 5.5);
      aimTarget.z = THREE.MathUtils.clamp(aimTarget.z, -2.6, 2.8);
      aim.lerp(aimTarget, 1 - Math.pow(0.002, dt));

      let moving = Math.abs(aim.x - aimTarget.x) + Math.abs(aim.z - aimTarget.z) > 0.01;

      for (const item of interactives) {
        const t = Math.min(1, Math.max(0, (elapsed - item.drop) / 0.75));
        const fall = (1 - easeOutBounce(t)) * 3.2;
        const want = item === hovered ? 0.22 : 0;
        item.lift += (want - item.lift) * (1 - Math.pow(0.0005, dt));
        if (Math.abs(want - item.lift) > 0.002) moving = true;
        item.root.position.y = item.rest.y + fall + item.lift;
        item.root.rotation.y = item.restRot + item.lift * 0.35;
      }
      if (elapsed < introEnd + 1) moving = true;

      // luminária: cabeça mira o ponto, luz liga/desliga suave
      lampPower += ((lampOn ? 1 : 0) - lampPower) * (1 - Math.pow(0.001, dt));
      if (Math.abs((lampOn ? 1 : 0) - lampPower) > 0.003) moving = true;
      lampHead.getWorldPosition(lampLight.position);
      lampLight.target.position.copy(aim);
      headDir.copy(aim).sub(lampLight.position).normalize();
      lampHead.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), headDir);
      const parentQuat = lampHead.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
      lampHead.quaternion.premultiply(parentQuat);
      lampLight.intensity = (dark ? 70 : daylight ? 22 : 38) * lampPower;
      const bulb = lampHead.children[1] as THREE.Mesh;
      (bulb.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15 + 2.1 * lampPower;

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

    // as letras das texturas precisam das fontes do caderno
    document.fonts?.ready.then(() => {
      if (disposed) return;
      disposables.forEach((item) => (item as unknown as THREE.Texture).userData?.redraw?.());
      setReady(true);
      wake();
    });
    resize();
    wake();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      renderer.domElement.removeEventListener("click", onClick);
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
    // refaz a cena quando as matérias da pilha mudam
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectsKey]);

  return (
    <div className={`caderno-mesa ${ready ? "is-ready" : ""}`}>
      <div ref={host} className="caderno-mesa-canvas" />
      <div ref={tip} className="caderno-mesa-tip" aria-hidden />
    </div>
  );
}
