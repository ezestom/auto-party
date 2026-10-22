"use client";

import { useMixerStore } from "../../stores/mixerStore";
import { useDeckStore } from "../../stores/deckStore";

import { useSettingsStore } from "../../stores/settingsStore";

export class AudioEngine {
  public ctx: AudioContext | null = null;
  public initialized = false;

  // Deck nodes
  public deckChains: Record<"A" | "B", GainNode | null> = { A: null, B: null };
  public scratchNodes: Record<"A" | "B", AudioWorkletNode | null> = { A: null, B: null };
  public vocoderNodes: Record<"A" | "B", AudioWorkletNode | null> = { A: null, B: null };
  public phaserNodes: Record<"A" | "B", AudioWorkletNode | null> = { A: null, B: null };
  
  public eqLows: Record<"A" | "B", BiquadFilterNode | null> = { A: null, B: null };
  public eqMids: Record<"A" | "B", BiquadFilterNode | null> = { A: null, B: null };
  public eqHis: Record<"A" | "B", BiquadFilterNode | null> = { A: null, B: null };
  public filters: Record<"A" | "B", BiquadFilterNode | null> = { A: null, B: null };
  public channelGains: Record<"A" | "B", GainNode | null> = { A: null, B: null };
  public channelVolumes: Record<"A" | "B", GainNode | null> = { A: null, B: null };
  public crossfaderGains: Record<"A" | "B", GainNode | null> = { A: null, B: null };
  public cueActiveGains: Record<"A" | "B", GainNode | null> = { A: null, B: null };
  public analysers: Record<"A" | "B", AnalyserNode | null> = { A: null, B: null };

  // Master / Monitor nodes
  public musicBus: GainNode | null = null;
  public masterSummer: GainNode | null = null;
  public masterLimiter: DynamicsCompressorNode | null = null;
  public masterVolumeNode: GainNode | null = null;
  public masterAnalyser: AnalyserNode | null = null;
  private visualSamples = new Float32Array(1024);
  public boothVolumeNode: GainNode | null = null;

  public cueSummer: GainNode | null = null;
  public cueVolumeNode: GainNode | null = null;
  public headphoneMixCueNode: GainNode | null = null;
  public headphoneMixMasterNode: GainNode | null = null;
  public headphoneOutputNode: GainNode | null = null;

  // Track sources and buffers
  public deckBuffers: Record<"A" | "B", AudioBuffer | null> = { A: null, B: null };
  public deckSources: Record<"A" | "B", AudioBufferSourceNode | null> = { A: null, B: null };

