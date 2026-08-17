import { create } from "zustand";

export interface ChannelMixerValues {
  gain: number;      // 0.0 to 1.0
  volume: number;    // 0.0 to 1.0
  eqHi: number;      // 0.0 to 1.0 (0.5 is center / flat)
  eqMid: number;     // 0.0 to 1.0 (0.5 is center / flat)
  eqLo: number;      // 0.0 to 1.0 (0.5 is center / flat)
  filter: number;    // 0.0 to 1.0 (0.5 is bypass / flat)
  cueActive: boolean;
  vuL: number;       // 0.0 to 1.0
  vuR: number;       // 0.0 to 1.0
  clipL?: boolean;
  clipR?: boolean;
}

interface MixerStore {
  crossfader: number;     // 0.0 (full Deck A) to 1.0 (full Deck B)
  masterVolume: number;   // 0.0 to 1.0
  headphoneVolume: number;// 0.0 to 1.0
  headphoneMix: number;   // 0.0 (Cue) to 1.0 (Master)
  boothVolume: number;    // 0.0 to 1.0
  channels: {
    A: ChannelMixerValues;
    B: ChannelMixerValues;
  };

  // Auto-Crossfade State
  isAutoCrossfading: boolean;
  autoTarget: "A" | "B" | null;
  autoDuration: number;   // In seconds: 2, 4, 8, 16

  setCrossfader: (val: number) => void;
  setMasterVolume: (val: number) => void;
  setHeadphoneVolume: (val: number) => void;
  setHeadphoneMix: (val: number) => void;
  setBoothVolume: (val: number) => void;
  setChannelGain: (deckId: "A" | "B", val: number) => void;
  setChannelVolume: (deckId: "A" | "B", val: number) => void;
  setEQHi: (deckId: "A" | "B", val: number) => void;
  setEQMid: (deckId: "A" | "B", val: number) => void;
  setEQLo: (deckId: "A" | "B", val: number) => void;
  setFilter: (deckId: "A" | "B", val: number) => void;
  toggleCue: (deckId: "A" | "B") => void;
  setVU: (deckId: "A" | "B", vuL: number, vuR: number, clipL?: boolean, clipR?: boolean) => void;
  
  // Auto-Crossfade actions
  triggerAutoCrossfade: (target?: "A" | "B" | "TOGGLE") => void;
  stopAutoCrossfade: () => void;
  setAutoDuration: (duration: number) => void;

  resetMixer: () => void;
}

const initialChannelState = (): ChannelMixerValues => ({
  gain: 0.75,
  volume: 0.8,
  eqHi: 0.75,   // normalized, matches JSX default Hi knob
  eqMid: 0.75,
  eqLo: 0.75,
  filter: 0.5,  // center / off
  cueActive: false,
  vuL: 0,
  vuR: 0,
  clipL: false,
  clipR: false,
});

const defaultState = {
  crossfader: 0.5,
  masterVolume: 0.85,
  headphoneVolume: 0.6,
  headphoneMix: 0.5,
  boothVolume: 0.7,
  isAutoCrossfading: false,
  autoTarget: null as "A" | "B" | null,
  autoDuration: 4, // default 4 seconds transition
  channels: {
    A: initialChannelState(),
    B: initialChannelState(),
  },
};

export const useMixerStore = create<MixerStore>((set, get) => ({
  ...defaultState,

  setCrossfader: (val) => set({ crossfader: Math.max(0, Math.min(1, val)) }),
  setMasterVolume: (val) => set({ masterVolume: Math.max(0, Math.min(1, val)) }),
  setHeadphoneVolume: (val) => set({ headphoneVolume: Math.max(0, Math.min(1, val)) }),
  setHeadphoneMix: (val) => set({ headphoneMix: Math.max(0, Math.min(1, val)) }),
  setBoothVolume: (val) => set({ boothVolume: Math.max(0, Math.min(1, val)) }),

  setChannelGain: (deckId, val) =>
    set((state) => ({
      channels: {
        ...state.channels,
        [deckId]: {
          ...state.channels[deckId],
          gain: Math.max(0, Math.min(1, val)),
        },
      },
    })),

  setChannelVolume: (deckId, val) =>
    set((state) => ({
      channels: {
        ...state.channels,
        [deckId]: {
          ...state.channels[deckId],
          volume: Math.max(0, Math.min(1, val)),
        },
      },
    })),

  setEQHi: (deckId, val) =>
    set((state) => ({
      channels: {
        ...state.channels,
        [deckId]: {
          ...state.channels[deckId],
          eqHi: Math.max(0, Math.min(1, val)),
        },
      },
    })),

  setEQMid: (deckId, val) =>
    set((state) => ({
      channels: {
        ...state.channels,
        [deckId]: {
          ...state.channels[deckId],
          eqMid: Math.max(0, Math.min(1, val)),
        },
      },
    })),

  setEQLo: (deckId, val) =>
    set((state) => ({
      channels: {
        ...state.channels,
        [deckId]: {
          ...state.channels[deckId],
          eqLo: Math.max(0, Math.min(1, val)),
        },
      },
    })),

  setFilter: (deckId, val) =>
    set((state) => ({
      channels: {
        ...state.channels,
        [deckId]: {
          ...state.channels[deckId],
          filter: Math.max(0, Math.min(1, val)),
        },
      },
    })),

  toggleCue: (deckId) =>
    set((state) => ({
      channels: {
        ...state.channels,
        [deckId]: {
          ...state.channels[deckId],
          cueActive: !state.channels[deckId].cueActive,
        },
      },
    })),

  setVU: (deckId, vuL, vuR, clipL = false, clipR = false) =>
    set((state) => ({
      channels: {
        ...state.channels,
        [deckId]: {
          ...state.channels[deckId],
          vuL: Math.max(0, Math.min(1, vuL)),
          vuR: Math.max(0, Math.min(1, vuR)),
          clipL,
          clipR,
        },
      },
    })),

  triggerAutoCrossfade: (explicitTarget) => {
    const { crossfader, isAutoCrossfading, autoTarget } = get();

    let target: "A" | "B" = "B";
    if (explicitTarget === "A") {
      target = "A";
    } else if (explicitTarget === "B") {
      target = "B";
    } else {
      // Toggle logic: if already fading to A, switch to B; if crossfader > 0.5, fade to A, else to B
      if (isAutoCrossfading && autoTarget) {
        target = autoTarget === "A" ? "B" : "A";
      } else {
        target = crossfader >= 0.5 ? "A" : "B";
      }
    }

    set({
      isAutoCrossfading: true,
      autoTarget: target,
    });
  },

  stopAutoCrossfade: () => {
    set({
      isAutoCrossfading: false,
      autoTarget: null,
    });
  },

  setAutoDuration: (duration) => set({ autoDuration: duration }),

  resetMixer: () => set(defaultState),
}));
