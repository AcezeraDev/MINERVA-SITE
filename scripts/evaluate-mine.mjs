// Avaliacao opcional com respostas reais. Nao roda em npm test nem usa dados de uma conta.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseBlocks } from "../shared/chat-markdown.mjs";
import { matchesSourceScope } from "../mine/web.mjs";
import { gameXpFromCorrectAnswers } from "../shared/xp.mjs";

function option(name, fallback) { const index = process.argv.indexOf(name); return index < 0 ? fallback : process.argv[index + 1]; }
const endpoint = option("--endpoint", "http://127.0.0.1:5187/api/mine/chat");
const output = resolve(option("--output", ".codex-tmp-mine-audit-20260929/after-local.json"));
const only = option("--only", "").split(",").filter(Boolean);
const context = "Usuário: Estudante fictício de teste\nMatéria selecionada: contexto geral do site\nConteúdos: nenhum\nTarefas: nenhuma";
const cases = [
  { id: "ingles", prompt: "Estou estudando inglês. Escreva 3 frases em inglês no simple past e traduza cada uma para português.", check: r => (r.reply.match(/\b(?:I|She|He|We|They|You)\s+[a-z]+/g) || []).length >= 3 },
  { id: "codigo", prompt: "Escreva apenas um bloco de código Python completo com uma função que soma dois números. Sem explicações.", check: r => parseBlocks(r.reply).some(b => b.type === "code" && b.lang === "python" && /\n\s+return/.test(b.code)) },
  { id: "texto-longo", prompt: "Texto sem dados para teste de leitura. ".repeat(175) + "\nDADO FINAL IMPORTANTE: o código fictício da atividade é LARANJA-37. Responda somente qual é o código da atividade.", check: r => r.reply.includes("LARANJA-37") },
  { id: "xp", prompt: "Quantos XP ganho nos Games da Minerva se acertar 3 questões e terminar a partida?", check: r => new RegExp(`\\b${gameXpFromCorrectAnswers(3)}\\s*(?:\\*\\*)?\\s*XP`, "i").test(r.reply) },
  { id: "traducao", prompt: 'Como se escreve "eu fui à escola ontem" em inglês? Preciso da frase em inglês para estudar.', check: r => /I went to school yesterday/i.test(r.reply) && !r.sources.length },
  { id: "acao-local", prompt: "Crie uma matéria chamada Química na minha conta agora e me confirme quando estiver salva.", check: r => !r.sources.length && /(?:Nova|Criar) mat[eé]ria/i.test(r.reply) && /(?:n[aã]o (?:posso|consigo|crio|tenho)|n[aã]o.*(?:criada|salva)|voc[eê].*(?:criar|crie))/i.test(r.reply) },
  { id: "fonte-oficial", prompt: "Pesquise na internet quais são as datas oficiais das provas do Enem 2026. Use o Inep como fonte e forneça o link.", webSearch: true, check: r => r.sources.length > 0 && r.sources.every(s => matchesSourceScope(s.url, ["gov.br/inep", "inep.gov.br"])) && /https:\/\//.test(r.reply) },
  { id: "cargo-atual", prompt: "Quem é o presidente dos Estados Unidos?", check: r => r.sources.length > 0 && /\[\d+\]/.test(r.reply) },
  { id: "matematica", prompt: "Calcule 1/2 + 1/3 e explique em no máximo 3 linhas.", check: r => /(?:5\s*\/\s*6|frac\{5\}\{6\})/.test(r.reply) },
  { id: "tutor", prompt: "Resolva 2x + 3 = 11.", tutor: true, check: r => /\?/.test(r.reply) && !/(?:x\s*=\s*4|resposta.{0,20}\b4\b)/i.test(r.reply) },
  { id: "memoria", prompt: "Qual era minha dificuldade e qual matéria quero estudar?", history: [{role:"user",text:"Quero estudar matemática. Minha dificuldade é dividir frações."},{role:"assistant",text:"Vamos começar com divisão de frações."},{role:"user",text:"Antes, me explique o que é uma célula."},{role:"assistant",text:"Célula é a unidade básica dos seres vivos."}], check: r => /matem[aá]tica/i.test(r.reply) && /fra[cç][oõ]es/i.test(r.reply) },
  { id: "codigo-stream", prompt: "Escreva apenas um bloco de código Python completo com uma função que soma dois números. Sem explicações.", stream: true, check: r => parseBlocks(r.reply).some(b => b.type === "code" && b.lang === "python" && /\n\s+return/.test(b.code)) },
];
const records = [];
await mkdir(resolve(output, ".."), {recursive:true});
for (const item of cases.filter(c => !only.length || only.includes(c.id))) {
  const {check,id,...input} = item;
  const payload = {context,history:[],maxOutputTokens:1500,...input};
  const started = Date.now();
  let record;
  try {
    const response = await fetch(endpoint, {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(65000)});
    const raw = await response.text();
    let body;
    if (input.stream && response.ok) {
      const events = raw.split("\n").filter(line => line.startsWith("data: ")).map(line => JSON.parse(line.slice(6)));
      body = events.find(event => event.type === "done");
      if (!body) throw new Error(events.find(event => event.type === "error")?.error || "Streaming sem conclusão");
    } else body = JSON.parse(raw);
    record = {id,status:response.status,passed:response.ok && check(body),durationMs:Date.now()-started,payload,body};
  } catch (error) {record={id,passed:false,durationMs:Date.now()-started,payload,error:error.message};}
  records.push(record);
  await writeFile(output, JSON.stringify({endpoint,records},null,2));
  console.log(JSON.stringify({id,passed:record.passed,status:record.status,ms:record.durationMs,reply:record.body?.reply,notice:record.body?.notice,sources:record.body?.sources,error:record.error}));
  if (id !== cases.filter(c => !only.length || only.includes(c.id)).at(-1)?.id) await new Promise(resolve => setTimeout(resolve,8000));
}
const failed = records.filter(r => !r.passed).map(r => r.id);
console.log(JSON.stringify({passed:records.length-failed.length,total:records.length,failed,output}));
if (failed.length) process.exitCode=1;
