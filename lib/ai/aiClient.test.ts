import { afterEach, expect, test, vi } from "vitest";
import { generateSetlist, getAIStatus, testAIConnection } from "./aiClient";
const tracks = [{ id: "a", title: "One", artist: "User", bpm: 120, key: "—", duration: 180 },
  { id: "b", title: "Two", artist: "User", bpm: 124, key: "—", duration: 200 }];
afterEach(() => vi.unstubAllGlobals());
test("planning only contacts our server and explicitly reports Groq success", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ source: "groq", model: "test-model", djComment: "Fiesta", setlist: [
    { trackId: "b", mixPoint: 24, transitionStyle: "smooth" }, { trackId: "a", mixPoint: 16, transitionStyle: "cut" },
  ] }));
  vi.stubGlobal("fetch", fetcher);
  const result = await generateSetlist(tracks);
  expect(result.source).toBe("groq");
  expect(result.setlist[0].trackId).toBe("b");
  expect(fetcher.mock.calls[0][0]).toBe("/api/ai/setlist");
  const options = fetcher.mock.calls[0][1];
  expect(options.credentials).toBe("same-origin");
  expect(options.body).toBe(JSON.stringify({ tracks }));
});
test("authentication failures use local mixing with a visible reason", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { code: "PROVIDER_AUTH" } }, { status: 502 })));
  expect(await generateSetlist(tracks)).toMatchObject({ source: "local", reason: "PROVIDER_AUTH" });
});
test("malformed remote success cannot be advertised as an AI plan", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ source: "groq", setlist: [] })));
  expect(await generateSetlist(tracks)).toMatchObject({ source: "local", reason: "INVALID_PROVIDER_RESPONSE" });
});
test("session cancellation never returns a plan that could restart playback", async () => {
  const controller = new AbortController();
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => { controller.abort(); throw new DOMException("cancelled", "AbortError"); }));
  await expect(generateSetlist(tracks, controller.signal)).rejects.toThrow();
});
test("configured does not mean connected; status and provider test are separate calls", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ configured: true, authorized: false, model: "test-model" }))
    .mockResolvedValueOnce(Response.json({ connected: true, model: "test-model", checkedAt: "2026-10-22T12:00:00Z" }));
  vi.stubGlobal("fetch", fetcher);
  expect(await getAIStatus()).toMatchObject({ configured: true, authorized: false });
  expect(await testAIConnection()).toMatchObject({ connected: true });
  expect(fetcher.mock.calls.map(call => call[0])).toEqual(["/api/ai/status", "/api/ai/test"]);
});
