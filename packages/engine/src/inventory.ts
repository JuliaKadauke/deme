import type { EntityId } from "@deme/content-schema";
import { Emitter, type EngineEventMap, type InventoryUseTarget } from "./events.js";
import type { GameState } from "./game-state.js";

/**
 * Carried-item selection and the "use item on X" gesture, backed by
 * GameState's inventory. Resolving *what happens* when an item is used on a
 * target (gated hotspot interactions, item combinations) is GameSession's
 * job — this class only tracks which items are carried and which one is
 * currently selected, and emits the gesture for GameSession to resolve.
 */
export class Inventory {
  readonly events = new Emitter<EngineEventMap>();
  private selectedId: EntityId | undefined;

  constructor(private readonly state: GameState) {}

  get itemIds(): readonly EntityId[] {
    return this.state.inventory;
  }

  get selectedItemId(): EntityId | undefined {
    return this.selectedId;
  }

  has(itemId: EntityId): boolean {
    return this.state.hasItem(itemId);
  }

  /** Adds an item to the inventory (e.g. after a pickup). No-op if already carried. */
  add(itemId: EntityId): void {
    if (this.state.hasItem(itemId)) return;
    this.state.addItem(itemId);
    this.events.emit("item-added", { itemId });
  }

  /** Removes a carried item, clearing its selection first if selected. No-op if not carried. */
  remove(itemId: EntityId): void {
    if (!this.state.hasItem(itemId)) return;
    if (this.selectedId === itemId) this.deselect();
    this.state.removeItem(itemId);
    this.events.emit("item-removed", { itemId });
  }

  /** Selects a carried item for a subsequent `useSelectedOn` call. No-op if not carried. */
  select(itemId: EntityId): void {
    if (!this.state.hasItem(itemId)) return;
    this.selectedId = itemId;
    this.events.emit("item-selected", { itemId });
  }

  /** Clears the current selection, if any. */
  deselect(): void {
    if (this.selectedId === undefined) return;
    const itemId = this.selectedId;
    this.selectedId = undefined;
    this.events.emit("item-deselected", { itemId });
  }

  /**
   * Applies the currently selected item to `target`, clearing the selection.
   * Fires `item-use-requested` (for GameSession to resolve) and returns the
   * gesture, or undefined if no item is currently selected.
   */
  useSelectedOn(
    target: InventoryUseTarget,
  ): { itemId: EntityId; target: InventoryUseTarget } | undefined {
    if (this.selectedId === undefined) return undefined;
    const itemId = this.selectedId;
    this.deselect();
    const event = { itemId, target };
    this.events.emit("item-use-requested", event);
    return event;
  }
}
