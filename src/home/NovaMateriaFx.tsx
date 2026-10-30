/**
 * Cena de "matéria nova": o caderno cai na mesa, a capa abre, o nome é
 * escrito à mão na primeira página, um carimbo bate e o caderno voa para a
 * estante. Ouve o evento "minerva:materia-criada" (disparado pelo SubjectModal)
 * e vive no App, então funciona de qualquer tela.
 *
 * Toda a coreografia é CSS (keyframes em home.css): não depende do rAF do
 * framer, que trava com o painel oculto, e some sozinha mesmo se a aba
 * perder o foco no meio.
 */
import React, { useEffect, useRef, useState } from "react";
import { celebrateFrom } from "../caderno";
import { useSoftMotion } from "../motion";
import "./home.css";

export type MateriaCriada = { id: string; name: string; color: string };

export function anunciarMateria(detalhe: MateriaCriada) {
  window.dispatchEvent(new CustomEvent<MateriaCriada>("minerva:materia-criada", { detail: detalhe }));
}

const duracaoMs = 2900;

export function NovaMateriaFx() {
  const reduced = useSoftMotion();
  const [atual, setAtual] = useState<(MateriaCriada & { chave: number }) | null>(null);
  const carimboRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const ouvir = (event: Event) => {
      const detalhe = (event as CustomEvent<MateriaCriada>).detail;
      if (detalhe?.name) setAtual({ ...detalhe, chave: Date.now() });
    };
    window.addEventListener("minerva:materia-criada", ouvir);
    return () => window.removeEventListener("minerva:materia-criada", ouvir);
  }, []);

  useEffect(() => {
    if (!atual) return;
    const fim = window.setTimeout(() => setAtual(null), reduced ? 1400 : duracaoMs);
    const festa = reduced ? 0 : window.setTimeout(() => celebrateFrom(carimboRef.current, { count: 40, spread: 1.1 }), 1450);
    return () => {
      window.clearTimeout(fim);
      window.clearTimeout(festa);
    };
  }, [atual, reduced]);

  if (!atual) return null;
  return (
    <div
      key={atual.chave}
      className={`nova-materia ${reduced ? "is-calma" : ""}`}
      role="status"
      aria-live="polite"
      onClick={() => setAtual(null)}
      style={{ "--cor": atual.color } as React.CSSProperties}
    >
      <div className="nova-materia-palco">
        <div className="nova-materia-caderno">
          <div className="nova-materia-pagina">
            <span className="nova-materia-pauta" aria-hidden />
            <small>matéria nova</small>
            <strong className="nova-materia-nome">{atual.name}</strong>
            <span className="nova-materia-grifo" aria-hidden />
          </div>
          <div className="nova-materia-capa" aria-hidden>
            <span className="nova-materia-etiqueta">{(atual.name.trim()[0] || "?").toUpperCase()}</span>
            <span className="nova-materia-espiral" />
          </div>
        </div>
        <span ref={carimboRef} className="nova-materia-carimbo" aria-hidden>
          pronta!
        </span>
      </div>
      <span className="sr-only">Matéria {atual.name} criada.</span>
    </div>
  );
}
