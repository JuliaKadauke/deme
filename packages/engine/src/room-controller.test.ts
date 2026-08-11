import { describe, expect, it } from "vitest";
import { Player } from "./player.js";
import { RoomController } from "./room-controller.js";
import { loadFixtureRoom } from "./test-fixtures.js";

function makeController() {
  const room = loadFixtureRoom("test-room");
  const player = new Player({ x: 200, y: 350 }, { walkBox: room.walkBox });
  const controller = new RoomController(room, player);
  return { room, player, controller };
}

describe("RoomController", () => {
  it("defaults to the look verb", () => {
    const { controller } = makeController();
    expect(controller.verb).toBe("look");
  });

  it("hit-tests a click against a hotspot and fires hotspot-interact with the mapped hook", () => {
    const { controller } = makeController();
    controller.setVerb("use");

    const events: unknown[] = [];
    controller.events.on("hotspot-interact", (event) => events.push(event));

    controller.handleClick({ x: 130, y: 220 }); // inside the "table" hotspot

    expect(events).toEqual([
      expect.objectContaining({
        roomId: "test-room",
        verb: "use",
        hook: "on-use",
        hotspot: expect.objectContaining({ id: "table" }),
      }),
    ]);
  });

  it("fires room-exit alongside hotspot-interact when the clicked hotspot is an exit", () => {
    const { controller } = makeController();

    const interactions: unknown[] = [];
    const exits: unknown[] = [];
    controller.events.on("hotspot-interact", (event) => interactions.push(event));
    controller.events.on("room-exit", (event) => exits.push(event));

    controller.handleClick({ x: 440, y: 300 }); // inside the "door" hotspot

    expect(interactions).toHaveLength(1);
    expect(exits).toEqual([
      { fromRoomId: "test-room", hotspotId: "door", targetRoomId: "test-room-2" },
    ]);
  });

  it("does not fire room-exit for a non-exit hotspot", () => {
    const { controller } = makeController();
    const exits: unknown[] = [];
    controller.events.on("room-exit", (event) => exits.push(event));

    controller.handleClick({ x: 130, y: 220 }); // "table" — not an exit

    expect(exits).toEqual([]);
  });

  it("treats a click outside any hotspot as a click-to-walk command", () => {
    const { controller, player } = makeController();
    const walks: unknown[] = [];
    const interactions: unknown[] = [];
    controller.events.on("player-walk", (event) => walks.push(event));
    controller.events.on("hotspot-interact", (event) => interactions.push(event));

    controller.handleClick({ x: 300, y: 350 }); // empty floor, inside the walk box

    expect(interactions).toEqual([]);
    expect(walks).toEqual([{ from: { x: 200, y: 350 }, to: { x: 300, y: 350 } }]);
    expect(player.isWalking).toBe(true);
  });

  it("picks the topmost hotspot when two overlap", () => {
    const room = loadFixtureRoom("test-room");
    const overlapping = {
      ...room,
      hotspots: [
        {
          id: "back",
          name: "Back",
          area: { shape: "rect" as const, x: 0, y: 0, width: 50, height: 50 },
        },
        {
          id: "front",
          name: "Front",
          area: { shape: "rect" as const, x: 0, y: 0, width: 50, height: 50 },
        },
      ],
    };
    const player = new Player({ x: 200, y: 350 }, { walkBox: room.walkBox });
    const controller = new RoomController(overlapping, player);
    const hit = controller.hitTestHotspot({ x: 25, y: 25 });
    expect(hit?.id).toBe("front");
  });
});
