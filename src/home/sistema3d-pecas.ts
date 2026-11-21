/**
 * Peças de acabamento do Sistema3D da Home: shader dos anéis de órbita,
 * poeira que cintila e as texturas de papel (página pautada, borda das
 * folhas, sombra macia). Tudo desenhado uma vez e compartilhado entre os
 * cadernos; nada aqui aloca por quadro.
 */
import * as THREE from "three";

/**
 * Anel de órbita: linha de tinta que se desenha na entrada (`uProgresso`),
 * fica mais forte na metade da frente (profundidade no mundo) e leva uma
 * cauda de cometa atrás do pingo que dá a volta (`uCabeca`, 0..1).
 */
export function criarMaterialAnel(opcoes: { cor: THREE.Color; cabeca: THREE.Color; opacidade: number; raio: number; sentido: number; traco?: number }) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uCor: { value: opcoes.cor },
      uCorCabeca: { value: opcoes.cabeca },
      uOpacidade: { value: opcoes.opacidade },
      uProgresso: { value: 0 },
      uCabeca: { value: 0 },
      uSentido: { value: opcoes.sentido },
      uTraco: { value: opcoes.traco ?? 0 },
      uRaio: { value: opcoes.raio },
    },
    vertexShader: /* glsl */ `
      varying vec3 vMundo;
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        vec4 mundo = modelMatrix * vec4(position, 1.0);
        vMundo = mundo.xyz;
        gl_Position = projectionMatrix * viewMatrix * mundo;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uCor;
      uniform vec3 uCorCabeca;
      uniform float uOpacidade;
      uniform float uProgresso;
      uniform float uCabeca;
      uniform float uSentido;
      uniform float uTraco;
      uniform float uRaio;
      varying vec3 vMundo;
      varying vec3 vLocal;
      void main() {
        float a = fract(atan(vLocal.y, vLocal.x) / 6.28318530718 + 1.0);
        if (a > uProgresso) discard;
        // metade de trás mais apagada: dá profundidade sem luz nenhuma
        float frente = smoothstep(-uRaio, uRaio * 0.6, vMundo.z);
        float alfa = uOpacidade * mix(0.3, 1.0, frente);
        if (uTraco > 0.0) alfa *= step(fract(a * uTraco), 0.55);
        // cauda do pingo: some em exponencial atrás dele
        float atras = fract(uSentido * (uCabeca - a) + 1.0);
        float cauda = exp(-atras * 16.0);
        vec3 cor = mix(uCor, uCorCabeca, cauda);
        alfa = max(alfa, cauda * 0.95 * mix(0.45, 1.0, frente));
        gl_FragColor = vec4(cor, alfa);
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * Poeira de estrelas: pontos redondos de tamanho variado que cintilam em
 * fases diferentes; uns 12% viram brilho em cruz. Um único draw call.
 */
export function criarPoeira(quantos: number, tinta: THREE.Color, menta: THREE.Color, pixel: number) {
  const posicoes = new Float32Array(quantos * 3);
  const fases = new Float32Array(quantos);
  const tamanhos = new Float32Array(quantos);
  const mistura = new Float32Array(quantos);
  for (let i = 0; i < quantos; i += 1) {
    const r = 4.6 + Math.random() * 5.4;
    const t = Math.random() * Math.PI * 2;
    const f = Math.acos(2 * Math.random() - 1);
    posicoes.set([r * Math.sin(f) * Math.cos(t), r * Math.cos(f) * 0.6, r * Math.sin(f) * Math.sin(t)], i * 3);
    fases[i] = Math.random();
    const brilho = Math.random() < 0.12;
    tamanhos[i] = brilho ? 9 + Math.random() * 6 : 2.2 + Math.random() * 3.2;
    // sinal guarda o tipo (negativo = brilho em cruz), valor guarda a cor
    mistura[i] = (Math.random() < 0.3 ? 1 : 0.0001) * (brilho ? -1 : 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(posicoes, 3));
  geo.setAttribute("aFase", new THREE.BufferAttribute(fases, 1));
  geo.setAttribute("aTam", new THREE.BufferAttribute(tamanhos, 1));
  geo.setAttribute("aMix", new THREE.BufferAttribute(mistura, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTempo: { value: 0 },
      uPixel: { value: pixel },
      uOpacidade: { value: 0 },
      uTinta: { value: tinta },
      uMenta: { value: menta },
    },
    vertexShader: /* glsl */ `
      attribute float aFase;
      attribute float aTam;
      attribute float aMix;
      uniform float uTempo;
      uniform float uPixel;
      varying float vBrilho;
      varying float vMix;
      varying float vCruz;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float pisca = 0.5 + 0.5 * sin(uTempo * (1.1 + aFase) + aFase * 6.2831);
        vBrilho = pisca;
        vMix = abs(aMix);
        vCruz = step(aMix, 0.0);
        gl_PointSize = aTam * uPixel * (0.55 + 0.45 * pisca) * (11.0 / -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTinta;
      uniform vec3 uMenta;
      uniform float uOpacidade;
      varying float vBrilho;
      varying float vMix;
      varying float vCruz;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float bola = smoothstep(0.5, 0.15, d);
        // brilho em cruz: dois traços finos que somem nas pontas + miolo
        float cruz = max(smoothstep(0.07, 0.0, abs(c.x)), smoothstep(0.07, 0.0, abs(c.y))) * (1.0 - d * 2.0);
        cruz = max(cruz, smoothstep(0.16, 0.0, d));
        float forma = mix(bola, cruz, vCruz);
        vec3 cor = mix(uTinta, uMenta, vMix);
        gl_FragColor = vec4(cor, forma * uOpacidade * (0.3 + 0.7 * vBrilho));
        #include <colorspace_fragment>
      }
    `,
  });
  return { pontos: new THREE.Points(geo, material), geo, material };
}

function textura(canvas: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Primeira página do caderno: papel creme, pauta azul e margem vermelha. */
export function texturaDaPagina() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 172;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fbfaf4";
  ctx.fillRect(0, 0, 128, 172);
  ctx.fillStyle = "rgba(52,70,201,0.32)";
  for (let y = 30; y < 168; y += 11) ctx.fillRect(6, y, 118, 1.4);
  ctx.fillStyle = "rgba(232,72,96,0.55)";
  ctx.fillRect(24, 0, 1.6, 172);
  return textura(canvas);
}

/**
 * Borda do bloco de folhas: listras finas alternando branco e creme. `deitada`
 * gira as listras (as faces de cima/baixo do BoxGeometry têm o UV trocado).
 */
export function texturaDeBorda(deitada: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fbfaf4";
  ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 64; i += 3) {
    ctx.fillStyle = i % 6 ? "rgba(120,110,90,0.16)" : "rgba(120,110,90,0.28)";
    if (deitada) ctx.fillRect(0, i, 64, 1);
    else ctx.fillRect(i, 0, 1, 64);
  }
  return textura(canvas);
}

/** Mancha radial branca com alfa: tingida pela cor do material (sombra, poça de luz). */
export function texturaRadial(miolo = 1, meio = 0.35) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, `rgba(255,255,255,${miolo})`);
  grad.addColorStop(0.5, `rgba(255,255,255,${meio})`);
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return textura(canvas);
}
