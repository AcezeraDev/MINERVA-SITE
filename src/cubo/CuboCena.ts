/**
 * Cena three.js do Cubo Mágico.
 *
 * O estado lógico mora em shared/cubo.mjs; aqui só se desenha e se lê o
 * gesto. Dois estados andam juntos: `alvo` já tem todos os giros da fila
 * (é por ele que o cronômetro sabe que o cubo foi resolvido no instante do
 * gesto) e `tela` só recebe o giro quando a animação termina, e é dele que as
 * peças tiram a posição final, sem acumular erro de ponto flutuante.
 *
 * Visual & Física:
 * - materiais PBR avançados (MeshPhysicalMaterial com clearcoat UV-coated de
 *   speedcube + peças chanfradas em ExtrudeGeometry);
 * - iluminação de estúdio 3 pontos + IBL (RoomEnvironment) + luz dinâmica que
 *   acompanha o ponteiro e pulsa a cada encaixe de camada;
 * - shaders GLSL próprios: pedestal holográfico com onda a cada giro,
 *   partículas atmosféricas suaves e explosão 3D de confete ao resolver;
 * - inércia angular ao soltar o giro do cubo + micro-recuo magnético no snap.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { criarPalco, type Palco } from "../cena3d/palco";
import {
  aplicarGiro,
  clonarCubo,
  coresHex,
  criarCubo,
  estaResolvido,
  pecaNoGiro,
  type Cubo,
  type Eixo,
  type Face,
  type Giro,
} from "../../shared/cubo.mjs";

export type Origem = "usuario" | "embaralhar" | "volta" | "aula";
export type OpcoesCena = {
  n: number;
  reduzido: boolean;
  /** Chamado quando o giro entra na fila, com o estado que ele deixa. */
  onGiro?: (giro: Giro, info: { origem: Origem; resolvido: boolean }) => void;
  /** Chamado quando a animação de um giro termina (a aula acende o passo do algoritmo). */
  onAnimado?: (giro: Giro) => void;
  /** Fila esvaziou (fim do embaralhamento, da volta…). */
  onOcioso?: () => void;
};

type Animacao = { giro: Giro; grupos: THREE.Object3D[]; alvo: number; v: number; vel: number; rapido: boolean };

const EIXOS: Eixo[] = ["x", "y", "z"];
const vetorEixo = (e: Eixo) => new THREE.Vector3(e === "x" ? 1 : 0, e === "y" ? 1 : 0, e === "z" ? 1 : 0);

/** Ladrilho 3D chanfrado de cantos redondos (speedcube UV-coated). */
function formaAdesivo(lado: number, raio: number) {
  const h = lado / 2;
  const s = new THREE.Shape();
  s.moveTo(-h + raio, -h);
  s.lineTo(h - raio, -h);
  s.quadraticCurveTo(h, -h, h, -h + raio);
  s.lineTo(h, h - raio);
  s.quadraticCurveTo(h, h, h - raio, h);
  s.lineTo(-h + raio, h);
  s.quadraticCurveTo(-h, h, -h, h - raio);
  s.lineTo(-h, -h + raio);
  s.quadraticCurveTo(-h, -h, -h + raio, -h);
  return new THREE.ExtrudeGeometry(s, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 5,
  });
}

