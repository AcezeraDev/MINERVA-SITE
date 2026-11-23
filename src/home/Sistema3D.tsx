/**
 * Sistema de matérias da Home: cada matéria é um caderno em órbita em volta
 * do núcleo da Mine. Arrastar gira o sistema (com inércia), passar o mouse
 * levanta o caderno e mostra o nome, clicar abre a matéria. Matéria nova
 * chega voando da câmera até a órbita, com uma onda saindo do núcleo.
 *
 * Mesmo contrato do palco (src/cena3d/palco.ts): DPR com teto, laço parado
 * fora da tela, nada de setState por quadro e tudo descartado ao desmontar.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { criarAmbienteEstudio } from "../cena3d/estudio";
import { corDoToken, criarPalco, mola, type Palco } from "../cena3d/palco";
import { aoCutucar } from "../pets/bus";
import { criarMine3D } from "../cena3d/mine3d";
import { criarMaterialAnel, criarPoeira, texturaDaPagina, texturaDeBorda, texturaRadial } from "./sistema3d-pecas";

/** Bilhete colado no caderno: prazo ou pendência da matéria. */
export type AvisoCaderno = { texto: string; tom: "amarelo" | "rosa" };
export type MateriaOrbita = { id: string; name: string; color: string; aviso?: AvisoCaderno };

type Caderno = {
  id: string;
  grupo: THREE.Group;
  /** Caixa invisível do raycast (a capa abre e o caderno muda de forma). */
  alvo: THREE.Mesh;
  /** Pivô da capa da frente, na lombada: gira para abrir. */
  tampa: THREE.Group;
  abre: { v: number; vel: number };
  fita: THREE.Mesh;
  sombra: THREE.Mesh;
  /** Entrou na abertura da cena: não pula a Mine nem solta onda. */
  silencioso: boolean;
  raio: number;
  angulo: number;
  velocidade: number;
  fase: number;
  levanta: { v: number; vel: number };
  /** <0 = esperando a cena de matéria nova sair, 0..1 = caindo na órbita, 1 = em órbita. */
  chegada: number;
  nome: string;
  /** Bilhete acima do caderno (some quando a matéria fica em dia). */
  postit: THREE.Sprite | null;
  avisoChave: string;
  cor: THREE.Color;
};

/** Post-it desenhado num canvas, com a letra à mão do caderno. */
function texturaDoPostit(aviso: AvisoCaderno) {
  // bilhete largo (5:3), com fita no alto e o prazo numa linha só, grande
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 192;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(14, 30, 300, 154);
  ctx.fillStyle = aviso.tom === "rosa" ? "#ffb3c1" : "#f4f05a";
  ctx.fillRect(8, 24, 300, 154);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(118, 8, 84, 34);
  ctx.fillStyle = "#1d2440";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let tamanho = 72;
  ctx.font = `400 ${tamanho}px "Gochi Hand", "Patrick Hand", "Comic Sans MS", cursive`;
  while (ctx.measureText(aviso.texto).width > 270 && tamanho > 40) {
    tamanho -= 4;
    ctx.font = `400 ${tamanho}px "Gochi Hand", "Patrick Hand", "Comic Sans MS", cursive`;
  }
  ctx.fillText(aviso.texto, 158, 106);
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  return textura;
}

const raios = [2.35, 3.25, 4.15];
/** Cadernos 1,5× maiores: com o tamanho antigo eles sumiam no palco largo. */
const ESCALA_CADERNO = 1.5;
/** O caderno escolhido vai ~45° à direita da frente, para não tampar a Mine. */
const DESVIO_FRENTE = 0.78;
const tamanhoCapa = new THREE.Vector3(0.62, 0.84, 0.14);
const ESP_CAPA = 0.028;
const ESP_MIOLO = 0.084;
/** Chão invisível onde caem as sombras de contato (abaixo do plano das órbitas). */
const PISO = -1.05;
const MENTA = 0x39f59a;

