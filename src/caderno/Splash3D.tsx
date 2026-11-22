/*
  Camada 3D leve da abertura do Minerva (Splash.tsx).

  Otimizada para 60 FPS sem travar a entrada 2D:
  - sem PMREMGenerator / RoomEnvironment nem MeshPhysicalMaterial (elimina a
    pausa de compilação de shader no primeiro quadro);
  - sem plano de fundo em fragment shader ocupando 100% da tela (o gradiente
    fica no CSS, custo zero de fill-rate);
  - DPR limitado a 1.25 e geometria enxuta (MeshPhongMaterial com brilho
    especular nítido sob iluminação de 3 pontos);
  - 48 partículas cintilantes leves com pulso sincronizado na abertura da capa.
*/
import { useEffect, useRef } from "react";
import * as THREE from "three";

function createSparkParticles(dark: boolean, track: <T extends { dispose: () => void }>(item: T) => T) {
  const count = 48;
  const positions = new Float32Array(count * 3);
  const dirs = new Float32Array(count * 3);
  const seeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.8 + Math.random() * 5.2;
    positions[i * 3] = Math.cos(angle) * radius * 1.3;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 5.8;
    positions[i * 3 + 2] = -2.0 + Math.random() * 2.4;

    dirs[i * 3] = Math.cos(angle) * (0.6 + Math.random() * 1.1);
    dirs[i * 3 + 1] = Math.sin(angle) * (0.6 + Math.random() * 1.1);
    dirs[i * 3 + 2] = 0.3 + Math.random() * 0.6;
    seeds[i] = Math.random() * Math.PI * 2;
  }

  const geometry = track(new THREE.BufferGeometry());
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aDir", new THREE.BufferAttribute(dirs, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

  const material = track(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uBurst: { value: 0 },
        uAlpha: { value: dark ? 0.62 : 0.32 },
      },
      vertexShader: `
        attribute vec3 aDir;
        attribute float aSeed;
        uniform float uTime;
        uniform float uBurst;
        varying float vMix;
        varying float vTwinkle;
        void main() {
          vec3 pos = position + aDir * uBurst * 1.2;
          pos.y += sin(uTime * 0.9 + aSeed) * 0.18;
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = (24.0 + 10.0 * uBurst) / -mv.z;
          gl_Position = projectionMatrix * mv;
          vMix = 0.5 + 0.5 * sin(aSeed * 3.7);
          vTwinkle = 0.45 + 0.55 * sin(uTime * 2.1 + aSeed * 2.0);
        }
      `,
      fragmentShader: `
        uniform float uAlpha;
        uniform float uBurst;
        varying float vMix;
        varying float vTwinkle;
        void main() {
          float d = distance(gl_PointCoord, vec2(0.5));
          float strength = max(0.0, 1.0 - d * 2.0);
          strength *= strength;
          vec3 col = mix(vec3(0.58, 0.66, 1.0), vec3(0.32, 0.94, 0.66), vMix);
          gl_FragColor = vec4(col, strength * vTwinkle * (uAlpha + uBurst * 0.25));
        }
      `,
    }),
  );

  return { points: new THREE.Points(geometry, material), material };
}

