import { LuaEventMasks, LuaFactory, type LuaGlobal } from "wasmoon";

/**
 * One shared factory for the whole process, created lazily on first use (not
 * at module load) so merely importing this module — or `@deme/engine` as a
 * whole — never eagerly initializes the wasmoon WASM glue. Its constructor
 * compiles/loads that WASM once, then `createEngine()` cheaply spins up a
 * fresh `lua_State` per call. Never share a `LuaGlobal`/engine across script
 * runs — {@link runSandboxedLua} creates and tears one down per call, which
 * is what gives every script execution its own empty global environment.
 */
let factory: LuaFactory | undefined;
function getFactory(): LuaFactory {
  return (factory ??= new LuaFactory());
}

export interface LuaSandboxLimits {
  /** Aborts the script once this many Lua VM instructions have executed. */
  maxInstructions: number;
  /** Instructions between instruction-budget checks (the debug hook's `count`). Lower is more precise but slower. */
  instructionCheckInterval: number;
  /** Max nested Lua/C calls — bounds recursion depth. Enforced by Lua itself via `lua_setcstacklimit`. */
  maxCallDepth: number;
  /** Max bytes the VM's allocator will ever hand out; further allocations fail as Lua out-of-memory errors. */
  maxMemoryBytes: number;
}

export const DEFAULT_LUA_SANDBOX_LIMITS: LuaSandboxLimits = {
  maxInstructions: 200_000,
  instructionCheckInterval: 200,
  maxCallDepth: 200,
  maxMemoryBytes: 16 * 1024 * 1024,
};

/**
 * The whitelist: every function a sandboxed script is allowed to call, keyed
 * by the Lua global name it's installed under. Arguments/return values must
 * be primitives wasmoon can marshal (strings, numbers, booleans, undefined).
 */
export type LuaApi = Record<string, (...args: unknown[]) => unknown>;

/**
 * Raised inside the VM (and surfaced to the script as a Lua error) when a
 * script runs past its instruction budget — e.g. an infinite loop. Note:
 * wasmoon's `assertOk` rewraps every Lua-side error into a plain `Error`
 * before it reaches `runSandboxedLua`'s caller, copying over `.message`/
 * `.stack` — so callers should match on `error.message`, not
 * `instanceof LuaInstructionBudgetExceededError`.
 */
export class LuaInstructionBudgetExceededError extends Error {
  constructor(maxInstructions: number) {
    super(`script exceeded its instruction budget (${maxInstructions} instructions)`);
    this.name = "LuaInstructionBudgetExceededError";
  }
}

/**
 * Runs `source` to completion in a brand-new Lua 5.4 VM (wasmoon), with an
 * entirely empty global environment except the functions in `api` — no
 * standard library is opened at all, so there is no `io`, `os`, `require`,
 * `load`, `dofile`, or even `print`/`pairs`/`pcall`. This is deliberate: the
 * issue this implements calls for a whitelist-only environment, not "the
 * standard library minus a blocklist" — content scripts get exactly the
 * game-state accessor/action functions they need for puzzle logic and
 * nothing else load-bearing enough to reach outside the VM.
 *
 * Three defenses run for the lifetime of this call, all configurable via
 * `limits`:
 * - An instruction budget, enforced via a Lua debug hook (`LuaEventMasks.Count`)
 *   that aborts the script with {@link LuaInstructionBudgetExceededError} once
 *   `maxInstructions` is exceeded — stops infinite loops.
 * - A call/recursion depth limit (`lua_setcstacklimit`) — stops unbounded
 *   recursion; Lua itself raises a "stack overflow" error past the limit.
 * - A memory ceiling on the VM's allocator (`traceAllocations` + `setMemoryMax`)
 *   — further allocations past `maxMemoryBytes` fail as Lua out-of-memory
 *   errors instead of growing without bound.
 *
 * The VM is always closed before this returns, whether the script finished,
 * threw, or was aborted by one of the above.
 */
export async function runSandboxedLua(
  source: string,
  api: LuaApi,
  limits: Partial<LuaSandboxLimits> = {},
): Promise<void> {
  const resolvedLimits: LuaSandboxLimits = { ...DEFAULT_LUA_SANDBOX_LIMITS, ...limits };
  const engine = await getFactory().createEngine({
    openStandardLibs: false,
    injectObjects: false,
    traceAllocations: true,
  });
  const { global } = engine;

  let removeInstructionBudgetHook: (() => void) | undefined;
  try {
    global.setMemoryMax(resolvedLimits.maxMemoryBytes);
    global.lua.lua_setcstacklimit(global.address, resolvedLimits.maxCallDepth);
    removeInstructionBudgetHook = installInstructionBudget(global, resolvedLimits);

    for (const [name, fn] of Object.entries(api)) {
      global.set(name, fn);
    }

    global.loadString(source);
    await global.run(0);
  } finally {
    removeInstructionBudgetHook?.();
    global.close();
  }
}

/** Installs a `debug.sethook`-equivalent instruction-count hook on `thread` and returns a function that removes it. */
function installInstructionBudget(thread: LuaGlobal, limits: LuaSandboxLimits): () => void {
  let instructionsExecuted = 0;
  const hookPointer = thread.lua.module.addFunction(() => {
    instructionsExecuted += limits.instructionCheckInterval;
    if (instructionsExecuted > limits.maxInstructions) {
      thread.pushValue(new LuaInstructionBudgetExceededError(limits.maxInstructions));
      thread.lua.lua_error(thread.address);
    }
  }, "vii");
  thread.lua.lua_sethook(
    thread.address,
    hookPointer,
    LuaEventMasks.Count,
    limits.instructionCheckInterval,
  );
  return () => {
    thread.lua.lua_sethook(thread.address, null, 0, 0);
    thread.lua.module.removeFunction(hookPointer);
  };
}
