# @deme/engine

The PixiJS-based rendering and interaction runtime: loads a `Room` (from
`@deme/content-schema`) and renders its background and hotspots, drives
walk-box-constrained click-to-walk player movement, hit-tests hotspot clicks,
and transitions between rooms on exit-hotspot triggers. On top of that,
`GameSession` owns game state, inventory, and dialogue, wiring them into
`GameRuntime`'s events so hotspot clicks can read/mutate state and trigger
dialogue — see "Game state, inventory, and dialogue" below.

Lua scripting does not live here yet — content's `source`/`scriptId` fields
are left untouched by this package. That's a separate, later piece (the
sandboxed wasmoon VM described in `docs/architecture.md`), tracked
independently of state/inventory/dialogue because of its much larger,
security-sensitive acceptance surface (whitelist globals, instruction
budget, recursion limit, memory ceiling).

## Interaction model

**Chosen: verb-based**, with four verbs — `look`, `use`, `talk`, `pick-up` —
selected via `GameRuntime#setVerb()`/`GameSession#setVerb()` and applied to
whichever hotspot is clicked next.

This maps directly onto `@deme/content-schema`'s `Hook` type (`on-look`,
`on-use`, `on-talk`, `on-combine`), rather than inventing an engine-side
interaction vocabulary that content authors would then have to learn
separately. `pick-up` reuses the `on-use` hook rather than a dedicated one —
see `verbs.ts` for why. `on-combine` (item used on item) has no verb at all:
it's driven by inventory item selection (`GameSession#useSelectedItemOnItem`),
not the verb selector — see below.

A single-contextual-click model (one click does "the right thing" based on
the hotspot) was considered — it's arguably closer to some later LucasArts
titles — but was rejected here because content authors write `interactions[]`
per-hook already (see the authoring guide), and a verb selector maps onto
that shape with no translation layer. It also keeps `look` cheaply available
everywhere, which matters for hand-authored/LLM-authored content.

## Event contract

`GameRuntime#events` (and `RoomController#events`) is an `Emitter` — see
`events.ts` for the exact payload shapes — with these event types:

- **`hotspot-interact`** — a hotspot was clicked under the current verb.
  `{ roomId, hotspot, verb, hook }`. `GameSession` subscribes to this to
  resolve pickup/dialogue/gated-interaction behavior — see "Game state,
  inventory, and dialogue" below. `RoomController`/`GameRuntime` alone don't
  interpret it any further; a future Lua scripting system will eventually run
  `hotspot.interactions` entries' `source`/`scriptId` for the matching hook.
- **`room-exit`** — fired alongside `hotspot-interact` when the clicked
  hotspot is one of the room's `exits[]`. `{ fromRoomId, hotspotId,
targetRoomId }`. `GameRuntime` itself subscribes to this to load and swap in
  the next room; external subscribers see it too, purely as a notification.
- **`room-loaded`** — a new Room's scene has finished mounting. `{ room }`.
- **`player-walk`** — a click-to-walk command was issued (target already
  walk-box-clamped). `{ from, to }`.

## Game state, inventory, and dialogue

`GameSession` (`game-session.ts`) is the orchestrator: it owns a `GameState`
(flags, inventory, current room — the single serializable source of truth,
see `game-state.ts`), an `Inventory`, and — while a conversation is active —
a `DialogueRuntime`, and wires them into an internally-created `GameRuntime`'s
`hotspot-interact` events. Construct one with `stage`, a `startRoomId`, and
`ContentLoaders` (`loadRoom`/`loadItem`/`loadNpc`/`loadDialogueTree` — same
"host supplies the fetch" pattern as `GameRuntime#loadRoom`), call `start()`,
then drive it exactly like `GameRuntime` (`setVerb`, `update`).

A hotspot click resolves in this order (see
`GameSession#handleHotspotInteract`):

1. **An inventory item is selected** (`selectInventoryItem`) → "use that item
   on this hotspot": resolved the same way as step 4, against the `on-use`
   hook, then fires `item-used` and clears the selection.
2. **Verb is `pick-up`** and the hotspot has a not-yet-carried, portable
   (`Item.portable !== false`) `targetItemId` → add it to the inventory and
   fire `item-picked-up`. Falls through to step 4 otherwise (e.g. the item's
   already been picked up).
3. **Verb is `talk`** and the hotspot has a `targetNpcId` whose NPC has a
   `dialogueTreeId` → start a `DialogueRuntime` for it, firing
   `dialogue-started`.
