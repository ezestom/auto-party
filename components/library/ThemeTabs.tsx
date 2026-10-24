"use client";
import { useState } from 'react';
import { usePartyBlockStore } from '../../stores/partyBlockStore';
import { useAIDJStore } from '../../stores/aiDJStore';
import ThemeEditor, {refreshEditedTheme} from './ThemeEditor';

export default function ThemeTabs() {
  const {blocks,browsingId,setBrowsing}=usePartyBlockStore(), ai=useAIDJStore();
  const [editing,setEditing]=useState<string|null>(null);
  const theme=blocks.find(block=>block.id===browsingId);
  const playing=blocks.find(block=>block.id===usePartyBlockStore.getState().activeId);
  const pending=blocks.find(block=>block.id===ai.pendingTheme?.blockId);
  const busy=['analyzing','transitioning'].includes(ai.status);
  return <div className="theme-tabs-shell">
    <div className="theme-tab-strip" role="tablist" aria-label="Music themes" onKeyDown={event=>{
      const tabs=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]'));
      const index=tabs.indexOf(document.activeElement as HTMLButtonElement);
      const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:-1;
      if(next>=0){event.preventDefault();tabs[next].click();tabs[next].focus();tabs[next].scrollIntoView({block:'nearest',inline:'nearest'});}
    }}>
      {[{id:'',name:'All music'},...blocks].map(block=><button key={block.id} id={'theme-tab-'+(block.id||'all')} role="tab" aria-selected={block.id===browsingId} aria-controls="theme-song-list" tabIndex={block.id===browsingId?0:-1} onClick={()=>setBrowsing(block.id)}>{block.name}</button>)}
    </div>
    <div className="theme-tab-actions">
      <button onClick={()=>setEditing('')} disabled={blocks.length>=64}>New theme</button>
      {theme&&<><button onClick={()=>setEditing(theme.id)}>Edit theme</button><button disabled={busy||!theme.trackIds.length} onClick={()=>void ai.applyBlock(theme.id)}>Play this theme next</button></>}
      <span>{theme?'Import destination: '+theme.name:'Import destination: All music'}</span>
    </div>
    {ai.isActive&&<p role="status" className="theme-playback-status">Playing: {playing?.name||'All music'}{pending?' · Next theme: '+pending.name+' · after this song':''}</p>}
    {editing!==null&&<ThemeEditor id={editing} onClose={()=>setEditing(null)} onSaved={id=>{setBrowsing(id);refreshEditedTheme(id);}}/>}
  </div>;
}
