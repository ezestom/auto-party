import { db } from "../db/dexie";
import { getAudioEngine } from "./AudioEngine";
import { useDeckStore, TrackMetadata } from "../../stores/deckStore";
import { useLibraryStore } from "../../stores/libraryStore";

export async function loadTrackById(trackId: string, deckId: "A" | "B") {
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
  return metadata;
}

export async function importAndLoadFile(file: File, deckId: "A" | "B") {
  const importedTrack = await useLibraryStore.getState().importTrack(file);
  if (importedTrack && importedTrack.id) {
    await loadTrackById(importedTrack.id, deckId);
  }
}
