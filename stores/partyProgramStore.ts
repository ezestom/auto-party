"use client";
import { create } from 'zustand';
import { parseProgram, type ProgramStep } from '../lib/ai/partyProgram';
const key = 'autoparty_program_v1';
function load() {
  try {
    const saved = typeof window === 'undefined' ? {} : JSON.parse(localStorage.getItem(key) || '{}');
    return {steps:parseProgram(saved.steps),enabled:saved.enabled === true};
  } catch { return {steps:[],enabled:false}; }
}
interface Program {
  steps: ProgramStep[];
  enabled: boolean;
  setSteps: (steps: ProgramStep[]) => void;
  setEnabled: (enabled: boolean) => void;
}
export const usePartyProgramStore = create<Program>((set,get) => {
  const save = () => { try { const {steps,enabled}=get(); localStorage.setItem(key,JSON.stringify({steps,enabled})); } catch {} };
  return {...load(),setSteps:steps=>{set({steps:parseProgram(steps)});save();},setEnabled:enabled=>{set({enabled});save();}};
});
