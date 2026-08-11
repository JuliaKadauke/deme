# @deme/engine

The PixiJS-based rendering and interaction runtime: loads a `Room` (from
`@deme/content-schema`) and renders its background and hotspots, drives
walk-box-constrained click-to-walk player movement, hit-tests hotspot clicks,
and transitions between rooms on exit-hotspot triggers.

No dialogue, inventory, or scripting lives here yet — those are separate,
later pieces of the engine. This package only covers rendering, input, and
room navigation, and emits typed events for those later systems to subscribe
to instead of executing any interaction logic itself.

## Interaction model

**Chosen: verb-based**, with three verbs — `look`, `use`, `talk` — selected
via `GameRuntime#setVerb()` and applied to whichever hotspot is clicked next.

This maps directly onto `@deme/content-schema`'s `Hook` type (`on-look`,
`on-use`, `on-talk`, `on-combine`), rather than inventing an engine-side
interaction vocabulary that content authors would then have to learn
separately. Two hooks were deliberately left out of the verb set:

- **`pick-up`** (suggested in the issue as a fourth verb) has no natural
  target yet: there's no inventory system in this package, so "pick up" and
  "use" would currently be indistinguishable. It's expected to become its own
  verb once inventory lands, at which point it's a mechanical addition to
  `VERBS`/`VERB_TO_HOOK` in `verbs.ts`.
- **`on-combine`** applies to item-on-item interactions (combining two
  inventory items), which likewise don't exist without an inventory.

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
  `{ roomId, hotspot, verb, hook }`. This is the hook for a future scripting
  system: run `hotspot.interactions` entries matching `event.hook`.
- **`room-exit`** — fired alongside `hotspot-interact` when the clicked
  hotspot is one of the room's `exits[]`. `{ fromRoomId, hotspotId,
targetRoomId }`. `GameRuntime` itself subscribes to this to load and swap in
  the next room; external subscribers see it too, purely as a notification.
- **`room-loaded`** — a new Room's scene has finished mounting. `{ room }`.
- **`player-walk`** — a click-to-walk command was issued (target already
  walk-box-clamped). `{ from, to }`.

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
