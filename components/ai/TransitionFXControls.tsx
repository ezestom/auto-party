"use client";
import { useId } from 'react';
import { useAIDJStore } from '../../stores/aiDJStore';
import { EFFECT_LABELS, type NextTransitionEffect } from '../../lib/ai/transitionEffects';
export default function TransitionFXControls() {
    const id = useId(), ai = useAIDJStore();
    const busy = ai.status === 'transitioning';
    return <div className="transition-fx-controls">
  <label htmlFor={id}>Transition effects</label>
  <select id={id} value={ai.nextEffect} disabled={busy} onChange={event => ai.setNextEffect(event.target.value as NextTransitionEffect)}>
    {Object.entries(EFFECT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
  </select>
  <p>Auto uses occasional Groq suggestions. Off stays off. Filter and echo apply to the next transition only. Echo uses estimated tempo, without beat-grid sync.</p>
  <div className="transition-fx-status" aria-live="polite">{ai.activeEffect === 'none' ? 'Simple fade is always the fallback.' : ai.activeEffect === 'echo_out' ? 'Echo out is active.' : 'Filter sweep is active.'}</div>
  {ai.activeEffect !== 'none' && <button type="button" onClick={ai.cancelEffect}>Cancel effect</button>}
 </div>;
}
