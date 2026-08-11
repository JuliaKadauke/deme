# content/

Demo game content and assets for the deme bootstrap game — a one-room escape
room with a human NPC and an "AI voice assistant" NPC (both scripted dialogue
trees for now; see the epic for the deferred live-LLM fast-follow).

This is a placeholder. Content lives here as plain JSON files validated
against the schemas in `packages/content-schema`, one entity per file, with
explicit ID references only (no positional/implicit linking). See
[docs/authoring-guide.md](../docs/authoring-guide.md) for the full schema
reference, file layout conventions, and a worked example. Expect a layout
roughly like:

```
content/
  demo-escape-room/
    rooms/
    items/
    npcs/
    dialogue/
    assets/        # CC0 art (e.g. Kenney.nl packs), audio, etc.
```

Populated in follow-up Jobs in EPIC-223.
