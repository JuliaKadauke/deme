import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DialogueTree, Item, Npc, Room } from "@deme/content-schema";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, "..", "test", "fixtures");

function loadFixture<T>(dir: string, name: string): T {
  const file = path.join(fixturesDir, dir, `${name}.json`);
  return JSON.parse(readFileSync(file, "utf-8")) as T;
}

/** Loads a hand-written Room fixture from test/fixtures/rooms/<name>.json, for use in tests only. */
export function loadFixtureRoom(name: string): Room {
  return loadFixture<Room>("rooms", name);
}

/** Loads a hand-written Item fixture from test/fixtures/items/<name>.json, for use in tests only. */
export function loadFixtureItem(name: string): Item {
  return loadFixture<Item>("items", name);
}

/** Loads a hand-written Npc fixture from test/fixtures/npcs/<name>.json, for use in tests only. */
export function loadFixtureNpc(name: string): Npc {
  return loadFixture<Npc>("npcs", name);
}

/** Loads a hand-written DialogueTree fixture from test/fixtures/dialogue/<name>.json, for use in tests only. */
export function loadFixtureDialogueTree(name: string): DialogueTree {
  return loadFixture<DialogueTree>("dialogue", name);
}