function texturaSombra() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,0,0.48)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.16)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** Shader GLSL do halo/pedestal holográfico abaixo do cubo com pulso a cada giro. */
function criarHaloPedestal() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPulse: { value: 0 },
      uCelebrate: { value: 0 },
      uColorA: { value: new THREE.Color(0x8e9eff) },
      uColorB: { value: new THREE.Color(0x2fd483) },
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
      uniform float uPulse;
      uniform float uCelebrate;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying vec2 vUv;

      void main() {
        float dist = length(vUv - vec2(0.5)) * 2.0;
        if (dist > 1.0) discard;

        // anel de base sutil e anel externo respirando
        float innerRing = smoothstep(0.032, 0.0, abs(dist - 0.56)) * 0.28;
        float outerRing = smoothstep(0.022, 0.0, abs(dist - (0.76 + sin(uTime * 1.4) * 0.015))) * 0.16;

        // onda que dispara a cada giro ou celebração
        float waveR = 0.22 + (1.0 - uPulse) * 0.72;
        float wave = smoothstep(0.06, 0.0, abs(dist - waveR)) * uPulse * 0.72;

        float core = exp(-dist * dist * 4.2) * (0.14 + uPulse * 0.22 + uCelebrate * 0.32);
        vec3 col = mix(uColorA, uColorB, clamp(uCelebrate * 0.85 + uPulse * 0.35, 0.0, 1.0));
        float alpha = clamp(innerRing + outerRing + wave + core, 0.0, 0.78);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

/** Partículas atmosféricas sutis ao redor do cubo. */
function criarParticulasAmbiente(guardar: Palco["guardar"]) {
  const count = 54;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const r = 2.6 + Math.random() * 2.8;
    const theta = Math.random() * Math.PI * 2;
    const phi = (Math.random() - 0.5) * Math.PI * 0.75;
    positions[i * 3] = Math.cos(theta) * Math.cos(phi) * r;
    positions[i * 3 + 1] = Math.sin(phi) * r * 0.8;
    positions[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * r;
    seeds[i] = Math.random() * Math.PI * 2;
  }
  const geo = guardar(new THREE.BufferGeometry());
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  const mat = guardar(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.45 },
      },
      vertexShader: `
        attribute float aSeed;
        uniform float uTime;
        varying float vTwinkle;
        varying float vMix;
        void main() {
          vec3 p = position;
          float ang = uTime * 0.09 + aSeed;
          float c = cos(ang * 0.35);
          float s = sin(ang * 0.35);
          p.xz = mat2(c, -s, s, c) * p.xz;
          p.y += sin(uTime * 0.8 + aSeed) * 0.16;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (22.0 + 10.0 * sin(uTime * 1.4 + aSeed)) / -mv.z;
          gl_Position = projectionMatrix * mv;
          vTwinkle = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 1.9 + aSeed * 2.0));
          vMix = 0.5 + 0.5 * sin(aSeed * 4.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying float vTwinkle;
        varying float vMix;
        void main() {
          float d = distance(gl_PointCoord, vec2(0.5));
          float strength = pow(clamp(1.0 - d * 2.0, 0.0, 1.0), 2.4);
          vec3 col = mix(vec3(0.58, 0.64, 1.0), vec3(0.32, 0.92, 0.68), vMix);
          gl_FragColor = vec4(col, strength * vTwinkle * uOpacity);
        }
      `,
    }),
  );
  return { points: new THREE.Points(geo, mat), mat };
}

/** Explosão 3D de partículas nas cores do cubo ao completar a montagem. */
function criarExplosaoVitoria(guardar: Palco["guardar"]) {
  const count = 72;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = coresHex.map((hex) => new THREE.Color(hex));

  for (let i = 0; i < count; i += 1) {
    const col = palette[i % palette.length];
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  const geo = guardar(new THREE.BufferGeometry());
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mat = guardar(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: { uAlpha: { value: 0 } },
      vertexShader: `
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 54.0 / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform float uAlpha;
        varying vec3 vColor;
        void main() {
          float d = distance(gl_PointCoord, vec2(0.5));
          float strength = pow(clamp(1.0 - d * 2.0, 0.0, 1.0), 1.8);
          gl_FragColor = vec4(vColor + vec3(0.18), strength * uAlpha);
        }
      `,
    }),
  );

  const points = new THREE.Points(geo, mat);
  points.visible = false;

  return {
    points,
    mat,
    active: false,
    life: 0,
    trigger() {
      this.active = true;
      this.life = 0;
      points.visible = true;
      for (let i = 0; i < count; i += 1) {
        positions[i * 3] = (Math.random() - 0.5) * 0.6;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
        const theta = Math.random() * Math.PI * 2;
        const speed = 2.4 + Math.random() * 3.4;
        velocities[i * 3] = Math.cos(theta) * speed;
        velocities[i * 3 + 1] = 1.6 + Math.random() * 3.6;
        velocities[i * 3 + 2] = Math.sin(theta) * speed;
      }
      geo.attributes.position.needsUpdate = true;
      mat.uniforms.uAlpha.value = 1;
    },
    step(dt: number) {
      if (!this.active) return;
      this.life += dt;
      const duration = 1.45;
      if (this.life >= duration) {
        this.active = false;
        points.visible = false;
        mat.uniforms.uAlpha.value = 0;
        return;
      }
      const drag = Math.exp(-dt * 1.9);
      for (let i = 0; i < count; i += 1) {
        velocities[i * 3] *= drag;
        velocities[i * 3 + 1] = velocities[i * 3 + 1] * drag - 5.2 * dt;
        velocities[i * 3 + 2] *= drag;
        positions[i * 3] += velocities[i * 3] * dt;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
      }
      geo.attributes.position.needsUpdate = true;
      mat.uniforms.uAlpha.value = Math.max(0, 1 - Math.pow(this.life / duration, 1.5));
    },
  };
}

