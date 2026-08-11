import type { EntityId } from "@deme/content-schema";
import type { GameState } from "./game-state.js";
import { runSandboxedLua, type LuaSandboxLimits } from "./lua-sandbox.js";

/** Engine-side effects a script can trigger beyond flags (which it reads/writes on `GameState` directly). */
export interface ScriptActions {
  giveItem(itemId: EntityId): void;
  removeItem(itemId: EntityId): void;
  changeRoom(roomId: EntityId): void;
  describe(text: string): void;
}

function requireEntityId(value: unknown, fnName: string): EntityId {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${fnName}: expected a non-empty string id, got ${JSON.stringify(value)}`);
  }
  return value;
}

function requireString(value: unknown, fnName: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${fnName}: expected a string, got ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * Runs a ScriptRef's Lua `source` in the {@link runSandboxedLua} sandbox,
 * with exactly the whitelisted game-state accessor/action functions the
 * issue calls for bound to `state`/`actions`. This is the concrete API
 * documented in docs/authoring-guide.md and used throughout content/ and
 * the engine's own test fixtures:
 *
 * - **Read**: `hasFlag(flagId)`, `hasItem(itemId)`, `currentRoomId()`.
 * - **Act**: `setFlag(flagId)`, `clearFlag(flagId)`, `giveItem(itemId)`,
 *   `removeItem(itemId)`, `gotoRoom(roomId)`, `describe(text)`.
 *
 * Nothing else is reachable — see lua-sandbox.ts for why the environment
 * has no standard library at all, not even `print`/`pairs`.
 */
export function runInteractionScript(
  source: string,
  state: GameState,
  actions: ScriptActions,
  limits?: Partial<LuaSandboxLimits>,
): Promise<void> {
  return runSandboxedLua(
    source,
    {
      hasFlag: (flagId: unknown) => state.hasFlag(requireEntityId(flagId, "hasFlag")),
      hasItem: (itemId: unknown) => state.hasItem(requireEntityId(itemId, "hasItem")),
      currentRoomId: () => state.currentRoomId,
      setFlag: (flagId: unknown) => state.setFlag(requireEntityId(flagId, "setFlag")),
      clearFlag: (flagId: unknown) => state.clearFlag(requireEntityId(flagId, "clearFlag")),
      giveItem: (itemId: unknown) => actions.giveItem(requireEntityId(itemId, "giveItem")),
      removeItem: (itemId: unknown) => actions.removeItem(requireEntityId(itemId, "removeItem")),
      gotoRoom: (roomId: unknown) => actions.changeRoom(requireEntityId(roomId, "gotoRoom")),
      describe: (text: unknown) => actions.describe(requireString(text, "describe")),
    },
    limits,
  );
}
