// Carregado sob demanda: folha pautada em three.js com caneta-tinteiro que escreve e corrige.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { corDoToken, criarPalco, mola } from "./palco";
import type { ModoFolha } from "./Cena3D";

const LARGURA = 3.2;
const ALTURA = 4.2;
const TEX_L = 512;
const TEX_A = 672;
const LINHAS = 17;
const TOPO = 70 / TEX_A;
const ALTURA_LINHA = (TEX_A - 96) / LINHAS / TEX_A;
const ESQUERDA = 74 / TEX_L;
const DIREITA = 26 / TEX_L;

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uCurl;
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += sin(uv.y * 3.1 + uTime * 0.8) * 0.035 + sin(uv.x * 2.3 + uTime * 0.55) * 0.02;
    // canto de baixo à direita levanta como página que vai virar
    float canto = max(0.0, (uv.x - uv.y) - 0.5);
    p.z += canto * canto * uCurl;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uPapel;
  uniform sampler2D uTinta;
  uniform sampler2D uVermelho;
  uniform float uEscrita;
  uniform float uCorrecao;
  uniform float uSome;
  uniform float uTopo;
  uniform float uAlturaLinha;
  uniform float uEsquerda;
  uniform float uDireita;
  uniform float uLinhas;
  varying vec2 vUv;
  varying vec3 vPos;

  // quanto da linha atual já foi "escrito": 1 nas linhas de cima, 0 nas de baixo
  float revelado(float progresso) {
    float linha = floor(((1.0 - vUv.y) - uTopo) / uAlturaLinha);
    float x = (vUv.x - uEsquerda) / (1.0 - uEsquerda - uDireita);
    return step(x, progresso * uLinhas - linha);
  }

  void main() {
    vec3 normal = normalize(cross(dFdx(vPos), dFdy(vPos)));
    float luz = 0.78 + 0.22 * max(dot(normal, normalize(vec3(-0.35, 0.55, 1.0))), 0.0);
    vec3 cor = texture2D(uPapel, vUv).rgb;
    vec4 tinta = texture2D(uTinta, vUv);
    cor = mix(cor, tinta.rgb, tinta.a * revelado(uEscrita) * (1.0 - uSome));
    vec4 vermelho = texture2D(uVermelho, vUv);
    cor = mix(cor, vermelho.rgb, vermelho.a * revelado(uCorrecao));
    gl_FragColor = vec4(cor * luz, 1.0);
    #include <colorspace_fragment>
  }
`;

type Cores = { papel: string; pauta: string; margem: string; caneta: string; vermelho: string };

function lerCores(): Cores {
  return {
    papel: `#${corDoToken("--sheet", "#151a26").getHexString()}`,
    pauta: `#${corDoToken("--rule", "#222c42").getHexString()}`,
    margem: `#${corDoToken("--margin-line", "#ff6b6f").getHexString()}`,
    caneta: `#${corDoToken("--pen", "#93a3ff").getHexString()}`,
    vermelho: "#e5484d",
  };
}

function linhaY(linha: number) {
  return (TOPO + ALTURA_LINHA * (linha + 0.62)) * TEX_A;
}