/** Átomo orbital 3D leve (MeshPhongMaterial). */
function buildAtom(track: <T extends { dispose: () => void }>(item: T) => T) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    track(new THREE.IcosahedronGeometry(0.24, 0)),
    track(new THREE.MeshPhongMaterial({ color: 0x93a3ff, emissive: 0x2b3bc4, specular: 0xffffff, shininess: 90 })),
  );
  group.add(core);

  const ringMat = track(new THREE.MeshPhongMaterial({ color: 0x62f2b0, emissive: 0x126640, specular: 0xffffff, shininess: 80 }));
  const ringGeo = track(new THREE.TorusGeometry(0.56, 0.024, 8, 28));
  const ringA = new THREE.Mesh(ringGeo, ringMat);
  ringA.rotation.set(0.85, 0.3, 0.4);
  const ringB = new THREE.Mesh(ringGeo, ringMat);
  ringB.rotation.set(-0.75, 0.6, -0.5);

  const electronGeo = track(new THREE.SphereGeometry(0.065, 8, 8));
  const electronMat = track(new THREE.MeshBasicMaterial({ color: 0xfef08a }));
  const e1 = new THREE.Mesh(electronGeo, electronMat);
  e1.position.set(0.56, 0, 0);
  ringA.add(e1);
  const e2 = new THREE.Mesh(electronGeo, electronMat);
  e2.position.set(-0.56, 0, 0);
  ringB.add(e2);

  group.add(ringA, ringB);
  return {
    group,
    update(t: number) {
      core.rotation.y = t * 0.9;
      ringA.rotation.z = t * 1.1;
      ringB.rotation.z = -t * 0.95;
    },
  };
}

/** Mini cubo mágico 3D em uma única draw call (6 faces coloridas). */
function buildMiniCube(track: <T extends { dispose: () => void }>(item: T) => T) {
  const geo = track(new THREE.BoxGeometry(0.58, 0.58, 0.58));
  const colors = [0xef4444, 0xf97316, 0xf8fafc, 0xfbbf24, 0x22c55e, 0x3b82f6];
  const mats = colors.map((hex) =>
    track(new THREE.MeshPhongMaterial({ color: hex, specular: 0xffffff, shininess: 110 })),
  );
  const mesh = new THREE.Mesh(geo, mats);
  const edges = new THREE.LineSegments(
    track(new THREE.EdgesGeometry(geo)),
    track(new THREE.LineBasicMaterial({ color: 0x161925 })),
  );
  mesh.add(edges);
  return {
    group: mesh,
    update(t: number) {
      mesh.rotation.x = 0.55 + Math.sin(t * 0.8) * 0.35;
      mesh.rotation.y = t * 0.8;
    },
  };
}

/** Cristal facetado 3D (estrela de conquista). */
function buildCrystal(track: <T extends { dispose: () => void }>(item: T) => T) {
  const group = new THREE.Group();
  const gem = new THREE.Mesh(
    track(new THREE.OctahedronGeometry(0.4, 0)),
    track(new THREE.MeshPhongMaterial({ color: 0xffd166, emissive: 0x6b4200, specular: 0xffffff, shininess: 120, flatShading: true })),
  );
  gem.scale.set(0.85, 1.25, 0.85);
  const halo = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.56, 0.016, 8, 28)),
    track(new THREE.MeshBasicMaterial({ color: 0xff9eb5 })),
  );
  halo.rotation.x = Math.PI / 2.3;
  group.add(gem, halo);
  return {
    group,
    update(t: number) {
      gem.rotation.y = -t * 1.05;
      gem.rotation.z = Math.sin(t * 1.2) * 0.16;
      halo.rotation.z = t * 0.7;
    },
  };
}

/** Aviãozinho de papel 3D. */
function buildPaperPlane(track: <T extends { dispose: () => void }>(item: T) => T) {
  const geo = track(new THREE.BufferGeometry());
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        0, 0, 0.52, -0.34, 0.02, -0.3, 0, 0.05, -0.18,
        0, 0, 0.52, 0.34, 0.02, -0.3, 0, 0.05, -0.18,
        0, 0, 0.52, 0, 0.05, -0.18, 0, -0.14, -0.24,
      ],
      3,
    ),
  );
  geo.computeVertexNormals();
  return new THREE.Mesh(
    geo,
    track(new THREE.MeshPhongMaterial({ color: 0xf8fafc, emissive: 0x2c3eb8, specular: 0xffffff, shininess: 70, side: THREE.DoubleSide })),
  );
}

