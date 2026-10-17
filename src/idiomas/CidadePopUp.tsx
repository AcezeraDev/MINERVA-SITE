/*
  A cidade pop-up do intercâmbio (three.js).

  O mapa da trilha é um livro pop-up aberto sobre a folha do caderno: cada
  parada é um prédio de papel que se levanta da página quando abre. Paradas
  trancadas ficam dobradas, deitadas na folha como um desenho a lápis; as
  carimbadas ganham uma bandeirinha; a próxima tem o alfinete da Mine.

  - arrastar na horizontal gira a cidade; passar o ponteiro ergue o prédio;
    clicar abre a parada (a mesma ação existe nos botões da trilha abaixo,
    então o canvas é cenário: aria-hidden);
  - tudo é primitiva + textura desenhada em <canvas> (nada para baixar);
  - laço sob demanda: só desenha enquanto algo se mexe, e para fora da tela
    ou com a aba escondida. No tier "high" o alfinete flutua e um aviãozinho
    de papel dá voltas — aí o laço segue enquanto a cena estiver visível;
  - quem decide se a cena existe é a IdiomasView (tier baixo, movimento
    reduzido ou falta de WebGL caem na cidade plana em CSS).
*/
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildLandmark } from "./predios";

export type StopState = "locked" | "open" | "next" | "done";
export type CityStop = { id: string; emoji: string; label: string; place: string; color: string; state: StopState };

const SPOTS: Array<[number, number]> = [
  [-5.3, 1.5],
  [-3.7, -1.25],
  [-2.0, 1.35],
  [-0.4, -1.35],
  [1.25, 1.3],
  [2.85, -1.3],
  [4.35, 1.2],
  [5.7, -1.0],
];

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

/** A folha pautada com margem vermelha, nos dois temas do caderno. */
function pageTexture(dark: boolean) {
  return canvasTexture(2048, 1500, (ctx) => {
    ctx.fillStyle = dark ? "#151a26" : "#f7f9fb";
    ctx.fillRect(0, 0, 2048, 1500);
    ctx.strokeStyle = dark ? "rgba(70,88,130,.55)" : "rgba(150,178,215,.7)";
    ctx.lineWidth = 3;
    for (let y = 70; y < 1500; y += 54) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(2048, y);
      ctx.stroke();
    }
    ctx.strokeStyle = dark ? "rgba(255,107,111,.55)" : "rgba(229,72,77,.65)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(150, 0);
    ctx.lineTo(150, 1500);
    ctx.stroke();
    // rabisco de rosa dos ventos no canto, à caneta
    ctx.strokeStyle = dark ? "rgba(147,163,255,.6)" : "rgba(29,43,184,.55)";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    const cx = 1880;
    const cy = 170;
    ctx.beginPath();
    ctx.arc(cx, cy, 70, 0, Math.PI * 2);
    ctx.moveTo(cx, cy - 110);
    ctx.lineTo(cx, cy + 110);
    ctx.moveTo(cx - 110, cy);
    ctx.lineTo(cx + 110, cy);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.font = "64px 'Gochi Hand', cursive";
    ctx.textAlign = "center";
    ctx.fillText("N", cx, cy - 125);
    ctx.font = "84px 'Gochi Hand', cursive";
    ctx.textAlign = "left";
    ctx.fillText("London ~ my exchange trip", 220, 1330);
  });
}

