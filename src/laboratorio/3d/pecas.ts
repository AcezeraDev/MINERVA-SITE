/**
 * Peças comuns da bancada 3D do Laboratório: etiquetas em sprite (texto que
 * muda sem recriar material), setas de força, faixas de cor de resistor,
 * tapete de corte e helpers de material. Nada aqui aloca por quadro.
 */
import * as THREE from "three";

export type Guardar = <T extends { dispose: () => void }>(item: T) => T;

/** Contexto que a bancada entrega a cada kit. */
export type CtxKit = {
  guardar: Guardar;
  escuro: boolean;
  tinta: THREE.Color;
  renderer: THREE.WebGLRenderer;
};

export const CORES = {
  tinta: 0x1d2440,
  menta: 0x39f59a,
  rosa: 0xff7d9c,
  amarelo: 0xf4e04d,
  lilas: 0x9b87f5,
  caneta: 0x3446c9,
  vermelho: 0xe0533d,
  papel: 0xfbfaf4,
};

/**
 * Etiqueta: sprite com canvas próprio. `definir(texto)` redesenha só quando o
 * texto muda. Tamanho no mundo pela altura (a largura acompanha o texto).
 */
export function criarEtiqueta(
  guardar: Guardar,
  opcoes: { altura?: number; fundo?: string; cor?: string; fonte?: "mao" | "numero"; borda?: string; atras?: boolean } = {},
) {
  const altura = opcoes.altura ?? 0.26;
  const canvas = document.createElement("canvas");
  canvas.height = 96;
  canvas.width = 256;
  const ctx = canvas.getContext("2d")!;
  const textura = guardar(new THREE.CanvasTexture(canvas));
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  // etiqueta é anotação: fica por cima das peças (como no caderno, escrita sobre o desenho)
  const material = guardar(new THREE.SpriteMaterial({ map: textura, transparent: true, depthWrite: false, depthTest: opcoes.atras ? true : false }));
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 10;
  let atual = "";
  const fonte = opcoes.fonte === "numero" ? `800 54px system-ui, sans-serif` : `700 58px "Kalam", "Gochi Hand", "Comic Sans MS", cursive`;
  const desenhar = (texto: string) => {
    ctx.font = fonte;
    const largura = Math.ceil(ctx.measureText(texto).width) + 52;
    if (canvas.width !== largura) canvas.width = largura;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (opcoes.fundo) {
      ctx.fillStyle = opcoes.fundo;
      ctx.beginPath();
      ctx.roundRect(4, 8, canvas.width - 8, canvas.height - 16, 26);
      ctx.fill();
      if (opcoes.borda) {
        ctx.strokeStyle = opcoes.borda;
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    }
    ctx.font = fonte;
    ctx.fillStyle = opcoes.cor ?? "#1d2440";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(texto, canvas.width / 2, canvas.height / 2 + 3);
    textura.dispose();
    textura.needsUpdate = true;
    sprite.scale.set((altura * canvas.width) / canvas.height, altura, 1);
  };
  const definir = (texto: string) => {
    if (texto === atual) return;
    atual = texto;
    desenhar(texto);
  };
  // a letra à mão pode chegar depois do primeiro desenho
  document.fonts?.ready.then(() => atual && desenhar(atual));
  return { sprite, definir };
}

/** Seta de força: haste + ponta. `apontar(origem, vetor)` em coordenadas do pai. */
export function criarSeta(guardar: Guardar, geo: { haste: THREE.BufferGeometry; ponta: THREE.BufferGeometry }, cor: THREE.ColorRepresentation) {
  // seta de força atravessa a rampa (o peso aponta para dentro dela): desenha por cima
  const material = guardar(new THREE.MeshBasicMaterial({ color: cor, depthTest: false, transparent: true }));
  const grupo = new THREE.Group();
  const haste = new THREE.Mesh(geo.haste, material);
  const ponta = new THREE.Mesh(geo.ponta, material);
  haste.renderOrder = ponta.renderOrder = 8;
  grupo.add(haste, ponta);
  const eixo = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const apontar = (origem: THREE.Vector3, vetor: THREE.Vector3) => {
    const comprimento = vetor.length();
    grupo.visible = comprimento > 0.04;
    if (!grupo.visible) return;
    dir.copy(vetor).divideScalar(comprimento);
    grupo.position.copy(origem);
    grupo.quaternion.setFromUnitVectors(eixo, dir);
    const cabeca = Math.min(0.18, comprimento * 0.45);
    haste.scale.set(1, Math.max(0.001, comprimento - cabeca), 1);
    ponta.position.y = comprimento - cabeca;
    ponta.scale.set(1, cabeca / 0.18, 1);
  };
  return { grupo, apontar };
}

/** Geometrias compartilhadas das setas (haste com base na origem, ponta com base em y=0). */
export function geometriasSeta(guardar: Guardar) {
  const haste = guardar(new THREE.CylinderGeometry(0.028, 0.028, 1, 10));
  haste.translate(0, 0.5, 0);
  const ponta = guardar(new THREE.ConeGeometry(0.075, 0.18, 14));
  ponta.translate(0, 0.09, 0);
  return { haste, ponta };
}

/** Faixas de cor do resistor (código de cores de 4 faixas, ±5% em dourado). */
export function faixasDoResistor(ohms: number) {
  const cores = [0x111111, 0x7a4a24, 0xd02a2a, 0xf07a1a, 0xf2d21b, 0x2fa84f, 0x2f62d8, 0x8a3fc7, 0x8b8b8b, 0xf5f5f5];
  const inteiro = Math.max(1, Math.round(ohms));
  let digitos = String(inteiro);
  let multiplicador = 0;
  if (digitos.length === 1) {
    // 1..9 Ω: dígitos "0X" não existem; vira X0 × 0,1 (faixa dourada)
    return [cores[inteiro], cores[0], 0xc9a227, 0xc9a227];
  }
  multiplicador = digitos.length - 2;
  digitos = digitos.slice(0, 2);
  return [cores[Number(digitos[0])], cores[Number(digitos[1])], cores[multiplicador], 0xc9a227];
}

/** Tapete de corte: verde, grade fina, régua nas bordas. É o chão de todos os kits. */
export function texturaTapete(escuro: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 576;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = escuro ? "#17352c" : "#2f7a63";
  ctx.fillRect(0, 0, 1024, 576);
  const passo = 1024 / 40;
  for (let i = 0; i <= 40; i += 1) {
    ctx.fillStyle = i % 5 ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.22)";
    ctx.fillRect(i * passo, 0, i % 5 ? 1 : 1.6, 576);
  }
  for (let j = 0; j <= 22; j += 1) {
    ctx.fillStyle = j % 5 ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.22)";
    ctx.fillRect(0, j * passo, 1024, j % 5 ? 1 : 1.6);
  }
  // diagonais de 45° de tapete de corte
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 576);
  ctx.lineTo(576, 0);
  ctx.moveTo(448, 576);
  ctx.lineTo(1024, 0);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "700 13px system-ui, sans-serif";
  for (let i = 0; i <= 40; i += 5) ctx.fillText(String(i), i * passo + 3, 14);
  ctx.font = "800 15px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText("LABORATÓRIO DA MINE", 20, 560);
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 8;
  return textura;
}

/** Vidro de laboratório: transmissão física com um fio de reflexo. */
export function materialVidro(guardar: Guardar, escuro: boolean) {
  return guardar(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.04,
      metalness: 0,
      transmission: 1,
      thickness: 0.06,
      ior: 1.45,
      transparent: true,
      opacity: escuro ? 0.6 : 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: 1.3,
    }),
  );
}

/** Liga sombra em tudo que é malha dentro do grupo. */
export function comSombra(objeto: THREE.Object3D, recebe = true) {
  objeto.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.Material;
    if (mat.transparent) return;
    m.castShadow = true;
    m.receiveShadow = recebe;
  });
  return objeto;
}

/** Aproxima um número (mola criticamente amortecida por exponencial). */
export function suave(atual: number, alvo: number, dt: number, rapidez = 8) {
  return atual + (alvo - atual) * (1 - Math.exp(-dt * rapidez));
}
