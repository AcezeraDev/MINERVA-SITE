import test from "node:test";
import assert from "node:assert/strict";
import { timedTextToTranscript, urlsInText, videoInstruction, youtubeId } from "../mine/video.mjs";

test("id do YouTube sai de todos os formatos de link", () => {
  assert.equal(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://youtu.be/dQw4w9WgXcQ?si=abc"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://m.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://www.youtube.com/@canal"), "");
  assert.equal(youtubeId("https://vimeo.com/123"), "");
});

test("links da mensagem saem sem a pontuação colada", () => {
  assert.deepEqual(urlsInText("Veja https://g1.globo.com/a.html, e (https://youtu.be/dQw4w9WgXcQ)."), ["https://g1.globo.com/a.html", "https://youtu.be/dQw4w9WgXcQ"]);
  assert.deepEqual(urlsInText("sem link nenhum"), []);
});

test("legenda vira texto com marca de tempo a cada 30 s", () => {
  const xml = '<timedtext><body><p t="1000" d="2000">Ol&amp;á turma</p><p t="5000" d="1">segue</p><p t="65000" d="1">parte <s>dois</s></p></body></timedtext>';
  assert.equal(timedTextToTranscript(xml), "[00:01] Ol&á turma segue \n[01:05] parte dois");
});

test("vídeo sem legenda manda a Mine avisar e não inventar", () => {
  const texto = videoInstruction([{ ok: false, title: "Aula", channel: "Canal", seconds: 125, url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", reason: "vídeo sem legenda", description: "desc" }]);
  assert.match(texto, /2 min 05 s/);
  assert.match(texto, /Sem transcrição \(vídeo sem legenda\)/);
  assert.match(texto, /Nunca invente/);
});
