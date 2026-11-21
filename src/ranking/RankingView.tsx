import { seasonPoints } from "../../shared/game-meta.mjs";
import { BookshelfPodium } from "../caderno/Bookshelf";
import { Reveal, Stagger, StaggerItem, ease, spring, useSoftMotion } from "../motion";
import { motion } from "framer-motion";
import { Activity, ChevronRight, Flame, Loader2, RefreshCw, RotateCcw, Search, Sparkles, Star, Target, Users, XCircle, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, EmptyState, PrimaryButton, apiJson, go, normalizeText, readSession, type AppData, type User } from "../main";


type RankingRow = {
  id: string;
  name: string;
  displayName: string;
  avatar?: string;
  you: boolean;
  friend: boolean;
  xp: number;
  level: number;
  title: string;
  dayXp: number;
  weekXp: number;
  streak: number;
  focus: number;
  tasksDone: number;
  seasonPoints: number;
  league: string;
  dailyCorrect: number;
  dailyDurationMs: number;
};

type RankingRange = "dayXp" | "weekXp" | "seasonPoints" | "dailyCorrect" | "xp";

const rankingRanges: Array<{ id: RankingRange; label: string; hint: string; unit: string }> = [
  { id: "dayXp", label: "Hoje", hint: "XP conquistado desde a meia-noite", unit: "XP" },
  { id: "weekXp", label: "Semana", hint: "XP dos últimos 7 dias", unit: "XP" },
  { id: "seasonPoints", label: "Temporada", hint: "Pontos dos jogos nesta temporada", unit: "PTS" },
  { id: "dailyCorrect", label: "Desafio", hint: "Acertos no desafio compartilhado de hoje", unit: "ACERTOS" },
  { id: "xp", label: "Total", hint: "XP acumulado desde o começo", unit: "XP" },
];

/**
 * Ranking do site inteiro.
 *
 * Nasceu como placar entre amigos digitados à mão e não funcionava: ninguém
 * sabe o nome de conta de ninguém, então a lista abria vazia. Agora vem todo
 * mundo, e "amigos" virou um filtro por cima — marcar alguém é uma estrela na
 * linha, não um formulário.
 *
 * O XP de cada pessoa é calculado no servidor (POST /api/leaderboard): o
 * navegador nunca recebe os dados de estudo de ninguém além dos próprios — só
 * nome, foto e números.
 */
