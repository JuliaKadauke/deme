import { describe, expect, it } from "vitest";
import { GAME_STATE_VERSION, GameState } from "./game-state.js";

describe("GameState", () => {
  it("starts with the given room, no flags, and no inventory by default", () => {
    const state = new GameState({ currentRoomId: "study" });
    expect(state.currentRoomId).toBe("study");
    expect(state.flags).toEqual([]);
    expect(state.inventory).toEqual([]);
  });

  it("sets, checks, and clears flags", () => {
    const state = new GameState({ currentRoomId: "study" });
    expect(state.hasFlag("desk-unlocked")).toBe(false);

    state.setFlag("desk-unlocked");
    expect(state.hasFlag("desk-unlocked")).toBe(true);

    state.clearFlag("desk-unlocked");
    expect(state.hasFlag("desk-unlocked")).toBe(false);
  });

  it("adds, checks, and removes inventory items without duplicates", () => {
    const state = new GameState({ currentRoomId: "study" });
    state.addItem("brass-key");
    state.addItem("brass-key");
    expect(state.inventory).toEqual(["brass-key"]);
    expect(state.hasItem("brass-key")).toBe(true);

    state.removeItem("brass-key");
    expect(state.inventory).toEqual([]);
    expect(state.hasItem("brass-key")).toBe(false);
  });

  it("preserves inventory pickup order", () => {
    const state = new GameState({ currentRoomId: "study" });
    state.addItem("brass-key");
    state.addItem("candle");
    expect(state.inventory).toEqual(["brass-key", "candle"]);
  });

  it("serializes to JSON with sorted flags and round-trips exactly via fromJSON", () => {
    const state = new GameState({ currentRoomId: "study" });
    state.setFlag("met-butler");
    state.setFlag("desk-unlocked");
    state.addItem("brass-key");

    const json = state.toJSON();
    expect(json).toEqual({
      version: GAME_STATE_VERSION,
      currentRoomId: "study",
      flags: ["desk-unlocked", "met-butler"],
      inventory: ["brass-key"],
    });

    const restored = GameState.fromJSON(json);
    expect(restored.toJSON()).toEqual(json);
  });

  it("dedupes inventory ids passed via the constructor", () => {
    const state = new GameState({
      currentRoomId: "study",
      inventory: ["brass-key", "brass-key"],
    });
    expect(state.inventory).toEqual(["brass-key"]);
  });
});
