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
import { corDoToken, criarPalco, mola, type Palco } from "../cena3d/palco";
import { aoCutucar } from "../pets/bus";

/** Bilhete colado no caderno: prazo ou pendência da matéria. */
export type AvisoCaderno = { texto: string; tom: "amarelo" | "rosa" };
export type MateriaOrbita = { id: string; name: string; color: string; aviso?: AvisoCaderno };

type Caderno = {
  id: string;
  grupo: THREE.Group;
  capa: THREE.Mesh;
  raio: number;
  angulo: number;
  velocidade: number;
  fase: number;
  levanta: { v: number; vel: number };
  /** 0 = chegando da câmera, 1 = em órbita. */
  chegada: number;
  nome: string;
  /** Bilhete acima do caderno (some quando a matéria fica em dia). */
  postit: THREE.Sprite | null;
  avisoChave: string;
};

/** O rosto da Mine (o mesmo SVG do MineFace, viewBox 120) desenhado num canvas. */
function texturaDaMine() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(256 / 120, 256 / 120);
  ctx.lineWidth = 3.4;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#1d2440";
  const caixa = (x: number, y: number, w: number, h: number, r: number, cor: string) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = cor;
    ctx.fill();
    ctx.stroke();
  };
  ctx.beginPath();
  ctx.moveTo(60, 14);
  ctx.lineTo(60, 30);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(60, 11, 7, 0, Math.PI * 2);
  ctx.fillStyle = "#39f59a";
  ctx.fill();
  ctx.stroke();
  caixa(10, 54, 14, 30, 6, "#39f59a");
  caixa(96, 54, 14, 30, 6, "#39f59a");
  caixa(20, 30, 80, 80, 26, "#ffffff");
  caixa(31, 46, 58, 42, 16, "#e8ecf4");
  ctx.fillStyle = "#1d2440";
  for (const cx of [47, 73]) {
    ctx.beginPath();
    ctx.ellipse(cx, 64, 5, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(52, 77);
  ctx.quadraticCurveTo(60, 84, 68, 77);
  ctx.stroke();
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  return textura;
}

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
/** O caderno escolhido para ~35° à direita da frente, para não atravessar a Mine. */
const DESVIO_FRENTE = 0.62;
const tamanhoCapa = new THREE.Vector3(0.62, 0.84, 0.14);

/** Capa desenhada num canvas: cor da matéria, etiqueta branca e a inicial. */
function texturaDaCapa(nome: string, cor: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 216;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = cor;
  ctx.fillRect(0, 0, 160, 216);
  // textura de papel cartão: listras bem leves
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  for (let y = 0; y < 216; y += 6) ctx.fillRect(0, y, 160, 2);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.roundRect(22, 64, 116, 70, 8);
  ctx.fill();
  ctx.fillStyle = "#1d2440";
  ctx.font = "800 40px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((nome.trim()[0] || "?").toUpperCase(), 80, 92);
  ctx.font = "700 13px system-ui, sans-serif";
  const curto = nome.length > 14 ? `${nome.slice(0, 13)}…` : nome;
  ctx.fillText(curto, 80, 120);
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
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

    const tick = (tempo: number, delta: number) => {
      const p = palcoRef.current!;
      // inércia do arrasto, depois volta ao giro lento de sempre
      if (!arrasto.ativo) {
        giro.alvo += arrasto.inercia;
        arrasto.inercia *= 0.94;
        // com um caderno em destaque o sistema para de girar sozinho
        if (!escolhido) giro.alvo += delta * 0.06;
      }
      sistema.rotation.y = mola(giro, giro.alvo, delta, 90, 16);
      // afasta a câmera em palco estreito para a órbita de fora caber inteira
      const meiaLargura = Math.tan(THREE.MathUtils.degToRad(p.camera.fov / 2)) * p.camera.aspect;
      // 8.8 de perto: na Estante em órbita a área é larga e os cadernos sumiam a 11
      p.camera.position.z = Math.max(8.2, 5.2 / meiaLargura);
      // parallax suave da câmera pelo ponteiro
      p.camera.position.x = p.pointer.x * 0.9;
      // câmera mais alta: a órbita vira uma elipse mais aberta e enche o palco
      p.camera.position.y = 4.1 + p.pointer.y * 0.6;
      p.camera.lookAt(0, -0.35, 0);

      // a Mine flutua de leve e cresce um pouco quando o ponteiro passa nela
      const pulso = 1 + Math.sin(tempo * 1.8) * 0.03 + (nucleoHover ? 0.1 : 0);
      nucleo.scale.setScalar(2.3 * pulso);
      nucleo.position.y = 0.35 + Math.sin(tempo * 1.2) * 0.08;
      brilho.scale.setScalar(2.6 + Math.sin(tempo * 1.8) * 0.12);
      poeira.rotation.y = tempo * 0.012;

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
        caderno.chegada = Math.min(1, caderno.chegada + delta * 0.62);
        const e = 1 - Math.pow(1 - caderno.chegada, 3);
        const ox = Math.cos(caderno.angulo) * caderno.raio;
        const oz = Math.sin(caderno.angulo) * caderno.raio;
        const oy = Math.sin(tempo * 1.1 + caderno.fase) * 0.12;
        // chega de perto da câmera (no espaço do sistema girado) até a órbita
        const lev = mola(caderno.levanta, parado ? 1 : 0, delta, 220, 20);
        caderno.grupo.position.set(ox * e + (1 - e) * 0.5, oy * e + (1 - e) * 3.4 + lev * 0.85, oz * e + (1 - e) * 7);
        // levantado, o caderno vira a capa para a câmera (rotação no mundo ≈ 0,
        // com um leve giro para o centro, já que ele fica à direita): o giro vai
        // pelo caminho mais curto, sem dar voltas
        const base = -caderno.angulo + Math.PI / 2 + (1 - e) * Math.PI * 4;
        const deFrente = -sistema.rotation.y - 0.32;
        const falta = THREE.MathUtils.euclideanModulo(deFrente - base + Math.PI, Math.PI * 2) - Math.PI;
        caderno.grupo.rotation.y = base + falta * lev;
        caderno.grupo.rotation.z = Math.sin(tempo * 0.9 + caderno.fase) * 0.08 * (1 - lev) + (1 - e) * 0.6;
        caderno.grupo.rotation.x = -0.18 * lev;
        const tamanho = eleito ? 1 + lev * 0.6 : coadjuvante ? 0.85 + lev * 0.3 : 1 + lev * 0.3;
        caderno.grupo.scale.setScalar(ESCALA_CADERNO * tamanho + (1 - e) * 1.2);
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
        const alvos = [...[...cadernos.values()].map((c) => c.capa), ...fantasmas.map((g) => g.children[0]), nucleo];
        const toque = raycaster.intersectObjects(alvos, false)[0];
        const id = (toque?.object.userData.id as string | undefined) ?? null;
        nucleoHover = toque?.object === nucleo;
        hover = id && cadernos.has(id) ? id : null;
        host.style.cursor = toque ? "pointer" : "grab";
        if (tip) {
          const nome = hover ? cadernos.get(hover)!.nome : nucleoHover ? "Conversar com a Mine" : id === "fantasma" ? "Criar matéria" : "";
          if (tip.textContent !== nome) tip.textContent = nome;
          tip.classList.toggle("is-on", Boolean(nome));
          if (nome && toque) {
            projetado.copy(toque.point).project(p.camera);
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
    const { scene, guardar } = palco;
    const tinta = corDoToken("--pen", "#3446c9");
    const texto = corDoToken("--theme-text", "#1d2440");

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8fa8, 1.3));
    const sol = new THREE.DirectionalLight(0xffffff, 1.6);
    sol.position.set(4, 7, 6);
    scene.add(sol);
    const quente = new THREE.PointLight(0xffd89a, 6, 9, 1.6);
    scene.add(quente);

    const sistema = new THREE.Group();
    sistema.rotation.x = 0.12;
    scene.add(sistema);

    // núcleo: a própria Mine (o mesmo rosto da margem do caderno), sempre de
    // frente para a câmera. Antes era um globo de arame que não lembrava ela.
    const nucleo = new THREE.Sprite(guardar(new THREE.SpriteMaterial({ map: guardar(texturaDaMine()), transparent: true, depthWrite: false })));
    nucleo.userData.id = "nucleo";
    nucleo.position.y = 0.35;
    sistema.add(nucleo);
    const brilho = new THREE.Sprite(
      guardar(
        new THREE.SpriteMaterial({
          map: guardar(
            (() => {
              const c = document.createElement("canvas");
              c.width = c.height = 128;
              const g = c.getContext("2d")!;
              const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
              grad.addColorStop(0, "rgba(255,226,150,0.85)");
              grad.addColorStop(0.4, "rgba(255,200,120,0.25)");
              grad.addColorStop(1, "rgba(255,200,120,0)");
              g.fillStyle = grad;
              g.fillRect(0, 0, 128, 128);
              const t = new THREE.CanvasTexture(c);
              t.colorSpace = THREE.SRGBColorSpace;
              return t;
            })(),
          ),
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      ),
    );
    sistema.add(brilho);

    // órbitas: as linhas da pauta do caderno viraram anéis
    const materialAnel = guardar(new THREE.MeshBasicMaterial({ color: texto, transparent: true, opacity: 0.16 }));
    raios.forEach((raio) => {
      const anel = new THREE.Mesh(guardar(new THREE.TorusGeometry(raio, 0.012, 6, 160)), materialAnel);
      anel.rotation.x = Math.PI / 2;
      sistema.add(anel);
    });

    // poeira de estrelas em volta (um único Points)
    const quantos = 280;
    const posicoes = new Float32Array(quantos * 3);
    for (let i = 0; i < quantos; i += 1) {
      const r = 5 + Math.random() * 5;
      const t = Math.random() * Math.PI * 2;
      const f = Math.acos(2 * Math.random() - 1);
      posicoes.set([r * Math.sin(f) * Math.cos(t), r * Math.cos(f) * 0.6, r * Math.sin(f) * Math.sin(t)], i * 3);
    }
    const geoPoeira = guardar(new THREE.BufferGeometry());
    geoPoeira.setAttribute("position", new THREE.BufferAttribute(posicoes, 3));
    const poeira = new THREE.Points(geoPoeira, guardar(new THREE.PointsMaterial({ color: tinta, size: 0.05, transparent: true, opacity: 0.55, depthWrite: false })));
    scene.add(poeira);

    const geoCapa = guardar(new THREE.BoxGeometry(tamanhoCapa.x, tamanhoCapa.y, tamanhoCapa.z));
    const geoMiolo = guardar(new THREE.BoxGeometry(tamanhoCapa.x * 0.92, tamanhoCapa.y * 0.94, tamanhoCapa.z * 0.8));
    const materialMiolo = guardar(new THREE.MeshStandardMaterial({ color: 0xfbfaf4, roughness: 0.9 }));
    const geoOnda = guardar(new THREE.RingGeometry(0.96, 1, 64));

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

    const adicionar = (materia: MateriaOrbita, indice: number, anima: boolean) => {
      const cor = new THREE.Color(materia.color);
      const textura = guardar(texturaDaCapa(materia.name, materia.color));
      const lateral = guardar(new THREE.MeshStandardMaterial({ color: cor, roughness: 0.55 }));
      const frente = guardar(new THREE.MeshStandardMaterial({ map: textura, roughness: 0.5 }));
      const capa = new THREE.Mesh(geoCapa, [lateral, lateral, lateral, lateral, frente, lateral]);
      capa.userData.id = materia.id;
      const miolo = new THREE.Mesh(geoMiolo, materialMiolo);
      miolo.position.x = 0.04;
      const grupo = new THREE.Group();
      grupo.add(miolo, capa);
      sistema.add(grupo);
      const raio = raios[indice % raios.length];
      cadernos.set(materia.id, {
        id: materia.id,
        grupo,
        capa,
        raio,
        angulo: (indice * 2.399) % (Math.PI * 2),
        velocidade: 0.32 / raio,
        fase: indice * 1.7,
        levanta: { v: 0, vel: 0 },
        chegada: anima ? 0 : 1,
        nome: materia.name,
        postit: null,
        avisoChave: "",
      });
      colarAviso(cadernos.get(materia.id)!, materia.aviso);
      if (anima) {
        const onda = new THREE.Mesh(geoOnda, new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
        onda.rotation.x = Math.PI / 2;
        sistema.add(onda);
        ondas.push({ malha: onda, t: 0 });
      }
    };

    // a primeira leva desta cena entra parada; o que aparecer depois chega voando
    let jaSincronizou = false;
    const sincronizar = (lista: MateriaOrbita[]) => {
      const anima = jaSincronizou;
      jaSincronizou = true;
      const ids = new Set(lista.map((item) => item.id));
      for (const [id, caderno] of cadernos) {
        if (!ids.has(id)) {
          colarAviso(caderno, undefined);
          sistema.remove(caderno.grupo);
          cadernos.delete(id);
        }
      }
      lista.forEach((materia, indice) => {
        const existente = cadernos.get(materia.id);
        if (existente) {
          existente.nome = materia.name;
          colarAviso(existente, materia.aviso);
        } else adicionar(materia, indice, anima);
      });
      if (escolhido) selecionar(escolhido);
      // sem matéria: três cadernos de arame chamando para criar a primeira
      fantasmas.forEach((g) => sistema.remove(g));
      fantasmas.length = 0;
      if (!lista.length) {
        const arame = guardar(new THREE.MeshBasicMaterial({ color: tinta, wireframe: true, transparent: true, opacity: 0.55 }));
        for (let i = 0; i < 3; i += 1) {
          const g = new THREE.Group();
          const m = new THREE.Mesh(geoCapa, arame);
          m.userData.id = "fantasma";
          g.add(m);
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
      const toque = raycaster.intersectObjects([...[...cadernos.values()].map((c) => c.capa), ...fantasmas.map((g) => g.children[0]), nucleo], false)[0];
      const id = toque?.object.userData.id as string | undefined;
      if (!id) return;
      if (id === "nucleo") callbacks.current.onNucleo();
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
      if (ondas.length < 4) {
        const onda = new THREE.Mesh(geoOnda, new THREE.MeshBasicMaterial({ color: 0x39f59a, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
        onda.rotation.x = Math.PI / 2;
        sistema.add(onda);
        ondas.push({ malha: onda, t: 0 });
      }
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
