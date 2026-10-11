import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";

await mkdir(new URL("../public/icons/", import.meta.url), { recursive: true });
const svg = await readFile(new URL("../public/favicon.svg", import.meta.url));
for (const size of [192, 512]) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(
      new URL(`../public/icons/icon-${size}.png`, import.meta.url).pathname,
    );
}
await sharp(svg)
  .resize(330, 330)
  .extend({ top: 91, bottom: 91, left: 91, right: 91, background: "#c4ec85" })
  .png()
  .toFile(
    new URL("../public/icons/maskable-512.png", import.meta.url).pathname,
  );
console.log("Generated 192px, 512px, and maskable install icons.");
