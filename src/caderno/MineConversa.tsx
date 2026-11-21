// Balão de conversa da mini Mine (nov/2026). Abre por cima da Mine do canto
// quando uma aba chama `mineConversa(pergunta, contexto)` — o "Perguntar à
// Mine" do Laboratório, por exemplo — e deixa o aluno continuar a conversa ali
// mesmo, sem sair da tela em que está. Carregado sob demanda: o MineRichText
// traz KaTeX e realce de código, que não precisam pesar no carregamento.
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUp, Loader2, MessageSquareShare, X } from "lucide-react";
import { MineRichText } from "../chat/MineRichText";
import { mineHeaders } from "../mineAuth";

export type Fala = { role: "user" | "mine"; text: string; oculta?: boolean };

const instrucaoBalao =
  "Voce esta respondendo dentro de um balao de conversa pequeno, ao lado da tela em que o estudante esta. Seja direta e didatica: no maximo uns 150 palavras por resposta, paragrafos curtos, formulas em LaTeX simples quando ajudar, sem titulos grandes nem tabelas. Termine, quando fizer sentido, com uma pergunta curta que puxe o raciocinio do estudante.";

export function MineConversa({
  inicio,
  onFechar,
  onAbrirChat,
  reduced,
}: {
  inicio: { pergunta: string; contexto: string; titulo: string; key: number };
  onFechar: () => void;
  onAbrirChat: (falas: Fala[]) => void;
  reduced: boolean;
}) {
  // A primeira pergunta vem pronta da aba e é longa (carrega os números da
  // simulação): fica oculta e o balão mostra só o resumo dela.
  const [falas, setFalas] = useState<Fala[]>([{ role: "user", text: inicio.pergunta, oculta: true }]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);

  const perguntar = async (historico: Fala[]) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 90_000);
    setPensando(true);
    setErro("");
    const ultima = historico[historico.length - 1];
    try {
      const response = await fetch("/api/mine/chat", {
        method: "POST",
        headers: mineHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          prompt: ultima.text,
          context: `${instrucaoBalao}\n\n${inicio.contexto}`,
          history: historico.slice(0, -1).map((fala) => ({ role: fala.role, text: fala.text })),
          maxOutputTokens: 1800,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "A Mine não respondeu agora.");
      const resposta = String(data.reply || "").trim();
      if (!resposta) throw new Error("A Mine não respondeu agora.");
      setFalas((atual) => [...atual, { role: "mine", text: resposta }]);
    } catch (error) {
      if (controller.signal.aborted && abortRef.current !== controller) return;
      setErro(controller.signal.aborted ? "A Mine demorou demais. Tenta de novo?" : error instanceof Error ? error.message : "A Mine não respondeu agora.");
    } finally {
      window.clearTimeout(timer);
      if (abortRef.current === controller) setPensando(false);
    }
  };

  // Uma pergunta nova da aba (outro clique em "Perguntar à Mine") recomeça.
  useEffect(() => {
    const primeira: Fala[] = [{ role: "user", text: inicio.pergunta, oculta: true }];
    setFalas(primeira);
    void perguntar(primeira);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio.key]);

  useEffect(() => {
    const lista = listaRef.current;
    if (lista) lista.scrollTo({ top: lista.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [falas, pensando, reduced]);

  useEffect(() => {
    const esc = (event: KeyboardEvent) => event.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  const enviar = () => {
    const limpo = texto.trim();
    if (!limpo || pensando) return;
    const historico: Fala[] = [...falas, { role: "user", text: limpo.slice(0, 2000) }];
    setFalas(historico);
    setTexto("");
    void perguntar(historico);
    campoRef.current?.focus();
  };

  return (
    <motion.section
      className="mine-conversa"
      aria-label="Conversa com a Mine"
      initial={reduced ? false : { opacity: 0, y: 18, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
    >
      <header className="mine-conversa-topo">
        <div className="min-w-0">
          <p className="mine-conversa-nome">Mine</p>
          <p className="mine-conversa-assunto">{inicio.titulo}</p>
        </div>
        <button type="button" className="mine-conversa-icone" onClick={() => onAbrirChat(falas)} aria-label="Continuar no chat da Mine" title="Continuar no chat da Mine">
          <MessageSquareShare className="h-4 w-4" />
        </button>
        <button type="button" className="mine-conversa-icone" onClick={onFechar} aria-label="Fechar conversa" title="Fechar (Esc)">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div ref={listaRef} className="mine-conversa-lista" aria-live="polite">
        {falas.map((fala, i) =>
          fala.oculta ? (
            <p key={i} className="mine-conversa-pedido">
              Você pediu para a Mine explicar <strong>{inicio.titulo.toLocaleLowerCase("pt-BR")}</strong> com os seus números.
            </p>
          ) : (
            <div key={i} className={`mine-conversa-fala is-${fala.role}`}>
              {fala.role === "mine" ? <MineRichText text={fala.text} /> : <p>{fala.text}</p>}
            </div>
          ),
        )}
        {pensando ? (
          <div className="mine-conversa-fala is-mine is-pensando" role="status">
            <span />
            <span />
            <span />
            <span className="sr-only">A Mine está pensando</span>
          </div>
        ) : null}
        {erro ? (
          <div className="mine-conversa-erro" role="alert">
            {erro}{" "}
            <button type="button" onClick={() => perguntar(falas)}>
              tentar de novo
            </button>
          </div>
        ) : null}
      </div>

      <form
        className="mine-conversa-campo"
        onSubmit={(event) => {
          event.preventDefault();
          enviar();
        }}
      >
        <textarea
          ref={campoRef}
          value={texto}
          rows={1}
          onChange={(event) => setTexto(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              enviar();
            }
          }}
          placeholder="Escreva para a Mine…"
          aria-label="Mensagem para a Mine"
        />
        <button type="submit" disabled={!texto.trim() || pensando} aria-label="Enviar">
          {pensando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </form>
    </motion.section>
  );
}
