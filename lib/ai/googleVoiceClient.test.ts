import { afterEach, expect, test, vi } from "vitest";
import { GoogleVoiceClient } from "./googleVoiceClient";
const audio = vi.hoisted(() => ({ init: vi.fn(), ctx: null as unknown, masterSummer: {}, setMusicDucking: vi.fn() }));
vi.mock("../audio/AudioEngine", () => ({ getAudioEngine: () => audio }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
function setup() {
  const source = { buffer: null, onended: null as (() => void) | null, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(() => source.onended?.()) };
  const gain = { gain: { setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
  audio.ctx = { state: "running", currentTime: 0, decodeAudioData: vi.fn(async () => ({})), createBufferSource: () => source, createGain: () => gain };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(44), { headers: { "content-type": "audio/wav" } })));
  return source;
}
test("Google voice does not duck music while generating, and stop restores playback levels", async () => {
  const source = setup(), client = new GoogleVoiceClient();
  const playing = vi.fn(() => { expect(audio.setMusicDucking).toHaveBeenLastCalledWith(0.45); client.stop(); });
  const result = await client.speak({ text: "Hola", voice: "Charon", style: "assistant" }, phase => { if (phase === "generating") expect(audio.setMusicDucking).not.toHaveBeenCalled(); if (phase === "playing") playing(); });
  expect(result).toBe(false); expect(playing).toHaveBeenCalledOnce();
  expect(source.disconnect).toHaveBeenCalled(); expect(audio.setMusicDucking).toHaveBeenLastCalledWith(1);
});
test("replaying a recent phrase uses cached audio rather than another API call", async () => {
  const source = setup(), client = new GoogleVoiceClient(); source.start.mockImplementation(() => source.onended?.());
  const input = { text: "Otra noche", voice: "Charon", style: "radio" } as const;
  expect(await client.speak(input)).toBe(true); expect(await client.speak(input)).toBe(true);
  expect(fetch).toHaveBeenCalledOnce();
  expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/ai/speech");
});
test("Google errors remain visible without falling back to browser or local voice", async () => {
  setup(); vi.mocked(fetch).mockResolvedValue(Response.json({ error: { code: "PROVIDER_QUOTA" } }, { status: 503 }));
  const client = new GoogleVoiceClient();
  await expect(client.speak({ text: "Hola", voice: "Charon", style: "assistant" })).rejects.toMatchObject({ code: "PROVIDER_QUOTA" });
  expect(audio.setMusicDucking).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledOnce();
});
test("cancelling generation does not play late audio or leave the client busy", async () => {
  const source = setup(), client = new GoogleVoiceClient();
  let release!: (response: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const pending = client.speak({ text: "Cancelar", voice: "Charon", style: "assistant" });
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  client.stop(); release(new Response(new Uint8Array(44), { headers: { "content-type": "audio/wav" } }));
  expect(await pending).toBe(false); expect(source.start).not.toHaveBeenCalled();
  expect(audio.setMusicDucking).not.toHaveBeenCalled();
  source.start.mockImplementation(() => source.onended?.());
  expect(await client.speak({ text: "Nueva frase", voice: "Charon", style: "assistant" })).toBe(true);
});
