// Carregado sob demanda (React.lazy): canvas, worker e IndexedDB só descem
// para quem abre o ateliê.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Brush,
  Camera,
  Check,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FilePlus2,
  FolderOpen,
  Highlighter,
  ImagePlus,
  Loader2,
  PaintBucket,
  Pencil,
  Printer,
  Redo2,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { PageHeader, PrimaryButton, SecondaryButton, apiJson, readSession, uid, type AppData, type Session, type User } from "../main";
import { celebrateFrom, floatXp, mineSays } from "../caderno";
import { drawingsPerDay, startOfDay, xpPerAction } from "../../shared/xp.mjs";
import { MineFace } from "../caderno/MineFace";
import { drawMinePage, minePages, type MinePage } from "./paginas";
import { floodFill, hexToRgb } from "./pintura";
import { DRAFT_ID, deleteDrawing, listDrawings, loadDrawing, saveDrawing, type Drawing } from "./galeria";
import type { LineArtOptions } from "./lineart";
import "./atelie.css";

type Tool = "pincel" | "lapis" | "marca" | "balde" | "borracha";
type Panel = "mine" | "foto" | "guardados";
type Sheet = { w: number; h: number; kind: Drawing["kind"]; title: string };

const SHEET_W = 1000;
const SHEET_H = 1300;
const PHOTO_LONG_SIDE = 1000;
const UNDO_LIMIT = 20;

const tools: Array<{ id: Tool; label: string; icon: LucideIcon; key: string }> = [
  { id: "pincel", label: "Pincel", icon: Brush, key: "b" },
  { id: "lapis", label: "Lápis", icon: Pencil, key: "l" },
  { id: "marca", label: "Marca-texto", icon: Highlighter, key: "m" },
  { id: "balde", label: "Balde de tinta", icon: PaintBucket, key: "g" },
  { id: "borracha", label: "Borracha", icon: Eraser, key: "e" },
];

/** Estojo de canetinhas: tons vivos, os pastéis do caderno e os neutros. */
const palette = [
  "#1E1C28", "#6B7280", "#FFFFFF", "#7C4A2D", "#EF4444", "#F87171",
  "#FB923C", "#FBBF24", "#FDE047", "#A3E635", "#22C55E", "#14B8A6",
  "#38BDF8", "#3B82F6", "#6366F1", "#A78BFA", "#E879F9", "#F472B6",
  "#FBCFE8", "#FED7AA", "#FEF3C7", "#D9F99D", "#BAE6FD", "#DDD6FE",
];

/** Quanto da folha precisa ter tinta para o desenho valer XP (rabisco não conta). */
const MIN_PAINTED = 0.04;

/** Fração da folha com tinta, medida numa grade de amostras (rápido mesmo em 1000 px). */
function paintedShare(canvas: HTMLCanvasElement | null) {
  const ctx = ctx2d(canvas);
  if (!canvas || !ctx) return 0;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let hit = 0;
  let total = 0;
  for (let y = 0; y < canvas.height; y += 4) {
    for (let x = 0; x < canvas.width; x += 4) {
      total += 1;
      if (data[(y * canvas.width + x) * 4 + 3] > 40) hit += 1;
    }
  }
  return total ? hit / total : 0;
}

const toolAlpha: Record<Tool, number> = { pincel: 1, lapis: 0.92, marca: 0.42, balde: 1, borracha: 1 };

function ctx2d(canvas: HTMLCanvasElement | null) {
  return canvas?.getContext("2d", { willReadFrequently: true }) ?? null;
}

function canvasBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("blob"))), type, quality));
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function slug(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "desenho";
}

function PageThumb({ page, seed, onPick, active }: { page: MinePage; seed: number; onPick: () => void; active: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = ctx2d(canvas);
    if (!canvas || !ctx) return;
    drawMinePage(ctx, page, canvas.width, canvas.height, seed);
  }, [page, seed]);
  return (
    <button type="button" className={`atelie-thumb ${active ? "is-active" : ""}`} onClick={onPick} aria-pressed={active}>
      <canvas ref={ref} width={150} height={195} aria-hidden />
      <span>{page.title}</span>
    </button>
  );
}

type AtelieProps = {
  data: { sessions: Session[] };
  user: User;
  update: (next: (draft: AppData) => AppData) => void;
};

