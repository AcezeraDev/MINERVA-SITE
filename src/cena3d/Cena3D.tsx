/**
 * Portão das cenas 3D das abas Redação e Atividades. O three.js só baixa
 * (React.lazy) quando a cena vai mesmo aparecer: tier diferente de "low",
 * sem movimento reduzido e com WebGL. Se a cena quebrar, o ErrorBoundary
 * troca pela ilustração em CSS e a aba segue funcionando.
 */
import React, { useMemo, useState } from "react";
import { useQualityTier, useSoftMotion } from "../motion";

export type ModoFolha = "escrevendo" | "corrigindo";
export type ModoPrancheta = "parada" | "gerando";

const FolhaRedacao3D = React.lazy(() => import("./FolhaRedacao3D"));
const Prancheta3D = React.lazy(() => import("./Prancheta3D"));

function temWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function useCena3D() {
  const reduced = useSoftMotion();
  const tier = useQualityTier();
  const webgl = useMemo(() => (typeof window === "undefined" ? false : temWebGL()), []);
  return webgl && !reduced && tier !== "low";
}

class Guarda extends React.Component<{ onFail: () => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Ilustração parada, usada no tier baixo, com movimento reduzido ou sem WebGL. */
function FolhaPlana({ tipo }: { tipo: "folha" | "prancheta" }) {
  return (
    <div className={`cena3d-plana is-${tipo}`} aria-hidden>
      <span className="cena3d-plana-folha">
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
      {tipo === "prancheta" ? <span className="cena3d-plana-clipe" /> : <span className="cena3d-plana-caneta" />}
    </div>
  );
}

export function CenaFolha({ modo, className = "" }: { modo: ModoFolha; className?: string }) {
  const ligada = useCena3D();
  const [falhou, setFalhou] = useState(false);
  return (
    <div className={`cena3d ${className}`} aria-hidden>
      {ligada && !falhou ? (
        <Guarda onFail={() => setFalhou(true)}>
          <React.Suspense fallback={<FolhaPlana tipo="folha" />}>
            <FolhaRedacao3D modo={modo} />
          </React.Suspense>
        </Guarda>
      ) : (
        <FolhaPlana tipo="folha" />
      )}
    </div>
  );
}

export function CenaPrancheta({ modo, className = "" }: { modo: ModoPrancheta; className?: string }) {
  const ligada = useCena3D();
  const [falhou, setFalhou] = useState(false);
  return (
    <div className={`cena3d ${className}`} aria-hidden>
      {ligada && !falhou ? (
        <Guarda onFail={() => setFalhou(true)}>
          <React.Suspense fallback={<FolhaPlana tipo="prancheta" />}>
            <Prancheta3D modo={modo} />
          </React.Suspense>
        </Guarda>
      ) : (
        <FolhaPlana tipo="prancheta" />
      )}
    </div>
  );
}
