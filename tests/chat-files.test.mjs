import test from "node:test";
import assert from "node:assert/strict";
import {
  asksForFile,
  asksForStudySheet,
  buildDocx,
  buildXlsx,
  cellValue,
  displayRows,
  ensureDeepResearchFile,
  excelFormula,
  fileBaseName,
  fileHtml,
  parseFileBlock,
  sheetsFromMarkdown,
  sheetCsv,
  zipFiles,
} from "../shared/chat-files.mjs";
import { definitionOf, extractGlossary, markGlossary, splitGlossaryTerms, splitMarked, stripGlossary } from "../shared/chat-glossary.mjs";
import { searchConversations } from "../shared/chat-search.mjs";
import { asksToGenerateImage, editsAttachedImage, imageFormatFrom, splitMessageMedia, stripImageMarkers, stripPendingMarker, withImageRequest } from "../shared/chat-media.mjs";
import { chatActionFromPrompt } from "../shared/chat-actions.mjs";
import { parseBlocks } from "../shared/chat-markdown.mjs";

test("pedido de arquivo: formato certo, dúvida continua conversa", () => {
  assert.equal(asksForFile("cria um pdf sobre a revolução francesa"), "pdf");
  assert.equal(asksForFile("faz uma planilha de gastos do mês"), "excel");
  assert.equal(asksForFile("me dá isso em word"), "word");
  assert.equal(asksForFile("transforma esse resumo em um documento do Word"), "word");
  assert.equal(asksForFile("monta uma apostila de frações"), "pdf");
  assert.equal(asksForFile("exporta essa tabela pra excel"), "excel");
  assert.equal(asksForFile("quero uma página html do meu trabalho"), "html");
  assert.equal(asksForFile("continua o arquivo"), "pdf");
  assert.equal(asksForFile('Refaça o arquivo "País de Gales" completo, um pouco mais curto.'), "pdf");
  assert.equal(asksForFile("como faço uma planilha no excel?"), "");
  assert.equal(asksForFile("o que é um pdf?"), "");
  assert.equal(asksForFile("o professor mandou o pdf da aula"), "");
});

test("detecta bloco de arquivo que ficou aberto (resposta cortada)", async () => {
  const { fileBlockOpen } = await import("../mine/router.mjs");
  assert.equal(fileBlockOpen("Montei.\n\n```arquivo\ntipo: pdf\ntitulo: X\n---\n## A\ntexto cort"), true);
  assert.equal(fileBlockOpen("Montei.\n\n```arquivo\ntipo: pdf\n---\n## A\ntexto\n```\n\nQuer ajuste?"), false);
  assert.equal(fileBlockOpen("Sem arquivo nenhum."), false);
});

test("resumo de prova a partir da conversa", () => {
  assert.equal(asksForStudySheet("transforma essa conversa em um resumo de prova"), true);
  assert.equal(asksForStudySheet("faz uma folha de revisão para a prova"), true);
  assert.equal(asksForStudySheet("resumo de prova"), true);
  assert.equal(asksForStudySheet("como fazer um bom resumo?"), false);
});

