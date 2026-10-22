"use client";
import { getAudioEngine } from "../audio/AudioEngine";
import { AIError, isAIReason } from "./contract";
import { parseSpeech, type SpeechInput } from "./speechContract";
export type VoicePhase = "generating" | "playing";

export class GoogleVoiceClient {
  private controller: AbortController | null = null;
  private source: AudioBufferSourceNode | null = null;
  private cache = new Map<string, ArrayBuffer>();
  public stop() { this.controller?.abort(); try { this.source?.stop(); } catch { /* Already ended. */ } }
  public async speak(input: SpeechInput, onPhase: (phase: VoicePhase) => void = () => {}): Promise<boolean> {
    if (this.controller) return false;
    const parsed = parseSpeech(input), key = JSON.stringify(parsed), controller = new AbortController();
    this.controller = controller;
    let gain: GainNode | null = null, restore = false;
    const engine = getAudioEngine();
    try {
      // Initialize during the button gesture, before waiting for the network.
      await engine.init();
      if (!engine.ctx) throw new Error("No se pudo iniciar el audio.");
      if (engine.ctx.state === "suspended") await engine.ctx.resume();
      let audio = this.cache.get(key);
      if (!audio) {
        onPhase("generating");
        const response = await fetch("/api/ai/speech", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]) });
        if (!response.ok) {
          const error = await response.json().catch(() => null);
          throw new AIError(isAIReason(error?.error?.code) ? error.error.code : "NETWORK", response.status);
        }
        if (response.headers.get("content-type")?.split(";")[0] !== "audio/wav") throw new AIError("INVALID_PROVIDER_RESPONSE");
        audio = await response.arrayBuffer();
        if (audio.byteLength < 44 || audio.byteLength > 3 * 1024 * 1024) throw new AIError("INVALID_PROVIDER_RESPONSE");
      }
      if (controller.signal.aborted) return false;
      const decoded = await engine.ctx.decodeAudioData(audio.slice(0));
      if (controller.signal.aborted) return false;
      this.cache.delete(key); this.cache.set(key, audio);
      while (this.cache.size > 8 || [...this.cache.values()].reduce((size, item) => size + item.byteLength, 0) > 8 * 1024 * 1024) this.cache.delete(this.cache.keys().next().value!);
      const source = engine.ctx.createBufferSource(); this.source = source;
      gain = engine.ctx.createGain(); gain.gain.setValueAtTime(1, engine.ctx.currentTime);
      source.buffer = decoded; source.connect(gain); gain.connect(engine.masterSummer || engine.ctx.destination);
      engine.setMusicDucking(0.45); restore = true;
      await new Promise<void>((resolve, reject) => {
        source.onended = () => resolve();
        try { source.start(); onPhase("playing"); } catch (error) { reject(error); }
      });
      return !controller.signal.aborted;
    } catch (error) {
      if (controller.signal.aborted) return false;
      if (error instanceof AIError) throw error;
      throw new AIError(error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name) ? "PROVIDER_TIMEOUT" : "NETWORK");
    } finally {
      if (restore) engine.setMusicDucking(1);
      this.source?.disconnect(); gain?.disconnect(); this.source = null; this.controller = null;
    }
  }
}
export const googleVoiceClient = new GoogleVoiceClient();
