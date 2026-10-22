export interface WaveformPeaks { peaks: number[]; detailPeaks: number[] }

/** Maximum amplitude over a fractional time range; retain short transients when zooming out. */
export function peakInRange(peaks: readonly number[], from: number, to: number): number {
  const start = Math.max(0, Math.floor(from * peaks.length));
  const end = Math.min(peaks.length, Math.ceil(to * peaks.length));
  let peak = 0;
  for (let i = start; i < end; i++) {
    if (Number.isFinite(peaks[i])) peak = Math.max(peak, Math.min(1, Math.abs(peaks[i])));
  }
  return peak;
}

/** One pass over PCM channels, then reduce the detailed envelope to an overview. */
export function createWaveformPeaks(channels: readonly Float32Array[], sampleRate: number): WaveformPeaks {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new Error("Invalid sample rate");
  const length = channels.reduce((max, channel) => Math.max(max, channel.length), 0);
  if (!length) return { peaks: [], detailPeaks: [] };
  const count = Math.min(length, Math.max(800, Math.min(120000, Math.ceil(length / sampleRate * 100))));
  const detailPeaks = Array<number>(count).fill(0);
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * length / count), end = Math.floor((i + 1) * length / count);
    let peak = 0;
    for (const channel of channels) {
      for (let sample = start; sample < Math.min(end, channel.length); sample++) {
        const value = channel[sample];
        if (Number.isFinite(value)) peak = Math.max(peak, Math.min(1, Math.abs(value)));
      }
    }
    detailPeaks[i] = peak;
  }
  const overviewCount = Math.min(800, length);
  const peaks = Array.from({ length: overviewCount }, (_, i) => peakInRange(detailPeaks, i / overviewCount, (i + 1) / overviewCount));
  return { peaks, detailPeaks };
}
