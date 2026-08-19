"use client";

import { useAIDJStore } from "../../stores/aiDJStore";
import { Bot, SkipForward, Loader2, Square } from "lucide-react";

export default function AIAutoDJButton() {
  const {
    isActive, status, activate, deactivate, skipToNext, setShowApiKeyModal,
    apiKey, djComment, setlist, currentIndex, errorMessage,
    autoFXDrops, toggleAutoFXDrops,
  } = useAIDJStore();

  const handleClick = () => {
    if (isActive) {
      deactivate();
      return;
    }

    // If no API key stored, show modal first
    if (!apiKey) {
      setShowApiKeyModal(true);
      return;
    }

    // Activate AI DJ
    activate();
  };

  const isAnalyzing = status === "analyzing";
  const hasError = status === "error";

  return (
    <div className="flex items-center gap-1.5">
      {/* Main AI Button */}
      <button
        id="ai-autodj-btn"
        onClick={handleClick}
        disabled={isAnalyzing}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-black tracking-wider rounded-lg border cursor-pointer uppercase transition-all disabled:cursor-wait relative overflow-hidden"
        style={{
          borderColor: isActive
            ? "#00ff88"
            : hasError
              ? "#ff3355"
              : "#ff6b0070",
          color: isActive ? "#00ff88" : hasError ? "#ff3355" : "#ff6b00",
          backgroundColor: isActive
            ? "#00ff8818"
            : hasError
              ? "#ff335518"
              : "#ff6b0018",
          boxShadow: isActive
            ? "0 0 20px rgba(0,255,136,0.35)"
            : hasError
              ? "0 0 12px rgba(255,51,85,0.3)"
              : "0 0 12px rgba(255,107,0,0.2)",
        }}
        title={
          isActive
            ? `AI DJ Active — ${djComment || "Mixing..."}`
            : hasError
              ? errorMessage
              : "Activate AI Auto-DJ (Gemini)"
        }
      >
        {/* Animated background pulse when active */}
        {isActive && (
          <div
            className="absolute inset-0 animate-pulse opacity-20 rounded-lg"
            style={{ background: "linear-gradient(45deg, #00ff8830, transparent, #00ff8830)" }}
          />
        )}

        {isAnalyzing ? (
          <Loader2 size={12} className="animate-spin" />
        ) : isActive ? (
          <Square size={10} className="fill-current" />
        ) : (
          <Bot size={12} />
        )}

        {isAnalyzing
          ? "Analyzing..."
          : isActive
            ? "AI DJ ON"
            : "AI DJ"}
      </button>

      {/* Auto FX Drops toggle button */}
      {isActive && (
        <button
          onClick={toggleAutoFXDrops}
          style={{
            borderColor: autoFXDrops ? "#ff0077" : "#2a2a3d",
            color: autoFXDrops ? "#ff0077" : "#777790",
            backgroundColor: autoFXDrops ? "#ff007718" : "transparent",
            boxShadow: autoFXDrops ? "0 0 10px rgba(255,0,119,0.3)" : "none",
          }}
          className="px-2 py-1.5 text-[8.5px] font-mono font-black border rounded-lg cursor-pointer tracking-wider hover:text-white transition-all flex items-center gap-1 shrink-0"
          title="Auto FX Drops: Dispara automáticamente Risers y Sub Drops en las transiciones de la IA"
        >
          <span>⚡</span>
          <span>DROPS</span>
        </button>
      )}

      {/* Skip button (only visible when AI DJ is active) */}
      {isActive && status === "mixing" && (
        <button
          onClick={skipToNext}
          className="w-7 h-7 rounded-lg border border-[#2a2a3d] flex items-center justify-center hover:bg-[#222234] hover:border-[#00ff88] transition-all cursor-pointer"
          title="Skip to next track"
        >
          <SkipForward size={11} className="text-[#00ff88]" />
        </button>
      )}

      {/* Status indicator tooltip */}
      {isActive && setlist.length > 0 && (
        <span className="font-mono text-[8px] text-[#00ff88] tracking-wider opacity-70 hidden xl:block max-w-[100px] truncate">
          {currentIndex + 1}/{setlist.length}
        </span>
      )}
    </div>
  );
}
