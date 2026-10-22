"use client";
import { create } from "zustand";
import { getAIStatus, unlockAI, logoutAI, testAIConnection } from "../lib/ai/geminiClient";
import { AIError, reasonMessage, type PlanResult } from "../lib/ai/contract";

export type ConnectionState = "unknown" | "unconfigured" | "locked" | "ready" | "checking" | "connected" | "error";
export const connectionLabels: Record<ConnectionState, string> = { unknown: "IA sin comprobar", unconfigured: "IA sin configurar",
  locked: "IA requiere acceso", ready: "Gemini listo para probar", checking: "Comprobando conexión…", connected: "Gemini conectado", error: "Error de conexión IA" };
interface ConnectionStore {
  status: ConnectionState; configured: boolean; authorized: boolean; model: string | null; checkedAt: string | null;
  message: string; showModal: boolean; useRemoteAI: boolean;
  setShowModal: (show: boolean) => void; setUseRemoteAI: (use: boolean) => void;
  refresh: () => Promise<void>; connect: (accessCode: string) => Promise<boolean>; test: () => Promise<void>; logout: () => Promise<void>;
  recordPlan: (plan: PlanResult) => void;
}
let revision = 0;
function failure(error: unknown): Pick<ConnectionStore, "status" | "message"> & Partial<Pick<ConnectionStore, "configured" | "authorized">> {
  const code = error instanceof AIError ? error.code : "NETWORK";
  return { status: code === "NOT_CONFIGURED" ? "unconfigured" : code === "ACCESS_REQUIRED" || code === "INVALID_ACCESS_CODE" ? "locked" : "error", message: reasonMessage(code),
    ...(code === "NOT_CONFIGURED" ? { configured: false, authorized: false } : code === "ACCESS_REQUIRED" || code === "INVALID_ACCESS_CODE" ? { authorized: false } : {}) };
}
export const useAIConnectionStore = create<ConnectionStore>((set) => ({
  status: "unknown", configured: false, authorized: false, model: null, checkedAt: null, message: "", showModal: false, useRemoteAI: true,
  setShowModal: showModal => set({ showModal }), setUseRemoteAI: useRemoteAI => set({ useRemoteAI }),
  refresh: async () => {
    const current = ++revision;
    try { const state = await getAIStatus(); if (current === revision) set({ ...state, status: !state.configured ? "unconfigured" : state.authorized ? "ready" : "locked", message: "", checkedAt: null }); }
    catch (error) { if (current === revision) set(failure(error)); }
  },
  connect: async accessCode => {
    const current = ++revision; set({ status: "checking", message: "" });
    try {
      await unlockAI(accessCode); const state = await getAIStatus();
      if (current !== revision) return false;
      set({ ...state, status: state.authorized ? "ready" : "locked", useRemoteAI: true, checkedAt: null });
      return state.authorized;
    } catch (error) { if (current === revision) set(failure(error)); return false; }
  },
  test: async () => {
    const current = ++revision; set({ status: "checking", message: "" });
    try { const result = await testAIConnection(); if (current === revision) set({ status: "connected", configured: true, authorized: true, model: result.model, checkedAt: result.checkedAt }); }
    catch (error) { if (current === revision) set({ ...failure(error), checkedAt: null }); }
  },
  logout: async () => {
    const current = ++revision;
    try { await logoutAI(); if (current === revision) set({ status: "locked", authorized: false, useRemoteAI: false, checkedAt: null, message: "" }); }
    catch (error) { if (current === revision) set(failure(error)); }
  },
  recordPlan: plan => {
    revision++;
    if (plan.source === "gemini") set({ status: "connected", configured: true, authorized: true, model: plan.model || "Gemini", checkedAt: new Date().toISOString(), message: "" });
    else if (plan.reason && plan.reason !== "LOCAL_SELECTED") set({ ...failure(new AIError(plan.reason)), checkedAt: null });
  },
}));
