"use client";

import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GripHorizontal, Tv, X } from "lucide-react";
import { useVJStore } from "../../stores/vjStore";
import VJDisplay from "./VJDisplay";

type Position = { x: number; y: number };

export default memo(function VJMiniPlayer() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 8, y: 80 });
  const [message, setMessage] = useState("");
  const panel = useRef<HTMLElement>(null);
  const projection = useRef<Window | null>(null);
  const drag = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const initialized = useRef(false);

  const clamp = (point: Position) => ({
    x: Math.max(8, Math.min(point.x, window.innerWidth - (panel.current?.offsetWidth || 280) - 8)),
    y: Math.max(8, Math.min(point.y, window.innerHeight - (panel.current?.offsetHeight || 194) - 8)),
  });

  useEffect(() => {
    setMounted(true);
    const resize = () => setPosition(point => clamp(point));
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const openVisuals = () => {
    const store = useVJStore.getState();
    if (!store.activeVideo && store.videos.length) store.setActiveVideo(store.videos[0]);
    if (!projection.current || projection.current.closed) {
      projection.current = window.open("/vj", "EZE_MIX_VJ_WINDOW", "popup,width=1280,height=720,menubar=no,toolbar=no");
      setMessage(projection.current ? "" : "Allow pop-ups to open the TV / projector window.");
    }
    if (!initialized.current) {
      setPosition(clamp({ x: window.innerWidth - 296, y: window.innerHeight - 234 }));
      initialized.current = true;
    }
    setOpen(true);
  };

  return <>
    <button id="vj-display-btn" onClick={() => { if (open) { setOpen(false); projection.current?.close(); projection.current = null; } else openVisuals(); }} aria-label={open ? "Turn visuals off" : "Turn visuals on"} aria-expanded={open}
      title="Open DJ preview and TV / projector"
      className={`flex items-center gap-1 px-3 py-1.5 text-[10px] font-mono font-black rounded-lg border cursor-pointer uppercase shrink-0 ${open ? "border-[#00d4ff] text-[#00d4ff] bg-[#00d4ff18]" : "border-[#34344c] text-[#aaaabd] bg-[#151520]"}`}>
      <Tv size={12} /> Visuals {open ? "ON" : "OFF"}
    </button>
    {mounted && createPortal(
      <section ref={panel} aria-label="DJ video preview" className="vj-preview"
        style={{ left: position.x, top: position.y, display: open ? "block" : "none" }}>
        <header className="vj-preview-header">
          <div role="button" tabIndex={0} aria-label="Move DJ preview" className="vj-preview-drag"
            onKeyDown={event => {
              const moves: Record<string, Position> = { ArrowLeft: { x: -16, y: 0 }, ArrowRight: { x: 16, y: 0 }, ArrowUp: { x: 0, y: -16 }, ArrowDown: { x: 0, y: 16 } };
              const move = moves[event.key];
              if (move) { event.preventDefault(); setPosition(point => clamp({ x: point.x + move.x, y: point.y + move.y })); }
              if (event.key === "Escape") setOpen(false);
            }}
            onPointerDown={event => {
              if (event.button !== 0) return;
              const bounds = panel.current!.getBoundingClientRect();
              drag.current = { id: event.pointerId, dx: event.clientX - bounds.x, dy: event.clientY - bounds.y };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={event => {
              if (drag.current?.id !== event.pointerId) return;
              setPosition(clamp({ x: event.clientX - drag.current.dx, y: event.clientY - drag.current.dy }));
            }}
            onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
            <GripHorizontal size={14} /> DJ preview
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close DJ preview"><X size={15} /></button>
        </header>
        {message && <p role="alert" className="px-3 py-2 text-xs text-amber-200">{message}</p>}
        <div className="vj-preview-screen"><VJDisplay preview /></div>
      </section>, document.body)}
  </>;
});
