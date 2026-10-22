import { AIError } from "./contract";
export const SPEECH_VOICES = ["Charon", "Fenrir", "Kore"] as const;
export const SPEECH_STYLES = { assistant: "Asistente cinematográfico", radio: "Locutor de radio", party: "Animador de fiesta" } as const;
export type SpeechVoice = typeof SPEECH_VOICES[number];
export type SpeechStyle = keyof typeof SPEECH_STYLES;
export interface SpeechInput { text: string; voice: SpeechVoice; style: SpeechStyle }
export function parseSpeech(value: unknown): SpeechInput {
  if (!value || typeof value !== "object") throw new AIError("INVALID_REQUEST", 422);
  const input = value as Record<string, unknown>;
  const voice = input.voice ?? "Charon", style = input.style ?? "assistant";
  if (typeof input.text !== "string" || !input.text.trim() || input.text.length > 400 || !SPEECH_VOICES.includes(voice as SpeechVoice) || typeof style !== "string" || !Object.hasOwn(SPEECH_STYLES, style)) throw new AIError("INVALID_REQUEST", 422);
  return { text: input.text.trim(), voice: voice as SpeechVoice, style: style as SpeechStyle };
}
