/**
 * Taça 3D da Liga da Temporada (three.js), no estilo "Caderno vivo".
 *
 * Uma taça de verdade (perfil torneado com LatheGeometry, alças e base),
 * com a gema da liga cravada na frente, em cima de um pedestal de papel com
 * aro de caneta. O metal, a gema e os enfeites sobem com a liga:
 *   explorador → taça de grafite com gema de vidro
 *   bronze/prata/ouro → metal da cor da liga, ouro ganha estrela e brilhos
 *   diamante/lendário → metal iridescente, anéis em órbita e brilhos
 * Arraste para girar (com inércia). Só é carregada pelo portão em ./Games3D.tsx.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { corDoToken, criarPalco } from "../cena3d/palco";

export type LeagueId = "explorador" | "bronze" | "prata" | "ouro" | "diamante" | "lendario" | string;

const RANK: Record<string, number> = { explorador: 0, bronze: 1, prata: 2, ouro: 3, diamante: 4, lendario: 5 };

/** Perfil da taça (raio, altura), de baixo para cima; o Lathe gira em volta do eixo Y. */
function perfilTaca() {
  const p: Array<[number, number]> = [
    [0.0, -0.98], [0.46, -0.98], [0.48, -0.94], [0.46, -0.88], [0.3, -0.84], [0.26, -0.78],
    [0.12, -0.7], [0.09, -0.52], [0.09, -0.34], [0.15, -0.26], [0.13, -0.2],
    [0.2, -0.14], [0.42, -0.02], [0.56, 0.18], [0.62, 0.4], [0.64, 0.62], [0.66, 0.7], [0.62, 0.72],
    [0.58, 0.64], [0.55, 0.42], [0.48, 0.2], [0.3, 0.02], [0.0, -0.04],
  ];
  return p.map(([x, y]) => new THREE.Vector2(x, y));
}

