export const ENGINE_VERSION = "0.0.0";

// Scaffold placeholder retained for @deme/player's shell; superseded by GameRuntime below for actual rendering.
export function createEngine(): { version: string } {
  return { version: ENGINE_VERSION };
}

export {
  clampToPolygon,
  hitTestArea,
  pointInPolygon,
  pointInRect,
  type Point,
} from "./geometry.js";
export {
  Emitter,
  type DialogueEndedEvent,
  type DialogueLineEvent,
  type DialogueResponseOption,
  type DialogueStartedEvent,
  type EngineEventMap,
  type GameLoadedEvent,
  type GameSavedEvent,
  type HotspotInteractEvent,
  type InventoryUseTarget,
  type ItemAddedEvent,
  type ItemDeselectedEvent,
  type ItemPickedUpEvent,
  type ItemRemovedEvent,
  type ItemSelectedEvent,
  type ItemUseRequestedEvent,
  type ItemUsedEvent,
  type PlayerWalkEvent,
  type RoomExitEvent,
  type RoomLoadedEvent,
  type ScriptErrorEvent,
  type ScriptMessageEvent,
} from "./events.js";
export { Player, type PlayerOptions } from "./player.js";
export { RoomController } from "./room-controller.js";
export { RoomScene, type RoomSceneOptions, type TextureLoader } from "./room-scene.js";
export { GameRuntime, type GameRuntimeOptions, type RoomLoader } from "./game-runtime.js";
export { DEFAULT_VERB, VERB_TO_HOOK, VERBS, type Verb } from "./verbs.js";
export {
  GAME_STATE_VERSION,
  GameState,
  type GameStateData,
  type GameStateInit,
} from "./game-state.js";
export { evaluateCondition, applyEffects } from "./conditions.js";
export { Inventory } from "./inventory.js";
export { InventoryBar, type InventoryBarOptions } from "./inventory-bar.js";
export { DialogueRuntime } from "./dialogue-runtime.js";
export {
  DEFAULT_SAVE_KEY,
  MemoryStorage,
  clearSavedGameState,
  deserializeGameState,
  loadGameState,
  saveGameState,
  serializeGameState,
  type StorageLike,
} from "./save-load.js";
export { GameSession, type ContentLoaders, type GameSessionOptions } from "./game-session.js";
export {
  DEFAULT_LUA_SANDBOX_LIMITS,
  LuaInstructionBudgetExceededError,
  runSandboxedLua,
  setLuaWasmUri,
  type LuaApi,
  type LuaSandboxLimits,
} from "./lua-sandbox.js";
export { runInteractionScript, type ScriptActions } from "./script-runtime.js";
