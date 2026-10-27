// Aba "Como usar": um filme de rolagem pelo caderno. Carregada sob demanda
// (React.lazy), então nada disto pesa para quem não abre a aba.
//
// Como a rolagem anima sem re-renderizar: cada seção escreve o próprio
// progresso em variáveis CSS (--p dentro da cena presa, --e na chegada) direto
// no nó, e o CSS faz as contas. O React só re-renderiza quando o passo muda
// (três vezes por capítulo).
//
// Interação: o ponteiro inclina a folha da cena em 3D (--tx/--ty escritos no
// nó, como o progresso) e várias cenas dá para mexer de verdade (arrastar o
// post-it, virar a ficha, pintar, colar figurinha). No fim, um fichário em
// WebGL para folhear e uma lousa para escrever com giz.
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll, type MotionValue } from "framer-motion";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  BookOpen,
  Bot,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Home,
  MessageCircle,
  Palette,
  Play,
  RotateCcw,
  Search,
  Settings,
  Timer,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useQualityTier, useSoftMotion } from "../motion";
import { MineFace } from "../caderno/MineFace";
import { InkCheck, celebrateFrom, floatXp, launchPlane } from "../caderno";
import type { FicharioCap } from "./Fichario3D";
import { LousaGiz, type LousaGizHandle } from "./LousaGiz";
import "./como-usar.css";
import "./como-usar-3d.css";

const Fichario3D = React.lazy(() => import("./Fichario3D"));

/* ───────────────────────────── roteiro ───────────────────────────── */

type Step = { t: string; d: string };
type Chapter = {
  id: string;
  view: string;
  label: string;
  title: string;
  lead: string;
  icon: LucideIcon;
  /** cor da divisória do fichário (token do caderno) */
  tab: "mint" | "lilac" | "yellow" | "pink";
  steps: [Step, Step, Step];
  Scene: React.FC<{ step: number }>;
};

