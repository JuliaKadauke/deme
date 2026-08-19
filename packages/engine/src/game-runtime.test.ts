import type { EntityId, Room } from "@deme/content-schema";
import { Container, Texture, type FederatedPointerEvent } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { GameRuntime } from "./game-runtime.js";
import { loadFixtureRoom } from "./test-fixtures.js";

const rooms: Record<EntityId, Room> = {
  "test-room": loadFixtureRoom("test-room"),
  "test-room-2": loadFixtureRoom("test-room-2"),
};

function makeRuntime() {
  const stage = new Container();
  const runtime = new GameRuntime({
    stage,
    loadRoom: async (id) => rooms[id]!,
    loadTexture: async () => Texture.WHITE,
    playerStart: { x: 200, y: 350 },
    playerSpeedPxPerSec: 1000,
  });
  return { stage, runtime };
}

function tapAt(stage: Container, x: number, y: number): void {
  stage.emit("pointertap", { global: { x, y } } as unknown as FederatedPointerEvent);
}

function moveTo(stage: Container, x: number, y: number): void {
  stage.emit("pointermove", { global: { x, y } } as unknown as FederatedPointerEvent);
}

describe("GameRuntime", () => {
  it("loads a Room, renders its scene onto the stage, and fires room-loaded", async () => {
    const { stage, runtime } = makeRuntime();
    const loaded: string[] = [];
    runtime.events.on("room-loaded", (event) => loaded.push(event.room.id));

    await runtime.loadRoom("test-room");

    expect(runtime.currentRoom?.id).toBe("test-room");
    expect(loaded).toEqual(["test-room"]);
    expect(stage.children).toHaveLength(1);
  });

  it("fires an observable hotspot-interact event when a hotspot is clicked", async () => {
    const { stage, runtime } = makeRuntime();
    await runtime.loadRoom("test-room");

    const interactions: unknown[] = [];
    runtime.events.on("hotspot-interact", (event) => interactions.push(event));

    tapAt(stage, 130, 220); // inside the "table" hotspot

    expect(interactions).toEqual([
      expect.objectContaining({
        hotspot: expect.objectContaining({ id: "table" }),
        hook: "on-look",
      }),
    ]);
  });

  it("transitions rooms when an exit hotspot is clicked, loading the next Room definition", async () => {
    const { stage, runtime } = makeRuntime();
    const loaded: string[] = [];
    runtime.events.on("room-loaded", (event) => loaded.push(event.room.id));
    await runtime.loadRoom("test-room");

    const exits: unknown[] = [];
    runtime.events.on("room-exit", (event) => exits.push(event));

    tapAt(stage, 440, 300); // inside the "door" exit hotspot

    expect(exits).toEqual([
      { fromRoomId: "test-room", hotspotId: "door", targetRoomId: "test-room-2" },
    ]);

    await vi.waitFor(() => {
      expect(runtime.currentRoom?.id).toBe("test-room-2");
    });
    expect(loaded).toEqual(["test-room", "test-room-2"]);
    expect(stage.children).toHaveLength(1); // old scene swapped out, not stacked
  });

  it("fires hotspot-hover exactly once per hover change, not per pointermove", async () => {
    const { stage, runtime } = makeRuntime();
    await runtime.loadRoom("test-room");

    const hovers: unknown[] = [];
    runtime.events.on("hotspot-hover", (event) => hovers.push(event));

    moveTo(stage, 130, 220); // enters the "table" hotspot
    moveTo(stage, 131, 221); // still inside "table" — should not re-fire
    moveTo(stage, 132, 222); // still inside "table" — should not re-fire

    expect(hovers).toEqual([{ hotspot: expect.objectContaining({ id: "table" }) }]);

    moveTo(stage, 0, 0); // outside any hotspot — fires hover-out
    moveTo(stage, 1, 1); // still outside any hotspot — should not re-fire

    expect(hovers).toEqual([
      { hotspot: expect.objectContaining({ id: "table" }) },
      { hotspot: undefined },
    ]);
  });

  it("walks the player to a click-to-walk target, clamped within the room's walk box", async () => {
    const { stage, runtime } = makeRuntime();
    await runtime.loadRoom("test-room");

    tapAt(stage, 600, 350); // outside the walk box, to the right
    runtime.update(10_000); // long enough to fully arrive

    expect(runtime.playerPosition).toEqual({ x: 460, y: 350 });
  });
});
