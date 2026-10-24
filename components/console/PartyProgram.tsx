"use client";
import { usePartyProgramStore } from '../../stores/partyProgramStore';
import { usePartyBlockStore } from '../../stores/partyBlockStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { useAIDJStore } from '../../stores/aiDJStore';
import type { ProgramStep } from '../../lib/ai/partyProgram';

export default function PartyProgram() {
  const program=usePartyProgramStore(),{blocks}=usePartyBlockStore(),tracks=useLibraryStore(s=>s.allTracks),ai=useAIDJStore();
  const busy=['analyzing','transitioning'].includes(ai.status);
  const update=(id:string,value:Partial<ProgramStep>)=>{
    program.setSteps(program.steps.map(step=>step.id===id?{...step,...value}:step));
    if(value.blockId&&ai.isActive&&(ai.programStepId===id||ai.pendingTheme?.stepId===id))void ai.jumpToStep(id);
  };
  const move=(index:number,direction:number)=>{const steps=[...program.steps];[steps[index],steps[index+direction]]=[steps[index+direction],steps[index]];program.setSteps(steps);};
  const current=program.steps.find(step=>step.id===ai.programStepId);
  const name=blocks.find(block=>block.id===current?.blockId)?.name;
  return <section className="party-program" aria-label="Party programme">
    {program.enabled&&ai.isActive&&<p role="status" className="program-progress-text">{current?`${name||'Theme'} · ${Math.floor(ai.programElapsed/60)} / ~${current.minutes} min`:'Manual theme · programme paused'}{ai.pendingTheme?' · changing after this song':''}</p>}
    <details><summary>Party programme{program.steps.length?' · '+program.steps.length+' stages':''}</summary>
      <p className="party-hint">Set an approximate time for each theme. Songs finish naturally. The final theme keeps playing.</p>
      <label className="program-enable"><input type="checkbox" aria-label="Use party programme" checked={program.enabled} disabled={busy} onChange={event=>{
        program.setEnabled(event.target.checked);
        if(event.target.checked&&ai.isActive&&program.steps[0])void ai.jumpToStep(program.steps[0].id);
      }}/>Use party programme</label>
      <ol className="program-stages">{program.steps.map((step,index)=>{
        const block=blocks.find(block=>block.id===step.blockId),songs=tracks.filter(track=>block?.trackIds.includes(track.id));
        const minutes=Math.floor(songs.reduce((sum,track)=>sum+track.duration,0)/60);
        return <li className="program-stage" key={step.id} data-current={step.id===ai.programStepId}>
          <div className="program-stage-fields">
            <label>Theme {index+1}<select aria-label={'Theme for stage '+(index+1)} value={step.blockId} disabled={busy} onChange={event=>update(step.id,{blockId:event.target.value})}>
              {!block&&<option value={step.blockId}>Unavailable theme</option>}{blocks.map(block=><option key={block.id} value={block.id}>{block.name}</option>)}
            </select></label>
            <label>Minutes<input aria-label={'Minutes for stage '+(index+1)} type="number" min={1} max={720} defaultValue={step.minutes} disabled={busy} onBlur={event=>{
              const value=Math.min(720,Math.max(1,Number(event.target.value)||step.minutes));event.target.value=String(value);update(step.id,{minutes:value});
            }}/></label>
          </div>
          <p className="party-hint">{!songs.length?'Add songs to this theme before starting.':`${songs.length} songs · ~${minutes} min of music${minutes<step.minutes?' · repeats to fill this stage':''}`}</p>
          <div className="program-stage-actions">
            <button disabled={busy||index===0} aria-label={'Move stage '+(index+1)+' up'} onClick={()=>move(index,-1)}>↑</button>
            <button disabled={busy||index===program.steps.length-1} aria-label={'Move stage '+(index+1)+' down'} onClick={()=>move(index,1)}>↓</button>
            <button disabled={busy} aria-label={'Remove stage '+(index+1)} onClick={()=>program.setSteps(program.steps.filter(item=>item.id!==step.id))}>Remove</button>
            <button disabled={busy||!ai.isActive||!songs.length} aria-label={'Play stage '+(index+1)+' next'} onClick={()=>void ai.jumpToStep(step.id)}>Play next</button>
          </div>
        </li>;
      })}</ol>
      <button className="party-secondary" disabled={busy||!blocks.length||program.steps.length>=64} onClick={()=>program.setSteps([...program.steps,{id:crypto.randomUUID(),blockId:blocks[0].id,minutes:60}])}>Add stage</button>
      {!blocks.length&&<p className="party-hint">Create a theme in Media library or above to build your programme.</p>}
      {program.enabled&&!program.steps.length&&<p role="alert">Add at least one stage before starting.</p>}
    </details>
  </section>;
}
