/*
  Caderno vivo: as peças de movimento que dão vida ao caderno.

  - CadernoSplash: a capa do caderno abre e a primeira página se escreve.
  - pageFlipVariants + PageTurnShade: cada troca de aba vira uma página.
  - Doodle / MarginDoodles / InkUnderline: rabiscos de caneta que se desenham.
  - celebrate / floatXp: confete de papel e XP voando até o contador.
  - MineBuddy: a Mine mora no canto da folha, olha o cursor e comenta.

  Regras de custo (ver memória "motion e custo visual"): só transform, opacity
  e stroke-dashoffset animam; nada de blur; nada de setState por pointermove;
  tudo some ou congela com movimento reduzido.
*/
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { useSoftMotion } from "../motion";
import { playPageFlip, playPencil, playPop } from "./sons";
import "./caderno-fx.css";
import "./caderno-telas.css";
import "./caderno-mine.css";
import "./caderno-mine-welcome.css";
import "./caderno-janelas.css";
import "./caderno-mapa.css";
import "./caderno-artefatos.css";
import "./caderno-materia.css";
import "./caderno-jogos.css";
import "./caderno-ranking.css";
import "./caderno-admin.css";
import "./caderno-extras.css";
import "./caderno-celular.css";

/* ─────────────────────────── util ─────────────────────────── */

