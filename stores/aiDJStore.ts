"use client";
import { useSettingsStore } from "./settingsStore";

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
import { useVJStore } from "./vjStore";
import { loadTrackById } from "../lib/audio/trackLoader";
import { getAudioEngine } from "../lib/audio/AudioEngine";
import { samplerEngine } from "../lib/audio/SamplerEngine";
import { useAIConnectionStore } from "./aiConnectionStore";
import type { AIReason } from "../lib/ai/contract";

export type AIDJStatus =
  | "idle"
  | "analyzing"
  | "mixing"
  | "transitioning"
  | "error";

interface AIDJStore {
  isActive: boolean;
  status: AIDJStatus;
  planSource: "gemini" | "local" | null;
  planReason: AIReason | null;
  setlist: SetlistItem[];
  currentIndex: number;
  djComment: string;
  errorMessage: string;
  autoFXDrops: boolean;

  // Actions
  toggleAutoFXDrops: () => void;
  activate: () => Promise<void>;
  deactivate: () => void;
  skipToNext: () => void;
}


// The transition monitor interval reference
let transitionMonitorId: ReturnType<typeof setInterval> | null = null;
let session: AbortController | null = null;
let loadingTransition = false;

function getSessionDeck(): "A" | "B" {
  const state = useAIDJStore.getState();
  const id = state.setlist[state.currentIndex]?.trackId;
  const { decks } = useDeckStore.getState();
  const matchesA = !!id && decks.A.track?.id === id;
  const matchesB = !!id && decks.B.track?.id === id;
  if (matchesA !== matchesB) return matchesA ? "A" : "B";
  return useMixerStore.getState().crossfader <= 0.5 ? "A" : "B";
}

/**
 * Monitors deck progress and triggers automatic transitions.
 * Runs as a polling interval when AI DJ is active.
 */
