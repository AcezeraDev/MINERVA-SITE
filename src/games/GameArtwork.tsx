import React, { useId } from "react";

export type GameArtworkId = "corrida" | "memoria" | "forca" | "caca" | "nexo" | "sequencia";

type GameArtworkProps = {
  game: GameArtworkId;
  accent: string;
  label?: string;
  decorative?: boolean;
  className?: string;
};

function NexoScene() {
  return (
    <>
      <path className="game-artwork__contour" d="M-20 280C80 218 134 326 238 265s154-84 246-20 128 28 188-12" />
      <path className="game-artwork__contour" d="M-12 314c92-55 168 28 248-2 86-33 119-65 202-32 80 32 141 18 222-31" />
      <g className="game-artwork__network">
        <path className="game-artwork__route" d="M108 242 220 166 321 219 429 130 535 197" />
        <path d="m220 166 31-76m70 129 15 69m93-158 61-55m-61 55 106 67M220 166 126 96" />
        {[ [108,242,12], [220,166,18], [321,219,13], [429,130,20], [535,197,14], [251,90,9], [336,288,8], [490,75,9], [126,96,8] ].map(([cx, cy, r], index) => (
          <g key={`${cx}-${cy}`} className={index === 3 ? "game-artwork__hero-node" : ""}>
            <circle cx={cx} cy={cy} r={r + 8} className="game-artwork__node-halo" />
            <circle cx={cx} cy={cy} r={r} className="game-artwork__node" />
          </g>
        ))}
      </g>
      <path className="game-artwork__leaf" d="M66 85c45-36 79-18 85 22-38 13-67 1-85-22Z" />
      <path className="game-artwork__leaf game-artwork__leaf--small" d="M500 264c29-24 57-12 59 18-27 8-47 1-59-18Z" />
    </>
  );
}

function SequenceScene() {
  const modules = [
    { x: 83, teeth: 6, active: false },
    { x: 210, teeth: 8, active: true },
    { x: 337, teeth: 10, active: false },
    { x: 464, teeth: 12, active: false },
  ];
  return (
    <>
      <path className="game-artwork__bench" d="M35 282h570M62 309h516" />
      <path className="game-artwork__route" d="M92 85h455" />
      <g className="game-artwork__sequence-arrow">
        <path d="m177 184 23 0m104 0h23m104 0h23" />
        <path d="m194 178 8 6-8 6m127-12 8 6-8 6m127-12 8 6-8 6" />
      </g>
      {modules.map((module, index) => (
        <g key={module.x} transform={`translate(${module.x} 130)`} className={module.active ? "game-artwork__module game-artwork__module--active" : "game-artwork__module"}>
          <rect width="94" height="110" rx="16" />
          <circle cx="47" cy="47" r="25" />
          <circle cx="47" cy="47" r="8" className="game-artwork__module-core" />
          {Array.from({ length: module.teeth }).map((_, tooth) => {
            const angle = (360 / module.teeth) * tooth;
            return <path key={tooth} d="M47 15v-8" transform={`rotate(${angle} 47 47)`} />;
          })}
          <text x="47" y="92" textAnchor="middle">0{index + 1}</text>
        </g>
      ))}
    </>
  );
}

function JourneyScene() {
  return (
    <>
      <path className="game-artwork__mountain game-artwork__mountain--back" d="M0 244 116 113l88 88 82-111 105 130 71-76 178 111v105H0Z" />
      <path className="game-artwork__mountain" d="M0 278 136 166l79 62 98-78 104 85 88-56 135 87v94H0Z" />
      <path className="game-artwork__journey-route" d="M53 310C151 269 127 212 226 224c82 10 90 60 175 27 69-27 71-91 152-119" />
      <g className="game-artwork__waypoint" transform="translate(54 309)"><circle r="14"/><circle r="4"/></g>
      <g className="game-artwork__waypoint" transform="translate(226 224)"><circle r="11"/><circle r="3"/></g>
      <g className="game-artwork__waypoint game-artwork__waypoint--hero" transform="translate(401 251)"><circle r="13"/><circle r="4"/></g>
      <g className="game-artwork__lighthouse" transform="translate(532 78)">
        <path d="M17 68h34l-6 82H23Z" />
        <path d="M12 68h44L45 48H23Z" />
        <rect x="25" y="54" width="18" height="14" rx="3" />
        <path className="game-artwork__beam" d="M34 59 130 33v53Z" />
      </g>
    </>
  );
}

