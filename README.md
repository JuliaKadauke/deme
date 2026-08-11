# deme

deme is a browser-based, community-built point-and-click adventure engine.
The engine is provided by us; the story, content, and eventually the game's
name are built by the community — including unreviewed content that anyone
can play in-browser, which makes sandboxing a first-class engine
requirement.

Content is authored primarily by AI agents: it's plain JSON validated
against JSON Schema (one entity per file, explicit ID references only),
which fails loud on LLM-authored mistakes instead of silently misparsing.
Scripted behavior runs in a sandboxed Lua VM (whitelist-only globals,
instruction/memory/recursion limits) so untrusted community content can't
escape the runtime.

See [docs/](./docs/) for architecture decisions and the content authoring
guide.

## Layout

```
packages/engine/          Pixi-based runtime
packages/content-schema/  JSON Schema + TS types + validator CLI
apps/player/              browser shell app
content/                  demo game content and assets
docs/                     project docs
```

## Getting started

Requires [pnpm](https://pnpm.io/).

```sh
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

## Status

This repository is currently scaffolding only — no engine logic yet. See
the tracking epic for the full bootstrap plan.
