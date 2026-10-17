import type { Config } from "tailwindcss";

const noise =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Caderno vivo: letra de leitura feita para legibilidade, título largo
        // e variável, a mão da caneta para anotações e números em máquina.
        sans: ["Atkinson Hyperlegible Next Variable", "Atkinson Hyperlegible", "system-ui", "sans-serif"],
        display: ["Anybody Variable", "Atkinson Hyperlegible Next Variable", "system-ui", "sans-serif"],
        hand: ["Gochi Hand", "Comic Sans MS", "cursive"],
        mono: ["DM Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        ink: "rgb(var(--ink) / <alpha-value>)",
        graphite: "rgb(var(--graphite) / <alpha-value>)",
        panel: "rgb(var(--panel) / <alpha-value>)",
        panel2: "rgb(var(--panel-2) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        mint: "rgb(var(--mint) / <alpha-value>)",
        mintDeep: "rgb(var(--mint-deep) / <alpha-value>)",
        cyanGlow: "rgb(var(--cyan) / <alpha-value>)",
        violetGlow: "rgb(var(--violet) / <alpha-value>)",
        amberGlow: "rgb(var(--amber) / <alpha-value>)",
        roseGlow: "rgb(var(--rose) / <alpha-value>)",
        pen: "rgb(var(--pen) / <alpha-value>)",
        paper: "rgb(var(--paper) / <alpha-value>)",
        sheet: "rgb(var(--sheet) / <alpha-value>)",
        rule: "rgb(var(--rule) / <alpha-value>)",
        margin: "rgb(var(--margin-line) / <alpha-value>)",
        hlYellow: "rgb(var(--hl-yellow) / <alpha-value>)",
        hlPink: "rgb(var(--hl-pink) / <alpha-value>)",
        hlLilac: "rgb(var(--hl-lilac) / <alpha-value>)",
        hlMint: "rgb(var(--hl-mint) / <alpha-value>)",
      },
      boxShadow: {
        glow: "0 18px 44px -24px rgb(var(--mint) / 0.66)",
        glowSoft: "0 14px 32px -22px rgb(var(--mint) / 0.48)",
        glowCyan: "0 16px 40px -24px rgba(69, 223, 255, 0.52)",
        panel: "inset 0 1px 0 0 rgba(255,255,255,0.045), 0 20px 54px -38px rgba(0,0,0,0.8)",
        lift: "0 28px 72px -46px rgba(0,0,0,0.9), inset 0 1px 0 0 rgba(255,255,255,0.05)",
        inset1: "inset 0 1px 0 0 rgba(255,255,255,0.07)",
      },
      backgroundImage: {
        noise,
        "mesh-mint":
          "radial-gradient(at 12% 8%, rgb(var(--mint) / .15) 0px, transparent 55%), radial-gradient(at 88% 12%, rgb(var(--cyan) / .11) 0px, transparent 52%)",
        "sheen-line": "linear-gradient(90deg, transparent, rgb(var(--mint) / .7), transparent)",
      },
      backgroundSize: {
        grid: "60px 60px",
        "grid-sm": "28px 28px",
        pan: "220% 220%",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "back-out": "cubic-bezier(0.34, 1.4, 0.64, 1)",
      },
      transitionProperty: {
        // Substitui `transition-all` nos controles. A lista é explícita de
        // propósito: `all` também anima largura, altura e margem, então uma
        // mudança de layout que nada tinha a ver com o hover entra na transição
        // e força reflow. Aqui só entram propriedades de pintura e composição.
        control: "color, background-color, border-color, fill, stroke, opacity, box-shadow, transform",
      },
      transitionDuration: {
        // Espelham os tokens de src/motion.tsx — mesma escala nos dois lados.
        control: "140ms",
        surface: "240ms",
        section: "420ms",
      },
      animation: {
        "slow-spin": "slowSpin 26s linear infinite",
        "spin-slow": "slowSpin 9s linear infinite",
        "float-soft": "floatSoft 6s ease-in-out infinite",
        "float-3d": "float3d 11s ease-in-out infinite",
        "scan-line": "scanLine 7s ease-in-out infinite",
        aurora: "aurora 18s ease-in-out infinite alternate",
        shine: "shine 2.8s ease-in-out infinite",
        "gradient-pan": "gradientPan 9s ease infinite",
        "pulse-ring": "pulseRing 2.6s cubic-bezier(0.16,1,0.3,1) infinite",
        breathe: "breathe 5.5s ease-in-out infinite",
        "border-glow": "borderGlow 4.5s ease-in-out infinite",
        "caret-blink": "caretBlink 1.1s steps(2, start) infinite",
        "rise-in": "riseIn .6s cubic-bezier(0.16,1,0.3,1) both",
        "tick-in": "tickIn .45s cubic-bezier(0.34,1.4,0.64,1) both",
        marquee: "marquee 30s linear infinite",
      },
      keyframes: {
        slowSpin: {
          to: { transform: "rotate(360deg)" },
        },
        floatSoft: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        float3d: {
          "0%, 100%": { transform: "translate3d(0,0,0) rotateX(0deg) rotateY(0deg)" },
          "33%": { transform: "translate3d(6px,-12px,0) rotateX(5deg) rotateY(-6deg)" },
          "66%": { transform: "translate3d(-6px,-6px,0) rotateX(-4deg) rotateY(6deg)" },
        },
        scanLine: {
          "0%, 100%": { transform: "translateY(-110%)", opacity: "0" },
          "18%, 72%": { opacity: "1" },
          "86%": { transform: "translateY(110%)", opacity: "0" },
        },
        aurora: {
          "0%": { transform: "translate3d(-3%, -2%, 0) scale(1)" },
          "100%": { transform: "translate3d(3%, 2%, 0) scale(1.04)" },
        },
        shine: {
          "0%": { transform: "translateX(-130%)" },
          "62%, 100%": { transform: "translateX(340%)" },
        },
        gradientPan: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        pulseRing: {
          "0%": { transform: "scale(.82)", opacity: "0.6" },
          "70%": { transform: "scale(1.35)", opacity: "0" },
          "100%": { transform: "scale(1.35)", opacity: "0" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.55" },
          "50%": { transform: "scale(1.06)", opacity: "0.9" },
        },
        borderGlow: {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.9" },
        },
        caretBlink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        riseIn: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        tickIn: {
          from: { opacity: "0", transform: "scale(.7)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
