// Carregado sob demanda (React.lazy) para tirar peso do pacote inicial.
import React, { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Atom,
  Award,
  Bell,
  BookOpen,
  Bot,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Calculator,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Circle,
  ClipboardCheck,
  Code2,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Flame,
  FlaskConical,
  Folder,
  GraduationCap,
  Home,
  // `Images` e nao `Image`: o icone `Image` do lucide sombrearia o construtor
  // `new Image()` que este arquivo usa para carregar avatar.
  Images,
  Info,
  Layers,
  LayoutDashboard,
  Link as LinkIcon,
  ListChecks,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  Microscope,
  Moon,
  MoonStar,
  Music,
  Palette,
  Paperclip,
  Plus,
  Search,
  Scale,
  Settings,
  Shield,
  Sparkles,
  Lightbulb,
  Star,
  Sun,
  Target,
  Trash2,
  Users,
  Wand2,
  Zap,
  Loader2,
  RefreshCw,
  X,
  XCircle,
  Brain,
  Dna,
  Download,
  Dumbbell,
  Share2,
  Copy,
  Check,
  Timer,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Minus,
  Coffee,
  ChevronRight,
  MoreHorizontal,
  Rocket,
  Trophy,
  TrendingUp,
  Square,
  Globe,
  HeartPulse,
  Languages,
  Landmark,
  Pencil,
  Gamepad2,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import {
  ActivityChart,
  ConsistencyHeatmap,
  dailySeries,
  focusMinutes,
  humanMinutes,
  MasteryBars,
  SessionMix,
  StatTile,
  type MasteryRow,
} from "../insights";
import {
  AnimatedBar,
  CountUp,
  ease,
  MotionPreference,
  pageVariants,
  ProgressRing,
  Reveal,
  ShineBorder,
  Spotlight,
  SplitWords,
  Stagger,
  StaggerItem,
  Tilt3D,
  spring,
  useQualityTier,
  useScrollProgress,
  useSoftMotion,
} from "../motion";
import { MAX_CHAT_PROMPT_CHARS } from "../../shared/chat-limits.mjs";
import { mergeSeen, noveltyKey, parseSequencePuzzles, pickUnseen, type SequencePuzzle } from "../../shared/game-core.mjs";
import {
  countFromPrompt,
  difficultyFromPrompt,
  flashcardTopicFromPrompt,
  isFlashcardRequest,
  isMindMapRequest,
  isQuizRequest,
  mindMapTopicFromPrompt,
  normalizeIntentText,
  quizTopicFromPrompt,
} from "../../shared/chat-intent.mjs";
import { parseFlashcards, parseQuiz, type QuizQuestion } from "../../shared/study-parsers.mjs";
import { describeImageMarkers, extractSuggestions, splitMessageMedia, stripImageMarkers } from "../../shared/chat-media.mjs";
import { MineRichText } from "../chat/MineRichText";
import { MineImageGallery } from "../chat/MineImageGallery";
import { inThread, threadsOf, type ChatThread } from "../chat/threads";
import {
  Doodle,
  InkCheck,
  cheer,
  InkUnderline,
  MarginDoodles,
  MineBuddy,
  PageTurnShade,
  celebrate,
  celebrateFrom,
  doodleFor,
  floatXp,
  launchPlane,
  mineSays,
  pageFadeVariants,
  pageFlipVariants,
} from "../caderno";
import { PencilTimer } from "../caderno/PencilTimer";
import { InkBarChart, LevelStamp, StickerBook } from "../caderno/Progress";
import { BookshelfPodium } from "../caderno/Bookshelf";
import { MineFace } from "../caderno/MineFace";
import { MineWelcome } from "../caderno/MineWelcome";
import { CadernoSplash } from "../caderno/Splash";
import { LiveMindMap, type MindNode } from "../caderno/LiveMindMap";
import { LoginScreen } from "../caderno/Login";
import {
  achievementList,
  gameXpFromCorrectAnswers,
  gamificationStats as scopeStats,
  levelFromXp,
  levelTitles,
  streakDays,
  totalXp,
  unlockedAchievements,
  xpActions,
  xpPerAction,
  type AchievementRule,
  type XpStats,
} from "../../shared/xp.mjs";
import {
  currentSeason,
  dailyChallengeKey,
  dailyChallengeQuestions,
  dailyMissionProgress,
  gameAchievementRules,
  gameNames,
  leagueFromPoints,
  seasonPoints,
  unlockedGameAchievementIds,
  unresolvedGameErrors,
  type GameAnswer,
} from "../../shared/game-meta.mjs";
import {
  AppData,
  BrandMark,
  ChatAttachments,
  ChatMessage,
  Material,
  Modal,
  SiteComment,
  SiteSuggestion,
  Subject,
  SyncStatus,
  Task,
  UpdateCategory,
  User,
  fallbackUser,
  go,
  materialTypeLabel,
  normalizeText,
  percent,
  shortDate,
  suggestionCategories,
  suggestionStatusLabel,
  suggestionStatusOrder,
  today,
  uid,
  updateCategoryMeta
} from "../main";

export function adminDisplayName(user: User) {
  if (user.settings.displayName?.trim()) return user.settings.displayName.trim();
  if (user.name.includes("@")) return user.name.split("@")[0] || "Usuário";
  return user.name || "Usuário";
}

export function adminContact(user: User) {
  return user.name.includes("@") ? user.name : "E-mail não informado";
}

export function adminDateTime(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function userLastActivity(data: AppData, user: User) {
  const timestamps = [
    user.createdAt,
    ...data.subjects.filter((item) => item.userId === user.id).map((item) => item.createdAt),
    ...data.materials.filter((item) => item.userId === user.id).map((item) => item.createdAt),
    ...data.tasks.filter((item) => item.userId === user.id).map((item) => item.createdAt),
    ...data.chats.filter((item) => item.userId === user.id).map((item) => item.createdAt),
    ...data.sessions.filter((item) => item.userId === user.id).map((item) => item.createdAt),
  ];
  return Math.max(...timestamps);
}

export type AdminV2Section = "overview" | "clients" | "mine" | "comments" | "updates" | "suggestions" | "content" | "tasks" | "system";
export type AdminV2ClientScope = "all" | string;

export type AdminV2ChatUser = {
  user: User;
  chats: ChatMessage[];
  clientMessages: number;
  mineMessages: number;
  lastAt: number;
};

export type AdminV2NavGroup = "Operação" | "Comunidade" | "Organização" | "Plataforma";

export const adminV2NavItems: Array<{ id: AdminV2Section; label: string; icon: LucideIcon; group: AdminV2NavGroup }> = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard, group: "Operação" },
  { id: "clients", label: "Clientes", icon: Users, group: "Operação" },
  { id: "mine", label: "Conversas", icon: MessageCircle, group: "Operação" },
  { id: "comments", label: "Comentários", icon: Star, group: "Comunidade" },
  { id: "updates", label: "Novidades", icon: Bell, group: "Comunidade" },
  { id: "suggestions", label: "Sugestões", icon: Sparkles, group: "Comunidade" },
  { id: "content", label: "Conteúdos", icon: Folder, group: "Organização" },
  { id: "tasks", label: "Tarefas", icon: CalendarCheck, group: "Organização" },
  { id: "system", label: "Sistema", icon: Shield, group: "Plataforma" },
];

export const adminV2NavGroups: AdminV2NavGroup[] = ["Operação", "Comunidade", "Organização", "Plataforma"];

export const adminV2Copy: Record<AdminV2Section, { title: string; description: string }> = {
  clients: {
    title: "Clientes",
    description: "Dados reais de cada conta: estudos, tarefas, conteúdos e uso da Mine.",
  },
  overview: {
    title: "Visão geral",
    description: "Últimos movimentos registrados pelas contas no site.",
  },
  content: {
    title: "Conteúdos",
    description: "Matérias, arquivos, links, imagens e anotações cadastradas pelos clientes.",
  },
  tasks: {
    title: "Tarefas",
    description: "Prazos, pendências e tarefas concluídas pelos clientes.",
  },
  mine: {
    title: "Conversas",
    description: "Uso da Mine nas conversas, revisões e planos dos clientes.",
  },
  comments: {
    title: "Comentários",
    description: "Avaliações e opiniões deixadas pelos clientes sobre o site.",
  },
  updates: {
    title: "Novidades",
    description: "Publique atualizações do site que aparecem na aba Atualizações dos clientes.",
  },
  suggestions: {
    title: "Sugestões",
    description: "Ideias enviadas pelos clientes. Defina o status e remova o que não fizer sentido.",
  },
  system: {
    title: "Sistema",
    description: "Estado da plataforma, banco de dados e volume de registros.",
  },
};

