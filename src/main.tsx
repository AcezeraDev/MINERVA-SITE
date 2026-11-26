import React, { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { SubjectExtras } from "./conteudo/MateriaExtras";
import { createRoot, type Root } from "react-dom/client";
import { createPortal } from "react-dom";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Clapperboard,
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
  ImagePlus,
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
  MousePointer2,
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
  Telescope,
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
  Library,
  NotebookPen,
  Swords,
  ClipboardList,
  Landmark,
  Pencil,
  Gamepad2,
  Box,
  Headphones,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
  Volume2,
  VolumeX,
  ThumbsUp,
  ThumbsDown,
  Mic,
  MicOff,
  Repeat,
  Clock,
  PenLine,
  Pin,
  PinOff,
  MonitorPlay,
  Gauge,
  GitBranch,
  Phone,
  MessageCircleQuestion,
  Split,
  Quote,
  UserRound,
} from "lucide-react";
import "./fonts";
import "./index.css";
import {
  ActivityChart,
  ConsistencyHeatmap,
  dailySeries,
  focusMinutes,
  humanMinutes,
  MasteryBars,
  SessionMix,
  type MasteryRow,
} from "./insights";
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
} from "./motion";
import { MAX_CHAT_PROMPT_CHARS } from "../shared/chat-limits.mjs";
import { mergeSeen, noveltyKey, parseSequencePuzzles, pickUnseen, type SequencePuzzle } from "../shared/game-core.mjs";
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
  inlineMaterialFromPrompt,
  wantsGuidedQuiz,
} from "../shared/chat-intent.mjs";
import { parseFlashcards, parseQuiz, type QuizQuestion } from "../shared/study-parsers.mjs";
import { ofertaFinal } from "../shared/chat-ofertas.mjs";
import { asksToGenerateImage, describeImageMarkers, extractSuggestions, splitMessageMedia, stripImageMarkers } from "../shared/chat-media.mjs";
import { MineGlossaryProvider, MineRichText } from "./chat/MineRichText";
import { MineMonitor, useMonitorOpen } from "./chat/monitor/MineMonitor";
import { extractGlossary, markGlossary } from "../shared/chat-glossary.mjs";
import { colchetesParaBlocos } from "../shared/chat-blocos-colchete.mjs";
import { DossieProgresso } from "./chat/DossieProgresso";
import { FORMATOS_CHAT, formatoChat, normalizarComando, pedidoComFormato, type FormatoChat } from "./chat/formatosChat";
import { asksForFile, asksForStudySheet } from "../shared/chat-files.mjs";
import { searchConversations } from "../shared/chat-search.mjs";
import { chatActionFromPrompt, planejarAcao, type ChatAction } from "./chat/acoes";
import { deixarPreset } from "./chat/presets";
import { MineSourcesButton, MineSourcesProvider, MineThought, MineWorking, type MineSearchStatus } from "./chat/MineSources";
import { cleanVisits, MineControlePanel, MineControleVisits, type MineVisit } from "./chat/MineControle";
import { MineAnswerActions, VersionSwitch } from "./chat/MineAnswerActions";
import { branchSlice, switchBranch, versionInfo } from "./chat/branches";
import { MineImageGallery } from "./chat/MineImageGallery";
import { downloadPhotosZip } from "./chat/galleryZip";
import { buildAlunoSnapshot } from "./chat/aluno";
import { MineGeneratedImage } from "./chat/MineGeneratedImage";
import "./chat/mine-gallery.css";
import { inThread, threadsOf, togglePinned, type ChatThread } from "./chat/threads";
import "./chat/mine-rich-text.css";
import "./chat/mine-chat.css";
// Caderno vivo por último: é a identidade que vence as camadas anteriores.
import "./caderno.css";
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
  mineConversa,
  mineSays,
  pageFadeVariants,
  pageFlipVariants,
  playChime,
  setSoundsEnabled,
} from "./caderno";
import { PencilTimer } from "./caderno/PencilTimer";
import { InkBarChart, LevelStamp, StickerBook } from "./caderno/Progress";
import { BookshelfPodium } from "./caderno/Bookshelf";
import { MineFace } from "./caderno/MineFace";
import { HomeEstante, type DiaSemana, type ItemFicha, type MateriaEstante, type PassoHoje } from "./home/HomeEstante";
import type { AvisoCaderno } from "./home/Sistema3D";
import { NovaMateriaFx, anunciarMateria } from "./home/NovaMateriaFx";
import { MineWelcome } from "./caderno/MineWelcome";
import { CadernoSplash } from "./caderno/Splash";
import { MineTour, tourSteps } from "./caderno/MineTour";
import { ConquistaCard } from "./caderno/Conquista";
import { LiveMindMap, type MindNode } from "./caderno/LiveMindMap";
import { LoginScreen } from "./caderno/Login";
import { Estante } from "./caderno/Estante";
import { PageCurl, pageCurlVariants } from "./caderno/PageCurl";
import "./caderno/caderno-mesa.css";
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
  xpSince,
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
  type GameAnswer,
} from "../shared/game-meta.mjs";
import { setTaskDone, type TaskKind, type TaskPriority, type TaskRepeat } from "../shared/agenda.mjs";

// Telas pesadas e usadas por poucos (ou só às vezes) chegam sob demanda: o
// pacote inicial fica com o que todo aluno abre ao entrar.
import { AdminSkeleton } from "./admin/AdminSkeleton";
import { focusRemainingOf, readFocusState, writeFocusState, type FocusState } from "./foco/focus-store";
import { FocusWidget } from "./foco/FocusWidget";
import { FocusQuickStart } from "./foco/FocusQuickStart";
import { mineHeaders } from "./mineAuth";
import { BlocoAcoesContext, QuizResultadoContext, type BlocoAcoes } from "./chat/blocos/Blocos";
import { AnexoDaPerguntaContext } from "./chat/blocos/Novos";
import { agendarRevisao, anotarPreferencia, avancarRevisao, dentroDaJanela, lerFicha, pareceLicao, revisoesVencidas } from "./chat/ficha";
import { anotarErros } from "../shared/provas.mjs";
const MineChamada = React.lazy(() => import("./chat/MineChamada").then((m) => ({ default: m.MineChamada })));
const FichaDialog = React.lazy(() => import("./chat/FichaDialog").then((m) => ({ default: m.FichaDialog })));
const AdminView = React.lazy(() => import("./admin/AdminPanel").then((m) => ({ default: m.AdminView })));
const DesenharModal = React.lazy(() => import("./chat/DesenharModal").then((m) => ({ default: m.DesenharModal })));
const GamesView = React.lazy(() => import("./games/GamesPanel").then((m) => ({ default: m.GamesView })));
const AtelieView = React.lazy(() => import("./atelie/AtelieView").then((m) => ({ default: m.AtelieView })));
const IdiomasView = React.lazy(() => import("./idiomas/IdiomasView").then((m) => ({ default: m.IdiomasView })));
const RedacaoView = React.lazy(() => import("./redacao/RedacaoView").then((m) => ({ default: m.RedacaoView })));
const AtividadesView = React.lazy(() => import("./atividades/AtividadesView").then((m) => ({ default: m.AtividadesView })));
const SalaView = React.lazy(() => import("./sala/SalaView").then((m) => ({ default: m.SalaView })));
const CuboView = React.lazy(() => import("./cubo/CuboView").then((m) => ({ default: m.CuboView })));
const FerramentasView = React.lazy(() => import("./ferramentas/FerramentasView").then((m) => ({ default: m.FerramentasView })));
const VideosView = React.lazy(() => import("./videos/VideosView").then((m) => ({ default: m.VideosView })));
const LaboratorioView = React.lazy(() => import("./laboratorio/LaboratorioView").then((m) => ({ default: m.LaboratorioView })));
const LeituraView = React.lazy(() => import("./leitura/LeituraView").then((m) => ({ default: m.LeituraView })));
const DueloView = React.lazy(() => import("./duelo/DueloView").then((m) => ({ default: m.DueloView })));
const ProvasView = React.lazy(() => import("./provas/ProvasView").then((m) => ({ default: m.ProvasView })));
// Nov/2026: Conteúdo (matéria), Ranking e Perfil saíram do main.tsx para pastas próprias.
const SubjectView = React.lazy(() => import("./conteudo/SubjectView").then((m) => ({ default: m.SubjectView })));
const RankingView = React.lazy(() => import("./ranking/RankingView").then((m) => ({ default: m.RankingView })));
const ProfileView = React.lazy(() => import("./perfil/ProfileView").then((m) => ({ default: m.ProfileView })));
const AgendaView = React.lazy(() => import("./agenda/AgendaView").then((m) => ({ default: m.AgendaView })));
const TaskEditor = React.lazy(() => import("./agenda/TaskEditor").then((m) => ({ default: m.TaskEditor })));

const ComoUsarView = React.lazy(() => import("./guia/ComoUsarView").then((m) => ({ default: m.ComoUsarView })));
const Pets = React.lazy(() => import("./pets/Pets"));
const MindmapModal = React.lazy(() => import("./mindmap/MindmapPanel").then((m) => ({ default: m.MindmapModal })));

/** Enquanto um pedaço do caderno carrega: um lápis girando no meio da folha. */
export function PageLoading() {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status" aria-label="Carregando">
      <Loader2 className="h-8 w-8 animate-spin text-pen" />
    </div>
  );
}

const logoMaskUrl = new URL("../assets/minerva_mark_mask.png", import.meta.url).href;
const storageKey = "minerva-react-v2";
const sessionStorageKey = "minerva-session-v1";
const minePhotosStorageKey = "minerva-mine-photos-v1";
const mineOpenStorageKey = "minerva-mine-open-v1";
const mineTutorStorageKey = "minerva-mine-tutor-v1";
const navHiddenStorageKey = "minerva-nav-hidden-v1";
// v2 (set/2026): o site passou a abrir branco. O escuro guardado na v1 era,
// quase sempre, só o padrão antigo — então ele não é mais lido; só a cor.
const appearanceStorageKey = "minerva-appearance-v2";
const legacyAppearanceStorageKey = "minerva-appearance-v1";

type ThemeMode = "dark" | "light";

type AppearanceChoice = {
  themeMode: ThemeMode;
  accentColor: string;
};

// O caderno abre de dia. A cor escolhida é o marca-texto: verde, amarelo, rosa,
// lilás, laranja e azul-piscina, os mesmos do estojo.
const defaultAppearance: AppearanceChoice = { themeMode: "light", accentColor: "#39F59A" };
const accentPresets = ["#39F59A", "#F4F05A", "#FF8FB1", "#B7A5FF", "#FFB347", "#5CE1E6"];

export function normalizeAccent(value: string | undefined) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : defaultAppearance.accentColor;
}

function readAppearance(): AppearanceChoice {
  try {
    const current = localStorage.getItem(appearanceStorageKey);
    const legacy = JSON.parse(localStorage.getItem(legacyAppearanceStorageKey) || "{}") as Partial<AppearanceChoice>;
    const saved = (current ? JSON.parse(current) : { accentColor: legacy.accentColor }) as Partial<AppearanceChoice>;
    return {
      themeMode: saved.themeMode === "dark" ? "dark" : "light",
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

export function BrandMark({ className = "", label }: { className?: string; label?: string }) {
  const maskId = `minerva-mark-${useId().replace(/:/g, "")}`;
  const [maskReady, setMaskReady] = useState(false);

  useEffect(() => {
    let active = true;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (active) setMaskReady(true);
    };
    image.onerror = () => {
      if (active) setMaskReady(false);
    };
    image.src = logoMaskUrl;

    return () => {
      active = false;
      image.onload = null;
      image.onerror = null;
    };
  }, []);

  return (
    <svg
      viewBox="0 0 408 512"
      preserveAspectRatio="xMidYMid meet"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`brand-mark ${className}`}
    >
      {maskReady ? (
        <>
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="408" height="512" style={{ maskType: "luminance" }}>
              <image href={logoMaskUrl} x="0" y="0" width="408" height="512" />
            </mask>
          </defs>
          <rect x="0" y="0" width="408" height="512" fill="currentColor" mask={`url(#${maskId})`} />
        </>
      ) : (
        <g className="brand-mark-fallback" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="204" cy="31" r="13" fill="currentColor" stroke="none" />
          <path d="M204 48v24" strokeWidth="12" />
          <path d="m68 123 136-51 136 51-136 54Z" fill="currentColor" strokeWidth="8" />
          <path d="M116 157c23-12 54-18 88-18s65 6 88 18" strokeWidth="16" />
          <rect x="70" y="171" width="268" height="202" rx="84" strokeWidth="22" />
          <path d="M126 253c5-18 17-27 34-27s29 9 34 27M214 253c5-18 17-27 34-27s29 9 34 27" strokeWidth="16" />
          <path d="M174 294c8 19 18 28 30 28s22-9 30-28" strokeWidth="16" />
          <path d="M204 485c-32-48-72-75-132-83l-13-42c58 2 106 18 145 53 39-35 87-51 145-53l-13 42c-60 8-100 35-132 83Z" strokeWidth="19" />
          <path d="M204 414v67" strokeWidth="14" />
        </g>
      )}
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
  | "atividades"
  | "provas"
  | "redacao"
  | "leitura"
  | "laboratorio"
  | "duelo"
  | "foco"
  | "progress"
  | "ranking"
  | "mine"
  | "games"
  | "cubo"
  | "ferramentas"
  | "sala"
  | "atelie"
  | "idiomas"
  | "videos"
  | "search"
  | "plan"
  | "comments"
  | "suggestions"
  | "about"
  | "como-usar"
  | "perfil"
  | "settings"
  | "admin";

export type User = {
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
    /** Mine andando pelas abas. Padrão: ligada. ("turma" vem de quando eram três robôs e vale como ligada.) */
    pets?: "off" | "mine" | "turma";
    /** Sons do caderno (lápis, página, carimbo). Desligados por padrão. */
    sounds?: boolean;
    /** Já fez o tour guiado da Mine. */
    tourDone?: boolean;
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
    /** A pessoa escolheu o tema no botão. Sem isso, vale o padrão (branco):
     * contas antigas guardavam "dark" só porque era o padrão do servidor. */
    themeChosen?: boolean;
    accentColor?: string;
    /** Caderno de erros e provas feitas: vão com a conta para qualquer aparelho (nov/2026). */
    provas?: { caderno: unknown[]; historico: unknown[]; atualizadoEm: number };
  };
};

export type Subject = {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon: IconName;
  favorite: boolean;
  createdAt: number;
  /** Trilha, livros, fórmulas e links da página da matéria (nov/2026). */
  extras?: SubjectExtras;
};

export type Material = {
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

type LibraryResult = {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  coverUrl?: string;
  isbn?: string;
  editionCount: number;
  sourceUrl: string;
  source: "Open Library";
};

type ResearchResult = {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  container: string;
  doi?: string;
  type: string;
  sourceUrl: string;
  source: "Crossref";
};

export type PublicHoliday = {
  date: string;
  localName: string;
  name: string;
  global: boolean;
  counties: string[];
  types: string[];
  source: "Nager.Date";
};

export type Task = {
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
  /** Campos da agenda nova; todos opcionais porque tarefas antigas não têm. */
  kind?: TaskKind;
  priority?: TaskPriority;
  /** "HH:MM" no fuso de quem criou. */
  time?: string;
  steps?: TaskStep[];
  repeat?: TaskRepeat;
  /** Id da cópia criada ao concluir uma tarefa que repete (evita duplicar). */
  spawnedNext?: string;
  /** Tarefas criadas juntas pelo Plano de estudos: dá para editar ou remover o plano inteiro. */
  planId?: string;
};

export type TaskStep = { id: string; text: string; done: boolean };

type ChatAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  kind: "image" | "file";
  dataUrl: string;
  text?: string;
};

export type ChatMessage = {
  id: string;
  userId: string;
  subjectId?: string;
  role: "user" | "mine";
  text: string;
  attachments?: ChatAttachment[];
  /** Fontes da web citadas na resposta, quando a pesquisa esteve ligada. */
  sources?: MineSource[];
  /** Sites e vídeos abertos pelo Controle Mine nesta resposta. */
  visits?: MineVisit[];
  /** Mapa mental visual gerado na conversa e reaberto sem uma nova chamada de IA. */
  mindmap?: Mindmap;
  /** Cartão de opções da prova, respondido dentro da própria conversa. */
  quizSetup?: ChatQuizSetup;
  /** Prova pronta, reaberta sem custar uma nova chamada de IA. */
  quiz?: ChatQuiz;
  /** Baralho de flashcards criado pela conversa. */
  deck?: ChatDeck;
  /** Conversa dentro da matéria. Ausente = conversa principal (mensagens de antes das conversas múltiplas). */
  threadId?: string;
  /** Próximas perguntas que a Mine sugeriu depois desta resposta. */
  suggestions?: string[];
  /** Resposta dada com o modo tutor ligado. */
  tutor?: boolean;
  /** Consultas que a Mine fez na web para esta resposta. */
  queries?: string[];
  /** Raciocínio devolvido pelo modelo, quando ele devolve ("Pensou por 6 s"). */
  reasoning?: string;
  /** Tempo até a resposta ficar pronta, em segundos. */
  thoughtSeconds?: number;
  /** Gostei / não gostei na resposta. */
  feedback?: "up" | "down";
  /**
   * Versões anteriores desta pergunta (editar e refazer não apagam mais a
   * conversa): cada item é o trecho inteiro da conversa a partir desta
   * pergunta, como estava antes. Só a primeira mensagem do trecho leva isto.
   */
  branches?: ChatMessage[][];
  /** Título da conversa escrito pela IA; fica na primeira pergunta. */
  threadTitle?: string;
  /** Resposta cortada (parou ou caiu no meio): ganha "Continuar daqui". */
  incompleta?: boolean;
  /** Ação feita pelo chat ("salva isso em História", "cria um duelo"): o cartão reabre o resultado. */
  action?: ChatAction;
  /** Conversa fixada no topo da lista; fica na primeira mensagem dela. */
  threadPinned?: boolean;
  createdAt: number;
};

/**
 * Escolhas da prova oferecidas dentro do chat.
 *
 * A configuração mora na conversa e não numa tela à parte: quem pediu a prova
 * já está aqui, e mandar a pessoa para um modal de ajustes antes de ver
 * qualquer coisa quebra o ritmo. `respondidoEm` guarda o que foi escolhido para
 * o cartão continuar mostrando a decisão quando a conversa é reaberta.
 */
type ChatQuizSetup = {
  topic: string;
  subjectId?: string;
  /** Já vem marcado com o que a pessoa pediu por escrito ("prova difícil de 10"). */
  padrao?: { count: number; difficulty: QuizDifficulty };
  respondidoEm?: { count: number; difficulty: QuizDifficulty; mode: QuizMode };
};

/** Prova pronta anexada a uma mensagem da Mine. */
type ChatQuiz = {
  title: string;
  subjectId?: string;
  mode: QuizMode;
  questions: QuizQuestion[];
};

/** Baralho criado pela conversa. Os cartões em si vivem em `data.flashcards`. */
type ChatDeck = {
  title: string;
  subjectId: string;
  total: number;
  /** A matéria foi criada na hora para abrigar estes cartões. */
  subjectCriada?: boolean;
};

type MineSource = { url: string; title: string; domain?: string; snippet?: string };
type MineEsforco = "rapida" | "normal" | "caprichada";

/**
 * Modo fotos: fica desligado até a pessoa ligar, e continua ligado depois.
 *
 * Preferência de leitura, não dado de conta — mora no aparelho, e não no
 * banco: quem lê no celular pode querer as
 * fotos e no computador do trabalho não.
 */
function readMinePhotos(): boolean {
  try {
    return localStorage.getItem(minePhotosStorageKey) === "1";
  } catch {
    return false;
  }
}

function saveMinePhotos(enabled: boolean) {
  try {
    localStorage.setItem(minePhotosStorageKey, enabled ? "1" : "0");
  } catch {
    // Sem armazenamento local a escolha vale só até recarregar.
  }
}

/** Modo tutor: como o modo fotos, uma preferência do aparelho. */
function readMineTutor(): boolean {
  try {
    return localStorage.getItem(mineTutorStorageKey) === "1";
  } catch {
    return false;
  }
}

function saveMineTutor(enabled: boolean) {
  try {
    localStorage.setItem(mineTutorStorageKey, enabled ? "1" : "0");
  } catch {
    // Sem armazenamento local a escolha vale só até recarregar.
  }
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
  /** Aviso curto e discreto (ex.: a busca na web falhou nesta resposta). */
  notice?: string;
  sources?: MineSource[];
  queries?: string[];
  reasoning?: string;
  visits?: MineVisit[];
};

export type Session = {
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
  /** Desenho do Ateliê que rendeu esta sessão: cada desenho vale XP uma vez só. */
  drawingId?: string;
  mode?: "standard" | "daily" | "review";
  reviewedErrorIds?: string[];
  reviewCount?: number;
  /** Aba Idiomas: idioma, etapa da trilha e palavras acertadas/erradas. */
  lang?: string;
  lessonKey?: string;
  wordsRight?: string[];
  wordsMissed?: string[];
  spoke?: number;
  /** Aba Redação: tema e as notas das 5 competências (0 a 200 cada). */
  tema?: string;
  notas?: number[];
  /** Proposta pronta de redação (shared/redacao-propostas.mjs): a primeira entrega vale mais XP. */
  propostaId?: string;
  /** Proposta que a Mine criou do tema digitado: vale o XP do tema livre (sem propostaId de propósito). */
  propostaCriadaId?: string;
  /** Aba Atividades: componente e pontos da tarefa. */
  materia?: string;
  pontos?: number;
  pontosMax?: number;
};

export type Flashcard = {
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

export type SiteComment = {
  id: string;
  userId: string;
  name: string;
  text: string;
  rating: number;
  createdAt: number;
};

export type UpdateCategory = "novidade" | "melhoria" | "correcao";

type SiteUpdate = {
  id: string;
  title: string;
  body: string;
  category: UpdateCategory;
  createdAt: number;
};

export type SiteSuggestion = {
  id: string;
  userId: string;
  name: string;
  category: "ideia" | "melhoria" | "erro" | "conteudo";
  text: string;
  status: "nova" | "analisando" | "planejada" | "concluida" | "recusada";
  createdAt: number;
};

export type AppData = {
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

export type SyncStatus = "conectando" | "online" | "salvando" | "offline";

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

export type Modal =
  | { type: "subject" }
  | { type: "material"; subjectId: string; kind?: Material["type"] }
  | { type: "materialView"; materialId: string }
  | { type: "task"; subjectId?: string; taskId?: string; dueAt?: number; title?: string }
  | { type: "quiz"; subjectId?: string; topic?: string; initialQuestions?: QuizQuestion[]; initialMode?: QuizMode }
  | { type: "mindmap"; subjectId?: string; topic?: string; initialMap?: Mindmap }
  | { type: "flashcards"; subjectId: string }
  | { type: "confirm"; title: string; body: string; onConfirm: () => void };

export const iconMap: Record<IconName, LucideIcon> = {
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
  { view: "atividades", label: "Atividades", icon: ClipboardList },
  { view: "provas", label: "Prova e erros", icon: ClipboardCheck },
  { view: "redacao", label: "Redação", icon: NotebookPen },
  { view: "leitura", label: "Leitura", icon: BookOpen },
  { view: "laboratorio", label: "Laboratório", icon: FlaskConical },
  { view: "duelo", label: "Duelo", icon: Swords },
  { view: "foco", label: "Foco", icon: Timer },
  { view: "progress", label: "Progresso", icon: Activity },
  { view: "ranking", label: "Ranking", icon: Trophy },
  { view: "mine", label: "Mine", icon: Bot },
  { view: "games", label: "Games com a Mine", icon: Gamepad2 },
  { view: "cubo", label: "Cubo Mágico", icon: Box },
  { view: "ferramentas", label: "Ferramentas", icon: Calculator },
  { view: "sala", label: "Sala de estudo", icon: Headphones },
  { view: "atelie", label: "Ateliê da Mine", icon: Palette },
  { view: "idiomas", label: "Idiomas com a Mine", icon: Languages },
  { view: "videos", label: "Vídeos", icon: MonitorPlay },
  { view: "search", label: "Busca", icon: Search },
  { view: "plan", label: "Plano de estudos", icon: CalendarPlus },
  { view: "comments", label: "Comentários", icon: MessageCircle },
  { view: "suggestions", label: "Sugestões", icon: Sparkles },
  { view: "como-usar", label: "Como usar", icon: Clapperboard },
  { view: "about", label: "Sobre", icon: Info },
  { view: "perfil", label: "Perfil e ajustes", icon: Settings },
  { view: "admin", label: "Admin", icon: Shield },
];

/**
 * Nov/2026: o menu tinha 24 destinos em listas longas e o aluno novo se
 * perdia. Agora são cinco áreas, cada uma uma divisória de fichário que abre e
 * fecha; só a área da tela atual começa aberta. Início fica fora (é a capa) e a
 * conta vai para o rodapé da barra.
 */
export type NavArea = "materias" | "estudar" | "praticar" | "jogar" | "organizar" | "turma";
const navGroups: Array<{ id: NavArea; label: string; hint: string; icon: LucideIcon; views: View[] }> = [
  { id: "estudar", label: "Estudar", hint: "Mine, vídeos, leitura, laboratório, ferramentas", icon: BookOpen, views: ["mine", "videos", "leitura", "laboratorio", "ferramentas", "idiomas", "search"] },
  { id: "praticar", label: "Praticar", hint: "Atividades, provas, redação, duelo", icon: ClipboardCheck, views: ["atividades", "provas", "redacao", "duelo"] },
  { id: "jogar", label: "Jogar", hint: "Games, cubo mágico, ateliê", icon: Gamepad2, views: ["games", "cubo", "atelie"] },
  { id: "organizar", label: "Organizar", hint: "Agenda, foco, plano, progresso", icon: CalendarDays, views: ["agenda", "plan", "progress", "foco"] },
  { id: "turma", label: "Turma", hint: "Sala, ranking, comentários", icon: Headphones, views: ["sala", "ranking", "comments", "suggestions"] },
];
const accountViews: View[] = ["perfil", "como-usar", "about", "admin"];

function areaOf(view: View): NavArea | null {
  if (view === "subject") return "materias";
  return navGroups.find((group) => group.views.includes(view))?.id || null;
}

/** Barra inferior mobile: só os 4 destinos de uso diário; o resto vive na gaveta "Mais". */
const mobilePrimary: View[] = ["home", "agenda", "atividades", "mine"];

/**
 * Telas que continuam existindo (os links e atalhos funcionam) mas não
 * aparecem em nenhum menu. O Foco chegou a sair do menu em nov/2026 e voltou
 * no fim do mês, na área Organizar, a pedido do usuário.
 */
const hiddenFromMenu: View[] = [];

function navItemOf(view: View) {
  return navItems.find((item) => item.view === view);
}

export function uid(prefix: string) {
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

/**
 * Endereço de um conteúdo do tipo link, já com https:// quando faltar, ou ""
 * se o texto não forma um endereço (espaço no meio, sem domínio, outro
 * protocolo). Antes "isso não é um link" virava https://isso não é um link.
 */
export function normalizeMaterialLink(value: string) {
  const raw = String(value || "").trim();
  if (!raw || /\s/.test(raw)) return "";
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    const host = url.hostname;
    if (host !== "localhost" && !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(host) && !/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return "";
    return url.href;
  } catch {
    return "";
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
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

export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
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

export function today() {
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

export function toggleStudied(material: Material, studied: boolean): Material {
  return { ...material, studied, studiedAt: studied ? Date.now() : undefined };
}

function addDays(days: number) {
  return today() + days * 86400000;
}

function localDateKey(timestamp: number) {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
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

/**
 * Guarda o estado no navegador sem nunca derrubar a tela.
 *
 * A cota do localStorage é de ~5 MB e os anexos do chat viajam como data URL
 * base64 dentro do próprio estado: duas fotos de caderno já estouram o limite.
 * Antes isso era um `setItem` solto dentro de um `useEffect`, então o
 * QuotaExceededError subia pela árvore do React e a tela ficava branca — bem
 * pior que perder o cache local, que é só uma conveniência offline (a verdade
 * mora no servidor).
 *
 * Na segunda tentativa os anexos saem de cena. O texto das conversas é o que
 * importa para reabrir o site offline; a imagem volta do servidor.
 */
function saveLocalData(data: AppData) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
    return;
  } catch {
    // Cota estourada: tenta de novo sem o que ocupa espaço de verdade.
  }
  try {
    const enxuto: AppData = {
      ...data,
      chats: data.chats.map(({ attachments: _attachments, ...message }) => message),
    };
    localStorage.setItem(storageKey, JSON.stringify(enxuto));
  } catch {
    // Sem espaço nem para a versão enxuta (aba anônima, armazenamento
    // bloqueado). O site continua funcionando pelo servidor.
  }
}

function emptySession(): SessionState {
  return { currentUserId: null, currentAdminUserId: null, token: null };
}

export function readSession(): SessionState {
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
  try {
    localStorage.setItem(sessionStorageKey, JSON.stringify(session));
  } catch {
    // Armazenamento bloqueado (aba anônima, site sem permissão): a sessão vale
    // só até recarregar a página. Melhor que derrubar a tela no meio do login.
  }
}

function withSession(data: AppData, session: SessionState): AppData {
  return {
    ...data,
    currentUserId: session.currentUserId,
    currentAdminUserId: session.currentAdminUserId,
  };
}

/**
 * A Vercel recusa corpo de função acima de 4,5 MB (413) e o estado inteiro
 * viaja num PUT só. Acima deste teto nem tenta: avisa em vez de falhar calado.
 */
const maxSyncBodyChars = 4_300_000;

type ConfirmarGravacao = (pronto?: (data: AppData) => boolean) => Promise<{ ok: boolean; motivo?: "cheio" | "offline" | "sem-conta" }>;
let confirmarGravacaoAtual: ConfirmarGravacao | null = null;

/**
 * Espera o estado (já com a mudança que `pronto` reconhece) chegar ao
 * servidor. Usado onde perder a gravação custa caro, como anexos de matéria:
 * a auditoria de 22/nov/2026 viu uma imagem sumir depois de "Conteúdo
 * adicionado" porque o PUT falhou sem aviso.
 */
export function confirmarGravacao(pronto?: (data: AppData) => boolean) {
  return confirmarGravacaoAtual ? confirmarGravacaoAtual(pronto) : Promise.resolve({ ok: false, motivo: "offline" as const });
}

function dataForServer(data: AppData): AppData {
  return {
    ...data,
    users: data.users.map(({ password: _password, ...user }) => user),
    currentUserId: null,
    currentAdminUserId: null,
  };
}

export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
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

export function go(view: View, id?: string) {
  window.location.hash = id ? `#/${view}/${id}` : `#/${view}`;
}

export function dateLabel(timestamp: number) {
  const diff = Math.round((timestamp - today()) / 86400000);
  if (diff < 0) return "Atrasada";
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  return `Em ${diff} dias`;
}

export function shortDate(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(timestamp));
}

/** Como shortDate, mas com o ano quando ele não é o atual ("16/11/2027"). */
export function shortDateWithYear(timestamp: number) {
  const year = new Date(timestamp).getFullYear();
  return year === new Date().getFullYear() ? shortDate(timestamp) : `${shortDate(timestamp)}/${year}`;
}

function timeLabel(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}

function activityAge(timestamp: number) {
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return shortDate(timestamp);
}

export function percent(done: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
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
  /** Artefato que a Mine está montando agora (mapa, prova ou baralho). */
  const [mineArtifactLoading, setMineArtifactLoading] = useState<{ kind: "mindmap" | "quiz" | "deck"; topic: string } | null>(null);
  const [mineSuggestions, setMineSuggestions] = useState<string[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | undefined>();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("conectando");
  const [databaseMode, setDatabaseMode] = useState("backend");
  const [mineStreamText, setMineStreamText] = useState("");
  // Etapa da pesquisa ("Pesquisando", "Lendo 6 fontes") e o raciocínio que
  // chega antes do texto.
  const [mineStatus, setMineStatus] = useState<MineSearchStatus | null>(null);
  const [mineReasoning, setMineReasoning] = useState("");
  const [mineWebSearch, setMineWebSearch] = useState(false);
  // Pesquisa aprofundada vale para UMA pergunta (é a mais cara); Pensar com
  // calma fica ligado até a pessoa desligar.
  const [mineProfundo, setMineProfundo] = useState(false);
  // Esforço da resposta (25/nov/2026): Rápida, Normal ou Caprichada, no seletor
  // da barra. Fica salvo no aparelho, como o Modo fotos.
  const [mineEsforco, setMineEsforcoState] = useState<MineEsforco>(() => {
    try {
      const salvo = window.localStorage.getItem("minerva:mine-esforco");
      return salvo === "rapida" || salvo === "caprichada" ? salvo : "normal";
    } catch {
      return "normal";
    }
  });
  const setMineEsforco = useCallback((valor: MineEsforco) => {
    setMineEsforcoState(valor);
    try {
      window.localStorage.setItem("minerva:mine-esforco", valor);
    } catch {
      // Sem armazenamento: vale nesta visita.
    }
  }, []);
  const mineCaprichar = mineEsforco === "caprichada";
  const [minePhotos, setMinePhotosState] = useState(() => readMinePhotos());
  const [commandOpen, setCommandOpen] = useState(false);
  const setMinePhotos = useCallback((enabled: boolean) => {
    setMinePhotosState(enabled);
    saveMinePhotos(enabled);
  }, []);
  // Controle Mine: só quando o estudante liga no chat, e não fica salvo — cada
  // visita abre sites de verdade, então é escolha da conversa, não do aparelho.
  const [mineControle, setMineControle] = useState(false);
  const [mineVisits, setMineVisits] = useState<MineVisit[]>([]);
  const [mineControleLive, setMineControleLive] = useState(false);
  const [mineDeepLive, setMineDeepLive] = useState(false);
  const [mineTutor, setMineTutorState] = useState(() => readMineTutor());
  const setMineTutor = useCallback((enabled: boolean) => {
    setMineTutorState(enabled);
    saveMineTutor(enabled);
  }, []);
  // Conversa aberta dentro da matéria selecionada. `undefined` = principal.
  const [mineThreadId, setMineThreadId] = useState<string | undefined>();
  // O `send` roda depois de awaits: lê a conversa pela ref, não pela closure.
  const mineThreadRef = useRef<string | undefined>(undefined);
  mineThreadRef.current = mineThreadId;
  // Pergunta mandada de fora do chat ("estudar com a Mine" na trilha, atalhos
  // da matéria). Antes a página da matéria gravava a pergunta e pedia a
  // resposta por fora, sem streaming nem indicador, numa conversa que nem
  // sempre era a aberta: o chat abria com a pergunta e parecia não ter
  // enviado. Agora ela espera o chat montar e sai pelo `send` dele.
  const [pendingMinePrompt, setPendingMinePrompt] = useState<{ id: string; subjectId?: string; text: string } | null>(null);
  const pendingMinePromptRef = useRef(pendingMinePrompt);
  pendingMinePromptRef.current = pendingMinePrompt;
  const askMineInChat = useCallback((text: string, subjectId?: string) => {
    setPendingMinePrompt({ id: uid("pedido"), subjectId, text });
    setSelectedSubjectId(subjectId);
    setMineThreadId(uid("thread"));
    go("mine");
  }, []);
  // O botão do globo só aparece se o servidor disser que a busca está ligada.
  const [mineWebAvailable, setMineWebAvailable] = useState(false);
  const [navHidden, setNavHiddenState] = useState(() => readNavHidden());
  const saveReadyRef = useRef(false);
  const skipNextSaveRef = useRef(false);
  const modalRef = useRef<Modal | null>(null);
  const modalOpenedAtRef = useRef(0);
  if (modal && !modalRef.current) modalOpenedAtRef.current = Date.now();
  modalRef.current = modal;
  // Fila de gravação: um PUT por vez, sempre com o estado mais novo. Dois PUTs
  // em paralelo podiam chegar fora de ordem e o mais velho apagar o mais novo.
  const latestDataRef = useRef(data);
  latestDataRef.current = data;
  const saveTimerRef = useRef<number | undefined>(undefined);
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const savePendingRef = useRef(false);
  // Controla a geração em curso: o botão parar aborta por aqui.
  const mineAbortRef = useRef<AbortController | null>(null);
  // O texto parcial precisa de ref porque o handler de erro lê o valor mais
  // recente, e o estado dentro da closure ficaria velho.
  const mineStreamRef = useRef("");

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

  // A busca é uma ação global, não um destino. Ctrl/Cmd + K abre a mesma
  // janela em qualquer tela sem tirar a pessoa do que estava estudando.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || (!event.ctrlKey && !event.metaKey)) return;
      const target = event.target as HTMLElement | null;
      if (!data.currentUserId || target?.closest("[role='dialog']")) return;
      event.preventDefault();
      setCommandOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data.currentUserId]);

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
    const onHash = () => {
      setRoute(routeFromHash());
      // Janela aberta numa tela não pode cobrir a próxima (o detalhe da
      // anotação ficava por cima da Leitura). A folga de 400 ms preserva os
      // fluxos que trocam de tela e abrem uma janela de propósito.
      if (modalRef.current && Date.now() - modalOpenedAtRef.current > 400) setModal(null);
    };
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
    saveLocalData(data);

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    if (!saveReadyRef.current || !nextSession.token) return;
    setSyncStatus("salvando");
    savePendingRef.current = true;
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => void gravarNoServidor(), 650);
  }, [data]);

  function gravarNoServidor(): Promise<{ ok: boolean; motivo?: "cheio" | "offline" | "sem-conta" }> {
    window.clearTimeout(saveTimerRef.current);
    savePendingRef.current = true;
    const vez = saveChainRef.current.catch(() => undefined).then(async () => {
      const token = readSession().token;
      if (!token) return { ok: false, motivo: "sem-conta" as const };
      const body = JSON.stringify({ data: dataForServer(latestDataRef.current) });
      if (body.length > maxSyncBodyChars) {
        setSyncStatus("offline");
        return { ok: false, motivo: "cheio" as const };
      }
      setSyncStatus("salvando");
      try {
        const response = await apiJson<{ data: AppData; database: string }>("/api/data", {
          method: "PUT",
          headers: { authorization: `Bearer ${token}` },
          body,
        });
        setDatabaseMode(response.database);
        setSyncStatus("online");
        return { ok: true };
      } catch {
        setSyncStatus("offline");
        return { ok: false, motivo: "offline" as const };
      }
    });
    saveChainRef.current = vez;
    void vez.then(() => {
      if (saveChainRef.current === vez) savePendingRef.current = false;
    });
    return vez;
  }

  useEffect(() => {
    confirmarGravacaoAtual = async (pronto) => {
      // O update() acabou de ser chamado: espera o React aplicar a mudança.
      for (let i = 0; pronto && i < 40 && !pronto(latestDataRef.current); i++) {
        await new Promise((resolve) => window.setTimeout(resolve, 25));
      }
      return gravarNoServidor();
    };
    // Recarregar com gravação pendente perde a mudança: o navegador pergunta antes.
    const avisarSaida = (event: BeforeUnloadEvent) => {
      if (!savePendingRef.current || !readSession().token) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", avisarSaida);
    return () => {
      confirmarGravacaoAtual = null;
      window.removeEventListener("beforeunload", avisarSaida);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowIntro(false), 3900);
    return () => window.clearTimeout(timer);
  }, []);

  const user = data.users.find((item) => item.id === data.currentUserId) || null;
  const appearance: AppearanceChoice = {
    themeMode: user?.settings.themeChosen && user.settings.themeMode ? user.settings.themeMode : guestAppearance.themeMode,
    accentColor: normalizeAccent(user?.settings.accentColor || guestAppearance.accentColor),
  };

  useEffect(() => {
    const root = document.documentElement;
    const rgb = hexRgb(appearance.accentColor);
    root.classList.toggle("theme-light", appearance.themeMode === "light");
    root.style.colorScheme = appearance.themeMode;
    // O destaque é marca-texto: fica puro nos dois modos. Texto em destaque
    // usa a caneta (--pen), definida no CSS, e não uma versão escurecida dele.
    const uiRgb: [number, number, number] = [rgb[0], rgb[1], rgb[2]];
    root.style.setProperty("--mint", uiRgb.join(" "));
    root.style.setProperty("--mint-deep", mixRgb(uiRgb, 0, 0.2));
    root.style.setProperty("--accent-soft", `${uiRgb.join(" ")} / 0.12`);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", appearance.themeMode === "light" ? "#EDF1F5" : "#11151E");
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
  // Subiu de nível? Confete na tela toda e a Mine anuncia. A primeira leitura
  // só guarda o nível, para não comemorar ao abrir o site.
  const levelSeen = useRef<number | null>(null);
  // Nível novo abre a carteirinha para baixar/compartilhar.
  const [levelCard, setLevelCard] = useState<number | null>(null);
  // O tour pode ser pedido de novo pelo perfil; a carteirinha, pelo Progresso.
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    const openTour = () => setTourOpen(true);
    const openCard = () => setLevelCard(levelSeen.current || 1);
    window.addEventListener("minerva:tour", openTour);
    window.addEventListener("minerva:conquista", openCard);
    return () => {
      window.removeEventListener("minerva:tour", openTour);
      window.removeEventListener("minerva:conquista", openCard);
    };
  }, []);
  // Os sons seguem a conta (desligados por padrão).
  useEffect(() => {
    setSoundsEnabled(Boolean(user?.settings.sounds));
  }, [user?.settings.sounds]);
  const pageLayerRef = useRef<HTMLDivElement | null>(null);
  // Rede de segurança da virada de página. O AnimatePresence mode="wait" só
  // monta a página nova quando a saída da antiga termina; às vezes essa saída
  // nunca termina (aba em segundo plano, clique no meio da virada) e o endereço
  // muda com a tela antiga presa até recarregar. Se, passado o tempo da
  // virada com folga, a camada da rota atual não estiver na tela, o
  // AnimatePresence é remontado (chave nova) e a página certa aparece.
  const [presenceEpoch, setPresenceEpoch] = useState(0);
  const currentPageKey = route.view === "admin" ? "admin" : `${route.view}-${route.id || ""}`;
  useEffect(() => {
    const check = () => {
      const layers = [...document.querySelectorAll<HTMLElement>("[data-page-layer]")];
      const stuck = !layers.length || layers.some((layer) => layer.dataset.pageKey !== currentPageKey);
      if (stuck) setPresenceEpoch((value) => value + 1);
    };
    const timers = [window.setTimeout(check, 1600), window.setTimeout(check, 4000)];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [currentPageKey]);
  useEffect(() => {
    const level = rewards?.level;
    if (!level) return;
    if (levelSeen.current !== null && level > levelSeen.current) {
      window.setTimeout(() => {
        celebrate(window.innerWidth / 2, window.innerHeight * 0.4, { count: 90, spread: 2 });
        playChime();
        mineSays(`Subiu para o nível ${level}!`, "wow");
        setLevelCard(level);
      }, 400);
    }
    levelSeen.current = level;
  }, [rewards?.level]);

  // Trocar de matéria (ou os dados chegarem do servidor) abre a conversa mais
  // recente dela; as sugestões da conversa anterior não valem para esta.
  // Ao recarregar, volta para a conversa que estava aberta (matéria + conversa),
  // e não para a mais recente do site: antes, uma mensagem mandada para
  // "Estudos gerais" fazia a conversa da matéria parecer ter sumido.
  const mineOpenRestored = useRef(false);
  useEffect(() => {
    if (!user) return;
    // Uma pergunta vinda de fora já escolheu matéria e conversa nova.
    if (pendingMinePromptRef.current && (pendingMinePromptRef.current.subjectId || undefined) === (selectedSubjectId || undefined)) {
      mineOpenRestored.current = true;
      return;
    }
    let saved: { userId?: string; subjectId?: string; threadId?: string } | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(mineOpenStorageKey) || "null");
    } catch {}
    if (!mineOpenRestored.current) {
      // Espera os dados do servidor para saber se a matéria guardada existe.
      if (syncStatus === "conectando" && !userData.subjects.length) return;
      mineOpenRestored.current = true;
      if (saved?.userId === user.id && saved.subjectId && saved.subjectId !== selectedSubjectId && userData.subjects.some((item) => item.id === saved!.subjectId)) {
        setSelectedSubjectId(saved.subjectId);
        return;
      }
    }
    const threads = threadsOf(userData.chats, selectedSubjectId);
    const keep = saved?.userId === user.id && saved.subjectId === selectedSubjectId && threads.find((item) => item.id === saved!.threadId);
    setMineThreadId(keep ? keep.id : threads[0]?.id);
    setMineSuggestions([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubjectId, user?.id, syncStatus === "online", userData.subjects.length]);
  useEffect(() => {
    if (!user || !mineOpenRestored.current) return;
    try {
      sessionStorage.setItem(mineOpenStorageKey, JSON.stringify({ userId: user.id, subjectId: selectedSubjectId, threadId: mineThreadId }));
    } catch {}
  }, [user?.id, selectedSubjectId, mineThreadId]);

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
    try {
      localStorage.setItem(key, JSON.stringify({ level: rewards.level, achievements: unlockedIds }));
    } catch {
      // Sem espaço para a marca de conquistas já avisadas: no máximo o aviso
      // repete na próxima visita. Não vale quebrar a tela por isso.
    }
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
  // Virada de página com dobra de verdade (PageCurl); no aparelho fraco fica a simples.
  const pageCurl = !lowFx;

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
    // Com a virada de verdade a folha cobre a troca, então o pulo é instantâneo.
    window.scrollTo({ top: 0, behavior: reducedMotion || pageCurl ? "auto" : "smooth" });
  }, [route.view, route.id, user?.id, reducedMotion, pageCurl]);

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

  function finishTour() {
    setTourOpen(false);
    if (!user || user.settings.tourDone) return;
    update((draft) => ({
      ...draft,
      users: draft.users.map((item) => (item.id === user.id ? { ...item, settings: { ...item.settings, tourDone: true } } : item)),
    }));
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
        item.id === user.id
          ? {
              ...item,
              settings: {
                ...item.settings,
                themeMode: next.themeMode,
                accentColor: next.accentColor,
                themeChosen: patch.themeMode ? true : item.settings.themeChosen,
              },
            }
          : item,
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

  // Blocos de estudo do chat (src/chat/blocos/Estudo.tsx) pedem ao App para
  // guardar o que montaram: o baralho vai para a revisão espaçada e o plano
  // vira tarefas na Agenda. Matéria: a do chat, uma com o mesmo nome ou nova.
  const blocosRef = useRef({ user, userData, update, notify });
  blocosRef.current = { user, userData, update, notify };
  useEffect(() => {
    const materiaPara = (nome: string, subjectId?: string) => {
      const { user: dono, userData: dados } = blocosRef.current;
      if (!dono) return null;
      const daConta = dados.subjects.filter((item) => item.userId === dono.id);
      const existente = (subjectId && daConta.find((item) => item.id === subjectId)) || daConta.find((item) => normalizeText(item.name) === normalizeText(nome));
      if (existente) return { materia: existente, nova: false };
      const limpo = nome.trim() || "Estudos";
      const materia: Subject = {
        id: uid("subject"),
        userId: dono.id,
        name: limpo.length <= 40 ? limpo : limpo.slice(0, 41).replace(/\s+\S*$/, "").trim() || limpo.slice(0, 40),
        color: "#38BDF8",
        icon: "school",
        favorite: false,
        createdAt: Date.now(),
      };
      return { materia, nova: true };
    };
    const onFlashcards = (event: Event) => {
      const detail = (event as CustomEvent<{ titulo: string; cartoes: { frente: string; verso: string }[]; subjectId?: string }>).detail;
      const dono = blocosRef.current.user;
      if (!dono || !detail?.cartoes?.length) return;
      const alvo = materiaPara(detail.titulo.replace(/^flashcards?\s*(?:de|sobre|-|:|—)?\s*/i, ""), detail.subjectId);
      if (!alvo) return;
      const agora = Date.now();
      const novos: Flashcard[] = detail.cartoes.slice(0, 30).map((card, index) => ({
        id: uid("card"),
        userId: dono.id,
        subjectId: alvo.materia.id,
        front: card.frente,
        back: card.verso,
        level: 0,
        reps: 0,
        lapses: 0,
        dueAt: agora,
        createdAt: agora + index,
      }));
      blocosRef.current.update((draft) => ({
        ...draft,
        subjects: alvo.nova ? [...draft.subjects, alvo.materia] : draft.subjects,
        flashcards: [...draft.flashcards, ...novos],
      }));
      blocosRef.current.notify(`${novos.length} flashcards salvos em ${alvo.materia.name}.`);
    };
    const onPlano = (event: Event) => {
      const detail = (event as CustomEvent<{ titulo: string; materia: string; dias: { titulo: string; texto: string; dia: number }[]; subjectId?: string }>).detail;
      const dono = blocosRef.current.user;
      if (!dono || !detail?.dias?.length) return;
      const alvo = materiaPara(detail.materia || detail.titulo, detail.subjectId);
      if (!alvo) return;
      const agora = Date.now();
      // Dia 1 do plano = amanhã: hoje o estudante acabou de montar o plano.
      const tarefas: Task[] = detail.dias.slice(0, 31).map((dia, index) => ({
        id: uid("task"),
        userId: dono.id,
        subjectId: alvo.materia.id,
        title: dia.titulo,
        note: [dia.texto, `Plano: ${detail.titulo}`].filter(Boolean).join("\n"),
        dueAt: addDays(dia.dia + 1),
        done: false,
        createdAt: agora + index,
      }));
      blocosRef.current.update((draft) => ({
        ...draft,
        subjects: alvo.nova ? [...draft.subjects, alvo.materia] : draft.subjects,
        tasks: [...draft.tasks, ...tarefas],
      }));
      blocosRef.current.notify(`${tarefas.length} dias do plano estão na sua Agenda.`);
    };
    window.addEventListener("mine:salvar-flashcards", onFlashcards);
    window.addEventListener("mine:plano-agenda", onPlano);
    return () => {
      window.removeEventListener("mine:salvar-flashcards", onFlashcards);
      window.removeEventListener("mine:plano-agenda", onPlano);
    };
  }, []);

  /**
   * O tempo de uma fase do Foco acabou com o aluno em outra tela (a ficha do
   * canto avisou). Mesmas consequências da aba Foco: sessão registrada (vale
   * XP), confete saindo da ficha e a Mine comemorando.
   */
  function handleFocusPhaseDone(finished: FocusState, result: { finishedFocus: boolean; isLong: boolean }, anchor: Element | null) {
    const current = user;
    if (!current) return;
    if (current.settings.focusVibrate !== false && "vibrate" in navigator) navigator.vibrate?.(450);
    if (!result.finishedFocus) {
      notify("A pausa acabou. Pronto para o próximo ciclo?");
      return;
    }
    if (finished.subjectId) {
      const subjectId = finished.subjectId;
      update((draft) => ({
        ...draft,
        sessions: [...draft.sessions, { id: uid("session"), userId: current.id, subjectId, title: `Sessão de foco (${finished.focusMin} min)`, kind: "Foco", createdAt: Date.now() }],
      }));
    }
    celebrateFrom(anchor, { count: 44, spread: 1.2 });
    floatXp(`+${xpPerAction.focus} XP`, anchor);
    mineSays(result.isLong ? "4 ciclos! Hora da pausa longa!" : "Sessão concluída! Respira um pouco.", "wow");
    notify(result.isLong ? "4 ciclos completos! Você merece uma pausa longa." : "Sessão de foco concluída! Hora da pausa.");
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
        <AnimatePresence>{showIntro ? <CadernoSplash key="splash" onSkip={() => setShowIntro(false)} brand={<BrandMark className="h-full w-full" />} /> : null}</AnimatePresence>
        <AppearanceControls appearance={appearance} onChange={changeAppearance} floating />
        <LoginScreen authenticate={authenticate} notify={notify} brand={<BrandMark className="h-full w-full" />} reduced={reducedMotion} />
        <Toast message={toast} />
      </MotionPreference>
    );
  }

  const displayName = user.settings.displayName || user.name;
  const hasAdminAccess = Boolean(user.isAdmin);
  const isAdminPanel = route.view === "admin" && hasAdminAccess;
  const isMinePanel = route.view === "mine" && !isAdminPanel;
  // Título da conversa pela IA, como nos chats grandes. Falhou, fica o
  // começo da pergunta — o título é enfeite, não pode atrapalhar a conversa.
  async function nameThread(firstMessageId: string, question: string, answer: string) {
    try {
      const raw = await requestAiTask({
        task: "title",
        prompt: `Pergunta: ${question.slice(0, 500)}\nComeço da resposta: ${stripImageMarkers(answer).slice(0, 500)}`,
      });
      const title = raw.split("\n")[0].replace(/^["'“”«»\s]+|["'“”«».\s]+$/g, "").replace(/\*\*/g, "").trim().slice(0, 60);
      if (title.length < 3) return;
      update((draft) => ({
        ...draft,
        chats: draft.chats.map((item) => (item.id === firstMessageId ? { ...item, threadTitle: title } : item)),
      }));
    } catch {
      // Sem título da IA: a lista usa o começo da pergunta.
    }
  }
  const currentSubject = route.view === "subject" ? userData.subjects.find((item) => item.id === route.id) : undefined;
  const content = (() => {
    if (route.view === "subject" && currentSubject) {
      return <React.Suspense fallback={<PageLoading />}><SubjectView subject={currentSubject} data={userData} setModal={setModal} update={update} notify={notify} setSelectedSubjectId={setSelectedSubjectId} askMineInChat={askMineInChat} /></React.Suspense>;
    }
    if (route.view === "agenda") return <React.Suspense fallback={<PageLoading />}><AgendaView data={userData} user={user} setModal={setModal} update={update} notify={notify} /></React.Suspense>;
    if (route.view === "foco") return <FocusView data={userData} user={user} update={update} notify={notify} />;
    if (route.view === "progress") return <ProgressView data={userData} user={user} />;
    if (route.view === "ranking") return <React.Suspense fallback={<PageLoading />}><RankingView user={user} update={update} notify={notify} /></React.Suspense>;
    if (route.view === "mine") {
      return (
        <MineView
          userId={user.id}
          pendingPrompt={pendingMinePrompt}
          consumePendingPrompt={() => setPendingMinePrompt(null)}
          data={userData}
          input={mineInput}
          setInput={setMineInput}
          selectedSubjectId={selectedSubjectId}
          setSelectedSubjectId={setSelectedSubjectId}
          loading={mineLoading}
          suggestions={mineSuggestions}
          streamText={mineStreamText}
          searchStatus={mineStatus}
          reasoning={mineReasoning}
          artifactLoading={mineArtifactLoading}
          stop={() => mineAbortRef.current?.abort()}
          photos={minePhotos}
          setPhotos={setMinePhotos}
          webSearch={mineWebSearch}
          setWebSearch={setMineWebSearch}
          webSearchAvailable={mineWebAvailable}
          tutor={mineTutor}
          setTutor={setMineTutor}
          profundo={mineProfundo}
          setProfundo={setMineProfundo}
          esforco={mineEsforco}
          setEsforco={setMineEsforco}
          controle={mineControle}
          setControle={setMineControle}
          controleLive={mineControleLive}
          deepLive={mineDeepLive}
          liveVisits={mineVisits}
          threadId={mineThreadId}
          setThreadId={(threadId) => {
            setMineThreadId(threadId);
            setMineSuggestions([]);
          }}
          newThread={() => {
            setMineThreadId(uid("thread"));
            setMineSuggestions([]);
          }}
          branchFrom={(message) => {
            // Ramificar (25/nov/2026): copia a conversa até esta resposta para
            // uma conversa nova, e a original fica como estava.
            const ate = userData.chats.filter((item) => inThread(item, selectedSubjectId, mineThreadId) && item.createdAt <= message.createdAt);
            if (!ate.length) return;
            const novoId = uid("thread");
            const titulo = ate.find((item) => item.threadTitle)?.threadTitle || ate[0].text.slice(0, 40);
            const copias = ate.map((item, index) => ({
              ...item,
              id: uid("chat"),
              threadId: novoId,
              branches: undefined,
              threadTitle: index === 0 ? `${titulo} (ramo)` : undefined,
              createdAt: Date.now() - (ate.length - index) * 10,
            }));
            update((draft) => ({ ...draft, chats: [...draft.chats, ...copias] }));
            setMineThreadId(novoId);
            setMineSuggestions([]);
            notify("Conversa nova criada a partir desta resposta. A original continua na lista.");
          }}
          deleteThread={(threadId) => {
            const remaining = userData.chats.filter((item) => !inThread(item, selectedSubjectId, threadId));
            update((draft) => ({
              ...draft,
              chats: draft.chats.filter((item) => item.userId !== user.id || !inThread(item, selectedSubjectId, threadId)),
            }));
            if ((threadId || undefined) === (mineThreadId || undefined)) {
              setMineThreadId(threadsOf(remaining, selectedSubjectId)[0]?.id ?? uid("thread"));
            }
            setMineSuggestions([]);
          }}
          setFeedback={(message, value) => {
            update((draft) => ({
              ...draft,
              chats: draft.chats.map((item) => (item.id === message.id ? { ...item, feedback: item.feedback === value ? undefined : value } : item)),
            }));
          }}
          showVersion={(message, target) => {
            if (mineLoading) return;
            update((draft) => ({ ...draft, chats: switchBranch(draft.chats, message.id, target) }));
            setMineSuggestions([]);
          }}
          openMaterial={(materialId) => setModal({ type: "materialView", materialId })}
          addMaterial={(subjectId) => setModal({ type: "material", subjectId })}
          openThread={(subjectId, threadId) => {
            if (mineLoading) return;
            setMineSuggestions([]);
            if ((subjectId || undefined) === (selectedSubjectId || undefined)) {
              setMineThreadId(threadId);
              return;
            }
            // Outra matéria: o efeito que troca de matéria lê a conversa guardada aqui.
            try {
              sessionStorage.setItem(mineOpenStorageKey, JSON.stringify({ userId: user.id, subjectId, threadId }));
            } catch {}
            setSelectedSubjectId(subjectId);
          }}
          togglePin={(subjectId, threadId) => {
            update((draft) => ({ ...draft, chats: togglePinned(draft.chats, subjectId, threadId) }));
          }}
          openMindmap={(message) => {
            if (!message.mindmap) return;
            setModal({
              type: "mindmap",
              subjectId: message.subjectId,
              topic: message.subjectId ? undefined : message.mindmap.title,
              initialMap: message.mindmap,
            });
          }}
          openQuiz={(message) => {
            if (!message.quiz) return;
            setModal({
              type: "quiz",
              subjectId: message.quiz.subjectId,
              topic: message.quiz.subjectId ? undefined : message.quiz.title,
              initialQuestions: message.quiz.questions,
              initialMode: message.quiz.mode,
            });
          }}
          openDeck={(message) => {
            if (!message.deck) return;
            setModal({ type: "flashcards", subjectId: message.deck.subjectId });
          }}
          createQuiz={async (message, escolha) => {
            const setup = message.quizSetup;
            if (!setup || setup.respondidoEm || mineLoading) return;

            // O cartão trava assim que a escolha sai: sem isso dois toques
            // gerariam duas provas e a conversa ficaria com dois cartões vivos.
            update((draft) => ({
              ...draft,
              chats: draft.chats.map((item) =>
                item.id === message.id && item.quizSetup ? { ...item, quizSetup: { ...item.quizSetup, respondidoEm: escolha } } : item,
              ),
            }));

            const subject = setup.subjectId ? userData.subjects.find((item) => item.id === setup.subjectId) : undefined;
            const titulo = subject?.name || setup.topic;
            setMineLoading(true);
            setMineArtifactLoading({ kind: "quiz", topic: titulo });
            const controller = new AbortController();
            mineAbortRef.current = controller;
            try {
              const context = subject
                ? subjectContentContext(subject, userData.materials.filter((item) => item.subjectId === subject.id))
                : `Tema solicitado: ${setup.topic}. Use conhecimento geral confiável do ensino médio e superior brasileiro.`;
              const dificuldade = escolha.difficulty === "facil" ? "facil" : escolha.difficulty === "dificil" ? "dificil" : "media";
              const modo = escolha.mode === "treino" ? "priorize clareza pedagógica e explicações úteis" : "use enunciados variados e alternativas plausíveis";
              const text = await requestAiTask(
                {
                  task: "quiz",
                  prompt: `Gere ${escolha.count} questoes de multipla escolha sobre ${titulo}, com nivel de dificuldade ${dificuldade}; ${modo}. Distribua a letra correta entre A, B, C e D.`,
                  context,
                },
                { signal: controller.signal },
              );
              const questions = parseQuiz(text).slice(0, escolha.count);
              if (!questions.length) throw new Error("A prova voltou sem questões válidas.");
              update((draft) => ({
                ...draft,
                chats: [...draft.chats, {
                  id: uid("chat"),
                  userId: user.id,
                  subjectId: message.subjectId, threadId: message.threadId,
                  role: "mine",
                  text: `Sua prova de ${titulo} está pronta, com ${questions.length} ${questions.length === 1 ? "questão" : "questões"}. Toque para começar.`,
                  quiz: { title: titulo, subjectId: subject?.id, mode: escolha.mode, questions },
                  createdAt: Date.now() + 1,
                }],
              }));
            } catch (error) {
              const stopped = controller.signal.aborted;
              // A escolha volta a ficar disponível: travar o cartão e ainda
              // falhar deixaria a pessoa sem nenhum caminho para tentar de novo.
              update((draft) => ({
                ...draft,
                chats: [
                  ...draft.chats.map((item) =>
                    item.id === message.id && item.quizSetup ? { ...item, quizSetup: { ...item.quizSetup, respondidoEm: undefined } } : item,
                  ),
                  {
                    id: uid("chat"),
                    userId: user.id,
                    subjectId: message.subjectId, threadId: message.threadId,
                    role: "mine" as const,
                    text: stopped
                      ? "Geração da prova interrompida."
                      : (error as Error | null)?.message || "Não consegui montar a prova agora. Tente novamente.",
                    createdAt: Date.now() + 1,
                  },
                ],
              }));
            } finally {
              mineAbortRef.current = null;
              setMineArtifactLoading(null);
              setMineLoading(false);
            }
          }}
          goToPlan={() => go("plan")}
          goHome={() => go("home")}
          saveResponse={(text, subjectId) => {
            const subject = userData.subjects.find((item) => item.id === subjectId);
            if (!subject) return;
            const clean = text.replace(/\s+/g, " ").trim();
            const firstLine = text.split("\n").find((line) => line.trim())?.replace(/^[#>*\-\d.\s]+/, "").trim();
            const title = (firstLine || "Resposta da Mine").slice(0, 72);
            update((draft) => ({
              ...draft,
              materials: [
                ...draft.materials,
                {
                  id: uid("material"),
                  userId: user.id,
                  subjectId,
                  title,
                  type: "note",
                  detail: "Resposta salva da Mine",
                  content: clean,
                  folder: "Mine",
                  studied: false,
                  favorite: false,
                  createdAt: Date.now(),
                },
              ],
            }));
            notify(`Resposta salva em ${subject.name}.`);
          }}
          send={async (text, subjectId, attachments = [], options = {}) => {
            const trimmed = text.trim();
            if ((!trimmed && !attachments.length) || mineLoading) return;
            const prompt = trimmed || "Analise os arquivos anexados.";
            // Editar uma pergunta ou refazer uma resposta reescreve a conversa a
            // partir daquela mensagem: ela e tudo que veio depois saem, e a
            // pergunta é enviada de novo como se fosse a primeira vez.
            const replaceFrom = options.replaceFromId ? userData.chats.find((item) => item.id === options.replaceFromId) : undefined;
            const cutAt = replaceFrom?.createdAt;
            // Mapa, prova e baralho competem pela mesma frase, então a ordem
            // importa: "mapa mental" ganha de "questões", e prova ganha de
            // flashcards. Cada um resolve o tema com o mesmo caminho — daí a
            // extração e a inferência de matéria serem compartilhadas.
            // Material colado na mensagem ou anexado é a fonte do pedido: sem
            // tema explícito, a prova vira conversa com a Mine (que lê os dados)
            // em vez de perguntar "sobre o que você quer a prova?".
            const inlineMaterial = inlineMaterialFromPrompt(prompt);
            const hasOwnSource = Boolean(inlineMaterial || attachments.length);
            // "salva isso em História", "cria um duelo sobre isso": pedido para
            // FAZER algo no site. Sai na hora, sem IA (src/chat/acoes.ts).
            // Mapa mental ganha da ação, e anexo é conversa sobre o arquivo.
            // Arquivo ("cria um PDF com 10 questões") e resumo de prova vão para a
            // Mine, que escreve o bloco ```arquivo: vencem ação, mapa e prova.
            const fileRequest = Boolean(asksForFile(prompt)) || asksForStudySheet(prompt);
            const chatAction = !fileRequest && !attachments.length && !isMindMapRequest(prompt) ? chatActionFromPrompt(prompt) : null;
            const mindMapRequest = !fileRequest && !chatAction && isMindMapRequest(prompt);
            const quizRequest = !mindMapRequest
              && !fileRequest
              && !chatAction
              && isQuizRequest(prompt)
              && !wantsGuidedQuiz(prompt)
              && !(hasOwnSource && !quizTopicFromPrompt(prompt));
            const flashcardRequest = !fileRequest && !chatAction && !mindMapRequest && !isQuizRequest(prompt) && isFlashcardRequest(prompt);
            const artefatoTopic = mindMapRequest
              ? mindMapTopicFromPrompt(prompt)
              : quizRequest
                ? quizTopicFromPrompt(prompt)
                : flashcardRequest
                  ? flashcardTopicFromPrompt(prompt)
                  : "";
            const normalizedTopic = normalizeText(artefatoTopic);
            const inferredSubject = normalizedTopic
              ? userData.subjects.find((item) => {
                  const subjectName = normalizeText(item.name);
                  return normalizedTopic === subjectName || normalizedTopic.includes(subjectName) || subjectName.includes(normalizedTopic);
                })
              : undefined;
            const standaloneTopic = artefatoTopic && !inferredSubject ? artefatoTopic : "";
            const standaloneMindMapTopic = mindMapRequest ? standaloneTopic : "";
            const resolvedSubjectId = inferredSubject?.id || (standaloneTopic ? undefined : subjectId);
            // A conversa aberta vale para a matéria aberta. Quando o pedido
            // leva para outra matéria (mapa de "Física" estando em Química), a
            // resposta cai na conversa principal daquela.
            const threadForMessages = replaceFrom ? replaceFrom.threadId : resolvedSubjectId === subjectId ? mineThreadRef.current : undefined;
            // Memória: até 40 mensagens desta conversa. O servidor manda as 16
            // últimas inteiras e resume as mais antigas. Só papel e texto viajam
            // — anexos em base64 no histórico só engordavam o pedido.
            const threadMessages = userData.chats
              .filter((item) => inThread(item, resolvedSubjectId, threadForMessages) && (cutAt === undefined || item.createdAt < cutAt))
              .slice(-40);
            // Anexos de turnos anteriores: o histórico viaja só com texto, então
            // a ficha enviada antes sumia na pergunta seguinte ("Não há ficha
            // anexada"). Os mais recentes da conversa voltam junto do pedido,
            // sem repetir o que a pessoa acabou de anexar.
            const earlierAttachments = attachments.length >= maxChatAttachments
              ? []
              : threadMessages
                  .filter((item) => item.role === "user" && item.attachments?.length)
                  .reverse()
                  .flatMap((item) => item.attachments || [])
                  .filter((item, index, list) =>
                    (item.dataUrl || item.text)
                    && !attachments.some((own) => own.name === item.name && own.size === item.size)
                    && list.findIndex((other) => other.name === item.name && other.size === item.size) === index)
                  .slice(0, maxChatAttachments - attachments.length);
            const history = threadMessages
              // O marcador de foto vira a nota "(galeria de fotos: termo)": ver o
              // marcador cru convidava a Mine a ilustrar tudo, e apagá-lo a fazia
              // esquecer que já tinha mostrado fotos ("manda mais" não funcionava).
              .map((item, index, list) => {
                const nomes = item.role === "user" && item.attachments?.length
                  ? `\n\n(Anexos enviados nesta mensagem: ${item.attachments.map((anexo) => anexo.name).join(", ")})`
                  : "";
                const text = `${describeImageMarkers(item.text).slice(0, 6000)}${nomes}`;
                // As últimas respostas com pesquisa levam a lista do que foi
                // lido: sem isso "e o que diz a segunda fonte?" ficava sem chão,
                // porque o "[2]" do texto não aponta para nada no pedido novo.
                const recent = list.length - index <= 4;
                if (item.role !== "mine" || !item.sources?.length || !recent) return { role: item.role, text };
                const fontes = item.sources.slice(0, 8).map((source, n) => `[${n + 1}] ${source.title} — ${source.url}`).join("\n");
                return { role: item.role, text: `${text}\n\n(Fontes que você consultou nesta resposta:\n${fontes})` };
              });
            const userMessage: ChatMessage = { id: uid("chat"), userId: user.id, subjectId: resolvedSubjectId, threadId: threadForMessages, role: "user", text: prompt, attachments, createdAt: Date.now() };
            const subject = resolvedSubjectId ? userData.subjects.find((item) => item.id === resolvedSubjectId) : undefined;
            const savedMaterials = subject ? attachmentsToMaterials(attachments, userData.materials, user.id, subject.id) : [];
            update((draft) => {
              // Editar e refazer guardam a versão anterior: o trecho que sai da
              // conversa vira um "galho" na pergunta nova, e as setas ‹ 1/2 ›
              // trocam entre eles.
              const removed = cutAt === undefined ? [] : branchSlice(draft.chats, user.id, resolvedSubjectId, threadForMessages, cutAt);
              const branched: ChatMessage = removed.length
                ? {
                    ...userMessage,
                    branches: [...(removed[0].branches || []), [{ ...removed[0], branches: undefined }, ...removed.slice(1)]],
                    threadTitle: removed[0].threadTitle,
                  }
                : userMessage;
              const removedIds = new Set(removed.map((item) => item.id));
              return {
                ...draft,
                chats: [...draft.chats.filter((item) => !removedIds.has(item.id)), branched],
                materials: savedMaterials.length ? [...draft.materials, ...savedMaterials] : draft.materials,
              };
            });
            // O pedido foi para outra conversa (prova ou mapa de um tema fora da
            // matéria aberta): avisa, senão a mensagem parece ter sumido.
            if (!replaceFrom && resolvedSubjectId !== subjectId) {
              notify(`Seu pedido foi para a conversa ${subject ? `de ${subject.name}` : "Estudos gerais"}.`);
            }
            if (subject && savedMaterials.length) {
              notify(savedMaterials.length === 1 ? `Anexo salvo como conteúdo em ${subject.name}.` : `${savedMaterials.length} anexos salvos como conteúdo em ${subject.name}.`);
            }
            if (chatAction) {
              const plano = planejarAcao(chatAction, {
                userId: user.id,
                subjects: userData.subjects,
                materials: userData.materials,
                subjectId: resolvedSubjectId,
                conversa: threadMessages,
                uid,
              });
              update((draft) => {
                const comMensagem: AppData = {
                  ...draft,
                  chats: [...draft.chats, {
                    id: uid("chat"),
                    userId: user.id,
                    subjectId: resolvedSubjectId, threadId: threadForMessages,
                    role: "mine",
                    text: plano.texto,
                    action: plano.acao,
                    createdAt: Date.now() + 1,
                  }],
                };
                return plano.mudar ? plano.mudar(comMensagem) : comMensagem;
              });
              setMineSuggestions(plano.sugestoes || []);
              if (plano.abrir) {
                deixarPreset(plano.abrir.view, plano.abrir.preset);
                go(plano.abrir.view);
              }
              if (plano.baixarFotos) {
                const { nome, grupos } = plano.baixarFotos;
                void downloadPhotosZip(grupos, nome)
                  .then(({ saved, failed }) =>
                    notify(
                      saved
                        ? `Zip com ${saved} ${saved === 1 ? "foto" : "fotos"} baixado${failed ? ` (${failed} não ${failed === 1 ? "abriu" : "abriram"} no site de origem)` : ""}.`
                        : "Não consegui baixar as fotos agora. Tente o botão “Baixar todas (.zip)” da galeria.",
                    ),
                  )
                  .catch(() => notify("Não consegui montar o zip agora. Tente de novo em instantes."));
              }
              return;
            }
            if (mindMapRequest) {
              const mapTopic = subject?.name || standaloneMindMapTopic;
              if (!mapTopic) {
                update((draft) => ({
                  ...draft,
                  chats: [...draft.chats, {
                    id: uid("chat"),
                    userId: user.id,
                    subjectId: resolvedSubjectId, threadId: threadForMessages,
                    role: "mine",
                    text: "Para criar o mapa mental, preciso saber qual matéria ou tema devo usar. Diga, por exemplo: “crie um mapa mental de Física”.",
                    createdAt: Date.now() + 1,
                  }],
                }));
                setMineSuggestions(userData.subjects.slice(0, 4).map((item) => `Crie um mapa mental de ${item.name}`));
                return;
              }

              if (subject) setSelectedSubjectId(subject.id);
              else setSelectedSubjectId(undefined);
              setMineLoading(true);
              setMineArtifactLoading({ kind: "mindmap", topic: mapTopic });
              setMineStreamText("");
              mineStreamRef.current = "";
              const controller = new AbortController();
              mineAbortRef.current = controller;

              try {
                const mindmapMaterials = subject
                  ? [...userData.materials.filter((item) => item.subjectId === subject.id), ...savedMaterials]
                  : [];
                const context = subject
                  ? subjectContentContext(subject, mindmapMaterials)
                  : `Tema solicitado: ${mapTopic}. Use conhecimento geral confiável e organize os conceitos para estudo.`;
                const text = await requestAiTask(
                  { task: "mindmap", prompt: `Crie um mapa mental de estudos sobre ${mapTopic}.`, context },
                  { signal: controller.signal },
                );
                const parsed = parseMindmap(text);
                if (!parsed.branches.length) throw new Error("O mapa voltou sem ramos suficientes.");
                const readyMap: Mindmap = { ...parsed, title: parsed.title || mapTopic };
                update((draft) => ({
                  ...draft,
                  chats: [...draft.chats, {
                    id: uid("chat"),
                    userId: user.id,
                    subjectId: resolvedSubjectId, threadId: threadForMessages,
                    role: "mine",
                    text: `Seu mapa mental de ${mapTopic} está pronto. Toque na prévia para explorar todos os ramos.`,
                    mindmap: readyMap,
                    createdAt: Date.now() + 1,
                  }],
                  sessions: subject
                    ? [...draft.sessions, { id: uid("session"), userId: user.id, subjectId: subject.id, title: `Mapa mental de ${subject.name}`.slice(0, 48), kind: "Mine", createdAt: Date.now() }]
                    : draft.sessions,
                }));
                setMineSuggestions(subject
                  ? [`Crie questões de ${subject.name}`, `Resuma ${subject.name}`]
                  : [`Crie questões sobre ${mapTopic}`, `Resuma ${mapTopic}`]);
              } catch (error) {
                const stopped = controller.signal.aborted;
                update((draft) => ({
                  ...draft,
                  chats: [...draft.chats, {
                    id: uid("chat"),
                    userId: user.id,
                    subjectId: resolvedSubjectId, threadId: threadForMessages,
                    role: "mine",
                    text: stopped
                      ? "Geração do mapa mental interrompida."
                      : (error as Error | null)?.message || "Não consegui montar o mapa mental agora. Tente novamente.",
                    createdAt: Date.now() + 1,
                  }],
                }));
              } finally {
                mineAbortRef.current = null;
                setMineArtifactLoading(null);
                setMineLoading(false);
              }
              return;
            }

            if (quizRequest) {
              const quizTopic = subject?.name || standaloneTopic;
              if (!quizTopic) {
                update((draft) => ({
                  ...draft,
                  chats: [...draft.chats, {
                    id: uid("chat"),
                    userId: user.id,
                    subjectId: resolvedSubjectId, threadId: threadForMessages,
                    role: "mine",
                    text: "Sobre o que você quer a prova? Diga, por exemplo: “monte uma prova de Biologia”.",
                    createdAt: Date.now() + 1,
                  }],
                }));
                setMineSuggestions(userData.subjects.slice(0, 4).map((item) => `Monte uma prova de ${item.name}`));
                return;
              }
              if (subject) setSelectedSubjectId(subject.id);
              // Nenhuma chamada de IA aqui: primeiro a pessoa escolhe o formato
              // no cartão, e só o botão dispara a geração. Gerar antes seria
              // gastar uma prova que talvez fosse do tamanho errado.
              update((draft) => ({
                ...draft,
                chats: [...draft.chats, {
                  id: uid("chat"),
                  userId: user.id,
                  subjectId: resolvedSubjectId, threadId: threadForMessages,
                  role: "mine",
                  text: `Posso montar sua prova de ${quizTopic}. Escolha como você quer:`,
                  quizSetup: {
                    topic: quizTopic,
                    subjectId: subject?.id,
                    padrao: { count: countFromPrompt(prompt, 5, 15), difficulty: difficultyFromPrompt(prompt) },
                  },
                  createdAt: Date.now() + 1,
                }],
              }));
              return;
            }

            if (flashcardRequest) {
              const deckTopic = subject?.name || standaloneTopic;
              if (!deckTopic) {
                update((draft) => ({
                  ...draft,
                  chats: [...draft.chats, {
                    id: uid("chat"),
                    userId: user.id,
                    subjectId: resolvedSubjectId, threadId: threadForMessages,
                    role: "mine",
                    text: "De qual assunto? Diga, por exemplo: “crie flashcards de Biologia”.",
                    createdAt: Date.now() + 1,
                  }],
                }));
                setMineSuggestions(userData.subjects.slice(0, 4).map((item) => `Crie flashcards de ${item.name}`));
                return;
              }

              // Flashcard sem matéria não existe: a revisão espaçada guarda os
              // cartões por matéria. Quando o tema é novo, a matéria nasce aqui
              // — é o que permite pedir "flashcards de fotossíntese" sem ter
              // cadastrado nada antes.
              const materiaExistente = subject;
              const materiaNova: Subject | undefined = materiaExistente
                ? undefined
                : {
                    id: uid("subject"),
                    userId: user.id,
                    // Corta na palavra, não no meio dela ("Fotossíntese e respi").
                    name: deckTopic.length <= 40 ? deckTopic : deckTopic.slice(0, 41).replace(/\s+\S*$/, "").trim() || deckTopic.slice(0, 40),
                    color: "#38BDF8",
                    icon: "school",
                    favorite: false,
                    createdAt: Date.now(),
                  };
              const materiaDoBaralho = materiaExistente || materiaNova;
              if (!materiaDoBaralho) return;

              const quantidade = countFromPrompt(prompt, 8, 20);
              setMineLoading(true);
              setMineArtifactLoading({ kind: "deck", topic: deckTopic });
              const controller = new AbortController();
              mineAbortRef.current = controller;
              try {
                // Fonte indicada primeiro: a anotação citada pelo título, o texto
                // colado na mensagem ou o anexo. Sem isso o baralho saía da
                // matéria inteira, mesmo quando o pedido apontava uma anotação.
                const materiaisDaMateria = materiaExistente
                  ? [...userData.materials.filter((item) => item.subjectId === materiaExistente.id), ...savedMaterials]
                  : [];
                const promptNormalizado = normalizeText(prompt);
                const anotacaoCitada = materiaisDaMateria.filter((item) => {
                  const titulo = normalizeText(item.title);
                  return titulo.length >= 3 && promptNormalizado.includes(titulo);
                });
                const textoDosAnexos = attachments.map((item) => item.text?.trim()).filter(Boolean).join("\n\n");
                const fonteIndicada = [inlineMaterial, textoDosAnexos].filter(Boolean).join("\n\n").slice(0, 12_000);
                const context = fonteIndicada
                  ? `${materiaExistente ? `Materia: ${materiaExistente.name}.\n` : ""}Fonte indicada pelo estudante (use SOMENTE este conteúdo):\n${fonteIndicada}`
                  : materiaExistente
                    ? subjectContentContext(materiaExistente, anotacaoCitada.length ? anotacaoCitada : materiaisDaMateria)
                    : `Tema solicitado: ${deckTopic}. Use conhecimento geral confiável e priorize o que vale memorizar.`;
                const sobre = anotacaoCitada.length === 1 ? `a anotação "${anotacaoCitada[0].title}"` : fonteIndicada ? "o conteúdo indicado" : deckTopic;
                const text = await requestAiTask(
                  { task: "flashcards", prompt: `Crie ${quantidade} flashcards de estudo sobre ${sobre}.`, context },
                  { signal: controller.signal },
                );
                const parsed = parseFlashcards(text).slice(0, quantidade);
                if (!parsed.length) throw new Error("O baralho voltou sem cartões válidos.");
                const agora = Date.now();
                const novos: Flashcard[] = parsed.map((card, index) => ({
                  id: uid("card"),
                  userId: user.id,
                  subjectId: materiaDoBaralho.id,
                  front: card.front,
                  back: card.back,
                  level: 0,
                  reps: 0,
                  lapses: 0,
                  // Todos vencem agora: um baralho recém-criado existe para ser
                  // estudado hoje, não daqui a um dia.
                  dueAt: agora,
                  createdAt: agora + index,
                }));
                update((draft) => ({
                  ...draft,
                  subjects: materiaNova ? [...draft.subjects, materiaNova] : draft.subjects,
                  flashcards: [...draft.flashcards, ...novos],
                  chats: [...draft.chats, {
                    id: uid("chat"),
                    userId: user.id,
                    subjectId: resolvedSubjectId, threadId: threadForMessages,
                    role: "mine",
                    text: materiaNova
                      ? `Criei ${novos.length} flashcards e uma matéria "${materiaNova.name}" para guardá-los. Eles já entraram na sua revisão espaçada.`
                      : `Criei ${novos.length} flashcards em ${materiaDoBaralho.name}. Eles já entraram na sua revisão espaçada.`,
                    deck: { title: materiaDoBaralho.name, subjectId: materiaDoBaralho.id, total: novos.length, subjectCriada: Boolean(materiaNova) },
                    createdAt: Date.now() + 1,
                  }],
                }));
                setMineSuggestions([`Monte uma prova de ${materiaDoBaralho.name}`, `Crie um mapa mental de ${materiaDoBaralho.name}`]);
              } catch (error) {
                const stopped = controller.signal.aborted;
                update((draft) => ({
                  ...draft,
                  chats: [...draft.chats, {
                    id: uid("chat"),
                    userId: user.id,
                    subjectId: resolvedSubjectId, threadId: threadForMessages,
                    role: "mine",
                    text: stopped
                      ? "Geração dos flashcards interrompida."
                      : (error as Error | null)?.message || "Não consegui criar os flashcards agora. Tente novamente.",
                    createdAt: Date.now() + 1,
                  }],
                }));
              } finally {
                mineAbortRef.current = null;
                setMineArtifactLoading(null);
                setMineLoading(false);
              }
              return;
            }

            setMineLoading(true);
            setMineStreamText("");
            setMineStatus(null);
            setMineReasoning("");
            setMineVisits([]);
            setMineControleLive(mineControle);
            const deepRequest = Boolean(mineWebAvailable && mineProfundo && !mineControle);
            setMineDeepLive(deepRequest);
            mineStreamRef.current = "";
            const controller = new AbortController();
            mineAbortRef.current = controller;
            const startedAt = Date.now();
            try {
              const subjectImages = resolvedSubjectId ? materialsToImageAttachments(userData.materials.filter((item) => item.subjectId === resolvedSubjectId)) : [];
              // A pesquisa aprofundada vale só para esta pergunta.
              if (mineProfundo) setMineProfundo(false);
              const assistant = await streamAssistantResponse(
                {
                  prompt,
                  // Aula por voz (25/nov/2026): pedido enxuto. Com o histórico
                  // inteiro, o retrato do aluno e as imagens da matéria, a
                  // primeira palavra saía em ~6 s; sem eles, em ~2,5 s. As
                  // ferramentas que usam o retrato ficam desligadas na chamada.
                  history: options.voz ? history.slice(-10).map((item) => ({ ...item, text: item.text.slice(0, 1200) })) : history,
                  webSearch: mineWebAvailable && mineWebSearch,
                  photos: minePhotos,
                  tutor: mineTutor,
                  profundo: deepRequest || undefined,
                  caprichar: mineCaprichar || undefined,
                  esforco: mineEsforco !== "normal" ? mineEsforco : undefined,
                  voz: options.voz || undefined,
                  controle: mineControle || undefined,
                  aluno: options.voz ? undefined : buildAlunoSnapshot(userData, user.id),
                  attachments: (options.voz ? attachments : [...attachments, ...earlierAttachments, ...subjectImages]).slice(0, maxChatAttachments),
                  context: [
                    buildAssistantContext(userData, user, resolvedSubjectId),
                    earlierAttachments.length
                      ? `Anexos que o estudante enviou em mensagens anteriores desta conversa e que continuam disponíveis (vão junto deste pedido): ${earlierAttachments.map((item) => item.name).join(", ")}. Consulte-os quando a pergunta se referir a eles; não diga que não há anexo.`
                      : "",
                  ].filter(Boolean).join("\n\n"),
                },
                {
                  signal: controller.signal,
                  onDelta: (text) => {
                    mineStreamRef.current = text;
                    setMineStreamText(text);
                  },
                  onStatus: setMineStatus,
                  onReasoning: setMineReasoning,
                  onVisit: (visit) =>
                    setMineVisits((list) => {
                      const at = list.findIndex((item) => item.url === visit.url);
                      return at < 0 ? [...list, visit].slice(0, 8) : list.map((item, index) => (index === at ? visit : item));
                    }),
                },
              );
              setMineSuggestions(assistant.suggestions || []);
              // Aviso discreto, por exemplo quando a busca na web falhou.
              if (assistant.notice) notify(assistant.notice);
              let feedback: string[] = [];
              let routeAction: { view: View; id?: string; query?: string } | null = null;
              update((draft) => {
                const assistantMessage: ChatMessage = {
                  id: uid("chat"),
                  userId: user.id,
                  subjectId: resolvedSubjectId, threadId: threadForMessages,
                  role: "mine",
                  text: assistant.reply || buildMineAnswer(prompt, resolvedSubjectId, userData, user),
                  sources: assistant.sources?.length ? assistant.sources : undefined,
                  queries: assistant.queries?.length ? assistant.queries : undefined,
                  reasoning: assistant.reasoning ? assistant.reasoning.slice(0, 20_000) : undefined,
                  thoughtSeconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
                  suggestions: assistant.suggestions?.length ? assistant.suggestions : undefined,
                  visits: assistant.visits?.length ? assistant.visits : undefined,
                  tutor: mineTutor || undefined,
                  createdAt: Date.now() + 1,
                };
                const withMessage: AppData = {
                  ...draft,
                  chats: [...draft.chats, assistantMessage],
                  sessions: resolvedSubjectId
                    ? [...draft.sessions, { id: uid("session"), userId: user.id, subjectId: resolvedSubjectId, title: prompt.slice(0, 48), kind: "Mine", createdAt: Date.now() }]
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
              // Primeira resposta da conversa: a IA dá o título da barra lateral.
              if (!history.length && assistant.reply) {
                void nameThread(userMessage.id, prompt, assistant.reply);
              }
            } catch (error) {
              setMineSuggestions([]);
              const partial = mineStreamRef.current.trim();
              // Parou no meio: o que já apareceu na tela continua valendo.
              const stopped = controller.signal.aborted;
              const code = (error as { code?: string } | null)?.code;
              // Bloco (```linha-do-tempo, ```quiz…) cortado no meio não tem
              // como ser desenhado: sai inteiro, e o aviso fica fora dele.
              const inteiro = semBlocoAberto(partial);
              const text = stopped
                ? inteiro || "Geração interrompida."
                : inteiro
                  ? `${inteiro}\n\n_(A resposta foi interrompida por um problema. Tente perguntar de novo.)_`
                  : code === "rate_limit"
                    ? "Recebi muitas perguntas agora e atingi o limite por alguns instantes. Espere um pouquinho e tente de novo."
                    : (error as Error | null)?.message || "Tive um problema para responder agora. Tente novamente em alguns instantes.";
              update((draft) => ({
                ...draft,
                chats: [...draft.chats, { id: uid("chat"), userId: user.id, subjectId: resolvedSubjectId, threadId: threadForMessages, role: "mine", text, incompleta: inteiro ? true : undefined, createdAt: Date.now() + 1 }],
              }));
            } finally {
              mineAbortRef.current = null;
              mineStreamRef.current = "";
              setMineStreamText("");
              setMineStatus(null);
              setMineReasoning("");
              setMineDeepLive(false);
              setMineLoading(false);
            }
          }}
        />
      );
    }
    if (route.view === "games") return <React.Suspense fallback={<PageLoading />}><GamesView data={userData} user={user} update={update} tabInicial={route.id} /></React.Suspense>;
    if (route.view === "atelie") return <React.Suspense fallback={<PageLoading />}><AtelieView data={userData} user={user} update={update} /></React.Suspense>;
    if (route.view === "redacao") return <React.Suspense fallback={<PageLoading />}><RedacaoView data={userData} user={user} update={update} /></React.Suspense>;
    if (route.view === "atividades") return <React.Suspense fallback={<PageLoading />}><AtividadesView data={userData} user={user} update={update} /></React.Suspense>;
    if (route.view === "leitura") return <React.Suspense fallback={<PageLoading />}><LeituraView data={userData} user={user} update={update} /></React.Suspense>;
    if (route.view === "laboratorio") return <React.Suspense fallback={<PageLoading />}><LaboratorioView data={userData} user={user} update={update} /></React.Suspense>;
    if (route.view === "sala") return <React.Suspense fallback={<PageLoading />}><SalaView user={user} codigoRota={route.id} /></React.Suspense>;
    if (route.view === "cubo") return <React.Suspense fallback={<PageLoading />}><CuboView user={user} /></React.Suspense>;
    if (route.view === "ferramentas") return <React.Suspense fallback={<PageLoading />}><FerramentasView userId={user.id} aba={route.id} askMine={(text) => askMineInChat(text)} /></React.Suspense>;
    if (route.view === "duelo") return <React.Suspense fallback={<PageLoading />}><DueloView data={userData} user={user} update={update} /></React.Suspense>;
    if (route.view === "provas") return <React.Suspense fallback={<PageLoading />}><ProvasView data={userData} user={user} update={update} /></React.Suspense>;
    if (route.view === "videos") return <React.Suspense fallback={<PageLoading />}><VideosView data={userData} user={user} update={update} notify={notify} /></React.Suspense>;
    if (route.view === "idiomas") return <React.Suspense fallback={<PageLoading />}><IdiomasView data={userData} user={user} update={update} /></React.Suspense>;
    if (route.view === "search") return <SearchView data={userData} user={user} query={query} setQuery={setQuery} update={update} notify={notify} />;
    if (route.view === "plan") return <PlanView data={userData} update={update} user={user} notify={notify} />;
    if (route.view === "comments") return <CommentsView data={userData} user={user} update={update} notify={notify} setModal={setModal} />;
    if (route.view === "suggestions") return <SuggestionsView data={userData} user={user} update={update} notify={notify} setModal={setModal} />;
    if (route.view === "about") return <AboutView />;
    if (route.view === "como-usar") return <React.Suspense fallback={<PageLoading />}><ComoUsarView /></React.Suspense>;
    if (route.view === "perfil") return <React.Suspense fallback={<PageLoading />}><ProfileView user={user} data={userData} update={update} notify={notify} logout={logout} targetId={route.id} /></React.Suspense>;
    if (route.view === "admin") return hasAdminAccess ? <React.Suspense fallback={<AdminSkeleton />}><AdminView data={data} syncStatus={syncStatus} databaseMode={databaseMode} section={route.id} currentUserId={user.id} onDeleteUser={requestDeleteUser} onDeleteComment={requestDeleteComment} update={update} notify={notify} setModal={setModal} themeMode={appearance.themeMode} onToggleTheme={() => changeAppearance({ themeMode: appearance.themeMode === "dark" ? "light" : "dark" })} /></React.Suspense> : <AdminRestrictedView />;
    return <HomeView data={userData} userId={user.id} provasConta={user.settings.provas} displayName={displayName} accentColor={appearance.accentColor} themeMode={appearance.themeMode} setModal={setModal} update={update} openCommand={() => setCommandOpen(true)} openMine={(subjectId) => { setSelectedSubjectId(subjectId); go("mine"); }} />;
  })();

  return (
    <MotionPreference reduced={reducedMotion}>
      <AnimatePresence>{showIntro ? <CadernoSplash key="splash" name={displayName} onSkip={() => setShowIntro(false)} brand={<BrandMark className="h-full w-full" />} /> : null}</AnimatePresence>
      {!showIntro && !isAdminPanel && (tourOpen || !user.settings.tourDone) ? (
        <MineTour name={displayName.split(" ")[0]} steps={tourSteps} onDone={finishTour} />
      ) : null}
      <NovaMateriaFx />
      {levelCard !== null && rewards ? (
        <ConquistaCard
          info={{
            name: displayName,
            avatar: user.settings.avatar,
            level: levelCard,
            title: rewards.title,
            xp: rewards.xp,
            streak: rewards.stats.streakDays,
            achievements: rewards.unlocked.length,
          }}
          onClose={() => setLevelCard(null)}
        />
      ) : null}
      {!isAdminPanel ? <ScrollProgressBar /> : null}
      <div
        className={`relative z-10 min-h-screen ${isAdminPanel ? "admin-light caderno-admin" : "study-studio workspace-shell overflow-x-clip"}`}
        style={{ "--shell-nav": navHidden || isMinePanel ? "0rem" : "16.5rem" } as React.CSSProperties}
      >
        {!isAdminPanel ? (
          <>
          {!isMinePanel ? (
            <>
              <WorkspaceSidebar
                route={route.view}
                displayName={displayName}
                isAdmin={hasAdminAccess}
                level={rewards?.level || 1}
                progress={rewards ? percent(rewards.levelXp, rewards.levelNeed) : 0}
                avatar={user.settings.avatar}
                hidden={navHidden}
                onHide={() => setNavHidden(true)}
                subjects={userData.subjects}
                currentSubjectId={route.view === "subject" ? route.id : undefined}
                onNewSubject={() => setModal({ type: "subject" })}
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
                onOpenCommand={() => setCommandOpen(true)}
              />
            </>
          ) : null}
          </>
        ) : null}
        <main
          className={
            isAdminPanel
              ? // relative z-[1] mantém o conteúdo do admin acima do AdminBackdrop
                "relative z-[1] min-w-0"
              : isMinePanel
                ? "workspace-canvas relative z-10 h-dvh min-w-0 overflow-hidden"
                : "shell-shift workspace-canvas relative z-10 min-w-0 px-4 pb-safe-nav pt-[6.25rem] md:px-7 lg:px-9 lg:pb-16 lg:pt-[6.9rem]"
          }
        >
          {!isAdminPanel && !isMinePanel ? (
            <>
              <MarginDoodles route={route.view} />
              {pageCurl ? <PageCurl routeKey={`${route.view}-${route.id || ""}`} /> : <PageTurnShade routeKey={`${route.view}-${route.id || ""}`} />}
            </>
          ) : null}
          <AnimatePresence mode="wait" key={presenceEpoch}>
            <motion.div
              key={currentPageKey}
              data-page-layer={`${route.view}-${route.id || ""}`}
              data-page-key={currentPageKey}
              className={isAdminPanel ? "min-h-screen" : isMinePanel ? "h-full w-full" : "mx-auto w-full max-w-[1380px]"}
              variants={isAdminPanel ? pageVariants : reducedMotion || isMinePanel ? pageFadeVariants : pageCurl ? pageCurlVariants : pageFlipVariants}
              // Parada, a página não pode ficar com transform: qualquer um (até
              // perspective sozinho) prende os elementos `fixed` das telas.
              onAnimationComplete={(definition) => {
                if (definition === "animate" && pageLayerRef.current) pageLayerRef.current.style.transform = "";
              }}
              ref={pageLayerRef}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {content}
            </motion.div>
          </AnimatePresence>
        </main>
        {!isAdminPanel && !isMinePanel ? <MineBuddy
            route={route.view}
            onOpen={() => go("mine")}
            onOpenWith={(texto) => {
              setSelectedSubjectId(undefined);
              setMineInput(texto);
              go("mine");
            }}
          /> : null}
        {/* Mine andando pelas abas: fora do chat e do admin, e nunca com movimento reduzido ou modo leve. */}
        {!isAdminPanel && !isMinePanel && !lowFx && user.settings.pets !== "off" ? (
          <React.Suspense fallback={null}>
            <Pets />
          </React.Suspense>
        ) : null}
        {!isAdminPanel ? <FocusWidget userId={user.id} route={route.view} subjects={userData.subjects} onPhaseDone={handleFocusPhaseDone} /> : null}
        {!isAdminPanel && !isMinePanel ? <MobileNav route={route.view} isAdmin={hasAdminAccess} displayName={displayName} avatar={user.settings.avatar} level={rewards?.level || 1} /> : null}
      </div>
      <ModalHost modal={modal} setModal={setModal} user={user} data={userData} update={update} notify={notify} />
      <AnimatePresence>
        {commandOpen ? (
          <CommandPalette
            data={userData}
            query={query}
            setQuery={setQuery}
            setMineInput={setMineInput}
            setSelectedSubjectId={setSelectedSubjectId}
            setModal={setModal}
            close={() => setCommandOpen(false)}
          />
        ) : null}
      </AnimatePresence>
      <Toast message={toast} />
    </MotionPreference>
  );
}

export function Input({
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

/**
 * Quais áreas do menu estão abertas. Ao trocar de tela, fica aberta só a área
 * dela (as outras fecham), para o menu nunca virar a lista comprida de antes;
 * o aluno ainda pode abrir outras à mão para espiar.
 */
function useOpenAreas(route: View) {
  const [openAreas, setOpenAreas] = useState<NavArea[]>(() => {
    const current = areaOf(route);
    return current ? [current] : [];
  });

  useEffect(() => {
    const current = areaOf(route);
    setOpenAreas(current ? [current] : []);
  }, [route]);

  const toggleArea = useCallback((id: NavArea) => {
    setOpenAreas((areas) => (areas.includes(id) ? areas.filter((area) => area !== id) : [...areas, id]));
  }, []);

  return { openAreas, toggleArea };
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
  subjects,
  currentSubjectId,
  onNewSubject,
}: {
  route: View;
  displayName: string;
  avatar?: string;
  isAdmin: boolean;
  level: number;
  progress: number;
  hidden: boolean;
  onHide: () => void;
  subjects: Subject[];
  currentSubjectId?: string;
  onNewSubject: () => void;
}) {
  const { openAreas, toggleArea } = useOpenAreas(route);
  const materiasOpen = openAreas.includes("materias");

  return (
    <aside
      className="shell-nav studio-sidebar caderno-cover fixed inset-y-0 left-0 z-50 hidden w-[16.5rem] flex-col overflow-hidden lg:flex"
      data-hidden={hidden ? "true" : "false"}
    >
      <div className="relative flex h-[5rem] shrink-0 items-center gap-2 border-b border-white/[0.08] pl-5 pr-3">
        <button onClick={() => go("home")} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Ir para o início">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[.8rem] border border-mint/25 bg-mint/10 p-1">
            <BrandMark className="h-full w-full" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-lg font-black leading-none tracking-[-.03em]">Minerva</span>
            <span className="caderno-hand mt-0.5 block text-[15px] leading-none">meu caderno</span>
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

      {/* Divisórias do caderno: cada grupo tem a cor de uma aba de fichário,
          e a aba aberta avança até encostar na folha. */}
      <nav aria-label="Todas as áreas" className="caderno-tabs minerva-scroll relative min-h-0 flex-1 overflow-y-auto py-4 pl-3">
        <button
          onClick={() => go("home")}
          aria-current={route === "home" ? "page" : undefined}
          data-tone="capa"
          data-tour="home"
          className="caderno-tab relative mb-3 flex min-h-10 w-full items-center gap-3 text-left text-[13px] font-bold"
        >
          <Home className="relative h-4 w-4 shrink-0" />
          <span className="relative min-w-0 flex-1 truncate">Início</span>
        </button>
        {/* Nov/2026: as matérias ganharam a primeira divisória do menu; antes
            só dava para chegar nelas pela estante da Home. */}
        <section className="caderno-area mb-1.5" data-area="materias" data-open={materiasOpen ? "true" : "false"}>
          <button
            type="button"
            onClick={() => toggleArea("materias")}
            aria-expanded={materiasOpen}
            aria-controls="area-materias"
            className="caderno-area-head flex w-[calc(100%-0.9rem)] items-center gap-2.5 text-left"
          >
            <span className="caderno-area-dot grid h-7 w-7 shrink-0 place-items-center rounded-[.55rem]">
              <Library className="h-[15px] w-[15px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-black leading-tight">Matérias</span>
              {!materiasOpen ? (
                <span className="block truncate text-[10.5px] font-bold leading-tight opacity-55">
                  {subjects.length ? subjects.map((subject) => subject.name).join(", ") : "Crie seu primeiro caderno"}
                </span>
              ) : null}
            </span>
            {route === "subject" && !materiasOpen ? <span className="caderno-area-here h-2 w-2 shrink-0 rounded-full" aria-label="Você está aqui" /> : null}
            <ChevronRight className="caderno-area-chevron h-4 w-4 shrink-0 opacity-50" />
          </button>
          <div id="area-materias" className="caderno-area-body" hidden={!materiasOpen}>
            <div className="grid gap-[3px] pb-2 pt-1.5">
              {subjects.map((subject) => {
                const Icon = iconMap[subject.icon] || BookOpen;
                const active = route === "subject" && currentSubjectId === subject.id;
                return (
                  <button
                    key={subject.id}
                    onClick={() => go("subject", subject.id)}
                    aria-current={active ? "page" : undefined}
                    data-tone="materias"
                    className="caderno-tab group relative flex min-h-10 w-full items-center gap-3 text-left text-[13px] font-bold"
                  >
                    <span className="relative grid h-5 w-5 shrink-0 place-items-center rounded-full text-[#11151e]" style={{ background: subject.color }}>
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="relative min-w-0 flex-1 truncate">{subject.name}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={onNewSubject}
                data-tone="materias"
                className="caderno-tab relative flex min-h-10 w-full items-center gap-3 text-left text-[13px] font-bold opacity-70 hover:opacity-100"
              >
                <Plus className="relative h-4 w-4 shrink-0" />
                <span className="relative min-w-0 flex-1 truncate">Nova matéria</span>
              </button>
            </div>
          </div>
        </section>
        {navGroups.map((group) => {
          const items = group.views
            .filter((view) => !hiddenFromMenu.includes(view))
            .map(navItemOf)
            .filter((item): item is { view: View; label: string; icon: LucideIcon } => Boolean(item));
          const isOpen = openAreas.includes(group.id);
          const hasActive = group.views.includes(route);
          const GroupIcon = group.icon;
          return (
            <section key={group.id} className="caderno-area mb-1.5 last:mb-0" data-area={group.id} data-open={isOpen ? "true" : "false"}>
              <button
                type="button"
                onClick={() => toggleArea(group.id)}
                aria-expanded={isOpen}
                aria-controls={`area-${group.id}`}
                className="caderno-area-head flex w-[calc(100%-0.9rem)] items-center gap-2.5 text-left"
              >
                <span className="caderno-area-dot grid h-7 w-7 shrink-0 place-items-center rounded-[.55rem]">
                  <GroupIcon className="h-[15px] w-[15px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-black leading-tight">{group.label}</span>
                  {!isOpen ? <span className="block truncate text-[10.5px] font-bold leading-tight opacity-55">{group.hint}</span> : null}
                </span>
                {hasActive && !isOpen ? <span className="caderno-area-here h-2 w-2 shrink-0 rounded-full" aria-label="Você está aqui" /> : null}
                <ChevronRight className="caderno-area-chevron h-4 w-4 shrink-0 opacity-50" />
              </button>
              <div id={`area-${group.id}`} className="caderno-area-body" hidden={!isOpen}>
                <div className="grid gap-[3px] pb-2 pt-1.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = route === item.view;
                    return (
                      <button
                        key={item.view}
                        onClick={() => go(item.view)}
                        aria-current={active ? "page" : undefined}
                        data-tone={group.id}
                        data-tour={item.view}
                        className="caderno-tab group relative flex min-h-10 w-full items-center gap-3 text-left text-[13px] font-bold"
                      >
                        <Icon className="relative h-4 w-4 shrink-0" />
                        <span className="relative min-w-0 flex-1 truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </nav>

      <div className="caderno-account mx-3 flex shrink-0 items-center gap-1 border-t border-white/10 pt-2" aria-label="Conta">
        {accountViews
          .filter((view) => view !== "admin" || isAdmin)
          .map((view) => {
            const item = navItemOf(view);
            if (!item) return null;
            const Icon = item.icon;
            return (
              <button
                key={view}
                onClick={() => go(view)}
                aria-current={route === view ? "page" : undefined}
                aria-label={item.label}
                title={item.label}
                data-tour={view}
                className="caderno-account-btn grid h-9 flex-1 place-items-center rounded-[.6rem] text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
      </div>

      <button onClick={() => go("progress")} className="relative m-3 mt-1 flex min-h-[3.5rem] shrink-0 items-center gap-3 px-2 text-left transition hover:text-mint">
        <span className="relative grid h-10 w-10 shrink-0 place-items-center">
          <svg className="absolute inset-0 h-10 w-10 -rotate-90" viewBox="0 0 40 40" aria-hidden>
            <circle cx="20" cy="20" r="18" fill="none" stroke="rgb(var(--line))" strokeWidth="2" />
            <circle cx="20" cy="20" r="18" fill="none" stroke="rgb(var(--pen))" strokeWidth="2" strokeLinecap="round" strokeDasharray={`${(Math.max(0, Math.min(100, progress)) / 100) * 113.1} 113.1`} />
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
  onOpenCommand,
}: {
  route: View;
  displayName: string;
  avatar?: string;
  level: number;
  appearance: AppearanceChoice;
  onAppearanceChange: (patch: Partial<AppearanceChoice>) => void;
  navHidden: boolean;
  onShowNav: () => void;
  onOpenCommand: () => void;
}) {
  const current = route === "subject" ? { label: "Matéria", icon: BookOpen } : navItemOf(route);
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
          <button
            type="button"
            onClick={onOpenCommand}
            aria-label="Abrir busca rápida"
            title="Busca rápida (Ctrl + K)"
            className="group flex min-h-11 items-center gap-2 rounded-[.8rem] border border-white/10 bg-[#171c1a] px-3 text-white/58 transition hover:border-mint/35 hover:text-white"
          >
            <Search className="h-4 w-4 text-mint" />
            <span className="hidden text-[11px] font-black md:inline">Buscar</span>
            <kbd className="hidden rounded-md border border-white/10 bg-black/25 px-1.5 py-0.5 font-sans text-[9px] font-black text-white/35 xl:inline">Ctrl K</kbd>
          </button>
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

type CommandPaletteItem = {
  id: string;
  label: string;
  detail: string;
  group: "Ações" | "Matérias" | "Conteúdos" | "Tarefas";
  icon: LucideIcon;
  run: () => void;
};

function CommandPalette({
  data,
  query,
  setQuery,
  setMineInput,
  setSelectedSubjectId,
  setModal,
  close,
}: {
  data: ReturnType<typeof useMemoUserData>;
  query: string;
  setQuery: (value: string) => void;
  setMineInput: (value: string) => void;
  setSelectedSubjectId: (value?: string) => void;
  setModal: (modal: Modal) => void;
  close: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const clean = query.trim();
  const normalized = normalizeText(clean);

  const dismiss = useCallback(() => {
    setQuery("");
    close();
  }, [close, setQuery]);

  const run = useCallback((action: () => void) => {
    dismiss();
    action();
  }, [dismiss]);

  const actions: CommandPaletteItem[] = [
    { id: "mine", label: "Perguntar à Mine", detail: "Abrir uma conversa de estudo", group: "Ações", icon: Bot, run: () => go("mine") },
    { id: "task", label: "Criar tarefa", detail: "Adicionar uma entrega à agenda", group: "Ações", icon: CalendarCheck, run: () => setModal({ type: "task" }) },
    { id: "focus", label: "Iniciar foco", detail: "Abrir o cronômetro de estudo", group: "Ações", icon: Timer, run: () => go("foco") },
    { id: "plan", label: "Montar plano de estudos", detail: "Organizar os dias até a prova", group: "Ações", icon: CalendarPlus, run: () => go("plan") },
    { id: "subject", label: "Criar matéria", detail: "Abrir um novo caderno", group: "Ações", icon: Plus, run: () => setModal({ type: "subject" }) },
    { id: "search", label: "Abrir busca completa", detail: "Livros, artigos e toda a biblioteca", group: "Ações", icon: Search, run: () => go("search") },
  ];

  const matches = normalized
    ? [
        {
          id: "ask",
          label: `Perguntar “${clean.slice(0, 56)}${clean.length > 56 ? "…" : ""}” à Mine`,
          detail: "A pergunta ficará pronta na caixa de mensagem",
          group: "Ações" as const,
          icon: Bot,
          run: () => {
            setSelectedSubjectId(undefined);
            setMineInput(clean);
            go("mine");
          },
        },
        ...data.subjects
          .filter((subject) => normalizeText(subject.name).includes(normalized))
          .slice(0, 4)
          .map<CommandPaletteItem>((subject) => ({
            id: `subject-${subject.id}`,
            label: subject.name,
            detail: `${data.materials.filter((material) => material.subjectId === subject.id).length} conteúdos neste caderno`,
            group: "Matérias",
            icon: iconMap[subject.icon],
            run: () => go("subject", subject.id),
          })),
        ...data.materials
          .filter((material) => normalizeText(`${material.title} ${material.detail}`).includes(normalized))
          .slice(0, 4)
          .map<CommandPaletteItem>((material) => ({
            id: `material-${material.id}`,
            label: material.title,
            detail: data.subjects.find((subject) => subject.id === material.subjectId)?.name || "Conteúdo salvo",
            group: "Conteúdos",
            icon: material.type === "link" ? LinkIcon : material.type === "image" ? Camera : FileText,
            run: () => setModal({ type: "materialView", materialId: material.id }),
          })),
        ...data.tasks
          .filter((task) => !task.done && normalizeText(`${task.title} ${task.note}`).includes(normalized))
          .slice(0, 4)
          .map<CommandPaletteItem>((task) => ({
            id: `task-${task.id}`,
            label: task.title,
            detail: `Agenda · ${dateLabel(task.dueAt)}`,
            group: "Tarefas",
            icon: CalendarCheck,
            run: () => go("agenda"),
          })),
      ].slice(0, 10)
    : actions;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      dismiss();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % matches.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + matches.length) % matches.length);
      return;
    }
    if (event.key === "Enter" && matches[activeIndex]) {
      event.preventDefault();
      run(matches[activeIndex].run);
    }
  }

  return (
    <motion.div
      className="workspace-shell caderno-modal fixed inset-0 z-[100] flex items-start justify-center px-3 pt-[8vh] sm:pt-[12vh]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        className="w-full max-w-2xl overflow-hidden rounded-[1.25rem] border border-white/[0.12] bg-[#111815] shadow-[0_32px_100px_-24px_rgba(0,0,0,.9)]"
        initial={{ opacity: 0, y: -18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={spring.snappy}
      >
        <h2 id="command-palette-title" className="sr-only">Busca rápida</h2>
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3.5 sm:px-5">
          <Search className="h-5 w-5 shrink-0 text-mint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar matéria, conteúdo, tarefa ou ação…"
            aria-label="Busca rápida"
            className="h-11 min-w-0 flex-1 bg-transparent text-[15px] font-bold text-white outline-none placeholder:text-white/30"
          />
          <button type="button" onClick={dismiss} aria-label="Fechar busca" className="grid h-9 w-9 place-items-center rounded-lg text-white/40 transition hover:bg-white/[0.06] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="minerva-scroll max-h-[min(34rem,68vh)] overflow-y-auto p-2.5 sm:p-3">
          <p className="px-2 pb-2 pt-1 text-[9px] font-black uppercase tracking-[.18em] text-white/28">
            {clean ? `${matches.length} opções` : "Ações rápidas"}
          </p>
          <div className="space-y-1">
            {matches.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => run(item.run)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${activeIndex === index ? "bg-mint text-black" : "text-white/72 hover:bg-white/[0.05] hover:text-white"}`}
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[.7rem] border ${activeIndex === index ? "border-black/10 bg-black/10" : "border-white/[0.08] bg-white/[0.035] text-mint"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black">{item.label}</span>
                    <span className={`mt-0.5 block truncate text-[11px] font-bold ${activeIndex === index ? "text-black/55" : "text-white/32"}`}>{item.detail}</span>
                  </span>
                  <span className={`hidden text-[9px] font-black uppercase tracking-[.12em] sm:block ${activeIndex === index ? "text-black/45" : "text-white/24"}`}>{item.group}</span>
                </button>
              );
            })}
          </div>
        </div>

        <footer className="hidden items-center justify-between border-t border-white/[0.07] px-5 py-2.5 text-[10px] font-bold text-white/28 sm:flex">
          <span>↑↓ navega · Enter abre · Esc fecha</span>
          <span>Ctrl K em qualquer tela</span>
        </footer>
      </motion.section>
    </motion.div>
  );
}

export function AppearanceControls({
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
  const rest = navItems.filter((item) => !mobilePrimary.includes(item.view) && !hiddenFromMenu.includes(item.view) && (item.view !== "admin" || isAdmin));
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
              role="dialog"
              aria-label="Mais telas"
              className="mobile-more-sheet fixed inset-x-3 bottom-[6.5rem] z-40 max-h-[calc(100dvh-8.5rem)] overflow-y-auto rounded-[1.35rem] border border-white/10 bg-[#171c1a] p-4 shadow-lift lg:hidden"
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
              {[...navGroups.map((group) => ({ id: group.id as string, label: group.label, views: group.views })), { id: "conta", label: "Conta", views: accountViews }].map((group, groupIndex) => {
                const items = rest.filter((item) => group.views.includes(item.view));
                if (!items.length) return null;
                return (
                  <section key={group.id} className="caderno-area mb-3 last:mb-0" data-area={group.id}>
                    <p className="mb-1.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-[.14em] text-white/45">
                      <span className="caderno-area-here h-2 w-2 rounded-full" aria-hidden />
                      {group.label}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {items.map((item, index) => {
                        const Icon = item.icon;
                        const active = route === item.view;
                        return (
                          <motion.button
                            key={item.view}
                            onClick={() => go(item.view)}
                            initial={reduced ? false : { opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: reduced ? 0 : (groupIndex * 2 + index) * 0.025, ease: ease.out }}
                            className={`grid place-items-center gap-1.5 rounded-[.85rem] border p-3 text-[11px] font-black transition ${
                              active ? "border-mint bg-mint text-black" : "border-white/10 bg-white/[0.025] text-white/65 active:scale-95"
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                            <span className="line-clamp-2 w-full text-center leading-tight">{item.label}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
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

      <nav data-focus-avoid className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-1 border-t border-white/10 bg-[#141a17]/98 px-2 pb-1 pt-1.5 shadow-[0_-16px_45px_-30px_rgba(0,0,0,.95)] backdrop-blur-md lg:hidden">
        {primary.map((item) => {
          const Icon = item.icon;
          const active = route === item.view;
          return (
            <button
              key={item.view}
              onClick={() => go(item.view)}
              aria-current={active ? "page" : undefined}
              data-tour={item.view}
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

/**
 * Separa o fim do título para receber o traço de marca-texto. O grifo pega as
 * últimas palavras até ~18 letras: o bastante para parecer gesto de aluno,
 * sem virar uma faixa atravessando a linha inteira.
 */
function splitHighlight(title: string): [string, string] {
  const words = title.trim().split(/\s+/);
  if (words.length < 2) return ["", title.trim()];
  let tail = words.pop() || "";
  while (words.length > 1 && tail.length + words[words.length - 1].length < 16) tail = `${words.pop()} ${tail}`;
  // pontuação final fica fora do grifo, como quem para a caneta antes do ponto
  const punct = tail.match(/[.!?,:;]+$/)?.[0] || "";
  return [`${words.join(" ")} `, punct ? tail.slice(0, -punct.length) : tail];
}

function HighlightTitle({ text, className = "" }: { text: string; className?: string }) {
  const [head, tail] = splitHighlight(text);
  const punct = text.trim().slice(head.length + tail.length);
  return (
    <span className={className}>
      {head ? <SplitWords text={head.trim()} delay={0.035} /> : null}
      {head ? " " : null}
      <span className="caderno-hl">{tail}</span>
      {punct}
    </span>
  );
}

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  const reduced = useSoftMotion();
  return (
    <header className="workspace-header studio-page-header caderno-page-header relative mb-8 grid gap-5 pb-7 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
      <div className="min-w-0">
        <motion.p
          className="caderno-note mb-2"
          initial={reduced ? false : { opacity: 0, x: -8, rotate: -4 }}
          animate={{ opacity: 1, x: 0, rotate: -1.5 }}
          transition={{ duration: 0.45, ease: ease.out }}
        >
          {eyebrow.toLocaleLowerCase("pt-BR")}
        </motion.p>
        <h1 className="caderno-title font-display text-[2.4rem] font-black leading-[1.02] text-white md:text-[3.4rem]">
          <HighlightTitle text={title} />
          <Doodle kind={doodleFor(eyebrow)} className="caderno-title-doodle" delay={reduced ? 0 : 900} duration={800} strokeWidth={3} redraw />
        </h1>
        {subtitle ? (
          <motion.p
            className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/60 md:text-[16px]"
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.14, ease: ease.out }}
          >
            {subtitle}
          </motion.p>
        ) : null}
      </div>
      <motion.div
        className="flex shrink-0 items-center gap-3"
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.18, ease: ease.out }}
      >
        {action ? <div className="flex flex-wrap justify-start gap-2 xl:justify-end">{action}</div> : null}
      </motion.div>
    </header>
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
  openCommand,
  openMine,
  userId,
  provasConta,
}: {
  data: ReturnType<typeof useMemoUserData>;
  userId: string;
  provasConta?: User["settings"]["provas"];
  displayName: string;
  accentColor: string;
  themeMode: ThemeMode;
  setModal: (modal: Modal) => void;
  update: (next: (draft: AppData) => AppData) => void;
  openCommand: () => void;
  openMine: (subjectId?: string) => void;
}) {
  const now = Date.now();
  const studied = data.materials.filter((item) => item.studied).length;
  const pendingTasks = data.tasks.filter((task) => !task.done).sort((a, b) => a.dueAt - b.dueAt);
  const latest = data.materials.slice().sort((a, b) => b.createdAt - a.createdAt)[0];
  const days = streakDays(data.sessions);
  const dueToday = pendingTasks.filter((task) => task.dueAt <= today()).length;
  const overdue = pendingTasks.filter((task) => task.dueAt < today()).length;
  const primaryTask = pendingTasks[0];
  const primarySubject = primaryTask ? data.subjects.find((subject) => subject.id === primaryTask.subjectId) : undefined;

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
  const globeNodes: MindNode[] = data.subjects.map((subject) => {
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
      leaves: items
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 2)
        .map((item) => item.title),
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

  const subjectDesk = data.subjects
    .map((subject) => {
      const materials = data.materials.filter((item) => item.subjectId === subject.id);
      const tasks = pendingTasks.filter((task) => task.subjectId === subject.id);
      const reviews = data.flashcards.filter((card) => card.subjectId === subject.id && card.dueAt <= now).length;
      const overdueTasks = tasks.filter((task) => task.dueAt < today()).length;
      const nextTask = tasks[0];
      return {
        subject,
        materials,
        nextTask,
        reviews,
        overdueTasks,
        priority: overdueTasks * 10000 + reviews * 100 + (nextTask ? Math.max(0, 30 - Math.floor((nextTask.dueAt - today()) / 86400000)) : 0),
      };
    })
    .sort((a, b) => b.priority - a.priority || Number(b.subject.favorite) - Number(a.subject.favorite) || a.subject.name.localeCompare(b.subject.name, "pt-BR"));

  // dias com estudo na última semana, de 6 dias atrás até hoje
  const weekDots = Array.from({ length: 7 }, (_, index) => {
    const start = today() - (6 - index) * 86400000;
    return data.sessions.some((session) => session.createdAt >= start && session.createdAt < start + 86400000);
  });
  // Caderno de erros: o da conta somado ao deste navegador (a aba Provas sincroniza os dois).
  const provasResumo = useMemo(() => {
    let local: Array<{ id?: string; status?: string }> = [];
    try {
      const salvo = JSON.parse(localStorage.getItem(`minerva:provas:${userId}`) || "{}");
      if (Array.isArray(salvo.caderno)) local = salvo.caderno;
    } catch {
      // sem armazenamento local: vale o da conta
    }
    const porId = new Map<string, { status?: string }>();
    for (const item of [...((provasConta?.caderno || []) as Array<{ id?: string; status?: string }>), ...local]) if (item?.id) porId.set(item.id, item);
    return { pendentes: [...porId.values()].filter((item) => item.status !== "dominado").length };
  }, [userId, provasConta]);

  // ── Estante em órbita (nov/2026): uma matéria por vez, a mais urgente primeiro ──
  const diaCurto = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const quandoProva = (dueAt: number) => {
    const dias = Math.round((dueAt - today()) / 86400000);
    if (dias <= 0) return "prova hoje";
    if (dias === 1) return "prova amanhã";
    return `prova ${diaCurto[new Date(dueAt).getDay()]}`;
  };
  const estanteMaterias: MateriaEstante[] = data.subjects
    .map((subject) => {
      const materials = data.materials.filter((item) => item.subjectId === subject.id);
      const tasks = pendingTasks.filter((task) => task.subjectId === subject.id);
      const atrasadas = tasks.filter((task) => task.dueAt < today());
      const deHoje = tasks.filter((task) => task.dueAt >= today() && task.dueAt < today() + 86400000);
      const prova = tasks.find((task) => task.kind === "prova" && task.dueAt >= today() && task.dueAt < today() + 8 * 86400000);
      const reviews = data.flashcards.filter((card) => card.subjectId === subject.id && card.dueAt <= now).length;
      const continuar = materials.filter((item) => !item.studied).sort((a, b) => b.createdAt - a.createdAt)[0];
      const aviso: AvisoCaderno | undefined = atrasadas.length
        ? { texto: `${atrasadas.length} ${atrasadas.length === 1 ? "atrasada" : "atrasadas"}`, tom: "rosa" }
        : prova
          ? { texto: quandoProva(prova.dueAt), tom: "amarelo" }
          : deHoje.length
            ? { texto: `${deHoje.length} pra hoje`, tom: "amarelo" }
            : undefined;
      const itens: ItemFicha[] = [];
      atrasadas.slice(0, 2).forEach((task) =>
        itens.push({ id: task.id, tipo: "atrasada", titulo: task.title, detalhe: `era para ${shortDate(task.dueAt)}`, onClick: () => go("agenda") }),
      );
      deHoje.slice(0, 2).forEach((task) =>
        itens.push({ id: task.id, tipo: task.kind === "prova" ? "prova" : "hoje", titulo: task.title, detalhe: task.time ? `hoje às ${task.time}` : "vence hoje", onClick: () => go("agenda") }),
      );
      if (prova && !deHoje.includes(prova)) itens.push({ id: prova.id, tipo: "prova", titulo: prova.title, detalhe: `${quandoProva(prova.dueAt).replace("prova ", "")}, ${shortDate(prova.dueAt)} · treine na aba Provas`, onClick: () => go("provas") });
      if (reviews) itens.push({ id: `rev-${subject.id}`, tipo: "revisao", titulo: `Revisar ${reviews} ${reviews === 1 ? "flashcard" : "flashcards"}`, detalhe: "leva poucos minutos", onClick: () => setModal({ type: "flashcards", subjectId: subject.id }) });
      if (continuar) itens.push({ id: continuar.id, tipo: "continuar", titulo: continuar.title, detalhe: "conteúdo ainda não estudado", onClick: () => setModal({ type: "materialView", materialId: continuar.id }) });
      const proxima = tasks.find((task) => task.dueAt >= today() + 86400000 && task !== prova);
      if (proxima) itens.push({ id: proxima.id, tipo: "tarefa", titulo: proxima.title, detalhe: `${dateLabel(proxima.dueAt).toLowerCase()}, ${shortDate(proxima.dueAt)}`, onClick: () => go("agenda") });
      const dias = prova ? Math.max(0, Math.round((prova.dueAt - today()) / 86400000)) : 99;
      return {
        urgencia: atrasadas.length * 10000 + (prova ? (8 - dias) * 600 : 0) + deHoje.length * 300 + reviews * 10 + (subject.favorite ? 5 : 0),
        materia: {
          id: subject.id,
          name: subject.name,
          color: subject.color,
          icon: iconMap[subject.icon] || BookOpen,
          conteudos: materials.length,
          estudados: materials.filter((item) => item.studied).length,
          aviso,
          itens: itens.slice(0, 4),
          // a fala da Mine no balão: o próximo passo mais útil, dito como dica
          // O balão diz o porquê e o próximo passo; o nome da tarefa já está na
          // ficha e no bilhete, e repetir foi o que deixou a Home confusa.
          dica: atrasadas.length
            ? "Resolver o que passou do prazo primeiro deixa o resto da semana mais leve. Quer que eu te ajude a começar?"
            : prova
              ? `${dias <= 0 ? "Prova hoje!" : dias === 1 ? "Prova amanhã!" : `Faltam ${dias} dias.`} Revisar um pouco por dia rende mais que virar a noite. Bora treinar comigo?`
              : reviews
                ? "Revisar no dia certo faz você lembrar o dobro. São uns 5 minutinhos!"
                : continuar
                  ? "Quer que eu explique o próximo conteúdo antes de você ler? Fica bem mais fácil."
                  : materials.length
                    ? `Você estudou tudo de ${subject.name}! Um jogo ou um duelo ajuda a fixar.`
                    : "Coloca o primeiro conteúdo e eu monto flashcards e resumos pra você.",
        },
      };
    })
    .sort((a, b) => b.urgencia - a.urgencia || a.materia.name.localeCompare(b.materia.name, "pt-BR"))
    .map((entry) => entry.materia);

  // faixa "próximos 7 dias": as tarefas de todas as matérias, dia a dia
  const corDaMateria = (subjectId: string) => data.subjects.find((subject) => subject.id === subjectId)?.color || "#94A3B8";
  const proximosDias: DiaSemana[] = Array.from({ length: 7 }, (_, indice) => {
    const inicio = today() + indice * 86400000;
    const dia = new Date(inicio);
    return {
      chave: String(inicio),
      rotulo: indice === 0 ? "hoje" : indice === 1 ? "amanhã" : diaCurto[dia.getDay()],
      data: shortDate(inicio),
      hoje: indice === 0,
      tarefas: pendingTasks
        .filter((task) => (indice === 0 ? task.dueAt < inicio + 86400000 : task.dueAt >= inicio && task.dueAt < inicio + 86400000))
        .map((task) => ({ id: task.id, titulo: task.title, cor: corDaMateria(task.subjectId), prova: task.kind === "prova" })),
    };
  });

  const maisUrgente = estanteMaterias[0];
  const semMateria = pendingTasks.filter((task) => !data.subjects.some((subject) => subject.id === task.subjectId)).length;
  // A fala da Mine no hero: o resumo do dia inteiro, de todas as matérias
  // (a ficha cuida dos detalhes de uma matéria só).
  const totalAtrasadas = pendingTasks.filter((task) => task.dueAt < today()).length;
  const totalHoje = pendingTasks.filter((task) => task.dueAt >= today() && task.dueAt < today() + 86400000).length;
  const proximaProva = pendingTasks.find((task) => task.kind === "prova" && task.dueAt >= today() && task.dueAt < today() + 8 * 86400000);
  const provaMateria = proximaProva ? data.subjects.find((subject) => subject.id === proximaProva.subjectId)?.name : undefined;
  const diasProva = proximaProva ? Math.round((proximaProva.dueAt - today()) / 86400000) : 0;
  const quandoLongo = diasProva <= 0 ? "hoje" : diasProva === 1 ? "amanhã" : `na ${new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(new Date(proximaProva?.dueAt || 0))}`;
  const partes = [
    totalAtrasadas ? `${totalAtrasadas} ${totalAtrasadas === 1 ? "tarefa atrasada" : "tarefas atrasadas"}` : "",
    totalHoje ? `${totalHoje} ${totalHoje === 1 ? "entrega" : "entregas"} pra hoje` : "",
    proximaProva ? `prova${provaMateria ? ` de ${provaMateria}` : ""} ${quandoLongo}` : "",
    dueCards ? `${dueCards} ${dueCards === 1 ? "flashcard" : "flashcards"} pra revisar` : "",
  ].filter(Boolean);
  const juntar = (lista: string[]) => (lista.length > 1 ? `${lista.slice(0, -1).join(", ")} e ${lista[lista.length - 1]}` : lista[0] || "");
  const fraseEstante = !estanteMaterias.length
    ? "Eu sou a Mine! Crie sua primeira matéria e ela vira um caderno girando aqui em volta de mim. Aí eu ajudo a estudar tudo o que você colocar nele."
    : partes.length
      ? `Hoje tem ${juntar(partes)}. Eu começaria por ${maisUrgente.name}: já deixei a ficha aberta aí embaixo.`
      : `Tudo em dia por aqui! ${data.materials.length ? `Você já estudou ${studied} de ${data.materials.length} conteúdos.` : ""} Bom dia pra adiantar um conteúdo ou testar o que já sabe num jogo.`;
  const dataHoje = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  // ── Cartão "Hoje" (nov/2026): três passos que respondem "o que eu faço agora?" ──
  const desafioFeito = data.sessions.some((session) => session.dailyChallenge && session.dailyKey === dailyChallengeKey());
  const tarefaFoco = pendingTasks.find((task) => task.dueAt < today() + 86400000) || proximaProva;
  const materiaFoco = tarefaFoco ? data.subjects.find((subject) => subject.id === tarefaFoco.subjectId)?.name : undefined;
  const feitasHoje = data.tasks.filter((task) => task.done && (task.doneAt || 0) >= today()).length;
  const passosHoje: PassoHoje[] = [
    tarefaFoco
      ? {
          id: "tarefa",
          tom: tarefaFoco.dueAt < today() ? "rosa" : "amarelo",
          rotulo: tarefaFoco.dueAt < today() ? "atrasada" : tarefaFoco.kind === "prova" ? quandoProva(tarefaFoco.dueAt) : "pra hoje",
          titulo: tarefaFoco.title,
          detalhe: materiaFoco ? `${materiaFoco} · abrir na agenda` : "abrir na agenda",
          feito: false,
          onClick: () => go(tarefaFoco.kind === "prova" && tarefaFoco.dueAt >= today() ? "provas" : "agenda"),
        }
      : {
          id: "tarefa",
          tom: "amarelo",
          rotulo: "agenda",
          titulo: feitasHoje ? `${feitasHoje} ${feitasHoje === 1 ? "entrega feita" : "entregas feitas"} hoje` : "Nada vencendo hoje",
          detalhe: pendingTasks.length ? `próxima: ${pendingTasks[0].title}` : "anote a próxima tarefa",
          feito: true,
          onClick: () => go("agenda"),
        },
    provasResumo.pendentes
      ? {
          id: "erros",
          tom: "lilas",
          rotulo: "revisar",
          titulo: `${provasResumo.pendentes} ${provasResumo.pendentes === 1 ? "erro" : "erros"} de prova para estudar`,
          detalhe: "a Mine explica cada um",
          feito: false,
          onClick: () => go("provas"),
        }
      : dueCards
        ? {
            id: "erros",
            tom: "lilas",
            rotulo: "revisar",
            titulo: `${dueCards} ${dueCards === 1 ? "flashcard" : "flashcards"} para revisar`,
            detalhe: "uns 5 minutinhos",
            feito: false,
            onClick: () => setModal({ type: "flashcards", subjectId: dueBySubject[0]?.subject.id || data.subjects[0]?.id || "" }),
          }
        : {
            id: "erros",
            tom: "lilas",
            rotulo: "testar",
            titulo: "Fazer uma prova rápida",
            detalhe: "nenhum erro pendente: hora de testar",
            feito: false,
            onClick: () => go("provas"),
          },
    {
      id: "desafio",
      tom: "menta",
      rotulo: "desafio do dia",
      titulo: desafioFeito ? "Desafio de hoje concluído" : "5 perguntas rápidas",
      detalhe: desafioFeito ? "volte amanhã para outro" : "vale XP e mantém a sequência",
      feito: desafioFeito,
      onClick: () => go("games", "diario"),
    },
  ];

  return (
    <HomeEstante
      saudacao={greeting()}
      nome={displayName}
      frase={fraseEstante}
      materias={estanteMaterias}
      nivel={gam.level}
      titulo={gam.title}
      xpNivel={gam.levelXp}
      xpPreciso={gam.levelNeed}
      dias={days}
      semana={weekDots}
      tema={themeMode}
      atalhos={[
        { id: "mine", label: "Mine", icon: Bot, tom: "lilas", onClick: () => go("mine") },
        { id: "agenda", label: "Agenda", icon: CalendarDays, tom: "amarelo", onClick: () => go("agenda") },
        { id: "provas", label: "Provas", icon: ClipboardCheck, tom: "rosa", onClick: () => go("provas") },
        { id: "games", label: "Games", icon: Gamepad2, tom: "menta", onClick: () => go("games") },
        { id: "duelo", label: "Duelo", icon: Swords, tom: "lilas", onClick: () => go("duelo") },
      ]}
      onAbrir={(id) => go("subject", id)}
      onPerguntar={(id) => {
        const materia = estanteMaterias.find((item) => item.id === id);
        if (!materia) return;
        const conteudos = data.materials.filter((item) => item.subjectId === id).slice(0, 12).map((item) => `- ${item.title}${item.studied ? " (estudado)" : ""}`);
        mineConversa(
          `Me ajuda a estudar ${materia.name} agora? Por onde eu começo?`,
          `O estudante esta na Home do Minerva olhando a materia "${materia.name}". Conteudos cadastrados:\n${conteudos.join("\n") || "- nenhum ainda"}\nO que ele tem para fazer nela: ${materia.itens.map((item) => `${item.titulo} (${item.detalhe})`).join("; ") || "nada pendente"}.`,
          materia.name,
        );
      }}
      onNovaMateria={() => setModal({ type: "subject" })}
      dataHoje={dataHoje}
      passosHoje={passosHoje}
      proximos={proximosDias}
      xpHoje={xpSince(data, today())}
      estudados={studied}
      conteudos={data.materials.length}
      onAgenda={() => go("agenda")}
      onMine={() => go("mine")}
      onProgresso={() => go("progress")}
    />
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
  nodes: MindNode[];
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

        {/* O mapa mental vivo ocupa a metade direita. A camada absoluta carrega
            o tamanho; o mapa mede a caixa e desenha em pixels reais. */}
        <div className="relative min-h-[28rem] md:min-h-0">
          <div className="absolute inset-0">
            <LiveMindMap nodes={nodes} reduced={Boolean(reduced)} onSelect={(id) => go("subject", id)} onEmpty={onCreate} />
          </div>
        </div>
      </div>
    </section>
  );
}

function StudyNowPanel({
  nextTask,
  subject,
  dueCards,
  dueBySubject,
  dueToday,
  days,
  weekFocus,
  pendingTasks,
  setModal,
  update,
}: {
  nextTask?: Task;
  subject?: Subject;
  dueCards: number;
  dueBySubject: Array<{ subject: Subject; due: number }>;
  dueToday: number;
  days: number;
  weekFocus: number;
  pendingTasks: Task[];
  setModal: (modal: Modal) => void;
  update: (next: (draft: AppData) => AppData) => void;
}) {
  const review = dueBySubject[0];
  const hasReviewPriority = !nextTask && Boolean(review);
  const title = nextTask?.title || (hasReviewPriority ? `Revisar ${review.due} ${review.due === 1 ? "flashcard" : "flashcards"} de ${review.subject.name}` : "Iniciar uma sessão de foco");
  const reason = nextTask
    ? nextTask.dueAt < today()
      ? `Está atrasada desde ${shortDate(nextTask.dueAt)}.`
      : nextTask.dueAt === today()
        ? "É a primeira entrega de hoje."
        : `É sua próxima entrega, em ${shortDate(nextTask.dueAt)}.`
    : hasReviewPriority
      ? "A revisão espaçada está pronta para você."
      : "Sua agenda está livre; use este espaço para avançar uma matéria.";
  const start = () => {
    if (nextTask) go("agenda");
    else if (review) setModal({ type: "flashcards", subjectId: review.subject.id });
    else go("foco");
  };
  const date = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <Reveal>
      <section className="card-ambient-surface relative overflow-hidden rounded-[1.35rem] border border-white/[0.09] bg-[#171c1a]">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-mint" />
        <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,.75fr)]">
          <div className="relative p-5 sm:p-7 lg:p-8">
            <p className="caderno-note">Agora · {date}</p>
            <h2 className="mt-2 max-w-2xl font-display text-[1.8rem] font-black leading-[1.02] tracking-[-.045em] sm:text-[2.5rem]">
              O que merece sua atenção agora
            </h2>

            <div className="mt-6 rounded-[1.05rem] border border-white/[0.1] bg-[#202723] p-4 sm:p-5">
              <div className="flex items-start gap-3.5">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-[.8rem] text-black"
                  style={{ background: subject?.color || review?.subject.color || "rgb(var(--mint))" }}
                >
                  {nextTask ? <ListChecks className="h-5 w-5" /> : hasReviewPriority ? <Layers className="h-5 w-5" /> : <Timer className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/38">
                    {subject?.name || review?.subject.name || "Sessão livre"}
                  </p>
                  <h3 className="mt-1 text-balance text-lg font-black leading-tight text-white sm:text-xl">{title}</h3>
                  <p className="mt-1.5 text-sm font-bold text-white/45">{reason}</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={start}
                  className="group inline-flex min-h-11 items-center gap-2 rounded-[.8rem] bg-mint px-4 text-[12px] font-black text-black shadow-glowSoft transition hover:-translate-y-0.5"
                >
                  {nextTask ? "Abrir agenda" : hasReviewPriority ? "Revisar agora" : "Começar foco"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
                {nextTask ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      cheer(event.currentTarget, xpPerAction.taskDone);
                      update((draft) => ({
                        ...draft,
                        tasks: setTaskDone(draft.tasks, nextTask.id, true),
                      }));
                    }}
                    className="inline-flex min-h-11 items-center gap-2 rounded-[.8rem] border border-white/10 px-4 text-[12px] font-black text-white/60 transition hover:border-mint/30 hover:text-white"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Marcar como feita
                  </button>
                ) : null}
                <button type="button" onClick={() => go("mine")} className="inline-flex min-h-11 items-center gap-2 px-2 text-[12px] font-black text-mint transition hover:text-white">
                  <Bot className="h-4 w-4" /> Perguntar à Mine
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[.85rem] border border-white/[0.08] bg-white/[0.08] sm:grid-cols-4">
              {[
                [dueToday, "para hoje"],
                [dueCards, "revisões"],
                [days, days === 1 ? "dia seguido" : "dias seguidos"],
                [humanMinutes(weekFocus), "foco em 7 dias"],
              ].map(([value, label]) => (
                <div key={label} className="bg-[#171c1a] px-3 py-3.5">
                  <p className="font-display text-xl font-black tabular text-white">{typeof value === "number" ? <CountUp value={value} /> : value}</p>
                  <p className="mt-0.5 text-[9px] font-black uppercase tracking-[.1em] text-white/35">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="hidden border-t border-white/[0.08] bg-black/10 p-5 sm:block sm:p-7 lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="caderno-note text-[1.15rem]">risque o que fez</p>
                <h3 className="mt-1 font-display text-xl font-black">Para hoje</h3>
              </div>
              <button type="button" onClick={() => go("agenda")} className="text-[11px] font-black text-mint hover:text-white">Ver agenda</button>
            </div>
            <TodayChecklist tasks={pendingTasks.slice(0, 4)} update={update} />
            <StreakWeek days={days} />
          </aside>
        </div>
      </section>
    </Reveal>
  );
}

/**
 * Lista do dia em forma de caderno: marcar risca a tarefa com caneta, o XP
 * sai voando e só depois do risco a linha deixa a lista. Sem esse atraso a
 * tarefa sumiria antes de o gesto ter graça.
 */
function TodayChecklist({ tasks, update }: { tasks: Task[]; update: (next: (draft: AppData) => AppData) => void }) {
  const [striking, setStriking] = useState<string[]>([]);
  const reduced = useSoftMotion();
  const finish = (task: Task, target: HTMLElement) => {
    if (striking.includes(task.id)) return;
    cheer(target, xpPerAction.taskDone);
    setStriking((list) => [...list, task.id]);
    window.setTimeout(() => {
      update((draft) => ({ ...draft, tasks: setTaskDone(draft.tasks, task.id, true) }));
      setStriking((list) => list.filter((id) => id !== task.id));
    }, reduced ? 0 : 900);
  };
  if (!tasks.length) {
    return (
      <div className="mt-5 rounded-xl border border-mint/15 bg-mint/[0.05] p-4">
        <Doodle kind="check" className="h-9 w-9" strokeWidth={3.5} />
        <p className="mt-2 text-sm font-black text-white/72">Página do dia vazia!</p>
        <p className="mt-1 text-xs leading-relaxed text-white/38">A Mine pode sugerir o próximo assunto, ou você pode abrir uma sessão de foco.</p>
      </div>
    );
  }
  return (
    <ul className="mt-4 grid gap-0.5">
      <AnimatePresence initial={false}>
        {tasks.map((task) => {
          const done = striking.includes(task.id);
          return (
            <motion.li
              key={task.id}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: 24, rotate: 2, transition: { duration: 0.28 } }}
              className="flex min-h-12 items-center gap-2 border-b border-dashed border-white/10 last:border-b-0"
            >
              <button
                type="button"
                onClick={(event) => finish(task, event.currentTarget)}
                aria-label={`Concluir ${task.title}`}
                aria-pressed={done}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg hover:bg-pen/[0.06]"
              >
                <InkCheck checked={done} />
              </button>
              <button type="button" onClick={() => go("agenda")} className="min-w-0 flex-1 py-1 text-left">
                <span className="block truncate text-[15px] font-bold">
                  <span className={`caderno-strike ${done ? "is-struck" : ""}`}>{task.title}</span>
                </span>
                <span className={`block text-[11px] font-bold ${task.dueAt < today() ? "text-margin" : "text-white/40"}`}>{dateLabel(task.dueAt)} · +{xpPerAction.taskDone} XP</span>
              </button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

/** Sete quadradinhos da semana: os dias com estudo levam marca-texto. */
function StreakWeek({ days }: { days: number }) {
  const reduced = useSoftMotion();
  const labels = ["D", "S", "T", "Q", "Q", "S", "S"];
  const cells = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today() - (6 - index) * 86400000);
    return { label: labels[date.getDay()], done: 6 - index < days, isToday: index === 6 };
  });
  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/40">Sequência</p>
        <p className="caderno-hand text-lg">{days ? `${days} ${days === 1 ? "dia" : "dias"} seguidos!` : "comece hoje!"}</p>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {cells.map((cell, index) => (
          <motion.span
            key={index}
            initial={reduced ? false : { scale: 0.5, opacity: 0, rotate: -12 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ delay: reduced ? 0 : 0.4 + index * 0.07, type: "spring", stiffness: 500, damping: 18 }}
            className={`grid aspect-square place-items-center rounded-lg font-mono text-[11px] ${
              cell.done ? "bg-mint text-black" : "bg-white/[0.05] text-white/40"
            } ${cell.isToday ? "ring-2 ring-pen ring-offset-1 ring-offset-transparent" : ""}`}
            aria-label={cell.done ? "dia com estudo" : "dia sem estudo"}
          >
            {cell.label}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

type ContinueItem = {
  id: string;
  kind: "Sessão" | "Material" | "Conversa";
  title: string;
  detail: string;
  createdAt: number;
  icon: LucideIcon;
  accent: string;
  action: () => void;
};

function ContinueStudyPanel({
  data,
  openMaterial,
  openMine,
}: {
  data: ReturnType<typeof useMemoUserData>;
  openMaterial: (materialId: string) => void;
  openMine: (subjectId?: string) => void;
}) {
  const latestSession = data.sessions.slice().sort((a, b) => b.createdAt - a.createdAt)[0];
  const latestMaterial = data.materials.slice().sort((a, b) => b.createdAt - a.createdAt)[0];
  const latestChat = data.chats.filter((item) => item.role === "user").slice().sort((a, b) => b.createdAt - a.createdAt)[0];
  const sessionSubject = latestSession ? data.subjects.find((item) => item.id === latestSession.subjectId) : undefined;
  const materialSubject = latestMaterial ? data.subjects.find((item) => item.id === latestMaterial.subjectId) : undefined;
  const chatSubject = latestChat?.subjectId ? data.subjects.find((item) => item.id === latestChat.subjectId) : undefined;
  const items: ContinueItem[] = [
    latestSession && sessionSubject
      ? {
          id: `session-${latestSession.id}`,
          kind: "Sessão",
          title: latestSession.title,
          detail: `${sessionSubject.name} · ${latestSession.kind || "estudo"}`,
          createdAt: latestSession.createdAt,
          icon: Timer,
          accent: sessionSubject.color,
          action: () => go("subject", sessionSubject.id),
        }
      : undefined,
    latestMaterial && materialSubject
      ? {
          id: `material-${latestMaterial.id}`,
          kind: "Material",
          title: latestMaterial.title,
          detail: `${materialSubject.name} · ${latestMaterial.studied ? "já estudado" : "pronto para estudar"}`,
          createdAt: latestMaterial.createdAt,
          icon: BookOpen,
          accent: materialSubject.color,
          action: () => openMaterial(latestMaterial.id),
        }
      : undefined,
    latestChat
      ? {
          id: `chat-${latestChat.id}`,
          kind: "Conversa",
          title: latestChat.text.replace(/\s+/g, " ").trim(),
          detail: chatSubject ? `Mine · ${chatSubject.name}` : "Mine · contexto geral",
          createdAt: latestChat.createdAt,
          icon: MessageCircle,
          accent: chatSubject?.color || "#39F59A",
          action: () => openMine(chatSubject?.id),
        }
      : undefined,
  ]
    .filter((item): item is ContinueItem => Boolean(item))
    .sort((a, b) => b.createdAt - a.createdAt);

  if (!items.length) return null;
  const primary = items[0];
  const PrimaryIcon = primary.icon;

  return (
    <Reveal>
      <section className="relative overflow-hidden rounded-[1.1rem] border border-white/[0.08] bg-[#151a18]">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: primary.accent }} />
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(22rem,.72fr)]">
          <button type="button" onClick={primary.action} className="group flex min-w-0 items-center gap-4 p-5 text-left transition-colors hover:bg-white/[0.025] sm:p-6">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[.9rem] border border-white/10 bg-white/[0.045] text-mint transition-transform duration-control group-hover:scale-105">
              <PrimaryIcon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-mint">
                Continuar de onde parou
                <span className="normal-case tracking-normal text-white/30">{activityAge(primary.createdAt)}</span>
              </span>
              <span className="mt-1.5 block truncate font-display text-xl font-black tracking-[-.025em] sm:text-2xl">{primary.title}</span>
              <span className="mt-1 block truncate text-[12px] font-bold text-white/42">{primary.detail}</span>
            </span>
            <span className="hidden shrink-0 items-center gap-2 text-xs font-black uppercase tracking-[.1em] text-white/45 transition-colors group-hover:text-mint sm:flex">
              Retomar <Play className="h-4 w-4 fill-current" />
            </span>
          </button>

          {items.length > 1 ? (
            <div className="grid border-t border-white/[0.07] sm:grid-cols-2 lg:border-l lg:border-t-0">
              {items.slice(1, 3).map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={item.action}
                    className={`group flex min-w-0 items-center gap-3 p-4 text-left transition-colors hover:bg-white/[0.03] ${index ? "border-t border-white/[0.07] sm:border-l sm:border-t-0" : ""}`}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-white/55 group-hover:text-mint"><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0">
                      <span className="block text-[9px] font-black uppercase tracking-[.14em] text-white/28">{item.kind} · {activityAge(item.createdAt)}</span>
                      <span className="mt-1 block truncate text-[12px] font-black text-white/65 group-hover:text-white">{item.title}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>
    </Reveal>
  );
}

function SubjectCard({
  subject,
  materials,
  index,
  nextTask,
  dueReviews,
  overdueTasks,
}: {
  subject: Subject;
  materials: Material[];
  index: number;
  nextTask?: Task;
  dueReviews: number;
  overdueTasks: number;
}) {
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
            <span className="flex flex-wrap items-center justify-end gap-2">
              {overdueTasks ? <span className="rounded-full border border-amberGlow/25 bg-amberGlow/10 px-2 py-1 text-[9px] font-black uppercase tracking-[.1em] text-amberGlow">{overdueTasks} atrasada{overdueTasks > 1 ? "s" : ""}</span> : null}
              {!overdueTasks && dueReviews ? <span className="rounded-full border border-mint/20 bg-mint/[0.08] px-2 py-1 text-[9px] font-black uppercase tracking-[.1em] text-mint">{dueReviews} revisões</span> : null}
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
            {nextTask || dueReviews ? (
              <p className="mt-2 line-clamp-1 text-[11px] font-bold text-white/38">
                <span className="text-white/60">Próxima ação:</span> {overdueTasks ? nextTask?.title : dueReviews ? `revisar ${dueReviews} ${dueReviews === 1 ? "cartão" : "cartões"}` : nextTask?.title}
              </p>
            ) : null}
            <AnimatedBar value={done} className="mt-4" height={7} from={subject.color} to="#38BDF8" delay={index * 0.05} />
            <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3 text-[12px] font-black uppercase tracking-[.08em] text-white/48 transition-colors duration-control group-hover:text-mint">
              {overdueTasks || dueReviews ? "Revisar agora" : "Abrir matéria"}
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


const taskKindLabel: Record<TaskKind, string> = { prova: "Prova", trabalho: "Trabalho", licao: "Lição", revisao: "Revisão", leitura: "Leitura" };

export function TaskRow({
  task,
  subject,
  toggle,
  remove,
  postpone,
  open,
}: {
  task: Task;
  subject?: Subject;
  toggle: () => void;
  remove?: () => void;
  postpone?: () => void;
  /** Abre o editor ao tocar no texto. Sem ele a linha só marca e desmarca. */
  open?: () => void;
}) {
  const isOverdue = !task.done && task.dueAt < today();
  const reduced = useSoftMotion();
  const steps = task.steps || [];
  const stepsDone = steps.filter((step) => step.done).length;
  const Body = open ? "button" : "div";
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
        onClick={(event) => {
          // Riscar a tarefa rende XP na hora: o número sai voando do visto.
          if (!task.done) cheer(event.currentTarget, xpPerAction.taskDone);
          toggle();
        }}
        whileTap={{ scale: 0.88 }}
        transition={spring.snappy}
        aria-label={task.done ? `Reabrir tarefa ${task.title}` : `Concluir tarefa ${task.title}`}
        aria-pressed={task.done}
        className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors duration-control hover:bg-pen/[0.06]"
      >
        <InkCheck checked={task.done} />
      </motion.button>
      <Body
        {...(open ? { type: "button" as const, onClick: open, "aria-label": `Editar ${task.title}` } : {})}
        className={`min-w-0 flex-1 text-left ${open ? "rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint" : ""}`}
      >
        <p className="flex min-w-0 items-center gap-2 font-black leading-tight">
          {task.priority === "alta" && !task.done ? <span className="agenda-urgent" title="Urgente">!</span> : null}
          <span className={`caderno-strike truncate ${task.done ? "is-struck" : ""}`}>{task.title}</span>
          {task.kind ? <span className={`agenda-kind is-${task.kind}`}>{taskKindLabel[task.kind]}</span> : null}
        </p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-white/45">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: subject?.color || "rgba(255,255,255,.3)" }} />
          <span className="truncate">
            {subject?.name || "Matéria"} · <span className={isOverdue ? "font-black text-amberGlow" : ""}>{dateLabel(task.dueAt)}</span>
            {task.time ? (
              <>
                {" · "}
                <Clock aria-hidden className="mb-0.5 inline h-3 w-3" /> {task.time}
              </>
            ) : null}
            {task.note ? ` · ${task.note}` : ""}
          </span>
          {task.repeat ? <Repeat aria-label={task.repeat === "daily" ? "Repete todo dia" : "Repete toda semana"} className="h-3.5 w-3.5 shrink-0" /> : null}
          {steps.length ? (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 font-mono text-[11px]" title="Passos feitos">
              <ListChecks aria-hidden className="h-3.5 w-3.5" />
              {stepsDone}/{steps.length}
            </span>
          ) : null}
        </p>
      </Body>
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

// Estado do Foco e widget do canto: src/foco/ (focus-store.ts, FocusWidget.tsx).

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
  // A sessão fica guardada no aparelho: trocar de página, recarregar ou ir
  // ver a Agenda não zera mais o cronômetro (relatório de QA de 16/11). O
  // tempo conta pelo horário de término, então também segue certo com a aba
  // em segundo plano.
  const [saved] = useState(() => readFocusState(user.id));
  const [focusMin, setFocusMin] = useState(() => saved?.focusMin ?? Math.min(Math.max(user.settings.focusMinutes || 25, 1), 240));
  const [breakMin, setBreakMin] = useState(() => saved?.breakMin ?? 5);
  const [phase, setPhase] = useState<"focus" | "break">(() => saved?.phase ?? "focus");
  const [longBreak, setLongBreak] = useState(() => saved?.longBreak ?? false);
  const [remaining, setRemaining] = useState(() => (saved ? focusRemainingOf(saved) : focusMin * 60));
  const [running, setRunning] = useState(() => Boolean(saved?.running));
  const [cycles, setCycles] = useState(() => saved?.cycles ?? 0);
  const [subjectId, setSubjectId] = useState<string | undefined>(() => (saved?.subjectId && subjects.some((item) => item.id === saved.subjectId) ? saved.subjectId : subjects[0]?.id));
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * focusTips.length));
  const timerRef = useRef<HTMLDivElement | null>(null);
  const endsAtRef = useRef<number | null>(saved?.running && saved.endsAt ? saved.endsAt : null);

  useEffect(() => {
    if (running && endsAtRef.current === null) endsAtRef.current = Date.now() + remaining * 1000;
    if (!running) endsAtRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => {
    if (!running || remaining <= 0) return;
    const timer = setTimeout(() => {
      const endsAt = endsAtRef.current;
      setRemaining((value) => (endsAt ? Math.max(0, Math.round((endsAt - Date.now()) / 1000)) : value - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [running, remaining]);

  useEffect(() => {
    writeFocusState(user.id, {
      phase,
      longBreak,
      cycles,
      focusMin,
      breakMin,
      subjectId,
      running,
      endsAt: running ? endsAtRef.current ?? Date.now() + remaining * 1000 : undefined,
      remaining,
    });
  }, [user.id, phase, longBreak, cycles, focusMin, breakMin, subjectId, running, remaining]);

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
      // Fim de sessão: confete saindo do lápis, +25 XP e a Mine comemorando.
      celebrateFrom(timerRef.current, { count: 60, spread: 1.4 });
      floatXp(`+${xpPerAction.focus} XP`, timerRef.current);
      mineSays(isLong ? "4 ciclos! Hora da pausa longa!" : "Sessão concluída! Respira um pouco.", "wow");
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
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

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

                <div ref={timerRef} className="w-full max-w-[36rem]">
                  <PencilTimer
                    fraction={fraction}
                    running={running}
                    phase={phase}
                    reduced={reducedFocusMotion}
                    label={`${phase === "focus" ? "Foco" : "Pausa"}: faltam ${minutes} minutos e ${seconds} segundos`}
                  />
                  <div className="mt-2 text-center">
                    <p className="caderno-timer-digits tabular" aria-live="off">
                      {String(minutes).padStart(2, "0")}
                      <span className={running ? "caderno-colon is-ticking" : "caderno-colon"}>:</span>
                      {String(seconds).padStart(2, "0")}
                    </p>
                    <p className="caderno-note mt-1 !text-[1.35rem]">
                      {phase === "focus" ? (running ? "escrevendo…" : "lápis apontado") : longBreak ? "pausa longa merecida" : "hora do café"}
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
                          tasks: setTaskDone(draft.tasks, task.id, undefined),
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
export const achievementIcons: Record<string, LucideIcon> = {
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
  "arte-1": Palette,
  "arte-10": Star,
  "idioma-1": Languages,
  "idioma-12": Globe,
  "lab-1": FlaskConical,
  "lab-12": Rocket,
  "leitura-1": BookOpen,
  "leitura-10": Brain,
  "duelo-1": Swords,
  "duelo-10": Trophy,
  "video-1": MonitorPlay,
  "video-10": Clapperboard,
};

function buildAchievements(stats: XpStats): Achievement[] {
  return achievementList.map((rule) => ({
    ...rule,
    icon: achievementIcons[rule.id] || Sparkles,
    value: stats[rule.stat],
  }));
}

export function gamificationOf(data: ReturnType<typeof useMemoUserData>) {
  const stats = scopeStats(data);
  const achievements = buildAchievements(stats);
  const unlocked = unlockedAchievements(stats);
  const xp = totalXp(stats);
  return { stats, achievements, unlocked, xp, ...levelFromXp(xp) };
}

function WeeklyStudyReport({ data, dailyGoal }: { data: ReturnType<typeof useMemoUserData>; dailyGoal: number }) {
  const start = today() - 6 * 86400000;
  const previousStart = today() - 13 * 86400000;
  const weekSessions = data.sessions.filter((item) => item.createdAt >= start);
  const previousSessions = data.sessions.filter((item) => item.createdAt >= previousStart && item.createdAt < start);
  const weekFocus = focusMinutes(weekSessions);
  const previousFocus = focusMinutes(previousSessions);
  const focusDelta = weekFocus - previousFocus;
  const activeDays = new Set(weekSessions.map((item) => new Date(item.createdAt).toDateString())).size;
  const completedTasks = data.tasks.filter((item) => item.doneAt && item.doneAt >= start).length;
  const studiedMaterials = data.materials.filter((item) => item.studiedAt && item.studiedAt >= start).length;
  const answered = weekSessions.reduce((sum, item) => sum + (item.questionsAnswered || 0), 0);
  const correct = weekSessions.reduce((sum, item) => sum + (item.correctAnswers || 0), 0);
  const accuracy = answered ? percent(correct, answered) : undefined;
  const target = Math.max(1, dailyGoal * 7);

  const subjectActivity = data.subjects
    .map((subject) => {
      const sessions = weekSessions.filter((item) => item.subjectId === subject.id).length;
      const studied = data.materials.filter((item) => item.subjectId === subject.id && item.studiedAt && item.studiedAt >= start).length;
      const open = data.tasks.filter((item) => item.subjectId === subject.id && !item.done).length;
      const overdue = data.tasks.filter((item) => item.subjectId === subject.id && !item.done && item.dueAt < today()).length;
      const reviews = data.flashcards.filter((item) => item.subjectId === subject.id && item.dueAt <= Date.now()).length;
      return { subject, score: sessions * 2 + studied, sessions, studied, open, overdue, reviews, attention: overdue * 20 + reviews * 3 + open };
    });
  const strongest = subjectActivity.slice().sort((a, b) => b.score - a.score)[0];
  const attention = subjectActivity.filter((item) => item.attention > 0).sort((a, b) => b.attention - a.attention)[0];
  const rangeLabel = `${shortDate(start)} — ${shortDate(today())}`;

  return (
    <Reveal delay={0.04}>
      <section className="overflow-hidden rounded-[1.2rem] border border-white/[0.08] bg-[rgb(var(--sheet))]">
        <header className="flex flex-col gap-3 border-b border-white/[0.08] px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-mint"><TrendingUp className="h-3.5 w-3.5" /> Relatório da semana</p>
            <h2 className="mt-1.5 font-display text-2xl font-black tracking-[-.035em]">Seu estudo virou decisões para a próxima semana.</h2>
          </div>
          <span className="shrink-0 text-[11px] font-bold tabular text-white/34">{rangeLabel}</span>
        </header>

        <div className="grid lg:grid-cols-[1.1fr_.9fr]">
          <div className="border-b border-white/[0.07] p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.15em] text-white/34">Tempo de foco</p>
                <p className="mt-2 font-display text-4xl font-black tabular tracking-[-.05em]">{humanMinutes(weekFocus)}</p>
                <p className={`mt-1 text-xs font-black ${focusDelta > 0 ? "text-mint" : focusDelta < 0 ? "text-amberGlow" : "text-white/38"}`}>
                  {focusDelta > 0 ? `+${humanMinutes(focusDelta)} vs. semana anterior` : focusDelta < 0 ? `${humanMinutes(Math.abs(focusDelta))} a menos que a anterior` : "Mesmo ritmo da semana anterior"}
                </p>
              </div>
              <ProgressRing value={percent(weekFocus, target)} size={104} stroke={8} label={<span className="text-lg font-black tabular">{percent(weekFocus, target)}%</span>} sublabel="da meta" />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-4">
              {[
                [activeDays, "dias ativos"],
                [completedTasks, "tarefas feitas"],
                [studiedMaterials, "conteúdos"],
                [accuracy === undefined ? "—" : `${accuracy}%`, "acerto"],
              ].map(([value, label]) => (
                <div key={String(label)} className="bg-[rgb(var(--panel))] p-3.5">
                  <p className="font-display text-xl font-black tabular">{value}</p>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-[.11em] text-white/30">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid content-start gap-2 p-5 sm:p-6">
            <p className="mb-1 text-[10px] font-black uppercase tracking-[.16em] text-white/34">Leitura da Mine</p>
            {strongest && strongest.score > 0 ? (
              <button type="button" onClick={() => go("subject", strongest.subject.id)} className="group flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5 text-left transition hover:border-mint/25 hover:bg-mint/[0.055]">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint/10 text-mint"><TrendingUp className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-[10px] font-black uppercase tracking-[.12em] text-mint">Mais avançou</span><span className="mt-1 block text-sm font-black text-white/75">{strongest.subject.name}</span><span className="mt-0.5 block text-[11px] text-white/35">{strongest.sessions} sessões · {strongest.studied} conteúdos estudados</span></span>
                <ArrowRight className="mt-2 h-4 w-4 text-white/20 group-hover:text-mint" />
              </button>
            ) : (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5 text-xs leading-relaxed text-white/38">Faça uma sessão ou marque um conteúdo para o relatório identificar seu avanço.</div>
            )}

            {attention ? (
              <button type="button" onClick={() => go("subject", attention.subject.id)} className="group flex items-start gap-3 rounded-xl border border-amberGlow/15 bg-amberGlow/[0.035] p-3.5 text-left transition hover:border-amberGlow/30 hover:bg-amberGlow/[0.065]">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amberGlow/10 text-amberGlow"><Target className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-[10px] font-black uppercase tracking-[.12em] text-amberGlow">Pede atenção</span><span className="mt-1 block text-sm font-black text-white/75">{attention.subject.name}</span><span className="mt-0.5 block text-[11px] text-white/35">{[
                  attention.overdue ? `${attention.overdue} ${attention.overdue === 1 ? "tarefa atrasada" : "tarefas atrasadas"}` : "",
                  attention.reviews ? `${attention.reviews} ${attention.reviews === 1 ? "revisão" : "revisões"}` : "",
                  attention.open ? `${attention.open} ${attention.open === 1 ? "tarefa aberta" : "tarefas abertas"}` : "",
                ].filter(Boolean).join(" · ")}</span></span>
                <ArrowRight className="mt-2 h-4 w-4 text-white/20 group-hover:text-amberGlow" />
              </button>
            ) : null}

            <button type="button" onClick={() => go("foco")} className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-mint px-4 text-sm font-black text-black shadow-glowSoft transition hover:-translate-y-0.5 hover:shadow-glow"><Timer className="h-4 w-4" /> Começar próxima sessão</button>
          </div>
        </div>
      </section>
    </Reveal>
  );
}

function ProgressView({ data, user }: { data: ReturnType<typeof useMemoUserData>; user: User }) {
  const gam = gamificationOf(data);
  const reducedProgress = useSoftMotion();
  const missing = gam.levelNeed - gam.levelXp;
  return (
    <>
      <PageHeader
        eyebrow="Progresso e conquistas"
        title={`Nível ${gam.level}`}
        subtitle={`${gam.title} · faltam ${missing} XP para o próximo nível.`}
        action={<PrimaryButton icon={Share2} onClick={() => window.dispatchEvent(new Event("minerva:conquista"))}>Minha carteirinha</PrimaryButton>}
      />
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
                <LevelStamp level={gam.level} title={gam.title} reduced={reducedProgress} />
                <p className="caderno-hand mt-1 text-center text-lg">
                  <CountUp value={gam.levelXp} />/{gam.levelNeed} XP no nível
                </p>
              </div>
            </div>
          </HeroCard>
        </Reveal>

        <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" gap={0.07}>
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

        <WeeklyStudyReport data={data} dailyGoal={user.settings.dailyGoal} />

        <div className="grid gap-5 xl:grid-cols-2">
          <Reveal delay={0.06}>
            <GlassCard className="h-full">
              <SectionTitle icon={Activity} title="Atividade semanal" hint={`meta diária: ${user.settings.dailyGoal} min`} />
              <InkBarChart bars={weeklyBars(data.sessions)} reduced={reducedProgress} />
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
                        {done ? <InkCheck checked /> : <Lock className="h-5 w-5 shrink-0 text-white/25" />}
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
            <StickerBook items={gam.achievements} reduced={reducedProgress} />
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

// Cores de caneta e marca-texto: legíveis no papel claro e no caderno escuro.
export const mindmapChatPalette = ["#1FA870", "#2F7FE0", "#E0A100", "#E5486B", "#8A63E8", "#F07A2B"];
const mindmapPreviewPaths = [
  "M 218 108 C 183 108, 170 48, 116 48",
  "M 302 108 C 337 108, 350 48, 404 48",
  "M 218 115 C 172 115, 150 115, 100 115",
  "M 302 115 C 348 115, 370 115, 420 115",
  "M 218 122 C 183 122, 170 182, 116 182",
  "M 302 122 C 337 122, 350 182, 404 182",
];
const mindmapPreviewPositions = [
  { left: "2%", top: "8%" },
  { left: "72%", top: "8%" },
  { left: "0%", top: "41%" },
  { left: "74%", top: "41%" },
  { left: "2%", top: "74%" },
  { left: "72%", top: "74%" },
];

function MindmapBuildPreview({ topic, reduceMotion }: { topic: string; reduceMotion: boolean }) {
  const buildLabels = ["Tema", "Conceitos", "Relações", "Revisão", "Exemplos", "Síntese"];
  return (
    <motion.article
      className="flex items-start gap-3 sm:gap-4"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <span className="mt-5"><MineAvatar size="sm" /></span>
      <div className="mine-mindmap-build max-w-[calc(100%-2.75rem)] flex-1 sm:max-w-[min(49rem,calc(100%-3.25rem))]" aria-live="polite">
        <div className="mine-mindmap-build__header">
          <span><Sparkles className="h-3.5 w-3.5" />Construindo mapa mental</span>
          <small>Organizando o conhecimento</small>
        </div>
        <div className="mine-mindmap-preview-canvas is-building" aria-hidden>
          <svg viewBox="0 0 520 230" preserveAspectRatio="none">
            {mindmapPreviewPaths.map((path, index) => (
              <path key={path} d={path} style={{ "--map-delay": `${index * 0.16}s` } as React.CSSProperties} />
            ))}
          </svg>
          <div className="mine-mindmap-preview-core">
            <Brain className="h-4 w-4" />
            <span>Tema central</span>
            <strong>{topic}</strong>
          </div>
          {buildLabels.map((label, index) => (
            <span
              key={label}
              className="mine-mindmap-build-node"
              style={{ ...mindmapPreviewPositions[index], "--map-color": mindmapChatPalette[index], "--map-delay": `${index * 0.16}s` } as React.CSSProperties}
            >
              <i />{label}
            </span>
          ))}
        </div>
        <div className="mine-mindmap-build__footer">
          <span className="is-active"><i />Analisando</span>
          <span><i />Conectando</span>
          <span><i />Finalizando</span>
        </div>
      </div>
    </motion.article>
  );
}

function MindmapChatPreview({ map, onOpen }: { map: Mindmap; onOpen: () => void }) {
  const branches = map.branches.slice(0, 6);
  const conceptCount = map.branches.reduce((sum, branch) => sum + branch.items.length, 0);
  return (
    <button type="button" onClick={onOpen} className="mine-mindmap-card group/map" aria-label={`Abrir mapa mental de ${map.title}`}>
      <div className="mine-mindmap-card__topline">
        <span><Brain className="h-3.5 w-3.5" />Mapa mental interativo</span>
        <span>Toque para explorar <ArrowRight className="h-3.5 w-3.5" /></span>
      </div>
      <div className="mine-mindmap-preview-canvas is-ready" aria-hidden>
        <svg viewBox="0 0 520 230" preserveAspectRatio="none">
          {branches.map((_, index) => <path key={mindmapPreviewPaths[index]} d={mindmapPreviewPaths[index]} style={{ stroke: mindmapChatPalette[index] }} />)}
        </svg>
        <div className="mine-mindmap-preview-core">
          <Brain className="h-4 w-4" />
          <span>Tema central</span>
          <strong>{map.title || "Mapa mental"}</strong>
        </div>
        {branches.map((branch, index) => (
          <span
            key={`${branch.label}-${index}`}
            className="mine-mindmap-ready-node"
            style={{ ...mindmapPreviewPositions[index], "--map-color": mindmapChatPalette[index] } as React.CSSProperties}
          >
            <strong>{branch.label}</strong>
            <small>{branch.items.length} conexões</small>
          </span>
        ))}
      </div>
      <div className="mine-mindmap-card__footer">
        <span>{map.branches.length} ramos</span>
        <i />
        <span>{conceptCount} conceitos</span>
        <strong>Abrir mapa <ChevronRight className="h-4 w-4" /></strong>
      </div>
    </button>
  );
}

/**
 * Espera da prova e do baralho.
 *
 * O mapa mental tem a própria animação porque o desenho dele já é a prévia.
 * Prova e baralho não têm forma para antecipar, então aqui a espera é honesta:
 * diz o que está sendo montado e não finge um resultado que ainda não existe.
 */
function ArtifactBuildPreview({ kind, topic }: { kind: "quiz" | "deck"; topic: string }) {
  const Icon = kind === "quiz" ? ClipboardCheck : Layers;
  const label = kind === "quiz" ? "Montando sua prova" : "Criando seus flashcards";
  const etapas = kind === "quiz" ? ["Lendo o conteúdo", "Escrevendo questões", "Conferindo o gabarito"] : ["Lendo o conteúdo", "Separando conceitos", "Escrevendo os cartões"];
  return (
    <div className="flex items-start gap-3 sm:gap-4">
      <span className="mt-5"><MineAvatar size="sm" /></span>
      <div className="mine-artifact-build max-w-[calc(100%-2.75rem)] flex-1 sm:max-w-[min(49rem,calc(100%-3.25rem))]" aria-live="polite">
        <p className="mine-artifact-build__title">
          <Icon className="h-4 w-4 shrink-0 text-pen" aria-hidden="true" />
          <span>{label} de {topic}…</span>
        </p>
        <ol className="mine-artifact-build__steps">
          {etapas.map((etapa, index) => (
            <li key={etapa} style={{ animationDelay: `${index * 0.4}s` }}>{etapa}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

const quizCountOptions = [5, 10, 15] as const;
const quizDifficultyOptions: Array<{ id: QuizDifficulty; label: string }> = [
  { id: "facil", label: "Fácil" },
  { id: "medio", label: "Média" },
  { id: "dificil", label: "Difícil" },
];
const quizModeOptions: Array<{ id: QuizMode; label: string; hint: string }> = [
  { id: "treino", label: "Treino", hint: "gabarito a cada questão" },
  { id: "prova", label: "Prova", hint: "resultado só no fim" },
];

/**
 * Cartão de configuração da prova, dentro da conversa.
 *
 * Fica no chat em vez de numa tela à parte porque quem pediu a prova já está
 * aqui — mandar a pessoa para um modal de ajustes antes de ver qualquer coisa
 * quebra o ritmo da conversa. Depois de respondido o cartão trava e passa a
 * mostrar a escolha, para a conversa continuar legível quando for reaberta.
 */
function QuizSetupCard({
  setup,
  padroes,
  onCreate,
}: {
  setup: ChatQuizSetup;
  padroes: { count: number; difficulty: QuizDifficulty };
  onCreate: (escolha: { count: number; difficulty: QuizDifficulty; mode: QuizMode }) => void;
}) {
  const [count, setCount] = useState<number>(padroes.count);
  const [difficulty, setDifficulty] = useState<QuizDifficulty>(padroes.difficulty);
  const [mode, setMode] = useState<QuizMode>("treino");
  const respondido = setup.respondidoEm;

  if (respondido) {
    const nomeDificuldade = quizDifficultyOptions.find((item) => item.id === respondido.difficulty)?.label || "Média";
    const nomeModo = quizModeOptions.find((item) => item.id === respondido.mode)?.label || "Treino";
    return (
      <p className="mine-quiz-setup is-done">
        <ClipboardCheck className="h-4 w-4 shrink-0 text-pen" aria-hidden="true" />
        <span>
          {respondido.count} questões · {nomeDificuldade} · {nomeModo}
        </span>
      </p>
    );
  }

  return (
    <div className="mine-quiz-setup">
      <p className="mine-quiz-setup__title">
        <ClipboardCheck className="h-4 w-4 shrink-0 text-pen" aria-hidden="true" />
        <span>Como você quer a prova de {setup.topic}?</span>
      </p>

      <fieldset className="mine-quiz-setup__row">
        <legend>Questões</legend>
        {quizCountOptions.map((value) => (
          <button key={value} type="button" onClick={() => setCount(value)} aria-pressed={count === value} className="mine-quiz-chip">
            {value}
          </button>
        ))}
      </fieldset>

      <fieldset className="mine-quiz-setup__row">
        <legend>Dificuldade</legend>
        {quizDifficultyOptions.map((item) => (
          <button key={item.id} type="button" onClick={() => setDifficulty(item.id)} aria-pressed={difficulty === item.id} className="mine-quiz-chip">
            {item.label}
          </button>
        ))}
      </fieldset>

      <fieldset className="mine-quiz-setup__row">
        <legend>Formato</legend>
        {quizModeOptions.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMode(item.id)}
            aria-pressed={mode === item.id}
            title={item.hint}
            className="mine-quiz-chip"
          >
            {item.label}
          </button>
        ))}
      </fieldset>

      <button type="button" onClick={() => onCreate({ count, difficulty, mode })} className="mine-quiz-setup__cta">
        Criar prova
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Prova pronta na conversa. Abre o Modo prova já com as questões geradas. */
function QuizChatPreview({ quiz, onOpen }: { quiz: ChatQuiz; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="mine-artifact-card" aria-label={`Abrir prova de ${quiz.title}`}>
      <span className="mine-artifact-card__icon" style={{ "--artifact-color": "#FBBF24" } as React.CSSProperties}>
        <ClipboardCheck className="h-5 w-5" />
      </span>
      <span className="mine-artifact-card__body">
        <strong>Prova de {quiz.title}</strong>
        <small>
          {quiz.questions.length} questões · {quiz.mode === "treino" ? "treino guiado" : "simulado real"}
        </small>
      </span>
      <span className="mine-artifact-card__cta">
        Começar
        <ChevronRight className="h-4 w-4" />
      </span>
    </button>
  );
}

const actionLooks: Record<ChatAction["kind"], { icon: typeof BookOpen; color: string }> = {
  salvar: { icon: FileText, color: "#34D399" },
  agenda: { icon: CalendarDays, color: "#F472B6" },
  duelo: { icon: Swords, color: "#F87171" },
  atividade: { icon: ClipboardList, color: "#FBBF24" },
  redacao: { icon: PenLine, color: "#A78BFA" },
  leitura: { icon: BookOpen, color: "#38BDF8" },
  videos: { icon: MonitorPlay, color: "#5CE1E6" },
  "fotos-zip": { icon: Download, color: "#2FD483" },
};

/** Ação feita pelo chat. O toque leva ao resultado (e preenche a aba de novo). */
function ActionChatPreview({ action }: { action: ChatAction }) {
  const look = actionLooks[action.kind] || actionLooks.salvar;
  const Icon = look.icon;
  return (
    <button
      type="button"
      onClick={() => {
        if (action.rota !== "subject" && action.rota !== "agenda") deixarPreset(action.rota, action.preset || {});
        go(action.rota, action.id);
      }}
      className="mine-artifact-card"
      aria-label={`${action.cta}: ${action.titulo}`}
    >
      <span className="mine-artifact-card__icon" style={{ "--artifact-color": look.color } as React.CSSProperties}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="mine-artifact-card__body">
        <strong>{action.titulo}</strong>
        <small>{action.detalhe}</small>
      </span>
      <span className="mine-artifact-card__cta">
        {action.cta}
        <ChevronRight className="h-4 w-4" />
      </span>
    </button>
  );
}

/** Baralho pronto na conversa. Abre a revisão espaçada da matéria. */
function DeckChatPreview({ deck, onOpen }: { deck: ChatDeck; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="mine-artifact-card" aria-label={`Revisar flashcards de ${deck.title}`}>
      <span className="mine-artifact-card__icon" style={{ "--artifact-color": "#38BDF8" } as React.CSSProperties}>
        <Layers className="h-5 w-5" />
      </span>
      <span className="mine-artifact-card__body">
        <strong>{deck.total} flashcards de {deck.title}</strong>
        <small>{deck.subjectCriada ? "matéria criada agora · na revisão espaçada" : "salvos na revisão espaçada"}</small>
      </span>
      <span className="mine-artifact-card__cta">
        Revisar
        <ChevronRight className="h-4 w-4" />
      </span>
    </button>
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
/**
 * Pergunta do estudante, com edição no próprio balão.
 *
 * Editar reenvia a pergunta e refaz a conversa dali para frente — o mesmo que
 * os chats de IA fazem, e o aviso embaixo do campo diz isso antes do clique.
 */
function MineUserQuestion({ message, busy, onEdit }: { message: ChatMessage; busy: boolean; onEdit: (message: ChatMessage, text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text);
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) return;
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 220)}px`;
  }, [editing]);

  function submit() {
    const text = draft.trim();
    if (!text || busy) return;
    setEditing(false);
    onEdit(message, text);
  }

  if (editing) {
    return (
      <form
        className="mine-edit"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={fieldRef}
          value={draft}
          aria-label="Editar pergunta"
          onChange={(event) => {
            setDraft(event.target.value);
            event.target.style.height = "auto";
            event.target.style.height = `${Math.min(event.target.scrollHeight, 220)}px`;
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setDraft(message.text);
              setEditing(false);
            } else if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <p className="mine-edit__hint">As respostas depois desta pergunta serão refeitas.</p>
        <div className="mine-edit__actions">
          <button
            type="button"
            onClick={() => {
              setDraft(message.text);
              setEditing(false);
            }}
            className="mine-edit__cancel"
          >
            Cancelar
          </button>
          <button type="submit" disabled={!draft.trim() || busy} className="mine-edit__send">
            Enviar de novo
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      <p className="whitespace-pre-line">{message.text}</p>
      <button
        type="button"
        className="mine-edit-trigger"
        onClick={() => {
          setDraft(message.text);
          setEditing(true);
        }}
        disabled={busy}
        aria-label="Editar pergunta"
        title="Editar e enviar de novo"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </>
  );
}

const MineMessageList = React.memo(function MineMessageList({
  messages,
  reduceMotion,
  subjectId,
  busy,
  onRegenerate,
  onEdit,
  onFollowUp,
  onSave,
  onOpenMindmap,
  onCreateQuiz,
  onOpenQuiz,
  onOpenDeck,
  onFeedback,
  onShowVersion,
  onBranch,
  onExplainTwoWays,
}: {
  onBranch: (message: ChatMessage) => void;
  onExplainTwoWays: (message: ChatMessage) => void;
  messages: ChatMessage[];
  reduceMotion: boolean;
  subjectId?: string;
  busy: boolean;
  onFeedback: (message: ChatMessage, value: "up" | "down") => void;
  onShowVersion: (message: ChatMessage, target: number) => void;
  onRegenerate: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage, text: string) => void;
  onFollowUp: (prompt: string) => void;
  onSave: (text: string, subjectId: string) => void;
  onOpenMindmap: (message: ChatMessage) => void;
  onCreateQuiz: (message: ChatMessage, escolha: { count: number; difficulty: QuizDifficulty; mode: QuizMode }) => void;
  onOpenQuiz: (message: ChatMessage) => void;
  onOpenDeck: (message: ChatMessage) => void;
}) {
  const lastId = messages[messages.length - 1]?.id;
  // Conversa antiga abre parada: animar dezenas de mensagens ao trocar de
  // conversa era o "tremido" do chat. Só entra animada a mensagem recém-criada
  // — e a resposta da Mine não, porque ela já estava na tela, sendo escrita.
  const fresh = (message: ChatMessage) => Date.now() - message.createdAt < 4000;
  // Pergunta que veio logo antes de cada resposta: as setas de versão de um
  // "refazer" ficam na resposta, porque a pergunta não mudou.
  const questionBefore = new Map<string, ChatMessage>();
  let lastQuestion: ChatMessage | undefined;
  for (const message of messages) {
    if (message.role === "user") lastQuestion = message;
    else if (lastQuestion) questionBefore.set(message.id, lastQuestion);
  }
  return (
    <>
      {messages.map((message) => (
        <motion.article
          key={message.id}
          initial={
            reduceMotion || !fresh(message)
              ? false
              : message.role === "user"
                ? { opacity: 0, y: 26, rotate: 3, scale: 0.94 }
                : { opacity: 1 }
          }
          animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 26 }}
          data-msg-id={message.id}
          className={`group/message mine-gpt-message flex items-start gap-3 sm:gap-4 ${message.role === "user" ? "justify-end is-user" : "justify-start is-mine"} ${fresh(message) && message.role === "mine" ? "is-fresh" : ""}`}
        >
          {/* Sem avatar na resposta: o texto usa a coluna inteira, como no ChatGPT. */}
          {/* No celular o balão usa quase toda a largura: com 86% sobrava uma
              faixa morta à direita e o texto quebrava a cada três palavras. */}
          <div
            title={message.role === "user" ? timeLabel(message.createdAt) : undefined}
            className={`mine-gpt-message-body relative min-w-0 text-[15px] leading-[1.72] sm:text-[15.5px] sm:leading-7 ${
              message.role === "user"
                ? "max-w-[88%] rounded-[1.4rem] bg-white/[0.09] px-4 py-2.5 text-white/90 sm:max-w-[74%] sm:px-5 sm:py-3"
                : "w-full max-w-full flex-1 px-1 py-1 text-white/82  sm:px-2 sm:py-1.5"
            }`}
          >
            <div className={`mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em] ${message.role === "user" ? "hidden justify-end text-mint/75" : "text-white/38"}`}>
              <span>{message.role === "user" ? "Você" : "Mine"}</span>
              {message.role === "mine" && message.tutor ? <span className="mine-tutor-badge">Tutor</span> : null}
              {message.role === "user" ? <span className="font-bold normal-case tracking-normal text-white/28">{timeLabel(message.createdAt)}</span> : null}
            </div>
            {message.role === "user" ? (
              <>
                <MineUserQuestion message={message} busy={busy} onEdit={onEdit} />
                {(() => {
                  const info = versionInfo(message);
                  return info && !info.sameQuestion ? (
                    <div className="mine-user-version">
                      <VersionSwitch index={info.index} total={info.total} disabled={busy} onChange={(target) => onShowVersion(message, target)} />
                    </div>
                  ) : null;
                })()}
              </>
            ) : (
              <>
                <MineThought reasoning={message.reasoning} seconds={message.reasoning ? message.thoughtSeconds : undefined} />
                <MineSourcesProvider sources={message.sources} queries={message.queries}>
                  <MineCamadas message={message} attachment={questionBefore.get(message.id)?.attachments?.find((item) => item.kind === "image" && item.dataUrl)?.dataUrl} />
                </MineSourcesProvider>
              </>
            )}
            {message.role === "mine" && message.mindmap ? <MindmapChatPreview map={message.mindmap} onOpen={() => onOpenMindmap(message)} /> : null}
            {message.role === "mine" && message.quizSetup ? (
              <QuizSetupCard
                setup={message.quizSetup}
                padroes={message.quizSetup.padrao || { count: 5, difficulty: "medio" }}
                onCreate={(escolha) => onCreateQuiz(message, escolha)}
              />
            ) : null}
            {message.role === "mine" && message.quiz ? <QuizChatPreview quiz={message.quiz} onOpen={() => onOpenQuiz(message)} /> : null}
            {message.role === "mine" && message.deck ? <DeckChatPreview deck={message.deck} onOpen={() => onOpenDeck(message)} /> : null}
            {message.role === "mine" && message.action ? <ActionChatPreview action={message.action} /> : null}
            <ChatAttachments attachments={message.attachments} tone={message.role === "user" ? "user" : "dark"} />
            {message.role !== "user" && message.visits?.length ? <MineControleVisits visits={message.visits} /> : null}
            {message.role !== "user" ? <MineSourcesButton sources={message.sources} queries={message.queries} /> : null}
            {message.role !== "user" ? (
              (() => {
                const question = questionBefore.get(message.id);
                const info = question ? versionInfo(question) : null;
                return (
                  <MineAnswerActions
                    // O pedido de foto é instrução para a tela, não texto da
                    // resposta: copiar, ouvir ou salvar leva só o que a Mine escreveu.
                    text={stripImageMarkers(message.text)}
                    feedback={message.feedback}
                    busy={busy}
                    canRegenerate={message.id === lastId && Boolean(question)}
                    version={info?.sameQuestion ? info : null}
                    onVersion={question ? (target) => onShowVersion(question, target) : undefined}
                    onFeedback={(value) => onFeedback(message, value)}
                    onRegenerate={() => onRegenerate(message)}
                    onExplain={() => onFollowUp("Explique de outro jeito, com um exemplo simples e prático.")}
                    // "Traga" e não "Crie questões": este botão continua sendo
                    // uma resposta em texto sobre o que a Mine acabou de dizer,
                    // e o gatilho de prova não enxerga a conversa — ele criaria
                    // uma prova sobre a frase do próprio botão. Para uma prova
                    // de verdade existe "Monte uma prova de <matéria>".
                    onPractice={() => onFollowUp("Traga 5 exercícios de prática sobre o assunto da sua resposta anterior, com gabarito comentado.")}
                    onSave={subjectId ? () => onSave(stripImageMarkers(message.text), subjectId) : undefined}
                  />
                );
              })()
            ) : null}
            {message.role !== "user" && message.incompleta && message.id === lastId && !busy ? (
              <button type="button" className="mine-continuar" onClick={() => onFollowUp("Continue exatamente de onde você parou, sem repetir o que já escreveu.")}>
                <ChevronRight aria-hidden className="h-4 w-4" /> Continuar daqui
              </button>
            ) : null}
            {message.role !== "user" && !busy && message.text.length > 200 ? (
              <div className="mine-extra-acoes">
                <button type="button" onClick={() => onExplainTwoWays(message)} title="Duas versões lado a lado: analogia e técnica">
                  <Split aria-hidden className="h-3.5 w-3.5" /> Explicar de dois jeitos
                </button>
                <button type="button" onClick={() => onBranch(message)} title="Abre uma conversa nova com tudo até aqui">
                  <GitBranch aria-hidden className="h-3.5 w-3.5" /> Continuar numa conversa nova
                </button>
              </div>
            ) : null}
          </div>
        </motion.article>
      ))}
    </>
  );
});

/**
 * Conversas de uma matéria, da mais recente para a mais antiga.
 *
 * Apagar pede confirmação no próprio item (o ícone vira "Apagar?" por alguns
 * segundos) em vez de um modal: é uma ação rara, e o modal cobriria justamente
 * a lista onde a pessoa estava olhando.
 */
function MineThreadList({
  threads,
  activeId,
  activeIsNew,
  onSelect,
  onDelete,
  disabled,
  chats,
  subjects,
  subjectId,
  onOpenThread,
  onTogglePin,
}: {
  threads: ChatThread[];
  activeId?: string;
  activeIsNew: boolean;
  onSelect: (threadId: string | undefined) => void;
  onDelete: (threadId: string | undefined) => void;
  disabled: boolean;
  /** Busca em todas as conversas (nov/2026): todas as mensagens e matérias. */
  chats: ChatMessage[];
  subjects: Subject[];
  subjectId?: string;
  onOpenThread: (subjectId: string | undefined, threadId: string | undefined) => void;
  onTogglePin: (threadId: string | undefined) => void;
}) {
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!confirmKey) return;
    const timer = window.setTimeout(() => setConfirmKey(null), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmKey]);
  const searching = query.trim().length >= 2;
  const hits = useMemo(() => (searching ? searchConversations(chats, query) : []), [chats, query, searching]);
  const subjectName = (id?: string) => subjects.find((item) => item.id === id)?.name || "Estudos gerais";

  const search = (
    <label className="mine-thread-search">
      <Search className="h-3.5 w-3.5" aria-hidden />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setQuery("");
        }}
        placeholder="Buscar em todas as conversas"
        aria-label="Buscar em todas as conversas"
      />
    </label>
  );

  if (searching) {
    return (
      <div className="mine-thread-panel">
        {search}
        {hits.length ? (
          <ul className="mine-threads minerva-scroll" aria-label={`${hits.length} conversas encontradas`}>
            {hits.map((hit) => {
              const active = (hit.subjectId || undefined) === (subjectId || undefined) && (hit.threadId || undefined) === (activeId || undefined) && !activeIsNew;
              return (
                <li key={`${hit.subjectId || ""}::${hit.threadId || ""}`} className="mine-thread-row">
                  <button
                    type="button"
                    className={`mine-thread is-hit ${active ? "is-active" : ""}`}
                    disabled={disabled && !active}
                    onClick={() => {
                      onOpenThread(hit.subjectId, hit.threadId);
                      setQuery("");
                    }}
                  >
                    <span className="mine-thread__icon">{hit.pinned ? <Pin className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}</span>
                    <span className="mine-thread__text">
                      <span className="mine-thread__title">
                        <InkMark text={hit.title} query={query.trim().split(/\s+/)[0]} />
                      </span>
                      {hit.snippet ? (
                        <span className="mine-thread__snippet">
                          <InkMark text={hit.snippet} query={query.trim().split(/\s+/)[0]} />
                        </span>
                      ) : null}
                      <span className="mine-thread__meta">
                        {subjectName(hit.subjectId)} · {activityAge(hit.updatedAt)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mine-thread-empty">Nada encontrado para “{query.trim()}” nas suas conversas.</p>
        )}
      </div>
    );
  }

  if (!threads.length && !activeIsNew) {
    return (
      <div className="mine-thread-panel">
        {chats.length ? search : null}
        <p className="mine-thread-empty">As conversas desta matéria vão aparecer aqui.</p>
      </div>
    );
  }

  // Agrupada por data, como no ChatGPT: fixadas no topo, depois Hoje, Ontem...
  const grupos = groupThreadsByDate(threads);

  const linha = (thread: ChatThread) => {
    const key = thread.id || "__principal__";
    const active = !activeIsNew && (thread.id || undefined) === (activeId || undefined);
    const confirming = confirmKey === key;
    return (
      <li key={key} className={`mine-thread-row ${thread.pinned ? "is-pinned" : ""} ${confirming ? "is-confirming" : ""}`}>
        <button
          type="button"
          className={`mine-thread ${active ? "is-active" : ""}`}
          aria-current={active ? "true" : undefined}
          disabled={disabled && !active}
          onClick={() => onSelect(thread.id)}
          title={`${thread.title} · ${activityAge(thread.updatedAt)} · ${thread.count} ${thread.count === 1 ? "mensagem" : "mensagens"}`}
        >
          <span className="mine-thread__title">{thread.title}</span>
        </button>
        <span className="mine-thread__tools">
          <button
            type="button"
            className={`mine-thread__pin ${thread.pinned ? "is-on" : ""}`}
            onClick={() => onTogglePin(thread.id)}
            aria-pressed={thread.pinned}
            aria-label={thread.pinned ? `Desafixar a conversa "${thread.title}"` : `Fixar a conversa "${thread.title}" no topo`}
            title={thread.pinned ? "Desafixar" : "Fixar no topo"}
          >
            {thread.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            className={`mine-thread__delete ${confirming ? "is-confirming" : ""}`}
            disabled={disabled}
            onClick={() => {
              if (!confirming) {
                setConfirmKey(key);
                return;
              }
              setConfirmKey(null);
              onDelete(thread.id);
            }}
            aria-label={confirming ? `Confirmar: apagar a conversa "${thread.title}"` : `Apagar a conversa "${thread.title}"`}
            title={confirming ? "Clique de novo para apagar" : "Apagar conversa"}
          >
            {confirming ? <span>Apagar?</span> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </span>
      </li>
    );
  };

  return (
    <div className="mine-thread-panel">
      {search}
      <div className="mine-threads minerva-scroll" aria-label="Conversas">
        {activeIsNew ? (
          <ul className="mine-thread-group">
            <li>
              <span className="mine-thread is-active is-new" aria-current="true">
                <Plus className="h-3.5 w-3.5" aria-hidden />
                <span className="mine-thread__title">Nova conversa</span>
              </span>
            </li>
          </ul>
        ) : null}
        {grupos.map((grupo) => (
          <section key={grupo.rotulo} className="mine-thread-group" aria-label={grupo.rotulo}>
            <h4 className="mine-thread-group__title">
              {grupo.rotulo === "Fixadas" ? <Pin className="h-3 w-3" aria-hidden /> : null}
              {grupo.rotulo}
            </h4>
            <ul>{grupo.itens.map(linha)}</ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/** Fixadas, Hoje, Ontem, Últimos 7 dias, Últimos 30 dias e Mais antigas. */
function groupThreadsByDate(threads: ChatThread[]) {
  const inicioDeHoje = new Date();
  inicioDeHoje.setHours(0, 0, 0, 0);
  const hoje = inicioDeHoje.getTime();
  const dia = 86_400_000;
  const faixas: { rotulo: string; desde: number }[] = [
    { rotulo: "Hoje", desde: hoje },
    { rotulo: "Ontem", desde: hoje - dia },
    { rotulo: "Últimos 7 dias", desde: hoje - 7 * dia },
    { rotulo: "Últimos 30 dias", desde: hoje - 30 * dia },
    { rotulo: "Mais antigas", desde: -Infinity },
  ];
  const grupos: { rotulo: string; itens: ChatThread[] }[] = [];
  const fixadas = threads.filter((thread) => thread.pinned);
  if (fixadas.length) grupos.push({ rotulo: "Fixadas", itens: fixadas });
  for (const faixa of faixas) {
    const anteriores = faixas.slice(0, faixas.indexOf(faixa));
    const itens = threads.filter((thread) => !thread.pinned && thread.updatedAt >= faixa.desde && anteriores.every((outra) => thread.updatedAt < outra.desde));
    if (itens.length) grupos.push({ rotulo: faixa.rotulo, itens });
  }
  return grupos;
}

/**
 * Letra da conversa: à mão (padrão, caneta da Mine e lápis de quem pergunta)
 * ou de forma, para quem lê melhor assim. A escolha fica no aparelho.
 */
const handwritingKey = "minerva-mine-letra-v1";
function HandwritingToggle() {
  const [print, setPrint] = useState(() => {
    try {
      return localStorage.getItem(handwritingKey) === "forma";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.classList.toggle("mine-letra-forma", print);
    try {
      localStorage.setItem(handwritingKey, print ? "forma" : "mao");
    } catch {
      // sem armazenamento, vale só nesta visita
    }
  }, [print]);
  return (
    <button
      type="button"
      onClick={() => setPrint((value) => !value)}
      aria-pressed={!print}
      aria-label={print ? "Usar letra à mão na conversa" : "Usar letra de forma na conversa"}
      title={print ? "Letra à mão" : "Letra de forma"}
      className="mine-letra-toggle grid h-10 min-w-10 place-items-center rounded-xl px-2 transition"
    >
      <span className={print ? "font-sans text-sm font-black" : "caderno-hand text-lg leading-none"}>Aa</span>
    </button>
  );
}

export function MineAvatar({ size = "md", thinking = false }: { size?: "sm" | "md" | "lg"; thinking?: boolean }) {
  return (
    <span className={`mine-avatar mine-avatar-${size}`} aria-hidden>
      <span className="mine-avatar-halo" />
      <span className="mine-avatar-face">
        <MineFace track={size === "lg"} thinking={thinking} />
      </span>
      <span className="mine-avatar-status" />
    </span>
  );
}

function MineContextPanel({
  data,
  selectedSubjectId,
  setSelectedSubjectId,
  openMaterial,
  addMaterial,
  goToPlan,
  useTopic,
  createMindMap,
}: {
  data: ReturnType<typeof useMemoUserData>;
  selectedSubjectId?: string;
  setSelectedSubjectId: (value?: string) => void;
  openMaterial: (materialId: string) => void;
  addMaterial: (subjectId: string) => void;
  goToPlan: () => void;
  useTopic: (topic: string) => void;
  createMindMap: (subjectId: string) => void;
}) {
  const selectedSubject = selectedSubjectId ? data.subjects.find((item) => item.id === selectedSubjectId) : undefined;
  const scopedMaterials = (selectedSubjectId ? data.materials.filter((item) => item.subjectId === selectedSubjectId) : data.materials)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt);
  const recentTopics = Array.from(
    new Set(
      data.chats
        .filter((item) => item.role === "user" && (!selectedSubjectId || item.subjectId === selectedSubjectId))
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((item) => item.text.replace(/\s+/g, " ").trim())
        .filter(Boolean),
    ),
  ).slice(0, 3);
  const dueToday = data.tasks.filter((task) => {
    const due = new Date(task.dueAt);
    due.setHours(0, 0, 0, 0);
    return due.getTime() === today();
  });
  const completedToday = dueToday.filter((task) => task.done).length;
  const dailyProgress = percent(completedToday, dueToday.length);
  const scopedProgress = selectedSubject
    ? percent(scopedMaterials.filter((item) => item.studied).length, scopedMaterials.length)
    : percent(data.materials.filter((item) => item.studied).length, data.materials.length);

  return (
    <div className="minerva-scroll flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
      <section className="mine-context-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="mine-context-eyebrow">Contexto ativo</p>
            <h2 className="mt-1 truncate text-sm font-black text-white/84">{selectedSubject?.name || "Todos os estudos"}</h2>
          </div>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-mint/20 bg-mint/[0.08] text-mint">
            {selectedSubject ? React.createElement(iconMap[selectedSubject.icon], { className: "h-4 w-4" }) : <Layers className="h-4 w-4" />}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
            <motion.span
              className="block h-full rounded-full bg-mint"
              initial={{ width: 0 }}
              animate={{ width: `${scopedProgress}%` }}
              transition={{ duration: 0.45, ease: ease.out }}
            />
          </div>
          <span className="text-[10px] font-black tabular text-mint">{scopedProgress}%</span>
        </div>
        <p className="mt-1.5 text-[11px] font-bold text-white/35">
          {scopedMaterials.length} {scopedMaterials.length === 1 ? "conteúdo" : "conteúdos"} no contexto
        </p>
        <div className="minerva-scroll mt-3 flex gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedSubjectId(undefined)}
            aria-pressed={!selectedSubjectId}
            className={`mine-subject-chip ${!selectedSubjectId ? "mine-subject-chip-active" : ""}`}
          >
            Todos
          </button>
          {data.subjects.map((subject) => (
            <button
              key={subject.id}
              type="button"
              onClick={() => setSelectedSubjectId(subject.id)}
              aria-pressed={selectedSubjectId === subject.id}
              className={`mine-subject-chip ${selectedSubjectId === subject.id ? "mine-subject-chip-active" : ""}`}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: subject.color }} />
              {subject.name}
            </button>
          ))}
        </div>
      </section>

      <section className="mine-context-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-black text-white/78">Materiais recentes</h2>
          {selectedSubject ? (
            <button type="button" onClick={() => addMaterial(selectedSubject.id)} className="text-[10px] font-black text-mint hover:underline">
              + Anexar
            </button>
          ) : null}
        </div>
        {scopedMaterials.length ? (
          <div className="mt-2 space-y-1.5">
            {scopedMaterials.slice(0, 3).map((material) => {
              const MaterialIcon = material.type === "link" ? LinkIcon : material.type === "file" ? Paperclip : material.type === "image" ? Eye : FileText;
              return (
                <button key={material.id} type="button" onClick={() => openMaterial(material.id)} className="mine-material-row group">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.035] text-mint">
                    <MaterialIcon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[11px] font-black text-white/70 group-hover:text-white">{material.title}</span>
                    <span className="mt-0.5 block truncate text-[9px] font-bold uppercase tracking-[.08em] text-white/28">{material.type} · {material.studied ? "estudado" : "pendente"}</span>
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-white/18 transition-transform group-hover:translate-x-0.5 group-hover:text-mint" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-white/[0.09] px-3 py-4 text-center">
            <p className="text-[11px] font-bold leading-relaxed text-white/34">Adicione materiais para a Mine responder com mais contexto.</p>
            {selectedSubject ? (
              <button type="button" onClick={() => addMaterial(selectedSubject.id)} className="mt-2 text-[10px] font-black text-mint hover:underline">Adicionar conteúdo</button>
            ) : null}
          </div>
        )}
      </section>

      <section className="mine-context-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-black text-white/78">Tópicos recentes</h2>
          <Sparkles className="h-3.5 w-3.5 text-mint/70" />
        </div>
        <div className="mt-2 space-y-1.5">
          {(recentTopics.length ? recentTopics : ["Revisar os pontos principais", "Explicar com um exemplo prático"]).map((topic) => (
            <button key={topic} type="button" onClick={() => useTopic(topic)} className="mine-topic-row">
              <span className="truncate">{topic}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            </button>
          ))}
        </div>
      </section>

      <section className="mine-context-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="mine-context-eyebrow">Meta de hoje</p>
            <h2 className="mt-1 text-xs font-black text-white/78">
              {dueToday.length ? `${completedToday} de ${dueToday.length} atividades` : "Dia livre para planejar"}
            </h2>
          </div>
          <span className="mine-daily-ring" style={{ "--mine-progress": `${dailyProgress * 3.6}deg` } as React.CSSProperties}>
            <span>{dailyProgress}%</span>
          </span>
        </div>
        <button type="button" onClick={goToPlan} className="mine-context-cta mt-3">
          <span>{dueToday.length ? "Continuar plano de estudos" : "Montar plano de estudos"}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </section>

      <section className="mine-map-card">
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-mint/25 bg-mint/[0.1] text-mint">
          <Brain className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-white/80">Mapa mental pela conversa</p>
          <p className="mt-1 text-[10px] leading-relaxed text-white/38">
            {selectedSubject ? `Organize visualmente os conteúdos de ${selectedSubject.name}.` : "Escolha uma matéria para gerar conexões visuais."}
          </p>
          <button
            type="button"
            disabled={!selectedSubject}
            onClick={() => selectedSubject && createMindMap(selectedSubject.id)}
            className="mine-context-cta mt-3 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <span>Gerar mapa mental</span>
            <Sparkles className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

/**
 * Ditado pelo microfone (Web Speech API do navegador, em pt-BR). O que é
 * falado entra depois do que já estava escrito; parar ou enviar encerra.
 * Sem suporte (Firefox, por exemplo), o botão nem aparece.
 */
function useDictation(input: string, setInput: (value: string) => void) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const inputRef = useRef(input);
  inputRef.current = input;
  const Recognition =
    typeof window === "undefined"
      ? undefined
      : ((window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  function toggle() {
    if (!Recognition) return;
    if (listening) {
      stop();
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    const base = inputRef.current.trimEnd();
    let finalText = "";
    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      const spoken = `${finalText}${interim}`.trim();
      setInput(spoken ? `${base}${base ? " " : ""}${spoken}` : base);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.onerror = recognition.onend;
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
    }
  }

  return { supported: Boolean(Recognition), listening, toggle, stop };
}

function MineView({
  userId,
  pendingPrompt,
  consumePendingPrompt,
  data,
  input,
  setInput,
  selectedSubjectId,
  setSelectedSubjectId,
  loading,
  suggestions,
  streamText,
  searchStatus,
  reasoning,
  artifactLoading,
  stop,
  photos,
  setPhotos,
  webSearch,
  setWebSearch,
  webSearchAvailable,
  tutor,
  setTutor,
  profundo,
  setProfundo,
  esforco,
  setEsforco,
  controle,
  setControle,
  controleLive,
  deepLive,
  liveVisits,
  threadId,
  setThreadId,
  newThread,
  branchFrom,
  deleteThread,
  setFeedback,
  showVersion,
  send,
  openMaterial,
  addMaterial,
  openThread,
  togglePin,
  openMindmap,
  createQuiz,
  openQuiz,
  openDeck,
  saveResponse,
  goToPlan,
  goHome,
}: {
  userId: string;
  pendingPrompt: { id: string; subjectId?: string; text: string } | null;
  consumePendingPrompt: () => void;
  data: ReturnType<typeof useMemoUserData>;
  input: string;
  setInput: (value: string) => void;
  selectedSubjectId?: string;
  setSelectedSubjectId: (value?: string) => void;
  loading: boolean;
  suggestions: string[];
  streamText: string;
  searchStatus: MineSearchStatus | null;
  reasoning: string;
  artifactLoading: { kind: "mindmap" | "quiz" | "deck"; topic: string } | null;
  stop: () => void;
  photos: boolean;
  setPhotos: (value: boolean) => void;
  webSearch: boolean;
  setWebSearch: (value: boolean) => void;
  webSearchAvailable: boolean;
  tutor: boolean;
  setTutor: (value: boolean) => void;
  profundo: boolean;
  setProfundo: (value: boolean) => void;
  esforco: MineEsforco;
  setEsforco: (value: MineEsforco) => void;
  controle: boolean;
  setControle: (value: boolean) => void;
  /** O pedido em andamento saiu com o Controle Mine ligado. */
  controleLive: boolean;
  /** O pedido em andamento saiu com a Pesquisa aprofundada ligada. */
  deepLive: boolean;
  liveVisits: MineVisit[];
  threadId?: string;
  setThreadId: (threadId: string | undefined) => void;
  newThread: () => void;
  branchFrom: (message: ChatMessage) => void;
  deleteThread: (threadId: string | undefined) => void;
  setFeedback: (message: ChatMessage, value: "up" | "down") => void;
  showVersion: (message: ChatMessage, target: number) => void;
  send: (text: string, subjectId?: string, attachments?: ChatAttachment[], options?: { replaceFromId?: string; voz?: boolean }) => void | Promise<void>;
  openMaterial: (materialId: string) => void;
  addMaterial: (subjectId: string) => void;
  /** Abre uma conversa de qualquer matéria (resultado da busca). */
  openThread: (subjectId: string | undefined, threadId: string | undefined) => void;
  togglePin: (subjectId: string | undefined, threadId: string | undefined) => void;
  openMindmap: (message: ChatMessage) => void;
  createQuiz: (message: ChatMessage, escolha: { count: number; difficulty: QuizDifficulty; mode: QuizMode }) => void;
  openQuiz: (message: ChatMessage) => void;
  openDeck: (message: ChatMessage) => void;
  saveResponse: (text: string, subjectId: string) => void;
  goToPlan: () => void;
  goHome: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const contextTriggerRef = useRef<HTMLButtonElement | null>(null);
  const contextDrawerRef = useRef<HTMLElement | null>(null);
  const sendRef = useRef(send);
  // "Ajustar" na imagem criada (e outros atalhos) escrevem na caixa do chat.
  useEffect(() => {
    const onWrite = (event: Event) => {
      const text = (event as CustomEvent<string>).detail;
      if (typeof text !== "string") return;
      setInput(text);
      window.requestAnimationFrame(() => {
        const box = textareaRef.current;
        if (!box) return;
        box.focus();
        box.setSelectionRange(text.length, text.length);
      });
    };
    window.addEventListener("mine:escrever", onWrite);
    return () => window.removeEventListener("mine:escrever", onWrite);
  }, [setInput]);
  const saveResponseRef = useRef(saveResponse);
  const feedbackRef = useRef(setFeedback);
  const versionRef = useRef(showVersion);
  feedbackRef.current = setFeedback;
  versionRef.current = showVersion;
  const logRef = useRef<HTMLDivElement | null>(null);
  // Pergunta presa no topo da tela enquanto a resposta cresce embaixo, como no
  // ChatGPT. O espaço vazio abaixo existe para ela conseguir subir até lá.
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [spacer, setSpacer] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const [contextPanelOpen, setContextPanelOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [desenharOpen, setDesenharOpen] = useState(false);
  // "Criar imagem" na barra: enquanto ligado, o que a pessoa escreve vira
  // pedido de imagem (a Mine responde com [[gerar_imagem: ...]]).
  const [criarImagem, setCriarImagem] = useState(false);
  // Formato na barra (vídeo-resumo, podcast, laboratório...): src/chat/formatosChat.tsx.
  const [formato, setFormato] = useState<FormatoChat | null>(null);
  // Pesquisa aprofundada, Modo tutor e Criar imagem são jeitos diferentes de
  // responder: ligar um desliga os outros.
  // Ficha da Mine (src/chat/ficha.ts): perfil, horário de estudo, família e revisões.
  const [fichaAberta, setFichaAberta] = useState<false | "perfil" | "horario" | "familia">(false);
  const [ficha, setFicha] = useState(() => lerFicha(userId));
  useEffect(() => {
    setFicha(lerFicha(userId));
    const atualizar = () => setFicha(lerFicha(userId));
    window.addEventListener("mine:ficha", atualizar);
    return () => window.removeEventListener("mine:ficha", atualizar);
  }, [userId]);
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setAgora(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const emHorarioDeEstudo = dentroDaJanela(ficha.horario, agora);
  const emDescanso = Boolean(ficha.familia.pin) && dentroDaJanela(ficha.familia.descanso, agora);
  const tutorTravado = Boolean(ficha.familia.pin) && ficha.familia.tutorSempre;
  const toggleModo = (modo: "profundo" | "tutor" | "imagem") => {
    const ligar = modo === "profundo" ? !profundo : modo === "tutor" ? !tutor : !criarImagem;
    setProfundo(modo === "profundo" && ligar);
    // Modo família com "tutor sempre": o tutor não desliga.
    setTutor(tutorTravado || (modo === "tutor" && ligar));
    setCriarImagem(modo === "imagem" && ligar);
    setFormato(null);
  };
  const toggleFormato = (id: FormatoChat) => {
    const ligar = formato !== id;
    setFormato(ligar ? id : null);
    if (ligar) {
      setProfundo(false);
      setCriarImagem(false);
      if (!tutorTravado) setTutor(false);
    }
    textareaRef.current?.focus();
  };
  // Horário de estudo: o tutor liga sozinho ao entrar na janela (uma vez; dá
  // para desligar). Família com "tutor sempre": fica ligado o tempo todo.
  const horarioAplicado = useRef(false);
  const [avisoHorario, setAvisoHorario] = useState(false);
  useEffect(() => {
    if (tutorTravado) {
      if (!tutor) setTutor(true);
      return;
    }
    if (emHorarioDeEstudo && !horarioAplicado.current) {
      horarioAplicado.current = true;
      if (!tutor) {
        setTutor(true);
        setProfundo(false);
        setCriarImagem(false);
        setAvisoHorario(true);
      }
    }
    if (!emHorarioDeEstudo) horarioAplicado.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emHorarioDeEstudo, tutorTravado, tutor]);
  // "Parece lição de casa": sugere o tutor uma vez por conversa.
  const [avisoLicao, setAvisoLicao] = useState(false);
  const licaoDispensada = useRef(false);
  // Trecho da resposta selecionado para perguntar sobre ele.
  const [trecho, setTrecho] = useState("");
  const [trechoPop, setTrechoPop] = useState<{ x: number; y: number; texto: string } | null>(null);
  // Menções com @ no campo de mensagem.
  const [mencao, setMencao] = useState<{ inicio: number; busca: string } | null>(null);
  const [mencaoAtiva, setMencaoAtiva] = useState(0);
  // Comandos com barra: "/" no começo da caixa abre a lista de ferramentas.
  const [barra, setBarra] = useState<string | null>(null);
  const [barraAtiva, setBarraAtiva] = useState(0);
  // "Rabisco vira imagem": o desenho anexado já chega com o pedido escrito.
  const rabiscoParaImagem = useRef(false);
  // Aula por voz com a Mine (MineChamada).
  const [chamada, setChamada] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement | null>(null);
  const dictation = useDictation(input, setInput);
  const [guidedStudyOpen, setGuidedStudyOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    sendRef.current = send;
    saveResponseRef.current = saveResponse;
  }, [send, saveResponse]);
  // Pergunta vinda de fora do chat: sai pelo envio de verdade assim que a
  // matéria certa estiver aberta. A ref segura o efeito duplo do StrictMode.
  const sentPromptIds = useRef(new Set<string>());
  useEffect(() => {
    if (!pendingPrompt || loading) return;
    if ((pendingPrompt.subjectId || undefined) !== (selectedSubjectId || undefined)) return;
    consumePendingPrompt();
    if (sentPromptIds.current.has(pendingPrompt.id)) return;
    sentPromptIds.current.add(pendingPrompt.id);
    void sendRef.current(pendingPrompt.text, pendingPrompt.subjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt?.id, selectedSubjectId, loading]);
  // O que os blocos de estudo (quiz, flashcards, plano) podem pedir ao chat.
  const blocoAcoes = useMemo<BlocoAcoes>(
    () => ({
      enviar: (texto) => void sendRef.current(texto, selectedSubjectId),
      salvarFlashcards: (baralho) => window.dispatchEvent(new CustomEvent("mine:salvar-flashcards", { detail: { ...baralho, subjectId: selectedSubjectId } })),
      levarParaAgenda: (plano) => window.dispatchEvent(new CustomEvent("mine:plano-agenda", { detail: { ...plano, subjectId: selectedSubjectId } })),
      anotarPreferencia: (preferencia) => anotarPreferencia(userId, preferencia),
      registrarErro: (erro) => registrarErroDoChat(userId, erro, selectedSubjectId),
    }),
    [selectedSubjectId, userId],
  );
  const ramificar = useCallback((message: ChatMessage) => branchFrom(message), [branchFrom]);
  // Leitor de tela: em vez de ler cada palavra que chega, avisa uma vez quando a resposta fica pronta.
  const [anuncio, setAnuncio] = useState("");
  const estavaCarregando = useRef(false);
  useEffect(() => {
    if (loading) {
      estavaCarregando.current = true;
      setAnuncio("A Mine está respondendo.");
    } else if (estavaCarregando.current) {
      estavaCarregando.current = false;
      setAnuncio("Resposta da Mine pronta.");
    }
  }, [loading]);
  // Fim de um quiz no chat: a Mine reage (o rosto dela comemora ou anima).
  const quizTerminou = useCallback((r: { titulo: string; acertos: number; total: number }) => {
    if (r.acertos === r.total) mineSays(`Gabaritou ${r.titulo}!`, "happy");
    else if (r.acertos >= r.total / 2) mineSays(`${r.acertos} de ${r.total}. Mandou bem!`, "happy");
    else mineSays("Errar faz parte. Bora revisar juntos?", "wow");
  }, []);
  // Memoizado porque o texto do streaming mora no App: cada token que chega
  // re-renderiza esta árvore inteira. Sem isto, a lista era recriada a cada
  // token e o <MineMessageList> memoizado abaixo nunca conseguiria pular nada.
  const messages = useMemo(
    () => data.chats.filter((item) => inThread(item, selectedSubjectId, threadId)),
    [data.chats, selectedSubjectId, threadId],
  );
  const threads = useMemo(() => threadsOf(data.chats, selectedSubjectId), [data.chats, selectedSubjectId]);
  const activeThread = threads.find((thread) => (thread.id || undefined) === (threadId || undefined));
  const lastMessage = messages[messages.length - 1];
  // Revisão que volta: conversa com título e resposta entra na fila (1, 3, 7, 14 e 30 dias).
  const chaveRevisao = `${selectedSubjectId || "geral"}:${threadId || ""}`;
  const conversaComResposta = messages.length >= 2;
  useEffect(() => {
    if (!activeThread?.title || !conversaComResposta) return;
    agendarRevisao(userId, chaveRevisao, activeThread.title);
  }, [activeThread?.title, conversaComResposta, chaveRevisao, userId]);
  const revisoesHoje = useMemo(() => revisoesVencidas(ficha, agora.getTime()).filter((item) => item.id !== chaveRevisao).slice(0, 2), [ficha, agora, chaveRevisao]);
  // Opções do @: matérias do estudante e os dados dele que a Mine sabe ler.
  const opcoesMencao = useMemo(() => {
    if (!mencao) return [];
    const busca = normalizeText(mencao.busca);
    const todas = [
      ...data.subjects.map((subject) => ({ rotulo: subject.name, dica: `matéria: ${subject.name}` })),
      { rotulo: "caderno de erros", dica: "o que você errou nas provas" },
      { rotulo: "agenda", dica: "suas tarefas e provas" },
      { rotulo: "meu progresso", dica: "XP, nível e sequência" },
    ];
    return todas.filter((item) => !busca || normalizeText(item.rotulo).includes(busca)).slice(0, 6);
  }, [mencao, data.subjects]);
  // Tudo o que dá para chamar com "/": os formatos e os três modos da barra.
  const comandosBarra = [
    ...FORMATOS_CHAT.map((f) => ({ comando: f.comando, label: f.label, dica: f.dica, icon: f.icon, aplicar: () => formato !== f.id && toggleFormato(f.id) })),
    ...(webSearchAvailable ? [{ comando: "pesquisa", label: "Pesquisa aprofundada", dica: "Busca a fundo na web e entrega um dossiê em PDF", icon: Telescope, aplicar: () => !profundo && toggleModo("profundo") }] : []),
    ...(tutorTravado ? [] : [{ comando: "tutor", label: "Modo tutor", dica: "Dicas e perguntas em vez da resposta pronta", icon: Lightbulb, aplicar: () => !tutor && toggleModo("tutor") }]),
    { comando: "imagem", label: "Criar imagem", dica: "Descreva e a Mine cria a imagem com IA", icon: ImagePlus, aplicar: () => !criarImagem && toggleModo("imagem") },
  ];
  const buscaBarra = barra === null ? "" : normalizarComando(barra);
  const opcoesBarra = barra === null ? [] : comandosBarra.filter((c) => !buscaBarra || c.comando.startsWith(buscaBarra) || normalizarComando(c.label).includes(buscaBarra));
  // Sugestões da última resposta; as do App ficam para os atalhos de artefato
  // (mapa, prova, baralho), que não passam pelo chat de texto. Elas valem só
  // para a mensagem que estava no fim quando chegaram: trocar de conversa não
  // pode trazer sugestões de fotossíntese para uma conversa sobre volume.
  const appSuggestionsOwner = useRef<{ list: string[]; messageId?: string }>({ list: suggestions, messageId: lastMessage?.id });
  if (appSuggestionsOwner.current.list !== suggestions) {
    appSuggestionsOwner.current = { list: suggestions, messageId: lastMessage?.id };
  }
  const activeSuggestions = loading
    ? []
    : lastMessage?.role === "mine" && lastMessage.suggestions?.length
      ? lastMessage.suggestions
      : lastMessage?.role === "mine" && appSuggestionsOwner.current.messageId === lastMessage.id
        ? suggestions
        : [];
  // Resposta de um toque: a Mine terminou oferecendo algo ("Quer que eu…?").
  const oferta = !loading && lastMessage?.role === "mine" ? ofertaFinal(lastMessage.text) : null;
  const selectedSubject = selectedSubjectId ? data.subjects.find((subject) => subject.id === selectedSubjectId) : undefined;
  const quickPrompts: Array<{ title: string; detail: string; prompt: string; icon: LucideIcon; mindmap?: boolean; guided?: boolean }> = selectedSubject
    ? [
        { title: "Estudo guiado", detail: "Aula interativa no seu ritmo", prompt: "estudo-guiado", icon: GraduationCap, guided: true },
        { title: "Resumir conteúdos", detail: "Síntese dos materiais salvos", prompt: `Resuma os conteúdos de ${selectedSubject.name}`, icon: FileText },
        { title: "Plano de revisão", detail: "Uma sequência clara para estudar", prompt: `Monte um plano de revisão de ${selectedSubject.name}`, icon: CalendarCheck },
        { title: "Montar uma prova", detail: "Questões com gabarito e explicação", prompt: `Monte uma prova de ${selectedSubject.name}`, icon: ClipboardCheck },
        { title: "Criar flashcards", detail: "Cartões que entram na revisão espaçada", prompt: `Crie flashcards de ${selectedSubject.name}`, icon: Layers },
        { title: "Criar mapa mental", detail: "Conecte ideias em uma visão visual", prompt: `Crie um mapa mental de ${selectedSubject.name}`, icon: Brain, mindmap: true },
      ]
    : [
        { title: "Estudo guiado", detail: "Escolha assunto, tempo e contexto", prompt: "estudo-guiado", icon: GraduationCap, guided: true },
        { title: "Montar uma prova", detail: "Questões com gabarito e explicação", prompt: "Monte uma prova", icon: ClipboardCheck },
        { title: "Criar flashcards", detail: "Cartões que entram na revisão espaçada", prompt: "Crie flashcards", icon: Layers },
        { title: "Planejar a semana", detail: "Organize matérias, tempo e prioridades", prompt: "Crie um plano de estudos para a semana", icon: CalendarDays },
        { title: "Entender um assunto", detail: "Comece pelo essencial, passo a passo", prompt: "Explique esta matéria do zero", icon: BookOpen },
      ];

  const followUp = useCallback(
    (prompt: string) => {
      void sendRef.current(prompt, selectedSubjectId);
    },
    [selectedSubjectId],
  );
  // Refazer: a pergunta que originou a resposta é enviada de novo, e a
  // conversa volta àquele ponto.
  const regenerate = useCallback(
    (message: ChatMessage) => {
      const question = [...messages].reverse().find((item) => item.role === "user" && item.createdAt < message.createdAt);
      if (!question) return;
      void sendRef.current(question.text, question.subjectId, question.attachments || [], { replaceFromId: question.id });
    },
    [messages],
  );
  const editQuestion = useCallback((message: ChatMessage, text: string) => {
    void sendRef.current(text, message.subjectId, message.attachments || [], { replaceFromId: message.id });
  }, []);
  const saveMineResponse = useCallback((text: string, subjectId: string) => saveResponseRef.current(text, subjectId), []);
  const giveFeedback = useCallback((message: ChatMessage, value: "up" | "down") => feedbackRef.current(message, value), []);
  const openVersion = useCallback((message: ChatMessage, target: number) => versionRef.current(message, target), []);
  const createMindMap = useCallback(
    (subjectId: string) => {
      const subject = data.subjects.find((item) => item.id === subjectId);
      if (!subject) return;
      setContextPanelOpen(false);
      void sendRef.current(`Crie um mapa mental de ${subject.name}`, subject.id);
    },
    [data.subjects],
  );

  useEffect(() => {
    setPinnedId(null);
    setSpacer(0);
    const el = scrollRef.current;
    if (el) el.scrollTop = messages.length ? el.scrollHeight : 0;
    setAtBottom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubjectId, threadId]);

  // Pergunta nova: ela sobe para o topo e a resposta cresce embaixo dela, sem
  // a tela correr atrás de cada palavra (o jeito do ChatGPT e do Claude).
  const lastUser = [...messages].reverse().find((item) => item.role === "user");
  useEffect(() => {
    if (!lastUser || Date.now() - lastUser.createdAt > 4000) return;
    setPinnedId(lastUser.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUser?.id]);

  // O espaço abaixo da conversa é o que falta para a pergunta presa chegar
  // ao topo; à medida que a resposta cresce, ele encolhe até sumir.
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    const log = logRef.current;
    if (!el || !log || !pinnedId) {
      if (spacer) setSpacer(0);
      return;
    }
    const target = log.querySelector<HTMLElement>(`[data-msg-id="${pinnedId}"]`);
    if (!target) return;
    const below = log.offsetTop + log.offsetHeight - target.offsetTop;
    const next = Math.max(0, el.clientHeight - below - 24);
    if (Math.abs(next - spacer) > 1) setSpacer(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedId, messages.length, loading, streamText, searchStatus, reasoning]);

  useEffect(() => {
    const el = scrollRef.current;
    const target = pinnedId ? logRef.current?.querySelector<HTMLElement>(`[data-msg-id="${pinnedId}"]`) : null;
    if (!el || !target) return;
    // Espera o espaço ser aplicado para a rolagem ter para onde ir.
    const frame = window.requestAnimationFrame(() => {
      el.scrollTo({ top: Math.max(0, target.offsetTop - 16), behavior: reduceMotion ? "auto" : "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedId]);

  useEffect(() => {
    if (messages.length || loading) return;
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [messages.length, loading]);

  useEffect(() => {
    if (!toolsMenuOpen) return;
    function close(event: PointerEvent) {
      if (!toolsMenuRef.current?.contains(event.target as Node)) setToolsMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setToolsMenuOpen(false);
    }
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [toolsMenuOpen]);

  useEffect(() => {
    if (!contextPanelOpen) return;
    const drawer = contextDrawerRef.current;
    const focusableSelector = "button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href]";
    const first = drawer?.querySelector<HTMLElement>(focusableSelector);
    first?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setContextPanelOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawer) return;
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) return;
      const firstItem = focusable[0];
      const lastItem = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      contextTriggerRef.current?.focus();
    };
  }, [contextPanelOpen]);

  function scrollToBottom() {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function autoGrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
  }

  // Monitor de código aberto: o chat abre uma terceira coluna para ele.
  const monitorOpen = useMonitorOpen();
  /** Liga a ferramenta escolhida e tira o "/comando" da caixa. */
  function escolherComando(comando: string) {
    const item = comandosBarra.find((c) => c.comando === comando);
    if (!item) return;
    item.aplicar();
    setInput(input.replace(/^\/\S*\s?/, ""));
    setBarra(null);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }
  function escolherMencao(rotulo: string) {
    if (!mencao) return;
    const antes = input.slice(0, mencao.inicio);
    const depois = input.slice(mencao.inicio + 1 + mencao.busca.length);
    const novo = `${antes}@${rotulo} ${depois.replace(/^\s+/, "")}`;
    setInput(novo);
    setMencao(null);
    window.requestAnimationFrame(() => {
      const box = textareaRef.current;
      if (!box) return;
      const fim = antes.length + rotulo.length + 2;
      box.focus();
      box.setSelectionRange(fim, fim);
    });
  }
  // Selecionar um trecho de uma resposta da Mine mostra "Perguntar à Mine sobre isso".
  useEffect(() => {
    const ver = () => {
      const selecao = window.getSelection();
      const texto = selecao?.toString().replace(/\s+/g, " ").trim() || "";
      if (!selecao || selecao.rangeCount === 0 || texto.length < 3 || texto.length > 600) {
        setTrechoPop(null);
        return;
      }
      const no = selecao.anchorNode instanceof Element ? selecao.anchorNode : selecao.anchorNode?.parentElement;
      if (!no?.closest(".mine-gpt-message.is-mine") || no.closest("input, textarea, button")) {
        setTrechoPop(null);
        return;
      }
      const caixa = selecao.getRangeAt(0).getBoundingClientRect();
      if (!caixa.width) return setTrechoPop(null);
      setTrechoPop({ x: Math.min(window.innerWidth - 120, Math.max(120, caixa.left + caixa.width / 2)), y: Math.max(48, caixa.top), texto });
    };
    const fechar = () => setTrechoPop(null);
    document.addEventListener("mouseup", ver);
    document.addEventListener("touchend", ver);
    document.addEventListener("scroll", fechar, true);
    return () => {
      document.removeEventListener("mouseup", ver);
      document.removeEventListener("touchend", ver);
      document.removeEventListener("scroll", fechar, true);
    };
  }, []);
  function submit(event: FormEvent) {
    event.preventDefault();
    if ((!input.trim() && !attachments.length && !trecho && !(formato && messages.length)) || loading || emDescanso) return;
    if (input.trim().length > MAX_CHAT_PROMPT_CHARS) {
      setAttachmentError(`Sua mensagem tem mais de ${MAX_CHAT_PROMPT_CHARS.toLocaleString("pt-BR")} caracteres. Divida em partes menores para enviar o texto completo.`);
      return;
    }
    dictation.stop();
    launchPlane(document.querySelector('[aria-label="Enviar mensagem"]'));
    // "/quiz fotossíntese" digitado direto: liga o formato e usa o resto como assunto.
    const comandoDigitado = input.trim().match(/^\/(\S+)\s*([\s\S]*)$/);
    const formatoDoComando = comandoDigitado ? FORMATOS_CHAT.find((f) => f.comando === normalizarComando(comandoDigitado[1])) : undefined;
    const digitado = formatoDoComando ? (comandoDigitado?.[2] || "").trim() : input.trim();
    const formatoUsado = formatoDoComando?.id ?? formato;
    // @matéria / @agenda viram uma dica no fim do pedido para a Mine usar os dados certos.
    const dicas = Array.from(digitado.matchAll(/@([^@\n,.;!?]{2,40})/g))
      .map((m) => normalizeText(m[1].trim()))
      .map((nome) => {
        const materia = data.subjects.find((subject) => nome.startsWith(normalizeText(subject.name)));
        if (materia) return `use os meus conteúdos da matéria ${materia.name}`;
        if (nome.startsWith("caderno de erros")) return "use o meu caderno de erros";
        if (nome.startsWith("agenda")) return "veja a minha agenda";
        if (nome.startsWith("meu progresso")) return "veja o meu progresso e nível";
        return "";
      })
      .filter(Boolean);
    const comMencoes = dicas.length ? `${digitado}\n\n(${Array.from(new Set(dicas)).join("; ")})` : digitado;
    const texto = trecho ? `Sobre este trecho da sua resposta: "${trecho}"\n\n${comMencoes || "Explica melhor esse trecho."}` : comMencoes;
    if (!tutor && !licaoDispensada.current && pareceLicao(digitado, attachments.some((item) => item.kind === "image"))) setAvisoLicao(true);
    const pedido = formatoUsado ? pedidoComFormato(formatoUsado, texto, messages.length > 0) : texto;
    if (formato) setFormato(null);
    send(criarImagem && pedido && !asksToGenerateImage(pedido) ? `Cria uma imagem: ${pedido}` : pedido, selectedSubjectId, attachments);
    setTrecho("");
    setMencao(null);
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
    <section
      className={`mine-chat-shell mine-chatgpt-shell relative grid h-full min-h-0 grid-rows-1 overflow-hidden bg-[#111310] lg:grid-cols-[244px_minmax(0,1fr)] ${monitorOpen ? "has-monitor" : ""}`}
      // Arrastar arquivo para qualquer ponto do chat anexa, como nos chats grandes.
      onDragEnter={(event) => {
        if (loading || !Array.from(event.dataTransfer.types).includes("Files")) return;
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (Array.from(event.dataTransfer.types).includes("Files")) event.preventDefault();
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      }}
      onDrop={(event) => {
        if (!Array.from(event.dataTransfer.types).includes("Files")) return;
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (!loading) void handleFiles(event.dataTransfer.files);
      }}
    >
      {dragging ? (
        <div className="mine-drop" aria-hidden>
          <span>
            <Paperclip className="h-7 w-7" />
            Solte para anexar à mensagem
          </span>
        </div>
      ) : null}
      <aside className="mine-context-sidebar mine-chatgpt-sidebar relative hidden min-h-0 flex-col overflow-hidden border-r border-white/[0.07] bg-[#090b0a] px-3 py-3 lg:flex">
        <span aria-hidden className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-mint/[0.075] blur-[80px]" />
        <div className="relative flex min-h-0 min-w-0 shrink-0 flex-col items-stretch">
          <button type="button" onClick={goHome} className="group mb-2 flex items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-white/[0.045]" aria-label="Voltar ao início da Minerva">
            <MineAvatar size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-white/90">Mine</p>
              <p className="truncate text-[11px] font-bold text-white/34">Assistente de estudos</p>
            </div>
            <Home className="h-4 w-4 text-white/22 transition group-hover:text-white/60" />
          </button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            transition={spring.snappy}
            onClick={newThread}
            disabled={!messages.length || loading}
            aria-label="Iniciar nova conversa"
            title={messages.length ? "Nova conversa (a atual fica guardada)" : "Esta conversa ainda está vazia"}
            className="mb-4 flex min-h-9 w-full shrink-0 items-center justify-start gap-2.5 rounded-xl border border-white/[0.09] bg-white/[0.045] px-3 py-2 text-[13px] font-black text-white/84 transition-[border-color,background-color,color,transform] duration-control hover:border-white/[0.16] hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Plus className="h-[18px] w-[18px]" />
            <span>Nova conversa</span>
          </motion.button>

          <div className="mb-2 flex items-center justify-between px-2">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/34">Matérias</p>
            <span className="text-[10px] font-bold tabular text-white/25">{data.subjects.length + 1}</span>
          </div>
          <div className="minerva-scroll flex max-h-[26vh] min-h-0 min-w-0 flex-col gap-0.5 overflow-x-hidden overflow-y-auto pb-1 pr-1">
            <button
              type="button"
              onClick={() => setSelectedSubjectId(undefined)}
              aria-pressed={!selectedSubjectId}
              className={`group relative flex w-full shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-bold transition-colors duration-control ${
                !selectedSubjectId ? "bg-white/[0.085] text-white" : "text-white/64 hover:bg-white/[0.055] hover:text-white"
              }`}
            >
              <span className={`relative grid h-6 w-6 shrink-0 place-items-center rounded-md ${!selectedSubjectId ? "bg-mint/15 text-mint" : "bg-white/[0.05] text-white/46"}`}>
                <MessageCircle className="h-3.5 w-3.5" />
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="block truncate">Estudos gerais</span>
              </span>
            </button>
            {data.subjects.map((subject) => {
              const active = selectedSubjectId === subject.id;
              const materialCount = data.materials.filter((material) => material.subjectId === subject.id).length;
              return (
                <button
                  type="button"
                  key={subject.id}
                  onClick={() => setSelectedSubjectId(subject.id)}
                  aria-pressed={active}
                  title={`${subject.name} · ${materialCount} ${materialCount === 1 ? "conteúdo" : "conteúdos"} no contexto`}
                  className={`group relative flex w-full shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-bold transition-colors duration-control ${
                    active ? "bg-white/[0.085] text-white" : "text-white/64 hover:bg-white/[0.055] hover:text-white"
                  }`}
                >
                  <span className={`relative grid h-6 w-6 shrink-0 place-items-center rounded-md ${active ? "bg-mint/15" : "bg-white/[0.05]"}`}>
                    <span className="h-2 w-2 rounded-full" style={{ background: subject.color, boxShadow: `0 0 10px ${subject.color}` }} />
                  </span>
                  <span className="relative min-w-0 flex-1">
                    <span className="block truncate">{subject.name}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative mt-3 flex min-h-0 flex-1 flex-col border-t border-white/[0.07] pt-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="truncate text-[10px] font-black uppercase tracking-[.16em] text-white/34">
              Conversas{selectedSubject ? ` de ${selectedSubject.name}` : " gerais"}
            </p>
            <span className="text-[10px] font-bold tabular text-white/25">{threads.length}</span>
          </div>
          <MineThreadList
            chats={data.chats}
            subjects={data.subjects}
            subjectId={selectedSubjectId}
            onOpenThread={openThread}
            onTogglePin={(id) => togglePin(selectedSubjectId, id)}
            threads={threads}
            activeId={threadId}
            activeIsNew={!activeThread}
            onSelect={setThreadId}
            onDelete={deleteThread}
            disabled={loading}
          />
        </div>
      </aside>

      <div className="mine-main relative flex h-full min-h-0 min-w-0 flex-col bg-[#111310]">
        <header data-focus-avoid className="mine-header relative flex min-h-[3.75rem] shrink-0 items-center justify-between gap-2 px-3 py-2 sm:gap-3 md:px-5">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={goHome}
              aria-label="Voltar ao início"
              className="grid h-10 w-10 place-items-center rounded-xl text-white/60 transition hover:bg-white/[0.07] hover:text-white lg:hidden"
            >
              <Home className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[15px] font-black tracking-[-.02em] sm:text-base">Mine</h1>
                <span className="hidden text-[10px] font-bold text-white/32 sm:inline">por Minerva</span>
                {tutor ? <span className="mine-tutor-badge">Tutor</span> : null}
              </div>
              <p className="max-w-[46vw] truncate text-[11px] font-bold text-white/34 sm:max-w-[28rem]">
                {activeThread ? activeThread.title : "Nova conversa"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <FocusQuickStart userId={userId} subjectId={selectedSubject?.id} subjectName={selectedSubject?.name} />
            <HandwritingToggle />
            <button
              type="button"
              onClick={newThread}
              disabled={!messages.length || loading}
              aria-label="Nova conversa"
              title="Nova conversa"
              className="grid h-10 w-10 place-items-center rounded-xl text-white/58 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-30 lg:hidden"
            >
              <Plus className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => setContextPanelOpen(true)} className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-left transition hover:bg-white/[0.07] md:flex">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: selectedSubject?.color || "#34D399", boxShadow: `0 0 10px ${selectedSubject?.color || "#34D399"}` }}
              />
              <span>
                <span className="block max-w-36 truncate text-xs font-bold text-white/68">{selectedSubject ? selectedSubject.name : "Estudos gerais"}</span>
              </span>
            </button>
            <button
              ref={contextTriggerRef}
              type="button"
              onClick={() => setContextPanelOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={contextPanelOpen}
              aria-label="Abrir painel de contexto"
              title="Contexto e materiais"
              className="grid h-10 w-10 place-items-center rounded-xl text-white/58 transition-[background-color,color,transform] duration-control hover:bg-white/[0.07] hover:text-white active:scale-95 md:hidden"
            >
              <Layers className="h-[18px] w-[18px]" />
            </button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            onScroll={(event) => {
              const el = event.currentTarget;
              setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
            }}
            className="mine-conversation-scroll absolute inset-0 overflow-y-auto pb-8 pl-[2.4rem] pr-3 pt-5 sm:pb-10 sm:pl-[2.6rem] sm:pr-6 sm:pt-8"
          >
            <div ref={logRef} role="log" aria-label="Conversa com a Mine" aria-live="polite" className="mx-auto flex max-w-[54rem] flex-col gap-7 sm:gap-9">
              {!messages.length ? (
                <MineWelcome
                  key={selectedSubjectId || "geral"}
                  reduced={Boolean(reduceMotion)}
                  title={selectedSubject ? `Como posso ajudar com ${selectedSubject.name}?` : "Como posso ajudar nos seus estudos?"}
                  subtitle="Pergunte, envie um material ou escolha uma sugestão para começar."
                  prompts={quickPrompts.slice(0, 4).map((prompt) => ({
                    key: prompt.prompt,
                    title: prompt.title,
                    detail: prompt.detail,
                    icon: prompt.icon,
                    onClick: () => {
                      if (prompt.guided) setGuidedStudyOpen(true);
                      else if (prompt.mindmap && selectedSubject) createMindMap(selectedSubject.id);
                      else send(prompt.prompt, selectedSubjectId);
                    },
                  }))}
                />
              ) : (
                <BlocoAcoesContext.Provider value={blocoAcoes}>
                <QuizResultadoContext.Provider value={quizTerminou}>
                <MineMessageList
                  messages={messages}
                  reduceMotion={Boolean(reduceMotion)}
                  subjectId={selectedSubjectId}
                  busy={loading}
                  onRegenerate={regenerate}
                  onEdit={editQuestion}
                  onFollowUp={followUp}
                  onSave={saveMineResponse}
                  onOpenMindmap={openMindmap}
                  onCreateQuiz={createQuiz}
                  onOpenQuiz={openQuiz}
                  onOpenDeck={openDeck}
                  onFeedback={giveFeedback}
                  onShowVersion={openVersion}
                  onBranch={ramificar}
                  onExplainTwoWays={(message) => followUp(`Não entendi bem. Explica de dois jeitos diferentes, num bloco dois-jeitos: um com analogia do dia a dia e outro mais técnico. O assunto é o da sua resposta anterior.`)}
                />
                </QuizResultadoContext.Provider>
                </BlocoAcoesContext.Provider>
              )}
              {/* "Continuar com" no fim da conversa, no fluxo da leitura (como o
                  ChatGPT): fixo em cima da caixa de mensagem ele comia um terço
                  da tela enquanto a pessoa lia a resposta. */}
              {oferta ? (
                <div className="mine-um-toque">
                  <button type="button" onClick={() => send(oferta.envio, selectedSubjectId)} title={oferta.pergunta}>
                    <Check aria-hidden className="h-4 w-4" />
                    {oferta.botao}
                  </button>
                </div>
              ) : null}
              {activeSuggestions.length && !loading ? (
                <div className="mine-next mb-4 pl-1 sm:pl-2">
                  <p className="mine-next__label">
                    <Sparkles aria-hidden className="h-3 w-3" />
                    Continuar com
                  </p>
                  <Stagger className="flex flex-wrap gap-2" gap={0.05}>
                    {activeSuggestions.map((suggestion) => (
                      <StaggerItem key={suggestion}>
                        <button type="button" onClick={() => send(suggestion, selectedSubjectId)} className="mine-next__chip">
                          <span>{suggestion}</span>
                          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                        </button>
                      </StaggerItem>
                    ))}
                  </Stagger>
                </div>
              ) : null}
              {/* Um painel só, fora dos dois ramos (trabalhando / escrevendo): assim a
                  página aberta e o vídeo não recomeçam quando o texto começa a chegar. */}
              {loading && controleLive && !artifactLoading ? (
                <div className="mb-3 pl-[2.75rem] sm:pl-[3.25rem]">
                  <MineControlePanel status={searchStatus} visits={liveVisits} answering={Boolean(streamText)} answerText={streamText} />
                </div>
              ) : null}
              {loading && artifactLoading ? (
                artifactLoading.kind === "mindmap" ? (
                  <MindmapBuildPreview topic={artifactLoading.topic} reduceMotion={Boolean(reduceMotion)} />
                ) : (
                  <ArtifactBuildPreview kind={artifactLoading.kind} topic={artifactLoading.topic} />
                )
              ) : loading && streamText ? (
                <motion.article
                  className="flex items-start gap-3 sm:gap-4"
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Sem avatar na resposta: o texto usa a coluna inteira, como no ChatGPT. */}
                  <div
                    className="mine-gpt-message-body mine-streaming relative min-w-0 w-full max-w-full flex-1 px-1 py-1 text-[15px] leading-[1.72] text-white/82  sm:px-2 sm:py-1.5 sm:text-[15.5px] sm:leading-7"
                    aria-live="off"
                    aria-busy="true"
                  >
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em] text-white/38"><span>Mine</span></div>
                    {reasoning ? <MineThought reasoning={reasoning} /> : null}
                    {/* Pesquisa aprofundada: o progresso continua até o bloco do PDF abrir. */}
                    {deepLive && !/```arquivo/.test(streamText) ? (
                      <DossieProgresso fase="escrevendo" queries={searchStatus?.queries} sources={searchStatus?.sources} cronometro />
                    ) : null}
                    {/* A ponta da caneta no fim do texto vem do CSS (.mine-streaming). */}
                    <MineSourcesProvider sources={searchStatus?.sources} queries={searchStatus?.queries}>
                      <MineMessageText text={streamText} streaming />
                    </MineSourcesProvider>
                  </div>
                </motion.article>
              ) : loading ? (
                <motion.article
                  className="flex items-start gap-3 sm:gap-4"
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="mt-1"><MineAvatar size="sm" thinking /></span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    {deepLive && searchStatus?.stage !== "tool" ? (
                      <DossieProgresso
                        fase={searchStatus?.stage === "reading" ? "lendo" : searchStatus?.stage === "searching" ? "buscando" : "planejando"}
                        queries={searchStatus?.queries}
                        sources={searchStatus?.sources}
                        cronometro
                      />
                    ) : (
                      <MineWorking status={searchStatus} reasoning={reasoning} deep={deepLive} />
                    )}
                  </div>
                </motion.article>
              ) : null}
            </div>
            <div aria-hidden style={{ height: spacer }} />
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

        <div data-focus-avoid className="mine-composer-area relative shrink-0 bg-gradient-to-t from-[#111310] via-[#111310]/98 to-transparent px-2.5 pb-2.5 pt-3 sm:px-5 sm:pb-4 sm:pt-4">
          {emDescanso ? (
            <div className="mine-aviso mx-auto mb-2 max-w-[54rem]" role="status">
              <Moon aria-hidden className="h-4 w-4 shrink-0" />
              <p>
                <strong>Hora de descansar.</strong> A família pausou o chat da Mine até as {ficha.familia.descanso.fim}.
              </p>
            </div>
          ) : null}
          {avisoLicao && !tutor ? (
            <div className="mine-aviso mx-auto mb-2 max-w-[54rem]" role="status">
              <Lightbulb aria-hidden className="h-4 w-4 shrink-0" />
              <p>Parece lição de casa. Quer ligar o Modo tutor para aprender fazendo, com dicas em vez da resposta pronta?</p>
              <button type="button" className="mine-aviso__sim" onClick={() => { toggleModo("tutor"); setAvisoLicao(false); }}>
                Ligar tutor
              </button>
              <button type="button" className="mine-aviso__nao" onClick={() => { licaoDispensada.current = true; setAvisoLicao(false); }}>
                Agora não
              </button>
            </div>
          ) : null}
          {!messages.length && revisoesHoje.length && !loading ? (
            <div className="mine-revisao mx-auto mb-2 max-w-[54rem]">
              <p className="mine-revisao__titulo">
                <RotateCcw aria-hidden className="h-4 w-4" /> Revisão rápida
              </p>
              {revisoesHoje.map((item) => (
                <div key={item.id} className="mine-revisao__item">
                  <span>{item.titulo}</span>
                  <button
                    type="button"
                    className="mine-aviso__sim"
                    onClick={() => {
                      avancarRevisao(userId, item.id, 1);
                      void send(`Revisão rápida de "${item.titulo}": me faz 2 perguntas curtas sobre o que a gente estudou, num bloco quiz.`, selectedSubjectId);
                    }}
                  >
                    Revisar (2 perguntas)
                  </button>
                  <button type="button" className="mine-aviso__nao" onClick={() => avancarRevisao(userId, item.id, 2)}>
                    Já sei
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {tutor ? (
            <div className="mine-tutor-banner mx-auto mb-2 max-w-[54rem]" role="status">
              <Lightbulb aria-hidden className="h-4 w-4 shrink-0" />
              <p>
                <strong>{tutorTravado ? "Modo tutor (família)." : avisoHorario && emHorarioDeEstudo ? "Horário de estudo: modo tutor." : "Modo tutor."}</strong>
                <span className="mine-tutor-banner__detail"> A Mine vai te guiar com dicas e perguntas em vez de entregar a resposta pronta. Peça “mostra a resposta” quando quiser.</span>
                <span className="mine-tutor-banner__short"> Dicas em vez de resposta pronta.</span>
              </p>
              {tutorTravado ? null : (
                <button type="button" onClick={() => { setTutor(false); setAvisoHorario(false); }} className="mine-tutor-banner__off">
                  Desligar
                </button>
              )}
            </div>
          ) : null}
          {attachments.length || attachmentError ? (
            <div className="mx-auto mb-3 max-w-[54rem]" aria-live="polite">
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
              {attachments.length && !loading ? (
                <div className="mine-anexo-acoes">
                  <span>Com este material:</span>
                  <button type="button" onClick={() => { void send("Faz uma prova de 5 questões só com o conteúdo deste material, dizendo de onde saiu cada pergunta.", selectedSubjectId, attachments); setAttachments([]); }}>
                    Fazer uma prova
                  </button>
                  <button type="button" onClick={() => { void send("Faz um resumo para a prova deste material, com o que mais cai.", selectedSubjectId, attachments); setAttachments([]); }}>
                    Resumir
                  </button>
                  <button type="button" onClick={() => { void send("Faz flashcards deste material.", selectedSubjectId, attachments); setAttachments([]); }}>
                    Flashcards
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {chamada ? (
            <React.Suspense fallback={null}>
              <MineChamada
                loading={loading}
                textoAoVivo={loading ? streamText : ""}
                ultimaResposta={lastMessage?.role === "mine" ? { id: lastMessage.id, text: lastMessage.text } : null}
                enviar={(texto) => void send(texto, selectedSubjectId, [], { voz: true })}
                parar={stop}
                onFechar={() => setChamada(false)}
              />
            </React.Suspense>
          ) : null}
          {trecho ? (
            <div className="mine-trecho-citado mx-auto max-w-[54rem]">
              <Quote aria-hidden className="h-4 w-4 shrink-0" />
              <p>{trecho}</p>
              <button type="button" onClick={() => setTrecho("")} aria-label="Tirar o trecho">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          <form
            onSubmit={submit}
            className="mine-composer-shell mx-auto flex max-w-[54rem] flex-wrap items-end gap-1 rounded-[1.75rem] border border-white/[0.11] bg-[#242724] p-2 shadow-[0_16px_46px_-20px_rgba(0,0,0,.72)] transition-[border-color,box-shadow,background-color] duration-control focus-within:border-white/[0.2] focus-within:bg-[#292c29]"
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
            <textarea
              ref={textareaRef}
              value={input}
              rows={1}
              disabled={emDescanso}
              onChange={(event) => {
                setInput(event.target.value);
                autoGrow();
                // @ digitado agora (sem espaço depois): abre a lista de menções.
                const ate = event.target.value.slice(0, event.target.selectionStart ?? event.target.value.length);
                const achado = ate.match(/(?:^|\s)@([^\s@]{0,30})$/);
                setMencao(achado ? { inicio: ate.length - achado[1].length - 1, busca: achado[1] } : null);
                setMencaoAtiva(0);
                // "/" no começo, ainda sem espaço: abre a lista de ferramentas.
                const comando = event.target.value.match(/^\/(\S{0,24})$/);
                setBarra(comando ? comando[1] : null);
                setBarraAtiva(0);
              }}
              onKeyDown={(event) => {
                if (barra !== null && opcoesBarra.length && (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === "Tab" || event.key === "Escape")) {
                  event.preventDefault();
                  if (event.key === "Escape") return setBarra(null);
                  if (event.key === "ArrowDown") return setBarraAtiva((i) => (i + 1) % opcoesBarra.length);
                  if (event.key === "ArrowUp") return setBarraAtiva((i) => (i - 1 + opcoesBarra.length) % opcoesBarra.length);
                  escolherComando((opcoesBarra[barraAtiva] || opcoesBarra[0]).comando);
                  return;
                }
                if (mencao && opcoesMencao.length && (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === "Tab" || event.key === "Escape")) {
                  event.preventDefault();
                  if (event.key === "Escape") return setMencao(null);
                  if (event.key === "ArrowDown") return setMencaoAtiva((i) => (i + 1) % opcoesMencao.length);
                  if (event.key === "ArrowUp") return setMencaoAtiva((i) => (i - 1 + opcoesMencao.length) % opcoesMencao.length);
                  escolherMencao(opcoesMencao[mencaoAtiva]?.rotulo || opcoesMencao[0].rotulo);
                  return;
                }
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  submit(event);
                }
              }}
              // Colar uma imagem (print da questão) anexa direto, sem salvar arquivo.
              onPaste={(event) => {
                const files = event.clipboardData?.files;
                if (!files?.length || loading) return;
                event.preventDefault();
                void handleFiles(files);
              }}
              placeholder={
                dictation.listening
                  ? "Pode falar, estou ouvindo..."
                  : formato
                    ? formatoChat(formato)?.placeholder
                  : criarImagem
                    ? "Descreva a imagem que a Mine vai criar..."
                    : profundo && webSearchAvailable
                    ? "Qual tema pesquisar a fundo? (entrega um dossiê em PDF)..."
                    : tutor
                      ? "Mande o exercício ou a dúvida..."
                      : selectedSubject
                        ? `Pergunte sobre ${selectedSubject.name}...`
                        : "Pergunte qualquer coisa  ·  digite / para ver as ferramentas"
              }
              aria-label="Mensagem para a Mine"
              className="max-h-48 min-h-11 w-full min-w-0 basis-full resize-none bg-transparent px-3 pb-1 pt-2.5 text-[15px] leading-6 text-white outline-none placeholder:text-white/38"
            />
            {mencao && opcoesMencao.length ? (
              <div className="mine-mencoes" role="listbox" aria-label="Mencionar">
                {opcoesMencao.map((opcao, i) => (
                  <button
                    key={opcao.rotulo}
                    type="button"
                    role="option"
                    aria-selected={i === mencaoAtiva}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => escolherMencao(opcao.rotulo)}
                  >
                    <b>@{opcao.rotulo}</b>
                    <span>{opcao.dica}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {barra !== null ? (
              <div className="mine-mencoes mine-barra" role="listbox" aria-label="Ferramentas da Mine">
                <p className="mine-barra__titulo">Ferramentas · escolha ou continue digitando</p>
                {opcoesBarra.length ? (
                  opcoesBarra.map((c, i) => (
                    <button
                      key={c.comando}
                      type="button"
                      role="option"
                      aria-selected={i === barraAtiva}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setBarraAtiva(i)}
                      onClick={() => escolherComando(c.comando)}
                    >
                      <c.icon aria-hidden className="mine-barra__icon" />
                      <b>/{c.comando}</b>
                      <span>
                        {c.label} · {c.dica}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="mine-barra__vazio">Nenhuma ferramenta com “/{barra}”.</p>
                )}
              </div>
            ) : null}
            <div className="flex w-full min-w-0 items-center gap-1">
              <div ref={toolsMenuRef} className="relative shrink-0">
                <motion.button
                  type="button"
                  disabled={loading}
                  whileTap={{ scale: 0.9 }}
                  transition={spring.snappy}
                  onClick={() => setToolsMenuOpen((open) => !open)}
                  aria-label={toolsMenuOpen ? "Fechar ferramentas" : "Anexar e ferramentas"}
                  aria-haspopup="menu"
                  aria-expanded={toolsMenuOpen}
                  title="Anexar e ferramentas"
                  className={`grid h-10 w-10 place-items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${toolsMenuOpen ? "bg-white/[0.1] text-white" : "text-white/60 hover:bg-white/[0.08] hover:text-white"}`}
                >
                  <Plus className={`h-5 w-5 transition-transform duration-control ${toolsMenuOpen ? "rotate-45" : ""}`} />
                </motion.button>
                {toolsMenuOpen ? (
                  <div role="menu" className="mine-menu mine-menu--composer">
                    <button
                      type="button"
                      role="menuitem"
                      className="mine-menu__item"
                      onClick={() => {
                        setToolsMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                    >
                      <Paperclip className="h-4 w-4" />
                      <span>
                        Adicionar fotos e arquivos
                        <span className="mine-menu__detail">Também dá para colar ou arrastar</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="mine-menu__item"
                      onClick={() => {
                        setToolsMenuOpen(false);
                        if (!criarImagem) toggleModo("imagem");
                        textareaRef.current?.focus();
                      }}
                    >
                      <ImagePlus className="h-4 w-4" />
                      <span>
                        Criar imagem
                        <span className="mine-menu__detail">Descreva e a Mine cria a imagem com IA</span>
                      </span>
                    </button>
                    <div className="mine-menu__sep" />
                    {webSearchAvailable ? (
                      <button type="button" role="menuitemcheckbox" aria-checked={webSearch} className={`mine-menu__item ${webSearch ? "is-on" : ""}`} onClick={() => setWebSearch(!webSearch)}>
                        <Globe className="h-4 w-4" />
                        <span>
                          Pesquisar na web
                          <span className="mine-menu__detail">Sempre buscar fontes antes de responder</span>
                        </span>
                        {webSearch ? <Check className="mine-menu__check h-4 w-4" /> : null}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      role="menuitem"
                      className="mine-menu__item"
                      onClick={() => {
                        setToolsMenuOpen(false);
                        rabiscoParaImagem.current = true;
                        setDesenharOpen(true);
                      }}
                    >
                      <PenLine className="h-4 w-4" />
                      <span>
                        Rabisco vira imagem
                        <span className="mine-menu__detail">Desenhe e a Mine transforma numa ilustração</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="mine-menu__item"
                      onClick={() => {
                        setToolsMenuOpen(false);
                        setFichaAberta("perfil");
                      }}
                    >
                      <UserRound className="h-4 w-4" />
                      <span>
                        O que a Mine sabe de mim
                        <span className="mine-menu__detail">Seu jeito de aprender, horário de estudo e família</span>
                      </span>
                    </button>
                    {/* Modo fotos. Sem flag de servidor como a busca na web: a foto vem
                        de uma enciclopedia pública e não custa nada por resposta. */}
                    <button type="button" role="menuitemcheckbox" aria-checked={photos} className={`mine-menu__item ${photos ? "is-on" : ""}`} onClick={() => setPhotos(!photos)}>
                      <Images className="h-4 w-4" />
                      <span>
                        Modo fotos
                        <span className="mine-menu__detail">Ilustrar as respostas com fotos reais</span>
                      </span>
                      {photos ? <Check className="mine-menu__check h-4 w-4" /> : null}
                    </button>
                    <div className="mine-menu__sep" />
                    <p className="mine-menu__label">Estudar</p>
                    <button
                      type="button"
                      role="menuitem"
                      className="mine-menu__item"
                      onClick={() => {
                        setToolsMenuOpen(false);
                        setGuidedStudyOpen(true);
                      }}
                    >
                      <GraduationCap className="h-4 w-4" />
                      Estudo guiado
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="mine-menu__item"
                      onClick={() => {
                        setToolsMenuOpen(false);
                        followUp(selectedSubject ? `Resuma os conteúdos de ${selectedSubject.name}` : "Resuma os pontos principais da nossa conversa");
                      }}
                    >
                      <FileText className="h-4 w-4" />
                      Resumir conteúdo
                    </button>
                    {/* Folha de revisão em PDF com o que foi conversado aqui. */}
                    <button
                      type="button"
                      role="menuitem"
                      className="mine-menu__item"
                      disabled={!messages.length}
                      onClick={() => {
                        setToolsMenuOpen(false);
                        followUp("Transforma essa conversa em um resumo de prova");
                      }}
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      <span>
                        Resumo de prova (PDF)
                        <span className="mine-menu__detail">{messages.length ? "Folha de revisão desta conversa" : "Converse sobre um assunto primeiro"}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="mine-menu__item"
                      onClick={() => {
                        setToolsMenuOpen(false);
                        followUp("Explique o assunto passo a passo, começando pelo essencial.");
                      }}
                    >
                      <ListChecks className="h-4 w-4" />
                      Passo a passo
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="mine-menu__item"
                      onClick={() => {
                        setToolsMenuOpen(false);
                        followUp("Crie 5 questões para eu praticar e mostre o gabarito somente no final.");
                      }}
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      Criar questões
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="mine-menu__item"
                      onClick={() => {
                        setToolsMenuOpen(false);
                        if (selectedSubject) createMindMap(selectedSubject.id);
                        else setContextPanelOpen(true);
                      }}
                    >
                      <Brain className="h-4 w-4" />
                      Mapa mental
                    </button>
                  </div>
                ) : null}
              </div>
              {/* Os três modos ficam sempre à mão na barra; os outros ligados no
                  "+" aparecem como pílulas, cada uma com o seu "x". */}
              <div className="minerva-scroll flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                {formato ? (
                  <span className="mine-tool-pill is-formato">
                    {(() => {
                      const f = formatoChat(formato)!;
                      return (
                        <>
                          <f.icon aria-hidden className="h-3.5 w-3.5" />
                          {f.label}
                        </>
                      );
                    })()}
                    <button type="button" className="mine-tool-pill__off" onClick={() => setFormato(null)} aria-label="Desligar formato" disabled={loading}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : null}
                {webSearchAvailable ? (
                  <button type="button" className="mine-modo mine-modo--deep" aria-pressed={profundo} onClick={() => toggleModo("profundo")} disabled={loading} title="Busca ampla na web e entrega um dossiê em PDF">
                    <Telescope aria-hidden className="h-4 w-4" />
                    <span className="mine-modo__label">Pesquisa aprofundada</span>
                  </button>
                ) : null}
                <button type="button" className="mine-modo mine-modo--tutor" aria-pressed={tutor} onClick={() => toggleModo("tutor")} disabled={loading || tutorTravado} title={tutorTravado ? "A família deixou o Modo tutor sempre ligado" : "Dicas e perguntas em vez da resposta pronta"}>
                  <Lightbulb aria-hidden className="h-4 w-4" />
                  <span className="mine-modo__label">Modo tutor</span>
                </button>
                <button type="button" className="mine-modo mine-modo--imagem" aria-pressed={criarImagem} onClick={() => toggleModo("imagem")} disabled={loading} title="Descreva e a Mine cria a imagem com IA">
                  <ImagePlus aria-hidden className="h-4 w-4" />
                  <span className="mine-modo__label">Criar imagem</span>
                </button>
                {webSearch && webSearchAvailable ? (
                  <span className="mine-tool-pill">
                    <Globe aria-hidden className="h-3.5 w-3.5" />
                    Web
                    <button type="button" className="mine-tool-pill__off" onClick={() => setWebSearch(false)} aria-label="Desligar pesquisa na web" disabled={loading}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : null}
                {photos ? (
                  <span className="mine-tool-pill">
                    <Images aria-hidden className="h-3.5 w-3.5" />
                    Fotos
                    <button type="button" className="mine-tool-pill__off" onClick={() => setPhotos(false)} aria-label="Desligar modo fotos" disabled={loading}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : null}
                {controle ? (
                  <span className="mine-tool-pill">
                    <MousePointer2 aria-hidden className="h-3.5 w-3.5" />
                    Controle Mine
                    <button type="button" className="mine-tool-pill__off" onClick={() => setControle(false)} aria-label="Desligar Controle Mine" disabled={loading}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className={`mine-ligar${chamada ? " is-on" : ""}`}
                onClick={() => setChamada((v) => !v)}
                disabled={emDescanso}
                aria-pressed={chamada}
                aria-label={chamada ? "Encerrar aula por voz" : "Aula por voz com a Mine"}
                title={chamada ? "Encerrar aula por voz" : "Aula por voz: fale e a Mine responde falando"}
              >
                <Phone aria-hidden className="h-4 w-4" />
              </button>
              <label className="mine-esforco" title="Quanto a Mine pensa antes de responder">
                <Gauge aria-hidden className="h-4 w-4" />
                <span className="sr-only">Esforço da resposta</span>
                <select id="mine-esforco" value={esforco} onChange={(event) => setEsforco(event.target.value as MineEsforco)} disabled={loading}>
                  <option value="rapida">Rápida</option>
                  <option value="normal">Normal</option>
                  <option value="caprichada">Caprichada</option>
                </select>
              </label>
              {dictation.supported ? (
                <motion.button
                  type="button"
                  disabled={loading}
                  whileTap={{ scale: 0.9 }}
                  transition={spring.snappy}
                  onClick={dictation.toggle}
                  aria-pressed={dictation.listening}
                  aria-label={dictation.listening ? "Parar ditado" : "Ditar mensagem"}
                  title={dictation.listening ? "Parar ditado" : "Ditar mensagem"}
                  className={`mine-mic grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${dictation.listening ? "is-listening" : "text-white/60 hover:bg-white/[0.08] hover:text-white"}`}
                >
                  {dictation.listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </motion.button>
              ) : null}
              {/* Enquanto gera, o mesmo botão vira "parar" (documento, seção 41). */}
              {loading ? (
                <motion.button
                  type="button"
                  onClick={stop}
                  whileTap={{ scale: 0.9 }}
                  transition={spring.snappy}
                  aria-label="Parar geração"
                  title="Parar"
                  className="group grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black transition-colors duration-control hover:bg-roseGlow hover:text-white"
                >
                  <Square className="h-4 w-4 fill-current" />
                </motion.button>
              ) : (
                <motion.button
                  disabled={!input.trim() && !attachments.length && !(formato && messages.length)}
                  whileTap={{ scale: 0.9 }}
                  transition={spring.snappy}
                  aria-label="Enviar mensagem"
                  title="Enviar"
                  className="group grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black transition-[transform,background-color,opacity] duration-control hover:bg-mint disabled:cursor-not-allowed disabled:opacity-20"
                >
                  <ArrowRight className="h-6 w-6 transition-transform duration-control group-hover:translate-x-0.5" />
                </motion.button>
              )}
            </div>
          </form>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>
      <MineMonitor />

      <AnimatePresence>
        {contextPanelOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Fechar painel de contexto"
              className="absolute inset-0 z-30 bg-black/55 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
              onClick={() => setContextPanelOpen(false)}
            />
            <motion.aside
              ref={contextDrawerRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="mine-context-drawer-title"
              className="mine-context-drawer absolute inset-y-0 right-0 z-40 flex w-[min(22rem,92vw)] min-h-0 flex-col border-l border-white/[0.09] bg-[#0b1210]/98 shadow-[-24px_0_70px_-32px_rgba(0,0,0,.95)]"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 32 }}
              transition={{ duration: reduceMotion ? 0 : 0.3, ease: ease.out }}
            >
              <header className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-4 py-3">
                <div>
                  <p className="mine-context-eyebrow">Painel da conversa</p>
                  <h2 id="mine-context-drawer-title" className="mt-1 text-sm font-black text-white/84">Contexto e materiais</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setContextPanelOpen(false)}
                  aria-label="Fechar"
                  className="grid h-11 w-11 place-items-center rounded-xl text-white/48 transition-colors hover:bg-white/[0.07] hover:text-white"
                >
                  <X className="h-[18px] w-[18px]" />
                </button>
              </header>
              <div className="shrink-0 border-b border-white/[0.07] px-3 pb-3 pt-3">
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="mine-context-eyebrow">Conversas{selectedSubject ? ` de ${selectedSubject.name}` : " gerais"}</p>
                  <button
                    type="button"
                    onClick={() => {
                      newThread();
                      setContextPanelOpen(false);
                    }}
                    disabled={!messages.length || loading}
                    className="text-[11px] font-black text-mint disabled:opacity-35"
                  >
                    + Nova
                  </button>
                </div>
                <div className="flex max-h-48 min-h-0 flex-col">
                  <MineThreadList
                    chats={data.chats}
                    subjects={data.subjects}
                    subjectId={selectedSubjectId}
                    onOpenThread={openThread}
                    onTogglePin={(id) => togglePin(selectedSubjectId, id)}
                    threads={threads}
                    activeId={threadId}
                    activeIsNew={!activeThread}
                    onSelect={(id) => {
                      setThreadId(id);
                      setContextPanelOpen(false);
                    }}
                    onDelete={deleteThread}
                    disabled={loading}
                  />
                </div>
              </div>
              <MineContextPanel
                data={data}
                selectedSubjectId={selectedSubjectId}
                setSelectedSubjectId={setSelectedSubjectId}
                openMaterial={(materialId) => {
                  setContextPanelOpen(false);
                  openMaterial(materialId);
                }}
                addMaterial={(subjectId) => {
                  setContextPanelOpen(false);
                  addMaterial(subjectId);
                }}
                goToPlan={() => {
                  setContextPanelOpen(false);
                  goToPlan();
                }}
                useTopic={(topic) => {
                  setInput(topic);
                  setContextPanelOpen(false);
                  window.setTimeout(() => textareaRef.current?.focus(), 0);
                }}
                createMindMap={createMindMap}
              />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      {desenharOpen ? (
        <React.Suspense fallback={null}>
          <DesenharModal
            onClose={() => {
              setDesenharOpen(false);
              rabiscoParaImagem.current = false;
            }}
            onAttach={(file) => {
              const lista = new DataTransfer();
              lista.items.add(file);
              void handleFiles(lista.files);
              if (rabiscoParaImagem.current) {
                setInput("Transforma este desenho numa ilustração caprichada, em estilo de livro didático, mantendo o que eu desenhei.");
                window.requestAnimationFrame(() => textareaRef.current?.focus());
              }
              rabiscoParaImagem.current = false;
            }}
          />
        </React.Suspense>
      ) : null}
      {fichaAberta ? (
        <React.Suspense fallback={null}>
          <FichaDialog userId={userId} abaInicial={fichaAberta} onClose={() => setFichaAberta(false)} />
        </React.Suspense>
      ) : null}
      {trechoPop ? (
        <button
          type="button"
          className="mine-trecho-pop"
          style={{ left: trechoPop.x, top: trechoPop.y }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setTrecho(trechoPop.texto);
            setTrechoPop(null);
            window.getSelection()?.removeAllRanges();
            textareaRef.current?.focus();
          }}
        >
          <MessageCircleQuestion aria-hidden className="h-4 w-4" /> Perguntar à Mine sobre isso
        </button>
      ) : null}

      <AnimatePresence>
        {guidedStudyOpen ? (
          <GuidedStudyDialog
            data={data}
            initialSubjectId={selectedSubjectId}
            reduceMotion={Boolean(reduceMotion)}
            onClose={() => setGuidedStudyOpen(false)}
            onStart={({ subjectId, topic, minutes, useMaterials }) => {
              const subject = subjectId ? data.subjects.find((item) => item.id === subjectId) : undefined;
              const materialNames = subjectId
                ? data.materials.filter((item) => item.subjectId === subjectId).slice(0, 6).map((item) => item.title)
                : [];
              const contextInstruction = useMaterials && materialNames.length
                ? `Use como contexto os meus materiais salvos: ${materialNames.join(", ")}. Quando se apoiar neles, diga qual material foi usado.`
                : "Explique com conhecimento geral e linguagem adequada para quem está aprendendo.";
              const prompt = [
                `Conduza um estudo guiado de ${minutes} minutos sobre ${topic}.`,
                subject ? `Matéria: ${subject.name}.` : "Contexto: estudos gerais.",
                contextInstruction,
                "Divida a sessão em etapas curtas. Comece apresentando o roteiro e apenas a primeira etapa.",
                "Ao final de cada etapa, faça uma pergunta de checagem e espere minha resposta antes de avançar. Não entregue a aula inteira de uma vez.",
              ].join(" ");
              setSelectedSubjectId(subjectId);
              setGuidedStudyOpen(false);
              void send(prompt, subjectId);
            }}
          />
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function GuidedStudyDialog({
  data,
  initialSubjectId,
  reduceMotion,
  onClose,
  onStart,
}: {
  data: ReturnType<typeof useMemoUserData>;
  initialSubjectId?: string;
  reduceMotion: boolean;
  onClose: () => void;
  onStart: (config: { subjectId?: string; topic: string; minutes: number; useMaterials: boolean }) => void;
}) {
  const [subjectId, setSubjectId] = useState(initialSubjectId || "");
  const [topic, setTopic] = useState("");
  const [minutes, setMinutes] = useState(20);
  const [useMaterials, setUseMaterials] = useState(true);
  const selectedSubject = subjectId ? data.subjects.find((item) => item.id === subjectId) : undefined;
  const materialCount = subjectId ? data.materials.filter((item) => item.subjectId === subjectId).length : 0;
  const resolvedTopic = topic.trim() || selectedSubject?.name || "um assunto que eu preciso revisar";

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-50 grid items-end bg-black/65 p-2 backdrop-blur-[3px] sm:place-items-center sm:p-6">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-study-title"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 }}
        transition={spring.snappy}
        className="w-full max-w-xl overflow-hidden rounded-[1.35rem] border border-white/[0.11] bg-[#111a16] shadow-[0_34px_100px_-30px_rgba(0,0,0,.95)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5 sm:p-6">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[.8rem] bg-mint text-black shadow-glowSoft"><GraduationCap className="h-5 w-5" /></span>
            <div>
              <p className="caderno-note">Modo tutor</p>
              <h2 id="guided-study-title" className="mt-1 font-display text-xl font-black tracking-[-.03em] sm:text-2xl">Montar estudo guiado</h2>
              <p className="mt-1 text-xs leading-relaxed text-white/40">A Mine explica uma etapa, verifica seu entendimento e só então continua.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar estudo guiado" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white/45 transition hover:bg-white/[0.07] hover:text-white"><X className="h-5 w-5" /></button>
        </header>

        <form
          className="space-y-5 p-5 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            onStart({ subjectId: subjectId || undefined, topic: resolvedTopic, minutes, useMaterials: useMaterials && materialCount > 0 });
          }}
        >
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[.15em] text-white/42">Matéria</span>
            <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/[0.1] bg-black/20 px-3 text-sm font-bold text-white outline-none transition focus:border-mint/45">
              <option value="">Estudos gerais</option>
              {data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[.15em] text-white/42">Assunto</span>
            <input
              autoFocus
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder={selectedSubject ? `Ex.: ponto mais difícil de ${selectedSubject.name}` : "Ex.: fotossíntese, funções ou redação"}
              className="mt-2 min-h-11 w-full rounded-xl border border-white/[0.1] bg-black/20 px-3 text-sm font-bold text-white outline-none placeholder:text-white/25 transition focus:border-mint/45"
            />
          </label>

          <fieldset>
            <legend className="text-[10px] font-black uppercase tracking-[.15em] text-white/42">Duração</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[10, 20, 30].map((value) => (
                <button key={value} type="button" onClick={() => setMinutes(value)} aria-pressed={minutes === value} className={`min-h-11 rounded-xl border text-sm font-black transition ${minutes === value ? "border-mint bg-mint text-black" : "border-white/[0.09] bg-white/[0.035] text-white/55 hover:border-white/20 hover:text-white"}`}>
                  {value} min
                </button>
              ))}
            </div>
          </fieldset>

          <button
            type="button"
            disabled={!materialCount}
            onClick={() => setUseMaterials((value) => !value)}
            aria-pressed={useMaterials && materialCount > 0}
            className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${useMaterials && materialCount ? "border-mint/25 bg-mint/[0.07]" : "border-white/[0.08] bg-white/[0.025]"}`}
          >
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${useMaterials && materialCount ? "bg-mint text-black" : "bg-white/[0.07] text-white/45"}`}>{useMaterials && materialCount ? <Check className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-white/74">Usar meus materiais</span>
              <span className="mt-0.5 block text-[11px] font-bold text-white/34">{subjectId ? `${materialCount} ${materialCount === 1 ? "conteúdo disponível" : "conteúdos disponíveis"}` : "Escolha uma matéria para ativar"}</span>
            </span>
          </button>

          <div className="flex flex-col-reverse gap-2 border-t border-white/[0.07] pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-4 text-sm font-black text-white/48 transition hover:bg-white/[0.06] hover:text-white">Cancelar</button>
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-mint px-5 text-sm font-black text-black shadow-glowSoft transition hover:-translate-y-0.5 hover:shadow-glow">
              Começar sessão <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/** Fontes da web citadas na resposta, clicáveis. */
export function ChatAttachments({ attachments, tone = "dark" }: { attachments?: ChatAttachment[]; tone?: "dark" | "light" | "user" }) {
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

/**
 * Corpo de uma resposta da Mine: texto formatado, com as fotos que ela pediu
 * nas posições em que pediu.
 *
 * `streaming` existe por causa de um detalhe do texto chegando token a token:
 * um marcador pela metade (`[[imagem: Nik`) apareceria cru na tela por alguns
 * instantes. Ver shared/chat-media.mjs.
 */
function MineMessageText({ text, streaming = false, attachment, essencial = false }: { text: string; streaming?: boolean; attachment?: string; essencial?: boolean }) {
  // Glossário: o marcador sai do texto e a primeira vez de cada termo ganha a
  // marca invisível que o MineRichText transforma em sublinhado com explicação.
  // Durante o streaming o marcador ainda nem chegou: nada é grifado.
  const { body, terms } = useMemo(() => {
    // `[[quiz: {...}]]` escrito como marcador vira o bloco de verdade.
    const glossary = extractGlossary(colchetesParaBlocos(text));
    return { body: streaming ? glossary.text : markGlossary(glossary.text, glossary.terms), terms: glossary.terms };
  }, [text, streaming]);
  // Até 3 galerias: uma abrindo a resposta e as outras no meio da explicação.
  const segments = useMemo(() => splitMessageMedia(body, { streaming, limit: 3 }), [body, streaming]);
  // Mais de ~350 letras de texto = explicação (não um pedido de fotos).
  const explicacao = segments.reduce((total, segment) => total + (segment.type === "text" ? segment.text.length : 0), 0) > 350;
  if (!segments.length) return null;

  return (
    <MineGlossaryProvider value={terms}>
      <AnexoDaPerguntaContext.Provider value={attachment}>
      <div className={`mine-answer${essencial ? " is-essencial" : ""}`}>
        {segments.map((segment, index) =>
          segment.type === "generate" ? (
            <MineGeneratedImage
              key={`gen-${segment.edit ? "e" : "n"}-${segment.formato || ""}-${segment.prompt}`}
              prompt={segment.prompt}
              caption={segment.caption}
              edit={segment.edit}
              formato={segment.formato}
              attachment={segment.fromAttachment ? attachment : undefined}
              streaming={streaming}
            />
          ) : segment.type === "image" ? (
            <MineImageGallery
              key={`image-${index}-${segment.style || ""}-${segment.query}`}
              query={segment.query}
              caption={segment.caption}
              style={segment.style}
              // Resposta com explicação: cada foto é uma só e grande, como no ChatGPT.
              // A tira de 3 miniaturas fica para quando a pessoa pediu fotos.
              destaque={!segment.style && (index > 0 || explicacao)}
            />
          ) : (
            <MineRichText key={`text-${index}`} text={segment.text} streaming={streaming} />
          ),
        )}
      </div>
      </AnexoDaPerguntaContext.Provider>
    </MineGlossaryProvider>
  );
}

/**
 * Erro de quiz no chat vai para o caderno de erros da aba Provas (o mesmo
 * localStorage que a ProvasView lê e sobe para a conta).
 */
/** Também usada pela aba Leitura: pergunta de interpretação errada vai para o caderno de erros. */
export function registrarErroDoChat(userId: string, erro: { assunto: string; pergunta: string; opcoes: string[]; correta: number; marcada: number }, subjectId?: string) {
  const chave = `minerva:provas:${userId}`;
  try {
    const salvo = JSON.parse(window.localStorage.getItem(chave) || "{}") as { caderno?: unknown[] };
    const caderno = anotarErros(
      (Array.isArray(salvo.caderno) ? salvo.caderno : []) as Parameters<typeof anotarErros>[0],
      [{ indice: 0, questao: { question: erro.pergunta, options: erro.opcoes, correct: erro.correta, explanation: "" }, marcada: erro.marcada, certa: false }] as unknown as Parameters<typeof anotarErros>[1],
      { provaId: `chat-${Date.now().toString(36)}`, assunto: erro.assunto, subjectId },
    );
    window.localStorage.setItem(chave, JSON.stringify({ ...salvo, caderno }));
  } catch {
    // Sem armazenamento: o erro só não fica guardado.
  }
}

/**
 * Resposta em camadas (25/nov/2026, da pesquisa com as outras IAs): resposta
 * longa ganha "Completa / Só o essencial" e as abas "Fontes" e "Imagens". O
 * essencial deixa os títulos, o primeiro parágrafo de cada parte e os
 * cartões de destaque, para revisar rápido sem pedir de novo.
 */
function MineCamadas({ message, attachment }: { message: ChatMessage; attachment?: string }) {
  const [vista, setVista] = useState<"resposta" | "essencial" | "fontes" | "imagens">("resposta");
  const secoes = (message.text.match(/^##\s/gm) || []).length;
  const longa = secoes >= 3 && message.text.length > 1800;
  const fontes = message.sources?.length || 0;
  const assunto = (message.threadTitle || message.text.match(/^##\s+(.+)$/m)?.[1] || "").replace(/[*_`#]/g, "").trim();
  if (!longa && !fontes) return <MineMessageText text={message.text} attachment={attachment} />;
  return (
    <>
      <div className="mine-camadas" role="tablist" aria-label="Como ver esta resposta">
        <button type="button" role="tab" aria-selected={vista === "resposta"} onClick={() => setVista("resposta")}>
          Resposta
        </button>
        {longa ? (
          <button type="button" role="tab" aria-selected={vista === "essencial"} onClick={() => setVista("essencial")}>
            Só o essencial
          </button>
        ) : null}
        {fontes ? (
          <button type="button" role="tab" aria-selected={vista === "fontes"} onClick={() => setVista("fontes")}>
            Fontes <span>{fontes}</span>
          </button>
        ) : null}
        {assunto ? (
          <button type="button" role="tab" aria-selected={vista === "imagens"} onClick={() => setVista("imagens")}>
            Imagens
          </button>
        ) : null}
      </div>
      {vista === "fontes" ? (
        <ol className="mine-camadas__fontes">
          {(message.sources || []).map((fonte, i) => (
            <li key={fonte.url || i}>
              <a href={fonte.url} target="_blank" rel="noreferrer noopener">
                <b>{fonte.title || fonte.url}</b>
                <span>{(() => { try { return new URL(fonte.url).hostname.replace(/^www\./, ""); } catch { return ""; } })()}</span>
              </a>
            </li>
          ))}
        </ol>
      ) : vista === "imagens" ? (
        <MineImageGallery query={assunto.slice(0, 60)} caption={`Imagens sobre ${assunto.slice(0, 60)}`} />
      ) : (
        <MineMessageText text={message.text} attachment={attachment} essencial={vista === "essencial"} />
      )}
    </>
  );
}

/**
 * Grifa, em amarelo, o trecho do texto que bate com a busca (ignorando acento
 * e maiúscula). A chave muda com a busca para o traço se redesenhar a cada
 * letra digitada, como quem passa o marca-texto de novo.
 */
function InkMark({ text, query }: { text: string; query: string }) {
  const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const needle = fold(query.trim());
  if (!needle) return <>{text}</>;
  const index = fold(text).indexOf(needle);
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark key={needle} className="caderno-mark">{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  );
}

function SearchView({
  data,
  user,
  query,
  setQuery,
  update,
  notify,
}: {
  data: ReturnType<typeof useMemoUserData>;
  user: User;
  query: string;
  setQuery: (value: string) => void;
  update: (next: (draft: AppData) => AppData) => void;
  notify: (message: string) => void;
}) {
  const [libraryResults, setLibraryResults] = useState<LibraryResult[]>([]);
  const [researchResults, setResearchResults] = useState<ResearchResult[]>([]);
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalSearched, setExternalSearched] = useState(false);
  const [externalError, setExternalError] = useState("");
  const [targetSubjectId, setTargetSubjectId] = useState(data.subjects[0]?.id || "");
  const externalRequestRef = useRef(0);
  const needle = normalizeText(query);
  const subjectName = (id: string) => data.subjects.find((subject) => subject.id === id)?.name || "Sem matéria";
  const subjects = needle ? data.subjects.filter((item) => normalizeText(item.name).includes(needle)) : data.subjects;
  const materials = needle
    ? data.materials.filter((item) => normalizeText(`${item.title} ${item.detail} ${item.content || ""}`).includes(needle))
    : data.materials;
  const tasks = needle ? data.tasks.filter((item) => normalizeText(`${item.title} ${item.note}`).includes(needle)) : [];
  const total = subjects.length + materials.length + tasks.length;

  useEffect(() => {
    if (data.subjects.some((subject) => subject.id === targetSubjectId)) return;
    setTargetSubjectId(data.subjects[0]?.id || "");
  }, [data.subjects, targetSubjectId]);

  useEffect(() => {
    externalRequestRef.current += 1;
    setExternalLoading(false);
    setExternalSearched(false);
    setExternalError("");
    setLibraryResults([]);
    setResearchResults([]);
  }, [query]);

  const searchExternalSources = async () => {
    const term = query.trim();
    if (term.length < 2) {
      notify("Digite pelo menos 2 caracteres para buscar fontes.");
      return;
    }
    const requestId = ++externalRequestRef.current;
    setExternalLoading(true);
    setExternalSearched(false);
    setExternalError("");
    const [library, research] = await Promise.allSettled([
      apiJson<{ results: LibraryResult[] }>(`/api/library?q=${encodeURIComponent(term)}&limit=6`),
      apiJson<{ results: ResearchResult[] }>(`/api/research?q=${encodeURIComponent(term)}&limit=6`),
    ]);
    if (requestId !== externalRequestRef.current) return;
    setLibraryResults(library.status === "fulfilled" ? library.value.results : []);
    setResearchResults(research.status === "fulfilled" ? research.value.results : []);
    const failures = [library, research].filter((result) => result.status === "rejected");
    if (failures.length === 2) {
      const reason = library.status === "rejected" && library.reason instanceof Error ? library.reason.message : "As fontes estão indisponíveis agora.";
      setExternalError(reason);
    } else if (failures.length === 1) {
      setExternalError("Uma das fontes não respondeu, mas os resultados disponíveis foram mantidos.");
    }
    setExternalSearched(true);
    setExternalLoading(false);
  };

  const saveSource = (source: LibraryResult | ResearchResult) => {
    if (!targetSubjectId) {
      notify("Crie uma matéria antes de salvar uma fonte.");
      return;
    }
    if (data.materials.some((material) => material.type === "link" && material.content?.includes(source.sourceUrl))) {
      notify("Esta fonte já está salva nos seus conteúdos.");
      return;
    }
    const isBook = source.source === "Open Library";
    const details = isBook
      ? ["Livro", source.authors.join(", "), source.year].filter(Boolean).join(" · ")
      : ["Publicação", source.authors.join(", "), source.year].filter(Boolean).join(" · ");
    const metadata = isBook
      ? [
          `Fonte: ${source.source}`,
          `Título: ${source.title}`,
          source.authors.length ? `Autores: ${source.authors.join(", ")}` : "",
          source.year ? `Ano: ${source.year}` : "",
          source.isbn ? `ISBN: ${source.isbn}` : "",
          `Link: ${source.sourceUrl}`,
        ]
      : [
          `Fonte: ${source.source}`,
          `Título: ${source.title}`,
          source.authors.length ? `Autores: ${source.authors.join(", ")}` : "",
          source.container ? `Publicado em: ${source.container}` : "",
          source.year ? `Ano: ${source.year}` : "",
          source.doi ? `DOI: ${source.doi}` : "",
          `Link: ${source.sourceUrl}`,
        ];
    const material: Material = {
      id: uid("material"),
      userId: user.id,
      subjectId: targetSubjectId,
      title: source.title.slice(0, 120),
      type: "link",
      detail: details.slice(0, 240),
      content: metadata.filter(Boolean).join("\n").slice(0, 2_000),
      folder: isBook ? "Biblioteca" : "Pesquisa",
      studied: false,
      favorite: false,
      createdAt: Date.now(),
    };
    update((draft) => ({ ...draft, materials: [...draft.materials, material] }));
    notify(`${isBook ? "Livro" : "Publicação"} salvo em ${subjectName(targetSubjectId)}.`);
  };

  return (
    <>
      <PageHeader eyebrow="Busca global" title="Buscar tudo" subtitle="Encontre o que você salvou e descubra livros e pesquisas em fontes públicas confiáveis." />
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
          <div className="mt-4 flex flex-col gap-3 border-t border-white/[0.08] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-white/78">Estante de fontes</p>
              <p className="mt-0.5 text-xs text-white/42">Open Library + Crossref · a busca externa só acontece ao clicar</p>
            </div>
            <PrimaryButton icon={externalLoading ? Loader2 : Globe} onClick={searchExternalSources} disabled={externalLoading || query.trim().length < 2}>
              {externalLoading ? "Consultando..." : "Buscar fontes"}
            </PrimaryButton>
          </div>
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
                    <span className="min-w-0 flex-1 truncate font-black"><InkMark text={subject.name} query={query} /></span>
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
                      <p className="truncate font-black leading-tight"><InkMark text={material.title} query={query} /></p>
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
                        <p className={`truncate font-black leading-tight ${task.done ? "text-white/38 line-through" : ""}`}><InkMark text={task.title} query={query} /></p>
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

      <AnimatePresence>
        {(externalLoading || externalSearched) ? (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.4, ease: ease.out }}
            className="mt-5"
          >
            <GlassCard>
              <SectionTitle
                icon={Landmark}
                title="Fontes para estudar"
                hint="resultados públicos; confira a obra original antes de citar"
                action={
                  data.subjects.length ? (
                    <label className="flex items-center gap-2 text-xs font-bold text-white/45">
                      Salvar em
                      <select
                        value={targetSubjectId}
                        onChange={(event) => setTargetSubjectId(event.target.value)}
                        className="h-10 max-w-[13rem] rounded-xl border border-white/12 bg-black/35 px-3 text-sm font-black text-white outline-none transition focus:border-mint/60"
                      >
                        {data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                      </select>
                    </label>
                  ) : <span className="text-xs font-bold text-amberGlow">Crie uma matéria para salvar fontes</span>
                }
              />

              {externalLoading ? (
                <div className="grid min-h-40 place-items-center text-center">
                  <div>
                    <Loader2 className="mx-auto h-7 w-7 animate-spin text-mint" />
                    <p className="mt-3 text-sm font-bold text-white/50">Procurando livros e publicações...</p>
                  </div>
                </div>
              ) : (
                <>
                  {externalError ? <p className="mt-4 rounded-xl border border-amberGlow/20 bg-amberGlow/[0.07] px-4 py-3 text-sm text-amberGlow/90">{externalError}</p> : null}
                  <div className="mt-5 grid gap-5 xl:grid-cols-2">
                    <section>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="flex items-center gap-2 font-display text-lg font-black"><BookOpen className="h-4 w-4 text-mint" /> Biblioteca</h3>
                        <span className="text-xs font-bold text-white/35">Open Library · {libraryResults.length}</span>
                      </div>
                      <Stagger className="space-y-2.5" gap={0.035}>
                        {libraryResults.map((book) => (
                          <StaggerItem key={book.id}>
                            <article className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3.5 transition-colors hover:border-mint/25 hover:bg-white/[0.055]">
                              {book.coverUrl ? (
                                <img src={book.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-20 w-14 shrink-0 rounded-lg bg-white/5 object-cover" />
                              ) : (
                                <span className="grid h-20 w-14 shrink-0 place-items-center rounded-lg bg-mint/10 text-mint"><BookOpen className="h-5 w-5" /></span>
                              )}
                              <div className="min-w-0 flex-1">
                                <h4 className="line-clamp-2 font-black leading-snug">{book.title}</h4>
                                <p className="mt-1 line-clamp-1 text-xs text-white/45">{book.authors.join(", ") || "Autoria não informada"}{book.year ? ` · ${book.year}` : ""}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button type="button" onClick={() => saveSource(book)} disabled={!targetSubjectId} className="rounded-lg bg-mint px-2.5 py-1.5 text-xs font-black text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">Salvar</button>
                                  <a href={book.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-white/[0.07] px-2.5 py-1.5 text-xs font-black text-white/65 transition hover:text-white"><LinkIcon className="h-3 w-3" /> Abrir fonte</a>
                                </div>
                              </div>
                            </article>
                          </StaggerItem>
                        ))}
                      </Stagger>
                      {!libraryResults.length ? <p className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-white/38">Nenhum livro encontrado para esta busca.</p> : null}
                    </section>

                    <section>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="flex items-center gap-2 font-display text-lg font-black"><FileText className="h-4 w-4 text-cyanGlow" /> Pesquisa acadêmica</h3>
                        <span className="text-xs font-bold text-white/35">Crossref · {researchResults.length}</span>
                      </div>
                      <Stagger className="space-y-2.5" gap={0.035}>
                        {researchResults.map((work) => (
                          <StaggerItem key={work.id}>
                            <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-3.5 transition-colors hover:border-cyanGlow/25 hover:bg-white/[0.055]">
                              <h4 className="line-clamp-2 font-black leading-snug">{work.title}</h4>
                              <p className="mt-1 line-clamp-1 text-xs text-white/45">{work.authors.join(", ") || "Autoria não informada"}{work.year ? ` · ${work.year}` : ""}</p>
                              {work.container ? <p className="mt-1 line-clamp-1 text-xs font-bold text-cyanGlow/70">{work.container}</p> : null}
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button type="button" onClick={() => saveSource(work)} disabled={!targetSubjectId} className="rounded-lg bg-mint px-2.5 py-1.5 text-xs font-black text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">Salvar</button>
                                <a href={work.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-white/[0.07] px-2.5 py-1.5 text-xs font-black text-white/65 transition hover:text-white"><LinkIcon className="h-3 w-3" /> {work.doi ? "Abrir DOI" : "Ver no Crossref"}</a>
                              </div>
                            </article>
                          </StaggerItem>
                        ))}
                      </Stagger>
                      {!researchResults.length ? <p className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-white/38">Nenhuma publicação encontrada para esta busca.</p> : null}
                    </section>
                  </div>
                </>
              )}
            </GlassCard>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </>
  );
}

type PlanPace = "leve" | "normal" | "intenso";

const planPaceSteps: Record<PlanPace, string[]> = {
  leve: ["Revisar teoria", "Resolver exercícios"],
  normal: ["Revisar teoria", "Resolver exercícios", "Fazer resumo"],
  intenso: ["Revisar teoria", "Resolver exercícios", "Fazer resumo", "Revisão final"],
};

/**
 * Quantas tarefas o plano tem, pelo ritmo. Antes o ritmo virava só uma frase
 * no pedido e a Mine fazia sempre uma tarefa por dia: Normal e Intenso davam o
 * mesmo plano (relatório de QA de 16/11). Agora o total é um número, pedido à
 * Mine e conferido na volta.
 */
const planPaceRate: Record<PlanPace, number> = { leve: 0.5, normal: 1, intenso: 2 };
const planPaceDaily: Record<PlanPace, string> = {
  leve: "uma tarefa a cada 2 dias",
  normal: "cerca de 1 tarefa por dia",
  intenso: "cerca de 2 tarefas por dia",
};
function planTarget(pace: PlanPace, days: number, subjects: number) {
  const scale = Math.max(1, subjects / 2);
  const raw = Math.round(days * planPaceRate[pace] * scale);
  const minimum = Math.max(1, subjects) * (pace === "leve" ? 1 : pace === "normal" ? 2 : 3);
  return Math.min(Math.max(raw, minimum), Math.min(80, days * 4));
}
function planPaceHint(pace: PlanPace, days: number, subjects: number) {
  const total = planTarget(pace, days, Math.max(subjects, 1));
  return `${total} ${total === 1 ? "tarefa" : "tarefas"} · ${planPaceDaily[pace]}`;
}

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
  // Plano que voltou da agenda para edição: ao salvar, mantém o mesmo id.
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const chosen = data.subjects.filter((item) => selected.includes(item.id));
  const target = planTarget(pace, days, chosen.length);

  // O último plano salvo, reconhecido pelas tarefas que levam o mesmo planId.
  const savedPlan = (() => {
    const byPlan = new Map<string, Task[]>();
    for (const task of data.tasks) {
      if (!task.planId) continue;
      byPlan.set(task.planId, [...(byPlan.get(task.planId) || []), task]);
    }
    let latest: { id: string; tasks: Task[]; createdAt: number } | null = null;
    for (const [id, tasks] of byPlan) {
      const createdAt = Math.max(...tasks.map((task) => task.createdAt));
      if (!latest || createdAt > latest.createdAt) latest = { id, tasks, createdAt };
    }
    return latest;
  })();

  function editSavedPlan() {
    if (!savedPlan) return;
    const pending = savedPlan.tasks.filter((task) => !task.done);
    const ids = new Set(pending.map((task) => task.id));
    update((current) => ({ ...current, tasks: current.tasks.filter((task) => !ids.has(task.id)) }));
    setDraft(pending.map((task) => ({ ...task, id: uid("draft") })).sort((a, b) => a.dueAt - b.dueAt));
    setFromMine(false);
    setEditingPlanId(savedPlan.id);
    setConfirmRemove(false);
    notify("O plano voltou para cá. Ajuste e salve de novo na agenda.");
  }

  function removeSavedPlan() {
    if (!savedPlan) return;
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    const pending = savedPlan.tasks.filter((task) => !task.done);
    const ids = new Set(pending.map((task) => task.id));
    update((current) => ({ ...current, tasks: current.tasks.filter((task) => !ids.has(task.id)) }));
    setConfirmRemove(false);
    notify(`${pending.length} ${pending.length === 1 ? "tarefa do plano saiu" : "tarefas do plano saíram"} da agenda.`);
  }
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

  /** `count` tarefas alternando matérias e etapas, espalhadas do dia 1 ao último. */
  function quickRows(count: number) {
    const steps = planPaceSteps[pace];
    const rows: Array<{ subjectId: string; title: string; note: string; day: number }> = [];
    for (let slot = 0; slot < count; slot += 1) {
      const subject = chosen[slot % chosen.length];
      // a etapa avança junto com o tempo: teoria no começo, revisão no fim
      const stepIndex = Math.min(steps.length - 1, Math.floor((slot / Math.max(count, 1)) * steps.length));
      const day = Math.min(days, 1 + Math.floor((slot * (days - 1)) / Math.max(count - 1, 1)));
      rows.push({
        subjectId: subject.id,
        title: `${steps[stepIndex]}: ${subject.name}`,
        note: materialFor(subject.id, slot)?.title || "",
        day,
      });
    }
    return rows;
  }

  function generateQuick() {
    if (!chosen.length) return;
    setError("");
    setDraft(toDraft(quickRows(target)));
    setFromMine(false);
  }

  /** Confere o total que a Mine devolveu: corta o excesso por igual e completa a falta. */
  function fitToTarget(rows: Array<{ subjectId: string; title: string; note: string; day: number }>) {
    if (rows.length > Math.ceil(target * 1.25)) {
      const sorted = [...rows].sort((a, b) => a.day - b.day);
      return Array.from({ length: target }, (_, index) => sorted[Math.floor((index * sorted.length) / target)]);
    }
    if (rows.length < Math.floor(target * 0.8)) {
      return [...rows, ...quickRows(target - rows.length)];
    }
    return rows;
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
      `Ritmo desejado: ${pace}. Crie EXATAMENTE ${target} tarefas no total (${planPaceDaily[pace]}), somando todas as materias. Pode haver dias sem tarefa e dias com mais de uma.`,
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
        setDraft(toDraft(fitToTarget(rows)));
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
                  <span className="text-white/45">· prova em {shortDateWithYear(addDays(days))}</span>
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
                {/* só entrada: com mode="wait" a dica antiga podia ficar presa na tela */}
                <motion.p
                  key={pace}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-2 text-[11px] font-bold text-white/40"
                >
                  {planPaceHint(pace, days, chosen.length)}
                </motion.p>
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
                    const planId = editingPlanId || uid("plan");
                    update((data) => ({ ...data, tasks: [...data.tasks, ...draft.map((task) => ({ ...task, id: uid("task"), planId }))] }));
                    setDraft([]);
                    setEditingPlanId(null);
                    notify("Plano adicionado à agenda.");
                    celebrate(window.innerWidth / 2, window.innerHeight * 0.35, { count: 70, spread: 1.6 });
                    mineSays("Plano no caderno! Já tá tudo na agenda.", "wow");
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
              <span>até {shortDateWithYear(draft[draft.length - 1].dueAt)}</span>
              {fromMine && (
                <span className="inline-flex items-center gap-1.5 text-mint">
                  <Sparkles className="h-3.5 w-3.5" />
                  feito pela Mine
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  // Descartar a edição de um plano salvo devolve as tarefas à agenda.
                  if (editingPlanId) {
                    const planId = editingPlanId;
                    update((data) => ({ ...data, tasks: [...data.tasks, ...draft.map((task) => ({ ...task, id: uid("task"), planId }))] }));
                    setEditingPlanId(null);
                  }
                  setDraft([]);
                }}
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
            {!generating && !draft.length && savedPlan ? (
              <div className="rounded-2xl border border-mint/25 bg-mint/[0.06] p-4">
                <p className="font-black">Último plano salvo na agenda</p>
                <p className="mt-1 text-[13px] font-bold text-white/55">
                  {savedPlan.tasks.length} {savedPlan.tasks.length === 1 ? "tarefa" : "tarefas"} · {savedPlan.tasks.filter((task) => task.done).length} feitas · até{" "}
                  {shortDateWithYear(Math.max(...savedPlan.tasks.map((task) => task.dueAt)))}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={editSavedPlan}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-4 py-2 text-[13px] font-black text-white/80 transition hover:border-mint/40 hover:text-white"
                  >
                    <Pencil className="h-4 w-4" /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={removeSavedPlan}
                    onBlur={() => setConfirmRemove(false)}
                    className="inline-flex items-center gap-2 rounded-xl border border-roseGlow/30 bg-roseGlow/10 px-4 py-2 text-[13px] font-black text-roseGlow transition hover:bg-roseGlow/20"
                  >
                    <Trash2 className="h-4 w-4" /> {confirmRemove ? "Confirmar: tirar da agenda" : "Remover da agenda"}
                  </button>
                </div>
                <p className="mt-2 text-[12px] font-bold text-white/40">Editar ou remover mexe só nas tarefas ainda não feitas.</p>
              </div>
            ) : null}
            {!generating && !draft.length ? (
              <EmptyState
                icon={CalendarPlus}
                title={savedPlan ? "Montar outro plano" : "Sem cronograma ainda"}
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
    celebrateFrom(event.currentTarget as Element, { count: 30 });
    mineSays("Bilhete colado no mural!", "happy");
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
          <Stagger className="caderno-wall mt-6" gap={0.05}>
            {comments.map((comment, index) => (
              <StaggerItem key={comment.id}>
              <article
                className="caderno-note-card group"
                style={{ "--note": ["var(--hl-yellow)", "var(--hl-mint)", "var(--hl-pink)", "var(--hl-lilac)"][index % 4], "--tilt": `${((index * 37) % 7) - 3}deg` } as React.CSSProperties}
              >
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
                <p className="caderno-note-text mt-3 whitespace-pre-line">{comment.text}</p>
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

export const updateCategoryMeta: Record<UpdateCategory, { label: string; icon: LucideIcon }> = {
  novidade: { label: "Novidade", icon: Sparkles },
  melhoria: { label: "Melhoria", icon: Wand2 },
  correcao: { label: "Correção", icon: CheckCircle2 },
};

export const suggestionCategories: Array<{ id: SiteSuggestion["category"]; label: string; icon: LucideIcon }> = [
  { id: "ideia", label: "Ideia", icon: Sparkles },
  { id: "melhoria", label: "Melhoria", icon: Wand2 },
  { id: "erro", label: "Erro", icon: XCircle },
  { id: "conteudo", label: "Conteúdo", icon: BookOpen },
];

export function suggestionStatusLabel(status: SiteSuggestion["status"]) {
  if (status === "planejada") return "Planejada";
  if (status === "analisando") return "Em análise";
  if (status === "concluida") return "Concluída";
  if (status === "recusada") return "Não entrou";
  return "Recebida";
}

export const suggestionStatusOrder: SiteSuggestion["status"][] = ["nova", "analisando", "planejada", "concluida", "recusada"];

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
    launchPlane(event.currentTarget as Element);
    mineSays("Ideia recebida! Vou carimbar quando sair do papel.", "wow");
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
                <article className="caderno-idea-card group">
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
                        <span className={`caderno-stamp-chip is-${suggestion.status}`}>{suggestionStatusLabel(suggestion.status)}</span>
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
              {/* A Mine se apresenta: olha para o cursor, e rabiscos se desenham em volta. */}
              <motion.div
                className="caderno-about-mine grid h-36 w-36 place-items-center rounded-[2.2rem] p-3"
                whileHover={{ rotate: -6, scale: 1.05 }}
                transition={spring.soft}
              >
                <MineFace track />
              </motion.div>
              <Doodle kind="sparkle" className="absolute -right-5 -top-4 h-9 w-9" delay={500} />
              <Doodle kind="heart" className="absolute -bottom-3 -left-4 h-8 w-8 !text-margin" delay={900} />
              <Doodle kind="arrow" className="absolute -right-10 bottom-2 hidden h-10 w-10 md:block" delay={1300} />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-[2rem] font-black leading-tight md:text-5xl">
                <HighlightTitle text="Tudo o que você precisa para aprender, em um só lugar." />
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

export type GameId = "corrida" | "memoria" | "forca" | "caca" | "nexo" | "sequencia";
export type LegacyGameId = "runner";

const gameArtworkAlt: Record<GameId, string> = {
  nexo: "Rede ilustrada de conceitos conectados como uma constelação viva",
  sequencia: "Diagrama de quatro módulos conectados em uma sequência lógica",
  corrida: "Mapa ilustrado de uma rota de estudos entre montanhas e um farol",
  memoria: "Arquivo ilustrado com gavetas conectadas por uma linha de memória",
  forca: "Torre de códigos ilustrada com andares iluminados e antena de sinal",
  caca: "Grade ilustrada de letras com uma palavra marcada e uma lupa",
};

export const gameCatalog: Array<{
  id: GameId;
  name: string;
  tagline: string;
  rule: string;
  icon: LucideIcon;
  accent: string;
  imageAlt: string;
  duration: string;
  difficulty: "Fácil" | "Médio" | "Difícil";
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
    imageAlt: gameArtworkAlt.nexo,
    duration: "15–20 min",
    difficulty: "Fácil",
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
    imageAlt: gameArtworkAlt.sequencia,
    duration: "20–25 min",
    difficulty: "Médio",
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
    imageAlt: gameArtworkAlt.corrida,
    duration: "10–15 min",
    difficulty: "Médio",
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
    imageAlt: gameArtworkAlt.memoria,
    duration: "15–20 min",
    difficulty: "Fácil",
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
    imageAlt: gameArtworkAlt.forca,
    duration: "15–25 min",
    difficulty: "Difícil",
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
    imageAlt: gameArtworkAlt.caca,
    duration: "10–15 min",
    difficulty: "Fácil",
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
 * Ângulos de pedido. A cada partida um deles entra no prompt para empurrar o
 * modelo por um recorte diferente da matéria.
 *
 * Isto é a única alavanca de variação que sobrou. Até a migração para a Azure,
 * as tasks de jogo rodavam a `temperature: 0.95` — o GPT-5 rejeita parâmetros
 * de amostragem, então o adapter da Azure descarta a temperatura e todas as
 * partidas saem no mesmo ponto de amostragem. Prompt e filtro são o que resta.
 */
const gameAngles = [
  "Priorize conceitos e definições centrais.",
  "Priorize processos, etapas e como as coisas acontecem.",
  "Priorize causas, consequências e relações entre ideias.",
  "Priorize aplicações práticas e exemplos do dia a dia.",
  "Priorize comparações, diferenças e casos que costumam ser confundidos.",
  "Priorize detalhes específicos e termos técnicos menos óbvios.",
  "Priorize datas, números, classificações e nomenclatura.",
  "Priorize exceções, casos-limite e o que costuma cair em prova.",
  "Priorize vocabulário e a origem dos termos da área.",
  "Priorize quem descobriu, quando, e o contexto histórico.",
  "Priorize o que conecta esta matéria a outras disciplinas.",
  "Priorize erros comuns e concepções equivocadas sobre o tema.",
];

/**
 * Jogos que consomem o mesmo tipo de conteúdo compartilham memória.
 *
 * Nexo e Arquivo Perdido pedem os mesmos pares termo/definição; Torre e
 * Caça-Palavras pedem os mesmos termos soltos. Guardar por jogo fazia trocar de
 * jogo zerar a memória e devolver exatamente os conceitos que acabaram de sair.
 */
export const gameMemoryShape: Record<GameId, string> = {
  nexo: "pares",
  memoria: "pares",
  corrida: "vf",
  sequencia: "sequencia",
  forca: "palavras",
  caca: "palavras",
};

const seenStorageKey = "minerva-games-vistos-v1";
const angleQueueKey = "minerva-games-angulos-v1";

/**
 * Quantos itens a memória guarda por formato e matéria.
 *
 * O filtro usa a lista inteira; o prompt recebe só os mais recentes
 * (`promptBlocklistSize`). Separar os dois é o que permite uma memória longa
 * sem inchar o pedido: lembrar de 90 termos não custa 90 termos de tokens.
 */
const seenMemorySize = 90;
export const promptBlocklistSize = 35;

/** O que já saiu por formato e matéria, para não repetir nas partidas seguintes. */
export function readSeen(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(seenStorageKey) || "{}") as Record<string, string[]>;
  } catch {
    return {};
  }
}

export function rememberSeen(key: string, items: string[]) {
  try {
    const all = readSeen();
    all[key] = mergeSeen(all[key] || [], items, seenMemorySize);
    localStorage.setItem(seenStorageKey, JSON.stringify(all));
  } catch {
    // Sem armazenamento local a variação fica só por conta do ângulo sorteado.
  }
}

/** Zera a memória de um formato quando a matéria se esgotou. */
export function forgetSeen(key: string) {
  try {
    const all = readSeen();
    delete all[key];
    localStorage.setItem(seenStorageKey, JSON.stringify(all));
  } catch {
    // Nada a fazer: sem armazenamento não havia memória para limpar.
  }
}

/**
 * Sorteia um ângulo sem reposição.
 *
 * Com `Math.random()` puro o mesmo ângulo saía duas, três partidas seguidas — e
 * ângulo repetido com o modelo no mesmo ponto de amostragem devolve quase o
 * mesmo lote. Aqui a fila embaralhada se esgota antes de qualquer repetição.
 */
export function nextGameAngle(key: string): string {
  let fila: number[] = [];
  try {
    const todas = JSON.parse(localStorage.getItem(angleQueueKey) || "{}") as Record<string, number[]>;
    fila = Array.isArray(todas[key]) ? todas[key].filter((index) => index >= 0 && index < gameAngles.length) : [];
    if (!fila.length) fila = shuffle(gameAngles.map((_, index) => index));
    const escolhido = fila.shift() ?? 0;
    localStorage.setItem(angleQueueKey, JSON.stringify({ ...todas, [key]: fila }));
    return gameAngles[escolhido];
  } catch {
    return gameAngles[Math.floor(Math.random() * gameAngles.length)];
  }
}

const recordStorageKey = "minerva-games-recordes-v1";

/** Recordes ficam no aparelho: um por jogo e matéria. */
export function readRecords(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(recordStorageKey) || "{}") as Record<string, number>;
  } catch {
    return {};
  }
}
export function saveRecord(key: string, value: number): boolean {
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

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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

export function materialTypeLabel(type: Material["type"]) {
  return type === "note" ? "Anotações" : type === "file" ? "Arquivos" : type === "link" ? "Links" : "Imagens";
}

export function fallbackUser(): User {
  return {
    id: "fallback",
    name: "Conta removida",
    createdAt: Date.now(),
    settings: { displayName: "Conta removida", dailyGoal: 0, focusMinutes: 0, mineStyle: "equilibrada", reminders: false },
  };
}

function modalTitulo(modal: Modal) {
  const nomes: Partial<Record<Modal["type"], string>> = {
    subject: "Nova matéria",
    material: "Adicionar conteúdo",
    materialView: "Detalhe do conteúdo",
    task: "Tarefa",
    quiz: "Prova",
    mindmap: "Mapa mental",
    confirm: "Confirmação",
  };
  return nomes[modal.type] || "Janela";
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const aberto = Boolean(modal);
  useEffect(() => {
    if (!modal) return;
    const editavel = (alvo: EventTarget | null) => alvo instanceof HTMLElement && Boolean(alvo.closest("input, textarea, select, [contenteditable='true']"));
    // Fora de campos de texto o Escape é tratado na captura: nenhum atalho da
    // tela de baixo consegue engolir. Num campo, espera a bolha para o campo
    // poder usar o Escape antes (cancelar uma edição, por exemplo).
    const naCaptura = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || editavel(event.target)) return;
      event.stopPropagation();
      setModal(null);
    };
    const naBolha = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !editavel(event.target) || event.defaultPrevented) return;
      setModal(null);
    };
    window.addEventListener("keydown", naCaptura, true);
    window.addEventListener("keydown", naBolha);
    return () => {
      window.removeEventListener("keydown", naCaptura, true);
      window.removeEventListener("keydown", naBolha);
    };
  }, [modal, setModal]);

  // Foco entra na janela ao abrir e volta para quem a abriu ao fechar.
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus();
    }, 30);
    return () => {
      window.clearTimeout(timer);
      if (anterior && document.contains(anterior)) anterior.focus();
    };
  }, [aberto]);

  // Tab fica dentro da janela enquanto ela está aberta.
  const prenderFoco = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focaveis = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])")).filter((item) => item.offsetParent !== null || item.classList.contains("sr-only"));
    if (!focaveis.length) return;
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (event.shiftKey && (document.activeElement === primeiro || document.activeElement === dialogRef.current)) {
      event.preventDefault();
      ultimo.focus();
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault();
      primeiro.focus();
    }
  };

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
        className="workspace-shell caderno-modal fixed inset-0 z-50 flex flex-col items-center overflow-x-hidden overflow-y-auto p-4 sm:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        onClick={() => setModal(null)}
      >
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={modalTitulo(modal)}
          tabIndex={-1}
          onKeyDown={prenderFoco}
          initial={{ opacity: 0, y: 34, scale: 0.94, filter: "blur(12px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 22, scale: 0.95, filter: "blur(8px)" }}
          transition={{ duration: 0.34, ease: ease.out }}
          className={`glass-deep relative w-full shrink-0 ${modal.type === "mindmap" ? "my-0 max-w-[90rem] sm:my-auto" : `my-auto ${modal.type === "quiz" ? "max-w-5xl" : modal.type === "subject" ? "max-w-4xl" : "max-w-xl"}`} overflow-hidden rounded-lg p-5 sm:p-6`}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setModal(null)}
            aria-label="Fechar"
            className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
          >
            <X className="h-5 w-5" />
          </button>
          {modal.type === "subject" && (
            <SubjectModal
              user={user}
              update={update}
              close={() => setModal(null)}
              notify={notify}
            />
          )}
          {modal.type === "material" && <MaterialModal user={user} subjectId={modal.subjectId} initialType={modal.kind} update={update} close={() => setModal(null)} notify={notify} />}
          {modal.type === "materialView" &&
            (() => {
              const material = data.materials.find((item) => item.id === modal.materialId);
              if (!material) return null;
              const subject = data.subjects.find((item) => item.id === material.subjectId);
              return <MaterialViewModal material={material} subject={subject} update={update} setModal={setModal} notify={notify} />;
            })()}
          {modal.type === "task" && (
            <React.Suspense fallback={<PageLoading />}>
              <TaskEditor user={user} subjects={data.subjects} tasks={data.tasks} initial={modal} update={update} close={() => setModal(null)} notify={notify} />
            </React.Suspense>
          )}
          {modal.type === "quiz" &&
            (() => {
              const subject = data.subjects.find((item) => item.id === modal.subjectId);
              // Sem matéria e sem tema não há prova nenhuma para abrir; com um
              // dos dois, abre. É o que permite a prova criada no chat sobre um
              // assunto que ainda não virou matéria.
              if (!subject && !modal.topic?.trim()) return null;
              return (
                <QuizModal
                  subject={subject}
                  materials={subject ? data.materials.filter((item) => item.subjectId === subject.id) : []}
                  topic={modal.topic}
                  initialQuestions={modal.initialQuestions}
                  initialMode={modal.initialMode}
                  user={user}
                  update={update}
                  close={() => setModal(null)}
                />
              );
            })()}
          {modal.type === "mindmap" &&
            (() => {
              const subject = data.subjects.find((item) => item.id === modal.subjectId);
              const topic = modal.topic?.trim();
              const mindMapSubject = subject || (topic
                ? {
                    id: `topic-${normalizeText(topic).replace(/[^a-z0-9]+/g, "-")}`,
                    userId: user.id,
                    name: topic,
                    color: "#34D399",
                    icon: "school" as IconName,
                    favorite: false,
                    createdAt: Date.now(),
                  }
                : undefined);
              return mindMapSubject ? <React.Suspense fallback={<PageLoading />}><MindmapModal subject={mindMapSubject} materials={subject ? data.materials.filter((item) => item.subjectId === subject.id) : []} initialMap={modal.initialMap} close={() => setModal(null)} onFlashcards={subject ? (cards) => {
                const existing = new Set(data.flashcards.filter((card) => card.subjectId === subject.id).map((card) => normalizeText(card.front)));
                const fresh = cards
                  .filter((card) => {
                    const key = normalizeText(card.front);
                    if (!key || existing.has(key)) return false;
                    existing.add(key);
                    return true;
                  })
                  .map((card) => ({ id: uid("card"), userId: subject.userId, subjectId: subject.id, front: card.front.slice(0, 300), back: card.back.slice(0, 700), level: 0, dueAt: Date.now(), reps: 0, lapses: 0, createdAt: Date.now() }));
                if (fresh.length) update((draft) => ({ ...draft, flashcards: [...draft.flashcards, ...fresh] }));
                return fresh.length;
              } : undefined} /></React.Suspense> : null;
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
        const id = uid("subject");
        update((draft) => ({
          ...draft,
          subjects: [...draft.subjects, { id, userId: user.id, name: name.trim(), color, icon: iconName, favorite: false, createdAt: Date.now() }],
        }));
        notify("Matéria criada.");
        anunciarMateria({ id, name: name.trim(), color });
        close();
      }}
      className="relative"
    >
      <header className="flex items-start justify-between gap-5 border-b border-white/[0.08] pb-5">
        <div className="min-w-0">
          <p className="caderno-note">Nova coleção de estudos</p>
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

function MaterialModal({ user, subjectId, initialType, update, close, notify }: { user: User; subjectId: string; initialType?: Material["type"]; update: (next: (draft: AppData) => AppData) => void; close: () => void; notify: (message: string) => void }) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [type, setType] = useState<Material["type"]>(initialType || "note");
  const [dataUrl, setDataUrl] = useState<string | undefined>(undefined);
  const [content, setContent] = useState<string | undefined>(undefined);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const savedIdRef = useRef<string | null>(null);
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
      onSubmit={async (event) => {
        event.preventDefault();
        if (!title.trim() || saving || reading) return;
        if (type === "link" && !normalizeMaterialLink(detail)) {
          setSaveError("Esse endereço não é um link válido. Use algo como https://site.com/pagina.");
          return;
        }
        // Numa nova tentativa o item já está no caderno: só grava de novo.
        let id = savedIdRef.current;
        if (!id) {
          id = uid("material");
          savedIdRef.current = id;
          const novoId = id;
          const linkDetail = type === "link" ? normalizeMaterialLink(detail) : "";
          update((draft) => ({
            ...draft,
            materials: [...draft.materials, { id: novoId, userId: user.id, subjectId, title: title.trim(), detail: linkDetail || detail.trim() || (isFileType ? fileName : ""), dataUrl, content, type, folder: "Geral", studied: false, favorite: false, createdAt: Date.now() }],
          }));
        }
        if (!dataUrl) {
          notify("Conteúdo adicionado.");
          close();
          return;
        }
        // Anexo pesa e é o que some se o PUT falhar: espera o servidor confirmar.
        setSaving(true);
        setSaveError("");
        const idSalvo = id;
        const resultado = await confirmarGravacao((estado) => estado.materials.some((item) => item.id === idSalvo));
        setSaving(false);
        if (resultado.ok || resultado.motivo === "sem-conta") {
          notify(type === "image" ? "Imagem salva no caderno." : "Arquivo salvo no caderno.");
          close();
          return;
        }
        setSaveError(
          resultado.motivo === "cheio"
            ? "O caderno ficou pesado demais para salvar este anexo no servidor. Ele aparece agora, mas pode sumir ao recarregar: apague anexos antigos ou use um arquivo menor e tente de novo."
            : "Não consegui salvar no servidor. O anexo aparece agora, mas pode sumir ao recarregar. Confira a conexão e tente de novo.",
        );
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
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.04] px-4 py-4 text-sm font-black text-white/72 transition focus-within:border-mint focus-within:ring-2 focus-within:ring-mint/60 hover:border-mint/40 hover:bg-mint/10">
            <Paperclip className="h-5 w-5" />
            {reading ? "Lendo arquivo..." : fileName ? `Trocar (${fileName})` : "Escolher arquivo"}
            {/* sr-only em vez de hidden: o campo continua alcançável pelo Tab. */}
            <input
              type="file"
              className="sr-only"
              accept={type === "image" ? "image/*" : "image/*,.pdf,.txt,.md,.csv,.doc,.docx,.ppt,.pptx,.xls,.xlsx"}
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
                // Deixa escolher o mesmo arquivo de novo.
                event.target.value = "";
              }}
            />
          </label>
          {content ? <p className="mt-2 text-xs font-bold text-mint">Texto extraído ({content.length.toLocaleString("pt-BR")} caracteres) — a Mine vai analisar este conteúdo.</p> : null}
          {dataUrl && dataUrl.startsWith("data:image/") ? <img src={dataUrl} alt={title} className="mt-3 max-h-40 rounded-2xl border border-white/10" /> : null}
          {!content && dataUrl && !dataUrl.startsWith("data:image/") ? <p className="mt-2 text-xs text-white/50">Arquivo salvo, mas sem texto extraído. A Mine analisa melhor PDF, Word, PowerPoint, textos e imagens.</p> : null}
        </div>
      ) : (
        <Input
          label="Detalhes"
          value={detail}
          onChange={(value) => {
            setDetail(value);
            if (saveError) setSaveError("");
          }}
          placeholder={type === "link" ? "Cole o link (YouTube, site...)" : "Escreva a anotação — a Mine vai analisar"}
        />
      )}
      {saveError ? (
        <p role="alert" className="rounded-2xl border border-roseGlow/40 bg-roseGlow/10 px-4 py-3 text-sm font-bold text-white/85">
          {saveError}
        </p>
      ) : null}
      <PrimaryButton icon={Plus} disabled={saving || reading}>
        {saving ? "Salvando no servidor..." : savedIdRef.current ? "Tentar salvar de novo" : "Adicionar"}
      </PrimaryButton>
    </form>
  );
}


export function HeroCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
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

export function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <article className={`studio-card relative rounded-[1.1rem] border border-white/[0.08] bg-[#171c1a] transition-colors duration-control hover:border-white/[0.15] ${className}`}>
      <Spotlight className="h-full rounded-[inherit]" color="rgb(var(--mint) / 0.16)" size={380}>
        <div className="relative p-5 md:p-6">{children}</div>
      </Spotlight>
    </article>
  );
}

export function SectionTitle({ icon: Icon, title, action, hint }: { icon: LucideIcon; title: string; action?: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative grid h-10 w-10 shrink-0 place-items-center border-l-2 border-mint text-mint">
          <Icon className="relative h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate font-display text-[1.3rem] font-black leading-tight tracking-[-.025em] md:text-[1.55rem]">{title}</h2>
          <InkUnderline />
          {hint ? <p className="truncate text-[13px] text-white/45">{hint}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Pill({ icon: Icon, children, tone = "mint" }: { icon: LucideIcon; children: React.ReactNode; tone?: "mint" | "cyan" | "violet" }) {
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

export function Metric({ icon: Icon, value, label, accent = "#34D399" }: { icon: LucideIcon; value: number | string; label: string; accent?: string }) {
  const numeric = typeof value === "number";
  return (
    // Número escrito à mão, sublinhado com o marca-texto da cor do indicador.
    <div className="caderno-metric group" style={{ ["--accent" as string]: accent }}>
      <Icon className="caderno-metric-icon h-[22px] w-[22px]" />
      <p className="caderno-metric-value tabular">
        {numeric ? <CountUp value={value as number} /> : value}
      </p>
      <p className="caderno-metric-label">{label}</p>
    </div>
  );
}

export function PrimaryButton({ children, icon: Icon, onClick, disabled = false }: { children: React.ReactNode; icon?: LucideIcon; onClick?: () => void; disabled?: boolean }) {
  return (
    <motion.button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={spring.snappy}
      className="caderno-btn-pen group relative inline-flex items-center justify-center gap-2 rounded-[.85rem] px-5 py-3 font-black transition-control duration-control hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
    >
      {Icon ? <Icon className={`relative h-[18px] w-[18px] ${Icon === Loader2 ? "animate-spin" : ""}`} /> : null}
      <span className="relative">{children}</span>
    </motion.button>
  );
}

export function SecondaryButton({ children, icon: Icon, onClick }: { children: React.ReactNode; icon?: LucideIcon; onClick?: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={spring.snappy}
      className="caderno-btn-pencil group relative inline-flex items-center justify-center gap-2 px-5 py-3 font-black"
    >
      {Icon ? <Icon className="h-[18px] w-[18px] transition-transform duration-control group-hover:scale-110" /> : null}
      {children}
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
export function Avatar({ name, src, size = 40, ring = false }: { name: string; src?: string; size?: number; ring?: boolean }) {
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

export function EmptyState({ title, text, icon: Icon = Sparkles, action }: { title: string; text: string; icon?: LucideIcon; action?: React.ReactNode }) {
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

function Toast({ message }: { message: string }) {
  const reduced = useSoftMotion();
  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          role="status"
          aria-live="polite"
          initial={reduced ? { opacity: 0, x: "-50%" } : { opacity: 0, y: -40, x: "-50%", rotate: -6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, x: "-50%", rotate: -1, scale: 1 }}
          exit={reduced ? { opacity: 0, x: "-50%" } : { opacity: 0, y: -24, x: "-50%", rotate: 3 }}
          transition={{ type: "spring", stiffness: 420, damping: 24 }}
          className="caderno-toast fixed left-1/2 top-4 z-[90] flex max-w-[min(92vw,30rem)] items-center gap-3 overflow-hidden px-4 py-3 text-[14px] font-bold"
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

/** Mesma normalização usada pela detecção de intenção, para não divergirem. */
export function normalizeText(value: string) {
  return normalizeIntentText(value);
}

export function materialsToImageAttachments(items: Material[]): ChatAttachment[] {
  return items
    .filter((item) => item.type === "image" && !!item.dataUrl && item.dataUrl.startsWith("data:image/"))
    .slice(-3)
    .map((item) => ({ id: item.id, name: item.title, type: "image/png", size: 0, kind: "image" as const, dataUrl: item.dataUrl as string }));
}

export type TrueFalseItem = { statement: string; answer: boolean; explanation: string };
export type HangmanItem = { word: string; hint: string };
export type PairItem = { term: string; definition: string };
export type WordMeaning = { word: string; meaning: string };
/** Formato "TERMO: x / DEFINICAO: y" gerado por `task: "pares"`. */
export function parsePairs(text: string): PairItem[] {
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
export function parseTrueFalse(text: string): TrueFalseItem[] {
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
export function parseHangman(text: string): HangmanItem[] {
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
export function parseWordMeanings(text: string): WordMeaning[] {
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

export function subjectContentContext(subject: Subject, materials: Material[], budgetLimit = 12_000): string {
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
    "Rotas disponíveis: home, agenda, atividades, provas, redacao, leitura, laboratorio, duelo, progress, mine, games, cubo, sala, search, plan, comments, suggestions, about e settings.",
  ].join("\n");
}

const mineEndpoint = "/api/mine/chat";

type MineHistoryItem = { role: ChatMessage["role"]; text: string };

/**
 * Tira do fim do texto um bloco de código que ficou aberto (resposta cortada
 * no meio de um ```linha-do-tempo, ```quiz…). Blocos fechados ficam como estão.
 */
function semBlocoAberto(text: string): string {
  const linhas = text.split("\n");
  let inicio = -1;
  linhas.forEach((linha, index) => {
    if (/^[ \t]*```/.test(linha)) inicio = inicio < 0 ? index : -1;
  });
  return inicio < 0 ? text : linhas.slice(0, inicio).join("\n").trimEnd();
}

export async function requestAssistantResponse(payload: {
  prompt: string;
  history: MineHistoryItem[];
  context: string;
  attachments?: ChatAttachment[];
}): Promise<AssistantResponse> {
  const response = await fetch(mineEndpoint, {
    method: "POST",
    headers: mineHeaders(),
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
    suggestions: Array.isArray(data.suggestions) ? data.suggestions.filter((item: unknown) => typeof item === "string").slice(0, 3) : [],
    notice: typeof data.notice === "string" && data.notice ? data.notice : undefined,
  };
}

/**
 * Mesma chamada, mas em streaming: `onDelta` recebe o texto acumulado a cada
 * pedaço. O evento final traz a versão limpa, que vale mais que a soma dos
 * pedaços, e as fontes da web quando houve pesquisa.
 */
async function streamAssistantResponse(
  payload: { prompt: string; history: MineHistoryItem[]; context: string; attachments?: ChatAttachment[]; webSearch?: boolean; photos?: boolean; tutor?: boolean; profundo?: boolean; caprichar?: boolean; esforco?: MineEsforco; voz?: boolean; controle?: boolean; aluno?: unknown },
  options: {
    onDelta: (text: string) => void;
    signal: AbortSignal;
    onStatus?: (status: MineSearchStatus) => void;
    onReasoning?: (text: string) => void;
    onVisit?: (visit: MineVisit) => void;
  },
): Promise<AssistantResponse> {
  const response = await fetch(mineEndpoint, {
    method: "POST",
    headers: mineHeaders(),
    // 6000 tokens: o raciocínio conta dentro do teto, e com 1500 as
    // explicações longas saíam cortadas ou encurtadas.
    body: JSON.stringify({ ...payload, stream: true, maxOutputTokens: 6000 }),
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
  let thought = "";
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

      let event: {
        type?: string;
        text?: string;
        reply?: string;
        model?: string;
        notice?: string;
        error?: string;
        code?: string;
        sources?: MineSource[];
        suggestions?: unknown;
        stage?: string;
        queries?: unknown;
        reasoning?: string;
        visit?: unknown;
        visits?: unknown;
        label?: unknown;
        actions?: unknown;
      };
      try {
        event = JSON.parse(raw.slice(5).trim());
      } catch {
        continue;
      }

      if (event.type === "delta") {
        streamed += event.text || "";
        options.onDelta(streamed);
      } else if (event.type === "reasoning") {
        thought += event.text || "";
        options.onReasoning?.(thought);
      } else if (event.type === "status" && (event.stage === "visiting" || event.stage === "visited")) {
        const [visit] = cleanVisits([event.visit]);
        if (visit) options.onVisit?.(visit);
      } else if (event.type === "status" && event.stage === "tool") {
        options.onStatus?.({ stage: "tool", label: typeof event.label === "string" ? event.label.slice(0, 60) : "Usando uma ferramenta" });
      } else if (event.type === "status" && (event.stage === "searching" || event.stage === "reading")) {
        options.onStatus?.({
          stage: event.stage,
          queries: Array.isArray(event.queries) ? event.queries.filter((item): item is string => typeof item === "string") : [],
          sources: Array.isArray(event.sources) ? event.sources.filter((source) => typeof source?.url === "string" && /^https?:\/\//i.test(source.url)) : [],
        });
      } else if (event.type === "done") {
        // Se o servidor antigo mandar o marcador no texto, ele sai aqui também.
        const extracted = extractSuggestions(event.reply || streamed);
        const fromServer = Array.isArray(event.suggestions) ? event.suggestions.filter((item): item is string => typeof item === "string") : [];
        done = {
          reply: extracted.text || event.reply || streamed,
          actions: Array.isArray(event.actions) ? (event.actions.filter((item: unknown) => item && typeof (item as { type?: unknown }).type === "string").slice(0, 8) as AssistantAction[]) : [],
          suggestions: (fromServer.length ? fromServer : extracted.suggestions).slice(0, 3),
          notice: event.notice || undefined,
          sources: Array.isArray(event.sources)
            ? event.sources.filter((source) => typeof source?.url === "string" && /^https?:\/\//i.test(source.url))
            : undefined,
          queries: Array.isArray(event.queries) ? event.queries.filter((item): item is string => typeof item === "string").slice(0, 3) : undefined,
          reasoning: typeof event.reasoning === "string" && event.reasoning.trim() ? event.reasoning.trim() : thought.trim() || undefined,
          visits: cleanVisits(event.visits),
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

export async function requestAiTask(
  payload: { prompt: string; task: string; context?: string },
  options?: { signal?: AbortSignal },
): Promise<string> {
  const response = await fetch(mineEndpoint, {
    method: "POST",
    headers: mineHeaders(),
    // Tarefas que devolvem uma lista longa de itens (mapa, jogos) precisam de
    // mais espaço; 1500 truncava o 10º item no meio.
    body: JSON.stringify({
      ...payload,
      maxOutputTokens: ["mindmap", "quiz", "vf", "forca", "caca"].includes(payload.task) ? 2600 : 1500,
    }),
    signal: options?.signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não consegui gerar agora. Tente de novo.");
  return String(data.reply || "");
}

export async function streamGameTask(
  payload: { prompt: string; task: string; context?: string; maxOutputTokens: number },
  options: { signal: AbortSignal; onPartial: (text: string) => void },
): Promise<string> {
  const response = await fetch(mineEndpoint, {
    method: "POST",
    headers: mineHeaders(),
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




type QuizMode = "treino" | "prova";
type QuizDifficulty = "facil" | "medio" | "dificil";
type QuizConfidence = "certeza" | "duvida";
type QuizReviewFilter = "todas" | "incorretas" | "marcadas";

function QuizModal({
  subject,
  materials,
  topic,
  initialQuestions,
  initialMode,
  user,
  update,
  close,
}: {
  /** Ausente quando a prova nasceu no chat sobre um tema solto. */
  subject?: Subject;
  materials: Material[];
  topic?: string;
  /** Questões já geradas pelo chat: a prova abre pronta, sem tela de ajustes. */
  initialQuestions?: QuizQuestion[];
  initialMode?: QuizMode;
  user: User;
  update: (next: (draft: AppData) => AppData) => void;
  close: () => void;
}) {
  const assunto = subject?.name || topic?.trim() || "seus estudos";
  const jaVeioPronta = Boolean(initialQuestions?.length);
  const [status, setStatus] = useState<"config" | "loading" | "ready" | "error">(jaVeioPronta ? "ready" : "config");
  const [runKey, setRunKey] = useState(0);
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<"facil" | "medio" | "dificil">("medio");
  const [mode, setMode] = useState<QuizMode>(initialMode || "treino");
  const [timeMinutes, setTimeMinutes] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialQuestions || []);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<number | null>>(() => Array(initialQuestions?.length || 0).fill(null));
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
    const context = subject
      ? subjectContentContext(subject, materials)
      : `Tema solicitado: ${assunto}. Use conhecimento geral confiável e adequado ao estudo do tema.`;
    const diffLabel = difficulty === "facil" ? "facil" : difficulty === "dificil" ? "dificil" : "media";
    const modeHint = mode === "treino" ? "priorize clareza pedagógica e explicações úteis" : "use enunciados variados e alternativas plausíveis";
    requestAiTask({
      task: "quiz",
      prompt: `Gere ${count} questoes de multipla escolha sobre ${assunto}, com nivel de dificuldade ${diffLabel}; ${modeHint}. Distribua a letra correta entre A, B, C e D.`,
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
    // Sem matéria não há sessão: `Session.subjectId` aponta para uma matéria de
    // verdade, e uma prova sobre tema solto criaria um registro órfão que o
    // Progresso e o ranking não conseguiriam atribuir a lugar nenhum. A prova
    // funciona igual; ela só não entra no histórico.
    if (!subject || !finished || !questions.length || recordedRunRef.current === runKey) return;
    recordedRunRef.current = runKey;
    const materia = subject;
    update((draft) => ({
      ...draft,
      sessions: [
        ...draft.sessions,
        {
          id: uid("session"),
          userId: user.id,
          subjectId: materia.id,
          title: `${mode === "treino" ? "Treino" : "Prova"} de ${materia.name}: ${score}/${questions.length}`,
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
    // No treino a correção é na hora: acertou, confete e a Mine comemora.
    if (mode === "treino") {
      if (option === question.correct) {
        const target = document.querySelector(`[data-quiz-option="${option}"]`);
        celebrateFrom(target, { count: 26, spread: 1 });
        mineSays(["Acertou!", "Mandou bem!", "Isso!", "Arrasou!"][Math.floor(Math.random() * 4)], "happy");
      } else {
        mineSays("Quase! Lê a explicação que eu deixei.", "think");
      }
    }
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
            <h2 className="truncate font-display text-2xl font-black">{assunto}</h2>
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
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/50">Selecionando conceitos, equilibrando alternativas e preparando explicações para {assunto}.</p>
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
                      <button type="button" data-quiz-option={optionIndex} onClick={() => choose(optionIndex)} disabled={isEliminated || (mode === "treino" && picked !== null)} className={`caderno-quiz-opt flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl border px-4 py-3 text-left font-bold transition ${tone} ${isEliminated ? "line-through" : ""} ${revealed && isCorrect ? "is-right" : ""} ${revealed && isPicked && !isCorrect ? "is-wrong" : ""}`}>
                        {/* bolinha de gabarito: o lápis preenche quando você marca */}
                        <span className={`caderno-bubble-opt ${isPicked ? "is-filled" : ""}`}>{String.fromCharCode(65 + optionIndex)}</span>
                        <span className="min-w-0 flex-1">{option}</span>
                        {revealed && isCorrect ? <Doodle kind="check" className="h-7 w-7 shrink-0 caderno-quiz-mark is-right" duration={420} strokeWidth={4} /> : null}
                        {revealed && isPicked && !isCorrect ? <Doodle kind="cross" className="h-6 w-6 shrink-0 caderno-quiz-mark is-wrong" duration={380} strokeWidth={4} /> : null}
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

export type Mindmap = { title: string; branches: { label: string; items: string[] }[] };
export type MindmapSide = "left" | "right";

export function cleanMindmapLabel(text: string) {
  return text
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/\s+/g, " ")
    .replace(/:$/, "")
    .trim();
}

export function parseMindmap(text: string): Mindmap {
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
          {/* A ficha pautada: vira em 3D para mostrar a resposta; ao avaliar,
              sai deslizando e a próxima chega do monte. */}
          <div className="caderno-flash-stage">
            <span className="caderno-flash-pile" aria-hidden />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.button
                key={current.id}
                type="button"
                onClick={() => setRevealed((value) => !value)}
                className="caderno-flash"
                aria-label={revealed ? `Resposta: ${current.back}` : `Pergunta: ${current.front}. Toque para ver a resposta.`}
                initial={{ x: 140, y: -10, rotate: 10, opacity: 0 }}
                animate={{ x: 0, y: 0, rotate: -1.2, opacity: 1 }}
                exit={{ x: -180, y: 30, rotate: -16, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
              >
                <span className={`caderno-flash-inner ${revealed ? "is-flipped" : ""}`}>
                  <span className="caderno-flash-face is-front">
                    <span className="caderno-flash-label">pergunta</span>
                    <span className="caderno-flash-text">{current.front}</span>
                    <span className="caderno-flash-hint">toque para virar ↻</span>
                  </span>
                  <span className="caderno-flash-face is-back">
                    <span className="caderno-flash-label">resposta</span>
                    <span className="caderno-flash-text is-answer">{current.back}</span>
                  </span>
                </span>
              </motion.button>
            </AnimatePresence>
          </div>
          {revealed ? (
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => grade("errei")} className="caderno-grade is-miss">
                Errei
              </button>
              <button onClick={() => grade("dificil")} className="caderno-grade is-hard">
                Difícil
              </button>
              <button onClick={(event) => { floatXp(`+${xpPerAction.cardReview} XP`, event.currentTarget); celebrateFrom(event.currentTarget, { count: 12, spread: 0.6 }); grade("facil"); }} className="caderno-grade is-easy">
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
  const [editError, setEditError] = useState("");
  const linkHref = material.type === "link" ? normalizeMaterialLink(material.detail || "") : "";

  function toggle(patch: Partial<Material>) {
    update((draft) => ({
      ...draft,
      materials: draft.materials.map((item) => (item.id === material.id ? { ...item, ...patch } : item)),
    }));
  }

  function saveEdits() {
    const title = draftTitle.trim();
    if (!title) return;
    let detail = draftDetail.trim();
    if (material.type === "link") {
      detail = normalizeMaterialLink(detail);
      if (!detail) {
        setEditError("Esse endereço não é um link válido. Use algo como https://site.com/pagina.");
        return;
      }
    }
    setEditError("");
    toggle({ title, detail: detail || undefined, content: draftText.trim() || undefined });
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
              onChange={(event) => {
                setDraftDetail(event.target.value);
                if (editError) setEditError("");
              }}
              aria-invalid={Boolean(editError)}
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
          {editError ? (
            <p role="alert" className="text-sm font-bold text-red-200">
              {editError}
            </p>
          ) : null}
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
      {!editing && material.type === "link" && material.detail && !linkHref ? (
        <p className="rounded-2xl border border-roseGlow/40 bg-roseGlow/10 p-4 text-sm font-bold text-white/80">
          “{material.detail}” não é um endereço válido. Toque em editar e cole o link completo.
        </p>
      ) : null}
      {!editing && linkHref ? (
        <a
          href={linkHref}
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
      const hits = next.tasks.filter((task) => {
        const matchesId = action.taskId && task.id === action.taskId;
        const matchesTitle = title && normalizeText(task.title).includes(title);
        return task.userId === userId && !task.done && (matchesId || matchesTitle);
      });
      for (const task of hits) next.tasks = setTaskDone(next.tasks, task.id, true);
      if (hits.length) feedback.push("Tarefa concluída");
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
      const allowed: View[] = ["home", "agenda", "atividades", "provas", "redacao", "leitura", "laboratorio", "ferramentas", "foco", "duelo", "progress", "ranking", "mine", "games", "cubo", "sala", "atelie", "idiomas", "videos", "search", "plan", "comments", "suggestions", "about", "perfil"];
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

export function useMemoUserData() {
  return { subjects: [] as Subject[], materials: [] as Material[], tasks: [] as Task[], chats: [] as ChatMessage[], sessions: [] as Session[], flashcards: [] as Flashcard[], comments: [] as SiteComment[], suggestions: [] as SiteSuggestion[], updates: [] as SiteUpdate[] };
}

const appNode = document.getElementById("app")!;
// Aba escondida: as animações CSS contínuas (rabiscos, órbitas, post-its que
// balançam) ficam paradas até a pessoa voltar. O rAF do framer-motion o
// navegador já suspende sozinho; o CSS não, e segue gastando bateria.
const syncTabVisibility = () => document.documentElement.classList.toggle("is-tab-hidden", document.hidden);
document.addEventListener("visibilitychange", syncTabVisibility);
syncTabVisibility();

const rootHost = window as Window & { __minervaRoot?: Root };
const appRoot = rootHost.__minervaRoot ?? createRoot(appNode);
rootHost.__minervaRoot = appRoot;

appRoot.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
