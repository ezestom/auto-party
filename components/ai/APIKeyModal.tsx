"use client";

import { useState } from "react";
import { useAIDJStore } from "../../stores/aiDJStore";
import { X, Key, Sparkles } from "lucide-react";

export default function APIKeyModal() {
  const { apiKey, setApiKey, showApiKeyModal, setShowApiKeyModal } =
    useAIDJStore();
  const [inputKey, setInputKey] = useState(apiKey);

  if (!showApiKeyModal) return null;

  const handleSave = () => {
    setApiKey(inputKey.trim());
    setShowApiKeyModal(false);
  };

  const handleSkip = () => {
    setApiKey("");
    setShowApiKeyModal(false);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md"
      onClick={() => setShowApiKeyModal(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[420px] rounded-2xl border border-[#2a2a3d] overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, #12121e 0%, #0a0a14 100%)",
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.8), 0 0 40px rgba(255,107,0,0.15)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{
            borderBottom: "1px solid #222234",
            background:
              "linear-gradient(135deg, #ff6b0015 0%, transparent 60%)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#ff6b0020] border border-[#ff6b0040] flex items-center justify-center">
              <Sparkles size={16} className="text-[#ff6b00]" />
            </div>
            <div>
              <div className="font-mono text-[13px] font-black text-white tracking-wider">
                AI AUTO-DJ
              </div>
              <div className="font-mono text-[8.5px] text-[#888899] tracking-widest uppercase">
                Google AI Studio · Gemini 2.0 Flash
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowApiKeyModal(false)}
            className="w-7 h-7 rounded-lg border border-[#2a2a3d] flex items-center justify-center hover:bg-[#222234] transition-colors cursor-pointer"
          >
            <X size={14} className="text-[#888899]" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <div className="space-y-2">
            <label className="font-mono text-[10px] text-[#aaaacc] tracking-widest uppercase font-bold block">
              API Key de Google AI Studio
            </label>
            <div className="relative">
              <Key
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555570]"
              />
              <input
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#2a2a3d] bg-[#0a0a16] font-mono text-[11px] text-white placeholder-[#444460] focus:border-[#ff6b00] focus:outline-none transition-colors"
              />
            </div>
            <p className="font-mono text-[8.5px] text-[#666680] leading-relaxed">
              Obtené tu API Key gratis en{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#ff6b00] hover:underline"
              >
                aistudio.google.com/apikey
              </a>
              . La key se guarda localmente en tu navegador.
            </p>
          </div>

          {/* Info box */}
          <div
            className="rounded-lg border border-[#1e1e30] p-3"
            style={{ background: "rgba(0,212,255,0.05)" }}
          >
            <div className="font-mono text-[9px] text-[#00d4ff] font-bold tracking-wider uppercase mb-1">
              ¿Qué hace el AI Auto-DJ?
            </div>
            <p className="font-mono text-[8.5px] text-[#8888a0] leading-relaxed">
              Gemini analiza tu biblioteca (BPM, tonalidad, energía) y crea
              un setlist optimizado. Mezcla automáticamente las canciones
              con transiciones suaves sin que tengas que tocar nada.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex gap-2.5 px-5 py-3.5"
          style={{
            borderTop: "1px solid #222234",
            background: "rgba(0,0,0,0.3)",
          }}
        >
          <button
            onClick={handleSkip}
            className="flex-1 py-2 rounded-lg border border-[#2a2a3d] font-mono text-[10px] font-black text-[#888899] tracking-wider uppercase hover:bg-[#161622] cursor-pointer transition-colors"
          >
            Sin API Key (BPM Sort)
          </button>
          <button
            onClick={handleSave}
            disabled={!inputKey.trim()}
            className="flex-1 py-2 rounded-lg border font-mono text-[10px] font-black tracking-wider uppercase cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              borderColor: inputKey.trim() ? "#ff6b00" : "#2a2a3d",
              color: "#ffffff",
              backgroundColor: inputKey.trim()
                ? "#ff6b00"
                : "#ff6b0020",
              boxShadow: inputKey.trim()
                ? "0 0 20px rgba(255,107,0,0.4)"
                : "none",
            }}
          >
            Guardar & Activar AI
          </button>
        </div>
      </div>
    </div>
  );
}
