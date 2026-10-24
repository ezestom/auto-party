"use client";

import { useRef, useState } from "react";
import { useDeckStore } from "../../stores/deckStore";
import { useMixerStore } from "../../stores/mixerStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { useAIDJStore } from "../../stores/aiDJStore";
import { getAudioEngine } from "../../lib/audio/AudioEngine";
import TransitionFXControls from "../ai/TransitionFXControls";
import PartyBlocks from "./PartyBlocks";
import PartyProgram from "./PartyProgram";
import { usePartyBlockStore } from '../../stores/partyBlockStore';
import Fader from "../ui/Fader";
import { connectionLabels, useAIConnectionStore } from "../../stores/aiConnectionStore";
import { reasonMessage } from "../../lib/ai/contract";

export default function PartyPanel() {
  const decks = useDeckStore(s => s.decks);
  const mixer = useMixerStore();
  const tracks = useLibraryStore(s => s.allTracks);
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
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to start the party."); }
  };

  return <section aria-label="Party mode" className="party-panel">
    <div className="party-now">
      <span className="party-eyebrow">YOUR MUSIC · YOUR PARTY</span>
      <h1>{audible.track?.title || "The party starts here"}</h1>
      <p>{audible.track?.artist || "Add music and choose your themes. The mixer handles the transitions."}</p>
      <div role="status" className="party-status">{importing ? "Importing and analyzing music…" : ai.status === "analyzing" ? "Preparing the party…" : mixer.isAutoCrossfading ? "Mixing into the next song…" : ai.status === "error" ? "Auto-DJ needs attention · current playback continues" : ai.status === "manual" ? "Manual control · Auto-DJ is waiting" : ai.isActive ? "Auto-DJ is running · enjoy the party" : playing ? "Playing manually" : "Ready to start"}</div>
      <div className="mb-4 space-y-2 text-sm text-[#b8b8ca]">
        <p data-testid="ai-plan-source">{ai.planSource === "groq" ? "Groq connected · plan received" : ai.planSource === "local" ? "Local Auto-DJ · sorted by BPM" : connectionLabels[connection.status]}</p>
        {ai.planSource === "local" && ai.planReason && <p>{reasonMessage(ai.planReason)}</p>}
        <button className="party-secondary" onClick={() => connection.setShowModal(true)}>View AI connection</button>
      </div>
      {ai.isActive && ["manual", "error"].includes(ai.status) && <button className="party-primary mb-3" onClick={ai.resume}>Resume Auto-DJ</button>}
      <div className="party-actions">
        <button onClick={() => input.current?.click()} disabled={importing} className="party-secondary">Add music</button>
        <button onClick={togglePlayback} disabled={importing || (ai.status !== "analyzing" && !playing && !tracks.length)} className="party-primary">{ai.status === "analyzing" ? "Cancel preparation" : playing ? "Pause party" : "Start party"}</button>
        <button onClick={ai.skipToNext} disabled={!ai.isActive || ai.status !== "mixing" || ai.currentIndex >= ai.setlist.length - 1} className="party-secondary">Next song</button>
      </div>
      <input ref={input} type="file" accept="audio/*" multiple hidden aria-label="Music files" onChange={async event => {
        const files = Array.from(event.target.files || []); event.target.value = "";
        if (!files.length) return;
        setImporting(true); setMessage("");
        const destination=usePartyBlockStore.getState().activeId;
        const failures: string[] = [];
        try { for (const file of files) { try { const track=await useLibraryStore.getState().importTrack(file);usePartyBlockStore.getState().addTracks(destination,[track.id]); } catch { failures.push(file.name); } } }
        finally { setImporting(false); }
        if (failures.length) setMessage("Could not import: " + failures.join(", "));
      }} />
      {(message || ai.errorMessage) && <p role="alert">{message || ai.errorMessage}</p>}
      <div className="party-volume"><Fader value={mixer.masterVolume} onChange={mixer.setMasterVolume} label="Party volume" vertical={false} defaultValue={0.85} /></div>
      <p className="party-hint">{!tracks.length ? "Add songs to start the party." : `${tracks.length} songs available · full songs, natural endings`}</p>
    </div>
    <aside className="party-queue">
      <PartyBlocks />
      <PartyProgram />
      <details className="party-fx-details"><summary>Transition effects</summary><TransitionFXControls /></details>
      <h2>{ai.isActive ? "Up next" : "Your music"}</h2>
      <ol>{(ai.isActive ? upcoming : tracks).slice(0, 6).map((track, index) => track && <li key={index+":"+track.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{track.title}</strong><small>{ai.requestedIds.includes(track.id) ? "DJ request · " : ""}{track.artist}</small></div>{ai.isActive && <div className="party-queue-actions"><button aria-label={"Play next: " + track.title} disabled={ai.status !== "mixing" && ai.status !== "manual"} onClick={() => ai.queueTrack(track.id)}>Next</button><button aria-label={"Remove from queue: " + track.title} disabled={ai.status === "transitioning"} onClick={() => ai.removeQueued(track.id)}>×</button></div>}</li>)}</ol>
      {ai.isActive && !upcoming.length && <p>Last song in this block. Choose another block or add a request to keep going.</p>}
      {!tracks.length && <p>Your library is empty.</p>}
      <h2>Party visuals</h2>
      <p className="party-hint">Import videos from Library, then use Visuals to open the DJ preview and TV / projector.</p>
    </aside>
  </section>;
}
