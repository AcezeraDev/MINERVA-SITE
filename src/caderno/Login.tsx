import React, { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Doodle, celebrate } from "./index";
import "./caderno-login.css";

export type LoginPayload = {
  mode: "login" | "register";
  name: string;
  password: string;
  adminMode: boolean;
  adminPassword: string;
};

type Mood = "idle" | "hello" | "shy" | "peek" | "thinking" | "confused" | "teacher";

/**
 * A Mine da tela de entrada. Tem mãos (para tapar os olhos quando a senha
 * está sendo digitada), capelo (modo professor) e cara de dúvida (erro). Os
 * olhos seguem o cursor escrevendo direto no atributo, uma vez por quadro.
 */
function LoginMine({ mood, reduced }: { mood: Mood; reduced: boolean }) {
  const eyes = useRef<SVGGElement | null>(null);
  const root = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    let last: PointerEvent | null = null;
    const paint = () => {
      frame = 0;
      if (!eyes.current || !root.current || !last) return;
      const rect = root.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.52;
      const angle = Math.atan2(last.clientY - cy, last.clientX - cx);
      const reach = Math.min(1, Math.hypot(last.clientX - cx, last.clientY - cy) / 520);
      eyes.current.setAttribute("transform", `translate(${(Math.cos(angle) * 9 * reach).toFixed(2)} ${(Math.sin(angle) * 7 * reach).toFixed(2)})`);
    };
    const onMove = (event: PointerEvent) => {
      last = event;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [reduced]);

  const happy = mood === "hello";
  return (
    <svg ref={root} viewBox="0 0 200 210" className={`login-mine mood-${mood}`} aria-hidden>
      {/* capelo (modo professor) */}
      <g className="login-mine-cap">
        <path className="lm-cap" d="M52 40 L100 20 L148 40 L100 58 Z" />
        <path className="lm-stroke" d="M140 44 L140 66" />
        <circle className="lm-tassel" cx="140" cy="70" r="5" />
      </g>
      <line className="lm-stroke" x1="100" y1="30" x2="100" y2="52" />
      <circle className="lm-bulb lm-stroke" cx="100" cy="24" r="10" />
      <rect className="lm-ear lm-stroke" x="18" y="92" width="22" height="48" rx="10" />
      <rect className="lm-ear lm-stroke" x="160" y="92" width="22" height="48" rx="10" />
      <rect className="lm-head lm-stroke" x="34" y="52" width="132" height="130" rx="42" />
      <rect className="lm-visor lm-stroke" x="52" y="78" width="96" height="70" rx="26" />
      <g ref={eyes}>
        {happy ? (
          <>
            <path className="lm-stroke lm-thin" d="M72 112 q9 -12 18 0" />
            <path className="lm-stroke lm-thin" d="M110 112 q9 -12 18 0" />
          </>
        ) : (
          <g className="lm-eyes">
            <ellipse className="lm-eye" cx="81" cy="110" rx="8" ry={mood === "confused" ? 6 : 10} />
            <ellipse className="lm-eye" cx="119" cy="110" rx="8" ry={mood === "confused" ? 10 : 10} />
          </g>
        )}
      </g>
      {mood === "confused" ? (
        <path className="lm-stroke lm-thin" d="M84 134 Q92 128 100 134 T116 134" />
      ) : mood === "thinking" ? (
        <circle className="lm-stroke lm-thin" cx="100" cy="134" r="4" />
      ) : (
        <path className="lm-stroke lm-thin" d="M86 131 Q100 144 114 131" />
      )}
      {/* bochechas */}
      <circle className="lm-cheek" cx="64" cy="132" r="6" />
      <circle className="lm-cheek" cx="136" cy="132" r="6" />
      {/* mãos: sobem para tapar os olhos */}
      <g className="lm-hand lm-hand-left">
        <path className="lm-palm lm-stroke" d="M58 206 C 50 182, 52 160, 62 150 C 66 146, 72 148, 72 154 L 72 138 C 72 130, 82 130, 82 138 L 82 134 C 82 126, 92 126, 92 134 L 92 144 C 92 136, 102 136, 102 144 L 102 176 C 102 196, 90 208, 58 206 Z" />
      </g>
      <g className="lm-hand lm-hand-right">
        <path className="lm-palm lm-stroke" d="M142 206 C 150 182, 148 160, 138 150 C 134 146, 128 148, 128 154 L 128 138 C 128 130, 118 130, 118 138 L 118 134 C 118 126, 108 126, 108 134 L 108 144 C 108 136, 98 136, 98 144 L 98 176 C 98 196, 110 208, 142 206 Z" />
      </g>
      {/* interrogação do erro */}
      <text className="lm-question" x="168" y="46">?</text>
    </svg>
  );
}

