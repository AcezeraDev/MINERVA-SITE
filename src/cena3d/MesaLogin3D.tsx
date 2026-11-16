// Carregado sob demanda: material escolar flutuando em volta da tela de entrada.
// Lápis, livros, átomo, globo, borracha, régua e um aviãozinho de papel, com
// contorno de caneta (casco invertido) para casar com o traço do caderno.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { corDoToken, criarPalco, mola } from "./palco";

export type HumorLogin = "idle" | "hello" | "shy" | "peek" | "thinking" | "confused" | "teacher";

type Peca = {
  grupo: THREE.Group;
  /** posição na tela em -1..1 (largura e altura visíveis no plano z=0) */
  nx: number;
  ny: number;
  z: number;
  escala: number;
  giro: THREE.Vector3;
  fase: number;
  entrada: { v: number; vel: number };
  atraso: number;
  /** some no celular para não brigar com o formulário */
  soDesktop?: boolean;
};

export default function MesaLogin3D({ humor }: { humor: HumorLogin }) {
  const host = useRef<HTMLDivElement | null>(null);
  const humorRef = useRef(humor);
  const trocou = useRef(0);

  useEffect(() => {
    if (humorRef.current !== humor) trocou.current = performance.now();
    humorRef.current = humor;
  }, [humor]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const tinta = corDoToken("--theme-text", "#14161b");
    const cores = {
      menta: corDoToken("--mint", "#2fd483"),
      caneta: corDoToken("--pen", "#2b3bd1"),
      // amarelo de lápis de verdade: o token de marca-texto puxa para o oliva no tema claro
      amarelo: new THREE.Color("#ffc73a"),
      rosa: corDoToken("--hl-pink", "#ff9ec4"),
      lilas: corDoToken("--hl-lilac", "#c8b6ff"),
      margem: corDoToken("--margin-line", "#ff6b6f"),
      papel: corDoToken("--sheet", "#ffffff"),
    };

    const pecas: Peca[] = [];
    const velocidade = { v: 1, vel: 0 };
    const tremor = { v: 0, vel: 0 };
    const pulo = { v: 0, vel: 0 };
    let ultimoHumor = humorRef.current;
    const eletrons: THREE.Object3D[] = [];
    let terra: THREE.Object3D | null = null;
    let aviao: THREE.Group | null = null;

    const palco = criarPalco(el, (tempo, delta) => {
      const humorAgora = humorRef.current;
      if (humorAgora !== ultimoHumor) {
        if (humorAgora === "hello") pulo.vel += 9;
        if (humorAgora === "confused") tremor.vel += 14;
        ultimoHumor = humorAgora;
      }
      const alvoVel = humorAgora === "thinking" ? 4.2 : humorAgora === "shy" ? 0.35 : 1;
      mola(velocidade, alvoVel, delta, 40, 10);
      mola(tremor, 0, delta, 260, 9);
      mola(pulo, 0, delta, 120, 8);

      const cam = palco.camera;
      const meiaAltura = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.position.z;
      const meiaLargura = meiaAltura * cam.aspect;
      const estreito = cam.aspect < 1.05;

      for (const peca of pecas) {
        const t = tempo - peca.atraso;
        const alvo = t > 0 ? 1 : 0;
        mola(peca.entrada, alvo, delta, 90, 9);
        const g = peca.grupo;
        g.visible = !(estreito && peca.soDesktop) && peca.entrada.v > 0.01;
        if (!g.visible) continue;

        // no celular as peças vão para as bordas de cima e de baixo
        const ny = estreito ? Math.sign(peca.ny || 1) * Math.max(0.78, Math.abs(peca.ny)) : peca.ny;
        const profundidade = 1 + peca.z * -0.12;
        const bob = Math.sin(tempo * 0.9 + peca.fase) * 0.12;
        g.position.set(
          peca.nx * meiaLargura * 0.92 * profundidade + palco.pointer.x * (0.25 - peca.z * 0.12) + Math.sin(tempo * 40 + peca.fase) * tremor.v * 0.04,
          ny * meiaAltura * 0.9 * profundidade + bob + palco.pointer.y * (0.18 - peca.z * 0.08) + Math.max(0, pulo.v) * 0.05,
          peca.z,
        );
        const s = peca.escala * Math.max(0, peca.entrada.v) * (estreito ? 0.75 : 1);
        g.scale.setScalar(s);
        g.rotation.x += peca.giro.x * delta * velocidade.v;
        g.rotation.y += peca.giro.y * delta * velocidade.v;
        g.rotation.z = Math.sin(tempo * 0.6 + peca.fase) * 0.25 + peca.giro.z;
      }

      // o aviãozinho voa um oito na faixa de cima
      if (aviao) {
        const vt = tempo * 0.32 * Math.min(velocidade.v, 2.2);
        const x = Math.sin(vt) * meiaLargura * 0.7;
        const y = meiaAltura * (estreito ? 0.7 : 0.74) + Math.sin(vt * 2) * meiaAltura * 0.08;
        const dx = Math.cos(vt);
        const dy = Math.cos(vt * 2) * 0.4;
        aviao.position.set(x + palco.pointer.x * 0.3, y + palco.pointer.y * 0.2, -1.2);
        aviao.rotation.set(0, 0, 0);
        aviao.rotation.y = dx > 0 ? 0 : Math.PI;
        aviao.rotation.z = Math.atan2(dy, Math.abs(dx)) * (dx > 0 ? 1 : 1);
        aviao.rotation.x = Math.sin(vt * 2) * 0.5;
        aviao.scale.setScalar(Math.min(1, Math.max(0, tempo - 1.4)) * (estreito ? 0.6 : 0.8));
      }

      eletrons.forEach((orbita, i) => (orbita.rotation.z = tempo * 1.4 * velocidade.v + i * 2.1));
      if (terra) terra.rotation.y = tempo * 0.6;

      // a cena inclina de leve com o ponteiro
      palco.scene.rotation.y = palco.pointer.x * 0.08;
      palco.scene.rotation.x = -palco.pointer.y * 0.05;
    }, { fov: 30, z: 14 });

    // o host não recebe ponteiro (fica atrás do formulário): lemos da janela
    const onMove = (event: PointerEvent) => {
      palco.pointer.alvoX = (event.clientX / window.innerWidth) * 2 - 1;
      palco.pointer.alvoY = -((event.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const { scene, guardar } = palco;
    palco.renderer.toneMapping = THREE.NoToneMapping;

    // luz de estúdio suave + um recorte quente, como luminária de mesa
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa2c0, 1.15));
    const sol = new THREE.DirectionalLight(0xfff2dc, 1.5);
    sol.position.set(-4, 6, 8);
    scene.add(sol);
    const recorte = new THREE.DirectionalLight(cores.menta, 0.6);
    recorte.position.set(6, -3, 4);
    scene.add(recorte);

    const contorno = guardar(new THREE.MeshBasicMaterial({ color: tinta, side: THREE.BackSide }));
    const mat = (cor: THREE.Color, rugosidade = 0.55, metal = 0) =>
      guardar(new THREE.MeshStandardMaterial({ color: cor, roughness: rugosidade, metalness: metal, flatShading: false }));

    /** Malha com contorno de caneta: o casco invertido um pouco maior. */
    const peca = (geo: THREE.BufferGeometry, material: THREE.Material, espessura = 1.06) => {
      guardar(geo);
      const g = new THREE.Group();
      const corpo = new THREE.Mesh(geo, material);
      const casco = new THREE.Mesh(geo, contorno);
      casco.scale.setScalar(espessura);
      g.add(casco, corpo);
      return g;
    };

    const registrar = (grupo: THREE.Group, opcoes: Omit<Peca, "grupo" | "entrada" | "giro" | "fase"> & { giro?: [number, number, number] }) => {
      grupo.scale.setScalar(0.0001);
      scene.add(grupo);
      pecas.push({
        grupo,
        ...opcoes,
        giro: new THREE.Vector3(...(opcoes.giro ?? [0.2, 0.35, 0])),
        fase: Math.random() * Math.PI * 2,
        entrada: { v: 0, vel: 0 },
      });
    };

    // ── lápis ──
    {
      const lapis = new THREE.Group();
      const corpo = peca(new THREE.CylinderGeometry(0.28, 0.28, 3, 6), mat(cores.amarelo, 0.5));
      const madeira = peca(new THREE.ConeGeometry(0.28, 0.7, 6), mat(new THREE.Color("#f1c99a"), 0.8));
      madeira.position.y = -1.85;
      const grafite = new THREE.Mesh(guardar(new THREE.ConeGeometry(0.1, 0.26, 6)), mat(tinta, 0.4));
      grafite.position.y = -2.08;
      const anel = peca(new THREE.CylinderGeometry(0.3, 0.3, 0.32, 16), mat(new THREE.Color("#c9ccd6"), 0.3, 0.8));
      anel.position.y = 1.66;
      const borracha = peca(new THREE.CylinderGeometry(0.28, 0.28, 0.42, 16), mat(cores.rosa, 0.7));
      borracha.position.y = 2.02;
      lapis.add(corpo, madeira, grafite, anel, borracha);
      const pivo = new THREE.Group();
      lapis.rotation.z = -0.9;
      pivo.add(lapis);
      registrar(pivo, { nx: -0.93, ny: 0.62, z: -0.5, escala: 0.5, atraso: 0.35, giro: [0, 0.5, -0.4] });
    }

    // ── pilha de livros ──
    {
      const pilha = new THREE.Group();
      const capas = [cores.caneta, cores.menta, cores.margem];
      capas.forEach((cor, i) => {
        const largura = 2.4 - i * 0.25;
        const livro = new THREE.Group();
        const capa = peca(new THREE.BoxGeometry(largura, 0.42, 1.7), mat(cor, 0.6), 1.04);
        const folhas = new THREE.Mesh(guardar(new THREE.BoxGeometry(largura - 0.12, 0.32, 1.62)), mat(cores.papel, 0.9));
        folhas.position.x = 0.07;
        livro.add(capa, folhas);
        livro.position.y = i * 0.46;
        livro.rotation.y = (i - 1) * 0.22;
        pilha.add(livro);
      });
      pilha.rotation.x = 0.35;
      registrar(pilha, { nx: -0.92, ny: -0.72, z: 0.2, escala: 0.5, atraso: 0.5, giro: [0, 0.25, 0.1] });
    }

    // ── átomo ──
    {
      const atomo = new THREE.Group();
      atomo.add(peca(new THREE.IcosahedronGeometry(0.42, 2), mat(cores.margem, 0.35), 1.1));
      for (let i = 0; i < 3; i += 1) {
        const orbita = new THREE.Group();
        const anel = new THREE.Mesh(guardar(new THREE.TorusGeometry(1.15, 0.045, 8, 64)), mat(cores.caneta, 0.4));
        const eletron = peca(new THREE.SphereGeometry(0.14, 16, 12), mat(cores.menta, 0.3), 1.18);
        eletron.position.x = 1.15;
        orbita.add(anel, eletron);
        orbita.rotation.set(Math.PI / 2, (i * Math.PI) / 3, 0);
        eletrons.push(orbita);
        atomo.add(orbita);
      }
      registrar(atomo, { nx: 0.1, ny: 0.86, z: -1.6, escala: 0.5, atraso: 0.65, giro: [0.35, 0.6, 0.2], soDesktop: true });
    }

    // ── globo ──
    {
      const globo = new THREE.Group();
      const globoTerra = peca(new THREE.SphereGeometry(0.9, 32, 20), mat(cores.lilas, 0.6), 1.05);
      const continentes = new THREE.Mesh(
        guardar(new THREE.IcosahedronGeometry(0.915, 1)),
        guardar(new THREE.MeshStandardMaterial({ color: cores.menta, roughness: 0.6, wireframe: true })),
      );
      const eixo = peca(new THREE.TorusGeometry(1.15, 0.06, 8, 48, Math.PI * 1.2), mat(new THREE.Color("#c9ccd6"), 0.3, 0.7));
      eixo.rotation.z = Math.PI * 0.4;
      const pe = peca(new THREE.CylinderGeometry(0.12, 0.55, 0.32, 24), mat(cores.caneta, 0.5));
      pe.position.y = -1.3;
      globoTerra.add(continentes);
      globo.add(globoTerra, eixo, pe);
      globo.rotation.z = 0.35;
      registrar(globo, { nx: 0.95, ny: 0.5, z: -0.8, escala: 0.5, atraso: 0.8, giro: [0, 0.5, 0.2] });
      terra = globoTerra;
    }

    // ── borracha ──
    {
      const borracha = new THREE.Group();
      const rosa = peca(new THREE.BoxGeometry(1.2, 0.5, 0.75), mat(cores.rosa, 0.85), 1.05);
      rosa.position.x = 0.35;
      const capa = peca(new THREE.BoxGeometry(0.75, 0.56, 0.8), mat(cores.caneta, 0.5), 1.05);
      capa.position.x = -0.3;
      borracha.add(rosa, capa);
      registrar(borracha, { nx: 0.95, ny: -0.58, z: 0.4, escala: 0.5, atraso: 0.95, giro: [0.5, 0.4, 0.3] });
    }

    // ── régua ──
    {
      const regua = new THREE.Group();
      regua.add(peca(new THREE.BoxGeometry(3.4, 0.5, 0.08), mat(cores.menta, 0.35), 1.05));
      const marcas = new THREE.Group();
      for (let i = 0; i <= 16; i += 1) {
        const marca = new THREE.Mesh(guardar(new THREE.BoxGeometry(0.03, i % 4 === 0 ? 0.22 : 0.12, 0.1)), contorno);
        marca.position.set(-1.6 + i * 0.2, 0.25 - (i % 4 === 0 ? 0.11 : 0.06), 0.01);
        marcas.add(marca);
      }
      regua.add(marcas);
      registrar(regua, { nx: 0.08, ny: -0.93, z: -1.2, escala: 0.5, atraso: 1.1, giro: [0.12, 0.3, -0.15], soDesktop: true });
    }

    // ── aviãozinho de papel ──
    {
      const geo = new THREE.BufferGeometry();
      // ponta em +x; duas asas e a quilha
      const v = new Float32Array([
        1.2, 0, 0, -0.9, 0, 0.75, -0.9, 0.06, 0,
        1.2, 0, 0, -0.9, 0.06, 0, -0.9, 0, -0.75,
        1.2, 0, 0, -0.9, 0.06, 0, -0.9, -0.42, 0,
      ]);
      geo.setAttribute("position", new THREE.BufferAttribute(v, 3));
      geo.computeVertexNormals();
      guardar(geo);
      const papel = guardar(new THREE.MeshStandardMaterial({ color: cores.papel, roughness: 0.9, side: THREE.DoubleSide }));
      const linhas = guardar(new THREE.LineBasicMaterial({ color: tinta }));
      const bordas = new THREE.LineSegments(guardar(new THREE.EdgesGeometry(geo)), linhas);
      aviao = new THREE.Group();
      aviao.add(new THREE.Mesh(geo, papel), bordas);
      aviao.scale.setScalar(0);
      scene.add(aviao);
    }

    return () => {
      window.removeEventListener("pointermove", onMove);
      palco.destruir();
    };
  }, []);

  return <div ref={host} className="cena3d-host login-mesa3d-host" />;
}
