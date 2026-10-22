import { describe, test, expect, vi, beforeEach } from "vitest";
import { useDeckStore } from "../../stores/deckStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { loadTrackById, importAndLoadFile } from "./trackLoader";

const mocks = vi.hoisted(() => ({
  get: vi.fn(), update: vi.fn(), analyze: vi.fn(), cues: vi.fn(), loops: vi.fn(), decode: vi.fn(), load: vi.fn(), resume: vi.fn(), importTrack: vi.fn(),
}));
vi.mock("../db/dexie", () => ({ db: {
  tracks: { get: mocks.get, update: mocks.update },
  hotCues: { where: () => ({ equals: () => ({ toArray: mocks.cues }) }) },
  loops: { where: () => ({ equals: () => ({ toArray: mocks.loops }) }) },
} }));
vi.mock("./AudioEngine", () => ({ getAudioEngine: () => ({ resume: mocks.resume, ctx: { decodeAudioData: mocks.decode }, loadTrack: mocks.load }) }));
vi.mock("./waveformAnalysis", () => ({ analyzeWaveform: mocks.analyze }));
vi.mock("../../stores/libraryStore", () => ({ useLibraryStore: { getState: () => ({ importTrack: mocks.importTrack }) } }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
const track = (id: string) => ({ id, title: id, artist: "User", bpm: 120, key: "—", duration: 190, color: "#fff", audioData: new ArrayBuffer(8) });
const audio = { duration: 180 } as AudioBuffer;
describe("track loading safety", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useDeckStore.getState().resetDeck("A"); useDeckStore.getState().resetDeck("B");
    useSettingsStore.setState({ lockPlayingDeck: true, autoPlayOnLoad: false, autoGainEnabled: true });
    mocks.resume.mockResolvedValue(undefined);
    mocks.get.mockImplementation(async (id: string) => track(id));
    mocks.decode.mockResolvedValue(audio);
    mocks.cues.mockResolvedValue([]); mocks.loops.mockResolvedValue([]);
    mocks.analyze.mockResolvedValue({ peaks: [0.2], detailPeaks: [0.1, 0.2, 0.1] });
    mocks.update.mockResolvedValue(1);
  });
  test("upgrades a legacy waveform while preserving saved cue and loop positions", async () => {
    mocks.cues.mockResolvedValue([{ index: 2, time: 30, color: "#fff" }]);
    mocks.loops.mockResolvedValue([{ time: 40, length: 4 }]);
    await loadTrackById("legacy", "A");
    const deck = useDeckStore.getState().decks.A;
    expect(deck.track?.detailPeaks).toEqual([0.1, 0.2, 0.1]);
    expect(deck.hotCues[2]?.time).toBe(30);
    expect(deck.loopStart).toBe(40);
    expect(mocks.update).toHaveBeenCalledWith("legacy", { peaks: [0.2], detailPeaks: [0.1, 0.2, 0.1], waveformVersion: 1 });
  });
  test("reuses saved detailed peaks without analyzing again", async () => {
    mocks.get.mockResolvedValue({ ...track("ready"), peaks: [0.5], detailPeaks: [0.3, 0.5], waveformVersion: 1 });
    await loadTrackById("ready", "A");
    expect(useDeckStore.getState().decks.A.track?.detailPeaks).toEqual([0.3, 0.5]);
    expect(mocks.analyze).not.toHaveBeenCalled();
  });
  test("failed waveform analysis does not prevent valid audio from loading", async () => {
    mocks.analyze.mockRejectedValue(new Error("worker unavailable"));
    mocks.get.mockResolvedValue({ ...track("legacy"), peaks: [0.6] });
    expect((await loadTrackById("legacy", "A"))?.peaks).toEqual([0.6]);
    expect(mocks.load).toHaveBeenCalled();
  });
  test("full waveform cache storage does not prevent playback", async () => {
    mocks.update.mockRejectedValue(new Error("quota exceeded"));
    expect((await loadTrackById("legacy", "A"))?.detailPeaks).toEqual([0.1, 0.2, 0.1]);
    expect(mocks.load).toHaveBeenCalled();
  });
  test("canceling during waveform analysis never commits or changes the cache", async () => {
    const analysis = deferred<{ peaks: number[]; detailPeaks: number[] }>();
    mocks.analyze.mockReturnValue(analysis.promise);
    const controller = new AbortController();
    const loading = loadTrackById("legacy", "A", false, { signal: controller.signal });
    await vi.waitFor(() => expect(mocks.analyze).toHaveBeenCalled());
    controller.abort(); analysis.resolve({ peaks: [0.5], detailPeaks: [0.4, 0.5] });
    expect(await loading).toBeNull();
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  test("latest request wins when decoding completes out of order", async () => {
    const slow = deferred<AudioBuffer>();
    mocks.decode.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(audio);
    const first = loadTrackById("old", "A");
    await vi.waitFor(() => expect(mocks.decode).toHaveBeenCalledTimes(1));
    await loadTrackById("new", "A"); slow.resolve(audio);
    expect(await first).toBeNull();
    expect(useDeckStore.getState().decks.A.track?.id).toBe("new");
    expect(mocks.load).toHaveBeenCalledTimes(1);
  });
  test("abort during decoding never commits or auto-plays", async () => {
    const controller = new AbortController(), slow = deferred<AudioBuffer>();
    mocks.decode.mockReturnValue(slow.promise);
    const result = loadTrackById("canceled", "A", false, { signal: controller.signal, autoPlay: true });
    await vi.waitFor(() => expect(mocks.decode).toHaveBeenCalled());
    controller.abort(); slow.resolve(audio);
    expect(await result).toBeNull(); expect(mocks.load).not.toHaveBeenCalled();
    expect(useDeckStore.getState().decks.A.isPlaying).toBe(false);
  });
  test("rechecks deck lock after cue queries finish", async () => {
    const slow = deferred<[]>(); mocks.cues.mockReturnValue(slow.promise);
    const result = loadTrackById("new", "A");
    await vi.waitFor(() => expect(mocks.cues).toHaveBeenCalled());
    useDeckStore.getState().setPlaying("A", true); slow.resolve([]);
    expect(await result).toBeNull(); expect(mocks.load).not.toHaveBeenCalled();
  });
  test("invalid audio preserves the playing track even on explicit force-load", async () => {
    useDeckStore.getState().setTrack("A", track("playing"));
    useDeckStore.getState().setPlaying("A", true);
    mocks.decode.mockRejectedValue(new Error("invalid audio"));
    await expect(loadTrackById("bad", "A", true)).rejects.toThrow("invalid audio");
    expect(mocks.load).not.toHaveBeenCalled();
    expect(useDeckStore.getState().decks.A.track?.id).toBe("playing");
    expect(useDeckStore.getState().decks.A.isPlaying).toBe(true);
  });
  test("slow dropped-file import does not supersede a newer library choice", async () => {
    const slow = deferred<ReturnType<typeof track>>(); mocks.importTrack.mockReturnValue(slow.promise);
    const importing = importAndLoadFile({ name: "slow.mp3" } as File, "A");
    await loadTrackById("new", "A"); slow.resolve(track("old"));
    expect(await importing).toBeNull();
    expect(useDeckStore.getState().decks.A.track?.id).toBe("new");
  });
  test("loading another deck does not cancel this deck; decoded duration is authoritative", async () => {
    await Promise.all([loadTrackById("one", "A"), loadTrackById("two", "B")]);
    expect(useDeckStore.getState().decks.A.track?.id).toBe("one");
    expect(useDeckStore.getState().decks.B.track?.id).toBe("two");
    expect(useDeckStore.getState().decks.A.track?.duration).toBe(180);
  });
  test("Auto-DJ can suppress auto-play while preparing the next song", async () => {
    useSettingsStore.setState({ autoPlayOnLoad: true });
    await loadTrackById("next", "B", false, { autoPlay: false });
    expect(useDeckStore.getState().decks.B.isPlaying).toBe(false);
  });
});
