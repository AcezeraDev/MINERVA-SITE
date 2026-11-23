// Motor puro do Pyraminx (tetraedro 3D com giros de 120°), sem DOM nem three.js.
//
// Orientação padrão WCA:
// - Vértice 0 (U): topo       (0, 1, 0)
// - Vértice 1 (B): trás       (0, -1/3, -2√2/3)
// - Vértice 2 (R): frente-dir (+√6/3, -1/3, +√2/3)
// - Vértice 3 (L): frente-esq (-√6/3, -1/3, +√2/3)
//
// Face f é a face oposta ao vértice f (normal externa = -Vf).
// Cada peça guarda sua permutação par `perm` de [0,1,2,3] (grupo A4 ⊂ SO(3))
// e seus adesivos (direção da face atual `face` ∈ 0..3 e `cor` ∈ 0..3).
// Assim, giros de 120° são permutações exatas de inteiros: zero erro numérico.

const S2 = Math.SQRT2;
const S6 = Math.sqrt(6);

export const pyraminxVertices = [
  [0, 1, 0], // 0: U
  [0, -1 / 3, (-2 * S2) / 3], // 1: B
  [S6 / 3, -1 / 3, S2 / 3], // 2: R
  [-S6 / 3, -1 / 3, S2 / 3], // 3: L
];

export const pyraminxEixos = ["U", "B", "R", "L"];
export const pyraminxCoresHex = ["#FFD23F", "#16A34A", "#1D4ED8", "#DC2626"]; // D(amarelo), F(verde), L(azul), R(vermelho)
export const pyraminxCorNomes = ["amarelo", "verde", "azul", "vermelho"];

/**
 * Ciclos horários (olhando de fora do vértice k, ou seja, -120° pela regra da mão direita em torno de Vk):
 * a -> b -> c -> a.
 */
const ciclosHorarios = [
  [1, 2, 3], // U: B -> R -> L -> B
  [0, 3, 2], // B: U -> L -> R -> U
  [0, 1, 3], // R: U -> B -> L -> U
  [0, 2, 1], // L: U -> R -> B -> U
];

/** Mapeia um índice de vértice/face sob um giro de `q` terços de volta (-1 = anti-horário, 1 = horário) em torno do vértice `eixo`. */
export function mapearIndice(i, eixo, q) {
  const passos = ((q % 3) + 3) % 3;
  if (passos === 0 || i === eixo) return i;
  const ciclo = ciclosHorarios[eixo];
  const pos = ciclo.indexOf(i);
  if (pos === -1) return i;
  return ciclo[(pos + passos) % 3];
}

/**
 * Cria um Pyraminx resolvido com 14 peças:
 * - 4 pontas (tips): id 0..3 (tetraedros nos vértices)
 * - 4 centros axiais: id 4..7 (octaedros logo abaixo de cada ponta)
 * - 6 arestas (edges): id 8..13 (tetraedros entre pares de vértices)
 */
export function criarPyraminx() {
  const pecas = [];

  // 4 Pontas (tips)
  for (let k = 0; k < 4; k += 1) {
    const adesivos = [];
    for (let f = 0; f < 4; f += 1) {
      if (f !== k) adesivos.push({ face: f, cor: f, localFace: f });
    }
    pecas.push({
      id: pecas.length,
      tipo: "tip",
      slot: [k],
      slotInicial: [k],
      perm: [0, 1, 2, 3],
      adesivos,
    });
  }

  // 4 Centros axiais
  for (let k = 0; k < 4; k += 1) {
    const adesivos = [];
    for (let f = 0; f < 4; f += 1) {
      if (f !== k) adesivos.push({ face: f, cor: f, localFace: f });
    }
    pecas.push({
      id: pecas.length,
      tipo: "center",
      slot: [k],
      slotInicial: [k],
      perm: [0, 1, 2, 3],
      adesivos,
    });
  }

  // 6 Arestas (edges)
  for (let i = 0; i < 4; i += 1) {
    for (let j = i + 1; j < 4; j += 1) {
      const adesivos = [];
      for (let f = 0; f < 4; f += 1) {
        if (f !== i && f !== j) adesivos.push({ face: f, cor: f, localFace: f });
      }
      pecas.push({
        id: pecas.length,
        tipo: "edge",
        slot: [i, j],
        slotInicial: [i, j],
        perm: [0, 1, 2, 3],
        adesivos,
      });
    }
  }

  return { pecas };
}

