# Architecture

Decisions locked in during design discussion (2026-08-11) for EPIC-223.

## Rendering

[PixiJS](https://pixijs.com/) — a thin 2D renderer, without the
physics/tilemap opinions a LucasArts-style room-based point-and-click engine
doesn't need. Lives in `packages/engine`; see
[`packages/engine/README.md`](../packages/engine/README.md) for the
rendering runtime's interaction model (verb-based hotspot interaction),
event contract, and walk-box-based player movement.

## Content format

JSON validated against JSON Schema, one entity per file, explicit ID
references only — never positional or implicit linking. JSON's strict
parsing fails loud on LLM-authored mistakes, unlike YAML's
whitespace-significant structure. Schemas, generated TS types, and a
validator CLI live in `packages/content-schema`.

Content is data, never code: rules and interactions are validated JSON. The
AI-facing content authoring guide (see [authoring-guide.md](./authoring-guide.md))
is a first-class deliverable, since content authors are expected to be AI
agents.

## Scripting

A fully Turing-complete embedded language, not a restricted DSL: Lua 5.4 via
[wasmoon](https://github.com/ceifa/wasmoon) (Lua compiled to WASM) — the
smallest/fastest embeddable-language option for untrusted content in a
resource-constrained runtime.

Sandboxing is a first-class engine requirement, not an afterthought, because
unreviewed community content is playable in-browser. Hard acceptance
criteria for the scripting sandbox:

- Whitelist-only global environment (no `io`, `os`, `require`, `load`).
- An instruction-count budget enforced via debug hooks.
- A call/recursion depth limit.
- A VM memory ceiling.
- iframe + CSP isolation around the player app, as defense-in-depth.

## Graphics

No AI art-generation pipeline in this epic's scope. The bootstrap demo game
uses existing CC0 asset packs (e.g. [Kenney.nl](https://kenney.nl/)). An
AI art-authoring pipeline is explicitly deferred to a future epic.

## Demo game

A one-room escape room, shipped in the same repo as the engine (`content/`
alongside `packages/`). Features one human NPC and one "AI voice assistant"
NPC — both mechanically identical scripted dialogue trees, with no live LLM
calls in this epic. A genuinely live LLM-backed NPC is a deliberately
deferred fast-follow, to avoid stacking backend-proxy, cost-control, and
prompt-injection concerns on top of the sandboxing work.

## Repo layout

```
packages/engine/          Pixi-based runtime
packages/content-schema/  JSON Schema + TS types + validator CLI
apps/player/              browser shell app
content/                  demo game content and assets
docs/                     project docs
```
