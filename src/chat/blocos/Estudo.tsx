import { useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarPlus, Check, Copy, Layers, Maximize2, RotateCcw, Shuffle, Volume2, X } from "lucide-react";
import { compile, tidyNumber } from "../../../shared/calc.mjs";
import { MineInline, MineRichText } from "../MineRichText";
import { firstGalleryImage, type GalleryImage } from "../MineImageGallery";
import { BlocoAcoesContext } from "./Blocos";
import "./estudo.css";

/*
 * Blocos de estudo do chat (21/nov/2026), no estilo do que o ChatGPT monta no
 * meio da resposta: flashcards, plano marcável, cartões de número, colunas,
 * texto reescrito, avaliação, calculadora e lista com fotos. A Mine escreve
 * JSON num bloco de código; formatos em mine/prompts.mjs (buildToolsInstruction).
 * JSON que não servir volta a ser código comum (quem chama mostra o fallback).
 */

export const ESTUDO_LANGS = new Set(["flashcards", "plano", "numeros", "números", "colunas", "texto", "avaliacao", "avaliação", "calculadora", "lista-imagens"]);

const str = (value: unknown, max = 600) => (typeof value === "string" ? value.trim().slice(0, max) : typeof value === "number" ? String(value) : "");
const num = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : Number.isFinite(Number(value)) && value !== "" && value !== null ? Number(value) : fallback);
const lista = (value: unknown) => (Array.isArray(value) ? value : []) as Record<string, unknown>[];

function readJson(code: string): Record<string, unknown> | null {
  const text = code.trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(text.slice(start, end + 1));
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Chave estável para guardar o progresso de um bloco no aparelho. */
function hashOf(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function lerLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function gravarLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* aba anônima: vale até recarregar */
  }
}

function falar(texto: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const fala = new SpeechSynthesisUtterance(texto.replace(/\$/g, "").replace(/\*\*/g, ""));
  fala.lang = "pt-BR";
  fala.rate = 0.95;
  window.speechSynthesis.speak(fala);
}

// ── Flashcards ──────────────────────────────────────────────────────────────
type Cartao = { frente: string; verso: string };

function lerFlashcards(data: Record<string, unknown>) {
  const cartoes = lista(data.cartoes)
    .map((raw) => ({ frente: str(raw.frente ?? raw.front, 300), verso: str(raw.verso ?? raw.back, 600) }))
    .filter((item) => item.frente && item.verso)
    .slice(0, 30);
  return cartoes.length >= 2 ? { titulo: str(data.titulo, 120) || "Flashcards", cartoes } : null;
}

