import { achievementList, streakDays, type XpStats } from "../../shared/xp.mjs";
import { playChime, setSoundsEnabled } from "../caderno";
import { focusMinutes } from "../insights";
import { AnimatedBar, Reveal, Stagger, StaggerItem, Tilt3D, spring } from "../motion";
import { motion } from "framer-motion";
import { Activity, Award, Bell, BookOpen, Bot, Camera, Check, CheckCircle2, ChevronLeft, ClipboardCheck, Download, FileText, Flame, Gamepad2, ListChecks, Loader2, LogOut, MoonStar, RefreshCw, Sparkles, Target, Timer, Trophy, Users, Volume2, Wand2, XCircle, Zap, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppearanceControls, Avatar, EmptyState, GlassCard, HeroCard, Input, Metric, PageHeader, Pill, PrimaryButton, SecondaryButton, SectionTitle, achievementIcons, apiJson, gamificationOf, go, loadImage, normalizeAccent, percent, readFileAsDataUrl, readSession, useMemoUserData, type AppData, type User } from "../main";


/**
 * Foto de perfil: recorta no quadrado central e reduz para 192px.
 *
 * O tamanho é apertado de propósito. O estado inteiro da conta viaja como um
 * JSON só, e a foto ainda vai junto no ranking, uma por linha — a 192px em
 * JPEG isso dá uns 12KB, então trinta pessoas no placar custam menos que uma
 * única foto de câmera.
 */
async function avatarFileToDataUrl(file: File) {
  const original = await readFileAsDataUrl(file);
  const image = await loadImage(original);
  const lado = Math.min(image.width, image.height);
  const alvo = 192;
  const canvas = document.createElement("canvas");
  canvas.width = alvo;
  canvas.height = alvo;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Nao foi possivel preparar a imagem.");
  context.drawImage(image, (image.width - lado) / 2, (image.height - lado) / 2, lado, lado, 0, 0, alvo, alvo);
  return canvas.toDataURL("image/jpeg", 0.72);
}

