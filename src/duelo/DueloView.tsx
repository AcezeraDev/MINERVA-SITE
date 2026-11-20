// Carregado sob demanda (React.lazy): a aba Duelo, quiz 1x1 valendo XP contra
// um colega (pelo código da sala) ou contra a Mine. As regras ficam em
// shared/duelo.mjs e rodam no servidor; esta tela só pergunta o estado a cada
// segundo e desenha.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Check, CheckCircle2, Copy, DoorOpen, Loader2, LogOut, RefreshCw, Swords, Timer, Trophy, Users, XCircle } from "lucide-react";
import { PageHeader, readSession, uid, type Session, type User, type useMemoUserData, type AppData } from "../main";
import { useSoftMotion } from "../motion";
import { celebrateFrom, floatXp, mineSays } from "../caderno";
import { dueloXp, duelosPorDia } from "../../shared/xp.mjs";
import type { VistaDuelo } from "../../shared/duelo.mjs";
import { usePreset } from "../chat/presets";
import "./duelo.css";

type Sala = { codigo: string; tema: string; dono: string; criadoEm: number; minha: boolean };

const sugestoes = ["Revolução Francesa", "Funções do 1º grau", "Citologia", "Figuras de linguagem", "Leis de Newton", "Tabela periódica", "Brasil Império", "Verbos em inglês"];
const chaveAtivo = "minerva:duelo-ativo";

async function chamar<T>(corpo: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/duelo", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${readSession().token || ""}` },
    body: JSON.stringify(corpo),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || "O duelo não respondeu agora."), { status: response.status });
  return data as T;
}

function lerLocal<T>(chave: string, padrao: T): T {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravarLocal(chave: string, valor: unknown) {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem armazenamento local o duelo só não volta sozinho depois de recarregar.
  }
}

