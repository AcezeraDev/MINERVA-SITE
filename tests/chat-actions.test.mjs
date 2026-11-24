import test from "node:test";
import assert from "node:assert/strict";
import { chatActionFromPrompt, plainTextFromReply } from "../shared/chat-actions.mjs";

const kind = (frase) => chatActionFromPrompt(frase)?.kind ?? null;

test("salvar: destino com acento sai do texto original", () => {
  assert.deepEqual(chatActionFromPrompt("salva isso na matéria de História"), { kind: "salvar", topic: "", refersBack: true, destino: "História" });
  assert.equal(chatActionFromPrompt("Mine, guarda essa explicação em Química")?.destino, "Química");
  assert.equal(chatActionFromPrompt("salva essa resposta")?.destino, "");
  assert.equal(chatActionFromPrompt("anota isso nos meus conteúdos de Biologia")?.destino, "Biologia");
  assert.equal(chatActionFromPrompt("salva nos conteúdos")?.destino, "");
  assert.equal(chatActionFromPrompt("pode salvar isso em Física?")?.destino, "Física");
});

test("agenda: frase da tarefa sem o pedido em volta", () => {
  assert.deepEqual(chatActionFromPrompt("coloca na agenda prova de física sexta"), { kind: "agenda", topic: "", refersBack: false, tarefa: "prova de física sexta" });
  assert.equal(chatActionFromPrompt("me lembra de estudar isso amanhã às 19h")?.tarefa, "estudar amanhã às 19h");
  assert.equal(chatActionFromPrompt("anota na minha agenda: trabalho de história dia 25")?.tarefa, "trabalho de história dia 25");
  assert.equal(kind("salva isso na agenda pra amanhã"), "agenda");
});

test("duelo, atividade, redação e leitura", () => {
  assert.deepEqual(chatActionFromPrompt("cria um duelo sobre isso"), { kind: "duelo", topic: "", refersBack: true });
  assert.equal(chatActionFromPrompt("bora um duelo de Revolução Francesa")?.topic, "Revolução Francesa");
  assert.equal(chatActionFromPrompt("me desafia num duelo contra a Mine sobre frações")?.topic, "Frações");
  assert.equal(chatActionFromPrompt("faz uma atividade sobre células")?.topic, "Células");
  assert.equal(kind("monta uma atividade disso"), "atividade");
  assert.equal(chatActionFromPrompt("quero treinar uma redação sobre o uso de celulares nas escolas")?.topic, "O uso de celulares nas escolas");
  assert.equal(kind("abre a redação"), "redacao");
  assert.deepEqual(chatActionFromPrompt("manda esse texto pra leitura"), { kind: "leitura", topic: "", refersBack: true });
  assert.equal(kind("quero treinar leitura com isso"), "leitura");
  assert.deepEqual(chatActionFromPrompt("abre a aba de vídeos sobre Revolução Francesa"), { kind: "videos", topic: "Revolução Francesa", refersBack: false });
  assert.deepEqual(chatActionFromPrompt("leva isso pra aba de vídeos"), { kind: "videos", topic: "", refersBack: true });
  assert.equal(chatActionFromPrompt("abre videoaulas sobre logaritmo")?.topic, "Logaritmo");
});

test("conversa normal continua conversa", () => {
  for (const frase of [
    "como eu salvo um arquivo no python?",
    "me lembra a fórmula de Bhaskara",
    "me lembra o que é mitose",
    "o que é um duelo de titãs na mitologia?",
    "quero saber como funciona o duelo",
    "faz uma redação sobre meio ambiente",
    "a leitura de hoje foi difícil",
    "salva",
    "faz uma atividade física comigo",
    "explica a atividade 3 da lição",
    "tenho que salvar o planeta?",
    "me recomenda vídeos sobre fotossíntese",
    "quais vídeos do youtube explicam matrizes?",
  ]) {
    assert.equal(chatActionFromPrompt(frase), null, frase);
  }
});

test("resposta da Mine vira texto corrido para a Leitura", () => {
  const texto = plainTextFromReply("## Fotossíntese\n\nA **luz** vira energia.\n\n- etapa clara\n- etapa escura\n\n[[foto: folha]]\n\n```python\nprint(1)\n```");
  assert.equal(texto, "Fotossíntese\n\nA luz vira energia.\n\n• etapa clara\n• etapa escura");
});
