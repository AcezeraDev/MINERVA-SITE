import { setTaskDone } from "../../shared/agenda.mjs";
import { celebrateFrom } from "../caderno";
import { MineRichText } from "../chat/MineRichText";
import { MateriaExtras } from "./MateriaExtras";
import { Reveal, Stagger, StaggerItem, spring } from "../motion";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Bot, Brain, CalendarCheck, Camera, Check, CheckCircle2, ChevronLeft, ClipboardCheck, ExternalLink, FileText, Layers, Link as LinkIcon, ListChecks, Loader2, Paperclip, Plus, Sparkles, Trash2, Wand2, type LucideIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import { EmptyState, GlassCard, HeroCard, MineAvatar, PageHeader, PrimaryButton, SecondaryButton, SectionTitle, TaskRow, go, iconMap, materialsToImageAttachments, percent, requestAssistantResponse, toggleStudied, uid, useMemoUserData, type AppData, type Material, type Modal, type Subject } from "../main";


export function SubjectView({
  subject,
  data,
  setModal,
  update,
  notify,
  setSelectedSubjectId,
}: {
  subject: Subject;
  data: ReturnType<typeof useMemoUserData>;
  setModal: (modal: Modal | null) => void;
  update: (next: (draft: AppData) => AppData) => void;
  notify: (message: string) => void;
  setSelectedSubjectId: (id: string | undefined) => void;
}) {
  const Icon = iconMap[subject.icon];
  const materials = data.materials.filter((item) => item.subjectId === subject.id);
  const tasks = data.tasks.filter((item) => item.subjectId === subject.id);
  const studied = materials.filter((item) => item.studied).length;
  const dueCards = data.flashcards.filter((item) => item.subjectId === subject.id && item.dueAt <= Date.now()).length;
  const [deskMaterialId, setDeskMaterialId] = useState<string | undefined>(() => materials.slice().sort((a, b) => b.createdAt - a.createdAt)[0]?.id);
  const deskMaterial = materials.find((item) => item.id === deskMaterialId) || materials[0];

  useEffect(() => {
    if (!materials.length) {
      setDeskMaterialId(undefined);
      return;
    }
    if (!materials.some((item) => item.id === deskMaterialId)) setDeskMaterialId(materials[0].id);
  }, [deskMaterialId, materials]);

  function confirmDeleteSubject() {
    setModal({
      type: "confirm",
      title: "Excluir matéria?",
      body: `"${subject.name}" será apagada com todos os conteúdos, tarefas, flashcards e conversas dela. Essa ação não tem volta.`,
      onConfirm: () => {
        update((draft) => ({
          ...draft,
          subjects: draft.subjects.filter((item) => item.id !== subject.id),
          materials: draft.materials.filter((item) => item.subjectId !== subject.id),
          tasks: draft.tasks.filter((item) => item.subjectId !== subject.id),
          chats: draft.chats.filter((item) => item.subjectId !== subject.id),
          sessions: draft.sessions.filter((item) => item.subjectId !== subject.id),
          flashcards: draft.flashcards.filter((item) => item.subjectId !== subject.id),
        }));
        notify("Matéria excluída.");
        go("home");
      },
    });
  }

  /**
   * "Mine ao lado": responde no próprio caderno da matéria, sem trocar de
   * página (relatório de QA de 16/11). A pergunta e a resposta também entram
   * na conversa da matéria, para continuar lá se o aluno quiser.
   */
  async function askAside(label: string, material: Material) {
    const prompt = `${label} com foco no material "${material.title}".`;
    const body = (material.content?.trim() || material.detail?.trim() || "").slice(0, 12000);
    const others = materials
      .filter((item) => item.id !== material.id)
      .slice(0, 8)
      .map((item) => `- ${item.title}: ${(item.content?.trim() || item.detail?.trim() || "").slice(0, 600) || "sem detalhe"}`)
      .join("\n");
    const context = [
      `Materia: ${subject.name}.`,
      `Material em foco: ${material.title}${material.type === "image" ? " [imagem enviada]" : ""}`,
      body ? `Texto do material:\n${body}` : "",
      others ? `Outros conteudos da materia (use se ajudar):\n${others}` : "",
      "Responda de forma curta e direta: cabe num painel lateral pequeno.",
    ]
      .filter(Boolean)
      .join("\n\n");
    const attachments = materialsToImageAttachments([material]);
    const assistant = await requestAssistantResponse({ prompt, history: [], context, attachments });
    const reply = assistant.reply.trim() || "Não consegui analisar agora. Tente novamente em instantes.";
    const now = Date.now();
    update((draft) => ({
      ...draft,
      chats: [
        ...draft.chats,
        { id: uid("chat"), userId: subject.userId, subjectId: subject.id, role: "user", text: prompt, createdAt: now },
        { id: uid("chat"), userId: subject.userId, subjectId: subject.id, role: "mine", text: reply, createdAt: now + 1 },
      ],
    }));
    return reply;
  }

  async function runQuick(label: string) {
    const fullPrompt = `${label} com base nos conteúdos que adicionei na matéria ${subject.name}. Use o que está cadastrado nesta matéria.`;
    update((draft) => ({
      ...draft,
      chats: [...draft.chats, { id: uid("chat"), userId: subject.userId, subjectId: subject.id, role: "user", text: fullPrompt, createdAt: Date.now() }],
    }));
    setSelectedSubjectId(subject.id);
    go("mine");
    let quickBudget = 40_000;
    const contentLines = materials
      .map((item) => {
        const body = (item.content?.trim() || item.detail?.trim() || "").slice(0, Math.max(0, Math.min(4000, quickBudget)));
        quickBudget -= body.length;
        return `- ${item.title}${item.type === "image" ? " [imagem enviada]" : ""}: ${body || "sem detalhe"}`;
      })
      .join("\n");
    const context = `Materia: ${subject.name}.\nConteudos desta materia (analise TODOS para responder):\n${contentLines || "- nenhum conteudo ainda"}`;
    const imageAttachments = materialsToImageAttachments(materials);
    try {
      const assistant = await requestAssistantResponse({ prompt: fullPrompt, history: [], context, attachments: imageAttachments });
      const reply = assistant.reply.trim() || "Não consegui analisar agora. Tente novamente em instantes.";
      update((draft) => ({
        ...draft,
        chats: [...draft.chats, { id: uid("chat"), userId: subject.userId, subjectId: subject.id, role: "mine", text: reply, createdAt: Date.now() + 1 }],
      }));
    } catch {
      update((draft) => ({
        ...draft,
        chats: [...draft.chats, { id: uid("chat"), userId: subject.userId, subjectId: subject.id, role: "mine", text: "Tive um problema para responder agora. Tente de novo em instantes.", createdAt: Date.now() + 1 }],
      }));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Matéria"
        title={subject.name}
        subtitle={(() => {
          const open = tasks.filter((task) => !task.done).length;
          return `${materials.length} ${materials.length === 1 ? "conteúdo" : "conteúdos"} · ${open} ${open === 1 ? "tarefa aberta" : "tarefas abertas"}`;
        })()}
        action={
          <>
            <IconButton icon={ChevronLeft} label="Voltar" onClick={() => go("home")} />
            <IconButton icon={Trash2} label="Excluir matéria" onClick={confirmDeleteSubject} />
            {/* Sem conteúdo, o botão grande do painel já é este: não repetir. */}
            {materials.length ? (
              <PrimaryButton onClick={() => setModal({ type: "material", subjectId: subject.id })} icon={Plus}>
                Adicionar conteúdo
              </PrimaryButton>
            ) : null}
          </>
        }
      />
      <div className="grid min-w-0 gap-5">
        <Reveal className="min-w-0">
          <HeroCard>
            {/* Capa da matéria: etiqueta colada, barra de progresso a marca-texto
                com o lápis na ponta e as ferramentas como fichas de fichário. */}
            <div className="caderno-subj">
              <div className="caderno-subj-grid">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="caderno-subj-sticker" style={{ "--subj": subject.color } as React.CSSProperties}>
                      <Icon className="h-7 w-7" />
                    </span>
                    <span className="caderno-note">painel da matéria</span>
                  </div>
                  {(() => {
                    // Nov/2026: o título genérico virou o próximo passo desta matéria.
                    const abertas = tasks.filter((task) => !task.done).sort((a, b) => a.dueAt - b.dueAt);
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    const atrasada = abertas.find((task) => task.dueAt < hoje.getTime());
                    const proxima = abertas[0];
                    const naoLido = materials.filter((item) => !item.studied).sort((a, b) => b.createdAt - a.createdAt)[0];
                    const passo = atrasada
                      ? { antes: "Primeiro, termine", grifo: atrasada.title, depois: ": passou do prazo.", cta: "Abrir na agenda", acao: () => go("agenda") }
                      : dueCards
                        ? { antes: "Hoje tem", grifo: `${dueCards} ${dueCards === 1 ? "flashcard" : "flashcards"}`, depois: " para revisar.", cta: "Revisar agora", acao: () => setModal({ type: "flashcards", subjectId: subject.id }) }
                        : naoLido
                          ? { antes: "Próximo conteúdo:", grifo: naoLido.title, depois: ".", cta: "Abrir conteúdo", acao: () => setModal({ type: "materialView", materialId: naoLido.id }) }
                          : proxima
                            ? { antes: "Próxima entrega:", grifo: proxima.title, depois: ".", cta: "Abrir na agenda", acao: () => go("agenda") }
                            : materials.length
                              ? { antes: "Tudo estudado.", grifo: "Hora de se testar", depois: ".", cta: "Fazer modo prova", acao: () => setModal({ type: "quiz", subjectId: subject.id }) }
                              : { antes: "Comece colocando o", grifo: "primeiro conteúdo", depois: ".", cta: "Adicionar conteúdo", acao: () => setModal({ type: "material", subjectId: subject.id }) };
                    return (
                      <>
                        <h2 className="caderno-subj-title">
                          {passo.antes} <span className="caderno-hl">{passo.grifo}</span>
                          {passo.depois}
                        </h2>
                        <button type="button" onClick={passo.acao} className="caderno-subj-next group" style={{ "--subj": subject.color } as React.CSSProperties}>
                          {passo.cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </button>
                      </>
                    );
                  })()}
                  {materials.length ? (
                    <div className="mt-6">
                      <div className="mb-2 flex items-baseline justify-between gap-3">
                        <span className="caderno-subj-label">progresso da matéria</span>
                        <span className="caderno-subj-percent tabular">{percent(studied, materials.length)}%</span>
                      </div>
                      <div className="caderno-subj-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent(studied, materials.length)} aria-label="Progresso da matéria">
                        <span className="caderno-subj-bar-fill" style={{ "--p": `${percent(studied, materials.length)}%`, "--subj": subject.color } as React.CSSProperties}>
                          <span className="caderno-subj-pencil" aria-hidden>✎</span>
                        </span>
                      </div>
                      {/* Nov/2026: os três post-its grandes viraram uma legenda;
                          repetiam o que a barra e o subtítulo já diziam. */}
                      <p className="caderno-subj-legend tabular">
                        <span className="is-mint">{studied} estudados</span>
                        <span className="is-pink">{Math.max(materials.length - studied, 0)} pendentes</span>
                        {dueCards ? <span className="is-yellow">{dueCards} flashcards para hoje</span> : null}
                      </p>
                    </div>
                  ) : (
                    <p className="caderno-subj-intro">
                      Tudo que você colocar aqui vira contexto para a Mine: ela resume, cria flashcards, monta provas e explica usando o seu material.
                    </p>
                  )}
                </div>
                {!materials.length ? (
                  <div className="caderno-subj-tipos">
                    <p className="caderno-subj-label">o que dá pra colocar</p>
                    {[
                      { icon: FileText, label: "Anotação", hint: "cole ou digite o texto da aula", kind: "note" as const },
                      { icon: Paperclip, label: "Arquivo", hint: "PDF, slides, apostila", kind: "file" as const },
                      { icon: Camera, label: "Foto", hint: "do caderno ou da lousa", kind: "image" as const },
                      { icon: LinkIcon, label: "Link", hint: "site, vídeo ou artigo", kind: "link" as const },
                    ].map((tipo) => (
                      <button key={tipo.label} type="button" onClick={() => setModal({ type: "material", subjectId: subject.id, kind: tipo.kind })} className="caderno-subj-tipo group">
                        <tipo.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <strong>{tipo.label}</strong>
                          <small>{tipo.hint}</small>
                        </span>
                        <Plus className="h-4 w-4 shrink-0 opacity-40 transition group-hover:opacity-100" aria-hidden />
                      </button>
                    ))}
                  </div>
                ) : (
                <Stagger className="grid content-start gap-2.5" gap={0.07}>
                  <StaggerItem>
                    <button
                      onClick={() => {
                        setSelectedSubjectId(subject.id);
                        go("mine");
                      }}
                      className="caderno-subj-mine group"
                    >
                      <Bot className="h-5 w-5" /> Abrir Mine
                      <ArrowRight className="ml-auto h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </button>
                  </StaggerItem>
                  {(
                    [
                      { icon: Layers, label: dueCards > 0 ? `Flashcards (${dueCards} hoje)` : "Flashcards", modal: { type: "flashcards" as const, subjectId: subject.id }, badge: dueCards, tone: "yellow" },
                      { icon: ClipboardCheck, label: "Modo prova", modal: { type: "quiz" as const, subjectId: subject.id }, badge: 0, tone: "pink" },
                      { icon: Wand2, label: "Mapa mental", modal: { type: "mindmap" as const, subjectId: subject.id }, badge: 0, tone: "lilac" },
                    ] as const
                  ).map((entry) => (
                    <StaggerItem key={entry.label}>
                      <button onClick={() => setModal(entry.modal)} className={`caderno-subj-tool is-${entry.tone} group`}>
                        <entry.icon className="h-5 w-5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                        {entry.badge > 0 ? (
                          <span className="caderno-subj-badge">{entry.badge}</span>
                        ) : (
                          <ArrowRight className="h-4 w-4 shrink-0 opacity-50 transition group-hover:translate-x-1 group-hover:opacity-100" />
                        )}
                      </button>
                    </StaggerItem>
                  ))}
                </Stagger>
                )}
              </div>

              {/* Nov/2026: as "Ações inteligentes" saíram do cartão próprio e
                  viraram uma faixa no rodapé do painel; só aparecem com conteúdo. */}
              {materials.length ? (
                <div className="caderno-subj-pedir">
                  <span className="caderno-subj-pedir-label">
                    <Sparkles className="h-4 w-4" aria-hidden /> pedir à Mine sobre a matéria toda
                  </span>
                  <div className="caderno-subj-pedir-lista">
                    {[
                      { label: "Gerar resumo", icon: FileText, tone: "mint" },
                      { label: "Criar perguntas", icon: ClipboardCheck, tone: "sky" },
                      { label: "Plano de revisão", icon: CalendarCheck, tone: "lilac" },
                      { label: "Explicar do zero", icon: Brain, tone: "yellow" },
                    ].map((item) => (
                      <button key={item.label} type="button" onClick={() => runQuick(item.label)} className={`caderno-subj-chip is-${item.tone}`}>
                        <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </HeroCard>
        </Reveal>

        {materials.length ? (
        <SubjectNotebook
          subject={subject}
          materials={materials}
          selectedMaterial={deskMaterial}
          selectMaterial={setDeskMaterialId}
          openMaterial={(materialId) => setModal({ type: "materialView", materialId })}
          addMaterial={() => setModal({ type: "material", subjectId: subject.id })}
          askMine={(prompt) => void runQuick(prompt)}
          askAside={askAside}
          openConversation={() => {
            setSelectedSubjectId(subject.id);
            go("mine");
          }}
          markStudied={(materialId) =>
            update((draft) => ({
              ...draft,
              materials: draft.materials.map((item) => (item.id === materialId ? toggleStudied(item, true) : item)),
            }))
          }
        />
        ) : null}

        {/* Nov/2026: trilha, livros, fórmulas, vídeos e questões do ENEM.
            amount mínimo: com a Biblioteca aberta a seção passa de 4.000 px e
            nunca teria 18% dela na tela de um celular (ficava invisível). */}
        <Reveal delay={0.08} className="min-w-0" amount={0.01}>
          <MateriaExtras
            nome={subject.name}
            icone={subject.icon}
            conteudos={materials.slice(0, 12).map((item) => `${item.title}: ${(item.content?.trim() || item.detail?.trim() || "").slice(0, 160)}`)}
            extras={subject.extras || {}}
            salvar={(next) =>
              update((draft) => ({
                ...draft,
                subjects: draft.subjects.map((item) => (item.id === subject.id ? { ...item, extras: typeof next === "function" ? next(item.extras || {}) : next } : item)),
              }))
            }
            perguntarMine={(prompt) => void runQuick(prompt)}
            notify={notify}
          />
        </Reveal>

        {/* A lista "Conteúdos" saiu: repetia o índice do caderno acima. */}
          <Reveal delay={0.1} className="min-w-0">
            <GlassCard>
              <SectionTitle
                icon={CalendarCheck}
                title="Tarefas"
                hint={tasks.length ? `${tasks.filter((task) => !task.done).length} abertas` : "provas, trabalhos e entregas desta matéria"}
                action={
                  <SecondaryButton icon={Plus} onClick={() => setModal({ type: "task", subjectId: subject.id })}>
                    Nova
                  </SecondaryButton>
                }
              />
              <Stagger className="mt-4 grid gap-2.5 lg:grid-cols-2" gap={0.04}>
                {tasks.map((task) => (
                  <StaggerItem key={task.id}>
                    <TaskRow
                      task={task}
                      subject={subject}
                      toggle={() =>
                        update((draft) => ({
                          ...draft,
                          tasks: setTaskDone(draft.tasks, task.id, undefined),
                        }))
                      }
                      remove={() => {
                        update((draft) => ({ ...draft, tasks: draft.tasks.filter((item) => item.id !== task.id) }));
                        notify("Tarefa excluída.");
                      }}
                    />
                  </StaggerItem>
                ))}
              </Stagger>
              {!tasks.length ? (
                <p className="caderno-subj-semtarefa">Nenhuma entrega marcada. Crie uma com prazo e ela aparece também na Agenda.</p>
              ) : null}
            </GlassCard>
          </Reveal>
      </div>
    </>
  );
}

function SubjectNotebook({
  subject,
  materials,
  selectedMaterial,
  selectMaterial,
  openMaterial,
  addMaterial,
  askAside,
  openConversation,
  markStudied,
}: {
  subject: Subject;
  materials: Material[];
  selectedMaterial?: Material;
  selectMaterial: (materialId: string) => void;
  openMaterial: (materialId: string) => void;
  addMaterial: () => void;
  askMine: (prompt: string) => void;
  askAside: (label: string, material: Material) => Promise<string>;
  openConversation: () => void;
  markStudied: (materialId: string) => void;
}) {
  const [aside, setAside] = useState<{ materialId: string; label: string; status: "loading" | "done" | "error"; text: string } | null>(null);
  const asideFor = aside && aside.materialId === selectedMaterial?.id ? aside : null;
  const runAside = (label: string) => {
    if (!selectedMaterial || asideFor?.status === "loading") return;
    const materialId = selectedMaterial.id;
    setAside({ materialId, label, status: "loading", text: "" });
    askAside(label, selectedMaterial)
      .then((text) => setAside((current) => (current && current.materialId === materialId && current.label === label ? { ...current, status: "done", text } : current)))
      .catch(() =>
        setAside((current) =>
          current && current.materialId === materialId ? { ...current, status: "error", text: "Não consegui responder agora. Tente de novo em instantes." } : current,
        ),
      );
  };
  const previewText = selectedMaterial?.content?.trim() || selectedMaterial?.detail?.trim() || "Este conteúdo ainda não possui texto para pré-visualizar.";
  const MaterialIcon = selectedMaterial
    ? selectedMaterial.type === "link" ? LinkIcon : selectedMaterial.type === "file" ? Paperclip : selectedMaterial.type === "image" ? Camera : FileText
    : BookOpen;

  return (
    <Reveal delay={0.08} className="min-w-0">
      {/* O caderno aberto: índice à esquerda, a folha pautada no meio e um
          post-it da Mine colado na borda. */}
      <section className="caderno-sn">
        <header className="caderno-sn-head">
          <div>
            <p className="caderno-note">caderno da matéria</p>
            <h2 className="mt-1 font-display text-xl font-black tracking-[-.03em]">Leia, conecte e pergunte <span className="caderno-hl">sem trocar de página</span>.</h2>
          </div>
          <span className="caderno-sn-count">{materials.length} {materials.length === 1 ? "conteúdo" : "conteúdos"} em {subject.name}</span>
        </header>

        {selectedMaterial ? (
          <div className="caderno-sn-spread">
            <aside className="caderno-sn-index">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="caderno-sn-label">índice</p>
                <button type="button" onClick={addMaterial} aria-label="Adicionar conteúdo ao caderno" className="caderno-sn-add"><Plus className="h-4 w-4" /></button>
              </div>
              <ol className="caderno-sn-list minerva-scroll">
                {materials.map((material, index) => {
                  const active = material.id === selectedMaterial.id;
                  return (
                    <li key={material.id}>
                      <button
                        type="button"
                        onClick={() => selectMaterial(material.id)}
                        aria-pressed={active}
                        className={`caderno-sn-entry ${active ? "is-active" : ""}`}
                      >
                        <span className="caderno-sn-entry-num">{String(index + 1).padStart(2, "0")}</span>
                        <span className="min-w-0 flex-1">
                          <span className="caderno-sn-entry-title">{material.title}</span>
                          <span className="caderno-sn-entry-state">{material.studied ? "✓ estudado" : "pendente"}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </aside>

            <article className="caderno-sn-page">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="caderno-sn-icon"><MaterialIcon className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <p className="caderno-sn-label">lendo agora</p>
                    <h3 className="caderno-sn-title">{selectedMaterial.title}</h3>
                  </div>
                </div>
                <button type="button" onClick={() => openMaterial(selectedMaterial.id)} className="caderno-sn-open">abrir ↗</button>
              </div>

              {selectedMaterial.type === "image" && selectedMaterial.dataUrl ? (
                <figure className="caderno-sn-photo">
                  <img src={selectedMaterial.dataUrl} alt={selectedMaterial.title} className="max-h-64 w-full object-contain" />
                </figure>
              ) : (
                <div className="caderno-sn-text minerva-scroll">
                  {previewText.split(/\n+/).map((paragraph, index) => <p key={`${paragraph.slice(0, 20)}-${index}`}>{paragraph}</p>)}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {!selectedMaterial.studied ? (
                  <button type="button" onClick={(event) => { const el = event.currentTarget; markStudied(selectedMaterial.id); celebrateFrom(el, { count: 18 }); }} className="caderno-sn-done"><Check className="h-4 w-4" /> Marcar estudado</button>
                ) : <span className="caderno-sn-stamp"><CheckCircle2 className="h-4 w-4" /> estudado!</span>}
                {selectedMaterial.type === "link" && selectedMaterial.detail ? <a href={selectedMaterial.detail} target="_blank" rel="noreferrer" className="caderno-sn-open">Visitar fonte <ExternalLink className="h-3.5 w-3.5" /></a> : null}
              </div>
            </article>

            <aside className="caderno-sn-postit">
              <span className="caderno-sn-tape" aria-hidden />
              <div className="flex items-center gap-3">
                <MineAvatar size="sm" />
                <div className="min-w-0"><p className="caderno-sn-postit-title">Mine ao lado</p><p className="caderno-sn-postit-sub truncate">sobre: {selectedMaterial.title}</p></div>
              </div>
              <p className="caderno-sn-postit-text">Me chama que eu explico este conteúdo, e ainda uso os outros materiais da matéria.</p>
              <div className="mt-3 space-y-1.5">
                {[
                  ["Explicar passo a passo", ListChecks],
                  ["Criar perguntas", ClipboardCheck],
                  ["Resumir em tópicos", FileText],
                ].map(([label, Icon]) => (
                  <button
                    key={String(label)}
                    type="button"
                    onClick={() => runAside(label as string)}
                    disabled={asideFor?.status === "loading"}
                    aria-pressed={asideFor?.label === label}
                    className="caderno-sn-ask group"
                  >
                    {asideFor?.status === "loading" && asideFor.label === label
                      ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      : React.createElement(Icon as LucideIcon, { className: "h-4 w-4 shrink-0" })}
                    <span className="min-w-0 flex-1 truncate">{label as string}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 transition group-hover:translate-x-1" />
                  </button>
                ))}
              </div>
              {asideFor ? (
                <div className="caderno-sn-answer minerva-scroll" role="status" aria-live="polite">
                  {asideFor.status === "loading" ? (
                    <p className="caderno-note">a Mine está lendo o material…</p>
                  ) : asideFor.status === "error" ? (
                    <p>{asideFor.text}</p>
                  ) : (
                    <MineRichText text={asideFor.text} />
                  )}
                  {asideFor.status !== "loading" ? (
                    <button type="button" onClick={openConversation} className="caderno-sn-open mt-2">
                      continuar na conversa ↗
                    </button>
                  ) : null}
                </div>
              ) : null}
            </aside>
          </div>
        ) : (
          <div className="p-5 sm:p-8">
            <EmptyState icon={BookOpen} title="Seu caderno começa com um conteúdo" text="Adicione uma anotação, arquivo, link ou imagem para ler e conversar com a Mine no mesmo espaço." action={<PrimaryButton icon={Plus} onClick={addMaterial}>Adicionar conteúdo</PrimaryButton>} />
          </div>
        )}
      </section>
    </Reveal>
  );
}

function IconButton({ icon: Icon, onClick, label }: { icon: LucideIcon; onClick: () => void; label: string }) {
  return (
    <motion.button
      onClick={onClick}
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.94 }}
      transition={spring.snappy}
      className="group relative grid h-13 w-13 place-items-center rounded-[.85rem] border border-white/10 bg-transparent text-white/65 transition-control duration-control hover:border-white/25 hover:bg-white/[0.04] hover:text-white"
    >
      <Icon className="relative h-[21px] w-[21px]" />
    </motion.button>
  );
}