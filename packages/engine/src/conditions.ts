import type { StateCondition, StateEffect } from "@deme/content-schema";
import type { GameState } from "./game-state.js";

/** Returns whether `condition` holds against `state`. An absent condition always holds. */
export function evaluateCondition(
  condition: StateCondition | undefined,
  state: GameState,
): boolean {
  if (!condition) return true;
  return (
    (condition.requiredFlags ?? []).every((flag) => state.hasFlag(flag)) &&
    (condition.forbiddenFlags ?? []).every((flag) => !state.hasFlag(flag)) &&
    (condition.requiredItemIds ?? []).every((itemId) => state.hasItem(itemId))
  );
}

/** Applies `effects` (flag mutations) to `state` in place. A no-op if `effects` is absent. */
export function applyEffects(effects: StateEffect | undefined, state: GameState): void {
  if (!effects) return;
  for (const flag of effects.setFlags ?? []) state.setFlag(flag);
  for (const flag of effects.clearFlags ?? []) state.clearFlag(flag);
}
