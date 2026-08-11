import type { Hotspot, Room } from "@deme/content-schema";
import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import type { Point } from "./geometry.js";

export type TextureLoader = (path: string) => Promise<Texture>;

export interface RoomSceneOptions {
  /** Resolves a content-relative asset path (e.g. `room.background`) to a loaded Texture. */
  loadTexture?: TextureLoader;
  /**
   * Draws each hotspot's clickable area as a translucent overlay. Defaults
   * to true: the demo game has no art yet (see docs/architecture.md — the
   * art pipeline is deferred to a future epic), so hotspot outlines are the
   * only visual cue during development.
   */
  showHotspotDebug?: boolean;
}

const HOTSPOT_DEBUG_COLOR = 0x00ffea;
const HOTSPOT_DEBUG_ALPHA = 0.2;
const PLAYER_RADIUS = 10;
const PLAYER_COLOR = 0xffcc00;

/**
 * Builds and owns the PixiJS scene graph for a single loaded Room: a
 * background layer, a hotspot overlay layer, and an actor layer holding the
 * player marker. Pure scene-graph construction — no input handling, no game
 * state — so it stays testable without a renderer/canvas (see
 * room-scene.test.ts) and reusable regardless of who drives clicks into it.
 */
export class RoomScene {
  readonly container = new Container();
  readonly backgroundLayer = new Container();
  readonly hotspotLayer = new Container();
  readonly actorLayer = new Container();
  readonly playerMarker = new Graphics();

  private readonly hotspotGraphicsById = new Map<string, Graphics>();

  private constructor(
    readonly room: Room,
    private readonly options: RoomSceneOptions,
  ) {
    this.container.label = `room:${room.id}`;
    this.container.addChild(this.backgroundLayer, this.hotspotLayer, this.actorLayer);
    this.buildHotspots();
    this.buildPlayerMarker();
  }

  static async create(room: Room, options: RoomSceneOptions = {}): Promise<RoomScene> {
    const scene = new RoomScene(room, options);
    await scene.loadBackground();
    return scene;
  }

  private async loadBackground(): Promise<void> {
    const { background } = this.room;
    if (!background || !this.options.loadTexture) return;
    const texture = await this.options.loadTexture(background);
    const sprite = new Sprite(texture);
    sprite.label = "background";
    this.backgroundLayer.addChild(sprite);
  }

  private buildHotspots(): void {
    if (this.options.showHotspotDebug === false) return;
    for (const hotspot of this.room.hotspots) {
      const graphics = this.buildHotspotGraphics(hotspot);
      this.hotspotGraphicsById.set(hotspot.id, graphics);
      this.hotspotLayer.addChild(graphics);
    }
  }

  private buildHotspotGraphics(hotspot: Hotspot): Graphics {
    const graphics = new Graphics();
    if (hotspot.area.shape === "rect") {
      graphics.rect(hotspot.area.x, hotspot.area.y, hotspot.area.width, hotspot.area.height);
    } else {
      const [first, ...rest] = hotspot.area.points;
      if (first) {
        graphics.moveTo(first[0], first[1]);
        for (const [x, y] of rest) graphics.lineTo(x, y);
        graphics.closePath();
      }
    }
    graphics.fill({ color: HOTSPOT_DEBUG_COLOR, alpha: HOTSPOT_DEBUG_ALPHA });
    graphics.label = `hotspot:${hotspot.id}`;
    return graphics;
  }

  private buildPlayerMarker(): void {
    this.playerMarker.circle(0, 0, PLAYER_RADIUS).fill(PLAYER_COLOR);
    this.playerMarker.label = "player";
    this.actorLayer.addChild(this.playerMarker);
  }

  setPlayerPosition(point: Point): void {
    this.playerMarker.x = point.x;
    this.playerMarker.y = point.y;
  }

  hotspotGraphics(hotspotId: string): Graphics | undefined {
    return this.hotspotGraphicsById.get(hotspotId);
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
