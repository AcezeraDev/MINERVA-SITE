/**
 * A Mine em 3D para o centro da órbita da Home: cabeça arredondada em
 * cel-shading (MeshToonMaterial + contorno de tinta por casca invertida, o
 * mesmo traço do caderno), olhos que seguem o ponteiro e piscam, boca que
 * sorri mais no hover, bochechas, orelhas e antena em menta.
 *
 * Tudo por molas e valores escalares: nada de setState, nada de alocação por
 * quadro. Quem chama só passa o alvo do olhar e o estado (hover, cutucão).
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mola } from "./palco";

const TINTA = 0x1d2440;
const MENTA = 0x39f59a;

type Guardar = <T extends { dispose: () => void }>(item: T) => T;

export type Mine3D = {
  grupo: THREE.Group;
  /** Malha invisível usada só no raycast (o rosto inteiro é clicável). */
  alvo: THREE.Mesh;
  /** Faz a Mine olhar para um ponto do mundo e reagir ao estado do quadro. */
  atualizar: (tempo: number, delta: number, olhar: THREE.Vector3, estado: { hover: boolean }) => void;
  /** Pulinho de alegria (matéria nova, clique). */
  pular: (forca?: number) => void;
  /** Susto curto (a Mine dos pets cutucou a cena). */
  assustar: () => void;
};

function rampaToon(guardar: Guardar) {
  // três degraus de luz, como sombra feita a lápis de cor. O mais escuro fica
  // alto (185): com 120–150 a cabeça e a tela viravam cinza ("apagadas")
  const dados = new Uint8Array([185, 228, 255]);
  const textura = guardar(new THREE.DataTexture(dados, dados.length, 1, THREE.RedFormat));
  textura.minFilter = THREE.NearestFilter;
  textura.magFilter = THREE.NearestFilter;
  textura.generateMipmaps = false;
  textura.needsUpdate = true;
  return textura;
}

