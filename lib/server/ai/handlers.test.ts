import { beforeEach, expect, test, vi } from "vitest";
import { createAIHandlers } from "./handlers";
import { readConfig, createSession } from "./access";
import { MemoryQuota } from "./limits";

const env = { NODE_ENV: "development", GROQ_API_KEY: "secret-only-on-server", AI_ACCESS_CODE: "invite-code-123456",
  AI_SESSION_SECRET: "s".repeat(48), AI_ALLOWED_ORIGINS: "http://localhost:3000", AI_DAILY_REQUEST_LIMIT: "2" };
const tracks = [{ id: "private-a", title: "One", artist: "User", bpm: 120, key: "8A", duration: 180 },
  { id: "private-b", title: "Two", artist: "User", bpm: 124, key: "9A", duration: 180 }];
const remotePlan = { setlist: [{ trackId: "t1", mixPoint: 24, transitionStyle: "smooth" }, { trackId: "t0", mixPoint: 16, transitionStyle: "cut" }], djComment: "Orden para la fiesta" };
const providerResponse = () => Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(remotePlan) } }] });
const fetcher = vi.fn<typeof fetch>();
let handlers: ReturnType<typeof createAIHandlers>;
function request(path: string, body: unknown = { tracks }, authenticated = true, origin = "http://localhost:3000") {
  const cookie = authenticated ? `eze_ai_session=${createSession(readConfig(env)).token}` : "";
  return new Request(`http://localhost:3000/api/ai/${path}`, { method: "POST", headers: { origin, cookie, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => {
  fetcher.mockReset(); fetcher.mockImplementation(async () => providerResponse());
  handlers = createAIHandlers({ env: () => env, quota: new MemoryQuota(), fetcher });
});
test("status does not call Groq or reveal credentials", async () => {
  const response = await handlers.status(new Request("http://localhost:3000/api/ai/status"));
  expect(await response.json()).toEqual({ configured: true, authorized: false, model: "openai/gpt-oss-20b" });
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(fetcher).not.toHaveBeenCalled();
});
test("login creates an HttpOnly session and rejects the wrong code", async () => {
  expect((await handlers.login(request("session", { accessCode: "wrong" }, false))).status).toBe(401);
  const response = await handlers.login(request("session", { accessCode: env.AI_ACCESS_CODE }, false));
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain("HttpOnly; SameSite=Strict");
  expect(response.headers.get("set-cookie")).not.toContain(env.AI_ACCESS_CODE);
  expect(fetcher).not.toHaveBeenCalled();
});
test("unauthenticated and cross-origin calls never reach the provider", async () => {
  expect((await handlers.plan(request("setlist", { tracks }, false))).status).toBe(401);
  expect((await handlers.plan(request("setlist", { tracks }, true, "https://evil.example"))).status).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
});
test("valid plans use only server authentication and are mapped back to local track ids", async () => {
  const response = await handlers.plan(request("setlist"));
  const data = await response.json();
  expect(data.source).toBe("groq");
  expect(data.setlist.map((item: { trackId: string }) => item.trackId)).toEqual(["private-b", "private-a"]);
  const [url, options] = fetcher.mock.calls[0];
  expect(String(url)).toBe("https://api.groq.com/openai/v1/chat/completions");
  expect(new Headers(options?.headers).get("authorization")).toBe("Bearer " + env.GROQ_API_KEY);
  expect(options?.body).not.toContain(env.GROQ_API_KEY);
  expect(options?.body).not.toContain("private-a");
  expect(JSON.parse(String(options?.body)).response_format.json_schema.strict).toBe(true);
  expect(JSON.parse(String(options?.body)).response_format.json_schema.schema.properties.setlist.items.properties.effect.enum).toEqual(["none", "filter_sweep", "echo_out"]);
  expect(JSON.parse(String(options?.body))).toMatchObject({ max_completion_tokens: 4096, reasoning_effort: "low", include_reasoning: false });
});
test("the minimal connection test requires an actual valid provider reply", async () => {
  fetcher.mockResolvedValue(Response.json({ choices: [{ finish_reason: "stop", message: { content: '{"ok":true}' } }] }));
  expect(await (await handlers.test(request("test", {}))).json()).toMatchObject({ connected: true, model: "openai/gpt-oss-20b" });
  fetcher.mockResolvedValue(Response.json({ choices: [{ finish_reason: "stop", message: { content: '{"ok":false}' } }] }));
  expect((await handlers.test(request("test", {}))).status).toBe(502);
});
test("daily quota prevents any further provider calls and supplies Retry-After", async () => {
  expect((await handlers.plan(request("setlist"))).status).toBe(200);
  expect((await handlers.plan(request("setlist"))).status).toBe(200);
  const response = await handlers.plan(request("setlist"));
  expect(response.status).toBe(429);
  expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
test("provider authentication errors are explicit and never leak provider text or keys", async () => {
  fetcher.mockResolvedValue(Response.json({ error: { message: env.GROQ_API_KEY } }, { status: 401 }));
  const response = await handlers.plan(request("setlist"));
  const body = await response.text();
  expect(body).toContain("PROVIDER_AUTH");
  expect(body).not.toContain(env.GROQ_API_KEY);
  expect(response.status).toBe(502);
});
test("unknown tracks and oversized request bodies are rejected", async () => {
  fetcher.mockResolvedValue(Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ ...remotePlan, setlist: [{ trackId: "invented", mixPoint: 24, transitionStyle: "smooth" }] }) } }] }));
  expect((await handlers.plan(request("setlist"))).status).toBe(502);
  const invalid = await handlers.plan(request("setlist", { tracks, padding: "x".repeat(66000) }));
  expect(invalid.status).toBe(413);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
