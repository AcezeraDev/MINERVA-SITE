/*
 * Ações do chat da Mine: o que acontece quando o estudante pede para FAZER
 * algo no site ("salva isso em História", "me lembra de estudar amanhã",
 * "cria um duelo sobre isso"). A frase é lida em shared/chat-actions.mjs;
 * aqui ela vira mudança nos dados, um cartão na conversa e, quando for o caso,
 * a aba aberta já preenchida.
 *
 * Nada aqui chama a IA: a ação sai na hora, e o "isso" da frase é a conversa
 * aberta (a última resposta da Mine, o título da conversa ou a matéria).
 */
import { chatActionFromPrompt, plainTextFromReply, type ChatActionKind, type ChatActionRequest } from "../../shared/chat-actions.mjs";
import { parseQuickTask, startOfDay } from "../../shared/agenda.mjs";
import { materias } from "../../shared/atividades.mjs";
import { normalizeIntentText } from "../../shared/chat-intent.mjs";
import { splitMessageMedia } from "../../shared/chat-media.mjs";
import type { AppData, ChatMessage, Material, Subject } from "../main";
import type { PresetView } from "./presets";

export { chatActionFromPrompt };

/** Cartão que fica na mensagem da Mine: reabre o que a ação fez. */
export type ChatAction = {
  kind: ChatActionKind;
  titulo: string;
  detalhe: string;
  /** Aba de destino (View do main.tsx). */
  rota: "subject" | "agenda" | PresetView;
  /** Matéria, quando a rota é "subject". */
  id?: string;
  /** Preenchimento da aba, deixado de novo a cada toque no cartão. */
  preset?: Record<string, string>;
  cta: string;
};

export type PlanoAcao = {
  texto: string;
  acao?: ChatAction;
  sugestoes?: string[];
  mudar?: (draft: AppData) => AppData;
  /** Abre a aba logo depois de responder. */
  abrir?: { view: PresetView; preset: Record<string, string> };
  /** Fotos das galerias da conversa para baixar num .zip (src/chat/galleryZip.ts). */
  baixarFotos?: { nome: string; grupos: { query: string; style?: string }[] };
};

type Contexto = {
  userId: string;
  subjects: Subject[];
  materials: Material[];
  /** Matéria aberta no chat; ausente = Estudos gerais. */
  subjectId?: string;
  /** Mensagens desta conversa ANTES do pedido. */
  conversa: ChatMessage[];
  uid: (prefix: string) => string;
  now?: number;
};

const norm = (value: string) => normalizeIntentText(value).replace(/\s+/g, " ");

function acharMateria(nome: string, subjects: Subject[]) {
  const alvo = norm(nome);
  if (!alvo) return undefined;
  return (
    subjects.find((item) => norm(item.name) === alvo)
    || subjects.find((item) => alvo.includes(norm(item.name)) || norm(item.name).includes(alvo))
  );
}

function ultimaResposta(conversa: ChatMessage[]) {
  for (let index = conversa.length - 1; index >= 0; index -= 1) {
    const item = conversa[index];
    if (item.role === "mine" && item.text.trim() && !item.action) return item;
  }
  return undefined;
}

/** Do que a conversa trata: título escrito pela IA, matéria ou a última pergunta. */
function temaDaConversa(conversa: ChatMessage[], subject?: Subject) {
  const titulo = conversa.find((item) => item.threadTitle)?.threadTitle?.trim();
  if (titulo) return titulo;
  if (subject) return subject.name;
  const pergunta = [...conversa].reverse().find((item) => item.role === "user" && item.text.trim() && !chatActionFromPrompt(item.text));
  return pergunta ? pergunta.text.replace(/\s+/g, " ").replace(/[?!.]+$/, "").trim().slice(0, 80) : "";
}

function quandoTexto(dueAt: number, time: string | null, now: number) {
  const dias = Math.round((startOfDay(dueAt) - startOfDay(now)) / 86_400_000);
  const dia = dias === 0
    ? "hoje"
    : dias === 1
      ? "amanhã"
      : new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date(dueAt));
  return time ? `${dia} às ${time}` : dia;
}

