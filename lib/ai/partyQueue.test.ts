import { test, expect } from 'vitest';
import { requestTrack } from './partyQueue';
const item = (trackId: string) => ({ trackId, mixPoint: 4, transitionStyle: 'smooth' as const });
test('play next moves an upcoming track without disturbing history or duplicating it', () => {
  expect(requestTrack(['a','b','c','d'].map(item), 1, item('d'), true).map(x=>x.trackId)).toEqual(['a','b','d','c']);
});
test('queue can append a played request once, while the currently playing song is protected', () => {
  const queue=['a','b','c'].map(item);
  expect(requestTrack(queue, 1, item('a'), false).map(x=>x.trackId)).toEqual(['a','b','c','a']);
  expect(requestTrack(queue, 1, item('b'), true)).toBe(queue);
});
