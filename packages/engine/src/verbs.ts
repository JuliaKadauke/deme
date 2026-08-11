import type { Hook } from "@deme/content-schema";

/**
 * The interaction verbs a player can select before clicking a hotspot. See
 * README.md ("Interaction model") for why this is a 3-verb selector mapped
 * directly onto content-schema's `Hook` rather than the issue's suggested
 * look/use/talk/pick-up set, and why it's verb-based rather than a single
 * contextual click.
 */
export type Verb = "look" | "use" | "talk";

export const VERBS: readonly Verb[] = ["look", "use", "talk"];

export const VERB_TO_HOOK: Record<Verb, Hook> = {
  look: "on-look",
  use: "on-use",
  talk: "on-talk",
};

export const DEFAULT_VERB: Verb = "look";
