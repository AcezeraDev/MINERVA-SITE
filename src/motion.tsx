import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type Transition,
  type Variants,
} from "framer-motion";

/**
 * Primitivas de movimento do Minerva.
 *
 * Tudo aqui respeita duas fontes de "menos movimento": a preferência do sistema
 * (prefers-reduced-motion) e o ajuste do próprio usuário dentro do app, que chega
 * via <MotionPreference>. Quando qualquer uma está ligada, os componentes ainda
 * renderizam — só param de se mexer.
 */

const MotionPreferenceContext = createContext(false);

export function MotionPreference({ reduced, children }: { reduced: boolean; children: React.ReactNode }) {
  return <MotionPreferenceContext.Provider value={reduced}>{children}</MotionPreferenceContext.Provider>;
}

export function useSoftMotion() {
  const system = useReducedMotion();
  const app = useContext(MotionPreferenceContext);
  return Boolean(system) || app;
}

/* ----------------------------------------------------------- nível de custo */

/**
 * Quanto efeito o aparelho aguenta.
 *
 * Deriva de capacidade real (largura, densidade de pixel, tipo de ponteiro,
 * economia de dados) em vez de adivinhar pelo user agent. Os fundos WebGL e o
 * globo usam isso para escolher densidade e DPR: um celular não deve rodar a
 * mesma contagem de partículas que um desktop só porque a tela é menor.
 *
 * Começa em "medium" porque é o palpite que erra menos feio nos dois sentidos —
 * a medição real chega no primeiro efeito, antes da primeira pintura.
 */
export type QualityTier = "low" | "medium" | "high";

function measureTier(): QualityTier {
  if (typeof window === "undefined") return "medium";
  const width = window.innerWidth;
  const dpr = window.devicePixelRatio || 1;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  // saveData não é padrão em todos os navegadores; quando existe, respeitamos.
  const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return "low";
  // Tela pequena com muita densidade é o caso mais castigado: muitos pixels
  // para preencher e, em geral, GPU móvel.
  if (width < 640 || (coarse && dpr > 2)) return "low";
  if (width < 1280 || coarse) return "medium";
  return "high";
}

export function useQualityTier(): QualityTier {
  const reduced = useSoftMotion();
  const [tier, setTier] = useState<QualityTier>("medium");

  useEffect(() => {
    const update = () => setTier(measureTier());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return reduced ? "low" : tier;
}

/** Teto de DPR por nível — evita renderizar 4x pixels num celular. */
export function dprCap(tier: QualityTier) {
  return tier === "high" ? 2 : tier === "medium" ? 1.5 : 1;
}

/* ------------------------------------------------------------------ curvas */

export const ease = {
  /** saída suave padrão — a maioria das entradas usa isso */
  out: [0.16, 1, 0.3, 1] as const,
  /** entrada e saída equilibradas, para movimentos que voltam */
  inOut: [0.65, 0, 0.35, 1] as const,
  /** leve overshoot, bom para elementos que "chegam" */
  back: [0.34, 1.4, 0.64, 1] as const,
};

/**
 * Escala de duração.
 *
 * A regra é uma só: quanto mais frequente o gesto, mais curta a duração. Um
 * hover de botão acontece centenas de vezes por sessão e precisa ser imediato;
 * a entrada de uma seção acontece uma vez e pode se dar ao luxo de ser lenta.
 * Usar o mesmo tempo para os dois — que era o caso aqui, `duration-300` em tudo —
 * faz o app inteiro parecer lento mesmo quando está rápido.
 */
export const dur = {
  /** hover, foco, pressionado, troca de cor: alta frequência, quase instantâneo */
  control: 0.14,
  /** superfície que abre ou fecha: menu, popover, painel, toast */
  surface: 0.24,
  /** troca de rota */
  route: 0.3,
  /** entrada de seção ao rolar */
  section: 0.42,
};

/** Mesmos números em milissegundos, para quem precisa de CSS ou setTimeout. */
export const durMs = {
  control: dur.control * 1000,
  surface: dur.surface * 1000,
  route: dur.route * 1000,
  section: dur.section * 1000,
};

/** Configuração crua das molas — serve tanto para useSpring quanto para transition. */
const springOptions = {
  soft: { stiffness: 170, damping: 24, mass: 0.9 },
  snappy: { stiffness: 420, damping: 32, mass: 0.6 },
  gentle: { stiffness: 90, damping: 20, mass: 1.1 },
};

export const spring = {
  soft: { type: "spring", ...springOptions.soft } as Transition,
  snappy: { type: "spring", ...springOptions.snappy } as Transition,
  gentle: { type: "spring", ...springOptions.gentle } as Transition,
};

/**
 * Transição espacial do shell: cada área chega como um novo plano de trabalho.
 *
 * Só transform e opacity de propósito. A versão anterior animava
 * `filter: blur(15px)` na página inteira por 560ms a cada navegação — o blur é
 * um filtro de tela cheia recalculado a cada quadro, então trocar de aba custava
 * mais que renderizar a aba. O `rotateX` saiu junto: promovia a página a camada
 * 3D sem ganho visual real depois que o blur sumiu.
 */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 18, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: dur.route, ease: ease.out } },
  exit: { opacity: 0, y: -10, scale: 0.99, transition: { duration: 0.16, ease: ease.inOut } },
};

