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
import { NexusGame, SequenceForgeGame } from "../games/NewMinervaGames";
import { GameArtwork, StudyExpeditionMap } from "../games/GameArtwork";
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
import { GameHand } from "../caderno/GameHand";
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
  EmptyState,
  GameId,
  GlassCard,
  HangmanItem,
  HeroCard,
  LegacyGameId,
  PageHeader,
  PairItem,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  Session,
  TrueFalseItem,
  User,
  WordMeaning,
  forgetSeen,
  gameCatalog,
  gameMemoryShape,
  gamificationOf,
  nextGameAngle,
  parseHangman,
  parsePairs,
  parseTrueFalse,
  parseWordMeanings,
  promptBlocklistSize,
  readRecords,
  readSeen,
  rememberSeen,
  saveRecord,
  shuffle,
  streamGameTask,
  subjectContentContext,
  uid,
  useMemoUserData
} from "../main";

export function GameHud({ items }: { items: Array<{ label: string; value: string; tone?: "normal" | "alerta" | "bom" }> }) {
  // Placar em post-its: cada indicador é um papelzinho colado, um pouco torto.
  return (
    <div className="caderno-hud">
      {items.map((item) => (
        <div key={item.label} className={`caderno-hud-note ${item.tone === "alerta" ? "is-alert" : item.tone === "bom" ? "is-good" : ""}`}>
          <p className="caderno-hud-label">{item.label}</p>
          <p className="caderno-hud-value tabular">{item.value}</p>
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
export type GameStoryChapter = { title: string; text: string };

export const gameStories: Record<GameId | LegacyGameId, GameStoryChapter[]> = {
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

export function StoryJourney({ game, successes, goal, compact = false }: { game: GameId | LegacyGameId; successes: number; goal: number; compact?: boolean }) {
  const chapters = gameStories[game];
  const progress = Math.min(1, successes / Math.max(1, goal));
  const chapter = Math.min(chapters.length - 1, Math.floor(progress * chapters.length));
  const current = chapters[chapter];
  const reduced = useSoftMotion();
  const distance = successes * 140;

  // Trilha tracejada no papel: a Mine anda pelos capítulos da história.
  return (
    <div className={`caderno-story ${compact ? "is-compact" : ""}`}>
      {compact ? (
        <div className="flex items-center justify-between gap-3"><p className="caderno-story-kicker">rota da história</p><p className="caderno-story-distance">{distance}m</p></div>
      ) : <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="caderno-story-kicker">capítulo {chapter + 1} de {chapters.length}</p>
          <AnimatePresence mode="wait">
            <motion.div key={current.title} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <p className="caderno-story-title">{current.title}</p>
              <p className="caderno-story-text">{current.text}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="shrink-0 text-right"><p className="caderno-story-distance">{distance}m</p><p className="caderno-story-kicker">percorridos</p></div>
      </div>}
      <div className={`relative ${compact ? "mt-1 h-9" : "mt-4 h-12"}`}>
        <div className="caderno-story-track" />
        <motion.div className="caderno-story-fill" animate={{ width: `${Math.max(1, progress * 96)}%` }} transition={spring.gentle} />
        {chapters.map((item, index) => {
          const point = index / (chapters.length - 1);
          const reached = progress >= point;
          return <span key={item.title} className={`caderno-story-stop ${reached ? "is-reached" : ""}`} style={{ left: `${2 + point * 96}%` }}>{reached ? <Check className="h-2.5 w-2.5" /> : null}</span>;
        })}
        <motion.div className="caderno-story-mine" animate={{ left: `${Math.min(96, progress * 96)}%`, y: reduced ? 0 : [0, -3, 0] }} transition={{ left: spring.gentle, y: { duration: 1, repeat: Infinity } }}><MineFace className="h-8 w-8" /></motion.div>
      </div>
    </div>
  );
}

export function SpeedRunGame({
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
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="caderno-chapter">
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center py-1 text-center">
          <motion.div animate={{ y: [0, -5, 0], rotate: ending ? 0 : [0, 4, 0] }} transition={{ duration: 2.2, repeat: Infinity }} className={`caderno-chapter-badge ${ending ? "is-end" : ""}`}>
            {ending ? <Trophy className="h-7 w-7" /> : <MineFace className="h-10 w-10" />}
          </motion.div>
          <p className="caderno-note mt-3">{ending ? "destino alcançado" : mode === "intro" ? "prólogo" : `capítulo ${chapterIndex + 1}`}</p>
          <h2 className="caderno-chapter-title">{ending ? "O farol voltou a brilhar" : scene.title}</h2>
          <p className="caderno-chapter-text">{ending ? "A mensagem atravessou a floresta e chegou à cidade. A Mine completou a jornada porque você dominou os desafios." : scene.text}</p>
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

      {/* o relógio é um lápis que vai sendo gasto */}
      <div className="caderno-timer" aria-hidden>
        <motion.div
          className={`caderno-timer-fill ${segundos <= 10 ? "is-low" : ""}`}
          animate={{ width: `${fracao * 100}%` }}
          transition={{ duration: 0.1, ease: "linear" }}
        />
      </div>

      <motion.div
        animate={flash === "acerto" ? { scale: [1, 1.015, 1] } : flash === "erro" ? { x: [0, -9, 9, -5, 0] } : {}}
        transition={{ duration: 0.3 }}
        className={`caderno-tf-card ${flash === "acerto" ? "is-right" : flash === "erro" ? "is-wrong" : ""}`}
      >
        <p className="caderno-tf-count">afirmação {indice + 1}/{items.length}</p>
        <p className="caderno-tf-statement">{atual?.statement}</p>
        {flash ? (
          <div className="mt-3 max-w-3xl" role="status" aria-live="polite">
            <p className="caderno-tf-feedback">{feedback || "A Mine está preparando a justificativa desta resposta."}</p>
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
              className={`caderno-tf-stamp ${flash === "acerto" ? "is-right" : "is-wrong"}`}
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
          className="caderno-tf-btn is-true"
        >
          <Doodle kind="check" className="h-7 w-7" strokeWidth={4} />
          Verdadeiro
        </motion.button>
        <motion.button
          type="button"
          onClick={() => responder(false)}
          disabled={!vivo || !!flash}
          whileTap={{ scale: 0.96 }}
          transition={spring.snappy}
          className="caderno-tf-btn is-false"
        >
          <Doodle kind="cross" className="h-6 w-6" strokeWidth={4} />
          Falso
        </motion.button>
      </div>
      <p className="caderno-game-tip">Acerto devolve 3s · erro tira 5s · 3 acertos seguidos sobem o multiplicador</p>
    </div>
  );
}

/**
 * Jogo da Memória — pares de termo e definição.
 * A nota sai de jogadas e tempo, então decorar a posição das cartas vale tanto
 * quanto saber a matéria.
 */
export function MemoryGame({
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
      <div className="caderno-memo-grid">
        {baralho.map((carta, cartaIndex) => {
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
              className={`caderno-memo ${aberta ? "is-open" : ""} ${feito ? "is-done" : ""} ${errada ? "is-wrong" : ""}`}
              style={{ "--tilt": `${((cartaIndex % 5) - 2) * 0.8}deg` } as React.CSSProperties}
            >
              {/* ficha de duas faces: o verso tem o rabisco, a frente o conteúdo */}
              <span className="caderno-memo-inner">
                <span className="caderno-memo-face is-back" aria-hidden={aberta}>
                  <Doodle kind={(["star", "spiral", "heart", "bolt", "flower", "cloud"] as const)[cartaIndex % 6]} className="h-9 w-9" strokeWidth={2.4} />
                </span>
                <span className={`caderno-memo-face is-front ${carta.tipo === "termo" ? "is-term" : ""}`} aria-hidden={!aberta}>
                  <span className="caderno-memo-kind">{carta.tipo === "termo" ? "termo" : "definição"}</span>
                  <span className="caderno-memo-text">{carta.texto}</span>
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>
      <p className="caderno-game-tip">Ligue cada termo à definição certa. Menos jogadas, nota maior.</p>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Caça-palavras
 * ------------------------------------------------------------------------- */

export type WordPlacement = { word: string; meaning: string; cells: number[] };
export type WordSearchBoard = { size: number; letters: string[]; placements: WordPlacement[] };

/** As oito direções. A diagonal é o que separa um caça-palavras de uma lista. */
export const wordSearchDirections: Array<[number, number]> = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

export const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

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
export function buildWordSearch(items: WordMeaning[], max = 9): WordSearchBoard {
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
export function wordSearchPath(from: number, to: number, size: number): number[] | null {
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

export function sameCells(a: number[], b: number[]) {
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
export function WordSearchGame({
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
            className="caderno-ws-grid mx-auto grid w-full max-w-[32rem] touch-none select-none"
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
                  className={`caderno-ws-cell ${achada ? "is-found" : naLinha ? "is-path" : ancorada ? "is-anchor" : ""}`}
                >
                  {letra}
                </button>
              );
            })}
          </motion.div>
          <p className="caderno-game-tip mt-3">
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
                className="caderno-ws-found"
                aria-live="polite"
              >
                <span className="caderno-ws-tape" aria-hidden />
                <p className="caderno-note">você achou!</p>
                <p className="caderno-ws-word">{revelada.word}</p>
                <p className="caderno-ws-meaning">{revelada.meaning}</p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="caderno-ws-list">
            <div className="flex items-center justify-between gap-3">
              <p className="caderno-ws-list-title">termos para encontrar</p>
              <span className="caderno-ws-list-mode">
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
                      className={`caderno-ws-item ${achada ? "is-found" : ""}`}
                    >
                      <span className="flex items-center gap-2">
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

      <section className="caderno-ws-glossary">
        <div className="caderno-ws-glossary-head">
          <div className="flex items-center gap-3">
            <span className="caderno-ws-glossary-icon">
              <BookOpen className="h-[18px] w-[18px]" />
            </span>
            <div>
              <h3 className="caderno-ws-glossary-title">Glossário descoberto</h3>
              <p className="caderno-ws-glossary-sub">Toda palavra encontrada e a definição ficam aqui.</p>
            </div>
          </div>
          <span className="caderno-ws-glossary-count">
            {found.length} de {total}
          </span>
        </div>

        <div className="p-4 sm:p-5">
          <AnimatePresence initial={false} mode="popLayout">
            {!found.length ? (
              <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="caderno-game-tip py-3">
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
                    className="caderno-ws-entry"
                  >
                    <p className="caderno-ws-entry-word">{item.word}</p>
                    <p className="caderno-ws-entry-meaning">{item.meaning}</p>
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
export function HangmanFigure({ erros }: { erros: number }) {
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
      {/* A torre desenhada a caneta: cada andar é um risco de marca-texto que
          some (riscado em vermelho) a cada letra errada. */}
      <svg viewBox="0 0 180 220" aria-hidden="true" className="code-tower-sketch">
        <path className="code-tower-sketch-body" d="M33 198 46 53 90 18l44 35 13 145Z" />
        <path className="code-tower-sketch-line" d="M47 53 90 18l43 35" />
        <path className="code-tower-sketch-ground" d="M22 199c30-3 60 2 90-1s30 1 46 0" />
        <path className="code-tower-sketch-door" d="m68 198 4-22a18 18 0 0 1 36 0l4 22" />
        {[0, 1, 2, 3, 4, 5].map((level) => {
          const active = level >= erros;
          const y = 151 - level * 21;
          return (
            <g key={level} className={active ? "is-on" : "is-off"}>
              <rect className="code-tower-sketch-floor" x="58" y={y} width="64" height="13" rx="3" />
              {!active ? <path className="code-tower-sketch-cross" d={`M56 ${y + 12} L124 ${y + 1}`} /> : null}
            </g>
          );
        })}
        <motion.path
          className={`code-tower-sketch-flag ${energia ? "" : "is-out"}`}
          d="M90 18V4l14 5-14 5"
          animate={reduzido ? undefined : { rotate: [0, -6, 0, 5, 0] }}
          style={{ transformOrigin: "90px 18px" }}
          transition={{ duration: 2.4, repeat: Infinity }}
        />
      </svg>
      <div className="code-tower-energy-readout" aria-hidden="true">
        <span>energia do selo</span>
        <strong>{energia}<small>/6</small></strong>
      </div>
    </div>
  );
}

export function HangmanGame({
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
 * Boletim da partida: a nota escrita à caneta, o carimbo de recorde e o XP
 * marcado com marca-texto. Chega com confete quando a partida foi boa.
 */
export function GameResultSheet({
  pontos,
  xp,
  acertos,
  total,
  recorde,
  recordeAnterior,
  jogo,
  materia,
  onAgain,
  onExit,
}: {
  pontos: number;
  xp: number;
  acertos: number;
  total: number;
  recorde: boolean;
  recordeAnterior: number;
  jogo: string;
  materia: string;
  onAgain: () => void;
  onExit: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const aproveitamento = total ? acertos / total : 0;
  const recado = aproveitamento >= 0.9 ? "Perfeito! Tirou de letra." : aproveitamento >= 0.6 ? "Mandou bem! Mais uma?" : "Quase! Bora treinar de novo?";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (recorde || aproveitamento >= 0.6) celebrateFrom(ref.current, { count: recorde ? 40 : 24, spread: 1.2 });
      mineSays(recado, aproveitamento >= 0.6 ? "happy" : "think");
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="caderno-result">
      <span className="caderno-result-tape" aria-hidden />
      <div ref={ref} className="caderno-result-grade">
        <Doodle kind="circle" className="caderno-result-ring" duration={900} delay={200} strokeWidth={2.6} stretch />
        <span className="caderno-result-points tabular">{pontos}</span>
        <span className="caderno-result-unit">pontos</span>
      </div>
      {recorde ? <p className="caderno-result-stamp">novo recorde!</p> : null}
      <p className="caderno-result-meta">{jogo}{materia ? ` · ${materia}` : ""}</p>
      <p className="caderno-result-xp">
        <Zap className="h-4 w-4" />
        <mark>+{xp} XP</mark> · {acertos}/{total} acertos
      </p>
      <div className="caderno-result-bubbles" aria-hidden>
        {Array.from({ length: Math.max(total, 0) }).map((_, index) => (
          <span key={index} className={index < acertos ? "is-on" : ""} style={{ animationDelay: `${0.4 + index * 0.08}s` }} />
        ))}
      </div>
      <p className="caderno-result-note">{recado}</p>
      {!recorde && recordeAnterior ? <p className="caderno-result-record">seu recorde: {recordeAnterior}</p> : null}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <PrimaryButton icon={RotateCcw} onClick={onAgain}>Jogar de novo</PrimaryButton>
        <SecondaryButton icon={Gamepad2} onClick={onExit}>Outros jogos</SecondaryButton>
      </div>
    </div>
  );
}

/**
 * Games com a Mine: o conteúdo de cada partida sai dos materiais que o usuário
 * cadastrou na matéria, então não é trivia genérica — é a matéria dele.
 */
export function GameIntro({
  jogo,
  materia,
  questionCount,
  pronto,
  recorde,
  aviso,
  onStart,
  onBack,
}: {
  jogo: (typeof gameCatalog)[number];
  materia: string;
  questionCount: GameQuestionCount;
  pronto: boolean;
  recorde: number;
  /** Recado da rodada. Hoje: o repertório da matéria se esgotou e recomeçou. */
  aviso?: string;
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
      {/* Ficha da missão: foto do cenário presa com fita, a missão marcada com
          marca-texto e os passos como uma lista de caderno. */}
      <article className="caderno-gi" style={accentStyle}>
        <div className="caderno-gi-grid">
          <section className="caderno-gi-left">
            <div className="flex items-start justify-between gap-4">
              <div className="caderno-gi-emblem" aria-hidden="true">
                <Icon className="h-8 w-8 sm:h-9 sm:w-9" />
              </div>
              <span className={`caderno-gi-status ${pronto ? "is-ready" : ""}`} aria-live="polite">
                {pronto ? "✓ partida pronta" : (
                  <>
                    <MineFace thinking className="h-6 w-6" />
                    a Mine está escrevendo...
                  </>
                )}
              </span>
            </div>

            <figure className="caderno-gi-photo">
              <span className="caderno-gi-tape" aria-hidden />
              <GameArtwork game={jogo.id} accent={jogo.accent} label={jogo.imageAlt} className="h-full w-full" />
              <figcaption>cenário da missão</figcaption>
            </figure>

            <div className="mt-6">
              <p className="caderno-note">ficha da missão</p>
              <h2 className="caderno-gi-title">{jogo.name}</h2>
              <p className="caderno-gi-tagline">{jogo.tagline}</p>
            </div>

            <div className="caderno-gi-goal">
              <span className="caderno-gi-label"><Target className="h-4 w-4" /> sua missão</span>
              <p><mark>{jogo.goal}</mark></p>
            </div>

            <div className="caderno-gi-rule">
              <span className="caderno-gi-label">regra principal</span>
              <p>{jogo.rule}</p>
            </div>

            <div className="caderno-gi-stats">
              <div className="caderno-gi-stat is-a">
                <span>perguntas</span>
                <strong>{questionCount}</strong>
              </div>
              <div className="caderno-gi-stat is-b">
                <span>prêmio</span>
                <strong>+{xpPerAction.game} XP</strong>
              </div>
              <div className="caderno-gi-stat is-c">
                <span>recorde</span>
                <strong>{recorde || "—"}</strong>
              </div>
            </div>
          </section>

          <section className="caderno-gi-right">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="caderno-note">como jogar</p>
                <h3 className="caderno-gi-subtitle">Entenda em poucos passos</h3>
              </div>
              <Doodle kind="bulb" className="h-12 w-12 shrink-0 text-[var(--game-accent)]" strokeWidth={2.6} />
            </div>

            <ol className="caderno-gi-steps">
              {jogo.howTo.map((passo, index) => (
                <motion.li
                  key={passo}
                  initial={reduzido ? false : { opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: reduzido ? 0 : 0.12 + index * 0.08, ease: ease.out }}
                >
                  <span className="caderno-gi-step-num">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="caderno-gi-step-when">
                      {index === 0 ? "primeiro" : index === jogo.howTo.length - 1 ? "para concluir" : "depois"}
                    </p>
                    <p className="caderno-gi-step-text">{passo}</p>
                  </div>
                </motion.li>
              ))}
            </ol>
          </section>
        </div>

        {aviso ? (
          <p role="status" className="caderno-gi-aviso">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{aviso}</span>
          </p>
        ) : null}

        <div className="caderno-gi-foot">
          <div className="min-w-0">
            <p className="caderno-gi-label">matéria</p>
            <p className="caderno-gi-subject">{materia || "Conteúdo geral"}</p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <button type="button" onClick={onBack} className="caderno-btn-pencil inline-flex min-h-12 items-center justify-center gap-2 px-5 text-[13px] font-black">
              <ChevronLeft className="h-4 w-4" />
              Outros jogos
            </button>
            <button type="button" onClick={onStart} disabled={!pronto} className="caderno-gi-play">
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

export type GameQuestionCount = 4 | 6 | 8;

export function GameSetup({
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
      {/* Folha de configuração: bolinhas de gabarito para o tamanho e um
          interruptor desenhado para a prévia das palavras. */}
      <article className="caderno-gs">
        <div className="relative mx-auto max-w-4xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="caderno-gs-badge">
                <Gamepad2 className="h-7 w-7" />
              </span>
              <div>
                <p className="caderno-note">preparar partida</p>
                <h2 className="caderno-gs-title">Configure <span className="caderno-hl">{gameName}</span></h2>
                <p className="caderno-gs-sub">A Mine vai criar perguntas novas usando {subject || "a matéria escolhida"}.</p>
              </div>
            </div>
            <span className="caderno-gs-chip">✎ conteúdo novo</span>
          </div>

          <div className={`mt-8 grid gap-5 ${isWordSearch ? "lg:grid-cols-2" : "mx-auto max-w-xl"}`}>
            <section className="caderno-gs-card">
              <h3 className="caderno-gs-card-title">1. Quantas perguntas?</h3>
              <p className="caderno-gs-card-sub">Cada acerto vale 5 XP; erro não tira nada.</p>

              <div className="mt-5 grid grid-cols-3 gap-3" role="radiogroup" aria-label="Quantidade de perguntas">
                {([4, 6, 8] as GameQuestionCount[]).map((option) => {
                  const selected = option === count;
                  return (
                    <motion.button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onCountChange(option)}
                      whileTap={reduzido ? undefined : { scale: 0.92 }}
                      className={`caderno-gs-bubble ${selected ? "is-on" : ""}`}
                    >
                      <span className="caderno-gs-bubble-dot">{option}</span>
                      <span className="caderno-gs-bubble-label">perguntas</span>
                    </motion.button>
                  );
                })}
              </div>
            </section>

            {isWordSearch ? <section className="caderno-gs-card">
              <h3 className="caderno-gs-card-title">2. Prévia das palavras</h3>
              <p className="caderno-gs-card-sub">Mostrar os termos na lista antes de você achar?</p>

              <button
                type="button"
                role="switch"
                aria-checked={showPreviews}
                onClick={() => onPreviewChange(!showPreviews)}
                className={`caderno-gs-switch ${showPreviews ? "is-on" : ""}`}
              >
                <span className="min-w-0">
                  <span className="caderno-gs-switch-label">{showPreviews ? <><Eye className="h-4 w-4" /> palavras visíveis</> : <><EyeOff className="h-4 w-4" /> palavras escondidas</>}</span>
                  <span className="caderno-gs-switch-hint">As definições aparecem depois do acerto.</span>
                </span>
                <span className="caderno-gs-toggle" aria-hidden>
                  <motion.span
                    className="caderno-gs-knob"
                    animate={{ x: showPreviews ? 22 : 0, rotate: showPreviews ? 180 : 0 }}
                    transition={reduzido ? { duration: 0 } : spring.snappy}
                  />
                </span>
              </button>
            </section> : null}
          </div>

          <div className="caderno-gs-foot">
            <button type="button" onClick={onBack} className="caderno-btn-pencil inline-flex min-h-12 items-center justify-center gap-2 px-5 text-[13px] font-black">
              <ChevronLeft className="h-4 w-4" />
              Outros jogos
            </button>
            <button type="button" onClick={onConfirm} className="caderno-gi-play">
              Criar com {count} perguntas
              <ArrowRight className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </article>
    </Reveal>
  );
}

export type GamesHubTab = "jogar" | "diario" | "missoes" | "erros" | "historico" | "temporada";

export const gamesHubTabs: Array<{ id: GamesHubTab; label: string; hint: string; icon: LucideIcon }> = [
  { id: "jogar", label: "Jogar", hint: "6 aventuras", icon: Gamepad2 },
  { id: "diario", label: "Desafio", hint: "5 perguntas", icon: CalendarCheck },
  { id: "missoes", label: "Missões", hint: "Metas do dia", icon: Target },
  { id: "erros", label: "Erros", hint: "Revisão ativa", icon: BookOpen },
  { id: "historico", label: "Histórico", hint: "Suas partidas", icon: ListChecks },
  { id: "temporada", label: "Liga", hint: "Ranking mensal", icon: Trophy },
];

export function GamesHubNav({ active, onChange, errorCount }: { active: GamesHubTab; onChange: (tab: GamesHubTab) => void; errorCount: number }) {
  const reduced = useSoftMotion();
  const tones = ["yellow", "pink", "lilac", "mint", "blue", "orange"];
  return (
    // Divisórias de fichário: cada área é uma aba colorida; a ativa ganha o
    // risco de marca-texto que desliza entre elas.
    <nav aria-label="Áreas dos jogos" className="caderno-gnav">
      <div className="caderno-gnav-head">
        <div>
          <p className="caderno-note">central dos jogos</p>
          <p className="caderno-gnav-title">Escolha onde continuar</p>
        </div>
        <span className="caderno-gnav-saved">✓ progresso salvo</span>
      </div>
      <div className="caderno-gnav-scroll">
        <div className="caderno-gnav-grid">
          {gamesHubTabs.map((tab, index) => {
            const activeTab = tab.id === active;
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={activeTab ? "page" : undefined}
                onClick={() => onChange(tab.id)}
                className={`caderno-gtab group ${activeTab ? "is-active" : ""}`}
                data-tone={tones[index % tones.length]}
              >
                {activeTab ? (
                  reduced ? (
                    <span aria-hidden className="caderno-gtab-mark" />
                  ) : (
                    <motion.span layoutId="games-hub-active" aria-hidden className="caderno-gtab-mark" transition={spring.snappy} />
                  )
                ) : null}
                <span className="caderno-gtab-icon">
                  <tab.icon className="h-5 w-5" />
                </span>
                <span className="relative min-w-0 flex-1">
                  <span className="caderno-gtab-label">{tab.label}</span>
                  <span className="caderno-gtab-hint">{tab.hint}</span>
                </span>
                {tab.id === "erros" && errorCount > 0 ? <span className="caderno-gtab-count">{errorCount}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export function formatGameDuration(durationMs?: number) {
  const seconds = Math.max(0, Math.round(Number(durationMs || 0) / 1000));
  if (!seconds) return "—";
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}min ${seconds % 60}s`;
}

export function DailyChallengePanel({ data, user, update }: { data: ReturnType<typeof useMemoUserData>; user: User; update: (next: (draft: AppData) => AppData) => void }) {
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
            <p className="caderno-note">Desafio de hoje concluído</p>
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
        <div><p className="caderno-note">Mesmo desafio, mesma regra</p><h2 className="mt-1 font-display text-2xl font-black">Questão {index + 1} de {questions.length}</h2></div>
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

export function GameMissionsPanel({ sessions }: { sessions: Session[] }) {
  const missions = dailyMissionProgress(sessions);
  const completed = missions.filter((mission) => mission.completed).length;
  return (
    <div className="grid gap-4">
      <HeroCard><p className="caderno-note">Renova à meia-noite</p><h2 className="mt-1 font-display text-3xl font-black">{completed}/{missions.length} missões cumpridas</h2><p className="mt-2 text-sm font-bold text-white/48">As recompensas entram automaticamente nos pontos da temporada. Elas nunca adicionam XP.</p></HeroCard>
      <div className="grid gap-3 md:grid-cols-2">
        {missions.map((mission) => <GlassCard key={mission.id}>
          <div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${mission.completed ? "bg-mint text-black" : "bg-white/[0.07] text-white/35"}`}>{mission.completed ? <Check className="h-5 w-5" /> : <Target className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><p className="font-display text-lg font-black">{mission.title}</p><p className="text-[12px] font-bold text-white/42">{mission.description}</p></div><span className="shrink-0 rounded-full bg-amber-300/12 px-2 py-1 text-[10px] font-black text-amber-300">+{mission.reward} PTS</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-mint" style={{ width: `${Math.min(100, (mission.current / mission.goal) * 100)}%` }} /></div><p className="mt-1.5 text-right text-[10px] font-black text-white/35">{mission.current}/{mission.goal}</p></div></div>
        </GlassCard>)}
      </div>
    </div>
  );
}

export function GameErrorsPanel({ data, user, update }: { data: ReturnType<typeof useMemoUserData>; user: User; update: (next: (draft: AppData) => AppData) => void }) {
  const errors = unresolvedGameErrors(data.sessions);
  function review(answer: GameAnswer) {
    update((draft) => ({ ...draft, sessions: [...draft.sessions, { id: uid("session"), userId: user.id, subjectId: answer.subjectId || "games", title: `Erro revisado: ${answer.prompt}`, kind: "GameReview", createdAt: Date.now(), reviewedErrorIds: [answer.id], reviewCount: 1, mode: "review" }] }));
  }
  if (!errors.length) return <GlassCard><EmptyState icon={CheckCircle2} title="Caderno em dia" text="Quando você errar uma pergunta, ela aparecerá aqui com a resposta correta e a explicação." /></GlassCard>;
  return <div className="grid gap-3">{errors.map((answer) => <GlassCard key={answer.id}>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.16em] text-roseGlow">{answer.gameName || "Jogo"} · {new Date(answer.createdAt || 0).toLocaleDateString("pt-BR")}</p><h3 className="mt-1 font-display text-lg font-black leading-snug">{answer.prompt}</h3><div className="mt-3 grid gap-2 text-[13px] font-bold sm:grid-cols-2"><p className="rounded-xl bg-roseGlow/8 p-3 text-roseGlow/85"><span className="block text-[9px] uppercase tracking-[.15em] text-white/32">Sua resposta</span>{answer.userAnswer || "Sem resposta"}</p><p className="rounded-xl bg-mint/8 p-3 text-mint"><span className="block text-[9px] uppercase tracking-[.15em] text-white/32">Resposta correta</span>{answer.correctAnswer}</p></div>{answer.explanation ? <p className="mt-3 text-[13px] font-bold leading-relaxed text-white/48">{answer.explanation}</p> : null}</div><SecondaryButton icon={CheckCircle2} onClick={() => review(answer)}>Marcar revisado</SecondaryButton></div>
  </GlassCard>)}</div>;
}

export function GameHistoryPanel({ data }: { data: ReturnType<typeof useMemoUserData> }) {
  const sessions = [...data.sessions].filter((session) => session.kind === "Games").sort((a, b) => b.createdAt - a.createdAt);
  if (!sessions.length) return <GlassCard><EmptyState icon={Gamepad2} title="Nenhuma partida ainda" text="Seu histórico mostrará jogo, matéria, acertos, XP, pontuação e duração." /></GlassCard>;
  return <div className="grid gap-2.5">{sessions.map((session) => {
    const subject = data.subjects.find((item) => item.id === session.subjectId)?.name || (session.dailyChallenge ? "Conhecimentos gerais" : "Matéria removida");
    const correct = Number(session.correctAnswers || 0); const total = Number(session.questionsAnswered || 0); const accuracy = total ? Math.round((correct / total) * 100) : 0;
    return <div key={session.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint/10 text-mint"><Gamepad2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate font-display text-base font-black">{session.gameName || gameNames[session.gameId || ""] || session.title}</p><p className="mt-0.5 text-[11px] font-bold text-white/38">{subject} · {new Date(session.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p></div><div className="grid grid-cols-4 gap-2 text-center sm:min-w-[22rem]"><div><p className="font-display text-base font-black text-mint">{correct}/{total}</p><p className="text-[9px] font-black uppercase text-white/30">acertos</p></div><div><p className="font-display text-base font-black">{accuracy}%</p><p className="text-[9px] font-black uppercase text-white/30">precisão</p></div><div><p className="font-display text-base font-black text-amber-300">+{session.xpEarned || 0}</p><p className="text-[9px] font-black uppercase text-white/30">XP</p></div><div><p className="font-display text-base font-black">{formatGameDuration(session.durationMs)}</p><p className="text-[9px] font-black uppercase text-white/30">tempo</p></div></div></div></div>;
  })}</div>;
}

export function GameSeasonPanel({ sessions }: { sessions: Session[] }) {
  const season = currentSeason();
  const points = seasonPoints(sessions);
  const league = leagueFromPoints(points);
  const unlocked = unlockedGameAchievementIds(sessions);
  const remainingDays = Math.max(1, Math.ceil((season.endAt - Date.now()) / 86_400_000));
  return <div className="grid gap-4">
    <HeroCard><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="caderno-note">{season.name} · {remainingDays} dias restantes</p><h2 className="mt-1 font-display text-4xl font-black" style={{ color: league.color }}>Liga {league.name}</h2><p className="mt-2 max-w-xl text-sm font-bold text-white/48">Acertos valem 10 pontos de temporada, partidas perfeitas dão +20 e missões concluídas somam recompensas. O XP continua separado.</p></div><div className="min-w-[14rem] rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex items-end justify-between"><p className="font-display text-3xl font-black">{points}</p><p className="text-[10px] font-black uppercase text-white/35">PTS</p></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${league.progress * 100}%`, backgroundColor: league.color }} /></div><p className="mt-2 text-[11px] font-bold text-white/38">{league.next ? `${Math.max(0, league.next.min - points)} pts para ${league.next.name}` : "Liga máxima alcançada"}</p></div></div></HeroCard>
    <GlassCard><SectionTitle icon={Award} title={`Conquistas dos jogos (${unlocked.size}/${gameAchievementRules.length})`} hint="marcos permanentes" /><div className="mt-4 grid gap-2 sm:grid-cols-2">{gameAchievementRules.map((achievement) => { const done = unlocked.has(achievement.id); return <div key={achievement.id} className={`flex gap-3 rounded-xl border p-3 ${done ? "border-mint/28 bg-mint/[0.07]" : "border-white/8 bg-black/20 opacity-55"}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${done ? "bg-mint text-black" : "bg-white/8 text-white/35"}`}>{done ? <Trophy className="h-5 w-5" /> : <Lock className="h-4 w-4" />}</span><div><p className="font-display text-sm font-black">{achievement.name}</p><p className="mt-0.5 text-[11px] font-bold leading-relaxed text-white/42">{achievement.description}</p></div></div>; })}</div></GlassCard>
  </div>;
}

export function GamesView({ data, user, update }: { data: ReturnType<typeof useMemoUserData>; user: User; update: (next: (draft: AppData) => AppData) => void }) {
  const [hubTab, setHubTab] = useState<GamesHubTab>("jogar");
  const [subjectId, setSubjectId] = useState<string | undefined>(data.subjects[0]?.id);
  const [game, setGame] = useState<GameId | null>(null);
  const reducedGames = useSoftMotion();
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
  /** Recado da rodada — hoje só o aviso de que o repertório da matéria virou. */
  const [aviso, setAviso] = useState("");
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
    setAviso("");
    setResultado(null);

    const context = subjectContentContext(subject, materials, 4_500);
    // Pede mais itens do que a partida consome. O filtro de ineditismo abaixo
    // descarta o que já saiu, e sem essa folga um único repetido faria a rodada
    // ficar abaixo do mínimo e a partida falhar.
    const bruto = questionCount + 3;
    /**
     * Espaço reservado para o raciocínio do modelo.
     *
     * Na Azure os tokens de raciocínio contam DENTRO de `max_completion_tokens`.
     * Os tetos antigos só cobriam o texto visível, então o raciocínio comia a
     * cota e a resposta voltava vazia — um 502 "não consegui montar" a cada três
     * partidas. Medido em produção: com teto de 1140 o caça deu 2/3 e levou
     * 11,4 s em média; com 1800, 3/3 e 8,5 s. Teto maior sai mais barato em
     * tempo porque não dispara a cadeia de nova tentativa.
     *
     * O servidor ainda corta em `MINE_MAX_OUTPUT_TOKENS` (2600 hoje).
     */
    const reservaRaciocinio = 950;
    // "pelo menos N" e não "crie N": `expectedCount` em mine/quality.mjs lê esse
    // número para decidir se o lote passa. Pedindo mais e exigindo o mínimo real,
    // a folga não vira motivo de rejeição no controle de qualidade.
    const pedidos: Record<GameId, { task: string; prompt: string; maxOutputTokens: number; minimum: number }> = {
      nexo: { task: "pares", prompt: `Crie ${bruto} pares curtos e conceitualmente distintos sobre ${subject.name}. Entregue pelo menos ${questionCount} pares validos.`, maxOutputTokens: reservaRaciocinio + bruto * 95, minimum: questionCount },
      // Sequência é o item mais caro (título + 4 passos + explicação) e a folga
      // aqui é de 1, não de 3: o lote inteiro precisa caber no teto do servidor
      // e um processo truncado no meio é pior que uma folga menor.
      sequencia: { task: "sequencia", prompt: `Crie ${questionCount + 1} processos de quatro etapas sobre ${subject.name}. Entregue pelo menos ${questionCount} processos validos.`, maxOutputTokens: reservaRaciocinio + (questionCount + 1) * 185, minimum: questionCount },
      corrida: { task: "vf", prompt: `Gere ${bruto} afirmacoes curtas sobre ${subject.name}. Entregue pelo menos ${questionCount} afirmacoes validas.`, maxOutputTokens: reservaRaciocinio + bruto * 115, minimum: questionCount },
      memoria: { task: "pares", prompt: `Crie ${bruto} pares curtos sobre ${subject.name}. Entregue pelo menos ${questionCount} pares validos.`, maxOutputTokens: reservaRaciocinio + bruto * 95, minimum: questionCount },
      forca: { task: "forca", prompt: `Escolha ${bruto} palavras sobre ${subject.name}. Entregue pelo menos ${questionCount} palavras validas.`, maxOutputTokens: reservaRaciocinio + bruto * 80, minimum: questionCount },
      // Sem `+2` extra aqui: a folga do caça já vem do `bruto`. Somar duas
      // folgas pedia 11 palavras e custava ~2,6 s a mais por partida.
      caca: {
        task: "caca",
        prompt: `Escolha ${bruto} palavras sobre ${subject.name}. Entregue pelo menos ${questionCount} palavras validas, unicas, de 4 a 12 letras e sem espacos.`,
        maxOutputTokens: reservaRaciocinio + bruto * 95,
        minimum: questionCount,
      },
    };

    const pedido = pedidos[id];
    const memoriaKey = `${gameMemoryShape[id]}:${subject.id}`;

    /**
     * O que já saiu. A lista vai no prompt como pedido E é aplicada como filtro
     * aqui — o pedido sozinho nunca bastou: o modelo devolve o mesmo conceito
     * central com outra roupagem e a partida repete assim mesmo.
     */
    let jaVistos = new Set((readSeen()[memoriaKey] || []).map(noveltyKey));
    const apenasIneditos = <T,>(itens: T[], chaveDe: (item: T) => string) => pickUnseen(itens, chaveDe, jaVistos);

    let bestCount = 0;
    let released = false;
    let latestSeen: string[] = [];

    const accept = (text: string) => {
      let count = 0;
      let novos: string[] = [];
      let apply: (() => void) | null = null;

      if (id === "corrida") {
        const itens = apenasIneditos(parseTrueFalse(text), (item) => item.statement.slice(0, 60)).slice(0, questionCount);
        count = itens.length;
        novos = itens.map((item) => item.statement.slice(0, 60));
        apply = () => setVf(shuffle(itens));
      } else if (id === "memoria" || id === "nexo") {
        const itens = apenasIneditos(parsePairs(text), (item) => item.term).slice(0, questionCount);
        count = itens.length;
        novos = itens.map((item) => item.term);
        apply = () => setPares(itens);
      } else if (id === "sequencia") {
        const itens = apenasIneditos(parseSequencePuzzles(text), (item) => item.title).slice(0, questionCount);
        count = itens.length;
        novos = itens.map((item) => item.title);
        apply = () => setSequencias(itens);
      } else if (id === "caca") {
        const itens = apenasIneditos(parseWordMeanings(text), (item) => item.word).slice(0, questionCount);
        count = itens.length;
        novos = itens.map((item) => item.word);
        apply = () => setTermos(itens);
      } else {
        const itens = apenasIneditos(parseHangman(text), (item) => item.word).slice(0, questionCount);
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

    /** Monta o pedido com o ângulo da vez e a lista recente de bloqueio. */
    const montarPrompt = (reforco: string) => {
      const bloqueio = (readSeen()[memoriaKey] || []).slice(0, promptBlocklistSize);
      const evitar = bloqueio.length
        ? `\nJa saiu em partidas anteriores desta materia. Nao repita nenhum destes itens, nem reformulacoes deles: ${bloqueio.join(", ")}.`
        : "";
      return `${pedido.prompt}\n${nextGameAngle(memoriaKey)} Traga itens diferentes dos de uma partida comum e varie os subtemas dentro da materia.${evitar}${reforco}`;
    };

    const pedir = (reforco: string) =>
      streamGameTask(
        { task: pedido.task, prompt: montarPrompt(reforco), context, maxOutputTokens: pedido.maxOutputTokens },
        { signal: controller.signal, onPartial: accept },
      );

    (async () => {
      const primeira = await pedir("");
      if (controller.signal.aborted) return;
      if (accept(primeira).count >= pedido.minimum) {
        rememberSeen(memoriaKey, latestSeen);
        return;
      }

      // O lote veio quase todo repetido. Uma segunda tentativa, agora dizendo
      // ao modelo o que aconteceu — é mais eficaz que repetir o mesmo pedido.
      const segunda = await pedir(
        "\nATENCAO: o lote anterior repetiu itens que ja tinham saido. Escolha subtemas claramente diferentes, saia do obvio da materia e nao reaproveite nenhum termo da lista acima.",
      );
      if (controller.signal.aborted) return;
      if (accept(segunda).count >= pedido.minimum) {
        rememberSeen(memoriaKey, latestSeen);
        return;
      }

      // Duas tentativas e ainda falta: o repertório desta matéria acabou dentro
      // da memória. Reaproveita o texto que já chegou em vez de gastar uma
      // terceira chamada, avisa e recomeça o ciclo — repetir sabendo por quê é
      // melhor que repetir em silêncio ou deixar o aluno sem partida.
      jaVistos = new Set();
      if (accept(segunda).count < pedido.minimum) throw new Error("conteudo insuficiente");
      forgetSeen(memoriaKey);
      setAviso(
        "Você já passou por tudo o que a Mine encontrou nesta matéria — o ciclo recomeçou. Cadastre mais conteúdo na matéria para ampliar o repertório.",
      );
      rememberSeen(memoriaKey, latestSeen);
    })()
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
  const subjectGameSessions = data.sessions.filter((session) => session.kind === "Games" && session.subjectId === subjectId && !session.dailyChallenge);
  const visitedGameIds = new Set(subjectGameSessions.map((session) => session.gameId).filter(Boolean));
  const latestGameSession = [...subjectGameSessions].sort((a, b) => b.createdAt - a.createdAt)[0];
  const featuredGame = gameCatalog.find((item) => item.id === latestGameSession?.gameId) || gameCatalog.find((item) => item.featured) || gameCatalog[0];
  const dailySession = data.sessions.find((session) => session.kind === "Games" && session.dailyChallenge && session.dailyKey === dailyChallengeKey());
  const dailyCorrect = Number(dailySession?.correctAnswers || 0);
  const gameGamification = gamificationOf(data);

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
          {!data.subjects.length ? (
            <GlassCard>
              <EmptyState icon={Gamepad2} title="Crie uma matéria para jogar" text="Os seis jogos usam os conteúdos das suas matérias. O desafio diário e as outras áreas já estão disponíveis acima." />
            </GlassCard>
          ) : (
          <>
          <Reveal delay={0.04}>
            <section className="games-command-bar" aria-label="Contexto e progresso dos jogos">
              <div className="games-subject-control">
                <span className="games-command-icon"><BookOpen className="h-4 w-4" /></span>
                <label htmlFor="games-subject-select">
                  <span>Matéria selecionada</span>
                  <select id="games-subject-select" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
                    {data.subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <ChevronDown className="pointer-events-none h-4 w-4 text-white/35" />
              </div>
              <div className="games-command-stat">
                <Flame className="h-5 w-5 text-amber-300" />
                <span><small>Sequência</small><strong>{streakDays(data.sessions)} dias</strong></span>
              </div>
              <div className="games-command-stat">
                <Zap className="h-5 w-5 text-mint" />
                <span><small>XP total</small><strong>{gameGamification.xp.toLocaleString("pt-BR")}</strong></span>
              </div>
            </section>
          </Reveal>

          <div className="games-expedition-layout">
            <Reveal delay={0.07}>
              <section className="games-expedition-panel">
                <div className="games-expedition-copy">
                  <div>
                    <p>Expedição · {subject?.name || "Estudos"}</p>
                    <h2>Mapa de estudos</h2>
                    <span>Cada modo visitado abre uma nova forma de aprender o mesmo conteúdo.</span>
                  </div>
                  <span className="games-expedition-coordinate">{visitedGameIds.size}/6 destinos</span>
                </div>
                <div className="games-expedition-canvas">
                  <StudyExpeditionMap completedCount={visitedGameIds.size} label={subject?.name || "seus estudos"} />
                </div>
                <div className="games-current-mission">
                  <span className="games-current-mission__icon" style={{ backgroundColor: featuredGame.accent }}><featuredGame.icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <small>{latestGameSession ? "Continuar expedição" : "Primeiro destino"}</small>
                    <strong>{featuredGame.name}</strong>
                    <em>{featuredGame.duration} · {featuredGame.difficulty}</em>
                  </span>
                  <button type="button" onClick={() => abrirJogo(featuredGame.id)}>
                    {latestGameSession ? "Continuar" : "Começar"}<ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </section>
            </Reveal>

            <Reveal delay={0.1}>
              <aside className="games-daily-card">
                <div className="games-daily-card__topline"><CalendarCheck className="h-4 w-4" /><span>Desafio do dia</span><small>5 perguntas</small></div>
                <div className="games-daily-card__emblem"><Zap className="h-8 w-8" /></div>
                <p>{dailySession ? "Desafio concluído" : "Impulso de conhecimento"}</p>
                <h3>{dailySession ? `${dailyCorrect}/5 respostas corretas` : "Teste seus reflexos de estudo"}</h3>
                <span>{dailySession ? "Sua recompensa já foi adicionada ao progresso de hoje." : "Uma combinação igual para toda a comunidade, renovada à meia-noite."}</span>
                <div className="games-daily-progress">
                  <div><small>Progresso</small><strong>{dailySession ? "100%" : "0%"}</strong></div>
                  <div className="games-daily-progress__track"><span style={{ width: dailySession ? "100%" : "0%" }} /></div>
                </div>
                <div className="games-daily-reward"><span>Recompensa máxima</span><strong>+{gameXpFromCorrectAnswers(5)} XP</strong></div>
                <button type="button" onClick={() => setHubTab("diario")}>
                  {dailySession ? "Ver resultado" : "Jogar agora"}<Play className="h-4 w-4 fill-current" />
                </button>
              </aside>
            </Reveal>
          </div>

          {subject && !materials.length ? <p className="games-context-note">A Mine usará conhecimento geral sobre <strong>{subject.name}</strong> até você anexar conteúdos à matéria.</p> : null}

          <section className="caderno-games-hand" aria-labelledby="games-hand-title">
            <div className="games-library-heading">
              <div><p className="caderno-note">escolha uma carta</p><h2 id="games-hand-title">Sua mão de jogos</h2></div>
              <span>Passe o mouse para abrir o leque · clique para virar</span>
            </div>
            <GameHand
              games={gameCatalog.map((item) => ({ id: item.id, name: item.name, tagline: item.tagline, goal: item.goal, howTo: item.howTo, accent: item.accent, icon: item.icon }))}
              onPlay={(id) => abrirJogo(id as GameId)}
              reduced={Boolean(reducedGames)}
            />
          </section>

          <section className="games-mission-library" aria-labelledby="mission-library-title">
            <div className="games-library-heading">
              <div><p>Biblioteca de missões</p><h2 id="mission-library-title">Escolha seu próximo destino</h2></div>
              <span>{gameCatalog.length} modos · +{xpPerAction.game} XP por acerto</span>
            </div>
            <div className="games-dossier-scroll">
              <Stagger className="games-dossier-grid" gap={0.045}>
                {gameCatalog.filter((item) => item.id !== featuredGame.id).map((item, index) => {
                  const recorde = recordes[`${item.id}:${subjectId}`] || 0;
                  const played = visitedGameIds.has(item.id);
                  return (
                    <StaggerItem key={item.id} className="h-full">
                      <button type="button" onClick={() => abrirJogo(item.id)} className="game-dossier group" style={{ "--dossier-accent": item.accent } as React.CSSProperties}>
                        <span className="game-dossier__media">
                          <GameArtwork game={item.id} accent={item.accent} decorative />
                          <span className="game-dossier__index">{String(index + 1).padStart(2, "0")}</span>
                          <span className="game-dossier__icon"><item.icon className="h-5 w-5" /></span>
                        </span>
                        <span className="game-dossier__body">
                          <strong>{item.name}</strong>
                          <span className="game-dossier__meta"><em><Timer className="h-3.5 w-3.5" />{item.duration}</em><em><Activity className="h-3.5 w-3.5" />{item.difficulty}</em></span>
                          <span className="game-dossier__record"><Trophy className="h-3.5 w-3.5" />Recorde: {recorde || "—"}</span>
                          <span className="game-dossier__status">{played ? "Continuar" : item.badge || "Explorar"}<ArrowRight className="h-3.5 w-3.5" /></span>
                        </span>
                      </button>
                    </StaggerItem>
                  );
                })}
              </Stagger>
            </div>
          </section>
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
          aviso={aviso}
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
          <GameResultSheet
            pontos={resultado.pontos}
            xp={resultado.xp}
            acertos={resultado.acertos}
            total={resultado.total}
            recorde={resultado.recorde}
            recordeAnterior={recordes[recordKey] || 0}
            jogo={jogoAtual?.name || "Jogo"}
            materia={subject?.name || ""}
            onAgain={() => game && iniciar(game)}
            onExit={sair}
          />
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

