/**
 * Mapa 3D da Expedição ("Games com a Mine") — versão "Caderno vivo".
 *
 * Seis ilhas de papel (pilhas de folhas com contorno de caneta), cada uma com a
 * peça do seu jogo, ligadas por uma trilha tracejada que anda como
 * stroke-dashoffset. A seleção ganha um círculo de marca-texto.
 *
 * Contrato de custo (igual às outras cenas de src/cena3d):
 * - só é carregado pelo portão em ./Games3D.tsx (tier != low, sem movimento
 *   reduzido, com WebGL); o three.js fica num chunk próprio;
 * - laço parado fora da tela (criarPalco), nada de setState por quadro;
 * - hover só com mouse e só avisa o React quando o alvo muda;
 * - cores lidas dos tokens do caderno e refeitas quando o tema troca.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { corDoToken, criarPalco } from "../cena3d/palco";

export type ExpeditionNode = {
  id: string;
  name: string;
  accent: string;
  visited: boolean;
};

type Guardar = <T extends { dispose: () => void }>(res: T) => T;

type NodeRig = {
  id: string;
  group: THREE.Group;
  piece: THREE.Group;
  pieceMat: THREE.MeshPhysicalMaterial;
  halo: THREE.Mesh;
  haloMat: THREE.MeshBasicMaterial;
  from: THREE.Vector3;
  base: THREE.Vector3;
  lift: number;
  liftVel: number;
  sel: number;
  phase: number;
};

/** Fila única no palco largo; zigue-zague 3×2 quando o palco fica estreito. */
const LAYOUT_WIDE: Array<[number, number, number]> = [
  [-3.3, -0.18, 0.3],
  [-1.98, 0.36, -0.4],
  [-0.66, -0.28, 0.45],
  [0.66, 0.32, -0.3],
  [1.98, -0.22, 0.35],
  [3.3, 0.3, -0.25],
];
const LAYOUT_NARROW: Array<[number, number, number]> = [
  [-1.55, 0.92, 0],
  [0, 1.12, -0.3],
  [1.55, 0.92, 0],
  [1.55, -0.78, 0.2],
  [0, -0.58, -0.1],
  [-1.55, -0.78, 0.2],
];

function texturaSombra(guardar: Guardar) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = guardar(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A peça de cada jogo. `contorno` desenha as arestas a caneta nas peças facetadas. */
function criarPeca(id: string, mat: THREE.Material, tinta: THREE.LineBasicMaterial, guardar: Guardar) {
  const g = new THREE.Group();
  const comContorno = (geo: THREE.BufferGeometry, mesh: THREE.Mesh) => {
    const linhas = new THREE.LineSegments(guardar(new THREE.EdgesGeometry(geo, 25)), tinta);
    linhas.position.copy(mesh.position);
    linhas.rotation.copy(mesh.rotation);
    linhas.scale.copy(mesh.scale).multiplyScalar(1.005);
    g.add(mesh, linhas);
  };
  if (id === "nexo") {
    const geo = guardar(new THREE.OctahedronGeometry(0.36, 0));
    comContorno(geo, new THREE.Mesh(geo, mat));
    const orbita = new THREE.Mesh(guardar(new THREE.TorusGeometry(0.5, 0.022, 8, 48)), tinta.userData.solid as THREE.Material);
    orbita.rotation.x = Math.PI * 0.4;
    g.add(orbita);
  } else if (id === "sequencia") {
    // quatro degraus: as etapas da sequência
    const geo = guardar(new RoundedBoxGeometry(0.2, 0.2, 0.2, 2, 0.04));
    for (let i = 0; i < 4; i += 1) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(-0.3 + i * 0.2, -0.12 + i * 0.12, 0);
      comContorno(geo, m);
    }
  } else if (id === "corrida") {
    const geo = guardar(new THREE.ConeGeometry(0.3, 0.66, 6));
    comContorno(geo, new THREE.Mesh(geo, mat));
    const bandeira = new THREE.Mesh(guardar(new THREE.SphereGeometry(0.09, 16, 12)), tinta.userData.solid as THREE.Material);
    bandeira.position.y = 0.42;
    g.add(bandeira);
  } else if (id === "memoria") {
    // duas cartas viradas, uma encostada na outra
    const geo = guardar(new RoundedBoxGeometry(0.38, 0.52, 0.05, 2, 0.02));
    const a = new THREE.Mesh(geo, mat);
    a.rotation.set(0, 0.5, 0.16);
    a.position.x = -0.1;
    const b = new THREE.Mesh(geo, mat);
    b.rotation.set(0, -0.4, -0.12);
    b.position.set(0.14, -0.02, 0.06);
    comContorno(geo, a);
    comContorno(geo, b);
  } else if (id === "forca") {
    const geo = guardar(new THREE.CylinderGeometry(0.2, 0.3, 0.62, 6));
    comContorno(geo, new THREE.Mesh(geo, mat));
    const topo = new THREE.Mesh(guardar(new THREE.ConeGeometry(0.26, 0.24, 6)), mat);
    topo.position.y = 0.43;
    comContorno(topo.geometry, topo);
  } else {
    const geo = guardar(new THREE.IcosahedronGeometry(0.36, 0));
    comContorno(geo, new THREE.Mesh(geo, mat));
  }
  return g;
}

