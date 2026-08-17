"use client";

import { useEffect, useRef, useState } from "react";
import Fader from "../ui/Fader";
import { useMixerStore } from "../../stores/mixerStore";
import { useDeckStore } from "../../stores/deckStore";
import { Zap, RotateCcw } from "lucide-react";

interface MixerCenterProps {
  isLibraryOpen?: boolean;
}

export default function MixerCenter({ isLibraryOpen = true }: MixerCenterProps) {
  const {
    crossfader, masterVolume, headphoneVolume, headphoneMix, boothVolume,
    channels, setCrossfader, setMasterVolume, setHeadphoneVolume,
    setHeadphoneMix, setBoothVolume, toggleCue,
    isAutoCrossfading, autoTarget, autoDuration,
    triggerAutoCrossfade, stopAutoCrossfade, setAutoDuration,
  } = useMixerStore();

  const deckA = useDeckStore((s) => s.decks.A);
  const deckB = useDeckStore((s) => s.decks.B);

  // Local state for Beat FX & Crossfader Curve
  const [activeFx, setActiveFx] = useState<string>("ECHO");
  const [fxDepth, setFxDepth] = useState<number>(0.5);
  const [fxRate, setFxRate] = useState<number>(0.5);
  const [crossfaderCurve, setCrossfaderCurve] = useState<"CUT" | "LIN" | "CRV">("LIN");

  const lastAnimTimeRef = useRef(performance.now());
  const animFrameRef = useRef<number | null>(null);

  const faderHeight = isLibraryOpen ? 110 : 160;
  const faderLen = isLibraryOpen ? 95 : 140;

  // 60FPS Auto-Crossfade Interpolation Animation Loop
  useEffect(() => {
    if (!isAutoCrossfading || !autoTarget) return;

    lastAnimTimeRef.current = performance.now();

    const stepAutoCrossfade = () => {
      const now = performance.now();
      const dt = Math.min((now - lastAnimTimeRef.current) / 1000, 0.1);
      lastAnimTimeRef.current = now;

      const currentCross = useMixerStore.getState().crossfader;
      const targetCross = autoTarget === "A" ? 0.0 : 1.0;
      const speed = 1 / Math.max(0.5, autoDuration);

      if (Math.abs(currentCross - targetCross) < 0.005) {
        setCrossfader(targetCross);
        stopAutoCrossfade();
        return;
      }

      const direction = autoTarget === "A" ? -1 : 1;
      const nextVal = Math.max(0, Math.min(1, currentCross + direction * speed * dt));
      setCrossfader(nextVal);

      animFrameRef.current = requestAnimationFrame(stepAutoCrossfade);
    };

    animFrameRef.current = requestAnimationFrame(stepAutoCrossfade);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isAutoCrossfading, autoTarget, autoDuration, setCrossfader, stopAutoCrossfade]);

  const handleManualCrossfader = (val: number) => {
    if (isAutoCrossfading) stopAutoCrossfade();
    setCrossfader(val);
  };

  const FX_LIST = ["ECHO", "REVERB", "FLNGR", "FILTER", "CRUSH"];
  const crossColor = crossfader < 0.45 ? "#ff6b00" : crossfader > 0.55 ? "#00d4ff" : "#ffffff";

  return (
    <div
      className="h-full flex flex-col overflow-hidden rounded-2xl select-none transition-all duration-300"
      style={{
        width: 230,
        border: "1px solid #222234",
        background: "linear-gradient(180deg, #12121e 0%, #0a0a12 100%)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-center px-3 py-2.5 shrink-0"
        style={{
          borderBottom: "1px solid #222234",
          background: "linear-gradient(135deg, #ff6b001a 0%, transparent 60%)",
        }}
      >
        <span className="font-mono text-[11px] font-black tracking-[4px] text-text-muted uppercase">MASTER MIXER</span>
      </div>

      {/* Master faders + VU */}
      <div className="flex gap-3.5 items-center justify-center px-3.5 pt-2 pb-1 shrink-0 transition-all duration-300" style={{ height: faderHeight }}>
        <div className="flex flex-col items-center gap-1 h-full">
          <Fader value={masterVolume} onChange={setMasterVolume} vertical length={faderLen} color="#ff6b00" label="Mst" defaultValue={1.0} />
        </div>
        <div className="flex flex-col items-center gap-1 h-full">
          <Fader value={headphoneMix} onChange={setHeadphoneMix} vertical length={faderLen} color="#9999b5" label="PFL" defaultValue={0.5} />
        </div>
        {/* VU meter */}
        <div className="flex gap-2 items-end justify-center px-1 h-full pb-2">
          {["A", "B"].map((chId) => {
            const ch = channels[chId as "A" | "B"];
            const level = ch.vuL;
            const isClipping = ch.clipL || level >= 1.0;
            return (
              <div key={chId} className="flex flex-col-reverse gap-0.5 h-full justify-center">
                {Array.from({ length: 12 }).map((_, i) => {
                  const isRed = i === 11;
                  const isYel = i >= 9 && i < 11;
                  const on = isRed ? isClipping : level > i / 11;
                  const sc = isRed ? "#ff3355" : isYel ? "#ffd600" : (chId === "A" ? "#ff6b00" : "#00d4ff");
                  return (
                    <div
                      key={i}
                      style={{
                        backgroundColor: on ? sc : "#1a1a28",
                        boxShadow: on ? `0 0 6px ${sc}ee` : "none",
                        width: 8,
                        height: isRed ? 7 : 6,
                      }}
                      className="rounded-sm transition-all duration-75"
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3.5 h-px bg-[#222234] shrink-0" />

      {/* Beat FX */}
      <div className="px-3.5 py-1.5 shrink-0">
        <span className="font-mono text-[9px] text-white tracking-widest text-center block uppercase mb-1 font-black">Beat FX</span>
        <div className="flex flex-wrap gap-1 justify-center">
          {FX_LIST.map((f) => {
            const isActive = f === activeFx;
            return (
              <button
                key={f}
                onClick={() => setActiveFx(f)}
                style={{
                  borderColor: isActive ? "#ff6b00" : "#2a2a3d",
                  color: isActive ? "#ff6b00" : "#8888a0",
                  backgroundColor: isActive ? "#ff6b0020" : "transparent",
                  boxShadow: isActive ? "0 0 10px rgba(255,107,0,0.3)" : "none",
                }}
                className="px-2 py-0.5 text-[8.5px] font-mono font-black rounded-md border cursor-pointer tracking-wider hover:text-white transition-all"
              >
                {f}
              </button>
            );
          })}
        </div>
        <div className="flex gap-4 justify-center items-center mt-1.5 transition-all duration-300" style={{ height: faderHeight }}>
          <Fader value={fxDepth} onChange={setFxDepth} label="Depth" color="#ff6b00" vertical length={faderLen} defaultValue={0.5} />
          <Fader value={fxRate} onChange={setFxRate} label="Rate" color="#ff6b00" vertical length={faderLen} defaultValue={0.5} />
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3.5 h-px bg-[#222234] shrink-0" />

      {/* Crossfader & Auto Crossfader Control Section */}
      <div className="flex flex-col items-center gap-1 px-3.5 py-1.5 shrink-0 w-full">
        <div className="flex justify-between w-full font-mono text-[12px] font-black px-0.5">
          <span style={{ color: "#ff6b00" }}>A</span>
          <span className="font-mono text-[9.5px] text-white tracking-widest uppercase mt-0.5 font-black flex items-center gap-1">
            {isAutoCrossfading && <Zap size={10} className="text-[#00ff88] animate-pulse" />}
            Crossfader
          </span>
          <span style={{ color: "#00d4ff" }}>B</span>
        </div>

        <Fader value={crossfader} onChange={handleManualCrossfader} vertical={false} length={195} color={crossColor} />

        {/* Auto Crossfader Controls */}
        <div className="flex items-center gap-1 w-full mt-1">
          {/* AUTO A BUTTON */}
          <button
            onClick={() => {
              if (isAutoCrossfading && autoTarget === "A") stopAutoCrossfade();
              else triggerAutoCrossfade("A");
            }}
            className="flex-1 py-1 px-1 font-mono text-[8.5px] font-black rounded-md border cursor-pointer uppercase transition-all flex items-center justify-center gap-0.5"
            style={{
              borderColor: isAutoCrossfading && autoTarget === "A" ? "#ff6b00" : "#2a2a3d",
              color: isAutoCrossfading && autoTarget === "A" ? "#ffffff" : "#ff6b00",
              backgroundColor: isAutoCrossfading && autoTarget === "A" ? "#ff6b00" : "#ff6b0015",
              boxShadow: isAutoCrossfading && autoTarget === "A" ? "0 0 10px rgba(255,107,0,0.6)" : "none",
            }}
            title="Auto Crossfade smoothly to Deck A"
          >
            ◀ AUTO A
          </button>

          {/* DURATION TOGGLE (2s / 4s / 8s / 16s) */}
          <button
            onClick={() => {
              const durations = [2, 4, 8, 16];
              const idx = durations.indexOf(autoDuration);
              const next = durations[(idx + 1) % durations.length];
              setAutoDuration(next);
            }}
            className="px-1.5 py-1 font-mono text-[8.5px] font-black rounded-md border border-[#2a2a3d] text-[#aaaacc] bg-[#161624] hover:text-white transition-all cursor-pointer"
            title="Click to change Auto-Crossfade time (2s, 4s, 8s, 16s)"
          >
            {autoDuration}s
          </button>

          {/* AUTO B BUTTON */}
          <button
            onClick={() => {
              if (isAutoCrossfading && autoTarget === "B") stopAutoCrossfade();
              else triggerAutoCrossfade("B");
            }}
            className="flex-1 py-1 px-1 font-mono text-[8.5px] font-black rounded-md border cursor-pointer uppercase transition-all flex items-center justify-center gap-0.5"
            style={{
              borderColor: isAutoCrossfading && autoTarget === "B" ? "#00d4ff" : "#2a2a3d",
              color: isAutoCrossfading && autoTarget === "B" ? "#ffffff" : "#00d4ff",
              backgroundColor: isAutoCrossfading && autoTarget === "B" ? "#00d4ff" : "#00d4ff15",
              boxShadow: isAutoCrossfading && autoTarget === "B" ? "0 0 10px rgba(0,212,255,0.6)" : "none",
            }}
            title="Auto Crossfade smoothly to Deck B"
          >
            AUTO B ▶
          </button>
        </div>

        {/* Crossfader Curve Buttons */}
        <div className="flex gap-1.5 mt-0.5 w-full">
          {(["CUT", "LIN", "CRV"] as const).map((c) => {
            const isSelected = crossfaderCurve === c;
            return (
              <button
                key={c}
                onClick={() => setCrossfaderCurve(c)}
                style={{
                  borderColor: isSelected ? "#ff6b00" : "#2a2a3d",
                  color: isSelected ? "#ff6b00" : "#777790",
                  backgroundColor: isSelected ? "#ff6b0015" : "transparent",
                  boxShadow: isSelected ? "0 0 8px rgba(255,107,0,0.3)" : "none",
                }}
                className="flex-1 px-1.5 py-0.5 text-[8.5px] font-mono font-black border rounded-md cursor-pointer tracking-wider hover:text-white transition-colors"
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3.5 h-px bg-[#222234] shrink-0" />

      {/* Booth + Headphone Cue Faders */}
      <div className="flex gap-5 justify-center items-center px-3.5 py-1.5 shrink-0" style={{ height: 110 }}>
        <Fader value={boothVolume} onChange={setBoothVolume} label="Booth" color="#ff6b00" vertical length={95} />
        <Fader value={headphoneVolume} onChange={setHeadphoneVolume} label="Cue Vol" color="#ff6b00" vertical length={95} />
      </div>

      {/* Cue buttons */}
      <div className="flex gap-2 px-3.5 pb-2.5 shrink-0">
        <button
          onClick={() => toggleCue("A")}
          style={{
            borderColor: channels.A.cueActive ? "#ff6b00" : "#2a2a3d",
            color: channels.A.cueActive ? "#ff6b00" : "#777790",
            backgroundColor: channels.A.cueActive ? "#ff6b0020" : "transparent",
            boxShadow: channels.A.cueActive ? "0 0 12px rgba(255,107,0,0.35)" : "none",
          }}
          className="flex-1 py-2 text-[10px] font-mono font-black tracking-widest rounded-lg border cursor-pointer uppercase hover:text-white transition-all"
        >
          CUE A
        </button>
        <button
          onClick={() => toggleCue("B")}
          style={{
            borderColor: channels.B.cueActive ? "#00d4ff" : "#2a2a3d",
            color: channels.B.cueActive ? "#00d4ff" : "#777790",
            backgroundColor: channels.B.cueActive ? "#00d4ff20" : "transparent",
            boxShadow: channels.B.cueActive ? "0 0 12px rgba(0,212,255,0.35)" : "none",
          }}
          className="flex-1 py-2 text-[10px] font-mono font-black tracking-widest rounded-lg border cursor-pointer uppercase hover:text-white transition-all"
        >
          CUE B
        </button>
      </div>

      {/* BPM Sync section */}
      <div
        className="mt-auto px-3.5 pb-3 pt-2.5 shrink-0"
        style={{ borderTop: "1px solid #222234", background: "rgba(0,0,0,0.35)" }}
      >
        <div className="flex justify-between items-end mb-1.5">
          <div className="flex flex-col items-center">
            <span className="font-mono text-[8.5px] text-white uppercase tracking-wider font-extrabold">A BPM</span>
            <span className="font-mono text-[16px] font-black text-[#ff6b00]">{deckA.bpm.toFixed(1)}</span>
          </div>
          <span className="font-mono text-[12px] text-text-dim pb-1">⇄</span>
          <div className="flex flex-col items-center">
            <span className="font-mono text-[8.5px] text-white uppercase tracking-wider font-extrabold">B BPM</span>
            <span className="font-mono text-[16px] font-black text-[#00d4ff]">{deckB.bpm.toFixed(1)}</span>
          </div>
        </div>
        {/* Delta bar */}
        <div className="relative w-full h-1.5 bg-[#1c1c2e] rounded-full overflow-hidden">
          <div
            className="absolute top-0 bottom-0 left-1/2 rounded-full -translate-x-1/2 transition-all duration-150"
            style={{
              width: `${Math.min(Math.abs(deckA.bpm - deckB.bpm) * 5, 50)}%`,
              backgroundColor: Math.abs(deckA.bpm - deckB.bpm) < 0.1 ? "#00ff88" : "#ffd600",
            }}
          />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/40" />
        </div>
        <span className="font-mono text-[8.5px] text-center block text-white mt-1 tracking-wider font-black">
          {Math.abs(deckA.bpm - deckB.bpm) < 0.1 ? "✓ SYNCED" : `ΔBPM ${Math.abs(deckA.bpm - deckB.bpm).toFixed(1)}`}
        </span>
      </div>
    </div>
  );
}
