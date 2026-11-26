/**
 * "Ouvir" do leitor de livros e da aba Leitura (nov/2026): a voz do próprio
 * navegador (Web Speech) lê os parágrafos um por um, e quem chama sabe qual
 * parágrafo está sendo lido para destacar na tela.
 *
 * Cada parágrafo vira falas de até ~220 caracteres: o Chrome corta falas
 * longas no meio (por volta de 15 s) e não avisa.
 */

export function vozDisponivel(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

function escolherVoz(idioma: string): SpeechSynthesisVoice | undefined {
  const vozes = window.speechSynthesis.getVoices();
  const base = idioma.slice(0, 2).toLowerCase();
  const doIdioma = vozes.filter((voz) => voz.lang.toLowerCase().replace("_", "-").startsWith(base));
  // pt-BR antes de pt-PT; vozes "naturais"/online soam melhor que as locais antigas.
  const exata = doIdioma.filter((voz) => voz.lang.toLowerCase().replace("_", "-") === idioma.toLowerCase());
  const lista = exata.length ? exata : doIdioma;
  return lista.find((voz) => /natural|online|neural/i.test(voz.name)) || lista.find((voz) => voz.localService === false) || lista[0];
}

function falas(texto: string): string[] {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= 220) return limpo ? [limpo] : [];
  const saida: string[] = [];
  let atual = "";
  for (const frase of limpo.split(/(?<=[.!?;:…])\s+/)) {
    if (atual && atual.length + frase.length > 220) {
      saida.push(atual);
      atual = "";
    }
    // Frase enorme sem pontuação: parte entre palavras.
    if (frase.length > 260) {
      const palavras = frase.split(" ");
      for (const palavra of palavras) {
        if (atual.length + palavra.length > 220) {
          saida.push(atual);
          atual = "";
        }
        atual += `${atual ? " " : ""}${palavra}`;
      }
      continue;
    }
    atual += `${atual ? " " : ""}${frase}`;
  }
  if (atual) saida.push(atual);
  return saida;
}

export type Leitura = { parar: () => void };

/**
 * Lê `paragrafos` em sequência. `aoParagrafo(i)` avisa qual está sendo lido;
 * `aoAcabar(completo)` vem no fim (completo = leu tudo, sem parar no meio).
 */
export function lerEmVoz(
  paragrafos: string[],
  { idioma = "pt-BR", velocidade = 1, aoParagrafo, aoAcabar }: { idioma?: string; velocidade?: number; aoParagrafo?: (indice: number) => void; aoAcabar?: (completo: boolean) => void } = {},
): Leitura {
  const sintese = window.speechSynthesis;
  sintese.cancel();
  let parado = false;
  const fila = paragrafos.flatMap((texto, indice) => falas(texto).map((fala) => ({ fala, indice })));
  let posicao = 0;
  let paragrafoAtual = -1;
  const voz = escolherVoz(idioma);

  const proxima = () => {
    if (parado) return;
    if (posicao >= fila.length) {
      aoAcabar?.(true);
      return;
    }
    const { fala, indice } = fila[posicao];
    posicao += 1;
    if (indice !== paragrafoAtual) {
      paragrafoAtual = indice;
      aoParagrafo?.(indice);
    }
    const utterance = new SpeechSynthesisUtterance(fala);
    utterance.lang = voz?.lang || idioma;
    if (voz) utterance.voice = voz;
    utterance.rate = velocidade;
    utterance.onend = proxima;
    utterance.onerror = (evento) => {
      // "interrupted"/"canceled" vêm do próprio parar(): não é erro de verdade.
      if (parado || evento.error === "interrupted" || evento.error === "canceled") return;
      proxima();
    };
    sintese.speak(utterance);
  };

  // As vozes chegam depois no Chrome: a primeira fala espera a lista existir.
  if (!sintese.getVoices().length) {
    let comecou = false;
    const comecar = () => {
      if (comecou) return;
      comecou = true;
      proxima();
    };
    sintese.addEventListener("voiceschanged", comecar, { once: true });
    window.setTimeout(comecar, 600);
  } else proxima();

  return {
    parar: () => {
      if (parado) return;
      parado = true;
      sintese.cancel();
      aoAcabar?.(false);
    },
  };
}
