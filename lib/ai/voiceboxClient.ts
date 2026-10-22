"use client";

import { getAudioEngine } from "../audio/AudioEngine";

export interface VoiceboxSpeakOptions {
  profile?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  duckMusic?: boolean; // Temporarily lowers music volume while speaking
}

class VoiceboxClient {
  private localApiUrl = "http://127.0.0.1:17493";
  private isSpeaking = false;

  public setApiUrl(url: string) {
    this.localApiUrl = url.replace(/\/$/, "");
  }

  public getApiUrl(): string {
    return this.localApiUrl;
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  /**
   * Speaks text using local Voicebox instance (ports 17493 or 17423)
   * Falls back seamlessly to browser Web Speech API if Voicebox is offline or loading.
   */
  public async speak(text: string, options: VoiceboxSpeakOptions = {}): Promise<boolean> {
    if (!text.trim() || this.isSpeaking) return false;
    this.isSpeaking = true;
    try {
      return await this.speakOnce(text, options);
    } finally {
      this.isSpeaking = false;
    }
  }

  private async speakOnce(text: string, options: VoiceboxSpeakOptions): Promise<boolean> {
    const {
      profile = "eze",
      rate = 1.0,
      pitch = 1.0,
      volume = 1.0,
      duckMusic = true,
    } = options;

    const discoveryDeadline = performance.now() + 4000;

    // Try candidate URLs (17493 primary from user setup, 17423 fallback)
    const candidateBases = [
      this.localApiUrl,
      "http://127.0.0.1:17493",
      "http://localhost:17493",
      "http://127.0.0.1:17423",
    ].filter((v, i, a) => a.indexOf(v) === i);

    discovery: for (const base of candidateBases) {
      // Endpoints supported by Voicebox (OpenAI compatible /v1/audio/speech, /speak, /generate)
      const attempts = [
        {
          url: `${base}/v1/audio/speech`,
          body: { model: "tts-1", input: text, voice: profile },
        },
        {
          url: `${base}/speak`,
          body: { text, profile, stream: false },
        },
        {
          url: `${base}/generate`,
          body: { prompt: text, voice: profile },
        },
        {
          url: `${base}/api/tts`,
          body: { text, voice: profile },
        },
      ];

      for (const attempt of attempts) {
        if (performance.now() >= discoveryDeadline) break discovery;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), Math.min(1000, Math.max(1, discoveryDeadline - performance.now())));

          const response = await fetch(attempt.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(attempt.body),
            signal: controller.signal,
          }).catch(() => null);

          clearTimeout(timeoutId);

          if (response && response.ok) {
            this.localApiUrl = base;
            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("audio") || contentType.includes("octet-stream") || contentType.includes("wav") || contentType.includes("mp3")) {
              const arrayBuffer = await response.arrayBuffer();
              if (await this.playAudioBuffer(arrayBuffer, volume, duckMusic)) return true;
              continue;
            }

            // In case JSON returned with base64 audio
            try {
              const json = await response.json();
              const b64 = json.audio || json.data || json.audio_base64;
              if (b64) {
                const binaryStr = atob(b64);
                const bytes = new Uint8Array(binaryStr.length);
                for (let k = 0; k < binaryStr.length; k++) {
                  bytes[k] = binaryStr.charCodeAt(k);
                }
                if (await this.playAudioBuffer(bytes.buffer, volume, duckMusic)) return true;
              }
            } catch {}

            // A successful HTTP response without audio is not a successful announcement.
            continue;
          }
        } catch {
          // continue
        }
      }
    }

    // 2. Fallback: Browser Native Web Speech API
    try {
      return await this.speakNativeWebSpeech(text, { rate, pitch, volume }, duckMusic);
    } catch (err) {
      console.error("[TTS] Web Speech Error:", err);
    }

    return false;
  }

  /**
   * Browser native SpeechSynthesis fallback (Spanish / Rioplatense preferred)
   */
  private speakNativeWebSpeech(
    text: string,
    opts: { rate: number; pitch: number; volume: number },
    duckMusic: boolean
  ): Promise<boolean> {
    let restoreDucking: (() => void) | null = null;
    return this.runNativeSpeech(text, opts, () => {
      if (duckMusic && !restoreDucking) restoreDucking = this.applyDucking();
    }).finally(() => restoreDucking?.());
  }

  private runNativeSpeech(
    text: string,
    opts: { rate: number; pitch: number; volume: number },
    onStart: () => void
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        resolve(false);
        return;
      }

      window.speechSynthesis.cancel(); // Stop any pending speech

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = opts.rate;
      utterance.pitch = opts.pitch;
      utterance.volume = opts.volume;

      // Find Spanish voice if available
      const voices = window.speechSynthesis.getVoices();
      const spanishVoice = voices.find(
        (v) =>
          v.lang.startsWith("es-AR") ||
          v.lang.startsWith("es-ES") ||
          v.lang.startsWith("es-MX") ||
          v.lang.startsWith("es")
      );
      if (spanishVoice) {
        utterance.voice = spanishVoice;
      }

      utterance.onstart = onStart;
      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);

      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Plays binary audio returned from Voicebox into the Web Audio Engine
   */
  private async playAudioBuffer(arrayBuffer: ArrayBuffer, volume: number, duckMusic: boolean): Promise<boolean> {
    const engine = getAudioEngine();
    if (!engine.ctx) return false;
    let restoreDucking: (() => void) | null = null;
    let source: AudioBufferSourceNode | null = null;
    let gain: GainNode | null = null;

    try {
      if (engine.ctx.state === "suspended") await engine.ctx.resume();
      const audioBuffer = await engine.ctx.decodeAudioData(arrayBuffer);
      source = engine.ctx.createBufferSource();
      gain = engine.ctx.createGain();

      source.buffer = audioBuffer;
      gain.gain.setValueAtTime(volume, engine.ctx.currentTime);

      const destination = engine.masterSummer || engine.ctx.destination;
      source.connect(gain);
      gain.connect(destination);

      const playbackSource = source;
      if (duckMusic) restoreDucking = this.applyDucking();
      return await new Promise<boolean>((resolve) => {
        playbackSource.onended = () => resolve(true);
        playbackSource.start(0);
      });
    } catch (err) {
      console.warn("[Voicebox] Failed to decode audio buffer:", err);
      return false;
    } finally {
      restoreDucking?.();
      source?.disconnect();
      gain?.disconnect();
    }
  }

  /**
   * Ducking: Temporarily lowers music volume during MC announcements (Radio/DJ ducking)
   */
  private applyDucking(): () => void {
    const engine = getAudioEngine();
    engine.setMusicDucking(0.45);
    return () => engine.setMusicDucking(1);

  }
}

export const voiceboxClient = new VoiceboxClient();
