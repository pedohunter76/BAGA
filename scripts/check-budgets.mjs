import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
// Conservative upper bound: all built JS assets, including chunks loaded after first visit.
const files = readdirSync("dist/assets").filter((file) => file.endsWith(".js"));
const total = files.reduce(
  (sum, file) => sum + gzipSync(readFileSync(`dist/assets/${file}`)).length,
  0,
);
console.log(
  `All JavaScript assets: ${(total / 1024).toFixed(1)} KiB gzip (core-route budget: 200 KiB).`,
);
if (total > 200 * 1024) process.exitCode = 1;
