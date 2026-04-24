import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const wantNext = pkg.dependencies?.next ?? pkg.devDependencies?.next;
let haveNext;
try {
  haveNext = createRequire(path.join(root, "package.json"))("next/package.json").version;
} catch {
  haveNext = "(no instalado: ejecuta npm install)";
}
const tw = path.join(root, "node_modules", "tailwindcss", "index.css");
const proxy = path.join(root, "src", "proxy.ts");
const exts = [".ts", ".tsx", ".js", ".jsx", ".mjs"];
const badMw = exts
  .map((e) => [path.join(root, "middleware" + e), path.join(root, "src", "middleware" + e)])
  .flat()
  .filter((p) => existsSync(p));

console.log("--- nfq-carbon-intelligence / doctor ---");
console.log("cwd:", process.cwd());
console.log("root:", root);
console.log("node:", process.version);
console.log("package.json next:", wantNext);
console.log("node_modules next:", haveNext);
console.log("src/proxy.ts:", existsSync(proxy) ? "sí" : "NO (crítico)");
console.log("tailwind index.css:", existsSync(tw) ? "sí" : "NO (crítico)");
console.log("archivos `middleware` en raíz o src/:", badMw.length ? badMw.map((f) => path.relative(root, f)).join(", ") : "ninguno (ok)");
if (haveNext === "(no instalado: ejecuta npm install)") {
  console.log("! Ejecuta `npm install` para alinear Next con package.json.");
}
console.log("-----------------------------------------");
