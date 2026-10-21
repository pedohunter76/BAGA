import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build", "--outDir", "dist-cloud-test"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_SUPABASE_URL: "https://baga-test.supabase.co",
      VITE_SUPABASE_ANON_KEY: "sb_publishable_baga_test_fixture",
    },
  },
);
process.exit(result.status ?? 1);
