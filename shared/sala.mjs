// Sala de estudo em grupo (aba #/sala): regras puras, usadas pelo servidor
// (data-server.mjs) e pelos testes. O servidor só guarda e busca; tudo o que
// decide quem entra, quem está online e quem está na chamada mora aqui.

/** Pessoas na sala (chat) e na chamada de voz (malha direta entre navegadores). */
export const SALA_MAX_MEMBROS = 12;
export const SALA_MAX_CHAMADA = 6;
/** Sem consultar o servidor por este tempo, a pessoa aparece offline e sai da chamada. */
export const SALA_ONLINE_MS = 12_000;
export const SALA_TEXTO_MAX = 2000;
/** Foto já reduzida no navegador (≈1280 px, JPEG): teto do data URL. */
export const SALA_FOTO_MAX = 1_400_000;

const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O e 1/I

export function novoCodigoSala(aleatorio = Math.random) {
  let codigo = "";
  for (let i = 0; i < 6; i += 1) codigo += LETRAS[Math.floor(aleatorio() * LETRAS.length)];
  return codigo;
}

export function codigoSalaValido(codigo) {
  return /^[A-HJ-NP-Z2-9]{6}$/.test(String(codigo || ""));
}

export function limparNomeSala(nome) {
  const limpo = String(nome || "").replace(/\s+/g, " ").trim().slice(0, 60);
  return limpo || "Sala de estudo";
}

export function criarSala({ codigo, nome, dono, agora }) {
  return {
    codigo,
    nome: limparNomeSala(nome),
    criadoEm: agora,
    donoId: dono.id,
    mineDigitando: 0,
    membros: [novoMembro(dono, agora)],
  };
}

function novoMembro(pessoa, agora) {
  return { id: pessoa.id, nome: pessoa.nome, avatar: pessoa.avatar || "", entrouEm: agora, vistoEm: agora, naChamada: false, mudo: false, digitando: 0 };
}

export function estaOnline(membro, agora) {
  return agora - Number(membro.vistoEm || 0) < SALA_ONLINE_MS;
}

export function entrarNaSala(sala, pessoa, agora) {
  const ja = sala.membros.find((m) => m.id === pessoa.id);
  if (ja) {
    ja.nome = pessoa.nome;
    ja.avatar = pessoa.avatar || ja.avatar;
    ja.vistoEm = agora;
    return { ok: true, novo: false };
  }
  // vaga de quem sumiu há muito tempo pode ser reaproveitada
  if (sala.membros.length >= SALA_MAX_MEMBROS) {
    const sumido = sala.membros.findIndex((m) => agora - Number(m.vistoEm || 0) > 60 * 60_000);
    if (sumido < 0) return { ok: false, erro: `A sala está cheia (${SALA_MAX_MEMBROS} pessoas).` };
    sala.membros.splice(sumido, 1);
  }
  sala.membros.push(novoMembro(pessoa, agora));
  return { ok: true, novo: true };
}

export function sairDaSala(sala, id) {
  const antes = sala.membros.length;
  sala.membros = sala.membros.filter((m) => m.id !== id);
  return antes !== sala.membros.length;
}

/**
 * A consulta de cada segundo: marca a pessoa como vista e grava o que ela
 * informou (na chamada, mudo, digitando). Entrar na chamada respeita a vaga.
 */
export function tocarNaSala(sala, id, agora, { naChamada, mudo, digitando } = {}) {
  const eu = sala.membros.find((m) => m.id === id);
  if (!eu) return { ok: false, erro: "Você não está nesta sala." };
  eu.vistoEm = agora;
  if (typeof mudo === "boolean") eu.mudo = mudo;
  if (digitando) eu.digitando = agora;
  let aviso = "";
  if (typeof naChamada === "boolean") {
    if (naChamada && !eu.naChamada) {
      const naLinha = sala.membros.filter((m) => m.id !== id && m.naChamada && estaOnline(m, agora)).length;
      if (naLinha >= SALA_MAX_CHAMADA) aviso = `A chamada já tem ${SALA_MAX_CHAMADA} pessoas.`;
      else eu.naChamada = true;
    } else if (!naChamada) eu.naChamada = false;
  }
  return { ok: true, aviso };
}

/** O que cada um recebe da sala: sem dados de outros além de nome, foto e estado. */
export function vistaSala(sala, id, agora) {
  return {
    codigo: sala.codigo,
    nome: sala.nome,
    souDono: sala.donoId === id,
    mineDigitando: agora - Number(sala.mineDigitando || 0) < 90_000,
    membros: sala.membros
      .map((m) => {
        const online = estaOnline(m, agora);
        return {
          id: m.id,
          nome: m.nome,
          avatar: m.avatar || "",
          eu: m.id === id,
          online,
          naChamada: online && Boolean(m.naChamada),
          mudo: Boolean(m.mudo),
          digitando: online && agora - Number(m.digitando || 0) < 4000 && m.id !== id,
        };
      })
      .sort((a, b) => Number(b.naChamada) - Number(a.naChamada) || Number(b.online) - Number(a.online) || a.nome.localeCompare(b.nome)),
  };
}

export function limparTextoMensagem(texto) {
  return String(texto || "").replace(/\r\n?/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim().slice(0, SALA_TEXTO_MAX);
}

export function fotoValida(foto) {
  const s = String(foto || "");
  return s.length > 0 && s.length <= SALA_FOTO_MAX && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s);
}

/** A mensagem chama a Mine? "@mine", "Mine, …", "mine me ajuda". */
export function chamaMine(texto) {
  return /(^|[\s(])@mine\b/i.test(texto) || /^\s*mine\s*[,:!?]/i.test(texto) || /^\s*(ei|oi|ô|o)\s+mine\b/i.test(texto);
}

/** Conversa recente em texto para a Mine ler: "Ana: ...", "[Ana mandou uma foto]". */
export function conversaParaMine(mensagens, limite = 30) {
  return mensagens
    .slice(-limite)
    .map((m) => {
      if (m.tipo === "sistema") return `(${m.texto})`;
      const quem = m.tipo === "mine" ? "Mine" : m.autor;
      const foto = m.temFoto ? " [mandou uma foto]" : "";
      return `${quem}:${foto} ${m.texto || ""}`.trim();
    })
    .join("\n");
}
