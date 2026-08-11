import type { Item } from "@deme/content-schema";
import type { FederatedPointerEvent } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { InventoryBar } from "./inventory-bar.js";

const brassKey: Item = { id: "brass-key", type: "item", name: "Brass Key" };
const candle: Item = { id: "candle", type: "item", name: "Candle" };

describe("InventoryBar", () => {
  it("renders one slot per item, laid out left to right", () => {
    const bar = new InventoryBar({ slotSize: 50, gap: 10 });
    bar.setItems([brassKey, candle]);

    expect(bar.container.children).toHaveLength(2);
    expect(bar.slot("brass-key")?.label).toBe("item:brass-key");
    expect(bar.slot("brass-key")?.x).toBe(0);
    expect(bar.slot("candle")?.x).toBe(60);
  });

  it("re-renders cleanly when called again with a different item set", () => {
    const bar = new InventoryBar();
    bar.setItems([brassKey]);
    bar.setItems([candle]);

    expect(bar.container.children).toHaveLength(1);
    expect(bar.slot("brass-key")).toBeUndefined();
    expect(bar.slot("candle")).toBeDefined();
  });

  it("calls onSelect with the item id when its slot is tapped", () => {
    const onSelect = vi.fn();
    const bar = new InventoryBar({ onSelect });
    bar.setItems([brassKey, candle]);

    bar.slot("candle")?.emit("pointertap", {} as FederatedPointerEvent);

    expect(onSelect).toHaveBeenCalledWith("candle");
  });
});
