"use client";

import { useEffect, useState } from "react";
import { AsciiSweep } from "../ui/AsciiSweep";
import { useAIDJStore } from "../../stores/aiDJStore";

const isRunning = () => {
  const { isActive, status } = useAIDJStore.getState();
  return isActive && (status === "mixing" || status === "transitioning");
};

function SweepPattern() {
  return <div className="autodj-sweep-pattern">
    {Array.from({ length: 24 }, (_, index) => <div key={index}>
      {Array.from({ length: 180 }, (_, col) => " .:+*#"[(col * 7 + index * 11 + Math.floor(col / 7)) % 6]).join("")}
    </div>)}
  </div>;
}

export default function AutoDJSweep() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let previous = isRunning();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useAIDJStore.subscribe(() => {
      const running = isRunning();
      if (running === previous) return;
      previous = running;
      setIndex(running ? 1 : 0);
      clearTimeout(timer);
      if (!running) { setVisible(false); return; }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      setVisible(true);
      timer = setTimeout(() => setVisible(false), 1400);
    });
    return () => { unsubscribe(); clearTimeout(timer); };
  }, []);

  return <div className="autodj-sweep-overlay" data-visible={visible} data-direction={index ? "forward" : "backward"} aria-hidden="true">
    <AsciiSweep index={index} alternate={<SweepPattern />} color="#00ff88" duration={1.35} band={0.24} glow={0.7} background="#08080d" className="autodj-sweep-canvas">
      <SweepPattern />
    </AsciiSweep>
  </div>;
}
