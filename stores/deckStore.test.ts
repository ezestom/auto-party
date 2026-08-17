import { describe, test, expect, beforeEach } from "vitest";
import { useDeckStore } from "./deckStore";

describe("deckStore unit tests", () => {
  beforeEach(() => {
    useDeckStore.getState().resetDeck("A");
    useDeckStore.getState().resetDeck("B");
  });

  test("should initialize decks with default values", () => {
    const state = useDeckStore.getState().decks;
    expect(state.A.isPlaying).toBe(false);
    expect(state.A.progress).toBe(0);
    expect(state.B.isPlaying).toBe(false);
    expect(state.B.key).toBe("6B");
  });

  test("should toggle play state", () => {
    expect(useDeckStore.getState().decks.A.isPlaying).toBe(false);
    useDeckStore.getState().setPlaying("A", true);
    expect(useDeckStore.getState().decks.A.isPlaying).toBe(true);
  });

  test("should update tempo offset and bpm", () => {
    const deckA = useDeckStore.getState().decks.A;
    expect(deckA.tempoOffset).toBe(0);
    expect(deckA.bpm).toBe(120);

    useDeckStore.getState().setTempoOffset("A", 0.1);
    const updatedDeckA = useDeckStore.getState().decks.A;
    expect(updatedDeckA.tempoOffset).toBe(0.1);
    expect(updatedDeckA.bpm).toBe(132); // 120 * 1.1
  });

  test("should load track and reset values", () => {
    const mockTrack = {
      id: "t_test",
      title: "Test Track",
      artist: "Test Artist",
      bpm: 125,
      key: "8A",
      duration: 180,
      color: "#ff0000",
    };

    useDeckStore.getState().setPlaying("A", true);
    useDeckStore.getState().setTrack("A", mockTrack);

    const deckA = useDeckStore.getState().decks.A;
    expect(deckA.track).toEqual(mockTrack);
    expect(deckA.isPlaying).toBe(false); // loads paused
    expect(deckA.baseBpm).toBe(125);
    expect(deckA.progress).toBe(0);
  });
});
