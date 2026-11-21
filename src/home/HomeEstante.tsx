/**
 * Aba Início, "Estante em órbita" (nov/2026). A página inteira responde a uma
 * pergunta: qual matéria eu vou estudar? Os cadernos em órbita da Mine são a
 * página; cada um carrega o próprio bilhete (prova, tarefa atrasada) e a ficha
 * ao lado mostra o que fazer na matéria escolhida. Progresso vira a régua do
 * rodapé e os atalhos viram abas de fichário presas na borda.
 *
 * Substitui o painel de blocos empilhados (hero, bento, listas, gráficos).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Bot, Check, ChevronLeft, ChevronRight, Plus, type LucideIcon } from "lucide-react";
import { useCena3D } from "../cena3d/Cena3D";
import { useSoftMotion } from "../motion";
import { MineFace } from "../caderno/MineFace";
import type { AvisoCaderno, MateriaOrbita } from "./Sistema3D";
import "./home.css";
import "./home-estante.css";

const Sistema3D = React.lazy(() => import("./Sistema3D"));
const MineRetrato3D = React.lazy(() => import("../cena3d/MineRetrato3D"));
const mola = { type: "spring", stiffness: 300, damping: 30, mass: 1 } as const;

export type ItemFicha = {
  id: string;
  tipo: "atrasada" | "hoje" | "prova" | "tarefa" | "revisao" | "continuar";
  titulo: string;
  detalhe: string;
  onClick: () => void;
};

export type MateriaEstante = {
  id: string;
  name: string;
  color: string;
  icon: LucideIcon;
  conteudos: number;
  estudados: number;
  aviso?: AvisoCaderno;
  itens: ItemFicha[];
  /** O que a Mine fala no balão quando esta matéria está escolhida. */
  dica: string;
};

/** Um dia da faixa "próximos 7 dias": tarefas de todas as matérias. */
export type DiaSemana = {
  chave: string;
  rotulo: string;
  data: string;
  hoje: boolean;
  tarefas: Array<{ id: string; titulo: string; cor: string; prova: boolean }>;
};

/** Um passo do cartão "Hoje": a tarefa mais urgente, o que revisar e o desafio do dia. */
export type PassoHoje = {
  id: string;
  tom: "rosa" | "amarelo" | "lilas" | "menta";
  rotulo: string;
  titulo: string;
  detalhe: string;
  feito: boolean;
  onClick: () => void;
};

/**
 * Cartão "Hoje" (nov/2026): a Home dizia tudo o que existe, mas não o que
 * fazer primeiro. São três post-its em ordem; o que já foi feito fica riscado.
 */
