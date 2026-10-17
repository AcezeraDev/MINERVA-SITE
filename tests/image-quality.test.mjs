import test from "node:test";
import assert from "node:assert/strict";

import { isUnsafeImage, isUnsafeQuery, scoreImage } from "../education-server.mjs";
import { asksForImage, continuesGallery, describeImageMarkers } from "../shared/chat-media.mjs";

const foto = (title, pageUrl = "https://site.com/pagina", extra = {}) => ({
  url: "https://imgs.search.brave.com/x/y",
  full: "https://site.com/foto.jpg",
  title,
  pageUrl,
  source: "site.com",
  ...extra,
});

test("filtro de conteúdo adulto pega título, endereço e site", () => {
  // Caso real de set/2026: uma busca por "Ellie Williams" trouxe isto.
  assert.equal(isUnsafeImage(foto("Pic and editing by me (give creds) Ellie Williams R34, Ellie Williams Pin")), true);
  assert.equal(isUnsafeImage(foto("Ellie", "https://rule34.xxx/index.php?id=1")), true);
  assert.equal(isUnsafeImage(foto("Ellie NSFW art")), true);
  assert.equal(isUnsafeImage(foto("Ellie", "https://site.com/p", { source: "e621.net" })), true);
  // Nada de falso positivo com palavras comuns de estudo.
  assert.equal(isUnsafeImage(foto("Möbius strip model")), false);
  assert.equal(isUnsafeImage(foto("Al Gore at the climate summit")), false);
  assert.equal(isUnsafeImage(foto("Nikola Tesla in his laboratory")), false);
  assert.equal(isUnsafeQuery("nudes da ellie"), true);
  assert.equal(isUnsafeQuery("Ellie Williams The Last of Us"), false);
});

test("relevância exige o assunto no título e descarta sósias", () => {
  const asked = ["ellie", "williams"];
  assert.equal(scoreImage(foto("Imagem do comentário", "https://reddit.com/r/tlou/ellie_williams"), asked, "Ellie Williams"), null);
  assert.equal(scoreImage(foto("Image result"), asked, "Ellie Williams"), null);
  assert.equal(scoreImage(foto("Quinn Ellie Williams Cosplay, Ellie Costume"), asked, "Ellie Williams"), null);
  assert.equal(scoreImage(foto("HBO Recast: Talia Ryder as Ellie Williams"), asked, "Ellie Williams"), null);
  // Cosplay pedido de propósito continua valendo.
  assert.notEqual(scoreImage(foto("Ellie Williams cosplay"), ["ellie", "williams", "cosplay"], "Ellie Williams cosplay"), null);
  const titulo = scoreImage(foto("Ellie Williams, The Last of Us Part II"), asked, "Ellie Williams");
  const soEndereco = scoreImage(foto("Ellie", "https://site.com/ellie-williams"), asked, "Ellie Williams");
  assert.ok(titulo > soEndereco, "quem cita o assunto no título vem antes");
});

test("pedidos reais de foto são reconhecidos", () => {
  for (const pedido of [
    "poderia pesquisar uma foto icon da ellie williams?",
    "me mande mais icons 1:1",
    "poderia me mandar fotos da lucia de gta 6? icons",
    "tem como achar um wallpaper do naruto",
    "me dá uns ícones do Minecraft",
  ]) {
    assert.equal(asksForImage(pedido), true, pedido);
  }
  for (const outro of ["o que tem nessa foto que eu mandei?", "explique fotossíntese", "a foto ficou boa?"]) {
    assert.equal(asksForImage(outro), false, outro);
  }
});

