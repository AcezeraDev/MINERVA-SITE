import test from "node:test";
import assert from "node:assert/strict";
import {
  SALA_MAX_CHAMADA,
  SALA_MAX_MEMBROS,
  chamaMine,
  codigoSalaValido,
  conversaParaMine,
  criarSala,
  entrarNaSala,
  fotoValida,
  novoCodigoSala,
  sairDaSala,
  tocarNaSala,
  vistaSala,
} from "../shared/sala.mjs";

const ana = { id: "a", nome: "Ana" };
const bia = { id: "b", nome: "Bia" };

test("código da sala tem 6 letras sem ambíguas", () => {
  for (let i = 0; i < 50; i += 1) assert.ok(codigoSalaValido(novoCodigoSala()));
  assert.ok(!codigoSalaValido("ABC10O"));
  assert.ok(!codigoSalaValido("abcdef"));
});

test("entrar, ficar online e sair", () => {
  const sala = criarSala({ codigo: "ABCDEF", nome: "  Química  ", dono: ana, agora: 0 });
  assert.equal(sala.nome, "Química");
  assert.deepEqual(entrarNaSala(sala, bia, 1000), { ok: true, novo: true });
  assert.equal(entrarNaSala(sala, bia, 2000).novo, false);
  let vista = vistaSala(sala, "a", 3000);
  assert.equal(vista.membros.length, 2);
  assert.ok(vista.membros.every((m) => m.online));
  vista = vistaSala(sala, "a", 60_000);
  assert.ok(vista.membros.every((m) => !m.online));
  assert.ok(sairDaSala(sala, "b"));
  assert.equal(sala.membros.length, 1);
});

test("sala cheia recusa, mas reaproveita vaga de quem sumiu há uma hora", () => {
  const sala = criarSala({ codigo: "ABCDEF", nome: "x", dono: ana, agora: 0 });
  for (let i = 1; i < SALA_MAX_MEMBROS; i += 1) entrarNaSala(sala, { id: `p${i}`, nome: `P${i}` }, 0);
  assert.equal(entrarNaSala(sala, { id: "z", nome: "Z" }, 1000).ok, false);
  sala.membros.forEach((m) => { if (m.id !== "a") m.vistoEm = 0; });
  sala.membros[0].vistoEm = 2 * 60 * 60_000;
  assert.equal(entrarNaSala(sala, { id: "z", nome: "Z" }, 2 * 60 * 60_000).ok, true);
});

test("chamada respeita o limite e quem some sai dela", () => {
  const sala = criarSala({ codigo: "ABCDEF", nome: "x", dono: ana, agora: 0 });
  for (let i = 0; i < SALA_MAX_CHAMADA + 1; i += 1) entrarNaSala(sala, { id: `p${i}`, nome: `P${i}` }, 0);
  for (let i = 0; i < SALA_MAX_CHAMADA; i += 1) assert.equal(tocarNaSala(sala, `p${i}`, 100, { naChamada: true }).aviso, "");
  assert.match(tocarNaSala(sala, `p${SALA_MAX_CHAMADA}`, 100, { naChamada: true }).aviso, /chamada/);
  const vista = vistaSala(sala, "a", 100);
  assert.equal(vista.membros.filter((m) => m.naChamada).length, SALA_MAX_CHAMADA);
  // 30 s sem consultar: some da chamada na vista
  assert.equal(vistaSala(sala, "a", 30_000).membros.filter((m) => m.naChamada).length, 0);
});

test("quem não é membro não toca na sala", () => {
  const sala = criarSala({ codigo: "ABCDEF", nome: "x", dono: ana, agora: 0 });
  assert.equal(tocarNaSala(sala, "intruso", 10).ok, false);
});

test("chamar a Mine", () => {
  assert.ok(chamaMine("@mine me explica isso"));
  assert.ok(chamaMine("Mine, quanto é 2+2?"));
  assert.ok(chamaMine("oi mine tudo bem"));
  assert.ok(!chamaMine("a mineração no Brasil"));
  assert.ok(!chamaMine("eu acho que a mine sabe"));
});

test("foto precisa ser imagem pequena", () => {
  assert.ok(fotoValida("data:image/jpeg;base64,AAAA"));
  assert.ok(!fotoValida("data:text/html;base64,AAAA"));
  assert.ok(!fotoValida("javascript:alert(1)"));
  assert.ok(!fotoValida(`data:image/png;base64,${"A".repeat(2_000_000)}`));
});

test("conversa vira texto para a Mine", () => {
  const texto = conversaParaMine([
    { tipo: "sistema", autor: "", texto: "Ana entrou", temFoto: false },
    { tipo: "texto", autor: "Ana", texto: "olha esse exercício", temFoto: true },
    { tipo: "mine", autor: "Mine", texto: "Vamos lá!", temFoto: false },
  ]);
  assert.equal(texto, "(Ana entrou)\nAna: [mandou uma foto] olha esse exercício\nMine: Vamos lá!");
});
