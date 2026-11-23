/**
 * Geometria 3D exata do Pyraminx (tetraedro dividido em 3 camadas).
 *
 * - 4 pontas (tips): tetraedros regulares nos vértices;
 * - 4 centros axiais: octaedros regulares logo abaixo de cada ponta;
 * - 6 arestas (edges): tetraedros regulares entre pares de vértices.
 *
 * Cada peça é construída nas coordenadas exatas da posição resolvida em torno
 * da origem (0, 0, 0), e sua orientação atual vem da matriz exata do grupo A4
 * calculada a partir da permutação `perm` de [0, 1, 2, 3].
 */
import * as THREE from "three";
import { pyraminxVertices, type PecaPyraminx } from "../../shared/pyraminx.mjs";

const V = pyraminxVertices.map(([x, y, z]) => new THREE.Vector3(x, y, z));

/** Matriz inversa de [V0 V1 V2] para converter qualquer permutação par de [0,1,2,3] em rotação SO(3) exata. */
const BASE_INV = new THREE.Matrix3()
  .set(
    V[0].x, V[1].x, V[2].x,
    V[0].y, V[1].y, V[2].y,
    V[0].z, V[1].z, V[2].z,
  )
  .invert();

/** Converte a permutação `perm` de uma peça em Quaternion exato (zero deriva numérica). */
export function quaternionDaPerm(perm: [number, number, number, number]): THREE.Quaternion {
  const a = V[perm[0]];
  const b = V[perm[1]];
  const c = V[perm[2]];
  const alvo = new THREE.Matrix3().set(
    a.x, b.x, c.x,
    a.y, b.y, c.y,
    a.z, b.z, c.z,
  );
  const rot3 = alvo.multiply(BASE_INV);
  const m4 = new THREE.Matrix4().setFromMatrix3(rot3);
  return new THREE.Quaternion().setFromRotationMatrix(m4);
}

/** Ponto 3D a partir de coordenadas baricêntricas (w0 + w1 + w2 + w3 = 3), escalado por `escala`. */
function baricentrico(w: [number, number, number, number], escala: number): THREE.Vector3 {
  return new THREE.Vector3()
    .addScaledVector(V[0], (w[0] / 3) * escala)
    .addScaledVector(V[1], (w[1] / 3) * escala)
    .addScaledVector(V[2], (w[2] / 3) * escala)
    .addScaledVector(V[3], (w[3] / 3) * escala);
}

