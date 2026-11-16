import { useEffect, useRef } from "react";
import { useQualityTier } from "../motion";

/**
 * Fundo da tela de entrada: papel pontilhado vivo, em canvas 2D.
 *
 * - uma onda lenta "respira" pela folha, como tinta secando;
 * - os pontos perto do ponteiro fogem dele e ficam verde-menta;
 * - clicar (ou tocar) solta uma onda que empurra os pontos em anel.
 *
 * Ponteiro e ondas ficam em variáveis locais (nada de setState por
 * pointermove). O laço para com a aba escondida; com movimento reduzido ou no
 * tier baixo o fundo é desenhado uma vez só, parado.
 */
const ESPACO = 26;
const RAIO = 170;
const EMPURRAO = 16;

type Onda = { x: number; y: number; inicio: number };

function lerCor(nome: string, reserva: [number, number, number]): [number, number, number] {
  const partes = getComputedStyle(document.documentElement).getPropertyValue(nome).trim().split(/\s+/).map(Number);
  return partes.length === 3 && partes.every((v) => Number.isFinite(v)) ? (partes as [number, number, number]) : reserva;
}

export function FundoLogin({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const tier = useQualityTier();
  const parado = reduced || tier === "low";

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let largura = 0;
    let altura = 0;
    let colunas = 0;
    let linhas = 0;
    let base = new Float32Array(0); // x, y de cada ponto
    let desvio = new Float32Array(0); // deslocamento atual (suavizado)
    let calor = new Float32Array(0); // 0..1: quanto o ponto está "aceso"
    let caneta: [number, number, number] = [43, 59, 209];
    let menta: [number, number, number] = [47, 212, 131];

    const ponteiro = { x: -9999, y: -9999, dentro: false };
    const ondas: Onda[] = [];
    let quadro = 0;
    const inicio = performance.now();

    const lerCores = () => {
      caneta = lerCor("--pen", caneta);
      menta = lerCor("--mint", menta);
    };

    const medir = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      largura = window.innerWidth;
      altura = window.innerHeight;
      canvas.width = Math.round(largura * dpr);
      canvas.height = Math.round(altura * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      colunas = Math.ceil(largura / ESPACO) + 1;
      linhas = Math.ceil(altura / ESPACO) + 1;
      const total = colunas * linhas;
      base = new Float32Array(total * 2);
      desvio = new Float32Array(total * 2);
      calor = new Float32Array(total);
      const sobraX = (largura - (colunas - 1) * ESPACO) / 2;
      const sobraY = (altura - (linhas - 1) * ESPACO) / 2;
      for (let l = 0; l < linhas; l += 1) {
        for (let c = 0; c < colunas; c += 1) {
          const i = l * colunas + c;
          base[i * 2] = sobraX + c * ESPACO;
          base[i * 2 + 1] = sobraY + l * ESPACO;
        }
      }
    };

    const desenhar = (agora: number) => {
      const t = (agora - inicio) / 1000;
      ctx.clearRect(0, 0, largura, altura);

      // brilho suave embaixo do ponteiro
      if (ponteiro.dentro && !parado) {
        const luz = ctx.createRadialGradient(ponteiro.x, ponteiro.y, 0, ponteiro.x, ponteiro.y, RAIO * 1.6);
        luz.addColorStop(0, `rgba(${menta[0]},${menta[1]},${menta[2]},0.13)`);
        luz.addColorStop(1, `rgba(${menta[0]},${menta[1]},${menta[2]},0)`);
        ctx.fillStyle = luz;
        ctx.fillRect(ponteiro.x - RAIO * 1.6, ponteiro.y - RAIO * 1.6, RAIO * 3.2, RAIO * 3.2);
      }

      // ondas vivas: raio cresce 520 px/s e somem em 1,6 s
      for (let k = ondas.length - 1; k >= 0; k -= 1) {
        if ((agora - ondas[k].inicio) / 1000 > 1.6) ondas.splice(k, 1);
      }

      const total = colunas * linhas;
      const cx = largura * 0.5;
      const cy = altura * 0.5;
      const diagonal = Math.hypot(cx, cy);

      ctx.fillStyle = `rgb(${caneta[0]},${caneta[1]},${caneta[2]})`;
      const acesos: number[] = [];

      for (let i = 0; i < total; i += 1) {
        const bx = base[i * 2];
        const by = base[i * 2 + 1];
        let alvoX = 0;
        let alvoY = 0;
        let alvoCalor = 0;

        if (!parado) {
          // fuga do ponteiro
          const dx = bx - ponteiro.x;
          const dy = by - ponteiro.y;
          const d = Math.hypot(dx, dy);
          if (ponteiro.dentro && d < RAIO && d > 0.001) {
            const forca = (1 - d / RAIO) ** 2;
            alvoX += (dx / d) * forca * EMPURRAO;
            alvoY += (dy / d) * forca * EMPURRAO;
            alvoCalor = Math.max(alvoCalor, forca * 1.4);
          }
          // anéis dos cliques
          for (const onda of ondas) {
            const idade = (agora - onda.inicio) / 1000;
            const raio = idade * 520;
            const ox = bx - onda.x;
            const oy = by - onda.y;
            const od = Math.hypot(ox, oy) || 1;
            const faixa = 1 - Math.min(1, Math.abs(od - raio) / 46);
            if (faixa > 0) {
              const forca = faixa * (1 - idade / 1.6);
              alvoX += (ox / od) * forca * 12;
              alvoY += (oy / od) * forca * 12;
              alvoCalor = Math.max(alvoCalor, forca);
            }
          }
          // mola simples: o ponto chega no alvo sem grudar
          desvio[i * 2] += (alvoX - desvio[i * 2]) * 0.16;
          desvio[i * 2 + 1] += (alvoY - desvio[i * 2 + 1]) * 0.16;
          calor[i] += (alvoCalor - calor[i]) * 0.12;
        }

        // respiração: onda diagonal lenta + bordas mais apagadas
        const onda = parado ? 0.5 : 0.5 + 0.5 * Math.sin(bx * 0.012 + by * 0.008 - t * 0.9);
        const centro = 1 - Math.hypot(bx - cx, by - cy) / diagonal;
        const alfa = (0.08 + onda * 0.1) * (0.35 + centro * 0.9);
        const x = bx + desvio[i * 2];
        const y = by + desvio[i * 2 + 1];
        const tamanho = 1.6 + onda * 0.6;

        if (calor[i] > 0.04) {
          acesos.push(i);
          continue;
        }
        ctx.globalAlpha = alfa;
        ctx.fillRect(x - tamanho / 2, y - tamanho / 2, tamanho, tamanho);
      }

      // os pontos acesos por cima, em menta e maiores
      ctx.fillStyle = `rgb(${menta[0]},${menta[1]},${menta[2]})`;
      for (const i of acesos) {
        const aceso = Math.min(1, calor[i]);
        const x = base[i * 2] + desvio[i * 2];
        const y = base[i * 2 + 1] + desvio[i * 2 + 1];
        const tamanho = 2 + aceso * 3.2;
        ctx.globalAlpha = 0.25 + aceso * 0.6;
        ctx.beginPath();
        ctx.arc(x, y, tamanho / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const laco = (agora: number) => {
      quadro = 0;
      desenhar(agora);
      if (!document.hidden) quadro = requestAnimationFrame(laco);
    };
    const ligar = () => {
      if (parado) {
        desenhar(performance.now());
        return;
      }
      if (!quadro && !document.hidden) quadro = requestAnimationFrame(laco);
    };

    const onMove = (event: PointerEvent) => {
      ponteiro.x = event.clientX;
      ponteiro.y = event.clientY;
      ponteiro.dentro = event.pointerType === "mouse" || event.pointerType === "pen";
    };
    const onLeave = () => {
      ponteiro.dentro = false;
    };
    const onDown = (event: PointerEvent) => {
      if (parado) return;
      ondas.push({ x: event.clientX, y: event.clientY, inicio: performance.now() });
      if (ondas.length > 4) ondas.shift();
    };
    const onResize = () => {
      medir();
      ligar();
    };
    const onVisibility = () => ligar();

    // o tema troca a classe do <html>: relê as cores na hora
    const tema = new MutationObserver(() => {
      lerCores();
      ligar();
    });
    tema.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });

    lerCores();
    medir();
    ligar();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    if (!parado) {
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerdown", onDown, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
    }

    return () => {
      cancelAnimationFrame(quadro);
      tema.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [parado]);

  return <canvas ref={ref} className="login-fundo" aria-hidden />;
}
