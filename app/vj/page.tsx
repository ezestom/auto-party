"use client";

import { useEffect, useState, useRef } from "react";
import { vjChannel, VJStateMessage } from "../../lib/vj/vjChannel";
import { Maximize2, Tv, X, Activity } from "lucide-react";
import { db } from "../../lib/db/dexie";
import Laser from "../../components/ui/Laser";

export default function VJDisplayPage() {
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoTitle, setVideoTitle] = useState<string>("STANDBY — NO VIDEO LOADED");
  const [accentColor, setAccentColor] = useState<string>("#ffffff");
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [bpm, setBpm] = useState<number>(128);
  const [dropFlash, setDropFlash] = useState<boolean>(false);
  const [dropText, setDropText] = useState<string>("🔥 DROP 🔥");
  const [dropColor, setDropColor] = useState<string>("#ffffff");

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const resolveVideoSource = async (videoId?: string, fallbackUrl?: string) => {
    if (videoId) {
      try {
        const dbVideo = await db.videos.get(videoId);
        if (dbVideo && dbVideo.videoData) {
          const blob = new Blob([dbVideo.videoData], { type: "video/mp4" });
          const localUrl = URL.createObjectURL(blob);
          setVideoUrl(localUrl);
          return;
        }
      } catch (e) {
        console.warn("Could not load video from Dexie DB in VJ window:", e);
      }
    }
    if (fallbackUrl) {
      setVideoUrl(fallbackUrl);
    }
  };

  useEffect(() => {
    let isCancelled = false;

    const loadInitialState = async () => {
      let loadedFromStorage = false;

      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("eze_mix_vj_sync");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.videoId || parsed.videoUrl) {
              await resolveVideoSource(parsed.videoId, parsed.videoUrl);
              if (!isCancelled) {
                if (parsed.videoTitle) setVideoTitle(parsed.videoTitle);
                if (parsed.bpm) setBpm(parsed.bpm);
              }
              loadedFromStorage = true;
            }
          } catch (e) {}
        }

        if (!loadedFromStorage) {
          try {
            const all = await db.videos.toArray();
            if (all.length > 0 && !isCancelled) {
              const latest = all[all.length - 1];
              await resolveVideoSource(latest.id, latest.url);
              setVideoTitle(latest.title);
            }
          } catch (e) {}
        }
      }
    };

    loadInitialState();

    const unsubscribe = vjChannel.subscribe((msg: VJStateMessage) => {
      if (msg.type === "SET_VIDEO") {
        resolveVideoSource(msg.videoId, msg.videoUrl);
        if (msg.videoTitle) setVideoTitle(msg.videoTitle);
        if (msg.bpm) setBpm(msg.bpm);
        setIsPlaying(true);
        if (videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
      } else if (msg.type === "PLAY") {
        setIsPlaying(true);
        videoRef.current?.play().catch(() => {});
      } else if (msg.type === "PAUSE") {
        setIsPlaying(false);
        videoRef.current?.pause();
      } else if (msg.type === "BEAT_PULSE") {
        if (msg.bpm) setBpm(msg.bpm);
      } else if (msg.type === "DROP_FLASH") {
        setDropFlash(true);
        if (msg.dropText) setDropText(msg.dropText);
        setTimeout(() => setDropFlash(false), 1200);
      }
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, []);

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
      onDoubleClick={toggleFullscreen}
      className="group relative w-screen h-screen bg-black overflow-hidden select-none flex items-center justify-center cursor-default"
      title="Doble clic para Pantalla Completa"
    >
      {/* Floating Hover-Revealed Close (X) Button */}
      <button
        onClick={handleClose}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-50 p-2.5 rounded-full bg-black/80 border border-white/20 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer shadow-[0_0_20px_rgba(0,0,0,0.8)] hover:bg-red-600 hover:border-red-500 hover:scale-110"
        title="Cerrar Ventana VJ"
      >
        <X size={18} />
      </button>

      {/* Floating Fullscreen Button on Hover */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-black/80 border border-white/20 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer shadow-[0_0_20px_rgba(0,0,0,0.8)] hover:bg-white/20 hover:scale-110"
        title="Pantalla Completa"
      >
        <Maximize2 size={16} />
      </button>

      {/* Background Video Player — Native 60fps hardware decode with ZERO scale lag */}
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
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
            EZE MIX PRO — VJ DISPLAY STANDBY
          </span>
          <span className="font-mono text-[10px] text-[#777795] uppercase tracking-widest max-w-sm">
            Sube un video en la biblioteca VJ (+ Import Video) para comenzar
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
