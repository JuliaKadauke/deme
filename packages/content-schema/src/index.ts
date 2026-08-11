export { loadSchema, knownEntityTypes } from "./schemas.js";
export type {
  DialogueNode,
  DialogueTree,
  Entity,
  EntityId,
  EntityType,
  Hook,
  Hotspot,
  HotspotArea,
  Item,
  Npc,
  PolygonPoints,
  Room,
  Script,
  ScriptRef,
} from "./types.js";
export {
  validateContentDir,
  validateEntityShape,
  isDirectory,
  type ValidationIssue,
  type ValidationReport,
} from "./validator.js";