export class CuboCena {
  private palco: Palco;
  private opcoes: OpcoesCena;
  private n: number;
  private alvo: Cubo;
  private tela: Cubo;
  private flutua = new THREE.Group();
  private raiz = new THREE.Group();
  private pivo = new THREE.Group();
  private grupos: THREE.Group[] = [];
  private pegaveis: THREE.Object3D[] = [];
  private fila: Array<{ giro: Giro; rapido: boolean } | { pausa: number }> = [];
  private anim: Animacao | null = null;
  private alvoRaiz = new THREE.Quaternion();
  private sombra: THREE.Mesh;
  private haloMat: THREE.ShaderMaterial;
  private haloPulse = 0;
  private accentLight: THREE.PointLight;
  private ambientParticles: { points: THREE.Points; mat: THREE.ShaderMaterial };
  private burst: ReturnType<typeof criarExplosaoVitoria>;
  private festa = { ativa: false, t: 0 };
  private raycaster = new THREE.Raycaster();
  private hoveredId: number | null = null;
  private spinVel = { x: 0, y: 0 };
  private recoil = { x: 0, y: 0, vx: 0, vy: 0 };
  private gesto:
    | null
    | { tipo: "virar"; x: number; y: number; id: number }
    | { tipo: "camada"; x0: number; y0: number; id: number; grupo: THREE.Object3D; ponto: THREE.Vector3; normal: Eixo; usado: boolean } = null;
  private corpoGeo: THREE.BufferGeometry;
  private adesivoGeo: THREE.BufferGeometry;
  private corpoMat: THREE.MeshPhysicalMaterial;
  private hoverMat: THREE.MeshPhysicalMaterial;
  /** Corpo das peças da camada que a Mine pede para girar (brilha pulsando). */
  private destaqueMat: THREE.MeshPhysicalMaterial;
  private destaque: Giro | null = null;
  private destaquePecas = new Set<number>();
  private adesivoMats: THREE.MeshPhysicalMaterial[];
  /** Trava o gesto de girar camada (modo cubo de verdade, embaralhando…). */
  travado = false;

  constructor(host: HTMLElement, opcoes: OpcoesCena) {
    this.opcoes = opcoes;
    this.n = opcoes.n;
    this.alvo = criarCubo(this.n);
    this.tela = criarCubo(this.n);
    this.palco = criarPalco(host, (t, d) => this.tick(t, d), { fov: 30, z: 11 });
    const { scene, renderer, guardar } = this.palco;
    renderer.toneMappingExposure = 1.14;

    // IBL de estúdio com RoomEnvironment
    const pmrem = new THREE.PMREMGenerator(renderer);
    const ambiente = guardar(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
    pmrem.dispose();
    scene.environment = ambiente;
    scene.environmentIntensity = 0.72;

    // Iluminação 3 pontos + rim lights coloridos + luz dinâmica
    scene.add(new THREE.HemisphereLight(0xf2f6ff, 0x252d42, 0.7));
    const sol = new THREE.DirectionalLight(0xfff7ec, 1.55);
    sol.position.set(4.5, 7.5, 6.5);
    scene.add(sol);

    const rimLeft = new THREE.DirectionalLight(0x7ca2ff, 0.95);
    rimLeft.position.set(-6.5, 3.5, -5.5);
    scene.add(rimLeft);

    const rimRight = new THREE.DirectionalLight(0xc996ff, 0.55);
    rimRight.position.set(6, -2.5, -5);
    scene.add(rimRight);

    this.accentLight = new THREE.PointLight(0x8e9eff, 1.6, 12, 1.5);
    this.accentLight.position.set(0, 1.8, 4.2);
    scene.add(this.accentLight);

    // Geometrias & Materiais PBR UV-coated (clearcoat de speedcube profissional)
    this.corpoGeo = guardar(new RoundedBoxGeometry(0.96, 0.96, 0.96, 3, 0.095));
    this.adesivoGeo = guardar(formaAdesivo(0.77, 0.12));
    this.corpoMat = guardar(
      new THREE.MeshPhysicalMaterial({
        color: 0x13161e,
        roughness: 0.28,
        metalness: 0.16,
        clearcoat: 0.65,
        clearcoatRoughness: 0.16,
        envMapIntensity: 0.85,
      }),
    );
    this.hoverMat = guardar(
      new THREE.MeshPhysicalMaterial({
        color: 0x1f2538,
        emissive: new THREE.Color(0x6c7dff),
        emissiveIntensity: 0.34,
        roughness: 0.24,
        metalness: 0.2,
        clearcoat: 0.8,
        clearcoatRoughness: 0.12,
        envMapIntensity: 0.95,
      }),
    );
    this.destaqueMat = guardar(
      new THREE.MeshPhysicalMaterial({
        color: 0x2a2f5c,
        emissive: new THREE.Color(0x8b7bff),
        emissiveIntensity: 0.65,
        roughness: 0.25,
        metalness: 0.18,
        clearcoat: 0.85,
        clearcoatRoughness: 0.1,
      }),
    );
    this.adesivoMats = coresHex.map((cor) =>
      guardar(
        new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(cor),
          roughness: 0.16,
          metalness: 0.02,
          clearcoat: 1.0,
          clearcoatRoughness: 0.08,
          envMapIntensity: 0.78,
        }),
      ),
    );

