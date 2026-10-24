import { describe, expect, it } from "vitest";
import { playbackTime } from "./playbackClock";

describe("VJ playback clock", () => {
  it("accounts for delivery time while playing and wraps looping videos", () => {
    expect(playbackTime({ time: 9.8, sentAt: 1000, playing: true }, 10, 1400)).toBeCloseTo(0.2);
  });
  it("keeps a paused frame fixed", () => {
    expect(playbackTime({ time: 4, sentAt: 1000, playing: false }, 10, 6000)).toBe(4);
  });
  it("ignores invalid clocks and clamps a future timestamp", () => {
    expect(playbackTime({ time: NaN, sentAt: 1000, playing: true }, 10, 1400)).toBeNull();
    expect(playbackTime({ time: 2, sentAt: 2000, playing: true }, 10, 1000)).toBe(2);
  });
});