export function DueloView({ user, update }: { data: ReturnType<typeof useMemoUserData>; user: User; update: (next: (draft: AppData) => AppData) => void }) {
  const reduced = useSoftMotion();
  const [duelo, setDuelo] = useState<VistaDuelo | null>(null);
  const [desvio, setDesvio] = useState(0);
  // "cria um duelo sobre isso" no chat chega aqui com o tema já escrito
  const preset = usePreset("duelo");
  const [tema, setTema] = useState(() => (preset?.tema || "").slice(0, 120));
  const [codigo, setCodigo] = useState("");
  const [salas, setSalas] = useState<Sala[]>([]);
  const [ocupado, setOcupado] = useState<"" | "colega" | "mine" | "entrar">("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [agora, setAgora] = useState(Date.now());
  const chaveXp = `minerva:duelos-xp:${user.id}`;

  const receber = useCallback((vista: VistaDuelo) => {
    setDesvio(vista.agora - Date.now());
    setDuelo(vista);
    gravarLocal(chaveAtivo, vista.status === "fim" ? null : vista.codigo);
  }, []);

  // Volta para o duelo em andamento depois de recarregar ou trocar de aba.
  useEffect(() => {
    const ativo = lerLocal<string | null>(chaveAtivo, null);
    if (!ativo) return;
    chamar<{ duelo: VistaDuelo }>({ acao: "estado", codigo: ativo })
      .then((r) => receber(r.duelo))
      .catch(() => gravarLocal(chaveAtivo, null));
  }, [receber]);

  // Salas abertas, enquanto ninguém está jogando.
  useEffect(() => {
    if (duelo && duelo.status !== "fim") return;
    let vivo = true;
    const buscar = () =>
      chamar<{ salas: Sala[] }>({ acao: "abertas" })
        .then((r) => vivo && setSalas(r.salas))
        .catch(() => undefined);
    buscar();
    const timer = window.setInterval(() => !document.hidden && buscar(), 6000);
    return () => {
      vivo = false;
      window.clearInterval(timer);
    };
  }, [duelo]);

  // Pergunta o estado a cada segundo durante a sala e a partida.
  const emAndamento = duelo && duelo.status !== "fim";
  const codigoAtivo = duelo?.codigo;
  useEffect(() => {
    if (!emAndamento || !codigoAtivo) return;
    let vivo = true;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      chamar<{ duelo: VistaDuelo }>({ acao: "estado", codigo: codigoAtivo })
        .then((r) => vivo && receber(r.duelo))
        .catch((error) => {
          if (vivo && (error as { status?: number }).status === 404) {
            setErro("A sala sumiu. Comece outro duelo.");
            setDuelo(null);
            gravarLocal(chaveAtivo, null);
          }
        });
    }, 1000);
    return () => {
      vivo = false;
      window.clearInterval(timer);
    };
  }, [emAndamento, codigoAtivo, receber]);

  // Quando a partida começa ou termina, a área do jogo vem para a tela: o
  // cabeçalho e o aviso empurram a pergunta para baixo da dobra.
  const fase = duelo?.status;
  useEffect(() => {
    if (fase !== "jogando" && fase !== "fim") return;
    const alvo = document.querySelector(".due-partida, .due-fim");
    alvo?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
  }, [fase, reduced]);

  // Relógio da tela para a barra de tempo andar lisa entre as consultas.
  useEffect(() => {
    if (!emAndamento) return;
    const timer = window.setInterval(() => setAgora(Date.now()), reduced ? 1000 : 200);
    return () => window.clearInterval(timer);
  }, [emAndamento, reduced]);

  // Fim de duelo com dois jogadores: XP uma vez por sala.
  const placarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!duelo || duelo.status !== "fim" || !duelo.resultado) return;
    const pagos = lerLocal<string[]>(chaveXp, []);
    if (pagos.includes(duelo.codigo)) return;
    gravarLocal(chaveXp, [duelo.codigo, ...pagos].slice(0, 60));
    const xp = dueloXp(duelo.resultado);
    const eu = duelo.jogadores.find((j) => j.eu);
    const outro = duelo.jogadores.find((j) => !j.eu);
    const session: Session = {
      id: uid("duelo"),
      userId: user.id,
      subjectId: "duelo",
      title: `Duelo: ${duelo.tema} contra ${outro?.nome || "alguém"}`.slice(0, 140),
      kind: "Duelo",
      createdAt: Date.now(),
      xpEarned: xp,
      score: eu?.pontos || 0,
      correctAnswers: eu?.respostas.filter((r) => r.certo).length || 0,
      questionsAnswered: duelo.total,
    };
    update((draft) => ({ ...draft, sessions: [...draft.sessions, session] }));
    window.setTimeout(() => {
      floatXp(`+${xp} XP`, placarRef.current);
      if (duelo.resultado === "vitoria") celebrateFrom(placarRef.current, { count: 50 });
    }, reduced ? 50 : 600);
    mineSays(duelo.resultado === "vitoria" ? "Vitória! Que duelo!" : duelo.resultado === "empate" ? "Empate! Bora desempatar?" : "Foi por pouco. Revanche?", duelo.resultado === "vitoria" ? "wow" : "happy");
  }, [duelo, chaveXp, update, user.id, reduced]);

  const criar = async (contraMine: boolean, temaEscolhido = tema) => {
    const limpo = temaEscolhido.trim();
    if (limpo.length < 3) {
      setErro("Escreva um tema para o duelo (ou toque numa sugestão).");
      return;
    }
    setErro("");
    setAviso("");
    setOcupado(contraMine ? "mine" : "colega");
    try {
      const r = await chamar<{ duelo: VistaDuelo; aviso?: string }>({ acao: "criar", tema: limpo, contraMine });
      if (r.aviso) setAviso(r.aviso);
      receber(r.duelo);
    } catch (error) {
      setErro((error as Error).message);
    } finally {
      setOcupado("");
    }
  };

  const entrar = async (alvo = codigo) => {
    setErro("");
    setAviso("");
    setOcupado("entrar");
    try {
      const r = await chamar<{ duelo: VistaDuelo }>({ acao: "entrar", codigo: alvo.trim().toUpperCase() });
      receber(r.duelo);
    } catch (error) {
      setErro((error as Error).message);
    } finally {
      setOcupado("");
    }
  };

  const responder = async (indice: number, escolha: number) => {
    if (!duelo) return;
    // Mostra a escolha na hora; o servidor confirma na resposta.
    setDuelo({
      ...duelo,
      jogadores: duelo.jogadores.map((j) => (j.eu ? { ...j, respondeu: true, respostas: [...j.respostas, { indice, escolha, ms: 0, certo: false, pontos: 0 }] } : j)),
    });
    try {
      const r = await chamar<{ duelo: VistaDuelo; aviso?: string }>({ acao: "responder", codigo: duelo.codigo, indice, escolha });
      receber(r.duelo);
    } catch (error) {
      setErro((error as Error).message);
    }
  };

  const sair = async () => {
    if (!duelo) return;
    if (duelo.status === "jogando" && !duelo.contraMine && !window.confirm("Sair agora conta como derrota. Quer mesmo sair?")) return;
    try {
      const r = await chamar<{ duelo: VistaDuelo }>({ acao: "sair", codigo: duelo.codigo });
      receber(r.duelo);
    } catch {
      setDuelo(null);
    }
    gravarLocal(chaveAtivo, null);
  };

  const fechar = () => {
    setDuelo(null);
    setAviso("");
    gravarLocal(chaveAtivo, null);
  };

  const relogio = agora + desvio;

  return (
    <div className="due-page">
      <PageHeader
        eyebrow="Duelo · 1 contra 1"
        title="Duelo de conhecimento"
        subtitle={`Cinco perguntas, vinte segundos cada. Acertar rápido vale mais. Desafie um colega pelo código da sala ou treine contra a Mine — vitória vale ${dueloXp("vitoria")} XP (até ${duelosPorDia} duelos por dia).`}
        action={
          duelo && duelo.status !== "fim" ? (
            <button type="button" className="due-sair" onClick={sair}>
              <LogOut className="h-4 w-4" /> {duelo.status === "sala" ? "Fechar sala" : "Sair do duelo"}
            </button>
          ) : undefined
        }
      />

      {aviso ? <p className="due-aviso">{aviso}</p> : null}
      {erro ? (
        <p className="due-erro" role="alert">
          {erro}
        </p>
      ) : null}

      {!duelo ? (
        <Saguao
          tema={tema}
          setTema={setTema}
          codigo={codigo}
          setCodigo={setCodigo}
          salas={salas}
          ocupado={ocupado}
          onCriar={criar}
          onEntrar={entrar}
        />
      ) : duelo.status === "sala" ? (
        <Espera duelo={duelo} />
      ) : duelo.status === "jogando" ? (
        <Partida duelo={duelo} relogio={relogio} reduced={reduced} onResponder={responder} />
      ) : (
        <Fim duelo={duelo} placarRef={placarRef} onFechar={fechar} onRevanche={() => criar(duelo.contraMine, duelo.tema)} ocupado={Boolean(ocupado)} />
      )}
    </div>
  );
}

