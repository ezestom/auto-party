import { expect, test, vi } from "vitest";
import { createAIHandlers } from "./handlers";
import { createSession, readConfig } from "./access";
import { MemoryQuota } from "./limits";
import { validateWav } from "./speech";

const env = { NODE_ENV: "development", GEMINI_API_KEY: "private-google-test-key", AI_ACCESS_CODE: "invite-code-123456", AI_SESSION_SECRET: "s".repeat(48), AI_ALLOWED_ORIGINS: "http://localhost:3000" };
export function wav() {
  const data = Buffer.alloc(48044);
  data.write("RIFF"); data.writeUInt32LE(data.length - 8, 4); data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(24000, 24); data.writeUInt32LE(48000, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write("data", 36); data.writeUInt32LE(48000, 40); return data;
}
const reply = (audio = wav()) => Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/wav", data: audio.toString("base64") } }] } }] });
test("WAV validation rejects fake lengths, non-PCM and excessive duration", () => {
  const truncated = wav(); truncated.writeUInt32LE(999999, 40);
  const compressed = wav(); compressed.writeUInt16LE(3, 20);
  const long = Buffer.alloc(44 + 48000 * 46); wav().copy(long, 0, 0, 44); long.writeUInt32LE(long.length - 8, 4); long.writeUInt32LE(long.length - 44, 40);
  for (const bytes of [truncated, compressed, long]) expect(() => validateWav(bytes)).toThrow();
});
function request(body: unknown = { text: "Buenas noches", voice: "Charon", style: "assistant" }, authorized = true, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/ai/speech", { method: "POST", headers: { origin, "content-type": "application/json", cookie: authorized ? `eze_ai_session=${createSession(readConfig(env)).token}` : "" }, body: JSON.stringify(body) });
}
test("speech requires a session and allowed origin before contacting Google", async () => {
  const fetcher = vi.fn(async () => reply()), api = createAIHandlers({ env: () => env, fetcher, quota: new MemoryQuota() });
  expect((await api.speech(request(undefined, false))).status).toBe(401);
  expect((await api.speech(request(undefined, true, "https://evil.example"))).status).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
});
test("speech returns actual bounded WAV with private authentication and separate style metadata", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => reply()), api = createAIHandlers({ env: () => env, fetcher, quota: new MemoryQuota() });
  const response = await api.speech(request());
  expect(response.status).toBe(200); expect(response.headers.get("content-type")).toBe("audio/wav");
  expect(Buffer.from(await response.arrayBuffer())).toEqual(wav());
  const [url, options] = fetcher.mock.calls[0];
  expect(String(url)).toContain("gemini-3.8-flash-tts:generateContent");
  expect(new Headers(options?.headers).get("x-goog-api-key")).toBe(env.GEMINI_API_KEY);
  const body = JSON.parse(String(options?.body));
  expect(body.contents[0].parts[0].text).toBe("Buenas noches");
  expect(body.contents[0].parts[0].speech_metadata.style).toContain("Spanish");
  expect(body.generationConfig.speechConfig.voiceConfig.voice).toBe("Charon");
  expect(response.headers.get("cache-control")).toBe("no-store");
});
test("speech rejects long text, arbitrary voices and unsupported styles without consuming Google", async () => {
  const fetcher = vi.fn(async () => reply()), api = createAIHandlers({ env: () => env, fetcher, quota: new MemoryQuota() });
  for (const body of [{ text: "x".repeat(401) }, { text: "Hola", voice: "custom-secret" }, { text: "Hola", style: "unknown" }, { text: " " }]) expect((await api.speech(request(body))).status).toBe(422);
  expect(fetcher).not.toHaveBeenCalled();
});
test("speech shares the global provider quota and fails closed on invalid audio", async () => {
  const fetcher = vi.fn(async () => reply(Buffer.from("not audio"))), api = createAIHandlers({ env: () => ({ ...env, AI_DAILY_REQUEST_LIMIT: "1" }), fetcher, quota: new MemoryQuota() });
  expect(await (await api.speech(request())).json()).toMatchObject({ error: { code: "INVALID_PROVIDER_RESPONSE" } });
  expect((await api.test(new Request(request().url, { method: "POST", headers: request().headers, body: "{}" }))).status).toBe(429);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
test("provider failures expose safe messages and never report successful speech", async () => {
  const fetcher = vi.fn(async () => Response.json({ error: { message: env.GEMINI_API_KEY } }, { status: 429 }));
  const api = createAIHandlers({ env: () => env, fetcher, quota: new MemoryQuota() });
  const response = await api.speech(request());
  expect(response.status).toBe(503); expect(await response.text()).not.toContain(env.GEMINI_API_KEY);
});