test("'manda mais' depois de uma galeria continua sendo pedido de foto", () => {
  const history = [
    { role: "user", text: "fotos da lucia de gta 6" },
    { role: "mine", text: describeImageMarkers("Aqui:\n\n[[imagem: Lucia Caminos GTA 6 | Lucia]]\n\n[[sugestoes: a | b]]") },
  ];
  assert.equal(history[1].text, "Aqui:\n\n(galeria de fotos: Lucia Caminos GTA 6)");
  assert.equal(continuesGallery("me mande mais icons 1:1", history), "Lucia Caminos GTA 6");
  assert.equal(continuesGallery("manda outras dela", history), "Lucia Caminos GTA 6");
  assert.equal(continuesGallery("quem é ela?", history), "");
  assert.equal(continuesGallery("manda mais", [{ role: "mine", text: "Resposta sem fotos." }]), "");
});

test("foto de título genérico só entra quando a página é sobre o assunto e não é rede social", async () => {
  const { scoreByPage } = await import("../education-server.mjs");
  const asked = ["lucia", "caminos", "gta", "trailer"];
  assert.equal(scoreByPage(foto("Image result", "https://www.wikigta6.com/lucia2/"), asked), 1);
  assert.equal(scoreByPage(foto("Imagem do comentário", "https://www.reddit.com/r/GTA/comments/1/lucia_caminos_gta_6_trailer/"), asked), null);
  assert.equal(scoreByPage(foto("Image result", "https://www.receitas.com/bolo-de-cenoura/"), asked), null);
});

test("estilo da imagem: 'icons da Ellie' vira estilo icone, nao fotos", async () => {
  const { imageStyleFrom, splitImageStyle, splitMessageMedia, withImageStyle, previousGalleryStyle } = await import("../shared/chat-media.mjs");
  assert.equal(imageStyleFrom("pesquise icons da ellie williams"), "icone");
  assert.equal(imageStyleFrom("quero uma pfp do Joel"), "icone");
  assert.equal(imageStyleFrom("manda wallpaper do naruto"), "wallpaper");
  assert.equal(imageStyleFrom("fan art de hollow knight"), "desenho");
  assert.equal(imageStyleFrom("logo do Flamengo"), "logo");
  // "logo" advérbio não é estilo.
  assert.equal(imageStyleFrom("manda uma foto do Einstein e logo depois explica"), "");
  assert.deepEqual(splitImageStyle("Ellie Williams icon pfp"), { query: "Ellie Williams", style: "icone" });
  const [segment] = splitMessageMedia("[[imagem: Ellie Williams The Last of Us | Ícones da Ellie | icone]]");
  assert.equal(segment.style, "icone");
  assert.equal(segment.query, "Ellie Williams The Last of Us");
  assert.equal(withImageStyle("[[imagem: Ellie Williams | Ícones]]", "icone"), "[[imagem: Ellie Williams | Ícones | icone]]");
  assert.equal(previousGalleryStyle([{ role: "mine", text: "(galeria de icones: Ellie Williams)" }]), "icone");
});

test("icone: titulo curto com o nome passa, formato quadrado e 'icon' sobem", async () => {
  const { scoreStyledImage } = await import("../education-server.mjs");
  const query = "Ellie Williams The Last of Us";
  const asked = ["ellie", "williams", "last"];
  const icon = scoreStyledImage(foto("ellie icon", "https://br.pinterest.com/pin/ellie-williams-tlou/", { width: 500, height: 500 }), asked, query, "icone");
  const wide = scoreStyledImage(foto("Ellie Williams The Last of Us screenshot", "https://site.com/ellie-williams", { width: 1920, height: 800 }), asked, query, "icone");
  assert.ok(icon !== null && wide !== null);
  assert.ok(icon > wide, `icone ${icon} deveria ganhar de ${wide}`);
  // Outro assunto não entra, mesmo sendo ícone.
  assert.equal(scoreStyledImage(foto("joel icon", "https://site.com/joel", { width: 500, height: 500 }), asked, query, "icone"), null);
  assert.equal(scoreStyledImage(foto("Ellie Williams cosplay icon", "https://site.com/ellie-williams"), asked, query, "icone"), null);
});
