/**
 * Cena de "matéria nova": o caderno cai na mesa com um quique, a capa abre
 * (com o verso de papel aparecendo), duas folhas viram atrás dela, um lápis
 * escreve o nome à mão, o marca-texto grifa, o carimbo bate com confete,
 * a capa fecha e o caderno voa para dentro da Mine na órbita da Home — de
 * onde o Sistema3D o solta em arco até a órbita.
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

const duracaoMs = 3200;

/** Para onde o caderno voa no fim: o centro da órbita da Home, se ela estiver na tela. */
function alvoDoVoo() {
  const orbita = document.querySelector(".he-orbita");
  const r = orbita?.getBoundingClientRect();
  if (!r || r.bottom < 0 || r.top > window.innerHeight) return { x: "34vw", y: "-40vh" };
  return { x: `${Math.round(r.left + r.width / 2 - window.innerWidth / 2)}px`, y: `${Math.round(r.top + r.height / 2 - window.innerHeight / 2)}px` };
}

export function NovaMateriaFx() {
  const reduced = useSoftMotion();
  const [atual, setAtual] = useState<(MateriaCriada & { chave: number; alvo: { x: string; y: string } }) | null>(null);
  const carimboRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const ouvir = (event: Event) => {
      const detalhe = (event as CustomEvent<MateriaCriada>).detail;
      if (detalhe?.name) setAtual({ ...detalhe, chave: Date.now(), alvo: alvoDoVoo() });
    };
    window.addEventListener("minerva:materia-criada", ouvir);
    return () => window.removeEventListener("minerva:materia-criada", ouvir);
  }, []);

  useEffect(() => {
    if (!atual) return;
    const fim = window.setTimeout(() => setAtual(null), reduced ? 1400 : duracaoMs);
    const festa = reduced ? 0 : window.setTimeout(() => celebrateFrom(carimboRef.current, { count: 46, spread: 1.2 }), 1950);
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
      style={{ "--cor": atual.color, "--alvo-x": atual.alvo.x, "--alvo-y": atual.alvo.y } as React.CSSProperties}
    >
      <span className="nova-materia-sombra" aria-hidden />
      <div className="nova-materia-palco">
        <div className="nova-materia-caderno">
          <span className="nova-materia-contracapa" aria-hidden />
          <div className="nova-materia-pagina">
            <small>matéria nova</small>
            <span className="nova-materia-linha">
              <strong className="nova-materia-nome">{atual.name}</strong>
              <span className="nova-materia-grifo" aria-hidden />
              <svg className="nova-materia-lapis" viewBox="0 0 120 22" aria-hidden>
                <path d="M0 11 L16 4 L16 18 Z" fill="#f2d3a0" stroke="#1d2440" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M0 11 L6 8.4 L6 13.6 Z" fill="#1d2440" />
                <rect x="16" y="4" width="78" height="14" fill="#ffd23f" stroke="#1d2440" strokeWidth="1.6" />
                <path d="M16 11 H94" stroke="#e8b400" strokeWidth="1.4" />
                <rect x="94" y="4" width="9" height="14" fill="#c7ccd8" stroke="#1d2440" strokeWidth="1.6" />
                <rect x="103" y="4" width="15" height="14" rx="4" fill="#ff8fab" stroke="#1d2440" strokeWidth="1.6" />
              </svg>
            </span>
          </div>
          <span className="nova-materia-folha" aria-hidden />
          <span className="nova-materia-folha is-2" aria-hidden />
          <div className="nova-materia-capa" aria-hidden>
            <span className="nova-materia-capa-frente">
              <span className="nova-materia-etiqueta">{(atual.name.trim()[0] || "?").toUpperCase()}</span>
              <span className="nova-materia-espiral" />
            </span>
            <span className="nova-materia-capa-verso" />
          </div>
        </div>
        <span className="nova-materia-onda" aria-hidden />
        <span ref={carimboRef} className="nova-materia-carimbo" aria-hidden>
          pronta!
        </span>
      </div>
      <span className="sr-only">Matéria {atual.name} criada.</span>
    </div>
  );
}
