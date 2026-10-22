import "server-only";
import { AIError } from "../../ai/contract";

/** Enforce the byte limit while streaming, including requests without Content-Length. */
export async function boundedJson(source: Request | Response, limit = 65536): Promise<unknown> {
  if (Number(source.headers.get("content-length")) > limit) throw new AIError("INVALID_REQUEST", 413);
  const reader = source.body?.getReader();
  if (!reader) throw new AIError("INVALID_REQUEST", 422);
  let length = 0, text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new AIError("INVALID_REQUEST", 413); }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    if (error instanceof AIError || (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name))) throw error;
    throw new AIError("INVALID_REQUEST", 422);
  } finally { reader.releaseLock(); }
}
export function jsonResponse(value: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra } });
}
export function errorResponse(error: unknown) {
  const safe = error instanceof AIError ? error : new AIError("PROVIDER_UNAVAILABLE", 503);
  return jsonResponse({ error: { code: safe.code, message: safe.message } }, safe.status,
    safe.retryAfter ? { "Retry-After": String(safe.retryAfter) } : {});
}
