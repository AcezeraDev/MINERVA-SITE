import React, { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  Eye,
  EyeOff,
  FileText,
  Flame,
  FlaskConical,
  Folder,
  GraduationCap,
  Home,
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
import "./index.css";
import { AdminBackdrop, AuthBackdrop, WorkspaceBackdrop } from "./backgrounds";
import { DepthWord } from "./effects";
import { KnowledgeGlobe, type GlobeNode } from "./globe";
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
} from "./insights";
import {
  AnimatedBar,
  CountUp,
  dur,
  ease,
  Magnetic,
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
} from "./motion";
import { NexusGame, SequenceForgeGame } from "./games/NewMinervaGames";
import { parseSequencePuzzles, type SequencePuzzle } from "../shared/game-core.mjs";
// Regras de XP moram fora de src porque o servidor também precisa delas para
// montar o ranking. Ver shared/xp.mjs.
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
} from "../shared/xp.mjs";
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
  type DailyQuestion,
  type GameAnswer,
} from "../shared/game-meta.mjs";

const Cubes = React.lazy(() => import("./components/Cubes"));

const logoMaskUrl = new URL("../assets/minerva_mark_mask.png", import.meta.url).href;
const storageKey = "minerva-react-v2";
const sessionStorageKey = "minerva-session-v1";
const mineModelStorageKey = "minerva-mine-model-v1";
const navHiddenStorageKey = "minerva-nav-hidden-v1";
const appearanceStorageKey = "minerva-appearance-v1";

type ThemeMode = "dark" | "light";

type AppearanceChoice = {
  themeMode: ThemeMode;
  accentColor: string;
};

const defaultAppearance: AppearanceChoice = { themeMode: "dark", accentColor: "#39F59A" };
const accentPresets = ["#39F59A", "#3B82F6", "#8B5CF6", "#F43F5E", "#F59E0B", "#06B6D4"];

function normalizeAccent(value: string | undefined) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : defaultAppearance.accentColor;
}

function readAppearance(): AppearanceChoice {
  try {
    const saved = JSON.parse(localStorage.getItem(appearanceStorageKey) || "{}") as Partial<AppearanceChoice>;
    return {
      themeMode: saved.themeMode === "light" ? "light" : "dark",
      accentColor: normalizeAccent(saved.accentColor),
    };
  } catch {
    return defaultAppearance;
  }
}

function saveAppearance(value: AppearanceChoice) {
  try {
    localStorage.setItem(appearanceStorageKey, JSON.stringify(value));
  } catch {
    // Sem armazenamento local, a escolha permanece apenas nesta sessÃ£o.
  }
}

function hexRgb(value: string) {
  const hex = normalizeAccent(value).slice(1);
  return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16)] as const;
}

function mixRgb(rgb: readonly [number, number, number], target: number, amount: number) {
  return rgb.map((channel) => Math.round(channel + (target - channel) * amount)).join(" ");
}

function BrandMark({ className = "", label }: { className?: string; label?: string }) {
  const maskId = `minerva-mark-${useId().replace(/:/g, "")}`;
  return (
    <svg
      viewBox="0 0 408 512"
      preserveAspectRatio="xMidYMid meet"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`brand-mark ${className}`}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="408" height="512" style={{ maskType: "luminance" }}>
          <image href={logoMaskUrl} x="0" y="0" width="408" height="512" />
        </mask>
      </defs>
      <rect x="0" y="0" width="408" height="512" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}

/** A barra lateral fica escondida entre visitas se foi assim que a pessoa deixou. */
function readNavHidden(): boolean {
  try {
    return localStorage.getItem(navHiddenStorageKey) === "1";
  } catch {
    return false;
  }
}

function saveNavHidden(hidden: boolean) {
  try {
    localStorage.setItem(navHiddenStorageKey, hidden ? "1" : "0");
  } catch {
    // Sem armazenamento local a escolha vale só para esta sessão.
  }
}

type View =
  | "home"
  | "subject"
  | "agenda"
  | "foco"
  | "progress"
  | "ranking"
  | "mine"
  | "games"
  | "search"
  | "plan"
  | "comments"
  | "suggestions"
  | "about"
  | "perfil"
  | "settings"
  | "admin";

type User = {
  id: string;
  name: string;
  password?: string;
  isAdmin?: boolean;
  createdAt: number;
  settings: {
    displayName: string;
    dailyGoal: number;
    focusMinutes: number;
    mineStyle: "simples" | "equilibrada" | "profunda";
    reminders: boolean;
    reducedMotion?: boolean;
    focusVibrate?: boolean;
    keepScreenOnFocus?: boolean;
    /** Nomes de conta marcados como amigos — viram um filtro do ranking. */
    friends?: string[];
    /** Some do ranking dos outros sem perder o próprio. */
    hideFromRanking?: boolean;
    /** Foto de perfil já recortada em 192px (data URL). */
    avatar?: string;
    /** Uma linha sobre a pessoa, no perfil. */
    bio?: string;
    /** Tema e cor seguem a conta e tambÃ©m colorem a tela de entrada. */
    themeMode?: ThemeMode;
    accentColor?: string;
  };
};

type Subject = {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon: IconName;
  favorite: boolean;
  createdAt: number;
};

type Material = {
  id: string;
  userId: string;
  subjectId: string;
  title: string;
  type: "note" | "file" | "link" | "image";
  detail: string;
  dataUrl?: string;
  content?: string;
  folder: string;
  studied: boolean;
  /** Quando foi marcado como estudado. Alimenta o XP por dia/semana do ranking. */
  studiedAt?: number;
  favorite: boolean;
  createdAt: number;
};

type Task = {
  id: string;
  userId: string;
  subjectId: string;
  title: string;
  note: string;
  dueAt: number;
  done: boolean;
  /** Quando foi concluída. Alimenta o XP por dia/semana do ranking. */
  doneAt?: number;
  createdAt: number;
};

type ChatAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  kind: "image" | "file";
  dataUrl: string;
  text?: string;
};

type ChatMessage = {
  id: string;
  userId: string;
  subjectId?: string;
  role: "user" | "mine";
  text: string;
  attachments?: ChatAttachment[];
  /** Nível da Mine que respondeu. Só existe em mensagens de resposta. */
  mineModel?: MineModelId;
  /** Fontes da web citadas na resposta, quando a pesquisa esteve ligada. */
  sources?: MineSource[];
  createdAt: number;
};

type MineSource = { url: string; title: string };

/**
 * Níveis da Mine. O navegador só conhece estes apelidos e os nomes de marca —
 * qual modelo real roda por trás é decidido no servidor, em mine/models.mjs.
 */
type MineModelId = "terra" | "lua" | "sol" | "supernova" | "verso";

const mineModels: Array<{ id: MineModelId; name: string; tagline: string; description: string }> = [
  { id: "terra", name: "Mine Terra", tagline: "Rápido e eficiente", description: "Ideal para tarefas do dia a dia." },
  { id: "lua", name: "Mine Lua", tagline: "Inteligente e versátil", description: "Ótimo para estudos, escrita e programação." },
  { id: "sol", name: "Mine Sol", tagline: "Inteligência avançada", description: "Mais capacidade para raciocínio e conteúdo multimodal." },
  { id: "supernova", name: "Mine SuperNova", tagline: "Raciocínio avançado", description: "Para problemas e projetos complexos." },
  { id: "verso", name: "Mine Verso", tagline: "Máxima inteligência", description: "O modelo mais poderoso da família Mine." },
];

const defaultMineModel: MineModelId = "lua";

function isMineModelId(value: unknown): value is MineModelId {
  return mineModels.some((model) => model.id === value);
}

function readMineModel(): MineModelId {
  try {
    const stored = localStorage.getItem(mineModelStorageKey);
    return isMineModelId(stored) ? stored : defaultMineModel;
  } catch {
    return defaultMineModel;
  }
}

function saveMineModel(model: MineModelId) {
  try {
    localStorage.setItem(mineModelStorageKey, model);
  } catch {
    // Sem armazenamento local a escolha simplesmente não persiste.
  }
}

function mineModelInfo(id?: MineModelId) {
  return mineModels.find((model) => model.id === id);
}

type AssistantAction =
  | { type: "navigate"; view: View | "subject"; subjectId?: string; subjectName?: string; query?: string }
  | { type: "search"; query: string }
  | { type: "create_subject"; name: string; color?: string; icon?: IconName }
  | { type: "create_material"; subjectId?: string; subjectName?: string; title: string; detail?: string; materialType?: Material["type"]; studied?: boolean }
  | { type: "create_task"; subjectId?: string; subjectName?: string; title: string; note?: string; dueInDays?: number }
  | { type: "mark_material_studied"; materialId?: string; title?: string; subjectName?: string }
  | { type: "complete_task"; taskId?: string; title?: string; subjectName?: string }
  | { type: "set_focus_minutes"; minutes: number }
  | { type: "set_display_name"; name: string };

type AssistantResponse = {
  reply: string;
  actions: AssistantAction[];
  suggestions: string[];
  /** Nível que de fato respondeu — pode diferir do pedido se houve fallback. */
  model?: MineModelId;
  /** Aviso curto e discreto quando a resposta veio de um nível alternativo. */
  notice?: string;
  sources?: MineSource[];
};

type Session = {
  id: string;
  userId: string;
  subjectId: string;
  title: string;
  kind: string;
  createdAt: number;
  xpEarned?: number;
  correctAnswers?: number;
  questionsAnswered?: number;
  gameId?: string;
  gameName?: string;
  score?: number;
  record?: boolean;
  durationMs?: number;
  answers?: GameAnswer[];
  accuracy?: number;
  seasonId?: string;
  dailyChallenge?: boolean;
  dailyKey?: string;
  mode?: "standard" | "daily" | "review";
  reviewedErrorIds?: string[];
  reviewCount?: number;
};

type Flashcard = {
  id: string;
  userId: string;
  subjectId: string;
  front: string;
  back: string;
  level: number;
  dueAt: number;
  reps: number;
  lapses: number;
  /** Última revisão. Alimenta o XP por dia/semana do ranking. */
  lastReviewedAt?: number;
  createdAt: number;
};

type SiteComment = {
  id: string;
  userId: string;
  name: string;
  text: string;
  rating: number;
  createdAt: number;
};

type UpdateCategory = "novidade" | "melhoria" | "correcao";

type SiteUpdate = {
  id: string;
  title: string;
  body: string;
  category: UpdateCategory;
  createdAt: number;
};

type SiteSuggestion = {
  id: string;
  userId: string;
  name: string;
  category: "ideia" | "melhoria" | "erro" | "conteudo";
  text: string;
  status: "nova" | "analisando" | "planejada" | "concluida" | "recusada";
  createdAt: number;
};

type AppData = {
  users: User[];
  currentUserId: string | null;
  currentAdminUserId: string | null;
  subjects: Subject[];
  materials: Material[];
  tasks: Task[];
  chats: ChatMessage[];
  sessions: Session[];
  flashcards: Flashcard[];
  comments: SiteComment[];
  suggestions: SiteSuggestion[];
  updates: SiteUpdate[];
};

type SessionState = {
  currentUserId: string | null;
  currentAdminUserId: string | null;
  token: string | null;
};

type SyncStatus = "conectando" | "online" | "salvando" | "offline";

type AuthPayload = {
  mode: "login" | "register";
  name: string;
  password: string;
  adminMode: boolean;
  adminPassword: string;
};

type IconName =
  | "book"
  | "math"
  | "physics"
  | "chemistry"
  | "biology"
  | "science"
  | "history"
  | "geography"
  | "language"
  | "writing"
  | "code"
  | "art"
  | "music"
  | "sports"
  | "economy"
  | "law"
  | "health"
  | "school";

type Modal =
  | { type: "subject" }
  | { type: "material"; subjectId: string }
  | { type: "materialView"; materialId: string }
  | { type: "task"; subjectId?: string }
  | { type: "quiz"; subjectId: string }
  | { type: "mindmap"; subjectId: string }
  | { type: "flashcards"; subjectId: string }
  | { type: "confirm"; title: string; body: string; onConfirm: () => void };

const iconMap: Record<IconName, LucideIcon> = {
  book: BookOpen,
  math: Calculator,
  physics: Atom,
  chemistry: FlaskConical,
  biology: Dna,
  science: Microscope,
  history: Landmark,
  geography: Globe,
  language: Languages,
  writing: Pencil,
  code: Code2,
  art: Palette,
  music: Music,
  sports: Dumbbell,
  economy: TrendingUp,
  law: Scale,
  health: HeartPulse,
  school: GraduationCap,
};

const iconLabels: Record<IconName, string> = {
  book: "Livros",
  math: "Matemática",
  physics: "Física",
  chemistry: "Química",
  biology: "Biologia",
  science: "Ciências",
  history: "História",
  geography: "Geografia",
  language: "Idiomas",
  writing: "Redação",
  code: "Código",
  art: "Arte",
  music: "Música",
  sports: "Esportes",
  economy: "Economia",
  law: "Direito",
  health: "Saúde",
  school: "Geral",
};

/**
 * Paleta das matérias. Ampliada a pedido de usuário (sugestão do brenasso):
 * eram 8 cores, agora 24 cobrindo o círculo cromático inteiro em duas
 * intensidades, mais os neutros. Quem quiser um tom fora daqui usa o seletor
 * cromático do sistema, que fica ao lado.
 */
const subjectPalette = [
  "#34D399", "#10B981", "#22D3EE", "#38BDF8", "#60A5FA", "#818CF8",
  "#A78BFA", "#C084FC", "#E879F9", "#F472B6", "#FB7185", "#F87171",
  "#FB923C", "#FBBF24", "#FACC15", "#A3E635", "#4ADE80", "#2DD4BF",
  "#F0ABFC", "#FDA4AF", "#FCD34D", "#FFFFFF", "#D2D2D8", "#94A3B8",
];

const navItems: Array<{ view: View; label: string; icon: LucideIcon }> = [
  { view: "home", label: "Início", icon: Home },
  { view: "agenda", label: "Agenda", icon: CalendarDays },
  { view: "foco", label: "Foco", icon: Timer },
  { view: "progress", label: "Progresso", icon: Activity },
  { view: "ranking", label: "Ranking", icon: Trophy },
  { view: "mine", label: "Mine", icon: Bot },
  { view: "games", label: "Games com a Mine", icon: Gamepad2 },
  { view: "search", label: "Busca", icon: Search },
  { view: "plan", label: "Plano de estudos", icon: CalendarPlus },
  { view: "comments", label: "Comentários", icon: MessageCircle },
  { view: "suggestions", label: "Sugestões", icon: Sparkles },
  { view: "about", label: "Sobre", icon: Info },
  { view: "perfil", label: "Perfil e ajustes", icon: Settings },
  { view: "admin", label: "Admin", icon: Shield },
];

/** A barra lateral agrupa os destinos em quatro blocos para virar uma lista escaneável. */
const navGroups: Array<{ label: string; views: View[] }> = [
  { label: "Estudo", views: ["home", "agenda", "foco", "progress", "ranking"] },
  { label: "Inteligência", views: ["mine", "games", "search", "plan"] },
  { label: "Comunidade", views: ["comments", "suggestions"] },
  { label: "Conta", views: ["about", "perfil", "admin"] },
];

/** Barra inferior mobile: só os 4 destinos de uso diário; o resto vive na gaveta "Mais". */
const mobilePrimary: View[] = ["home", "agenda", "foco", "mine"];

function navItemOf(view: View) {
  return navItems.find((item) => item.view === view);
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const maxChatAttachments = 4;
const maxAttachmentDataUrlLength = 1_200_000;
const maxRawFileBytes = 900_000;
const maxExtractableBytes = 20_000_000;
const maxExtractedChars = 60_000;
const maxChatAttachmentTextChars = 12_000;

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Nao foi possivel ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Nao foi possivel ler o texto do arquivo."));
    reader.readAsText(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nao foi possivel carregar a imagem."));
    image.src = dataUrl;
  });
}

async function imageFileToDataUrl(file: File) {
  const original = await readFileAsDataUrl(file);
  const image = await loadImage(original);
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return original;
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.78);
}

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

async function inflateRaw(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipTextEntries(file: File, match: (name: string) => boolean): Promise<Array<{ name: string; text: string }>> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let eocd = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 22 - 65_535); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) return [];
  const decoder = new TextDecoder();
  const total = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries: Array<{ name: string; text: string }> = [];
  for (let count = 0; count < total; count += 1) {
    if (offset + 46 > buffer.length || view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(buffer.subarray(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
    if (!match(name)) continue;
    if (localOffset + 30 > buffer.length || view.getUint32(localOffset, true) !== 0x04034b50) continue;
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(start, start + compressedSize);
    try {
      const bytes = method === 8 ? await inflateRaw(raw) : method === 0 ? raw : null;
      if (bytes) entries.push({ name, text: decoder.decode(bytes) });
    } catch {
      // Entrada corrompida: ignora e tenta as demais.
    }
  }
  return entries;
}

function officeXmlToText(xml: string): string {
  return xml
    .replace(/<\/(?:w|a):p>/g, "\n")
    .replace(/<(?:w|a):br[^>]*\/?>/g, "\n")
    .replace(/<w:tab[^>]*\/?>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const documentProxy = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    standardFontDataUrl: "/standard_fonts/",
  }).promise;
  try {
    const parts: string[] = [];
    let length = 0;
    const pages = Math.min(documentProxy.numPages, 60);
    for (let page = 1; page <= pages && length < maxExtractedChars; page += 1) {
      const content = await (await documentProxy.getPage(page)).getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (!text) continue;
      parts.push(text);
      length += text.length;
    }
    return parts.join("\n\n");
  } finally {
    await documentProxy.destroy();
  }
}

async function extractOfficeText(file: File, kind: "docx" | "pptx"): Promise<string> {
  const wanted =
    kind === "docx"
      ? (name: string) => name === "word/document.xml"
      : (name: string) => /^ppt\/slides\/slide\d+\.xml$/.test(name);
  const entries = await readZipTextEntries(file, wanted);
  if (kind === "pptx") {
    entries.sort((a, b) => Number(a.name.match(/(\d+)/)?.[1] || 0) - Number(b.name.match(/(\d+)/)?.[1] || 0));
  }
  return entries
    .map((entry) => officeXmlToText(entry.text))
    .filter(Boolean)
    .join("\n\n");
}

async function extractFileText(file: File): Promise<string | undefined> {
  if (file.size > maxExtractableBytes) return undefined;
  const name = file.name.toLowerCase();
  try {
    let text = "";
    if (/^text\//.test(file.type) || /\.(txt|md|csv|json)$/.test(name)) {
      text = await readFileAsText(file);
    } else if (file.type === "application/pdf" || name.endsWith(".pdf")) {
      text = await extractPdfText(file);
    } else if (name.endsWith(".docx")) {
      text = await extractOfficeText(file, "docx");
    } else if (name.endsWith(".pptx")) {
      text = await extractOfficeText(file, "pptx");
    }
    return text.slice(0, maxExtractedChars).trim() || undefined;
  } catch {
    return undefined;
  }
}

async function fileToChatAttachment(file: File): Promise<ChatAttachment> {
  const kind: ChatAttachment["kind"] = file.type.startsWith("image/") ? "image" : "file";
  const baseAttachment = {
    id: uid("att"),
    name: file.name.slice(0, 90) || "arquivo",
    type: file.type || "application/octet-stream",
    size: file.size,
    kind,
  };
  if (kind === "image") {
    const dataUrl = await imageFileToDataUrl(file);
    if (dataUrl.length > maxAttachmentDataUrlLength) {
      throw new Error(`${file.name} ficou muito grande para salvar no chat. Tente uma imagem menor.`);
    }
    return { ...baseAttachment, dataUrl };
  }
  const text = (await extractFileText(file))?.slice(0, maxChatAttachmentTextChars);
  let dataUrl = "";
  if (file.size <= maxRawFileBytes) {
    const raw = await readFileAsDataUrl(file);
    if (raw.length <= maxAttachmentDataUrlLength) dataUrl = raw;
  }
  if (!text && !dataUrl) {
    throw new Error(`Nao consegui ler ${file.name}. Envie PDF, Word, PowerPoint, texto ou imagem de ate ${formatFileSize(maxRawFileBytes)}.`);
  }
  return { ...baseAttachment, dataUrl, text };
}

function today() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Concluir e desmarcar passam por aqui, e não por um spread solto, porque o
 * ranking por dia e semana depende do instante da conclusão. Desmarcar limpa a
 * data: senão a tarefa continuaria valendo XP naquela janela.
 */
function toggleDone(task: Task, done: boolean): Task {
  return { ...task, done, doneAt: done ? Date.now() : undefined };
}

function toggleStudied(material: Material, studied: boolean): Material {
  return { ...material, studied, studiedAt: studied ? Date.now() : undefined };
}

function addDays(days: number) {
  return today() + days * 86400000;
}

function coerceData(parsed: Partial<AppData> | null | undefined): AppData {
  return {
    users: parsed?.users || [],
    currentUserId: parsed?.currentUserId || null,
    currentAdminUserId: parsed?.currentAdminUserId || null,
    subjects: parsed?.subjects || [],
    materials: parsed?.materials || [],
    tasks: parsed?.tasks || [],
    chats: parsed?.chats || [],
    sessions: parsed?.sessions || [],
    flashcards: parsed?.flashcards || [],
    comments: parsed?.comments || [],
    suggestions: parsed?.suggestions || [],
    updates: parsed?.updates || [],
  };
}

function readData(): AppData {
  try {
    return coerceData(JSON.parse(localStorage.getItem(storageKey) || "{}") as Partial<AppData>);
  } catch {
    return emptyData();
  }
}

function emptyData(): AppData {
  return { users: [], currentUserId: null, currentAdminUserId: null, subjects: [], materials: [], tasks: [], chats: [], sessions: [], flashcards: [], comments: [], suggestions: [], updates: [] };
}

function emptySession(): SessionState {
  return { currentUserId: null, currentAdminUserId: null, token: null };
}

function readSession(): SessionState {
  try {
    const parsed = JSON.parse(localStorage.getItem(sessionStorageKey) || "{}") as Partial<SessionState>;
    return {
      currentUserId: parsed.currentUserId || null,
      currentAdminUserId: parsed.currentAdminUserId || null,
      token: parsed.token || null,
    };
  } catch {
    return emptySession();
  }
}

function saveSession(session: SessionState) {
  localStorage.setItem(sessionStorageKey, JSON.stringify(session));
}

function withSession(data: AppData, session: SessionState): AppData {
  return {
    ...data,
    currentUserId: session.currentUserId,
    currentAdminUserId: session.currentAdminUserId,
  };
}

function dataForServer(data: AppData): AppData {
  return {
    ...data,
    users: data.users.map(({ password: _password, ...user }) => user),
    currentUserId: null,
    currentAdminUserId: null,
  };
}

async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  let response: Response;
  try {
    response = await fetch(path, { ...options, headers });
  } catch {
    throw new Error("O servidor está indisponível agora. Verifique sua conexão e tente novamente.");
  }
  const raw = await response.text();
  let payload: { error?: string } = {};
  try {
    payload = raw ? (JSON.parse(raw) as { error?: string }) : {};
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const fallback = response.status === 401
      ? "Sua sessão expirou. Entre novamente."
      : response.status === 404
        ? "Este serviço ainda não está disponível nesta versão. Atualize a página e tente novamente."
        : "Não foi possível concluir a solicitação agora.";
    throw new Error(payload.error || fallback);
  }
  return payload as T;
}

function routeFromHash(): { view: View; id?: string } {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [view, id] = raw.split("/");
  // "settings" virou "perfil" quando as duas telas se juntaram; links velhos
  // (e a memória muscular de quem já usava) continuam funcionando.
  if (view === "settings") return { view: "perfil", id };
  const valid = navItems.some((item) => item.view === view) || view === "subject";
  return { view: (valid ? view : "home") as View, id };
}

function go(view: View, id?: string) {
  window.location.hash = id ? `#/${view}/${id}` : `#/${view}`;
}

function dateLabel(timestamp: number) {
  const diff = Math.round((timestamp - today()) / 86400000);
  if (diff < 0) return "Atrasada";
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  return `Em ${diff} dias`;
}

function shortDate(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(timestamp));
}

function timeLabel(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}

function percent(done: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

function Splash() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="minerva-splash fixed inset-0 z-50 grid place-items-center overflow-hidden bg-ink text-white"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, filter: "blur(16px)", scale: 1.06 }}
      transition={{ duration: 0.5, ease: ease.inOut }}
    >
      <div className="absolute left-1/2 top-[42%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-mint/20 blur-[130px]" />
      <div className="absolute left-[30%] top-[62%] h-[300px] w-[300px] rounded-full bg-cyanGlow/15 blur-[120px]" />
      <div className="absolute inset-0 bg-grid-fade opacity-50" />
      <div className="absolute inset-0 bg-noise opacity-[0.04] mix-blend-soft-light" />

      <motion.div
        className="relative z-10 flex flex-col items-center px-8 text-center"
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: ease.out }}
      >
        <div className="relative grid place-items-center [perspective:900px]">
          {!reduce ? (
            <>
              <motion.svg
                viewBox="0 0 200 200"
                className="absolute h-60 w-60"
                animate={{ rotate: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
              >
                <circle cx="100" cy="100" r="94" fill="none" stroke="rgb(var(--mint))" strokeWidth="2" strokeLinecap="round" strokeDasharray="150 440" />
                <circle cx="100" cy="100" r="94" fill="none" stroke="rgba(56,189,248,.5)" strokeWidth="2" strokeLinecap="round" strokeDasharray="46 544" strokeDashoffset="300" />
              </motion.svg>
              <motion.svg
                viewBox="0 0 200 200"
                className="absolute h-[19rem] w-[19rem]"
                animate={{ rotate: -360 }}
                transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
              >
                <circle cx="100" cy="100" r="96" fill="none" stroke="rgba(255,255,255,.10)" strokeWidth="1" strokeDasharray="3 12" />
              </motion.svg>
              <motion.span
                className="absolute h-40 w-40 rounded-[34px] border border-mint/40"
                animate={{ scale: [0.9, 1.5], opacity: [0.55, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: ease.out }}
              />
            </>
          ) : null}
          <motion.div
            className="grid h-28 w-28 place-items-center rounded-[28px] border border-mint/25 bg-mint/10 p-2 shadow-glow"
            animate={reduce ? undefined : { scale: [1, 1.05, 1], rotateY: [0, 12, 0, -12, 0] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <BrandMark label="Minerva" className="h-full w-full" />
          </motion.div>
        </div>

        <motion.h1
          className="mt-10 font-display text-5xl font-black text-aurora"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: ease.out }}
        >
          Minerva
        </motion.h1>
        <motion.div
          className="mt-3 h-[3px] w-16 origin-left rounded-full bg-gradient-to-r from-mint to-cyanGlow"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.35, ease: ease.out }}
        />
        <motion.p className="mt-4 text-lg text-white/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.45 }}>
          Organize. Estude. Conquiste.
        </motion.p>

        {reduce ? (
          <p className="mt-8 text-sm text-white/45">Carregando…</p>
        ) : (
          <>
            <div className="mt-9 h-1.5 w-52 overflow-hidden rounded-full bg-white/10">
              <motion.span
                className="block h-full rounded-full bg-gradient-to-r from-mint via-cyanGlow to-mint"
                initial={{ x: "-100%" }}
                animate={{ x: ["-100%", "0%", "100%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: ease.inOut }}
              />
            </div>
            <div className="mt-5 flex items-center gap-2">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-mint"
                  animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.25, 0.8] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
            </div>
          </>
        )}
      </motion.div>
      <p className="absolute bottom-10 z-10 text-xs font-black uppercase tracking-[.2em] text-mint/70">com a Mine</p>
    </motion.div>
  );
}

const splashOrbitItems: Array<{ label: string; detail: string; icon: LucideIcon }> = [
  { label: "Matérias", detail: "conectadas", icon: BookOpen },
  { label: "Foco", detail: "em sintonia", icon: Timer },
  { label: "Provas", detail: "preparadas", icon: ClipboardCheck },
  { label: "Conquistas", detail: "no percurso", icon: Trophy },
];

function SplashV2({ onSkip }: { onSkip: () => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="minerva-splash minerva-splash-v2 fixed inset-0 z-50 grid place-items-center overflow-hidden"
      data-reduced-motion={reduce ? "true" : "false"}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, filter: "blur(10px)", scale: 1.025 }}
      transition={{ duration: 0.52, ease: ease.inOut }}
    >
      <button type="button" onClick={onSkip} className="splash-skip absolute right-4 top-4 z-30 rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-xs font-black uppercase tracking-[.12em] text-white/45 transition hover:border-mint/35 hover:text-mint sm:right-7 sm:top-7">Pular</button>

      <div className="splash-ambient" aria-hidden>
        <span className="splash-aura splash-aura-main" />
        <span className="splash-aura splash-aura-side" />
        <span className="splash-beam splash-beam-a" />
        <span className="splash-beam splash-beam-b" />
        <span className="splash-floor" />
        <span className="splash-scanline" />
        {Array.from({ length: 10 }, (_, index) => <span key={index} className={`splash-star splash-star-${index + 1}`} />)}
      </div>

      <div className="splash-scene relative z-10 w-full max-w-[900px] px-4 text-center sm:px-8">
        <div className="splash-system relative mx-auto">
          <span className="splash-system-ring splash-system-ring-a" aria-hidden />
          <span className="splash-system-ring splash-system-ring-b" aria-hidden />
          <span className="splash-system-ring splash-system-ring-c" aria-hidden />
          <svg className="splash-connections absolute inset-0 h-full w-full" viewBox="0 0 800 430" aria-hidden>
            <path d="M 400 215 C 315 175, 238 138, 135 116" />
            <path d="M 400 215 C 487 173, 570 140, 666 116" />
            <path d="M 400 215 C 315 264, 250 304, 164 342" />
            <path d="M 400 215 C 490 263, 555 304, 638 342" />
          </svg>

          {splashOrbitItems.map(({ label, detail, icon: Icon }, index) => (
            <motion.div
              key={label}
              className={`splash-orbit-module splash-orbit-module-${index + 1}`}
              initial={{ opacity: 0, scale: 0.55, x: index % 2 === 0 ? 18 : -18 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.35 + index * 0.09, ease: ease.out }}
            >
              <span className="splash-module-card" style={{ animationDelay: `${index * -0.55}s` }}>
                <span className="splash-module-icon"><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 text-left"><strong>{label}</strong><small>{detail}</small></span>
                <span className="splash-module-status" />
              </span>
            </motion.div>
          ))}

          <motion.div
            className="splash-robot-stage absolute left-1/2 top-1/2"
            initial={{ opacity: 0, scale: 0.58, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.72, delay: 0.08, ease: ease.out }}
          >
            <span className="splash-robot-signal splash-robot-signal-a" aria-hidden />
            <span className="splash-robot-signal splash-robot-signal-b" aria-hidden />
            <motion.div
              className="splash-robot"
              animate={reduce ? undefined : { y: [0, -7, 0], rotateZ: [0, -1.5, 0, 1.5, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <span className="splash-robot-antenna"><i /></span>
              <span className="splash-robot-ear splash-robot-ear-left" />
              <span className="splash-robot-ear splash-robot-ear-right" />
              <span className="splash-robot-arm splash-robot-arm-left" />
              <span className="splash-robot-arm splash-robot-arm-right" />
              <span className="splash-robot-screen"><BrandMark label="Mine, assistente de estudos" className="h-[86%] w-[86%]" /><i className="splash-robot-glint" /></span>
            </motion.div>
            <span className="splash-robot-shadow" aria-hidden />
          </motion.div>
        </div>

        <motion.div className="splash-copy" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.62, delay: 0.42, ease: ease.out }}>
          <span className="splash-online"><i /> Mine online</span>
          <h1>Minerva</h1>
          <p>Sua central de estudos está acordando.</p>
        </motion.div>

        <motion.div className="splash-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.72 }}>
          <div className="splash-loading-track"><motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.65, delay: 0.55, ease: ease.inOut }} /></div>
          <div className="splash-loading-copy"><span>Conectando sua jornada</span><span>Organize · Estude · Conquiste</span></div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/** Fina barra no topo mostrando o quanto da página já foi lida. */
function ScrollProgressBar() {
  const progress = useScrollProgress();
  const reduced = useSoftMotion();
  if (reduced) return null;
  return (
    <motion.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-gradient-to-r from-mint via-cyanGlow to-violetGlow"
      style={{ scaleX: progress }}
    />
  );
}

function App() {
  const [data, setData] = useState<AppData>(() => withSession(readData(), readSession()));
  const [guestAppearance, setGuestAppearance] = useState<AppearanceChoice>(() => readAppearance());
  const [showIntro, setShowIntro] = useState(true);
  const [route, setRoute] = useState(() => routeFromHash());
  const [modal, setModal] = useState<Modal | null>(null);
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [mineInput, setMineInput] = useState("");
  const [mineLoading, setMineLoading] = useState(false);
  const [mineSuggestions, setMineSuggestions] = useState<string[]>([]);
  const [mineModel, setMineModelState] = useState<MineModelId>(() => readMineModel());
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | undefined>();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("conectando");
  const [databaseMode, setDatabaseMode] = useState("backend");
  const [mineStreamText, setMineStreamText] = useState("");
  const [mineWebSearch, setMineWebSearch] = useState(false);
  // A pesquisa na web é paga e fica atrás de uma flag no servidor. O botão só
  // aparece se o servidor disser que ela está ligada.
  const [mineWebAvailable, setMineWebAvailable] = useState(false);
  const [navHidden, setNavHiddenState] = useState(() => readNavHidden());
  const saveReadyRef = useRef(false);
  const skipNextSaveRef = useRef(false);
  // Controla a geração em curso: o botão parar aborta por aqui.
  const mineAbortRef = useRef<AbortController | null>(null);
  // O texto parcial precisa de ref porque o handler de erro lê o valor mais
  // recente, e o estado dentro da closure ficaria velho.
  const mineStreamRef = useRef("");
  // Quando a cota do provedor principal acaba, TODA mensagem vem do modelo
  // alternativo. Avisar em cada uma vira ruído, então o aviso sai uma vez só.
  const fallbackNoticeRef = useRef(false);

  // A escolha do nível fica no aparelho: ao voltar, a Mine abre no mesmo nível.
  function setMineModel(model: MineModelId) {
    setMineModelState(model);
    saveMineModel(model);
  }

  const setNavHidden = useCallback((hidden: boolean) => {
    setNavHiddenState(hidden);
    saveNavHidden(hidden);
  }, []);

  // Ctrl/Cmd + B recolhe a barra lateral, como em editor de código.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "b" && event.key !== "B") return;
      if (!event.ctrlKey && !event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      event.preventDefault();
      setNavHiddenState((current) => {
        saveNavHidden(!current);
        return !current;
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(mineEndpoint)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (alive && data?.webSearch) setMineWebAvailable(true);
      })
      .catch(() => {
        // Sem resposta, a pesquisa continua escondida. Não é erro para o usuário.
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    if (!window.location.hash) go("home");
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const session = readSession();
    if (!session.token) {
      setSyncStatus("offline");
      saveReadyRef.current = true;
      return;
    }

    apiJson<{ data: AppData; database: string }>("/api/data", {
      headers: { authorization: `Bearer ${session.token}` },
    })
      .then((response) => {
        if (cancelled) return;
        setDatabaseMode(response.database);
        setSyncStatus("online");
        saveReadyRef.current = true;
        skipNextSaveRef.current = true;
        setData(withSession(coerceData(response.data), session));
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "";
        if (message.includes("Sessão expirada")) {
          const blank = emptySession();
          saveSession(blank);
          setData((current) => withSession(current, blank));
        }
        setSyncStatus("offline");
        saveReadyRef.current = true;
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const currentSession = readSession();
    const nextSession = {
      ...currentSession,
      currentUserId: data.currentUserId,
      currentAdminUserId: data.currentAdminUserId,
    };
    saveSession(nextSession);
    localStorage.setItem(storageKey, JSON.stringify(data));

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    if (!saveReadyRef.current || !nextSession.token) return;
    setSyncStatus("salvando");
    const timer = window.setTimeout(() => {
      apiJson<{ data: AppData; database: string }>("/api/data", {
        method: "PUT",
        headers: { authorization: `Bearer ${nextSession.token}` },
        body: JSON.stringify({ data: dataForServer(data) }),
      })
        .then((response) => {
          setDatabaseMode(response.database);
          setSyncStatus("online");
        })
        .catch(() => setSyncStatus("offline"));
    }, 650);

    return () => window.clearTimeout(timer);
  }, [data]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowIntro(false), 2800);
    return () => window.clearTimeout(timer);
  }, []);

  const user = data.users.find((item) => item.id === data.currentUserId) || null;
  const appearance: AppearanceChoice = {
    themeMode: user?.settings.themeMode || guestAppearance.themeMode,
    accentColor: normalizeAccent(user?.settings.accentColor || guestAppearance.accentColor),
  };

  useEffect(() => {
    const root = document.documentElement;
    const rgb = hexRgb(appearance.accentColor);
    root.classList.toggle("theme-light", appearance.themeMode === "light");
    root.style.colorScheme = appearance.themeMode;
    const uiRgb: [number, number, number] = appearance.themeMode === "light"
      ? [Math.round(rgb[0] * 0.78), Math.round(rgb[1] * 0.78), Math.round(rgb[2] * 0.78)]
      : [rgb[0], rgb[1], rgb[2]];
    root.style.setProperty("--mint", uiRgb.join(" "));
    root.style.setProperty("--mint-deep", mixRgb(uiRgb, 0, 0.2));
    root.style.setProperty("--accent-soft", `${uiRgb.join(" ")} / 0.12`);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", appearance.themeMode === "light" ? "#F1F6F2" : "#070D0A");
    saveAppearance(appearance);
  }, [appearance.themeMode, appearance.accentColor]);

  const userData = useMemo(() => {
    if (!user) return { subjects: [], materials: [], tasks: [], chats: [], sessions: [], flashcards: [], comments: [], suggestions: [], updates: [] };
    return {
      subjects: data.subjects.filter((item) => item.userId === user.id),
      materials: data.materials.filter((item) => item.userId === user.id),
      tasks: data.tasks.filter((item) => item.userId === user.id),
      chats: data.chats.filter((item) => item.userId === user.id),
      sessions: data.sessions.filter((item) => item.userId === user.id),
      flashcards: data.flashcards.filter((item) => item.userId === user.id),
      comments: data.comments,
      suggestions: data.suggestions,
      updates: data.updates,
    };
  }, [data, user]);

  const rewards = useMemo(() => (user ? gamificationOf(userData) : null), [userData, user]);

  useEffect(() => {
    if (!user || !rewards) return;
    const key = `minerva-rewards-v1-${user.id}`;
    let stored: { level: number; achievements: string[] } | null = null;
    try {
      stored = JSON.parse(localStorage.getItem(key) || "null");
    } catch {}
    const unlockedIds = rewards.unlocked.map((item) => item.id);
    if (stored) {
      if (rewards.level > stored.level) {
        setToast(`🏆 Você subiu para o nível ${rewards.level}! Veja suas recompensas em Progresso.`);
      } else {
        const fresh = rewards.unlocked.filter((item) => !stored!.achievements.includes(item.id));
        if (fresh.length) {
          const bonus = fresh.reduce((sum, item) => sum + item.xp, 0);
          setToast(`🏆 Conquista desbloqueada: ${fresh[0].title}${fresh.length > 1 ? ` e mais ${fresh.length - 1}` : ""} (+${bonus} XP)`);
        }
      }
    }
    localStorage.setItem(key, JSON.stringify({ level: rewards.level, achievements: unlockedIds }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, rewards?.xp]);

  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = Boolean(prefersReducedMotion || user?.settings.reducedMotion);

  // Aparelho sem folga desliga o vidro (backdrop-filter) via CSS, sem o React
  // ter de saber quais superfícies existem. Movimento reduzido entra junto:
  // sem fundo animado, o vidro deixa de ser o gargalo, mas quem pediu menos
  // movimento também não perde nada com a superfície mais sóbria.
  const qualityTier = useQualityTier();
  const lowFx = qualityTier === "low" || reducedMotion;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("no-motion", reducedMotion);
    root.classList.toggle("low-fx", lowFx);
    return () => {
      root.classList.remove("no-motion");
      root.classList.remove("low-fx");
    };
  }, [reducedMotion, lowFx]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  }, [route.view, route.id, user?.id, reducedMotion]);

  const hasAdminAccessForSync = Boolean(user?.isAdmin);

  useEffect(() => {
    if (route.view !== "admin" || !hasAdminAccessForSync) return;
    let cancelled = false;

    const refreshAdminData = () => {
      const session = readSession();
      if (!session.token) return;

      apiJson<{ data: AppData; database: string }>("/api/data", {
        headers: { authorization: `Bearer ${session.token}` },
      })
        .then((response) => {
          if (cancelled) return;
          setDatabaseMode(response.database);
          setSyncStatus("online");
          saveReadyRef.current = true;
          skipNextSaveRef.current = true;
          setData(withSession(coerceData(response.data), session));
        })
        .catch(() => {
          if (!cancelled) setSyncStatus("offline");
        });
    };

    refreshAdminData();
    const timer = window.setInterval(refreshAdminData, 8000);
    window.addEventListener("focus", refreshAdminData);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshAdminData);
    };
  }, [route.view, hasAdminAccessForSync]);

  function update(next: (draft: AppData) => AppData) {
    setData((current) => next(current));
  }

  function changeAppearance(patch: Partial<AppearanceChoice>) {
    const next = {
      ...appearance,
      ...patch,
      accentColor: normalizeAccent(patch.accentColor || appearance.accentColor),
    };
    setGuestAppearance(next);
    if (!user) return;
    update((draft) => ({
      ...draft,
      users: draft.users.map((item) =>
        item.id === user.id ? { ...item, settings: { ...item.settings, themeMode: next.themeMode, accentColor: next.accentColor } } : item,
      ),
    }));
  }

  async function performDeleteUser(userId: string) {
    try {
      const session = readSession();
      if (!session.token) throw new Error("Sessão expirada. Entre novamente.");
      const response = await apiJson<{ data: AppData }>(`/api/delete-user?userId=${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${session.token}` },
      });
      saveReadyRef.current = true;
      skipNextSaveRef.current = true;
      setData(withSession(coerceData(response.data), session));
      notify("Conta excluída.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não consegui excluir a conta.");
    }
  }

  function requestDeleteUser(target: User) {
    setModal({
      type: "confirm",
      title: `Excluir a conta de ${target.settings.displayName || target.name}?`,
      body: "Todos os dados dessa conta (matérias, conteúdos, tarefas, conversas e progresso) serão apagados de forma permanente. Essa ação não tem volta.",
      onConfirm: () => {
        void performDeleteUser(target.id);
      },
    });
  }

  function requestDeleteComment(comment: SiteComment) {
    setModal({
      type: "confirm",
      title: `Excluir o comentário de ${comment.name}?`,
      body: "O comentário será removido do site para todos os visitantes.",
      onConfirm: () => {
        update((draft) => ({ ...draft, comments: draft.comments.filter((item) => item.id !== comment.id) }));
        notify("Comentário removido.");
      },
    });
  }

  function notify(message: string) {
    setToast(message);
  }

  async function authenticate(payload: AuthPayload) {
    const endpoint = payload.mode === "login" ? "/api/login" : "/api/register";
    const response = await apiJson<{ token: string; user: User; data: AppData }>(endpoint, {
      method: "POST",
      body: JSON.stringify({
        name: payload.name,
        password: payload.password,
        adminMode: payload.adminMode,
        adminPassword: payload.adminPassword,
      }),
    });
    const session = {
      currentUserId: response.user.id,
      currentAdminUserId: response.user.isAdmin ? response.user.id : null,
      token: response.token,
    };
    saveReadyRef.current = true;
    skipNextSaveRef.current = true;
    saveSession(session);
    setData(withSession(coerceData(response.data), session));
    setSyncStatus("online");
    go("home");
  }

  function logout() {
    const blank = emptySession();
    saveSession(blank);
    setData((current) => withSession(current, blank));
    go("home");
  }

  if (!user) {
    return (
      <MotionPreference reduced={reducedMotion}>
        <AnimatePresence>{showIntro ? <SplashV2 key="splash" onSkip={() => setShowIntro(false)} /> : null}</AnimatePresence>
        <AppearanceControls appearance={appearance} onChange={changeAppearance} floating />
        <AuthScreen authenticate={authenticate} notify={notify} accentColor={appearance.accentColor} />
        <Toast message={toast} />
      </MotionPreference>
    );
  }

  const displayName = user.settings.displayName || user.name;
  const hasAdminAccess = Boolean(user.isAdmin);
  const isAdminPanel = route.view === "admin" && hasAdminAccess;
  const isMinePanel = route.view === "mine" && !isAdminPanel;
  const currentSubject = route.view === "subject" ? userData.subjects.find((item) => item.id === route.id) : undefined;
  const content = (() => {
    if (route.view === "subject" && currentSubject) {
      return <SubjectView subject={currentSubject} data={userData} setModal={setModal} update={update} notify={notify} setSelectedSubjectId={setSelectedSubjectId} />;
    }
    if (route.view === "agenda") return <AgendaView data={userData} setModal={setModal} update={update} notify={notify} />;
    if (route.view === "foco") return <FocusView data={userData} user={user} update={update} notify={notify} />;
    if (route.view === "progress") return <ProgressView data={userData} user={user} />;
    if (route.view === "ranking") return <RankingView user={user} update={update} notify={notify} />;
    if (route.view === "mine") {
      return (
        <MineView
          data={userData}
          input={mineInput}
          setInput={setMineInput}
          selectedSubjectId={selectedSubjectId}
          setSelectedSubjectId={setSelectedSubjectId}
          loading={mineLoading}
          suggestions={mineSuggestions}
          model={mineModel}
          setModel={setMineModel}
          streamText={mineStreamText}
          stop={() => mineAbortRef.current?.abort()}
          webSearch={mineWebSearch}
          setWebSearch={setMineWebSearch}
          webSearchAvailable={mineWebAvailable}
          clear={() => {
            update((draft) => ({
              ...draft,
              chats: draft.chats.filter((item) => item.userId !== user.id || item.subjectId !== selectedSubjectId),
            }));
            setMineSuggestions([]);
          }}
          send={async (text, subjectId, attachments = []) => {
            const trimmed = text.trim();
            if ((!trimmed && !attachments.length) || mineLoading) return;
            const prompt = trimmed || "Analise os arquivos anexados.";
            const history = userData.chats
              .filter((item) => item.subjectId === subjectId || (!subjectId && !item.subjectId))
              .slice(-6);
            const userMessage: ChatMessage = { id: uid("chat"), userId: user.id, subjectId, role: "user", text: prompt, attachments, createdAt: Date.now() };
            const subject = subjectId ? userData.subjects.find((item) => item.id === subjectId) : undefined;
            const savedMaterials = subject ? attachmentsToMaterials(attachments, userData.materials, user.id, subject.id) : [];
            update((draft) => ({
              ...draft,
              chats: [...draft.chats, userMessage],
              materials: savedMaterials.length ? [...draft.materials, ...savedMaterials] : draft.materials,
            }));
            if (subject && savedMaterials.length) {
              notify(savedMaterials.length === 1 ? `Anexo salvo como conteúdo em ${subject.name}.` : `${savedMaterials.length} anexos salvos como conteúdo em ${subject.name}.`);
            }
            setMineLoading(true);
            setMineStreamText("");
            mineStreamRef.current = "";
            const controller = new AbortController();
            mineAbortRef.current = controller;
            try {
              const subjectImages = subjectId ? materialsToImageAttachments(userData.materials.filter((item) => item.subjectId === subjectId)) : [];
              const assistant = await streamAssistantResponse(
                {
                  prompt,
                  history,
                  model: mineModel,
                  webSearch: mineWebAvailable && mineWebSearch,
                  attachments: [...attachments, ...subjectImages].slice(0, maxChatAttachments),
                  context: buildAssistantContext(userData, user, subjectId),
                },
                {
                  signal: controller.signal,
                  onDelta: (text) => {
                    mineStreamRef.current = text;
                    setMineStreamText(text);
                  },
                },
              );
              setMineSuggestions(assistant.suggestions || []);
              // Quando o nível escolhido não respondeu, o usuário fica sabendo —
              // uma vez, não a cada resposta.
              if (assistant.notice && !fallbackNoticeRef.current) {
                fallbackNoticeRef.current = true;
                notify(assistant.notice);
              }
              let feedback: string[] = [];
              let routeAction: { view: View; id?: string; query?: string } | null = null;
              update((draft) => {
                const assistantMessage: ChatMessage = {
                  id: uid("chat"),
                  userId: user.id,
                  subjectId,
                  role: "mine",
                  text: assistant.reply || buildMineAnswer(prompt, subjectId, userData, user),
                  mineModel: assistant.model,
                  sources: assistant.sources?.length ? assistant.sources : undefined,
                  createdAt: Date.now() + 1,
                };
                const withMessage: AppData = {
                  ...draft,
                  chats: [...draft.chats, assistantMessage],
                  sessions: subjectId
                    ? [...draft.sessions, { id: uid("session"), userId: user.id, subjectId, title: prompt.slice(0, 48), kind: "Mine", createdAt: Date.now() }]
                    : draft.sessions,
                };
                const applied = applyAssistantActions(withMessage, user.id, assistant.actions || []);
                feedback = applied.feedback;
                routeAction = applied.route;
                return applied.data;
              });
              const pendingRoute = routeAction as { view: View; id?: string; query?: string } | null;
              if (pendingRoute?.query) setQuery(pendingRoute.query);
              if (pendingRoute) go(pendingRoute.view, pendingRoute.id);
              if (feedback.length) notify(feedback.slice(0, 2).join(" · "));
            } catch (error) {
              setMineSuggestions([]);
              const partial = mineStreamRef.current.trim();
              // Parou no meio: o que já apareceu na tela continua valendo.
              const stopped = controller.signal.aborted;
              const code = (error as { code?: string } | null)?.code;
              const text = stopped
                ? partial || "Geração interrompida."
                : partial
                  ? `${partial}\n\n_(A resposta foi interrompida por um problema. Tente perguntar de novo.)_`
                  : code === "rate_limit"
                    ? "Recebi muitas perguntas agora e atingi o limite por alguns instantes. Espere um pouquinho e tente de novo."
                    : (error as Error | null)?.message || "Tive um problema para responder agora. Tente novamente em alguns instantes.";
              update((draft) => ({
                ...draft,
                chats: [...draft.chats, { id: uid("chat"), userId: user.id, subjectId, role: "mine", text, mineModel: stopped || partial ? mineModel : undefined, createdAt: Date.now() + 1 }],
              }));
            } finally {
              mineAbortRef.current = null;
              mineStreamRef.current = "";
              setMineStreamText("");
              setMineLoading(false);
            }
          }}
        />
      );
    }
    if (route.view === "games") return <GamesView data={userData} user={user} update={update} />;
    if (route.view === "search") return <SearchView data={userData} query={query} setQuery={setQuery} />;
    if (route.view === "plan") return <PlanView data={userData} update={update} user={user} notify={notify} />;
    if (route.view === "comments") return <CommentsView data={userData} user={user} update={update} notify={notify} setModal={setModal} />;
    if (route.view === "suggestions") return <SuggestionsView data={userData} user={user} update={update} notify={notify} setModal={setModal} />;
    if (route.view === "about") return <AboutView />;
    if (route.view === "perfil") return <ProfileView user={user} data={userData} update={update} notify={notify} logout={logout} targetId={route.id} />;
    if (route.view === "admin") return hasAdminAccess ? <AdminView data={data} syncStatus={syncStatus} databaseMode={databaseMode} section={route.id} currentUserId={user.id} onDeleteUser={requestDeleteUser} onDeleteComment={requestDeleteComment} update={update} notify={notify} setModal={setModal} /> : <AdminRestrictedView />;
    return <HomeView data={userData} displayName={displayName} accentColor={appearance.accentColor} themeMode={appearance.themeMode} setModal={setModal} update={update} />;
  })();

  return (
    <MotionPreference reduced={reducedMotion}>
      <AnimatePresence>{showIntro ? <SplashV2 key="splash" onSkip={() => setShowIntro(false)} /> : null}</AnimatePresence>
      {!isAdminPanel ? <ScrollProgressBar /> : null}
      <div
        className={`relative z-10 min-h-screen ${isAdminPanel ? "admin-light bg-[#f3fbfe]" : "study-studio workspace-shell"}`}
        style={{ "--shell-nav": navHidden ? "0rem" : "16.5rem" } as React.CSSProperties}
      >
        {isAdminPanel ? <AdminBackdrop reduced={reducedMotion} /> : null}
        {!isAdminPanel ? (
          <>
          <WorkspaceBackdrop route={route.view} reduced={reducedMotion} />
          <WorkspaceSidebar
            route={route.view}
            displayName={displayName}
            isAdmin={hasAdminAccess}
            level={rewards?.level || 1}
            progress={rewards ? percent(rewards.levelXp, rewards.levelNeed) : 0}
            avatar={user.settings.avatar}
            hidden={navHidden}
            onHide={() => setNavHidden(true)}
          />
          <UtilityHeader
            route={route.view}
            displayName={displayName}
            level={rewards?.level || 1}
            avatar={user.settings.avatar}
            appearance={appearance}
            onAppearanceChange={changeAppearance}
            navHidden={navHidden}
            onShowNav={() => setNavHidden(false)}
          />
          </>
        ) : null}
        <main
          className={
            isAdminPanel
              ? // relative z-[1] mantém o conteúdo do admin acima do AdminBackdrop
                "relative z-[1] min-w-0"
              : isMinePanel
                ? "shell-shift workspace-canvas pb-safe-chat relative z-10 h-dvh min-w-0 overflow-hidden px-3 pt-[5.3rem] sm:px-5 lg:px-7 lg:pb-5 lg:pt-[5.6rem]"
                : "shell-shift workspace-canvas relative z-10 min-w-0 px-4 pb-safe-nav pt-[6.25rem] md:px-7 lg:px-9 lg:pb-16 lg:pt-[6.9rem]"
          }
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={route.view === "admin" ? "admin" : `${route.view}-${route.id || ""}`}
              className={isAdminPanel ? "min-h-screen" : isMinePanel ? "mx-auto h-full w-full max-w-[1380px]" : "mx-auto w-full max-w-[1380px]"}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {content}
            </motion.div>
          </AnimatePresence>
        </main>
        {!isAdminPanel ? <MobileNav route={route.view} isAdmin={hasAdminAccess} displayName={displayName} avatar={user.settings.avatar} level={rewards?.level || 1} /> : null}
      </div>
      <ModalHost modal={modal} setModal={setModal} user={user} data={userData} update={update} notify={notify} />
      <Toast message={toast} />
    </MotionPreference>
  );
}

function AuthScreen({
  authenticate,
  notify,
  accentColor,
}: {
  authenticate: (payload: AuthPayload) => Promise<void>;
  notify: (message: string) => void;
  accentColor: string;
}) {
  const reduced = useSoftMotion();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [adminMode, setAdminMode] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean || password.length < 3) {
      notify("Preencha nome e senha com pelo menos 3 caracteres.");
      return;
    }
    setSubmitting(true);
    try {
      await authenticate({ mode, name: clean, password, adminMode, adminPassword });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível entrar agora.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-stage auth-studio relative z-10 min-h-dvh overflow-hidden px-4 sm:px-6 lg:px-10">
      <AuthBackdrop reduced={reduced} accentColor={accentColor} />
      <motion.section
        initial={reduced ? false : { opacity: 0, y: 36, scale: 0.97, filter: "blur(14px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.8, ease: ease.out }}
        className="relative z-10 mx-auto grid min-h-dvh w-full max-w-[1380px] min-w-0 items-stretch gap-0 py-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(25rem,.65fr)] lg:py-6"
      >
        <div className="auth-story relative order-2 min-w-0 overflow-hidden rounded-b-[1.5rem] border border-white/[0.08] bg-[#171c1a] p-7 sm:p-10 lg:order-1 lg:min-h-[calc(100dvh-3rem)] lg:rounded-l-[1.5rem] lg:rounded-br-none lg:border-r-0 lg:p-12 xl:p-16">
          <div className="absolute inset-y-0 left-0 w-1 bg-mint" />
          <div className="absolute inset-0 studio-paper-grid opacity-35" />

          <motion.div
            className="relative flex items-center gap-4"
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: ease.out }}
          >
            <span className="grid h-14 w-14 place-items-center rounded-[1rem] bg-mint">
              <BrandMark label="Minerva" className="brand-mark-dark h-12 w-12" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.28em] text-mint">Minerva</p>
              <h1 className="font-display text-2xl font-black md:text-3xl">Área de estudos</h1>
            </div>
          </motion.div>

          <div className="relative mt-16 max-w-[46rem] min-w-0 md:mt-20 lg:mt-[14vh]">
            <motion.p
              className="inline-block max-w-full border-l-2 border-mint pl-4 text-[12px] font-black uppercase tracking-[.18em] text-mint"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3, ease: ease.back }}
            >
              Seu espaço de estudo
            </motion.p>
            <div className="mt-6 w-full max-w-[30rem] sm:max-w-[34rem] lg:max-w-[38rem]">
              <h2 className="max-w-full break-words font-display text-[2.35rem] font-black leading-[.98] sm:text-5xl md:text-[4.2rem] lg:text-[4.9rem] xl:text-[5.5rem]">
                <SplitWords text="Estudar fica mais simples quando tudo encontra seu lugar." delay={0.22} />
              </h2>
            </div>
            <motion.p
              className="mt-6 max-w-full text-[15px] leading-7 text-white/62 sm:max-w-xl sm:text-lg sm:leading-8"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7, ease: ease.out }}
            >
              Matérias, tarefas, revisões e a Mine trabalham juntas para você saber o que fazer agora — sem perder tempo montando o sistema.
            </motion.p>
          </div>

          <div className="relative mt-10 grid gap-0 border-y border-white/10 sm:grid-cols-3 lg:mt-[8vh] lg:max-w-3xl">
            {[
              { value: "Mine", label: "explica e corrige com contexto", icon: Bot, delay: 0.7 },
              { value: "Simulados", label: "prática a partir do seu material", icon: ClipboardCheck, delay: 0.76 },
              { value: "Rotina", label: "tarefas, foco e revisão no mesmo lugar", icon: Brain, delay: 0.82 },
            ].map((stat) => (
              <AuthStat key={stat.value} value={stat.value} label={stat.label} icon={stat.icon} delay={stat.delay} />
            ))}
          </div>
        </div>

        <div className="auth-console relative order-1 min-w-0 overflow-hidden rounded-t-[1.5rem] border border-white/10 bg-[#202723] p-6 md:p-8 lg:order-2 lg:rounded-r-[1.5rem] lg:rounded-tl-none lg:border-l-0 lg:justify-self-stretch">
          <div className="mx-auto flex w-full max-w-md flex-col justify-center lg:min-h-[31rem]">
            <div className="mb-8 grid grid-cols-2 border-b border-white/10">
              {(["login", "register"] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setMode(item);
                    setAdminMode(false);
                    setAdminPassword("");
                  }}
                  className={`relative px-4 py-3 text-[13px] font-black transition-colors duration-control ${
                    mode === item ? "text-black" : "text-white/60 hover:text-white"
                  }`}
                >
                  {mode === item ? (
                    <motion.span layoutId="auth-tab" className="absolute inset-x-0 bottom-0 h-0.5 bg-mint" transition={spring.snappy} />
                  ) : null}
                  <span className="relative">{item === "login" ? "Entrar" : "Criar conta"}</span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.h2
                key={mode}
                initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                transition={{ duration: 0.3, ease: ease.out }}
                className="font-display text-3xl font-black"
              >
                {mode === "login" ? "Bem-vindo de volta" : "Comece agora"}
              </motion.h2>
            </AnimatePresence>

            <form onSubmit={submit} className="mt-6 space-y-3.5">
              <Input label="Nome" value={name} onChange={setName} placeholder="Seu nome" icon={Users} />
              <Input label="Senha" value={password} onChange={setPassword} placeholder="Sua senha" type="password" icon={Lock} />
              <button
                type="button"
                onClick={() => {
                  setAdminMode((current) => !current);
                  setAdminPassword("");
                }}
                aria-pressed={adminMode}
                className={`flex w-full items-center justify-center gap-3 rounded-lg border px-5 py-3.5 font-bold transition-control duration-control ${
                  adminMode ? "border-mint/50 bg-mint/12 text-mint" : "border-white/12 bg-white/[0.05] text-white/70 hover:border-mint/40 hover:bg-mint/10"
                }`}
              >
                <Shield className="h-5 w-5" />
                {mode === "login" ? "Entrar como admin" : "Criar como admin"}
              </button>

              <AnimatePresence>
                {adminMode ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: ease.out }}
                    className="overflow-hidden"
                  >
                    <Input
                      label="Senha administrativa"
                      value={adminPassword}
                      onChange={setAdminPassword}
                      placeholder="Digite a senha de admin"
                      type="password"
                      icon={Shield}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <motion.button
                disabled={submitting}
                whileTap={{ scale: 0.985 }}
                transition={spring.snappy}
                className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[.9rem] bg-mint px-5 py-4 font-black text-black transition-control duration-control hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? <Loader2 className="relative h-5 w-5 animate-spin" /> : null}
                <span className="relative">{submitting ? "Conectando..." : mode === "login" ? "Entrar na Minerva" : "Criar minha conta"}</span>
                {!submitting ? <ArrowRight className="relative h-5 w-5 transition-transform duration-control group-hover:translate-x-1" /> : null}
              </motion.button>
            </form>
          </div>
        </div>
      </motion.section>
    </main>
  );
}

function KnowledgeCore() {
  const reduced = useSoftMotion();
  // Os chips ficam confinados à metade direita da caixa de propósito. A caixa
  // tem 34rem e está deslocada para fora da tela (right:-8rem), então qualquer
  // coisa posicionada na metade esquerda dela cai em cima do headline — era o
  // que acontecia com "Planejar" e "Revisar", que pousavam sobre o texto.
  const nodes = [
    { label: "Planejar", icon: CalendarPlus, className: "left-[46%] top-[12%]", delay: 0 },
    { label: "Aprender", icon: Brain, className: "right-[1%] top-[38%]", delay: 0.8 },
    { label: "Revisar", icon: Layers, className: "bottom-[10%] left-[52%]", delay: 1.6 },
  ];

  return (
    <div aria-hidden className="pointer-events-none absolute right-[-8rem] top-1/2 hidden h-[34rem] w-[34rem] -translate-y-1/2 lg:block [perspective:1200px]">
      <motion.div
        className="absolute inset-[13%] preserve-3d"
        animate={reduced ? undefined : { rotateX: [58, 64, 58], rotateY: [0, 14, 0], rotateZ: [0, 360] }}
        transition={{ rotateZ: { duration: 36, repeat: Infinity, ease: "linear" }, rotateX: { duration: 9, repeat: Infinity, ease: "easeInOut" }, rotateY: { duration: 11, repeat: Infinity, ease: "easeInOut" } }}
      >
        <span className="absolute inset-0 rounded-full border border-mint/30 shadow-[0_0_70px_rgba(52,211,153,.12)]" />
        <span className="absolute inset-[12%] rounded-full border border-cyanGlow/25 [transform:rotateX(68deg)_rotateY(18deg)]" />
        <span className="absolute inset-[26%] rounded-full border border-violetGlow/25 [transform:rotateY(72deg)_rotateX(8deg)]" />
        <span className="absolute inset-[38%] rounded-full bg-mint/20 shadow-[0_0_90px_rgba(52,211,153,.35)] backdrop-blur-md" />
        <motion.span
          className="absolute inset-[43%] rounded-2xl border border-white/30 bg-mint shadow-glow [transform:translateZ(52px)_rotate(45deg)]"
          animate={reduced ? undefined : { scale: [0.92, 1.08, 0.92] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>
      {nodes.map(({ label, icon: Icon, className, delay }) => (
        <motion.span
          key={label}
          className={`absolute ${className} flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-3 py-2 text-[11px] font-black text-white/70 backdrop-blur-xl`}
          animate={reduced ? undefined : { y: [0, -9, 0], x: [0, 4, 0] }}
          transition={{ duration: 5.2, delay, repeat: Infinity, ease: "easeInOut" }}
        >
          <Icon className="h-3.5 w-3.5 text-mint" />
          {label}
        </motion.span>
      ))}
    </div>
  );
}

function AuthStat({ value, label, icon: Icon, delay = 0 }: { value: string; label: string; icon: LucideIcon; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: ease.out }}
      whileHover={{ y: -3 }}
      className="group relative min-w-0 border-white/10 px-4 py-4 transition-colors hover:bg-white/[0.04] sm:border-r sm:last:border-r-0 lg:first:pl-0"
    >
      <Icon className="h-5 w-5 text-mint transition-transform duration-control group-hover:scale-110" />
      <p className="mt-3 font-display text-lg font-black text-white">{value}</p>
      <p className="text-[11px] font-bold leading-snug text-white/45">{label}</p>
    </motion.div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  icon?: LucideIcon;
}) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === "password";
  return (
    <label className="group block">
      <span className="mb-2 block text-[13px] font-black text-white/70">{label}</span>
      <span className="relative block">
        {Icon ? (
          <Icon className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/30 transition-colors duration-control group-focus-within:text-mint" />
        ) : null}
        <input
          value={value}
          type={isPassword && passwordVisible ? "text" : type}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`h-14 w-full rounded-lg border border-white/12 bg-white/[0.06] text-white outline-none transition-control duration-control placeholder:text-white/40 focus:border-mint/60 focus:bg-black/35 focus:shadow-glowSoft ${
            Icon ? "pl-12" : "pl-4"
          } ${isPassword ? "pr-12" : "pr-4"}`}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setPasswordVisible((visible) => !visible)}
            aria-label={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
            title={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-1.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-xl text-white/35 transition hover:bg-white/[0.06] hover:text-mint"
          >
            {passwordVisible ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
          </button>
        ) : null}
      </span>
    </label>
  );
}

function Sidebar({
  route,
  displayName,
  subjectsCount,
  isAdmin,
  level,
  progress,
  title,
}: {
  route: View;
  displayName: string;
  subjectsCount: number;
  isAdmin: boolean;
  level: number;
  progress: number;
  title: string;
}) {
  const reduced = useSoftMotion();
  return (
    <aside className="sticky top-0 z-20 hidden h-screen w-[7.25rem] shrink-0 flex-col overflow-hidden border-r border-white/10 bg-black/55 backdrop-blur-lg lg:flex">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-mint/40 to-transparent" />
      <div className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-mint/10 blur-[90px]" />

      <button onClick={() => go("home")} aria-label="Ir para o início" className="group relative grid shrink-0 place-items-center gap-2 px-3 pb-5 pt-6 text-center">
        <span className="relative grid h-14 w-14 place-items-center [perspective:600px]">
          {!reduced ? <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-mint/40" /> : null}
          <motion.div
            className="grid h-14 w-14 place-items-center rounded-2xl border border-mint/25 bg-mint/10 p-1 shadow-glow"
            whileHover={reduced ? undefined : { rotateY: 18, rotateX: -10, scale: 1.06 }}
            transition={spring.soft}
          >
            <BrandMark label="Minerva" className="h-full w-full" />
          </motion.div>
        </span>
        <span className="min-w-0">
          <span className="block text-[9px] font-black uppercase tracking-[.2em] text-mint">Minerva</span>
          <span className="sr-only">Estudos</span>
        </span>
      </button>

      <nav className="minerva-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-4">
        {navGroups.map((group) => {
          const items = group.views
            .map(navItemOf)
            .filter((item): item is { view: View; label: string; icon: LucideIcon } => Boolean(item) && (item!.view !== "admin" || isAdmin));
          if (!items.length) return null;
          return (
            <div key={group.label} className="border-t border-white/[0.07] pt-2 first:border-t-0 first:pt-0">
              <p className="sr-only">{group.label}</p>
              <div className="space-y-1">
                {items.map((item) => (
                  <NavButton key={item.view} item={item} active={route === item.view} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-2.5">
        <button
          onClick={() => go("progress")}
          className="sheen group relative grid w-full place-items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.055] px-2 py-3 text-center transition hover:border-mint/35 hover:bg-white/[0.09]"
        >
          <span className="relative grid h-11 w-11 shrink-0 place-items-center">
            <svg className="absolute inset-0 h-11 w-11 -rotate-90" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="3" />
              <circle
                cx="22"
                cy="22"
                r="20"
                fill="none"
                stroke="#34D399"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(Math.max(0, Math.min(100, progress)) / 100) * 125.6} 125.6`}
              />
            </svg>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-mint text-sm font-black text-black">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
          </span>
          <span className="min-w-0 max-w-full">
            <span className="block truncate text-[11px] font-black">{displayName}</span>
            <span className="block truncate text-[9px] font-bold uppercase text-white/45">Nível {level}</span>
            <span className="sr-only">{title || `${subjectsCount} matérias`}</span>
          </span>
        </button>
      </div>
    </aside>
  );
}

function NavButton({ item, active }: { item: { view: View; label: string; icon: LucideIcon }; active: boolean }) {
  const Icon = item.icon;
  const reduced = useSoftMotion();
  return (
    <button
      onClick={() => go(item.view)}
      aria-current={active ? "page" : undefined}
      className={`group relative grid min-h-[3.7rem] w-full place-items-center gap-1 rounded-2xl px-1.5 py-2 text-center text-[10px] font-black leading-tight transition-colors ${
        active ? "text-black" : "text-white/60 hover:text-white"
      }`}
    >
      {active ? (
        reduced ? (
          <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-mint to-mintDeep" />
        ) : (
          <motion.span
            layoutId="nav-active"
            className="absolute inset-0 rounded-xl bg-gradient-to-r from-mint to-mintDeep shadow-glow ring-1 ring-inset ring-white/25"
            transition={spring.snappy}
          />
        )
      ) : (
        <span className="absolute inset-0 rounded-xl bg-white/0 transition group-hover:bg-white/[0.07]" />
      )}
      {/* traço lateral que só aparece no hover dos itens inativos */}
      {!active ? (
        <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 scale-y-0 rounded-full bg-mint transition-transform duration-control group-hover:scale-y-100" />
      ) : null}
      <Icon className={`relative h-5 w-5 shrink-0 transition-transform duration-control ${active ? "" : "group-hover:scale-110"}`} />
      <span className="relative line-clamp-2 max-w-full">{item.label}</span>
    </button>
  );
}

const desktopPrimary: View[] = ["home", "agenda", "foco", "progress", "mine"];

function TopNav({
  route,
  displayName,
  isAdmin,
  level,
  progress,
}: {
  route: View;
  displayName: string;
  isAdmin: boolean;
  level: number;
  progress: number;
}) {
  const [open, setOpen] = useState(false);
  const reduced = useSoftMotion();
  const current = navItemOf(route);
  const primary = desktopPrimary.map(navItemOf).filter(Boolean) as Array<{ view: View; label: string; icon: LucideIcon }>;

  useEffect(() => setOpen(false), [route]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-black/62 backdrop-blur-lg">
        <div className="mx-auto flex h-[4.6rem] w-full max-w-[1600px] items-center gap-3 px-4 md:px-7 lg:px-8 xl:px-10">
          <button onClick={() => go("home")} className="group flex shrink-0 items-center gap-3 text-left" aria-label="Ir para o início">
            <motion.span
              className="grid h-10 w-10 place-items-center rounded-lg border border-mint/25 bg-mint/10 p-1 shadow-glow"
              whileHover={reduced ? undefined : { rotateY: 18, rotateX: -8, scale: 1.06 }}
              transition={spring.soft}
            >
              <BrandMark className="h-full w-full" />
            </motion.span>
            <span className="hidden sm:block">
              <span className="block font-display text-base font-black leading-none">Minerva</span>
              <span className="mt-1 block text-[9px] font-black uppercase tracking-[.2em] text-mint">Workspace</span>
            </span>
          </button>

          <span className="mx-1 hidden h-7 w-px bg-white/10 lg:block" />

          <nav aria-label="Navegação principal" className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex">
            {primary.map((item) => {
              const Icon = item.icon;
              const active = route === item.view;
              return (
                <button
                  key={item.view}
                  onClick={() => go(item.view)}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex h-11 items-center gap-2 rounded-lg px-3.5 text-[13px] font-black transition-colors ${
                    active ? "text-black" : "text-white/55 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {active ? (
                    reduced ? (
                      <span className="absolute inset-0 rounded-lg bg-mint" />
                    ) : (
                      <motion.span layoutId="top-nav-active" className="absolute inset-0 rounded-lg bg-mint shadow-glow" transition={spring.snappy} />
                    )
                  ) : null}
                  <Icon className="relative h-4 w-4" />
                  <span className="relative">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1 lg:hidden">
            <p className="truncate text-[10px] font-black uppercase tracking-[.18em] text-white/35">Você está em</p>
            <p className="truncate text-sm font-black text-white">{current?.label || "Minerva"}</p>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <IconButton icon={Search} label="Buscar" onClick={() => go("search")} />
            <button
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              className={`hidden h-11 items-center gap-2 rounded-lg border px-3.5 text-[13px] font-black transition lg:flex ${
                open ? "border-mint/45 bg-mint/12 text-mint" : "border-white/10 bg-white/[0.04] text-white/60 hover:border-white/20 hover:text-white"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Explorar
              <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring.snappy}>
                <ChevronDown className="h-4 w-4" />
              </motion.span>
            </button>
            <button
              onClick={() => go("progress")}
              className="group relative ml-1 grid h-11 w-11 place-items-center rounded-lg bg-white/[0.06] transition hover:bg-white/[0.1]"
              aria-label={`${displayName}, nível ${level}`}
              title={`${displayName} · nível ${level}`}
            >
              <svg className="absolute inset-0 h-11 w-11 -rotate-90" viewBox="0 0 44 44" aria-hidden>
                <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(255,255,255,.11)" strokeWidth="2" />
                <circle cx="22" cy="22" r="20" fill="none" stroke="#34D399" strokeWidth="2" strokeLinecap="round" strokeDasharray={`${(Math.max(0, Math.min(100, progress)) / 100) * 125.6} 125.6`} />
              </svg>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-mint text-xs font-black text-black">
                {displayName.slice(0, 1).toUpperCase()}
              </span>
            </button>
          </div>
        </div>
        <motion.div
          aria-hidden
          className="h-px origin-left bg-gradient-to-r from-mint via-cyanGlow/70 to-transparent"
          initial={false}
          animate={{ scaleX: open ? 1 : 0.22, opacity: open ? 0.9 : 0.38 }}
          transition={spring.soft}
        />
      </header>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              aria-label="Fechar navegação"
              className="fixed inset-0 z-40 hidden bg-black/64 backdrop-blur-sm lg:block"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed inset-x-6 top-[5.35rem] z-40 mx-auto hidden max-w-[1220px] overflow-hidden rounded-lg border border-white/12 bg-[#0b0b0f]/96 shadow-lift backdrop-blur-lg lg:block"
              initial={reduced ? false : { opacity: 0, y: -18, rotateX: -7, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, rotateX: -4, scale: 0.985 }}
              transition={spring.soft}
              style={{ transformOrigin: "top", perspective: 1200 }}
            >
              <div className="grid grid-cols-[1fr_3fr] border-b border-white/10">
                <div className="relative overflow-hidden border-r border-white/10 p-6">
                  <span aria-hidden className="absolute inset-0 bg-grid-tight opacity-[0.12]" />
                  <div className="relative">
                    <p className="text-[10px] font-black uppercase tracking-[.24em] text-mint">Mapa Minerva</p>
                    <h2 className="mt-3 font-display text-2xl font-black">Tudo a dois cliques.</h2>
                    <p className="mt-3 text-sm leading-relaxed text-white/48">Troque de contexto sem perder o ritmo do estudo.</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-px bg-white/[0.08]">
                  {navGroups.map((group) => {
                    const items = group.views
                      .map(navItemOf)
                      .filter((item): item is { view: View; label: string; icon: LucideIcon } => Boolean(item) && (item!.view !== "admin" || isAdmin));
                    return (
                      <section key={group.label} className="bg-[#0b0b0f] p-4">
                        <p className="px-2 text-[9px] font-black uppercase tracking-[.22em] text-white/30">{group.label}</p>
                        <div className="mt-2 space-y-1">
                          {items.map((item) => {
                            const Icon = item.icon;
                            const active = route === item.view;
                            return (
                              <button
                                key={item.view}
                                onClick={() => go(item.view)}
                                className={`group flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-xs font-black transition ${
                                  active ? "bg-mint text-black" : "text-white/52 hover:bg-white/[0.07] hover:text-white"
                                }`}
                              >
                                <Icon className="h-4 w-4 shrink-0" />
                                <span className="min-w-0 truncate">{item.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between px-6 py-3 text-xs">
                <span className="text-white/38">{displayName} · nível {level}</span>
                <button onClick={() => go("perfil")} className="font-black text-mint transition hover:text-white">Abrir ajustes</button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function RouteDepthLayer({ route }: { route: View }) {
  const reduced = useSoftMotion();
  const routeIndex = Math.max(0, navItems.findIndex((item) => item.view === route));
  const turn = routeIndex * 17;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <motion.span
        className="route-plane route-plane-a"
        animate={reduced ? undefined : { rotateX: [62, 69, 62], rotateZ: [turn, turn + 360], y: [0, -18, 0] }}
        transition={{ rotateZ: { duration: 48, repeat: Infinity, ease: "linear" }, rotateX: { duration: 10, repeat: Infinity, ease: "easeInOut" }, y: { duration: 8, repeat: Infinity, ease: "easeInOut" } }}
      />
      <motion.span
        className="route-plane route-plane-b"
        animate={reduced ? undefined : { rotateY: [54, 68, 54], rotateZ: [-turn, -turn - 360], x: [0, 20, 0] }}
        transition={{ rotateZ: { duration: 58, repeat: Infinity, ease: "linear" }, rotateY: { duration: 12, repeat: Infinity, ease: "easeInOut" }, x: { duration: 9, repeat: Infinity, ease: "easeInOut" } }}
      />
      <motion.span
        key={route}
        className="route-horizon"
        initial={reduced ? false : { opacity: 0, scaleX: 0.2, rotateZ: -4 }}
        animate={{ opacity: 0.38, scaleX: 1, rotateZ: 0 }}
        transition={{ duration: 0.8, ease: ease.out }}
      />
    </div>
  );
}

function WorkspaceSidebar({
  route,
  displayName,
  avatar,
  isAdmin,
  level,
  progress,
  hidden,
  onHide,
}: {
  route: View;
  displayName: string;
  avatar?: string;
  isAdmin: boolean;
  level: number;
  progress: number;
  hidden: boolean;
  onHide: () => void;
}) {
  const reduced = useSoftMotion();

  return (
    <aside
      className="shell-nav studio-sidebar fixed inset-y-0 left-0 z-50 hidden w-[16.5rem] flex-col overflow-hidden border-r border-white/[0.08] bg-[#141a17] lg:flex"
      data-hidden={hidden ? "true" : "false"}
    >
      <div className="relative flex h-[5rem] shrink-0 items-center gap-2 border-b border-white/[0.08] pl-5 pr-3">
        <button onClick={() => go("home")} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Ir para o início">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[.8rem] border border-mint/25 bg-mint/10 p-1">
            <BrandMark className="h-full w-full" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-lg font-black leading-none tracking-[-.03em]">Minerva</span>
            <span className="mt-1 block text-[9px] font-black uppercase tracking-[.18em] text-white/35">Caderno digital</span>
          </span>
        </button>
        <button
          onClick={onHide}
          aria-label="Esconder o menu lateral"
          title="Esconder o menu (Ctrl + B)"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[.65rem] text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <PanelLeftClose className="h-[18px] w-[18px]" />
        </button>
      </div>

      <nav aria-label="Todas as áreas" className="minerva-scroll relative min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => {
          const items = group.views
            .map(navItemOf)
            .filter((item): item is { view: View; label: string; icon: LucideIcon } => Boolean(item) && (item!.view !== "admin" || isAdmin));
          if (!items.length) return null;
          return (
            <section key={group.label} className="mb-4 last:mb-0">
              <p className="mb-1.5 px-2 text-[9px] font-black uppercase tracking-[.18em] text-white/28">{group.label}</p>
              <div>
                {items.map((item, index) => {
                  const Icon = item.icon;
                  const active = route === item.view;
                  return (
                    <button
                      key={item.view}
                      onClick={() => go(item.view)}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex min-h-10 w-full items-center gap-3 border-l px-3 text-left text-[12px] font-black transition-colors ${
                        active ? "border-mint bg-white/[0.055] text-white" : "border-transparent text-white/48 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      {active ? (
                        reduced ? (
                          <span className="absolute inset-0 bg-white/[0.035]" />
                        ) : (
                          <motion.span layoutId="sidebar-active" className="absolute inset-0 bg-white/[0.035]" transition={spring.snappy} />
                        )
                      ) : null}
                      <span className={`relative w-4 text-[8px] font-black tabular ${active ? "text-mint" : "text-white/20"}`}>{String(index + 1).padStart(2, "0")}</span>
                      <Icon className={`relative h-4 w-4 shrink-0 ${active ? "text-mint" : "text-white/32 transition-colors group-hover:text-white"}`} />
                      <span className="relative min-w-0 flex-1 truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </nav>

      <button onClick={() => go("progress")} className="relative m-3 mt-0 flex min-h-[4rem] shrink-0 items-center gap-3 border-t border-white/10 px-2 pt-3 text-left transition hover:text-mint">
        <span className="relative grid h-10 w-10 shrink-0 place-items-center">
          <svg className="absolute inset-0 h-10 w-10 -rotate-90" viewBox="0 0 40 40" aria-hidden>
            <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="2" />
            <circle cx="20" cy="20" r="18" fill="none" stroke="#34D399" strokeWidth="2" strokeLinecap="round" strokeDasharray={`${(Math.max(0, Math.min(100, progress)) / 100) * 113.1} 113.1`} />
          </svg>
          <Avatar name={displayName} src={avatar} size={28} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-black">{displayName}</span>
          <span className="block text-[9px] font-black uppercase tracking-[.12em] text-white/35">Nível {level} · seu percurso</span>
        </span>
      </button>
    </aside>
  );
}

function UtilityHeader({
  route,
  displayName,
  avatar,
  level,
  appearance,
  onAppearanceChange,
  navHidden,
  onShowNav,
}: {
  route: View;
  displayName: string;
  avatar?: string;
  level: number;
  appearance: AppearanceChoice;
  onAppearanceChange: (patch: Partial<AppearanceChoice>) => void;
  navHidden: boolean;
  onShowNav: () => void;
}) {
  const current = navItemOf(route);
  const Icon = current?.icon || LayoutDashboard;

  return (
    <header className="shell-shift-left studio-utility fixed inset-x-0 top-0 z-40 border-b border-white/[0.07]">
      <div className="flex h-[5rem] items-center gap-3 px-4 md:px-7 lg:px-9">
        <button onClick={() => go("home")} className="flex shrink-0 items-center gap-2.5 lg:hidden" aria-label="Ir para o início">
          <span className="grid h-9 w-9 place-items-center rounded-[.7rem] border border-mint/25 bg-mint/10 p-1">
            <BrandMark className="h-full w-full" />
          </span>
          <span className="hidden font-display text-sm font-black sm:block">Minerva</span>
        </button>

        {/* Só aparece com a barra escondida: é a única porta de volta. */}
        {navHidden ? (
          <button
            onClick={onShowNav}
            aria-label="Mostrar o menu lateral"
            title="Mostrar o menu (Ctrl + B)"
            className="hidden h-11 w-11 shrink-0 place-items-center rounded-[.8rem] border border-white/10 bg-[#171c1a] text-white/60 transition-colors hover:border-white/25 hover:text-white lg:grid"
          >
            <PanelLeftOpen className="h-[18px] w-[18px]" />
          </button>
        ) : null}

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[.7rem] bg-[#202723] text-mint">
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="block text-[8px] font-black uppercase tracking-[.18em] text-white/30">Mesa atual</span>
            <span className="block truncate text-sm font-black">{current?.label || "Minerva"}</span>
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <AppearanceControls appearance={appearance} onChange={onAppearanceChange} />
          <IconButton icon={Search} label="Buscar" onClick={() => go("search")} />
          {/* O chip com a foto leva ao perfil: é onde a foto e o nome moram. */}
          <button
            onClick={() => go("perfil")}
            className="hidden min-h-11 items-center gap-2 rounded-[.8rem] border border-white/10 bg-[#171c1a] px-3 text-left transition hover:border-white/25 sm:flex"
            title={`${displayName} · nível ${level} · abrir perfil`}
          >
            <Avatar name={displayName} src={avatar} size={28} />
            <span className="hidden min-w-0 md:block">
              <span className="block max-w-32 truncate text-[11px] font-black">{displayName}</span>
              <span className="block text-[8px] font-black uppercase tracking-[.12em] text-white/32">Nível {level}</span>
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}

function AppearanceControls({
  appearance,
  onChange,
  floating = false,
}: {
  appearance: AppearanceChoice;
  onChange: (patch: Partial<AppearanceChoice>) => void;
  floating?: boolean;
}) {
  const light = appearance.themeMode === "light";
  return (
    <div
      className={`appearance-controls flex items-center gap-1.5 rounded-[.85rem] border px-1.5 py-1 ${floating ? "fixed right-3 top-3 z-[70] sm:right-5 sm:top-5" : ""}`}
      aria-label="AparÃªncia do site"
    >
      <button
        type="button"
        onClick={() => onChange({ themeMode: light ? "dark" : "light" })}
        aria-label={light ? "Usar tema escuro" : "Usar tema claro"}
        title={light ? "Tema escuro" : "Tema claro"}
        className="appearance-control-button grid h-9 w-9 place-items-center rounded-[.65rem] transition-control duration-control"
      >
        {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>

      <div className="hidden items-center gap-1 px-1 2xl:flex" aria-label="Cores sugeridas">
        {accentPresets.map((color) => {
          const selected = appearance.accentColor === color;
          return (
            <button
              key={color}
              type="button"
              aria-label={`Usar a cor ${color}`}
              aria-pressed={selected}
              onClick={() => onChange({ accentColor: color })}
              className={`h-4 w-4 rounded-full border transition-transform hover:scale-125 ${selected ? "scale-110 border-current" : "border-transparent"}`}
              style={{ backgroundColor: color, color }}
            />
          );
        })}
      </div>

      <label
        className="appearance-color-picker relative grid h-9 w-9 cursor-pointer place-items-center overflow-hidden rounded-[.65rem]"
        title="Escolher qualquer cor dominante"
      >
        <Palette className="relative z-[1] h-4 w-4" />
        <span className="absolute inset-x-2 bottom-1 h-1 rounded-full" style={{ backgroundColor: appearance.accentColor }} />
        <input
          type="color"
          value={appearance.accentColor}
          aria-label="Escolher qualquer cor dominante"
          onChange={(event) => onChange({ accentColor: event.target.value })}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

function MobileNav({ route, isAdmin, displayName, avatar, level }: { route: View; isAdmin: boolean; displayName: string; avatar?: string; level: number }) {
  const [open, setOpen] = useState(false);
  const reduced = useSoftMotion();
  const primary = mobilePrimary.map(navItemOf).filter(Boolean) as Array<{ view: View; label: string; icon: LucideIcon }>;
  const rest = navItems.filter((item) => !mobilePrimary.includes(item.view) && (item.view !== "admin" || isAdmin));
  const restActive = rest.some((item) => item.view === route);

  useEffect(() => {
    setOpen(false);
  }, [route]);

  return (
    <>
      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              aria-label="Fechar menu"
              className="fixed inset-0 z-40 bg-black/72 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed inset-x-3 bottom-[6.5rem] z-40 overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#171c1a] p-4 shadow-lift lg:hidden"
              initial={{ opacity: 0, y: 28, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={spring.soft}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[.24em] text-white/35">Navegar</p>
                <p className="flex items-center gap-1.5 text-xs font-black text-mint">
                  <Award className="h-3.5 w-3.5" /> Nível {level}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {rest.map((item, index) => {
                  const Icon = item.icon;
                  const active = route === item.view;
                  return (
                    <motion.button
                      key={item.view}
                      onClick={() => go(item.view)}
                      initial={reduced ? false : { opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: reduced ? 0 : index * 0.035, ease: ease.out }}
                      className={`grid place-items-center gap-1.5 rounded-[.85rem] border p-3 text-[11px] font-black transition ${
                        active ? "border-mint bg-mint text-black" : "border-white/10 bg-white/[0.025] text-white/65 active:scale-95"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="w-full truncate text-center">{item.label}</span>
                    </motion.button>
                  );
                })}
              </div>
              <button
                onClick={() => go("perfil")}
                className="mt-3 flex w-full items-center gap-3 rounded-[.9rem] border border-white/10 bg-white/[0.035] p-3 text-left"
              >
                <Avatar name={displayName} src={avatar} size={36} />
                <span className="min-w-0 flex-1 truncate font-black">{displayName}</span>
                <ChevronRight className="h-4 w-4 text-mint" />
              </button>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-1 border-t border-white/10 bg-[#141a17]/98 px-2 pb-1 pt-1.5 shadow-[0_-16px_45px_-30px_rgba(0,0,0,.95)] backdrop-blur-md lg:hidden">
        {primary.map((item) => {
          const Icon = item.icon;
          const active = route === item.view;
          return (
            <button
              key={item.view}
              onClick={() => go(item.view)}
              aria-current={active ? "page" : undefined}
              className={`relative grid flex-1 place-items-center rounded-[.75rem] px-1 py-2 text-[10px] font-black transition-colors ${
                active ? "text-black" : "text-white/48"
              }`}
            >
              {active ? (
                reduced ? (
                  <span className="absolute inset-0 rounded-[.75rem] bg-mint" />
                ) : (
                  <motion.span
                    layoutId="mobile-nav-active"
                    className="absolute inset-0 rounded-[.75rem] bg-mint"
                    transition={spring.snappy}
                  />
                )
              ) : null}
              <Icon className="relative mb-1 h-[18px] w-[18px]" />
              <span className="relative w-full truncate text-center">{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label="Mais destinos"
          className={`relative grid flex-1 place-items-center rounded-[.75rem] px-1 py-2 text-[10px] font-black transition ${
            open || restActive ? "bg-white/12 text-mint" : "text-white/55"
          }`}
        >
          <motion.span animate={{ rotate: open ? 90 : 0 }} transition={spring.snappy} className="mb-1 grid place-items-center">
            <MoreHorizontal className="h-[18px] w-[18px]" />
          </motion.span>
          <span className="w-full truncate text-center">Mais</span>
        </button>
      </nav>
    </>
  );
}

function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  const reduced = useSoftMotion();
  return (
    <header className="workspace-header studio-page-header relative mb-8 grid gap-5 border-b border-white/[0.09] pb-7 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
      <div className="grid min-w-0 gap-4 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-start">
        <motion.p
          className="border-l-2 border-mint pl-3 pt-1 text-[10px] font-black uppercase tracking-[.2em] text-mint"
          initial={reduced ? false : { opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: ease.out }}
        >
          {eyebrow}
        </motion.p>
        <div className="min-w-0">
          <h1 className="font-display text-[2.35rem] font-black leading-[.98] tracking-[-.055em] text-white md:text-[3.35rem]">
            <SplitWords text={title} delay={0.035} />
          </h1>
          {subtitle ? (
            <motion.p
              className="mt-3 max-w-2xl text-[14px] leading-relaxed text-white/52 md:text-[15px]"
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, delay: 0.14, ease: ease.out }}
            >
              {subtitle}
            </motion.p>
          ) : null}
        </div>
      </div>
      <motion.div
        className="flex shrink-0 items-center gap-3 sm:pl-[7.5rem] xl:pl-0"
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.18, ease: ease.out }}
      >
        {action ? <div className="flex flex-wrap justify-start gap-2 xl:justify-end">{action}</div> : null}
      </motion.div>
    </header>
  );
}

function QuickAction({ icon: Icon, label, hint, onClick }: { icon: LucideIcon; label: string; hint: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="card-motion-surface group relative flex h-full min-h-[5.4rem] items-center gap-3.5 overflow-hidden border-b border-white/10 bg-transparent p-4 text-left transition-control duration-control hover:border-mint hover:bg-white/[0.025] active:scale-[0.99]"
    >
      <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-[.8rem] border border-white/10 text-mint transition-control duration-control group-hover:border-mint group-hover:bg-mint group-hover:text-black">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-black leading-tight">{label}</span>
        <span className="block truncate text-[13px] text-white/50">{hint}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-white/20 transition-control duration-control group-hover:translate-x-0.5 group-hover:text-mint" />
    </button>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function HomeView({
  data,
  displayName,
  accentColor,
  themeMode,
  setModal,
  update,
}: {
  data: ReturnType<typeof useMemoUserData>;
  displayName: string;
  accentColor: string;
  themeMode: ThemeMode;
  setModal: (modal: Modal) => void;
  update: (next: (draft: AppData) => AppData) => void;
}) {
  const now = Date.now();
  const studied = data.materials.filter((item) => item.studied).length;
  const pendingTasks = data.tasks.filter((task) => !task.done).sort((a, b) => a.dueAt - b.dueAt);
  const completion = percent(studied + data.tasks.filter((task) => task.done).length, data.materials.length + data.tasks.length);
  const latest = data.materials.slice().sort((a, b) => b.createdAt - a.createdAt)[0];
  const days = streakDays(data.sessions);
  const dueToday = pendingTasks.filter((task) => task.dueAt <= today()).length;
  const overdue = pendingTasks.filter((task) => task.dueAt < today()).length;

  const gam = gamificationOf(data);
  const dueCards = data.flashcards.filter((card) => card.dueAt <= now).length;
  const weekSessions = data.sessions.filter((session) => session.createdAt >= today() - 6 * 86400000);
  const weekFocus = focusMinutes(weekSessions);
  const series = dailySeries(data.sessions, 14);
  const mastery = percent(studied, Math.max(data.materials.length, 1));

  const dueBySubject = data.subjects
    .map((subject) => ({
      subject,
      due: data.flashcards.filter((card) => card.subjectId === subject.id && card.dueAt <= now).length,
    }))
    .filter((entry) => entry.due > 0)
    .sort((a, b) => b.due - a.due);

  // um nó por matéria: o globo é a leitura espacial dos mesmos números dos cards
  const globeNodes: GlobeNode[] = data.subjects.map((subject) => {
    const items = data.materials.filter((item) => item.subjectId === subject.id);
    const done = items.filter((item) => item.studied).length;
    const due = data.flashcards.filter((card) => card.subjectId === subject.id && card.dueAt <= now).length;
    return {
      id: subject.id,
      label: subject.name,
      color: subject.color,
      value: items.length,
      progress: percent(done, Math.max(items.length, 1)),
      hint: items.length ? `${done}/${items.length} estudados` : "sem conteúdo ainda",
      alert: due || undefined,
    };
  });

  const masteryRows: MasteryRow[] = data.subjects
    .map((subject) => {
      const items = data.materials.filter((item) => item.subjectId === subject.id);
      return {
        id: subject.id,
        name: subject.name,
        color: subject.color,
        done: items.filter((item) => item.studied).length,
        total: items.length,
      };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <>
      <PageHeader
        eyebrow="Área de estudos"
        title={`${greeting()}, ${displayName}`}
        subtitle={
          overdue
            ? `${overdue} ${overdue === 1 ? "tarefa atrasada" : "tarefas atrasadas"} esperando por você. Começar pela mais antiga costuma render.`
            : dueToday
              ? `Você tem ${dueToday} ${dueToday === 1 ? "tarefa" : "tarefas"} para hoje. Bora tirar do caminho?`
              : "Tudo em dia. Um bom momento para adiantar um conteúdo novo."
        }
        action={
          <>
            <IconButton icon={Search} label="Busca" onClick={() => go("search")} />
            <IconButton icon={Settings} label="Perfil e ajustes" onClick={() => go("perfil")} />
            <PrimaryButton onClick={() => setModal({ type: "subject" })} icon={Plus}>
              Nova matéria
            </PrimaryButton>
          </>
        }
      />

      <div className="grid gap-7">
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Reveal>
            <section className="card-ambient-surface studio-library relative overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-[#171c1a] p-5 md:p-7">
              <header className="relative flex flex-col gap-4 border-b border-white/[0.09] pb-5 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-mint">
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    Biblioteca ativa
                  </p>
                  <h2 className="mt-2.5 font-display text-[2rem] font-black leading-none tracking-[-.04em] md:text-[2.65rem]">Suas matérias</h2>
                  <p className="mt-2 text-[13px] font-bold text-white/42">
                    {data.subjects.length
                      ? `${data.subjects.length} ${data.subjects.length === 1 ? "matéria" : "matérias"} · ${data.materials.length} ${
                          data.materials.length === 1 ? "conteúdo" : "conteúdos"
                        } · ${mastery}% estudado`
                      : "Crie a primeira matéria e comece a organizar o semestre."}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <SecondaryButton onClick={() => go("search")} icon={Search}>Buscar</SecondaryButton>
                  <PrimaryButton onClick={() => setModal({ type: "subject" })} icon={Plus}>Nova matéria</PrimaryButton>
                </div>
              </header>

              <div className="relative mt-6 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {data.subjects.map((subject, index) => (
                  <SubjectCard
                    key={subject.id}
                    subject={subject}
                    index={index}
                    materials={data.materials.filter((item) => item.subjectId === subject.id)}
                  />
                ))}
              </div>

              {!data.subjects.length ? (
                <EmptyState
                  icon={Rocket}
                  title="Monte sua primeira matéria"
                  text="Reúna arquivos, links e anotações. A partir daqui, tarefas, revisões e a Mine passam a usar o mesmo contexto."
                  action={<PrimaryButton onClick={() => setModal({ type: "subject" })} icon={Plus}>Criar matéria</PrimaryButton>}
                />
              ) : null}
            </section>
          </Reveal>

          <Reveal className="h-full" delay={0.06} direction="left">
            <TodayPanel completion={completion} dueToday={dueToday} days={days} weekFocus={weekFocus} nextTask={pendingTasks[0]} />
          </Reveal>
        </div>

        <Stagger className="grid overflow-hidden rounded-[1.1rem] border border-white/[0.08] bg-[#151a18] sm:grid-cols-2 lg:grid-cols-4" gap={0.04}>
          <StaggerItem className="h-full">
            <QuickAction icon={Bot} label="Conversar com a Mine" hint="Tire qualquer dúvida" onClick={() => go("mine")} />
          </StaggerItem>
          <StaggerItem className="h-full">
            <QuickAction icon={CalendarPlus} label="Plano de estudos" hint="Cronograma até a prova" onClick={() => go("plan")} />
          </StaggerItem>
          <StaggerItem className="h-full">
            <QuickAction icon={Timer} label="Sessão de foco" hint="Pomodoro com registro" onClick={() => go("foco")} />
          </StaggerItem>
          <StaggerItem className="h-full">
            <QuickAction icon={Search} label="Buscar" hint="Ache qualquer conteúdo" onClick={() => go("search")} />
          </StaggerItem>
        </Stagger>

        <div className="grid gap-6 xl:grid-cols-12">
          <Reveal className="xl:col-span-9" delay={0.04}>
            <CommandDeck
              nodes={globeNodes}
              accentColor={accentColor}
              themeMode={themeMode}
              latestTitle={latest?.title}
              days={days}
              materials={data.materials.length}
              studied={studied}
              pending={pendingTasks.length}
              dueCards={dueCards}
              onCreate={() => setModal({ type: "subject" })}
            />
          </Reveal>

          <Stagger className="grid grid-cols-2 content-start overflow-hidden rounded-[1.1rem] border border-white/[0.08] bg-[#151a18] xl:col-span-3" gap={0.04}>
            <StaggerItem className="h-full"><StatTile label="Nível" value={gam.level} detail={gam.title} accent="#B7A8CE" onClick={() => go("progress")} /></StaggerItem>
            <StaggerItem className="h-full"><StatTile label="Sequência" value={days} detail={days === 1 ? "dia seguido" : "dias seguidos"} accent="#D98E87" spark={series} /></StaggerItem>
            <StaggerItem className="h-full"><StatTile label="Foco (7 dias)" value={humanMinutes(weekFocus)} detail={`${weekSessions.length} sessões`} accent="#B8D6C0" onClick={() => go("foco")} /></StaggerItem>
            <StaggerItem className="h-full"><StatTile label="Domínio" value={`${mastery}%`} detail={`${studied}/${data.materials.length} conteúdos`} accent="#A8C4D1" /></StaggerItem>
            <StaggerItem className="col-span-2 h-full"><StatTile label="Revisões vencidas" value={dueCards} detail={dueCards ? "cartões esperando" : "nada pendente"} accent={dueCards ? "#E4B875" : "#B8D6C0"} /></StaggerItem>
          </Stagger>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_.6fr]">
          <Reveal delay={0.05}>
            <GlassCard className="h-full">
              <SectionTitle icon={Flame} title="Constância" hint="cada quadrado é um dia de estudo" />
              <div className="mt-5">
                <ConsistencyHeatmap sessions={data.sessions} />
              </div>
              <div className="mt-6 border-t border-white/[0.08] pt-5">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.16em] text-white/40">
                  <TrendingUp className="h-3.5 w-3.5 text-mint" />
                  ritmo recente
                </div>
                <div className="mt-4">
                  <ActivityChart sessions={data.sessions} />
                </div>
              </div>
            </GlassCard>
          </Reveal>

          <div className="grid content-start gap-6">
            <Reveal delay={0.08} direction="left">
              <MinePromo />
            </Reveal>
            <Reveal delay={0.11} direction="left">
              <GlassCard className="h-full">
                <SectionTitle icon={Activity} title="Como você estuda" hint="tipos de sessão" />
                <div className="mt-6">
                  <SessionMix sessions={data.sessions} />
                </div>
              </GlassCard>
            </Reveal>
          </div>
        </div>

        <div className="grid content-start gap-6 md:grid-cols-2 xl:grid-cols-3">
          {data.subjects.length ? (
            <Reveal delay={0.06}>
              <GlassCard className="h-full">
                <SectionTitle icon={Target} title="Domínio por matéria" hint="conteúdos marcados como estudados" />
                <div className="mt-4">
                  <MasteryBars rows={masteryRows} onSelect={(id) => go("subject", id)} />
                </div>
              </GlassCard>
            </Reveal>
          ) : null}

          {dueBySubject.length ? (
            <Reveal delay={0.1}>
              <GlassCard className="h-full">
                <SectionTitle icon={Layers} title="Revisões de hoje" hint="repetição espaçada" />
                <div className="mt-4 space-y-2.5">
                  {dueBySubject.slice(0, 3).map(({ subject, due }) => (
                    <motion.button
                      key={subject.id}
                      onClick={() => setModal({ type: "flashcards", subjectId: subject.id })}
                      whileHover={{ x: 4 }}
                      transition={spring.snappy}
                      className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-left transition-colors hover:border-mint/35 hover:bg-white/[0.07]"
                    >
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-black"
                        style={{ backgroundColor: subject.color, boxShadow: `0 0 20px ${subject.color}44` }}
                      >
                        <Layers className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-black leading-tight">{subject.name}</span>
                        <span className="block text-[13px] text-white/48">
                          {due} {due === 1 ? "cartão vencido" : "cartões vencidos"}
                        </span>
                      </span>
                      <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded-full bg-mint/15 px-2 text-xs font-black text-mint">{due}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-mint" />
                    </motion.button>
                  ))}
                </div>
              </GlassCard>
            </Reveal>
          ) : null}

          <Reveal delay={0.14}>
            <GlassCard className="h-full">
              <SectionTitle
                icon={CalendarCheck}
                title="Próximas tarefas"
                action={
                  pendingTasks.length > 4 ? (
                    <button onClick={() => go("agenda")} className="text-[13px] font-black text-mint transition hover:text-white">
                      Ver todas
                    </button>
                  ) : undefined
                }
              />
              <div className="mt-4 space-y-2.5">
                {pendingTasks.slice(0, 4).map((task) => {
                  const subject = data.subjects.find((item) => item.id === task.subjectId);
                  return (
                    <TaskRow
                      key={task.id}
                      task={task}
                      subject={subject}
                      toggle={() =>
                        update((draft) => ({
                          ...draft,
                          tasks: draft.tasks.map((item) => (item.id === task.id ? toggleDone(item, !item.done) : item)),
                        }))
                      }
                    />
                  );
                })}
                {!pendingTasks.length ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-mint/20 bg-mint/[0.07] p-4">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-mint" />
                    <p className="text-sm font-bold text-white/70">Tudo em dia por aqui.</p>
                  </div>
                ) : null}
              </div>
            </GlassCard>
          </Reveal>
        </div>
      </div>
    </>
  );
}

/**
 * Painel de comando da home. À esquerda a leitura em texto/números; à direita o
 * globo 3D com uma matéria por nó — as duas metades mostram os mesmos dados,
 * uma para ler e outra para explorar.
 */
function CommandDeck({
  nodes,
  accentColor,
  themeMode,
  latestTitle,
  days,
  materials,
  studied,
  pending,
  dueCards,
  onCreate,
}: {
  nodes: GlobeNode[];
  accentColor: string;
  themeMode: ThemeMode;
  latestTitle?: string;
  days: number;
  materials: number;
  studied: number;
  pending: number;
  dueCards: number;
  onCreate: () => void;
}) {
  const reduced = useSoftMotion();

  return (
    <section className="relative h-full min-h-[30rem] overflow-hidden rounded-[1.25rem] border border-white/[0.08] bg-[#171c1a]">
      <span aria-hidden className="absolute inset-0 studio-paper-grid opacity-20" />
      <span aria-hidden className="absolute inset-y-0 left-[42%] hidden w-px bg-white/[0.08] md:block" />

      <div className="relative grid min-h-[30rem] md:grid-cols-[.82fr_1.18fr]">
        <div className="flex min-w-0 flex-col justify-between border-b border-white/10 p-6 md:border-b-0 md:p-8">
          <div>
            <Pill icon={Brain}>Mente da Mine</Pill>
            <h2 className="mt-5 max-w-md font-display text-[2rem] font-black leading-[1.02] tracking-[-.045em] md:text-[2.3rem]">
              A mente da Mine conecta tudo o que você estuda.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/52">
              {latestTitle
                ? `Cada matéria alimenta novas conexões. Seu ponto mais recente foi ${latestTitle}.`
                : "Crie uma matéria para a Mine começar a relacionar conteúdos, tarefas e revisões."}
            </p>

            {nodes.length ? (
              <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-bold text-white/45">
                <span className="text-mint">{nodes.length}</span>
                {nodes.length === 1 ? "matéria no mapa" : "matérias no mapa"}
                <span className="text-white/20">·</span>
                <span className="text-cyanGlow">{studied}</span> já estudados
                {dueCards ? (
                  <>
                    <span className="text-white/20">·</span>
                    <span className="text-amberGlow">{dueCards}</span> revisões vencidas
                  </>
                ) : null}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => go("mine")}
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-[.8rem] border border-mint/25 bg-mint/[0.08] px-4 text-[12px] font-black text-mint transition-control duration-control hover:border-mint/55 hover:bg-mint/[0.14]"
            >
              <Bot className="h-4 w-4" />
              Conversar com a Mine
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-8 grid grid-cols-3 border-y border-white/10">
            <div className="py-4 pr-3">
              <p className="font-display text-2xl font-black tabular">{materials}</p>
              <p className="text-[10px] font-black uppercase text-white/35">conteúdos</p>
            </div>
            <div className="border-x border-white/10 px-3 py-4">
              <p className="font-display text-2xl font-black tabular">{pending}</p>
              <p className="text-[10px] font-black uppercase text-white/35">pendências</p>
            </div>
            <div className="py-4 pl-3">
              <p className="font-display text-2xl font-black tabular">{days}</p>
              <p className="text-[10px] font-black uppercase text-white/35">sequência</p>
            </div>
          </div>
        </div>

        {/* a camada absoluta é quem carrega o tamanho; o globo se estica dentro
            dela. Não misturar `absolute` com o `relative` interno do componente:
            no CSS do Tailwind o `relative` ganha e o host perde a altura. */}
        <div className="relative min-h-[26rem] md:min-h-0">
          <div className="absolute inset-0">
            <KnowledgeGlobe
              className="h-full w-full"
              nodes={nodes}
              accentColor={accentColor}
              light={themeMode === "light"}
              reduced={reduced}
              onSelect={(id) => go("subject", id)}
              onEmpty={onCreate}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function TodayPanel({
  completion,
  dueToday,
  days,
  weekFocus,
  nextTask,
}: {
  completion: number;
  dueToday: number;
  days: number;
  weekFocus: number;
  nextTask?: Task;
}) {
  const reduced = useSoftMotion();
  return (
    <Spotlight
      className="card-ambient-surface relative h-full min-h-[28rem] overflow-hidden rounded-[1.25rem] border border-white/[0.08] bg-[#202723]"
      color="rgba(184,214,192,0.06)"
      size={420}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-mint" />
      <div className="relative flex h-full flex-col p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-mint">Hoje</p>
            <h2 className="mt-1 font-display text-2xl font-black tracking-[-.035em]">Sua próxima ação</h2>
          </div>
          <span className="grid h-11 w-11 place-items-center rounded-[.8rem] border border-white/10 text-mint">
            <Activity className="h-5 w-5" />
          </span>
        </div>

        <div className="my-7 grid place-items-center">
          <div className="relative">
            <RadialScore value={completion} label="rotina" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <div className="border-l-2 border-mint/55 px-2.5 py-1">
            <p className="font-display text-xl font-black tabular">{dueToday}</p>
            <p className="text-[10px] font-bold leading-tight text-white/45">para hoje</p>
          </div>
          <div className="border-l-2 border-roseGlow/55 px-2.5 py-1">
            <p className="font-display text-xl font-black tabular">{days}</p>
            <p className="text-[10px] font-bold leading-tight text-white/45">dias seguidos</p>
          </div>
          <div className="border-l-2 border-amberGlow/55 px-2.5 py-1">
            <p className="font-display text-xl font-black tabular">{humanMinutes(weekFocus)}</p>
            <p className="text-[10px] font-bold leading-tight text-white/45">foco na semana</p>
          </div>
        </div>

        <button
          onClick={() => go(nextTask ? "agenda" : "foco")}
          className="group mt-auto flex min-h-14 items-center gap-3 border-t border-white/10 pt-5 text-left"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[.8rem] bg-mint text-black transition-transform duration-control group-hover:scale-105">
            {nextTask ? <ListChecks className="h-5 w-5" /> : <Timer className="h-5 w-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-black uppercase tracking-[.18em] text-white/35">{nextTask ? "Próximo passo" : "Tempo livre"}</span>
            <span className="block truncate font-black">{nextTask?.title || "Iniciar uma sessão de foco"}</span>
          </span>
          <ArrowRight className="h-4 w-4 text-mint transition-transform duration-control group-hover:translate-x-1" />
        </button>
      </div>
    </Spotlight>
  );
}

function SubjectCard({ subject, materials, index }: { subject: Subject; materials: Material[]; index: number }) {
  const Icon = iconMap[subject.icon];
  const studied = materials.filter((item) => item.studied).length;
  const done = percent(studied, Math.max(materials.length, 1));
  const reduced = useSoftMotion();

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.28), duration: 0.42, ease: ease.out }}
      className="h-full"
    >
      <button
        onClick={() => go("subject", subject.id)}
        className="card-motion-surface group relative flex h-full min-h-[11.5rem] w-full flex-col overflow-hidden rounded-[1rem] border border-white/[0.08] bg-[#202723] p-5 text-left transition-control duration-control hover:-translate-y-0.5 hover:border-white/20"
      >
          <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: subject.color }} />

          <div className="relative flex items-start justify-between">
            <span
              className="grid h-12 w-12 place-items-center rounded-[.8rem] text-black transition-transform duration-control group-hover:scale-105"
              style={{ backgroundColor: subject.color }}
            >
              <Icon className="h-6 w-6" />
            </span>
            <span className="flex items-center gap-2">
              {subject.favorite ? (
                <Star className="h-5 w-5 fill-mint text-mint" />
              ) : (
                <Star className="h-5 w-5 text-white/25" />
              )}
            </span>
          </div>

          <div className="relative mt-auto pt-7">
            <h3 className="line-clamp-2 font-display text-[1.35rem] font-black leading-tight tracking-[-.025em]">{subject.name}</h3>
            <p className="mt-1 text-[13px] text-white/48">
              {materials.length} {materials.length === 1 ? "conteúdo" : "conteúdos"} · {done}% estudado
            </p>
            <AnimatedBar value={done} className="mt-4" height={7} from={subject.color} to="#38BDF8" delay={index * 0.05} />
            <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3 text-[12px] font-black uppercase tracking-[.08em] text-white/48 transition-colors duration-control group-hover:text-mint">
              Abrir matéria
              <ArrowRight className="h-4 w-4 transition-transform duration-control group-hover:translate-x-1" />
            </div>
          </div>
      </button>
    </motion.div>
  );
}

function MinePromo() {
  return (
    <motion.button
      whileTap={{ scale: 0.99 }}
      transition={spring.snappy}
      onClick={() => go("mine")}
      className="card-motion-surface group relative w-full overflow-hidden rounded-[1.1rem] bg-mint p-6 text-left text-black"
    >
        <div className="relative flex items-center gap-4">
          <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-[.9rem] border border-black/15 bg-black/5">
            <Bot className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-[1.75rem] font-black leading-none">Mine</h3>
            <p className="mt-1.5 text-[13px] font-bold leading-snug text-black/62">Tire dúvidas de qualquer assunto, a qualquer hora.</p>
          </div>
          <ArrowRight className="ml-auto h-5 w-5 shrink-0 transition-transform duration-control group-hover:translate-x-1" />
        </div>
    </motion.button>
  );
}

function SubjectView({
  subject,
  data,
  setModal,
  update,
  notify,
  setSelectedSubjectId,
}: {
  subject: Subject;
  data: ReturnType<typeof useMemoUserData>;
  setModal: (modal: Modal | null) => void;
  update: (next: (draft: AppData) => AppData) => void;
  notify: (message: string) => void;
  setSelectedSubjectId: (id: string | undefined) => void;
}) {
  const Icon = iconMap[subject.icon];
  const materials = data.materials.filter((item) => item.subjectId === subject.id);
  const tasks = data.tasks.filter((item) => item.subjectId === subject.id);
  const studied = materials.filter((item) => item.studied).length;
  const dueCards = data.flashcards.filter((item) => item.subjectId === subject.id && item.dueAt <= Date.now()).length;

  function confirmDeleteSubject() {
    setModal({
      type: "confirm",
      title: "Excluir matéria?",
      body: `"${subject.name}" será apagada com todos os conteúdos, tarefas, flashcards e conversas dela. Essa ação não tem volta.`,
      onConfirm: () => {
        update((draft) => ({
          ...draft,
          subjects: draft.subjects.filter((item) => item.id !== subject.id),
          materials: draft.materials.filter((item) => item.subjectId !== subject.id),
          tasks: draft.tasks.filter((item) => item.subjectId !== subject.id),
          chats: draft.chats.filter((item) => item.subjectId !== subject.id),
          sessions: draft.sessions.filter((item) => item.subjectId !== subject.id),
          flashcards: draft.flashcards.filter((item) => item.subjectId !== subject.id),
        }));
        notify("Matéria excluída.");
        go("home");
      },
    });
  }

  async function runQuick(label: string) {
    const fullPrompt = `${label} com base nos conteúdos que adicionei na matéria ${subject.name}. Use o que está cadastrado nesta matéria.`;
    update((draft) => ({
      ...draft,
      chats: [...draft.chats, { id: uid("chat"), userId: subject.userId, subjectId: subject.id, role: "user", text: fullPrompt, createdAt: Date.now() }],
    }));
    setSelectedSubjectId(subject.id);
    go("mine");
    let quickBudget = 40_000;
    const contentLines = materials
      .map((item) => {
        const body = (item.content?.trim() || item.detail?.trim() || "").slice(0, Math.max(0, Math.min(4000, quickBudget)));
        quickBudget -= body.length;
        return `- ${item.title}${item.type === "image" ? " [imagem enviada]" : ""}: ${body || "sem detalhe"}`;
      })
      .join("\n");
    const context = `Materia: ${subject.name}.\nConteudos desta materia (analise TODOS para responder):\n${contentLines || "- nenhum conteudo ainda"}`;
    const imageAttachments = materialsToImageAttachments(materials);
    try {
      const assistant = await requestAssistantResponse({ prompt: fullPrompt, history: [], context, attachments: imageAttachments });
      const reply = assistant.reply.trim() || "Não consegui analisar agora. Tente novamente em instantes.";
      update((draft) => ({
        ...draft,
        chats: [...draft.chats, { id: uid("chat"), userId: subject.userId, subjectId: subject.id, role: "mine", text: reply, createdAt: Date.now() + 1 }],
      }));
    } catch {
      update((draft) => ({
        ...draft,
        chats: [...draft.chats, { id: uid("chat"), userId: subject.userId, subjectId: subject.id, role: "mine", text: "Tive um problema para responder agora. Tente de novo em instantes.", createdAt: Date.now() + 1 }],
      }));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Matéria"
        title={subject.name}
        subtitle={(() => {
          const open = tasks.filter((task) => !task.done).length;
          return `${materials.length} ${materials.length === 1 ? "conteúdo" : "conteúdos"} · ${open} ${open === 1 ? "tarefa aberta" : "tarefas abertas"}`;
        })()}
        action={
          <>
            <IconButton icon={ChevronLeft} label="Voltar" onClick={() => go("home")} />
            <IconButton icon={Trash2} label="Excluir matéria" onClick={confirmDeleteSubject} />
            <PrimaryButton onClick={() => setModal({ type: "material", subjectId: subject.id })} icon={Plus}>
              Adicionar conteúdo
            </PrimaryButton>
          </>
        }
      />
      <div className="grid gap-5">
        <Reveal>
          <HeroCard>
            <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-black"
                    style={{ backgroundColor: subject.color, boxShadow: `0 0 40px ${subject.color}55` }}
                  >
                    <Icon className="h-7 w-7" />
                  </span>
                  <Pill icon={Sparkles}>Painel da matéria</Pill>
                </div>
                <h2 className="mt-5 font-display text-[1.75rem] font-black leading-tight md:text-4xl">
                  Conteúdos, tarefas e revisões no mesmo painel.
                </h2>
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-[13px] font-bold text-white/50">
                    <span>Progresso da matéria</span>
                    <span className="tabular text-mint">{percent(studied, Math.max(materials.length, 1))}%</span>
                  </div>
                  <AnimatedBar value={percent(studied, Math.max(materials.length, 1))} height={9} from={subject.color} to="#38BDF8" />
                </div>
                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  <Metric icon={CheckCircle2} value={studied} label="estudados" accent="#34D399" />
                  <Metric icon={Circle} value={Math.max(materials.length - studied, 0)} label="pendentes" accent="#38BDF8" />
                  <Metric icon={FileText} value={materials.length} label="no total" accent="#A78BFA" />
                </div>
              </div>
              <Stagger className="grid content-start gap-3" gap={0.07}>
                <StaggerItem>
                  <button
                    onClick={() => go("mine")}
                    className="sheen group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-mint to-mintDeep p-4 text-left font-black text-black shadow-glow"
                  >
                    <Bot className="h-5 w-5" /> Abrir Mine
                    <ArrowRight className="ml-auto h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </StaggerItem>
                {(
                  [
                    { icon: Layers, label: dueCards > 0 ? `Flashcards (${dueCards} hoje)` : "Flashcards", modal: { type: "flashcards" as const, subjectId: subject.id }, badge: dueCards },
                    { icon: ClipboardCheck, label: "Modo prova", modal: { type: "quiz" as const, subjectId: subject.id }, badge: 0 },
                    { icon: Wand2, label: "Mapa mental", modal: { type: "mindmap" as const, subjectId: subject.id }, badge: 0 },
                  ] as const
                ).map((entry) => (
                  <StaggerItem key={entry.label}>
                    <button
                      onClick={() => setModal(entry.modal)}
                      className="group flex w-full items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.055] p-4 text-left font-black text-white/80 backdrop-blur-xl transition-control duration-control hover:-translate-y-0.5 hover:border-mint/45 hover:bg-mint/10 hover:text-white"
                    >
                      <entry.icon className="h-5 w-5 shrink-0 text-mint transition-transform duration-control group-hover:scale-110" />
                      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                      {entry.badge > 0 ? (
                        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-mint px-1.5 text-xs font-black text-black">{entry.badge}</span>
                      ) : (
                        <ArrowRight className="h-4 w-4 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-mint" />
                      )}
                    </button>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </HeroCard>
        </Reveal>

        <Reveal delay={0.06}>
          <GlassCard>
            <SectionTitle icon={Sparkles} title="Ações inteligentes" hint="a Mine lê tudo que está nesta matéria" />
            <Stagger className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" gap={0.06}>
              {[
                { label: "Gerar resumo", hint: "Um panorama do conteúdo", icon: FileText, accent: "#34D399" },
                { label: "Criar perguntas", hint: "Teste o que você fixou", icon: ClipboardCheck, accent: "#38BDF8" },
                { label: "Plano de revisão", hint: "O que revisar e quando", icon: CalendarCheck, accent: "#A78BFA" },
                { label: "Explicar do zero", hint: "Como se fosse a 1ª vez", icon: Brain, accent: "#FBBF24" },
              ].map((item) => (
                <StaggerItem key={item.label} className="h-full">
                  <button
                    onClick={() => runQuick(item.label)}
                    className="group relative h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-5 text-left transition-control duration-control hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.075]"
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-surface group-hover:opacity-50"
                      style={{ background: item.accent }}
                    />
                    <span
                      className="relative grid h-11 w-11 place-items-center rounded-xl transition-transform duration-control group-hover:scale-110"
                      style={{ backgroundColor: `${item.accent}1f`, color: item.accent }}
                    >
                      <item.icon className="h-5 w-5" />
                    </span>
                    <p className="relative mt-6 font-display text-[1.15rem] font-black leading-tight">{item.label}</p>
                    <p className="relative mt-1 text-[13px] text-white/48">{item.hint}</p>
                    <ArrowRight className="relative mt-4 h-4 w-4 -translate-x-1 text-mint opacity-0 transition-control duration-control group-hover:translate-x-0 group-hover:opacity-100" />
                  </button>
                </StaggerItem>
              ))}
            </Stagger>
          </GlassCard>
        </Reveal>

        <div className="grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
          <Reveal delay={0.1}>
            <GlassCard className="h-full">
              <SectionTitle
                icon={Folder}
                title="Conteúdos"
                hint={materials.length ? `${studied} de ${materials.length} estudados` : undefined}
                action={
                  <SecondaryButton icon={Plus} onClick={() => setModal({ type: "material", subjectId: subject.id })}>
                    Adicionar
                  </SecondaryButton>
                }
              />
              <Stagger className="mt-4 space-y-2.5" gap={0.04}>
                {materials.map((material) => (
                  <StaggerItem key={material.id}>
                    <MaterialRow material={material} update={update} open={() => setModal({ type: "materialView", materialId: material.id })} />
                  </StaggerItem>
                ))}
              </Stagger>
              {!materials.length ? (
                <EmptyState
                  icon={Folder}
                  title="Sem conteúdo ainda"
                  text="Adicione arquivo, link, imagem ou anotação. Tudo que entrar aqui vira contexto para a Mine responder."
                  action={
                    <PrimaryButton icon={Plus} onClick={() => setModal({ type: "material", subjectId: subject.id })}>
                      Adicionar conteúdo
                    </PrimaryButton>
                  }
                />
              ) : null}
            </GlassCard>
          </Reveal>

          <Reveal delay={0.14} direction="left">
            <GlassCard className="h-full">
              <SectionTitle
                icon={CalendarCheck}
                title="Tarefas"
                action={
                  <SecondaryButton icon={Plus} onClick={() => setModal({ type: "task", subjectId: subject.id })}>
                    Nova
                  </SecondaryButton>
                }
              />
              <Stagger className="mt-4 space-y-2.5" gap={0.04}>
                {tasks.map((task) => (
                  <StaggerItem key={task.id}>
                    <TaskRow
                      task={task}
                      subject={subject}
                      toggle={() =>
                        update((draft) => ({
                          ...draft,
                          tasks: draft.tasks.map((item) => (item.id === task.id ? toggleDone(item, !item.done) : item)),
                        }))
                      }
                      remove={() => {
                        update((draft) => ({ ...draft, tasks: draft.tasks.filter((item) => item.id !== task.id) }));
                        notify("Tarefa excluída.");
                      }}
                    />
                  </StaggerItem>
                ))}
              </Stagger>
              {!tasks.length ? (
                <EmptyState icon={CalendarCheck} title="Sem tarefas" text="Crie uma tarefa com prazo para esta matéria e ela aparece na Agenda." />
              ) : null}
            </GlassCard>
          </Reveal>
        </div>
      </div>
    </>
  );
}

function MaterialRow({ material, update, open }: { material: Material; update: (next: (draft: AppData) => AppData) => void; open: () => void }) {
  const Icon = material.type === "link" ? LinkIcon : material.type === "file" ? Paperclip : material.type === "image" ? Camera : FileText;
  return (
    <motion.div
      whileHover={{ x: 3 }}
      transition={spring.snappy}
      className="card-motion-surface group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 transition-colors duration-control hover:border-mint/30 hover:bg-white/[0.065]"
    >
      {/* barra de estado à esquerda: verde quando estudado */}
      <span
        aria-hidden
        className={`absolute inset-y-2 left-0 w-[3px] rounded-full transition-control duration-control ${material.studied ? "bg-mint" : "bg-white/0 group-hover:bg-white/20"}`}
      />
      <button onClick={open} className="flex min-w-0 flex-1 items-center gap-3.5 text-left">
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint/12 text-mint transition-transform duration-control group-hover:scale-105">
          <Icon className="h-[22px] w-[22px]" />
          {material.favorite ? <Star className="absolute -right-1.5 -top-1.5 h-4 w-4 fill-amberGlow text-amberGlow" /> : null}
        </span>
        <span className="min-w-0">
          <span className={`block truncate font-black leading-tight ${material.studied ? "text-white/65" : ""}`}>{material.title}</span>
          <span className="block truncate text-[13px] text-white/45">
            {material.content ? "Texto salvo — a Mine analisa" : material.detail || "Toque para abrir"}
          </span>
        </span>
      </button>
      <motion.button
        whileTap={{ scale: 0.94 }}
        transition={spring.snappy}
        onClick={() =>
          update((draft) => ({
            ...draft,
            materials: draft.materials.map((item) => (item.id === material.id ? toggleStudied(item, !item.studied) : item)),
          }))
        }
        aria-pressed={material.studied}
        className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-black transition-colors duration-control ${
          material.studied ? "bg-mint text-black shadow-glowSoft" : "bg-white/[0.07] text-white/60 hover:bg-white/[0.12] hover:text-white"
        }`}
      >
        {material.studied ? <Check className="h-4 w-4" /> : null}
        {material.studied ? "Estudado" : "Marcar"}
      </motion.button>
    </motion.div>
  );
}

function AgendaView({ data, setModal, update, notify }: { data: ReturnType<typeof useMemoUserData>; setModal: (modal: Modal) => void; update: (next: (draft: AppData) => AppData) => void; notify: (message: string) => void }) {
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [showDone, setShowDone] = useState(false);
  const weekdayShort = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
  const weekdayLong = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });

  const byDue = (a: Task, b: Task) => a.dueAt - b.dueAt || a.createdAt - b.createdAt;
  const tasks = subjectFilter ? data.tasks.filter((task) => task.subjectId === subjectFilter) : data.tasks;
  const open = tasks.filter((task) => !task.done);
  const overdue = open.filter((task) => task.dueAt < today()).sort(byDue);
  const todayOpen = open.filter((task) => task.dueAt === today()).sort(byDue);
  const weekOpen = open.filter((task) => task.dueAt > today() && task.dueAt <= addDays(7)).sort(byDue);
  const laterOpen = open.filter((task) => task.dueAt > addDays(7)).sort(byDue);
  const doneTasks = tasks.filter((task) => task.done).sort((a, b) => b.dueAt - a.dueAt);
  const doneTodayCount = tasks.filter((task) => task.done && task.dueAt === today()).length;
  const todayTotal = todayOpen.length + doneTodayCount;

  const week = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(index);
    return { day, count: open.filter((task) => task.dueAt === day).length };
  });
  const dayTasks = dayFilter !== null ? tasks.filter((task) => task.dueAt === dayFilter).sort((a, b) => Number(a.done) - Number(b.done) || byDue(a, b)) : [];

  const toggleTask = (task: Task) =>
    update((draft) => ({
      ...draft,
      tasks: draft.tasks.map((item) => (item.id === task.id ? toggleDone(item, !item.done) : item)),
    }));
  const removeTask = (task: Task) => {
    update((draft) => ({ ...draft, tasks: draft.tasks.filter((item) => item.id !== task.id) }));
    notify("Tarefa excluída.");
  };
  const postponeTask = (task: Task) => {
    update((draft) => ({ ...draft, tasks: draft.tasks.map((item) => (item.id === task.id ? { ...item, dueAt: today() } : item)) }));
    notify("Tarefa reagendada para hoje.");
  };
  const renderTask = (task: Task, options?: { postpone?: boolean }) => (
    <TaskRow
      key={task.id}
      task={task}
      subject={data.subjects.find((subject) => subject.id === task.subjectId)}
      toggle={() => toggleTask(task)}
      remove={() => removeTask(task)}
      postpone={options?.postpone ? () => postponeTask(task) : undefined}
    />
  );

  const groups: Array<{ title: string; tasks: Task[]; empty?: string }> = [
    { title: `Hoje (${todayOpen.length})`, tasks: todayOpen, empty: "Nada para hoje. Aproveite para adiantar a semana ou revisar flashcards." },
    { title: `Esta semana (${weekOpen.length})`, tasks: weekOpen },
    { title: `Depois (${laterOpen.length})`, tasks: laterOpen },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Agenda"
        title="Sua rotina"
        subtitle={overdue.length ? `${overdue.length} ${overdue.length === 1 ? "tarefa atrasada" : "tarefas atrasadas"} esperando por você.` : "Semana organizada. Escolha um dia para focar."}
        action={
          <PrimaryButton icon={Plus} onClick={() => setModal({ type: "task" })}>
            Nova tarefa
          </PrimaryButton>
        }
      />
      <div className="grid gap-5">
        <Reveal>
          <GlassCard>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <SectionTitle icon={CalendarDays} title="Sua semana" hint="toque em um dia para filtrar" />
              <div className="flex flex-wrap gap-2 text-xs font-black">
                {overdue.length ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amberGlow/25 bg-amberGlow/12 px-3 py-1.5 text-amberGlow">
                    <Flame className="h-3.5 w-3.5" />
                    {overdue.length} atrasadas
                  </span>
                ) : null}
                <span className="rounded-full bg-white/[0.07] px-3 py-1.5 text-white/60">{todayOpen.length} hoje</span>
                <span className="rounded-full bg-white/[0.07] px-3 py-1.5 text-white/60">{weekOpen.length} na semana</span>
              </div>
            </div>
            {todayTotal ? (
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-[13px] font-bold text-white/52">
                  <span>Progresso de hoje</span>
                  <span className="tabular text-mint">
                    {doneTodayCount} de {todayTotal}
                  </span>
                </div>
                <AnimatedBar value={percent(doneTodayCount, todayTotal)} height={9} />
              </div>
            ) : null}
            <div className="mt-5 grid grid-cols-7 gap-1.5 md:gap-2">
              {week.map(({ day, count }, index) => {
                const active = dayFilter === day;
                const isToday = day === today();
                return (
                  <motion.button
                    key={day}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setDayFilter(active ? null : day)}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.045, duration: 0.45, ease: ease.out }}
                    whileHover={{ y: -3 }}
                    className={`relative overflow-hidden rounded-2xl border p-2 text-center transition-colors duration-control md:p-3 ${
                      active
                        ? "border-mint bg-mint/15 shadow-glowSoft"
                        : count
                          ? "border-white/12 bg-white/[0.05] hover:border-mint/35"
                          : "border-white/10 bg-white/[0.025] opacity-55 hover:opacity-100"
                    }`}
                  >
                    {isToday && !active ? <span className="absolute inset-x-3 top-0 h-[2px] rounded-full bg-mint" /> : null}
                    <p className="text-[10px] font-black uppercase text-white/45 md:text-xs">{weekdayShort.format(new Date(day)).replace(".", "")}</p>
                    <p className={`font-display text-lg font-black tabular md:text-xl ${isToday ? "text-mint" : ""}`}>{new Date(day).getDate()}</p>
                    {count ? (
                      <span className="mx-auto mt-1 grid h-5 min-w-5 place-items-center rounded-full bg-mint px-1 text-[10px] font-black text-black">{count}</span>
                    ) : (
                      <span className="mt-1 block h-5 text-[10px] font-bold text-white/20">·</span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </GlassCard>
        </Reveal>

        {data.subjects.length > 1 ? (
          <Reveal delay={0.05}>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={!subjectFilter}
                onClick={() => setSubjectFilter(null)}
                className={`relative rounded-full px-4 py-2 text-[13px] font-black transition-colors duration-control ${
                  !subjectFilter ? "bg-mint text-black shadow-glowSoft" : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white"
                }`}
              >
                Todas
              </button>
              {data.subjects.map((subject) => {
                const active = subjectFilter === subject.id;
                return (
                  <button
                    key={subject.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSubjectFilter(active ? null : subject.id)}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-black transition-colors duration-control ${
                      active ? "text-black shadow-glowSoft" : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white"
                    }`}
                    style={active ? { backgroundColor: subject.color } : undefined}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: active ? "rgba(0,0,0,.55)" : subject.color }} />
                    {subject.name}
                  </button>
                );
              })}
            </div>
          </Reveal>
        ) : null}

        <Reveal delay={0.08}>
          <ShineBorder radius={24} duration={9}>
            <motion.button
              onClick={() => go("plan")}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.99 }}
              transition={spring.soft}
              className="depth-panel sheen relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-mint via-mint to-cyanGlow p-6 text-left text-black shadow-glow"
            >
              <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full border border-black/10" />
              <span aria-hidden className="pointer-events-none absolute -right-4 -bottom-20 h-44 w-44 rounded-full border border-black/10" />
              <div className="relative flex items-center gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-black/12">
                  <CalendarPlus className="h-7 w-7" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-[1.6rem] font-black leading-tight md:text-3xl">Cronograma até a prova</h2>
                  <p className="mt-1 text-[13px] font-bold text-black/62">Monte um plano de revisão e envie tudo para a agenda.</p>
                </div>
                <ArrowRight className="ml-auto hidden h-6 w-6 shrink-0 sm:block" />
              </div>
            </motion.button>
          </ShineBorder>
        </Reveal>

        {!tasks.length ? (
          <EmptyState
            icon={CalendarDays}
            title="Agenda vazia"
            text="Crie uma tarefa ou gere um plano de estudos para preencher sua rotina."
            action={
              <PrimaryButton icon={Plus} onClick={() => setModal({ type: "task" })}>
                Criar primeira tarefa
              </PrimaryButton>
            }
          />
        ) : dayFilter !== null ? (
          <GlassCard>
            <SectionTitle
              icon={CalendarDays}
              title={`${weekdayLong.format(new Date(dayFilter))} · ${shortDate(dayFilter)}`}
              action={
                <button type="button" onClick={() => setDayFilter(null)} className="text-sm font-black text-mint transition hover:text-white">
                  Ver tudo
                </button>
              }
            />
            <Stagger className="mt-4 space-y-2.5" gap={0.045}>
              {dayTasks.map((task) => (
                <StaggerItem key={task.id}>{renderTask(task)}</StaggerItem>
              ))}
            </Stagger>
            {!dayTasks.length ? <p className="mt-4 text-sm text-white/45">Nenhuma tarefa para este dia.</p> : null}
          </GlassCard>
        ) : (
          <>
            {overdue.length ? (
              <Reveal delay={0.1}>
                <section className="depth-panel relative overflow-hidden rounded-lg border border-amberGlow/25 bg-amberGlow/[0.06] p-5 shadow-panel backdrop-blur-lg md:p-6">
                  <span aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-amberGlow/15 blur-[70px]" />
                  <div className="relative flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amberGlow/15 text-amberGlow">
                        <Flame className="h-5 w-5" />
                      </span>
                      <h2 className="font-display text-[1.35rem] font-black md:text-2xl">Atrasadas ({overdue.length})</h2>
                    </div>
                    <p className="hidden text-sm font-bold text-amberGlow/70 md:block">Reagende para hoje ou conclua.</p>
                  </div>
                  <Stagger className="relative mt-4 space-y-2.5" gap={0.045}>
                    {overdue.map((task) => (
                      <StaggerItem key={task.id}>{renderTask(task, { postpone: true })}</StaggerItem>
                    ))}
                  </Stagger>
                </section>
              </Reveal>
            ) : null}
            {groups.map(({ title, tasks: groupTasks, empty }, groupIndex) =>
              groupTasks.length || empty ? (
                <Reveal key={title} delay={0.12 + groupIndex * 0.04}>
                  <GlassCard>
                    <SectionTitle icon={CalendarDays} title={title} />
                    <Stagger className="mt-4 space-y-2.5" gap={0.04}>
                      {groupTasks.map((task) => (
                        <StaggerItem key={task.id}>{renderTask(task)}</StaggerItem>
                      ))}
                    </Stagger>
                    {!groupTasks.length && empty ? <p className="mt-4 text-sm text-white/45">{empty}</p> : null}
                  </GlassCard>
                </Reveal>
              ) : null,
            )}
            {doneTasks.length ? (
              <GlassCard>
                <SectionTitle
                  icon={CheckCircle2}
                  title={`Concluídas (${doneTasks.length})`}
                  action={
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() =>
                          setModal({
                            type: "confirm",
                            title: "Excluir tarefas concluídas?",
                            body: `${doneTasks.length} ${doneTasks.length === 1 ? "tarefa concluída será removida" : "tarefas concluídas serão removidas"} da agenda. Essa ação não tem volta.`,
                            onConfirm: () => {
                              update((draft) => ({
                                ...draft,
                                tasks: draft.tasks.filter((item) => !(item.done && (!subjectFilter || item.subjectId === subjectFilter))),
                              }));
                              notify("Tarefas concluídas removidas.");
                            },
                          })
                        }
                        className="text-[13px] font-black text-white/45 transition hover:text-roseGlow"
                      >
                        Limpar
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDone((value) => !value)}
                        aria-expanded={showDone}
                        className="inline-flex items-center gap-1 text-[13px] font-black text-mint transition hover:text-white"
                      >
                        {showDone ? "Ocultar" : "Mostrar"}
                        <motion.span animate={{ rotate: showDone ? 180 : 0 }} transition={spring.snappy} className="grid place-items-center">
                          <ChevronDown className="h-4 w-4" />
                        </motion.span>
                      </button>
                    </div>
                  }
                />
                <AnimatePresence initial={false}>
                  {showDone ? (
                    <motion.div
                      key="done-list"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: ease.out }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 space-y-2.5">{doneTasks.map((task) => renderTask(task))}</div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </GlassCard>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

function TaskRow({ task, subject, toggle, remove, postpone }: { task: Task; subject?: Subject; toggle: () => void; remove?: () => void; postpone?: () => void }) {
  const isOverdue = !task.done && task.dueAt < today();
  const reduced = useSoftMotion();
  return (
    <motion.div
      layout={!reduced}
      whileHover={reduced ? undefined : { x: 3 }}
      transition={spring.snappy}
      className={`card-motion-surface group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border p-3.5 transition-colors duration-control ${
        isOverdue ? "border-amberGlow/25 bg-amberGlow/[0.06]" : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.065]"
      }`}
    >
      <span
        aria-hidden
        className="absolute inset-y-2 left-0 w-[3px] rounded-full transition-colors duration-control"
        style={{ background: task.done ? "#34D399" : isOverdue ? "#FBBF24" : "transparent" }}
      />
      <motion.button
        onClick={toggle}
        whileTap={{ scale: 0.88 }}
        transition={spring.snappy}
        aria-label={task.done ? `Reabrir tarefa ${task.title}` : `Concluir tarefa ${task.title}`}
        aria-pressed={task.done}
        className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors duration-control ${
          task.done ? "bg-mint text-black shadow-glowSoft" : "bg-white/[0.06] text-white/50 hover:bg-mint/15 hover:text-mint"
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {task.done ? (
            <motion.span key="on" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={spring.snappy}>
              <CheckCircle2 className="h-[22px] w-[22px]" />
            </motion.span>
          ) : (
            <motion.span key="off" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={spring.snappy}>
              <Circle className="h-[22px] w-[22px]" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      <div className="min-w-0 flex-1">
        <p className={`truncate font-black leading-tight transition-colors ${task.done ? "text-white/38 line-through" : ""}`}>{task.title}</p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-white/45">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: subject?.color || "rgba(255,255,255,.3)" }} />
          <span className="truncate">
            {subject?.name || "Matéria"} · <span className={isOverdue ? "font-black text-amberGlow" : ""}>{dateLabel(task.dueAt)}</span>
            {task.note ? ` · ${task.note}` : ""}
          </span>
        </p>
      </div>
      {postpone ? (
        <motion.button
          onClick={postpone}
          whileTap={{ scale: 0.9 }}
          transition={spring.snappy}
          aria-label={`Reagendar ${task.title} para hoje`}
          title="Reagendar para hoje"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amberGlow/25 bg-amberGlow/10 text-amberGlow transition hover:bg-amberGlow/25"
        >
          <CalendarPlus className="h-[18px] w-[18px]" />
        </motion.button>
      ) : null}
      {remove ? (
        <motion.button
          onClick={remove}
          whileTap={{ scale: 0.9 }}
          transition={spring.snappy}
          aria-label={`Excluir tarefa ${task.title}`}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white/25 opacity-0 transition-control duration-control hover:bg-roseGlow/12 hover:text-roseGlow focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-[18px] w-[18px]" />
        </motion.button>
      ) : null}
    </motion.div>
  );
}

/**
 * Linha de ajuste com botões de menos/mais.
 *
 * Com `edit` o número vira um campo digitável (sugestão do brenasso: "edição
 * manual do tempo em foco"). Chegar de 25 a 90 minutos batendo no + de 5 em 5
 * era treze cliques; agora dá para digitar.
 */
function Stepper({
  label,
  value,
  onMinus,
  onPlus,
  edit,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  edit?: { value: number; min: number; max: number; unit: string; onChange: (value: number) => void };
}) {
  const [typing, setTyping] = useState(false);
  const [rascunho, setRascunho] = useState("");

  function confirmar() {
    if (!edit) return;
    const numero = Number(rascunho);
    if (Number.isFinite(numero) && rascunho.trim() !== "") {
      edit.onChange(Math.min(Math.max(Math.round(numero), edit.min), edit.max));
    }
    setTyping(false);
  }

  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:border-white/[0.18]">
      <div className="min-w-0">
        <p className="font-black leading-tight">{label}</p>
        {edit && typing ? (
          <span className="mt-0.5 flex items-center gap-1.5">
            <input
              autoFocus
              type="number"
              inputMode="numeric"
              min={edit.min}
              max={edit.max}
              value={rascunho}
              aria-label={`${label} em ${edit.unit}`}
              onChange={(event) => setRascunho(event.target.value)}
              onBlur={confirmar}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  confirmar();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setRascunho(String(edit.value));
                  setTyping(false);
                }
              }}
              className="w-16 rounded-lg border border-mint/50 bg-black/40 px-2 py-0.5 text-[13px] tabular text-mint outline-none"
            />
            <span className="text-[13px] font-bold text-white/40">{edit.unit}</span>
          </span>
        ) : edit ? (
          <button
            type="button"
            onClick={() => {
              setRascunho(String(edit.value));
              setTyping(true);
            }}
            title="Clique para digitar"
            className="mt-0.5 rounded text-[13px] tabular text-mint underline decoration-mint/30 underline-offset-4 transition hover:decoration-mint"
          >
            {value}
          </button>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.p
              key={value}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: ease.out }}
              className="text-[13px] tabular text-mint"
            >
              {value}
            </motion.p>
          </AnimatePresence>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <motion.button
          onClick={onMinus}
          whileTap={{ scale: 0.88 }}
          transition={spring.snappy}
          aria-label="Diminuir"
          className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.07] text-white transition-colors hover:bg-mint/20 hover:text-mint"
        >
          <Minus className="h-4 w-4" />
        </motion.button>
        <motion.button
          onClick={onPlus}
          whileTap={{ scale: 0.88 }}
          transition={spring.snappy}
          aria-label="Aumentar"
          className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.07] text-white transition-colors hover:bg-mint/20 hover:text-mint"
        >
          <Plus className="h-4 w-4" />
        </motion.button>
      </div>
    </div>
  );
}

const focusTips = [
  "Deixe o celular em outro cômodo ou fora do alcance. Só de estar visível, ele já rouba sua atenção.",
  "Antes de iniciar, escolha UMA tarefa para a sessão. Foco é dizer não para todo o resto.",
  "Beba água na pausa e levante da cadeira. Seu cérebro aprende melhor com o corpo ativo.",
  "Anote as distrações que surgirem num papel e volte para elas só depois da sessão.",
  "Estudar com sono não rende: se estiver exausto, uma pausa longa vale mais que um ciclo forçado.",
  "Revisar o que estudou logo após a sessão dobra a retenção. Use os flashcards da Mine.",
  "Sessões curtas e constantes vencem maratonas raras. A sequência de dias importa mais que a duração.",
  "Explique o que acabou de estudar em voz alta, como se ensinasse alguém. É o teste mais honesto.",
  "Fones com ruído branco ou instrumental ajudam a manter o ritmo em ambientes barulhentos.",
  "Termine a sessão anotando onde parou. Começar a próxima fica muito mais fácil.",
];

function FocusView({
  data,
  user,
  update,
  notify,
}: {
  data: ReturnType<typeof useMemoUserData>;
  user: User;
  update: (next: (draft: AppData) => AppData) => void;
  notify: (message: string) => void;
}) {
  const subjects = data.subjects;
  const reducedFocusMotion = useSoftMotion();
  const [focusMin, setFocusMin] = useState(() => Math.min(Math.max(user.settings.focusMinutes || 25, 1), 240));
  const [breakMin, setBreakMin] = useState(5);
  const [phase, setPhase] = useState<"focus" | "break">("focus");
  const [longBreak, setLongBreak] = useState(false);
  const [remaining, setRemaining] = useState(focusMin * 60);
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState(0);
  const [subjectId, setSubjectId] = useState<string | undefined>(subjects[0]?.id);
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * focusTips.length));

  useEffect(() => {
    if (!running || remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [running, remaining]);

  useEffect(() => {
    if (!running || remaining > 0) return;
    setRunning(false);
    if (user.settings.focusVibrate !== false && "vibrate" in navigator) navigator.vibrate?.(450);
    if (phase === "focus") {
      const nextCycles = cycles + 1;
      setCycles(nextCycles);
      if (subjectId) {
        update((draft) => ({
          ...draft,
          sessions: [...draft.sessions, { id: uid("session"), userId: user.id, subjectId, title: `Sessão de foco (${focusMin} min)`, kind: "Foco", createdAt: Date.now() }],
        }));
      }
      const isLong = nextCycles % 4 === 0;
      setLongBreak(isLong);
      notify(isLong ? "4 ciclos completos! Você merece uma pausa longa." : "Sessão de foco concluída! Hora da pausa.");
      setPhase("break");
      setRemaining(breakMin * (isLong ? 3 : 1) * 60);
    } else {
      setLongBreak(false);
      setPhase("focus");
      setRemaining(focusMin * 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, running]);

  // Mostra o tempo restante no título da aba enquanto o cronômetro roda.
  useEffect(() => {
    if (!running) return;
    const m = String(Math.floor(remaining / 60)).padStart(2, "0");
    const s = String(remaining % 60).padStart(2, "0");
    document.title = `${m}:${s} · ${phase === "focus" ? "Foco" : "Pausa"} — Minerva`;
    return () => {
      document.title = "Minerva";
    };
  }, [running, remaining, phase]);

  // Mantém a tela ligada durante o foco (se ativado nos Ajustes).
  useEffect(() => {
    if (!running || user.settings.keepScreenOnFocus === false) return;
    let sentinel: { release?: () => Promise<void> } | null = null;
    const navAny = navigator as unknown as { wakeLock?: { request: (type: string) => Promise<{ release?: () => Promise<void> }> } };
    navAny.wakeLock?.request("screen").then((value) => { sentinel = value; }).catch(() => {});
    return () => { sentinel?.release?.().catch(() => {}); };
  }, [running, user.settings.keepScreenOnFocus]);

  const total = phase === "focus" ? focusMin * 60 : breakMin * (longBreak ? 3 : 1) * 60;
  const fraction = total > 0 ? remaining / total : 0;
  const accent = phase === "focus" ? "#34D399" : "#38BDF8";
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const radius = 104;
  const circumference = 2 * Math.PI * radius;

  function persistFocusMinutes(value: number) {
    update((draft) => ({
      ...draft,
      users: draft.users.map((item) => (item.id === user.id ? { ...item, settings: { ...item.settings, focusMinutes: value } } : item)),
    }));
  }
  function changeFocus(delta: number) {
    setFocusExact(focusMin + delta);
  }
  function changeBreak(delta: number) {
    setBreakExact(breakMin + delta);
  }
  // Usadas tanto pelos botões +/- quanto pelo campo digitável do Stepper.
  // O teto subiu de 120 para 240 min: quem estuda em blocos longos pedia isso.
  function setFocusExact(raw: number) {
    const value = Math.min(Math.max(Math.round(raw), 1), 240);
    setFocusMin(value);
    if (!running && phase === "focus") setRemaining(value * 60);
    persistFocusMinutes(value);
  }
  function setBreakExact(raw: number) {
    const value = Math.min(Math.max(Math.round(raw), 1), 90);
    setBreakMin(value);
    if (!running && phase === "break") setRemaining(value * (longBreak ? 3 : 1) * 60);
  }
  function applyPreset(focusValue: number, breakValue: number) {
    setFocusMin(focusValue);
    setBreakMin(breakValue);
    if (!running) {
      setRemaining(phase === "focus" ? focusValue * 60 : breakValue * (longBreak ? 3 : 1) * 60);
    }
    persistFocusMinutes(focusValue);
  }
  function reset() {
    setRunning(false);
    setRemaining(phase === "focus" ? focusMin * 60 : breakMin * (longBreak ? 3 : 1) * 60);
  }
  function skip() {
    setRunning(false);
    if (phase === "focus") {
      setPhase("break");
      setLongBreak(false);
      setRemaining(breakMin * 60);
    } else {
      setLongBreak(false);
      setPhase("focus");
      setRemaining(focusMin * 60);
    }
  }

  const focusSessions = data.sessions.filter((item) => item.kind === "Foco");
  const sessionMinutes = (title: string) => Number(title.match(/\((\d+) min\)/)?.[1] || 0);
  const todaySessions = focusSessions.filter((item) => item.createdAt >= today());
  const weekSessions = focusSessions.filter((item) => item.createdAt >= today() - 6 * 86400000);
  const todayMinutes = todaySessions.reduce((sum, item) => sum + sessionMinutes(item.title), 0);
  const recentSessions = focusSessions.slice(-4).reverse();
  const focusTasks = data.tasks
    .filter((task) => !task.done && task.dueAt <= today())
    .sort((a, b) => a.dueAt - b.dueAt || a.createdAt - b.createdAt)
    .slice(0, 6);
  const presets = [
    ["Pomodoro", 25, 5],
    ["Sprint", 15, 3],
    ["Estudo longo", 50, 10],
  ] as const;
  const cycleDots = longBreak && cycles > 0 && cycles % 4 === 0 ? 4 : cycles % 4;

  return (
    <>
      <PageHeader
        eyebrow="Sessão de foco"
        title="Foco"
        subtitle={running ? (phase === "focus" ? "Sessão rodando. Sem abas abertas, sem celular." : "Pausa em andamento. Levante e beba água.") : "Escolha a duração, a matéria e comece um ciclo."}
      />
      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <div className="grid content-start gap-5">
          <Reveal>
            <GlassCard className={running ? "!border-mint/25" : ""}>
              <div className="flex flex-col items-center gap-6 py-2">
                <Pill icon={phase === "focus" ? Timer : Coffee} tone={phase === "focus" ? "mint" : "cyan"}>
                  {phase === "focus" ? "Concentre-se nos estudos" : longBreak ? "Pausa longa merecida" : "Hora da pausa"}
                </Pill>

                <div className="relative grid h-72 w-72 place-items-center">
                  {/* halo pulsando enquanto roda — sinaliza sessão ativa de longe */}
                  {running && !reducedFocusMotion ? (
                    <motion.span
                      className="absolute h-64 w-64 rounded-full"
                      style={{ background: `radial-gradient(circle, ${accent}33, transparent 65%)` }}
                      animate={{ scale: [1, 1.08, 1], opacity: [0.45, 0.75, 0.45] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    />
                  ) : null}
                  {/* anéis decorativos com marcas de minuto */}
                  <svg viewBox="0 0 240 240" className="absolute inset-0 h-full w-full -rotate-90">
                    <defs>
                      <linearGradient id="focus-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={accent} />
                        <stop offset="100%" stopColor={phase === "focus" ? "#38BDF8" : "#A78BFA"} />
                      </linearGradient>
                    </defs>
                    <circle cx="120" cy="120" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="14" />
                    <circle
                      cx="120"
                      cy="120"
                      r={radius}
                      fill="none"
                      stroke="url(#focus-ring)"
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeDasharray={`${circumference * fraction} ${circumference}`}
                      style={{ filter: `drop-shadow(0 0 10px ${accent}77)`, transition: "stroke-dasharray .95s linear" }}
                    />
                    <circle cx="120" cy="120" r={radius - 22} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="2 10" />
                  </svg>
                  <div className="text-center">
                    <p className="font-display text-[3.4rem] font-black leading-none tabular">
                      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                    </p>
                    <p className="mt-2 text-[11px] font-black uppercase tracking-[.3em]" style={{ color: accent }}>
                      {phase === "focus" ? "Foco" : longBreak ? "Pausa longa" : "Pausa"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2" aria-label={`${cycleDots} de 4 ciclos até a pausa longa`}>
                    {[0, 1, 2, 3].map((dot) => (
                      <motion.span
                        key={dot}
                        className="h-2.5 w-2.5 rounded-full"
                        animate={{
                          backgroundColor: dot < cycleDots ? "#34D399" : "rgba(255,255,255,.15)",
                          scale: dot < cycleDots ? 1.15 : 1,
                        }}
                        transition={spring.snappy}
                      />
                    ))}
                  </div>
                  <p className="text-[13px] font-bold text-white/52">
                    {cycles} {cycles === 1 ? "ciclo concluído" : "ciclos concluídos"} · pausa longa a cada 4
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <SecondaryButton icon={RotateCcw} onClick={reset}>
                    Reiniciar
                  </SecondaryButton>
                  <PrimaryButton icon={running ? Pause : Play} onClick={() => setRunning((value) => !value)}>
                    {running ? "Pausar" : "Iniciar"}
                  </PrimaryButton>
                  <SecondaryButton icon={SkipForward} onClick={skip}>
                    Pular
                  </SecondaryButton>
                </div>
              </div>
            </GlassCard>
          </Reveal>

          <Reveal delay={0.08}>
            <GlassCard>
              <SectionTitle
                icon={CalendarCheck}
                title="Para fazer nesta sessão"
                action={
                  <button type="button" onClick={() => go("agenda")} className="text-[13px] font-black text-mint transition hover:text-white">
                    Ver agenda
                  </button>
                }
              />
              <Stagger className="mt-4 space-y-2.5" gap={0.045}>
                {focusTasks.map((task) => (
                  <StaggerItem key={task.id}>
                    <TaskRow
                      task={task}
                      subject={subjects.find((subject) => subject.id === task.subjectId)}
                      toggle={() =>
                        update((draft) => ({
                          ...draft,
                          tasks: draft.tasks.map((item) => (item.id === task.id ? toggleDone(item, !item.done) : item)),
                        }))
                      }
                    />
                  </StaggerItem>
                ))}
              </Stagger>
              {!focusTasks.length ? (
                <p className="mt-4 text-sm text-white/48">Nada pendente para hoje. Escolha uma matéria e estude no seu ritmo.</p>
              ) : null}
            </GlassCard>
          </Reveal>
        </div>
        <div className="grid content-start gap-5">
          <Reveal delay={0.06} direction="left">
            <GlassCard>
              <SectionTitle icon={Timer} title="Durações" />
              <div className="mt-4 flex flex-wrap gap-2">
                {presets.map(([label, focusValue, breakValue]) => {
                  const active = focusMin === focusValue && breakMin === breakValue;
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={active}
                      onClick={() => applyPreset(focusValue, breakValue)}
                      className={`relative rounded-full px-4 py-2 text-[13px] font-black transition-colors duration-control ${
                        active ? "text-black" : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white"
                      }`}
                    >
                      {active ? (
                        <motion.span layoutId="focus-preset" className="absolute inset-0 rounded-full bg-mint shadow-glowSoft" transition={spring.snappy} />
                      ) : null}
                      <span className="relative">
                        {label} · {focusValue}/{breakValue}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 space-y-3">
                <Stepper
                  label="Tempo de estudo"
                  value={`${focusMin} min`}
                  onMinus={() => changeFocus(-5)}
                  onPlus={() => changeFocus(5)}
                  edit={{ value: focusMin, min: 1, max: 240, unit: "min", onChange: setFocusExact }}
                />
                <Stepper
                  label="Tempo de descanso"
                  value={`${breakMin} min`}
                  onMinus={() => changeBreak(-1)}
                  onPlus={() => changeBreak(1)}
                  edit={{ value: breakMin, min: 1, max: 90, unit: "min", onChange: setBreakExact }}
                />
              </div>
            </GlassCard>
          </Reveal>
          <Reveal delay={0.1} direction="left">
            <GlassCard>
              <SectionTitle icon={BookOpen} title="Contar foco para" hint="a sessão vira registro no Progresso" />
              <div className="mt-4 flex flex-wrap gap-2">
                {subjects.length ? (
                  subjects.map((subject) => {
                    const active = subjectId === subject.id;
                    return (
                      <button
                        key={subject.id}
                        onClick={() => setSubjectId(subject.id)}
                        aria-pressed={active}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-black transition-colors duration-control ${
                          active ? "text-black shadow-glowSoft" : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white"
                        }`}
                        style={active ? { backgroundColor: subject.color } : undefined}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ background: active ? "rgba(0,0,0,.55)" : subject.color }} />
                        {subject.name}
                      </button>
                    );
                  })
                ) : (
                  <p className="text-sm text-white/50">Crie uma matéria para registrar suas sessões de foco no Progresso.</p>
                )}
              </div>
            </GlassCard>
          </Reveal>

          <Reveal delay={0.14} direction="left">
            <GlassCard>
              <SectionTitle icon={Activity} title="Seu foco" />
              <Stagger className="mt-4 grid grid-cols-2 gap-2.5 text-center" gap={0.06}>
                {[
                  { value: todaySessions.length, label: todayMinutes ? `hoje · ${todayMinutes} min` : "sessões hoje", accent: "#34D399" },
                  { value: weekSessions.length, label: "na semana", accent: "#38BDF8" },
                  { value: focusSessions.length, label: "no total", accent: "#A78BFA" },
                  { value: streakDays(data.sessions), label: "dias seguidos", accent: "#FBBF24" },
                ].map((entry) => (
                  <StaggerItem key={entry.label}>
                    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-4 transition-colors hover:border-white/20">
                      <span
                        aria-hidden
                        className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full opacity-0 blur-2xl transition-opacity duration-surface group-hover:opacity-60"
                        style={{ background: entry.accent }}
                      />
                      <p className="relative font-display text-[1.75rem] font-black leading-none tabular" style={{ color: entry.accent }}>
                        <CountUp value={entry.value} />
                      </p>
                      <p className="relative mt-1.5 text-[11px] font-bold text-white/48">{entry.label}</p>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
              {recentSessions.length ? (
                <div className="mt-4 space-y-2">
                  {recentSessions.map((session) => {
                    const subject = subjects.find((item) => item.id === session.subjectId);
                    return (
                      <div key={session.id} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-2.5 text-[13px]">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: subject?.color || "#34D399" }} />
                        <span className="min-w-0 truncate font-bold text-white/70">{session.title}</span>
                        <span className="ml-auto shrink-0 text-[11px] font-bold text-white/38">
                          {subject?.name ? `${subject.name} · ` : ""}
                          {shortDate(session.createdAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </GlassCard>
          </Reveal>

          <Reveal delay={0.18} direction="left">
            <GlassCard className="relative overflow-hidden">
              <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violetGlow/15 blur-[70px]" />
              <SectionTitle
                icon={Sparkles}
                title="Dica de foco"
                action={
                  <button
                    type="button"
                    onClick={() => setTipIndex((value) => (value + 1) % focusTips.length)}
                    className="inline-flex items-center gap-1.5 text-[13px] font-black text-mint transition hover:text-white"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Outra
                  </button>
                }
              />
              <AnimatePresence mode="wait">
                <motion.p
                  key={tipIndex}
                  initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                  transition={{ duration: 0.35, ease: ease.out }}
                  className="relative mt-4 leading-7 text-white/70"
                >
                  {focusTips[tipIndex]}
                </motion.p>
              </AnimatePresence>
            </GlassCard>
          </Reveal>
        </div>
      </div>
    </>
  );
}

type Achievement = AchievementRule & { icon: LucideIcon; value: number };

/**
 * O ícone é a única parte da conquista que não sai de shared/xp.mjs — lá é
 * código que também roda no servidor, e servidor não desenha ícone.
 */
const achievementIcons: Record<string, LucideIcon> = {
  "subject-1": BookOpen,
  "subject-5": Layers,
  "material-1": FileText,
  "material-15": Folder,
  "studied-1": CheckCircle2,
  "studied-10": Brain,
  "task-1": CalendarCheck,
  "task-20": ListChecks,
  "focus-1": Timer,
  "focus-10": Zap,
  "focus-25": Flame,
  "mine-1": Bot,
  "mine-30": MessageCircle,
  "prova-1": ClipboardCheck,
  "prova-5": Target,
  "cards-10": RefreshCw,
  "cards-100": Sparkles,
  "card-master-1": Star,
  "streak-3": Flame,
  "streak-7": Award,
  "games-5": Gamepad2,
  "games-25": Trophy,
};

function buildAchievements(stats: XpStats): Achievement[] {
  return achievementList.map((rule) => ({
    ...rule,
    icon: achievementIcons[rule.id] || Sparkles,
    value: stats[rule.stat],
  }));
}

function gamificationOf(data: ReturnType<typeof useMemoUserData>) {
  const stats = scopeStats(data);
  const achievements = buildAchievements(stats);
  const unlocked = unlockedAchievements(stats);
  const xp = totalXp(stats);
  return { stats, achievements, unlocked, xp, ...levelFromXp(xp) };
}

function ProgressView({ data, user }: { data: ReturnType<typeof useMemoUserData>; user: User }) {
  const gam = gamificationOf(data);
  const missing = gam.levelNeed - gam.levelXp;
  return (
    <>
      <PageHeader eyebrow="Progresso e conquistas" title={`Nível ${gam.level}`} subtitle={`${gam.title} · faltam ${missing} XP para o próximo nível.`} />
      <div className="grid gap-5">
        <Reveal>
          <HeroCard>
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <Pill icon={Award}>{gam.title}</Pill>
                {/* o nível é identidade, não magnitude — contar até ele confunde */}
                <h2 className="mt-5 font-display text-[3.25rem] font-black leading-none tabular md:text-6xl">Nível {gam.level}</h2>
                <p className="mt-3 text-white/55">
                  <span className="tabular font-black text-white/80">{gam.xp}</span> XP no total · faltam{" "}
                  <span className="tabular font-black text-mint">{missing}</span> XP para o nível {gam.level + 1}
                </p>
                <AnimatedBar value={percent(gam.levelXp, gam.levelNeed)} className="mt-4 max-w-md" height={12} />
              </div>
              <div className="shrink-0 self-center lg:self-auto">
                <ProgressRing
                  value={percent(gam.levelXp, gam.levelNeed)}
                  size={168}
                  stroke={11}
                  label={
                    <p className="font-display text-[1.6rem] font-black leading-none tabular">
                      <CountUp value={gam.levelXp} />
                      <span className="text-white/35">/{gam.levelNeed}</span>
                    </p>
                  }
                  sublabel="XP do nível"
                />
              </div>
            </div>
          </HeroCard>
        </Reveal>

        <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" gap={0.07}>
          <StaggerItem>
            <Metric icon={Zap} value={gam.xp} label="XP total" accent="#34D399" />
          </StaggerItem>
          <StaggerItem>
            <Metric icon={Award} value={`${gam.unlocked.length}/${gam.achievements.length}`} label="conquistas" accent="#FBBF24" />
          </StaggerItem>
          <StaggerItem>
            <Metric icon={Flame} value={gam.stats.streakDays} label="dias seguidos" accent="#FB7185" />
          </StaggerItem>
          <StaggerItem>
            <Metric icon={Timer} value={gam.stats.focus} label="sessões de foco" accent="#38BDF8" />
          </StaggerItem>
        </Stagger>

        <div className="grid gap-5 xl:grid-cols-2">
          <Reveal delay={0.06}>
            <GlassCard className="h-full">
              <SectionTitle icon={Activity} title="Atividade semanal" hint={`meta diária: ${user.settings.dailyGoal} min`} />
              {(() => {
                const bars = weeklyBars(data.sessions);
                const peak = Math.max(1, ...bars.map((bar) => bar.count));
                return (
                  <div className="mt-7 flex h-60 items-end gap-2.5">
                    {bars.map((bar, index) => (
                      <div key={bar.label} className="group flex flex-1 flex-col items-center gap-3">
                        <div className="relative flex w-full flex-1 items-end">
                          <motion.div
                            className="relative w-full overflow-hidden rounded-t-xl bg-gradient-to-t from-mint via-mint to-cyanGlow"
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max(6, (bar.count / peak) * 100)}%` }}
                            transition={{ duration: 0.8, delay: index * 0.06, ease: ease.out }}
                            style={{ boxShadow: bar.count ? "0 0 20px rgba(52,211,153,.28)" : undefined }}
                          >
                            <span className="absolute inset-x-0 top-0 h-6 bg-white/25 opacity-0 transition-opacity duration-control group-hover:opacity-100" />
                          </motion.div>
                          <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-lg bg-black/80 px-2 py-1 text-[11px] font-black tabular text-mint opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                            {bar.count}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-white/44">{bar.label}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </GlassCard>
          </Reveal>

          <Reveal delay={0.1}>
            <GlassCard className="h-full">
              <SectionTitle icon={Star} title="Recompensas por nível" />
              <Stagger className="mt-4 grid gap-2.5" gap={0.045}>
                {levelTitles.map((item) => {
                  const done = gam.level >= item.level;
                  return (
                    <StaggerItem key={item.level}>
                      <div
                        className={`flex items-center gap-3 rounded-2xl border p-3.5 transition-colors ${
                          done ? "border-mint/25 bg-mint/[0.07]" : "border-white/10 bg-white/[0.03]"
                        }`}
                      >
                        <span
                          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-lg font-black tabular ${
                            done ? "bg-mint text-black shadow-glowSoft" : "bg-white/10 text-white/40"
                          }`}
                        >
                          {item.level}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate font-black leading-tight ${done ? "" : "text-white/55"}`}>{item.title}</p>
                          <p className="text-[11px] font-bold text-white/38">{done ? "Título desbloqueado" : `Alcance o nível ${item.level}`}</p>
                        </div>
                        {done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-mint" /> : <Lock className="h-5 w-5 shrink-0 text-white/25" />}
                      </div>
                    </StaggerItem>
                  );
                })}
              </Stagger>
            </GlassCard>
          </Reveal>
        </div>

        <Reveal delay={0.06}>
          <GlassCard>
            <SectionTitle icon={Trophy} title={`Conquistas (${gam.unlocked.length}/${gam.achievements.length})`} hint="cada uma dá XP extra" />
            <Stagger className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3" gap={0.05}>
              {gam.achievements.map((item) => {
                const Icon = item.icon;
                const done = item.value >= item.target;
                return (
                  <StaggerItem key={item.id} className="h-full">
                    <div
                      className={`group relative h-full overflow-hidden rounded-2xl border p-4 transition-control duration-control hover:-translate-y-0.5 ${
                        done ? "border-mint/30 bg-mint/[0.08]" : "border-white/10 bg-white/[0.032] hover:border-white/20"
                      }`}
                    >
                      {done ? (
                        <span aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-mint/25 blur-2xl" />
                      ) : null}
                      <div className="relative flex items-center gap-3">
                        <span
                          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-transform duration-control group-hover:scale-105 ${
                            done ? "bg-mint text-black shadow-glowSoft" : "bg-white/10 text-white/35"
                          }`}
                        >
                          <Icon className="h-[22px] w-[22px]" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate font-black leading-tight ${done ? "" : "text-white/65"}`}>{item.title}</p>
                          <p className="truncate text-[11px] font-bold text-white/42">{item.text}</p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${done ? "bg-mint/20 text-mint" : "bg-white/[0.06] text-white/38"}`}
                        >
                          +{item.xp}
                        </span>
                      </div>
                      {!done ? (
                        <div className="relative mt-3">
                          <AnimatedBar value={percent(Math.min(item.value, item.target), item.target)} height={5} from="#34D399" to="#34D399" />
                          <p className="mt-1 text-right text-[11px] font-bold tabular text-white/38">
                            {Math.min(item.value, item.target)}/{item.target}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </GlassCard>
        </Reveal>

        <Reveal delay={0.06}>
          <GlassCard>
            <SectionTitle icon={Zap} title="Como ganhar XP" />
            <Stagger className="mt-4 grid gap-2 md:grid-cols-2" gap={0.035}>
              {xpActions.map(([label, value]) => (
                <StaggerItem key={label}>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 transition-colors hover:border-mint/25 hover:bg-mint/[0.05]">
                    <p className="min-w-0 truncate font-bold text-white/70">{label}</p>
                    <span className="shrink-0 rounded-full bg-mint/12 px-2.5 py-1 text-[11px] font-black text-mint">+{value} XP</span>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </GlassCard>
        </Reveal>
      </div>
    </>
  );
}

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
function RankingView({
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
    const jaEra = friends.some((item) => item.toLowerCase() === row.name.toLowerCase());
    const proximos = jaEra ? friends.filter((item) => item.toLowerCase() !== row.name.toLowerCase()) : [...friends, row.name];
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

  return (
    <>
      <PageHeader
        eyebrow="Ranking da Minerva"
        title="Quem está estudando mais"
        subtitle="Todo mundo que usa o site, lado a lado. Toque em alguém para abrir o perfil."
        action={
          <SecondaryButton icon={status === "carregando" ? Loader2 : RefreshCw} onClick={() => void carregar()}>
            {status === "carregando" ? "Atualizando..." : "Atualizar"}
          </SecondaryButton>
        }
      />

      <div className="grid gap-5">
        {eu && status === "pronto" ? (
          <Reveal>
            <HeroCard>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <Avatar name={eu.row.displayName} src={eu.row.avatar} size={64} ring />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[.2em] text-mint">Sua posição</p>
                    <p className="font-display text-3xl font-black leading-none tabular">
                      {eu.position}º<span className="text-lg text-white/35"> de {ordenado.length}</span>
                    </p>
                    <p className="mt-1 truncate text-[13px] font-bold text-white/50">
                      {eu.row[range]} {rangeInfo.unit} {range === "seasonPoints" ? `· liga ${eu.row.league}` : rangeInfo.label.toLowerCase() === "total" ? "no total" : `· ${rangeInfo.label.toLowerCase()}`}
                    </p>
                  </div>
                </div>
                <p className="max-w-xs text-[13px] font-bold leading-relaxed text-white/55">
                  {acimaDeMim
                    ? `Faltam ${Math.max(0, acimaDeMim.row[range] - eu.row[range])} ${rangeInfo.unit.toLowerCase()} para passar ${acimaDeMim.row.displayName}.`
                    : ordenado.length > 1
                      ? "Você está na frente de todo mundo. Segure o ritmo."
                      : "Chame a turma para o site e o placar começa a ficar interessante."}
                </p>
              </div>
            </HeroCard>
          </Reveal>
        ) : null}

        <Reveal delay={0.05}>
          <GlassCard>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <SectionTitle icon={Trophy} title="Placar" hint={rangeInfo.hint} />
                <div className="flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
                  {rankingRanges.map((item) => {
                    const ativo = item.id === range;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => setRange(item.id)}
                        className={`relative flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-[13px] font-black transition-colors duration-control ${
                          ativo ? "text-black" : "text-white/55 hover:text-white"
                        }`}
                      >
                        {ativo ? (
                          reduced ? (
                            <span className="absolute inset-0 rounded-lg bg-mint" />
                          ) : (
                            <motion.span layoutId="ranking-range" className="absolute inset-0 rounded-lg bg-mint shadow-glowSoft" transition={spring.snappy} />
                          )
                        ) : null}
                        <span className="relative">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex shrink-0 rounded-xl border border-white/10 bg-white/[0.04] p-1">
                  {([
                    { id: "todos" as const, label: `Todos (${ordenado.length})`, icon: Users },
                    { id: "amigos" as const, label: `Amigos (${rows.filter((row) => row.friend).length})`, icon: Star },
                  ]).map((item) => {
                    const ativo = item.id === escopo;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => setEscopo(item.id)}
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[12px] font-black transition-colors duration-control ${
                          ativo ? "bg-white/12 text-mint" : "text-white/50 hover:text-white"
                        }`}
                      >
                        <item.icon className="h-3.5 w-3.5" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Procurar uma pessoa</span>
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    value={busca}
                    onChange={(event) => setBusca(event.target.value)}
                    placeholder="Procurar uma pessoa"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 text-[13px] font-bold text-white outline-none transition-control duration-control placeholder:text-white/35 focus:border-mint/50 focus:bg-black/30"
                  />
                </label>
              </div>
            </div>

            {status === "erro" ? (
              <div className="mt-5">
                <EmptyState icon={XCircle} title="Não deu para carregar" text={erro} action={<PrimaryButton icon={RotateCcw} onClick={() => void carregar()}>Tentar de novo</PrimaryButton>} />
              </div>
            ) : status === "carregando" && !rows.length ? (
              <div className="mt-5 grid place-items-center gap-3 py-10 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-mint" />
                <p className="text-sm font-bold text-white/45">Somando o XP de todo mundo...</p>
              </div>
            ) : !visivel.length ? (
              <div className="mt-5">
                <EmptyState
                  icon={escopo === "amigos" ? Star : Search}
                  title={escopo === "amigos" ? "Você ainda não marcou ninguém" : "Ninguém com esse nome"}
                  text={
                    escopo === "amigos"
                      ? "Toque na estrela ao lado de alguém na aba Todos para acompanhar essa pessoa de perto."
                      : "Tente outro trecho do nome, ou volte para a lista completa."
                  }
                />
              </div>
            ) : (
              <Stagger className="mt-5 grid gap-2.5" gap={0.04}>
                {visivel.map(({ row, position }) => (
                  <StaggerItem key={row.id}>
                    <RankingRowCard
                      row={row}
                      position={position}
                      value={row[range]}
                      unit={rangeInfo.unit}
                      leader={lider}
                      reduced={Boolean(reduced)}
                      onOpen={() => go("perfil", row.id)}
                      onToggleFriend={() => alternarAmigo(row)}
                    />
                  </StaggerItem>
                ))}
              </Stagger>
            )}

            {ocultos > 0 ? (
              <p className="mt-4 border-t border-white/10 pt-4 text-[12px] font-bold text-white/35">
                {ocultos === 1 ? "Uma pessoa preferiu" : `${ocultos} pessoas preferiram`} não aparecer no ranking. Você decide isso em Perfil e ajustes.
              </p>
            ) : null}
          </GlassCard>
        </Reveal>
      </div>
    </>
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
    <div
      className={`card-motion-surface relative overflow-hidden rounded-xl border transition-control duration-control ${
        row.you ? "border-mint/40 bg-mint/[0.08]" : "border-white/10 bg-white/[0.035] hover:border-white/20"
      }`}
    >
      {/* A barra é o fundo da linha: mostra a distância para o líder sem
          ocupar mais uma coluna numa tela estreita. */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0"
        style={{ background: `linear-gradient(90deg, ${cor}22, transparent)` }}
        initial={reduced ? false : { width: 0 }}
        animate={{ width: `${leader > 0 ? Math.max(4, (value / leader) * 100) : 4}%` }}
        transition={{ duration: 0.7, ease: ease.out }}
      />
      <div className="relative flex items-center gap-2 pr-2 sm:gap-3 sm:pr-3">
        {/* A linha inteira é o botão que abre o perfil; a estrela fica fora
            dele porque um botão dentro de outro não existe em HTML. */}
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-3 text-left sm:gap-3 sm:p-3.5"
        >
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display text-[15px] font-black tabular sm:h-10 sm:w-10 ${
              medalha ? "text-black" : "bg-white/[0.08] text-white/50"
            }`}
            style={medalha ? { backgroundColor: cor, boxShadow: `0 0 18px ${cor}55` } : undefined}
          >
            {position}
          </span>
          <Avatar name={row.displayName} src={row.avatar} size={40} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 truncate font-black leading-tight">
              <span className="truncate">{row.displayName}</span>
              {row.you ? <span className="shrink-0 rounded-full bg-mint/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-[.12em] text-mint">você</span> : null}
            </span>
            {/* O título do nível é a primeira coisa a sair numa tela estreita:
                sem isso a linha quebrava em duas e a lista dobrava de altura. */}
            <span className="mt-0.5 flex items-center gap-x-2 truncate text-[11px] font-bold text-white/42">
              <span className="shrink-0">Nível {row.level}</span>
              <span aria-hidden className="hidden sm:inline">·</span>
              <span className="hidden truncate sm:inline">{row.title}</span>
              {row.streak ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-roseGlow/80">
                    <Flame className="h-3 w-3" />
                    {row.streak}d
                  </span>
                </>
              ) : null}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block font-display text-lg font-black tabular sm:text-xl" style={{ color: medalha ? cor : undefined }}>
              {value}
            </span>
            <span className="block text-[10px] font-black uppercase tracking-[.12em] text-white/32">{unit}</span>
          </span>
        </button>
        {!row.you ? (
          <button
            type="button"
            onClick={onToggleFriend}
            aria-pressed={row.friend}
            aria-label={row.friend ? `Remover ${row.displayName} dos amigos` : `Marcar ${row.displayName} como amigo`}
            title={row.friend ? "Remover dos amigos" : "Marcar como amigo"}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors ${
              row.friend ? "text-amber-300 hover:bg-amber-300/12" : "text-white/25 hover:bg-white/10 hover:text-white/60"
            }`}
          >
            <Star className={`h-[18px] w-[18px] ${row.friend ? "fill-current" : ""}`} />
          </button>
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-mint/60" />
        )}
      </div>
    </div>
  );
}

/**
 * Lista de mensagens do chat, isolada atrás de React.memo.
 *
 * O texto do streaming vive no App (`mineStreamText`), então cada token que
 * chega re-renderiza toda a árvore até aqui — uma resposta de algumas centenas
 * de tokens reconciliava a conversa inteira uma vez por token. Como `messages`
 * só muda quando uma mensagem realmente entra, esta barreira faz o streaming
 * custar apenas o balão que está sendo escrito, e não o histórico todo.
 */
const MineMessageList = React.memo(function MineMessageList({
  messages,
  reduceMotion,
}: {
  messages: ChatMessage[];
  reduceMotion: boolean;
}) {
  return (
    <>
      {messages.map((message) => (
        <motion.article
          key={message.id}
          // Sem blur: isto roda por mensagem, e ao abrir uma conversa longa
          // todas montam de uma vez. Um filtro por balão vira dezenas de
          // filtros simultâneos na tela mais usada do app. Curto também de
          // propósito — mensagem de chat tem que aparecer, não fazer entrada.
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur.surface, ease: ease.out }}
          className={`group/message flex gap-3 sm:gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}
        >
          {message.role !== "user" ? (
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-mint/22 bg-mint/[0.08] text-mint sm:h-9 sm:w-9">
              <Bot className="h-[17px] w-[17px] sm:h-[18px] sm:w-[18px]" />
            </span>
          ) : null}
          {/* No celular o balão usa quase toda a largura: com 86% sobrava uma
              faixa morta à direita e o texto quebrava a cada três palavras. */}
          <div
            title={message.role === "user" ? timeLabel(message.createdAt) : undefined}
            className={`min-w-0 text-[15px] leading-[1.7] sm:text-base sm:leading-7 ${
              message.role === "user"
                ? "max-w-[88%] rounded-[1.35rem] rounded-br-md bg-[#26332d] px-4 py-3 text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,.06)] sm:max-w-[78%] sm:px-5 sm:py-3.5"
                : "max-w-[calc(100%-2.75rem)] flex-1 px-0.5 py-1 text-white/82 sm:max-w-[min(48rem,calc(100%-3.25rem))] sm:px-1"
            }`}
          >
            {message.role === "user" ? <p className="whitespace-pre-line">{message.text}</p> : <MineMessageText text={message.text} />}
            <ChatAttachments attachments={message.attachments} tone={message.role === "user" ? "user" : "dark"} />
            <MineSources sources={message.sources} />
            {message.role !== "user" ? (
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-2.5 opacity-70 transition-opacity duration-control group-hover/message:opacity-100 group-focus-within/message:opacity-100">
                <span className="flex min-w-0 items-center gap-2 text-[11px] font-bold text-white/32">
                  <span>{timeLabel(message.createdAt)}</span>
                  {mineModelInfo(message.mineModel) ? (
                    <>
                      <span aria-hidden>·</span>
                      <span className="truncate">{mineModelInfo(message.mineModel)?.name}</span>
                    </>
                  ) : null}
                </span>
                <CopyMessageButton text={message.text} />
              </div>
            ) : null}
          </div>
        </motion.article>
      ))}
    </>
  );
});

function MineView({
  data,
  input,
  setInput,
  selectedSubjectId,
  setSelectedSubjectId,
  loading,
  suggestions,
  model,
  setModel,
  streamText,
  stop,
  webSearch,
  setWebSearch,
  webSearchAvailable,
  clear,
  send,
}: {
  data: ReturnType<typeof useMemoUserData>;
  input: string;
  setInput: (value: string) => void;
  selectedSubjectId?: string;
  setSelectedSubjectId: (value?: string) => void;
  loading: boolean;
  suggestions: string[];
  model: MineModelId;
  setModel: (value: MineModelId) => void;
  streamText: string;
  stop: () => void;
  webSearch: boolean;
  setWebSearch: (value: boolean) => void;
  webSearchAvailable: boolean;
  clear: () => void;
  send: (text: string, subjectId?: string, attachments?: ChatAttachment[]) => void | Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const reduceMotion = useReducedMotion();
  // Memoizado porque o texto do streaming mora no App: cada token que chega
  // re-renderiza esta árvore inteira. Sem isto, a lista era recriada a cada
  // token e o <MineMessageList> memoizado abaixo nunca conseguiria pular nada.
  const messages = useMemo(
    () => data.chats.filter((item) => item.subjectId === selectedSubjectId || (!selectedSubjectId && !item.subjectId)),
    [data.chats, selectedSubjectId],
  );
  const selectedSubject = selectedSubjectId ? data.subjects.find((subject) => subject.id === selectedSubjectId) : undefined;
  const quickPrompts = selectedSubject
    ? [
        `Explique ${selectedSubject.name} do zero`,
        `Faça perguntas de revisão de ${selectedSubject.name}`,
        `Resuma os conteúdos de ${selectedSubject.name}`,
        `Quais os temas mais importantes de ${selectedSubject.name}?`,
      ]
    : [
        "Crie um plano de estudos para a semana",
        "Faça perguntas de revisão",
        "Explique esta matéria do zero",
        "Monte um simulado",
      ];

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setAtBottom(true);
    setConfirmClear(false);
  }, [selectedSubjectId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !atBottom) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, loading, streamText]);

  useEffect(() => {
    if (!confirmClear) return;
    const timer = window.setTimeout(() => setConfirmClear(false), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmClear]);

  function scrollToBottom() {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function autoGrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if ((!input.trim() && !attachments.length) || loading) return;
    send(input.trim(), selectedSubjectId, attachments);
    setInput("");
    setAttachments([]);
    setAttachmentError("");
    setAtBottom(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }
  async function handleFiles(files: FileList | null) {
    const nextFiles = Array.from(files || []);
    if (!nextFiles.length) return;
    setAttachmentError("");
    const available = maxChatAttachments - attachments.length;
    if (available <= 0) {
      setAttachmentError(`Voce pode enviar ate ${maxChatAttachments} anexos por mensagem.`);
      return;
    }
    const accepted = nextFiles.slice(0, available);
    try {
      const converted = await Promise.all(accepted.map(fileToChatAttachment));
      setAttachments((current) => [...current, ...converted].slice(0, maxChatAttachments));
      if (nextFiles.length > accepted.length) {
        setAttachmentError(`Enviei os ${maxChatAttachments} primeiros anexos. Remova algum para adicionar mais.`);
      }
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : "Nao consegui anexar esse arquivo.");
    }
  }
  return (
    <section className="mine-chat-shell grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-y border-white/[0.08] bg-[#090e0c]/90 shadow-[0_34px_90px_-58px_rgba(0,0,0,.95)] backdrop-blur-xl sm:rounded-[1.5rem] sm:border xl:grid-cols-[260px_1fr] xl:grid-rows-1">
      {/*
        No celular esta barra vira uma linha só: botão redondo de novo chat +
        trilho de matérias que rola na horizontal. Antes eram três blocos
        empilhados (botão largo, rótulo, trilho) que comiam uns 150px de altura
        — numa tela de 640px isso é um quarto da conversa.
      */}
      <aside className="relative flex min-h-0 flex-col overflow-hidden border-b border-white/[0.08] bg-[#0d1511]/88 px-2.5 py-2 xl:border-b-0 xl:border-r xl:p-3">
        <span aria-hidden className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-mint/10 blur-[80px]" />
        <div className="relative flex min-w-0 items-center gap-2 xl:min-h-0 xl:flex-1 xl:flex-col xl:items-stretch xl:gap-0">
          <motion.button
            whileTap={{ scale: 0.98 }}
            transition={spring.snappy}
            onClick={() => {
              if (!messages.length) return;
              if (!confirmClear) {
                setConfirmClear(true);
                return;
              }
              clear();
              setConfirmClear(false);
            }}
            disabled={!messages.length}
            aria-label={confirmClear ? "Confirmar apagar conversa" : "Novo chat"}
            title={confirmClear ? "Apagar conversa?" : "Novo chat"}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border font-black transition-colors duration-control disabled:cursor-not-allowed disabled:opacity-40 xl:mb-4 xl:flex xl:h-auto xl:w-full xl:items-center xl:justify-center xl:gap-2 xl:px-4 xl:py-3 ${
              confirmClear
                ? "border-roseGlow/40 bg-roseGlow/15 text-roseGlow hover:bg-roseGlow/25"
                : "border-white/12 bg-white/[0.06] text-white/80 hover:border-mint/40 hover:bg-mint/10"
            }`}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={confirmClear ? "confirm" : "new"}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16 }}
                className="flex items-center gap-2"
              >
                {confirmClear ? <Trash2 className="h-[18px] w-[18px]" /> : <Plus className="h-[18px] w-[18px]" />}
                <span className="hidden xl:inline">{confirmClear ? "Apagar conversa?" : "Novo chat"}</span>
              </motion.span>
            </AnimatePresence>
          </motion.button>

          <p className="mb-3 hidden text-[10px] font-black uppercase tracking-[.24em] text-white/32 xl:block">Contexto de estudo</p>
          <div className="minerva-scroll flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 xl:min-h-0 xl:flex-col xl:overflow-x-hidden xl:overflow-y-auto xl:pb-0 xl:pr-1 xl:gap-1.5">
            <button
              onClick={() => setSelectedSubjectId(undefined)}
              className={`relative shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-[12px] font-black transition-colors duration-control sm:text-[13px] xl:w-full xl:rounded-xl xl:px-4 xl:py-2.5 ${
                !selectedSubjectId ? "text-black" : "bg-white/[0.05] text-white/65 hover:bg-white/[0.09] hover:text-white"
              }`}
            >
              {!selectedSubjectId ? (
                <motion.span layoutId="mine-context" className="absolute inset-0 rounded-lg bg-mint shadow-glowSoft xl:rounded-xl" transition={spring.snappy} />
              ) : null}
              <span className="relative">Mine geral</span>
            </button>
            {data.subjects.map((subject) => {
              const active = selectedSubjectId === subject.id;
              return (
                <button
                  key={subject.id}
                  onClick={() => setSelectedSubjectId(subject.id)}
                  className={`relative flex max-w-[9.5rem] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-[12px] font-black transition-colors duration-control sm:text-[13px] xl:w-full xl:max-w-none xl:gap-2.5 xl:whitespace-normal xl:rounded-xl xl:px-4 xl:py-2.5 ${
                    active ? "text-black" : "bg-white/[0.05] text-white/65 hover:bg-white/[0.09] hover:text-white"
                  }`}
                >
                  {active ? (
                    <motion.span layoutId="mine-context" className="absolute inset-0 rounded-lg bg-mint shadow-glowSoft xl:rounded-xl" transition={spring.snappy} />
                  ) : null}
                  <span className="relative h-2 w-2 shrink-0 rounded-full" style={{ background: active ? "rgba(0,0,0,.55)" : subject.color }} />
                  <span className="relative min-w-0 truncate">{subject.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="hidden">
          <p className="flex items-center gap-2 text-[13px] font-black text-white/80">
            <Sparkles className="h-4 w-4 text-mint" />
            A Mine pode
          </p>
          <div className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-white/48">
            {[
              "analisar os conteúdos e anexos da matéria",
              "criar matérias, conteúdos e tarefas",
              "marcar conteúdos estudados e tarefas",
              "buscar no site",
              "montar revisões, planos e simulados",
            ].map((line) => (
              <p key={line} className="flex gap-2">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-mint/60" />
                {line}
              </p>
            ))}
          </div>
          {selectedSubject ? (
            <p className="mt-3 border-t border-white/10 pt-3 text-[11px] font-bold leading-relaxed text-mint/75">
              Anexos enviados aqui ficam salvos como conteúdo em {selectedSubject.name}.
            </p>
          ) : null}
        </div>
      </aside>

      <div className="flex h-full min-h-0 min-w-0 flex-col">
        <header className="relative flex min-h-[3.75rem] shrink-0 items-center justify-between gap-2 border-b border-white/[0.07] bg-[#090e0c]/72 px-3 py-2 backdrop-blur-xl sm:gap-3 md:px-5 md:py-2.5">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-mint/25 bg-mint/[0.1] text-mint sm:h-10 sm:w-10">
              {!reduceMotion ? <span className="absolute inset-0 animate-pulse-ring rounded-full border border-mint/25" /> : null}
              <Bot className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[.2em] text-mint/80">Conversa atual</p>
              {/* Título curto no celular: a frase longa só cabia truncada. */}
              <h1 className="truncate font-display text-[15px] font-black tracking-[-.02em] sm:text-lg md:text-xl">
                <span className="sm:hidden">{selectedSubject ? selectedSubject.name : "Pergunte o que quiser"}</span>
                <span className="hidden sm:inline">{selectedSubject ? selectedSubject.name : "Mine geral"}</span>
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[13px] font-bold text-white/60 lg:inline-flex">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: selectedSubject?.color || "#34D399", boxShadow: `0 0 10px ${selectedSubject?.color || "#34D399"}` }}
              />
              {selectedSubject ? selectedSubject.name : "Mine geral"}
            </div>
            <MineModelPicker model={model} setModel={setModel} />
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            onScroll={(event) => {
              const el = event.currentTarget;
              setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
            }}
            className="mine-conversation-scroll absolute inset-0 overflow-y-auto px-3 py-5 sm:px-5 sm:py-7"
          >
            <div role="log" aria-label="Conversa com a Mine" className="mx-auto flex max-w-3xl flex-col gap-7">
              {!messages.length ? (
                <div className="grid min-h-[60vh] place-items-center py-8">
                  <motion.div
                    className="mx-auto w-full max-w-2xl text-center"
                    initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: ease.out }}
                  >
                    <span className="relative mx-auto grid h-14 w-14 place-items-center rounded-full border border-mint/30 bg-mint/[0.1] text-mint shadow-glowSoft">
                      {!reduceMotion ? <span className="absolute inset-0 animate-pulse-ring rounded-full border border-mint/30" /> : null}
                      <Bot className="h-7 w-7" />
                    </span>
                    <h2 className="mt-5 font-display text-2xl font-black leading-tight tracking-[-.04em] md:text-[2rem]">
                      {selectedSubject ? `Como posso ajudar com ${selectedSubject.name}?` : "Como posso ajudar nos seus estudos?"}
                    </h2>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-white/45">Pergunte, envie um arquivo ou escolha uma sugestão para começar.</p>
                  </motion.div>
                  <Stagger className="mt-8 grid gap-3 md:grid-cols-2" gap={0.06} delay={0.15}>
                    {quickPrompts.map((prompt) => (
                      <StaggerItem key={prompt}>
                        <button
                          onClick={() => send(prompt, selectedSubjectId)}
                          className="sheen group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.05] p-4 text-left font-bold text-white/75 transition-control duration-control hover:-translate-y-0.5 hover:border-mint/40 hover:bg-mint/10 hover:text-white"
                        >
                          <Sparkles className="h-4 w-4 shrink-0 text-mint transition-transform duration-control group-hover:scale-110 group-hover:rotate-12" />
                          <span className="min-w-0 flex-1">{prompt}</span>
                          <ArrowRight className="h-4 w-4 shrink-0 -translate-x-1 text-mint opacity-0 transition-control duration-control group-hover:translate-x-0 group-hover:opacity-100" />
                        </button>
                      </StaggerItem>
                    ))}
                  </Stagger>
                </div>
              ) : (
                <MineMessageList messages={messages} reduceMotion={Boolean(reduceMotion)} />
              )}
              {loading && streamText ? (
                <motion.article
                  className="flex gap-3 sm:gap-4"
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-mint/22 bg-mint/[0.08] text-mint">
                    <Bot className="h-[18px] w-[18px]" />
                  </span>
                  <div
                    className="max-w-[calc(100%-3rem)] flex-1 px-1 py-1 leading-7 text-white/82 sm:max-w-[min(48rem,calc(100%-3.25rem))]"
                    aria-live="polite"
                  >
                    <MineMessageText text={streamText} />
                    {/* Cursor de digitação: mostra que ainda está vindo texto. */}
                    <span aria-hidden className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-mint" />
                  </div>
                </motion.article>
              ) : loading ? (
                <motion.article
                  className="flex gap-3 sm:gap-4"
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-mint/22 bg-mint/[0.08] text-mint">
                    <Bot className="h-[18px] w-[18px]" />
                  </span>
                  <div
                    className="flex items-center gap-2 px-1 py-2"
                    aria-label="Mine está pensando"
                    aria-live="polite"
                  >
                    {reduceMotion ? (
                      <span className="text-white/60">Mine está pensando...</span>
                    ) : (
                      <>
                        {[0, 1, 2].map((dot) => (
                          <motion.span
                            key={dot}
                            className="h-2 w-2 rounded-full bg-mint"
                            animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 1, repeat: Infinity, delay: dot * 0.14, ease: "easeInOut" }}
                          />
                        ))}
                        <span className="ml-1 text-[13px] font-bold text-white/40">pensando</span>
                      </>
                    )}
                  </div>
                </motion.article>
              ) : null}
            </div>
          </div>
          <AnimatePresence>
            {!atBottom && messages.length ? (
              <motion.button
                type="button"
                onClick={scrollToBottom}
                initial={{ opacity: 0, y: 12, x: "-50%", scale: 0.85 }}
                animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
                exit={{ opacity: 0, y: 12, x: "-50%", scale: 0.85 }}
                transition={spring.snappy}
                aria-label="Ir para o fim da conversa"
                className="absolute bottom-4 left-1/2 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/75 text-mint shadow-lift backdrop-blur-xl transition-colors hover:border-mint/40"
              >
                <ChevronDown className="h-5 w-5" />
              </motion.button>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="relative shrink-0 bg-gradient-to-t from-[#090e0c] via-[#090e0c]/95 to-[#090e0c]/65 px-2.5 pb-2.5 pt-2 sm:px-4 sm:pb-4">
          {suggestions.length ? (
            <Stagger className="minerva-scroll mx-auto mb-2 flex max-w-3xl flex-nowrap gap-2 overflow-x-auto pb-1" gap={0.05}>
              {suggestions.map((suggestion) => (
                <StaggerItem key={suggestion}>
                  <button
                    onClick={() => send(suggestion, selectedSubjectId)}
                    className="shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-2 text-[13px] font-bold text-white/60 transition-control duration-control hover:-translate-y-0.5 hover:border-mint/40 hover:bg-mint/10 hover:text-white"
                  >
                    {suggestion}
                  </button>
                </StaggerItem>
              ))}
            </Stagger>
          ) : null}
          {attachments.length || attachmentError ? (
            <div className="mx-auto mb-3 max-w-4xl">
              {attachmentError ? <p className="mb-2 text-sm font-bold text-red-200">{attachmentError}</p> : null}
              {attachments.length ? (
                <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.045] p-3 md:grid-cols-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center gap-3 rounded-xl bg-black/24 p-2">
                      {attachment.kind === "image" ? (
                        <img src={attachment.dataUrl} alt={attachment.name} className="h-14 w-14 rounded-lg object-cover" />
                      ) : (
                        <span className="grid h-14 w-14 place-items-center rounded-lg bg-white/10 text-mint">
                          <Paperclip className="h-5 w-5" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-white/84">{attachment.name}</p>
                        <p className="text-xs font-bold text-white/42">{formatFileSize(attachment.size)}</p>
                      </div>
                      <button type="button" onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))} className="grid h-9 w-9 place-items-center rounded-lg text-white/54 transition hover:bg-white/10 hover:text-white">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {/*
            No celular o campo ocupa a primeira linha inteira e os botões vêm
            embaixo; em telas maiores tudo cabe numa linha só. Com três botões
            de 48px lado a lado, o que sobrava para escrever num aparelho de
            360px eram uns 150px.
          */}
          <form
            onSubmit={submit}
            className="mine-composer-shell mx-auto flex max-w-3xl flex-wrap items-end gap-1.5 rounded-[1.65rem] border border-white/[0.12] bg-[#1a231f]/96 p-2 shadow-[0_18px_60px_-26px_rgba(0,0,0,.9)] transition-[border-color,box-shadow,background-color] duration-control focus-within:border-mint/40 focus-within:bg-[#1d2822] focus-within:shadow-[0_20px_70px_-28px_rgba(57,245,154,.32)] sm:flex-nowrap sm:gap-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.md,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
              className="hidden"
              onChange={(event) => {
                handleFiles(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
            <motion.button
              type="button"
              disabled={loading}
              whileTap={{ scale: 0.9 }}
              transition={spring.snappy}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Anexar arquivo"
              title="Anexar arquivo"
              className="group order-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/55 transition-colors hover:bg-white/[0.08] hover:text-mint disabled:cursor-not-allowed disabled:opacity-40 sm:order-1 sm:h-11 sm:w-11"
            >
              <Paperclip className="h-5 w-5 transition-transform duration-control group-hover:-rotate-12 group-hover:scale-110" />
            </motion.button>
            {webSearchAvailable ? (
              <motion.button
                type="button"
                disabled={loading}
                whileTap={{ scale: 0.9 }}
                transition={spring.snappy}
                onClick={() => setWebSearch(!webSearch)}
                aria-pressed={webSearch}
                aria-label="Pesquisar na web"
                title={webSearch ? "Pesquisa na web ligada" : "Pesquisar na web"}
                className={`group order-3 grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:order-1 sm:h-11 sm:w-11 ${
                  webSearch
                    ? "bg-mint/15 text-mint"
                    : "text-white/55 hover:bg-white/[0.08] hover:text-mint"
                }`}
              >
                <Globe className="h-5 w-5 transition-transform duration-control group-hover:scale-110" />
              </motion.button>
            ) : null}
            <textarea
              ref={textareaRef}
              value={input}
              rows={1}
              onChange={(event) => {
                setInput(event.target.value);
                autoGrow();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit(event);
                }
              }}
              placeholder="Pergunte alguma coisa à Mine"
              aria-label="Mensagem para a Mine"
              className="order-1 max-h-36 min-h-11 w-full min-w-0 flex-1 resize-none basis-full bg-transparent px-3 py-2.5 text-[15px] text-white outline-none placeholder:text-white/38 sm:order-2 sm:min-h-11 sm:basis-0 sm:py-2.5"
            />
            {/* Enquanto gera, o mesmo botão vira "parar" (documento, seção 41). */}
            {loading ? (
              <motion.button
                type="button"
                onClick={stop}
                whileTap={{ scale: 0.9 }}
                transition={spring.snappy}
                aria-label="Parar geração"
                title="Parar"
                className="group order-4 ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.1] text-white/80 transition-colors duration-control hover:bg-roseGlow/18 hover:text-roseGlow sm:order-3 sm:ml-0 sm:h-11 sm:w-11"
              >
                <Square className="h-4 w-4 fill-current" />
              </motion.button>
            ) : (
              <motion.button
                disabled={!input.trim() && !attachments.length}
                whileTap={{ scale: 0.9 }}
                transition={spring.snappy}
                aria-label="Enviar mensagem"
                title="Enviar"
                className="group order-4 ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mint text-black shadow-glowSoft transition-[transform,box-shadow,opacity] duration-control hover:-translate-y-0.5 hover:shadow-glow disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-35 disabled:shadow-none sm:order-3 sm:ml-0 sm:h-11 sm:w-11"
              >
                <ArrowRight className="h-6 w-6 transition-transform duration-control group-hover:translate-x-0.5" />
              </motion.button>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}

/**
 * Escolha do nível da Mine. Mostra só os nomes da marca — nenhum ID técnico de
 * modelo chega ao navegador.
 */
function MineModelPicker({ model, setModel }: { model: MineModelId; setModel: (value: MineModelId) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 8, width: 304 });
  const current = mineModelInfo(model) || mineModels[0];

  const updatePosition = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const edge = 10;
    const mobile = window.innerWidth < 640;
    const width = mobile ? window.innerWidth - edge * 2 : Math.min(304, window.innerWidth - edge * 2);
    if (mobile) {
      setPosition({ bottom: edge, left: edge, width });
      return;
    }
    const left = Math.max(edge, Math.min(rect.right - width, window.innerWidth - width - edge));
    const estimatedHeight = 314;
    const below = rect.bottom + 8;
    const top = below + estimatedHeight <= window.innerHeight - edge
      ? below
      : Math.max(edge, rect.top - estimatedHeight - 8);
    setPosition({ top, left, width });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    updatePosition();
    const focusFrame = requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>(`[data-model="${model}"]`)?.focus();
    });
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [model, open, updatePosition]);

  function selectModel(value: MineModelId) {
    setModel(value);
    setOpen(false);
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>("button")?.focus());
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        transition={spring.snappy}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Nível da Mine: ${current.name}. Trocar.`}
        className={`inline-flex items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] font-black transition-colors duration-control sm:px-3 ${
          open ? "bg-white/[0.08] text-white" : "text-white/72 hover:bg-white/[0.06] hover:text-white"
        }`}
      >
        <span>{current.name}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-mint transition-transform duration-control ${open ? "rotate-180" : ""}`} />
      </motion.button>

      {open
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Fechar seleção de modelos"
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-[69] cursor-default bg-black/25 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none"
              />
              <motion.div
                ref={menuRef}
                role="listbox"
                aria-label="Níveis da Mine"
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={spring.snappy}
                style={{ top: position.top, bottom: position.bottom, left: position.left, width: position.width }}
                className="mine-model-menu fixed z-[70] max-h-[min(26rem,calc(100dvh-1.25rem))] overflow-y-auto rounded-2xl border border-white/12 bg-[#090e0c]/[0.98] p-2 shadow-[0_28px_80px_-24px_rgba(0,0,0,.95)] backdrop-blur-xl"
              >
                <div className="mb-1 flex items-center justify-between px-2 py-1.5 sm:hidden">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.16em] text-mint">Modelo da Mine</p>
                    <p className="mt-0.5 text-xs font-bold text-white/42">Escolha como ela vai responder</p>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.06] text-white/55"><X className="h-4 w-4" /></button>
                </div>
                {mineModels.map((option) => {
                  const active = option.id === model;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      data-model={option.id}
                      aria-selected={active}
                      onClick={() => selectModel(option.id)}
                      className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-[border-color,background-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/60 ${
                        active ? "border-mint/25 bg-mint/12" : "border-transparent hover:border-white/8 hover:bg-white/[0.07]"
                      }`}
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${active ? "border-mint/35 bg-mint text-black" : "border-white/10 bg-white/[0.05] text-white/55"}`}>
                        <Brain className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[13px] font-black ${active ? "text-mint" : "text-white/85"}`}>{option.name}</span>
                        <span className="block text-[12px] font-bold leading-snug text-white/45">{option.tagline}</span>
                      </span>
                      {active ? <Check className="h-4 w-4 shrink-0 text-mint" /> : <ChevronRight className="h-4 w-4 shrink-0 text-white/20" />}
                    </button>
                  );
                })}
              </motion.div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

/** Fontes da web citadas na resposta, clicáveis. */
function MineSources({ sources }: { sources?: MineSource[] }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.18em] text-white/32">
        <Globe className="h-3 w-3" />
        Fontes
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source, index) => (
          <a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noreferrer noopener"
            title={source.title}
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[12px] font-bold text-white/60 transition-colors hover:border-mint/40 hover:text-mint"
          >
            <span className="text-white/32">{index + 1}</span>
            <span className="min-w-0 truncate">{source.title}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function copyTextFallback(text: string) {
  const holder = document.createElement("textarea");
  holder.value = text;
  holder.style.position = "fixed";
  holder.style.opacity = "0";
  document.body.appendChild(holder);
  holder.select();
  try {
    document.execCommand("copy");
  } finally {
    holder.remove();
  }
}

function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        const done = () => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        };
        navigator.clipboard
          .writeText(text)
          .then(done)
          .catch(() => {
            try {
              copyTextFallback(text);
              done();
            } catch {}
          });
      }}
      aria-label="Copiar resposta"
      title="Copiar resposta"
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-black transition ${copied ? "text-mint" : "text-white/40 hover:bg-white/10 hover:text-white"}`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

function renderInline(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-bold text-white">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

function ChatAttachments({ attachments, tone = "dark" }: { attachments?: ChatAttachment[]; tone?: "dark" | "light" | "user" }) {
  const visible = (attachments || []).filter((attachment) => attachment && (attachment.dataUrl || attachment.text));
  if (!visible.length) return null;
  const chipClass =
    tone === "light"
      ? "border-[#d8f3df] bg-[#fbfffc] text-[#174336]"
      : tone === "user"
        ? "border-black/10 bg-black/10 text-black"
        : "border-white/10 bg-white/[0.06] text-white/82";
  const metaClass = tone === "user" ? "text-black/58" : tone === "light" ? "text-[#719281]" : "text-white/48";

  return (
    <div className="mt-3 grid gap-2">
      {visible.map((attachment) => {
        const inner =
          attachment.kind === "image" && attachment.dataUrl ? (
            <>
              <img src={attachment.dataUrl} alt={attachment.name} className="max-h-56 w-full object-cover" />
              <div className="px-3 py-2">
                <p className="truncate text-sm font-black">{attachment.name}</p>
                <p className={`text-xs font-bold ${metaClass}`}>{formatFileSize(attachment.size)}</p>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-mint/20">
                <Paperclip className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{attachment.name}</p>
                <p className={`text-xs font-bold ${metaClass}`}>
                  {formatFileSize(attachment.size)}
                  {attachment.text ? " · texto lido pela Mine" : ""}
                </p>
              </div>
            </div>
          );
        return attachment.dataUrl ? (
          <a
            key={attachment.id}
            href={attachment.dataUrl}
            download={attachment.name}
            target="_blank"
            rel="noreferrer"
            className={`overflow-hidden rounded-xl border ${chipClass}`}
          >
            {inner}
          </a>
        ) : (
          <div key={attachment.id} className={`overflow-hidden rounded-xl border ${chipClass}`}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

function MineMessageText({ text }: { text: string }) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return null;

  return (
    <div className="space-y-3">
      {lines.map((line, index) => {
        const heading = line.match(/^#{1,3}\s+(.+)$/);
        if (heading) {
          return <h3 key={`${line}-${index}`} className="font-display text-xl font-black text-white">{renderInline(heading[1].replace(/\*\*/g, ""))}</h3>;
        }

        const numbered = line.match(/^(\d+)[\.)]\s+(.+)$/);
        if (numbered) {
          return (
            <div key={`${line}-${index}`} className="flex gap-3">
              <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-mint text-xs font-black text-black">{numbered[1]}</span>
              <p className="min-w-0 text-white/82">{renderInline(numbered[2])}</p>
            </div>
          );
        }

        const bullet = line.match(/^[-*•]\s+(.+)$/);
        if (bullet) {
          return (
            <div key={`${line}-${index}`} className="flex gap-3">
              <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />
              <p className="min-w-0 text-white/82">{renderInline(bullet[1])}</p>
            </div>
          );
        }

        const label = line.match(/^([^:]{3,34}):\s*(.+)$/);
        if (label) {
          return (
            <p key={`${line}-${index}`} className="text-white/82">
              <span className="font-black text-white">{label[1].replace(/\*\*/g, "")}:</span> {renderInline(label[2])}
            </p>
          );
        }

        return <p key={`${line}-${index}`} className="text-white/82">{renderInline(line)}</p>;
      })}
    </div>
  );
}

function SearchView({ data, query, setQuery }: { data: ReturnType<typeof useMemoUserData>; query: string; setQuery: (value: string) => void }) {
  const needle = normalizeText(query);
  const subjectName = (id: string) => data.subjects.find((subject) => subject.id === id)?.name || "Sem matéria";
  const subjects = needle ? data.subjects.filter((item) => normalizeText(item.name).includes(needle)) : data.subjects;
  const materials = needle
    ? data.materials.filter((item) => normalizeText(`${item.title} ${item.detail} ${item.content || ""}`).includes(needle))
    : data.materials;
  const tasks = needle ? data.tasks.filter((item) => normalizeText(`${item.title} ${item.note}`).includes(needle)) : [];
  const total = subjects.length + materials.length + tasks.length;
  return (
    <>
      <PageHeader eyebrow="Busca global" title="Buscar tudo" subtitle="Procura em matérias, conteúdos, anotações e tarefas — ignorando acentos." />
      <Reveal>
        <GlassCard>
          <div className="group relative">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35 transition-colors group-focus-within:text-mint" />
            <input
              value={query}
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar matéria, conteúdo, anotação ou tarefa..."
              aria-label="Buscar em tudo"
              className="h-16 w-full rounded-2xl border border-white/12 bg-black/30 pl-14 pr-14 text-lg outline-none transition-control duration-control placeholder:text-white/40 focus:border-mint/60 focus:bg-black/45 focus:shadow-glowSoft"
            />
            <AnimatePresence>
              {query ? (
                <motion.button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Limpar busca"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={spring.snappy}
                  className="absolute right-4 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </motion.button>
              ) : null}
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {needle ? (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 overflow-hidden text-[13px] font-bold text-white/48"
              >
                <span className="tabular text-mint">{total}</span> {total === 1 ? "resultado" : "resultados"} — a busca procura também dentro do texto dos
                conteúdos.
              </motion.p>
            ) : null}
          </AnimatePresence>
        </GlassCard>
      </Reveal>

      {needle && !total ? (
        <div className="mt-5">
          <EmptyState icon={Search} title="Nada encontrado" text={`Nenhum resultado para "${query}". Tente outra palavra ou verifique a grafia.`} />
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Reveal delay={0.05}>
          <GlassCard className="h-full">
            <SectionTitle icon={BookOpen} title={`Matérias (${subjects.length})`} />
            <Stagger className="mt-4 space-y-2.5" gap={0.04}>
              {subjects.map((subject) => (
                <StaggerItem key={subject.id}>
                  <motion.button
                    onClick={() => go("subject", subject.id)}
                    whileHover={{ x: 4 }}
                    transition={spring.snappy}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-left transition-colors hover:border-mint/35 hover:bg-white/[0.07]"
                  >
                    <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: subject.color }} />
                    <span className="min-w-0 flex-1 truncate font-black">{subject.name}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-mint" />
                  </motion.button>
                </StaggerItem>
              ))}
            </Stagger>
            {!subjects.length ? <p className="mt-4 text-sm text-white/45">Nenhuma matéria encontrada.</p> : null}
          </GlassCard>
        </Reveal>

        <div className="grid content-start gap-5">
          <Reveal delay={0.09} direction="left">
            <GlassCard>
              <SectionTitle icon={FileText} title={`Conteúdos (${materials.length})`} />
              <Stagger className="mt-4 space-y-2.5" gap={0.035}>
                {materials.map((material) => (
                  <StaggerItem key={material.id}>
                    <motion.button
                      onClick={() => go("subject", material.subjectId)}
                      whileHover={{ x: 4 }}
                      transition={spring.snappy}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-left transition-colors hover:border-mint/35 hover:bg-white/[0.07]"
                    >
                      <p className="truncate font-black leading-tight">{material.title}</p>
                      <p className="mt-0.5 truncate text-[13px] text-white/45">
                        {subjectName(material.subjectId)}
                        {material.detail ? ` · ${material.detail}` : ""}
                      </p>
                    </motion.button>
                  </StaggerItem>
                ))}
              </Stagger>
              {!materials.length ? <p className="mt-4 text-sm text-white/45">Nenhum conteúdo encontrado.</p> : null}
            </GlassCard>
          </Reveal>

          {needle && tasks.length ? (
            <Reveal delay={0.13} direction="left">
              <GlassCard>
                <SectionTitle icon={CalendarCheck} title={`Tarefas (${tasks.length})`} />
                <Stagger className="mt-4 space-y-2.5" gap={0.035}>
                  {tasks.map((task) => (
                    <StaggerItem key={task.id}>
                      <motion.button
                        onClick={() => go("agenda")}
                        whileHover={{ x: 4 }}
                        transition={spring.snappy}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-left transition-colors hover:border-mint/35 hover:bg-white/[0.07]"
                      >
                        <p className={`truncate font-black leading-tight ${task.done ? "text-white/38 line-through" : ""}`}>{task.title}</p>
                        <p className="mt-0.5 truncate text-[13px] text-white/45">
                          {subjectName(task.subjectId)} · {dateLabel(task.dueAt)}
                        </p>
                      </motion.button>
                    </StaggerItem>
                  ))}
                </Stagger>
              </GlassCard>
            </Reveal>
          ) : null}
        </div>
      </div>
    </>
  );
}

type PlanPace = "leve" | "normal" | "intenso";

const planPaceSteps: Record<PlanPace, string[]> = {
  leve: ["Revisar teoria", "Resolver exercícios"],
  normal: ["Revisar teoria", "Resolver exercícios", "Fazer resumo"],
  intenso: ["Revisar teoria", "Resolver exercícios", "Fazer resumo", "Revisão final"],
};

const planPaceHints: Record<PlanPace, string> = {
  leve: "cerca de 2 tarefas por matéria",
  normal: "cerca de 3 tarefas por matéria",
  intenso: "cerca de 4 tarefas por matéria",
};

function parsePlanText(text: string, subjects: Subject[], maxDays: number): Array<{ subjectId: string; title: string; note: string; day: number }> {
  type PlanRow = { subjectId: string; title: string; note: string; day: number };
  const rows: PlanRow[] = [];
  let previous: PlanRow | null = null;
  // quando o modelo escreve "### DIA 2" como cabeçalho, as linhas seguintes
  // vêm sem o prefixo e herdam esse dia
  let headingDay = 0;

  const findSubject = (value: string) => {
    const name = normalizeText(value);
    return (
      subjects.find((item) => normalizeText(item.name) === name) ||
      subjects.find((item) => normalizeText(item.name).includes(name) || name.includes(normalizeText(item.name)))
    );
  };

  const build = (day: number, rawSubject: string, rawTitle: string, rawNote: string): PlanRow | null => {
    const subject = findSubject(rawSubject);
    const title = rawTitle.trim().slice(0, 120);
    if (!subject || !title) return null;
    const row: PlanRow = {
      subjectId: subject.id,
      title,
      note: rawNote.trim().slice(0, 160),
      day: Math.min(Math.max(day || 1, 1), maxDays),
    };
    rows.push(row);
    return row;
  };

  for (const raw of text.split(/\r?\n/)) {
    // o negrito precisa cair antes do marcador de lista, senão "**DIA" vira "*DIA"
    const line = raw.trim().replace(/\*\*/g, "").replace(/^[-*•]\s*/, "").replace(/^#+\s*/, "").trim();

    const full = line.match(/^DIA\s*(\d+)\s*\|([^|]+)\|([^|]+)(?:\|(.+))?$/i);
    if (full) {
      previous = build(Number(full[1]), full[2], full[3], full[4] || "");
      continue;
    }

    const heading = line.match(/^DIA\s*(\d+)\s*[:\-–]?\s*$/i);
    if (heading) {
      headingDay = Number(heading[1]);
      previous = null;
      continue;
    }

    const bare = headingDay ? line.match(/^([^|]+)\|([^|]+)(?:\|(.+))?$/) : null;
    if (bare) {
      previous = build(headingDay, bare[1], bare[2], bare[3] || "");
      continue;
    }

    // vários modelos quebram o último campo para a linha de baixo em vez de
    // usar o pipe — aproveita essa linha como detalhe em vez de perdê-la
    if (previous && !previous.note && line.length > 8 && !/^[-–—]{3,}$/.test(line)) {
      previous.note = line.slice(0, 160);
    }
    previous = null;
  }
  return rows.slice(0, 80);
}

function PlanGenerationAnimation({ subjects, days, pace }: { subjects: Subject[]; days: number; pace: PlanPace }) {
  const previewSubjects = subjects.slice(0, 4);
  const paceLabel = pace === "leve" ? "ritmo leve" : pace === "intenso" ? "ritmo intenso" : "ritmo equilibrado";

  return (
    <motion.div
      key="mine-plan-builder"
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.99 }}
      transition={{ duration: 0.38, ease: ease.out }}
      className="mine-plan-builder mt-5 overflow-hidden rounded-[1.05rem] border border-mint/20 bg-mint/[0.045] p-5 sm:p-6"
    >
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="mine-plan-core" aria-hidden>
          <span className="mine-plan-orbit mine-plan-orbit-one" />
          <span className="mine-plan-orbit mine-plan-orbit-two" />
          <Brain className="relative z-10 h-6 w-6 text-mint" />
        </div>
        <p className="mt-4 font-display text-xl font-black tracking-[-.025em] text-white">A Mine está desenhando seu caminho</p>
        <p className="mt-1 max-w-md text-[13px] font-bold leading-5 text-white/48">
          Conectando {subjects.length} {subjects.length === 1 ? "matéria" : "matérias"} em {days} dias, com {paceLabel}.
        </p>
      </div>

      <div className="relative z-10 mt-6 grid gap-4 sm:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] sm:items-center">
        <div className="flex flex-wrap justify-center gap-2 sm:flex-col sm:items-stretch">
          {previewSubjects.map((subject, index) => (
            <div
              key={subject.id}
              className="mine-plan-subject inline-flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left"
              style={{ "--plan-delay": `${index * 180}ms` } as React.CSSProperties}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} />
              <span className="truncate text-xs font-black text-white/70">{subject.name}</span>
            </div>
          ))}
          {subjects.length > previewSubjects.length ? (
            <span className="self-center text-[11px] font-black uppercase tracking-[.12em] text-white/32 sm:self-start">
              +{subjects.length - previewSubjects.length} matérias
            </span>
          ) : null}
        </div>

        <div className="mine-plan-timeline rounded-2xl border border-white/[0.08] bg-black/20 p-4" aria-hidden>
          {[0, 1, 2].map((index) => (
            <div key={index} className="mine-plan-row" style={{ "--plan-delay": `${index * 320}ms` } as React.CSSProperties}>
              <span className="mine-plan-day">{index + 1}</span>
              <span className="mine-plan-bar mine-plan-bar-main" />
              <span className="mine-plan-bar mine-plan-bar-short" />
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 mt-5 grid grid-cols-3 gap-2 border-t border-white/[0.08] pt-4">
        {["Analisando", "Distribuindo", "Ajustando"].map((label, index) => (
          <div key={label} className="mine-plan-step" style={{ "--plan-delay": `${index * 700}ms` } as React.CSSProperties}>
            <span className="mine-plan-step-dot" />
            <span className="truncate text-[10px] font-black uppercase tracking-[.1em] text-white/38 sm:text-[11px]">{label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function PlanView({ data, update, user, notify }: { data: ReturnType<typeof useMemoUserData>; update: (next: (draft: AppData) => AppData) => void; user: User; notify: (message: string) => void }) {
  const [selected, setSelected] = useState<string[]>(() => data.subjects.map((item) => item.id));
  const [days, setDays] = useState(14);
  const [pace, setPace] = useState<PlanPace>("normal");
  const [draft, setDraft] = useState<Task[]>([]);
  const [fromMine, setFromMine] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  // Montagem manual do cronograma, sem passar pela IA (sugestão do brenasso).
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualSubject, setManualSubject] = useState("");
  const [manualDay, setManualDay] = useState(1);

  const chosen = data.subjects.filter((item) => selected.includes(item.id));
  const allSelected = selected.length === data.subjects.length && data.subjects.length > 0;

  function toDraft(rows: Array<{ subjectId: string; title: string; note: string; day: number }>): Task[] {
    return rows
      .map((row) => ({
        id: uid("draft"),
        userId: user.id,
        subjectId: row.subjectId,
        title: row.title,
        note: row.note,
        dueAt: addDays(row.day),
        done: false,
        createdAt: Date.now(),
      }))
      .sort((a, b) => a.dueAt - b.dueAt);
  }

  function materialFor(subjectId: string, step: number) {
    const materials = data.materials.filter((item) => item.subjectId === subjectId);
    const pool = materials.filter((item) => !item.studied).length ? materials.filter((item) => !item.studied) : materials;
    return pool.length ? pool[step % pool.length] : undefined;
  }

  function generateQuick() {
    if (!chosen.length) return;
    setError("");
    const steps = planPaceSteps[pace];
    const total = chosen.length * steps.length;
    const rows: Array<{ subjectId: string; title: string; note: string; day: number }> = [];
    let slot = 0;
    steps.forEach((step, stepIndex) => {
      chosen.forEach((subject) => {
        const day = Math.min(days, 1 + Math.floor((slot * (days - 1)) / Math.max(total - 1, 1)));
        slot += 1;
        rows.push({
          subjectId: subject.id,
          title: `${step}: ${subject.name}`,
          note: materialFor(subject.id, stepIndex)?.title || "",
          day,
        });
      });
    });
    setDraft(toDraft(rows));
    setFromMine(false);
  }

  function generateWithMine() {
    if (generating || !chosen.length) return;
    setGenerating(true);
    setError("");
    const contextLines = chosen.map((subject) => {
      const materials = data.materials.filter((item) => item.subjectId === subject.id);
      const pending = materials.filter((item) => !item.studied).map((item) => item.title);
      const studied = materials.filter((item) => item.studied).map((item) => item.title);
      return `- ${subject.name}: para estudar: ${pending.slice(0, 8).join("; ") || "nenhum conteudo cadastrado"}${studied.length ? ` | ja estudados: ${studied.slice(0, 5).join("; ")}` : ""}`;
    });
    const context = [
      `Total de dias ate a prova: ${days} (o dia ${days} e a vespera da prova).`,
      `Ritmo desejado: ${pace} (${planPaceHints[pace]}).`,
      "Materias e conteudos:",
      ...contextLines,
    ].join("\n");
    requestAiTask({ task: "plan", prompt: `Monte um plano de estudos de ${days} dias para: ${chosen.map((item) => item.name).join(", ")}.`, context })
      .then((text) => {
        const rows = parsePlanText(text, chosen, days);
        if (!rows.length) {
          setError("A Mine não conseguiu montar o plano agora. Tente de novo ou use o plano rápido.");
          return;
        }
        setDraft(toDraft(rows));
        setFromMine(true);
      })
      .catch(() => setError("A Mine não conseguiu montar o plano agora. Tente de novo ou use o plano rápido."))
      .finally(() => setGenerating(false));
  }

  /** Adiciona uma tarefa escrita à mão ao rascunho, sem chamar a Mine. */
  function addManual() {
    const title = manualTitle.trim();
    const subjectId = manualSubject || chosen[0]?.id || data.subjects[0]?.id;
    if (!title || !subjectId) return;
    setDraft((current) =>
      [
        ...current,
        {
          id: uid("draft"),
          userId: user.id,
          subjectId,
          title,
          note: "",
          dueAt: addDays(Math.min(Math.max(manualDay, 1), days)),
          done: false,
          createdAt: Date.now(),
        },
      ].sort((a, b) => a.dueAt - b.dueAt),
    );
    setManualTitle("");
    setFromMine(false);
  }

  const grouped: Array<[number, Task[]]> = [];
  for (const task of draft) {
    const group = grouped.find(([dueAt]) => dueAt === task.dueAt);
    if (group) group[1].push(task);
    else grouped.push([task.dueAt, [task]]);
  }
  grouped.sort((a, b) => a[0] - b[0]);
  const weekdayFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
  const dayNumber = (dueAt: number) => Math.max(1, Math.round((dueAt - today()) / 86400000));

  return (
    <>
      <PageHeader
        eyebrow="Plano de estudos"
        title="Cronograma até a prova"
        subtitle="Escolha as matérias e o ritmo — a Mine distribui as revisões pelos dias que faltam."
      />
      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <Reveal>
        <GlassCard className="self-start">
          <SectionTitle icon={CalendarPlus} title="Configurar" />
          {data.subjects.length ? (
            <div className="mt-5 space-y-5">
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-white/62">Matérias</p>
                  <button
                    type="button"
                    onClick={() => setSelected(allSelected ? [] : data.subjects.map((item) => item.id))}
                    className="text-xs font-black uppercase tracking-[.14em] text-mint transition hover:text-white"
                  >
                    {allSelected ? "Limpar" : "Todas"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.subjects.map((subject) => {
                    const active = selected.includes(subject.id);
                    return (
                      <button
                        key={subject.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelected((current) => (current.includes(subject.id) ? current.filter((id) => id !== subject.id) : [...current, subject.id]))}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-black transition-control duration-control ${
                          active ? "text-black shadow-glowSoft" : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white"
                        }`}
                        style={active ? { backgroundColor: subject.color } : undefined}
                      >
                        <motion.span
                          className="grid h-4 w-4 place-items-center rounded-full"
                          animate={{ backgroundColor: active ? "rgba(0,0,0,.5)" : subject.color }}
                          transition={spring.snappy}
                        >
                          {active ? <Check className="h-3 w-3 text-white" /> : null}
                        </motion.span>
                        {subject.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/*
                O teto era 60 dias, o que não cobre quem se prepara para ENEM ou
                vestibular com meses de antecedência (sugestão do brenasso).
                Agora vai até 365, e o número também pode ser digitado — arrastar
                um range de 365 posições até o dia exato é impraticável.
              */}
              <label className="block">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-black text-white/62">
                  Dias até a prova:
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={days}
                    onChange={(event) => setDays(Math.min(Math.max(Math.round(Number(event.target.value)) || 1, 1), 365))}
                    aria-label="Dias até a prova"
                    className="w-20 rounded-lg border border-white/12 bg-black/40 px-2 py-1 text-[13px] tabular text-mint outline-none transition focus:border-mint/60"
                  />
                  <span className="text-white/45">· prova em {shortDate(addDays(days))}</span>
                </span>
                <input
                  value={days}
                  min={1}
                  max={365}
                  onChange={(event) => setDays(Number(event.target.value))}
                  type="range"
                  aria-label="Ajustar dias até a prova"
                  className="mt-3 w-full accent-mint"
                />
              </label>
              <div>
                <p className="mb-2 text-sm font-black text-white/62">Ritmo</p>
                <div className="flex flex-wrap gap-2">
                  {(["leve", "normal", "intenso"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={pace === value}
                      onClick={() => setPace(value)}
                      className={`relative rounded-full px-4 py-2 text-[13px] font-black capitalize transition-colors duration-control ${
                        pace === value ? "text-black" : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white"
                      }`}
                    >
                      {pace === value ? (
                        <motion.span layoutId="plan-pace" className="absolute inset-0 rounded-full bg-mint shadow-glowSoft" transition={spring.snappy} />
                      ) : null}
                      <span className="relative">{value}</span>
                    </button>
                  ))}
                </div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={pace}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="mt-2 text-[11px] font-bold text-white/40"
                  >
                    {planPaceHints[pace]}
                  </motion.p>
                </AnimatePresence>
              </div>
              {error ? (
                <motion.p
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-roseGlow/25 bg-roseGlow/10 p-3 text-[13px] font-bold text-roseGlow"
                >
                  {error}
                </motion.p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <motion.button
                  type="button"
                  onClick={generateWithMine}
                  disabled={generating || !chosen.length}
                  whileTap={{ scale: 0.98 }}
                  transition={spring.snappy}
                  className="sheen group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-mint to-mintDeep px-5 py-3 font-black text-black shadow-glow transition-shadow duration-control hover:shadow-[0_0_58px_rgba(52,211,153,.45)] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
                >
                  {generating ? (
                    <Loader2 className="relative h-5 w-5 animate-spin" />
                  ) : (
                    <Sparkles className="relative h-5 w-5 transition-transform duration-control group-hover:rotate-12 group-hover:scale-110" />
                  )}
                  <span className="relative">{generating ? "A Mine está montando..." : "Gerar com a Mine"}</span>
                </motion.button>
                <motion.button
                  type="button"
                  onClick={generateQuick}
                  disabled={!chosen.length}
                  whileTap={{ scale: 0.98 }}
                  transition={spring.snappy}
                  className="group inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.06] px-5 py-3 font-black text-white/80 transition-control duration-control hover:border-mint/40 hover:bg-mint/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Zap className="h-5 w-5 transition-transform duration-control group-hover:scale-110" />
                  Plano rápido
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => setManualOpen((value) => !value)}
                  aria-expanded={manualOpen}
                  whileTap={{ scale: 0.98 }}
                  transition={spring.snappy}
                  className="group inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.06] px-5 py-3 font-black text-white/80 transition-control duration-control hover:border-mint/40 hover:bg-mint/10 hover:text-white"
                >
                  <Plus className={`h-5 w-5 transition-transform duration-control ${manualOpen ? "rotate-45" : "group-hover:scale-110"}`} />
                  Escrever eu mesmo
                </motion.button>
              </div>
              {manualOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-white/12 bg-white/[0.04] p-4"
                >
                  <p className="mb-3 text-sm font-black text-white/62">Adicionar tarefa ao cronograma</p>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <input
                      value={manualTitle}
                      onChange={(event) => setManualTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addManual();
                        }
                      }}
                      placeholder="Ex: Revisar termodinâmica"
                      aria-label="Título da tarefa"
                      className="h-12 w-full rounded-xl border border-white/12 bg-white/[0.06] px-4 text-white outline-none transition placeholder:text-white/35 focus:border-mint/60"
                    />
                    <div className="flex gap-2">
                      <select
                        value={manualSubject || chosen[0]?.id || ""}
                        onChange={(event) => setManualSubject(event.target.value)}
                        aria-label="Matéria da tarefa"
                        className="h-12 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-[13px] font-bold text-white outline-none transition focus:border-mint/60"
                      >
                        {(chosen.length ? chosen : data.subjects).map((subject) => (
                          <option key={subject.id} value={subject.id} className="bg-[#0d0d11]">
                            {subject.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={days}
                        value={manualDay}
                        onChange={(event) => setManualDay(Math.min(Math.max(Math.round(Number(event.target.value)) || 1, 1), days))}
                        aria-label="Dia da tarefa"
                        title="Dia"
                        className="h-12 w-20 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-[13px] tabular text-white outline-none transition focus:border-mint/60"
                      />
                      <motion.button
                        type="button"
                        onClick={addManual}
                        disabled={!manualTitle.trim()}
                        whileTap={{ scale: 0.94 }}
                        transition={spring.snappy}
                        aria-label="Adicionar tarefa"
                        className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-mint to-mintDeep text-black shadow-glowSoft transition disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                      >
                        <Plus className="h-5 w-5" />
                      </motion.button>
                    </div>
                  </div>
                  <p className="mt-2 text-[12px] font-bold text-white/35">Dia 1 é amanhã. As tarefas entram direto no cronograma ao lado.</p>
                </motion.div>
              ) : null}
              {!chosen.length && <p className="text-[13px] font-bold text-white/45">Escolha ao menos uma matéria para gerar o plano.</p>}
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState icon={BookOpen} title="Nenhuma matéria ainda" text="Crie suas matérias na tela inicial para montar um cronograma." />
            </div>
          )}
        </GlassCard>
        </Reveal>
        <Reveal delay={0.08} direction="left">
        <GlassCard>
          <SectionTitle
            icon={CalendarCheck}
            title="Seu cronograma"
            action={
              draft.length ? (
                <PrimaryButton
                  icon={CalendarCheck}
                  onClick={() => {
                    update((data) => ({ ...data, tasks: [...data.tasks, ...draft.map((task) => ({ ...task, id: uid("task") }))] }));
                    setDraft([]);
                    notify("Plano adicionado à agenda.");
                    go("agenda");
                  }}
                >
                  Salvar na agenda
                </PrimaryButton>
              ) : null
            }
          />
          <AnimatePresence initial={false} mode="wait">
            {generating ? <PlanGenerationAnimation subjects={chosen} days={days} pace={pace} /> : null}
          </AnimatePresence>
          {!generating && draft.length ? (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-white/50">
              <span>{draft.length} tarefas</span>
              <span>{new Set(draft.map((task) => task.subjectId)).size} matérias</span>
              <span>até {shortDate(draft[draft.length - 1].dueAt)}</span>
              {fromMine && (
                <span className="inline-flex items-center gap-1.5 text-mint">
                  <Sparkles className="h-3.5 w-3.5" />
                  feito pela Mine
                </span>
              )}
              <button
                type="button"
                onClick={() => setDraft([])}
                className="ml-auto font-black text-white/45 underline-offset-4 transition hover:text-red-200 hover:underline"
              >
                Descartar
              </button>
            </div>
          ) : null}
          <div className="mt-4 space-y-5">
            {!generating && grouped.map(([dueAt, tasks], groupIndex) => (
              <motion.div
                key={dueAt}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(groupIndex * 0.05, 0.5), duration: 0.45, ease: ease.out }}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="rounded-full bg-mint/12 px-3 py-1 text-[11px] font-black uppercase tracking-[.14em] text-mint">Dia {dayNumber(dueAt)}</span>
                  <span className="text-[13px] font-bold text-white/45">
                    {weekdayFormat.format(new Date(dueAt))} · {shortDate(dueAt)} · {dateLabel(dueAt)}
                  </span>
                </div>
                {/* linha do tempo à esquerda: o cronograma lê como uma trilha */}
                <div className="relative ml-3 mt-2 space-y-2 border-l border-white/10 pl-4">
                  <span aria-hidden className="absolute -left-[5px] top-3 h-2.5 w-2.5 rounded-full bg-mint shadow-glowSoft" />
                  {tasks.map((task) => {
                    const subject = data.subjects.find((item) => item.id === task.subjectId);
                    return (
                      <motion.div
                        key={task.id}
                        layout
                        exit={{ opacity: 0, x: -20 }}
                        className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 transition-colors hover:border-white/20 hover:bg-white/[0.07]"
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: subject?.color || "#34D399" }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-black leading-tight">{task.title}</p>
                          <p className="truncate text-[13px] text-white/45">
                            {subject?.name || "Matéria"}
                            {task.note ? ` · ${task.note}` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDraft((current) => current.filter((item) => item.id !== task.id))}
                          aria-label={`Remover ${task.title}`}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white/30 opacity-0 transition-control duration-control hover:bg-roseGlow/12 hover:text-roseGlow focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
            {!generating && !draft.length ? (
              <EmptyState
                icon={CalendarPlus}
                title="Sem cronograma ainda"
                text="Escolha as matérias, ajuste os dias e peça para a Mine montar seu plano até a prova."
              />
            ) : null}
          </div>
        </GlassCard>
        </Reveal>
      </div>
    </>
  );
}

function Stars({ value, size = "h-4 w-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} className={`${size} ${star <= value ? "fill-amber-300 text-amber-300" : "text-white/20"}`} />
      ))}
    </span>
  );
}

function CommentsView({
  data,
  user,
  update,
  notify,
  setModal,
}: {
  data: ReturnType<typeof useMemoUserData>;
  user: User;
  update: (next: (draft: AppData) => AppData) => void;
  notify: (message: string) => void;
  setModal: (modal: Modal) => void;
}) {
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const comments = [...data.comments].sort((a, b) => b.createdAt - a.createdAt);
  const average = comments.length ? comments.reduce((sum, item) => sum + item.rating, 0) / comments.length : 0;
  const distribution = [5, 4, 3, 2, 1].map((star) => ({ star, count: comments.filter((item) => item.rating === star).length }));

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    update((draft) => ({
      ...draft,
      comments: [
        ...draft.comments,
        {
          id: uid("comment"),
          userId: user.id,
          name: user.settings.displayName || user.name,
          text: trimmed.slice(0, 500),
          rating,
          createdAt: Date.now(),
        },
      ],
    }));
    setText("");
    setRating(5);
    notify("Comentário enviado. Obrigado!");
  }

  return (
    <>
      <PageHeader eyebrow="Comentários" title="O que estão achando" subtitle="A avaliação da comunidade sobre a Minerva — e o espaço para você deixar a sua." />
      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <Reveal>
        <GlassCard className="self-start">
          <SectionTitle icon={MessageCircle} title="Deixe seu comentário" />
          <p className="mt-3 text-sm leading-relaxed text-white/52">Conte o que você achou da Minerva: o que gostou, o que usa mais e o que podemos melhorar.</p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <p className="mb-2 text-[13px] font-black text-white/60">Sua nota</p>
              <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <motion.button
                    key={star}
                    type="button"
                    aria-label={`Avaliar com ${star} ${star === 1 ? "estrela" : "estrelas"}`}
                    aria-pressed={rating === star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHover(star)}
                    whileHover={{ scale: 1.18, rotate: -8 }}
                    whileTap={{ scale: 0.9 }}
                    transition={spring.snappy}
                    className="rounded-lg p-1"
                  >
                    <Star
                      className={`h-7 w-7 transition-colors duration-200 ${
                        star <= (hover || rating) ? "fill-amberGlow text-amberGlow drop-shadow-[0_0_8px_rgba(251,191,36,.5)]" : "text-white/20"
                      }`}
                    />
                  </motion.button>
                ))}
                <span className="ml-2 text-[13px] font-black tabular text-white/50">{hover || rating}/5</span>
              </div>
            </div>
            <label className="block">
              <span className="text-[13px] font-black text-white/60">Comentário</span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value.slice(0, 500))}
                rows={4}
                placeholder="Ex: A Mine me ajudou muito a estudar para a prova de..."
                className="mt-2 w-full resize-none rounded-2xl border border-white/12 bg-black/30 p-4 outline-none transition-control duration-control placeholder:text-white/38 focus:border-mint/60 focus:bg-black/45 focus:shadow-glowSoft"
              />
              <span className={`mt-1 block text-right text-[11px] font-bold tabular ${text.length > 450 ? "text-amberGlow" : "text-white/35"}`}>{text.length}/500</span>
            </label>
            <PrimaryButton icon={MessageCircle}>Enviar comentário</PrimaryButton>
          </form>
        </GlassCard>
        </Reveal>
        <Reveal delay={0.08} direction="left">
        <GlassCard>
          <SectionTitle icon={Star} title={`Comentários (${comments.length})`} />
          {comments.length ? (
            <div className="mt-4 flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center">
              <div className="flex shrink-0 flex-col items-center gap-1 sm:w-28">
                <p className="font-display text-[2.6rem] font-black leading-none tabular text-amberGlow">
                  <CountUp value={average} decimals={1} />
                </p>
                <Stars value={Math.round(average)} />
                <p className="text-[11px] font-bold text-white/42">
                  {comments.length} {comments.length === 1 ? "avaliação" : "avaliações"}
                </p>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                {distribution.map(({ star, count }, index) => (
                  <div key={star} className="flex items-center gap-2 text-[11px] font-bold text-white/45">
                    <span className="w-3 shrink-0 text-right tabular">{star}</span>
                    <Star className="h-3 w-3 shrink-0 fill-amberGlow text-amberGlow" />
                    <AnimatedBar
                      value={comments.length ? (count / comments.length) * 100 : 0}
                      className="min-w-0 flex-1"
                      height={7}
                      from="#FBBF24"
                      to="#FB7185"
                      delay={index * 0.06}
                    />
                    <span className="w-6 shrink-0 text-right tabular">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <Stagger className="mt-4 space-y-3" gap={0.05}>
            {comments.map((comment) => (
              <StaggerItem key={comment.id}>
              <article className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.06]">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint/15 font-display font-black text-mint ring-1 ring-inset ring-mint/20">
                    {comment.name.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black leading-tight">
                      {comment.name}
                      {comment.userId === user.id ? (
                        <span className="ml-2 rounded-full bg-mint/12 px-2 py-0.5 text-[10px] font-black uppercase text-mint">você</span>
                      ) : null}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] font-bold text-white/38">
                      <Stars value={comment.rating} size="h-3 w-3" />
                      <span>{shortDate(comment.createdAt)}</span>
                    </div>
                  </div>
                  {comment.userId === user.id ? (
                    <button
                      type="button"
                      onClick={() =>
                        setModal({
                          type: "confirm",
                          title: "Excluir seu comentário?",
                          body: "Ele será removido para todos os visitantes do site.",
                          onConfirm: () => {
                            update((draft) => ({ ...draft, comments: draft.comments.filter((item) => item.id !== comment.id) }));
                            notify("Comentário excluído.");
                          },
                        })
                      }
                      aria-label="Excluir seu comentário"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white/25 opacity-0 transition-control duration-control hover:bg-roseGlow/12 hover:text-roseGlow focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <p className="mt-3 whitespace-pre-line leading-7 text-white/75">{comment.text}</p>
              </article>
              </StaggerItem>
            ))}
          </Stagger>
          {!comments.length ? (
            <EmptyState icon={MessageCircle} title="Nenhum comentário ainda" text="Seja a primeira pessoa a contar o que achou da Minerva." />
          ) : null}
        </GlassCard>
        </Reveal>
      </div>
    </>
  );
}

const updateNotes = [
  {
    date: "03/07/2026",
    tag: "Mapa mental",
    title: "Mapa mental em HTML mais visual",
    icon: Brain,
    items: ["Ramos balanceados dos dois lados", "Download em PNG e HTML", "Instrução da Mine mais organizada"],
  },
  {
    date: "03/07/2026",
    tag: "Comunidade",
    title: "Aba de atualizações e sugestões",
    icon: Bell,
    items: ["Histórico de melhorias do site", "Formulário para ideias dos clientes", "Sugestões salvas na conta do usuário"],
  },
  {
    date: "01/07/2026",
    tag: "Estudo",
    title: "Flashcards, simulados e plano de estudos",
    icon: Layers,
    items: ["Revisão espaçada por matéria", "Modo prova gerado pela Mine", "Cronograma automático até a prova"],
  },
] as const;

const updateCategoryMeta: Record<UpdateCategory, { label: string; icon: LucideIcon }> = {
  novidade: { label: "Novidade", icon: Sparkles },
  melhoria: { label: "Melhoria", icon: Wand2 },
  correcao: { label: "Correção", icon: CheckCircle2 },
};

function fullDate(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(timestamp));
}

type UpdateEntry = { key: string; date: string; tag: string; icon: LucideIcon; title: string; body: string | null; items: readonly string[] | null };

function mergedUpdateEntries(updates: SiteUpdate[]): UpdateEntry[] {
  const adminEntries: UpdateEntry[] = [...updates]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((item) => ({
      key: item.id,
      date: fullDate(item.createdAt),
      tag: updateCategoryMeta[item.category]?.label || "Novidade",
      icon: updateCategoryMeta[item.category]?.icon || Sparkles,
      title: item.title,
      body: item.body,
      items: null,
    }));
  const staticEntries: UpdateEntry[] = updateNotes.map((note) => ({
    key: `${note.date}-${note.title}`,
    date: note.date,
    tag: note.tag,
    icon: note.icon,
    title: note.title,
    body: null,
    items: note.items,
  }));
  return [...adminEntries, ...staticEntries];
}

const suggestionCategories: Array<{ id: SiteSuggestion["category"]; label: string; icon: LucideIcon }> = [
  { id: "ideia", label: "Ideia", icon: Sparkles },
  { id: "melhoria", label: "Melhoria", icon: Wand2 },
  { id: "erro", label: "Erro", icon: XCircle },
  { id: "conteudo", label: "Conteúdo", icon: BookOpen },
];

function suggestionStatusLabel(status: SiteSuggestion["status"]) {
  if (status === "planejada") return "Planejada";
  if (status === "analisando") return "Em análise";
  if (status === "concluida") return "Concluída";
  if (status === "recusada") return "Não entrou";
  return "Recebida";
}

const suggestionStatusOrder: SiteSuggestion["status"][] = ["nova", "analisando", "planejada", "concluida", "recusada"];

// Classe de cor do selo de status, no tema escuro do app.
function suggestionStatusTone(status: SiteSuggestion["status"]) {
  if (status === "planejada") return "bg-cyanGlow/15 text-cyanGlow";
  if (status === "analisando") return "bg-amber-300/15 text-amber-200";
  if (status === "concluida") return "bg-mint/15 text-mint";
  if (status === "recusada") return "bg-white/10 text-white/45";
  return "bg-white/10 text-white/60";
}

function UpdatesView({
  data,
}: {
  data: ReturnType<typeof useMemoUserData>;
  user: User;
  update: (next: (draft: AppData) => AppData) => void;
  notify: (message: string) => void;
}) {
  const entries = mergedUpdateEntries(data.updates);
  const latest = entries[0];

  return (
    <>
      <PageHeader eyebrow="Atualizações" title="Novidades da Minerva" subtitle="Tudo que mudou no site, da mais recente para a mais antiga." />
      <div className="mx-auto grid max-w-3xl gap-5">
        <Reveal>
          <HeroCard>
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <Pill icon={latest.icon}>{latest.tag}</Pill>
                <h2 className="mt-5 font-display text-[1.75rem] font-black leading-tight md:text-4xl">{latest.title}</h2>
                <p className="mt-3 max-w-2xl text-white/55">Acompanhe o que mudou no site. Tem uma ideia? Use a aba Sugestões.</p>
              </div>
              <div className="shrink-0">
                <Metric icon={Bell} value={entries.length} label="atualizações" />
              </div>
            </div>
          </HeroCard>
        </Reveal>

        <Reveal delay={0.06}>
          <GlassCard>
            <SectionTitle icon={CalendarCheck} title="Histórico de atualizações" />
            {/* trilha vertical: cada item é um marco na linha do tempo */}
            <div className="relative mt-6 space-y-4 pl-6">
              <span aria-hidden className="absolute bottom-4 left-[7px] top-2 w-px bg-gradient-to-b from-mint/50 via-white/10 to-transparent" />
              {entries.map((note, index) => {
                const Icon = note.icon;
                return (
                  <motion.article
                    key={note.key}
                    // Lista: um filtro por item vira um filtro por linha da tela.
                    initial={{ opacity: 0, x: -14 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: dur.section, delay: Math.min(index * 0.05, 0.35), ease: ease.out }}
                    className="group relative rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-colors hover:border-mint/25 hover:bg-white/[0.06]"
                  >
                    <span
                      aria-hidden
                      className="absolute -left-[26px] top-6 grid h-4 w-4 place-items-center rounded-full border-2 border-ink bg-mint transition-transform duration-control group-hover:scale-125"
                    />
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-mint/14 text-mint transition-transform duration-control group-hover:scale-105">
                        <Icon className="h-6 w-6" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-mint/12 px-3 py-1 text-[11px] font-black uppercase tracking-[.12em] text-mint">{note.tag}</span>
                          <span className="text-[11px] font-bold text-white/38">{note.date}</span>
                        </div>
                        <h3 className="mt-3 font-display text-xl font-black leading-tight md:text-2xl">{note.title}</h3>
                        {note.items ? (
                          <div className="mt-4 grid gap-2 md:grid-cols-3">
                            {note.items.map((item) => (
                              <div key={item} className="rounded-xl border border-white/10 bg-black/25 p-3 text-[13px] font-bold leading-6 text-white/65">
                                {item}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 whitespace-pre-line leading-7 text-white/68">{note.body}</p>
                        )}
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </GlassCard>
        </Reveal>
      </div>
    </>
  );
}

function SuggestionsView({
  data,
  user,
  update,
  notify,
  setModal,
}: {
  data: ReturnType<typeof useMemoUserData>;
  user: User;
  update: (next: (draft: AppData) => AppData) => void;
  notify: (message: string) => void;
  setModal: (modal: Modal) => void;
}) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<SiteSuggestion["category"]>("ideia");
  const suggestions = [...data.suggestions].sort((a, b) => b.createdAt - a.createdAt);
  const mine = suggestions.filter((item) => item.userId === user.id).length;

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    update((draft) => ({
      ...draft,
      suggestions: [
        ...draft.suggestions,
        {
          id: uid("suggestion"),
          userId: user.id,
          name: user.settings.displayName || user.name,
          category,
          text: trimmed.slice(0, 700),
          status: "nova",
          createdAt: Date.now(),
        },
      ],
    }));
    setText("");
    setCategory("ideia");
    notify("Sugestão enviada. Obrigado por ajudar a melhorar a Minerva!");
  }

  return (
    <>
      <PageHeader eyebrow="Sugestões" title="Ajude a melhorar a Minerva" subtitle="Ideias, melhorias e erros percebidos — tudo com status acompanhável." />
      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <Reveal>
        <GlassCard className="self-start">
          <SectionTitle icon={Sparkles} title="Enviar sugestão" />
          <p className="mt-3 text-sm leading-relaxed text-white/52">Conte uma melhoria, um erro percebido ou um recurso que deixaria a Minerva melhor para estudar.</p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <p className="mb-2 text-[13px] font-black text-white/60">Tipo</p>
              <div className="grid grid-cols-2 gap-2">
                {suggestionCategories.map((item) => {
                  const Icon = item.icon;
                  const active = category === item.id;
                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      onClick={() => setCategory(item.id)}
                      aria-pressed={active}
                      whileTap={{ scale: 0.96 }}
                      transition={spring.snappy}
                      className={`relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl border px-3 py-3 text-[13px] font-black transition-colors duration-control ${
                        active ? "border-mint text-black" : "border-white/12 bg-white/[0.05] text-white/65 hover:border-mint/40 hover:text-white"
                      }`}
                    >
                      {active ? (
                        <motion.span layoutId="suggestion-category" className="absolute inset-0 bg-mint" transition={spring.snappy} />
                      ) : null}
                      <Icon className="relative h-4 w-4" />
                      <span className="relative">{item.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
            <label className="block">
              <span className="text-[13px] font-black text-white/60">Sugestão</span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value.slice(0, 700))}
                rows={4}
                placeholder="Ex: Seria bom ter um modo para comparar duas matérias..."
                className="mt-2 w-full resize-none rounded-2xl border border-white/12 bg-black/30 p-4 outline-none transition-control duration-control placeholder:text-white/38 focus:border-mint/60 focus:bg-black/45 focus:shadow-glowSoft"
              />
              <span className={`mt-1 block text-right text-[11px] font-bold tabular ${text.length > 630 ? "text-amberGlow" : "text-white/35"}`}>{text.length}/700</span>
            </label>
            <PrimaryButton icon={Sparkles}>Enviar sugestão</PrimaryButton>
          </form>
        </GlassCard>
        </Reveal>
        <Reveal delay={0.08} direction="left">
        <GlassCard>
          <SectionTitle
            icon={ListChecks}
            title={`Sugestões (${suggestions.length})`}
            hint={suggestions.length ? `${mine} ${mine === 1 ? "enviada por você" : "enviadas por você"}` : undefined}
          />
          <Stagger className="mt-4 space-y-3" gap={0.045}>
            {suggestions.map((suggestion) => {
              const categoryInfo = suggestionCategories.find((item) => item.id === suggestion.category) || suggestionCategories[0];
              return (
                <StaggerItem key={suggestion.id}>
                <article className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint/15 font-display font-black text-mint ring-1 ring-inset ring-mint/20">
                      {suggestion.name.trim().charAt(0).toUpperCase() || "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black">
                        {suggestion.name}
                        {suggestion.userId === user.id ? <span className="ml-2 rounded-full bg-mint/12 px-2 py-0.5 text-[10px] font-black uppercase text-mint">você</span> : null}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-white/40">
                        <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-black uppercase text-white/55">{categoryInfo.label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${suggestionStatusTone(suggestion.status)}`}>{suggestionStatusLabel(suggestion.status)}</span>
                        <span>{shortDate(suggestion.createdAt)}</span>
                      </div>
                    </div>
                    {suggestion.userId === user.id ? (
                      <button
                        type="button"
                        onClick={() =>
                          setModal({
                            type: "confirm",
                            title: "Excluir sua sugestão?",
                            body: "Ela será removida do site para todos.",
                            onConfirm: () => {
                              update((draft) => ({ ...draft, suggestions: draft.suggestions.filter((item) => item.id !== suggestion.id) }));
                              notify("Sugestão excluída.");
                            },
                          })
                        }
                        aria-label="Excluir sua sugestão"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white/25 opacity-0 transition-control duration-control hover:bg-roseGlow/12 hover:text-roseGlow focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-3 whitespace-pre-line leading-7 text-white/75">{suggestion.text}</p>
                </article>
                </StaggerItem>
              );
            })}
          </Stagger>
          {!suggestions.length ? (
            <EmptyState icon={Sparkles} title="Nenhuma sugestão ainda" text="Seja a primeira pessoa a sugerir uma melhoria para a Minerva." />
          ) : null}
        </GlassCard>
        </Reveal>
      </div>
    </>
  );
}
const teamMembers = ["Samuel", "Gabriel Batochi", "Gabriel dos Santos", "Lucas", "Jonathan"];

function TeamAvatar({ name, highlight }: { name: string; highlight?: boolean }) {
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-display text-lg font-black ${highlight ? "bg-mint text-black shadow-glow" : "bg-white/[0.08] text-white"}`}>
      {initial}
    </span>
  );
}

function TeamChip({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={spring.snappy}
      className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.05] py-1.5 pl-1.5 pr-4 transition-colors hover:border-mint/30 hover:bg-white/[0.08]"
    >
      <span className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.08] font-display text-sm font-black text-white">{initial}</span>
      <span className="text-[13px] font-bold text-white/80">{name}</span>
    </motion.div>
  );
}

function AboutView() {
  const features = [
    [Bot, "Mine, sua tutora de IA", "Explica qualquer assunto, resolve passo a passo, corrige você e entende até quem escreve com pressa."],
    [ClipboardCheck, "Modo prova", "Simulados de múltipla escolha gerados na hora pela IA, com correção e explicação a cada questão."],
    [Brain, "Mapa mental", "A Mine resume a matéria em um mapa visual de tópicos e subtópicos em segundos."],
    [BookOpen, "Matérias e conteúdos", "Reúna PDFs, links, imagens e anotações organizados por matéria."],
    [CalendarPlus, "Cronograma até a prova", "Monte um plano de revisão por matéria e envie direto para a sua agenda."],
    [Activity, "Progresso", "Acompanhe quanto você já estudou em cada matéria, sem se perder."],
    [Layers, "Flashcards inteligentes", "A Mine cria cartões dos seus conteúdos e agenda revisões espaçadas para você memorizar de verdade."],
    [Search, "Busca global", "Ache qualquer matéria, conteúdo, anotação ou tarefa em um só lugar."],
  ] as const;
  return (
    <>
      <PageHeader eyebrow="Sobre" title="Minerva" subtitle="O que a plataforma faz e quem está por trás dela." />
      <Reveal>
        <HeroCard>
          <div className="flex flex-col gap-7 md:flex-row md:items-center">
            <div className="relative shrink-0 [perspective:800px]">
              <motion.div
                className="grid h-24 w-24 place-items-center rounded-3xl border border-mint/25 bg-mint/10 p-2 shadow-glow"
                whileHover={{ rotateY: 22, rotateX: -14, scale: 1.06 }}
                transition={spring.soft}
              >
                <BrandMark label="Minerva" className="h-full w-full" />
              </motion.div>
              <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 animate-breathe rounded-3xl bg-mint/30 blur-2xl" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-[2rem] font-black leading-tight md:text-5xl">
                <SplitWords text="Tudo o que você precisa para aprender, em um só lugar." />
              </h2>
              <p className="mt-4 max-w-3xl leading-relaxed text-white/58">
                A Minerva junta seus conteúdos, tarefas e provas com a Mine — uma tutora de IA que explica, faz simulados e estuda junto com você.
              </p>
            </div>
          </div>
        </HeroCard>
      </Reveal>

      <Stagger className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" gap={0.055}>
        {features.map(([Icon, title, text]) => (
          <StaggerItem key={title} className="h-full">
            <Tilt3D max={6} lift={8} className="h-full">
              <div className="glass depth-panel group relative h-full overflow-hidden rounded-lg p-5 transition-colors duration-control hover:border-mint/25 md:p-6">
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-mint/20 opacity-0 blur-3xl transition-opacity duration-surface group-hover:opacity-100"
                />
                <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-mint/12 text-mint ring-1 ring-inset ring-mint/20 transition-transform duration-control group-hover:scale-105">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="relative mt-5 font-display text-xl font-black leading-tight">{title}</h3>
                <p className="relative mt-2 text-[14px] leading-relaxed text-white/54">{text}</p>
              </div>
            </Tilt3D>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="mt-5">
        <Reveal delay={0.06}>
          <GlassCard>
            <SectionTitle icon={Users} title="Equipe do projeto" hint="quem desenvolveu a Minerva" />
            <div className="mt-5 flex items-center gap-4 rounded-2xl border border-mint/30 bg-mint/[0.08] p-4">
              <TeamAvatar name="Davi" highlight />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-xl font-black">Davi</span>
                  <span className="rounded-full bg-mint px-2.5 py-0.5 text-[11px] font-black text-black">DEV</span>
                </div>
                <p className="text-[13px] text-white/55">Criador do app e do site</p>
              </div>
            </div>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[.24em] text-white/32">Colaboradores</p>
            <Stagger className="mt-3 flex flex-wrap gap-2.5" gap={0.05}>
              {teamMembers.map((member) => (
                <StaggerItem key={member}>
                  <TeamChip name={member} />
                </StaggerItem>
              ))}
            </Stagger>
            <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5 text-[13px] font-bold text-white/68">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.07] text-mint">
                <GraduationCap className="h-5 w-5" />
              </span>
              Turma do 3º ano — Desenvolvimento de Sistemas
            </div>
          </GlassCard>
        </Reveal>
      </div>
    </>
  );
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

type GameId = "corrida" | "memoria" | "forca" | "caca" | "nexo" | "sequencia";
type LegacyGameId = "runner";

const gameCatalog: Array<{
  id: GameId;
  name: string;
  tagline: string;
  rule: string;
  icon: LucideIcon;
  accent: string;
  /** Passo a passo mostrado antes de começar. Ninguém deveria descobrir a regra perdendo. */
  howTo: string[];
  /** O que conta como vitória, em uma linha. */
  goal: string;
  /** Selo no canto do cartão. Pinta a borda com o accent do jogo. */
  badge?: string;
  /** Ocupa a linha inteira em telas médias. Só um jogo por vez merece isso. */
  featured?: boolean;
}> = [
  {
    id: "nexo",
    name: "Nexo Vivo",
    tagline: "Construa uma constelação ligando conceitos aos sinais certos.",
    rule: "Cada conexão correta amplia a rede. Ligações falsas consomem a energia do bioma.",
    icon: Share2,
    accent: "#F472D0",
    howTo: [
      "Um conceito aparece no núcleo de uma rede viva.",
      "Escolha, entre três sinais, a definição que realmente pertence ao conceito.",
      "Acertos seguidos fortalecem o pulso e aumentam a pontuação.",
      "Uma ligação errada consome energia, mas revela a qual conceito aquele sinal pertence.",
      "Use as teclas 1, 2 e 3 se quiser jogar sem o mouse.",
    ],
    goal: "Fechar a constelação com todas as conexões antes de perder as três cargas de energia.",
    badge: "Novo",
    featured: true,
  },
  {
    id: "sequencia",
    name: "Forja de Sequências",
    tagline: "Remonte processos e faça mecanismos de conhecimento voltarem a funcionar.",
    rule: "Mova quatro etapas para a ordem correta. Menos movimentos e tentativas rendem mais pontos.",
    icon: ListChecks,
    accent: "#FB923C",
    howTo: [
      "A Mine cria a quantidade de processos que você escolheu e embaralha as etapas.",
      "Arraste cada etapa ou use os botões de subir e descer.",
      "Acione o núcleo para testar a ordem montada.",
      "O painel informa quantas posições estão corretas sem entregar toda a solução.",
      "Quando a sequência funciona, uma explicação mostra por que aquela ordem faz sentido.",
    ],
    goal: "Reativar todos os mecanismos com o menor número de movimentos e testes.",
    badge: "Novo",
  },
  {
    id: "corrida",
    name: "A Jornada da Mine",
    tagline: "Uma aventura em quatro capítulos pela floresta elétrica até o farol antigo.",
    rule: "As cenas e regiões são liberadas por acertos. O tempo pausa durante a história.",
    icon: Zap,
    accent: "#FBBF24",
    howTo: [
      "Um relógio de 60 segundos começa a correr assim que a partida abre.",
      "Cada afirmação tem duas respostas: verdadeiro ou falso.",
      "Acertar devolve 3 segundos ao relógio; errar custa 5 segundos.",
      "Acertos seguidos aumentam o combo e valem mais pontos.",
      "A história avança sozinha conforme você acerta, e o tempo pausa nas cenas.",
    ],
    goal: "Chegar ao farol antigo antes de o relógio zerar.",
  },
  {
    id: "memoria",
    name: "Arquivo Perdido",
    tagline: "Reconstrua uma biblioteca antiga, fragmento por fragmento.",
    rule: "Cada par restaura uma parte da história. Menos jogadas rendem uma nota maior.",
    icon: Layers,
    accent: "#38BDF8",
    howTo: [
      "As cartas viradas escondem termos da matéria e as definições deles.",
      "Vire duas cartas por vez procurando o termo e a definição que combinam.",
      "Par certo fica aberto; par errado vira de volta depois de um instante.",
      "Cada jogada conta: quanto menos tentativas, maior a pontuação.",
    ],
    goal: "Abrir todos os pares e restaurar o arquivo inteiro.",
  },
  {
    id: "forca",
    name: "Torre dos Códigos",
    tagline: "Decifre palavras para subir os andares de uma torre selada.",
    rule: "Cada termo certo abre um andar. Seis erros esgotam a energia daquela porta.",
    icon: Brain,
    accent: "#A78BFA",
    howTo: [
      "A Mine esconde um termo da matéria e mostra uma dica sobre ele.",
      "Escolha letras no teclado da tela — ou digite no teclado de verdade.",
      "Letra certa aparece na palavra; letra errada apaga um andar da torre.",
      "Seis erros encerram aquela palavra e você segue para a próxima.",
      "Palavras seguidas sem erro multiplicam os pontos.",
    ],
    goal: "Decifrar todas as palavras escolhidas gastando o mínimo de energia da torre.",
  },
  {
    id: "caca",
    name: "Caça-Palavras da Mine",
    tagline: "Encontre os termos escondidos na grade e descubra o que cada um significa.",
    rule: "Arraste sobre a palavra ou toque na primeira e na última letra. Cada palavra achada abre o seu significado.",
    icon: Search,
    accent: "#22D3EE",
    howTo: [
      "A grade esconde termos da sua matéria na horizontal, na vertical e nas diagonais.",
      "As palavras podem estar de trás para frente — vale procurar nos dois sentidos.",
      "Arraste o dedo ou o mouse da primeira até a última letra da palavra.",
      "Se preferir, toque só na primeira letra e depois na última.",
      "A cada palavra encontrada, a Mine abre o significado dela para você ler.",
    ],
    goal: "Achar todas as palavras e ficar com o glossário completo da matéria.",
    badge: "Novo",
  },
];

/**
 * Ângulos de pedido. A cada partida um deles entra no prompt, junto com a lista
 * do que já saiu — sem isso o modelo tende a devolver os mesmos cinco conceitos
 * mais óbvios da matéria toda vez, e a segunda partida vira a primeira de novo.
 */
const gameAngles = [
  "Priorize conceitos e definições centrais.",
  "Priorize processos, etapas e como as coisas acontecem.",
  "Priorize causas, consequências e relações entre ideias.",
  "Priorize aplicações práticas e exemplos do dia a dia.",
  "Priorize comparações, diferenças e casos que costumam ser confundidos.",
  "Priorize detalhes específicos e termos técnicos menos óbvios.",
  "Priorize datas, números, classificações e nomenclatura.",
];

const seenStorageKey = "minerva-games-vistos-v1";

/** O que já saiu por jogo e matéria, para não repetir na partida seguinte. */
function readSeen(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(seenStorageKey) || "{}") as Record<string, string[]>;
  } catch {
    return {};
  }
}

function rememberSeen(key: string, items: string[]) {
  try {
    const all = readSeen();
    // Guarda os 30 mais recentes: memória longa demais acaba pedindo à Mine
    // que evite a matéria inteira e o pedido fica impossível.
    all[key] = [...items, ...(all[key] || [])].slice(0, 30);
    localStorage.setItem(seenStorageKey, JSON.stringify(all));
  } catch {
    // Sem armazenamento local a variação fica só por conta do ângulo sorteado.
  }
}

const recordStorageKey = "minerva-games-recordes-v1";

/** Recordes ficam no aparelho: um por jogo e matéria. */
function readRecords(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(recordStorageKey) || "{}") as Record<string, number>;
  } catch {
    return {};
  }
}
function saveRecord(key: string, value: number): boolean {
  try {
    const all = readRecords();
    if ((all[key] || 0) >= value) return false;
    all[key] = value;
    localStorage.setItem(recordStorageKey, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Placar do topo, igual em todos os jogos. */
function GameHud({ items }: { items: Array<{ label: string; value: string; tone?: "normal" | "alerta" | "bom" }> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className={`min-w-[5.5rem] flex-1 rounded-xl border px-3 py-2 ${
            item.tone === "alerta"
              ? "border-roseGlow/35 bg-roseGlow/10"
              : item.tone === "bom"
                ? "border-mint/35 bg-mint/10"
                : "border-white/10 bg-white/[0.05]"
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-white/40">{item.label}</p>
          <p
            className={`font-display text-xl font-black tabular ${
              item.tone === "alerta" ? "text-roseGlow" : item.tone === "bom" ? "text-mint" : "text-white"
            }`}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * Corrida do Conhecimento — o loop é o relógio, não a pergunta.
 *
 * O tempo corre sozinho e só para quando zera; acertar devolve segundos e
 * aumenta o combo, errar cobra caro. Isso troca "responder um teste" por
 * "sobreviver o máximo que der", que é o que faz querer jogar de novo.
 */
type GameStoryChapter = { title: string; text: string };

const gameStories: Record<GameId | LegacyGameId, GameStoryChapter[]> = {
  nexo: [
    { title: "O primeiro pulso", text: "Uma rede adormecida procura conceitos capazes de fazê-la crescer." },
    { title: "Raízes de luz", text: "As conexões corretas começam a formar um mapa vivo da matéria." },
    { title: "Copa semântica", text: "Cada ideia encontra seu lugar e sustenta as ligações seguintes." },
    { title: "Constelação fechada", text: "A rede inteira pulsa como uma única memória organizada." },
  ],
  sequencia: [
    { title: "Oficina parada", text: "Os mecanismos perderam a ordem e deixaram de produzir conhecimento." },
    { title: "Engrenagens causais", text: "Cada etapa recolocada revela como uma ação prepara a próxima." },
    { title: "Núcleo de processo", text: "As sequências começam a explicar por que as transformações acontecem." },
    { title: "Forja reativada", text: "Os três mecanismos voltaram a funcionar na ordem correta." },
  ],
  corrida: [
    { title: "O sinal", text: "A Mine encontrou uma mensagem escondida além das muralhas." },
    { title: "A floresta elétrica", text: "Cada resposta correta ilumina uma trilha que não existia antes." },
    { title: "A ponte suspensa", text: "O caminho reage ao seu conhecimento. Falta pouco para atravessar." },
    { title: "O farol antigo", text: "A mensagem está no topo. Complete a rota antes que o tempo acabe." },
  ],
  memoria: [
    { title: "O arquivo adormecido", text: "As lembranças da biblioteca foram separadas em fragmentos." },
    { title: "Sala dos ecos", text: "Os primeiros pares revelam vozes de estudantes do passado." },
    { title: "Mapa das constelações", text: "As conexões formam um mapa para o coração do arquivo." },
    { title: "A memória de Minerva", text: "Resta unir os últimos fragmentos e restaurar a história." },
  ],
  forca: [
    { title: "A porta sem nome", text: "Uma torre selada só responde às palavras certas." },
    { title: "O corredor das letras", text: "Cada termo descoberto abre um novo andar." },
    { title: "A câmara do código", text: "As palavras começam a formar uma mensagem secreta." },
    { title: "O sino da torre", text: "Decifre os últimos termos para fazer o sino tocar novamente." },
  ],
  caca: [
    { title: "A grade cifrada", text: "Alguém escondeu os termos da matéria no meio das letras." },
    { title: "Primeiros rastros", text: "Cada palavra encontrada devolve o seu significado." },
    { title: "As diagonais", text: "Os termos que faltam estão nos caminhos tortos." },
    { title: "O glossário restaurado", text: "Ache o resto e a matéria fica inteira de novo." },
  ],
  runner: [
    { title: "Partida", text: "A Mine corre para levar uma centelha de conhecimento até a cidade distante." },
    { title: "Campos de neon", text: "Os portais corretos carregam a centelha e aceleram a viagem." },
    { title: "Desfiladeiro das dúvidas", text: "A cidade já aparece no horizonte. Não perca o ritmo." },
    { title: "Cidade de Minerva", text: "A última sequência de portais pode reacender toda a cidade." },
  ],
};

function StoryJourney({ game, successes, goal, compact = false }: { game: GameId | LegacyGameId; successes: number; goal: number; compact?: boolean }) {
  const chapters = gameStories[game];
  const progress = Math.min(1, successes / Math.max(1, goal));
  const chapter = Math.min(chapters.length - 1, Math.floor(progress * chapters.length));
  const current = chapters[chapter];
  const reduced = useSoftMotion();
  const distance = successes * 140;

  return (
    <div className={`relative overflow-hidden rounded-lg border border-white/10 bg-black/40 px-4 ${compact ? "py-2.5" : "py-4 sm:px-5"}`}>
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(90deg, transparent 49%, rgba(52,211,153,.12) 50%, transparent 51%)", backgroundSize: "54px 100%" }} />
      <motion.div className="pointer-events-none absolute -right-6 -top-10 h-44 w-44 opacity-25" animate={reduced ? undefined : { rotate: [8, 14, 8], y: [0, -5, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}>
        <React.Suspense fallback={null}>
          <Cubes gridSize={4} maxAngle={20} radius={1.8} cellGap={4} faceColor="#071510" borderStyle="1px solid rgba(52,211,153,.35)" shadow="0 0 6px rgba(52,211,153,.14)" autoAnimate={false} rippleOnClick={false} />
        </React.Suspense>
      </motion.div>
      {compact ? (
        <div className="relative z-10 flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[.18em] text-mint">Rota da história</p><p className="font-display text-base font-black text-mint">{distance}m</p></div>
      ) : <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-mint">Capítulo {chapter + 1} de {chapters.length}</p>
          <AnimatePresence mode="wait">
            <motion.div key={current.title} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <p className="mt-1 font-display text-base font-black sm:text-lg">{current.title}</p>
              <p className="mt-0.5 text-xs font-bold leading-relaxed text-white/45 sm:text-[13px]">{current.text}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="shrink-0 text-right"><p className="font-display text-xl font-black text-mint">{distance}m</p><p className="text-[10px] font-black uppercase tracking-[.12em] text-white/30">percorridos</p></div>
      </div>}
      <div className={`relative z-10 ${compact ? "mt-1 h-9" : "mt-4 h-12"}`}>
        <div className="absolute inset-x-2 top-5 h-1 rounded-full bg-white/10" />
        <motion.div className="absolute left-2 top-5 h-1 rounded-full bg-mint shadow-[0_0_14px_rgba(52,211,153,.55)]" animate={{ width: `${Math.max(1, progress * 96)}%` }} transition={spring.gentle} />
        {chapters.map((item, index) => {
          const point = index / (chapters.length - 1);
          const reached = progress >= point;
          return <span key={item.title} className={`absolute top-[14px] grid h-4 w-4 -translate-x-1/2 place-items-center rounded-full border ${reached ? "border-mint bg-mint" : "border-white/20 bg-black"}`} style={{ left: `${2 + point * 96}%` }}>{reached ? <Check className="h-2.5 w-2.5 text-black" /> : null}</span>;
        })}
        <motion.div className="absolute top-0 grid h-10 w-10 place-items-center rounded-full border border-mint/40 bg-black text-mint shadow-glowSoft" animate={{ left: `${Math.min(96, progress * 96)}%`, y: reduced ? 0 : [0, -3, 0] }} transition={{ left: spring.gentle, y: { duration: 1, repeat: Infinity } }}><Bot className="h-5 w-5" /></motion.div>
      </div>
    </div>
  );
}

function SpeedRunGame({
  items,
  recordKey,
  onFinish,
}: {
  items: TrueFalseItem[];
  recordKey: string;
  onFinish: (score: number, recorde: boolean, correctAnswers: number, answers: GameAnswer[]) => void;
}) {
  const DURACAO = 60_000;
  const BONUS_ACERTO = 3_000;
  const CASTIGO_ERRO = 5_000;
  const FEEDBACK_DURATION = 4_500;

  const [restante, setRestante] = useState(DURACAO);
  const [indice, setIndice] = useState(0);
  const [pontos, setPontos] = useState(0);
  const [acertos, setAcertos] = useState(0);
  const [combo, setCombo] = useState(0);
  const [melhorCombo, setMelhorCombo] = useState(0);
  const [flash, setFlash] = useState<"acerto" | "erro" | null>(null);
  const [feedback, setFeedback] = useState("");
  const [vivo, setVivo] = useState(true);
  const [mode, setMode] = useState<"intro" | "playing" | "chapter" | "ending">("intro");
  const [endingScore, setEndingScore] = useState(0);
  const [endingCorrect, setEndingCorrect] = useState(0);
  const encerrado = useRef(false);
  const answersRef = useRef<GameAnswer[]>([]);
  const feedbackTimerRef = useRef<number | null>(null);

  const atual = items[indice];
  const multiplicador = Math.min(1 + Math.floor(combo / 3), 5);

  const terminar = useCallback(
    (pontuacao: number, respostasCorretas: number) => {
      if (encerrado.current) return;
      encerrado.current = true;
      setVivo(false);
      onFinish(pontuacao, saveRecord(recordKey, pontuacao), respostasCorretas, answersRef.current);
    },
    [onFinish, recordKey],
  );

  useEffect(() => {
    if (!vivo || mode !== "playing" || flash) return;
    const inicio = Date.now();
    let base = restante;
    const timer = window.setInterval(() => {
      const decorrido = Date.now() - inicio;
      const novo = base - decorrido;
      if (novo <= 0) {
        setRestante(0);
        terminar(pontos, acertos);
        return;
      }
      setRestante(novo);
    }, 100);
    return () => {
      base = 0;
      window.clearInterval(timer);
    };
    // Reinicia a contagem sempre que o tempo muda por acerto/erro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vivo, indice, mode, flash]);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    },
    [],
  );

  function responder(valor: boolean) {
    if (!vivo || !atual || flash) return;
    const certo = valor === atual.answer;
    answersRef.current = [...answersRef.current, {
      id: uid("answer"),
      prompt: atual.statement,
      userAnswer: valor ? "Verdadeiro" : "Falso",
      correctAnswer: atual.answer ? "Verdadeiro" : "Falso",
      explanation: atual.explanation,
      correct: certo,
    }];
    const novosAcertos = acertos + (certo ? 1 : 0);
    let proximaPontuacao = pontos;
    setFeedback(atual.explanation);
    if (certo) {
      const ganho = 10 * multiplicador;
      const novosPontos = pontos + ganho;
      proximaPontuacao = novosPontos;
      setPontos(novosPontos);
      setAcertos(novosAcertos);
      setCombo((c) => {
        const proximo = c + 1;
        setMelhorCombo((m) => Math.max(m, proximo));
        return proximo;
      });
      setRestante((t) => Math.min(t + BONUS_ACERTO, DURACAO));
      setFlash("acerto");
    } else {
      setCombo(0);
      // Fora do updater de propósito: em StrictMode o updater roda duas vezes,
      // e encerrar a partida é efeito colateral, não cálculo de estado.
      const novoTempo = restante - CASTIGO_ERRO;
      setRestante(Math.max(0, novoTempo));
      if (novoTempo <= 0) {
        terminar(pontos, novosAcertos);
        return;
      }
      setFlash("erro");
    }
    if (indice + 1 >= items.length) {
      setEndingScore(proximaPontuacao + Math.floor(restante / 1000) * 2);
      setEndingCorrect(novosAcertos);
      setMode("ending");
      return;
    }
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => {
      setFlash(null);
      setFeedback("");
      setIndice((i) => i + 1);
      if (certo && (acertos + 1) % 3 === 0) setMode("chapter");
      feedbackTimerRef.current = null;
    }, FEEDBACK_DURATION);
  }

  const segundos = Math.max(0, restante / 1000);
  const fracao = Math.max(0, Math.min(1, restante / DURACAO));

  if (mode !== "playing") {
    const chapterIndex = mode === "intro" ? 0 : mode === "ending" ? 3 : Math.min(3, Math.floor(acertos / 3));
    const scene = gameStories.corrida[chapterIndex];
    const ending = mode === "ending";
    return (
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="relative min-h-[22rem] overflow-hidden rounded-lg border border-mint/20 bg-black/55 p-5 sm:p-7">
        <div className="pointer-events-none absolute inset-0 opacity-25" style={{ backgroundImage: "linear-gradient(rgba(52,211,153,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,.12) 1px, transparent 1px)", backgroundSize: "46px 46px" }} />
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center py-1 text-center">
          <motion.div animate={{ y: [0, -5, 0], rotate: ending ? 0 : [0, 4, 0] }} transition={{ duration: 2.2, repeat: Infinity }} className={`grid h-14 w-14 place-items-center rounded-full border ${ending ? "border-amber-300/45 bg-amber-300/15 text-amber-300" : "border-mint/40 bg-mint/15 text-mint"}`}>
            {ending ? <Trophy className="h-7 w-7" /> : <Bot className="h-7 w-7" />}
          </motion.div>
          <p className="mt-3 text-[11px] font-black uppercase tracking-[.2em] text-mint">{ending ? "Destino alcançado" : mode === "intro" ? "Prólogo" : `Capítulo ${chapterIndex + 1}`}</p>
          <h2 className="mt-1 font-display text-3xl font-black sm:text-4xl">{ending ? "O farol voltou a brilhar" : scene.title}</h2>
          <p className="mt-2 max-w-2xl text-sm font-bold leading-relaxed text-white/60">{ending ? "A mensagem atravessou a floresta e chegou à cidade. A Mine completou a jornada porque você dominou os desafios." : scene.text}</p>
          <div className="mt-4 w-full"><StoryJourney game="corrida" successes={indice} goal={items.length} compact /></div>
          <div className="mt-4">
            <PrimaryButton icon={ending ? Trophy : mode === "intro" ? Play : ArrowRight} onClick={() => ending ? terminar(endingScore, endingCorrect) : setMode("playing")}>
              {ending ? `Concluir · ${endingScore} pontos` : mode === "intro" ? "Começar a jornada" : "Seguir para a próxima região"}
            </PrimaryButton>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      <GameHud
        items={[
          { label: "Tempo", value: `${segundos.toFixed(1)}s`, tone: segundos <= 10 ? "alerta" : "normal" },
          { label: "Pontos", value: String(pontos), tone: "bom" },
          { label: "Combo", value: combo ? `${combo} · x${multiplicador}` : "—" },
          { label: "Melhor combo", value: String(melhorCombo) },
        ]}
      />

      <StoryJourney game="corrida" successes={indice} goal={items.length} />

      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <motion.div
          className={`h-full rounded-full ${segundos <= 10 ? "bg-roseGlow" : "bg-gradient-to-r from-mint to-mintDeep"}`}
          animate={{ width: `${fracao * 100}%` }}
          transition={{ duration: 0.1, ease: "linear" }}
        />
      </div>

      <motion.div
        animate={flash === "acerto" ? { scale: [1, 1.015, 1] } : flash === "erro" ? { x: [0, -9, 9, -5, 0] } : {}}
        transition={{ duration: 0.3 }}
        className={`relative min-h-[9.5rem] rounded-2xl border-2 p-6 transition-colors duration-200 ${
          flash === "acerto" ? "border-mint bg-mint/10" : flash === "erro" ? "border-roseGlow bg-roseGlow/10" : "border-white/12 bg-white/[0.05]"
        }`}
      >
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-white/35">Afirmação {indice + 1}/{items.length}</p>
        <p className="mt-2 font-display text-2xl font-black leading-snug">{atual?.statement}</p>
        {flash ? (
          <div className="mt-3 max-w-3xl" role="status" aria-live="polite">
            <p className="text-sm font-bold leading-relaxed text-white/68">{feedback || "A Mine está preparando a justificativa desta resposta."}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.14em] text-white/34">
              <Pause className="h-3 w-3 text-mint" />
              O relógio pausa por alguns segundos enquanto você lê
            </p>
          </div>
        ) : null}
        <AnimatePresence>
          {flash ? (
            <motion.span
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className={`absolute right-5 top-5 font-display text-2xl font-black ${flash === "acerto" ? "text-mint" : "text-roseGlow"}`}
            >
              {flash === "acerto" ? `+${10 * multiplicador}` : `−${CASTIGO_ERRO / 1000}s`}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        <motion.button
          type="button"
          onClick={() => responder(true)}
          disabled={!vivo || !!flash}
          whileTap={{ scale: 0.96 }}
          transition={spring.snappy}
          className="rounded-2xl border-2 border-mint/45 bg-mint/12 py-5 font-display text-xl font-black text-mint transition hover:bg-mint/20 disabled:opacity-40"
        >
          Trilha verdadeira
        </motion.button>
        <motion.button
          type="button"
          onClick={() => responder(false)}
          disabled={!vivo || !!flash}
          whileTap={{ scale: 0.96 }}
          transition={spring.snappy}
          className="rounded-2xl border-2 border-roseGlow/45 bg-roseGlow/12 py-5 font-display text-xl font-black text-roseGlow transition hover:bg-roseGlow/20 disabled:opacity-40"
        >
          Trilha falsa
        </motion.button>
      </div>
      <p className="text-center text-[13px] font-bold text-white/35">Acerto devolve 3s · erro tira 5s · 3 acertos seguidos sobem o multiplicador</p>
    </div>
  );
}

/**
 * Jogo da Memória — pares de termo e definição.
 * A nota sai de jogadas e tempo, então decorar a posição das cartas vale tanto
 * quanto saber a matéria.
 */
function MemoryGame({
  pairs,
  recordKey,
  onFinish,
}: {
  pairs: PairItem[];
  recordKey: string;
  onFinish: (score: number, recorde: boolean, correctAnswers: number, answers: GameAnswer[]) => void;
}) {
  type Carta = { id: string; parId: number; texto: string; tipo: "termo" | "definicao" };

  const [baralho] = useState<Carta[]>(() =>
    shuffle(
      pairs.flatMap((par, indice) => [
        { id: `t${indice}`, parId: indice, texto: par.term, tipo: "termo" as const },
        { id: `d${indice}`, parId: indice, texto: par.definition, tipo: "definicao" as const },
      ]),
    ),
  );
  const [viradas, setViradas] = useState<string[]>([]);
  const [feitos, setFeitos] = useState<number[]>([]);
  const [jogadas, setJogadas] = useState(0);
  const [erroPar, setErroPar] = useState<string[]>([]);
  const [inicio] = useState(() => Date.now());
  const [segundos, setSegundos] = useState(0);
  const encerrado = useRef(false);
  const failedPairsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const timer = window.setInterval(() => setSegundos(Math.floor((Date.now() - inicio) / 1000)), 500);
    return () => window.clearInterval(timer);
  }, [inicio]);

  useEffect(() => {
    if (encerrado.current || feitos.length !== pairs.length) return;
    encerrado.current = true;
    const tempo = Math.max(1, Math.floor((Date.now() - inicio) / 1000));
    // Perfeito = uma jogada por par. Cada jogada extra e cada segundo pesam.
    const nota = Math.max(50, Math.round(1000 - (jogadas - pairs.length) * 25 - tempo * 3));
    const answers = pairs.map((pair, pairIndex) => ({
      id: uid("answer"),
      prompt: `Qual definição corresponde a “${pair.term}”?`,
      userAnswer: failedPairsRef.current.has(pairIndex) ? "Houve uma combinação incorreta antes do par" : pair.definition,
      correctAnswer: pair.definition,
      explanation: `${pair.term}: ${pair.definition}`,
      correct: !failedPairsRef.current.has(pairIndex),
    }));
    window.setTimeout(() => onFinish(nota, saveRecord(recordKey, nota), answers.filter((answer) => answer.correct).length, answers), 700);
  }, [feitos, pairs.length, jogadas, inicio, onFinish, recordKey]);

  // Só empilha a carta. A comparação vive no efeito abaixo porque dois cliques
  // no mesmo ciclo do React leem `viradas` desatualizado e a primeira carta
  // sumia — o updater funcional garante que as duas entrem.
  function virar(carta: Carta) {
    setViradas((atual) => {
      if (atual.length >= 2 || atual.includes(carta.id) || feitos.includes(carta.parId)) return atual;
      return [...atual, carta.id];
    });
  }

  useEffect(() => {
    if (viradas.length !== 2) return;
    setJogadas((valor) => valor + 1);
    const [a, b] = viradas.map((id) => baralho.find((item) => item.id === id)!);
    if (a.parId === b.parId) {
      setFeitos((atual) => (atual.includes(a.parId) ? atual : [...atual, a.parId]));
      setViradas([]);
      return;
    }
    failedPairsRef.current.add(a.parId);
    failedPairsRef.current.add(b.parId);
    setErroPar(viradas);
    const timer = window.setTimeout(() => {
      setViradas([]);
      setErroPar([]);
    }, 750);
    return () => window.clearTimeout(timer);
  }, [viradas, baralho]);

  return (
    <div className="space-y-5">
      <GameHud
        items={[
          { label: "Pares", value: `${feitos.length}/${pairs.length}`, tone: "bom" },
          { label: "Jogadas", value: String(jogadas) },
          { label: "Tempo", value: `${segundos}s` },
        ]}
      />
      <StoryJourney game="memoria" successes={feitos.length} goal={pairs.length} />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {baralho.map((carta) => {
          const feito = feitos.includes(carta.parId);
          const aberta = feito || viradas.includes(carta.id);
          const errada = erroPar.includes(carta.id);
          return (
            <motion.button
              key={carta.id}
              type="button"
              onClick={() => virar(carta)}
              disabled={aberta}
              whileTap={aberta ? undefined : { scale: 0.95 }}
              animate={errada ? { x: [0, -6, 6, 0] } : {}}
              transition={{ duration: 0.3 }}
              className={`grid min-h-[6.5rem] place-items-center rounded-2xl border-2 p-3 text-center transition-colors duration-control ${
                feito
                  ? "border-mint/50 bg-mint/12"
                  : errada
                    ? "border-roseGlow/50 bg-roseGlow/10"
                    : aberta
                      ? "border-white/25 bg-white/[0.10]"
                      : "border-white/10 bg-white/[0.05] hover:border-mint/35 hover:bg-mint/[0.07]"
              }`}
            >
              {aberta ? (
                <span className="space-y-1">
                  <span className={`block text-[10px] font-black uppercase tracking-[.16em] ${carta.tipo === "termo" ? "text-mint" : "text-white/35"}`}>
                    {carta.tipo === "termo" ? "Termo" : "Definição"}
                  </span>
                  <span className={`block leading-snug ${carta.tipo === "termo" ? "font-display text-base font-black" : "text-[13px] text-white/80"}`}>
                    {carta.texto}
                  </span>
                </span>
              ) : (
                <Sparkles className="h-6 w-6 text-white/25" />
              )}
            </motion.button>
          );
        })}
      </div>
      <p className="text-center text-[13px] font-bold text-white/35">Ligue cada termo à definição certa. Menos jogadas, nota maior.</p>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Caça-palavras
 * ------------------------------------------------------------------------- */

type WordPlacement = { word: string; meaning: string; cells: number[] };
type WordSearchBoard = { size: number; letters: string[]; placements: WordPlacement[] };

/** As oito direções. A diagonal é o que separa um caça-palavras de uma lista. */
const wordSearchDirections: Array<[number, number]> = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Monta a grade.
 *
 * Cada palavra tenta várias posições ao acaso e só é aceita onde as letras que
 * já estão na grade coincidem — é assim que os cruzamentos aparecem sem
 * estragar nada. Palavra que não coube em 220 tentativas fica de fora: é
 * melhor um jogo com sete palavras válidas do que um com dez e uma impossível.
 *
 * O preenchimento sorteia entre as letras que as próprias palavras usam. Com o
 * alfabeto inteiro a grade fica cheia de K, W e Y, e as palavras saltam aos
 * olhos antes de o aluno procurar.
 */
function buildWordSearch(items: WordMeaning[], max = 9): WordSearchBoard {
  const escolhidas = shuffle(items).slice(0, max);
  const maiorPalavra = escolhidas.reduce((maior, item) => Math.max(maior, item.word.length), 0);
  // Cada coluna a mais encolhe a célula: com 13 colunas a letra fica com 19px
  // num aparelho de 375px, pequeno demais para tocar. 12 é o teto.
  const size = Math.min(12, Math.max(10, maiorPalavra));
  const letters = new Array<string>(size * size).fill("");
  const placements: WordPlacement[] = [];

  for (const item of escolhidas) {
    const { word } = item;
    if (word.length > size) continue;
    let posicionada = false;
    for (let tentativa = 0; tentativa < 220 && !posicionada; tentativa += 1) {
      const [dy, dx] = wordSearchDirections[Math.floor(Math.random() * wordSearchDirections.length)];
      const linha = Math.floor(Math.random() * size);
      const coluna = Math.floor(Math.random() * size);
      const fimLinha = linha + dy * (word.length - 1);
      const fimColuna = coluna + dx * (word.length - 1);
      if (fimLinha < 0 || fimLinha >= size || fimColuna < 0 || fimColuna >= size) continue;

      const cells: number[] = [];
      let cabe = true;
      for (let i = 0; i < word.length; i += 1) {
        const indice = (linha + dy * i) * size + (coluna + dx * i);
        const atual = letters[indice];
        if (atual && atual !== word[i]) {
          cabe = false;
          break;
        }
        cells.push(indice);
      }
      if (!cabe) continue;

      cells.forEach((indice, i) => {
        letters[indice] = word[i];
      });
      placements.push({ word, meaning: item.meaning, cells });
      posicionada = true;
    }
  }

  const usadas = placements.map((item) => item.word).join("") || alphabet;
  for (let i = 0; i < letters.length; i += 1) {
    if (!letters[i]) letters[i] = usadas[Math.floor(Math.random() * usadas.length)];
  }
  return { size, letters, placements };
}

/** Uma reta só vale se for horizontal, vertical ou diagonal exata. */
function wordSearchPath(from: number, to: number, size: number): number[] | null {
  const linhaA = Math.floor(from / size);
  const colunaA = from % size;
  const linhaB = Math.floor(to / size);
  const colunaB = to % size;
  const deltaLinha = linhaB - linhaA;
  const deltaColuna = colunaB - colunaA;
  if (deltaLinha === 0 && deltaColuna === 0) return [from];
  if (deltaLinha !== 0 && deltaColuna !== 0 && Math.abs(deltaLinha) !== Math.abs(deltaColuna)) return null;
  const passos = Math.max(Math.abs(deltaLinha), Math.abs(deltaColuna));
  const passoLinha = Math.sign(deltaLinha);
  const passoColuna = Math.sign(deltaColuna);
  return Array.from({ length: passos + 1 }, (_, i) => (linhaA + passoLinha * i) * size + (colunaA + passoColuna * i));
}

function sameCells(a: number[], b: number[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Caça-palavras com significado.
 *
 * O pedido do usuário era que "em cada palavra achada o seu significado
 * apareça". Então achar não termina nada: abre um cartão com a explicação, que
 * fica guardado na lista abaixo da grade até o fim da partida. A grade é o
 * caminho; o que se aprende são os cartões.
 *
 * Seleção: arrastar (mouse ou dedo) OU tocar na primeira e depois na última
 * letra. As duas existem porque arrastar em tela pequena briga com a rolagem
 * da página, e tocar duas vezes também é o que dá teclado de graça — cada
 * letra é um <button> de verdade.
 */
function WordSearchGame({
  items,
  wordCount,
  showPreviews,
  recordKey,
  onFinish,
}: {
  items: WordMeaning[];
  wordCount: GameQuestionCount;
  showPreviews: boolean;
  recordKey: string;
  onFinish: (score: number, recorde: boolean, correctAnswers: number, answers: GameAnswer[]) => void;
}) {
  const board = useMemo(() => buildWordSearch(items, wordCount), [items, wordCount]);
  const [found, setFound] = useState<WordPlacement[]>([]);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [erro, setErro] = useState(false);
  const [revelada, setRevelada] = useState<WordPlacement | null>(null);
  const [segundos, setSegundos] = useState(0);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const arrastando = useRef(false);
  const moveu = useRef(false);
  const encerrado = useRef(false);
  const reduzido = useSoftMotion();

  const total = board.placements.length;
  const completo = total > 0 && found.length >= total;
  const cellsFound = useMemo(() => new Set(found.flatMap((item) => item.cells)), [found]);
  const caminho = useMemo(
    () => (anchor === null || hover === null ? [] : wordSearchPath(anchor, hover, board.size) || []),
    [anchor, hover, board.size],
  );
  const caminhoAtivo = useMemo(() => new Set(caminho), [caminho]);

  useEffect(() => {
    if (completo) return;
    const timer = window.setInterval(() => setSegundos((valor) => valor + 1), 1000);
    return () => window.clearInterval(timer);
  }, [completo]);

  // Cartão do significado sai sozinho; a palavra continua na lista de baixo.
  useEffect(() => {
    if (!revelada) return;
    const timer = window.setTimeout(() => setRevelada(null), 7000);
    return () => window.clearTimeout(timer);
  }, [revelada]);

  useEffect(() => {
    if (!erro) return;
    const timer = window.setTimeout(() => setErro(false), 420);
    return () => window.clearTimeout(timer);
  }, [erro]);

  const finalizar = useCallback(
    (achadas: WordPlacement[]) => {
      if (encerrado.current) return;
      encerrado.current = true;
      // Achar vale muito; o relógio só arranha o placar, para não punir quem
      // parou para ler os significados — que é justamente o objetivo do jogo.
      const pontos = achadas.length * 150 + Math.max(0, 600 - segundos * 2);
      const answers = achadas.map((item) => ({ id: uid("answer"), prompt: `Encontre o termo: ${item.meaning}`, userAnswer: item.word, correctAnswer: item.word, explanation: item.meaning, correct: true }));
      onFinish(pontos, saveRecord(recordKey, pontos), achadas.length, answers);
    },
    [onFinish, recordKey, segundos],
  );

  const tentar = useCallback(
    (cells: number[]) => {
      if (cells.length < 2) return;
      const invertido = [...cells].reverse();
      const alvo = board.placements.find(
        (item) => !found.includes(item) && (sameCells(item.cells, cells) || sameCells(item.cells, invertido)),
      );
      if (!alvo) {
        setErro(true);
        return;
      }
      const achadas = [...found, alvo];
      setFound(achadas);
      setRevelada(alvo);
      if (achadas.length >= total) finalizar(achadas);
    },
    [board.placements, found, total, finalizar],
  );

  /** Qual letra está debaixo do dedo. Sem isto, arrastar só funcionaria com mouse. */
  function cellAt(x: number, y: number): number | null {
    const element = document.elementFromPoint(x, y);
    const cell = element instanceof HTMLElement ? element.closest("[data-cell]") : null;
    const index = cell instanceof HTMLElement ? Number(cell.dataset.cell) : NaN;
    return Number.isInteger(index) ? index : null;
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (completo) return;
    const index = cellAt(event.clientX, event.clientY);
    if (index === null) return;
    // Um toque solto sobre a âncora não desfaz a seleção: é assim que o modo
    // "toca no começo, toca no fim" continua funcionando.
    if (anchor !== null && index !== anchor) {
      const cells = wordSearchPath(anchor, index, board.size);
      if (cells) tentar(cells);
      setAnchor(null);
      setHover(null);
      return;
    }
    arrastando.current = true;
    moveu.current = false;
    setAnchor(index);
    setHover(index);
    gridRef.current?.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    // Vale arrastando e também com a âncora armada pelo primeiro toque: no
    // mouse isso mostra a linha antes de confirmar. No toque só existe
    // pointermove com o dedo na tela, que é o próprio arrasto.
    if (anchor === null || (!arrastando.current && event.pointerType === "touch")) return;
    const index = cellAt(event.clientX, event.clientY);
    // Só sobe para o React quando a letra realmente muda: um setState por
    // evento de ponteiro re-renderiza a grade dezenas de vezes por segundo.
    if (index === null || index === hover) return;
    if (index !== anchor) moveu.current = true;
    setHover(index);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!arrastando.current) return;
    arrastando.current = false;
    gridRef.current?.releasePointerCapture?.(event.pointerId);
    if (!moveu.current) return; // toque simples: mantém a âncora armada
    if (anchor !== null && hover !== null) {
      const cells = wordSearchPath(anchor, hover, board.size);
      if (cells) tentar(cells);
    }
    setAnchor(null);
    setHover(null);
  }

  function porTeclado(index: number) {
    if (completo) return;
    if (anchor === null) {
      setAnchor(index);
      setHover(index);
      return;
    }
    const cells = wordSearchPath(anchor, index, board.size);
    if (cells) tentar(cells);
    setAnchor(null);
    setHover(null);
  }

  if (!total) {
    return (
      <EmptyState
        icon={XCircle}
        title="A grade não fechou"
        text="As palavras que a Mine escolheu não couberam no tabuleiro. Tente montar a partida de novo."
      />
    );
  }

  return (
    <div className="space-y-5">
      <GameHud
        items={[
          { label: "Palavras", value: `${found.length}/${total}`, tone: completo ? "bom" : "normal" },
          { label: "Tempo", value: `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}` },
          { label: "Restam", value: String(total - found.length), tone: total - found.length <= 2 ? "bom" : "normal" },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div>
          <motion.div
            ref={gridRef}
            role="grid"
            aria-label="Grade do caça-palavras"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            animate={erro && !reduzido ? { x: [0, -5, 5, 0] } : {}}
            transition={{ duration: 0.32 }}
            // touch-none: sem isto o dedo rola a página em vez de traçar a linha.
            className="mx-auto grid w-full max-w-[32rem] touch-none select-none gap-[3px] rounded-xl border border-white/10 bg-black/45 p-1.5 sm:gap-1.5 sm:p-3"
            style={{ gridTemplateColumns: `repeat(${board.size}, minmax(0, 1fr))` }}
          >
            {board.letters.map((letra, index) => {
              const achada = cellsFound.has(index);
              const naLinha = caminhoAtivo.has(index);
              const ancorada = index === anchor;
              return (
                <button
                  key={index}
                  type="button"
                  data-cell={index}
                  role="gridcell"
                  aria-label={`Letra ${letra}`}
                  aria-pressed={ancorada || naLinha}
                  onClick={() => porTeclado(index)}
                  className={`grid aspect-square min-w-0 place-items-center rounded-[7px] font-display text-[clamp(0.7rem,2.6vw,1rem)] font-black uppercase leading-none transition-colors duration-150 ${
                    achada
                      ? "bg-mint text-black shadow-glowSoft"
                      : naLinha
                        ? "bg-cyanGlow/80 text-black"
                        : ancorada
                          ? "bg-white/25 text-white"
                          : "bg-white/[0.055] text-white/70 hover:bg-white/[0.12] hover:text-white"
                  }`}
                >
                  {letra}
                </button>
              );
            })}
          </motion.div>
          <p className="mt-3 text-center text-[13px] font-bold leading-relaxed text-white/38">
            Arraste sobre a palavra ou toque na primeira e na última letra. Cada acerto revela o significado.
          </p>
        </div>

        <div className="space-y-3">
          <AnimatePresence mode="wait">
            {revelada ? (
              <motion.div
                key={revelada.word}
                initial={reduzido ? false : { opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduzido ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
                transition={spring.soft}
                className="relative overflow-hidden rounded-xl border border-mint/35 bg-mint/[0.09] p-4"
                aria-live="polite"
              >
                <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-mint/25 blur-2xl" />
                <p className="relative flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-mint">
                  <Sparkles className="h-3.5 w-3.5" />
                  Você achou
                </p>
                <p className="relative mt-1 font-display text-xl font-black tracking-wide">{revelada.word}</p>
                <p className="relative mt-2 text-[13px] font-bold leading-relaxed text-white/70">{revelada.meaning}</p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-white/35">Termos para encontrar</p>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-cyanGlow/70">
                {showPreviews ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {showPreviews ? "Visíveis" : "Ocultos"}
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {board.placements.map((item) => {
                const achada = found.includes(item);
                return (
                  <li key={item.word}>
                    <button
                      type="button"
                      disabled={!achada}
                      onClick={() => setRevelada(item)}
                      className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                        achada ? "bg-mint/10 hover:bg-mint/15" : "bg-white/[0.03]"
                      }`}
                    >
                      <span className={`flex items-center gap-2 font-black tracking-wide ${achada ? "text-mint" : "text-white/30"}`}>
                        {achada ? <Check className="h-4 w-4 shrink-0" /> : <Circle className="h-3 w-3 shrink-0" />}
                        <span className="min-w-0 truncate">{achada || showPreviews ? item.word : "•".repeat(item.word.length)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-mint/18 bg-mint/[0.035]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-mint/12 text-mint">
              <BookOpen className="h-[18px] w-[18px]" />
            </span>
            <div>
              <h3 className="font-display text-base font-black">Glossário descoberto</h3>
              <p className="text-[11px] font-semibold text-white/38">Toda palavra encontrada e sua definição ficam guardadas aqui.</p>
            </div>
          </div>
          <span className="rounded-full border border-mint/20 bg-mint/[0.08] px-3 py-1 text-[11px] font-black text-mint">
            {found.length} de {total}
          </span>
        </div>

        <div className="p-4 sm:p-5">
          <AnimatePresence initial={false} mode="popLayout">
            {!found.length ? (
              <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-3 text-center text-[13px] font-semibold text-white/35">
                Encontre a primeira palavra para abrir o glossário.
              </motion.p>
            ) : (
              <motion.div layout className="grid gap-3 sm:grid-cols-2">
                {found.map((item, index) => (
                  <motion.article
                    layout
                    key={item.word}
                    initial={reduzido ? false : { opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ ...spring.soft, delay: reduzido ? 0 : Math.min(index * 0.035, 0.14) }}
                    className="rounded-xl border border-mint/16 bg-black/20 p-4"
                  >
                    <p className="flex items-center gap-2 font-display text-sm font-black tracking-wide text-mint">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      {item.word}
                    </p>
                    <p className="mt-2 text-[12px] font-semibold leading-relaxed text-white/58">{item.meaning}</p>
                  </motion.article>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {completo ? null : (
        <div className="flex justify-center">
          <SecondaryButton icon={Check} onClick={() => finalizar(found)}>
            Encerrar e somar pontos
          </SecondaryButton>
        </div>
      )}
    </div>
  );
}

/** Torre de energia: cada erro apaga e danifica um andar. */
function HangmanFigure({ erros }: { erros: number }) {
  const reduzido = useSoftMotion();
  const energia = Math.max(0, 6 - erros);

  return (
    <div className={`code-tower-visual ${energia <= 2 ? "is-critical" : ""}`} role="img" aria-label={`Torre com ${energia} de 6 níveis de energia`}>
      <motion.span
        className="code-tower-orbit code-tower-orbit-a"
        aria-hidden="true"
        animate={reduzido ? undefined : { rotate: 360 }}
        transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
      />
      <motion.span
        className="code-tower-orbit code-tower-orbit-b"
        aria-hidden="true"
        animate={reduzido ? undefined : { rotate: -360 }}
        transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
      />
      <svg viewBox="0 0 180 220" aria-hidden="true">
        <defs>
          <linearGradient id="tower-shell" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1d1736" />
            <stop offset="0.55" stopColor="#090d18" />
            <stop offset="1" stopColor="#12192b" />
          </linearGradient>
          <linearGradient id="tower-energy" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#39F59A" />
            <stop offset="1" stopColor="#B99BFF" />
          </linearGradient>
          <filter id="tower-glow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <path d="M33 198 46 53 90 18l44 35 13 145Z" fill="url(#tower-shell)" stroke="rgba(185,155,255,.5)" strokeWidth="2" />
        <path d="M47 53 90 18l43 35" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="2" />
        <path d="M25 198h130" stroke="rgba(185,155,255,.42)" strokeWidth="3" strokeLinecap="round" />
        <path d="m68 198 4-22a18 18 0 0 1 36 0l4 22" fill="#070a12" stroke="rgba(57,245,154,.55)" strokeWidth="2" />
        {[0, 1, 2, 3, 4, 5].map((level) => {
          const active = level >= erros;
          return (
            <g key={level}>
              <rect x="58" y={151 - level * 21} width="64" height="13" rx="4" fill={active ? "url(#tower-energy)" : "rgba(251,113,133,.1)"} stroke={active ? "#C8B5FF" : "rgba(251,113,133,.65)"} opacity={active ? 1 : 0.34} filter={active ? "url(#tower-glow)" : undefined} />
              <path d={`M47 ${170 - level * 21}h86`} stroke={active ? "rgba(185,155,255,.3)" : "rgba(251,113,133,.12)"} />
            </g>
          );
        })}
        <motion.circle
          cx="90"
          cy="24"
          r="6"
          fill={energia ? "#FBBF24" : "#FB7185"}
          filter="url(#tower-glow)"
          animate={reduzido ? undefined : { opacity: [0.55, 1, 0.55], scale: [0.9, 1.15, 0.9] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </svg>
      <div className="code-tower-energy-readout" aria-hidden="true">
        <span>energia do selo</span>
        <strong>{energia}<small>/6</small></strong>
      </div>
    </div>
  );
}

function HangmanGame({
  words,
  recordKey,
  onFinish,
}: {
  words: HangmanItem[];
  recordKey: string;
  onFinish: (score: number, recorde: boolean, correctAnswers: number, answers: GameAnswer[]) => void;
}) {
  const [indice, setIndice] = useState(0);
  const [letras, setLetras] = useState<string[]>([]);
  const [pontos, setPontos] = useState(0);
  const [sequencia, setSequencia] = useState(0);
  const [resolvidas, setResolvidas] = useState(0);
  const encerrado = useRef(false);
  const answersRef = useRef<GameAnswer[]>([]);

  const atual = words[indice];
  const erradas = atual ? letras.filter((letra) => !atual.word.includes(letra)) : [];
  const erros = erradas.length;
  const venceu = atual ? atual.word.split("").every((letra) => letras.includes(letra)) : false;
  const perdeu = erros >= 6;

  useEffect(() => {
    function noTeclado(event: KeyboardEvent) {
      const letra = event.key.toUpperCase();
      if (/^[A-Z]$/.test(letra)) chutar(letra);
    }
    window.addEventListener("keydown", noTeclado);
    return () => window.removeEventListener("keydown", noTeclado);
  });

  function chutar(letra: string) {
    if (venceu || perdeu || letras.includes(letra)) return;
    setLetras((atuais) => [...atuais, letra]);
  }

  function avancar() {
    let novaPontuacao = pontos;
    let novaSequencia = sequencia;
    const answer: GameAnswer = {
      id: uid("answer"),
      prompt: atual.hint,
      userAnswer: venceu ? atual.word : letras.join(", ") || "Sem resposta",
      correctAnswer: atual.word,
      explanation: atual.hint,
      correct: venceu,
    };
    answersRef.current = [...answersRef.current, answer];
    if (venceu) {
      // Sobrou vida = valeu mais. Sequência multiplica.
      novaSequencia = sequencia + 1;
      novaPontuacao = pontos + (100 + (6 - erros) * 25) * Math.min(novaSequencia, 4);
      setPontos(novaPontuacao);
      setSequencia(novaSequencia);
      setResolvidas((valor) => valor + 1);
    } else {
      novaSequencia = 0;
      setSequencia(0);
    }
    if (indice + 1 >= words.length) {
      if (encerrado.current) return;
      encerrado.current = true;
      onFinish(novaPontuacao, saveRecord(recordKey, novaPontuacao), resolvidas + (venceu ? 1 : 0), answersRef.current);
      return;
    }
    setIndice(indice + 1);
    setLetras([]);
  }

  if (!atual) return null;

  return (
    <section className="code-tower-game space-y-5" aria-labelledby="code-tower-title">
      <header className="code-tower-heading">
        <div>
          <p>Protocolo arcano · setor {String(indice + 1).padStart(2, "0")}</p>
          <h2 id="code-tower-title">Torre dos Códigos</h2>
        </div>
        <span><Zap className="h-4 w-4" aria-hidden /> +5 XP ao decifrar</span>
      </header>
      <GameHud
        items={[
          { label: "Palavra", value: `${indice + 1}/${words.length}` },
          { label: "Pontos", value: String(pontos), tone: "bom" },
          { label: "Sequência", value: sequencia ? `${sequencia}x` : "—" },
          { label: "Energia", value: String(6 - erros), tone: 6 - erros <= 2 ? "alerta" : "normal" },
        ]}
      />

      <StoryJourney game="forca" successes={resolvidas + (venceu ? 1 : 0)} goal={words.length} />

      <div className="code-tower-stage">
        <div className="code-tower-chamber">
          <div className="code-tower-chamber-grid" aria-hidden="true" />
          <HangmanFigure erros={erros} />
          <div className="code-tower-floor-status">
            <span>{venceu ? "Selo aberto" : perdeu ? "Setor bloqueado" : "Decodificação ativa"}</span>
            <div>{[0, 1, 2, 3, 4, 5].map((level) => <i key={level} className={level < 6 - erros ? "is-on" : ""} />)}</div>
          </div>
        </div>
        <div className="code-tower-terminal">
          <div className="code-tower-terminal-bar">
            <span><Code2 className="h-4 w-4" aria-hidden /> arquivo_{String(indice + 1).padStart(2, "0")}.mnv</span>
            <span className="code-tower-terminal-live"><i /> ao vivo</span>
          </div>
          <div className="code-tower-hint">
            <span><Brain className="h-4 w-4" aria-hidden /> pista descriptografada</span>
            <p>{atual.hint}</p>
          </div>
          <div className="code-tower-word" aria-label={`Palavra com ${atual.word.length} letras`}>
            {atual.word.split("").map((letra, posicao) => {
              const revelada = letras.includes(letra) || perdeu;
              return (
                <span
                  key={`${letra}-${posicao}`}
                  className={`code-tower-letter ${
                    revelada
                      ? perdeu && !letras.includes(letra)
                        ? "is-lost"
                        : "is-revealed"
                      : ""
                  }`}
                >
                  {revelada ? letra : ""}
                </span>
              );
            })}
          </div>
          <div className="code-tower-terminal-foot">
            <span><Lock className="h-3.5 w-3.5" aria-hidden /> cifra alfabética</span>
            <span>{letras.length} letras testadas</span>
          </div>
        </div>
      </div>

      <div className="code-tower-keyboard" aria-label="Teclado da Torre dos Códigos">
        {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letra) => {
          const usada = letras.includes(letra);
          const naPalavra = atual.word.includes(letra);
          return (
            <motion.button
              key={letra}
              type="button"
              onClick={() => chutar(letra)}
              disabled={usada || venceu || perdeu}
              whileTap={{ scale: 0.9 }}
              transition={spring.snappy}
              className={`code-tower-key ${
                usada
                  ? naPalavra
                    ? "is-correct"
                    : "is-wrong"
                  : ""
              }`}
            >
              {letra}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {venceu || perdeu ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`code-tower-result ${venceu ? "is-success" : "is-failure"}`} role="status" aria-live="polite">
            <p className={`font-display text-2xl font-black ${venceu ? "text-mint" : "text-roseGlow"}`}>
              {venceu ? `Acertou! +${(100 + (6 - erros) * 25) * Math.min(sequencia + 1, 4)}` : `A palavra era ${atual.word}`}
            </p>
            <span>{venceu ? "+5 XP conquistados" : "0 XP nesta pergunta"}</span>
            <div className="mt-3">
              <PrimaryButton icon={ArrowRight} onClick={avancar}>
                {indice + 1 >= words.length ? "Ver resultado" : "Próxima palavra"}
              </PrimaryButton>
            </div>
          </motion.div>
        ) : (
          <p className="code-tower-help">Use o teclado físico ou o painel. Cada letra errada desliga um andar.</p>
        )}
      </AnimatePresence>
    </section>
  );
}

/**
 * Mine Runner — o jogo com bonequinho.
 *
 * O robozinho corre sozinho. A cada portal aparece uma afirmação da matéria:
 * pular passa pelo anel de cima (VERDADEIRO), continuar no chão passa pelo de
 * baixo (FALSO). Errou, perde uma vida das três.
 *
 * O laço roda em canvas com refs, não em estado do React: um `setState` por
 * quadro a 60fps derrubaria a interface inteira. O placar sobe para o React
 * umas 8 vezes por segundo, só para o HUD.
 */
const RUNNER_TUNING = {
  startSpeed: 2.45,
  maxSpeed: 5.1,
  rampFrames: 2_600,
  portalSpacing: 500,
  feedbackMs: 1_400,
};

function RunnerGame({
  items,
  recordKey,
  onFinish,
}: {
  items: TrueFalseItem[];
  recordKey: string;
  onFinish: (score: number, recorde: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hud, setHud] = useState({ pontos: 0, vidas: 3, combo: 0, acertos: 0 });
  const [frase, setFrase] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; bom: boolean } | null>(null);
  const [recado, setRecado] = useState("A centelha partiu. Escolha os portais certos para chegar à cidade.");
  const encerrado = useRef(false);
  const pularRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const L = 900; // largura lógica; o canvas escala por CSS
    const A = 340;
    const CHAO = A - 58;
    const GRAVIDADE = 0.62;
    const IMPULSO = -12.4;
    const ALTURA_ANEL = CHAO - 92; // centro do anel de cima

    const jogo = {
      t: 0,
      velocidade: RUNNER_TUNING.startSpeed,
      pontos: 0,
      vidas: 3,
      combo: 0,
      acertos: 0,
      rodando: true,
      tremor: 0,
      indiceFrase: 0,
    };
    const heroi = { x: 150, y: CHAO, vy: 0, noChao: true, giro: 0 };
    type Portal = { x: number; item: TrueFalseItem; respondido: boolean; acertou?: boolean };
    const portais: Portal[] = [];
    const faiscas: Array<{ x: number; y: number; vx: number; vy: number; vida: number; cor: string }> = [];
    const morros = Array.from({ length: 14 }, (_, i) => ({ x: i * 90, h: 24 + Math.random() * 46 }));

    function novoPortal() {
      const item = items[jogo.indiceFrase % items.length];
      jogo.indiceFrase += 1;
      portais.push({ x: L + 120, item, respondido: false });
    }
    novoPortal();

    function pular() {
      if (!jogo.rodando) return;
      if (heroi.noChao) {
        heroi.vy = IMPULSO;
        heroi.noChao = false;
      }
    }
    pularRef.current = pular;

    function explodir(x: number, y: number, cor: string) {
      for (let i = 0; i < 14; i += 1) {
        faiscas.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6 - 1.5,
          vida: 1,
          cor,
        });
      }
    }

    function encerrar() {
      if (encerrado.current) return;
      encerrado.current = true;
      jogo.rodando = false;
      onFinish(jogo.pontos, saveRecord(recordKey, jogo.pontos));
    }

    let ultimoHud = 0;
    let raf = 0;

    function desenharHeroi(x: number, y: number) {
      const pisada = heroi.noChao ? Math.sin(jogo.t * 0.35) * 4 : 0;
      ctx!.save();
      ctx!.translate(x, y);
      ctx!.rotate(heroi.giro);

      // pernas
      ctx!.strokeStyle = "#0f766e";
      ctx!.lineWidth = 5;
      ctx!.lineCap = "round";
      ctx!.beginPath();
      ctx!.moveTo(-7, 16);
      ctx!.lineTo(-7 + pisada, 27);
      ctx!.moveTo(7, 16);
      ctx!.lineTo(7 - pisada, 27);
      ctx!.stroke();

      // corpo
      ctx!.fillStyle = "#34D399";
      ctx!.beginPath();
      ctx!.roundRect(-16, -16, 32, 34, 10);
      ctx!.fill();

      // visor
      ctx!.fillStyle = "#04241c";
      ctx!.beginPath();
      ctx!.roundRect(-11, -9, 22, 14, 6);
      ctx!.fill();

      // olhos
      ctx!.fillStyle = "#7CFFCB";
      ctx!.beginPath();
      ctx!.arc(-4.5, -2, 2.6, 0, Math.PI * 2);
      ctx!.arc(4.5, -2, 2.6, 0, Math.PI * 2);
      ctx!.fill();

      // capelo de formatura
      ctx!.fillStyle = "#0b0b0f";
      ctx!.beginPath();
      ctx!.moveTo(-19, -18);
      ctx!.lineTo(19, -18);
      ctx!.lineTo(0, -27);
      ctx!.closePath();
      ctx!.fill();
      ctx!.fillRect(-9, -18, 18, 4);
      ctx!.strokeStyle = "#FBBF24";
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(14, -22);
      ctx!.lineTo(19, -13 + Math.sin(jogo.t * 0.2) * 2);
      ctx!.stroke();

      ctx!.restore();
    }

    function quadro() {
      if (!jogo.rodando) return;
      jogo.t += 1;
      jogo.velocidade = Math.min(
        RUNNER_TUNING.startSpeed + jogo.t / RUNNER_TUNING.rampFrames,
        RUNNER_TUNING.maxSpeed,
      );

      // física do herói
      heroi.vy += GRAVIDADE;
      heroi.y += heroi.vy;
      if (heroi.y >= CHAO) {
        heroi.y = CHAO;
        heroi.vy = 0;
        heroi.noChao = true;
        heroi.giro = 0;
      } else {
        heroi.giro = Math.max(-0.35, Math.min(0.35, heroi.vy * 0.02));
      }

      // portais
      for (const portal of portais) {
        portal.x -= jogo.velocidade;
        if (!portal.respondido && portal.x <= heroi.x) {
          portal.respondido = true;
          // Passou por cima do meio? Escolheu VERDADEIRO.
          const escolha = heroi.y < CHAO - 46;
          const certo = escolha === portal.item.answer;
          portal.acertou = certo;
          if (certo) {
            jogo.combo += 1;
            jogo.acertos += 1;
            const ganho = 50 * Math.min(jogo.combo, 5);
            jogo.pontos += ganho;
            explodir(heroi.x, heroi.y, "#34D399");
            setAviso({ texto: `+${ganho}`, bom: true });
            setRecado(jogo.acertos % 3 === 0 ? "Nova região alcançada. A cidade está mais perto." : "Portal estabilizado. A centelha ficou mais forte.");
            if (jogo.acertos >= 12) {
              jogo.pontos += 500;
              encerrar();
              return;
            }
          } else {
            jogo.combo = 0;
            jogo.vidas -= 1;
            jogo.tremor = 14;
            explodir(heroi.x, heroi.y, "#FB7185");
            setAviso({ texto: portal.item.answer ? "Era verdadeiro" : "Era falso", bom: false });
            setRecado(portal.item.explanation || "A Mine recalculou a rota. Continue.");
            if (jogo.vidas <= 0) {
              encerrar();
              return;
            }
          }
          window.setTimeout(() => setAviso(null), RUNNER_TUNING.feedbackMs);
        }
      }
      while (portais.length && portais[0].x < -160) portais.shift();
      if (portais.length && portais[portais.length - 1].x < L - RUNNER_TUNING.portalSpacing) novoPortal();

      // faíscas
      for (const faisca of faiscas) {
        faisca.x += faisca.vx;
        faisca.y += faisca.vy;
        faisca.vy += 0.22;
        faisca.vida -= 0.026;
      }
      for (let i = faiscas.length - 1; i >= 0; i -= 1) if (faiscas[i].vida <= 0) faiscas.splice(i, 1);

      // ---------- desenho ----------
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      const abalo = jogo.tremor > 0 ? (Math.random() - 0.5) * jogo.tremor : 0;
      if (jogo.tremor > 0) jogo.tremor -= 1;
      ctx!.clearRect(0, 0, L, A);
      ctx!.translate(abalo, abalo * 0.5);

      // céu
      const fase = Math.min(3, Math.floor(jogo.acertos / 3));
      const ceus = [["#08131a", "#05211c"], ["#071827", "#073329"], ["#18142e", "#082f2a"], ["#23172f", "#124638"]];
      const ceu = ctx!.createLinearGradient(0, 0, 0, A);
      ceu.addColorStop(0, ceus[fase][0]);
      ceu.addColorStop(1, ceus[fase][1]);
      ctx!.fillStyle = ceu;
      ctx!.fillRect(-20, -20, L + 40, A + 40);

      // morros ao fundo
      ctx!.fillStyle = "rgba(52,211,153,.10)";
      for (const morro of morros) {
        morro.x -= jogo.velocidade * 0.25;
        if (morro.x < -110) morro.x += 14 * 90;
        ctx!.beginPath();
        ctx!.moveTo(morro.x - 60, CHAO + 26);
        ctx!.quadraticCurveTo(morro.x, CHAO + 26 - morro.h, morro.x + 60, CHAO + 26);
        ctx!.fill();
      }

      // chão
      ctx!.fillStyle = "rgba(255,255,255,.05)";
      ctx!.fillRect(-20, CHAO + 26, L + 40, A);
      ctx!.strokeStyle = "rgba(52,211,153,.45)";
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(-20, CHAO + 26);
      ctx!.lineTo(L + 20, CHAO + 26);
      ctx!.stroke();
      // marcações correndo, para dar sensação de velocidade
      ctx!.strokeStyle = "rgba(52,211,153,.18)";
      ctx!.lineWidth = 3;
      for (let i = 0; i < 24; i += 1) {
        const x = ((i * 60 - jogo.t * jogo.velocidade) % (L + 120)) - 60;
        ctx!.beginPath();
        ctx!.moveTo(x, CHAO + 40);
        ctx!.lineTo(x + 26, CHAO + 40);
        ctx!.stroke();
      }

      // portais
      for (const portal of portais) {
        const cor = portal.respondido ? (portal.acertou ? "#34D399" : "#FB7185") : "rgba(255,255,255,.55)";
        ctx!.strokeStyle = cor;
        ctx!.lineWidth = 4;
        // anel de cima = VERDADEIRO
        ctx!.beginPath();
        ctx!.ellipse(portal.x, ALTURA_ANEL, 20, 40, 0, 0, Math.PI * 2);
        ctx!.stroke();
        // anel de baixo = FALSO
        ctx!.beginPath();
        ctx!.ellipse(portal.x, CHAO + 2, 20, 34, 0, 0, Math.PI * 2);
        ctx!.stroke();

        ctx!.fillStyle = cor;
        ctx!.font = "900 19px 'Space Grotesk', system-ui, sans-serif";
        ctx!.textAlign = "center";
        ctx!.fillText("V", portal.x, ALTURA_ANEL + 7);
        ctx!.fillText("F", portal.x, CHAO + 9);
      }

      // faíscas
      for (const faisca of faiscas) {
        ctx!.globalAlpha = Math.max(0, faisca.vida);
        ctx!.fillStyle = faisca.cor;
        ctx!.fillRect(faisca.x, faisca.y, 4, 4);
      }
      ctx!.globalAlpha = 1;

      desenharHeroi(heroi.x, heroi.y);

      // HUD do React, no máximo ~8x por segundo
      if (jogo.t - ultimoHud > 7) {
        ultimoHud = jogo.t;
        setHud({ pontos: jogo.pontos, vidas: jogo.vidas, combo: jogo.combo, acertos: jogo.acertos });
        const proximo = portais.find((portal) => !portal.respondido);
        setFrase(proximo ? proximo.item.statement : "");
      }

      raf = requestAnimationFrame(quadro);
    }

    raf = requestAnimationFrame(quadro);

    function noTeclado(event: KeyboardEvent) {
      if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") {
        event.preventDefault();
        pular();
      }
    }
    window.addEventListener("keydown", noTeclado);

    return () => {
      jogo.rodando = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", noTeclado);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <GameHud
        items={[
          { label: "Pontos", value: String(hud.pontos), tone: "bom" },
          { label: "Vidas", value: "♥".repeat(Math.max(0, hud.vidas)) || "—", tone: hud.vidas <= 1 ? "alerta" : "normal" },
          { label: "Combo", value: hud.combo ? `${hud.combo}x` : "—" },
        ]}
      />

      <StoryJourney game="runner" successes={hud.acertos} goal={12} />

      <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-black/40">
        <div className="flex min-h-[4.5rem] items-center justify-center border-b border-white/10 px-5 py-3 text-center">
          <p className="font-display text-lg font-black leading-snug sm:text-xl">{frase || "Prepare-se..."}</p>
        </div>
        <canvas
          ref={canvasRef}
          width={900}
          height={340}
          onPointerDown={() => pularRef.current()}
          className="block w-full cursor-pointer touch-none"
          aria-label="Mine Runner. Espaço ou toque para pular."
        />
        <AnimatePresence>
          {aviso ? (
            <motion.p
              initial={{ opacity: 0, y: 14, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-4xl font-black ${
                aviso.bom ? "text-mint" : "text-roseGlow"
              }`}
            >
              {aviso.texto}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      <p className="border-l-2 border-mint/45 bg-mint/[0.05] px-4 py-2 text-[13px] font-bold leading-relaxed text-white/55">{recado}</p>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[13px] font-bold text-white/45">
        <span>
          <span className="text-mint">Pule</span> para passar pelo anel <span className="text-mint">V</span>
        </span>
        <span>
          <span className="text-roseGlow">Fique no chão</span> para o anel <span className="text-roseGlow">F</span>
        </span>
        <span className="text-white/30">Espaço, seta ↑ ou toque na tela</span>
      </div>
    </div>
  );
}

/**
 * Games com a Mine: o conteúdo de cada partida sai dos materiais que o usuário
 * cadastrou na matéria, então não é trivia genérica — é a matéria dele.
 */
/**
 * Tela de instruções, entre escolher o jogo e jogar.
 *
 * Ela ocupa o tempo que a Mine leva escrevendo a partida — que existia de
 * qualquer jeito e antes era só um spinner. O botão de começar só acende
 * quando o conteúdo chega, então ninguém entra numa partida vazia.
 */
function LegacyGameIntro({
  jogo,
  materia,
  pronto,
  recorde,
  onStart,
  onBack,
}: {
  jogo: (typeof gameCatalog)[number];
  materia: string;
  pronto: boolean;
  recorde: number;
  onStart: () => void;
  onBack: () => void;
}) {
  const reduzido = useSoftMotion();
  const Icon = jogo.icon;

  return (
    <Reveal>
      <GlassCard>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-black shadow-glowSoft"
            style={{ backgroundColor: jogo.accent }}
          >
            <Icon className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.18em]" style={{ color: jogo.accent }}>
              Como se joga
            </p>
            <h2 className="font-display text-xl font-black leading-tight sm:text-2xl">{jogo.name}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-white/50">{jogo.tagline}</p>
          </div>
        </div>

        <ol className="mt-6 grid gap-2.5">
          {jogo.howTo.map((passo, index) => (
            <motion.li
              key={passo}
              initial={reduzido ? false : { opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reduzido ? 0 : index * 0.07, ease: ease.out }}
              className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 sm:p-3.5"
            >
              <span
                className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-black text-black"
                style={{ backgroundColor: jogo.accent }}
              >
                {index + 1}
              </span>
              <span className="min-w-0 text-[13px] font-bold leading-relaxed text-white/72 sm:text-sm">{passo}</span>
            </motion.li>
          ))}
        </ol>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-mint/25 bg-mint/[0.07] p-3.5">
          <Target className="h-4 w-4 shrink-0 text-mint" />
          <p className="min-w-0 flex-1 text-[13px] font-bold leading-relaxed text-white/72">
            <span className="text-mint">Objetivo:</span> {jogo.goal}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-bold text-white/42">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5">
            <Bot className="h-3.5 w-3.5 text-mint" />
            Perguntas novas a cada partida, escritas pela Mine
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-300" />
            Cada acerto rende +{xpPerAction.game} XP
          </span>
          {recorde ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-300" />
              Seu recorde: {recorde}
            </span>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onStart}
            disabled={!pronto}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-mint to-mintDeep px-6 py-3.5 font-black text-black shadow-glowSoft transition-control duration-control hover:shadow-glow disabled:cursor-wait disabled:opacity-50 disabled:shadow-none"
          >
            {pronto ? (
              <>
                <Play className="h-[18px] w-[18px]" />
                Começar
              </>
            ) : (
              <>
                <Loader2 className="h-[18px] w-[18px] animate-spin" />
                A Mine está montando a partida...
              </>
            )}
          </button>
          <SecondaryButton icon={X} onClick={onBack}>
            Escolher outro jogo
          </SecondaryButton>
          {!pronto ? (
            <p className="text-[12px] font-bold text-white/35 sm:ml-1">
              Aproveite para ler as regras — {materia ? `estamos usando os conteúdos de ${materia}` : "já já começa"}.
            </p>
          ) : null}
        </div>
      </GlassCard>
    </Reveal>
  );
}

function GameIntro({
  jogo,
  materia,
  questionCount,
  pronto,
  recorde,
  onStart,
  onBack,
}: {
  jogo: (typeof gameCatalog)[number];
  materia: string;
  questionCount: GameQuestionCount;
  pronto: boolean;
  recorde: number;
  onStart: () => void;
  onBack: () => void;
}) {
  const reduzido = useSoftMotion();
  const Icon = jogo.icon;
  const accentStyle = {
    "--game-accent": jogo.accent,
    "--game-accent-soft": `${jogo.accent}24`,
    "--game-accent-faint": `${jogo.accent}0d`,
  } as React.CSSProperties;

  return (
    <Reveal>
      <article className="game-intro-shell relative isolate overflow-hidden rounded-[1.65rem] border border-white/[0.1] bg-[#101714]" style={accentStyle}>
        <div className="game-intro-aura pointer-events-none absolute inset-0" aria-hidden="true" />

        <div className="relative grid lg:grid-cols-[minmax(17rem,.82fr)_minmax(0,1.18fr)]">
          <section className="flex min-w-0 flex-col border-b border-white/[0.08] p-5 sm:p-7 lg:border-b-0 lg:border-r lg:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="game-intro-emblem relative grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center rounded-[1.35rem] text-black sm:h-20 sm:w-20" aria-hidden="true">
                <Icon className="relative z-10 h-8 w-8 sm:h-9 sm:w-9" />
              </div>
              <span
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-black/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] text-white/55"
                aria-live="polite"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${pronto ? "bg-mint shadow-[0_0_10px_#39F59A]" : "animate-pulse bg-white/45"}`} />
                {pronto ? "Partida pronta" : "Mine preparando"}
              </span>
            </div>

            <div className="mt-7">
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-[var(--game-accent)]">Briefing da missão</p>
              <h2 className="mt-2 max-w-[13ch] font-display text-[2rem] font-black leading-[.98] tracking-[-.045em] text-white sm:text-[2.55rem]">
                {jogo.name}
              </h2>
              <p className="mt-3 max-w-md text-[13px] font-semibold leading-relaxed text-white/50 sm:text-sm">{jogo.tagline}</p>
            </div>

            <div className="mt-7 border-l-2 border-[var(--game-accent)] pl-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-white/40">
                <Target className="h-3.5 w-3.5 text-[var(--game-accent)]" />
                Sua missão
              </div>
              <p className="mt-2 text-[14px] font-extrabold leading-relaxed text-white/85">{jogo.goal}</p>
            </div>

            <div className="mt-6 border-t border-white/[0.08] pt-5">
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-white/35">Regra principal</p>
              <p className="mt-2 text-[13px] font-semibold leading-relaxed text-white/62">{jogo.rule}</p>
            </div>

            <div className="mt-auto grid grid-cols-3 gap-2 pt-7">
              <div className="game-intro-stat">
                <Bot className="h-4 w-4 text-[var(--game-accent)]" />
                <span>Perguntas</span>
                <strong>{questionCount}</strong>
              </div>
              <div className="game-intro-stat">
                <Zap className="h-4 w-4 text-amber-300" />
                <span>Prêmio</span>
                <strong>+{xpPerAction.game} XP/acerto</strong>
              </div>
              <div className="game-intro-stat">
                <Trophy className="h-4 w-4 text-amber-300" />
                <span>Recorde</span>
                <strong>{recorde || "—"}</strong>
              </div>
            </div>
          </section>

          <section className="min-w-0 p-5 sm:p-7 lg:p-8">
            <div className="flex items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.2em] text-[var(--game-accent)]">Como jogar</p>
                <h3 className="mt-1 font-display text-xl font-black tracking-[-.025em] sm:text-2xl">Entenda em poucos passos</h3>
              </div>
              <span className="shrink-0 font-display text-3xl font-black tabular text-white/[0.12]">0{jogo.howTo.length}</span>
            </div>

            <ol className="game-intro-route relative mt-2">
              {jogo.howTo.map((passo, index) => (
                <motion.li
                  key={passo}
                  initial={reduzido ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduzido ? 0 : 0.08 + index * 0.055, ease: ease.out }}
                  className="game-intro-step relative grid grid-cols-[2.7rem_minmax(0,1fr)] gap-3 border-b border-white/[0.065] py-4 last:border-b-0 sm:grid-cols-[3.15rem_minmax(0,1fr)] sm:gap-4"
                >
                  <span className="game-intro-step-number relative z-10 grid h-8 w-8 place-items-center rounded-full text-[11px] font-black sm:h-9 sm:w-9">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[9px] font-black uppercase tracking-[.17em] text-white/30">
                      {index === 0 ? "Primeiro" : index === jogo.howTo.length - 1 ? "Para concluir" : "Depois"}
                    </p>
                    <p className="mt-1 text-[13px] font-bold leading-relaxed text-white/74 sm:text-sm">{passo}</p>
                  </div>
                </motion.li>
              ))}
            </ol>
          </section>
        </div>

        <div className="relative flex flex-col gap-3 border-t border-white/[0.09] bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-5">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/35">Matéria selecionada</p>
            <p className="mt-0.5 truncate text-sm font-black text-white/75">{materia || "Conteúdo geral"}</p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-5 text-[13px] font-black text-white/55 transition-control duration-control hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
              Outros jogos
            </button>
            <button
              type="button"
              onClick={onStart}
              disabled={!pronto}
              className="game-intro-play inline-flex min-h-12 min-w-[13rem] items-center justify-center gap-2 rounded-xl px-6 text-sm font-black text-black transition-control duration-control hover:-translate-y-0.5 disabled:cursor-wait disabled:translate-y-0 disabled:opacity-55"
            >
              {pronto ? (
                <>
                  Jogar agora
                  <Play className="h-[18px] w-[18px] fill-current" />
                </>
              ) : (
                <>
                  <Loader2 className="h-[18px] w-[18px] animate-spin" />
                  Criando partida...
                </>
              )}
            </button>
          </div>
        </div>
      </article>
    </Reveal>
  );
}

type GameQuestionCount = 4 | 6 | 8;

function GameSetup({
  gameName,
  isWordSearch,
  count,
  showPreviews,
  subject,
  onCountChange,
  onPreviewChange,
  onConfirm,
  onBack,
}: {
  gameName: string;
  isWordSearch: boolean;
  count: GameQuestionCount;
  showPreviews: boolean;
  subject: string;
  onCountChange: (count: GameQuestionCount) => void;
  onPreviewChange: (show: boolean) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const reduzido = useSoftMotion();

  return (
    <Reveal>
      <article className="relative isolate overflow-hidden rounded-[1.65rem] border border-cyanGlow/20 bg-[#101917] p-5 sm:p-7 lg:p-9">
        <div className="pointer-events-none absolute -right-32 -top-40 h-96 w-96 rounded-full bg-cyanGlow/10 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-4xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-cyanGlow text-black shadow-[0_18px_38px_-20px_#45DFFF]">
                <Gamepad2 className="h-7 w-7" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.2em] text-cyanGlow">Preparar partida</p>
                <h2 className="mt-1 font-display text-2xl font-black tracking-[-.03em] sm:text-3xl">Configure {gameName}</h2>
                <p className="mt-1 text-[13px] font-semibold text-white/48">A Mine criará perguntas novas usando {subject || "a matéria escolhida"}.</p>
              </div>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.09] bg-black/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] text-white/45">
              <Bot className="h-3.5 w-3.5 text-cyanGlow" />
              Conteúdo novo
            </span>
          </div>

          <div className={`mt-8 grid gap-4 ${isWordSearch ? "lg:grid-cols-2" : "mx-auto max-w-xl"}`}>
            <section className="rounded-2xl border border-white/[0.09] bg-black/20 p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyanGlow/12 text-cyanGlow">
                  <Layers className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-black">Quantas perguntas?</h3>
                  <p className="mt-0.5 text-[12px] font-semibold leading-relaxed text-white/42">Escolha o tamanho da partida. Cada acerto vale 5 XP e cada erro vale 0 XP.</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Quantidade de perguntas">
                {([4, 6, 8] as GameQuestionCount[]).map((option) => {
                  const selected = option === count;
                  return (
                    <motion.button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onCountChange(option)}
                      whileTap={reduzido ? undefined : { scale: 0.96 }}
                      className={`relative min-h-20 overflow-hidden rounded-xl border px-3 py-3 text-center transition-colors duration-control ${
                        selected ? "border-cyanGlow/55 bg-cyanGlow/13 text-cyanGlow" : "border-white/[0.08] bg-white/[0.025] text-white/45 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      {selected ? <motion.span layoutId="word-count" className="absolute inset-x-3 bottom-0 h-0.5 bg-cyanGlow" /> : null}
                      <span className="block font-display text-2xl font-black tabular">{option}</span>
                      <span className="mt-0.5 block text-[9px] font-black uppercase tracking-[.14em]">perguntas</span>
                    </motion.button>
                  );
                })}
              </div>
            </section>

            {isWordSearch ? <section className="rounded-2xl border border-white/[0.09] bg-black/20 p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyanGlow/12 text-cyanGlow">
                  {showPreviews ? <Eye className="h-[18px] w-[18px]" /> : <EyeOff className="h-[18px] w-[18px]" />}
                </span>
                <div>
                  <h3 className="font-display text-lg font-black">Prévia das palavras</h3>
                  <p className="mt-0.5 text-[12px] font-semibold leading-relaxed text-white/42">Escolha se a lista mostra os termos antes de você encontrá-los.</p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={showPreviews}
                onClick={() => onPreviewChange(!showPreviews)}
                className={`mt-5 flex min-h-20 w-full items-center justify-between gap-4 rounded-xl border px-4 text-left transition-colors duration-control ${
                  showPreviews ? "border-cyanGlow/35 bg-cyanGlow/[0.08]" : "border-white/[0.08] bg-white/[0.025]"
                }`}
              >
                <span>
                  <span className={`block text-sm font-black ${showPreviews ? "text-cyanGlow" : "text-white/70"}`}>{showPreviews ? "Palavras visíveis" : "Palavras escondidas"}</span>
                  <span className="mt-1 block text-[11px] font-semibold text-white/35">As definições sempre aparecem depois do acerto.</span>
                </span>
                <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-control ${showPreviews ? "bg-cyanGlow" : "bg-white/12"}`}>
                  <motion.span
                    className={`absolute top-1 h-5 w-5 rounded-full ${showPreviews ? "bg-black" : "bg-white"}`}
                    animate={{ left: showPreviews ? 24 : 4 }}
                    transition={reduzido ? { duration: 0 } : spring.snappy}
                  />
                </span>
              </button>
            </section> : null}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-white/[0.08] pt-5 sm:flex-row sm:items-center sm:justify-end">
            <button type="button" onClick={onBack} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-5 text-[13px] font-black text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white">
              <ChevronLeft className="h-4 w-4" />
              Outros jogos
            </button>
            <button type="button" onClick={onConfirm} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyanGlow px-6 text-sm font-black text-black shadow-[0_18px_36px_-20px_#45DFFF] transition-transform hover:-translate-y-0.5">
              Criar com {count} perguntas
              <ArrowRight className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </article>
    </Reveal>
  );
}

type GamesHubTab = "jogar" | "diario" | "missoes" | "erros" | "historico" | "temporada";

const gamesHubTabs: Array<{ id: GamesHubTab; label: string; icon: LucideIcon }> = [
  { id: "jogar", label: "Jogar", icon: Gamepad2 },
  { id: "diario", label: "Desafio", icon: CalendarCheck },
  { id: "missoes", label: "Missões", icon: Target },
  { id: "erros", label: "Erros", icon: BookOpen },
  { id: "historico", label: "Histórico", icon: ListChecks },
  { id: "temporada", label: "Liga", icon: Trophy },
];

function GamesHubNav({ active, onChange, errorCount }: { active: GamesHubTab; onChange: (tab: GamesHubTab) => void; errorCount: number }) {
  return (
    <nav aria-label="Áreas dos jogos" className="mb-5 overflow-x-auto rounded-2xl border border-white/10 bg-black/25 p-1.5">
      <div className="flex min-w-max gap-1">
        {gamesHubTabs.map((tab) => {
          const activeTab = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={activeTab ? "page" : undefined}
              onClick={() => onChange(tab.id)}
              className={`relative inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[12px] font-black transition-colors ${activeTab ? "bg-mint text-black shadow-glowSoft" : "text-white/48 hover:bg-white/[0.06] hover:text-white"}`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.id === "erros" && errorCount > 0 ? <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${activeTab ? "bg-black/15" : "bg-roseGlow/18 text-roseGlow"}`}>{errorCount}</span> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function formatGameDuration(durationMs?: number) {
  const seconds = Math.max(0, Math.round(Number(durationMs || 0) / 1000));
  if (!seconds) return "—";
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}min ${seconds % 60}s`;
}

function DailyChallengePanel({ data, user, update }: { data: ReturnType<typeof useMemoUserData>; user: User; update: (next: (draft: AppData) => AppData) => void }) {
  const key = dailyChallengeKey();
  const previous = data.sessions.find((session) => session.kind === "Games" && session.dailyChallenge && session.dailyKey === key);
  const questions = useMemo(() => dailyChallengeQuestions(Date.now(), 5), [key]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<GameAnswer[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [complete, setComplete] = useState<Session | null>(previous || null);
  const current = questions[index];

  function choose(option: string) {
    if (!current || selected || complete) return;
    setSelected(option);
  }

  function advance() {
    if (!current || !selected || complete) return;
    const correct = selected === current.answer;
    const nextAnswer: GameAnswer = {
      id: `answer_daily_${key}_${current.id}_${user.id}`,
      prompt: current.prompt,
      userAnswer: selected,
      correctAnswer: current.answer,
      explanation: current.explanation,
      correct,
    };
    const nextAnswers = [...answers, nextAnswer];
    if (index < questions.length - 1) {
      setAnswers(nextAnswers);
      setIndex((value) => value + 1);
      setSelected(null);
      return;
    }
    const correctAnswers = nextAnswers.filter((answer) => answer.correct).length;
    const now = Date.now();
    const session: Session = {
      id: uid("session"),
      userId: user.id,
      subjectId: "daily-general",
      title: `Desafio diário: ${correctAnswers}/5 acertos`,
      kind: "Games",
      createdAt: now,
      xpEarned: gameXpFromCorrectAnswers(correctAnswers),
      correctAnswers,
      questionsAnswered: questions.length,
      gameId: "daily",
      gameName: "Desafio diário",
      score: correctAnswers * 100,
      durationMs: now - startedAt,
      answers: nextAnswers,
      accuracy: correctAnswers / questions.length,
      seasonId: currentSeason(now).id,
      dailyChallenge: true,
      dailyKey: key,
      mode: "daily",
    };
    setAnswers(nextAnswers);
    setComplete(session);
    update((draft) => {
      const alreadyExists = draft.sessions.some((item) => item.userId === user.id && item.kind === "Games" && item.dailyChallenge && item.dailyKey === key);
      return alreadyExists ? draft : { ...draft, sessions: [...draft.sessions, session] };
    });
  }

  if (complete) {
    const correct = Number(complete.correctAnswers || 0);
    return (
      <HeroCard>
        <div className="grid gap-6 py-2 text-center sm:grid-cols-[1fr_auto] sm:text-left">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-mint">Desafio de hoje concluído</p>
            <h2 className="mt-2 font-display text-3xl font-black">{correct}/5 respostas corretas</h2>
            <p className="mt-2 text-sm font-bold text-white/52">Você ganhou +{gameXpFromCorrectAnswers(correct)} XP. Amanhã haverá uma combinação nova e igual para toda a comunidade.</p>
            <p className="mt-3 text-xs font-bold text-white/35">Veja sua posição em Ranking → Desafio. Em caso de empate, o menor tempo vence.</p>
          </div>
          <div className="grid h-28 w-28 place-items-center rounded-full border border-mint/35 bg-mint/10 shadow-glowSoft">
            <div><p className="font-display text-3xl font-black text-mint">{correct * 100}</p><p className="text-[9px] font-black uppercase tracking-[.16em] text-white/38">pontos</p></div>
          </div>
        </div>
      </HeroCard>
    );
  }

  return (
    <GlassCard>
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-mint">Mesmo desafio, mesma regra</p><h2 className="mt-1 font-display text-2xl font-black">Questão {index + 1} de {questions.length}</h2></div>
        <span className="rounded-full bg-mint/12 px-3 py-1 text-[11px] font-black text-mint">+5 XP por acerto</span>
      </div>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-mint transition-all" style={{ width: `${((index + (selected ? 1 : 0)) / questions.length) * 100}%` }} /></div>
      <p className="mt-6 font-display text-xl font-black leading-snug sm:text-2xl">{current?.prompt}</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {current?.options.map((option) => {
          const chosen = selected === option;
          const reveal = Boolean(selected);
          const correct = option === current.answer;
          return <button key={option} type="button" disabled={reveal} onClick={() => choose(option)} className={`rounded-xl border p-4 text-left text-sm font-black transition ${reveal && correct ? "border-mint bg-mint/12 text-mint" : reveal && chosen ? "border-roseGlow bg-roseGlow/10 text-roseGlow" : "border-white/10 bg-white/[0.04] text-white/72 hover:border-mint/35 hover:bg-mint/[0.06]"}`}>{option}</button>;
        })}
      </div>
      {selected ? <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4"><p className="text-sm font-bold leading-relaxed text-white/62">{current?.explanation}</p><div className="mt-3"><PrimaryButton icon={index === questions.length - 1 ? Trophy : ArrowRight} onClick={advance}>{index === questions.length - 1 ? "Concluir desafio" : "Próxima questão"}</PrimaryButton></div></div> : null}
    </GlassCard>
  );
}

function GameMissionsPanel({ sessions }: { sessions: Session[] }) {
  const missions = dailyMissionProgress(sessions);
  const completed = missions.filter((mission) => mission.completed).length;
  return (
    <div className="grid gap-4">
      <HeroCard><p className="text-[10px] font-black uppercase tracking-[.2em] text-mint">Renova à meia-noite</p><h2 className="mt-1 font-display text-3xl font-black">{completed}/{missions.length} missões cumpridas</h2><p className="mt-2 text-sm font-bold text-white/48">As recompensas entram automaticamente nos pontos da temporada. Elas nunca adicionam XP.</p></HeroCard>
      <div className="grid gap-3 md:grid-cols-2">
        {missions.map((mission) => <GlassCard key={mission.id}>
          <div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${mission.completed ? "bg-mint text-black" : "bg-white/[0.07] text-white/35"}`}>{mission.completed ? <Check className="h-5 w-5" /> : <Target className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><p className="font-display text-lg font-black">{mission.title}</p><p className="text-[12px] font-bold text-white/42">{mission.description}</p></div><span className="shrink-0 rounded-full bg-amber-300/12 px-2 py-1 text-[10px] font-black text-amber-300">+{mission.reward} PTS</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-mint" style={{ width: `${Math.min(100, (mission.current / mission.goal) * 100)}%` }} /></div><p className="mt-1.5 text-right text-[10px] font-black text-white/35">{mission.current}/{mission.goal}</p></div></div>
        </GlassCard>)}
      </div>
    </div>
  );
}

function GameErrorsPanel({ data, user, update }: { data: ReturnType<typeof useMemoUserData>; user: User; update: (next: (draft: AppData) => AppData) => void }) {
  const errors = unresolvedGameErrors(data.sessions);
  function review(answer: GameAnswer) {
    update((draft) => ({ ...draft, sessions: [...draft.sessions, { id: uid("session"), userId: user.id, subjectId: answer.subjectId || "games", title: `Erro revisado: ${answer.prompt}`, kind: "GameReview", createdAt: Date.now(), reviewedErrorIds: [answer.id], reviewCount: 1, mode: "review" }] }));
  }
  if (!errors.length) return <GlassCard><EmptyState icon={CheckCircle2} title="Caderno em dia" text="Quando você errar uma pergunta, ela aparecerá aqui com a resposta correta e a explicação." /></GlassCard>;
  return <div className="grid gap-3">{errors.map((answer) => <GlassCard key={answer.id}>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.16em] text-roseGlow">{answer.gameName || "Jogo"} · {new Date(answer.createdAt || 0).toLocaleDateString("pt-BR")}</p><h3 className="mt-1 font-display text-lg font-black leading-snug">{answer.prompt}</h3><div className="mt-3 grid gap-2 text-[13px] font-bold sm:grid-cols-2"><p className="rounded-xl bg-roseGlow/8 p-3 text-roseGlow/85"><span className="block text-[9px] uppercase tracking-[.15em] text-white/32">Sua resposta</span>{answer.userAnswer || "Sem resposta"}</p><p className="rounded-xl bg-mint/8 p-3 text-mint"><span className="block text-[9px] uppercase tracking-[.15em] text-white/32">Resposta correta</span>{answer.correctAnswer}</p></div>{answer.explanation ? <p className="mt-3 text-[13px] font-bold leading-relaxed text-white/48">{answer.explanation}</p> : null}</div><SecondaryButton icon={CheckCircle2} onClick={() => review(answer)}>Marcar revisado</SecondaryButton></div>
  </GlassCard>)}</div>;
}

function GameHistoryPanel({ data }: { data: ReturnType<typeof useMemoUserData> }) {
  const sessions = [...data.sessions].filter((session) => session.kind === "Games").sort((a, b) => b.createdAt - a.createdAt);
  if (!sessions.length) return <GlassCard><EmptyState icon={Gamepad2} title="Nenhuma partida ainda" text="Seu histórico mostrará jogo, matéria, acertos, XP, pontuação e duração." /></GlassCard>;
  return <div className="grid gap-2.5">{sessions.map((session) => {
    const subject = data.subjects.find((item) => item.id === session.subjectId)?.name || (session.dailyChallenge ? "Conhecimentos gerais" : "Matéria removida");
    const correct = Number(session.correctAnswers || 0); const total = Number(session.questionsAnswered || 0); const accuracy = total ? Math.round((correct / total) * 100) : 0;
    return <div key={session.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint/10 text-mint"><Gamepad2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate font-display text-base font-black">{session.gameName || gameNames[session.gameId || ""] || session.title}</p><p className="mt-0.5 text-[11px] font-bold text-white/38">{subject} · {new Date(session.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p></div><div className="grid grid-cols-4 gap-2 text-center sm:min-w-[22rem]"><div><p className="font-display text-base font-black text-mint">{correct}/{total}</p><p className="text-[9px] font-black uppercase text-white/30">acertos</p></div><div><p className="font-display text-base font-black">{accuracy}%</p><p className="text-[9px] font-black uppercase text-white/30">precisão</p></div><div><p className="font-display text-base font-black text-amber-300">+{session.xpEarned || 0}</p><p className="text-[9px] font-black uppercase text-white/30">XP</p></div><div><p className="font-display text-base font-black">{formatGameDuration(session.durationMs)}</p><p className="text-[9px] font-black uppercase text-white/30">tempo</p></div></div></div></div>;
  })}</div>;
}

function GameSeasonPanel({ sessions }: { sessions: Session[] }) {
  const season = currentSeason();
  const points = seasonPoints(sessions);
  const league = leagueFromPoints(points);
  const unlocked = unlockedGameAchievementIds(sessions);
  const remainingDays = Math.max(1, Math.ceil((season.endAt - Date.now()) / 86_400_000));
  return <div className="grid gap-4">
    <HeroCard><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-mint">{season.name} · {remainingDays} dias restantes</p><h2 className="mt-1 font-display text-4xl font-black" style={{ color: league.color }}>Liga {league.name}</h2><p className="mt-2 max-w-xl text-sm font-bold text-white/48">Acertos valem 10 pontos de temporada, partidas perfeitas dão +20 e missões concluídas somam recompensas. O XP continua separado.</p></div><div className="min-w-[14rem] rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex items-end justify-between"><p className="font-display text-3xl font-black">{points}</p><p className="text-[10px] font-black uppercase text-white/35">PTS</p></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${league.progress * 100}%`, backgroundColor: league.color }} /></div><p className="mt-2 text-[11px] font-bold text-white/38">{league.next ? `${Math.max(0, league.next.min - points)} pts para ${league.next.name}` : "Liga máxima alcançada"}</p></div></div></HeroCard>
    <GlassCard><SectionTitle icon={Award} title={`Conquistas dos jogos (${unlocked.size}/${gameAchievementRules.length})`} hint="marcos permanentes" /><div className="mt-4 grid gap-2 sm:grid-cols-2">{gameAchievementRules.map((achievement) => { const done = unlocked.has(achievement.id); return <div key={achievement.id} className={`flex gap-3 rounded-xl border p-3 ${done ? "border-mint/28 bg-mint/[0.07]" : "border-white/8 bg-black/20 opacity-55"}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${done ? "bg-mint text-black" : "bg-white/8 text-white/35"}`}>{done ? <Trophy className="h-5 w-5" /> : <Lock className="h-4 w-4" />}</span><div><p className="font-display text-sm font-black">{achievement.name}</p><p className="mt-0.5 text-[11px] font-bold leading-relaxed text-white/42">{achievement.description}</p></div></div>; })}</div></GlassCard>
  </div>;
}

function GamesView({ data, user, update }: { data: ReturnType<typeof useMemoUserData>; user: User; update: (next: (draft: AppData) => AppData) => void }) {
  const [hubTab, setHubTab] = useState<GamesHubTab>("jogar");
  const [subjectId, setSubjectId] = useState<string | undefined>(data.subjects[0]?.id);
  const [game, setGame] = useState<GameId | null>(null);
  // "loading" e "ready" são os dois momentos da tela de instruções: enquanto a
  // Mine escreve a partida e depois que ela ficou pronta. A pessoa lê as regras
  // no tempo que a IA levaria de qualquer jeito.
  const [status, setStatus] = useState<"idle" | "config" | "loading" | "ready" | "playing" | "done" | "error">("idle");
  const [erro, setErro] = useState("");
  const [rodada, setRodada] = useState(0);
  const [questionCount, setQuestionCount] = useState<GameQuestionCount>(6);
  const [showWordPreviews, setShowWordPreviews] = useState(true);

  const [vf, setVf] = useState<TrueFalseItem[]>([]);
  const [pares, setPares] = useState<PairItem[]>([]);
  const [palavras, setPalavras] = useState<HangmanItem[]>([]);
  const [termos, setTermos] = useState<WordMeaning[]>([]);
  const [sequencias, setSequencias] = useState<SequencePuzzle[]>([]);

  const [resultado, setResultado] = useState<{ pontos: number; recorde: boolean; acertos: number; total: number; xp: number } | null>(null);
  const [recordes, setRecordes] = useState<Record<string, number>>(() => readRecords());
  const reduzido = useSoftMotion();
  const gameRequestRef = useRef<AbortController | null>(null);
  const gameStatusRef = useRef(status);
  const playStartedAtRef = useRef(0);

  useEffect(() => {
    gameStatusRef.current = status;
  }, [status]);

  useEffect(() => () => gameRequestRef.current?.abort(), []);

  const subject = data.subjects.find((item) => item.id === subjectId);
  const materials = subject ? data.materials.filter((item) => item.subjectId === subject.id) : [];
  const recordKey = `${game}:${subjectId}`;

  function abrirJogo(id: GameId) {
    if (!subject) return;
    setGame(id);
    setErro("");
    setResultado(null);
    gameStatusRef.current = "config";
    setStatus("config");
    window.scrollTo({ top: 0, behavior: reduzido ? "auto" : "smooth" });
  }

  function iniciar(id: GameId) {
    if (!subject) return;
    window.scrollTo({ top: 0, behavior: reduzido ? "auto" : "smooth" });
    gameRequestRef.current?.abort();
    const controller = new AbortController();
    gameRequestRef.current = controller;
    setGame(id);
    gameStatusRef.current = "loading";
    setStatus("loading");
    setErro("");
    setResultado(null);

    const context = subjectContentContext(subject, materials, 4_500);
    const pedidos: Record<GameId, { task: string; prompt: string; maxOutputTokens: number; minimum: number }> = {
      nexo: { task: "pares", prompt: `Crie ${questionCount} pares curtos e conceitualmente distintos sobre ${subject.name}.`, maxOutputTokens: 180 + questionCount * 95, minimum: questionCount },
      sequencia: { task: "sequencia", prompt: `Crie ${questionCount} processos de quatro etapas sobre ${subject.name}.`, maxOutputTokens: 220 + questionCount * 300, minimum: questionCount },
      corrida: { task: "vf", prompt: `Gere ${questionCount} afirmacoes curtas sobre ${subject.name}.`, maxOutputTokens: 180 + questionCount * 115, minimum: questionCount },
      memoria: { task: "pares", prompt: `Crie ${questionCount} pares curtos sobre ${subject.name}.`, maxOutputTokens: 160 + questionCount * 85, minimum: questionCount },
      forca: { task: "forca", prompt: `Escolha ${questionCount} palavras sobre ${subject.name}.`, maxOutputTokens: 160 + questionCount * 75, minimum: questionCount },
      caca: {
        task: "caca",
        prompt: `Escolha ${questionCount + 2} palavras sobre ${subject.name}. Entregue pelo menos ${questionCount} palavras validas, unicas, de 4 a 12 letras e sem espacos.`,
        maxOutputTokens: 420 + questionCount * 80,
        minimum: questionCount,
      },
    };

    // Toda partida é escrita na hora pela Mine. Estas duas linhas são o que
    // impede a segunda partida de ser igual à primeira: um ângulo sorteado e a
    // lista do que já saiu nas rodadas anteriores desta matéria.
    const memoriaKey = `${id}:${subject.id}`;
    const jaSairam = readSeen()[memoriaKey] || [];
    const angulo = gameAngles[Math.floor(Math.random() * gameAngles.length)];
    const evitar = jaSairam.length ? `\nNao repita nada desta lista, que ja saiu em partidas anteriores: ${jaSairam.join(", ")}.` : "";
    const pedido = pedidos[id];
    const prompt = `${pedido.prompt}\n${angulo} Traga itens diferentes dos de uma partida comum e varie os subtemas dentro da materia.${evitar}`;

    let bestCount = 0;
    let released = false;
    let latestSeen: string[] = [];

    const accept = (text: string) => {
      let count = 0;
      let novos: string[] = [];
      let apply: (() => void) | null = null;

      if (id === "corrida") {
        const itens = parseTrueFalse(text).slice(0, questionCount);
        count = itens.length;
        novos = itens.map((item) => item.statement.slice(0, 60));
        apply = () => setVf(shuffle(itens));
      } else if (id === "memoria" || id === "nexo") {
        const itens = parsePairs(text).slice(0, questionCount);
        count = itens.length;
        novos = itens.map((item) => item.term);
        apply = () => setPares(itens);
      } else if (id === "sequencia") {
        const itens = parseSequencePuzzles(text).slice(0, questionCount);
        count = itens.length;
        novos = itens.map((item) => item.title);
        apply = () => setSequencias(itens);
      } else if (id === "caca") {
        const itens = parseWordMeanings(text).slice(0, questionCount);
        count = itens.length;
        novos = itens.map((item) => item.word);
        apply = () => setTermos(itens);
      } else {
        const itens = parseHangman(text).slice(0, questionCount);
        count = itens.length;
        novos = itens.map((item) => item.word);
        apply = () => setPalavras(itens);
      }

      if (count <= bestCount || count < pedido.minimum) return { count, novos };
      bestCount = count;
      latestSeen = novos;
      if (gameStatusRef.current !== "playing" && gameStatusRef.current !== "done") apply?.();
      if (!released) {
        released = true;
        gameStatusRef.current = "ready";
        setRodada((valor) => valor + 1);
        setStatus("ready");
      }
      return { count, novos };
    };

    streamGameTask(
      { task: pedido.task, prompt, context, model: "terra", maxOutputTokens: pedido.maxOutputTokens },
      { signal: controller.signal, onPartial: accept },
    )
      .then((text) => {
        if (controller.signal.aborted) return;
        const result = accept(text);
        if (!released || result.count < pedido.minimum) throw new Error("conteudo insuficiente");
        rememberSeen(memoriaKey, result.novos);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        if (released) {
          rememberSeen(memoriaKey, latestSeen);
          return;
        }
        setErro("A Mine não conseguiu montar a partida agora. Tente novamente.");
        gameStatusRef.current = "error";
        setStatus("error");
      })
      .finally(() => {
        if (gameRequestRef.current === controller) gameRequestRef.current = null;
      });
  }

  const finalizar = useCallback(
    (pontos: number, recorde: boolean, correctAnswers: number, answers: GameAnswer[] = []) => {
      const totalQuestions = answers.length || questionCount;
      const acertosFromAnswers = answers.filter((answer) => answer.correct).length;
      const acertos = Math.min(totalQuestions, Math.max(0, Math.floor(answers.length ? acertosFromAnswers : correctAnswers)));
      const xp = gameXpFromCorrectAnswers(acertos);
      setResultado({ pontos, recorde, acertos, total: totalQuestions, xp });
      gameStatusRef.current = "done";
      setStatus("done");
      setRecordes(readRecords());
      if (!subject) return;
      const nome = gameCatalog.find((item) => item.id === game)?.name || "Jogo";
      const now = Date.now();
      const detailedAnswers = answers.map((answer) => ({ ...answer, gameId: game || undefined, gameName: nome, subjectId: subject.id, createdAt: now }));
      update((draft) => ({
        ...draft,
        sessions: [
          ...draft.sessions,
          {
            id: uid("session"),
            userId: user.id,
            subjectId: subject.id,
            title: `${nome}: ${pontos} pts · ${acertos}/${totalQuestions} acertos`,
            kind: "Games",
            createdAt: now,
            xpEarned: xp,
            correctAnswers: acertos,
            questionsAnswered: totalQuestions,
            gameId: game || undefined,
            gameName: nome,
            score: pontos,
            record: recorde,
            durationMs: playStartedAtRef.current ? now - playStartedAtRef.current : undefined,
            answers: detailedAnswers,
            accuracy: totalQuestions ? acertos / totalQuestions : 0,
            seasonId: currentSeason(now).id,
            mode: "standard",
          },
        ],
      }));
    },
    [game, questionCount, subject, update, user.id],
  );

  function sair() {
    gameRequestRef.current?.abort();
    gameRequestRef.current = null;
    setGame(null);
    gameStatusRef.current = "idle";
    setStatus("idle");
    setErro("");
    setResultado(null);
  }

  const jogoAtual = gameCatalog.find((item) => item.id === game);

  return (
    <>
      {status !== "config" && status !== "loading" && status !== "ready" ? (
      <PageHeader
        eyebrow="Games com a Mine"
        title={jogoAtual ? jogoAtual.name : "Jogos de estudo"}
        subtitle={jogoAtual ? jogoAtual.rule : "Partidas montadas pela Mine a partir dos conteúdos das suas matérias."}
        action={game ? <SecondaryButton icon={X} onClick={sair}>Sair</SecondaryButton> : undefined}
      />
      ) : null}

      {!game ? (
        <div className="space-y-5">
          <GamesHubNav active={hubTab} onChange={setHubTab} errorCount={unresolvedGameErrors(data.sessions).length} />
          {hubTab === "jogar" ? (
          <>
          <Reveal>
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <DepthWord text="GAMES" reduced={reduzido} />
              <p className="text-[13px] font-bold text-white/45">
                {gameCatalog.length} aventuras montadas pela Mine. Cada resposta correta vale +{xpPerAction.game} XP; erros valem 0.
              </p>
            </div>
          </Reveal>
          {!data.subjects.length ? (
            <GlassCard>
              <EmptyState icon={Gamepad2} title="Crie uma matéria para jogar" text="Os seis jogos usam os conteúdos das suas matérias. O desafio diário e as outras áreas já estão disponíveis acima." />
            </GlassCard>
          ) : (
          <>
          <Reveal delay={0.05}>
            <GlassCard>
              <SectionTitle icon={BookOpen} title="Jogar com qual matéria?" />
              <div className="mt-4 flex flex-wrap gap-2">
                {data.subjects.map((item) => {
                  const ativo = item.id === subjectId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => setSubjectId(item.id)}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-black transition-control duration-control ${
                        ativo ? "text-black shadow-glowSoft" : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white"
                      }`}
                      style={ativo ? { backgroundColor: item.color } : undefined}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: ativo ? "rgba(0,0,0,.55)" : item.color }} />
                      {item.name}
                    </button>
                  );
                })}
              </div>
              {subject && !materials.length ? (
                <p className="mt-4 text-[13px] font-bold text-white/45">
                  Sem conteúdos cadastrados, a Mine usa conhecimento geral sobre {subject.name}.
                </p>
              ) : null}
            </GlassCard>
          </Reveal>

          <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" gap={0.07}>
            {[...gameCatalog].sort((a, b) => Number(Boolean(b.badge)) - Number(Boolean(a.badge))).map((item) => {
              const recorde = recordes[`${item.id}:${subjectId}`] || 0;
              return (
                <StaggerItem key={item.id} className={item.featured ? "h-full sm:col-span-2 xl:col-span-1" : "h-full"}>
                  <button
                    type="button"
                    onClick={() => abrirJogo(item.id)}
                    disabled={!subject}
                    style={item.badge ? { borderColor: `${item.accent}55` } : undefined}
                    className={`sheen depth-panel group relative flex h-full w-full flex-col items-start gap-3 overflow-hidden rounded-lg border bg-black/35 p-5 text-left transition-control duration-control hover:-translate-y-1 hover:shadow-glowSoft disabled:cursor-not-allowed disabled:opacity-45 sm:p-6 ${item.badge ? "" : "border-white/10 hover:border-mint/40"}`}
                  >
                    {item.badge ? (
                      <span
                        className="absolute right-4 top-4 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[.14em] sm:px-3"
                        style={{ borderColor: `${item.accent}4d`, backgroundColor: `${item.accent}1a`, color: item.accent }}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                    <span
                      className="grid h-12 w-12 place-items-center rounded-2xl text-black transition-transform duration-control group-hover:scale-110 group-hover:rotate-6"
                      style={{ backgroundColor: item.accent }}
                    >
                      <item.icon className="h-6 w-6" />
                    </span>
                    <span className="max-w-[calc(100%-4.5rem)] font-display text-lg font-black leading-tight sm:text-xl">{item.name}</span>
                    <span className="text-[13px] leading-relaxed text-white/50">{item.tagline}</span>
                    <span className="mt-auto flex w-full items-center justify-between pt-3">
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-black text-mint">
                        Jogar
                        <ArrowRight className="h-4 w-4 transition-transform duration-control group-hover:translate-x-1" />
                      </span>
                      {recorde ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-black text-white/55">
                          <Trophy className="h-3 w-3 text-amber-300" />
                          {recorde}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </StaggerItem>
              );
            })}
          </Stagger>
          </>
          )}
          </>
          ) : hubTab === "diario" ? (
            <DailyChallengePanel data={data} user={user} update={update} />
          ) : hubTab === "missoes" ? (
            <GameMissionsPanel sessions={data.sessions} />
          ) : hubTab === "erros" ? (
            <GameErrorsPanel data={data} user={user} update={update} />
          ) : hubTab === "historico" ? (
            <GameHistoryPanel data={data} />
          ) : (
            <GameSeasonPanel sessions={data.sessions} />
          )}
        </div>
      ) : status === "config" && jogoAtual ? (
        <GameSetup
          gameName={jogoAtual.name}
          isWordSearch={jogoAtual.id === "caca"}
          count={questionCount}
          showPreviews={showWordPreviews}
          subject={subject?.name || ""}
          onCountChange={setQuestionCount}
          onPreviewChange={setShowWordPreviews}
          onConfirm={() => iniciar(jogoAtual.id)}
          onBack={sair}
        />
      ) : (status === "loading" || status === "ready") && jogoAtual ? (
        <GameIntro
          jogo={jogoAtual}
          materia={subject?.name || ""}
          questionCount={questionCount}
          pronto={status === "ready"}
          recorde={recordes[recordKey] || 0}
           onStart={() => {
             playStartedAtRef.current = Date.now();
             gameStatusRef.current = "playing";
            setStatus("playing");
            requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: reduzido ? "auto" : "smooth" }));
          }}
          onBack={sair}
        />
      ) : status === "error" ? (
        <GlassCard>
          <EmptyState icon={XCircle} title="Não deu certo" text={erro} />
          <div className="mt-4 flex flex-wrap gap-2">
            <PrimaryButton icon={RotateCcw} onClick={() => game && iniciar(game)}>Tentar de novo</PrimaryButton>
            <SecondaryButton icon={X} onClick={sair}>Voltar</SecondaryButton>
          </div>
        </GlassCard>
      ) : status === "done" && resultado ? (
        <Reveal>
          <GlassCard>
            <div className="grid place-items-center gap-3 py-10 text-center">
              <Trophy className={`h-12 w-12 ${resultado.recorde ? "text-amber-300" : "text-mint"}`} />
              {resultado.recorde ? (
                <p className="rounded-full bg-amber-300/15 px-4 py-1 text-[13px] font-black uppercase tracking-[.16em] text-amber-300">
                  Novo recorde
                </p>
              ) : null}
              <p className="font-display text-4xl font-black tabular">{resultado.pontos}</p>
              <p className="text-sm font-bold text-white/45">
                pontos em {jogoAtual?.name} · {subject?.name}
              </p>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-mint/12 px-3 py-1.5 text-[13px] font-black text-mint">
                <Zap className="h-3.5 w-3.5" />
                +{resultado.xp} XP · {resultado.acertos}/{resultado.total} acertos
              </p>
              {!resultado.recorde && recordes[recordKey] ? (
                <p className="text-[13px] font-bold text-white/35">Seu recorde: {recordes[recordKey]}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <PrimaryButton icon={RotateCcw} onClick={() => game && iniciar(game)}>Jogar de novo</PrimaryButton>
                <SecondaryButton icon={Gamepad2} onClick={sair}>Outros jogos</SecondaryButton>
              </div>
            </div>
          </GlassCard>
        </Reveal>
      ) : (
        <GlassCard>
          {game === "corrida" ? (
            <SpeedRunGame key={rodada} items={vf} recordKey={recordKey} onFinish={finalizar} />
          ) : game === "nexo" ? (
            <NexusGame key={rodada} pairs={pares} onFinish={(score, correctAnswers, answers) => finalizar(score, saveRecord(recordKey, score), correctAnswers, answers)} />
          ) : game === "sequencia" ? (
            <SequenceForgeGame key={rodada} puzzles={sequencias} onFinish={(score, correctAnswers, answers) => finalizar(score, saveRecord(recordKey, score), correctAnswers, answers)} />
          ) : game === "memoria" ? (
            <MemoryGame key={rodada} pairs={pares} recordKey={recordKey} onFinish={finalizar} />
          ) : game === "caca" ? (
            <WordSearchGame
              key={rodada}
              items={termos}
              wordCount={questionCount}
              showPreviews={showWordPreviews}
              recordKey={recordKey}
              onFinish={finalizar}
            />
          ) : (
            <HangmanGame key={rodada} words={palavras} recordKey={recordKey} onFinish={finalizar} />
          )}
        </GlassCard>
      )}
    </>
  );
}

/**
 * Perfil e ajustes na mesma tela.
 *
 * Eram duas ideias com um dono só: a apresentação (nome, foto, bio) e as
 * preferências. Quem clica no próprio nome quer as duas, e quem chega pelo
 * ranking cai aqui com o `id` de outra pessoa — nesse caso a tela vira o
 * cartão público, sem nada de configuração.
 */
function ProfileView({
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
        <HeroCard className="mb-5">
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
                  appearance={{ themeMode: s.themeMode || "dark", accentColor: normalizeAccent(s.accentColor) }}
                  onChange={(patch) => setSetting(patch)}
                />
              </div>
              <ToggleSwitch
                icon={Wand2}
                label="Reduzir animações"
                hint="Desliga o fundo 3D e as transições. Bom em máquinas mais lentas."
                on={!!s.reducedMotion}
                onChange={(v) => setSetting({ reducedMotion: v })}
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
            <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" gap={0.06}>
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

function AdminRestrictedView() {
  return (
    <>
      <PageHeader eyebrow="Admin" title="Acesso restrito" />
      <GlassCard>
        <SectionTitle icon={Shield} title="Área administrativa bloqueada" />
        <p className="mt-4 max-w-2xl text-white/62">
          Para acessar esta página, saia da conta e use a opção "Entrar como admin" com a senha administrativa.
        </p>
        <div className="mt-6">
          <SecondaryButton icon={ChevronLeft} onClick={() => go("home")}>Voltar ao início</SecondaryButton>
        </div>
      </GlassCard>
    </>
  );
}

function adminDisplayName(user: User) {
  if (user.settings.displayName?.trim()) return user.settings.displayName.trim();
  if (user.name.includes("@")) return user.name.split("@")[0] || "Usuário";
  return user.name || "Usuário";
}

function adminContact(user: User) {
  return user.name.includes("@") ? user.name : "E-mail não informado";
}

function adminDateTime(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function userLastActivity(data: AppData, user: User) {
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

type AdminV2Section = "overview" | "clients" | "mine" | "comments" | "updates" | "suggestions" | "content" | "tasks" | "system";
type AdminV2ClientScope = "all" | string;

type AdminV2ChatUser = {
  user: User;
  chats: ChatMessage[];
  clientMessages: number;
  mineMessages: number;
  lastAt: number;
};

type AdminV2NavGroup = "Operação" | "Comunidade" | "Organização" | "Plataforma";

const adminV2NavItems: Array<{ id: AdminV2Section; label: string; icon: LucideIcon; group: AdminV2NavGroup }> = [
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

const adminV2NavGroups: AdminV2NavGroup[] = ["Operação", "Comunidade", "Organização", "Plataforma"];

const adminV2Copy: Record<AdminV2Section, { title: string; description: string }> = {
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

function AdminView({
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
    <section className="admin-control-room min-h-screen text-[#16352b]">
      <div className="admin-shell-grid relative z-[1] grid min-h-screen lg:grid-cols-[276px_minmax(0,1fr)]">
        <aside className="admin-sidebar sticky top-0 z-40 flex min-w-0 flex-col px-3 py-3 text-white lg:h-screen lg:overflow-y-auto lg:px-4 lg:py-5">
          <div aria-hidden="true" className="admin-sidebar-atmosphere" />

          <div className="admin-brand-row relative z-[1] flex items-center justify-between gap-3">
            <button type="button" onClick={() => go("home")} className="group flex min-w-0 items-center gap-3 rounded-2xl text-left focus-visible:outline-white lg:gap-4">
              <span className="admin-brand-seal grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white p-1.5 lg:h-14 lg:w-14">
                <BrandMark label="Minerva" className="brand-mark-admin relative z-[1] h-full w-full" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-lg font-black leading-tight tracking-[-.03em] lg:text-xl">MINERVA</span>
                <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-[.15em] text-emerald-100/66">Central acadêmica</span>
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
            <div className="mb-3 flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[.13em] text-emerald-100/58">
              <span>Ambiente seguro</span>
              <span className={`h-2 w-2 rounded-full ${syncStatus === "online" ? "bg-emerald-300 shadow-[0_0_0_4px_rgba(110,231,183,.12)]" : syncStatus === "salvando" ? "bg-lime-300" : "bg-amber-300"}`} />
            </div>
            <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.065] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-200/12 text-sm font-black text-emerald-100">
                  {(currentAdmin ? adminDisplayName(currentAdmin) : "A").slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[.15em] text-emerald-100/54">Administrador</p>
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
                  <span className="text-xs font-bold text-[#789085]">/ {activeCopy.title}</span>
                </div>
                <h1 className="mt-3 max-w-4xl font-display text-[clamp(2.45rem,5vw,4.9rem)] font-black leading-[.92] tracking-[-.055em] text-[#102a21]">{activeCopy.title}</h1>
                <p className="mt-3 max-w-3xl text-[clamp(.95rem,1.35vw,1.1rem)] font-medium leading-relaxed text-[#557166]">{activeCopy.description}</p>
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

function AdminV2SystemStatus({ syncStatus, databaseMode, totalRecords }: { syncStatus: SyncStatus; databaseMode: string; totalRecords: number }) {
  const online = syncStatus === "online";
  const saving = syncStatus === "salvando";
  return (
    <div className="admin-system-status min-w-[min(100%,18rem)] rounded-[1.25rem] border border-[#d6e4dc] bg-white/80 p-3 shadow-[0_20px_55px_-38px_rgba(18,61,45,.5)] sm:min-w-[18rem] sm:p-4">
      <div className="flex items-center gap-3">
        <span className="admin-system-orbit relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e7f5ed] text-[#0b7a4c]">
          <Activity className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#71897e]">Estado do sistema</p>
            <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : saving ? "bg-lime-500" : "bg-amber-500"}`} />
          </div>
          <p className="mt-1 font-display text-base font-black text-[#17362a]">{saving ? "Sincronizando dados" : online ? "Operação estável" : "Conexão limitada"}</p>
          <p className="mt-0.5 text-xs font-bold text-[#71897e]">{databaseMode === "postgres" ? "Postgres" : "Dados locais"} · {totalRecords} registros</p>
        </div>
      </div>
    </div>
  );
}

function AdminV2NavButton({
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
      className={`admin-nav-button relative flex min-h-11 min-w-28 shrink-0 items-center justify-center rounded-xl px-3 py-2.5 text-center text-xs font-black transition-control lg:w-full lg:min-w-0 lg:justify-start lg:px-3 lg:text-left lg:text-sm ${active ? "text-[#0a5038]" : "text-emerald-50/72 hover:bg-white/[0.065] hover:text-white"}`}
    >
      {active ? (
        <motion.span
          layoutId="admin-active-nav"
          aria-hidden="true"
          className="admin-nav-active-pill absolute inset-0 rounded-xl bg-[#e8fff2] shadow-[0_10px_28px_-16px_rgba(5,74,51,.75)]"
          transition={{ type: "spring", stiffness: 440, damping: 36 }}
        />
      ) : null}
      <span className="relative z-[1] flex min-w-0 items-center gap-2.5 lg:w-full">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${active ? "bg-white/80 text-[#08764d] shadow-sm" : "bg-white/[0.055] text-emerald-50/82"}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="whitespace-nowrap">{item.label}</span>
        {typeof badge === "number" ? (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black lg:ml-auto ${active ? "bg-[#c9f7dc] text-[#075a3d]" : "bg-white/[0.09] text-emerald-50/68"}`}>
            {badge}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function AdminV2StatCard({ icon: Icon, title, value, detail, onClick }: { icon: LucideIcon; title: string; value: number | string; detail: string; onClick?: () => void }) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`admin-stat-card admin-motion-card rounded-[1.25rem] border border-[#d8e8df] bg-white p-4 text-left shadow-[0_18px_48px_-36px_rgba(10,66,46,.5)] md:p-5 ${
        onClick ? "transition-control hover:border-[#9fd4b5]" : ""
      }`}
    >
      <div className="relative z-[1] flex items-center justify-between gap-3 md:gap-4">
        <p className="text-[11px] font-black uppercase tracking-[.12em] text-[#648075] md:text-xs">{title}</p>
        <span className="admin-stat-icon grid h-9 w-9 place-items-center rounded-xl bg-[#e7f6ee] text-[#08764d] md:h-10 md:w-10">
          <Icon className="h-4 w-4 md:h-5 md:w-5" />
        </span>
      </div>
      <p className="relative z-[1] mt-4 font-display text-3xl font-black tracking-[-.05em] text-[#112f24] md:text-[2.65rem]">{value}</p>
      <p className="relative z-[1] mt-1 text-xs font-bold leading-relaxed text-[#769085] md:text-[13px]">{detail}</p>
    </Wrapper>
  );
}

function AdminV2ClientScopeBar({
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
    <section className="admin-scope-bar relative mt-4 rounded-[1.25rem] border border-[#d8e5de] bg-white/78 p-3 shadow-[0_18px_50px_-40px_rgba(18,61,45,.55)] md:mt-5 md:p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e8f5ee] text-[#0c754c] sm:grid">
            <Target className="h-4 w-4" />
          </span>
          <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.17em] text-[#0f8055]">Recorte de análise</p>
          <p className="mt-1 text-sm font-bold leading-relaxed text-[#607b70]">
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
                selectedClientId === "all" ? "border-[#87cba4] bg-[#e5f8ed] text-[#07593c] shadow-[inset_0_0_0_1px_rgba(34,197,94,.08)]" : "border-[#d9e6df] bg-white text-[#567267] hover:border-[#9fcdb2] hover:bg-[#f5faf7]"
              }`}
            >
              Todos
            </button>
            {selectedClient ? (
              <span className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-[#8acaa6] bg-[#e5f8ed] py-1.5 pl-3 pr-1.5 text-sm font-black text-[#07593c]">
                <span className="max-w-40 truncate">{adminDisplayName(selectedClient)}</span>
                <button
                  type="button"
                  onClick={() => onSelect("all")}
                  aria-label={`Remover filtro de ${adminDisplayName(selectedClient)}`}
                  className="grid h-7 w-7 place-items-center rounded-lg text-[#07593c]/70 transition-control hover:bg-[#07593c]/10 hover:text-[#07593c]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : null}
            <div className="relative min-w-44 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#769085]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar cliente..."
                aria-label="Buscar cliente"
                className="min-h-11 w-full rounded-xl border border-[#d9e6df] bg-white py-2 pl-10 pr-3 text-sm font-bold text-[#17362a] outline-none transition-control placeholder:font-medium placeholder:text-[#8da197] focus:border-[#70ba91] focus:shadow-[0_0_0_4px_rgba(29,153,94,.09)]"
              />
            </div>
          </div>
          {needle ? (
            results.length ? (
              <div className="admin-scope-results absolute inset-x-0 top-[calc(100%+.45rem)] z-30 grid gap-1 rounded-2xl border border-[#d3e2da] bg-white p-1.5 shadow-[0_24px_65px_-28px_rgba(16,53,40,.42)]">
                {results.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      onSelect(user.id);
                      setQuery("");
                    }}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-black text-[#17362a] transition-control hover:bg-[#edf8f2]"
                  >
                    <span className="min-w-0 truncate">{adminDisplayName(user)}</span>
                    <span className="hidden shrink-0 text-xs font-bold text-[#789085] sm:inline">{adminContact(user)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="admin-scope-results absolute inset-x-0 top-[calc(100%+.45rem)] z-30 rounded-2xl border border-[#d3e2da] bg-white px-4 py-3 text-sm font-bold text-[#71897e] shadow-[0_24px_65px_-28px_rgba(16,53,40,.42)]">Nenhum cliente encontrado.</p>
            )
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AdminV2SectionContent({
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

function AdminV2PanelCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`admin-panel-card admin-motion-card rounded-[1.35rem] border border-[#d9e6df] bg-white/90 p-4 shadow-[0_22px_62px_-46px_rgba(12,57,42,.58)] md:p-5 ${className}`}>
      {children}
    </section>
  );
}

function AdminV2PanelTitle({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="admin-panel-title mb-4 flex items-start gap-3 md:mb-5 md:gap-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#d7e9df] bg-[#edf8f2] text-[#0a7650] md:h-11 md:w-11">
        <Icon className="h-4 w-4 md:h-5 md:w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-xl font-black tracking-[-.025em] text-[#132f25] md:text-2xl">{title}</h2>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-[#6d877c]">{text}</p>
      </div>
    </div>
  );
}

function AdminV2ClientsPanel({
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
          <thead className="bg-[#ecfdf3] text-xs font-black uppercase text-[#14532d]">
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
          <tbody className="divide-y divide-[#d8f3df] text-[#174336]">
            {users.map((user) => {
              const metrics = clientMetrics(data, user);
              const status = adminClientStatus(user, metrics);
              return (
                <tr
                  key={user.id}
                  onClick={() => onSelectClient(user.id)}
                  className={`cursor-pointer transition ${selectedClientId === user.id ? "bg-[#ecfdf3]" : "hover:bg-[#f8fdf9]"}`}
                >
                  <td className="px-5 py-5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#dcfce7] font-black text-[#087445]">
                        {adminDisplayName(user).slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-[#0f2f24]">{adminDisplayName(user)}</span>
                          {user.isAdmin ? <AdminV2Badge tone="dark" label="ADMIN" icon={Shield} /> : null}
                        </div>
                        <p className="mt-1 text-xs font-bold text-[#719281]">ID {user.id.slice(-8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-[#16a34a]" />
                        <span className="font-bold text-[#25634b]">{adminContact(user)}</span>
                      </div>
                      <p className="text-xs font-bold text-[#719281]">Criado em {adminDateTime(user.createdAt)}</p>
                    </div>
                  </td>
                  <td className="px-5 py-5">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <AdminV2MetricPill label={`${metrics.subjectCount} matérias`} />
                        <AdminV2MetricPill label={`${metrics.contentCount} conteúdos`} />
                      </div>
                      <div className="mt-3 h-2 w-44 overflow-hidden rounded-full bg-[#e5f6ea]">
                        <div className="h-full rounded-full bg-[#22c55e]" style={{ width: `${metrics.completion}%` }} />
                      </div>
                      <p className="mt-1 text-xs font-black text-[#5e876f]">{metrics.completion}% estudado</p>
                    </div>
                  </td>
                  <td className="px-5 py-5">
                    <div className="flex flex-wrap gap-2">
                      <AdminV2MetricPill label={`${metrics.openTasks} abertas`} />
                      <AdminV2MetricPill label={`${metrics.doneTasks} concluídas`} />
                    </div>
                  </td>
                  <td className="px-5 py-5">
                    <span className="font-display text-2xl font-black text-[#0f7a45]">{metrics.mineMessages}</span>
                    <p className="text-xs font-bold text-[#719281]">respostas</p>
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
                <td colSpan={8} className="px-5 py-12 text-center font-bold text-[#6e927d]">
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

function AdminV2ClientCard({ user, data, active = false, onSelect }: { user: User; data: AppData; active?: boolean; onSelect?: () => void }) {
  const metrics = clientMetrics(data, user);
  const status = adminClientStatus(user, metrics);
  const Element = onSelect ? "button" : "article";

  return (
    <Element type={onSelect ? "button" : undefined} onClick={onSelect} className={`admin-client-card admin-motion-card w-full rounded-2xl border p-4 text-left transition-control ${active ? "border-[#79c69b] bg-[#eaf8f0] shadow-[0_14px_36px_-28px_rgba(13,109,70,.55)]" : "border-[#dce8e1] bg-[#fbfdfc] hover:border-[#a9d3ba]"}`}>
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#dcfce7] font-black text-[#087445]">
          {adminDisplayName(user).slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words font-black text-[#0f2f24]">{adminDisplayName(user)}</h3>
            {user.isAdmin ? <AdminV2Badge tone="dark" label="ADMIN" icon={Shield} /> : null}
          </div>
          <p className="mt-1 break-all text-sm font-bold text-[#25634b]">{adminContact(user)}</p>
          <p className="mt-1 text-xs font-bold text-[#719281]">Criado em {shortDate(user.createdAt)} · ID {user.id.slice(-8)}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black text-[#087445]">
        <div className="rounded-lg bg-[#ecfdf3] px-3 py-2">{metrics.subjectCount} matérias</div>
        <div className="rounded-lg bg-[#ecfdf3] px-3 py-2">{metrics.contentCount} conteúdos</div>
        <div className="rounded-lg bg-[#ecfdf3] px-3 py-2">{metrics.openTasks} abertas</div>
        <div className="rounded-lg bg-[#ecfdf3] px-3 py-2">{metrics.doneTasks} concluídas</div>
      </div>

      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-[#e5f6ea]">
          <div className="h-full rounded-full bg-[#22c55e]" style={{ width: `${metrics.completion}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-black text-[#5e876f]">{metrics.completion}% estudado</p>
          <p className="text-xs font-bold text-[#719281]">{metrics.mineMessages} respostas da Mine</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${status.className}`}>{status.label}</span>
        <span className="text-xs font-black text-[#719281]">Última atividade: {shortDate(metrics.lastActivity)}</span>
      </div>
    </Element>
  );
}

function AdminV2UpdatesPanel({
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
            <p className="mb-2 text-sm font-black text-[#27764f]">Tipo</p>
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
                      active ? "border-[#22c55e] bg-[#dcfce7] text-[#065f46]" : "border-[#d8f3df] bg-[#fbfffc] text-[#4f7b65] hover:border-[#86efac]"
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
            <span className="text-sm font-black text-[#27764f]">Título</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value.slice(0, 120))}
              placeholder="Ex: Mapa mental agora com arrastar e ajustar"
              className="mt-2 w-full rounded-lg border border-[#d8f3df] bg-[#fbfffc] p-3 text-sm font-black text-[#0f2f24] outline-none transition placeholder:font-bold placeholder:text-[#8fae9c] focus:border-[#22c55e]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-black text-[#27764f]">Descrição</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value.slice(0, 800))}
              rows={5}
              placeholder="Conte o que mudou e como isso ajuda quem estuda."
              className="mt-2 w-full resize-none rounded-lg border border-[#d8f3df] bg-[#fbfffc] p-3 text-sm font-bold leading-6 text-[#0f2f24] outline-none transition placeholder:text-[#8fae9c] focus:border-[#22c55e]"
            />
            <span className="mt-1 block text-right text-xs font-bold text-[#8fae9c]">{body.length}/800</span>
          </label>
          <button
            type="submit"
            disabled={!title.trim() || !body.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#16a34a] px-5 py-3 text-sm font-black text-white transition hover:bg-[#15803d] disabled:cursor-not-allowed disabled:opacity-50"
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
              <article key={item.id} className="rounded-lg border border-[#d8f3df] bg-[#fbfffc] p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#dcfce7] text-[#087445]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-black uppercase text-[#087445]">{meta.label}</span>
                      <span className="text-xs font-bold text-[#719281]">{adminDateTime(item.createdAt)}</span>
                    </div>
                    <h3 className="mt-1.5 font-black text-[#0f2f24]">{item.title}</h3>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-[#25634b]">{item.body}</p>
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

const adminSuggestionStatuses: Array<{ id: SiteSuggestion["status"]; label: string }> = [
  { id: "nova", label: "Recebida" },
  { id: "analisando", label: "Em análise" },
  { id: "planejada", label: "Planejada" },
  { id: "concluida", label: "Concluída" },
  { id: "recusada", label: "Não entrou" },
];

function AdminV2SuggestionsPanel({
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
                active ? "border-[#22c55e] bg-[#dcfce7] text-[#065f46]" : "border-[#d8f3df] bg-[#fbfffc] text-[#4f7b65] hover:border-[#86efac]"
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
            <article key={suggestion.id} className="rounded-lg border border-[#d8f3df] bg-[#fbfffc] p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#dcfce7] text-[#087445]">
                  <categoryInfo.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#ecfdf3] px-2 py-0.5 text-[10px] font-black uppercase text-[#087445]">{categoryInfo.label}</span>
                    {author ? (
                      <button type="button" onClick={() => onSelectClient(author.id)} className="text-xs font-black text-[#0f2f24] underline-offset-4 transition hover:text-[#087445] hover:underline">
                        {suggestion.name}
                      </button>
                    ) : (
                      <span className="text-xs font-black text-[#0f2f24]">{suggestion.name}</span>
                    )}
                    <span className="text-xs font-bold text-[#719281]">{adminDateTime(suggestion.createdAt)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#25634b]">{suggestion.text}</p>
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
                            active ? "bg-[#16a34a] text-white" : "bg-[#ecfdf3] text-[#4f7b65] hover:bg-[#dcfce7]"
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

function AdminV2CommentsPanel({
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
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm font-black text-[#27764f]">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#ecfdf3] px-3 py-2">
            <Star className="h-4 w-4 fill-[#f59e0b] text-[#f59e0b]" />
            {average.toFixed(1)} de 5
          </span>
          <span className="rounded-lg bg-[#ecfdf3] px-3 py-2">
            {comments.length} {comments.length === 1 ? "comentário" : "comentários"}
          </span>
        </div>
      ) : null}
      <div className="grid gap-3">
        {comments.map((comment) => {
          const author = data.users.find((item) => item.id === comment.userId);
          return (
            <article key={comment.id} className="rounded-lg border border-[#d8f3df] bg-[#fbfffc] p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#dcfce7] font-black text-[#087445]">
                  {comment.name.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {author ? (
                      <button type="button" onClick={() => onSelectClient(author.id)} className="font-black text-[#0f2f24] underline-offset-4 transition hover:text-[#087445] hover:underline">
                        {comment.name}
                      </button>
                    ) : (
                      <span className="font-black text-[#0f2f24]">{comment.name}</span>
                    )}
                    {!author ? <span className="rounded-full bg-[#fef3c7] px-2 py-0.5 text-[10px] font-black uppercase text-[#92400e]">conta excluída</span> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-[#719281]">
                    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${comment.rating} de 5 estrelas`}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className={`h-3.5 w-3.5 ${star <= comment.rating ? "fill-[#f59e0b] text-[#f59e0b]" : "text-[#d1d5db]"}`} />
                      ))}
                    </span>
                    <span>{adminDateTime(comment.createdAt)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#25634b]">{comment.text}</p>
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

function AdminV2OverviewPanel({
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
                className="rounded-lg border border-[#d8f3df] bg-[#fbfffc] p-3 text-left transition hover:border-[#22c55e] hover:bg-[#ecfdf3]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black text-[#0f2f24]">{adminDisplayName(user)}</p>
                    <p className="text-xs font-bold text-[#719281]">{adminDateTime(userLastActivity(data, user))}</p>
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

function AdminV2ConversationPanel({
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
        <div className="grid border-t border-[#d8f3df] xl:grid-cols-[320px_1fr]">
          <div className="max-h-[680px] overflow-y-auto border-b border-[#d8f3df] bg-[#f8fdf9] p-3 xl:border-b-0 xl:border-r">
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
                    active ? "border-[#22c55e] bg-white shadow-[0_14px_32px_rgba(34,197,94,0.16)]" : "border-[#d8f3df] bg-[#fbfffc] hover:border-[#86efac] hover:bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg font-black ${active ? "bg-[#dcfce7] text-[#065f46]" : "bg-white text-[#087445]"}`}>
                      {adminDisplayName(row.user).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-black text-[#0f2f24]">{adminDisplayName(row.user)}</span>
                      <span className="block truncate text-xs font-bold text-[#719281]">{adminContact(row.user)}</span>
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <span className="rounded-lg bg-[#ecfdf3] px-3 py-2 text-xs font-black text-[#087445]">{row.clientMessages} do usuario</span>
                    <span className="rounded-lg bg-white px-3 py-2 text-xs font-black text-[#4f7b65]">{row.mineMessages} da Mine</span>
                  </div>
                  {attachmentCount ? <p className="mt-2 text-xs font-black text-[#087445]">{attachmentCount} anexos enviados</p> : null}
                  <p className="mt-3 line-clamp-2 text-sm font-semibold leading-5 text-[#4f7b65]">
                    {lastUserMessage ? lastUserMessage.text : "Sem mensagem do usuario."}
                  </p>
                  <p className="mt-2 text-xs font-black text-[#719281]">Ultima conversa: {adminDateTime(row.lastAt)}</p>
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

function AdminV2ConversationThreadV2({ row, data }: { row: AdminV2ChatUser; data: AppData }) {
  const [filter, setFilter] = useState<"all" | "user" | "mine">("all");
  const visibleChats = row.chats.filter((chat) => filter === "all" || chat.role === filter);

  return (
    <div className="min-w-0 bg-[#f4fbf6]">
      <div className="sticky top-0 z-10 border-b border-[#d8f3df] bg-white/95 p-4 backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#0f8a55]">Historico da conversa</p>
            <h3 className="mt-1 font-display text-2xl font-black text-[#0f2f24]">{adminDisplayName(row.user)}</h3>
            <p className="mt-1 text-sm font-bold text-[#719281]">{row.clientMessages} mensagens do usuario · {row.mineMessages} respostas da Mine</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "user", "mine"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-lg border px-3 py-2 text-xs font-black transition ${
                  filter === item ? "border-[#22c55e] bg-[#dcfce7] text-[#065f46]" : "border-[#d8f3df] bg-white text-[#4f7b65] hover:border-[#86efac]"
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
                  <span className="mt-1 hidden h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-[#087445] shadow-sm sm:grid">
                    <Bot className="h-5 w-5" />
                  </span>
                ) : null}
                <div className={`max-w-[94%] overflow-hidden rounded-lg border shadow-sm sm:max-w-[82%] ${mine ? "border-[#d8f3df] bg-white text-[#174336]" : "border-[#86efac] bg-[#dcfce7] text-[#0f3d2e]"}`}>
                  <div className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 ${mine ? "border-[#e2f5e7] bg-[#fbfffc]" : "border-[#bbf7d0] bg-[#c8f8d8]"}`}>
                    <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.08em] text-[#087445]">
                      {mine ? <Bot className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                      {mine ? "Mine respondeu" : "Usuario enviou"}
                    </span>
                    <span className="text-xs font-bold text-[#5f856f]">{adminDateTime(chat.createdAt)}</span>
                  </div>
                  <div className="px-4 py-3">
                    <p className="whitespace-pre-wrap break-words text-sm font-semibold leading-6">{chat.text}</p>
                    <ChatAttachments attachments={chat.attachments} tone="light" />
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <AdminV2MetricPill label={subject?.name || "Mine geral"} />
                      <span className="text-xs font-bold text-[#719281]">ID {chat.id.slice(-8)}</span>
                    </div>
                  </div>
                </div>
                {!mine ? (
                  <span className="mt-1 hidden h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#dcfce7] text-[#087445] shadow-sm sm:grid">
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

function AdminV2ConversationThread({ row, data }: { row: AdminV2ChatUser; data: AppData }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#d8f3df] bg-[#f8fdf9]">
      <div className="border-b border-[#d8f3df] bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-xl font-black text-[#0f2f24]">{adminDisplayName(row.user)}</p>
            <p className="mt-1 text-sm font-bold text-[#719281]">{row.clientMessages} mensagens do cliente · {row.mineMessages} respostas da Mine</p>
          </div>
          {row.user.isAdmin ? <AdminV2Badge tone="dark" label="ADMIN" icon={Shield} /> : <AdminV2Badge tone="light" label="Cliente" icon={Users} />}
        </div>
      </div>

      <div className="max-h-[520px] space-y-3 overflow-y-auto p-4">
        {row.chats.map((chat) => {
          const mine = chat.role === "mine";
          const subject = chat.subjectId ? data.subjects.find((item) => item.id === chat.subjectId) : undefined;
          return (
            <div key={chat.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[92%] rounded-lg border p-3 sm:max-w-[84%] ${mine ? "border-[#d8f3df] bg-white text-[#174336]" : "border-[#bbf7d0] bg-[#dcfce7] text-[#0f3d2e]"}`}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-black text-[#087445]">
                    {mine ? <Bot className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                    {mine ? "Mine" : adminDisplayName(row.user)}
                  </span>
                  <span className="text-xs font-bold text-[#719281]">{adminDateTime(chat.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm font-medium leading-6">{chat.text}</p>
                <p className="mt-2 text-xs font-bold text-[#719281]">{subject?.name || "Mine geral"}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminV2ContentPanel({ data, selectedClientId, onSelectClient }: { data: AppData; selectedClientId: AdminV2ClientScope; onSelectClient: (userId: AdminV2ClientScope) => void }) {
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
                selectedClientId === row.user.id ? "border-[#22c55e] bg-[#dcfce7] shadow-[0_14px_32px_rgba(34,197,94,0.16)]" : "border-[#d8f3df] bg-[#fbfffc] hover:border-[#86efac] hover:bg-[#f4fff7]"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white font-black text-[#087445]">
                  {adminDisplayName(row.user).slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black text-[#0f2f24]">{adminDisplayName(row.user)}</span>
                  <span className="block truncate text-xs font-bold text-[#719281]">{adminContact(row.user)}</span>
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
            <div key={subject.id} className="rounded-lg border border-[#d8f3df] bg-[#fbfffc] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="font-black text-[#0f2f24]">{subject.name}</p>
                  <p className="text-sm font-bold text-[#719281]">{user ? adminDisplayName(user) : "Conta removida"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AdminV2MetricPill label={`${materials.length} conteúdos`} />
                  <AdminV2MetricPill label={`${tasks.length} tarefas`} />
                  <AdminV2MetricPill label={`${completion}% estudado`} />
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e5f6ea]">
                <div className="h-full rounded-full bg-[#22c55e]" style={{ width: `${completion}%` }} />
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

function AdminV2ClientContentDetails({
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
              <div key={subject.id} className="rounded-lg border border-[#d8f3df] bg-[#fbfffc] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="font-black text-[#0f2f24]">{subject.name}</p>
                    <p className="mt-1 text-sm font-bold text-[#719281]">{materials.length} conteudos · {tasks.length} tarefas</p>
                  </div>
                  <AdminV2MetricPill label={`${completion}% estudado`} />
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e5f6ea]">
                  <div className="h-full rounded-full bg-[#22c55e]" style={{ width: `${completion}%` }} />
                </div>
                <div className="mt-4 grid gap-2">
                  {materials.slice(0, 5).map((material) => (
                    <div key={material.id} className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-[#4f7b65]">
                      <span className="font-black text-[#0f2f24]">{material.title}</span>
                      <span className="ml-2 text-xs text-[#719281]">{materialTypeLabel(material.type)} · {material.studied ? "estudado" : "pendente"}</span>
                    </div>
                  ))}
                  {!materials.length ? <p className="text-sm font-bold text-[#719281]">Nenhum material nesta materia.</p> : null}
                </div>
              </div>
            );
          })}
          {!row.subjects.length ? <AdminV2Empty text="Este cliente ainda nao criou materias." /> : null}
        </div>

        <div className="grid content-start gap-3">
          <p className="text-sm font-black uppercase tracking-[.14em] text-[#0f8a55]">Tipos</p>
          {typeRows.map((item) => (
            <AdminV2DataRow key={item.type} icon={FileText} label={item.label} detail="Conteudos deste cliente" value={item.count} />
          ))}
        </div>
      </div>
    </AdminV2PanelCard>
  );
}

function AdminV2TasksPanel({ data, selectedClientId }: { data: AppData; selectedClientId: AdminV2ClientScope }) {
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
            <div key={group.user.id} className="rounded-lg border border-[#d8f3df] bg-[#fbfffc] p-4">
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-black text-[#0f2f24]">{adminDisplayName(group.user)}</p>
                  <p className="text-sm font-bold text-[#719281]">{group.tasks.length} tarefas neste recorte</p>
                </div>
                {group.user.isAdmin ? <AdminV2Badge tone="dark" label="ADMIN" icon={Shield} /> : null}
              </div>
              <div className="grid gap-2">
                {group.tasks.map((task) => {
                  const subject = data.subjects.find((item) => item.id === task.subjectId);
                  return (
                    <div key={task.id} className="rounded-lg bg-white px-3 py-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-black text-[#0f2f24]">{task.title}</p>
                          <p className="text-sm font-bold text-[#719281]">{subject?.name || "Sem materia"}</p>
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
              <div key={task.id} className="rounded-lg border border-[#d8f3df] bg-[#fbfffc] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-black text-[#0f2f24]">{task.title}</p>
                    <p className="text-sm font-bold text-[#719281]">{adminDisplayName(user || fallbackUser())} · {subject?.name || "Sem matéria"}</p>
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

function AdminV2MinePanel({ data, selectedClientId, onSelectClient }: { data: AppData; selectedClientId: AdminV2ClientScope; onSelectClient: (userId: AdminV2ClientScope) => void }) {
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
              <div key={chat.id} className="rounded-lg border border-[#d8f3df] bg-[#fbfffc] p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#dcfce7] text-[#087445]">
                    {chat.role === "mine" ? <Bot className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-[#0f2f24]">{chat.role === "mine" ? "Mine" : adminDisplayName(user || fallbackUser())}</p>
                    <p className="mt-1 max-h-12 overflow-hidden text-sm font-medium text-[#5f856f]">{chat.text}</p>
                    <p className="mt-2 text-xs font-bold text-[#719281]">{subject?.name || "Mine geral"} · {adminDateTime(chat.createdAt)}</p>
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

function AdminV2SystemPanel({ data, syncStatus, databaseMode, selectedClientId }: { data: AppData; syncStatus: SyncStatus; databaseMode: string; selectedClientId: AdminV2ClientScope }) {
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
        <div className="space-y-4 text-sm font-bold leading-7 text-[#4f7b65]">
          <p>Recorte atual: {selectedClient ? adminDisplayName(selectedClient) : "todos os clientes"}.</p>
          <p>Os dados vêm do banco online e são agrupados por cliente para acompanhamento administrativo.</p>
          <p>O painel mostra uso real da plataforma: matérias criadas, conteúdos salvos, tarefas abertas, progresso e conversas com a Mine.</p>
          <p>Ações destrutivas não aparecem aqui para evitar exclusões acidentais de contas ou estudos.</p>
        </div>
      </AdminV2PanelCard>
    </div>
  );
}

function AdminV2DataRow({ icon: Icon, label, detail, value, warning = false }: { icon: LucideIcon; label: string; detail: string; value: number | string; warning?: boolean }) {
  return (
    <div className="admin-data-row flex flex-col gap-3 rounded-2xl border border-[#dce8e1] bg-[#fbfdfc] p-4 sm:flex-row sm:items-center sm:gap-4">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${warning ? "bg-[#fff0ed] text-[#b94337]" : "bg-[#e8f6ee] text-[#08764d]"}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-black text-[#153329]">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-[#778e84]">{detail}</p>
      </div>
      <p className={`break-words font-display text-2xl font-black tracking-[-.04em] sm:text-3xl ${warning ? "text-[#b94337]" : "text-[#0b754d]"}`}>{value}</p>
    </div>
  );
}

function AdminV2ActivityRow({ record, onOpenConversation }: { record: ReturnType<typeof buildAdminActivity>[number]; onOpenConversation?: (userId: string) => void }) {
  const Icon = record.icon;
  const opensConversation = record.kind === "chat" && Boolean(onOpenConversation);
  const Element = opensConversation ? "button" : "div";
  return (
    <Element
      type={opensConversation ? "button" : undefined}
      onClick={opensConversation ? () => onOpenConversation?.(record.userId) : undefined}
      className={`admin-activity-row flex w-full flex-col gap-3 rounded-2xl border border-[#dce8e1] bg-[#fbfdfc] p-4 text-left transition-control sm:flex-row sm:items-start sm:gap-4 ${
        opensConversation ? "cursor-pointer hover:border-[#8fcdaa] hover:bg-[#f0f9f4] hover:shadow-[0_14px_32px_-24px_rgba(34,126,82,.3)]" : ""
      }`}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e8f6ee] text-[#08764d]">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-black text-[#0f2f24]">{record.label}</p>
        <p className="mt-1 text-sm font-medium text-[#5f856f]">{record.detail}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
        <p className="text-xs font-black text-[#719281] sm:whitespace-nowrap">{adminDateTime(record.time)}</p>
        {opensConversation ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-3 py-1 text-xs font-black text-[#087445]">
            Abrir conversa
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>
    </Element>
  );
}

function AdminV2MetricPill({ label }: { label: string }) {
  return <span className="admin-metric-pill inline-flex rounded-full border border-[#d9ebe1] bg-[#eef8f2] px-3 py-1 text-xs font-black text-[#0b714b]">{label}</span>;
}

function AdminV2Badge({ label, icon: Icon, tone = "green" }: { label: string; icon?: LucideIcon; tone?: "green" | "dark" | "light" | "red" }) {
  const className =
    tone === "dark" ? "bg-[#064e3b] text-white" :
    tone === "red" ? "bg-[#fee2e2] text-[#b91c1c]" :
    tone === "light" ? "bg-[#ecfdf3] text-[#166534]" :
    "bg-[#dcfce7] text-[#087445]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${className}`}>
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
    </span>
  );
}

function AdminV2Empty({ text }: { text: string }) {
  return (
    <div className="admin-empty-state rounded-2xl border border-dashed border-[#b9d8c6] bg-[#f8fcfa] p-8 text-center font-bold text-[#71897e]">
      {text}
    </div>
  );
}

function clientMetrics(data: AppData, user: User) {
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

function adminClientStatus(user: User, metrics: ReturnType<typeof clientMetrics>) {
  const age = Date.now() - user.createdAt;
  const last = Date.now() - metrics.lastActivity;
  if (user.isAdmin) return { label: "Administrador", className: "bg-[#064e3b] text-white" };
  if (age <= 3 * 86400000) return { label: "Novo cliente", className: "bg-[#dcfce7] text-[#087445]" };
  if (last <= 7 * 86400000) return { label: "Ativo", className: "bg-[#dcfce7] text-[#087445]" };
  if (metrics.subjectCount || metrics.contentCount || metrics.taskCount || metrics.chatCount) return { label: "Em acompanhamento", className: "bg-[#ecfdf3] text-[#166534]" };
  return { label: "Sem dados", className: "bg-[#f1f5f2] text-[#66786c]" };
}

function getAdminStats(data: AppData, selectedClientId: AdminV2ClientScope = "all") {
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

function buildAdminActivity(data: AppData, selectedClientId: AdminV2ClientScope = "all") {
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

function materialTypeLabel(type: Material["type"]) {
  return type === "note" ? "Anotações" : type === "file" ? "Arquivos" : type === "link" ? "Links" : "Imagens";
}

function fallbackUser(): User {
  return {
    id: "fallback",
    name: "Conta removida",
    createdAt: Date.now(),
    settings: { displayName: "Conta removida", dailyGoal: 0, focusMinutes: 0, mineStyle: "equilibrada", reminders: false },
  };
}

function ModalHost({
  modal,
  setModal,
  user,
  data,
  update,
  notify,
}: {
  modal: Modal | null;
  setModal: (modal: Modal | null) => void;
  user: User;
  data: ReturnType<typeof useMemoUserData>;
  update: (next: (draft: AppData) => AppData) => void;
  notify: (message: string) => void;
}) {
  useEffect(() => {
    if (!modal) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, setModal]);

  // Trava o scroll do fundo enquanto um modal está aberto.
  useEffect(() => {
    if (!modal) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [modal]);

  if (!modal) return null;
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col items-center overflow-x-hidden overflow-y-auto bg-black/75 p-4 backdrop-blur-xl sm:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        onClick={() => setModal(null)}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, y: 34, scale: 0.94, filter: "blur(12px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 22, scale: 0.95, filter: "blur(8px)" }}
          transition={{ duration: 0.34, ease: ease.out }}
          className={`glass-deep relative my-auto w-full shrink-0 ${modal.type === "mindmap" ? "max-w-7xl" : modal.type === "quiz" ? "max-w-5xl" : modal.type === "subject" ? "max-w-4xl" : "max-w-xl"} overflow-hidden rounded-lg p-5 sm:p-6`}
          onClick={(event) => event.stopPropagation()}
        >
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-mint/60 to-transparent" />
          <span aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-mint/12 blur-[80px]" />
          {modal.type === "subject" && (
            <SubjectModal
              user={user}
              update={update}
              close={() => setModal(null)}
              notify={notify}
            />
          )}
          {modal.type === "material" && <MaterialModal user={user} subjectId={modal.subjectId} update={update} close={() => setModal(null)} notify={notify} />}
          {modal.type === "materialView" &&
            (() => {
              const material = data.materials.find((item) => item.id === modal.materialId);
              if (!material) return null;
              const subject = data.subjects.find((item) => item.id === material.subjectId);
              return <MaterialViewModal material={material} subject={subject} update={update} setModal={setModal} notify={notify} />;
            })()}
          {modal.type === "task" && <TaskModal user={user} subjects={data.subjects} subjectId={modal.subjectId} update={update} close={() => setModal(null)} notify={notify} />}
          {modal.type === "quiz" &&
            (() => {
              const subject = data.subjects.find((item) => item.id === modal.subjectId);
              return subject ? <QuizModal subject={subject} materials={data.materials.filter((item) => item.subjectId === subject.id)} user={user} update={update} close={() => setModal(null)} /> : null;
            })()}
          {modal.type === "mindmap" &&
            (() => {
              const subject = data.subjects.find((item) => item.id === modal.subjectId);
              return subject ? <MindmapModal subject={subject} materials={data.materials.filter((item) => item.subjectId === subject.id)} close={() => setModal(null)} /> : null;
            })()}
          {modal.type === "flashcards" &&
            (() => {
              const subject = data.subjects.find((item) => item.id === modal.subjectId);
              return subject ? (
                <FlashcardsModal
                  subject={subject}
                  materials={data.materials.filter((item) => item.subjectId === subject.id)}
                  cards={data.flashcards.filter((item) => item.subjectId === subject.id)}
                  user={user}
                  update={update}
                  notify={notify}
                />
              ) : null;
            })()}
          {modal.type === "confirm" && (
            <div className="relative">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-roseGlow/12 text-roseGlow ring-1 ring-inset ring-roseGlow/25">
                <Trash2 className="h-6 w-6" />
              </span>
              <h2 className="mt-5 font-display text-2xl font-black leading-tight md:text-3xl">{modal.title}</h2>
              <p className="mt-3 leading-relaxed text-white/58">{modal.body}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  transition={spring.snappy}
                  onClick={() => {
                    modal.onConfirm();
                    setModal(null);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-roseGlow to-[#E11D48] px-5 py-3 font-black text-white shadow-[0_0_36px_rgba(251,113,133,.32)] ring-1 ring-inset ring-white/25 transition-control duration-control hover:brightness-110"
                >
                  <CheckCircle2 className="h-[18px] w-[18px]" />
                  Confirmar
                </motion.button>
                <SecondaryButton icon={ChevronLeft} onClick={() => setModal(null)}>
                  Cancelar
                </SecondaryButton>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function SubjectModal({ user, update, close, notify }: { user: User; update: (next: (draft: AppData) => AppData) => void; close: () => void; notify: (message: string) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(subjectPalette[0]);
  const [iconName, setIconName] = useState<IconName>("book");
  const SelectedIcon = iconMap[iconName];

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        update((draft) => ({
          ...draft,
          subjects: [...draft.subjects, { id: uid("subject"), userId: user.id, name: name.trim(), color, icon: iconName, favorite: false, createdAt: Date.now() }],
        }));
        notify("Matéria criada.");
        close();
      }}
      className="relative"
    >
      <header className="flex items-start justify-between gap-5 border-b border-white/[0.08] pb-5">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-mint">Nova coleção de estudos</p>
          <h2 className="mt-1.5 font-display text-[2rem] font-black leading-none tracking-[-.045em] sm:text-[2.45rem]">Crie uma matéria</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/48">Escolha uma identidade fácil de reconhecer na sua biblioteca, agenda e progresso.</p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Fechar"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white/45 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <Spotlight
          className="subject-builder-preview overflow-hidden rounded-[1.15rem] border bg-black/25"
          color={`${color}2A`}
          size={280}
        >
          <div className="relative flex min-h-[15rem] flex-col p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-black uppercase tracking-[.16em] text-white/36">Prévia ao vivo</span>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 14px ${color}` }} />
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={iconName}
                initial={{ opacity: 0, rotate: -12, scale: 0.75 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 10, scale: 0.78 }}
                transition={spring.snappy}
                className="mt-8 grid h-16 w-16 place-items-center rounded-[1rem] text-black shadow-lg"
                style={{ backgroundColor: color, boxShadow: `0 18px 40px -20px ${color}` }}
              >
                <SelectedIcon className="h-8 w-8" />
              </motion.span>
            </AnimatePresence>

            <div className="mt-auto pt-7">
              <AnimatePresence mode="wait" initial={false}>
                <motion.h3
                  key={name.trim() || "empty"}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="line-clamp-2 font-display text-2xl font-black leading-tight tracking-[-.035em]"
                >
                  {name.trim() || "Sua matéria"}
                </motion.h3>
              </AnimatePresence>
              <p className="mt-1 text-xs font-bold text-white/38">0 conteúdos · pronta para começar</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <motion.span className="block h-full rounded-full" animate={{ width: "18%", backgroundColor: color }} transition={spring.gentle} />
              </div>
            </div>
          </div>
        </Spotlight>

        <div className="min-w-0 space-y-6">
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[.12em] text-white/46">Nome da matéria</span>
            <div className="group relative">
              <BookOpen className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-mint" />
              <input
                autoFocus
                value={name}
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex: Física, Redação, Direito..."
                className="h-14 w-full rounded-[.9rem] border border-white/12 bg-white/[0.045] pl-12 pr-14 font-bold text-white outline-none transition-colors placeholder:text-white/28 focus:border-mint/55 focus:bg-white/[0.065]"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black tabular text-white/24">{name.length}/60</span>
            </div>
          </label>

          <fieldset aria-labelledby="subject-color-label">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p id="subject-color-label" className="text-xs font-black uppercase tracking-[.12em] text-white/46">Cor de identificação</p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2 text-[11px] font-black text-white/58 transition-colors hover:border-mint/35 hover:text-white">
                <Palette className="h-3.5 w-3.5" />
                Personalizar
                <span className="h-4 w-4 rounded-md border border-white/25" style={{ backgroundColor: color }} />
                <input
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value.toUpperCase())}
                  className="sr-only"
                  aria-label="Escolher uma cor personalizada"
                />
              </label>
            </div>
            <div className="grid grid-cols-8 gap-2 sm:grid-cols-12">
              {subjectPalette.map((item) => {
                const active = color === item;
                return (
                  <motion.button
                    key={item}
                    type="button"
                    onClick={() => setColor(item)}
                    aria-label={`Selecionar cor ${item}`}
                    aria-pressed={active}
                    whileTap={{ scale: 0.88 }}
                    transition={spring.snappy}
                    className={`relative aspect-square min-h-8 rounded-[.65rem] border transition-colors ${active ? "border-white shadow-lg" : "border-transparent hover:border-white/45"}`}
                    style={{ backgroundColor: item, boxShadow: active ? `0 0 0 3px ${item}33, 0 10px 24px -12px ${item}` : undefined }}
                  >
                    {active ? <Check className="absolute inset-0 m-auto h-4 w-4 text-black drop-shadow-[0_1px_1px_rgba(255,255,255,.6)]" /> : null}
                  </motion.button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-xs font-black uppercase tracking-[.12em] text-white/46">Ícone da matéria</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
              {(Object.keys(iconMap) as IconName[]).map((key) => {
                const Icon = iconMap[key];
                const active = iconName === key;
                return (
                  <motion.button
                    key={key}
                    type="button"
                    onClick={() => setIconName(key)}
                    aria-label={`Usar ícone de ${iconLabels[key]}`}
                    aria-pressed={active}
                    whileTap={{ scale: 0.94 }}
                    transition={spring.snappy}
                    className={`subject-icon-choice group flex min-h-[4.6rem] min-w-0 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[.85rem] border px-2 text-center transition-colors ${
                      active ? "border-transparent text-black" : "border-white/[0.08] bg-white/[0.035] text-white/52 hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
                    }`}
                    style={active ? { backgroundColor: color, boxShadow: `0 12px 28px -18px ${color}` } : undefined}
                  >
                    <Icon className="h-5 w-5 shrink-0 transition-transform duration-control group-hover:scale-110" />
                    <span className="w-full truncate text-[9px] font-black uppercase tracking-[.06em]">{iconLabels[key]}</span>
                  </motion.button>
                );
              })}
            </div>
          </fieldset>
        </div>
      </div>

      <footer className="mt-6 flex flex-col-reverse gap-3 border-t border-white/[0.08] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="hidden text-xs font-bold text-white/32 sm:block">Você poderá alterar o nome e a aparência depois.</p>
        <div className="flex gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={close}
            className="min-h-11 flex-1 rounded-[.8rem] border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white/60 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white sm:flex-none"
          >
            Cancelar
          </button>
          <motion.button
            type="submit"
            disabled={!name.trim()}
            whileTap={{ scale: 0.97 }}
            transition={spring.snappy}
            className="sheen inline-flex min-h-11 flex-[1.4] items-center justify-center gap-2 overflow-hidden rounded-[.8rem] bg-mint px-5 text-sm font-black text-black shadow-glowSoft transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none sm:flex-none"
          >
            <Plus className="h-4 w-4" />
            Criar matéria
          </motion.button>
        </div>
      </footer>
    </form>
  );
}

function MaterialModal({ user, subjectId, update, close, notify }: { user: User; subjectId: string; update: (next: (draft: AppData) => AppData) => void; close: () => void; notify: (message: string) => void }) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [type, setType] = useState<Material["type"]>("note");
  const [dataUrl, setDataUrl] = useState<string | undefined>(undefined);
  const [content, setContent] = useState<string | undefined>(undefined);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const typeLabels: Record<Material["type"], string> = {
    note: "Anotação",
    file: "Arquivo",
    link: "Link",
    image: "Imagem",
  };
  const isFileType = type === "file" || type === "image";

  async function handleFile(file?: File) {
    if (!file) return;
    setReading(true);
    try {
      if (file.type.startsWith("image/")) {
        setDataUrl(await imageFileToDataUrl(file));
        setContent(undefined);
      } else {
        const text = await extractFileText(file);
        let storedDataUrl: string | undefined;
        if (file.size <= maxRawFileBytes) {
          const raw = await readFileAsDataUrl(file);
          if (raw.length <= maxAttachmentDataUrlLength) storedDataUrl = raw;
        }
        if (!text && !storedDataUrl) {
          throw new Error(`Não consegui ler ${file.name}. Envie PDF, Word, PowerPoint, texto ou imagem de até ${formatFileSize(maxRawFileBytes)}.`);
        }
        setContent(text);
        setDataUrl(storedDataUrl);
      }
      setFileName(file.name);
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não consegui ler o arquivo.");
    } finally {
      setReading(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        update((draft) => ({
          ...draft,
          materials: [...draft.materials, { id: uid("material"), userId: user.id, subjectId, title: title.trim(), detail: detail.trim() || (isFileType ? fileName : ""), dataUrl, content, type, folder: "Geral", studied: false, favorite: false, createdAt: Date.now() }],
        }));
        notify("Conteúdo adicionado.");
        close();
      }}
      className="space-y-5"
    >
      <h2 className="font-display text-3xl font-black">Adicionar conteúdo</h2>
      <p className="text-sm text-white/55">A Mine analisa todo o conteúdo desta matéria para te ajudar.</p>
      <Input label="Título" value={title} onChange={setTitle} placeholder="Ex: Aula 1" />
      <div className="grid grid-cols-4 gap-2">
        {(["note", "file", "link", "image"] as Material["type"][]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setType(item);
              setDataUrl(undefined);
              setContent(undefined);
              setFileName("");
            }}
            className={`rounded-2xl px-3 py-3 text-sm font-black ${type === item ? "bg-mint text-black" : "bg-white/[0.07] text-white/62"}`}
          >
            {typeLabels[item]}
          </button>
        ))}
      </div>
      {isFileType ? (
        <div>
          <span className="mb-2 block text-sm font-black text-white/72">{type === "image" ? "Imagem" : "Arquivo (PDF, Word, PowerPoint, texto, imagem...)"}</span>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.04] px-4 py-4 text-sm font-black text-white/72 transition hover:border-mint/40 hover:bg-mint/10">
            <Paperclip className="h-5 w-5" />
            {reading ? "Lendo arquivo..." : fileName ? `Trocar (${fileName})` : "Escolher arquivo"}
            <input
              type="file"
              className="hidden"
              accept={type === "image" ? "image/*" : "image/*,.pdf,.txt,.md,.csv,.doc,.docx,.ppt,.pptx,.xls,.xlsx"}
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </label>
          {content ? <p className="mt-2 text-xs font-bold text-mint">Texto extraído ({content.length.toLocaleString("pt-BR")} caracteres) — a Mine vai analisar este conteúdo.</p> : null}
          {dataUrl && dataUrl.startsWith("data:image/") ? <img src={dataUrl} alt={title} className="mt-3 max-h-40 rounded-2xl border border-white/10" /> : null}
          {!content && dataUrl && !dataUrl.startsWith("data:image/") ? <p className="mt-2 text-xs text-white/50">Arquivo salvo, mas sem texto extraído. A Mine analisa melhor PDF, Word, PowerPoint, textos e imagens.</p> : null}
        </div>
      ) : (
        <Input label="Detalhes" value={detail} onChange={setDetail} placeholder={type === "link" ? "Cole o link (YouTube, site...)" : "Escreva a anotação — a Mine vai analisar"} />
      )}
      <PrimaryButton icon={Plus}>Adicionar</PrimaryButton>
    </form>
  );
}

function TaskModal({ user, subjects, subjectId, update, close, notify }: { user: User; subjects: Subject[]; subjectId?: string; update: (next: (draft: AppData) => AppData) => void; close: () => void; notify: (message: string) => void }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(subjectId || subjects[0]?.id || "");
  const [days, setDays] = useState(1);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim() || !subject) return;
        update((draft) => ({
          ...draft,
          tasks: [...draft.tasks, { id: uid("task"), userId: user.id, subjectId: subject, title: title.trim(), note: "", dueAt: addDays(days), done: false, createdAt: Date.now() }],
        }));
        notify("Tarefa criada.");
        close();
      }}
      className="space-y-5"
    >
      <h2 className="font-display text-3xl font-black">Nova tarefa</h2>
      <Input label="Título" value={title} onChange={setTitle} placeholder="Ex: Prova de química" />
      <label className="block">
        <span className="mb-2 block text-sm font-black text-white/72">Matéria</span>
        <select value={subject} onChange={(event) => setSubject(event.target.value)} className="h-14 w-full rounded-2xl border border-white/12 bg-panel2 px-4 outline-none focus:border-mint">
          {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-black text-white/62">Prazo: {days === 0 ? "Hoje" : `${days} dias`}</span>
        <input value={days} min={0} max={30} type="range" onChange={(event) => setDays(Number(event.target.value))} className="mt-3 w-full accent-mint" />
      </label>
      <PrimaryButton icon={Plus}>Criar tarefa</PrimaryButton>
    </form>
  );
}

function HeroCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <Spotlight
      className={`studio-hero-card relative overflow-hidden rounded-[1.25rem] border border-white/[0.08] bg-[#1b211e] ${className}`}
      color="rgba(184,214,192,0.07)"
      size={520}
    >
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-mint" />
      <div className="relative p-6 md:p-8">{children}</div>
    </Spotlight>
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <article className={`studio-card relative rounded-[1.1rem] border border-white/[0.08] bg-[#171c1a] transition-colors duration-control hover:border-white/[0.15] ${className}`}>
      <Spotlight className="h-full rounded-[inherit]" color="rgb(var(--mint) / 0.16)" size={380}>
        <div className="relative p-5 md:p-6">{children}</div>
      </Spotlight>
    </article>
  );
}

function SectionTitle({ icon: Icon, title, action, hint }: { icon: LucideIcon; title: string; action?: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative grid h-10 w-10 shrink-0 place-items-center border-l-2 border-mint text-mint">
          <Icon className="relative h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate font-display text-[1.3rem] font-black leading-tight tracking-[-.025em] md:text-[1.55rem]">{title}</h2>
          {hint ? <p className="truncate text-[13px] text-white/45">{hint}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function Pill({ icon: Icon, children, tone = "mint" }: { icon: LucideIcon; children: React.ReactNode; tone?: "mint" | "cyan" | "violet" }) {
  const tones = {
    mint: "border-mint/25 from-mint/15 to-cyanGlow/10 text-mint",
    cyan: "border-cyanGlow/25 from-cyanGlow/15 to-violetGlow/10 text-cyanGlow",
    violet: "border-violetGlow/25 from-violetGlow/15 to-roseGlow/10 text-violetGlow",
  } as const;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border bg-gradient-to-r px-4 py-1.5 text-[13px] font-black ${tones[tone]}`}>
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

function Metric({ icon: Icon, value, label, accent = "#34D399" }: { icon: LucideIcon; value: number | string; label: string; accent?: string }) {
  const numeric = typeof value === "number";
  return (
    <div
      className="group relative overflow-hidden border-b border-white/[0.09] bg-transparent p-5 transition-control duration-control hover:border-white/[0.2] hover:bg-white/[0.025]"
      style={{ ["--accent" as string]: accent, borderLeftColor: accent }}
    >
      <Icon className="relative h-[22px] w-[22px]" style={{ color: accent }} />
      <p className="relative mt-4 font-display text-[2.35rem] font-black leading-none tabular">
        {numeric ? <CountUp value={value as number} /> : value}
      </p>
      <p className="relative mt-1.5 text-[13px] font-bold text-white/48">{label}</p>
    </div>
  );
}

function HeroMetric({ icon, value, label }: { icon: LucideIcon; value: number | string; label: string }) {
  return (
    <HeroCard>
      <Metric icon={icon} value={value} label={label} />
    </HeroCard>
  );
}

function RadialScore({ value, label }: { value: number; label: string }) {
  return (
    <ProgressRing
      value={value}
      size={148}
      stroke={10}
      label={
        <p className="font-display text-[2rem] font-black leading-none tabular">
          <CountUp value={value} suffix="%" />
        </p>
      }
      sublabel={label}
    />
  );
}

function PrimaryButton({ children, icon: Icon, onClick }: { children: React.ReactNode; icon?: LucideIcon; onClick?: () => void }) {
  return (
    <motion.button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      transition={spring.snappy}
      className="group relative inline-flex items-center justify-center gap-2 rounded-[.85rem] bg-mint px-5 py-3 font-black text-black transition-control duration-control hover:-translate-y-0.5 hover:bg-white"
    >
      {Icon ? <Icon className="relative h-[18px] w-[18px]" /> : null}
      <span className="relative">{children}</span>
    </motion.button>
  );
}

function SecondaryButton({ children, icon: Icon, onClick }: { children: React.ReactNode; icon?: LucideIcon; onClick?: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={spring.snappy}
      className="group relative inline-flex items-center justify-center gap-2 rounded-[.85rem] border border-white/12 bg-transparent px-5 py-3 font-black text-white/75 transition-control duration-control hover:border-white/30 hover:bg-white/[0.04] hover:text-white"
    >
      {Icon ? <Icon className="h-[18px] w-[18px] transition-transform duration-control group-hover:scale-110" /> : null}
      {children}
    </motion.button>
  );
}

function IconButton({ icon: Icon, onClick, label }: { icon: LucideIcon; onClick: () => void; label: string }) {
  return (
    <motion.button
      onClick={onClick}
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.94 }}
      transition={spring.snappy}
      className="group relative grid h-13 w-13 place-items-center rounded-[.85rem] border border-white/10 bg-transparent text-white/65 transition-control duration-control hover:border-white/25 hover:bg-white/[0.04] hover:text-white"
    >
      <Icon className="relative h-[21px] w-[21px]" />
    </motion.button>
  );
}

/**
 * Foto da pessoa, ou a inicial do nome quando não há foto.
 *
 * `size` é a medida em pixels porque este avatar aparece em lugares com
 * escalas muito diferentes — barra lateral, cabeçalho, linha do ranking,
 * capa do perfil — e classe utilitária por tamanho viraria uma lista enorme.
 */
function Avatar({ name, src, size = 40, ring = false }: { name: string; src?: string; size?: number; ring?: boolean }) {
  const inicial = (name || "?").trim().slice(0, 1).toUpperCase();
  const estilo = { width: size, height: size, borderRadius: Math.max(8, size * 0.28) };
  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={estilo}
        className={`shrink-0 object-cover ${ring ? "ring-2 ring-mint/60" : ""}`}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ ...estilo, fontSize: Math.max(11, size * 0.4) }}
      className={`grid shrink-0 place-items-center bg-gradient-to-br from-mint to-mintDeep font-display font-black text-black ${ring ? "ring-2 ring-mint/60" : ""}`}
    >
      {inicial}
    </span>
  );
}

function EmptyState({ title, text, icon: Icon = Sparkles, action }: { title: string; text: string; icon?: LucideIcon; action?: React.ReactNode }) {
  const reduced = useSoftMotion();
  return (
    <div className="depth-panel relative overflow-hidden rounded-lg border border-dashed border-white/12 bg-white/[0.028] p-9 text-center">
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-grid-tight opacity-[0.14]" />
      <div className="relative mx-auto grid h-16 w-16 place-items-center">
        {!reduced ? <span className="absolute inset-0 animate-pulse-ring rounded-full border border-mint/35" /> : null}
        <span className="grid h-14 w-14 place-items-center rounded-full bg-mint/10 ring-1 ring-inset ring-mint/25">
          <Icon className="h-7 w-7 text-mint" />
        </span>
      </div>
      <h3 className="relative mt-5 font-display text-xl font-black md:text-2xl">{title}</h3>
      <p className="relative mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/48">{text}</p>
      {action ? <div className="relative mt-5 flex justify-center">{action}</div> : null}
    </div>
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

function Toast({ message }: { message: string }) {
  const reduced = useSoftMotion();
  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 28, x: "-50%", scale: 0.9, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, x: "-50%", scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 16, x: "-50%", scale: 0.94, filter: "blur(6px)" }}
          transition={spring.soft}
          className="fixed bottom-24 left-1/2 z-[60] flex max-w-[min(92vw,30rem)] items-center gap-3 overflow-hidden rounded-lg border border-mint/25 bg-[#0d1512]/90 px-4 py-3 text-[14px] font-bold text-white shadow-lift backdrop-blur-lg lg:bottom-8"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-mint/15 text-mint">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 leading-snug">{message}</span>
          {!reduced ? (
            <motion.span
              className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-gradient-to-r from-mint to-cyanGlow"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 2.4, ease: "linear" }}
            />
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function normalizeText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
}

function materialsToImageAttachments(items: Material[]): ChatAttachment[] {
  return items
    .filter((item) => item.type === "image" && !!item.dataUrl && item.dataUrl.startsWith("data:image/"))
    .slice(-3)
    .map((item) => ({ id: item.id, name: item.title, type: "image/png", size: 0, kind: "image" as const, dataUrl: item.dataUrl as string }));
}

type TrueFalseItem = { statement: string; answer: boolean; explanation: string };
type HangmanItem = { word: string; hint: string };
type PairItem = { term: string; definition: string };
type WordMeaning = { word: string; meaning: string };
/** Formato "TERMO: x / DEFINICAO: y" gerado por `task: "pares"`. */
function parsePairs(text: string): PairItem[] {
  const items: PairItem[] = [];
  let current: PairItem | null = null;
  const flush = () => {
    // Carta pequena: corta o que não couber e o que entrega a resposta.
    if (current && current.term && current.definition && !current.definition.toLowerCase().includes(current.term.toLowerCase())) {
      items.push(current);
    }
    current = null;
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const term = line.match(/^TERMO:?\s*(.+)$/i);
    if (term) {
      flush();
      current = { term: term[1].trim().replace(/[.:;]$/, "").slice(0, 40), definition: "" };
      continue;
    }
    if (!current) continue;
    const definition = line.match(/^DEFINI\S*:?\s*(.+)$/i);
    if (definition) current.definition = definition[1].trim().replace(/[.:;]$/, "").slice(0, 70);
  }
  flush();
  return items;
}

/** Formato "A: afirmação / R: V|F / EXPLICACAO: ..." gerado por `task: "vf"`. */
function parseTrueFalse(text: string): TrueFalseItem[] {
  const items: TrueFalseItem[] = [];
  let current: (TrueFalseItem & { answered?: boolean }) | null = null;
  const flush = () => {
    if (current && current.statement && current.answered) {
      items.push({ statement: current.statement, answer: current.answer, explanation: current.explanation });
    }
    current = null;
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const statement = line.match(/^A:\s*(.+)$/i);
    if (statement) {
      flush();
      current = { statement: statement[1].trim(), answer: true, explanation: "" };
      continue;
    }
    if (!current) continue;
    const answer = line.match(/^R:?\s*([VF])(?:\s*[.:\-–—]\s*(.+))?$/i);
    if (answer) {
      current.answer = answer[1].toUpperCase() === "V";
      current.answered = true;
      if (answer[2]?.trim()) current.explanation = answer[2].trim();
      continue;
    }
    const explanation = line.match(/^EXPLICA\S*:?\s*(.+)$/i);
    if (explanation) current.explanation = explanation[1].trim();
  }
  flush();
  return items;
}

/** Formato "PALAVRA: X / DICA: ..." gerado por `task: "forca"`. */
function parseHangman(text: string): HangmanItem[] {
  const items: HangmanItem[] = [];
  let current: HangmanItem | null = null;
  const flush = () => {
    // Descarta o que não serve para o jogo: sem dica, curto demais, ou com a
    // resposta entregue dentro da própria dica.
    if (current && current.word.length >= 4 && current.hint && !current.hint.toUpperCase().includes(current.word)) {
      items.push(current);
    }
    current = null;
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const word = line.match(/^PALAVRA:?\s*(.+)$/i);
    if (word) {
      flush();
      const clean = word[1]
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Za-z]/g, "")
        .toUpperCase();
      current = { word: clean, hint: "" };
      continue;
    }
    if (!current) continue;
    const hint = line.match(/^DICA:?\s*(.+)$/i);
    if (hint) current.hint = hint[1].trim();
  }
  flush();
  return items;
}

/** Formato "PALAVRA: X / SIGNIFICADO: ..." gerado por `task: "caca"`. */
function parseWordMeanings(text: string): WordMeaning[] {
  const items: WordMeaning[] = [];
  const vistas = new Set<string>();
  let current: WordMeaning | null = null;
  const flush = () => {
    // 12 letras é o teto porque a palavra precisa caber numa diagonal da grade.
    if (current && current.word.length >= 4 && current.word.length <= 12 && current.meaning.length > 12 && !vistas.has(current.word)) {
      vistas.add(current.word);
      items.push(current);
    }
    current = null;
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const word = line.match(/^PALAVRA:?\s*(.+)$/i);
    if (word) {
      flush();
      const bruta = word[1].trim().replace(/[.,;:]$/, "");
      // Termo de duas palavras é descartado, não colado. Pedir "uma palavra só"
      // faz o modelo devolver "ciclo celular" às vezes; grudar viraria
      // CICLOCELULAR na grade, que não é palavra nenhuma.
      if (/[\s\-–—/]/.test(bruta)) {
        current = null;
        continue;
      }
      const clean = bruta
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^A-Za-z]/g, "")
        .toUpperCase();
      current = { word: clean, meaning: "" };
      continue;
    }
    if (!current) continue;
    const meaning = line.match(/^SIGNIFICADO:?\s*(.+)$/i);
    if (meaning) {
      current.meaning = meaning[1].trim();
      continue;
    }
    // Frase longa quebrada em duas linhas pelo modelo: continua a anterior.
    if (current.meaning && !/^[A-Z]+:/.test(line)) current.meaning += ` ${line}`;
  }
  flush();
  return items;
}

function subjectContentContext(subject: Subject, materials: Material[], budgetLimit = 12_000): string {
  let budget = budgetLimit;
  const lines: string[] = [];
  for (const item of materials.slice(-10).reverse()) {
    if (budget <= 0) break;
    const body = (item.content?.trim() || item.detail?.trim() || "").slice(0, Math.min(budgetLimit <= 5_000 ? 650 : 1200, budget));
    const line = body ? `- ${item.title}: ${body}` : `- ${item.title}`;
    budget -= line.length;
    lines.push(line);
  }
  lines.reverse();
  return `Materia: ${subject.name}.${lines.length ? `\nConteudos cadastrados pelo usuario (baseie-se neles quando possivel):\n${lines.join("\n")}` : ""}`;
}

function attachmentsToMaterials(attachments: ChatAttachment[], existing: Material[], userId: string, subjectId: string): Material[] {
  const titles = new Set(existing.filter((item) => item.subjectId === subjectId).map((item) => normalizeText(item.title)));
  const created: Material[] = [];
  for (const attachment of attachments) {
    const title = (attachment.name.replace(/\.[^.]+$/, "").trim() || attachment.name).slice(0, 90);
    if (titles.has(normalizeText(title))) continue;
    titles.add(normalizeText(title));
    created.push({
      id: uid("material"),
      userId,
      subjectId,
      title,
      type: attachment.kind === "image" ? "image" : "file",
      detail: `Anexado no chat da Mine (${formatFileSize(attachment.size)})`,
      dataUrl: attachment.dataUrl || undefined,
      content: attachment.text,
      folder: "Mine",
      studied: false,
      favorite: false,
      createdAt: Date.now(),
    });
  }
  return created;
}

function buildAssistantContext(data: ReturnType<typeof useMemoUserData>, user: User, selectedSubjectId?: string) {
  const selectedSubject = selectedSubjectId ? data.subjects.find((subject) => subject.id === selectedSubjectId) : undefined;
  const relevantSubjects = selectedSubject ? [selectedSubject] : data.subjects.slice(0, 10);
  const relevantMaterials = selectedSubjectId ? data.materials.filter((item) => item.subjectId === selectedSubjectId).slice(-20) : data.materials.slice(-12);
  const relevantTasks = selectedSubjectId ? data.tasks.filter((item) => item.subjectId === selectedSubjectId).slice(-12) : data.tasks.slice(-12);
  const subjectLines = relevantSubjects.map((subject) => {
    const materials = data.materials.filter((item) => item.subjectId === subject.id);
    const tasks = data.tasks.filter((item) => item.subjectId === subject.id);
    return `- ${subject.name}: ${materials.length} conteúdos, ${tasks.filter((task) => !task.done).length} tarefas abertas`;
  });
  const perMaterialChars = selectedSubjectId ? 4000 : 700;
  let materialBudget = selectedSubjectId ? 40_000 : 8_000;
  const materialLines: string[] = [];
  for (const item of [...relevantMaterials].reverse()) {
    if (materialBudget <= 0) break;
    const subject = data.subjects.find((subjectItem) => subjectItem.id === item.subjectId);
    const body = (item.content?.trim() || item.detail?.trim() || "").slice(0, Math.min(perMaterialChars, materialBudget));
    const kind = item.type === "image" ? " [imagem enviada]" : item.type === "link" ? " [link]" : item.type === "file" ? " [arquivo anexado]" : "";
    const line = `- ${item.title} (${subject?.name || "sem matéria"})${kind}: ${body || "sem detalhe"}; estudado=${item.studied ? "sim" : "não"}`;
    materialBudget -= line.length;
    materialLines.push(line);
  }
  materialLines.reverse();
  const taskLines = relevantTasks.map((task) => {
    const subject = data.subjects.find((subjectItem) => subjectItem.id === task.subjectId);
    return `- ${task.title} (${subject?.name || "sem matéria"}): ${task.done ? "concluída" : "aberta"}, prazo ${dateLabel(task.dueAt)}${task.note ? `, nota: ${task.note}` : ""}`;
  });
  return [
    `Usuário: ${user.settings.displayName || user.name}`,
    `Estilo da Mine: ${user.settings.mineStyle}`,
    `Sessão de foco: ${user.settings.focusMinutes} minutos`,
    `Matéria selecionada: ${selectedSubject?.name || "contexto geral do site"}`,
    "Matérias:",
    subjectLines.join("\n") || "- nenhuma",
    "Conteúdos:",
    materialLines.join("\n") || "- nenhum conteúdo",
    "Quando o usuário pedir para analisar, resumir, explicar ou corrigir 'o conteúdo', 'os anexos' ou 'o que enviei', use o texto dos conteúdos listados acima como fonte principal da resposta.",
    "Tarefas:",
    taskLines.join("\n") || "- nenhuma",
    "Rotas disponíveis: home, agenda, progress, mine, games, search, plan, comments, suggestions, about e settings.",
  ].join("\n");
}

const mineEndpoint = "/api/mine/chat";

async function requestAssistantResponse(payload: {
  prompt: string;
  history: ChatMessage[];
  context: string;
  model?: MineModelId;
  attachments?: ChatAttachment[];
}): Promise<AssistantResponse> {
  const response = await fetch(mineEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, fast: true, maxOutputTokens: 1500 }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Não consegui responder agora.") as Error & { code?: string };
    error.code = data.code || (response.status === 429 ? "rate_limit" : "error");
    throw error;
  }
  return {
    reply: String(data.reply || ""),
    actions: Array.isArray(data.actions) ? data.actions : [],
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    model: isMineModelId(data.model) ? data.model : undefined,
    notice: typeof data.notice === "string" && data.notice ? data.notice : undefined,
  };
}

/**
 * Mesma chamada, mas em streaming: `onDelta` recebe o texto acumulado a cada
 * pedaço. O evento final traz a versão limpa, que vale mais que a soma dos
 * pedaços, e o nível que de fato respondeu.
 */
async function streamAssistantResponse(
  payload: { prompt: string; history: ChatMessage[]; context: string; model?: MineModelId; attachments?: ChatAttachment[]; webSearch?: boolean },
  options: { onDelta: (text: string) => void; signal: AbortSignal },
): Promise<AssistantResponse> {
  const response = await fetch(mineEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, stream: true, maxOutputTokens: 1500 }),
    signal: options.signal,
  });

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.error || "Não consegui responder agora.") as Error & { code?: string };
    error.code = data.code || (response.status === 429 ? "rate_limit" : "error");
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamed = "";
  let done: AssistantResponse | null = null;

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });

    let split: number;
    while ((split = buffer.indexOf("\n\n")) >= 0) {
      const raw = buffer.slice(0, split).trim();
      buffer = buffer.slice(split + 2);
      if (!raw.startsWith("data:")) continue;

      let event: { type?: string; text?: string; reply?: string; model?: string; notice?: string; error?: string; code?: string; sources?: MineSource[] };
      try {
        event = JSON.parse(raw.slice(5).trim());
      } catch {
        continue;
      }

      if (event.type === "delta") {
        streamed += event.text || "";
        options.onDelta(streamed);
      } else if (event.type === "done") {
        done = {
          reply: event.reply || streamed,
          actions: [],
          suggestions: [],
          model: isMineModelId(event.model) ? event.model : undefined,
          notice: event.notice || undefined,
          sources: Array.isArray(event.sources) ? event.sources : undefined,
        };
      } else if (event.type === "error") {
        const error = new Error(event.error || "Não consegui responder agora.") as Error & { code?: string; partial?: string };
        error.code = event.code || "error";
        error.partial = streamed;
        throw error;
      }
    }
  }

  return done || { reply: streamed, actions: [], suggestions: [] };
}

async function requestAiTask(payload: { prompt: string; task: string; context?: string; model?: MineModelId }): Promise<string> {
  const response = await fetch(mineEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // Tarefas que devolvem uma lista longa de itens (mapa, jogos) precisam de
    // mais espaço; 1500 truncava o 10º item no meio.
    body: JSON.stringify({
      ...payload,
      maxOutputTokens: ["mindmap", "quiz", "vf", "forca", "caca"].includes(payload.task) ? 2600 : 1500,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não consegui gerar agora. Tente de novo.");
  return String(data.reply || "");
}

async function streamGameTask(
  payload: { prompt: string; task: string; context?: string; model?: MineModelId; maxOutputTokens: number },
  options: { signal: AbortSignal; onPartial: (text: string) => void },
): Promise<string> {
  const response = await fetch(mineEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, stream: true, fast: true }),
    signal: options.signal,
  });

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "A Mine nao conseguiu gerar a partida agora.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamed = "";
  let finalReply = "";

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });

    let split: number;
    while ((split = buffer.indexOf("\n\n")) >= 0) {
      const raw = buffer.slice(0, split).trim();
      buffer = buffer.slice(split + 2);
      if (!raw.startsWith("data:")) continue;

      let event: { type?: string; text?: string; reply?: string; error?: string };
      try {
        event = JSON.parse(raw.slice(5).trim());
      } catch {
        continue;
      }
      if (event.type === "delta") {
        streamed += event.text || "";
        options.onPartial(streamed);
      } else if (event.type === "done") {
        finalReply = event.reply || streamed;
      } else if (event.type === "error") {
        throw new Error(event.error || "A geracao foi interrompida.");
      }
    }
  }

  return finalReply || streamed;
}

const flashcardIntervals = [1, 2, 4, 7, 15, 30];

type FlashcardGrade = "errei" | "dificil" | "facil";

function gradeFlashcard(card: Flashcard, grade: FlashcardGrade): Flashcard {
  const lastReviewedAt = Date.now();
  if (grade === "errei") {
    return { ...card, level: 0, reps: card.reps + 1, lapses: card.lapses + 1, lastReviewedAt, dueAt: lastReviewedAt + 10 * 60 * 1000 };
  }
  if (grade === "dificil") {
    return { ...card, reps: card.reps + 1, lastReviewedAt, dueAt: addDays(1) };
  }
  const level = Math.min(card.level + 1, flashcardIntervals.length - 1);
  return { ...card, level, reps: card.reps + 1, lastReviewedAt, dueAt: addDays(flashcardIntervals[level]) };
}

function parseFlashcards(text: string): Array<{ front: string; back: string }> {
  const cards: Array<{ front: string; back: string }> = [];
  let front = "";
  let back = "";
  const flush = () => {
    if (front.trim() && back.trim()) cards.push({ front: front.trim(), back: back.trim() });
    front = "";
    back = "";
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const frontMatch = line.match(/^F:\s*(.+)$/i);
    if (frontMatch) {
      flush();
      front = frontMatch[1];
      continue;
    }
    const backMatch = line.match(/^V:\s*(.+)$/i);
    if (backMatch) {
      back = back ? `${back} ${backMatch[1]}` : backMatch[1];
      continue;
    }
    if (line && back) back += ` ${line}`;
  }
  flush();
  return cards;
}

type QuizQuestion = { question: string; options: string[]; correct: number; explanation: string };

function parseQuiz(text: string): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  let current: QuizQuestion | null = null;
  const flush = () => {
    if (current && current.question && current.options.length >= 2 && current.correct >= 0 && current.correct < current.options.length) {
      questions.push(current);
    }
    current = null;
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const ask = line.match(/^P:\s*(.+)$/i);
    if (ask) {
      flush();
      current = { question: ask[1].trim(), options: [], correct: -1, explanation: "" };
      continue;
    }
    if (!current) continue;
    const option = line.match(/^([A-D])[)\.\-]\s*(.+)$/i);
    if (option) {
      current.options.push(option[2].trim());
      continue;
    }
    const correct = line.match(/^CORRETA:?\s*([A-D])/i);
    if (correct) {
      current.correct = correct[1].toUpperCase().charCodeAt(0) - 65;
      continue;
    }
    const explanation = line.match(/^EXPLICA\S*:?\s*(.+)$/i);
    if (explanation) {
      current.explanation = explanation[1].trim();
      continue;
    }
  }
  flush();
  return questions;
}

type QuizMode = "treino" | "prova";
type QuizConfidence = "certeza" | "duvida";
type QuizReviewFilter = "todas" | "incorretas" | "marcadas";

function QuizModal({
  subject,
  materials,
  user,
  update,
  close,
}: {
  subject: Subject;
  materials: Material[];
  user: User;
  update: (next: (draft: AppData) => AppData) => void;
  close: () => void;
}) {
  const [status, setStatus] = useState<"config" | "loading" | "ready" | "error">("config");
  const [runKey, setRunKey] = useState(0);
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<"facil" | "medio" | "dificil">("medio");
  const [mode, setMode] = useState<QuizMode>("treino");
  const [timeMinutes, setTimeMinutes] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<number | null>>([]);
  const [confidence, setConfidence] = useState<Record<number, QuizConfidence>>({});
  const [eliminated, setEliminated] = useState<Record<number, number[]>>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [finished, setFinished] = useState(false);
  const [finishReason, setFinishReason] = useState<"manual" | "tempo">("manual");
  const [reviewFilter, setReviewFilter] = useState<QuizReviewFilter>("todas");
  const [reviewOpen, setReviewOpen] = useState<number | null>(null);
  const recordedRunRef = useRef(0);

  const score = useMemo(
    () => questions.reduce((total, question, questionIndex) => total + (answers[questionIndex] === question.correct ? 1 : 0), 0),
    [answers, questions],
  );
  const answeredCount = answers.filter((answer) => answer !== null && answer !== undefined).length;
  const flaggedCount = Object.values(flagged).filter(Boolean).length;

  useEffect(() => {
    if (runKey === 0) return;
    let active = true;
    setStatus("loading");
    setQuestions([]);
    setIndex(0);
    setAnswers([]);
    setConfidence({});
    setEliminated({});
    setFlagged({});
    setFinished(false);
    setFinishReason("manual");
    setReviewFilter("todas");
    setReviewOpen(null);
    setElapsedSeconds(0);
    setTimeLeft(timeMinutes > 0 ? timeMinutes * 60 : 0);
    const context = subjectContentContext(subject, materials);
    const diffLabel = difficulty === "facil" ? "facil" : difficulty === "dificil" ? "dificil" : "media";
    const modeHint = mode === "treino" ? "priorize clareza pedagógica e explicações úteis" : "use enunciados variados e alternativas plausíveis";
    requestAiTask({
      task: "quiz",
      prompt: `Gere ${count} questoes de multipla escolha sobre ${subject.name}, com nivel de dificuldade ${diffLabel}; ${modeHint}. Distribua a letra correta entre A, B, C e D.`,
      context,
    })
      .then((text) => {
        if (!active) return;
        const parsed = parseQuiz(text).slice(0, count);
        if (!parsed.length) {
          setStatus("error");
          return;
        }
        setQuestions(parsed);
        setAnswers(Array(parsed.length).fill(null));
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  useEffect(() => {
    if (status !== "ready" || finished) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1);
      if (timeMinutes > 0) setTimeLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status, finished, timeMinutes]);

  useEffect(() => {
    if (status === "ready" && !finished && timeMinutes > 0 && timeLeft <= 0 && questions.length) {
      setFinishReason("tempo");
      setFinished(true);
    }
  }, [finished, questions.length, status, timeLeft, timeMinutes]);

  useEffect(() => {
    if (!finished || !questions.length || recordedRunRef.current === runKey) return;
    recordedRunRef.current = runKey;
    update((draft) => ({
      ...draft,
      sessions: [
        ...draft.sessions,
        {
          id: uid("session"),
          userId: user.id,
          subjectId: subject.id,
          title: `${mode === "treino" ? "Treino" : "Prova"} de ${subject.name}: ${score}/${questions.length}`,
          kind: "Prova",
          createdAt: Date.now(),
        },
      ],
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const question = questions[index];
  const picked = answers[index] ?? null;
  const eliminatedHere = eliminated[index] || [];

  function choose(option: number) {
    if (!question || finished || eliminatedHere.includes(option)) return;
    if (mode === "treino" && picked !== null) return;
    setAnswers((current) => current.map((answer, answerIndex) => (answerIndex === index ? option : answer)));
  }

  function toggleEliminated(option: number) {
    if (picked !== null || finished) return;
    setEliminated((current) => {
      const values = current[index] || [];
      return { ...current, [index]: values.includes(option) ? values.filter((value) => value !== option) : [...values, option] };
    });
  }

  function toggleFlag() {
    setFlagged((current) => ({ ...current, [index]: !current[index] }));
  }

  function finishQuiz() {
    setFinishReason("manual");
    setFinished(true);
    setReviewOpen(null);
  }

  function nextQuestion() {
    if (index + 1 >= questions.length) {
      finishQuiz();
      return;
    }
    setIndex((value) => value + 1);
  }

  useEffect(() => {
    if (status !== "ready" || finished || !question) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select")) return;
      const option = ["a", "b", "c", "d"].indexOf(event.key.toLowerCase());
      if (option >= 0 && option < question.options.length) choose(option);
      if (event.key === "ArrowLeft") setIndex((value) => Math.max(0, value - 1));
      if (event.key === "ArrowRight") setIndex((value) => Math.min(questions.length - 1, value + 1));
      if (event.key.toLowerCase() === "r") toggleFlag();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, eliminated, finished, index, mode, question, questions.length, status]);

  const percentage = Math.round((score / Math.max(questions.length, 1)) * 100);
  const confidentAnswers = questions.map((item, questionIndex) => ({ item, questionIndex })).filter(({ questionIndex }) => confidence[questionIndex] === "certeza" && answers[questionIndex] !== null);
  const confidentCorrect = confidentAnswers.filter(({ item, questionIndex }) => answers[questionIndex] === item.correct).length;
  const calibration = confidentAnswers.length ? Math.round((confidentCorrect / confidentAnswers.length) * 100) : 0;
  const reviewIndices = questions
    .map((item, questionIndex) => ({ item, questionIndex }))
    .filter(({ item, questionIndex }) => {
      if (reviewFilter === "incorretas") return answers[questionIndex] !== item.correct;
      if (reviewFilter === "marcadas") return Boolean(flagged[questionIndex]);
      return true;
    });

  return (
    <div className="quiz-lab space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-mint/25 bg-mint/12 text-mint">
            <ClipboardCheck className="relative z-10 h-6 w-6" />
            <span aria-hidden className="absolute inset-x-1 bottom-0 h-px bg-mint shadow-[0_0_18px_rgb(var(--mint))]" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[.2em] text-mint">Laboratório de provas</p>
            <h2 className="truncate font-display text-2xl font-black">{subject.name}</h2>
          </div>
        </div>
        <button onClick={close} aria-label="Fechar" className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-white/60 transition hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      {status === "config" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["treino", Brain, "Treino guiado", "Correção e explicação depois de cada resposta."],
                ["prova", ClipboardCheck, "Simulado real", "Gabarito e análise completos somente ao entregar."],
              ] as const).map(([value, Icon, title, text]) => (
                <motion.button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.985 }}
                  className={`card-motion-surface relative overflow-hidden rounded-3xl border p-4 text-left ${mode === value ? "border-mint/55 bg-mint/[0.11]" : "border-white/10 bg-white/[0.035] hover:border-white/20"}`}
                >
                  <span className={`grid h-10 w-10 place-items-center rounded-2xl ${mode === value ? "bg-mint text-black" : "bg-white/[0.07] text-white/65"}`}><Icon className="h-5 w-5" /></span>
                  <span className="mt-4 block font-display text-lg font-black">{title}</span>
                  <span className="mt-1 block text-sm leading-5 text-white/52">{text}</span>
                  {mode === value ? <CheckCircle2 className="absolute right-4 top-4 h-5 w-5 text-mint" /> : null}
                </motion.button>
              ))}
            </div>

            <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
              <div className="grid gap-5 md:grid-cols-3">
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[.13em] text-white/42">Questões</p>
                  <div className="flex flex-wrap gap-2">
                    {[5, 10, 15].map((value) => (
                      <button key={value} onClick={() => setCount(value)} className={`rounded-xl px-3 py-2 text-sm font-black transition ${count === value ? "bg-mint text-black" : "bg-white/[0.07] text-white/64 hover:bg-white/[0.11]"}`}>{value}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[.13em] text-white/42">Dificuldade</p>
                  <div className="flex flex-wrap gap-2">
                    {([["facil", "Fácil"], ["medio", "Média"], ["dificil", "Difícil"]] as const).map(([value, label]) => (
                      <button key={value} onClick={() => setDifficulty(value)} className={`rounded-xl px-3 py-2 text-sm font-black transition ${difficulty === value ? "bg-mint text-black" : "bg-white/[0.07] text-white/64 hover:bg-white/[0.11]"}`}>{label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[.13em] text-white/42">Cronômetro</p>
                  <div className="flex flex-wrap gap-2">
                    {[0, 5, 10, 20].map((value) => (
                      <button key={value} onClick={() => setTimeMinutes(value)} className={`rounded-xl px-3 py-2 text-sm font-black transition ${timeMinutes === value ? "bg-mint text-black" : "bg-white/[0.07] text-white/64 hover:bg-white/[0.11]"}`}>{value === 0 ? "Livre" : `${value}m`}</button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <Tilt3D className="h-full rounded-3xl" max={5} lift={4}>
            <aside className="relative flex h-full min-h-64 flex-col overflow-hidden rounded-3xl border border-mint/20 bg-[linear-gradient(145deg,rgb(var(--mint)/.13),rgba(255,255,255,.025)_52%)] p-5">
              <span aria-hidden className="quiz-config-orbit" />
              <p className="text-xs font-black uppercase tracking-[.18em] text-mint">Sua configuração</p>
              <div className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between border-b border-white/8 pb-3"><span className="text-white/45">Formato</span><strong>{mode === "treino" ? "Treino guiado" : "Simulado real"}</strong></div>
                <div className="flex items-center justify-between border-b border-white/8 pb-3"><span className="text-white/45">Extensão</span><strong>{count} questões</strong></div>
                <div className="flex items-center justify-between border-b border-white/8 pb-3"><span className="text-white/45">Nível</span><strong>{difficulty === "facil" ? "Fácil" : difficulty === "dificil" ? "Difícil" : "Médio"}</strong></div>
                <div className="flex items-center justify-between"><span className="text-white/45">Tempo</span><strong>{timeMinutes ? `${timeMinutes} min` : "Sem limite"}</strong></div>
              </div>
              <button onClick={() => setRunKey((value) => value + 1)} className="mt-auto inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-mint px-4 py-3 font-black text-black shadow-[0_18px_35px_-18px_rgb(var(--mint))] transition hover:-translate-y-0.5">
                <Sparkles className="h-5 w-5" /> Criar com a Mine
              </button>
            </aside>
          </Tilt3D>
        </div>
      )}

      {status === "loading" && (
        <div className="quiz-build-stage grid min-h-[25rem] place-items-center overflow-hidden rounded-3xl border border-white/10 bg-black/20 p-8 text-center">
          <div>
            <div className="quiz-build-core mx-auto"><Brain className="h-8 w-8" /><span /><span /></div>
            <p className="mt-7 font-display text-2xl font-black">A Mine está construindo sua prova</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/50">Selecionando conceitos, equilibrando alternativas e preparando explicações para {subject.name}.</p>
            <div className="mx-auto mt-6 flex max-w-sm items-center gap-2">
              {["Conteúdo", "Questões", "Gabarito"].map((label, step) => <span key={label} className="quiz-build-step" style={{ animationDelay: `${step * 0.38}s` }}>{label}</span>)}
            </div>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="grid place-items-center gap-4 rounded-3xl border border-rose-300/15 bg-rose-400/[0.05] py-12 text-center">
          <XCircle className="h-9 w-9 text-rose-300" />
          <p className="text-white/70">Não consegui montar a prova agora. Sua configuração foi mantida.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <PrimaryButton icon={RefreshCw} onClick={() => setRunKey((value) => value + 1)}>Tentar de novo</PrimaryButton>
            <SecondaryButton icon={ChevronLeft} onClick={() => setStatus("config")}>Configurar</SecondaryButton>
          </div>
        </div>
      )}

      {status === "ready" && !finished && question && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15.5rem]">
          <main className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.025] p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.13em] text-white/45">
                <span className="rounded-full bg-mint/12 px-3 py-1.5 text-mint">{mode === "treino" ? "Treino" : "Prova"}</span>
                <span>Questão {index + 1}/{questions.length}</span>
              </div>
              <div className="flex items-center gap-2">
                {timeMinutes > 0 ? <span className={`rounded-full px-3 py-1.5 font-display text-sm font-black ${timeLeft <= 30 ? "bg-rose-400/12 text-rose-300" : "bg-white/[0.06] text-white/70"}`}><Timer className="mr-1 inline h-4 w-4" />{String(Math.floor(timeLeft / 60)).padStart(2, "0")}:{String(timeLeft % 60).padStart(2, "0")}</span> : null}
                <button onClick={toggleFlag} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-black transition ${flagged[index] ? "bg-amber-300 text-black" : "bg-white/[0.06] text-white/55 hover:text-amber-200"}`}><Star className={`h-4 w-4 ${flagged[index] ? "fill-black" : ""}`} /> Revisar</button>
              </div>
            </div>

            <motion.div key={index} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.24, ease: ease.out }}>
              <p className="max-w-3xl font-display text-xl font-black leading-snug sm:text-2xl">{question.question}</p>
              <div className="mt-6 space-y-2.5">
                {question.options.map((option, optionIndex) => {
                  const revealed = mode === "treino" && picked !== null;
                  const isCorrect = optionIndex === question.correct;
                  const isPicked = optionIndex === picked;
                  const isEliminated = eliminatedHere.includes(optionIndex);
                  const tone = revealed
                    ? isCorrect
                      ? "border-mint/60 bg-mint/15 text-mint"
                      : isPicked
                        ? "border-rose-400/50 bg-rose-500/10 text-rose-200"
                        : "border-white/8 bg-white/[0.025] text-white/35"
                    : isPicked
                      ? "border-mint/60 bg-mint/12 text-white"
                      : "border-white/10 bg-white/[0.04] hover:border-mint/35 hover:bg-mint/[0.07]";
                  return (
                    <div key={optionIndex} className={`group flex items-stretch gap-2 ${isEliminated ? "opacity-35" : ""}`}>
                      <button type="button" onClick={() => choose(optionIndex)} disabled={isEliminated || (mode === "treino" && picked !== null)} className={`flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl border px-4 py-3 text-left font-bold transition ${tone} ${isEliminated ? "line-through" : ""}`}>
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-black ${isPicked ? "bg-mint text-black" : "bg-black/25 text-white/70"}`}>{String.fromCharCode(65 + optionIndex)}</span>
                        <span className="min-w-0 flex-1">{option}</span>
                        {revealed && isCorrect ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : null}
                        {revealed && isPicked && !isCorrect ? <XCircle className="h-5 w-5 shrink-0" /> : null}
                      </button>
                      {!revealed && picked === null ? (
                        <button type="button" onClick={() => toggleEliminated(optionIndex)} aria-label={`${isEliminated ? "Restaurar" : "Eliminar"} alternativa ${String.fromCharCode(65 + optionIndex)}`} title={isEliminated ? "Restaurar alternativa" : "Eliminar alternativa"} className="grid w-11 shrink-0 place-items-center rounded-2xl border border-white/8 bg-white/[0.025] text-white/25 transition hover:border-rose-300/30 hover:text-rose-200"><Minus className="h-4 w-4" /></button>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-[.12em] text-white/35">Sua confiança</span>
                  {([["certeza", "Tenho certeza"], ["duvida", "Estou em dúvida"]] as const).map(([value, label]) => (
                    <button key={value} onClick={() => setConfidence((current) => ({ ...current, [index]: value }))} className={`rounded-full px-3 py-1.5 text-xs font-black transition ${confidence[index] === value ? "bg-white text-black" : "bg-white/[0.06] text-white/48 hover:text-white"}`}>{label}</button>
                  ))}
                </div>
                <span className="hidden text-[11px] font-bold text-white/28 sm:inline">Atalhos: A–D · ← → · R para revisar</span>
              </div>

              {mode === "treino" && picked !== null ? (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 rounded-2xl border p-4 ${picked === question.correct ? "border-mint/25 bg-mint/[0.07]" : "border-rose-300/20 bg-rose-400/[0.055]"}`}>
                  <p className="text-sm leading-6 text-white/72"><strong className="text-white">{picked === question.correct ? "Resposta correta. " : "Ainda não. "}</strong>{question.explanation || `A alternativa correta é ${String.fromCharCode(65 + question.correct)}.`}</p>
                  <div className="mt-4"><PrimaryButton icon={ArrowRight} onClick={nextQuestion}>{index + 1 >= questions.length ? "Concluir treino" : "Próxima questão"}</PrimaryButton></div>
                </motion.div>
              ) : null}
            </motion.div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white/[0.06] px-4 text-sm font-black text-white/58 transition hover:text-white disabled:opacity-30"><ChevronLeft className="h-4 w-4" /> Anterior</button>
              {mode === "prova" ? (
                index + 1 < questions.length ? <button onClick={() => setIndex((value) => value + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white/[0.08] px-4 text-sm font-black transition hover:bg-white/[0.12]">Próxima <ChevronRight className="h-4 w-4" /></button> : <button onClick={finishQuiz} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-mint px-4 text-sm font-black text-black"><ClipboardCheck className="h-4 w-4" /> Entregar prova</button>
              ) : picked === null && index + 1 < questions.length ? (
                <button onClick={() => setIndex((value) => value + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white/[0.08] px-4 text-sm font-black text-white/70">Pular <SkipForward className="h-4 w-4" /></button>
              ) : null}
            </div>
          </main>

          <aside className="space-y-3 lg:sticky lg:top-0 lg:self-start">
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[.15em] text-white/42">Mapa da prova</p><span className="font-display text-sm font-black text-mint">{answeredCount}/{questions.length}</span></div>
              <div className="mt-4 grid grid-cols-5 gap-2">
                {questions.map((item, questionIndex) => {
                  const answered = answers[questionIndex] !== null;
                  const active = questionIndex === index;
                  return <button key={questionIndex} onClick={() => setIndex(questionIndex)} aria-label={`Ir para questão ${questionIndex + 1}`} className={`relative grid aspect-square place-items-center rounded-xl border text-xs font-black transition ${active ? "border-mint bg-mint text-black" : answered ? "border-mint/25 bg-mint/10 text-mint" : "border-white/8 bg-white/[0.035] text-white/40 hover:text-white"}`}>{questionIndex + 1}{flagged[questionIndex] ? <Star className={`absolute -right-1 -top-1 h-3.5 w-3.5 ${active ? "fill-black text-black" : "fill-amber-300 text-amber-300"}`} /> : null}</button>;
                })}
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><motion.span className="block h-full rounded-full bg-mint" animate={{ width: `${(answeredCount / Math.max(questions.length, 1)) * 100}%` }} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-3"><span className="text-[10px] font-black uppercase tracking-wider text-white/32">Respondidas</span><strong className="mt-1 block font-display text-xl">{answeredCount}</strong></div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-3"><span className="text-[10px] font-black uppercase tracking-wider text-white/32">Para revisar</span><strong className="mt-1 block font-display text-xl text-amber-200">{flaggedCount}</strong></div>
            </div>
            {mode === "prova" ? <button onClick={finishQuiz} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-mint/30 bg-mint/10 px-4 font-black text-mint transition hover:bg-mint hover:text-black"><ClipboardCheck className="h-5 w-5" /> Entregar agora</button> : null}
          </aside>
        </div>
      )}

      {status === "ready" && finished && (
        <div className="space-y-5">
          <section className="relative overflow-hidden rounded-3xl border border-mint/20 bg-[radial-gradient(circle_at_16%_0%,rgb(var(--mint)/.16),transparent_24rem),rgba(255,255,255,.025)] p-5 sm:p-7">
            <div className="grid items-center gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
              <div className="relative grid h-32 w-32 place-items-center rounded-full border-[10px] border-white/[0.06] bg-black/20 shadow-[0_0_55px_rgb(var(--mint)/.12)]">
                <span className="font-display text-3xl font-black text-mint">{percentage}%</span>
                <svg aria-hidden className="absolute -inset-[10px] -rotate-90" viewBox="0 0 128 128"><circle cx="64" cy="64" r="58" fill="none" stroke="rgb(var(--mint))" strokeWidth="7" strokeLinecap="round" pathLength="100" strokeDasharray={`${percentage} 100`} /></svg>
              </div>
              <div>
                {finishReason === "tempo" ? <p className="mb-2 text-xs font-black uppercase tracking-[.16em] text-rose-300">Tempo esgotado</p> : <p className="mb-2 text-xs font-black uppercase tracking-[.16em] text-mint">Análise concluída</p>}
                <h3 className="font-display text-3xl font-black">{score} acertos em {questions.length}</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/52">{percentage >= 80 ? "Ótimo domínio. Use a revisão abaixo para consolidar os detalhes." : percentage >= 50 ? "Boa base. A análise mostra exatamente onde concentrar sua próxima revisão." : "A prova virou um diagnóstico: revise os erros explicados e tente novamente depois."}</p>
                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["Corretas", score, "text-mint"],
                    ["Incorretas", questions.length - score - (questions.length - answeredCount), "text-rose-200"],
                    ["Em branco", questions.length - answeredCount, "text-white/70"],
                    ["Tempo", `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`, "text-cyanGlow"],
                  ].map(([label, value, tone]) => <div key={label} className="rounded-2xl border border-white/8 bg-black/15 p-3"><span className="text-[10px] font-black uppercase tracking-wider text-white/32">{label}</span><strong className={`mt-1 block font-display text-lg ${tone}`}>{value}</strong></div>)}
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/9 bg-white/[0.03] p-4"><Target className="h-5 w-5 text-mint" /><p className="mt-3 text-xs font-black uppercase tracking-[.12em] text-white/35">Precisão</p><strong className="mt-1 block font-display text-2xl">{percentage}%</strong></div>
            <div className="rounded-2xl border border-white/9 bg-white/[0.03] p-4"><Brain className="h-5 w-5 text-violet-300" /><p className="mt-3 text-xs font-black uppercase tracking-[.12em] text-white/35">Calibração da certeza</p><strong className="mt-1 block font-display text-2xl">{confidentAnswers.length ? `${calibration}%` : "—"}</strong></div>
            <div className="rounded-2xl border border-white/9 bg-white/[0.03] p-4"><Star className="h-5 w-5 text-amber-300" /><p className="mt-3 text-xs font-black uppercase tracking-[.12em] text-white/35">Marcadas para revisar</p><strong className="mt-1 block font-display text-2xl">{flaggedCount}</strong></div>
          </div>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-[.16em] text-mint">Revisão inteligente</p><h3 className="mt-1 font-display text-xl font-black">Entenda cada resposta</h3></div>
              <div className="flex flex-wrap gap-2">
                {([["todas", "Todas"], ["incorretas", "Erros e brancos"], ["marcadas", "Marcadas"]] as const).map(([value, label]) => <button key={value} onClick={() => setReviewFilter(value)} className={`rounded-full px-3 py-1.5 text-xs font-black transition ${reviewFilter === value ? "bg-mint text-black" : "bg-white/[0.06] text-white/50"}`}>{label}</button>)}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {reviewIndices.map(({ item, questionIndex }) => {
                const answer = answers[questionIndex];
                const correct = answer === item.correct;
                const open = reviewOpen === questionIndex;
                return (
                  <div key={questionIndex} className={`overflow-hidden rounded-2xl border ${correct ? "border-mint/15 bg-mint/[0.035]" : "border-rose-300/15 bg-rose-400/[0.035]"}`}>
                    <button onClick={() => setReviewOpen(open ? null : questionIndex)} className="flex w-full items-center gap-3 p-4 text-left">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${correct ? "bg-mint text-black" : "bg-rose-300/15 text-rose-200"}`}>{correct ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}</span>
                      <span className="min-w-0 flex-1"><span className="block text-[10px] font-black uppercase tracking-wider text-white/35">Questão {questionIndex + 1}</span><span className="mt-0.5 block truncate font-bold">{item.question}</span></span>
                      {flagged[questionIndex] ? <Star className="h-4 w-4 fill-amber-300 text-amber-300" /> : null}
                      <ChevronDown className={`h-4 w-4 text-white/40 transition ${open ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence initial={false}>{open ? <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="border-t border-white/8 px-4 py-4 text-sm leading-6"><p className="text-white/50">Sua resposta: <strong className={correct ? "text-mint" : "text-rose-200"}>{answer === null || answer === undefined ? "Em branco" : `${String.fromCharCode(65 + answer)} — ${item.options[answer]}`}</strong></p><p className="mt-1 text-white/50">Resposta correta: <strong className="text-white">{String.fromCharCode(65 + item.correct)} — {item.options[item.correct]}</strong></p><p className="mt-3 rounded-xl bg-black/15 p-3 text-white/72">{item.explanation || "Revise este conceito no conteúdo da matéria."}</p></div></motion.div> : null}</AnimatePresence>
                  </div>
                );
              })}
              {!reviewIndices.length ? <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/45">Nenhuma questão neste filtro.</p> : null}
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <PrimaryButton icon={RefreshCw} onClick={() => setRunKey((value) => value + 1)}>Nova versão</PrimaryButton>
            <SecondaryButton icon={Settings} onClick={() => setStatus("config")}>Mudar configuração</SecondaryButton>
            <SecondaryButton icon={ChevronLeft} onClick={close}>Fechar</SecondaryButton>
          </div>
        </div>
      )}
    </div>
  );
}

type Mindmap = { title: string; branches: { label: string; items: string[] }[] };
type MindmapSide = "left" | "right";

function cleanMindmapLabel(text: string) {
  return text
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/\s+/g, " ")
    .replace(/:$/, "")
    .trim();
}

function parseMindmap(text: string): Mindmap {
  let title = "";
  const branches: { label: string; items: string[] }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const heading = raw.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      if (!title) title = cleanMindmapLabel(heading[1]);
      continue;
    }
    // "RAMO: nome" \u00e9 o formato pedido hoje: marcador expl\u00edcito no in\u00edcio da
    // linha, como P:/CORRETA: no simulado. Indenta\u00e7\u00e3o os modelos perdem.
    const marked = raw.match(/^\s*RAMO\s*:\s*(.+)$/i);
    if (marked) {
      const label = cleanMindmapLabel(marked[1]);
      if (label && !/\[.+\]/.test(label)) branches.push({ label, items: [] });
      continue;
    }

    const bullet = raw.match(/^(\s*)(?:[-*]|\d+[.)]|\u2022|\u2023)\s+(.+)$/);
    if (bullet) {
      const value = cleanMindmapLabel(bullet[2]);
      if (!value) continue;
      // linha de template devolvida crua pelo modelo \u2014 n\u00e3o vira n\u00f3
      if (/\[.+\]/.test(value)) continue;
      const indent = bullet[1].replace(/\t/g, "  ").length;
      // Sem marcador (respostas antigas ou de outro modelo): cai no formato
      // indentado, e "palavra-chave: frase" ainda separa subitem de ramo.
      const looksLikeItem = indent >= 2 || /^[^:]{2,40}:\s*\S/.test(value);
      if (looksLikeItem && branches.length) {
        branches[branches.length - 1].items.push(value);
      } else {
        branches.push({ label: value, items: [] });
      }
    }
  }
  // Ramo sem filho vira um nó solto pendurado no centro. Quando o modelo
  // acerta a maioria, os ramos vazios são ruído — só ficam se forem todos.
  const filled = branches.filter((branch) => branch.items.length);
  return { title, branches: filled.length ? filled : branches };
}

function mindCurve(x1: number, y1: number, x2: number, y2: number) {
  const direction = x2 >= x1 ? 1 : -1;
  const dx = Math.max(Math.abs(x2 - x1) * 0.42, 34);
  return `M ${x1} ${y1} C ${x1 + direction * dx} ${y1}, ${x2 - direction * dx} ${y2}, ${x2} ${y2}`;
}

function truncLabel(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 3).trimEnd()}...` : text;
}

function estimateTextLines(text: string, charsPerLine: number, maxLines: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  let lines = 1;
  let current = 0;
  words.forEach((word) => {
    const next = current ? current + word.length + 1 : word.length;
    if (next > charsPerLine && current) {
      lines += 1;
      current = word.length;
    } else {
      current = next;
    }
  });
  return Math.max(1, Math.min(maxLines, lines));
}

function splitMindmapItem(text: string) {
  const clean = cleanMindmapLabel(text);
  const keyed = clean.match(/^([^:]{2,30}):\s*(.+)$/);
  if (keyed) {
    return {
      keyword: truncLabel(cleanMindmapLabel(keyed[1]), 24),
      detail: truncLabel(cleanMindmapLabel(keyed[2]), 118),
    };
  }
  const words = clean.split(/\s+/).filter(Boolean);
  return {
    keyword: truncLabel(words.slice(0, 2).join(" ") || "Ponto", 24),
    detail: truncLabel(clean, 118),
  };
}

function hexAlpha(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const value = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(value.slice(0, 2), 16) || 0;
  const g = parseInt(value.slice(2, 4), 16) || 0;
  const b = parseInt(value.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildMindmapLayout(map: Mindmap, palette: string[]) {
  const width = 1240;
  const padY = 52;
  const itemGap = 13;
  const branchGap = 36;
  const rootW = 228;
  const rootH = 88;
  const branchW = 196;
  const itemW = 270;
  const rootX = (width - rootW) / 2;
  const leftBranchX = rootX - branchW - 36;
  const rightBranchX = rootX + rootW + 36;
  const leftItemX = 18;
  const rightItemX = width - itemW - 18;

  const cleanBranches = map.branches
    .map((branch) => ({
      label: truncLabel(cleanMindmapLabel(branch.label), 64),
      items: branch.items.map((item) => truncLabel(cleanMindmapLabel(item), 132)).filter(Boolean),
    }))
    .filter((branch) => branch.label);

  const clusters = cleanBranches.map((branch, index) => {
    const side: MindmapSide = index % 2 === 0 ? "right" : "left";
    const itemHeights = (branch.items.length ? branch.items : ["Ponto principal do tema."]).map((item) => {
      const parts = splitMindmapItem(item);
      const lines = estimateTextLines(parts.detail, 34, 4);
      return { label: item, keyword: parts.keyword, detail: parts.detail, h: Math.max(60, lines * 15 + 34) };
    });
    const itemBlockHeight = itemHeights.reduce((sum, item) => sum + item.h, 0) + Math.max(0, itemHeights.length - 1) * itemGap;
    const branchHeight = Math.max(58, estimateTextLines(branch.label, 18, 3) * 18 + 24);
    return {
      index,
      side,
      label: branch.label,
      color: palette[index % palette.length],
      branchHeight,
      itemHeights,
      clusterHeight: Math.max(itemBlockHeight, branchHeight),
      itemBlockHeight,
    };
  });

  const sideHeight = (side: MindmapSide) => {
    const items = clusters.filter((cluster) => cluster.side === side);
    if (!items.length) return 0;
    return items.reduce((sum, cluster) => sum + cluster.clusterHeight, 0) + (items.length - 1) * branchGap;
  };
  const height = Math.max(560, Math.max(sideHeight("left"), sideHeight("right")) + padY * 2);
  const rootY = height / 2;

  const laySide = (side: MindmapSide) => {
    const sideClusters = clusters.filter((cluster) => cluster.side === side);
    const total = sideHeight(side);
    let cursor = (height - total) / 2;
    return sideClusters.map((cluster) => {
      const y = cursor + cluster.clusterHeight / 2;
      const branchX = side === "right" ? rightBranchX : leftBranchX;
      const itemX = side === "right" ? rightItemX : leftItemX;
      let itemCursor = y - cluster.itemBlockHeight / 2;
      const items = cluster.itemHeights.map((item, itemIndex) => {
        const itemY = itemCursor + item.h / 2;
        itemCursor += item.h + itemGap;
        return { label: item.label, keyword: item.keyword, detail: item.detail, order: `${cluster.index + 1}.${itemIndex + 1}`, x: itemX, y: itemY, w: itemW, h: item.h };
      });
      const panelX = side === "right" ? branchX - 18 : itemX - 18;
      const panelW = side === "right" ? itemX + itemW - branchX + 36 : branchX + branchW - itemX + 36;
      cursor += cluster.clusterHeight + branchGap;
      return {
        index: cluster.index,
        side,
        label: cluster.label,
        color: cluster.color,
        panelX,
        panelY: y - cluster.clusterHeight / 2 - 14,
        panelW,
        panelH: cluster.clusterHeight + 28,
        x: branchX,
        y,
        w: branchW,
        h: cluster.branchHeight,
        items,
      };
    });
  };

  const branches = [...laySide("left"), ...laySide("right")].sort((a, b) => a.index - b.index);
  return { width, height, rootX, rootY, rootW, rootH, branchW, itemW, branches };
}

function mindmapToText(map: Mindmap, central: string): string {
  const lines: string[] = [central || map.title || "Mapa mental", ""];
  map.branches.forEach((branch) => {
    lines.push(`- ${branch.label}`);
    branch.items.forEach((item) => lines.push(`   - ${item}`));
    lines.push("");
  });
  return lines.join("\n").trim();
}

function escapeHtml(text: string) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(text).replace(/[&<>"']/g, (char) => entities[char]);
}

function mindmapToCanvas(map: Mindmap, palette: string[], central: string): HTMLCanvasElement | null {
  const layout = buildMindmapLayout(map, palette);
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(layout.width * scale);
  canvas.height = Math.round(layout.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);

  const bg = ctx.createLinearGradient(0, 0, layout.width, layout.height);
  bg.addColorStop(0, "#09090B");
  bg.addColorStop(0.55, "#111827");
  bg.addColorStop(1, "#0F172A");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.strokeStyle = "rgba(255,255,255,0.045)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= layout.width; x += 42) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, layout.height);
    ctx.stroke();
  }
  for (let y = 0; y <= layout.height; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(layout.width, y);
    ctx.stroke();
  }

  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };
  const curve = (x1: number, y1: number, x2: number, y2: number, color: string, width: number, alpha: number) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    const direction = x2 >= x1 ? 1 : -1;
    const dx = Math.max(Math.abs(x2 - x1) * 0.42, 34);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1 + direction * dx, y1, x2 - direction * dx, y2, x2, y2);
    ctx.stroke();
    ctx.restore();
  };
  const wrap = (text: string, maxWidth: number, font: string): string[] => {
    ctx.font = font;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines.slice(0, 4);
  };
  const drawLines = (lines: string[], x: number, centerY: number, lineH: number, font: string, color: string, align: CanvasTextAlign) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    let cy = centerY - ((lines.length - 1) * lineH) / 2;
    for (const line of lines) {
      ctx.fillText(line, x, cy);
      cy += lineH;
    }
  };

  layout.branches.forEach((branch) => {
    ctx.fillStyle = "rgba(255,255,255,0.032)";
    roundRect(branch.panelX, branch.panelY, branch.panelW, branch.panelH, 24);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.075)";
    ctx.lineWidth = 1;
    roundRect(branch.panelX, branch.panelY, branch.panelW, branch.panelH, 24);
    ctx.stroke();
    ctx.fillStyle = branch.color;
    const accentX = branch.side === "right" ? branch.panelX : branch.panelX + branch.panelW - 5;
    roundRect(accentX, branch.panelY + 18, 5, branch.panelH - 36, 3);
    ctx.fill();
  });

  layout.branches.forEach((branch) => {
    const rootX = branch.side === "right" ? layout.rootX + layout.rootW : layout.rootX;
    const branchAnchorX = branch.side === "right" ? branch.x : branch.x + branch.w;
    curve(rootX, layout.rootY, branchAnchorX, branch.y, branch.color, 3.2, 0.55);
    branch.items.forEach((item) => {
      const fromX = branch.side === "right" ? branch.x + branch.w : branch.x;
      const toX = branch.side === "right" ? item.x : item.x + item.w;
      curve(fromX, branch.y, toX, item.y, branch.color, 2, 0.32);
    });
  });

  const grad = ctx.createLinearGradient(layout.rootX, 0, layout.rootX + layout.rootW, 0);
  grad.addColorStop(0, "#34D399");
  grad.addColorStop(0.55, "#38BDF8");
  grad.addColorStop(1, "#FBBF24");
  ctx.shadowColor = "rgba(52,211,153,0.34)";
  ctx.shadowBlur = 30;
  ctx.fillStyle = grad;
  roundRect(layout.rootX, layout.rootY - layout.rootH / 2, layout.rootW, layout.rootH, 24);
  ctx.fill();
  ctx.shadowBlur = 0;
  drawLines(wrap(central || map.title || "Mapa", layout.rootW - 30, "700 18px sans-serif"), layout.rootX + layout.rootW / 2, layout.rootY, 20, "700 18px sans-serif", "#04120B", "center");

  layout.branches.forEach((branch, index) => {
    ctx.fillStyle = "rgba(16,17,23,0.95)";
    roundRect(branch.x, branch.y - branch.h / 2, branch.w, branch.h, 18);
    ctx.fill();
    ctx.strokeStyle = branch.color;
    ctx.lineWidth = 2;
    roundRect(branch.x, branch.y - branch.h / 2, branch.w, branch.h, 18);
    ctx.stroke();
    ctx.fillStyle = branch.color;
    roundRect(branch.x + 10, branch.y - 13, 26, 26, 13);
    ctx.fill();
    drawLines([String(index + 1)], branch.x + 23, branch.y, 16, "700 12px sans-serif", "#050507", "center");
    drawLines(wrap(branch.label, branch.w - 58, "700 14px sans-serif"), branch.x + 48, branch.y, 16, "700 14px sans-serif", "#ffffff", "left");
  });

  layout.branches.forEach((branch) =>
    branch.items.forEach((item) => {
      ctx.fillStyle = "rgba(255,255,255,0.065)";
      roundRect(item.x, item.y - item.h / 2, item.w, item.h, 14);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      roundRect(item.x, item.y - item.h / 2, item.w, item.h, 14);
      ctx.stroke();
      ctx.fillStyle = branch.color;
      roundRect(item.x + 12, item.y - item.h / 2 + 12, 36, 21, 10);
      ctx.fill();
      drawLines([item.order], item.x + 30, item.y - item.h / 2 + 22.5, 12, "700 10px sans-serif", "#050507", "center");
      ctx.font = "700 10px sans-serif";
      ctx.fillStyle = branch.color;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(item.keyword.toUpperCase(), item.x + 58, item.y - item.h / 2 + 13);
      drawLines(wrap(item.detail, item.w - 70, "400 12px sans-serif"), item.x + 58, item.y + 10, 15, "400 12px sans-serif", "rgba(255,255,255,0.9)", "left");
    }),
  );

  return canvas;
}

function mindmapToHtmlDocument(map: Mindmap, palette: string[], central: string) {
  const layout = buildMindmapLayout(map, palette);
  const title = central || map.title || "Mapa mental";
  const panelNodes = layout.branches
    .map((branch) => {
      const accentX = branch.side === "right" ? branch.panelX : branch.panelX + branch.panelW - 5;
      return `<rect x="${branch.panelX}" y="${branch.panelY}" width="${branch.panelW}" height="${branch.panelH}" rx="24" fill="rgba(255,255,255,.032)" stroke="rgba(255,255,255,.075)" />
<rect x="${accentX}" y="${branch.panelY + 18}" width="5" height="${branch.panelH - 36}" rx="3" fill="${branch.color}" />`;
    })
    .join("\n");
  const branchCurves = layout.branches
    .map((branch) => {
      const rootX = branch.side === "right" ? layout.rootX + layout.rootW : layout.rootX;
      const branchAnchorX = branch.side === "right" ? branch.x : branch.x + branch.w;
      return `<path d="${mindCurve(rootX, layout.rootY, branchAnchorX, branch.y)}" fill="none" stroke="${branch.color}" stroke-width="3.2" stroke-linecap="round" stroke-opacity=".55" />`;
    })
    .join("\n");
  const itemCurves = layout.branches
    .flatMap((branch) =>
      branch.items.map((item) => {
        const fromX = branch.side === "right" ? branch.x + branch.w : branch.x;
        const toX = branch.side === "right" ? item.x : item.x + item.w;
        return `<path d="${mindCurve(fromX, branch.y, toX, item.y)}" fill="none" stroke="${branch.color}" stroke-width="2" stroke-linecap="round" stroke-opacity=".32" />`;
      }),
    )
    .join("\n");
  const branchNodes = layout.branches
    .map(
      (branch, index) => `<foreignObject x="${branch.x}" y="${branch.y - branch.h / 2}" width="${branch.w}" height="${branch.h}">
  <div class="branch" style="border-color:${branch.color}">
    <span class="index" style="background:${branch.color}">${index + 1}</span>
    <span>${escapeHtml(branch.label)}</span>
  </div>
</foreignObject>`,
    )
    .join("\n");
  const itemNodes = layout.branches
    .flatMap((branch) =>
      branch.items.map(
        (item) => `<foreignObject x="${item.x}" y="${item.y - item.h / 2}" width="${item.w}" height="${item.h}">
  <div class="item">
    <span class="order" style="background:${branch.color}">${escapeHtml(item.order)}</span>
    <span class="item-copy">
      <span class="item-key" style="color:${branch.color}">${escapeHtml(item.keyword)}</span>
      <span class="item-text">${escapeHtml(item.detail)}</span>
    </span>
  </div>
</foreignObject>`,
      ),
    )
    .join("\n");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; letter-spacing: 0; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background: linear-gradient(135deg, #09090b 0%, #111827 58%, #0f172a 100%);
      color: white;
      font-family: "Plus Jakarta Sans", Inter, system-ui, sans-serif;
    }
    main { width: min(100%, 1240px); }
    h1 { margin: 0 0 16px; font-size: clamp(24px, 4vw, 42px); line-height: 1.05; }
    svg {
      width: 100%;
      height: auto;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 22px;
      background:
        linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px);
      background-size: 42px 42px;
      overflow: visible;
    }
    .root, .branch, .item {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      overflow-wrap: anywhere;
    }
    .root {
      justify-content: center;
      padding: 12px 18px;
      border-radius: 24px;
      color: #04120b;
      text-align: center;
      font-weight: 900;
      font-size: 18px;
      line-height: 1.15;
      background: linear-gradient(90deg, #34d399, #38bdf8 55%, #fbbf24);
      box-shadow: 0 20px 70px rgba(52,211,153,.24);
    }
    .branch {
      gap: 12px;
      padding: 10px 14px;
      border: 2px solid;
      border-radius: 18px;
      background: rgba(16,17,23,.95);
      font-weight: 900;
      line-height: 1.15;
    }
    .index {
      flex: 0 0 auto;
      width: 26px;
      height: 26px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      color: #050507;
      font-size: 12px;
      font-weight: 900;
    }
    .item {
      gap: 10px;
      padding: 10px 14px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 14px;
      background: rgba(255,255,255,.065);
      color: rgba(255,255,255,.9);
      font-size: 12px;
      line-height: 1.25;
    }
    .order {
      flex: 0 0 auto;
      min-width: 36px;
      height: 21px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      color: #050507;
      font-size: 10px;
      font-weight: 900;
    }
    .item-copy { min-width: 0; display: grid; gap: 3px; }
    .item-key {
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
    }
    .item-text { color: rgba(255,255,255,.9); }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <svg viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="${escapeHtml(title)}">
      ${panelNodes}
      ${branchCurves}
      ${itemCurves}
      <foreignObject x="${layout.rootX}" y="${layout.rootY - layout.rootH / 2}" width="${layout.rootW}" height="${layout.rootH}">
        <div class="root">${escapeHtml(title)}</div>
      </foreignObject>
      ${branchNodes}
      ${itemNodes}
    </svg>
  </main>
</body>
</html>`;
}

function FlashcardsModal({
  subject,
  materials,
  cards,
  user,
  update,
  notify,
}: {
  subject: Subject;
  materials: Material[];
  cards: Flashcard[];
  user: User;
  update: (next: (draft: AppData) => AppData) => void;
  notify: (message: string) => void;
}) {
  const [queue, setQueue] = useState<string[]>(() =>
    cards
      .filter((card) => card.dueAt <= Date.now())
      .sort((a, b) => a.dueAt - b.dueAt)
      .map((card) => card.id),
  );
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const current = queue.length ? cards.find((card) => card.id === queue[0]) : undefined;
  const dueCount = queue.length;

  function grade(value: FlashcardGrade) {
    if (!current) return;
    const graded = gradeFlashcard(current, value);
    update((draft) => ({ ...draft, flashcards: draft.flashcards.map((card) => (card.id === current.id ? graded : card)) }));
    setRevealed(false);
    setReviewed((count) => count + 1);
    setQueue((items) => (value === "errei" ? [...items.slice(1), current.id] : items.slice(1)));
  }

  function removeCurrent() {
    if (!current) return;
    update((draft) => ({ ...draft, flashcards: draft.flashcards.filter((card) => card.id !== current.id) }));
    setRevealed(false);
    setQueue((items) => items.slice(1));
    notify("Cartão excluído.");
  }

  function generate() {
    if (generating) return;
    setGenerating(true);
    setError("");
    const context = subjectContentContext(subject, materials);
    requestAiTask({ task: "flashcards", prompt: `Gere 10 flashcards sobre ${subject.name}.`, context })
      .then((text) => {
        const parsed = parseFlashcards(text);
        const existing = new Set(cards.map((card) => normalizeText(card.front)));
        const fresh = parsed
          .filter((card) => !existing.has(normalizeText(card.front)))
          .map((card) => ({
            id: uid("card"),
            userId: user.id,
            subjectId: subject.id,
            front: card.front.slice(0, 300),
            back: card.back.slice(0, 700),
            level: 0,
            dueAt: Date.now(),
            reps: 0,
            lapses: 0,
            createdAt: Date.now(),
          }));
        if (!fresh.length) {
          setError("Não consegui criar cartões novos agora. Tente de novo.");
          return;
        }
        update((draft) => ({ ...draft, flashcards: [...draft.flashcards, ...fresh] }));
        setQueue((items) => [...items, ...fresh.map((card) => card.id)]);
        notify(`${fresh.length} flashcards criados.`);
      })
      .catch(() => setError("Não consegui gerar agora. Tente novamente em instantes."))
      .finally(() => setGenerating(false));
  }

  const mastered = cards.filter((card) => card.level >= 4).length;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase text-mint">Flashcards · {subject.name}</p>
        <h2 className="mt-1 font-display text-3xl font-black">Revisão espaçada</h2>
        <p className="mt-2 text-sm text-white/55">
          {cards.length} cartões · {dueCount} para revisar agora · {mastered} dominados
        </p>
      </div>

      {current ? (
        <>
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            className="relative block w-full rounded-3xl border border-white/12 bg-white/[0.05] p-6 text-left transition hover:border-mint/35"
          >
            <span className="text-xs font-black uppercase tracking-[.15em] text-white/40">Pergunta</span>
            <p className="mt-2 font-display text-2xl font-black leading-snug">{current.front}</p>
            {revealed ? (
              <>
                <div className="my-4 h-px bg-gradient-to-r from-mint/50 to-transparent" />
                <span className="text-xs font-black uppercase tracking-[.15em] text-mint">Resposta</span>
                <p className="mt-2 leading-7 text-white/85">{current.back}</p>
              </>
            ) : (
              <p className="mt-4 text-sm font-bold text-white/40">Toque para ver a resposta</p>
            )}
          </button>
          {revealed ? (
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => grade("errei")} className="rounded-2xl border border-red-300/25 bg-red-400/12 px-3 py-3 font-black text-red-200 transition hover:bg-red-400/20">
                Errei
              </button>
              <button onClick={() => grade("dificil")} className="rounded-2xl border border-amber-300/25 bg-amber-400/12 px-3 py-3 font-black text-amber-200 transition hover:bg-amber-400/20">
                Difícil
              </button>
              <button onClick={() => grade("facil")} className="rounded-2xl bg-gradient-to-r from-mint to-mintDeep px-3 py-3 font-black text-black shadow-glow transition hover:scale-[1.01]">
                Fácil
              </button>
            </div>
          ) : null}
          <div className="flex items-center justify-between text-sm font-bold text-white/45">
            <span>{dueCount} na fila · {reviewed} revisados</span>
            <button onClick={removeCurrent} className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-white/45 transition hover:bg-white/10 hover:text-red-200">
              <Trash2 className="h-4 w-4" />
              Excluir cartão
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/14 bg-white/[0.035] p-8 text-center">
          <Layers className="mx-auto h-9 w-9 text-mint" />
          <h3 className="mt-4 font-display text-2xl font-black">
            {cards.length ? (reviewed ? "Revisão concluída!" : "Nada para revisar agora.") : "Crie seus primeiros flashcards."}
          </h3>
          <p className="mt-2 text-sm text-white/55">
            {cards.length
              ? "Volte quando os próximos cartões vencerem — o app agenda as revisões espaçadas para você."
              : "A Mine gera perguntas e respostas a partir dos conteúdos desta matéria."}
          </p>
        </div>
      )}

      {error ? <p className="text-sm font-bold text-red-200">{error}</p> : null}
      <SecondaryButton icon={generating ? Loader2 : Sparkles} onClick={generate}>
        {generating ? "Gerando com a Mine..." : "Gerar 10 flashcards com a Mine"}
      </SecondaryButton>
    </div>
  );
}

function MaterialViewModal({
  material,
  subject,
  update,
  setModal,
  notify,
}: {
  material: Material;
  subject?: Subject;
  update: (next: (draft: AppData) => AppData) => void;
  setModal: (modal: Modal | null) => void;
  notify: (message: string) => void;
}) {
  const isImage = Boolean(material.dataUrl?.startsWith("data:image/"));
  const text = (material.content || "").trim();
  const created = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(material.createdAt));

  // Edição do que já foi salvo (sugestão do brenasso sobre gestão das
  // informações introduzidas): antes só dava para excluir e cadastrar de novo.
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(material.title);
  const [draftDetail, setDraftDetail] = useState(material.detail || "");
  const [draftText, setDraftText] = useState(material.content || "");

  function toggle(patch: Partial<Material>) {
    update((draft) => ({
      ...draft,
      materials: draft.materials.map((item) => (item.id === material.id ? { ...item, ...patch } : item)),
    }));
  }

  function saveEdits() {
    const title = draftTitle.trim();
    if (!title) return;
    toggle({ title, detail: draftDetail.trim() || undefined, content: draftText.trim() || undefined });
    setEditing(false);
    notify("Conteúdo atualizado.");
  }

  function cancelEdits() {
    setDraftTitle(material.title);
    setDraftDetail(material.detail || "");
    setDraftText(material.content || "");
    setEditing(false);
  }

  function confirmDelete() {
    setModal({
      type: "confirm",
      title: "Excluir conteúdo?",
      body: `"${material.title}" será apagado da matéria ${subject?.name || ""}. Essa ação não tem volta.`,
      onConfirm: () => {
        update((draft) => ({ ...draft, materials: draft.materials.filter((item) => item.id !== material.id) }));
        notify("Conteúdo excluído.");
      },
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase text-mint">
          {materialTypeLabel(material.type)} · {subject?.name || "Sem matéria"}
        </p>
        {editing ? (
          <input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            aria-label="Título do conteúdo"
            className="mt-1 w-full rounded-xl border border-mint/40 bg-black/40 px-3 py-2 font-display text-2xl font-black text-white outline-none"
          />
        ) : (
          <h2 className="mt-1 break-words font-display text-3xl font-black">{material.title}</h2>
        )}
        <p className="mt-1 text-sm text-white/45">Adicionado em {created}</p>
      </div>

      {editing ? (
        <div className="space-y-3 rounded-2xl border border-mint/20 bg-mint/[0.04] p-4">
          <label className="block">
            <span className="text-sm font-black text-white/62">{material.type === "link" ? "Endereço" : "Descrição"}</span>
            <input
              value={draftDetail}
              onChange={(event) => setDraftDetail(event.target.value)}
              placeholder={material.type === "link" ? "https://..." : "Uma linha sobre este conteúdo"}
              className="mt-2 h-12 w-full rounded-xl border border-white/12 bg-white/[0.06] px-4 text-white outline-none transition placeholder:text-white/35 focus:border-mint/60"
            />
          </label>
          <label className="block">
            <span className="text-sm font-black text-white/62">Texto</span>
            <textarea
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              rows={8}
              placeholder="O texto que a Mine usa como fonte deste conteúdo."
              className="mt-2 w-full resize-y rounded-xl border border-white/12 bg-white/[0.06] p-4 text-sm leading-7 text-white outline-none transition placeholder:text-white/35 focus:border-mint/60"
            />
          </label>
          <p className="text-[12px] font-bold text-white/40">
            O que estiver aqui é o que a Mine lê ao responder sobre esta matéria.
          </p>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton icon={Check} onClick={saveEdits}>
              Salvar alterações
            </PrimaryButton>
            <SecondaryButton icon={X} onClick={cancelEdits}>
              Cancelar
            </SecondaryButton>
          </div>
        </div>
      ) : null}

      {isImage && material.dataUrl ? (
        <img src={material.dataUrl} alt={material.title} className="max-h-[46vh] w-full rounded-2xl border border-white/10 object-contain" />
      ) : null}
      {!editing && material.type === "link" && material.detail ? (
        <a
          href={/^https?:\/\//i.test(material.detail) ? material.detail : `https://${material.detail}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4 font-bold text-mint transition hover:border-mint/40"
        >
          <LinkIcon className="h-5 w-5 shrink-0" />
          <span className="min-w-0 break-all">{material.detail}</span>
        </a>
      ) : null}
      {!editing && text ? (
        <div className="max-h-[40vh] overflow-auto rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="whitespace-pre-wrap text-sm leading-7 text-white/80">{text.slice(0, 20_000)}</p>
        </div>
      ) : null}
      {!editing && !isImage && !text && material.type !== "link" ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">
          {material.detail || "Sem texto extraído deste conteúdo."}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            const next = toggleStudied(material, !material.studied);
            toggle({ studied: next.studied, studiedAt: next.studiedAt });
          }}
          className={`rounded-2xl px-4 py-2.5 text-sm font-black transition ${material.studied ? "bg-mint text-black" : "bg-white/[0.08] text-white/70 hover:bg-white/[0.12]"}`}
        >
          {material.studied ? "Estudado ✓" : "Marcar estudado"}
        </button>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.08] px-4 py-2.5 text-sm font-black text-white/70 transition hover:bg-white/[0.12]"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </button>
        ) : null}
        <button
          onClick={() => toggle({ favorite: !material.favorite })}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition ${material.favorite ? "bg-amber-300 text-black" : "bg-white/[0.08] text-white/70 hover:bg-white/[0.12]"}`}
        >
          <Star className={`h-4 w-4 ${material.favorite ? "fill-black" : ""}`} />
          {material.favorite ? "Favorito" : "Favoritar"}
        </button>
        {material.dataUrl ? (
          <a
            href={material.dataUrl}
            download={material.title}
            className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.08] px-4 py-2.5 text-sm font-black text-white/70 transition hover:bg-white/[0.12]"
          >
            <Download className="h-4 w-4" />
            Baixar
          </a>
        ) : null}
        <button
          onClick={confirmDelete}
          className="ml-auto inline-flex items-center gap-2 rounded-2xl border border-red-300/25 bg-red-400/12 px-4 py-2.5 text-sm font-black text-red-200 transition hover:bg-red-400/20"
        >
          <Trash2 className="h-4 w-4" />
          Excluir
        </button>
      </div>
    </div>
  );
}

function MindmapExperience({
  map,
  subject,
  palette,
  zoom,
  setZoom,
  scrollRef,
  grabbing,
  onPanDown,
  onPanMove,
  onPanUp,
  fitToWidth,
  reload,
  exportPng,
  exportHtml,
  sharePng,
  copyMindmapText,
  copied,
  close,
}: {
  map: Mindmap;
  subject: Subject;
  palette: string[];
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  scrollRef: React.RefObject<HTMLDivElement>;
  grabbing: boolean;
  onPanDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPanMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPanUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  fitToWidth: (layoutWidth: number) => void;
  reload: () => void;
  exportPng: () => void;
  exportHtml: () => void;
  sharePng: () => void;
  copyMindmapText: () => void;
  copied: boolean;
  close: () => void;
}) {
  const [depth, setDepth] = useState(true);
  const [focusedBranch, setFocusedBranch] = useState<number | null>(null);
  const [expandedMobile, setExpandedMobile] = useState(0);
  const layout = useMemo(() => buildMindmapLayout(map, palette), [map, palette]);
  const mapWidth = Math.round(layout.width * zoom);
  const mapHeight = Math.round(layout.height * zoom);
  const activeBranch = focusedBranch === null ? null : layout.branches[focusedBranch];

  return (
    <div className="space-y-4">
      <div className="mindmap-command-bar flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-mint/12 px-3 py-1 text-xs font-black uppercase tracking-[.12em] text-mint">{layout.branches.length} constelações</span>
          <span className="rounded-full bg-cyanGlow/12 px-3 py-1 text-xs font-black uppercase tracking-[.12em] text-cyanGlow">{layout.branches.reduce((sum, branch) => sum + branch.items.length, 0)} conexões</span>
          {activeBranch ? <button onClick={() => setFocusedBranch(null)} className="rounded-full bg-white px-3 py-1 text-xs font-black text-black">Foco: {activeBranch.label} · limpar</button> : <span className="hidden rounded-full bg-white/[0.055] px-3 py-1 text-xs font-black uppercase tracking-[.12em] text-white/38 sm:inline">Selecione um ramo</span>}
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <button type="button" onClick={() => setDepth((value) => !value)} aria-pressed={depth} className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-black transition ${depth ? "border-mint/35 bg-mint/10 text-mint" : "border-white/12 bg-black/20 text-white/55"}`}><Layers className="h-4 w-4" /> {depth ? "Profundidade 3D" : "Vista plana"}</button>
          <button type="button" onClick={() => setZoom((value) => Math.max(0.45, Number((value - 0.15).toFixed(2))))} aria-label="Diminuir mapa" title="Diminuir mapa" className="grid h-9 w-9 place-items-center rounded-xl border border-white/12 bg-black/20 text-white/70 transition hover:border-mint/40 hover:text-mint"><Minus className="h-4 w-4" /></button>
          <span className="min-w-12 text-center font-display text-sm font-black text-white/70">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((value) => Math.min(2.2, Number((value + 0.15).toFixed(2))))} aria-label="Aumentar mapa" title="Aumentar mapa" className="grid h-9 w-9 place-items-center rounded-xl border border-white/12 bg-black/20 text-white/70 transition hover:border-mint/40 hover:text-mint"><Plus className="h-4 w-4" /></button>
          <button type="button" onClick={() => fitToWidth(layout.width)} aria-label="Ajustar à tela" title="Ajustar à tela" className="grid h-9 w-9 place-items-center rounded-xl border border-white/12 bg-black/20 text-white/70 transition hover:border-mint/40 hover:text-mint"><RotateCcw className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        <Tilt3D className="mindmap-mobile-core rounded-3xl" max={4} lift={3}>
          <div className="relative overflow-hidden rounded-3xl border border-mint/30 bg-mint/10 p-5 text-center">
            <span className="mindmap-core-orbit" aria-hidden />
            <Brain className="mx-auto h-7 w-7 text-mint" />
            <p className="mt-3 text-[10px] font-black uppercase tracking-[.2em] text-mint">Núcleo do conhecimento</p>
            <h3 className="mt-1 font-display text-xl font-black">{map.title || subject.name}</h3>
          </div>
        </Tilt3D>
        {layout.branches.map((branch, branchIndex) => {
          const expanded = expandedMobile === branchIndex;
          return (
            <motion.section key={branchIndex} layout className="overflow-hidden rounded-2xl border bg-white/[0.035]" style={{ borderColor: hexAlpha(branch.color, expanded ? 0.55 : 0.18) }}>
              <button onClick={() => setExpandedMobile(expanded ? -1 : branchIndex)} className="flex w-full items-center gap-3 p-4 text-left">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display text-sm font-black text-black" style={{ backgroundColor: branch.color }}>{branchIndex + 1}</span>
                <span className="min-w-0 flex-1 font-display font-black">{branch.label}</span>
                <ChevronDown className={`h-4 w-4 text-white/45 transition ${expanded ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence initial={false}>{expanded ? (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="grid gap-2 border-t border-white/8 p-3">
                    {branch.items.map((item, itemIndex) => <div key={itemIndex} className="relative overflow-hidden rounded-xl border border-white/8 bg-black/15 p-3 pl-4"><span className="absolute inset-y-2 left-0 w-1 rounded-r-full" style={{ backgroundColor: branch.color }} /><span className="block text-[10px] font-black uppercase tracking-wider" style={{ color: branch.color }}>{item.keyword}</span><span className="mt-1 block text-sm leading-5 text-white/68">{item.detail}</span></div>)}
                  </div>
                </motion.div>
              ) : null}</AnimatePresence>
            </motion.section>
          );
        })}
      </div>

      <div className="relative hidden md:block">
        <div
          ref={scrollRef}
          onPointerDown={onPanDown}
          onPointerMove={onPanMove}
          onPointerUp={onPanUp}
          onPointerCancel={onPanUp}
          className={`mindmap-viewport h-[68vh] min-h-[500px] w-full select-none overflow-auto rounded-3xl border border-white/10 p-4 ${grabbing ? "cursor-grabbing" : "cursor-grab"}`}
        >
          <div className="relative" style={{ width: `${mapWidth}px`, height: `${mapHeight}px` }}>
            <div className="mindmap-scale origin-top-left" style={{ width: `${layout.width}px`, height: `${layout.height}px`, transform: `scale(${zoom})` }}>
              <div className={`mindmap-knowledge-plane ${depth ? "is-depth" : "is-flat"}`} style={{ width: layout.width, height: layout.height }}>
                <span className="mindmap-orbit mindmap-orbit-a" aria-hidden />
                <span className="mindmap-orbit mindmap-orbit-b" aria-hidden />
                <span className="mindmap-data-cube mindmap-data-cube-a" aria-hidden />
                <span className="mindmap-data-cube mindmap-data-cube-b" aria-hidden />
                <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden>
                  <defs>
                    <filter id="mindmap-line-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                    <radialGradient id="mindmap-core-aura"><stop offset="0" stopColor="rgb(var(--mint))" stopOpacity=".16" /><stop offset="1" stopColor="rgb(var(--mint))" stopOpacity="0" /></radialGradient>
                  </defs>
                  <ellipse cx={layout.width / 2} cy={layout.rootY} rx="330" ry="255" fill="url(#mindmap-core-aura)" />
                  {layout.branches.map((branch, branchIndex) => {
                    const dimmed = focusedBranch !== null && focusedBranch !== branchIndex;
                    const rootX = branch.side === "right" ? layout.rootX + layout.rootW : layout.rootX;
                    const branchAnchorX = branch.side === "right" ? branch.x : branch.x + branch.w;
                    const path = mindCurve(rootX, layout.rootY, branchAnchorX, branch.y);
                    return <g key={`branch-line-${branchIndex}`} className={dimmed ? "opacity-15" : "opacity-100"}><path d={path} fill="none" stroke={branch.color} strokeWidth="12" strokeLinecap="round" strokeOpacity=".08" /><path className="mindmap-energy-line" d={path} fill="none" stroke={branch.color} strokeWidth="3.5" strokeLinecap="round" strokeOpacity=".78" filter="url(#mindmap-line-glow)" /></g>;
                  })}
                  {layout.branches.flatMap((branch, branchIndex) => branch.items.map((item, itemIndex) => {
                    const dimmed = focusedBranch !== null && focusedBranch !== branchIndex;
                    const fromX = branch.side === "right" ? branch.x + branch.w : branch.x;
                    const toX = branch.side === "right" ? item.x : item.x + item.w;
                    return <path key={`item-line-${branchIndex}-${itemIndex}`} className={dimmed ? "opacity-10" : "mindmap-energy-line mindmap-energy-line-soft"} d={mindCurve(fromX, branch.y, toX, item.y)} fill="none" stroke={branch.color} strokeWidth="2" strokeLinecap="round" strokeOpacity=".42" />;
                  }))}
                </svg>

                <div className="absolute" style={{ left: layout.rootX - 14, top: layout.rootY - layout.rootH / 2 - 14, width: layout.rootW + 28, height: layout.rootH + 28, transform: depth ? "translateZ(78px)" : undefined }}>
                  <Tilt3D className="mindmap-central-node h-full rounded-[28px]" max={7} lift={5}>
                    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[28px] border border-mint/45 bg-[#0b1712] px-6 text-center shadow-[0_30px_80px_-28px_rgb(var(--mint)/.75)]">
                      <span className="mindmap-core-ring mindmap-core-ring-a" aria-hidden /><span className="mindmap-core-ring mindmap-core-ring-b" aria-hidden />
                      <span className="relative z-10 text-[9px] font-black uppercase tracking-[.23em] text-mint/65">Núcleo central</span>
                      <strong className="relative z-10 mt-1 break-words font-display text-[18px] font-black leading-tight text-white">{map.title || subject.name}</strong>
                    </div>
                  </Tilt3D>
                </div>

                {layout.branches.map((branch, branchIndex) => {
                  const dimmed = focusedBranch !== null && focusedBranch !== branchIndex;
                  return (
                    <div key={`branch-${branchIndex}`} className={`absolute transition duration-300 ${dimmed ? "opacity-20 saturate-50" : "opacity-100"}`} style={{ left: branch.x, top: branch.y - branch.h / 2, width: branch.w, height: branch.h, transform: depth ? `translateZ(${50 + (branchIndex % 3) * 7}px)` : undefined }}>
                      <Tilt3D className="h-full rounded-[20px]" max={6} lift={4}>
                        <button type="button" onClick={() => setFocusedBranch((value) => value === branchIndex ? null : branchIndex)} className="mindmap-branch-node flex h-full w-full items-center gap-3 overflow-hidden rounded-[20px] border px-3 text-left" style={{ borderColor: hexAlpha(branch.color, 0.62), background: `linear-gradient(145deg, ${hexAlpha(branch.color, 0.22)}, rgba(10,14,17,.94) 58%)`, boxShadow: `0 18px 42px -20px ${hexAlpha(branch.color, 0.75)}` }}>
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl font-display text-xs font-black text-black" style={{ backgroundColor: branch.color }}>{branchIndex + 1}</span>
                          <span className="min-w-0 break-words font-display text-[13px] font-black leading-tight text-white">{branch.label}</span>
                        </button>
                      </Tilt3D>
                    </div>
                  );
                })}

                {layout.branches.flatMap((branch, branchIndex) => branch.items.map((item, itemIndex) => {
                  const dimmed = focusedBranch !== null && focusedBranch !== branchIndex;
                  return (
                    <div key={`item-${branchIndex}-${itemIndex}`} className={`absolute transition duration-300 ${dimmed ? "pointer-events-none opacity-10 saturate-0" : "opacity-100"}`} style={{ left: item.x, top: item.y - item.h / 2, width: item.w, height: item.h, transform: depth ? `translateZ(${20 + (itemIndex % 3) * 5}px)` : undefined }}>
                      <Tilt3D className="h-full rounded-[17px]" max={4} scale={1.01} lift={3}>
                        <button type="button" onClick={() => setFocusedBranch(branchIndex)} className="mindmap-item-node relative flex h-full w-full items-center overflow-hidden rounded-[17px] border bg-[#10171a]/95 py-2 pl-4 pr-3 text-left shadow-[0_14px_32px_-20px_rgba(0,0,0,.9)]" style={{ borderColor: hexAlpha(branch.color, 0.28) }}>
                          <span className="absolute inset-y-3 left-0 w-1.5 rounded-r-full" style={{ backgroundColor: branch.color, boxShadow: `0 0 16px ${branch.color}` }} />
                          <span className="grid min-w-0 gap-0.5"><span className="truncate text-[10px] font-black uppercase leading-tight tracking-wide" style={{ color: branch.color }}>{item.keyword}</span><span className="min-w-0 break-words text-[12px] leading-snug text-white/78">{item.detail}</span></span>
                        </button>
                      </Tilt3D>
                    </div>
                  );
                }))}
              </div>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/8 bg-black/55 px-4 py-2 text-[10px] font-black uppercase tracking-[.14em] text-white/42 backdrop-blur-xl">Arraste para explorar · clique nos ramos para focar</div>
      </div>

      <div className="flex flex-wrap gap-3">
        <PrimaryButton icon={RefreshCw} onClick={reload}>Gerar de novo</PrimaryButton>
        <SecondaryButton icon={Download} onClick={exportPng}>Baixar PNG</SecondaryButton>
        <SecondaryButton icon={FileText} onClick={exportHtml}>Baixar HTML</SecondaryButton>
        <SecondaryButton icon={Share2} onClick={sharePng}>Compartilhar</SecondaryButton>
        <SecondaryButton icon={copied ? Check : Copy} onClick={copyMindmapText}>{copied ? "Copiado!" : "Copiar texto"}</SecondaryButton>
        <SecondaryButton icon={ChevronLeft} onClick={close}>Fechar</SecondaryButton>
      </div>
    </div>
  );
}

function MindmapModal({ subject, materials, close }: { subject: Subject; materials: Material[]; close: () => void }) {
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [map, setMap] = useState<Mindmap>({ title: "", branches: [] });
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const palette = ["#34D399", "#38BDF8", "#A78BFA", "#FBBF24", "#FB7185", "#F472B6"];

  function onPanDown(event: React.PointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    if (!el || (event.target as HTMLElement).closest("button")) return;
    panRef.current = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop };
    setGrabbing(true);
    el.setPointerCapture?.(event.pointerId);
  }
  function onPanMove(event: React.PointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    const start = panRef.current;
    if (!el || !start) return;
    el.scrollLeft = start.left - (event.clientX - start.x);
    el.scrollTop = start.top - (event.clientY - start.y);
  }
  function onPanUp(event: React.PointerEvent<HTMLDivElement>) {
    panRef.current = null;
    setGrabbing(false);
    scrollRef.current?.releasePointerCapture?.(event.pointerId);
  }
  function fitToWidth(layoutWidth: number) {
    const el = scrollRef.current;
    const available = (el?.clientWidth || layoutWidth) - 32;
    const next = Math.min(2.2, Math.max(0.5, Number((available / layoutWidth).toFixed(2))));
    setZoom(next);
    if (el) {
      const layout = buildMindmapLayout(map, palette);
      requestAnimationFrame(() => el.scrollTo({
        top: Math.max(0, layout.rootY * next - el.clientHeight / 2),
        left: Math.max(0, (layout.width * next - el.clientWidth) / 2),
        behavior: "smooth",
      }));
    }
  }
  const fileBase =
    `mapa-mental-${subject.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "mapa-mental";

  function downloadCanvasPng() {
    const canvas = mindmapToCanvas(map, palette, map.title || subject.name);
    if (!canvas) return;
    // data URL (sem blob): o atributo download/nome .png e respeitado.
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${fileBase}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function exportPng() {
    downloadCanvasPng();
  }

  function exportHtml() {
    const html = mindmapToHtmlDocument(map, palette, map.title || subject.name);
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileBase}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function sharePng() {
    const canvas = mindmapToCanvas(map, palette, map.title || subject.name);
    canvas?.toBlob(async (blob) => {
      if (!blob) {
        downloadCanvasPng();
        return;
      }
      const file = new File([blob], `${fileBase}.png`, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (data?: { files?: File[]; title?: string; text?: string }) => boolean;
        share?: (data?: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: `Mapa mental: ${map.title || subject.name}` });
        } catch {
          // usuário cancelou o compartilhamento
        }
      } else {
        downloadCanvasPng();
      }
    }, "image/png");
  }

  async function copyMindmapText() {
    const text = mindmapToText(map, map.title || subject.name);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // área de transferência indisponível
    }
  }

  useEffect(() => {
    let active = true;
    setStatus("loading");
    const context = subjectContentContext(subject, materials);
    requestAiTask({ task: "mindmap", prompt: `Crie um mapa mental de estudos sobre ${subject.name}.`, context })
      .then((text) => {
        if (!active) return;
        const parsed = parseMindmap(text);
        if (!parsed.branches.length) {
          setStatus("error");
          return;
        }
        setMap(parsed);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.id, reloadKey]);

  // Ao terminar de montar, enquadra o mapa na largura disponível (evita abrir com rolagem no PC).
  useEffect(() => {
    if (status !== "ready") return;
    const frame = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      const available = el.clientWidth - 32;
      const layout = buildMindmapLayout(map, palette);
      const nextZoom = Math.min(1.6, Math.max(0.5, Number((available / layout.width).toFixed(2))));
      setZoom(nextZoom);
      requestAnimationFrame(() => el.scrollTo({
        top: Math.max(0, layout.rootY * nextZoom - el.clientHeight / 2),
        left: Math.max(0, (layout.width * nextZoom - el.clientWidth) / 2),
      }));
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, map]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-mint/15 text-mint">
            <Brain className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-mint">Mapa mental</p>
            <h2 className="font-display text-2xl font-black">{subject.name}</h2>
          </div>
        </div>
        <button onClick={close} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-2xl bg-white/[0.06] text-white/60 transition hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      {status === "loading" && (
        <div className="grid place-items-center gap-3 py-12 text-white/60">
          <Loader2 className="h-9 w-9 animate-spin text-mint" />
          <p className="font-bold">A Mine está montando seu mapa mental...</p>
        </div>
      )}

      {status === "error" && (
        <div className="grid place-items-center gap-4 py-10 text-center">
          <p className="text-white/70">Não consegui montar o mapa agora. Tente de novo.</p>
          <PrimaryButton icon={RefreshCw} onClick={() => setReloadKey((value) => value + 1)}>Tentar de novo</PrimaryButton>
        </div>
      )}

      {false && status === "ready" &&
        (() => {
          const layout = buildMindmapLayout(map, palette);
          const mapWidth = Math.round(layout.width * zoom);
          const mapHeight = Math.round(layout.height * zoom);
          return (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-mint/12 px-3 py-1 text-xs font-black uppercase tracking-[.12em] text-mint">{layout.branches.length} ramos</span>
                  <span className="rounded-full bg-cyanGlow/12 px-3 py-1 text-xs font-black uppercase tracking-[.12em] text-cyanGlow">{layout.branches.reduce((sum, branch) => sum + branch.items.length, 0)} pontos-chave</span>
                  <span className="rounded-full bg-amber-300/12 px-3 py-1 text-xs font-black uppercase tracking-[.12em] text-amber-300">Arraste para mover</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setZoom((value) => Math.max(1, Number((value - 0.15).toFixed(2))))}
                    aria-label="Diminuir mapa"
                    title="Diminuir mapa"
                    className="grid h-9 w-9 place-items-center rounded-xl border border-white/12 bg-black/20 text-white/70 transition hover:border-mint/40 hover:text-mint"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-14 text-center font-display text-sm font-black text-white/70">{Math.round(zoom * 100)}%</span>
                  <button
                    type="button"
                    onClick={() => setZoom((value) => Math.min(2.2, Number((value + 0.15).toFixed(2))))}
                    aria-label="Aumentar mapa"
                    title="Aumentar mapa"
                    className="grid h-9 w-9 place-items-center rounded-xl border border-white/12 bg-black/20 text-white/70 transition hover:border-mint/40 hover:text-mint"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => fitToWidth(layout.width)}
                    aria-label="Ajustar à tela"
                    title="Ajustar à tela"
                    className="grid h-9 w-9 place-items-center rounded-xl border border-white/12 bg-black/20 text-white/70 transition hover:border-mint/40 hover:text-mint"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div
                ref={scrollRef}
                onPointerDown={onPanDown}
                onPointerMove={onPanMove}
                onPointerUp={onPanUp}
                onPointerCancel={onPanUp}
                className={`h-[70vh] min-h-[460px] w-full touch-pan-y select-none overflow-auto rounded-2xl border border-white/10 bg-black/25 p-4 ${grabbing ? "cursor-grabbing" : "cursor-grab"}`}
              >
                <svg
                  viewBox={`0 0 ${layout.width} ${layout.height}`}
                  width={mapWidth}
                  height={mapHeight}
                  className="pointer-events-none block max-w-none"
                  style={{ width: `${mapWidth}px`, height: `${mapHeight}px` }}
                >
                  <defs>
                    <linearGradient id="mm-bg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0e1016" />
                      <stop offset="100%" stopColor="#08090d" />
                    </linearGradient>
                    <radialGradient id="mm-glow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="rgba(52,211,153,0.18)" />
                      <stop offset="100%" stopColor="rgba(52,211,153,0)" />
                    </radialGradient>
                    <pattern id="mm-dots" width="28" height="28" patternUnits="userSpaceOnUse">
                      <circle cx="2" cy="2" r="1.4" fill="rgba(255,255,255,0.035)" />
                    </pattern>
                  </defs>
                  <rect x={0} y={0} width={layout.width} height={layout.height} rx={22} fill="url(#mm-bg)" />
                  <rect x={0} y={0} width={layout.width} height={layout.height} rx={22} fill="url(#mm-dots)" />
                  <ellipse cx={layout.width / 2} cy={layout.rootY} rx={380} ry={280} fill="url(#mm-glow)" />

                  {layout.branches.map((branch, branchIndex) => (
                    <rect
                      key={`branch-panel-${branchIndex}`}
                      x={branch.panelX}
                      y={branch.panelY}
                      width={branch.panelW}
                      height={branch.panelH}
                      rx={26}
                      fill={hexAlpha(branch.color, 0.05)}
                      stroke={hexAlpha(branch.color, 0.16)}
                    />
                  ))}
                  {layout.branches.map((branch, branchIndex) => {
                    const rootX = branch.side === "right" ? layout.rootX + layout.rootW : layout.rootX;
                    const branchAnchorX = branch.side === "right" ? branch.x : branch.x + branch.w;
                    const d = mindCurve(rootX, layout.rootY, branchAnchorX, branch.y);
                    return (
                      <g key={`branch-curve-${branchIndex}`}>
                        <path d={d} fill="none" stroke={branch.color} strokeWidth={9} strokeLinecap="round" strokeOpacity={0.12} />
                        <path d={d} fill="none" stroke={branch.color} strokeWidth={3.4} strokeLinecap="round" strokeOpacity={0.8} />
                      </g>
                    );
                  })}
                  {layout.branches.flatMap((branch, branchIndex) =>
                    branch.items.map((item, itemIndex) => {
                      const fromX = branch.side === "right" ? branch.x + branch.w : branch.x;
                      const toX = branch.side === "right" ? item.x : item.x + item.w;
                      return (
                        <path
                          key={`item-curve-${branchIndex}-${itemIndex}`}
                          d={mindCurve(fromX, branch.y, toX, item.y)}
                          fill="none"
                          stroke={branch.color}
                          strokeWidth={2.2}
                          strokeLinecap="round"
                          strokeOpacity={0.42}
                        />
                      );
                    }),
                  )}
                  <foreignObject x={layout.rootX - 8} y={layout.rootY - layout.rootH / 2 - 8} width={layout.rootW + 16} height={layout.rootH + 16}>
                    <div className="grid h-full w-full place-items-center p-2">
                      <div
                        className="flex h-full w-full flex-col items-center justify-center rounded-lg px-5 text-center"
                        style={{ background: "linear-gradient(135deg,#34D399,#38BDF8 52%,#A78BFA)", boxShadow: "0 12px 46px rgba(56,189,248,0.4)" }}
                      >
                        <span className="text-[9px] font-black uppercase tracking-[.22em] text-black/55">Tema central</span>
                        <span className="break-words font-display text-[19px] font-black leading-tight text-black">{map.title || subject.name}</span>
                      </div>
                    </div>
                  </foreignObject>
                  {layout.branches.map((branch, branchIndex) => (
                    <foreignObject key={`branch-node-${branchIndex}`} x={branch.x} y={branch.y - branch.h / 2} width={branch.w} height={branch.h}>
                      <div
                        className="flex h-full w-full items-center gap-2.5 overflow-hidden rounded-[18px] border px-3 shadow-[0_8px_26px_rgba(0,0,0,0.4)]"
                        style={{ borderColor: hexAlpha(branch.color, 0.6), background: `linear-gradient(135deg, ${hexAlpha(branch.color, 0.24)}, ${hexAlpha(branch.color, 0.08)})` }}
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-black text-black" style={{ backgroundColor: branch.color }}>
                          {branchIndex + 1}
                        </span>
                        <span className="min-w-0 break-words font-display text-[13.5px] font-black leading-tight text-white">{branch.label}</span>
                      </div>
                    </foreignObject>
                  ))}
                  {layout.branches.flatMap((branch, branchIndex) =>
                    branch.items.map((item, itemIndex) => (
                      <foreignObject key={`item-node-${branchIndex}-${itemIndex}`} x={item.x} y={item.y - item.h / 2} width={item.w} height={item.h}>
                        <div
                          className="relative flex h-full w-full items-center overflow-hidden rounded-[16px] border bg-[#12141b] py-2 pl-4 pr-3 shadow-[0_6px_20px_rgba(0,0,0,0.32)]"
                          style={{ borderColor: hexAlpha(branch.color, 0.3) }}
                        >
                          <span className="absolute left-0 top-1/2 h-[62%] w-1.5 -translate-y-1/2 rounded-r-full" style={{ backgroundColor: branch.color }} />
                          <span className="grid min-w-0 gap-0.5">
                            <span className="truncate text-[10px] font-black uppercase leading-tight tracking-wide" style={{ color: branch.color }}>
                              {item.keyword}
                            </span>
                            <span className="min-w-0 break-words text-[12px] leading-snug text-white/88">{item.detail}</span>
                          </span>
                        </div>
                      </foreignObject>
                    )),
                  )}
                </svg>
              </div>
              <div className="flex flex-wrap gap-3">
                <PrimaryButton icon={RefreshCw} onClick={() => setReloadKey((value) => value + 1)}>Gerar de novo</PrimaryButton>
                <SecondaryButton icon={Download} onClick={exportPng}>Baixar PNG</SecondaryButton>
                <SecondaryButton icon={FileText} onClick={exportHtml}>Baixar HTML</SecondaryButton>
                <SecondaryButton icon={Share2} onClick={sharePng}>Compartilhar</SecondaryButton>
                <SecondaryButton icon={copied ? Check : Copy} onClick={copyMindmapText}>{copied ? "Copiado!" : "Copiar texto"}</SecondaryButton>
                <SecondaryButton icon={ChevronLeft} onClick={close}>Fechar</SecondaryButton>
              </div>
            </>
          );
        })()}
      {status === "ready" ? (
        <MindmapExperience
          map={map}
          subject={subject}
          palette={palette}
          zoom={zoom}
          setZoom={setZoom}
          scrollRef={scrollRef}
          grabbing={grabbing}
          onPanDown={onPanDown}
          onPanMove={onPanMove}
          onPanUp={onPanUp}
          fitToWidth={fitToWidth}
          reload={() => setReloadKey((value) => value + 1)}
          exportPng={exportPng}
          exportHtml={exportHtml}
          sharePng={sharePng}
          copyMindmapText={copyMindmapText}
          copied={copied}
          close={close}
        />
      ) : null}
    </div>
  );
}

function findSubject(subjects: Subject[], action: { subjectId?: string; subjectName?: string }) {
  if (action.subjectId) {
    const byId = subjects.find((subject) => subject.id === action.subjectId);
    if (byId) return byId;
  }
  if (action.subjectName) {
    const clean = normalizeText(action.subjectName);
    return subjects.find((subject) => normalizeText(subject.name) === clean || normalizeText(subject.name).includes(clean));
  }
  return undefined;
}

function applyAssistantActions(data: AppData, userId: string, actions: AssistantAction[]) {
  const next: AppData = {
    ...data,
    users: [...data.users],
    subjects: [...data.subjects],
    materials: [...data.materials],
    tasks: [...data.tasks],
    chats: [...data.chats],
    sessions: [...data.sessions],
  };
  const feedback: string[] = [];
  let route: { view: View; id?: string; query?: string } | null = null;

  for (const rawAction of actions.slice(0, 8)) {
    const action = rawAction as AssistantAction;
    if (!action || typeof action.type !== "string") continue;

    if (action.type === "create_subject" && action.name?.trim()) {
      const exists = next.subjects.some((subject) => subject.userId === userId && normalizeText(subject.name) === normalizeText(action.name));
      if (!exists) {
        const color = action.color && /^#[0-9a-f]{6}$/i.test(action.color) ? action.color : subjectPalette[next.subjects.length % subjectPalette.length];
        const icon = action.icon && iconMap[action.icon] ? action.icon : "book";
        next.subjects.push({ id: uid("subject"), userId, name: action.name.trim(), color, icon, favorite: false, createdAt: Date.now() });
        feedback.push(`Matéria criada: ${action.name.trim()}`);
      }
      continue;
    }

    if (action.type === "create_material" && action.title?.trim()) {
      const subject = findSubject(next.subjects.filter((item) => item.userId === userId), action) || next.subjects.find((item) => item.userId === userId);
      if (!subject) continue;
      const type = action.materialType && ["note", "file", "link", "image"].includes(action.materialType) ? action.materialType : "note";
      next.materials.push({
        id: uid("material"),
        userId,
        subjectId: subject.id,
        title: action.title.trim(),
        detail: action.detail || "Criado pela Mine.",
        type,
        folder: "Geral",
        studied: Boolean(action.studied),
        favorite: false,
        createdAt: Date.now(),
      });
      feedback.push(`Conteúdo criado: ${action.title.trim()}`);
      continue;
    }

    if (action.type === "create_task" && action.title?.trim()) {
      const subject = findSubject(next.subjects.filter((item) => item.userId === userId), action) || next.subjects.find((item) => item.userId === userId);
      if (!subject) continue;
      const dueInDays = Number.isFinite(action.dueInDays) ? Math.max(0, Math.min(365, Number(action.dueInDays))) : 1;
      next.tasks.push({
        id: uid("task"),
        userId,
        subjectId: subject.id,
        title: action.title.trim(),
        note: action.note || "",
        dueAt: addDays(dueInDays),
        done: false,
        createdAt: Date.now(),
      });
      feedback.push(`Tarefa criada: ${action.title.trim()}`);
      continue;
    }

    if (action.type === "mark_material_studied") {
      const title = action.title ? normalizeText(action.title) : "";
      let changed = false;
      next.materials = next.materials.map((material) => {
        const matchesId = action.materialId && material.id === action.materialId;
        const matchesTitle = title && normalizeText(material.title).includes(title);
        if (material.userId === userId && (matchesId || matchesTitle)) {
          changed = true;
          return toggleStudied(material, true);
        }
        return material;
      });
      if (changed) feedback.push("Conteúdo marcado como estudado");
      continue;
    }

    if (action.type === "complete_task") {
      const title = action.title ? normalizeText(action.title) : "";
      let changed = false;
      next.tasks = next.tasks.map((task) => {
        const matchesId = action.taskId && task.id === action.taskId;
        const matchesTitle = title && normalizeText(task.title).includes(title);
        if (task.userId === userId && (matchesId || matchesTitle)) {
          changed = true;
          return toggleDone(task, true);
        }
        return task;
      });
      if (changed) feedback.push("Tarefa concluída");
      continue;
    }

    if (action.type === "set_focus_minutes" && Number.isFinite(action.minutes)) {
      const minutes = Math.max(5, Math.min(180, Number(action.minutes)));
      next.users = next.users.map((user) => (user.id === userId ? { ...user, settings: { ...user.settings, focusMinutes: minutes } } : user));
      feedback.push(`Foco ajustado para ${minutes} min`);
      continue;
    }

    if (action.type === "set_display_name" && action.name?.trim()) {
      const name = action.name.trim().slice(0, 40);
      next.users = next.users.map((user) => (user.id === userId ? { ...user, settings: { ...user.settings, displayName: name } } : user));
      feedback.push("Nome atualizado");
      continue;
    }

    if (action.type === "search" && action.query?.trim()) {
      route = { view: "search", query: action.query.trim() };
      continue;
    }

    if (action.type === "navigate") {
      const allowed: View[] = ["home", "agenda", "progress", "ranking", "mine", "games", "search", "plan", "comments", "suggestions", "about", "perfil"];
      if (action.view === "subject") {
        const subject = findSubject(next.subjects.filter((item) => item.userId === userId), action);
        if (subject) route = { view: "subject", id: subject.id };
      } else if (allowed.includes(action.view)) {
        route = { view: action.view, query: action.view === "search" ? action.query?.trim() : undefined };
      }
    }
  }

  return { data: next, feedback, route };
}

function buildMineAnswer(text: string, subjectId: string | undefined, data: ReturnType<typeof useMemoUserData>, user: User) {
  const subject = data.subjects.find((item) => item.id === subjectId);
  const materials = subjectId ? data.materials.filter((item) => item.subjectId === subjectId) : data.materials;
  const topics = materials.map((item) => item.title).slice(0, 5);
  const normalized = normalizeText(`${text} ${subject?.name || ""}`);
  const asksExercise = /\b(conta|calculo|exercicio|questao|pergunta|atividade|problema|treino|pratica)\b/.test(normalized);
  const wantsPracticeOnly =
    /\b(pra|para)\s+(eu|mim)\s+(fazer|resolver|responder|praticar)\b/.test(normalized) ||
    /\b(sem resposta|sem resolucao|so o enunciado|somente o enunciado|me de uma pergunta)\b/.test(normalized);

  if (asksExercise && wantsPracticeOnly && /\b(fisica|forca|velocidade|energia|movimento|densidade)\b/.test(normalized)) {
    return `Exercício de Física para você fazer:

Enunciado:
Um carro percorre 150 km em 2 horas. Qual é a velocidade média do carro?

Sua vez:
Use a fórmula velocidade média = distância ÷ tempo.
Me envie sua conta e sua resposta final que eu corrijo para você.`;
  }

  if (asksExercise && /\b(fisica|forca|velocidade|energia|movimento|densidade)\b/.test(normalized)) {
    return `Aqui vai uma conta de Física:

Enunciado:
Um carro percorre 120 km em 2 horas. Qual foi a velocidade média do carro?

Resolução:
1. Fórmula: velocidade média = distância ÷ tempo
2. Substituindo: 120 km ÷ 2 h = 60 km/h

Resposta final:
A velocidade média foi 60 km/h.

Para treinar: se o carro percorresse 180 km em 3 horas, qual seria a velocidade média?`;
  }

  if (asksExercise && wantsPracticeOnly && /\b(matematica|equacao|funcao|porcentagem|algebra)\b/.test(normalized)) {
    return `Exercício de Matemática para você fazer:

Enunciado:
Resolva a equação 4x + 8 = 28.

Sua vez:
Mostre o valor de x e me envie sua conta. Eu corrijo para você.`;
  }

  if (asksExercise && /\b(matematica|equacao|funcao|porcentagem|algebra)\b/.test(normalized)) {
    return `Aqui vai uma conta de Matemática:

Enunciado:
Resolva a equação 3x + 12 = 30.

Resolução:
1. Subtraia 12 dos dois lados: 3x = 18
2. Divida por 3: x = 6

Resposta final:
x = 6.

Para treinar: resolva 4x + 8 = 28.`;
  }

  if (asksExercise) {
    const topic = subject?.name || topics[0] || "o conteúdo estudado";
    if (wantsPracticeOnly) {
      return `Pergunta para você fazer:

Tema:
${topic}

Enunciado:
Explique a ideia principal desse tema e crie um exemplo simples.

Sua vez:
Responda com suas palavras. Depois eu corrijo e melhoro sua resposta.`;
    }

    return `Aqui vai uma atividade rápida sobre ${topic}:

Enunciado:
Explique o conceito principal de ${topic} e crie um exemplo simples de uso no dia a dia.

Modelo de resposta:
1. Defina a ideia principal em uma frase.
2. Mostre um exemplo concreto.
3. Escreva uma conclusão curta.

Agora tente responder e me envie. Eu corrijo para você.`;
  }

  const baseTopics = topics.length ? topics : ["conceito principal", "exemplo aplicado", "revisão ativa"];
  const intro = subject ? `Aqui vai um resumo rápido de ${subject.name}:` : "Aqui vai um resumo rápido:";
  return `${intro}\n\n${baseTopics.map((topic) => `- ${topic}: revise a ideia principal, veja um exemplo e tente explicar com suas palavras.`).join("\n")}\n\nPara treinar:\n${baseTopics.slice(0, 3).map((topic, index) => `${index + 1}. O que você lembra sobre ${topic}?`).join("\n")}\n\nPróximo passo: estude por ${user.settings?.focusMinutes || 25} minutos e marque o conteúdo como estudado.`;
}

function weeklyBars(sessions: Session[]) {
  const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return Array.from({ length: 7 }, (_, index) => {
    const day = today() - (6 - index) * 86400000;
    return {
      label: labels[new Date(day).getDay()],
      count: sessions.filter((item) => {
        const created = new Date(item.createdAt);
        created.setHours(0, 0, 0, 0);
        return created.getTime() === day;
      }).length,
    };
  });
}

function useMemoUserData() {
  return { subjects: [] as Subject[], materials: [] as Material[], tasks: [] as Task[], chats: [] as ChatMessage[], sessions: [] as Session[], flashcards: [] as Flashcard[], comments: [] as SiteComment[], suggestions: [] as SiteSuggestion[], updates: [] as SiteUpdate[] };
}

const appNode = document.getElementById("app")!;
const rootHost = window as Window & { __minervaRoot?: Root };
const appRoot = rootHost.__minervaRoot ?? createRoot(appNode);
rootHost.__minervaRoot = appRoot;

appRoot.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
