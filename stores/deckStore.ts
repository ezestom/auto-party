import { create } from "zustand";

export interface TrackMetadata {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  key: string;
  duration: number; // in seconds
  color: string;
  peaks?: number[]; // Real amplitude envelope saved during import
  detailPeaks?: number[];
}

export interface DeckStateData {
  track: TrackMetadata | null;
  isPlaying: boolean;
  progress: number; // 0.0 to 1.0
  currentTime: number; // in seconds
  seekRevision: number; // user seeks, separate from clock updates
  bpm: number; // active BPM (base BPM * (1 + tempoOffset))
  baseBpm: number;
  tempoOffset: number; // -0.16 to +0.16 (simulating pitch fader range)
  key: string;
  keyLock: boolean;
  syncActive: boolean;
  isMaster: boolean;
  cuePoint: number | null;
  hotCues: Array<{ time: number; color: string } | null>; // 8 slots
  loopActive: boolean;
  loopLength: number; // in beats
  loopStart: number | null;
}

interface DeckStore {
  decks: {
    A: DeckStateData;
    B: DeckStateData;
  };
  setTrack: (deckId: "A" | "B", track: TrackMetadata | null) => void;
  setPlaying: (deckId: "A" | "B", playing: boolean) => void;
  setProgress: (deckId: "A" | "B", progress: number) => void;
  updatePlaybackTime: (deckId: "A" | "B", time: number) => void;
  setCurrentTime: (deckId: "A" | "B", time: number) => void;
  setTempoOffset: (deckId: "A" | "B", offset: number) => void;
  toggleKeyLock: (deckId: "A" | "B") => void;
  toggleSync: (deckId: "A" | "B") => void;
  setMaster: (deckId: "A" | "B") => void;
  setCue: (deckId: "A" | "B") => void;
  triggerCue: (deckId: "A" | "B") => void;
  setHotCue: (deckId: "A" | "B", index: number, time: number, color: string) => void;
  removeHotCue: (deckId: "A" | "B", index: number) => void;
  toggleLoop: (deckId: "A" | "B", length: number) => void;
  setLoopStart: (deckId: "A" | "B", time: number | null) => void;
  resetDeck: (deckId: "A" | "B") => void;
}

const initialDeckState = (): DeckStateData => ({
  track: null,
  isPlaying: false,
  progress: 0,
  currentTime: 0,
  seekRevision: 0,
  bpm: 120,
  baseBpm: 120,
  tempoOffset: 0,
  key: "—",
  keyLock: false,
  syncActive: false,
  isMaster: false,
  cuePoint: null,
  hotCues: Array(8).fill(null),
  loopActive: false,
  loopLength: 4,
  loopStart: null,
});

