/**
 * Hand-written TypeScript types mirroring packages/content-schema/schemas/*.schema.json.
 * Keep these in sync with the schemas when either changes.
 */

/** Stable, explicit identifier used for all cross-entity references. Lowercase kebab-case. */
export type EntityId = string;

/** The interaction event that triggers a script. */
export type Hook = "on-look" | "on-use" | "on-talk" | "on-combine";

/**
 * A reference to a Lua script attached to an interaction hook. Exactly one of
 * `scriptId` (a reference to a Script entity) or `source` (inline Lua source)
 * is present.
 */
export type ScriptRef = { hook: Hook } & (
  { scriptId: EntityId; source?: never } | { scriptId?: never; source: string }
);

/** An ordered list of [x, y] vertices in the room's background image coordinate space. */
export type PolygonPoints = [number, number][];

export type HotspotArea =
  | { shape: "rect"; x: number; y: number; width: number; height: number }
  | { shape: "polygon"; points: PolygonPoints };

/** A clickable/interactive region embedded within a Room. */
export interface Hotspot {
  id: EntityId;
  name: string;
  description?: string;
  area: HotspotArea;
  /** References an Item entity associated with this hotspot. */
  targetItemId?: EntityId;
  /** References an NPC entity standing at this hotspot. */
  targetNpcId?: EntityId;
  interactions?: ScriptRef[];
}

/** A single navigable room/screen. content/rooms/<id>.json */
export interface Room {
  id: EntityId;
  type: "room";
  name: string;
  description?: string;
  background?: string;
  hotspots: Hotspot[];
  /** The polygon where the player character can walk. Omit for rooms with no player movement. */
  walkBox?: PolygonPoints;
  /** References NPC entities present in this room. */
  npcIds?: EntityId[];
  /** References Item entities initially present in this room. */
  itemIds?: EntityId[];
  exits?: { hotspotId: EntityId; targetRoomId: EntityId }[];
}

/** An item entity. content/items/<id>.json */
export interface Item {
  id: EntityId;
  type: "item";
  name: string;
  description?: string;
  portable?: boolean;
  icon?: string;
  /** References other Item entities this item can be combined with. */
  combinesWithItemIds?: EntityId[];
  interactions?: ScriptRef[];
}

/** A non-player character entity. content/npcs/<id>.json */
export interface Npc {
  id: EntityId;
  type: "npc";
  name: string;
  description?: string;
  sprite?: string;
  /** References the DialogueTree entity started when this NPC is talked to. */
  dialogueTreeId?: EntityId;
  interactions?: ScriptRef[];
}

/** A single line of dialogue and its possible player responses. */
export interface DialogueNode {
  id: EntityId;
  speaker: "npc" | "player";
  text: string;
  responses?: {
    text: string;
    /** References another node's id within the same dialogue tree. Omit to end the dialogue. */
    targetNodeId?: EntityId;
    script?: ScriptRef;
  }[];
}

/** A dialogue tree entity. content/dialogues/<id>.json */
export interface DialogueTree {
  id: EntityId;
  type: "dialogueTree";
  /** References the NPC entity this dialogue tree belongs to. */
  npcId?: EntityId;
  rootNodeId: EntityId;
  nodes: DialogueNode[];
}

/** A shared, reusable Lua script entity, referenced via ScriptRef.scriptId. content/scripts/<id>.json */
export interface Script {
  id: EntityId;
  type: "script";
  description?: string;
  source: string;
}

export type Entity = Room | Item | Npc | DialogueTree | Script;

export type EntityType = Entity["type"];
