import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { ErrorObject } from "ajv";
import { getValidatorForType, knownEntityTypes } from "./schemas.js";
import type {
  DialogueTree,
  Entity,
  EntityId,
  EntityType,
  Item,
  Npc,
  Room,
  ScriptRef,
} from "./types.js";

/**
 * A single, structured, actionable validation problem: which file, where in
 * that file (as a JSON pointer), what went wrong, and — where derivable —
 * what was expected vs. what was actually found. Shaped so an LLM authoring
 * agent can locate and fix the problem without a human in the loop.
 */
export interface ValidationIssue {
  file: string;
  /** JSON pointer into the file, e.g. "/hotspots/0/targetItemId". "/" means the whole document. */
  path: string;
  message: string;
  expected?: string;
  actual?: string;
}

export interface ValidationReport {
  valid: boolean;
  filesChecked: number;
  issues: ValidationIssue[];
}

interface LoadedEntity {
  file: string;
  data: Entity;
}

type EntityIndex = Map<EntityType, Map<EntityId, LoadedEntity>>;

function describeActual(data: unknown): string {
  if (data === undefined) return "undefined";
  if (data === null) return "null";
  if (typeof data === "string") return JSON.stringify(data);
  if (Array.isArray(data)) return "an array";
  if (typeof data === "object") return "an object";
  return String(data);
}

function describeAjvError(e: ErrorObject): { message: string; expected?: string; actual?: string } {
  switch (e.keyword) {
    case "required":
      return {
        message: `missing required property "${e.params.missingProperty}"`,
        expected: `property "${e.params.missingProperty}" to be present`,
      };
    case "type":
      return {
        message: e.message ?? "invalid type",
        expected: `type ${JSON.stringify(e.params.type)}`,
        actual: describeActual(e.data),
      };
    case "enum":
      return {
        message: `must be one of: ${e.params.allowedValues.join(", ")}`,
        expected: (e.params.allowedValues as unknown[]).join(" | "),
        actual: describeActual(e.data),
      };
    case "const":
      return {
        message: `must equal ${JSON.stringify(e.params.allowedValue)}`,
        expected: JSON.stringify(e.params.allowedValue),
        actual: describeActual(e.data),
      };
    case "pattern":
      return {
        message: `must match pattern ${e.params.pattern}`,
        expected: `a string matching ${e.params.pattern}`,
        actual: describeActual(e.data),
      };
    case "additionalProperties":
      return {
        message: `unexpected property "${e.params.additionalProperty}"`,
        expected: "no additional properties",
        actual: `property "${e.params.additionalProperty}"`,
      };
    case "oneOf": {
      const branches = Array.isArray(e.schema)
        ? (e.schema as { title?: string }[]).map((b, i) => b.title ?? `option ${i + 1}`)
        : [];
      return {
        message: `must match exactly one of the allowed shapes: ${branches.join(" or ")}`,
      };
    }
    case "minItems":
      return {
        message: e.message ?? "too few items",
        expected: `at least ${e.params.limit} item(s)`,
      };
    default:
      return { message: e.message ?? "invalid value" };
  }
}

function ajvErrorsToIssues(errors: ErrorObject[], file: string): ValidationIssue[] {
  // Drop the per-branch noise ajv emits for each failing oneOf alternative
  // (schemaPath containing ".../oneOf/<n>/...") and keep just the single
  // summary error at the oneOf keyword itself, enriched with branch titles.
  return errors
    .filter((e) => !/\/oneOf\/\d+\//.test(e.schemaPath))
    .map((e) => ({
      file,
      path: e.instancePath === "" ? "/" : e.instancePath,
      ...describeAjvError(e),
    }));
}

/** Validates a single entity's shape against the schema for its `type`. Does not check any references. */
function validateAjvShape(data: unknown, file: string): ValidationIssue[] {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return [
      {
        file,
        path: "/",
        message: "content file must contain a JSON object",
        expected: "an object",
      },
    ];
  }

  const type = (data as { type?: unknown }).type;
  if (typeof type !== "string") {
    return [
      {
        file,
        path: "/type",
        message: 'missing or non-string required property "type"',
        expected: `one of: ${knownEntityTypes().join(", ")}`,
        actual: describeActual(type),
      },
    ];
  }

  const validate = getValidatorForType(type);
  if (!validate) {
    return [
      {
        file,
        path: "/type",
        message: `unknown entity type ${JSON.stringify(type)}`,
        expected: `one of: ${knownEntityTypes().join(", ")}`,
        actual: JSON.stringify(type),
      },
    ];
  }

  const valid = validate(data);
  return valid ? [] : ajvErrorsToIssues(validate.errors ?? [], file);
}

