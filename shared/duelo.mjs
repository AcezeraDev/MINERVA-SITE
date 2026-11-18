/**
 * Aba Duelo (nov/2026): quiz 1x1 contra um colega ou contra a Mine.
 *
 * Tudo que decide o jogo mora aqui, sem banco e sem relógio próprio: o
 * servidor (data-server.mjs) guarda o estado, chama `avancar` com a hora atual
 * a cada leitura e devolve `vistaDe` para quem perguntou. Como as funções da
 * Vercel não guardam memória entre pedidos, o duelo "anda" quando alguém
 * consulta: quem fica olhando a tela puxa o estado a cada segundo.
 *
 * O gabarito nunca sai do servidor antes da hora: `vistaDe` esconde a
 * alternativa certa da pergunta aberta e a escolha do adversário até a revelação.
 */

export const PERGUNTAS_POR_DUELO = 5;
export const TEMPO_PERGUNTA_MS = 20_000;
export const TEMPO_REVELACAO_MS = 4_500;
export const CONTAGEM_MS = 3_500;
/** Sala esperando adversário some depois disso. */
export const SALA_EXPIRA_MS = 15 * 60_000;
/** Ninguém consultou por esse tempo: o duelo é dado como abandonado. */
export const DUELO_PARADO_MS = 2 * 60_000;
export const MINE_ID = "mine-bot";

const letrasCodigo = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function novoCodigo(aleatorio = Math.random) {
  let codigo = "";
  for (let i = 0; i < 5; i += 1) codigo += letrasCodigo[Math.floor(aleatorio() * letrasCodigo.length)];
  return codigo;
}

export function codigoValido(valor) {
  return /^[A-HJKMNP-Z2-9]{5}$/.test(String(valor || "").toUpperCase());
}

/** Acerto vale 100 e até 50 de bônus pela rapidez. */
export function pontosDaResposta(certo, ms) {
  if (!certo) return 0;
  const fracao = Math.max(0, Math.min(1, Number(ms) / TEMPO_PERGUNTA_MS));
  return 100 + Math.round(50 * (1 - fracao));
}

