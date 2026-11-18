/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * A Mine andando pelo site.
 *
 * Porte do motor da apresentação do TCC (apresentacao-tcc/minerva-tcc.html,
 * makeCrew) para a janela de verdade: as coordenadas são as da viewport, as
 * plataformas são o topo dos cards e títulos visíveis da aba atual
 * (getBoundingClientRect) e o chão é a base da janela. Só a Mine (Bia e Theo
 * ficaram na apresentação), com brincadeiras com quem está usando:
 * arrastar e arremessar (cai tonta se a queda for forte), carinho esfregando o
 * mouse, três cliques seguidos deixam tonta, cursor parado em cima de um card
 * faz ela ir até lá e apontar, e cursor passando rápido perto faz ela pular
 * para pegar.
 *
 * Custo: um único requestAnimationFrame, varredura de plataformas a cada
 * ~400 ms (no máximo), parado com a aba do navegador oculta, com diálogo
 * aberto ou em tela estreita. Nada de three.js e nada de mexer no texto que o
 * React controla.
 */

import { abaDe, type Truque } from "./abas";

export type PetsHandle = { destroy(): void };

type Plat = { x1: number; x2: number; y: number; h: number; el: Element | null; kind: "floor" | "card" | "title" };

const INK = "#16181D";
const K = 74 / 120; // escala do desenho (viewBox 120x140) para a tela
const W = 74, H = 87, GR = 2100, SPEED = 125;
const TOP_SAFE = 104; // altura do cabeçalho fixo: ninguém sobe atrás dele
const SCAN_MS = 400;
const IDLE_FOLLOW_MS = 2000;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pick = <T,>(a: T[]): T => a[(Math.random() * a.length) | 0];

const PLAT_SEL = [
  "article",
  ".studio-card",
  ".hero-card",
  "[class*='-card']",
  "[class*='cartao']",
  "[class*='celula']",
  "section",
  "aside",
  "[class*='caderno-']",
  // cards montados só com utilitários do Tailwind (borda + canto arredondado)
  "[class*='rounded'][class*='border']",
  "h1",
  "h2",
].join(",");
const INTERACTIVE = "button,a[href],input,textarea,select,label,[role=button],[role=tab],[contenteditable=''],[contenteditable=true]";

const FALAS = ["bora estudar!", "isso cai na prova!", "+10 XP", "olha isso!", "anota aí!", "tô de olho", "uhuul!", "foco, hein!", "me faz carinho?", "me arrasta!"];
const SEGUIR = ["oi! cheguei!", "tô aqui!", "me chamou?", "achei você!"];
const APONTA = ["olha esse aqui!", "esse é bom!", "bora nesse?", "achei!"];
const OI = ["oi!", "cheguei!", "bora estudar?"];
const CLIQUE = ["oi!", "sou a Mine!", "wiii!", "hihi!"];
const ACTS: Record<string, { d: [number, number]; f: string[] }> = {
  read: { d: [4.5, 6], f: ["hmm, interessante", "lendo o resumo", "esse livro é bom!"] },
  write: { d: [4, 5.5], f: ["anotando...", "isso vai pra prova", "resumo pronto!"] },
  phone: { d: [4, 5.5], f: ["postando no grupo", "olha esse meme", "avisando a turma"] },
  coffee: { d: [4.5, 6], f: ["cafezinho!", "pausa rápida"] },
  music: { d: [4, 5.5], f: ["♪ ♫", "estudando com música"] },
  magnify: { d: [3.5, 4.5], f: ["deixa eu ver...", "hmm, que detalhe!"] },
  sleep: { d: [6, 8], f: ["zzz...", "só um cochilo"] },
  dance: { d: [4, 5.5], f: ["dancinha!", "uhuul!", "olha o passinho!"] },
};

type Cast = { id: string; top: string; bot: string; glow: string; ball: string; hat: "cap" | "bow" | "beanie"; tag: string };
const MINE: Cast = { id: "mine", top: "#63FFB6", bot: "#1FBF74", glow: "#6BFFC0", ball: "#39F59A", hat: "cap", tag: "#1FBF74" };