/* ------------------------------------------------------------------ Reveal */

type RevealDirection = "up" | "down" | "left" | "right" | "scale" | "none";

const offsetFor = (direction: RevealDirection, distance: number) => {
  switch (direction) {
    case "up":
      return { y: distance };
    case "down":
      return { y: -distance };
    case "left":
      return { x: distance };
    case "right":
      return { x: -distance };
    default:
      return {};
  }
};

/**
 * Aparece quando entra na viewport. É o bloco de construção de quase toda a
 * página: cada seção é um Reveal com um delay ligeiramente maior que o anterior.
 *
 * `blur` vem desligado. São 51 Reveals no app e o blur animado é caro: cada um
 * vira um filtro de tela que o compositor refaz a cada quadro da entrada. Em
 * texto curto o efeito é bonito e barato — por isso a prop continua existindo —
 * mas como padrão de seção inteira ele custava muito mais do que entregava.
 */
export function Reveal({
  children,
  delay = 0,
  direction = "up",
  distance = 20,
  blur = 0,
  duration = dur.section,
  once = true,
  className = "",
  amount = 0.18,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: RevealDirection;
  distance?: number;
  blur?: number;
  duration?: number;
  once?: boolean;
  className?: string;
  amount?: number;
  style?: React.CSSProperties;
}) {
  const reduced = useSoftMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, amount, margin: "0px 0px -8% 0px" });

  if (reduced) {
    return (
      <div ref={ref} className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial={{
        opacity: 0,
        filter: blur ? `blur(${blur}px)` : undefined,
        scale: direction === "scale" ? 0.94 : 1,
        ...offsetFor(direction, distance),
      }}
      animate={
        inView
          ? { opacity: 1, x: 0, y: 0, scale: 1, filter: blur ? "blur(0px)" : undefined }
          : undefined
      }
      transition={{ duration, delay, ease: ease.out }}
    >
      {children}
    </motion.div>
  );
}

/* ----------------------------------------------------------------- Stagger */

/** Contêiner que solta os filhos em cascata quando entra na tela. */
export function Stagger({
  children,
  className = "",
  gap = 0.065,
  delay = 0,
  amount = 0.12,
  once = true,
}: {
  children: React.ReactNode;
  className?: string;
  gap?: number;
  delay?: number;
  amount?: number;
  once?: boolean;
}) {
  const reduced = useSoftMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, amount });

  if (reduced) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: gap, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Sem blur pelo mesmo motivo do Reveal, e com peso extra aqui: um Stagger tem
 * vários filhos, então o custo do filtro se multiplica pela cascata inteira.
 */
