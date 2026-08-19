import type { DialogueNode, EntityId, Hook, Hotspot, Room } from "@deme/content-schema";
import type { Point } from "./geometry.js";
import type { Verb } from "./verbs.js";

/** A single response option as offered to the player: gated entries have already been filtered out. */
export type DialogueResponseOption = NonNullable<DialogueNode["responses"]>[number];

/** Where a selected inventory item is being used. */
export type InventoryUseTarget =
  { kind: "hotspot"; roomId: EntityId; hotspot: Hotspot } | { kind: "item"; itemId: EntityId };

/** Fired when a hotspot is clicked under the currently selected verb. */
export interface HotspotInteractEvent {
  roomId: EntityId;
  hotspot: Hotspot;
  verb: Verb;
  hook: Hook;
}

/** Fired in addition to `hotspot-interact` when the clicked hotspot is an exit. */
export interface RoomExitEvent {
  fromRoomId: EntityId;
  hotspotId: EntityId;
  targetRoomId: EntityId;
}

/** Fired once a new Room has been loaded and its scene is ready. */
export interface RoomLoadedEvent {
  room: Room;
}

/** Fired when a click-to-walk command is issued (target is already walk-box clamped). */
export interface PlayerWalkEvent {
  from: Point;
  to: Point;
}

/** Fired when the topmost hotspot under the pointer changes (including to/from none). */
export interface HotspotHoverEvent {
  hotspot: Hotspot | undefined;
}

/** Fired when an item is added to the inventory (picked up, or granted directly). */
export interface ItemAddedEvent {
  itemId: EntityId;
}

/** Fired when an item is removed from the inventory. */
export interface ItemRemovedEvent {
  itemId: EntityId;
}

/** Fired when a portable item is picked up from a hotspot into the inventory. */
export interface ItemPickedUpEvent {
  itemId: EntityId;
  roomId: EntityId;
  hotspotId: EntityId;
}

/** Fired when a carried item is selected for a subsequent "use on X" gesture. */
export interface ItemSelectedEvent {
  itemId: EntityId;
}

/** Fired when the current item selection is cleared, with or without being used. */
export interface ItemDeselectedEvent {
  itemId: EntityId;
}

/** Fired when a selected inventory item is applied to a target; resolution (did anything happen) follows separately. */
export interface ItemUseRequestedEvent {
  itemId: EntityId;
  target: InventoryUseTarget;
}

/** Fired once a use-item gesture (from a hotspot click under a selection, or `useSelectedOn`) has been resolved. */
export interface ItemUsedEvent {
  itemId: EntityId;
  target: InventoryUseTarget;
  /** Whether a matching gated interaction/combination was found and its effects applied. */
  resolved: boolean;
}

/** Fired when talking to an NPC starts its dialogue tree. */
export interface DialogueStartedEvent {
  npcId: EntityId;
  treeId: EntityId;
  node: DialogueNode;
  responses: DialogueResponseOption[];
}

/** Fired whenever the dialogue runtime lands on a node (including the first, alongside `dialogue-started`). */
export interface DialogueLineEvent {
  npcId: EntityId;
  treeId: EntityId;
  node: DialogueNode;
  /** Responses with an unmet `condition` already filtered out. */
  responses: DialogueResponseOption[];
}

/** Fired when a dialogue tree reaches a response with no `targetNodeId`. */
export interface DialogueEndedEvent {
  npcId: EntityId;
  treeId: EntityId;
}

/** Fired after GameState is written to storage via GameSession#save. */
export interface GameSavedEvent {
  key: string;
}

/** Fired after GameState is restored from storage via GameSession#load. */
export interface GameLoadedEvent {
  key: string;
}

/** Fired when a sandboxed interaction script calls `describe(text)` to show the player a message. */
export interface ScriptMessageEvent {
  text: string;
}

/** Fired when a sandboxed interaction script fails (a bug, or adversarial content hitting a sandbox limit) — the script is aborted, but the session keeps running. */
export interface ScriptErrorEvent {
  hook: Hook;
  message: string;
}

export interface EngineEventMap extends Record<string, unknown> {
  "hotspot-interact": HotspotInteractEvent;
  "room-exit": RoomExitEvent;
  "room-loaded": RoomLoadedEvent;
  "player-walk": PlayerWalkEvent;
  "hotspot-hover": HotspotHoverEvent;
  "item-added": ItemAddedEvent;
  "item-removed": ItemRemovedEvent;
  "item-picked-up": ItemPickedUpEvent;
  "item-selected": ItemSelectedEvent;
  "item-deselected": ItemDeselectedEvent;
  "item-use-requested": ItemUseRequestedEvent;
  "item-used": ItemUsedEvent;
  "dialogue-started": DialogueStartedEvent;
  "dialogue-line": DialogueLineEvent;
  "dialogue-ended": DialogueEndedEvent;
  "game-saved": GameSavedEvent;
  "game-loaded": GameLoadedEvent;
  "script-message": ScriptMessageEvent;
  "script-error": ScriptErrorEvent;
}

type Listener<T> = (event: T) => void;

/** Minimal typed pub/sub used to make engine interactions observable by other systems. */
export class Emitter<EventMap extends Record<string, unknown>> {
  private listeners: { [K in keyof EventMap]?: Set<Listener<EventMap[K]>> } = {};

  on<K extends keyof EventMap>(type: K, listener: Listener<EventMap[K]>): () => void {
    const set = (this.listeners[type] ??= new Set());
    set.add(listener);
    return () => set.delete(listener);
  }

  off<K extends keyof EventMap>(type: K, listener: Listener<EventMap[K]>): void {
    this.listeners[type]?.delete(listener);
  }

  emit<K extends keyof EventMap>(type: K, event: EventMap[K]): void {
    this.listeners[type]?.forEach((listener) => listener(event));
  }
}
