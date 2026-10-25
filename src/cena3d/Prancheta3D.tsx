// Carregado sob demanda: prancheta three.js com a folha da tarefa e as peças dos tipos de questão.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { corDoToken, criarPalco, mola } from "./palco";
import type { ModoPrancheta } from "./Cena3D";

type Guardar = <T extends { dispose: () => void }>(item: T) => T;

const FOLHA_L = 2.6;
const FOLHA_A = 3.3;
const BOLHAS = 5;

function hex(cor: THREE.Color) {
  return `#${cor.getHexString()}`;
}

function canvasTextura(guardar: Guardar, largura: number, altura: number, desenhar: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  desenhar(canvas.getContext("2d")!);
  const tex = guardar(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function retangulo(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, a: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + l, y, x + l, y + a, r);
  ctx.arcTo(x + l, y + a, x, y + a, r);
  ctx.arcTo(x, y + a, x, y, r);
  ctx.arcTo(x, y, x + l, y, r);
  ctx.closePath();
}

/** Posição (em coordenadas da folha) da bolinha de cada alternativa. */
function bolha(indice: number) {
  return { x: -FOLHA_L / 2 + 0.42, y: 0.32 - indice * 0.36 };
}

function desenharFolha(ctx: CanvasRenderingContext2D) {
  const L = 520;
  const A = 660;
  const papel = hex(corDoToken("--sheet", "#151a26"));
  const pauta = hex(corDoToken("--rule", "#222c42"));
  const caneta = hex(corDoToken("--pen", "#93a3ff"));
  const texto = hex(corDoToken("--theme-text", "#e8ecf4"));
  const mint = hex(corDoToken("--hl-mint", "#2fd483"));
  ctx.fillStyle = papel;
  ctx.fillRect(0, 0, L, A);
  // cabeçalho da questão
  ctx.fillStyle = texto;
  ctx.globalAlpha = 0.7;
  ctx.font = "600 22px 'Atkinson Hyperlegible Next Variable', system-ui, sans-serif";
  ctx.fillText("Questão 03 de 07", 28, 46);
  ctx.globalAlpha = 1;
  ctx.fillStyle = mint;
  retangulo(ctx, L - 150, 22, 124, 34, 8);
  ctx.fill();
  ctx.fillStyle = "#14161b";
  ctx.font = "800 18px 'Atkinson Hyperlegible Next Variable', system-ui, sans-serif";
  ctx.fillText("10 PONTOS", L - 136, 46);
  // enunciado em "linhas" de texto
  ctx.fillStyle = texto;
  ctx.globalAlpha = 0.32;
  for (const [y, w] of [
    [92, 440],
    [120, 470],
    [148, 300],
  ]) {
    retangulo(ctx, 28, y, w, 12, 6);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // alternativas: bolinha + letra + linha
  const letras = ["A", "B", "C", "D", "E"];
  for (let i = 0; i < BOLHAS; i += 1) {
    const cy = A / 2 - (bolha(i).y / FOLHA_A) * A;
    ctx.strokeStyle = caneta;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(52, cy, 17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = caneta;
    ctx.font = "800 18px 'Atkinson Hyperlegible Next Variable', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(letras[i], 52, cy + 6);
    ctx.textAlign = "left";
    ctx.fillStyle = texto;
    ctx.globalAlpha = 0.26;
    retangulo(ctx, 88, cy - 6, 200 + ((i * 97) % 180), 12, 6);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = pauta;
  ctx.lineWidth = 2;
  for (let y = 190; y < A; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y + 30);
    ctx.lineTo(L, y + 30);
    ctx.stroke();
  }
}

/** Tábua com cantos arredondados e o prendedor de metal. */
function criarPrancheta(guardar: Guardar) {
  const grupo = new THREE.Group();
  const forma = new THREE.Shape();
  const l = 3.0;
  const a = 3.95;
  const r = 0.22;
  forma.moveTo(-l / 2 + r, -a / 2);
  forma.lineTo(l / 2 - r, -a / 2);
  forma.quadraticCurveTo(l / 2, -a / 2, l / 2, -a / 2 + r);
  forma.lineTo(l / 2, a / 2 - r);
  forma.quadraticCurveTo(l / 2, a / 2, l / 2 - r, a / 2);
  forma.lineTo(-l / 2 + r, a / 2);
  forma.quadraticCurveTo(-l / 2, a / 2, -l / 2, a / 2 - r);
  forma.lineTo(-l / 2, -a / 2 + r);
  forma.quadraticCurveTo(-l / 2, -a / 2, -l / 2 + r, -a / 2);
  const tabua = new THREE.Mesh(
    guardar(new THREE.ExtrudeGeometry(forma, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3 })),
    guardar(new THREE.MeshStandardMaterial({ color: 0xa8774d, roughness: 0.62, metalness: 0.05 })),
  );
  tabua.position.z = -0.12;
  const metal = guardar(new THREE.MeshStandardMaterial({ color: 0xc9ced8, roughness: 0.25, metalness: 0.95 }));
  const prendedor = new THREE.Mesh(guardar(new THREE.BoxGeometry(1.25, 0.34, 0.12)), metal);
  prendedor.position.set(0, a / 2 - 0.22, 0.06);
  const rolo = new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.07, 0.07, 1.3, 20)), metal);
  rolo.rotation.z = Math.PI / 2;
  rolo.position.set(0, a / 2 - 0.05, 0.1);
  grupo.add(tabua, prendedor, rolo);
  return grupo;
}