export function RankingView({
  user,
  update,
  notify,
}: {
  user: User;
  update: (next: (draft: AppData) => AppData) => void;
  notify: (message: string) => void;
}) {
  const friends = useMemo(() => user.settings.friends || [], [user.settings.friends]);
  const [range, setRange] = useState<RankingRange>("weekXp");
  const [escopo, setEscopo] = useState<"todos" | "amigos">("todos");
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [ocultos, setOcultos] = useState(0);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"carregando" | "pronto" | "erro">("carregando");
  const [erro, setErro] = useState("");
  const reduced = useSoftMotion();

  // A lista de amigos entra no corpo do pedido só para o servidor marcar quem
  // é quem; ela não filtra nada lá — o filtro é local, e por isso trocar de
  // aba não custa uma ida ao servidor.
  const friendsRef = useRef(friends);
  friendsRef.current = friends;

  const carregar = useCallback(async () => {
    const token = readSession().token;
    if (!token) {
      setErro("Entre na sua conta para ver o ranking.");
      setStatus("erro");
      return;
    }
    setStatus((atual) => (atual === "pronto" ? "pronto" : "carregando"));
    setErro("");
    try {
      const payload = await apiJson<{ rows: RankingRow[]; ocultos: number }>("/api/leaderboard", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ friends: friendsRef.current }),
      });
      setRows(payload.rows || []);
      setOcultos(payload.ocultos || 0);
      setStatus("pronto");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não consegui carregar o ranking agora.");
      setStatus("erro");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function alternarAmigo(row: RankingRow) {
    // O servidor só manda o nome da conta de quem já é amigo; os outros viram
    // amigos pelo id (o servidor reconhece os dois).
    const chaves = [row.name, row.id].filter(Boolean).map((item) => item.toLowerCase());
    const jaEra = row.friend || friends.some((item) => chaves.includes(item.toLowerCase()));
    const proximos = jaEra ? friends.filter((item) => !chaves.includes(item.toLowerCase())) : [...friends, row.name || row.id];
    update((draft) => ({
      ...draft,
      users: draft.users.map((item) => (item.id === user.id ? { ...item, settings: { ...item.settings, friends: proximos } } : item)),
    }));
    setRows((atuais) => atuais.map((item) => (item.id === row.id ? { ...item, friend: !jaEra } : item)));
    notify(jaEra ? `${row.displayName} saiu dos seus amigos.` : `${row.displayName} entrou nos seus amigos.`);
  }

  // Ordena a lista inteira primeiro: assim a posição mostrada é a posição no
  // site, e não muda quando a busca ou o filtro de amigos escondem alguém.
  const ordenado = useMemo(() => {
    const lista = [...rows].sort((a, b) => {
      const score = b[range] - a[range];
      if (score) return score;
      if (range === "dailyCorrect") {
        const aTime = a.dailyDurationMs || Number.POSITIVE_INFINITY;
        const bTime = b.dailyDurationMs || Number.POSITIVE_INFINITY;
        if (aTime !== bTime) return aTime - bTime;
      }
      return b.xp - a.xp;
    });
    return lista.map((row, index) => ({ row, position: index + 1 }));
  }, [rows, range]);

  const termo = normalizeText(busca);
  const visivel = ordenado.filter(
    ({ row }) => (escopo === "todos" || row.friend || row.you) && (!termo || normalizeText(row.displayName).includes(termo) || normalizeText(row.name).includes(termo)),
  );
  const lider = ordenado[0]?.row[range] || 0;
  const rangeInfo = rankingRanges.find((item) => item.id === range) || rankingRanges[1];
  const eu = ordenado.find(({ row }) => row.you);
  const acimaDeMim = eu && eu.position > 1 ? ordenado[eu.position - 2] : null;
  const podium = [ordenado[1], ordenado[0], ordenado[2]].filter(Boolean) as Array<{ row: RankingRow; position: number }>;
  const totalDoPeriodo = ordenado.reduce((total, item) => total + item.row[range], 0);
  const maiorSequencia = Math.max(0, ...ordenado.map((item) => item.row.streak));
  const progressoDoLider = eu && lider > 0 ? Math.min(100, Math.round((eu.row[range] / lider) * 100)) : 0;

  return (
    <div className="ranking-arena">
      <section className="ranking-hero-grid">
        <Reveal className="ranking-intro">
          <p className="caderno-note">ranking da minerva</p>
          <h1>A estante <span className="caderno-hl">da turma</span></h1>
          <p>Cada livro na pilha é XP de estudo. Quanto mais você estuda, mais alta fica a sua.</p>
          <button type="button" onClick={() => void carregar()} className="caderno-btn-pencil ranking-refresh-pencil" disabled={status === "carregando"}>
            {status === "carregando" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {status === "carregando" ? "Atualizando" : "Atualizar placar"}
          </button>
        </Reveal>

        {eu && status === "pronto" ? (
          <Reveal delay={0.04} className="ranking-self-wrap">
            {/* Boletim: a posição carimbada, o nível num selo e a meta a lápis. */}
            <article className="caderno-rank-card">
              <span className="caderno-rank-tape" aria-hidden />
              <div className="caderno-rank-stamp" aria-label={`${eu.position}º lugar de ${ordenado.length}`}>
                <strong>{eu.position}º</strong>
                <small>de {ordenado.length}</small>
              </div>
              <div className="min-w-0">
                <p className="caderno-note">sua posição</p>
                <p className="caderno-rank-score"><mark>{eu.row[range].toLocaleString("pt-BR")} {rangeInfo.unit}</mark> · {rangeInfo.label.toLowerCase()}</p>
                <div className="caderno-rank-bar" aria-label={`${progressoDoLider}% da pontuação do líder`}>
                  <span style={{ width: `${Math.max(4, progressoDoLider)}%` }} />
                  <em>líder</em>
                </div>
                <p className="caderno-rank-target">
                  {acimaDeMim
                    ? <>Faltam <strong>{Math.max(0, acimaDeMim.row[range] - eu.row[range])} {rangeInfo.unit}</strong> para passar {acimaDeMim.row.displayName}.</>
                    : ordenado.length > 1
                      ? "Você está liderando. Mantenha o ritmo!"
                      : "Convide a turma para começar a disputa."}
                </p>
              </div>
              <div className="caderno-rank-side">
                <span className="caderno-rank-level"><small>nível</small><strong>{eu.row.level}</strong></span>
                <span className="caderno-rank-streak"><Flame className="h-4 w-4" />{eu.row.streak} {eu.row.streak === 1 ? "dia" : "dias"}</span>
              </div>
            </article>
          </Reveal>
        ) : null}
      </section>

      <div className="ranking-workspace">
        <main className="ranking-primary">
          {podium.length && status === "pronto" ? (
            <Reveal delay={0.07}>
              <section className="ranking-podium-panel" aria-labelledby="ranking-podium-title">
                <div className="ranking-section-heading">
                  <div><p>Destaques do período</p><h2 id="ranking-podium-title">Pódio atual</h2></div>
                  <span>{rangeInfo.hint}</span>
                </div>
                <BookshelfPodium
                  entries={podium.map(({ row, position }) => ({
                    id: row.id,
                    name: row.displayName,
                    position,
                    score: row[range],
                    unit: rangeInfo.unit,
                    subtitle: `Nível ${row.level} · ${row.title}`,
                    avatar: <Avatar name={row.displayName} src={row.avatar} size={position === 1 ? 64 : 54} />,
                  }))}
                  leader={lider}
                  stackKey={range}
                  reduced={Boolean(reduced)}
                  onOpen={(id) => go("perfil", id)}
                />
              </section>
            </Reveal>
          ) : null}

          <Reveal delay={0.1}>
            <section className="ranking-board" aria-labelledby="ranking-board-title">
              <div className="ranking-board-top">
                <div><p>Classificação completa</p><h2 id="ranking-board-title">Leaderboard</h2></div>
                <div className="ranking-range-tabs" aria-label="Período do ranking">
                  {rankingRanges.map((item) => {
                    const ativo = item.id === range;
                    return (
                      <button key={item.id} type="button" aria-pressed={ativo} onClick={() => setRange(item.id)} className={ativo ? "is-active" : ""}>
                        {ativo && !reduced ? <motion.span layoutId="ranking-range-v2" transition={spring.snappy} /> : null}
                        {ativo && reduced ? <span /> : null}
                        <em>{item.label}</em>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="ranking-board-tools">
                <div className="ranking-scope-tabs">
                  {([
                    { id: "todos" as const, label: `Todos (${ordenado.length})`, icon: Users },
                    { id: "amigos" as const, label: `Amigos (${rows.filter((row) => row.friend).length})`, icon: Star },
                  ]).map((item) => (
                    <button key={item.id} type="button" aria-pressed={escopo === item.id} onClick={() => setEscopo(item.id)} className={escopo === item.id ? "is-active" : ""}>
                      <item.icon className="h-3.5 w-3.5" />{item.label}
                    </button>
                  ))}
                </div>
                <label className="ranking-search">
                  <span className="sr-only">Procurar uma pessoa</span>
                  <Search className="h-4 w-4" />
                  <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar usuário" />
                </label>
              </div>

              <div className="ranking-table-head" aria-hidden><span>Pos.</span><span>Usuário</span><span>Pontuação</span><span>Acompanhar</span></div>
              {status === "erro" ? (
                <EmptyState icon={XCircle} title="Não deu para carregar" text={erro} action={<PrimaryButton icon={RotateCcw} onClick={() => void carregar()}>Tentar de novo</PrimaryButton>} />
              ) : status === "carregando" && !rows.length ? (
                <div className="ranking-loading"><Loader2 className="h-8 w-8 animate-spin text-mint" /><p>Somando o XP de todo mundo...</p></div>
              ) : !visivel.length ? (
                <EmptyState
                  icon={escopo === "amigos" ? Star : Search}
                  title={escopo === "amigos" ? "Você ainda não marcou ninguém" : "Ninguém com esse nome"}
                  text={escopo === "amigos" ? "Use a estrela na classificação geral para acompanhar alguém." : "Tente outro trecho do nome ou volte para a lista completa."}
                />
              ) : (
                <Stagger className="ranking-rows" gap={0.035}>
                  {visivel.map(({ row, position }) => (
                    <StaggerItem key={row.id}>
                      <RankingRowCard row={row} position={position} value={row[range]} unit={rangeInfo.unit} leader={lider} reduced={Boolean(reduced)} onOpen={() => go("perfil", row.id)} onToggleFriend={() => alternarAmigo(row)} />
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
              {ocultos > 0 ? <p className="ranking-privacy-note">{ocultos === 1 ? "Uma pessoa preferiu" : `${ocultos} pessoas preferiram`} não aparecer no ranking.</p> : null}
            </section>
          </Reveal>
        </main>

        <aside className="ranking-insights" aria-label="Indicadores do ranking">
          <Reveal delay={0.12}>
            <section className="ranking-insight-card">
              <div className="ranking-insight-title"><Activity className="h-4 w-4" /><h2>Visão rápida</h2></div>
              <dl className="ranking-stat-list">
                <div><dt><Users className="h-4 w-4" />Participantes</dt><dd>{ordenado.length}</dd></div>
                <div><dt><Zap className="h-4 w-4" />{rangeInfo.unit} distribuído</dt><dd>{totalDoPeriodo.toLocaleString("pt-BR")}</dd></div>
                <div><dt><Flame className="h-4 w-4" />Maior sequência</dt><dd>{maiorSequencia}d</dd></div>
              </dl>
            </section>
          </Reveal>
          {eu ? (
            <Reveal delay={0.15}>
              <section className="ranking-insight-card ranking-chase-card">
                <div className="ranking-insight-title"><Target className="h-4 w-4" /><h2>Próximo avanço</h2></div>
                {acimaDeMim ? (
                  <><p>Alcance <strong>{acimaDeMim.row.displayName}</strong> para subir ao {acimaDeMim.position}º lugar.</p><div className="ranking-chase-person"><Avatar name={acimaDeMim.row.displayName} src={acimaDeMim.row.avatar} size={38} /><span><strong>{acimaDeMim.row[range].toLocaleString("pt-BR")} {rangeInfo.unit}</strong><small>meta atual</small></span></div></>
                ) : <p>Você ocupa a liderança deste período. Continue somando pontos para defender a posição.</p>}
              </section>
            </Reveal>
          ) : null}
          <Reveal delay={0.18}>
            <section className="ranking-insight-card ranking-rules-card">
              <div className="ranking-insight-title"><Sparkles className="h-4 w-4" /><h2>Como subir</h2></div>
              <ul><li>Conclua atividades do plano</li><li>Estude seus materiais</li><li>Acerte nos jogos da Mine</li></ul>
            </section>
          </Reveal>
        </aside>
      </div>
    </div>
  );
}

function RankingRowCard({
  row,
  position,
  value,
  unit,
  leader,
  reduced,
  onOpen,
  onToggleFriend,
}: {
  row: RankingRow;
  position: number;
  value: number;
  unit: string;
  leader: number;
  reduced: boolean;
  onOpen: () => void;
  onToggleFriend: () => void;
}) {
  const medalha = position <= 3;
  const cor = position === 1 ? "#FBBF24" : position === 2 ? "#D2D2D8" : position === 3 ? "#FB923C" : "#34D399";
  return (
    <div className={`ranking-row ${row.you ? "is-you" : ""}`}>
      <motion.span
        aria-hidden
        className="ranking-row-progress"
        style={{ background: `linear-gradient(transparent 62%, ${cor}55 62% 92%, transparent 92%)` }}
        initial={reduced ? false : { width: 0 }}
        animate={{ width: `${leader > 0 ? Math.max(4, (value / leader) * 100) : 4}%` }}
        transition={{ duration: 0.7, ease: ease.out }}
      />
      <div className="ranking-row-inner">
        <button
          type="button"
          onClick={onOpen}
          className="ranking-row-main"
        >
          <span
            className={`ranking-row-position ${medalha ? "is-medal" : ""}`}
            style={medalha ? { backgroundColor: cor } : undefined}
          >
            {position}
          </span>
          <span className="ranking-row-user">
            <Avatar name={row.displayName} src={row.avatar} size={40} />
            <span className="ranking-row-identity">
              <span className="ranking-row-name">
              <span className="truncate">{row.displayName}</span>
                {row.you ? <span>você</span> : null}
              </span>
              <span className="ranking-row-meta">
                <span>Nível {row.level}</span><i>·</i><span>{row.title}</span>
              {row.streak ? (
                  <><i>·</i><span className="ranking-row-streak"><Flame className="h-3 w-3" />{row.streak}d</span></>
              ) : null}
              </span>
            </span>
          </span>
          <span className="ranking-row-score">
            <strong>{value.toLocaleString("pt-BR")}</strong><small>{unit}</small>
          </span>
        </button>
        {!row.you ? (
          <button
            type="button"
            onClick={onToggleFriend}
            aria-pressed={row.friend}
            aria-label={row.friend ? `Remover ${row.displayName} dos amigos` : `Marcar ${row.displayName} como amigo`}
            title={row.friend ? "Remover dos amigos" : "Marcar como amigo"}
            className={`ranking-row-friend ${row.friend ? "is-friend" : ""}`}
          >
            <Star className={`h-[18px] w-[18px] ${row.friend ? "fill-current" : ""}`} />
          </button>
        ) : (
          <ChevronRight className="ranking-row-chevron" />
        )}
      </div>
    </div>
  );
}