import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Images, X } from "lucide-react";

/*
 * Galeria de fotos da Mine, no formato que o ChatGPT popularizou: até três
 * fotos lado a lado, a última com "+N" quando há mais, e um visualizador em
 * tela cheia com setas, miniaturas, link da fonte e download.
 *
 * As fotos vêm de /api/image (Wikipédia para nomes, busca de imagens da web
 * para o resto). A galeria mostra a miniatura; o visualizador tenta a foto
 * original e volta para a miniatura se o site de origem bloquear.
 */

export type GalleryImage = {
  url: string;
  full: string;
  width: number;
  height: number;
  title: string;
  pageUrl: string;
  source: string;
};

const galleryCache = new Map<string, GalleryImage[]>();

function httpsOnly(value: unknown) {
  return typeof value === "string" && value.startsWith("https://") ? value : "";
}

function normalizeImages(data: unknown): GalleryImage[] {
  const payload = data as { images?: unknown; image?: unknown } | null;
  const list = Array.isArray(payload?.images) ? payload.images : payload?.image ? [payload.image] : [];
  return list
    .map((value) => {
      const item = value as Partial<GalleryImage> | null;
      const url = httpsOnly(item?.url);
      if (!url) return null;
      return {
        url,
        full: httpsOnly(item?.full) || url,
        width: Number(item?.width) || 0,
        height: Number(item?.height) || 0,
        title: String(item?.title || ""),
        pageUrl: httpsOnly(item?.pageUrl),
        source: String(item?.source || "Web"),
      };
    })
    .filter((item): item is GalleryImage => Boolean(item))
    .slice(0, 8);
}

