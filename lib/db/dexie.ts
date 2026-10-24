import Dexie, { type Table } from "dexie";

export interface DbTrack {
  id: string; // unique identifier (generated or file name)
  title: string;
  artist: string;
  bpm: number;
  key: string;
  audioStart?: number;
  audioEnd?: number;
  duration: number; // in seconds
  color: string;
  audioData: ArrayBuffer; // stores the binary audio file data
  peaks: number[]; // pre-computed peak levels (0.0 to 1.0)
  detailPeaks?: number[];
  waveformVersion?: number;
  bpmConfidence?: number;
  analysisVersion?: number;
  gainCorrection?: number; // auto-gain normalization factor (default 1.0)
}

export interface DbHotCue {
  id?: number;
  trackId: string;
  index: number; // 0 to 7
  time: number; // in seconds
  color: string; // hex color
}

export interface DbLoop {
  id?: number;
  trackId: string;
  time: number; // loop start time in seconds
  length: number; // loop length in beats
}

export interface DbVideo {
  id: string;
  title: string;
  category: string;
  duration: number; // in seconds
  url?: string;
  videoData?: ArrayBuffer;
  color?: string;
}

export class MixrDatabase extends Dexie {
  tracks!: Table<DbTrack, string>;
  hotCues!: Table<DbHotCue, number>;
  loops!: Table<DbLoop, number>;
  videos!: Table<DbVideo, string>;

  constructor() {
    super("MixrDatabase");
    this.version(1).stores({
      tracks: "id, title, artist, bpm, key, duration",
      hotCues: "++id, trackId, index",
      loops: "++id, trackId",
      videos: "id, title, category, duration",
    });
    // v2: added gainCorrection field to tracks (no index change needed)
    this.version(2).stores({
      tracks: "id, title, artist, bpm, key, duration",
      hotCues: "++id, trackId, index",
      loops: "++id, trackId",
      videos: "id, title, category, duration",
    });
  }
}

export const db = new MixrDatabase();