function estrela(raioFora: number, raioDentro: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? raioFora : raioDentro;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

export default function LeagueTrophy3D({
  leagueId,
  color,
  size = "md",
}: {
  leagueId: LeagueId;
  color: string;
  size?: "sm" | "md";
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const rank = RANK[leagueId] ?? 0;
    const root = new THREE.Group();
    const taca = new THREE.Group();
    const rings: THREE.Mesh[] = [];
    let gema: THREE.Object3D | null = null;
    let brilhos: THREE.Points | null = null;
    let brilhosMat: THREE.ShaderMaterial | null = null;
    let dragging = false;
    let lastX = 0;
    let spinVel = 0;
    let entrada = 0;

    const palco = criarPalco(
      host,
      (tempo, delta) => {
        // entrada: a taça sobe girando e assenta com mola (uma vez)
        entrada = Math.min(1, entrada + delta * 1.6);
        const e = 1 - Math.pow(1 - entrada, 3);
        taca.scale.setScalar(0.6 + e * 0.4);

        if (!dragging) {
          if (Math.abs(spinVel) > 0.001) {
            root.rotation.y += spinVel * delta * 60;
            spinVel *= Math.exp(-delta * 5);
          } else {
            // gira devagar e "oscila" para mostrar a gema de frente de tempos em tempos
            root.rotation.y += delta * (0.45 + (1 - e) * 4);
          }
        }
        taca.position.y = Math.sin(tempo * 1.6) * 0.05;
        if (gema) gema.rotation.z = Math.sin(tempo * 1.3) * 0.12;
        rings.forEach((ring, i) => {
          ring.rotation.z += delta * (i % 2 === 0 ? 0.5 : -0.65);
        });
        if (brilhosMat) brilhosMat.uniforms.uTime.value = tempo;
      },
      { fov: 28, z: 6.4 },
    );

    const { scene, renderer, guardar, camera } = palco;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMappingExposure = 1.15;
    camera.position.y = 0.35;
    camera.lookAt(0, -0.05, 0);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = guardar(pmrem.fromScene(new RoomEnvironment(), 0.03).texture);
    pmrem.dispose();
    scene.environmentIntensity = 1.15;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x50586a, 0.9));
    const key = new THREE.DirectionalLight(0xfff4e2, 2.2);
    key.position.set(3, 5, 5);
    scene.add(key);
    const accent = new THREE.Color(color || "#9aa8c7");
    const rim = new THREE.PointLight(accent, 6, 8, 1.6);
    rim.position.set(-2.2, 1.2, -1.6);
    scene.add(rim);

    const sheet = corDoToken("--sheet", "#f7f9fb");
    const hlYellow = corDoToken("--hl-yellow", "#f4f05a");

    const pen = corDoToken("--pen", "#1d2bb8");
    // ── metal da taça ──
    const iridescente = rank >= 4;
    const metal = guardar(
      new THREE.MeshPhysicalMaterial({
        color: rank === 0 ? new THREE.Color(0x8b93a3) : accent.clone().lerp(new THREE.Color(0xffffff), rank >= 4 ? 0.25 : 0.05),
        metalness: rank === 0 ? 0.75 : 1,
        roughness: rank === 0 ? 0.42 : rank >= 3 ? 0.16 : 0.24,
        clearcoat: rank >= 2 ? 1 : 0.4,
        clearcoatRoughness: 0.12,
        iridescence: iridescente ? 1 : rank === 3 ? 0.25 : 0,
        iridescenceIOR: 1.4,
        envMapIntensity: 1.35,
        side: THREE.DoubleSide,
      }),
    );

    const corpo = new THREE.Mesh(guardar(new THREE.LatheGeometry(perfilTaca(), 64)), metal);
    taca.add(corpo);

    // alças: meio-anéis colados nas laterais
    const alcaGeo = guardar(new THREE.TorusGeometry(0.22, 0.045, 12, 32, Math.PI));
    for (const lado of [-1, 1]) {
      const alca = new THREE.Mesh(alcaGeo, metal);
      alca.position.set(lado * 0.56, 0.36, 0);
      alca.rotation.z = -Math.PI / 2;
      // a esquerda é o espelho da direita (DoubleSide segura a normal invertida)
      alca.scale.x = lado;
      taca.add(alca);
    }

    // faixa de caneta na borda da boca: o "contorno a tinta" do caderno
    const faixa = new THREE.Mesh(guardar(new THREE.TorusGeometry(0.645, 0.016, 8, 64)), guardar(new THREE.MeshBasicMaterial({ color: pen })));
    faixa.rotation.x = Math.PI / 2;
    faixa.position.y = 0.71;
    taca.add(faixa);
    const colar = new THREE.Mesh(guardar(new THREE.TorusGeometry(0.115, 0.014, 6, 32)), faixa.material);
    colar.rotation.x = Math.PI / 2;
    colar.position.y = -0.23;
    taca.add(colar);

    // ── gema da liga, cravada na frente ──
    const gemaMat = guardar(
      new THREE.MeshPhysicalMaterial({
        color: rank === 0 ? pen : accent,
        emissive: rank === 0 ? pen : accent,
        emissiveIntensity: 0.3,
        metalness: 0,
        roughness: 0.05,
        transmission: 0.6,
        thickness: 0.4,
        ior: 1.7,
        clearcoat: 1,
        iridescence: iridescente ? 0.9 : 0.2,
      }),
    );
    const gemaGeo =
      rank >= 5 ? new THREE.IcosahedronGeometry(0.17, 0) : rank >= 4 ? new THREE.OctahedronGeometry(0.19, 0) : rank >= 2 ? new THREE.DodecahedronGeometry(0.16, 0) : new THREE.OctahedronGeometry(0.15, 0);
    gema = new THREE.Mesh(guardar(gemaGeo), gemaMat);
    gema.position.set(0, 0.3, 0.6);
    gema.scale.set(1, 1.2, 0.6);
    const engaste = new THREE.Mesh(guardar(new THREE.TorusGeometry(0.2, 0.025, 8, 32)), metal);
    engaste.position.copy(gema.position);
    engaste.position.z -= 0.02;
    engaste.rotation.y = -0.08;
    taca.add(gema, engaste);

    // ── estrela no topo a partir do ouro ──
    if (rank >= 3) {
      const geo = guardar(new THREE.ExtrudeGeometry(estrela(0.2, 0.09), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 2 }));
      geo.center();
      const est = new THREE.Mesh(geo, guardar(new THREE.MeshPhysicalMaterial({ color: hlYellow.clone().lerp(new THREE.Color(0xf59e0b), 0.45), emissive: hlYellow, emissiveIntensity: 0.35, metalness: 0.6, roughness: 0.2, clearcoat: 1 })));
      est.position.y = 1.02;
      taca.add(est);
      const haste = new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.018, 0.018, 0.28, 8)), metal);
      haste.position.y = 0.82;
      taca.add(haste);
    }

    // ── anéis em órbita para diamante e lendário ──
    const ringCount = rank >= 5 ? 2 : rank >= 4 ? 1 : 0;
    const ringMat = guardar(new THREE.MeshBasicMaterial({ color: accent.clone().lerp(new THREE.Color(0xffffff), 0.3), transparent: true, opacity: 0.85 }));
    for (let i = 0; i < ringCount; i += 1) {
      const ring = new THREE.Mesh(guardar(new THREE.TorusGeometry(1.0 + i * 0.14, 0.014, 6, 80)), ringMat);
      ring.rotation.x = Math.PI * (0.4 + i * 0.2);
      ring.rotation.y = i * 0.8;
      ring.position.y = 0.15;
      root.add(ring);
      rings.push(ring);
    }

    // ── brilhinhos (a partir do ouro): pontinhos que piscam em volta ──
    if (rank >= 3) {
      const n = 22 + rank * 4;
      const pos = new Float32Array(n * 3);
      const seed = new Float32Array(n);
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const r = 0.85 + Math.random() * 0.55;
        pos[i * 3] = Math.cos(a) * r;
        pos[i * 3 + 1] = -0.6 + Math.random() * 1.8;
        pos[i * 3 + 2] = Math.sin(a) * r;
        seed[i] = Math.random() * 6.28;
      }
      const geo = guardar(new THREE.BufferGeometry());
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
      brilhosMat = guardar(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          uniforms: { uTime: { value: 0 }, uColor: { value: hlYellow.clone().lerp(new THREE.Color(0xffffff), 0.3) }, uPx: { value: renderer.getPixelRatio() } },
          vertexShader: `attribute float aSeed; uniform float uTime; uniform float uPx; varying float vA;
            void main(){ vec3 p = position; p.y += sin(uTime*0.8 + aSeed)*0.08;
              vec4 mv = modelViewMatrix * vec4(p,1.0);
              float tw = 0.5 + 0.5*sin(uTime*2.4 + aSeed*3.0);
              gl_PointSize = (18.0 + 22.0*tw) * uPx / -mv.z; gl_Position = projectionMatrix * mv; vA = tw; }`,
          // brilho em cruz (✦), não bolinha
          fragmentShader: `uniform vec3 uColor; varying float vA;
            void main(){ vec2 c = gl_PointCoord - 0.5; float cruz = max(1.0 - abs(c.x)*14.0, 0.0)*(1.0-abs(c.y)*2.0) + max(1.0 - abs(c.y)*14.0, 0.0)*(1.0-abs(c.x)*2.0);
              float a = clamp(cruz, 0.0, 1.0) * vA; if (a < 0.02) discard; gl_FragColor = vec4(uColor, a); }`,
        }),
      );
      brilhos = new THREE.Points(geo, brilhosMat);
      root.add(brilhos);
    }

    taca.position.y = 0;
    root.add(taca);

    // ── pedestal de papel com aro de caneta ──
    const baseMat = guardar(new THREE.MeshStandardMaterial({ color: sheet, roughness: 0.9 }));
    const base = new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.72, 0.78, 0.14, 48)), baseMat);
    base.position.y = -1.08;
    scene.add(base);
    const aro = new THREE.Mesh(guardar(new THREE.TorusGeometry(0.725, 0.014, 6, 64)), guardar(new THREE.MeshBasicMaterial({ color: pen })));
    aro.rotation.x = Math.PI / 2;
    aro.position.y = -1.01;
    scene.add(aro);

    root.position.y = -0.02;
    root.rotation.y = -0.5;
    scene.add(root);

    const canvas = renderer.domElement;
    canvas.style.cursor = "grab";

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      const deltaRot = dx * 0.015;
      root.rotation.y += deltaRot;
      spinVel = THREE.MathUtils.clamp(deltaRot, -0.2, 0.2);
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      canvas.style.cursor = "grab";
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      palco.destruir();
    };
  }, [leagueId, color]);

  return <div ref={hostRef} className={`league-trophy-3d is-${size}`} aria-label={`Taça 3D da Liga ${leagueId}`} role="img" />;
}
