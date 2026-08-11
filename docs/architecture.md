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
unreviewed community content is playable in-browser. The sandbox
(`packages/engine/src/lua-sandbox.ts`, wired into interaction resolution via
`script-runtime.ts`/`game-session.ts`) meets these hard acceptance criteria:

- **Whitelist-only global environment**: no standard library is opened at
  all (no `io`, `os`, `require`, `load`, `dofile` — not even `print`), only
  the game-state accessor/action functions documented in
  [authoring-guide.md](./authoring-guide.md#the-lua-sandboxs-whitelisted-api),
  injected fresh per script execution.
- **An instruction-count budget**, enforced via a Lua debug hook
  (`LuaEventMasks.Count`) that aborts the script once it exceeds a
  configured instruction count — stops infinite loops.
- **A call/recursion depth limit**, via `lua_setcstacklimit` — stops
  unbounded recursion with a clean Lua "stack overflow" error.
- **A VM memory ceiling**, via wasmoon's allocation tracing
  (`traceAllocations` + `setMemoryMax`) — further allocations past the
  ceiling fail as Lua out-of-memory errors instead of growing unbounded.
- **iframe + CSP isolation around the player app**, as defense-in-depth —
  see [`apps/player/README.md`](../apps/player/README.md). The player app is
  split into an inert host page (`index.html`) that embeds the actual game
  (`play.html`) in an `<iframe sandbox="allow-scripts">` — deliberately
  without `allow-same-origin` — so even a VM-level sandbox escape has no
  origin to reach the host page's DOM/cookies, or another game's data,
  through. Each page also carries its own CSP (`play.html`'s allows
  `'wasm-unsafe-eval'` for wasmoon and nothing broader); `frame-ancestors`
  and `X-Frame-Options`, which CSP `<meta>` tags can't express, are set via
  `apps/player/public/_headers`.

A script that throws — a sandbox limit, or just an authoring bug reaching an
undefined function — aborts only itself; `GameSession` catches it and fires
a `script-error` event rather than letting it propagate, so one bad script
can never take down the session.

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