export function AdminView({
  data,
  syncStatus,
  databaseMode,
  section: routeSection,
  currentUserId,
  onDeleteUser,
  onDeleteComment,
  update,
  notify,
  setModal,
}: {
  data: AppData;
  syncStatus: SyncStatus;
  databaseMode: string;
  section?: string;
  currentUserId: string;
  onDeleteUser: (target: User) => void;
  onDeleteComment: (comment: SiteComment) => void;
  update: (next: (draft: AppData) => AppData) => void;
  notify: (message: string) => void;
  setModal: (modal: Modal | null) => void;
}) {
  const section: AdminV2Section = adminV2NavItems.some((item) => item.id === routeSection) ? (routeSection as AdminV2Section) : "overview";
  const setSection = (next: AdminV2Section) => go("admin", next);
  const [selectedClientId, setSelectedClientId] = useState<AdminV2ClientScope>("all");
  const reduceAdminMotion = useReducedMotion();
  const sortedUsers = data.users.slice().sort((a, b) => b.createdAt - a.createdAt);
  const currentAdmin = data.users.find((user) => user.id === data.currentAdminUserId) || data.users.find((user) => user.id === data.currentUserId && user.isAdmin);
  const activeCopy = adminV2Copy[section];
  const selectedClient = selectedClientId === "all" ? null : sortedUsers.find((user) => user.id === selectedClientId) || null;
  const scopeId: AdminV2ClientScope = selectedClient ? selectedClientId : "all";
  const stats = getAdminStats(data, scopeId);
  const navCounts: Partial<Record<AdminV2Section, number>> = {
    clients: data.users.length,
    mine: new Set(data.chats.map((chat) => chat.userId)).size,
    comments: data.comments.length,
    updates: data.updates.length,
    suggestions: data.suggestions.filter((item) => item.status === "nova").length,
    content: data.materials.length,
    tasks: data.tasks.filter((task) => !task.done).length,
  };

  return (
    <section className="admin-control-room min-h-screen text-[rgb(var(--theme-text))]">
      <div className="admin-shell-grid relative z-[1] grid min-h-screen lg:grid-cols-[276px_minmax(0,1fr)]">
        <aside className="admin-sidebar sticky top-0 z-40 flex min-w-0 flex-col px-3 py-3 text-white lg:h-screen lg:overflow-y-auto lg:px-4 lg:py-5">
          <div aria-hidden="true" className="admin-sidebar-atmosphere" />

          <div className="admin-brand-row relative z-[1] flex items-center justify-between gap-3">
            <button type="button" onClick={() => go("home")} className="group flex min-w-0 items-center gap-3 rounded-2xl text-left focus-visible:outline-white lg:gap-4">
              <span className="admin-brand-seal grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-panel p-1.5 lg:h-14 lg:w-14">
                <BrandMark label="Minerva" className="brand-mark-admin relative z-[1] h-full w-full" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-lg font-black leading-tight tracking-[-.03em] lg:text-xl">MINERVA</span>
                <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-[.15em] text-white/66">Central acadêmica</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => go("home")}
              aria-label="Voltar ao aplicativo"
              className="admin-mobile-exit grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/[0.12] bg-white/[0.06] text-white/80 transition-control hover:bg-white/[0.12] hover:text-white lg:hidden"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>

          <nav aria-label="Áreas administrativas" className="admin-nav relative z-[1] mt-3 lg:mt-7">
            {adminV2NavGroups.map((group) => (
              <div key={group} className="admin-nav-group">
                <p className="admin-nav-group-label">{group}</p>
                <div className="admin-nav-group-list">
                  {adminV2NavItems.filter((item) => item.group === group).map((item) => (
                    <AdminV2NavButton key={item.id} item={item} active={section === item.id} badge={navCounts[item.id]} onClick={() => setSection(item.id)} />
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="admin-sidebar-footer relative z-[1] mt-auto hidden lg:block">
            <div className="mb-3 flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[.13em] text-white/58">
              <span>Ambiente seguro</span>
              <span className={`h-2 w-2 rounded-full ${syncStatus === "online" ? "bg-emerald-300 shadow-[0_0_0_4px_rgba(110,231,183,.12)]" : syncStatus === "salvando" ? "bg-lime-300" : "bg-amber-300"}`} />
            </div>
            <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.065] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.12] text-sm font-black text-white">
                  {(currentAdmin ? adminDisplayName(currentAdmin) : "A").slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[.15em] text-white/54">Administrador</p>
                  <p className="mt-1 truncate text-sm font-bold text-white/92">{currentAdmin ? adminDisplayName(currentAdmin) : "Conta administrativa"}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => go("home")}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-black text-white/76 transition-control hover:border-white/20 hover:bg-white/[0.09] hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
                Voltar ao app
              </button>
            </div>
          </div>
        </aside>

        <main className="admin-main min-w-0 px-4 pb-10 pt-5 sm:px-6 md:px-8 md:pb-14 md:pt-8 xl:px-10 2xl:px-14">
          <div className="admin-main-inner mx-auto w-full max-w-[1540px]">
            <header className="admin-hero grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="admin-kicker inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[.18em]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Central de operações
                  </span>
                  <span className="text-xs font-bold text-[rgb(var(--theme-muted))]">/ {activeCopy.title}</span>
                </div>
                <h1 className="mt-3 max-w-4xl font-display text-[clamp(2.45rem,5vw,4.9rem)] font-black leading-[.92] tracking-[-.055em] text-[rgb(var(--theme-text))]">{activeCopy.title}</h1>
                <p className="mt-3 max-w-3xl text-[clamp(.95rem,1.35vw,1.1rem)] font-medium leading-relaxed text-[rgb(var(--theme-muted))]">{activeCopy.description}</p>
              </div>
              <AdminV2SystemStatus syncStatus={syncStatus} databaseMode={databaseMode} totalRecords={stats.totalRecords} />
            </header>

            <div className="admin-stats-grid mt-6 grid grid-cols-2 gap-3 md:mt-8 md:gap-4 xl:grid-cols-4">
              <AdminV2StatCard icon={Users} title="Clientes" value={stats.totalUsers} detail={`${stats.adminUsers} ${stats.adminUsers === 1 ? "administrador" : "administradores"}`} onClick={() => setSection("clients")} />
              <AdminV2StatCard icon={Activity} title="Ativos na semana" value={stats.activeThisWeek} detail="Com atividade nos últimos 7 dias" onClick={() => setSection("overview")} />
              <AdminV2StatCard icon={FileText} title="Conteúdos" value={stats.contentCount} detail={`${stats.subjectCount} ${stats.subjectCount === 1 ? "matéria cadastrada" : "matérias cadastradas"}`} onClick={() => setSection("content")} />
              <AdminV2StatCard icon={ListChecks} title="Tarefas abertas" value={stats.openTasks} detail={`${stats.doneTasks} ${stats.doneTasks === 1 ? "concluída" : "concluídas"}`} onClick={() => setSection("tasks")} />
            </div>

            <AdminV2ClientScopeBar users={sortedUsers} selectedClientId={scopeId} selectedClient={selectedClient} onSelect={setSelectedClientId} />

            <motion.div
              key={section}
              initial={reduceAdminMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceAdminMotion ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="admin-section-stage mt-6 md:mt-8"
            >
              <AdminV2SectionContent
                section={section}
                users={sortedUsers}
                data={data}
                syncStatus={syncStatus}
                databaseMode={databaseMode}
                selectedClientId={scopeId}
                onSelectClient={setSelectedClientId}
                currentUserId={currentUserId}
                onDeleteUser={onDeleteUser}
                onDeleteComment={onDeleteComment}
                update={update}
                notify={notify}
                setModal={setModal}
                onOpenMineConversation={(userId) => {
                  setSelectedClientId(userId);
                  setSection("mine");
                }}
              />
            </motion.div>
          </div>
        </main>
      </div>
    </section>
  );
}

export function AdminV2SystemStatus({ syncStatus, databaseMode, totalRecords }: { syncStatus: SyncStatus; databaseMode: string; totalRecords: number }) {
  const online = syncStatus === "online";
  const saving = syncStatus === "salvando";
  return (
    <div className="admin-system-status min-w-[min(100%,18rem)] rounded-[1.25rem] border border-line bg-panel/80 p-3 shadow-[0_20px_55px_-38px_rgba(18,61,45,.5)] sm:min-w-[18rem] sm:p-4">
      <div className="flex items-center gap-3">
        <span className="admin-system-orbit relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-panel2 text-pen">
          <Activity className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[rgb(var(--theme-muted))]">Estado do sistema</p>
            <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : saving ? "bg-lime-500" : "bg-amber-500"}`} />
          </div>
          <p className="mt-1 font-display text-base font-black text-[rgb(var(--theme-text))]">{saving ? "Sincronizando dados" : online ? "Operação estável" : "Conexão limitada"}</p>
          <p className="mt-0.5 text-xs font-bold text-[rgb(var(--theme-muted))]">{databaseMode === "postgres" ? "Postgres" : "Dados locais"} · {totalRecords} registros</p>
        </div>
      </div>
    </div>
  );
}

export function AdminV2NavButton({
  item,
  active,
  badge,
  onClick,
}: {
  item: { id: AdminV2Section; label: string; icon: LucideIcon; group: AdminV2NavGroup };
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      data-active={active ? "true" : "false"}
      className={`admin-nav-button relative flex min-h-11 min-w-28 shrink-0 items-center justify-center rounded-xl px-3 py-2.5 text-center text-xs font-black transition-control lg:w-full lg:min-w-0 lg:justify-start lg:px-3 lg:text-left lg:text-sm ${active ? "text-pen" : "text-white/72 hover:bg-white/[0.065] hover:text-white"}`}
    >
      {active ? (
        <motion.span
          layoutId="admin-active-nav"
          aria-hidden="true"
          className="admin-nav-active-pill absolute inset-0 rounded-xl bg-panel2 shadow-[0_10px_28px_-16px_rgba(5,74,51,.75)]"
          transition={{ type: "spring", stiffness: 440, damping: 36 }}
        />
      ) : null}
      <span className="relative z-[1] flex min-w-0 items-center gap-2.5 lg:w-full">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${active ? "bg-panel/80 text-pen shadow-sm" : "bg-white/[0.055] text-white/82"}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="whitespace-nowrap">{item.label}</span>
        {typeof badge === "number" ? (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black lg:ml-auto ${active ? "bg-hlMint/45 text-pen" : "bg-white/[0.09] text-white/68"}`}>
            {badge}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function AdminV2StatCard({ icon: Icon, title, value, detail, onClick }: { icon: LucideIcon; title: string; value: number | string; detail: string; onClick?: () => void }) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`admin-stat-card admin-motion-card rounded-[1.25rem] border border-line bg-panel p-4 text-left shadow-[0_18px_48px_-36px_rgba(10,66,46,.5)] md:p-5 ${
        onClick ? "transition-control hover:border-pen/50" : ""
      }`}
    >
      <div className="relative z-[1] flex items-center justify-between gap-3 md:gap-4">
        <p className="text-[11px] font-black uppercase tracking-[.12em] text-[rgb(var(--theme-muted))] md:text-xs">{title}</p>
        <span className="admin-stat-icon grid h-9 w-9 place-items-center rounded-xl bg-panel2 text-pen md:h-10 md:w-10">
          <Icon className="h-4 w-4 md:h-5 md:w-5" />
        </span>
      </div>
      <p className="relative z-[1] mt-4 font-display text-3xl font-black tracking-[-.05em] text-[rgb(var(--theme-text))] md:text-[2.65rem]">{value}</p>
      <p className="relative z-[1] mt-1 text-xs font-bold leading-relaxed text-[rgb(var(--theme-muted))] md:text-[13px]">{detail}</p>
    </Wrapper>
  );
}

export function AdminV2ClientScopeBar({
  users,
  selectedClientId,
  selectedClient,
  onSelect,
}: {
  users: User[];
  selectedClientId: AdminV2ClientScope;
  selectedClient: User | null;
  onSelect: (userId: AdminV2ClientScope) => void;
}) {
  const [query, setQuery] = useState("");
  const needle = normalizeText(query);
  const results = needle
    ? users.filter((user) => normalizeText(`${adminDisplayName(user)} ${user.name}`).includes(needle)).slice(0, 8)
    : [];
  return (
    <section className="admin-scope-bar relative mt-4 rounded-[1.25rem] border border-line bg-panel/78 p-3 shadow-[0_18px_50px_-40px_rgba(18,61,45,.55)] md:mt-5 md:p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl bg-panel2 text-pen sm:grid">
            <Target className="h-4 w-4" />
          </span>
          <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.17em] text-pen">Recorte de análise</p>
          <p className="mt-1 text-sm font-bold leading-relaxed text-[rgb(var(--theme-muted))]">
            {selectedClient ? `Mostrando dados de ${adminDisplayName(selectedClient)}.` : "Mostrando todos os clientes. Busque uma conta para detalhar o painel."}
          </p>
          </div>
        </div>
        <div className="admin-scope-controls relative flex w-full flex-col gap-2 xl:w-auto xl:min-w-[440px]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSelect("all")}
              className={`min-h-11 shrink-0 rounded-xl border px-4 py-2 text-sm font-black transition-control ${
                selectedClientId === "all" ? "border-pen/60 bg-panel2 text-pen shadow-[inset_0_0_0_1px_rgba(34,197,94,.08)]" : "border-line bg-panel text-[rgb(var(--theme-muted))] hover:border-pen/50 hover:bg-hlYellow/30"
              }`}
            >
              Todos
            </button>
            {selectedClient ? (
              <span className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-pen/60 bg-panel2 py-1.5 pl-3 pr-1.5 text-sm font-black text-pen">
                <span className="max-w-40 truncate">{adminDisplayName(selectedClient)}</span>
                <button
                  type="button"
                  onClick={() => onSelect("all")}
                  aria-label={`Remover filtro de ${adminDisplayName(selectedClient)}`}
                  className="grid h-7 w-7 place-items-center rounded-lg text-pen/70 transition-control hover:bg-pen/10 hover:text-pen"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : null}
            <div className="relative min-w-44 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--theme-muted))]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar cliente..."
                aria-label="Buscar cliente"
                className="min-h-11 w-full rounded-xl border border-line bg-panel py-2 pl-10 pr-3 text-sm font-bold text-[rgb(var(--theme-text))] outline-none transition-control placeholder:font-medium placeholder:text-[rgb(var(--theme-muted))] focus:border-pen/60 focus:shadow-[0_0_0_4px_rgba(29,153,94,.09)]"
              />
            </div>
          </div>
          {needle ? (
            results.length ? (
              <div className="admin-scope-results absolute inset-x-0 top-[calc(100%+.45rem)] z-30 grid gap-1 rounded-2xl border border-line bg-panel p-1.5 shadow-[0_24px_65px_-28px_rgba(16,53,40,.42)]">
                {results.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      onSelect(user.id);
                      setQuery("");
                    }}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-black text-[rgb(var(--theme-text))] transition-control hover:bg-hlYellow/30"
                  >
                    <span className="min-w-0 truncate">{adminDisplayName(user)}</span>
                    <span className="hidden shrink-0 text-xs font-bold text-[rgb(var(--theme-muted))] sm:inline">{adminContact(user)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="admin-scope-results absolute inset-x-0 top-[calc(100%+.45rem)] z-30 rounded-2xl border border-line bg-panel px-4 py-3 text-sm font-bold text-[rgb(var(--theme-muted))] shadow-[0_24px_65px_-28px_rgba(16,53,40,.42)]">Nenhum cliente encontrado.</p>
            )
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function AdminV2SectionContent({
  section,
  users,
  data,
  syncStatus,
  databaseMode,
  selectedClientId,
  onSelectClient,
  currentUserId,
  onDeleteUser,
  onDeleteComment,
  update,
  notify,
  setModal,
  onOpenMineConversation,
}: {
  section: AdminV2Section;
  users: User[];
  data: AppData;
  syncStatus: SyncStatus;
  databaseMode: string;
  selectedClientId: AdminV2ClientScope;
  onSelectClient: (userId: AdminV2ClientScope) => void;
  currentUserId: string;
  onDeleteUser: (target: User) => void;
  onDeleteComment: (comment: SiteComment) => void;
  update: (next: (draft: AppData) => AppData) => void;
  notify: (message: string) => void;
  setModal: (modal: Modal | null) => void;
  onOpenMineConversation: (userId: string) => void;
}) {
  if (section === "clients")
    return (
      <AdminV2ClientsPanel
        users={users}
        data={data}
        selectedClientId={selectedClientId}
        onSelectClient={onSelectClient}
        currentUserId={currentUserId}
        onDeleteUser={onDeleteUser}
      />
    );
  if (section === "comments") return <AdminV2CommentsPanel data={data} selectedClientId={selectedClientId} onSelectClient={onSelectClient} onDeleteComment={onDeleteComment} />;
  if (section === "updates") return <AdminV2UpdatesPanel data={data} update={update} notify={notify} setModal={setModal} />;
  if (section === "suggestions") return <AdminV2SuggestionsPanel data={data} selectedClientId={selectedClientId} onSelectClient={onSelectClient} update={update} notify={notify} setModal={setModal} />;
  if (section === "overview") return <AdminV2OverviewPanel data={data} selectedClientId={selectedClientId} onSelectClient={onSelectClient} onOpenMineConversation={onOpenMineConversation} />;
  if (section === "content") return <AdminV2ContentPanel data={data} selectedClientId={selectedClientId} onSelectClient={onSelectClient} />;
  if (section === "tasks") return <AdminV2TasksPanel data={data} selectedClientId={selectedClientId} />;
  if (section === "mine") return <AdminV2MinePanel data={data} selectedClientId={selectedClientId} onSelectClient={onSelectClient} />;
  return <AdminV2SystemPanel data={data} syncStatus={syncStatus} databaseMode={databaseMode} selectedClientId={selectedClientId} />;
}

export function AdminV2PanelCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`admin-panel-card admin-motion-card rounded-[1.35rem] border border-line bg-panel/90 p-4 shadow-[0_22px_62px_-46px_rgba(12,57,42,.58)] md:p-5 ${className}`}>
      {children}
    </section>
  );
}

export function AdminV2PanelTitle({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="admin-panel-title mb-4 flex items-start gap-3 md:mb-5 md:gap-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-panel2 text-pen md:h-11 md:w-11">
        <Icon className="h-4 w-4 md:h-5 md:w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-xl font-black tracking-[-.025em] text-[rgb(var(--theme-text))] md:text-2xl">{title}</h2>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-[rgb(var(--theme-muted))]">{text}</p>
      </div>
    </div>
  );
}

export function AdminV2ClientsPanel({
  users,
  data,
  selectedClientId,
  onSelectClient,
  currentUserId,
  onDeleteUser,
}: {
  users: User[];
  data: AppData;
  selectedClientId: AdminV2ClientScope;
  onSelectClient: (userId: AdminV2ClientScope) => void;
  currentUserId: string;
  onDeleteUser: (target: User) => void;
}) {
  return (
    <AdminV2PanelCard className="overflow-hidden p-0">
      <div className="p-4 md:p-5">
        <AdminV2PanelTitle icon={Users} title="Clientes cadastrados" text="Cada linha mostra a situação real da conta dentro da Minerva." />
      </div>
      <div className="grid gap-3 px-4 pb-4 md:hidden">
        {users.map((user) => (
          <div key={user.id} className="grid gap-1">
            <AdminV2ClientCard user={user} data={data} active={selectedClientId === user.id} onSelect={() => onSelectClient(user.id)} />
            {user.id !== currentUserId ? (
              <button
                type="button"
                onClick={() => onDeleteUser(user)}
                className="inline-flex items-center gap-1.5 justify-self-end rounded-lg px-2.5 py-1.5 text-xs font-black text-red-600/75 transition hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir conta
              </button>
            ) : null}
          </div>
        ))}
        {!users.length ? <AdminV2Empty text="Nenhuma conta cadastrada ainda." /> : null}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1120px] border-collapse text-left">
          <thead className="bg-hlMint/45 text-xs font-black uppercase text-[rgb(var(--theme-text))]">
            <tr>
              <th className="px-5 py-4">Cliente</th>
              <th className="px-5 py-4">Conta</th>
              <th className="px-5 py-4">Estudos</th>
              <th className="px-5 py-4">Tarefas</th>
              <th className="px-5 py-4">Mine</th>
              <th className="px-5 py-4">Última atividade</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-[rgb(var(--theme-text))]">
            {users.map((user) => {
              const metrics = clientMetrics(data, user);
              const status = adminClientStatus(user, metrics);
              return (
                <tr
                  key={user.id}
                  onClick={() => onSelectClient(user.id)}
                  className={`cursor-pointer transition ${selectedClientId === user.id ? "bg-hlMint/45" : "hover:bg-hlYellow/30"}`}
                >
                  <td className="px-5 py-5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-hlMint/45 font-black text-pen">
                        {adminDisplayName(user).slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-[rgb(var(--theme-text))]">{adminDisplayName(user)}</span>
                          {user.isAdmin ? <AdminV2Badge tone="dark" label="ADMIN" icon={Shield} /> : null}
                        </div>
                        <p className="mt-1 text-xs font-bold text-[rgb(var(--theme-muted))]">ID {user.id.slice(-8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-pen" />
                        <span className="font-bold text-[rgb(var(--theme-muted))]">{adminContact(user)}</span>
                      </div>
                      <p className="text-xs font-bold text-[rgb(var(--theme-muted))]">Criado em {adminDateTime(user.createdAt)}</p>
                    </div>
                  </td>
                  <td className="px-5 py-5">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <AdminV2MetricPill label={`${metrics.subjectCount} matérias`} />
                        <AdminV2MetricPill label={`${metrics.contentCount} conteúdos`} />
                      </div>
                      <div className="mt-3 h-2 w-44 overflow-hidden rounded-full bg-panel2">
                        <div className="h-full rounded-full bg-pen" style={{ width: `${metrics.completion}%` }} />
                      </div>
                      <p className="mt-1 text-xs font-black text-[rgb(var(--theme-muted))]">{metrics.completion}% estudado</p>
                    </div>
                  </td>
                  <td className="px-5 py-5">
                    <div className="flex flex-wrap gap-2">
                      <AdminV2MetricPill label={`${metrics.openTasks} abertas`} />
                      <AdminV2MetricPill label={`${metrics.doneTasks} concluídas`} />
                    </div>
                  </td>
                  <td className="px-5 py-5">
                    <span className="font-display text-2xl font-black text-pen">{metrics.mineMessages}</span>
                    <p className="text-xs font-bold text-[rgb(var(--theme-muted))]">respostas</p>
                  </td>
                  <td className="px-5 py-5">{adminDateTime(metrics.lastActivity)}</td>
                  <td className="px-5 py-5">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-black ${status.className}`}>{status.label}</span>
                  </td>
                  <td className="px-5 py-5 text-right">
                    <button
                      type="button"
                      disabled={user.id === currentUserId}
                      title={user.id === currentUserId ? "Você não pode excluir a conta que está usando" : `Excluir a conta de ${adminDisplayName(user)}`}
                      aria-label={`Excluir a conta de ${adminDisplayName(user)}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteUser(user);
                      }}
                      className="inline-grid h-10 w-10 place-items-center rounded-lg text-red-600/70 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:text-red-600/25 disabled:hover:bg-transparent"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {!users.length ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center font-bold text-[rgb(var(--theme-muted))]">
                  Nenhuma conta cadastrada ainda.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AdminV2PanelCard>
  );
}

export function AdminV2ClientCard({ user, data, active = false, onSelect }: { user: User; data: AppData; active?: boolean; onSelect?: () => void }) {
  const metrics = clientMetrics(data, user);
  const status = adminClientStatus(user, metrics);
  const Element = onSelect ? "button" : "article";

  return (
    <Element type={onSelect ? "button" : undefined} onClick={onSelect} className={`admin-client-card admin-motion-card w-full rounded-2xl border p-4 text-left transition-control ${active ? "border-pen/60 bg-panel2 shadow-[0_14px_36px_-28px_rgba(13,109,70,.55)]" : "border-line bg-sheet hover:border-pen/50"}`}>
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-hlMint/45 font-black text-pen">
          {adminDisplayName(user).slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words font-black text-[rgb(var(--theme-text))]">{adminDisplayName(user)}</h3>
            {user.isAdmin ? <AdminV2Badge tone="dark" label="ADMIN" icon={Shield} /> : null}
          </div>
          <p className="mt-1 break-all text-sm font-bold text-[rgb(var(--theme-muted))]">{adminContact(user)}</p>
          <p className="mt-1 text-xs font-bold text-[rgb(var(--theme-muted))]">Criado em {shortDate(user.createdAt)} · ID {user.id.slice(-8)}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black text-pen">
        <div className="rounded-lg bg-hlMint/45 px-3 py-2">{metrics.subjectCount} matérias</div>
        <div className="rounded-lg bg-hlMint/45 px-3 py-2">{metrics.contentCount} conteúdos</div>
        <div className="rounded-lg bg-hlMint/45 px-3 py-2">{metrics.openTasks} abertas</div>
        <div className="rounded-lg bg-hlMint/45 px-3 py-2">{metrics.doneTasks} concluídas</div>
      </div>

      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-panel2">
          <div className="h-full rounded-full bg-pen" style={{ width: `${metrics.completion}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-black text-[rgb(var(--theme-muted))]">{metrics.completion}% estudado</p>
          <p className="text-xs font-bold text-[rgb(var(--theme-muted))]">{metrics.mineMessages} respostas da Mine</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${status.className}`}>{status.label}</span>
        <span className="text-xs font-black text-[rgb(var(--theme-muted))]">Última atividade: {shortDate(metrics.lastActivity)}</span>
      </div>
    </Element>
  );
}

export function AdminV2UpdatesPanel({
  data,
  update,
  notify,
  setModal,
}: {
  data: AppData;
  update: (next: (draft: AppData) => AppData) => void;
  notify: (message: string) => void;
  setModal: (modal: Modal | null) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<UpdateCategory>("novidade");
  const updates = [...data.updates].sort((a, b) => b.createdAt - a.createdAt);

  function publish(event: FormEvent) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) return;
    update((draft) => ({
      ...draft,
      updates: [...draft.updates, { id: uid("update"), title: cleanTitle.slice(0, 120), body: cleanBody.slice(0, 800), category, createdAt: Date.now() }],
    }));
    setTitle("");
    setBody("");
    setCategory("novidade");
    notify("Novidade publicada para os clientes.");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <AdminV2PanelCard>
        <AdminV2PanelTitle icon={Bell} title="Publicar novidade" text="Aparece no topo da aba Atualizações de todos os clientes." />
        <form onSubmit={publish} className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-black text-pen">Tipo</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(updateCategoryMeta) as UpdateCategory[]).map((key) => {
                const meta = updateCategoryMeta[key];
                const active = category === key;
                const Icon = meta.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-black transition ${
                      active ? "border-pen/60 bg-hlMint/45 text-pen" : "border-line bg-sheet text-[rgb(var(--theme-muted))] hover:border-pen/50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block">
            <span className="text-sm font-black text-pen">Título</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value.slice(0, 120))}
              placeholder="Ex: Mapa mental agora com arrastar e ajustar"
              className="mt-2 w-full rounded-lg border border-line bg-sheet p-3 text-sm font-black text-[rgb(var(--theme-text))] outline-none transition placeholder:font-bold placeholder:text-[rgb(var(--theme-muted))] focus:border-pen/60"
            />
          </label>
          <label className="block">
            <span className="text-sm font-black text-pen">Descrição</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value.slice(0, 800))}
              rows={5}
              placeholder="Conte o que mudou e como isso ajuda quem estuda."
              className="mt-2 w-full resize-none rounded-lg border border-line bg-sheet p-3 text-sm font-bold leading-6 text-[rgb(var(--theme-text))] outline-none transition placeholder:text-[rgb(var(--theme-muted))] focus:border-pen/60"
            />
            <span className="mt-1 block text-right text-xs font-bold text-[rgb(var(--theme-muted))]">{body.length}/800</span>
          </label>
          <button
            type="submit"
            disabled={!title.trim() || !body.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-pen px-5 py-3 text-sm font-black text-white transition hover:bg-pen/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Bell className="h-4 w-4" />
            Publicar novidade
          </button>
        </form>
      </AdminV2PanelCard>

      <AdminV2PanelCard>
        <AdminV2PanelTitle icon={CalendarCheck} title={`Publicadas (${updates.length})`} text="As mais recentes aparecem primeiro para os clientes." />
        <div className="grid gap-3">
          {updates.map((item) => {
            const meta = updateCategoryMeta[item.category] || updateCategoryMeta.novidade;
            const Icon = meta.icon;
            return (
              <article key={item.id} className="rounded-lg border border-line bg-sheet p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-hlMint/45 text-pen">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-hlMint/45 px-2 py-0.5 text-[10px] font-black uppercase text-pen">{meta.label}</span>
                      <span className="text-xs font-bold text-[rgb(var(--theme-muted))]">{adminDateTime(item.createdAt)}</span>
                    </div>
                    <h3 className="mt-1.5 font-black text-[rgb(var(--theme-text))]">{item.title}</h3>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-[rgb(var(--theme-muted))]">{item.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setModal({
                        type: "confirm",
                        title: "Excluir esta novidade?",
                        body: "Ela deixará de aparecer na aba Atualizações dos clientes.",
                        onConfirm: () => {
                          update((draft) => ({ ...draft, updates: draft.updates.filter((entry) => entry.id !== item.id) }));
                          notify("Novidade removida.");
                        },
                      })
                    }
                    aria-label={`Excluir novidade ${item.title}`}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-red-600/70 transition hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </article>
            );
          })}
          {!updates.length ? <AdminV2Empty text="Nenhuma novidade publicada ainda. Use o formulário ao lado." /> : null}
        </div>
      </AdminV2PanelCard>
    </div>
  );
}

export const adminSuggestionStatuses: Array<{ id: SiteSuggestion["status"]; label: string }> = [
  { id: "nova", label: "Recebida" },
  { id: "analisando", label: "Em análise" },
  { id: "planejada", label: "Planejada" },
  { id: "concluida", label: "Concluída" },
  { id: "recusada", label: "Não entrou" },
];

export function AdminV2SuggestionsPanel({
  data,
  selectedClientId,
  onSelectClient,
  update,
  notify,
  setModal,
}: {
  data: AppData;
  selectedClientId: AdminV2ClientScope;
  onSelectClient: (userId: AdminV2ClientScope) => void;
  update: (next: (draft: AppData) => AppData) => void;
  notify: (message: string) => void;
  setModal: (modal: Modal | null) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<SiteSuggestion["status"] | "todas">("todas");
  const suggestions = data.suggestions
    .filter((item) => selectedClientId === "all" || item.userId === selectedClientId)
    .filter((item) => statusFilter === "todas" || item.status === statusFilter)
    .sort((a, b) => suggestionStatusOrder.indexOf(a.status) - suggestionStatusOrder.indexOf(b.status) || b.createdAt - a.createdAt);

  function setStatus(id: string, status: SiteSuggestion["status"]) {
    update((draft) => ({ ...draft, suggestions: draft.suggestions.map((item) => (item.id === id ? { ...item, status } : item)) }));
    notify(`Sugestão marcada como "${suggestionStatusLabel(status)}".`);
  }

  return (
    <AdminV2PanelCard>
      <AdminV2PanelTitle icon={Sparkles} title="Sugestões dos clientes" text="Defina o status de cada ideia. O cliente vê o status na aba Atualizações." />
      <div className="mb-4 flex flex-wrap gap-2">
        {(["todas", ...suggestionStatusOrder] as const).map((key) => {
          const active = statusFilter === key;
          const count = key === "todas" ? data.suggestions.length : data.suggestions.filter((item) => item.status === key).length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              aria-pressed={active}
              className={`rounded-lg border px-3 py-1.5 text-xs font-black transition ${
                active ? "border-pen/60 bg-hlMint/45 text-pen" : "border-line bg-sheet text-[rgb(var(--theme-muted))] hover:border-pen/50"
              }`}
            >
              {key === "todas" ? "Todas" : suggestionStatusLabel(key)} ({count})
            </button>
          );
        })}
      </div>
      <div className="grid gap-3">
        {suggestions.map((suggestion) => {
          const author = data.users.find((item) => item.id === suggestion.userId);
          const categoryInfo = suggestionCategories.find((item) => item.id === suggestion.category) || suggestionCategories[0];
          return (
            <article key={suggestion.id} className="rounded-lg border border-line bg-sheet p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-hlMint/45 text-pen">
                  <categoryInfo.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-hlMint/45 px-2 py-0.5 text-[10px] font-black uppercase text-pen">{categoryInfo.label}</span>
                    {author ? (
                      <button type="button" onClick={() => onSelectClient(author.id)} className="text-xs font-black text-[rgb(var(--theme-text))] underline-offset-4 transition hover:text-pen hover:underline">
                        {suggestion.name}
                      </button>
                    ) : (
                      <span className="text-xs font-black text-[rgb(var(--theme-text))]">{suggestion.name}</span>
                    )}
                    <span className="text-xs font-bold text-[rgb(var(--theme-muted))]">{adminDateTime(suggestion.createdAt)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[rgb(var(--theme-muted))]">{suggestion.text}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {adminSuggestionStatuses.map((status) => {
                      const active = suggestion.status === status.id;
                      return (
                        <button
                          key={status.id}
                          type="button"
                          onClick={() => setStatus(suggestion.id, status.id)}
                          aria-pressed={active}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-black transition ${
                            active ? "bg-pen text-white" : "bg-hlMint/45 text-[rgb(var(--theme-muted))] hover:bg-hlYellow/30"
                          }`}
                        >
                          {status.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setModal({
                      type: "confirm",
                      title: "Excluir esta sugestão?",
                      body: "Ela será removida permanentemente.",
                      onConfirm: () => {
                        update((draft) => ({ ...draft, suggestions: draft.suggestions.filter((item) => item.id !== suggestion.id) }));
                        notify("Sugestão removida.");
                      },
                    })
                  }
                  aria-label={`Excluir sugestão de ${suggestion.name}`}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-red-600/70 transition hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </article>
          );
        })}
        {!suggestions.length ? <AdminV2Empty text="Nenhuma sugestão neste filtro." /> : null}
      </div>
    </AdminV2PanelCard>
  );
}

export function AdminV2CommentsPanel({
  data,
  selectedClientId,
  onSelectClient,
  onDeleteComment,
}: {
  data: AppData;
  selectedClientId: AdminV2ClientScope;
  onSelectClient: (userId: AdminV2ClientScope) => void;
  onDeleteComment: (comment: SiteComment) => void;
}) {
  const comments = data.comments
    .filter((comment) => selectedClientId === "all" || comment.userId === selectedClientId)
    .sort((a, b) => b.createdAt - a.createdAt);
  const average = comments.length ? comments.reduce((sum, item) => sum + item.rating, 0) / comments.length : 0;

  return (
    <AdminV2PanelCard>
      <AdminV2PanelTitle icon={Star} title="Comentários do site" text="Opiniões enviadas pelos clientes na aba Comentários. Remova o que for impróprio." />
      {comments.length ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm font-black text-pen">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-hlMint/45 px-3 py-2">
            <Star className="h-4 w-4 fill-[#f59e0b] text-[#f59e0b]" />
            {average.toFixed(1)} de 5
          </span>
          <span className="rounded-lg bg-hlMint/45 px-3 py-2">
            {comments.length} {comments.length === 1 ? "comentário" : "comentários"}
          </span>
        </div>
      ) : null}
      <div className="grid gap-3">
        {comments.map((comment) => {
          const author = data.users.find((item) => item.id === comment.userId);
          return (
            <article key={comment.id} className="rounded-lg border border-line bg-sheet p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-hlMint/45 font-black text-pen">
                  {comment.name.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {author ? (
                      <button type="button" onClick={() => onSelectClient(author.id)} className="font-black text-[rgb(var(--theme-text))] underline-offset-4 transition hover:text-pen hover:underline">
                        {comment.name}
                      </button>
                    ) : (
                      <span className="font-black text-[rgb(var(--theme-text))]">{comment.name}</span>
                    )}
                    {!author ? <span className="rounded-full bg-[#fef3c7] px-2 py-0.5 text-[10px] font-black uppercase text-[#92400e]">conta excluída</span> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-[rgb(var(--theme-muted))]">
                    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${comment.rating} de 5 estrelas`}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className={`h-3.5 w-3.5 ${star <= comment.rating ? "fill-[#f59e0b] text-[#f59e0b]" : "text-[#d1d5db]"}`} />
                      ))}
                    </span>
                    <span>{adminDateTime(comment.createdAt)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[rgb(var(--theme-muted))]">{comment.text}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteComment(comment)}
                  aria-label={`Excluir comentário de ${comment.name}`}
                  title="Excluir comentário"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-red-600/70 transition hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </article>
          );
        })}
        {!comments.length ? <AdminV2Empty text="Nenhum comentário recebido ainda." /> : null}
      </div>
    </AdminV2PanelCard>
  );
}

export function AdminV2OverviewPanel({
  data,
  selectedClientId,
  onSelectClient,
  onOpenMineConversation,
}: {
  data: AppData;
  selectedClientId: AdminV2ClientScope;
  onSelectClient: (userId: AdminV2ClientScope) => void;
  onOpenMineConversation: (userId: string) => void;
}) {
  const records = buildAdminActivity(data, selectedClientId).slice(0, 10);
  const stats = getAdminStats(data, selectedClientId);
  const recentClients = (selectedClientId === "all" ? data.users : data.users.filter((user) => user.id === selectedClientId))
    .slice()
    .sort((a, b) => userLastActivity(data, b) - userLastActivity(data, a))
    .slice(0, 6);
  const scopedChats = data.chats.filter((chat) => selectedClientId === "all" || chat.userId === selectedClientId);

  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <AdminV2PanelCard>
      <AdminV2PanelTitle icon={Activity} title="Últimas atividades" text="Movimentos mais recentes das contas, organizados por data." />
      <div className="grid gap-3">
        {records.map((record) => (
          <AdminV2ActivityRow key={record.id} record={record} onOpenConversation={onOpenMineConversation} />
        ))}
        {!records.length ? <AdminV2Empty text="Nenhuma atividade registrada ainda." /> : null}
      </div>
      </AdminV2PanelCard>

      <div className="grid content-start gap-5">
        <AdminV2PanelCard>
          <AdminV2PanelTitle icon={LayoutDashboard} title="Resumo do recorte" text={selectedClientId === "all" ? "Todos os clientes do banco online." : "Dados do cliente selecionado."} />
          <div className="grid gap-3">
            <AdminV2DataRow icon={Users} label="Clientes" detail="Contas no recorte" value={stats.totalUsers} />
            <AdminV2DataRow icon={FileText} label="Conteudos" detail={`${stats.subjectCount} materias`} value={stats.contentCount} />
            <AdminV2DataRow icon={ListChecks} label="Tarefas abertas" detail={`${stats.doneTasks} concluidas`} value={stats.openTasks} />
            <AdminV2DataRow icon={MessageCircle} label="Mensagens" detail="Cliente e Mine" value={scopedChats.length} />
          </div>
        </AdminV2PanelCard>

        <AdminV2PanelCard>
          <AdminV2PanelTitle icon={Users} title="Clientes recentes" text="Contas ordenadas pela ultima atividade." />
          <div className="grid gap-2">
            {recentClients.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => onSelectClient(user.id)}
                className="rounded-lg border border-line bg-sheet p-3 text-left transition hover:border-pen/50 hover:bg-hlYellow/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black text-[rgb(var(--theme-text))]">{adminDisplayName(user)}</p>
                    <p className="text-xs font-bold text-[rgb(var(--theme-muted))]">{adminDateTime(userLastActivity(data, user))}</p>
                  </div>
                  {user.isAdmin ? <AdminV2Badge tone="dark" label="ADMIN" icon={Shield} /> : <AdminV2MetricPill label={`${clientMetrics(data, user).chatCount} msgs`} />}
                </div>
              </button>
            ))}
            {!recentClients.length ? <AdminV2Empty text="Nenhum cliente neste recorte." /> : null}
          </div>
        </AdminV2PanelCard>
      </div>
    </div>
  );
}

