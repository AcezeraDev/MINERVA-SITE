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

export const tiposDeCubo = [
  { id: "2x2", nome: "Pocket 2×2", curto: "2×2", categoria: "classicos", dims: [2, 2, 2], pecas: 8, descricao: "Rápido e ágil para aquecer os dedos.", corA: "#38bdf8", corB: "#2fd483", dificuldade: 1 },
  { id: "3x3", nome: "Clássico 3×3", curto: "3×3", categoria: "classicos", dims: [3, 3, 3], pecas: 26, descricao: "O cubo clássico de Rubik, com Aula da Mine.", corA: "#8e9eff", corB: "#2fd483", dificuldade: 2 },
  { id: "4x4", nome: "Revenge 4×4", curto: "4×4", categoria: "classicos", dims: [4, 4, 4], pecas: 56, descricao: "Com camadas internas (Alt + tecla).", corA: "#818cf8", corB: "#c084fc", dificuldade: 3 },
  { id: "5x5", nome: "Professor 5×5", curto: "5×5", categoria: "classicos", dims: [5, 5, 5], pecas: 98, descricao: "Gigante de 5 camadas e 98 peças.", corA: "#f59e0b", corB: "#fb7185", dificuldade: 4 },
  { id: "mirror", nome: "Mirror Cube", curto: "Mirror", categoria: "especiais", dims: [3, 3, 3], pecas: 26, descricao: "Espelhado que muda de forma ao girar!", corA: "#e2e8f0", corB: "#94a3b8", dificuldade: 3 },
  { id: "void", nome: "Void Cube", curto: "Void", categoria: "especiais", dims: [3, 3, 3], pecas: 20, descricao: "Sem centros, com túnel vazado nos 3 eixos.", corA: "#22d3ee", corB: "#34d399", dificuldade: 3 },
  { id: "2x2x3", nome: "Torre 2×2×3", curto: "2×2×3", categoria: "cuboides", dims: [2, 3, 2], pecas: 12, descricao: "Torre vertical: 90° no topo, 180° nos lados.", corA: "#fb7185", corB: "#fbbf24", dificuldade: 2 },
  { id: "3x3x2", nome: "Dominó 3×3×2", curto: "3×3×2", categoria: "cuboides", dims: [3, 2, 3], pecas: 18, descricao: "Clássico cubo dominó de duas camadas.", corA: "#10b981", corB: "#38bdf8", dificuldade: 2 },
  { id: "pyraminx", nome: "Pyraminx", curto: "Pyraminx", categoria: "poliedros", dims: [3, 3, 3], pecas: 14, descricao: "Pirâmide tetraédrica com giros de 120°.", corA: "#fbbf24", corB: "#f472b6", dificuldade: 2 },
];

export function infoTipoCubo(tipo) {
  return tiposDeCubo.find((t) => t.id === tipo) ?? tiposDeCubo[1];
}

export function dimsDoCubo(cubo) {
  return cubo.dims ?? [cubo.n, cubo.n, cubo.n];
}

/**
 * Quantos quartos de volta são necessários em torno de `eixo` para manter o
 * formato do cuboide: 1 (90°) se as outras duas dimensões são iguais; 2 (180°) se diferem.
 */
