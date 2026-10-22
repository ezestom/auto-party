import {test,expect} from 'vitest';
import {estimateTempo} from './tempo';
function pulse(bpm:number,volume:number){const rate=8000;const data=new Float32Array(rate*24);for(let beat=.4;beat<24;beat+=60/bpm)for(let i=0;i<rate*.05;i++){const n=Math.round(beat*rate)+i;if(n<data.length)data[n]=volume*Math.exp(-i/(rate*.012))*Math.sin(i*2*Math.PI*180/rate);}return data;}
test.each([75,90,120,140,180])('estimates repeated onsets at %s BPM',bpm=>{const result=estimateTempo(pulse(bpm,.8),8000);expect(Math.abs(result.bpm-bpm)).toBeLessThanOrEqual(2);expect(result.confidence).toBeGreaterThan(.3);});
test('quiet and loud recordings have comparable tempo',()=>{expect(estimateTempo(pulse(120,.02),8000).bpm).toBe(estimateTempo(pulse(120,.9),8000).bpm);});
test('silence and sustained tone do not invent tempo',()=>{expect(estimateTempo(new Float32Array(8000*10),8000).bpm).toBe(0);const tone=Float32Array.from({length:8000*10},(_,i)=>.8*Math.sin(i*2*Math.PI*220/8000));expect(estimateTempo(tone,8000).bpm).toBe(0);});