/** Dado das alternativas: A, B, C, D, E e "?" nas faces. */
function criarDado(guardar: Guardar) {
  const fundos = [corDoToken("--hl-mint", "#2fd483"), corDoToken("--hl-yellow", "#d6cf2a"), corDoToken("--hl-pink", "#e87692"), corDoToken("--hl-lilac", "#9682f0")];
  const faces = ["A", "B", "C", "D", "E", "?"].map((letra, indice) =>
    guardar(
      new THREE.MeshStandardMaterial({
        roughness: 0.45,
        map: canvasTextura(guardar, 128, 128, (ctx) => {
          ctx.fillStyle = hex(fundos[indice % fundos.length]);
          ctx.fillRect(0, 0, 128, 128);
          ctx.fillStyle = "#14161b";
          ctx.font = "900 78px 'Atkinson Hyperlegible Next Variable', system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(letra, 64, 70);
        }),
      }),
    ),
  );
  return new THREE.Mesh(guardar(new THREE.BoxGeometry(0.62, 0.62, 0.62)), faces);
}

/** Moeda de verdadeiro ou falso. */
function criarMoeda(guardar: Guardar) {
  const face = (letra: string, cor: THREE.Color) =>
    guardar(
      new THREE.MeshStandardMaterial({
        roughness: 0.35,
        metalness: 0.2,
        map: canvasTextura(guardar, 128, 128, (ctx) => {
          ctx.fillStyle = hex(cor);
          ctx.beginPath();
          ctx.arc(64, 64, 64, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#14161b";
          ctx.font = "900 70px 'Atkinson Hyperlegible Next Variable', system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(letra, 64, 70);
        }),
      }),
    );
  const borda = guardar(new THREE.MeshStandardMaterial({ color: 0xd9b45a, roughness: 0.25, metalness: 0.85 }));
  const moeda = new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 40)), [borda, face("V", corDoToken("--hl-mint", "#2fd483")), face("F", corDoToken("--hl-pink", "#e87692"))]);
  moeda.rotation.x = Math.PI / 2;
  const grupo = new THREE.Group();
  grupo.add(moeda);
  return grupo;
}

/** Peça de palavra, como as das questões de ordenar. */
function criarPeca(guardar: Guardar, palavra: string, cor: THREE.Color) {
  const mat = guardar(
    new THREE.MeshStandardMaterial({
      roughness: 0.5,
      map: canvasTextura(guardar, 256, 96, (ctx) => {
        ctx.fillStyle = hex(cor);
        retangulo(ctx, 0, 0, 256, 96, 30);
        ctx.fill();
        ctx.fillStyle = "#14161b";
        ctx.font = "800 44px 'Atkinson Hyperlegible Next Variable', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(palavra, 128, 52);
      }),
    }),
  );
  const lado = guardar(new THREE.MeshStandardMaterial({ color: cor, roughness: 0.5 }));
  return new THREE.Mesh(guardar(new THREE.BoxGeometry(0.95, 0.36, 0.1)), [lado, lado, lado, lado, mat, lado]);
}

function criarLapis(guardar: Guardar) {
  const grupo = new THREE.Group();
  const corpo = new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.075, 0.075, 1.3, 6)), guardar(new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.5 })));
  const madeira = new THREE.Mesh(guardar(new THREE.ConeGeometry(0.075, 0.22, 6)), guardar(new THREE.MeshStandardMaterial({ color: 0xe8c79a, roughness: 0.8 })));
  madeira.position.y = -0.76;
  madeira.rotation.x = Math.PI;
  const grafite = new THREE.Mesh(guardar(new THREE.ConeGeometry(0.026, 0.08, 6)), guardar(new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.4 })));
  grafite.position.y = -0.85;
  grafite.rotation.x = Math.PI;
  const ponteira = new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.078, 0.078, 0.12, 16)), guardar(new THREE.MeshStandardMaterial({ color: 0xc9ced8, metalness: 0.9, roughness: 0.3 })));
  ponteira.position.y = 0.71;
  const borracha = new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.074, 0.074, 0.16, 16)), guardar(new THREE.MeshStandardMaterial({ color: 0xf28ba0, roughness: 0.7 })));
  borracha.position.y = 0.85;
  grupo.add(corpo, madeira, grafite, ponteira, borracha);
  return grupo;
}

