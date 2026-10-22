"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

interface KnobProps {
  value: number; // 0.0 to 1.0
  onChange: (val: number) => void;
  label: string;
  color?: string; // Hex color string
  size?: number; // px diameter
  min?: number;
  max?: number;
  center?: boolean; // If true, 0.5 is flat and the arc draws left/right from middle
  defaultValue?: number;
}

export default function Knob({
  value,
  onChange,
  label,
  color = "#ff6b00",
  size = 36,
  min = 0,
  max = 1,
  center = false,
  defaultValue = 0.5,
}: KnobProps) {
  const [dragging, setDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(0);
  const activePointer = useRef<number | null>(null);

  // Map 0..1 to -135deg..135deg rotation
  const angle = -135 + value * 270;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (activePointer.current !== null || e.button !== 0) return;
    activePointer.current = e.pointerId;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    startY.current = e.clientY;
    startVal.current = value;
  };

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (e.pointerId !== activePointer.current) return;
      // Moving mouse UP (smaller clientY) increases value
      const dy = startY.current - e.clientY;
      const sensitivity = e.shiftKey ? 0.002 : 0.006; // Hold Shift for fine tuning
      const range = max - min;
      const newVal = Math.max(min, Math.min(max, startVal.current + dy * sensitivity * range));
      onChange(newVal);
    },
    [min, max, onChange]
  );

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (e.pointerId !== activePointer.current) return;
    activePointer.current = null;
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

  useEffect(() => {
    if (dragging) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    }
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [dragging, handlePointerMove, handlePointerUp]);

  const handleDoubleClick = () => {
    onChange(defaultValue);
  };

  // Format value display text
  const formatVal = () => {
    if (center) {
      const dbVal = Math.round((value - 0.5) * 24);
      if (Math.abs(dbVal) < 1) return "FLAT";
      return dbVal > 0 ? `+${dbVal}dB` : `${dbVal}dB`;
    }
    return `${Math.round(value * 100)}%`;
  };

  const r = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  const rad = (angle * Math.PI) / 180;
  const ix = cx + r * Math.sin(rad);
  const iy = cy - r * Math.cos(rad);

  // Calculate SVG arc path
  const startAngle = center ? 0 : -135;
  const startRad = (startAngle * Math.PI) / 180;
  const endAngle = angle;
  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  const sweepFlag = endAngle >= startAngle ? 1 : 0;

  const sx = cx + r * Math.sin(startRad);
  const sy = cy - r * Math.cos(startRad);

  const pathD =
    dragging || Math.abs(endAngle - startAngle) > 2
      ? `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${ix} ${iy}`
      : "";

  return (
    <div className="flex flex-col items-center gap-0.5 relative group">
      {/* Floating Tooltip Value Badge on Hover or Drag */}
      {(isHovered || dragging) && (
        <div
          className="absolute -top-7 z-50 pointer-events-none px-2 py-0.5 rounded-md font-mono text-[9px] font-black uppercase tracking-wider text-white shadow-lg border whitespace-nowrap animate-in fade-in zoom-in-95 duration-100"
          style={{
            backgroundColor: "rgba(10, 10, 16, 0.95)",
            borderColor: color,
            boxShadow: `0 0 10px ${color}40`,
          }}
        >
          <span style={{ color }}>{label}: </span>
          {formatVal()}
        </div>
      )}

      {/* Knob Dial Wrapper */}
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-orientation="vertical"
        onKeyDown={(event) => {
          const direction = ["ArrowUp", "ArrowRight"].includes(event.key) ? 1 : ["ArrowDown", "ArrowLeft"].includes(event.key) ? -1 : 0;
          if (!direction && event.key !== "Home" && event.key !== "End") return;
          event.preventDefault();
          onChange(event.key === "Home" ? min : event.key === "End" ? max : Math.max(min, Math.min(max, value + direction * (max - min) * (event.shiftKey ? 0.001 : 0.01))));
        }}
        onPointerDown={handlePointerDown}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ width: size, height: size }}
        className="relative cursor-ns-resize select-none touch-none rounded-full transition-transform active:scale-95"
        title="Drag UP/DOWN or scroll wheel to change value. Double-click to reset."
      >
        {/* Visual vertical drag arrow cues */}
        {(isHovered || dragging) && (
          <div className="absolute inset-0 flex flex-col justify-between items-center pointer-events-none p-[1px] opacity-70 z-20">
            <ChevronUp size={8} style={{ color }} className="animate-pulse" />
            <ChevronDown size={8} style={{ color }} className="animate-pulse" />
          </div>
        )}

        <svg width={size} height={size}>
          <defs>
            <radialGradient id={`kg-${label}-${color}`} cx="40%" cy="35%">
              <stop offset="0%" stopColor="#353545" />
              <stop offset="60%" stopColor="#1a1a24" />
              <stop offset="100%" stopColor="#0c0c12" />
            </radialGradient>
            <filter id={`glow-${label}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Dial Base Bezel */}
          <circle
            cx={cx}
            cy={cy}
            r={size / 2 - 1.5}
            fill={`url(#kg-${label}-${color})`}
            stroke={dragging || isHovered ? color : "#2a2a38"}
            strokeWidth={dragging ? 2 : 1.2}
            style={{
              boxShadow: dragging ? `0 0 12px ${color}60` : "none",
            }}
          />

          {/* Outer Track Guide */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#3a3a4c"
            strokeWidth="2.5"
            strokeDasharray={`${r * 2 * Math.PI * 0.75} ${r * 2 * Math.PI * 0.25}`}
            strokeDashoffset={r * 2 * Math.PI * 0.25}
            strokeLinecap="round"
            opacity="0.35"
          />

          {/* Value Arc Line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={color}
              strokeWidth="2.8"
              strokeLinecap="round"
              filter={`url(#glow-${label})`}
              opacity={dragging ? 1 : 0.85}
            />
          )}

          {/* Rotary Indicator Line & Dot */}
          <line
            x1={cx}
            y1={cy}
            x2={ix}
            y2={iy}
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.9"
          />
          <circle cx={ix} cy={iy} r={2.4} fill="#ffffff" />

          {/* Center Cap */}
          <circle cx={cx} cy={cy} r={size * 0.2} fill="#12121a" stroke="#2a2a38" strokeWidth="1" />
          <circle cx={cx} cy={cy} r={1.5} fill={color} opacity="0.8" />
        </svg>
      </div>

      {/* Label under knob */}
      <span className="font-mono text-[7.5px] font-black uppercase tracking-wider text-[#8888a0] select-none">
        {label}
      </span>
    </div>
  );
}
