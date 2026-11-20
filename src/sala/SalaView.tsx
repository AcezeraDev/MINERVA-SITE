// Carregado sob demanda (React.lazy): a Sala de estudo em grupo. Parece um
// canal do Discord: chat em grupo com a Mine dentro (ela responde quando
// alguém escreve "@mine" ou aperta o botão), fotos e chamada de voz direta
// entre os alunos. Regras em shared/sala.mjs; servidor em data-server.mjs.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Copy,
  DoorOpen,
  Headphones,
  ImagePlus,
  Link2,
  Loader2,
  LogOut,
  Mic,
  MicOff,
  NotebookPen,
  PhoneOff,
  Send,
  Users,
  Volume2,
  WifiOff,
  X,
} from "lucide-react";
import { PageHeader, go, readSession, type User } from "../main";
import { useSoftMotion } from "../motion";
import { MineRichText } from "../chat/MineRichText";
import { SALA_MAX_CHAMADA, SALA_TEXTO_MAX, codigoSalaValido, type MensagemSala, type VistaSala } from "../../shared/sala.mjs";
import { ChamadaVoz, type EstadoPar } from "./voz";
import "./sala.css";

const mola = { type: "spring" as const, stiffness: 300, damping: 30, mass: 1 };
const chaveRecentes = "minerva-salas-recentes-v1";

class ErroSala extends Error {
  status: number;
  constructor(mensagem: string, status: number) {
    super(mensagem);
    this.status = status;
  }
}

