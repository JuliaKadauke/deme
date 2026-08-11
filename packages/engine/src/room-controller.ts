import type { EntityId, Hotspot, Room } from "@deme/content-schema";
import { Emitter, type EngineEventMap } from "./events.js";
import { hitTestArea, type Point } from "./geometry.js";
import type { Player } from "./player.js";
import { DEFAULT_VERB, VERB_TO_HOOK, type Verb } from "./verbs.js";

/**
 * Owns click interpretation for a single loaded Room: hotspot hit-testing
 * (topmost hotspot wins on overlap, matching draw order), verb-based
 * interaction, exit-hotspot detection, and click-to-walk delegation to the
 * Player. Framework-agnostic — no PixiJS dependency — so it's testable
 * without a rendering context and reusable if the renderer ever changes.
 */
export class RoomController {
  readonly events = new Emitter<EngineEventMap>();
  verb: Verb = DEFAULT_VERB;

  private readonly targetRoomByHotspotId: Map<EntityId, EntityId>;

  constructor(
    private readonly room: Room,
    private readonly player: Player,
  ) {
    this.targetRoomByHotspotId = new Map(
      (room.exits ?? []).map((exit) => [exit.hotspotId, exit.targetRoomId]),
    );
  }

  setVerb(verb: Verb): void {
    this.verb = verb;
  }

  /** Returns the topmost hotspot containing `point`, if any. */
  hitTestHotspot(point: Point): Hotspot | undefined {
    for (let i = this.room.hotspots.length - 1; i >= 0; i--) {
      const hotspot = this.room.hotspots[i]!;
      if (hitTestArea(hotspot.area, point)) return hotspot;
    }
    return undefined;
  }

  /**
   * Interprets a click at `point`: interacts with a hotspot if one is there
   * (firing `hotspot-interact`, and `room-exit` if it's an exit hotspot),
   * otherwise issues a click-to-walk command (firing `player-walk`).
   */
  handleClick(point: Point): void {
    const hotspot = this.hitTestHotspot(point);
    if (hotspot) {
      this.interact(hotspot);
      return;
    }

    const from = this.player.position;
    const to = this.player.walkTo(point);
    this.events.emit("player-walk", { from, to });
  }

  private interact(hotspot: Hotspot): void {
    const hook = VERB_TO_HOOK[this.verb];
    this.events.emit("hotspot-interact", {
      roomId: this.room.id,
      hotspot,
      verb: this.verb,
      hook,
    });

    const targetRoomId = this.targetRoomByHotspotId.get(hotspot.id);
    if (targetRoomId) {
      this.events.emit("room-exit", {
        fromRoomId: this.room.id,
        hotspotId: hotspot.id,
        targetRoomId,
      });
    }
  }
}
