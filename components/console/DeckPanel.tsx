"use client";

import { useState } from "react";
import { useDeckStore } from "../../stores/deckStore";
import { useMixerStore } from "../../stores/mixerStore";
import TransportBar from "./TransportBar";
import JogWheel from "./JogWheel";
import Fader from "../ui/Fader";
import Waveform from "./Waveform";
import { db } from "../../lib/db/dexie";
import { getAudioEngine } from "../../lib/audio/AudioEngine";
import { SAMPLER_PADS, samplerEngine } from "../../lib/audio/SamplerEngine";
import { RotateCcw } from "lucide-react";

interface DeckPanelProps {
  deckId: "A" | "B";
  color: string;
  isLibraryOpen?: boolean;
}

const PAD_MODES = ["HOT CUE", "LOOP", "ROLL", "SLICER", "SAMPLER", "BEAT JMP"] as const;
type PadMode = (typeof PAD_MODES)[number];

const PAD_COLORS_A = ["#ff6b00", "#ff9500", "#ffcc00", "#ff6b00", "#ff9500", "#ffcc00", "#ff6b00", "#ff9500"];
const PAD_COLORS_B = ["#00d4ff", "#00aaff", "#0077ff", "#00d4ff", "#00aaff", "#0077ff", "#00d4ff", "#00aaff"];

