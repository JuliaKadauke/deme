import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Room } from "@deme/content-schema";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoomsDir = path.join(here, "..", "test", "fixtures", "rooms");

/** Loads a hand-written Room fixture from test/fixtures/rooms/<name>.json, for use in tests only. */
export function loadFixtureRoom(name: string): Room {
  const file = path.join(fixtureRoomsDir, `${name}.json`);
  return JSON.parse(readFileSync(file, "utf-8")) as Room;
}
