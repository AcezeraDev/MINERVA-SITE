/**
 * Chamada de voz da sala de estudo: uma conexão WebRTC direta com cada
 * colega que está na chamada (malha, até 6 pessoas). A voz não passa pelo
 * servidor; ele só repassa os recados de conexão (oferta e resposta), que
 * chegam pela consulta de cada segundo da sala.
 *
 * Negociação "perfeita" (padrão do WebRTC): os dois lados podem oferecer ao
 * mesmo tempo; quem tem o id menor é o "educado" e cede na colisão. Sem
 * trickle: cada oferta/resposta só sai com os candidatos já juntados, então
 * um recado por lado basta (a consulta é de 1 s, não daria para pingue-pongue).
 *
 * Sem servidor de repasse (TURN): em redes que bloqueiam conexão direta a voz
 * pode não conectar; a pessoa vê "sem conexão" ao lado do nome do colega.
 */

const ICE: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];

export type EstadoPar = "conectando" | "conectado" | "falhou";
type Par = {
  pc: RTCPeerConnection;
  educado: boolean;
  ofertando: boolean;
  audio: HTMLAudioElement;
  analisador?: AnalyserNode;
  estado: EstadoPar;
};

export type EventosVoz = {
  /** Mandar um recado de conexão para um colega (vai pelo servidor). */
  enviarSinal: (para: string, dados: unknown) => void;
  /** Quem está falando agora (ids), e o estado de cada conexão. */
  aoMudar: (falando: Set<string>, conexoes: Record<string, EstadoPar>) => void;
};

function esperarCandidatos(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((pronto) => {
    const fim = () => {
      pc.removeEventListener("icegatheringstatechange", olhar);
      window.clearTimeout(relogio);
      pronto();
    };
    const olhar = () => pc.iceGatheringState === "complete" && fim();
    pc.addEventListener("icegatheringstatechange", olhar);
    // com STUN lento, segue com o que já tem
    const relogio = window.setTimeout(fim, 2500);
  });
}

export class ChamadaVoz {
  private meuId: string;
  private eventos: EventosVoz;
  private local: MediaStream | null = null;
  private pares = new Map<string, Par>();
  private ctx: AudioContext | null = null;
  private analisadorLocal?: AnalyserNode;
  private medidor = 0;
  private falandoAntes = "";
  mudo = false;

  constructor(meuId: string, eventos: EventosVoz) {
    this.meuId = meuId;
    this.eventos = eventos;
  }

  get ativa() {
    return this.local !== null;
  }

  /** Pede o microfone. Precisa vir de um clique (o navegador exige gesto para tocar áudio). */
  async entrar() {
    if (this.local) return;
    this.local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    this.ctx = new AudioContext();
    this.analisadorLocal = this.analisar(this.local);
    this.aplicarMudo();
    this.medidor = window.setInterval(() => this.medir(), 160);
  }

  sair() {
    for (const id of [...this.pares.keys()]) this.fechar(id);
    this.local?.getTracks().forEach((t) => t.stop());
    this.local = null;
    window.clearInterval(this.medidor);
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.falandoAntes = "";
    this.eventos.aoMudar(new Set(), {});
  }

  setMudo(mudo: boolean) {
    this.mudo = mudo;
    this.aplicarMudo();
  }

  private aplicarMudo() {
    this.local?.getAudioTracks().forEach((t) => (t.enabled = !this.mudo));
  }

  /** A cada consulta: liga com quem entrou na chamada e desliga de quem saiu. */
  sincronizar(idsNaChamada: string[]) {
    if (!this.local) return;
    const alvo = new Set(idsNaChamada.filter((id) => id !== this.meuId));
    for (const id of alvo) if (!this.pares.has(id)) this.criarPar(id);
    for (const id of [...this.pares.keys()]) if (!alvo.has(id)) this.fechar(id);
  }

  async receberSinal(de: string, dados: unknown) {
    if (!this.local) return;
    const sdp = (dados as { sdp?: RTCSessionDescriptionInit })?.sdp;
    if (!sdp?.type) return;
    const par = this.pares.get(de) ?? this.criarPar(de);
    const { pc } = par;
    try {
      const colisao = sdp.type === "offer" && (par.ofertando || pc.signalingState !== "stable");
      if (colisao && !par.educado) return; // o outro lado cede
      await pc.setRemoteDescription(sdp);
      if (sdp.type === "offer") {
        await pc.setLocalDescription();
        await esperarCandidatos(pc);
        if (pc.localDescription) this.eventos.enviarSinal(de, { sdp: pc.localDescription.toJSON() });
      }
    } catch {
      /* recado velho ou fora de ordem: a próxima negociação acerta */
    }
  }

  private criarPar(id: string): Par {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const audio = new Audio();
    audio.autoplay = true;
    const par: Par = { pc, educado: this.meuId < id, ofertando: false, audio, estado: "conectando" };
    this.pares.set(id, par);
    this.local?.getTracks().forEach((t) => pc.addTrack(t, this.local!));
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      audio.srcObject = stream;
      void audio.play().catch(() => {});
      par.analisador = this.analisar(stream);
    };
    pc.onnegotiationneeded = async () => {
      try {
        par.ofertando = true;
        await pc.setLocalDescription();
        await esperarCandidatos(pc);
        if (pc.localDescription) this.eventos.enviarSinal(id, { sdp: pc.localDescription.toJSON() });
      } catch {
        /* tenta de novo na próxima mudança */
      } finally {
        par.ofertando = false;
      }
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      par.estado = s === "connected" ? "conectado" : s === "failed" ? "falhou" : "conectando";
      if (s === "failed") pc.restartIce();
      this.avisar();
    };
    this.avisar();
    return par;
  }

  private fechar(id: string) {
    const par = this.pares.get(id);
    if (!par) return;
    par.pc.close();
    par.audio.srcObject = null;
    this.pares.delete(id);
    this.avisar();
  }

  private analisar(stream: MediaStream) {
    if (!this.ctx) return undefined;
    try {
      const fonte = this.ctx.createMediaStreamSource(stream);
      const a = this.ctx.createAnalyser();
      a.fftSize = 512;
      fonte.connect(a); // só mede; o som toca pelo <audio>
      return a;
    } catch {
      return undefined;
    }
  }

  private nivel(a?: AnalyserNode) {
    if (!a) return 0;
    const dados = new Uint8Array(a.fftSize);
    a.getByteTimeDomainData(dados);
    let soma = 0;
    for (const v of dados) soma += ((v - 128) / 128) ** 2;
    return Math.sqrt(soma / dados.length);
  }

  private medir() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
    const falando = new Set<string>();
    if (!this.mudo && this.nivel(this.analisadorLocal) > 0.04) falando.add(this.meuId);
    for (const [id, par] of this.pares) if (this.nivel(par.analisador) > 0.04) falando.add(id);
    const chave = [...falando].sort().join(",");
    if (chave !== this.falandoAntes) {
      this.falandoAntes = chave;
      this.avisar(falando);
    }
  }

  private avisar(falando?: Set<string>) {
    const conexoes: Record<string, EstadoPar> = {};
    for (const [id, par] of this.pares) conexoes[id] = par.estado;
    this.eventos.aoMudar(falando ?? new Set(this.falandoAntes ? this.falandoAntes.split(",") : []), conexoes);
  }
}
