import test from "node:test";
import assert from "node:assert/strict";
import { pageHighlights, sanitizePageHtml } from "../mine/page-reader.mjs";

test("página do painel sai sem script, frame, evento inline nem redirecionamento", () => {
  const raw = `<html><head><meta http-equiv="refresh" content="0;url=https://mal.example"><base href="https://outro.example/"><script>alert(1)</script></head>
<body onload="x()"><a href="javascript:alert(1)">a</a><iframe src="https://x.example"></iframe><embed src="a.swf">
<img data-src="/foto.jpg" src="data:image/gif;base64,R0lG" alt="f"><p onclick='y()'>Texto</p><script src="a.js"></script></body></html>`;
  const html = sanitizePageHtml(raw, "https://site.example/pagina");
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<iframe|<embed/i);
  assert.doesNotMatch(html, /\son(load|click)=/i);
  assert.doesNotMatch(html, /javascript:/i);
  assert.doesNotMatch(html, /refresh/i);
  assert.doesNotMatch(html, /outro\.example/);
  assert.match(html, /<base href="https:\/\/site\.example\/pagina" target="_blank">/);
  assert.match(html, /script-src 'none'/);
  assert.match(html, /<img src="\/foto\.jpg"/);
  assert.match(html, /<p>Texto<\/p>/);
});

test("trechos para grifar são os que falam da pergunta, na ordem da página", () => {
  const paragraphs = [
    "A cidade tem muitas praças e um museu de arte moderna aberto aos domingos de manhã.",
    "A fotossíntese acontece nos cloroplastos, onde a clorofila captura a luz do sol para produzir glicose.",
    "O clima da região é tropical, com chuvas concentradas no verão e inverno seco e ameno.",
    "Na fotossíntese a planta libera oxigênio, consumindo gás carbônico e água durante o processo.",
  ];
  const picked = pageHighlights(paragraphs, "como funciona a fotossíntese e a clorofila");
  assert.equal(picked.length, 2);
  assert.match(picked[0], /cloroplastos/);
  assert.match(picked[1], /oxigênio/);
  assert.ok(picked.every((text) => text.length <= 160));
  assert.equal(pageHighlights(paragraphs, "xyz").length, 2);
});
