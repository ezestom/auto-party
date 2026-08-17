import { describe, test, expect, vi, beforeEach } from "vitest";
import { AudioEngine } from "./AudioEngine";

// Define mocks for Web Audio API elements
class MockAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockParam {
  value = 1.0;
  setValueAtTime = vi.fn((val) => {
    this.value = val;
  });
}

class MockGainNode extends MockAudioNode {
  gain = new MockParam();
}

class MockBiquadFilterNode extends MockAudioNode {
  frequency = new MockParam();
  Q = new MockParam();
  gain = new MockParam();
  type = "lowpass";
}

class MockDynamicsCompressorNode extends MockAudioNode {
  threshold = new MockParam();
  ratio = new MockParam();
  knee = new MockParam();
}

class MockAnalyserNode extends MockAudioNode {
  fftSize = 128;
  getFloatTimeDomainData = vi.fn((array: Float32Array) => {
    array.fill(0);
  });
}

class MockOscillatorNode extends MockAudioNode {
  type = "sine";
  frequency = new MockParam();
  start = vi.fn();
  stop = vi.fn();
}

class MockBufferSourceNode extends MockAudioNode {
  buffer: any = null;
  playbackRate = new MockParam();
  start = vi.fn();
  stop = vi.fn();
}

class MockAudioContext {
  state = "suspended";
  currentTime = 0;
  destination = new MockAudioNode();
  audioWorklet = {
    addModule: vi.fn().mockResolvedValue(undefined),
  };
  createGain = vi.fn(() => new MockGainNode());
  createBiquadFilter = vi.fn(() => new MockBiquadFilterNode());
  createDynamicsCompressor = vi.fn(() => new MockDynamicsCompressorNode());
  createAnalyser = vi.fn(() => new MockAnalyserNode());
  createOscillator = vi.fn(() => new MockOscillatorNode());
  createBufferSource = vi.fn(() => new MockBufferSourceNode());
  resume = vi.fn().mockImplementation(async () => {
    this.state = "running";
  });
}

describe("AudioEngine unit tests", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      AudioContext: MockAudioContext,
    });
  });

  test("should initialize context and build the Web Audio node graph", async () => {
    const engine = new AudioEngine();
    await engine.init();

    expect(engine.initialized).toBe(true);
    expect(engine.ctx).toBeInstanceOf(MockAudioContext);
    
    // Validate master channel routing setup
    expect(engine.masterSummer).toBeDefined();
    expect(engine.masterLimiter).toBeDefined();
    expect(engine.masterVolumeNode).toBeDefined();
    
    // Validate symmetrical deck routing chains
    expect(engine.deckChains.A).toBeDefined();
    expect(engine.deckChains.B).toBeDefined();
    expect(engine.eqLows.A).toBeDefined();
    expect(engine.eqMids.A).toBeDefined();
    expect(engine.eqHis.A).toBeDefined();
    expect(engine.filters.A).toBeDefined();
    expect(engine.channelGains.A).toBeDefined();
    expect(engine.channelVolumes.A).toBeDefined();
    expect(engine.crossfaderGains.A).toBeDefined();
    expect(engine.analysers.A).toBeDefined();
    expect(engine.analysers.B).toBeDefined();
  });

  test("should handle AudioContext resume callbacks on user gesture", async () => {
    const engine = new AudioEngine();
    await engine.init();
    
    expect(engine.ctx?.state).toBe("suspended");
    await engine.resume();
    expect(engine.ctx?.state).toBe("running");
  });

  test("should play simulated oscillator node fallback when no track buffer is loaded", async () => {
    const engine = new AudioEngine();
    await engine.init();
    
    engine.play("A");
    expect((engine as any).simulatedNodes.A).toBeDefined();
    expect((engine as any).simulatedNodes.A.osc).toBeDefined();
    
    engine.stop("A");
    expect((engine as any).simulatedNodes.A).toBeNull();
  });

  test("should update VU levels and clip flags in the store on frame updates", async () => {
    const { useMixerStore } = await import("../../stores/mixerStore");
    const engine = new AudioEngine();
    await engine.init();
    
    const mockAnalyser = engine.analysers.A as any;
    mockAnalyser.getFloatTimeDomainData.mockImplementation((array: Float32Array) => {
      array.fill(0);
      array[0] = 1.0; 
    });
    
    (engine as any).runVUMeterLoop();
    
    const store = useMixerStore.getState();
    expect(store.channels.A.vuL).toBeCloseTo(1.0, 2);
    expect(store.channels.A.clipL).toBe(true);
    
    mockAnalyser.getFloatTimeDomainData.mockImplementation((array: Float32Array) => {
      array.fill(0);
      array[0] = 0.5; 
    });
    
    (engine as any).runVUMeterLoop();
    
    const store2 = useMixerStore.getState();
    expect(store2.channels.A.vuL).toBeGreaterThan(0.7); 
    expect(store2.channels.A.clipL).toBe(true);
  });

  test("should update playback rates of simulated oscillator and real buffers", async () => {
    const engine = new AudioEngine();
    await engine.init();
    
    engine.play("A");
    const simNode = (engine as any).simulatedNodes.A;
    expect(simNode).toBeDefined();
    
    engine.setPlaybackRate("A", 1.5);
    expect(simNode.osc.frequency.setValueAtTime).toHaveBeenCalledWith(110 * 1.5, expect.any(Number));
    expect(simNode.modulation.frequency.setValueAtTime).toHaveBeenCalledWith(2 * 1.5, expect.any(Number));
    
    engine.stop("A");
  });

  test("should maintain constant power across crossfader positions", async () => {
    const { useMixerStore } = await import("../../stores/mixerStore");
    const engine = new AudioEngine();
    await engine.init();

    const crossfaderPositions = [0.0, 0.25, 0.5, 0.75, 1.0];

    for (const pos of crossfaderPositions) {
      useMixerStore.setState({ crossfader: pos });
      (engine as any).updateMixerParams(useMixerStore.getState());

      const gainA = engine.crossfaderGains.A?.gain.value ?? 0;
      const gainB = engine.crossfaderGains.B?.gain.value ?? 0;

      const totalPower = gainA * gainA + gainB * gainB;
      expect(totalPower).toBeCloseTo(1.0, 4);
    }
  });

  test("should start playback from deck currentTime when resuming loaded track", async () => {
    const { useDeckStore } = await import("../../stores/deckStore");
    const engine = new AudioEngine();
    await engine.init();

    const mockBuffer = {} as AudioBuffer;
    engine.loadTrack("A", mockBuffer);

    useDeckStore.getState().setCurrentTime("A", 45.5);
    engine.play("A");

    const source = engine.deckSources.A as any;
    expect(source).toBeDefined();
    expect(source.start).toHaveBeenCalledWith(0, 45.5);
  });
});
