// Motor do Cubo Mágico (aba #/cubo). Regras puras, sem DOM nem three.js:
// a cena 3D, o cronômetro e os testes leem daqui.
//
// Coordenadas "dobradas": num cubo N×N cada peça fica em x, y, z ∈
// {-(N-1), …, N-1} de 2 em 2. Assim 2×2 e 4×4 (que não têm camada no zero)
// usam a mesma conta do 3×3. Um giro é { eixo, camada, q }: q quartos de
// volta em torno do eixo positivo pela regra da mão direita; camada "todas"
// gira o cubo inteiro.

export const corNomes = ["branco", "amarelo", "verde", "azul", "vermelho", "laranja"];
/** Cores clássicas, na ordem de corNomes. */
export const coresHex = ["#F4F5F0", "#FFD23F", "#16A34A", "#1D4ED8", "#DC2626", "#F97316"];

/** Face → normal externa. Branco em cima, verde na frente (padrão WCA). */
const faces = {
  U: { eixo: "y", sinal: 1, cor: 0 },
  D: { eixo: "y", sinal: -1, cor: 1 },
  F: { eixo: "z", sinal: 1, cor: 2 },
  B: { eixo: "z", sinal: -1, cor: 3 },
  R: { eixo: "x", sinal: 1, cor: 4 },
  L: { eixo: "x", sinal: -1, cor: 5 },
};
export const ordemFaces = ["U", "D", "F", "B", "R", "L"];
const idx = { x: 0, y: 1, z: 2 };

/** Gira um vetor inteiro q quartos de volta em torno do eixo positivo. */
export function girarVetor(v, eixo, q) {
  let [x, y, z] = v;
  const voltas = ((q % 4) + 4) % 4;
  for (let i = 0; i < voltas; i += 1) {
    if (eixo === "x") [y, z] = [-z, y];
    else if (eixo === "y") [x, z] = [z, -x];
    else [x, y] = [-y, x];
  }
  return [x + 0, y + 0, z + 0];
}

function normalDaFace(face) {
  const f = faces[face];
  const n = [0, 0, 0];
  n[idx[f.eixo]] = f.sinal;
  return n;
}

/** Cubo resolvido. Cada peça guarda posição, base (orientação) e adesivos. */
export function criarCubo(n = 3) {
  const max = n - 1;
  const pecas = [];
  for (let x = -max; x <= max; x += 2)
    for (let y = -max; y <= max; y += 2)
      for (let z = -max; z <= max; z += 2) {
        const pos = [x, y, z];
        if (![x, y, z].some((c) => Math.abs(c) === max)) continue; // miolo não aparece
        const adesivos = [];
        for (const face of ordemFaces) {
          const f = faces[face];
          if (pos[idx[f.eixo]] === f.sinal * max) adesivos.push({ n: normalDaFace(face), cor: f.cor, local: normalDaFace(face) });
        }
        pecas.push({ id: pecas.length, pos, base: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], adesivos });
      }
  return { n, pecas };
}

export function clonarCubo(cubo) {
  return {
    n: cubo.n,
    pecas: cubo.pecas.map((p) => ({
      id: p.id,
      pos: [...p.pos],
      base: p.base.map((v) => [...v]),
      adesivos: p.adesivos.map((a) => ({ n: [...a.n], cor: a.cor, local: a.local })),
    })),
  };
}

/** A peça entra no giro? */
export function pecaNoGiro(peca, giro) {
  return giro.camada === "todas" || peca.pos[idx[giro.eixo]] === giro.camada;
}

/** Aplica um giro (muda o cubo no lugar e devolve ele). */
export function aplicarGiro(cubo, giro) {
  for (const peca of cubo.pecas) {
    if (!pecaNoGiro(peca, giro)) continue;
    peca.pos = girarVetor(peca.pos, giro.eixo, giro.q);
    peca.base = peca.base.map((v) => girarVetor(v, giro.eixo, giro.q));
    for (const a of peca.adesivos) a.n = girarVetor(a.n, giro.eixo, giro.q);
  }
  return cubo;
}

