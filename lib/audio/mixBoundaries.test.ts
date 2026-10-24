import { test, expect } from 'vitest';
import { detectMixBoundaries, naturalTransition } from './mixBoundaries';
function buffer(channels: Float32Array[]) { return { duration: channels[0].length / 100, sampleRate: 100, length: channels[0].length, numberOfChannels: channels.length, getChannelData: (i: number) => channels[i] }; }
test('edge silence detection checks both channels and preserves quiet endings', () => {
 const left=new Float32Array(2000), right=new Float32Array(2000); right.fill(0.1,200,1600); right.fill(0.004,1600,1800);
 expect(detectMixBoundaries(buffer([left,right]))).toEqual({audioStart:1.9,audioEnd:18.1});
});
test('silence-only and short edge gaps do not invent musical cue points', () => {
 expect(detectMixBoundaries(buffer([new Float32Array(1000)]))).toEqual({audioStart:0,audioEnd:10});
 const samples=new Float32Array(1000).fill(.2); samples.fill(0,0,30);
 expect(detectMixBoundaries(buffer([samples])).audioStart).toBe(0);
});
test('natural transitions stay near the audible ending with conservative tempo changes', () => {
 expect(naturalTransition({duration:180,bpm:120,audioEnd:175},{bpm:124},8)).toEqual({end:175,duration:8,startsAt:167});
 expect(naturalTransition({duration:180,bpm:118},{bpm:94},8)).toEqual({end:180,duration:2,startsAt:178});
 expect(naturalTransition({duration:10,bpm:0},{bpm:0},8).duration).toBe(2);
});