function Saguao({
  tema,
  setTema,
  codigo,
  setCodigo,
  salas,
  ocupado,
  onCriar,
  onEntrar,
}: {
  tema: string;
  setTema: (v: string) => void;
  codigo: string;
  setCodigo: (v: string) => void;
  salas: Sala[];
  ocupado: string;
  onCriar: (contraMine: boolean, tema?: string) => void;
  onEntrar: (codigo?: string) => void;
}) {
  const abertas = salas.filter((s) => !s.minha);
  return (
    <div className="due-saguao">
      <section className="due-card due-criar">
        <p className="caderno-note">novo duelo</p>
        <label className="due-rotulo" htmlFor="due-tema">
          Sobre o que vai ser?
        </label>
        <input
          id="due-tema"
          className="due-input"
          value={tema}
          onChange={(event) => setTema(event.target.value.slice(0, 120))}
          onKeyDown={(event) => event.key === "Enter" && onCriar(false)}
          placeholder="Ex.: Segunda Guerra Mundial, equações do 2º grau…"
        />
        <div className="due-sugestoes">
          {sugestoes.map((item) => (
            <button key={item} type="button" className={tema === item ? "is-on" : ""} onClick={() => setTema(item)}>
              {item}
            </button>
          ))}
        </div>
        <div className="due-acoes">
          <button type="button" className="due-btn caderno-btn-pen" disabled={Boolean(ocupado)} onClick={() => onCriar(false)}>
            {ocupado === "colega" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} Abrir sala para um colega
          </button>
          <button type="button" className="due-btn due-btn-mine" disabled={Boolean(ocupado)} onClick={() => onCriar(true)}>
            {ocupado === "mine" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />} Treinar contra a Mine
          </button>
        </div>
        {ocupado === "colega" || ocupado === "mine" ? <p className="due-dica">A Mine está escrevendo as perguntas… leva uns segundos.</p> : null}
      </section>

      <section className="due-card">
        <p className="caderno-note">entrar com código</p>
        <form
          className="due-codigo"
          onSubmit={(event) => {
            event.preventDefault();
            onEntrar();
          }}
        >
          <input
            className="due-input due-input-codigo"
            value={codigo}
            onChange={(event) => setCodigo(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
            placeholder="ABC23"
            aria-label="Código da sala"
            autoCapitalize="characters"
            inputMode="text"
          />
          <button type="submit" className="due-btn caderno-btn-pen" disabled={codigo.length !== 5 || Boolean(ocupado)}>
            {ocupado === "entrar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />} Entrar
          </button>
        </form>

        <p className="caderno-note mt-5">salas abertas agora</p>
        {abertas.length ? (
          <ul className="due-salas">
            {abertas.map((sala) => (
              <li key={sala.codigo}>
                <div>
                  <strong>{sala.tema}</strong>
                  <span>
                    {sala.dono} · {sala.codigo}
                  </span>
                </div>
                <button type="button" className="due-btn-mini" disabled={Boolean(ocupado)} onClick={() => onEntrar(sala.codigo)}>
                  <Swords className="h-4 w-4" /> Duelar
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="due-vazio">Nenhuma sala esperando. Abra uma e mande o código para a turma!</p>
        )}
      </section>
    </div>
  );
}

function Espera({ duelo }: { duelo: VistaDuelo }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <section className="due-card due-espera">
      <p className="caderno-note">sala aberta · {duelo.tema}</p>
      <p className="due-espera-texto">Passe este código para quem vai duelar com você:</p>
      <div className="due-codigo-grande" aria-label={`Código ${duelo.codigo.split("").join(" ")}`}>
        {duelo.codigo.split("").map((letra, i) => (
          <span key={i}>{letra}</span>
        ))}
      </div>
      <button
        type="button"
        className="due-btn caderno-btn-pen"
        onClick={() => {
          navigator.clipboard
            ?.writeText(`Bora duelar no Minerva? Abre a aba Duelo e entra com o código ${duelo.codigo} (tema: ${duelo.tema})`)
            .then(() => {
              setCopiado(true);
              window.setTimeout(() => setCopiado(false), 2000);
            })
            .catch(() => undefined);
        }}
      >
        {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copiado ? "Copiado!" : "Copiar convite"}
      </button>
      <p className="due-esperando">
        <Loader2 className="h-4 w-4 animate-spin" /> esperando o adversário… a sala fica aberta por 15 minutos
      </p>
    </section>
  );
}

function Partida({ duelo, relogio, reduced, onResponder }: { duelo: VistaDuelo; relogio: number; reduced: boolean; onResponder: (indice: number, escolha: number) => void }) {
  const eu = duelo.jogadores.find((j) => j.eu)!;
  const outro = duelo.jogadores.find((j) => !j.eu);
  const pergunta = duelo.perguntas[duelo.atual];
  const contagem = Math.ceil((duelo.inicioPergunta - relogio) / 1000);
  const revelando = Boolean(duelo.revelandoAte);
  const minhaResposta = eu.respostas.find((r) => r.indice === duelo.atual);
  const respostaDele = outro?.respostas.find((r) => r.indice === duelo.atual);
  const restante = Math.max(0, duelo.tempoPerguntaMs - (relogio - duelo.inicioPergunta));
  const fracao = revelando ? 0 : restante / duelo.tempoPerguntaMs;

  return (
    <div className="due-partida">
      <div className="due-placar">
        <Jogador nome={eu.nome} pontos={eu.pontos} lado="eu" status={revelando ? (minhaResposta?.certo ? "certo" : "errado") : eu.respondeu ? "respondeu" : "pensando"} />
        <div className="due-rodada">
          <span>pergunta</span>
          <strong>
            {Math.min(duelo.atual + 1, duelo.total)}/{duelo.total}
          </strong>
        </div>
        <Jogador nome={outro?.nome || "…"} pontos={outro?.pontos || 0} lado="ele" mine={duelo.contraMine} status={revelando ? (respostaDele?.certo ? "certo" : "errado") : outro?.respondeu ? "respondeu" : "pensando"} />
      </div>

      {contagem > 0 && !pergunta ? (
        <div className="due-contagem" aria-live="assertive">
          <p className="caderno-note">{duelo.atual === 0 ? "valendo!" : "próxima"}</p>
          <AnimatePresence mode="popLayout">
            <motion.strong key={contagem} initial={reduced ? false : { scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 22 }}>
              {contagem}
            </motion.strong>
          </AnimatePresence>
          <p>Tema: {duelo.tema}</p>
        </div>
      ) : pergunta ? (
        <section className="due-pergunta" aria-live="polite">
          <div className="due-tempo" aria-hidden>
            <span style={{ transform: `scaleX(${fracao})` }} className={fracao < 0.25 ? "is-pouco" : ""} />
          </div>
          <p className="due-tempo-num">
            <Timer className="inline h-4 w-4" /> {revelando ? "resposta" : `${Math.ceil(restante / 1000)} s`}
          </p>
          <h2>{pergunta.pergunta}</h2>
          <div className="due-alternativas" role="radiogroup" aria-label="Alternativas">
            {pergunta.alternativas.map((alt, i) => {
              const certa = revelando && i === pergunta.correta;
              const minhaErrada = revelando && minhaResposta?.escolha === i && i !== pergunta.correta;
              const escolhida = minhaResposta?.escolha === i;
              const dele = revelando && respostaDele?.escolha === i;
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={escolhida}
                  disabled={Boolean(minhaResposta) || revelando || relogio < duelo.inicioPergunta}
                  className={`due-alt due-alt-${i} ${escolhida ? "is-minha" : ""} ${certa ? "is-certa" : ""} ${minhaErrada ? "is-errada" : ""}`}
                  onClick={() => onResponder(duelo.atual, i)}
                >
                  <span className="due-letra">{String.fromCharCode(65 + i)}</span>
                  <span className="due-alt-texto">{alt}</span>
                  {dele ? <span className="due-marca-dele">{duelo.contraMine ? "Mine" : (outro?.nome || "").split(" ")[0]}</span> : null}
                  {certa ? <CheckCircle2 className="h-5 w-5 flex-none" /> : minhaErrada ? <XCircle className="h-5 w-5 flex-none" /> : null}
                </button>
              );
            })}
          </div>
          {revelando ? (
            <motion.p className="due-explica" initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              {minhaResposta?.certo ? <strong>+{minhaResposta.pontos} pontos! </strong> : minhaResposta && minhaResposta.escolha >= 0 ? <strong>Errou essa. </strong> : <strong>O tempo acabou. </strong>}
              {pergunta.explicacao}
            </motion.p>
          ) : minhaResposta ? (
            <p className="due-explica due-explica-espera">
              <Loader2 className="inline h-4 w-4 animate-spin" /> Resposta marcada. Esperando {duelo.contraMine ? "a Mine" : "o adversário"}…
            </p>
          ) : null}
        </section>
      ) : (
        <div className="due-contagem">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
    </div>
  );
}

function Jogador({ nome, pontos, lado, status, mine = false }: { nome: string; pontos: number; lado: "eu" | "ele"; status: "pensando" | "respondeu" | "certo" | "errado"; mine?: boolean }) {
  const rotulo = { pensando: "pensando…", respondeu: "respondeu!", certo: "acertou", errado: "errou" }[status];
  return (
    <div className={`due-jogador due-jogador-${lado} is-${status}`}>
      <span className="due-avatar" aria-hidden>
        {mine ? <Bot className="h-5 w-5" /> : nome.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0">
        <strong className="due-nome">{lado === "eu" ? "Você" : nome}</strong>
        <span className="due-status">{rotulo}</span>
      </div>
      <motion.span key={pontos} className="due-pontos" initial={{ scale: 1.3 }} animate={{ scale: 1 }}>
        {pontos}
      </motion.span>
    </div>
  );
}

function Fim({ duelo, placarRef, onFechar, onRevanche, ocupado }: { duelo: VistaDuelo; placarRef: React.RefObject<HTMLDivElement>; onFechar: () => void; onRevanche: () => void; ocupado: boolean }) {
  const eu = duelo.jogadores.find((j) => j.eu);
  const outro = duelo.jogadores.find((j) => !j.eu);
  if (!duelo.resultado || !eu || !outro) {
    return (
      <section className="due-card due-fim">
        <p className="due-fim-titulo">{duelo.abandono === "expirou" ? "Ninguém entrou na sala a tempo." : "A sala foi fechada."}</p>
        <button type="button" className="due-btn caderno-btn-pen" onClick={onFechar}>
          Voltar
        </button>
      </section>
    );
  }
  const titulo = { vitoria: "Vitória!", empate: "Empate!", derrota: "Não foi dessa vez" }[duelo.resultado];
  const motivo = duelo.abandono === "saiu" || duelo.abandono === "sumiu" ? (duelo.quemSaiu === eu.id ? "Você saiu do duelo." : `${outro.nome} saiu do duelo.`) : "";
  return (
    <section className={`due-fim is-${duelo.resultado}`}>
      <div ref={placarRef} className="due-card due-fim-placar">
        <Trophy className="due-trofeu h-10 w-10" aria-hidden />
        <p className="due-fim-titulo">{titulo}</p>
        {motivo ? <p className="due-dica">{motivo}</p> : null}
        <div className="due-fim-numeros">
          <div>
            <span>Você</span>
            <strong>{eu.pontos}</strong>
            <small>{eu.respostas.filter((r) => r.certo).length} acertos</small>
          </div>
          <span className="due-x">×</span>
          <div>
            <span>{outro.nome}</span>
            <strong>{outro.pontos}</strong>
            <small>{outro.respostas.filter((r) => r.certo).length} acertos</small>
          </div>
        </div>
        <p className="due-dica">+{dueloXp(duelo.resultado)} XP · tema: {duelo.tema}</p>
        <div className="due-acoes">
          <button type="button" className="due-btn caderno-btn-pen" disabled={ocupado} onClick={onRevanche}>
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {duelo.contraMine ? "Jogar de novo" : "Revanche (nova sala)"}
          </button>
          <button type="button" className="due-btn due-btn-mine" onClick={onFechar}>
            Voltar ao saguão
          </button>
        </div>
      </div>

      <div className="due-card">
        <p className="caderno-note">revisão</p>
        <ol className="due-revisao">
          {duelo.perguntas.map((p, i) => {
            if (!p) return null;
            const minha = eu.respostas.find((r) => r.indice === i);
            const dele = outro.respostas.find((r) => r.indice === i);
            return (
              <li key={i}>
                <p className="due-revisao-p">{p.pergunta}</p>
                <p className="due-revisao-r">
                  <span className="is-certa">✓ {p.alternativas[p.correta]}</span>
                </p>
                <p className="due-revisao-quem">
                  Você: {minha && minha.escolha >= 0 ? (minha.certo ? `acertou (+${minha.pontos})` : `marcou ${String.fromCharCode(65 + minha.escolha)}`) : "não respondeu"} · {outro.nome.split(" ")[0]}:{" "}
                  {dele && dele.escolha >= 0 ? (dele.certo ? `acertou (+${dele.pontos})` : `marcou ${String.fromCharCode(65 + dele.escolha)}`) : "não respondeu"}
                </p>
                {p.explicacao ? <p className="due-revisao-e">{p.explicacao}</p> : null}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