export function aplicarGiros(cubo, giros) {
  for (const g of giros) aplicarGiro(cubo, g);
  return cubo;
}

/** Resolvido = em cada direção todos os adesivos têm a mesma cor (vale com o cubo virado). */
export function estaResolvido(cubo) {
  const porDirecao = new Map();
  for (const peca of cubo.pecas)
    for (const a of peca.adesivos) {
      const chave = a.n.join(",");
      const cor = porDirecao.get(chave);
      if (cor === undefined) porDirecao.set(chave, a.cor);
      else if (cor !== a.cor) return false;
    }
  return true;
}

export function inverso(giro) {
  return { ...giro, q: -giro.q };
}

/** Normaliza q para -1, 1 ou 2. */
function qNormal(q) {
  const r = ((q % 4) + 4) % 4;
  return r === 3 ? -1 : r;
}

/** Junta giros seguidos na mesma camada e tira os que se anulam. */
export function simplificar(giros) {
  const saida = [];
  for (const g of giros) {
    const ultimo = saida[saida.length - 1];
    if (ultimo && ultimo.eixo === g.eixo && ultimo.camada === g.camada) {
      const q = qNormal(ultimo.q + g.q);
      if (q === 0) saida.pop();
      else saida[saida.length - 1] = { ...ultimo, q };
    } else saida.push({ ...g, q: qNormal(g.q) });
  }
  return saida;
}

/** Sequência que desfaz tudo o que foi feito desde o cubo resolvido. */
export function caminhoDeVolta(historico) {
  return simplificar([...historico].reverse().map(inverso));
}

/** Giro de face pela letra ("R", "U'", "F2"; "x", "y", "z" giram o cubo). */
export function giroDaNotacao(texto, n = 3) {
  const m = /^(\d?)([UDFBRLxyz])(w?)('|2|2')?$/.exec(texto.trim());
  if (!m) return null;
  const [, prof, letra, , mod] = m;
  const vezes = mod === "2" || mod === "2'" ? 2 : 1;
  const linha = mod === "'" ? -1 : 1;
  if ("xyz".includes(letra)) {
    // x segue R, y segue U, z segue F
    return { eixo: letra, camada: "todas", q: vezes === 2 ? 2 : -linha };
  }
  const f = faces[letra];
  const max = n - 1;
  const p = prof ? Math.max(1, Math.min(Math.floor(n / 2), Number(prof))) : 1;
  const camada = f.sinal * (max - (p - 1) * 2);
  // horário olhando de fora da face = -90° em torno da normal externa
  return { eixo: f.eixo, camada, q: vezes === 2 ? 2 : -f.sinal * linha };
}

/** Texto do giro na notação usual ("R'", "U2", "2R" no 4×4, "y"). */
export function notacao(giro, n = 3) {
  const q = qNormal(giro.q);
  if (giro.camada === "todas") {
    const sufixo = q === 2 ? "2" : q === -1 ? "" : "'";
    return `${giro.eixo}${sufixo}`;
  }
  const max = n - 1;
  const sinal = giro.camada > 0 ? 1 : giro.camada < 0 ? -1 : 0;
  if (sinal === 0) {
    // camada do meio do 3×3: M segue L, E segue D, S segue F
    const letra = giro.eixo === "x" ? "M" : giro.eixo === "y" ? "E" : "S";
    const horario = giro.eixo === "z" ? -1 : 1; // M e E seguem faces negativas
    const sufixo = q === 2 ? "2" : q === horario ? "" : "'";
    return `${letra}${sufixo}`;
  }
  const face = ordemFaces.find((f) => faces[f].eixo === giro.eixo && faces[f].sinal === sinal);
  const prof = (max - Math.abs(giro.camada)) / 2 + 1;
  const horario = -sinal;
  const sufixo = q === 2 ? "2" : q === horario ? "" : "'";
  return `${prof > 1 ? prof : ""}${face}${sufixo}`;
}