    // Sombra suave + Halo holográfico GLSL no pedestal
    const sombraTex = guardar(texturaSombra());
    const sombraMat = guardar(new THREE.MeshBasicMaterial({ map: sombraTex, transparent: true, depthWrite: false }));
    this.sombra = new THREE.Mesh(guardar(new THREE.PlaneGeometry(5.5, 5.5)), sombraMat);
    this.sombra.rotation.x = -Math.PI / 2;
    this.sombra.position.y = -2.46;
    scene.add(this.sombra);

    this.haloMat = guardar(criarHaloPedestal());
    const halo = new THREE.Mesh(guardar(new THREE.PlaneGeometry(6.4, 6.4)), this.haloMat);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -2.44;
    scene.add(halo);

    // Partículas atmosféricas + explosão de vitória
    this.ambientParticles = criarParticulasAmbiente(guardar);
    this.ambientParticles.points.visible = !opcoes.reduzido;
    scene.add(this.ambientParticles.points);

    this.burst = criarExplosaoVitoria(guardar);
    scene.add(this.burst.points);

    this.raiz.add(this.pivo);
    this.flutua.add(this.raiz);
    scene.add(this.flutua);
    // de leve por cima e de lado: mostra três faces (U, F, R)
    this.alvoRaiz.copy(CuboCena.vista(false));
    this.raiz.quaternion.copy(this.alvoRaiz);
    this.montarPecas();

