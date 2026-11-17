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

/** "há 3 dias", "hoje, 14:20": a tabela lê mais rápido com tempo relativo. */
export function adminRelative(timestamp: number) {
  const now = Date.now();
  const diff = now - timestamp;
  const day = 86400000;
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (timestamp >= startOfToday.getTime()) return `hoje, ${time}`;
  if (timestamp >= startOfToday.getTime() - day) return `ontem, ${time}`;
  if (diff < 7 * day) return `há ${Math.max(2, Math.round(diff / day))} dias`;
  const sameYear = new Date(timestamp).getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat("pt-BR", sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(timestamp))
    .replace(/\./g, "");
}

export function adminInitial(user: User) {
  return adminDisplayName(user).trim().charAt(0).toUpperCase() || "?";
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
  themeMode,
  onToggleTheme,
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
  themeMode?: "dark" | "light";
  onToggleTheme?: () => void;
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

            <div className="flex shrink-0 items-center gap-2 lg:hidden">
              {onToggleTheme ? (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  aria-label={themeMode === "dark" ? "Usar tema claro" : "Usar tema escuro"}
                  className="admin-cover-button grid h-11 w-11 place-items-center rounded-xl"
                >
                  {themeMode === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => go("home")}
                aria-label="Voltar ao aplicativo"
                className="admin-cover-button grid h-11 w-11 place-items-center rounded-xl"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>
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
            <div className="admin-sidebar-label">
              <span>Conta</span>
              <span className={`admin-dot admin-dot-${syncStatus === "online" ? "ok" : syncStatus === "salvando" ? "busy" : "warn"}`} aria-hidden="true" />
            </div>
            <div className="admin-sidebar-account">
              <div className="flex items-center gap-3">
                <span className="admin-sidebar-avatar">{currentAdmin ? adminInitial(currentAdmin) : "A"}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{currentAdmin ? adminDisplayName(currentAdmin) : "Conta administrativa"}</p>
                  <p className="text-xs text-white/60">Administrador(a)</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <button type="button" onClick={() => go("home")} className="admin-cover-button inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold">
                  <ChevronLeft className="h-4 w-4" />
                  Voltar ao app
                </button>
                {onToggleTheme ? (
                  <button
                    type="button"
                    onClick={onToggleTheme}
                    aria-label={themeMode === "dark" ? "Usar tema claro" : "Usar tema escuro"}
                    title={themeMode === "dark" ? "Tema claro" : "Tema escuro"}
                    className="admin-cover-button grid h-10 w-10 place-items-center rounded-lg"
                  >
                    {themeMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </aside>

        <main className="admin-main min-w-0 px-4 pb-12 pt-5 sm:px-6 md:px-8 md:pb-16 md:pt-8 xl:px-10 2xl:px-14">
          <div className="admin-main-inner mx-auto w-full max-w-[1400px]">
            <header className="admin-hero flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <p className="admin-kicker">
                  Painel do admin <span aria-hidden="true">›</span> <span className="admin-kicker-current">{activeCopy.title}</span>
                </p>
                <h1 className="mt-1.5 font-display text-[clamp(2rem,3.6vw,3rem)] font-black leading-[1] tracking-[-.035em] text-[rgb(var(--theme-text))]">{activeCopy.title}</h1>
                <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[rgb(var(--theme-muted))]">{activeCopy.description}</p>
              </div>
              <AdminV2SystemStatus syncStatus={syncStatus} databaseMode={databaseMode} totalRecords={stats.totalRecords} />
            </header>

            <div className="admin-stats-grid mt-6 grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
              <AdminV2StatCard tone="mint" active={section === "clients"} icon={Users} title="Clientes" value={stats.totalUsers} detail={`${stats.adminUsers} ${stats.adminUsers === 1 ? "administrador" : "administradores"}`} onClick={() => setSection("clients")} />
              <AdminV2StatCard tone="pink" active={section === "overview"} icon={Activity} title="Ativos na semana" value={stats.activeThisWeek} detail="Atividade nos últimos 7 dias" onClick={() => setSection("overview")} />
              <AdminV2StatCard tone="lilac" active={section === "content"} icon={FileText} title="Conteúdos" value={stats.contentCount} detail={`${stats.subjectCount} ${stats.subjectCount === 1 ? "matéria cadastrada" : "matérias cadastradas"}`} onClick={() => setSection("content")} />
              <AdminV2StatCard tone="yellow" active={section === "tasks"} icon={ListChecks} title="Tarefas abertas" value={stats.openTasks} detail={`${stats.doneTasks} ${stats.doneTasks === 1 ? "concluída" : "concluídas"}`} onClick={() => setSection("tasks")} />
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
    <div className="admin-system-status" role="status">
      <span className={`admin-dot admin-dot-${online ? "ok" : saving ? "busy" : "warn"}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-bold text-[rgb(var(--theme-text))]">{saving ? "Sincronizando dados" : online ? "Tudo sincronizado" : "Conexão limitada"}</p>
        <p className="admin-label mt-0.5">{databaseMode === "postgres" ? "Postgres" : "Dados locais"} · {totalRecords.toLocaleString("pt-BR")} registros</p>
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
      className={`admin-nav-button relative flex min-h-10 shrink-0 items-center rounded-lg px-3 py-2 text-left text-sm font-bold transition-control lg:w-full ${active ? "" : "text-white/75 hover:bg-white/[0.08] hover:text-white"}`}
    >
      {active ? (
        <motion.span
          layoutId="admin-active-nav"
          aria-hidden="true"
          className="admin-nav-active-pill absolute inset-0"
          transition={{ type: "spring", stiffness: 440, damping: 36 }}
        />
      ) : null}
      <span className="relative z-[1] flex min-w-0 items-center gap-2.5 lg:w-full">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="whitespace-nowrap">{item.label}</span>
        {typeof badge === "number" && badge > 0 ? <span className="admin-nav-badge lg:ml-auto">{badge}</span> : null}
      </span>
    </button>
  );
}

export function AdminV2StatCard({
  icon: Icon,
  title,
  value,
  detail,
  onClick,
  tone = "mint",
  active = false,
}: {
  icon: LucideIcon;
  title: string;
  value: number | string;
  detail: string;
  onClick?: () => void;
  tone?: "mint" | "pink" | "lilac" | "yellow";
  active?: boolean;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      data-tone={tone}
      data-active={active ? "true" : "false"}
      className="admin-stat-card text-left"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="admin-label">{title}</p>
        <span className="admin-stat-icon" aria-hidden="true">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="admin-stat-value">{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</p>
      <p className="mt-1 text-[13px] leading-snug text-[rgb(var(--theme-muted))]">{detail}</p>
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
    <section className="admin-scope-bar" aria-label="Recorte de análise">
      <div className="flex min-w-0 items-center gap-2.5">
        <Target className="h-4 w-4 shrink-0 text-pen" aria-hidden="true" />
        <p className="min-w-0 text-sm leading-snug text-[rgb(var(--theme-muted))]">
          {selectedClient ? (
            <>
              Mostrando só <strong className="font-bold text-[rgb(var(--theme-text))]">{adminDisplayName(selectedClient)}</strong>
            </>
          ) : (
            <>
              Mostrando <strong className="font-bold text-[rgb(var(--theme-text))]">todos os clientes</strong>
            </>
          )}
        </p>
      </div>
      <div className="admin-scope-controls relative flex min-w-0 flex-1 flex-wrap items-center gap-2 md:max-w-[480px] md:justify-end">
        <div className="admin-segmented" role="group" aria-label="Escolher recorte">
          <button type="button" onClick={() => onSelect("all")} aria-pressed={selectedClientId === "all"}>
            Todos
          </button>
          {selectedClient ? (
            <span className="admin-segmented-chip" data-active="true">
              <span className="max-w-36 truncate">{adminDisplayName(selectedClient)}</span>
              <button type="button" onClick={() => onSelect("all")} aria-label={`Remover filtro de ${adminDisplayName(selectedClient)}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ) : null}
        </div>
        <div className="relative min-w-44 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--theme-muted))]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
              if (event.key === "Enter" && results[0]) {
                onSelect(results[0].id);
                setQuery("");
              }
            }}
            placeholder="Buscar cliente…"
            aria-label="Buscar cliente"
            className="admin-input min-h-10 w-full py-2 pl-9 pr-3 text-sm"
          />
        </div>
        {needle ? (
          results.length ? (
            <div className="admin-scope-results absolute inset-x-0 top-[calc(100%+.4rem)] z-30 grid gap-0.5 p-1.5">
              {results.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    onSelect(user.id);
                    setQuery("");
                  }}
                  className="admin-scope-result flex min-h-11 items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm"
                >
                  <span className="admin-avatar admin-avatar-sm">{adminInitial(user)}</span>
                  <span className="min-w-0 flex-1 truncate font-bold text-[rgb(var(--theme-text))]">{adminDisplayName(user)}</span>
                  <span className="hidden shrink-0 text-xs text-[rgb(var(--theme-muted))] sm:inline">{user.name.includes("@") ? user.name : `ID ${user.id.slice(-6)}`}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="admin-scope-results absolute inset-x-0 top-[calc(100%+.4rem)] z-30 px-4 py-3 text-sm text-[rgb(var(--theme-muted))]">Nenhum cliente com esse nome.</p>
          )
        ) : null}
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
    <section className={`admin-panel-card ${/\bp-0\b/.test(className) ? "" : "p-4 md:p-5"} ${className}`}>
      {children}
    </section>
  );
}

