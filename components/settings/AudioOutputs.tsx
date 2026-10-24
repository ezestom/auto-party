"use client";

import { useEffect, useState } from "react";
import { getAudioEngine } from "../../lib/audio/AudioEngine";

type Kind = "headphones" | "booth";

export default function AudioOutputs() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [supported] = useState(() => typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype && !!navigator.mediaDevices?.enumerateDevices);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(() => ({
    headphones: getAudioEngine().getMonitorOutputId("headphones"),
    booth: getAudioEngine().getMonitorOutputId("booth"),
  }));

  useEffect(() => {
    if (!supported) return;
    let active = true;
    const refresh = async () => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        if (active) setDevices(list.filter(d => d.kind === "audiooutput" && d.deviceId));
      } catch { if (active) setError("Could not list audio outputs."); }
    };
    void refresh();
    navigator.mediaDevices.addEventListener("devicechange", refresh);
    return () => { active = false; navigator.mediaDevices.removeEventListener("devicechange", refresh); };
  }, [supported]);

  async function change(kind: Kind, id?: string) {
    setBusy(true);
    setError("");
    try {
      if (id === undefined) {
        const media = navigator.mediaDevices as MediaDevices & { selectAudioOutput?: () => Promise<MediaDeviceInfo> };
        if (!media.selectAudioOutput) throw new Error("Device selection is not available in this browser.");
        const device = await media.selectAudioOutput();
        id = device.deviceId;
        setDevices(previous => [...previous.filter(d => d.deviceId !== id), device]);
      }
      await getAudioEngine().setMonitorOutput(kind, id);
      setSelected(previous => ({ ...previous, [kind]: getAudioEngine().getMonitorOutputId(kind) }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect the output.");
    } finally { setBusy(false); }
  }

  return <section>
    <p className="settings-description">Choose separate devices for private listening or extra speakers. Leave them off if you only use your system speakers. Output selections apply to this session.</p>
    {!supported ? <p role="status" className="settings-note">This browser does not support separate audio outputs. Music still plays through your system speakers.</p> :
      (["headphones", "booth"] as const).map(kind => <div key={kind} className="settings-output">
        <label htmlFor={kind + "-output"}>{kind === "headphones" ? "Headphones / CUE" : "Extra speakers / Booth"}</label>
        <div className="settings-output-controls">
          <select id={kind + "-output"} value={selected[kind]} disabled={busy} onChange={event => void change(kind, event.target.value)}>
            <option value="">Off</option>
            {devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || "Output " + (index + 1)}</option>)}
          </select>
          {typeof navigator.mediaDevices !== "undefined" && "selectAudioOutput" in navigator.mediaDevices &&
            <button type="button" className="settings-secondary" aria-label={kind === "headphones" ? "Choose headphones output" : "Choose extra speakers output"} disabled={busy} onClick={() => void change(kind)}>Choose device</button>}
        </div>
      </div>)}
    {error && <p role="alert" className="settings-note text-red-300">{error}</p>}
  </section>;
}