function salvar(pedido: ChatActionRequest, ctx: Contexto): PlanoAcao {
  const resposta = ultimaResposta(ctx.conversa);
  if (!resposta) {
    return { texto: "Ainda não tem resposta minha nesta conversa para salvar. Me pergunte algo e depois é só pedir “salva isso”." };
  }
  const pedida = pedido.destino ? acharMateria(pedido.destino, ctx.subjects) : undefined;
  if (pedido.destino && !pedida) {
    return {
      texto: ctx.subjects.length
        ? `Não achei a matéria “${pedido.destino}”. Em qual destas eu salvo?`
        : `Não achei a matéria “${pedido.destino}”. Crie a matéria no início do site e eu salvo lá.`,
      sugestoes: ctx.subjects.slice(0, 4).map((item) => `Salva isso em ${item.name}`),
    };
  }
  const subject = pedida
    || ctx.subjects.find((item) => item.id === ctx.subjectId)
    || (ctx.subjects.length === 1 ? ctx.subjects[0] : undefined);
  if (!subject) {
    return {
      texto: ctx.subjects.length ? "Em qual matéria eu salvo esta resposta?" : "Para salvar, crie uma matéria primeiro (no início do site) e me peça de novo.",
      sugestoes: ctx.subjects.slice(0, 4).map((item) => `Salva isso em ${item.name}`),
    };
  }
  const conteudo = plainTextFromReply(resposta.text) || resposta.text.trim();
  const repetido = ctx.materials.find((item) => item.subjectId === subject.id && item.userId === ctx.userId && item.content === conteudo);
  const primeira = conteudo.split("\n").find((linha) => linha.trim())?.replace(/^[•\d.\s]+/, "").trim();
  const titulo = (repetido?.title || primeira || "Resposta da Mine").slice(0, 72);
  const acao: ChatAction = { kind: "salvar", titulo: `Salvo em ${subject.name}`, detalhe: titulo, rota: "subject", id: subject.id, cta: "Ver matéria" };
  if (repetido) return { texto: `Isso já estava salvo nos conteúdos de ${subject.name}.`, acao };
  const material: Material = {
    id: ctx.uid("material"),
    userId: ctx.userId,
    subjectId: subject.id,
    title: titulo,
    type: "note",
    detail: "Resposta salva da Mine",
    content: conteudo,
    folder: "Mine",
    studied: false,
    favorite: false,
    createdAt: ctx.now ?? Date.now(),
  };
  return {
    texto: `Pronto, salvei nos conteúdos de ${subject.name}, na pasta Mine.`,
    acao,
    mudar: (draft) => ({ ...draft, materials: [...draft.materials, material] }),
  };
}

function agenda(pedido: ChatActionRequest, ctx: Contexto): PlanoAcao {
  const now = ctx.now ?? Date.now();
  const aberta = ctx.subjects.find((item) => item.id === ctx.subjectId);
  const parsed = parseQuickTask(pedido.tarefa || "", { now, subjects: ctx.subjects });
  const tema = temaDaConversa(ctx.conversa, aberta);
  const titulo = (parsed.title || (pedido.refersBack && tema ? `Estudar ${tema}` : "")).slice(0, 120);
  if (!titulo) {
    return { texto: "O que eu coloco na agenda? Diga, por exemplo: “coloca na agenda prova de Física sexta”." };
  }
  const subjectId = parsed.subjectId || aberta?.id || ctx.subjects[0]?.id;
  if (!subjectId) return { texto: "A agenda organiza as tarefas por matéria. Crie uma matéria primeiro e me peça de novo." };
  const subject = ctx.subjects.find((item) => item.id === subjectId);
  const dueAt = parsed.dueAt ?? startOfDay(now);
  const quando = quandoTexto(dueAt, parsed.time, now);
  const tarefa = {
    id: ctx.uid("task"),
    userId: ctx.userId,
    subjectId,
    title: titulo,
    note: "Criada pelo chat da Mine",
    dueAt,
    done: false,
    createdAt: now,
    time: parsed.time || undefined,
    kind: parsed.kind || undefined,
    priority: parsed.priority || undefined,
    repeat: parsed.repeat || undefined,
  };
  return {
    texto: `Anotei na agenda: “${titulo}” para ${quando}${parsed.repeat ? (parsed.repeat === "daily" ? ", todo dia" : ", toda semana") : ""}.`,
    acao: { kind: "agenda", titulo, detalhe: `${quando}${subject ? ` · ${subject.name}` : ""}`, rota: "agenda", cta: "Ver agenda" },
    mudar: (draft) => ({ ...draft, tasks: [...draft.tasks, tarefa] }),
  };
}

function abrirAba(view: PresetView, kind: ChatActionKind, preset: Record<string, string>, texto: string, titulo: string, detalhe: string, cta: string): PlanoAcao {
  return { texto, acao: { kind, titulo, detalhe, rota: view, preset, cta }, abrir: { view, preset } };
}

/**
 * "Coloca essas fotos num zip": as galerias da última resposta da Mine que
 * tinha fotos. O download em si roda em main.tsx (precisa da rede).
 */
function fotosZip(ctx: Contexto): PlanoAcao {
  for (let index = ctx.conversa.length - 1; index >= 0; index -= 1) {
    const message = ctx.conversa[index];
    if (message.role === "user") continue;
    const grupos = splitMessageMedia(message.text || "")
      .filter((segment) => segment.type === "image")
      .map((segment) => ({ query: segment.query, ...(segment.style ? { style: segment.style } : {}) }));
    if (!grupos.length) continue;
    const nome = grupos.length === 1 ? grupos[0].query : "fotos da Mine";
    const sobre = grupos.map((grupo) => `“${grupo.query}”`).join(" e ");
    return {
      texto: `Estou juntando as fotos de ${sobre} num .zip. O download começa em instantes. Se o navegador bloquear, use o botão "Baixar todas (.zip)" embaixo da galeria.`,
      baixarFotos: { nome, grupos },
    };
  }
  return {
    texto: 'Ainda não tem fotos nesta conversa para juntar. Peça as fotos primeiro (por exemplo, "manda fotos da Segunda Guerra") e depois diga "coloca num zip".',
    sugestoes: ["Manda fotos sobre o assunto que estamos estudando"],
  };
}

