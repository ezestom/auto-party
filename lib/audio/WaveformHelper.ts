export interface WaveformData {
  peaks: number[];
  beatGrid: number[];
}

export function generateMockWaveformData(trackId: string, duration: number, bpm: number): WaveformData {
  // Deterministic seed generation based on trackId string
  let seed = 0;
  for (let i = 0; i < trackId.length; i++) {
    seed = (seed << 5) - seed + trackId.charCodeAt(i);
  }
  
  // Custom pseudo-random generator
  const random = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  // Generate 800 peak data points
  const peakCount = 800;
  const peaks: number[] = [];
  
  // Generate a realistic DJ track outline
  for (let i = 0; i < peakCount; i++) {
    const pct = i / peakCount;
    let base = 0.3;
    if (pct < 0.1) {
      // Intro: medium energy (drums intro)
      base = 0.35 + 0.15 * Math.sin(pct * Math.PI * 10);
    } else if (pct < 0.25) {
      // Verse: lower energy (vocals/melodic breakdown)
      base = 0.25 + 0.12 * Math.sin(pct * Math.PI * 4);
    } else if (pct < 0.35) {
      // Build-up: ramping energy
      const bp = (pct - 0.25) / 0.1;
      base = 0.3 + 0.5 * bp + 0.1 * random();
    } else if (pct < 0.55) {
      // Drop 1: high energy
      base = 0.75 + 0.15 * Math.sin(pct * Math.PI * 16) + 0.05 * random();
    } else if (pct < 0.65) {
      // Main breakdown: very low energy
      base = 0.15 + 0.1 * Math.cos((pct - 0.55) * Math.PI * 2);
    } else if (pct < 0.75) {
      // Build 2: ramping energy
      const bp = (pct - 0.65) / 0.1;
      base = 0.3 + 0.5 * bp + 0.1 * random();
    } else if (pct < 0.9) {
      // Drop 2: maximum energy
      base = 0.8 + 0.12 * Math.sin(pct * Math.PI * 16) + 0.05 * random();
    } else {
      // Outro: tapering down to silent
      const op = (pct - 0.9) / 0.1;
      base = 0.4 * (1.0 - op) + 0.08 * random();
    }
    
    // Smooth and clamp
    peaks.push(Math.max(0.05, Math.min(1.0, base + (random() - 0.5) * 0.08)));
  }

  // Generate beat grid timestamps based on BPM
  const beatGrid: number[] = [];
  const beatInterval = 60 / bpm;
  let t = 0;
  while (t < duration) {
    beatGrid.push(t);
    t += beatInterval;
  }

  return { peaks, beatGrid };
}
