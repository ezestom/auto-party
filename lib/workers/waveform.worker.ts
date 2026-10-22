import { createWaveformPeaks } from "../audio/waveformPeaks";

addEventListener("message", (event: MessageEvent) => {
  try {
    postMessage(createWaveformPeaks(event.data.channels, event.data.sampleRate));
  } catch (error) {
    postMessage({ error: error instanceof Error ? error.message : "No se pudo analizar la onda." });
  }
});