/** Folha: papel, pauta e margem. */
function desenharPapel(ctx: CanvasRenderingContext2D, cores: Cores) {
  ctx.fillStyle = cores.papel;
  ctx.fillRect(0, 0, TEX_L, TEX_A);
  ctx.strokeStyle = cores.pauta;
  ctx.lineWidth = 2;
  for (let linha = 0; linha <= LINHAS; linha += 1) {
    const y = (TOPO + ALTURA_LINHA * (linha + 1)) * TEX_A;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(TEX_L, y);
    ctx.stroke();
  }
  ctx.strokeStyle = cores.margem;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(ESQUERDA * TEX_L - 12, 0);
  ctx.lineTo(ESQUERDA * TEX_L - 12, TEX_A);
  ctx.stroke();
  // furos do fichário
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  for (const y of [0.2, 0.5, 0.8]) {
    ctx.beginPath();
    ctx.arc(22, y * TEX_A, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Letra cursiva de mentira: laços em seno, com palavras e espaços. */
function rabisco(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, semente: number) {
  let x = x0;
  let s = semente;
  const aleatorio = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  while (x < x1 - 10) {
    const palavra = Math.min(x1 - x, 22 + aleatorio() * 46);
    ctx.beginPath();
    for (let t = 0; t <= palavra; t += 1.5) {
      const altura = 5 + Math.sin(t * 0.21 + semente) * 2.5 + (aleatorio() > 0.97 ? 6 : 0);
      const py = y - Math.abs(Math.sin(t * 0.42)) * altura;
      if (t === 0) ctx.moveTo(x + t, py);
      else ctx.lineTo(x + t, py);
    }
    ctx.stroke();
    x += palavra + 9 + aleatorio() * 6;
  }
}

/** Tinta da redação: introdução, dois desenvolvimentos e conclusão. */
function desenharTinta(ctx: CanvasRenderingContext2D, cores: Cores) {
  ctx.clearRect(0, 0, TEX_L, TEX_A);
  ctx.strokeStyle = cores.caneta;
  ctx.lineWidth = 2.1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const inicio = ESQUERDA * TEX_L;
  const fim = TEX_L - DIREITA * TEX_L;
  // título centralizado na primeira linha
  rabisco(ctx, TEX_L * 0.36, TEX_L * 0.66, linhaY(0), 7);
  const paragrafos = [
    [1, 4],
    [5, 8],
    [9, 12],
    [13, 16],
  ];
  for (const [de, ate] of paragrafos) {
    for (let linha = de; linha <= ate; linha += 1) {
      const recuo = linha === de ? 34 : 0;
      const ultima = linha === ate ? fim - 90 - (linha % 3) * 30 : fim;
      rabisco(ctx, inicio + recuo, ultima, linhaY(linha), linha * 97 + 13);
    }
  }
}

/** Caneta vermelha: sublinhados, um círculo, setas e vistos na margem. */
function desenharCorrecao(ctx: CanvasRenderingContext2D, cores: Cores) {
  ctx.clearRect(0, 0, TEX_L, TEX_A);
  ctx.strokeStyle = cores.vermelho;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  const sublinhar = (linha: number, x0: number, x1: number) => {
    const y = linhaY(linha) + 5;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo((x0 + x1) / 2, y + 4, x1, y - 1);
    ctx.stroke();
  };
  sublinhar(2, 150, 290);
  sublinhar(6, 260, 420);
  sublinhar(10, 110, 230);
  sublinhar(14, 300, 470);
  ctx.beginPath();
  ctx.ellipse(380, linhaY(4) - 4, 48, 15, -0.05, 0, Math.PI * 2);
  ctx.stroke();
  const visto = (linha: number) => {
    const y = linhaY(linha);
    ctx.beginPath();
    ctx.moveTo(30, y - 6);
    ctx.lineTo(38, y + 2);
    ctx.lineTo(52, y - 14);
    ctx.stroke();
  };
  [1, 5, 9, 13].forEach(visto);
  ctx.font = "italic 22px 'Gochi Hand', cursive";
  ctx.fillStyle = cores.vermelho;
  ctx.fillText("ótimo repertório!", 300, linhaY(8) + 2);
}

function textura(canvas: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Caneta-tinteiro com a ponta na origem, deitada como na mão de quem escreve. */
function criarCaneta(guardar: <T extends { dispose: () => void }>(item: T) => T) {
  const caneta = new THREE.Group();
  const corpoMat = guardar(new THREE.MeshStandardMaterial({ color: 0x1d2bb8, roughness: 0.28, metalness: 0.35 }));
  const ouro = guardar(new THREE.MeshStandardMaterial({ color: 0xd9b45a, roughness: 0.22, metalness: 0.9 }));
  const haste = new THREE.Group();
  const ponta = new THREE.Mesh(guardar(new THREE.ConeGeometry(0.055, 0.26, 24)), ouro);
  ponta.rotation.x = Math.PI;
  ponta.position.y = 0.13;
  const anel = new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.068, 0.068, 0.06, 24)), ouro);
  anel.position.y = 0.29;
  const corpo = new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.075, 0.065, 1.35, 28)), corpoMat);
  corpo.position.y = 0.99;
  const tampa = new THREE.Mesh(guardar(new THREE.SphereGeometry(0.075, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2)), corpoMat);
  tampa.position.y = 1.665;
  const clipe = new THREE.Mesh(guardar(new THREE.BoxGeometry(0.025, 0.5, 0.03)), ouro);
  clipe.position.set(0.085, 1.38, 0);
  haste.add(ponta, anel, corpo, tampa, clipe);
  caneta.add(haste);
  haste.rotation.z = -0.62;
  haste.rotation.x = 0.55;
  return { caneta, corpoMat };
}

