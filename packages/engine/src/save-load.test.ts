import { describe, expect, it } from "vitest";
import { GAME_STATE_VERSION, GameState } from "./game-state.js";
import {
  DEFAULT_SAVE_KEY,
  MemoryStorage,
  clearSavedGameState,
  deserializeGameState,
  loadGameState,
  saveGameState,
  serializeGameState,
} from "./save-load.js";

function makeState() {
  const state = new GameState({ currentRoomId: "study" });
  state.setFlag("met-butler");
  state.setFlag("desk-unlocked");
  state.addItem("brass-key");
  state.addItem("candle");
  return state;
}

describe("serializeGameState / deserializeGameState", () => {
  it("round-trips a GameState exactly", () => {
    const state = makeState();
    const restored = deserializeGameState(serializeGameState(state));
    expect(restored.toJSON()).toEqual(state.toJSON());
  });

  it("rejects save data from an incompatible version", () => {
    const json = JSON.stringify({
      version: GAME_STATE_VERSION + 1,
      currentRoomId: "study",
      flags: [],
      inventory: [],
    });
    expect(() => deserializeGameState(json)).toThrow(/version/);
  });
});

describe("saveGameState / loadGameState / clearSavedGameState", () => {
  it("saves to and loads from storage, restoring state exactly", () => {
    const storage = new MemoryStorage();
    const state = makeState();

    saveGameState(storage, state);
    const loaded = loadGameState(storage);

    expect(loaded?.toJSON()).toEqual(state.toJSON());
  });

  it("returns undefined when nothing has been saved", () => {
    const storage = new MemoryStorage();
    expect(loadGameState(storage)).toBeUndefined();
  });

  it("supports a custom key, independent of the default", () => {
    const storage = new MemoryStorage();
    const state = makeState();

    saveGameState(storage, state, "slot-2");

    expect(loadGameState(storage)).toBeUndefined();
    expect(loadGameState(storage, "slot-2")?.toJSON()).toEqual(state.toJSON());
  });

  it("clears a saved state", () => {
    const storage = new MemoryStorage();
    saveGameState(storage, makeState());

    clearSavedGameState(storage);

    expect(loadGameState(storage)).toBeUndefined();
    expect(storage.getItem(DEFAULT_SAVE_KEY)).toBeNull();
  });
});
