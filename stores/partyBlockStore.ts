"use client";
import { create } from 'zustand';
export interface PartyBlock {
    id: string;
    name: string;
    trackIds: string[];
}
const key = 'autoparty_blocks_v1';
export function parseBlocks(value: unknown): PartyBlock[] {
    if (!Array.isArray(value))
        return [];
    const seen = new Set<string>();
    return value.slice(0, 64).flatMap(item => {
        if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 100 || seen.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 60 || !Array.isArray(item.trackIds))
            return [];
        seen.add(item.id);
        return [{ id: item.id, name: item.name.trim(), trackIds: [...new Set(item.trackIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 128))].slice(0, 200) as string[] }];
    });
}
function load() { try {
    return typeof window === 'undefined' ? [] : parseBlocks(JSON.parse(localStorage.getItem(key) || '[]'));
}
catch {
    return [];
} }
function save(blocks: PartyBlock[]) { try {
    localStorage.setItem(key, JSON.stringify(blocks));
}
catch { /* Session editing still works when storage is unavailable. */ } }
interface Blocks {
    blocks: PartyBlock[];
    activeId: string;
    browsingId: string;
    saveBlock: (block: PartyBlock) => void;
    removeBlock: (id: string) => void;
    setActive: (id: string) => void;
    setBrowsing: (id: string) => void;
    addTracks: (id: string, trackIds: string[]) => void;
}
export const usePartyBlockStore = create<Blocks>((set, get) => ({
    blocks: load(), activeId: '', browsingId: '',
    saveBlock: block => { const blocks = parseBlocks(get().blocks.some(item=>item.id===block.id)?get().blocks.map(item=>item.id===block.id?block:item):[...get().blocks,block]); save(blocks); set({ blocks }); },
    removeBlock: id => { const blocks = get().blocks.filter(item => item.id !== id); save(blocks); set({ blocks, ...(get().activeId === id ? { activeId: '' } : {}), ...(get().browsingId === id ? { browsingId:'' } : {}) }); },
    setActive: activeId => set({ activeId: get().blocks.some(block => block.id === activeId) ? activeId : '' }),
    setBrowsing: browsingId => set({browsingId:get().blocks.some(block=>block.id===browsingId)?browsingId:''}),
    addTracks: (id,trackIds) => { const block=get().blocks.find(block=>block.id===id); if(block)get().saveBlock({...block,trackIds:[...block.trackIds,...trackIds]}); },
}));
