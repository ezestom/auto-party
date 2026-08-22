"use client";

import { useRef, useEffect, useState } from "react";
import { useVJStore } from "../../stores/vjStore";
import { useDeckStore } from "../../stores/deckStore";
import { PictureInPicture2 } from "lucide-react";

export default function VJMiniPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { activeVideo, isPlaying } = useVJStore();
  const [isPipAvailable, setIsPipAvailable] = useState<boolean>(false);
  const [isPipActive, setIsPipActive] = useState<boolean>(false);

  useEffect(() => {
    if (typeof document !== "undefined" && "pictureInPictureEnabled" in document) {
      setIsPipAvailable(document.pictureInPictureEnabled);
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnterPip = () => setIsPipActive(true);
    const onLeavePip = () => setIsPipActive(false);

    video.addEventListener("enterpictureinpicture", onEnterPip);
    video.addEventListener("leavepictureinpicture", onLeavePip);

    return () => {
      video.removeEventListener("enterpictureinpicture", onEnterPip);
      video.removeEventListener("leavepictureinpicture", onLeavePip);
    };
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, activeVideo]);

  const handleTogglePiP = async () => {
    try {
      let currentActive = useVJStore.getState().activeVideo;
      const allVideos = useVJStore.getState().videos;
      if (!currentActive && allVideos.length > 0) {
        currentActive = allVideos[0];
        useVJStore.getState().setActiveVideo(currentActive);
      }

      if (!currentActive?.url) {
        console.warn("No video loaded yet for Float PiP");
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.play().catch(() => {});
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn("PiP toggle caught safely:", err);
    }
  };

  const deckA = useDeckStore((s) => s.decks.A);
  const deckB = useDeckStore((s) => s.decks.B);
  const isMusicPlaying = deckA.isPlaying || deckB.isPlaying;

  return (
    <div className="flex items-center gap-2">
      {/* Real visible video preview thumbnail - required for HTML5 PiP */}
      <div
        className="relative w-14 h-8 rounded overflow-hidden border border-[#33334d] bg-black shrink-0 transition-all duration-150"
        style={{
          boxShadow: isMusicPlaying && activeVideo ? `0 0 10px ${activeVideo.color || "#00d4ff"}60` : "none",
          borderColor: isMusicPlaying && activeVideo ? `${activeVideo.color || "#00d4ff"}80` : "#33334d",
        }}
      >
        <video
          ref={videoRef}
          src={activeVideo?.url}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      </div>

      {/* Trigger Picture-in-Picture Floating Window */}
      {isPipAvailable && (
        <button
          onClick={handleTogglePiP}
          style={{
            borderColor: isPipActive ? "#00ff88" : "#00d4ff70",
            color: isPipActive ? "#00ff88" : "#00d4ff",
            backgroundColor: isPipActive ? "#00ff8818" : "#00d4ff18",
            boxShadow: isPipActive ? "0 0 12px rgba(0,255,136,0.3)" : "none",
          }}
          className="flex items-center gap-1 px-2.5 py-1 text-[8px] font-mono font-black rounded border cursor-pointer hover:text-white uppercase transition-all shrink-0"
          title="Pop out floating VJ Video window (Picture-in-Picture) for Monitor 2 / Projector"
        >
          <PictureInPicture2 size={10} />
          {isPipActive ? "PiP ACTIVE" : "FLOAT PIP"}
        </button>
      )}
    </div>
  );
}
