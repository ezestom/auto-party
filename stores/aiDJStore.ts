"use client";

import { create } from "zustand";
import {
  generateSetlist,
  generateFallbackSetlist,
  type TrackInfo,
  type SetlistItem,
} from "../lib/ai/geminiClient";
import { useLibraryStore } from "./libraryStore";
import { useDeckStore } from "./deckStore";
import { useMixerStore } from "./mixerStore";
import { loadTrackById } from "../lib/audio/trackLoader";

export type AIDJStatus =
  | "idle"
  | "analyzing"
  | "mixing"
  | "transitioning"
  | "error";

interface AIDJStore {
  isActive: boolean;
  status: AIDJStatus;
  apiKey: string;
  setlist: SetlistItem[];
  currentIndex: number;
  djComment: string;
  errorMessage: string;
  showApiKeyModal: boolean;

  // Actions
  setApiKey: (key: string) => void;
  setShowApiKeyModal: (show: boolean) => void;
  activate: () => Promise<void>;
  deactivate: () => void;
  skipToNext: () => void;
}

// Persistent API key storage
const STORAGE_KEY = "eze_mix_gemini_api_key";
const DEFAULT_API_KEY = "AQ.Ab8RN6KFJBzS0gLmKf9j_wd_46k6tQLap0DYgY-GBlTFvL_C1g";
const getStoredApiKey = (): string => {
  if (typeof window === "undefined") return DEFAULT_API_KEY;
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_API_KEY;
};

// The transition monitor interval reference
let transitionMonitorId: ReturnType<typeof setInterval> | null = null;

/**
 * Monitors deck progress and triggers automatic transitions.
 * Runs as a polling interval when AI DJ is active.
 */
function startTransitionMonitor() {
  stopTransitionMonitor();

  transitionMonitorId = setInterval(() => {
    const aiState = useAIDJStore.getState();
    if (!aiState.isActive || aiState.status === "transitioning") return;

    const { setlist, currentIndex } = aiState;
    if (currentIndex >= setlist.length - 1) {
      // Reached end of setlist
      useAIDJStore.getState().deactivate();
      return;
    }

    const currentItem = setlist[currentIndex];
    const deckA = useDeckStore.getState().decks.A;
    const deckB = useDeckStore.getState().decks.B;
    const mixerState = useMixerStore.getState();

    // Determine which deck is currently "active" (playing and in crossfader focus)
    const activeDeck = mixerState.crossfader <= 0.5 ? "A" : "B";
    const activeDeckState = activeDeck === "A" ? deckA : deckB;
    const inactiveDeck = activeDeck === "A" ? "B" : "A";

    if (!activeDeckState.isPlaying || !activeDeckState.track) return;

    const timeRemaining =
      activeDeckState.track.duration - activeDeckState.currentTime;
    const mixPoint = currentItem?.mixPoint || 24;

    // Trigger transition when we reach the mix point
    if (timeRemaining <= mixPoint && timeRemaining > mixPoint - 1) {
      triggerAITransition(inactiveDeck, currentItem.transitionStyle);
    }
  }, 500); // Check every 500ms
}

function stopTransitionMonitor() {
  if (transitionMonitorId) {
    clearInterval(transitionMonitorId);
    transitionMonitorId = null;
  }
}

/**
 * Triggers the actual transition: load next track, sync BPM, start play, crossfade.
 */
async function triggerAITransition(
  targetDeck: "A" | "B",
  style: string
) {
  const aiState = useAIDJStore.getState();
  const nextIndex = aiState.currentIndex + 1;

  if (nextIndex >= aiState.setlist.length) {
    useAIDJStore.getState().deactivate();
    return;
  }

  useAIDJStore.setState({ status: "transitioning" });

  const nextItem = aiState.setlist[nextIndex];

  try {
    // 1. Load the next track onto the target deck
    await loadTrackById(nextItem.trackId, targetDeck, true);

    // 2. Start playback on the target deck
    useDeckStore.getState().setPlaying(targetDeck, true);

    // 3. Set auto-crossfade duration based on transition style
    let crossfadeDuration = 8;
    if (style === "cut") crossfadeDuration = 2;
    else if (style === "echo") crossfadeDuration = 16;
    else crossfadeDuration = 8;

    useMixerStore.getState().setAutoDuration(crossfadeDuration);

    // 4. Trigger auto-crossfade to the target deck
    useMixerStore.getState().triggerAutoCrossfade(targetDeck);

    // 5. Update AI state
    useAIDJStore.setState({
      currentIndex: nextIndex,
      status: "mixing",
    });
  } catch (err) {
    console.error("[AI DJ] Transition error:", err);
    useAIDJStore.setState({
      status: "error",
      errorMessage: `Failed to load next track: ${err}`,
    });
  }
}

export const useAIDJStore = create<AIDJStore>((set, get) => ({
  isActive: false,
  status: "idle",
  apiKey: getStoredApiKey(),
  setlist: [],
  currentIndex: 0,
  djComment: "",
  errorMessage: "",
  showApiKeyModal: false,

  setApiKey: (key: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, key);
    }
    set({ apiKey: key });
  },

  setShowApiKeyModal: (show: boolean) => set({ showApiKeyModal: show }),

  activate: async () => {
    const { apiKey } = get();
    const libraryTracks = useLibraryStore.getState().tracks;

    if (libraryTracks.length < 2) {
      set({
        status: "error",
        errorMessage: "Import at least 2 tracks to use AI Auto-DJ.",
      });
      return;
    }

    set({ status: "analyzing", isActive: true, errorMessage: "" });

    // Prepare track info for Gemini
    const trackInfos: TrackInfo[] = libraryTracks.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      bpm: t.bpm,
      key: t.key,
      duration: t.duration,
    }));

    try {
      let result;

      if (apiKey) {
        // Use Gemini API for intelligent setlist
        result = await generateSetlist(apiKey, trackInfos);
      } else {
        // Fallback: sort by BPM
        result = generateFallbackSetlist(trackInfos);
      }

      set({
        setlist: result.setlist,
        djComment: result.djComment,
        currentIndex: 0,
        status: "mixing",
      });

      // Load first track on Deck A and start playing
      const firstTrack = result.setlist[0];
      if (firstTrack) {
        await loadTrackById(firstTrack.trackId, "A", true);
        useDeckStore.getState().setPlaying("A", true);

        // Pre-load second track on Deck B (ready for transition)
        if (result.setlist.length > 1) {
          const secondTrack = result.setlist[1];
          await loadTrackById(secondTrack.trackId, "B", true);
        }

        // Ensure crossfader is on Deck A
        useMixerStore.getState().setCrossfader(0.0);
      }

      // Start monitoring for transitions
      startTransitionMonitor();
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown error occurred";
      console.error("[AI DJ] Activation error:", err);
      set({
        status: "error",
        isActive: false,
        errorMessage: errorMsg,
      });
    }
  },

  deactivate: () => {
    stopTransitionMonitor();
    set({
      isActive: false,
      status: "idle",
      setlist: [],
      currentIndex: 0,
      djComment: "",
      errorMessage: "",
    });
  },

  skipToNext: () => {
    const { isActive, setlist, currentIndex } = get();
    if (!isActive || currentIndex >= setlist.length - 1) return;

    const mixerState = useMixerStore.getState();
    const activeDeck = mixerState.crossfader <= 0.5 ? "A" : "B";
    const inactiveDeck = activeDeck === "A" ? "B" : "A";
    const currentItem = setlist[currentIndex];

    triggerAITransition(
      inactiveDeck,
      currentItem?.transitionStyle || "smooth"
    );
  },
}));