async function chamar<T>(corpo: Record<string, unknown>): Promise<T> {
  const resposta = await fetch("/api/sala", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${readSession().token || ""}` },
    body: JSON.stringify(corpo),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new ErroSala(dados.error || "A sala não respondeu agora.", resposta.status);
  return dados as T;
}

type Recente = { codigo: string; nome: string; em: number };
function lerRecentes(): Recente[] {
  try {
    const lista = JSON.parse(localStorage.getItem(chaveRecentes) || "[]");
    return Array.isArray(lista) ? lista.filter((r) => codigoSalaValido(r?.codigo)).slice(0, 6) : [];
  } catch {
    return [];
  }
}
function lembrarSala(codigo: string, nome: string) {
  try {
    const lista = [{ codigo, nome, em: Date.now() }, ...lerRecentes().filter((r) => r.codigo !== codigo)].slice(0, 6);
    localStorage.setItem(chaveRecentes, JSON.stringify(lista));
  } catch {
    /* sem armazenamento: só não lembra */
  }
}

/** Foto reduzida no navegador (lado maior até 1280 px, JPEG) para caber no envio. */
async function reduzirFoto(arquivo: File): Promise<string> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error("Não deu para abrir essa imagem."));
      i.src = url;
    });
    const escala = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const qualidade of [0.82, 0.7, 0.55, 0.4]) {
      const dados = canvas.toDataURL("image/jpeg", qualidade);
      if (dados.length < 1_300_000) return dados;
    }
    throw new Error("A foto ficou grande demais mesmo reduzida.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

const corDoNome = (nome: string) => {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 62% 58%)`;
};

function Avatar({ nome, avatar, mine = false, falando = false, tamanho = 36 }: { nome: string; avatar?: string; mine?: boolean; falando?: boolean; tamanho?: number }) {
  return (
    <span className={`sala-avatar ${falando ? "is-falando" : ""} ${mine ? "is-mine" : ""}`} style={{ width: tamanho, height: tamanho, background: mine ? undefined : corDoNome(nome) }} aria-hidden>
      {mine ? <Bot className="h-1/2 w-1/2" /> : avatar ? <img src={avatar} alt="" /> : nome.slice(0, 1).toUpperCase()}
    </span>
  );
}

/* ---------------------------------------------------------------------- */

export function SalaView({ user, codigoRota }: { user: User; codigoRota?: string }) {
  const codigo = codigoRota && codigoSalaValido(codigoRota.toUpperCase()) ? codigoRota.toUpperCase() : "";
  return codigo ? <SalaAberta key={codigo} user={user} codigo={codigo} /> : <Saguao />;
}

/* ---------- saguão: criar ou entrar ---------- */

function Saguao() {
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const recentes = useMemo(lerRecentes, []);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    setErro("");
    try {
      const { sala } = await chamar<{ sala: VistaSala }>({ acao: "criar", nome: nome || "Sala de estudo" });
      lembrarSala(sala.codigo, sala.nome);
      go("sala", sala.codigo);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não deu para abrir a sala.");
    } finally {
      setOcupado(false);
    }
  };

  const entrar = (e: React.FormEvent) => {
    e.preventDefault();
    const limpo = codigo.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (!codigoSalaValido(limpo)) {
      setErro("O código tem 6 letras e números, como K7MPQ2.");
      return;
    }
    go("sala", limpo);
  };

  return (
    <div className="sala-page">
      <PageHeader
        eyebrow="Estudar junto"
        title="Sala de estudo"
        subtitle="Chame os amigos para estudar junto: chat em grupo com a Mine, fotos dos exercícios e chamada de voz, como num servidor do Discord."
      />
      <div className="sala-saguao">
        <form className="sala-card" onSubmit={criar}>
          <h2 className="sala-card-titulo"><Users className="h-5 w-5" aria-hidden /> Abrir uma sala</h2>
          <label className="sala-rotulo" htmlFor="sala-nome">Nome da sala</label>
          <input id="sala-nome" className="sala-campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Prova de química sexta" maxLength={60} />
          <button type="submit" className="sala-btn is-primario" disabled={ocupado}>
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <DoorOpen className="h-4 w-4" aria-hidden />} Abrir sala
          </button>
          <p className="sala-nota">Você recebe um código e um link para mandar aos amigos.</p>
        </form>

        <form className="sala-card" onSubmit={entrar}>
          <h2 className="sala-card-titulo"><Link2 className="h-5 w-5" aria-hidden /> Entrar com código</h2>
          <label className="sala-rotulo" htmlFor="sala-codigo">Código da sala</label>
          <input
            id="sala-codigo"
            className="sala-campo sala-campo-codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="K7MPQ2"
            maxLength={8}
            autoComplete="off"
          />
          <button type="submit" className="sala-btn">Entrar</button>
          {recentes.length ? (
            <div className="sala-recentes">
              <p className="sala-rotulo">Salas recentes</p>
              {recentes.map((r) => (
                <button key={r.codigo} type="button" className="sala-recente" onClick={() => go("sala", r.codigo)}>
                  <span className="truncate">{r.nome}</span>
                  <code>{r.codigo}</code>
                </button>
              ))}
            </div>
          ) : null}
        </form>
      </div>
      {erro ? <p className="sala-erro" role="alert">{erro}</p> : null}

      <ul className="sala-como">
        <li><Bot className="h-5 w-5" aria-hidden /><span><strong>A Mine está na sala.</strong> Escreva <code>@mine</code> na mensagem (ou aperte o botão da Mine) e ela responde para todo mundo, lendo a conversa e a última foto.</span></li>
        <li><Headphones className="h-5 w-5" aria-hidden /><span><strong>Chamada de voz</strong> com até {SALA_MAX_CHAMADA} pessoas. A voz vai direto de um computador para o outro.</span></li>
        <li><ImagePlus className="h-5 w-5" aria-hidden /><span><strong>Fotos</strong> do caderno ou do livro: mande, cole com Ctrl+V ou arraste para o chat.</span></li>
        <li><NotebookPen className="h-5 w-5" aria-hidden /><span><strong>Resumo da sessão:</strong> no fim, a Mine resume o que o grupo estudou e deixa perguntas para revisar.</span></li>
      </ul>
    </div>
  );
}

/* ---------- a sala ---------- */

type Sync = { sala: VistaSala; mensagens: MensagemSala[]; sinais: Array<{ de: string; dados: unknown }>; aviso?: string };

