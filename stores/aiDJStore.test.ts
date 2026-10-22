import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { useDeckStore } from "./deckStore";
import { useMixerStore } from "./mixerStore";
import { useAIDJStore } from "./aiDJStore";
import { useAIConnectionStore } from "./aiConnectionStore";
const mocks = vi.hoisted(() => ({ load: vi.fn(), generate: vi.fn(), fallback: vi.fn() }));
const tracks = [{ id: "one", title: "One", artist: "User", bpm: 120, key: "—", duration: 180, color: "#fff" }, { id: "two", title: "Two", artist: "User", bpm: 124, key: "—", duration: 180, color: "#fff" }];
vi.mock("./libraryStore", () => ({ useLibraryStore: { getState: () => ({ tracks }) } }));
vi.mock("../lib/audio/trackLoader", () => ({ loadTrackById: mocks.load }));
vi.mock("../lib/ai/geminiClient", () => ({ generateSetlist: mocks.generate, generateFallbackSetlist: mocks.fallback }));
vi.mock("../lib/audio/AudioEngine", () => ({ getAudioEngine: () => ({ getPlaybackTime: () => 170 }) }));
vi.mock("../lib/audio/SamplerEngine", () => ({ samplerEngine: { trigger: vi.fn() } }));
vi.mock("./vjStore", () => ({ useVJStore: { getState: () => ({ rotateToNextVideo: vi.fn(), triggerDropFlash: vi.fn() }) } }));
const response = { source: "local" as const, reason: "LOCAL_SELECTED" as const, setlist: [{ trackId: "one", mixPoint: 24, transitionStyle: "smooth" as const }, { trackId: "two", mixPoint: 24, transitionStyle: "smooth" as const }], djComment: "Local session" };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
describe("Auto-DJ session safety", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.resetAllMocks();
    useAIDJStore.getState().deactivate();
    useAIDJStore.setState({ autoFXDrops: false });
    useAIConnectionStore.setState({ useRemoteAI: false });
    useDeckStore.getState().resetDeck("A"); useDeckStore.getState().resetDeck("B");
    useMixerStore.getState().resetMixer();
    mocks.fallback.mockReturnValue(response); mocks.generate.mockResolvedValue(response);
    mocks.load.mockImplementation(async (id: string, deck: "A" | "B") => {
      const track = tracks.find(t => t.id === id)!;
      useDeckStore.getState().setTrack(deck, track);
      return track;
    });
  });
  afterEach(() => { useAIDJStore.getState().deactivate(); vi.useRealTimers(); });
  test.each(["A", "B"] as const)("activation preserves the currently playing song on deck %s", async deck => {
    useDeckStore.getState().setTrack(deck, tracks[1]);
    useDeckStore.getState().setPlaying(deck, true);
    useMixerStore.getState().setCrossfader(deck === "A" ? 0 : 1);
    useDeckStore.getState().setCurrentTime(deck, 65);
    await useAIDJStore.getState().activate();
    expect(mocks.load).not.toHaveBeenCalled();
    expect(useDeckStore.getState().decks[deck].currentTime).toBe(65);
    expect(useAIDJStore.getState().setlist[0].trackId).toBe("two");
  });
  test("follows the preserved song when only B is playing and the fader is centered", async () => {
    useDeckStore.getState().setTrack("B", tracks[0]);
    useDeckStore.getState().setPlaying("B", true);
    await useAIDJStore.getState().activate();
    await vi.advanceTimersByTimeAsync(500);
    expect(mocks.load).toHaveBeenCalledWith("two", "A", false, expect.any(Object));
  });
  test("completed transitions release only the fully inaudible deck", async () => {
    await useAIDJStore.getState().activate();
    useAIDJStore.getState().skipToNext();
    await Promise.resolve(); await Promise.resolve();
    expect(useMixerStore.getState().isAutoCrossfading).toBe(true);
    useMixerStore.getState().setCrossfader(1);
    useMixerStore.getState().stopAutoCrossfade();
    await vi.advanceTimersByTimeAsync(500);
    expect(useDeckStore.getState().decks.A.isPlaying).toBe(false);
    expect(useDeckStore.getState().decks.B.isPlaying).toBe(true);
  });
  test("manual cancellation halfway through a blend preserves both playing decks", async () => {
    await useAIDJStore.getState().activate();
    useAIDJStore.getState().skipToNext();
    await Promise.resolve(); await Promise.resolve();
    useMixerStore.getState().setCrossfader(0.4);
    useMixerStore.getState().stopAutoCrossfade();
    await vi.advanceTimersByTimeAsync(500);
    expect(useDeckStore.getState().decks.A.isPlaying).toBe(true);
    expect(useDeckStore.getState().decks.B.isPlaying).toBe(true);
  });
  test("deactivation during remote analysis cannot later start playback", async () => {
    const slow = deferred<typeof response>(); mocks.generate.mockReturnValue(slow.promise);
    useAIConnectionStore.setState({ useRemoteAI: true });
    const activating = useAIDJStore.getState().activate();
    useAIDJStore.getState().deactivate(); slow.resolve(response); await activating;
    expect(mocks.load).not.toHaveBeenCalled();
    expect(useAIDJStore.getState().isActive).toBe(false);
    expect(useAIDJStore.getState().status).toBe("idle");
  });
  test("deactivation during initial load aborts it and never starts playback", async () => {
    const slow = deferred<typeof tracks[number]>(); mocks.load.mockReturnValue(slow.promise);
    const activating = useAIDJStore.getState().activate();
    await Promise.resolve();
    const options = mocks.load.mock.calls[0][3];
    useAIDJStore.getState().deactivate();
    expect(options.signal.aborted).toBe(true);
    slow.resolve(tracks[0]); await activating;
    expect(useDeckStore.getState().decks.A.isPlaying).toBe(false);
  });
  test("skip and monitor cannot start duplicate transitions during a slow load", async () => {
    await useAIDJStore.getState().activate(); mocks.load.mockClear();
    const slow = deferred<typeof tracks[number]>(); mocks.load.mockReturnValue(slow.promise);
    useAIDJStore.getState().skipToNext();
    useAIDJStore.getState().skipToNext();
    await vi.advanceTimersByTimeAsync(2000);
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(useAIDJStore.getState().status).toBe("transitioning");
    useAIDJStore.getState().deactivate(); slow.resolve(tracks[1]); await Promise.resolve();
    expect(useMixerStore.getState().isAutoCrossfading).toBe(false);
    expect(useDeckStore.getState().decks.B.isPlaying).toBe(false);
    expect(useAIDJStore.getState().status).toBe("idle");
  });
  test("transition failure keeps current music and does not repeatedly retry", async () => {
    await useAIDJStore.getState().activate(); mocks.load.mockClear();
    mocks.load.mockRejectedValue(new Error("bad file"));
    useAIDJStore.getState().skipToNext(); await Promise.resolve(); await Promise.resolve();
    await vi.advanceTimersByTimeAsync(2000);
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(useDeckStore.getState().decks.A.isPlaying).toBe(true);
    expect(useAIDJStore.getState().status).toBe("error");
  });
});
