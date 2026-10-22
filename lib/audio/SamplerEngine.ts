"use client";

import { getAudioEngine } from "./AudioEngine";

export type SampleEffectType =
  | "airhorn"
  | "laser"
  | "sweep"
  | "rewind"
  | "subdrop"
  | "claprush"
  | "siren"
  | "stinger";

export interface SamplerPadInfo {
  id: SampleEffectType;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  description: string;
}

export const SAMPLER_PADS: SamplerPadInfo[] = [
  {
    id: "airhorn",
    label: "AIR HORN",
    shortLabel: "HORN",
    icon: "📢",
    color: "#ff6b00",
    description: "Classic club/rave triple air horn blast",
  },
  {
    id: "laser",
    label: "LASER DROP",
    shortLabel: "LASER",
    icon: "⚡",
    color: "#00d4ff",
    description: "Futuristic pitch-sweep laser shot",
  },
  {
    id: "sweep",
    label: "NOISE RISER",
    shortLabel: "SWEEP",
    icon: "🌊",
    color: "#00ff88",
    description: "Resonant white-noise filter build-up",
  },
  {
    id: "rewind",
    label: "VINYL BRAKE",
    shortLabel: "REWIND",
    icon: "⏪",
    color: "#ff0077",
    description: "Turntable vinyl scratch & spin-back",
  },
  {
    id: "subdrop",
    label: "808 SUB IMPACT",
    shortLabel: "808 SUB",
    icon: "💥",
    color: "#a855f7",
    description: "Deep sine sub-bass impact drop",
  },
  {
    id: "claprush",
    label: "CLAP RUSH",
    shortLabel: "CLAPS",
    icon: "👏",
    color: "#eab308",
    description: "Rapid energetic clap & snare roll",
  },
  {
    id: "siren",
    label: "CLUB SIREN",
    shortLabel: "SIREN",
    icon: "🚨",
    color: "#ef4444",
    description: "Wailing pitch-modulated rave siren",
  },
  {
    id: "stinger",
    label: "DJ STINGER",
    shortLabel: "DROP",
    icon: "🎤",
    color: "#06b6d4",
    description: "Bright brass synth fanfare stinger",
  },
];

class SamplerEngine {
  private samplerVolume = 0.85;

  public setVolume(vol: number) {
    this.samplerVolume = Math.max(0, Math.min(1, vol));
  }

  public getVolume(): number {
    return this.samplerVolume;
  }

  private getCtx(): AudioContext | null {
    const engine = getAudioEngine();
    return engine.ctx;
  }

  private getMasterDestination(): AudioNode | null {
    const engine = getAudioEngine();
    return engine.masterSummer || engine.ctx?.destination || null;
  }

  /**
   * Triggers a synthesized party sample by effect name
   */
  public trigger(type: SampleEffectType, volumeMultiplier = 1.0) {
    const ctx = this.getCtx();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const master = this.getMasterDestination();
    if (!master) return;

    const mainGain = ctx.createGain();
    const effectiveVol = this.samplerVolume * volumeMultiplier;
    mainGain.gain.setValueAtTime(effectiveVol, ctx.currentTime);
    mainGain.connect(master);

    switch (type) {
      case "airhorn":
        this.playAirHorn(ctx, mainGain);
        break;
      case "laser":
        this.playLaser(ctx, mainGain);
        break;
      case "sweep":
        this.playNoiseRiser(ctx, mainGain);
        break;
      case "rewind":
        this.playVinylRewind(ctx, mainGain);
        break;
      case "subdrop":
        this.playSubDrop(ctx, mainGain);
        break;
      case "claprush":
        this.playClapRush(ctx, mainGain);
        break;
      case "siren":
        this.playClubSiren(ctx, mainGain);
        break;
      case "stinger":
        this.playDJStinger(ctx, mainGain);
        break;
    }
  }

