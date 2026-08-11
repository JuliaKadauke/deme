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
  type EngineEventMap,
  type HotspotInteractEvent,
  type PlayerWalkEvent,
  type RoomExitEvent,
  type RoomLoadedEvent,
} from "./events.js";
export { Player, type PlayerOptions } from "./player.js";
export { RoomController } from "./room-controller.js";
export { RoomScene, type RoomSceneOptions, type TextureLoader } from "./room-scene.js";
export { GameRuntime, type GameRuntimeOptions, type RoomLoader } from "./game-runtime.js";
export { DEFAULT_VERB, VERB_TO_HOOK, VERBS, type Verb } from "./verbs.js";