test("bloco ```arquivo: cabeçalho, título e nome do arquivo", () => {
  const file = parseFileBlock("tipo: planilha\ntitulo: Gastos do Mês\n---\n## Gastos\n| a | b |\n| --- | --- |\n| 1 | 2 |");
  assert.equal(file.tipo, "excel");
  assert.equal(file.titulo, "Gastos do Mês");
  assert.match(file.corpo, /^## Gastos/);
  assert.equal(fileBaseName("Resumo de Fotossíntese — 1º ano"), "resumo-de-fotossintese-1o-ano");
  const semCabecalho = parseFileBlock("# Ciclo da água\n\nTexto.");
  assert.equal(semCabecalho.tipo, "pdf");
  assert.equal(semCabecalho.titulo, "Ciclo da água");
});

test("células: dinheiro, porcentagem, número brasileiro e fórmula em português", () => {
  assert.deepEqual(cellValue("R$ 1.234,56"), { kind: "number", value: 1234.56, percent: false });
  assert.deepEqual(cellValue("35%"), { kind: "number", value: 0.35, percent: true });
  assert.deepEqual(cellValue("12,5"), { kind: "number", value: 12.5, percent: false });
  assert.equal(cellValue("Caderno").kind, "text");
  assert.equal(cellValue("2026-11-20").kind, "text");
  assert.equal(excelFormula("SOMA(B2:B4)"), "SUM(B2:B4)");
  assert.equal(excelFormula("SE(B2>=6;\"Aprovado\";\"Recuperação\")"), 'IF(B2>=6,"Aprovado","Recuperação")');
  assert.equal(excelFormula("MÉDIA(B2:B4)*0,5"), "AVERAGE(B2:B4)*0.5");
});

test("planilha: abas pelos títulos, R$ não junta colunas e fórmula mostra o resultado", () => {
  const sheets = sheetsFromMarkdown("## Gastos\n| Item | Qtd | Preço (R$) | Total (R$) |\n| --- | --- | --- | --- |\n| Caderno | 2 | 15,50 | =B2*C2 |\n| Caneta | 5 | 2,00 | =B3*C3 |\n| Total | | | =SOMA(D2:D3) |\n\n## Metas\n| Meta | % |\n| --- | --- |\n| Ler | 50% |");
  assert.deepEqual(sheets.map((sheet) => sheet.name), ["Gastos", "Metas"]);
  assert.equal(sheets[0].rows[0].length, 4);
  assert.deepEqual(displayRows(sheets[0]).map((row) => row[3]), ["Total (R$)", "31,00", "10,00", "41,00"]);
  assert.match(sheetCsv(sheets[1]), /^﻿Meta;%\r\nLer;50%$/);
});

test("R$ no chat não vira fórmula nem junta colunas", () => {
  const [table] = parseBlocks("| Preço (R$) | Total (R$) |\n| --- | --- |\n| 1 | 2 |");
  assert.equal(table.type, "table");
  assert.deepEqual(table.header, ["Preço (R$)", "Total (R$)"]);
});

test("docx e xlsx são zips com as partes do Office", () => {
  const text = (bytes) => new TextDecoder().decode(bytes);
  const docx = buildDocx({ titulo: "Teste & <ok>", corpo: "## Seção\n\nTexto **forte** e ==grifo==.\n\n- item\n\n| a | b |\n| --- | --- |\n| 1 | 2 |" });
  assert.equal(docx[0], 0x50);
  assert.equal(docx[1], 0x4b);
  const docxText = text(docx);
  assert.match(docxText, /word\/document\.xml/);
  assert.match(docxText, /Teste &amp; &lt;ok&gt;/);
  assert.match(docxText, /<w:highlight w:val="yellow"\/>/);
  assert.match(docxText, /<w:tbl>/);
  const xlsx = text(buildXlsx({ titulo: "Notas", corpo: "## Notas\n| Aluno | Nota |\n| --- | --- |\n| Ana | 8,5 |\n| Média | =MÉDIA(B2:B2) |" }));
  assert.match(xlsx, /<sheet name="Notas"/);
  assert.match(xlsx, /<v>8\.5<\/v>/);
  assert.match(xlsx, /<f>AVERAGE\(B2:B2\)<\/f>/);
  assert.equal(zipFiles({ "a.txt": "oi" }).length, 30 + 5 + 2 + 46 + 5 + 22);
});

test("página HTML do arquivo: título, escape e sem # repetido", () => {
  const html = fileHtml({ titulo: "Ciclo da água", corpo: "# Ciclo da água\n\n<script>x</script> texto\n\n> [!DICA]\n> Beba água." }, { date: new Date(2026, 10, 20) });
  assert.match(html, /<title>Ciclo da água<\/title>/);
  assert.doesNotMatch(html, /<script>x/);
  assert.equal((html.match(/Ciclo da água<\/h/g) || []).length, 1);
  assert.match(html, /class="callout callout-tip"/);
  assert.match(html, /20 de novembro de 2026/);
});

test("glossário: marcador sai do texto e grifa só a primeira vez, sem acento", () => {
  const { text, terms } = extractGlossary("Os estômatos abrem de dia. Estomatos fecham à noite.\n\n[[glossario: estômatos = poros da folha que deixam o ar entrar ; ATP = energia da célula]]");
  assert.equal(text, "Os estômatos abrem de dia. Estomatos fecham à noite.");
  assert.deepEqual(terms.map((item) => item.term), ["estômatos", "ATP"]);
  const used = new Set();
  const parts = splitGlossaryTerms(text, terms, used);
  assert.deepEqual(parts.filter((part) => part.type === "term").map((part) => part.text), ["estômatos"]);
  assert.deepEqual(splitGlossaryTerms("ATPase não é ATP.", terms, used).filter((part) => part.type === "term").map((part) => part.text), ["ATP"]);
  const marked = markGlossary("## estômatos\n\nUse `estômatos` no código. Os estômatos e o ATP. Mais estômatos.", terms);
  assert.equal(splitMarked(marked).filter((part) => part.type === "term").map((part) => part.text).join(","), "estômatos,ATP");
  assert.match(marked, /^## estômatos\n\nUse `estômatos` no código\. Os estômatos e o ATP\. Mais estômatos\.$/);
  assert.equal(definitionOf("Estomatos", terms), "poros da folha que deixam o ar entrar");
  assert.equal(stripGlossary("Oi [[glossário: a = b]]"), "Oi");
  assert.equal(stripImageMarkers("Texto\n\n[[glossario: termo = def]]"), "Texto");
  assert.equal(stripPendingMarker("Texto [[glossa"), "Texto ");
});

test("busca acha conversa pelo texto da resposta em qualquer matéria", () => {
  const chats = [
    { subjectId: "s1", threadId: "t1", role: "user", text: "o que é fotossíntese?", createdAt: 1, threadTitle: "Fotossíntese" },
    { subjectId: "s1", threadId: "t1", role: "mine", text: "A **fotossíntese** usa os estômatos e a clorofila.", createdAt: 2 },
    { subjectId: undefined, threadId: "t2", role: "user", text: "Revolução Francesa", createdAt: 3, threadPinned: true },
  ];
  const hits = searchConversations(chats, "estomatos");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].threadId, "t1");
  assert.match(hits[0].snippet, /estômatos/);
  assert.equal(searchConversations(chats, "revolucao")[0].pinned, true);
  assert.deepEqual(searchConversations(chats, "x"), []);
});

