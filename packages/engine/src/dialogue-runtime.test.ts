import type { DialogueTree } from "@deme/content-schema";
import { describe, expect, it } from "vitest";
import { DialogueRuntime } from "./dialogue-runtime.js";
import { GameState } from "./game-state.js";

const tree: DialogueTree = {
  id: "butler-intro",
  type: "dialogueTree",
  npcId: "butler",
  rootNodeId: "greet",
  nodes: [
    {
      id: "greet",
      speaker: "npc",
      text: "Good evening. How may I be of service?",
      responses: [
        { text: "Have you seen a key around here?", targetNodeId: "about-key" },
        {
          text: "Did you unlock the desk yet?",
          targetNodeId: "about-desk",
          condition: { requiredFlags: ["desk-unlocked"] },
        },
        { text: "Never mind.", effects: { setFlags: ["met-butler"] } },
      ],
    },
    {
      id: "about-key",
      speaker: "npc",
      text: "Why yes, I believe I saw one glinting on the shelf.",
      responses: [{ text: "Thank you." }],
    },
    {
      id: "about-desk",
      speaker: "npc",
      text: "Indeed, well done.",
      responses: [{ text: "Thanks." }],
    },
  ],
};

function makeRuntime(flags: string[] = []) {
  const state = new GameState({ currentRoomId: "study", flags });
  const runtime = new DialogueRuntime("butler", tree, state);
  return { state, runtime };
}

describe("DialogueRuntime", () => {
  it("is ended before start() is called", () => {
    const { runtime } = makeRuntime();
    expect(runtime.isEnded).toBe(true);
    expect(runtime.currentNode).toBeUndefined();
  });

  it("starts at the root node and fires dialogue-started with gated responses filtered out", () => {
    const { runtime } = makeRuntime();
    const started: unknown[] = [];
    runtime.events.on("dialogue-started", (e) => started.push(e));

    runtime.start();

    expect(runtime.isEnded).toBe(false);
    expect(runtime.currentNode?.id).toBe("greet");
    expect(runtime.availableResponses.map((r) => r.text)).toEqual([
      "Have you seen a key around here?",
      "Never mind.",
    ]);
    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({ npcId: "butler", treeId: "butler-intro" });
  });

  it("includes a gated response once its condition is met", () => {
    const { runtime } = makeRuntime(["desk-unlocked"]);
    runtime.start();

    expect(runtime.availableResponses.map((r) => r.text)).toEqual([
      "Have you seen a key around here?",
      "Did you unlock the desk yet?",
      "Never mind.",
    ]);
  });

  it("advances to the target node and fires dialogue-line on choosing a branching response", () => {
    const { runtime } = makeRuntime();
    runtime.start();

    const lines: unknown[] = [];
    runtime.events.on("dialogue-line", (e) => lines.push(e));

    runtime.choose(0); // "Have you seen a key around here?"

    expect(runtime.currentNode?.id).toBe("about-key");
    expect(runtime.isEnded).toBe(false);
    expect(lines).toHaveLength(1);
  });

  it("ends the dialogue and fires dialogue-ended when the chosen response has no targetNodeId", () => {
    const { runtime, state } = makeRuntime();
    runtime.start();

    const ended: unknown[] = [];
    runtime.events.on("dialogue-ended", (e) => ended.push(e));

    runtime.choose(1); // "Never mind." — applies effects, ends dialogue

    expect(runtime.isEnded).toBe(true);
    expect(runtime.currentNode).toBeUndefined();
    expect(state.hasFlag("met-butler")).toBe(true);
    expect(ended).toEqual([{ npcId: "butler", treeId: "butler-intro" }]);
  });

  it("ignores choose() once ended or with an out-of-range index", () => {
    const { runtime } = makeRuntime();
    runtime.start();
    runtime.choose(99); // out of range — no-op
    expect(runtime.isEnded).toBe(false);

    runtime.choose(1); // ends
    expect(runtime.isEnded).toBe(true);

    runtime.choose(0); // already ended — no-op, must not throw
    expect(runtime.isEnded).toBe(true);
  });

  it("can be restarted after ending", () => {
    const { runtime } = makeRuntime();
    runtime.start();
    runtime.choose(1);
    expect(runtime.isEnded).toBe(true);

    runtime.start();
    expect(runtime.isEnded).toBe(false);
    expect(runtime.currentNode?.id).toBe("greet");
  });
});
