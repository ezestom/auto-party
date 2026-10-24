"use client";
import { useState } from 'react';
import { usePartyBlockStore } from '../../stores/partyBlockStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { useAIDJStore } from '../../stores/aiDJStore';
import ThemeEditor, {refreshEditedTheme} from '../library/ThemeEditor';
export default function PartyBlocks() {
  const {blocks,activeId}=usePartyBlockStore(),tracks=useLibraryStore(s=>s.allTracks),ai=useAIDJStore();
  const [editing,setEditing]=useState<string|null>(null);
  const selected=ai.pendingTheme?.blockId??activeId,active=blocks.find(block=>block.id===selected);
  const busy=['analyzing','transitioning'].includes(ai.status);
  return <div className="party-blocks">
    <label htmlFor="party-block">Musical block</label>
    <select id="party-block" disabled={busy} value={selected} onChange={event=>void ai.applyBlock(event.target.value)}>
      <option value="">All music</option>{blocks.map(block=><option key={block.id} value={block.id}>{block.name} · {block.trackIds.filter(id=>tracks.some(t=>t.id===id)).length} songs</option>)}
    </select>
    <p className="party-hint">Change the next theme without interrupting this song. Themes repeat when needed.</p>
    {ai.pendingTheme&&<p role="status">Next theme: {active?.name||'All music'} · after this song</p>}
    <div className="flex flex-wrap gap-2"><button className="party-secondary" disabled={busy||blocks.length>=64} onClick={()=>setEditing('')}>Create theme</button>
      {active&&<button className="party-secondary" disabled={busy} onClick={()=>setEditing(active.id)}>Edit theme</button>}
    </div>
    {editing!==null&&<ThemeEditor id={editing} onClose={()=>setEditing(null)} onSaved={id=>{usePartyBlockStore.getState().setBrowsing(id);const block=usePartyBlockStore.getState().blocks.find(block=>block.id===id);if(block?.trackIds.length)void ai.applyBlock(id);else refreshEditedTheme(id);}}/>}
    {ai.isReplanning&&<p role="status" className="party-hint">Updating the upcoming songs… Current playback continues.</p>}
  </div>;
}
