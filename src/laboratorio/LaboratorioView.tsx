// Carregado sob demanda (React.lazy): a aba Laboratório, com simulações de
// física e química para mexer e desafios que valem XP.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Atom, Beaker, Bot, CheckCircle2, CircuitBoard, FlaskConical, Hand, Play, RotateCcw, Rocket, Target, Triangle } from "lucide-react";
import { PageHeader, uid, type Session, type User, type useMemoUserData, type AppData } from "../main";
import { useSoftMotion } from "../motion";
import { celebrateFrom, floatXp, mineConversa, mineSays } from "../caderno";
import { labPorDia, labXp } from "../../shared/xp.mjs";
import {
  circuito,
  classificaPh,
  corRepolho,
  fmt,
  gravidades,
  lancamento,
  ph,
  plano,
  posicaoNoTempo,
  semSolucao,
  type Circuito,
  type Lancamento,
  type Plano,
} from "./simulacoes";
import { useCena3D } from "../cena3d/Cena3D";
import type { AcaoLab, EstadoLab, ExpId, Valores } from "./tipos";
import "./laboratorio.css";
import "./laboratorio-3d.css";

const Bancada3D = React.lazy(() => import("./Bancada3D"));

/** Se a cena 3D quebrar, a bancada volta para o desenho 2D sem derrubar a aba. */
class Guarda extends React.Component<{ onFail: () => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const experimentos: Array<{ id: ExpId; nome: string; materia: string; icone: typeof Atom; resumo: string; cor: string; gesto: string }> = [
  { id: "plano", nome: "Plano inclinado", materia: "Física · Dinâmica", icone: Triangle, resumo: "Peso, normal e atrito decidem se o bloco escorrega.", cor: "var(--hl-lilac)", gesto: "arraste a bolinha verde no topo da rampa" },
  { id: "circuito", nome: "Circuito elétrico", materia: "Física · Eletricidade", icone: CircuitBoard, resumo: "Lei de Ohm com resistores em série e em paralelo.", cor: "var(--hl-yellow)", gesto: "arraste a bateria ou um resistor · toque no seletor" },
  { id: "ph", nome: "Ácido + base", materia: "Química · Soluções", icone: Beaker, resumo: "Misture HCl e NaOH e veja o repolho roxo mudar de cor.", cor: "var(--hl-pink)", gesto: "toque numa bureta para pingar 1 mL" },
  { id: "lancamento", nome: "Lançamento oblíquo", materia: "Física · Cinemática", icone: Rocket, resumo: "Velocidade, ângulo e gravidade desenham a parábola.", cor: "var(--hl-mint)", gesto: "arraste o cano para mirar · toque no canhão para lançar" },
];

type Desafio = { id: string; exp: ExpId; texto: string; dica: string; cumprido: (v: Valores, extra: { lancou: boolean }) => boolean };

const desafios: Desafio[] = [
  {
    id: "plano-parado",
    exp: "plano",
    texto: "Com a rampa em 35°, deixe o bloco parado.",
    dica: "O bloco para quando o atrito máximo (μ·N) vence a componente do peso na rampa. Precisa de μ ≥ tg 35°.",
    cumprido: (v) => Math.abs(v.plano.anguloGraus - 35) <= 0.5 && !plano(v.plano).desliza,
  },
  {
    id: "plano-acel",
    exp: "plano",
    texto: "Faça o bloco descer com aceleração entre 3 e 4 m/s².",
    dica: "a = g·(sen θ − μ·cos θ). A massa não muda a aceleração!",
    cumprido: (v) => {
      const r = plano(v.plano);
      return r.desliza && r.aceleracao >= 3 && r.aceleracao <= 4;
    },
  },
  {
    id: "circ-2a",
    exp: "circuito",
    texto: "Faça passar exatamente 2 A pela bateria (entre 1,95 e 2,05 A).",
    dica: "I = U / R equivalente. Em série as resistências se somam.",
    cumprido: (v) => Math.abs(circuito(v.circuito).corrente - 2) <= 0.05,
  },
  {
    id: "circ-paralelo",
    exp: "circuito",
    texto: "Em paralelo, com 12 V, faça a corrente total passar de 3 A.",
    dica: "Em paralelo, 1/Req = 1/R1 + 1/R2: a resistência equivalente fica menor que a menor delas.",
    cumprido: (v) => v.circuito.ligacao === "paralelo" && v.circuito.tensao === 12 && circuito(v.circuito).corrente > 3,
  },
  {
    id: "ph-neutro",
    exp: "ph",
    texto: "Deixe a solução neutra (pH entre 6,5 e 7,5) com pelo menos 20 mL de ácido.",
    dica: "As duas soluções têm a mesma concentração: o mesmo volume de cada uma neutraliza.",
    cumprido: (v) => {
      const valor = ph(v.ph.acido, v.ph.base);
      return v.ph.acido >= 20 && valor >= 6.5 && valor <= 7.5;
    },
  },
  {
    id: "ph-verde",
    exp: "ph",
    texto: "Deixe o repolho roxo verde (pH entre 11 e 12,5).",
    dica: "Base sobrando deixa o pH alto. Comece com um pouco mais de NaOH que de HCl.",
    cumprido: (v) => {
      const valor = ph(v.ph.acido, v.ph.base);
      return valor >= 11 && valor < 12.5;
    },
  },
  {
    id: "lanc-alvo",
    exp: "lancamento",
    texto: "Na Terra, lance e acerte o alvo a 40 m (com 1,5 m de folga).",
    dica: "Alcance = v²·sen(2θ)/g. Com 45° o alcance é o maior possível para a mesma velocidade.",
    cumprido: (v, extra) => extra.lancou && v.lancamento.gid === "terra" && Math.abs(lancamento(v.lancamento).alcance - 40) <= 1.5,
  },
  {
    id: "lanc-lua",
    exp: "lancamento",
    texto: "Na Lua, lance a bola a mais de 100 m de altura.",
    dica: "Altura máxima = (v·sen θ)²/(2g). Na Lua g é só 1,62 m/s².",
    cumprido: (v, extra) => extra.lancou && v.lancamento.gid === "lua" && lancamento(v.lancamento).alturaMax > 100,
  },
];

const inicial: Valores = {
  plano: { anguloGraus: 25, massa: 2, atrito: 0.3 },
  circuito: { tensao: 9, r1: 6, r2: 3, ligacao: "serie" },
  ph: { acido: 25, base: 10 },
  lancamento: { velocidade: 18, anguloGraus: 40, g: 9.8, gid: "terra" },
};

function lerLocal<T>(chave: string, padrao: T): T {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravarLocal(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem armazenamento local os valores valem só enquanto a aba está aberta.
  }
}

function hojeChave() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Cores do caderno lidas das variáveis CSS, para o canvas seguir o tema claro/escuro. */
function cores() {
  const css = getComputedStyle(document.documentElement);
  const v = (nome: string, padrao: string) => {
    const valor = css.getPropertyValue(nome).trim();
    return valor ? `rgb(${valor.split(/\s+/).join(",")})` : padrao;
  };
  return {
    texto: v("--theme-text", "#1a1d24"),
    fraco: v("--theme-muted", "#5a6272"),
    linha: v("--line", "#cbd7e6"),
    regua: v("--rule", "#cbd7e6"),
    caneta: v("--pen", "#1d2bb8"),
    menta: v("--hl-mint", "#8df7b4"),
    rosa: v("--hl-pink", "#ffb3c1"),
    amarelo: v("--hl-yellow", "#f4f05a"),
    lilas: v("--hl-lilac", "#c9bcff"),
    papel: v("--sheet", "#f7f9fb"),
  };
}

type Desenho = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, c: ReturnType<typeof cores>) => void;

