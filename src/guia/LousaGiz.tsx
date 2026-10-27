// Giz de verdade na lousa do fim da aula: o ponteiro escreve num <canvas>
// por cima do quadro. Cada traço vai direto para o contexto 2D (nada de
// estado do React por movimento) e o apagador limpa com uma passada.
import React, { useEffect, useImperativeHandle, useRef } from "react";

export type LousaGizHandle = { apagar: () => void };

export const LousaGiz = React.forwardRef<LousaGizHandle, { onRabisco?: () => void }>(function LousaGiz({ onRabisco }, handle) {
  const ref = useRef<HTMLCanvasElement>(null);
  const avisou = useRef(false);
  const onRabiscoRef = useRef(onRabisco);
  onRabiscoRef.current = onRabisco;

  useImperativeHandle(handle, () => ({
    apagar() {
      const canvas = ref.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      // a passada do apagador: limpa em faixas da esquerda para a direita
      const faixas = 10;
      for (let k = 0; k < faixas; k += 1) {
        window.setTimeout(() => {
          ctx.clearRect((canvas.width / faixas) * k, 0, canvas.width / faixas + 1, canvas.height);
        }, k * 28);
      }
    },
  }));

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      // redimensionar apaga o canvas; guarda o desenho e devolve esticado
      const copia = document.createElement("canvas");
      copia.width = canvas.width;
      copia.height = canvas.height;
      if (canvas.width && canvas.height) copia.getContext("2d")!.drawImage(canvas, 0, 0);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      if (copia.width && copia.height) ctx.drawImage(copia, 0, 0, canvas.width, canvas.height);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    let last: { x: number; y: number } | null = null;
    const pos = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * dpr, y: (event.clientY - rect.top) * dpr };
    };
    // giz: vários fios finos e um pouco tremidos em vez de um traço liso
    const risca = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      ctx.lineCap = "round";
      for (let fio = 0; fio < 4; fio += 1) {
        const jx = (Math.random() - 0.5) * 2.4 * dpr;
        const jy = (Math.random() - 0.5) * 2.4 * dpr;
        ctx.strokeStyle = `rgba(243,241,232,${0.28 + Math.random() * 0.3})`;
        ctx.lineWidth = (1.2 + Math.random() * 1.6) * dpr;
        ctx.beginPath();
        ctx.moveTo(a.x + jx, a.y + jy);
        ctx.lineTo(b.x + jx, b.y + jy);
        ctx.stroke();
      }
    };

    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // ponteiro que já sumiu: escreve do mesmo jeito, só sem captura
      }
      last = pos(event);
      risca(last, { x: last.x + 0.5, y: last.y + 0.5 });
      if (!avisou.current) {
        avisou.current = true;
        onRabiscoRef.current?.();
      }
    };
    const move = (event: PointerEvent) => {
      if (!last) return;
      const p = pos(event);
      risca(last, p);
      last = p;
    };
    const up = (event: PointerEvent) => {
      last = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    return () => {
      ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
  }, []);

  return <canvas ref={ref} className="cu-giz-canvas" aria-hidden />;
});
