export interface PlaybackClock { time?: number; sentAt?: number; playing?: boolean }

export function playbackTime(clock: PlaybackClock, duration: number, now = Date.now()): number | null {
  if (!Number.isFinite(clock.time) || clock.time! < 0 || !Number.isFinite(clock.sentAt)) return null;
  const time = clock.time! + (clock.playing ? Math.max(0, now - clock.sentAt!) / 1000 : 0);
  return Number.isFinite(duration) && duration > 0 ? time % duration : time;
}
