import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { voiceboxClient } from "./voiceboxClient";
import { useMixerStore } from "../../stores/mixerStore";

const audio = vi.hoisted(() => ({ ctx: null as unknown, masterSummer: {}, setMusicDucking: vi.fn() }));
vi.mock("../audio/AudioEngine", () => ({ getAudioEngine: () => audio }));

type Utterance = { onstart: () => void; onend: () => void; onerror: () => void };
function nativeSpeech(speak: (utterance: Utterance) => void) {
  vi.stubGlobal("SpeechSynthesisUtterance", class {});
  vi.stubGlobal("window", { speechSynthesis: { cancel: vi.fn(), getVoices: () => [], speak } });
}

beforeEach(() => {
  audio.ctx = null;
  audio.setMusicDucking.mockReset();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  vi.stubGlobal("window", {});
  useMixerStore.getState().setMasterVolume(0.8);
});
afterEach(() => vi.unstubAllGlobals());

test("does not lower music while discovering an unavailable voice service", async () => {
  let release!: (value: Response) => void;
  vi.mocked(fetch).mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
  const speaking = voiceboxClient.speak("Hola fiesta");
  expect(audio.setMusicDucking).not.toHaveBeenCalled();
  release(new Response(null, { status: 503 }));
  await speaking;
  expect(useMixerStore.getState().masterVolume).toBe(0.8);
});

test("native speech ducks only once the voice starts and preserves manual volume", async () => {
  nativeSpeech(utterance => {
    expect(audio.setMusicDucking).not.toHaveBeenCalled();
    utterance.onstart();
    expect(audio.setMusicDucking).toHaveBeenLastCalledWith(0.45);
    useMixerStore.getState().setMasterVolume(0.25);
    utterance.onend();
  });
  expect(await voiceboxClient.speak("Hola fiesta")).toBe(true);
  expect(audio.setMusicDucking).toHaveBeenLastCalledWith(1);
  expect(useMixerStore.getState().masterVolume).toBe(0.25);
});

test("unavailable speech returns false without ducking or staying busy", async () => {
  expect(await voiceboxClient.speak("Hola fiesta")).toBe(false);
  expect(audio.setMusicDucking).not.toHaveBeenCalled();
  expect(voiceboxClient.getIsSpeaking()).toBe(false);
});

test("failed native speech restores music and reports failure", async () => {
  nativeSpeech(utterance => { utterance.onstart(); utterance.onerror(); });
  expect(await voiceboxClient.speak("Hola fiesta")).toBe(false);
  expect(audio.setMusicDucking).toHaveBeenLastCalledWith(1);
  expect(voiceboxClient.getIsSpeaking()).toBe(false);
});

test("local audio is decoded before ducking and restores music after playback", async () => {
  const source = { buffer: null, connect: vi.fn(), disconnect: vi.fn(), onended: null as (() => void) | null,
    start: vi.fn(() => { expect(audio.setMusicDucking).toHaveBeenLastCalledWith(0.45); source.onended?.(); }) };
  const gain = { gain: { setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
  audio.ctx = { state: "running", currentTime: 0,
    decodeAudioData: vi.fn(async () => { expect(audio.setMusicDucking).not.toHaveBeenCalled(); return {}; }),
    createBufferSource: () => source, createGain: () => gain };
  vi.mocked(fetch).mockResolvedValue(new Response(new Uint8Array([1]), { headers: { "content-type": "audio/wav" } }));
  expect(await voiceboxClient.speak("Hola fiesta")).toBe(true);
  expect(audio.setMusicDucking).toHaveBeenLastCalledWith(1);
  expect(source.disconnect).toHaveBeenCalled();
  expect(gain.disconnect).toHaveBeenCalled();
});

test("overlapping announcements cannot restore music during another voice", async () => {
  let finish!: () => void;
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  nativeSpeech(utterance => { utterance.onstart(); finish = utterance.onend; started(); });
  const first = voiceboxClient.speak("Primer anuncio");
  await ready;
  const second = await voiceboxClient.speak("Segundo anuncio");
  finish();
  expect(await first).toBe(true);
  expect(second).toBe(false);
  expect(audio.setMusicDucking.mock.calls.map(([value]) => value)).toEqual([0.45, 1]);
});
