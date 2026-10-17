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
  Material,
  Mindmap,
  MindmapSide,
  PrimaryButton,
  SecondaryButton,
  Subject,
  cleanMindmapLabel,
  mindmapChatPalette,
  parseMindmap,
  requestAiTask,
  subjectContentContext
} from "../main";

export function mindCurve(x1: number, y1: number, x2: number, y2: number) {
  const direction = x2 >= x1 ? 1 : -1;
  const dx = Math.max(Math.abs(x2 - x1) * 0.42, 34);
  return `M ${x1} ${y1} C ${x1 + direction * dx} ${y1}, ${x2 - direction * dx} ${y2}, ${x2} ${y2}`;
}

export function truncLabel(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 3).trimEnd()}...` : text;
}

export function estimateTextLines(text: string, charsPerLine: number, maxLines: number) {
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

export function hexAlpha(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const value = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(value.slice(0, 2), 16) || 0;
  const g = parseInt(value.slice(2, 4), 16) || 0;
  const b = parseInt(value.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Separa "termo: explicação" quando o modelo escreve assim. Sem esse formato
 * não há palavra-chave: repetir as duas primeiras palavras da frase como
 * título só duplicava texto e roubava uma linha de leitura por conceito.
 */
export function splitMindmapItem(text: string) {
  const clean = cleanMindmapLabel(text);
  const keyed = clean.match(/^([^:]{2,34}):\s*(.+)$/);
  if (keyed) {
    return {
      keyed: true,
      keyword: truncLabel(cleanMindmapLabel(keyed[1]), 34),
      detail: truncLabel(cleanMindmapLabel(keyed[2]), 220),
    };
  }
  return { keyed: false, keyword: "", detail: truncLabel(clean, 220) };
}

/**
 * Medidas do mapa, em pixels do plano (antes do zoom).
 *
 * O desenho é "ramo como cartão": o tema no centro, e cada ramo vira um cartão
 * com o título no topo e os conceitos em lista, ligados por uma espinha. A
 * versão anterior espalhava um nó por conceito com texto de 9 a 11 px e depois
 * encolhia tudo para caber na tela — ficava bonito de longe e ilegível de
 * perto. Aqui o texto tem tamanho de leitura e o mapa cresce na vertical.
 *
 * As alturas são estimadas (não medidas no DOM) porque o mesmo layout desenha
 * o PNG e o HTML exportados. A estimativa é conservadora; no DOM o cartão tem
 * altura automática e a linha liga no cabeçalho, então errar para mais só
 * sobra respiro.
 */
export const MINDMAP_METRICS = {
  width: 1240,
  pad: 40,
  cardW: 372,
  cardPad: 20,
  rootW: 264,
  cardGap: 28,
  itemGap: 12,
  itemLineH: 21,
  itemKeyH: 20,
  itemCharsPerLine: 40,
  labelLineH: 22,
  labelCharsPerLine: 26,
  headerMetaH: 18,
  headerGap: 16,
};

export function buildMindmapLayout(map: Mindmap, palette: string[]) {
  const m = MINDMAP_METRICS;
  const rootX = (m.width - m.rootW) / 2;

  const cleanBranches = map.branches
    .map((branch) => ({
      label: truncLabel(cleanMindmapLabel(branch.label), 64),
      items: branch.items.map((item) => cleanMindmapLabel(item)).filter(Boolean),
    }))
    .filter((branch) => branch.label);

  const cards = cleanBranches.map((branch, index) => {
    const labelLines = estimateTextLines(branch.label, m.labelCharsPerLine, 3);
    const headerH = Math.max(40, labelLines * m.labelLineH + m.headerMetaH);
    let cursor = m.cardPad + headerH + m.headerGap;
    const items = branch.items.map((raw, itemIndex) => {
      const parts = splitMindmapItem(raw);
      const lines = estimateTextLines(parts.detail, m.itemCharsPerLine, 8);
      const h = (parts.keyed ? m.itemKeyH : 0) + lines * m.itemLineH;
      const top = cursor;
      cursor += h + m.itemGap;
      return { label: raw, keyword: parts.keyword, detail: parts.detail, keyed: parts.keyed, order: `${index + 1}.${itemIndex + 1}`, top, h, lines };
    });
    const h = cursor - (items.length ? m.itemGap : 0) + m.cardPad;
    return {
      index,
      label: branch.label,
      labelLines,
      color: palette[index % palette.length],
      headerH,
      h,
      items,
    };
  });

  // Ordem de leitura em sentido horário: os primeiros ramos à direita, de cima
  // para baixo, e o resto à esquerda. O corte é o que deixa os dois lados com
  // a altura mais parecida, para o mapa não ficar torto.
  const stackHeight = (list: typeof cards) => list.reduce((sum, card) => sum + card.h, 0) + Math.max(0, list.length - 1) * m.cardGap;
  let split = Math.ceil(cards.length / 2);
  let best = Infinity;
  for (let k = Math.max(1, Math.floor(cards.length / 2) - 1); k <= Math.min(cards.length, Math.ceil(cards.length / 2) + 1); k += 1) {
    const tallest = Math.max(stackHeight(cards.slice(0, k)), stackHeight(cards.slice(k)));
    if (tallest < best) {
      best = tallest;
      split = k;
    }
  }
  if (cards.length <= 1) split = cards.length;
  const right = cards.slice(0, split);
  const left = cards.slice(split);

  const labelLines = estimateTextLines(map.title || "", 18, 3);
  const rootH = Math.max(104, labelLines * 28 + 60);
  const height = Math.max(560, Math.max(stackHeight(right), stackHeight(left), rootH) + m.pad * 2);
  const rootY = height / 2;

  const place = (list: typeof cards, side: MindmapSide) => {
    let top = (height - stackHeight(list)) / 2;
    return list.map((card) => {
      const x = side === "right" ? m.width - m.pad - m.cardW : m.pad;
      const y = top;
      top += card.h + m.cardGap;
      return {
        ...card,
        side,
        x,
        y,
        w: m.cardW,
        // A linha do centro chega no meio do cabeçalho do cartão.
        anchorX: side === "right" ? x : x + m.cardW,
        anchorY: y + m.cardPad + card.headerH / 2,
      };
    });
  };

  const branches = [...place(right, "right"), ...place(left, "left")].sort((a, b) => a.index - b.index);
  return { width: m.width, height, rootX, rootY, rootW: m.rootW, rootH, cardPad: m.cardPad, branches };
}

export function mindmapToText(map: Mindmap, central: string): string {
  const lines: string[] = [central || map.title || "Mapa mental", ""];
  map.branches.forEach((branch) => {
    lines.push(`- ${branch.label}`);
    branch.items.forEach((item) => lines.push(`   - ${item}`));
    lines.push("");
  });
  return lines.join("\n").trim();
}

export function escapeHtml(text: string) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(text).replace(/[&<>"']/g, (char) => entities[char]);
}

export function mindmapToCanvas(map: Mindmap, palette: string[], central: string): HTMLCanvasElement | null {
  const layout = buildMindmapLayout({ ...map, title: central || map.title }, palette);
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(layout.width * scale);
  canvas.height = Math.round(layout.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);

  // Folha quadriculada com a margem vermelha, igual à tela.
  const ink = "#1E2A4A";
  ctx.fillStyle = "#FDFCF7";
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.strokeStyle = "rgba(120,160,200,0.22)";
  ctx.lineWidth = 1;
  for (let x = 0.5; x < layout.width; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, layout.height);
    ctx.stroke();
  }
  for (let y = 0.5; y < layout.height; y += 28) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(layout.width, y);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(229,72,107,0.45)";
  ctx.fillRect(46, 0, 2, layout.height);

  const sans = '"Atkinson Hyperlegible Next Variable", Inter, system-ui, sans-serif';
  const display = '"Anybody Variable", "Atkinson Hyperlegible Next Variable", system-ui, sans-serif';
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
  // Quebra em linhas pela largura real; a ultima linha ganha reticencias se o
  // texto passar do numero de linhas que o layout reservou.
  const wrap = (text: string, maxWidth: number, font: string, maxLines: number): string[] => {
    ctx.font = font;
    const words = text.split(/\s+/).filter(Boolean);
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
    if (lines.length > maxLines) {
      const kept = lines.slice(0, maxLines);
      let last = kept[maxLines - 1];
      while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      kept[maxLines - 1] = `${last.trimEnd()}…`;
      return kept;
    }
    return lines;
  };
  const text = (value: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "left") => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    ctx.fillText(value, x, y);
  };

  layout.branches.forEach((branch) => {
    const fromX = branch.side === "right" ? layout.rootX + layout.rootW : layout.rootX;
    ctx.save();
    ctx.strokeStyle = branch.color;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    const direction = branch.anchorX >= fromX ? 1 : -1;
    const dx = Math.max(Math.abs(branch.anchorX - fromX) * 0.5, 34);
    ctx.beginPath();
    ctx.moveTo(fromX, layout.rootY);
    ctx.bezierCurveTo(fromX + direction * dx, layout.rootY, branch.anchorX - direction * dx, branch.anchorY, branch.anchorX, branch.anchorY);
    ctx.stroke();
    ctx.restore();
  });

  const rootTop = layout.rootY - layout.rootH / 2;
  ctx.fillStyle = "rgba(255,226,74,0.7)";
  roundRect(layout.rootX + 10, rootTop + layout.rootH * 0.2, layout.rootW - 20, layout.rootH * 0.6, 26);
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(layout.rootX + layout.rootW / 2, layout.rootY, layout.rootW / 2 + 6, layout.rootH / 2 + 4, -0.03, 0, Math.PI * 2);
  ctx.stroke();
  const rootLines = wrap(central || map.title || "Mapa mental", layout.rootW - 44, `800 22px ${display}`, 3);
  const rootBlock = 18 + rootLines.length * 28;
  let rootCursor = layout.rootY - rootBlock / 2;
  text("TEMA CENTRAL", layout.rootX + layout.rootW / 2, rootCursor, `800 11px ${sans}`, "#E5486B", "center");
  rootCursor += 20;
  rootLines.forEach((line) => {
    text(line, layout.rootX + layout.rootW / 2, rootCursor, `800 22px ${display}`, ink, "center");
    rootCursor += 28;
  });

  layout.branches.forEach((branch) => {
    const pad = layout.cardPad;
    ctx.save();
    ctx.shadowColor = "rgba(30,42,74,0.16)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = "#ffffff";
    roundRect(branch.x, branch.y, branch.w, branch.h, 6);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(30,42,74,0.12)";
    ctx.lineWidth = 1;
    roundRect(branch.x, branch.y, branch.w, branch.h, 6);
    ctx.stroke();
    ctx.fillStyle = branch.color;
    ctx.fillRect(branch.x, branch.y, branch.w, 5);
    ctx.fillStyle = hexAlpha(branch.color, 0.3);
    ctx.fillRect(branch.x + branch.w / 2 - 36, branch.y - 10, 72, 20);

    const headerTop = branch.y + pad;
    ctx.fillStyle = branch.color;
    roundRect(branch.x + pad, headerTop, 32, 32, 16);
    ctx.fill();
    text(String(branch.index + 1), branch.x + pad + 16, headerTop + 9, `800 13px ${sans}`, "#ffffff", "center");
    const labelX = branch.x + pad + 46;
    const labelLines = wrap(branch.label, branch.w - pad * 2 - 46, `700 17px ${display}`, branch.labelLines);
    labelLines.forEach((line, lineIndex) => text(line, labelX, headerTop + lineIndex * 22, `700 17px ${display}`, ink));
    text(`${branch.items.length} conceitos`, labelX, headerTop + labelLines.length * 22 + 2, `600 12px ${sans}`, "rgba(30,42,74,0.55)");

    if (!branch.items.length) return;
    const spineX = branch.x + pad + 5;
    const first = branch.items[0];
    const last = branch.items[branch.items.length - 1];
    ctx.strokeStyle = hexAlpha(branch.color, 0.3);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(spineX, branch.y + first.top + 10);
    ctx.lineTo(spineX, branch.y + last.top + 10);
    ctx.stroke();

    branch.items.forEach((item) => {
      const top = branch.y + item.top;
      ctx.fillStyle = branch.color;
      ctx.beginPath();
      ctx.arc(spineX, top + 10, 4, 0, Math.PI * 2);
      ctx.fill();
      const x = branch.x + pad + 22;
      const width = branch.w - pad * 2 - 22;
      let cursor = top;
      if (item.keyed) {
        text(item.keyword, x, cursor + 1, `800 13px ${sans}`, branch.color);
        cursor += 20;
      }
      wrap(item.detail, width, `500 14.5px ${sans}`, item.lines).forEach((line) => {
        text(line, x, cursor + 1, `500 14.5px ${sans}`, "rgba(30,42,74,0.9)");
        cursor += 21;
      });
    });
  });

  return canvas;
}

export function mindmapToHtmlDocument(map: Mindmap, palette: string[], central: string) {
  const title = central || map.title || "Mapa mental";
  const layout = buildMindmapLayout({ ...map, title }, palette);
  const curves = layout.branches
    .map((branch) => {
      const fromX = branch.side === "right" ? layout.rootX + layout.rootW : layout.rootX;
      return `<path d="${mindCurve(fromX, layout.rootY, branch.anchorX, branch.anchorY)}" fill="none" stroke="${branch.color}" stroke-width="3" stroke-linecap="round" stroke-opacity=".75" />`;
    })
    .join("\n");
  const cards = layout.branches
    .map(
      (branch) => `<section class="card" style="left:${branch.x}px;top:${branch.y}px;width:${branch.w}px;--c:${branch.color}">
  <header><span class="index">${branch.index + 1}</span><div><h2>${escapeHtml(branch.label)}</h2><small>${branch.items.length} conceitos</small></div></header>
  <ul>${branch.items
    .map((item) => `<li>${item.keyed ? `<strong>${escapeHtml(item.keyword)}</strong>` : ""}<span>${escapeHtml(item.detail)}</span></li>`)
    .join("")}</ul>
