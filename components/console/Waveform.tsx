"use client";

import { useRef, useState, useEffect } from "react";
import { useDeckStore } from "../../stores/deckStore";
import { generateMockWaveformData, WaveformData } from "../../lib/audio/WaveformHelper";

interface WaveformProps {
  deckId: "A" | "B";
  color: string;
}

export default function Waveform({ deckId, color }: WaveformProps) {
  const deck = useDeckStore((s) => s.decks[deckId]);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomedCanvasRef = useRef<HTMLCanvasElement>(null);
  const overviewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [cssWidth, setCssWidth] = useState(450);
  const [waveData, setWaveData] = useState<WaveformData | null>(null);

  // ── Refs for rapidly-changing deck values ──
  // These are updated on every React render but read inside rAF without causing re-mount
  const deckRef = useRef(deck);
  deckRef.current = deck;

  // Smooth playhead interpolation refs for 60fps butter-smooth scrolling
  const smoothTimeRef = useRef(deck.currentTime);
  const lastFrameTimeRef = useRef(performance.now());
  const prevDeckTimeRef = useRef(deck.currentTime);

  // ResizeObserver for responsive width & HiDPI resolution scaling
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCssWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Sync smooth time when seeking or changing track
  useEffect(() => {
    if (Math.abs(deck.currentTime - prevDeckTimeRef.current) > 0.3 || !deck.isPlaying) {
      smoothTimeRef.current = deck.currentTime;
    }
    prevDeckTimeRef.current = deck.currentTime;
  }, [deck.currentTime, deck.isPlaying]);

  // Compute/Load mock waveform peaks when track metadata changes
  useEffect(() => {
    if (deck.track) {
      const data = generateMockWaveformData(deck.track.id, deck.track.duration, deck.track.bpm);
      setWaveData(data);
    } else {
      // Fallback data for standby state
      const data = generateMockWaveformData("standby-" + deckId, 300, deck.bpm);
      setWaveData(data);
    }
  }, [deck.track, deckId, deck.bpm]);

  // Main 60fps High-Performance & High-Definition Canvas rendering loop
  // IMPORTANT: Only depends on stable values. Reads deck state from deckRef.current
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const now = performance.now();
      const dt = Math.min((now - lastFrameTimeRef.current) / 1000, 0.1);
      lastFrameTimeRef.current = now;

      // Read latest deck state from ref (no stale closure)
      const d = deckRef.current;
      const duration = d.track ? d.track.duration : 300;

      // Continuously extrapolate time at 60fps for liquid smooth scrolling
      if (d.isPlaying) {
        const speed = 1 + d.tempoOffset;
        smoothTimeRef.current = Math.min(duration, smoothTimeRef.current + dt * speed);
      }
      const currentTime = smoothTimeRef.current;
      const progress = duration > 0 ? currentTime / duration : 0;

      const zoomedCanvas = zoomedCanvasRef.current;
      const overviewCanvas = overviewCanvasRef.current;

      if (zoomedCanvas && overviewCanvas && waveData) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        // Resize Canvas buffer to match device pixel ratio for razor sharp HiDPI rendering
        const zTargetW = Math.max(1, Math.round(cssWidth * dpr));
        const zTargetH = Math.max(1, Math.round(82 * dpr));
        if (zoomedCanvas.width !== zTargetW || zoomedCanvas.height !== zTargetH) {
          zoomedCanvas.width = zTargetW;
          zoomedCanvas.height = zTargetH;
        }

        const oTargetW = Math.max(1, Math.round(cssWidth * dpr));
        const oTargetH = Math.max(1, Math.round(22 * dpr));
        if (overviewCanvas.width !== oTargetW || overviewCanvas.height !== oTargetH) {
          overviewCanvas.width = oTargetW;
          overviewCanvas.height = oTargetH;
        }

        const zCtx = zoomedCanvas.getContext("2d");
        const oCtx = overviewCanvas.getContext("2d");

        if (zCtx && oCtx) {
          // ═════════════════════════════════════════════════════════════
          // 1. RENDER ZOOMED SCROLLING PRO WAVEFORM (82px)
          // ═════════════════════════════════════════════════════════════
          const zW = zoomedCanvas.width;
          const zH = zoomedCanvas.height;
          zCtx.clearRect(0, 0, zW, zH);

          // Deep dark metallic background with radial subtle glare
          zCtx.fillStyle = "#06060c";
          zCtx.fillRect(0, 0, zW, zH);

          // Background center guide line
          zCtx.strokeStyle = "rgba(255, 255, 255, 0.05)";
          zCtx.lineWidth = 1 * dpr;
          zCtx.beginPath();
          zCtx.moveTo(0, zH / 2);
          zCtx.lineTo(zW, zH / 2);
          zCtx.stroke();

          const centerPlayheadX = zW / 2;
          const pixelsPerSecond = 65 * dpr; // Zoom factor: 65px = 1s

          const halfHeight = zH / 2;
          const windowRadius = (zW / 2) / pixelsPerSecond; // in seconds
          const startTime = Math.max(0, currentTime - windowRadius);
          const endTime = Math.min(duration, currentTime + windowRadius);

          const peaks = waveData.peaks;
          const numPeaks = peaks.length;

          // Multi-frequency Professional Color Palette
          const deckColorHex = color;

          // Render Spectrum Waveform Bars
          const barWidth = 2.2 * dpr;
          const barGap = 0.6 * dpr;

          for (let t = startTime; t <= endTime; t += 0.035) {
            const peakIdx = Math.floor((t / duration) * numPeaks);
            if (peakIdx >= numPeaks) break;

            const peakVal = peaks[peakIdx];
            const barHeight = Math.max(2 * dpr, peakVal * (zH - 12 * dpr));

            const x = centerPlayheadX + (t - currentTime) * pixelsPerSecond;
            const isPast = t < currentTime;

            // Spectrum Multi-layer Color:
            // Top/Bottom (Highs): Bright White cap
            // Middle (Mids): Main deck neon color
            // Core (Lows): Rich vibrant core
            if (isPast) {
              // Played track: bright white-silver with subtle accent glow
              zCtx.fillStyle = "#ffffff";
              zCtx.globalAlpha = 0.95;
            } else {
              // Unplayed track: vibrant deck color
              zCtx.fillStyle = deckColorHex;
              zCtx.globalAlpha = 0.65;
            }

            // Draw Symmetrical Peak Column
            zCtx.fillRect(x - barWidth / 2, halfHeight - barHeight / 2, barWidth - barGap, barHeight);

            // Draw White Transient Peak Caps for High Frequencies (Pro DJ Spectrum style)
            if (peakVal > 0.45) {
              zCtx.fillStyle = "#ffffff";
              zCtx.globalAlpha = isPast ? 0.9 : 0.7;
              const capH = 2 * dpr;
              zCtx.fillRect(x - barWidth / 2, halfHeight - barHeight / 2, barWidth - barGap, capH);
              zCtx.fillRect(x - barWidth / 2, halfHeight + barHeight / 2 - capH, barWidth - barGap, capH);
            }
          }
          zCtx.globalAlpha = 1.0;

          // Render Pro Beat Grid & Bar Numbers
          const beatInterval = 60 / d.bpm;
          const startBeatIdx = Math.floor(startTime / beatInterval);
          const endBeatIdx = Math.ceil(endTime / beatInterval);

          for (let i = startBeatIdx; i <= endBeatIdx; i++) {
            const beatTime = i * beatInterval;
            const x = centerPlayheadX + (beatTime - currentTime) * pixelsPerSecond;
            const isBar = i % 4 === 0;

            // Beat grid vertical line
            zCtx.strokeStyle = isBar ? "rgba(255, 255, 255, 0.35)" : "rgba(255, 255, 255, 0.1)";
            zCtx.lineWidth = isBar ? 1.5 * dpr : 0.8 * dpr;
            zCtx.beginPath();
            zCtx.moveTo(x, 0);
            zCtx.lineTo(x, zH);
            zCtx.stroke();

            // Bar number label at top of bar lines
            if (isBar && x > 20 * dpr && x < zW - 20 * dpr) {
              const barNum = Math.floor(i / 4) + 1;
              zCtx.fillStyle = "rgba(255, 255, 255, 0.6)";
              zCtx.font = `bold ${Math.round(8.5 * dpr)}px monospace`;
              zCtx.textAlign = "center";
              zCtx.fillText(barNum.toString(), x, 11 * dpr);
            }
          }

          // Render Active Loop Overlay
          if (d.loopActive && d.loopStart !== null) {
            const loopEnd = d.loopStart + d.loopLength * beatInterval;
            const loopStartX = centerPlayheadX + (d.loopStart - currentTime) * pixelsPerSecond;
            const loopEndX = centerPlayheadX + (loopEnd - currentTime) * pixelsPerSecond;

            // Translucent glowing overlay
            zCtx.fillStyle = color + "30";
            zCtx.fillRect(loopStartX, 0, loopEndX - loopStartX, zH);

            // Active Loop Boundary Lines
            zCtx.strokeStyle = color;
            zCtx.lineWidth = 2.5 * dpr;
            zCtx.beginPath();
            zCtx.moveTo(loopStartX, 0);
            zCtx.lineTo(loopStartX, zH);
            zCtx.moveTo(loopEndX, 0);
            zCtx.lineTo(loopEndX, zH);
            zCtx.stroke();
          }

          // Render Hot Cue Tag Pins
          d.hotCues.forEach((cue, idx) => {
            if (!cue) return;
            const x = centerPlayheadX + (cue.time - currentTime) * pixelsPerSecond;
            if (x < -10 * dpr || x > zW + 10 * dpr) return;

            // Cue vertical line
            zCtx.strokeStyle = cue.color;
            zCtx.lineWidth = 2 * dpr;
            zCtx.beginPath();
            zCtx.moveTo(x, 0);
            zCtx.lineTo(x, zH);
            zCtx.stroke();

            // Cue Number Badge Header
            const badgeW = 16 * dpr;
            const badgeH = 13 * dpr;
            zCtx.fillStyle = cue.color;
            zCtx.fillRect(x - badgeW / 2, 0, badgeW, badgeH);
            zCtx.fillStyle = "#000000";
            zCtx.font = `black ${Math.round(9 * dpr)}px monospace`;
            zCtx.textAlign = "center";
            zCtx.fillText((idx + 1).toString(), x, 9.5 * dpr);
          });

          // Render Fixed Center Playhead Needle
          // Red/White illuminated laser playhead line
          zCtx.strokeStyle = "#ffffff";
          zCtx.lineWidth = 2 * dpr;
          zCtx.beginPath();
          zCtx.moveTo(centerPlayheadX, 0);
          zCtx.lineTo(centerPlayheadX, zH);
          zCtx.stroke();

          // Top & Bottom Playhead Needle Pointer Triangles
          const triSize = 6 * dpr;
          zCtx.fillStyle = "#ff3355";

          // Top triangle pointing down
          zCtx.beginPath();
          zCtx.moveTo(centerPlayheadX - triSize, 0);
          zCtx.lineTo(centerPlayheadX + triSize, 0);
          zCtx.lineTo(centerPlayheadX, triSize);
          zCtx.closePath();
          zCtx.fill();

          // Bottom triangle pointing up
          zCtx.beginPath();
          zCtx.moveTo(centerPlayheadX - triSize, zH);
          zCtx.lineTo(centerPlayheadX + triSize, zH);
          zCtx.lineTo(centerPlayheadX, zH - triSize);
          zCtx.closePath();
          zCtx.fill();

          // Playhead vertical aura glow
          zCtx.fillStyle = "rgba(255, 255, 255, 0.15)";
          zCtx.fillRect(centerPlayheadX - 4 * dpr, 0, 8 * dpr, zH);


          // ═════════════════════════════════════════════════════════════
          // 2. RENDER OVERVIEW WAVEFORM (22px)
          // ═════════════════════════════════════════════════════════════
          const oW = overviewCanvas.width;
          const oH = overviewCanvas.height;
          oCtx.clearRect(0, 0, oW, oH);

          // Overview background
          oCtx.fillStyle = "#08080e";
          oCtx.fillRect(0, 0, oW, oH);

          // Render full track overview peaks
          const step = oW / numPeaks;
          for (let i = 0; i < numPeaks; i++) {
            const peakVal = peaks[i];
            const barHeight = Math.max(1.5 * dpr, peakVal * (oH - 3 * dpr));
            const x = i * step;
            const isPast = x / oW < progress;

            oCtx.fillStyle = isPast ? "#ffffff" : color;
            oCtx.globalAlpha = isPast ? 0.9 : 0.4;
            oCtx.fillRect(x, (oH - barHeight) / 2, Math.max(1, step - 0.4 * dpr), barHeight);
          }
          oCtx.globalAlpha = 1.0;

          // Overview Hotcue dots
          d.hotCues.forEach((cue) => {
            if (!cue) return;
            const x = (cue.time / duration) * oW;
            oCtx.fillStyle = cue.color;
            oCtx.beginPath();
            oCtx.arc(x, oH / 2, 3 * dpr, 0, 2 * Math.PI);
            oCtx.fill();
          });

          // Overview current position playhead bar
          const playheadX = progress * oW;
          oCtx.fillStyle = "#ffffff";
          oCtx.fillRect(playheadX - 1 * dpr, 0, 2 * dpr, oH);
          oCtx.fillStyle = "rgba(255, 255, 255, 0.3)";
          oCtx.fillRect(playheadX - 3 * dpr, 0, 6 * dpr, oH);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [waveData, color, deckId, cssWidth]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-1.5 w-full bg-black/95 p-1.5 border-t border-b border-[#252538] relative shadow-inner"
      style={{ height: 115 }}
    >
      {/* Zoomed scrolling main waveform (82px) */}
      <canvas
        ref={zoomedCanvasRef}
        style={{ width: "100%", height: 82 }}
        className="w-full rounded-lg border border-[#202034] shadow-md"
      />
      {/* Overview track waveform (22px) */}
      <canvas
        ref={overviewCanvasRef}
        style={{ width: "100%", height: 22 }}
        className="w-full rounded-md border border-[#202034]/70"
      />
    </div>
  );
}

