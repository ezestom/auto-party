"use client";

import { create } from "zustand";

export interface SettingsState {
  isOpen: boolean;
  activeTab: "controls" | "audio" | "aidj" | "shortcuts";

  // Controls Settings
  lockPlayingDeck: boolean;
  autoPlayOnLoad: boolean;
  quantizeBeats: number; // 1 beat default

  // Audio & Mixer Settings
  autoGainEnabled: boolean;
  targetLufs: number; // -14 dBFS default
  crossfaderCurve: "LIN" | "CUT" | "CRV";

  // AI DJ & VJ Settings
  aiDefaultDuration: number; // 4, 8, 16s
  vjBeatReactivity: number; // 1.0 default

  // Actions
  setIsOpen: (open: boolean) => void;
  setActiveTab: (tab: "controls" | "audio" | "aidj" | "shortcuts") => void;
  setLockPlayingDeck: (val: boolean) => void;
  setAutoPlayOnLoad: (val: boolean) => void;
  setQuantizeBeats: (val: number) => void;
  setAutoGainEnabled: (val: boolean) => void;
  setTargetLufs: (val: number) => void;
  setCrossfaderCurve: (val: "LIN" | "CUT" | "CRV") => void;
  setAiDefaultDuration: (val: number) => void;
  setVjBeatReactivity: (val: number) => void;
  resetDefaults: () => void;
}

const STORAGE_KEY = "eze_mix_settings";

const defaultSettings = {
  isOpen: false,
  activeTab: "controls" as const,
  lockPlayingDeck: true,
  autoPlayOnLoad: false,
  quantizeBeats: 1,
  autoGainEnabled: true,
  targetLufs: -14,
  crossfaderCurve: "LIN" as const,
  aiDefaultDuration: 8,
  vjBeatReactivity: 1.0,
};

const loadInitialSettings = () => {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultSettings, ...parsed, isOpen: false };
    }
  } catch {}
  return defaultSettings;
};

const saveSettings = (state: Partial<SettingsState>) => {
  if (typeof window === "undefined") return;
  try {
    const toSave = { ...state };
    delete toSave.isOpen;
    delete toSave.activeTab;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {}
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadInitialSettings(),

  setIsOpen: (isOpen) => set({ isOpen }),
  setActiveTab: (activeTab) => set({ activeTab }),

  setLockPlayingDeck: (lockPlayingDeck) => {
    set({ lockPlayingDeck });
    saveSettings(get());
  },
  setAutoPlayOnLoad: (autoPlayOnLoad) => {
    set({ autoPlayOnLoad });
    saveSettings(get());
  },
  setQuantizeBeats: (quantizeBeats) => {
    set({ quantizeBeats });
    saveSettings(get());
  },
  setAutoGainEnabled: (autoGainEnabled) => {
    set({ autoGainEnabled });
    saveSettings(get());
  },
  setTargetLufs: (targetLufs) => {
    set({ targetLufs });
    saveSettings(get());
  },
  setCrossfaderCurve: (crossfaderCurve) => {
    set({ crossfaderCurve });
    saveSettings(get());
  },
  setAiDefaultDuration: (aiDefaultDuration) => {
    set({ aiDefaultDuration });
    saveSettings(get());
  },
  setVjBeatReactivity: (vjBeatReactivity) => {
    set({ vjBeatReactivity });
    saveSettings(get());
  },

  resetDefaults: () => {
    set(defaultSettings);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  },
}));