</section>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; background: #EDF1F5; color: #1E2A4A; font-family: "Atkinson Hyperlegible Next Variable", system-ui, sans-serif; }
    .scroll { overflow-x: auto; }
    .plane { position: relative; margin: 0 auto; width: ${layout.width}px; height: ${layout.height}px; border-radius: 12px;
      background: linear-gradient(to right, transparent 46px, rgba(229,72,107,.45) 46px 48px, transparent 48px),
        repeating-linear-gradient(to right, rgba(120,160,200,.22) 0 1px, transparent 1px 28px),
        repeating-linear-gradient(to bottom, rgba(120,160,200,.22) 0 1px, transparent 1px 28px), #FDFCF7;
      box-shadow: 0 30px 60px -40px rgba(30,42,74,.5); }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    .root { position: absolute; left: ${layout.rootX}px; top: ${layout.rootY - layout.rootH / 2}px; width: ${layout.rootW}px; min-height: ${layout.rootH}px;
      display: grid; place-content: center; gap: 6px; padding: 18px 22px; text-align: center; border-radius: 50%; border: 1.6px solid #1E2A4A; }
    .root::before { content: ""; position: absolute; inset: 22% 6%; z-index: -1; border-radius: 30px; background: rgba(255,226,74,.7); }
    .root small { color: #E5486B; font-size: 11px; font-weight: 800; letter-spacing: .12em; }
    .root strong { font-size: 22px; line-height: 1.25; }
    .card { position: absolute; padding: 20px; border-radius: 6px; border-top: 5px solid var(--c); background: #fff;
      box-shadow: 0 0 0 1px rgba(30,42,74,.12), 0 14px 24px -16px rgba(30,42,74,.35); }
    .card::before { content: ""; position: absolute; top: -12px; left: 50%; width: 72px; height: 20px; translate: -50% 0; background: color-mix(in srgb, var(--c) 30%, rgba(255,255,255,.6)); }
    header { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 16px; }
    .index { flex: 0 0 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; background: var(--c); color: #fff; font-weight: 800; font-size: 13px; }
    h2 { margin: 0; font-size: 17px; line-height: 22px; }
    header small { color: rgba(30,42,74,.55); font-size: 12px; }
    ul { list-style: none; margin: 0; padding: 0 0 0 22px; display: grid; gap: 12px; position: relative; }
    ul::before { content: ""; position: absolute; left: 4px; top: 10px; bottom: 10px; width: 2px; border-radius: 2px; background: color-mix(in srgb, var(--c) 40%, transparent); }
    li { position: relative; font-size: 14.5px; line-height: 21px; color: rgba(30,42,74,.9); }
    li::before { content: ""; position: absolute; left: -22px; top: 6px; width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
    li strong { display: block; color: #1E2A4A; font-size: 13px; line-height: 20px; }
  </style>
</head>
<body>
  <div class="scroll">
    <main class="plane" aria-label="${escapeHtml(title)}">
      <svg viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true">${curves}</svg>
      <div class="root"><small>TEMA CENTRAL</small><strong>${escapeHtml(title)}</strong></div>
      ${cards}
    </main>
  </div>
</body>
</html>`;
}

export function MindmapExperience({
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
  const [focusedBranch, setFocusedBranch] = useState<number | null>(null);
  const [hoveredBranch, setHoveredBranch] = useState<number | null>(null);
  const [expandedMobile, setExpandedMobile] = useState(0);
  const reduceMotion = Boolean(useReducedMotion());
  const layout = useMemo(() => buildMindmapLayout({ ...map, title: map.title || subject.name }, palette), [map, palette, subject.name]);
  // A cascata de entrada só vale na primeira vez. Depois, destacar um ramo
  // precisa responder na hora, sem esperar o atraso de cada cartão.
  const firstReveal = useRef(true);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      firstReveal.current = false;
    }, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  // Esc tira o destaque antes de fechar o modal. Escuta na captura para chegar
  // antes do handler do modal, e só consome a tecla quando há destaque.
  useEffect(() => {
    if (focusedBranch === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setFocusedBranch(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [focusedBranch]);

  /** Foco trava; hover só acende. Ramos fora do foco apagam, mas continuam legíveis. */
  function branchState(index: number): "active" | "muted" | "idle" {
    if (focusedBranch !== null) return focusedBranch === index ? "active" : "muted";
    return hoveredBranch === index ? "active" : "idle";
  }

  function focusBranch(index: number | null) {
    setFocusedBranch(index);
    const el = scrollRef.current;
    if (index === null || !el) return;
    const branch = layout.branches[index];
    const cardH = branch.h * zoom;
    const left = (branch.x + branch.w / 2) * zoom - el.clientWidth / 2;
    // Cartão maior que a tela: mostra o começo dele, não o meio.
    const top = cardH + 48 > el.clientHeight ? branch.y * zoom - 24 : (branch.y + branch.h / 2) * zoom - el.clientHeight / 2;
    el.scrollTo({ left: Math.max(0, left), top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" });
  }
  const mapWidth = Math.round(layout.width * zoom);
  const mapHeight = Math.round(layout.height * zoom);
  const conceptCount = layout.branches.reduce((sum, branch) => sum + branch.items.length, 0);
  const focused = focusedBranch === null ? null : layout.branches[focusedBranch];

  return (
    <div className="mindmap-experience space-y-4">
      <div className="mindmap-command-bar">
        <div className="mindmap-command-copy">
          <span className="mindmap-command-icon"><BookOpen className="h-4 w-4" /></span>
          <div>
            <strong>{focused ? focused.label : "Visão geral"}</strong>
            <span>{focused ? `${focused.items.length} conceitos neste ramo` : "Explore as relações entre os conceitos"}</span>
          </div>
        </div>
        <div className="mindmap-command-metrics" aria-label="Resumo do mapa">
          <span className="mindmap-summary-pill mindmap-summary-pill--primary">{layout.branches.length} ramos</span>
          <span className="mindmap-summary-pill">{conceptCount} conceitos</span>
        </div>
        <div className="mindmap-command-actions hidden md:flex">
          <button
            type="button"
            onClick={() => focusBranch(null)}
            disabled={focusedBranch === null}
            className="mindmap-overview-button"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />Visão geral
          </button>
          <span className="mindmap-toolbar-separator" aria-hidden />
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.15).toFixed(2))))}
            aria-label="Diminuir o mapa"
            className="mindmap-zoom-button"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-12 text-center font-display text-xs font-black text-white/60">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(2.2, Number((value + 0.15).toFixed(2))))}
            aria-label="Aumentar o mapa"
            className="mindmap-zoom-button"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => fitToWidth(layout.width)} aria-label="Ajustar à tela" className="mindmap-zoom-button">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        <motion.div
          className="mindmap-mobile-topic"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, ease: [0.2, 0, 0, 1] }}
        >
          <span><Brain className="h-5 w-5" /></span>
          <div>
            <small>Tema central</small>
            <h3>{map.title || subject.name}</h3>
          </div>
        </motion.div>
        {layout.branches.map((branch, branchIndex) => {
          const expanded = expandedMobile === branchIndex;
          return (
            <motion.section
              key={branchIndex}
              layout
              className={`mindmap-mobile-branch ${expanded ? "is-expanded" : ""}`}
              style={{ "--mindmap-branch-color": branch.color } as React.CSSProperties}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: reduceMotion ? 0 : branchIndex * 0.045, ease: [0.2, 0, 0, 1] }}
            >
              <button
                type="button"
                onClick={() => setExpandedMobile(expanded ? -1 : branchIndex)}
                className="mindmap-mobile-branch__trigger"
                aria-expanded={expanded}
              >
                <span className="mindmap-mobile-branch__index">{branchIndex + 1}</span>
                <span className="mindmap-mobile-branch__title"><strong>{branch.label}</strong><small>{branch.items.length} conceitos</small></span>
                <ChevronDown className="h-4 w-4" />
              </button>
              <AnimatePresence initial={false}>{expanded ? (
                <motion.div
                  initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0.12 : 0.28, ease: [0.2, 0, 0, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mindmap-mobile-branch__content">
                    {branch.items.map((item, itemIndex) => (
                      <motion.article
                        key={itemIndex}
                        initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.24, delay: itemIndex * 0.04, ease: [0.2, 0, 0, 1] }}
                      >
                        <span aria-hidden />
                        <div>{item.keyed ? <strong>{item.keyword}</strong> : null}<p>{item.detail}</p></div>
                      </motion.article>
                    ))}
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
          className={`mindmap-viewport h-[74vh] min-h-[540px] max-h-[820px] w-full select-none overflow-auto ${grabbing ? "cursor-grabbing" : "cursor-grab"}`}
        >
          <div className="relative" style={{ width: `${mapWidth}px`, height: `${mapHeight}px` }}>
            <div className="mindmap-scale origin-top-left" style={{ width: `${layout.width}px`, height: `${layout.height}px`, transform: `scale(${zoom})` }}>
              <div className="mindmap-knowledge-plane" style={{ width: layout.width, height: layout.height }}>
                <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden>
                  {layout.branches.map((branch, branchIndex) => {
                    const fromX = branch.side === "right" ? layout.rootX + layout.rootW : layout.rootX;
                    const path = mindCurve(fromX, layout.rootY, branch.anchorX, branch.anchorY);
                    const state = branchState(branchIndex);
                    return (
                      <g key={`link-${branchIndex}`}>
                        <path className="mindmap-link-underlay" d={path} fill="none" stroke={branch.color} />
                        <motion.path
                          className={`mindmap-link ${state === "active" ? "is-active" : ""}`}
                          d={path}
                          fill="none"
                          stroke={branch.color}
                          initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: state === "muted" ? 0.16 : state === "active" ? 1 : 0.7 }}
                          transition={{
                            pathLength: { duration: 0.46, delay: 0.12 + branchIndex * 0.06, ease: [0.2, 0, 0, 1] },
                            opacity: { duration: 0.18 },
                          }}
                        />
                        {/* Ponto onde a linha encontra o cartão: diz de onde o ramo sai. */}
                        <motion.circle
                          cx={branch.anchorX}
                          cy={branch.anchorY}
                          r={5}
                          fill={branch.color}
                          initial={reduceMotion ? false : { opacity: 0 }}
                          animate={{ opacity: state === "muted" ? 0.2 : 1 }}
                          transition={{ duration: 0.2, delay: reduceMotion ? 0 : 0.5 + branchIndex * 0.06 }}
                        />
                      </g>
                    );
                  })}
                </svg>

                <motion.div
                  className="mindmap-central-node"
                  style={{ left: layout.rootX, top: layout.rootY - layout.rootH / 2, width: layout.rootW, minHeight: layout.rootH }}
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: focusedBranch === null ? 1 : 0.55, scale: 1 }}
                  transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
                >
                  <Doodle kind="circle" className="mindmap-central-ring" duration={1100} delay={150} strokeWidth={2.4} stretch />
                  <small>tema central</small>
                  <strong>{map.title || subject.name}</strong>
                  <span>{layout.branches.length} ramos · {conceptCount} conceitos</span>
                </motion.div>

                {layout.branches.map((branch, branchIndex) => {
                  const state = branchState(branchIndex);
                  const fromRight = branch.side === "right";
                  return (
                    <motion.section
                      key={`card-${branchIndex}`}
                      className={`mindmap-card is-${state}`}
                      style={{ left: branch.x, top: branch.y, width: branch.w, minHeight: branch.h, "--mindmap-branch-color": branch.color, "--mm-tilt": `${((branchIndex % 3) - 1) * 0.7}deg` } as React.CSSProperties}
                      initial={reduceMotion ? false : { opacity: 0, x: fromRight ? -16 : 16 }}
                      animate={{ opacity: state === "muted" ? 0.32 : 1, x: 0 }}
                      transition={{
                        opacity: { duration: 0.2, delay: firstReveal.current && !reduceMotion ? 0.2 + branchIndex * 0.06 : 0 },
                        x: { duration: 0.34, delay: reduceMotion ? 0 : 0.2 + branchIndex * 0.06, ease: [0.2, 0, 0, 1] },
                      }}
                      onPointerEnter={() => setHoveredBranch(branchIndex)}
                      onPointerLeave={() => setHoveredBranch((value) => (value === branchIndex ? null : value))}
                    >
                      <span className="mindmap-card__tape" aria-hidden />
                      <button
                        type="button"
                        className="mindmap-card__header"
                        onClick={() => focusBranch(focusedBranch === branchIndex ? null : branchIndex)}
                        onFocus={() => setHoveredBranch(branchIndex)}
                        onBlur={() => setHoveredBranch((value) => (value === branchIndex ? null : value))}
                        aria-pressed={focusedBranch === branchIndex}
                        aria-label={`${branch.label}, ${branch.items.length} conceitos. ${focusedBranch === branchIndex ? "Voltar à visão geral" : "Destacar este ramo"}`}
                      >
                        <span className="mindmap-card__index">{branchIndex + 1}</span>
                        <span className="mindmap-card__title">
                          <strong>{branch.label}</strong>
                          <small>{branch.items.length} conceitos</small>
                        </span>
                        <Target className="mindmap-card__target h-4 w-4" aria-hidden />
                      </button>
                      {branch.items.length ? (
                        <ul className="mindmap-card__items">
                          {branch.items.map((item, itemIndex) => (
                            <motion.li
                              key={itemIndex}
                              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.26, delay: reduceMotion ? 0 : 0.32 + branchIndex * 0.06 + itemIndex * 0.03, ease: [0.2, 0, 0, 1] }}
                            >
                              {item.keyed ? <strong>{item.keyword}</strong> : null}
                              <span>{item.detail}</span>
                            </motion.li>
                          ))}
                        </ul>
                      ) : null}
                    </motion.section>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <p className="mindmap-hint">Clique no título de um ramo para destacá-lo · arraste para mover · Esc volta à visão geral</p>
      </div>

      <div className="mindmap-actions flex flex-wrap gap-3">
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

export function MindmapModal({ subject, materials, initialMap, close }: { subject: Subject; materials: Material[]; initialMap?: Mindmap; close: () => void }) {
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(initialMap ? "ready" : "loading");
  const [map, setMap] = useState<Mindmap>(initialMap || { title: "", branches: [] });
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const palette = mindmapChatPalette;

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
    const layout = buildMindmapLayout(map, palette);
    const availableWidth = (el?.clientWidth || layoutWidth) - 24;
    const availableHeight = (el?.clientHeight || layout.height) - 24;
    // Visão geral do mapa inteiro; abaixo de 60% o texto deixa de ser lido.
    const next = Math.min(1.4, Math.max(0.6, Number(Math.min(availableWidth / layoutWidth, availableHeight / layout.height).toFixed(2))));
    setZoom(next);
    if (el) {
      requestAnimationFrame(() => el.scrollTo({
        top: 0,
        left: 0,
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
    if (initialMap && reloadKey === 0) {
      setMap(initialMap);
      setStatus("ready");
      return;
    }
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

  // Ao terminar de montar, ajusta pela LARGURA e deixa rolar na vertical.
  // Encaixar o mapa inteiro na altura chegava a 50% de zoom e o texto virava
  // 5 px; 80% é o menor tamanho em que os conceitos ainda se leem.
  useEffect(() => {
    if (status !== "ready") return;
    const frame = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      const layout = buildMindmapLayout(map, palette);
      const nextZoom = Math.min(1.15, Math.max(0.8, Number(((el.clientWidth - 24) / layout.width).toFixed(2))));
      setZoom(nextZoom);
      // O mapa já nasce com a parte mais alta no topo; só centraliza na horizontal.
      requestAnimationFrame(() => el.scrollTo({ left: Math.max(0, (el.scrollWidth - el.clientWidth) / 2), top: 0 }));
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, map]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="caderno-mm-badge">
            <Doodle kind="bulb" className="h-7 w-7" strokeWidth={3} />
          </span>
          <div>
            <p className="caderno-note">mapa mental</p>
            <h2 className="font-display text-2xl font-black"><span className="caderno-hl">{subject.name}</span></h2>
          </div>
        </div>
        <button onClick={close} aria-label="Fechar" className="caderno-mm-close">
          <X className="h-5 w-5" />
        </button>
      </div>

      {status === "loading" && (
        // A Mine rabisca um mapa na folha enquanto a IA pensa.
        <div className="caderno-mm-loading" role="status">
          <svg className="caderno-mm-sketch" viewBox="0 0 320 170" aria-hidden>
            <path className="is-hl" d="M122 86 L198 84" pathLength={1} />
            <ellipse cx="160" cy="85" rx="48" ry="26" pathLength={1} />
            {[
              ["M112 78 C 90 60, 72 40, 44 38", "#1FA870"],
              ["M112 92 C 90 110, 72 130, 44 134", "#2F7FE0"],
              ["M208 78 C 230 60, 248 40, 276 38", "#E0A100"],
              ["M208 92 C 230 110, 248 130, 276 134", "#E5486B"],
              ["M160 59 C 160 40, 160 26, 160 12", "#8A63E8"],
            ].map(([d, c], index) => (
              <path key={d} className="is-branch" d={d} pathLength={1} style={{ "--c": c, animationDelay: `${0.35 + index * 0.18}s` } as React.CSSProperties} />
            ))}
            {[[22, 30], [22, 126], [254, 30], [254, 126]].map(([x, y], index) => (
              <rect key={index} x={x} y={y} width="44" height="16" rx="4" pathLength={1} style={{ animationDelay: `${1.1 + index * 0.15}s` }} />
            ))}
          </svg>
          <MineFace thinking className="caderno-mm-face" />
          <p>A Mine está desenhando seu mapa...</p>
          <small>ligando as ideias de {subject.name}</small>
        </div>
      )}

      {status === "error" && (
        <div className="grid place-items-center gap-4 py-10 text-center">
          <MineFace className="caderno-mm-face h-16 w-16" />
          <p className="font-hand text-xl text-white/70">Ops, o lápis quebrou. Não consegui montar o mapa agora.</p>
          <PrimaryButton icon={RefreshCw} onClick={() => setReloadKey((value) => value + 1)}>Tentar de novo</PrimaryButton>
        </div>
      )}

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

