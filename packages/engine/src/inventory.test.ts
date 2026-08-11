import { describe, expect, it } from "vitest";
import { GameState } from "./game-state.js";
import { Inventory } from "./inventory.js";

function makeInventory() {
  const state = new GameState({ currentRoomId: "study" });
  const inventory = new Inventory(state);
  return { state, inventory };
}

describe("Inventory", () => {
  it("starts empty with nothing selected", () => {
    const { inventory } = makeInventory();
    expect(inventory.itemIds).toEqual([]);
    expect(inventory.selectedItemId).toBeUndefined();
  });

  it("adds an item, updating both the inventory and the backing GameState", () => {
    const { inventory, state } = makeInventory();
    const added: unknown[] = [];
    inventory.events.on("item-added", (e) => added.push(e));

    inventory.add("brass-key");

    expect(inventory.itemIds).toEqual(["brass-key"]);
    expect(state.hasItem("brass-key")).toBe(true);
    expect(added).toEqual([{ itemId: "brass-key" }]);
  });

  it("does not fire item-added twice for the same item", () => {
    const { inventory } = makeInventory();
    const added: unknown[] = [];
    inventory.events.on("item-added", (e) => added.push(e));

    inventory.add("brass-key");
    inventory.add("brass-key");

    expect(added).toHaveLength(1);
  });

  it("removes a carried item and clears its selection if selected", () => {
    const { inventory } = makeInventory();
    inventory.add("brass-key");
    inventory.select("brass-key");

    const removed: unknown[] = [];
    const deselected: unknown[] = [];
    inventory.events.on("item-removed", (e) => removed.push(e));
    inventory.events.on("item-deselected", (e) => deselected.push(e));

    inventory.remove("brass-key");

    expect(inventory.itemIds).toEqual([]);
    expect(inventory.selectedItemId).toBeUndefined();
    expect(removed).toEqual([{ itemId: "brass-key" }]);
    expect(deselected).toEqual([{ itemId: "brass-key" }]);
  });

  it("does not select an item that isn't carried", () => {
    const { inventory } = makeInventory();
    const selected: unknown[] = [];
    inventory.events.on("item-selected", (e) => selected.push(e));

    inventory.select("brass-key");

    expect(inventory.selectedItemId).toBeUndefined();
    expect(selected).toEqual([]);
  });

  it("selects and deselects a carried item", () => {
    const { inventory } = makeInventory();
    inventory.add("brass-key");

    const selected: unknown[] = [];
    const deselected: unknown[] = [];
    inventory.events.on("item-selected", (e) => selected.push(e));
    inventory.events.on("item-deselected", (e) => deselected.push(e));

    inventory.select("brass-key");
    expect(inventory.selectedItemId).toBe("brass-key");
    expect(selected).toEqual([{ itemId: "brass-key" }]);

    inventory.deselect();
    expect(inventory.selectedItemId).toBeUndefined();
    expect(deselected).toEqual([{ itemId: "brass-key" }]);
  });

  it("useSelectedOn returns undefined and fires nothing when no item is selected", () => {
    const { inventory } = makeInventory();
    const requested: unknown[] = [];
    inventory.events.on("item-use-requested", (e) => requested.push(e));

    const result = inventory.useSelectedOn({ itemId: "brass-key", kind: "item" });

    expect(result).toBeUndefined();
    expect(requested).toEqual([]);
  });

  it("useSelectedOn applies the selection to a target, clears it, and fires item-use-requested", () => {
    const { inventory } = makeInventory();
    inventory.add("brass-key");
    inventory.select("brass-key");

    const requested: unknown[] = [];
    inventory.events.on("item-use-requested", (e) => requested.push(e));

    const target = { kind: "item" as const, itemId: "candle" };
    const result = inventory.useSelectedOn(target);

    expect(result).toEqual({ itemId: "brass-key", target });
    expect(inventory.selectedItemId).toBeUndefined();
    expect(requested).toEqual([{ itemId: "brass-key", target }]);
  });
});