function Flashcards({ titulo, cartoes }: { titulo: string; cartoes: Cartao[] }) {
  const acoes = useContext(BlocoAcoesContext);
  const [ordem, setOrdem] = useState(() => cartoes.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [virado, setVirado] = useState(false);
  const [notas, setNotas] = useState<Record<number, "sabia" | "errei">>({});
  const [salvo, setSalvo] = useState(false);
  const fim = pos >= ordem.length;
  const atual = fim ? null : cartoes[ordem[pos]];
  const sabia = Object.values(notas).filter((n) => n === "sabia").length;
  const errei = Object.entries(notas).filter(([, n]) => n === "errei").map(([i]) => Number(i));

  const marcar = (nota: "sabia" | "errei") => {
    if (fim) return;
    setNotas((atual) => ({ ...atual, [ordem[pos]]: nota }));
    setVirado(false);
    setPos((p) => p + 1);
  };
  const recomeçar = (so?: number[]) => {
    setOrdem(so && so.length ? so : cartoes.map((_, i) => i));
    setPos(0);
    setVirado(false);
    setNotas({});
  };
  const embaralhar = () => {
    const nova = cartoes.map((_, i) => i);
    for (let i = nova.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [nova[i], nova[j]] = [nova[j], nova[i]];
    }
    recomeçar(nova);
  };
  const onKey = (event: React.KeyboardEvent) => {
    if (fim) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      setVirado((v) => !v);
    }
    if (event.key === "ArrowRight") marcar("sabia");
    if (event.key === "ArrowLeft") marcar("errei");
  };

  return (
    <section className="mbk mbk-fc" aria-label={`Flashcards: ${titulo}`} onKeyDown={onKey}>
      <header className="mbk-head">
        <strong>
          <Layers aria-hidden /> {titulo}
        </strong>
        <span className="mbk-meta">{fim ? "Resultado" : `${pos + 1} de ${ordem.length}`}</span>
      </header>
      <div className="mbk-progress" aria-hidden>
        <i style={{ width: `${(pos / ordem.length) * 100}%` }} />
      </div>
      {atual ? (
        <>
          <button type="button" className={`mbk-fc__carta${virado ? " is-virado" : ""}`} onClick={() => setVirado((v) => !v)} aria-label={virado ? "Mostrar a pergunta" : "Virar o cartão"}>
            <span className="mbk-fc__face mbk-fc__frente">
              <span className="mbk-fc__texto">
                <MineInline text={atual.frente} />
              </span>
              <small>Toque para virar</small>
            </span>
            <span className="mbk-fc__face mbk-fc__verso" aria-hidden={!virado}>
              <span className="mbk-fc__texto">
                <MineInline text={atual.verso} />
              </span>
            </span>
          </button>
          <div className="mbk-fc__acoes">
            <button type="button" className="mbk-fc__nota is-errei" onClick={() => marcar("errei")} aria-label="Não sabia">
              <X aria-hidden />
            </button>
            <button type="button" className="mbk-fc__nota is-sabia" onClick={() => marcar("sabia")} aria-label="Sabia">
              <Check aria-hidden />
            </button>
            <button type="button" className="mbk-icon" onClick={() => falar(virado ? atual.verso : atual.frente)} aria-label="Ouvir o cartão">
              <Volume2 aria-hidden />
            </button>
            <button type="button" className="mbk-icon" onClick={embaralhar} aria-label="Embaralhar">
              <Shuffle aria-hidden />
            </button>
          </div>
        </>
      ) : (
        <div className="mbk-fc__fim">
          <p className="mbk-quiz__nota">
            {sabia} de {ordem.length}
          </p>
          <p className="mbk-muted">{errei.length ? `Você ainda não sabia ${errei.length === 1 ? "1 cartão" : `${errei.length} cartões`}. Vale passar por eles de novo.` : "Sabia todos. Volte amanhã para fixar."}</p>
          <div className="mbk-row">
            {errei.length ? (
              <button type="button" className="mbk-btn" onClick={() => recomeçar(errei)}>
                <RotateCcw aria-hidden /> Revisar os que errei
              </button>
            ) : null}
            <button type="button" className="mbk-btn is-ghost" onClick={() => recomeçar()}>
              Recomeçar
            </button>
          </div>
        </div>
      )}
      {acoes?.salvarFlashcards ? (
        <button
          type="button"
          className="mbk-link mbk-fc__salvar"
          disabled={salvo}
          onClick={() => {
            acoes.salvarFlashcards?.({ titulo, cartoes });
            setSalvo(true);
          }}
        >
          {salvo ? (
            <>
              <Check aria-hidden /> Salvos na revisão espaçada
            </>
          ) : (
            <>
              <Layers aria-hidden /> Salvar na revisão espaçada
            </>
          )}
        </button>
      ) : null}
    </section>
  );
}

// ── Plano de estudos ────────────────────────────────────────────────────────
type DiaPlano = { titulo: string; texto: string };
type Semana = { titulo: string; meta: string; dias: DiaPlano[] };
const CORES_DIVISAO = ["#7b8cf0", "#2a9d8f", "#e9a23b", "#b98cf0", "#e76f8a", "#4cb5e0"];

