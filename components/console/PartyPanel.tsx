"use client";

import { useRef, useState } from "react";
import { useDeckStore } from "../../stores/deckStore";
import { useMixerStore } from "../../stores/mixerStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { useAIDJStore } from "../../stores/aiDJStore";
import { getAudioEngine } from "../../lib/audio/AudioEngine";
import VJMiniPlayer from "../vj/VJMiniPlayer";
import Fader from "../ui/Fader";
import { connectionLabels, useAIConnectionStore } from "../../stores/aiConnectionStore";
import { reasonMessage } from "../../lib/ai/contract";

export default function PartyPanel() {
  const decks = useDeckStore(s => s.decks);
  const mixer = useMixerStore();
  const tracks = useLibraryStore(s => s.tracks);
  const ai = useAIDJStore();
  const connection = useAIConnectionStore();
  const input = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const playing = decks.A.isPlaying || decks.B.isPlaying;
  const active = mixer.crossfader < 0.5 ? decks.A : decks.B;
  const audible = active.track ? active : decks.A.track ? decks.A : decks.B;
  const upcoming = ai.setlist.slice(ai.currentIndex + 1).map(item => tracks.find(track => track.id === item.trackId)).filter(Boolean);

  const togglePlayback = async () => {
    setMessage("");
    if (ai.status === "analyzing") { ai.deactivate(); return; }
    try {
      await getAudioEngine().resume();
      if (playing) {
        ai.deactivate();
        useDeckStore.getState().setPlaying("A", false);
        useDeckStore.getState().setPlaying("B", false);
      } else {
        const id = audible === decks.A ? "A" : "B";
        if (audible.track) {
          mixer.setCrossfader(id === "A" ? 0 : 1);
          useDeckStore.getState().setPlaying(id, true);
        }
        await ai.activate();
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo iniciar la fiesta."); }
  };

  return <section aria-label="Modo Fiesta" className="party-panel">
    <div className="party-now">
      <span className="party-eyebrow">TU MÚSICA · TU FIESTA</span>
      <h1>{audible.track?.title || "La fiesta empieza acá"}</h1>
      <p>{audible.track?.artist || "Agregá al menos dos canciones. El mezclador se encarga de pasarlas."}</p>
      <div role="status" className="party-status">{importing ? "Importando y analizando música…" : ai.status === "analyzing" ? "Preparando la fiesta…" : mixer.isAutoCrossfading ? "Mezclando con la próxima canción…" : ai.isActive ? "Automático activo · podés disfrutar" : playing ? "Reproduciendo en manual" : "Todo listo para empezar"}</div>
      <div className="mb-4 space-y-2 text-sm text-[#b8b8ca]">
        <p data-testid="ai-plan-source">{ai.planSource === "gemini" ? "Gemini conectado · plan recibido" : ai.planSource === "local" ? "Automático local · orden por BPM" : connectionLabels[connection.status]}</p>
        {ai.planSource === "local" && ai.planReason && <p>{reasonMessage(ai.planReason)}</p>}
        <button className="party-secondary" onClick={() => connection.setShowModal(true)}>Ver conexión IA</button>
      </div>
      <div className="party-actions">
        <button onClick={() => input.current?.click()} disabled={importing} className="party-secondary">Agregar música</button>
        <button onClick={togglePlayback} disabled={importing || (ai.status !== "analyzing" && !playing && tracks.length < 2)} className="party-primary">{ai.status === "analyzing" ? "Cancelar preparación" : playing ? "Pausar fiesta" : "Iniciar fiesta"}</button>
        <button onClick={ai.skipToNext} disabled={!ai.isActive || ai.status !== "mixing" || ai.currentIndex >= ai.setlist.length - 1} className="party-secondary">Próxima canción</button>
      </div>
      <input ref={input} type="file" accept="audio/*" multiple hidden aria-label="Archivos de música" onChange={async event => {
        const files = Array.from(event.target.files || []); event.target.value = "";
        if (!files.length) return;
        setImporting(true); setMessage("");
        const failures: string[] = [];
        try { for (const file of files) { try { await useLibraryStore.getState().importTrack(file); } catch { failures.push(file.name); } } }
        finally { setImporting(false); }
        if (failures.length) setMessage("No se pudieron importar: " + failures.join(", "));
      }} />
      {(message || ai.errorMessage) && <p role="alert">{message || ai.errorMessage}</p>}
      <div className="party-volume"><Fader value={mixer.masterVolume} onChange={mixer.setMasterVolume} label="Volumen de la fiesta" vertical={false} defaultValue={0.85} /></div>
      <p className="party-hint">{tracks.length < 2 ? "Faltan canciones: agregá al menos dos para mezclar automáticamente." : `${tracks.length} canciones disponibles · funciona con archivos locales`}</p>
    </div>
    <aside className="party-queue">
      <h2>{ai.isActive ? "Lo que viene" : "Tu música"}</h2>
      <ol>{(ai.isActive ? upcoming : tracks).slice(0, 6).map((track, index) => track && <li key={track.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{track.title}</strong><small>{track.artist}</small></div></li>)}</ol>
      {ai.isActive && !upcoming.length && <p>Última canción de la lista.</p>}
      {!tracks.length && <p>Tu biblioteca está vacía.</p>}
      <h2>Visuales para la fiesta</h2>
      <VJMiniPlayer />
      <button className="party-secondary" onClick={() => window.open("/vj", "EZE_MIX_VJ_WINDOW", "width=1280,height=720")}>Abrir TV / proyector</button>
      <p className="party-hint">Podés cargar videos desde la biblioteca de la consola manual.</p>
    </aside>
  </section>;
}
