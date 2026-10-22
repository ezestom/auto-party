import { expect, test } from "vitest";
import { parseTracks, parsePlan, localPlan } from "./contract";

const tracks = [
  { id: "a", title: "One", artist: "User", bpm: 120, key: "8A", duration: 180 },
  { id: "b", title: "Two", artist: "User", bpm: 124, key: "—", duration: 200 },
];
test("accepts bounded metadata and strips audio and arbitrary fields", () => {
  expect(parseTracks([{ ...tracks[0], audioData: "private" }, tracks[1]])).toEqual(tracks);
});
test("rejects duplicates, unbounded strings, invalid numbers and excessive libraries", () => {
  for (const input of [[tracks[0]], [tracks[0], tracks[0]], [{ ...tracks[0], duration: -1 }, tracks[1]],
    [{ ...tracks[0], title: "x".repeat(201) }, tracks[1]], [{ ...tracks[0], bpm: NaN }, tracks[1]], Array(201).fill(tracks[0])]) {
    expect(() => parseTracks(input)).toThrow();
  }
});
test("normalizes remote plans to known tracks, implemented transitions and safe timing", () => {
  const plan = parsePlan({ setlist: [{ trackId: "b", mixPoint: 200, transitionStyle: "cut" }], djComment: "Fiesta" }, tracks);
  expect(plan.setlist.map(item => item.trackId)).toEqual(["b", "a"]);
  expect(plan.setlist[0].mixPoint).toBe(64);
  expect(plan.setlist[0].transitionStyle).toBe("cut");
});
test("rejects malformed output, unknown songs and unsupported echo effects", () => {
  for (const setlist of [[], [{ trackId: "foreign", mixPoint: 24, transitionStyle: "smooth" }],
    [{ trackId: "a", mixPoint: "24", transitionStyle: "smooth" }], [{ trackId: "a", mixPoint: 24, transitionStyle: "echo" }]]) {
    expect(() => parsePlan({ setlist, djComment: "test" }, tracks)).toThrow();
  }
});
test("local fallback is explicit and never mutates the library", () => {
  const result = localPlan([...tracks].reverse(), "PROVIDER_AUTH");
  expect(result.source).toBe("local");
  expect(result.reason).toBe("PROVIDER_AUTH");
  expect(result.setlist.map(item => item.trackId)).toEqual(["a", "b"]);
});
