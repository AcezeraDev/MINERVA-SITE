// A Mine só responde quem está logado (21/nov/2026): sem token, 401.
process.env.MINERVA_LOCAL_DB = "1";

import assert from "node:assert/strict";
import test from "node:test";

const { mineSessionOk } = await import("../data-server.mjs");

function fakeRes() {
  const res = { status: 0, body: "" };
  res.writeHead = (status) => {
    res.status = status;
  };
  res.end = (body) => {
    res.body = String(body || "");
  };
  return res;
}

test("POST sem sessão recebe 401 e não chega na Mine", async () => {
  const res = fakeRes();
  const ok = await mineSessionOk({ method: "POST", headers: {} }, res);
  assert.equal(ok, false);
  assert.equal(res.status, 401);
  assert.equal(JSON.parse(res.body).code, "login_required");
});

test("POST com token inventado também recebe 401", async () => {
  const res = fakeRes();
  const ok = await mineSessionOk({ method: "POST", headers: { authorization: "Bearer token-que-nao-existe" } }, res);
  assert.equal(ok, false);
  assert.equal(res.status, 401);
});

test("GET continua aberto (só diz se a busca na web está ligada)", async () => {
  const res = fakeRes();
  assert.equal(await mineSessionOk({ method: "GET", headers: {} }, res), true);
  assert.equal(res.status, 0);
});
