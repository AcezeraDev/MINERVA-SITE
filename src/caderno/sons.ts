/*
  Sons do caderno, sintetizados na hora com Web Audio (nenhum arquivo para
  baixar): lápis riscando, página virando, carimbo, "pop" de confete e o
  sininho de nível novo.

  Começam desligados. Só tocam depois que a pessoa liga em Perfil → Aparência
  (ou no alto-falante do topo), e o AudioContext só nasce no primeiro som, que
  sempre vem de um clique — é a regra dos navegadores para áudio.
*/

let enabled = false;
let ctx: AudioContext | null = null;

export function setSoundsEnabled(on: boolean) {
  enabled = on;
}

export function soundsEnabled() {
  return enabled;
}

function audio(): AudioContext | null {
  if (!enabled || typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Ruído branco curto: a matéria-prima do lápis, da folha e do carimbo. */
function noise(ac: AudioContext, seconds: number) {
  const length = Math.max(1, Math.floor(ac.sampleRate * seconds));
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = ac.createBufferSource();
  source.buffer = buffer;
  return source;
}

function envelope(ac: AudioContext, peak: number, attack: number, release: number, at = ac.currentTime) {
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + release);
  return gain;
}

/** Dois riscos rápidos de grafite: marcar uma tarefa. */
export function playPencil() {
  const ac = audio();
  if (!ac) return;
  [0, 0.085].forEach((offset, index) => {
    const at = ac.currentTime + offset;
    const src = noise(ac, 0.07);
    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(index ? 3600 : 2800, at);
    band.Q.value = 1.4;
    const gain = envelope(ac, 0.16, 0.005, 0.06, at);
    src.connect(band).connect(gain).connect(ac.destination);
    src.start(at);
    src.stop(at + 0.08);
  });
}

/** A folha virando: um sopro de ruído que desce de agudo para grave. */
export function playPageFlip() {
  const ac = audio();
  if (!ac) return;
  const at = ac.currentTime;
  const src = noise(ac, 0.32);
  const low = ac.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.setValueAtTime(5200, at);
  low.frequency.exponentialRampToValueAtTime(700, at + 0.3);
  const gain = envelope(ac, 0.12, 0.04, 0.26, at);
  src.connect(low).connect(gain).connect(ac.destination);
  src.start(at);
  src.stop(at + 0.34);
}

/** Carimbo: um baque grave com o estalo do papel por cima. */
export function playStamp() {
  const ac = audio();
  if (!ac) return;
  const at = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(140, at);
  osc.frequency.exponentialRampToValueAtTime(55, at + 0.16);
  const body = envelope(ac, 0.5, 0.004, 0.18, at);
  osc.connect(body).connect(ac.destination);
  osc.start(at);
  osc.stop(at + 0.2);
  const click = noise(ac, 0.03);
  const high = ac.createBiquadFilter();
  high.type = "highpass";
  high.frequency.value = 1800;
  const clickGain = envelope(ac, 0.14, 0.002, 0.025, at);
  click.connect(high).connect(clickGain).connect(ac.destination);
  click.start(at);
  click.stop(at + 0.035);
}

/** "Pop" curtinho que acompanha o confete. */
export function playPop() {
  const ac = audio();
  if (!ac) return;
  const at = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(520, at);
  osc.frequency.exponentialRampToValueAtTime(980, at + 0.07);
  const gain = envelope(ac, 0.14, 0.004, 0.09, at);
  osc.connect(gain).connect(ac.destination);
  osc.start(at);
  osc.stop(at + 0.11);
}

/** Sininho de conquista: três notas subindo (dó, mi, sol). */
export function playChime() {
  const ac = audio();
  if (!ac) return;
  [523.25, 659.25, 783.99].forEach((freq, index) => {
    const at = ac.currentTime + index * 0.11;
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = envelope(ac, 0.12, 0.01, 0.45, at);
    osc.connect(gain).connect(ac.destination);
    osc.start(at);
    osc.stop(at + 0.5);
  });
}
