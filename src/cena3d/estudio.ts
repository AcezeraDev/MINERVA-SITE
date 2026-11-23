/**
 * Estúdio fotográfico procedural para IBL (PMREM) e texturas auxiliares PBR.
 *
 * Substitui o RoomEnvironment genérico (que deixa metais cinzas e lavados) por
 * uma sala escura com caixas de luz HDR (valores > 1.0): softbox principal
 * quente, preenchimento frio, rebatedor de teto e réguas de recorte atrás.
 * É o contraste entre escuro profundo e luzes nítidas que faz metal parecer
 * metal e vidro/gema ter brilho real.
 */
import * as THREE from "three";

export type OpcoesEstudio = {
  /** Cor de destaque para a régua de recorte lateral (ex: cor da liga ou da matéria). */
  acento?: THREE.ColorRepresentation;
  /** "claro" levanta um pouco a luz ambiente da cúpula para cenas no papel branco. */
  modo?: "escuro" | "claro";
  /** Suavização do PMREM (menor = reflexos mais nítidos; padrão 0.018). */
  sigma?: number;
};

/**
 * Gera um mapa de ambiente HDR via PMREMGenerator e descarta toda a cena
 * temporária imediatamente. Quem chama deve descartar a textura retornada
 * (ex: passando por `guardar(...)`).
 */
export function criarAmbienteEstudio(
  renderer: THREE.WebGLRenderer,
  opcoes: OpcoesEstudio = {},
): THREE.Texture {
  const cena = new THREE.Scene();
  const descartar: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    descartar.push(item);
    return item;
  };

  const claro = opcoes.modo === "claro";
  const acento = new THREE.Color(opcoes.acento ?? 0x8ea8ff);

  // Cúpula escura com gradiente chão → teto para dar contraste nos reflexos
  const salaGeo = track(new THREE.SphereGeometry(14, 32, 16));
  const pos = salaGeo.attributes.position;
  const cores = new Float32Array(pos.count * 3);
  const corChao = new THREE.Color(claro ? 0x1a2030 : 0x06070b);
  const corTeto = new THREE.Color(claro ? 0x454e63 : 0x262c3a);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i) / 14;
    const t = THREE.MathUtils.smoothstep(y, -0.55, 0.9);
    tmp.copy(corChao).lerp(corTeto, t);
    cores.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  salaGeo.setAttribute("color", new THREE.BufferAttribute(cores, 3));
  cena.add(
    new THREE.Mesh(
      salaGeo,
      track(new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true })),
    ),
  );

  // Caixas de luz HDR (cores > 1.0 criam especulares nítidos no metal/clearcoat)
  const painel = (w: number, h: number, cor: THREE.Color, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(
      track(new THREE.PlaneGeometry(w, h)),
      track(new THREE.MeshBasicMaterial({ color: cor, side: THREE.DoubleSide })),
    );
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    cena.add(mesh);
  };

  // Softbox principal quente (frente-direita alta)
  painel(4.4, 5.8, new THREE.Color(1, 0.96, 0.89).multiplyScalar(7.2), 5.6, 3.4, 5.2);
  // Preenchimento frio suave (esquerda)
  painel(2.8, 6.2, new THREE.Color(0.82, 0.91, 1).multiplyScalar(claro ? 2.8 : 2.3), -6.6, 1.4, 3.6);
  // Teto difusor
  painel(7.5, 7.5, new THREE.Color(1, 1, 1).multiplyScalar(claro ? 3.2 : 2.6), 0, 9.5, 0.6);
  // Régua de recorte branca (trás-esquerda)
  painel(0.75, 9.2, new THREE.Color(1, 1, 1).multiplyScalar(9.5), -4.4, 0.6, -6.2);
  // Régua de recorte na cor de destaque (trás-direita)
  painel(
    0.8,
    9.2,
    acento.clone().lerp(new THREE.Color(1, 1, 1), 0.32).multiplyScalar(7.2),
    4.8,
    0.6,
    -5.8,
  );
  // Rebatedor baixo sutil (ilumina a parte inferior de taças e peças suspensas)
  painel(9.5, 1.4, new THREE.Color(1, 0.95, 0.88).multiplyScalar(claro ? 1.8 : 1.25), 0, -6.2, 4.2);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const textura = pmrem.fromScene(cena, opcoes.sigma ?? 0.018).texture;
  pmrem.dispose();
  descartar.forEach((item) => item.dispose());
  return textura;
}

/** Sombra de contato macia em gradiente radial (para planos abaixo de objetos). */
export function texturaSombraContato(tamanho = 128): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = tamanho;
  const g = c.getContext("2d")!;
  const meio = tamanho / 2;
  const grad = g.createRadialGradient(meio, meio, 0, meio, meio, meio);
  grad.addColorStop(0, "rgba(0,0,0,1)");
  grad.addColorStop(0.42, "rgba(0,0,0,0.58)");
  grad.addColorStop(0.75, "rgba(0,0,0,0.16)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, tamanho, tamanho);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Mapa de rugosidade escovado sutil para metais torneados (faixas horizontais
 * microscópicas que quebram o reflexo plástico uniforme).
 */
export function texturaMetalEscovado(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgb(225,225,225)";
  g.fillRect(0, 0, c.width, c.height);
  // Linhas horizontais finas de torno mecânico
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let y = 0; y < c.height; y += 1) {
    const v = Math.round(205 + rand() * 50);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(0, y, c.width, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3);
  return tex;
}
