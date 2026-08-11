import { GAME_STATE_VERSION, GameState, type GameStateData } from "./game-state.js";

/**
 * The subset of the browser `Storage` interface (`localStorage`/
 * `sessionStorage`) this module needs. Accepting this instead of reaching
 * for `window.localStorage` directly keeps save/load usable from Node tests
 * and lets a host swap in another backend (e.g. `sessionStorage`, an
 * in-memory fake) without changes here.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const DEFAULT_SAVE_KEY = "deme:save";

export function serializeGameState(state: GameState): string {
  return JSON.stringify(state.toJSON());
}

export function deserializeGameState(json: string): GameState {
  const data = JSON.parse(json) as GameStateData;
  if (data.version !== GAME_STATE_VERSION) {
    throw new Error(
      `GameState save data is version ${data.version}, but this engine expects version ${GAME_STATE_VERSION}`,
    );
  }
  return GameState.fromJSON(data);
}

/** Serializes `state` and writes it to `storage` under `key`. */
export function saveGameState(
  storage: StorageLike,
  state: GameState,
  key = DEFAULT_SAVE_KEY,
): void {
  storage.setItem(key, serializeGameState(state));
}

/** Reads and deserializes GameState from `storage`, or undefined if nothing is saved under `key`. */
export function loadGameState(storage: StorageLike, key = DEFAULT_SAVE_KEY): GameState | undefined {
  const raw = storage.getItem(key);
  if (raw === null) return undefined;
  return deserializeGameState(raw);
}

/** Removes any saved GameState under `key`. */
export function clearSavedGameState(storage: StorageLike, key = DEFAULT_SAVE_KEY): void {
  storage.removeItem(key);
}

/** A minimal in-memory `StorageLike`, for tests and non-browser hosts without `localStorage`. */
export class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}