export function AdminV2PanelTitle({ icon: Icon, title, text, count, action }: { icon: LucideIcon; title: string; text: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="admin-panel-title mb-4 flex items-start gap-3">
      <span className="admin-panel-icon" aria-hidden="true">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="flex flex-wrap items-baseline gap-x-2 font-display text-lg font-black tracking-[-.02em] text-[rgb(var(--theme-text))] md:text-xl">
          {title}
          {typeof count === "number" ? <span className="admin-count">{count.toLocaleString("pt-BR")}</span> : null}
        </h2>
        <p className="mt-0.5 text-sm leading-relaxed text-[rgb(var(--theme-muted))]">{text}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
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
    <AdminV2PanelCard className="overflow-hidden p-0 md:p-0">
      <div className="p-4 pb-0 md:p-5 md:pb-0">
        <AdminV2PanelTitle icon={Users} title="Clientes cadastrados" count={users.length} text="Clique numa linha para filtrar o painel por essa conta." />
      </div>
      <div className="grid gap-2.5 px-4 pb-4 md:hidden">
        {users.map((user) => (
          <div key={user.id} className="grid gap-1">
            <AdminV2ClientCard user={user} data={data} active={selectedClientId === user.id} onSelect={() => onSelectClient(user.id)} />
            {user.id !== currentUserId ? (
              <button type="button" onClick={() => onDeleteUser(user)} className="admin-danger-button inline-flex min-h-9 items-center gap-1.5 justify-self-end rounded-lg px-2.5 text-xs font-bold">
                <Trash2 className="h-3.5 w-3.5" />
                Excluir conta
              </button>
            ) : null}
          </div>
        ))}
        {!users.length ? <AdminV2Empty icon={Users} text="Nenhuma conta cadastrada ainda." /> : null}
      </div>
      <div className="admin-table-wrap hidden md:block">
        <table className="admin-table w-full min-w-[860px] text-left">
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col">Estudos</th>
              <th scope="col">Tarefas</th>
              <th scope="col" className="text-right">Mine</th>
              <th scope="col">Última atividade</th>
              <th scope="col">Situação</th>
              <th scope="col" className="w-12"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const metrics = clientMetrics(data, user);
              const status = adminClientStatus(user, metrics);
              const selected = selectedClientId === user.id;
              return (
                <tr key={user.id} onClick={() => onSelectClient(user.id)} data-selected={selected ? "true" : "false"} className="cursor-pointer">
                  <td>
                    <div className="flex items-center gap-3">
                      <span className="admin-avatar">{adminInitial(user)}</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onSelectClient(user.id);
                            }}
                            aria-pressed={selected}
                            className="max-w-[16rem] truncate text-left font-bold text-[rgb(var(--theme-text))] hover:underline"
                          >
                            {adminDisplayName(user)}
                          </button>
                          {user.isAdmin ? <AdminV2Badge tone="dark" label="Admin" icon={Shield} /> : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-[rgb(var(--theme-muted))]">
                          {user.name.includes("@") ? `${user.name} · ` : ""}desde {shortDate(user.createdAt)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="w-40">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="text-[rgb(var(--theme-muted))]">
                          {metrics.subjectCount} mat. · {metrics.contentCount} cont.
                        </span>
                        <span className="admin-num font-bold text-[rgb(var(--theme-text))]">{metrics.completion}%</span>
                      </div>
                      <AdminV2Progress value={metrics.completion} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-sm">
                    <span className="admin-num font-bold text-[rgb(var(--theme-text))]">{metrics.openTasks}</span>
                    <span className="text-[rgb(var(--theme-muted))]"> abertas · </span>
                    <span className="admin-num text-[rgb(var(--theme-muted))]">{metrics.doneTasks} feitas</span>
                  </td>
                  <td className="text-right">
                    <span className="admin-num font-bold text-[rgb(var(--theme-text))]">{metrics.mineMessages}</span>
                  </td>
                  <td className="whitespace-nowrap text-sm text-[rgb(var(--theme-muted))]" title={adminDateTime(metrics.lastActivity)}>
                    {adminRelative(metrics.lastActivity)}
                  </td>
                  <td>
                    <AdminV2Status status={status} />
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      disabled={user.id === currentUserId}
                      title={user.id === currentUserId ? "Você não pode excluir a conta que está usando" : `Excluir a conta de ${adminDisplayName(user)}`}
                      aria-label={`Excluir a conta de ${adminDisplayName(user)}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteUser(user);
                      }}
                      className="admin-danger-button inline-grid h-9 w-9 place-items-center rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {!users.length ? (
              <tr>
                <td colSpan={7}>
                  <AdminV2Empty icon={Users} text="Nenhuma conta cadastrada ainda." />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AdminV2PanelCard>
  );
}

export function AdminV2Progress({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="admin-progress mt-1.5" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ transform: `scaleX(${clamped / 100})` }} />
    </div>
  );
}

export function AdminV2Status({ status }: { status: ReturnType<typeof adminClientStatus> }) {
  return (
    <span className="admin-status" data-tone={status.tone}>
      <span className="admin-status-dot" aria-hidden="true" />
      {status.label}
    </span>
  );
}

export function AdminV2ClientCard({ user, data, active = false, onSelect }: { user: User; data: AppData; active?: boolean; onSelect?: () => void }) {
  const metrics = clientMetrics(data, user);
  const status = adminClientStatus(user, metrics);
  const Element = onSelect ? "button" : "article";

  return (
    <Element
      type={onSelect ? "button" : undefined}
      onClick={onSelect}
      aria-pressed={onSelect ? active : undefined}
      data-selected={active ? "true" : "false"}
      className="admin-client-card admin-item w-full p-3.5 text-left"
    >
      <div className="flex items-start gap-3">
        <span className="admin-avatar">{adminInitial(user)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="min-w-0 break-words font-bold text-[rgb(var(--theme-text))] [overflow-wrap:anywhere]">{adminDisplayName(user)}</h3>
            {user.isAdmin ? <AdminV2Badge tone="dark" label="Admin" icon={Shield} /> : null}
          </div>
          <p className="mt-0.5 text-xs text-[rgb(var(--theme-muted))] [overflow-wrap:anywhere]">
            {user.name.includes("@") ? `${user.name} · ` : ""}desde {shortDate(user.createdAt)}
          </p>
          <div className="mt-1.5">
            <AdminV2Status status={status} />
          </div>
        </div>
      </div>

      <dl className="admin-mini-stats mt-3">
        <div><dt>Matérias</dt><dd>{metrics.subjectCount}</dd></div>
        <div><dt>Conteúdos</dt><dd>{metrics.contentCount}</dd></div>
        <div><dt>Abertas</dt><dd>{metrics.openTasks}</dd></div>
        <div><dt>Mine</dt><dd>{metrics.mineMessages}</dd></div>
      </dl>

      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-2 text-xs text-[rgb(var(--theme-muted))]">
          <span>{metrics.completion}% estudado</span>
          <span title={adminDateTime(metrics.lastActivity)}>ativo {adminRelative(metrics.lastActivity)}</span>
        </div>
        <AdminV2Progress value={metrics.completion} />
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
                    className="admin-chip inline-flex items-center gap-2 px-3 py-2 text-sm"
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
              <article key={item.id} className="admin-item p-4">
                <div className="flex items-start gap-3">
                  <span className="admin-row-icon admin-row-icon-lg">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="admin-tag">{meta.label}</span>
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
                    className="admin-danger-button grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                  >
                    <Trash2 className="h-4 w-4" />
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
              className="admin-chip px-3 py-1.5 text-xs"
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
            <article key={suggestion.id} className="admin-item p-4">
              <div className="flex items-start gap-3">
                <span className="admin-row-icon admin-row-icon-lg">
                  <categoryInfo.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="admin-tag">{categoryInfo.label}</span>
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
                            active ? "admin-step-active" : "admin-step"
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
                  className="admin-danger-button grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                >
                  <Trash2 className="h-4 w-4" />
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
          <span className="admin-summary-chip">
            <Star className="h-4 w-4 admin-star-on" />
            {average.toFixed(1)} de 5
          </span>
          <span className="admin-summary-chip">
            {comments.length} {comments.length === 1 ? "comentário" : "comentários"}
          </span>
        </div>
      ) : null}
      <div className="grid gap-3">
        {comments.map((comment) => {
          const author = data.users.find((item) => item.id === comment.userId);
          return (
            <article key={comment.id} className="admin-item p-4">
              <div className="flex items-start gap-3">
                <span className="admin-avatar">
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
                    {!author ? <span className="admin-tag" data-tone="warn">conta excluída</span> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-[rgb(var(--theme-muted))]">
                    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${comment.rating} de 5 estrelas`}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className={`h-3.5 w-3.5 ${star <= comment.rating ? "admin-star-on" : "admin-star-off"}`} />
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
                  className="admin-danger-button grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                >
                  <Trash2 className="h-4 w-4" />
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
        <AdminV2PanelTitle icon={Activity} title="Últimas atividades" text="Movimentos mais recentes das contas, do mais novo ao mais antigo." />
        {records.length ? (
          <div className="admin-list">
            {records.map((record) => (
              <AdminV2ActivityRow key={record.id} record={record} onOpenConversation={onOpenMineConversation} />
            ))}
          </div>
        ) : (
          <AdminV2Empty icon={Activity} text="Nenhuma atividade registrada ainda." />
        )}
      </AdminV2PanelCard>

      <div className="grid content-start gap-5">
        <AdminV2PanelCard>
          <AdminV2PanelTitle icon={LayoutDashboard} title="Resumo do recorte" text={selectedClientId === "all" ? "Todos os clientes do banco online." : "Dados do cliente selecionado."} />
          <div className="grid gap-3">
            <AdminV2DataRow icon={Users} label="Clientes" detail="Contas no recorte" value={stats.totalUsers} />
            <AdminV2DataRow icon={FileText} label="Conteúdos" detail={`${stats.subjectCount} matérias`} value={stats.contentCount} />
            <AdminV2DataRow icon={ListChecks} label="Tarefas abertas" detail={`${stats.doneTasks} concluídas`} value={stats.openTasks} />
            <AdminV2DataRow icon={MessageCircle} label="Mensagens" detail="Cliente e Mine" value={scopedChats.length} />
          </div>
        </AdminV2PanelCard>

        <AdminV2PanelCard>
          <AdminV2PanelTitle icon={Users} title="Clientes recentes" text="Contas ordenadas pela última atividade." />
          <div className="grid gap-2">
            {recentClients.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => onSelectClient(user.id)}
                className="admin-item admin-item-button p-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="admin-avatar">{adminInitial(user)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[rgb(var(--theme-text))]">{adminDisplayName(user)}</p>
                    <p className="text-xs text-[rgb(var(--theme-muted))]" title={adminDateTime(userLastActivity(data, user))}>ativo {adminRelative(userLastActivity(data, user))}</p>
                  </div>
                  {user.isAdmin ? <AdminV2Badge tone="dark" label="Admin" icon={Shield} /> : <AdminV2MetricPill label={`${clientMetrics(data, user).chatCount} msgs`} />}
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
    <AdminV2PanelCard className="overflow-hidden p-0 md:p-0">
      <div className="p-4 md:p-5">
        <AdminV2PanelTitle icon={MessageCircle} title="Mensagens dos clientes" text="Selecione uma conta para ver o que o usuário mandou e como a Mine respondeu." />
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
                  data-selected={active ? "true" : "false"}
                  className="admin-item admin-item-button mb-1.5 w-full p-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="admin-avatar">{adminInitial(row.user)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-bold text-[rgb(var(--theme-text))]">{adminDisplayName(row.user)}</span>
                        <span className="shrink-0 text-xs text-[rgb(var(--theme-muted))]" title={adminDateTime(row.lastAt)}>{adminRelative(row.lastAt)}</span>
                      </span>
                      <span className="block text-xs text-[rgb(var(--theme-muted))]">
                        {row.clientMessages} do usuário · {row.mineMessages} da Mine{attachmentCount ? ` · ${attachmentCount} anexos` : ""}
                      </span>
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-5 text-[rgb(var(--theme-muted))]">
                    {lastUserMessage ? lastUserMessage.text : "Sem mensagem do usuário."}
                  </p>
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
      <div className="sticky top-0 z-10 border-b border-line bg-panel p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="admin-label">Histórico da conversa</p>
            <h3 className="mt-1 font-display text-xl font-black text-[rgb(var(--theme-text))]">{adminDisplayName(row.user)}</h3>
            <p className="mt-0.5 text-sm text-[rgb(var(--theme-muted))]">{row.clientMessages} mensagens do usuário · {row.mineMessages} respostas da Mine</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "user", "mine"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                aria-pressed={filter === item}
                className="admin-chip px-3 py-1.5 text-xs"
              >
                {item === "all" ? "Tudo" : item === "user" ? "Usuário" : "Mine"}
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
                  <span className="admin-row-icon mt-1 hidden sm:grid" aria-hidden="true">
                    <Bot className="h-4 w-4" />
                  </span>
                ) : null}
                <div className="admin-bubble max-w-[94%] sm:max-w-[82%]" data-role={mine ? "mine" : "user"}>
                  <div className="admin-bubble-head">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[rgb(var(--theme-text))]">
                      {mine ? <Bot className="h-3.5 w-3.5 text-pen" /> : <Users className="h-3.5 w-3.5 text-pen" />}
                      {mine ? "Mine" : adminDisplayName(row.user)}
                    </span>
                    <span className="text-xs text-[rgb(var(--theme-muted))]">{adminDateTime(chat.createdAt)}</span>
                  </div>
                  <div className="px-4 py-3">
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[rgb(var(--theme-text))]">{chat.text}</p>
                    <ChatAttachments attachments={chat.attachments} tone="light" />
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <AdminV2MetricPill label={subject?.name || "Mine geral"} />
                    </div>
                  </div>
                </div>
                {!mine ? (
                  <span className="admin-avatar mt-1 hidden sm:grid" aria-hidden="true">
                    {adminInitial(row.user)}
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
        <AdminV2PanelTitle icon={Users} title="Clientes com conteúdo" text="Clique em uma conta para abrir os conteúdos dela." />
        <div className="grid max-h-[650px] gap-2 overflow-y-auto pr-1">
          {contentClientRows.map((row) => (
            <button
              key={row.user.id}
              type="button"
              onClick={() => onSelectClient(row.user.id)}
              aria-pressed={selectedClientId === row.user.id}
              data-selected={selectedClientId === row.user.id ? "true" : "false"}
              className="admin-item admin-item-button p-3 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="admin-avatar">{adminInitial(row.user)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-[rgb(var(--theme-text))]">{adminDisplayName(row.user)}</span>
                  <span className="block truncate text-xs text-[rgb(var(--theme-muted))]">
                    {row.subjects.length} matérias · {row.materials.length} conteúdos
                  </span>
                </span>
                <span className="admin-num shrink-0 text-sm font-bold text-[rgb(var(--theme-text))]">{row.completion}%</span>
              </div>
              <AdminV2Progress value={row.completion} />
            </button>
          ))}
          {!contentClientRows.length ? <AdminV2Empty text="Nenhum conteúdo cadastrado ainda." /> : null}
        </div>
      </AdminV2PanelCard>

      {selectedContentRow ? (
        <AdminV2ClientContentDetails row={selectedContentRow} data={data} />
      ) : (
        <AdminV2PanelCard>
          <AdminV2PanelTitle icon={Folder} title="Conteúdos por cliente" text="Selecione um cliente para ver matérias, arquivos, links, imagens e anotações." />
          <AdminV2Empty text="Escolha um cliente na lista para abrir os conteúdos dele." />
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
            <div key={subject.id} className="admin-item p-4">
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
      <AdminV2PanelTitle icon={Folder} title={`Conteúdos de ${adminDisplayName(row.user)}`} text="Matérias e materiais salvos por este cliente." />
      <div className="grid gap-3 md:grid-cols-4">
        <AdminV2DataRow icon={BookOpen} label="Matérias" detail="Criadas pelo cliente" value={row.subjects.length} />
        <AdminV2DataRow icon={FileText} label="Conteúdos" detail="Notas, arquivos e links" value={row.materials.length} />
        <AdminV2DataRow icon={ListChecks} label="Tarefas" detail="Ligadas às matérias" value={row.tasks.length} />
        <AdminV2DataRow icon={CheckCircle2} label="Estudado" detail="Conteúdos marcados" value={`${row.completion}%`} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_260px]">
        <div className="grid gap-3">
          {row.subjects.map((subject) => {
            const materials = row.materials.filter((item) => item.subjectId === subject.id);
            const tasks = row.tasks.filter((item) => item.subjectId === subject.id);
            const completion = percent(materials.filter((item) => item.studied).length, materials.length);
            return (
              <div key={subject.id} className="admin-item p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="font-black text-[rgb(var(--theme-text))]">{subject.name}</p>
                    <p className="mt-1 text-sm font-bold text-[rgb(var(--theme-muted))]">{materials.length} conteúdos · {tasks.length} tarefas</p>
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
                  {!materials.length ? <p className="text-sm font-bold text-[rgb(var(--theme-muted))]">Nenhum material nesta matéria.</p> : null}
                </div>
              </div>
            );
          })}
          {!row.subjects.length ? <AdminV2Empty text="Este cliente ainda não criou matérias." /> : null}
        </div>

        <div className="grid content-start gap-3">
          <p className="text-sm font-black uppercase tracking-[.14em] text-pen">Tipos</p>
          {typeRows.map((item) => (
            <AdminV2DataRow key={item.type} icon={FileText} label={item.label} detail="Conteúdos deste cliente" value={item.count} />
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
            <div key={group.user.id} className="admin-item p-4">
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
                          <p className="text-sm font-bold text-[rgb(var(--theme-muted))]">{subject?.name || "Sem matéria"}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <AdminV2Badge tone={task.done ? "green" : task.dueAt < today() ? "red" : "light"} label={task.done ? "Concluída" : task.dueAt < today() ? "Atrasada" : "Aberta"} />
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
              <div key={task.id} className="admin-item p-4">
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
              <div key={chat.id} className="admin-item p-4">
                <div className="flex items-start gap-3">
                  <span className="admin-row-icon admin-row-icon-lg">
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
    <div className="admin-data-row" data-warning={warning ? "true" : "false"}>
      <span className="admin-row-icon" aria-hidden="true">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[rgb(var(--theme-text))]">{label}</p>
        <p className="text-xs text-[rgb(var(--theme-muted))]">{detail}</p>
      </div>
      <p className="admin-data-value">{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</p>
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
      data-kind={record.kind}
      data-clickable={opensConversation ? "true" : "false"}
      className="admin-activity-row w-full text-left"
    >
      <span className="admin-row-icon" aria-hidden="true">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[rgb(var(--theme-text))]">{record.label}</p>
        <p className="mt-0.5 line-clamp-2 text-sm text-[rgb(var(--theme-muted))]">{record.detail}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 pl-2">
        <time className="whitespace-nowrap text-xs text-[rgb(var(--theme-muted))]" dateTime={new Date(record.time).toISOString()} title={adminDateTime(record.time)}>
          {adminRelative(record.time)}
        </time>
        {opensConversation ? (
          <span className="admin-link-hint">
            Abrir conversa
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>
    </Element>
  );
}

export function AdminV2MetricPill({ label }: { label: string }) {
  return <span className="admin-metric-pill">{label}</span>;
}

export function AdminV2Badge({ label, icon: Icon, tone = "green" }: { label: string; icon?: LucideIcon; tone?: "green" | "dark" | "light" | "red" }) {
  return (
    <span className="admin-badge" data-tone={tone}>
      {Icon ? <Icon className="h-3 w-3" aria-hidden="true" /> : null}
      {label}
    </span>
  );
}

export function AdminV2Empty({ text, icon: Icon = Info }: { text: string; icon?: LucideIcon }) {
  return (
    <div className="admin-empty-state">
      <span className="admin-empty-icon" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <p>{text}</p>
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
  type Tone = "admin" | "new" | "active" | "watch" | "idle";
  const result = (label: string, tone: Tone) => ({ label, tone });
  if (user.isAdmin) return result("Administrador", "admin");
  if (age <= 3 * 86400000) return result("Novo cliente", "new");
  if (last <= 7 * 86400000) return result("Ativo", "active");
  if (metrics.subjectCount || metrics.contentCount || metrics.taskCount || metrics.chatCount) return result("Em acompanhamento", "watch");
  return result("Sem dados", "idle");
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