function svgFor(c: Cast) {
  const G = c.glow, id = "mp-" + c.id;
  const hat =
    c.hat === "cap"
      ? `<rect x="41" y="27" width="38" height="10" rx="2" fill="${INK}"/><path d="M41 33 L60 38 L79 33" stroke="${c.ball}" stroke-width="3" fill="none"/><path d="M12 28 L60 12 L108 28 L60 43 Z" fill="#1D2233" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M30 25 L60 15" stroke="#3E4870" stroke-width="2.4" stroke-linecap="round"/><circle cx="60" cy="27" r="3.2" fill="${c.ball}"/><g class="tassel"><path d="M60 27 L101 28 L101 44" stroke="${c.ball}" stroke-width="2.6" fill="none" stroke-linejoin="round"/><path d="M97 44 h8 l2 11 h-12 z" fill="${c.ball}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/></g><g class="ant"><path d="M60 13 V1" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="60" cy="-3" r="6.5" fill="${c.ball}" stroke="${INK}" stroke-width="2.6"/><circle cx="58" cy="-5" r="1.8" fill="#fff"/></g>`
      : c.hat === "bow"
        ? `<g class="ant"><path d="M60 31 V17" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M60 19 c-7 -9 -16 -1 -8 6 l8 7 l8 -7 c8 -7 -1 -15 -8 -6 z" fill="${c.ball}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="56" cy="14" r="1.8" fill="#fff"/></g><g class="tassel"><path d="M88 33 L71 21 L73 44 Z" fill="#FF6F9A" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M88 33 L105 21 L103 44 Z" fill="#FF6F9A" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M76 27 l5 4 M100 27 l-5 4" stroke="#fff" stroke-width="1.8" opacity=".6" stroke-linecap="round"/><circle cx="88" cy="33" r="5.5" fill="#FFB3C1" stroke="${INK}" stroke-width="2.4"/></g>`
        : `<path d="M21 38 Q60 -4 99 38 Z" fill="#F4E04D" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M36 22 q8 -6 16 -8" stroke="#fff" stroke-width="3" opacity=".6" fill="none" stroke-linecap="round"/><rect x="19" y="32" width="82" height="10" rx="5" fill="#E0B52A" stroke="${INK}" stroke-width="2.6"/><g class="ant"><path d="M60 18 V5" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><g class="blades"><ellipse cx="60" cy="4" rx="17" ry="4.2" fill="#FF8FA8" stroke="${INK}" stroke-width="2.2"/></g><circle cx="60" cy="4" r="3.2" fill="#39F59A" stroke="${INK}" stroke-width="1.8"/></g>`;
  const glasses = c.hat === "beanie" ? `<g opacity=".9"><circle cx="45.5" cy="57" r="10" fill="none" stroke="#fff" stroke-width="2.4"/><circle cx="74.5" cy="57" r="10" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M55.5 57 h9" stroke="#fff" stroke-width="2.4"/></g>` : "";
  return `<svg viewBox="0 0 120 140" aria-hidden="true">
<defs>
<linearGradient id="hd-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#D7DFEE"/></linearGradient>
<linearGradient id="bd-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.top}"/><stop offset="1" stop-color="${c.bot}"/></linearGradient>
<radialGradient id="sc-${id}" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#26315A"/><stop offset="1" stop-color="#121830"/></radialGradient>
</defs>
<g class="legL"><rect x="43" y="100" width="11" height="28" rx="5.5" fill="#262D44" stroke="${INK}" stroke-width="2.5"/><path d="M36 136 C36 128 42 126 49 126 C56 126 60 129 60 134 C60 137 58 139 55 139 L40 139 C37 139 36 138 36 136 Z" fill="${INK}"/></g>
<g class="legR"><rect x="66" y="100" width="11" height="28" rx="5.5" fill="#262D44" stroke="${INK}" stroke-width="2.5"/><path d="M60 136 C60 128 66 126 73 126 C80 126 84 129 84 134 C84 137 82 139 79 139 L64 139 C61 139 60 138 60 136 Z" fill="${INK}"/></g>
<g class="torso">
<rect x="35" y="78" width="50" height="32" rx="15" fill="url(#bd-${id})" stroke="${INK}" stroke-width="3.5"/>
<path d="M48 87 L60 91 L72 87 L72 101 L60 105 L48 101 Z" fill="#fff" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M60 91 V105" stroke="${INK}" stroke-width="2.2"/>
<g class="p p-book"><path d="M34 95 L60 100 L86 95 L86 118 L60 123 L34 118 Z" fill="#3141D9" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M37 94 L60 98.5 L60 120 L37 115.5 Z" fill="#FFFDF3" stroke="${INK}" stroke-width="2"/><path d="M41 101 l15 3 M41 106 l15 3 M41 111 l11 2" stroke="#9AA3B6" stroke-width="1.6"/><g class="p-page"><path d="M60 98.5 L83 94 L83 115.5 L60 120 Z" fill="#FFFDF3" stroke="${INK}" stroke-width="2"/><path d="M64 103 l15 -3 M64 108 l15 -3 M64 113 l11 -2" stroke="#9AA3B6" stroke-width="1.6"/></g></g>
<g class="armL"><rect x="25" y="84" width="12" height="25" rx="6" fill="url(#bd-${id})" stroke="${INK}" stroke-width="3"/><g class="p p-pad"><g transform="rotate(40 31 111)"><rect x="18" y="103" width="28" height="32" rx="3" fill="#FFFDF3" stroke="${INK}" stroke-width="2.4"/><path d="M18 108 h28" stroke="#E5484D" stroke-width="1.4"/><path class="p-scr" d="M22 114 h18 M22 120 q4 -4 8 0 t8 0 M22 126 h14 M22 131 h9" stroke="#1D2BB8" stroke-width="2" fill="none" stroke-linecap="round" stroke-dasharray="80" stroke-dashoffset="80"/></g></g><circle cx="31" cy="111" r="7" fill="#fff" stroke="${INK}" stroke-width="3"/></g>
<g class="armR"><rect x="83" y="84" width="12" height="25" rx="6" fill="url(#bd-${id})" stroke="${INK}" stroke-width="3"/><g class="p p-pencil"><g transform="rotate(-30 89 111)"><rect x="86" y="92" width="7" height="24" rx="1.5" fill="#F6C945" stroke="${INK}" stroke-width="1.8"/><path d="M86 116 l3.5 8 l3.5 -8 z" fill="#EBC89A" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><rect x="86" y="88" width="7" height="5" fill="#FF9DB0" stroke="${INK}" stroke-width="1.5"/></g></g>
<g class="p p-phone"><g transform="rotate(-55 89 111) translate(89 111) scale(1.35) translate(-89 -111)"><rect x="80" y="96" width="18" height="30" rx="4.5" fill="#1D2233" stroke="${INK}" stroke-width="2.4"/><rect class="p-scrn" x="83" y="100" width="12" height="21" rx="2" fill="#6BFFC0"/><rect x="85" y="113" width="8" height="5" rx="1.5" fill="#FF9DB0" opacity=".9"/></g></g>
<g class="p p-mug"><rect x="79" y="104" width="18" height="18" rx="3.5" fill="#FF9DB0" stroke="${INK}" stroke-width="2.4"/><path d="M97 108 q7 0 7 5 q0 5 -7 5" fill="none" stroke="${INK}" stroke-width="2.4"/><rect x="79" y="104" width="18" height="5" rx="2" fill="#7A4A2E" opacity=".8"/><g class="p-steam"><path d="M84 99 q-3 -4 0 -8 q3 -4 0 -8 M91 99 q-3 -4 0 -8 q3 -4 0 -8" stroke="#C8D2E6" stroke-width="2.2" fill="none" stroke-linecap="round"/></g></g>
<circle cx="89" cy="111" r="7" fill="#fff" stroke="${INK}" stroke-width="3"/></g>
<g class="head">
<rect x="11" y="44" width="13" height="23" rx="6.5" fill="url(#bd-${id})" stroke="${INK}" stroke-width="3"/>
<rect x="96" y="44" width="13" height="23" rx="6.5" fill="url(#bd-${id})" stroke="${INK}" stroke-width="3"/>
<rect x="19" y="30" width="82" height="56" rx="25" fill="url(#hd-${id})" stroke="${INK}" stroke-width="4"/>
<path d="M30 44 q5 -9 19 -10" stroke="#fff" stroke-width="4.5" fill="none" stroke-linecap="round"/>
<rect x="28" y="40" width="64" height="38" rx="15" fill="url(#sc-${id})" stroke="${INK}" stroke-width="3"/>
<g class="look">
<g class="f f-smile"><rect x="41" y="51" width="9" height="12" rx="4.5" fill="${G}"/><rect x="70" y="51" width="9" height="12" rx="4.5" fill="${G}"/><path d="M52 67 q8 6 16 0" stroke="${G}" stroke-width="3" fill="none" stroke-linecap="round"/></g>
<g class="f f-blink"><path d="M40 58 h11 M69 58 h11" stroke="${G}" stroke-width="3" stroke-linecap="round"/><path d="M52 67 q8 6 16 0" stroke="${G}" stroke-width="3" fill="none" stroke-linecap="round"/></g>
<g class="f f-happy"><path d="M39 60 q6 -9 12 0 M69 60 q6 -9 12 0" stroke="${G}" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M51 66 q9 8 18 0" stroke="${G}" stroke-width="3" fill="none" stroke-linecap="round"/></g>
<g class="f f-laugh"><path d="M39 54 l9 4.5 l-9 4.5 M81 54 l-9 4.5 l9 4.5" stroke="${G}" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M50 65 h20 q-2 10 -10 10 q-8 0 -10 -10 z" fill="${G}"/></g>
<g class="f f-o"><circle cx="45" cy="57" r="6" fill="${G}"/><circle cx="75" cy="57" r="6" fill="${G}"/><circle cx="60" cy="69" r="4" fill="none" stroke="${G}" stroke-width="3"/></g>
<g class="f f-sly"><path d="M40 56 h11 M69 58 q6 -7 11 0" stroke="${G}" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M52 68 q10 4 16 -3" stroke="${G}" stroke-width="3" fill="none" stroke-linecap="round"/></g>
<g class="f f-angry"><path d="M38 48 l13 5 M82 48 l-13 5" stroke="#FF6B6F" stroke-width="3.4" stroke-linecap="round"/><rect x="41" y="55" width="9" height="8" rx="3" fill="${G}"/><rect x="70" y="55" width="9" height="8" rx="3" fill="${G}"/><path d="M51 72 q9 -7 18 0" stroke="${G}" stroke-width="3" fill="none" stroke-linecap="round"/></g>
<g class="f f-sad"><path d="M39 56 q6 6 12 0 M69 56 q6 6 12 0" stroke="${G}" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M52 71 q8 -6 16 0" stroke="${G}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M83 62 q2 5 0 7 q-2 -2 0 -7z" fill="#8EC5FF"/></g>
<g class="f f-dizzy"><path d="M45.5 57 m-5 0 a5 5 0 1 0 5 -5 a3.2 3.2 0 1 0 2 4 M74.5 57 m-5 0 a5 5 0 1 0 5 -5 a3.2 3.2 0 1 0 2 4" stroke="${G}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M50 70 q3 -3 5 0 t5 0 t5 0 t5 0" stroke="${G}" stroke-width="2.8" fill="none" stroke-linecap="round"/></g>
</g>
${glasses}
<circle cx="30" cy="80" r="4" fill="#FF9DB0" opacity=".75"/><circle cx="90" cy="80" r="4" fill="#FF9DB0" opacity=".75"/>
<g class="p p-hph"><path d="M15 52 Q60 -6 105 52" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M15 52 Q60 -6 105 52" stroke="#C9BCFF" stroke-width="2.6" fill="none" stroke-linecap="round"/><rect x="4" y="41" width="17" height="29" rx="8" fill="#9682F0" stroke="${INK}" stroke-width="3"/><rect x="99" y="41" width="17" height="29" rx="8" fill="#9682F0" stroke="${INK}" stroke-width="3"/></g>
${hat}
<g class="p p-mag"><path d="M84 67 L99 84" stroke="#8B5E3C" stroke-width="5.5" stroke-linecap="round"/><circle cx="75" cy="57" r="13" fill="rgba(200,230,255,.38)" stroke="${INK}" stroke-width="3.2"/></g>
</g></svg>`;
}

