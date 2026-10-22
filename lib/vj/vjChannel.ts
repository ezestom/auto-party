"use client";

export interface VJStateMessage {
  type: "CLEAR_VIDEO" | "SET_VIDEO" | "PLAY" | "PAUSE" | "BEAT_PULSE" | "SET_EFFECT" | "SYNC_TIME" | "DROP_FLASH";
  playing?: boolean;
  videoId?: string;
  videoUrl?: string;
  videoTitle?: string;
  color?: string;
  effect?: "NORMAL" | "STROBE" | "GLITCH" | "NEON_WAVE";
  bpm?: number;
  time?: number;
  dropText?: string;
}

const CHANNEL_NAME = "eze_mix_vj_channel";

class VJChannelManager {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(msg: VJStateMessage) => void> = new Set();

  constructor() {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event) => {
        const msg = event.data as VJStateMessage;
        this.listeners.forEach((listener) => listener(msg));
      };
    }
  }

  public send(msg: VJStateMessage) {
    if (typeof window !== "undefined" && ["SET_VIDEO", "CLEAR_VIDEO", "PLAY", "PAUSE"].includes(msg.type)) {
      try {
        const previous = JSON.parse(localStorage.getItem("eze_mix_vj_sync") || "{}");
        const snapshot = msg.type === "CLEAR_VIDEO" ? { type: "CLEAR_VIDEO" }
          : msg.type === "SET_VIDEO" ? { ...msg, playing: true }
          : { ...previous, playing: msg.type === "PLAY" };
        localStorage.setItem("eze_mix_vj_sync", JSON.stringify({ ...snapshot, _t: Date.now() }));
      } catch { /* Projection still receives live updates when storage is unavailable. */ }
    }
    this.listeners.forEach(listener => listener(msg));
    this.channel?.postMessage(msg);
  }

  public subscribe(callback: (msg: VJStateMessage) => void): () => void {
    this.listeners.add(callback);

    // Fallback listener for localStorage sync
    const storageHandler = (e: StorageEvent) => {
      if (!this.channel && e.key === "eze_mix_vj_sync" && e.newValue) {
        try {
          const msg = JSON.parse(e.newValue);
          callback(msg);
        } catch {}
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("storage", storageHandler);
    }

    return () => {
      this.listeners.delete(callback);
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", storageHandler);
      }
    };
  }
}

export const vjChannel = new VJChannelManager();
