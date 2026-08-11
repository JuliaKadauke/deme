// @vitest-environment node
//
// The sandboxed Lua VM (wasmoon) loads its .wasm via Node's `fs` against
// `import.meta.url` when running under Vitest/Node — which jsdom's faked
// browser-like `import.meta.url` breaks (see @deme/engine's lua-sandbox.ts).
// This file runs under the plain `node` environment instead of the rest of
// apps/player's jsdom suite (app.test.ts) specifically so the Lua-scripted
// half of the puzzle chain — not just the declarative half — actually
// executes, the same way packages/engine's own tests do.
import { GameSession } from "@deme/engine";
import { Container, Texture, type FederatedPointerEvent } from "pixi.js";
import { describe, expect, it } from "vitest";
import { DEMO_START_ROOM_ID, demoContentLoaders } from "./content.js";

function tapAt(stage: Container, x: number, y: number): void {
  stage.emit("pointertap", { global: { x, y } } as unknown as FederatedPointerEvent);
}

/** Flushes pending async hotspot handling, including a sandboxed Lua script run — wasmoon's first-ever WASM cold-start can take more than one tick. */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

// Hotspot centers, from content/demo-escape-room/rooms/study.json.
const SHELF: [number, number] = [65, 450];
const DESK: [number, number] = [350, 425];
const DOOR: [number, number] = [450, 185];

describe("the shipped demo game's puzzle chain end to end", () => {
  it("solves the desk with the brass key via Lua, then escapes through the Lua-scripted door", async () => {
    const stage = new Container();
    const session = new GameSession({
      stage,
      loaders: demoContentLoaders,
      loadTexture: async () => Texture.WHITE,
      startRoomId: DEMO_START_ROOM_ID,
    });
    const scriptErrors: unknown[] = [];
    session.events.on("script-error", (event) => scriptErrors.push(event));
    await session.start();

    // The door won't open without the key the desk script hands over.
    session.setVerb("use");
    tapAt(stage, ...DOOR);
    await flush();
    expect(session.runtime.currentRoom?.id).toBe("study");

    session.setVerb("pick-up");
    tapAt(stage, ...SHELF);
    await flush();
    expect(session.state.hasItem("brass-key")).toBe(true);

    // The desk's on-use interaction is pure Lua (scripts/unlock-desk.json) —
    // no declarative effects mirror it — so this is what exercises the
    // sandboxed scripting path end to end.
    session.setVerb("use");
    tapAt(stage, ...DESK);
    await flush();
    expect(session.state.hasFlag("desk-unlocked")).toBe(true);
    expect(session.state.hasItem("door-key")).toBe(true);

    session.setVerb("use");
    tapAt(stage, ...DOOR);
    await flush();
    expect(session.runtime.currentRoom?.id).toBe("freedom");

    expect(scriptErrors).toEqual([]);
  });

  it("gates both NPCs' bonus dialogue branch behind the desk-unlocked flag", async () => {
    const stage = new Container();
    const session = new GameSession({
      stage,
      loaders: demoContentLoaders,
      loadTexture: async () => Texture.WHITE,
      startRoomId: DEMO_START_ROOM_ID,
    });
    await session.start();

    const responseCounts: number[] = [];
    session.events.on("dialogue-started", (event) => responseCounts.push(event.responses.length));

    session.setVerb("talk");
    tapAt(stage, 535, 210); // jeeves-spot
    await flush();
    expect(session.activeDialogueNpcId).toBe("jeeves");
    // Only "have you seen a key" and "never mind" — the door-key and
    // desk-unlocked branches are both gated out before any progress.
    expect(responseCounts).toEqual([2]);
  });
});