function abrir(view: string) {
  window.location.hash = `#/${view}`;
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Zona de uma cena: escondida antes do passo, em foco no passo, esmaecida depois. */
function zone(step: number, i: number, extra = "") {
  return cx("cu-z", step < i ? "is-pre" : step === i ? "is-now" : "is-past", extra);
}

/* ───────────────────────── material escolar ───────────────────────── */

/** Lápis de escola; `len` encurta o corpo, como um lápis já apontado muitas vezes. */
function Lapis({ className = "", len = 1 }: { className?: string; len?: number }) {
  const b = Math.round(176 * len);
  const w = 64 + b;
  return (
    <svg viewBox={`0 0 ${w} 28`} className={className} aria-hidden>
      <rect x="34" y="3" width={b} height="22" rx="2" fill="#F6C945" />
      <rect x="34" y="3" width={b} height="7" fill="#FFE07D" />
      <rect x="34" y="18" width={b} height="7" fill="#E2AE2A" />
      <rect x={30 + b} y="2" width="16" height="24" fill="#B9C2CF" />
      <rect x={34 + b} y="2" width="2" height="24" fill="#8C96A6" />
      <rect x={40 + b} y="2" width="2" height="24" fill="#8C96A6" />
      <rect x={46 + b} y="3" width="16" height="22" rx="5" fill="#F49AB0" />
      <path d="M34 3 L4 14 L34 25 Z" fill="#EBC9A0" />
      <path d="M13 10.7 L4 14 L13 17.3 Z" fill="#2F3340" />
    </svg>
  );
}

function Borracha({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 46" className={className} aria-hidden>
      <rect x="2" y="4" width="86" height="38" rx="8" fill="#F49AB0" />
      <rect x="44" y="4" width="44" height="38" rx="8" fill="#5B7CFA" />
      <rect x="44" y="4" width="10" height="38" fill="#5B7CFA" />
      <text x="66" y="28" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" fontFamily="system-ui">MINE</text>
    </svg>
  );
}

function Regua({ className = "" }: { className?: string }) {
  const ticks = Array.from({ length: 31 }, (_, i) => i);
  return (
    <svg viewBox="0 0 320 44" className={className} aria-hidden>
      <rect x="1" y="1" width="318" height="42" rx="4" fill="#BFE7FF" fillOpacity=".78" stroke="#7DB9DE" />
      {ticks.map((i) => (
        <line key={i} x1={10 + i * 10} x2={10 + i * 10} y1="1" y2={i % 5 === 0 ? 17 : 10} stroke="#3B6F94" strokeWidth="1.2" />
      ))}
      {[0, 5, 10, 15, 20, 25, 30].map((n) => (
        <text key={n} x={10 + n * 10} y="30" textAnchor="middle" fontSize="8" fill="#3B6F94" fontFamily="ui-monospace, monospace">
          {n / 5}
        </text>
      ))}
    </svg>
  );
}

function Clipe({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 80" className={className} aria-hidden>
      <path d="M9 22 V62 a6 6 0 0 0 12 0 V14 a9 9 0 0 0 -18 0 V60" fill="none" stroke="#9AA4B4" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

function Aviao({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 60" className={className} aria-hidden>
      <path d="M2 30 L78 4 L54 56 L38 36 Z" fill="#fff" stroke="#9AA4B4" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M38 36 L78 4 L30 42 Z" fill="#E4E9F1" stroke="#9AA4B4" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function Estrela({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 40 40" className={className} style={style} aria-hidden>
      <path d="M20 3 L25 15 L38 15.5 L28 24 L31.5 37 L20 29.5 L8.5 37 L12 24 L2 15.5 L15 15 Z" fill="#FFC933" stroke="#E2A10E" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/* ─────────────────────────────── cenas ─────────────────────────────── */

function CenaInicio({ step }: { step: number }) {
  return (
    <div className="cu-scene cu-inicio">
      <div className={zone(step, 0, "cu-list")}>
        <p className="cu-hand-title">Para agora</p>
        {["Lista de frações", "Ler cap. 4 de História", "Revisar células"].map((t, i) => (
          <p key={t} className={cx("cu-hand-line", i === 0 && "cu-hl")} style={{ "--i": i } as React.CSSProperties}>
            {t}
          </p>
        ))}
        <svg className="cu-arrow" viewBox="0 0 80 40" aria-hidden>
          <path d="M76 8 C 50 4 28 14 10 30 M10 30 l3 -12 M10 30 l12 -2" />
        </svg>
      </div>
      <div className={zone(step, 1, "cu-stars")}>
        <p className="cu-hand-title">Sequência</p>
        <div className="cu-star-row">
          {Array.from({ length: 7 }, (_, i) => (
            <Estrela key={i} className="cu-star" style={{ "--i": i } as React.CSSProperties} />
          ))}
        </div>
        <p className="cu-hand-small">7 dias seguidos!</p>
      </div>
      <div className={zone(step, 2, "cu-tabs")}>
        {[
          ["Matemática", "mint"],
          ["História", "yellow"],
          ["Biologia", "pink"],
          ["Português", "lilac"],
        ].map(([t, c], i) => (
          <span key={t} className={`cu-divisoria is-${c}`} style={{ "--i": i } as React.CSSProperties}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function CenaMateria({ step }: { step: number }) {
  return (
    <div className="cu-scene cu-materia">
      <div className={zone(step, 0, "cu-pasta")}>
        <div className="cu-pasta-back" />
        {["PDF · Resumo cap. 3", "Link · vídeo-aula", "Foto do quadro"].map((t, i) => (
          <div key={t} className="cu-folha" style={{ "--i": i } as React.CSSProperties}>
            {t}
          </div>
        ))}
        <div className="cu-pasta-front">Matemática</div>
      </div>
      <div className={zone(step, 1, "cu-tarefas")}>
        {["Exercícios 1 a 10", "Trabalho em dupla", "Estudar para a prova"].map((t, i) => (
          <p key={t} className="cu-tarefa">
            <InkCheck checked={step >= 1 && i < 2} className="h-5 w-5" />
            <span className={cx(step >= 1 && i < 2 && "is-done")}>{t}</span>
          </p>
        ))}
      </div>
      <div className={zone(step, 2, "cu-postit is-lilac cu-mine-note")}>
        <MineFace className="h-10 w-10 shrink-0" />
        <p>Pergunta pra mim qualquer coisa desta matéria!</p>
      </div>
    </div>
  );
}

/** Pequena dica escrita à mão que aparece quando a zona dá para mexer. */
function Toque({ children = "toque!" }: { children?: React.ReactNode }) {
  return (
    <span className="cu-toque" aria-hidden>
      {children}
    </span>
  );
}

const POSTITS = [
  { t: "Redação", cor: "yellow", c: 0, r: "-3deg" },
  { t: "Lista 3", cor: "pink", c: 2, r: "2deg" },
  { t: "Leitura", cor: "mint", c: 1, r: "-1deg" },
] as const;

function CenaAgenda({ step }: { step: number }) {
  const dias = ["Seg", "Ter", "Qua", "Qui", "Sex"];
  const quadro = useRef<HTMLDivElement>(null);
  // depois que a pessoa arrasta, as colunas são dela; antes, o roteiro move a Leitura
  const [cols, setCols] = useState<number[] | null>(null);
  const atual = cols ?? POSTITS.map((p, k) => (k === 2 && step >= 1 ? 3 : p.c));

  const arrastar = (k: number) => (event: React.PointerEvent<HTMLButtonElement>) => {
    const node = event.currentTarget;
    const box = quadro.current;
    if (!box || event.button !== 0) return;
    event.preventDefault();
    const col = box.clientWidth * 0.2;
    const x0 = event.clientX;
    const y0 = event.clientY;
    node.setPointerCapture(event.pointerId);
    node.classList.add("is-arrastando");
    const move = (e: PointerEvent) => {
      node.style.translate = `${e.clientX - x0}px ${e.clientY - y0}px`;
    };
    const up = (e: PointerEvent) => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
      const dx = e.clientX - x0;
      const from = atual[k];
      const to = Math.max(0, Math.min(4, Math.round(from + dx / col)));
      // o post-it pula de coluna e o translate compensa; depois assenta no lugar
      node.style.translate = `${dx - (to - from) * col}px ${e.clientY - y0}px`;
      node.classList.replace("is-arrastando", "is-solto");
      setCols(() => {
        const next = [...atual];
        next[k] = to;
        return next;
      });
      // depois que o React gravou a coluna nova, solta o translate e a transição assenta
      window.setTimeout(() => (node.style.translate = ""), 34);
      window.setTimeout(() => node.classList.remove("is-solto"), 520);
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
  };

  return (
    <div className="cu-scene cu-agenda">
      <div className="cu-semana">
        {dias.map((d) => (
          <span key={d} className="cu-dia">
            {d}
          </span>
        ))}
      </div>
      <div ref={quadro} className={zone(step, 0, "cu-quadro cu-mexe")}>
        {POSTITS.map((p, k) => (
          <button
            key={p.t}
            type="button"
            className={cx(`cu-postit is-${p.cor} cu-p`, k === 2 && "cu-p-move", k === 2 && !cols && step >= 1 && "is-moved")}
            style={{ "--c": atual[k], "--r": p.r, "--i": k } as React.CSSProperties}
            onPointerDown={arrastar(k)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              e.preventDefault();
              const next = [...atual];
              next[k] = Math.max(0, Math.min(4, next[k] + (e.key === "ArrowRight" ? 1 : -1)));
              setCols(next);
            }}
            aria-label={`${p.t}, ${dias[atual[k]]}. Arraste ou use as setas para mudar o dia.`}
          >
            {p.t}
          </button>
        ))}
        <Toque>arrasta um!</Toque>
      </div>
      <div className={zone(step, 1, "cu-drag-hint")}>
        <svg viewBox="0 0 160 40" aria-hidden>
          <path d="M8 30 C 50 2 110 2 150 26 M150 26 l-12 -2 M150 26 l-3 -12" />
        </svg>
        <span>arrasta pro outro dia</span>
      </div>
      <div className={zone(step, 2, "cu-prova")}>
        <span className="cu-prova-txt">PROVA</span>
        <svg viewBox="0 0 120 60" aria-hidden>
          <ellipse cx="60" cy="30" rx="54" ry="24" pathLength={1} />
        </svg>
      </div>
    </div>
  );
}

function CenaFoco({ step }: { step: number }) {
  // um teste de 10 segundos: o lápis gasta de verdade e no fim vem o +XP
  const [resta, setResta] = useState<number | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (resta === null) return;
    if (resta === 0) {
      floatXp("+1 ciclo", botao.current);
      celebrateFrom(botao.current, { count: 10 });
      const fim = window.setTimeout(() => setResta(null), 1600);
      return () => window.clearTimeout(fim);
    }
    const id = window.setTimeout(() => setResta((s) => (s === null ? s : s - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [resta]);
  const rodando = resta !== null;

  return (
    <div className="cu-scene cu-foco">
      <div className={zone(step, 0, "cu-lapis-trio")}>
        {[
          ["Sprint", "15 / 3", 0.45],
          ["Pomodoro", "25 / 5", 0.7],
          ["Estudo longo", "50 / 10", 1],
        ].map(([t, m, w], i) => (
          <div key={t as string} className={cx("cu-lapis-op", i === 1 && "is-sel")} style={{ "--w": w } as React.CSSProperties}>
            <span className="cu-lapis-caixa">
              <Lapis className="cu-lapis-mini" len={w as number} />
            </span>
            <span>
              <b>{t}</b> {m} min
            </span>
          </div>
        ))}
      </div>
      <div className={zone(step, 1, "cu-escrita cu-mexe")}>
        <div className="cu-timer-linha">
          <p className="cu-timer" aria-live="polite">
            {rodando ? `00:${String(resta).padStart(2, "0")}` : "25:00"}
          </p>
          <button ref={botao} type="button" className="cu-testar" disabled={rodando} onClick={() => setResta(10)}>
            <Play className="h-3.5 w-3.5" /> {rodando ? (resta === 0 ? "pronto!" : "estudando…") : "testar 10 s"}
          </button>
        </div>
        <div className={cx("cu-traco", rodando && "is-rodando")}>
          <span className="cu-traco-linha" />
          <Lapis className="cu-lapis-gasta" />
        </div>
        <p className="cu-hand-small">o lápis gasta enquanto você estuda</p>
      </div>
      <div className={zone(step, 2, "cu-ciclos")}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cx("cu-ciclo", i < 3 && "is-on")} style={{ "--i": i } as React.CSSProperties} />
        ))}
        <span className="cu-xp">
          <Estrela className="h-9 w-9" /> +XP
        </span>
      </div>
    </div>
  );
}

const FIGURINHAS = ["🔥", "📚", "🧠", "⭐", "🏆", "✏️"];

function CenaProgresso({ step }: { step: number }) {
  const barras = [0.35, 0.6, 0.45, 0.8, 0.55, 0.9, 0.7];
  // as duas que faltam no álbum dá para colar com um toque
  const [coladas, setColadas] = useState<number[]>([]);
  return (
    <div className="cu-scene cu-progresso">
      <div className={zone(step, 0, "cu-carimbo-wrap")}>
        <span className="cu-carimbo">
          Nível 7<small>estudante dedicado</small>
        </span>
      </div>
      <div className={zone(step, 1, "cu-grafico")}>
        {barras.map((h, i) => (
          <span key={i} className="cu-barra" style={{ "--h": h, "--i": i } as React.CSSProperties} />
        ))}
      </div>
      <div className={zone(step, 2, "cu-album cu-mexe")}>
        {FIGURINHAS.map((e, i) => {
          const vazia = i > 3 && !coladas.includes(i);
          return vazia ? (
            <button
              key={i}
              type="button"
              className="cu-figurinha is-vazia"
              style={{ "--i": i } as React.CSSProperties}
              aria-label="Colar figurinha"
              onClick={(ev) => {
                celebrateFrom(ev.currentTarget, { count: 8 });
                setColadas((c) => [...c, i]);
              }}
            >
              ?
            </button>
          ) : (
            <span key={i} className={cx("cu-figurinha", coladas.includes(i) && "is-colada")} style={{ "--i": i } as React.CSSProperties}>
              {e}
            </span>
          );
        })}
        {coladas.length < 2 ? <Toque>cola as que faltam!</Toque> : null}
      </div>
    </div>
  );
}

function CenaRanking({ step }: { step: number }) {
  // a pilha "você" cresce a cada toque: um livro = um pouco de XP
  const [extra, setExtra] = useState(0);
  const pilhas = [5, 8 + extra, 6, 3];
  const cores = ["#5B7CFA", "#F49AB0", "#2FD483", "#FFC933", "#9682F0"];
  return (
    <div className="cu-scene cu-ranking">
      <div className={zone(step, 0, "cu-estante cu-mexe")}>
        {pilhas.map((n, p) => (
          <div
            key={p}
            className={cx("cu-pilha", p === 1 && "is-voce")}
            {...(p === 1
              ? {
                  role: "button",
                  tabIndex: 0,
                  "aria-label": "Estudar mais: empilhar um livro",
                  onClick: (ev: React.MouseEvent<HTMLDivElement>) => {
                    if (extra >= 4) return;
                    floatXp("+XP", ev.currentTarget);
                    setExtra((x) => x + 1);
                  },
                  onKeyDown: (ev: React.KeyboardEvent<HTMLDivElement>) => {
                    if ((ev.key === "Enter" || ev.key === " ") && extra < 4) {
                      ev.preventDefault();
                      setExtra((x) => x + 1);
                    }
                  },
                }
              : {})}
          >
            {Array.from({ length: n }, (_, i) => (
              <span
                key={i}
                className={cx("cu-livro", p === 1 && i >= 8 && "is-novo")}
                style={{ "--i": i, background: cores[(i + p) % cores.length], "--w": `${78 + ((i * 7 + p * 3) % 20)}%` } as React.CSSProperties}
              />
            ))}
          </div>
        ))}
        <span className="cu-prateleira" />
        {extra < 4 ? <Toque>toca na sua pilha</Toque> : null}
      </div>
      <div className={zone(step, 1, "cu-voce-tag")}>
        <span>você!</span>
        <svg viewBox="0 0 60 50" aria-hidden>
          <path d="M50 6 C 30 10 20 24 12 42 M12 42 l-2 -12 M12 42 l10 -6" />
        </svg>
      </div>
      <div className={zone(step, 2, "cu-cracha")}>
        <span className="cu-cordao" />
        <div className="cu-cracha-card">
          <MineFace className="h-12 w-12" />
          <div>
            <b>Perfil público</b>
            <p>nível, XP e conquistas</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CenaMine({ step }: { step: number }) {
  const [marcada, setMarcada] = useState(2);
  const [virada, setVirada] = useState(true);
  const [tocou, setTocou] = useState(false);
  return (
    <div className="cu-scene cu-mine">
      <div className={zone(step, 0, "cu-bilhetes")}>
        <p className="cu-bilhete is-eu">me explica fotossíntese?</p>
        <div className="cu-bilhete is-mine">
          <MineFace className="h-8 w-8 shrink-0" />
          <p>
            A planta usa <mark>luz</mark>, água e gás carbônico pra fazer o próprio alimento…
          </p>
        </div>
      </div>
      <div className={zone(step, 1, "cu-mapa")}>
        <svg viewBox="0 0 260 130" aria-hidden>
          {[
            [130, 65, 40, 22],
            [130, 65, 220, 22],
            [130, 65, 40, 108],
            [130, 65, 220, 108],
          ].map(([x1, y1, x2, y2], i) => (
            <path key={i} d={`M${x1} ${y1} Q ${(x1 + x2) / 2} ${y2} ${x2} ${y2}`} pathLength={1} style={{ "--i": i } as React.CSSProperties} />
          ))}
        </svg>
        <span className="cu-no is-centro">Fotossíntese</span>
        {["Luz", "Clorofila", "Água", "Glicose"].map((t, i) => (
          <span key={t} className={`cu-no is-n${i}`} style={{ "--i": i } as React.CSSProperties}>
            {t}
          </span>
        ))}
      </div>
      <div className={zone(step, 2, cx("cu-artefatos cu-mexe", tocou && "is-mexido"))}>
        <div className="cu-prova-folha">
          <b>Prova · 10 questões</b>
          {["A", "B", "C", "D"].map((l, i) => (
            <button
              key={l}
              type="button"
              className={cx("cu-bolinha", i === marcada && "is-marcada", i === marcada && (i === 2 ? "is-certa" : "is-errada"))}
              aria-pressed={i === marcada}
              onClick={() => {
                setTocou(true);
                setMarcada(i);
              }}
            >
              {l}
            </button>
          ))}
          <span className={cx("cu-correcao", marcada === 2 ? "is-certa" : "is-errada")} key={marcada}>
            {marcada === 2 ? "✓ certa!" : "✗ tenta outra"}
          </span>
        </div>
        <button
          type="button"
          className={cx("cu-ficha", !virada && "is-desvirada", tocou && "is-tocada")}
          aria-label={virada ? "Ficha mostrando a resposta. Toque para ver a pergunta." : "Ficha mostrando a pergunta. Toque para ver a resposta."}
          onClick={() => {
            setTocou(true);
            setVirada((v) => !v);
          }}
        >
          <span className="cu-ficha-in">
            <span className="cu-ficha-f">O que é clorofila?</span>
            <span className="cu-ficha-v">Pigmento verde que capta a luz</span>
          </span>
        </button>
        <Toque>vira a ficha</Toque>
      </div>
    </div>
  );
}

function CenaGames({ step }: { step: number }) {
  const jogos = ["Nexo Vivo", "Forja de Sequências", "A Jornada da Mine", "Arquivo Perdido", "Torre dos Códigos", "Caça-Palavras"];
  return (
    <div className="cu-scene cu-games">
      <div className={zone(step, 0, cx("cu-mao", step >= 1 && "is-escolhida"))}>
        {jogos.map((j, i) => (
          <span key={j} className={cx("cu-carta", i === 4 && "is-alvo")} style={{ "--i": i - 2.5 } as React.CSSProperties}>
            <Gamepad2 className="h-5 w-5" />
            {j}
          </span>
        ))}
      </div>
      <div className={zone(step, 1, "cu-regras")}>
        <b>Como jogar</b>
        <p>As perguntas vêm das suas matérias, e mudam a cada rodada.</p>
      </div>
      <div className={zone(step, 2, "cu-premio")}>
        <Estrela className="cu-premio-estrela" />
        <span className="cu-ingresso">desafio do dia · +XP</span>
      </div>
    </div>
  );
}

const CANETINHAS = ["#EF4444", "#FB923C", "#FDE047", "#22C55E", "#3B82F6", "#A78BFA", "#F472B6"];
const DESENHO_CORES = ["#FFC933", "#F49AB0", "#5B7CFA", "#2FD483", "#B07A4F"];

function CenaAtelie({ step }: { step: number }) {
  // escolhe a canetinha no estojo e toca no desenho para pintar com ela
  const [caneta, setCaneta] = useState(4);
  const [cores, setCores] = useState(DESENHO_CORES);
  const pinta = (i: number) => () => setCores((c) => c.map((cor, k) => (k === i ? CANETINHAS[caneta] : cor)));
  const formas: Array<React.ReactElement> = [
    <circle cx="160" cy="32" r="18" />,
    <path d="M40 128 V78 L80 44 L120 78 V128 Z" />,
    <rect x="68" y="96" width="24" height="32" />,
    <circle cx="160" cy="92" r="22" />,
    <rect x="155" y="110" width="10" height="20" />,
  ];
  return (
    <div className="cu-scene cu-atelie">
      <div className={zone(step, 0, cx("cu-colorir cu-mexe", cores !== DESENHO_CORES && "is-mexido"))}>
        <svg viewBox="0 0 200 140" role="group" aria-label="Desenho para colorir">
          {formas.map((forma, i) =>
            React.cloneElement(forma, {
              key: i,
              className: "cu-tinta",
              style: { "--c": cores[i], "--i": i } as React.CSSProperties,
              onClick: pinta(i),
            }),
          )}
          <line x1="10" y1="130" x2="192" y2="130" />
        </svg>
        <Toque>pinta aqui</Toque>
      </div>
      <div className={zone(step, 1, "cu-estojo cu-mexe")} role="radiogroup" aria-label="Canetinhas">
        {CANETINHAS.map((c, i) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={i === caneta}
            aria-label={`Canetinha ${i + 1}`}
            className={cx("cu-canetinha", i === caneta && "is-aberta")}
            style={{ "--c": c, "--i": i } as React.CSSProperties}
            onClick={() => setCaneta(i)}
          />
        ))}
      </div>
      <div className={zone(step, 2, "cu-foto")}>
        <div className="cu-polaroid">
          <span className="cu-foto-img" />
          <small>sua foto</small>
        </div>
        <svg className="cu-seta-reta" viewBox="0 0 60 20" aria-hidden>
          <path d="M4 10 H52 M52 10 l-8 -6 M52 10 l-8 6" />
        </svg>
        <div className="cu-polaroid is-traco">
          <svg viewBox="0 0 60 50" aria-hidden>
            <path d="M6 44 L22 20 L32 32 L42 14 L56 44 Z M44 10 a5 5 0 1 0 0.1 0" />
          </svg>
          <small>pra colorir</small>
        </div>
      </div>
    </div>
  );
}

function CenaBusca({ step }: { step: number }) {
  return (
    <div className="cu-scene cu-busca">
      <div className={zone(step, 0, "cu-campo")}>
        <Search className="h-5 w-5" />
        <span className="cu-digita">fotossíntese</span>
        <svg className="cu-lupa" viewBox="0 0 60 60" aria-hidden>
          <circle cx="24" cy="24" r="16" />
          <path d="M36 36 L54 54" />
        </svg>
      </div>
      <div className={zone(step, 1, "cu-fichas")}>
        {[
          ["Matéria", "Biologia"],
          ["Conteúdo", "Resumo cap. 3"],
          ["Tarefa", "Revisar células"],
        ].map(([k, v], i) => (
          <div key={k} className="cu-ficha-bib" style={{ "--i": i } as React.CSSProperties}>
            <small>{k}</small>
            {v}
          </div>
        ))}
      </div>
      <div className={zone(step, 2, "cu-lombadas")}>
        {["Livro", "Artigo", "Pesquisa", "Livro", "Revista"].map((t, i) => (
          <span key={i} className="cu-lombada" style={{ "--i": i } as React.CSSProperties}>
            {t}
          </span>
        ))}
        <p className="cu-hand-small">fontes públicas confiáveis</p>
      </div>
    </div>
  );
}

function CenaPlano({ step }: { step: number }) {
  return (
    <div className="cu-scene cu-plano">
      <div className={zone(step, 0, "cu-escolha")}>
        {["Matemática", "Biologia", "História"].map((t, i) => (
          <p key={t} className="cu-tarefa">
            <InkCheck checked={i < 2} className="h-5 w-5" />
            {t}
          </p>
        ))}
        <p className="cu-hand-small">ritmo: tranquilo · médio · intenso</p>
      </div>
      <div className={zone(step, 1, "cu-calendario")}>
        <div className="cu-argolas">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
        <div className="cu-cal-grid">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="cu-cal-dia" style={{ "--i": i } as React.CSSProperties}>
              <small>{i + 1}</small>
              {i % 3 !== 2 ? <i className={i % 2 ? "is-mint" : "is-yellow"} /> : null}
              {i === 13 ? <b>prova</b> : null}
            </span>
          ))}
        </div>
      </div>
      <div className={zone(step, 2, "cu-envio")}>
        <Aviao className="cu-envio-aviao" />
        <span className="cu-postit is-yellow">foi pra Agenda ✓</span>
      </div>
    </div>
  );
}

function CenaComunidade({ step }: { step: number }) {
  const status = ["Recebida", "Em análise", "Planejada", "Concluída"];
  const [nota, setNota] = useState(5);
  return (
    <div className="cu-scene cu-comunidade">
      <div className={zone(step, 0, "cu-mural cu-mexe")}>
        <div className="cu-postit is-pink cu-recado">
          <span className="cu-tachinha" />
          <span className="cu-nota" role="radiogroup" aria-label="Nota">
            {[0, 1, 2, 3, 4].map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={nota === i + 1}
                aria-label={`${i + 1} estrela${i ? "s" : ""}`}
                className={cx("cu-estrela-btn", i >= nota && "is-apagada")}
                onClick={() => setNota(i + 1)}
              >
                <Estrela className="h-5 w-5" style={{ "--i": i } as React.CSSProperties} />
              </button>
            ))}
          </span>
          “Me ajudou muito na prova!”
        </div>
      </div>
      <div className={zone(step, 1, "cu-sugestao")}>
        <b>Sugestão: modo escuro no mapa</b>
        <div className="cu-status">
          {status.map((s, i) => (
            <span key={s} className={cx("cu-stamp", step >= 1 && "is-on")} style={{ "--i": i } as React.CSSProperties}>
              {s}
            </span>
          ))}
        </div>
      </div>
      <div className={zone(step, 2, "cu-turma")}>
        {["#F49AB0", "#5B7CFA", "#2FD483", "#FFC933"].map((c, i) => (
          <span key={c} className="cu-colega" style={{ background: c, "--i": i } as React.CSSProperties} />
        ))}
        <p className="cu-hand-small">a turma toda acompanha</p>
      </div>
    </div>
  );
}

const MARCAS = ["mint", "yellow", "pink", "lilac"] as const;

function CenaPerfil({ step }: { step: number }) {
  // prova as cores do marca-texto e a luz do caderno só nesta folha
  const [marca, setMarca] = useState(0);
  const [acesa, setAcesa] = useState(true);
  return (
    <div
      className={cx("cu-scene cu-perfil", !acesa && "is-apagado")}
      style={{ "--hl-pick": `var(--hl-${MARCAS[marca]})` } as React.CSSProperties}
    >
      <div className={zone(step, 0, "cu-carteirinha")}>
        <span className="cu-carteirinha-faixa">CARTEIRINHA ESTUDANTIL</span>
        <div className="cu-carteirinha-corpo">
          <span className="cu-3x4">
            <MineFace className="h-14 w-14" />
          </span>
          <div>
            <p className="cu-hand-line">Seu nome</p>
            <p className="cu-hand-small">@voce · Nível 7</p>
          </div>
        </div>
      </div>
      <div className={zone(step, 1, "cu-marcadores cu-mexe")} role="radiogroup" aria-label="Cor do marca-texto">
        {MARCAS.map((c, i) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={i === marca}
            aria-label={`Marca-texto ${c}`}
            className={cx("cu-marca", `is-${c}`, i === marca && "is-sel")}
            style={{ "--i": i } as React.CSSProperties}
            onClick={() => setMarca(i)}
          />
        ))}
        <p className="cu-hl cu-hand-line">sua cor de destaque</p>
        <Toque>escolhe uma</Toque>
      </div>
      <div className={zone(step, 2, cx("cu-ajustes cu-mexe", !acesa && "is-apagada"))}>
        <button type="button" role="switch" aria-checked={acesa} aria-label="Luz do caderno" className="cu-luz" onClick={() => setAcesa((a) => !a)}>
          <span className="cu-luz-bola" />
        </button>
        <span className="cu-hand-small">luz acesa ou apagada · sons · tour da Mine</span>
      </div>
    </div>
  );
}

const chapters: Chapter[] = [
  {
    id: "inicio",
    view: "home",
    label: "Início",
    title: "A página do dia",
    lead: "Tudo o que importa hoje, numa folha só.",
    icon: Home,
    tab: "mint",
    steps: [
      { t: "O que fazer agora", d: "Tarefas atrasadas e de hoje aparecem primeiro, grifadas, pra você não perder nada." },
      { t: "Sua sequência", d: "Cada dia de estudo vira uma estrelinha. Não quebre a corrente!" },
      { t: "Suas matérias", d: "As divisórias do fichário levam direto para cada matéria." },
    ],
    Scene: CenaInicio,
  },
  {
    id: "materias",
    view: "home",
    label: "Matérias",
    title: "Uma pasta por matéria",
    lead: "PDFs, links, fotos e tarefas, tudo guardado no mesmo lugar.",
    icon: BookOpen,
    tab: "mint",
    steps: [
      { t: "Guarde o material", d: "Jogue PDFs, links, imagens e anotações dentro da pasta da matéria." },
      { t: "Risque as tarefas", d: "Cada matéria tem a sua lista. Marcou como feita, ganhou XP." },
      { t: "Chame a Mine", d: "Ela lê os seus conteúdos e explica, resume ou monta revisão." },
    ],
    Scene: CenaMateria,
  },
  {
    id: "agenda",
    view: "agenda",
    label: "Agenda",
    title: "O quadro de post-its",
    lead: "Sua semana colada na parede.",
    icon: CalendarDays,
    tab: "mint",
    steps: [
      { t: "Cole as tarefas", d: "Cada tarefa ou prova vira um post-it no dia certo." },
      { t: "Arraste à vontade", d: "Mudou o plano? Puxe o post-it para outro dia." },
      { t: "Provas em vermelho", d: "As provas ficam circuladas de caneta, impossível esquecer." },
    ],
    Scene: CenaAgenda,
  },
  {
    id: "foco",
    view: "foco",
    label: "Foco",
    title: "O lápis que se gasta",
    lead: "Um cronômetro de estudo com cara de estojo.",
    icon: Timer,
    tab: "mint",
    steps: [
      { t: "Escolha o tamanho", d: "Sprint (15/3), Pomodoro (25/5) ou Estudo longo (50/10), ou do seu jeito." },
      { t: "Estude e veja gastar", d: "O lápis vai encurtando enquanto o tempo passa. Celular longe!" },
      { t: "Ciclos valem XP", d: "Cada sessão completa vira ponto, e a cada quatro vem uma pausa longa." },
    ],
    Scene: CenaFoco,
  },
  {
    id: "progresso",
    view: "progress",
    label: "Progresso",
    title: "O seu boletim",
    lead: "Quanto você já estudou, em nível e figurinha.",
    icon: Activity,
    tab: "mint",
    steps: [
      { t: "Seu nível", d: "Todo estudo vira XP, e o XP vira nível, carimbado na folha." },
      { t: "O gráfico da semana", d: "Barras feitas a lápis mostram os dias em que você mais rendeu." },
      { t: "Álbum de figurinhas", d: "Conquistas viram figurinhas. Quais ainda faltam no seu álbum?" },
    ],
    Scene: CenaProgresso,
  },
  {
    id: "ranking",
    view: "ranking",
    label: "Ranking",
    title: "A estante da turma",
    lead: "Cada livro da pilha é XP conquistado.",
    icon: Trophy,
    tab: "mint",
    steps: [
      { t: "Pilhas de livros", d: "Quanto mais você estuda, mais alta fica a sua pilha na estante." },
      { t: "Ache o seu lugar", d: "A sua pilha aparece marcada, e dá pra ver quem está perto." },
      { t: "Crachá público", d: "Toque num nome para ver o perfil: foto, nível e conquistas." },
    ],
    Scene: CenaRanking,
  },
  {
    id: "mine",
    view: "mine",
    label: "Mine",
    title: "A colega que sabe tudo",
    lead: "Uma tutora de IA que responde como bilhetinho na aula.",
    icon: Bot,
    tab: "lilac",
    steps: [
      { t: "Pergunte qualquer coisa", d: "Ela explica passo a passo, com fórmulas, código e imagens." },
      { t: "Peça um mapa mental", d: "Diga “faz um mapa mental de…” e ele se desenha na hora." },
      { t: "Prova e flashcards", d: "Simulados com correção e cartões de revisão, montados da sua matéria." },
    ],
    Scene: CenaMine,
  },
  {
    id: "games",
    view: "games",
    label: "Games",
    title: "Recreio que ensina",
    lead: "Seis jogos montados com o conteúdo das suas matérias.",
    icon: Gamepad2,
    tab: "lilac",
    steps: [
      { t: "Escolha uma carta", d: "Nexo Vivo, Torre dos Códigos, Caça-Palavras e outros três." },
      { t: "Leia a regra", d: "Cada jogo abre com uma ficha de instruções. As rodadas nunca se repetem." },
      { t: "Ganhe XP jogando", d: "Toda partida conta pontos, e o desafio do dia vale um extra." },
    ],
    Scene: CenaGames,
  },
  {
    id: "atelie",
    view: "atelie",
    label: "Ateliê",
    title: "Aula de artes",
    lead: "Pintar também descansa a cabeça.",
    icon: Palette,
    tab: "lilac",
    steps: [
      { t: "Páginas para colorir", d: "A Mine desenhou várias páginas. É só escolher e pintar." },
      { t: "Abra o estojo", d: "Pincel, lápis, marca-texto, balde de tinta e borracha." },
      { t: "Foto vira desenho", d: "Mande uma foto e ela vira folha de colorir, em traço." },
    ],
    Scene: CenaAtelie,
  },
  {
    id: "busca",
    view: "search",
    label: "Busca",
    title: "A biblioteca da escola",
    lead: "Uma lupa para tudo o que você guardou, e mais.",
    icon: Search,
    tab: "lilac",
    steps: [
      { t: "Digite uma palavra", d: "A busca olha matérias, conteúdos, anotações e tarefas." },
      { t: "Fichas organizadas", d: "Os resultados chegam separados por tipo, como fichas de biblioteca." },
      { t: "Livros e pesquisas", d: "Também traz livros e estudos de fontes públicas confiáveis." },
    ],
    Scene: CenaBusca,
  },
  {
    id: "plano",
    view: "plan",
    label: "Plano de estudos",
    title: "Cronograma até a prova",
    lead: "A Mine distribui as revisões pelos dias que faltam.",
    icon: CalendarPlus,
    tab: "lilac",
    steps: [
      { t: "Matérias e ritmo", d: "Marque o que cai na prova e escolha quão puxado quer estudar." },
      { t: "O calendário se monta", d: "As revisões se espalham pelos dias até a data da prova." },
      { t: "Mande para a agenda", d: "Um clique e cada revisão vira post-it na sua Agenda." },
    ],
    Scene: CenaPlano,
  },
  {
    id: "comunidade",
    view: "comments",
    label: "Comentários e sugestões",
    title: "O mural da escola",
    lead: "Onde a turma conversa com quem faz a Minerva.",
    icon: MessageCircle,
    tab: "yellow",
    steps: [
      { t: "Deixe o seu recado", d: "Dê estrelas e conte o que está achando nos Comentários." },
      { t: "Mande uma ideia", d: "Em Sugestões, cada ideia ganha um carimbo de status: de Recebida a Concluída." },
      { t: "Todo mundo vê", d: "A turma acompanha o que está sendo melhorado." },
    ],
    Scene: CenaComunidade,
  },
  {
    id: "perfil",
    view: "perfil",
    label: "Perfil e ajustes",
    title: "A sua carteirinha",
    lead: "Como você aparece e como o caderno se comporta.",
    icon: Settings,
    tab: "pink",
    steps: [
      { t: "Foto e nome", d: "É assim que a turma vê você no ranking." },
      { t: "Cor do marca-texto", d: "Escolha a cor que grifa o site inteiro." },
      { t: "Luz, sons e tour", d: "Caderno claro ou escuro, sons de papel e o tour da Mine de novo." },
    ],
    Scene: CenaPerfil,
  },
];

/* ──────────────────────── progresso de rolagem ──────────────────────── */

/** Escreve o progresso numa variável CSS do próprio nó, sem re-render. */
function useCssProgress(
  ref: React.RefObject<HTMLElement>,
  name: string,
  offset: NonNullable<Parameters<typeof useScroll>[0]>["offset"],
  onChange?: (v: number) => void,
): MotionValue<number> {
  const { scrollYProgress } = useScroll({ target: ref, offset });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    ref.current?.style.setProperty(name, v.toFixed(4));
    onChange?.(v);
  });
  useEffect(() => {
    ref.current?.style.setProperty(name, scrollYProgress.get().toFixed(4));
  }, [ref, name, scrollYProgress]);
  return scrollYProgress;
}