export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: dur.section, ease: ease.out } },
};

/** Filho direto de <Stagger>. */
export function StaggerItem({
  children,
  className = "",
  variants = staggerChild,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  variants?: Variants;
  style?: React.CSSProperties;
}) {
  const reduced = useSoftMotion();
  if (reduced) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <motion.div className={className} style={style} variants={variants}>
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ Tilt3D */

/**
 * Cartão que inclina em 3D seguindo o ponteiro, com brilho especular
 * acompanhando a inclinação. Usa perspective + rotateX/rotateY reais.
 */
export function Tilt3D({
  children,
  className = "",
  max = 9,
  scale = 1.015,
  glare = true,
  lift = 6,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
  scale?: number;
  glare?: boolean;
  lift?: number;
}) {
  const reduced = useSoftMotion();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const active = useMotionValue(0);

  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), springOptions.soft);
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), springOptions.soft);
  const z = useSpring(useTransform(active, [0, 1], [0, lift]), springOptions.soft);
  const glareOpacity = useSpring(useTransform(active, [0, 1], [0, 0.5]), springOptions.soft);
  const glareX = useTransform(px, (v) => `${v * 100}%`);
  const glareY = useTransform(py, (v) => `${v * 100}%`);
  const glareBg = useMotionTemplate`radial-gradient(420px circle at ${glareX} ${glareY}, rgba(255,255,255,0.16), transparent 62%)`;

  function onMove(event: React.PointerEvent<HTMLDivElement>) {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    px.set((event.clientX - rect.left) / rect.width);
    py.set((event.clientY - rect.top) / rect.height);
  }

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      className={`relative [transform-style:preserve-3d] ${className}`}
      style={{ rotateX, rotateY, translateZ: z, perspective: 1100 }}
      whileHover={{ scale }}
      transition={spring.soft}
      onPointerMove={onMove}
      onPointerEnter={() => active.set(1)}
      onPointerLeave={() => {
        active.set(0);
        px.set(0.5);
        py.set(0.5);
      }}
    >
      {children}
      {glare ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ backgroundImage: glareBg, opacity: glareOpacity }}
        />
      ) : null}
    </motion.div>
  );
}

/* ---------------------------------------------------------------- Spotlight */

/**
 * Superfície que acende um halo onde o ponteiro está. Diferente do Tilt3D,
 * não move nada — serve para cartões densos, listas e painéis grandes.
 *
 * O halo é pintado por CSS a partir de duas variáveis que o ponteiro escreve
 * direto no nó. Nada disso passa pelo React: `GlassCard` e `HeroCard` são as
 * primitivas de cartão do app inteiro, então guardar a posição em estado fazia
 * cada mexida de mouse re-renderizar a subárvore da carta — em telas com dezenas
 * de cartas, o custo era o app inteiro respondendo a `pointermove`.
 *
 * O retângulo é medido uma vez, na entrada do ponteiro, em vez de a cada evento:
 * `getBoundingClientRect` dentro do handler força o navegador a recalcular
 * layout no meio do movimento.
 */
