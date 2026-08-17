import { describe, test, expect } from "vitest";
import { generateMockWaveformData } from "./WaveformHelper";

describe("WaveformHelper unit tests", () => {
  test("should generate deterministic peak arrays and beat grid arrays", () => {
    const trackId = "t1";
    const duration = 200;
    const bpm = 120;
    
    const result1 = generateMockWaveformData(trackId, duration, bpm);
    const result2 = generateMockWaveformData(trackId, duration, bpm);
    
    // Test determinism
    expect(result1).toEqual(result2);
    
    // Test peaks length (must be 800)
    expect(result1.peaks.length).toBe(800);
    
    // Check peak values clamp range [0.05, 1.0]
    result1.peaks.forEach((peak) => {
      expect(peak).toBeGreaterThanOrEqual(0.05);
      expect(peak).toBeLessThanOrEqual(1.0);
    });
    
    // Test beat grid interval (60 / 120 = 0.5s)
    expect(result1.beatGrid[0]).toBe(0);
    expect(result1.beatGrid[1]).toBe(0.5);
    expect(result1.beatGrid[2]).toBe(1.0);
    
    // Test beat grid size matches duration / beatInterval
    const expectedBeats = Math.ceil(duration / 0.5);
    expect(result1.beatGrid.length).toBe(expectedBeats);
  });
});
