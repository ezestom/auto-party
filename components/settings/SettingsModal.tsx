"use client";

import TransitionFXControls from "../ai/TransitionFXControls";
import { useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Sliders, Volume2, Bot, Keyboard, RotateCcw, Check } from "lucide-react";
import AudioOutputs from "./AudioOutputs";
import { useSettingsStore } from "../../stores/settingsStore";
import { useAIConnectionStore, type ConnectionState } from "../../stores/aiConnectionStore";

const tabs = [
  { id: "controls", label: "General", icon: Sliders },
  { id: "audio", label: "Audio", icon: Volume2 },
  { id: "aidj", label: "Auto-DJ", icon: Bot },
  { id: "shortcuts", label: "Help", icon: Keyboard },
] as const;

const connectionStatus: Record<ConnectionState, string> = {
  unknown: "AI connection has not been checked.", unconfigured: "Local Auto-DJ is available. AI has not been configured.",
  locked: "An access code is required to use AI.", ready: "Groq is ready to test.", checking: "Checking connection…",
  connected: "Connected to Groq.", error: "AI is unavailable. Local Auto-DJ still works.",
};

function ToggleSetting({ title, description, checked, onChange }: {
  title: string; description: string; checked: boolean; onChange: (value: boolean) => void;
}) {
  return <label className="settings-card settings-row">
    <span><span className="settings-label">{title}</span><span className="settings-description">{description}</span></span>
    <input type="checkbox" role="switch" aria-label={title} className="settings-switch" checked={checked} onChange={event => onChange(event.target.checked)} />
  </label>;
}

export default function SettingsModal() {
  const settings = useSettingsStore();
  const connection = useAIConnectionStore();
  const openingAI = useRef(false);
  const { activeTab, setActiveTab } = settings;

  return <Dialog.Root open={settings.isOpen} onOpenChange={settings.setIsOpen}>
    <Dialog.Portal>
      <Dialog.Overlay className="settings-overlay" />
      <Dialog.Content className="settings-dialog" onCloseAutoFocus={event => {
        event.preventDefault();
        if (!openingAI.current) document.getElementById("settings-btn")?.focus();
        openingAI.current = false;
      }}>
        <header className="settings-header">
          <div><Dialog.Title>Settings</Dialog.Title><Dialog.Description>Make it yours. Preferences save automatically.</Dialog.Description></div>
          <Dialog.Close className="settings-icon-button" aria-label="Close settings"><X size={18} /></Dialog.Close>
        </header>
        <div role="tablist" aria-label="Settings sections" className="settings-tabs" onKeyDown={event => {
          const index = tabs.findIndex(tab => tab.id === activeTab);
          const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
          if (next < 0) return;
          event.preventDefault(); setActiveTab(tabs[next].id);
          document.getElementById(`settings-tab-${tabs[next].id}`)?.focus();
        }}>
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} id={`settings-tab-${id}`} role="tab"
            aria-selected={activeTab === id} aria-controls={`settings-panel-${id}`} tabIndex={activeTab === id ? 0 : -1}
            onClick={() => setActiveTab(id)}><Icon size={14} /><span>{label}</span></button>)}
        </div>
        <div key={activeTab} id={`settings-panel-${activeTab}`} role="tabpanel" aria-labelledby={`settings-tab-${activeTab}`} tabIndex={0} className="settings-body">
          {activeTab === "controls" && <>
            <div className="settings-intro"><h3>Ready to play</h3><p>The defaults are a good starting point for any party.</p></div>
            <ToggleSetting title="Protect playing decks" description="Prevents accidental file drops from replacing a song that is playing. Recommended on."
              checked={settings.lockPlayingDeck} onChange={settings.setLockPlayingDeck} />
            <ToggleSetting title="Keep volume consistent" description="Balances song levels when you load them. Recommended on."
              checked={settings.autoGainEnabled} onChange={settings.setAutoGainEnabled} />
            <ToggleSetting title="Play immediately after loading" description="Leave off to choose when each song starts."
              checked={settings.autoPlayOnLoad} onChange={settings.setAutoPlayOnLoad} />
          </>}
          {activeTab === "audio" && <>
            <div className="settings-intro"><h3>Sound without setup</h3><p>Your audience hears your current system speakers. Use your device volume and the console master to adjust the level.</p></div>
            <details className="settings-card settings-advanced">
              <summary>Headphones & extra speakers<span>Optional · Advanced</span></summary>
              <AudioOutputs />
            </details>
            <p className="settings-note">The crossfader curve is available directly in the mixer.</p>
          </>}
          {activeTab === "aidj" && <>
            <div className="settings-intro"><h3>Let the music flow</h3><p>Local Auto-DJ works without an account or AI setup. Start it from Party mode.</p></div>
            <label className="settings-card settings-row" htmlFor="transition-length">
              <span><span className="settings-label">Transition length</span><span className="settings-description">How long songs overlap when Auto-DJ mixes. Cuts use a shorter transition.</span></span>
              <select id="transition-length" value={settings.aiDefaultDuration} onChange={event => settings.setAiDefaultDuration(Number(event.target.value))}>
                <option value={4}>4 seconds · Quick</option><option value={8}>8 seconds · Recommended</option><option value={16}>16 seconds · Long</option>
              </select>
            </label>
            <section className="settings-card"><TransitionFXControls /></section>
            <ToggleSetting title="AI hand" description="Shows what Auto-DJ is preparing. Steps aside while you interact and returns after 3 seconds of inactivity."
              checked={settings.aiPointerEnabled} onChange={settings.setAiPointerEnabled} />
            <section className="settings-card"><h3 className="settings-label">AI planning</h3><p className="settings-description">Optional: let Groq suggest the song order. The local mixer still handles playback.</p>
              <p className="settings-note">{connectionStatus[connection.status]}</p>
              <button className="settings-secondary" onClick={() => { openingAI.current = true; settings.setIsOpen(false); connection.setShowModal(true); }}>View AI connection</button>
            </section>
          </>}
          {activeTab === "shortcuts" && <>
            <div className="settings-intro"><h3>A few useful shortcuts</h3><p>These work with the control you have focused.</p></div>
            <dl className="settings-shortcuts">
              {[
                ["Move between controls", "Tab"], ["Adjust a slider", "Arrow keys"], ["Set a slider to its minimum / maximum", "Home / End"],
                ["Activate a button", "Enter / Space"], ["Delete a saved hot cue", "Shift + click"], ["Close settings", "Esc"],
              ].map(([description, key]) => <div className="settings-card settings-row" key={key}><dt>{description}</dt><dd><kbd>{key}</kbd></dd></div>)}
            </dl>
            <p className="settings-note">Recordings are saved as stereo WAV audio. Open Library to import music and videos.</p>
          </>}
        </div>
        <footer className="settings-footer">
          <button className="settings-reset" onClick={settings.resetDefaults}><RotateCcw size={14} /> Reset preferences</button>
          <Dialog.Close className="settings-done"><Check size={16} /> Done</Dialog.Close>
        </footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
