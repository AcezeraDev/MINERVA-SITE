// Aula da Mine: o método de camadas passo a passo, com demonstração no cubo
// 3D da aba e um caso para treinar cada passo.
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Check, ChevronLeft, ChevronRight, Dumbbell, Eye, MessageCircleQuestion } from "lucide-react";
import { passosAula, type PassoAula } from "./aula";

const mola = { type: "spring" as const, stiffness: 300, damping: 30, mass: 1 };

/** Algoritmo em fichas; a ficha do giro que está passando no cubo acende. */
export function FichasAlgoritmo({ algoritmo, ativo, compacto = false }: { algoritmo: string[]; ativo: number; compacto?: boolean }) {
  return (
    <ol className={`cubo-fichas ${compacto ? "is-compacto" : ""}`} aria-label={`Algoritmo: ${algoritmo.join(" ")}`}>
      {algoritmo.map((t, i) => (
        <li key={`${t}-${i}`} className={`cubo-ficha ${i === ativo ? "is-ativa" : ""} ${i < ativo ? "is-feita" : ""}`}>
          {i === ativo ? <motion.span layoutId={compacto ? "ficha-faixa" : "ficha-aula"} className="cubo-ficha-grifo" transition={mola} /> : null}
          <span className="relative">{t}</span>
        </li>
      ))}
    </ol>
  );
}

export function AulaDaMine({
  atual,
  setAtual,
  ficha,
  aprendidos,
  ocupado,
  emAula,
  eh3x3,
  reduzido,
  onVer,
  onTreinar,
  onPerguntar,
  onUsar3,
}: {
  atual: number;
  setAtual: (i: number) => void;
  ficha: number;
  aprendidos: string[];
  ocupado: boolean;
  /** Este passo está passando no cubo agora (demonstração ou treino). */
  emAula: "demo" | "treino" | null;
  eh3x3: boolean;
  reduzido: boolean;
  onVer: (passo: PassoAula) => void;
  onTreinar: (passo: PassoAula) => void;
  onPerguntar: (passo: PassoAula) => void;
  onUsar3: () => void;
}) {
  const passo = passosAula[atual];
  const feitos = passosAula.filter((p) => aprendidos.includes(p.id)).length;

  return (
    <section id="aula-da-mine" className="cubo-aula" aria-labelledby="cubo-aula-titulo">
      <header className="cubo-aula-topo">
        <div>
          <p className="caderno-note">passo a passo</p>
          <h2 id="cubo-aula-titulo" className="font-display text-2xl font-black md:text-3xl">Aula da Mine: montar o cubo 3x3</h2>
        </div>
        <div className="cubo-aula-progresso" aria-label={`${feitos} de ${passosAula.length} passos treinados`}>
          <span><strong>{feitos}</strong>/{passosAula.length} treinados</span>
          <span className="cubo-aula-barra"><motion.span animate={{ width: `${(feitos / passosAula.length) * 100}%` }} transition={mola} /></span>
        </div>
      </header>

      {!eh3x3 ? (
        <div className="cubo-aula-aviso">
          A aula é do cubo Clássico 3×3.{" "}
          <button type="button" className="cubo-link" onClick={onUsar3}>Trocar para o 3×3</button>
        </div>
      ) : null}

      <div className="cubo-aula-grade">
        <ol className="cubo-aula-passos">
          {passosAula.map((p, i) => {
            const ok = aprendidos.includes(p.id);
            return (
              <li key={p.id}>
                <button type="button" className={`cubo-aula-passo ${i === atual ? "is-atual" : ""}`} aria-current={i === atual ? "step" : undefined} onClick={() => setAtual(i)}>
                  {i === atual ? <motion.span layoutId="aula-passo" className="cubo-aula-passo-grifo" transition={mola} /> : null}
                  <span className={`cubo-aula-num ${ok ? "is-ok" : ""}`}>{ok ? <Check className="h-3.5 w-3.5" aria-label="treinado" /> : i + 1}</span>
                  <span className="relative min-w-0 flex-1 overflow-hidden">
                    <span className="block font-black">{p.titulo}</span>
                    <span className="block truncate text-xs opacity-60">{p.resumo}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.article
            key={passo.id}
            className="cubo-aula-conteudo"
            initial={reduzido ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduzido ? { opacity: 0 } : { opacity: 0, x: -24 }}
            transition={mola}
          >
            <div className="cubo-aula-fala">
              <span className="cubo-aula-mine" aria-hidden><Bot className="h-6 w-6" /></span>
              <div className="cubo-aula-balao">
                <p className="cubo-aula-quem">Mine · passo {atual + 1} de {passosAula.length}</p>
                <h3 className="font-display text-xl font-black">{passo.titulo}</h3>
                {passo.fala.map((t, i) => <p key={i}>{t}</p>)}
              </div>
            </div>

            {passo.algoritmo.length ? (
              <div className="cubo-aula-alg">
                <p className="cubo-card-titulo">Algoritmo do treino</p>
                <FichasAlgoritmo algoritmo={passo.algoritmo} ativo={emAula ? ficha : -1} />
              </div>
            ) : null}

            <ul className="cubo-aula-dicas">
              {passo.dicas.map((d) => <li key={d}>{d}</li>)}
            </ul>

            <div className="cubo-aula-acoes">
              <button type="button" className="cubo-btn is-primario" disabled={ocupado} onClick={() => onVer(passo)}>
                <Eye className="h-4 w-4" aria-hidden /> Ver no cubo
              </button>
              <button type="button" className="cubo-btn" disabled={ocupado} onClick={() => onTreinar(passo)}>
                <Dumbbell className="h-4 w-4" aria-hidden /> {emAula === "treino" ? "Montar o caso de novo" : "Treinar este passo"}
              </button>
              <button type="button" className="cubo-btn" onClick={() => onPerguntar(passo)}>
                <MessageCircleQuestion className="h-4 w-4" aria-hidden /> Perguntar à Mine
              </button>
            </div>

            <nav className="cubo-aula-nav" aria-label="Passos da aula">
              <button type="button" className="cubo-link" disabled={atual === 0} onClick={() => setAtual(atual - 1)}>
                <ChevronLeft className="inline h-4 w-4" aria-hidden /> Passo anterior
              </button>
              <button type="button" className="cubo-link" disabled={atual === passosAula.length - 1} onClick={() => setAtual(atual + 1)}>
                Próximo passo <ChevronRight className="inline h-4 w-4" aria-hidden />
              </button>
            </nav>
          </motion.article>
        </AnimatePresence>
      </div>
    </section>
  );
}