/** Placa da parada: figurinha + nome em inglês, letra à mão. */
function signTexture(stop: CityStop, dark: boolean) {
  return canvasTexture(512, 200, (ctx) => {
    const locked = stop.state === "locked";
    ctx.fillStyle = dark ? "#202a3e" : "#ffffff";
    ctx.beginPath();
    ctx.roundRect(8, 8, 496, 184, 28);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = locked ? "rgba(120,130,150,.7)" : dark ? "#93a3ff" : "#1d2bb8";
    ctx.stroke();
    ctx.globalAlpha = locked ? 0.45 : 1;
    ctx.font = "92px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(locked ? "🔒" : stop.emoji, 34, 104);
    ctx.fillStyle = dark ? "#e8ecf4" : "#16181d";
    ctx.font = "64px 'Gochi Hand', cursive";
    ctx.fillText(stop.label, 156, 92, 330);
    ctx.font = "34px 'Patrick Hand', cursive";
    ctx.fillStyle = dark ? "#9aa3b6" : "#5a6272";
    ctx.fillText(stop.place, 158, 150, 330);
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

type Building = {
  id: string;
  hinge: THREE.Group;
  pop: number; // 0 dobrado … 1 em pé
  target: number;
  delay: number;
  lift: number;
  liftTarget: number;
  baseY: number;
  state: StopState;
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
  const [ready, setReady] = useState(false);
  const stopsKey = stops.map((stop) => `${stop.id}:${stop.state}`).join("|");
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

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 2 : 1.5));
    renderer.shadowMap.enabled = high;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = dark ? 1.0 : 1.1;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 2, 0.1, 100);
    // mirar um pouco à frente do centro da folha sobe a cidade no quadro
    camera.position.set(0, 8, 11.5);
    camera.lookAt(0, 0, 0.75);

    scene.add(new THREE.HemisphereLight(dark ? 0x7d8cc0 : 0xffffff, dark ? 0x10131c : 0xc8d2e0, dark ? 1.1 : 1.6));
    const sun = new THREE.DirectionalLight(0xfff2dc, dark ? 1.4 : 2.2);
    sun.position.set(-5, 9, 6);
    sun.castShadow = high;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -9;
    sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 6;
    sun.shadow.camera.bottom = -6;
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(item: T) => {
      disposables.push(item);
      return item;
    };

    const world = new THREE.Group();
    scene.add(world);

    const page = new THREE.Mesh(
      // funda o bastante para a borda da frente sair do quadro (sem vão embaixo)
      track(new THREE.PlaneGeometry(15, 11)),
      track(new THREE.MeshStandardMaterial({ map: track(pageTexture(dark)), roughness: 0.95 })),
    );
    page.rotation.x = -Math.PI / 2;
    page.position.z = 1.2;
    page.receiveShadow = true;
    world.add(page);

    // ── caminho tracejado à caneta, desenhado aos poucos ──
    const curve = new THREE.CatmullRomCurve3(SPOTS.slice(0, stops.length).map(([x, z]) => new THREE.Vector3(x, 0.012, z + 0.75)));
    const pathGeometry = track(new THREE.BufferGeometry().setFromPoints(curve.getPoints(220)));
    const path = new THREE.Line(pathGeometry, track(new THREE.LineDashedMaterial({ color: dark ? 0x93a3ff : 0x1d2bb8, dashSize: 0.16, gapSize: 0.12 })));
    path.computeLineDistances();
    pathGeometry.setDrawRange(0, 0);
    world.add(path);
    let pathDrawn = 0;

    // ── prédios ──
    const buildings: Building[] = [];
    const hitTargets: THREE.Object3D[] = [];
    const signGeometry = track(new THREE.PlaneGeometry(1.5, 0.586));
    const stamp = track(stampTexture());
    let pin: THREE.Group | null = null;
    let pinBase = 0;

    stops.forEach((stop, index) => {
      const [x, z] = SPOTS[index % SPOTS.length];
      const locked = stop.state === "locked";
      const anchor = new THREE.Group();
      anchor.position.set(x, 0, z);
      world.add(anchor);

      // a dobra fica na base de trás: o prédio deita para trás na página
      const hinge = new THREE.Group();
      hinge.position.z = -0.45;
      anchor.add(hinge);

      // o prédio com a cara do lugar (src/idiomas/predios.ts)
      const landmark = buildLandmark(stop.id, { color: stop.color, locked, dark, shadows: high, track });
      const height = landmark.height;
      hinge.add(landmark.group);
      // fechada: o recorte fica achatado, deitado na folha como papel dobrado
      if (locked) hinge.scale.z = 0.14;

      const sign = new THREE.Mesh(signGeometry, track(new THREE.MeshStandardMaterial({ map: track(signTexture(stop, dark)), roughness: 0.9, transparent: true })));
      // a placa fica de pé na frente, fora da dobra: é ela que diz o que está fechado
      sign.position.set(0, 0.34, 0.78);
      sign.rotation.x = -0.22;
      anchor.add(sign);

      if (stop.state === "done") {
        const pole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6)), track(new THREE.MeshStandardMaterial({ color: 0x16181d })));
        pole.position.set(-0.78, 0.35, 0.12);
        hinge.add(pole);
        const flag = new THREE.Mesh(track(new THREE.PlaneGeometry(0.46, 0.29)), track(new THREE.MeshStandardMaterial({ map: stamp, side: THREE.DoubleSide })));
        flag.position.set(-0.55, 0.55, 0.12);
        hinge.add(flag);
      }

      if (stop.state === "next") {
        pin = new THREE.Group();
        const head = new THREE.Mesh(track(new THREE.SphereGeometry(0.17, 18, 14)), track(new THREE.MeshStandardMaterial({ color: dark ? 0x2fd483 : 0x22b86d, emissive: 0x0b3d24, roughness: 0.4 })));
        const needle = new THREE.Mesh(track(new THREE.ConeGeometry(0.06, 0.42, 10)), track(new THREE.MeshStandardMaterial({ color: 0x9aa3b6, metalness: 0.6, roughness: 0.3 })));
        needle.rotation.x = Math.PI;
        needle.position.y = -0.27;
        pin.add(head, needle);
        pinBase = height + 1.25;
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
        hinge,
        pop: 0,
        target: locked ? 0.02 : 1,
        delay: 0.25 + index * 0.12,
        lift: 0,
        liftTarget: 0,
        baseY: 0,
        state: stop.state,
      });
      hinge.rotation.x = -Math.PI / 2;
    });

    // ── aviãozinho de papel, só no tier alto ──
    let plane: THREE.Mesh | null = null;
    if (high) {
      const shape = new THREE.BufferGeometry();
      shape.setAttribute(
        "position",
        new THREE.Float32BufferAttribute([0, 0, 0.5, -0.32, 0, -0.3, 0, 0.04, -0.2, 0, 0, 0.5, 0.32, 0, -0.3, 0, 0.04, -0.2, 0, 0, 0.5, 0, 0.04, -0.2, 0, -0.14, -0.25], 3),
      );
      shape.computeVertexNormals();
      plane = new THREE.Mesh(track(shape), track(new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.7 })));
      plane.castShadow = true;
      world.add(plane);
    }

    // ── interação ──
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(9, 9);
    let pointerInside = false;
    let hovered: Building | null = null;
    let yaw = 0;
    let yawTarget = 0;
    let tilt = 0;
    let tiltTarget = 0;
    let drag: { x: number; yaw: number; moved: boolean } | null = null;

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      // a cidade é larga: em tela estreita a câmera abre o ângulo
      camera.fov = camera.aspect < 1.9 ? 32 * (1.9 / camera.aspect) ** 0.62 : 32;
      camera.updateProjectionMatrix();
      wake();
    };

    const setPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      if (tip.current) tip.current.style.transform = `translate(${event.clientX - rect.left + 14}px, ${event.clientY - rect.top + 12}px)`;
    };
    const onDown = (event: PointerEvent) => {
      drag = { x: event.clientX, yaw: yawTarget, moved: false };
    };
    const onMove = (event: PointerEvent) => {
      setPointer(event);
      pointerInside = true;
      tiltTarget = pointer.x * 0.05;
      if (drag) {
        const dx = event.clientX - drag.x;
        if (Math.abs(dx) > 5) drag.moved = true;
        yawTarget = THREE.MathUtils.clamp(drag.yaw + dx * 0.004, -0.55, 0.55);
      }
      wake();
    };
    const onUp = () => {
      const wasDrag = drag?.moved;
      drag = null;
      if (wasDrag || !hovered) return;
      if (hovered.state === "locked") {
        hovered.lift = -0.15; // treme de leve: ainda está fechada
        wake();
      } else {
        hovered.lift = 0.6;
        wake();
      }
      const id = hovered.id;
      window.setTimeout(() => selectRef.current(id), 160);
    };
    const onLeave = () => {
      pointerInside = false;
      drag = null;
      pointer.set(9, 9);
      tiltTarget = 0;
      wake();
    };
    const canvas = renderer.domElement;
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onLeave);

    focusRef.current = (id) => {
      const index = stops.findIndex((stop) => stop.id === id);
      if (index < 0) return;
      // gira a cidade para trazer a parada para perto do centro
      yawTarget = THREE.MathUtils.clamp(-SPOTS[index][0] * 0.05, -0.4, 0.4);
      buildings[index].lift = 0.7;
      wake();
    };

    // ── laço sob demanda ──
    let raf = 0;
    let frames = 0;
    let visible = true;
    const start = performance.now();
    const clock = new THREE.Clock();
    function wake() {
      frames = Math.max(frames, 80);
      if (!raf && visible && !disposed) raf = requestAnimationFrame(tick);
    }

    function tick() {
      raf = 0;
      const dt = Math.min(0.05, clock.getDelta());
      const elapsed = (performance.now() - start) / 1000;
      let moving = false;

      // traço do caminho
      if (pathDrawn < 1) {
        pathDrawn = Math.min(1, pathDrawn + dt * 0.55);
        pathGeometry.setDrawRange(0, Math.floor(221 * pathDrawn));
        moving = true;
      }

      // hover
      raycaster.setFromCamera(pointer, camera);
      const hit = pointerInside ? raycaster.intersectObjects(hitTargets, false)[0] : undefined;
      const next = hit ? buildings[hit.object.userData.stop as number] : null;
      if (next !== hovered) {
        hovered = next;
        canvas.style.cursor = hovered ? "pointer" : drag ? "grabbing" : "grab";
        if (tip.current) {
          const stop = hovered ? stops.find((item) => item.id === hovered!.id) : null;
          tip.current.textContent = stop ? (stop.state === "locked" ? `${stop.place} · ainda fechada` : `${stop.place} · abrir parada`) : "";
          tip.current.classList.toggle("is-on", Boolean(stop));
        }
      }

      for (const building of buildings) {
        // pop-up com passo de mola: passa um pouco do ponto e assenta
        if (elapsed > building.delay) {
          const before = building.pop;
          building.pop += (building.target - building.pop) * Math.min(1, dt * 7.5);
          if (Math.abs(building.target - building.pop) < 0.0015) building.pop = building.target;
          if (building.pop !== before) moving = true;
        } else moving = true;
        // no meio do caminho o prédio passa um pouco da vertical e volta: mola de papel
        const overshoot = building.target === 1 ? Math.sin(building.pop * Math.PI) * 0.22 : 0;
        building.hinge.rotation.x = (-Math.PI / 2) * (1 - building.pop) + overshoot;

        building.liftTarget = hovered === building ? (building.state === "locked" ? 0.04 : 0.22) : 0;
        const liftBefore = building.lift;
        building.lift += (building.liftTarget - building.lift) * Math.min(1, dt * 10);
        if (Math.abs(building.lift - building.liftTarget) < 0.001) building.lift = building.liftTarget;
        if (building.lift !== liftBefore) moving = true;
        building.hinge.position.y = Math.max(-0.1, building.lift);
      }

      const yawBefore = yaw;
      yaw += (yawTarget - yaw) * Math.min(1, dt * 6);
      tilt += (tiltTarget - tilt) * Math.min(1, dt * 4);
      if (Math.abs(yaw - yawBefore) > 0.0003 || Math.abs(tilt - tiltTarget) > 0.0005) moving = true;
      world.rotation.y = yaw;
      world.rotation.z = -tilt * 0.3;

      if (pin) {
        (pin as THREE.Group).position.y = pinBase + (high ? Math.sin(elapsed * 2.4) * 0.12 : 0);
        (pin as THREE.Group).rotation.y = high ? elapsed * 1.2 : 0;
        if (high) moving = true;
      }
      if (plane) {
        const t = elapsed * 0.16;
        const p = new THREE.Vector3(Math.cos(t * Math.PI * 2) * 6.2, 2.4 + Math.sin(t * Math.PI * 4) * 0.35, Math.sin(t * Math.PI * 2) * 3.1);
        const ahead = new THREE.Vector3(Math.cos((t + 0.01) * Math.PI * 2) * 6.2, 2.4 + Math.sin((t + 0.01) * Math.PI * 4) * 0.35, Math.sin((t + 0.01) * Math.PI * 2) * 3.1);
        plane.position.copy(p);
        plane.lookAt(ahead);
        plane.rotateZ(-0.35);
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
      <div ref={tip} className="idi-city3d-tip" aria-hidden />
    </div>
  );
}
