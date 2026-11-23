/**
 * Taça 3D da Liga da Temporada (three.js), no estilo "Caderno vivo".
 *
 * Uma taça de verdade (perfil torneado suave com LatheGeometry, alças em S
 * com afinamento e rebites, nó na haste e pé em degraus), com uma gema
 * lapidada em corte brilhante (refração, dispersão e engaste com 4 garras)
 * cravada na frente, flutuando sobre um pedestal laqueado com friso de metal
 * e aro de caneta.
 *
 * A luz vem de um estúdio HDR procedural (src/cena3d/estudio.ts): reflexos
 * nítidos e contraste real de metal, com textura escovada de torno mecânico.
 *
 * O metal, a gema e os enfeites sobem com a liga:
 *   explorador → estanho/titânio escovado com gema tinta de caneta
 *   bronze/prata/ouro → metal da cor da liga; ouro ganha estrela e brilhos ✦
 *   diamante/lendário → metal iridescente, anéis-cometa em órbita e brilhos ✦
 * Arraste para girar (com inércia); o mouse inclina de leve.
 * Só é carregada pelo portão em ./Games3D.tsx.
 */
import type React from "react";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { criarAmbienteEstudio, texturaMetalEscovado, texturaSombraContato } from "../cena3d/estudio";
import { corDoToken, criarPalco } from "../cena3d/palco";

export type LeagueId = "explorador" | "bronze" | "prata" | "ouro" | "diamante" | "lendario" | string;

const RANK: Record<string, number> = { explorador: 0, bronze: 1, prata: 2, ouro: 3, diamante: 4, lendario: 5 };

/** Refletância (F0) de cada metal, por liga. Metal = cor do reflexo, não do difuso. */
const METAL: Array<{ cor: number; rugosidade: number; clearcoat: number; iridescencia: number }> = [
  { cor: 0x9aa4b8, rugosidade: 0.3, clearcoat: 0.35, iridescencia: 0 }, // explorador: estanho/titânio escovado
  { cor: 0xd9864e, rugosidade: 0.24, clearcoat: 0.55, iridescencia: 0 }, // bronze polido
  { cor: 0xf0f3f8, rugosidade: 0.12, clearcoat: 1, iridescencia: 0 }, // prata espelhada
  { cor: 0xffc452, rugosidade: 0.1, clearcoat: 1, iridescencia: 0.18 }, // ouro 24k
  { cor: 0xd8f8ff, rugosidade: 0.08, clearcoat: 1, iridescencia: 1 }, // diamante
  { cor: 0xe4c6ff, rugosidade: 0.09, clearcoat: 1, iridescencia: 1 }, // lendário
];

/** Curva suave (Catmull-Rom centrípeta) por pontos de controle, amostrada em `n` pontos 2D. */
function suave(pontos: Array<[number, number]>, n: number) {
  const curva = new THREE.CatmullRomCurve3(
    pontos.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    false,
    "centripetal",
  );
  return curva.getPoints(n).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
}

/** Perfil da taça (raio, altura), de baixo para cima e voltando por dentro da boca. */
function perfilTaca() {
  return suave(
    [
      // pé: disco com borda arredondada e um degrau
      [0.0, -0.98], [0.3, -0.98], [0.44, -0.978], [0.475, -0.962], [0.482, -0.94], [0.472, -0.918], [0.44, -0.905],
      [0.36, -0.895], [0.335, -0.875], [0.33, -0.848], [0.3, -0.83],
      // cúpula subindo até a haste
      [0.2, -0.79], [0.12, -0.73], [0.088, -0.65],
      // haste com nó central torneado
      [0.074, -0.53], [0.074, -0.43], [0.09, -0.385], [0.138, -0.35], [0.148, -0.32], [0.138, -0.29], [0.09, -0.258],
      [0.072, -0.22], [0.082, -0.165],
      // bojo
      [0.13, -0.12], [0.27, -0.06], [0.42, 0.04], [0.53, 0.19], [0.595, 0.37], [0.63, 0.55], [0.655, 0.69],
      // lábio da boca
      [0.672, 0.718], [0.668, 0.738], [0.648, 0.738], [0.632, 0.72],
      // parede interna
      [0.612, 0.6], [0.582, 0.42], [0.522, 0.25], [0.42, 0.11], [0.27, 0.01], [0.12, -0.022], [0.0, -0.03],
    ],
    260,
  );
}

