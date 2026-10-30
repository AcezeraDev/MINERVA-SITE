/**
 * Cartões da Home em grade "bento": cada um inclina seguindo o ponteiro e
 * tem uma luz que acompanha o mouse pela borda. O ponteiro é escrito direto
 * em variáveis CSS do nó (nada de setState por pointermove, ver
 * motion-e-custo-visual); o CSS faz o resto.
 */
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, CalendarPlus, ClipboardCheck, Flame, Layers, Search, Timer, Trophy } from "lucide-react";
import { MineFace } from "../caderno/MineFace";
import { useSoftMotion } from "../motion";
import { Contador } from "./HomeHero";

const molaSolta = { type: "spring", stiffness: 300, damping: 20, mass: 1 } as const;

function Cartao({
  className = "",
  tom,
  indice,
  onClick,
  rotulo,
  children,
}: {
  className?: string;
  tom: string;
  indice: number;
  onClick: () => void;
  rotulo: string;
  children: React.ReactNode;
}) {
  const reduced = useSoftMotion();
  const ref = useRef<HTMLButtonElement | null>(null);
  const caixa = useRef<DOMRect | null>(null);

  const entrar = () => {
    caixa.current = ref.current?.getBoundingClientRect() || null;
  };
  const mover = (event: React.PointerEvent) => {
    const no = ref.current;
    const rect = caixa.current;
    if (!no || !rect || reduced || event.pointerType !== "mouse") return;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    no.style.setProperty("--mx", `${x * 100}%`);
    no.style.setProperty("--my", `${y * 100}%`);
    no.style.setProperty("--ry", `${(x - 0.5) * 9}deg`);
    no.style.setProperty("--rx", `${(0.5 - y) * 9}deg`);
  };
  const sair = () => {
    const no = ref.current;
    if (!no) return;
    no.style.setProperty("--ry", "0deg");
    no.style.setProperty("--rx", "0deg");
  };

  return (
    <motion.div
      className={`home-bento-celula ${className}`}
      initial={reduced ? false : { opacity: 0, y: 28, rotateX: -18 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ ...molaSolta, delay: indice * 0.06 }}
    >
      <button
        ref={ref}
        type="button"
        className="home-bento-cartao"
        style={{ "--tom": tom } as React.CSSProperties}
        onPointerEnter={entrar}
        onPointerMove={mover}
        onPointerLeave={sair}
        onClick={onClick}
        aria-label={rotulo}
      >
        <span className="home-bento-luz" aria-hidden />
        {children}
        <ArrowUpRight className="home-bento-seta" aria-hidden />
      </button>
    </motion.div>
  );
}

const perguntasMine = [
  "me explica fotossíntese como se eu tivesse 12 anos",
  "cria uma prova de 10 questões de frações",
  "faz um mapa mental da Revolução Francesa",
  "corrige minha resposta de história",
  "flashcards de verbos irregulares em inglês",
];

/** A pergunta da vez sendo "digitada" na caixinha da Mine. */
function PerguntaDigitando() {
  const reduced = useSoftMotion();
  const [indice, setIndice] = useState(0);
  const [letras, setLetras] = useState(reduced ? perguntasMine[0].length : 0);
  useEffect(() => {
    if (reduced) return;
    const frase = perguntasMine[indice];
    if (letras < frase.length) {
      const t = window.setTimeout(() => setLetras((n) => n + 1), 38);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      setIndice((i) => (i + 1) % perguntasMine.length);
      setLetras(0);
    }, 2200);
    return () => window.clearTimeout(t);
  }, [letras, indice, reduced]);
  return (
    <span className="home-mine-caixa">
      {perguntasMine[indice].slice(0, letras)}
      <i className="home-mine-cursor" aria-hidden />
    </span>
  );
}

export type BentoDados = {
  nivel: number;
  titulo: string;
  xp: number;
  xpNivel: number;
  xpPreciso: number;
  dias: number;
  semana: boolean[];
  revisoes: number;
  focoMinutos: number;
  sessoesSemana: number;
  errosPendentes: number;
  provasFeitas: number;
  tarefasHoje: number;
};