function prefersLess() {
  return (
    document.documentElement.classList.contains("no-motion") ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Semente estável a partir de um texto: rabiscos mudam por página, não a cada render. */
function seedOf(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967296;
  };
}

/* ─────────────────────────── rabiscos ─────────────────────────── */

export type DoodleKind =
  | "star"
  | "arrow"
  | "spiral"
  | "circle"
  | "check"
  | "heart"
  | "bulb"
  | "sparkle"
  | "bolt"
  | "underline"
  | "cloud"
  | "flower"
  | "cross";

const doodlePaths: Record<DoodleKind, { box: string; d: string[] }> = {
  star: { box: "0 0 48 48", d: ["M24 5 L28.6 18 L42 18.6 L31.4 26.8 L35.2 40 L24 32.2 L12.8 40 L16.6 26.8 L6 18.6 L19.4 18 Z"] },
  arrow: { box: "0 0 48 48", d: ["M5 32 C 13 12, 30 11, 34 23 C 37 33, 25 36, 23 28 C 21 19, 33 13, 43 17", "M43 17 L36 12", "M43 17 L38 24"] },
  spiral: { box: "0 0 48 48", d: ["M25 24 c2 -2 5 0 4 3 c-1 4 -7 4 -8 -1 c-1 -6 7 -9 11 -4 c5 6 -1 14 -8 13 c-9 -1 -11 -12 -5 -18 c7 -7 20 -3 21 7"] },
  circle: { box: "0 0 48 48", d: ["M9 27 C 6 12, 38 5, 42 21 C 46 36, 13 43, 8 29 C 5 20, 19 11, 37 13"] },
  check: { box: "0 0 48 48", d: ["M8 26 L19 37 L41 10"] },
  heart: { box: "0 0 48 48", d: ["M24 40 C 8 30, 4 18, 12 12 C 18 8, 23 12, 24 17 C 25 12, 30 8, 36 12 C 44 18, 40 30, 24 40 Z"] },
  bulb: { box: "0 0 48 48", d: ["M24 6 C 14 6, 10 16, 14 24 C 17 29, 18 31, 18 35 L30 35 C 30 31, 31 29, 34 24 C 38 16, 34 6, 24 6 Z", "M19 40 L29 40", "M21 44 L27 44"] },
  sparkle: { box: "0 0 48 48", d: ["M24 5 L24 17", "M24 31 L24 43", "M5 24 L17 24", "M31 24 L43 24", "M11 11 L17 17", "M31 31 L37 37", "M37 11 L31 17", "M17 31 L11 37"] },
  bolt: { box: "0 0 48 48", d: ["M28 4 L12 26 L23 26 L18 44 L36 20 L25 20 Z"] },
  underline: { box: "0 0 200 20", d: ["M3 13 C 32 4, 52 18, 82 10 S 142 3, 197 11"] },
  cloud: { box: "0 0 48 48", d: ["M12 34 C 5 34, 5 24, 12 23 C 11 14, 22 11, 26 17 C 29 11, 39 13, 38 21 C 45 21, 45 34, 37 34 Z"] },
  cross: { box: "0 0 48 48", d: ["M11 11 L37 37", "M37 11 L11 37"] },
  flower: { box: "0 0 48 48", d: ["M24 20 C 20 10, 28 10, 24 20 C 32 14, 36 22, 26 23 C 34 28, 28 34, 24 26 C 20 34, 12 28, 22 23 C 12 22, 16 14, 24 20 Z", "M24 26 L24 44", "M24 36 C 30 32, 34 34, 34 34"] },
};

const doodleOrder: DoodleKind[] = ["star", "arrow", "spiral", "circle", "bulb", "sparkle", "heart", "bolt", "cloud", "flower", "check"];

/**
 * Um rabisco de caneta que se desenha quando entra na tela (e de novo no
 * hover, se `redraw`). `pathLength=1` normaliza o traço: o mesmo CSS desenha
 * qualquer forma.
 */
export function Doodle({
  kind,
  className = "",
  delay = 0,
  duration = 900,
  strokeWidth = 2.4,
  redraw = false,
  stretch = false,
  label,
}: {
  kind: DoodleKind;
  className?: string;
  delay?: number;
  duration?: number;
  strokeWidth?: number;
  redraw?: boolean;
  /** Estica o rabisco até a caixa (ex.: um círculo que vira elipse em volta de um título). */
  stretch?: boolean;
  label?: string;
}) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [drawn, setDrawn] = useState(false);
  const [round, setRound] = useState(0);
  const shape = doodlePaths[kind];

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (prefersLess() || typeof IntersectionObserver === "undefined") {
      setDrawn(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setDrawn(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <svg
      ref={ref}
      viewBox={shape.box}
      preserveAspectRatio={stretch ? "none" : undefined}
      className={`caderno-doodle ${drawn ? "is-drawn" : ""} ${className}`}
      style={{ "--doodle-delay": `${delay}ms`, "--doodle-dur": `${duration}ms` } as React.CSSProperties}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      onPointerEnter={redraw ? () => setRound((value) => value + 1) : undefined}
    >
      {shape.d.map((d, index) => (
        <path
          key={`${round}-${index}`}
          d={d}
          pathLength={1}
          strokeWidth={strokeWidth}
          style={{ animationDelay: `calc(var(--doodle-delay) + ${index * 140}ms)` }}
        />
      ))}
    </svg>
  );
}

/** Rabisco escolhido pela página: cada aba tem a sua "assinatura" na margem. */
export function doodleFor(text: string): DoodleKind {
  const random = seedOf(text);
  return doodleOrder[Math.floor(random() * doodleOrder.length)];
}

/**
 * Coluna de rabiscos na margem da folha, entre os furos e a linha vermelha.
 * Cada um se desenha quando a rolagem chega nele, como quem vai anotando
 * enquanto lê. Fica só no desktop: no celular a margem é estreita demais.
 */
export function MarginDoodles({ route }: { route: string }) {
  const items = useMemo(() => {
    const random = seedOf(`margem-${route}`);
    return Array.from({ length: 9 }, (_, index) => ({
      kind: doodleOrder[Math.floor(random() * doodleOrder.length)],
      top: 11 + index * 26 + Math.round(random() * 9),
      tilt: Math.round(random() * 30 - 15),
    }));
  }, [route]);

  return (
    <div className="caderno-margin-doodles" aria-hidden>
      {items.map((item, index) => (
        <span key={`${route}-${index}`} style={{ top: `${item.top}rem`, transform: `rotate(${item.tilt}deg)` }}>
          <Doodle kind={item.kind} delay={120} duration={1100} strokeWidth={2.6} />
        </span>
      ))}
    </div>
  );
}

/** Sublinhado de caneta que se desenha sob um título de seção. */
export function InkUnderline({ className = "" }: { className?: string }) {
  return <Doodle kind="underline" className={`caderno-ink-underline ${className}`} duration={700} strokeWidth={3} />;
}

/** Quadradinho feito à mão: o visto se desenha quando marca. */
export function InkCheck({ checked, className = "" }: { checked: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={`caderno-inkcheck ${checked ? "is-checked" : ""} ${className}`} aria-hidden>
      <path className="box" d="M4 5.5 Q4 4 5.6 4 L22.6 4.3 Q24.2 4.4 24 6 L23.7 22.6 Q23.6 24.1 22 24 L5.4 23.8 Q4 23.7 4.1 22.1 Z" />
      <path className="tick" pathLength={1} d="M7.5 14.5 L12 19.5 L25 5" />
    </svg>
  );
}

/** Comemorar uma conquista pequena: XP voando, confete e a Mine vibrando. */
const cheers = ["Mandou bem!", "Riscou! Uhul!", "Menos uma!", "Isso aí!", "Tá voando hoje!", "Caprichou!"];
export function cheer(element: Element | null, xp: number, text?: string) {
  if (!element) return;
  playPencil();
  floatXp(`+${xp} XP`, element);
  celebrateFrom(element, { count: 18, spread: 0.8 });
  mineSays(text || cheers[Math.floor(Math.random() * cheers.length)], "happy");
}

/* ─────────────────────────── virada de página ─────────────────────────── */

/**
 * A troca de aba é uma página virando: a folha que sai gira em torno da
 * lombada (borda esquerda) e some; a nova assenta vindo levemente inclinada.
 * `transformPerspective` põe a perspectiva no próprio transform, sem criar
 * contexto 3D no <main> (que prenderia elementos `fixed` das telas).
 */
export const pageFlipVariants: Variants = {
  initial: { opacity: 0, rotateY: 9, x: 28, transformPerspective: 1800, transformOrigin: "0% 50%" },
  animate: {
    opacity: 1,
    rotateY: 0,
    x: 0,
    transformPerspective: 1800,
    transformOrigin: "0% 50%",
    transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] },
  },
  exit: {
    opacity: 0,
    rotateY: -32,
    x: -18,
    transformPerspective: 1800,
    transformOrigin: "0% 50%",
    transition: { duration: 0.24, ease: [0.4, 0, 1, 1] },
  },
};