/** Poeira de marca-texto flutuando em volta da folha. */
function criarPoeira(guardar: <T extends { dispose: () => void }>(item: T) => T) {
  const total = 70;
  const posicoes = new Float32Array(total * 3);
  const cores = new Float32Array(total * 3);
  const paleta = [corDoToken("--hl-mint", "#2fd483"), corDoToken("--hl-yellow", "#d6cf2a"), corDoToken("--hl-pink", "#e87692"), corDoToken("--hl-lilac", "#9682f0")];
  for (let i = 0; i < total; i += 1) {
    posicoes.set([(Math.random() - 0.5) * 7, (Math.random() - 0.5) * 5.5, (Math.random() - 0.3) * 3], i * 3);
    const cor = paleta[i % paleta.length];
    cores.set([cor.r, cor.g, cor.b], i * 3);
  }
  const geometria = guardar(new THREE.BufferGeometry());
  geometria.setAttribute("position", new THREE.BufferAttribute(posicoes, 3));
  geometria.setAttribute("color", new THREE.BufferAttribute(cores, 3));
  const material = guardar(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      uniforms: { uTime: { value: 0 }, uEscala: { value: window.devicePixelRatio } },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uEscala;
        varying vec3 vCor;
        void main() {
          vCor = color;
          vec3 p = position;
          p.y = mod(p.y + uTime * 0.12 + 2.75, 5.5) - 2.75;
          p.x += sin(uTime * 0.5 + position.y * 2.0) * 0.12;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (20.0 * uEscala) / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vCor;
        void main() {
          float d = distance(gl_PointCoord, vec2(0.5));
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vCor, a * 0.55);
          #include <colorspace_fragment>
        }
      `,
    }),
  );
  return { pontos: new THREE.Points(geometria, material), material };
}

export default function FolhaRedacao3D({ modo }: { modo: ModoFolha }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const modoRef = useRef(modo);
  modoRef.current = modo;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const canvases = [0, 1, 2].map(() => {
      const canvas = document.createElement("canvas");
      canvas.width = TEX_L;
      canvas.height = TEX_A;
      return canvas;
    });
    const [cPapel, cTinta, cVermelho] = canvases;
    const pintar = () => {
      const cores = lerCores();
      desenharPapel(cPapel.getContext("2d")!, cores);
      desenharTinta(cTinta.getContext("2d")!, cores);
      desenharCorrecao(cVermelho.getContext("2d")!, cores);
    };
    pintar();

    const estado = {
      escrita: 0,
      correcao: 0,
      some: 0,
      curl: { v: 0.4, vel: 0 },
      vermelho: { v: 0, vel: 0 },
      penX: { v: 0, vel: 0 },
      penY: { v: 0, vel: 0 },
      ciclo: 0,
    };

    let uniforms: Record<string, THREE.IUniform>;
    let caneta: THREE.Group;
    let corpoMat: THREE.MeshStandardMaterial;
    let folha: THREE.Group;
    let poeira: THREE.ShaderMaterial;
    const azul = new THREE.Color(0x1d2bb8);
    const vermelhoCor = new THREE.Color(0xc8323a);

    const palco = criarPalco(host, (tempo, delta) => {
      const corrigindo = modoRef.current === "corrigindo";
      // escrevendo: escreve a folha em ~11 s, segura, apaga e recomeça
      if (corrigindo) {
        estado.escrita = Math.min(1, estado.escrita + delta * 0.9);
        estado.some = Math.max(0, estado.some - delta * 2);
        // corrige a folha em ~9 s, segura um pouco e passa de novo
        estado.correcao += delta / 9;
        if (estado.correcao > 1.3) estado.correcao = 0;
      } else {
        estado.correcao = Math.max(0, estado.correcao - delta * 1.5);
        estado.ciclo += delta;
        if (estado.ciclo < 11) estado.escrita = estado.ciclo / 11;
        else if (estado.ciclo < 13.5) estado.escrita = 1;
        else if (estado.ciclo < 14.5) estado.some = Math.min(1, (estado.ciclo - 13.5) / 1);
        else {
          estado.ciclo = 0;
          estado.escrita = 0;
          estado.some = 0;
        }
      }

      // a caneta segue a "cabeça" do que está sendo escrito (tinta ou correção)
      const progresso = Math.min(1, corrigindo ? estado.correcao : estado.escrita);
      const linha = Math.min(LINHAS - 1, Math.floor(progresso * LINHAS));
      const fracao = progresso * LINHAS - linha;
      const u = ESQUERDA + fracao * (1 - ESQUERDA - DIREITA);
      const v = TOPO + ALTURA_LINHA * (linha + 0.62);
      const descansando = !corrigindo && (estado.ciclo > 11 || estado.ciclo < 0.3);
      const alvoX = descansando ? LARGURA * 0.62 : (u - 0.5) * LARGURA;
      const alvoY = descansando ? -ALTURA * 0.18 : (0.5 - v) * ALTURA;
      caneta.position.x = mola(estado.penX, alvoX, delta, 120, 16);
      caneta.position.y = mola(estado.penY, alvoY, delta, 120, 16);
      caneta.position.z = 0.04 + (descansando ? 0.5 : Math.abs(Math.sin(tempo * 14)) * 0.03);
      corpoMat.color.copy(azul).lerp(vermelhoCor, mola(estado.vermelho, corrigindo ? 1 : 0, delta, 60, 14));

      uniforms.uTime.value = tempo;
      uniforms.uEscrita.value = estado.escrita;
      uniforms.uCorrecao.value = Math.min(1, estado.correcao);
      uniforms.uSome.value = estado.some;
      uniforms.uCurl.value = mola(estado.curl, 0.35 + (palco.pointer.dentro ? 0.9 : 0) + Math.sin(tempo * 0.7) * 0.15, delta, 50, 9);
      poeira.uniforms.uTime.value = tempo;

      folha.rotation.y = -0.32 + palco.pointer.x * 0.28;
      folha.rotation.x = -0.38 - palco.pointer.y * 0.2;
      folha.position.y = Math.sin(tempo * 0.9) * 0.06;
    }, { z: 6.6 });

    const { scene, guardar } = palco;
    const texPapel = guardar(textura(cPapel));
    const texTinta = guardar(textura(cTinta));
    const texVermelho = guardar(textura(cVermelho));
    uniforms = {
      uPapel: { value: texPapel },
      uTinta: { value: texTinta },
      uVermelho: { value: texVermelho },
      uTime: { value: 0 },
      uCurl: { value: 0.4 },
      uEscrita: { value: 0 },
      uCorrecao: { value: 0 },
      uSome: { value: 0 },
      uTopo: { value: TOPO },
      uAlturaLinha: { value: ALTURA_LINHA },
      uEsquerda: { value: ESQUERDA },
      uDireita: { value: DIREITA },
      uLinhas: { value: LINHAS },
    };
    const papelMat = guardar(new THREE.ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: fragment, side: THREE.DoubleSide }));
    const papel = new THREE.Mesh(guardar(new THREE.PlaneGeometry(LARGURA, ALTURA, 48, 64)), papelMat);

    // sombra macia embaixo da folha
    const sombraCanvas = document.createElement("canvas");
    sombraCanvas.width = sombraCanvas.height = 128;
    const sctx = sombraCanvas.getContext("2d")!;
    const grad = sctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, "rgba(0,0,0,0.45)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 128, 128);
    const sombra = new THREE.Mesh(
      guardar(new THREE.PlaneGeometry(LARGURA * 1.5, ALTURA * 1.3)),
      guardar(new THREE.MeshBasicMaterial({ map: guardar(new THREE.CanvasTexture(sombraCanvas)), transparent: true, depthWrite: false })),
    );
    sombra.position.set(0.25, -0.2, -0.35);

    const penna = criarCaneta(guardar);
    caneta = penna.caneta;
    corpoMat = penna.corpoMat;

    folha = new THREE.Group();
    folha.add(sombra, papel, caneta);
    folha.rotation.z = 0.06;
    scene.add(folha);

    const p = criarPoeira(guardar);
    poeira = p.material;
    scene.add(p.pontos);

    scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const sol = new THREE.DirectionalLight(0xffffff, 2.4);
    sol.position.set(-3, 4, 6);
    scene.add(sol);

    // o tema (dia/noite) muda as cores do papel: repinta as texturas
    const tema = new MutationObserver(() => {
      pintar();
      texPapel.needsUpdate = texTinta.needsUpdate = texVermelho.needsUpdate = true;
    });
    tema.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      tema.disconnect();
      palco.destruir();
    };
  }, []);

  return <div ref={hostRef} className="cena3d-host" />;
}
