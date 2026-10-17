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

export const FRONTEND_SKILL = `SKILL FRONT-END (sites e paginas). O padrao e site de estudio de design premiado, nao de template.

1. Escolha UMA direcao de arte abaixo pelo assunto do site (ou a que o estudante pedir) e siga as cores e fontes dela EXATAMENTE. Nao misture direcoes e nao invente paleta. Google Fonts por <link> com display=swap.
- EDITORIAL (portfolio, escrita, historia, escola, receitas): fundo #f3eee4, texto #1b1a17, apagado #6b665c, destaque #e4572e, linhas #1b1a17 a 12%. Fontes "Fraunces" (titulos, peso 600, itálico em uma palavra-chave) + "Inter". Assinatura: titulos enormes de revista, filetes de 1px, secoes numeradas (01, 02...), uma coluna de texto estreita ao lado de uma grande.
- ARCADE NEON (games, musica, tecnologia, eventos): fundo #0b0b10, superficie #15151d, texto #f2f2f5, destaques #c6ff3d e #ff3d8b (so esses dois). Fontes "Space Grotesk" + "JetBrains Mono" para rotulos. Assinatura: grade fina de fundo, rotulos em mono MAIUSCULO, bordas 1px brilhando no hover, numeros grandes.
- NATUREZA (ciencias, biologia, meio ambiente, esportes ao ar livre): fundo #0f2a24, superficie #163a32, texto #eaf4ee, destaque #ffb547, secundaria #7fd1a8. Fontes "Fraunces" + "Manrope". Assinatura: formas organicas em SVG, cantos bem arredondados, ilustracao SVG grande de folha/onda/montanha.
- POP ESCOLAR (criancas, jogos educativos, feiras, clubes): fundo #fff7e0, texto #1d1d1b, blocos #ff6b6b, #4ecdc4, #ffd93d, #5b8def. Fontes "Baloo 2" + "Nunito". Assinatura: contorno preto de 2-3px e sombra deslocada solida (box-shadow: 6px 6px 0 #1d1d1b), cartoes coloridos inclinados de leve.
- ESPACO PREMIUM (astronomia, 3D, fisica, startups): fundo #05060a, superficie rgba(255,255,255,.04), texto #e9ecf5, apagado #8a90a6, destaques #5ce1ff e #ffb86b. Fontes "Sora" + "Inter". Assinatura: vidro (superficie + borda 1px rgba(255,255,255,.08)), brilho radial SO atras do elemento principal, numeros em destaque.
- SUICO MINIMAL (negocios, apresentacao, matematica, dados): fundo #ffffff, texto #111111, apagado #6e6e6e, destaque #0047ff. Fonte "Inter Tight" (pesos 400 e 800). Assinatura: grade rigida de 12 colunas, tipografia gigante, muito branco, um unico bloco de cor forte.
Proibido como identidade principal: gradiente roxo/violeta para azul, fundo azul-marinho com roxo, "glassmorphism" em tudo, emoji como icone de titulo. Se o arquivo atual for so o exemplo inicial do editor (o cartao "Ola, eu sou a Ana"), NAO herde as cores nem o layout dele: comece do zero numa direcao acima (pode manter o nome da pessoa).

2. Composicao do hero (a primeira tela decide tudo)
- Ocupa a tela: min-height: 100svh, conteudo centralizado na vertical. Nunca metade da tela vazia: ou divide em 2 colunas (texto 55% + elemento visual 45%) ou centraliza com o visual grande ATRAS do texto.
- Titulo gigante e curto: font-size: clamp(2.8rem, 7.5vw, 7rem); line-height: .95; letter-spacing: -0.03em; 2 ou 3 linhas no maximo; destaque UMA palavra (cor, italico ou sublinhado desenhado).
- Acima do titulo um rotulo pequeno (ex.: "PORTFOLIO — 2026"); abaixo um subtitulo de 1-2 frases (max 34ch) e 2 botoes (um cheio, um contornado).
- Um elemento visual protagonista e GRANDE (40 a 60% da tela): objeto 3D, ilustracao SVG detalhada, pilha de cartoes inclinados, mockup de celular/janela desenhado em CSS. Formas soltas pequenas espalhadas NAO contam como visual.
- Uma faixa de prova abaixo do hero: 3 numeros grandes com legenda, ou uma fila de selos/tags.

3. Resto da pagina
- Hero + pelo menos 3 secoes, cada uma com layout DIFERENTE: grade de cartoes (com numero ou icone SVG e titulo forte), bloco dividido texto + visual, linha do tempo ou passos numerados, citacao grande, faixa final de chamada (CTA) com fundo de cor de destaque. Feche com rodape simples.
- Container max-width 1200px, padding lateral clamp(16px, 4vw, 48px), espaco entre secoes clamp(72px, 10vw, 140px). Mobile-first; nunca rolagem horizontal.
- Tokens em :root (--bg, --surface, --text, --muted, --accent, --accent-2, --radius, --line) e use so eles.
- Detalhes que mostram capricho: ::selection com a cor de destaque, rotulos de secao numerados, filetes 1px, um grao sutil (SVG feTurbulence com opacity .05 sobre o fundo) nas direcoes escuras, transicoes de hover em tudo que e clicavel, :focus-visible visivel.
- Imagens: nada de arquivo externo. Desenhe com SVG inline (ilustracoes com varias formas e cores da paleta), CSS ou canvas. Icones em SVG de traco simples.

4. Conteudo e JS
- Textos reais, especificos e com personalidade em portugues do Brasil sobre o tema; nunca lorem ipsum nem frases vazias ("bem-vindo ao meu site").
- JS com addEventListener e funcoes pequenas. Nada de alert(), prompt() ou confirm() (a previa bloqueia): mostre mensagens na pagina. Formularios com <label> e validacao em JS.
- localStorage so dentro de try/catch (na previa ele lanca erro).
- Acessibilidade: lang="pt-BR", contraste forte, alt/aria-label onde precisa.

5. Antes de entregar, confira: a direcao esta aplicada com as cores e fontes certas? O hero enche a tela e tem um visual protagonista grande? Ha 3+ secoes com layouts diferentes? Nada de roxo-azul generico? Funciona em 375px de largura? Se algo falhar, corrija antes de responder.`;

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
- Se o WebGL falhar (try/catch ao criar o renderer), mostre uma mensagem na pagina em vez de tela preta.
- Direcao de cena: o 3D e o protagonista, nao enfeite. Um objeto principal bem modelado (varias pecas agrupadas, ex.: planeta com aneis e luas, cristal facetado com Icosahedron detail 0 + flatShading, escultura de toros entrelacados, terreno de ondas com PlaneGeometry deformada) ocupando 40 a 60% da tela, enquadrado pela camera. Nada de 3 ou 4 formas pequenas soltas.
- Como fundo de hero: canvas position fixed atras do conteudo; no desktop, desloque o objeto para o lado oposto ao texto (ex.: objeto.position.x = 2.2) e no celular centralize atras com opacidade menor. O texto precisa de contraste: um degradê do --bg para transparente por cima do canvas do lado do texto.
- Cores e luz vindas da direcao de arte do site (destaques como cor das luzes ou emissive). Iluminacao de estudio: uma luz principal, uma de contorno colorida atras do objeto (rim light) e ambiente fraco.
- Vida: rotacao lenta, flutuacao com Math.sin(tempo) e paralaxe leve seguindo o ponteiro (lerp da rotacao ate a posicao do mouse). Movimento suave e continuo, nada de giro rapido.`;

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
