export interface TrackInfo { id: string; title: string; artist: string; bpm: number; key: string; duration: number }
export interface SetlistItem { trackId: string; mixPoint: number; transitionStyle: "smooth" | "cut" }
export interface Plan { setlist: SetlistItem[]; djComment: string }
export type AIReason = "NOT_CONFIGURED" | "ACCESS_REQUIRED" | "LOCAL_SELECTED" | "LIMIT_REACHED" |
  "PROVIDER_AUTH" | "PROVIDER_QUOTA" | "MODEL_UNAVAILABLE" | "PROVIDER_TIMEOUT" | "PROVIDER_UNAVAILABLE" |
  "INVALID_PROVIDER_RESPONSE" | "LIMITS_UNAVAILABLE" | "INVALID_REQUEST" | "ORIGIN_DENIED" | "INVALID_ACCESS_CODE" | "NETWORK";
export interface PlanResult extends Plan { source: "gemini" | "local"; reason?: AIReason; model?: string }
export interface AIStatus { configured: boolean; authorized: boolean; model: string | null }

const messages: Record<AIReason, string> = {
  NOT_CONFIGURED: "La IA no está habilitada en este servidor.",
  ACCESS_REQUIRED: "Conectá la IA con tu código de acceso.",
  LOCAL_SELECTED: "Elegiste el automático local por BPM.",
  LIMIT_REACHED: "Se alcanzó el límite de uso de IA. Probá más tarde.",
  PROVIDER_AUTH: "Google rechazó la autenticación del servidor.",
  PROVIDER_QUOTA: "Google no tiene cuota disponible para esta solicitud.",
  MODEL_UNAVAILABLE: "El modelo configurado no está disponible.",
  PROVIDER_TIMEOUT: "Gemini tardó demasiado en responder.",
  PROVIDER_UNAVAILABLE: "Gemini no está disponible en este momento.",
  INVALID_PROVIDER_RESPONSE: "Gemini devolvió un plan que no se puede utilizar.",
  LIMITS_UNAVAILABLE: "No se pudo verificar el límite de uso.",
  INVALID_REQUEST: "La solicitud contiene datos no válidos o supera el tamaño permitido.",
  ORIGIN_DENIED: "Esta conexión no está permitida.",
  INVALID_ACCESS_CODE: "El código de acceso no es válido.",
  NETWORK: "No se pudo conectar con el servidor de IA.",
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
      (item.transitionStyle !== "smooth" && item.transitionStyle !== "cut")) throw invalid();
    seen.add(item.trackId);
    return { trackId: item.trackId, mixPoint: Math.min(64, known.get(item.trackId)!.duration / 2, Math.max(2, item.mixPoint)), transitionStyle: item.transitionStyle };
  });
  for (const track of tracks) if (!seen.has(track.id)) setlist.push({ trackId: track.id, mixPoint: Math.min(24, track.duration * 0.1), transitionStyle: "smooth" });
  return { setlist, djComment: value.djComment };
}

export function localPlan(tracks: TrackInfo[], reason: AIReason = "LOCAL_SELECTED"): PlanResult {
  return { source: "local", reason, djComment: "Automático local: canciones ordenadas por BPM estimado.",
    setlist: [...tracks].sort((a, b) => (a.bpm || Infinity) - (b.bpm || Infinity)).map(track => ({
      trackId: track.id, mixPoint: Math.min(24, track.duration * 0.1), transitionStyle: "smooth",
    })) };
}