/** Validates a single entity's shape against the schema for its `type`, plus references that stay within the same file (no cross-file lookup). */
export function validateEntityShape(data: unknown, file = "<inline>"): ValidationIssue[] {
  const shapeIssues = validateAjvShape(data, file);
  if (shapeIssues.length > 0) return shapeIssues;
  return [...shapeIssues, ...checkLocalReferences(data as Entity, file)];
}

function checkLocalReferences(entity: Entity, file: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (entity.type === "room") {
    const room = entity as Room;
    const hotspotIds = new Set<string>();
    room.hotspots.forEach((hotspot, i) => {
      if (hotspotIds.has(hotspot.id)) {
        issues.push({
          file,
          path: `/hotspots/${i}/id`,
          message: `duplicate hotspot id ${JSON.stringify(hotspot.id)} within this room`,
          expected: "a hotspot id unique within the room",
          actual: JSON.stringify(hotspot.id),
        });
      }
      hotspotIds.add(hotspot.id);
    });
    (room.exits ?? []).forEach((exit, i) => {
      if (!hotspotIds.has(exit.hotspotId)) {
        issues.push({
          file,
          path: `/exits/${i}/hotspotId`,
          message: `exit references hotspotId ${JSON.stringify(exit.hotspotId)}, which is not defined in this room's hotspots`,
          expected: `one of: ${[...hotspotIds].join(", ") || "(no hotspots defined)"}`,
          actual: JSON.stringify(exit.hotspotId),
        });
      }
    });
  }

  if (entity.type === "dialogueTree") {
    const tree = entity as DialogueTree;
    const nodeIds = new Set<string>();
    tree.nodes.forEach((node, i) => {
      if (nodeIds.has(node.id)) {
        issues.push({
          file,
          path: `/nodes/${i}/id`,
          message: `duplicate dialogue node id ${JSON.stringify(node.id)} within this tree`,
          expected: "a node id unique within the tree",
          actual: JSON.stringify(node.id),
        });
      }
      nodeIds.add(node.id);
    });
    if (!nodeIds.has(tree.rootNodeId)) {
      issues.push({
        file,
        path: "/rootNodeId",
        message: `rootNodeId ${JSON.stringify(tree.rootNodeId)} is not defined in this tree's nodes`,
        expected: `one of: ${[...nodeIds].join(", ") || "(no nodes defined)"}`,
        actual: JSON.stringify(tree.rootNodeId),
      });
    }
    tree.nodes.forEach((node, i) => {
      (node.responses ?? []).forEach((response, j) => {
        if (response.targetNodeId !== undefined && !nodeIds.has(response.targetNodeId)) {
          issues.push({
            file,
            path: `/nodes/${i}/responses/${j}/targetNodeId`,
            message: `response targetNodeId ${JSON.stringify(response.targetNodeId)} is not defined in this tree's nodes`,
            expected: `one of: ${[...nodeIds].join(", ")}`,
            actual: JSON.stringify(response.targetNodeId),
          });
        }
      });
    });
  }

  return issues;
}

function collectScriptRefs(entity: Entity): { path: string; ref: ScriptRef }[] {
  const refs: { path: string; ref: ScriptRef }[] = [];

  if (entity.type === "room") {
    entity.hotspots.forEach((hotspot, i) => {
      (hotspot.interactions ?? []).forEach((ref, j) => {
        refs.push({ path: `/hotspots/${i}/interactions/${j}`, ref });
      });
    });
  } else if (entity.type === "item" || entity.type === "npc") {
    (entity.interactions ?? []).forEach((ref, i) => {
      refs.push({ path: `/interactions/${i}`, ref });
    });
  } else if (entity.type === "dialogueTree") {
    entity.nodes.forEach((node, i) => {
      (node.responses ?? []).forEach((response, j) => {
        if (response.script) {
          refs.push({ path: `/nodes/${i}/responses/${j}/script`, ref: response.script });
        }
      });
    });
  }

  return refs;
}

