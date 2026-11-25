import React, { useEffect, useState } from "react";
import { Atom, Calculator } from "lucide-react";
import { PageHeader, go } from "../main";
import { Calculadora } from "./Calculadora";
import { TabelaPeriodica } from "./TabelaPeriodica";
import "./ferramentas.css";

/**
 * Aba Ferramentas (#/ferramentas): instrumentos de bancada da escola que o
 * aluno usa sem precisar da IA. A Mine entra só quando ele pede ("Perguntar à
 * Mine"), abrindo o chat com a pergunta já escrita.
 *
 * Cada ferramenta tem endereço próprio (#/ferramentas/calculadora,
 * #/ferramentas/tabela) para dar para mandar o link direto.
 */
type AbaId = "calculadora" | "tabela";

const ABAS: Array<{ id: AbaId; nome: string; dica: string; icone: typeof Calculator }> = [
  { id: "calculadora", nome: "Calculadora", dica: "científica, equações e gráficos", icone: Calculator },
  { id: "tabela", nome: "Tabela periódica", dica: "118 elementos, massa molar e balanceamento", icone: Atom },
];

export function FerramentasView({ userId, aba, askMine }: { userId: string; aba?: string; askMine: (text: string) => void }) {
  const atual: AbaId = aba === "tabela" ? "tabela" : "calculadora";
  const [montadas, setMontadas] = useState<Set<AbaId>>(() => new Set([atual]));
  useEffect(() => {
    setMontadas((antes) => (antes.has(atual) ? antes : new Set(antes).add(atual)));
  }, [atual]);

  return (
    <div className="ferr-page">
      <PageHeader
        eyebrow="Ferramentas"
        title="Sua bancada de estudo"
        subtitle="Calculadora científica e tabela periódica sempre à mão. Quando travar, a Mine explica."
      />
      <div className="ferr-abas" role="tablist" aria-label="Ferramentas">
        {ABAS.map((item) => {
          const Icone = item.icone;
          const ativa = item.id === atual;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`ferr-aba-${item.id}`}
              aria-selected={ativa}
              aria-controls={`ferr-painel-${item.id}`}
              className="ferr-aba"
              data-ativa={ativa || undefined}
              onClick={() => go("ferramentas", item.id)}
            >
              <Icone className="h-5 w-5" aria-hidden />
              <span>
                <strong>{item.nome}</strong>
                <small>{item.dica}</small>
              </span>
            </button>
          );
        })}
      </div>
      {/* Uma vez aberta, a ferramenta fica montada: trocar de aba não perde a conta digitada. */}
      {ABAS.map((item) =>
        montadas.has(item.id) ? (
          <section key={item.id} id={`ferr-painel-${item.id}`} role="tabpanel" aria-labelledby={`ferr-aba-${item.id}`} hidden={item.id !== atual}>
            {item.id === "calculadora" ? <Calculadora userId={userId} askMine={askMine} /> : <TabelaPeriodica askMine={askMine} />}
          </section>
        ) : null,
      )}
    </div>
  );
}

export default FerramentasView;