export default function Splash3D() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = hostRef.current;
    if (!container) return;
    let disposed = false;
    const dark = !document.documentElement.classList.contains("theme-light");

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(renderer.domElement);

    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(item: T) => {
      disposables.push(item);
      return item;
    };

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1.6, 0.1, 40);
    camera.position.set(0, 0, 10.5);

    scene.add(new THREE.HemisphereLight(0xeef4ff, 0x1a2238, 0.95));
    const key = new THREE.DirectionalLight(0xfff6e8, 1.35);
    key.position.set(4, 6, 7);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x889aff, 0.95);
    rim.position.set(-6, 3, -5);
    scene.add(rim);

    const sparks = createSparkParticles(dark, track);
    scene.add(sparks.points);

    const stage = new THREE.Group();
    scene.add(stage);

    const atom = buildAtom(track);
    atom.group.position.set(-4.35, 1.65, -0.6);
    stage.add(atom.group);

    const crystal = buildCrystal(track);
    crystal.group.position.set(4.55, 1.5, -0.8);
    stage.add(crystal.group);

    const cube = buildMiniCube(track);
    cube.group.position.set(-4.2, -1.75, -0.4);
    stage.add(cube.group);

    const plane = buildPaperPlane(track);
    plane.position.set(-7, -1, 0.5);
    stage.add(plane);

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (event: PointerEvent) => {
      pointer.tx = (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      pointer.ty = -((event.clientY / Math.max(1, window.innerHeight)) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const resize = () => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const spread = Math.min(1, Math.max(0.55, camera.aspect / 1.65));
      atom.group.position.x = -4.35 * spread;
      crystal.group.position.x = 4.55 * spread;
      cube.group.position.x = -4.2 * spread;
      cube.group.visible = w >= 640;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const start = performance.now();
    const clock = new THREE.Clock();
    const pNow = new THREE.Vector3();
    const pAhead = new THREE.Vector3();
    let raf = 0;

    const tick = () => {
      raf = 0;
      if (disposed) return;
      const dt = Math.min(0.05, clock.getDelta());
      const elapsed = (performance.now() - start) / 1000;

      const intro = Math.min(1, elapsed / 0.75);
      const easeOut = 1 - Math.pow(1 - intro, 3);
      atom.group.scale.setScalar(easeOut);
      crystal.group.scale.setScalar(Math.min(1, Math.max(0, (elapsed - 0.1) / 0.75)));
      cube.group.scale.setScalar(Math.min(1, Math.max(0, (elapsed - 0.2) / 0.75)));

      const sinceOpen = Math.max(0, elapsed - 1.25);
      const burst = sinceOpen > 0 ? Math.sin(Math.min(1, sinceOpen / 0.85) * Math.PI) * Math.exp(-sinceOpen * 0.9) : 0;

      sparks.material.uniforms.uTime.value = elapsed;
      sparks.material.uniforms.uBurst.value = burst;

      atom.update(elapsed);
      atom.group.position.y = 1.65 + Math.sin(elapsed * 1.4) * 0.14;

      crystal.update(elapsed);
      crystal.group.position.y = 1.5 + Math.cos(elapsed * 1.3) * 0.16;

      cube.update(elapsed);
      cube.group.position.y = -1.75 + Math.sin(elapsed * 1.15 + 1.2) * 0.13;

      const ft = elapsed * 0.42;
      const fx = -5.8 + (ft % 2.4) * 5.2;
      const fy = -0.8 + Math.sin(ft * 2.1) * 1.85;
      const fz = -0.2 + Math.cos(ft * 1.8) * 1.2;
      pNow.set(fx, fy, fz);
      pAhead.set(-5.8 + ((ft + 0.03) % 2.4) * 5.2, -0.8 + Math.sin((ft + 0.03) * 2.1) * 1.85, -0.2 + Math.cos((ft + 0.03) * 1.8) * 1.2);
      plane.position.copy(pNow);
      plane.lookAt(pAhead);
      plane.rotateZ(-0.28);
      plane.visible = elapsed > 0.35;

      pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 5);
      pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 5);
      stage.rotation.y = pointer.x * 0.1;
      stage.rotation.x = -pointer.y * 0.06;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="splash-3d-layer" aria-hidden="true" />;
}