/** Cria um BufferGeometry a partir de triângulos com normais garantidamente apontando para fora do centroide. */
function poliedroDeTriangulos(triangulos: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3]>, centro: THREE.Vector3, encolher = 0.955): THREE.BufferGeometry {
  const pos: number[] = [];
  const scaleVert = (v: THREE.Vector3) => centro.clone().lerp(v, encolher);

  for (const [rawA, rawB, rawC] of triangulos) {
    const a = scaleVert(rawA);
    const b = scaleVert(rawB);
    const c = scaleVert(rawC);
    const ab = b.clone().sub(a);
    const ac = c.clone().sub(a);
    const normal = ab.cross(ac);
    const mid = a.clone().add(b).add(c).multiplyScalar(1 / 3).sub(centro);
    if (normal.dot(mid) < 0) {
      pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    } else {
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Cria um ladrilho triangular chanfrado (ExtrudeGeometry) no espaço 3D exato da face. */
function adesivoTriangular(
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  normalExterna: THREE.Vector3,
  centroPeca: THREE.Vector3,
): { geo: THREE.BufferGeometry; matriz: THREE.Matrix4 } {
  const shrink = 0.955;
  const a = centroPeca.clone().lerp(p0, shrink);
  const b = centroPeca.clone().lerp(p1, shrink);
  const c = centroPeca.clone().lerp(p2, shrink);
  const triCentro = a.clone().add(b).add(c).multiplyScalar(1 / 3);

  // Recua cada vértice em direção ao centro do triângulo para criar a borda preta de speedcube
  const inset = 0.79;
  const va = triCentro.clone().lerp(a, inset);
  const vb = triCentro.clone().lerp(b, inset);
  const vc = triCentro.clone().lerp(c, inset);

  // Base ortonormal local da face (z = normalExterna)
  const zAxis = normalExterna.clone().normalize();
  const xAxis = vb.clone().sub(va).normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();

  const proj = (pt: THREE.Vector3) => {
    const d = pt.clone().sub(triCentro);
    return new THREE.Vector2(d.dot(xAxis), d.dot(yAxis));
  };

  const pts = [proj(va), proj(vb), proj(vc)];
  // Arredonda os 3 cantos do triângulo com curvas quadráticas suaves
  const shape = new THREE.Shape();
  const r = 0.14;
  for (let i = 0; i < 3; i += 1) {
    const prev = pts[(i + 2) % 3];
    const curr = pts[i];
    const next = pts[(i + 1) % 3];
    const fromPrev = curr.clone().lerp(prev, r);
    const toNext = curr.clone().lerp(next, r);
    if (i === 0) shape.moveTo(fromPrev.x, fromPrev.y);
    else shape.lineTo(fromPrev.x, fromPrev.y);
    shape.quadraticCurveTo(curr.x, curr.y, toNext.x, toNext.y);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 4,
  });

  const posOrigem = triCentro.clone().addScaledVector(zAxis, 0.006);
  const matriz = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).setPosition(posOrigem);
  return { geo, matriz };
}

export type PecaPyraminxGeo = {
  corpo: THREE.BufferGeometry;
  adesivos: Array<{ cor: number; geo: THREE.BufferGeometry; matriz: THREE.Matrix4 }>;
  centro: THREE.Vector3;
};

/**
 * Constrói a geometria completa de uma das 14 peças do Pyraminx na sua posição
 * inicial (resolvida), pronta para ser colocada em um Group na origem.
 */
export function construirPecaPyraminx(peca: PecaPyraminx, escala = 2.05): PecaPyraminxGeo {
  const b = (w0: number, w1: number, w2: number, w3: number) => baricentrico([w0, w1, w2, w3], escala);

  if (peca.tipo === "tip") {
    const k = peca.slotInicial[0];
    const outros = [0, 1, 2, 3].filter((i) => i !== k);
    const wTip: [number, number, number, number] = [0, 0, 0, 0];
    wTip[k] = 3;
    const pTip = baricentrico(wTip, escala);
    const basePts = outros.map((o) => {
      const w: [number, number, number, number] = [0, 0, 0, 0];
      w[k] = 2;
      w[o] = 1;
      return baricentrico(w, escala);
    });
    const centro = pTip.clone().add(basePts[0]).add(basePts[1]).add(basePts[2]).multiplyScalar(0.25);
    const tris: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3]> = [
      [pTip, basePts[0], basePts[1]],
      [pTip, basePts[1], basePts[2]],
      [pTip, basePts[2], basePts[0]],
      [basePts[0], basePts[1], basePts[2]],
    ];
    const corpo = poliedroDeTriangulos(tris, centro);

    const adesivos = peca.adesivos.map((a) => {
      const f = a.localFace;
      // Face f não contém o vértice f: os 2 pontos da base que pertencem à face f são os com o !== f
      const pares = outros
        .map((o, idx) => ({ o, pt: basePts[idx] }))
        .filter((x) => x.o !== f);
      const normal = V[f].clone().negate();
      const { geo, matriz } = adesivoTriangular(pTip, pares[0].pt, pares[1].pt, normal, centro);
      return { cor: a.cor, geo, matriz };
    });

    return { corpo, adesivos, centro };
  }

  if (peca.tipo === "center") {
    const k = peca.slotInicial[0];
    const [o0, o1, o2] = [0, 1, 2, 3].filter((i) => i !== k);
    // 6 vértices do octaedro regular do centro axial k:
    // top3: (wk=2, wo=1) e bot3: (wk=1, wa=1, wb=1)
    const mkTop = (o: number) => {
      const w: [number, number, number, number] = [0, 0, 0, 0];
      w[k] = 2;
      w[o] = 1;
      return baricentrico(w, escala);
    };
    const mkBot = (a: number, bIdx: number) => {
      const w: [number, number, number, number] = [0, 0, 0, 0];
      w[k] = 1;
      w[a] = 1;
      w[bIdx] = 1;
      return baricentrico(w, escala);
    };
    const t0 = mkTop(o0);
    const t1 = mkTop(o1);
    const t2 = mkTop(o2);
    const b01 = mkBot(o0, o1); // está na face o2
    const b12 = mkBot(o1, o2); // está na face o0
    const b20 = mkBot(o2, o0); // está na face o1
    const all = [t0, t1, t2, b01, b12, b20];
    const centro = all.reduce((acc, v) => acc.add(v), new THREE.Vector3()).multiplyScalar(1 / 6);

    // 8 faces triangulares do octaedro
    const tris: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3]> = [
      [t0, t1, t2], // topo (toca a ponta)
      [b01, b12, b20], // base interna
      [t0, t1, b01], // face externa o2
      [t1, t2, b12], // face externa o0
      [t2, t0, b20], // face externa o1
      [t0, b01, b20], // interno toca aresta (k, o0)
      [t1, b01, b12], // interno toca aresta (k, o1)
      [t2, b12, b20], // interno toca aresta (k, o2)
    ];
    const corpo = poliedroDeTriangulos(tris, centro);

    const triPorFace: Record<number, [THREE.Vector3, THREE.Vector3, THREE.Vector3]> = {
      [o2]: [t0, t1, b01],
      [o0]: [t1, t2, b12],
      [o1]: [t2, t0, b20],
    };

    const adesivos = peca.adesivos.map((a) => {
      const [p0, p1, p2] = triPorFace[a.localFace];
      const normal = V[a.localFace].clone().negate();
      const { geo, matriz } = adesivoTriangular(p0, p1, p2, normal, centro);
      return { cor: a.cor, geo, matriz };
    });

    return { corpo, adesivos, centro };
  }

  // Edge (aresta entre vértices i e j)
  const [i, j] = peca.slotInicial;
  const [a, bIdx] = [0, 1, 2, 3].filter((v) => v !== i && v !== j);
  const mkW = (wi: number, wj: number, wa: number, wb: number) => {
    const w: [number, number, number, number] = [0, 0, 0, 0];
    w[i] = wi;
    w[j] = wj;
    w[a] = wa;
    w[bIdx] = wb;
    return baricentrico(w, escala);
  };
  const pI = mkW(2, 1, 0, 0);
  const pJ = mkW(1, 2, 0, 0);
  const pA = mkW(1, 1, 1, 0); // está na face bIdx
  const pB = mkW(1, 1, 0, 1); // está na face a
  const centro = pI.clone().add(pJ).add(pA).add(pB).multiplyScalar(0.25);

  const tris: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3]> = [
    [pI, pJ, pA], // face externa bIdx
    [pI, pJ, pB], // face externa a
    [pI, pA, pB], // face interna voltada para centro i
    [pJ, pA, pB], // face interna voltada para centro j
  ];
  const corpo = poliedroDeTriangulos(tris, centro);

  const triPorFace: Record<number, [THREE.Vector3, THREE.Vector3, THREE.Vector3]> = {
    [bIdx]: [pI, pJ, pA],
    [a]: [pI, pJ, pB],
  };

  const adesivos = peca.adesivos.map((ad) => {
    const [p0, p1, p2] = triPorFace[ad.localFace];
    const normal = V[ad.localFace].clone().negate();
    const { geo, matriz } = adesivoTriangular(p0, p1, p2, normal, centro);
    return { cor: ad.cor, geo, matriz };
  });

  // Referência usada para lint limpo
  void b;
  return { corpo, adesivos, centro };
}

export { V as pyraminxVetores };
