import type * as THREE from "three";
import type { AcaoLab, EstadoLab } from "../tipos";

/**
 * Um experimento montado na bancada. A bancada cuida de câmera, luz, laço,
 * ponteiro e troca de kit; o kit só monta as peças e reage ao estado.
 *
 * Interação: objetos em `alvos` com `userData.dica` mostram a etiqueta no
 * hover; `userData.arrasta` vira arrasto vertical (aoArrastar recebe pixels),
 * `userData.toca` vira toque (aoTocar).
 */
export type Kit = {
  grupo: THREE.Group;
  camera: { alvo: THREE.Vector3; distancia: number; elevacao: number };
  /** Onde a Mine fica neste kit (fora do caminho do experimento). */
  lugarDaMine?: THREE.Vector3;
  alvos: THREE.Object3D[];
  atualizar: (estado: EstadoLab) => void;
  tick: (tempo: number, dt: number) => void;
  /** Ponto do mundo para onde a Mine olha (o que está acontecendo). */
  foco: (destino: THREE.Vector3) => void;
  aoArrastar?: (objeto: THREE.Object3D, dy: number, dx: number) => void;
  aoTocar?: (objeto: THREE.Object3D) => void;
  /** Chamado ao começar/terminar um arrasto (para o kit guardar o valor de partida). */
  aoSegurar?: (objeto: THREE.Object3D | null) => void;
  /** Libera o que não passou pelo `guardar` (geometrias refeitas em tempo real). */
  descartar?: () => void;
};

export type Emitir = (acao: AcaoLab) => void;