export const useDeckStore = create<DeckStore>((set) => ({
  decks: {
    A: initialDeckState(),
    B: initialDeckState(),
  },

  setTrack: (deckId, track) =>
    set((state) => {
      const deck = state.decks[deckId];
      const baseBpm = track ? track.bpm : 120;
      const bpm = baseBpm * (1 + deck.tempoOffset);
      return {
        decks: {
          ...state.decks,
          [deckId]: {
            ...deck,
            track,
            baseBpm,
            bpm,
            key: track?.key || "—",
            syncActive: false,
            progress: 0,
            currentTime: 0,
            seekRevision: deck.seekRevision + 1,
            isPlaying: false,
            cuePoint: null,
            hotCues: Array(8).fill(null),
            loopActive: false,
            loopStart: null,
          },
        },
      };
    }),

  setPlaying: (deckId, playing) =>
    set((state) => ({
      decks: {
        ...state.decks,
        [deckId]: {
          ...state.decks[deckId],
          isPlaying: playing,
        },
      },
    })),

  setProgress: (deckId, progress) =>
    set((state) => {
      const deck = state.decks[deckId];
      const value = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
      return { decks: { ...state.decks, [deckId]: {
        ...deck, progress: value, currentTime: value * (deck.track?.duration || 0),
        seekRevision: deck.seekRevision + 1,
      } } };
    }),

  updatePlaybackTime: (deckId, time) =>
    set((state) => {
      const deck = state.decks[deckId];
      const duration = deck.track?.duration || 0;
      const position = Number.isFinite(time) ? Math.max(0, Math.min(duration, time)) : 0;
      if (position === deck.currentTime) return state;
      return { decks: { ...state.decks, [deckId]: {
        ...deck, currentTime: position, progress: duration > 0 ? position / duration : 0,
      } } };
    }),

  setCurrentTime: (deckId, time) =>
    set((state) => {
      const deck = state.decks[deckId];
      const duration = deck.track?.duration || 0;
      const position = Number.isFinite(time) ? Math.max(0, Math.min(duration, time)) : 0;
      return { decks: { ...state.decks, [deckId]: {
        ...deck, currentTime: position, progress: duration > 0 ? position / duration : 0,
        seekRevision: deck.seekRevision + 1,
      } } };
    }),

  setTempoOffset: (deckId, offset) =>
    set((state) => {
      const deck = state.decks[deckId];
      const tempoOffset = Math.max(-0.16, Math.min(0.16, offset));
      const bpm = deck.baseBpm * (1 + tempoOffset);
      return {
        decks: {
          ...state.decks,
          [deckId]: {
            ...deck,
            tempoOffset,
            bpm,
            syncActive: false,
          },
        },
      };
    }),

  toggleKeyLock: (deckId) =>
    set((state) => ({
      decks: {
        ...state.decks,
        [deckId]: {
          ...state.decks[deckId],
          keyLock: !state.decks[deckId].keyLock,
        },
      },
    })),

  toggleSync: (deckId) =>
    set((state) => {
      const deck = state.decks[deckId];
      const other = state.decks[deckId === "A" ? "B" : "A"];
      if (deck.syncActive) return { decks: { ...state.decks, [deckId]: { ...deck, syncActive: false } } };
      if (!deck.track || !other.track || !(deck.baseBpm > 0) || !(other.bpm > 0)) return state;
      const offset = other.bpm / deck.baseBpm - 1;
      // Refuse a false SYNC indicator when the pitch range cannot match the other deck.
      if (Math.abs(offset) > 0.160001) return state;
      return { decks: { ...state.decks, [deckId]: {
        ...deck, tempoOffset: offset, bpm: other.bpm, syncActive: true,
      } } };
    }),

  setMaster: (deckId) =>
    set((state) => {
      const otherDeckId = deckId === "A" ? "B" : "A";
      return {
        decks: {
          ...state.decks,
          [deckId]: { ...state.decks[deckId], isMaster: true },
          [otherDeckId]: { ...state.decks[otherDeckId], isMaster: false },
        },
      };
    }),

  setCue: (deckId) =>
    set((state) => {
      const deck = state.decks[deckId];
      return {
        decks: {
          ...state.decks,
          [deckId]: {
            ...deck,
            cuePoint: deck.currentTime,
            isPlaying: false, // pause on cue set
          },
        },
      };
    }),

  triggerCue: (deckId) =>
    set((state) => {
      const deck = state.decks[deckId];
      const cuePoint = deck.cuePoint || 0;
      const duration = deck.track?.duration || 1;
      return {
        decks: {
          ...state.decks,
          [deckId]: {
            ...deck,
            currentTime: cuePoint,
            seekRevision: deck.seekRevision + 1,
            progress: Math.max(0, Math.min(1, cuePoint / duration)),
          },
        },
      };
    }),

  setHotCue: (deckId, index, time, color) =>
    set((state) => {
      const deck = state.decks[deckId];
      const newHotCues = [...deck.hotCues];
      newHotCues[index] = { time, color };
      return {
        decks: {
          ...state.decks,
          [deckId]: {
            ...deck,
            hotCues: newHotCues,
          },
        },
      };
    }),

  removeHotCue: (deckId, index) =>
    set((state) => {
      const deck = state.decks[deckId];
      const newHotCues = [...deck.hotCues];
      newHotCues[index] = null;
      return {
        decks: {
          ...state.decks,
          [deckId]: {
            ...deck,
            hotCues: newHotCues,
          },
        },
      };
    }),

  toggleLoop: (deckId, length) =>
    set((state) => {
      const deck = state.decks[deckId];
      const wasActive = deck.loopActive;
      return {
        decks: {
          ...state.decks,
          [deckId]: {
            ...deck,
            loopActive: !wasActive,
            loopLength: length,
            loopStart: !wasActive ? deck.currentTime : null,
          },
        },
      };
    }),

  setLoopStart: (deckId, time) =>
    set((state) => ({
      decks: {
        ...state.decks,
        [deckId]: {
          ...state.decks[deckId],
          loopStart: time,
        },
      },
    })),

  resetDeck: (deckId) =>
    set((state) => ({
      decks: {
        ...state.decks,
        [deckId]: initialDeckState(),
      },
    })),
}));
