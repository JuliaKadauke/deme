import type { DialogueTree, EntityId, Item, Npc, Room } from "@deme/content-schema";
import { Container, Texture, type FederatedPointerEvent } from "pixi.js";
import { describe, expect, it } from "vitest";
import type { ContentLoaders } from "./game-session.js";
import { GameSession } from "./game-session.js";
import { GameState } from "./game-state.js";
import { MemoryStorage } from "./save-load.js";

const room: Room = {
  id: "room-a",
  type: "room",
  name: "Room A",
  hotspots: [
    {
      id: "shelf",
      name: "Shelf",
      targetItemId: "key",
      area: { shape: "rect", x: 0, y: 0, width: 50, height: 50 },
    },
    {
      id: "desk",
      name: "Desk",
      area: { shape: "rect", x: 100, y: 0, width: 50, height: 50 },
      interactions: [
        {
          hook: "on-use",
          condition: { requiredItemIds: ["key"] },
          effects: { setFlags: ["unlocked"] },
          source: 'describe("The desk unlocks with a satisfying click.")',
        },
      ],
    },
    {
      id: "npc-spot",
      name: "Npc",
      targetNpcId: "npc-a",
      area: { shape: "rect", x: 200, y: 0, width: 50, height: 50 },
    },
  ],
  npcIds: ["npc-a"],
  itemIds: [],
  exits: [],
};

const key: Item = { id: "key", type: "item", name: "Key", portable: true };
const glue: Item = {
  id: "glue",
  type: "item",
  name: "Glue",
  combinesWithItemIds: ["key"],
  interactions: [{ hook: "on-combine", effects: { setFlags: ["glued"] }, source: "" }],
};

const npc: Npc = { id: "npc-a", type: "npc", name: "Npc A", dialogueTreeId: "tree-a" };

const tree: DialogueTree = {
  id: "tree-a",
  type: "dialogueTree",
  npcId: "npc-a",
  rootNodeId: "greet",
  nodes: [{ id: "greet", speaker: "npc", text: "Hi", responses: [{ text: "Bye" }] }],
};

const items: Record<EntityId, Item> = { key, glue };
const npcs: Record<EntityId, Npc> = { "npc-a": npc };
const trees: Record<EntityId, DialogueTree> = { "tree-a": tree };
const rooms: Record<EntityId, Room> = { "room-a": room };

function makeLoaders(): ContentLoaders {
  return {
    loadRoom: async (id) => rooms[id]!,
    loadItem: async (id) => items[id]!,
    loadNpc: async (id) => npcs[id]!,
    loadDialogueTree: async (id) => trees[id]!,
    loadScript: async (id) => {
      throw new Error(`unexpected loadScript("${id}") — this suite only uses inline source`);
    },
  };
}

function tapAt(stage: Container, x: number, y: number): void {
  stage.emit("pointertap", { global: { x, y } } as unknown as FederatedPointerEvent);
}

async function makeSession(initialState?: GameState) {
  const stage = new Container();
  const session = new GameSession({
    stage,
    loaders: makeLoaders(),
    loadTexture: async () => Texture.WHITE,
    startRoomId: "room-a",
    initialState,
  });
  await session.start();
  return { stage, session };
}