export function passoDoEixo(cubo, eixo) {
  const [nx, ny, nz] = dimsDoCubo(cubo);
  if (eixo === "x") return ny === nz ? 1 : 2;
  if (eixo === "y") return nx === nz ? 1 : 2;
  return nx === ny ? 1 : 2;
}

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
export function criarCubo(n = 3, opcoes = {}) {
  const dims = opcoes.dims ?? [n, n, n];
  const [nx, ny, nz] = dims;
  const maxX = nx - 1;
  const maxY = ny - 1;
  const maxZ = nz - 1;
  const maxEixo = { x: maxX, y: maxY, z: maxZ };
  const tipo = opcoes.tipo ?? (nx === ny && ny === nz ? `${n}x${n}` : `${nx}x${ny}x${nz}`);
  const semCentros = tipo === "void";
  const pecas = [];
  for (let x = -maxX; x <= maxX; x += 2)
    for (let y = -maxY; y <= maxY; y += 2)
      for (let z = -maxZ; z <= maxZ; z += 2) {
        const pos = [x, y, z];
        if (Math.abs(x) !== maxX && Math.abs(y) !== maxY && Math.abs(z) !== maxZ) continue; // miolo não aparece
        const adesivos = [];
        for (const face of ordemFaces) {
          const f = faces[face];
          if (pos[idx[f.eixo]] === f.sinal * maxEixo[f.eixo]) adesivos.push({ n: normalDaFace(face), cor: f.cor, local: normalDaFace(face) });
        }
        if (semCentros && adesivos.length === 1) continue; // Void Cube: sem os 6 centros
        pecas.push({ id: pecas.length, pos, posInicial: [...pos], base: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], adesivos });
      }
  return { n: Math.max(nx, ny, nz), dims: [nx, ny, nz], tipo, pecas };
}

export function criarCuboTipo(tipo = "3x3") {
  const info = infoTipoCubo(tipo);
  return criarCubo(Math.max(...info.dims), { dims: info.dims, tipo: info.id });
}

