import React, { useMemo, useState } from "react";
import { Bot, Scale, Search, Shuffle, Sparkles, X } from "lucide-react";
import { balance, molarMass } from "../../shared/quimica.mjs";
import { CATEGORIAS, ELEMENTOS, USOS, distribuicao, textoDistribuicao, type Categoria, type Elemento } from "./elementos";

/**
 * Tabela periódica interativa: cores por família ou estado físico, busca,
 * ficha do elemento com distribuição de Pauling, um jogo de achar o elemento
 * e duas contas de química (massa molar e balanceamento) que usam o mesmo
 * código das ferramentas da Mine no servidor.
 */

type Colorir = "familia" | "estado";

function fold(texto: string) {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function massaTexto(m: number) {
  return (Number.isInteger(m) ? `(${m})` : m.toLocaleString("pt-BR", { maximumFractionDigits: 3 }));
}

export function TabelaPeriodica({ askMine }: { askMine: (text: string) => void }) {
  const [colorir, setColorir] = useState<Colorir>("familia");
  const [busca, setBusca] = useState("");
  const [destaque, setDestaque] = useState<Categoria | null>(null);
  const [selecionado, setSelecionado] = useState<Elemento | null>(() => ELEMENTOS[25]); // Ferro
  const [jogo, setJogo] = useState<{ alvo: Elemento; acertos: number; rodada: number; errou: number | null } | null>(null);

  const termo = fold(busca);
  const combina = (el: Elemento) =>
    !termo || fold(el.nome).startsWith(termo) || el.simbolo.toLowerCase() === termo || String(el.numero) === termo || fold(el.nome).includes(termo);

  function sortear(anterior?: Elemento) {
    // Os 56 primeiros e os mais cobrados: ninguém precisa achar o Moscóvio.
    const pool = ELEMENTOS.filter((el) => el.numero <= 56 || ["Au", "Hg", "Pb", "Pt", "U", "Rn", "W"].includes(el.simbolo));
    let alvo = pool[Math.floor(Math.random() * pool.length)];
    while (anterior && alvo.numero === anterior.numero) alvo = pool[Math.floor(Math.random() * pool.length)];
    return alvo;
  }

  function clicar(el: Elemento) {
    if (!jogo) {
      setSelecionado(el);
      return;
    }
    if (el.numero === jogo.alvo.numero) {
      const rodada = jogo.rodada + 1;
      setSelecionado(el);
      setJogo(rodada > 10 ? { ...jogo, acertos: jogo.acertos + (jogo.errou ? 0 : 1), rodada, errou: null } : { alvo: sortear(el), acertos: jogo.acertos + (jogo.errou ? 0 : 1), rodada, errou: null });
    } else {
      setJogo({ ...jogo, errou: el.numero });
    }
  }

  const terminou = jogo && jogo.rodada > 10;

  return (
    <div className="tp">
      <div className="tp-barra">
        <label className="tp-busca">
          <Search className="h-4 w-4" aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar: ferro, Fe ou 26" aria-label="Buscar elemento" />
          {busca ? (
            <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca">
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </label>
        <div className="tp-colorir" role="group" aria-label="Colorir por">
          <button type="button" aria-pressed={colorir === "familia"} onClick={() => setColorir("familia")}>Famílias</button>
          <button type="button" aria-pressed={colorir === "estado"} onClick={() => setColorir("estado")}>Estado físico</button>
        </div>
        <button
          type="button"
          className="tp-jogar"
          data-ativo={jogo ? "" : undefined}
          onClick={() => {
            if (jogo) setJogo(null);
            else {
              setBusca("");
              setJogo({ alvo: sortear(), acertos: 0, rodada: 1, errou: null });
            }
          }}
        >
          <Shuffle className="h-4 w-4" aria-hidden /> {jogo ? "Sair do jogo" : "Jogo: ache o elemento"}
        </button>
      </div>

      {jogo ? (
        <div className="tp-jogo" aria-live="polite">
          {terminou ? (
            <>
              <strong>Fim! Você acertou {jogo.acertos} de 10 de primeira.</strong>
              <button type="button" onClick={() => setJogo({ alvo: sortear(), acertos: 0, rodada: 1, errou: null })}>Jogar de novo</button>
            </>
          ) : (
            <>
              <span className="tp-jogo-rodada">{jogo.rodada}/10</span>
              <span>
                Onde está o <strong>{jogo.alvo.nome}</strong>?
              </span>
              {jogo.errou ? <span className="tp-jogo-erro">Esse é o {ELEMENTOS[jogo.errou - 1].nome}. Tenta de novo!</span> : null}
              <span className="tp-jogo-placar">{jogo.acertos} de primeira</span>
            </>
          )}
        </div>
      ) : null}

      <div className="tp-legenda" role="list">
        {colorir === "familia"
          ? CATEGORIAS.map((c) => (
              <button
                key={c.id}
                type="button"
                role="listitem"
                className="tp-legenda-item"
                data-cat={c.id}
                aria-pressed={destaque === c.id}
                onClick={() => setDestaque((d) => (d === c.id ? null : c.id))}
              >
                <i aria-hidden /> {c.nome}
              </button>
            ))
          : (["sólido", "líquido", "gasoso"] as const).map((e) => (
              <span key={e} role="listitem" className="tp-legenda-item" data-estado={e}>
                <i aria-hidden /> {e}
              </span>
            ))}
      </div>

      <div className="tp-rolagem">
        <div className="tp-grade" data-colorir={colorir}>
          {Array.from({ length: 18 }, (_, i) => (
            <span key={`g${i}`} className="tp-num-grupo" style={{ gridColumn: i + 1, gridRow: 1 }} aria-hidden>
              {i + 1}
            </span>
          ))}
          <span className="tp-marcador" style={{ gridColumn: 3, gridRow: 7 }} aria-hidden>57–71</span>
          <span className="tp-marcador" style={{ gridColumn: 3, gridRow: 8 }} aria-hidden>89–103</span>
          {ELEMENTOS.map((el) => {
            const apagado = (termo && !combina(el)) || (destaque && el.categoria !== destaque);
            // A linha 1 da grade é o número do grupo; a 9 fica vazia (o vão antes dos lantanídeos e actinídeos).
            const linha = el.linha + 1;
            return (
              <button
                key={el.numero}
                type="button"
                className="tp-el"
                data-cat={el.categoria}
                data-estado={el.estado}
                data-apagado={apagado || undefined}
                data-sel={!jogo && selecionado?.numero === el.numero ? "" : undefined}
                data-errou={jogo?.errou === el.numero ? "" : undefined}
                style={{ gridColumn: el.coluna, gridRow: linha }}
                onClick={() => clicar(el)}
                aria-label={jogo ? `Elemento ${el.numero}` : `${el.nome}, número ${el.numero}`}
                title={jogo ? undefined : `${el.nome} (${el.numero})`}
              >
                <span className="tp-el-z">{el.numero}</span>
                <strong className="tp-el-s">{jogo ? "?" : el.simbolo}</strong>
                <span className="tp-el-n">{jogo ? "" : el.nome}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="tp-baixo">
        {selecionado ? <Ficha el={selecionado} askMine={askMine} onFechar={() => setSelecionado(null)} /> : <p className="tp-vazio">Toque num elemento para ver a ficha dele.</p>}
        <QuimicaRapida />
      </div>
    </div>
  );
}

function Ficha({ el, askMine, onFechar }: { el: Elemento; askMine: (text: string) => void; onFechar: () => void }) {
  const dist = useMemo(() => distribuicao(el.numero), [el.numero]);
  const categoria = CATEGORIAS.find((c) => c.id === el.categoria)!.nome;
  const uso = USOS[el.simbolo];
  return (
    <article className="tp-ficha" data-cat={el.categoria} aria-label={`Ficha do ${el.nome}`}>
      <button type="button" className="tp-ficha-fechar" onClick={onFechar} aria-label="Fechar ficha">
        <X className="h-4 w-4" aria-hidden />
      </button>
      <div className="tp-ficha-topo">
        <div className="tp-ficha-cubo">
          <span>{el.numero}</span>
          <strong>{el.simbolo}</strong>
          <small>{massaTexto(el.massa)}</small>
        </div>
        <div>
          <h3>{el.nome}</h3>
          <p>
            {categoria} · {el.estado} a 25 °C
          </p>
          <p>
            {el.periodo}º período · {el.grupo ? `grupo ${el.grupo}` : el.categoria === "lantanideo" ? "série dos lantanídeos" : "série dos actinídeos"}
          </p>
        </div>
      </div>
      <dl className="tp-ficha-dados">
        <div>
          <dt>Massa atômica</dt>
          <dd>{massaTexto(el.massa)} u</dd>
        </div>
        <div>
          <dt>Prótons / elétrons</dt>
          <dd>
            {el.numero} / {el.numero}
          </dd>
        </div>
        <div>
          <dt>Camadas</dt>
          <dd>{dist.camadas.map(([c, n]) => `${c}=${n}`).join("  ")}</dd>
        </div>
        <div>
          <dt>Camada de valência</dt>
          <dd>
            {dist.valencia.camada} com {dist.valencia.eletrons} {dist.valencia.eletrons === 1 ? "elétron" : "elétrons"}
          </dd>
        </div>
      </dl>
      <p className="tp-ficha-dist">
        <span>Distribuição (Linus Pauling)</span>
        <code>{textoDistribuicao(dist)}</code>
        <small>
          Subnível mais energético: <b>{dist.maisEnergetico}</b>
          {["Cr", "Cu", "Mo", "Ag", "Au", "Pd", "Pt", "Nb", "Ru", "Rh"].includes(el.simbolo) ? " · Na prática esse elemento é uma exceção ao diagrama." : ""}
        </small>
      </p>
      {uso ? (
        <p className="tp-ficha-uso">
          <Sparkles className="h-4 w-4" aria-hidden /> {uso}
        </p>
      ) : null}
      <button type="button" className="tp-ficha-mine" onClick={() => askMine(`Me explica o elemento ${el.nome} (${el.simbolo}, número atômico ${el.numero}): onde fica na tabela, propriedades, usos no dia a dia e o que costuma cair no ENEM.`)}>
        <Bot className="h-4 w-4" aria-hidden /> Perguntar à Mine sobre o {el.nome}
      </button>
    </article>
  );
}

function QuimicaRapida() {
  const [formula, setFormula] = useState("H2SO4");
  const [equacao, setEquacao] = useState("Fe + O2 -> Fe2O3");

  const massa = useMemo(() => {
    if (!formula.trim()) return null;
    try {
      return { ok: true as const, ...molarMass(formula.trim()) };
    } catch (erro) {
      return { ok: false as const, erro: (erro as Error).message };
    }
  }, [formula]);

  const balanceada = useMemo(() => {
    if (!equacao.trim()) return null;
    try {
      return { ok: true as const, ...balance(equacao.trim()) };
    } catch (erro) {
      return { ok: false as const, erro: (erro as Error).message };
    }
  }, [equacao]);

  return (
    <div className="tp-quimica">
      <section>
        <h3>
          <Scale className="h-4 w-4" aria-hidden /> Massa molar
        </h3>
        <input value={formula} onChange={(e) => setFormula(e.target.value)} placeholder="Ex.: C6H12O6 ou Ca(OH)2" aria-label="Fórmula química" spellCheck={false} />
        {massa?.ok ? (
          <div className="tp-quimica-res">
            <strong>{massa.massaMolar.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} g/mol</strong>
            <ul>
              {massa.elementos.map((item) => (
                <li key={item.symbol}>
                  {item.symbol}: {item.quantidade} × {item.massaAtomica.toLocaleString("pt-BR")} = {item.subtotal.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                </li>
              ))}
            </ul>
          </div>
        ) : massa ? (
          <p className="tp-quimica-erro">{massa.erro}</p>
        ) : null}
      </section>
      <section>
        <h3>
          <Sparkles className="h-4 w-4" aria-hidden /> Balancear equação
        </h3>
        <input value={equacao} onChange={(e) => setEquacao(e.target.value)} placeholder="Ex.: CH4 + O2 -> CO2 + H2O" aria-label="Equação química" spellCheck={false} />
        {balanceada?.ok ? (
          <div className="tp-quimica-res">
            <strong className="tp-quimica-eq">{balanceada.equacao.replace(/(^|\s)(\d+)(?=[A-Z([])/g, "$1$2 ").replace(/(\d+)/g, (m, _d, i, s) => (/[A-Za-z)\]]/.test(s[i - 1] || "") ? sub(m) : m))}</strong>
          </div>
        ) : balanceada ? (
          <p className="tp-quimica-erro">{balanceada.erro}</p>
        ) : null}
      </section>
    </div>
  );
}

const SUBS = "₀₁₂₃₄₅₆₇₈₉";
function sub(n: string) {
  return n.replace(/\d/g, (d) => SUBS[Number(d)]);
}
