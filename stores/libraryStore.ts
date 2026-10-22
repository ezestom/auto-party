import { create } from "zustand";
import { TrackMetadata } from "./deckStore";
import { db, DbTrack } from "../lib/db/dexie";
import { getAudioEngine } from "../lib/audio/AudioEngine";
import { analyzeWaveform } from "../lib/audio/waveformAnalysis";

export type SortField = "title" | "artist" | "bpm" | "key" | "duration";
export type SortDirection = "asc" | "desc";

export interface ImportStatus {
  active: boolean;
  current: number;
  total: number;
  filename: string;
}

interface LibraryStore {
  tracks: TrackMetadata[];
  searchQuery: string;
  sortField: SortField;
  sortDirection: SortDirection;
  prepCrate: string[]; // track ids
  history: string[]; // track ids
  importStatus: ImportStatus;
  
  reanalyzeBpm: () => Promise<void>;
  analysisMessage: string;
  initLibrary: () => Promise<void>;
  loadTracksFromDb: () => Promise<void>;
  setSearchQuery: (query: string) => Promise<void>;
  setSort: (field: SortField) => Promise<void>;
  importTrack: (file: File) => Promise<DbTrack>;
  deleteTrack: (trackId: string) => Promise<void>;
  togglePrepCrate: (trackId: string) => void;
  addToHistory: (trackId: string) => void;
  setImportStatus: (status: Partial<ImportStatus>) => void;
}

// No mock tracks — library starts empty, user imports their own music