test("imagem: formato e edição da foto anexada", () => {
  assert.equal(imageFormatFrom("cria um papel de parede pro celular de gatinhos"), "retrato");
  assert.equal(imageFormatFrom("faz um banner para o meu canal"), "paisagem");
  assert.equal(imageFormatFrom("cria um gato astronauta"), "");
  assert.equal(asksToGenerateImage("cria um papel de parede pro celular de um gato astronauta"), true);
  assert.equal(editsAttachedImage("transforma essa foto em estilo anime"), true);
  assert.equal(editsAttachedImage("deixa o fundo da minha foto azul"), true);
  assert.equal(editsAttachedImage("o que tem nessa foto?"), false);
  assert.equal(editsAttachedImage("resolve a questão da foto"), false);
  const [segment] = splitMessageMedia("[[gerar_imagem: a cat in space | Gato | anexo | retrato]]");
  assert.deepEqual(segment, { type: "generate", prompt: "a cat in space", caption: "Gato", edit: true, fromAttachment: true, formato: "retrato" });
  // o modelo esquece o formato: o servidor completa o marcador
  assert.equal(withImageRequest("Criei!\n\n[[gerar_imagem: a cat in space, vertical | Gato]]", { formato: "retrato" }), "Criei!\n\n[[gerar_imagem: a cat in space, vertical | Gato | retrato]]");
  assert.equal(withImageRequest("[[gerar_imagem: anime style | Foto | editar]]", { anexo: true }), "[[gerar_imagem: anime style | Foto | anexo]]");
  assert.equal(withImageRequest("[[gerar_imagem: a cat | Gato | paisagem]]", { formato: "paisagem" }), "[[gerar_imagem: a cat | Gato | paisagem]]");
  assert.equal(withImageRequest("[[gerar_imagem: a cat | Gato | editar]]", {}), "[[gerar_imagem: a cat | Gato | editar]]");
  const [antigo] = splitMessageMedia("[[gerar_imagem: a cat | Gato | editar]]");
  assert.deepEqual(antigo, { type: "generate", prompt: "a cat", caption: "Gato", edit: true });
});

test("salvar em PDF vai para a Mine, não para uma matéria chamada PDF", () => {
  assert.equal(chatActionFromPrompt("salva isso em pdf"), null);
  assert.equal(chatActionFromPrompt("salva isso em História")?.destino, "História");
});

