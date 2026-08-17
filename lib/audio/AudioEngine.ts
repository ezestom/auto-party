"use client";

import { useMixerStore } from "../../stores/mixerStore";
import { useDeckStore } from "../../stores/deckStore";

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
  public masterSummer: GainNode | null = null;
  public masterLimiter: DynamicsCompressorNode | null = null;
  public masterVolumeNode: GainNode | null = null;
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

  public async init() {
    if (this.initialized) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
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

    // Booth bus
    this.boothVolumeNode = ctx.createGain();
    this.masterLimiter.connect(this.boothVolumeNode);
    this.boothVolumeNode.connect(ctx.destination); // For simplified web audio routing

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
    this.headphoneOutputNode.connect(ctx.destination);

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
      } catch (e) {
        console.warn(`AudioEngine: scratch-processor stub fallback used for deck ${d}`);
      }

      try {
        this.vocoderNodes[d] = new AudioWorkletNode(ctx, "vocoder-processor");
        prevNode.connect(this.vocoderNodes[d]);
        prevNode = this.vocoderNodes[d];
      } catch (e) {
        console.warn(`AudioEngine: vocoder-processor stub fallback used for deck ${d}`);
      }

      try {
        this.phaserNodes[d] = new AudioWorkletNode(ctx, "phaser-processor");
        prevNode.connect(this.phaserNodes[d]);
        prevNode = this.phaserNodes[d];
      } catch (e) {
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
      this.channelVolumes[d]!.connect(this.cueActiveGains[d]!);
      this.cueActiveGains[d]!.connect(this.cueSummer);

      // Crossfader connection path
      this.crossfaderGains[d] = ctx.createGain();
      this.channelVolumes[d]!.connect(this.crossfaderGains[d]!);
      this.crossfaderGains[d]!.connect(this.masterSummer);

      // VU Meter Analyser
      this.analysers[d] = ctx.createAnalyser();
      this.analysers[d]!.fftSize = 128;
      this.channelVolumes[d]!.connect(this.analysers[d]!);
    }
  }

  private setupStoreSubscription() {
    useMixerStore.subscribe((state) => {
      this.updateMixerParams(state);
    });

    useDeckStore.subscribe((state) => {
      if (!this.initialized || !this.ctx) return;
      const decks: Array<"A" | "B"> = ["A", "B"];
      for (const d of decks) {
        const isPlaying = state.decks[d].isPlaying;
        const currentlyPlaying = !!(this.deckSources[d] || this.simulatedNodes[d]);
        if (isPlaying && !currentlyPlaying) {
          const currentPos = state.decks[d].currentTime || 0;
          this.play(d, currentPos);
        } else if (!isPlaying && currentlyPlaying) {
          this.stop(d);
        }
      }
    });
  }

  private updateMixerParams(state: any) {
    if (!this.initialized || !this.ctx) return;
    const ctx = this.ctx;

    // Master / Booth Volumes
    this.masterVolumeNode?.gain.setValueAtTime(state.masterVolume * state.masterVolume, ctx.currentTime);
    this.boothVolumeNode?.gain.setValueAtTime(state.boothVolume * state.boothVolume, ctx.currentTime);
    this.headphoneOutputNode?.gain.setValueAtTime(state.headphoneVolume * state.headphoneVolume, ctx.currentTime);

    // Headphone Mix splits (PFL vs Master monitor)
    this.headphoneMixCueNode?.gain.setValueAtTime(1.0 - state.headphoneMix, ctx.currentTime);
    this.headphoneMixMasterNode?.gain.setValueAtTime(state.headphoneMix, ctx.currentTime);

    // Crossfader constant-power curve
    this.crossfaderGains.A?.gain.setValueAtTime(Math.cos(state.crossfader * Math.PI / 2), ctx.currentTime);
    this.crossfaderGains.B?.gain.setValueAtTime(Math.sin(state.crossfader * Math.PI / 2), ctx.currentTime);

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

  // Playback buffer triggers (for upcoming stages)
  public loadTrack(deckId: "A" | "B", buffer: AudioBuffer) {
    this.deckBuffers[deckId] = buffer;
  }

  private simulatedNodes: Record<"A" | "B", { osc: OscillatorNode; modulation: OscillatorNode; oscGain: GainNode; modGain: GainNode } | null> = { A: null, B: null };

  public play(deckId: "A" | "B", startTime?: number) {
    const ctx = this.ctx;
    if (!ctx) return;

    this.stop(deckId);

    const deckState = useDeckStore.getState().decks[deckId];
    const startOffset = startTime ?? deckState?.currentTime ?? 0;

    if (!this.deckBuffers[deckId]) {
      // Create a simulated synthesizer node for testing/visual verification
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      
      // Deck A lower pitch, Deck B higher pitch
      osc.type = "sawtooth";
      osc.frequency.value = deckId === "A" ? 110 : 220; // A2 or A3
      
      // Apply a simple LFO/amplitude modulation to simulate beats and prevent static hum
      const modulation = ctx.createOscillator();
      const modGain = ctx.createGain();
      modulation.frequency.value = deckId === "A" ? 2 : 2.5; // modulate volume at 2Hz or 2.5Hz (120 or 150 BPM)
      modGain.gain.value = 0.4;
      
      oscGain.gain.value = 0.15; // keep it quiet but audible/measurable
      
      modulation.connect(modGain);
      modGain.connect(oscGain.gain);
      
      osc.connect(oscGain);
      
      if (this.deckChains[deckId]) {
        oscGain.connect(this.deckChains[deckId]!);
      }
      
      osc.start(0);
      modulation.start(0);
      
      this.simulatedNodes[deckId] = { osc, modulation, oscGain, modGain };
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = this.deckBuffers[deckId];
    
    // Connect to the entry point of the deck chain
    if (this.deckChains[deckId]) {
      source.connect(this.deckChains[deckId]!);
    }

    if (deckState) {
      const speed = 1 + deckState.tempoOffset;
      source.playbackRate.setValueAtTime(Math.max(0.01, Math.min(4.0, speed)), ctx.currentTime);
    }

    source.start(0, startOffset);
    this.deckSources[deckId] = source;
  }

  public stop(deckId: "A" | "B") {
    if (this.simulatedNodes[deckId]) {
      try {
        this.simulatedNodes[deckId]!.osc.stop();
        this.simulatedNodes[deckId]!.modulation.stop();
      } catch (e) {}
      try {
        this.simulatedNodes[deckId]!.osc.disconnect();
        this.simulatedNodes[deckId]!.modulation.disconnect();
        this.simulatedNodes[deckId]!.oscGain.disconnect();
        this.simulatedNodes[deckId]!.modGain.disconnect();
      } catch (e) {}
      this.simulatedNodes[deckId] = null;
    }

    if (this.deckSources[deckId]) {
      try {
        this.deckSources[deckId]!.stop();
      } catch (e) {}
      this.deckSources[deckId]!.disconnect();
      this.deckSources[deckId] = null;
    }
  }

  public setPlaybackRate(deckId: "A" | "B", rate: number) {
    if (!this.initialized || !this.ctx) return;
    const ctx = this.ctx;

    // 1. Modulate simulated oscillator node
    const sim = this.simulatedNodes[deckId];
    if (sim) {
      const baseFreq = deckId === "A" ? 110 : 220;
      const clampedRate = Math.max(0.01, Math.min(4.0, rate));
      
      sim.osc.frequency.setValueAtTime(baseFreq * clampedRate, ctx.currentTime);
      sim.modulation.frequency.setValueAtTime((deckId === "A" ? 2 : 2.5) * clampedRate, ctx.currentTime);
      
      const speedVolume = Math.max(0, Math.min(0.15, 0.15 * clampedRate));
      sim.oscGain.gain.setValueAtTime(speedVolume, ctx.currentTime);
    }

    // 2. Modulate real buffer source node
    const source = this.deckSources[deckId];
    if (source) {
      const clampedRate = Math.max(0.01, Math.min(4.0, rate));
      source.playbackRate.setValueAtTime(clampedRate, ctx.currentTime);
    }
  }

  private lastFrameTime = 0;
  private currentDb: Record<"A" | "B", number> = { A: -60, B: -60 };
  private clipTimestamp: Record<"A" | "B", number> = { A: 0, B: 0 };
  private animationFrameId: number | null = null;

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

    const raf = typeof window !== "undefined" && typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame
      : (cb: any) => setTimeout(cb, 16);
    
    this.animationFrameId = raf(this.runVUMeterLoop) as any;
  };

  public startRecording() {
    const ctx = this.ctx;
    if (!ctx || this.isRecording) return;

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
        this.masterLimiter.connect(this.recorderNode);
        this.recorderNode.connect(ctx.destination);
      }
      
      console.log("[AudioEngine] Lossless WAV recording started.");
    } catch (err) {
      console.error("[AudioEngine] Failed to start WAV recording:", err);
      this.isRecording = false;
    }
  }

  public stopRecording(): Blob | null {
    if (!this.isRecording) return null;
    
    this.isRecording = false;
    
    if (this.recorderNode) {
      try {
        this.masterLimiter?.disconnect(this.recorderNode);
        this.recorderNode.disconnect();
      } catch (e) {}
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
        let sL = Math.max(-1.0, Math.min(1.0, left[j]));
        let sR = Math.max(-1.0, Math.min(1.0, right[j]));
        
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
    // Return mock engine during server SSR compilation
    return new Proxy({} as any, {
      get: () => () => {},
    });
  }
  if (!instance) {
    instance = new AudioEngine();
  }
  return instance;
}