/**
 * Inclinação 3D pelo ponteiro: escreve --tx/--ty (-1…1) e --gx/--gy (posição
 * do brilho, em %) no nó. Só mouse; o retângulo é medido ao entrar, não a
 * cada movimento, e nada passa pelo React.
 */
function useTilt(ref: React.RefObject<HTMLElement>, enabled: boolean) {
  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;
    let rect = node.getBoundingClientRect();
    let raf = 0;
    let px = 0;
    let py = 0;
    const paint = () => {
      raf = 0;
      node.style.setProperty("--tx", px.toFixed(3));
      node.style.setProperty("--ty", py.toFixed(3));
      node.style.setProperty("--gx", `${((px + 1) * 50).toFixed(1)}%`);
      node.style.setProperty("--gy", `${((py + 1) * 50).toFixed(1)}%`);
    };
    const enter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      rect = node.getBoundingClientRect();
      node.classList.add("is-tilt");
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      px = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1));
      py = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1));
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const leave = () => {
      px = 0;
      py = 0;
      node.classList.remove("is-tilt");
      if (!raf) raf = requestAnimationFrame(paint);
    };
    // a cena presa não sai do lugar, mas a rolagem muda o retângulo da seção
    const scroll = () => (rect = node.getBoundingClientRect());
    node.addEventListener("pointerenter", enter);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      node.removeEventListener("pointerenter", enter);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", scroll);
    };
  }, [ref, enabled]);
}

