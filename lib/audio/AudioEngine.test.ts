import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { AudioEngine } from "./AudioEngine";
import { useDeckStore } from "../../stores/deckStore";
import { useMixerStore } from "../../stores/mixerStore";
import { useSettingsStore } from "../../stores/settingsStore";

class Param {
  value = 1;
  setValueAtTime = vi.fn((v: number) => { this.value = v; });
  setTargetAtTime = vi.fn((v: number) => { this.value = v; });
  cancelScheduledValues = vi.fn();
  setValueCurveAtTime = vi.fn();
}
class Node {
  connect = vi.fn(); disconnect = vi.fn(); gain = new Param();
  frequency = new Param(); Q = new Param(); threshold = new Param(); ratio = new Param(); knee = new Param();
  fftSize = 128; getFloatTimeDomainData = vi.fn((a: Float32Array) => a.fill(0));
}
class Source extends Node {
  playbackRate = new Param(); buffer: AudioBuffer | null = null;
  loop = false; loopStart = 0; loopEnd = 0; onended: (() => void) | null = null;
  start = vi.fn(); stop = vi.fn();
}
class Context {
  state = "suspended"; currentTime = 0; sampleRate = 48000; destination = new Node();
  audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
  createGain = vi.fn(() => new Node()); createBiquadFilter = vi.fn(() => new Node());
  createDynamicsCompressor = vi.fn(() => new Node()); createAnalyser = vi.fn(() => new Node());
  createBufferSource = vi.fn(() => new Source()); createOscillator = vi.fn();
  createMediaStreamDestination = vi.fn(() => Object.assign(new Node(), { stream: {} }));
  resume = vi.fn(async () => { this.state = "running"; }); close = vi.fn(async () => {});
}
class Output {
  static fail = false;
  srcObject: unknown = null; pause = vi.fn();
  setSinkId = vi.fn(async () => { if (Output.fail) throw new Error("device unavailable"); });
  play = vi.fn(async () => {});
}
let engine: AudioEngine;
const track = { id: "audio", title: "Track", artist: "User", bpm: 120, key: "—", duration: 180, color: "#ff6b00" };
function load() {
  useDeckStore.getState().setTrack("A", track);
  engine.loadTrack("A", { duration: 180 } as AudioBuffer);
}
function time(value: number) { (engine.ctx as unknown as Context).currentTime = value; }
describe("audio transport and routing", () => {
  beforeEach(async () => {
    vi.stubGlobal("window", { AudioContext: Context, requestAnimationFrame: vi.fn(() => 1), cancelAnimationFrame: vi.fn() });
    vi.stubGlobal("AudioWorkletNode", Node);
    vi.stubGlobal("Audio", Output); Output.fail = false;
    useDeckStore.getState().resetDeck("A"); useDeckStore.getState().resetDeck("B");
    useMixerStore.getState().resetMixer();
    useSettingsStore.setState({ crossfaderCurve: "LIN" });
    engine = new AudioEngine(); await engine.init();
  });
  afterEach(() => { engine.dispose(); vi.unstubAllGlobals(); });
  test("initializes one context for concurrent gestures", async () => {
    const other = new AudioEngine();
    await Promise.all([other.resume(), other.resume()]);
    expect(other.ctx?.audioWorklet.addModule).toHaveBeenCalledTimes(3);
    other.dispose();
  });
  test("auto crossfade is scheduled on audio time and completes without animation frames", () => {
    useMixerStore.getState().setSmartEQ(false);
    useMixerStore.getState().setEQHi("A", 0.4);
    useMixerStore.getState().setCrossfader(0);
    useMixerStore.getState().setAutoDuration(4);
    useMixerStore.getState().triggerAutoCrossfade("B");
    const param = engine.crossfaderGains.B!.gain as unknown as Param;
    expect(param.setValueCurveAtTime).toHaveBeenCalled();
    const [curve, start, duration] = param.setValueCurveAtTime.mock.calls.at(-1)! as unknown as [Float32Array,number,number];
    expect(curve[0]).toBe(0); expect(curve.at(-1)).toBe(1); expect(start).toBe(0); expect(duration).toBe(4);
    time(5); engine.syncPlayheads();
    expect(useMixerStore.getState().crossfader).toBe(1);
    expect(useMixerStore.getState().isAutoCrossfading).toBe(false);
    expect(useMixerStore.getState().channels.A.eqHi).toBe(0.4);
  });
  test("manual EQ cancels scheduled automation and keeps the requested value", () => {
    useMixerStore.getState().setCrossfader(0);
    useMixerStore.getState().triggerAutoCrossfade("B");
    useMixerStore.getState().setEQHi("A", 0.25);
    expect(useMixerStore.getState().isAutoCrossfading).toBe(false);
    expect(useMixerStore.getState().channels.A.eqHi).toBe(0.25);
    expect((engine.crossfaderGains.A!.gain as unknown as Param).cancelScheduledValues).toHaveBeenCalled();
  });
  test("visual energy is measured from master audio and music ducking leaves voice and master untouched", async () => {
    expect(engine.getVisualEnergy()).toBe(0);
    await engine.resume();
    const analyser = engine.masterAnalyser as unknown as Node;
    expect(engine.masterVolumeNode?.connect).toHaveBeenCalledWith(engine.masterAnalyser);
    expect(engine.masterAnalyser?.connect).not.toHaveBeenCalled();
    expect(engine.musicBus?.connect).toHaveBeenCalledWith(engine.masterSummer);
    analyser.getFloatTimeDomainData.mockImplementation((data:Float32Array) => data.fill(0.25));
    expect(engine.getVisualEnergy()).toBeCloseTo(0.25);
    const master = engine.masterVolumeNode!.gain.value;
    engine.setMusicDucking(0.45);
    expect(engine.musicBus!.gain.value).toBe(0.45);
    expect(engine.masterVolumeNode!.gain.value).toBe(master);
    engine.setMusicDucking(1);
    expect(engine.musicBus!.gain.value).toBe(1);
    analyser.getFloatTimeDomainData.mockImplementation((data:Float32Array) => data.fill(0));
    expect(engine.getVisualEnergy()).toBe(0);
    engine.dispose();
    expect(engine.getVisualEnergy()).toBe(0);
  });
  test("empty decks stay silent", () => {
    useDeckStore.getState().setPlaying("A", true);
    expect(engine.deckSources.A).toBeNull();
    expect(useDeckStore.getState().decks.A.isPlaying).toBe(false);
    expect((engine.ctx as unknown as Context).createOscillator).not.toHaveBeenCalled();
  });
  test("advances on audio time without frames, pauses and resumes continuously", () => {
    load(); useDeckStore.getState().setPlaying("A", true);
    time(12); expect(engine.getPlaybackTime("A")).toBe(12);
    const first = engine.deckSources.A;
    engine.syncPlayheads(); expect(engine.deckSources.A).toBe(first);
    useDeckStore.getState().setPlaying("A", false);
    time(30); expect(engine.getPlaybackTime("A")).toBe(12);
    useDeckStore.getState().setPlaying("A", true);
    expect(engine.deckSources.A?.start).toHaveBeenCalledWith(0, 12);
    time(35); expect(engine.getPlaybackTime("A")).toBe(17);
  });
  test("changing tempo preserves position; seek while paused resumes at requested time", () => {
    load(); useDeckStore.getState().setPlaying("A", true);
    time(10); useDeckStore.getState().setTempoOffset("A", 0.1);
    expect(engine.getPlaybackTime("A")).toBe(10);
    time(20); expect(engine.getPlaybackTime("A")).toBe(21);
    useDeckStore.getState().setPlaying("A", false);
    useDeckStore.getState().setCurrentTime("A", 45.5);
    engine.syncPlayheads(); expect(useDeckStore.getState().decks.A.currentTime).toBe(45.5);
    useDeckStore.getState().setPlaying("A", true);
    expect(engine.deckSources.A?.start).toHaveBeenCalledWith(0, 45.5);
  });
  test("loops on buffer time and exits without a position jump", () => {
    load(); useDeckStore.getState().setPlaying("A", true);
    useDeckStore.setState(s => ({ decks: { ...s.decks, A: { ...s.decks.A, loopActive: true, loopStart: 2, loopLength: 4 } } }));
    time(7); expect(engine.getPlaybackTime("A")).toBe(3);
    useDeckStore.setState(s => ({ decks: { ...s.decks, A: { ...s.decks.A, loopActive: false } } }));
    expect(engine.getPlaybackTime("A")).toBe(3);
    time(8); expect(engine.getPlaybackTime("A")).toBe(4);
  });
  test("ignores obsolete onended and clears PLAY on natural end", () => {
    load(); useDeckStore.getState().setPlaying("A", true);
    const oldEnd = engine.deckSources.A?.onended;
    useDeckStore.getState().setCurrentTime("A", 30);
    oldEnd?.call(engine.deckSources.A!, {} as Event);
    expect(useDeckStore.getState().decks.A.isPlaying).toBe(true);
    engine.deckSources.A?.onended?.call(engine.deckSources.A, {} as Event);
    expect(useDeckStore.getState().decks.A.isPlaying).toBe(false);
    expect(engine.getPlaybackTime("A")).toBe(180);
  });
  test("cue taps before channel fader and never connects directly to public destination", () => {
    expect(engine.channelGains.A?.connect).toHaveBeenCalledWith(engine.cueActiveGains.A);
    expect(engine.headphoneOutputNode?.connect).not.toHaveBeenCalled();
    expect(engine.boothVolumeNode?.connect).not.toHaveBeenCalled();
    expect(engine.masterVolumeNode?.connect).toHaveBeenCalledWith(engine.ctx?.destination);
  });
  test("applies all three crossfader curves immediately", () => {
    useMixerStore.getState().setCrossfader(0.5);
    expect(engine.crossfaderGains.A?.gain.value).toBe(0.5);
    useSettingsStore.setState({ crossfaderCurve: "CUT" });
    expect(engine.crossfaderGains.A?.gain.value).toBe(1);
    expect(engine.crossfaderGains.B?.gain.value).toBe(1);
    useSettingsStore.setState({ crossfaderCurve: "CRV" });
    for (const x of [0, 0.25, 0.5, 0.75, 1]) {
      useMixerStore.getState().setCrossfader(x);
      const a = engine.crossfaderGains.A!.gain.value, b = engine.crossfaderGains.B!.gain.value;
      expect(a * a + b * b).toBeCloseTo(1, 6);
    }
  });
  test("failed monitor selection preserves the working route", async () => {
    await engine.setMonitorOutput("headphones", "device-1");
    Output.fail = true;
    await expect(engine.setMonitorOutput("headphones", "device-2")).rejects.toThrow("device unavailable");
    expect(engine.getMonitorOutputId("headphones")).toBe("device-1");
    await engine.setMonitorOutput("headphones", "");
    expect(engine.getMonitorOutputId("headphones")).toBe("");
  });
  test("records an actual stereo PCM WAV with context sample rate", async () => {
    const recorder = Object.assign(new Node(), { onaudioprocess: null as unknown });
    Object.assign(engine.ctx!, { createScriptProcessor: () => recorder });
    expect(engine.startRecording()).toBe(true);
    engine.recordedChunksL = [new Float32Array([0.5, -1])];
    engine.recordedChunksR = [new Float32Array([-0.5, 1])];
    const blob = engine.stopRecording()!;
    expect(blob.type).toBe("audio/wav");
    const data = new DataView(await blob.arrayBuffer());
    expect(data.getUint16(22, true)).toBe(2);
    expect(data.getUint32(24, true)).toBe(48000);
    expect(data.getInt16(44, true)).toBeGreaterThan(16000);
    expect(data.getInt16(46, true)).toBeLessThan(-16000);
    expect(data.getUint32(40, true)).toBe(8);
  });
});