/** Visto em tubo, desenhado por drawRange. */
function criarVisto(guardar: Guardar) {
  const curva = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.32, 0.02, 0), new THREE.Vector3(-0.1, -0.22, 0), new THREE.Vector3(0.38, 0.36, 0)], false, "catmullrom", 0.1);
  const geometria = guardar(new THREE.TubeGeometry(curva, 48, 0.055, 10, false));
  const visto = new THREE.Mesh(geometria, guardar(new THREE.MeshStandardMaterial({ color: corDoToken("--hl-mint", "#2fd483"), roughness: 0.35, emissive: corDoToken("--hl-mint", "#2fd483"), emissiveIntensity: 0.25 })));
  return { visto, total: geometria.index ? geometria.index.count : 0 };
}

type Flutuante = { obj: THREE.Object3D; base: THREE.Vector3; fase: number; giro: THREE.Vector3; impulso: { v: number; vel: number } };

export default function Prancheta3D({ modo }: { modo: ModoPrancheta }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const modoRef = useRef(modo);
  modoRef.current = modo;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let mesa: THREE.Group;
    let marcas: THREE.Mesh[] = [];
    let visto: THREE.Mesh;
    let vistoTotal = 0;
    let voadoras: THREE.Mesh[] = [];
    let flutuantes: Flutuante[] = [];
    const raycaster = new THREE.Raycaster();
    const ponteiro = new THREE.Vector2();
    const estado = { ciclo: 0, escolha: 2, escalas: Array.from({ length: BOLHAS }, () => ({ v: 0, vel: 0 })), visto: 0, voo: 0, velocidade: { v: 1, vel: 0 } };

    const palco = criarPalco(host, (tempo, delta) => {
      const gerando = modoRef.current === "gerando";
      const ritmo = mola(estado.velocidade, gerando ? 3.2 : 1, delta, 40, 10);

      // ciclo da questão: marca uma alternativa, aparece o visto, limpa e troca
      estado.ciclo += delta * (gerando ? 1.8 : 1);
      if (estado.ciclo > 5.2) {
        estado.ciclo = 0;
        estado.escolha = (estado.escolha + 2 + Math.floor(Math.random() * 3)) % BOLHAS;
      }
      marcas.forEach((marca, indice) => {
        const alvo = indice === estado.escolha && estado.ciclo > 1.1 && estado.ciclo < 4.6 ? 1 : 0;
        const s = Math.max(0.001, mola(estado.escalas[indice], alvo, delta, 260, 16));
        marca.scale.setScalar(s);
      });
      estado.visto = estado.ciclo > 2 && estado.ciclo < 4.6 ? Math.min(1, estado.visto + delta * 2.4) : Math.max(0, estado.visto - delta * 4);
      visto.geometry.setDrawRange(0, Math.floor((vistoTotal * estado.visto) / 3) * 3);

      // folhas novas voando para a prancheta enquanto a Mine gera
      estado.voo = gerando ? (estado.voo + delta * 0.8) % 3 : Math.max(0, estado.voo - delta);
      voadoras.forEach((folha, indice) => {
        const t = gerando ? THREE.MathUtils.clamp(estado.voo - indice * 0.9, 0, 1) : 0;
        const e = 1 - Math.pow(1 - t, 3);
        folha.visible = gerando && t > 0 && t < 1;
        folha.position.set(THREE.MathUtils.lerp(3.6, 0, e), THREE.MathUtils.lerp(2.8, -0.08, e), THREE.MathUtils.lerp(1.6, 0.06 + indice * 0.01, e));
        folha.rotation.set(THREE.MathUtils.lerp(-0.6, 0, e), THREE.MathUtils.lerp(0.9, 0, e), THREE.MathUtils.lerp(-0.8, 0, e));
      });

      // peças flutuando; a que está sob o mouse ganha um giro extra
      let tocada: THREE.Object3D | null = null;
      if (palco.pointer.dentro) {
        ponteiro.set(palco.pointer.alvoX, palco.pointer.alvoY);
        raycaster.setFromCamera(ponteiro, palco.camera);
        const acerto = raycaster.intersectObjects(flutuantes.map((item) => item.obj), true)[0];
        if (acerto) tocada = flutuantes.find((item) => item.obj === acerto.object || item.obj.getObjectById(acerto.object.id))?.obj || null;
      }
      flutuantes.forEach((item) => {
        const extra = mola(item.impulso, item.obj === tocada ? 6 : 0, delta, 30, 6);
        item.obj.position.set(item.base.x + Math.sin(tempo * 0.6 + item.fase) * 0.12, item.base.y + Math.sin(tempo * 0.9 + item.fase) * 0.18, item.base.z);
        item.obj.rotation.x += item.giro.x * delta * (ritmo + extra);
        item.obj.rotation.y += item.giro.y * delta * (ritmo + extra);
        item.obj.rotation.z += item.giro.z * delta * (ritmo + extra) * 0.4;
      });

      mesa.rotation.y = -0.42 + palco.pointer.x * 0.3;
      mesa.rotation.x = -0.22 - palco.pointer.y * 0.18;
      mesa.position.y = Math.sin(tempo * 0.8) * 0.06;
    }, { z: 8.4 });

    const { scene, guardar } = palco;

    mesa = new THREE.Group();
    mesa.add(criarPrancheta(guardar));
    const folhaMat = guardar(new THREE.MeshStandardMaterial({ map: canvasTextura(guardar, 520, 660, desenharFolha), roughness: 0.9 }));
    const folha = new THREE.Mesh(guardar(new THREE.PlaneGeometry(FOLHA_L, FOLHA_A)), folhaMat);
    folha.position.set(0, -0.12, 0.02);
    mesa.add(folha);

    const marcaMat = guardar(new THREE.MeshStandardMaterial({ color: corDoToken("--pen", "#93a3ff"), roughness: 0.4 }));
    const marcaGeo = guardar(new THREE.CircleGeometry(0.075, 28));
    marcas = Array.from({ length: BOLHAS }, (_, indice) => {
      const marca = new THREE.Mesh(marcaGeo, marcaMat);
      const pos = bolha(indice);
      marca.position.set(pos.x, pos.y - 0.12, 0.03);
      marca.scale.setScalar(0.001);
      mesa.add(marca);
      return marca;
    });

    const v = criarVisto(guardar);
    visto = v.visto;
    vistoTotal = v.total;
    visto.position.set(0.75, -1.25, 0.12);
    visto.scale.setScalar(1.3);
    mesa.add(visto);

    const voadoraMat = guardar(new THREE.MeshStandardMaterial({ color: corDoToken("--sheet", "#151a26"), roughness: 0.9, side: THREE.DoubleSide }));
    voadoras = [0, 1, 2].map(() => {
      const nova = new THREE.Mesh(guardar(new THREE.PlaneGeometry(FOLHA_L, FOLHA_A)), voadoraMat);
      nova.visible = false;
      mesa.add(nova);
      return nova;
    });

    mesa.position.x = -0.6;
    scene.add(mesa);

    const pecas: Array<[THREE.Object3D, [number, number, number], [number, number, number]]> = [
      [criarDado(guardar), [2.35, 1.15, 0.6], [0.6, 0.8, 0.2]],
      [criarMoeda(guardar), [2.55, -0.85, 0.4], [1.6, 0.25, 0]],
      [criarPeca(guardar, "ordene", corDoToken("--hl-yellow", "#d6cf2a")), [-2.85, 1.35, 0.5], [0.15, 0.5, 0.3]],
      [criarPeca(guardar, "ligue", corDoToken("--hl-lilac", "#9682f0")), [-3.05, -0.25, 0.9], [0.3, -0.45, 0.2]],
      [criarPeca(guardar, "arraste", corDoToken("--hl-pink", "#e87692")), [-2.4, -1.55, 0.2], [-0.2, 0.4, 0.25]],
      [criarLapis(guardar), [1.35, 1.95, -0.4], [0.2, 0.35, 0.6]],
    ];
    flutuantes = pecas.map(([obj, base, giro], indice) => {
      obj.position.set(...base);
      scene.add(obj);
      return { obj, base: new THREE.Vector3(...base), fase: indice * 1.7, giro: new THREE.Vector3(...giro), impulso: { v: 0, vel: 0 } };
    });

    scene.add(new THREE.AmbientLight(0xffffff, 1.25));
    const sol = new THREE.DirectionalLight(0xffffff, 2.6);
    sol.position.set(-4, 5, 7);
    scene.add(sol);
    const contra = new THREE.DirectionalLight(corDoToken("--hl-lilac", "#9682f0"), 1.4);
    contra.position.set(5, -2, -3);
    scene.add(contra);

    return () => palco.destruir();
  }, []);

  return <div ref={hostRef} className="cena3d-host" />;
}