/** Número estável de 0 a 1 a partir de um texto, para a Mine "pensar" sempre igual. */
function sorteioFixo(texto) {
  let h = 2166136261;
  for (const letra of String(texto)) {
    h ^= letra.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

/** Quando e o que a Mine responde na pergunta `indice`: acerta ~65%, em 4 a 13 s. */
export function jogadaDaMine(codigo, indice, correta) {
  const ms = 4_000 + Math.round(sorteioFixo(`${codigo}:${indice}:t`) * 9_000);
  const acerta = sorteioFixo(`${codigo}:${indice}:a`) < 0.65;
  const errada = (correta + 1 + Math.floor(sorteioFixo(`${codigo}:${indice}:e`) * 3)) % 4;
  return { ms, escolha: acerta ? correta : errada };
}

export function limparPerguntas(lista) {
  return (Array.isArray(lista) ? lista : [])
    .map((item) => ({
      pergunta: String(item?.question ?? item?.pergunta ?? "").trim().slice(0, 400),
      alternativas: (item?.options ?? item?.alternativas ?? []).map((alt) => String(alt).trim().slice(0, 200)),
      correta: Math.floor(Number(item?.correct ?? item?.correta)),
      explicacao: String(item?.explanation ?? item?.explicacao ?? "").trim().slice(0, 400),
    }))
    .filter((item) => item.pergunta && item.alternativas.length === 4 && item.alternativas.every(Boolean) && item.correta >= 0 && item.correta <= 3)
    .slice(0, PERGUNTAS_POR_DUELO);
}

export function criarDuelo({ codigo, tema, dono, perguntas, contraMine = false, agora = Date.now() }) {
  const jogadores = [{ id: dono.id, nome: dono.nome, pontos: 0, respostas: [] }];
  const estado = {
    codigo,
    tema: String(tema || "").slice(0, 120),
    criadoEm: agora,
    atualizadoEm: agora,
    vistoEm: { [dono.id]: agora },
    status: "sala",
    contraMine: Boolean(contraMine),
    jogadores,
    perguntas,
    atual: 0,
    inicioPergunta: 0,
    revelandoAte: 0,
    abandono: "",
  };
  if (contraMine) {
    jogadores.push({ id: MINE_ID, nome: "Mine", pontos: 0, respostas: [] });
    comecar(estado, agora);
  }
  return estado;
}

function comecar(estado, agora) {
  estado.status = "jogando";
  estado.atual = 0;
  estado.inicioPergunta = agora + CONTAGEM_MS;
  estado.revelandoAte = 0;
}

export function entrarNoDuelo(estado, jogador, agora = Date.now()) {
  if (estado.jogadores.some((item) => item.id === jogador.id)) return { ok: true };
  if (estado.status !== "sala") return { ok: false, erro: "Esse duelo já começou." };
  if (estado.jogadores.length >= 2) return { ok: false, erro: "Essa sala já está cheia." };
  estado.jogadores.push({ id: jogador.id, nome: jogador.nome, pontos: 0, respostas: [] });
  estado.vistoEm = { ...(estado.vistoEm || {}), [jogador.id]: agora };
  comecar(estado, agora);
  estado.atualizadoEm = agora;
  return { ok: true };
}

function respostaDe(jogador, indice) {
  return jogador.respostas.find((item) => item.indice === indice);
}

function registrar(estado, jogador, indice, escolha, ms) {
  const pergunta = estado.perguntas[indice];
  const certo = escolha === pergunta.correta;
  const pontos = pontosDaResposta(certo, ms);
  jogador.respostas.push({ indice, escolha, ms, certo, pontos });
  jogador.pontos += pontos;
}

export function responder(estado, jogadorId, indice, escolha, agora = Date.now()) {
  avancar(estado, agora);
  if (estado.status !== "jogando") return { ok: false, erro: "O duelo não está valendo agora." };
  if (indice !== estado.atual || estado.revelandoAte || agora < estado.inicioPergunta) return { ok: false, erro: "Essa pergunta já fechou." };
  const jogador = estado.jogadores.find((item) => item.id === jogadorId);
  if (!jogador) return { ok: false, erro: "Você não está neste duelo." };
  if (respostaDe(jogador, indice)) return { ok: false, erro: "Você já respondeu." };
  const opcao = Math.floor(Number(escolha));
  if (!(opcao >= 0 && opcao <= 3)) return { ok: false, erro: "Alternativa inválida." };
  registrar(estado, jogador, indice, opcao, Math.min(TEMPO_PERGUNTA_MS, agora - estado.inicioPergunta));
  estado.atualizadoEm = agora;
  avancar(estado, agora);
  return { ok: true };
}

/**
 * Leva o duelo até o instante `agora`: a Mine responde na hora dela, a
 * pergunta fecha quando os dois responderam ou o tempo acabou, a revelação
 * dura alguns segundos e então vem a próxima. Em laço, porque entre duas
 * consultas pode ter passado mais de uma etapa.
 */
export function avancar(estado, agora = Date.now()) {
  if (estado.status === "sala" && agora - estado.criadoEm > SALA_EXPIRA_MS) {
    estado.status = "fim";
    estado.abandono = "expirou";
    return estado;
  }
  for (let passo = 0; passo < 40 && estado.status === "jogando"; passo += 1) {
    const indice = estado.atual;
    const pergunta = estado.perguntas[indice];
    if (!estado.revelandoAte) {
      if (agora < estado.inicioPergunta) break;
      if (estado.contraMine) {
        const mine = estado.jogadores.find((item) => item.id === MINE_ID);
        const jogada = jogadaDaMine(estado.codigo, indice, pergunta.correta);
        if (mine && !respostaDe(mine, indice) && agora >= estado.inicioPergunta + jogada.ms) registrar(estado, mine, indice, jogada.escolha, jogada.ms);
      }
      const fimDoTempo = estado.inicioPergunta + TEMPO_PERGUNTA_MS;
      const todos = estado.jogadores.every((item) => respostaDe(item, indice));
      if (!todos && agora < fimDoTempo) break;
      const fechouEm = todos ? Math.max(...estado.jogadores.map((item) => estado.inicioPergunta + respostaDe(item, indice).ms)) : fimDoTempo;
      for (const jogador of estado.jogadores) {
        if (!respostaDe(jogador, indice)) jogador.respostas.push({ indice, escolha: -1, ms: TEMPO_PERGUNTA_MS, certo: false, pontos: 0 });
      }
      estado.revelandoAte = Math.min(agora, fechouEm) + TEMPO_REVELACAO_MS;
      continue;
    }
    if (agora < estado.revelandoAte) break;
    if (indice + 1 >= estado.perguntas.length) {
      estado.status = "fim";
      break;
    }
    estado.atual = indice + 1;
    estado.inicioPergunta = estado.revelandoAte;
    estado.revelandoAte = 0;
  }
  return estado;
}

/** Quem saiu (ou sumiu) perde: o outro leva a vitória. */
export function abandonar(estado, jogadorId, motivo = "saiu", agora = Date.now()) {
  if (estado.status === "fim") return;
  estado.abandono = estado.status === "sala" ? "cancelado" : motivo;
  estado.status = "fim";
  estado.quemSaiu = jogadorId;
  estado.atualizadoEm = agora;
}

/** Duelo entre duas pessoas em que uma parou de consultar há muito tempo. */
export function conferirSumico(estado, agora = Date.now()) {
  if (estado.status !== "jogando" || estado.contraMine) return;
  for (const jogador of estado.jogadores) {
    const visto = Number(estado.vistoEm?.[jogador.id]) || estado.criadoEm;
    if (agora - visto > DUELO_PARADO_MS) {
      abandonar(estado, jogador.id, "sumiu", agora);
      return;
    }
  }
}

export function resultadoDe(estado, jogadorId) {
  if (estado.status !== "fim" || estado.jogadores.length < 2) return null;
  if (estado.quemSaiu) return estado.quemSaiu === jogadorId ? "derrota" : "vitoria";
  const eu = estado.jogadores.find((item) => item.id === jogadorId);
  const outro = estado.jogadores.find((item) => item.id !== jogadorId);
  if (!eu || !outro) return null;
  if (eu.pontos === outro.pontos) return "empate";
  return eu.pontos > outro.pontos ? "vitoria" : "derrota";
}

/** O que um jogador pode ver agora. Nada de gabarito antes da hora. */
export function vistaDe(estado, jogadorId, agora = Date.now()) {
  const revelada = (indice) => estado.status === "fim" || indice < estado.atual || (indice === estado.atual && Boolean(estado.revelandoAte));
  const aberta = estado.status === "jogando" && agora >= estado.inicioPergunta;
  const perguntas = estado.perguntas.map((item, indice) => {
    const mostrar = indice < estado.atual || (indice === estado.atual && (aberta || revelada(indice))) || estado.status === "fim";
    if (!mostrar) return null;
    return {
      pergunta: item.pergunta,
      alternativas: item.alternativas,
      correta: revelada(indice) ? item.correta : -1,
      explicacao: revelada(indice) ? item.explicacao : "",
    };
  });
  return {
    codigo: estado.codigo,
    tema: estado.tema,
    status: estado.status,
    contraMine: estado.contraMine,
    abandono: estado.abandono || "",
    quemSaiu: estado.quemSaiu || "",
    atual: estado.atual,
    total: estado.perguntas.length,
    inicioPergunta: estado.inicioPergunta,
    revelandoAte: estado.revelandoAte,
    agora,
    tempoPerguntaMs: TEMPO_PERGUNTA_MS,
    euId: jogadorId,
    resultado: resultadoDe(estado, jogadorId),
    perguntas,
    jogadores: estado.jogadores.map((jogador) => ({
      id: jogador.id,
      nome: jogador.nome,
      // Só soma o que já foi revelado: o placar não pode entregar se a
      // resposta escondida do adversário estava certa.
      pontos: jogador.respostas.filter((resposta) => revelada(resposta.indice)).reduce((soma, resposta) => soma + resposta.pontos, 0),
      respondeu: Boolean(respostaDe(jogador, estado.atual)),
      eu: jogador.id === jogadorId,
      respostas: jogador.respostas.map((resposta) => {
        const mostrar = jogador.id === jogadorId || revelada(resposta.indice);
        return mostrar ? resposta : { indice: resposta.indice, escolha: -2, ms: 0, certo: false, pontos: 0 };
      }),
    })),
  };
}