export function textoDosGiros(giros, n = 3) {
  return giros.map((g) => notacao(g, n)).join(" ");
}

export const tamanhoDoEmbaralhamento = { 2: 11, 3: 20, 4: 40 };

/**
 * Embaralhamento por giros aleatórios: nunca o mesmo eixo duas vezes seguidas
 * (evita "R R'" e "R L R"). `aleatorio` entra para os testes serem fixos.
 */
export function gerarEmbaralhamento(n = 3, aleatorio = Math.random, tamanho = tamanhoDoEmbaralhamento[n] || 25) {
  const max = n - 1;
  const camadas = [];
  for (let c = -max; c <= max; c += 2) if (Math.abs(c) >= max - 2 * (Math.floor(n / 2) - 1)) camadas.push(c);
  // no 2×2 e no 3×3 só faces; no 4×4 também as camadas de dentro
  const usaveis = n >= 4 ? camadas.filter((c) => c !== 0) : [-max, max];
  const eixos = ["x", "y", "z"];
  const giros = [];
  let eixoAnterior = "";
  while (giros.length < tamanho) {
    const eixo = eixos[Math.floor(aleatorio() * 3)];
    if (eixo === eixoAnterior) continue;
    const camada = usaveis[Math.floor(aleatorio() * usaveis.length)];
    const q = [1, -1, 2][Math.floor(aleatorio() * 3)];
    giros.push({ eixo, camada, q });
    eixoAnterior = eixo;
  }
  return giros;
}

/**
 * Planificação do cubo (para o modo "cubo de verdade" e acessibilidade):
 * { U: cor[][], D, F, B, R, L } com linhas de cima para baixo, como se cada
 * face fosse vista de frente na cruz U / L F R B / D.
 */
export function planificar(cubo) {
  const n = cubo.n;
  const max = n - 1;
  const grade = () => Array.from({ length: n }, () => Array(n).fill(-1));
  const saida = { U: grade(), D: grade(), F: grade(), B: grade(), R: grade(), L: grade() };
  const c = (v) => (v + max) / 2;
  for (const peca of cubo.pecas)
    for (const a of peca.adesivos) {
      const [x, y, z] = peca.pos;
      const [nx, ny, nz] = a.n;
      let face, col, lin;
      if (ny === 1) { face = "U"; col = c(x); lin = c(z); }
      else if (ny === -1) { face = "D"; col = c(x); lin = c(-z); }
      else if (nz === 1) { face = "F"; col = c(x); lin = c(-y); }
      else if (nz === -1) { face = "B"; col = c(-x); lin = c(-y); }
      else if (nx === 1) { face = "R"; col = c(-z); lin = c(-y); }
      else { face = "L"; col = c(z); lin = c(-y); }
      saida[face][lin][col] = a.cor;
    }
  return saida;
}

/* ---------- cronômetro e recordes ---------- */

/** "1:02.34" / "12.34". */
export function formatarTempo(ms) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const total = Math.max(0, Math.floor(ms / 10));
  const cent = total % 100;
  const seg = Math.floor(total / 100) % 60;
  const min = Math.floor(total / 6000);
  const cc = String(cent).padStart(2, "0");
  return min > 0 ? `${min}:${String(seg).padStart(2, "0")}.${cc}` : `${seg}.${cc}`;
}

/**
 * Média de N no estilo WCA: das últimas N, tira a melhor e a pior e faz a
 * média das outras. DNF conta como pior; dois DNF = média DNF (Infinity).
 */
export function mediaDe(tempos, quantos) {
  if (tempos.length < quantos) return null;
  const ultimos = tempos.slice(-quantos).map((t) => (t == null ? Infinity : t)).sort((a, b) => a - b);
  const corte = quantos >= 5 ? Math.max(1, Math.round(quantos * 0.05)) : 0;
  const meio = ultimos.slice(corte, ultimos.length - corte);
  if (meio.some((t) => t === Infinity)) return Infinity;
  return meio.reduce((s, t) => s + t, 0) / meio.length;
}