function ToggleSwitch({ icon: Icon, label, hint, on, onChange }: { icon: LucideIcon; label: string; hint?: string; on: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 transition-colors hover:border-white/15 hover:bg-white/[0.045]">
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors duration-control ${on ? "bg-mint/15 text-mint" : "bg-white/[0.07] text-white/40"}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-black leading-tight">{label}</p>
        {hint ? <p className="text-[13px] leading-snug text-white/45">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        onClick={() => onChange(!on)}
        aria-checked={on}
        aria-label={label}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-control ${on ? "bg-mint shadow-glowSoft" : "bg-white/14"}`}
      >
        <motion.span
          className={`absolute top-1 h-5 w-5 rounded-full ${on ? "bg-black" : "bg-white"}`}
          animate={{ left: on ? 24 : 4 }}
          transition={spring.snappy}
        />
      </button>
    </div>
  );
}

/** Placar do topo, igual em todos os jogos. */
/**
 * Perfil e ajustes na mesma tela.
 *
 * Eram duas ideias com um dono só: a apresentação (nome, foto, bio) e as
 * preferências. Quem clica no próprio nome quer as duas, e quem chega pelo
 * ranking cai aqui com o `id` de outra pessoa — nesse caso a tela vira o
 * cartão público, sem nada de configuração.
 */
export function ProfileView({
  user,
  data,
  update,
  notify,
  logout,
  targetId,
}: {
  user: User;
  data: ReturnType<typeof useMemoUserData>;
  update: (next: (draft: AppData) => AppData) => void;
  notify: (message: string) => void;
  logout: () => void;
  targetId?: string;
}) {
  if (targetId && targetId !== user.id) return <PublicProfileView userId={targetId} />;
  return <OwnProfileView user={user} data={data} update={update} notify={notify} logout={logout} />;
}

function OwnProfileView({ user, data, update, notify, logout }: { user: User; data: ReturnType<typeof useMemoUserData>; update: (next: (draft: AppData) => AppData) => void; notify: (message: string) => void; logout: () => void }) {
  const [name, setName] = useState(user.settings.displayName);
  const [bio, setBio] = useState(user.settings.bio || "");
  const [fotoErro, setFotoErro] = useState("");
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement | null>(null);
  const gam = gamificationOf(data);
  const s = user.settings;
  const setSetting = (patch: Partial<User["settings"]>) =>
    update((draft) => ({
      ...draft,
      users: draft.users.map((item) => (item.id === user.id ? { ...item, settings: { ...item.settings, ...patch } } : item)),
    }));

  const nomeSujo = name.trim() !== (s.displayName || "").trim();
  const bioSuja = bio.trim() !== (s.bio || "").trim();

  function salvarApresentacao() {
    const limpo = name.trim();
    if (!limpo) {
      notify("O nome não pode ficar vazio.");
      return;
    }
    setSetting({ displayName: limpo, bio: bio.trim() || undefined });
    notify("Perfil atualizado.");
  }

  async function salvarAvatar(avatar?: string) {
    const session = readSession();
    if (!session.token) throw new Error("Sua sessão expirou. Entre novamente.");
    const response = await apiJson<{ user: User }>("/api/profile", {
      method: "PUT",
      headers: { authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ avatar: avatar || null }),
    });
    update((draft) => ({
      ...draft,
      users: draft.users.map((item) => (item.id === response.user.id ? response.user : item)),
    }));
  }

  async function escolherFoto(file: File | undefined) {
    if (!file) return;
    setFotoErro("");
    if (!file.type.startsWith("image/")) {
      setFotoErro("Escolha um arquivo de imagem.");
      return;
    }
    setEnviandoFoto(true);
    try {
      const avatar = await avatarFileToDataUrl(file);
      await salvarAvatar(avatar);
      notify("Foto publicada no seu perfil.");
    } catch (error) {
      setFotoErro(error instanceof Error ? error.message : "Não consegui usar essa imagem. Tente outra.");
    } finally {
      setEnviandoFoto(false);
    }
  }

  function exportBackup() {
    const backup = {
      app: "minerva",
      exportedAt: new Date().toISOString(),
      user: { name: user.name, settings: user.settings },
      subjects: data.subjects,
      materials: data.materials,
      tasks: data.tasks,
      chats: data.chats,
      sessions: data.sessions,
      flashcards: data.flashcards,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `minerva-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("Backup baixado.");
  }
  return (
    <>
      <PageHeader
        eyebrow="Perfil e ajustes"
        title="Seu perfil"
        subtitle="Como você aparece para a turma no ranking, e as preferências do app."
        action={
          <SecondaryButton icon={LogOut} onClick={logout}>
            Sair
          </SecondaryButton>
        }
      />

      <Reveal>
        {/* A capa do perfil é a carteirinha de estudante: inclina com o mouse. */}
        <Tilt3D max={4} scale={1.004} lift={3} className="mb-5">
        <HeroCard className="caderno-idcard">
          <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
            <div className="flex shrink-0 flex-col items-center gap-3 border-b border-white/10 pb-7 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-7">
              <div className="relative">
                <Avatar name={s.displayName || user.name} src={s.avatar} size={112} ring />
                <button
                  type="button"
                  onClick={() => fotoInputRef.current?.click()}
                  disabled={enviandoFoto}
                  aria-label="Trocar foto de perfil"
                  title="Trocar foto de perfil"
                  className="absolute -bottom-1 -right-1 grid h-10 w-10 place-items-center rounded-full border-2 border-[#08080b] bg-mint text-black shadow-glowSoft transition-transform hover:scale-105 disabled:opacity-60"
                >
                  {enviandoFoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </button>
              </div>
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  void escolherFoto(event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
              {s.avatar ? (
                <button
                  type="button"
                  onClick={() => {
                    setEnviandoFoto(true);
                    void salvarAvatar(undefined)
                      .then(() => notify("Foto removida."))
                      .catch((error) => setFotoErro(error instanceof Error ? error.message : "Não consegui remover a foto."))
                      .finally(() => setEnviandoFoto(false));
                  }}
                  className="text-[12px] font-black text-white/40 transition-colors hover:text-roseGlow"
                >
                  Remover foto
                </button>
              ) : (
                <p className="max-w-[8rem] text-center text-[11px] font-bold leading-snug text-white/35">A foto aparece no ranking</p>
              )}
              {fotoErro ? <p className="max-w-[9rem] text-center text-[11px] font-bold text-roseGlow">{fotoErro}</p> : null}
            </div>

            <div className="min-w-0 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Pill icon={Award}>{gam.title}</Pill>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1 text-[12px] font-black text-white/60">
                  Nível {gam.level}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1 text-[12px] font-black text-white/60">
                  <Zap className="h-3.5 w-3.5 text-mint" />
                  {gam.xp} XP
                </span>
                <span className="text-[12px] font-bold text-white/32">@{user.name}</span>
              </div>

              <Input label="Nome de exibição" value={name} onChange={setName} placeholder="Como a turma vê você" />

              <label className="block">
                <span className="mb-2 flex items-center justify-between text-[13px] font-black text-white/70">
                  Sobre você
                  <span className="font-bold text-white/30">{bio.length}/140</span>
                </span>
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value.slice(0, 140))}
                  rows={2}
                  placeholder="Uma linha sobre o que você está estudando"
                  className="w-full resize-none rounded-lg border border-white/12 bg-white/[0.06] p-4 text-white outline-none transition-control duration-control placeholder:text-white/40 focus:border-mint/60 focus:bg-black/35 focus:shadow-glowSoft"
                />
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <PrimaryButton icon={Check} onClick={salvarApresentacao}>
                  Salvar perfil
                </PrimaryButton>
                {nomeSujo || bioSuja ? <span className="text-[12px] font-bold text-amber-300">Alterações ainda não salvas</span> : null}
                <SecondaryButton icon={Trophy} onClick={() => go("ranking")}>
                  Ver o ranking
                </SecondaryButton>
              </div>
            </div>
          </div>
        </HeroCard>
        </Tilt3D>
      </Reveal>

      <div className="grid gap-6 xl:grid-cols-12">
        <Reveal className="xl:col-span-7" delay={0.05} direction="left">
          <GlassCard className="h-full">
            <SectionTitle icon={Bell} title="Preferências" />
            <div className="mt-5 grid gap-2.5">
              <SettingLine icon={Target} label={`Meta diária: ${s.dailyGoal} min`} />
              <SettingLine icon={MoonStar} label={`Sessão de foco: ${s.focusMinutes} min`} />
              <SettingLine icon={Bot} label={`Mine: ${s.mineStyle}`} />
              <ToggleSwitch icon={Bell} label="Lembretes de prova" hint="Avisa tarefas vencendo ao abrir." on={s.reminders} onChange={(v) => setSetting({ reminders: v })} />
            </div>
          </GlassCard>
        </Reveal>

        <Reveal className="xl:col-span-5" delay={0.1}>
          <GlassCard className="h-full">
            <SectionTitle icon={Timer} title="Foco" />
            <div className="mt-5 grid gap-2.5">
              <ToggleSwitch
                icon={Zap}
                label="Vibrar ao terminar"
                hint="Vibra quando o foco ou a pausa acaba."
                on={s.focusVibrate !== false}
                onChange={(v) => setSetting({ focusVibrate: v })}
              />
              <ToggleSwitch
                icon={Timer}
                label="Manter a tela ligada"
                hint="Impede a tela de apagar durante o foco."
                on={s.keepScreenOnFocus !== false}
                onChange={(v) => setSetting({ keepScreenOnFocus: v })}
              />
            </div>
          </GlassCard>
        </Reveal>

        <Reveal className="xl:col-span-5" delay={0.15} direction="left">
          <GlassCard className="h-full">
            <SectionTitle icon={Wand2} title="Aparência" />
            <div className="mt-5 grid gap-2.5">
              <div className="flex flex-col gap-3 rounded-[.9rem] border border-white/10 bg-white/[0.035] p-4">
                <div>
                  <p className="text-[13px] font-black text-white/74">Tema e cor dominante</p>
                  <p className="mt-1 text-[11px] font-bold leading-relaxed text-white/38">A escolha colore a logo, a intro, a home e os controles do site.</p>
                </div>
                <AppearanceControls
                  appearance={{ themeMode: s.themeChosen && s.themeMode ? s.themeMode : "light", accentColor: normalizeAccent(s.accentColor) }}
                  onChange={(patch) => setSetting(patch)}
                />
              </div>
              <button type="button" onClick={() => window.dispatchEvent(new Event("minerva:tour"))} className="caderno-btn-pencil inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-black">
                <Sparkles className="h-4 w-4" />
                Ver o tour da Mine de novo
              </button>
              <ToggleSwitch
                icon={Volume2}
                label="Sons do caderno"
                hint="Lápis riscando, página virando e confete. Começa desligado."
                on={!!s.sounds}
                onChange={(v) => {
                  setSoundsEnabled(v);
                  if (v) playChime();
                  setSetting({ sounds: v });
                }}
              />
              <ToggleSwitch
                icon={Wand2}
                label="Reduzir animações"
                hint="Desliga o fundo 3D e as transições. Bom em máquinas mais lentas."
                on={!!s.reducedMotion}
                onChange={(v) => setSetting({ reducedMotion: v })}
              />
              <ToggleSwitch
                icon={Bot}
                label="Mine andando pelo site"
                hint={s.reducedMotion ? "Some enquanto \"Reduzir animações\" estiver ligado." : "Ela passeia pelas abas e brinca com você: arraste, jogue, faça carinho ou pare o mouse num card."}
                on={s.pets !== "off"}
                onChange={(v) => setSetting({ pets: v ? "mine" : "off" })}
              />
            </div>
          </GlassCard>
        </Reveal>

        <Reveal className="xl:col-span-7" delay={0.18}>
          <GlassCard className="h-full">
            <SectionTitle icon={Trophy} title="Ranking" />
            <div className="mt-5 grid gap-2.5">
              <ToggleSwitch
                icon={Users}
                label="Aparecer no ranking"
                hint="Desligado, seu nome e seu XP somem do placar dos outros e o seu perfil não mostra o progresso. Você continua vendo o ranking normalmente."
                on={!s.hideFromRanking}
                onChange={(v) => setSetting({ hideFromRanking: !v })}
              />
            </div>
          </GlassCard>
        </Reveal>

        <Reveal className="xl:col-span-12" delay={0.2}>
          <GlassCard>
            <SectionTitle icon={Download} title="Seus dados" />
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/52">
              Baixe uma cópia de tudo o que você salvou na Minerva: matérias, conteúdos, tarefas, flashcards e conversas com a Mine.
            </p>
            <div className="mt-4">
              <SecondaryButton icon={Download} onClick={exportBackup}>
                Baixar backup (JSON)
              </SecondaryButton>
            </div>
          </GlassCard>
        </Reveal>
      </div>
      <p className="mx-auto mt-6 flex max-w-3xl items-center justify-center gap-2 px-4 text-center text-[13px] leading-relaxed text-white/40">
        <Users className="h-4 w-4 shrink-0" />
        Equipe: Davi (criador), Samuel, Gabriel Batochi, Gabriel dos Santos, Lucas e Jonathan — 3º ano de Desenvolvimento de Sistemas.
      </p>
    </>
  );
}

type PublicProfile = {
  id: string;
  name: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  createdAt: number;
  you: boolean;
  hidden: boolean;
  xp?: number;
  level?: number;
  title?: string;
  levelXp?: number;
  levelNeed?: number;
  dayXp?: number;
  weekXp?: number;
  stats?: XpStats;
  unlocked?: string[];
};

/**
 * Perfil de outra pessoa, aberto pelo ranking.
 *
 * Tudo vem de `GET /api/profile/:id`, que devolve números e apresentação —
 * nunca matérias, conteúdos, tarefas ou conversas. Quem desligou a
 * visibilidade continua tendo nome e foto, só não mostra o progresso.
 */
function PublicProfileView({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [status, setStatus] = useState<"carregando" | "pronto" | "erro">("carregando");
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    const token = readSession().token;
    if (!token) {
      setErro("Entre na sua conta para ver perfis.");
      setStatus("erro");
      return;
    }
    setStatus("carregando");
    // Query em vez de `/api/profile/<id>`: ver a nota em data-server.mjs sobre
    // o catch-all da Vercel não atender caminho com mais de um segmento.
    apiJson<{ profile: PublicProfile }>(`/api/profile?userId=${encodeURIComponent(userId)}`, {
      headers: { authorization: `Bearer ${token}` },
    })
      .then((payload) => {
        if (!vivo) return;
        setProfile(payload.profile);
        setStatus("pronto");
      })
      .catch((error) => {
        if (!vivo) return;
        setErro(error instanceof Error ? error.message : "Não consegui abrir esse perfil.");
        setStatus("erro");
      });
    return () => {
      vivo = false;
    };
  }, [userId]);

  const voltar = (
    <SecondaryButton icon={ChevronLeft} onClick={() => go("ranking")}>
      Voltar ao ranking
    </SecondaryButton>
  );

  if (status === "erro") {
    return (
      <>
        <PageHeader eyebrow="Perfil" title="Perfil" action={voltar} />
        <GlassCard>
          <EmptyState icon={XCircle} title="Não deu para abrir" text={erro} />
        </GlassCard>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <PageHeader eyebrow="Perfil" title="Carregando..." action={voltar} />
        <GlassCard>
          <div className="grid place-items-center gap-3 py-14">
            <Loader2 className="h-8 w-8 animate-spin text-mint" />
          </div>
        </GlassCard>
      </>
    );
  }

  const desde = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(profile.createdAt || Date.now()));
  const stats = profile.stats;
  const conquistas = profile.unlocked?.length || 0;

  return (
    <>
      <PageHeader eyebrow="Perfil" title={profile.displayName} subtitle={`@${profile.name} · na Minerva desde ${desde}`} action={voltar} />

      <div className="grid gap-5">
        <Reveal>
          <HeroCard>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <Avatar name={profile.displayName} src={profile.avatar} size={112} ring />
              <div className="min-w-0 flex-1">
                {profile.hidden ? (
                  <p className="text-[13px] font-bold leading-relaxed text-white/50">
                    {profile.displayName} preferiu não mostrar o progresso. Você ainda pode estudar junto — só não dá para comparar o XP.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill icon={Award}>{profile.title}</Pill>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1 text-[12px] font-black text-white/60">
                        Nível {profile.level}
                      </span>
                      {stats?.streakDays ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-roseGlow/12 px-3 py-1 text-[12px] font-black text-roseGlow">
                          <Flame className="h-3.5 w-3.5" />
                          {stats.streakDays} dias seguidos
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-4 font-display text-[2.6rem] font-black leading-none tabular md:text-5xl">{profile.xp} XP</h2>
                    <p className="mt-2 text-[13px] font-bold text-white/50">
                      {profile.dayXp} XP hoje · {profile.weekXp} XP nesta semana
                    </p>
                    <AnimatedBar value={percent(profile.levelXp || 0, profile.levelNeed || 100)} className="mt-4 max-w-md" height={10} />
                  </>
                )}
                {profile.bio ? <p className="mt-4 border-t border-white/10 pt-4 text-[14px] leading-relaxed text-white/65">{profile.bio}</p> : null}
              </div>
            </div>
          </HeroCard>
        </Reveal>

        {!profile.hidden && stats ? (
          <>
            <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" gap={0.06}>
              <StaggerItem>
                <Metric icon={Timer} value={stats.focus} label="sessões de foco" accent="#38BDF8" />
              </StaggerItem>
              <StaggerItem>
                <Metric icon={ListChecks} value={stats.tasksDone} label="tarefas concluídas" accent="#34D399" />
              </StaggerItem>
              <StaggerItem>
                <Metric icon={Gamepad2} value={stats.games} label="partidas nos jogos" accent="#A78BFA" />
              </StaggerItem>
              <StaggerItem>
                <Metric icon={Trophy} value={`${conquistas}/${achievementList.length}`} label="conquistas" accent="#FBBF24" />
              </StaggerItem>
            </Stagger>

            <Reveal delay={0.06}>
              <GlassCard>
                <SectionTitle icon={Activity} title="Rotina de estudo" hint="números públicos do perfil" />
                <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  {[
                    { label: "Matérias criadas", value: stats.subjects, icon: BookOpen },
                    { label: "Conteúdos guardados", value: stats.materials, icon: FileText },
                    { label: "Conteúdos estudados", value: stats.studied, icon: CheckCircle2 },
                    { label: "Simulados concluídos", value: stats.provas, icon: ClipboardCheck },
                    { label: "Flashcards revisados", value: stats.cardReviews, icon: RefreshCw },
                    { label: "Mensagens para a Mine", value: stats.mineMessages, icon: Bot },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-mint">
                        <item.icon className="h-5 w-5" />
                      </span>
                      <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-white/60">{item.label}</p>
                      <p className="shrink-0 font-display text-lg font-black tabular">{item.value}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </Reveal>

            {conquistas ? (
              <Reveal delay={0.08}>
                <GlassCard>
                  <SectionTitle icon={Trophy} title={`Conquistas (${conquistas}/${achievementList.length})`} />
                  <div className="mt-5 flex flex-wrap gap-2">
                    {achievementList
                      .filter((item) => profile.unlocked?.includes(item.id))
                      .map((item) => {
                        const Icon = achievementIcons[item.id] || Sparkles;
                        return (
                          <span
                            key={item.id}
                            title={item.text}
                            className="inline-flex items-center gap-2 rounded-full border border-mint/25 bg-mint/[0.08] px-3.5 py-2 text-[12px] font-black text-white/75"
                          >
                            <Icon className="h-4 w-4 text-mint" />
                            {item.title}
                          </span>
                        );
                      })}
                  </div>
                </GlassCard>
              </Reveal>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}

function SettingLine({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="depth-panel flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.025] p-3 transition-colors hover:border-white/15">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-mint">
        <Icon className="h-5 w-5" />
      </span>
      <p className="min-w-0 truncate font-black">{label}</p>
    </div>
  );
}