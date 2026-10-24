"use client";

import { create } from "zustand";

type SettingsTab = "controls" | "audio" | "aidj" | "shortcuts";
interface Preferences {
  lockPlayingDeck: boolean;
  autoPlayOnLoad: boolean;
  autoGainEnabled: boolean;
  crossfaderCurve: "LIN" | "CUT" | "CRV";
  aiDefaultDuration: number;
  aiEffectsEnabled: boolean;
  aiPointerEnabled: boolean;
}
export interface SettingsState extends Preferences {
  isOpen: boolean;
  activeTab: SettingsTab;
  setIsOpen: (open: boolean) => void;
  setActiveTab: (tab: SettingsTab) => void;
  setLockPlayingDeck: (value: boolean) => void;
  setAutoPlayOnLoad: (value: boolean) => void;
  setAutoGainEnabled: (value: boolean) => void;
  setCrossfaderCurve: (value: "LIN" | "CUT" | "CRV") => void;
  setAiDefaultDuration: (value: number) => void;
  setAiEffectsEnabled: (value: boolean) => void;
  setAiPointerEnabled: (value: boolean) => void;
  resetDefaults: () => void;
}

const STORAGE_KEY = "eze_mix_settings";
const defaults: Preferences = { lockPlayingDeck: true, autoPlayOnLoad: false, autoGainEnabled: true, crossfaderCurve: "LIN", aiDefaultDuration: 8, aiEffectsEnabled: true, aiPointerEnabled: true };

function loadPreferences(): Preferences {
  const saved = { ...defaults };
  if (typeof window === "undefined") return saved;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return saved;
    const parsed = JSON.parse(raw);
    for (const key of ["lockPlayingDeck", "autoPlayOnLoad", "autoGainEnabled", "aiEffectsEnabled", "aiPointerEnabled"] as const) {
      if (typeof parsed[key] === "boolean") saved[key] = parsed[key];
    }
    if (["LIN", "CUT", "CRV"].includes(parsed.crossfaderCurve)) saved.crossfaderCurve = parsed.crossfaderCurve;
    if ([4, 8, 16].includes(parsed.aiDefaultDuration)) saved.aiDefaultDuration = parsed.aiDefaultDuration;
  } catch { /* Safe defaults also cover older or damaged preferences. */ }
  return saved;
}

function savePreferences(state: Preferences) {
  if (typeof window === "undefined") return;
  const { lockPlayingDeck, autoPlayOnLoad, autoGainEnabled, crossfaderCurve, aiDefaultDuration, aiEffectsEnabled, aiPointerEnabled } = state;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ lockPlayingDeck, autoPlayOnLoad, autoGainEnabled, crossfaderCurve, aiDefaultDuration, aiEffectsEnabled, aiPointerEnabled })); } catch {}
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadPreferences(), isOpen: false, activeTab: "controls",
  setIsOpen: isOpen => set({ isOpen }),
  setActiveTab: activeTab => set({ activeTab }),
  setLockPlayingDeck: lockPlayingDeck => { set({ lockPlayingDeck }); savePreferences(get()); },
  setAutoPlayOnLoad: autoPlayOnLoad => { set({ autoPlayOnLoad }); savePreferences(get()); },
  setAutoGainEnabled: autoGainEnabled => { set({ autoGainEnabled }); savePreferences(get()); },
  setCrossfaderCurve: crossfaderCurve => { set({ crossfaderCurve }); savePreferences(get()); },
  setAiDefaultDuration: aiDefaultDuration => { set({ aiDefaultDuration }); savePreferences(get()); },
  setAiEffectsEnabled: aiEffectsEnabled => { set({ aiEffectsEnabled }); savePreferences(get()); },
  setAiPointerEnabled: aiPointerEnabled => { set({ aiPointerEnabled }); savePreferences(get()); },
  resetDefaults: () => {
    set(defaults);
    if (typeof window !== "undefined") { try { localStorage.removeItem(STORAGE_KEY); } catch {} }
  },
}));
