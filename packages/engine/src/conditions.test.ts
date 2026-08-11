import { describe, expect, it } from "vitest";
import { applyEffects, evaluateCondition } from "./conditions.js";
import { GameState } from "./game-state.js";

describe("evaluateCondition", () => {
  it("holds when no condition is given", () => {
    const state = new GameState({ currentRoomId: "study" });
    expect(evaluateCondition(undefined, state)).toBe(true);
  });

  it("requires all requiredFlags to be set", () => {
    const state = new GameState({ currentRoomId: "study" });
    expect(evaluateCondition({ requiredFlags: ["met-butler"] }, state)).toBe(false);
    state.setFlag("met-butler");
    expect(evaluateCondition({ requiredFlags: ["met-butler"] }, state)).toBe(true);
  });

  it("requires none of forbiddenFlags to be set", () => {
    const state = new GameState({ currentRoomId: "study" });
    expect(evaluateCondition({ forbiddenFlags: ["desk-unlocked"] }, state)).toBe(true);
    state.setFlag("desk-unlocked");
    expect(evaluateCondition({ forbiddenFlags: ["desk-unlocked"] }, state)).toBe(false);
  });

  it("requires all requiredItemIds to be in inventory", () => {
    const state = new GameState({ currentRoomId: "study" });
    expect(evaluateCondition({ requiredItemIds: ["brass-key"] }, state)).toBe(false);
    state.addItem("brass-key");
    expect(evaluateCondition({ requiredItemIds: ["brass-key"] }, state)).toBe(true);
  });

  it("combines all three clauses with AND", () => {
    const state = new GameState({ currentRoomId: "study" });
    state.setFlag("met-butler");
    state.addItem("brass-key");
    const condition = {
      requiredFlags: ["met-butler"],
      forbiddenFlags: ["desk-unlocked"],
      requiredItemIds: ["brass-key"],
    };
    expect(evaluateCondition(condition, state)).toBe(true);

    state.setFlag("desk-unlocked");
    expect(evaluateCondition(condition, state)).toBe(false);
  });
});

describe("applyEffects", () => {
  it("is a no-op when no effects are given", () => {
    const state = new GameState({ currentRoomId: "study" });
    applyEffects(undefined, state);
    expect(state.flags).toEqual([]);
  });

  it("sets and clears flags", () => {
    const state = new GameState({ currentRoomId: "study" });
    state.setFlag("stale-flag");

    applyEffects({ setFlags: ["desk-unlocked"], clearFlags: ["stale-flag"] }, state);

    expect(state.hasFlag("desk-unlocked")).toBe(true);
    expect(state.hasFlag("stale-flag")).toBe(false);
  });
});
