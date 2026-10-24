import { isTransitionEffect, type TransitionEffect } from "./transitionEffects";
export interface TrackInfo { id: string; title: string; artist: string; bpm: number; key: string; duration: number }
export interface SetlistItem { trackId: string; mixPoint: number; transitionStyle: "smooth" | "cut"; effect?: TransitionEffect }
export interface Plan { setlist: SetlistItem[]; djComment: string }
export type AIReason = "NOT_CONFIGURED" | "ACCESS_REQUIRED" | "LOCAL_SELECTED" | "LIMIT_REACHED" |
  "PROVIDER_AUTH" | "PROVIDER_QUOTA" | "MODEL_UNAVAILABLE" | "PROVIDER_TIMEOUT" | "PROVIDER_UNAVAILABLE" |
  "INVALID_PROVIDER_RESPONSE" | "LIMITS_UNAVAILABLE" | "INVALID_REQUEST" | "ORIGIN_DENIED" | "INVALID_ACCESS_CODE" | "NETWORK";
export interface PlanResult extends Plan { source: "groq" | "local"; reason?: AIReason; model?: string }
export interface AIStatus { configured: boolean; authorized: boolean; model: string | null }

const messages: Record<AIReason, string> = {
  NOT_CONFIGURED: "AI is not configured on this server.",
  ACCESS_REQUIRED: "Connect AI using your access code.",
  LOCAL_SELECTED: "Local Auto-DJ selected: songs are sorted by BPM.",
  LIMIT_REACHED: "AI usage limit reached. Try again later.",
  PROVIDER_AUTH: "Groq rejected the server credentials.",
  PROVIDER_QUOTA: "Groq has no quota available for this request.",
  MODEL_UNAVAILABLE: "The configured model is unavailable. Check Groq model permissions.",
  PROVIDER_TIMEOUT: "Groq took too long to respond.",
  PROVIDER_UNAVAILABLE: "Groq is currently unavailable.",
  INVALID_PROVIDER_RESPONSE: "Groq returned an unusable response.",
  LIMITS_UNAVAILABLE: "Unable to verify the usage limit.",
  INVALID_REQUEST: "The request is invalid or exceeds the size limit.",
  ORIGIN_DENIED: "This connection is not allowed.",
  INVALID_ACCESS_CODE: "Invalid access code.",
  NETWORK: "Unable to connect to the AI server.",
};
export const reasonMessage = (code?: AIReason) => code ? messages[code] : "";
export const isAIReason = (value: unknown): value is AIReason => typeof value === "string" && Object.hasOwn(messages, value);
export class AIError extends Error {
  constructor(public code: AIReason, public status = 500, public retryAfter?: number) { super(reasonMessage(code)); }
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const boundedText = (value: unknown, max: number, empty = false): value is string => typeof value === "string" && value.length <= max && (empty || value.trim().length > 0);

export function parseTracks(value: unknown): TrackInfo[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 200) throw new AIError("INVALID_REQUEST", 422);
  const seen = new Set<string>();
  return value.map(item => {
    if (!record(item) || !boundedText(item.id, 128) || seen.has(item.id) || !boundedText(item.title, 200) ||
      !boundedText(item.artist, 160, true) || !boundedText(item.key, 16) ||
      typeof item.bpm !== "number" || !Number.isFinite(item.bpm) || item.bpm < 0 || item.bpm > 400 ||
      typeof item.duration !== "number" || !Number.isFinite(item.duration) || item.duration <= 0 || item.duration > 86400) {
      throw new AIError("INVALID_REQUEST", 422);
    }
    seen.add(item.id);
    return { id: item.id, title: item.title, artist: item.artist, bpm: item.bpm, key: item.key, duration: item.duration };
  });
}

export function parsePlan(value: unknown, tracks: TrackInfo[]): Plan {
  const invalid = () => new AIError("INVALID_PROVIDER_RESPONSE", 502);
  if (!record(value) || !Array.isArray(value.setlist) || !value.setlist.length || value.setlist.length > 200 || !boundedText(value.djComment, 500, true)) throw invalid();
  const known = new Map(tracks.map(track => [track.id, track])), seen = new Set<string>();
  const setlist: SetlistItem[] = value.setlist.map(item => {
    if (!record(item) || typeof item.trackId !== "string" || !known.has(item.trackId) || seen.has(item.trackId) ||
      typeof item.mixPoint !== "number" || !Number.isFinite(item.mixPoint) ||
      (item.transitionStyle !== "smooth" && item.transitionStyle !== "cut") || (item.effect !== undefined && !isTransitionEffect(item.effect))) throw invalid();
    seen.add(item.trackId);
    return { trackId: item.trackId, mixPoint: Math.min(64, known.get(item.trackId)!.duration / 2, Math.max(2, item.mixPoint)), transitionStyle: item.transitionStyle, ...(item.effect !== undefined ? { effect: item.effect as TransitionEffect } : {}) };
  });
  for (const track of tracks) if (!seen.has(track.id)) setlist.push({ trackId: track.id, mixPoint: Math.min(24, track.duration * 0.1), transitionStyle: "smooth" });
  return { setlist, djComment: value.djComment };
}

export function localPlan(tracks: TrackInfo[], reason: AIReason = "LOCAL_SELECTED"): PlanResult {
  return { source: "local", reason, djComment: "Local Auto-DJ: songs sorted by estimated BPM.",
    setlist: [...tracks].sort((a, b) => (a.bpm || Infinity) - (b.bpm || Infinity)).map(track => ({
      trackId: track.id, mixPoint: Math.min(24, track.duration * 0.1), transitionStyle: "smooth",
    })) };
}

export function parseBlockName(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > 60 || /[\u0000-\u001f]/.test(value)) throw new AIError("INVALID_REQUEST", 422);
  return value.trim();
}
