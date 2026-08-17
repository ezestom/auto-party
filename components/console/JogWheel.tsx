"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useDeckStore } from "../../stores/deckStore";
import { getAudioEngine } from "../../lib/audio/AudioEngine";

interface JogWheelProps {
  deckId: "A" | "B";
  color: string;
  size?: number;
}

export default function JogWheel({ deckId, color, size = 340 }: JogWheelProps) {
  const deck = useDeckStore((s) => s.decks[deckId]);
  const { setProgress } = useDeckStore();

  const baseSize = size || 340;
  const cx = baseSize / 2;
  const cy = baseSize / 2;
  const outerR = baseSize / 2 - 6;
  const innerR = outerR - 18;
  const artworkR = baseSize * 0.24;
  const labelR = baseSize * 0.19;

  // Physics state
  const [rotation, setRotation] = useState(0);
  const [isScratchMode, setIsScratchMode] = useState(false);

  // Refs for pointer capture
  const svgRef = useRef<SVGSVGElement>(null);
  const lastAngleRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const velocityRef = useRef(0);
  const inertiaRef = useRef<number | null>(null);
  const rotRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);
  const animLastTimeRef = useRef<number>(0);

  // Animate playback rotation using real time-delta and BPM turntable equations
  useEffect(() => {
    if (isScratchMode) return;

    animLastTimeRef.current = performance.now();

    const animate = () => {
      if (isScratchMode) return;

      const now = performance.now();
      const dt = Math.max(0, Math.min(0.1, (now - animLastTimeRef.current) / 1000));
      animLastTimeRef.current = now;

      if (deck.isPlaying) {
        // Turntable standard is 33.33 RPM. At 100% pitch/tempo, it rotates at 33.33 RPM.
        const rpm = 33.33 * (1 + deck.tempoOffset);
        const degreesPerSecond = (rpm / 60) * 360;
        const deltaTheta = degreesPerSecond * dt;
        rotRef.current = (rotRef.current + deltaTheta) % 360;
        setRotation(rotRef.current);
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [deck.isPlaying, deck.tempoOffset, isScratchMode]);

  // Inertia decay with exponential coast damping and audio rate decay
  const startInertia = useCallback(() => {
    if (inertiaRef.current) cancelAnimationFrame(inertiaRef.current);

    const decay = () => {
      velocityRef.current *= 0.94;
      if (Math.abs(velocityRef.current) < 0.05) {
        velocityRef.current = 0;
        setIsScratchMode(false);
        if (deck.isPlaying) {
          getAudioEngine().setPlaybackRate(deckId, 1.0);
        } else {
          getAudioEngine().stop(deckId);
        }
        return;
      }
      rotRef.current = (rotRef.current + velocityRef.current) % 360;
      setRotation(rotRef.current);

      // Smooth pitch down during coast
      const degPerSec = velocityRef.current * 60;
      const rate = Math.abs(degPerSec / 200);
      getAudioEngine().setPlaybackRate(deckId, rate);

      inertiaRef.current = requestAnimationFrame(decay);
    };
    inertiaRef.current = requestAnimationFrame(decay);
  }, [deck.isPlaying, deckId]);

  // Get pointer angle relative to center using viewBox ratio for perfect responsiveness
  const getAngle = (e: React.PointerEvent<SVGSVGElement> | PointerEvent): number => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    svgRef.current!.setPointerCapture(e.pointerId);
    if (inertiaRef.current) cancelAnimationFrame(inertiaRef.current);
    lastAngleRef.current = getAngle(e);
    lastTimeRef.current = Date.now();
    velocityRef.current = 0;
    setIsScratchMode(true);

    if (!deck.isPlaying) {
      getAudioEngine().play(deckId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isScratchMode || lastAngleRef.current === null) return;
    e.preventDefault();

    const now = Date.now();
    const dt = Math.max(now - lastTimeRef.current, 1);
    const currentAngle = getAngle(e);
    let delta = currentAngle - lastAngleRef.current;

    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    velocityRef.current = delta * 0.6 + velocityRef.current * 0.4;
    rotRef.current = (rotRef.current + delta) % 360;
    setRotation(rotRef.current);

    const degPerSec = (delta / dt) * 1000;
    const rate = Math.abs(degPerSec / 200);
    getAudioEngine().setPlaybackRate(deckId, rate);

    const progressDelta = delta / 3600;
    const newProgress = Math.max(0, Math.min(1, deck.progress + progressDelta));
    setProgress(deckId, newProgress);

    lastAngleRef.current = currentAngle;
    lastTimeRef.current = now;
  };

  const handlePointerUp = () => {
    lastAngleRef.current = null;
    startInertia();
  };

  // Progress arc
  const progressCircumference = 2 * Math.PI * (outerR - 3);
  const progressDash = deck.progress * progressCircumference;

  // SVG groove rings
  const grooveCount = 24;
  const grooves = Array.from({ length: grooveCount }, (_, i) => {
    return artworkR + 6 + (i * (innerR - artworkR - 6)) / grooveCount;
  });

  // Radial spoke lines
  const spokeCount = 96;
  const spokes = Array.from({ length: spokeCount }, (_, i) => {
    const angle = (i * 360) / spokeCount;
    const rad = (angle * Math.PI) / 180;
    const r1 = artworkR + 8;
    const r2 = innerR - 3;
    return {
      x1: cx + r1 * Math.cos(rad),
      y1: cy + r1 * Math.sin(rad),
      x2: cx + r2 * Math.cos(rad),
      y2: cy + r2 * Math.sin(rad),
      opacity: i % 8 === 0 ? 0.25 : i % 4 === 0 ? 0.12 : 0.04,
      width: i % 8 === 0 ? 1.5 : 0.6,
    };
  });

  // Vinyl label ring dots
  const dotCount = 32;
  const dots = Array.from({ length: dotCount }, (_, i) => {
    const angle = (i * 360) / dotCount;
    const rad = (angle * Math.PI) / 180;
    const r = artworkR + 3;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
      highlight: i % 4 === 0,
    };
  });

  const colorDim = deckId === "A" ? "#ff6b0035" : "#00d4ff35";
  const colorMid = deckId === "A" ? "#ff6b0090" : "#00d4ff90";

  // Track display info
  const trackTitle = deck.track ? deck.track.title : "NO TRACK LOADED";
  const trackArtist = deck.track ? deck.track.artist : "SELECT FROM LIBRARY";
  const bpmKey = deck.track
    ? `${deck.track.key} · ${deck.track.bpm} BPM`
    : `-- · ${deck.bpm.toFixed(0)} BPM`;

  return (
    <div
      className="relative flex items-center justify-center select-none group w-full h-full max-w-[340px] max-h-[340px] aspect-square shrink min-w-[160px] min-h-[160px]"
    >
      {/* Outer neon cyber aura glow (responsive) */}
      <div
        className="absolute rounded-full pointer-events-none transition-all duration-500 inset-0"
        style={{
          boxShadow: deck.isPlaying
            ? `0 0 45px ${color}45, 0 0 90px ${color}20, inset 0 0 40px rgba(0,0,0,0.9)`
            : `0 0 20px rgba(0,0,0,0.8), inset 0 0 40px rgba(0,0,0,0.9)`,
          background: "radial-gradient(circle, #1a1a24 0%, #08080d 100%)",
        }}
      />

      <svg
        ref={svgRef}
        viewBox={`0 0 ${baseSize} ${baseSize}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ cursor: isScratchMode ? "grabbing" : "grab", touchAction: "none" }}
        className="w-full h-full max-w-full max-h-full relative z-10 drop-shadow-2xl"
      >
        <defs>
          {/* Metal platter gradient */}
          <radialGradient id={`metal-${deckId}`} cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#454556" />
            <stop offset="25%" stopColor="#282835" />
            <stop offset="60%" stopColor="#161622" />
            <stop offset="100%" stopColor="#0a0a0f" />
          </radialGradient>

          {/* Cyber glossy metal sheen */}
          <linearGradient id={`sheen-${deckId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="45%" stopColor="rgba(255,255,255,0.02)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
          </linearGradient>

          {/* Center artwork gradient */}
          <radialGradient id={`art-${deckId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colorMid} />
            <stop offset="60%" stopColor={colorDim} />
            <stop offset="100%" stopColor="rgba(5,5,10,0.95)" />
          </radialGradient>

          {/* Center label LCD gradient */}
          <radialGradient id={`label-${deckId}`} cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#222230" />
            <stop offset="70%" stopColor="#101018" />
            <stop offset="100%" stopColor="#08080e" />
          </radialGradient>

          {/* Progress glow filter */}
          <filter id={`glow-${deckId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* === OUTER RING BEZEL & HARDWARE EDGE === */}
        <circle
          cx={cx} cy={cy} r={outerR + 3}
          fill="none"
          stroke="#252536"
          strokeWidth="3"
        />
        <circle
          cx={cx} cy={cy} r={outerR}
          fill="#0c0c12"
          stroke="#35354a"
          strokeWidth="1.5"
        />

        {/* === PROGRESS ARC TRACK === */}
        <circle
          cx={cx} cy={cy} r={outerR - 3}
          fill="none"
          stroke="#161622"
          strokeWidth="7"
        />
        {/* Active Progress Arc */}
        <circle
          cx={cx} cy={cy} r={outerR - 3}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeDasharray={`${progressDash} ${progressCircumference}`}
          strokeDashoffset={progressCircumference * 0.25}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          opacity={0.95}
          filter={deck.isPlaying ? `url(#glow-${deckId})` : undefined}
          style={{ transition: "stroke-dasharray 0.08s linear" }}
        />

        {/* === SPINNING PLATTER GROUP === */}
        <g transform={`rotate(${rotation} ${cx} ${cy})`}>
          {/* Platter base metal */}
          <circle
            cx={cx} cy={cy} r={innerR}
            fill={`url(#metal-${deckId})`}
          />

          {/* Platter gloss sheen */}
          <circle
            cx={cx} cy={cy} r={innerR}
            fill={`url(#sheen-${deckId})`}
          />

          {/* Groove rings */}
          {grooves.map((r, i) => (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={i % 4 === 0 ? 1.4 : 0.6}
            />
          ))}

          {/* Radial spokes */}
          {spokes.map((s, i) => (
            <line
              key={i}
              x1={s.x1} y1={s.y1}
              x2={s.x2} y2={s.y2}
              stroke="rgba(255,255,255,1)"
              strokeWidth={s.width}
              opacity={s.opacity}
            />
          ))}

          {/* Top marker dot (Slipmat position marker) */}
          <circle
            cx={cx} cy={cy - innerR + 8}
            r={4.5}
            fill={color}
            opacity={0.95}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
          <circle
            cx={cx} cy={cy - innerR + 8}
            r={1.8}
            fill="#ffffff"
          />
        </g>

        {/* === SLOW SPINNING ARTWORK GROUP (10% Speed) === */}
        <g transform={`rotate(${rotation * 0.1} ${cx} ${cy})`}>
          {/* Inner vinyl label area */}
          <circle
            cx={cx} cy={cy} r={artworkR + 4}
            fill="#08080d"
            stroke={`${color}40`}
            strokeWidth="1.5"
          />

          {/* Artwork circle */}
          <circle
            cx={cx} cy={cy} r={artworkR}
            fill={`url(#art-${deckId})`}
          />

          {/* Artwork pulse rings when playing */}
          {deck.isPlaying && [0.55, 0.72, 0.88].map((scale, i) => (
            <circle
              key={i}
              cx={cx} cy={cy}
              r={artworkR * scale}
              fill="none"
              stroke={color}
              strokeWidth="0.8"
              opacity={0.25 - i * 0.06}
            />
          ))}

          {/* Artwork cross-hair precision lines */}
          <line x1={cx - artworkR} y1={cy} x2={cx + artworkR} y2={cy}
            stroke={`${color}30`} strokeWidth="0.8" />
          <line x1={cx} y1={cy - artworkR} x2={cx} y2={cy + artworkR}
            stroke={`${color}30`} strokeWidth="0.8" />

          {/* Label dots ring */}
          {dots.map((d, i) => (
            <circle
              key={i}
              cx={d.x} cy={d.y} r={d.highlight ? 2.2 : 1.2}
              fill={d.highlight ? color : "rgba(255,255,255,0.2)"}
              opacity={d.highlight ? 0.85 : 0.4}
            />
          ))}
        </g>

        {/* === STATIC CENTER LCD SCREEN (does not rotate) === */}
        <circle
          cx={cx} cy={cy} r={labelR}
          fill={`url(#label-${deckId})`}
          stroke={`${color}60`}
          strokeWidth="1.5"
        />

        {/* Center LCD display text overlay */}
        {/* Key / BPM badge */}
        <text
          x={cx} y={cy - labelR * 0.45}
          textAnchor="middle"
          fill={color}
          fontSize="9.5"
          fontFamily="DM Mono, monospace"
          fontWeight="800"
          letterSpacing="1.8"
        >
          {bpmKey}
        </text>

        {/* Track Title */}
        <text
          x={cx} y={cy - labelR * 0.02}
          textAnchor="middle"
          fill="#ffffff"
          fontSize="11.5"
          fontFamily="Syne, sans-serif"
          fontWeight="900"
          letterSpacing="-0.3"
        >
          {trackTitle.length > 16 ? trackTitle.substring(0, 16) + "…" : trackTitle}
        </text>

        {/* Artist Name */}
        <text
          x={cx} y={cy + labelR * 0.38}
          textAnchor="middle"
          fill="#9999b0"
          fontSize="8.5"
          fontFamily="DM Mono, monospace"
          fontWeight="500"
        >
          {trackArtist.length > 18 ? trackArtist.substring(0, 18) + "…" : trackArtist}
        </text>

        {/* Deck Identifier Badge */}
        <text
          x={cx} y={cy + labelR * 0.66}
          textAnchor="middle"
          fill={`${color}aa`}
          fontSize="8"
          fontFamily="DM Mono, monospace"
          fontWeight="900"
          letterSpacing="3.5"
        >
          DECK {deckId}
        </text>

        {/* === SCRATCH MODE INDICATOR RING === */}
        {isScratchMode && (
          <circle
            cx={cx} cy={cy} r={outerR + 2}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            opacity="0.8"
            style={{ filter: `drop-shadow(0 0 8px ${color})` }}
          />
        )}
      </svg>

      {/* Real-time Scratch direction & velocity indicator tag */}
      {isScratchMode && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[9px] font-black tracking-widest px-2.5 py-0.5 rounded-full border bg-black/90 pointer-events-none z-20 shadow-lg animate-pulse"
          style={{ color, borderColor: color, boxShadow: `0 0 10px ${color}50` }}
        >
          SCRATCH {velocityRef.current > 0 ? "▶▶" : "◀◀"}
        </div>
      )}
    </div>
  );
}
