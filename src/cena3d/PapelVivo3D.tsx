// Carregado sob demanda: o fundo da tela de entrada é uma folha de caderno
// gigante, deitada em perspectiva, que corre devagar na direção de quem olha.
// O mouse puxa o papel para cima (uma tenda) e acende a pauta em menta; o
// clique solta ondas de choque que viajam pelas linhas. Tudo no vertex/fragment
// shader de UM plano: a pauta e a margem são desenhadas com fwidth, sem textura.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { corDoToken, criarPalco, mola } from "./palco";

export type HumorPapel = "idle" | "hello" | "shy" | "peek" | "thinking" | "confused" | "teacher";

const ONDAS = 5;

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uFlow;
  uniform vec2 uMouse;
  uniform float uHover;
  uniform float uLift;
  uniform vec4 uOndas[${ONDAS}];
  varying vec2 vLocal;
  varying vec3 vView;
  varying float vBrilho;
  varying float vAnel;
  varying float vMancha;

  // ruído barato: soma de senos em direções diferentes
  float relevo(vec2 p, float t) {
    float h = sin(p.x * 0.35 + t * 0.6) * cos(p.y * 0.28 - t * 0.4) * 0.38;
    h += sin(p.x * 0.9 - p.y * 0.6 + t * 0.9) * 0.12;
    h += sin(p.y * 1.7 + t * 1.3) * 0.035;
    return h;
  }

  void main() {
    vec3 p = position;
    // a página corre: a pauta e o relevo andam juntos em y
    vec2 folha = vec2(p.x, p.y + uFlow);
    float h = relevo(folha, uTime);

    // a tenda: o papel sobe em volta do ponteiro, com um vinco fino no topo
    float d = distance(p.xy, uMouse);
    float tenda = exp(-d * d / 10.0);
    h += uHover * uLift * tenda * 0.85;

    // ondas de choque dos cliques
    float anel = 0.0;
    float mancha = 0.0;
    for (int i = 0; i < ${ONDAS}; i++) {
      vec4 o = uOndas[i];
      float idade = uTime - o.z;
      if (o.w <= 0.0 || idade < 0.0 || idade > 3.2) continue;
      float raio = idade * 7.5;
      float od = distance(p.xy, o.xy);
      float frente = exp(-pow((od - raio) * 1.1, 2.0)) * exp(-idade * 1.1) * o.w;
      h += frente * 0.5;
      anel = max(anel, frente);
      mancha = max(mancha, (1.0 - smoothstep(raio * 0.55, raio, od)) * exp(-idade * 1.4) * o.w);
    }

    p.z += h;
    vLocal = folha;
    vBrilho = tenda * uHover;
    vAnel = anel;
    vMancha = mancha;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vView = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uPapel;
  uniform vec3 uFundo;
  uniform vec3 uCaneta;
  uniform vec3 uMenta;
  uniform vec3 uMargem;
  uniform float uEscuro;
  varying vec2 vLocal;
  varying vec3 vView;
  varying float vBrilho;
  varying float vAnel;
  varying float vMancha;

  // linha antisserrilhada de espessura "w" pixels numa coordenada
  float linha(float c, float w) {
    float g = abs(fract(c - 0.5) - 0.5) / max(fwidth(c), 1e-4);
    return 1.0 - smoothstep(w - 0.5, w + 0.5, g);
  }

  void main() {
    vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
    vec3 luz = normalize(vec3(-0.4, 0.8, 0.6));
    float difusa = clamp(dot(n, luz), 0.0, 1.0);
    // dobras viradas para a luz clareiam, as de costas escurecem como papel
    vec3 cor = uPapel * (0.8 + 0.24 * difusa);

    // pauta: uma linha a cada 0,9 unidade
    float pauta = linha(vLocal.y / 0.9, 1.1 + vBrilho * 0.5 + vAnel * 0.5);
    vec3 tinta = mix(uCaneta, uMenta, clamp(vBrilho * 0.9 + vAnel * 0.9, 0.0, 1.0));
    cor = mix(cor, tinta, clamp(pauta * (0.36 + vBrilho * 0.35 + vAnel * 0.4), 0.0, 1.0));

    // mancha de tinta azul que se espalha do clique e desbota
    cor = mix(cor, uCaneta, vMancha * 0.16);

    // margem dupla vermelha
    float margem = max(linha((vLocal.x + 9.0) / 60.0, 1.3), linha((vLocal.x + 9.35) / 60.0, 1.0));
    cor = mix(cor, uMargem, margem * 0.55);

    // quadriculado bem fraquinho por baixo, que só aparece na tenda
    float grade = max(linha(vLocal.x / 0.9, 0.7), linha(vLocal.y / 0.9, 0.7));
    cor = mix(cor, uMenta, grade * vBrilho * 0.15);

    // brilho de "papel acetinado" na frente das ondas
    cor += uMenta * vAnel * 0.12;

    // neblina: a folha some no horizonte na cor do fundo da página
    float dist = length(vView);
    float neblina = smoothstep(9.0, 30.0, dist);
    cor = mix(cor, uFundo, neblina);

    // as cores já vêm em sRGB dos tokens: sem conversão, batem com o CSS
    gl_FragColor = vec4(cor, 1.0);
  }
`;

export default function PapelVivo3D({ humor }: { humor: HumorPapel }) {
  const host = useRef<HTMLDivElement | null>(null);
  const humorRef = useRef(humor);
  humorRef.current = humor;

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const ondas = Array.from({ length: ONDAS }, () => new THREE.Vector4(0, 0, -99, 0));
    const uniforms = {
      uTime: { value: 0 },
      uFlow: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 4) },
      uHover: { value: 0 },
      uLift: { value: 1 },
      uOndas: { value: ondas },
      uPapel: { value: new THREE.Color() },
      uFundo: { value: new THREE.Color() },
      uCaneta: { value: new THREE.Color() },
      uMenta: { value: new THREE.Color() },
      uMargem: { value: new THREE.Color() },
      uEscuro: { value: 0 },
    };
    const lerCores = () => {
      uniforms.uPapel.value.copy(corDoToken("--sheet", "#f7f9fc"));
      uniforms.uFundo.value.copy(corDoToken("--paper", "#eef1f6"));
      uniforms.uCaneta.value.copy(corDoToken("--pen", "#2b3bd1"));
      uniforms.uMenta.value.copy(corDoToken("--mint", "#2fd483"));
      uniforms.uMargem.value.copy(corDoToken("--margin-line", "#ff6b6f"));
    };
    lerCores();

    const mouseAlvo = new THREE.Vector2(0, 4);
    const hover = { v: 0, vel: 0 };
    const lift = { v: 1, vel: 0 };
    const fluxo = { v: 1, vel: 0 };
    const camX = { v: 0, vel: 0 };
    let ultimoMovimento = -10;
    let flow = 0;
    let proxima = 0;
    let tempoAtual = 0;
    let ultimoHumor = humorRef.current;

    const palco = criarPalco(
      el,
      (tempo, delta) => {
        tempoAtual = tempo;
        const h = humorRef.current;
        if (h !== ultimoHumor) {
          // a Mine reage e a folha também: oi = uma onda no centro, erro = três
          if (h === "hello") soltarOnda(0, 2.5, 0.8);
          if (h === "confused") [-4, 0, 4].forEach((x, i) => soltarOnda(x, 3, 0.7, i * 0.12));
          ultimoHumor = h;
        }
        const velAlvo = h === "thinking" ? 5 : h === "shy" || h === "peek" ? 0.25 : 1;
        mola(fluxo, velAlvo, delta, 30, 9);
        mola(lift, h === "shy" ? 0.25 : h === "teacher" ? 1.2 : 1, delta, 60, 10);
        const ativo = tempo - ultimoMovimento < 2.5 ? 1 : 0;
        mola(hover, ativo, delta, 40, 9);

        flow += delta * 0.55 * fluxo.v;
        uniforms.uTime.value = tempo * (0.6 + Math.min(fluxo.v, 3) * 0.4);
        uniforms.uFlow.value = flow;
        uniforms.uHover.value = Math.max(0, hover.v);
        uniforms.uLift.value = lift.v;
        uniforms.uMouse.value.lerp(mouseAlvo, Math.min(1, delta * 7));

        // a câmera balança com o ponteiro, sem perder o enquadramento
        mola(camX, palco.pointer.x, delta, 20, 8);
        palco.camera.position.x = camX.v * 1.4;
        palco.camera.position.y = 5.2 - palco.pointer.y * 0.6;
        palco.camera.lookAt(camX.v * 0.5, 0, -4);
      },
      { fov: 42, z: 9 },
    );
    palco.renderer.toneMapping = THREE.NoToneMapping;

    const geo = palco.guardar(new THREE.PlaneGeometry(48, 40, 240, 200));
    const mat = palco.guardar(
      new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms }),
    );
    const folha = new THREE.Mesh(geo, mat);
    folha.rotation.x = -Math.PI / 2;
    folha.position.z = -6;
    palco.scene.add(folha);
    palco.camera.position.set(0, 5.2, 9);
    palco.camera.lookAt(0, 0, -4);

    // ponteiro -> ponto na folha (no plano liso; o relevo é pequeno perto dele)
    const raio = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ponto = new THREE.Vector3();
    const paraFolha = (x: number, y: number) => {
      ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
      raio.setFromCamera(ndc, palco.camera);
      if (!raio.ray.intersectPlane(plano, ponto)) return null;
      return folha.worldToLocal(ponto.clone());
    };

    function soltarOnda(x: number, y: number, forca: number, atraso = 0) {
      ondas[proxima].set(x, y, uniforms.uTime.value + atraso, forca);
      proxima = (proxima + 1) % ONDAS;
    }

    const onMove = (event: PointerEvent) => {
      palco.pointer.alvoX = (event.clientX / window.innerWidth) * 2 - 1;
      palco.pointer.alvoY = -((event.clientY / window.innerHeight) * 2 - 1);
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      const local = paraFolha(event.clientX, event.clientY);
      if (!local) return;
      mouseAlvo.set(local.x, local.y);
      ultimoMovimento = tempoAtual;
    };
    const onDown = (event: PointerEvent) => {
      const local = paraFolha(event.clientX, event.clientY);
      if (local) soltarOnda(local.x, local.y, 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });

    // o tema troca a classe do <html>: a folha troca de cor junto
    const tema = new MutationObserver(lerCores);
    tema.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      tema.disconnect();
      palco.destruir();
    };
  }, []);

  return <div ref={host} className="login-papel3d-host" />;
}