export function clonarCubo(cubo) {
  return {
    n: cubo.n,
    dims: cubo.dims ? [...cubo.dims] : [cubo.n, cubo.n, cubo.n],
    tipo: cubo.tipo ?? `${cubo.n}x${cubo.n}`,
    pecas: cubo.pecas.map((p) => ({
      id: p.id,
      pos: [...p.pos],
      posInicial: p.posInicial ? [...p.posInicial] : [...p.pos],
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

export const tamanhoDoEmbaralhamento = { 2: 11, 3: 20, 4: 40, 5: 60 };

/**
 * Embaralhamento por giros aleatórios: nunca o mesmo eixo duas vezes seguidas
 * (evita "R R'" e "R L R"). `aleatorio` entra para os testes serem fixos.
 */
export function gerarEmbaralhamento(n = 3, aleatorio = Math.random, tamanho = tamanhoDoEmbaralhamento[n] || 25) {
  const max = n - 1;
  const camadas = [];
  for (let c = -max; c <= max; c += 2) if (Math.abs(c) >= max - 2 * (Math.floor(n / 2) - 1)) camadas.push(c);
  // no 2×2 e no 3×3 só faces; no 4×4 e 5×5 também as camadas de dentro
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

export function gerarEmbaralhamentoTipo(tipo = "3x3", aleatorio = Math.random) {
  const info = infoTipoCubo(tipo);
  const [nx, ny, nz] = info.dims;
  if (nx === ny && ny === nz) {
    return gerarEmbaralhamento(nx, aleatorio, tamanhoDoEmbaralhamento[nx] || 20);
  }
  // Cuboides: eixos assimétricos giram só 180° (q = 2)
  const cuboRef = criarCuboTipo(tipo);
  const tamanho = 18;
  const maxPorEixo = { x: nx - 1, y: ny - 1, z: nz - 1 };
  const eixos = ["x", "y", "z"];
  const giros = [];
  let eixoAnterior = "";
  while (giros.length < tamanho) {
    const eixo = eixos[Math.floor(aleatorio() * 3)];
    if (eixo === eixoAnterior) continue;
    const max = maxPorEixo[eixo];
    const camadas = max === 0 ? [0] : [-max, max];
    const camada = camadas[Math.floor(aleatorio() * camadas.length)];
    const passo = passoDoEixo(cuboRef, eixo);
    const q = passo === 2 ? 2 : [1, -1, 2][Math.floor(aleatorio() * 3)];
    giros.push({ eixo, camada, q });
    eixoAnterior = eixo;
  }
  return giros;
}

export function notacaoTipo(giro, tipo = "3x3") {
  const info = infoTipoCubo(tipo);
  const [nx, ny, nz] = info.dims;
  if (nx === ny && ny === nz) return notacao(giro, nx);
  const nEixo = giro.eixo === "x" ? nx : giro.eixo === "y" ? ny : nz;
  return notacao(giro, nEixo);
}

export function textoDosGirosTipo(giros, tipo = "3x3") {
  return giros.map((g) => notacaoTipo(g, tipo)).join(" ");
}

/**
 * Planificação do cubo (para o modo "cubo de verdade" e acessibilidade):
 * { U: cor[][], D, F, B, R, L } com linhas de cima para baixo, como se cada
 * face fosse vista de frente na cruz U / L F R B / D.
 */
export function planificar(cubo) {
  const [nx, ny, nz] = dimsDoCubo(cubo);
  const maxX = nx - 1;
  const maxY = ny - 1;
  const maxZ = nz - 1;
  const grade = (linhas, cols) => Array.from({ length: linhas }, () => Array(cols).fill(-1));
  const saida = {
    U: grade(nz, nx),
    D: grade(nz, nx),
    F: grade(ny, nx),
    B: grade(ny, nx),
    R: grade(ny, nz),
    L: grade(ny, nz),
  };
  const cx = (v) => (v + maxX) / 2;
  const cy = (v) => (v + maxY) / 2;
  const cz = (v) => (v + maxZ) / 2;
  for (const peca of cubo.pecas)
    for (const a of peca.adesivos) {
      const [x, y, z] = peca.pos;
      const [nxv, nyv, nzv] = a.n;
      let face, col, lin;
      if (nyv === 1) { face = "U"; col = cx(x); lin = cz(z); }
      else if (nyv === -1) { face = "D"; col = cx(x); lin = cz(-z); }
      else if (nzv === 1) { face = "F"; col = cx(x); lin = cy(-y); }
      else if (nzv === -1) { face = "B"; col = cx(-x); lin = cy(-y); }
      else if (nxv === 1) { face = "R"; col = cz(-z); lin = cy(-y); }
      else { face = "L"; col = cz(z); lin = cy(-y); }
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

  const arestasAmarelas = arestas.filter((p) => tem(p, amarelo));
  const cantosAmarelos = cantos.filter((p) => tem(p, amarelo));
  // cada etapa: as peças dela e o que é "estar pronta" naquela etapa
  const etapas = [
    [arestas.filter((p) => tem(p, branco)), certa],
    [cantos.filter((p) => tem(p, branco)), certa],
    [arestas.filter((p) => !tem(p, branco) && !tem(p, amarelo)), certa],
    [arestasAmarelas, amareloPraCima],
    [arestasAmarelas, certa],
    [cantosAmarelos, casaCerta],
    [cantosAmarelos, certa],
  ];
  const direcao = (i, sinal) => {
    const n = [0, 0, 0];
    n[i] = sinal;
    return n;
  };
  // onde a peça está e para onde vai, em normais (a tela traduz para "de cima", "da frente"…)
  const descrever = (p) => ({
    id: p.id,
    cores: p.adesivos.map((a) => a.cor),
    // faces do cubo que a peça toca agora
    onde: [0, 1, 2].filter((i) => p.pos[i] !== 0).map((i) => direcao(i, Math.sign(p.pos[i]))),
    // cada cor da peça e para qual lado ela está virada
    viradas: p.adesivos.map((a) => ({ cor: a.cor, n: [...a.n] })),
    // as faces do lugar certo: as dos centros com as cores da peça
    destino: p.adesivos.map((a) => centroDe.get(a.cor).split(",").map(Number)),
  });
  for (let i = 0; i < etapas.length; i += 1) {
    const [pecas, pronta] = etapas[i];
    const faltam = pecas.filter((p) => !pronta(p));
    if (faltam.length) return { indice: i, nome: etapasDoMetodo[i], feitas: pecas.length - faltam.length, total: pecas.length, pendentes: faltam.map(descrever) };
  }
  return { indice: 7, nome: "montado", feitas: 1, total: 1, pendentes: [] };
}
