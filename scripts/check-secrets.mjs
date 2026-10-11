// Small source-control guard. Reports locations only; never prints matched secrets.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
  /\bsb_secret_[A-Za-z0-9_-]{20,}\b/,
  /\bAIza[A-Za-z0-9_-]{35}\b/,
  /\b(?:SUPABASE_SERVICE_ROLE_KEY|VAPID_PRIVATE_KEY|BAGA_CRON_SECRET)\s*[:=]\s*["'][A-Za-z0-9_.-]{24,}["']/,
];
import { readdirSync } from "node:fs";
import { join } from "node:path";

function getSourceFiles() {
  if (process.argv.slice(2).length) return process.argv.slice(2);
  try {
    return execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] },
    )
      .split("\0")
      .filter(Boolean);
  } catch {
    const collected = [];
    function walk(dir) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (
          [
            "node_modules",
            ".git",
            ".cache",
            "dist",
            ".vite",
            "dist-cloud-test",
          ].includes(entry.name)
        )
          continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile()) collected.push(full);
      }
    }
    walk(".");
    return collected;
  }
}

const files = getSourceFiles();
let found = 0;
for (const file of files) {
  if (
    !/\.(?:[cm]?[jt]sx?|json|ya?ml|md|sql|toml|sh|html|env|example)$/.test(file)
  )
    continue;
  const content = readFileSync(file, "utf8");
  content.split(/\r?\n/).forEach((line, index) => {
    if (patterns.some((pattern) => pattern.test(line))) {
      console.error(`Possible secret: ${file}:${index + 1}`);
      found++;
    }
  });
}
if (found) process.exitCode = 1;
else
  console.log("No supported secret patterns found in source-controlled files.");
