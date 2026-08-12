import { lazy, Suspense, type CSSProperties, type ReactNode } from "react";
import { useQualityTier } from "../motion";

// Distribuição dos fundos animados por tela. Regras que valem para os três:
//
// - Um de cada vez: nunca empilhamos dois loops de animação na mesma tela.
// - Carregam sob demanda, somente quando a rota realmente usa o efeito.
// - Somem quando o usuário pede menos movimento.
// - Nenhum deles recebe clique: são decoração, o conteúdo fica por cima.

const Waves = lazy(() => import("./Waves"));
const LightRays = lazy(() => import("../components/LightRays"));

const structuredViews = new Set(["subject", "agenda", "foco", "plan"]);
const intelligenceViews = new Set(["mine", "games", "search"]);
const communityViews = new Set(["comments", "suggestions", "updates", "about", "settings"]);

function workspaceTone(route: string) {
  if (intelligenceViews.has(route)) return { wash: "rgb(var(--mint) / 0.2)" };
  if (structuredViews.has(route)) return { wash: "rgb(var(--mint) / 0.18)" };
  if (communityViews.has(route)) return { wash: "rgb(var(--mint) / 0.16)" };
  if (route === "progress" || route === "ranking") return { wash: "rgb(var(--mint) / 0.18)" };
  return { wash: "rgb(var(--mint) / 0.19)" };
}

function Backdrop({ children, className }: { children: ReactNode; className: string }) {
  return (
    <div aria-hidden className={className}>
      <Suspense fallback={null}>{children}</Suspense>
    </div>
  );
}

/**
 * Aparelho sem folga não recebe fundo animado nenhum.
 *
 * Não é o mesmo que "menos movimento": quem pede menos movimento está fazendo
 * uma escolha, e isso já é tratado pelo `reduced`. Aqui é capacidade — tela
 * pequena com muito pixel, ou economia de dados ligada. Nesses casos um shader
 * de tela cheia é o item mais caro da página inteira, e é o primeiro a sair.
 * Junto com o `.low-fx`, que desliga o vidro, é o que permite manter o efeito
 * forte no desktop sem punir quem está no celular.
 */
function useBackdropEnabled(reduced: boolean) {
  const tier = useQualityTier();
  return !reduced && tier !== "low";
}

/**
 * Tela de entrada.
 *
 * Era o MagicRings, trocado por dois motivos. O visual: eram anéis fracos
 * disputando a mesma viewport com os anéis do KnowledgeCore, dois sistemas de
 * forma parecida e nenhum forte o bastante para ler. E o custo: o MagicRings era
 * o único consumidor de three.js no projeto inteiro, ou seja, a tela de login
 * baixava um chunk de meio megabyte para desenhar um efeito quase invisível.
 * O LightRays faz o mesmo trabalho em ogl, que já vinha junto do RippleGrid.
 *
 * Feixe vindo de cima também convive melhor com texto do que anel: a luz cai
 * atrás do headline em vez de cruzar por cima dele.
 */
export function AuthBackdrop({ reduced, accentColor = "#39F59A" }: { reduced: boolean; accentColor?: string }) {
  if (!useBackdropEnabled(reduced)) return null;
  return (
    <Backdrop className="pointer-events-none fixed inset-0 z-0 opacity-[0.72]">
      <LightRays
        raysOrigin="top-center"
        raysColor={accentColor}
        raysSpeed={1.05}
        lightSpread={0.7}
        rayLength={2.4}
        fadeDistance={1.6}
        saturation={1.08}
        followMouse
        mouseInfluence={0.16}
        noiseAmount={0.06}
        distortion={0.04}
      />
    </Backdrop>
  );
}

/** Um vocabulário de fundo por área, sem empilhar efeitos na mesma tela. */
export function WorkspaceBackdrop({ route, reduced }: { route: string; reduced: boolean }) {
  const tone = workspaceTone(route);
  return (
    <Backdrop className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="quiet-aurora absolute inset-0"
        data-reduced-motion={reduced ? "true" : undefined}
        style={{ "--quiet-wash": tone.wash } as CSSProperties}
      />
    </Backdrop>
  );
}

/**
 * Painel administrativo claro: o layer fica dentro do container e abaixo do conteúdo.
 * A cor da linha é mais fechada que a dos outros dois porque verde neon sobre
 * branco briga com as tabelas de dados.
 */
export function AdminBackdrop({ reduced }: { reduced: boolean }) {
  if (!useBackdropEnabled(reduced)) return null;
  return (
    <Backdrop className="pointer-events-none fixed inset-0 z-0 opacity-50">
      <Waves
        lineColor="#0f8f5a"
        lineWidth={1.4}
        backgroundColor="transparent"
        waveSpeedX={0.06}
        waveSpeedY={0.01}
        waveAmpX={40}
        waveAmpY={20}
        friction={0.9}
        tension={0.01}
        maxCursorMove={120}
        xGap={12}
        yGap={36}
      />
    </Backdrop>
  );
}
