import { expect, test } from 'vitest';
import { cycleTracks, nextProgramStep, parseProgram } from './partyProgram';

test('programme parsing validates durations and preserves intentional repeated themes', () => {
  expect(parseProgram([{id:'1',blockId:'cumbia',minutes:60},{id:'2',blockId:'cumbia',minutes:120},{id:'bad',blockId:'x',minutes:0},null]))
    .toEqual([{id:'1',blockId:'cumbia',minutes:60},{id:'2',blockId:'cumbia',minutes:120}]);
});
test('advance at the natural ending, skip unavailable themes and keep the last stage', () => {
  const steps=[{id:'1',blockId:'cumbia',minutes:60},{id:'2',blockId:'empty',minutes:30},{id:'3',blockId:'rock',minutes:60}];
  expect(nextProgramStep(steps,'1',3599,()=>true)).toBeNull();
  expect(nextProgramStep(steps,'1',3601,id=>id!=='empty')).toEqual(steps[2]);
  expect(nextProgramStep(steps,'3',9999,()=>true)).toBeNull();
});
test('cycles prefer unheard songs and avoid an immediate repeat unless only one exists', () => {
  const tracks=[{id:'a'},{id:'b'},{id:'c'}];
  expect(cycleTracks(tracks,['a','b'],'b')).toEqual([{id:'c'}]);
  expect(cycleTracks(tracks,['a','b','c'],'b')).toEqual([{id:'a'},{id:'c'}]);
  expect(cycleTracks([{id:'a'}],['a'],'a')).toEqual([{id:'a'}]);
});