function analyzeTempo(audioData: Float32Array, sampleRate: number): Promise<{bpm: number; confidence: number}> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../lib/workers/bpm.worker.ts", import.meta.url));
    const timer = setTimeout(() => { worker.terminate(); reject(new Error("El análisis de BPM tardó demasiado.")); }, 15000);
    worker.onmessage = event => { clearTimeout(timer); worker.terminate(); if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data); };
    worker.onerror = () => { clearTimeout(timer); worker.terminate(); reject(new Error("No se pudo analizar el ritmo.")); };
    worker.postMessage({audioData, sampleRate});
  });
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  tracks: [],
  searchQuery: "",
  sortField: "title",
  sortDirection: "asc",
  prepCrate: [],
  history: [],
  importStatus: {
    active: false,
    current: 0,
    total: 0,
    filename: "",
  },

  analysisMessage: "",
  reanalyzeBpm: async () => {
    if (get().importStatus.active) return;
    const rows = await db.tracks.toArray();
    let failed = 0, detected = 0;
    set({ analysisMessage: "", importStatus: {active:true,current:0,total:rows.length,filename:"Analizando BPM"} });
    try {
      const engine = getAudioEngine(); await engine.resume();
      if (!engine.ctx) throw new Error("Motor de audio no disponible");
      for (const [index, track] of rows.entries()) {
        set({importStatus:{active:true,current:index+1,total:rows.length,filename:"BPM: " + track.title}});
        try {
          const buffer = await engine.ctx.decodeAudioData(track.audioData.slice(0));
          const result = await analyzeTempo(buffer.getChannelData(0), buffer.sampleRate);
          await db.tracks.update(track.id, {bpm:result.bpm,bpmConfidence:result.confidence,analysisVersion:1});
          if (result.bpm > 0) detected++;
        } catch { failed++; }
      }
      await get().loadTracksFromDb();
      set({analysisMessage: detected + " BPM estimados; " + (rows.length-detected-failed) + " sin ritmo claro; " + failed + " errores. Los decks ya cargados conservan sus valores hasta recargarlos."});
    } catch (error) { set({analysisMessage:error instanceof Error ? error.message : "No se pudo analizar la biblioteca."}); }
    finally { set({importStatus:{active:false,current:0,total:0,filename:""}}); }
  },
  initLibrary: async () => {
    // Library starts empty — user imports their own tracks
    await get().loadTracksFromDb();
  },

  loadTracksFromDb: async () => {
    const { searchQuery, sortField, sortDirection } = get();
    let dbTracks = await db.tracks.toArray();

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      dbTracks = dbTracks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q)
      );
    }

    // Sort
    dbTracks.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];

      if (typeof valA === "string" && typeof valB === "string") {
        return sortDirection === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else if (typeof valA === "number" && typeof valB === "number") {
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }
      return 0;
    });

    // Map DbTrack to TrackMetadata for store UI state
    const tracksMetadata: TrackMetadata[] = dbTracks.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      bpm: t.bpm,
      key: t.key,
      duration: t.duration,
      color: t.color,
    }));

    set({ tracks: tracksMetadata });
  },

  setSearchQuery: async (searchQuery) => {
    set({ searchQuery });
    await get().loadTracksFromDb();
  },

  setSort: async (field) => {
    const isSameField = get().sortField === field;
    const direction: SortDirection = isSameField && get().sortDirection === "asc" ? "desc" : "asc";
    set({ sortField: field, sortDirection: direction });
    await get().loadTracksFromDb();
  },

  importTrack: async (file: File) => {
    try {
      // 1. Read file as ArrayBuffer
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });

      // 2. Decode the audio buffer (need context)
      const engine = getAudioEngine();
      await engine.resume();
      if (!engine.ctx) {
        throw new Error("Audio Engine context not available");
      }

      // decodeAudioData consumes the arrayBuffer, so we decode a copy
      const decodedBuffer = await engine.ctx.decodeAudioData(arrayBuffer.slice(0));
      const channelData = decodedBuffer.getChannelData(0);
      const duration = decodedBuffer.duration;
      const sampleRate = decodedBuffer.sampleRate;

      // 3. Process Peaks in Waveform Worker
      const { peaks, detailPeaks } = await analyzeWaveform(decodedBuffer);

      // 4. Extract BPM in BPM Worker
      const { bpm, confidence } = await analyzeTempo(channelData, sampleRate);

      // 5. Calculate Auto-Gain (RMS normalization)
      // Target: -14 dBFS RMS (~0.2 linear) for consistent loudness
      const TARGET_RMS = 0.2;
      let sumSquares = 0;
      const sampleStep = Math.max(1, Math.floor(channelData.length / 50000)); // sample subset for speed
      let sampleCount = 0;
      for (let i = 0; i < channelData.length; i += sampleStep) {
        sumSquares += channelData[i] * channelData[i];
        sampleCount++;
      }
      const rms = Math.sqrt(sumSquares / sampleCount);
      const gainCorrection = rms > 0.001 ? TARGET_RMS / rms : 1.0;
      // Clamp to reasonable range (0.5x to 3.0x) to avoid extreme adjustments
      const clampedGain = Math.max(0.5, Math.min(3.0, gainCorrection));

      // Heuristic metadata from file name: "Artist - Title.mp3"
      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
      const parts = nameWithoutExt.split(" - ");
      let artist = "Unknown Artist";
      let title = nameWithoutExt;
      if (parts.length > 1) {
        artist = parts[0].trim();
        title = parts.slice(1).join(" - ").trim();
      }

      // Generate random color for visuals, and standard Camelot key
      const colors = ["#ff6b00", "#00d4ff", "#ffd600", "#ff2255", "#cc44ff", "#39ff82", "#0055ff", "#ff9500"];
      const randColor = colors[Math.floor(Math.random() * colors.length)];
      
      // No key detector is installed: never invent harmonic metadata.
      const analyzedKey = "—";

      const trackId = "track_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

      const dbTrack: DbTrack = {
        id: trackId,
        title,
        artist,
        bpm,
        bpmConfidence: confidence,
        analysisVersion: 1,
        key: analyzedKey,
        duration,
        color: randColor,
        audioData: arrayBuffer,
        peaks,
        detailPeaks,
        waveformVersion: 1,
        gainCorrection: clampedGain,
      };

      await db.tracks.put(dbTrack);
      await get().loadTracksFromDb();
      return dbTrack;
    } catch (err) {
      console.error("Failed to import track:", err);
      throw err;
    }
  },

  deleteTrack: async (trackId: string) => {
    await db.tracks.delete(trackId);
    await db.hotCues.where("trackId").equals(trackId).delete();
    await db.loops.where("trackId").equals(trackId).delete();
    await get().loadTracksFromDb();
  },

  togglePrepCrate: (trackId) =>
    set((state) => {
      const isAdded = state.prepCrate.includes(trackId);
      const prepCrate = isAdded
        ? state.prepCrate.filter((id) => id !== trackId)
        : [...state.prepCrate, trackId];
      return { prepCrate };
    }),

  addToHistory: (trackId) =>
    set((state) => {
      if (state.history[state.history.length - 1] === trackId) {
        return {};
      }
      return {
        history: [...state.history, trackId],
      };
    }),

  setImportStatus: (status) =>
    set((state) => ({
      importStatus: { ...state.importStatus, ...status },
    })),
}));
