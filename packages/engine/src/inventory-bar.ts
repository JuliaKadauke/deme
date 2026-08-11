import type { EntityId, Item } from "@deme/content-schema";
import { Container, Graphics, Text } from "pixi.js";

export interface InventoryBarOptions {
  slotSize?: number;
  gap?: number;
  /** Called when a slot is clicked/tapped, with the item's id. */
  onSelect?: (itemId: EntityId) => void;
}

const DEFAULT_SLOT_SIZE = 48;
const DEFAULT_GAP = 8;
const SLOT_COLOR = 0x333333;
const SELECTED_SLOT_COLOR = 0xffcc00;

/**
 * Placeholder Pixi UI for the inventory bar: one square per carried item,
 * labeled with the item's name, highlighted when selected. No art pipeline
 * yet (see RoomScene's hotspot debug overlay for the same tradeoff), so
 * items render as plain colored squares — swap in real icons via
 * `Item.icon` once assets land. Pure scene-graph construction plus a
 * per-slot click callback — no game state — so it's testable without a
 * renderer/canvas and reusable regardless of who drives selection into it.
 */
export class InventoryBar {
  readonly container = new Container();

  private readonly slotsByItemId = new Map<EntityId, Container>();
  private readonly slotSize: number;
  private readonly gap: number;
  private readonly onSelect: ((itemId: EntityId) => void) | undefined;

  constructor(options: InventoryBarOptions = {}) {
    this.container.label = "inventory-bar";
    this.slotSize = options.slotSize ?? DEFAULT_SLOT_SIZE;
    this.gap = options.gap ?? DEFAULT_GAP;
    this.onSelect = options.onSelect;
  }

  /** Rebuilds the bar from the given carried items, in order. */
  setItems(items: Item[], selectedItemId?: EntityId): void {
    this.container.removeChildren();
    this.slotsByItemId.clear();

    items.forEach((item, index) => {
      const slot = this.buildSlot(item, item.id === selectedItemId);
      slot.x = index * (this.slotSize + this.gap);
      this.slotsByItemId.set(item.id, slot);
      this.container.addChild(slot);
    });
  }

  private buildSlot(item: Item, selected: boolean): Container {
    const slot = new Container();
    slot.label = `item:${item.id}`;
    slot.eventMode = "static";
    slot.cursor = "pointer";
    slot.on("pointertap", () => this.onSelect?.(item.id));

    const background = new Graphics()
      .rect(0, 0, this.slotSize, this.slotSize)
      .fill({ color: selected ? SELECTED_SLOT_COLOR : SLOT_COLOR });
    background.label = "background";
    slot.addChild(background);

    const label = new Text({
      text: item.name,
      style: { fontSize: 10, fill: 0xffffff, wordWrap: true, wordWrapWidth: this.slotSize },
    });
    label.label = "label";
    label.x = 2;
    label.y = 2;
    slot.addChild(label);

    return slot;
  }

  slot(itemId: EntityId): Container | undefined {
    return this.slotsByItemId.get(itemId);
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