export function Bento({
  dados,
  onMine,
  onProgresso,
  onRevisar,
  onProvas,
  onFoco,
  onPlano,
  onBusca,
}: {
  dados: BentoDados;
  onMine: () => void;
  onProgresso: () => void;
  onRevisar: () => void;
  onProvas: () => void;
  onFoco: () => void;
  onPlano: () => void;
  onBusca: () => void;
}) {
  const reduced = useSoftMotion();
  const progresso = Math.max(0, Math.min(1, dados.xpNivel / Math.max(1, dados.xpPreciso)));
  const diasSemana = ["D", "S", "T", "Q", "Q", "S", "S"];
  const hoje = new Date().getDay();

  return (
    <section className="home-bento" aria-label="Atalhos e números">
      <Cartao className="is-mine" tom="var(--pen)" indice={0} onClick={onMine} rotulo="Conversar com a Mine">
        <span className="home-bento-rotulo">converse com a Mine</span>
        <span className="home-mine-linha">
          <MineFace track className="home-mine-rosto" />
          <span className="home-mine-fala">
            <b>Pergunta qualquer coisa.</b>
            <small>Ela explica, cria provas, mapas mentais e flashcards.</small>
          </span>
        </span>
        <PerguntaDigitando />
      </Cartao>

      <Cartao className="is-nivel" tom="var(--hl-lilac)" indice={1} onClick={onProgresso} rotulo={`Nível ${dados.nivel}: ver progresso`}>
        <span className="home-bento-rotulo">
          <Trophy className="h-3.5 w-3.5" /> nível
        </span>
        <span className="home-bento-numero">
          <Contador valor={dados.nivel} />
        </span>
        <span className="home-bento-texto">{dados.titulo}</span>
        <span className="home-bento-barra" aria-hidden>
          <motion.i initial={reduced ? false : { scaleX: 0 }} whileInView={{ scaleX: progresso }} viewport={{ once: true }} transition={{ ...molaSolta, delay: 0.3 }} />
        </span>
        <small className="home-bento-pe">
          {dados.xpNivel}/{dados.xpPreciso} XP para o próximo
        </small>
      </Cartao>

      <Cartao className="is-sequencia" tom="var(--hl-pink)" indice={2} onClick={onProgresso} rotulo={`Sequência de ${dados.dias} dias`}>
        <span className="home-bento-rotulo">
          <Flame className="h-3.5 w-3.5" /> sequência
        </span>
        <span className="home-bento-numero">
          <Contador valor={dados.dias} />
          <small>{dados.dias === 1 ? "dia" : "dias"}</small>
        </span>
        <span className="home-semana" aria-hidden>
          {dados.semana.map((ativo, indice) => {
            const dia = (hoje - 6 + indice + 14) % 7;
            return (
              <motion.span
                key={indice}
                className={`home-semana-dia ${ativo ? "is-on" : ""} ${indice === 6 ? "is-hoje" : ""}`}
                initial={reduced ? false : { scale: 0, rotate: -40 }}
                whileInView={{ scale: 1, rotate: 0 }}
                viewport={{ once: true }}
                transition={{ ...molaSolta, delay: 0.25 + indice * 0.06 }}
              >
                {ativo ? <Flame className="h-3.5 w-3.5" /> : null}
                <small>{diasSemana[dia]}</small>
              </motion.span>
            );
          })}
        </span>
      </Cartao>

      <Cartao className="is-revisoes" tom="var(--hl-yellow)" indice={3} onClick={onRevisar} rotulo={`${dados.revisoes} revisões de flashcards`}>
        <span className="home-bento-rotulo">
          <Layers className="h-3.5 w-3.5" /> revisões
        </span>
        <span className="home-pilha" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="home-bento-numero">
          <Contador valor={dados.revisoes} />
        </span>
        <span className="home-bento-texto">{dados.revisoes ? (dados.revisoes === 1 ? "cartão esperando" : "cartões esperando") : "nada vencido hoje"}</span>
      </Cartao>

      <Cartao className="is-provas" tom="var(--hl-mint)" indice={4} onClick={onProvas} rotulo="Prova e erros">
        <span className="home-bento-rotulo">
          <ClipboardCheck className="h-3.5 w-3.5" /> prova e erros
        </span>
        <span className="home-carimbo" aria-hidden>
          {dados.errosPendentes ? "estudar" : "novo"}
        </span>
        <span className="home-bento-numero">
          <Contador valor={dados.errosPendentes} />
        </span>
        <span className="home-bento-texto">
          {dados.errosPendentes ? (dados.errosPendentes === 1 ? "erro para virar acerto" : "erros para virar acerto") : dados.provasFeitas ? "nenhum erro pendente" : "faça uma prova e estude o que errar"}
        </span>
      </Cartao>

      <Cartao className="is-foco" tom="var(--hl-mint)" indice={5} onClick={onFoco} rotulo="Sessão de foco">
        <span className="home-bento-rotulo">
          <Timer className="h-3.5 w-3.5" /> foco · 7 dias
        </span>
        <span className="home-lapis" aria-hidden />
        <span className="home-bento-numero">
          <Contador valor={dados.focoMinutos} />
          <small>min</small>
        </span>
        <span className="home-bento-texto">{dados.sessoesSemana} {dados.sessoesSemana === 1 ? "sessão" : "sessões"} na semana</span>
      </Cartao>

      <Cartao className="is-plano" tom="var(--hl-lilac)" indice={6} onClick={onPlano} rotulo="Plano de estudos">
        <span className="home-bento-rotulo">
          <CalendarPlus className="h-3.5 w-3.5" /> plano de estudos
        </span>
        <span className="home-calendario" aria-hidden>
          {Array.from({ length: 14 }, (_, i) => (
            <i key={i} className={i % 3 === 0 ? "is-on" : ""} />
          ))}
        </span>
        <span className="home-bento-texto">{dados.tarefasHoje ? `${dados.tarefasHoje} ${dados.tarefasHoje === 1 ? "tarefa" : "tarefas"} para hoje` : "Cronograma até a prova, montado pela Mine"}</span>
      </Cartao>

      <Cartao className="is-busca" tom="var(--hl-pink)" indice={7} onClick={onBusca} rotulo="Busca rápida">
        <span className="home-bento-rotulo">
          <Search className="h-3.5 w-3.5" /> busca rápida
        </span>
        <span className="home-busca-campo">
          <Search className="h-4 w-4" aria-hidden />
          <span>matérias, conteúdos, tarefas…</span>
          <kbd>Ctrl K</kbd>
        </span>
      </Cartao>
    </section>
  );
}
