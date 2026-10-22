"use client";

import { useDeckStore } from "../../stores/deckStore";
import { Play, Pause, RefreshCw, BookmarkPlus, Disc } from "lucide-react";

interface TransportBarProps {
  deckId: "A" | "B";
  color: string;
}

export default function TransportBar({ deckId, color }: TransportBarProps) {
  const deck = useDeckStore((s) => s.decks[deckId]);
  const { setPlaying, toggleSync, triggerCue, setCue } = useDeckStore();

  return (
    <div className="flex gap-2 w-full items-stretch select-none">
      {/* CUE */}
      <button
        id={`cue-btn-${deckId}`}
        onClick={() => { triggerCue(deckId); setPlaying(deckId, false); }}
        disabled={!deck.track}
        className="flex-1 py-1.5 sm:py-2.5 flex flex-col items-center justify-center gap-0.5 sm:gap-1 font-mono font-black text-[8.5px] sm:text-[9.5px] rounded-xl border cursor-pointer hover:brightness-125 uppercase transition-all duration-150 shadow-sm"
        style={{
          borderColor: deck.cuePoint !== null ? color : "#28283c",
          color: deck.cuePoint !== null ? color : "#777790",
          background: deck.cuePoint !== null
            ? `linear-gradient(145deg, ${color}20, ${color}0a)`
            : "linear-gradient(145deg, #1c1c2c, #141420)",
          boxShadow: deck.cuePoint !== null ? `0 0 10px ${color}35` : "none",
        }}
        title="Volver al punto CUE y pausar"
      >
        <Disc size={11} />
        CUE
      </button>

      {/* PLAY/PAUSE — prominent & high visibility */}
      <button
        id={`play-btn-${deckId}`}
        onClick={() => setPlaying(deckId, !deck.isPlaying)}
        className="flex-[2.2] py-1.5 sm:py-2.5 flex items-center justify-center gap-1.5 sm:gap-2 font-mono font-black text-[11px] sm:text-[13px] rounded-xl border cursor-pointer transition-all duration-150 uppercase shadow-md"
        style={{
          backgroundColor: deck.isPlaying ? color : "#1a1a2a",
          borderColor: color,
          color: deck.isPlaying ? "#050508" : color,
          boxShadow: deck.isPlaying ? `0 0 24px ${color}65, 0 4px 16px ${color}40` : `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 8px ${color}25`,
        }}
      >
        {deck.isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
        {deck.isPlaying ? "PAUSE" : "PLAY"}
      </button>

      {/* SYNC */}
      <button
        id={`sync-btn-${deckId}`}
        onClick={() => toggleSync(deckId)}
        className="flex-1 py-1.5 sm:py-2.5 flex flex-col items-center justify-center gap-0.5 sm:gap-1 font-mono font-black text-[8.5px] sm:text-[9.5px] rounded-xl border cursor-pointer hover:brightness-125 uppercase transition-all duration-150 shadow-sm"
        style={{
          borderColor: deck.syncActive ? color : "#28283c",
          color: deck.syncActive ? color : "#777790",
          background: deck.syncActive ? `linear-gradient(145deg, ${color}20, ${color}0a)` : "linear-gradient(145deg, #1c1c2c, #141420)",
          boxShadow: deck.syncActive ? `0 0 10px ${color}35` : "none",
        }}
      >
        <RefreshCw size={11} className={deck.syncActive ? "animate-spin [animation-duration:4s]" : ""} />
        BPM =
      </button>

      {/* KEY */}
      <button
        id={`save-cue-btn-${deckId}`}
        onClick={() => setCue(deckId)}
        disabled={!deck.track}
        title="Guardar la posición actual como CUE y pausar"
        className="flex-1 py-1.5 sm:py-2.5 flex flex-col items-center justify-center gap-0.5 sm:gap-1 font-mono font-black text-[8.5px] sm:text-[9.5px] rounded-xl border cursor-pointer hover:brightness-125 uppercase transition-all duration-150 shadow-sm"
        style={{
          borderColor: deck.cuePoint !== null ? color : "#28283c",
          color: deck.cuePoint !== null ? color : "#777790",
          background: deck.cuePoint !== null ? `linear-gradient(145deg, ${color}20, ${color}0a)` : "linear-gradient(145deg, #1c1c2c, #141420)",
          boxShadow: deck.cuePoint !== null ? `0 0 10px ${color}35` : "none",
        }}
      >
        <BookmarkPlus size={11} />
        GUARDAR CUE
      </button>
    </div>
  );
}