/** Resumo dos tempos de um tamanho (lista em ordem de quando foram feitos). */
export function resumoTempos(solves) {
  const tempos = solves.map((s) => (s.dnf ? null : s.ms + (s.mais2 ? 2000 : 0)));
  const validos = tempos.filter((t) => t != null);
  return {
    total: solves.length,
    melhor: validos.length ? Math.min(...validos) : null,
    media: validos.length ? validos.reduce((s, t) => s + t, 0) / validos.length : null,
    ao5: mediaDe(tempos, 5),
    ao12: mediaDe(tempos, 12),
  };
}

/* ---------- em que passo do método de camadas o cubo está (3×3) ---------- */

export const etapasDoMetodo = [
  "cruz branca",
  "cantos brancos",
  "segunda camada",
  "cruz amarela",
  "arestas amarelas no lugar",
  "cantos amarelos no lugar",
  "virar os cantos amarelos",
  "montado",
];

/**
 * Olha o cubo como um professor olharia: qual é o próximo passo do método de
 * camadas (índice em etapasDoMetodo) e quanto do passo atual já está feito.
 * Vale com o cubo em qualquer orientação, porque compara com os centros.
 */
export function etapaDoMetodo(cubo) {
  if (cubo.n !== 3) return null;
  const branco = 0;
  const amarelo = 1;
  const centroDe = new Map(); // cor → normal do centro
  for (const p of cubo.pecas) if (p.adesivos.length === 1) centroDe.set(p.adesivos[0].cor, p.adesivos[0].n.join(","));
  const corDaDirecao = new Map([...centroDe].map(([cor, n]) => [n, cor]));
  const certa = (p) => p.adesivos.every((a) => centroDe.get(a.cor) === a.n.join(","));
  const tem = (p, cor) => p.adesivos.some((a) => a.cor === cor);
  const arestas = cubo.pecas.filter((p) => p.adesivos.length === 2);
  const cantos = cubo.pecas.filter((p) => p.adesivos.length === 3);
  // canto na casa certa (cores batem com os centros em volta), virado ou não
  const casaCerta = (p) => {
    const dirs = [0, 1, 2].filter((i) => p.pos[i] !== 0).map((i) => {
      const n = [0, 0, 0];
      n[i] = Math.sign(p.pos[i]);
      return corDaDirecao.get(n.join(","));
    });
    return dirs.every((cor) => tem(p, cor));
  };
  const amareloPraCima = (p) => p.adesivos.some((a) => a.cor === amarelo && a.n.join(",") === centroDe.get(amarelo));

  const passos = [
    arestas.filter((p) => tem(p, branco)),
    cantos.filter((p) => tem(p, branco)),
    arestas.filter((p) => !tem(p, branco) && !tem(p, amarelo)),
  ];
  for (let i = 0; i < passos.length; i += 1) {
    const feitas = passos[i].filter(certa).length;
    if (feitas < passos[i].length) return { indice: i, nome: etapasDoMetodo[i], feitas, total: passos[i].length };
  }
  const arestasAmarelas = arestas.filter((p) => tem(p, amarelo));
  const cantosAmarelos = cantos.filter((p) => tem(p, amarelo));
  const checagens = [
    arestasAmarelas.filter(amareloPraCima).length,
    arestasAmarelas.filter(certa).length,
    cantosAmarelos.filter(casaCerta).length,
    cantosAmarelos.filter(certa).length,
  ];
  for (let i = 0; i < checagens.length; i += 1) {
    if (checagens[i] < 4) return { indice: 3 + i, nome: etapasDoMetodo[3 + i], feitas: checagens[i], total: 4 };
  }
  return { indice: 7, nome: "montado", feitas: 1, total: 1 };
}
