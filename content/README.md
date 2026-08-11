# content/

Demo game content and assets for the deme bootstrap game — a one-room escape
room (`demo-escape-room/`) with a human NPC (Jeeves) and an "AI voice
assistant" NPC (ARIA), both scripted dialogue trees, no live LLM calls (see
the epic for the deferred live-LLM fast-follow).

Content lives here as plain JSON files validated against the schemas in
`packages/content-schema`, one entity per file, with explicit ID references
only (no positional/implicit linking). See
[docs/authoring-guide.md](../docs/authoring-guide.md) for the full schema
reference, file layout conventions, and a worked example.

```
content/
  ATTRIBUTION.md          # CC0 asset provenance
  demo-escape-room/
    rooms/                # study (the escape room) and freedom (the epilogue)
    items/                # brass-key, door-key
    npcs/                 # jeeves, aria
    dialogue/             # jeeves-intro, aria-intro
    scripts/              # unlock-desk, open-door — the Lua-scripted puzzle chain
    assets/                # CC0 art (Kenney.nl packs) — see ATTRIBUTION.md
```

Validate with `pnpm --filter @deme/content-schema run validate
content/demo-escape-room`.

## The puzzle

`study` is locked. A brass key sits on the shelf (pick it up); using it on
the desk runs `scripts/unlock-desk.json` — a sandboxed Lua script, not a
declarative condition/effect pair — which checks `hasItem("brass-key")` and,
if held, sets a flag and `giveItem`s a `door-key`. Using that on the door runs
`scripts/open-door.json`, another Lua script, which checks for the door key
and `gotoRoom`s the player to the `freedom` epilogue room if found. Both
Jeeves and ARIA offer hints along the way, plus a flag-gated dialogue branch
once the desk is open and an item-gated branch once the door key is found.
