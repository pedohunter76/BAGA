// Audit the exact npm versions retained in the Deno lockfile using npm's TLS configuration.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const lock = JSON.parse(
  readFileSync(
    new URL("../supabase/functions/deno.lock", import.meta.url),
    "utf8",
  ),
);
const dependencies = {};
for (const entry of Object.keys(lock.npm)) {
  const separator = entry.lastIndexOf("@"),
    name = entry.slice(0, separator),
    version = entry.slice(separator + 1);
  if (dependencies[name] && dependencies[name] !== version)
    throw new Error(
      "Multiple locked versions require a separate audit; do not silently omit a dependency.",
    );
  dependencies[name] = version;
}
const directory = mkdtempSync(join(tmpdir(), "baga-push-audit-"));
const cache = join(process.cwd(), ".cache", "npm");
try {
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({
      name: "baga-push-audit",
      version: "1.0.0",
      private: true,
      dependencies,
    }),
  );
  for (const args of [
    [
      "install",
      "--package-lock-only",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ],
    ["audit", "--audit-level=high"],
  ]) {
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    const result = spawnSync(npmCmd, [...args, "--cache", cache], {
      cwd: directory,
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    });
    if (result.status !== 0) {
      process.exitCode = result.status || 1;
      break;
    }
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
