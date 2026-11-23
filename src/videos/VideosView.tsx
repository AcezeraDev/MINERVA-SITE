/**
 * Aba Vídeos (#/videos, 23/nov/2026): videoaulas do YouTube que tocam aqui
 * mesmo. Dois caminhos:
 *
 * - Escolher: matéria → tópico (Matemática → Teorema de Pitágoras) monta uma
 *   série de vídeos (aula, exemplos, exercícios, revisão) com os outros
 *   tópicos da matéria como botões para trocar.
 * - Pedir à Mine: frase livre ("quero entender Pitágoras com exemplos de
 *   obra") → a Mine devolve os termos de busca e a série sai do mesmo jeito.
 *
 * Os vídeos vêm da busca do próprio YouTube (/api/videos, mine/estante.mjs):
 * a Mine nunca inventa link. O player é o mesmo do bloco ```videos do chat.
 */
import { Loader2, Search, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { SerieDeVideos, lerVideos } from "../chat/blocos/Videos";
import { askMineTask } from "../mineTask";
import "./videos-aba.css";

type Materia = { nome: string; topicos: string[] };

const MATERIAS: Materia[] = [
  { nome: "Matemática", topicos: ["Teorema de Pitágoras", "Função do 1º grau", "Função do 2º grau", "Porcentagem", "Razão e proporção", "Equação do 2º grau", "Trigonometria no triângulo retângulo", "Progressão aritmética", "Progressão geométrica", "Logaritmo", "Probabilidade", "Análise combinatória", "Estatística: média, moda e mediana", "Geometria espacial", "Matrizes"] },
  { nome: "Física", topicos: ["Movimento uniforme", "MUV", "Leis de Newton", "Energia mecânica", "Trabalho e potência", "Quantidade de movimento", "Gravitação", "Termologia", "Óptica geométrica", "Ondulatória", "Eletrostática", "Circuitos elétricos", "Eletromagnetismo"] },
  { nome: "Química", topicos: ["Modelos atômicos", "Tabela periódica", "Ligações químicas", "Funções inorgânicas", "Estequiometria", "Soluções", "Termoquímica", "Cinética química", "Equilíbrio químico", "Eletroquímica", "Química orgânica: funções", "Isomeria"] },
  { nome: "Biologia", topicos: ["Citologia", "Divisão celular", "Genética: 1ª Lei de Mendel", "DNA e síntese de proteínas", "Evolução", "Ecologia", "Fotossíntese e respiração", "Sistema imunológico", "Fisiologia humana", "Botânica", "Vírus e bactérias"] },
  { nome: "História", topicos: ["Grécia Antiga", "Roma Antiga", "Idade Média", "Revolução Francesa", "Revolução Industrial", "Brasil Colônia", "Independência do Brasil", "Era Vargas", "Ditadura militar no Brasil", "Primeira Guerra Mundial", "Segunda Guerra Mundial", "Guerra Fria"] },
  { nome: "Geografia", topicos: ["Cartografia", "Climas do Brasil", "Biomas brasileiros", "Relevo e solos", "Urbanização", "Globalização", "Geopolítica", "Questão agrária", "Fontes de energia", "Demografia"] },
  { nome: "Português", topicos: ["Interpretação de texto", "Figuras de linguagem", "Funções da linguagem", "Classes de palavras", "Concordância verbal", "Regência", "Crase", "Pontuação", "Gêneros textuais", "Variação linguística"] },
  { nome: "Literatura", topicos: ["Quinhentismo", "Barroco", "Arcadismo", "Romantismo", "Realismo e Naturalismo", "Parnasianismo", "Simbolismo", "Pré-Modernismo", "Modernismo", "Machado de Assis"] },
  { nome: "Redação", topicos: ["Redação ENEM: estrutura", "Introdução nota 1000", "Repertório sociocultural", "Proposta de intervenção", "Competências do ENEM", "Conectivos"] },
  { nome: "Inglês", topicos: ["Simple present", "Simple past", "Present perfect", "Modal verbs", "Interpretação de texto em inglês", "Falsos cognatos"] },
  { nome: "Filosofia", topicos: ["Pré-socráticos", "Sócrates, Platão e Aristóteles", "Iluminismo", "Contratualistas", "Kant", "Existencialismo"] },
  { nome: "Sociologia", topicos: ["Durkheim", "Max Weber", "Karl Marx", "Cultura e identidade", "Movimentos sociais", "Cidadania e direitos"] },
];

/** Uma série por tópico: entender, ver exemplo, praticar e revisar. */
function seriePorTopico(topico: string, materia: Materia) {
  return {
    titulo: topico,
    pedidos: [
      { busca: `${topico} aula explicação`, sobre: "A explicação" },
      { busca: `${topico} exemplos`, sobre: "Exemplos" },
      { busca: `${topico} exercícios resolvidos`, sobre: "Exercícios resolvidos" },
      { busca: `${topico} resumo ENEM`, sobre: "Revisão rápida" },
    ],
    temas: materia.topicos.filter((t) => t !== topico).slice(0, 6),
  };
}

type Serie = NonNullable<ReturnType<typeof lerVideos>>;

export function VideosView() {
  const [materia, setMateria] = useState<Materia>(MATERIAS[0]);
  const [serie, setSerie] = useState<Serie | null>(null);
  const [pedido, setPedido] = useState("");
  const [pensando, setPensando] = useState(false);
  const [aviso, setAviso] = useState("");

  async function pedirMine(event: FormEvent) {
    event.preventDefault();
    const texto = pedido.trim();
    if (texto.length < 3 || pensando) return;
    setPensando(true);
    setAviso("");
    try {
      const reply = await askMineTask({
        task: "materia-extra",
        prompt: `O estudante quer videoaulas do YouTube. Pedido dele: "${texto.slice(0, 300)}".
Monte uma serie de 3 a 5 videos em ordem de estudo (primeiro entender, depois exemplos, depois exercicios). Voce NAO sabe links: para cada video escreva so o termo de busca no YouTube, em portugues, de 3 a 7 palavras, especifico e no nivel do ensino medio/ENEM, nunca infantil (ex.: "teorema de pitagoras exercicios resolvidos", "fotossintese aula ensino medio"). Em "temas" ponha de 3 a 6 assuntos vizinhos que o estudante pode querer ver depois. Se o pedido for amplo (so a materia), escolha o tema mais importante e ponha os outros em "temas".
Formato: {"titulo":"nome curto do tema","videos":[{"busca":"termo de busca","sobre":"o que esse video ensina, ate 6 palavras"}],"temas":["tema"]}`,
        context: `Pedido de videos. Materia aberta na aba: ${materia.nome}.`,
        outputTokens: 700,
      });
      const json = reply.slice(reply.indexOf("{"), reply.lastIndexOf("}") + 1);
      const lido = lerVideos(JSON.parse(json));
      if (!lido) throw new Error("A Mine não montou a lista agora. Tente de novo.");
      setSerie(lido);
    } catch (error) {
      setAviso(error instanceof Error && !/JSON|Unexpected/.test(error.message) ? error.message : "A Mine não montou a lista agora. Tente de novo.");
    } finally {
      setPensando(false);
    }
  }

  return (
    <div className="vid-aba">
      <header className="vid-aba__topo">
        <p className="caderno-note">vídeos da minerva</p>
        <h1>
          Videoaulas para <span className="caderno-hl">assistir aqui</span>
        </h1>
        <p>Escolha a matéria e o tópico, ou peça para a Mine montar uma série. Os vídeos tocam aqui mesmo, sem sair do site.</p>
      </header>

      <form className="vid-aba__pedir" onSubmit={pedirMine}>
        <Sparkles aria-hidden className="vid-aba__pedir-icone" />
        <input
          value={pedido}
          onChange={(event) => setPedido(event.target.value)}
          placeholder="Peça à Mine: “quero entender o teorema de Pitágoras com exemplos”"
          aria-label="Pedir vídeos à Mine"
          maxLength={300}
        />
        <button type="submit" disabled={pensando || pedido.trim().length < 3}>
          {pensando ? <Loader2 className="vid-aba__giro" aria-hidden /> : <Search aria-hidden />}
          {pensando ? "Montando…" : "Recomendar"}
        </button>
      </form>
      {aviso ? (
        <p className="vid-aba__aviso" role="alert">
          {aviso}
        </p>
      ) : null}

      <div className="vid-aba__grade">
        <nav className="vid-aba__escolha" aria-label="Escolher matéria e tópico">
          <div className="vid-aba__materias" role="tablist" aria-label="Matérias">
            {MATERIAS.map((m) => (
              <button key={m.nome} type="button" role="tab" aria-selected={m === materia} className={m === materia ? "is-on" : ""} onClick={() => setMateria(m)}>
                {m.nome}
              </button>
            ))}
          </div>
          <ul className="vid-aba__topicos" aria-label={`Tópicos de ${materia.nome}`}>
            {materia.topicos.map((t) => (
              <li key={t}>
                <button type="button" className={serie?.titulo === t ? "is-on" : ""} onClick={() => setSerie(seriePorTopico(t, materia))}>
                  {t}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="vid-aba__player">
          {serie ? (
            <SerieDeVideos key={serie.pedidos.map((p) => p.busca).join("|")} {...serie} />
          ) : (
            <div className="vid-aba__vazio">
              <strong>Escolha um tópico</strong>
              <span>Ex.: Matemática → Teorema de Pitágoras. A Mine separa uma série: explicação, exemplos, exercícios e revisão.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
