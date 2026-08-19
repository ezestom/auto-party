"use client";

import { useState, useEffect } from "react";
import { djAnnouncer, DJ_PHRASE_CATEGORIES } from "../../lib/ai/djAnnouncer";
import { voiceboxClient } from "../../lib/ai/voiceboxClient";
import { Mic, Volume2, Sparkles, X, Send, Radio, Bot, Check } from "lucide-react";
import { useDeckStore } from "../../stores/deckStore";

interface DJMCModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DJMCModal({ isOpen, onClose }: DJMCModalProps) {
  const [customText, setCustomText] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceProfile, setVoiceProfile] = useState("eze");
  const [isVoiceboxOnline, setIsVoiceboxOnline] = useState<boolean | null>(null);
  const [lastSpoken, setLastSpoken] = useState<string>("");

  const deckA = useDeckStore((s) => s.decks.A);
  const deckB = useDeckStore((s) => s.decks.B);

  // Check Voicebox local connection on mount
  useEffect(() => {
    if (!isOpen) return;

    const checkVoicebox = async () => {
      const candidateUrls = [
        "http://127.0.0.1:17493",
        "http://localhost:17493",
        "http://127.0.0.1:17423",
      ];
      for (const base of candidateUrls) {
        for (const path of ["/v1/models", "/health", "/api/models", "/speak", "/"]) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1000);
            const res = await fetch(`${base}${path}`, {
              method: "GET",
              signal: controller.signal,
              mode: "no-cors", // Allows detecting running local server even without CORS header
            }).catch(() => null);
            clearTimeout(timeout);
            if (res) {
              setIsVoiceboxOnline(true);
              return;
            }
          } catch {
            // continue
          }
        }
      }
      setIsVoiceboxOnline(false);
    };

    checkVoicebox();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSpeak = async (text: string) => {
    if (!text.trim() || isSpeaking) return;
    setIsSpeaking(true);
    setLastSpoken(text);
    djAnnouncer.setVoiceProfile(voiceProfile);
    try {
      await djAnnouncer.speak(text);
    } finally {
      setIsSpeaking(false);
    }
  };

  const handleCategoryShout = async (catId: string) => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    djAnnouncer.setVoiceProfile(voiceProfile);
    try {
      await djAnnouncer.shoutCategory(catId);
    } finally {
      setIsSpeaking(false);
    }
  };

  const handleAnnounceDeck = async (deckId: "A" | "B") => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    djAnnouncer.setVoiceProfile(voiceProfile);
    try {
      await djAnnouncer.announceTrack(deckId);
    } finally {
      setIsSpeaking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in select-none">
      <div
        className="w-full max-w-lg rounded-2xl border border-[#2e2e44] bg-[#0c0c14] shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col"
        style={{ borderTop: "2px solid #ff6b00" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e1e2e] bg-[#12121e]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#ff6b00]20 border border-[#ff6b00] flex items-center justify-center text-[#ff6b00] shadow-[0_0_10px_rgba(255,107,0,0.4)]">
              <Mic size={14} className={isSpeaking ? "animate-pulse text-white" : ""} />
            </div>
            <div>
              <div className="font-mono text-[12px] font-black text-white uppercase tracking-wider flex items-center gap-2">
                DJ MC / HOST EN VIVO
                {isSpeaking && (
                  <span className="flex items-center gap-1 text-[8.5px] text-[#00ff88] bg-[#00ff88]15 border border-[#00ff88] px-1.5 py-0.2 rounded-full animate-pulse font-bold">
                    <Radio size={9} /> HABLANDO
                  </span>
                )}
              </div>
              <div className="font-mono text-[8px] text-[#8888aa] flex items-center gap-2">
                <span>Motor de Voz:</span>
                <span className="text-[#ff9500] font-bold">
                  {isVoiceboxOnline ? "Voicebox Local (Qwen / eze)" : "Web Speech (Nativo)"}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full ${isVoiceboxOnline ? "bg-[#00ff88]" : "bg-yellow-500"}`} />
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#181826] border border-[#28283d] flex items-center justify-center text-[#8888aa] hover:text-white hover:border-[#ff6b00] transition-all cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[75vh]">
          {/* Quick Arenga & Shouts */}
          <div>
            <div className="font-mono text-[9px] font-bold text-[#8888aa] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles size={11} className="text-[#ff6b00]" />
              Frases Rápidas de Fiesta (1 Clic)
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DJ_PHRASE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryShout(cat.id)}
                  disabled={isSpeaking}
                  className="px-3 py-2 rounded-xl border border-[#252538] bg-[#141420] hover:bg-[#ff6b00]18 hover:border-[#ff6b00] text-left transition-all cursor-pointer flex items-center gap-2.5 group disabled:opacity-50"
                >
                  <span className="text-base group-hover:scale-110 transition-transform">{cat.icon}</span>
                  <div>
                    <div className="font-mono text-[10px] font-black text-white group-hover:text-[#ff6b00] transition-colors uppercase">
                      {cat.name}
                    </div>
                    <div className="font-mono text-[7.5px] text-[#777799] truncate max-w-[140px]">
                      {cat.phrases[0]}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Announce Active Tracks */}
          <div>
            <div className="font-mono text-[9px] font-bold text-[#8888aa] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Volume2 size={11} className="text-[#00d4ff]" />
              Presentar Canciones en los Decks
            </div>
            <div className="grid grid-cols-2 gap-2">
              {/* Deck A */}
              <button
                onClick={() => handleAnnounceDeck("A")}
                disabled={!deckA.track || isSpeaking}
                style={{ borderColor: deckA.track ? "#ff6b0070" : "#222234" }}
                className="p-2.5 rounded-xl border bg-[#141420] hover:bg-[#ff6b00]15 text-left transition-all cursor-pointer disabled:opacity-40"
              >
                <div className="font-mono text-[8px] font-black text-[#ff6b00] uppercase mb-0.5">
                  DECK A · PRESENTAR
                </div>
                <div className="font-mono text-[9.5px] font-bold text-white truncate">
                  {deckA.track ? deckA.track.title : "Sin tema cargado"}
                </div>
              </button>

              {/* Deck B */}
              <button
                onClick={() => handleAnnounceDeck("B")}
                disabled={!deckB.track || isSpeaking}
                style={{ borderColor: deckB.track ? "#00d4ff70" : "#222234" }}
                className="p-2.5 rounded-xl border bg-[#141420] hover:bg-[#00d4ff]15 text-left transition-all cursor-pointer disabled:opacity-40"
              >
                <div className="font-mono text-[8px] font-black text-[#00d4ff] uppercase mb-0.5">
                  DECK B · PRESENTAR
                </div>
                <div className="font-mono text-[9.5px] font-bold text-white truncate">
                  {deckB.track ? deckB.track.title : "Sin tema cargado"}
                </div>
              </button>
            </div>
          </div>

          {/* Custom Text to Speech */}
          <div>
            <div className="font-mono text-[9px] font-bold text-[#8888aa] uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Frase Personalizada</span>
              <span className="text-[7.5px] text-[#666688]">Auto-Ducking activado (baja la música)</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSpeak(customText)}
                placeholder="Escribe lo que quieras que diga el DJ (ej: Un saludo para los pibes de la mesa 4)..."
                className="flex-1 px-3 py-2 bg-[#141420] border border-[#28283e] rounded-xl font-mono text-[10px] text-white outline-none focus:border-[#ff6b00] transition-all"
              />
              <button
                onClick={() => handleSpeak(customText)}
                disabled={!customText.trim() || isSpeaking}
                className="px-4 py-2 rounded-xl bg-[#ff6b00] text-black font-mono text-[10px] font-black tracking-wider uppercase flex items-center gap-1.5 hover:bg-[#ff8533] transition-all cursor-pointer disabled:opacity-40 shadow-[0_0_15px_rgba(255,107,0,0.4)]"
              >
                <Send size={11} />
                DECIR
              </button>
            </div>
          </div>

          {/* Voice Profile Config */}
          <div className="pt-2 border-t border-[#1e1e2e] flex items-center justify-between font-mono text-[8.5px] text-[#8888aa]">
            <div className="flex items-center gap-2">
              <span>Perfil Voicebox:</span>
              <input
                type="text"
                value={voiceProfile}
                onChange={(e) => setVoiceProfile(e.target.value)}
                placeholder="eze"
                className="w-20 px-2 py-0.5 bg-[#141420] border border-[#28283e] rounded text-white text-center font-bold text-[8.5px] outline-none focus:border-[#ff6b00]"
              />
            </div>
            <div className="text-[7.5px] text-[#666688]">
              Puerto: 127.0.0.1:17493
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
