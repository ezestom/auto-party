"use client";

import { useState, useEffect } from "react";
import { useDeckStore, TrackMetadata } from "../../stores/deckStore";
import { db } from "../../lib/db/dexie";
import { getAudioEngine } from "../../lib/audio/AudioEngine";
import { Music, Check, Loader2 } from "lucide-react";

interface LibraryRowProps {
  track: TrackMetadata;
}

export default function LibraryRow({ track }: LibraryRowProps) {
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

      // 5. Fetch and restore saved hot cues and loops from IndexedDB
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

  const formattedDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2.5 py-2.5 px-3 hover:bg-[#1a1a24] transition-colors duration-100 border-b border-[#252530] text-xs select-none">
      {/* Artwork disk */}
      <div className="relative w-8 h-8 rounded bg-linear-to-br from-[#2a2a35] to-[#121218] flex items-center justify-center border border-border-custom shrink-0">
        <Music size={12} className="text-text-muted" />
        {isLoadedA && (
          <div className="absolute top-0 left-0 w-1.5 h-1.5 rounded-full bg-[#ff6b00] animate-pulse" />
        )}
        {isLoadedB && (
          <div className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-pulse" />
        )}
      </div>

      {/* Track details (Title/Artist + meta metadata row) */}
      <div className="flex-1 min-w-0">
        <div className="font-display font-semibold text-white truncate leading-tight">
          {track.title}
        </div>
        <div className="flex items-center gap-1.5 mt-1 font-mono text-[9px] text-text-dim">
          <span className="truncate max-w-20">{track.artist}</span>
          <span className="text-text-muted">•</span>
          <span className="text-cyan-custom font-bold">{track.key}</span>
          <span className="text-text-muted">•</span>
          <span className="text-white">{track.bpm.toFixed(0)} BPM</span>
          <span className="text-text-muted">•</span>
          <span>{formattedDuration(track.duration)}</span>
        </div>
      </div>

      {/* Load buttons */}
      <div className="flex gap-1 shrink-0">
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
          className={`w-14 h-5.5 text-[7.5px] font-mono font-black rounded border tracking-wide cursor-pointer transition-all duration-150 flex items-center justify-center uppercase hover:bg-[#ff6b0015] ${
            confirmA ? "animate-pulse" : ""
          }`}
        >
          {isLoadingA ? (
            <Loader2 size={8} className="animate-spin text-orange" />
          ) : confirmA ? (
            "REPLACE?"
          ) : isLoadedA ? (
            <Check size={8} className="stroke-[3px] mr-0.5" />
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
          className={`w-14 h-5.5 text-[7.5px] font-mono font-black rounded border tracking-wide cursor-pointer transition-all duration-150 flex items-center justify-center uppercase hover:bg-[#00d4ff15] ${
            confirmB ? "animate-pulse" : ""
          }`}
        >
          {isLoadingB ? (
            <Loader2 size={8} className="animate-spin text-cyan-custom" />
          ) : confirmB ? (
            "REPLACE?"
          ) : isLoadedB ? (
            <Check size={8} className="stroke-[3px] mr-0.5" />
          ) : (
            "B"
          )}
        </button>
      </div>
    </div>
  );
}
