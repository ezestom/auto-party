import "server-only";
import { AIError } from "../../ai/contract";

/** Bound binary and JSON bodies while streaming, even without Content-Length. */
export async function boundedBytes(source: Request | Response, limit = 65536): Promise<Uint8Array> {
  if (Number(source.headers.get("content-length")) > limit) {
    await source.body?.cancel().catch(() => {});
    throw new AIError("INVALID_REQUEST", 413);
  }
  const reader = source.body?.getReader();
  if (!reader) throw new AIError("INVALID_REQUEST", 422);
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new AIError("INVALID_REQUEST", 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } finally { reader.releaseLock(); }
}
export async function boundedJson(source: Request | Response, limit = 65536): Promise<unknown> {
  try { return JSON.parse(new TextDecoder().decode(await boundedBytes(source, limit))); }
  catch (error) {
    if (error instanceof AIError || (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name))) throw error;
    throw new AIError("INVALID_REQUEST", 422);
  }
}
export function jsonResponse(value: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra } });
}
/** Never forward upstream messages or credentials. */
export async function providerFailure(response: Response, status: number): Promise<never> {
  await response.body?.cancel().catch(() => {});
  throw new AIError([401, 403].includes(response.status) ? "PROVIDER_AUTH" : response.status === 429 ? "PROVIDER_QUOTA" : response.status === 404 ? "MODEL_UNAVAILABLE" : "PROVIDER_UNAVAILABLE", status);
}
export function errorResponse(error: unknown) {
  const safe = error instanceof AIError ? error : new AIError("PROVIDER_UNAVAILABLE", 503);
  return jsonResponse({ error: { code: safe.code, message: safe.message } }, safe.status,
    safe.retryAfter ? { "Retry-After": String(safe.retryAfter) } : {});
}