function MemoryScene() {
  return (
    <>
      <path className="game-artwork__archive-wall" d="M53 55h534v252H53Z" />
      {[0, 1, 2].map((row) => [0, 1, 2, 3].map((column) => {
        const active = (row === 0 && column === 2) || (row === 2 && column === 0);
        const x = 76 + column * 127;
        const y = 76 + row * 73;
        return (
          <g key={`${row}-${column}`} className={active ? "game-artwork__drawer game-artwork__drawer--active" : "game-artwork__drawer"} transform={`translate(${x} ${y})`}>
            <rect width="105" height="52" rx="8" />
            <path d="M13 13h79M13 39h79" />
            <rect x="40" y="20" width="25" height="12" rx="5" />
          </g>
        );
      }))}
      <path className="game-artwork__match-line" d="M405 102C354 41 171 63 128 246" />
      <circle className="game-artwork__match-pulse" cx="405" cy="102" r="8" />
      <circle className="game-artwork__match-pulse" cx="128" cy="246" r="8" />
    </>
  );
}

function TowerScene() {
  return (
    <>
      <path className="game-artwork__tower-ground" d="M0 306h640v54H0Z" />
      <path className="game-artwork__tower-body" d="m222 303 24-240h148l24 240Z" />
      <path className="game-artwork__tower-spine" d="M320 63v240" />
      {[0, 1, 2, 3, 4].map((floor) => (
        <g key={floor} className={`game-artwork__tower-floor game-artwork__tower-floor--${floor}`} transform={`translate(0 ${94 + floor * 40})`}>
          <path d="M243 0h153" />
          <rect x="266" y="10" width="38" height="18" rx="3" />
          <rect x="336" y="10" width="38" height="18" rx="3" />
        </g>
      ))}
      <path className="game-artwork__antenna" d="M320 63V25m-14 16h28" />
      <circle className="game-artwork__signal" cx="320" cy="24" r="10" />
      <path className="game-artwork__signal-wave" d="M285 34a39 39 0 0 1 70 0M268 25a58 58 0 0 1 104 0" />
      <path className="game-artwork__scan" d="M128 292h384" />
    </>
  );
}

function WordScene() {
  const letters = ["M", "A", "P", "A", "I", "D", "E", "I", "N", "E", "X", "O", "E", "S", "T", "U", "D", "O", "Q", "U", "I", "Z", "A", "R"];
  return (
    <>
      <g className="game-artwork__word-grid" transform="translate(90 45)">
        {letters.map((letter, index) => {
          const column = index % 6;
          const row = Math.floor(index / 6);
          const selected = [0, 7, 14, 21].includes(index);
          return (
            <g key={index} transform={`translate(${column * 76} ${row * 68})`} className={selected ? "game-artwork__letter game-artwork__letter--selected" : "game-artwork__letter"}>
              <rect width="58" height="52" rx="11" />
              <text x="29" y="34" textAnchor="middle">{letter}</text>
            </g>
          );
        })}
        <path className="game-artwork__word-path" d="M29 26 105 94 181 162 257 230" />
      </g>
      <g className="game-artwork__magnifier" transform="translate(442 216)">
        <circle cx="42" cy="42" r="39" />
        <path d="m72 72 54 54" />
      </g>
    </>
  );
}

const scenes: Record<GameArtworkId, () => React.ReactNode> = {
  nexo: NexoScene,
  sequencia: SequenceScene,
  corrida: JourneyScene,
  memoria: MemoryScene,
  forca: TowerScene,
  caca: WordScene,
};

const expeditionStops = [
  { x: 98, y: 326, label: "Fundamentos" },
  { x: 238, y: 252, label: "Conexões" },
  { x: 350, y: 332, label: "Aplicação" },
  { x: 454, y: 188, label: "Domínio" },
  { x: 618, y: 248, label: "Síntese" },
  { x: 770, y: 128, label: "Desafio" },
] as const;

