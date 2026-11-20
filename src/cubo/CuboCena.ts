/**
 * Cena three.js do Cubo Mágico.
 *
 * O estado lógico mora em shared/cubo.mjs; aqui só se desenha e se lê o
 * gesto. Dois estados andam juntos: `alvo` já tem todos os giros da fila
 * (é por ele que o cronômetro sabe que o cubo foi resolvido no instante do
 * gesto) e `tela` só recebe o giro quando a animação termina, e é dele que as
 * peças tiram a posição final, sem acumular erro de ponto flutuante.
 *
 * Gestos: arrastar numa peça gira a camada (o eixo é o que melhor acompanha
 * o arrasto na tela); arrastar no fundo vira o cubo inteiro.
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

/** Quadrado de cantos redondos para o adesivo. */
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
  return new THREE.ShapeGeometry(s, 4);
}

function texturaSombra() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,0,0.42)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.14)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
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
  private festa = { ativa: false, t: 0 };
  private raycaster = new THREE.Raycaster();
  private gesto:
    | null
    | { tipo: "virar"; x: number; y: number; id: number }
    | { tipo: "camada"; x0: number; y0: number; id: number; grupo: THREE.Object3D; ponto: THREE.Vector3; normal: Eixo; usado: boolean } = null;
  private corpoGeo: THREE.BufferGeometry;
  private adesivoGeo: THREE.BufferGeometry;
  private corpoMat: THREE.MeshStandardMaterial;
  /** Corpo das peças da camada que a Mine pede para girar (brilha pulsando). */
  private destaqueMat: THREE.MeshStandardMaterial;
  private destaque: Giro | null = null;
  private destaquePecas = new Set<number>();
  private adesivoMats: THREE.MeshStandardMaterial[];
  /** Trava o gesto de girar camada (modo cubo de verdade, embaralhando…). */
  travado = false;

  constructor(host: HTMLElement, opcoes: OpcoesCena) {
    this.opcoes = opcoes;
    this.n = opcoes.n;
    this.alvo = criarCubo(this.n);
    this.tela = criarCubo(this.n);
    this.palco = criarPalco(host, (t, d) => this.tick(t, d), { fov: 30, z: 11 });
    const { scene, renderer, guardar } = this.palco;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const ambiente = guardar(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
    pmrem.dispose();
    scene.environment = ambiente;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 0.6));
    const sol = new THREE.DirectionalLight(0xffffff, 1.4);
    sol.position.set(4, 7, 6);
    scene.add(sol);

    this.corpoGeo = guardar(new RoundedBoxGeometry(0.96, 0.96, 0.96, 3, 0.09));
    this.adesivoGeo = guardar(formaAdesivo(0.8, 0.13));
    this.corpoMat = guardar(new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.42, metalness: 0.1, envMapIntensity: 0.6 }));
    this.destaqueMat = guardar(new THREE.MeshStandardMaterial({ color: 0x2a2f5c, emissive: new THREE.Color(0x8b7bff), emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.1 }));
    this.adesivoMats = coresHex.map((cor) =>
      guardar(new THREE.MeshStandardMaterial({ color: new THREE.Color(cor), roughness: 0.34, metalness: 0, envMapIntensity: 0.45 })),
    );

    const sombraTex = guardar(texturaSombra());
    const sombraMat = guardar(new THREE.MeshBasicMaterial({ map: sombraTex, transparent: true, depthWrite: false }));
    this.sombra = new THREE.Mesh(guardar(new THREE.PlaneGeometry(5.4, 5.4)), sombraMat);
    this.sombra.rotation.x = -Math.PI / 2;
    this.sombra.position.y = -2.45;
    scene.add(this.sombra);

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
  }

  /* ---------- montagem ---------- */

  private montarPecas() {
    for (const g of this.grupos) g.removeFromParent();
    this.grupos = [];
    this.pegaveis = [];
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
        m.position.copy(normal).multiplyScalar(0.483);
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
      const brilha = this.destaque ? pecaNoGiro(peca, this.destaque) : this.destaquePecas.has(peca.id);
      if (corpo) corpo.material = brilha ? this.destaqueMat : this.corpoMat;
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
    this.alvoRaiz.copy(CuboCena.vista(amareloEmCima));
  }

  /** Vira o cubo inteiro na tela (x, y, z ou setas), sem mexer no estado. */
  virar(eixo: Eixo, q: number) {
    const giro = new THREE.Quaternion().setFromAxisAngle(vetorEixo(eixo), (-q * Math.PI) / 2);
    this.alvoRaiz.premultiply(giro);
  }

  comemorar() {
    if (this.opcoes.reduzido) return;
    this.festa = { ativa: true, t: 0 };
  }

  setReduzido(reduzido: boolean) {
    this.opcoes.reduzido = reduzido;
  }

  destruir() {
    const canvas = this.palco.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.aoApertar);
    canvas.removeEventListener("pointermove", this.aoMover);
    canvas.removeEventListener("pointerup", this.aoSoltar);
    canvas.removeEventListener("pointercancel", this.aoSoltar);
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

    // cubo segue o alvo de orientação com mola exponencial
    this.raiz.quaternion.slerp(this.alvoRaiz, 1 - Math.exp(-delta * 16));

    // respiração e paralaxe leve pelo ponteiro (desligadas no movimento reduzido)
    const calmo = this.opcoes.reduzido || this.gesto !== null;
    let hop = 0;
    if (this.festa.ativa) {
      this.festa.t += delta;
      const t = this.festa.t;
      hop = Math.sin(Math.min(1, t / 0.9) * Math.PI) * 0.55;
      this.flutua.rotation.y = (1 - Math.cos(Math.min(1, t / 1.1) * Math.PI)) * Math.PI;
      if (t > 1.15) {
        this.festa.ativa = false;
        this.flutua.rotation.y = 0;
      }
    } else {
      const alvoX = calmo ? 0 : pointer.y * -0.07;
      const alvoY = calmo ? 0 : pointer.x * 0.1;
      this.flutua.rotation.x += (alvoX - this.flutua.rotation.x) * Math.min(1, delta * 5);
      this.flutua.rotation.y += (alvoY - this.flutua.rotation.y) * Math.min(1, delta * 5);
    }
    if (this.destaque || this.destaquePecas.size) this.destaqueMat.emissiveIntensity = this.opcoes.reduzido ? 0.6 : 0.45 + Math.sin(tempo * 5) * 0.25;
    this.flutua.position.y = (this.opcoes.reduzido ? 0 : Math.sin(tempo * 1.2) * 0.06) + hop;
    const sm = this.sombra.material as THREE.MeshBasicMaterial;
    sm.opacity = 1 - hop * 0.9;
    this.sombra.scale.setScalar(1 - hop * 0.25 + (this.opcoes.reduzido ? 0 : Math.sin(tempo * 1.2) * -0.02));
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
      // mola com um tiquinho de passada (o "clique" de um cubo bom); o
      // embaralhamento usa a versão criticamente amortecida e mais dura.
      const k = a.rapido ? 1500 : 560;
      const c = a.rapido ? 2 * Math.sqrt(k) : 38;
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
    if (!g || g.id !== event.pointerId) return;
    if (g.tipo === "virar") {
      const dx = event.clientX - g.x;
      const dy = event.clientY - g.y;
      g.x = event.clientX;
      g.y = event.clientY;
      const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * 0.009);
      const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * 0.009);
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
    this.palco.renderer.domElement.style.cursor = "grab";
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
