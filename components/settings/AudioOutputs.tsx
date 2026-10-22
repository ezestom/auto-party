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
      } catch { if (active) setError("No se pudieron consultar las salidas de audio."); }
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
        if (!media.selectAudioOutput) throw new Error("La selección adicional no está disponible en este navegador.");
        const device = await media.selectAudioOutput();
        id = device.deviceId;
        setDevices(previous => [...previous.filter(d => d.deviceId !== id), device]);
      }
      await getAudioEngine().setMonitorOutput(kind, id);
      setSelected(previous => ({ ...previous, [kind]: getAudioEngine().getMonitorOutputId(kind) }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo conectar la salida.");
    } finally { setBusy(false); }
  }

  return <section className="p-3.5 rounded-xl border border-[#1e1e30] bg-[#0c0c16] space-y-3">
    <h3 className="font-mono text-white font-bold text-xs">Salidas de monitoreo</h3>
    <p className="text-[11px] text-[#9999b0]">El público escucha la salida predeterminada del sistema. Elegí otro dispositivo físico para preescucha o booth. La preescucha queda apagada hasta que selecciones una salida.</p>
    {!supported && <p role="status" className="text-xs text-[#ffd600]">Este navegador no permite elegir salidas independientes.</p>}
    {(["headphones", "booth"] as const).map(kind => <div key={kind} className="space-y-1">
      <label className="block text-xs text-white" htmlFor={kind + "-output"}>{kind === "headphones" ? "Auriculares / CUE" : "Booth"}</label>
      <div className="flex gap-2">
        <select id={kind + "-output"} value={selected[kind]} disabled={!supported || busy} onChange={e => void change(kind, e.target.value)} className="min-w-0 flex-1 bg-[#141422] text-white border border-[#2a2a3d] rounded p-2 text-xs">
          <option value="">Desconectado</option>
          {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Salida " + (i + 1)}</option>)}
        </select>
        {supported && typeof navigator.mediaDevices !== "undefined" && "selectAudioOutput" in navigator.mediaDevices && <button type="button" disabled={busy} onClick={() => void change(kind)} className="text-xs text-[#ff6b00]">Elegir dispositivo</button>}
      </div>
    </div>)}
    {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
  </section>;
}
