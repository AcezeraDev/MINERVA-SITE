/**
 * Plano inclinado: rampa de madeira que se ajusta pelo ângulo (arrastar a
 * alça no topo), bloco que escorrega com a aceleração da física (ou fica
 * parado), setas de peso, normal e atrito em escala e o arco do ângulo.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { fmt, plano } from "../simulacoes";
import type { EstadoLab } from "../tipos";
import type { Emitir, Kit } from "./kit";
import { CORES, comSombra, criarEtiqueta, criarSeta, geometriasSeta, suave, type CtxKit } from "./pecas";

const HIPOTENUSA = 3.9;
const PROFUNDIDADE = 1.3;
const COR_DESLIZA = new THREE.Color(CORES.rosa);
const COR_PARADO = new THREE.Color(CORES.menta);
const BRANCO = new THREE.Color(0xffffff);

function texturaMadeira() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#d9a86a";
  ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 70; i += 1) {
    const y = Math.random() * 256;
    ctx.strokeStyle = `rgba(${120 + Math.random() * 40},${70 + Math.random() * 20},30,${0.08 + Math.random() * 0.14})`;
    ctx.lineWidth = 1 + Math.random() * 2.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, y + Math.sin(x / 60 + i) * 4);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function criarKitPlano(ctx: CtxKit, emitir: Emitir): Kit {
  const { guardar } = ctx;
  const grupo = new THREE.Group();

  // rampa: triângulo retângulo unitário extrudado; escala x = cos θ, y = sen θ
  const forma = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1, 0), new THREE.Vector2(1, 1)]);
  const geoRampa = guardar(new THREE.ExtrudeGeometry(forma, { depth: PROFUNDIDADE, bevelEnabled: false }));
  geoRampa.translate(0, 0, -PROFUNDIDADE / 2);
  const madeira = guardar(texturaMadeira());
  const rampa = new THREE.Mesh(geoRampa, guardar(new THREE.MeshStandardMaterial({ map: madeira, roughness: 0.7 })));
  const pivoRampa = new THREE.Group();
  pivoRampa.add(rampa);
  grupo.add(pivoRampa);

  // bloco: caixa arredondada com a massa escrita na face da frente
  const canvasBloco = document.createElement("canvas");
  canvasBloco.width = canvasBloco.height = 128;
  const texBloco = guardar(new THREE.CanvasTexture(canvasBloco));
  texBloco.colorSpace = THREE.SRGBColorSpace;
  const corBloco = new THREE.Color(CORES.menta);
  const matBloco = guardar(new THREE.MeshStandardMaterial({ color: corBloco, roughness: 0.4 }));
  const matFace = guardar(new THREE.MeshStandardMaterial({ map: texBloco, color: corBloco, roughness: 0.4 }));
  const bloco = new THREE.Mesh(guardar(new RoundedBoxGeometry(1, 1, 1, 3, 0.08)), [matBloco, matBloco, matBloco, matBloco, matFace, matBloco]);
  bloco.userData = { dica: "o bloco: a massa muda o peso, não a aceleração" };
  grupo.add(bloco);
  let massaDesenhada = -1;
  const desenharMassa = (massa: number) => {
    if (massa === massaDesenhada) return;
    massaDesenhada = massa;
    const c = canvasBloco.getContext("2d")!;
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, 128, 128);
    c.fillStyle = "#1d2440";
    c.font = "800 44px system-ui, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(`${massa} kg`, 64, 66);
    texBloco.needsUpdate = true;
  };

  // alça de arrasto no topo da rampa
  const alca = new THREE.Mesh(guardar(new THREE.SphereGeometry(0.17, 24, 16)), guardar(new THREE.MeshStandardMaterial({ color: CORES.menta, emissive: CORES.menta, emissiveIntensity: 0.55, roughness: 0.3 })));
  alca.userData = { arrasta: true, dica: "arraste para cima ou para baixo: muda o ângulo" };
  const anelAlca = new THREE.Mesh(guardar(new THREE.TorusGeometry(0.27, 0.025, 8, 40)), guardar(new THREE.MeshBasicMaterial({ color: CORES.menta, transparent: true, opacity: 0.7 })));
  alca.add(anelAlca);
  grupo.add(alca);

  // setas de força e etiquetas
  const geoSeta = geometriasSeta(guardar);
  const setaP = criarSeta(guardar, geoSeta, CORES.tinta);
  const setaN = criarSeta(guardar, geoSeta, CORES.caneta);
  const setaF = criarSeta(guardar, geoSeta, CORES.vermelho);
  grupo.add(setaP.grupo, setaN.grupo, setaF.grupo);
  const rotP = criarEtiqueta(guardar, { fundo: "rgba(255,255,255,0.92)", altura: 0.24 });
  const rotN = criarEtiqueta(guardar, { fundo: "rgba(255,255,255,0.92)", cor: "#3446c9", altura: 0.24 });
  const rotF = criarEtiqueta(guardar, { fundo: "rgba(255,255,255,0.92)", cor: "#c23a26", altura: 0.24 });
  const rotAngulo = criarEtiqueta(guardar, { fundo: "#f4e04d", altura: 0.3, fonte: "numero" });
  grupo.add(rotP.sprite, rotN.sprite, rotF.sprite, rotAngulo.sprite);

  // arco do ângulo na face da frente
  const matArco = guardar(new THREE.MeshBasicMaterial({ color: CORES.caneta, side: THREE.DoubleSide }));
  let geoArco: THREE.RingGeometry | null = null;
  const arco = new THREE.Mesh(undefined, matArco);
  grupo.add(arco);
  let anguloArco = -1;

  comSombra(grupo);
  alca.castShadow = false;

  // estado animado
  let alvoGraus = 25;
  let graus = 25;
  let dados = plano({ anguloGraus: 25, massa: 2, atrito: 0.3 });
  let massa = 2;
  let lado = 0.5;
  let s = HIPOTENUSA * 0.6;
  let vel = 0;
  let pausa = 0;
  let pop = 1;
  let segurando = false;
  let grausNoArrasto = 25;

  const canto = new THREE.Vector3();
  const tangente = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const centro = new THREE.Vector3();
  const vetor = new THREE.Vector3();
  const topo = new THREE.Vector3();

  const atualizar = (estado: EstadoLab) => {
    const v = estado.valores.plano;
    alvoGraus = v.anguloGraus;
    if (!segurando) grausNoArrasto = v.anguloGraus;
    massa = v.massa;
    dados = plano(v);
    desenharMassa(v.massa);
    rotP.definir(`P = ${fmt(dados.peso)} N`);
    rotN.definir(`N = ${fmt(dados.normal)} N`);
    rotF.definir(`Fat = ${fmt(dados.atrito)} N`);
  };

  const tick = (tempo: number, dt: number) => {
    graus = suave(graus, alvoGraus, dt, 10);
    const th = THREE.MathUtils.degToRad(graus);
    const base = HIPOTENUSA * Math.cos(th);
    const altura = HIPOTENUSA * Math.sin(th);
    rampa.scale.set(base, altura, 1);
    rampa.position.x = -base / 2;
    canto.set(-base / 2, 0, 0);
    tangente.set(Math.cos(th), Math.sin(th), 0);
    normal.set(-Math.sin(th), Math.cos(th), 0);
    topo.set(base / 2, altura, PROFUNDIDADE / 2 + 0.05);
    alca.position.copy(topo);
    anelAlca.rotation.z = tempo * 1.4;
    anelAlca.scale.setScalar(1 + Math.sin(tempo * 3) * 0.08);

    // bloco: s(t) com a aceleração real (escalada), recomeça lá em cima
    lado = 0.36 + Math.cbrt(massa) * 0.16;
    const topoS = HIPOTENUSA * 0.82;
    const fimS = HIPOTENUSA * 0.12 + lado / 2;
    if (dados.desliza && !segurando) {
      if (pausa > 0) {
        pausa -= dt;
        if (pausa <= 0) {
          s = topoS;
          vel = 0;
          pop = 0;
        }
      } else {
        vel += dados.aceleracao * 0.16 * dt;
        s -= vel * dt;
        if (s <= fimS) {
          s = fimS;
          pausa = 0.7;
        }
      }
    } else {
      s = suave(s, HIPOTENUSA * 0.58, dt, 4);
      vel = 0;
      pausa = 0;
    }
    centro.copy(canto).addScaledVector(tangente, s).addScaledVector(normal, lado / 2);
    bloco.position.copy(centro);
    bloco.rotation.z = th;
    // "pop" quando o bloco volta lá para cima
    pop = suave(pop, 1, dt, 9);
    bloco.scale.setScalar(lado * (0.35 + 0.65 * pop));
    corBloco.lerp(dados.desliza ? COR_DESLIZA : COR_PARADO, Math.min(1, dt * 6));
    matBloco.color.copy(corBloco);
    matFace.color.copy(corBloco).lerp(BRANCO, 0.5);

    // setas: peso com 1,25 de comprimento, as outras na mesma escala
    const k = 1.25 / dados.peso;
    setaP.apontar(centro, vetor.set(0, -dados.peso * k, 0));
    setaN.apontar(centro, vetor.copy(normal).multiplyScalar(dados.normal * k));
    setaF.apontar(centro, vetor.copy(tangente).multiplyScalar(dados.atrito * k));
    rotP.sprite.position.set(centro.x + 0.05, centro.y - dados.peso * k - 0.2, 0.75);
    rotN.sprite.position.copy(centro).addScaledVector(normal, dados.normal * k + 0.24).setZ(0.75);
    rotF.sprite.position.copy(centro).addScaledVector(tangente, dados.atrito * k + 0.42).setZ(0.75);
    rotF.sprite.visible = dados.atrito > 0.05;

    // arco do ângulo: refaz só quando o ângulo muda
    if (Math.abs(anguloArco - graus) > 0.15) {
      anguloArco = graus;
      geoArco?.dispose();
      geoArco = new THREE.RingGeometry(0.52, 0.58, 32, 1, 0, th);
      arco.geometry = geoArco;
      rotAngulo.definir(`${Math.round(graus)}°`);
    }
    arco.position.set(canto.x, 0.01, PROFUNDIDADE / 2 + 0.01);
    rotAngulo.sprite.position.set(canto.x + 0.95, 0.24, PROFUNDIDADE / 2 + 0.2);
  };

  return {
    grupo,
    camera: { alvo: new THREE.Vector3(0, 1.05, 0), distancia: 8.2, elevacao: 0.32 },
    alvos: [alca, bloco],
    atualizar,
    tick,
    foco: (destino) => destino.copy(bloco.position).applyMatrix4(grupo.matrixWorld),
    aoSegurar: (objeto) => {
      segurando = objeto === alca;
      grausNoArrasto = alvoGraus;
    },
    aoArrastar: (objeto, dy) => {
      if (objeto !== alca) return;
      grausNoArrasto = THREE.MathUtils.clamp(grausNoArrasto - dy * 0.22, 5, 60);
      const novo = Math.round(grausNoArrasto);
      if (novo !== alvoGraus) emitir({ tipo: "plano", parcial: { anguloGraus: novo } });
    },
    descartar: () => geoArco?.dispose(),
  };
}
