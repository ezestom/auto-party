"use client";
import { useEffect, useRef, useState } from "react";
import { DJ_PHRASE_CATEGORIES } from "../../lib/ai/djAnnouncer";
import { googleVoiceClient, type VoicePhase } from "../../lib/ai/googleVoiceClient";
import { SPEECH_STYLES, SPEECH_VOICES, type SpeechStyle, type SpeechVoice } from "../../lib/ai/speechContract";
import { AIError } from "../../lib/ai/contract";
import { useAIConnectionStore } from "../../stores/aiConnectionStore";
import { useDeckStore } from "../../stores/deckStore";
import { Mic, X, Square } from "lucide-react";

export default function DJMCModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState<SpeechVoice>("Charon");
  const [style, setStyle] = useState<SpeechStyle>("assistant");
  const [phase, setPhase] = useState<VoicePhase | null>(null);
  const [message, setMessage] = useState("");
  const dialog = useRef<HTMLDivElement>(null);
  const authorized = useAIConnectionStore(state => state.authorized);
  const decks = useDeckStore(state => state.decks);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => { googleVoiceClient.stop(); previous?.focus(); };
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { googleVoiceClient.stop(); onClose(); }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  const busy = phase !== null;
  const close = () => { googleVoiceClient.stop(); onClose(); };
  const say = async (phrase: string) => {
    if (busy || !phrase.trim()) return;
    setMessage(""); setPhase("generating");
    try {
      const completed = await googleVoiceClient.speak({ text: phrase, voice, style }, setPhase);
      setMessage(completed ? "Anuncio reproducido con Google." : "Anuncio detenido.");
    } catch (error) {
      setMessage(error instanceof AIError ? error.code === "INVALID_PROVIDER_RESPONSE" ? "Google devolvió un audio que no se puede reproducir." : error.message : "No se pudo reproducir la voz.");
    } finally { setPhase(null); }
  };
  const announce = (id: "A" | "B") => {
    const track = decks[id].track;
    if (track) void say(`Seguimos con ${track.title}${track.artist && track.artist !== "Unknown Artist" ? `, de ${track.artist}` : ""}. Estás escuchando AutoParty.`.slice(0, 400));
  };
  const button = "rounded-xl border border-[#303047] bg-[#171724] px-3 py-3 text-sm text-white hover:border-orange-500 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-cyan-400";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="dj-mc-title" tabIndex={-1}
        className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border border-[#303047] bg-[#0c0c14] p-5 text-white shadow-2xl"
        onKeyDown={event => {
          if (event.key === "Escape") { event.stopPropagation(); close(); }
          if (event.key === "Tab") {
            const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)');
            if (!items?.length) return;
            const first = items[0], last = items[items.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
          }
        }}>
        <header className="flex items-center justify-between gap-3">
          <h2 id="dj-mc-title" className="flex items-center gap-2 text-lg font-bold"><Mic size={20} className="text-orange-500" /> DJ MC · Voz de Google</h2>
          <button aria-label="Cerrar locutor" onClick={close} className={button}><X size={18} /></button>
        </header>
        <p className="mt-3 text-sm leading-relaxed text-[#aaaac0]">Una voz propia para AutoParty. Elegí cómo suena y probá un saludo. La locución usa Google aunque la fiesta esté en AUTO LOCAL.</p>
        {!authorized && <div className="mt-4 rounded-xl border border-orange-500/40 p-3">
          <p className="text-sm">Ingresá el código de acceso de la fiesta para usar la voz.</p>
          <button className={`${button} mt-2`} onClick={() => { close(); useAIConnectionStore.getState().setShowModal(true); }}>Abrir conexión IA</button>
        </div>}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-sm text-[#aaaac0]">Voz
            <select aria-label="Voz de Google" value={voice} disabled={busy} onChange={event => setVoice(event.target.value as SpeechVoice)} className="mt-1 w-full rounded-lg bg-[#1b1b2a] p-3 text-white">
              {SPEECH_VOICES.map(name => <option key={name}>{name}</option>)}
            </select>
          </label>
          <label className="text-sm text-[#aaaac0]">Estilo
            <select aria-label="Estilo de locución" value={style} disabled={busy} onChange={event => setStyle(event.target.value as SpeechStyle)} className="mt-1 w-full rounded-lg bg-[#1b1b2a] p-3 text-white">
              {Object.entries(SPEECH_STYLES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
        </div>
        <button className={`${button} mt-3 w-full border-cyan-500/50`} disabled={busy || !authorized} onClick={() => void say("Buenas noches. Soy la voz de AutoParty. La música está lista. Disfrutemos la noche.")}>Probar voz de Google</button>
        <h3 className="mt-5 mb-2 text-sm font-bold">Frases de la fiesta</h3>
        <div className="grid grid-cols-2 gap-2">
          {DJ_PHRASE_CATEGORIES.map(category => <button key={category.id} className={button} disabled={busy || !authorized} onClick={() => void say(category.phrases[Math.floor(Math.random() * category.phrases.length)])}>{category.icon} {category.name}</button>)}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["A", "B"] as const).map(id => <button key={id} className={`${button} min-w-0 truncate`} disabled={busy || !authorized || !decks[id].track} onClick={() => announce(id)}>Presentar deck {id}</button>)}
        </div>
        <label htmlFor="dj-mc-text" className="mt-5 block text-sm font-bold">Anuncio personalizado</label>
        <textarea id="dj-mc-text" value={text} maxLength={400} disabled={busy} onChange={event => setText(event.target.value)} placeholder="Un saludo para los que siguen bailando…" rows={3} className="mt-2 w-full resize-y rounded-xl border border-[#303047] bg-[#171724] p-3 text-sm focus:outline-cyan-400" />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-[#aaaac0]">{text.length}/400</span>
          {busy ? <button className={`${button} border-red-500`} onClick={() => googleVoiceClient.stop()}><Square size={12} className="mr-2 inline" />Detener anuncio</button> : <button className={`${button} border-orange-500`} disabled={!text.trim() || !authorized} onClick={() => void say(text)}>Decir anuncio</button>}
        </div>
        <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-cyan-300">{phase === "generating" ? "Generando voz con Google…" : phase === "playing" ? "Reproduciendo voz de Google…" : message}</p>
        <p className="mt-3 text-xs leading-relaxed text-[#9292aa]">Voz generada por IA. El texto se envía a Google. La música baja solo durante la voz. Las frases recientes se reutilizan en esta pestaña. La generación consume cuota; el nivel gratuito tiene límites. Si falla, se muestra el error sin cambiar a una voz robótica.</p>
      </div>
    </div>
  );
}