  // Recording variables
  public recordedChunksL: Float32Array[] = [];
  public recordedChunksR: Float32Array[] = [];
  public isRecording = false;
  public recorderNode: ScriptProcessorNode | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      // Lazy init AudioContext on user interaction to avoid autoplay blocks
      this.setupStoreSubscription();
    }
  }

  private initializing: Promise<void> | null = null;
  private subscriptions: Array<() => void> = [];

  public async init() {
    if (this.initialized) return;
    if (!this.initializing) this.initializing = this.initialize().finally(() => { this.initializing = null; });
    return this.initializing;
  }

  private async initialize() {
    if (this.initialized) return;

    try {
      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio API is not supported in this browser.");
      }

      this.ctx = new AudioContextClass({ latencyHint: "interactive" });
      
      // Register worklets
      try {
        await this.ctx.audioWorklet.addModule("/worklets/scratch.worklet.js");
        await this.ctx.audioWorklet.addModule("/worklets/vocoder.worklet.js");
        await this.ctx.audioWorklet.addModule("/worklets/phaser.worklet.js");
        console.log("AudioEngine: All AudioWorklets registered successfully.");
      } catch (err) {
        console.warn("AudioEngine: Error registering worklets (using fallback bypass):", err);
      }

      this.buildGraph();
      this.initialized = true;

      // Sync initial state values
      const mixerState = useMixerStore.getState();
      this.updateMixerParams(mixerState);

      // Start VU meter loop
      this.lastFrameTime = typeof performance !== "undefined" ? performance.now() : Date.now();
      this.runVUMeterLoop();

      console.log("AudioEngine: Context initialized and audio graph built.");
    } catch (error) {
      console.error("AudioEngine: Failed to initialize context:", error);
    }
  }

  public setMusicDucking(value: number) {
    if (!this.ctx || !this.musicBus) return;
    this.musicBus.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), this.ctx.currentTime, 0.06);
  }

  /** RMS of the audience output, including its volume; silence produces zero. */
  public getVisualEnergy(): number {
    if (!this.initialized || this.ctx?.state !== "running" || !this.masterAnalyser) return 0;
    this.masterAnalyser.getFloatTimeDomainData(this.visualSamples);
    let sum = 0;
    for (const sample of this.visualSamples) sum += sample * sample;
    return Math.min(1, Math.sqrt(sum / this.visualSamples.length));
  }

  public async resume() {
    if (!this.ctx) {
      await this.init();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      await this.ctx.resume();
      console.log("AudioEngine: Context resumed.");
    }
  }

  private buildGraph() {
    const ctx = this.ctx;
    if (!ctx) return;

    // Master bus
    this.masterSummer = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.masterSummer);
    this.masterLimiter = ctx.createDynamicsCompressor();
    this.masterVolumeNode = ctx.createGain();
    
    // Set up limiter values (brickwall protection)
    this.masterLimiter.threshold.setValueAtTime(-0.5, ctx.currentTime);
    this.masterLimiter.ratio.setValueAtTime(20, ctx.currentTime);
    this.masterLimiter.knee.setValueAtTime(0, ctx.currentTime);

    // masterSummer -> masterLimiter -> masterVolumeNode -> destination
    this.masterSummer.connect(this.masterLimiter);
    this.masterLimiter.connect(this.masterVolumeNode);
    this.masterVolumeNode.connect(ctx.destination);
    // Analysis branch only: never add a second route to the speakers.
    this.masterAnalyser = ctx.createAnalyser();
    this.masterAnalyser.fftSize = this.visualSamples.length;
    this.masterVolumeNode.connect(this.masterAnalyser);

    // Booth bus
    this.boothVolumeNode = ctx.createGain();
    this.masterLimiter.connect(this.boothVolumeNode);
    // Monitor buses remain disconnected until a separate output is explicitly selected.

    // Headphone Cue / Monitoring bus
    this.cueSummer = ctx.createGain();
    this.cueVolumeNode = ctx.createGain();
    this.headphoneMixCueNode = ctx.createGain();
    this.headphoneMixMasterNode = ctx.createGain();
    this.headphoneOutputNode = ctx.createGain();

    // Cue summer goes to headphone mix cue side
    this.cueSummer.connect(this.cueVolumeNode);
    this.cueVolumeNode.connect(this.headphoneMixCueNode);

    // Master summer output goes to headphone mix master side
    this.masterSummer.connect(this.headphoneMixMasterNode);

    // Headphone mix branches sum into headphone output
    this.headphoneMixCueNode.connect(this.headphoneOutputNode);
    this.headphoneMixMasterNode.connect(this.headphoneOutputNode);
    // Never leak the cue bus into the audience output.

    // Construct Decks
    const decks: Array<"A" | "B"> = ["A", "B"];
    for (const d of decks) {
      // Entry point Node for sources
      this.deckChains[d] = ctx.createGain();

      // Worklets (fallbacks to bypass if worklet instantiation fails)
      let prevNode: AudioNode = this.deckChains[d]!;
      
      try {
        this.scratchNodes[d] = new AudioWorkletNode(ctx, "scratch-processor");
        prevNode.connect(this.scratchNodes[d]);
        prevNode = this.scratchNodes[d];
      } catch {
        console.warn(`AudioEngine: scratch-processor stub fallback used for deck ${d}`);
      }

      try {
        this.vocoderNodes[d] = new AudioWorkletNode(ctx, "vocoder-processor");
        prevNode.connect(this.vocoderNodes[d]);
        prevNode = this.vocoderNodes[d];
      } catch {
        console.warn(`AudioEngine: vocoder-processor stub fallback used for deck ${d}`);
      }

      try {
        this.phaserNodes[d] = new AudioWorkletNode(ctx, "phaser-processor");
        prevNode.connect(this.phaserNodes[d]);
        prevNode = this.phaserNodes[d];
      } catch {
        console.warn(`AudioEngine: phaser-processor stub fallback used for deck ${d}`);
      }

      // EQ nodes in series (Low Shelf -> Peaking -> High Shelf)
      this.eqLows[d] = ctx.createBiquadFilter();
      this.eqLows[d]!.type = "lowshelf";
      this.eqLows[d]!.frequency.setValueAtTime(200, ctx.currentTime);

      this.eqMids[d] = ctx.createBiquadFilter();
      this.eqMids[d]!.type = "peaking";
      this.eqMids[d]!.frequency.setValueAtTime(1000, ctx.currentTime);
      this.eqMids[d]!.Q.setValueAtTime(1.0, ctx.currentTime);

      this.eqHis[d] = ctx.createBiquadFilter();
      this.eqHis[d]!.type = "highshelf";
      this.eqHis[d]!.frequency.setValueAtTime(4000, ctx.currentTime);

      // Bipolar filter node
      this.filters[d] = ctx.createBiquadFilter();
      this.filters[d]!.type = "allpass"; // bypass by default

      // Wiring serial EQ chain
      prevNode.connect(this.eqLows[d]!);
      this.eqLows[d]!.connect(this.eqMids[d]!);
      this.eqMids[d]!.connect(this.eqHis[d]!);
      this.eqHis[d]!.connect(this.filters[d]!);

      // Gains and Volumes
      this.channelGains[d] = ctx.createGain();   // Trim/Gain knob
      this.channelVolumes[d] = ctx.createGain(); // Vertical volume fader

      this.filters[d]!.connect(this.channelGains[d]!);
      this.channelGains[d]!.connect(this.channelVolumes[d]!);

      // PFL path connection
      this.cueActiveGains[d] = ctx.createGain();
      this.cueActiveGains[d]!.gain.setValueAtTime(0.0, ctx.currentTime); // Off initially
      this.channelGains[d]!.connect(this.cueActiveGains[d]!);
      this.cueActiveGains[d]!.connect(this.cueSummer);

      // Crossfader connection path
      this.crossfaderGains[d] = ctx.createGain();
      this.channelVolumes[d]!.connect(this.crossfaderGains[d]!);
      this.crossfaderGains[d]!.connect(this.musicBus!);

      // VU Meter Analyser
      this.analysers[d] = ctx.createAnalyser();
      this.analysers[d]!.fftSize = 128;
      this.channelVolumes[d]!.connect(this.analysers[d]!);
    }
  }

  private setupStoreSubscription() {
    this.subscriptions.push(useMixerStore.subscribe((state, previous) => {
      if (state.isAutoCrossfading !== previous.isAutoCrossfading || state.autoTarget !== previous.autoTarget || state.autoDuration !== previous.autoDuration || state.isSmartEQ !== previous.isSmartEQ) this.scheduleAutoCrossfade();
      this.updateMixerParams(state);
    }));
    this.subscriptions.push(useSettingsStore.subscribe((state, previous) => {
      if (state.crossfaderCurve !== previous.crossfaderCurve) { this.scheduleAutoCrossfade(); this.updateMixerParams(useMixerStore.getState()); }
    }));

    this.subscriptions.push(useDeckStore.subscribe((state, previous) => {
      if (!this.initialized || !this.ctx) return;
      for (const d of ["A", "B"] as const) {
        const deck = state.decks[d];
        const before = previous.decks[d];
        if (!deck.isPlaying) {
          if (this.deckSources[d]) this.stop(d, deck.seekRevision === before.seekRevision);
          if (deck.seekRevision !== before.seekRevision) {
            this.transport[d].offset = deck.currentTime;
            this.transport[d].startedAt = this.ctx.currentTime;
          }
        } else if (!before.isPlaying || deck.track?.id !== before.track?.id || deck.seekRevision !== before.seekRevision) {
          this.play(d, deck.currentTime);
        } else if (deck.tempoOffset !== before.tempoOffset) {
          this.setPlaybackRate(d, 1 + deck.tempoOffset);
        }
        if (deck.loopActive !== before.loopActive || deck.loopLength !== before.loopLength || deck.loopStart !== before.loopStart) {
          this.updateLoop(d);
        }
      }
    }));
  }

  private updateMixerParams(state: ReturnType<typeof useMixerStore.getState>) {
    if (!this.initialized || !this.ctx) return;
    const ctx = this.ctx;

    // Master / Booth Volumes
    this.masterVolumeNode?.gain.setValueAtTime(state.masterVolume * state.masterVolume, ctx.currentTime);
    this.boothVolumeNode?.gain.setValueAtTime(state.boothVolume * state.boothVolume, ctx.currentTime);
    this.headphoneOutputNode?.gain.setValueAtTime(state.headphoneVolume * state.headphoneVolume, ctx.currentTime);

    // Headphone Mix splits (PFL vs Master monitor)
    this.headphoneMixCueNode?.gain.setValueAtTime(1.0 - state.headphoneMix, ctx.currentTime);
    this.headphoneMixMasterNode?.gain.setValueAtTime(state.headphoneMix, ctx.currentTime);

    const x = Math.max(0, Math.min(1, state.crossfader));
    const curve = useSettingsStore.getState().crossfaderCurve;
    const gainA = curve === "LIN" ? 1 - x : curve === "CUT" ? Math.min(1, (1 - x) / 0.05) : Math.cos(x * Math.PI / 2);
    const gainB = curve === "LIN" ? x : curve === "CUT" ? Math.min(1, x / 0.05) : Math.sin(x * Math.PI / 2);
    if (!this.autoFade) {
      this.crossfaderGains.A?.gain.setValueAtTime(gainA, ctx.currentTime);
      this.crossfaderGains.B?.gain.setValueAtTime(gainB, ctx.currentTime);
    }

    const decks: Array<"A" | "B"> = ["A", "B"];
    for (const d of decks) {
      const ch = state.channels[d];
      if (!ch) continue;

      // Channel Gain / Trim
      this.channelGains[d]?.gain.setValueAtTime(ch.gain * 2.0, ctx.currentTime);

      // Channel Volume Fader (quadratic response)
      this.channelVolumes[d]?.gain.setValueAtTime(ch.volume * ch.volume, ctx.currentTime);

      // Cue monitor path
      this.cueActiveGains[d]?.gain.setValueAtTime(ch.cueActive ? 1.0 : 0.0, ctx.currentTime);

      if (this.autoFade && state.isSmartEQ) continue;
      // Low EQ Shelf
      const dbLo = ch.eqLo <= 0.75 
        ? -26.0 * (1.0 - ch.eqLo / 0.75) 
        : 6.0 * ((ch.eqLo - 0.75) / 0.25);
      this.eqLows[d]?.gain.setValueAtTime(dbLo, ctx.currentTime);

      // Mid EQ Peaking
      const dbMid = ch.eqMid <= 0.75 
        ? -26.0 * (1.0 - ch.eqMid / 0.75) 
        : 6.0 * ((ch.eqMid - 0.75) / 0.25);
      this.eqMids[d]?.gain.setValueAtTime(dbMid, ctx.currentTime);

      // High EQ Shelf
      const dbHi = ch.eqHi <= 0.75 
        ? -26.0 * (1.0 - ch.eqHi / 0.75) 
        : 6.0 * ((ch.eqHi - 0.75) / 0.25);
      this.eqHis[d]?.gain.setValueAtTime(dbHi, ctx.currentTime);

      // Bipolar Lowpass / Highpass Filter
      const fNode = this.filters[d];
      if (fNode) {
        if (ch.filter < 0.5) {
          fNode.type = "lowpass";
          fNode.frequency.setValueAtTime(20 * Math.pow(1000, ch.filter * 2), ctx.currentTime);
        } else if (ch.filter > 0.5) {
          fNode.type = "highpass";
          fNode.frequency.setValueAtTime(20 * Math.pow(1000, (ch.filter - 0.5) * 2), ctx.currentTime);
        } else {
          fNode.type = "allpass"; // flat / transparent bypass
        }
      }
    }
  }


  private autoFade: { startedAt: number; from: number; target: number; duration: number } | null = null;
  private autoFadeTimer: ReturnType<typeof setInterval> | null = null;
  private automatedParams: AudioParam[] = [];

  private scheduleAutoCrossfade() {
    if (!this.ctx || !this.initialized) return;
    const now = this.ctx.currentTime;
    // Cancel only parameters owned by this automation before applying current store values.
    for (const param of this.automatedParams) param.cancelScheduledValues(now);
    this.automatedParams = [];
    if (this.autoFadeTimer) clearInterval(this.autoFadeTimer);
    this.autoFadeTimer = null;
    this.autoFade = null;
    const state = useMixerStore.getState();
    this.updateMixerParams(state);
    if (!state.isAutoCrossfading || !state.autoTarget) return;
    const from = state.crossfader, target = state.autoTarget === "A" ? 0 : 1;
    const duration = Math.max(0.02, Math.abs(target - from) * Math.max(0.5, state.autoDuration));
    this.autoFade = { startedAt: now, from, target, duration };
    const schedule = (param: AudioParam | undefined, value: (p: number) => number) => {
      if (!param) return;
      const curve = Float32Array.from({ length: 129 }, (_, i) => value(i / 128));
      param.cancelScheduledValues(now);
      param.setValueCurveAtTime(curve, now, duration);
      this.automatedParams.push(param);
    };
    const curve = useSettingsStore.getState().crossfaderCurve;
    for (const deck of ["A", "B"] as const) {
      schedule(this.crossfaderGains[deck]?.gain, p => {
        const x = from + (target - from) * p;
        return curve === "LIN" ? (deck === "A" ? 1 - x : x)
          : curve === "CUT" ? Math.min(1, (deck === "A" ? 1 - x : x) / 0.05)
          : deck === "A" ? Math.cos(x * Math.PI / 2) : Math.sin(x * Math.PI / 2);
      });
      if (!state.isSmartEQ) continue;
      const incoming = deck === state.autoTarget;
      const base = state.channels[deck];
      const db = (value: number) => value <= 0.75 ? -26 * (1 - value / 0.75) : 6 * ((value - 0.75) / 0.25);
      for (const [node, level, amount] of [[this.eqLows[deck], base.eqLo, 0.85], [this.eqMids[deck], base.eqMid, 0.2], [this.eqHis[deck], base.eqHi, 0.15]] as const) {
        schedule(node?.gain, p => {
          // Envelope starts at the user's setting and returns to it for the incoming deck.
          const envelope = incoming ? Math.sin(Math.PI * p) : p;
          return db(level * (1 - amount * envelope));
        });
      }
    }
    // Timers update status only; the audible transition is already scheduled in Web Audio.
    this.autoFadeTimer = setInterval(() => this.syncAutoCrossfade(), 100);
  }

  private syncAutoCrossfade() {
    if (!this.ctx || !this.autoFade) return;
    const fade = this.autoFade;
    const p = Math.max(0, Math.min(1, (this.ctx.currentTime - fade.startedAt) / fade.duration));
    useMixerStore.setState({ crossfader: fade.from + (fade.target - fade.from) * p,
      ...(p >= 1 ? { isAutoCrossfading: false, autoTarget: null } : {}) });
  }

  private transport = {
    A: { offset: 0, startedAt: 0, rate: 1 },
    B: { offset: 0, startedAt: 0, rate: 1 },
  };

  // AudioContext time is the authority; rendering and background tabs cannot advance it.
  public getPlaybackTime(deckId: "A" | "B"): number {
    const clock = this.transport[deckId];
    const source = this.deckSources[deckId];
    const duration = this.deckBuffers[deckId]?.duration || 0;
    let position = clock.offset;
    if (source && this.ctx) position += Math.max(0, this.ctx.currentTime - clock.startedAt) * clock.rate;
    if (source?.loop && source.loopEnd > source.loopStart && position >= source.loopEnd) {
      position = source.loopStart + (position - source.loopStart) % (source.loopEnd - source.loopStart);
    }
    return Math.max(0, Math.min(duration, position));
  }

  public syncPlayheads() {
    this.syncAutoCrossfade();
    for (const d of ["A", "B"] as const) {
      if (this.deckBuffers[d]) useDeckStore.getState().updatePlaybackTime(d, this.getPlaybackTime(d));
    }
  }

  public loadTrack(deckId: "A" | "B", buffer: AudioBuffer) {
    this.stop(deckId, false);
    this.deckBuffers[deckId] = buffer;
    this.transport[deckId] = { offset: 0, startedAt: this.ctx?.currentTime || 0, rate: 1 };
  }

  public play(deckId: "A" | "B", startTime?: number) {
    const ctx = this.ctx;
    const buffer = this.deckBuffers[deckId];
    if (!ctx || !buffer) {
      useDeckStore.getState().setPlaying(deckId, false);
      return;
    }
    const deck = useDeckStore.getState().decks[deckId];
    const requested = startTime ?? deck.currentTime;
    const offset = requested >= buffer.duration ? 0 : Math.max(0, requested);
    this.stop(deckId, false);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.deckChains[deckId]!);
    const rate = Math.max(0.01, Math.min(4, 1 + deck.tempoOffset));
    source.playbackRate.setValueAtTime(rate, ctx.currentTime);
    this.transport[deckId] = { offset, startedAt: ctx.currentTime, rate };
    this.deckSources[deckId] = source;
    this.updateLoop(deckId);
    source.onended = () => {
      if (this.deckSources[deckId] !== source) return;
      this.deckSources[deckId] = null;
      source.disconnect();
      this.transport[deckId].offset = buffer.duration;
      useDeckStore.getState().updatePlaybackTime(deckId, buffer.duration);
      useDeckStore.getState().setPlaying(deckId, false);
    };
    source.start(0, offset);
  }

  public stop(deckId: "A" | "B", capturePosition = true) {
    const position = this.getPlaybackTime(deckId);
    const source = this.deckSources[deckId];
    this.deckSources[deckId] = null;
    if (source) {
      source.onended = null;
      try { source.stop(); } catch { /* already ended */ }
      source.disconnect();
    }
    this.transport[deckId].offset = position;
    if (capturePosition) useDeckStore.getState().updatePlaybackTime(deckId, position);
  }

  public setPlaybackRate(deckId: "A" | "B", rate: number) {
    if (!this.ctx || !Number.isFinite(rate)) return;
    const position = this.getPlaybackTime(deckId);
    const clamped = Math.max(0.01, Math.min(4, rate));
    this.transport[deckId] = { offset: position, startedAt: this.ctx.currentTime, rate: clamped };
    this.deckSources[deckId]?.playbackRate.setValueAtTime(clamped, this.ctx.currentTime);
  }

  private updateLoop(deckId: "A" | "B") {
    const source = this.deckSources[deckId];
    if (!source || !this.ctx) return;
    const position = this.getPlaybackTime(deckId);
    const deck = useDeckStore.getState().decks[deckId];
    const duration = this.deckBuffers[deckId]?.duration || 0;
    const start = Math.max(0, deck.loopStart ?? 0);
    const end = Math.min(duration, start + deck.loopLength * 60 / Math.max(1, deck.baseBpm));
    source.loopStart = start;
    source.loopEnd = end;
    source.loop = deck.loopActive && deck.loopStart !== null && end > start;
    this.transport[deckId].offset = position;
    this.transport[deckId].startedAt = this.ctx.currentTime;
  }

  private monitorOutputs: Partial<Record<"headphones" | "booth", { audio: HTMLAudioElement; bus: MediaStreamAudioDestinationNode; id: string }>> = {};

  public getMonitorOutputId(kind: "headphones" | "booth") { return this.monitorOutputs[kind]?.id || ""; }

  private outputRevisions = { headphones: 0, booth: 0 };

  public async setMonitorOutput(kind: "headphones" | "booth", deviceId: string) {
    const revision = ++this.outputRevisions[kind];
    await this.resume();
    if (revision !== this.outputRevisions[kind]) return;
    const node = kind === "headphones" ? this.headphoneOutputNode : this.boothVolumeNode;
    if (!this.ctx || !node) throw new Error("El motor de audio no está disponible.");
    const disconnect = (output: NonNullable<typeof this.monitorOutputs[typeof kind]>) => {
      output.audio.pause();
      output.audio.srcObject = null;
      try { node.disconnect(output.bus); } catch { /* already disconnected */ }
    };
    if (!deviceId) {
      const previous = this.monitorOutputs[kind];
      if (previous) disconnect(previous);
      delete this.monitorOutputs[kind];
      return;
    }
    const audio = new Audio();
    if (!("setSinkId" in audio)) throw new Error("Este navegador no permite elegir una salida independiente.");
    const bus = this.ctx.createMediaStreamDestination();
    audio.srcObject = bus.stream;
    const output = { audio, bus, id: deviceId };
    try {
      await audio.setSinkId(deviceId);
      // Start the silent stream first; keep the working route if selection fails.
      await audio.play();
      if (revision !== this.outputRevisions[kind]) { disconnect(output); return; }
      const previous = this.monitorOutputs[kind];
      node.connect(bus);
      this.monitorOutputs[kind] = output;
      if (previous) disconnect(previous);
    } catch (error) {
      disconnect(output);
      throw error;
    }
  }

  public dispose() {
    if (this.autoFadeTimer) clearInterval(this.autoFadeTimer);
    this.autoFadeTimer = null;
    this.subscriptions.splice(0).forEach(unsubscribe => unsubscribe());
    this.initialized = false;
    this.masterAnalyser?.disconnect();
    this.masterAnalyser = null;
    if (this.animationFrameId !== null) {
      if (typeof this.animationFrameId === "number" && typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(this.animationFrameId);
      else clearTimeout(this.animationFrameId);
    }
    for (const d of ["A", "B"] as const) this.stop(d, false);
    for (const kind of ["headphones", "booth"] as const) {
      this.outputRevisions[kind]++;
      const output = this.monitorOutputs[kind];
      if (output) { output.audio.pause(); output.audio.srcObject = null; output.bus.disconnect(); }
    }
    this.monitorOutputs = {};
    void this.ctx?.close();
  }

  private lastFrameTime = 0;
  private currentDb: Record<"A" | "B", number> = { A: -60, B: -60 };
  private clipTimestamp: Record<"A" | "B", number> = { A: 0, B: 0 };
  private animationFrameId: number | ReturnType<typeof setTimeout> | null = null;

  private runVUMeterLoop = () => {
    if (!this.initialized) return;

    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const dt = Math.max(0, Math.min(0.1, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;

    const decks: Array<"A" | "B"> = ["A", "B"];
    const setVU = useMixerStore.getState().setVU;

    for (const d of decks) {
      const analyser = this.analysers[d];
      if (!analyser) continue;

      let peak = 0;

      if (typeof analyser.getFloatTimeDomainData === "function") {
        const bufferLength = analyser.fftSize;
        const dataArray = new Float32Array(bufferLength);
        analyser.getFloatTimeDomainData(dataArray);

        for (let i = 0; i < bufferLength; i++) {
          const abs = Math.abs(dataArray[i]);
          if (abs > peak) {
            peak = abs;
          }
        }
      }

      // Convert to dB
      const db = peak > 0.0001 ? 20 * Math.log10(peak) : -60;
      const dbClamped = Math.max(-60, Math.min(0, db));

      // Decay physics: 10 dB per second
      this.currentDb[d] = Math.max(-60, this.currentDb[d] - 10 * dt);

      // Instant attack
      if (dbClamped > this.currentDb[d]) {
        this.currentDb[d] = dbClamped;
      }

      // Map dB to 0.0 - 1.0 (linear scaling across 60 dB range)
      const normalized = (this.currentDb[d] + 60) / 60;

      // Clip indicator holds for 500ms when signal reaches 0dBFS (1.0 peak)
      if (peak >= 0.999) {
        this.clipTimestamp[d] = now;
      }
      const isClipping = (now - this.clipTimestamp[d]) < 500;

      setVU(d, normalized, normalized, isClipping, isClipping);
    }

    this.animationFrameId = typeof window !== "undefined" && typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame(this.runVUMeterLoop)
      : setTimeout(this.runVUMeterLoop, 16);
  };

  public startRecording() {
    const ctx = this.ctx;
    if (!ctx || this.isRecording) return false;

    this.recordedChunksL = [];
    this.recordedChunksR = [];
    this.isRecording = true;

    try {
      this.recorderNode = ctx.createScriptProcessor(4096, 2, 2);
      
      this.recorderNode.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        const left = e.inputBuffer.getChannelData(0);
        const right = e.inputBuffer.getChannelData(1);
        
        this.recordedChunksL.push(new Float32Array(left));
        this.recordedChunksR.push(new Float32Array(right));
      };

      if (this.masterLimiter) {
        this.masterVolumeNode?.connect(this.recorderNode);
        this.recorderNode.connect(ctx.destination);
      }
      
      console.log("[AudioEngine] Lossless WAV recording started.");
      return true;
    } catch (err) {
      console.error("[AudioEngine] Failed to start WAV recording:", err);
      this.isRecording = false;
      return false;
    }
  }

  public stopRecording(): Blob | null {
    if (!this.isRecording) return null;
    
    this.isRecording = false;
    
    if (this.recorderNode) {
      try {
        this.masterVolumeNode?.disconnect(this.recorderNode);
        this.recorderNode.disconnect();
      } catch {}
      this.recorderNode = null;
    }

    const ctx = this.ctx;
    const sampleRate = ctx ? ctx.sampleRate : 44100;
    
    console.log(`[AudioEngine] Lossless WAV recording stopped. Packaging ${this.recordedChunksL.length} chunks...`);
    
    if (this.recordedChunksL.length === 0) {
      return null;
    }

    try {
      const wavBlob = this.encodeWAV(this.recordedChunksL, this.recordedChunksR, sampleRate);
      this.recordedChunksL = [];
      this.recordedChunksR = [];
      return wavBlob;
    } catch (err) {
      console.error("[AudioEngine] Failed to encode WAV file:", err);
      return null;
    }
  }

  private encodeWAV(chunksL: Float32Array[], chunksR: Float32Array[], sampleRate: number): Blob {
    let totalSamples = 0;
    for (const chunk of chunksL) {
      totalSamples += chunk.length;
    }

    const buffer = new ArrayBuffer(44 + totalSamples * 2 * 2);
    const view = new DataView(buffer);

    const writeStringHelper = (view: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeStringHelper(view, 0, "RIFF");
    view.setUint32(4, 36 + totalSamples * 2 * 2, true);
    writeStringHelper(view, 8, "WAVE");
    writeStringHelper(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 2, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 4, true);
    view.setUint16(32, 4, true);
    view.setUint16(34, 16, true);
    writeStringHelper(view, 36, "data");
    view.setUint32(40, totalSamples * 2 * 2, true);

    let offset = 44;
    for (let i = 0; i < chunksL.length; i++) {
      const left = chunksL[i];
      const right = chunksR[i];
      for (let j = 0; j < left.length; j++) {
        const sL = Math.max(-1.0, Math.min(1.0, left[j]));
        const sR = Math.max(-1.0, Math.min(1.0, right[j]));
        
        const sampleL = sL < 0 ? sL * 0x8000 : sL * 0x7fff;
        const sampleR = sR < 0 ? sR * 0x8000 : sR * 0x7fff;
        
        view.setInt16(offset, sampleL, true);
        view.setInt16(offset + 2, sampleR, true);
        offset += 4;
      }
    }

    return new Blob([buffer], { type: "audio/wav" });
  }
}

// Global engine singleton reference
let instance: AudioEngine | null = null;

export function getAudioEngine(): AudioEngine {
  if (typeof window === "undefined") {
    // Construction is inert on the server: context creation still requires a browser gesture.
    return new AudioEngine();
  }
  if (!instance) {
    instance = new AudioEngine();
  }
  return instance;
}