/** Alça em S: tubo que afina nas pontas e engrossa na curva. */
function alcaGeo(lado: 1 | -1) {
  const curva = new THREE.CatmullRomCurve3(
    [
      [0.628, 0.6], [0.74, 0.665], [0.885, 0.63], [0.94, 0.5], [0.89, 0.36], [0.76, 0.24], [0.62, 0.18], [0.505, 0.16],
    ].map(([x, y]) => new THREE.Vector3(x * lado, y, 0)),
    false,
    "centripetal",
  );
  const segs = 72;
  const radial = 14;
  const geo = new THREE.TubeGeometry(curva, segs, 1, radial, false);
  const pos = geo.attributes.position;
  const centro = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= segs; i += 1) {
    const u = i / segs;
    curva.getPointAt(u, centro);
    const raio = 0.024 + 0.022 * Math.sin(Math.PI * Math.min(1, u * 1.15));
    for (let j = 0; j <= radial; j += 1) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(centro).normalize().multiplyScalar(raio).add(centro);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/** Gema em corte brilhante (coroa + mesa + pavilhão), facetada. A mesa olha para +Y. */
function gemaGeo(facetas: number) {
  const perfil = [
    [0.0, -0.15], // culaça
    [0.165, -0.012],
    [0.17, 0.0], // cintura
    [0.17, 0.012],
    [0.115, 0.07],
    [0.085, 0.082], // mesa
    [0.0, 0.082],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(perfil, facetas);
  const solta = geo.toNonIndexed();
  geo.dispose();
  solta.computeVertexNormals();
  return solta;
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
    const pequeno = size === "sm";
    const claro = document.documentElement.classList.contains("theme-light");
    const root = new THREE.Group();
    const giro = new THREE.Group();
    const taca = new THREE.Group();
    const aneis: Array<{ mesh: THREE.Mesh; mat: THREE.ShaderMaterial; vel: number }> = [];
    let gema: THREE.Object3D | null = null;
    let brilhosMat: THREE.ShaderMaterial | null = null;
    let auraMat: THREE.MeshBasicMaterial | null = null;
    let sombraTaca: THREE.Mesh | null = null;
    let estrelaMesh: THREE.Object3D | null = null;
    let dragging = false;
    let lastX = 0;
    let spinVel = 0;
    let entrada = 0;

    const palco = criarPalco(
      host,
      (tempo, delta) => {
        // entrada: a taça sobe girando e assenta com leve overshoot
        entrada = Math.min(1, entrada + delta * 1.4);
        const e = 1 - Math.pow(1 - entrada, 3);
        const mola = 1 + Math.sin(entrada * Math.PI) * 0.06;
        taca.scale.setScalar((0.55 + e * 0.45) * mola);

        if (!dragging) {
          if (Math.abs(spinVel) > 0.001) {
            giro.rotation.y += spinVel * delta * 60;
            spinVel *= Math.exp(-delta * 4);
          } else {
            giro.rotation.y += delta * (0.4 + (1 - e) * 5);
          }
        }
        // o ponteiro (ou a Mine passando) inclina a taça de leve
        root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, -palco.pointer.y * 0.12, Math.min(1, delta * 6));
        root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, -palco.pointer.x * 0.06, Math.min(1, delta * 6));

        // flutua acima do pedestal; a sombra de contato responde à altura
        const flut = (Math.sin(tempo * 1.5) * 0.5 + 0.5) * 0.06;
        taca.position.y = 0.035 + flut;
        if (sombraTaca) {
          const s = 1 - flut * 2.2;
          sombraTaca.scale.set(s, s, 1);
          (sombraTaca.material as THREE.MeshBasicMaterial).opacity = 0.55 - flut * 3;
        }
        if (gema) gema.rotation.y = tempo * 0.65;
        if (estrelaMesh) estrelaMesh.rotation.y = -giro.rotation.y + Math.sin(tempo * 1.1) * 0.5;
        if (auraMat) auraMat.opacity = 0.48 + Math.sin(tempo * 2.2) * 0.18;
        aneis.forEach(({ mesh, mat, vel }) => {
          mesh.rotation.z += delta * vel;
          mat.uniforms.uTime.value = tempo;
        });
        if (brilhosMat) brilhosMat.uniforms.uTime.value = tempo;
      },
      { fov: 26, z: 6.6 },
    );

    const { scene, renderer, guardar, camera } = palco;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, pequeno ? 2 : 1.75));
    // Neutral preserva o amarelo do ouro e o roxo do lendário sem desbotar
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = claro ? 1.06 : 1.02;
    camera.position.set(0, 1.55, 6.4);
    camera.lookAt(0, -0.12, 0);

    const accent = new THREE.Color(color || "#9aa8c7");

    // ── luz: estúdio HDR no PMREM + chave quente + recorte na cor da liga ──
    scene.environment = guardar(
      criarAmbienteEstudio(renderer, { acento: accent, modo: claro ? "claro" : "escuro", sigma: 0.015 }),
    );
    scene.environmentIntensity = 1.05;

    const key = new THREE.DirectionalLight(0xfff1dc, 1.65);
    key.position.set(3, 5, 4);
    scene.add(key);
    const rim = new THREE.PointLight(accent, 9.5, 9, 1.6);
    rim.position.set(-2.4, 1.4, -2);
    scene.add(rim);

    const hlYellow = corDoToken("--hl-yellow", "#f4f05a");
    const pen = corDoToken("--pen", "#1d2bb8");

    // ── metal da taça com textura escovada de torno ──
    const escovado = guardar(texturaMetalEscovado());
    const def = METAL[Math.min(rank, METAL.length - 1)];
    const metal = guardar(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(def.cor),
        metalness: 1,
        roughness: def.rugosidade,
        roughnessMap: escovado,
        clearcoat: def.clearcoat,
        clearcoatRoughness: 0.06,
        iridescence: def.iridescencia,
        iridescenceIOR: 1.6,
        iridescenceThicknessRange: [180, 520],
        envMapIntensity: 1.3,
        side: THREE.DoubleSide,
      }),
    );
    // metal mais escuro e acetinado para frisos, rebites e engastes
    const metalEscuro = guardar(metal.clone());
    metalEscuro.color.multiplyScalar(0.76);
    metalEscuro.roughness = Math.min(0.52, def.rugosidade + 0.16);

    const corpo = new THREE.Mesh(guardar(new THREE.LatheGeometry(perfilTaca(), pequeno ? 56 : 88)), metal);
    taca.add(corpo);

    // alças em S + rebites que escondem a emenda com o bojo
    const botaoGeo = guardar(new THREE.SphereGeometry(0.045, 16, 12));
    for (const lado of [-1, 1] as const) {
      taca.add(new THREE.Mesh(guardar(alcaGeo(lado)), metal));
      for (const [x, y] of [[0.632, 0.6], [0.508, 0.16]]) {
        const b = new THREE.Mesh(botaoGeo, metalEscuro);
        b.position.set(x * lado, y, 0);
        b.scale.set(0.7, 1, 1);
        taca.add(b);
      }
    }

    // frisos: tinta de caneta na boca (assinatura do caderno) e colar de metal no bojo
    const faixa = new THREE.Mesh(
      guardar(new THREE.TorusGeometry(0.668, 0.012, 8, 96)),
      guardar(new THREE.MeshBasicMaterial({ color: pen })),
    );
    faixa.rotation.x = Math.PI / 2;
    faixa.position.y = 0.728;
    taca.add(faixa);
    const friso = new THREE.Mesh(guardar(new THREE.TorusGeometry(0.47, 0.016, 10, 96)), metalEscuro);
    friso.rotation.x = Math.PI / 2;
    friso.position.y = 0.085;
    taca.add(friso);

    // ── gema lapidada em corte brilhante, cravada na frente do bojo ──
    const gemaCor = rank === 0 ? pen.clone() : accent.clone();
    const gemaMat = guardar(
      new THREE.MeshPhysicalMaterial({
        color: gemaCor.clone().lerp(new THREE.Color(0xffffff), 0.35),
        emissive: gemaCor,
        emissiveIntensity: 0.24,
        metalness: 0,
        roughness: 0.02,
        transmission: 0.94,
        thickness: 0.35,
        ior: 2.1,
        dispersion: rank >= 4 ? 0.65 : 0.28,
        attenuationColor: gemaCor,
        attenuationDistance: 0.26,
        specularIntensity: 1,
        clearcoat: 1,
        iridescence: rank >= 4 ? 0.6 : 0,
        envMapIntensity: 2.2,
        flatShading: true,
      }),
    );
    const gemaGrupo = new THREE.Group();
    gemaGrupo.position.set(0, 0.32, 0.585);
    gemaGrupo.rotation.x = 0.22;
    const pedra = new THREE.Mesh(guardar(gemaGeo(rank >= 4 ? 12 : 8)), gemaMat);
    pedra.scale.setScalar(rank >= 4 ? 1.08 : 0.96);
    const pivoGema = new THREE.Group();
    pivoGema.rotation.x = Math.PI / 2; // aponta a mesa da gema para +Z
    pivoGema.add(pedra);
    gemaGrupo.add(pivoGema);
    gema = pedra;

    // engaste: aro + 4 garras metálicas
    const aro = new THREE.Mesh(guardar(new THREE.TorusGeometry(0.17, 0.02, 10, 40)), metalEscuro);
    aro.position.z = -0.005;
    gemaGrupo.add(aro);
    const garraGeo = guardar(new THREE.SphereGeometry(0.026, 10, 8));
    for (let i = 0; i < 4; i += 1) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const garra = new THREE.Mesh(garraGeo, metal);
      garra.position.set(Math.cos(a) * 0.165, Math.sin(a) * 0.165, 0.03);
      gemaGrupo.add(garra);
    }
    taca.add(gemaGrupo);

    // ── estrela chanfrada no topo a partir do ouro ──
    if (rank >= 3) {
      const geo = guardar(
        new THREE.ExtrudeGeometry(estrela(0.2, 0.085), {
          depth: 0.05,
          bevelEnabled: true,
          bevelThickness: 0.025,
          bevelSize: 0.02,
          bevelSegments: 3,
        }),
      );
      geo.center();
      const est = new THREE.Mesh(
        geo,
        guardar(
          new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(0xffc356).lerp(hlYellow, 0.25),
            emissive: hlYellow,
            emissiveIntensity: 0.28,
            metalness: 1,
            roughness: 0.12,
            clearcoat: 1,
          }),
        ),
      );
      const suporte = new THREE.Group();
      suporte.position.y = 1.06;
      suporte.add(est);
      estrelaMesh = suporte;
      taca.add(suporte);
      const haste = new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.014, 0.022, 0.3, 10)), metalEscuro);
      haste.position.y = 0.86;
      taca.add(haste);
    }

    // ── anéis-cometa em órbita (GLSL) para diamante e lendário ──
    const ringCount = rank >= 5 ? 2 : rank >= 4 ? 1 : 0;
    for (let i = 0; i < ringCount; i += 1) {
      const mat = guardar(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: {
            uTime: { value: 0 },
            uColor: { value: accent.clone().lerp(new THREE.Color(0xffffff), 0.25) },
            uFase: { value: i * 0.5 },
          },
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
          fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uFase; varying vec2 vUv;
            void main(){ float t = fract(vUv.x - uTime*0.18 - uFase); float cauda = pow(t, 5.0);
              float base = 0.14; float a = base + cauda*1.1; gl_FragColor = vec4(uColor*(0.6 + cauda*1.4), a); }`,
        }),
      );
      const mesh = new THREE.Mesh(guardar(new THREE.TorusGeometry(1.02 + i * 0.16, 0.012, 6, 160)), mat);
      mesh.rotation.x = Math.PI * (0.42 + i * 0.16);
      mesh.rotation.y = i * 0.9 - 0.3;
      mesh.position.y = 0.2;
      root.add(mesh);
      aneis.push({ mesh, mat, vel: i % 2 === 0 ? 0.35 : -0.45 });
    }

    // ── brilhinhos (a partir do ouro): estrelinhas ✦ aditivas em volta ──
    if (rank >= 3) {
      const n = 20 + rank * 5;
      const pos = new Float32Array(n * 3);
      const seed = new Float32Array(n);
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const r = 0.85 + Math.random() * 0.6;
        pos[i * 3] = Math.cos(a) * r;
        pos[i * 3 + 1] = -0.6 + Math.random() * 1.9;
        pos[i * 3 + 2] = Math.sin(a) * r;
        seed[i] = Math.random() * 6.28;
      }
      const geo = guardar(new THREE.BufferGeometry());
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
      const corBrilho = (rank >= 4 ? accent.clone() : hlYellow.clone()).lerp(new THREE.Color(0xffffff), 0.45);
      brilhosMat = guardar(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: { uTime: { value: 0 }, uColor: { value: corBrilho }, uPx: { value: renderer.getPixelRatio() } },
          vertexShader: `attribute float aSeed; uniform float uTime; uniform float uPx; varying float vA;
            void main(){ vec3 p = position; p.y += sin(uTime*0.8 + aSeed)*0.08;
              vec4 mv = modelViewMatrix * vec4(p,1.0);
              float tw = pow(0.5 + 0.5*sin(uTime*2.2 + aSeed*3.0), 3.0);
              gl_PointSize = (14.0 + 30.0*tw) * uPx / -mv.z; gl_Position = projectionMatrix * mv; vA = tw; }`,
          fragmentShader: `uniform vec3 uColor; varying float vA;
            void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c);
              float cruz = max(1.0 - abs(c.x)*16.0, 0.0)*(1.0-abs(c.y)*2.0) + max(1.0 - abs(c.y)*16.0, 0.0)*(1.0-abs(c.x)*2.0);
              float miolo = smoothstep(0.22, 0.0, d);
              float a = clamp(cruz + miolo*0.8, 0.0, 1.0) * vA; if (a < 0.02) discard; gl_FragColor = vec4(uColor, a); }`,
        }),
      );
      giro.add(new THREE.Points(geo, brilhosMat));
    }

    giro.add(taca);
    root.add(giro);

    // ── pedestal laqueado com friso de metal e aro de caneta ──
    const pedestalGeo = guardar(
      new THREE.LatheGeometry(
        [
          [0.0, -1.3], [0.76, -1.3], [0.8, -1.285], [0.81, -1.255], [0.81, -1.13], [0.795, -1.108], [0.76, -1.098],
          [0.68, -1.09], [0.655, -1.07], [0.65, -1.03], [0.63, -1.0], [0.0, -1.0],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        pequeno ? 48 : 72,
      ),
    );
    const laca = guardar(
      new THREE.MeshPhysicalMaterial({
        color: claro ? 0x1e2536 : 0x141824,
        roughness: 0.3,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.15,
      }),
    );
    root.add(new THREE.Mesh(pedestalGeo, laca));
    const banda = new THREE.Mesh(
      guardar(new THREE.CylinderGeometry(0.814, 0.814, 0.05, pequeno ? 48 : 72, 1, true)),
      metal,
    );
    banda.position.y = -1.19;
    root.add(banda);
    const aroCaneta = new THREE.Mesh(
      guardar(new THREE.TorusGeometry(0.64, 0.011, 6, 80)),
      guardar(new THREE.MeshBasicMaterial({ color: pen })),
    );
    aroCaneta.rotation.x = Math.PI / 2;
    aroCaneta.position.y = -0.999;
    root.add(aroCaneta);

    // aura da liga no tampo do pedestal + sombras de contato
    const sombraTex = guardar(texturaSombraContato(128));
    auraMat = guardar(
      new THREE.MeshBasicMaterial({
        color: accent.clone().lerp(new THREE.Color(0xffffff), 0.2),
        alphaMap: sombraTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const aura = new THREE.Mesh(guardar(new THREE.CircleGeometry(0.62, 48)), auraMat);
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = -0.997;
    root.add(aura);

    const sombraMat = guardar(
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        alphaMap: sombraTex,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    sombraTaca = new THREE.Mesh(guardar(new THREE.PlaneGeometry(1.05, 1.05)), sombraMat);
    sombraTaca.rotation.x = -Math.PI / 2;
    sombraTaca.position.y = -0.995;
    root.add(sombraTaca);
    const sombraChao = new THREE.Mesh(
      guardar(new THREE.PlaneGeometry(2.4, 2.4)),
      guardar(
        new THREE.MeshBasicMaterial({
          color: 0x000000,
          alphaMap: sombraTex,
          transparent: true,
          opacity: claro ? 0.32 : 0.45,
          depthWrite: false,
        }),
      ),
    );
    sombraChao.rotation.x = -Math.PI / 2;
    sombraChao.position.y = -1.302;
    root.add(sombraChao);

    root.position.y = 0.02;
    giro.rotation.y = -0.5;
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
      giro.rotation.y += deltaRot;
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
  }, [leagueId, color, size]);

  return (
    <div
      ref={hostRef}
      className={`league-trophy-3d is-${size}`}
      style={{ "--league": color } as React.CSSProperties}
      aria-label={`Taça 3D da Liga ${leagueId}`}
      role="img"
    />
  );
}