function checkCrossFileReferences(index: EntityIndex): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const idsOf = (type: EntityType): Map<EntityId, LoadedEntity> => index.get(type) ?? new Map();

  const refCheck = (
    file: string,
    jsonPath: string,
    targetType: EntityType,
    id: EntityId | undefined,
  ): void => {
    if (id === undefined) return;
    if (!idsOf(targetType).has(id)) {
      issues.push({
        file,
        path: jsonPath,
        message: `references ${targetType} id ${JSON.stringify(id)}, which does not exist`,
        expected: `an existing ${targetType} id`,
        actual: JSON.stringify(id),
      });
    }
  };

  for (const [type, entities] of index) {
    for (const { file, data } of entities.values()) {
      if (type === "room") {
        const room = data as Room;
        room.hotspots.forEach((hotspot, i) => {
          refCheck(file, `/hotspots/${i}/targetItemId`, "item", hotspot.targetItemId);
          refCheck(file, `/hotspots/${i}/targetNpcId`, "npc", hotspot.targetNpcId);
        });
        (room.npcIds ?? []).forEach((id, i) => refCheck(file, `/npcIds/${i}`, "npc", id));
        (room.itemIds ?? []).forEach((id, i) => refCheck(file, `/itemIds/${i}`, "item", id));
        (room.exits ?? []).forEach((exit, i) =>
          refCheck(file, `/exits/${i}/targetRoomId`, "room", exit.targetRoomId),
        );
      }

      if (type === "item") {
        const item = data as Item;
        (item.combinesWithItemIds ?? []).forEach((id, i) =>
          refCheck(file, `/combinesWithItemIds/${i}`, "item", id),
        );
      }

      if (type === "npc") {
        const npc = data as Npc;
        refCheck(file, "/dialogueTreeId", "dialogueTree", npc.dialogueTreeId);
      }

      if (type === "dialogueTree") {
        const tree = data as DialogueTree;
        refCheck(file, "/npcId", "npc", tree.npcId);
      }

      for (const { path: refPath, ref } of collectScriptRefs(data)) {
        refCheck(file, `${refPath}/scriptId`, "script", ref.scriptId);
      }
    }
  }

  return issues;
}

function findJsonFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJsonFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Validates every *.json file under `dir` against the entity schemas, plus
 * referential integrity (both within a file and across files in `dir`).
 */
export function validateContentDir(dir: string): ValidationReport {
  const files = findJsonFiles(dir);
  const issues: ValidationIssue[] = [];
  const index: EntityIndex = new Map();

  for (const file of files) {
    const relFile = path.relative(process.cwd(), file);
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(file, "utf-8"));
    } catch (err) {
      issues.push({
        file: relFile,
        path: "/",
        message: `invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    const shapeIssues = validateAjvShape(data, relFile);
    issues.push(...shapeIssues);
    if (shapeIssues.length > 0) continue;

    const entity = data as Entity;
    // Local-reference issues don't block indexing: the entity is still
    // well-typed and safe to cross-reference from other files, so we keep
    // going instead of hiding subsequent cross-file issues behind it.
    issues.push(...checkLocalReferences(entity, relFile));

    let byId = index.get(entity.type);
    if (!byId) {
      byId = new Map();
      index.set(entity.type, byId);
    }
    const existing = byId.get(entity.id);
    if (existing) {
      issues.push({
        file: relFile,
        path: "/id",
        message: `duplicate ${entity.type} id ${JSON.stringify(entity.id)}, already defined in ${existing.file}`,
        expected: `an id unique among ${entity.type} entities`,
        actual: JSON.stringify(entity.id),
      });
      continue;
    }
    byId.set(entity.id, { file: relFile, data: entity });
  }

  issues.push(...checkCrossFileReferences(index));

  return { valid: issues.length === 0, filesChecked: files.length, issues };
}

export function isDirectory(target: string): boolean {
  return statSync(target).isDirectory();
}
