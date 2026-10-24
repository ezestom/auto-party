import { test, expect } from 'vitest';
import { selectTransitionEffect } from './transitionEffects';
const context={duration:4,bpm:120,incomingBpm:124,automatic:true,index:4,lastIndex:0,now:120,lastAt:0};
test('effect requests are allowlisted and echo requires usable tempo data',()=>{
 expect(selectTransitionEffect('run-code',context)).toBe('none');
 expect(selectTransitionEffect('echo_out',{...context,bpm:0})).toBe('none');
 expect(selectTransitionEffect('echo_out',context)).toBe('echo_out');
 expect(selectTransitionEffect('filter_sweep',{...context,duration:NaN})).toBe('none');
});
test('automatic effects stay sparse while an explicit DJ preset can override the cooldown',()=>{
 expect(selectTransitionEffect('filter_sweep',{...context,index:1})).toBe('none');
 expect(selectTransitionEffect('echo_out',{...context,now:20})).toBe('none');
 expect(selectTransitionEffect('filter_sweep',{...context,index:1,automatic:false})).toBe('filter_sweep');
});

test('an automatic filter proposal is dropped after a DJ request changes tempo compatibility',()=>{expect(selectTransitionEffect('filter_sweep',{...context,incomingBpm:94})).toBe('none');});