    const canvas = renderer.domElement;
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", this.aoApertar);
    canvas.addEventListener("pointermove", this.aoMover);
    canvas.addEventListener("pointerup", this.aoSoltar);
    canvas.addEventListener("pointercancel", this.aoSoltar);
    canvas.addEventListener("pointerleave", this.aoSair);
  }

  /* ---------- montagem ---------- */

  private montarPecas() {
    for (const g of this.grupos) g.removeFromParent();
    this.grupos = [];
    this.pegaveis = [];
    this.hoveredId = null;
    for (const peca of this.tela.pecas) {
      const grupo = new THREE.Group();
      grupo.userData.id = peca.id;
      const corpo = new THREE.Mesh(this.corpoGeo, this.corpoMat);
      grupo.userData.corpo = corpo;
      grupo.add(corpo);
      this.pegaveis.push(corpo);
      for (const a of peca.adesivos) {
        const m = new THREE.Mesh(this.adesivoGeo, this.adesivoMats[a.cor]);
        const normal = new THREE.Vector3(...a.local);
        m.position.copy(normal).multiplyScalar(0.476);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        grupo.add(m);
        this.pegaveis.push(m);
      }
      this.raiz.add(grupo);
      this.grupos[peca.id] = grupo;
      this.sincronizar(grupo);
    }
    // o cubo ocupa mais ou menos o mesmo espaço em qualquer tamanho
    this.raiz.scale.setScalar(3.05 / this.n);
    this.aplicarDestaque();
  }

  private sincronizar(grupo: THREE.Object3D) {
    const peca = this.tela.pecas[grupo.userData.id as number];
    grupo.position.set(peca.pos[0] / 2, peca.pos[1] / 2, peca.pos[2] / 2);
    const m = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(...peca.base[0]),
      new THREE.Vector3(...peca.base[1]),
      new THREE.Vector3(...peca.base[2]),
    );
    grupo.quaternion.setFromRotationMatrix(m);
  }

  /* ---------- API ---------- */

  get ocupado() {
    return this.anim !== null || this.fila.length > 0;
  }

  estado() {
    return clonarCubo(this.alvo);
  }

  setTamanho(n: number) {
    this.n = n;
    this.resetar();
  }

  /** Volta ao cubo resolvido sem animação. */
  resetar() {
    this.fila = [];
    if (this.anim) for (const g of this.anim.grupos) this.raiz.attach(g);
    this.anim = null;
    this.pivo.rotation.set(0, 0, 0);
    this.spinVel.x = 0;
    this.spinVel.y = 0;
    this.alvo = criarCubo(this.n);
    this.tela = criarCubo(this.n);
    this.montarPecas();
  }

  girar(giro: Giro, origem: Origem = "usuario", rapido = false) {
    aplicarGiro(this.alvo, giro);
    this.fila.push({ giro, rapido });
    this.opcoes.onGiro?.(giro, { origem, resolvido: estaResolvido(this.alvo) });
  }

  /** Giro pela face que a pessoa está vendo (teclado): R é sempre a da direita na tela. */
  giroVisual(face: Face, linha: 1 | -1 | 2, camadaInterna = false): Giro {
    const direcoes: Record<Face, THREE.Vector3> = {
      U: new THREE.Vector3(0, 1, 0),
      D: new THREE.Vector3(0, -1, 0),
      R: new THREE.Vector3(1, 0, 0),
      L: new THREE.Vector3(-1, 0, 0),
      F: new THREE.Vector3(0, 0, 1),
      B: new THREE.Vector3(0, 0, -1),
    };
    const inv = this.alvoRaiz.clone().invert();
    const d = direcoes[face].clone().applyQuaternion(inv);
    const comp = [Math.abs(d.x), Math.abs(d.y), Math.abs(d.z)];
    const i = comp.indexOf(Math.max(...comp));
    const eixo = EIXOS[i];
    const sinal = Math.sign([d.x, d.y, d.z][i]) || 1;
    const max = this.n - 1;
    const camada = sinal * (camadaInterna && this.n > 2 ? max - 2 : max);
    return { eixo, camada, q: linha === 2 ? 2 : -sinal * linha };
  }

  /** Faz brilhar as peças da camada deste giro (null apaga). Vale o estado que a pessoa vai ver. */
  destacar(giro: Giro | null) {
    this.destaque = giro;
    this.destaquePecas.clear();
    this.aplicarDestaque();
  }

  /** Faz brilhar peças soltas (as que faltam na etapa do método). */
  destacarPecas(ids: number[]) {
    this.destaquePecas = new Set(ids);
    if (ids.length) this.destaque = null;
    this.aplicarDestaque();
  }

  /** Para que lado da tela aponta uma direção do cubo: "de cima", "da frente"… */
  ladoNaTela(n: [number, number, number]) {
    const v = new THREE.Vector3(...n).applyQuaternion(this.alvoRaiz);
    const comp = [Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)];
    const i = comp.indexOf(Math.max(...comp));
    const positivo = [v.x, v.y, v.z][i] > 0;
    return i === 0 ? (positivo ? "da direita" : "da esquerda") : i === 1 ? (positivo ? "de cima" : "de baixo") : positivo ? "da frente" : "de trás";
  }

  private aplicarDestaque() {
    for (const peca of this.alvo.pecas) {
      const corpo = this.grupos[peca.id]?.userData.corpo as THREE.Mesh | undefined;
      if (!corpo) continue;
      const brilha = this.destaque ? pecaNoGiro(peca, this.destaque) : this.destaquePecas.has(peca.id);
      if (brilha) corpo.material = this.destaqueMat;
      else if (this.hoveredId === peca.id && !this.travado) corpo.material = this.hoverMat;
      else corpo.material = this.corpoMat;
    }
  }

  /** Pausa na fila (a aula espera um pouco entre montar o caso e mostrar a solução). */
  esperar(segundos: number) {
    this.fila.push({ pausa: segundos });
  }

  /** Orientação de partida: branco em cima, verde na frente; ou de ponta-cabeça (amarelo em cima). */
  static vista(amareloEmCima: boolean) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.52, -0.68, 0, "XYZ"));
    if (amareloEmCima) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI));
    return q;
  }

  vistaPadrao(amareloEmCima = false) {
    this.spinVel.x = 0;
    this.spinVel.y = 0;
    this.alvoRaiz.copy(CuboCena.vista(amareloEmCima));
    this.haloPulse = Math.max(this.haloPulse, 0.55);
  }

  /** Vira o cubo inteiro na tela (x, y, z ou setas), sem mexer no estado. */
  virar(eixo: Eixo, q: number) {
    const giro = new THREE.Quaternion().setFromAxisAngle(vetorEixo(eixo), (-q * Math.PI) / 2);
    this.alvoRaiz.premultiply(giro);
  }

  comemorar() {
    if (this.opcoes.reduzido) return;
    this.festa = { ativa: true, t: 0 };
    this.haloPulse = 1;
    this.burst.trigger();
  }

  setReduzido(reduzido: boolean) {
    this.opcoes.reduzido = reduzido;
    this.ambientParticles.points.visible = !reduzido;
  }

  destruir() {
    const canvas = this.palco.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.aoApertar);
    canvas.removeEventListener("pointermove", this.aoMover);
    canvas.removeEventListener("pointerup", this.aoSoltar);
    canvas.removeEventListener("pointercancel", this.aoSoltar);
    canvas.removeEventListener("pointerleave", this.aoSair);
    this.palco.destruir();
  }

  /* ---------- quadro a quadro ---------- */

  private tick(tempo: number, delta: number) {
    const { pointer, camera } = this.palco;
    // retrato estreito: afasta a câmera para o cubo caber na largura
    camera.position.z = 13 * Math.max(1, 1.15 / Math.max(0.5, camera.aspect));

    while (!this.anim && this.fila.length) {
      const proximo = this.fila[0];
      if ("pausa" in proximo) {
        proximo.pausa -= delta;
        if (proximo.pausa > 0) break;
        this.fila.shift();
        if (!this.fila.length) this.opcoes.onOcioso?.();
        continue;
      }
      this.comecarGiro();
    }
    if (this.anim) this.passoGiro(delta);

    // inércia suave ao soltar o giro do cubo inteiro
    if (!this.gesto && !this.opcoes.reduzido && (Math.abs(this.spinVel.x) > 0.0004 || Math.abs(this.spinVel.y) > 0.0004)) {
      const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.spinVel.y * delta * 60);
      const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.spinVel.x * delta * 60);
      this.alvoRaiz.premultiply(qy).premultiply(qx).normalize();
      const decay = Math.exp(-delta * 7.5);
      this.spinVel.x *= decay;
      this.spinVel.y *= decay;
    }

    // cubo segue o alvo de orientação com mola exponencial
    this.raiz.quaternion.slerp(this.alvoRaiz, 1 - Math.exp(-delta * 16));

    // micro-recuo magnético de mola a cada encaixe de camada
    const rK = 260;
    const rC = 22;
    this.recoil.vx += (-rK * this.recoil.x - rC * this.recoil.vx) * delta;
    this.recoil.vy += (-rK * this.recoil.y - rC * this.recoil.vy) * delta;
    this.recoil.x += this.recoil.vx * delta;
    this.recoil.y += this.recoil.vy * delta;

    // respiração e paralaxe leve pelo ponteiro (desligadas no movimento reduzido)
    const calmo = this.opcoes.reduzido || this.gesto !== null;
    let hop = 0;
    let celebrateGlow = 0;
    if (this.festa.ativa) {
      this.festa.t += delta;
      const t = this.festa.t;
      hop = Math.sin(Math.min(1, t / 0.9) * Math.PI) * 0.62;
      celebrateGlow = Math.sin(Math.min(1, t / 1.15) * Math.PI);
      this.flutua.rotation.y = (1 - Math.cos(Math.min(1, t / 1.1) * Math.PI)) * Math.PI;
      if (t > 1.15) {
        this.festa.ativa = false;
        this.flutua.rotation.y = 0;
      }
    } else {
      const alvoX = (calmo ? 0 : pointer.y * -0.085) + this.recoil.x;
      const alvoY = (calmo ? 0 : pointer.x * 0.12) + this.recoil.y;
      this.flutua.rotation.x += (alvoX - this.flutua.rotation.x) * Math.min(1, delta * 7);
      this.flutua.rotation.y += (alvoY - this.flutua.rotation.y) * Math.min(1, delta * 7);
    }

    if (this.destaque || this.destaquePecas.size) {
      this.destaqueMat.emissiveIntensity = this.opcoes.reduzido ? 0.65 : 0.5 + Math.sin(tempo * 5) * 0.28;
    }

    this.flutua.position.y = (this.opcoes.reduzido ? 0 : Math.sin(tempo * 1.25) * 0.075) + hop;

    // shaders GLSL & luz dinâmica
    this.haloPulse = Math.max(0, this.haloPulse - delta * 1.6);
    this.haloMat.uniforms.uTime.value = tempo;
    this.haloMat.uniforms.uPulse.value = this.opcoes.reduzido ? 0 : this.haloPulse;
    this.haloMat.uniforms.uCelebrate.value = celebrateGlow;

    this.accentLight.position.x += (pointer.x * 3.2 - this.accentLight.position.x) * Math.min(1, delta * 5);
    this.accentLight.position.y += (1.6 + pointer.y * 2.2 - this.accentLight.position.y) * Math.min(1, delta * 5);
    this.accentLight.intensity = 1.45 + this.haloPulse * 1.4 + celebrateGlow * 2.2;

    if (!this.opcoes.reduzido) {
      this.ambientParticles.mat.uniforms.uTime.value = tempo;
    }
    this.burst.step(delta);

    const sm = this.sombra.material as THREE.MeshBasicMaterial;
    sm.opacity = Math.max(0.15, 1 - hop * 0.85);
    this.sombra.scale.setScalar(1 - hop * 0.25 + (this.opcoes.reduzido ? 0 : Math.sin(tempo * 1.25) * -0.025));
  }

  private comecarGiro() {
    const { giro, rapido } = this.fila.shift() as { giro: Giro; rapido: boolean };
    const grupos: THREE.Object3D[] = [];
    this.pivo.rotation.set(0, 0, 0);
    this.pivo.updateMatrixWorld();
    for (const peca of this.tela.pecas) {
      if (!pecaNoGiro(peca, giro)) continue;
      const g = this.grupos[peca.id];
      this.pivo.attach(g);
      grupos.push(g);
    }
    this.anim = { giro, grupos, alvo: (giro.q * Math.PI) / 2, v: 0, vel: 0, rapido };
  }

  private passoGiro(delta: number) {
    const a = this.anim!;
    if (this.opcoes.reduzido) {
      a.v = a.alvo;
      a.vel = 0;
    } else {
      // mola com um tiquinho de passada (o "clique" magnético de um speedcube);
      // o embaralhamento usa a versão criticamente amortecida e mais dura.
      const k = a.rapido ? 1500 : 580;
      const c = a.rapido ? 2 * Math.sqrt(k) : 37;
      const passos = Math.ceil(delta / 0.004);
      const h = delta / passos;
      for (let i = 0; i < passos; i += 1) {
        a.vel += ((a.alvo - a.v) * k - a.vel * c) * h;
        a.v += a.vel * h;
      }
      // com fila andando, não espera o assentamento fino
      const tolerancia = this.fila.length ? 0.06 : 0.004;
      if (!(Math.abs(a.alvo - a.v) < tolerancia && Math.abs(a.vel) < (this.fila.length ? 3 : 0.08))) {
        this.pivo.rotation[a.giro.eixo] = a.v;
        return;
      }
    }
    // terminou: o estado de tela recebe o giro e as peças voltam para a raiz
    aplicarGiro(this.tela, a.giro);
    this.pivo.rotation.set(0, 0, 0);
    for (const g of a.grupos) {
      this.raiz.add(g);
      this.sincronizar(g);
    }

    // pulso visual + micro-recuo magnético no encaixe da camada
    if (!this.opcoes.reduzido && !a.rapido) {
      this.haloPulse = Math.max(this.haloPulse, 0.72);
      const dir = Math.sign(a.giro.q) || 1;
      if (a.giro.eixo === "y") this.recoil.vy += dir * 0.42;
      else this.recoil.vx += dir * 0.36;
    }

    this.anim = null;
    this.opcoes.onAnimado?.(a.giro);
    if (!this.fila.length) this.opcoes.onOcioso?.();
  }

  /* ---------- gestos ---------- */

  private ndc(event: PointerEvent) {
    const r = this.palco.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((event.clientX - r.left) / r.width) * 2 - 1, -(((event.clientY - r.top) / r.height) * 2 - 1));
  }

  private aoApertar = (event: PointerEvent) => {
    if (this.gesto) return;
    this.spinVel.x = 0;
    this.spinVel.y = 0;
    const canvas = this.palco.renderer.domElement;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
    this.raycaster.setFromCamera(this.ndc(event), this.palco.camera);
    const hit = this.travado ? undefined : this.raycaster.intersectObjects(this.pegaveis, false)[0];
    const grupo = hit?.object.parent;
    // peça no meio de um giro não serve de alavanca: vira o cubo
    if (hit && hit.face && grupo && grupo.parent === this.raiz) {
      const inv = this.raiz.quaternion.clone().invert();
      const normalMundo = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      const nl = normalMundo.applyQuaternion(inv);
      const comp = [Math.abs(nl.x), Math.abs(nl.y), Math.abs(nl.z)];
      const normal = EIXOS[comp.indexOf(Math.max(...comp))];
      const ponto = this.raiz.worldToLocal(hit.point.clone());
      this.gesto = { tipo: "camada", x0: event.clientX, y0: event.clientY, id: event.pointerId, grupo, ponto, normal, usado: false };
    } else {
      this.gesto = { tipo: "virar", x: event.clientX, y: event.clientY, id: event.pointerId };
    }
  };

  private aoMover = (event: PointerEvent) => {
    const g = this.gesto;
    if (!g) {
      // feedback de hover na peça antes de arrastar
      if (this.travado) return;
      this.raycaster.setFromCamera(this.ndc(event), this.palco.camera);
      const hit = this.raycaster.intersectObjects(this.pegaveis, false)[0];
      const nextId = hit?.object.parent?.userData.id as number | undefined;
      const resolved = typeof nextId === "number" ? nextId : null;
      if (resolved !== this.hoveredId) {
        this.hoveredId = resolved;
        this.palco.renderer.domElement.style.cursor = resolved !== null ? "pointer" : "grab";
        this.aplicarDestaque();
      }
      return;
    }
    if (g.id !== event.pointerId) return;
    if (g.tipo === "virar") {
      const dx = event.clientX - g.x;
      const dy = event.clientY - g.y;
      g.x = event.clientX;
      g.y = event.clientY;
      const ry = dx * 0.009;
      const rx = dy * 0.009;
      this.spinVel.y = THREE.MathUtils.clamp(ry, -0.14, 0.14);
      this.spinVel.x = THREE.MathUtils.clamp(rx, -0.14, 0.14);
      const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
      const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rx);
      this.alvoRaiz.premultiply(qy).premultiply(qx).normalize();
      return;
    }
    if (g.usado) return;
    const dx = event.clientX - g.x0;
    const dy = event.clientY - g.y0;
    if (Math.hypot(dx, dy) < 12) return;
    g.usado = true;
    const giro = this.giroDoArrasto(g.grupo, g.ponto, g.normal, dx, dy);
    if (giro) this.girar(giro, "usuario");
  };

  private aoSoltar = (event: PointerEvent) => {
    if (!this.gesto || this.gesto.id !== event.pointerId) return;
    this.gesto = null;
    this.palco.renderer.domElement.style.cursor = this.hoveredId !== null && !this.travado ? "pointer" : "grab";
  };

  private aoSair = () => {
    if (this.hoveredId !== null) {
      this.hoveredId = null;
      this.aplicarDestaque();
    }
  };

  /**
   * Entre os dois eixos que deitam na face tocada, escolhe aquele cujo
   * movimento (ω × r) projetado na tela mais se alinha com o arrasto.
   */
  private giroDoArrasto(grupo: THREE.Object3D, ponto: THREE.Vector3, normal: Eixo, dx: number, dy: number): Giro | null {
    const { camera, renderer } = this.palco;
    const r = renderer.domElement.getBoundingClientRect();
    const arrasto = new THREE.Vector2(dx, dy).normalize();
    const tela = (v: THREE.Vector3) => {
      const p = this.raiz.localToWorld(v.clone()).project(camera);
      return new THREE.Vector2((p.x * r.width) / 2, (-p.y * r.height) / 2);
    };
    const origem = tela(ponto);
    let melhor: { eixo: Eixo; nota: number } | null = null;
    for (const eixo of EIXOS) {
      if (eixo === normal) continue;
      const tangente = vetorEixo(eixo).cross(ponto).normalize().multiplyScalar(0.25);
      const dir = tela(ponto.clone().add(tangente)).sub(origem);
      if (dir.lengthSq() < 1e-6) continue;
      const nota = dir.normalize().dot(arrasto);
      if (!melhor || Math.abs(nota) > Math.abs(melhor.nota)) melhor = { eixo, nota };
    }
    if (!melhor || Math.abs(melhor.nota) < 0.35) return null;
    const camada = Math.round(grupo.position[melhor.eixo] * 2);
    return { eixo: melhor.eixo, camada, q: melhor.nota > 0 ? 1 : -1 };
  }
}
