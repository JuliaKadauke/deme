import { describe, expect, it } from "vitest";
import { GameState } from "./game-state.js";
import { runInteractionScript, type ScriptActions } from "./script-runtime.js";

function makeActions(): ScriptActions & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  return {
    calls,
    giveItem: (itemId) => calls.push(["giveItem", itemId]),
    removeItem: (itemId) => calls.push(["removeItem", itemId]),
    changeRoom: (roomId) => calls.push(["changeRoom", roomId]),
    describe: (text) => calls.push(["describe", text]),
  };
}

describe("runInteractionScript", () => {
  it("reads flags/inventory/room and mutates state through the whitelisted API", async () => {
    const state = new GameState({ currentRoomId: "study", flags: ["desk-unlocked"] });
    const actions = makeActions();

    await runInteractionScript(
      `
      if hasFlag("desk-unlocked") then
        setFlag("desk-opened")
        describe("The desk swings open.")
      end
      describe(currentRoomId())
      `,
      state,
      actions,
    );

    expect(state.hasFlag("desk-opened")).toBe(true);
    expect(actions.calls).toEqual([
      ["describe", "The desk swings open."],
      ["describe", "study"],
    ]);
  });

  it("runs a combination-lock puzzle script end to end: hasItem gate + giveItem + describe", async () => {
    const state = new GameState({ currentRoomId: "study", inventory: ["brass-key"] });
    const actions = makeActions();

    await runInteractionScript(
      `
      if hasItem("brass-key") then
        giveItem("unlocked-safe-contents")
        setFlag("safe-open")
        describe("The lock clicks open.")
      else
        describe("It's locked. You need a key.")
      end
      `,
      state,
      actions,
    );

    expect(state.hasFlag("safe-open")).toBe(true);
    expect(actions.calls).toEqual([
      ["giveItem", "unlocked-safe-contents"],
      ["describe", "The lock clicks open."],
    ]);
  });

  it("leaves state untouched when the puzzle condition is not met", async () => {
    const state = new GameState({ currentRoomId: "study" });
    const actions = makeActions();

    await runInteractionScript(
      `
      if hasItem("brass-key") then
        setFlag("safe-open")
      else
        describe("It's locked. You need a key.")
      end
      `,
      state,
      actions,
    );

    expect(state.hasFlag("safe-open")).toBe(false);
    expect(actions.calls).toEqual([["describe", "It's locked. You need a key."]]);
  });

  it("wires removeItem, clearFlag, and gotoRoom", async () => {
    const state = new GameState({ currentRoomId: "study", flags: ["lit"], inventory: ["candle"] });
    const actions = makeActions();

    await runInteractionScript(
      `
      removeItem("candle")
      clearFlag("lit")
      gotoRoom("hallway")
      `,
      state,
      actions,
    );

    expect(actions.calls).toEqual([
      ["removeItem", "candle"],
      ["changeRoom", "hallway"],
    ]);
  });

  it("rejects non-string ids with a catchable error instead of misbehaving silently", async () => {
    const state = new GameState({ currentRoomId: "study" });
    const actions = makeActions();

    await expect(runInteractionScript("setFlag(42)", state, actions)).rejects.toThrow(
      /expected a non-empty string id/,
    );
  });
});
