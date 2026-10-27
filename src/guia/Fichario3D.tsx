/*
  Fichário em WebGL (three.js), a revisão no fim da aba "Como usar".

  Um fichário de argolas aberto na mesa: cada folha é a divisória de um
  capítulo (frente: número, título e chamada; verso: os três passos do
  capítulo seguinte, que é a folha que fica à direita). As folhas giram
  pela argola de verdade:
  - arrastar para o lado folheia (o progresso segue o dedo, solto ele assenta);
  - clicar numa aba colorida folheia até ela, uma folha de cada vez;
  - clicar na folha da direita abre o capítulo.

  Feito só de planos e texturas desenhadas em <canvas> na hora (nada para
  baixar). Custo, no mesmo contrato da Mesa de estudo da Home:
  - render sob demanda: o laço só roda enquanto algo se mexe e para fora da
    tela ou com a aba escondida;
  - DPR limitado a 1.5, uma luz com sombra (1024²);
  - o canvas é cenário (aria-hidden): os botões da seção fazem o mesmo.
*/
import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export type FicharioCap = {
  id: string;
  label: string;
  title: string;
  lead: string;
  /** cor da divisória, em "r g b" (formato dos tokens do caderno) */
  tab: string;
  steps: Array<{ t: string; d: string }>;
};

type Props = {
  caps: FicharioCap[];
  /** folha aberta à direita; o fichário folheia até ela */
  index: number;
  onIndex: (index: number) => void;
  onOpen: (index: number) => void;
};

const W = 3.0; // largura da folha
const H = 3.9; // altura da folha
const GAP = 0.16; // da argola até a borda da folha
const STACK = 0.02; // espessura de cada folha na pilha
const TEX_W = 768;
const TEX_H = 998;

function cssRgb(name: string, fallback: string) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw ? `rgb(${raw.split(/\s+/).join(",")})` : fallback;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

type Palette = { sheet: string; rule: string; margin: string; pen: string; ink: string; muted: string };

/** Folha pautada com margem vermelha, a base de toda textura de página. */
function paper(ctx: CanvasRenderingContext2D, pal: Palette) {
  ctx.fillStyle = pal.sheet;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  ctx.strokeStyle = pal.rule;
  ctx.lineWidth = 2;
  for (let y = 150; y < TEX_H; y += 44) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(TEX_W, y);
    ctx.stroke();
  }
  ctx.strokeStyle = pal.margin;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(96, 0);
  ctx.lineTo(96, TEX_H);
  ctx.stroke();
  // furos da argola
  ctx.fillStyle = "rgba(0,0,0,.28)";
  for (const y of [0.2, 0.5, 0.8]) {
    ctx.beginPath();
    ctx.arc(40, TEX_H * y, 15, 0, Math.PI * 2);
    ctx.fill();
  }
}

function makeTexture(draw: (ctx: CanvasRenderingContext2D) => void, width = TEX_W, height = TEX_H) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  // texto desenhado antes de a fonte chegar sai na letra do sistema
  texture.userData.redraw = () => {
    ctx.clearRect(0, 0, width, height);
    draw(ctx);
    texture.needsUpdate = true;
  };
  return texture;
}

