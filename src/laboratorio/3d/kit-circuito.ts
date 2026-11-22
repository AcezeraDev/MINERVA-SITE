/**
 * Circuito elétrico numa placa: bateria (arraste muda a tensão), dois
 * resistores com as faixas do código de cores do valor real (arraste muda a
 * resistência), lâmpada que acende pela potência, cargas andando em cada ramo
 * na velocidade da corrente e um seletor série/paralelo para tocar.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { circuito, fmt } from "../simulacoes";
import type { EstadoLab } from "../tipos";
import type { Emitir, Kit } from "./kit";
import { CORES, comSombra, criarEtiqueta, faixasDoResistor, suave, type CtxKit } from "./pecas";

const Y_FIO = 0.17;
type P2 = [number, number];

const LAYOUT = {
  serie: {
    segmentos: [
      [[-2.3, -0.55], [-2.3, -1.25]],
      [[-2.3, -1.25], [2.3, -1.25]],
      [[2.3, -1.25], [2.3, 1.25]],
      [[2.3, 1.25], [-2.3, 1.25]],
      [[-2.3, 1.25], [-2.3, 0.55]],
    ] as P2[][],
    caminhos: [[[-2.3, -0.55], [-2.3, -1.25], [2.3, -1.25], [2.3, 1.25], [-2.3, 1.25], [-2.3, 0.55]]] as P2[][],
    r1: [-0.75, -1.25] as P2,
    r2: [1.05, -1.25] as P2,
  },
  paralelo: {
    segmentos: [
      [[-2.3, -0.55], [-2.3, -1.25]],
      [[-2.3, -1.25], [-0.9, -1.25]],
      [[-0.9, -1.25], [2.3, -1.25]],
      [[-0.9, -1.25], [-0.9, -0.1]],
      [[-0.9, -0.1], [2.3, -0.1]],
      [[2.3, -1.25], [2.3, 1.25]],
      [[2.3, 1.25], [-2.3, 1.25]],
      [[-2.3, 1.25], [-2.3, 0.55]],
    ] as P2[][],
    caminhos: [
      [[-2.3, -0.55], [-2.3, -1.25], [2.3, -1.25], [2.3, 1.25], [-2.3, 1.25], [-2.3, 0.55]],
      [[-2.3, -0.55], [-2.3, -1.25], [-0.9, -1.25], [-0.9, -0.1], [2.3, -0.1], [2.3, 1.25], [-2.3, 1.25], [-2.3, 0.55]],
    ] as P2[][],
    r1: [0.7, -1.25] as P2,
    r2: [0.7, -0.1] as P2,
  },
};
const LAMPADA: P2 = [0.3, 1.25];
const MAX_CARGAS = 140;

type Caminho = { pontos: THREE.Vector3[]; acumulado: number[]; total: number };

function montarCaminho(pontos: P2[]): Caminho {
  const v = pontos.map(([x, z]) => new THREE.Vector3(x, Y_FIO + 0.03, z));
  const acumulado = [0];
  for (let i = 1; i < v.length; i += 1) acumulado.push(acumulado[i - 1] + v[i].distanceTo(v[i - 1]));
  return { pontos: v, acumulado, total: acumulado[acumulado.length - 1] };
}

function pontoNoCaminho(c: Caminho, d: number, destino: THREE.Vector3) {
  const alvo = THREE.MathUtils.euclideanModulo(d, c.total);
  let i = 1;
  while (i < c.acumulado.length - 1 && c.acumulado[i] < alvo) i += 1;
  const a = c.acumulado[i - 1];
  const f = (alvo - a) / Math.max(1e-6, c.acumulado[i] - a);
  return destino.lerpVectors(c.pontos[i - 1], c.pontos[i], f);
}

export function criarKitCircuito(ctx: CtxKit, emitir: Emitir): Kit {
  const { guardar, escuro } = ctx;
  const grupo = new THREE.Group();

  // placa de circuito
  const placa = new THREE.Mesh(guardar(new RoundedBoxGeometry(5.6, 0.12, 3.4, 2, 0.05)), guardar(new THREE.MeshStandardMaterial({ color: 0x1e6b4c, roughness: 0.55 })));
  placa.position.y = 0.06;
  grupo.add(placa);
  // furinhos de protoboard: um InstancedMesh só
  const furos = new THREE.InstancedMesh(guardar(new THREE.CylinderGeometry(0.025, 0.025, 0.01, 6)), guardar(new THREE.MeshBasicMaterial({ color: 0xc9b25a })), 26 * 15);
  const m4 = new THREE.Matrix4();
  let n = 0;
  for (let i = 0; i < 26; i += 1) for (let j = 0; j < 15; j += 1) furos.setMatrixAt(n++, m4.makeTranslation(-2.6 + i * 0.208, 0.125, -1.5 + j * 0.214));
  grupo.add(furos);

  // fios (refeitos quando a ligação muda)
  const matFio = guardar(new THREE.MeshStandardMaterial({ color: escuro ? 0xd7deec : 0x2a3048, roughness: 0.35, metalness: 0.2 }));
  const fios = new THREE.Group();
  grupo.add(fios);
  const geoJunta = guardar(new THREE.SphereGeometry(0.05, 12, 8));
  let geometriasFio: THREE.BufferGeometry[] = [];
  const montarFios = (segmentos: P2[][]) => {
    fios.clear();
    geometriasFio.forEach((g) => g.dispose());
    geometriasFio = [];
    const juntas = new Set<string>();
    for (const [[x1, z1], [x2, z2]] of segmentos) {
      const geo = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(x1, Y_FIO, z1), new THREE.Vector3(x2, Y_FIO, z2)), 2, 0.035, 8, false);
      geometriasFio.push(geo);
      const fio = new THREE.Mesh(geo, matFio);
      fio.castShadow = true;
      fios.add(fio);
      juntas.add(`${x1},${z1}`);
      juntas.add(`${x2},${z2}`);
    }
    for (const chave of juntas) {
      const [x, z] = chave.split(",").map(Number);
      const junta = new THREE.Mesh(geoJunta, matFio);
      junta.position.set(x, Y_FIO, z);
      fios.add(junta);
    }
  };

  // bateria deitada ao longo de z (+ atrás)
  const bateria = new THREE.Group();
  const corpo = new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.27, 0.27, 1.0, 32)), guardar(new THREE.MeshStandardMaterial({ color: 0x23262f, roughness: 0.35, metalness: 0.3 })));
  const faixa = new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.275, 0.275, 0.42, 32)), guardar(new THREE.MeshStandardMaterial({ color: CORES.menta, roughness: 0.4 })));
  const polo = new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 20)), guardar(new THREE.MeshStandardMaterial({ color: 0xc58b3b, metalness: 0.9, roughness: 0.25 })));
  polo.position.y = 0.55;
  faixa.position.y = 0.12;
  bateria.add(corpo, faixa, polo);
  bateria.rotation.x = -Math.PI / 2;
  bateria.position.set(-2.3, 0.4, 0);
  corpo.userData = { arrasta: true, dica: "bateria: arraste para cima ou para baixo para mudar a tensão" };
  faixa.userData = corpo.userData;
  grupo.add(bateria);
  const rotBateria = criarEtiqueta(guardar, { fundo: "#39f59a", fonte: "numero", altura: 0.3 });
  rotBateria.sprite.position.set(-2.3, 0.95, 0);
  grupo.add(rotBateria.sprite);

  // resistores com as faixas de cor do valor
  const geoCorpoR = guardar(new THREE.CapsuleGeometry(0.13, 0.46, 6, 16));
  geoCorpoR.rotateZ(Math.PI / 2);
  const geoFaixa = guardar(new THREE.CylinderGeometry(0.138, 0.138, 0.05, 20));
  geoFaixa.rotateZ(Math.PI / 2);
  const criarResistor = (nome: string) => {
    const g = new THREE.Group();
    const mat = guardar(new THREE.MeshStandardMaterial({ color: 0xe6cf9f, roughness: 0.5, emissive: 0xff5a1f, emissiveIntensity: 0 }));
    const corpoR = new THREE.Mesh(geoCorpoR, mat);
    corpoR.userData = { arrasta: true, dica: `${nome}: arraste para cima ou para baixo para mudar a resistência` };
    g.add(corpoR);
    const faixas = [-0.19, -0.09, 0.01, 0.19].map((x) => {
      const f = new THREE.Mesh(geoFaixa, guardar(new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.4 })));
      f.position.x = x;
      g.add(f);
      return f;
    });
    g.position.y = Y_FIO + 0.04;
    grupo.add(g);
    const rot = criarEtiqueta(guardar, { fundo: "rgba(255,255,255,0.94)", fonte: "numero", altura: 0.25 });
    grupo.add(rot.sprite);
    return { g, corpo: corpoR, mat, faixas, rot, x: 0, z: 0, ohms: 0 };
  };
  const r1 = criarResistor("R1");
  const r2 = criarResistor("R2");

  // lâmpada: bocal, vidro, filamento, luz e brilho
  const lampada = new THREE.Group();
  lampada.position.set(LAMPADA[0], Y_FIO, LAMPADA[1]);
  const bocal = new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.13, 0.15, 0.2, 20)), guardar(new THREE.MeshStandardMaterial({ color: 0xb9c0cc, metalness: 0.85, roughness: 0.3 })));
  bocal.position.y = 0.1;
  const matVidro = guardar(new THREE.MeshPhysicalMaterial({ color: 0xfff6dc, roughness: 0.05, transparent: true, opacity: 0.35, emissive: 0xffd36b, emissiveIntensity: 0, depthWrite: false }));
  const vidro = new THREE.Mesh(guardar(new THREE.SphereGeometry(0.27, 28, 20)), matVidro);
  vidro.position.y = 0.42;
  vidro.userData = { dica: "a lâmpada brilha conforme a potência (P = U·I)" };
  const matFilamento = guardar(new THREE.MeshBasicMaterial({ color: 0x7a5a2a }));
  const filamento = new THREE.Mesh(guardar(new THREE.TorusGeometry(0.07, 0.012, 6, 24, Math.PI)), matFilamento);
  filamento.position.y = 0.4;
  const luz = new THREE.PointLight(0xffc766, 0, 4.5, 1.6);
  luz.position.y = 0.45;
  const brilhoCanvas = document.createElement("canvas");
  brilhoCanvas.width = brilhoCanvas.height = 128;
  const bc = brilhoCanvas.getContext("2d")!;
  const grad = bc.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,214,110,0.95)");
  grad.addColorStop(0.35, "rgba(255,190,80,0.35)");
  grad.addColorStop(1, "rgba(255,190,80,0)");
  bc.fillStyle = grad;
  bc.fillRect(0, 0, 128, 128);
  const texBrilho = guardar(new THREE.CanvasTexture(brilhoCanvas));
  const brilho = new THREE.Sprite(guardar(new THREE.SpriteMaterial({ map: texBrilho, transparent: true, depthWrite: false, blending: escuro ? THREE.AdditiveBlending : THREE.NormalBlending })));
  brilho.position.y = 0.42;
  lampada.add(bocal, vidro, filamento, luz, brilho);
  grupo.add(lampada);
  const rotLampada = criarEtiqueta(guardar, { fundo: "#f4e04d", fonte: "numero", altura: 0.26 });
  rotLampada.sprite.position.set(LAMPADA[0] + 0.85, 0.75, LAMPADA[1]);
  grupo.add(rotLampada.sprite);

  // seletor série/paralelo
  const seletor = new THREE.Group();
  seletor.position.set(-1.25, 0.12, 0.45);
  const disco = new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.32, 0.36, 0.14, 32)), guardar(new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.4 })));
  disco.position.y = 0.07;
  const ponteiro = new THREE.Mesh(guardar(new THREE.BoxGeometry(0.06, 0.05, 0.3)), guardar(new THREE.MeshStandardMaterial({ color: CORES.vermelho })));
  ponteiro.position.set(0, 0.16, -0.1);
  const pivoPonteiro = new THREE.Group();
  pivoPonteiro.add(ponteiro);
  pivoPonteiro.position.y = 0;
  disco.userData = { toca: true, dica: "toque para trocar entre série e paralelo" };
  ponteiro.userData = disco.userData;
  seletor.add(disco, pivoPonteiro);
  grupo.add(seletor);
  const rotSerie = criarEtiqueta(guardar, { altura: 0.24, fundo: "rgba(255,255,255,0.94)" });
  const rotParalelo = criarEtiqueta(guardar, { altura: 0.24, fundo: "rgba(255,255,255,0.94)" });
  rotSerie.sprite.position.set(-1.72, 0.5, 0.05);
  rotParalelo.sprite.position.set(-0.7, 0.5, 0.05);
  grupo.add(rotSerie.sprite, rotParalelo.sprite);

  // cargas andando
  const cargas = new THREE.InstancedMesh(guardar(new THREE.SphereGeometry(0.048, 10, 8)), guardar(new THREE.MeshBasicMaterial({ color: escuro ? CORES.menta : CORES.caneta })), MAX_CARGAS);
  cargas.frustumCulled = false;
  grupo.add(cargas);

  comSombra(grupo);
  placa.castShadow = false;

  let ligacao: "serie" | "paralelo" | null = null;
  let caminhos: Caminho[] = [];
  let correntes: number[] = [];
  let deslocamentos: number[] = [];
  let brilhoAtual = 0;
  let brilhoAlvo = 0;
  let calor1 = 0;
  let calor2 = 0;
  let giroSeletor = 0.7;
  const valoresArrasto = { tensao: 9, r1: 6, r2: 3 };
  const atuais = { tensao: 9, r1: 6, r2: 3 };
  let segurado: THREE.Object3D | null = null;
  const ponto = new THREE.Vector3();

  const pintarFaixas = (r: ReturnType<typeof criarResistor>, ohms: number) => {
    if (r.ohms === ohms) return;
    r.ohms = ohms;
    faixasDoResistor(ohms).forEach((cor, i) => (r.faixas[i].material as THREE.MeshStandardMaterial).color.setHex(cor));
  };

  const atualizar = (estado: EstadoLab) => {
    const v = estado.valores.circuito;
    const r = circuito(v);
    if (v.ligacao !== ligacao) {
      ligacao = v.ligacao;
      const lay = LAYOUT[v.ligacao];
      montarFios(lay.segmentos);
      caminhos = lay.caminhos.map(montarCaminho);
      deslocamentos = caminhos.map(() => 0);
      r1.x = lay.r1[0];
      r1.z = lay.r1[1];
      r2.x = lay.r2[0];
      r2.z = lay.r2[1];
    }
    correntes = v.ligacao === "serie" ? [r.corrente] : [r.i1, r.i2];
    rotSerie.definir(v.ligacao === "serie" ? "● série" : "série");
    rotParalelo.definir(v.ligacao === "paralelo" ? "● paralelo" : "paralelo");
    Object.assign(atuais, { tensao: v.tensao, r1: v.r1, r2: v.r2 });
    if (!segurado) Object.assign(valoresArrasto, atuais);
    pintarFaixas(r1, v.r1);
    pintarFaixas(r2, v.r2);
    r1.rot.definir(`R1 ${fmt(v.r1, 0)} Ω`);
    r2.rot.definir(`R2 ${fmt(v.r2, 0)} Ω`);
    rotBateria.definir(`${fmt(v.tensao, 0)} V`);
    rotLampada.definir(`I = ${fmt(r.corrente, 2)} A`);
    brilhoAlvo = Math.min(1, r.potencia / 40);
    calor1 = Math.min(1, r.p1 / 60);
    calor2 = Math.min(1, r.p2 / 60);
  };

  const tick = (tempo: number, dt: number) => {
    // resistores deslizam até o lugar novo quando a ligação muda
    for (const r of [r1, r2]) {
      r.g.position.x = suave(r.g.position.x, r.x, dt, 7);
      r.g.position.z = suave(r.g.position.z, r.z, dt, 7);
      r.rot.sprite.position.set(r.g.position.x, 0.62, r.g.position.z);
    }
    r1.mat.emissiveIntensity = suave(r1.mat.emissiveIntensity, calor1 * 0.9, dt, 4);
    r2.mat.emissiveIntensity = suave(r2.mat.emissiveIntensity, calor2 * 0.9, dt, 4);

    brilhoAtual = suave(brilhoAtual, brilhoAlvo, dt, 5);
    const tremor = 1 + Math.sin(tempo * 31) * 0.015;
    luz.intensity = brilhoAtual * 5 * tremor;
    matVidro.emissiveIntensity = brilhoAtual * 1.6;
    matFilamento.color.setRGB(0.48 + brilhoAtual * 0.52, 0.35 + brilhoAtual * 0.5, 0.16 + brilhoAtual * 0.3);
    brilho.material.opacity = brilhoAtual * (escuro ? 1 : 0.85);
    brilho.scale.setScalar(0.4 + brilhoAtual * 1.5);

    giroSeletor = suave(giroSeletor, ligacao === "paralelo" ? -0.7 : 0.7, dt, 9);
    pivoPonteiro.rotation.y = giroSeletor;

    // cargas: velocidade proporcional à corrente de cada ramo
    let k = 0;
    caminhos.forEach((caminho, i) => {
      deslocamentos[i] += THREE.MathUtils.clamp(correntes[i] * 0.42, 0.04, 3.6) * dt;
      const passo = 0.3;
      for (let d = 0; d < caminho.total && k < MAX_CARGAS; d += passo) {
        pontoNoCaminho(caminho, d + deslocamentos[i] + i * 0.15, ponto);
        m4.makeTranslation(ponto.x, ponto.y, ponto.z);
        cargas.setMatrixAt(k++, m4);
      }
    });
    cargas.count = k;
    cargas.instanceMatrix.needsUpdate = true;
  };

  const passoArrasto = (objeto: THREE.Object3D, dy: number) => {
    if (objeto === corpo || objeto === faixa) {
      valoresArrasto.tensao = THREE.MathUtils.clamp(valoresArrasto.tensao - dy * 0.06, 1, 24);
      const novo = Math.round(valoresArrasto.tensao);
      if (novo !== atuais.tensao) emitir({ tipo: "circuito", parcial: { tensao: novo } });
    }
    for (const [r, chave] of [[r1, "r1"], [r2, "r2"]] as const) {
      if (objeto !== r.corpo) continue;
      valoresArrasto[chave] = THREE.MathUtils.clamp(valoresArrasto[chave] - dy * 0.08, 1, 30);
      const novo = Math.round(valoresArrasto[chave]);
      if (novo !== atuais[chave]) emitir({ tipo: "circuito", parcial: { [chave]: novo } });
    }
  };

  return {
    grupo,
    camera: { alvo: new THREE.Vector3(0, 0.1, 0.15), distancia: 7.4, elevacao: 0.78 },
    alvos: [corpo, faixa, r1.corpo, r2.corpo, disco, ponteiro, vidro],
    atualizar,
    tick,
    foco: (destino) => destino.set(LAMPADA[0], 0.6, LAMPADA[1]).applyMatrix4(grupo.matrixWorld),
    aoSegurar: (objeto) => {
      segurado = objeto;
      Object.assign(valoresArrasto, atuais);
    },
    aoArrastar: passoArrasto,
    aoTocar: (objeto) => {
      if (objeto === disco || objeto === ponteiro) emitir({ tipo: "circuito", parcial: { ligacao: ligacao === "serie" ? "paralelo" : "serie" } });
    },
    descartar: () => geometriasFio.forEach((g) => g.dispose()),
  };
}
