import { Sprite, Texture } from "pixi.js";
import { describe, expect, it } from "vitest";
import { RoomScene } from "./room-scene.js";
import { loadFixtureRoom } from "./test-fixtures.js";

describe("RoomScene", () => {
  it("renders the fixture room: background, one layer per hotspot, and a player marker", async () => {
    const room = loadFixtureRoom("test-room");
    const loadTexture = async () => Texture.WHITE;

    const scene = await RoomScene.create(room, { loadTexture, showHotspotDebug: true });

    expect(scene.container.label).toBe("room:test-room");
    expect(scene.container.children).toEqual([
      scene.backgroundLayer,
      scene.hotspotLayer,
      scene.actorLayer,
    ]);

    expect(scene.backgroundLayer.children).toHaveLength(1);
    expect(scene.backgroundLayer.children[0]).toBeInstanceOf(Sprite);

    expect(scene.hotspotLayer.children).toHaveLength(room.hotspots.length);
    for (const hotspot of room.hotspots) {
      expect(scene.hotspotGraphics(hotspot.id)?.label).toBe(`hotspot:${hotspot.id}`);
    }

    expect(scene.actorLayer.children).toEqual([scene.playerMarker]);
  });

  it("renders without a background sprite when no texture loader is given", async () => {
    const room = loadFixtureRoom("test-room");
    const scene = await RoomScene.create(room);
    expect(scene.backgroundLayer.children).toHaveLength(0);
  });

  it("omits the hotspot debug overlay when showHotspotDebug is false", async () => {
    const room = loadFixtureRoom("test-room");
    const scene = await RoomScene.create(room, { showHotspotDebug: false });
    expect(scene.hotspotLayer.children).toHaveLength(0);
  });

  it("omits the hotspot debug overlay by default (showHotspotDebug not passed)", async () => {
    const room = loadFixtureRoom("test-room");
    const scene = await RoomScene.create(room);
    expect(scene.hotspotLayer.children).toHaveLength(0);
  });

  it("renders the hotspot debug overlay when showHotspotDebug is true", async () => {
    const room = loadFixtureRoom("test-room");
    const scene = await RoomScene.create(room, { showHotspotDebug: true });
    expect(scene.hotspotLayer.children).toHaveLength(room.hotspots.length);
  });

  it("moves the player marker to track a given position", async () => {
    const room = loadFixtureRoom("test-room");
    const scene = await RoomScene.create(room);
    scene.setPlayerPosition({ x: 123, y: 45 });
    expect(scene.playerMarker.x).toBe(123);
    expect(scene.playerMarker.y).toBe(45);
  });
});