export default function DeckPanel({ deckId, color, isLibraryOpen = true }: DeckPanelProps) {
  const deck = useDeckStore((s) => s.decks[deckId]);
  const { setTempoOffset } = useDeckStore();
  const channel = useMixerStore((s) => s.channels[deckId]);
  const { setEQHi, setEQMid, setEQLo, setChannelGain, setFilter, setChannelVolume } = useMixerStore();
  const [activeMode, setActiveMode] = useState<PadMode>("HOT CUE");
  const [pressedPad, setPressedPad] = useState<number | null>(null);

  const isLeft = deckId === "A";

  const fmt = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const tempoStr = (deck.tempoOffset >= 0 ? "+" : "") + (deck.tempoOffset * 100).toFixed(1) + "%";

  const jogSize = isLibraryOpen ? 220 : 320;
  const faderLen = isLibraryOpen ? 105 : 170;

  const resetTempo = () => {
    setTempoOffset(deckId, 0.0);
  };

  return (
    <div
      className="h-full flex flex-col overflow-hidden rounded-2xl select-none transition-all duration-300 min-w-0 min-h-0"
      style={{
        borderColor: "#222234",
        border: "1px solid #222234",
        background: "linear-gradient(180deg, #12121e 0%, #0a0a12 100%)",
        boxShadow: `0 8px 32px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 24px ${color}10`,
      }}
    >
      {/* ── LCD SCREEN BEZEL ── */}
      <div className={`shrink-0 ${isLibraryOpen ? "px-2.5 pt-1.5 pb-0.5" : "px-3 pt-2.5 pb-1.5"}`}>
        <div
          className="relative rounded-xl overflow-hidden border border-[#28283d]"
          style={{
            background: "linear-gradient(180deg, #0d0d16 0%, #050508 100%)",
            boxShadow: `inset 0 2px 14px rgba(0, 0, 0, 0.95), 0 1px 2px rgba(255, 255, 255, 0.06), 0 0 20px ${color}15`,
          }}
        >
          {/* Glass glare effect */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.05]"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 60%)",
            }}
          />

          {/* Corner Screw Rivets */}
          <div className="absolute top-1.5 left-2 w-1.5 h-1.5 rounded-full bg-neutral-800 border border-neutral-700/60 opacity-40" />
          <div className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-neutral-800 border border-neutral-700/60 opacity-40" />
          <div className="absolute bottom-1.5 left-2 w-1.5 h-1.5 rounded-full bg-neutral-800 border border-neutral-700/60 opacity-40" />
          <div className="absolute bottom-1.5 right-2 w-1.5 h-1.5 rounded-full bg-neutral-800 border border-neutral-700/60 opacity-40" />

          {/* 3-Column Screen Grid */}
          <div className={`grid grid-cols-12 gap-0 relative z-10 items-center ${isLibraryOpen ? "py-1 px-2.5" : "py-2 px-3"}`}>
            
            {/* COLUMN 1: DECK & STATUS LIGHTS */}
            <div className="col-span-3 flex flex-col gap-0.5 border-r border-white/10 pr-2">
              <div className="flex items-center">
                <div className="leading-none min-w-0">
                  <div className="font-mono text-[11.5px] font-black tracking-widest uppercase" style={{ color, textShadow: `0 0 12px ${color}50` }}>
                    DECK {deckId}
                  </div>
                  <div className="font-mono text-[7px] text-text-dim tracking-wider uppercase mt-0.5 font-bold">
                    {deck.isPlaying ? "PLAYING" : deck.track ? "PAUSED" : "STANDBY"}
                  </div>
                </div>
              </div>

              {/* Hardware-style LED Indicators & Key */}
              <div className="flex items-center justify-between mt-0.5 pl-0.5">
                <div className="flex items-center gap-1.5">
                  {/* MST LED */}
                  <div className="flex items-center gap-1">
                    <div
                      className="w-1.5 h-1.5 rounded-full transition-all duration-200"
                      style={{
                        backgroundColor: deck.isMaster ? color : "#1a1a28",
                        boxShadow: deck.isMaster ? `0 0 8px ${color}` : "none",
                        border: "1px solid rgba(0,0,0,0.6)",
                      }}
                    />
                    <span className="font-mono text-[6.5px] text-[#777790] font-black tracking-widest uppercase">MST</span>
                  </div>

                  {/* SYNC LED */}
                  <div className="flex items-center gap-1">
                    <div
                      className="w-1.5 h-1.5 rounded-full transition-all duration-200"
                      style={{
                        backgroundColor: deck.syncActive ? "#00ff88" : "#1a1a28",
                        boxShadow: deck.syncActive ? "0 0 8px #00ff88" : "none",
                        border: "1px solid rgba(0,0,0,0.6)",
                      }}
                    />
                    <span className="font-mono text-[6.5px] text-[#777790] font-black tracking-widest uppercase">SYNC</span>
                  </div>
                </div>

                {/* KEY badge */}
                <div
                  className="font-mono text-[8px] font-extrabold px-1.5 py-[0.5px] border rounded-md"
                  style={{
                    color,
                    backgroundColor: `${color}18`,
                    borderColor: `${color}45`,
                  }}
                >
                  {deck.track ? deck.track.key : deck.key}
                </div>
              </div>
            </div>

            {/* COLUMN 2: TRACK METADATA & TIME DASHBOARD */}
            <div className="col-span-6 flex flex-col items-center px-1.5 text-center min-w-0">
              <span className="font-display text-[13px] font-black text-white truncate w-full leading-none tracking-wide uppercase">
                {deck.track ? deck.track.title : "NO TRACK LOADED"}
              </span>
              <span className="font-mono text-[8px] text-[#a0a0c0] truncate w-full tracking-wider mt-0.5 uppercase font-medium">
                {deck.track ? deck.track.artist : "SELECT FROM LIBRARY"}
              </span>
              
              {/* LCD-style Digital Time Segment */}
              <div className="flex items-center gap-2 mt-0.5 px-2 py-0.5 bg-black/70 rounded-md border border-[#202035] shadow-[inset_0_1px_4px_rgba(0,0,0,0.85)]">
                <span className="font-mono text-[6.5px] text-[#777795] font-extrabold uppercase tracking-wider">ELAPSED</span>
                <span className="font-mono text-[10px] font-extrabold text-white tracking-widest leading-none">
                  {deck.track ? fmt(deck.currentTime) : "0:00"}
                </span>
                <div className="w-px h-2.5 bg-[#252540]" />
                <span className="font-mono text-[6.5px] text-[#777795] font-extrabold uppercase tracking-wider">REMAIN</span>
                <span className="font-mono text-[10px] font-extrabold text-[#ffd600] tracking-widest leading-none">
                  {deck.track ? `-${fmt(deck.track.duration - deck.currentTime)}` : "-0:00"}
                </span>
              </div>
            </div>

            {/* COLUMN 3: BPM & SPEED METRICS */}
            <div className="col-span-3 flex items-center justify-end gap-2 border-l border-white/10 pl-2">
              {/* Pitch % offset display */}
              <div className="flex flex-col items-end leading-none">
                <span className="font-mono text-[9px] font-black text-white tracking-wide">{tempoStr}</span>
                <span className="font-mono text-[6px] text-text-muted font-bold tracking-widest uppercase mt-0.5">PITCH</span>
              </div>

              <div className="w-px h-7 bg-white/10" />

              {/* Large BPM readout */}
              <div className="flex flex-col items-center leading-none">
                <span
                  className="font-mono text-[21px] font-black tracking-tighter leading-none"
                  style={{
                    color,
                    textShadow: `0 0 12px ${color}65`,
                  }}
                >
                  {deck.bpm.toFixed(1)}
                </span>
                <span className="font-mono text-[6px] text-text-muted font-bold tracking-widest uppercase mt-0.5">BPM</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── WAVEFORM ── */}
      <div className={`w-full shrink-0 ${isLibraryOpen ? "my-0.5" : "my-1"}`}>
        <Waveform deckId={deckId} color={color} isLibraryOpen={isLibraryOpen} />
      </div>

      {/* ── PROGRESS SEGMENTS ── */}
      <div className="flex gap-0.5 px-3.5 py-1 shrink-0">
        {Array.from({ length: 48 }).map((_, i) => {
          const active = i / 48 < deck.progress;
          const isCue = i % 16 === 0 && i > 0;
          return (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all duration-100"
              style={{
                height: isCue ? 6 : 4,
                backgroundColor: isCue ? (active ? "#ffd600" : "#2e2e42") : active ? color : "#1e1e2e",
                boxShadow: active ? `0 0 4px ${isCue ? "#ffd600" : color}90` : "none",
              }}
            />
          );
        })}
      </div>

      {/* ── PLATTER AREA (RESPONSIVE FLEX AREA — NO OVERLAP AT ANY ZOOM LEVEL) ── */}
      <div
        className={`flex items-center gap-3 px-3 min-h-0 flex-1 overflow-hidden transition-all duration-300 py-1 ${isLeft ? "flex-row" : "flex-row-reverse"}`}
      >
        {/* Tempo fader */}
        <div className="flex flex-col items-center gap-1.5 w-11 shrink-0 h-full max-h-full justify-center py-0.5 overflow-hidden">
          <div className="flex-1 flex items-center justify-center h-full max-h-full overflow-hidden">
            <Fader
              value={(deck.tempoOffset + 0.16) / 0.32}
              onChange={(val) => setTempoOffset(deckId, -0.16 + val * 0.32)}
              vertical
              length={faderLen}
              color={color}
              label="Tempo"
              defaultValue={0.5}
            />
          </div>
          <button
            onClick={resetTempo}
            title="Click to reset pitch offset to 0.0%"
            className="font-mono text-[8px] font-black px-1 py-0.5 border rounded-md text-center w-full shadow-sm shrink-0 hover:bg-white/10 transition-all cursor-pointer flex items-center justify-center gap-0.5"
            style={{ color, backgroundColor: `${color}18`, borderColor: `${color}45` }}
          >
            {tempoStr}
            <RotateCcw size={7} className="opacity-70" />
          </button>
        </div>

        {/* Jog wheel — RESPONSIVE ASPECT SQUARE (SCALES FLUIDLY TO AVAILABLE SPACE) */}
        <div className="flex-1 flex items-center justify-center min-w-0 h-full max-h-full py-0.5 overflow-hidden transition-all duration-300">
          <JogWheel deckId={deckId} color={color} size={jogSize} />
        </div>

        {/* EQ & Volume Faders group */}
        <div className={`flex items-center gap-1.5 shrink-0 h-full max-h-full overflow-hidden ${isLeft ? "flex-row" : "flex-row-reverse"}`}>
          {/* Linear EQ & Filter Faders Panel */}
          <div className={`flex items-center gap-1 shrink-0 justify-center bg-black/40 rounded-xl border border-[#252538] shadow-inner h-full max-h-full overflow-hidden min-w-0 ${isLibraryOpen ? "py-1 px-2" : "py-1.5 px-3"}`}>
            <Fader value={channel.gain} onChange={(v) => setChannelGain(deckId, v)} label="Gain" color={color} vertical length={faderLen} defaultValue={0.5} />
            <Fader value={channel.eqHi} onChange={(v) => setEQHi(deckId, v)} label="Hi" color={color} vertical length={faderLen} center defaultValue={0.75} />
            <Fader value={channel.eqMid} onChange={(v) => setEQMid(deckId, v)} label="Mid" color={color} vertical length={faderLen} center defaultValue={0.75} />
            <Fader value={channel.eqLo} onChange={(v) => setEQLo(deckId, v)} label="Low" color={color} vertical length={faderLen} center defaultValue={0.75} />
            <Fader value={channel.filter} onChange={(v) => setFilter(deckId, v)} label="Filter" color="#ff0055" vertical length={faderLen} center defaultValue={0.5} />
          </div>

          {/* Channel Volume fader column */}
          <div className={`flex flex-col items-center justify-between w-10 shrink-0 h-full py-0.5 overflow-hidden ${isLeft ? "border-l pl-1.5" : "border-r pr-1.5"} border-[#252538]`}>
            <div className="flex-1 flex items-center justify-center h-full max-h-full overflow-hidden">
              <Fader
                value={channel.volume}
                onChange={(v) => setChannelVolume(deckId, v)}
                vertical
                length={faderLen}
                color={color}
                label={`CH ${deckId}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── TRANSPORT BAR ── */}
      <div className={`shrink-0 ${isLibraryOpen ? "px-2.5 pb-1" : "px-3 pb-2"}`}>
        <TransportBar deckId={deckId} color={color} />
      </div>

      {/* ── PERFORMANCE PADS ── */}
      <div
        className={`shrink-0 ${isLibraryOpen ? "px-2.5 pb-1.5 pt-1" : "px-3 pb-2 pt-1.5"}`}
        style={{ borderTop: "1px solid #222234" }}
      >
        {/* ── PAD MODE TABS ── */}
        <div className={`flex gap-1 ${isLibraryOpen ? "mb-1" : "mb-1.5"}`}>
          {PAD_MODES.map((m) => {
            const isActive = activeMode === m;
            return (
              <button
                key={m}
                onClick={() => setActiveMode(m)}
                className={`pad-mode-tab flex-1 text-center font-mono font-black tracking-tight border rounded-lg cursor-pointer uppercase transition-all duration-150 ${isActive ? "is-active" : ""} ${isLibraryOpen ? "py-0.5" : "py-1"}`}
                style={{
                  fontSize: isLibraryOpen ? "8.5px" : "9.5px",
                  letterSpacing: "0.06em",
                  color: isActive ? "#ffffff" : "#777790",
                  borderColor: isActive ? `${color}90` : "#2a2a3d",
                  backgroundColor: isActive ? `${color}28` : "#161624",
                  boxShadow: isActive
                    ? `0 0 12px ${color}40, inset 0 1px 0 rgba(255,255,255,0.1)`
                    : "inset 0 1px 0 rgba(255,255,255,0.03)",
                  textShadow: isActive ? `0 0 12px ${color}a0` : "none",
                }}
              >
                {m}
              </button>
            );
          })}
        </div>

        {/* ── 1×4 PERFORMANCE PADS ── */}
        <div className={`grid grid-cols-4 ${isLibraryOpen ? "gap-1" : "gap-1.5"}`}>
          {Array.from({ length: 4 }).map((_, i) => {
            const isPressed = pressedPad === i;
            const padColors = deckId === "A" ? PAD_COLORS_A : PAD_COLORS_B;
            
            // Sampler info (Deck A maps 0..3, Deck B maps 4..7)
            const sampleIdx = isLeft ? i : i + 4;
            const sample = SAMPLER_PADS[sampleIdx];

            let padColor = activeMode === "SAMPLER" && sample ? sample.color : padColors[i];

            const hasCue = activeMode === "HOT CUE" && deck.hotCues && deck.hotCues[i];
            const cueColor = hasCue ? deck.hotCues[i]?.color : null;

            const loopLengths = [0.5, 1, 2, 4, 8, 16, 32];
            const isLoopActiveSize = activeMode === "LOOP" && deck.loopActive && deck.loopLength === loopLengths[i] && i < 7;

            // Border styling
            let borderColor = "#2a2a3d";
            if (isPressed) {
              borderColor = "#ffffff";
            } else if (activeMode === "SAMPLER" && sample) {
              borderColor = `${sample.color}70`;
            } else if (hasCue && cueColor) {
              borderColor = cueColor;
            } else if (isLoopActiveSize) {
              borderColor = color;
            }

            // Background styling
            let background = "linear-gradient(145deg, #242436 0%, #181828 40%, #121220 100%)";
            if (isPressed) {
              background = padColor;
            } else if (activeMode === "SAMPLER" && sample) {
              background = `linear-gradient(145deg, ${sample.color}35 0%, ${sample.color}15 60%, #121220 100%)`;
            } else if (hasCue && cueColor) {
              background = `linear-gradient(145deg, ${cueColor}30 0%, ${cueColor}12 60%, #121220 100%)`;
            } else if (isLoopActiveSize) {
              background = `linear-gradient(145deg, ${color}30 0%, ${color}12 60%, #121220 100%)`;
            }

            // Text color
            let textColor = "#9999b5";
            if (isPressed) {
              textColor = "#000000";
            } else if (activeMode === "SAMPLER" && sample) {
              textColor = sample.color;
            } else if (hasCue && cueColor) {
              textColor = cueColor;
            } else if (isLoopActiveSize) {
              textColor = color;
            }

            const handlePadPress = async (e: React.PointerEvent) => {
              setPressedPad(i);

              // 1. SAMPLER MODE: triggers instant synthesized party effect at 0ms latency
              if (activeMode === "SAMPLER" && sample) {
                samplerEngine.trigger(sample.id);
                return;
              }

              if (!deck.track) return;

              const isShift = e.shiftKey;
              const { setHotCue, removeHotCue, setCurrentTime, toggleLoop } = useDeckStore.getState();

              if (activeMode === "HOT CUE") {
                const existing = deck.hotCues[i];
                if (existing) {
                  if (isShift) {
                    removeHotCue(deckId, i);
                    await db.hotCues.where({ trackId: deck.track.id, index: i }).delete();
                  } else {
                    setCurrentTime(deckId, existing.time);
                    if (deck.isPlaying) {
                      getAudioEngine().play(deckId, existing.time);
                    }
                  }
                } else {
                  if (!isShift) {
                    const time = deck.currentTime;
                    setHotCue(deckId, i, time, padColor);
                    await db.hotCues.put({
                      trackId: deck.track.id,
                      index: i,
                      time,
                      color: padColor,
                    });
                  }
                }
              } else if (activeMode === "LOOP") {
                if (i === 7) {
                  if (deck.loopActive) {
                    toggleLoop(deckId, deck.loopLength);
                    await db.loops.where("trackId").equals(deck.track.id).delete();
                  }
                } else {
                  const length = loopLengths[i];
                  const isSameLength = deck.loopActive && deck.loopLength === length;

                  if (isSameLength) {
                    toggleLoop(deckId, length);
                    await db.loops.where("trackId").equals(deck.track.id).delete();
                  } else if (deck.loopActive) {
                    useDeckStore.setState((state) => {
                      const d = state.decks[deckId];
                      return {
                        decks: {
                          ...state.decks,
                          [deckId]: {
                            ...d,
                            loopLength: length,
                          },
                        },
                      };
                    });
                    await db.loops.where("trackId").equals(deck.track.id).delete();
                    if (deck.loopStart !== null) {
                      await db.loops.add({
                        trackId: deck.track.id,
                        time: deck.loopStart,
                        length,
                      });
                    }
                  } else {
                    toggleLoop(deckId, length);
                    const start = deck.currentTime;
                    await db.loops.where("trackId").equals(deck.track.id).delete();
                    await db.loops.add({
                      trackId: deck.track.id,
                      time: start,
                      length,
                    });
                  }
                }
              }
            };

            return (
              <button
                key={i}
                onPointerDown={handlePadPress}
                onPointerUp={() => setPressedPad(null)}
                onPointerLeave={() => setPressedPad(null)}
                className="pad-btn h-9 rounded-xl border flex items-center justify-center font-mono font-black cursor-pointer select-none transition-all duration-75 shadow-md"
                style={{
                  borderColor,
                  background,
                  boxShadow: isPressed
                    ? `0 0 16px ${padColor}a0, inset 0 0 12px ${padColor}60`
                    : activeMode === "SAMPLER"
                    ? `0 0 10px ${padColor}35`
                    : hasCue || isLoopActiveSize
                    ? `0 0 10px ${textColor}40`
                    : "inset 0 1px 0 rgba(255,255,255,0.08), 0 3px 10px rgba(0,0,0,0.65)",
                  transform: isPressed ? "scale(0.95)" : "scale(1)",
                }}
                title={activeMode === "SAMPLER" && sample ? `${sample.label} (${sample.description})` : undefined}
              >
                {activeMode === "SAMPLER" && sample ? (
                  <div className="flex flex-col items-center justify-center leading-none gap-0.5 pointer-events-none">
                    <span className="text-[10px] leading-none">{sample.icon}</span>
                    <span
                      className="text-[7.5px] font-mono font-black tracking-tight"
                      style={{ color: isPressed ? "#000" : textColor }}
                    >
                      {sample.shortLabel}
                    </span>
                  </div>
                ) : (
                  <span
                    className="pad-num"
                    style={{
                      fontSize: "12px",
                      color: textColor,
                      transition: "color 0.05s",
                      userSelect: "none",
                    }}
                  >
                    {i + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
