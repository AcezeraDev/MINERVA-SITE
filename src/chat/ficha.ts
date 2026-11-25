/*
 * Ficha da Mine (25/nov/2026, da pesquisa com as outras IAs).
 *
 * Quatro coisas que o estudante (ou a família) ajusta e que mudam o chat:
 *  - perfil: "O que a Mine sabe de mim" — vai junto de cada pergunta
 *    (aluno.perfil) e o servidor transforma em instrução (buildProfileInstruction);
 *  - horario: Horário de estudo — o Modo tutor liga sozinho nessas horas;
 *  - familia: Modo família — tutor sempre ligado e horário de descanso, com
 *    um PIN para mudar; a família não vê as conversas;
 *  - revisoes: Revisão que volta — assuntos conversados voltam em 1, 3, 7,
 *    14 e 30 dias como duas perguntas rápidas.
 *
 * Mora no aparelho (localStorage), como o caderno de erros: é preferência de
 * uso e não precisa ir para o banco inteiro a cada mudança.
 */

export type Perfil = {
  nome: string;
  serie: string;
  aprendo: string;
  dificeis: string;
  fortes: string;
  objetivo: string;
  sobre: string;
  preferencias: string[];
};

export type Janela = { ativo: boolean; inicio: string; fim: string; dias: number[] };

export type Familia = {
  pin: string; // hash do PIN; vazio = modo família desligado
  tutorSempre: boolean;
  descanso: Janela;
};

export type Revisao = { titulo: string; nivel: number; proxima: number; criadaEm: number };

export type Ficha = {
  perfil: Perfil;
  horario: Janela;
  familia: Familia;
  revisoes: Record<string, Revisao>;
};

const PERFIL_VAZIO: Perfil = { nome: "", serie: "", aprendo: "", dificeis: "", fortes: "", objetivo: "", sobre: "", preferencias: [] };
const DIAS_UTEIS = [1, 2, 3, 4, 5];

export function fichaVazia(): Ficha {
  return {
    perfil: { ...PERFIL_VAZIO },
    horario: { ativo: false, inicio: "19:00", fim: "21:00", dias: DIAS_UTEIS },
    familia: { pin: "", tutorSempre: false, descanso: { ativo: false, inicio: "22:30", fim: "06:00", dias: [0, 1, 2, 3, 4, 5, 6] } },
    revisoes: {},
  };
}

const chave = (userId: string) => `minerva:mine-ficha:${userId}`;

export function lerFicha(userId: string): Ficha {
  const base = fichaVazia();
  try {
    const raw = window.localStorage.getItem(chave(userId));
    if (!raw) return base;
    const salvo = JSON.parse(raw) as Partial<Ficha>;
    return {
      perfil: { ...base.perfil, ...(salvo.perfil || {}), preferencias: Array.isArray(salvo.perfil?.preferencias) ? salvo.perfil!.preferencias.slice(-8) : [] },
      horario: { ...base.horario, ...(salvo.horario || {}) },
      familia: { ...base.familia, ...(salvo.familia || {}), descanso: { ...base.familia.descanso, ...(salvo.familia?.descanso || {}) } },
      revisoes: salvo.revisoes && typeof salvo.revisoes === "object" ? salvo.revisoes : {},
    };
  } catch {
    return base;
  }
}

export function gravarFicha(userId: string, ficha: Ficha) {
  try {
    window.localStorage.setItem(chave(userId), JSON.stringify(ficha));
  } catch {
    // Sem armazenamento: vale só nesta visita.
  }
  window.dispatchEvent(new CustomEvent("mine:ficha", { detail: { userId } }));
}

export function mudarFicha(userId: string, mudar: (ficha: Ficha) => Ficha) {
  gravarFicha(userId, mudar(lerFicha(userId)));
}

/** "Entendi melhor esse" do bloco dois-jeitos. */
export function anotarPreferencia(userId: string, preferencia: string) {
  mudarFicha(userId, (ficha) => ({
    ...ficha,
    perfil: { ...ficha.perfil, preferencias: [...ficha.perfil.preferencias.filter((item) => item !== preferencia), preferencia].slice(-8) },
  }));
}

/** Perfil só com o que foi preenchido, para ir junto da pergunta. */
export function perfilParaEnviar(userId: string) {
  const { perfil } = lerFicha(userId);
  const temAlgo = Object.entries(perfil).some(([, valor]) => (Array.isArray(valor) ? valor.length : String(valor).trim()));
  return temAlgo ? perfil : null;
}