export const pageFadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};

/** Sombra da folha virando: uma faixa de luz e sombra varre a tela na troca. */
export function PageTurnShade({ routeKey }: { routeKey: string }) {
  const reduced = useSoftMotion();
  // O som da folha só a partir da segunda página: a primeira é o carregamento.
  const firstPage = useRef(true);
  useEffect(() => {
    if (firstPage.current) {
      firstPage.current = false;
      return;
    }
    playPageFlip();
  }, [routeKey]);
  if (reduced) return null;
  return (
    <motion.span
      key={routeKey}
      aria-hidden
      className="caderno-turn-shade"
      initial={{ x: "-30%", opacity: 0.9 }}
      animate={{ x: "130%", opacity: 0 }}
      transition={{ duration: 0.75, ease: [0.3, 0.6, 0.2, 1] }}
    />
  );
}

/* ─────────────────────────── confete e XP ─────────────────────────── */

const confettiColors = ["var(--hl-mint)", "var(--hl-yellow)", "var(--hl-pink)", "var(--hl-lilac)", "var(--pen)"];

/**
 * Confete de papel picado saindo de um ponto: retalhos de marca-texto,
 * estrelinhas de caneta e bolinhas de furador. Tudo em Web Animations,
 * sem React, e o nó se apaga sozinho no fim.
 */
