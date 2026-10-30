/**
 * Topo da Home: saudação com o título entrando letra por letra, atalhos e o
 * sistema de matérias em 3D (Sistema3D, carregado só quando vai aparecer).
 * No tier baixo, com movimento reduzido ou sem WebGL, os cadernos viram uma
 * órbita em CSS que continua clicável.
 */
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Layers, Plus, Search, Sparkles } from "lucide-react";
import { useCena3D } from "../cena3d/Cena3D";
import { useSoftMotion } from "../motion";
import type { MateriaOrbita } from "./Sistema3D";
import "./home.css";

const Sistema3D = React.lazy(() => import("./Sistema3D"));
const mola = { type: "spring", stiffness: 300, damping: 30, mass: 1 } as const;
const molaSolta = { type: "spring", stiffness: 300, damping: 18, mass: 1 } as const;

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

/** Número que conta até o valor quando entra na tela. */
export function Contador({ valor, duracao = 900 }: { valor: number; duracao?: number }) {
  const reduced = useSoftMotion();
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const no = ref.current;
    if (!no) return;
    if (reduced) {
      no.textContent = String(valor);
      return;
    }
    let quadro = 0;
    const io = new IntersectionObserver(([entrada]) => {
      if (!entrada.isIntersecting) return;
      io.disconnect();
      const inicio = performance.now();
      const passo = (agora: number) => {
        const t = Math.min(1, (agora - inicio) / duracao);
        no.textContent = String(Math.round(valor * (1 - Math.pow(1 - t, 3))));
        if (t < 1) quadro = requestAnimationFrame(passo);
      };
      quadro = requestAnimationFrame(passo);
    });
    io.observe(no);
    return () => {
      io.disconnect();
      cancelAnimationFrame(quadro);
    };
  }, [valor, duracao, reduced]);
  return (
    <span ref={ref} className="tabular-nums">
      {reduced ? valor : 0}
    </span>
  );
}

/** Título que entra letra por letra, com a mola passando do ponto. */
function TituloLetras({ texto, destaque }: { texto: string; destaque: string }) {
  const reduced = useSoftMotion();
  const partes = [
    { texto, grifo: false },
    { texto: destaque, grifo: true },
  ];
  let indice = 0;
  return (
    <h1 className="home-hero-titulo" aria-label={`${texto}${destaque}`}>
      {partes.map((parte) => (
        <span key={parte.texto} className={parte.grifo ? "home-hero-grifo" : undefined} aria-hidden>
          {parte.texto.split(" ").filter(Boolean).map((palavra, p, lista) => (
            <React.Fragment key={`${palavra}-${p}`}>
            <span className="home-hero-palavra">
              {[...palavra].map((letra) => {
                const atraso = 0.08 + indice++ * 0.022;
                return (
                  <motion.span
                    key={`${letra}-${atraso}`}
                    className="home-hero-letra"
                    initial={reduced ? false : { opacity: 0, y: "0.6em", rotateX: -70 }}
                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                    transition={{ ...molaSolta, delay: atraso }}
                  >
                    {letra}
                  </motion.span>
                );
              })}
            </span>
            {/* o espaço fica fora do bloco da palavra, senão o inline-block o engole */}
            {p < lista.length - 1 || !parte.grifo ? " " : null}
            </React.Fragment>
          ))}
        </span>
      ))}
    </h1>
  );
}

