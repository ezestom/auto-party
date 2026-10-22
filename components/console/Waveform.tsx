"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { useDeckStore } from "../../stores/deckStore";
import { getAudioEngine } from "../../lib/audio/AudioEngine";
import { peakInRange } from "../../lib/audio/waveformPeaks";

interface WaveformProps {
  deckId: "A" | "B";
  color: string;
  isLibraryOpen?: boolean;
}

export default function Waveform({ deckId, color, isLibraryOpen = true }: WaveformProps) {
  const deck = useDeckStore((s) => s.decks[deckId]);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomedCanvasRef = useRef<HTMLCanvasElement>(null);
  const overviewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [cssWidth, setCssWidth] = useState(450);

  // The amplitude envelope comes from the imported audio, never a demo track.
  const waveData = useMemo(() => ({
    peaks: (deck.track?.peaks || []).map(value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0),
    detailPeaks: deck.track?.detailPeaks?.length ? deck.track.detailPeaks : deck.track?.peaks || [],
  }), [deck.track]);

  // ── Refs for rapidly-changing deck values ──
  // These are updated on every React render but read inside rAF without causing re-mount
  const deckRef = useRef(deck);
  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);


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


  // Main 60fps High-Performance & High-Definition Canvas rendering loop
  // IMPORTANT: Only depends on stable values. Reads deck state from deckRef.current
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {

      // Read latest deck state from ref (no stale closure)
      const d = deckRef.current;
      const duration = d.track ? d.track.duration : 300;

      // Draw against the same clock as the audible source, including native loops.
      const currentTime = d.track ? getAudioEngine().getPlaybackTime(deckId) : 0;
      const progress = duration > 0 ? currentTime / duration : 0;

      const zoomedCanvas = zoomedCanvasRef.current;
      const overviewCanvas = overviewCanvasRef.current;

      if (zoomedCanvas && overviewCanvas && waveData) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        const zoomedH = zoomedCanvas.clientHeight || 52;
        const overviewH = overviewCanvas.clientHeight || 18;

        const zTargetW = Math.max(1, Math.round(cssWidth * dpr));
        const zTargetH = Math.max(1, Math.round(zoomedH * dpr));
        if (zoomedCanvas.width !== zTargetW || zoomedCanvas.height !== zTargetH) {
          zoomedCanvas.width = zTargetW;
          zoomedCanvas.height = zTargetH;
        }

        const oTargetW = Math.max(1, Math.round(cssWidth * dpr));
        const oTargetH = Math.max(1, Math.round(overviewH * dpr));
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

          for (let t = Math.floor(startTime / 0.035) * 0.035; t < endTime; t += 0.035) {
            const peakVal = peakInRange(waveData.detailPeaks, t / duration, Math.min(t + 0.035, duration) / duration);
            if (peakVal === 0) continue;
            const barHeight = peakVal * (zH - 12 * dpr);

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
          const beatInterval = 60 / Math.max(1, d.baseBpm);
          const startBeatIdx = Math.floor(startTime / beatInterval);
          const endBeatIdx = Math.ceil(endTime / beatInterval);

          for (let i = startBeatIdx; d.track && i <= endBeatIdx; i++) {
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

          if (d.track) {
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
          }

          const oW = overviewCanvas.width;
          const oH = overviewCanvas.height;
          oCtx.clearRect(0, 0, oW, oH);

          // Overview background
          oCtx.fillStyle = "#08080e";
          oCtx.fillRect(0, 0, oW, oH);

          if (!d.track) {
            zCtx.fillStyle = "#8888a0";
            zCtx.font = Math.round(11 * dpr) + "px monospace";
            zCtx.textAlign = "center";
            zCtx.fillText("Cargá una canción", zW / 2, zH / 2 + 4 * dpr);
          }

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
  }, [waveData, color, deckId, cssWidth, isLibraryOpen]);

  const [isShort, setIsShort] = useState(false);

  useEffect(() => {
    const check = () => setIsShort(window.innerHeight < 600);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const zoomedH = isShort ? (isLibraryOpen ? 32 : 44) : (isLibraryOpen ? 52 : 82);
  const overviewH = isShort ? (isLibraryOpen ? 12 : 15) : (isLibraryOpen ? 18 : 22);
  const containerH = isShort ? (isLibraryOpen ? 50 : 66) : (isLibraryOpen ? 80 : 115);

  return (
    <div
      ref={containerRef}
      className="waveform-panel flex flex-col gap-0.5 w-full bg-black/95 p-0.5 border-t border-b border-[#252538] relative shadow-inner shrink-0"
      style={{ height: containerH }}
    >
      {/* Zoomed scrolling main waveform */}
      <canvas
        ref={zoomedCanvasRef}
        role="img"
        aria-label={`Onda detallada del deck ${deckId}`}
        data-peak-count={waveData.detailPeaks.length}
        style={{ width: "100%", height: zoomedH }}
        className="w-full rounded-lg border border-[#202034] shadow-md"
      />
      {/* Overview track waveform */}
      <canvas
        ref={overviewCanvasRef}
        role="img"
        aria-label={`Vista general del deck ${deckId}`}
        data-peak-count={waveData.peaks.length}
        style={{ width: "100%", height: overviewH }}
        className="w-full rounded-md border border-[#202034]/70"
      />
    </div>
  );
}

