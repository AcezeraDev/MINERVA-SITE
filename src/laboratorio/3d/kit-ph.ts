/**
 * Ácido + base: béquer de vidro com o indicador de repolho roxo, duas buretas
 * (HCl e NaOH) num suporte que pingam quando o volume sobe (toque numa bureta
 * pinga 1 mL), ondinha onde a gota cai, bolhas, medidor de pH com tela e a
 * régua de cores do indicador no tapete.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { classificaPh, corRepolho, fmt, ph, semSolucao } from "../simulacoes";
import type { EstadoLab } from "../tipos";
import type { Emitir, Kit } from "./kit";
import { comSombra, criarEtiqueta, materialVidro, suave, type CtxKit } from "./pecas";

const R_BEQUER = 0.8;
const ALTURA_BEQUER = 1.8;
const Z_BEQUER = 0.15;
const TOPO_BURETA = 4.0;
const BASE_BURETA = 2.05;
const MAX_GOTAS = 24;

function nivelDoVolume(ml: number) {
  return 0.04 + (Math.min(100, ml) / 100) * 1.5;
}

export function criarKitPh(ctx: CtxKit, emitir: Emitir): Kit {
  const { guardar, escuro } = ctx;
  const grupo = new THREE.Group();
  const vidro = materialVidro(guardar, escuro);

  // béquer: parede aberta, fundo e borda
  const bequer = new THREE.Group();
  bequer.position.set(0, 0, Z_BEQUER);
  const parede = new THREE.Mesh(guardar(new THREE.CylinderGeometry(R_BEQUER + 0.02, R_BEQUER, ALTURA_BEQUER, 48, 1, true)), vidro);
  parede.position.y = ALTURA_BEQUER / 2;
  const fundo = new THREE.Mesh(guardar(new THREE.CircleGeometry(R_BEQUER, 48)), vidro);
  fundo.rotation.x = -Math.PI / 2;
  fundo.position.y = 0.01;
  const borda = new THREE.Mesh(guardar(new THREE.TorusGeometry(R_BEQUER + 0.02, 0.025, 8, 48)), vidro);
  borda.rotation.x = Math.PI / 2;
  borda.position.y = ALTURA_BEQUER;
  // graduação pintada no vidro (só a parte da frente)
  const canvasGrad = document.createElement("canvas");
  canvasGrad.width = 256;
  canvasGrad.height = 512;
  const cg = canvasGrad.getContext("2d")!;
  cg.fillStyle = escuro ? "rgba(255,255,255,0.85)" : "rgba(29,36,64,0.75)";
  cg.font = "700 26px system-ui, sans-serif";
  for (let ml = 10; ml <= 100; ml += 10) {
    const y = 512 - ((nivelDoVolume(ml)) / ALTURA_BEQUER) * 512;
    const longa = ml % 20 === 0;
    cg.fillRect(70, y - 1.5, longa ? 70 : 40, 3);
    if (longa) cg.fillText(String(ml), 150, y + 9);
  }
  cg.font = "800 22px system-ui, sans-serif";
  cg.fillText("mL", 150, 40);
  const texGrad = guardar(new THREE.CanvasTexture(canvasGrad));
  texGrad.colorSpace = THREE.SRGBColorSpace;
  const graduacao = new THREE.Mesh(
    guardar(new THREE.CylinderGeometry(R_BEQUER + 0.035, R_BEQUER + 0.015, ALTURA_BEQUER, 24, 1, true, -0.45, 0.9)),
    guardar(new THREE.MeshBasicMaterial({ map: texGrad, transparent: true, depthWrite: false })),
  );
  graduacao.position.y = ALTURA_BEQUER / 2;
  bequer.add(parede, fundo, borda, graduacao);
  grupo.add(bequer);

  // líquido
  const geoLiquido = guardar(new THREE.CylinderGeometry(R_BEQUER - 0.05, R_BEQUER - 0.06, 1, 48));
  geoLiquido.translate(0, 0.5, 0);
  const corLiquido = new THREE.Color("#b25bd6");
  const corAlvo = new THREE.Color("#b25bd6");
  const matLiquido = guardar(new THREE.MeshStandardMaterial({ color: corLiquido, roughness: 0.12, transparent: true, opacity: 0.86, emissive: corLiquido, emissiveIntensity: 0.18 }));
  const liquido = new THREE.Mesh(geoLiquido, matLiquido);
  liquido.position.y = 0.02;
  liquido.renderOrder = 1;
  bequer.add(liquido);

  // bolhas
  const bolhas = new THREE.InstancedMesh(guardar(new THREE.SphereGeometry(0.035, 8, 6)), guardar(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false })), 16);
  bolhas.renderOrder = 2;
  const sementes = Array.from({ length: 16 }, (_, i) => ({ a: Math.random() * Math.PI * 2, r: 0.15 + Math.random() * 0.5, v: 0.25 + Math.random() * 0.35, f: i / 16 }));
  bequer.add(bolhas);

  // suporte universal
  const metal = guardar(new THREE.MeshStandardMaterial({ color: 0xb4bccb, metalness: 0.85, roughness: 0.3 }));
  // suporte à esquerda do béquer (atrás dele, a haste parecia mergulhada na solução)
  const X_HASTE = -1.6;
  const base = new THREE.Mesh(guardar(new RoundedBoxGeometry(0.9, 0.08, 1.0, 2, 0.03)), guardar(new THREE.MeshStandardMaterial({ color: 0x2a3048, roughness: 0.5 })));
  base.position.set(X_HASTE - 0.15, 0.04, Z_BEQUER);
  const haste = new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.04, 0.04, 4.3, 12)), metal);
  haste.position.set(X_HASTE, 2.15, Z_BEQUER);
  const travessa = new THREE.Mesh(guardar(new THREE.BoxGeometry(2.25, 0.06, 0.06)), metal);
  travessa.position.set((X_HASTE + 0.6) / 2, 3.2, Z_BEQUER);
  const garra = new THREE.Mesh(guardar(new THREE.BoxGeometry(0.16, 0.16, 0.16)), metal);
  garra.position.set(X_HASTE, 3.2, Z_BEQUER);
  grupo.add(base, haste, travessa, garra);

  // buretas
  const geoTubo = guardar(new THREE.CylinderGeometry(0.075, 0.075, TOPO_BURETA - BASE_BURETA, 20, 1, true));
  const geoColuna = guardar(new THREE.CylinderGeometry(0.058, 0.058, 1, 16));
  geoColuna.translate(0, 0.5, 0);
  const geoPonta = guardar(new THREE.ConeGeometry(0.06, 0.2, 14));
  geoPonta.rotateX(Math.PI);
  const geoTorneira = guardar(new THREE.CylinderGeometry(0.03, 0.03, 0.28, 10));
  geoTorneira.rotateZ(Math.PI / 2);
  const geoGota = guardar(new THREE.SphereGeometry(0.045, 12, 8));
  const criarBureta = (x: number, nome: string, cor: number) => {
    const g = new THREE.Group();
    g.position.set(x, 0, Z_BEQUER);
    const tubo = new THREE.Mesh(geoTubo, vidro);
    tubo.position.y = (TOPO_BURETA + BASE_BURETA) / 2;
    const matCor = guardar(new THREE.MeshStandardMaterial({ color: cor, transparent: true, opacity: 0.75, roughness: 0.2 }));
    const coluna = new THREE.Mesh(geoColuna, matCor);
    coluna.position.y = BASE_BURETA;
    coluna.renderOrder = 1;
    const ponta = new THREE.Mesh(geoPonta, vidro);
    ponta.position.y = BASE_BURETA - 0.1;
    const torneira = new THREE.Mesh(geoTorneira, guardar(new THREE.MeshStandardMaterial({ color: x < 0 ? 0xff7d9c : 0x6aa8ff, roughness: 0.4 })));
    torneira.position.y = BASE_BURETA + 0.08;
    // caixa de toque generosa em volta do tubo (vidro fino é difícil de acertar)
    const toque = new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.22, 0.22, TOPO_BURETA - BASE_BURETA + 0.3, 8)), guardar(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })));
    toque.position.y = (TOPO_BURETA + BASE_BURETA) / 2;
    toque.userData = { toca: true, dica: `${nome}: toque para pingar 1 mL` };
    g.add(tubo, coluna, ponta, torneira, toque);
    grupo.add(g);
    const rot = criarEtiqueta(guardar, { fundo: x < 0 ? "#ffd1dc" : "#d4e4ff", fonte: "numero", altura: 0.26 });
    rot.sprite.position.set(x * 1.9, TOPO_BURETA + 0.25, Z_BEQUER);
    grupo.add(rot.sprite);
    const gotas = Array.from({ length: MAX_GOTAS / 2 }, () => {
      const gota = new THREE.Mesh(geoGota, matCor);
      gota.visible = false;
      gota.scale.set(1, 1.35, 1);
      grupo.add(gota);
      return { malha: gota, y: 0, vel: 0, ativa: false };
    });
    return { g, coluna, torneira, toque, rot, gotas, fila: 0, espera: 0, ml: -1, x };
  };
  const hcl = criarBureta(-0.42, "HCl", 0xff9ab3);
  const naoh = criarBureta(0.42, "NaOH", 0x8fbaff);

  // ondinhas onde a gota cai
  const geoOnda = guardar(new THREE.RingGeometry(0.9, 1, 32));
  geoOnda.rotateX(-Math.PI / 2);
  const ondas = Array.from({ length: 6 }, () => {
    const m = new THREE.Mesh(geoOnda, guardar(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })));
    m.visible = false;
    grupo.add(m);
    return { malha: m, t: 1 };
  });
  const soltarOnda = (x: number, y: number) => {
    const onda = ondas.find((o) => o.t >= 1) ?? ondas[0];
    onda.t = 0;
    onda.malha.position.set(x, y + 0.01, Z_BEQUER);
    onda.malha.visible = true;
  };

  // medidor de pH com tela e sonda mergulhada
  const medidor = new THREE.Group();
  medidor.position.set(2.15, 0, 0.35);
  medidor.rotation.y = -0.35;
  const caixa = new THREE.Mesh(guardar(new RoundedBoxGeometry(1.0, 1.3, 0.3, 3, 0.08)), guardar(new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.5 })));
  caixa.position.y = 0.65;
  caixa.rotation.x = -0.18;
  const canvasTela = document.createElement("canvas");
  canvasTela.width = 256;
  canvasTela.height = 192;
  const texTela = guardar(new THREE.CanvasTexture(canvasTela));
  texTela.colorSpace = THREE.SRGBColorSpace;
  const tela = new THREE.Mesh(guardar(new THREE.PlaneGeometry(0.78, 0.58)), guardar(new THREE.MeshBasicMaterial({ map: texTela, toneMapped: false })));
  tela.position.set(0, 0.17, 0.152);
  caixa.add(tela);
  caixa.userData = { dica: "medidor de pH: mede direto na solução" };
  medidor.add(caixa);
  grupo.add(medidor);
  let telaDesenhada = "";
  const desenharTela = (valor: number, cor: string, vazio = false) => {
    const chave = `${fmt(valor, 2)}|${cor}`;
    if (chave === telaDesenhada) return;
    telaDesenhada = chave;
    const c = canvasTela.getContext("2d")!;
    c.fillStyle = "#14201b";
    c.fillRect(0, 0, 256, 192);
    c.fillStyle = "#9df5c4";
    c.font = "700 26px ui-monospace, monospace";
    c.fillText("pH", 18, 38);
    c.font = "800 84px ui-monospace, monospace";
    c.textAlign = "right";
    c.fillText(vazio ? "--" : fmt(valor, 2), 240, 128);
    c.textAlign = "left";
    if (!vazio) {
      c.fillStyle = cor;
      c.fillRect(18, 150, 220, 18);
    }
    c.fillStyle = "#9df5c4";
    c.font = "700 20px system-ui, sans-serif";
    c.fillText(vazio ? "vazio" : classificaPh(valor), 120, 38);
    texTela.needsUpdate = true;
  };
  // sonda e cabo
  const sondaX = 0.38;
  const sondaZ = Z_BEQUER - 0.42;
  const sonda = new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.035, 0.035, 1.9, 12)), guardar(new THREE.MeshStandardMaterial({ color: 0x2a3048, roughness: 0.4 })));
  sonda.position.set(sondaX, 1.25, sondaZ);
  sonda.rotation.z = -0.08;
  const cabo = new THREE.Mesh(
    guardar(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([new THREE.Vector3(sondaX + 0.07, 2.2, sondaZ), new THREE.Vector3(1.0, 2.6, -0.2), new THREE.Vector3(1.9, 1.7, 0.1), new THREE.Vector3(2.15, 1.28, 0.3)]),
        40,
        0.022,
        6,
        false,
      ),
    ),
    guardar(new THREE.MeshStandardMaterial({ color: 0x2a3048, roughness: 0.5 })),
  );
  grupo.add(sonda, cabo);

  // régua de cores do indicador no tapete, com o marcador do pH atual
  const canvasRegua = document.createElement("canvas");
  canvasRegua.width = 512;
  canvasRegua.height = 48;
  const cr = canvasRegua.getContext("2d")!;
  for (let i = 0; i < 140; i += 1) {
    cr.fillStyle = corRepolho(i / 10).cor;
    cr.fillRect((512 * i) / 140, 0, 512 / 140 + 1, 48);
  }
  cr.fillStyle = "rgba(255,255,255,0.9)";
  cr.font = "800 16px system-ui, sans-serif";
  for (let i = 0; i <= 14; i += 2) cr.fillText(String(i), (512 * i) / 14 + (i === 14 ? -18 : 3), 30);
  const texRegua = guardar(new THREE.CanvasTexture(canvasRegua));
  texRegua.colorSpace = THREE.SRGBColorSpace;
  const regua = new THREE.Mesh(guardar(new THREE.PlaneGeometry(4.6, 0.42)), guardar(new THREE.MeshStandardMaterial({ map: texRegua, roughness: 0.6 })));
  regua.rotation.x = -Math.PI / 2;
  regua.position.set(0, 0.012, 1.85);
  grupo.add(regua);
  const marcador = new THREE.Mesh(guardar(new THREE.ConeGeometry(0.1, 0.24, 16)), guardar(new THREE.MeshStandardMaterial({ color: 0x1d2440, roughness: 0.4 })));
  marcador.rotation.x = Math.PI;
  grupo.add(marcador);
  const rotPh = criarEtiqueta(guardar, { fundo: "rgba(255,255,255,0.95)", fonte: "numero", altura: 0.28 });
  grupo.add(rotPh.sprite);

  comSombra(grupo);
  liquido.castShadow = false;

  let volume = 35;
  let nivel = nivelDoVolume(35);
  let valorPh = 7;
  let marcadorX = 0;
  let primeira = true;

  const atualizar = (estado: EstadoLab) => {
    const v = estado.valores.ph;
    volume = v.acido + v.base;
    valorPh = ph(v.acido, v.base);
    const indicador = corRepolho(valorPh);
    corAlvo.set(indicador.cor);
    const vazio = semSolucao(v.acido, v.base);
    desenharTela(valorPh, indicador.cor, vazio);
    rotPh.definir(vazio ? "Sem solução" : `pH ${fmt(valorPh, 2)} · ${indicador.nome}`);
    marcador.visible = !vazio;
    for (const [bureta, ml, nome] of [[hcl, v.acido, "HCl"], [naoh, v.base, "NaOH"]] as const) {
      // subiu: as gotas caem (no máximo 10 por vez)
      if (!primeira && ml > bureta.ml) bureta.fila = Math.min(10, bureta.fila + Math.ceil(ml - bureta.ml));
      bureta.ml = ml;
      bureta.rot.definir(`${nome} ${fmt(ml, ml % 1 ? 1 : 0)} mL`);
    }
    if (primeira) {
      corLiquido.copy(corAlvo);
      nivel = nivelDoVolume(volume);
      marcadorX = -2.3 + (4.6 * valorPh) / 14;
    }
    primeira = false;
  };

  const m4 = new THREE.Matrix4();
  const tick = (tempo: number, dt: number) => {
    nivel = suave(nivel, nivelDoVolume(volume), dt, 3);
    liquido.visible = volume > 0.05;
    liquido.scale.y = nivel;
    corLiquido.lerp(corAlvo, Math.min(1, dt * 2.2));
    matLiquido.color.copy(corLiquido);
    matLiquido.emissive.copy(corLiquido);
    const topo = 0.02 + nivel;

    // bolhas subindo dentro do líquido
    sementes.forEach((s, i) => {
      const f = (tempo * s.v * 0.4 + s.f) % 1;
      const y = 0.08 + f * Math.max(0, topo - 0.12);
      const a = s.a + tempo * 0.5;
      const e = volume > 1 ? 0.6 + f * 0.6 : 0;
      m4.makeScale(e, e, e).setPosition(Math.cos(a) * s.r, y, Math.sin(a) * s.r);
      bolhas.setMatrixAt(i, m4);
    });
    bolhas.instanceMatrix.needsUpdate = true;

    for (const b of [hcl, naoh]) {
      const resta = Math.max(0, 50 - b.ml) / 50;
      b.coluna.scale.y = suave(b.coluna.scale.y, Math.max(0.02, resta * (TOPO_BURETA - BASE_BURETA - 0.1)), dt, 4);
      // pinga a fila, uma gota a cada 0,12 s, com a torneira aberta
      b.espera -= dt;
      b.torneira.rotation.y = suave(b.torneira.rotation.y, b.fila > 0 ? Math.PI / 2 : 0, dt, 10);
      if (b.fila > 0 && b.espera <= 0) {
        const gota = b.gotas.find((g) => !g.ativa);
        if (gota) {
          gota.ativa = true;
          gota.y = BASE_BURETA - 0.22;
          gota.vel = 0;
          gota.malha.visible = true;
          b.fila -= 1;
          b.espera = 0.12;
        }
      }
      for (const gota of b.gotas) {
        if (!gota.ativa) continue;
        gota.vel += 9 * dt;
        gota.y -= gota.vel * dt;
        gota.malha.position.set(b.x, gota.y, Z_BEQUER);
        if (gota.y <= topo) {
          gota.ativa = false;
          gota.malha.visible = false;
          soltarOnda(b.x, topo);
        }
      }
    }
    for (const onda of ondas) {
      if (onda.t >= 1) continue;
      onda.t = Math.min(1, onda.t + dt * 1.6);
      onda.malha.scale.setScalar(0.04 + onda.t * 0.42);
      (onda.malha.material as THREE.MeshBasicMaterial).opacity = (1 - onda.t) * 0.8;
      if (onda.t >= 1) onda.malha.visible = false;
    }

    marcadorX = suave(marcadorX, -2.3 + (4.6 * valorPh) / 14, dt, 5);
    marcador.position.set(marcadorX, 0.3 + Math.sin(tempo * 3) * 0.04, 1.85);
    rotPh.sprite.position.set(THREE.MathUtils.clamp(marcadorX, -1.7, 1.7), 0.68, 1.85);
  };

  return {
    grupo,
    camera: { alvo: new THREE.Vector3(0.25, 1.5, 0.2), distancia: 8.4, elevacao: 0.3 },
    alvos: [hcl.toque, naoh.toque, caixa],
    atualizar,
    tick,
    foco: (destino) => destino.set(0, 1.2, Z_BEQUER).applyMatrix4(grupo.matrixWorld),
    aoTocar: (objeto) => {
      if (objeto === hcl.toque && hcl.ml < 50) emitir({ tipo: "ph", parcial: { acido: Math.min(50, Math.round(hcl.ml) + 1) } });
      if (objeto === naoh.toque && naoh.ml < 50) emitir({ tipo: "ph", parcial: { base: Math.min(50, Math.round(naoh.ml) + 1) } });
    },
  };
}
