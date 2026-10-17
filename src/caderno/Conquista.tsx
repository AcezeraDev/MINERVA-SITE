/*
  Carteirinha de conquista: quando a pessoa sobe de nível (ou pede em
  Progresso), a Minerva monta uma carteirinha de estudante com o nível
  carimbado e gera um PNG para baixar ou mandar no grupo da turma.

  A imagem é desenhada num <canvas> 1080×1350 (formato de post): papel pautado,
  espiral, foto ou inicial, nome à caneta, selo do nível e XP em marca-texto.
*/
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Share2, X } from "lucide-react";
import { playStamp } from "./sons";
import { celebrate } from "./index";
import { MineFace } from "./MineFace";
import { Medalha } from "./Medalha";

export type ConquistaInfo = {
  name: string;
  avatar?: string;
  level: number;
  title: string;
  xp: number;
  streak: number;
  achievements: number;
};

const W = 1080;
const H = 1350;
const ink = "#1d2bb8";
const red = "#e5486b";

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Desenha a carteirinha e devolve o canvas pronto. */
export async function drawConquista(info: ConquistaInfo): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  // As fontes do caderno já estão na página; garante que carregaram.
  try {
    await Promise.all([
      document.fonts.load('700 80px "Kalam"'),
      document.fonts.load('400 40px "Gochi Hand"'),
      document.fonts.load('900 90px "Anybody Variable"'),
    ]);
  } catch {
    // sem as fontes o desenho sai com a letra do sistema, mas sai
  }

  // mesa
  ctx.fillStyle = "#edf1f5";
  ctx.fillRect(0, 0, W, H);

  // folha pautada, levemente girada
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.015);
  ctx.translate(-W / 2, -H / 2);
  ctx.shadowColor = "rgba(30,42,74,.25)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = "#fdfcf7";
  ctx.fillRect(90, 90, W - 180, H - 180);
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(120,160,200,.35)";
  ctx.lineWidth = 2;
  for (let y = 200; y < H - 100; y += 56) {
    ctx.beginPath();
    ctx.moveTo(90, y);
    ctx.lineTo(W - 90, y);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(229,72,107,.5)";
  ctx.fillRect(200, 90, 3, H - 180);
  // espiral
  for (let y = 130; y < H - 110; y += 64) {
    ctx.fillStyle = "#c9d2de";
    ctx.beginPath();
    ctx.arc(128, y + 10, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#7c8595";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(72, y + 22);
    ctx.bezierCurveTo(72, y - 12, 128, y - 16, 128, y + 10);
    ctx.stroke();
  }
  ctx.restore();

  // cabeçalho
  ctx.fillStyle = red;
  ctx.font = '400 46px "Gochi Hand", cursive';
  ctx.fillText("carteirinha de estudante", 250, 205);
  ctx.fillStyle = "#16181d";
  ctx.font = '900 92px "Anybody Variable", sans-serif';
  ctx.fillText("MINERVA", 250, 300);

  // foto 3x4 presa com fita
  const px = 250;
  const py = 380;
  ctx.save();
  ctx.translate(px + 150, py + 190);
  ctx.rotate(-0.04);
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "rgba(0,0,0,.2)";
  ctx.shadowBlur = 20;
  ctx.fillRect(-150, -190, 300, 380);
  ctx.shadowColor = "transparent";
  const photo = info.avatar ? await loadImage(info.avatar) : null;
  if (photo) {
    const side = Math.min(photo.width, photo.height);
    ctx.drawImage(photo, (photo.width - side) / 2, (photo.height - side) / 2, side, side, -130, -170, 260, 300);
  } else {
    ctx.fillStyle = "#c8f7dc";
    ctx.fillRect(-130, -170, 260, 300);
    ctx.fillStyle = ink;
    ctx.font = '700 170px "Kalam", cursive';
    ctx.textAlign = "center";
    ctx.fillText((info.name.trim()[0] || "?").toUpperCase(), 0, 40);
    ctx.textAlign = "left";
  }
  ctx.fillStyle = "rgba(255,226,74,.75)";
  ctx.rotate(0.12);
  ctx.fillRect(-70, -215, 140, 44);
  ctx.restore();

  // dados escritos à caneta; texto longo encolhe até caber na folha
  const tx = 610;
  const maxWidth = W - 120 - tx;
  const fit = (text: string, weight: number, size: number, family: string) => {
    let current = size;
    ctx.font = `${weight} ${current}px ${family}`;
    while (ctx.measureText(text).width > maxWidth && current > 24) {
      current -= 2;
      ctx.font = `${weight} ${current}px ${family}`;
    }
  };
  ctx.fillStyle = "#6b7280";
  ctx.font = '400 38px "Gochi Hand", cursive';
  ctx.fillText("nome", tx, 430);
  ctx.fillStyle = ink;
  const name = info.name.length > 22 ? `${info.name.slice(0, 21)}…` : info.name;
  fit(name, 700, 58, '"Kalam", cursive');
  ctx.fillText(name, tx, 495);
  ctx.fillStyle = "#6b7280";
  ctx.font = '400 38px "Gochi Hand", cursive';
  ctx.fillText("título", tx, 570);
  ctx.fillStyle = ink;
  fit(info.title, 700, 44, '"Kalam", cursive');
  ctx.fillText(info.title, tx, 625);
  ctx.fillStyle = "#6b7280";
  ctx.font = '400 38px "Gochi Hand", cursive';
  ctx.fillText("sequência", tx, 700);
  ctx.fillStyle = ink;
  ctx.font = '700 44px "Kalam", cursive';
  ctx.fillText(`${info.streak} ${info.streak === 1 ? "dia" : "dias"} 🔥`, tx, 755);

  // selo do nível (carimbo)
  ctx.save();
  ctx.translate(W / 2, 1000);
  ctx.rotate(-0.16);
  ctx.strokeStyle = red;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(0, 0, 170, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 148, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = red;
  ctx.textAlign = "center";
  ctx.font = '400 44px "Gochi Hand", cursive';
  ctx.fillText("nível", 0, -60);
  ctx.font = '700 150px "Kalam", cursive';
  ctx.fillText(String(info.level), 0, 80);
  ctx.restore();

  // XP em marca-texto
  ctx.textAlign = "center";
  const xpText = `${info.xp.toLocaleString("pt-BR")} XP · ${info.achievements} conquistas`;
  ctx.font = '700 50px "Kalam", cursive';
  const width = ctx.measureText(xpText).width;
  ctx.fillStyle = "rgba(255,226,74,.85)";
  ctx.fillRect(W / 2 - width / 2 - 16, 1218, width + 32, 40);
  ctx.fillStyle = "#16181d";
  ctx.fillText(xpText, W / 2, 1245);
  ctx.textAlign = "left";
  return canvas;
}

function fileName(info: ConquistaInfo) {
  return `minerva-nivel-${info.level}-${info.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "estudante"}.png`;
}

/** Janela da carteirinha: aparece carimbando, com baixar e compartilhar. */
export function ConquistaCard({ info, onClose }: { info: ConquistaInfo; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const stampRef = useRef<HTMLDivElement | null>(null);
  const canShare = useMemo(() => typeof navigator !== "undefined" && typeof navigator.share === "function", []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      playStamp();
      const rect = stampRef.current?.getBoundingClientRect();
      if (rect) celebrate(rect.left + rect.width / 2, rect.top + rect.height / 2, { count: 40, spread: 1.4 });
    }, 650);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function download() {
    setBusy(true);
    try {
      const canvas = await drawConquista(info);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = fileName(info);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    setBusy(true);
    try {
      const canvas = await drawConquista(info);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;
      const file = new File([blob], fileName(info), { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Minerva", text: `Cheguei no nível ${info.level} na Minerva! 📚` });
      } else {
        await download();
      }
    } catch {
      // compartilhamento cancelado
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="caderno-conquista-scrim" role="dialog" aria-modal="true" aria-label={`Nível ${info.level} alcançado`} onClick={onClose}>
      <motion.div
        className="caderno-conquista"
        onClick={(event) => event.stopPropagation()}
        initial={{ y: 60, rotate: 6, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, rotate: -1.5, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 20 }}
      >
        <button type="button" className="caderno-conquista-close" aria-label="Fechar" onClick={onClose}>
          <X className="h-5 w-5" />
        </button>
        <p className="caderno-conquista-kicker">carteirinha de estudante</p>
        <p className="caderno-conquista-brand">MINERVA</p>
        <div className="caderno-conquista-body">
          <div className="caderno-conquista-photo">
            {info.avatar ? <img src={info.avatar} alt="" /> : <span>{(info.name.trim()[0] || "?").toUpperCase()}</span>}
          </div>
          <dl className="caderno-conquista-data">
            <dt>nome</dt>
            <dd>{info.name}</dd>
            <dt>título</dt>
            <dd>{info.title}</dd>
            <dt>sequência</dt>
            <dd>{info.streak} {info.streak === 1 ? "dia" : "dias"}</dd>
          </dl>
        </div>
        <div ref={stampRef} className="caderno-conquista-medalha">
          <Medalha level={info.level} title={info.title} delay={0.25} />
          <span className="caderno-conquista-hint" aria-hidden>arraste para girar</span>
        </div>
        <p className="caderno-conquista-xp"><mark>{info.xp.toLocaleString("pt-BR")} XP · {info.achievements} conquistas</mark></p>
        <div className="caderno-conquista-mine">
          <MineFace className="h-12 w-12 shrink-0" />
          <span>Mostra pra turma! Baixa a carteirinha ou manda direto.</span>
        </div>
        <div className="caderno-conquista-actions">
          <button type="button" className="caderno-conquista-btn is-pen" onClick={canShare ? share : download} disabled={busy}>
            {canShare ? <Share2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            {canShare ? "Compartilhar" : "Baixar imagem"}
          </button>
          {canShare ? (
            <button type="button" className="caderno-conquista-btn" onClick={download} disabled={busy}>
              <Download className="h-4 w-4" />
              Baixar
            </button>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