function downloadHref(image: GalleryImage, fallbackName: string) {
  const params = new URLSearchParams({ src: image.full, name: image.title || fallbackName });
  if (image.full !== image.url) params.set("fallback", image.url);
  return `/api/image-download?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Visualizador em tela cheia

function Lightbox({
  images,
  index,
  setIndex,
  onClose,
  query,
  caption,
}: {
  images: GalleryImage[];
  index: number;
  setIndex: (next: number) => void;
  onClose: () => void;
  query: string;
  caption?: string;
}) {
  const reduceMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  // Originais que falharam ao carregar: a partir daí mostra a miniatura.
  const [fallbacks, setFallbacks] = useState<Set<number>>(() => new Set());
  const image = images[index];
  const count = images.length;
  const go = useCallback((delta: number) => setIndex((index + delta + count) % count), [index, count, setIndex]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      }
    }
    // Captura: o Esc fecha o visualizador antes de qualquer modal por trás.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [go, onClose]);

  useEffect(() => {
    const active = stripRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    active?.scrollIntoView({ block: "nearest", inline: "center", behavior: reduceMotion ? "auto" : "smooth" });
  }, [index, reduceMotion]);

  if (!image) return null;
  const src = fallbacks.has(index) ? image.url : image.full;
  const title = image.title || caption || query;

  return createPortal(
    <motion.div
      className="mine-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Fotos de ${query}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.18 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className="mine-lightbox__bar">
        <span className="mine-lightbox__count">
          {index + 1} / {count}
        </span>
        <p className="mine-lightbox__title" title={title}>
          {title}
        </p>
        <div className="mine-lightbox__actions">
          {image.pageUrl ? (
            <a href={image.pageUrl} target="_blank" rel="noreferrer noopener" className="mine-lightbox__button">
              <ExternalLink aria-hidden />
              <span>{image.source}</span>
            </a>
          ) : null}
          <a href={downloadHref(image, query)} download className="mine-lightbox__button mine-lightbox__button--primary">
            <Download aria-hidden />
            <span>Baixar</span>
          </a>
          <button ref={closeRef} type="button" onClick={onClose} className="mine-lightbox__icon" aria-label="Fechar">
            <X aria-hidden />
          </button>
        </div>
      </header>

      <div
        className="mine-lightbox__stage"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        onPointerDown={(event) => {
          swipeRef.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          const start = swipeRef.current;
          swipeRef.current = null;
          if (!start || count < 2) return;
          const dx = event.clientX - start.x;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(event.clientY - start.y)) go(dx < 0 ? 1 : -1);
        }}
      >
        {count > 1 ? (
          <button type="button" className="mine-lightbox__nav mine-lightbox__nav--prev" onClick={() => go(-1)} aria-label="Foto anterior">
            <ChevronLeft aria-hidden />
          </button>
        ) : null}
        <AnimatePresence mode="wait" initial={false}>
          <motion.img
            key={`${index}-${src}`}
            src={src}
            alt={title}
            referrerPolicy="no-referrer"
            draggable={false}
            className="mine-lightbox__image"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.2, 0, 0, 1] }}
            onError={() => {
              if (!fallbacks.has(index) && image.full !== image.url) setFallbacks((current) => new Set(current).add(index));
            }}
          />
        </AnimatePresence>
        {count > 1 ? (
          <button type="button" className="mine-lightbox__nav mine-lightbox__nav--next" onClick={() => go(1)} aria-label="Próxima foto">
            <ChevronRight aria-hidden />
          </button>
        ) : null}
      </div>

      {count > 1 ? (
        <div ref={stripRef} className="mine-lightbox__strip" aria-label="Todas as fotos">
          {images.map((item, itemIndex) => (
            <button
              key={item.url}
              type="button"
              data-index={itemIndex}
              className={`mine-lightbox__thumb ${itemIndex === index ? "is-active" : ""}`}
              onClick={() => setIndex(itemIndex)}
              aria-label={`Foto ${itemIndex + 1} de ${count}`}
              aria-current={itemIndex === index ? "true" : undefined}
            >
              <img src={item.url} alt="" referrerPolicy="no-referrer" loading="lazy" draggable={false} />
            </button>
          ))}
        </div>
      ) : null}
    </motion.div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Galeria na resposta

export function MineImageGallery({ query, caption, style = "" }: { query: string; caption?: string; style?: string }) {
  // O estilo entra na chave: "Ellie" em ícones e "Ellie" em fotos são galerias diferentes.
  const key = `${style}:${query.toLocaleLowerCase("pt-BR")}`;
  const [images, setImages] = useState<GalleryImage[] | undefined>(() => galleryCache.get(key));
  // Foto que não carrega sai da galeria em vez de deixar um buraco.
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const [openAt, setOpenAt] = useState<number | null>(null);

  useEffect(() => {
    const cachedImages = galleryCache.get(key);
    if (cachedImages) {
      setImages(cachedImages);
      return;
    }
    let active = true;
    setImages(undefined);
    fetch(`/api/image?q=${encodeURIComponent(query)}${style ? `&estilo=${encodeURIComponent(style)}` : ""}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data) => {
        const found = normalizeImages(data);
        galleryCache.set(key, found);
        if (active) setImages(found);
      })
      .catch(() => {
        // Falha de rede não entra no cache: a próxima abertura tenta de novo.
        if (active) setImages([]);
      });
    return () => {
      active = false;
    };
  }, [key, query, style]);

  const visible = useMemo(() => (images || []).filter((image) => !broken.has(image.url)), [images, broken]);

  if (images === undefined) {
    return (
      <div className="mine-gallery mine-gallery--loading" role="status" aria-label={`Buscando fotos de ${query}`}>
        <div className="mine-gallery__grid mine-gallery__grid--3">
          {[0, 1, 2].map((item) => (
            <span key={item} className="mine-gallery__skeleton" aria-hidden />
          ))}
        </div>
      </div>
    );
  }
  if (!visible.length) return null;

  const tiles = visible.slice(0, 3);
  const extra = visible.length - tiles.length;
  const sources = Array.from(new Set(visible.map((image) => image.source).filter(Boolean))).slice(0, 2);

  return (
    <figure className={`mine-gallery${style ? ` mine-gallery--${style}` : ""}`}>
      <div className={`mine-gallery__grid mine-gallery__grid--${tiles.length}`}>
        {tiles.map((image, index) => {
          const isLast = index === tiles.length - 1 && extra > 0;
          return (
            <div key={image.url} className="mine-gallery__tile">
              <button
                type="button"
                className="mine-gallery__open"
                onClick={() => setOpenAt(index)}
                aria-label={isLast ? `Ver todas as ${visible.length} fotos de ${query}` : `Ampliar foto: ${image.title || query}`}
              >
                <img
                  src={image.url}
                  alt={image.title || caption || query}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  draggable={false}
                  onError={() => setBroken((current) => new Set(current).add(image.url))}
                />
                {isLast ? (
                  <span className="mine-gallery__more" aria-hidden>
                    <Images />
                    {extra}
                  </span>
                ) : null}
              </button>
              <a
                href={downloadHref(image, query)}
                download
                className="mine-gallery__download"
                aria-label={`Baixar foto: ${image.title || query}`}
                title="Baixar foto"
              >
                <Download aria-hidden />
              </a>
            </div>
          );
        })}
      </div>
      {caption || sources.length ? (
        <figcaption className="mine-gallery__caption">
          {caption ? <span>{caption}</span> : null}
          {sources.length ? <span className="mine-gallery__sources">{sources.join(" · ")}</span> : null}
        </figcaption>
      ) : null}
      <AnimatePresence>
        {openAt !== null ? (
          <Lightbox
            key="lightbox"
            images={visible}
            index={openAt}
            setIndex={(next) => setOpenAt(next)}
            onClose={() => setOpenAt(null)}
            query={query}
            caption={caption}
          />
        ) : null}
      </AnimatePresence>
    </figure>
  );
}
