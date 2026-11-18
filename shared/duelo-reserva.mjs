/**
 * Reserva do Duelo: perguntas prontas para quando a Mine não responde (queda
 * do provedor, cota, ou o servidor local sem chave). O duelo sai mesmo assim,
 * com conhecimentos gerais do ensino médio, e a tela avisa que veio da reserva.
 */
const reserva = [
  ["Qual organela é responsável pela respiração celular?", ["Ribossomo", "Mitocôndria", "Lisossomo", "Complexo de Golgi"], 1, "A mitocôndria produz ATP a partir da glicose e do oxigênio."],
  ["Em que ano foi proclamada a República no Brasil?", ["1822", "1888", "1889", "1930"], 2, "A República foi proclamada em 15 de novembro de 1889."],
  ["Qual é a fórmula da água?", ["H2O2", "HO", "H2O", "OH2"], 2, "Dois átomos de hidrogênio ligados a um de oxigênio."],
  ["Quanto vale 2 elevado a 5?", ["10", "25", "32", "64"], 2, "2 × 2 × 2 × 2 × 2 = 32."],
  ["Qual figura de linguagem compara usando 'como'?", ["Metáfora", "Comparação", "Hipérbole", "Ironia"], 1, "A comparação (símile) usa um conectivo como 'como'."],
  ["A 2ª Lei de Newton diz que a força resultante é igual a…", ["massa × velocidade", "massa × aceleração", "peso ÷ massa", "energia × tempo"], 1, "F = m · a."],
  ["Qual é o maior bioma brasileiro?", ["Cerrado", "Caatinga", "Amazônia", "Mata Atlântica"], 2, "A Amazônia ocupa quase metade do território nacional."],
  ["Quem escreveu 'Dom Casmurro'?", ["José de Alencar", "Machado de Assis", "Aluísio Azevedo", "Graciliano Ramos"], 1, "Machado de Assis publicou Dom Casmurro em 1899."],
  ["Qual gás as plantas absorvem na fotossíntese?", ["Oxigênio", "Nitrogênio", "Gás carbônico", "Hidrogênio"], 2, "As plantas usam CO2 e luz para produzir glicose."],
  ["Quanto é a soma dos ângulos internos de um triângulo?", ["90°", "180°", "270°", "360°"], 1, "Todo triângulo tem ângulos internos somando 180°."],
  ["Qual é a unidade de resistência elétrica?", ["Volt", "Ampère", "Ohm", "Watt"], 2, "A resistência se mede em ohms (Ω)."],
  ["Qual filósofo disse 'Só sei que nada sei'?", ["Platão", "Aristóteles", "Sócrates", "Descartes"], 2, "A frase é atribuída a Sócrates."],
  ["Qual é o pH de uma solução neutra a 25 °C?", ["0", "5", "7", "14"], 2, "pH 7 é neutro; abaixo é ácido e acima é básico."],
  ["Qual ODS da ONU trata de 'Educação de qualidade'?", ["ODS 1", "ODS 4", "ODS 10", "ODS 13"], 1, "O ODS 4 é Educação de Qualidade."],
  ["Qual é a raiz quadrada de 144?", ["11", "12", "14", "16"], 1, "12 × 12 = 144."],
  ["'She ___ to school every day.' Qual completa certo?", ["go", "goes", "going", "gone"], 1, "Na 3ª pessoa do singular do presente simples, o verbo leva -s: goes."],
  ["Qual movimento da Terra causa o dia e a noite?", ["Translação", "Rotação", "Precessão", "Nutação"], 1, "A rotação da Terra em torno do próprio eixo dura cerca de 24 horas."],
  ["Qual é o sujeito em 'Choveu muito ontem'?", ["Simples", "Composto", "Oculto", "Inexistente"], 3, "Verbos de fenômeno da natureza formam oração sem sujeito."],
];

export function perguntasDaReserva(quantas = 5, aleatorio = Math.random) {
  const embaralhada = reserva.map((item) => ({ item, chave: aleatorio() })).sort((a, b) => a.chave - b.chave);
  return embaralhada.slice(0, quantas).map(({ item: [pergunta, alternativas, correta, explicacao] }) => ({ pergunta, alternativas, correta, explicacao }));
}
