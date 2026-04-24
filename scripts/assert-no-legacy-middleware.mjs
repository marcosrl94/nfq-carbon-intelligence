import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"];
const candidates = [
  ...exts.map((e) => path.join(root, "middleware" + e)),
  ...exts.map((e) => path.join(root, "src", "middleware" + e)),
];
const found = candidates.filter((p) => fs.existsSync(p));
if (found.length) {
  console.error(
    "\n[Next 16] Hay archivos de convención antigua `middleware`:\n" +
      found.map((f) => `  - ${path.relative(root, f)}`).join("\n") +
      "\n\nBórralos y usa solo `src/proxy.ts` (función `proxy`).\n"
  );
  process.exit(1);
}
