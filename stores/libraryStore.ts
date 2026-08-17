import { create } from "zustand";
import { TrackMetadata } from "./deckStore";
import { db, DbTrack } from "../lib/db/dexie";
import { getAudioEngine } from "../lib/audio/AudioEngine";

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

const mockTracksMetadata = [
  { id: "t1", title: "Blinding Lights", artist: "The Weeknd", bpm: 171.0, key: "7A", duration: 200, color: "#ff6b00" },
  { id: "t2", title: "Levitating", artist: "Dua Lipa", bpm: 103.0, key: "6B", duration: 204, color: "#00d4ff" },
  { id: "t3", title: "One More Time", artist: "Daft Punk", bpm: 123.0, key: "5A", duration: 320, color: "#ffd600" },
  { id: "t4", title: "Strobe", artist: "Deadmau5", bpm: 128.0, key: "9A", duration: 635, color: "#ff2255" },
  { id: "t5", title: "Midnight City", artist: "M83", bpm: 105.0, key: "4B", duration: 243, color: "#cc44ff" },
  { id: "t6", title: "Don't You Worry Child", artist: "Swedish House Mafia", bpm: 129.0, key: "8B", duration: 213, color: "#39ff82" },
  { id: "t7", title: "Titanium", artist: "David Guetta ft. Sia", bpm: 126.0, key: "10A", duration: 245, color: "#0055ff" },
  { id: "t8", title: "Animals", artist: "Martin Garrix", bpm: 128.0, key: "2A", duration: 304, color: "#ff9500" },
];

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

  initLibrary: async () => {
    // Populate with mock tracks if IndexedDB is empty
    const count = await db.tracks.count();
    if (count === 0) {
      const dbTracks: DbTrack[] = mockTracksMetadata.map((track) => ({
        ...track,
        audioData: new ArrayBuffer(0),
        peaks: [],
      }));
      await db.tracks.bulkPut(dbTracks);
    }
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
      const peaks = await new Promise<number[]>((resolve) => {
        const worker = new Worker(new URL("../lib/workers/waveform.worker.ts", import.meta.url));
        worker.postMessage({ audioData: channelData, peakCount: 800 });
        worker.onmessage = (e) => {
          resolve(e.data.peaks);
          worker.terminate();
        };
      });

      // 4. Extract BPM in BPM Worker
      const bpm = await new Promise<number>((resolve) => {
        const worker = new Worker(new URL("../lib/workers/bpm.worker.ts", import.meta.url));
        worker.postMessage({ audioData: channelData, sampleRate });
        worker.onmessage = (e) => {
          resolve(e.data.bpm);
          worker.terminate();
        };
      });

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
      
      const keys = ["1A", "2A", "3A", "4A", "5A", "6A", "7A", "8A", "9A", "10A", "11A", "12A", "1B", "2B", "3B", "4B", "5B", "6B", "7B", "8B", "9B", "10B", "11B", "12B"];
      const randKey = keys[Math.floor(Math.random() * keys.length)];

      const trackId = "track_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

      const dbTrack: DbTrack = {
        id: trackId,
        title,
        artist,
        bpm,
        key: randKey,
        duration,
        color: randColor,
        audioData: arrayBuffer,
        peaks,
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