/**
 * Canvas com laço de animação. Para quando a aba do navegador some e quando o
 * palco sai da tela, para não gastar bateria à toa; com movimento reduzido
 * desenha um quadro só por mudança.
 */
function Palco({ desenhar, animado, rotulo }: { desenhar: Desenho; animado: boolean; rotulo: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const desenhoRef = useRef(desenhar);
  desenhoRef.current = desenhar;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let quadro = 0;
    let visivel = true;
    let paleta = cores();
    const inicio = performance.now();
    const pintar = (agora: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      desenhoRef.current(ctx, w, h, (agora - inicio) / 1000, paleta);
    };
    const laco = (agora: number) => {
      pintar(agora);
      if (animado && visivel && !document.hidden) quadro = requestAnimationFrame(laco);
      else quadro = 0;
    };
    const retomar = () => {
      if (!quadro) quadro = requestAnimationFrame(laco);
    };
    const observador = new IntersectionObserver(([entrada]) => {
      visivel = entrada.isIntersecting;
      if (visivel) retomar();
    });
    observador.observe(canvas);
    const tema = new MutationObserver(() => {
      paleta = cores();
      retomar();
    });
    tema.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    const voltou = () => !document.hidden && retomar();
    document.addEventListener("visibilitychange", voltou);
    window.addEventListener("resize", retomar);
    quadro = requestAnimationFrame(laco);
    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
      tema.disconnect();
      document.removeEventListener("visibilitychange", voltou);
      window.removeEventListener("resize", retomar);
    };
  }, [animado]);

  // Valores mudaram com a animação parada: redesenha uma vez.
  useEffect(() => {
    if (animado) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    desenhar(ctx, canvas.clientWidth, canvas.clientHeight, 0, cores());
  });

  return <canvas ref={ref} className="lab-canvas" role="img" aria-label={rotulo} />;
}

function seta(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, cor: string, rotulo: string) {
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.fillStyle = cor;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx, y + dy);
  ctx.stroke();
  const ang = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(x + dx, y + dy);
  ctx.lineTo(x + dx - 9 * Math.cos(ang - 0.45), y + dy - 9 * Math.sin(ang - 0.45));
  ctx.lineTo(x + dx - 9 * Math.cos(ang + 0.45), y + dy - 9 * Math.sin(ang + 0.45));
  ctx.closePath();
  ctx.fill();
  ctx.font = "700 12px system-ui, sans-serif";
  ctx.fillText(rotulo, x + dx + 6 * Math.cos(ang) + 4, y + dy + 6 * Math.sin(ang) + 4);
  ctx.restore();
}

/* ---------------- desenhos ---------------- */

function desenhoPlano(v: Plano, reduzido: boolean): Desenho {
  const r = plano(v);
  return (ctx, w, h, t, c) => {
    const base = Math.min(w * 0.78, 520);
    const x0 = (w - base) / 2;
    const y0 = h - 34;
    const ang = (v.anguloGraus * Math.PI) / 180;
    const altura = Math.min(base * Math.tan(ang), h - 70);
    const comp = altura / Math.sin(ang || 1e-6);
    const larguraReal = altura / Math.tan(ang || 1e-6);
    const xb = x0 + base - larguraReal;
    // chão
    ctx.strokeStyle = c.linha;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, y0);
    ctx.lineTo(w - 16, y0);
    ctx.stroke();
    // rampa
    ctx.fillStyle = c.lilas;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(xb, y0);
    ctx.lineTo(x0 + base, y0);
    ctx.lineTo(x0 + base, y0 - altura);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = c.texto;
    ctx.stroke();
    // ângulo
    ctx.beginPath();
    ctx.strokeStyle = c.caneta;
    ctx.arc(xb, y0, 34, -ang, 0);
    ctx.stroke();
    ctx.fillStyle = c.caneta;
    ctx.font = "700 13px system-ui, sans-serif";
    ctx.fillText(`${fmt(v.anguloGraus, 0)}°`, xb + 40, y0 - 8);
    // bloco escorregando: s = a·t²/2, recomeçando a cada descida
    const lado = 26 + v.massa * 3;
    let s = comp * 0.72;
    if (r.desliza && !reduzido) {
      const tempoDescida = Math.sqrt((2 * (comp * 0.44)) / Math.max(0.05, r.aceleracao * 22));
      const tt = t % (tempoDescida + 0.6);
      s = Math.max(comp * 0.28, comp * 0.72 - 0.5 * r.aceleracao * 22 * Math.min(tt, tempoDescida) ** 2);
    }
    const cx = xb + Math.cos(ang) * s;
    const cy = y0 - Math.sin(ang) * s;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-ang);
    ctx.fillStyle = r.desliza ? c.rosa : c.menta;
    ctx.strokeStyle = c.texto;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-lado / 2, -lado, lado, lado, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#14161b";
    ctx.font = "800 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${fmt(v.massa, 0)} kg`, 0, -lado / 2 + 4);
    ctx.restore();
    // forças a partir do centro do bloco
    const meio = { x: cx - Math.sin(ang) * (lado / 2), y: cy - Math.cos(ang) * (lado / 2) };
    // O peso sempre com ~70 px; as outras forças na mesma proporção, para
    // dar para comparar o tamanho das setas com os números do quadro.
    const k = Math.min(78, h * 0.24) / r.peso;
    seta(ctx, meio.x, meio.y, 0, r.peso * k, c.texto, "P");
    seta(ctx, meio.x, meio.y, -Math.sin(ang) * r.normal * k, -Math.cos(ang) * r.normal * k, c.caneta, "N");
    if (r.atrito > 0.01) seta(ctx, meio.x, meio.y, Math.cos(ang) * r.atrito * k, -Math.sin(ang) * r.atrito * k, "#e0533d", "Fat");
  };
}

