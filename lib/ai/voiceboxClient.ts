"use client";

import { getAudioEngine } from "../audio/AudioEngine";
import { useMixerStore } from "../../stores/mixerStore";

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
    if (!text || text.trim() === "") return false;
    this.isSpeaking = true;

    const {
      profile = "eze",
      rate = 1.0,
      pitch = 1.0,
      volume = 1.0,
      duckMusic = true,
    } = options;

    // Apply Audio Ducking: smoothly lower master/channel gains so voice is clearly heard
    let restoreDucking: (() => void) | null = null;
    if (duckMusic) {
      restoreDucking = this.applyDucking();
    }

    // Try candidate URLs (17493 primary from user setup, 17423 fallback)
    const candidateBases = [
      this.localApiUrl,
      "http://127.0.0.1:17493",
      "http://localhost:17493",
      "http://127.0.0.1:17423",
    ].filter((v, i, a) => a.indexOf(v) === i);

    for (const base of candidateBases) {
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
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);

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
              await this.playAudioBuffer(arrayBuffer, volume);
              if (restoreDucking) restoreDucking();
              this.isSpeaking = false;
              return true;
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
                await this.playAudioBuffer(bytes.buffer, volume);
                if (restoreDucking) restoreDucking();
                this.isSpeaking = false;
                return true;
              }
            } catch {}

            const durationEst = Math.max(1500, text.length * 75);
            await new Promise((r) => setTimeout(r, durationEst));
            if (restoreDucking) restoreDucking();
            this.isSpeaking = false;
            return true;
          }
        } catch (e) {
          // continue
        }
      }
    }

    // 2. Fallback: Browser Native Web Speech API
    try {
      await this.speakNativeWebSpeech(text, { rate, pitch, volume });
    } catch (err) {
      console.error("[TTS] Web Speech Error:", err);
    } finally {
      if (restoreDucking) restoreDucking();
      this.isSpeaking = false;
    }

    return true;
  }

  /**
   * Browser native SpeechSynthesis fallback (Spanish / Rioplatense preferred)
   */
  private speakNativeWebSpeech(
    text: string,
    opts: { rate: number; pitch: number; volume: number }
  ): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        resolve();
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

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Plays binary audio returned from Voicebox into the Web Audio Engine
   */
  private async playAudioBuffer(arrayBuffer: ArrayBuffer, volume: number): Promise<void> {
    const engine = getAudioEngine();
    if (!engine.ctx) return;

    if (engine.ctx.state === "suspended") {
      await engine.ctx.resume();
    }

    try {
      const audioBuffer = await engine.ctx.decodeAudioData(arrayBuffer);
      const source = engine.ctx.createBufferSource();
      const gain = engine.ctx.createGain();

      source.buffer = audioBuffer;
      gain.gain.setValueAtTime(volume, engine.ctx.currentTime);

      const destination = (engine as any).masterSummer || engine.ctx.destination;
      source.connect(gain);
      gain.connect(destination);

      return new Promise((resolve) => {
        source.onended = () => resolve();
        source.start(0);
      });
    } catch (err) {
      console.warn("[Voicebox] Failed to decode audio buffer:", err);
    }
  }

  /**
   * Ducking: Temporarily lowers music volume during MC announcements (Radio/DJ ducking)
   */
  private applyDucking(): () => void {
    const mixer = useMixerStore.getState();
    const origMaster = mixer.masterVolume;
    const duckedMaster = origMaster * 0.45; // lower to 45%

    mixer.setMasterVolume(duckedMaster);

    return () => {
      // Smoothly restore volume
      setTimeout(() => {
        useMixerStore.getState().setMasterVolume(origMaster);
      }, 400);
    };
  }
}

export const voiceboxClient = new VoiceboxClient();