function CartaoHoje({ passos, reduced }: { passos: PassoHoje[]; reduced: boolean }) {
  const feitos = passos.filter((passo) => passo.feito).length;
  return (
    <section className="he-hoje" aria-labelledby="he-hoje-titulo">
      <div className="he-hoje-topo">
        <h2 id="he-hoje-titulo">o plano de hoje</h2>
        <span className="he-hoje-conta" aria-label={`${feitos} de ${passos.length} feitos`}>
          {passos.map((passo) => (
            <i key={passo.id} className={passo.feito ? "is-on" : ""} aria-hidden />
          ))}
          <b>
            {feitos} de {passos.length}
          </b>
        </span>
      </div>
      <ol className="he-hoje-lista">
        {passos.map((passo, indice) => (
          <motion.li
            key={passo.id}
            initial={reduced ? false : { opacity: 0, y: 14, rotate: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...mola, delay: reduced ? 0 : 0.12 + indice * 0.07 }}
          >
            <button type="button" className={`he-passo is-${passo.tom} ${passo.feito ? "is-feito" : ""}`} onClick={passo.onClick}>
              <span className="he-passo-num" aria-hidden>
                {passo.feito ? <Check className="h-4 w-4" strokeWidth={3} /> : indice + 1}
              </span>
              <span className="he-passo-texto">
                <small>{passo.rotulo}</small>
                <strong>{passo.titulo}</strong>
                <span>{passo.detalhe}</span>
              </span>
              <ArrowRight className="he-passo-seta h-4 w-4" aria-hidden />
            </button>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

export type AtalhoFichario = { id: string; label: string; icon: LucideIcon; tom: "lilas" | "amarelo" | "rosa" | "menta"; onClick: () => void };

const rotuloTipo: Record<ItemFicha["tipo"], string> = {
  atrasada: "atrasada",
  hoje: "pra hoje",
  prova: "prova",
  tarefa: "tarefa",
  revisao: "revisão",
  continuar: "continuar",
};

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

/** Reserva sem WebGL (tier baixo, movimento reduzido): a órbita em CSS, com seleção. */
function OrbitaPlana({ materias, selecionada, onSelecionar, onCriar }: { materias: MateriaEstante[]; selecionada: string | null; onSelecionar: (id: string) => void; onCriar: () => void }) {
  const lista = materias.slice(0, 9);
  return (
    <div className="home-orbita-plana he-plana">
      <span className="he-plana-mine" aria-hidden>
        <MineFace />
      </span>
      <span className="home-orbita-anel" aria-hidden />
      {lista.length ? (
        lista.map((materia, indice) => (
          <button
            key={materia.id}
            type="button"
            tabIndex={-1}
            className={`home-orbita-livro ${selecionada === materia.id ? "is-escolhido" : ""}`}
            style={{ "--cor": materia.color, "--a": `${(indice / lista.length) * 360}deg` } as React.CSSProperties}
            onClick={() => onSelecionar(materia.id)}
            aria-hidden
          >
            <span>{(materia.name.trim()[0] || "?").toUpperCase()}</span>
            {materia.aviso ? <i className={`he-plana-postit is-${materia.aviso.tom}`}>{materia.aviso.texto}</i> : null}
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

function Ficha({
  materia,
  posicao,
  total,
  onAnterior,
  onProxima,
  onAbrir,
  onPerguntar,
  reduced,
}: {
  materia: MateriaEstante;
  posicao: number;
  total: number;
  onAnterior: () => void;
  onProxima: () => void;
  onAbrir: () => void;
  onPerguntar: () => void;
  reduced: boolean;
}) {
  const Icone = materia.icon;
  const pct = materia.conteudos ? Math.round((materia.estudados / materia.conteudos) * 100) : 0;
  return (
    <motion.article
      key={materia.id}
      className="he-ficha"
      style={{ "--cor": materia.color } as React.CSSProperties}
      initial={reduced ? false : { opacity: 0, rotateY: -14, x: 18 }}
      animate={{ opacity: 1, rotateY: 0, x: 0 }}
      transition={mola}
      aria-labelledby="he-ficha-titulo"
    >
      <span className="he-ficha-aba" aria-hidden />
      {total > 1 ? (
        <div className="he-ficha-troca">
          <button type="button" onClick={onAnterior} aria-label="Matéria anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span aria-live="polite">
            matéria {posicao} de {total}
          </span>
          <button type="button" onClick={onProxima} aria-label="Próxima matéria">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      <header className="he-ficha-topo">
        <span className="he-ficha-icone" aria-hidden>
          <Icone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="he-ficha-titulo">{materia.name}</h2>
          <p className="he-ficha-numeros">
            {materia.conteudos ? (
              <>
                <span className="he-grifo" style={{ "--p": `${Math.max(pct, 6)}%` } as React.CSSProperties}>
                  {pct}% estudado
                </span>{" "}
                · {materia.estudados} de {materia.conteudos} {materia.conteudos === 1 ? "conteúdo" : "conteúdos"}
              </>
            ) : (
              "nenhum conteúdo ainda"
            )}
          </p>
        </div>
      </header>

      <h3 className="he-ficha-sub">o que fazer agora</h3>
      {materia.itens.length ? (
        <ul className="he-ficha-lista">
          {materia.itens.map((item) => (
            <li key={item.id}>
              <button type="button" className={`he-item is-${item.tipo}`} onClick={item.onClick}>
                <span className="he-item-tag">{rotuloTipo[item.tipo]}</span>
                <span className="he-item-texto">
                  <strong>{item.titulo}</strong>
                  <small>{item.detalhe}</small>
                </span>
                <ArrowRight className="he-item-seta h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="he-ficha-vazia">
          Nada pendente aqui. {materia.conteudos ? "Bom momento para adiantar um conteúdo novo." : "Coloque o primeiro conteúdo e a Mine começa a ajudar."}
        </p>
      )}

      <button type="button" className="he-ficha-dica" onClick={onPerguntar}>
        <span className="he-ficha-dica-rosto" aria-hidden>
          <MineFace />
        </span>
        <span>{materia.dica}</span>
      </button>

      <div className="he-ficha-acoes">
        <button type="button" className="he-btn caderno-btn-pen" onClick={onAbrir}>
          Estudar {materia.name.length > 18 ? "agora" : materia.name}
          <ArrowRight className="h-4 w-4" />
        </button>
        <button type="button" className="he-btn he-btn-papel" onClick={onPerguntar}>
          <Bot className="h-4 w-4" /> Perguntar à Mine
        </button>
      </div>
    </motion.article>
  );
}

function FichaVazia({ onCriar }: { onCriar: () => void }) {
  return (
    <article className="he-ficha is-vazia">
      <span className="he-ficha-aba" aria-hidden />
      <h2>Sua estante está vazia</h2>
      <p>
        Cada <strong>matéria</strong> vira um caderno girando em volta da Mine. Dentro dele ficam seus conteúdos, tarefas e provas, e a Mine usa tudo isso para
        explicar, criar flashcards e montar simulados.
      </p>
      <button type="button" className="he-btn caderno-btn-pen" onClick={onCriar}>
        <Plus className="h-4 w-4" /> Criar a primeira matéria
      </button>
    </article>
  );
}

export function HomeEstante({
  saudacao,
  nome,
  frase,
  materias,
  nivel,
  titulo,
  xpNivel,
  xpPreciso,
  dias,
  semana,
  dataHoje,
  proximos,
  xpHoje,
  estudados,
  conteudos,
  atalhos,
  tema,
  onAbrir,
  onPerguntar,
  onNovaMateria,
  onMine,
  onProgresso,
  onAgenda,
  passosHoje = [],
}: {
  passosHoje?: PassoHoje[];
  dataHoje: string;
  proximos: DiaSemana[];
  xpHoje: number;
  estudados: number;
  conteudos: number;
  onAgenda: () => void;
  saudacao: string;
  nome: string;
  frase: string;
  materias: MateriaEstante[];
  nivel: number;
  titulo: string;
  xpNivel: number;
  xpPreciso: number;
  dias: number;
  semana: boolean[];
  atalhos: AtalhoFichario[];
  tema: string;
  onAbrir: (id: string) => void;
  onPerguntar: (id: string) => void;
  onNovaMateria: () => void;
  onMine: () => void;
  onProgresso: () => void;
}) {
  const reduced = useSoftMotion();
  const ligada = useCena3D();
  const [falhou, setFalhou] = useState(false);
  const [escolhida, setEscolhida] = useState<string | null>(materias[0]?.id ?? null);
  const fileiraRef = useRef<HTMLDivElement>(null);

  // A lista muda (matéria nova, apagada): mantém a escolha se ela ainda existe.
  useEffect(() => {
    if (!materias.length) setEscolhida(null);
    else if (!escolhida || !materias.some((item) => item.id === escolhida)) setEscolhida(materias[0].id);
  }, [materias, escolhida]);

  const indice = Math.max(0, materias.findIndex((item) => item.id === escolhida));
  const atual = materias[indice];
  const orbita: MateriaOrbita[] = useMemo(() => materias.map(({ id, name, color, aviso }) => ({ id, name, color, aviso })), [materias]);
  const andar = (passo: number) => {
    if (!materias.length) return;
    setEscolhida(materias[(indice + passo + materias.length) % materias.length].id);
  };
  const progresso = Math.max(0, Math.min(1, xpNivel / Math.max(1, xpPreciso)));
  // O que já está na ficha não se repete na semana.
  const semanaVisivel = useMemo(() => {
    const naFicha = new Set((atual?.itens || []).map((item) => item.id));
    return proximos.map((dia) => ({ ...dia, tarefas: dia.tarefas.filter((tarefa) => !naFicha.has(tarefa.id)) }));
  }, [proximos, atual]);
  const diasLivres = semanaVisivel.filter((dia) => !dia.tarefas.length).length;

  // A fileira acompanha a escolha feita na órbita.
  useEffect(() => {
    const botao = fileiraRef.current?.querySelector<HTMLElement>(`[data-id="${escolhida}"]`);
    botao?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [escolhida, reduced]);

  return (
    <div className="he-page">
      <header className="he-hero">
        <motion.span
          className="he-hero-mine"
          aria-hidden
          initial={reduced ? false : { opacity: 0, scale: 0.8, rotate: -8 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
        >
          {ligada && !falhou ? (
            <Guarda onFail={() => setFalhou(true)}>
              <React.Suspense fallback={<MineFace track draw={!reduced} />}>
                <MineRetrato3D key={tema} className="he-hero-mine-3d" />
              </React.Suspense>
            </Guarda>
          ) : (
            <MineFace track draw={!reduced} />
          )}
        </motion.span>
        <div className="he-hero-texto">
          <motion.p className="he-hero-data" initial={reduced ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={mola}>
            {dataHoje}
          </motion.p>
          <motion.h1 className="he-saudacao" initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...mola, delay: 0.05 }}>
            {saudacao}, <span className="he-nome">{nome}</span>.
          </motion.h1>
          <motion.p className="he-hero-fala" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...mola, delay: 0.18 }}>
            {frase}
          </motion.p>
          <motion.div className="he-hero-acoes" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...mola, delay: 0.28 }}>
            {atual ? (
              <button type="button" className="he-btn caderno-btn-pen" onClick={() => onAbrir(materias[0].id)}>
                Começar por {materias[0].name.length > 18 ? "aqui" : materias[0].name} <ArrowRight className="h-4 w-4" />
              </button>
            ) : null}
            <button type="button" className={`he-btn ${atual ? "he-btn-papel" : "caderno-btn-pen"}`} onClick={onNovaMateria}>
              <Plus className="h-4 w-4" /> Nova matéria
            </button>
            {atual ? (
              <button type="button" className="he-link" onClick={onMine}>
                <Bot className="h-4 w-4" /> conversar com a Mine
              </button>
            ) : null}
          </motion.div>
        </div>
      </header>

      {passosHoje.length ? <CartaoHoje passos={passosHoje} reduced={reduced} /> : null}

      <section className="he-palco" aria-label="Sua estante de matérias">
        <motion.div
          className="he-orbita"
          initial={reduced ? false : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...mola, delay: 0.1 }}
        >
          {ligada && !falhou ? (
            <Guarda onFail={() => setFalhou(true)}>
              <React.Suspense fallback={<OrbitaPlana materias={materias} selecionada={escolhida} onSelecionar={setEscolhida} onCriar={onNovaMateria} />}>
                <Sistema3D key={tema} materias={orbita} selecionada={escolhida} onSelecionar={setEscolhida} onAbrir={onAbrir} onCriar={onNovaMateria} onNucleo={onMine} />
              </React.Suspense>
            </Guarda>
          ) : (
            <OrbitaPlana materias={materias} selecionada={escolhida} onSelecionar={setEscolhida} onCriar={onNovaMateria} />
          )}
          <p className="he-orbita-legenda" aria-hidden>
            {materias.length
              ? ligada && !falhou
                ? "toque num caderno para ver a ficha · toque de novo para abrir · arraste para girar"
                : "toque num caderno para ver a ficha"
              : "cada matéria vira um caderno em volta da Mine"}
          </p>
        </motion.div>

        <div className="he-lado">{atual ? <Ficha materia={atual} posicao={indice + 1} total={materias.length} onAnterior={() => andar(-1)} onProxima={() => andar(1)} onAbrir={() => onAbrir(atual.id)} onPerguntar={() => onPerguntar(atual.id)} reduced={reduced} /> : <FichaVazia onCriar={onNovaMateria} />}</div>

        {materias.length ? (
          <div
            ref={fileiraRef}
            className="he-fileira"
            role="radiogroup"
            aria-label="Escolha a matéria"
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                andar(1);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                andar(-1);
              } else return;
              window.requestAnimationFrame(() => fileiraRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
            }}
          >
            {materias.map((materia) => {
              const ativa = materia.id === escolhida;
              return (
                <button
                  key={materia.id}
                  type="button"
                  role="radio"
                  aria-checked={ativa}
                  tabIndex={ativa ? 0 : -1}
                  data-id={materia.id}
                  className={`he-caderno ${ativa ? "is-on" : ""}`}
                  style={{ "--cor": materia.color } as React.CSSProperties}
                  onClick={() => setEscolhida(materia.id)}
                  onDoubleClick={() => onAbrir(materia.id)}
                >
                  <span className="he-caderno-lombada" aria-hidden />
                  <span className="he-caderno-nome">{materia.name}</span>
                  {materia.aviso ? <span className={`he-caderno-postit is-${materia.aviso.tom}`}>{materia.aviso.texto}</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}
        <nav className="he-fichario" aria-label="Atalhos">
          {atalhos.map((atalho) => {
            const Icone = atalho.icon;
            return (
              <button key={atalho.id} type="button" className={`he-aba is-${atalho.tom}`} onClick={atalho.onClick}>
                <Icone className="h-4 w-4" aria-hidden />
                <span>{atalho.label}</span>
              </button>
            );
          })}
        </nav>
      </section>


      <footer className="he-regua" aria-label="Seu progresso">
        <div className="he-regua-nivel">
          <strong>Nível {nivel}</strong>
          <span>
            {titulo}
            {xpHoje ? <b className="he-xp-hoje"> · +{xpHoje} XP hoje</b> : null}
          </span>
        </div>
        <div className="he-regua-barra" role="meter" aria-label="XP do nível" aria-valuemin={0} aria-valuemax={xpPreciso} aria-valuenow={xpNivel}>
          <motion.span className="he-regua-tinta" initial={reduced ? false : { scaleX: 0 }} animate={{ scaleX: progresso }} transition={{ ...mola, delay: 0.35 }} />
          <span className="he-regua-texto">
            {xpNivel} / {xpPreciso} XP · faltam {Math.max(0, xpPreciso - xpNivel)} para o nível {nivel + 1}
          </span>
        </div>
        <div className="he-regua-dias" aria-label={`${dias} ${dias === 1 ? "dia" : "dias"} seguidos de estudo`}>
          <span className="he-regua-semana" aria-hidden>
            {semana.map((estudou, i) => (
              <i key={i} className={estudou ? "is-on" : ""} />
            ))}
          </span>
          <span>
            {dias} {dias === 1 ? "dia seguido" : "dias seguidos"}
          </span>
        </div>
        {conteudos ? (
          <p className="he-regua-total">
            <strong>{estudados}</strong> de {conteudos} conteúdos estudados
          </p>
        ) : null}
        <button type="button" className="he-link" onClick={onProgresso}>
          ver progresso <ArrowRight className="h-4 w-4" />
        </button>
      </footer>

      <section className="he-semana" aria-labelledby="he-semana-titulo">
        <div className="he-semana-topo">
          <h2 id="he-semana-titulo">próximos 7 dias</h2>
          <button type="button" className="he-link" onClick={onAgenda}>
            abrir agenda <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <ol className="he-semana-dias">
          {semanaVisivel.map((dia) => (
            <li key={dia.chave} className={`he-dia ${dia.hoje ? "is-hoje" : ""} ${dia.tarefas.length ? "" : "is-livre"}`}>
              <button type="button" onClick={onAgenda} aria-label={`${dia.rotulo}, ${dia.data}: ${dia.tarefas.length ? dia.tarefas.map((t) => t.titulo).join(", ") : "dia livre"}`}>
                <span className="he-dia-nome">
                  {dia.rotulo} <small>{dia.data}</small>
                </span>
                {dia.tarefas.length ? (
                  <span className="he-dia-tarefas">
                    {dia.tarefas.slice(0, 2).map((tarefa) => (
                      <span key={tarefa.id} className={`he-dia-tarefa ${tarefa.prova ? "is-prova" : ""}`}>
                        <i className="he-dia-ponto" style={{ background: tarefa.cor }} aria-hidden />
                        <span>{tarefa.titulo}</span>
                      </span>
                    ))}
                    {dia.tarefas.length > 2 ? <span className="he-dia-mais">+{dia.tarefas.length - 2}</span> : null}
                  </span>
                ) : (
                  <span className="he-dia-livre">livre</span>
                )}
              </button>
            </li>
          ))}
        </ol>
        {diasLivres ? (
          <p className="he-semana-livres">
            {diasLivres} {diasLivres === 1 ? "dia livre" : "dias livres"} nesta semana
          </p>
        ) : null}
      </section>
    </div>
  );
}