function SalaAberta({ user, codigo }: { user: User; codigo: string }) {
  const reduzido = useSoftMotion();
  const [sala, setSala] = useState<VistaSala | null>(null);
  const [mensagens, setMensagens] = useState<MensagemSala[]>([]);
  const [erro, setErro] = useState("");
  const [fatal, setFatal] = useState("");
  const [texto, setTexto] = useState("");
  const [foto, setFoto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [naChamada, setNaChamada] = useState(false);
  const [mudo, setMudo] = useState(false);
  const [falando, setFalando] = useState<Set<string>>(new Set());
  const [conexoes, setConexoes] = useState<Record<string, EstadoPar>>({});
  const [copiado, setCopiado] = useState(false);
  const [ampliada, setAmpliada] = useState("");
  const [membrosAbertos, setMembrosAbertos] = useState(false);

  const vivo = useRef({ desde: 0, naChamada: false, mudo: false, digitando: false, parado: false });
  const vozRef = useRef<ChamadaVoz | null>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const noFimRef = useRef(true);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);

  // voz: criada uma vez por sala; os recados vão pelo servidor
  useEffect(() => {
    const voz = new ChamadaVoz(user.id, {
      enviarSinal: (para, dados) => void chamar({ acao: "sinal", codigo, para, dados }).catch(() => {}),
      aoMudar: (f, c) => {
        setFalando(f);
        setConexoes(c);
      },
    });
    vozRef.current = voz;
    return () => {
      voz.sair();
      vozRef.current = null;
    };
  }, [codigo, user.id]);

  // entrar e consultar a cada segundo (4 s com a aba escondida)
  useEffect(() => {
    let vivoAqui = true;
    let relogio = 0;
    const v = vivo.current;
    v.desde = 0;
    v.parado = false;

    const consultar = async () => {
      if (!vivoAqui || v.parado) return;
      try {
        const r = await chamar<Sync>({ acao: "sync", codigo, desde: v.desde, naChamada: v.naChamada, mudo: v.mudo, digitando: v.digitando });
        if (!vivoAqui) return;
        v.digitando = false;
        setSala(r.sala);
        setErro("");
        if (r.aviso) {
          setErro(r.aviso);
          if (v.naChamada) sairDaChamada();
        }
        if (r.mensagens.length) {
          v.desde = r.mensagens[r.mensagens.length - 1].id;
          setMensagens((atual) => {
            const ids = new Set(atual.map((m) => m.id));
            return [...atual, ...r.mensagens.filter((m) => !ids.has(m.id))].slice(-300);
          });
        }
        const voz = vozRef.current;
        if (voz?.ativa) {
          for (const s of r.sinais) await voz.receberSinal(s.de, s.dados);
          voz.sincronizar(r.sala.membros.filter((m) => m.naChamada).map((m) => m.id));
        }
      } catch (error) {
        if (!vivoAqui) return;
        const status = error instanceof ErroSala ? error.status : 0;
        if (status === 404 || status === 403) {
          v.parado = true;
          setFatal(error instanceof Error ? error.message : "Essa sala não existe mais.");
          return;
        }
        setErro("Sem conexão com a sala. Tentando de novo…");
      }
      relogio = window.setTimeout(consultar, document.hidden ? 4000 : 1000);
    };

    (async () => {
      try {
        const { sala: entrou } = await chamar<{ sala: VistaSala }>({ acao: "entrar", codigo });
        if (!vivoAqui) return;
        setSala(entrou);
        lembrarSala(entrou.codigo, entrou.nome);
        void consultar();
      } catch (error) {
        if (vivoAqui) setFatal(error instanceof Error ? error.message : "Não deu para entrar na sala.");
      }
    })();
    const acordar = () => {
      if (!document.hidden) {
        window.clearTimeout(relogio);
        void consultar();
      }
    };
    document.addEventListener("visibilitychange", acordar);
    return () => {
      vivoAqui = false;
      window.clearTimeout(relogio);
      document.removeEventListener("visibilitychange", acordar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo]);

  // rolar para o fim quando chega mensagem (se a pessoa já estava no fim)
  useEffect(() => {
    const lista = listaRef.current;
    if (lista && noFimRef.current) lista.scrollTo({ top: lista.scrollHeight, behavior: reduzido ? "auto" : "smooth" });
  }, [mensagens, sala?.mineDigitando, reduzido]);

  /* ---------- chamada ---------- */

  const entrarNaChamada = async () => {
    const voz = vozRef.current;
    if (!voz) return;
    try {
      await voz.entrar();
      vivo.current.naChamada = true;
      setNaChamada(true);
      setErro("");
    } catch {
      setErro("Não deu para usar o microfone. Libere o microfone para este site no cadeado da barra de endereço.");
    }
  };

  function sairDaChamada() {
    vozRef.current?.sair();
    vivo.current.naChamada = false;
    setNaChamada(false);
  }

  const alternarMudo = () => {
    const novo = !mudo;
    setMudo(novo);
    vivo.current.mudo = novo;
    vozRef.current?.setMudo(novo);
  };

  /* ---------- mensagens ---------- */

  const enviar = async (comMine = false) => {
    const limpo = texto.trim();
    if ((!limpo && !foto) || enviando) return;
    setEnviando(true);
    const fotoAgora = foto;
    setTexto("");
    setFoto("");
    try {
      await chamar({ acao: "enviar", codigo, texto: comMine && !/@mine\b/i.test(limpo) ? `@mine ${limpo}`.trim() : limpo, foto: fotoAgora || undefined, mine: comMine });
    } catch (error) {
      setTexto(limpo);
      setFoto(fotoAgora);
      setErro(error instanceof Error ? error.message : "A mensagem não foi.");
    } finally {
      setEnviando(false);
      campoRef.current?.focus();
    }
  };

  const resumo = async () => {
    try {
      await chamar({ acao: "resumo", codigo });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "A Mine não conseguiu resumir agora.");
    }
  };

  const anexar = async (arquivo?: File | null) => {
    if (!arquivo || !arquivo.type.startsWith("image/")) return;
    try {
      setFoto(await reduzirFoto(arquivo));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não deu para usar essa foto.");
    }
  };

  const copiarLink = async () => {
    const link = `${location.origin}/#/sala/${codigo}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      window.prompt("Copie o link da sala:", link);
    }
  };

  const sairDaSala = async () => {
    if (!window.confirm("Sair desta sala? Você pode voltar depois pelo código.")) return;
    sairDaChamada();
    vivo.current.parado = true;
    await chamar({ acao: "sair", codigo }).catch(() => {});
    go("sala");
  };

  const naChamadaLista = sala?.membros.filter((m) => m.naChamada) ?? [];
  const digitando = sala?.membros.filter((m) => m.digitando).map((m) => m.nome) ?? [];

  if (fatal) {
    return (
      <div className="sala-page">
        <div className="sala-card sala-fatal">
          <p>{fatal}</p>
          <button type="button" className="sala-btn is-primario" onClick={() => go("sala")}>Voltar ao saguão</button>
        </div>
      </div>
    );
  }

  return (
    <div className="sala-page is-aberta">
      <header className="sala-topo">
        <div className="min-w-0">
          <p className="caderno-note">sala de estudo</p>
          <h1 className="sala-titulo font-display">{sala?.nome ?? "Entrando…"}</h1>
        </div>
        <div className="sala-topo-acoes">
          <button type="button" className="sala-codigo" onClick={copiarLink} title="Copiar link de convite">
            <code>{codigo}</code>
            {copiado ? "link copiado!" : <><Copy className="h-4 w-4" aria-hidden /> convidar</>}
          </button>
          <button type="button" className="sala-btn is-icone" onClick={() => setMembrosAbertos((a) => !a)} aria-label="Ver quem está na sala" aria-expanded={membrosAbertos}>
            <Users className="h-4 w-4" aria-hidden /> <span className="text-xs">{sala?.membros.filter((m) => m.online).length ?? 0}</span>
          </button>
          <button type="button" className="sala-btn is-icone" onClick={sairDaSala} aria-label="Sair da sala" title="Sair da sala">
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>

      <div className="sala-grade">
        {/* lateral: voz e membros, como no Discord */}
        <aside className={`sala-lado ${membrosAbertos ? "is-aberta" : ""}`}>
          <section className="sala-voz">
            <p className="sala-rotulo"><Volume2 className="h-4 w-4" aria-hidden /> Chamada de voz · {naChamadaLista.length}/{SALA_MAX_CHAMADA}</p>
            <ul className="sala-membros">
              {naChamadaLista.map((m) => (
                <li key={m.id} className="sala-membro">
                  <Avatar nome={m.nome} avatar={m.avatar} falando={falando.has(m.id)} tamanho={30} />
                  <span className="truncate">{m.nome}{m.eu ? " (você)" : ""}</span>
                  {m.mudo ? <MicOff className="ml-auto h-3.5 w-3.5 opacity-60" aria-label="microfone desligado" /> : null}
                  {!m.eu && naChamada && conexoes[m.id] === "falhou" ? <WifiOff className="ml-auto h-3.5 w-3.5 text-red-400" aria-label="sem conexão de voz com essa pessoa" /> : null}
                  {!m.eu && naChamada && conexoes[m.id] === "conectando" ? <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin opacity-60" aria-label="conectando a voz" /> : null}
                </li>
              ))}
              {!naChamadaLista.length ? <li className="sala-vazio">Ninguém na chamada ainda.</li> : null}
            </ul>
            {naChamada ? (
              <div className="sala-voz-botoes">
                <button type="button" className={`sala-btn ${mudo ? "is-perigo" : ""}`} onClick={alternarMudo} aria-pressed={mudo}>
                  {mudo ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />} {mudo ? "Ligar mic" : "Mudo"}
                </button>
                <button type="button" className="sala-btn is-perigo" onClick={sairDaChamada}>
                  <PhoneOff className="h-4 w-4" aria-hidden /> Sair
                </button>
              </div>
            ) : (
              <button type="button" className="sala-btn is-voz" onClick={entrarNaChamada} disabled={naChamadaLista.length >= SALA_MAX_CHAMADA}>
                <Headphones className="h-4 w-4" aria-hidden /> Entrar na chamada
              </button>
            )}
          </section>

          <section>
            <p className="sala-rotulo"><Users className="h-4 w-4" aria-hidden /> Na sala</p>
            <ul className="sala-membros">
              <li className="sala-membro">
                <Avatar nome="Mine" mine tamanho={30} />
                <span>Mine</span>
                <span className="sala-selo">tutora</span>
              </li>
              {sala?.membros.map((m) => (
                <li key={m.id} className={`sala-membro ${m.online ? "" : "is-off"}`}>
                  <Avatar nome={m.nome} avatar={m.avatar} tamanho={30} />
                  <span className="truncate">{m.nome}{m.eu ? " (você)" : ""}</span>
                  <span className={`sala-ponto ${m.online ? "is-on" : ""}`} aria-label={m.online ? "online" : "offline"} />
                </li>
              ))}
            </ul>
          </section>
        </aside>

        {/* chat */}
        <section
          className="sala-chat"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void anexar(e.dataTransfer.files?.[0]);
          }}
        >
          <div
            ref={listaRef}
            className="sala-lista"
            onScroll={(e) => {
              const el = e.currentTarget;
              noFimRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
            aria-live="polite"
          >
            {mensagens.map((m, i) => (
              <Mensagem key={m.id} m={m} anterior={mensagens[i - 1]} codigo={codigo} meuId={user.id} onAmpliar={setAmpliada} reduzido={reduzido} />
            ))}
            {sala?.mineDigitando ? (
              <div className="sala-msg is-mine">
                <Avatar nome="Mine" mine />
                <div className="sala-msg-corpo">
                  <p className="sala-msg-autor">Mine</p>
                  <p className="sala-pensando" aria-label="A Mine está escrevendo"><span /><span /><span /></p>
                </div>
              </div>
            ) : null}
          </div>

          <p className="sala-digitando" aria-live="polite">
            {digitando.length ? `${digitando.slice(0, 2).join(" e ")} ${digitando.length > 1 ? "estão" : "está"} digitando…` : erro}
          </p>

          <form
            className="sala-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar(false);
            }}
          >
            {foto ? (
              <div className="sala-anexo">
                <img src={foto} alt="Foto anexada" />
                <button type="button" onClick={() => setFoto("")} aria-label="Tirar a foto"><X className="h-4 w-4" /></button>
              </div>
            ) : null}
            <div className="sala-composer-linha">
              <button type="button" className="sala-btn is-icone" onClick={() => arquivoRef.current?.click()} aria-label="Mandar foto" title="Mandar foto">
                <ImagePlus className="h-5 w-5" aria-hidden />
              </button>
              <input ref={arquivoRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void anexar(e.target.files?.[0])} />
              <textarea
                ref={campoRef}
                className="sala-campo sala-texto"
                value={texto}
                rows={1}
                maxLength={SALA_TEXTO_MAX}
                placeholder="Mensagem para a sala… escreva @mine para chamar a Mine"
                onChange={(e) => {
                  setTexto(e.target.value);
                  vivo.current.digitando = true;
                }}
                onPaste={(e) => {
                  const img = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
                  if (img) {
                    e.preventDefault();
                    void anexar(img);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void enviar(false);
                  }
                }}
                aria-label="Mensagem"
              />
              <button type="button" className="sala-btn is-mine" onClick={() => void enviar(true)} disabled={enviando || (!texto.trim() && !foto)} title="Mandar e pedir para a Mine responder">
                <Bot className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Mine</span>
              </button>
              <button type="submit" className="sala-btn is-primario is-icone" disabled={enviando || (!texto.trim() && !foto)} aria-label="Enviar">
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              </button>
            </div>
            <div className="sala-composer-extra">
              <button type="button" className="sala-link" onClick={resumo} disabled={Boolean(sala?.mineDigitando)}>
                <NotebookPen className="h-3.5 w-3.5" aria-hidden /> Pedir resumo da sessão à Mine
              </button>
            </div>
          </form>
        </section>
      </div>

      <AnimatePresence>
        {ampliada ? (
          <motion.div className="sala-zoom" role="dialog" aria-label="Foto ampliada" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAmpliada("")}>
            <motion.img src={ampliada} alt="" initial={reduzido ? false : { scale: 0.92 }} animate={{ scale: 1 }} transition={mola} />
            <button type="button" className="sala-zoom-fechar" aria-label="Fechar"><X className="h-5 w-5" /></button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ---------- uma mensagem ---------- */

const fotosCache = new Map<string, Promise<string>>();
function carregarFoto(codigo: string, id: number) {
  const chave = `${codigo}:${id}`;
  if (!fotosCache.has(chave)) {
    fotosCache.set(
      chave,
      chamar<{ foto: string }>({ acao: "foto", codigo, id }).then((r) => r.foto).catch((e) => {
        fotosCache.delete(chave);
        throw e;
      }),
    );
  }
  return fotosCache.get(chave)!;
}

function FotoMensagem({ codigo, id, onAmpliar }: { codigo: string; id: number; onAmpliar: (src: string) => void }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let ok = true;
    carregarFoto(codigo, id).then((f) => ok && setSrc(f)).catch(() => {});
    return () => {
      ok = false;
    };
  }, [codigo, id]);
  return src ? (
    <button type="button" className="sala-foto" onClick={() => onAmpliar(src)} aria-label="Ampliar foto">
      <img src={src} alt="Foto enviada na sala" loading="lazy" />
    </button>
  ) : (
    <span className="sala-foto is-carregando"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /></span>
  );
}

const hora = (em: number) => new Date(em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const Mensagem = React.memo(function Mensagem({
  m,
  anterior,
  codigo,
  meuId,
  onAmpliar,
  reduzido,
}: {
  m: MensagemSala;
  anterior?: MensagemSala;
  codigo: string;
  meuId: string;
  onAmpliar: (src: string) => void;
  reduzido: boolean;
}) {
  if (m.tipo === "sistema") return <p className="sala-sistema">{m.texto} · {hora(m.em)}</p>;
  // mensagens seguidas da mesma pessoa em até 4 minutos ficam juntas
  const junto = anterior && anterior.tipo !== "sistema" && anterior.autorId === m.autorId && m.em - anterior.em < 4 * 60_000;
  const daMine = m.tipo === "mine";
  return (
    <motion.div
      className={`sala-msg ${daMine ? "is-mine" : ""} ${m.autorId === meuId ? "is-minha" : ""} ${junto ? "is-junto" : ""}`}
      initial={reduzido ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={mola}
    >
      {junto ? <span className="sala-msg-espaco" /> : <Avatar nome={m.autor} mine={daMine} />}
      <div className="sala-msg-corpo">
        {junto ? null : (
          <p className="sala-msg-autor">
            {daMine ? "Mine" : m.autor} <span>{hora(m.em)}</span>
          </p>
        )}
        {m.temFoto ? <FotoMensagem codigo={codigo} id={m.id} onAmpliar={onAmpliar} /> : null}
        {m.texto ? (
          daMine ? (
            <div className="sala-msg-mine-texto"><MineRichText text={m.texto} /></div>
          ) : (
            <p className="sala-msg-texto">{m.texto}</p>
          )
        ) : null}
      </div>
    </motion.div>
  );
});
