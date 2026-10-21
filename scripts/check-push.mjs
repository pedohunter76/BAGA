import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const result = spawnSync(
  process.execPath,
  [
    "node_modules/deno/bin.cjs",
    "check",
    "--config",
    "supabase/functions/deno.json",
    "supabase/functions/push-subscription/index.ts",
    "supabase/functions/reminder-dispatch/index.ts",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, DENO_DIR: resolve(".cache/deno") },
  },
);
process.exit(result.status ?? 1);