/** Reserva sem WebGL: os cadernos giram numa órbita em CSS e continuam clicáveis. */
function OrbitaPlana({ materias, onAbrir, onCriar }: { materias: MateriaOrbita[]; onAbrir: (id: string) => void; onCriar: () => void }) {
  const lista = materias.slice(0, 8);
  return (
    <div className="home-orbita-plana">
      <span className="home-orbita-nucleo" aria-hidden />
      <span className="home-orbita-anel" aria-hidden />
      {lista.length ? (
        lista.map((materia, indice) => (
          <button
            key={materia.id}
            type="button"
            className="home-orbita-livro"
            style={{ "--cor": materia.color, "--a": `${(indice / lista.length) * 360}deg` } as React.CSSProperties}
            onClick={() => onAbrir(materia.id)}
            aria-label={`Abrir ${materia.name}`}
          >
            <span>{(materia.name.trim()[0] || "?").toUpperCase()}</span>
          </button>
        ))
      ) : (
        <button type="button" className="home-orbita-livro is-vazio" style={{ "--a": "0deg" } as React.CSSProperties} onClick={onCriar} aria-label="Criar a primeira matéria">
          <Plus className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function HomeHero({
  saudacao,
  nome,
  subtitulo,
  materias,
  nivel,
  titulo,
  xpNivel,
  xpPreciso,
  dias,
  revisoes,
  onNovaMateria,
  onBusca,
  onAbrir,
  onMine,
  tema,
}: {
  tema: string;
  saudacao: string;
  nome: string;
  subtitulo: string;
  materias: MateriaOrbita[];
  nivel: number;
  titulo: string;
  xpNivel: number;
  xpPreciso: number;
  dias: number;
  revisoes: number;
  onNovaMateria: () => void;
  onBusca: () => void;
  onAbrir: (id: string) => void;
  onMine: () => void;
}) {
  const reduced = useSoftMotion();
  const ligada = useCena3D();
  const [falhou, setFalhou] = useState(false);
  const progresso = Math.max(0, Math.min(1, xpNivel / Math.max(1, xpPreciso)));

  return (
    <section className="home-hero" aria-label="Boas-vindas">
      <div className="home-hero-texto">
        <motion.p className="home-hero-eyebrow" initial={reduced ? false : { opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={mola}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> área de estudos
        </motion.p>
        <TituloLetras texto={`${saudacao}, `} destaque={nome} />
        <motion.p className="home-hero-sub" initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...mola, delay: 0.45 }}>
          {subtitulo}
        </motion.p>

        <motion.div className="home-hero-acoes" initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...mola, delay: 0.55 }}>
          <motion.button type="button" className="home-btn home-btn-tinta" onClick={onNovaMateria} whileHover={reduced ? undefined : { y: -2, scale: 1.03 }} whileTap={{ scale: 0.96 }} transition={mola}>
            <Plus className="h-4 w-4" /> Nova matéria
          </motion.button>
          <button type="button" className="home-btn home-btn-papel" onClick={onBusca}>
            <Search className="h-4 w-4" /> Buscar <kbd>Ctrl K</kbd>
          </button>
        </motion.div>

        <div className="home-hero-chips">
          {[
            {
              chave: "nivel",
              conteudo: (
                <>
                  <span className="home-chip-anel" style={{ "--p": progresso } as React.CSSProperties} aria-hidden>
                    <svg viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" />
                      <motion.circle cx="18" cy="18" r="15" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: progresso }} transition={{ ...mola, delay: 0.8 }} />
                    </svg>
                  </span>
                  <span>
                    <b>
                      Nível <Contador valor={nivel} />
                    </b>
                    <small>{titulo}</small>
                  </span>
                </>
              ),
            },
            {
              chave: "dias",
              conteudo: (
                <>
                  <Flame className={`home-chip-icone ${dias ? "is-quente" : ""}`} aria-hidden />
                  <span>
                    <b>
                      <Contador valor={dias} /> {dias === 1 ? "dia" : "dias"}
                    </b>
                    <small>de sequência</small>
                  </span>
                </>
              ),
            },
            {
              chave: "revisoes",
              conteudo: (
                <>
                  <Layers className="home-chip-icone" aria-hidden />
                  <span>
                    <b>
                      <Contador valor={revisoes} /> {revisoes === 1 ? "revisão" : "revisões"}
                    </b>
                    <small>{revisoes ? "esperando hoje" : "tudo em dia"}</small>
                  </span>
                </>
              ),
            },
          ].map((chip, indice) => (
            <motion.div
              key={chip.chave}
              className="home-chip"
              initial={reduced ? false : { opacity: 0, y: 16, rotate: indice % 2 ? 2 : -2 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ ...molaSolta, delay: 0.65 + indice * 0.08 }}
            >
              {chip.conteudo}
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        className="home-hero-palco"
        initial={reduced ? false : { opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...mola, delay: 0.2 }}
      >
        {ligada && !falhou ? (
          <Guarda onFail={() => setFalhou(true)}>
            <React.Suspense fallback={<OrbitaPlana materias={materias} onAbrir={onAbrir} onCriar={onNovaMateria} />}>
              {/* remonta ao trocar o tema: as cores da cena vêm dos tokens lidos na montagem */}
              <Sistema3D key={tema} materias={materias} onAbrir={onAbrir} onCriar={onNovaMateria} onNucleo={onMine} />
            </React.Suspense>
          </Guarda>
        ) : (
          <OrbitaPlana materias={materias} onAbrir={onAbrir} onCriar={onNovaMateria} />
        )}
        <p className="home-hero-legenda" aria-hidden>
          {ligada && !falhou ? "arraste para girar · toque num caderno para abrir · o centro é a Mine" : "toque num caderno para abrir"}
        </p>
      </motion.div>
    </section>
  );
}
