import { lazy, Suspense } from "react";

/**
 * Efeitos de texto do React Bits.
 *
 * O efeito carrega sob demanda e cai para texto normal quando o usuário pede
 * menos movimento.
 */

const DepthText = lazy(() => import("./DepthText"));

/** Palavra em relevo 3D usada como marca da aba de jogos. */
export function DepthWord({ text, reduced }: { text: string; reduced: boolean }) {
  const plain = (
    <span className="font-display text-5xl font-black tracking-tight text-white sm:text-6xl">{text}</span>
  );
  if (reduced) return plain;
  return (
    <Suspense fallback={plain}>
      <DepthText
        text={text}
        layers={26}
        depth={2}
        faceColor="#F8FAFC"
        depthColor="#0f8f5a"
        tilt={7}
        pointerTracking
        smoothing={0.14}
        perspective={900}
        autoOrbit
        orbitSpeed={0.3}
        fontSize="clamp(2.75rem, 8vw, 4.5rem)"
        fontWeight={900}
        shadow
      />
    </Suspense>
  );
}
