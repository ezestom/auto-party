"use client";

import { useEffect, useState, useRef } from "react";
import { vjChannel, type VJStateMessage } from "../../lib/vj/vjChannel";
import { playbackTime } from "../../lib/vj/playbackClock";
import { useVJStore } from "../../stores/vjStore";
import { Maximize2, Tv, X, Activity } from "lucide-react";
import { db } from "../../lib/db/dexie";
import Laser from "../ui/Laser";

export default function VJDisplay({ preview = false }: { preview?: boolean }) {
  const activeVideo = useVJStore(s => s.activeVideo);
  const playing = useVJStore(s => s.isPlaying);
  const [source, setSource] = useState("");
  const [title, setTitle] = useState("STANDBY — NO VIDEO LOADED");
  const [isPlaying, setIsPlaying] = useState(true);
  const [bpm, setBpm] = useState(128);
  const [dropFlash, setDropFlash] = useState(false);
  const [dropText, setDropText] = useState("🔥 DROP 🔥");
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const latestClock = useRef<VJStateMessage | null>(null);
  const videoUrl = preview ? activeVideo?.url || "" : source;
  const videoTitle = preview ? activeVideo?.title || "STANDBY — NO VIDEO LOADED" : title;
  const shouldPlay = preview ? playing : isPlaying;

  const applyClock = () => {
    const video = videoRef.current, clock = latestClock.current;
    if (preview || !video || video.readyState < 1 || !clock) return;
    const target = playbackTime(clock, video.duration);
    if (target !== null && Math.abs(video.currentTime - target) > (clock.playing ? 0.15 : 0.01)) video.currentTime = target;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (shouldPlay) void video.play().catch(() => {});
    else video.pause();
  }, [videoUrl, shouldPlay]);

  // The DJ's player remains mounted when its preview is closed and owns the timeline.
  useEffect(() => {
    if (!preview) return;
    const publish = () => {
      const video = videoRef.current;
      if (video && video.readyState >= 1) useVJStore.getState().syncTime(video.currentTime, !video.paused);
    };
    const timer = window.setInterval(publish, 250);
    document.addEventListener("visibilitychange", publish);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", publish); };
  }, [preview]);

  useEffect(() => {
    let cancelled = false, revision = 0;
    let activeId: string | undefined;
    let ownedUrl = "";
    let flashTimer: ReturnType<typeof setTimeout> | undefined;
    const resolveSource = async (msg: VJStateMessage) => {
      const request = ++revision;
      activeId = msg.videoId;
      latestClock.current = null;
      setTitle(msg.videoTitle || "STANDBY — NO VIDEO LOADED");
      setIsPlaying(msg.playing !== false);
      if (msg.bpm) setBpm(msg.bpm);
      let url = msg.videoUrl || "", created = false;
      try {
        const saved = msg.videoId ? await db.videos.get(msg.videoId) : undefined;
        if (saved?.videoData) { url = URL.createObjectURL(new Blob([saved.videoData])); created = true; }
      } catch { /* A live object URL can still be used if storage is unavailable. */ }
      if (cancelled || request !== revision) { if (created) URL.revokeObjectURL(url); return; }
      if (ownedUrl) URL.revokeObjectURL(ownedUrl);
      ownedUrl = created ? url : "";
      setSource(url);
      if (!latestClock.current && msg.time !== undefined) latestClock.current = msg;
    };
    const receive = (msg: VJStateMessage) => {
      if (msg.type === "DROP_FLASH") {
        setDropFlash(true); if (msg.dropText) setDropText(msg.dropText);
        clearTimeout(flashTimer); flashTimer = setTimeout(() => setDropFlash(false), 1200);
      } else if (msg.type === "BEAT_PULSE" && msg.bpm) setBpm(msg.bpm);
      if (preview) {
        if (msg.type === "SET_VIDEO" && videoRef.current) videoRef.current.currentTime = 0;
        return;
      }
      if (msg.type === "CLEAR_VIDEO") {
        ++revision; activeId = undefined; latestClock.current = null;
        setSource(""); setTitle("STANDBY — NO VIDEO LOADED"); setIsPlaying(false);
        if (ownedUrl) URL.revokeObjectURL(ownedUrl); ownedUrl = "";
      } else if (msg.type === "SET_VIDEO") void resolveSource(msg);
      else if (msg.type === "PLAY" || msg.type === "PAUSE") setIsPlaying(msg.type === "PLAY");
      else if (msg.type === "SYNC_TIME" && msg.videoId !== activeId && msg.videoId) void resolveSource(msg);
      else if (msg.type === "SYNC_TIME" && msg.videoId === activeId) {
        latestClock.current = msg; setIsPlaying(msg.playing !== false);
        const video = videoRef.current;
        if (video && video.readyState >= 1) {
          const target = playbackTime(msg, video.duration);
          if (target !== null && Math.abs(video.currentTime - target) > (msg.playing ? 0.15 : 0.01)) video.currentTime = target;
        }
      }
    };
    const unsubscribe = vjChannel.subscribe(receive);
    if (!preview) {
      try {
        const saved = JSON.parse(localStorage.getItem("eze_mix_vj_sync") || "null");
        if (saved) receive({ ...saved, type: saved.type === "CLEAR_VIDEO" ? "CLEAR_VIDEO" : "SET_VIDEO" });
        else void db.videos.toArray().then(videos => {
          if (cancelled || revision || !videos.length) return;
          const video = videos[videos.length - 1];
          void resolveSource({ type: "SET_VIDEO", videoId: video.id, videoTitle: video.title, videoUrl: video.url });
        });
      } catch { /* Wait for the next live update if no snapshot is available. */ }
    }
    return () => { cancelled = true; unsubscribe(); clearTimeout(flashTimer); if (ownedUrl) URL.revokeObjectURL(ownedUrl); };
  }, [preview]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleClose = () => {
    if (typeof window !== "undefined") {
      window.close();
    }
  };

  return (
    <div
      ref={containerRef}
      onDoubleClick={preview ? undefined : toggleFullscreen}
      className="group relative w-full h-full bg-black overflow-hidden select-none flex items-center justify-center cursor-default"
      title={preview ? undefined : "Double-click for fullscreen"}
    >
      {/* Floating Hover-Revealed Close (X) Button */}
      <button
        hidden={preview}
        onClick={handleClose}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-50 p-2.5 rounded-full bg-black/80 border border-white/20 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer shadow-[0_0_20px_rgba(0,0,0,0.8)] hover:bg-red-600 hover:border-red-500 hover:scale-110"
        title="Close VJ display"
      >
        <X size={18} />
      </button>

      {/* Floating Fullscreen Button on Hover */}
      <button
        hidden={preview}
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-black/80 border border-white/20 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer shadow-[0_0_20px_rgba(0,0,0,0.8)] hover:bg-white/20 hover:scale-110"
        title="Fullscreen"
      >
        <Maximize2 size={16} />
      </button>

      {/* Background Video Player — Native 60fps hardware decode with ZERO scale lag */}
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          onLoadedMetadata={applyClock}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 text-center z-10 px-6">
          <div className="w-16 h-16 rounded-full border border-[#00d4ff]40 bg-[#00d4ff]10 flex items-center justify-center animate-pulse shadow-[0_0_30px_rgba(0,212,255,0.25)]">
            <Tv size={28} className="text-[#00d4ff]" />
          </div>
          <span className="font-mono text-[14px] font-black text-white tracking-[4px] uppercase">
            AutoParty — VJ DISPLAY STANDBY
          </span>
          <span className="font-mono text-[10px] text-[#777795] uppercase tracking-widest max-w-sm">
            Choose a video from Library → Import files to get started
          </span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          DUAL STAGE LASER RIG: TOP (CYAN) & BOTTOM (NEON AMBER)
          Pure native GPU 60fps WebGL rendering (Zero React state lag)
          ═══════════════════════════════════════════════════════════════ */}

      {/* 1. TOP LASER BEAM — Electric Cyber Cyan (#00d4ff) */}
      <div className="absolute inset-0 pointer-events-none rotate-180">
        <Laser
          speed={0.35}
          offset={8}
          color={[0.0, 0.85, 1.0]} // Cyber Cyan
          thickness={4.5}
          core={1.4}
          radius={20}
          glow={2.0}
          wave={12}
          width={0.97}
          flicker={0.1}
          reveal={0}
          heat={0.0}
          shimmer={4}
          sparkle={0.2}
          reactivity={1.0}
          className="w-full h-full"
        >
          <div className="w-full h-full" />
        </Laser>
      </div>

      {/* 2. BOTTOM LASER BEAM — Neon Sunset Amber (#ff5500) */}
      <div className="absolute inset-0 pointer-events-none">
        <Laser
          speed={0.38}
          offset={8}
          color={[1.0, 0.35, 0.0]} // Electric Neon Amber/Orange
          thickness={4.5}
          core={1.4}
          radius={20}
          glow={2.0}
          wave={12}
          width={0.97}
          flicker={0.1}
          reveal={0}
          heat={0.0}
          shimmer={4}
          sparkle={0.2}
          reactivity={1.0}
          className="w-full h-full"
        >
          <div className="w-full h-full" />
        </Laser>
      </div>

      {/* Drop Flash Shockwave Banner */}
      {dropFlash && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none animate-pulse">
          <div className="px-10 py-5 rounded-3xl border-2 border-[#00d4ff] bg-black/85 backdrop-blur-xl shadow-[0_0_120px_rgba(0,212,255,0.9)] scale-110 transition-transform">
            <span className="font-mono text-4xl md:text-7xl font-black text-white uppercase tracking-widest drop-shadow-[0_0_30px_#00d4ff]">
              {dropText}
            </span>
          </div>
        </div>
      )}

      {/* Full Drop Strobe Flash */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-150"
        style={{
          boxShadow: dropFlash ? "inset 0 0 250px rgba(0,212,255,0.8)" : "none",
          opacity: dropFlash ? 1 : 0,
        }}
      />

      {/* Bottom Track Title & BPM HUD */}
      <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2 pointer-events-none opacity-40 hover:opacity-100 transition-opacity bg-black/70 px-3 py-1.5 rounded-xl border border-white/10 backdrop-blur-md shadow-lg">
        <Activity size={12} className="text-[#00ff88] animate-pulse" />
        <span className="font-mono text-[9px] font-bold text-white uppercase tracking-wider truncate max-w-xs">
          {videoTitle}
        </span>
        <span className="font-mono text-[8px] font-black text-[#00d4ff] bg-[#00d4ff]15 px-1.5 py-0.5 rounded border border-[#00d4ff]30">
          {bpm} BPM
        </span>
      </div>
    </div>
  );
}