export default function ExpeditionMap3D({
  nodes,
  selectedId,
  onSelect,
  onLaunch,
  onHover,
}: {
  nodes: ExpeditionNode[];
  selectedId: string;
  onSelect: (id: string) => void;
  onLaunch?: (id: string) => void;
  onHover?: (id: string | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ selectedId, onSelect, onLaunch, onHover });
  stateRef.current = { selectedId, onSelect, onLaunch, onHover };

  const signature = useMemo(() => nodes.map((n) => `${n.id}:${n.visited ? 1 : 0}:${n.accent}`).join("|"), [nodes]);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const root = new THREE.Group();
    const pickables: THREE.Object3D[] = [];
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let rigs: NodeRig[] = [];
    let hoveredId: string | null = null;
    let narrow: boolean | null = null;
    let layoutT = 1;
    let curve: THREE.CatmullRomCurve3 | null = null;
    let trilha: THREE.Mesh | null = null;
    const orbs: THREE.Mesh[] = [];

    const palco = criarPalco(
      host,
      (tempo, delta) => {
        const { selectedId: selId } = stateRef.current;
        const { camera, pointer } = palco;

        // enquadramento: cabe a largura do arquipélago no palco, seja qual for o aspecto
        const isNarrow = camera.aspect < 1.45;
        if (isNarrow !== narrow) {
          const primeiro = narrow === null;
          narrow = isNarrow;
          rigs.forEach((rig, i) => {
            rig.from.copy(primeiro ? new THREE.Vector3(...(isNarrow ? LAYOUT_NARROW : LAYOUT_WIDE)[i]) : rig.group.position);
            rig.base.set(...(isNarrow ? LAYOUT_NARROW : LAYOUT_WIDE)[i]);
          });
          layoutT = primeiro ? 1 : 0;
          if (primeiro) {
            rigs.forEach((rig) => rig.group.position.copy(rig.base));
            rebuildTrail();
          }
        }
        const halfW = narrow ? 2.35 : 4.05;
        const halfH = narrow ? 1.95 : 1.15;
        const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const alvoZ = Math.max(halfW / (tanV * camera.aspect), halfH / tanV);
        camera.position.z += (alvoZ - camera.position.z) * Math.min(1, delta * 6);

        if (layoutT < 1) {
          layoutT = Math.min(1, layoutT + delta * 2.2);
          if (layoutT >= 1) rebuildTrail();
        }
        const ease = 1 - Math.pow(1 - layoutT, 3);

        // paralaxe leve com o ponteiro (ou olhando para a Mine)
        root.rotation.y += (pointer.x * 0.12 - root.rotation.y) * Math.min(1, delta * 4);
        root.rotation.x += (0.2 - pointer.y * 0.07 - root.rotation.x) * Math.min(1, delta * 4);

        for (const rig of rigs) {
          const isSel = rig.id === selId;
          const isHov = rig.id === hoveredId;
          const alvo = isHov ? 0.3 : isSel ? 0.18 : 0;
          rig.liftVel += ((alvo - rig.lift) * 240 - rig.liftVel * 19) * delta;
          rig.lift += rig.liftVel * delta;
          const bob = Math.sin(tempo * 1.5 + rig.phase) * 0.05;
          rig.group.position.lerpVectors(rig.from, rig.base, ease);
          rig.piece.position.y = 0.36 + rig.lift + bob;
          rig.piece.rotation.y += delta * (isHov ? 1.6 : isSel ? 0.8 : 0.32);

          rig.sel += ((isSel ? 1 : 0) - rig.sel) * Math.min(1, delta * 7);
          // marca-texto: o círculo "pinta" de 0 a 1 quando seleciona
          rig.halo.scale.setScalar(0.55 + rig.sel * 0.5);
          rig.halo.rotation.z += delta * 0.4;
          rig.haloMat.opacity = rig.sel * 0.85;
          const brilho = isSel ? 0.32 : isHov ? 0.24 : 0.06;
          rig.pieceMat.emissiveIntensity += (brilho - rig.pieceMat.emissiveIntensity) * Math.min(1, delta * 8);
        }

        trilhaMat.uniforms.uTime.value = tempo;
        if (trilha) trilha.visible = layoutT >= 1;
        orbs.forEach((orb) => (orb.visible = layoutT >= 1));
        // o carimbo do primeiro rAF pode vir antes do início do relógio: tempo < 0
        if (curve && layoutT >= 1 && Number.isFinite(tempo)) {
          orbs.forEach((orb, i) => {
            const u = (((tempo * 0.07 + i / orbs.length) % 1) + 1) % 1;
            curve!.getPointAt(u, orb.position);
            orb.position.y += 0.02;
          });
        }
        poeiraMat.uniforms.uTime.value = tempo;
      },
      { fov: 30, z: 11 },
    );

    const { scene, renderer, guardar } = palco;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMappingExposure = 1.08;

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = guardar(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
    pmrem.dispose();
    scene.environmentIntensity = 0.6;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 1.1));
    const key = new THREE.DirectionalLight(0xfff6ea, 1.6);
    key.position.set(3, 7, 6);
    scene.add(key);

    // ── cores do caderno ──
    const cores = {
      sheet: new THREE.Color(),
      pen: new THREE.Color(),
      rule: new THREE.Color(),
      hlYellow: new THREE.Color(),
      hlMint: new THREE.Color(),
      text: new THREE.Color(),
    };
    const lerCores = () => {
      cores.sheet.copy(corDoToken("--sheet", "#f7f9fb"));
      cores.pen.copy(corDoToken("--pen", "#1d2bb8"));
      cores.rule.copy(corDoToken("--rule", "#cbd7e6"));
      cores.hlYellow.copy(corDoToken("--hl-yellow", "#f4f05a"));
      cores.hlMint.copy(corDoToken("--hl-mint", "#8df7b4"));
      cores.text.copy(corDoToken("--theme-text", "#16181d"));
    };
    lerCores();
    const escuro = () => !document.documentElement.classList.contains("theme-light");

    const papelMat = guardar(new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 }));
    const papelBaixoMat = guardar(new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 }));
    const tinta = guardar(new THREE.LineBasicMaterial({ transparent: true, opacity: 0.9 }));
    const tintaSolida = guardar(new THREE.MeshBasicMaterial());
    tinta.userData.solid = tintaSolida;
    const sombraMat = guardar(new THREE.MeshBasicMaterial({ map: texturaSombra(guardar), transparent: true, depthWrite: false }));
    const orbMat = guardar(new THREE.MeshBasicMaterial());

    const trilhaMat = guardar(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uOpacity: { value: 0.8 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        // traço de caneta tracejado que anda (o stroke-dashoffset das telas 2D)
        fragmentShader: `
          uniform float uTime; uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
          void main(){
            float d = fract(vUv.x * 46.0 - uTime * 0.6);
            if (d > 0.58) discard;
            gl_FragColor = vec4(uColor, uOpacity);
          }`,
      }),
    );

    // poeira de grafite: pontinhos de tinta flutuando, sem blending aditivo
    // (aditivo some no papel branco)
    const nPoeira = 40;
    const pos = new Float32Array(nPoeira * 3);
    const seeds = new Float32Array(nPoeira);
    for (let i = 0; i < nPoeira; i += 1) {
      pos[i * 3] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 4.4;
      pos[i * 3 + 2] = -1.2 - Math.random() * 1.6;
      seeds[i] = Math.random() * 6.28;
    }
    const poeiraGeo = guardar(new THREE.BufferGeometry());
    poeiraGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    poeiraGeo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    const poeiraMat = guardar(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uPx: { value: renderer.getPixelRatio() } },
        vertexShader: `
          attribute float aSeed; uniform float uTime; uniform float uPx; varying float vA;
          void main(){
            vec3 p = position; p.y += sin(uTime*0.5 + aSeed)*0.14; p.x += cos(uTime*0.3 + aSeed)*0.08;
            vec4 mv = modelViewMatrix * vec4(p,1.0);
            gl_PointSize = (26.0 + 10.0*sin(aSeed*3.0)) * uPx / -mv.z;
            gl_Position = projectionMatrix * mv;
            vA = 0.25 + 0.3*(0.5+0.5*sin(uTime*1.2 + aSeed*2.0));
          }`,
        fragmentShader: `
          uniform vec3 uColor; varying float vA;
          void main(){ float d = distance(gl_PointCoord, vec2(0.5)); if (d > 0.5) discard; gl_FragColor = vec4(uColor, vA * smoothstep(0.5, 0.2, d)); }`,
      }),
    );
    scene.add(new THREE.Points(poeiraGeo, poeiraMat));

    const pintar = () => {
      lerCores();
      const dark = escuro();
      papelMat.color.copy(cores.sheet).lerp(new THREE.Color(0xffffff), dark ? 0.06 : 0);
      papelBaixoMat.color.copy(cores.sheet).lerp(cores.rule, dark ? 0.5 : 0.35);
      tinta.color.copy(cores.pen);
      tintaSolida.color.copy(cores.pen);
      sombraMat.opacity = dark ? 0.9 : 0.45;
      orbMat.color.copy(cores.hlMint);
      trilhaMat.uniforms.uColor.value.copy(cores.pen);
      trilhaMat.uniforms.uOpacity.value = dark ? 0.75 : 0.7;
      poeiraMat.uniforms.uColor.value.copy(cores.pen);
      rigs.forEach((rig) => rig.haloMat.color.copy(cores.hlYellow));
      renderer.toneMappingExposure = dark ? 1.15 : 1.02;
    };

    // ── ilhas ──
    const folhaGeo = guardar(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 6, 1));
    const aroGeo = guardar(new THREE.EdgesGeometry(folhaGeo, 30));
    const sombraGeo = guardar(new THREE.PlaneGeometry(1.9, 1.9));
    const haloGeo = guardar(new THREE.RingGeometry(0.72, 0.86, 48, 1, 0.3, Math.PI * 1.85));
    const hitGeo = guardar(new THREE.SphereGeometry(0.72, 10, 8));
    const hitMat = guardar(new THREE.MeshBasicMaterial({ visible: false }));

    rigs = nodesRef.current.slice(0, 6).map((node, index) => {
      const group = new THREE.Group();
      // três folhas empilhadas, cada uma girada um pouco: um bloquinho de papel
      for (let f = 0; f < 3; f += 1) {
        const folha = new THREE.Mesh(folhaGeo, f === 2 ? papelMat : papelBaixoMat);
        folha.position.y = -0.1 + f * 0.055;
        folha.rotation.y = f * 0.17 + index * 0.4;
        group.add(folha);
        if (f === 2) {
          const aro = new THREE.LineSegments(aroGeo, tinta);
          aro.position.copy(folha.position);
          aro.rotation.copy(folha.rotation);
          group.add(aro);
        }
      }
      const sombra = new THREE.Mesh(sombraGeo, sombraMat);
      sombra.rotation.x = -Math.PI / 2;
      sombra.position.y = -0.16;
      group.add(sombra);

      const haloMat = guardar(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.04;
      group.add(halo);

      const accent = new THREE.Color(node.accent);
      const pieceMat = guardar(
        new THREE.MeshPhysicalMaterial({
          color: node.visited ? accent : accent.clone().lerp(new THREE.Color(0xb9c0cc), 0.3),
          emissive: accent,
          emissiveIntensity: 0.06,
          roughness: 0.38,
          metalness: 0.05,
          clearcoat: 0.7,
          clearcoatRoughness: 0.25,
        }),
      );
      const piece = criarPeca(node.id, pieceMat, tinta, guardar);
      piece.position.y = 0.36;
      group.add(piece);

      if (node.visited) {
        // visto: um "✓" de caneta espetado na beira da folha
        const check = new THREE.Mesh(guardar(new THREE.SphereGeometry(0.075, 12, 10)), orbMat);
        check.position.set(0.5, 0.05, 0.28);
        group.add(check);
      }

      const hit = new THREE.Mesh(hitGeo, hitMat);
      hit.position.y = 0.25;
      hit.userData.nodeId = node.id;
      group.add(hit);
      pickables.push(hit);

      root.add(group);
      const base = new THREE.Vector3(...LAYOUT_WIDE[index]);
      return { id: node.id, group, piece, pieceMat, halo, haloMat, from: new THREE.Vector3(), base, lift: 0, liftVel: 0, sel: 0, phase: index * 1.1 };
    });

    const orbGeo = guardar(new THREE.SphereGeometry(0.06, 12, 10));
    for (let i = 0; i < 2; i += 1) {
      const orb = new THREE.Mesh(orbGeo, orbMat);
      root.add(orb);
      orbs.push(orb);
    }

    let trilhaGeo: THREE.TubeGeometry | null = null;
    function rebuildTrail() {
      const pts = rigs.map((rig) => new THREE.Vector3(rig.base.x, rig.base.y - 0.02, rig.base.z));
      if (pts.length < 2) return;
      curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
      trilhaGeo?.dispose();
      trilhaGeo = new THREE.TubeGeometry(curve, 160, 0.022, 6, false);
      if (!trilha) {
        trilha = new THREE.Mesh(trilhaGeo, trilhaMat);
        trilha.renderOrder = -1;
        root.add(trilha);
      } else trilha.geometry = trilhaGeo;
    }

    pintar();
    scene.add(root);

    const tema = new MutationObserver(pintar);
    tema.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });

    const canvas = renderer.domElement;
    const alvoEm = (e: PointerEvent | MouseEvent): string | null => {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
      raycaster.setFromCamera(ndc, palco.camera);
      return (raycaster.intersectObjects(pickables, false)[0]?.object.userData.nodeId as string | undefined) ?? null;
    };
    const setHover = (id: string | null) => {
      if (id === hoveredId) return;
      hoveredId = id;
      canvas.style.cursor = id ? "pointer" : "default";
      stateRef.current.onHover?.(id);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      setHover(alvoEm(e));
    };
    const onLeave = () => setHover(null);
    const onClick = (e: MouseEvent) => {
      const id = alvoEm(e);
      if (!id) return;
      if (id === stateRef.current.selectedId && stateRef.current.onLaunch) stateRef.current.onLaunch(id);
      else stateRef.current.onSelect(id);
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("click", onClick);

    return () => {
      tema.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("click", onClick);
      trilhaGeo?.dispose();
      palco.destruir();
    };
  }, [signature]);

  return <div ref={hostRef} className="games-map3d-canvas" aria-hidden />;
}
