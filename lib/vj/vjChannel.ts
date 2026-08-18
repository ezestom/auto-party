"use client";

export interface VJStateMessage {
  type: "SET_VIDEO" | "PLAY" | "PAUSE" | "BEAT_PULSE" | "SET_EFFECT" | "SYNC_TIME";
  videoId?: string;
  videoUrl?: string;
  videoTitle?: string;
  color?: string;
  effect?: "NORMAL" | "STROBE" | "GLITCH" | "NEON_WAVE";
  bpm?: number;
  time?: number;
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
    if (this.channel) {
      this.channel.postMessage(msg);
    } else if (typeof window !== "undefined") {
      // Fallback using localStorage sync event
      localStorage.setItem("eze_mix_vj_sync", JSON.stringify({ ...msg, _t: Date.now() }));
    }
  }

  public subscribe(callback: (msg: VJStateMessage) => void): () => void {
    this.listeners.add(callback);

    // Fallback listener for localStorage sync
    const storageHandler = (e: StorageEvent) => {
      if (e.key === "eze_mix_vj_sync" && e.newValue) {
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
