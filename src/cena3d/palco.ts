/**
 * Palco three.js das cenas das abas Redação e Atividades.
 *
 * Segue o contrato da Mesa da Home (src/caderno/MesaDeEstudo.tsx): DPR com
 * teto, laço parado fora da tela e com a aba escondida, ponteiro gravado num
 * objeto (nada de setState por pointermove) e tudo descartado ao desmontar.
 */
import * as THREE from "three";
import { aoCutucar, minePos, perto } from "../pets/bus";

export type Palco = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /** Ponteiro em -1..1 relativo ao palco, já suavizado a cada quadro. */
  pointer: { x: number; y: number; alvoX: number; alvoY: number; dentro: boolean };
  /** A Mine (pets) perto do palco: `cutucao` sobe quando ela bate/pula e decai sozinho; `lado` é de onde veio (-1 esquerda, 1 direita). */
  mine: { cutucao: number; lado: number; olhando: boolean };
  /** Guarda geometrias, materiais e texturas para o dispose do fim. */
  guardar: <T extends { dispose: () => void }>(item: T) => T;
  destruir: () => void;
};

export function criarPalco(host: HTMLElement, tick: (tempo: number, delta: number) => void, opcoes: { fov?: number; z?: number } = {}): Palco {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.className = "cena3d-canvas";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opcoes.fov ?? 32, 1, 0.1, 60);
  camera.position.set(0, 0, opcoes.z ?? 9);

  const pointer = { x: 0, y: 0, alvoX: 0, alvoY: 0, dentro: false };
  const descartaveis: Array<{ dispose: () => void }> = [];
  const guardar = <T extends { dispose: () => void }>(item: T) => {
    descartaveis.push(item);
    return item;
  };

  const medir = () => {
    const largura = Math.max(1, host.clientWidth);
    const altura = Math.max(1, host.clientHeight);
    renderer.setSize(largura, altura, false);
    camera.aspect = largura / altura;
    camera.updateProjectionMatrix();
  };
  medir();
  const ro = new ResizeObserver(medir);
  ro.observe(host);

  // o rect é medido na entrada, não a cada movimento
  let rect = host.getBoundingClientRect();
  const onEnter = () => {
    rect = host.getBoundingClientRect();
    pointer.dentro = true;
  };
  const onMove = (event: PointerEvent) => {
    pointer.alvoX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.alvoY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  };
  const onLeave = () => {
    pointer.dentro = false;
    pointer.alvoX = 0;
    pointer.alvoY = 0;
  };
  host.addEventListener("pointerenter", onEnter);
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerleave", onLeave);

  // A Mine andando pelo site: a cena olha para ela quando o mouse não está em
  // cima e dá um tranco quando ela cutuca. Rect medido no máximo 4x/s.
  const mine = { cutucao: 0, lado: 0, olhando: false };
  let rectMine = host.getBoundingClientRect();
  let medidoMine = 0;
  const pararCutucao = aoCutucar((c) => {
    const r = host.getBoundingClientRect();
    if (c.x < r.left - 80 || c.x > r.right + 80 || c.y < r.top - 120 || c.y > r.bottom + 120) return;
    mine.cutucao = Math.min(1.6, mine.cutucao + c.forca);
    mine.lado = Math.sign(c.x - (r.left + r.width / 2)) || 1;
    pointer.alvoX = Math.max(-1, Math.min(1, pointer.alvoX - mine.lado * 0.7 * c.forca));
    ligar();
  });

  let visivel = true;
  let ativo = !document.hidden;
  let quadro = 0;
  let anterior = performance.now();
  const relogio = { inicio: anterior };

  const laco = (agora: number) => {
    quadro = 0;
    if (!visivel || !ativo) return;
    // o carimbo do rAF pode vir antes do performance.now() do ligar(): delta negativo
    const delta = Math.max(0, Math.min(0.05, (agora - anterior) / 1000));
    anterior = agora;
    if (!pointer.dentro) {
      if (agora - medidoMine > 250) { medidoMine = agora; rectMine = host.getBoundingClientRect(); }
      if (perto(rectMine, 220)) {
        mine.olhando = true;
        pointer.alvoX = Math.max(-1, Math.min(1, ((minePos.x - rectMine.left) / rectMine.width) * 2 - 1));
        pointer.alvoY = Math.max(-1, Math.min(1, -(((minePos.y - 50 - rectMine.top) / rectMine.height) * 2 - 1)));
      } else if (mine.olhando) {
        mine.olhando = false;
        pointer.alvoX = 0;
        pointer.alvoY = 0;
      }
    }
    // mola simples para o ponteiro: a cena acompanha, não gruda
    pointer.x += (pointer.alvoX - pointer.x) * Math.min(1, delta * 6);
    pointer.y += (pointer.alvoY - pointer.y) * Math.min(1, delta * 6);
    tick((agora - relogio.inicio) / 1000, delta);
    if (mine.cutucao > 0.01) {
      // tranco do cutucão: a câmera sacode e assenta
      const t = (agora - relogio.inicio) / 1000;
      const dx = Math.sin(t * 38) * mine.cutucao * 0.14, dy = Math.abs(Math.cos(t * 31)) * mine.cutucao * 0.08;
      camera.position.x += dx; camera.position.y += dy;
      renderer.render(scene, camera);
      camera.position.x -= dx; camera.position.y -= dy;
      mine.cutucao *= Math.exp(-delta * 4.5);
    } else renderer.render(scene, camera);
    quadro = requestAnimationFrame(laco);
  };
  const ligar = () => {
    if (quadro || !visivel || !ativo) return;
    anterior = performance.now();
    quadro = requestAnimationFrame(laco);
  };

  const io = new IntersectionObserver(([entrada]) => {
    visivel = entrada.isIntersecting;
    ligar();
  });
  io.observe(host);
  const onVisibility = () => {
    ativo = !document.hidden;
    ligar();
  };
  document.addEventListener("visibilitychange", onVisibility);
  ligar();

  return {
    scene,
    camera,
    renderer,
    pointer,
    mine,
    guardar,
    destruir: () => {
      pararCutucao();
      cancelAnimationFrame(quadro);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("pointerenter", onEnter);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      descartaveis.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

/** Cor de um token do caderno ("47 212 131") como THREE.Color. */
export function corDoToken(nome: string, reserva: string) {
  const bruto = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  const partes = bruto.split(/\s+/).map(Number);
  if (partes.length === 3 && partes.every((valor) => Number.isFinite(valor))) {
    return new THREE.Color(partes[0] / 255, partes[1] / 255, partes[2] / 255);
  }
  return new THREE.Color(reserva);
}

/** Mola criticamente amortecida para valores escalares das cenas. */
export function mola(atual: { v: number; vel: number }, alvo: number, delta: number, rigidez = 170, amortecimento = 18) {
  const forca = (alvo - atual.v) * rigidez - atual.vel * amortecimento;
  atual.vel += forca * delta;
  atual.v += atual.vel * delta;
  return atual.v;
}
