import "server-only";
import { AIError } from "../../ai/contract";
import type { SpeechInput } from "../../ai/speechContract";
import type { AIConfig } from "./access";
import { boundedJson } from "./http";

const styles = {
  assistant: "Latin American Spanish. Calm, sophisticated cinematic assistant. Warm, articulate, confident, natural pacing. No shouting. No music.",
  radio: "Latin American Spanish. Professional radio host, warm and clear, confident, conversational rhythm. No music.",
  party: "Latin American Spanish. Energetic DJ host, enthusiastic and rhythmic, clear diction without distortion. No music.",
};
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function invalid(): never { throw new AIError("INVALID_PROVIDER_RESPONSE", 502); }

/** Accept only bounded PCM WAV; neither a MIME label nor base64 alone proves audio. */
export function validateWav(bytes: Buffer) {
  if (bytes.length < 44 || bytes.length > 3 * 1024 * 1024 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE" || bytes.readUInt32LE(4) + 8 !== bytes.length) invalid();
  let byteRate = 0, blockAlign = 0, dataSize = 0;
  for (let position = 12; position + 8 <= bytes.length;) {
    const tag = bytes.toString("ascii", position, position + 4), size = bytes.readUInt32LE(position + 4), start = position + 8;
    if (start + size > bytes.length) invalid();
    if (tag === "fmt ") {
      if (size < 16) invalid();
      const channels = bytes.readUInt16LE(start + 2), rate = bytes.readUInt32LE(start + 4);
      byteRate = bytes.readUInt32LE(start + 8); blockAlign = bytes.readUInt16LE(start + 12);
      if (bytes.readUInt16LE(start) !== 1 || ![1, 2].includes(channels) || rate < 8000 || rate > 48000 || bytes.readUInt16LE(start + 14) !== 16 || blockAlign !== channels * 2 || byteRate !== rate * blockAlign) invalid();
    }
    if (tag === "data") dataSize += size;
    position = start + size + (size % 2);
  }
  if (!byteRate || !dataSize || dataSize % blockAlign || dataSize / byteRate > 45) invalid();
  return bytes;
}

export async function generateSpeech(config: AIConfig, model: string, input: SpeechInput, signal: AbortSignal, fetcher: typeof fetch) {
  if (!/^gemini-3\.8-flash(?:-lite)?-tts$/.test(model)) throw new AIError("MODEL_UNAVAILABLE", 503);
  try {
    const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(40000)]),
      headers: { "Content-Type": "application/json", "x-goog-api-key": config.apiKey },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: input.text, speech_metadata: { style: styles[input.style] } }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { voice: input.voice } } } }),
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new AIError([401, 403].includes(response.status) ? "PROVIDER_AUTH" : response.status === 429 ? "PROVIDER_QUOTA" : response.status === 404 ? "MODEL_UNAVAILABLE" : "PROVIDER_UNAVAILABLE", 503);
    }
    const data = await boundedJson(response, 4 * 1024 * 1024);
    if (!record(data) || !Array.isArray(data.candidates)) invalid();
    const candidate: unknown = data.candidates[0];
    if (!record(candidate) || !record(candidate.content) || !Array.isArray(candidate.content.parts)) invalid();
    const parts = candidate.content.parts.filter(record).filter(part => part.thought !== true && record(part.inlineData));
    if (parts.length !== 1) invalid();
    const inline = parts[0].inlineData;
    if (!record(inline) || inline.mimeType !== "audio/wav" || typeof inline.data !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(inline.data) || inline.data.length % 4) invalid();
    return validateWav(Buffer.from(inline.data, "base64"));
  } catch (error) {
    if (error instanceof AIError) { if (error.code === "INVALID_REQUEST") invalid(); throw error; }
    if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) throw new AIError("PROVIDER_TIMEOUT", 504);
    throw new AIError("PROVIDER_UNAVAILABLE", 503);
  }
}