export function startPets(): PetsHandle {
  const layer = document.createElement("div");
  layer.className = "mpets";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);

  const FLOOR: Plat = { x1: 40, x2: innerWidth - 40, y: innerHeight - 4, h: 0, el: null, kind: "floor" };
  const same = (a: Plat | null | undefined, b: Plat | null | undefined) => !!a && !!b && (a === b || (!!a.el && a.el === b.el));
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const t = window.setTimeout(() => { timers.delete(t); fn(); }, ms);
    timers.add(t);
    return t;
  };

  /* ---------- mundo: plataformas da aba atual ---------- */
  const world = { plats: [FLOOR] as Plat[], t: -1e9 };
  // Paredes do pulo (a janela) são mais largas que o chão "andável", que
  // deixa livre o canto da Mine flutuante.
  const WALL = { x1: 20, x2: innerWidth - 24 };
  function updateFloor() {
    const main = document.querySelector("main");
    const r = main?.getBoundingClientRect();
    FLOOR.x1 = Math.max(30, (r ? r.left : 0) + 30);
    // o canto direito de baixo é da Mine flutuante e do timer de foco
    FLOOR.x2 = Math.min(innerWidth - 130, (r ? r.right : innerWidth) - 30);
    FLOOR.y = innerHeight - 4;
    WALL.x1 = FLOOR.x1 - 10;
    WALL.x2 = innerWidth - 24;
  }
  function scanWorld(now: number, force?: boolean) {
    if (!force && now - world.t < SCAN_MS) return false;
    world.t = now;
    updateFloor();
    const root = document.querySelector("main [data-page-layer]") || document.querySelector("main");
    const out: Plat[] = [FLOOR];
    if (root) {
      const els = root.querySelectorAll(PLAT_SEL);
      const n = Math.min(els.length, 400);
      for (let i = 0; i < n; i++) {
        const e = els[i];
        const r = e.getBoundingClientRect();
        if (r.width < 110 || r.height < 30) continue;
        if (e.matches(INTERACTIVE)) continue; // botão não é chão
        const title = e.tagName === "H1" || e.tagName === "H2";
        if (!title && r.height < 56) continue;
        if (r.top < TOP_SAFE + H * 0.6 || r.top > FLOOR.y - 40) continue;
        if (r.right < FLOOR.x1 || r.left > FLOOR.x2) continue;
        let x1 = r.left + 8, x2 = r.right - 8;
        if (title) {
          // título ocupa a linha toda; a plataforma é só o texto
          const range = document.createRange();
          range.selectNodeContents(e);
          const tr = range.getBoundingClientRect();
          if (tr.width < 60) continue;
          x1 = tr.left + 2; x2 = tr.right - 2;
        }
        const y = title ? r.top + 2 : r.top;
        // cards aninhados no mesmo topo viram uma plataforma só
        if (out.some((p) => Math.abs(p.y - y) < 10 && p.x1 < x2 && x1 < p.x2)) continue;
        out.push({ x1, x2, y, h: r.height, el: e, kind: title ? "title" : "card" });
        if (out.length > 40) break;
      }
    }
    world.plats = out;
    return true;
  }
  const findP = (p: Plat) => (p === FLOOR ? FLOOR : world.plats.find((q) => same(q, p)));

  const mouse = { x: innerWidth / 2, y: innerHeight / 2, t: 0, speed: 0, moved: 0, inside: false, follow: false };

  /* ---------- a Mine ---------- */
  const c = MINE;
  const el = document.createElement("div");
  el.className = "mpet gone";
  el.dataset.who = c.id;
  el.innerHTML = svgFor(c) + '<div class="mpet-say"></div>';
  const sh = document.createElement("div");
  sh.className = "mpet-sh gone";
  layer.appendChild(sh);
  layer.appendChild(el);
  const svg = el.querySelector("svg") as SVGSVGElement;
  const sayEl = el.querySelector(".mpet-say") as HTMLDivElement;
  sayEl.style.borderColor = c.tag;
  const q = (k: string) => svg.querySelector(k) as SVGElement | null;
  const PG = { page: q(".p-page"), scr: q(".p-scr"), scrn: q(".p-scrn"), steam: q(".p-steam") };
  const P = { legL: q(".legL"), legR: q(".legR"), armL: q(".armL"), armR: q(".armR"), torso: q(".torso"), head: q(".head"), ant: q(".ant"), tassel: q(".tassel"), look: q(".look") };
  const S: any = {
    x: 300, y: -200, vx: 0, vy: 0, on: null as Plat | null, face: 1, state: "off", t: 0, tx: 0, target: null, vis: false, sq: 1, talk: 8, ph: 0, fs: 1, turnT: 0,
    act: null, actT: 0, lastAct: "", sitY: 0, fxT: 0, lk: null, ant: 0, antV: 0, tas: 0, tasV: 0, expr: "smile", exprT: 0, blinkT: rnd(1, 4),
    clock: rnd(0, 9), look: 0, pose: null, lean: 0, tumble: 0, spinA: 0, talking: 0, lookAt: null, greeted: false, ghost: false,
    thrown: false, held: false, forceDizzy: false, catching: false, catchBest: 1e9, catchCD: 0, rub: 0, rubDir: 0, dizzyStars: [] as HTMLElement[],
  };
  let sayT = 0;

  function say(txt: string, dur?: number) {
    sayEl.textContent = txt;
    sayEl.classList.add("on");
    S.talking = dur || 2.3;
    clearTimeout(sayT);
    timers.delete(sayT);
    sayT = later(() => sayEl.classList.remove("on"), (dur || 2.3) * 1000);
  }
  function emote(e: string, t: number) { S.expr = e; S.exprT = t; }

  function hit(p: Plat, imp: number) {
    if (p.kind === "floor" || !p.el || imp < 0.25) return;
    const d = (1.5 + 5 * imp).toFixed(1);
    (p.el as HTMLElement).animate([{ translate: "0 0" }, { translate: `0 ${d}px` }, { translate: "0 -1px" }, { translate: "0 0" }], { duration: 520, easing: "ease-out" });
  }
  function puff(imp: number) {
    const n = 3 + Math.round(imp * 4);
    for (let i = 0; i < n; i++) {
      const d = document.createElement("i");
      d.className = "mpet-puff";
      d.style.left = S.x + "px";
      d.style.top = S.y - 3 + "px";
      layer.appendChild(d);
      const dir = i % 2 ? 1 : -1, sz = 0.5 + Math.random() * 0.8;
      d.animate([{ transform: `translate(0,0) scale(${sz})`, opacity: 0.95 }, { transform: `translate(${dir * rnd(15, 44)}px,${-rnd(5, 18)}px) scale(${sz * 1.7})`, opacity: 0 }], { duration: 520, easing: "ease-out" }).onfinish = () => d.remove();
    }
  }
  function floaty(txt: string, color?: string) {
    const d = document.createElement("span");
    d.className = "mpet-fx";
    d.textContent = txt;
    if (color) d.style.color = color;
    const x = S.x + rnd(-6, 18) * Math.sign(S.fs || 1), y = S.y - H - 6 + S.sitY;
    layer.appendChild(d);
    d.animate([
      { transform: `translate(${x}px,${y}px) scale(.6)`, opacity: 0 },
      { transform: `translate(${x + rnd(-6, 12)}px,${y - 25}px) scale(1)`, opacity: 1, offset: 0.25 },
      { transform: `translate(${x + rnd(-20, 25)}px,${y - 75}px) scale(1.15) rotate(${rnd(-20, 20)}deg)`, opacity: 0 },
    ], { duration: 1700, easing: "ease-out" }).onfinish = () => d.remove();
  }
  function sparkle(x: number, y: number) {
    for (let i = 0; i < 8; i++) {
      const d = document.createElement("span");
      d.className = "mpet-fx";
      d.textContent = "✦";
      d.style.color = pick(["#F4E04D", "#39F59A", "#FF8FA8", "#9682F0"]);
      layer.appendChild(d);
      const ang = (i / 8) * Math.PI * 2;
      d.animate([{ transform: `translate(${x}px,${y}px) scale(.4)`, opacity: 1 }, { transform: `translate(${x + Math.cos(ang) * 50}px,${y + Math.sin(ang) * 40}px) scale(1.1)`, opacity: 0 }], { duration: 650, easing: "ease-out" }).onfinish = () => d.remove();
    }
  }

  /* atividades */
  function startAct(name: string) {
    S.state = "act"; S.act = name; S.actT = 0; S.fxT = 0; S.lastAct = name;
    const a = ACTS[name]; S.t = rnd(a.d[0], a.d[1]);
    el.dataset.p = name;
    if (Math.random() < 0.6) say(pick(a.f));
  }
  function endAct() {
    if (S.trick) { S.trick = null; S.lk = null; el.dataset.p = ""; if (S.state === "trick") { S.state = "idle"; S.t = rnd(0.4, 1); } }
    if (!S.act) return;
    S.act = null; S.lk = null; el.dataset.p = "";
    if (S.state === "act") { S.state = "idle"; S.t = rnd(0.4, 1); }
  }
  function setPose(name: string, dur: number) { if (S.act) endAct(); S.state = "pose"; S.pose = name; S.t = dur; S.fxT = 0; }
  function interrupt() { endAct(); S.trick = null; S.lk = null; S.pose = null; S.target = null; S.catching = false; }

  /* tontura: estrelinhas girando em volta da cabeça */
  function startDizzy(dur?: number) {
    interrupt();
    S.state = "dizzy"; S.t = dur || 2.6; S.fxT = 0;
    emote("dizzy", S.t);
    if (!S.dizzyStars.length) {
      for (let i = 0; i < 3; i++) {
        const d = document.createElement("span");
        d.className = "mpet-fx mpet-star";
        d.textContent = "★";
        d.style.color = ["#F4E04D", "#FF8FA8", "#9682F0"][i];
        layer.appendChild(d);
        S.dizzyStars.push(d);
      }
    }
    say(pick(["tô tonta...", "o mundo tá girando", "uou... estrelinhas", "nunca mais!"]), 2);
  }
  function endDizzy() {
    S.dizzyStars.forEach((d: HTMLElement) => d.remove());
    S.dizzyStars = [];
  }

  function actPose(T: number) {
    const o: any = { lL: 0, lR: 0, aL: 10, aR: -10, bob: -1 - Math.sin(T * 2), hd: 0, shake: 0, face: "smile", lk: null, sit: 0 }, t = S.actT;
    switch (S.act) {
      case "read": {
        o.aL = -58; o.aR = 58; o.lk = [Math.sin(T * 2.4) * 2.8, 2.4]; o.hd = Math.sin(T * 0.9) * 2;
        const ph = (t % 2.6) / 2.6, k = ph < 0.75 ? 1 : Math.cos(((ph - 0.75) / 0.25) * Math.PI);
        PG.page?.setAttribute("transform", `translate(60 0) scale(${k.toFixed(3)} 1) translate(-60 0)`);
        if (ph > 0.75 && ph < 0.8) o.face = "happy";
        break;
      }
      case "write":
        o.aL = -48; o.aR = 34 + Math.sin(T * 17) * 8; o.lk = [-2.4, 2.6]; o.hd = -3;
        if (PG.scr) PG.scr.style.strokeDashoffset = Math.max(0, 80 - ((t * 22) % 95)).toFixed(1);
        break;
      case "phone":
        o.aR = 55; o.aL = -50 + Math.sin(T * 24) * 4; o.lk = [-0.5, 2.8]; o.hd = -4;
        PG.scrn?.setAttribute("fill", Math.sin(T * 3) > 0.6 ? "#C9BCFF" : "#6BFFC0");
        if (t % 3.2 > 2.4) { o.face = "laugh"; o.shake = Math.sin(T * 45) * 1.4; o.hd = Math.sin(T * 18) * 5; }
        break;
      case "coffee": {
        const k = t % 3.2;
        if (k < 1.8) o.aR = 40; else { o.aR = 86; o.face = "happy"; o.hd = -6; o.lk = [1, 1.5]; }
        PG.steam?.setAttribute("transform", `translate(0 ${(-(t * 10) % 8).toFixed(1)})`);
        if (PG.steam) PG.steam.style.opacity = k < 1.8 ? "1" : "0";
        break;
      }
      case "music": { const s1 = Math.sin(T * 8); o.aL = 20 + s1 * 16; o.aR = -20 - s1 * 16; o.hd = s1 * 9; o.bob = -Math.abs(s1) * 5; o.face = "happy"; o.lL = s1 * 8; o.lR = s1 * 8; break; }
      case "magnify": o.aR = 96 + Math.sin(T * 1.6) * 5; o.aL = 12; o.face = "o"; o.lk = [2.8, -1.5]; o.hd = Math.sin(T * 1.3) * 3; break;
      case "sleep": o.sit = 27 * K; o.lL = -84; o.lR = -78; o.aL = -14; o.aR = 14; o.hd = -9 + Math.sin(T * 1.6) * 1.5; o.face = "blink"; o.bob = Math.sin(T * 1.6) * 1.2; break;
      case "dance": {
        const seg = Math.floor(t / 1.5) % 3, s2 = Math.sin(T * 7.5);
        if (seg === 0) { o.aL = s2 > 0 ? 160 : 20; o.aR = s2 < 0 ? -160 : -20; o.lL = s2 * 14; o.lR = s2 * 14; o.bob = -Math.abs(s2) * 6; o.hd = s2 * 9; o.face = "happy"; }
        else if (seg === 1) { S.face = Math.floor(t * 3.2) % 2 ? 1 : -1; o.aL = 150; o.aR = -150; o.bob = -Math.abs(Math.sin(T * 6.4)) * 12; o.face = "laugh"; o.lL = -15; o.lR = 20; }
        else { const k = Math.floor(t * 4) % 2; o.aL = k ? 95 : -10; o.aR = k ? 10 : -95; o.lL = k ? 18 : 0; o.lR = k ? 0 : -18; o.hd = k ? 7 : -7; o.face = "sly"; }
        break;
      }
    }
    return o;
  }
  function posePose(T: number) {
    const o: any = { lL: 0, lR: 0, aL: 10, aR: -10, bob: -1 - Math.sin(T * 2), hd: 0, shake: 0, sit: 0, lean: 0 };
    switch (S.pose) {
      case "point": o.aR = -92; o.aL = 12; o.hd = 3; break;
      case "pointDown": o.aR = -48 + Math.sin(T * 7) * 6; o.aL = 14; o.hd = 7; o.lean = 5; break;
      case "laugh": o.aL = -35; o.aR = 35; o.shake = Math.sin(T * 45) * 1.6; o.hd = Math.sin(T * 18) * 7; o.bob = -Math.abs(Math.sin(T * 22)) * 3; break;
      case "cheer": o.aL = 160; o.aR = -160; o.bob = -Math.abs(Math.sin(T * 9)) * 9; break;
      case "sad": o.aL = -6; o.aR = 6; o.hd = -8; o.bob = 2; break;
      case "wave": o.aL = 12; o.aR = -155 + Math.sin(T * 15) * 24; o.hd = Math.sin(T * 4) * 5; break;
    }
    return o;
  }

  /* ---------- truques: um por aba (roteiro em abas.ts) ---------- */
  type Pose = { lL: number; lR: number; aL: number; aR: number; bob: number; hd: number; shake: number; sit: number; lean: number; face: string; lk: number[] | null };
  type Tr = { d: number; p?: string; fx?: number; fala?: string[]; fim?: () => string | null; pose: (o: Pose, T: number, t: number) => void; tick?: (k: number) => void; inicio?: () => boolean };
  const VERDE = "#1FBF74", TINTA = "#1D2BB8", OURO = "#E0A800";
  const writing = (o: Pose, T: number) => { o.aL = -48; o.aR = 34 + Math.sin(T * 17) * 8; o.lk = [-2.4, 2.6]; o.hd = -3; };
  const waving = (o: Pose, T: number) => { o.aR = -155 + Math.sin(T * 15) * 24; o.hd = Math.sin(T * 4) * 5; o.face = "happy"; };
  const cheering = (o: Pose, T: number) => { o.aL = 160; o.aR = -160; o.bob = -Math.abs(Math.sin(T * 9)) * 9; };
  const isDay = () => { const h = new Date().getHours(); return h >= 6 && h < 18; };
  const TRUQUES: Record<Truque, Tr> = {
    // Início: acena para o sol (ou a lua, de noite)
    sol: {
      d: 2.6, fx: 0.5,
      pose: (o, T) => waving(o, T),
      tick: () => floaty(isDay() ? "☀" : "☾", isDay() ? "#F4B400" : "#9682F0"),
      inicio: () => { const h = new Date().getHours(); say(h < 12 ? "bom dia, sol!" : h < 18 ? "boa tarde!" : "boa noite, lua!", 1.8); return true; },
    },
    // Agenda: risca tarefas no bloquinho
    riscar: {
      d: 4, p: "write", fx: 0.55, fala: ["riscando as feitas...", "essa já foi!"],
      pose: (o, T) => writing(o, T),
      tick: () => floaty("✓", VERDE),
      fim: () => `${(Math.random() * 4 + 2) | 0} tarefas riscadas!`,
    },
    // Atividades: levanta a mão pulando
    mao: {
      d: 2.8, fx: 0.7, fala: ["eu sei! eu sei!", "me escolhe!"],
      pose: (o, T) => { o.aR = -172 + Math.sin(T * 14) * 10; o.aL = 14; o.bob = -Math.abs(Math.sin(T * 7)) * 7; o.face = "happy"; o.hd = Math.sin(T * 7) * 4; },
      tick: () => floaty("!", "#E5484D"),
    },
    // Provas: corrige com a lupa, certo e errado
    corrigir: {
      d: 4, p: "magnify", fx: 0.6, fala: ["corrigindo...", "deixa eu ver as respostas"],
      pose: (o, T) => { o.aR = 96 + Math.sin(T * 1.6) * 5; o.aL = 12; o.face = "o"; o.lk = [2.8, -1.5]; o.hd = Math.sin(T * 1.3) * 3; },
      tick: (k) => (k % 3 === 2 ? floaty("✘", "#E5484D") : floaty("✔", VERDE)),
      fim: () => pick(["errou? anota no caderno!", "quase gabaritou!", "erro também ensina!"]),
    },
    // Redação: escreve parágrafo
    linhas: {
      d: 4.5, p: "write", fx: 0.5, fala: ["escrevendo a tese...", "primeiro parágrafo..."],
      pose: (o, T) => writing(o, T),
      tick: () => floaty(pick(["Aa", "¶", ",", "—", "!"]), TINTA),
      fim: () => pick(["parágrafo pronto!", "olha essa conclusão!", "nota mil!"]),
    },
    // Foco: senta de pernas cruzadas e flutua, meditando
    meditar: {
      d: 6, fx: 1.3, fala: ["ommm...", "respira fundo..."],
      pose: (o, T) => { o.sit = 27 * K; o.lL = -84; o.lR = -78; o.aL = 70 + Math.sin(T * 1.5) * 6; o.aR = -70 - Math.sin(T * 1.5) * 6; o.bob = -5 - Math.sin(T * 1.5) * 4; o.face = "blink"; },
      tick: () => floaty(pick(["~", "○", "·"]), "#93A3FF"),
      fim: () => "foco renovado!",
    },
    // Progresso: pulinho e carimbo de XP no card (sai na aterrissagem)
    carimbo: {
      d: 0,
      pose: () => {},
      inicio: () => {
        S.on = null; S.state = "air"; S.vy = -620; S.vx = 0; S.sq = 1.2; S.stamp = true;
        emote("sly", 0.8); say(pick(["carimbo de XP!", "aprovado!", "tá carimbado!"]), 1.6);
        return false;
      },
    },
    // Ranking: comemora no pódio
    podio: {
      d: 2.8, fx: 0.4, fala: ["primeiro lugar!", "pódio é meu!"],
      pose: (o, T) => { cheering(o, T); o.face = "laugh"; },
      tick: () => floaty(pick(["🏆", "1º", "★"]), OURO),
    },
    // Games: joga no celular, solta as formas dos botões
    fliperama: {
      d: 4, p: "phone", fx: 0.35, fala: ["fase nova!", "olha o combo!"],
      pose: (o, T, t) => { o.aR = 55; o.aL = -50 + Math.sin(T * 30) * 6; o.lk = [-0.5, 2.8]; o.hd = -4; const w = t % 2 > 1.4; o.face = w ? "laugh" : "o"; o.shake = w ? Math.sin(T * 45) * 1.4 : 0; },
      tick: () => floaty(pick(["▲", "●", "■", "✚"]), pick(["#E5484D", "#3141D9", VERDE, OURO])),
      fim: () => "GG!",
    },
    // Ateliê: pinta e respinga tinta no card
    pintar: {
      d: 4.5, p: "write", fx: 0.28, fala: ["pincelada!", "um pouco de cor!"],
      pose: (o, T) => { o.aL = -30; o.aR = 40 + Math.sin(T * 12) * 34; o.hd = Math.sin(T * 6) * 5; o.face = "happy"; },
      tick: () => splat(),
      fim: () => pick(["obra-prima!", "ficou lindo!", "sujei tudo, hihi"]),
    },
    // Idiomas: cumprimenta em várias línguas
    hello: {
      d: 3, fx: 0.6, fala: ["hello!", "hi, friend!"],
      pose: (o, T) => waving(o, T),
      tick: () => floaty(pick(["Hi!", "Hello!", "Hey!", "Hola!", "Ciao!"]), "#9682F0"),
      fim: () => pick(["repeat after me!", "your turn!", "well done!"]),
    },
    // Matéria: lê o livro como flashcard, pergunta e resposta
    flashcard: {
      d: 4, p: "read", fx: 1.3, fala: ["pergunta...", "flashcard!"],
      pose: (o, T) => { o.aL = -58; o.aR = 58; o.lk = [Math.sin(T * 2.4) * 2.8, 2.4]; o.hd = Math.sin(T * 0.9) * 2; },
      tick: (k) => floaty(k % 2 ? "!" : "?", k % 2 ? VERDE : "#9682F0"),
      fim: () => pick(["acertei!", "resposta decorada!", "mais um?"]),
    },
    // Busca: anda pelo card com a lupa
    lupa: {
      d: 5, p: "magnify", fx: 1, fala: ["procurando...", "cadê, cadê?"],
      pose: (o, T) => { o.aR = 96 + Math.sin(T * 1.6) * 5; o.aL = 12; o.face = "o"; o.lk = [2.8, -1.5]; o.lean = 6; },
      tick: () => floaty("?", "#9682F0"),
      fim: () => "achei!",
    },
    // Sugestões: pensa e tem uma ideia
    ideia: {
      d: 2.6, fx: 1.1, fala: ["hmm..."],
      pose: (o, T, t) => { o.aR = -120; o.aL = 10; o.hd = t < 1 ? 8 : Math.sin(T * 6) * 4; o.face = t < 1 ? "o" : "happy"; },
      tick: (k) => { if (k === 0) { floaty("💡", OURO); sparkle(S.x, S.y - H - 16); } },
      fim: () => pick(["tive uma ideia!", "sugere isso!", "eureca!"]),
    },
    // Comentários: lê o celular, balõezinhos de conversa
    conversa: {
      d: 4, p: "phone", fx: 0.7, fala: ["lendo os comentários", "olha esse!"],
      pose: (o, T) => { o.aR = 55; o.aL = -50 + Math.sin(T * 24) * 4; o.lk = [-0.5, 2.8]; o.hd = -4; },
      tick: () => floaty(pick(["💬", "...", "haha", "♥"]), "#3141D9"),
    },
    // Perfil: selfie com flash
    selfie: {
      d: 3, p: "phone", fx: 1, fala: ["selfie!", "sorria!"],
      pose: (o, T) => { o.aR = -150; o.aL = 30 + Math.sin(T * 3) * 6; o.face = "sly"; o.hd = 6; o.lean = -4; },
      tick: () => { sparkle(S.x + 30 * Math.sign(S.fs || 1), S.y - H - 10); floaty("click!", "#16181D"); },
      fim: () => "saí bem?",
    },
    // Como usar: aponta para um lado e para o outro, explicando
    mostrar: {
      d: 3.6, fx: 1.2, fala: ["aqui ó!", "olha como é!"],
      pose: (o, T) => { o.aR = -92; o.aL = 12; o.hd = 3 + Math.sin(T * 3) * 2; o.face = "happy"; },
      tick: (k) => { if (k) S.face = -S.face; },
      fim: () => "fácil, né?",
    },
    // Sobre: se apresenta com brilho
    orgulho: {
      d: 2.6, fala: ["prazer, sou a Mine!", "essa sou eu!"],
      pose: (o, T) => { cheering(o, T); o.face = "happy"; },
      inicio: () => { sparkle(S.x, S.y - H * 0.6); return true; },
    },
    // Plano de estudos: monta a semana
    calendario: {
      d: 4, p: "write", fx: 0.7, fala: ["montando a semana...", "um pouco por dia!"],
      pose: (o, T) => writing(o, T),
      tick: (k) => floaty(["seg", "ter", "qua", "qui", "sex"][k % 5], TINTA),
      fim: () => "plano pronto!",
    },
  };
  function startTrick(name: Truque) {
    const tr = TRUQUES[name];
    if (!tr || !S.on || !S.vis) return;
    interrupt();
    if (tr.inicio && !tr.inicio()) return;
    S.state = "trick"; S.trick = name; S.t = tr.d; S.actT = 0; S.fxT = 0.25; S.fxK = 0;
    el.dataset.p = tr.p || "";
    if (tr.fala && tr.fala.length && S.talking <= 0) say(pick(tr.fala), 1.8);
  }
  function endTrick() {
    const tr = S.trick && TRUQUES[S.trick as Truque];
    S.trick = null; S.lk = null; el.dataset.p = "";
    S.state = "idle"; S.t = rnd(0.5, 1.1);
    const f = tr && tr.fim ? tr.fim() : null;
    if (f) { say(f, 1.8); emote("happy", 1.2); }
  }
  function trickPose(T: number) {
    const o: Pose = { lL: 0, lR: 0, aL: 10, aR: -10, bob: -1 - Math.sin(T * 2), hd: 0, shake: 0, sit: 0, lean: 0, face: "smile", lk: null };
    const tr = S.trick && TRUQUES[S.trick as Truque];
    if (tr) tr.pose(o, T, S.actT);
    return o;
  }
  /* respingo de tinta em volta dos pés */
  function splat() {
    const d = document.createElement("i");
    d.className = "mpet-splat";
    const sz = rnd(7, 15);
    d.style.width = d.style.height = sz.toFixed(0) + "px";
    d.style.background = pick(["#FF6F9A", "#3141D9", "#39F59A", "#F4E04D", "#9682F0", "#FF9A3C"]);
    d.style.left = (S.x + rnd(-30, 30)).toFixed(0) + "px";
    d.style.top = (S.y - sz / 2 - 1).toFixed(0) + "px";
    layer.appendChild(d);
    d.animate([{ transform: "scale(0)", opacity: 1 }, { transform: "scale(1.15)", opacity: 1, offset: 0.12 }, { transform: "scale(1)", opacity: 0.9, offset: 0.7 }, { transform: "scale(.9)", opacity: 0 }], { duration: 2600, easing: "ease-out" }).onfinish = () => d.remove();
  }
  /* carimbo "+XP" no card onde ela pousou */
  function stampAt() {
    const d = document.createElement("span");
    d.className = "mpet-stamp";
    d.textContent = "+XP";
    d.style.left = S.x.toFixed(0) + "px";
    d.style.top = (S.y + 8).toFixed(0) + "px";
    layer.appendChild(d);
    const tf = "translate(-50%,0) rotate(-14deg)";
    d.animate([
      { transform: `${tf} scale(1.9)`, opacity: 0 },
      { transform: `${tf} scale(1)`, opacity: 1, offset: 0.12 },
      { transform: `${tf} scale(1)`, opacity: 0.95, offset: 0.75 },
      { transform: `${tf} scale(1)`, opacity: 0 },
    ], { duration: 2200, easing: "ease-out" }).onfinish = () => d.remove();
    floaty("+10", VERDE);
  }
  /* atividade sorteada com o peso da aba */
  function pickAct() {
    const w: Record<string, number | undefined> = aba().acts || {};
    const keys = Object.keys(ACTS).filter((k) => k !== S.lastAct);
    const ws = keys.map((k) => (w[k] ?? 1) * (k === "sleep" ? 0.6 : 1));
    let r = Math.random() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < keys.length; i++) { r -= ws[i]; if (r <= 0) return keys[i]; }
    return keys[0];
  }

  /* decisão sozinha */
  function plan() {
    const Pn: Plat = S.on;
    if (Pn === FLOOR && S.x > FLOOR.x2) { S.target = null; S.tx = FLOOR.x2 - rnd(20, 120); S.state = "walk"; return; }
    if (mouse.follow) { followPlan(); return; }
    const A = aba();
    if (Math.random() < 0.2) { startTrick(A.truque); if (S.state === "trick" || !S.on) return; }
    if (Math.random() < 0.38) { startAct(pickAct()); return; }
    const cands = world.plats.filter((q) => q !== Pn && q.x2 - q.x1 > 40 && Math.abs((q.x1 + q.x2) / 2 - S.x) < 700 && S.y - q.y < 380);
    if (!cands.length || Math.random() < 0.15) {
      const ahead = S.face > 0 ? Pn.x2 - 16 - S.x : S.x - (Pn.x1 + 16), back = S.face > 0 ? S.x - (Pn.x1 + 16) : Pn.x2 - 16 - S.x;
      if (ahead >= 90) { S.target = null; S.tx = S.x + S.face * rnd(80, Math.min(ahead, 300)); S.state = "walk"; return; }
      if (back >= 140 && Math.random() < 0.5) { S.target = null; S.tx = S.x - S.face * rnd(100, Math.min(back, 300)); S.state = "walk"; return; }
      S.state = "idle"; S.t = rnd(1.4, 2.8); S.look = rnd(-1, 1); return;
    }
    const cards = cands.filter((q) => q.kind === "card");
    let tq = pick(cards.length && Math.random() < 0.8 ? cards : cands);
    // no ranking ela gosta do lugar mais alto da página
    if (A.topo && Math.random() < 0.6) tq = cands.reduce((a, b) => (b.y < a.y ? b : a));
    setTarget(tq, rnd(tq.x1 + 18, Math.max(tq.x1 + 19, tq.x2 - 18)));
  }
  /* cursor parado: em cima de um card ela vai até o topo dele e aponta;
     fora de card, vai até a plataforma logo abaixo do cursor e acena */
  function followPlan() {
    let card: Plat | null = null;
    for (const p of world.plats)
      if (p.kind === "card" && mouse.x >= p.x1 && mouse.x <= p.x2 && mouse.y >= p.y && mouse.y <= p.y + p.h && (!card || p.y > card.y)) card = p;
    let best: Plat = FLOOR, mx = mouse.x;
    if (card) {
      best = card;
      // fica do lado do cursor, sem tapar o que ele aponta
      const side = mouse.x - card.x1 > 70 ? -1 : 1;
      mx = mouse.x + side * 46;
    } else {
      for (const p of world.plats) if (mouse.x >= p.x1 && mouse.x <= p.x2 && p.y >= mouse.y + 10 && p.y < best.y) best = p;
    }
    const x = clamp(mx, best.x1 + 14, Math.max(best.x1 + 15, best.x2 - 14));
    if (same(S.on, best) && Math.abs(S.x - x) < 24) {
      S.lookAt = mouse.x;
      S.face = Math.sign(mouse.x - S.x) || S.face;
      if (!S.greeted) {
        S.greeted = true;
        emote("happy", 1.8);
        if (card) { setPose("pointDown", 2.2); say(pick(APONTA), 1.8); }
        else { setPose("wave", 1.4); if (Math.random() < 0.8) say(pick(SEGUIR), 1.6); }
        return;
      }
      S.state = "idle"; S.t = rnd(0.5, 1); return;
    }
    goTo(best, x);
  }
  function goTo(p: Plat, x: number) {
    if (S.act) endAct();
    S.pose = null;
    if (!S.on) return;
    if (same(S.on, p)) { S.target = null; S.tx = clamp(x, p.x1 + 14, Math.max(p.x1 + 15, p.x2 - 14)); S.state = "walk"; }
    else setTarget(p, x);
  }
  function setTarget(tq: Plat, x: number) {
    const Pn: Plat = S.on;
    const tx = clamp(x, tq.x1 + 14, Math.max(tq.x1 + 15, tq.x2 - 14));
    // Descer para algo que fica embaixo do próprio card: pular não adianta
    // (cai de volta nele). Anda até a beirada mais perto e se deixa cair.
    if (tq.y > Pn.y + 10 && Pn !== FLOOR && tx > Pn.x1 - 20 && tx < Pn.x2 + 20) {
      const left = S.x - Pn.x1 < Pn.x2 - S.x;
      S.target = null;
      S.tx = left ? Pn.x1 - 24 : Pn.x2 + 24;
      S.state = "walk";
      return;
    }
    S.target = { p: tq, x: tx };
    S.tx = clamp(S.target.x, Pn.x1 + 12, Pn.x2 - 12);
    if (Math.abs(S.tx - S.x) > 320) S.tx = S.x + Math.sign(S.tx - S.x) * rnd(60, 200);
    if (Math.abs(S.tx - S.x) < 26) S.tx = S.x;
    S.state = "walk";
  }
  function launch() {
    const t = S.target; S.target = null;
    if (!t) { S.state = "idle"; S.t = rnd(0.5, 1.4); return; }
    const tp = findP(t.p) || t.p, up = S.y - tp.y, h = Math.max(60, up + 70), vy0 = -Math.sqrt(2 * GR * h);
    const a = 0.5 * GR, b = vy0, cc = S.y - tp.y, T = (-b + Math.sqrt(b * b - 4 * a * cc)) / (2 * a);
    S.vx = clamp((t.x - S.x) / T, -800, 800); S.vy = vy0;
    if (Math.abs(S.vx) > 20) S.face = Math.sign(S.vx);
    S.on = null; S.state = "air"; S.sq = 1.2; S.antV -= 260; S.tasV += 200;
  }
  /* cursor passou rápido perto: pulo para pegar */
  function tryCatch() {
    if (!S.vis || !S.on || S.catchCD > 0 || !["idle", "walk", "act"].includes(S.state)) return;
    const dx = mouse.x - S.x, top = S.y - H;
    if (Math.abs(dx) > 170 || mouse.y > S.y - H * 0.55 || mouse.y < top - 240) return;
    interrupt();
    const h = clamp(S.y - mouse.y - H * 0.75, 50, 280), vy0 = -Math.sqrt(2 * GR * h), T = -vy0 / GR;
    S.vx = clamp(dx / T, -700, 700); S.vy = vy0;
    S.face = Math.sign(dx) || S.face;
    S.on = null; S.state = "air"; S.sq = 1.25; S.antV -= 320;
    S.catching = true; S.catchBest = 1e9; S.catchCD = 3.5;
    emote("o", 0.6);
  }
  function walkTo(dt: number, speed: number) {
    const d = S.tx - S.x, dir = Math.sign(d) || S.face;
    if (Math.abs(d) < 5 || (S.vx !== 0 && Math.sign(S.vx) !== dir && Math.abs(d) < 26)) { S.vx = 0; return true; }
    if (dir !== S.face && Math.abs(S.vx) < 1) { S.face = dir; S.turnT = 0.2; }
    if (S.turnT > 0) { S.turnT -= dt; S.vx = 0; return false; }
    if (dir !== S.face) { S.vx += clamp(-S.vx, -1200 * dt, 1200 * dt); return false; }
    const tv = dir * Math.min(speed, Math.abs(d) * 5 + 30);
    S.vx += clamp(tv - S.vx, -1100 * dt, 1100 * dt);
    return false;
  }
  function think(dt: number) {
    if (S.talking > 0) S.talking -= dt;
    if (S.catchCD > 0) S.catchCD -= dt;
    S.rub = Math.max(0, S.rub - 260 * dt);
    if (!S.on) return;
    S.t -= dt; S.talk -= dt;
    if (S.state !== "idle") S.look = 0;
    if (S.talk <= 0 && S.state === "idle" && S.talking <= 0) {
      const A = aba();
      say(pick(Math.random() < 0.7 ? A.falas : FALAS));
      S.talk = rnd(16, 28) * (A.quieta ? 2 : 1);
    }
    // pouco depois de chegar numa aba ela mostra o truque dela
    if (S.trickSoon > 0) { S.trickSoon -= dt; if (S.trickSoon <= 0 && !mouse.follow && (S.state === "idle" || S.state === "act")) startTrick(aba().truque); }
    const brake = () => { S.vx += clamp(-S.vx, -1200 * dt, 1200 * dt); };
    switch (S.state) {
      case "idle": brake(); if (S.t <= 0) plan(); break;
      case "walk":
        if (walkTo(dt, SPEED)) {
          if (S.target) { S.state = "crouch"; S.t = 0.17; S.sq = 0.8; } else { S.state = "idle"; S.t = mouse.follow ? 0.1 : rnd(0.6, 1.8); }
        }
        break;
      case "crouch": S.vx = 0; if (S.t <= 0) launch(); break;
      case "act":
        brake(); S.actT += dt; S.fxT -= dt;
        if (S.act === "music" && S.fxT <= 0) { floaty(Math.random() < 0.5 ? "♪" : "♫"); S.fxT = 0.55; }
        if (S.act === "sleep" && S.fxT <= 0) { floaty(Math.random() < 0.5 ? "z" : "Z", "#93A3FF"); S.fxT = 1.1; }
        if (S.act === "write" && S.fxT <= 0) { if (Math.random() < 0.35) floaty("✎", "#1D2BB8"); S.fxT = 1.4; }
        if (S.t <= 0) endAct();
        break;
      case "trick": {
        const tr = TRUQUES[S.trick as Truque];
        if (!tr) { S.state = "idle"; break; }
        S.actT += dt; S.fxT -= dt;
        if (S.trick === "lupa") {
          // anda devagar pelo card com a lupa, virando na beirada
          const Pn: Plat = S.on;
          if ((S.face > 0 && S.x > Pn.x2 - 20) || (S.face < 0 && S.x < Pn.x1 + 20)) S.face = -S.face;
          S.vx = S.face * 38;
        } else brake();
        if (tr.fx && tr.tick && S.fxT <= 0) { tr.tick(S.fxK++); S.fxT = tr.fx; }
        if (S.t <= 0) { S.vx = 0; endTrick(); }
        break;
      }
      case "pose":
        brake();
        if (S.t <= 0) { S.pose = null; S.state = "idle"; S.t = rnd(0.4, 1); }
        break;
      case "dizzy":
        brake();
        if (S.t <= 0) { endDizzy(); S.state = "idle"; S.t = rnd(0.6, 1.2); emote("happy", 1); if (Math.random() < 0.6) say(pick(["ufa, passou!", "de novo não, hein!", "melhorei!"]), 1.6); }
        break;
      case "pet":
        brake(); S.fxT -= dt;
        if (S.fxT <= 0) { floaty("♥", pick(["#FF6F9A", "#FF8FA8", "#EC6F94"])); S.fxT = 0.32; }
        if (S.t <= 0) { S.state = "idle"; S.t = rnd(0.8, 1.4); emote("happy", 1.2); if (Math.random() < 0.7) say(pick(["hihi, de novo!", "adoro carinho!", "que gostoso!"]), 1.6); }
        break;
    }
  }
  function land(p: Plat) {
    const vyIn = S.vy, imp = Math.min(1, vyIn / 1300);
    S.y = p.y; S.vy = 0; S.vx = 0; S.on = p; S.state = "idle"; S.t = rnd(0.35, 1.1); S.sq = 1 - 0.36 * imp;
    S.antV += 420 * imp + 80; S.tasV -= 300 * imp; S.tumble = 0; S.spinA = 0;
    puff(imp); hit(p, imp);
    const wasThrown = S.thrown, wasHeld = S.held;
    S.thrown = false; S.held = false;
    if (S.catching) {
      S.catching = false;
      if (S.catchBest < 46) { emote("laugh", 1.4); setPose("cheer", 1.3); say(pick(["peguei!", "te peguei!", "rápida, né?"]), 1.5); }
      else { emote("sad", 1.2); say(pick(["quase!", "ah, escapou!", "volta aqui!"]), 1.4); }
      return;
    }
    if (S.forceDizzy) { S.forceDizzy = false; startDizzy(); return; } // três cliques
    if (S.stamp) { S.stamp = false; S.sq = 0.6; hit(p, 0.9); stampAt(); emote("laugh", 1); return; }
    // queda forte depois de ser arremessada ou solta lá do alto: tontura.
    // Descer sozinha de um card até o chão não conta (em tela alta isso daria tontura toda vez).
    if ((wasThrown && vyIn > 950) || (wasHeld && vyIn > 1550)) { startDizzy(); return; }
    if (wasThrown) { emote("laugh", 1.2); say(pick(["wiii!", "de novo!", "que voo!"]), 1.4); return; }
    if (imp > 0.55) emote("blink", 0.22);
  }
  function physics(dt: number) {
    if (S.state === "drag") return;
    if (S.on) {
      S.y = S.on.y; S.x += S.vx * dt;
      if (S.on === FLOOR) {
        // no chão ninguém cai; só não fica parada no canto reservado
        if (S.x > FLOOR.x2 + 8 && S.vx > 0) S.vx = 0;
        S.x = clamp(S.x, WALL.x1, WALL.x2);
      } else if (S.x < S.on.x1 - 8 || S.x > S.on.x2 + 8) { endAct(); if (S.state === "dizzy" || S.state === "pet") { endDizzy(); } S.on = null; S.state = "air"; }
      return;
    }
    const py = S.y;
    S.vy = Math.min(S.vy + GR * dt, 1900); S.x += S.vx * dt; S.y += S.vy * dt;
    if (S.x < WALL.x1) { S.x = WALL.x1; S.vx = Math.abs(S.vx) * 0.5; }
    if (S.x > WALL.x2) { S.x = WALL.x2; S.vx = -Math.abs(S.vx) * 0.5; }
    if (S.y < H + 4 && S.vy < 0) { S.y = H + 4; S.vy = Math.abs(S.vy) * 0.3; } // bateu no teto da janela
    if (S.catching) S.catchBest = Math.min(S.catchBest, Math.hypot(mouse.x - S.x, mouse.y - (S.y - H * 0.9)));
    if (S.vy > 0) {
      let best: Plat | null = null;
      for (const p of world.plats) if (p !== FLOOR && S.x >= p.x1 - 4 && S.x <= p.x2 + 4 && py <= p.y + 2 && S.y >= p.y && (!best || p.y < best.y)) best = p;
      if (!best && S.y >= FLOOR.y) best = FLOOR; // o chão pega qualquer x
      if (best) land(best);
    }
  }
  const rot = (g: SVGElement | null, a: number, cx: number, cy: number) => g && g.setAttribute("transform", `rotate(${a.toFixed(1)} ${cx} ${cy})`);
  function draw(dt: number) {
    S.clock += dt;
    const T = S.clock;
    let tilt = S.on ? clamp(S.vx / SPEED, -1, 1) * 3.5 : clamp(S.vx / 800, -1, 1) * 14;
    if (S.state === "drag") tilt = clamp(-S.vx / 60, -28, 28);
    if (S.tumble && !S.on) { S.spinA += dt * S.tumble * 620; tilt = S.spinA; }
    const antT = -tilt * 0.3 - S.vx * 0.016 * S.face, tasT = -S.vx * 0.04 * S.face + (S.on ? 0 : clamp(S.vy * 0.014, -18, 18));
    S.antV += ((antT - S.ant) * 170 - S.antV * 11) * dt; S.ant += S.antV * dt;
    S.tasV += ((tasT - S.tas) * 95 - S.tasV * 7) * dt; S.tas += S.tasV * dt;
    S.sq += (1 - S.sq) * Math.min(1, dt * 10);
    S.fs += (S.face - S.fs) * Math.min(1, dt * 13);
    const fsx = Math.abs(S.fs) < 0.12 ? Math.sign(S.fs || S.face) * 0.12 : S.fs;
    let sy = S.sq, sx = 2 - S.sq;
    if (!S.on && S.state !== "drag") { const st = clamp(-S.vy / 2200, -0.12, 0.15); sy = 1 + st; sx = 1 - st * 0.7; }
    let lL = 0, lR = 0, aL = 10, aR = -10, bob = 0, hd = 0, shake = 0, sit = 0, lean = 0;
    if (S.on && Math.abs(S.vx) > 8) {
      S.ph += (dt * Math.abs(S.vx)) / SPEED * 10;
      const s1 = Math.sin(S.ph);
      lL = s1 * 30; lR = -s1 * 30; aL = 10 - s1 * 28; aR = -10 - s1 * 28; bob = -Math.abs(Math.cos(S.ph)) * 3.4; hd = Math.sin(S.ph) * 2.5;
    }
    if (!S.on) {
      lL = -20; lR = 28;
      if (S.catching) { aL = 165; aR = -165; }
      else if (S.tumble) { aL = 120; aR = -60; }
      else if (S.vy < 0) { aL = 150; aR = -150; }
      else { aL = 115; aR = -115; }
    }
    switch (S.state) {
      case "crouch": aL = -30; aR = 30; break;
      case "drag": {
        // pendurada pelo cursor: pernas balançam com o movimento
        const sw = clamp(S.vx / 40, -40, 40);
        lL = 10 + sw + Math.sin(T * 9) * 8; lR = -10 + sw - Math.sin(T * 9) * 8; aL = 150; aR = -150; hd = Math.sin(T * 6) * 4;
        break;
      }
      case "dizzy":
        aL = 30 + Math.sin(T * 4) * 20; aR = -30 - Math.sin(T * 4 + 1) * 20; hd = Math.sin(T * 5) * 10; lean = Math.sin(T * 3.2) * 9; bob = Math.sin(T * 6) * 1.5; lL = Math.sin(T * 3.2) * 10; lR = -Math.sin(T * 3.2) * 10;
        break;
      case "pet":
        aL = -40 + Math.sin(T * 10) * 6; aR = 40 - Math.sin(T * 10) * 6; hd = Math.sin(T * 7) * 6; bob = -Math.abs(Math.sin(T * 9)) * 3; sy *= 0.94 + Math.abs(Math.sin(T * 9)) * 0.06;
        break;
      case "act": {
        const o = actPose(T);
        lL = o.lL; lR = o.lR; aL = o.aL; aR = o.aR; bob = o.bob; hd = o.hd; shake = o.shake; S.lk = o.lk; sit = o.sit;
        if (S.exprT <= 0) { S.expr = o.face; S.exprT = 0.05; }
        break;
      }
      case "trick": {
        const o = trickPose(T);
        lL = o.lL; lR = o.lR; aL = o.aL; aR = o.aR; bob = o.bob; hd = o.hd; shake = o.shake; sit = o.sit; lean = o.lean; S.lk = o.lk;
        if (S.exprT <= 0) { S.expr = o.face; S.exprT = 0.05; }
        break;
      }
      case "pose": {
        const o = posePose(T);
        lL = o.lL; lR = o.lR; aL = o.aL; aR = o.aR; bob = o.bob; hd = o.hd; shake = o.shake; sit = o.sit; lean = o.lean;
        break;
      }
    }
    S.sitY += (sit - S.sitY) * Math.min(1, dt * 8);
    S.lean += (lean - S.lean) * Math.min(1, dt * 10);
    rot(P.legL, lL, 48, 102); rot(P.legR, lR, 72, 102); rot(P.armL, aL, 31, 87); rot(P.armR, aR, 89, 87);
    P.torso?.setAttribute("transform", `translate(${shake.toFixed(1)} ${bob.toFixed(1)})`);
    rot(P.head, hd, 60, 86); rot(P.ant, S.ant, 60, 16);
    if (P.tassel) rot(P.tassel, S.tas, 101, 28);
    let lx = (S.state === "idle" && S.look ? S.look : clamp(((S.lookAt != null ? S.lookAt : mouse.x) - S.x) / 240, -1, 1)) * 3.2 * Math.sign(S.fs || 1);
    let ly = clamp((mouse.y - (S.y - 60)) / 240, -1, 1) * 2.4;
    if ((S.state === "act" || S.state === "trick") && S.lk) { lx = S.lk[0]; ly = S.lk[1]; }
    if (S.state === "dizzy") { lx = Math.cos(T * 8) * 2; ly = Math.sin(T * 8) * 1.5; }
    P.look?.setAttribute("transform", `translate(${lx.toFixed(1)} ${ly.toFixed(1)})`);
    S.exprT -= dt; S.blinkT -= dt;
    let ex = S.exprT > 0 ? S.expr : S.state === "drag" ? "laugh" : S.state === "pet" ? "happy" : !S.on ? (S.vy > 600 ? "o" : "happy") : "smile";
    if (S.state === "dizzy") ex = "dizzy";
    if (ex === "smile" && S.blinkT < 0) { ex = "blink"; if (S.blinkT < -0.13) S.blinkT = rnd(2.5, 5); }
    if (el.dataset.f !== ex) el.dataset.f = ex;
    el.style.transform = `translate3d(${(S.x - W / 2).toFixed(1)}px,${(S.y - H + S.sitY).toFixed(1)}px,0)`;
    svg.style.transform = `rotate(${(tilt + S.lean * S.face).toFixed(1)}deg) scale(${(fsx * sx).toFixed(3)},${sy.toFixed(3)})`;
    if (S.dizzyStars.length) {
      S.dizzyStars.forEach((d: HTMLElement, i: number) => {
        const a = T * 5 + i * 2.09, z = Math.sin(a);
        d.style.transform = `translate(${(S.x - 8 + Math.cos(a) * 30).toFixed(1)}px,${(S.y - H - 8 + z * 7).toFixed(1)}px) scale(${(0.75 + z * 0.25).toFixed(2)})`;
      });
    }
    let ground: Plat | null = null;
    for (const p of world.plats) if ((p === FLOOR || (S.x >= p.x1 - 4 && S.x <= p.x2 + 4)) && p.y >= S.y - 1 && (!ground || p.y < ground.y)) ground = p;
    if (ground) {
      const k = clamp(1 - (ground.y - S.y) / 300, 0.25, 1);
      sh.style.transform = `translate3d(${(S.x - 26).toFixed(1)}px,${(ground.y - 6).toFixed(1)}px,0) scale(${(k * (2 - sy)).toFixed(2)},${k.toFixed(2)})`;
      sh.style.opacity = (0.9 * k).toFixed(2);
    } else sh.style.opacity = "0";
  }
  function rebind() {
    const old: Plat | null = S.on;
    if (!old) return;
    if (old === FLOOR) { S.y = FLOOR.y; return; }
    const np = findP(old);
    if (np) S.on = np;
    else { endAct(); if (S.state === "dizzy" || S.state === "pet") endDizzy(); S.on = null; S.state = "air"; }
  }
  /* em cima de botão/campo: a Mine não pode roubar o clique */
  function checkGhost() {
    if (!S.vis || S.state === "drag" || S.state === "pet") return;
    const pts = [[S.x, S.y - H * 0.5], [S.x, S.y - 8], [S.x - W * 0.3, S.y - H * 0.7], [S.x + W * 0.3, S.y - H * 0.7]];
    let ghost = false;
    for (const [x, y] of pts) {
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
      for (const e of document.elementsFromPoint(x, y)) {
        if (layer.contains(e)) continue;
        if (e.closest(INTERACTIVE)) ghost = true;
        break;
      }
      if (ghost) break;
    }
    if (ghost !== S.ghost) { S.ghost = ghost; el.classList.toggle("ghost", ghost); }
  }
  function step(dt: number) { if (!S.vis) return; think(dt); physics(dt); draw(dt); }

  /* ---------- mexer na Mine: clique, arrastar, arremessar, carinho ---------- */
  const clicks: number[] = [];
  const drag = { pending: false, active: false, id: -1, sx: 0, sy: 0, ox: 0, oy: 0, lx: 0, ly: 0, lt: 0 };
  function onClick() {
    if (!S.vis) return;
    const now = performance.now();
    clicks.push(now);
    while (clicks.length && now - clicks[0] > 1100) clicks.shift();
    if (clicks.length >= 3) {
      clicks.length = 0;
      // três cliques seguidos: gira e fica tonta
      interrupt();
      if (S.on) { S.on = null; S.state = "air"; S.vy = -620; S.vx = 0; }
      S.tumble = Math.random() < 0.5 ? 1 : -1;
      S.thrown = true; S.vy = Math.min(S.vy, -620);
      emote("o", 0.8); say(pick(["ei, para!", "aaai!", "tá girando!"]), 1.2);
      // tontura na chegada, mesmo de queda curta
      S.forceDizzy = true;
      return;
    }
    interrupt();
    S.on = null; S.state = "air"; S.vy = clicks.length === 2 ? -1150 : -950; S.vx = rnd(-160, 160); S.sq = 1.22; S.antV -= 400;
    S.tumble = clicks.length === 2 ? (Math.random() < 0.5 ? 1 : -1) : 0;
    emote("laugh", 1); say(pick(Math.random() < 0.6 ? aba().clique : CLIQUE), 1.4);
  }
  function onDown(e: PointerEvent) {
    if (!S.vis || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    drag.pending = true; drag.active = false; drag.id = e.pointerId;
    drag.sx = e.clientX; drag.sy = e.clientY;
    drag.ox = S.x - e.clientX; drag.oy = S.y - e.clientY;
    drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = performance.now();
  }
  function onDragMove(e: PointerEvent) {
    if (!drag.pending || e.pointerId !== drag.id) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
      drag.active = true;
      interrupt();
      if (S.state === "dizzy") endDizzy();
      S.on = null; S.state = "drag"; S.tumble = 0; S.vx = 0; S.vy = 0;
      el.classList.add("dragging");
      say(pick(["wiii!", "pra onde vamos?", "me solta! hihi"]), 1.4);
    }
    const now = performance.now(), dt = Math.max(1, now - drag.lt) / 1000;
    // velocidade suavizada: é ela que vira o arremesso
    S.vx = S.vx * 0.6 + ((e.clientX - drag.lx) / dt) * 0.4;
    S.vy = S.vy * 0.6 + ((e.clientY - drag.ly) / dt) * 0.4;
    drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now;
    S.x = clamp(e.clientX + drag.ox, WALL.x1, WALL.x2);
    S.y = clamp(e.clientY + drag.oy, H + 4, FLOOR.y);
  }
  function onUp(e: PointerEvent) {
    if (!drag.pending || e.pointerId !== drag.id) return;
    drag.pending = false;
    if (!drag.active) { onClick(); return; }
    drag.active = false;
    el.classList.remove("dragging");
    if (performance.now() - drag.lt > 90) { S.vx = 0; S.vy = 0; } // soltou parada
    S.vx = clamp(S.vx, -1700, 1700); S.vy = clamp(S.vy, -1700, 1400);
    const fast = Math.hypot(S.vx, S.vy) > 700;
    S.state = "air"; S.on = null; S.thrown = fast; S.held = true; S.sq = 1.15;
    S.tumble = Math.hypot(S.vx, S.vy) > 1000 ? Math.sign(S.vx) || 1 : 0;
    if (fast) { emote("o", 1); say(pick(["aaaah!", "wiiiii!", "socorro! hihi"]), 1.2); }
  }
  /* carinho: esfregar o mouse em cima dela, indo e voltando */
  function onRub(e: PointerEvent) {
    if (drag.pending || e.buttons || e.pointerType === "touch") return;
    if (!S.on || ["drag", "dizzy", "air", "crouch"].includes(S.state)) return;
    const dir = Math.sign(e.movementX || 0);
    if (dir && dir !== S.rubDir) { S.rub += 70; S.rubDir = dir; }
    S.rub += Math.min(40, Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0)) * 0.5;
    if (S.rub > 300) {
      if (S.state !== "pet") { interrupt(); S.state = "pet"; S.fxT = 0; if (Math.random() < 0.7) say(pick(["hihihi!", "cócegas!", "aaah, carinho!"]), 1.4); }
      S.t = 0.9;
      S.rub = Math.min(S.rub, 420);
    }
  }
  svg.addEventListener("pointerdown", onDown);
  svg.addEventListener("pointermove", onRub);
  svg.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); });
  addEventListener("pointermove", onDragMove, { passive: true });
  addEventListener("pointerup", onUp);
  addEventListener("pointercancel", onUp);

  /* ---------- chegada, saída, troca de aba ---------- */
  let route = "home";
  const aba = () => abaDe(route);
  function readRoute() { route = (location.hash.replace(/^#\/?/, "").split("/")[0] || "home").toLowerCase(); }
  function leave() {
    S.vis = false; S.pose = null; S.tumble = 0; S.catching = false; S.thrown = false; S.stamp = false; S.trickSoon = 0; S.talking = 0; endAct(); endDizzy(); S.state = "off";
    drag.pending = false; drag.active = false; el.classList.remove("dragging");
    sayEl.classList.remove("on"); el.classList.add("gone"); sh.classList.add("gone");
  }
  function arrive() {
    scanWorld(performance.now(), true);
    const cards = world.plats.filter((p) => p.kind === "card" && p.x2 - p.x1 > 90);
    const p = cards.length ? pick(cards.slice(0, 3)) : FLOOR;
    later(() => {
      if (blocked) return;
      S.x = rnd(p.x1 + 20, Math.max(p.x1 + 21, p.x2 - 20));
      S.y = -110; S.vx = 0; S.vy = 160; S.on = null; S.state = "air"; S.vis = true; S.pose = null;
      S.talk = rnd(10, 16); draw(0);
      el.classList.remove("gone"); sh.classList.remove("gone");
      S.trickSoon = rnd(3.5, 6);
      later(() => {
        if (!S.vis || S.talking > 0) return;
        const A = aba();
        let lido: string | null = null;
        try { lido = A.ler ? A.ler() : null; } catch { lido = null; }
        say(lido && Math.random() < 0.75 ? lido : pick(A.chegada.length ? A.chegada : OI), 2.2);
      }, 900);
    }, 300);
  }
  let routeTimer = 0;
  function onHash() {
    const before = route;
    readRoute();
    if (route === before) return;
    leave();
    clearTimeout(routeTimer);
    timers.delete(routeTimer);
    // espera a virada de página terminar antes de procurar os cards novos
    routeTimer = later(() => { if (!blocked) arrive(); }, 900);
  }

  let blocked = false;
  function checkBlocked() {
    const b = innerWidth < 768 || !!document.querySelector('[role="dialog"],[aria-modal="true"]');
    if (b === blocked) return;
    blocked = b;
    layer.classList.toggle("off", b);
    if (b) leave(); else arrive();
  }

  /* ---------- cursor ---------- */
  function onMove(e: PointerEvent) {
    if (e.pointerType === "touch") return;
    const now = performance.now();
    const dx = e.clientX - mouse.x, dy = e.clientY - mouse.y, dt = Math.max(8, now - mouse.t) / 1000;
    mouse.speed = mouse.speed * 0.5 + (Math.hypot(dx, dy) / dt) * 0.5;
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = now; mouse.inside = true;
    if (mouse.speed > 1500 && !drag.pending) tryCatch();
    if (mouse.follow && Math.hypot(dx, dy) < 30) return;
    mouse.moved = now;
    if (mouse.follow) { mouse.follow = false; S.lookAt = null; S.greeted = false; }
  }
  function onLeaveWindow() { mouse.inside = false; if (mouse.follow) { mouse.follow = false; S.greeted = false; } }
  function checkFollow(now: number) {
    if (mouse.follow || !mouse.inside || !mouse.moved || now - mouse.moved < IDLE_FOLLOW_MS) return;
    if (mouse.y < TOP_SAFE || drag.pending) return;
    // cursor parado em cima dela: é carinho ou clique, não chamado
    if (Math.abs(mouse.x - S.x) < W * 0.6 && mouse.y > S.y - H && mouse.y < S.y) return;
    mouse.follow = true;
    S.greeted = false;
    if (S.vis && S.on && (S.state === "idle" || S.state === "act" || S.state === "walk")) { interrupt(); S.state = "idle"; S.t = 0.15 + Math.random() * 0.3; }
  }

  /* ---------- rolagem: as plataformas andam junto, sem esperar a varredura ---------- */
  let lastScroll = scrollY;
  function onScroll() {
    const dy = lastScroll - scrollY;
    lastScroll = scrollY;
    if (!dy) return;
    for (const p of world.plats) if (p !== FLOOR) p.y += dy;
    if (S.on && S.on !== FLOOR) S.y += dy;
  }

  /* ---------- laço único ---------- */
  let raf = 0, last = performance.now(), ghostT = 0;
  function loop(now: number) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (!S.vis) {
      if (now - world.t > SCAN_MS) { world.t = now; checkBlocked(); }
      return;
    }
    if (scanWorld(now)) { checkBlocked(); rebind(); }
    checkFollow(now);
    step(dt);
    if (now - ghostT > 200) { ghostT = now; checkGhost(); }
  }
  function onVisibility() {
    cancelAnimationFrame(raf);
    if (document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerleave", onLeaveWindow);
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("hashchange", onHash);
  document.addEventListener("visibilitychange", onVisibility);
  readRoute();
  checkBlocked();
  routeTimer = later(() => { if (!blocked) arrive(); }, 1200);
  if (!document.hidden) raf = requestAnimationFrame(loop);

  // Ganchos de teste no console (window.__pets) — não mudam nada sozinhos.
  (window as any).__pets = {
    S,
    world,
    dizzy: () => startDizzy(),
    trick: (n?: Truque) => startTrick(n || aba().truque),
    state: () => `mine:${S.state}${S.act ? "/" + S.act : ""}${S.pose ? "/" + S.pose : ""}@${Math.round(S.x)},${Math.round(S.y)}`,
  };

  return {
    destroy() {
      cancelAnimationFrame(raf);
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      endDizzy();
      removeEventListener("pointermove", onMove);
      removeEventListener("pointermove", onDragMove);
      removeEventListener("pointerup", onUp);
      removeEventListener("pointercancel", onUp);
      document.removeEventListener("pointerleave", onLeaveWindow);
      removeEventListener("scroll", onScroll);
      removeEventListener("hashchange", onHash);
      document.removeEventListener("visibilitychange", onVisibility);
      layer.remove();
      delete (window as any).__pets;
    },
  };
}
