/*
 * Formatos na barra do chat (25/nov/2026): os blocos novos da Mine (vídeo-
 * resumo narrado, podcast de 4 minutos, laboratório, passo a passo...) ficam
 * à mão como botões, igual à Pesquisa aprofundada. Com um ligado, o que a
 * pessoa escreve sai como pedido daquele formato — as frases batem com os
 * gatilhos de mine/prompts.mjs (GATILHOS_BLOCOS), que mandam o formato certo
 * para o modelo. Um formato por vez, e ele desliga depois de enviar.
 *
 * Ficam atrás da barra "/" na caixa de mensagem (ideia do usuário, 25/nov):
 * "/" abre a lista, "/quiz fotossíntese" + Enter já sai como quiz.
 */
import { BookOpenCheck, Clapperboard, FlaskConical, Headphones, Layers, ListChecks, Map as MapIcon, SplitSquareHorizontal } from "lucide-react";

export type FormatoChat = "slides" | "podcast" | "simulacao" | "passos" | "dois-jeitos" | "roteiro" | "quiz" | "flashcards";

export const FORMATOS_CHAT: Array<{
  id: FormatoChat;
  /** Digitado depois da barra: /quiz, /video-resumo... */
  comando: string;
  label: string;
  icon: typeof Clapperboard;
  dica: string;
  placeholder: string;
  pedido: (assunto: string) => string;
}> = [
  {
    id: "slides",
    comando: "video-resumo",
    label: "Vídeo-resumo",
    icon: Clapperboard,
    dica: "Slides narrados pela voz da Mine",
    placeholder: "Sobre o que é o vídeo-resumo? (slides narrados)",
    pedido: (a) => `Faça um vídeo-resumo narrado em slides sobre: ${a}`,
  },
  {
    id: "podcast",
    comando: "podcast",
    label: "Podcast 4 min",
    icon: Headphones,
    dica: "Conversa de uns 4 minutos entre a Mine e o Leo, para ouvir",
    placeholder: "Tema do podcast de 4 minutos...",
    pedido: (a) => `Faça um podcast de uns 4 minutos para eu ouvir sobre: ${a}`,
  },
  {
    id: "simulacao",
    comando: "laboratorio",
    label: "Laboratório",
    icon: FlaskConical,
    dica: "Simulação com controles para mexer e ver o gráfico mudar",
    placeholder: "O que simular no laboratório? (ex.: lei de Ohm, juros)",
    pedido: (a) => `Monte um laboratório para eu mexer (simulação) sobre: ${a}`,
  },
  {
    id: "passos",
    comando: "passo-a-passo",
    label: "Passo a passo",
    icon: ListChecks,
    dica: "Resolução que se revela um passo de cada vez",
    placeholder: "Mande a conta ou o exercício para resolver passo a passo...",
    pedido: (a) => `Resolva passo a passo, revelando um passo de cada vez: ${a}`,
  },
  {
    id: "dois-jeitos",
    comando: "dois-jeitos",
    label: "Dois jeitos",
    icon: SplitSquareHorizontal,
    dica: "Duas explicações lado a lado: analogia e técnica",
    placeholder: "Que assunto explicar de dois jeitos?",
    pedido: (a) => `Explica de dois jeitos (um com analogia do dia a dia e outro mais técnico): ${a}`,
  },
  {
    id: "quiz",
    comando: "quiz",
    label: "Quiz",
    icon: BookOpenCheck,
    dica: "Perguntas para treinar agora, com explicação de cada alternativa",
    placeholder: "Quiz sobre qual assunto?",
    pedido: (a) => `Crie um quiz interativo com 5 perguntas sobre: ${a}`,
  },
  {
    id: "flashcards",
    comando: "flashcards",
    label: "Flashcards",
    icon: Layers,
    dica: "Cartões de frente e verso para memorizar",
    placeholder: "Flashcards de qual assunto?",
    pedido: (a) => `Crie flashcards para eu memorizar sobre: ${a}`,
  },
  {
    id: "roteiro",
    comando: "roteiro",
    label: "Roteiro",
    icon: MapIcon,
    dica: "Roteiro de seminário ou trabalho em grupo, em cartões",
    placeholder: "Roteiro de quê? (seminário, trabalho em grupo...)",
    pedido: (a) => `Monte um roteiro organizado em cartões para: ${a}`,
  },
];

export function formatoChat(id: FormatoChat | null) {
  return id ? FORMATOS_CHAT.find((f) => f.id === id) || null : null;
}

/** O pedido que sai com o formato ligado. Sem texto: o assunto da conversa. */
export function pedidoComFormato(id: FormatoChat | null, texto: string, temConversa: boolean) {
  const f = formatoChat(id);
  if (!f) return texto;
  const assunto = texto.trim() || (temConversa ? "o assunto da nossa conversa até aqui" : "");
  return assunto ? f.pedido(assunto) : texto;
}

/** Tira acento e caixa para comparar o que foi digitado depois da barra. */
export function normalizarComando(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
