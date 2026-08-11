import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv, { type ValidateFunction } from "ajv";
import type { EntityType } from "./types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const schemasDir = path.join(here, "..", "schemas");

const SCHEMA_FILES = [
  "common.schema.json",
  "hotspot.schema.json",
  "dialogue-node.schema.json",
  "room.schema.json",
  "item.schema.json",
  "npc.schema.json",
  "dialogue-tree.schema.json",
  "script.schema.json",
  "entity.schema.json",
];

/** Maps the discriminating `type` field of a content file to its concrete schema's $id. */
export const ENTITY_SCHEMA_ID: Record<EntityType, string> = {
  room: "https://deme.dev/schemas/room.schema.json",
  item: "https://deme.dev/schemas/item.schema.json",
  npc: "https://deme.dev/schemas/npc.schema.json",
  dialogueTree: "https://deme.dev/schemas/dialogue-tree.schema.json",
  script: "https://deme.dev/schemas/script.schema.json",
};

export function loadSchema(fileName: string): object {
  return JSON.parse(readFileSync(path.join(schemasDir, fileName), "utf-8"));
}

function buildAjv(): Ajv {
  // strictRequired is disabled: the scriptRef oneOf branches intentionally
  // list `required` without a matching local `properties` entry (the
  // properties live on the parent scriptRef schema), which is how ajv
  // recommends expressing "exactly one of A or B" — see
  // https://ajv.js.org/strict-mode.html#defined-required-properties
  const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false, verbose: true });
  for (const file of SCHEMA_FILES) {
    ajv.addSchema(loadSchema(file));
  }
  return ajv;
}

let ajvInstance: Ajv | undefined;

function getAjv(): Ajv {
  if (!ajvInstance) {
    ajvInstance = buildAjv();
  }
  return ajvInstance;
}

/**
 * Returns the compiled validator for a given content entity `type`
 * (e.g. "room"), or undefined if `type` is not a known entity type.
 */
export function getValidatorForType(type: string): ValidateFunction | undefined {
  const schemaId = ENTITY_SCHEMA_ID[type as EntityType];
  if (!schemaId) return undefined;
  return getAjv().getSchema(schemaId);
}

export function knownEntityTypes(): EntityType[] {
  return Object.keys(ENTITY_SCHEMA_ID) as EntityType[];
}
