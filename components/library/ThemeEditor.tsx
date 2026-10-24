"use client";
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { usePartyBlockStore } from '../../stores/partyBlockStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { useAIDJStore } from '../../stores/aiDJStore';

export default function ThemeEditor({id,onClose,onSaved}:{id:string;onClose:()=>void;onSaved:(id:string)=>void}) {
  const existing=usePartyBlockStore.getState().blocks.find(block=>block.id===id);
  const [name,setName]=useState(existing?.name||''),[selected,setSelected]=useState(existing?.trackIds||[]);
  const tracks=useLibraryStore(s=>s.allTracks);
  return <Dialog.Root open onOpenChange={open=>{if(!open)onClose();}}><Dialog.Portal>
    <Dialog.Overlay className="theme-editor-overlay"/>
    <Dialog.Content className="theme-editor-dialog">
      <Dialog.Title>{existing?'Edit theme':'New theme'}</Dialog.Title>
      <Dialog.Description>Name your theme. Add existing songs now, or import files into its tab later.</Dialog.Description>
      <form onSubmit={event=>{
        event.preventDefault(); const themeId=id||crypto.randomUUID();
        usePartyBlockStore.getState().saveBlock({id:themeId,name:name.trim(),trackIds:selected});
        onSaved(themeId); onClose();
      }}>
        <label>Theme name<input autoFocus required maxLength={60} value={name} placeholder="Cumbia, Rock, Slow songs…" onChange={event=>setName(event.target.value)}/></label>
        <fieldset><legend>Existing songs · {selected.length} selected</legend>
          <div className="party-block-tracks">{tracks.map(track=><label key={track.id}><input type="checkbox" checked={selected.includes(track.id)} onChange={event=>setSelected(ids=>event.target.checked?[...ids,track.id]:ids.filter(id=>id!==track.id))}/><span>{track.title}</span></label>)}</div>
          {!tracks.length&&<p>Save your theme, then use Import files to add music.</p>}
        </fieldset>
        <div className="theme-editor-actions">
          <button type="submit" disabled={!name.trim()}>Save theme</button>
          <Dialog.Close type="button">Cancel</Dialog.Close>
          {existing&&<button type="button" onClick={()=>{usePartyBlockStore.getState().removeBlock(id);onClose();}}>Delete theme</button>}
        </div>
      </form>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}

export function refreshEditedTheme(id:string) {
  const ai=useAIDJStore.getState(), blocks=usePartyBlockStore.getState();
  if(ai.isActive && (blocks.activeId===id || ai.pendingTheme?.blockId===id)) {
    const block=blocks.blocks.find(block=>block.id===id);
    if(!block?.trackIds.length) {
      ai.suspend(); useAIDJStore.setState({errorMessage:'This theme is empty. Current playback continues; choose another theme.'});
    } else void ai.applyBlock(id);
  }
}
