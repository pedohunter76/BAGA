import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  clearDiagnostics,
  exportDiagnostics,
  readDiagnostics,
  recordDiagnostic,
} from "./diagnostics";
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
  clearDiagnostics();
});
afterEach(() => vi.unstubAllGlobals());
it("exports only allowlisted codes and timestamps, even when storage is polluted", () => {
  recordDiagnostic("render-failure");
  store.set(
    "baga-diagnostics-v1",
    JSON.stringify([
      {
        code: "runtime-error",
        at: "2026-10-11T12:00:00Z",
        notes: "private health notes",
        token: "private",
      },
      { code: "secret message", at: "2026-10-11T12:00:00Z" },
    ]),
  );
  const text = exportDiagnostics();
  expect(text).not.toContain("private");
  expect(text).not.toContain("secret");
  expect(JSON.parse(text).events).toHaveLength(1);
});
it("bounds retained events, clears them, and tolerates denied storage", () => {
  for (let i = 0; i < 30; i++) recordDiagnostic("runtime-error");
  expect(readDiagnostics()).toHaveLength(25);
  clearDiagnostics();
  expect(readDiagnostics()).toEqual([]);
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  });
  expect(() => recordDiagnostic("unhandled-rejection")).not.toThrow();
  expect(readDiagnostics()).toHaveLength(1);
});
