import type { EntityId } from "@deme/content-schema";
import { Container, Texture, type FederatedPointerEvent } from "pixi.js";
import { describe, expect, it } from "vitest";
import type { ContentLoaders } from "./game-session.js";
import { GameSession } from "./game-session.js";
import { MemoryStorage } from "./save-load.js";
import {
  loadFixtureDialogueTree,
  loadFixtureItem,
  loadFixtureNpc,
  loadFixtureRoom,
} from "./test-fixtures.js";

/**
 * End-to-end acceptance test for the "engine state, inventory, dialogue,
 * save/load" issue: a test content pack (packages/engine/test/fixtures)
 * with two NPCs — a human (Jeeves) and a scripted "AI assistant" (ARIA),
 * mechanically identical dialogue trees — supports full branching dialogue
 * gated by flags; an item can be picked up and used to unlock a
 * flag-gated interaction; save/reload restores exact state.
 */

const room = loadFixtureRoom("escape-room");
const brassKey = loadFixtureItem("brass-key");
const jeeves = loadFixtureNpc("jeeves");
const aria = loadFixtureNpc("aria");
const jeevesIntro = loadFixtureDialogueTree("jeeves-intro");
const ariaIntro = loadFixtureDialogueTree("aria-intro");

const loaders: ContentLoaders = {
  loadRoom: async () => room,
  loadItem: async (id) => ({ "brass-key": brassKey })[id]!,
  loadNpc: async (id) => ({ jeeves, aria })[id]!,
  loadDialogueTree: async (id) => ({ "jeeves-intro": jeevesIntro, "aria-intro": ariaIntro })[id]!,
  loadScript: async (id) => {
    throw new Error(`unexpected loadScript("${id}") — this fixture only uses inline source`);
  },
};

function tapAt(stage: Container, x: number, y: number): void {
  stage.emit("pointertap", { global: { x, y } } as unknown as FederatedPointerEvent);
}

/**
 * Flushes pending async work (hotspot handling, including a sandboxed Lua
 * script run) before assertions. Loops a few event-loop turns rather than
 * one, since wasmoon's first-ever WASM cold-start can take more than a
 * single `setTimeout(0)` tick.
 */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function makeSession() {
  const stage = new Container();
  const session = new GameSession({
    stage,
    loaders,
    loadTexture: async () => Texture.WHITE,
    startRoomId: "escape-room",
  });
  await session.start();
  return { stage, session };
}

// Hotspot centers, from test/fixtures/rooms/escape-room.json.
const SHELF: [number, number] = [50, 120];
const DESK: [number, number] = [200, 305];
const JEEVES_SPOT: [number, number] = [340, 290];
const ARIA_SPOT: [number, number] = [440, 290];

