import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import type { TransitionEffects } from '../lib/audio/TransitionEffects';
declare global { interface Window { TestTransitionEffects: typeof TransitionEffects } }
const compile=(path:string)=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;$/gm,'').replace(/\bexport /g,'');
async function install(page:import('@playwright/test').Page) {
 await page.goto('/');
 await page.addScriptTag({content:compile('lib/ai/transitionEffects.ts')+'\n'+compile('lib/audio/TransitionEffects.ts')+'\nwindow.TestTransitionEffects=TransitionEffects;'});
}
test('real audio echo produces stereo decaying repeats and a bounded tail',async({page})=>{
 await install(page);
 const result=await page.evaluate(async()=>{
  const rate=24000,ctx=new OfflineAudioContext(2,rate*4,rate),input=ctx.createGain(),out=ctx.createGain();out.connect(ctx.destination);
  const fx=new window.TestTransitionEffects(ctx,input,out,out),source=ctx.createBufferSource(),buffer=ctx.createBuffer(2,rate,rate);
  buffer.getChannelData(0)[2400]=.5;buffer.getChannelData(1)[2400]=.25;source.buffer=buffer;source.connect(input);
  fx.start('echo_out',2,120);source.start();const rendered=await ctx.startRendering();
  const peak=(channel:number,start:number,end:number)=>Math.max(...Array.from(rendered.getChannelData(channel).slice(Math.floor(start*rate),Math.floor(end*rate)),Math.abs));
  return {dry:peak(0,.09,.12),first:peak(0,.34,.38),second:peak(0,.59,.65),right:peak(1,.34,.38),tail:peak(0,3.5,3.9)};
 });
 expect(result.first).toBeGreaterThan(.005);expect(result.first).toBeLessThan(result.dry*.2);
 expect(result.second).toBeGreaterThan(.0001);expect(result.second).toBeLessThan(result.first*.5);
 expect(result.first/result.right).toBeCloseTo(2,1);expect(result.tail).toBeLessThan(.000001);
});
test('real filter sweep removes lows then returns to neutral without stopping audio',async({page})=>{
 await install(page);const result=await page.evaluate(async()=>{
  const rate=24000,ctx=new OfflineAudioContext(1,rate*1.5,rate),input=ctx.createGain(),out=ctx.createGain();out.connect(ctx.destination);
  const fx=new window.TestTransitionEffects(ctx,input,out,out),source=ctx.createOscillator();source.frequency.value=100;input.gain.value=.1;source.connect(input);
  fx.start('filter_sweep',1,120);source.start();const data=(await ctx.startRendering()).getChannelData(0);
  const rms=(start:number,end:number)=>{let sum=0;const a=Math.floor(start*rate),b=Math.floor(end*rate);for(let i=a;i<b;i++)sum+=data[i]*data[i];return Math.sqrt(sum/(b-a));};
  return {initial:rms(.05,.15),filtered:rms(.75,.85),restored:rms(1.3,1.4)};
 });
 expect(result.filtered).toBeLessThan(result.initial*.3);expect(result.restored).toBeGreaterThan(result.initial*.8);
});
test('manual cancellation silences the echo feedback tail on the audio clock',async({page})=>{
 await install(page);const peak=await page.evaluate(async()=>{
  const rate=24000,ctx=new OfflineAudioContext(1,rate*2,rate),input=ctx.createGain(),out=ctx.createGain();out.connect(ctx.destination);
  const fx=new window.TestTransitionEffects(ctx,input,out,out),source=ctx.createBufferSource(),buffer=ctx.createBuffer(1,rate,rate);buffer.getChannelData(0)[2400]=.5;source.buffer=buffer;source.connect(input);
  fx.start('echo_out',2,120);source.start();const pause=ctx.suspend(.5),render=ctx.startRendering();await pause;fx.cancel();await ctx.resume();
  const audio=(await render).getChannelData(0);return Math.max(...Array.from(audio.slice(Math.floor(.8*rate)),Math.abs));
 });expect(peak).toBeLessThan(.000001);
});
