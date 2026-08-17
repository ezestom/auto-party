"use client";

import { useEffect, useState, useRef } from "react";
import DeckPanel from "./DeckPanel";
import MixerCenter from "./MixerCenter";
import LibraryPanel from "../library/LibraryPanel";
import Laser from "../ui/Laser";
import { useDeckStore } from "../../stores/deckStore";
import { useMixerStore } from "../../stores/mixerStore";
import { Music, Radio, Cpu, Wifi, Zap } from "lucide-react";
import { getAudioEngine } from "../../lib/audio/AudioEngine";

export default function DJConsole() {
  const deckA = useDeckStore((s) => s.decks.A);
  const deckB = useDeckStore((s) => s.decks.B);
  const { setProgress } = useDeckStore();

  const channelA = useMixerStore((s) => s.channels.A);
  const channelB = useMixerStore((s) => s.channels.B);
  const crossfader = useMixerStore((s) => s.crossfader);

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [clockTime, setClockTime] = useState("");
  const [isAudioReady, setIsAudioReady] = useState(false);

  // Animated Laser State (Smooth Color Mixing & Fade In/Out)
  const [laserParams, setLaserParams] = useState({
    color: [1.0, 0.42, 0.0] as [number, number, number],
    intensity: 0,
  });

  const currColorRef = useRef<[number, number, number]>([1.0, 0.42, 0.0]);
  const currIntensityRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // Audio Context auto-resume gesture listener
  useEffect(() => {
    const handleGesture = () => {
      const engine = getAudioEngine();
      engine.resume().then(() => {
        if (engine.ctx && engine.ctx.state === "running") {
          setIsAudioReady(true);
        }
      });
    };

    window.addEventListener("pointerdown", handleGesture, { once: true });
    window.addEventListener("keydown", handleGesture, { once: true });

    return () => {
      window.removeEventListener("pointerdown", handleGesture);
      window.removeEventListener("keydown", handleGesture);
    };
  }, []);

  // Smooth Laser Animation Loop (Lerp color mixing & intensity fade)
  useEffect(() => {
    const animateLaser = () => {
      const playingA = deckA.isPlaying;
      const playingB = deckB.isPlaying;

      // Target Intensity: 1.0 if any deck is playing, 0.0 if both paused
      const targetIntensity = playingA || playingB ? 1.0 : 0.0;

      // Calculate Target Color weights based on playing decks and crossfader/channel volume
      let weightA = 0;
      let weightB = 0;

      if (playingA && !playingB) {
        weightA = 1.0;
        weightB = 0.0;
      } else if (playingB && !playingA) {
        weightA = 0.0;
        weightB = 1.0;
      } else if (playingA && playingB) {
        // Crossfader 0 = 100% Deck A, 1 = 100% Deck B
        weightA = Math.max(0.1, (1 - crossfader) * channelA.volume);
        weightB = Math.max(0.1, crossfader * channelB.volume);
      }

      const totalWeight = weightA + weightB;
      let targetR = currColorRef.current[0];
      let targetG = currColorRef.current[1];
      let targetB = currColorRef.current[2];

      if (totalWeight > 0) {
        const normA = weightA / totalWeight;
        const normB = weightB / totalWeight;

        // Deck A: Orange [1.0, 0.42, 0.0]
        // Deck B: Cyan   [0.0, 0.83, 1.0]
        targetR = normA * 1.0 + normB * 0.0;
        targetG = normA * 0.42 + normB * 0.83;
        targetB = normA * 0.0 + normB * 1.0;
      }

      // Linear interpolation (Lerp) for smooth fade in/out and subtle color morphing
      currIntensityRef.current += (targetIntensity - currIntensityRef.current) * 0.06;
      currColorRef.current[0] += (targetR - currColorRef.current[0]) * 0.05;
      currColorRef.current[1] += (targetG - currColorRef.current[1]) * 0.05;
      currColorRef.current[2] += (targetB - currColorRef.current[2]) * 0.05;

      setLaserParams({
        color: [
          Math.max(0, Math.min(1, currColorRef.current[0])),
          Math.max(0, Math.min(1, currColorRef.current[1])),
          Math.max(0, Math.min(1, currColorRef.current[2])),
        ],
        intensity: Math.max(0, Math.min(1, currIntensityRef.current)),
      });

      animFrameRef.current = requestAnimationFrame(animateLaser);
    };

    animFrameRef.current = requestAnimationFrame(animateLaser);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [deckA.isPlaying, deckB.isPlaying, crossfader, channelA.volume, channelB.volume]);

  // 60FPS High-resolution progress simulation loop
  useEffect(() => {
    let lastTime = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const currentDeckA = useDeckStore.getState().decks.A;
      const currentDeckB = useDeckStore.getState().decks.B;
      const setProg = useDeckStore.getState().setProgress;

      if (currentDeckA.isPlaying) {
        const speed = 1 + currentDeckA.tempoOffset;
        const dur = currentDeckA.track ? currentDeckA.track.duration : 300;
        const deltaProg = (dt * speed) / dur;
        const next = currentDeckA.progress + deltaProg;
        setProg("A", next >= 1 ? 0 : next);
      }
      if (currentDeckB.isPlaying) {
        const speed = 1 + currentDeckB.tempoOffset;
        const dur = currentDeckB.track ? currentDeckB.track.duration : 300;
        const deltaProg = (dt * speed) / dur;
        const next = currentDeckB.progress + deltaProg;
        setProg("B", next >= 1 ? 0 : next);
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [deckA.isPlaying, deckB.isPlaying]);

  // Live clock
  useEffect(() => {
    const tick = () =>
      setClockTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleRecordToggle = async () => {
    const nextState = !isRecording;
    const engine = getAudioEngine();
    
    if (nextState) {
      await engine.resume();
      engine.startRecording();
      setIsRecording(true);
    } else {
      const wavBlob = engine.stopRecording();
      setIsRecording(false);
      
      if (wavBlob) {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
        const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
        const filename = `mixr-mix-${dateStr}-${timeStr}.wav`;
        
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      }
    }
  };

  const masterBpm = deckA.isMaster ? deckA.bpm : deckB.bpm;
  const anyPlaying = deckA.isPlaying || deckB.isPlaying;

  const { color: laserColor, intensity: laserIntensity } = laserParams;

  return (
    <Laser
      speed={0.35}
      offset={36}
      color={laserColor}
      thickness={7 * laserIntensity}
      core={1.3 * laserIntensity}
      radius={26 * laserIntensity}
      glow={2.4 * laserIntensity}
      wave={12 * laserIntensity}
      width={0.68}
      flicker={0.25 * laserIntensity}
      reveal={360 * laserIntensity}
      heat={1.4 * laserIntensity}
      shimmer={12 * laserIntensity}
      sparkle={0.35 * laserIntensity}
      reactivity={1.2}
      className="w-full h-full"
    >
      {/*
       * Root: full-viewport grid with 3 rows
       *   row 1 = header bar (50px fixed)
       *   row 2 = console content (fills remaining space, overflow hidden)
       *   row 3 = status bar (36px fixed)
       */}
      <div
        className="select-none font-sans"
        style={{
          display: "grid",
          gridTemplateRows: "50px 1fr 36px",
          height: "100dvh",
          maxHeight: "100dvh",
          overflow: "hidden",
          background: "linear-gradient(180deg, #050508 0%, #08080d 100%)",
        }}
      >
        {/* ══════════════════════════════
            ROW 1 — HEADER
        ══════════════════════════════ */}
        <header
          style={{
            borderBottom: "1px solid #1e1e30",
            background: "rgba(6,6,10,0.97)",
            backdropFilter: "blur(20px)",
          }}
          className="flex items-center justify-between px-4 z-20"
        >
          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-mono text-[13px] font-black text-black relative shadow-lg"
              style={{
                background: "linear-gradient(135deg, #ff6b00, #ff9500)",
                boxShadow: "0 0 18px rgba(255,107,0,0.55)",
              }}
            >
              M
              {anyPlaying && (
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#00ff88] animate-pulse shadow-[0_0_8px_#00ff88]" />
              )}
            </div>
            <div className="leading-none">
              <div className="font-mono text-[16px] font-black tracking-[3px] text-white flex items-center gap-1.5">
                MIXR <span className="text-[10px] text-[#ff6b00] tracking-widest font-mono">PRO</span>
              </div>
              <div className="font-mono text-[7.5px] text-text-muted tracking-widest uppercase mt-0.5">DJ CONSOLE PRO v2.0</div>
            </div>
          </div>

          {/* Center status */}
          <div className="flex items-center gap-7">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full transition-all duration-300 ${isAudioReady ? "bg-[#00ff88] shadow-[0_0_8px_#00ff88]" : "bg-[#555570]"}`} />
              <span className="font-mono text-[9.5px] text-text-muted tracking-wider uppercase font-bold">Audio Engine</span>
            </div>
            <div className="flex items-center gap-2">
              <Cpu size={12} className="text-text-muted" />
              <span className="font-mono text-[9.5px] text-text-muted tracking-wider font-bold">4.2 ms</span>
            </div>
            <div className="flex items-center gap-2">
              <Wifi size={12} className="text-[#00ff88]" />
              <span className="font-mono text-[9.5px] text-[#00ff88] tracking-wider font-extrabold uppercase">Live</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-black/50 border border-[#222234]">
              <Zap size={11} className="text-[#ff6b00]" />
              <span className="font-mono text-[10px] font-bold text-white tracking-wider">{clockTime}</span>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex gap-2.5 items-center shrink-0">
            <button
              id="library-toggle-btn"
              onClick={() => setIsLibraryOpen((p) => !p)}
              style={{
                borderColor: isLibraryOpen ? "#ff6b00" : "#28283d",
                color: isLibraryOpen ? "#ff6b00" : "#9999b0",
                backgroundColor: isLibraryOpen ? "#ff6b001a" : "transparent",
                boxShadow: isLibraryOpen ? "0 0 14px rgba(255,107,0,0.35)" : "none",
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] font-mono font-black tracking-wider rounded-lg border cursor-pointer uppercase transition-all"
            >
              <Music size={12} />
              Library
            </button>
            <button
              id="record-btn"
              onClick={handleRecordToggle}
              style={{
                borderColor: isRecording ? "#ff3355" : "#28283d",
                color: isRecording ? "#ff3355" : "#9999b0",
                backgroundColor: isRecording ? "#ff335518" : "transparent",
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] font-mono font-black tracking-wider rounded-lg border cursor-pointer uppercase transition-all"
            >
              <span className={`w-2 h-2 rounded-full ${isRecording ? "bg-red-custom animate-pulse shadow-[0_0_8px_#ff3355]" : "bg-[#35354c]"}`} />
              {isRecording ? "REC" : "Rec"}
            </button>
            <button
              style={{
                borderColor: "#ff6b0070",
                color: "#ff6b00",
                backgroundColor: "#ff6b0018",
              }}
              className="px-3 py-1.5 text-[10px] font-mono font-black tracking-wider rounded-lg border cursor-pointer hover:text-white uppercase transition-colors"
            >
              Quantize
            </button>
          </div>
        </header>

        {/* ══════════════════════════════
            ROW 2 — CONSOLE CONTENT
        ══════════════════════════════ */}
        <main
          className="overflow-x-hidden overflow-y-auto flex items-stretch gap-2 px-2 py-2 min-w-0"
          style={{ minHeight: 0 }}
        >
          {/* Deck A */}
          <div className="flex-1 min-w-[280px] overflow-hidden">
            <DeckPanel deckId="A" color="#ff6b00" />
          </div>

          {/* Mixer Center */}
          <div className="shrink-0 overflow-hidden min-w-[180px]">
            <MixerCenter />
          </div>

          {/* Deck B */}
          <div className="flex-1 min-w-[280px] overflow-hidden">
            <DeckPanel deckId="B" color="#00d4ff" />
          </div>
        </main>

        {/* ══════════════════════════════
            ROW 3 — STATUS BAR
        ══════════════════════════════ */}
        <footer
          style={{
            background: "rgba(4,4,7,0.98)",
            borderTop: "1px solid #1e1e30",
          }}
          className="flex items-center justify-between px-4 z-20"
        >
          <div className="flex gap-7 items-center">
            {[
              { label: "Master BPM", value: masterBpm.toFixed(1), color: "#ffffff" },
              { label: "Key A", value: deckA.track ? deckA.track.key : "7A", color: "#ff6b00" },
              { label: "Key B", value: deckB.track ? deckB.track.key : "6B", color: "#00d4ff" },
              { label: "Harmonic", value: "✓ Match", color: "#00ff88" },
              { label: "Latency", value: "4.2 ms", color: "#9999b0" },
              { label: "Buffer", value: "512 smp", color: "#9999b0" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex gap-1.5 items-baseline">
                <span className="font-mono text-[9px] text-text-muted uppercase tracking-wider font-bold">{label}:</span>
                <span className="font-mono text-[10.5px] font-black" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-5">
            {isRecording && (
              <div className="flex items-center gap-1.5 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-red-custom shadow-[0_0_8px_#ff3355]" />
                <span className="font-mono text-[9px] text-red-custom font-black uppercase tracking-wider">Recording</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Radio size={11} className={isAudioReady ? "text-[#00ff88]" : "text-[#555570]"} />
              <span className={`font-mono text-[9px] font-black tracking-widest uppercase transition-colors ${isAudioReady ? "text-[#00ff88]" : "text-[#555570]"}`}>
                {isAudioReady ? "Audio Engine Ready" : "Audio Engine Suspended"}
              </span>
            </div>
          </div>
        </footer>

        {/* Library Sidebar */}
        <LibraryPanel isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} />
      </div>
    </Laser>
  );
}
