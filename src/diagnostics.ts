type Code = "runtime-error" | "unhandled-rejection" | "render-failure";
const key = "baga-diagnostics-v1";
const codes: Code[] = [
  "runtime-error",
  "unhandled-rejection",
  "render-failure",
];
interface Diagnostic {
  code: Code;
  at: string;
}
let memory: Diagnostic[] = [];
export function readDiagnostics(): Diagnostic[] {
  try {
    const raw =
      typeof localStorage === "undefined"
        ? memory
        : JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (row) =>
          row &&
          codes.includes(row.code) &&
          typeof row.at === "string" &&
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(row.at),
      )
      .slice(-25)
      .map((row) => ({ code: row.code, at: row.at }));
  } catch {
    return memory;
  }
}
export function recordDiagnostic(code: Code) {
  if (!codes.includes(code)) return;
  memory = [...readDiagnostics(), { code, at: new Date().toISOString() }].slice(
    -25,
  );
  try {
    if (typeof localStorage !== "undefined")
      localStorage.setItem(key, JSON.stringify(memory));
  } catch {
    /* Storage errors must never cause another error. */
  }
}
export function clearDiagnostics() {
  memory = [];
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  } catch {
    /* Best effort if browser storage is unavailable. */
  }
}
export function exportDiagnostics() {
  return JSON.stringify(
    { app: "BAGA", version: 1, events: readDiagnostics() },
    null,
    2,
  );
}