export function AdminV2ConversationPanel({
  rows,
  selectedUserId,
  onSelect,
  data,
}: {
  rows: AdminV2ChatUser[];
  selectedUserId: string;
  onSelect: (userId: string) => void;
  data: AppData;
}) {
  const selected = rows.find((row) => row.user.id === selectedUserId) || rows[0];

  return (
    <AdminV2PanelCard className="overflow-hidden p-0">
      <div className="p-4 md:p-5">
        <AdminV2PanelTitle icon={MessageCircle} title="Mensagens dos clientes" text="Selecione uma conta para ver o que o usuario mandou e como a Mine respondeu." />
      </div>
      {!rows.length ? (
        <div className="px-4 pb-4 md:px-5 md:pb-5">
          <AdminV2Empty text="Nenhuma conversa com a Mine registrada ainda." />
        </div>
      ) : (
        <div className="grid border-t border-line xl:grid-cols-[320px_1fr]">
          <div className="max-h-[680px] overflow-y-auto border-b border-line bg-sheet p-3 xl:border-b-0 xl:border-r">
            {rows.map((row) => {
              const active = selected?.user.id === row.user.id;
              const lastUserMessage = row.chats.slice().reverse().find((chat) => chat.role === "user");
              const attachmentCount = row.chats.reduce((total, chat) => total + (chat.attachments?.length || 0), 0);
              return (
                <button
                  key={row.user.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelect(row.user.id)}
                  className={`mb-2 w-full rounded-lg border p-3 text-left transition ${
                    active ? "border-pen/60 bg-panel shadow-[0_14px_32px_rgba(34,197,94,0.16)]" : "border-line bg-sheet hover:border-pen/50 hover:bg-panel"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg font-black ${active ? "bg-hlMint/45 text-pen" : "bg-panel text-pen"}`}>
                      {adminDisplayName(row.user).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-black text-[rgb(var(--theme-text))]">{adminDisplayName(row.user)}</span>
                      <span className="block truncate text-xs font-bold text-[rgb(var(--theme-muted))]">{adminContact(row.user)}</span>
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <span className="rounded-lg bg-hlMint/45 px-3 py-2 text-xs font-black text-pen">{row.clientMessages} do usuario</span>
                    <span className="rounded-lg bg-panel px-3 py-2 text-xs font-black text-[rgb(var(--theme-muted))]">{row.mineMessages} da Mine</span>
                  </div>
                  {attachmentCount ? <p className="mt-2 text-xs font-black text-pen">{attachmentCount} anexos enviados</p> : null}
                  <p className="mt-3 line-clamp-2 text-sm font-semibold leading-5 text-[rgb(var(--theme-muted))]">
                    {lastUserMessage ? lastUserMessage.text : "Sem mensagem do usuario."}
                  </p>
                  <p className="mt-2 text-xs font-black text-[rgb(var(--theme-muted))]">Ultima conversa: {adminDateTime(row.lastAt)}</p>
                </button>
              );
            })}
          </div>

          {selected ? <AdminV2ConversationThreadV2 row={selected} data={data} /> : null}
        </div>
      )}
    </AdminV2PanelCard>
  );
}

export function AdminV2ConversationThreadV2({ row, data }: { row: AdminV2ChatUser; data: AppData }) {
  const [filter, setFilter] = useState<"all" | "user" | "mine">("all");
  const visibleChats = row.chats.filter((chat) => filter === "all" || chat.role === filter);

  return (
    <div className="min-w-0 bg-sheet">
      <div className="sticky top-0 z-10 border-b border-line bg-panel/95 p-4 backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-pen">Historico da conversa</p>
            <h3 className="mt-1 font-display text-2xl font-black text-[rgb(var(--theme-text))]">{adminDisplayName(row.user)}</h3>
            <p className="mt-1 text-sm font-bold text-[rgb(var(--theme-muted))]">{row.clientMessages} mensagens do usuario · {row.mineMessages} respostas da Mine</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "user", "mine"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-lg border px-3 py-2 text-xs font-black transition ${
                  filter === item ? "border-pen/60 bg-hlMint/45 text-pen" : "border-line bg-panel text-[rgb(var(--theme-muted))] hover:border-pen/50"
                }`}
              >
                {item === "all" ? "Tudo" : item === "user" ? "Usuario" : "Mine"}
              </button>
            ))}
            {row.user.isAdmin ? <AdminV2Badge tone="dark" label="ADMIN" icon={Shield} /> : <AdminV2Badge tone="light" label="Cliente" icon={Users} />}
          </div>
        </div>
      </div>

      <div className="max-h-[680px] overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {visibleChats.map((chat) => {
            const mine = chat.role === "mine";
            const subject = chat.subjectId ? data.subjects.find((item) => item.id === chat.subjectId) : undefined;
            return (
              <article key={chat.id} className={`flex gap-3 ${mine ? "justify-start" : "justify-end"}`}>
                {mine ? (
                  <span className="mt-1 hidden h-10 w-10 shrink-0 place-items-center rounded-lg bg-panel text-pen shadow-sm sm:grid">
                    <Bot className="h-5 w-5" />
                  </span>
                ) : null}
                <div className={`max-w-[94%] overflow-hidden rounded-lg border shadow-sm sm:max-w-[82%] ${mine ? "border-line bg-panel text-[rgb(var(--theme-text))]" : "border-pen/60 bg-hlMint/45 text-[rgb(var(--theme-text))]"}`}>
                  <div className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 ${mine ? "border-line bg-sheet" : "border-line bg-hlMint/45"}`}>
                    <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.08em] text-pen">
                      {mine ? <Bot className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                      {mine ? "Mine respondeu" : "Usuario enviou"}
                    </span>
                    <span className="text-xs font-bold text-[rgb(var(--theme-muted))]">{adminDateTime(chat.createdAt)}</span>
                  </div>
                  <div className="px-4 py-3">
                    <p className="whitespace-pre-wrap break-words text-sm font-semibold leading-6">{chat.text}</p>
                    <ChatAttachments attachments={chat.attachments} tone="light" />
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <AdminV2MetricPill label={subject?.name || "Mine geral"} />
                      <span className="text-xs font-bold text-[rgb(var(--theme-muted))]">ID {chat.id.slice(-8)}</span>
                    </div>
                  </div>
                </div>
                {!mine ? (
                  <span className="mt-1 hidden h-10 w-10 shrink-0 place-items-center rounded-lg bg-hlMint/45 text-pen shadow-sm sm:grid">
                    <Users className="h-5 w-5" />
                  </span>
                ) : null}
              </article>
            );
          })}
          {!visibleChats.length ? <AdminV2Empty text="Nenhuma mensagem neste filtro." /> : null}
        </div>
      </div>
    </div>
  );
}