4. **Otherwise** → resolve `hotspot.interactions`: the first entry whose
   `hook` matches the click and whose `condition` holds is applied (its
   `effects` mutate `GameState`). `source`/`scriptId` are left untouched.

Item-on-item use (`GameSession#useSelectedItemOnItem`) works similarly,
gated by `Item.combinesWithItemIds` plus an `on-combine` interaction entry.

### Declarative gating: `condition`/`effects`

Content's `interactions[].source`/`scriptId` (Lua) is reserved for a future
scripting engine this package doesn't run yet (see above). Gating "branches
by current flags/inventory" and unlocking things still needs to work _now_,
so `@deme/content-schema` additionally carries a small, deliberately
non-Turing-complete pair of fields — plain data, not code, so they don't
violate the "content is data, never code" rule — evaluated directly by
`conditions.ts`, independent of any scripting:

- **`condition`** (`{ requiredFlags?, forbiddenFlags?, requiredItemIds? }`)
  — gates a `scriptRef` entry (hotspot/item/npc `interactions[]`) or a
  dialogue response. Available on `common.schema.json`'s `scriptRef` and on
  `dialogue-node.schema.json`'s `responses[]`.
- **`effects`** (`{ setFlags?, clearFlags? }`) — applied when a gated
  `scriptRef` entry fires or a dialogue response is chosen.

Once the Lua scripting engine lands, `source`/`scriptId` can take over
arbitrary side effects; `condition`/`effects` stay as the lightweight,
sandboxing-free path for pure flag/inventory gating.

### Dialogue

`DialogueRuntime` (one instance per active conversation, instantiated by
`GameSession`) walks a single NPC's `DialogueTree`: `start()` fires
`dialogue-started` at the root node; `choose(index)` — indexing into
`availableResponses`, i.e. already filtered by `condition`, not the raw
`node.responses` array — applies the chosen response's `effects` and either
advances (`dialogue-line`) or ends (`dialogue-ended`) if it has no
`targetNodeId`. "Multiple NPC actors" (per the issue) means multiple NPCs
each running their own tree this way, not multiple speakers within one
tree — `DialogueTree`/`DialogueNode` have no such concept.

### Inventory

`Inventory` (`inventory.ts`) tracks carried item ids (backed by
`GameState.inventory`) and a single selection for the "use item on X"
gesture (`select`/`deselect`/`useSelectedOn`). `InventoryBar`
(`inventory-bar.ts`) is its placeholder Pixi UI — one colored square per
carried item, labeled with the item's name, following the same
no-art-pipeline tradeoff as `RoomScene`'s hotspot overlays (see "Rendering
without art" below); swap in `Item.icon` once assets land.

### Save/load

`save-load.ts` serializes `GameState` to JSON and writes/reads it via a
minimal `StorageLike` interface (`getItem`/`setItem`/`removeItem` — the
subset of the browser `Storage` API `localStorage`/`sessionStorage` already
implement, so a host just passes `window.localStorage`; `MemoryStorage` is
provided for tests and non-browser hosts). `GameSession#save`/`#load` wrap
this and, on load, restore `GameState` in place (`GameState#restoreFrom`)
and reload the current room, so existing `session.state`/`session.inventory`
references stay valid instead of going stale.

## Walk box

Content rooms may declare an optional `walkBox` polygon (added to
`@deme/content-schema`'s `Room` schema alongside this package, since it's
authored room data with nowhere else to live — see
[`../content-schema/schemas/room.schema.json`](../content-schema/schemas/room.schema.json)).
A click outside the walk box is clamped to its nearest edge before the player
walks toward it (`geometry.ts#clampToPolygon`), so the character can never
walk outside the walkable area. A room with no `walkBox` has no player
movement (e.g. a cutscene-only room).

## Rendering without art

There's no art pipeline in this epic yet (see
[`../../docs/architecture.md`](../../docs/architecture.md)), so
`RoomScene` renders each hotspot as a translucent debug-colored overlay and
the player as a plain colored marker, on top of an optionally-loaded
background texture. `RoomScene`'s `loadTexture` and `GameRuntime`'s
`loadTexture` options exist to swap in real sprites once assets do.

## Ownership boundaries

`GameRuntime` does not create or own a `PIXI.Application` — canvas/renderer
setup is unavoidably host/DOM-specific (see `apps/player`), so this package
takes a `stage: Container` and expects the host to call `update(deltaMs)`
from its own render loop (e.g. `app.ticker`). This also keeps the whole
package testable in a plain Node environment: PixiJS's scene-graph classes
(`Container`, `Sprite`, `Graphics`) don't require a canvas or GPU context to
construct or inspect, only an `Application` does.