/** Decide o que fazer com o pedido. Não muda nada: quem chama aplica `mudar` e abre a aba. */
export function planejarAcao(pedido: ChatActionRequest, ctx: Contexto): PlanoAcao {
  const aberta = ctx.subjects.find((item) => item.id === ctx.subjectId);
  const tema = pedido.topic || (pedido.refersBack || !pedido.topic ? temaDaConversa(ctx.conversa, aberta) : "");

  if (pedido.kind === "salvar") return salvar(pedido, ctx);
  if (pedido.kind === "agenda") return agenda(pedido, ctx);
  if (pedido.kind === "fotos-zip") return fotosZip(ctx);

  if (pedido.kind === "duelo") {
    return tema
      ? abrirAba("duelo", "duelo", { tema }, `Abri o Duelo com o tema “${tema}”. Agora é só escolher: contra a Mine ou contra um colega.`, `Duelo: ${tema}`, "tema já escrito", "Abrir duelo")
      : abrirAba("duelo", "duelo", {}, "Abri o Duelo. Escolha um tema e contra quem jogar.", "Duelo", "escolha o tema", "Abrir duelo");
  }

  if (pedido.kind === "atividade") {
    // "atividade de Biologia" é matéria; "atividade sobre células" é assunto.
    const materiaDoTema = materias.find((item) => norm(item) === norm(pedido.topic));
    const materiaAberta = aberta ? materias.find((item) => norm(item) === norm(aberta.name) || norm(aberta.name).includes(norm(item))) : undefined;
    const materia = materiaDoTema || materiaAberta || "";
    const assunto = materiaDoTema ? "" : tema && (!aberta || norm(tema) !== norm(aberta.name)) ? tema : "";
    const sobre = [materia, assunto].filter(Boolean).join(" · ");
    return abrirAba(
      "atividades",
      "atividade",
      { materia, assunto },
      sobre ? `Abri as Atividades com ${assunto ? `o assunto “${assunto}”` : `a matéria ${materia}`} já escolhido. Confira a série e toque em criar.` : "Abri as Atividades. Escolha a matéria e o assunto e eu monto a folha.",
      sobre ? `Atividade: ${sobre}` : "Atividade",
      "pronta para criar",
      "Abrir atividade",
    );
  }

  if (pedido.kind === "redacao") {
    const temaRedacao = pedido.topic || (pedido.refersBack ? tema : "");
    return temaRedacao
      ? abrirAba("redacao", "redacao", { tema: temaRedacao }, `Abri a Redação com o tema livre “${temaRedacao}”. Escreva com calma, que eu corrijo nas 5 competências do ENEM.`, `Redação: ${temaRedacao}`, "tema livre já escrito", "Abrir redação")
      : abrirAba("redacao", "redacao", {}, "Abri a Redação. Escolha um tema ou escreva o seu.", "Redação", "escolha o tema", "Abrir redação");
  }

  if (pedido.kind === "videos") {
    return tema
      ? abrirAba("videos", "videos", { tema }, `Abri a aba Vídeos com uma trilha sobre “${tema}”. Você pode assistir, resumir por minutagem e fazer o quiz lá.`, `Vídeos: ${tema}`, "trilha pronta", "Abrir vídeos")
      : abrirAba("videos", "videos", {}, "Abri a aba Vídeos. Escolha uma matéria, peça uma trilha ou cole um link do YouTube.", "Vídeos", "escolha um tema", "Abrir vídeos");
  }

  // leitura: a última resposta da Mine vira o texto
  const resposta = ultimaResposta(ctx.conversa);
  const texto = resposta ? plainTextFromReply(resposta.text) : "";
  if (!texto || texto.length < 120) {
    return abrirAba("leitura", "leitura", {}, "Abri a Leitura. Cole um texto lá e eu faço as perguntas de interpretação.", "Leitura", "cole um texto", "Abrir leitura");
  }
  const titulo = temaDaConversa(ctx.conversa, aberta).slice(0, 80);
  return abrirAba(
    "leitura",
    "leitura",
    { titulo, texto: texto.slice(0, 12_000) },
    "Levei a minha última resposta para a Leitura. Lá eu faço perguntas de interpretação sobre ela.",
    titulo ? `Leitura: ${titulo}` : "Leitura",
    "texto já colado",
    "Abrir leitura",
  );
}
