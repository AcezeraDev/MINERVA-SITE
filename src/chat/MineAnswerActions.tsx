import React, { useEffect, useRef, useState } from "react";
import { BookOpen, Check, ChevronLeft, ChevronRight, ClipboardCheck, Copy, MoreHorizontal, RefreshCw, RotateCcw, ThumbsDown, ThumbsUp, Volume2, VolumeX } from "lucide-react";
import { plainText } from "../../shared/chat-markdown.mjs";
import "./mine-actions.css";

/*
 * Barra embaixo da resposta, no desenho dos chats grandes (out/2026): só
 * ícones com dica ao passar o mouse — copiar, gostei, não gostei, ouvir,
 * refazer — e um "…" com as ações de estudo (explicar de outro jeito, gerar
 * questões, salvar na matéria). As setas ‹ 1/2 › aparecem quando a pergunta
 * tem outras versões.
 */

/** Texto para ler em voz alta: sem marcação, fórmula, código nem citação. */
export function speakableText(text: string) {
  return plainText(text)
    .replace(/```[\s\S]*?```/g, " (trecho de código) ")
    .replace(/\$\$[\s\S]*?\$\$/g, " (fórmula) ")
    .replace(/\$[^$\n]+\$/g, " (fórmula) ")
    .replace(/\[\d{1,2}\]/g, "")
    .replace(/\[\[[^\]]*\]\]/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/[*_`>|~=]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// Uma fala por vez no app inteiro: tocar "ouvir" em outra resposta para a anterior.
let speakingOwner: symbol | null = null;
const speechListeners = new Set<() => void>();

function stopSpeaking() {
  window.speechSynthesis?.cancel();
  speakingOwner = null;
  speechListeners.forEach((listener) => listener());
}

function useSpeech(text: string) {
  const [owner] = useState(() => Symbol("fala"));
  const [, force] = useState(0);
  useEffect(() => {
    const listener = () => force((tick) => tick + 1);
    speechListeners.add(listener);
    return () => {
      speechListeners.delete(listener);
      if (speakingOwner === owner) stopSpeaking();
    };
  }, [owner]);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const speaking = speakingOwner === owner;
  function toggle() {
    if (!supported) return;
    if (speaking) {
      stopSpeaking();
      return;
    }
    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(speakableText(text));
    utterance.lang = "pt-BR";
    const voice = window.speechSynthesis.getVoices().find((item) => item.lang?.toLowerCase().startsWith("pt-br")) || window.speechSynthesis.getVoices().find((item) => item.lang?.toLowerCase().startsWith("pt"));
    if (voice) utterance.voice = voice;
    utterance.rate = 1.04;
    utterance.onend = () => {
      if (speakingOwner === owner) stopSpeaking();
    };
    utterance.onerror = utterance.onend;
    speakingOwner = owner;
    speechListeners.forEach((listener) => listener());
    window.speechSynthesis.speak(utterance);
  }
  return { supported, speaking, toggle };
}

function IconButton({ label, onClick, active = false, disabled = false, children }: { label: string; onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" className={`mine-act ${active ? "is-active" : ""}`} onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={active || undefined} data-tip={label}>
      {children}
    </button>
  );
}

function copyText(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
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
  return Promise.resolve();
}

export function VersionSwitch({ index, total, onChange, disabled }: { index: number; total: number; onChange: (target: number) => void; disabled?: boolean }) {
  return (
    <span className="mine-version" aria-label={`Versão ${index + 1} de ${total}`}>
      <button type="button" className="mine-act" onClick={() => onChange(index - 1)} disabled={disabled || index <= 0} aria-label="Versão anterior" data-tip="Versão anterior">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="mine-version__count">
        {index + 1}/{total}
      </span>
      <button type="button" className="mine-act" onClick={() => onChange(index + 1)} disabled={disabled || index >= total - 1} aria-label="Próxima versão" data-tip="Próxima versão">
        <ChevronRight className="h-4 w-4" />
      </button>
    </span>
  );
}

export function MineAnswerActions({
  text,
  feedback,
  busy,
  canRegenerate,
  version,
  onFeedback,
  onRegenerate,
  onExplain,
  onPractice,
  onSave,
  onVersion,
}: {
  text: string;
  feedback?: "up" | "down";
  busy: boolean;
  canRegenerate: boolean;
  version?: { index: number; total: number } | null;
  onFeedback: (value: "up" | "down") => void;
  onRegenerate: () => void;
  onExplain: () => void;
  onPractice: () => void;
  onSave?: () => void;
  onVersion?: (target: number) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const speech = useSpeech(text);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!menuOpen) return;
    function close(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function pick(action: () => void) {
    setMenuOpen(false);
    action();
  }

  return (
    <div className="mine-actions">
      {version && onVersion ? <VersionSwitch index={version.index} total={version.total} onChange={onVersion} disabled={busy} /> : null}
      <IconButton
        label={copied ? "Copiado" : "Copiar"}
        onClick={() => {
          void copyText(text).then(() => setCopied(true)).catch(() => {});
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </IconButton>
      <IconButton label="Boa resposta" active={feedback === "up"} onClick={() => onFeedback("up")}>
        <ThumbsUp className="h-4 w-4" />
      </IconButton>
      <IconButton label="Resposta ruim" active={feedback === "down"} onClick={() => onFeedback("down")}>
        <ThumbsDown className="h-4 w-4" />
      </IconButton>
      {speech.supported ? (
        <IconButton label={speech.speaking ? "Parar leitura" : "Ler em voz alta"} active={speech.speaking} onClick={speech.toggle}>
          {speech.speaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </IconButton>
      ) : null}
      {canRegenerate ? (
        <IconButton label="Refazer resposta" onClick={onRegenerate} disabled={busy}>
          <RotateCcw className="h-4 w-4" />
        </IconButton>
      ) : null}
      <div ref={menuRef} className="mine-actions__more">
        <IconButton label="Mais ações" onClick={() => setMenuOpen((open) => !open)} active={menuOpen} disabled={busy}>
          <MoreHorizontal className="h-4 w-4" />
        </IconButton>
        {menuOpen ? (
          <div role="menu" className="mine-menu mine-menu--up">
            <button type="button" role="menuitem" className="mine-menu__item" onClick={() => pick(onExplain)}>
              <RefreshCw className="h-4 w-4" />
              Explicar de outro jeito
            </button>
            <button type="button" role="menuitem" className="mine-menu__item" onClick={() => pick(onPractice)}>
              <ClipboardCheck className="h-4 w-4" />
              Gerar questões
            </button>
            {onSave ? (
              <button type="button" role="menuitem" className="mine-menu__item" onClick={() => pick(onSave)}>
                <BookOpen className="h-4 w-4" />
                Salvar na matéria
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
