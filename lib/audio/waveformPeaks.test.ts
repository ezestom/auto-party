import { expect, test } from "vitest";
import { createWaveformPeaks, peakInRange } from "./waveformPeaks";

test("keeps a lightweight overview and 100 detail points per second", () => {
  const data = createWaveformPeaks([new Float32Array(8000 * 30)], 8000);
  expect(data.peaks).toHaveLength(800);
  expect(data.detailPeaks).toHaveLength(3000);
  expect(data.detailPeaks.every(value => value === 0)).toBe(true);
});

test("includes the final sample and either stereo channel without phase cancellation", () => {
  const left = new Float32Array(8001), right = new Float32Array(8001);
  left[0] = -0.4; right[4000] = 0.8; right[8000] = -1;
  const data = createWaveformPeaks([left, right], 8000);
  expect(data.peaks[0]).toBeCloseTo(0.4);
  expect(Math.max(...data.detailPeaks)).toBe(1);
  expect(data.detailPeaks.at(-1)).toBe(1);
  expect(data.peaks.at(-1)).toBe(1);
  expect(peakInRange(data.detailPeaks, 0.49, 0.51)).toBeCloseTo(0.8);
});

test("preserves a transient between the drawing positions", () => {
  const peaks = Array(1000).fill(0); peaks[515] = 0.9;
  expect(peakInRange(peaks, 0.50, 0.53)).toBe(0.9);
  expect(peakInRange(peaks, 0.54, 0.56)).toBe(0);
  expect(peakInRange(peaks, -0.1, 0)).toBe(0);
  expect(peakInRange([], 0, 1)).toBe(0);
});

test("bounds memory for long songs and handles short or invalid samples", () => {
  const data = createWaveformPeaks([new Float32Array(3600 * 100)], 100);
  expect(data.detailPeaks).toHaveLength(120000);
  expect(createWaveformPeaks([new Float32Array([NaN, Infinity, -2])], 8000).detailPeaks).toEqual([0, 0, 1]);
  expect(createWaveformPeaks([], 8000)).toEqual({ peaks: [], detailPeaks: [] });
  expect(() => createWaveformPeaks([new Float32Array(8)], 0)).toThrow();
});
