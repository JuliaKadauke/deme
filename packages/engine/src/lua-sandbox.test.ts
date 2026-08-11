import { describe, expect, it } from "vitest";
import { DEFAULT_LUA_SANDBOX_LIMITS, runSandboxedLua, type LuaApi } from "./lua-sandbox.js";

/** Tight limits so adversarial cases fail fast instead of burning the default 200k-instruction budget. */
const TIGHT_LIMITS = { maxInstructions: 5_000, instructionCheckInterval: 50, maxCallDepth: 50 };

describe("runSandboxedLua", () => {
  it("executes a normal-complexity puzzle script (combination-lock check) end to end", async () => {
    const calls: unknown[][] = [];
    const flags = new Set(["dial-set-to-7-3-9"]);
    const api: LuaApi = {
      hasFlag: (flagId) => flags.has(flagId as string),
      unlock: (...args) => calls.push(["unlock", ...args]),
      describe: (...args) => calls.push(["describe", ...args]),
    };

    await runSandboxedLua(
      `
      if hasFlag("dial-set-to-7-3-9") then
        unlock("safe")
        describe("The safe clicks open.")
      else
        describe("The dial doesn't match.")
      end
      `,
      api,
    );

    expect(calls).toEqual([
      ["unlock", "safe"],
      ["describe", "The safe clicks open."],
    ]);
  });

  it("supports local variables, loops, and arithmetic with no standard library at all", async () => {
    const results: unknown[] = [];
    const api: LuaApi = { report: (n) => results.push(n) };

    await runSandboxedLua(
      `
      local total = 0
      for i = 1, 5 do
        total = total + i
      end
      report(total)
      `,
      api,
    );

    expect(results).toEqual([15]);
  });

  it("rejects unknown globals instead of silently no-op-ing", async () => {
    await expect(runSandboxedLua('unknownFn("x")', {})).rejects.toThrow(/unknownFn/);
  });

  describe("adversarial content", () => {
    it("safely terminates an infinite loop via the instruction budget", async () => {
      await expect(runSandboxedLua("while true do end", {}, TIGHT_LIMITS)).rejects.toThrow(
        /instruction budget/,
      );
    });

    it("safely terminates infinite work disguised as a numeric for-loop", async () => {
      await expect(
        runSandboxedLua("local x = 0\nfor i = 1, 2147483647 do x = x + i end", {}, TIGHT_LIMITS),
      ).rejects.toThrow(/instruction budget/);
    });

    it("safely terminates unbounded (non-tail-call) recursion instead of crashing the host", async () => {
      await expect(
        runSandboxedLua(
          "local function f(n) if n <= 0 then return 0 end return 1 + f(n - 1) end return f(1000000)",
          {},
          { ...TIGHT_LIMITS, maxInstructions: 50_000_000, maxMemoryBytes: 64 * 1024 * 1024 },
        ),
      ).rejects.toThrow(/stack overflow|not enough memory/);
    });

    it("rejects reaching disallowed globals: io, os, require, load, dofile", async () => {
      const attempts = [
        'io.write("pwned")',
        'os.execute("rm -rf /")',
        'require("os")',
        'load("return 1")()',
        'dofile("/etc/passwd")',
      ];
      for (const source of attempts) {
        await expect(runSandboxedLua(source, {})).rejects.toThrow(/nil value/);
      }
    });

    it("does not leak state or whitelist functions between separate script executions", async () => {
      await runSandboxedLua("leak = 1", { setLeak: () => undefined });
      await expect(runSandboxedLua("return leak", {})).resolves.toBeUndefined();
    });
  });

  it("enforces a configurable memory ceiling on the VM allocator", async () => {
    await expect(
      runSandboxedLua(
        `
        local s = "x"
        while true do
          s = s .. s
        end
        `,
        {},
        { ...TIGHT_LIMITS, maxInstructions: 50_000_000, maxMemoryBytes: 64 * 1024 },
      ),
    ).rejects.toThrow(/memory/);
  });

  it("exposes only the injected api functions plus core language syntax — no stdlib globals", async () => {
    for (const name of [
      "print",
      "pairs",
      "ipairs",
      "tostring",
      "pcall",
      "string",
      "math",
      "table",
    ]) {
      await expect(runSandboxedLua(`return ${name}`, {})).resolves.toBeUndefined();
    }
  });

  it("uses the documented default limits when none are given", () => {
    expect(DEFAULT_LUA_SANDBOX_LIMITS.maxInstructions).toBeGreaterThan(0);
    expect(DEFAULT_LUA_SANDBOX_LIMITS.maxCallDepth).toBeGreaterThan(0);
    expect(DEFAULT_LUA_SANDBOX_LIMITS.maxMemoryBytes).toBeGreaterThan(0);
  });
});
