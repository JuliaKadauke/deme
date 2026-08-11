import type { DialogueTree, EntityId, Item, Npc, Room, Script } from "@deme/content-schema";
import type { ContentLoaders, TextureLoader } from "@deme/engine";
import { Assets } from "pixi.js";

/**
 * Loads the bundled demo game (content/demo-escape-room) via Vite's
 * `import.meta.glob`, resolved and code-split at build time — not a runtime
 * `fetch()` against content/. This keeps every content JSON file and asset a
 * same-origin, bundled part of play.html's own build output, which sidesteps
 * play.html's CSP (`connect-src`/`img-src 'self'` only, see
 * apps/player/README.md) and the CORS concerns that a cross-origin content
 * host would raise, entirely rather than working around them.
 */

const CONTENT_ROOT = "../../../content/demo-escape-room/";

interface JsonEntity {
  id: EntityId;
  type: string;
}

const jsonModules = import.meta.glob("../../../content/demo-escape-room/**/*.json", {
  eager: true,
  import: "default",
}) as Record<string, JsonEntity>;

const imageUrls = import.meta.glob("../../../content/demo-escape-room/assets/**/*.png", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

function indexByTypeAndId<T extends JsonEntity>(type: T["type"]): Map<EntityId, T> {
  const map = new Map<EntityId, T>();
  for (const data of Object.values(jsonModules)) {
    if (data.type === type) map.set(data.id, data as T);
  }
  return map;
}

const roomsById = indexByTypeAndId<Room>("room");
const itemsById = indexByTypeAndId<Item>("item");
const npcsById = indexByTypeAndId<Npc>("npc");
const dialogueTreesById = indexByTypeAndId<DialogueTree>("dialogueTree");
const scriptsById = indexByTypeAndId<Script>("script");

function required<T>(map: Map<EntityId, T>, id: EntityId, kind: string): T {
  const value = map.get(id);
  if (!value) throw new Error(`demo content: unknown ${kind} id ${JSON.stringify(id)}`);
  return value;
}

/** The room the demo game starts in — see content/demo-escape-room/rooms/study.json. */
export const DEMO_START_ROOM_ID: EntityId = "study";

export const demoContentLoaders: ContentLoaders = {
  loadRoom: async (id) => required(roomsById, id, "room"),
  loadItem: async (id) => required(itemsById, id, "item"),
  loadNpc: async (id) => required(npcsById, id, "npc"),
  loadDialogueTree: async (id) => required(dialogueTreesById, id, "dialogueTree"),
  loadScript: async (id) => required(scriptsById, id, "script"),
};

/** Resolves a content-relative asset path (e.g. a Room's `background`) to its bundled build URL. */
export function resolveDemoAssetUrl(relativePath: string): string {
  const key = `${CONTENT_ROOT}${relativePath}`;
  const url = imageUrls[key];
  if (!url)
    throw new Error(`demo content: no bundled asset for path ${JSON.stringify(relativePath)}`);
  return url;
}

export const loadDemoTexture: TextureLoader = (path) => Assets.load(resolveDemoAssetUrl(path));
