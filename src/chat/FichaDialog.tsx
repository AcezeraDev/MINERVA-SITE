import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, Lock, ShieldCheck, Sparkles, UserRound, X } from "lucide-react";
import { gravarFicha, hashPin, lerFicha, type Ficha, type Janela } from "./ficha";
import "./desenhar.css";
import "./ficha.css";

/*
 * Painel "O que a Mine sabe de mim" (25/nov/2026): a ficha do estudante, o
 * Horário de estudo e o Modo família. Abre pelo "+" do chat.
 */

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SERIES = ["6º ano", "7º ano", "8º ano", "9º ano", "1º ano do médio", "2º ano do médio", "3º ano do médio", "Cursinho / ENEM", "Faculdade", "Concurso"];
const JEITOS = ["Exemplos do dia a dia", "Desenhos e esquemas", "Passo a passo", "Resumos curtos", "Exercícios logo de cara", "Analogias e histórias"];

type Aba = "perfil" | "horario" | "familia";

function JanelaCampos({ janela, onChange, disabled = false, rotulo }: { janela: Janela; onChange: (janela: Janela) => void; disabled?: boolean; rotulo: string }) {
  return (
    <fieldset className="mfi-janela" disabled={disabled}>
      <legend className="sr-only">{rotulo}</legend>
      <div className="mfi-linha">
        <label>
          Das
          <input type="time" value={janela.inicio} onChange={(event) => onChange({ ...janela, inicio: event.target.value })} />
        </label>
        <label>
          às
          <input type="time" value={janela.fim} onChange={(event) => onChange({ ...janela, fim: event.target.value })} />
        </label>
      </div>
      <div className="mfi-dias" role="group" aria-label="Dias da semana">
        {DIAS.map((dia, i) => (
          <button
            key={dia}
            type="button"
            aria-pressed={janela.dias.includes(i)}
            onClick={() => onChange({ ...janela, dias: janela.dias.includes(i) ? janela.dias.filter((d) => d !== i) : [...janela.dias, i].sort() })}
          >
            {dia}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function FichaDialog({ userId, onClose, abaInicial = "perfil" }: { userId: string; onClose: () => void; abaInicial?: Aba }) {
  const [ficha, setFicha] = useState<Ficha>(() => lerFicha(userId));
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [pin, setPin] = useState("");
  const [destravado, setDestravado] = useState(() => !lerFicha(userId).familia.pin);
  const [aviso, setAviso] = useState("");
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const perfil = ficha.perfil;
  const setPerfil = (campo: keyof Ficha["perfil"], valor: string) => setFicha((f) => ({ ...f, perfil: { ...f.perfil, [campo]: valor } }));
  const jeitosMarcados = perfil.aprendo.split(/\s*;\s*/).filter(Boolean);
  const familiaLigada = Boolean(ficha.familia.pin);
  // Com o modo família ligado, o horário de estudo e o tutor ficam presos ao PIN.
  const travado = familiaLigada && !destravado;

  const salvar = () => {
    gravarFicha(userId, ficha);
    setSalvo(true);
    window.setTimeout(() => setSalvo(false), 1800);
  };

  const destravar = async () => {
    if ((await hashPin(pin)) === ficha.familia.pin) {
      setDestravado(true);
      setAviso("");
      setPin("");
    } else setAviso("PIN errado.");
  };

  const ligarFamilia = async () => {
    if (!/^\d{4,8}$/.test(pin)) {
      setAviso("O PIN precisa ter de 4 a 8 números.");
      return;
    }
    const hash = await hashPin(pin);
    const nova = { ...ficha, familia: { ...ficha.familia, pin: hash } };
    setFicha(nova);
    gravarFicha(userId, nova);
    setPin("");
    setAviso("Modo família ligado. Guarde o PIN: ele é pedido para mudar estes ajustes.");
  };

  const desligarFamilia = () => {
    const nova = { ...ficha, familia: { ...ficha.familia, pin: "", tutorSempre: false, descanso: { ...ficha.familia.descanso, ativo: false } } };
    setFicha(nova);
    gravarFicha(userId, nova);
    setDestravado(true);
    setAviso("Modo família desligado.");
  };

  return createPortal(
    <div className="mds-fundo" role="dialog" aria-modal="true" aria-label="O que a Mine sabe de mim" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="mfi-janela">
        <header className="mfi-topo">
          <strong>
            <Sparkles aria-hidden /> O que a Mine sabe de mim
          </strong>
          <button type="button" className="mds-icone" onClick={onClose} aria-label="Fechar">
            <X aria-hidden />
          </button>
        </header>
        <div className="mfi-abas" role="tablist">
          <button type="button" role="tab" aria-selected={aba === "perfil"} onClick={() => setAba("perfil")}>
            <UserRound aria-hidden /> Sobre mim
          </button>
          <button type="button" role="tab" aria-selected={aba === "horario"} onClick={() => setAba("horario")}>
            <Clock aria-hidden /> Horário de estudo
          </button>
          <button type="button" role="tab" aria-selected={aba === "familia"} onClick={() => setAba("familia")}>
            <ShieldCheck aria-hidden /> Família
          </button>
        </div>

        <div className="mfi-corpo">
          {aba === "perfil" ? (
            <>
              <p className="mfi-dica">A Mine usa isto em toda resposta: nível, exemplos e jeito de explicar. Fica só neste aparelho e você muda quando quiser.</p>
              <div className="mfi-grade">
                <label>
                  Como a Mine te chama
                  <input id="mfi-nome" value={perfil.nome} maxLength={60} onChange={(event) => setPerfil("nome", event.target.value)} placeholder="Ex.: Davi" />
                </label>
                <label>
                  Série ou etapa
                  <select id="mfi-serie" value={perfil.serie} onChange={(event) => setPerfil("serie", event.target.value)}>
                    <option value="">Escolher…</option>
                    {SERIES.map((serie) => (
                      <option key={serie}>{serie}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mfi-campo">
                <span>Aprendo melhor com</span>
                <div className="mfi-chips">
                  {JEITOS.map((jeito) => (
                    <button
                      key={jeito}
                      type="button"
                      aria-pressed={jeitosMarcados.includes(jeito)}
                      onClick={() => setPerfil("aprendo", (jeitosMarcados.includes(jeito) ? jeitosMarcados.filter((j) => j !== jeito) : [...jeitosMarcados, jeito]).join("; "))}
                    >
                      {jeito}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mfi-grade">
                <label>
                  Matérias difíceis
                  <input id="mfi-dificeis" value={perfil.dificeis} maxLength={200} onChange={(event) => setPerfil("dificeis", event.target.value)} placeholder="Ex.: Química, frações" />
                </label>
                <label>
                  Matérias em que vou bem
                  <input id="mfi-fortes" value={perfil.fortes} maxLength={200} onChange={(event) => setPerfil("fortes", event.target.value)} placeholder="Ex.: História" />
                </label>
              </div>
              <label className="mfi-campo">
                Objetivo
                <input id="mfi-objetivo" value={perfil.objetivo} maxLength={200} onChange={(event) => setPerfil("objetivo", event.target.value)} placeholder="Ex.: passar no ENEM 2027 para Medicina" />
              </label>
              <label className="mfi-campo">
                Mais alguma coisa que a Mine deve saber
                <textarea id="mfi-sobre" value={perfil.sobre} maxLength={500} rows={3} onChange={(event) => setPerfil("sobre", event.target.value)} placeholder="Ex.: tenho TDAH e prefiro respostas curtas" />
              </label>
              {perfil.preferencias.length ? (
                <div className="mfi-campo">
                  <span>Explicações que você disse ter entendido melhor</span>
                  <div className="mfi-chips">
                    {perfil.preferencias.map((item) => (
                      <button key={item} type="button" className="is-tirar" onClick={() => setFicha((f) => ({ ...f, perfil: { ...f.perfil, preferencias: f.perfil.preferencias.filter((p) => p !== item) } }))} aria-label={`Tirar: ${item}`}>
                        {item} <X aria-hidden />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : aba === "horario" ? (
            <>
              <p className="mfi-dica">Nesse horário o Modo tutor liga sozinho: a Mine te guia com dicas em vez de entregar a resposta pronta.</p>
              {travado ? (
                <p className="mfi-trava">
                  <Lock aria-hidden /> A família travou estes ajustes. Peça o PIN na aba Família.
                </p>
              ) : null}
              <label className="mfi-liga">
                <input type="checkbox" checked={ficha.horario.ativo} disabled={travado} onChange={(event) => setFicha((f) => ({ ...f, horario: { ...f.horario, ativo: event.target.checked } }))} />
                Ligar o Horário de estudo
              </label>
              <JanelaCampos rotulo="Horário de estudo" janela={ficha.horario} disabled={travado || !ficha.horario.ativo} onChange={(horario) => setFicha((f) => ({ ...f, horario }))} />
            </>
          ) : (
            <>
              <p className="mfi-dica">Para pais e responsáveis: deixa o Modo tutor sempre ligado e define um horário de descanso sem chat. A família nunca vê as conversas.</p>
              {familiaLigada && !destravado ? (
                <div className="mfi-pin">
                  <label>
                    PIN da família
                    <input id="mfi-pin" type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void destravar()} />
                  </label>
                  <button type="button" className="mfi-botao" onClick={() => void destravar()}>
                    Destravar
                  </button>
                </div>
              ) : (
                <>
                  <label className="mfi-liga">
                    <input type="checkbox" checked={ficha.familia.tutorSempre} onChange={(event) => setFicha((f) => ({ ...f, familia: { ...f.familia, tutorSempre: event.target.checked } }))} />
                    Modo tutor sempre ligado
                  </label>
                  <label className="mfi-liga">
                    <input type="checkbox" checked={ficha.familia.descanso.ativo} onChange={(event) => setFicha((f) => ({ ...f, familia: { ...f.familia, descanso: { ...f.familia.descanso, ativo: event.target.checked } } }))} />
                    Horário de descanso (o chat da Mine fica pausado)
                  </label>
                  <JanelaCampos rotulo="Horário de descanso" janela={ficha.familia.descanso} disabled={!ficha.familia.descanso.ativo} onChange={(descanso) => setFicha((f) => ({ ...f, familia: { ...f.familia, descanso } }))} />
                  {familiaLigada ? (
                    <button type="button" className="mfi-link" onClick={desligarFamilia}>
                      Desligar o modo família
                    </button>
                  ) : (
                    <div className="mfi-pin">
                      <label>
                        Criar um PIN (4 a 8 números)
                        <input id="mfi-novo-pin" type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} />
                      </label>
                      <button type="button" className="mfi-botao" onClick={() => void ligarFamilia()}>
                        Ligar modo família
                      </button>
                    </div>
                  )}
                </>
              )}
              {aviso ? (
                <p className="mfi-aviso" role="status">
                  {aviso}
                </p>
              ) : null}
            </>
          )}
        </div>

        <footer className="mfi-rodape">
          {salvo ? (
            <span role="status" className="mfi-salvo">
              Salvo
            </span>
          ) : null}
          <button type="button" className="mfi-link" onClick={onClose}>
            Fechar
          </button>
          <button type="button" className="mfi-botao" onClick={salvar} disabled={aba === "familia" && familiaLigada && !destravado}>
            Salvar
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