function lerPlano(data: Record<string, unknown>, code: string) {
  const semanas: Semana[] = lista(data.semanas)
    .map((raw) => ({
      titulo: str(raw.titulo, 100),
      meta: str(raw.meta, 300),
      dias: lista(raw.dias)
        .map((d) => ({ titulo: str(d.titulo, 120), texto: str(d.texto, 300) }))
        .filter((d) => d.titulo)
        .slice(0, 14),
    }))
    .filter((s) => s.dias.length)
    .slice(0, 8);
  // Plano sem semanas: lista simples de dias.
  if (!semanas.length) {
    const dias = lista(data.dias)
      .map((d) => ({ titulo: str(d.titulo, 120), texto: str(d.texto, 300) }))
      .filter((d) => d.titulo)
      .slice(0, 31);
    if (dias.length) semanas.push({ titulo: "", meta: "", dias });
  }
  if (!semanas.length) return null;
  const divisao = lista(data.divisao)
    .map((raw) => ({ rotulo: str(raw.rotulo, 60), minutos: Math.max(1, Math.round(num(raw.minutos, 0))), texto: str(raw.texto, 120) }))
    .filter((d) => d.rotulo && d.minutos > 0)
    .slice(0, 6);
  const selos = (Array.isArray(data.selos) ? data.selos : []).map((s) => str(s, 40)).filter(Boolean).slice(0, 4);
  return { titulo: str(data.titulo, 120) || "Plano de estudos", materia: str(data.materia, 60), selos, divisao, semanas, chave: `minerva:plano:${hashOf(code)}` };
}

