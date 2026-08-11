import type { Hook } from "@deme/content-schema";

/**
 * The interaction verbs a player can select before clicking a hotspot. See
 * README.md ("Interaction model") for why this is verb-based (mapped
 * directly onto content-schema's `Hook`) rather than a single contextual
 * click.
 *
 * `pick-up` reuses the `on-use` hook rather than a dedicated one: there's no
 * `on-pick-up` hook in content-schema (picking up is a built-in GameSession
 * mechanic driven by `Hotspot.targetItemId`/`Item.portable`, not something
 * content authors script per hotspot), and content that *does* attach an
 * `on-use` interaction to an item-bearing hotspot still runs it as a
 * fallback once the item's already been picked up. `on-combine` (item used
 * on item) likewise has no verb — it's driven by inventory item selection,
 * not the verb selector.
 */
export type Verb = "look" | "use" | "talk" | "pick-up";

export const VERBS: readonly Verb[] = ["look", "use", "talk", "pick-up"];

export const VERB_TO_HOOK: Record<Verb, Hook> = {
  look: "on-look",
  use: "on-use",
  talk: "on-talk",
  "pick-up": "on-use",
};

export const DEFAULT_VERB: Verb = "look";
