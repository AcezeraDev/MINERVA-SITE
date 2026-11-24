/**
 * Aba Vídeos (#/videos): estúdio de videoaulas integrado ao Caderno Vivo.
 *
 * Três portas de entrada:
 * - Matérias (reais do aluno + grade ENEM) com filtro instantâneo de tópicos;
 * - Pedido livre à Mine ("quero entender estequiometria do zero");
 * - Link direto do YouTube colado na barra (aula mandada pelo professor).
 *
 * Embaixo do player, o estudante estuda ativamente com a Mine:
 * - Resumo com minutagem clicável (lendo a legenda real via /api/videos);
 * - Caderno de anotações pautado que salva direto nos conteúdos da matéria;
 * - Mini-quiz de 3 questões sobre a aula valendo XP (shared/xp.mjs).
 */
import {
  Bookmark,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  FileText,
  FolderPlus,
  HelpCircle,
  History,
  Link2,
  Loader2,
  MessageCircleQuestion,
  Play,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { celebrateFrom, cheer, floatXp, InkCheck, mineConversa, mineSays } from "../caderno";
import { BlocoInterativo, QuizResultadoContext } from "../chat/blocos/Blocos";
import {
  extrairYoutubeId,
  lerVideos,
  pedidosPorTopico,
  SerieDeVideos,
  type Achado,
  type PuloTempo,
} from "../chat/blocos/Videos";
import { MineInline } from "../chat/MineRichText";
import { usePreset } from "../chat/presets";
import { PageHeader, uid, type AppData, type Material, type Session, type Subject, type useMemoUserData, type User } from "../main";
import { mineHeaders } from "../mineAuth";
import { askMineTask } from "../mineTask";
import { startOfDay, videosPorDia, videoXp, videoXpMax, xpPerAction } from "../../shared/xp.mjs";
import "./videos-aba.css";

type MateriaCatalogo = {
  chave: string;
  nome: string;
  cor?: string;
  subjectId?: string;
  doAluno?: boolean;
  topicos: string[];
};

const MATERIAS_BASE: Array<{ nome: string; topicos: string[] }> = [
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

const CORES_MATERIA = ["#39F59A", "#5CE1E6", "#B7A5FF", "#FFB347", "#FF8FB1", "#F4F05A"];

type SerieAberta = NonNullable<ReturnType<typeof lerVideos>> & {
  materiaNome?: string;
  videosProntos?: Achado[];
};

type ItemHistorico = {
  id: string;
  titulo: string;
  materiaNome: string;
  atualizadoEm: number;
  serie: SerieAberta;
};

type FavoritoGuardado = {
  id: string;
  titulo: string;
  canal: string;
  duracao: string;
  thumb: string;
  materiaNome: string;
  salvoEm: number;
};

type VideoDetalhe = {
  ok: boolean;
  id: string;
  url: string;
  title: string;
  channel: string;
  seconds: number;
  description: string;
  transcript: string;
  language: string;
  reason: string;
};

type ResumoAula = {
  ideia: string;
  comLegenda: boolean;
  partes: Array<{ tempo: string; segundos: number; titulo: string; resumo: string }>;
  conceitos: string[];
};

type EstudoPorVideo = {
  resumo?: ResumoAula;
  quizJson?: string;
};

type AbaEstudo = "resumo" | "notas" | "quiz";

function dobrar(valor: string) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function lerLocal<T>(chave: string, padrao: T): T {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravarLocal(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem armazenamento local, funciona normalmente durante a sessão aberta.
  }
}

function formatarDuracaoSegundos(segundos: number) {
  if (!segundos || segundos <= 0) return "";
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = Math.floor(segundos % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function parseTempoParaSegundos(tempo: unknown, segundosBrutos: unknown): number {
  if (typeof segundosBrutos === "number" && Number.isFinite(segundosBrutos) && segundosBrutos >= 0) {
    return Math.floor(segundosBrutos);
  }
  const limpo = String(tempo || "").replace(/[\[\]\s]/g, "");
  const partes = limpo.split(":").map(Number);
  if (partes.length === 2 && partes.every((n) => Number.isFinite(n) && n >= 0)) return partes[0] * 60 + partes[1];
  if (partes.length === 3 && partes.every((n) => Number.isFinite(n) && n >= 0)) return partes[0] * 3600 + partes[1] * 60 + partes[2];
  return 0;
}

function lerResumoJson(bruto: string, comLegenda: boolean): ResumoAula | null {
  const inicio = bruto.indexOf("{");
  const fim = bruto.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) return null;
  try {
    const parsed = JSON.parse(bruto.slice(inicio, fim + 1)) as Record<string, unknown>;
    const ideia = String(parsed.ideia || parsed.resumo || "").trim().slice(0, 700);
    const partesBrutas = Array.isArray(parsed.partes) ? parsed.partes : [];
    const partes = comLegenda
      ? partesBrutas
          .map((item) => {
            const raw = (item || {}) as Record<string, unknown>;
            const segundos = parseTempoParaSegundos(raw.tempo, raw.segundos);
            const tempo = formatarDuracaoSegundos(segundos) || String(raw.tempo || "0:00").replace(/[\[\]]/g, "").slice(0, 10);
            const titulo = String(raw.titulo || raw.topico || "").trim().slice(0, 110);
            const resumo = String(raw.resumo || raw.explicacao || "").trim().slice(0, 260);
            return { tempo, segundos, titulo, resumo };
          })
          .filter((p) => p.titulo && p.resumo)
          .slice(0, 7)
      : [];
    const conceitos = (Array.isArray(parsed.conceitos) ? parsed.conceitos : [])
      .map((c) => String(c || "").trim().slice(0, 220))
      .filter(Boolean)
      .slice(0, 6);
    if (!ideia && !conceitos.length) return null;
    return { ideia: ideia || "Principais pontos desta videoaula organizados para revisão.", comLegenda, partes, conceitos };
  } catch {
    return null;
  }
}

function seriePorTopico(topico: string, materia: MateriaCatalogo): SerieAberta {
  return {
    titulo: topico,
    materiaNome: materia.nome,
    pedidos: pedidosPorTopico(topico, materia.nome),
    temas: materia.topicos.filter((t) => t !== topico).slice(0, 6),
  };
}

export function VideosView({
  data,
  user,
  update,
  notify,
}: {
  data: ReturnType<typeof useMemoUserData>;
  user: User;
  update: (next: (draft: AppData) => AppData) => void;
  notify: (message: string) => void;
}) {
  const chaveHist = `minerva:videos:hist:${user.id}`;
  const chaveVistos = `minerva:videos:vistos:${user.id}`;
  const chaveFavs = `minerva:videos:fav:${user.id}`;
  const chaveNotas = `minerva:videos:notas:${user.id}`;
  const chaveEstudo = `minerva:videos:estudo:${user.id}`;

  const preset = usePreset("videos");

  // Combina as matérias reais criadas pelo aluno no caderno com o catálogo completo do Ensino Médio/ENEM.
  const materias = useMemo<MateriaCatalogo[]>(() => {
    const usadas = new Set<string>();
    const lista: MateriaCatalogo[] = [];

    for (const subj of data.subjects) {
      const chave = dobrar(subj.name);
      const base = MATERIAS_BASE.find((b) => dobrar(b.nome) === chave || chave.includes(dobrar(b.nome)) || dobrar(b.nome).includes(chave));
      if (base) usadas.add(base.nome);

      const topicosDoAluno = [
        ...data.materials.filter((m) => m.subjectId === subj.id).map((m) => m.title.trim()),
        ...data.tasks.filter((t) => t.subjectId === subj.id && !t.done).map((t) => t.title.trim()),
      ]
        .filter((t) => t.length >= 3 && t.length <= 72)
        .filter((t, i, arr) => arr.findIndex((x) => dobrar(x) === dobrar(t)) === i)
        .slice(0, 6);

      const topicosBase = (base?.topicos || []).filter((t) => !topicosDoAluno.some((x) => dobrar(x) === dobrar(t)));
      const todosTopicos = [...topicosDoAluno, ...topicosBase];
      if (!todosTopicos.length) {
        todosTopicos.push(`${subj.name}: conceitos básicos`, `${subj.name}: exercícios`, `${subj.name}: revisão`);
      }

      lista.push({
        chave: `subj:${subj.id}`,
        nome: subj.name,
        cor: subj.color,
        subjectId: subj.id,
        doAluno: true,
        topicos: todosTopicos,
      });
    }

    for (const base of MATERIAS_BASE) {
      if (usadas.has(base.nome)) continue;
      lista.push({
        chave: `base:${base.nome}`,
        nome: base.nome,
        topicos: base.topicos,
      });
    }

    return lista;
  }, [data.subjects, data.materials, data.tasks]);

  const [materiaChave, setMateriaChave] = useState<string>(() => materias[0]?.chave || "base:Matemática");
  const materia = useMemo(() => materias.find((m) => m.chave === materiaChave) || materias[0], [materias, materiaChave]);

  const [buscaTopico, setBuscaTopico] = useState("");
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [serie, setSerie] = useState<SerieAberta | null>(null);
  const [pedido, setPedido] = useState("");
  const [pensando, setPensando] = useState(false);
  const [aviso, setAviso] = useState("");

  const [historico, setHistorico] = useState<ItemHistorico[]>(() => lerLocal(chaveHist, []));
  const [vistosLista, setVistosLista] = useState<string[]>(() => lerLocal(chaveVistos, []));
  const [favoritosLista, setFavoritosLista] = useState<FavoritoGuardado[]>(() => lerLocal(chaveFavs, []));
  const [notasPorVideo, setNotasPorVideo] = useState<Record<string, string>>(() => lerLocal(chaveNotas, {}));
  const [estudoPorVideo, setEstudoPorVideo] = useState<Record<string, EstudoPorVideo>>(() => lerLocal(chaveEstudo, {}));

  const [videoAtual, setVideoAtual] = useState<Achado | null>(null);
  const [abaEstudo, setAbaEstudo] = useState<AbaEstudo>("resumo");
  const [carregandoEstudo, setCarregandoEstudo] = useState<"" | "resumo" | "quiz">("");
  const [erroEstudo, setErroEstudo] = useState("");
  const [pulo, setPulo] = useState<PuloTempo | null>(null);
  const [destinoSubjectId, setDestinoSubjectId] = useState<string>("");

  const detalhesCache = useRef<Map<string, VideoDetalhe>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => gravarLocal(chaveHist, historico), [chaveHist, historico]);
  useEffect(() => gravarLocal(chaveVistos, vistosLista), [chaveVistos, vistosLista]);
  useEffect(() => gravarLocal(chaveFavs, favoritosLista), [chaveFavs, favoritosLista]);
  useEffect(() => gravarLocal(chaveNotas, notasPorVideo), [chaveNotas, notasPorVideo]);
  useEffect(() => gravarLocal(chaveEstudo, estudoPorVideo), [chaveEstudo, estudoPorVideo]);

  const vistosSet = useMemo(() => new Set(vistosLista), [vistosLista]);
  const favoritosSet = useMemo(() => new Set(favoritosLista.map((f) => f.id)), [favoritosLista]);

  // Sincroniza matéria de destino das anotações com a matéria aberta quando houver correspondência.
  useEffect(() => {
    const nomeAlvo = serie?.materiaNome || materia?.nome || "";
    const correspondente =
      data.subjects.find((s) => s.id === materia?.subjectId) ||
      data.subjects.find((s) => dobrar(s.name) === dobrar(nomeAlvo));
    if (correspondente) setDestinoSubjectId(correspondente.id);
    else if (data.subjects[0] && !destinoSubjectId) setDestinoSubjectId(data.subjects[0].id);
  }, [serie?.materiaNome, materia?.subjectId, materia?.nome, data.subjects]); // eslint-disable-line react-hooks/exhaustive-deps

  const registrarHistorico = (aberta: SerieAberta) => {
    const id = `${dobrar(aberta.titulo)}|${aberta.videosProntos?.[0]?.id || ""}`;
    const item: ItemHistorico = {
      id,
      titulo: aberta.titulo,
      materiaNome: aberta.materiaNome || materia?.nome || "Estudos",
      atualizadoEm: Date.now(),
      serie: aberta,
    };
    setHistorico((atual) => [item, ...atual.filter((h) => h.id !== id)].slice(0, 8));
  };

  const abrirSerie = (nova: SerieAberta) => {
    setAviso("");
    setErroEstudo("");
    setPulo(null);
    setSerie(nova);
    setGavetaAberta(false);
    registrarHistorico(nova);
  };

  // Lê preset vindo do Chat da Mine ("abre a aba de vídeos sobre X") ou do Caderno de Erros das Provas.
  useEffect(() => {
    const temaPreset = (preset?.tema || preset?.pedido || "").trim();
    if (!temaPreset) return;
    const matEncontrada = materias.find((m) => m.topicos.some((t) => dobrar(t) === dobrar(temaPreset)) || dobrar(m.nome) === dobrar(preset?.materia || ""));
    if (matEncontrada) setMateriaChave(matEncontrada.chave);
    abrirSerie({
      titulo: temaPreset,
      materiaNome: matEncontrada?.nome || preset?.materia || materia?.nome || "Estudos",
      pedidos: pedidosPorTopico(temaPreset, matEncontrada?.nome),
      temas: (matEncontrada?.topicos || materia?.topicos || []).filter((t) => dobrar(t) !== dobrar(temaPreset)).slice(0, 5),
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function obterDetalhesDoVideo(videoIdOuUrl: string): Promise<VideoDetalhe | null> {
    const id = extrairYoutubeId(videoIdOuUrl) || (/^[\w-]{11}$/.test(videoIdOuUrl) ? videoIdOuUrl : "");
    if (!id) return null;
    const emCache = detalhesCache.current.get(id);
    if (emCache) return emCache;
    try {
      const response = await fetch("/api/videos", {
        method: "POST",
        headers: mineHeaders(),
        body: JSON.stringify({ videoId: id }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.video) return null;
      const detalhe = json.video as VideoDetalhe;
      detalhesCache.current.set(id, detalhe);
      return detalhe;
    } catch {
      return null;
    }
  }

  async function submeterPedido(event: FormEvent) {
    event.preventDefault();
    const texto = pedido.trim();
    if (texto.length < 3 || pensando) return;

    // 1. Se o aluno colou um link direto do YouTube, abre a aula na hora no estúdio!
    const ytId = extrairYoutubeId(texto);
    if (ytId) {
      setPensando(true);
      setAviso("");
      try {
        const detalhe = await obterDetalhesDoVideo(ytId);
        const tituloAula = detalhe?.title || "Videoaula do YouTube";
        const achado: Achado = {
          id: ytId,
          titulo: tituloAula,
          canal: detalhe?.channel || "YouTube",
          duracao: detalhe?.seconds ? formatarDuracaoSegundos(detalhe.seconds) : "",
          thumb: `https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`,
          sobre: "Link aberto direto no estúdio",
        };
        abrirSerie({
          titulo: tituloAula,
          materiaNome: materia?.nome || "Videoaula",
          pedidos: [{ busca: tituloAula, sobre: "Aula aberta por link" }],
          temas: [],
          videosProntos: [achado],
        });
        setPedido("");
        mineSays("Abri a aula aqui! Se quiser, eu resumo com os minutos ou faço um quiz.", "happy");
      } finally {
        setPensando(false);
      }
      return;
    }

    // 2. Pedido em linguagem natural para a Mine montar uma trilha sob medida.
    setPensando(true);
    setAviso("");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const reply = await askMineTask(
        {
          task: "materia-extra",
          prompt: `O estudante quer videoaulas do YouTube. Pedido dele: "${texto.slice(0, 300)}".
Monte uma serie de 3 a 5 videos em ordem de estudo (primeiro entender, depois exemplos, depois exercicios). Voce NAO sabe links: para cada video escreva so o termo de busca no YouTube, em portugues, de 3 a 7 palavras, especifico e no nivel do ensino medio/ENEM, nunca infantil (ex.: "teorema de pitagoras exercicios resolvidos", "fotossintese aula ensino medio"). Em "temas" ponha de 3 a 6 assuntos vizinhos que o estudante pode querer ver depois. Se o pedido for amplo (so a materia), escolha o tema mais importante e ponha os outros em "temas".
Formato: {"titulo":"nome curto do tema","videos":[{"busca":"termo de busca","sobre":"o que esse video ensina, ate 6 palavras"}],"temas":["tema"]}`,
          context: `Pedido de videos. Materia aberta na aba: ${materia?.nome || "Geral"}.`,
          outputTokens: 700,
        },
        { signal: controller.signal },
      );
      const json = reply.slice(reply.indexOf("{"), reply.lastIndexOf("}") + 1);
      const lido = lerVideos(JSON.parse(json));
      if (!lido) throw new Error("A Mine não montou a lista agora. Tente de novo.");
      abrirSerie({ ...lido, materiaNome: materia?.nome || "Recomendação da Mine" });
      mineSays("Separei uma sequência na ordem certa pra estudar!", "happy");
    } catch (error) {
      if (controller.signal.aborted) return;
      setAviso(error instanceof Error && !/JSON|Unexpected/.test(error.message) ? error.message : "A Mine não montou a lista agora. Tente de novo.");
    } finally {
      setPensando(false);
    }
  }

  const alternarVisto = (video: Achado, elemento: HTMLElement) => {
    const jaVisto = vistosSet.has(video.id);
    setVistosLista((atual) => (jaVisto ? atual.filter((id) => id !== video.id) : [video.id, ...atual].slice(0, 250)));
    if (!jaVisto) {
      celebrateFrom(elemento, { count: 12, spread: 0.65 });
      mineSays("Boa! Faz o mini-quiz aqui embaixo pra fixar e ganhar XP!", "happy");
    }
  };

  const alternarFavorito = (video: Achado) => {
    const jaTem = favoritosSet.has(video.id);
    if (jaTem) {
      setFavoritosLista((atual) => atual.filter((f) => f.id !== video.id));
      notify("Removido dos vídeos salvos.");
      return;
    }
    const novo: FavoritoGuardado = {
      id: video.id,
      titulo: video.titulo,
      canal: video.canal,
      duracao: video.duracao,
      thumb: video.thumb || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`,
      materiaNome: serie?.materiaNome || materia?.nome || "Estudos",
      salvoEm: Date.now(),
    };
    setFavoritosLista((atual) => [novo, ...atual.filter((f) => f.id !== video.id)].slice(0, 40));
    notify("Vídeo guardado nos favoritos para revisar depois.");
  };

  const garantirMateriaParaSalvar = (): Subject => {
    const escolhida = data.subjects.find((s) => s.id === destinoSubjectId);
    if (escolhida) return escolhida;
    const nomeMateria = serie?.materiaNome || materia?.nome || "Estudos gerais";
    const existente = data.subjects.find((s) => dobrar(s.name) === dobrar(nomeMateria));
    if (existente) return existente;

    const criada: Subject = {
      id: uid("subject"),
      userId: user.id,
      name: nomeMateria,
      color: CORES_MATERIA[data.subjects.length % CORES_MATERIA.length],
      icon: "book",
      favorite: false,
      createdAt: Date.now(),
    };
    update((draft) => ({ ...draft, subjects: [...draft.subjects, criada] }));
    setDestinoSubjectId(criada.id);
    return criada;
  };

  const salvarConteudoNaMateria = (titulo: string, corpo: string, botao: HTMLElement | null) => {
    const limpo = corpo.trim();
    if (!limpo) return;
    const alvo = garantirMateriaParaSalvar();
    const existente = data.materials.find((m) => m.subjectId === alvo.id && m.title === titulo);

    if (existente) {
      update((draft) => ({
        ...draft,
        materials: draft.materials.map((m) => (m.id === existente.id ? { ...m, content: limpo } : m)),
      }));
      notify(`Anotação atualizada em ${alvo.name}.`);
      mineSays(`Atualizei lá nos conteúdos de ${alvo.name}!`, "happy");
      return;
    }

    const novoMaterial: Material = {
      id: uid("material"),
      userId: user.id,
      subjectId: alvo.id,
      title: titulo.slice(0, 78),
      type: "note",
      detail: videoAtual ? `Videoaula · ${videoAtual.canal}` : "Estúdio de Vídeos",
      content: limpo,
      folder: "Videoaulas",
      studied: false,
      favorite: false,
      createdAt: Date.now(),
    };
    update((draft) => ({ ...draft, materials: [...draft.materials, novoMaterial] }));
    cheer(botao, xpPerAction.material, `Salvei em ${alvo.name}!`);
    notify(`Salvo em ${alvo.name} (pasta Videoaulas).`);
  };

  const gerarResumoDaAula = async () => {
    if (!videoAtual || carregandoEstudo) return;
    setCarregandoEstudo("resumo");
    setErroEstudo("");
    try {
      const detalhe = await obterDetalhesDoVideo(videoAtual.id);
      const temLegenda = Boolean(detalhe?.ok && detalhe.transcript.trim().length >= 80);
      const contextoAula = temLegenda
        ? `Vídeo: "${detalhe!.title || videoAtual.titulo}" (canal ${detalhe!.channel || videoAtual.canal}).\nLegenda com marcas [mm:ss]:\n${detalhe!.transcript.slice(0, 14_000)}`
        : `Vídeo: "${detalhe?.title || videoAtual.titulo}" (canal ${detalhe?.channel || videoAtual.canal}).\nTema da série: ${serie?.titulo || videoAtual.titulo}.\nDescrição do vídeo: ${detalhe?.description?.slice(0, 1500) || "(sem descrição)"}`;

      const promptResumo = temLegenda
        ? `Leia a legenda desta videoaula e monte um guia de estudo fiel ao que foi falado.
Responda SOMENTE com JSON valido neste formato:
{"ideia":"resumo claro da ideia central em 2 a 3 frases","partes":[{"tempo":"01:30","segundos":90,"titulo":"assunto deste trecho","resumo":"o que o professor explica aqui em 1 frase"}],"conceitos":["conceito importante, formula (em $LaTeX$ se houver) ou dica de prova"]}
Regras: de 3 a 6 itens em "partes", usando APENAS tempos [mm:ss] que realmente aparecem na legenda em ordem crescente; de 3 a 5 itens em "conceitos".`
        : `Este video nao disponibilizou legenda automatica. Monte os pontos essenciais de estudo sobre o tema da aula ("${videoAtual.titulo}", tema "${serie?.titulo || ""}") usando o titulo e a descricao disponiveis, sem inventar falas nem tempos.
Responda SOMENTE com JSON valido neste formato:
{"ideia":"visao geral clara do assunto em 2 a 3 frases para ensino medio/ENEM","partes":[],"conceitos":["conceito essencial, formula (em $LaTeX$ se houver) ou ponto cobrado em prova"]}`;

      const resposta = await askMineTask({
        task: "materia-extra",
        prompt: promptResumo,
        context: contextoAula,
        outputTokens: 1100,
      });
      const resumo = lerResumoJson(resposta, temLegenda);
      if (!resumo) throw new Error("Não consegui organizar o resumo desta aula agora. Tente de novo.");
      setEstudoPorVideo((atual) => ({
        ...atual,
        [videoAtual.id]: { ...atual[videoAtual.id], resumo },
      }));
      mineSays(temLegenda ? "Li a legenda inteira! Clica nos minutos pra pular na aula." : "Organizei os conceitos-chave desse tema pra você acompanhar!", "happy");
    } catch (error) {
      setErroEstudo(error instanceof Error && !/JSON|Unexpected/.test(error.message) ? error.message : "A Mine não conseguiu resumir esta aula agora.");
    } finally {
      setCarregandoEstudo("");
    }
  };

  const gerarQuizDaAula = async () => {
    if (!videoAtual || carregandoEstudo) return;
    setCarregandoEstudo("quiz");
    setErroEstudo("");
    try {
      const detalhe = await obterDetalhesDoVideo(videoAtual.id);
      const temLegenda = Boolean(detalhe?.ok && detalhe.transcript.trim().length >= 80);
      const contextoAula = temLegenda
        ? `Vídeo: "${detalhe!.title || videoAtual.titulo}" (${detalhe!.channel || videoAtual.canal}).\nTrecho da transcrição da aula:\n${detalhe!.transcript.slice(0, 12_000)}`
        : `Aula: "${videoAtual.titulo}" (${videoAtual.canal}) · Tema: ${serie?.titulo || videoAtual.titulo} · Matéria: ${serie?.materiaNome || materia?.nome || "Ensino Médio"}.\nDescrição: ${detalhe?.description?.slice(0, 1200) || "(vazia)"}`;

      const resposta = await askMineTask({
        task: "materia-extra",
        prompt: `Monte um mini-quiz de 3 questoes de multipla escolha (4 alternativas cada, nivel ensino medio/ENEM) para testar se o estudante compreendeu esta videoaula.
Responda SOMENTE com JSON valido neste formato exato:
{"titulo":"Quiz · ${videoAtual.titulo.replace(/"/g, "").slice(0, 48)}","perguntas":[{"pergunta":"enunciado claro","dica":"uma pista curta sem entregar a resposta","opcoes":[{"texto":"alternativa A","porque":"por que esta certa ou errada"},{"texto":"alternativa B","porque":"por que esta certa ou errada"},{"texto":"alternativa C","porque":"por que esta certa ou errada"},{"texto":"alternativa D","porque":"por que esta certa ou errada"}],"correta":0,"explicacao":"resumo final da resposta certa"}]}
Regras: varie o indice "correta" (0, 1, 2 ou 3) e confira duas vezes que a alternativa em "correta" bate com a explicacao. Formulas em $LaTeX$ simples se precisar (lembre de dobrar barras invertidas no JSON).`,
        context: contextoAula,
        outputTokens: 1400,
      });
      const json = resposta.slice(resposta.indexOf("{"), resposta.lastIndexOf("}") + 1);
      const parsed = JSON.parse(json) as Record<string, unknown>;
      if (!Array.isArray(parsed.perguntas) || !parsed.perguntas.length) {
        throw new Error("O quiz veio incompleto. Tente gerar de novo.");
      }
      setEstudoPorVideo((atual) => ({
        ...atual,
        [videoAtual.id]: { ...atual[videoAtual.id], quizJson: json },
      }));
      mineSays("Quiz na tela! Responde as 3 pra ganhar XP.", "happy");
    } catch (error) {
      setErroEstudo(error instanceof Error && !/JSON|Unexpected/.test(error.message) ? error.message : "A Mine não conseguiu montar o quiz agora.");
    } finally {
      setCarregandoEstudo("");
    }
  };

  const aoConcluirQuiz = ({ acertos, total }: { titulo: string; acertos: number; total: number }) => {
    if (!videoAtual) return;
    // Marca a aula como vista automaticamente ao concluir o quiz.
    if (!vistosSet.has(videoAtual.id)) {
      setVistosLista((atual) => [videoAtual.id, ...atual].slice(0, 250));
    }
    const jaGanhouNesteVideo = data.sessions.some((s) => s.kind === "Videoaula" && s.lessonKey === videoAtual.id);
    if (jaGanhouNesteVideo) {
      mineSays(`Boa revisão! ${acertos} de ${total} certas.`, "happy");
      return;
    }
    const hoje = startOfDay(Date.now());
    const feitasHoje = data.sessions.filter((s) => s.kind === "Videoaula" && startOfDay(s.createdAt) === hoje).length;
    const xp = videoXp(acertos);
    const subjectAlvo =
      data.subjects.find((s) => s.id === destinoSubjectId) ||
      data.subjects.find((s) => dobrar(s.name) === dobrar(serie?.materiaNome || materia?.nome || ""));

    const sessao: Session = {
      id: uid("session"),
      userId: user.id,
      subjectId: subjectAlvo?.id || data.subjects[0]?.id || "geral",
      title: `Videoaula: ${videoAtual.titulo.slice(0, 70)}`,
      kind: "Videoaula",
      lessonKey: videoAtual.id,
      xpEarned: xp,
      correctAnswers: acertos,
      questionsAnswered: total,
      createdAt: Date.now(),
    };
    update((draft) => ({ ...draft, sessions: [...draft.sessions, sessao] }));

    const ancorar = document.querySelector(".vid-estudo");
    if (feitasHoje < videosPorDia) {
      if (ancorar) {
        floatXp(`+${xp} XP`, ancorar);
        celebrateFrom(ancorar, { count: 22, spread: 0.85 });
      }
      mineSays(acertos === total ? `Gabaritou a aula! +${xp} XP no caderno!` : `Mandou bem! +${xp} XP pela aula estudada.`, "happy");
    } else {
      notify(`Aula registrada! Você já atingiu o limite diário de ${videosPorDia} videoaulas com XP hoje.`);
    }
  };

  const perguntarSobreVideo = async () => {
    if (!videoAtual) return;
    const detalhe = detalhesCache.current.get(videoAtual.id) || (await obterDetalhesDoVideo(videoAtual.id));
    const trecho = detalhe?.ok && detalhe.transcript ? `\nTrecho da legenda:\n${detalhe.transcript.slice(0, 3500)}` : "";
    mineConversa(
      `Pode me explicar de um jeito bem simples o ponto principal da aula “${videoAtual.titulo}”?`,
      `O estudante está na aba Vídeos assistindo "${videoAtual.titulo}" (canal ${videoAtual.canal}, tema "${serie?.titulo || ""}").${trecho}`,
      videoAtual.titulo.slice(0, 48),
    );
  };

  // Busca de tópicos: filtra na matéria atual e, se houver termo digitado, acha também em outras matérias.
  const filtroLimpo = dobrar(buscaTopico);
  const topicosDaMateria = useMemo(() => {
    if (!materia) return [];
    if (!filtroLimpo) return materia.topicos;
    return materia.topicos.filter((t) => dobrar(t).includes(filtroLimpo));
  }, [materia, filtroLimpo]);

  const topicosDeOutrasMaterias = useMemo(() => {
    if (filtroLimpo.length < 2) return [];
    const achados: Array<{ topico: string; materia: MateriaCatalogo }> = [];
    for (const m of materias) {
      if (m.chave === materia?.chave) continue;
      for (const t of m.topicos) {
        if (dobrar(t).includes(filtroLimpo)) {
          achados.push({ topico: t, materia: m });
          if (achados.length >= 8) return achados;
        }
      }
    }
    return achados;
  }, [materias, materia?.chave, filtroLimpo]);

  // Sugestões inteligentes para o estado inicial (tarefas abertas, erros de prova ou clássicos ENEM).
  const sugestoesIniciais = useMemo(() => {
    const itens: Array<{ titulo: string; motivo: string; materiaNome: string }> = [];
    const vistosTitulos = new Set<string>();
    const adicionar = (titulo: string, motivo: string, materiaNome: string) => {
      const k = dobrar(titulo);
      if (!k || k.length < 3 || vistosTitulos.has(k)) return;
      vistosTitulos.add(k);
      itens.push({ titulo, motivo, materiaNome });
    };

    const cadernoBruto = (user.settings.provas as { caderno?: Array<{ assunto?: string; status?: string }> } | undefined)?.caderno || [];
    const errosPendentes = cadernoBruto.filter((e) => e.status !== "dominado");
    for (const erro of errosPendentes.slice(0, 2)) {
      if (erro.assunto) adicionar(erro.assunto, "Reforçar do Caderno de Erros", "Revisão");
    }

    const tarefasAbertas = data.tasks
      .filter((t) => !t.done)
      .sort((a, b) => a.dueAt - b.dueAt)
      .slice(0, 3);
    for (const t of tarefasAbertas) {
      const subj = data.subjects.find((s) => s.id === t.subjectId);
      adicionar(t.title, subj ? `Da sua agenda · ${subj.name}` : "Da sua agenda", subj?.name || "Agenda");
    }

    for (const s of data.subjects.slice(0, 3)) {
      const matCat = materias.find((m) => m.subjectId === s.id);
      if (matCat?.topicos[0]) adicionar(matCat.topicos[0], `Sua matéria · ${s.name}`, s.name);
    }

    const classicos: Array<[string, string]> = [
      ["Função do 2º grau", "Matemática · Clássico ENEM"],
      ["Leis de Newton", "Física · Base da mecânica"],
      ["Estequiometria", "Química · Muito cobrado"],
      ["Redação ENEM: estrutura", "Redação · Rumo ao 900+"],
    ];
    for (const [t, m] of classicos) {
      if (itens.length >= 6) break;
      adicionar(t, m, m.split(" · ")[0]);
    }
    return itens.slice(0, 6);
  }, [data.tasks, data.subjects, materias, user.settings.provas]);

  const linkDetectado = Boolean(extrairYoutubeId(pedido));
  const estudoAtual = videoAtual ? estudoPorVideo[videoAtual.id] : undefined;
  const notaAtual = videoAtual ? notasPorVideo[videoAtual.id] || "" : "";
  const jaFezQuizDesteVideo = Boolean(videoAtual && data.sessions.some((s) => s.kind === "Videoaula" && s.lessonKey === videoAtual.id));

  return (
    <div className="vid-aba">
      <PageHeader
        eyebrow="Vídeos · Estúdio de aulas"
        title="Videoaulas com a Mine"
        subtitle="Escolha um tópico, peça uma trilha sob medida ou cole um link do YouTube. Assista sem sair do caderno com resumo por minutagem, anotações e quiz valendo XP."
        action={
          serie ? (
            <button
              type="button"
              className="vid-aba__voltar-inicio"
              onClick={() => {
                setSerie(null);
                setVideoAtual(null);
              }}
            >
              <History className="h-4 w-4" aria-hidden /> Início & salvos
            </button>
          ) : undefined
        }
      />

      <form className="vid-aba__pedir" onSubmit={submeterPedido}>
        {linkDetectado ? <Link2 aria-hidden className="vid-aba__pedir-icone" /> : <Sparkles aria-hidden className="vid-aba__pedir-icone" />}
        <input
          value={pedido}
          onChange={(event) => setPedido(event.target.value)}
          placeholder="Peça à Mine (“quero entender Pitágoras com exemplos”) ou cole um link do YouTube…"
          aria-label="Pedir vídeos à Mine ou colar link do YouTube"
          maxLength={300}
        />
        {pedido ? (
          <button type="button" className="vid-aba__limpar" onClick={() => setPedido("")} aria-label="Limpar busca">
            <X aria-hidden />
          </button>
        ) : null}
        <button type="submit" className="vid-aba__enviar caderno-btn-pen" disabled={pensando || pedido.trim().length < 3}>
          {pensando ? <Loader2 className="vid-aba__giro" aria-hidden /> : linkDetectado ? <Play aria-hidden /> : <Search aria-hidden />}
          <span>{pensando ? "Abrindo…" : linkDetectado ? "Abrir link" : "Montar série"}</span>
        </button>
      </form>

      {aviso ? (
        <p className="vid-aba__aviso" role="alert">
          {aviso}
        </p>
      ) : null}

      <div className="vid-aba__grade">
        <aside className={`vid-aba__escolha${serie && !gavetaAberta ? " is-recolhida-mobile" : ""}`} aria-label="Escolher matéria e tópico">
          {serie ? (
            <button
              type="button"
              className="vid-aba__toggle-mobile"
              aria-expanded={gavetaAberta}
              onClick={() => setGavetaAberta((v) => !v)}
            >
              <span>
                <Compass className="h-4 w-4" aria-hidden /> Trocar matéria ou tópico ({materia?.nome})
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${gavetaAberta ? "rotate-180" : ""}`} aria-hidden />
            </button>
          ) : null}

          <div className="vid-aba__escolha-corpo">
            <div className="vid-aba__materias" role="tablist" aria-label="Matérias">
              {materias.map((m) => {
                const ativa = m.chave === materia?.chave;
                return (
                  <button
                    key={m.chave}
                    type="button"
                    role="tab"
                    aria-selected={ativa}
                    className={ativa ? "is-on" : ""}
                    onClick={() => setMateriaChave(m.chave)}
                  >
                    {m.cor ? <span className="vid-aba__cor" style={{ background: m.cor }} aria-hidden /> : null}
                    <span>{m.nome}</span>
                  </button>
                );
              })}
            </div>

            <div className="vid-aba__filtro">
              <Search className="h-3.5 w-3.5" aria-hidden />
              <input
                value={buscaTopico}
                onChange={(e) => setBuscaTopico(e.target.value)}
                placeholder={`Filtrar em ${materia?.nome || "tópicos"}…`}
                aria-label="Filtrar tópicos"
              />
              {buscaTopico ? (
                <button type="button" onClick={() => setBuscaTopico("")} aria-label="Limpar filtro">
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </div>

            <ul className="vid-aba__topicos" aria-label={`Tópicos de ${materia?.nome || "estudo"}`}>
              {topicosDaMateria.map((t) => {
                const ativo = serie?.titulo === t;
                return (
                  <li key={t}>
                    <button
                      type="button"
                      className={ativo ? "is-on" : ""}
                      onClick={() => materia && abrirSerie(seriePorTopico(t, materia))}
                    >
                      <span>{t}</span>
                    </button>
                  </li>
                );
              })}
              {topicosDeOutrasMaterias.map(({ topico, materia: outra }) => (
                <li key={`${outra.chave}:${topico}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setMateriaChave(outra.chave);
                      abrirSerie(seriePorTopico(topico, outra));
                    }}
                  >
                    <span>{topico}</span>
                    <small>{outra.nome}</small>
                  </button>
                </li>
              ))}
              {!topicosDaMateria.length && !topicosDeOutrasMaterias.length && buscaTopico.trim().length >= 2 ? (
                <li className="vid-aba__topico-livre">
                  <button
                    type="button"
                    onClick={() => {
                      const termo = buscaTopico.trim();
                      setBuscaTopico("");
                      abrirSerie({
                        titulo: termo,
                        materiaNome: materia?.nome || "Busca",
                        pedidos: pedidosPorTopico(termo, materia?.nome),
                        temas: (materia?.topicos || []).slice(0, 5),
                      });
                    }}
                  >
                    <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
                    <span>Montar série sobre “{buscaTopico.trim()}”</span>
                  </button>
                </li>
              ) : null}
            </ul>
          </div>
        </aside>

        <div className="vid-aba__palco">
          {serie ? (
            <>
              <div className="vid-aba__player">
                <SerieDeVideos
                  key={`${serie.titulo}:${serie.pedidos.map((p) => p.busca).join("|")}:${serie.videosProntos?.[0]?.id || ""}`}
                  {...serie}
                  variante="aba"
                  pulo={pulo}
                  vistos={vistosSet}
                  onToggleVisto={alternarVisto}
                  favoritos={favoritosSet}
                  onToggleFavorito={alternarFavorito}
                  onVideoChange={(v) => {
                    setVideoAtual(v);
                    setErroEstudo("");
                  }}
                />
              </div>

              {videoAtual ? (
                <section className="vid-estudo" aria-label="Estudar esta aula com a Mine">
                  <header className="vid-estudo__topo">
                    <div className="vid-estudo__abas" role="tablist" aria-label="Ferramentas de estudo do vídeo">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={abaEstudo === "resumo"}
                        className={abaEstudo === "resumo" ? "is-on" : ""}
                        onClick={() => setAbaEstudo("resumo")}
                      >
                        <FileText className="h-4 w-4" aria-hidden />
                        <span>Resumo & minutos</span>
                        {estudoAtual?.resumo ? <i className="vid-estudo__ponto" aria-hidden /> : null}
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={abaEstudo === "notas"}
                        className={abaEstudo === "notas" ? "is-on" : ""}
                        onClick={() => setAbaEstudo("notas")}
                      >
                        <BookOpen className="h-4 w-4" aria-hidden />
                        <span>Anotar</span>
                        {notaAtual.trim() ? <i className="vid-estudo__ponto" aria-hidden /> : null}
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={abaEstudo === "quiz"}
                        className={abaEstudo === "quiz" ? "is-on" : ""}
                        onClick={() => setAbaEstudo("quiz")}
                      >
                        <HelpCircle className="h-4 w-4" aria-hidden />
                        <span>Quiz {jaFezQuizDesteVideo ? "✓" : `+${videoXpMax} XP`}</span>
                      </button>
                    </div>

                    <button type="button" className="vid-estudo__duvida" onClick={() => void perguntarSobreVideo()}>
                      <MessageCircleQuestion className="h-4 w-4" aria-hidden />
                      <span>Tirar dúvida com a Mine</span>
                    </button>
                  </header>

                  {erroEstudo ? (
                    <p className="vid-aba__aviso" role="alert">
                      {erroEstudo}
                    </p>
                  ) : null}

                  {abaEstudo === "resumo" ? (
                    <div className="vid-estudo__corpo">
                      {estudoAtual?.resumo ? (
                        <div className="vid-resumo">
                          <div className="vid-resumo__meta">
                            <span className={`vid-badge ${estudoAtual.resumo.comLegenda ? "is-legenda" : "is-tema"}`}>
                              {estudoAtual.resumo.comLegenda ? "Legenda da aula lida pela Mine" : "Baseado no tema e descrição (vídeo sem legenda)"}
                            </span>
                            <div className="vid-resumo__acoes">
                              <button
                                type="button"
                                className="vid-btn-fantasma"
                                onClick={(e) => {
                                  const linhas = [
                                    `Resumo da aula: ${videoAtual.titulo} (${videoAtual.canal})`,
                                    `Link: https://youtu.be/${videoAtual.id}`,
                                    "",
                                    estudoAtual.resumo!.ideia,
                                    ...(estudoAtual.resumo!.partes.length
                                      ? ["", "Minutagem da aula:", ...estudoAtual.resumo!.partes.map((p) => `• [${p.tempo}] ${p.titulo} — ${p.resumo}`)]
                                      : []),
                                    ...(estudoAtual.resumo!.conceitos.length
                                      ? ["", "Conceitos essenciais:", ...estudoAtual.resumo!.conceitos.map((c) => `• ${c}`)]
                                      : []),
                                  ].join("\n");
                                  salvarConteudoNaMateria(`Resumo · ${videoAtual.titulo.slice(0, 64)}`, linhas, e.currentTarget);
                                }}
                              >
                                <FolderPlus className="h-3.5 w-3.5" aria-hidden /> Salvar na matéria
                              </button>
                              <button type="button" className="vid-btn-fantasma" onClick={() => void gerarResumoDaAula()} disabled={Boolean(carregandoEstudo)}>
                                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Refazer
                              </button>
                            </div>
                          </div>

                          <p className="vid-resumo__ideia">
                            <MineInline text={estudoAtual.resumo.ideia} />
                          </p>

                          {estudoAtual.resumo.partes.length ? (
                            <div className="vid-resumo__bloco">
                              <h3>Capítulos da aula (toque no minuto para pular)</h3>
                              <ol className="vid-resumo__tempos">
                                {estudoAtual.resumo.partes.map((parte, idx) => (
                                  <li key={`${parte.tempo}-${idx}`}>
                                    <button
                                      type="button"
                                      className="vid-tempo-chip"
                                      onClick={() => setPulo({ segundos: parte.segundos, chave: Date.now() })}
                                      title={`Pular vídeo para ${parte.tempo}`}
                                    >
                                      <Play className="h-3 w-3" aria-hidden /> {parte.tempo}
                                    </button>
                                    <div>
                                      <strong>{parte.titulo}</strong>
                                      <p>
                                        <MineInline text={parte.resumo} />
                                      </p>
                                    </div>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          ) : null}

                          {estudoAtual.resumo.conceitos.length ? (
                            <div className="vid-resumo__bloco">
                              <h3>Pontos para guardar</h3>
                              <ul className="vid-resumo__conceitos">
                                {estudoAtual.resumo.conceitos.map((conceito, idx) => (
                                  <li key={idx}>
                                    <MineInline text={conceito} />
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="vid-estudo__convite">
                          <div>
                            <strong>Resumo inteligente com minutagem</strong>
                            <p>A Mine lê a legenda desta videoaula, separa os capítulos com botões que pulam direto pro minuto certo e destaca fórmulas e conceitos de prova.</p>
                          </div>
                          <button
                            type="button"
                            className="vid-btn-primario caderno-btn-pen"
                            onClick={() => void gerarResumoDaAula()}
                            disabled={carregandoEstudo === "resumo"}
                          >
                            {carregandoEstudo === "resumo" ? <Loader2 className="vid-aba__giro h-4 w-4" aria-hidden /> : <Bot className="h-4 w-4" aria-hidden />}
                            <span>{carregandoEstudo === "resumo" ? "Lendo a aula…" : "Resumir esta aula"}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {abaEstudo === "notas" ? (
                    <div className="vid-estudo__corpo">
                      <div className="vid-notas">
                        <div className="vid-notas__atalhos">
                          <span>Inserir rápido:</span>
                          {["📌 Ideia principal: ", "⚠️ Cai em prova: ", "❓ Dúvida para revisar: "].map((prefixo) => (
                            <button
                              key={prefixo}
                              type="button"
                              onClick={() =>
                                setNotasPorVideo((atual) => {
                                  const ant = atual[videoAtual.id] || "";
                                  const sep = ant && !ant.endsWith("\n") ? "\n" : "";
                                  return { ...atual, [videoAtual.id]: `${ant}${sep}${prefixo}` };
                                })
                              }
                            >
                              {prefixo.replace(/:\s*$/, "")}
                            </button>
                          ))}
                        </div>

                        <div className="vid-notas__folha">
                          <textarea
                            value={notaAtual}
                            onChange={(e) => setNotasPorVideo((atual) => ({ ...atual, [videoAtual.id]: e.target.value }))}
                            placeholder={`Anote com suas palavras o que aprendeu em “${videoAtual.titulo}”… (fica salvo automaticamente neste aparelho)`}
                            aria-label="Suas anotações desta videoaula"
                          />
                        </div>

                        <div className="vid-notas__rodape">
                          <label className="vid-notas__destino">
                            <span>Salvar em:</span>
                            {data.subjects.length ? (
                              <select value={destinoSubjectId} onChange={(e) => setDestinoSubjectId(e.target.value)}>
                                {data.subjects.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <em>Nova matéria “{serie.materiaNome || materia?.nome || "Estudos"}”</em>
                            )}
                          </label>

                          <button
                            type="button"
                            className="vid-btn-primario caderno-btn-pen"
                            disabled={!notaAtual.trim()}
                            onClick={(e) => {
                              const corpo = `${notaAtual.trim()}\n\n— Videoaula: ${videoAtual.titulo} (${videoAtual.canal})\nhttps://youtu.be/${videoAtual.id}`;
                              salvarConteudoNaMateria(`Notas · ${videoAtual.titulo.slice(0, 66)}`, corpo, e.currentTarget);
                            }}
                          >
                            <Save className="h-4 w-4" aria-hidden />
                            <span>Salvar nos conteúdos (+{xpPerAction.material} XP se novo)</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {abaEstudo === "quiz" ? (
                    <div className="vid-estudo__corpo">
                      {estudoAtual?.quizJson ? (
                        <div className="vid-quiz-wrap">
                          <div className="vid-resumo__meta">
                            <span className="vid-badge is-legenda">
                              {jaFezQuizDesteVideo
                                ? "XP desta videoaula já conquistado · refaça quando quiser revisar"
                                : `Vale de 10 a ${videoXpMax} XP (até ${videosPorDia} videoaulas por dia)`}
                            </span>
                            <button type="button" className="vid-btn-fantasma" onClick={() => void gerarQuizDaAula()} disabled={Boolean(carregandoEstudo)}>
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Novas questões
                            </button>
                          </div>
                          <QuizResultadoContext.Provider value={aoConcluirQuiz}>
                            <BlocoInterativo key={estudoAtual.quizJson} lang="quiz" code={estudoAtual.quizJson} fallback={null} />
                          </QuizResultadoContext.Provider>
                        </div>
                      ) : (
                        <div className="vid-estudo__convite">
                          <div>
                            <strong>Teste rápido de 3 questões sobre a aula</strong>
                            <p>
                              Assistir passivamente engana a memória. Responda 3 questões estilo ENEM sobre este vídeo para cravar o conteúdo e ganhar de{" "}
                              <b>10 a {videoXpMax} XP</b> (até {videosPorDia} aulas por dia).
                            </p>
                          </div>
                          <button
                            type="button"
                            className="vid-btn-primario caderno-btn-pen"
                            onClick={() => void gerarQuizDaAula()}
                            disabled={carregandoEstudo === "quiz"}
                          >
                            {carregandoEstudo === "quiz" ? <Loader2 className="vid-aba__giro h-4 w-4" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                            <span>{carregandoEstudo === "quiz" ? "Montando questões…" : "Testar se entendi"}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </section>
              ) : null}
            </>
          ) : (
            <div className="vid-hub">
              <section className="vid-hub__secao" aria-label="Sugestões para estudar agora">
                <div className="vid-hub__cab">
                  <p className="caderno-note">por onde começar</p>
                  <h2>Trilhas prontas em 4 etapas</h2>
                  <p>Cada tópico abre uma sequência enxuta: explicação, exemplos, exercícios resolvidos e revisão ENEM.</p>
                </div>
                <div className="vid-hub__cartoes">
                  {sugestoesIniciais.map((sug) => (
                    <button
                      key={sug.titulo}
                      type="button"
                      className="vid-sugestao"
                      onClick={() =>
                        abrirSerie({
                          titulo: sug.titulo,
                          materiaNome: sug.materiaNome,
                          pedidos: pedidosPorTopico(sug.titulo, sug.materiaNome),
                          temas: (materias.find((m) => dobrar(m.nome) === dobrar(sug.materiaNome))?.topicos || materia?.topicos || [])
                            .filter((t) => dobrar(t) !== dobrar(sug.titulo))
                            .slice(0, 5),
                        })
                      }
                    >
                      <span className="vid-sugestao__motivo">{sug.motivo}</span>
                      <strong>{sug.titulo}</strong>
                      <span className="vid-sugestao__acao">
                        <Play className="h-3.5 w-3.5" aria-hidden /> Abrir 4 aulas
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {historico.length ? (
                <section className="vid-hub__secao" aria-label="Continuar assistindo">
                  <div className="vid-hub__linha-titulo">
                    <h3>
                      <Clock className="h-4 w-4" aria-hidden /> Continuar assistindo
                    </h3>
                    <button type="button" className="vid-btn-texto" onClick={() => setHistorico([])}>
                      Limpar histórico
                    </button>
                  </div>
                  <ul className="vid-recentes">
                    {historico.map((item) => (
                      <li key={item.id}>
                        <button type="button" className="vid-recente__abrir" onClick={() => abrirSerie(item.serie)}>
                          <InkCheck checked={Boolean(item.serie.videosProntos?.[0] && vistosSet.has(item.serie.videosProntos[0].id))} className="h-5 w-5 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <strong>{item.titulo}</strong>
                            <small>{item.materiaNome}</small>
                          </span>
                        </button>
                        <button
                          type="button"
                          className="vid-icone-apagar"
                          aria-label={`Remover ${item.titulo} do histórico`}
                          onClick={() => setHistorico((atual) => atual.filter((h) => h.id !== item.id))}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {favoritosLista.length ? (
                <section className="vid-hub__secao" aria-label="Vídeos salvos nos favoritos">
                  <div className="vid-hub__linha-titulo">
                    <h3>
                      <Bookmark className="h-4 w-4" aria-hidden /> Vídeos favoritados ({favoritosLista.length})
                    </h3>
                  </div>
                  <div className="vid-favoritos">
                    {favoritosLista.map((fav) => (
                      <article key={fav.id} className="vid-fav-card">
                        <button
                          type="button"
                          className="vid-fav-card__abrir"
                          onClick={() =>
                            abrirSerie({
                              titulo: fav.titulo,
                              materiaNome: fav.materiaNome,
                              pedidos: [{ busca: fav.titulo, sobre: "Vídeo salvo nos favoritos" }],
                              temas: [],
                              videosProntos: [
                                {
                                  id: fav.id,
                                  titulo: fav.titulo,
                                  canal: fav.canal,
                                  duracao: fav.duracao,
                                  thumb: fav.thumb,
                                  sobre: fav.materiaNome,
                                },
                              ],
                            })
                          }
                        >
                          <span className="vid-fav-card__thumb">
                            <img src={fav.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" />
                            {fav.duracao ? <em>{fav.duracao}</em> : null}
                          </span>
                          <span className="vid-fav-card__texto">
                            <strong>{fav.titulo}</strong>
                            <small>
                              {fav.canal} · {fav.materiaNome}
                            </small>
                          </span>
                        </button>
                        <button
                          type="button"
                          className="vid-icone-apagar"
                          aria-label={`Remover ${fav.titulo} dos favoritos`}
                          onClick={() => setFavoritosLista((atual) => atual.filter((x) => x.id !== fav.id))}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
