"use client";

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useAIDJStore } from "../../stores/aiDJStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { getAudioEngine } from "../../lib/audio/AudioEngine";
import { usePartyBlockStore } from '../../stores/partyBlockStore';
import { useLibraryStore } from '../../stores/libraryStore';

interface Props {
  onLibraryChange: (open: boolean) => void;
  returnRef: RefObject<HTMLButtonElement | null>;
}
type Position = { x: number; y: number; message: string; press: boolean };

// Presentation only: no clicks, transport calls or audio timing depend on this guide.
export default function AIPointer({ onLibraryChange, returnRef }: Props) {
  const enabled = useSettingsStore(s => s.aiPointerEnabled);
  const [position, setPosition] = useState<Position | null>(null);

  useEffect(() => {
    let lastInput = performance.now(), started = 0, key = "", completed = "";
    let ownsLibrary = false, scrolled = false, target: HTMLElement | null = null;
    const held = new Set<number | string>();
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const sheet = () => document.getElementById("media-library-drawer");
    const open = () => sheet()?.dataset.open === "true";
    const hide = () => {
      setPosition(null);
      target?.classList.remove("ai-pointer-target", "ai-pointer-pressed");
      target = null;
    };
    const releaseLibrary = () => {
      if (ownsLibrary) onLibraryChange(false);
      ownsLibrary = false;
    };
    const input = (event: Event) => {
      lastInput = performance.now(); started = 0; scrolled = false;
      hide();
      // A deliberate action takes ownership of the panel, including its close button.
      if (event.type !== "pointermove") ownsLibrary = false;
      if (event instanceof PointerEvent) {
        if (event.type === "pointerdown") held.add(event.pointerId);
        if (event.type === "pointerup" || event.type === "pointercancel") held.delete(event.pointerId);
      }
      if (event instanceof KeyboardEvent) {
        if (event.type === "keydown") held.add(event.code);
        else held.delete(event.code);
        if (event.key === "Escape") completed = key;
      }
      const element = event.target instanceof Element ? event.target : null;
      if (event.type === "pointerdown" && open() &&
        (element?.closest(".library-sheet-handle, .library-drawer-overlay, #library-toggle-btn"))) completed = key;
    };
    const blur = () => { held.clear(); lastInput = performance.now(); hide(); };
    const pointAt = (element: HTMLElement | null, message: string, press = false) => {
      const rect = element?.getBoundingClientRect();
      if (!rect || !rect.width || !rect.height || rect.bottom < 0 || rect.top >= innerHeight) { hide(); return; }
      if (target !== element) {
        target?.classList.remove("ai-pointer-target", "ai-pointer-pressed");
        target = element;
        target?.classList.add("ai-pointer-target");
      }
      target?.classList.toggle("ai-pointer-pressed", press);
      setPosition({ x: Math.max(4, Math.min(innerWidth - 76, rect.x + Math.min(rect.width / 2, 110))),
        y: Math.max(4, Math.min(innerHeight - 46, rect.y + rect.height / 2)), message, press });
    };
    const tick = () => {
      const ai = useAIDJStore.getState(), pending = ai.preparation;
      const nextKey = pending ? pending.trackId + ":" + pending.deck : "";
      if (nextKey !== key) { key = nextKey; started = 0; completed = ""; scrolled = false; }
      if (!enabled || motion.matches || !ai.isActive || !['mixing','transitioning'].includes(ai.status)) {
        hide(); releaseLibrary(); return;
      }
      const editing = document.activeElement?.matches("input,textarea,select,[contenteditable=true]");
      const anotherDialog = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')]
        .some(dialog => dialog.id !== "media-library-drawer");
      if (document.hidden || held.size || editing || anotherDialog || useLibraryStore.getState().importStatus.active || performance.now() - lastInput < 3000) {
        hide(); started = 0; return;
      }
      const cueAge = ai.lastPlay ? performance.now()-ai.lastPlay.at : Infinity;
      const untilPlay = ai.playAt === null ? Infinity : ai.playAt-(getAudioEngine().ctx?.currentTime || 0);
      if ((ai.lastPlay && cueAge < 600) || (pending && untilPlay >= 0 && untilPlay < 1.4)) {
        releaseLibrary();
        const deck = cueAge < 600 ? ai.lastPlay!.deck : pending!.deck;
        const button = document.getElementById('play-btn-'+deck);
        const rect = button?.getBoundingClientRect(), sheetTop = sheet()?.getBoundingClientRect().top || innerHeight;
        if (!rect || (open() && rect.bottom>sheetTop)) { hide(); return; }
        pointAt(button,'Starting deck '+deck,cueAge < 600); return;
      }
      if (!pending || ai.status !== 'mixing') { hide(); releaseLibrary(); return; }
      if (completed === key) { hide(); return; }
      if (!started) started = performance.now();
      const elapsed = performance.now() - started;
      const handle = sheet()?.querySelector<HTMLButtonElement>(".library-sheet-handle") || null;
      if (elapsed < 600) { pointAt(handle, "Preparing the next track"); return; }
      if (elapsed < 3800) {
        if (!open()) {
          // A user closed the panel during this run; do not reopen it behind their hand.
          if (ownsLibrary) { ownsLibrary = false; completed = key; hide(); return; }
          const themes=usePartyBlockStore.getState();
          const destination=ai.pendingTheme?.blockId??themes.activeId;
          const theme=themes.blocks.find(theme=>theme.id===destination&&theme.trackIds.includes(pending.trackId));
          themes.setBrowsing(theme?.id||'');
          returnRef.current = document.activeElement instanceof HTMLButtonElement ? document.activeElement : document.querySelector("#library-toggle-btn");
          onLibraryChange(true); ownsLibrary = true;
          return;
        }
        if (elapsed < 1100) { pointAt(handle, "Preparing the next track"); return; }
        const row = [...document.querySelectorAll<HTMLElement>("[data-ai-track]")].find(el => el.dataset.aiTrack === pending.trackId) || null;
        if (row && ownsLibrary && !scrolled) { row.scrollIntoView({ block: "nearest", behavior: "instant" }); scrolled = true; }
        const button = row?.querySelector<HTMLButtonElement>('[title="Load to Deck ' + pending.deck + '"]') || null;
        pointAt(elapsed < 2400 ? row || handle : button || row || handle, "Preparing deck " + pending.deck);
        return;
      }
      releaseLibrary();
      if (elapsed < 4500) { hide(); return; }
      if (elapsed < 5700) {
        const deck = document.querySelector<HTMLElement>('#console-panel-' + pending.deck);
        const visibleDeck = deck?.getBoundingClientRect().width ? deck : document.querySelector<HTMLElement>(".party-queue");
        pointAt(visibleDeck, "Next track prepared for deck " + pending.deck); return;
      }
      completed = key; hide();
    };
    const events = ["pointermove", "pointerdown", "pointerup", "pointercancel", "keydown", "keyup", "wheel"];
    events.forEach(name => document.addEventListener(name, input, { capture: true, passive: true }));
    window.addEventListener("blur", blur);
    const timer = window.setInterval(tick, 100);
    return () => {
      clearInterval(timer);
      events.forEach(name => document.removeEventListener(name, input, true));
      window.removeEventListener("blur", blur);
      target?.classList.remove("ai-pointer-target", "ai-pointer-pressed");
      releaseLibrary();
    };
  }, [enabled, onLibraryChange, returnRef]);

  if (!enabled || !position) return null;
  return createPortal(<div className="ai-pointer" data-press={position.press} style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
    <Image src="/ai-hand.svg" width={32} height={32} alt="" draggable={false} />
    <span aria-hidden="true">AI</span><span className="sr-only" role="status">{position.message}</span>
  </div>, document.body);
}
