// Skills do MineCode: guias de front-end, animacao e 3D que entram no prompt
// so quando o pedido precisa deles, para nao pagar tokens em todo "o que e
// uma lista?". Cada skill e texto puro; pickCodeSkills decide quais vao.
//
// Os sites rodam na previa (SitePreview.tsx): iframe sandbox sem
// allow-same-origin e sem allow-modals. Por isso as regras de localStorage em
// try/catch e "sem alert/prompt/confirm" — la eles falham ou nao abrem.

/** Bibliotecas de CDN permitidas, com versao fixa (testadas na previa). */
export const CODE_CDN = {
  three: "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
  threeAddons: "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/",
  gsap: "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js",
  scrollTrigger: "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js",
};

export const FRONTEND_SKILL = `SKILL FRONT-END (sites e paginas):
Direcao visual
- Antes de codar, escolha UMA direcao que combine com o assunto (ex.: site de padaria = tons quentes de pao e creme, tipografia serifada amigavel; site de games = escuro com um neon so; site de ciencias = azul profundo e branco limpo). Nada de gradiente roxo-azul generico em tudo.
- Defina tokens em :root: --bg, --surface, --text, --muted, --accent, --accent-2, --radius, --shadow e uma escala de espaco (4, 8, 12, 16, 24, 32, 48, 64 px). Use as variaveis no resto do CSS.
- Tipografia: no maximo 2 familias. Pode usar Google Fonts com <link> (ex.: "Inter", "Poppins", "Fraunces", "Space Grotesk"). Titulos com font-size: clamp(2rem, 5vw, 3.5rem), line-height 1.1, letter-spacing levemente negativo; texto 1rem a 1.125rem, line-height 1.6, largura maxima ~65ch.
- Contraste de texto legivel (texto escuro em fundo claro ou o contrario, nunca cinza claro em branco).
Layout
- Mobile-first: comeca numa coluna e abre com @media (min-width: 768px). Use CSS Grid para secoes e cards (grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))) e Flexbox para barras. Container com max-width ~1100px e padding lateral de 16 a 24px. Nunca pode haver rolagem horizontal.
- Estrutura semantica: <header> com nav, <main> com <section>s, <footer>. Uma pagina boa tem: hero com titulo forte + subtitulo + botao de acao, 2 a 4 secoes de conteudo real, e rodape.
- Hierarquia clara: um elemento de destaque por secao; respiro generoso entre secoes (64 a 96px no desktop).
Componentes
- Botoes e links com estados :hover, :focus-visible (outline visivel) e :active; cursor: pointer; area de toque minima 44px.
- Cards com borda suave ou sombra leve, raio consistente, e conteudo de verdade.
- Imagens: nada de arquivo externo; desenhe com SVG inline, gradientes, formas CSS ou emoji grande. Icones em SVG inline simples.
- Formularios com <label>, validacao em JS e mensagem de sucesso/erro escrita na pagina.
Conteudo e JS
- Textos reais em portugues do Brasil sobre o tema pedido; nunca lorem ipsum.
- JS com addEventListener e funcoes pequenas. Nada de alert(), prompt() ou confirm() (a previa bloqueia): mostre mensagens num elemento da pagina.
- localStorage so dentro de try/catch (na previa ele lanca erro); a pagina tem que funcionar sem ele.
- Acessibilidade: lang="pt-BR", alt/aria-label onde precisa, ordem de foco natural.`;

export const MOTION_SKILL = `SKILL ANIMACAO:
- Anime so transform e opacity (e filter leve em poucos elementos). Nunca anime width, height, top, left, margin ou box-shadow em loop: trava no celular.
- Tempo: microinteracoes 120-200ms, entradas de elementos 400-700ms, nada acima de 1s sem motivo. Easing de saida suave: cubic-bezier(.2,.8,.2,1); para "mola" use cubic-bezier(.34,1.56,.64,1).
- Entrada ao rolar: IntersectionObserver adiciona .visivel; o CSS faz de opacity:0 + translateY(24px) para o normal. Stagger com transition-delay: calc(var(--i) * 80ms), definindo --i em cada item.
- Hover com vida: botao sobe 2px (translateY(-2px)) e escala 1.02; card inclina pouco ou realça a borda.
- Loops (flutuar, pulsar, girar) com @keyframes e so em 1 ou 2 elementos de destaque.
- Canvas/jogos: requestAnimationFrame com delta de tempo (velocidade * dt), nunca setInterval para animar. Limite particulas (ate ~150 no celular).
- Linhas do tempo, sequencias e animacao ligada a rolagem: pode usar GSAP com <script src="${CODE_CDN.gsap}"></script> e, para rolagem, <script src="${CODE_CDN.scrollTrigger}"></script> + gsap.registerPlugin(ScrollTrigger). Para efeitos simples, CSS puro basta.
- Respeite quem pede menos movimento: @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } } e, no JS, pule animacoes se matchMedia('(prefers-reduced-motion: reduce)').matches.
- Movimento com proposito: guiar o olho, mostrar mudanca de estado ou dar recompensa. Nada piscando sem parar.`;