function stepOf(p: number) {
  return p < 0.28 ? 0 : p < 0.56 ? 1 : 2;
}

/* ─────────────────────────────── abertura ─────────────────────────────── */

function Abertura({ onJump, reduced }: { onJump: (id: string) => void; reduced: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(reduced);
  useCssProgress(ref, "--p", ["start start", "end end"], (v) => !reduced && setAberto(v > 0.42));
  useTilt(stage, !reduced);

  // arrastar o caderno gira ele na mão; soltou, ele volta devagar para a mesa
  const livro = useRef<HTMLDivElement>(null);
  const [girou, setGirou] = useState(false);
  const girar = (event: React.PointerEvent<HTMLDivElement>) => {
    const node = livro.current;
    if (!node || reduced || event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    const x0 = event.clientX;
    const y0 = event.clientY;
    let ativo = false;
    const move = (e: PointerEvent) => {
      const dx = e.clientX - x0;
      const dy = e.clientY - y0;
      if (!ativo && Math.hypot(dx, dy) < 6) return;
      if (!ativo) {
        ativo = true;
        node.classList.add("is-girando");
        try {
          node.setPointerCapture(e.pointerId);
        } catch {
          // sem captura o giro segue enquanto o ponteiro estiver em cima
        }
      }
      node.style.setProperty("--spin-y", `${Math.max(-70, Math.min(70, dx * 0.45)).toFixed(1)}deg`);
      node.style.setProperty("--spin-x", `${Math.max(-35, Math.min(35, -dy * 0.3)).toFixed(1)}deg`);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (!ativo) return;
      node.classList.remove("is-girando");
      node.style.setProperty("--spin-y", "0deg");
      node.style.setProperty("--spin-x", "0deg");
      setGirou(true);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const descer = (sel: string) => document.querySelector(sel)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });

  return (
    <section ref={ref} className="cu-abertura">
      <div ref={stage} className="cu-stage">
        {/* material escolar espalhado na mesa, cada um numa velocidade */}
        <Lapis className="cu-mesa cu-mesa-lapis" />
        <Borracha className="cu-mesa cu-mesa-borracha" />
        <Regua className="cu-mesa cu-mesa-regua" />
        <Clipe className="cu-mesa cu-mesa-clipe" />
        <Aviao className="cu-mesa cu-mesa-aviao" />
        <Estrela className="cu-mesa cu-mesa-estrela" />

        <div ref={livro} className={cx("cu-livro3d", aberto && "is-aberto")} onPointerDown={girar}>
          {/* espessura de verdade: contracapa, miolo de folhas e as bordas do bloco */}
          <span className="cu-contracapa" aria-hidden />
          <span className="cu-miolo" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <i key={i} style={{ "--z": i } as React.CSSProperties} />
            ))}
          </span>
          <span className="cu-borda is-esquerda" aria-hidden />
          <span className="cu-borda is-direita" aria-hidden />
          <span className="cu-borda is-baixo" aria-hidden />
          <span className="cu-borda is-cima" aria-hidden />
          <div className="cu-sumario">
            <p className="cu-sumario-titulo">Sumário</p>
            <ol>
              {chapters.map((c, i) => (
                <li key={c.id} style={{ "--i": i } as React.CSSProperties}>
                  <button type="button" onClick={() => onJump(c.id)}>
                    <span>{c.label}</span>
                    <i />
                    <b>{String(i + 1).padStart(2, "0")}</b>
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className="cu-capa">
            <div className="cu-capa-frente">
              <span className="cu-capa-faixa" />
              <div className="cu-etiqueta">
                <small>caderno de</small>
                <h1>Como usar</h1>
                <p>
                  Nome: <span>você</span>
                </p>
                <p>
                  Matéria: <span>Minerva</span>
                </p>
              </div>
              <MineFace className="cu-capa-mine" />
            </div>
            <div className="cu-capa-verso" />
          </div>
        </div>

        <div className="cu-abertura-legenda">
          <p>Um filme em {chapters.length} capítulos sobre o seu caderno.</p>
          <span className="cu-dica">
            role a página <ArrowDown className="h-4 w-4" />
          </span>
        </div>

        <div className="cu-abertura-topo">
          {!reduced ? (
            <span className={cx("cu-dica-giro", girou && "is-feito")}>{girou ? "isso! agora role ↓" : "↻ arraste o caderno para girar"}</span>
          ) : null}
          <span className="cu-novidades">
            <b>novo</b>
            <button type="button" onClick={() => descer(".cu-revisao, .cu-final")}>
              fichário 3D
            </button>
            <button type="button" onClick={() => descer(".cu-lousa")}>
              lousa de giz
            </button>
            <button type="button" onClick={() => onJump("agenda")}>
              cenas para mexer
            </button>
          </span>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────── capítulo ─────────────────────────────── */

function Capitulo({ chapter, index, total, reduced }: { chapter: Chapter; index: number; total: number; reduced: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const [step, setStep] = useState(reduced ? 2 : 0);
  useCssProgress(ref, "--p", ["start start", "end end"], (v) => {
    if (reduced) return;
    const s = stepOf(v);
    setStep((prev) => (prev === s ? prev : s));
  });
  useCssProgress(ref, "--e", ["start end", "start start"]);
  const palco = useRef<HTMLDivElement>(null);
  useTilt(palco, !reduced);
  const { Scene } = chapter;
  const n = String(index + 1).padStart(2, "0");

  return (
    <section ref={ref} id={`cu-${chapter.id}`} className={cx("cu-cap", `is-${chapter.tab}`, reduced && "is-static")} data-cap={index}>
      <div className="cu-stage">
        <div className="cu-texto">
          <span className="cu-num" aria-hidden>
            {n}
          </span>
          <span className="cu-aba">
            <chapter.icon className="h-4 w-4" />
            Cap. {n} · {chapter.label}
          </span>
          <h2 className="cu-titulo">
            <span>{chapter.title}</span>
          </h2>
          <p className="cu-lead">{chapter.lead}</p>

          <ol className="cu-passos">
            {chapter.steps.map((s, i) => (
              <li key={s.t} className={cx(i === step && "is-now", i < step && "is-done")}>
                <span className="cu-bola">
                  {i < step ? <InkCheck checked className="h-4 w-4" /> : i + 1}
                  <svg viewBox="0 0 40 40" aria-hidden>
                    <circle cx="20" cy="20" r="17" pathLength={1} />
                  </svg>
                </span>
                <div>
                  <b>{s.t}</b>
                  {reduced || i === step ? (
                    <p key={`${chapter.id}-${i}-${step}`} className="cu-escreve">
                      {s.d}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>

          <div className="cu-acoes">
            <button type="button" className="cu-btn-abrir" onClick={() => abrir(chapter.view)}>
              Abrir {chapter.label.toLocaleLowerCase("pt-BR")}
            </button>
            <span className="cu-contador">
              {index + 1} / {total}
            </span>
          </div>
        </div>

        <div ref={palco} className="cu-palco">
          <div className="cu-tilt">
            <div className="cu-pagina">
              <span className="cu-fita" aria-hidden />
              <Clipe className="cu-pagina-clipe" />
              <Scene step={step} />
              {/* passo atual repetido aqui no celular, onde a coluna de texto encolhe */}
              <p key={`m-${step}`} className="cu-legenda-mobile cu-escreve">
                <b>{chapter.steps[step].t}.</b> {chapter.steps[step].d}
              </p>
              <span className="cu-brilho" aria-hidden />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── régua de progresso ───────────────────────── */

function ReguaLateral({ rootRef, active, onJump }: { rootRef: React.RefObject<HTMLElement>; active: number; onJump: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [marks, setMarks] = useState<number[]>([]);
  const { scrollYProgress } = useScroll({ target: rootRef, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => ref.current?.style.setProperty("--g", v.toFixed(4)));

  useEffect(() => {
    const measure = () => {
      const root = rootRef.current;
      if (!root) return;
      const span = root.offsetHeight - window.innerHeight;
      if (span <= 0) return;
      const caps = Array.from(root.querySelectorAll<HTMLElement>(".cu-cap"));
      setMarks(caps.map((el) => Math.min(1, Math.max(0, (el.offsetTop + el.offsetHeight * 0.3 - window.innerHeight * 0.2) / span))));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [rootRef]);

  return (
    <div ref={ref} className="cu-regua-lateral" aria-label="Capítulos">
      <span className="cu-grafite" />
      {marks.map((m, i) => (
        <button
          key={chapters[i].id}
          type="button"
          className={cx("cu-marca-cap", i === active && "is-on")}
          style={{ top: `${m * 100}%` }}
          onClick={() => onJump(chapters[i].id)}
          title={chapters[i].label}
        >
          <span>{chapters[i].label}</span>
        </button>
      ))}
      <Lapis className="cu-regua-lapis" />
    </div>
  );
}

/* ─────────────────────────── revisão: fichário 3D ─────────────────────────── */

/** O fichário WebGL caiu (sem WebGL, contexto perdido…): fica a lista de abas. */
class FicharioBoundary extends React.Component<{ onFail: () => void; children: React.ReactNode }, { failed: boolean }> {
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

/** Remonta as texturas do fichário quando a luz do caderno muda. */
function useTemaClaro() {
  const [claro, setClaro] = useState(() => document.documentElement.classList.contains("theme-light"));
  useEffect(() => {
    const root = document.documentElement;
    const mo = new MutationObserver(() => setClaro(root.classList.contains("theme-light")));
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return claro;
}

function webglOk() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function Revisao({ onJump, reduced }: { onJump: (id: string) => void; reduced: boolean }) {
  const tier = useQualityTier();
  const claro = useTemaClaro();
  const [falhou, setFalhou] = useState(false);
  const [idx, setIdx] = useState(0);
  // testa uma vez só: cada teste abre um contexto WebGL
  const [temWebgl] = useState(webglOk);
  const tres = !reduced && tier !== "low" && !falhou && temWebgl;
  const caps = useMemo<FicharioCap[]>(() => {
    const css = getComputedStyle(document.documentElement);
    return chapters.map((c) => ({
      id: c.id,
      label: c.label,
      title: c.title,
      lead: c.lead,
      steps: c.steps,
      tab: css.getPropertyValue(`--hl-${c.tab}`).trim() || "141 247 180",
    }));
    // as cores das abas mudam com o tema
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claro]);
  const cap = chapters[idx];
  const vai = (i: number) => setIdx(Math.max(0, Math.min(chapters.length - 1, i)));
  // sem 3D (tier baixo, movimento reduzido, sem WebGL) as divisórias do fim já fazem esse papel
  if (!tres) return null;

  return (
    <section
      className={cx("cu-revisao", `is-${cap.tab}`)}
      aria-labelledby="cu-revisao-titulo"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") vai(idx + 1);
        else if (e.key === "ArrowLeft") vai(idx - 1);
        else return;
        e.preventDefault();
      }}
    >
      <div className="cu-revisao-topo">
        <span className="cu-aba">
          <RotateCcw className="h-4 w-4" /> Hora da revisão
        </span>
        <h2 id="cu-revisao-titulo" className="cu-titulo">
          <span>Folheie o fichário</span>
        </h2>
        <p className="cu-lead">Arraste as folhas para o lado, toque numa aba colorida para pular até ela ou na folha para rever o capítulo.</p>
      </div>

      <div className="cu-fichario">
        <FicharioBoundary key={claro ? "claro" : "escuro"} onFail={() => setFalhou(true)}>
          <Suspense fallback={<div className="cu-fichario-carrega">abrindo o fichário…</div>}>
            <Fichario3D caps={caps} index={idx} onIndex={setIdx} onOpen={(i) => onJump(chapters[i].id)} />
          </Suspense>
        </FicharioBoundary>
      </div>

      <div className="cu-fichario-controles">
        <button type="button" className="cu-seta" onClick={() => vai(idx - 1)} disabled={idx === 0} aria-label="Folha anterior">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="cu-fichario-chip" aria-live="polite">
          <cap.icon className="h-4 w-4" />
          <b>{String(idx + 1).padStart(2, "0")}</b> {cap.label}
        </span>
        <button type="button" className="cu-seta" onClick={() => vai(idx + 1)} disabled={idx === chapters.length - 1} aria-label="Próxima folha">
          <ChevronRight className="h-5 w-5" />
        </button>
        <button type="button" className="cu-btn-abrir" onClick={() => onJump(cap.id)}>
          Rever capítulo <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

/* ─────────────────────────────── final ─────────────────────────────── */

function Final() {
  const comecar = useRef<HTMLButtonElement>(null);
  const lousa = useRef<LousaGizHandle>(null);
  const [visto, setVisto] = useState(false);
  const [rabiscou, setRabiscou] = useState(false);
  const [apagando, setApagando] = useState(false);
  return (
    <section className="cu-final">
      <motion.div
        className={cx("cu-lousa", visto && "is-visto")}
        onViewportEnter={() => setVisto(true)}
        initial={{ opacity: 0, y: 40, rotate: -1.5 }}
        whileInView={{ opacity: 1, y: 0, rotate: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="cu-giz-data">Lição de casa</span>
        <h2 className="cu-giz">Fim da aula!</h2>
        <p className="cu-giz-sub">Agora você já sabe onde fica cada coisa no seu caderno.</p>
        <motion.span
          className="cu-carimbo cu-carimbo-final"
          initial={{ opacity: 0, scale: 2.4, rotate: -24 }}
          whileInView={{ opacity: 1, scale: 1, rotate: -12 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ delay: 0.55, type: "spring", stiffness: 420, damping: 18 }}
        >
          Lição concluída
        </motion.span>
        <LousaGiz ref={lousa} onRabisco={() => setRabiscou(true)} />
        <span className={cx("cu-giz-dica", rabiscou && "is-sumiu")} aria-hidden>
          pega o giz e escreve aqui ✎
        </span>
        <button
          type="button"
          className={cx("cu-apagador", apagando && "is-apagando")}
          aria-label="Apagar a lousa"
          title="Apagar a lousa"
          onClick={() => {
            lousa.current?.apagar();
            setApagando(true);
            window.setTimeout(() => setApagando(false), 520);
          }}
        />
        <span className="cu-giz-toco" aria-hidden />
      </motion.div>

      <div className="cu-divisorias-final">
        {chapters.map((c, i) => (
          <button key={c.id} type="button" className={`cu-divisoria is-${c.tab}`} style={{ "--i": i } as React.CSSProperties} onClick={() => abrir(c.view)}>
            <c.icon className="h-4 w-4" />
            {c.label}
          </button>
        ))}
      </div>

      <div className="cu-final-acoes">
        <button
          ref={comecar}
          type="button"
          className="caderno-btn-pencil inline-flex items-center gap-2 px-5 py-3 text-[14px] font-black"
          onClick={() => {
            launchPlane(comecar.current);
            celebrateFrom(comecar.current, { count: 18 });
            window.setTimeout(() => abrir("home"), 700);
          }}
        >
          <Play className="h-4 w-4" /> Começar a estudar
        </button>
        <button type="button" className="cu-btn-abrir" onClick={() => window.dispatchEvent(new Event("minerva:tour"))}>
          <RotateCcw className="h-4 w-4" /> Ver o tour da Mine
        </button>
      </div>
    </section>
  );
}

/* ─────────────────────────────── tela ─────────────────────────────── */

export function ComoUsarView() {
  const reduced = useSoftMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.cap));
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    root.querySelectorAll(".cu-cap").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const jump = useMemo(
    () => (id: string) => {
      const el = document.getElementById(`cu-${id}`);
      if (!el) return;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: reduced ? "auto" : "smooth" });
    },
    [reduced],
  );

  return (
    <div ref={rootRef} className={cx("cu-root", reduced && "is-reduced")}>
      <Abertura onJump={jump} reduced={reduced} />
      {chapters.map((c, i) => (
        <Capitulo key={c.id} chapter={c} index={i} total={chapters.length} reduced={reduced} />
      ))}
      <Revisao onJump={jump} reduced={reduced} />
      <Final />
      {!reduced ? <ReguaLateral rootRef={rootRef} active={active} onJump={jump} /> : null}
    </div>
  );
}
