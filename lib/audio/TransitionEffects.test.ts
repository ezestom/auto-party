import { test, expect, vi } from 'vitest';
import { TransitionEffects } from './TransitionEffects';
class Param {value=0;setValueAtTime=vi.fn();setTargetAtTime=vi.fn();setValueCurveAtTime=vi.fn();cancelScheduledValues=vi.fn();cancelAndHoldAtTime=vi.fn();}
class Node {gain=new Param();frequency=new Param();Q=new Param();delayTime=new Param();type='';connect=vi.fn();disconnect=vi.fn();}
function setup(){const gains:Node[]=[],delays:Node[]=[];const ctx={currentTime:5,createBiquadFilter:()=>new Node(),createGain:()=>{const n=new Node();gains.push(n);return n;},createDelay:()=>{const n=new Node();delays.push(n);return n;}};const input=new Node(),out=new Node();return{ctx,input,gains,delays,fx:new TransitionEffects(ctx as unknown as BaseAudioContext,input as unknown as AudioNode,out as unknown as AudioNode,out as unknown as AudioNode)};}
test('filter sweep is scheduled on audio time and restores a neutral filter',()=>{
 const {fx}=setup();expect(fx.start('filter_sweep',4,120)).toBe('filter_sweep');
 const param=fx.filter.frequency as unknown as Param;const [curve,start,duration]=param.setValueCurveAtTime.mock.calls[0] as unknown as [Float32Array,number,number];
 expect(curve[0]).toBe(20);expect(curve.at(-1)).toBe(900);expect(start).toBe(5);expect(duration).toBe(4);expect(param.setValueAtTime).toHaveBeenCalledWith(20,9.2);
 fx.cancel();expect(param.cancelAndHoldAtTime).toHaveBeenCalled();
});
test('echo bounds delay, send, wet and feedback, and manual cancellation releases its nodes',()=>{
 const {fx,ctx,gains,delays,input}=setup();expect(fx.start('echo_out',2,120)).toBe('echo_out');
 expect(delays[0].delayTime.setValueAtTime).toHaveBeenCalledWith(.25,5);
 expect(gains[1].gain.setValueAtTime).toHaveBeenCalledWith(.25,5);expect(gains[2].gain.setValueAtTime).toHaveBeenCalledWith(.18,5);
 fx.cancel();expect(gains[2].gain.setTargetAtTime).toHaveBeenCalledWith(0,5,.01);ctx.currentTime=6;fx.tick();expect(input.disconnect).toHaveBeenCalledWith(gains[0]);
 expect(fx.active).toBe(false);fx.dispose();
});
test('missing tempo and invalid durations cannot create an echo',()=>{
 const {fx,delays}=setup();expect(fx.start('echo_out',2,0)).toBe('none');expect(fx.start('echo_out',Infinity,120)).toBe('none');expect(delays).toHaveLength(0);
});
