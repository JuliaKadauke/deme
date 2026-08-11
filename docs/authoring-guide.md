# Content authoring guide

This is the canonical spec for authoring deme game content — rooms, items,
NPCs, dialogue trees, and Lua scripts. It is written for **both human and AI
authors**; AI agents are expected to be a primary source of content, so every
rule here is written to be mechanically checkable by the validator described
below, not just human-readable convention.

If you are an AI agent authoring content: after writing or editing files, run
`deme validate <path> --json` and use the structured `issues[]` it prints to
fix problems yourself — file, JSON pointer path, message, and (where
derivable) expected vs. actual — without waiting for a human to interpret
errors for you.

## Core rules

1. **One entity per JSON file.** A room, an item, an NPC, a dialogue tree, or
   a script — never more than one top-level entity per file.
2. **Every entity has an explicit string `id`** (lowercase kebab-case,
   pattern `^[a-z0-9][a-z0-9-]*$`) and a `type` field naming which schema it
   follows (`room`, `item`, `npc`, `dialogueTree`, or `script`).
3. **All cross-entity references are explicit `id` strings.** There is no
   positional or implicit linking (no "the next file", no "the third item in
   the array means..."). An `id` reference is only valid if an entity with
   that `id` and the expected type actually exists somewhere in the content
   directory — the validator checks this (see below).
4. **Content is data, never code.** Rules and interactions are validated
   JSON. The only place executable logic appears is inside a `source` string
   or a referenced script's `source` — both are Lua 5.4, run in a sandboxed
   VM by the engine (see [architecture.md](./architecture.md)).

## File layout

```
content/<game-name>/
  rooms/<id>.json         # type: "room"
  items/<id>.json         # type: "item"
  npcs/<id>.json          # type: "npc"
  dialogue/<id>.json      # type: "dialogueTree"
  scripts/<id>.json       # type: "script"
  assets/                 # images, audio — referenced by path from entities
```

The directory names under `<game-name>/` are convention, not something the
validator enforces structurally — it discovers every `*.json` file
recursively and dispatches on each file's own `type` field. Still, follow the
convention: it's what other tooling (and other authors, human or AI) expect.

## Validator CLI

```
deme validate <path> [--json]
```

- `<path>` is a content directory (recommended — validates per-file schema
  shape _and_ referential integrity across the whole directory) or a single
  `*.json` file (schema shape plus references that stay within that file
  only; cross-file references can't be checked without the full directory).
- `--json` prints `{ valid, filesChecked, issues[] }` instead of the default
  human-readable text. Each issue is `{ file, path, message, expected?,
actual? }`, where `path` is a JSON pointer into the file (e.g.
  `/hotspots/0/targetItemId`). Exit code is `0` if valid, `1` otherwise.

Two classes of problem are caught:

- **Schema shape** — a file doesn't match the JSON Schema for its declared
  `type`: missing required fields, wrong types, bad `id` pattern, unknown
  `type`, a `scriptRef` with neither or both of `scriptId`/`source`, etc.
- **Referential integrity** — a file is shaped correctly but points at an
  `id` that doesn't exist: a hotspot's `targetItemId`, an NPC's
  `dialogueTreeId`, a dialogue response's `targetNodeId`, a `scriptRef`'s
  `scriptId`, duplicate `id`s across files of the same type, and more (see
  the schema reference below for the full set of reference fields).

## Schema reference

All schemas live in
[`packages/content-schema/schemas`](../packages/content-schema/schemas) as
the source of truth; hand-written TypeScript types mirroring them live in
[`packages/content-schema/src/types.ts`](../packages/content-schema/src/types.ts)
and are exported from `@deme/content-schema`. This section is a narrative
summary — the JSON Schema files are authoritative if anything here drifts.

### Common building blocks (`common.schema.json`)

- **`entityId`** — a string matching `^[a-z0-9][a-z0-9-]*$`. Used for every
  `id` field and every cross-entity reference field.
- **`hook`** — one of `"on-look"`, `"on-use"`, `"on-talk"`, `"on-combine"`.
  The interaction event a script is attached to.
- **`scriptRef`** — `{ hook, scriptId? , source?, condition?, effects? }`.
  Exactly one of:
  - `scriptId`: references a `content/scripts/*.json` entity's `id`.
  - `source`: inline Lua 5.4 source, self-contained in this file.

  A `scriptRef` never declares neither or both — the validator rejects both
  cases. `condition`/`effects` are optional and independent of
  `scriptId`/`source` — see **`stateCondition`**/**`stateEffect`** below.

- **`stateCondition`** — `{ requiredFlags?, forbiddenFlags?, requiredItemIds? }`
  (all arrays of ids, all optional). A declarative gate, evaluated directly
  by `@deme/engine` against the current game state (flags + inventory) —
  plain data, not code, so it doesn't run afoul of rule 4 above. Used on a
  `scriptRef` (only that interaction entry applies once its condition holds)
  and on a dialogue response (only offered to the player once its condition
  holds). This exists as the interim mechanism for "gate this by flags/items
  the player has" ahead of the Lua scripting engine landing — `source`/
  `scriptId` remain reserved for arbitrary logic once that engine exists.
- **`stateEffect`** — `{ setFlags?, clearFlags? }` (both arrays of flag ids,
  optional). A declarative game-state mutation applied by `@deme/engine` when
  a gated `scriptRef` interaction fires or a dialogue response is chosen.

### Hotspot (embedded in `room.hotspots[]`, `hotspot.schema.json`)

Not a standalone content file. A clickable region within a room's background.

| field          | required | notes                                                                                   |
| -------------- | -------- | --------------------------------------------------------------------------------------- |
| `id`           | yes      | unique within the owning room; referenced by `exits[].hotspotId`                        |
| `name`         | yes      |                                                                                         |
| `description`  | no       |                                                                                         |
| `area`         | yes      | `{shape:"rect",x,y,width,height}` or `{shape:"polygon",points:[[x,y],...]}` (≥3 points) |
| `targetItemId` | no       | references an `item` entity                                                             |
| `targetNpcId`  | no       | references an `npc` entity                                                              |
| `interactions` | no       | array of `scriptRef`                                                                    |

### Room (`content/rooms/<id>.json`, `room.schema.json`)

| field         | required | notes                                                                                                                                   |
| ------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `type`  | yes      | `type: "room"`                                                                                                                          |
| `name`        | yes      |                                                                                                                                         |
| `description` | no       |                                                                                                                                         |
| `background`  | no       | asset path                                                                                                                              |
| `hotspots`    | yes      | array of Hotspot (may be empty)                                                                                                         |
| `walkBox`     | no       | polygon (≥3 `[x,y]` points) the player character can walk within; omit for rooms with no player movement                                |
| `npcIds`      | no       | references `npc` entities present in the room                                                                                           |
| `itemIds`     | no       | references `item` entities present in the room (not on a hotspot)                                                                       |
| `exits`       | no       | array of `{hotspotId, targetRoomId}` — `hotspotId` must be one of this room's own hotspot ids; `targetRoomId` references another `room` |

### Item (`content/items/<id>.json`, `item.schema.json`)

| field                 | required | notes                            |
| --------------------- | -------- | -------------------------------- |
| `id`, `type`          | yes      | `type: "item"`                   |
| `name`                | yes      |                                  |
| `description`         | no       |                                  |
| `portable`            | no       | boolean, default `true`          |
| `icon`                | no       | asset path                       |
| `combinesWithItemIds` | no       | references other `item` entities |
| `interactions`        | no       | array of `scriptRef`             |

### NPC (`content/npcs/<id>.json`, `npc.schema.json`)

| field            | required | notes                                                                 |
| ---------------- | -------- | --------------------------------------------------------------------- |
| `id`, `type`     | yes      | `type: "npc"`                                                         |
| `name`           | yes      |                                                                       |
| `description`    | no       |                                                                       |
| `sprite`         | no       | asset path                                                            |
| `dialogueTreeId` | no       | references a `dialogueTree` entity started when this NPC is talked to |
| `interactions`   | no       | array of `scriptRef` (e.g. `on-look`)                                 |

### DialogueNode (embedded in `dialogueTree.nodes[]`, `dialogue-node.schema.json`)

Not a standalone content file.

| field       | required | notes                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | yes      | unique within the owning tree                                                                                                                                                                                                                                                                                                                                                                           |
| `speaker`   | yes      | `"npc"` or `"player"`                                                                                                                                                                                                                                                                                                                                                                                   |
| `text`      | yes      |                                                                                                                                                                                                                                                                                                                                                                                                         |
| `responses` | no       | array of `{text, targetNodeId?, script?, condition?, effects?}`. Omit `targetNodeId` to end the dialogue after this response; otherwise it must reference another node `id` in the same tree. `script` is an optional `scriptRef` run when the response is chosen. `condition` (a `stateCondition`) hides this response until it holds; `effects` (a `stateEffect`) applies when the player chooses it. |

### DialogueTree (`content/dialogue/<id>.json`, `dialogue-tree.schema.json`)

| field        | required | notes                                                       |
| ------------ | -------- | ----------------------------------------------------------- |
| `id`, `type` | yes      | `type: "dialogueTree"`                                      |
| `npcId`      | no       | references the owning `npc` entity                          |
| `rootNodeId` | yes      | references a node `id` in `nodes[]` — where dialogue starts |
| `nodes`      | yes      | array of DialogueNode, at least one                         |

### Script (`content/scripts/<id>.json`, `script.schema.json`)

| field         | required | notes                                          |
| ------------- | -------- | ---------------------------------------------- |
| `id`, `type`  | yes      | `type: "script"`                               |
| `description` | no       |                                                |
| `source`      | yes      | Lua 5.4 source, run in the sandboxed engine VM |

Referenced from any `scriptRef` via `scriptId`, letting multiple
interactions share one script instead of duplicating inline `source`.

## Worked example: a room, an item, an NPC, and a dialogue tree

This is a small locked-desk puzzle: a study with a butler NPC, a brass key on
a shelf, and a locked desk that needs the key. It exercises every entity type
and both forms of `scriptRef` (inline `source` and shared `scriptId`). The
identical files live under
[`packages/content-schema/test/fixtures/valid`](../packages/content-schema/test/fixtures/valid)
and are checked by the validator's test suite — this example passes `deme
validate` as-is.

`content/rooms/study.json`:

```json
{
  "id": "study",
  "type": "room",
  "name": "The Study",
  "description": "A dusty study with a locked writing desk and heavy velvet curtains.",
  "background": "assets/rooms/study/background.png",
  "hotspots": [
    {
      "id": "desk",
      "name": "Writing Desk",
      "description": "A heavy oak desk with a small brass lock.",
      "area": { "shape": "rect", "x": 120, "y": 260, "width": 160, "height": 90 },
      "interactions": [
        {
          "hook": "on-look",
          "source": "describe(\"A locked writing desk. The keyhole looks like it wants a small brass key.\")"
        },
        { "hook": "on-use", "scriptId": "unlock-desk" }
      ]
    },
    {
      "id": "butler-spot",
      "name": "Jeeves",
      "targetNpcId": "butler",
      "area": { "shape": "rect", "x": 400, "y": 180, "width": 100, "height": 220 },
      "interactions": [
        {
          "hook": "on-look",
          "source": "describe(\"Jeeves stands ready to help, if asked politely.\")"
        }
      ]
    },
    {
      "id": "shelf",
      "name": "Shelf",
      "targetItemId": "brass-key",
      "area": { "shape": "rect", "x": 20, "y": 100, "width": 60, "height": 40 },
      "interactions": [
        { "hook": "on-look", "source": "describe(\"A small brass key glints on the shelf.\")" }
      ]
    }
  ],
  "npcIds": ["butler"],
  "itemIds": [],
  "exits": []
}
```

`content/items/brass-key.json`:

```json
{
  "id": "brass-key",
  "type": "item",
  "name": "Brass Key",
  "description": "A small, ornate brass key.",
  "portable": true,
  "icon": "assets/items/brass-key.png",
  "interactions": [
    { "hook": "on-look", "source": "describe(\"It looks like it fits a small lock.\")" }
  ]
}
```

`content/npcs/butler.json`:

```json
{
  "id": "butler",
  "type": "npc",
  "name": "Jeeves",
  "description": "The house butler, endlessly patient.",
  "sprite": "assets/npcs/butler.png",
  "dialogueTreeId": "butler-intro",
  "interactions": [
    {
      "hook": "on-look",
      "source": "describe(\"Jeeves stands at attention, awaiting instruction.\")"
    }
  ]
}
```

`content/dialogue/butler-intro.json`:

```json
{
  "id": "butler-intro",
  "type": "dialogueTree",
  "npcId": "butler",
  "rootNodeId": "greet",
  "nodes": [
    {
      "id": "greet",
      "speaker": "npc",
      "text": "Good evening. How may I be of service?",
      "responses": [
        { "text": "Have you seen a key around here?", "targetNodeId": "about-key" },
        { "text": "Never mind." }
      ]
    },
    {
      "id": "about-key",
      "speaker": "npc",
      "text": "Why yes, I believe I saw one glinting on the shelf.",
      "responses": [{ "text": "Thank you." }]
    }
  ]
}
```

`content/scripts/unlock-desk.json`:

```json
{
  "id": "unlock-desk",
  "type": "script",
  "description": "Unlocks the writing desk if the player holds the brass key.",
  "source": "if hasItem(\"brass-key\") then\n  unlockContainer(\"desk\")\n  describe(\"The lock clicks open.\")\nelse\n  describe(\"It's locked. You need a key.\")\nend"
}
```

Notice how the references tie together, all by explicit `id`, none of them
positional:

- The room's `shelf` hotspot's `targetItemId` points at `brass-key`.
- The room's `butler-spot` hotspot's `targetNpcId`, and the room's
  `npcIds`, point at `butler`.
- The NPC's `dialogueTreeId` points at `butler-intro`.
- The dialogue tree's `npcId` points back at `butler`; its `rootNodeId`
  points at the `greet` node; `greet`'s first response's `targetNodeId`
  points at `about-key`.
- The `desk` hotspot's `on-use` interaction points at the shared
  `unlock-desk` script via `scriptId`, while every other interaction here
  uses inline `source` instead.

Run `deme validate content/` from the directory containing these files (or
point it at wherever your game's content root is) to confirm — it should
report `valid` with `0` issues.