test("dossiê de pesquisa aprofundada em HTML/PDF e Word: capa, sumário, indicadores, gráfico, linha do tempo e fontes", () => {
  const bloco = [
    "tipo: pdf",
    "modelo: pesquisa",
    "titulo: Energia Solar no Brasil",
    "subtitulo: Crescimento da geração, custos e desafios na rede",
    "materia: Geografia e Atualidades",
    "resumo: O Brasil ultrapassou 45 GW de potência solar instalada [1] e lidera na América Latina [2].",
    "---",
    "## 📊 1. Panorama atual",
    "A matriz elétrica brasileira mantém alta participação renovável [1].",
    "",
    "> [!DADOS] Indicadores essenciais",
    "> - **45 GW** | Potência solar instalada | ABSOLAR [1]",
    "> - **11,6%** | Participação na matriz elétrica | EPE [2]",
    "",
    "## Comparação entre fontes",
    "| Fonte | Participação (%) | Custo relativo |",
    "| --- | --- | --- |",
    "| Hidrelétrica | 56,8% | Baixo |",
    "| Solar | 11,6% | Médio-baixo |",
    "",
    "> [!GRAFICO] Participação na geração (%)",
    "> - Hidrelétrica | 56,8 | Base do sistema [2]",
    "> - Solar | 11,6 | Expansão rápida [1]",
    "",
    "## Marcos recentes",
    "> [!LINHA DO TEMPO] Evolução",
    "> - **2012** | Resolução 482 da ANEEL | Início da geração distribuída [1]",
    "> - **2022** | Lei 14.300 | Marco legal da microgeração [2]",
    "",
    "## Visões e desafios",
    "> [!DEBATE] Gargalos de transmissão",
    "> A expansão no Nordeste exige novas linhas de transmissão para escoar a energia [2].",
  ].join("\n");

  const file = parseFileBlock(bloco);
  assert.equal(file.modelo, "pesquisa");
  assert.equal(file.materia, "Geografia e Atualidades");
  assert.equal(file.subtitulo, "Crescimento da geração, custos e desafios na rede");

  const sources = [
    { url: "https://www.absolar.org.br/dados", title: "Infográfico ABSOLAR", domain: "absolar.org.br" },
    { url: "https://www.epe.gov.br/ben", title: "Balanço Energético Nacional", domain: "epe.gov.br" },
  ];
  const html = fileHtml(file, { date: new Date(2026, 10, 24), sources, queries: ["energia solar brasil gw", "balanco energetico epe"] });

  assert.match(html, /class="dossier-cover"/);
  assert.match(html, /Minerva · Pesquisa aprofundada/);
  assert.match(html, /Geografia e Atualidades/);
  assert.match(html, /class="exec-summary"/);
  assert.match(html, /class="toc"/);
  assert.match(html, /href="#sec-1"/);
  assert.match(html, /href="#referencias"/);
  // Tira emoji e numeração duplicada do h2 do dossiê
  assert.match(html, /<h2 id="sec-1" class="sec-h2"><span class="sec-num">01<\/span><span>Panorama atual<\/span><\/h2>/);
  assert.match(html, /class="kpi-grid"/);
  assert.match(html, /45 GW/);
  assert.match(html, /class="chart-box"/);
  assert.match(html, /class="timeline"/);
  assert.match(html, /class="callout callout-debate"/);
  // Citações viram âncoras para a bibliografia e todas as fontes entram no rodapé
  assert.match(html, /href="#ref-1" class="cite"/);
  assert.match(html, /id="ref-2"/);
  assert.match(html, /Balanço Energético Nacional/);
  assert.match(html, /Buscas realizadas:/);

  const docxText = new TextDecoder().decode(buildDocx(file, { date: new Date(2026, 10, 24), sources }));
  assert.match(docxText, /SÍNTESE EXECUTIVA/);
  assert.match(docxText, /\[1\]/);
  assert.match(docxText, /Referências e fontes consultadas/);
  assert.match(docxText, /epe\.gov\.br/);
});

test("ensureDeepResearchFile embrulha relatório solto e completa modelo: pesquisa", () => {
  const semModelo = "Síntese rápida [1].\n\n```arquivo\ntipo: pdf\ntitulo: Clima no Brasil\n---\n## Contexto\nTexto [1].\n```";
  const ajustado = ensureDeepResearchFile(semModelo, { prompt: "Clima no Brasil" });
  assert.match(ajustado, /modelo: pesquisa/);

  const solto = "Em resumo, o desmatamento caiu em 2025 segundo o INPE [1].\n\n## Contexto atual\nDados do PRODES mostram queda [1].\n\n## Causas e fiscalização\nAumento da fiscalização ambiental [2].\n\n[[sugestoes: E no Cerrado? | Quais os dados por estado?]]";
  const embrulhado = ensureDeepResearchFile(solto, { prompt: "Desmatamento na Amazônia" });
  assert.match(embrulhado, /```arquivo\ntipo: pdf\nmodelo: pesquisa/);
  assert.match(embrulhado, /\[\[sugestoes: E no Cerrado\?/);
});
