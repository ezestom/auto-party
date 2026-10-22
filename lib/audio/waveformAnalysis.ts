import type { WaveformPeaks } from "./waveformPeaks";

export function analyzeWaveform(buffer: AudioBuffer): Promise<WaveformPeaks> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/waveform.worker.ts", import.meta.url));
    const timer = setTimeout(() => { worker.terminate(); reject(new Error("El análisis de la onda tardó demasiado.")); }, 15000);
    worker.onmessage = (event: MessageEvent<WaveformPeaks & { error?: string }>) => {
      clearTimeout(timer); worker.terminate();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data);
    };
    worker.onerror = () => { clearTimeout(timer); worker.terminate(); reject(new Error("No se pudo analizar la onda.")); };
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    worker.postMessage({ channels, sampleRate: buffer.sampleRate });
  });
}
