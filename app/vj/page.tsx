"use client";

import { useEffect, useState, useRef } from "react";
import { vjChannel, VJStateMessage } from "../../lib/vj/vjChannel";
import { DEFAULT_VJ_VIDEOS } from "../../stores/vjStore";
import { Maximize2, Tv, Sparkles, X } from "lucide-react";

import { db } from "../../lib/db/dexie";

export default function VJDisplayPage() {
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoTitle, setVideoTitle] = useState<string>("STANDBY — NO VIDEO LOADED");
  const [accentColor, setAccentColor] = useState<string>("#00d4ff");
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [beatPulse, setBeatPulse] = useState<boolean>(false);
  const [effect, setEffect] = useState<string>("NORMAL");

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
                if (parsed.color) setAccentColor(parsed.color);
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
        if (msg.color) setAccentColor(msg.color);
        setIsPlaying(true);
        if (videoRef.current) {
          if (msg.time !== undefined) {
            videoRef.current.currentTime = msg.time;
          }
          videoRef.current.play().catch(() => {});
        }
      } else if (msg.type === "PLAY") {
        setIsPlaying(true);
        videoRef.current?.play().catch(() => {});
      } else if (msg.type === "PAUSE") {
        setIsPlaying(false);
        videoRef.current?.pause();
      } else if (msg.type === "BEAT_PULSE") {
        setBeatPulse(true);
        setTimeout(() => setBeatPulse(false), 150);
      } else if (msg.type === "SET_EFFECT" && msg.effect) {
        setEffect(msg.effect);
      } else if (msg.type === "SYNC_TIME" && msg.time !== undefined) {
        if (videoRef.current && Math.abs(videoRef.current.currentTime - msg.time) > 0.4) {
          videoRef.current.currentTime = msg.time;
        }
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
      title="Double click for Fullscreen"
    >
      {/* Floating Hover-Revealed Close (X) Button */}
      <button
        onClick={handleClose}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-50 p-2.5 rounded-full bg-black/80 border border-white/20 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer shadow-[0_0_20px_rgba(0,0,0,0.8)] hover:bg-red-600 hover:border-red-500 hover:scale-110"
        title="Close VJ Window"
      >
        <X size={18} />
      </button>

      {/* Floating Fullscreen Button on Hover */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-black/80 border border-white/20 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer shadow-[0_0_20px_rgba(0,0,0,0.8)] hover:bg-white/20 hover:scale-110"
        title="Toggle Fullscreen"
      >
        <Maximize2 size={16} />
      </button>

      {/* Background Video Player or Standby screen */}
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          className={`w-full h-full object-cover transition-all duration-300 ${
            beatPulse ? "scale-105 filter brightness-125" : "scale-100"
          } ${effect === "STROBE" && beatPulse ? "invert" : ""}`}
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
            Import a video file in the console VJ Library (+ Import Video) to begin projection
          </span>
        </div>
      )}

      {/* Cyber overlay laser glow on audio beat pulse */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-150"
        style={{
          boxShadow: beatPulse ? `inset 0 0 120px ${accentColor}aa` : "none",
          opacity: beatPulse ? 0.9 : 0,
        }}
      />

      {/* Dynamic Laser & Ambient Gradient Overlays */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 mix-blend-screen"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${accentColor}30 0%, transparent 70%)`,
        }}
      />
    </div>
  );
}