export function Spotlight({
  children,
  className = "",
  color = "rgba(52,211,153,0.16)",
  size = 420,
}: {
  children: React.ReactNode;
  className?: string;
  color?: string;
  size?: number;
}) {
  const reduced = useSoftMotion();
  const ref = useRef<HTMLDivElement>(null);
  const rect = useRef<DOMRect | null>(null);
  const [pointerFine, setPointerFine] = useState(false);

  // Halo é enfeite de ponteiro fino: no toque não existe "passar por cima",
  // e o gradiente ficaria preso no último ponto tocado.
  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setPointerFine(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const active = pointerFine && !reduced;

  function setVar(name: string, value: string) {
    ref.current?.style.setProperty(name, value);
  }

  function onEnter() {
    rect.current = ref.current?.getBoundingClientRect() || null;
    setVar("--spot-on", "1");
  }

  function onMove(event: React.PointerEvent<HTMLDivElement>) {
    const box = rect.current;
    if (!box) return;
    setVar("--spot-x", `${event.clientX - box.left}px`);
    setVar("--spot-y", `${event.clientY - box.top}px`);
  }

  function onLeave() {
    rect.current = null;
    setVar("--spot-on", "0");
  }

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${className}`}
      onPointerEnter={active ? onEnter : undefined}
      onPointerMove={active ? onMove : undefined}
      onPointerLeave={active ? onLeave : undefined}
    >
      {active ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: "var(--spot-on, 0)",
            transitionProperty: "opacity",
            transitionDuration: `${durMs.surface}ms`,
            background: `radial-gradient(${size}px circle at var(--spot-x, 50%) var(--spot-y, 50%), ${color}, transparent 70%)`,
          }}
        />
      ) : null}
      <div className="relative">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- Magnetic */

/** Botão/ícone que é levemente atraído pelo ponteiro. */
export function Magnetic({
  children,
  className = "",
  strength = 0.28,
  radius = 90,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
  radius?: number;
}) {
  const reduced = useSoftMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(useMotionValue(0), springOptions.snappy);
  const y = useSpring(useMotionValue(0), springOptions.snappy);

  function onMove(event: React.PointerEvent<HTMLDivElement>) {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    const falloff = Math.max(0, 1 - distance / (radius + Math.max(rect.width, rect.height) / 2));
    x.set(dx * strength * falloff);
    y.set(dy * strength * falloff);
  }

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      className={`inline-flex ${className}`}
      style={{ x, y }}
      onPointerMove={onMove}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/* ----------------------------------------------------------------- CountUp */

/** Número que sobe até o valor com física de mola, sem re-renderizar o React. */
export function CountUp({
  value,
  className = "",
  suffix = "",
  prefix = "",
  decimals = 0,
}: {
  value: number;
  className?: string;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}) {
  const reduced = useSoftMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const raw = useMotionValue(0);
  const smooth = useSpring(raw, { stiffness: 62, damping: 18, mass: 0.9 });
  const text = useTransform(smooth, (latest) =>
    `${prefix}${latest.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`
  );

  useEffect(() => {
    if (!inView) return;
    raw.set(value);
    // Rede de segurança: se a animação não puder rodar (aba em segundo plano,
    // rAF suspenso), o número salta para o valor final em vez de ficar em zero.
    const settle = window.setTimeout(() => smooth.jump(value), 2600);
    return () => window.clearTimeout(settle);
  }, [inView, value, raw, smooth]);

  if (reduced) {
    return (
      <span ref={ref} className={className}>
        {prefix}
        {value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
        {suffix}
      </span>
    );
  }

  return (
    <span ref={ref} className={className}>
      <motion.span>{text as unknown as React.ReactNode}</motion.span>
    </span>
  );
}

/* ------------------------------------------------------------- ProgressRing */

/** Anel de progresso com degradê, desenhado animando o strokeDashoffset. */
export function ProgressRing({
  value,
  size = 148,
  stroke = 10,
  label,
  sublabel,
  gradient = ["#34D399", "#38BDF8"],
  className = "",
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: React.ReactNode;
  sublabel?: string;
  gradient?: [string, string];
  className?: string;
}) {
  const reduced = useSoftMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const gradientId = useRef(`ring-${Math.random().toString(36).slice(2, 9)}`).current;

  return (
    <div ref={ref} className={`relative grid place-items-center ${className}`} style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradient[0]} />
            <stop offset="100%" stopColor={gradient[1]} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: reduced ? circumference * (1 - clamped / 100) : circumference }}
          animate={{ strokeDashoffset: inView || reduced ? circumference * (1 - clamped / 100) : circumference }}
          transition={{ duration: reduced ? 0 : 1.15, ease: ease.out }}
          style={{ filter: `drop-shadow(0 0 8px ${gradient[0]}55)` }}
        />
      </svg>
      <div className="pointer-events-none text-center">
        {label}
        {sublabel ? <p className="text-[11px] font-bold uppercase tracking-[.16em] text-white/45">{sublabel}</p> : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- SplitWords */

/** Título que entra palavra por palavra. Usar só em headings curtos. */
export function SplitWords({
  text,
  className = "",
  delay = 0,
  gap = 0.045,
}: {
  text: string;
  className?: string;
  delay?: number;
  gap?: number;
}) {
  const reduced = useSoftMotion();
  const words = text.split(" ");

  if (reduced) return <span className={className}>{text}</span>;

  return (
    <motion.span
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
    >
      {words.map((word, index) => (
        <span key={`${word}-${index}`} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className="inline-block"
            variants={{
              hidden: { y: "108%", opacity: 0, rotate: 4 },
              show: { y: "0%", opacity: 1, rotate: 0, transition: { duration: 0.7, ease: ease.out } },
            }}
          >
            {word}
            {index < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}

/* ------------------------------------------------------------- AnimatedBar */

/** Barra de progresso que cresce a partir da esquerda quando entra na tela. */
export function AnimatedBar({
  value,
  className = "",
  height = 8,
  from = "#34D399",
  to = "#38BDF8",
  delay = 0,
}: {
  value: number;
  className?: string;
  height?: number;
  from?: string;
  to?: string;
  delay?: number;
}) {
  const reduced = useSoftMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden rounded-full bg-white/[0.08] ${className}`}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ backgroundImage: `linear-gradient(90deg, ${from}, ${to})`, boxShadow: `0 0 16px ${from}55` }}
        initial={{ width: reduced ? `${clamped}%` : 0 }}
        animate={{ width: inView || reduced ? `${clamped}%` : 0 }}
        transition={{ duration: reduced ? 0 : 0.95, ease: ease.out, delay: reduced ? 0 : delay }}
      />
      {!reduced && clamped > 0 ? (
        <motion.span
          aria-hidden
          className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/35 to-transparent"
          initial={{ x: "-100%" }}
          animate={{ x: ["-100%", "620%"] }}
          transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 2.4, ease: ease.inOut, delay: 1 + delay }}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- ShineBorder */

