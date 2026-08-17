// Web Worker for processing audio peaks in background
addEventListener("message", (event: MessageEvent) => {
  const { audioData, peakCount = 800 } = event.data;
  if (!audioData) {
    postMessage({ error: "No audio data provided" });
    return;
  }

  const peaks: number[] = [];
  const step = Math.max(1, Math.floor(audioData.length / peakCount));
  
  for (let i = 0; i < peakCount; i++) {
    const start = i * step;
    let max = 0;
    for (let j = 0; j < step; j++) {
      if (start + j >= audioData.length) break;
      const val = Math.abs(audioData[start + j]);
      if (val > max) max = val;
    }
    peaks.push(max);
  }

  postMessage({ peaks });
});
