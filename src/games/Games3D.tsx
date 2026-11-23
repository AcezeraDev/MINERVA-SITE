/**
 * Portão do 3D da aba Games. Mesmo contrato de src/cena3d/Cena3D.tsx: o
 * three.js só baixa (React.lazy) quando a cena vai mesmo aparecer — tier
 * diferente de "low", sem movimento reduzido e com WebGL. Fora disso, ou se a
 * cena quebrar, fica a versão desenhada em SVG/CSS e a aba segue igual.
 *
 * A escolha de destino NÃO depende do canvas: a régua de destinos abaixo do
 * mapa é feita de botões (teclado, leitor de tela e toque no celular).
 */
import React, { useEffect, useState } from "react";
import { Check, Trophy } from "lucide-react";
import { useCena3D } from "../cena3d/Cena3D";
import { StudyExpeditionMap } from "./GameArtwork";
import type { ExpeditionNode } from "./ExpeditionMap3D";

const ExpeditionMap3D = React.lazy(() => import("./ExpeditionMap3D"));
const LeagueTrophy3D = React.lazy(() => import("./LeagueTrophy3D"));

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

/** Troca de tema remonta as cenas que leem os tokens só na montagem. */
function useTema() {
  const ler = () => (typeof document !== "undefined" && document.documentElement.classList.contains("theme-light") ? "claro" : "escuro");
  const [tema, setTema] = useState(ler);
  useEffect(() => {
    const mo = new MutationObserver(() => setTema(ler()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return tema;
}

export function ExpeditionStage({
  nodes,
  selectedId,
  label,
  onSelect,
  onLaunch,
}: {
  nodes: Array<ExpeditionNode & { short: string }>;
  selectedId: string;
  label: string;
  onSelect: (id: string) => void;
  onLaunch: (id: string) => void;
}) {
  const ligada = useCena3D();
  const [falhou, setFalhou] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const visited = nodes.filter((n) => n.visited).length;
  const plano = <StudyExpeditionMap completedCount={visited} label={label} />;
  const em3D = ligada && !falhou;

  return (
    <div className={`games-map3d-wrap ${em3D ? "is-3d" : "is-flat"}`}>
      <div className="games-map3d-stage">
        {em3D ? (
          <Guarda onFail={() => setFalhou(true)}>
            <React.Suspense fallback={plano}>
              <ExpeditionMap3D nodes={nodes} selectedId={selectedId} onSelect={onSelect} onLaunch={onLaunch} onHover={setHover} />
            </React.Suspense>
          </Guarda>
        ) : (
          plano
        )}
      </div>
      <div className="games-map3d-route" role="radiogroup" aria-label="Escolha o destino da expedição">
        {nodes.map((node, index) => {
          const ativo = node.id === selectedId;
          return (
            <button
              key={node.id}
              type="button"
              role="radio"
              aria-checked={ativo}
              aria-label={`${node.name}${node.visited ? " (já explorado)" : ""}`}
              className={`games-map3d-stop ${ativo ? "is-active" : ""} ${hover === node.id ? "is-hover" : ""}`}
              style={{ "--stop-accent": node.accent } as React.CSSProperties}
              onClick={() => (ativo ? onLaunch(node.id) : onSelect(node.id))}
              onDoubleClick={() => onLaunch(node.id)}
            >
              <span className="games-map3d-stop__n" aria-hidden>
                {node.visited ? <Check className="h-3 w-3" strokeWidth={3} /> : String(index + 1).padStart(2, "0")}
              </span>
              <span className="games-map3d-stop__name">{node.short}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LeagueTrophy({ leagueId, color, name, size = "md" }: { leagueId: string; color: string; name: string; size?: "sm" | "md" }) {
  const ligada = useCena3D();
  const [falhou, setFalhou] = useState(false);
  const tema = useTema();
  const medalha = (
    <div className={`league-trophy-flat is-${size}`} style={{ "--league": color } as React.CSSProperties} role="img" aria-label={`Emblema da Liga ${name}`}>
      <span>
        <Trophy className="h-1/2 w-1/2" strokeWidth={1.8} />
      </span>
    </div>
  );
  if (!ligada || falhou) return medalha;
  return (
    <Guarda onFail={() => setFalhou(true)}>
      <React.Suspense fallback={medalha}>
        <LeagueTrophy3D key={tema} leagueId={leagueId} color={color} size={size} />
      </React.Suspense>
    </Guarda>
  );
}
