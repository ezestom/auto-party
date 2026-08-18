import { db } from "../db/dexie";
import { getAudioEngine } from "./AudioEngine";
import { useDeckStore, TrackMetadata } from "../../stores/deckStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { useMixerStore } from "../../stores/mixerStore";
import { useSettingsStore } from "../../stores/settingsStore";

/**
 * Checks if a deck is safe to load a new track onto.
 * Returns true if safe, false if the deck is currently playing (locked).
 */
export function isDeckLocked(deckId: "A" | "B"): boolean {
  const isLockEnabled = useSettingsStore.getState().lockPlayingDeck;
  if (!isLockEnabled) return false;
  const deck = useDeckStore.getState().decks[deckId];
  return deck.isPlaying;
}

export async function loadTrackById(trackId: string, deckId: "A" | "B", force = false) {
  // Safety: prevent loading over a playing deck unless forced or lock is disabled in settings
  if (!force && isDeckLocked(deckId)) {
    console.warn(`[LOCK] Deck ${deckId} is playing. Pause first or force-load.`);
    return null;
  }

  const engine = getAudioEngine();
  await engine.resume();
  engine.stop(deckId);

  const dbTrack = await db.tracks.get(trackId);
  if (!dbTrack) {
    throw new Error(`Track ${trackId} not found in DB`);
  }

  if (dbTrack.audioData && dbTrack.audioData.byteLength > 0) {
    if (engine.ctx) {
      const audioBuffer = await engine.ctx.decodeAudioData(dbTrack.audioData.slice(0));
      engine.loadTrack(deckId, audioBuffer);
    }
  }

  const metadata: TrackMetadata = {
    id: dbTrack.id,
    title: dbTrack.title,
    artist: dbTrack.artist,
    bpm: dbTrack.bpm,
    key: dbTrack.key,
    duration: dbTrack.duration,
    color: dbTrack.color,
  };

  useDeckStore.getState().setTrack(deckId, metadata);

  // Apply auto-gain correction if enabled in settings
  const isAutoGainOn = useSettingsStore.getState().autoGainEnabled;
  if (isAutoGainOn) {
    const gainCorrection = dbTrack.gainCorrection ?? 1.0;
    const normalizedGain = Math.max(0, Math.min(1, 0.75 * gainCorrection));
    useMixerStore.getState().setChannelGain(deckId, normalizedGain);
  }

  // Auto-play on load if enabled in settings
  const isAutoPlayOn = useSettingsStore.getState().autoPlayOnLoad;
  if (isAutoPlayOn) {
    useDeckStore.getState().setPlaying(deckId, true);
    engine.play(deckId);
  }

  return metadata;
}

export async function importAndLoadFile(file: File, deckId: "A" | "B") {
  // For direct file drops, we allow loading even on playing deck (user intent is clear from drag)
  const importedTrack = await useLibraryStore.getState().importTrack(file);
  if (importedTrack && importedTrack.id) {
    await loadTrackById(importedTrack.id, deckId, true);
  }
}