export function StudyExpeditionMap({ completedCount, label }: { completedCount: number; label: string }) {
  const currentIndex = Math.min(Math.max(completedCount, 0), expeditionStops.length - 1);
  return (
    <svg
      viewBox="0 0 880 430"
      className="study-expedition-map"
      role="img"
      aria-label={`Mapa de progresso em ${label}: ${completedCount} de ${expeditionStops.length} destinos visitados`}
    >
      <defs>
        <pattern id="expedition-grid" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M34 0H0v34" fill="none" stroke="rgba(255,255,255,.045)" />
        </pattern>
      </defs>
      <rect width="880" height="430" fill="url(#expedition-grid)" />
      <g className="study-expedition-map__contours">
        <path d="M-30 302C87 186 168 377 295 261s188-149 318-51 203 37 310-49" />
        <path d="M-15 341c136-95 208 37 338-20 123-54 166-118 294-55 114 56 197 3 299-70" />
        <path d="M-10 245C102 141 172 294 280 203s181-123 288-41 197 61 326-60" />
        <path d="M24 382c126-67 213 34 328-2 151-47 173-109 298-48 91 44 157 14 242-41" />
      </g>
      <path className="study-expedition-map__path study-expedition-map__path--base" d="M98 326C149 317 178 260 238 252s74 83 112 80c59-4 62-123 104-144s101 78 164 60 96-96 152-120" />
      <path className="study-expedition-map__path study-expedition-map__path--progress" d="M98 326C149 317 178 260 238 252s74 83 112 80c59-4 62-123 104-144s101 78 164 60 96-96 152-120" pathLength="5" style={{ strokeDasharray: `${currentIndex} ${5 - currentIndex}` }} />
      {expeditionStops.map((stop, index) => {
        const state = index < currentIndex ? "complete" : index === currentIndex ? "current" : "locked";
        return (
          <g key={stop.label} transform={`translate(${stop.x} ${stop.y})`} className={`study-expedition-map__stop study-expedition-map__stop--${state}`}>
            {state === "current" ? <circle className="study-expedition-map__current-ring" r="31" /> : null}
            <circle className="study-expedition-map__stop-disc" r="18" />
            {state === "complete" ? <path className="study-expedition-map__check" d="m-7 0 5 5L8-7" /> : <text y="5" textAnchor="middle">{String(index + 1).padStart(2, "0")}</text>}
            <text className="study-expedition-map__stop-label" y="42" textAnchor="middle">{stop.label}</text>
          </g>
        );
      })}
      <g className="study-expedition-map__compass" transform="translate(812 60)">
        <circle r="27" />
        <path d="M0-22 7-5 0 22-7 5Z" />
        <text y="-35" textAnchor="middle">N</text>
      </g>
    </svg>
  );
}

export function GameArtwork({ game, accent, label, decorative = false, className = "" }: GameArtworkProps) {
  const rawId = useId();
  const uid = rawId.replace(/:/g, "");
  const gridId = `game-art-grid-${uid}`;
  const Scene = scenes[game];

  return (
    <svg
      viewBox="0 0 640 360"
      preserveAspectRatio="xMidYMid slice"
      className={`game-artwork ${className}`}
      style={{ "--art-accent": accent } as React.CSSProperties}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label}
      focusable="false"
    >
      <defs>
        <pattern id={gridId} width="32" height="32" patternUnits="userSpaceOnUse">
          <path className="game-artwork__gridline" d="M32 0H0v32" fill="none" strokeWidth="1" />
        </pattern>
      </defs>
      {/* papel quadriculado: as cores vêm do tema do caderno (claro/escuro) */}
      <rect className="game-artwork__paper" width="640" height="360" />
      <rect width="640" height="360" fill={`url(#${gridId})`} />
      <circle className="game-artwork__aura" cx="510" cy="66" r="190" />
      <Scene />
      <path className="game-artwork__frame" d="M20 40V20h20M600 20h20v20M620 320v20h-20M40 340H20v-20" />
    </svg>
  );
}
