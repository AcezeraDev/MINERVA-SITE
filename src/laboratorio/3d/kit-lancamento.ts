/**
 * Lançamento oblíquo: canhãozinho na pista (arrastar o cano muda o ângulo,
 * tocar no carrinho dispara), parábola prevista em pontinhos, bola com rastro,
 * coice e fumaça no disparo, poeira no impacto, bandeira do alvo tremulando e
 * o fundo pintado do planeta escolhido (Terra, Lua, Marte, Júpiter).
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { fmt, lancamento, posicaoNoTempo } from "../simulacoes";
import type { EstadoLab, Valores } from "../tipos";
import type { Emitir, Kit } from "./kit";
import { CORES, comSombra, criarEtiqueta, suave, type CtxKit } from "./pecas";

const X0 = -4.1;
const COMPRIMENTO = 8.5;
const ALTURA_MAX = 3.9;
const PIVO_Y = 0.36;
const CANO = 0.85;
const PONTOS = 46;
const RASTRO = 22;
const MARCAS = 12;

const CENARIOS: Record<string, { ceu: [string, string]; chao: string; astro?: { cor: string; r: number; x: number; y: number; faixas?: boolean }; estrelas?: boolean }> = {
  terra: { ceu: ["#7cc4ff", "#e6f4ff"], chao: "#5fae6a", astro: { cor: "#ffe27a", r: 46, x: 820, y: 110 } },
  lua: { ceu: ["#05060c", "#1b1f30"], chao: "#a7a9b2", astro: { cor: "#4f8ff0", r: 54, x: 780, y: 120 }, estrelas: true },
  marte: { ceu: ["#d9875e", "#f3c7a5"], chao: "#b4532f", astro: { cor: "#fff1d6", r: 26, x: 760, y: 120 } },
  jupiter: { ceu: ["#26204a", "#6b4f7d"], chao: "#c9a77a", astro: { cor: "#e8b98a", r: 120, x: 760, y: 170, faixas: true }, estrelas: true },
};

function pintarCenario(canvas: HTMLCanvasElement, gid: string) {
  const c = canvas.getContext("2d")!;
  const cena = CENARIOS[gid] ?? CENARIOS.terra;
  const g = c.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, cena.ceu[0]);
  g.addColorStop(1, cena.ceu[1]);
  c.fillStyle = g;
  c.fillRect(0, 0, 1024, 512);
  if (cena.estrelas) {
    for (let i = 0; i < 160; i += 1) {
      c.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`;
      c.fillRect(Math.random() * 1024, Math.random() * 400, 1.6, 1.6);
    }
  }
  if (cena.astro) {
    const a = cena.astro;
    const halo = c.createRadialGradient(a.x, a.y, a.r * 0.6, a.x, a.y, a.r * 2.2);
    halo.addColorStop(0, `${a.cor}66`);
    halo.addColorStop(1, `${a.cor}00`);
    c.fillStyle = halo;
    c.fillRect(a.x - a.r * 2.4, a.y - a.r * 2.4, a.r * 4.8, a.r * 4.8);
    c.fillStyle = a.cor;
    c.beginPath();
    c.arc(a.x, a.y, a.r, 0, Math.PI * 2);
    c.fill();
    if (a.faixas) {
      c.save();
      c.clip();
      for (let i = -4; i <= 4; i += 1) {
        c.fillStyle = i % 2 ? "rgba(150,80,40,0.35)" : "rgba(255,240,220,0.25)";
        c.fillRect(a.x - a.r, a.y + i * 26, a.r * 2, 14);
      }
      c.restore();
    }
  }
  // morrinhos ao longe na cor do chão
  c.fillStyle = cena.chao;
  c.globalAlpha = 0.55;
  c.beginPath();
  c.moveTo(0, 512);
  for (let x = 0; x <= 1024; x += 32) c.lineTo(x, 430 - Math.sin(x / 140) * 22 - Math.sin(x / 47) * 8);
  c.lineTo(1024, 512);
  c.fill();
  c.globalAlpha = 1;
}

export function criarKitLancamento(ctx: CtxKit, emitir: Emitir): Kit {
  const { guardar, escuro } = ctx;
  const grupo = new THREE.Group();

  // fundo do planeta: painel curvo atrás da pista
  const canvasCena = document.createElement("canvas");
  canvasCena.width = 1024;
  canvasCena.height = 512;
  const texCena = guardar(new THREE.CanvasTexture(canvasCena));
  texCena.colorSpace = THREE.SRGBColorSpace;
  const painel = new THREE.Mesh(
    guardar(new THREE.CylinderGeometry(8, 8, 4.6, 48, 1, true, Math.PI - 0.62, 1.24)),
    guardar(new THREE.MeshBasicMaterial({ map: texCena, side: THREE.BackSide, toneMapped: false })),
  );
  painel.position.set(0, 2.3, 5.6);
  grupo.add(painel);

  // pista
  const matPista = guardar(new THREE.MeshStandardMaterial({ color: CENARIOS.terra.chao, roughness: 0.9 }));
  const pista = new THREE.Mesh(guardar(new RoundedBoxGeometry(9.6, 0.06, 1.9, 2, 0.03)), matPista);
  pista.position.set(0.15, 0.03, 0);
  grupo.add(pista);

  // marcas de distância
  const marcas = new THREE.InstancedMesh(guardar(new THREE.BoxGeometry(0.03, 0.02, 0.22)), guardar(new THREE.MeshBasicMaterial({ color: 0xffffff })), MARCAS);
  grupo.add(marcas);
  const rotMarcas = Array.from({ length: MARCAS }, () => {
    const e = criarEtiqueta(guardar, { altura: 0.2, fonte: "numero", cor: "#ffffff" });
    grupo.add(e.sprite);
    return e;
  });

  // canhão
  const canhao = new THREE.Group();
  canhao.position.set(X0, 0.06, 0);
  const madeira = guardar(new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.7 }));
  const carrinho = new THREE.Mesh(guardar(new RoundedBoxGeometry(0.7, 0.3, 0.46, 2, 0.06)), madeira);
  carrinho.position.y = 0.2;
  carrinho.userData = { toca: true, dica: "toque no canhão para lançar" };
  const geoRoda = guardar(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 24));
  geoRoda.rotateX(Math.PI / 2);
  const matRoda = guardar(new THREE.MeshStandardMaterial({ color: 0x2a3048, roughness: 0.5 }));
  for (const z of [-0.29, 0.29]) {
    const roda = new THREE.Mesh(geoRoda, matRoda);
    roda.position.set(-0.05, 0.2, z);
    roda.userData = carrinho.userData;
    canhao.add(roda);
  }
  const pivoCano = new THREE.Group();
  pivoCano.position.set(0.05, PIVO_Y, 0);
  const geoCano = guardar(new THREE.CylinderGeometry(0.1, 0.13, CANO, 24));
  geoCano.rotateZ(-Math.PI / 2);
  geoCano.translate(CANO / 2 - 0.1, 0, 0);
  const cano = new THREE.Mesh(geoCano, guardar(new THREE.MeshStandardMaterial({ color: 0x3a4258, metalness: 0.75, roughness: 0.3 })));
  cano.userData = { arrasta: true, dica: "arraste o cano para cima ou para baixo: muda o ângulo" };
  const boca = new THREE.Mesh(guardar(new THREE.TorusGeometry(0.105, 0.025, 8, 24)), guardar(new THREE.MeshStandardMaterial({ color: CORES.menta, emissive: CORES.menta, emissiveIntensity: 0.4 })));
  boca.rotation.y = Math.PI / 2;
  boca.position.x = CANO - 0.1;
  const recuo = new THREE.Group();
  recuo.add(cano, boca);
  pivoCano.add(recuo);
  canhao.add(carrinho, pivoCano);
  grupo.add(canhao);
  const rotAngulo = criarEtiqueta(guardar, { fundo: "#f4e04d", fonte: "numero", altura: 0.28 });
  grupo.add(rotAngulo.sprite);

  // parábola prevista em pontinhos
  const pontos = new THREE.InstancedMesh(guardar(new THREE.SphereGeometry(0.03, 8, 6)), guardar(new THREE.MeshBasicMaterial({ color: escuro ? 0xffffff : CORES.tinta, transparent: true, opacity: 0.55 })), PONTOS);
  grupo.add(pontos);

  // bola e rastro
  const bola = new THREE.Mesh(guardar(new THREE.SphereGeometry(0.11, 24, 16)), guardar(new THREE.MeshStandardMaterial({ color: CORES.rosa, roughness: 0.35 })));
  grupo.add(bola);
  const rastro = new THREE.InstancedMesh(guardar(new THREE.SphereGeometry(0.07, 10, 8)), guardar(new THREE.MeshBasicMaterial({ color: CORES.rosa, transparent: true, opacity: 0.45, depthWrite: false })), RASTRO);
  rastro.frustumCulled = false;
  grupo.add(rastro);

  // fumaça do disparo e poeira do impacto (sprites reaproveitados)
  const canvasFumaca = document.createElement("canvas");
  canvasFumaca.width = canvasFumaca.height = 64;
  const cf = canvasFumaca.getContext("2d")!;
  const gf = cf.createRadialGradient(32, 32, 0, 32, 32, 32);
  gf.addColorStop(0, "rgba(255,255,255,0.9)");
  gf.addColorStop(1, "rgba(255,255,255,0)");
  cf.fillStyle = gf;
  cf.fillRect(0, 0, 64, 64);
  const texFumaca = guardar(new THREE.CanvasTexture(canvasFumaca));
  const nuvens = Array.from({ length: 10 }, () => {
    const s = new THREE.Sprite(guardar(new THREE.SpriteMaterial({ map: texFumaca, transparent: true, depthWrite: false, opacity: 0 })));
    s.visible = false;
    grupo.add(s);
    return { s, t: 1, vx: 0, vy: 0, cor: new THREE.Color() };
  });
  const soprar = (pos: THREE.Vector3, quantos: number, cor: number, dir: THREE.Vector3 | null) => {
    for (let i = 0; i < quantos; i += 1) {
      const n = nuvens.find((x) => x.t >= 1) ?? nuvens[i % nuvens.length];
      n.t = 0;
      n.s.position.copy(pos);
      n.s.visible = true;
      (n.s.material as THREE.SpriteMaterial).color.setHex(cor);
      const a = Math.random() * Math.PI * 2;
      n.vx = (dir ? dir.x * 1.2 : Math.cos(a) * 0.9) + (Math.random() - 0.5) * 0.5;
      n.vy = (dir ? dir.y * 1.2 : 0.5) + Math.random() * 0.4;
    }
  };
  const anelImpacto = new THREE.Mesh(guardar(new THREE.RingGeometry(0.85, 1, 40)), guardar(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })));
  anelImpacto.rotation.x = -Math.PI / 2;
  grupo.add(anelImpacto);
  let impactoT = 1;
  const rotAlcance = criarEtiqueta(guardar, { fundo: "rgba(255,255,255,0.95)", fonte: "numero", altura: 0.3 });
  rotAlcance.sprite.visible = false;
  grupo.add(rotAlcance.sprite);

  // alvo: anel no chão + bandeira de pano
  const alvoGrupo = new THREE.Group();
  const canvasAlvo = document.createElement("canvas");
  canvasAlvo.width = canvasAlvo.height = 128;
  const ca = canvasAlvo.getContext("2d")!;
  for (const [r, cor] of [[62, "#e0533d"], [46, "#ffffff"], [30, "#e0533d"], [14, "#ffffff"]] as const) {
    ca.fillStyle = cor;
    ca.beginPath();
    ca.arc(64, 64, r, 0, Math.PI * 2);
    ca.fill();
  }
  const texAlvo = guardar(new THREE.CanvasTexture(canvasAlvo));
  texAlvo.colorSpace = THREE.SRGBColorSpace;
  const discoAlvo = new THREE.Mesh(guardar(new THREE.PlaneGeometry(1, 1)), guardar(new THREE.MeshStandardMaterial({ map: texAlvo, transparent: true, roughness: 0.7 })));
  discoAlvo.rotation.x = -Math.PI / 2;
  discoAlvo.position.y = 0.065;
  const mastro = new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.022, 0.022, 1.1, 8)), guardar(new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 0.6, roughness: 0.3 })));
  mastro.position.set(0, 0.6, -0.55);
  const geoPano = guardar(new THREE.PlaneGeometry(0.55, 0.34, 10, 6));
  geoPano.translate(0.275, 0, 0);
  const basePano = Float32Array.from(geoPano.attributes.position.array as Float32Array);
  const pano = new THREE.Mesh(geoPano, guardar(new THREE.MeshStandardMaterial({ color: CORES.vermelho, side: THREE.DoubleSide, roughness: 0.6 })));
  pano.position.set(0.02, 0.98, -0.55);
  alvoGrupo.add(discoAlvo, mastro, pano);
  grupo.add(alvoGrupo);

  comSombra(grupo);
  pista.castShadow = false;
  painel.receiveShadow = false;
  painel.castShadow = false;

  let v: Valores["lancamento"] = { velocidade: 18, anguloGraus: 40, g: 9.8, gid: "terra" };
  let dados = lancamento(v);
  let k = 0.1;
  let alvo: number | null = null;
  let lance: { inicio: number } | null = null;
  let pousou = false;
  let gidPintado = "";
  let anguloVisual = 40;
  let recuoMola = { v: 0, vel: 0 };
  let segurando = false;
  let anguloArrasto = 40;
  const p = new THREE.Vector3();
  const m4 = new THREE.Matrix4();
  const dirCano = new THREE.Vector3();

  /** Física → cena: escala única e uma rampa suave da altura do cano até o chão. */
  const naCena = (x: number, y: number, destino: THREE.Vector3) => {
    const frac = dados.alcance > 0 ? THREE.MathUtils.clamp(x / dados.alcance, 0, 1) : 1;
    return destino.set(X0 + 0.05 + x * k, 0.17 + Math.max(0, y) * k + (PIVO_Y - 0.06) * (1 - frac), 0);
  };

  const montarMarcas = () => {
    const mundoX = COMPRIMENTO / k;
    const passo = mundoX > 600 ? 200 : mundoX > 300 ? 100 : mundoX > 120 ? 20 : 10;
    let i = 0;
    for (let m = passo; m < mundoX && i < MARCAS; m += passo) {
      const x = X0 + 0.05 + m * k;
      if (x > 4.9) break;
      marcas.setMatrixAt(i, m4.makeTranslation(x, 0.07, 0.8));
      rotMarcas[i].definir(`${m} m`);
      rotMarcas[i].sprite.position.set(x, 0.2, 0.95);
      rotMarcas[i].sprite.visible = true;
      i += 1;
    }
    marcas.count = i;
    marcas.instanceMatrix.needsUpdate = true;
    for (let j = i; j < MARCAS; j += 1) rotMarcas[j].sprite.visible = false;
  };

  const atualizar = (estado: EstadoLab) => {
    const novo = estado.valores.lancamento;
    v = novo;
    dados = lancamento(v);
    alvo = estado.alvo;
    if (!segurando) anguloArrasto = v.anguloGraus;
    const mundoX = Math.max(50, dados.alcance * 1.12, alvo ? alvo * 1.25 : 0);
    const mundoY = Math.max(20, dados.alturaMax * 1.15);
    k = Math.min(COMPRIMENTO / mundoX, ALTURA_MAX / mundoY);
    montarMarcas();
    if (v.gid !== gidPintado) {
      gidPintado = v.gid;
      pintarCenario(canvasCena, v.gid);
      texCena.needsUpdate = true;
      matPista.color.set((CENARIOS[v.gid] ?? CENARIOS.terra).chao);
    }
    for (let i = 0; i < PONTOS; i += 1) {
      const q = posicaoNoTempo(v, (dados.tempoVoo * i) / (PONTOS - 1));
      naCena(q.x, q.y, p);
      pontos.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z));
    }
    pontos.instanceMatrix.needsUpdate = true;
    alvoGrupo.visible = Boolean(alvo);
    if (alvo) {
      alvoGrupo.position.set(X0 + 0.05 + alvo * k, 0, 0);
      const d = Math.max(0.3, 1.5 * k * 2);
      discoAlvo.scale.set(d, d, 1);
    }
    rotAngulo.definir(`${fmt(v.anguloGraus, 0)}° · ${fmt(v.velocidade, 0)} m/s`);
    // disparo novo
    if (estado.lance && estado.lance !== lance) {
      lance = estado.lance;
      pousou = false;
      rotAlcance.sprite.visible = false;
      recuoMola.vel -= 7;
      dirCano.set(Math.cos(THREE.MathUtils.degToRad(v.anguloGraus)), Math.sin(THREE.MathUtils.degToRad(v.anguloGraus)), 0);
      soprar(p.set(X0 + 0.05 + dirCano.x * CANO, 0.06 + PIVO_Y + dirCano.y * CANO, 0), 5, 0xe9edf5, dirCano);
    }
    if (!estado.lance) {
      lance = null;
      pousou = false;
      rotAlcance.sprite.visible = false;
    }
  };

  const tick = (tempo: number, dt: number) => {
    anguloVisual = suave(anguloVisual, v.anguloGraus, dt, 10);
    const rad = THREE.MathUtils.degToRad(anguloVisual);
    pivoCano.rotation.z = rad;
    // coice: mola leva o cano para trás e devolve
    const forca = -recuoMola.v * 260 - recuoMola.vel * 22;
    recuoMola.vel += forca * dt;
    recuoMola.v += recuoMola.vel * dt;
    recuo.position.x = recuoMola.v * 0.06;
    rotAngulo.sprite.position.set(X0 + 0.2, 1.65, 0);

    // bola: o voo dura de 1,2 a 3 s na tela, seja qual for o tempo real
    const duracao = Math.min(3, Math.max(1.2, dados.tempoVoo / 2));
    let f = 0;
    if (lance) f = Math.min(1, (performance.now() - lance.inicio) / 1000 / duracao);
    if (lance) {
      const q = posicaoNoTempo(v, dados.tempoVoo * f);
      naCena(q.x, q.y, p);
      bola.position.copy(p);
      for (let i = 0; i < RASTRO; i += 1) {
        const ft = Math.max(0, f - (i + 1) * 0.018);
        const qr = posicaoNoTempo(v, dados.tempoVoo * ft);
        naCena(qr.x, qr.y, p);
        const e = f >= 1 ? 0 : 1 - i / RASTRO;
        m4.makeScale(e, e, e).setPosition(p);
        rastro.setMatrixAt(i, m4);
      }
      rastro.count = RASTRO;
      rastro.instanceMatrix.needsUpdate = true;
      if (f >= 1 && !pousou) {
        pousou = true;
        impactoT = 0;
        anelImpacto.position.set(bola.position.x, 0.07, 0);
        soprar(p.set(bola.position.x, 0.15, 0), 5, (CENARIOS[v.gid] ?? CENARIOS.terra).chao === "#5fae6a" ? 0xd8cbb0 : 0xe9e2d6, null);
        rotAlcance.definir(`${fmt(dados.alcance, 1)} m`);
        rotAlcance.sprite.position.set(Math.min(4.4, bola.position.x), 0.75, 0);
        rotAlcance.sprite.visible = true;
      }
    } else {
      // bola descansando na boca do cano
      bola.position.set(X0 + 0.05 + Math.cos(rad) * (CANO - 0.1), 0.06 + PIVO_Y + Math.sin(rad) * (CANO - 0.1), 0);
      rastro.count = 0;
    }

    if (impactoT < 1) {
      impactoT = Math.min(1, impactoT + dt * 1.8);
      anelImpacto.scale.setScalar(0.1 + impactoT * 0.9);
      (anelImpacto.material as THREE.MeshBasicMaterial).opacity = (1 - impactoT) * 0.9;
    }
    for (const n of nuvens) {
      if (n.t >= 1) continue;
      n.t = Math.min(1, n.t + dt * 1.3);
      n.s.position.x += n.vx * dt;
      n.s.position.y += n.vy * dt;
      n.vx *= 0.94;
      n.vy *= 0.94;
      n.s.scale.setScalar(0.15 + n.t * 0.7);
      (n.s.material as THREE.SpriteMaterial).opacity = (1 - n.t) * 0.75;
      if (n.t >= 1) n.s.visible = false;
    }

    // bandeira: onda que corre do mastro para a ponta
    if (alvoGrupo.visible) {
      const pos = geoPano.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i += 1) {
        const x = basePano[i * 3];
        pos.setZ(i, Math.sin(x * 9 - tempo * 6) * 0.05 * (x / 0.55));
      }
      pos.needsUpdate = true;
      geoPano.computeVertexNormals();
    }
  };

  return {
    grupo,
    camera: { alvo: new THREE.Vector3(0.25, 1.4, 0), distancia: 11.6, elevacao: 0.2 },
    lugarDaMine: new THREE.Vector3(-2.2, 0.42, 2.25),
    alvos: [cano, carrinho, ...canhao.children.filter((c) => c.userData.toca)],
    atualizar,
    tick,
    foco: (destino) => destino.copy(bola.position).applyMatrix4(grupo.matrixWorld),
    aoSegurar: (objeto) => {
      segurando = objeto === cano;
      anguloArrasto = v.anguloGraus;
    },
    aoArrastar: (objeto, dy) => {
      if (objeto !== cano) return;
      anguloArrasto = THREE.MathUtils.clamp(anguloArrasto - dy * 0.3, 5, 85);
      const novo = Math.round(anguloArrasto);
      if (novo !== v.anguloGraus) emitir({ tipo: "lancamento", parcial: { anguloGraus: novo } });
    },
    aoTocar: (objeto) => {
      if (objeto.userData.toca) emitir({ tipo: "lancar" });
    },
  };
}
