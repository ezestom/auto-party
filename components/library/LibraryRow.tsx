"use client";

import { useState, useEffect } from "react";
import { useDeckStore, TrackMetadata } from "../../stores/deckStore";
import { db } from "../../lib/db/dexie";
import { getAudioEngine } from "../../lib/audio/AudioEngine";
import { useMixerStore } from "../../stores/mixerStore";
import { Music, Check, Loader2, Lock } from "lucide-react";

interface LibraryRowProps {
  track: TrackMetadata;
  index?: number;
}

export default function LibraryRow({ track, index }: LibraryRowProps) {
  const deckA = useDeckStore((state) => state.decks.A);
  const deckB = useDeckStore((state) => state.decks.B);
  const { setTrack } = useDeckStore();

  const [confirmA, setConfirmA] = useState(false);
  const [confirmB, setConfirmB] = useState(false);
  const [isLoadingA, setIsLoadingA] = useState(false);
  const [isLoadingB, setIsLoadingB] = useState(false);

  // Auto-dismiss confirmation after 3.0s (Stage 7.2 Safety confirmation window)
  useEffect(() => {
    if (confirmA) {
      const id = setTimeout(() => setConfirmA(false), 3000);
      return () => clearTimeout(id);
    }
  }, [confirmA]);

  useEffect(() => {
    if (confirmB) {
      const id = setTimeout(() => setConfirmB(false), 3000);
      return () => clearTimeout(id);
    }
  }, [confirmB]);

  const loadTrackToDeck = async (deckId: "A" | "B") => {
    const setIsLoading = deckId === "A" ? setIsLoadingA : setIsLoadingB;
    setIsLoading(true);
    const startLoadTime = performance.now();

    try {
      const engine = getAudioEngine();
      // Ensure context is initialized/resumed
      await engine.resume();

      // 1. Terminate the active deck source immediately
      engine.stop(deckId);

      // 2. Fetch track from IndexedDB (including audioData and pre-computed peaks)
      const dbTrack = await db.tracks.get(track.id);

      if (dbTrack && dbTrack.audioData && dbTrack.audioData.byteLength > 0) {
        // 3. Decode the binary audio data ArrayBuffer
        if (engine.ctx) {
          // Slice the ArrayBuffer to avoid consumption error
          const audioBuffer = await engine.ctx.decodeAudioData(dbTrack.audioData.slice(0));
          engine.loadTrack(deckId, audioBuffer);
        }
      } else {
        // Fallback: Clear loaded buffer (simulated synth fallback will run if played)
        engine.deckBuffers[deckId] = null;
      }

      // 4. Update deck state store (resets progress, time, cues, isPlaying = false)
      setTrack(deckId, track);

      // 5. Apply auto-gain correction if available
      if (dbTrack?.gainCorrection) {
        const normalizedGain = Math.max(0, Math.min(1, 0.75 * dbTrack.gainCorrection));
        useMixerStore.getState().setChannelGain(deckId, normalizedGain);
      }

      // 6. Fetch and restore saved hot cues and loops from IndexedDB
      const savedCues = await db.hotCues.where("trackId").equals(track.id).toArray();
      const savedLoops = await db.loops.where("trackId").equals(track.id).toArray();

      const { setHotCue } = useDeckStore.getState();
      savedCues.forEach((cue) => {
        setHotCue(deckId, cue.index, cue.time, cue.color);
      });

      if (savedLoops.length > 0) {
        const savedLoop = savedLoops[0];
        useDeckStore.setState((state) => {
          const deck = state.decks[deckId];
          return {
            decks: {
              ...state.decks,
              [deckId]: {
                ...deck,
                loopActive: true,
                loopLength: savedLoop.length,
                loopStart: savedLoop.time,
              },
            },
          };
        });
      }

      const totalLoadTime = performance.now() - startLoadTime;
      console.log(`[REQ-015a] Loaded track "${track.title}" onto Deck ${deckId} in ${totalLoadTime.toFixed(1)}ms`);
    } catch (err) {
      console.error(`Failed to load track to deck ${deckId}:`, err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadA = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoadingA) return;
    
    // Safety check: deck is currently playing
    if (deckA.isPlaying) {
      if (!confirmA) {
        setConfirmA(true);
        return;
      }
    }
    
    loadTrackToDeck("A");
    setConfirmA(false);
  };

  const handleLoadB = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoadingB) return;

    // Safety check: deck is currently playing
    if (deckB.isPlaying) {
      if (!confirmB) {
        setConfirmB(true);
        return;
      }
    }

    loadTrackToDeck("B");
    setConfirmB(false);
  };

  const isLoadedA = deckA.track?.id === track.id;
  const isLoadedB = deckB.track?.id === track.id;

  // Active playing track reference for harmonic matching
  const activePlayingTrack = deckA.isPlaying && deckA.track ? deckA.track : deckB.isPlaying && deckB.track ? deckB.track : null;

  // Camelot Wheel harmonic compatibility check
  let isHarmonicMatch = false;
  let isBpmMatch = false;

  if (activePlayingTrack && activePlayingTrack.id !== track.id) {
    const parseCamelot = (k: string) => {
      const match = k.match(/^(\d{1,2})([AB])$/i);
      if (!match) return null;
      return { num: parseInt(match[1], 10), letter: match[2].toUpperCase() };
    };

    const targetKey = parseCamelot(track.key);
    const sourceKey = parseCamelot(activePlayingTrack.key);

    if (targetKey && sourceKey) {
      const numDiff = Math.abs(targetKey.num - sourceKey.num);
      const isWrap = (targetKey.num === 1 && sourceKey.num === 12) || (targetKey.num === 12 && sourceKey.num === 1);
      const isAdjacentNum = numDiff === 1 || isWrap;

      if (targetKey.letter === sourceKey.letter) {
        isHarmonicMatch = targetKey.num === sourceKey.num || isAdjacentNum;
      } else {
        isHarmonicMatch = targetKey.num === sourceKey.num; // Relative Major/Minor
      }
    }

    // BPM within 6% (standard DJ pitch range)
    isBpmMatch = Math.abs(track.bpm - activePlayingTrack.bpm) <= activePlayingTrack.bpm * 0.06;
  }

  const isPerfectMatch = isHarmonicMatch && isBpmMatch;

  const formattedDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/json", JSON.stringify(track));
        e.dataTransfer.setData("text/plain", track.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      className="grid grid-cols-12 gap-2 items-center py-1 px-3 hover:bg-[#161622] transition-colors duration-100 border-b border-[#1b1b28] text-xs select-none min-h-[34px] cursor-grab active:cursor-grabbing"
    >
      {/* # and Artwork */}
      <div className="col-span-1 flex items-center gap-2">
        <span className="font-mono text-[9px] text-[#555570] w-4 text-center font-bold">
          {index !== undefined ? index + 1 : ""}
        </span>
        <div className="relative w-6 h-6 rounded bg-gradient-to-br from-[#2a2a35] to-[#121218] flex items-center justify-center border border-[#252538] shrink-0">
          <Music size={10} className="text-[#666680]" />
          {isLoadedA && (
            <div className="absolute top-0 left-0 w-1.5 h-1.5 rounded-full bg-[#ff6b00] animate-pulse" />
          )}
          {isLoadedB && (
            <div className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-pulse" />
          )}
        </div>
      </div>

      {/* Track Title */}
      <div className="col-span-4 min-w-0 pr-2">
        <div className="font-display font-bold text-white text-[12px] truncate leading-tight">
          {track.title}
        </div>
      </div>

      {/* Artist */}
      <div className="col-span-3 min-w-0 pr-2">
        <div className="font-mono text-[10px] text-[#9999b0] truncate">
          {track.artist}
        </div>
      </div>

      {/* BPM */}
      <div className="col-span-1 text-center font-mono text-[10.5px] font-extrabold text-white">
        {track.bpm.toFixed(0)}
      </div>

      {/* Key & Match Indicator */}
      <div className="col-span-1 text-center flex items-center justify-center gap-1">
        <span
          style={{
            borderColor: isPerfectMatch ? "#00ff88" : isHarmonicMatch ? "#00d4ff" : "#00d4ff40",
            backgroundColor: isPerfectMatch ? "#00ff8825" : isHarmonicMatch ? "#00d4ff15" : "#00d4ff15",
            color: isPerfectMatch ? "#00ff88" : "#00d4ff",
            boxShadow: isPerfectMatch ? "0 0 10px rgba(0,255,136,0.4)" : "none",
          }}
          className={`font-mono text-[9.5px] font-black px-1.5 py-0.5 rounded border transition-all ${
            isPerfectMatch ? "animate-pulse" : ""
          }`}
          title={isPerfectMatch ? "Perfect Harmonic & BPM Match!" : isHarmonicMatch ? "Harmonic Key Match" : `Camelot Key: ${track.key}`}
        >
          {track.key}
        </span>
      </div>

      {/* Duration */}
      <div className="col-span-1 text-center font-mono text-[10px] text-[#8888a0]">
        {formattedDuration(track.duration)}
      </div>

      {/* Load buttons */}
      <div className="col-span-1 flex items-center justify-end gap-1 shrink-0">
        {/* Load A */}
        <button
          onClick={handleLoadA}
          disabled={isLoadingA}
          style={{
            borderColor: confirmA ? "#ff3355" : isLoadedA ? "#ff6b00" : "#ff6b0070",
            backgroundColor: confirmA ? "#ff335520" : isLoadedA ? "#ff6b0020" : "transparent",
            color: confirmA ? "#ff3355" : "#ff6b00",
            boxShadow: isLoadedA ? "0 0 6px rgba(255,107,0,0.3)" : "none",
          }}
          className={`w-9 h-5 text-[8px] font-mono font-black rounded border tracking-wide cursor-pointer transition-all duration-150 flex items-center justify-center uppercase hover:bg-[#ff6b0015] ${
            confirmA ? "animate-pulse" : ""
          }`}
          title="Load to Deck A"
        >
          {isLoadingA ? (
            <Loader2 size={8} className="animate-spin text-orange" />
          ) : confirmA ? (
            <Lock size={8} className="stroke-[2.5px]" />
          ) : isLoadedA ? (
            <Check size={8} className="stroke-[3px]" />
          ) : (
            "A"
          )}
        </button>

        {/* Load B */}
        <button
          onClick={handleLoadB}
          disabled={isLoadingB}
          style={{
            borderColor: confirmB ? "#ff3355" : isLoadedB ? "#00d4ff" : "#00d4ff70",
            backgroundColor: confirmB ? "#ff335520" : isLoadedB ? "#00d4ff20" : "transparent",
            color: confirmB ? "#ff3355" : "#00d4ff",
            boxShadow: isLoadedB ? "0 0 6px rgba(0,212,255,0.3)" : "none",
          }}
          className={`w-9 h-5 text-[8px] font-mono font-black rounded border tracking-wide cursor-pointer transition-all duration-150 flex items-center justify-center uppercase hover:bg-[#00d4ff15] ${
            confirmB ? "animate-pulse" : ""
          }`}
          title="Load to Deck B"
        >
          {isLoadingB ? (
            <Loader2 size={8} className="animate-spin text-cyan-custom" />
          ) : confirmB ? (
            <Lock size={8} className="stroke-[2.5px]" />
          ) : isLoadedB ? (
            <Check size={8} className="stroke-[3px]" />
          ) : (
            "B"
          )}
        </button>
      </div>
    </div>
  );
}