function Plano({ titulo, materia, selos, divisao, semanas, chave }: NonNullable<ReturnType<typeof lerPlano>>) {
  const acoes = useContext(BlocoAcoesContext);
  const [feitos, setFeitos] = useState<string[]>(() => lerLocal(chave, [] as string[]));
  const [naAgenda, setNaAgenda] = useState(false);
  const total = divisao.reduce((soma, d) => soma + d.minutos, 0);
  const alternar = (id: string) => {
    setFeitos((atual) => {
      const nova = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id];
      gravarLocal(chave, nova);
      return nova;
    });
  };
  const todosDias = semanas.flatMap((s) => s.dias);
  return (
    <section className="mbk mbk-plano" aria-label={`Plano: ${titulo}`}>
      <header className="mbk-head">
        <strong>{titulo}</strong>
        <span className="mbk-meta">
          {feitos.length}/{todosDias.length} feitos
        </span>
      </header>
      {selos.length ? (
        <p className="mbk-plano__selos">
          {selos.map((s, i) => (
            <span key={i}>{s}</span>
          ))}
        </p>
      ) : null}
      {divisao.length ? (
        <div className="mbk-plano__divisao" aria-label={`Divisão de ${total} minutos`}>
          <div className="mbk-plano__barra" aria-hidden>
            {divisao.map((d, i) => (
              <i key={i} style={{ flex: d.minutos, background: CORES_DIVISAO[i % CORES_DIVISAO.length] }} />
            ))}
          </div>
          <ul>
            {divisao.map((d, i) => (
              <li key={i}>
                <span className="mbk-plano__ponto" style={{ background: CORES_DIVISAO[i % CORES_DIVISAO.length] }} aria-hidden />
                <span>
                  <strong>
                    {d.minutos} min · {d.rotulo}
                  </strong>
                  {d.texto ? <small>{d.texto}</small> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {semanas.map((semana, si) => {
        const feitosAqui = semana.dias.filter((_, di) => feitos.includes(`${si}-${di}`)).length;
        return (
          <div key={si} className="mbk-plano__semana">
            {semana.titulo ? (
              <div className="mbk-plano__semana-topo">
                <strong>{semana.titulo}</strong>
                <span className="mbk-meta">
                  {feitosAqui}/{semana.dias.length} concluídos
                </span>
              </div>
            ) : null}
            {semana.meta ? <p className="mbk-muted mbk-plano__meta">{semana.meta}</p> : null}
            <div className="mbk-progress" aria-hidden>
              <i style={{ width: `${(feitosAqui / semana.dias.length) * 100}%` }} />
            </div>
            <ul className="mbk-plano__dias">
              {semana.dias.map((dia, di) => {
                const id = `${si}-${di}`;
                const ok = feitos.includes(id);
                return (
                  <li key={di}>
                    <label className={ok ? "is-feito" : ""}>
                      <input type="checkbox" checked={ok} onChange={() => alternar(id)} />
                      <span className="mbk-plano__check" aria-hidden>
                        {ok ? <Check /> : null}
                      </span>
                      <span>
                        <strong>
                          <MineInline text={dia.titulo} />
                        </strong>
                        {dia.texto ? (
                          <small>
                            <MineInline text={dia.texto} />
                          </small>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {acoes?.levarParaAgenda ? (
        <button
          type="button"
          className="mbk-btn"
          disabled={naAgenda}
          onClick={() => {
            acoes.levarParaAgenda?.({ titulo, materia, dias: todosDias.map((d, i) => ({ titulo: d.titulo, texto: d.texto, dia: i })) });
            setNaAgenda(true);
          }}
        >
          {naAgenda ? <Check aria-hidden /> : <CalendarPlus aria-hidden />} {naAgenda ? "Está na sua Agenda" : `Colocar os ${todosDias.length} dias na Agenda`}
        </button>
      ) : null}
    </section>
  );
}

// ── Cartões de número ───────────────────────────────────────────────────────
function lerNumeros(data: Record<string, unknown>) {
  const itens = lista(data.itens)
    .map((raw) => ({ rotulo: str(raw.rotulo, 80), valor: str(raw.valor, 24), legenda: str(raw.legenda, 120) }))
    .filter((i) => i.rotulo && i.valor)
    .slice(0, 4);
  return itens.length ? { titulo: str(data.titulo, 120), fonte: str(data.fonte, 80), itens } : null;
}

function Numeros({ titulo, fonte, itens }: NonNullable<ReturnType<typeof lerNumeros>>) {
  return (
    <section className="mbk-numeros" aria-label={titulo || "Números"} style={{ ["--cols" as string]: String(itens.length) }}>
      {titulo ? <strong className="mbk-numeros__titulo">{titulo}</strong> : null}
      <div className="mbk-numeros__grade">
        {itens.map((item, i) => (
          <div key={i} className="mbk-numeros__item">
            <span className="mbk-numeros__rotulo">{item.rotulo}</span>
            <span className="mbk-numeros__valor">{item.valor}</span>
            {item.legenda ? <span className="mbk-numeros__legenda">{item.legenda}</span> : null}
          </div>
        ))}
      </div>
      {fonte ? <small className="mbk-numeros__fonte">Fonte: {fonte}</small> : null}
    </section>
  );
}

// ── Colunas lado a lado ─────────────────────────────────────────────────────
function lerColunas(data: Record<string, unknown>) {
  const colunas = lista(data.colunas)
    .map((raw) => ({ titulo: str(raw.titulo, 80), texto: str(raw.texto, 1500), destaque: str(raw.destaque, 80) }))
    .filter((c) => c.titulo || c.texto)
    .slice(0, 3);
  return colunas.length >= 2 ? { colunas } : null;
}

function Colunas({ colunas }: NonNullable<ReturnType<typeof lerColunas>>) {
  return (
    <section className="mbk-colunas" style={{ ["--cols" as string]: String(colunas.length) }}>
      {colunas.map((c, i) => (
        <div key={i} className="mbk-colunas__item">
          {c.titulo ? (
            <strong className="mbk-colunas__titulo">
              <MineInline text={c.titulo} />
            </strong>
          ) : null}
          {c.texto ? <MineRichText text={c.texto} /> : null}
          {c.destaque ? (
            <span className="mbk-colunas__destaque">
              <MineInline text={c.destaque} />
            </span>
          ) : null}
        </div>
      ))}
    </section>
  );
}

// ── Texto reescrito ─────────────────────────────────────────────────────────
function lerTexto(data: Record<string, unknown>) {
  const texto = str(data.texto, 6000);
  return texto ? { titulo: str(data.titulo, 80) || "Texto", texto } : null;
}

function Texto({ titulo, texto }: NonNullable<ReturnType<typeof lerTexto>>) {
  const [copiado, setCopiado] = useState(false);
  const [grande, setGrande] = useState(false);
  const copiar = () => {
    const pronto = () => {
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1600);
    };
    navigator.clipboard?.writeText(texto).then(pronto, pronto);
  };
  useEffect(() => {
    if (!grande) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGrande(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [grande]);
  const corpo = (
    <>
      <header className="mbk-texto__topo">
        <span>{titulo}</span>
        <span className="mbk-texto__botoes">
          <button type="button" className="mbk-icon" onClick={copiar} aria-label="Copiar o texto" title={copiado ? "Copiado" : "Copiar"}>
            {copiado ? <Check aria-hidden /> : <Copy aria-hidden />}
          </button>
          <button type="button" className="mbk-icon" onClick={() => setGrande((v) => !v)} aria-label={grande ? "Fechar" : "Abrir grande"} title={grande ? "Fechar" : "Abrir grande"}>
            {grande ? <X aria-hidden /> : <Maximize2 aria-hidden />}
          </button>
        </span>
      </header>
      <div className="mbk-texto__corpo">
        {texto.split(/\n{2,}/).map((p, i) => (
          <p key={i}>
            <MineInline text={p} />
          </p>
        ))}
      </div>
    </>
  );
  return (
    <>
      <section className="mbk mbk-texto">{corpo}</section>
      {grande ? (
        <div className="mbk-texto__fundo" role="dialog" aria-modal="true" aria-label={titulo} onClick={(event) => event.target === event.currentTarget && setGrande(false)}>
          <section className="mbk mbk-texto is-grande">{corpo}</section>
        </div>
      ) : null}
    </>
  );
}

// ── Avaliação ───────────────────────────────────────────────────────────────
const SITUACOES: Record<string, { rotulo: string; tom: string }> = {
  otimo: { rotulo: "Ótimo", tom: "bom" },
  bom: { rotulo: "Bom", tom: "bom" },
  regular: { rotulo: "Regular", tom: "medio" },
  "precisa-melhorar": { rotulo: "Precisa melhorar", tom: "fraco" },
  fraco: { rotulo: "Precisa melhorar", tom: "fraco" },
};

function lerAvaliacao(data: Record<string, unknown>) {
  const criterios = lista(data.criterios)
    .map((raw) => ({ nome: str(raw.nome, 60), valor: str(raw.valor, 60), comentario: str(raw.comentario, 240) }))
    .filter((c) => c.nome && c.valor)
    .slice(0, 8);
  if (!criterios.length) return null;
  const chave = str(data.situacao, 30).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");
  return { titulo: str(data.titulo, 100) || "Avaliação", situacao: SITUACOES[chave] || null, nota: str(data.nota, 20), resumo: str(data.resumo, 400), criterios };
}

function Avaliacao({ titulo, situacao, nota, resumo, criterios }: NonNullable<ReturnType<typeof lerAvaliacao>>) {
  return (
    <section className="mbk mbk-aval" aria-label={titulo}>
      <header className="mbk-head">
        <strong>{titulo}</strong>
        <span className="mbk-aval__topo">
          {nota ? <span className="mbk-aval__nota">{nota}</span> : null}
          {situacao ? <span className={`mbk-aval__selo is-${situacao.tom}`}>{situacao.rotulo}</span> : null}
        </span>
      </header>
      <dl className="mbk-aval__grade">
        {criterios.map((c, i) => (
          <div key={i}>
            <dt>{c.nome}</dt>
            <dd>{c.valor}</dd>
            {c.comentario ? (
              <dd className="mbk-muted">
                <MineInline text={c.comentario} />
              </dd>
            ) : null}
          </div>
        ))}
      </dl>
      {resumo ? (
        <p className="mbk-muted mbk-aval__resumo">
          <MineInline text={resumo} />
        </p>
      ) : null}
    </section>
  );
}

// ── Calculadora sob medida ──────────────────────────────────────────────────
type Campo = { nome: string; rotulo: string; valor: number };
type Resultado = { rotulo: string; expressao: string; fn: (vars: Record<string, number>) => number };

function lerCalculadora(data: Record<string, unknown>) {
  const campos: Campo[] = lista(data.campos)
    .map((raw) => ({ nome: str(raw.nome, 12).replace(/[^A-Za-z_]/g, ""), rotulo: str(raw.rotulo, 40), valor: num(raw.valor, 0) }))
    .filter((c) => c.nome)
    .slice(0, 6);
  const resultados: Resultado[] = [];
  for (const raw of lista(data.resultados).slice(0, 4)) {
    const expressao = str(raw.expressao, 200);
    const rotulo = str(raw.rotulo, 40);
    if (!expressao || !rotulo) continue;
    try {
      const fn = compile(expressao) as (vars: Record<string, number>) => number;
      resultados.push({ rotulo, expressao, fn });
    } catch {
      /* expressão que a calculadora não entende fica de fora */
    }
  }
  if (!campos.length || !resultados.length) return null;
  return { titulo: str(data.titulo, 100) || "Calculadora", campos, resultados };
}

function Calculadora({ titulo, campos, resultados }: NonNullable<ReturnType<typeof lerCalculadora>>) {
  const inicial = useMemo(() => Object.fromEntries(campos.map((c) => [c.nome, String(c.valor)])), [campos]);
  const [valores, setValores] = useState<Record<string, string>>(inicial);
  const vars = Object.fromEntries(campos.map((c) => [c.nome, Number(String(valores[c.nome] ?? "").replace(",", "."))]));
  const valido = Object.values(vars).every((v) => Number.isFinite(v));
  return (
    <section className="mbk mbk-calc" aria-label={titulo}>
      <header className="mbk-head">
        <strong>{titulo}</strong>
        <button type="button" className="mbk-link" onClick={() => setValores(inicial)}>
          <RotateCcw aria-hidden /> Restaurar exemplo
        </button>
      </header>
      <div className="mbk-calc__campos" style={{ ["--cols" as string]: String(Math.min(3, campos.length)) }}>
        {campos.map((c) => (
          <label key={c.nome}>
            <span>{c.rotulo || c.nome}</span>
            <input inputMode="decimal" value={valores[c.nome] ?? ""} onChange={(event) => setValores((atual) => ({ ...atual, [c.nome]: event.target.value }))} />
          </label>
        ))}
      </div>
      <div className="mbk-calc__resultados">
        {resultados.map((r, i) => {
          let texto = "—";
          if (valido) {
            try {
              const v = r.fn(vars);
              texto = Number.isFinite(v) ? String(tidyNumber(v)) : "não existe";
            } catch {
              texto = "não existe";
            }
          }
          return (
            <div key={i}>
              <span className="mbk-numeros__rotulo">{r.rotulo}</span>
              <span className="mbk-calc__valor">{texto}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Lista com fotos ─────────────────────────────────────────────────────────
function lerListaImagens(data: Record<string, unknown>) {
  const itens = lista(data.itens)
    .map((raw) => ({ titulo: str(raw.titulo, 100), texto: str(raw.texto, 300), imagem: str(raw.imagem, 80) }))
    .filter((i) => i.titulo)
    .slice(0, 6);
  return itens.length >= 2 ? { itens, galeria: data.formato === "galeria" } : null;
}

function FotoDoItem({ busca, alt }: { busca: string; alt: string }) {
  const [foto, setFoto] = useState<GalleryImage | null | undefined>(undefined);
  useEffect(() => {
    let ativo = true;
    if (!busca) {
      setFoto(null);
      return undefined;
    }
    firstGalleryImage(busca)
      .then((img) => ativo && setFoto(img))
      .catch(() => ativo && setFoto(null));
    return () => {
      ativo = false;
    };
  }, [busca]);
  if (foto === undefined) return <span className="mbk-lista__foto is-carregando" aria-hidden />;
  if (!foto) return <span className="mbk-lista__foto is-vazia" aria-hidden />;
  return (
    <a className="mbk-lista__foto" href={foto.pageUrl || foto.full} target="_blank" rel="noreferrer noopener" title={foto.source ? `Foto: ${foto.source}` : undefined}>
      <img src={foto.url} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFoto(null)} />
    </a>
  );
}

function ListaImagens({ itens, galeria }: NonNullable<ReturnType<typeof lerListaImagens>>) {
  if (galeria) {
    return (
      <section className="mbk-galeria" style={{ ["--cols" as string]: String(Math.min(3, itens.length)) }}>
        {itens.slice(0, 3).map((item, i) => (
          <figure key={i}>
            <FotoDoItem busca={item.imagem || item.titulo} alt={item.titulo} />
            <figcaption>
              <MineInline text={item.titulo} />
            </figcaption>
          </figure>
        ))}
      </section>
    );
  }
  return (
    <ul className="mbk-lista">
      {itens.map((item, i) => (
        <li key={i}>
          <FotoDoItem busca={item.imagem || item.titulo} alt={item.titulo} />
          <span>
            <strong>
              <MineInline text={item.titulo} />
            </strong>
            {item.texto ? (
              <span className="mbk-lista__texto">
                <MineInline text={item.texto} />
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Desenha o bloco de estudo; JSON inválido mostra o fallback (código comum). */
export function BlocoEstudo({ lang, code, fallback }: { lang: string; code: string; fallback: ReactNode }) {
  const kind = lang === "números" ? "numeros" : lang === "avaliação" ? "avaliacao" : lang;
  const parsed = useMemo(() => {
    const data = readJson(code);
    if (!data) return null;
    if (kind === "flashcards") return lerFlashcards(data);
    if (kind === "plano") return lerPlano(data, code);
    if (kind === "numeros") return lerNumeros(data);
    if (kind === "colunas") return lerColunas(data);
    if (kind === "texto") return lerTexto(data);
    if (kind === "avaliacao") return lerAvaliacao(data);
    if (kind === "calculadora") return lerCalculadora(data);
    if (kind === "lista-imagens") return lerListaImagens(data);
    return null;
  }, [code, kind]);
  if (!parsed) return <>{fallback}</>;
  if (kind === "flashcards") return <Flashcards {...(parsed as NonNullable<ReturnType<typeof lerFlashcards>>)} />;
  if (kind === "plano") return <Plano {...(parsed as NonNullable<ReturnType<typeof lerPlano>>)} />;
  if (kind === "numeros") return <Numeros {...(parsed as NonNullable<ReturnType<typeof lerNumeros>>)} />;
  if (kind === "colunas") return <Colunas {...(parsed as NonNullable<ReturnType<typeof lerColunas>>)} />;
  if (kind === "texto") return <Texto {...(parsed as NonNullable<ReturnType<typeof lerTexto>>)} />;
  if (kind === "avaliacao") return <Avaliacao {...(parsed as NonNullable<ReturnType<typeof lerAvaliacao>>)} />;
  if (kind === "calculadora") return <Calculadora {...(parsed as NonNullable<ReturnType<typeof lerCalculadora>>)} />;
  return <ListaImagens {...(parsed as NonNullable<ReturnType<typeof lerListaImagens>>)} />;
}

