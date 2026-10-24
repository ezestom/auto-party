"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import PartyPanel from "./PartyPanel";
import DeckPanel from "./DeckPanel";
import MixerCenter from "./MixerCenter";
import LibraryPanel from "../library/LibraryPanel";
import LibraryDrawer from "../library/LibraryDrawer";
import Laser from "../ui/Laser";
import VJMiniPlayer from "../vj/VJMiniPlayer";
import AIAutoDJButton from "../ai/AIAutoDJButton";
import AIPointer from "../ai/AIPointer";
import AIConnectionModal from "../ai/APIKeyModal";
import { useAIConnectionStore } from "../../stores/aiConnectionStore";
import SettingsModal from "../settings/SettingsModal";
import { useDeckStore } from "../../stores/deckStore";
import { useMixerStore } from "../../stores/mixerStore";
import { useVJStore } from "../../stores/vjStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { Music, Radio, Cpu, Wifi, Zap, Settings } from "lucide-react";
import { getAudioEngine } from "../../lib/audio/AudioEngine";
import { vjChannel } from "../../lib/vj/vjChannel";

export default function DJConsole() {
  useEffect(() => {
    // Remove the legacy browser credential; new sessions are managed by HttpOnly cookies.
    try { localStorage.removeItem("eze_mix_gemini_api_key"); } catch {}
    void useAIConnectionStore.getState().refresh();
    void useLibraryStore.getState().initLibrary();
    void useVJStore.getState().loadVideos();
  }, []);
  const [partyMode, setPartyMode] = useState(false);
  const deckA = useDeckStore((s) => s.decks.A);
  const deckB = useDeckStore((s) => s.decks.B);

  const channelA = useMixerStore((s) => s.channels.A);
  const channelB = useMixerStore((s) => s.channels.B);
  const crossfader = useMixerStore((s) => s.crossfader);

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const libraryTriggerRef = useRef<HTMLButtonElement>(null);
  const libraryReturnRef = useRef<HTMLButtonElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [clockTime, setClockTime] = useState("");
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [selectedMobileDeck, setSelectedMobileDeck] = useState<"A" | "MIXER" | "B">("A");
  const [isPortraitMode, setIsPortraitMode] = useState(false);

  // Measure screen height and width for responsive layout
  useEffect(() => {
    const checkViewport = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setIsPortraitMode(w < 1024 && h >= w);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);


  // Animated Laser State (Smooth Color Mixing & Fade In/Out)
  const [laserParams, setLaserParams] = useState({
    color: [1.0, 0.42, 0.0] as [number, number, number],
    intensity: 0,
  });

  const currColorRef = useRef<[number, number, number]>([1.0, 0.42, 0.0]);
  const currIntensityRef = useRef<number>(0);
  const laserBoostRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // Audio Context auto-resume gesture listener & VJ channel drop flash hook
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

    const unsubscribeVJ = vjChannel.subscribe((msg) => {
      if (msg.type === "DROP_FLASH") {
        laserBoostRef.current = 1.2;
      }
    });

    return () => {
      window.removeEventListener("pointerdown", handleGesture);
      window.removeEventListener("keydown", handleGesture);
      unsubscribeVJ();
    };
  }, []);

  // Smooth Laser Animation Loop (Lerp color mixing & intensity fade + Drop Burst)
  useEffect(() => {
    const animateLaser = () => {
      const playingA = deckA.isPlaying;
      const playingB = deckB.isPlaying;

      // React to the audible signal, including pauses, silent passages and master volume.
      let targetIntensity = Math.min(1.4, getAudioEngine().getVisualEnergy() * 4);
      if (laserBoostRef.current > 0.01) {
        targetIntensity += laserBoostRef.current * 0.8;
        laserBoostRef.current *= 0.94; // Decay boost
      }

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
        const total = weightA + weightB;
        weightA = weightA / total;
        weightB = weightB / total;
      }

      // Deck A: Orange [1.0, 0.42, 0.0], Deck B: Cyan [0.0, 0.83, 1.0]
      const targetR = weightA * 1.0 + weightB * 0.0;
      const targetG = weightA * 0.42 + weightB * 0.83;
      const targetBCol = weightA * 0.0 + weightB * 1.0;

      // Smooth Lerp transitions (factor 0.08)
      const lerpFactor = 0.08;
      const curCol = currColorRef.current;
      curCol[0] += (targetR - curCol[0]) * lerpFactor;
      curCol[1] += (targetG - curCol[1]) * lerpFactor;
      curCol[2] += (targetBCol - curCol[2]) * lerpFactor;

      currIntensityRef.current += (targetIntensity - currIntensityRef.current) * 0.06;

      setLaserParams({
        color: [curCol[0], curCol[1], curCol[2]],
        intensity: currIntensityRef.current,
      });

      animFrameRef.current = requestAnimationFrame(animateLaser);
    };

    animFrameRef.current = requestAnimationFrame(animateLaser);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [deckA.isPlaying, deckB.isPlaying, crossfader, channelA.volume, channelB.volume]);

  // Master clock timer update
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setClockTime(d.toTimeString().split(" ")[0]);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Render the actual audio position. Playback continues independently of screen frames.
  useEffect(() => {
    const update = () => {
      const engine = getAudioEngine();
      engine.syncPlayheads();
      setIsAudioReady(engine.ctx?.state === "running");
    };
    const timer = window.setInterval(update, 50);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  // Record handler
  const handleRecordToggle = async () => {
    const engine = getAudioEngine();
    if (!isRecording) {
      await engine.resume();
      setIsRecording(engine.startRecording() === true);
    } else {
      const blob = await engine.stopRecording();
      setIsRecording(false);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `EZE_MIX_DJ_SET_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.wav`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  };

  const masterBpm = (deckA.bpm + deckB.bpm) / 2;
  const anyPlaying = deckA.isPlaying || deckB.isPlaying;
  const audioPlaying = isAudioReady && anyPlaying;
  const audioState = audioPlaying ? "playing" : isAudioReady ? "ready" : "suspended";

  const { color: laserColor, intensity: laserIntensity } = laserParams;

  return (
    <>
      <div
        className="dj-console console-shell relative w-full select-none font-sans overflow-hidden flex flex-col"
        style={{
          height: "100dvh",
          maxHeight: "100dvh",
          background: "linear-gradient(180deg, #050508 0%, #08080d 100%)",
        }}
      >
        {/* Visual Ambient Laser Beam Effect */}
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
          <Laser
            speed={0.4}
            offset={32}
            color={laserColor}
            thickness={8 * laserIntensity}
            core={1.5 * laserIntensity}
            radius={28 * laserIntensity}
            glow={2.8 * laserIntensity}
            wave={14 * laserIntensity}
            width={0.8}
            flicker={0.2 * laserIntensity}
            reveal={380 * laserIntensity}
            heat={1.5 * laserIntensity}
            shimmer={14 * laserIntensity}
            sparkle={0.35 * laserIntensity}
            reactivity={1.3}
            className="w-full h-full"
          >
            <div className="w-full h-full" />
          </Laser>
        </div>

        {/* ══════════════════════════════
            ROW 1 — HEADER (Responsive & Horizontally Scrollable on Mobile)
        ══════════════════════════════ */}
        <header
          style={{
            borderBottom: "1px solid #1e1e30",
            background: "rgba(6,6,10,0.97)",
            backdropFilter: "blur(20px)",
          }}
          className="console-header shrink-0 h-[40px] sm:h-[44px] flex items-center justify-between px-2 sm:px-4 z-20 overflow-x-auto no-scrollbar gap-2"
        >
          {/* Brand */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="relative flex items-center justify-center">
              <Image
                src="/e_logo_music.png"
                width={36}
                height={36}
                alt="AutoParty logo"
                className="w-8 h-8 sm:w-9 sm:h-9 object-contain drop-shadow-[0_0_12px_rgba(255,165,0,0.45)]"
              />
              {anyPlaying && (
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#00ff88] animate-pulse shadow-[0_0_8px_#00ff88]" />
              )}
            </div>
            <div className="leading-none">
              <div className="font-mono text-[14px] sm:text-[16px] font-black tracking-[2px] sm:tracking-[3px] text-white flex items-center gap-1">
                AutoParty <span className="text-[9px] sm:text-[10px] text-[#ff6b00] tracking-widest font-mono">FREE</span>
              </div>
              <div className="font-mono text-[7px] sm:text-[8px] text-text-muted tracking-wide mt-0.5">Your music. Party on.</div>
            </div>
          </div>

          {/* Center status (Desktop / Wide screen display) */}
          <div className="console-header-status hidden md:flex items-center gap-4 lg:gap-7 shrink-0">
            <div id="audio-engine-indicator" data-state={audioState} aria-label={`Audio engine: ${audioState}`} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full transition-all duration-300 ${audioPlaying ? "bg-[#00ff88] shadow-[0_0_8px_#00ff88]" : "bg-[#555570]"}`} />
              <span className="font-mono text-[9.5px] tracking-wider uppercase font-bold" style={{ color: audioPlaying ? "#00ff88" : "#8888a0" }}>Audio Engine</span>
            </div>
            <div className="flex items-center gap-2">
              <Cpu size={12} className="text-text-muted" />
              <span className="font-mono text-[9.5px] text-text-muted tracking-wider font-bold">{getAudioEngine().ctx ? `${Math.round((getAudioEngine().ctx?.baseLatency || 0) * 1000)} ms` : "—"}</span>
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

          {/* Right actions (All buttons preserved) */}
          <div aria-label="Acciones de la consola" role="toolbar" className="console-actions flex gap-1.5 sm:gap-2.5 items-center shrink-0">
            {/* Library toggle */}
            <button
              id="library-toggle-btn"
              ref={libraryTriggerRef}
              aria-label={isLibraryOpen ? "Hide library" : "Show library"}
              aria-expanded={isLibraryOpen}
              aria-controls="media-library-drawer"
              onClick={() => { libraryReturnRef.current = libraryTriggerRef.current; setIsLibraryOpen(!isLibraryOpen); }}
              style={{
                borderColor: isLibraryOpen ? "#ff6b00" : "#28283d",
                color: isLibraryOpen ? "#ff6b00" : "#9999b0",
                backgroundColor: isLibraryOpen ? "#ff6b001a" : "transparent",
                boxShadow: isLibraryOpen ? "0 0 14px rgba(255,107,0,0.35)" : "none",
              }}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-mono font-black tracking-wider rounded-lg border cursor-pointer uppercase transition-all shrink-0"
            >
              <Music size={11} />
              <span>Library</span>
            </button>

            {/* AI Auto DJ */}
            <button aria-pressed={partyMode} onClick={() => setPartyMode(!partyMode)} className="px-3 py-2 border border-[#00ff88] rounded-lg text-[#00ff88] text-xs font-bold shrink-0">{partyMode ? "Manual console" : "Party mode"}</button>
            {!partyMode && <AIAutoDJButton />}

            {/* VJ Mini Player */}
            <VJMiniPlayer />

            {/* Record */}
            <button
              id="record-btn"
              onClick={handleRecordToggle}
              style={{
                borderColor: isRecording ? "#ff3355" : "#28283d",
                color: isRecording ? "#ff3355" : "#9999b0",
                backgroundColor: isRecording ? "#ff335518" : "transparent",
              }}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-mono font-black tracking-wider rounded-lg border cursor-pointer uppercase transition-all shrink-0"
            >
              <span className={`w-2 h-2 rounded-full ${isRecording ? "bg-red-custom animate-pulse shadow-[0_0_8px_#ff3355]" : "bg-[#35354c]"}`} />
              <span>{isRecording ? "REC" : "Rec"}</span>
            </button>

          </div>
            {/* Settings */}
            <button
              id="settings-btn"
              aria-label="Open settings"
              onClick={() => useSettingsStore.getState().setIsOpen(true)}
              style={{
                borderColor: "#28283d",
                color: "#8888a0",
                backgroundColor: "transparent",
              }}
              className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg border cursor-pointer hover:border-[#ff6b00] hover:text-white hover:bg-[#ff6b0015] transition-all shrink-0"
              title="Settings"
            >
              <Settings size={12} />
            </button>
        </header>

        {/* ══════════════════════════════
            MOBILE PORTRAIT DECK SWITCHER (Portrait screens below 1024px)
        ══════════════════════════════ */}
        {isPortraitMode && !partyMode && (
          <div onKeyDown={(event) => {
            const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
            const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
            if (current < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
            tabs[next].click();
            tabs[next].focus();
          }} aria-label="Panel de la consola" role="tablist" className="console-tabs flex items-center justify-center gap-1.5 px-2 py-1 bg-[#0a0a10] border-b border-[#1e1e2e] shrink-0 z-20">
            <button
              role="tab"
              aria-selected={selectedMobileDeck === "A"}
              aria-controls="console-panel-A"
              onClick={() => setSelectedMobileDeck("A")}
              className={`flex-1 py-1 text-[10px] font-mono font-black tracking-wider rounded-md border uppercase transition-all cursor-pointer ${
                selectedMobileDeck === "A"
                  ? "bg-[#ff6b00] text-black border-[#ff6b00] shadow-[0_0_12px_rgba(255,107,0,0.5)]"
                  : "bg-[#141420] text-[#ff6b00] border-[#ff6b00]40 hover:bg-[#ff6b00]15"
              }`}
            >
              DECK A
            </button>
            <button
              role="tab"
              aria-selected={selectedMobileDeck === "MIXER"}
              aria-controls="console-panel-MIXER"
              onClick={() => setSelectedMobileDeck("MIXER")}
              className={`flex-1 py-1 text-[10px] font-mono font-black tracking-wider rounded-md border uppercase transition-all cursor-pointer ${
                selectedMobileDeck === "MIXER"
                  ? "bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.4)]"
                  : "bg-[#141420] text-[#a0a0c0] border-[#2e2e40] hover:bg-white/10"
              }`}
            >
              MIXER
            </button>
            <button
              role="tab"
              aria-selected={selectedMobileDeck === "B"}
              aria-controls="console-panel-B"
              onClick={() => setSelectedMobileDeck("B")}
              className={`flex-1 py-1 text-[10px] font-mono font-black tracking-wider rounded-md border uppercase transition-all cursor-pointer ${
                selectedMobileDeck === "B"
                  ? "bg-[#00d4ff] text-black border-[#00d4ff] shadow-[0_0_12px_rgba(0,212,255,0.5)]"
                  : "bg-[#141420] text-[#00d4ff] border-[#00d4ff]40 hover:bg-[#00d4ff]15"
              }`}
            >
              DECK B
            </button>
          </div>
        )}

        {/* ══════════════════════════════
            ROW 2 — CONSOLE CONTENT (Side-by-Side in Landscape & Desktop, Tabbed in Mobile Portrait)
        ══════════════════════════════ */}
        <main
          className="console-main relative z-20 min-w-0 min-h-0 flex-1"
          data-party={partyMode}
        >
          {partyMode && <PartyPanel />}
          <section id="console-panel-A" aria-label="Deck A" className="console-slot console-deck-slot" data-active={selectedMobileDeck === "A"}>
            <DeckPanel deckId="A" color="#ff6b00" isLibraryOpen={false} />
          </section>
          <section id="console-panel-MIXER" aria-label="Master mixer" className="console-slot console-mixer-slot" data-active={selectedMobileDeck === "MIXER"}>
            <MixerCenter isLibraryOpen={false} />
          </section>
          <section id="console-panel-B" aria-label="Deck B" className="console-slot console-deck-slot" data-active={selectedMobileDeck === "B"}>
            <DeckPanel deckId="B" color="#00d4ff" isLibraryOpen={false} />
          </section>
        </main>

        {/* ══════════════════════════════
            MEDIA LIBRARY DRAWER
        ══════════════════════════════ */}
        <LibraryDrawer open={isLibraryOpen} onOpenChange={setIsLibraryOpen} triggerRef={libraryReturnRef}>
          <LibraryPanel />
        </LibraryDrawer>

        {/* ══════════════════════════════
            ROW 4 — STATUS BAR (Scrollable on small devices)
        ══════════════════════════════ */}
        <footer
          style={{
            background: "rgba(4,4,7,0.98)",
            borderTop: "1px solid #1e1e30",
          }}
          className="shrink-0 h-[24px] sm:h-[28px] flex items-center justify-between px-2 sm:px-4 z-20 overflow-x-auto no-scrollbar gap-4 text-nowrap"
        >
          <div className="flex gap-4 sm:gap-7 items-center shrink-0">
            {[
              { label: "Master BPM", value: masterBpm.toFixed(1), color: "#ffffff" },
              { label: "Key A", value: deckA.track?.key || "—", color: "#ff6b00" },
              { label: "Key B", value: deckB.track?.key || "—", color: "#00d4ff" },
              { label: "Harmonic", value: "Not analyzed", color: "#9999b0" },
              { label: "Latency", value: "—", color: "#9999b0" },
              { label: "Buffer", value: "Auto", color: "#9999b0" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex gap-1 items-baseline shrink-0">
                <span className="font-mono text-[8px] sm:text-[9px] text-text-muted uppercase tracking-wider font-bold">{label}:</span>
                <span className="font-mono text-[9.5px] sm:text-[10.5px] font-black" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            {isRecording && (
              <div className="flex items-center gap-1.5 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-red-custom shadow-[0_0_8px_#ff3355]" />
                <span className="font-mono text-[8px] sm:text-[9px] text-red-custom font-black uppercase tracking-wider">Recording</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Radio size={10} className={audioPlaying ? "text-[#00ff88]" : "text-[#555570]"} />
              <span className={`font-mono text-[8px] sm:text-[9px] font-black tracking-widest uppercase transition-colors ${audioPlaying ? "text-[#00ff88]" : "text-[#555570]"}`}>
                {audioPlaying ? "Audio Engine Playing" : isAudioReady ? "Audio Engine Ready" : "Audio Engine Suspended"}
              </span>
            </div>
          </div>
        </footer>
      </div>

      <AIConnectionModal />
      <AIPointer onLibraryChange={setIsLibraryOpen} returnRef={libraryReturnRef} />
      <SettingsModal />
    </>
  );
}
