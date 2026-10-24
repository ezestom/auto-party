"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { connectionLabels, useAIConnectionStore } from "../../stores/aiConnectionStore";

export default function AIConnectionModal() {
  const connection = useAIConnectionStore();
  const [accessCode, setAccessCode] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const busy = connection.status === "checking";
  const show = connection.showModal, close = connection.setShowModal;
  useEffect(() => {
    if (!show) return;
    const previous = document.activeElement;
    void useAIConnectionStore.getState().refresh();
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(false); }
      if (event.key !== "Tab") return;
      const elements = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') || []);
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); if (previous instanceof HTMLElement) previous.focus(); };
  }, [show, close]);
  if (!show) return null;
  const button = "min-h-11 px-4 py-2 rounded-lg border border-[#34344c] text-sm font-bold disabled:opacity-40 cursor-pointer";
  return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" onClick={() => close(false)}>
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="ai-connection-title" tabIndex={-1}
      onClick={event => event.stopPropagation()} className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl border border-[#34344c] bg-[#10101b] p-5 text-white shadow-2xl">
      <div className="flex items-center justify-between gap-3">
        <h2 id="ai-connection-title" className="text-lg font-bold">Party AI connection</h2>
        <button aria-label="Close AI connection" onClick={() => close(false)} className="grid size-11 place-items-center"><X size={18} /></button>
      </div>
      <p role="status" className="mt-3 font-bold text-[#00d4ff]">{connectionLabels[connection.status]}</p>
      {connection.checkedAt && <p className="mt-1 text-xs text-[#aaaabd]">Last response: {new Date(connection.checkedAt).toLocaleTimeString()} · {connection.model}</p>}
      <p className="mt-3 text-sm leading-6 text-[#b8b8ca]">Groq suggests song order and transitions using titles, artists, BPM, key and duration. Audio stays on your device. Local mixing remains available.</p>
      {!connection.configured && <p className="mt-3 text-sm text-[#ffd181]">AI needs to be configured on the server. You can use local Auto-DJ.</p>}
      {!connection.authorized && <form className="mt-4 space-y-3" onSubmit={async event => {
        event.preventDefault(); const code = accessCode; setAccessCode("");
        if (await connection.connect(code)) await useAIConnectionStore.getState().test();
      }}>
        <label className="block text-sm" htmlFor="ai-access-code">Access code</label>
        <input id="ai-access-code" type="password" autoComplete="off" maxLength={200} value={accessCode}
          onChange={event => setAccessCode(event.target.value)} disabled={busy || !connection.configured}
          className="w-full min-h-11 rounded-lg border border-[#34344c] bg-black/40 px-3" />
        <button type="submit" disabled={busy || !connection.configured || !accessCode} className={button + " w-full border-[#ff6b00]"}>Connect and test</button>
      </form>}
      {connection.message && <p role="alert" className="mt-3 text-sm text-[#ffd181]">{connection.message}</p>}
      {connection.authorized && <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => void connection.test()} disabled={busy || !connection.configured} className={button}>Test connection</button>
        <button onClick={() => void connection.logout()} disabled={busy} className={button}>Sign out of AI</button>
      </div>}
      <div className="mt-5 flex flex-col gap-2">
        <button onClick={() => { connection.setUseRemoteAI(false); close(false); }} className={button}>Use local Auto-DJ</button>
        {connection.authorized && <button disabled={busy} onClick={() => { connection.setUseRemoteAI(true); close(false); }} className={button + " border-[#00d4ff]"}>Use Groq next session</button>}
      </div>
      <p className="mt-3 text-xs text-[#aaaabd]">Testing contacts Groq and uses your available quota. Changing this preference does not interrupt the current song.</p>
    </div>
  </div>;
}