// ── horários ────────────────────────────────────────────────────────────────

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

/** A janela vale agora? Atravessa a meia-noite quando o fim é antes do início. */
export function dentroDaJanela(janela: Janela, agora = new Date()) {
  if (!janela.ativo) return false;
  const atual = agora.getHours() * 60 + agora.getMinutes();
  const ini = minutos(janela.inicio);
  const fim = minutos(janela.fim);
  if (ini === fim) return false;
  const dia = agora.getDay();
  if (ini < fim) return janela.dias.includes(dia) && atual >= ini && atual < fim;
  // Janela da noite (22:30 às 06:00): conta o dia em que começou.
  if (atual >= ini) return janela.dias.includes(dia);
  return janela.dias.includes((dia + 6) % 7) && atual < fim;
}

// ── PIN da família ──────────────────────────────────────────────────────────

export async function hashPin(pin: string) {
  const dados = new TextEncoder().encode(`minerva-familia:${pin}`);
  try {
    const digest = await crypto.subtle.digest("SHA-256", dados);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Sem crypto.subtle (página fora de https): um hash simples, só para não guardar o PIN cru.
    let h = 0;
    for (const byte of dados) h = (h * 31 + byte) | 0;
    return `s${Math.abs(h).toString(36)}`;
  }
}

// ── revisão que volta ───────────────────────────────────────────────────────

const DIA = 86_400_000;
export const INTERVALOS = [1, 3, 7, 14, 30];

/** Assunto novo conversado hoje: volta amanhã. Assunto já guardado fica como está. */
export function agendarRevisao(userId: string, id: string, titulo: string, agora = Date.now()) {
  if (!titulo.trim()) return;
  mudarFicha(userId, (ficha) => {
    if (ficha.revisoes[id]) return { ...ficha, revisoes: { ...ficha.revisoes, [id]: { ...ficha.revisoes[id], titulo } } };
    const revisoes = { ...ficha.revisoes, [id]: { titulo, nivel: 0, proxima: agora + INTERVALOS[0] * DIA, criadaEm: agora } };
    // Guarda os 60 mais recentes.
    const ordenadas = Object.entries(revisoes).sort((a, b) => b[1].criadaEm - a[1].criadaEm).slice(0, 60);
    return { ...ficha, revisoes: Object.fromEntries(ordenadas) };
  });
}

/** Revisou (ou disse que já sabe): o próximo encontro fica mais longe. */
export function avancarRevisao(userId: string, id: string, pulos = 1, agora = Date.now()) {
  mudarFicha(userId, (ficha) => {
    const atual = ficha.revisoes[id];
    if (!atual) return ficha;
    const nivel = atual.nivel + pulos;
    if (nivel >= INTERVALOS.length) {
      const { [id]: _feita, ...resto } = ficha.revisoes;
      return { ...ficha, revisoes: resto };
    }
    return { ...ficha, revisoes: { ...ficha.revisoes, [id]: { ...atual, nivel, proxima: agora + INTERVALOS[nivel] * DIA } } };
  });
}

export function revisoesVencidas(ficha: Ficha, agora = Date.now()) {
  return Object.entries(ficha.revisoes)
    .filter(([, item]) => item.proxima <= agora)
    .sort((a, b) => a[1].proxima - b[1].proxima)
    .map(([id, item]) => ({ id, ...item }));
}

// ── lição de casa copiada ───────────────────────────────────────────────────

const LICAO = /\b(resolv[ae]|respond[ae]|calcul[ae]|fa[çc]a (?:a|as|essa|essas) (?:quest|atividade|li[çc][ãa]o|tarefa)|faz (?:a|as|essa|essas|pra mim)|(?:quest[ãa]o|exerc[íi]cio|atividade)\s*\d+|gabarito|me d[áa] (?:a|as) respostas?|resposta (?:da|das) (?:quest|atividade))/i;

/** Pedido com cara de "faz a lição para mim" (texto ou foto de atividade). */
export function pareceLicao(texto: string, temFoto: boolean) {
  const t = texto.trim();
  if (LICAO.test(t)) return true;
  return temFoto && /^(?:faz|resolve|responde|me ajuda com (?:essa|esta) (?:atividade|li[çc][ãa]o|tarefa))\b/i.test(t);
}
