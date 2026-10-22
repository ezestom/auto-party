/** Estimate periodicity of amplitude onsets. This is not beat-phase or key detection. */
export function estimateTempo(audio: Float32Array, sampleRate: number): { bpm: number; confidence: number } {
  if (!(sampleRate > 0) || audio.length < sampleRate * 4) return { bpm: 0, confidence: 0 };
  const hop = Math.max(1, Math.round(sampleRate / 100));
  const frames = Math.min(Math.floor(audio.length / hop), 12000);
  const energy = new Float64Array(frames);
  let maximum = 0;
  for (let frame = 0; frame < frames; frame++) {
    let sum = 0;
    for (let j = 0; j < hop; j++) sum += audio[frame * hop + j] ** 2;
    energy[frame] = Math.sqrt(sum / hop);
    maximum = Math.max(maximum, energy[frame]);
  }
  if (maximum < 0.00001) return { bpm: 0, confidence: 0 };
  const onsets = new Float64Array(frames);
  let onsetEnergy = 0;
  // Ignore the opening edge and fluctuations too small to be meaningful transients.
  for (let i = 2; i < frames; i++) {
    const change = (energy[i] - energy[i - 1]) / maximum;
    onsets[i] = change > 0.1 ? change : 0;
    onsetEnergy += onsets[i] ** 2;
  }
  if (onsetEnergy < 0.01) return { bpm: 0, confidence: 0 };
  // Spread each onset over neighboring bins to tolerate beats between frame boundaries.
  const rawOnsets = onsets.slice();
  for (let i = 1; i < frames - 1; i++) onsets[i] = (rawOnsets[i - 1] + 2 * rawOnsets[i] + rawOnsets[i + 1]) / 4;
  const frameRate = sampleRate / hop;
  let bestLag = 0, bestScore = 0;
  for (let lag = Math.ceil(frameRate * 60 / 200); lag <= Math.floor(frameRate * 60 / 60); lag++) {
    let correlation = 0, left = 0, right = 0;
    for (let i = lag; i < frames; i++) {
      correlation += onsets[i] * onsets[i - lag];
      left += onsets[i] ** 2;
      right += onsets[i - lag] ** 2;
    }
    const score = left && right ? correlation / Math.sqrt(left * right) * (1 - lag * 0.002) : 0;
    if (score > bestScore + 0.005) { bestScore = score; bestLag = lag; }
  }
  if (bestScore < 0.3 || !bestLag) return { bpm: 0, confidence: bestScore };
  return { bpm: Math.round(60 * frameRate / bestLag), confidence: Math.min(1, bestScore) };
}