test("invalid provider envelopes are classified as invalid responses", async () => {
  fetcher.mockResolvedValue(Response.json({ candidates: [{ content: { parts: "not-an-array" } }] }));
  expect(await (await handlers.plan(request("setlist"))).json()).toMatchObject({ error: { code: "INVALID_PROVIDER_RESPONSE" } });
});

test("a truncated Groq completion is rejected even if its content looks valid", async () => {
  fetcher.mockResolvedValue(Response.json({ choices: [{ finish_reason: "length", message: { content: JSON.stringify(remotePlan) } }] }));
  expect(await (await handlers.plan(request("setlist"))).json()).toMatchObject({ error: { code: "INVALID_PROVIDER_RESPONSE" } });
});
test("timeouts and missing production protection fail closed", async () => {
  fetcher.mockRejectedValue(new DOMException("request timed out", "TimeoutError"));
  expect(await (await handlers.plan(request("setlist"))).json()).toMatchObject({ error: { code: "PROVIDER_TIMEOUT" } });
  const production = createAIHandlers({ env: () => ({ ...env, NODE_ENV: "production" }), quota: new MemoryQuota(), fetcher });
  expect((await production.plan(request("setlist"))).status).toBe(503);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
test("login attempts are limited and logout clears the cookie", async () => {
  for (let attempt = 0; attempt < 30; attempt++) await handlers.login(request("session", { accessCode: "wrong" }, false));
  expect((await handlers.login(request("session", { accessCode: env.AI_ACCESS_CODE }, false))).status).toBe(429);
  expect((await handlers.logout(request("session"))).headers.get("set-cookie")).toContain("Max-Age=0");
});

 test('musical block context is bounded before any quota or provider request', async()=>{
  expect((await handlers.plan(request('setlist',{tracks,blockName:'x'.repeat(61)}))).status).toBe(422);
  expect(fetcher).not.toHaveBeenCalled();
  expect((await handlers.plan(request('setlist',{tracks,blockName:'Cumbia'}))).status).toBe(200);
  expect(String(fetcher.mock.calls[0][1]?.body)).toContain('Cumbia');
 });
