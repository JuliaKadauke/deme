import type { EntityId, Room } from "@deme/content-schema";
import type { Container, FederatedPointerEvent } from "pixi.js";
import { Emitter, type EngineEventMap } from "./events.js";
import type { Point } from "./geometry.js";
import { Player } from "./player.js";
import { RoomController } from "./room-controller.js";
import { RoomScene, type TextureLoader } from "./room-scene.js";
import type { Verb } from "./verbs.js";

export type RoomLoader = (roomId: EntityId) => Promise<Room>;

export interface GameRuntimeOptions {
  /** The container clicks are captured on and the room scene is mounted into — typically `app.stage`. */
  stage: Container;
  /** Loads a Room definition by id. Left up to the host app (fetch, filesystem, bundled import, ...). */
  loadRoom: RoomLoader;
  /** Resolves an asset path to a loaded Texture. Omit to render without a background sprite. */
  loadTexture?: TextureLoader;
  playerStart?: Point;
  playerSpeedPxPerSec?: number;
  showHotspotDebug?: boolean;
}

/**
 * Top-level orchestrator: wires click input on `stage` to a RoomController,
 * drives Player movement from the host's render loop via `update()`, and
 * swaps in a new RoomScene on room-exit triggers. Deliberately does not own
 * a PixiJS Application — canvas/renderer setup is host-app concern (see
 * README.md) — so this stays testable against a plain Container.
 */
export class GameRuntime {
  readonly events = new Emitter<EngineEventMap>();

  private readonly stage: Container;
  private readonly loadRoomFn: RoomLoader;
  private readonly loadTexture: TextureLoader | undefined;
  private readonly playerStart: Point;
  private readonly playerSpeedPxPerSec: number | undefined;
  private readonly showHotspotDebug: boolean | undefined;

  private player: Player | undefined;
  private controller: RoomController | undefined;
  private scene: RoomScene | undefined;

  constructor(options: GameRuntimeOptions) {
    this.stage = options.stage;
    this.loadRoomFn = options.loadRoom;
    this.loadTexture = options.loadTexture;
    this.playerStart = options.playerStart ?? { x: 0, y: 0 };
    this.playerSpeedPxPerSec = options.playerSpeedPxPerSec;
    this.showHotspotDebug = options.showHotspotDebug;

    this.stage.eventMode = "static";
    this.stage.on("pointertap", this.onPointerTap);
  }

  get currentRoom(): Room | undefined {
    return this.scene?.room;
  }

  get playerPosition(): Point | undefined {
    return this.player?.position;
  }

  setVerb(verb: Verb): void {
    this.controller?.setVerb(verb);
  }

  async loadRoom(roomId: EntityId): Promise<void> {
    const room = await this.loadRoomFn(roomId);

    const player = new Player(this.playerStart, {
      speedPxPerSec: this.playerSpeedPxPerSec,
      walkBox: room.walkBox,
    });
    const controller = new RoomController(room, player);
    controller.events.on("hotspot-interact", (event) =>
      this.events.emit("hotspot-interact", event),
    );
    controller.events.on("player-walk", (event) => this.events.emit("player-walk", event));
    controller.events.on("room-exit", (event) => {
      this.events.emit("room-exit", event);
      void this.loadRoom(event.targetRoomId);
    });

    const scene = await RoomScene.create(room, {
      loadTexture: this.loadTexture,
      showHotspotDebug: this.showHotspotDebug,
    });
    scene.setPlayerPosition(player.position);

    const previousScene = this.scene;
    this.stage.removeChildren();
    this.stage.addChild(scene.container);
    previousScene?.destroy();

    this.player = player;
    this.controller = controller;
    this.scene = scene;

    this.events.emit("room-loaded", { room });
  }

  /** Advances player movement by `deltaMs` and syncs the on-screen marker. Call this from the host's render loop. */
  update(deltaMs: number): void {
    this.player?.update(deltaMs);
    if (this.player && this.scene) {
      this.scene.setPlayerPosition(this.player.position);
    }
  }

  destroy(): void {
    this.stage.off("pointertap", this.onPointerTap);
    this.scene?.destroy();
  }

  private readonly onPointerTap = (event: FederatedPointerEvent): void => {
    if (!this.controller) return;
    const local = this.stage.toLocal(event.global);
    this.controller.handleClick(local);
  };
}