function startTransitionMonitor() {
  stopTransitionMonitor();

  transitionMonitorId = setInterval(() => {
    const aiState = useAIDJStore.getState();
    if (!aiState.isActive || aiState.status === "error" || loadingTransition) return;
    if (aiState.status === "transitioning") {
      const mixer = useMixerStore.getState();
      if (!mixer.isAutoCrossfading) {
        // Release only a fully faded-out deck. A manually interrupted blend keeps both songs.
        const current = getSessionDeck();
        if (current === "A" && mixer.crossfader <= 0.001) useDeckStore.getState().setPlaying("B", false);
        if (current === "B" && mixer.crossfader >= 0.999) useDeckStore.getState().setPlaying("A", false);
        useAIDJStore.setState({ status: "mixing" });
      }
      return;
    }

    const { setlist, currentIndex } = aiState;
    const currentItem = setlist[currentIndex];
    const deckA = useDeckStore.getState().decks.A;
    const deckB = useDeckStore.getState().decks.B;

    // Determine which deck is currently "active" (playing and in crossfader focus)
    const activeDeck = getSessionDeck();
    const activeDeckState = activeDeck === "A" ? deckA : deckB;
    const inactiveDeck = activeDeck === "A" ? "B" : "A";

    if (!activeDeckState.track) return;
    if (currentIndex >= setlist.length - 1) {
      if (!activeDeckState.isPlaying && getAudioEngine().getPlaybackTime(activeDeck) >= activeDeckState.track.duration - 0.1) aiState.deactivate();
      return;
    }
    if (!activeDeckState.isPlaying) return;

    const timeRemaining =
      activeDeckState.track.duration - getAudioEngine().getPlaybackTime(activeDeck);
    const requestedMixPoint = currentItem?.mixPoint;
    const mixPoint = Math.min(activeDeckState.track.duration / 2, Number.isFinite(requestedMixPoint) && requestedMixPoint > 0 ? requestedMixPoint : 24);

    // AI Pre-Drop Build Riser: trigger noise sweep 2.5s before transition starts
    if (aiState.autoFXDrops && timeRemaining <= mixPoint + 2.5 && timeRemaining > mixPoint + 1.5) {
      samplerEngine.trigger("sweep", 0.55);
    }

    // Trigger transition when we reach the mix point
    if (timeRemaining <= mixPoint) {
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
 * Loads and starts the next song, then triggers the existing crossfade.
 */
async function triggerAITransition(
  targetDeck: "A" | "B",
  style: string
) {
  const aiState = useAIDJStore.getState();
  const activeSession = session;
  if (!aiState.isActive || !activeSession || activeSession.signal.aborted || loadingTransition || useMixerStore.getState().isAutoCrossfading) return;
  const nextIndex = aiState.currentIndex + 1;

  if (nextIndex >= aiState.setlist.length) {
    useAIDJStore.getState().deactivate();
    return;
  }

  loadingTransition = true;
  useAIDJStore.setState({ status: "transitioning" });

  const nextItem = aiState.setlist[nextIndex];

  try {
    // 1. Load the next track onto the target deck
    const loaded = await loadTrackById(nextItem.trackId, targetDeck, false, { signal: activeSession.signal, autoPlay: false });
    if (session !== activeSession || activeSession.signal.aborted) return;
    if (!loaded) throw new Error("El deck de destino está ocupado o la carga fue reemplazada.");

    // 2. Start playback on the target deck
    useDeckStore.getState().setPlaying(targetDeck, true);

    // 3. Set auto-crossfade duration based on transition style
    const crossfadeDuration = style === "cut" ? 2 : useSettingsStore.getState().aiDefaultDuration;

    useMixerStore.getState().setAutoDuration(crossfadeDuration);

    // 4. Trigger auto-crossfade to the target deck
    useMixerStore.getState().triggerAutoCrossfade(targetDeck);

    // 5. Synchronize VJ Visual Display (rotate to next uploaded video & trigger visual drop)
    try {
      const vjState = useVJStore.getState();
      vjState.rotateToNextVideo();
      vjState.triggerDropFlash(
        `🔥 DECK ${targetDeck} DROPPING 🔥`,
        targetDeck === "A" ? "#ff6b00" : "#00d4ff"
      );
    } catch (e) {
      console.warn("[AI DJ] VJ sync notice:", e);
    }

    // 6. Trigger AI Drop Stinger / Impact if enabled
    if (aiState.autoFXDrops) {
      if (style === "cut") {
        samplerEngine.trigger("laser", 0.7);
      } else {
        samplerEngine.trigger("subdrop", 0.65);
      }
    }

    // 7. Update AI state
    useAIDJStore.setState({
      currentIndex: nextIndex,
      status: "transitioning",
    });
  } catch (err) {
    if (session !== activeSession || activeSession.signal.aborted) return;
    console.error("[AI DJ] Transition error:", err);
    useAIDJStore.setState({
      status: "error",
      errorMessage: `Failed to load next track: ${err}`,
    });
  } finally {
    if (session === activeSession) loadingTransition = false;
  }
}

export const useAIDJStore = create<AIDJStore>((set, get) => ({
  isActive: false,
  status: "idle",
  planSource: null,
  planReason: null,
  setlist: [],
  currentIndex: 0,
  djComment: "",
  errorMessage: "",
  autoFXDrops: true,


  toggleAutoFXDrops: () => set((state) => ({ autoFXDrops: !state.autoFXDrops })),

  activate: async () => {
    if (get().isActive) return;
    const libraryTracks = useLibraryStore.getState().tracks;

    if (libraryTracks.length < 2) {
      set({
        status: "error",
        errorMessage: "Import at least 2 tracks to use AI Auto-DJ.",
      });
      return;
    }

    session?.abort();
    const activeSession = new AbortController();
    session = activeSession;
    loadingTransition = false;
    set({ status: "analyzing", isActive: true, errorMessage: "", planSource: null, planReason: null });

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

      if (useAIConnectionStore.getState().useRemoteAI) {
        result = await generateSetlist(trackInfos, activeSession.signal);
      } else {
        // Fallback: sort by BPM
        result = generateFallbackSetlist(trackInfos);
      }

      if (session !== activeSession || activeSession.signal.aborted) return;
      useAIConnectionStore.getState().recordPlan(result);
      const validIds = new Set(libraryTracks.map(track => track.id));
      const seen = new Set<string>();
      let setlist = result.setlist.filter(item => validIds.has(item.trackId) && !seen.has(item.trackId) && !!seen.add(item.trackId));
      if (!setlist.length) throw new Error("No hay canciones válidas para la sesión.");

      // Take over the currently audible song instead of restarting the party.
      const { decks } = useDeckStore.getState();
      const focus = useMixerStore.getState().crossfader <= 0.5 ? "A" : "B";
      const other = focus === "A" ? "B" : "A";
      const playing = decks[focus].isPlaying && decks[focus].track ? focus : decks[other].isPlaying && decks[other].track ? other : null;
      if (playing) {
        const id = decks[playing].track!.id;
        const item = setlist.find(entry => entry.trackId === id) || { trackId: id, mixPoint: 24, transitionStyle: "smooth" as const };
        setlist = [item, ...setlist.filter(entry => entry.trackId !== id)];
      } else {
        const loaded = await loadTrackById(setlist[0].trackId, "A", false, { signal: activeSession.signal, autoPlay: false });
        if (session !== activeSession || activeSession.signal.aborted) return;
        if (!loaded) throw new Error("El deck está ocupado o la carga fue reemplazada.");
        useMixerStore.getState().setCrossfader(0);
        useDeckStore.getState().setPlaying("A", true);
      }
      set({ setlist, djComment: result.djComment, currentIndex: 0, status: "mixing", planSource: result.source, planReason: result.reason || null });

      // Start monitoring for transitions
      startTransitionMonitor();
    } catch (err) {
      if (session !== activeSession || activeSession.signal.aborted) return;
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
    session?.abort();
    session = null;
    loadingTransition = false;
    stopTransitionMonitor();
    useMixerStore.getState().stopAutoCrossfade();
    set({
      isActive: false,
      status: "idle",
      setlist: [],
      currentIndex: 0,
      djComment: "",
      planSource: null,
      planReason: null,
      errorMessage: "",
    });
  },

  skipToNext: () => {
    const { isActive, setlist, currentIndex } = get();
    if (!isActive || currentIndex >= setlist.length - 1) return;

    const activeDeck = getSessionDeck();
    const inactiveDeck = activeDeck === "A" ? "B" : "A";
    const currentItem = setlist[currentIndex];

    triggerAITransition(
      inactiveDeck,
      currentItem?.transitionStyle || "smooth"
    );
  },
}));
