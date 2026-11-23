/**
 * Bancada 3D do Laboratório (carregada sob demanda). Um único WebGL para os
 * quatro experimentos: cada um é um "kit" montado sobre o tapete de corte e
 * a troca faz o kit novo brotar da mesa enquanto o antigo afunda.
 *
 * Interação: arrastar uma peça marcada (alça da rampa, bateria, resistor,
 * cano do canhão) muda o valor; tocar (seletor, bureta, canhão) age; arrastar
 * o fundo gira a câmera. A Mine fica no canto, olhando o que acontece.
 *
 * Contrato do palco (src/cena3d/palco.ts): DPR com teto, laço parado fora da
 * tela, nada de setState por quadro, tudo descartado ao desmontar.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { criarAmbienteEstudio } from "../cena3d/estudio";
import { corDoToken, criarPalco, type Palco } from "../cena3d/palco";
import { criarMine3D } from "../cena3d/mine3d";
import type { AcaoLab, EstadoLab, ExpId } from "./tipos";
import type { Kit } from "./3d/kit";
import { texturaTapete, suave, type CtxKit } from "./3d/pecas";
import { criarKitPlano } from "./3d/kit-plano";
import { criarKitCircuito } from "./3d/kit-circuito";
import { criarKitPh } from "./3d/kit-ph";
import { criarKitLancamento } from "./3d/kit-lancamento";

const FABRICAS: Record<ExpId, (ctx: CtxKit, emitir: (a: AcaoLab) => void) => Kit> = {
  plano: criarKitPlano,
  circuito: criarKitCircuito,
  ph: criarKitPh,
  lancamento: criarKitLancamento,
};

type Api = { atualizar: (estado: EstadoLab) => void };
const LUGAR_MINE = new THREE.Vector3(-3.05, 0.55, -1.75);

export default function Bancada3D({ estado, onAcao, onMine }: { estado: EstadoLab; onAcao: (acao: AcaoLab) => void; onMine: () => void }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<Api | null>(null);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const callbacks = useRef({ onAcao, onMine });
  callbacks.current = { onAcao, onMine };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const kits = new Map<ExpId, { kit: Kit; vis: number }>();
    let ativo: ExpId = estadoRef.current.exp;
    let comemorado = estadoRef.current.comemorar;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const foco = new THREE.Vector3();
    const olhar = new THREE.Vector3();
    const alvoCam = new THREE.Vector3(0, 1, 0);
    const cam = { dist: 8.5, elev: 0.35, yaw: 0, yawAlvo: 0, pitchExtra: 0 };
    const gesto = { modo: "" as "" | "arrasta" | "toca" | "orbita", objeto: null as THREE.Object3D | null, x: 0, y: 0, ultimoX: 0, ultimoY: 0, moveu: 0 };
    let hover: THREE.Object3D | null = null;
    let intro = 0;

    const tick = (tempo: number, delta: number) => {
      const p = palcoRef.current!;
      intro = Math.min(1, intro + delta / 1.4);
      const k = kits.get(ativo);
      // câmera em órbita esférica em volta do alvo do kit ativo
      if (k) {
        alvoCam.lerp(k.kit.camera.alvo, 1 - Math.exp(-delta * 4));
        const aspecto = p.camera.aspect;
        cam.dist = suave(cam.dist, k.kit.camera.distancia * Math.max(1, 1.5 / aspecto), delta, 4);
        cam.elev = suave(cam.elev, k.kit.camera.elevacao, delta, 4);
      }
      cam.yaw = suave(cam.yaw, cam.yawAlvo, delta, 6);
      const ei = 1 - Math.pow(1 - intro, 3);
      const yaw = cam.yaw + p.pointer.x * 0.08 + (1 - ei) * 0.6;
      const elev = THREE.MathUtils.clamp(cam.elev + cam.pitchExtra - p.pointer.y * 0.04, 0.08, 1.2);
      const dist = cam.dist * (1 + (1 - ei) * 0.35);
      p.camera.position.set(alvoCam.x + Math.sin(yaw) * Math.cos(elev) * dist, alvoCam.y + Math.sin(elev) * dist, alvoCam.z + Math.cos(yaw) * Math.cos(elev) * dist);
      p.camera.lookAt(alvoCam);

      // troca de kit: o ativo brota da mesa, os outros afundam
      for (const [id, item] of kits) {
        item.vis = suave(item.vis, id === ativo ? 1 : 0, delta, id === ativo ? 5 : 9);
        const g = item.kit.grupo;
        g.visible = item.vis > 0.01;
        if (!g.visible) continue;
        const e = item.vis;
        g.position.y = (e - 1) * 1.6;
        g.scale.setScalar(0.9 + 0.1 * e);
        item.kit.tick(tempo, delta);
      }

      // a Mine olha para o que está acontecendo (ou para quem mexe nela)
      if (k) k.kit.foco(foco);
      // meio caminho entre o experimento e a câmera: ela acompanha a ação sem dar as costas
      olhar.copy(hover === mine.alvo ? p.camera.position : foco.lerp(p.camera.position, 0.45));
      mine.grupo.position.lerp(k?.kit.lugarDaMine ?? LUGAR_MINE, 1 - Math.exp(-delta * 3));
      mine.atualizar(tempo, delta, olhar, { hover: hover === mine.alvo || gesto.modo === "arrasta" });

      // hover: etiqueta e cursor
      const tip = tipRef.current;
      if (p.pointer.dentro && !gesto.modo) {
        ndc.set(p.pointer.alvoX, p.pointer.alvoY);
        raycaster.setFromCamera(ndc, p.camera);
        const toque = k ? raycaster.intersectObjects([...k.kit.alvos, mine.alvo], false)[0] : undefined;
        hover = toque?.object ?? null;
        const dados = hover === mine.alvo ? { toca: true, dica: "Mine: toque para perguntar sobre o experimento" } : hover?.userData;
        host.style.cursor = dados?.arrasta ? "ns-resize" : dados?.toca ? "pointer" : "grab";
        if (tip) {
          const texto = (dados?.dica as string | undefined) ?? "";
          if (tip.textContent !== texto) tip.textContent = texto;
          tip.classList.toggle("is-on", Boolean(texto));
          if (texto && toque) {
            const proj = toque.point.clone().project(p.camera);
            // presa dentro do palco: perto da borda a etiqueta vazava para fora
            const meia = tip.offsetWidth / 2 + 8;
            const x = THREE.MathUtils.clamp(((proj.x + 1) / 2) * host.clientWidth, meia, host.clientWidth - meia);
            const y = Math.max(tip.offsetHeight + 8, ((1 - proj.y) / 2) * host.clientHeight - 16);
            tip.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
          }
        }
      } else if (!gesto.modo) {
        hover = null;
        tip?.classList.remove("is-on");
      }

      sol.position.set(alvoCam.x + 4, 9, alvoCam.z + 5);
      sol.target.position.copy(alvoCam);
    };

    const palcoRef = { current: null as Palco | null };
    const palco = criarPalco(host, tick, { fov: 34, z: 9 });
    palcoRef.current = palco;
    const { scene, renderer, guardar } = palco;
    const texto = corDoToken("--theme-text", "#1d2440");
    const escuro = texto.getHSL({ h: 0, s: 0, l: 0 }).l > 0.5;
    const tinta = corDoToken("--pen", "#3446c9");

    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene.environment = guardar(
      criarAmbienteEstudio(renderer, { acento: 0x39f59a, modo: escuro ? "escuro" : "claro", sigma: 0.02 }),
    );
    scene.environmentIntensity = escuro ? 0.82 : 0.9;

    scene.add(new THREE.HemisphereLight(0xffffff, escuro ? 0x26304a : 0xc3c8da, escuro ? 0.75 : 0.95));
    const sol = new THREE.DirectionalLight(0xfff4e2, 2.2);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    sol.shadow.camera.left = -7;
    sol.shadow.camera.right = 7;
    sol.shadow.camera.top = 7;
    sol.shadow.camera.bottom = -7;
    sol.shadow.camera.near = 1;
    sol.shadow.camera.far = 30;
    sol.shadow.bias = -0.0006;
    sol.shadow.normalBias = 0.02;
    sol.shadow.radius = 4;
    scene.add(sol, sol.target);
    const recorte = new THREE.DirectionalLight(0x39f59a, escuro ? 1.2 : 0.6);
    recorte.position.set(-6, 4, -6);
    scene.add(recorte);

    // mesa: tampo + tapete de corte
    const tampo = new THREE.Mesh(guardar(new RoundedBoxGeometry(11.2, 0.42, 6, 3, 0.12)), guardar(new THREE.MeshStandardMaterial({ color: escuro ? 0x2b3040 : 0xf2efe6, roughness: 0.7 })));
    tampo.position.y = -0.28;
    tampo.receiveShadow = true;
    const texTapete = guardar(texturaTapete(escuro));
    const matLado = guardar(new THREE.MeshStandardMaterial({ color: escuro ? 0x17352c : 0x2f7a63, roughness: 0.8 }));
    const tapete = new THREE.Mesh(guardar(new THREE.BoxGeometry(10.4, 0.06, 5.4)), [matLado, matLado, guardar(new THREE.MeshStandardMaterial({ map: texTapete, roughness: 0.85 })), matLado, matLado, matLado]);
    tapete.position.y = -0.03;
    tapete.receiveShadow = true;
    scene.add(tampo, tapete);

    // Mine de assistente no canto de trás
    const mine = criarMine3D(guardar, { escuro, aura: false });
    mine.grupo.position.set(-3.05, 0.55, -1.75);
    mine.grupo.scale.setScalar(0.5);
    mine.grupo.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    scene.add(mine.grupo);

    const ctxKit: CtxKit = { guardar, escuro, tinta, renderer };
    const emitir = (acao: AcaoLab) => callbacks.current.onAcao(acao);
    const garantirKit = (id: ExpId) => {
      let item = kits.get(id);
      if (!item) {
        const kit = FABRICAS[id](ctxKit, emitir);
        scene.add(kit.grupo);
        item = { kit, vis: 0 };
        kits.set(id, item);
      }
      return item;
    };

    const atualizar = (estado: EstadoLab) => {
      if (estado.exp !== ativo) {
        ativo = estado.exp;
        cam.yawAlvo = 0;
        cam.pitchExtra = 0;
      }
      garantirKit(estado.exp).kit.atualizar(estado);
      if (estado.comemorar !== comemorado) {
        comemorado = estado.comemorar;
        mine.pular(1);
      }
    };
    apiRef.current = { atualizar };
    atualizar(estadoRef.current);
    // primeira montagem: o kit já começa na mesa (a câmera é que chega)
    kits.get(ativo)!.vis = 1;

    // gestos
    const tocarEm = (event: PointerEvent) => {
      const r = host.getBoundingClientRect();
      ndc.set(((event.clientX - r.left) / r.width) * 2 - 1, -(((event.clientY - r.top) / r.height) * 2 - 1));
      raycaster.setFromCamera(ndc, palco.camera);
      const k = kits.get(ativo);
      return k ? raycaster.intersectObjects([...k.kit.alvos, mine.alvo], false)[0]?.object ?? null : null;
    };
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const objeto = tocarEm(event);
      gesto.objeto = objeto;
      gesto.x = gesto.ultimoX = event.clientX;
      gesto.y = gesto.ultimoY = event.clientY;
      gesto.moveu = 0;
      if (objeto?.userData.arrasta) {
        gesto.modo = "arrasta";
        kits.get(ativo)?.kit.aoSegurar?.(objeto);
      } else if (objeto === mine.alvo || objeto?.userData.toca) gesto.modo = "toca";
      else gesto.modo = "orbita";
      host.setPointerCapture(event.pointerId);
      if (gesto.modo !== "toca") host.style.cursor = gesto.modo === "arrasta" ? "ns-resize" : "grabbing";
    };
    const onMove = (event: PointerEvent) => {
      if (!gesto.modo) return;
      const dx = event.clientX - gesto.ultimoX;
      const dy = event.clientY - gesto.ultimoY;
      gesto.ultimoX = event.clientX;
      gesto.ultimoY = event.clientY;
      gesto.moveu += Math.abs(dx) + Math.abs(dy);
      if (gesto.modo === "arrasta" && gesto.objeto) kits.get(ativo)?.kit.aoArrastar?.(gesto.objeto, dy, dx);
      if (gesto.modo === "orbita") {
        cam.yawAlvo = THREE.MathUtils.clamp(cam.yawAlvo - dx * 0.006, -0.8, 0.8);
        cam.pitchExtra = THREE.MathUtils.clamp(cam.pitchExtra + dy * 0.003, -0.25, 0.35);
      }
    };
    const onUp = (event: PointerEvent) => {
      if (!gesto.modo) return;
      host.releasePointerCapture?.(event.pointerId);
      if (gesto.modo === "arrasta") kits.get(ativo)?.kit.aoSegurar?.(null);
      if (gesto.modo === "toca" && gesto.moveu < 8 && gesto.objeto) {
        if (gesto.objeto === mine.alvo) {
          mine.pular(0.8);
          callbacks.current.onMine();
        } else kits.get(ativo)?.kit.aoTocar?.(gesto.objeto);
      }
      gesto.modo = "";
      gesto.objeto = null;
    };
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerup", onUp);
    host.addEventListener("pointercancel", onUp);
    requestAnimationFrame(() => host.classList.add("is-ready"));

    return () => {
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
      kits.forEach(({ kit }) => kit.descartar?.());
      apiRef.current = null;
      palco.destruir();
    };
  }, []);

  useEffect(() => {
    apiRef.current?.atualizar(estado);
  }, [estado]);

  return (
    <div ref={hostRef} className="lab3d-host" style={{ touchAction: "pan-y" }}>
      <div ref={tipRef} className="lab3d-tip" aria-hidden />
    </div>
  );
}
