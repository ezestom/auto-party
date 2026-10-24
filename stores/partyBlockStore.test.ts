import { test, expect } from 'vitest';
import { parseBlocks, usePartyBlockStore } from './partyBlockStore';
test('saved musical blocks reject malformed data and deduplicate membership',()=>{
 expect(parseBlocks([{id:'cumbia',name:' Cumbia ',trackIds:['one','one',3]},null])).toEqual([{id:'cumbia',name:'Cumbia',trackIds:['one']}]);
});
test('deleting the selected block releases its filter',()=>{
 const store=usePartyBlockStore.getState(); store.saveBlock({id:'cumbia',name:'Cumbia',trackIds:['one']}); store.setActive('cumbia'); store.removeBlock('cumbia');
 expect(usePartyBlockStore.getState().activeId).toBe('');
});

test('browsing and importing do not change the playing theme or resurrect a deleted tab',()=>{
 const store=usePartyBlockStore.getState();
 store.saveBlock({id:'c',name:'Cumbia',trackIds:['one']});store.saveBlock({id:'r',name:'Rock',trackIds:[]});
 store.setActive('c');store.setBrowsing('r');store.addTracks('r',['two','two']);
 expect(usePartyBlockStore.getState().activeId).toBe('c');
 expect(usePartyBlockStore.getState().blocks.find(block=>block.id==='r')?.trackIds).toEqual(['two']);
 expect(usePartyBlockStore.getState().blocks.map(block=>block.id)).toEqual(['c','r']);
 store.removeBlock('r');store.addTracks('r',['three']);
 expect(usePartyBlockStore.getState().blocks.some(block=>block.id==='r')).toBe(false);
});
