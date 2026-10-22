import { db } from "../db/dexie";
import { getAudioEngine } from "./AudioEngine";
import { useDeckStore, type TrackMetadata } from "../../stores/deckStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { useMixerStore } from "../../stores/mixerStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { analyzeWaveform } from "./waveformAnalysis";

type DeckId = "A" | "B";
interface LoadOptions { signal?: AbortSignal; autoPlay?: boolean }
const revisions: Record<DeckId, number> = { A: 0, B: 0 };

export function isDeckLocked(deckId: DeckId): boolean {
  return useSettingsStore.getState().lockPlayingDeck && useDeckStore.getState().decks[deckId].isPlaying;
}

async function performLoad(trackId: string, deckId: DeckId, force: boolean, options: LoadOptions, revision: number) {
  const current = () => revisions[deckId] === revision && !options.signal?.aborted;
  if (!current() || (!force && isDeckLocked(deckId))) return null;
  const engine = getAudioEngine();
  try {
    await engine.resume();
    if (!current()) return null;
    const dbTrack = await db.tracks.get(trackId);
    if (!current()) return null;
    if (!dbTrack) throw new Error("Track " + trackId + " not found in DB");
    if (!engine.ctx || !dbTrack.audioData?.byteLength) throw new Error("La canción no contiene audio válido.");
    // Prepare everything before the single synchronous commit. Never silence valid audio on failure.
    const audioBuffer = await engine.ctx.decodeAudioData(dbTrack.audioData.slice(0));
    if (!current()) return null;
    const hasDetail = dbTrack.waveformVersion === 1 && !!dbTrack.detailPeaks?.length;
    const waveform = hasDetail ? { peaks: dbTrack.peaks, detailPeaks: dbTrack.detailPeaks! }
      : await analyzeWaveform(audioBuffer).catch(() => ({ peaks: dbTrack.peaks || [], detailPeaks: [] }));
    if (!current()) return null;
    const [savedCues, savedLoops] = await Promise.all([
      db.hotCues.where("trackId").equals(trackId).toArray(),
      db.loops.where("trackId").equals(trackId).toArray(),
    ]);
    if (!current() || (!force && isDeckLocked(deckId))) return null;
    if (!Number.isFinite(audioBuffer.duration) || audioBuffer.duration <= 0) throw new Error("La canción no contiene audio válido.");
    const metadata: TrackMetadata = {
      id: dbTrack.id, title: dbTrack.title, artist: dbTrack.artist, bpm: dbTrack.bpm,
      key: dbTrack.key, duration: audioBuffer.duration, color: dbTrack.color, ...waveform,
    };
    engine.loadTrack(deckId, audioBuffer);
    useDeckStore.getState().setTrack(deckId, metadata);
    if (!hasDetail && waveform.detailPeaks.length) {
      // Cache failure (e.g. full browser storage) must never interrupt valid playback.
      void db.tracks.update(trackId, { ...waveform, waveformVersion: 1 }).catch(() => {});
    }
    for (const cue of savedCues) {
      if (cue.index >= 0 && cue.index < 8 && Number.isFinite(cue.time) && cue.time >= 0 && cue.time <= audioBuffer.duration) {
        useDeckStore.getState().setHotCue(deckId, cue.index, cue.time, cue.color);
      }
    }
    const loop = savedLoops.find(l => Number.isFinite(l.time) && l.time >= 0 && l.time < audioBuffer.duration && Number.isFinite(l.length) && l.length > 0);
    if (loop) useDeckStore.setState(state => ({ decks: { ...state.decks, [deckId]: {
      ...state.decks[deckId], loopActive: true, loopStart: loop.time, loopLength: loop.length,
    } } }));
    if (useSettingsStore.getState().autoGainEnabled) {
      const correction = dbTrack.gainCorrection ?? 1;
      useMixerStore.getState().setChannelGain(deckId, Math.max(0, Math.min(1, 0.75 * (Number.isFinite(correction) ? correction : 1))));
    }
    if (options.autoPlay ?? useSettingsStore.getState().autoPlayOnLoad) useDeckStore.getState().setPlaying(deckId, true);
    return metadata;
  } catch (error) {
    if (!current()) return null;
    throw error;
  }
}

export async function loadTrackById(trackId: string, deckId: DeckId, force = false, options: LoadOptions = {}) {
  if (options.signal?.aborted || (!force && isDeckLocked(deckId))) return null;
  return performLoad(trackId, deckId, force, options, ++revisions[deckId]);
}

export async function importAndLoadFile(file: File, deckId: DeckId) {
  if (isDeckLocked(deckId)) return null;
  // Reserve on drop, not after import: a slow import must not supersede a later choice.
  const revision = ++revisions[deckId];
  const imported = await useLibraryStore.getState().importTrack(file);
  if (!imported?.id || revision !== revisions[deckId]) return null;
  return performLoad(imported.id, deckId, false, {}, revision);
}