/** Moldura com um traço de luz girando na borda. Para destacar 1 elemento por tela. */
export function ShineBorder({
  children,
  className = "",
  radius = 28,
  duration = 8,
}: {
  children: React.ReactNode;
  className?: string;
  radius?: number;
  duration?: number;
}) {
  const reduced = useSoftMotion();
  return (
    <div className={`relative ${className}`} style={{ borderRadius: radius }}>
      {!reduced ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-px overflow-hidden opacity-70"
          style={{ borderRadius: radius + 1 }}
        >
          <span
            className="absolute left-1/2 top-1/2 aspect-square w-[240%] -translate-x-1/2 -translate-y-1/2 animate-spin-slow"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, rgba(52,211,153,.9) 22deg, rgba(56,189,248,.75) 48deg, transparent 96deg, transparent 360deg)",
              animationDuration: `${duration}s`,
            }}
          />
        </span>
      ) : null}
      <div className="relative h-full" style={{ borderRadius: radius }}>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

/** Presença animada para listas que ganham/perdem itens. */
export function AnimatedList({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <AnimatePresence initial={false} mode="popLayout">
        {children}
      </AnimatePresence>
    </div>
  );
}

export function ListItem({
  children,
  className = "",
  layoutId,
}: {
  children: React.ReactNode;
  className?: string;
  layoutId?: string;
}) {
  const reduced = useSoftMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      layout
      layoutId={layoutId}
      className={className}
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -18, scale: 0.96, transition: { duration: 0.18 } }}
      transition={spring.soft}
    >
      {children}
    </motion.div>
  );
}

/** Valor 0..1 do quanto a página já foi rolada — usado na barra do topo. */
export function useScrollProgress() {
  const progress = useMotionValue(0);
  useEffect(() => {
    function update() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.set(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [progress]);
  return progress;
}