export function criarMine3D(guardar: Guardar, opcoes: { escuro?: boolean; aura?: boolean } = {}): Mine3D {
  const escuro = Boolean(opcoes.escuro);
  const rampa = rampaToon(guardar);
  const toon = (cor: number, emissiva = 0) =>
    guardar(new THREE.MeshToonMaterial({ color: cor, gradientMap: rampa, emissive: emissiva ? cor : 0x000000, emissiveIntensity: emissiva, toneMapped: false }));
  const contorno = guardar(new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide }));
  /** Casca um pouco maior, só com as faces de trás: vira o traço de caneta. */
  const comContorno = (malha: THREE.Mesh, espessura: number) => {
    const casca = new THREE.Mesh(malha.geometry, contorno);
    casca.scale.setScalar(1 + espessura);
    malha.add(casca);
    return malha;
  };

  const grupo = new THREE.Group();
  /** Pivô do corpo: balança, pula e gira sem mexer no grupo (que só segue a órbita). */
  const corpo = new THREE.Group();
  grupo.add(corpo);
  const cabeca = new THREE.Group();
  corpo.add(cabeca);

  // cabeça: caixa de cantos bem redondos, branca
  const geoCabeca = guardar(new RoundedBoxGeometry(1.6, 1.5, 1.15, 6, 0.42));
  // um pouco de luz própria: o lado na sombra continua branco, não cinza
  const malhaCabeca = comContorno(new THREE.Mesh(geoCabeca, toon(0xffffff, 0.14)), 0.045);
  cabeca.add(malhaCabeca);
  // no tema escuro o contorno de tinta some no fundo: um halo menta em volta
  // da silhueta (outra casca de faces de trás, translúcida) separa a Mine do preto
  if (escuro) {
    const halo = new THREE.Mesh(geoCabeca, guardar(new THREE.MeshBasicMaterial({ color: MENTA, side: THREE.BackSide, transparent: true, opacity: 0.22, depthWrite: false })));
    halo.scale.setScalar(1.08);
    malhaCabeca.add(halo);
  }

  // tela do rosto, um pouco saltada da frente
  const geoTela = guardar(new RoundedBoxGeometry(1.18, 0.86, 0.12, 4, 0.2));
  const tela = comContorno(new THREE.Mesh(geoTela, toon(0xdfe8f8, 0.2)), 0.05);
  tela.position.set(0, -0.04, 0.56);
  cabeca.add(tela);

  // olhos: elipses de tinta com um brilho branco
  const geoOlho = guardar(new THREE.SphereGeometry(1, 20, 16));
  const matOlho = guardar(new THREE.MeshBasicMaterial({ color: TINTA }));
  const matBrilho = guardar(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const olhos = [-0.25, 0.25].map((x) => {
    const olho = new THREE.Group();
    const bola = new THREE.Mesh(geoOlho, matOlho);
    bola.scale.set(0.1, 0.13, 0.03);
    const brilho = new THREE.Mesh(geoOlho, matBrilho);
    brilho.scale.set(0.032, 0.036, 0.01);
    brilho.position.set(0.035, 0.05, 0.025);
    olho.add(bola, brilho);
    olho.position.set(x, 0.06, 0.63);
    tela.parent!.add(olho);
    return { grupo: olho, x };
  });

  // boca: arco de caneta
  const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.15, 0, 0), new THREE.Vector3(0, -0.15, 0), new THREE.Vector3(0.15, 0, 0));
  const geoBoca = guardar(new THREE.TubeGeometry(curva, 20, 0.028, 8, false));
  const boca = new THREE.Mesh(geoBoca, matOlho);
  boca.position.set(0, -0.17, 0.63);
  cabeca.add(boca);

  // bochechas: aparecem quando ela fica contente
  const matBochecha = guardar(new THREE.MeshBasicMaterial({ color: 0xff8fab, transparent: true, opacity: 0, depthWrite: false }));
  const geoBochecha = guardar(new THREE.CircleGeometry(0.08, 20));
  const bochechas = [-0.42, 0.42].map((x) => {
    const b = new THREE.Mesh(geoBochecha, matBochecha);
    b.scale.y = 0.6;
    b.position.set(x, -0.12, 0.625);
    cabeca.add(b);
    return b;
  });

  // orelhas em menta
  const geoOrelha = guardar(new RoundedBoxGeometry(0.26, 0.62, 0.56, 4, 0.1));
  const matMenta = toon(MENTA, 0.18);
  for (const lado of [-1, 1]) {
    const orelha = comContorno(new THREE.Mesh(geoOrelha, matMenta), 0.07);
    orelha.position.set(lado * 0.86, -0.02, 0);
    cabeca.add(orelha);
  }

  // antena: haste de tinta e bolinha menta que pulsa
  // no tema escuro a haste de tinta sumia no fundo e a bolinha parecia solta
  const matHaste = escuro ? guardar(new THREE.MeshBasicMaterial({ color: 0xd7deec })) : matOlho;
  const haste = new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.04, 0.04, 0.36, 10)), matHaste);
  haste.position.y = 0.9;
  cabeca.add(haste);
  const matBola = toon(MENTA, 0.4);
  const bola = comContorno(new THREE.Mesh(guardar(new THREE.SphereGeometry(0.15, 24, 18)), matBola), 0.12);
  bola.position.y = 1.14;
  cabeca.add(bola);

  // aura macia atrás dela (normal blending: aditivo some no papel claro)
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, `rgba(57,245,154,${escuro ? 0.42 : 0.32})`);
  grad.addColorStop(0.45, `rgba(57,245,154,${escuro ? 0.16 : 0.1})`);
  grad.addColorStop(1, "rgba(57,245,154,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const texAura = guardar(new THREE.CanvasTexture(canvas));
  texAura.colorSpace = THREE.SRGBColorSpace;
  const aura = new THREE.Sprite(guardar(new THREE.SpriteMaterial({ map: texAura, transparent: true, depthWrite: false })));
  aura.scale.setScalar(4.2);
  aura.renderOrder = -1;
  // num palco pequeno a aura passa da borda do canvas e vira um quadrado marcado
  if (opcoes.aura !== false) grupo.add(aura);

  // alvo do raycast: esfera invisível do tamanho da cabeça
  const alvo = new THREE.Mesh(
    guardar(new THREE.SphereGeometry(1.05, 12, 10)),
    guardar(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })),
  );
  alvo.userData.id = "nucleo";
  corpo.add(alvo);

  // estado das molas
  const salto = { v: 0, vel: 0 };
  const giro = { v: 0, vel: 0 };
  let giroAlvo = 0;
  const contente = { v: 0, vel: 0 };
  const susto = { v: 0, vel: 0 };
  let sustoAlvo = 0;
  const olhoX = { v: 0, vel: 0 };
  const olhoY = { v: 0, vel: 0 };
  let proximaPiscada = 1.5;
  let piscando = 0;
  const pivo = new THREE.Object3D();
  const quat = new THREE.Quaternion();
  const local = new THREE.Vector3();

  const atualizar: Mine3D["atualizar"] = (tempo, delta, olhar, estado) => {
    // a cabeça vira para o alvo, devagar (slerp exponencial)
    pivo.position.setFromMatrixPosition(grupo.matrixWorld);
    pivo.lookAt(olhar);
    quat.copy(pivo.quaternion);
    if (grupo.parent) {
      grupo.parent.getWorldQuaternion(pivo.quaternion);
      quat.premultiply(pivo.quaternion.invert());
    }
    cabeca.quaternion.slerp(quat, 1 - Math.exp(-delta * 5));

    // os olhos andam um pouco mais na mesma direção (dá vida ao olhar)
    local.copy(olhar);
    cabeca.worldToLocal(local);
    local.normalize();
    // escala ~0 (entrada com mola) deixa a matriz singular: NaN travaria as molas dos olhos
    if (!Number.isFinite(local.x) || !Number.isFinite(local.y)) local.set(0, 0, 1);
    const ox = mola(olhoX, THREE.MathUtils.clamp(local.x * 0.5, -0.07, 0.07), delta, 260, 24);
    const oy = mola(olhoY, THREE.MathUtils.clamp(local.y * 0.4, -0.05, 0.05), delta, 260, 24);

    // piscada a cada 2,5–5,5 s, às vezes dupla
    proximaPiscada -= delta;
    if (proximaPiscada <= 0) {
      piscando = 0.14;
      proximaPiscada = Math.random() < 0.2 ? 0.22 : 2.5 + Math.random() * 3;
    }
    piscando = Math.max(0, piscando - delta);
    const fechado = piscando > 0 ? Math.sin((piscando / 0.14) * Math.PI) : 0;

    const feliz = mola(contente, estado.hover ? 1 : 0, delta, 200, 18);
    sustoAlvo = Math.max(0, sustoAlvo - delta * 1.6);
    const assustada = mola(susto, sustoAlvo, delta, 320, 16);
    for (const olho of olhos) {
      olho.grupo.position.x = olho.x + ox;
      olho.grupo.position.y = 0.06 + oy;
      const abre = Math.max(0.08, 1 - fechado) * (1 + assustada * 0.35);
      // contente, o olho vira um arquinho (achata e sobe)
      olho.grupo.scale.set(1 + assustada * 0.25, abre * (1 - feliz * 0.35), 1);
    }
    boca.scale.set(1 + feliz * 0.35 - assustada * 0.4, 1 + feliz * 0.9 - assustada * 1.6, 1);
    matBochecha.opacity = Math.min(0.85, feliz * 0.85);
    for (const b of bochechas) b.scale.x = 1 + feliz * 0.2;

    // corpo: flutua, balança, pula (mola com overshoot) e gira no clique
    const y = mola(salto, 0, delta, 120, 9);
    const volta = mola(giro, giroAlvo, delta, 90, 14);
    corpo.position.y = Math.sin(tempo * 1.2) * 0.08 + y;
    corpo.rotation.z = Math.sin(tempo * 0.8) * 0.05 + feliz * Math.sin(tempo * 9) * 0.04;
    corpo.rotation.y = volta;
    const estica = THREE.MathUtils.clamp(salto.vel * 0.04, -0.12, 0.12);
    corpo.scale.set(1 - estica * 0.5 + feliz * 0.04, 1 + estica + feliz * 0.04, 1 - estica * 0.5 + feliz * 0.04);

    // antena pulsa; mais forte quando ela está contente
    const pulso = 0.35 + Math.sin(tempo * 3.2) * 0.15 + feliz * 0.5;
    (matBola as THREE.MeshToonMaterial).emissiveIntensity = pulso;
    bola.scale.setScalar(1 + Math.sin(tempo * 3.2) * 0.06 + feliz * 0.15);
    aura.material.opacity = 0.75 + feliz * 0.25 + Math.sin(tempo * 1.6) * 0.1;
    aura.scale.setScalar(4.2 + feliz * 0.6 + Math.sin(tempo * 1.6) * 0.15);
  };

  return {
    grupo,
    alvo,
    atualizar,
    pular: (forca = 1) => {
      salto.vel += 6.5 * forca;
      if (forca >= 1) giroAlvo += Math.PI * 2;
    },
    assustar: () => {
      sustoAlvo = 1;
      salto.vel += 3.5;
    },
  };
}
