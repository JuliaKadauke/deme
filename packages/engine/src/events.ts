import type { EntityId, Hook, Hotspot, Room } from "@deme/content-schema";
import type { Point } from "./geometry.js";
import type { Verb } from "./verbs.js";

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

export interface EngineEventMap extends Record<string, unknown> {
  "hotspot-interact": HotspotInteractEvent;
  "room-exit": RoomExitEvent;
  "room-loaded": RoomLoadedEvent;
  "player-walk": PlayerWalkEvent;
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