export function celebrate(x: number, y: number, { count = 26, spread = 1 }: { count?: number; spread?: number } = {}) {
  playPop();
  if (typeof document === "undefined" || prefersLess()) return;
  const layer = document.createElement("div");
  layer.className = "caderno-confetti";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);
  let pending = count;
  for (let index = 0; index < count; index += 1) {
    const piece = document.createElement("i");
    const shape = index % 5;
    piece.className = shape === 0 ? "is-star" : shape === 1 ? "is-dot" : "is-strip";
    piece.style.setProperty("--c", `rgb(${confettiColors[index % confettiColors.length]})`);
    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    layer.appendChild(piece);
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.25 * spread;
    const power = 90 + Math.random() * 170;
    const dx = Math.cos(angle) * power;
    const dy = Math.sin(angle) * power;
    const spin = (Math.random() - 0.5) * 900;
    const fall = 140 + Math.random() * 160;
    piece
      .animate(
        [
          { transform: "translate(-50%, -50%) rotate(0deg) scale(.6)", opacity: 1 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${spin * 0.5}deg) scale(1)`, opacity: 1, offset: 0.35 },
          { transform: `translate(calc(-50% + ${dx * 1.35}px), calc(-50% + ${dy + fall}px)) rotate(${spin}deg) scale(.9)`, opacity: 0 },
        ],
        { duration: 1100 + Math.random() * 600, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" },
      )
      .finished.catch(() => undefined)
      .finally(() => {
        pending -= 1;
        if (pending <= 0) layer.remove();
      });
  }
}

/**
 * Aviãozinho de papel que sai do botão de enviar e voa em curva até sumir:
 * a pergunta "foi" para a Mine.
 */
export function launchPlane(from: Element | null) {
  if (!from || typeof document === "undefined" || prefersLess()) return;
  const rect = from.getBoundingClientRect();
  const plane = document.createElement("div");
  plane.className = "caderno-plane";
  plane.setAttribute("aria-hidden", "true");
  plane.innerHTML =
    '<svg viewBox="0 0 48 48"><path d="M4 22 L44 6 L30 42 L22 28 Z" /><path d="M22 28 L44 6" /><path d="M22 28 L20 38 L27 32" /></svg>';
  plane.style.left = `${rect.left + rect.width / 2}px`;
  plane.style.top = `${rect.top + rect.height / 2}px`;
  document.body.appendChild(plane);
  plane
    .animate(
      [
        { transform: "translate(-50%, -50%) rotate(-10deg) scale(.6)", opacity: 0 },
        { transform: "translate(calc(-50% - 60px), calc(-50% - 70px)) rotate(-25deg) scale(1)", opacity: 1, offset: 0.3 },
        { transform: "translate(calc(-50% - 10px), calc(-50% - 200px)) rotate(10deg) scale(.9)", opacity: 1, offset: 0.65 },
        { transform: "translate(calc(-50% + 90px), calc(-50% - 330px)) rotate(28deg) scale(.6)", opacity: 0 },
      ],
      { duration: 1100, easing: "cubic-bezier(.3,.6,.3,1)", fill: "forwards" },
    )
    .finished.catch(() => undefined)
    .finally(() => plane.remove());
}

/** Confete saindo do centro de um elemento. */
export function celebrateFrom(element: Element | null, options?: { count?: number; spread?: number }) {
  if (!element) return;
  const rect = element.getBoundingClientRect();
  celebrate(rect.left + rect.width / 2, rect.top + rect.height / 2, options);
}

/** "+20 XP" escrito à mão, subindo de um ponto e indo parar no contador. */
export function floatXp(text: string, from: Element | null, to?: Element | null) {
  if (!from || typeof document === "undefined") return;
  const start = from.getBoundingClientRect();
  const node = document.createElement("div");
  node.className = "caderno-float-xp";
  node.textContent = text;
  node.setAttribute("aria-hidden", "true");
  node.style.left = `${start.left + Math.min(start.width, 80) / 2}px`;
  node.style.top = `${start.top}px`;
  document.body.appendChild(node);
  let dx = 12;
  let dy = -70;
  if (to) {
    const end = to.getBoundingClientRect();
    dx = end.left + end.width / 2 - (start.left + Math.min(start.width, 80) / 2);
    dy = end.top - start.top;
  }
  const quiet = prefersLess();
  node
    .animate(
      quiet
        ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }]
        : [
            { transform: "translate(-50%, 0) rotate(-8deg) scale(.7)", opacity: 0 },
            { transform: "translate(-50%, -30px) rotate(-4deg) scale(1.15)", opacity: 1, offset: 0.28 },
            { transform: `translate(calc(-50% + ${dx}px), ${dy}px) rotate(0deg) scale(.55)`, opacity: 0 },
          ],
      { duration: quiet ? 900 : 1150, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" },
    )
    .finished.catch(() => undefined)
    .finally(() => node.remove());
}

/* ─────────────────────────── a Mine na margem ─────────────────────────── */

export type BuddyMood = "happy" | "think" | "wow" | "idle";

/** Qualquer tela pode fazer a Mine comentar: `mineSays("Mandou bem!", "happy")`. */
export function mineSays(text: string, mood: BuddyMood = "happy") {
  window.dispatchEvent(new CustomEvent("caderno:mine", { detail: { text, mood } }));
}

const routeTips: Record<string, string[]> = {
  home: ["Bora começar pelo que está atrasado?", "Risca uma tarefa e ganha XP!"],
  agenda: ["Arrasta os bilhetes entre os dias!", "Semana cheia? Espalha as tarefas."],
  foco: ["Celular longe. Eu cuido do tempo.", "Um lápis por sessão!"],
  progress: ["Olha quanto você já andou!", "Cada figurinha é uma conquista."],
  ranking: ["Quem estudou mais hoje?", "A estante cresce a cada 100 XP."],
  games: ["Escolhe uma carta!", "Cada acerto vale XP."],
  atelie: ["Manda uma foto que eu contorno!", "O balde para nas linhas."],
  idiomas: ["Let's go to London!", "Errou? Eu grifo pra revisar.", "Fala comigo em inglês!"],
  search: ["Procura que eu grifo.", "Busco até dentro dos PDFs."],
  plan: ["Me diz a data da prova.", "Eu espalho as revisões pra você."],
  comments: ["Cola um bilhete no mural!", "Conta o que funcionou pra você."],
  suggestions: ["Sua ideia pode virar recurso!", "Vota no que quer primeiro."],
  about: ["Prazer, eu sou a Mine!"],
  perfil: ["Deixa a carteirinha com a sua cara."],
  subject: ["Marca o que já estudou.", "Quer que eu faça flashcards daqui?"],
};

/**
 * A Mine desenhada no canto da folha. Os olhos seguem o cursor (escrita
 * direta no atributo, sem React a cada movimento), ela pisca sozinha, dá
 * dica na primeira visita de cada aba e comemora quando alguém chama
 * `mineSays`. Clicar leva para a conversa.
 */
export function MineBuddy({ route, onOpen }: { route: string; onOpen: () => void }) {
  const reduced = useSoftMotion();
  const eyesRef = useRef<SVGGElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [bubble, setBubble] = useState<{ text: string; mood: BuddyMood; key: number } | null>(null);
  const [blink, setBlink] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const timer = useRef<number | undefined>(undefined);

  const say = (text: string, mood: BuddyMood) => {
    window.clearTimeout(timer.current);
    setBubble({ text, mood, key: Date.now() });
    timer.current = window.setTimeout(() => setBubble(null), 4200);
  };

  useEffect(() => {
    const onSay = (event: Event) => {
      const detail = (event as CustomEvent<{ text: string; mood: BuddyMood }>).detail;
      if (detail?.text) say(detail.text, detail.mood || "happy");
    };
    window.addEventListener("caderno:mine", onSay);
    return () => window.removeEventListener("caderno:mine", onSay);
  }, []);

  useEffect(() => {
    if (seen.current.has(route)) return;
    seen.current.add(route);
    const tips = routeTips[route];
    if (!tips) return;
    const id = window.setTimeout(() => say(tips[Math.floor(Math.random() * tips.length)], "idle"), 900);
    return () => window.clearTimeout(id);
  }, [route]);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    let last: PointerEvent | null = null;
    const paint = () => {
      frame = 0;
      const eyes = eyesRef.current;
      const root = rootRef.current;
      if (!eyes || !root || !last) return;
      const rect = root.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.45;
      const angle = Math.atan2(last.clientY - cy, last.clientX - cx);
      const reach = Math.min(1, Math.hypot(last.clientX - cx, last.clientY - cy) / 500);
      eyes.setAttribute("transform", `translate(${(Math.cos(angle) * 7 * reach).toFixed(2)} ${(Math.sin(angle) * 6 * reach).toFixed(2)})`);
    };
    const onMove = (event: PointerEvent) => {
      last = event;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    let blinkId = 0;
    const scheduleBlink = () => {
      blinkId = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 150);
        scheduleBlink();
      }, 2600 + Math.random() * 3400);
    };
    scheduleBlink();
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
      window.clearTimeout(blinkId);
    };
  }, [reduced]);

  const mood = bubble?.mood || "idle";
  return (
    <div ref={rootRef} className={`caderno-buddy ${bubble ? "is-talking" : ""}`} data-mood={mood} data-tour="buddy">
      {bubble ? (
        <motion.div
          key={bubble.key}
          className="caderno-buddy-bubble"
          role="status"
          initial={reduced ? false : { opacity: 0, y: 10, scale: 0.8, rotate: -6 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotate: -2 }}
          transition={{ type: "spring", stiffness: 420, damping: 22 }}
        >
          {bubble.text}
          <button type="button" className="caderno-buddy-close" aria-label="Dispensar recado da Mine" onClick={() => setBubble(null)}>
            ×
          </button>
        </motion.div>
      ) : null}
      <button type="button" className="caderno-buddy-face" onClick={onOpen} aria-label="Conversar com a Mine" title="Conversar com a Mine">
        <svg viewBox="0 0 120 120" aria-hidden>
          <line className="b-stroke" x1="60" y1="14" x2="60" y2="30" />
          <circle className="b-bulb b-stroke" cx="60" cy="11" r="7" />
          <rect className="b-ear b-stroke" x="10" y="54" width="14" height="30" rx="6" />
          <rect className="b-ear b-stroke" x="96" y="54" width="14" height="30" rx="6" />
          <rect className="b-head b-stroke" x="20" y="30" width="80" height="80" rx="26" />
          <rect className="b-visor b-stroke" x="31" y="46" width="58" height="42" rx="16" />
          <g ref={eyesRef}>
            {mood === "happy" || mood === "wow" ? (
              <>
                <path className="b-stroke b-thin" d="M41 66 q6 -8 12 0" />
                <path className="b-stroke b-thin" d="M67 66 q6 -8 12 0" />
              </>
            ) : (
              <>
                <ellipse className="b-eye" cx="47" cy="64" rx="5" ry={blink ? 0.8 : 6.5} />
                <ellipse className="b-eye" cx="73" cy="64" rx="5" ry={blink ? 0.8 : 6.5} />
              </>
            )}
          </g>
          {mood === "wow" ? <ellipse className="b-stroke b-thin" cx="60" cy="79" rx="4" ry="5" /> : <path className="b-stroke b-thin" d="M52 77 Q60 84 68 77" />}
        </svg>
      </button>
    </div>
  );
}

export { playChime, playPageFlip, playPencil, playPop, playStamp, setSoundsEnabled, soundsEnabled } from "./sons";