  /**
   * 1. AIR HORN (Authentic multi-tone trumpet fanfare)
   */
  private playAirHorn(ctx: AudioContext, destination: AudioNode) {
    const tones = [466.16, 587.33, 698.46, 932.33]; // Bb chord tones
    const bursts = [0.0, 0.16, 0.34]; // 3 quick stabs

    bursts.forEach((startOffset) => {
      tones.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq * (1 + (idx % 2 === 0 ? 0.005 : -0.005)), ctx.currentTime + startOffset);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.98, ctx.currentTime + startOffset + 0.14);

        filter.type = "bandpass";
        filter.frequency.setValueAtTime(freq * 1.5, ctx.currentTime + startOffset);
        filter.Q.setValueAtTime(2.5, ctx.currentTime + startOffset);

        const startTime = ctx.currentTime + startOffset;
        const endTime = startTime + 0.14;

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(0.22 / tones.length, startTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(destination);

        osc.start(startTime);
        osc.stop(endTime);
      });
    });
  }

  /**
   * 2. LASER SHOT (Sci-fi pitch sweep)
   */
  private playLaser(ctx: AudioContext, destination: AudioNode) {
    const repeats = [0.0, 0.11, 0.22];

    repeats.forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      const startT = ctx.currentTime + offset;
      const endT = startT + 0.12;

      osc.frequency.setValueAtTime(3200, startT);
      osc.frequency.exponentialRampToValueAtTime(80, endT);

      gain.gain.setValueAtTime(0.28, startT);
      gain.gain.exponentialRampToValueAtTime(0.001, endT);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(startT);
      osc.stop(endT);
    });
  }

  /**
   * 3. WHITE NOISE RISER / SWEEP
   */
  private playNoiseRiser(ctx: AudioContext, destination: AudioNode) {
    const duration = 2.0;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.setValueAtTime(6.0, ctx.currentTime);
    filter.frequency.setValueAtTime(150, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(12000, ctx.currentTime + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + duration * 0.85);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    whiteNoise.start(ctx.currentTime);
    whiteNoise.stop(ctx.currentTime + duration);
  }

  /**
   * 4. VINYL BRAKE / REWIND
   */
  private playVinylRewind(ctx: AudioContext, destination: AudioNode) {
    const duration = 0.85;
    const osc = ctx.createOscillator();
    const noiseGain = ctx.createGain();
    const mainGain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + duration);

    // Scratch noise buffer
    const bufSize = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(2500, ctx.currentTime);
    noiseFilter.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + duration);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.gain.setValueAtTime(0.25, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    mainGain.gain.setValueAtTime(0.35, ctx.currentTime);
    mainGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(mainGain);
    mainGain.connect(destination);
    noiseGain.connect(destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + duration);
  }

  /**
   * 5. 808 SUB IMPACT DROP
   */
  private playSubDrop(ctx: AudioContext, destination: AudioNode) {
    const duration = 1.2;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + duration);

    gain.gain.setValueAtTime(0.65, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  /**
   * 6. CLAP RUSH ROLL
   */
  private playClapRush(ctx: AudioContext, destination: AudioNode) {
    const claps = [0.0, 0.1, 0.18, 0.25, 0.31, 0.36, 0.40, 0.43, 0.46, 0.48, 0.50];

    claps.forEach((offset, idx) => {
      const startT = ctx.currentTime + offset;
      const dur = 0.05;
      const bufSize = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buf;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1400 + idx * 80, startT);
      filter.Q.setValueAtTime(3.0, startT);

      const gain = ctx.createGain();
      const vol = 0.15 + (idx / claps.length) * 0.25;
      gain.gain.setValueAtTime(vol, startT);
      gain.gain.exponentialRampToValueAtTime(0.001, startT + dur);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(destination);

      noise.start(startT);
      noise.stop(startT + dur);
    });
  }

  /**
   * 7. CLUB SIREN
   */
  private playClubSiren(ctx: AudioContext, destination: AudioNode) {
    const duration = 1.4;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(880, ctx.currentTime);

    lfo.type = "sine";
    lfo.frequency.setValueAtTime(4.0, ctx.currentTime); // 4Hz wail speed
    lfoGain.gain.setValueAtTime(220, ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.28, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.28, ctx.currentTime + duration - 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3500, ctx.currentTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    osc.start(ctx.currentTime);
    lfo.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    lfo.stop(ctx.currentTime + duration);
  }

  /**
   * 8. DJ BRASS STINGER
   */
  private playDJStinger(ctx: AudioContext, destination: AudioNode) {
    const chord = [220, 277.18, 329.63, 440, 554.37]; // A Major bright brass chord
    const duration = 0.9;

    chord.forEach((freq) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(freq * 8, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + duration);
      filter.Q.setValueAtTime(3.0, ctx.currentTime);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.24 / chord.length, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    });
  }
}

export const samplerEngine = new SamplerEngine();
