import test from "node:test";
import assert from "node:assert/strict";

import { MineVoiceError, cleanVoiceText, clearVoiceCache, synthesizeVoice, voiceCacheKey } from "../mine/voice.mjs";

function audioResponse(bytes = 600) {
  return new Response(new Uint8Array(bytes).fill(7), { status: 200, headers: { "content-type": "audio/mpeg" } });
}

test("a voz só aceita inglês curto", () => {
  assert.equal(cleanVoiceText("  Hello,\n  my name is Ana. "), "Hello, my name is Ana.");
  assert.throws(() => cleanVoiceText(""), MineVoiceError);
  assert.throws(() => cleanVoiceText("x".repeat(500)), MineVoiceError);
  assert.throws(() => cleanVoiceText("12345 !!!"), MineVoiceError);
});

test("chave de cache separa velocidade e ignora maiúsculas", () => {
  assert.equal(voiceCacheKey("Hello", false), voiceCacheKey("hello", false));
  assert.notEqual(voiceCacheKey("hello", false), voiceCacheKey("hello", true));
});

test("pede MP3 à NanoGPT com instruções e guarda no cache", async () => {
  const previous = process.env.NANOGPT_API_KEY;
  process.env.NANOGPT_API_KEY = "teste";
  clearVoiceCache();
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), auth: init.headers.authorization });
    return audioResponse();
  };
  try {
    const first = await synthesizeVoice({ text: "Nice to meet you.", slow: true, fetchImpl });
    assert.equal(first.cached, false);
    assert.equal(first.type, "audio/mpeg");
    assert.match(calls[0].url, /\/audio\/speech$/);
    assert.equal(calls[0].auth, "Bearer teste");
    assert.equal(calls[0].body.input, "Nice to meet you.");
    assert.equal(calls[0].body.response_format, "mp3");
    assert.match(calls[0].body.instructions, /slowly/i);

    const again = await synthesizeVoice({ text: "nice to meet you.", slow: true, fetchImpl });
    assert.equal(again.cached, true);
    assert.equal(calls.length, 1);
  } finally {
    if (previous === undefined) delete process.env.NANOGPT_API_KEY;
    else process.env.NANOGPT_API_KEY = previous;
  }
});

test("erro do provedor vira MineVoiceError, e sem chave responde 503", async () => {
  const previous = process.env.NANOGPT_API_KEY;
  const previousList = process.env.NANOGPT_API_KEYS;
  clearVoiceCache();
  try {
    process.env.NANOGPT_API_KEY = "teste";
    const failing = async () => new Response(JSON.stringify({ error: { message: "nope" } }), { status: 400, headers: { "content-type": "application/json" } });
    await assert.rejects(synthesizeVoice({ text: "Hello", fetchImpl: failing }), (error) => error instanceof MineVoiceError && error.status === 502);

    delete process.env.NANOGPT_API_KEY;
    delete process.env.NANOGPT_API_KEYS;
    await assert.rejects(synthesizeVoice({ text: "Goodbye", fetchImpl: async () => audioResponse() }), (error) => error instanceof MineVoiceError && error.status === 503);
  } finally {
    if (previous === undefined) delete process.env.NANOGPT_API_KEY;
    else process.env.NANOGPT_API_KEY = previous;
    if (previousList !== undefined) process.env.NANOGPT_API_KEYS = previousList;
  }
});