export const THREE_SKILL = `SKILL 3D (three.js):
- Use three.js por import map (versao fixa, nao troque):
<script type="importmap">{"imports":{"three":"${CODE_CDN.three}","three/addons/":"${CODE_CDN.threeAddons}"}}</script>
<script type="module">
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
</script>
- Esqueleto obrigatorio: Scene, PerspectiveCamera(50 a 60, aspect, 0.1, 1000), WebGLRenderer({ antialias: true }), renderer.setPixelRatio(Math.min(devicePixelRatio, 2)), renderer.setSize(innerWidth, innerHeight), canvas fixo cobrindo a tela (body { margin:0; overflow:hidden }), e um listener de resize que atualiza camera.aspect, camera.updateProjectionMatrix() e renderer.setSize.
- Loop com renderer.setAnimationLoop(animar) e THREE.Clock: movimento = velocidade * clock.getDelta(). Nunca setInterval.
- Luz: AmbientLight ou HemisphereLight fraca + uma DirectionalLight principal. Materiais MeshStandardMaterial (roughness/metalness) ou MeshPhysicalMaterial; MeshBasicMaterial so para coisas que brilham sozinhas (estrelas, sol).
- Sem modelos ou texturas externas: monte os objetos com geometrias (Box, Sphere, Torus, Cylinder, Cone, Icosahedron) agrupadas em THREE.Group; texturas procedurais com CanvasTexture se precisar. Estrelas/particulas com BufferGeometry + Points.
- Cena bonita: cor de fundo ou scene.fog combinando, renderer.toneMapping = THREE.ACESFilmicToneMapping, renderer.outputColorSpace = THREE.SRGBColorSpace. Sombras so se valerem (renderer.shadowMap.enabled e poucas luzes que projetam).
- Interacao: OrbitControls com enableDamping = true (chame controls.update() no loop); clique em objetos com THREE.Raycaster usando as coordenadas normalizadas do ponteiro.
- Interface (titulo, botoes, placar, explicacao) em HTML por cima do canvas, com position: fixed e pointer-events so nos botoes.
- Desempenho: reaproveite geometrias e materiais, ate alguns milhares de objetos com InstancedMesh, geometrias com poucos segmentos (esfera 32x32 basta).
- Se o WebGL falhar (try/catch ao criar o renderer), mostre uma mensagem na pagina em vez de tela preta.`;

// "menu", "tela" e "loja" ficam de fora: em Python sao menu de terminal e
// sistema de loja, e a skill de site empurraria a Mine para HTML.
const HTML_ASK = /\b(site|sites|pagina|paginas|landing|portfolio|html|css|web|layout|formulario|navegador|blog)\b/;
const MOTION_ASK = /\b(anima\w*|animad\w*|movimento\w*|mexe\w*|transic\w*|efeito\w*|scroll|rolagem|parallax|hover|particula\w*|interativ\w*|gsap|jogo\w*|game\w*|bonit\w*|moderno|incrivel|profissional|caprich\w*|dinamic\w*|fluid\w*|suave)\b/;
const THREE_ASK = /\b(3d|tres dimens\w*|three(\.?js)?|webgl|cubo\w*|esfera\w*|planeta\w*|sistema solar|galaxia\w*|universo|espaco sideral|orbita\w*|modelo 3d|cena|mundo 3d|labirinto 3d|carro 3d|piramide\w*)\b/;

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Decide as skills do pedido. Le o pedido, as ultimas falas do estudante e o
 * codigo atual (um arquivo que ja usa three.js continua 3D no "deixa mais
 * rapido").
 */
export function pickCodeSkills({ prompt = "", context = "", history = [] } = {}) {
  const asks = normalize(
    [prompt, ...history.filter((turn) => turn?.role === "user").slice(-3).map((turn) => turn.text ?? turn.content)].join("\n"),
  );
  const ctx = normalize(context);
  const editorHtml = /linguagem aberta no editor: html/.test(ctx);
  const codeHasThree = /from\s+["']three["']|three\.module\.js|new three\./.test(ctx);
  const codeHasMotion = /@keyframes|requestanimationframe|gsap|intersectionobserver/.test(ctx);

  const three = THREE_ASK.test(asks) || codeHasThree;
  const html = three || editorHtml || HTML_ASK.test(asks);
  const motion = html && (three || MOTION_ASK.test(asks) || codeHasMotion);

  const skills = [];
  if (html) skills.push("frontend");
  if (motion) skills.push("motion");
  if (three) skills.push("three");
  return skills;
}

const SKILL_TEXT = { frontend: FRONTEND_SKILL, motion: MOTION_SKILL, three: THREE_SKILL };

/** Texto das skills escolhidas, pronto para entrar no prompt (ou ""). */
export function codeSkillsText(skills) {
  const parts = skills.map((name) => SKILL_TEXT[name]).filter(Boolean);
  if (!parts.length) return "";
  return `Siga as skills abaixo neste pedido. Elas valem mais que o seu habito, mas nunca contra as regras acima.\n\n${parts.join("\n\n")}`;
}