function initialsOf(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?"
  );
}

/**
 * Tela de entrada: a Mine reage a cada gesto e o formulário é uma folha de
 * caderno. Em "Criar conta", a carteirinha de estudante se preenche ao vivo.
 */
export function LoginScreen({
  authenticate,
  notify,
  brand,
  reduced,
}: {
  authenticate: (payload: LoginPayload) => Promise<void>;
  notify: (message: string) => void;
  brand: React.ReactNode;
  reduced: boolean;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [adminMode, setAdminMode] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focus, setFocus] = useState<"name" | "password" | "admin" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(0);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  const first = name.trim().split(/\s+/)[0] || "";
  const secretFocus = focus === "password" || focus === "admin";
  const mood: Mood = submitting
    ? "thinking"
    : error
      ? "confused"
      : secretFocus
        ? showPassword
          ? "peek"
          : "shy"
        : adminMode
          ? "teacher"
          : first
            ? "hello"
            : "idle";

  const bubble = submitting
    ? "Abrindo seu caderno..."
    : error
      ? `Hmm... ${error}`
      : secretFocus
        ? showPassword
          ? "Ops... só uma espiadinha!"
          : "Prometo que não tô olhando!"
        : adminMode
          ? "Modo professor? Que chique!"
          : first
            ? mode === "login"
              ? `Oi, ${first}! Que bom te ver.`
              : `Prazer, ${first}! Bora montar sua carteirinha.`
            : mode === "login"
              ? "Oi! Me diz seu nome pra eu abrir seu caderno."
              : "Vamos fazer sua carteirinha de estudante?"
    ;

  function switchMode(next: "login" | "register") {
    setMode(next);
    setAdminMode(false);
    setAdminPassword("");
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean || password.length < 3) {
      setError(!clean ? "faltou o seu nome." : "a senha precisa de pelo menos 3 letras.");
      setShake((value) => value + 1);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await authenticate({ mode, name: clean, password, adminMode, adminPassword });
      celebrate(window.innerWidth / 2, window.innerHeight * 0.45, { count: 80, spread: 2 });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Não foi possível entrar agora.";
      setError(message.charAt(0).toLowerCase() + message.slice(1));
      setShake((value) => value + 1);
      notify(message);
    } finally {
      setSubmitting(false);
    }
  }

  const today = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(new Date()).replace(".", "");

  return (
    <main className={`login-desk ${reduced ? "is-static" : ""}`}>
      {/* rabiscos na mesa */}
      <div className="login-scribbles" aria-hidden>
        {[
          { text: "π", x: 6, y: 12 },
          { text: "E = mc²", x: 36, y: 6 },
          { text: "H₂O", x: 4, y: 78 },
          { text: "a² + b² = c²", x: 30, y: 92 },
          { text: "√x", x: 46, y: 70 },
        ].map((item, index) => (
          <span key={item.text} className="login-scribble" style={{ left: `${item.x}%`, top: `${item.y}%`, "--d": `${0.2 + index * 0.15}s` } as React.CSSProperties}>
            {item.text}
          </span>
        ))}
        <Doodle kind="star" className="login-doodle login-doodle-a" delay={reduced ? 0 : 500} />
        <Doodle kind="bulb" className="login-doodle login-doodle-b" delay={reduced ? 0 : 800} />
        <Doodle kind="heart" className="login-doodle login-doodle-c" delay={reduced ? 0 : 1100} />
        <Doodle kind="sparkle" className="login-doodle login-doodle-d" delay={reduced ? 0 : 1400} />
      </div>

      <div className="login-layout">
        {/* ───────── palco da Mine ───────── */}
        <section className="login-stage" aria-live="polite">
          <motion.div className="login-brand" initial={reduced ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <span className="login-brand-mark">{brand}</span>
            <span>
              <strong>Minerva</strong>
              <em>seu caderno de estudos</em>
            </span>
          </motion.div>

          <div className="login-mine-wrap">
            <AnimatePresence mode="wait">
              <motion.p
                key={bubble}
                className={`login-bubble ${error ? "is-error" : ""}`}
                initial={reduced ? false : { opacity: 0, y: 8, scale: 0.9, rotate: -4 }}
                animate={{ opacity: 1, y: 0, scale: 1, rotate: -2 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 420, damping: 24 }}
              >
                {bubble}
              </motion.p>
            </AnimatePresence>
            <motion.div
              className="login-mine-body"
              initial={reduced ? false : { y: 60, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.2 }}
            >
              <LoginMine mood={mood} reduced={reduced} />
            </motion.div>
          </div>

          {/* carteirinha ao vivo (criar conta) */}
          <AnimatePresence>
            {mode === "register" ? (
              <motion.div
                key="idcard"
                className="login-idcard"
                initial={reduced ? false : { opacity: 0, y: 40, rotate: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, rotate: -3, scale: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: 30, rotate: 10 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <span className="login-idcard-hole" aria-hidden />
                <span className="login-idcard-photo">{initialsOf(name)}</span>
                <span className="login-idcard-info">
                  <small>carteirinha de estudante</small>
                  <strong>{name.trim() || "Seu nome aqui"}</strong>
                  <em>Nível 1 · Iniciante</em>
                </span>
                <span className="login-idcard-meta">
                  <span>MINERVA</span>
                  <span>desde {today}</span>
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>

        {/* ───────── a folha do formulário ───────── */}
        <motion.div
          key={shake}
          ref={sheetRef}
          className="login-sheet-wrap"
          initial={shake && !reduced ? { x: 0 } : reduced ? false : { opacity: 0, y: 40, rotate: 4 }}
          animate={shake && !reduced ? { x: [0, -14, 12, -8, 6, 0] } : { opacity: 1, y: 0, rotate: 0 }}
          transition={shake ? { duration: 0.45 } : { type: "spring", stiffness: 160, damping: 18, delay: 0.3 }}
        >
          <div className="login-tabs" role="tablist" aria-label="Entrar ou criar conta">
            {(["login", "register"] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={mode === item}
                onClick={() => switchMode(item)}
                className={`login-tab ${item === "login" ? "is-login" : "is-register"}`}
              >
                {item === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.form
              key={mode}
              onSubmit={submit}
              className="login-sheet"
              initial={reduced ? false : { rotateY: -70, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={reduced ? { opacity: 0 } : { rotateY: 70, opacity: 0 }}
              transition={{ duration: 0.38, ease: [0.3, 0.7, 0.2, 1] }}
              noValidate
            >
              <p className="login-note">{mode === "login" ? "de volta ao caderno" : "primeira página"}</p>
              <h1 className="login-title">
                {mode === "login" ? (
                  <>
                    Bem-vindo <span className="login-hl">de volta!</span>
                  </>
                ) : (
                  <>
                    Comece <span className="login-hl">agora!</span>
                  </>
                )}
              </h1>

              <label className="login-field">
                <span className="login-label">Nome</span>
                <input
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setError("");
                  }}
                  onFocus={() => setFocus("name")}
                  onBlur={() => setFocus(null)}
                  placeholder="escreva seu nome"
                  autoComplete="username"
                  maxLength={40}
                />
              </label>

              <label className="login-field">
                <span className="login-label">Senha</span>
                <span className="login-input-row">
                  <input
                    value={password}
                    type={showPassword ? "text" : "password"}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                    onFocus={() => setFocus("password")}
                    onBlur={() => setFocus(null)}
                    placeholder="sua senha secreta"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    className="login-eye"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? "🙈" : "👁"}
                  </button>
                </span>
              </label>

              <button
                type="button"
                className={`login-admin ${adminMode ? "is-on" : ""}`}
                aria-pressed={adminMode}
                onClick={() => {
                  setAdminMode((value) => !value);
                  setAdminPassword("");
                  setError("");
                }}
              >
                <span className="login-admin-box" aria-hidden>
                  {adminMode ? "✓" : ""}
                </span>
                {mode === "login" ? "Entrar como professor(a) / admin" : "Criar como professor(a) / admin"}
              </button>

              <AnimatePresence initial={false}>
                {adminMode ? (
                  <motion.label
                    className="login-field"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <span className="login-label">Senha de admin</span>
                    <input
                      value={adminPassword}
                      type="password"
                      onChange={(event) => setAdminPassword(event.target.value)}
                      onFocus={() => setFocus("admin")}
                      onBlur={() => setFocus(null)}
                      placeholder="senha administrativa"
                      autoComplete="off"
                    />
                  </motion.label>
                ) : null}
              </AnimatePresence>

              <motion.button
                type="submit"
                className="login-submit"
                disabled={submitting}
                whileHover={reduced ? undefined : { y: -2, rotate: -0.6 }}
                whileTap={{ scale: 0.97 }}
              >
                {submitting ? "Abrindo o caderno..." : mode === "login" ? "Abrir meu caderno" : "Criar minha conta"}
                <span aria-hidden className="login-submit-arrow">→</span>
              </motion.button>

              <p className="login-switch">
                {mode === "login" ? "Primeira vez por aqui?" : "Já tem conta?"}{" "}
                <button type="button" onClick={() => switchMode(mode === "login" ? "register" : "login")}>
                  {mode === "login" ? "Crie sua conta" : "Entrar"}
                </button>
              </p>
            </motion.form>
          </AnimatePresence>
        </motion.div>
      </div>
    </main>
  );
}
