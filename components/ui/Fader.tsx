"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { RotateCcw } from "lucide-react";

interface FaderProps {
  value: number; // 0.0 to 1.0
  onChange: (val: number) => void;
  vertical?: boolean;
  length?: number; // length of the fader path in px
  color?: string;
  label?: string;
  min?: number;
  max?: number;
  center?: boolean; // If true, 0.5 is flat
  defaultValue?: number;
}

export default function Fader({
  value,
  onChange,
  vertical = true,
  length = 140,
  color = "#ff6b00",
  label,
  min = 0,
  max = 1,
  center = false,
  defaultValue = 0.5,
}: FaderProps) {
  const [dragging, setDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startPos = useRef(0);
  const startVal = useRef(0);
  const [actualLength, setActualLength] = useState(length);

  // Measure actual pixel bounds for responsive scaling
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const size = vertical ? entry.contentRect.height : entry.contentRect.width;
        if (size > 30) {
          setActualLength(size);
        } else {
          setActualLength(length);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [length, vertical]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    startPos.current = vertical ? e.clientY : e.clientX;
    startVal.current = value;
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging) return;
      const currentPos = vertical ? e.clientY : e.clientX;
      const delta = startPos.current - currentPos;
      // For vertical: dragging up (negative delta y) increases value
      // For horizontal: dragging right (positive delta x) increases value
      const travel = Math.max(20, actualLength - 24);
      const sensitivity = e.shiftKey ? 0.3 : 1.0;
      const deltaPercent = (vertical ? delta / travel : -delta / travel) * sensitivity;
      const newVal = Math.max(min, Math.min(max, startVal.current + deltaPercent));
      onChange(newVal);
    },
    [dragging, actualLength, vertical, min, max, onChange]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const step = e.shiftKey ? 0.01 : 0.03;
    const direction = e.deltaY < 0 ? 1 : -1;
    const range = max - min;
    const newVal = Math.max(min, Math.min(max, value + direction * step * range));
    onChange(newVal);
  };

  const handleDoubleClick = () => {
    onChange(defaultValue);
  };

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  // Format value display text for popup tooltip
  const formatVal = () => {
    if (center) {
      const dbVal = Math.round((value - 0.5) * 24);
      if (Math.abs(dbVal) < 1) return "FLAT";
      return dbVal > 0 ? `+${dbVal}dB` : `${dbVal}dB`;
    }
    return `${Math.round(value * 100)}%`;
  };

  // Positioning of fader thumb
  const travel = Math.max(20, actualLength - 24);
  const thumbPos = vertical ? (1 - value) * travel : value * travel;

  const isModified = Math.abs(value - defaultValue) > 0.01;

  return (
    <div className={`flex flex-col items-center gap-0.5 select-none relative group min-h-0 justify-center ${vertical ? "h-full max-h-full" : "w-full max-w-full"}`}>
      {/* High-visibility label header with Reset Action */}
      {label && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onChange(defaultValue);
          }}
          title={`Click or double-click to reset ${label}`}
          className="flex items-center gap-1 px-1 py-0.5 rounded shrink-0 group/reset hover:bg-white/10 transition-all cursor-pointer border border-transparent hover:border-white/20"
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}` }}
          />
          <span className="font-mono text-[9.5px] font-black uppercase tracking-wider text-white select-none drop-shadow">
            {label}
          </span>
          <RotateCcw
            size={9}
            className={`transition-all ${
              isModified
                ? "text-[#ff6b00] opacity-90 group-hover/reset:rotate-[-90deg]"
                : "text-[#777795] opacity-0 group-hover/reset:opacity-100"
            }`}
          />
        </button>
      )}

      {/* Floating Tooltip Value Badge on Hover or Drag */}
      {(isHovered || dragging) && (
        <div
          className="absolute -top-7 z-50 pointer-events-none px-2 py-0.5 rounded-md font-mono text-[9.5px] font-black uppercase tracking-wider text-white shadow-xl border whitespace-nowrap animate-in fade-in zoom-in-95 duration-100"
          style={{
            backgroundColor: "rgba(8, 8, 14, 0.96)",
            borderColor: color,
            boxShadow: `0 0 12px ${color}50`,
          }}
        >
          <span style={{ color }}>{label || "Val"}: </span>
          {formatVal()}
        </div>
      )}

      {/* Fader Track & Thumb Container (Responsive bounds) */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: vertical ? 22 : "100%",
          height: vertical ? "100%" : 22,
        }}
        className={`relative touch-none shrink ${
          vertical ? "cursor-ns-resize min-h-[40px] min-w-[22px]" : "cursor-ew-resize min-h-[22px] min-w-[40px] w-full"
        }`}
        title="Drag, scroll wheel, or double-click to reset"
      >
        {/* Outer Rail Track */}
        <div
          style={{
            left: vertical ? 8 : 8,
            top: vertical ? 8 : 8,
            width: vertical ? 6 : Math.max(10, actualLength - 16),
            height: vertical ? Math.max(10, actualLength - 16) : 6,
          }}
          className="absolute rounded-full bg-[#0c0c14] border border-[#2a2a3d] shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]"
        />

        {/* Active Filled Rail */}
        <div
          style={{
            left: vertical ? 8 : 8,
            bottom: vertical ? 8 : undefined,
            top: vertical ? undefined : 8,
            width: vertical ? 6 : Math.max(0, thumbPos + 4),
            height: vertical ? Math.max(0, (actualLength - 16) * value) : 6,
            background: `linear-gradient(${vertical ? "0deg" : "90deg"}, ${color}80, ${color})`,
            boxShadow: `0 0 8px ${color}60`,
          }}
          className="absolute rounded-full opacity-90 transition-all duration-75"
        />

        {/* Metallic Fader Thumb Cap */}
        <div
          style={{
            borderColor: dragging || isHovered ? color : "#3a3a4c",
            boxShadow: dragging || isHovered
              ? `0 0 14px ${color}70, 0 4px 10px rgba(0,0,0,0.8)`
              : "0 4px 8px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.15)",
            left: vertical ? -1 : thumbPos,
            top: vertical ? thumbPos : -1,
            width: vertical ? 24 : 24,
            height: vertical ? 24 : 24,
          }}
          className={`absolute flex items-center justify-center rounded-md border cursor-pointer transition-shadow duration-150 bg-gradient-to-b from-[#353548] via-[#222230] to-[#12121a] ${
            dragging ? "scale-105" : ""
          }`}
        >
          {/* Thumb Illuminated Center Marker Line */}
          <div
            style={{
              width: vertical ? 14 : 2,
              height: vertical ? 2 : 14,
              backgroundColor: color,
              boxShadow: `0 0 6px ${color}`,
            }}
            className="rounded-full"
          />
        </div>
      </div>
    </div>
  );
}
