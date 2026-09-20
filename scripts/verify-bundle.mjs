import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const ASSETS_DIR = path.resolve("dist/assets");
const MAX_TOTAL_JS_CSS_BYTES = 600_000;

const files = await readdir(ASSETS_DIR);
let total = 0;

for (const file of files) {
  if (!/\.(?:js|css)$/.test(file)) continue;
  total += (await stat(path.join(ASSETS_DIR, file))).size;
}

if (total > MAX_TOTAL_JS_CSS_BYTES) {
  throw new Error(
    `Production JS/CSS is ${total} bytes, above the ${MAX_TOTAL_JS_CSS_BYTES}-byte release budget.`
  );
}

console.log(
  `Production JS/CSS budget: ${total} / ${MAX_TOTAL_JS_CSS_BYTES} bytes.`
);