export function clonarPyraminx(p) {
  return {
    pecas: p.pecas.map((peca) => ({
      ...peca,
      slot: [...peca.slot],
      slotInicial: [...peca.slotInicial],
      perm: [...peca.perm],
      adesivos: peca.adesivos.map((a) => ({ ...a })),
    })),
  };
}

/**
 * Uma peça entra no giro `{ eixo: 0|1|2|3, camada: 1|2, q: 1|-1 }`?
 * - camada 1: só a ponta (tip) do vértice `eixo` (notação minúscula: u, r, l, b)
 * - camada 2: ponta + centro axial + 3 arestas ligadas ao vértice `eixo` (notação maiúscula: U, R, L, B)
 */
export function pecaNoGiroPyraminx(peca, giro) {
  if (giro.camada === 1) return peca.tipo === "tip" && peca.slot[0] === giro.eixo;
  return peca.slot.includes(giro.eixo);
}

/** Aplica um giro de 120° no lugar e devolve o Pyraminx. */
export function aplicarGiroPyraminx(p, giro) {
  for (const peca of p.pecas) {
    if (!pecaNoGiroPyraminx(peca, giro)) continue;
    peca.slot = peca.slot.map((s) => mapearIndice(s, giro.eixo, giro.q)).sort((a, b) => a - b);
    peca.perm = peca.perm.map((v) => mapearIndice(v, giro.eixo, giro.q));
    for (const a of peca.adesivos) {
      a.face = mapearIndice(a.face, giro.eixo, giro.q);
    }
  }
  return p;
}

export function aplicarGirosPyraminx(p, giros) {
  for (const g of giros) aplicarGiroPyraminx(p, g);
  return p;
}

/** Resolvido = em cada uma das 4 faces todos os 9 triângulos têm a mesma cor. */
export function estaResolvidoPyraminx(p) {
  const corDaFace = new Map();
  for (const peca of p.pecas) {
    for (const a of peca.adesivos) {
      const atual = corDaFace.get(a.face);
      if (atual === undefined) corDaFace.set(a.face, a.cor);
      else if (atual !== a.cor) return false;
    }
  }
  return true;
}

export function inversoPyraminx(giro) {
  return { ...giro, q: giro.q === 1 ? -1 : 1 };
}

function qNormal3(q) {
  const r = ((q % 3) + 3) % 3;
  return r === 2 ? -1 : r;
}

export function simplificarPyraminx(giros) {
  const saida = [];
  for (const g of giros) {
    const ultimo = saida[saida.length - 1];
    if (ultimo && ultimo.eixo === g.eixo && ultimo.camada === g.camada) {
      const q = qNormal3(ultimo.q + g.q);
      if (q === 0) saida.pop();
      else saida[saida.length - 1] = { ...ultimo, q };
    } else {
      const q = qNormal3(g.q);
      if (q !== 0) saida.push({ ...g, q });
    }
  }
  return saida;
}

export function caminhoDeVoltaPyraminx(historico) {
  return simplificarPyraminx([...historico].reverse().map(inversoPyraminx));
}

/** Notação WCA do Pyraminx: U, R', L, B' (camada 2) e u, r', l, b' (pontas). */
export function notacaoPyraminx(giro) {
  const letra = pyraminxEixos[giro.eixo];
  const base = giro.camada === 1 ? letra.toLowerCase() : letra;
  return giro.q === -1 ? `${base}'` : base;
}

export function textoDosGirosPyraminx(giros) {
  return giros.map(notacaoPyraminx).join(" ");
}

/** Embaralhamento no padrão WCA: 11 giros principais + pontas aleatórias. */
export function gerarEmbaralhamentoPyraminx(aleatorio = Math.random, tamanho = 11) {
  const giros = [];
  let anterior = -1;
  while (giros.length < tamanho) {
    const eixo = Math.floor(aleatorio() * 4);
    if (eixo === anterior) continue;
    const q = aleatorio() < 0.5 ? 1 : -1;
    giros.push({ eixo, camada: 2, q });
    anterior = eixo;
  }
  // Pontas opcionais (padrão WCA)
  for (let k = 0; k < 4; k += 1) {
    const r = aleatorio();
    if (r < 0.33) giros.push({ eixo: k, camada: 1, q: 1 });
    else if (r < 0.66) giros.push({ eixo: k, camada: 1, q: -1 });
  }
  return giros;
}
