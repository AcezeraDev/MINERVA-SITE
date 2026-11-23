/**
 * A Mine em retrato 3D (topo da Home, tela vazia do chat): a mesma cabeça do centro da órbita
 * (src/home/mine3d.ts), sozinha num palco pequeno. Segue o ponteiro pela
 * janela inteira (como o MineFace `track`), fica contente no hover e pula no
 * clique. O palco para fora da tela; carregada só quando a cena 3D está ligada.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { corDoToken, criarPalco } from "./palco";
import { criarMine3D, type Humor3D } from "./mine3d";
import "./mine-retrato.css";

export default function MineRetrato3D({ className = "", humor, pulo = 0, susto = 0 }: { className?: string; humor?: Humor3D; pulo?: number; susto?: number }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // humor muda a cada tecla na tela de entrada: vai por ref, sem refazer o palco
  const humorRef = useRef<Humor3D | undefined>(humor);
  humorRef.current = humor;
  const mineRef = useRef<ReturnType<typeof criarMine3D> | null>(null);
  // `pulo` e `susto` são contadores: cada aumento dispara o gesto uma vez
  useEffect(() => {
    if (pulo) mineRef.current?.pular(0.7);
  }, [pulo]);
  useEffect(() => {
    if (susto) mineRef.current?.assustar();
  }, [susto]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const olhar = new THREE.Vector3();
    // ponteiro da janela inteira, relativo ao centro do retrato (-1..1 com folga)
    const alvo = { x: 0, y: 0 };
    const suave = { x: 0, y: 0 };
    let hover = false;

    const tick = (tempo: number, delta: number) => {
      const p = palco.camera.position;
      suave.x += (alvo.x - suave.x) * Math.min(1, delta * 5);
      suave.y += (alvo.y - suave.y) * Math.min(1, delta * 5);
      olhar.set(p.x + suave.x * 5, p.y + suave.y * 3.5, p.z);
      mine.atualizar(tempo, delta, olhar, { hover, humor: humorRef.current });
    };

    const palco = criarPalco(host, tick, { fov: 30, z: 6.4 });
    palco.camera.position.y = 0.25;
    palco.camera.lookAt(0, 0.22, 0);
    const { scene, guardar } = palco;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8fa8, 1.3));
    const sol = new THREE.DirectionalLight(0xffffff, 1.6);
    sol.position.set(3, 5, 6);
    scene.add(sol);
    const texto = corDoToken("--theme-text", "#1d2440");
    const mine = criarMine3D(guardar, { escuro: texto.getHSL({ h: 0, s: 0, l: 0 }).l > 0.5, aura: false });
    scene.add(mine.grupo);
    mineRef.current = mine;

    let rect = host.getBoundingClientRect();
    let medido = 0;
    const onMove = (event: PointerEvent) => {
      const agora = performance.now();
      if (agora - medido > 300) {
        medido = agora;
        rect = host.getBoundingClientRect();
      }
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      alvo.x = THREE.MathUtils.clamp((event.clientX - cx) / (rect.width * 3), -1, 1);
      alvo.y = THREE.MathUtils.clamp(-(event.clientY - cy) / (rect.height * 3), -1, 1);
    };
    const onEnter = () => (hover = true);
    const onLeave = () => (hover = false);
    const onClick = () => mine.pular(1);
    window.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerenter", onEnter);
    host.addEventListener("pointerleave", onLeave);
    host.addEventListener("click", onClick);
    requestAnimationFrame(() => host.classList.add("is-ready"));

    return () => {
      window.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerenter", onEnter);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("click", onClick);
      mineRef.current = null;
      palco.destruir();
    };
  }, []);

  return <div ref={hostRef} className={`mine-retrato-3d ${className}`} />;
}
