import type { EntityId } from "@deme/content-schema";

/** The current save format version. Bump when {@link GameStateData}'s shape changes incompatibly. */
export const GAME_STATE_VERSION = 1;

/** The single serializable game state: flags, carried item ids, and the current room. */
export interface GameStateData {
  version: number;
  currentRoomId: EntityId;
  /** Sorted for deterministic serialization/diffing. */
  flags: EntityId[];
  /** Carried item ids, in pickup order. */
  inventory: EntityId[];
}

export interface GameStateInit {
  currentRoomId: EntityId;
  flags?: Iterable<EntityId>;
  inventory?: Iterable<EntityId>;
}

/**
 * Mutable game state: boolean flags, carried item ids, and the current room.
 * The single serializable source of truth for save/load and dialogue/hotspot
 * gating — see conditions.ts for how it's evaluated against content.
 */
export class GameState {
  currentRoomId: EntityId;
  private readonly flagSet: Set<EntityId>;
  private readonly inventoryIds: EntityId[];

  constructor(init: GameStateInit) {
    this.currentRoomId = init.currentRoomId;
    this.flagSet = new Set(init.flags ?? []);
    this.inventoryIds = [...new Set(init.inventory ?? [])];
  }

  hasFlag(flag: EntityId): boolean {
    return this.flagSet.has(flag);
  }

  setFlag(flag: EntityId): void {
    this.flagSet.add(flag);
  }

  clearFlag(flag: EntityId): void {
    this.flagSet.delete(flag);
  }

  get flags(): readonly EntityId[] {
    return [...this.flagSet].sort();
  }

  hasItem(itemId: EntityId): boolean {
    return this.inventoryIds.includes(itemId);
  }

  addItem(itemId: EntityId): void {
    if (!this.inventoryIds.includes(itemId)) this.inventoryIds.push(itemId);
  }

  removeItem(itemId: EntityId): void {
    const index = this.inventoryIds.indexOf(itemId);
    if (index !== -1) this.inventoryIds.splice(index, 1);
  }

  get inventory(): readonly EntityId[] {
    return this.inventoryIds;
  }

  /** Replaces this GameState's contents with `other`'s, in place (this object's identity is preserved). Used to restore a save without invalidating existing references (e.g. Inventory holds a reference to this state). */
  restoreFrom(other: GameState): void {
    this.currentRoomId = other.currentRoomId;
    this.flagSet.clear();
    for (const flag of other.flags) this.flagSet.add(flag);
    this.inventoryIds.length = 0;
    this.inventoryIds.push(...other.inventory);
  }

  toJSON(): GameStateData {
    return {
      version: GAME_STATE_VERSION,
      currentRoomId: this.currentRoomId,
      flags: this.flags as EntityId[],
      inventory: [...this.inventoryIds],
    };
  }

  static fromJSON(data: GameStateData): GameState {
    return new GameState({
      currentRoomId: data.currentRoomId,
      flags: data.flags,
      inventory: data.inventory,
    });
  }
}