describe("GameSession", () => {
  it("picks up a portable item under the pick-up verb, adding it to the inventory", async () => {
    const { stage, session } = await makeSession();
    const pickedUp: unknown[] = [];
    session.events.on("item-picked-up", (e) => pickedUp.push(e));

    session.setVerb("pick-up");
    tapAt(stage, 25, 25); // shelf

    await vi_flush();
    expect(session.state.hasItem("key")).toBe(true);
    expect(pickedUp).toEqual([{ itemId: "key", roomId: "room-a", hotspotId: "shelf" }]);
  });

  it("does not pick up the same item twice", async () => {
    const { stage, session } = await makeSession();
    session.setVerb("pick-up");
    tapAt(stage, 25, 25);
    await vi_flush();
    tapAt(stage, 25, 25);
    await vi_flush();

    expect(session.state.inventory).toEqual(["key"]);
  });

  it("unlocks a flag-gated hotspot interaction via mere possession under the use verb, running its Lua source", async () => {
    const { stage, session } = await makeSession();
    const messages: unknown[] = [];
    session.events.on("script-message", (e) => messages.push(e));

    session.setVerb("pick-up");
    tapAt(stage, 25, 25); // pick up the key
    await vi_flush();

    session.setVerb("use");
    tapAt(stage, 125, 25); // desk
    await vi_flush();

    expect(session.state.hasFlag("unlocked")).toBe(true);
    expect(messages).toEqual([{ text: "The desk unlocks with a satisfying click." }]);
  });

  it("leaves the flag-gated interaction locked without the item", async () => {
    const { stage, session } = await makeSession();
    session.setVerb("use");
    tapAt(stage, 125, 25); // desk, no key carried
    await vi_flush();

    expect(session.state.hasFlag("unlocked")).toBe(false);
  });

  it("unlocks via the explicit select-item-then-click-hotspot gesture, and fires item-used", async () => {
    const { stage, session } = await makeSession();
    session.setVerb("pick-up");
    tapAt(stage, 25, 25);
    await vi_flush();

    const used: unknown[] = [];
    session.events.on("item-used", (e) => used.push(e));

    session.selectInventoryItem("key");
    session.setVerb("look"); // selection should override the verb
    tapAt(stage, 125, 25); // desk
    await vi_flush();

    expect(session.state.hasFlag("unlocked")).toBe(true);
    expect(session.inventory.selectedItemId).toBeUndefined();
    expect(used).toEqual([
      {
        itemId: "key",
        target: {
          kind: "hotspot",
          roomId: "room-a",
          hotspot: expect.objectContaining({ id: "desk" }),
        },
        resolved: true,
      },
    ]);
  });

  it("combines two inventory items via combinesWithItemIds + an on-combine interaction", async () => {
    const { session } = await makeSession();
    session.inventory.add("key");
    session.inventory.add("glue");

    const used: unknown[] = [];
    session.events.on("item-used", (e) => used.push(e));

    session.selectInventoryItem("glue");
    await session.useSelectedItemOnItem("key");

    expect(session.state.hasFlag("glued")).toBe(true);
    expect(used).toEqual([
      { itemId: "glue", target: { kind: "item", itemId: "key" }, resolved: true },
    ]);
  });

  it("starts a dialogue when talking to a hotspot's NPC, and ends it on a terminal response", async () => {
    const { stage, session } = await makeSession();
    const started: unknown[] = [];
    const ended: unknown[] = [];
    session.events.on("dialogue-started", (e) => started.push(e));
    session.events.on("dialogue-ended", (e) => ended.push(e));

    session.setVerb("talk");
    tapAt(stage, 225, 25); // npc-spot
    await vi_flush();

    expect(session.activeDialogueNpcId).toBe("npc-a");
    expect(started).toHaveLength(1);

    session.chooseDialogueResponse(0); // "Bye" — no targetNodeId
    expect(session.activeDialogueNpcId).toBeUndefined();
    expect(ended).toEqual([{ npcId: "npc-a", treeId: "tree-a" }]);
  });

  it("saves and reloads GameState exactly, including inventory, flags, and current room", async () => {
    const storage = new MemoryStorage();
    const { stage, session } = await makeSession();

    session.setVerb("pick-up");
    tapAt(stage, 25, 25); // pick up key
    await vi_flush();
    session.setVerb("use");
    tapAt(stage, 125, 25); // unlock desk
    await vi_flush();

    const savedJson = session.state.toJSON();
    session.save(storage);

    const { session: reloaded } = await makeSession();
    expect(reloaded.state.toJSON()).not.toEqual(savedJson);

    const loaded: unknown[] = [];
    reloaded.events.on("game-loaded", (e) => loaded.push(e));
    await reloaded.load(storage);

    expect(reloaded.state.toJSON()).toEqual(savedJson);
    expect(reloaded.runtime.currentRoom?.id).toBe("room-a");
    expect(loaded).toEqual([{ key: "deme:save" }]);
  });
});

/**
 * Flushes pending `void this.handleHotspotInteract(...)` work before
 * assertions — including, now, a sandboxed Lua script run, which can take a
 * handful of event-loop turns the first time it cold-starts wasmoon's WASM
 * module. A single `setTimeout(0)` isn't reliably enough turns for that; loop
 * a few to stay robust without hardcoding a wall-clock duration.
 */
async function vi_flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
