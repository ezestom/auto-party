import { create } from "zustand";
import { db, DbVideo } from "../lib/db/dexie";
import { vjChannel } from "../lib/vj/vjChannel";

export interface VJVideoItem {
  id: string;
  title: string;
  category: string;
  duration: number;
  url: string;
  color: string;
  isCustom?: boolean;
}

export const DEFAULT_VJ_VIDEOS: VJVideoItem[] = [];

interface VJState {
  videos: VJVideoItem[];
  activeVideo: VJVideoItem | null;
  isPlaying: boolean;
  activeEffect: "NORMAL" | "STROBE" | "GLITCH" | "NEON_WAVE";
  isWindowOpen: boolean;
  isLoading: boolean;

  // Actions
  loadVideos: () => Promise<void>;
  importVideo: (file: File) => Promise<VJVideoItem>;
  deleteVideo: (id: string) => Promise<void>;
  setActiveVideo: (video: VJVideoItem) => void;
  setPlaying: (playing: boolean) => void;
  setEffect: (effect: "NORMAL" | "STROBE" | "GLITCH" | "NEON_WAVE") => void;
  syncTime: (time: number) => void;
  setWindowOpen: (open: boolean) => void;
  rotateToNextVideo: () => void;
  triggerDropFlash: (dropText?: string, color?: string) => void;
}

export const useVJStore = create<VJState>((set, get) => ({
  videos: [],
  activeVideo: null,
  isPlaying: true,
  activeEffect: "NORMAL",
  isWindowOpen: false,
  isLoading: false,

  loadVideos: async () => {
    try {
      const dbVideos = await db.videos.toArray();
      const customVideos: VJVideoItem[] = dbVideos.map((v) => {
        let objectUrl = v.url || "";
        if (v.videoData) {
          const blob = new Blob([v.videoData], { type: "video/mp4" });
          objectUrl = URL.createObjectURL(blob);
        }
        return {
          id: v.id,
          title: v.title,
          category: v.category || "CUSTOM VJ",
          duration: v.duration || 120,
          url: objectUrl,
          color: v.color || "#00d4ff",
          isCustom: true,
        };
      });

      set({
        videos: customVideos,
        activeVideo: customVideos.length > 0 ? customVideos[0] : null,
      });
    } catch (e) {
      console.warn("Could not load videos from Dexie DB:", e);
    }
  },

  deleteVideo: async (id: string) => {
    try {
      await db.videos.delete(id);
      set((state) => {
        const remaining = state.videos.filter((v) => v.id !== id);
        return {
          videos: remaining,
          activeVideo: state.activeVideo?.id === id ? (remaining[0] || null) : state.activeVideo,
        };
      });
    } catch (e) {
      console.warn("Failed to delete video:", e);
    }
  },

  importVideo: async (file: File) => {
    set({ isLoading: true });

    const videoId = `vj-custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const url = URL.createObjectURL(file);
    const title = file.name.replace(/\.[^/.]+$/, "").toUpperCase();

    let arrayBuffer: ArrayBuffer | undefined = undefined;
    try {
      arrayBuffer = await file.arrayBuffer();
      const dbVideo: DbVideo = {
        id: videoId,
        title,
        category: "CUSTOM VJ",
        duration: 120,
        url,
        videoData: arrayBuffer,
        color: "#00d4ff",
      };
      await db.videos.put(dbVideo);
    } catch (e) {
      console.warn("Could not store video in Dexie DB, using Blob URL directly:", e);
    }

    const newItem: VJVideoItem = {
      id: videoId,
      title,
      category: "CUSTOM VJ",
      duration: 120,
      url,
      color: "#00d4ff",
      isCustom: true,
    };

    set((state) => ({
      videos: [...state.videos, newItem],
      activeVideo: newItem,
      isLoading: false,
    }));

    vjChannel.send({
      type: "SET_VIDEO",
      videoId: newItem.id,
      videoUrl: url,
      videoTitle: newItem.title,
      color: newItem.color,
    });

    return newItem;
  },

  setActiveVideo: (video: VJVideoItem) => {
    set({ activeVideo: video, isPlaying: true });
    vjChannel.send({
      type: "SET_VIDEO",
      videoId: video.id,
      videoUrl: video.url,
      videoTitle: video.title,
      color: video.color,
    });
  },

  setPlaying: (playing: boolean) => {
    set({ isPlaying: playing });
    vjChannel.send({
      type: playing ? "PLAY" : "PAUSE",
    });
  },

  setEffect: (effect) => {
    set({ activeEffect: effect });
    vjChannel.send({
      type: "SET_EFFECT",
      effect,
    });
  },

  syncTime: (time: number) => {
    vjChannel.send({
      type: "SYNC_TIME",
      time,
    });
  },

  setWindowOpen: (open) => {
    set({ isWindowOpen: open });
  },

  rotateToNextVideo: () => {
    const { videos, activeVideo } = get();
    if (videos.length === 0) return;
    if (videos.length === 1) {
      // Re-trigger current video
      get().setActiveVideo(videos[0]);
      return;
    }

    const currentIndex = activeVideo ? videos.findIndex((v) => v.id === activeVideo.id) : -1;
    const nextIndex = (currentIndex + 1) % videos.length;
    const nextVideo = videos[nextIndex];
    get().setActiveVideo(nextVideo);
  },

  triggerDropFlash: (dropText?: string, color?: string) => {
    vjChannel.send({
      type: "DROP_FLASH",
      dropText: dropText || "🔥 DROP 🔥",
      color: color || "#ff0077",
    });
  },
}));
