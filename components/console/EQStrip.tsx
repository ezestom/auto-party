"use client";

import Knob from "../ui/Knob";
import Fader from "../ui/Fader";
import { useMixerStore } from "../../stores/mixerStore";

interface EQStripProps {
  deckId: "A" | "B";
  color: string;
}

export default function EQStrip({ deckId, color }: EQStripProps) {
  const channel = useMixerStore((state) => state.channels[deckId]);
  const {
    setChannelVolume,
    setEQHi,
    setEQMid,
    setEQLo,
    setChannelGain,
  } = useMixerStore();

  return (
    <div className="flex items-center justify-between w-full bg-[#121216]/50 border border-border-custom rounded-lg p-2.5 shadow-md select-none mt-1">
      {/* 4 Linear Vertical Faders */}
      <div className="flex items-center justify-around flex-1 gap-2">
        <Fader
          value={channel.eqHi}
          onChange={(val) => setEQHi(deckId, val)}
          label="Hi"
          color={color}
          vertical
          length={56}
        />
        <Fader
          value={channel.eqMid}
          onChange={(val) => setEQMid(deckId, val)}
          label="Mid"
          color={color}
          vertical
          length={56}
        />
        <Fader
          value={channel.eqLo}
          onChange={(val) => setEQLo(deckId, val)}
          label="Low"
          color={color}
          vertical
          length={56}
        />
        <Fader
          value={channel.gain}
          onChange={(val) => setChannelGain(deckId, val)}
          label="Gain"
          color={color}
          vertical
          length={56}
        />
      </div>

      {/* Vertical Fader on the right side of Gain */}
      <div className="flex items-center pl-3 border-l border-border-custom h-11">
        <Fader
          value={channel.volume}
          onChange={(val) => setChannelVolume(deckId, val)}
          vertical
          length={56}
          color={color}
          label="Vol"
        />
      </div>
    </div>
  );
}