export function AtelieView({ data, user, update }: AtelieProps) {
  const [sheet, setSheet] = useState<Sheet>({ w: SHEET_W, h: SHEET_H, kind: "mine", title: minePages[0].title });
  const [tool, setTool] = useState<Tool>("balde");
  const [color, setColor] = useState("#F472B6");
  const [size, setSize] = useState(16);
  const [panel, setPanel] = useState<Panel>("mine");
  const [history, setHistory] = useState({ undo: 0, redo: 0 });
  const [showLines, setShowLines] = useState(true);
  const [photoOpts, setPhotoOpts] = useState<LineArtOptions>({ style: "pintar", detail: 0.45, thickness: 2 });
  const [photoVersion, setPhotoVersion] = useState(0);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [guideOn, setGuideOn] = useState(false);
  const [guideOpacity, setGuideOpacity] = useState(0.35);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Drawing[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | null>(minePages[0].id);
  const [mandalaSeed, setMandalaSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [ready, setReady] = useState(false);
  const [iaQuota, setIaQuota] = useState<{ used: number; limit: number } | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const guideRef = useRef<HTMLCanvasElement | null>(null);
  const paintRef = useRef<HTMLCanvasElement | null>(null);
  const strokeRef = useRef<HTMLCanvasElement | null>(null);
  const lineRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;
  const undoRef = useRef<ImageData[]>([]);
  const redoRef = useRef<ImageData[]>([]);
  const photoSrcRef = useRef<ImageData | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const jobRef = useRef(0);
  const draftTimer = useRef<number | undefined>(undefined);
  const strokeState = useRef<{ active: boolean; pointer: number; pts: Array<[number, number]>; width: number }>({ active: false, pointer: -1, pts: [], width: 1 });
  const announcedPhoto = useRef(false);

  const syncHistory = () => setHistory({ undo: undoRef.current.length, redo: redoRef.current.length });

  /** Todas as camadas no tamanho novo (mudar `width` também limpa o canvas). */
  const prepare = useCallback((w: number, h: number) => {
    for (const canvas of [guideRef.current, paintRef.current, strokeRef.current, lineRef.current]) {
      if (!canvas) continue;
      canvas.width = w;
      canvas.height = h;
    }
    undoRef.current = [];
    redoRef.current = [];
    syncHistory();
  }, []);

  /* ───────────── rascunho automático ───────────── */

  const snapshotDrawing = useCallback(async (id: string): Promise<Drawing | null> => {
    const paint = paintRef.current;
    const lines = lineRef.current;
    const guide = guideRef.current;
    if (!paint || !lines || !guide) return null;
    const s = sheetRef.current;
    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = 180;
    thumbCanvas.height = Math.round((180 * s.h) / s.w);
    const t = thumbCanvas.getContext("2d");
    if (!t) return null;
    t.fillStyle = "#ffffff";
    t.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
    t.drawImage(paint, 0, 0, thumbCanvas.width, thumbCanvas.height);
    t.drawImage(lines, 0, 0, thumbCanvas.width, thumbCanvas.height);
    return {
      id,
      title: s.title,
      kind: s.kind,
      w: s.w,
      h: s.h,
      paint: await canvasBlob(paint),
      lines: await canvasBlob(lines),
      guide: photoSrcRef.current ? await canvasBlob(guide, "image/jpeg", 0.85) : undefined,
      thumb: thumbCanvas.toDataURL("image/jpeg", 0.75),
      updatedAt: Date.now(),
    };
  }, []);

  const scheduleDraft = useCallback(() => {
    window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(async () => {
      try {
        const drawing = await snapshotDrawing(DRAFT_ID);
        if (drawing) await saveDrawing(drawing);
      } catch {
        // Sem IndexedDB (aba anônima, cota cheia): o desenho só não sobrevive à saída.
      }
    }, 1200);
  }, [snapshotDrawing]);

  /* ───────────── começar folhas ───────────── */

  const startBlank = useCallback(() => {
    prepare(SHEET_W, SHEET_H);
    photoSrcRef.current = null;
    setHasPhoto(false);
    setGuideOn(false);
    setPageId(null);
    setCurrentId(null);
    setSheet({ w: SHEET_W, h: SHEET_H, kind: "branco", title: "Folha em branco" });
    setTool("pincel");
    scheduleDraft();
  }, [prepare, scheduleDraft]);

  const startPage = useCallback((page: MinePage, seed: number) => {
    prepare(SHEET_W, SHEET_H);
    const ctx = ctx2d(lineRef.current);
    if (ctx) drawMinePage(ctx, page, SHEET_W, SHEET_H, seed);
    photoSrcRef.current = null;
    setHasPhoto(false);
    setGuideOn(false);
    setPageId(page.id);
    setCurrentId(null);
    setShowLines(true);
    setSheet({ w: SHEET_W, h: SHEET_H, kind: "mine", title: page.title });
    setTool("balde");
    scheduleDraft();
  }, [prepare, scheduleDraft]);

  /* ───────────── "Caprichar com a Mine": a IA de imagens redesenha a foto ───────────── */

  useEffect(() => {
    if (panel !== "foto" || !hasPhoto || iaQuota) return;
    const token = readSession().token;
    if (!token) return;
    apiJson<{ used: number; limit: number }>("/api/atelie-ia", { headers: { authorization: `Bearer ${token}` } })
      .then(setIaQuota)
      .catch(() => undefined);
  }, [panel, hasPhoto, iaQuota]);

  const caprichar = async () => {
    const src = photoSrcRef.current;
    const token = readSession().token;
    if (!src || !token) return;
    setError(null);
    setBusy("A Mine está redesenhando a sua foto… (leva uns 20 segundos)");
    try {
      const send = document.createElement("canvas");
      send.width = src.width;
      send.height = src.height;
      send.getContext("2d")?.putImageData(src, 0, 0);
      const result = await apiJson<{ image: string; used: number; limit: number }>("/api/atelie-ia", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ image: send.toDataURL("image/jpeg", 0.88) }),
      });
      setIaQuota({ used: result.used, limit: result.limit });
      const img = new Image();
      img.src = result.image;
      await img.decode();
      // A folha volta como imagem preto no branco; vira contorno: tinta onde
      // é escuro, transparente onde é papel. Encaixada sem distorcer.
      const { w, h } = sheetRef.current;
      const tmp = document.createElement("canvas");
      tmp.width = w;
      tmp.height = h;
      const t = tmp.getContext("2d", { willReadFrequently: true });
      const lines = ctx2d(lineRef.current);
      if (!t || !lines) return;
      t.fillStyle = "#ffffff";
      t.fillRect(0, 0, w, h);
      const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      t.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      const pixels = t.getImageData(0, 0, w, h);
      const d = pixels.data;
      // Só o traço escuro vira tinta. O modelo às vezes devolve áreas em
      // cinza (sombra que ele não deveria ter feito); cinza claro vira papel
      // para não ficar por cima da pintura e escurecer a cor escolhida.
      for (let i = 0; i < d.length; i += 4) {
        const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const t = Math.min(1, Math.max(0, (165 - l) / 75));
        d[i + 3] = Math.round(t * t * (3 - 2 * t) * 255);
        d[i] = 30;
        d[i + 1] = 28;
        d[i + 2] = 40;
      }
      lines.clearRect(0, 0, w, h);
      lines.putImageData(pixels, 0, 0);
      setShowLines(true);
      setTool("balde");
      mineSays("Caprichei! Agora é só pintar.", "wow");
      scheduleDraft();
    } catch (err) {
      setError((err as Error)?.message || "A IA não conseguiu desenhar essa foto agora.");
      setIaQuota(null);
    } finally {
      setBusy(null);
    }
  };

  const startPhoto = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Esse arquivo não é uma imagem. Tenta uma foto JPG ou PNG.");
      return;
    }
    setError(null);
    setBusy("Lendo a foto…");
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      const scale = Math.min(1, PHOTO_LONG_SIDE / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(200, Math.round(bitmap.width * scale));
      const h = Math.max(200, Math.round(bitmap.height * scale));
      prepare(w, h);
      const guide = ctx2d(guideRef.current);
      if (!guide) throw new Error("canvas");
      guide.fillStyle = "#ffffff";
      guide.fillRect(0, 0, w, h);
      guide.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();
      photoSrcRef.current = guide.getImageData(0, 0, w, h);
      announcedPhoto.current = false;
      setHasPhoto(true);
      setPageId(null);
      setCurrentId(null);
      setShowLines(true);
      setSheet({ w, h, kind: "foto", title: file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "Minha foto" });
      setTool("balde");
      setPanel("foto");
      setPhotoVersion((v) => v + 1);
    } catch {
      setBusy(null);
      setError("Não consegui abrir essa foto. Se ela veio do iPhone (HEIC), tenta mandar como JPG.");
    }
  }, [prepare]);

  /* ───────────── foto → contorno (no worker) ───────────── */

  useEffect(() => {
    const src = photoSrcRef.current;
    // Na entrada não há foto; ao reabrir um desenho, nada muda até a pessoa mexer.
    if (!src) return;
    const timer = window.setTimeout(() => {
      if (!workerRef.current) workerRef.current = new Worker(new URL("./lineart.worker.ts", import.meta.url), { type: "module" });
      const worker = workerRef.current;
      const id = ++jobRef.current;
      setBusy(photoOpts.style === "esboco" ? "Passando o lápis na sua foto…" : "Contornando a sua foto…");
      worker.onmessage = (event: MessageEvent<{ id: number; data?: Uint8ClampedArray; error?: string }>) => {
        if (event.data.id !== jobRef.current) return;
        setBusy(null);
        const ctx = ctx2d(lineRef.current);
        if (!event.data.data || !ctx) {
          setError("A conversão falhou. Tenta outra foto ou menos detalhe.");
          return;
        }
        ctx.putImageData(new ImageData(new Uint8ClampedArray(event.data.data), src.width, src.height), 0, 0);
        if (!announcedPhoto.current) {
          announcedPhoto.current = true;
          mineSays(photoOpts.style === "esboco" ? "Pronto! Agora desenha por cima." : "Pronto! Sua foto virou folha de pintar.", "wow");
        }
        scheduleDraft();
      };
      worker.onerror = () => {
        setBusy(null);
        setError("A conversão falhou. Tenta de novo.");
      };
      const copy = new Uint8ClampedArray(src.data);
      worker.postMessage({ id, data: copy, w: src.width, h: src.height, opts: photoOpts }, [copy.buffer]);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [photoOpts, photoVersion, scheduleDraft]);

  useEffect(() => () => {
    workerRef.current?.terminate();
    window.clearTimeout(draftTimer.current);
  }, []);

  /* ───────────── abrir desenhos guardados ───────────── */

  const refreshSaved = useCallback(() => {
    listDrawings().then(setSaved).catch(() => setSaved([]));
  }, []);

  const openDrawing = useCallback(async (drawing: Drawing, asDraft = false) => {
    prepare(drawing.w, drawing.h);
    const paint = ctx2d(paintRef.current);
    const lines = ctx2d(lineRef.current);
    const guide = ctx2d(guideRef.current);
    if (!paint || !lines || !guide) return;
    paint.drawImage(await createImageBitmap(drawing.paint), 0, 0);
    lines.drawImage(await createImageBitmap(drawing.lines), 0, 0);
    if (drawing.guide) {
      guide.drawImage(await createImageBitmap(drawing.guide), 0, 0, drawing.w, drawing.h);
      photoSrcRef.current = guide.getImageData(0, 0, drawing.w, drawing.h);
      announcedPhoto.current = true;
      setHasPhoto(true);
    } else {
      photoSrcRef.current = null;
      setHasPhoto(false);
      setGuideOn(false);
    }
    setShowLines(true);
    setPageId(null);
    setSheet({ w: drawing.w, h: drawing.h, kind: drawing.kind, title: drawing.title });
    if (!asDraft) setCurrentId(drawing.id);
  }, [prepare]);

  useEffect(() => {
    let alive = true;
    refreshSaved();
    loadDrawing(DRAFT_ID)
      .then((draft) => {
        if (!alive) return;
        if (draft) return openDrawing(draft, true);
        startPage(minePages[0], mandalaSeed);
      })
      .catch(() => alive && startPage(minePages[0], mandalaSeed))
      .finally(() => alive && setReady(true));
    return () => { alive = false; };
    // Só na entrada da tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ───────────── desfazer ───────────── */

  const pushUndo = useCallback(() => {
    const ctx = ctx2d(paintRef.current);
    if (!ctx) return;
    const { w, h } = sheetRef.current;
    undoRef.current.push(ctx.getImageData(0, 0, w, h));
    if (undoRef.current.length > UNDO_LIMIT) undoRef.current.shift();
    redoRef.current = [];
    syncHistory();
  }, []);

  const stepHistory = useCallback((from: React.MutableRefObject<ImageData[]>, to: React.MutableRefObject<ImageData[]>) => {
    const ctx = ctx2d(paintRef.current);
    const snapshot = from.current.pop();
    if (!ctx || !snapshot) return;
    const { w, h } = sheetRef.current;
    to.current.push(ctx.getImageData(0, 0, w, h));
    ctx.putImageData(snapshot, 0, 0);
    syncHistory();
    scheduleDraft();
  }, [scheduleDraft]);

  const undo = useCallback(() => stepHistory(undoRef, redoRef), [stepHistory]);
  const redo = useCallback(() => stepHistory(redoRef, undoRef), [stepHistory]);

  const clearPaint = () => {
    const ctx = ctx2d(paintRef.current);
    if (!ctx) return;
    pushUndo();
    ctx.clearRect(0, 0, sheet.w, sheet.h);
    scheduleDraft();
  };

  /* ───────────── pincel, lápis, marca-texto, borracha ───────────── */

  const toSheet = (event: { clientX: number; clientY: number }): [number, number] => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return [0, 0];
    return [((event.clientX - rect.left) / rect.width) * sheet.w, ((event.clientY - rect.top) / rect.height) * sheet.h];
  };

  const brushWidth = (event: React.PointerEvent | PointerEvent) => {
    const base = tool === "lapis" ? Math.max(2, size * 0.35) : tool === "marca" ? size * 1.6 : size;
    // Caneta de tablet: a pressão engrossa o traço.
    return event.pointerType === "pen" && event.pressure > 0 ? base * (0.35 + event.pressure * 1.1) : base;
  };

  const strokeContext = () => {
    if (tool === "borracha") {
      const ctx = ctx2d(paintRef.current);
      if (ctx) ctx.globalCompositeOperation = "destination-out";
      return ctx;
    }
    return ctx2d(strokeRef.current);
  };

  const drawSegment = (points: Array<[number, number]>, width: number) => {
    const ctx = strokeContext();
    if (!ctx) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = tool === "borracha" ? "#000" : color;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = width;
    const n = points.length;
    if (n === 1) {
      ctx.beginPath();
      ctx.arc(points[0][0], points[0][1], width / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const [ax, ay] = n > 2 ? points[n - 3] : points[0];
      const [bx, by] = points[n - 2];
      const [cx, cy] = points[n - 1];
      ctx.beginPath();
      ctx.moveTo(n > 2 ? (ax + bx) / 2 : ax, n > 2 ? (ay + by) / 2 : ay);
      ctx.quadraticCurveTo(bx, by, (bx + cx) / 2, (by + cy) / 2);
      ctx.stroke();
    }
    ctx.restore();
    if (tool === "borracha") ctx.globalCompositeOperation = "source-over";
  };

  const finishStroke = () => {
    const state = strokeState.current;
    if (!state.active) return;
    state.active = false;
    const stroke = strokeRef.current;
    const paint = ctx2d(paintRef.current);
    if (stroke && paint && tool !== "borracha") {
      const last = state.pts[state.pts.length - 1];
      const strokeCtx = ctx2d(stroke);
      if (strokeCtx && state.pts.length > 1 && last) {
        // Fecha a ponta que a curva suavizada deixa para trás.
        strokeCtx.save();
        strokeCtx.lineCap = "round";
        strokeCtx.strokeStyle = color;
        strokeCtx.lineWidth = state.width;
        const prev = state.pts[state.pts.length - 2];
        strokeCtx.beginPath();
        strokeCtx.moveTo((prev[0] + last[0]) / 2, (prev[1] + last[1]) / 2);
        strokeCtx.lineTo(last[0], last[1]);
        strokeCtx.stroke();
        strokeCtx.restore();
      }
      paint.save();
      paint.globalAlpha = toolAlpha[tool];
      if (tool === "marca") paint.globalCompositeOperation = "multiply";
      paint.drawImage(stroke, 0, 0);
      paint.restore();
      strokeCtx?.clearRect(0, 0, sheet.w, sheet.h);
    }
    scheduleDraft();
  };

  const moveCursor = (event: React.PointerEvent) => {
    const cursor = cursorRef.current;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!cursor || !rect) return;
    if (tool === "balde" || event.pointerType === "touch") {
      cursor.style.opacity = "0";
      return;
    }
    const d = Math.max(4, (brushWidth(event) * rect.width) / sheet.w);
    cursor.style.opacity = "1";
    cursor.style.width = `${d}px`;
    cursor.style.height = `${d}px`;
    cursor.style.transform = `translate(${event.clientX - rect.left - d / 2}px, ${event.clientY - rect.top - d / 2}px)`;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (busy || (event.pointerType === "mouse" && event.button !== 0)) return;
    const [x, y] = toSheet(event);
    if (tool === "balde") {
      const paint = ctx2d(paintRef.current);
      const lines = ctx2d(lineRef.current);
      if (!paint) return;
      const image = paint.getImageData(0, 0, sheet.w, sheet.h);
      const before = paint.getImageData(0, 0, sheet.w, sheet.h);
      const changed = floodFill(image, showLines && lines ? lines.getImageData(0, 0, sheet.w, sheet.h) : null, Math.floor(x), Math.floor(y), hexToRgb(color));
      if (!changed) return;
      undoRef.current.push(before);
      if (undoRef.current.length > UNDO_LIMIT) undoRef.current.shift();
      redoRef.current = [];
      syncHistory();
      paint.putImageData(image, 0, 0);
      scheduleDraft();
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    pushUndo();
    const width = brushWidth(event);
    strokeState.current = { active: true, pointer: event.pointerId, pts: [[x, y]], width };
    drawSegment(strokeState.current.pts, width);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    moveCursor(event);
    const state = strokeState.current;
    if (!state.active || event.pointerId !== state.pointer) return;
    const native = event.nativeEvent;
    const events = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
    for (const item of events.length ? events : [native]) {
      const point = toSheet(item);
      const last = state.pts[state.pts.length - 1];
      if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < 1.2) continue;
      state.pts.push(point);
      state.width = brushWidth(item);
      drawSegment(state.pts, state.width);
    }
  };

  /* ───────────── atalhos ───────────── */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (mod || event.altKey) return;
      const hit = tools.find((item) => item.key === key);
      if (hit) setTool(hit.id);
      if (key === "[") setSize((s) => Math.max(2, s - 2));
      if (key === "]") setSize((s) => Math.min(64, s + 2));
    };
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files || []).find((item) => item.type.startsWith("image/"));
      if (file) {
        event.preventDefault();
        void startPhoto(file);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, [undo, redo, startPhoto]);

  /* ───────────── baixar, imprimir, guardar ───────────── */

  const flatten = (withPaint: boolean) => {
    const out = document.createElement("canvas");
    out.width = sheet.w;
    out.height = sheet.h;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, sheet.w, sheet.h);
    if (withPaint && paintRef.current) ctx.drawImage(paintRef.current, 0, 0);
    if (lineRef.current && (showLines || !withPaint)) ctx.drawImage(lineRef.current, 0, 0);
    return out;
  };

  const download = async () => {
    const out = flatten(true);
    if (!out) return;
    downloadBlob(await canvasBlob(out), `minerva-${slug(sheet.title)}.png`);
  };

  /** Imprime só o contorno, para pintar no papel com lápis de cor de verdade. */
  const printSheet = () => {
    const out = flatten(false);
    if (!out) return;
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) return frame.remove();
    doc.open();
    doc.write(`<!doctype html><title>${sheet.title}</title><style>@page{margin:12mm}html,body{margin:0;height:100%}img{display:block;max-width:100%;max-height:100%;margin:auto}</style><img src="${out.toDataURL("image/png")}">`);
    doc.close();
    const img = doc.querySelector("img");
    const go = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 1500);
    };
    if (img && !img.complete) img.onload = go;
    else go();
  };

  const today = startOfDay(Date.now());
  const drawingsToday = data.sessions.filter((item) => item.kind === "Arte" && item.createdAt >= today).length;

  /**
   * Cada desenho vale XP uma vez, na primeira vez que é guardado com tinta
   * suficiente. Atualizar o mesmo desenho depois não rende de novo.
   */
  const awardDrawing = (id: string, title: string, from: Element | null) => {
    if (data.sessions.some((item) => item.kind === "Arte" && item.drawingId === id)) return "ja";
    if (paintedShare(paintRef.current) < MIN_PAINTED) return "pouco";
    if (drawingsToday >= drawingsPerDay) return "teto";
    const session: Session = {
      id: uid("session"),
      userId: user.id,
      subjectId: "atelie",
      title: `Desenho: ${title}`,
      kind: "Arte",
      createdAt: Date.now(),
      xpEarned: xpPerAction.drawing,
      drawingId: id,
    };
    update((draft) =>
      draft.sessions.some((item) => item.userId === user.id && item.kind === "Arte" && item.drawingId === id)
        ? draft
        : { ...draft, sessions: [...draft.sessions, session] },
    );
    floatXp(`+${xpPerAction.drawing} XP`, from);
    celebrateFrom(from, { count: 18, spread: 0.8 });
    return "ganhou";
  };

  const saveCurrent = async (origin: Element | null) => {
    const from = origin ?? wrapRef.current;
    try {
      const id = currentId || `des_${Date.now().toString(36)}`;
      const drawing = await snapshotDrawing(id);
      if (!drawing) return;
      await saveDrawing(drawing);
      setCurrentId(id);
      refreshSaved();
      setPanel("guardados");
      const xp = awardDrawing(id, drawing.title, from);
      mineSays(
        xp === "ganhou"
          ? "Que obra! Guardei e você ganhou XP."
          : xp === "pouco"
            ? "Guardei! Pinta mais um pouco para valer XP."
            : xp === "teto"
              ? "Guardei! O XP de desenho de hoje já acabou."
              : "Guardei no seu caderno de desenhos!",
        xp === "ganhou" ? "wow" : "happy",
      );
    } catch {
      setError("Não deu para guardar aqui (o navegador bloqueou o armazenamento). Use o botão Baixar.");
    }
  };

  const removeSaved = async (id: string) => {
    await deleteDrawing(id).catch(() => undefined);
    if (currentId === id) setCurrentId(null);
    setConfirmDelete(null);
    refreshSaved();
  };

  /* ───────────── tela ───────────── */

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith("image/"));
    if (file) void startPhoto(file);
  };

  const pickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void startPhoto(file);
  };

  const sizePreview = Math.min(40, Math.max(4, tool === "lapis" ? size * 0.35 : tool === "marca" ? size * 1.2 : size));

  return (
    <>
      <PageHeader
        eyebrow="Ateliê da Mine"
        title="Desenhar e pintar"
        subtitle="Pinte os desenhos da Mine, desenhe numa folha em branco ou mande uma foto que eu transformo em folha de colorir."
        action={
          <>
            <SecondaryButton icon={Printer} onClick={printSheet}>Imprimir folha</SecondaryButton>
            <SecondaryButton icon={Save} onClick={() => void saveCurrent(null)}>Guardar</SecondaryButton>
            <PrimaryButton icon={Download} onClick={() => void download()}>Baixar</PrimaryButton>
          </>
        }
      />

      <div className="atelie">
        <section className="atelie-mesa" aria-label="Folha de desenho">
          <div className="atelie-ferramentas" role="toolbar" aria-label="Ferramentas">
            <div className="atelie-grupo">
              {tools.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`atelie-tool ${tool === item.id ? "is-active" : ""}`}
                  aria-pressed={tool === item.id}
                  title={`${item.label} (${item.key.toUpperCase()})`}
                  onClick={() => setTool(item.id)}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <label className="atelie-tamanho" title="Tamanho ( [ e ] )">
              <span className="atelie-tamanho-dot" style={{ width: sizePreview, height: sizePreview, background: tool === "borracha" ? "transparent" : color }} aria-hidden />
              <span className="sr-only">Tamanho do traço</span>
              <input type="range" min={2} max={64} value={size} onChange={(event) => setSize(Number(event.target.value))} disabled={tool === "balde"} />
            </label>
            <div className="atelie-grupo">
              <button type="button" className="atelie-icon" onClick={undo} disabled={!history.undo} title="Desfazer (Ctrl+Z)" aria-label="Desfazer"><Undo2 className="h-[18px] w-[18px]" /></button>
              <button type="button" className="atelie-icon" onClick={redo} disabled={!history.redo} title="Refazer (Ctrl+Y)" aria-label="Refazer"><Redo2 className="h-[18px] w-[18px]" /></button>
              <button type="button" className="atelie-icon" onClick={() => setShowLines((v) => !v)} aria-pressed={!showLines} title={showLines ? "Esconder contorno" : "Mostrar contorno"} aria-label={showLines ? "Esconder contorno" : "Mostrar contorno"}>
                {showLines ? <Eye className="h-[18px] w-[18px]" /> : <EyeOff className="h-[18px] w-[18px]" />}
              </button>
              <button type="button" className="atelie-icon" onClick={clearPaint} title="Apagar a pintura (mantém o contorno)" aria-label="Apagar a pintura"><Trash2 className="h-[18px] w-[18px]" /></button>
            </div>
          </div>

          <div className="atelie-cores" role="radiogroup" aria-label="Cores">
            {palette.map((hex) => (
              <button
                key={hex}
                type="button"
                role="radio"
                aria-checked={color.toLowerCase() === hex.toLowerCase()}
                aria-label={`Cor ${hex}`}
                className={`atelie-cor ${color.toLowerCase() === hex.toLowerCase() ? "is-active" : ""}`}
                style={{ background: hex }}
                onClick={() => {
                  setColor(hex);
                  if (tool === "borracha") setTool("pincel");
                }}
              />
            ))}
            <label className="atelie-cor atelie-cor-livre" title="Outra cor">
              <span className="sr-only">Escolher outra cor</span>
              <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
            </label>
          </div>

          <div
            className={`atelie-folha-area ${dragOver ? "is-drag" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <div
              ref={wrapRef}
              className={`atelie-folha tool-${tool}`}
              style={{ aspectRatio: `${sheet.w} / ${sheet.h}`, "--ratio": sheet.w / sheet.h } as React.CSSProperties}
              role="img"
              aria-label={`Folha: ${sheet.title}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={finishStroke}
              onPointerCancel={finishStroke}
              onPointerLeave={() => { if (cursorRef.current) cursorRef.current.style.opacity = "0"; }}
            >
              <canvas ref={guideRef} className="atelie-camada" style={{ opacity: guideOn && hasPhoto ? guideOpacity : 0 }} />
              <canvas ref={paintRef} className="atelie-camada" />
              <canvas ref={strokeRef} className="atelie-camada" style={{ opacity: toolAlpha[tool], mixBlendMode: tool === "marca" ? "multiply" : undefined }} />
              <canvas ref={lineRef} className="atelie-camada" style={{ opacity: showLines ? 1 : 0 }} />
              <div ref={cursorRef} className="atelie-cursor" aria-hidden />
              {busy || !ready ? (
                <div className="atelie-ocupada" role="status">
                  <MineFace thinking className="h-16 w-16" />
                  <p>{busy || "Abrindo a folha…"}</p>
                </div>
              ) : null}
            </div>
            <p className="atelie-legenda">
              <span className="caderno-note">{sheet.title}</span>
              {currentId ? <span className="atelie-guardado"><Check className="h-3.5 w-3.5" /> no caderno</span> : null}
            </p>
          </div>
        </section>

        <aside className="atelie-painel">
          <div className="atelie-abas" role="tablist" aria-label="De onde vem a folha">
            {([
              ["mine", "Desenhos da Mine"],
              ["foto", "Foto vira desenho"],
              ["guardados", "Meus desenhos"],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={panel === id} className={panel === id ? "is-active" : ""} onClick={() => { setPanel(id); if (id === "guardados") refreshSaved(); }}>
                {label}
              </button>
            ))}
          </div>

          {error ? (
            <p className="atelie-erro" role="alert">
              {error}
              <button type="button" onClick={() => setError(null)} aria-label="Fechar aviso">×</button>
            </p>
          ) : null}

          {panel === "mine" ? (
            <div className="atelie-secao">
              <button type="button" className="atelie-branco" onClick={startBlank}>
                <FilePlus2 className="h-5 w-5" />
                <span><strong>Folha em branco</strong><small>Desenhe do zero com os seus traços.</small></span>
              </button>
              <div className="atelie-thumbs">
                {minePages.map((page) => (
                  <PageThumb
                    key={page.id}
                    page={page}
                    seed={mandalaSeed}
                    active={pageId === page.id}
                    onPick={() => {
                      let seed = mandalaSeed;
                      if (page.varies && pageId === page.id) {
                        seed = Math.floor(Math.random() * 1e9);
                        setMandalaSeed(seed);
                      }
                      startPage(page, seed);
                    }}
                  />
                ))}
              </div>
              <p className="atelie-dica">Toque na mandala de novo para ganhar outra diferente.</p>
            </div>
          ) : null}

          {panel === "foto" ? (
            <div className="atelie-secao">
              <div className={`atelie-drop ${dragOver ? "is-drag" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}>
                <ImagePlus className="h-7 w-7" />
                <p><strong>Mande uma foto</strong> e eu transformo em folha de colorir.</p>
                <div className="atelie-drop-botoes">
                  <button type="button" className="atelie-botao" onClick={() => fileRef.current?.click()}><FolderOpen className="h-4 w-4" /> Escolher foto</button>
                  <button type="button" className="atelie-botao" onClick={() => cameraRef.current?.click()}><Camera className="h-4 w-4" /> Tirar foto</button>
                </div>
                <small>Também dá para arrastar ou colar (Ctrl+V). A foto não sai do seu aparelho.</small>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pickFile} />
              </div>

              {hasPhoto ? (
                <div className="atelie-ia">
                  <button type="button" className="atelie-ia-botao" onClick={() => void caprichar()} disabled={Boolean(busy) || (iaQuota ? iaQuota.used >= iaQuota.limit : false)}>
                    {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                    <span><strong>Caprichar com a Mine</strong><small>A IA redesenha a foto com traço limpo de livro de colorir.</small></span>
                  </button>
                  <p className="atelie-dica">
                    A foto é enviada para a IA para ser redesenhada.
                    {iaQuota ? ` Hoje: ${iaQuota.used}/${iaQuota.limit}.` : ""}
                  </p>
                </div>
              ) : null}

              {hasPhoto ? (
                <div className="atelie-ajustes">
                  <div className="atelie-segmento" role="radiogroup" aria-label="Estilo">
                    {([
                      ["pintar", "Para pintar", "Áreas fechadas para o balde"],
                      ["esboco", "Esboço a lápis", "Traço solto para desenhar por cima"],
                    ] as const).map(([id, label, hint]) => (
                      <button key={id} type="button" role="radio" aria-checked={photoOpts.style === id} className={photoOpts.style === id ? "is-active" : ""} onClick={() => setPhotoOpts((o) => ({ ...o, style: id }))}>
                        <strong>{label}</strong>
                        <small>{hint}</small>
                      </button>
                    ))}
                  </div>
                  <label className="atelie-slider">
                    <span>Detalhes <em>{photoOpts.detail < 0.34 ? "poucos" : photoOpts.detail < 0.67 ? "médios" : "muitos"}</em></span>
                    <input type="range" min={0} max={1} step={0.05} value={photoOpts.detail} onChange={(event) => setPhotoOpts((o) => ({ ...o, detail: Number(event.target.value) }))} />
                  </label>
                  <label className="atelie-slider">
                    <span>Traço <em>{["fino", "médio", "grosso", "bem grosso"][photoOpts.thickness - 1]}</em></span>
                    <input type="range" min={1} max={4} step={1} value={photoOpts.thickness} onChange={(event) => setPhotoOpts((o) => ({ ...o, thickness: Number(event.target.value) }))} />
                  </label>
                  <label className="atelie-toggle">
                    <input type="checkbox" checked={guideOn} onChange={(event) => setGuideOn(event.target.checked)} />
                    <span><strong>Foto por baixo</strong><small>Decalque: desenhe seguindo a foto. Não sai no download.</small></span>
                  </label>
                  {guideOn ? (
                    <label className="atelie-slider">
                      <span>Transparência da foto</span>
                      <input type="range" min={0.1} max={0.9} step={0.05} value={guideOpacity} onChange={(event) => setGuideOpacity(Number(event.target.value))} />
                    </label>
                  ) : null}
                  <button type="button" className="atelie-botao" onClick={() => setPhotoVersion((v) => v + 1)} disabled={Boolean(busy)}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refazer contorno
                  </button>
                  <p className="atelie-dica">Mudar os ajustes refaz só o contorno: o que você já pintou continua.</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {panel === "guardados" ? (
            <div className="atelie-secao">
              <button type="button" className="atelie-branco" onClick={(event) => void saveCurrent(event.currentTarget)}>
                <Save className="h-5 w-5" />
                <span><strong>{currentId ? "Atualizar este desenho" : "Guardar este desenho"}</strong><small>Fica salvo neste aparelho.</small></span>
              </button>
              <p className="atelie-xp">
                <strong>+{xpPerAction.drawing} XP</strong> por desenho pintado guardado
                <span>{Math.min(drawingsToday, drawingsPerDay)}/{drawingsPerDay} hoje</span>
              </p>
              {saved.length ? (
                <div className="atelie-thumbs">
                  {saved.map((item) => (
                    <div key={item.id} className={`atelie-thumb ${currentId === item.id ? "is-active" : ""}`}>
                      <button type="button" className="atelie-thumb-abrir" onClick={() => void openDrawing(item)}>
                        <img src={item.thumb} alt="" />
                        <span>{item.title}</span>
                      </button>
                      {confirmDelete === item.id ? (
                        <button type="button" className="atelie-thumb-apagar is-confirm" onClick={() => void removeSaved(item.id)}>Apagar?</button>
                      ) : (
                        <button type="button" className="atelie-thumb-apagar" onClick={() => setConfirmDelete(item.id)} aria-label={`Apagar ${item.title}`}><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="atelie-dica">Nenhum desenho guardado ainda. Pinte algo e aperte em guardar!</p>
              )}
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
