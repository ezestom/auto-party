"use client";

import { useSettingsStore } from "../../stores/settingsStore";
import { useAIDJStore } from "../../stores/aiDJStore";
import { X, Sliders, Volume2, Bot, Keyboard, RotateCcw, Shield, Check } from "lucide-react";

export default function SettingsModal() {
  const {
    isOpen,
    setIsOpen,
    activeTab,
    setActiveTab,
    lockPlayingDeck,
    setLockPlayingDeck,
    autoPlayOnLoad,
    setAutoPlayOnLoad,
    quantizeBeats,
    setQuantizeBeats,
    autoGainEnabled,
    setAutoGainEnabled,
    targetLufs,
    setTargetLufs,
    crossfaderCurve,
    setCrossfaderCurve,
    aiDefaultDuration,
    setAiDefaultDuration,
    resetDefaults,
  } = useSettingsStore();

  const { apiKey, setShowApiKeyModal } = useAIDJStore();

  if (!isOpen) return null;

  const tabs = [
    { id: "controls" as const, label: "Controles", icon: Sliders },
    { id: "audio" as const, label: "Audio & Mezclador", icon: Volume2 },
    { id: "aidj" as const, label: "AI Auto-DJ", icon: Bot },
    { id: "shortcuts" as const, label: "Atajos", icon: Keyboard },
  ];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={() => setIsOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[540px] max-h-[85vh] rounded-2xl border border-[#26263a] overflow-hidden flex flex-col shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_50px_rgba(255,107,0,0.12)]"
        style={{
          background: "linear-gradient(180deg, #10101c 0%, #080812 100%)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{
            borderBottom: "1px solid #1f1f30",
            background: "linear-gradient(135deg, #ff6b0012 0%, transparent 60%)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#ff6b001a] border border-[#ff6b0035] flex items-center justify-center">
              <Sliders size={16} className="text-[#ff6b00]" />
            </div>
            <div>
              <div className="font-mono text-[14px] font-black text-white tracking-wider">
                AJUSTES DE CONSOLA
              </div>
              <div className="font-mono text-[8.5px] text-[#777790] tracking-widest uppercase">
                EZE MIX PRO · Preferencias de Usuario
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-7 h-7 rounded-lg border border-[#28283d] flex items-center justify-center hover:bg-[#1a1a28] hover:text-white transition-colors cursor-pointer text-[#8888a0]"
          >
            <X size={14} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-6 pt-3 border-b border-[#1f1f30] gap-2 shrink-0 bg-black/20">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  color: isActive ? "#ff6b00" : "#8888a0",
                  borderColor: isActive ? "#ff6b00" : "transparent",
                  backgroundColor: isActive ? "#ff6b0012" : "transparent",
                }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-t-lg font-mono text-[10.5px] font-bold tracking-wider uppercase border-b-2 transition-all cursor-pointer hover:text-white"
              >
                <Icon size={12} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-5 text-sm">
          {/* TAB 1: CONTROLES */}
          {activeTab === "controls" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#1e1e30] bg-[#0c0c16]">
                <div className="pr-4">
                  <div className="font-mono text-[11.5px] font-bold text-white flex items-center gap-2">
                    <Shield size={13} className="text-[#00ff88]" />
                    Bloqueo de Deck Activo (Anti-Cortes)
                  </div>
                  <div className="font-mono text-[9px] text-[#777790] mt-0.5 leading-relaxed">
                    Evita que se cargue una nueva canción por error sobre un deck que está sonando en vivo para el público.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={lockPlayingDeck}
                  onChange={(e) => setLockPlayingDeck(e.target.checked)}
                  className="w-5 h-5 accent-[#ff6b00] rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#1e1e30] bg-[#0c0c16]">
                <div className="pr-4">
                  <div className="font-mono text-[11.5px] font-bold text-white">
                    Auto-Play al Cargar Canción
                  </div>
                  <div className="font-mono text-[9px] text-[#777790] mt-0.5 leading-relaxed">
                    Inicia automáticamente la reproducción apenas se asigna una canción al deck.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoPlayOnLoad}
                  onChange={(e) => setAutoPlayOnLoad(e.target.checked)}
                  className="w-5 h-5 accent-[#ff6b00] rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#1e1e30] bg-[#0c0c16]">
                <div>
                  <div className="font-mono text-[11.5px] font-bold text-white">
                    Cuantización de Beat (Quantize)
                  </div>
                  <div className="font-mono text-[9px] text-[#777790] mt-0.5">
                    Alinea los Cues y Loops a la cuadrícula de ritmo.
                  </div>
                </div>
                <select
                  value={quantizeBeats}
                  onChange={(e) => setQuantizeBeats(Number(e.target.value))}
                  className="bg-[#141422] border border-[#2a2a3d] text-white font-mono text-[10.5px] font-bold px-2.5 py-1 rounded-lg focus:outline-none focus:border-[#ff6b00]"
                >
                  <option value={1}>1 Beat (Standard)</option>
                  <option value={0.5}>1/2 Beat</option>
                  <option value={0.25}>1/4 Beat</option>
                </select>
              </div>
            </div>
          )}

          {/* TAB 2: AUDIO & MEZCLADOR */}
          {activeTab === "audio" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#1e1e30] bg-[#0c0c16]">
                <div className="pr-4">
                  <div className="font-mono text-[11.5px] font-bold text-white">
                    Ganancia Automática (Auto-Gain RMS)
                  </div>
                  <div className="font-mono text-[9px] text-[#777790] mt-0.5 leading-relaxed">
                    Normaliza el volumen de todas las canciones importadas para que no haya saltos bruscos de audio.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoGainEnabled}
                  onChange={(e) => setAutoGainEnabled(e.target.checked)}
                  className="w-5 h-5 accent-[#ff6b00] rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#1e1e30] bg-[#0c0c16]">
                <div>
                  <div className="font-mono text-[11.5px] font-bold text-white">
                    Curva del Crossfader
                  </div>
                  <div className="font-mono text-[9px] text-[#777790] mt-0.5">
                    Respuesta del deslizador central de mezcla.
                  </div>
                </div>
                <div className="flex gap-1">
                  {(["CUT", "LIN", "CRV"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCrossfaderCurve(c)}
                      style={{
                        borderColor: crossfaderCurve === c ? "#ff6b00" : "#28283d",
                        backgroundColor: crossfaderCurve === c ? "#ff6b0020" : "#141422",
                        color: crossfaderCurve === c ? "#ff6b00" : "#8888a0",
                      }}
                      className="px-2.5 py-1 rounded-lg border font-mono text-[9.5px] font-black cursor-pointer uppercase transition-all"
                    >
                      {c === "LIN" ? "Lineal" : c === "CUT" ? "Scratch Cut" : "Suave Curve"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-[#1e1e30] bg-[#0c0c16] flex items-center justify-between">
                <div>
                  <div className="font-mono text-[11.5px] font-bold text-white">
                    Formato de Grabación
                  </div>
                  <div className="font-mono text-[9px] text-[#777790] mt-0.5">
                    Audio estéreo sin pérdida de calidad.
                  </div>
                </div>
                <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-[#00ff8815] border border-[#00ff8840] text-[#00ff88]">
                  WAV 44.1 kHz / 16-bit
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: AI AUTO-DJ */}
          {activeTab === "aidj" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl border border-[#1e1e30] bg-[#0c0c16] flex items-center justify-between">
                <div>
                  <div className="font-mono text-[11.5px] font-bold text-white">
                    Google AI Studio API Key (Gemini)
                  </div>
                  <div className="font-mono text-[9px] text-[#777790] mt-0.5">
                    {apiKey ? "✓ API Key configurada y guardada" : "Sin API Key (usando modo BPM Fallback)"}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setShowApiKeyModal(true);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[#ff6b0060] bg-[#ff6b0018] text-[#ff6b00] font-mono text-[10px] font-bold hover:bg-[#ff6b0028] transition-colors cursor-pointer"
                >
                  {apiKey ? "Editar Key" : "Configurar Key"}
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#1e1e30] bg-[#0c0c16]">
                <div>
                  <div className="font-mono text-[11.5px] font-bold text-white">
                    Duración de Transición AI
                  </div>
                  <div className="font-mono text-[9px] text-[#777790] mt-0.5">
                    Tiempo de crossfade entre canciones al mezclar.
                  </div>
                </div>
                <select
                  value={aiDefaultDuration}
                  onChange={(e) => setAiDefaultDuration(Number(e.target.value))}
                  className="bg-[#141422] border border-[#2a2a3d] text-white font-mono text-[10.5px] font-bold px-2.5 py-1 rounded-lg focus:outline-none focus:border-[#ff6b00]"
                >
                  <option value={4}>4 Segundos (Rápida)</option>
                  <option value={8}>8 Segundos (Standard)</option>
                  <option value={16}>16 Segundos (Progresiva)</option>
                </select>
              </div>

              {/* Voicebox Local Studio Config */}
              <div className="p-3.5 rounded-xl border border-[#1e1e30] bg-[#0c0c16] space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[11.5px] font-bold text-white flex items-center gap-2">
                      Voicebox AI Voice Studio
                      <span className="text-[8px] font-mono font-black text-[#00ff88] bg-[#00ff88]15 border border-[#00ff88]40 px-1.5 py-0.2 rounded-full">
                        LOCAL / 100% GRATIS
                      </span>
                    </div>
                    <div className="font-mono text-[9px] text-[#777790] mt-0.5">
                      Conexión local en segundo plano (http://127.0.0.1:17423) con perfil <strong className="text-white">eze</strong>.
                    </div>
                  </div>
                </div>
                <div className="text-[8.5px] font-mono text-[#8888aa] bg-[#141422] p-2 rounded-lg border border-[#222234]">
                  💡 <strong>Tip:</strong> Si Voicebox está abierto, la consola hablará con tu clon de voz. Si está cerrado, usará la síntesis de voz nativa del navegador con ducking automático de volumen.
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ATAJOS DE TECLADO */}
          {activeTab === "shortcuts" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {[
                  { key: "Espacio", desc: "Play / Pausa Deck A" },
                  { key: "Shift + Espacio", desc: "Play / Pausa Deck B" },
                  { key: "C", desc: "Cue Deck A" },
                  { key: "V", desc: "Cue Deck B" },
                  { key: "1 - 4", desc: "Hot Cues 1 a 4" },
                  { key: "F", desc: "Auto-Crossfade Toggle" },
                  { key: "L", desc: "Abrir / Cerrar Biblioteca" },
                  { key: "Tab", desc: "Sincronizar BPM (Sync)" },
                ].map(({ key, desc }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-[#1b1b2a] bg-[#0c0c14]"
                  >
                    <span className="text-[#8888a0] text-[10px]">{desc}</span>
                    <span className="px-2 py-0.5 rounded bg-[#1f1f30] border border-[#2e2e45] text-white font-black text-[9px]">
                      {key}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-3.5 shrink-0"
          style={{
            borderTop: "1px solid #1f1f30",
            background: "rgba(0,0,0,0.35)",
          }}
        >
          <button
            onClick={resetDefaults}
            className="flex items-center gap-1.5 font-mono text-[9.5px] font-bold text-[#666680] hover:text-[#ff3355] transition-colors cursor-pointer uppercase"
          >
            <RotateCcw size={11} />
            Restablecer Valores
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-[#ff6b00] bg-[#ff6b00] text-white font-mono text-[10.5px] font-black uppercase shadow-[0_0_15px_rgba(255,107,0,0.4)] hover:bg-[#ff7b1a] transition-all cursor-pointer"
          >
            <Check size={12} />
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