function frontTexture(cap: FicharioCap, i: number, pal: Palette) {
  return makeTexture((ctx) => {
    paper(ctx, pal);
    const tab = `rgb(${cap.tab.split(/\s+/).join(",")})`;
    ctx.fillStyle = tab;
    ctx.fillRect(96, 0, TEX_W - 96, 26);
    // número vazado, como no capítulo
    const n = String(i + 1).padStart(2, "0");
    ctx.font = '900 260px "Anybody Variable", system-ui, sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = tab;
    ctx.strokeText(n, 128, 330);
    ctx.fillStyle = pal.pen;
    ctx.font = '42px "Gochi Hand", cursive';
    ctx.fillText(`Cap. ${n} · ${cap.label}`, 132, 410);
    ctx.fillStyle = pal.ink;
    ctx.font = '900 64px "Anybody Variable", system-ui, sans-serif';
    let y = 500;
    for (const line of wrap(ctx, cap.title, TEX_W - 180)) {
      // grifo de marca-texto atrás do título
      const w = ctx.measureText(line).width;
      ctx.fillStyle = tab;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(126, y - 26, w + 12, 30);
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal.ink;
      ctx.fillText(line, 132, y);
      y += 72;
    }
    ctx.fillStyle = pal.muted;
    ctx.font = '36px "Kalam", cursive';
    for (const line of wrap(ctx, cap.lead, TEX_W - 190)) {
      y += 8;
      ctx.fillText(line, 132, y + 28);
      y += 44;
    }
    ctx.fillStyle = pal.pen;
    ctx.font = '40px "Gochi Hand", cursive';
    ctx.fillText("toque para abrir →", 132, TEX_H - 70);
  });
}

function backTexture(next: FicharioCap | null, pal: Palette) {
  return makeTexture((ctx) => {
    // o verso é lido com a folha virada: a argola fica à direita
    ctx.save();
    ctx.translate(TEX_W, 0);
    ctx.scale(-1, 1);
    paper(ctx, pal);
    ctx.restore();
    const x = 70;
    if (!next) {
      ctx.fillStyle = pal.pen;
      ctx.font = '72px "Gochi Hand", cursive';
      ctx.fillText("Fim do fichário!", x, 320);
      ctx.font = '40px "Kalam", cursive';
      ctx.fillStyle = pal.ink;
      ctx.fillText("Você revisou o caderno inteiro.", x, 400);
      return;
    }
    ctx.fillStyle = pal.pen;
    ctx.font = '46px "Gochi Hand", cursive';
    ctx.fillText(`Em ${next.label}:`, x, 120);
    let y = 230;
    next.steps.forEach((step, k) => {
      ctx.strokeStyle = pal.pen;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x + 26, y - 14, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = pal.pen;
      ctx.font = '34px "Gochi Hand", cursive';
      ctx.textAlign = "center";
      ctx.fillText(String(k + 1), x + 26, y - 3);
      ctx.textAlign = "left";
      ctx.fillStyle = pal.ink;
      ctx.font = '700 40px "Kalam", cursive';
      ctx.fillText(step.t, x + 72, y);
      ctx.font = '32px "Kalam", cursive';
      ctx.fillStyle = pal.muted;
      for (const line of wrap(ctx, step.d, TEX_W - x - 150)) {
        y += 44;
        ctx.fillText(line, x + 72, y);
      }
      y += 96;
    });
  });
}

function tabTexture(cap: FicharioCap, i: number) {
  return makeTexture(
    (ctx) => {
      ctx.fillStyle = `rgb(${cap.tab.split(/\s+/).join(",")})`;
      ctx.fillRect(0, 0, 128, 96);
      ctx.fillStyle = "#16181d";
      ctx.font = '900 54px "Anybody Variable", system-ui, sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1).padStart(2, "0"), 64, 52);
    },
    128,
    96,
  );
}

function insideCover(pal: Palette) {
  return makeTexture((ctx) => {
    ctx.fillStyle = "#2a3a8f";
    ctx.fillRect(0, 0, TEX_W, TEX_H);
    ctx.fillStyle = pal.sheet;
    ctx.beginPath();
    ctx.roundRect(120, 300, 528, 300, 24);
    ctx.fill();
    ctx.fillStyle = pal.pen;
    ctx.font = '64px "Gochi Hand", cursive';
    ctx.textAlign = "center";
    ctx.fillText("meu fichário", 384, 410);
    ctx.font = '36px "Kalam", cursive';
    ctx.fillStyle = pal.ink;
    ctx.fillText("arraste as folhas →", 384, 500);
  });
}

const smooth = (x: number) => x * x * (3 - 2 * x);