function desenhoCircuito(v: Circuito, reduzido: boolean): Desenho {
  const r = circuito(v);
  return (ctx, w, h, t, c) => {
    const x0 = Math.max(30, w / 2 - 230);
    const x1 = Math.min(w - 30, w / 2 + 230);
    const y0 = 40;
    const y1 = h - 40;
    ctx.lineWidth = 3;
    ctx.strokeStyle = c.texto;
    ctx.lineJoin = "round";
    const meioX = (x0 + x1) / 2;
    // caminhos dos elétrons (sentido convencional: + sai por cima)
    const caminhos: Array<{ pts: Array<[number, number]>; i: number }> = [];
    if (v.ligacao === "serie") {
      caminhos.push({ pts: [[x0, y1], [x0, y0], [x1, y0], [x1, y1], [x0, y1]], i: r.corrente });
    } else {
      const ya = y0 + (y1 - y0) * 0.33;
      const yb = y0 + (y1 - y0) * 0.72;
      caminhos.push({ pts: [[x0, y1], [x0, y0], [meioX, y0], [meioX, ya], [x1 - 40, ya], [x1 - 40, y1], [x0, y1]], i: r.i1 });
      caminhos.push({ pts: [[x0, y1], [x0, y0], [meioX, y0], [meioX, yb], [x1 - 40, yb], [x1 - 40, y1], [x0, y1]], i: r.i2 });
    }
    for (const caminho of caminhos) {
      ctx.beginPath();
      caminho.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    // bateria na esquerda
    const by = (y0 + y1) / 2;
    ctx.fillStyle = c.papel;
    ctx.fillRect(x0 - 16, by - 26, 32, 52);
    ctx.fillStyle = c.texto;
    ctx.fillRect(x0 - 16, by - 8, 32, 3);
    ctx.fillRect(x0 - 9, by + 6, 18, 3);
    ctx.font = "800 13px system-ui, sans-serif";
    ctx.fillText(`${fmt(v.tensao, 0)} V`, x0 + 22, by + 5);
    // resistores
    const resistor = (x: number, y: number, rot: string, cor: string) => {
      ctx.fillStyle = c.papel;
      ctx.fillRect(x - 44, y - 12, 88, 24);
      ctx.fillStyle = cor;
      ctx.strokeStyle = c.texto;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - 36, y - 11, 72, 22, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#14161b";
      ctx.textAlign = "center";
      ctx.font = "800 12px system-ui, sans-serif";
      ctx.fillText(rot, x, y + 4);
      ctx.textAlign = "left";
      ctx.lineWidth = 3;
    };
    if (v.ligacao === "serie") {
      resistor(meioX - 70, y0, `R1 ${fmt(v.r1, 0)} Ω`, c.amarelo);
      resistor(meioX + 90, y0, `R2 ${fmt(v.r2, 0)} Ω`, c.rosa);
    } else {
      resistor(meioX + 90, y0 + (y1 - y0) * 0.33, `R1 ${fmt(v.r1, 0)} Ω`, c.amarelo);
      resistor(meioX + 90, y0 + (y1 - y0) * 0.72, `R2 ${fmt(v.r2, 0)} Ω`, c.rosa);
    }
    // lâmpada no fio de baixo: brilho pela potência
    const lx = meioX;
    const brilho = Math.min(1, r.potencia / 40);
    const grad = ctx.createRadialGradient(lx, y1, 2, lx, y1, 40 + 30 * brilho);
    grad.addColorStop(0, `rgba(255, 220, 90, ${0.25 + 0.7 * brilho})`);
    grad.addColorStop(1, "rgba(255, 220, 90, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(lx, y1, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgb(255, ${200 + Math.round(40 * brilho)}, ${80 + Math.round(60 * brilho)})`;
    ctx.strokeStyle = c.texto;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(lx, y1, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // cargas andando: velocidade proporcional à corrente de cada ramo
    if (!reduzido) {
      for (const caminho of caminhos) {
        const segs = caminho.pts.slice(1).map(([x, y], i) => {
          const [px, py] = caminho.pts[i];
          return { px, py, x, y, len: Math.hypot(x - px, y - py) };
        });
        const total = segs.reduce((s, seg) => s + seg.len, 0);
        const passo = 34;
        const desloc = (t * caminho.i * 38) % passo;
        ctx.fillStyle = c.caneta;
        for (let d = desloc; d < total; d += passo) {
          let resto = d;
          const seg = segs.find((item) => (resto <= item.len ? true : ((resto -= item.len), false)));
          if (!seg) continue;
          const f = resto / (seg.len || 1);
          ctx.beginPath();
          ctx.arc(seg.px + (seg.x - seg.px) * f, seg.py + (seg.y - seg.py) * f, 3.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.fillStyle = c.texto;
    ctx.font = "800 14px system-ui, sans-serif";
    ctx.fillText(`I = ${fmt(r.corrente, 2)} A`, Math.min(w - 120, x1 - 90), y1 + 28);
  };
}

function desenhoPh(acido: number, base: number, reduzido: boolean): Desenho {
  const valor = ph(acido, base);
  const { cor } = corRepolho(valor);
  const vazio = semSolucao(acido, base);
  return (ctx, w, h, t, c) => {
    const bw = Math.min(200, w * 0.4);
    const bh = h - 110;
    const bx = w / 2 - bw / 2;
    const by = 24;
    const volume = acido + base;
    const nivel = Math.min(1, volume / 100);
    const ly = by + bh - bh * 0.92 * nivel;
    // líquido
    ctx.fillStyle = cor;
    ctx.globalAlpha = vazio ? 0 : 0.85;
    ctx.beginPath();
    ctx.moveTo(bx + 4, ly);
    for (let x = 0; x <= bw - 8; x += 6) ctx.lineTo(bx + 4 + x, ly + (reduzido ? 0 : Math.sin(x / 18 + t * 2.4) * 2.2));
    ctx.lineTo(bx + bw - 4, by + bh - 4);
    ctx.lineTo(bx + 4, by + bh - 4);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    // bolhas
    if (!reduzido && volume > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      for (let i = 0; i < 9; i += 1) {
        const fase = (t * (0.35 + (i % 3) * 0.12) + i * 0.37) % 1;
        const x = bx + 18 + ((i * 53) % (bw - 36));
        const y = by + bh - 8 - fase * (by + bh - 8 - ly);
        ctx.beginPath();
        ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // béquer
    ctx.strokeStyle = c.texto;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx - 8, by);
    ctx.lineTo(bx, by + 6);
    ctx.lineTo(bx, by + bh);
    ctx.lineTo(bx + bw, by + bh);
    ctx.lineTo(bx + bw, by + 6);
    ctx.lineTo(bx + bw + 8, by);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = c.fraco;
    ctx.font = "600 11px system-ui, sans-serif";
    for (let m = 20; m <= 100; m += 20) {
      const y = by + bh - (bh * 0.92 * m) / 100;
      ctx.beginPath();
      ctx.moveTo(bx + bw - 16, y);
      ctx.lineTo(bx + bw, y);
      ctx.strokeStyle = c.fraco;
      ctx.stroke();
      ctx.fillText(`${m}`, bx + bw + 6, y + 4);
    }
    // escala de pH
    const sy = h - 52;
    const sx = 24;
    const sw = w - 48;
    for (let i = 0; i < 140; i += 1) {
      ctx.fillStyle = corRepolho(i / 10).cor;
      ctx.fillRect(sx + (sw * i) / 140, sy, sw / 140 + 1, 14);
    }
    ctx.fillStyle = c.texto;
    ctx.font = "700 11px system-ui, sans-serif";
    for (let i = 0; i <= 14; i += 2) ctx.fillText(String(i), sx + (sw * i) / 14 - 3, sy + 30);
    if (vazio) {
      ctx.font = "800 13px system-ui, sans-serif";
      ctx.fillText("Sem solução: pingue ácido ou base", sx, sy - 12);
      ctx.font = "700 15px system-ui, sans-serif";
      ctx.fillText("béquer vazio", bx + bw / 2 - 44, by + bh - 20);
      return;
    }
    const mx = sx + (sw * valor) / 14;
    ctx.beginPath();
    ctx.moveTo(mx, sy - 2);
    ctx.lineTo(mx - 7, sy - 13);
    ctx.lineTo(mx + 7, sy - 13);
    ctx.closePath();
    ctx.fill();
    ctx.font = "800 13px system-ui, sans-serif";
    ctx.fillText(`pH ${fmt(valor, 2)}`, Math.min(w - 80, Math.max(8, mx - 28)), sy - 18);
  };
}

function desenhoLancamento(v: Lancamento, lance: { inicio: number } | null, alvo: number | null, reduzido: boolean): Desenho {
  const r = lancamento(v);
  return (ctx, w, h, _t, c) => {
    const margem = 36;
    const mundoX = Math.max(50, r.alcance * 1.12, alvo ? alvo * 1.2 : 0);
    const mundoY = Math.max(20, r.alturaMax * 1.25);
    const escala = Math.min((w - margem * 2) / mundoX, (h - margem * 2) / mundoY);
    const ox = margem;
    const oy = h - margem;
    const px = (x: number) => ox + x * escala;
    const py = (y: number) => oy - y * escala;
    // chão e régua
    ctx.strokeStyle = c.linha;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, oy);
    ctx.lineTo(w - 8, oy);
    ctx.stroke();
    ctx.fillStyle = c.fraco;
    ctx.font = "600 11px system-ui, sans-serif";
    const passo = mundoX > 300 ? 100 : mundoX > 120 ? 50 : 10;
    for (let x = 0; x <= mundoX; x += passo) {
      ctx.fillRect(px(x), oy, 1, 6);
      ctx.fillText(`${x} m`, px(x) - 8, oy + 18);
    }
    // alvo
    if (alvo) {
      ctx.fillStyle = "#e0533d";
      ctx.beginPath();
      ctx.ellipse(px(alvo), oy, Math.max(10, 1.5 * escala), 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(px(alvo) - 1, oy - 34, 2, 34);
      ctx.beginPath();
      ctx.moveTo(px(alvo) + 1, oy - 34);
      ctx.lineTo(px(alvo) + 18, oy - 28);
      ctx.lineTo(px(alvo) + 1, oy - 22);
      ctx.fill();
    }
    // trajetória prevista (pontilhada)
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = c.fraco;
    ctx.beginPath();
    for (let i = 0; i <= 60; i += 1) {
      const p = posicaoNoTempo(v, (r.tempoVoo * i) / 60);
      if (i) ctx.lineTo(px(p.x), py(Math.max(0, p.y)));
      else ctx.moveTo(px(p.x), py(p.y));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // canhão
    const ang = (v.anguloGraus * Math.PI) / 180;
    ctx.strokeStyle = c.texto;
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(ang) * 30, oy - Math.sin(ang) * 30);
    ctx.stroke();
    ctx.lineCap = "butt";
    // bola em voo: o voo leva entre 1,2 e 3 s na tela, seja qual for o tempo real
    if (lance) {
      const duracaoTela = Math.min(3, Math.max(1.2, r.tempoVoo / 2));
      const f = reduzido ? 1 : Math.min(1, (performance.now() - lance.inicio) / 1000 / duracaoTela);
      const tt = r.tempoVoo * f;
      ctx.strokeStyle = c.caneta;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= 50; i += 1) {
        const p = posicaoNoTempo(v, (tt * i) / 50);
        if (i) ctx.lineTo(px(p.x), py(Math.max(0, p.y)));
        else ctx.moveTo(px(p.x), py(p.y));
      }
      ctx.stroke();
      const p = posicaoNoTempo(v, tt);
      ctx.fillStyle = c.rosa;
      ctx.strokeStyle = c.texto;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px(p.x), py(Math.max(0, p.y)), 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (f >= 1) {
        ctx.fillStyle = c.texto;
        ctx.font = "800 13px system-ui, sans-serif";
        ctx.fillText(`${fmt(r.alcance, 1)} m`, Math.min(w - 70, px(r.alcance) - 20), oy - (alvo ? 44 : 16));
      }
    }
  };
}

/* ---------------- controles ---------------- */

function Controle({ rotulo, valor, unidade, min, max, passo, onChange }: { rotulo: string; valor: number; unidade: string; min: number; max: number; passo: number; onChange: (n: number) => void }) {
  const id = `lab-${rotulo.replace(/\W+/g, "-")}`;
  const pct = ((valor - min) / (max - min)) * 100;
  return (
    <div className="lab-controle" style={{ "--pct": `${pct}%` } as React.CSSProperties}>
      <label htmlFor={id}>
        <span>{rotulo}</span>
        <strong>
          {fmt(valor, passo < 1 ? (passo < 0.1 ? 2 : 1) : 0)} {unidade}
        </strong>
      </label>
      <input id={id} type="range" min={min} max={max} step={passo} value={valor} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function Leitura({ itens, reduced }: { itens: Array<[string, string, string?]>; reduced: boolean }) {
  return (
    <dl className="lab-leituras">
      {itens.map(([nome, valor, formula], i) => (
        <motion.div
          key={nome}
          className="lab-leitura"
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30, delay: i * 0.04 }}
        >
          <dt>{nome}</dt>
          <dd className="lab-leitura-valor">
            {/* cada valor novo entra por cima (o número "rola" como num visor) */}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={valor}
                initial={reduced ? false : { y: -14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 14, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              >
                {valor}
              </motion.span>
            </AnimatePresence>
          </dd>
          {formula ? <dd className="lab-formula">{formula}</dd> : null}
        </motion.div>
      ))}
    </dl>
  );
}

export function LaboratorioView({ user, update }: { data: ReturnType<typeof useMemoUserData>; user: User; update: (next: (draft: AppData) => AppData) => void }) {
  const reduced = useSoftMotion();
  const chaveValores = `minerva:lab:${user.id}`;
  const chaveFeitos = `minerva:lab-feitos:${user.id}`;
  const [exp, setExp] = useState<ExpId>(() => lerLocal<{ exp?: ExpId }>(chaveValores, {}).exp || "plano");
  const [valores, setValores] = useState<Valores>(() => ({ ...inicial, ...lerLocal<{ v?: Partial<Valores> }>(chaveValores, {}).v }));
  const [lance, setLance] = useState<{ inicio: number } | null>(null);
  const [lancou, setLancou] = useState(false);
  const [feitos, setFeitos] = useState<{ dia: string; ids: string[] }>(() => lerLocal(chaveFeitos, { dia: hojeChave(), ids: [] as string[] }));
  const [desafioId, setDesafioId] = useState<string>(() => desafios.find((item) => item.exp === exp)?.id || desafios[0].id);
  const desafioRef = useRef<HTMLDivElement>(null);
  const [comemorar, setComemorar] = useState(0);
  const escolhaRef = useRef<HTMLDivElement>(null);
  // no celular a escolha é uma faixa que rola de lado: traz o experimento ativo para a vista
  useEffect(() => {
    const faixa = escolhaRef.current;
    const ativo = faixa?.querySelector<HTMLElement>(".lab-exp.is-on");
    if (!faixa || !ativo || faixa.scrollWidth <= faixa.clientWidth) return;
    faixa.scrollTo({ left: ativo.offsetLeft - 16, behavior: reduced ? "auto" : "smooth" });
  }, [exp, reduced]);
  const ligada3d = useCena3D();
  const [falhou3d, setFalhou3d] = useState(false);
  const em3d = ligada3d && !falhou3d;

  useEffect(() => gravarLocal(chaveValores, { exp, v: valores }), [chaveValores, exp, valores]);

  const hoje = feitos.dia === hojeChave() ? feitos.ids : [];
  const desafiosDaVez = desafios.filter((item) => item.exp === exp);
  const desafio = desafiosDaVez.find((item) => item.id === desafioId) || desafiosDaVez[0];
  const cumprido = desafio.cumprido(valores, { lancou });
  const jaFeito = hoje.includes(desafio.id);

  // Desafio cumprido: registra uma vez por dia e dá o XP.
  useEffect(() => {
    if (!cumprido || jaFeito) return;
    const ids = [...hoje, desafio.id];
    const novo = { dia: hojeChave(), ids };
    setFeitos(novo);
    gravarLocal(chaveFeitos, novo);
    const valeXp = ids.length <= labPorDia;
    const xp = valeXp ? labXp() : 0;
    const session: Session = {
      id: uid("lab"),
      userId: user.id,
      subjectId: "laboratorio",
      title: `Laboratório: ${desafio.texto}`.slice(0, 140),
      kind: "Laboratório",
      createdAt: Date.now(),
      xpEarned: xp,
    };
    update((draft) => ({ ...draft, sessions: [...draft.sessions, session] }));
    window.setTimeout(() => {
      if (xp) floatXp(`+${xp} XP`, desafioRef.current);
      celebrateFrom(desafioRef.current, { count: 28 });
    }, 80);
    mineSays("Desafio cumprido! Experimento perfeito 🔬", "wow");
    setComemorar((n) => n + 1);
  }, [cumprido, jaFeito, desafio, hoje, chaveFeitos, update, user.id]);

  const trocarExp = (id: ExpId) => {
    setExp(id);
    setDesafioId(desafios.find((item) => item.exp === id)?.id || desafios[0].id);
    setLance(null);
    setLancou(false);
  };

  const mudar = <K extends ExpId>(chave: K, parcial: Partial<Valores[K]>) => {
    setValores((atual) => ({ ...atual, [chave]: { ...atual[chave], ...parcial } }));
    if (chave === "lancamento") {
      setLance(null);
      setLancou(false);
    }
  };

  const lancar = () => {
    setLance({ inicio: performance.now() });
    const r = lancamento(valores.lancamento);
    const duracao = Math.min(3, Math.max(1.2, r.tempoVoo / 2));
    window.setTimeout(() => setLancou(true), reduced ? 0 : duracao * 1000 + 50);
  };

  const mudarRef = useRef(mudar);
  mudarRef.current = mudar;
  const lancarRef = useRef(lancar);
  lancarRef.current = lancar;

  const info = experimentos.find((item) => item.id === exp)!;
  // O lançamento só anima durante o voo; depois da bola cair, um quadro parado basta.
  const animado = !reduced && !em3d && (exp !== "lancamento" || (Boolean(lance) && !lancou));

  const { desenho, leituras, pergunta, controles, destaque } = useMemo(() => {
    if (exp === "plano") {
      const v = valores.plano;
      const r = plano(v);
      return {
        desenho: desenhoPlano(v, reduced),
        destaque: r.desliza ? (["aceleração", `${fmt(r.aceleracao, 2)} m/s²`] as [string, string]) : (["o bloco", "fica parado"] as [string, string]),
        leituras: [
          ["Peso", `${fmt(r.peso)} N`, "P = m·g"],
          ["Componente na rampa", `${fmt(r.px)} N`, "Px = P·sen θ"],
          ["Normal", `${fmt(r.normal)} N`, "N = P·cos θ"],
          ["Atrito", `${fmt(r.atrito)} N`, r.desliza ? "Fat = μ·N" : "estático: segura o bloco"],
          ["Aceleração", `${fmt(r.aceleracao, 2)} m/s²`, "a = (Px − Fat)/m"],
          ["Ângulo em que começa a escorregar", `${fmt(r.anguloCritico)}°`, "tg θ = μ"],
        ] as Array<[string, string, string?]>,
        pergunta: `Estou no laboratório do Minerva com um plano inclinado: ângulo ${fmt(v.anguloGraus, 0)}°, massa ${fmt(v.massa, 0)} kg e coeficiente de atrito ${fmt(v.atrito, 2)}. O bloco ${r.desliza ? `desce com aceleração de ${fmt(r.aceleracao, 2)} m/s²` : "fica parado"}. Me explica por que isso acontece, passo a passo, com as forças envolvidas?`,
        controles: (
          <>
            <Controle rotulo="Ângulo da rampa" valor={v.anguloGraus} unidade="°" min={5} max={60} passo={1} onChange={(n) => mudar("plano", { anguloGraus: n })} />
            <Controle rotulo="Massa do bloco" valor={v.massa} unidade="kg" min={1} max={10} passo={1} onChange={(n) => mudar("plano", { massa: n })} />
            <Controle rotulo="Coeficiente de atrito (μ)" valor={v.atrito} unidade="" min={0} max={1} passo={0.01} onChange={(n) => mudar("plano", { atrito: n })} />
          </>
        ),
      };
    }
    if (exp === "circuito") {
      const v = valores.circuito;
      const r = circuito(v);
      return {
        desenho: desenhoCircuito(v, reduced),
        destaque: ["corrente total", `${fmt(r.corrente, 2)} A`] as [string, string],
        leituras: [
          ["Resistência equivalente", `${fmt(r.req, 2)} Ω`, v.ligacao === "serie" ? "Req = R1 + R2" : "1/Req = 1/R1 + 1/R2"],
          ["Corrente total", `${fmt(r.corrente, 2)} A`, "I = U / Req"],
          ["Em R1", `${fmt(r.i1, 2)} A · ${fmt(r.v1, 1)} V`, "U1 = R1·I1"],
          ["Em R2", `${fmt(r.i2, 2)} A · ${fmt(r.v2, 1)} V`, "U2 = R2·I2"],
          ["Potência total", `${fmt(r.potencia, 1)} W`, "P = U·I"],
        ] as Array<[string, string, string?]>,
        pergunta: `No laboratório do Minerva montei um circuito com bateria de ${fmt(v.tensao, 0)} V e dois resistores (${fmt(v.r1, 0)} Ω e ${fmt(v.r2, 0)} Ω) em ${v.ligacao === "serie" ? "série" : "paralelo"}. A corrente total deu ${fmt(r.corrente, 2)} A. Me explica como calcular isso e o que mudaria na outra ligação?`,
        controles: (
          <>
            <div className="lab-segmento" role="radiogroup" aria-label="Tipo de ligação">
              {(["serie", "paralelo"] as const).map((tipo) => (
                <button key={tipo} type="button" role="radio" aria-checked={v.ligacao === tipo} className={v.ligacao === tipo ? "is-on" : ""} onClick={() => mudar("circuito", { ligacao: tipo })}>
                  {tipo === "serie" ? "Em série" : "Em paralelo"}
                </button>
              ))}
            </div>
            <Controle rotulo="Tensão da bateria" valor={v.tensao} unidade="V" min={1} max={24} passo={1} onChange={(n) => mudar("circuito", { tensao: n })} />
            <Controle rotulo="Resistor R1" valor={v.r1} unidade="Ω" min={1} max={30} passo={1} onChange={(n) => mudar("circuito", { r1: n })} />
            <Controle rotulo="Resistor R2" valor={v.r2} unidade="Ω" min={1} max={30} passo={1} onChange={(n) => mudar("circuito", { r2: n })} />
          </>
        ),
      };
    }
    if (exp === "ph") {
      const v = valores.ph;
      const valor = ph(v.acido, v.base);
      const indicador = corRepolho(valor);
      if (semSolucao(v.acido, v.base)) {
        return {
          desenho: desenhoPh(v.acido, v.base, reduced),
          destaque: ["béquer vazio", "Sem solução"] as [string, string],
          leituras: [
            ["pH", "—", "sem líquido não há pH"],
            ["A solução está", "sem solução", "pingue HCl, NaOH ou os dois"],
            ["Cor do repolho roxo", "—"],
            ["Volume total", "0,0 mL"],
          ] as Array<[string, string, string?]>,
          pergunta: "No laboratório do Minerva vou misturar HCl 0,1 mol/L com NaOH 0,1 mol/L. Me explica o que acontece com o pH conforme eu pingo cada um?",
          controles: (
            <>
              <Controle rotulo="Ácido clorídrico (HCl 0,1 mol/L)" valor={v.acido} unidade="mL" min={0} max={50} passo={0.5} onChange={(n) => mudar("ph", { acido: n })} />
              <Controle rotulo="Hidróxido de sódio (NaOH 0,1 mol/L)" valor={v.base} unidade="mL" min={0} max={50} passo={0.5} onChange={(n) => mudar("ph", { base: n })} />
            </>
          ),
        };
      }
      return {
        desenho: desenhoPh(v.acido, v.base, reduced),
        destaque: [`solução ${classificaPh(valor)}`, `pH ${fmt(valor, 2)}`] as [string, string],
        leituras: [
          ["pH", fmt(valor, 2), "pH = −log [H⁺]"],
          ["A solução está", classificaPh(valor), valor < 7 ? "sobra H⁺ (ácido)" : valor > 7 ? "sobra OH⁻ (base)" : "H⁺ + OH⁻ → H₂O"],
          ["Cor do repolho roxo", indicador.nome],
          ["Volume total", `${fmt(v.acido + v.base, 1)} mL`],
          ["Mols de H⁺ / OH⁻", `${fmt(v.acido * 0.1, 2)} / ${fmt(v.base * 0.1, 2)} mmol`, "n = C·V"],
        ] as Array<[string, string, string?]>,
        pergunta: `No laboratório do Minerva misturei ${fmt(v.acido, 1)} mL de HCl 0,1 mol/L com ${fmt(v.base, 1)} mL de NaOH 0,1 mol/L e o pH deu ${fmt(valor, 2)}. Me explica a reação de neutralização e como chegar nesse pH?`,
        controles: (
          <>
            <Controle rotulo="Ácido clorídrico (HCl 0,1 mol/L)" valor={v.acido} unidade="mL" min={0} max={50} passo={0.5} onChange={(n) => mudar("ph", { acido: n })} />
            <Controle rotulo="Hidróxido de sódio (NaOH 0,1 mol/L)" valor={v.base} unidade="mL" min={0} max={50} passo={0.5} onChange={(n) => mudar("ph", { base: n })} />
          </>
        ),
      };
    }
    const v = valores.lancamento;
    const r = lancamento(v);
    const planeta = gravidades.find((item) => item.id === v.gid)?.nome || "Terra";
    return {
      desenho: desenhoLancamento(v, lance, desafio.id === "lanc-alvo" ? 40 : null, reduced),
      destaque: [lancou ? "a bola caiu a" : "alcance previsto", `${fmt(r.alcance, 1)} m`] as [string, string],
      leituras: [
        ["Alcance", `${fmt(r.alcance)} m`, "A = v²·sen 2θ / g"],
        ["Altura máxima", `${fmt(r.alturaMax)} m`, "H = (v·sen θ)² / 2g"],
        ["Tempo de voo", `${fmt(r.tempoVoo, 2)} s`, "t = 2·v·sen θ / g"],
        ["Velocidade horizontal", `${fmt(r.vx)} m/s`, "vx = v·cos θ (constante)"],
        ["Velocidade vertical inicial", `${fmt(r.vy)} m/s`, "vy = v·sen θ"],
      ] as Array<[string, string, string?]>,
      pergunta: `No laboratório do Minerva lancei uma bola em ${planeta} (g = ${fmt(v.g, 2)} m/s²) com ${fmt(v.velocidade, 0)} m/s a ${fmt(v.anguloGraus, 0)}°. O alcance foi ${fmt(r.alcance)} m e a altura máxima ${fmt(r.alturaMax)} m. Me explica o lançamento oblíquo com esses números?`,
      controles: (
        <>
          <div className="lab-segmento" role="radiogroup" aria-label="Onde lançar">
            {gravidades.map((item) => (
              <button key={item.id} type="button" role="radio" aria-checked={v.gid === item.id} className={v.gid === item.id ? "is-on" : ""} onClick={() => mudar("lancamento", { gid: item.id, g: item.g })}>
                {item.nome}
              </button>
            ))}
          </div>
          <Controle rotulo="Velocidade inicial" valor={v.velocidade} unidade="m/s" min={5} max={40} passo={1} onChange={(n) => mudar("lancamento", { velocidade: n })} />
          <Controle rotulo="Ângulo de lançamento" valor={v.anguloGraus} unidade="°" min={5} max={85} passo={1} onChange={(n) => mudar("lancamento", { anguloGraus: n })} />
          <button type="button" className="lab-btn caderno-btn-pen" onClick={lancar}>
            <Play className="h-4 w-4" /> Lançar
          </button>
        </>
      ),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exp, valores, lance, lancou, reduced, desafio.id]);

  const alvoLancamento = exp === "lancamento" && desafio.id === "lanc-alvo" ? 40 : null;
  const estado3d: EstadoLab = useMemo(() => ({ exp, valores, lance, alvo: alvoLancamento, comemorar }), [exp, valores, lance, alvoLancamento, comemorar]);
  const aoAgir = useCallback((acao: AcaoLab) => {
    if (acao.tipo === "lancar") lancarRef.current();
    else mudarRef.current(acao.tipo, acao.parcial as never);
  }, []);
  const perguntarMine = () =>
    mineConversa(
      pergunta,
      `O estudante esta na aba Laboratorio do Minerva, mexendo na simulacao "${info.nome}" (${info.materia}). Valores e resultados que ele ve na tela agora: ${leituras.map(([nome, valor]) => `${nome}: ${valor}`).join("; ")}. Desafio da vez: ${desafio.texto}${cumprido || jaFeito ? " (ja cumprido)" : " (ainda nao cumprido; de pistas, nao a resposta pronta)"}.`,
      info.nome,
    );
  const perguntarRef = useRef(perguntarMine);
  perguntarRef.current = perguntarMine;
  const aoMine = useCallback(() => perguntarRef.current(), []);

  const totalDesafios = desafios.length;
  const feitosHoje = hoje.length;
  const anel = 2 * Math.PI * 17;

  return (
    <div className="lab-page">
      <PageHeader
        eyebrow="Laboratório · Física e Química"
        title="Laboratório da Mine"
        subtitle="Mexa nas peças da bancada e veja a ciência acontecer. Cada experimento mostra as contas ao vivo, e os desafios valem XP."
      />

      <div ref={escolhaRef} className="lab-escolha" role="tablist" aria-label="Experimentos">
        {experimentos.map((item, indice) => {
          const Icone = item.icone;
          const doExp = desafios.filter((d) => d.exp === item.id);
          const feitosAqui = doExp.filter((d) => hoje.includes(d.id)).length;
          return (
            <motion.button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={exp === item.id}
              className={`lab-exp ${exp === item.id ? "is-on" : ""}`}
              style={{ "--exp-cor": item.cor } as React.CSSProperties}
              onClick={() => trocarExp(item.id)}
              initial={reduced ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={reduced ? undefined : { y: -4 }}
              whileTap={reduced ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 300, damping: 26, delay: reduced ? 0 : 0.05 * indice }}
            >
              {exp === item.id ? <motion.span layoutId="lab-exp-grifo" className="lab-exp-grifo" transition={{ type: "spring", stiffness: 320, damping: 30 }} /> : null}
              <span className="lab-exp-numero" aria-hidden>
                0{indice + 1}
              </span>
              <span className="lab-exp-icone">
                <Icone className="h-5 w-5" />
              </span>
              <span className="relative min-w-0">
                <span className="lab-exp-materia">{item.materia}</span>
                <strong>{item.nome}</strong>
                <span className="lab-exp-resumo">{item.resumo}</span>
                <span className="lab-exp-tubos" aria-label={`${feitosAqui} de ${doExp.length} desafios cumpridos hoje`}>
                  {doExp.map((d) => (
                    <i key={d.id} className={hoje.includes(d.id) ? "is-cheio" : ""} />
                  ))}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="lab-grid">
        <section className="lab-bancada" aria-label={`Bancada: ${info.nome}`}>
          <div className={`lab-palco ${em3d ? "is-3d" : ""}`} style={{ "--exp-cor": info.cor } as React.CSSProperties}>
            {em3d ? (
              <Guarda onFail={() => setFalhou3d(true)}>
                <React.Suspense
                  fallback={
                    <div className="lab3d-carregando" aria-hidden>
                      <span />
                      <span />
                      <span />
                    </div>
                  }
                >
                  <Bancada3D estado={estado3d} onAcao={aoAgir} onMine={aoMine} />
                </React.Suspense>
              </Guarda>
            ) : (
              <Palco desenhar={desenho} animado={animado} rotulo={`Simulação de ${info.nome}`} />
            )}
            <div className="lab-hud" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={exp}
                  className="lab-palco-legenda caderno-note"
                  initial={reduced ? false : { opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.22 }}
                >
                  {info.nome.toLocaleLowerCase("pt-BR")}
                </motion.p>
              </AnimatePresence>
              <div className="lab-visor">
                <span>{destaque[0]}</span>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.strong
                    key={destaque[1]}
                    initial={reduced ? false : { y: -16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 16, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  >
                    {destaque[1]}
                  </motion.strong>
                </AnimatePresence>
              </div>
              {em3d ? (
                <p className="lab-gesto">
                  <Hand className="h-4 w-4" /> {info.gesto}
                </p>
              ) : null}
            </div>
          </div>
          <Leitura key={exp} itens={leituras} reduced={reduced} />
        </section>

        <aside className="lab-lado">
          <div className="lab-card">
            <p className="caderno-note">controles</p>
            <div className="lab-controles">{controles}</div>
            <button
              type="button"
              className="lab-link"
              onClick={() => {
                setValores((atual) => ({ ...atual, [exp]: inicial[exp] }));
                setLance(null);
                setLancou(false);
              }}
            >
              <RotateCcw className="h-4 w-4" /> voltar ao começo
            </button>
          </div>

          <div ref={desafioRef} className={`lab-card lab-desafio ${cumprido || jaFeito ? "is-feito" : ""}`}>
            <div className="lab-card-top">
              <p className="caderno-note">
                <Target className="inline h-4 w-4" /> desafio
              </p>
              <div className="lab-desafio-troca">
                {desafiosDaVez.map((item, i) => (
                  <button key={item.id} type="button" aria-pressed={item.id === desafio.id} className={item.id === desafio.id ? "is-on" : ""} onClick={() => setDesafioId(item.id)}>
                    {hoje.includes(item.id) ? "✓" : i + 1}
                  </button>
                ))}
              </div>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={desafio.id}
                className="lab-desafio-texto"
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {desafio.texto}
              </motion.p>
            </AnimatePresence>
            {cumprido || jaFeito ? (
              <motion.p className="lab-desafio-ok" initial={reduced ? false : { scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }}>
                <CheckCircle2 className="h-4 w-4" /> {jaFeito && !cumprido ? "Você já cumpriu este hoje." : `Cumprido! +${labXp()} XP`}
              </motion.p>
            ) : (
              <details className="lab-dica">
                <summary>preciso de uma dica</summary>
                <p>{desafio.dica}</p>
              </details>
            )}
            <div className="lab-desafio-cota">
              <svg viewBox="0 0 40 40" className="lab-anel" aria-hidden>
                <circle cx="20" cy="20" r="17" />
                <motion.circle
                  cx="20"
                  cy="20"
                  r="17"
                  className="is-cheio"
                  strokeDasharray={anel}
                  initial={false}
                  animate={{ strokeDashoffset: anel * (1 - Math.min(1, feitosHoje / totalDesafios)) }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </svg>
              <span>
                <strong>
                  {feitosHoje}/{totalDesafios}
                </strong>{" "}
                desafios hoje · {Math.min(feitosHoje, labPorDia)}/{labPorDia} com XP
              </span>
            </div>
          </div>

          <button type="button" className="lab-mine" onClick={perguntarMine}>
            <Bot className="h-5 w-5" />
            <span>
              <strong>Perguntar à Mine</strong>
              <span>Ela explica o que está acontecendo com os seus números.</span>
            </span>
          </button>
          <p className="lab-rodape">
            <FlaskConical className="inline h-4 w-4" /> Modelos simplificados para estudo: sem resistência do ar, fios ideais e soluções a 25 °C.
          </p>
        </aside>
      </div>
    </div>
  );
}