export function AdminV2ContentPanel({ data, selectedClientId, onSelectClient }: { data: AppData; selectedClientId: AdminV2ClientScope; onSelectClient: (userId: AdminV2ClientScope) => void }) {
  const contentClientRows = data.users
    .map((user) => {
      const subjects = data.subjects.filter((item) => item.userId === user.id);
      const materials = data.materials.filter((item) => item.userId === user.id);
      const tasks = data.tasks.filter((item) => item.userId === user.id);
      const studied = materials.filter((item) => item.studied).length;
      const lastAt = Math.max(user.createdAt, ...subjects.map((item) => item.createdAt), ...materials.map((item) => item.createdAt), ...tasks.map((item) => item.createdAt));
      return { user, subjects, materials, tasks, completion: percent(studied, materials.length), lastAt };
    })
    .filter((row) => row.subjects.length || row.materials.length || row.tasks.length)
    .sort((a, b) => b.lastAt - a.lastAt);
  const selectedContentRow = selectedClientId === "all" ? null : contentClientRows.find((row) => row.user.id === selectedClientId) || null;

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
      <AdminV2PanelCard>
        <AdminV2PanelTitle icon={Users} title="Clientes com conteudo" text="Clique em uma conta para abrir os conteudos dela." />
        <div className="grid max-h-[650px] gap-2 overflow-y-auto pr-1">
          {contentClientRows.map((row) => (
            <button
              key={row.user.id}
              type="button"
              onClick={() => onSelectClient(row.user.id)}
              className={`rounded-lg border p-3 text-left transition ${
                selectedClientId === row.user.id ? "border-pen/60 bg-hlMint/45 shadow-[0_14px_32px_rgba(34,197,94,0.16)]" : "border-line bg-sheet hover:border-pen/50 hover:bg-hlYellow/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-panel font-black text-pen">
                  {adminDisplayName(row.user).slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black text-[rgb(var(--theme-text))]">{adminDisplayName(row.user)}</span>
                  <span className="block truncate text-xs font-bold text-[rgb(var(--theme-muted))]">{adminContact(row.user)}</span>
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <AdminV2MetricPill label={`${row.subjects.length} materias`} />
                <AdminV2MetricPill label={`${row.materials.length} conteudos`} />
                <AdminV2MetricPill label={`${row.completion}% estudado`} />
              </div>
            </button>
          ))}
          {!contentClientRows.length ? <AdminV2Empty text="Nenhum conteudo cadastrado ainda." /> : null}
        </div>
      </AdminV2PanelCard>

      {selectedContentRow ? (
        <AdminV2ClientContentDetails row={selectedContentRow} data={data} />
      ) : (
        <AdminV2PanelCard>
          <AdminV2PanelTitle icon={Folder} title="Conteudos por cliente" text="Selecione um cliente para ver materias, arquivos, links, imagens e anotacoes." />
          <AdminV2Empty text="Escolha um cliente na lista para abrir os conteudos dele." />
        </AdminV2PanelCard>
      )}
    </div>
  );

  const rows: Array<{ subject: Subject; user?: User; materials: Material[]; tasks: Task[]; completion: number }> = [];
  const typeRows: Array<{ type: Material["type"]; label: string; count: number }> = [];
  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <AdminV2PanelCard>
        <AdminV2PanelTitle icon={Folder} title="Matérias e conteúdos" text="O que os clientes estão cadastrando para estudar." />
        <div className="grid gap-3">
          {rows.map(({ subject, user, materials, tasks, completion }) => (
            <div key={subject.id} className="rounded-lg border border-line bg-sheet p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="font-black text-[rgb(var(--theme-text))]">{subject.name}</p>
                  <p className="text-sm font-bold text-[rgb(var(--theme-muted))]">{user ? adminDisplayName(user) : "Conta removida"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AdminV2MetricPill label={`${materials.length} conteúdos`} />
                  <AdminV2MetricPill label={`${tasks.length} tarefas`} />
                  <AdminV2MetricPill label={`${completion}% estudado`} />
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-panel2">
                <div className="h-full rounded-full bg-pen" style={{ width: `${completion}%` }} />
              </div>
            </div>
          ))}
          {!rows.length ? <AdminV2Empty text="Nenhuma matéria cadastrada ainda." /> : null}
        </div>
      </AdminV2PanelCard>
      <AdminV2PanelCard>
        <AdminV2PanelTitle icon={FileText} title="Tipos de conteúdo" text="Distribuição dos conteúdos salvos pelos clientes." />
        <div className="grid gap-3">
          {typeRows.map((row) => (
            <AdminV2DataRow key={row.type} icon={FileText} label={row.label} detail="Conteúdos cadastrados" value={row.count} />
          ))}
        </div>
      </AdminV2PanelCard>
    </div>
  );
}

export function AdminV2ClientContentDetails({
  row,
  data,
}: {
  row: { user: User; subjects: Subject[]; materials: Material[]; tasks: Task[]; completion: number; lastAt: number };
  data: AppData;
}) {
  const typeRows = (["note", "file", "link", "image"] as Material["type"][]).map((type) => ({
    type,
    label: materialTypeLabel(type),
    count: row.materials.filter((item) => item.type === type).length,
  }));

  return (
    <AdminV2PanelCard>
      <AdminV2PanelTitle icon={Folder} title={`Conteudos de ${adminDisplayName(row.user)}`} text="Materias e materiais salvos por este cliente." />
      <div className="grid gap-3 md:grid-cols-4">
        <AdminV2DataRow icon={BookOpen} label="Materias" detail="Criadas pelo cliente" value={row.subjects.length} />
        <AdminV2DataRow icon={FileText} label="Conteudos" detail="Notas, arquivos e links" value={row.materials.length} />
        <AdminV2DataRow icon={ListChecks} label="Tarefas" detail="Ligadas as materias" value={row.tasks.length} />
        <AdminV2DataRow icon={CheckCircle2} label="Estudado" detail="Conteudos marcados" value={`${row.completion}%`} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_260px]">
        <div className="grid gap-3">
          {row.subjects.map((subject) => {
            const materials = row.materials.filter((item) => item.subjectId === subject.id);
            const tasks = row.tasks.filter((item) => item.subjectId === subject.id);
            const completion = percent(materials.filter((item) => item.studied).length, materials.length);
            return (
              <div key={subject.id} className="rounded-lg border border-line bg-sheet p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="font-black text-[rgb(var(--theme-text))]">{subject.name}</p>
                    <p className="mt-1 text-sm font-bold text-[rgb(var(--theme-muted))]">{materials.length} conteudos · {tasks.length} tarefas</p>
                  </div>
                  <AdminV2MetricPill label={`${completion}% estudado`} />
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-panel2">
                  <div className="h-full rounded-full bg-pen" style={{ width: `${completion}%` }} />
                </div>
                <div className="mt-4 grid gap-2">
                  {materials.slice(0, 5).map((material) => (
                    <div key={material.id} className="rounded-lg bg-panel px-3 py-2 text-sm font-bold text-[rgb(var(--theme-muted))]">
                      <span className="font-black text-[rgb(var(--theme-text))]">{material.title}</span>
                      <span className="ml-2 text-xs text-[rgb(var(--theme-muted))]">{materialTypeLabel(material.type)} · {material.studied ? "estudado" : "pendente"}</span>
                    </div>
                  ))}
                  {!materials.length ? <p className="text-sm font-bold text-[rgb(var(--theme-muted))]">Nenhum material nesta materia.</p> : null}
                </div>
              </div>
            );
          })}
          {!row.subjects.length ? <AdminV2Empty text="Este cliente ainda nao criou materias." /> : null}
        </div>

        <div className="grid content-start gap-3">
          <p className="text-sm font-black uppercase tracking-[.14em] text-pen">Tipos</p>
          {typeRows.map((item) => (
            <AdminV2DataRow key={item.type} icon={FileText} label={item.label} detail="Conteudos deste cliente" value={item.count} />
          ))}
        </div>
      </div>
    </AdminV2PanelCard>
  );
}

export function AdminV2TasksPanel({ data, selectedClientId }: { data: AppData; selectedClientId: AdminV2ClientScope }) {
  const scopedUsers = selectedClientId === "all" ? data.users : data.users.filter((user) => user.id === selectedClientId);
  const scopedTasks = data.tasks.filter((task) => selectedClientId === "all" || task.userId === selectedClientId);
  const open = scopedTasks.filter((task) => !task.done);
  const overdue = open.filter((task) => task.dueAt < today()).length;
  const dueToday = open.filter((task) => task.dueAt === today()).length;
  const rows = scopedTasks.slice().sort((a, b) => a.dueAt - b.dueAt).slice(0, 16);
  const taskGroups = scopedUsers
    .map((user) => ({ user, tasks: rows.filter((task) => task.userId === user.id) }))
    .filter((group) => group.tasks.length > 0);
  return (
    <div className="grid gap-5">
      <AdminV2PanelCard>
        <AdminV2PanelTitle icon={CalendarCheck} title="Resumo de tarefas" text="Pendências e prazos importantes." />
        <div className="grid gap-3">
          <AdminV2DataRow icon={ListChecks} label="Tarefas abertas" detail="Ainda não concluídas" value={open.length} />
          <AdminV2DataRow icon={CheckCircle2} label="Tarefas concluídas" detail="Marcadas como finalizadas" value={scopedTasks.filter((task) => task.done).length} />
          <AdminV2DataRow icon={CalendarDays} label="Vencem hoje" detail="Prazo para hoje" value={dueToday} />
          <AdminV2DataRow icon={Bell} label="Atrasadas" detail="Prazo já passou" value={overdue} warning={overdue > 0} />
        </div>
      </AdminV2PanelCard>
      <AdminV2PanelCard>
        <AdminV2PanelTitle icon={ClipboardCheck} title="Lista de tarefas" text="Últimas tarefas por prazo, com cliente e matéria." />
        <div className="grid gap-3">
          {taskGroups.map((group) => (
            <div key={group.user.id} className="rounded-lg border border-line bg-sheet p-4">
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-black text-[rgb(var(--theme-text))]">{adminDisplayName(group.user)}</p>
                  <p className="text-sm font-bold text-[rgb(var(--theme-muted))]">{group.tasks.length} tarefas neste recorte</p>
                </div>
                {group.user.isAdmin ? <AdminV2Badge tone="dark" label="ADMIN" icon={Shield} /> : null}
              </div>
              <div className="grid gap-2">
                {group.tasks.map((task) => {
                  const subject = data.subjects.find((item) => item.id === task.subjectId);
                  return (
                    <div key={task.id} className="rounded-lg bg-panel px-3 py-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-black text-[rgb(var(--theme-text))]">{task.title}</p>
                          <p className="text-sm font-bold text-[rgb(var(--theme-muted))]">{subject?.name || "Sem materia"}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <AdminV2Badge tone={task.done ? "green" : task.dueAt < today() ? "red" : "light"} label={task.done ? "Concluida" : task.dueAt < today() ? "Atrasada" : "Aberta"} />
                          <AdminV2MetricPill label={shortDate(task.dueAt)} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {false && rows.map((task) => {
            const user = data.users.find((item) => item.id === task.userId);
            const subject = data.subjects.find((item) => item.id === task.subjectId);
            return (
              <div key={task.id} className="rounded-lg border border-line bg-sheet p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-black text-[rgb(var(--theme-text))]">{task.title}</p>
                    <p className="text-sm font-bold text-[rgb(var(--theme-muted))]">{adminDisplayName(user || fallbackUser())} · {subject?.name || "Sem matéria"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <AdminV2Badge tone={task.done ? "green" : task.dueAt < today() ? "red" : "light"} label={task.done ? "Concluída" : task.dueAt < today() ? "Atrasada" : "Aberta"} />
                    <AdminV2MetricPill label={shortDate(task.dueAt)} />
                  </div>
                </div>
              </div>
            );
          })}
          {!rows.length ? <AdminV2Empty text="Nenhuma tarefa cadastrada ainda." /> : null}
        </div>
      </AdminV2PanelCard>
    </div>
  );
}

export function AdminV2MinePanel({ data, selectedClientId, onSelectClient }: { data: AppData; selectedClientId: AdminV2ClientScope; onSelectClient: (userId: AdminV2ClientScope) => void }) {
  const scopedChats = data.chats.filter((chat) => selectedClientId === "all" || chat.userId === selectedClientId);
  const mineMessages = scopedChats.filter((chat) => chat.role === "mine");
  const usersWithMine = new Set(scopedChats.map((chat) => chat.userId)).size;
  const rows = scopedChats.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
  const chatUsers = useMemo<AdminV2ChatUser[]>(() => {
    return data.users
      .map((user) => {
        const chats = data.chats.filter((chat) => chat.userId === user.id).sort((a, b) => a.createdAt - b.createdAt);
        const lastAt = chats.length ? Math.max(...chats.map((chat) => chat.createdAt)) : user.createdAt;
        return {
          user,
          chats,
          clientMessages: chats.filter((chat) => chat.role === "user").length,
          mineMessages: chats.filter((chat) => chat.role === "mine").length,
          lastAt,
        };
      })
      .filter((row) => row.chats.length > 0)
      .filter((row) => selectedClientId === "all" || row.user.id === selectedClientId)
      .sort((a, b) => b.lastAt - a.lastAt);
  }, [data.chats, data.users, selectedClientId]);
  const [selectedMineUserId, setSelectedMineUserId] = useState(selectedClientId === "all" ? "" : selectedClientId);

  useEffect(() => {
    if (!chatUsers.length) {
      if (selectedMineUserId) setSelectedMineUserId("");
      return;
    }
    if (selectedClientId !== "all" && selectedMineUserId !== selectedClientId) {
      setSelectedMineUserId(selectedClientId);
      return;
    }
    if (!chatUsers.some((row) => row.user.id === selectedMineUserId)) {
      setSelectedMineUserId(chatUsers[0].user.id);
    }
  }, [chatUsers, selectedClientId, selectedMineUserId]);
  return (
    <div className="grid gap-5">
      <AdminV2PanelCard className="hidden">
        <AdminV2PanelTitle icon={Bot} title="Uso da Mine" text="Conversas e respostas geradas pela tutora IA." />
        <div className="grid gap-3">
          <AdminV2DataRow icon={MessageCircle} label="Mensagens totais" detail="Cliente e Mine" value={scopedChats.length} />
          <AdminV2DataRow icon={Bot} label="Respostas da Mine" detail="Mensagens da IA" value={mineMessages.length} />
          <AdminV2DataRow icon={Users} label="Clientes usando" detail="Contas com conversa" value={usersWithMine} />
          <AdminV2DataRow icon={Wand2} label="Ações da Mine" detail="Criar, buscar, organizar e navegar" value="9" />
        </div>
      </AdminV2PanelCard>
      <AdminV2PanelCard className="hidden">
        <AdminV2PanelTitle icon={MessageCircle} title="Conversas recentes" text="Prévia curta para acompanhamento administrativo." />
        <div className="grid gap-3">
          {rows.map((chat) => {
            const user = data.users.find((item) => item.id === chat.userId);
            const subject = chat.subjectId ? data.subjects.find((item) => item.id === chat.subjectId) : undefined;
            return (
              <div key={chat.id} className="rounded-lg border border-line bg-sheet p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-hlMint/45 text-pen">
                    {chat.role === "mine" ? <Bot className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-[rgb(var(--theme-text))]">{chat.role === "mine" ? "Mine" : adminDisplayName(user || fallbackUser())}</p>
                    <p className="mt-1 max-h-12 overflow-hidden text-sm font-medium text-[rgb(var(--theme-muted))]">{chat.text}</p>
                    <p className="mt-2 text-xs font-bold text-[rgb(var(--theme-muted))]">{subject?.name || "Mine geral"} · {adminDateTime(chat.createdAt)}</p>
                  </div>
                </div>
              </div>
            );
          })}
          {!rows.length ? <AdminV2Empty text="Nenhuma conversa com a Mine ainda." /> : null}
        </div>
      </AdminV2PanelCard>
      <div>
        <AdminV2ConversationPanel
          rows={chatUsers}
          selectedUserId={selectedMineUserId}
          onSelect={(userId) => {
            setSelectedMineUserId(userId);
            onSelectClient(userId);
          }}
          data={data}
        />
      </div>
    </div>
  );
}

export function AdminV2SystemPanel({ data, syncStatus, databaseMode, selectedClientId }: { data: AppData; syncStatus: SyncStatus; databaseMode: string; selectedClientId: AdminV2ClientScope }) {
  const stats = getAdminStats(data, selectedClientId);
  const selectedClient = selectedClientId === "all" ? null : data.users.find((user) => user.id === selectedClientId) || null;
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <AdminV2PanelCard>
        <AdminV2PanelTitle icon={Shield} title="Estado do sistema" text="Informações reais da versão online." />
        <div className="grid gap-3">
          <AdminV2DataRow icon={Activity} label="Banco de dados" detail={databaseMode === "postgres" ? "Postgres online" : "Modo local"} value={syncStatus === "online" ? "Online" : syncStatus === "salvando" ? "Salvando" : "Offline"} />
          <AdminV2DataRow icon={Users} label="Contas" detail="Usuários cadastrados" value={stats.totalUsers} />
          <AdminV2DataRow icon={Shield} label="Administradores" detail="Contas com acesso admin" value={stats.adminUsers} />
          <AdminV2DataRow icon={FileText} label="Registros" detail="Matérias, conteúdos, tarefas e chats" value={stats.totalRecords} />
        </div>
      </AdminV2PanelCard>
      <AdminV2PanelCard>
        <AdminV2PanelTitle icon={CheckCircle2} title="Resumo operacional" text="O que o painel está acompanhando agora." />
        <div className="space-y-4 text-sm font-bold leading-7 text-[rgb(var(--theme-muted))]">
          <p>Recorte atual: {selectedClient ? adminDisplayName(selectedClient) : "todos os clientes"}.</p>
          <p>Os dados vêm do banco online e são agrupados por cliente para acompanhamento administrativo.</p>
          <p>O painel mostra uso real da plataforma: matérias criadas, conteúdos salvos, tarefas abertas, progresso e conversas com a Mine.</p>
          <p>Ações destrutivas não aparecem aqui para evitar exclusões acidentais de contas ou estudos.</p>
        </div>
      </AdminV2PanelCard>
    </div>
  );
}

export function AdminV2DataRow({ icon: Icon, label, detail, value, warning = false }: { icon: LucideIcon; label: string; detail: string; value: number | string; warning?: boolean }) {
  return (
    <div className="admin-data-row flex flex-col gap-3 rounded-2xl border border-line bg-sheet p-4 sm:flex-row sm:items-center sm:gap-4">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${warning ? "bg-[#fff0ed] text-[#b94337]" : "bg-panel2 text-pen"}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-black text-[rgb(var(--theme-text))]">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-[rgb(var(--theme-muted))]">{detail}</p>
      </div>
      <p className={`break-words font-display text-2xl font-black tracking-[-.04em] sm:text-3xl ${warning ? "text-[#b94337]" : "text-pen"}`}>{value}</p>
    </div>
  );
}

export function AdminV2ActivityRow({ record, onOpenConversation }: { record: ReturnType<typeof buildAdminActivity>[number]; onOpenConversation?: (userId: string) => void }) {
  const Icon = record.icon;
  const opensConversation = record.kind === "chat" && Boolean(onOpenConversation);
  const Element = opensConversation ? "button" : "div";
  return (
    <Element
      type={opensConversation ? "button" : undefined}
      onClick={opensConversation ? () => onOpenConversation?.(record.userId) : undefined}
      className={`admin-activity-row flex w-full flex-col gap-3 rounded-2xl border border-line bg-sheet p-4 text-left transition-control sm:flex-row sm:items-start sm:gap-4 ${
        opensConversation ? "cursor-pointer hover:border-pen/50 hover:bg-hlYellow/30 hover:shadow-[0_14px_32px_-24px_rgba(34,126,82,.3)]" : ""
      }`}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-panel2 text-pen">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-black text-[rgb(var(--theme-text))]">{record.label}</p>
        <p className="mt-1 text-sm font-medium text-[rgb(var(--theme-muted))]">{record.detail}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
        <p className="text-xs font-black text-[rgb(var(--theme-muted))] sm:whitespace-nowrap">{adminDateTime(record.time)}</p>
        {opensConversation ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-hlMint/45 px-3 py-1 text-xs font-black text-pen">
            Abrir conversa
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>
    </Element>
  );
}

export function AdminV2MetricPill({ label }: { label: string }) {
  return <span className="admin-metric-pill inline-flex rounded-full border border-line bg-panel2 px-3 py-1 text-xs font-black text-pen">{label}</span>;
}

export function AdminV2Badge({ label, icon: Icon, tone = "green" }: { label: string; icon?: LucideIcon; tone?: "green" | "dark" | "light" | "red" }) {
  const className =
    tone === "dark" ? "bg-pen text-white" :
    tone === "red" ? "bg-[#fee2e2] text-[#b91c1c]" :
    tone === "light" ? "bg-hlMint/45 text-[rgb(var(--theme-text))]" :
    "bg-hlMint/45 text-pen";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${className}`}>
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
    </span>
  );
}

export function AdminV2Empty({ text }: { text: string }) {
  return (
    <div className="admin-empty-state rounded-2xl border border-dashed border-line bg-sheet p-8 text-center font-bold text-[rgb(var(--theme-muted))]">
      {text}
    </div>
  );
}

export function clientMetrics(data: AppData, user: User) {
  const subjects = data.subjects.filter((item) => item.userId === user.id);
  const materials = data.materials.filter((item) => item.userId === user.id);
  const tasks = data.tasks.filter((item) => item.userId === user.id);
  const chats = data.chats.filter((item) => item.userId === user.id);
  const sessions = data.sessions.filter((item) => item.userId === user.id);
  const studied = materials.filter((item) => item.studied).length;
  const doneTasks = tasks.filter((item) => item.done).length;
  return {
    subjectCount: subjects.length,
    contentCount: materials.length,
    taskCount: tasks.length,
    openTasks: tasks.filter((item) => !item.done).length,
    doneTasks,
    chatCount: chats.length,
    mineMessages: chats.filter((item) => item.role === "mine").length,
    sessionCount: sessions.length,
    completion: percent(studied + doneTasks, materials.length + tasks.length),
    lastActivity: userLastActivity(data, user),
  };
}

export function adminClientStatus(user: User, metrics: ReturnType<typeof clientMetrics>) {
  const age = Date.now() - user.createdAt;
  const last = Date.now() - metrics.lastActivity;
  if (user.isAdmin) return { label: "Administrador", className: "bg-[#064e3b] text-white" };
  if (age <= 3 * 86400000) return { label: "Novo cliente", className: "bg-[#dcfce7] text-[#087445]" };
  if (last <= 7 * 86400000) return { label: "Ativo", className: "bg-[#dcfce7] text-[#087445]" };
  if (metrics.subjectCount || metrics.contentCount || metrics.taskCount || metrics.chatCount) return { label: "Em acompanhamento", className: "bg-[#ecfdf3] text-[#166534]" };
  return { label: "Sem dados", className: "bg-[#f1f5f2] text-[#66786c]" };
}

export function getAdminStats(data: AppData, selectedClientId: AdminV2ClientScope = "all") {
  const users = selectedClientId === "all" ? data.users : data.users.filter((user) => user.id === selectedClientId);
  const userIds = new Set(users.map((user) => user.id));
  const subjects = data.subjects.filter((item) => userIds.has(item.userId));
  const materials = data.materials.filter((item) => userIds.has(item.userId));
  const tasks = data.tasks.filter((item) => userIds.has(item.userId));
  const chats = data.chats.filter((item) => userIds.has(item.userId));
  const activeThisWeek = users.filter((user) => Date.now() - userLastActivity(data, user) <= 7 * 86400000).length;
  return {
    totalUsers: users.length,
    adminUsers: users.filter((user) => user.isAdmin).length,
    activeThisWeek,
    subjectCount: subjects.length,
    contentCount: materials.length,
    openTasks: tasks.filter((task) => !task.done).length,
    doneTasks: tasks.filter((task) => task.done).length,
    totalRecords: subjects.length + materials.length + tasks.length + chats.length,
  };
}

export function buildAdminActivity(data: AppData, selectedClientId: AdminV2ClientScope = "all") {
  const userName = (userId: string) => adminDisplayName(data.users.find((item) => item.id === userId) || fallbackUser());
  const userFilter = (userId: string) => selectedClientId === "all" || userId === selectedClientId;
  const subjectName = (subjectId: string) => data.subjects.find((item) => item.id === subjectId)?.name || "Sem matéria";
  return [
    ...data.subjects.filter((subject) => userFilter(subject.userId)).map((subject) => ({
      id: `subject-${subject.id}`,
      kind: "subject" as const,
      userId: subject.userId,
      icon: BookOpen,
      label: "Matéria criada",
      detail: `${subject.name} · ${userName(subject.userId)}`,
      time: subject.createdAt,
    })),
    ...data.materials.filter((material) => userFilter(material.userId)).map((material) => ({
      id: `material-${material.id}`,
      kind: "material" as const,
      userId: material.userId,
      icon: FileText,
      label: "Conteúdo adicionado",
      detail: `${material.title} · ${subjectName(material.subjectId)} · ${userName(material.userId)}`,
      time: material.createdAt,
    })),
    ...data.tasks.filter((task) => userFilter(task.userId)).map((task) => ({
      id: `task-${task.id}`,
      kind: "task" as const,
      userId: task.userId,
      icon: task.done ? CheckCircle2 : CalendarCheck,
      label: task.done ? "Tarefa concluída" : "Tarefa criada",
      detail: `${task.title} · ${subjectName(task.subjectId)} · ${userName(task.userId)}`,
      time: task.createdAt,
    })),
    ...data.chats.filter((chat) => userFilter(chat.userId)).map((chat) => ({
      id: `chat-${chat.id}`,
      kind: "chat" as const,
      userId: chat.userId,
      chatId: chat.id,
      icon: chat.role === "mine" ? Bot : MessageCircle,
      label: chat.role === "mine" ? "Resposta da Mine" : "Mensagem do cliente",
      detail: `${userName(chat.userId)} · ${chat.text.slice(0, 90)}${chat.text.length > 90 ? "..." : ""}`,
      time: chat.createdAt,
    })),
    ...data.sessions.filter((session) => userFilter(session.userId)).map((session) => ({
      id: `session-${session.id}`,
      kind: "session" as const,
      userId: session.userId,
      icon: Flame,
      label: "Sessão de estudo",
      detail: `${session.title} · ${subjectName(session.subjectId)} · ${userName(session.userId)}`,
      time: session.createdAt,
    })),
  ].sort((a, b) => b.time - a.time);
}

