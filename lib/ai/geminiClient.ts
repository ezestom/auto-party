"use client";

import { AIError, isAIReason, localPlan, parsePlan, parseTracks, type AIStatus, type TrackInfo, type PlanResult } from "./contract";
export type { TrackInfo, SetlistItem, PlanResult as GeminiSetlistResponse } from "./contract";
export { localPlan as generateFallbackSetlist } from "./contract";

async function requestAI(path: "status" | "session" | "test" | "setlist", method = "GET", body?: object, signal?: AbortSignal): Promise<unknown> {
  try {
    const timeout = AbortSignal.timeout(25000);
    const response = await fetch("/api/ai/" + path, { method, credentials: "same-origin", cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new AIError(isAIReason(data?.error?.code) ? data.error.code : "NETWORK", response.status);
    return data;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof AIError) throw error;
    throw new AIError(error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name) ? "PROVIDER_TIMEOUT" : "NETWORK", 503);
  }
}
export async function getAIStatus(): Promise<AIStatus> {
  const value = await requestAI("status") as AIStatus | null;
  if (!value || typeof value.configured !== "boolean" || typeof value.authorized !== "boolean" || (value.model !== null && typeof value.model !== "string")) throw new AIError("NETWORK");
  return { configured: value.configured, authorized: value.authorized, model: value.model };
}
export async function unlockAI(accessCode: string): Promise<void> { await requestAI("session", "POST", { accessCode }); }
export async function logoutAI(): Promise<void> { await requestAI("session", "DELETE"); }
export async function testAIConnection(): Promise<{ connected: true; model: string; checkedAt: string }> {
  const value = await requestAI("test", "POST", {}) as { connected?: unknown; model?: unknown; checkedAt?: unknown } | null;
  if (value?.connected !== true || typeof value.model !== "string" || typeof value.checkedAt !== "string" || !Number.isFinite(Date.parse(value.checkedAt))) throw new AIError("INVALID_PROVIDER_RESPONSE");
  return { connected: true, model: value.model, checkedAt: value.checkedAt };
}
export async function generateSetlist(input: TrackInfo[], signal?: AbortSignal): Promise<PlanResult> {
  try {
    const tracks = parseTracks(input);
    const value = await requestAI("setlist", "POST", { tracks }, signal) as { source?: unknown; model?: unknown } | null;
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    if (value?.source !== "gemini") throw new AIError("INVALID_PROVIDER_RESPONSE");
    return { ...parsePlan(value, tracks), source: "gemini", model: typeof value.model === "string" ? value.model : "Gemini" };
  } catch (error) {
    if (signal?.aborted) throw error;
    return localPlan(input, error instanceof AIError ? error.code : "INVALID_PROVIDER_RESPONSE");
  }
}