/** Capa desenhada num canvas: cor da matéria, costura, etiqueta e a inicial. */
function desenharCapa(canvas: HTMLCanvasElement, nome: string, cor: string) {
  const L = 256;
  const A = 344;
  canvas.width = L;
  canvas.height = A;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = cor;
  ctx.fillRect(0, 0, L, A);
  // luz de cima para baixo, bem leve (papel cartão plastificado)
  const luz = ctx.createLinearGradient(0, 0, L, A);
  luz.addColorStop(0, "rgba(255,255,255,0.22)");
  luz.addColorStop(0.55, "rgba(255,255,255,0)");
  luz.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = luz;
  ctx.fillRect(0, 0, L, A);
  // grão do papel cartão
  for (let i = 0; i < 900; i += 1) {
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
    ctx.fillRect(Math.random() * L, Math.random() * A, 1.5, 1.5);
  }
  // faixa da lombada, onde passa a espiral
  ctx.fillStyle = "rgba(0,0,0,0.14)";
  ctx.fillRect(0, 0, 26, A);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(26, 0, 2, A);
  // costura tracejada contornando a capa
  ctx.setLineDash([7, 6]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.strokeRect(40, 14, L - 54, A - 28);
  ctx.setLineDash([]);
  // etiqueta branca com a inicial grande e o nome à mão
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.roundRect(58, 102, 170, 118, 14);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "rgba(52,70,201,0.25)";
  for (let y = 176; y < 214; y += 14) ctx.fillRect(70, y, 146, 1.5);
  ctx.fillStyle = "#1d2440";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 62px system-ui, sans-serif";
  ctx.fillText((nome.trim()[0] || "?").toUpperCase(), 143, 146);
  let tamanho = 26;
  const fonte = (t: number) => `700 ${t}px "Kalam", "Gochi Hand", "Comic Sans MS", cursive`;
  ctx.font = fonte(tamanho);
  while (ctx.measureText(nome).width > 150 && tamanho > 15) {
    tamanho -= 1;
    ctx.font = fonte(tamanho);
  }
  const curto = ctx.measureText(nome).width > 150 ? `${nome.slice(0, 14)}…` : nome;
  ctx.fillText(curto, 143, 196);
}

function texturaDaCapa(nome: string, cor: string) {
  const canvas = document.createElement("canvas");
  desenharCapa(canvas, nome, cor);
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 8;
  // a letra à mão pode chegar depois do primeiro desenho
  document.fonts?.ready.then(() => {
    desenharCapa(canvas, nome, cor);
    textura.needsUpdate = true;
  });
  return textura;
}

export default function Sistema3D({
  materias,
  selecionada = null,
  onAbrir,
  onSelecionar,
  onCriar,
  onNucleo,
}: {
  materias: MateriaOrbita[];
  /** Caderno em destaque: fica levantado, parado e é trazido para a frente. */
  selecionada?: string | null;
  onAbrir: (id: string) => void;
  /** Sem este callback, clicar abre a matéria direto (comportamento antigo). */
  onSelecionar?: (id: string) => void;
  onCriar: () => void;
  onNucleo: () => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const palcoRef = useRef<Palco | null>(null);
  const apiRef = useRef<{ sincronizar: (lista: MateriaOrbita[]) => void; selecionar: (id: string | null) => void } | null>(null);
  const callbacks = useRef({ onAbrir, onSelecionar, onCriar, onNucleo });
  callbacks.current = { onAbrir, onSelecionar, onCriar, onNucleo };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const cadernos = new Map<string, Caderno>();
    const fantasmas: THREE.Group[] = [];
    let hover: string | null = null;
    let escolhido: string | null = null;
    let nucleoHover = false;
    const giro = { alvo: 0.35, v: 0.35, vel: 0 };
    const arrasto = { ativo: false, x: 0, ultimoX: 0, moveu: 0, inercia: 0 };
    const ondas: Array<{ malha: THREE.Mesh; t: number }> = [];
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const projetado = new THREE.Vector3();
    const olhar = new THREE.Vector3();
    const pontoCaderno = new THREE.Vector3();

    // abertura da cena: câmera desce em dolly, anéis se desenham, a Mine
    // aparece com mola e os cadernos saem dela um a um
    let intro = 0;
    const escalaMine = { v: 0, vel: 0 };

    const tick = (tempo: number, delta: number) => {
      const p = palcoRef.current!;
      intro = THREE.MathUtils.clamp(intro + delta / 2.4, 0, 1);
      const ei = 1 - Math.pow(1 - intro, 4);
      // inércia do arrasto, depois volta ao giro lento de sempre
      if (!arrasto.ativo) {
        giro.alvo += arrasto.inercia;
        arrasto.inercia *= 0.94;
        // com um caderno em destaque o sistema para de girar sozinho
        if (!escolhido) giro.alvo += delta * 0.06;
      }
      sistema.rotation.y = mola(giro, giro.alvo, delta, 90, 16) - (1 - ei) * 1.5;
      // afasta a câmera em palco estreito para a órbita de fora caber inteira
      const meiaLargura = Math.tan(THREE.MathUtils.degToRad(p.camera.fov / 2)) * p.camera.aspect;
      // 8.8 de perto: na Estante em órbita a área é larga e os cadernos sumiam a 11
      p.camera.position.z = Math.max(8.2, 5.2 / meiaLargura) + (1 - ei) * 4.5;
      // parallax suave da câmera pelo ponteiro + respiração bem lenta
      p.camera.position.x = p.pointer.x * 0.9 + Math.sin(tempo * 0.23) * 0.12;
      // câmera mais alta: a órbita vira uma elipse mais aberta e enche o palco
      p.camera.position.y = 4.1 + p.pointer.y * 0.6 + Math.sin(tempo * 0.31) * 0.08 + (1 - ei) * 3;
      p.camera.lookAt(0, -0.35, 0);

      aneis.forEach((anel, i) => {
        const u = anel.material.uniforms;
        u.uProgresso.value = THREE.MathUtils.clamp((intro - 0.05 - i * 0.1) / 0.55, 0, 1) * 1.0001;
      });
      poeiraMat.uniforms.uTempo.value = tempo;
      poeiraMat.uniforms.uOpacidade.value = (escuro ? 0.85 : 0.6) * THREE.MathUtils.smoothstep(intro, 0.15, 0.8);
      poca.material.opacity = (escuro ? 0.5 : 0.75) * ei;
      // nunca 0: matriz singular faz o worldToLocal dos olhos devolver NaN
      mine.grupo.scale.setScalar(1.25 * Math.max(0.002, mola(escalaMine, intro > 0.12 ? 1 : 0, delta, 160, 11)));
      // o plano do chão está deitado: escala em x/z (y é a normal)
      sombraMine.scale.set(2.6 - Math.sin(tempo * 1.2) * 0.12, 1, 1.7 - Math.sin(tempo * 1.2) * 0.08);
      sombraMine.material.opacity = (escuro ? 0.18 : 0.3) * Math.min(1, escalaMine.v);

      // a Mine olha para a câmera, puxada pelo ponteiro; com um caderno em
      // hover (ou escolhido) ela vira a cabeça para ele, sem perder o rosto
      const foco = hover ?? escolhido;
      olhar.set(p.camera.position.x + p.pointer.x * 4.5, p.camera.position.y * 0.55 + p.pointer.y * 3, p.camera.position.z);
      if (foco && cadernos.has(foco)) {
        cadernos.get(foco)!.grupo.getWorldPosition(pontoCaderno);
        olhar.lerp(pontoCaderno.multiplyScalar(2.2), 0.55);
      }
      mine.atualizar(tempo, delta, olhar, { hover: nucleoHover });
      poeira.rotation.y = tempo * 0.012;
      for (const ponto of satelites) {
        const a = tempo * ponto.vel + ponto.fase;
        ponto.malha.position.set(Math.cos(a) * ponto.raio, 0, Math.sin(a) * ponto.raio);
        ponto.malha.visible = intro > 0.7;
        ponto.anel.uniforms.uCabeca.value = THREE.MathUtils.euclideanModulo(a / (Math.PI * 2), 1);
      }

      for (const caderno of cadernos.values()) {
        const parado = hover === caderno.id || escolhido === caderno.id;
        const eleito = escolhido === caderno.id;
        // com um caderno escolhido, os outros recuam um pouco e os bilhetes
        // deles passam a respeitar a profundidade (não cobrem mais o escolhido)
        const coadjuvante = Boolean(escolhido) && !eleito;
        if (caderno.postit) {
          const m = caderno.postit.material;
          m.rotation = 0.06 + Math.sin(tempo * 1.7 + caderno.fase) * 0.05;
          m.depthTest = coadjuvante;
          m.opacity = coadjuvante ? 0.82 : 1;
          caderno.postit.renderOrder = eleito ? 4 : 2;
          caderno.postit.scale.set(coadjuvante ? 0.78 : 0.95, coadjuvante ? 0.47 : 0.57, 1);
        }
        if (!parado) caderno.angulo += delta * caderno.velocidade;
        const antes = caderno.chegada;
        caderno.chegada = Math.min(1, caderno.chegada + delta * (caderno.silencioso ? 1.05 : 0.85));
        // esperando a cena de matéria nova sair da frente: ainda não existe
        caderno.grupo.visible = caderno.chegada > 0;
        caderno.sombra.visible = caderno.chegada > 0;
        if (!caderno.silencioso) {
          if (antes < 1 && caderno.chegada >= 1) mine.pular(0.7);
          if (antes <= 0 && caderno.chegada > 0) soltarOnda(caderno.cor);
        } else if (antes < 1 && caderno.chegada >= 1) caderno.silencioso = false;
        const k = Math.max(0, caderno.chegada);
        // sai de cima da Mine num arco e assenta na órbita com mola (overshoot)
        const e = k >= 1 ? 1 : 1 - Math.pow(2, -9 * k) * Math.cos(k * 7.5);
        const arco = Math.sin(Math.min(1, k) * Math.PI) * 1.6;
        const ox = Math.cos(caderno.angulo) * caderno.raio;
        const oz = Math.sin(caderno.angulo) * caderno.raio;
        const oy = Math.sin(tempo * 1.1 + caderno.fase) * 0.12;
        const lev = mola(caderno.levanta, parado ? 1 : 0, delta, 220, 20);
        caderno.grupo.position.set(ox * e, oy * e + (1 - e) * 1.6 + arco + lev * 0.85, oz * e);
        // levantado, o caderno vira a capa para a câmera (rotação no mundo ≈ 0,
        // com um leve giro para o centro, já que ele fica à direita): o giro vai
        // pelo caminho mais curto, sem dar voltas
        const base = -caderno.angulo + Math.PI / 2 + (1 - Math.min(1, k)) * Math.PI * 2;
        const deFrente = -sistema.rotation.y - 0.32;
        const falta = THREE.MathUtils.euclideanModulo(deFrente - base + Math.PI, Math.PI * 2) - Math.PI;
        caderno.grupo.rotation.y = base + falta * lev;
        caderno.grupo.rotation.z = Math.sin(tempo * 0.9 + caderno.fase) * 0.08 * (1 - lev) + (1 - Math.min(1, k)) * 0.5;
        caderno.grupo.rotation.x = -0.18 * lev;
        const tamanho = eleito ? 1 + lev * 0.45 : coadjuvante ? 0.85 + lev * 0.3 : 1 + lev * 0.3;
        const escala = ESCALA_CADERNO * tamanho * Math.min(1, k * 2.2);
        caderno.grupo.scale.setScalar(escala);
        // a capa abre um pouco no hover e mais no escolhido (aparece a página pautada)
        const abre = mola(caderno.abre, eleito ? 0.95 : hover === caderno.id ? 0.5 : 0, delta, 140, 13);
        caderno.tampa.rotation.y = -Math.max(0, abre);
        // fitinha de marcador balança com o caderno
        caderno.fita.rotation.x = Math.sin(tempo * 2.1 + caderno.fase) * 0.22 + caderno.levanta.vel * 0.04;
        caderno.fita.rotation.z = Math.sin(tempo * 1.4 + caderno.fase) * 0.12;
        // sombra de contato no chão: cresce e clareia quando o caderno sobe
        const altura = caderno.grupo.position.y - PISO;
        const s = caderno.sombra;
        s.position.set(caderno.grupo.position.x, PISO, caderno.grupo.position.z);
        const largura = escala * (0.75 + altura * 0.18);
        s.scale.set(largura, 1, largura * 0.5);
        s.rotation.y = caderno.grupo.rotation.y;
        const sm = s.material as THREE.MeshBasicMaterial;
        sm.opacity = (escuro ? 0.32 : 0.34) * Math.min(1, k * 1.5) * (1 - lev * 0.35) * (eleito ? 1.5 : 1) * (coadjuvante ? 0.7 : 1);
        // no escuro sombra preta some no fundo: vira um reflexo da cor da capa
        sm.color.copy(eleito || escuro ? caderno.cor : corSombra);
      }
      fantasmas.forEach((fantasma, indice) => {
        const angulo = tempo * 0.18 + (indice * Math.PI * 2) / 3;
        fantasma.position.set(Math.cos(angulo) * raios[1], Math.sin(tempo + indice) * 0.15, Math.sin(angulo) * raios[1]);
        fantasma.rotation.y = -angulo + Math.PI / 2;
      });

      for (let i = ondas.length - 1; i >= 0; i -= 1) {
        const onda = ondas[i];
        onda.t += delta;
        const k = onda.t / 1.6;
        onda.malha.scale.setScalar(0.4 + k * 5.2);
        (onda.malha.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 * (1 - k));
        if (k >= 1) {
          sistema.remove(onda.malha);
          (onda.malha.material as THREE.Material).dispose();
          ondas.splice(i, 1);
        }
      }

      // hover: raio do ponteiro contra as capas e o núcleo
      const tip = tipRef.current;
      if (p.pointer.dentro && !arrasto.ativo) {
        ndc.set(p.pointer.alvoX, p.pointer.alvoY);
        raycaster.setFromCamera(ndc, p.camera);
        const alvos = [...[...cadernos.values()].map((c) => c.alvo), ...fantasmas.map((g) => g.children[0]), mine.alvo];
        const toque = raycaster.intersectObjects(alvos, false)[0];
        const id = (toque?.object.userData.id as string | undefined) ?? null;
        nucleoHover = toque?.object === mine.alvo;
        hover = id && cadernos.has(id) ? id : null;
        host.style.cursor = toque ? "pointer" : "grab";
        if (tip) {
          const nome = hover ? cadernos.get(hover)!.nome : nucleoHover ? "Conversar com a Mine" : id === "fantasma" ? "Criar matéria" : "";
          if (tip.textContent !== nome) tip.textContent = nome;
          tip.classList.toggle("is-on", Boolean(nome));
          if (nome && toque) {
            // na Mine a etiqueta sobe acima da antena (no ponto do toque ela tampava os olhos)
            if (nucleoHover) projetado.set(0, mine.grupo.position.y + 2.05, 0).project(p.camera);
            else projetado.copy(toque.point).project(p.camera);
            tip.style.transform = `translate(${((projetado.x + 1) / 2) * host.clientWidth}px, ${((1 - projetado.y) / 2) * host.clientHeight - 18}px) translate(-50%, -100%)`;
          }
        }
      } else if (!arrasto.ativo) {
        hover = null;
        nucleoHover = false;
        tip?.classList.remove("is-on");
      }
    };

    const palco = criarPalco(host, tick, { fov: 36, z: 11 });
    palcoRef.current = palco;
    const { scene, guardar, renderer } = palco;
    const tinta = corDoToken("--pen", "#3446c9");
    const texto = corDoToken("--theme-text", "#1d2440");
    const menta = new THREE.Color(MENTA);
    // tema escuro = texto claro (a cena remonta a cada troca de tema)
    const escuro = texto.getHSL({ h: 0, s: 0, l: 0 }).l > 0.5;
    const corSombra = new THREE.Color(0x1d2440);

    // Neutral no lugar do ACES: as capas mantêm a cor da matéria sem precisar
    // de luz própria (que achatava o volume dos cadernos)
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    // reflexo de estúdio HDR procedural: dá brilho real à espiral metálica e à capa plastificada
    scene.environment = guardar(
      criarAmbienteEstudio(renderer, { acento: MENTA, modo: escuro ? "escuro" : "claro", sigma: 0.022 }),
    );
    scene.environmentIntensity = escuro ? 0.78 : 0.88;

    scene.add(new THREE.HemisphereLight(0xffffff, escuro ? 0x2a3050 : 0xb9bfd6, escuro ? 0.9 : 1.1));
    const sol = new THREE.DirectionalLight(0xfff6e8, 2.1);
    sol.position.set(4, 7, 6);
    scene.add(sol);
    // luz de recorte por trás, em menta: separa o contorno dos cadernos do fundo
    const recorte = new THREE.DirectionalLight(MENTA, escuro ? 1.6 : 0.9);
    recorte.position.set(-5, 3, -6);
    scene.add(recorte);
    const quente = new THREE.PointLight(0xffd89a, 6, 9, 1.6);
    scene.add(quente);

    const sistema = new THREE.Group();
    sistema.rotation.x = 0.12;
    scene.add(sistema);

    // núcleo: a Mine em 3D (cel-shading com contorno de caneta), sempre
    // virando a cabeça para quem está olhando. Fica fora do grupo que gira.
    const mine = criarMine3D(guardar, { escuro });
    mine.grupo.position.y = 0.35;
    mine.grupo.scale.setScalar(0.0001);
    scene.add(mine.grupo);

    // chão: poça de luz menta embaixo do sistema + sombras de contato macias
    const texRadial = guardar(texturaRadial(1, 0.4));
    const texPoca = guardar(texturaRadial(0.5, 0.18));
    const geoChao = guardar(new THREE.PlaneGeometry(1, 1));
    geoChao.rotateX(-Math.PI / 2);
    const poca = new THREE.Mesh(geoChao, guardar(new THREE.MeshBasicMaterial({ map: texPoca, color: escuro ? menta : tinta.clone().lerp(menta, 0.55), transparent: true, opacity: 0, depthWrite: false })));
    poca.scale.set(11, 1, 8.5);
    poca.position.y = PISO - 0.01;
    poca.renderOrder = -2;
    sistema.add(poca);
    const sombraMine = new THREE.Mesh(geoChao, guardar(new THREE.MeshBasicMaterial({ map: texRadial, color: escuro ? menta : corSombra, transparent: true, opacity: 0, depthWrite: false })));
    sombraMine.position.y = PISO;
    sombraMine.renderOrder = -1;
    sistema.add(sombraMine);

    // órbitas: as linhas da pauta do caderno viraram anéis de tinta que se
    // desenham na abertura, com um pingo de caneta deixando rastro de cometa
    const materialPingo = guardar(new THREE.MeshBasicMaterial({ color: tinta }));
    const geoPingo = guardar(new THREE.SphereGeometry(0.06, 14, 10));
    const satelites: Array<{ malha: THREE.Mesh; raio: number; vel: number; fase: number; anel: THREE.ShaderMaterial }> = [];
    const aneis: THREE.Mesh<THREE.TorusGeometry, THREE.ShaderMaterial>[] = [];
    raios.forEach((raio, i) => {
      const vel = (i % 2 ? -0.5 : 0.4) / raio;
      const material = guardar(
        criarMaterialAnel({
          cor: tinta,
          cabeca: i === 1 ? menta : tinta,
          opacidade: escuro ? 0.42 : i === 1 ? 0.34 : 0.26,
          raio,
          sentido: Math.sign(vel),
          traco: i === 2 ? 110 : 0,
        }),
      );
      const anel = new THREE.Mesh(guardar(new THREE.TorusGeometry(raio, i === 1 ? 0.018 : 0.012, 6, 220)), material);
      anel.rotation.x = Math.PI / 2;
      sistema.add(anel);
      aneis.push(anel);
      const pingo = new THREE.Mesh(geoPingo, i === 1 ? guardar(new THREE.MeshBasicMaterial({ color: MENTA })) : materialPingo);
      sistema.add(pingo);
      satelites.push({ malha: pingo, raio, vel, fase: i * 2.1, anel: material });
    });

    // poeira de estrelas em volta: pontos redondos que cintilam (um draw call)
    const { pontos: poeira, geo: geoPoeira, material: poeiraMat } = criarPoeira(260, tinta, menta, renderer.getPixelRatio());
    guardar(geoPoeira);
    guardar(poeiraMat);
    scene.add(poeira);

    // caderno de espiral: capa de trás, bloco de folhas, capa da frente num
    // pivô na lombada (abre), espiral de arame e fitinha de marcador.
    // Geometrias e materiais neutros são um só para todos os cadernos.
    const W = tamanhoCapa.x;
    const H = tamanhoCapa.y;
    const geoCapa = guardar(new THREE.BoxGeometry(W, H, tamanhoCapa.z));
    const geoFolha = guardar(new RoundedBoxGeometry(W, H, ESP_CAPA, 2, 0.012));
    const geoMiolo = guardar(new THREE.BoxGeometry(W * 0.95, H * 0.95, ESP_MIOLO));
    const papel = guardar(new THREE.MeshStandardMaterial({ color: 0xfbfaf4, roughness: 0.92 }));
    const borda = (deitada: boolean) => guardar(new THREE.MeshStandardMaterial({ map: guardar(texturaDeBorda(deitada)), roughness: 0.95 }));
    const bordaPe = borda(false);
    const bordaDeitada = borda(true);
    const pagina = guardar(new THREE.MeshStandardMaterial({ map: guardar(texturaDaPagina()), roughness: 0.9 }));
    // faces do BoxGeometry: +x, -x, +y, -y, +z, -z
    const materiaisMiolo = [bordaPe, papel, bordaDeitada, bordaDeitada, pagina, papel];
    const geoEspiral = guardar(
      mergeGeometries(
        Array.from({ length: 9 }, (_, i) => {
          const argola = new THREE.TorusGeometry(0.078, 0.011, 6, 18);
          argola.rotateX(Math.PI / 2);
          argola.translate(-W / 2 + 0.035, H * (0.42 - (0.84 * i) / 8), 0);
          return argola;
        }),
      )!,
    );
    const materialEspiral = guardar(new THREE.MeshStandardMaterial({ color: escuro ? 0xc9d1e0 : 0xaab2c4, metalness: 0.85, roughness: 0.28 }));
    // fitinha curta com ponta em V (comprida e menta ela parecia uma perna do caderno)
    const geoFita = guardar(new THREE.BufferGeometry());
    geoFita.setAttribute("position", new THREE.Float32BufferAttribute([-0.02, 0, 0, 0.02, 0, 0, 0.02, -0.15, 0, 0, -0.12, 0, -0.02, -0.15, 0], 3));
    geoFita.setIndex([0, 4, 3, 0, 3, 1, 1, 3, 2]);
    geoFita.computeVertexNormals();
    const geoAlvo = guardar(new THREE.BoxGeometry(W * 1.12, H * 1.1, 0.34));
    const materialAlvo = guardar(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
    const geoOnda = guardar(new THREE.RingGeometry(0.96, 1, 64));
    const soltarOnda = (cor: THREE.ColorRepresentation) => {
      if (ondas.length >= 4) return;
      const onda = new THREE.Mesh(geoOnda, new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
      onda.rotation.x = Math.PI / 2;
      sistema.add(onda);
      ondas.push({ malha: onda, t: 0 });
    };

    // bilhete acima do caderno, sempre de frente para a câmera (um sprite):
    // preso na capa ele virava de lado com a órbita e ninguém lia o prazo
    const colarAviso = (caderno: Caderno, aviso: AvisoCaderno | undefined) => {
      const chave = aviso ? `${aviso.tom}:${aviso.texto}` : "";
      if (chave === caderno.avisoChave) return;
      caderno.avisoChave = chave;
      if (caderno.postit) {
        caderno.grupo.remove(caderno.postit);
        const antigo = caderno.postit.material;
        antigo.map?.dispose();
        antigo.dispose();
        caderno.postit = null;
      }
      if (!aviso) return;
      const postit = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaDoPostit(aviso), transparent: true, depthTest: false }));
      postit.position.set(0, tamanhoCapa.y / 2 + 0.36, 0);
      postit.scale.set(0.95, 0.57, 1);
      postit.renderOrder = 2;
      caderno.grupo.add(postit);
      caderno.postit = postit;
    };

    /** `modo`: "parado" já em órbita, "abertura" sai da Mine na entrada da cena, "novo" espera a cena de matéria nova. */
    const adicionar = (materia: MateriaOrbita, indice: number, modo: "abertura" | "novo") => {
      const cor = new THREE.Color(materia.color);
      const textura = guardar(texturaDaCapa(materia.name, materia.color));
      // só um fio de luz própria: o Neutral já segura a cor e o volume volta
      const lateral = guardar(new THREE.MeshStandardMaterial({ color: cor, roughness: 0.6, emissive: cor, emissiveIntensity: 0.06 }));
      // capa plastificada: verniz por cima do papel cartão
      const frente = guardar(new THREE.MeshPhysicalMaterial({ map: textura, roughness: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.3, emissive: 0xffffff, emissiveMap: textura, emissiveIntensity: 0.05 }));
      const grupo = new THREE.Group();
      const zCapa = ESP_MIOLO / 2 + ESP_CAPA / 2;
      const tras = new THREE.Mesh(geoFolha, lateral);
      tras.position.z = -zCapa;
      const miolo = new THREE.Mesh(geoMiolo, materiaisMiolo);
      miolo.position.x = -W * 0.025;
      const tampa = new THREE.Group();
      tampa.position.set(-W / 2 + 0.035, 0, zCapa);
      const capa = new THREE.Mesh(geoFolha, [lateral, lateral, lateral, lateral, frente, lateral]);
      capa.position.x = W / 2 - 0.035;
      tampa.add(capa);
      const espiral = new THREE.Mesh(geoEspiral, materialEspiral);
      // fita um tom acima da capa, como cetim da mesma cor
      const fita = new THREE.Mesh(geoFita, guardar(new THREE.MeshStandardMaterial({ color: cor.clone().offsetHSL(0, 0.05, -0.12), roughness: 0.4, side: THREE.DoubleSide })));
      fita.position.set(W * 0.2, -H * 0.46, 0);
      const alvo = new THREE.Mesh(geoAlvo, materialAlvo);
      alvo.userData.id = materia.id;
      grupo.add(tras, miolo, tampa, espiral, fita, alvo);
      grupo.visible = false;
      sistema.add(grupo);
      const sombra = new THREE.Mesh(geoChao, guardar(new THREE.MeshBasicMaterial({ map: texRadial, color: corSombra, transparent: true, opacity: 0, depthWrite: false })));
      sombra.visible = false;
      sombra.renderOrder = -1;
      sistema.add(sombra);
      const raio = raios[indice % raios.length];
      cadernos.set(materia.id, {
        id: materia.id,
        grupo,
        alvo,
        tampa,
        abre: { v: 0, vel: 0 },
        fita,
        sombra,
        silencioso: modo === "abertura",
        raio,
        angulo: (indice * 2.399) % (Math.PI * 2),
        velocidade: 0.32 / raio,
        fase: indice * 1.7,
        levanta: { v: 0, vel: 0 },
        // abertura: um a um, saindo da Mine; matéria nova: depois da cena (≈2,6 s) voar para cá
        chegada: modo === "abertura" ? -(0.38 + indice * 0.085) : -2.6,
        nome: materia.name,
        postit: null,
        avisoChave: "",
        cor,
      });
      colarAviso(cadernos.get(materia.id)!, materia.aviso);
    };

    const materialFantasma = guardar(new THREE.MeshBasicMaterial({ color: tinta, transparent: true, opacity: 0.07, depthWrite: false }));
    const geoTracoFantasma = guardar(new THREE.EdgesGeometry(geoCapa));
    const materialTraco = guardar(new THREE.LineDashedMaterial({ color: tinta, dashSize: 0.06, gapSize: 0.04, transparent: true, opacity: 0.75 }));
    const materialMais = guardar(
      new THREE.SpriteMaterial({
        map: guardar(
          (() => {
            const c = document.createElement("canvas");
            c.width = c.height = 96;
            const g = c.getContext("2d")!;
            g.strokeStyle = `#${tinta.getHexString()}`;
            g.lineWidth = 9;
            g.lineCap = "round";
            g.beginPath();
            g.moveTo(48, 20);
            g.lineTo(47, 76);
            g.moveTo(20, 49);
            g.lineTo(76, 47);
            g.stroke();
            const t = new THREE.CanvasTexture(c);
            t.colorSpace = THREE.SRGBColorSpace;
            return t;
          })(),
        ),
        transparent: true,
        depthWrite: false,
      }),
    );

    // a primeira leva desta cena entra parada; o que aparecer depois chega voando
    let jaSincronizou = false;
    const sincronizar = (lista: MateriaOrbita[]) => {
      const anima = jaSincronizou;
      jaSincronizou = true;
      const ids = new Set(lista.map((item) => item.id));
      for (const [id, caderno] of cadernos) {
        if (!ids.has(id)) {
          colarAviso(caderno, undefined);
          sistema.remove(caderno.grupo, caderno.sombra);
          cadernos.delete(id);
        }
      }
      lista.forEach((materia, indice) => {
        const existente = cadernos.get(materia.id);
        if (existente) {
          existente.nome = materia.name;
          colarAviso(existente, materia.aviso);
        } else adicionar(materia, indice, anima ? "novo" : "abertura");
      });
      if (escolhido) selecionar(escolhido);
      // sem matéria: três cadernos rascunhados a lápis (contorno tracejado,
      // miolo de papel quase transparente e um "+") chamando para criar
      fantasmas.forEach((g) => sistema.remove(g));
      fantasmas.length = 0;
      if (!lista.length) {
        for (let i = 0; i < 3; i += 1) {
          const g = new THREE.Group();
          const m = new THREE.Mesh(geoCapa, materialFantasma);
          m.userData.id = "fantasma";
          const traco = new THREE.LineSegments(geoTracoFantasma, materialTraco);
          traco.computeLineDistances();
          const mais = new THREE.Sprite(materialMais);
          mais.scale.setScalar(0.42);
          mais.position.z = tamanhoCapa.z;
          g.add(m, traco, mais);
          g.scale.setScalar(ESCALA_CADERNO);
          sistema.add(g);
          fantasmas.push(g);
        }
      }
    };
    /**
     * Traz o caderno para a frente da câmera. Com o grupo girado em θ no eixo
     * y, um ponto no ângulo a da órbita fica na frente (+z) quando θ = a − π/2;
     * entre as voltas equivalentes, fica a mais próxima do giro atual.
     */
    const selecionar = (id: string | null) => {
      escolhido = id;
      const caderno = id ? cadernos.get(id) : undefined;
      if (!caderno) return;
      // a − θ = π/2 − desvio: fica na frente, mas deslocado para a direita
      const alvo = caderno.angulo - Math.PI / 2 + DESVIO_FRENTE;
      const voltas = Math.round((giro.alvo - alvo) / (Math.PI * 2));
      giro.alvo = alvo + voltas * Math.PI * 2;
      arrasto.inercia = 0;
    };
    apiRef.current = { sincronizar, selecionar };
    const onDown = (event: PointerEvent) => {
      arrasto.ativo = true;
      arrasto.x = arrasto.ultimoX = event.clientX;
      arrasto.moveu = 0;
      arrasto.inercia = 0;
      host.setPointerCapture(event.pointerId);
      host.style.cursor = "grabbing";
    };
    const onMove = (event: PointerEvent) => {
      if (!arrasto.ativo) return;
      const dx = event.clientX - arrasto.ultimoX;
      arrasto.ultimoX = event.clientX;
      arrasto.moveu += Math.abs(dx);
      giro.alvo += dx * 0.008;
      arrasto.inercia = dx * 0.0016;
    };
    const onUp = (event: PointerEvent) => {
      if (!arrasto.ativo) return;
      arrasto.ativo = false;
      host.releasePointerCapture?.(event.pointerId);
      if (arrasto.moveu > 6) return;
      // clique sem arrasto: o que estava sob o ponteiro
      const p = palcoRef.current!;
      ndc.set(p.pointer.alvoX, p.pointer.alvoY);
      raycaster.setFromCamera(ndc, p.camera);
      const toque = raycaster.intersectObjects([...[...cadernos.values()].map((c) => c.alvo), ...fantasmas.map((g) => g.children[0]), mine.alvo], false)[0];
      const id = toque?.object.userData.id as string | undefined;
      if (!id) return;
      if (id === "nucleo") {
        mine.pular(1);
        callbacks.current.onNucleo();
      }
      else if (id === "fantasma") callbacks.current.onCriar();
      // com seleção: o primeiro toque escolhe o caderno, o segundo abre
      else if (callbacks.current.onSelecionar && escolhido !== id) callbacks.current.onSelecionar(id);
      else callbacks.current.onAbrir(id);
    };
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerup", onUp);
    host.addEventListener("pointercancel", onUp);
    requestAnimationFrame(() => host.classList.add("is-ready"));

    // a Mine (pets) chutou ou pulou perto: o sistema gira para longe dela e solta uma onda
    const pararMine = aoCutucar((c) => {
      const r = host.getBoundingClientRect();
      if (c.x < r.left - 80 || c.x > r.right + 80 || c.y < r.top - 120 || c.y > r.bottom + 120 || arrasto.ativo) return;
      const lado = Math.sign(c.x - (r.left + r.width / 2)) || 1;
      arrasto.inercia += -lado * 0.045 * c.forca;
      mine.assustar();
      soltarOnda(0x39f59a);
    });

    return () => {
      pararMine();
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
      ondas.forEach((onda) => (onda.malha.material as THREE.Material).dispose());
      // as texturas dos post-its não passam pelo `guardar` (trocam a cada aviso)
      cadernos.forEach((caderno) => colarAviso(caderno, undefined));
      apiRef.current = null;
      palcoRef.current = null;
      palco.destruir();
    };
  }, []);

  const chave = materias.map((item) => `${item.id}:${item.name}:${item.aviso?.tom || ""}:${item.aviso?.texto || ""}`).join("|");
  useEffect(() => {
    apiRef.current?.sincronizar(materias);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  useEffect(() => {
    apiRef.current?.selecionar(selecionada);
  }, [selecionada]);

  return (
    <div ref={hostRef} className="home-sistema-canvas" style={{ touchAction: "pan-y" }}>
      <div ref={tipRef} className="home-sistema-tip" aria-hidden />
    </div>
  );
}
