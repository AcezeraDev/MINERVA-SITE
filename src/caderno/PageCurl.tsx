/*
  Virada de página de verdade.

  Quando a rota muda, a página que sai é dobrada pelo canto de baixo à
  direita e virada para a esquerda, como folha de caderno:

  - a linha da dobra é x + K·y = c, com c correndo da quina até passar da
    margem esquerda;
  - a página antiga ganha um clip-path com o lado de cá da dobra (o resto
    "já virou");
  - o verso da folha é uma camada fixa com o lado de lá da dobra, refletida
    sobre a própria linha (translate → rotate → espelho → rotate de volta);
  - uma faixa de sombra corre junto da dobra, por cima da folha nova.

  O App segura a página antiga na tela pelo tempo da virada (exit do
  AnimatePresence com a mesma duração) e só então a próxima entra.
  Só roda no tier alto/médio e sem movimento reduzido; senão o App usa a
  virada simples de antes.
*/
import React, { useLayoutEffect, useRef } from "react";
import { animate, type Variants } from "framer-motion";
import { playPageFlip } from "./sons";
import "./caderno-pagecurl.css";

export const CURL_SECONDS = 0.7;
const K = 0.42;

type Point = [number, number];

/** Recorta um retângulo pelo semiplano x + K·y < c (keepLess) ou > c. */
function clipRect(x0: number, y0: number, x1: number, y1: number, c: number, keepLess: boolean): Point[] {
  const corners: Point[] = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  const side = (point: Point) => (point[0] + K * point[1] - c) * (keepLess ? -1 : 1) >= 0;
  const out: Point[] = [];
  for (let index = 0; index < corners.length; index += 1) {
    const a = corners[index];
    const b = corners[(index + 1) % corners.length];
    const inA = side(a);
    const inB = side(b);
    if (inA) out.push(a);
    if (inA !== inB) {
      const fa = a[0] + K * a[1] - c;
      const fb = b[0] + K * b[1] - c;
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

function polygon(points: Point[], dx = 0, dy = 0) {
  if (points.length < 3) return "polygon(0 0, 0 0, 0 0)";
  return `polygon(${points.map(([x, y]) => `${(x - dx).toFixed(1)}px ${(y - dy).toFixed(1)}px`).join(", ")})`;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Variantes da página quando a virada de verdade está ligada. */
export const pageCurlVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.2, 0.8, 0.2, 1] } },
  // a página antiga fica parada (o PageCurl a recorta) pelo tempo da virada
  exit: { opacity: 0.999, transition: { duration: CURL_SECONDS } },
};

export function PageCurl({ routeKey }: { routeKey: string }) {
  const layer = useRef<HTMLDivElement | null>(null);
  const back = useRef<HTMLDivElement | null>(null);
  const shade = useRef<HTMLDivElement | null>(null);
  const first = useRef(true);

  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // só a página que está saindo (chave diferente da rota nova); se ela já
    // saiu, não há o que virar
    const old = [...document.querySelectorAll<HTMLElement>("[data-page-layer]")].find(
      (element) => element.dataset.pageLayer !== routeKey,
    );
    const main = old?.closest("main");
    if (!old || !main || !layer.current || !back.current || !shade.current) return;
    playPageFlip();

    const mainRect = main.getBoundingClientRect();
    const left = Math.max(0, mainRect.left);
    const W = Math.min(window.innerWidth, mainRect.right) - left;
    const H = window.innerHeight;
    const host = layer.current;
    host.style.left = `${left}px`;
    host.style.width = `${W}px`;
    host.style.display = "block";
    const startC = W + K * H + 4;
    const endC = -K * 40 - 24;

    const frame = (progress: number) => {
      const c = startC + (endC - startC) * easeInOut(progress);
      const pageRect = old.getBoundingClientRect();
      // página antiga: só o lado que ainda não virou (coordenadas da página)
      const keep = clipRect(pageRect.left - left, pageRect.top, pageRect.right - left, pageRect.bottom, c, true);
      old.style.clipPath = polygon(keep, pageRect.left - left, pageRect.top);
      // verso: o pedaço que já virou, espelhado sobre a dobra
      const turned = clipRect(0, 0, W, H, c, false);
      const angle = (Math.atan2(-1, K) * 180) / Math.PI;
      back.current!.style.clipPath = polygon(turned);
      back.current!.style.transform = `translate(${c}px, 0px) rotate(${angle}deg) scaleY(-1) rotate(${-angle}deg) translate(${-c}px, 0px)`;
      // sombra da folha sobre a página nova, encostada na dobra
      shade.current!.style.transform = `translate(${c}px, 0px) rotate(${angle + 90}deg)`;
      shade.current!.style.opacity = String(Math.min(1, progress * 6, (1 - progress) * 5));
      // o verso escurece perto da dobra: mesma faixa, por dentro da folha
      const fold = back.current!.firstElementChild as HTMLElement | null;
      if (fold) fold.style.transform = shade.current!.style.transform;
    };

    frame(0);
    const controls = animate(0, 1, { duration: CURL_SECONDS, ease: "linear", onUpdate: frame });
    const done = window.setTimeout(() => {
      host.style.display = "none";
      old.style.clipPath = "";
    }, CURL_SECONDS * 1000 + 40);
    return () => {
      controls.stop();
      window.clearTimeout(done);
      host.style.display = "none";
      old.style.clipPath = "";
    };
  }, [routeKey]);

  return (
    <div ref={layer} className="caderno-pagecurl" aria-hidden>
      <div ref={shade} className="caderno-pagecurl-shade" />
      <div ref={back} className="caderno-pagecurl-back">
        <div className="caderno-pagecurl-fold" />
      </div>
    </div>
  );
}
