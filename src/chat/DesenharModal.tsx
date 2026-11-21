import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Eraser, Grid3x3, Paperclip, PenLine, Trash2, Undo2, X } from "lucide-react";
import "./desenhar.css";

/*
 * "Desenhar" no "+" do chat (21/nov/2026), como o Sketch do ChatGPT: um quadro
 * para rabiscar uma figura de geometria, um gráfico ou um esquema e mandar
 * para a Mine como imagem anexada. Fica só no aparelho até ser anexado.
 */

const W = 1200;
const H = 800;
const CORES = ["#1b1f2a", "#1d2bb8", "#d9344a", "#13955a", "#e09412"];
const TAMANHOS = [3, 6, 12];

type Traco = { cor: string; tamanho: number; borracha: boolean; pontos: [number, number][] };

function desenharTraco(ctx: CanvasRenderingContext2D, traco: Traco) {
  const [primeiro, ...resto] = traco.pontos;
  if (!primeiro) return;
  ctx.save();
  ctx.globalCompositeOperation = traco.borracha ? "destination-out" : "source-over";
  ctx.strokeStyle = traco.cor;
  ctx.fillStyle = traco.cor;
  ctx.lineWidth = traco.borracha ? traco.tamanho * 4 : traco.tamanho;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (!resto.length) {
    ctx.beginPath();
    ctx.arc(primeiro[0], primeiro[1], ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(primeiro[0], primeiro[1]);
    // Curva suave pelos pontos médios: o traço não sai serrilhado.
    for (let i = 0; i < resto.length - 1; i += 1) {
      const [x, y] = resto[i];
      const [nx, ny] = resto[i + 1];
      ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
    }
    const ultimo = resto[resto.length - 1];
    ctx.lineTo(ultimo[0], ultimo[1]);
    ctx.stroke();
  }
  ctx.restore();
}

export function DesenharModal({ onClose, onAttach }: { onClose: () => void; onAttach: (file: File) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tracos, setTracos] = useState<Traco[]>([]);
  const atual = useRef<Traco | null>(null);
  const [cor, setCor] = useState(CORES[0]);
  const [tamanho, setTamanho] = useState(TAMANHOS[1]);
  const [borracha, setBorracha] = useState(false);
  const [grade, setGrade] = useState(true);

  const redesenhar = (lista: Traco[]) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    lista.forEach((traco) => desenharTraco(ctx, traco));
  };

  useEffect(() => redesenhar(tracos), [tracos]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        setTracos((lista) => lista.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ponto = (event: ReactPointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [((event.clientX - rect.left) / rect.width) * W, ((event.clientY - rect.top) / rect.height) * H];
  };

  const comecar = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    atual.current = { cor, tamanho, borracha, pontos: [ponto(event)] };
    redesenhar([...tracos, atual.current]);
  };
  const mover = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!atual.current) return;
    atual.current.pontos.push(ponto(event));
    redesenhar([...tracos, atual.current]);
  };
  const terminar = () => {
    if (!atual.current) return;
    const feito = atual.current;
    atual.current = null;
    setTracos((lista) => [...lista, feito]);
  };

  const anexar = () => {
    // Fundo branco (e quadriculado, se ligado) entra na imagem: PNG
    // transparente fica preto em alguns leitores de imagem.
    const saida = document.createElement("canvas");
    saida.width = W;
    saida.height = H;
    const ctx = saida.getContext("2d");
    if (!ctx || !canvasRef.current) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    if (grade) {
      ctx.strokeStyle = "#dfe6f0";
      ctx.lineWidth = 1;
      for (let x = 40; x < W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 40; y < H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    }
    ctx.drawImage(canvasRef.current, 0, 0);
    saida.toBlob((blob) => {
      if (!blob) return;
      onAttach(new File([blob], `desenho-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.png`, { type: "image/png" }));
      onClose();
    }, "image/png");
  };

  return createPortal(
    <div className="mds-fundo" role="dialog" aria-modal="true" aria-label="Desenhar para a Mine" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="mds-janela">
        <header className="mds-topo">
          <strong>
            <PenLine aria-hidden /> Desenhar
          </strong>
          <span className="mds-dica">Rabisque uma figura, um gráfico ou a conta e mande para a Mine.</span>
          <button type="button" className="mds-icone" onClick={onClose} aria-label="Fechar">
            <X aria-hidden />
          </button>
        </header>
        <div className={`mds-quadro${grade ? " is-grade" : ""}`}>
          <canvas ref={canvasRef} width={W} height={H} onPointerDown={comecar} onPointerMove={mover} onPointerUp={terminar} onPointerCancel={terminar} aria-label="Quadro de desenho" />
        </div>
        <footer className="mds-barra">
          <div className="mds-grupo" role="radiogroup" aria-label="Cor">
            {CORES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={!borracha && cor === c}
                className={`mds-cor${!borracha && cor === c ? " is-on" : ""}`}
                style={{ background: c }}
                onClick={() => {
                  setCor(c);
                  setBorracha(false);
                }}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
          <div className="mds-grupo" role="radiogroup" aria-label="Espessura">
            {TAMANHOS.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={tamanho === t} className={`mds-icone${tamanho === t ? " is-on" : ""}`} onClick={() => setTamanho(t)} aria-label={`Espessura ${t}`}>
                <i className="mds-ponto" style={{ width: t + 3, height: t + 3 }} />
              </button>
            ))}
          </div>
          <div className="mds-grupo">
            <button type="button" className={`mds-icone${borracha ? " is-on" : ""}`} onClick={() => setBorracha((v) => !v)} aria-pressed={borracha} aria-label="Borracha" title="Borracha">
              <Eraser aria-hidden />
            </button>
            <button type="button" className={`mds-icone${grade ? " is-on" : ""}`} onClick={() => setGrade((v) => !v)} aria-pressed={grade} aria-label="Quadriculado" title="Quadriculado">
              <Grid3x3 aria-hidden />
            </button>
            <button type="button" className="mds-icone" onClick={() => setTracos((lista) => lista.slice(0, -1))} disabled={!tracos.length} aria-label="Desfazer" title="Desfazer (Ctrl+Z)">
              <Undo2 aria-hidden />
            </button>
            <button type="button" className="mds-icone" onClick={() => setTracos([])} disabled={!tracos.length} aria-label="Apagar tudo" title="Apagar tudo">
              <Trash2 aria-hidden />
            </button>
          </div>
          <button type="button" className="mds-anexar" onClick={anexar} disabled={!tracos.length}>
            <Paperclip aria-hidden /> Anexar ao chat
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
