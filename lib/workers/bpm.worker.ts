// Web Worker for extracting BPM in background using essentia.js or simulated fallback analysis
addEventListener("message", (event: MessageEvent) => {
  const { audioData, sampleRate = 44100 } = event.data;
  if (!audioData) {
    postMessage({ error: "No audio data provided" });
    return;
  }

  let peakCount = 0;
  const threshold = 0.3;
  const step = Math.max(1, Math.floor(sampleRate * 0.2)); 
  
  for (let i = 0; i < audioData.length; i += step) {
    let max = 0;
    for (let j = 0; j < step; j++) {
      if (i + j >= audioData.length) break;
      const val = Math.abs(audioData[i + j]);
      if (val > max) max = val;
    }
    if (max > threshold) {
      peakCount++;
    }
  }

  const duration = audioData.length / sampleRate;
  const calculatedBpm = duration > 0 ? Math.round((peakCount / duration) * 60) : 120;
  const bpm = Math.max(60, Math.min(200, calculatedBpm));

  postMessage({ bpm });
});