export default function Fichario3D({ caps, index, onIndex, onOpen }: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  const api = useRef<{ goTo: (i: number) => void } | null>(null);
  const cb = useRef({ onIndex, onOpen });
  cb.current = { onIndex, onOpen };

  useEffect(() => {
    api.current?.goTo(index);
  }, [index]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const N = caps.length;
    const pal: Palette = {
      sheet: cssRgb("--sheet", "#f7f9fb"),
      rule: cssRgb("--rule", "#cbd7e6"),
      margin: cssRgb("--margin-line", "#ff5a5f"),
      pen: cssRgb("--pen", "#1d2bb8"),
      ink: cssRgb("--theme-text", "#16181d"),
      muted: cssRgb("--theme-muted", "#5b6170"),
    };
    const dark = !document.documentElement.classList.contains("theme-light");

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 2, 0.1, 100);

    scene.add(new THREE.HemisphereLight(0xffffff, dark ? 0x202634 : 0xb8a88f, dark ? 1.1 : 1.6));
    const sun = new THREE.DirectionalLight(0xfff4e0, dark ? 1.4 : 1.8);
    sun.position.set(-3.5, 9, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -6;
    sun.shadow.camera.right = 6;
    sun.shadow.camera.top = 5;
    sun.shadow.camera.bottom = -5;
    sun.shadow.bias = -0.0006;
    sun.shadow.radius = 5;
    scene.add(sun);

    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(item: T) => {
      disposables.push(item);
      return item;
    };
    const textures: THREE.Texture[] = [];
    const tex = (t: THREE.Texture) => {
      textures.push(t);
      return track(t);
    };

    // sombra na mesa (o fundo é a própria página do site)
    const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(30, 20)), track(new THREE.ShadowMaterial({ opacity: dark ? 0.45 : 0.22 })));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    ground.receiveShadow = true;
    scene.add(ground);

    // capa dura do fichário, aberta: duas placas e a lombada
    const boardMat = track(new THREE.MeshStandardMaterial({ color: 0x2a3a8f, roughness: 0.55 }));
    const boardGeo = track(new THREE.BoxGeometry(W + GAP + 0.3, 0.07, H + 0.36));
    for (const side of [-1, 1]) {
      const board = new THREE.Mesh(boardGeo, boardMat);
      board.position.set(side * ((W + GAP + 0.3) / 2 + 0.06), -0.035, 0);
      board.castShadow = board.receiveShadow = true;
      scene.add(board);
    }
    const inside = new THREE.Mesh(
      track(new THREE.PlaneGeometry(W, H)),
      track(new THREE.MeshStandardMaterial({ map: tex(insideCover(pal)), roughness: 0.8 })),
    );
    inside.rotation.x = -Math.PI / 2;
    inside.position.set(-(GAP + W / 2), 0.002, 0);
    inside.receiveShadow = true;
    scene.add(inside);

    // argolas: o eixo delas (z) é a dobradiça das folhas
    const metal = track(new THREE.MeshStandardMaterial({ color: 0xc9ced8, metalness: 0.85, roughness: 0.28 }));
    const ringGeo = track(new THREE.TorusGeometry(0.3, 0.035, 12, 40));
    for (const z of [-H * 0.3, 0, H * 0.3]) {
      const ring = new THREE.Mesh(ringGeo, metal);
      ring.position.set(0, 0.1, z);
      ring.castShadow = true;
      scene.add(ring);
    }
    const spine = new THREE.Mesh(track(new THREE.BoxGeometry(0.36, 0.05, H * 0.8)), metal);
    spine.position.set(0, 0.01, 0);
    scene.add(spine);

    // ── as folhas ──
    const pageGeo = track(new THREE.PlaneGeometry(W, H));
    const tabGeo = track(new THREE.PlaneGeometry(0.5, 0.3));
    const edgeGeo = track(new THREE.BoxGeometry(W, STACK * 0.7, H));
    const edgeMat = track(new THREE.MeshStandardMaterial({ color: new THREE.Color(pal.sheet), roughness: 0.9 }));
    // base do verso: a folha virada mostra x→-x, então o plano já nasce espelhado
    const backBasis = new THREE.Matrix4().makeBasis(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -1, 0));
    const tabSlots = Math.max(N, 1);
    const tabStep = (H - 0.5) / tabSlots;

    const pages: Array<{ pivot: THREE.Group; front: THREE.Mesh; tabs: THREE.Mesh[] }> = [];
    const hitTargets: THREE.Object3D[] = [];
    caps.forEach((cap, i) => {
      const pivot = new THREE.Group();
      const body = new THREE.Group();
      body.position.x = GAP + W / 2;
      pivot.add(body);

      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.castShadow = true;
      body.add(edge);

      const front = new THREE.Mesh(pageGeo, track(new THREE.MeshStandardMaterial({ map: tex(frontTexture(cap, i, pal)), roughness: 0.85 })));
      front.rotation.x = -Math.PI / 2;
      front.position.y = STACK * 0.36;
      front.userData = { kind: "page", i };
      body.add(front);

      const back = new THREE.Mesh(pageGeo, track(new THREE.MeshStandardMaterial({ map: tex(backTexture(caps[i + 1] ?? null, pal)), roughness: 0.85 })));
      back.setRotationFromMatrix(backBasis);
      back.position.y = -STACK * 0.36;
      body.add(back);

      // aba que sai da borda, uma altura por capítulo, visível dos dois lados
      const tabMat = track(new THREE.MeshStandardMaterial({ map: tex(tabTexture(cap, i)), roughness: 0.6 }));
      const tabZ = -H / 2 + 0.25 + tabStep * (i + 0.5);
      const tab = new THREE.Mesh(tabGeo, tabMat);
      tab.rotation.x = -Math.PI / 2;
      tab.position.set(W / 2 + 0.24, 0.001, tabZ);
      tab.userData = { kind: "tab", i };
      tab.castShadow = true;
      const tabBack = new THREE.Mesh(tabGeo, tabMat);
      tabBack.setRotationFromMatrix(backBasis);
      tabBack.position.set(W / 2 + 0.24, -0.001, tabZ);
      tabBack.userData = { kind: "tab", i };
      body.add(tab, tabBack);

      scene.add(pivot);
      pages.push({ pivot, front, tabs: [tab, tabBack] });
      hitTargets.push(front, tab, tabBack);
    });

    // ── estado ──
    let current = Math.min(index, N - 1);
    let target = current;
    let dragging = false;
    let dragFrom = 0;
    let dragStartX = 0;
    let moved = false;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let hovered = -1;
    let lastReported = Math.round(current);

    const layout = () => {
      for (let i = 0; i < N; i += 1) {
        const f = smooth(THREE.MathUtils.clamp(current - i, 0, 1));
        const { pivot } = pages[i];
        // pilha da direita: o capítulo 1 por cima; da esquerda: o último virado por cima
        const yRight = (N - i) * STACK;
        const yLeft = (i + 1) * STACK;
        pivot.position.y = THREE.MathUtils.lerp(yRight, yLeft, f) + Math.sin(Math.PI * f) * 0.18;
        pivot.rotation.z = Math.PI * f;
        // aba sob o mouse sobe um pouco, como quem vai puxar a divisória
        const lift = i === hovered ? 0.07 : 0;
        pages[i].tabs[0].position.y = 0.001 + lift;
        pages[i].tabs[1].position.y = -0.001 + lift;
      }
    };

    const frame = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      const aspect = w / h;
      camera.aspect = aspect;
      // enquadra o fichário aberto inteiro, de lado a lado
      // a borda de baixo fica mais perto da câmera e sai maior: sobra de 18%
      const needW = 2 * (W + GAP + 0.62) * 1.18;
      const needH = H + 0.5;
      const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const dist = Math.max(needW / (2 * t * aspect), needH / (2 * t * 0.8));
      const az = pointer.x * 0.16;
      const el = 0.9 + pointer.y * 0.06;
      camera.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist);
      camera.lookAt(0, 0, 0.15);
      camera.updateProjectionMatrix();
    };

    // ── laço sob demanda ──
    let raf = 0;
    let visible = true;
    let last = performance.now();
    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!dragging) current += (target - current) * (1 - Math.exp(-dt * 5.5));
      pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-dt * 6));
      pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-dt * 6));
      layout();
      frame();
      renderer.render(scene, camera);
      const settled =
        !dragging && Math.abs(target - current) < 0.0008 && Math.abs(pointer.tx - pointer.x) < 0.001 && Math.abs(pointer.ty - pointer.y) < 0.001;
      if (settled) current = target;
      if (!settled) kick();
    };
    const kick = () => {
      if (!raf && visible && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    const report = (i: number) => {
      if (i !== lastReported) {
        lastReported = i;
        cb.current.onIndex(i);
      }
    };

    api.current = {
      goTo: (i) => {
        const next = THREE.MathUtils.clamp(i, 0, N - 1);
        if (next === target) return;
        target = next;
        lastReported = next;
        kick();
      },
    };

    // ── ponteiro ──
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(hitTargets, false);
      // a aba ganha da folha: na borda as duas quase se encostam
      const best = hits.find((h) => h.object.userData.kind === "tab") ?? hits[0];
      return best?.object.userData as { kind: string; i: number } | undefined;
    };

    const el = renderer.domElement;
    const onDown = (event: PointerEvent) => {
      dragging = true;
      moved = false;
      dragFrom = current;
      dragStartX = event.clientX;
      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        // ponteiro que já sumiu: o arrasto segue sem captura
      }
    };
    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      pointer.tx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.ty = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      if (dragging) {
        const dx = event.clientX - dragStartX;
        if (Math.abs(dx) > 6) moved = true;
        // meia largura do fichário = uma folha inteira
        current = THREE.MathUtils.clamp(dragFrom - dx / (rect.width * 0.32), 0, N - 1);
      } else if (event.pointerType === "mouse") {
        const data = hit(event);
        const next = data?.kind === "tab" ? data.i : -1;
        el.style.cursor = data ? "pointer" : "grab";
        if (next !== hovered) hovered = next;
      }
      kick();
    };
    const onUp = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
      if (moved) {
        // assenta na folha mais perto, puxando um pouco para o lado do gesto
        const bias = current - dragFrom > 0 ? 0.25 : -0.25;
        target = THREE.MathUtils.clamp(Math.round(current + bias), 0, N - 1);
        report(target);
      } else {
        const data = hit(event);
        if (data?.kind === "tab") {
          target = data.i;
          report(target);
        } else if (data?.kind === "page") {
          // a folha clicada é a de cima da pilha da direita: abre o capítulo
          if (data.i === Math.round(current)) cb.current.onOpen(data.i);
        }
      }
      kick();
    };
    const onLeave = () => {
      pointer.tx = 0;
      pointer.ty = 0;
      hovered = -1;
      kick();
    };
    el.style.cursor = "grab";
    el.style.touchAction = "pan-y";
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("pointerleave", onLeave);

    const resize = () => {
      renderer.setSize(container.clientWidth, container.clientHeight, false);
      kick();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) kick();
    });
    io.observe(container);
    const onVisibility = () => kick();
    document.addEventListener("visibilitychange", onVisibility);

    let disposed = false;
    document.fonts?.ready.then(() => {
      if (disposed) return;
      for (const t of textures) (t.userData.redraw as (() => void) | undefined)?.();
      kick();
    });

    // entrada: o fichário abre folheando do começo até a folha pedida
    current = Math.max(0, target - 3);
    kick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("pointerleave", onLeave);
      api.current = null;
      for (const item of disposables) item.dispose();
      renderer.dispose();
      el.remove();
    };
    // caps é estável (lista fixa dos capítulos); o índice entra por api.goTo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caps]);

  return <div ref={host} className="cu-fichario-canvas" />;
}