describe("acceptance: state, inventory, dialogue, save/load", () => {
  it.each([
    { npcId: "jeeves" as EntityId, spot: JEEVES_SPOT },
    { npcId: "aria" as EntityId, spot: ARIA_SPOT },
  ])(
    "supports full branching dialogue with $npcId, gated by the desk-unlocked flag",
    async ({ npcId, spot }) => {
      const { stage, session } = await makeSession();
      const lines: { text: string; responseCount: number }[] = [];
      session.events.on("dialogue-started", (e) =>
        lines.push({ text: e.node.text, responseCount: e.responses.length }),
      );
      session.events.on("dialogue-line", (e) =>
        lines.push({ text: e.node.text, responseCount: e.responses.length }),
      );

      session.setVerb("talk");
      tapAt(stage, ...spot);
      await flush();

      expect(session.activeDialogueNpcId).toBe(npcId);
      // Root node offers 2 responses: the desk-unlocked one is gated out before any progress.
      expect(lines).toEqual([{ text: expect.any(String), responseCount: 2 }]);

      // Branch into "have you seen a key" — a non-terminal response with a targetNodeId.
      session.chooseDialogueResponse(0);
      expect(lines).toHaveLength(2);
      expect(lines[1]!.responseCount).toBe(1);

      session.chooseDialogueResponse(0); // "Thank you." — terminal, ends the dialogue.
      expect(session.activeDialogueNpcId).toBeUndefined();

      // Restart and take the flag-setting terminal branch instead.
      session.setVerb("talk");
      tapAt(stage, ...spot);
      await flush();
      session.chooseDialogueResponse(1); // "Never mind." — sets met-<npc> flag, ends dialogue.
      expect(session.state.hasFlag(`met-${npcId}`)).toBe(true);
    },
  );

  it("picks up the brass key, and using it unlocks the flag-gated desk interaction", async () => {
    const { stage, session } = await makeSession();
    const messages: unknown[] = [];
    session.events.on("script-message", (e) => messages.push(e));

    expect(session.state.hasFlag("desk-unlocked")).toBe(false);

    session.setVerb("use");
    tapAt(stage, ...DESK); // locked: no key yet
    await flush();
    expect(session.state.hasFlag("desk-unlocked")).toBe(false);

    session.setVerb("pick-up");
    tapAt(stage, ...SHELF);
    await flush();
    expect(session.state.hasItem("brass-key")).toBe(true);

    session.setVerb("use");
    tapAt(stage, ...DESK);
    await flush();
    expect(session.state.hasFlag("desk-unlocked")).toBe(true);

    // The desk's on-use interaction also runs a Lua combination-lock-style
    // check (hasItem gate → setFlag + describe) through the sandboxed VM —
    // this flag is set only by that script, not by the declarative effects.
    expect(session.state.hasFlag("desk-unlocked-by-script")).toBe(true);
    expect(messages).toEqual(expect.arrayContaining([{ text: "The lock clicks open." }]));
  });

  it("reveals the flag-gated dialogue branch on both NPCs once the desk is unlocked", async () => {
    const { stage, session } = await makeSession();
    session.setVerb("pick-up");
    tapAt(stage, ...SHELF);
    await flush();
    session.setVerb("use");
    tapAt(stage, ...DESK);
    await flush();
    expect(session.state.hasFlag("desk-unlocked")).toBe(true);

    for (const spot of [JEEVES_SPOT, ARIA_SPOT]) {
      const lines: { text: string; responseCount: number }[] = [];
      const unsubscribe = session.events.on("dialogue-started", (e) =>
        lines.push({ text: e.node.text, responseCount: e.responses.length }),
      );
      session.setVerb("talk");
      tapAt(stage, ...spot);
      await flush();
      unsubscribe();
      expect(lines).toEqual([{ text: expect.any(String), responseCount: 3 }]);
      session.chooseDialogueResponse(2); // "Never mind." to close out this NPC's conversation.
    }
  });

  it("save/reload restores exact state: room, inventory, and flags survive a fresh GameSession", async () => {
    const storage = new MemoryStorage();
    const { stage, session } = await makeSession();

    session.setVerb("pick-up");
    tapAt(stage, ...SHELF);
    await flush();
    session.setVerb("use");
    tapAt(stage, ...DESK);
    await flush();
    session.setVerb("talk");
    tapAt(stage, ...JEEVES_SPOT);
    await flush();
    session.chooseDialogueResponse(2); // sets met-jeeves

    const expected = session.state.toJSON();
    expect(expected).toEqual({
      version: 1,
      currentRoomId: "escape-room",
      flags: ["desk-unlocked", "desk-unlocked-by-script", "met-jeeves"],
      inventory: ["brass-key"],
    });
    session.save(storage);

    const { session: fresh } = await makeSession();
    expect(fresh.state.toJSON()).not.toEqual(expected);

    await fresh.load(storage);

    expect(fresh.state.toJSON()).toEqual(expected);
    expect(fresh.runtime.currentRoom?.id).toBe("escape-room");
  });
});
