import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const assertScript = path.join(root, "scripts", "assert-no-legacy-middleware.mjs");
try {
  execFileSync(process.execPath, [assertScript], { stdio: "inherit", cwd: root });
} catch {
  process.exit(1);
}

if (!existsSync(path.join(root, "src", "proxy.ts"))) {
  console.error("\n[dev] No existe `src/proxy.ts` (obligatorio en Next 16 para el capa de auth).\n");
  process.exit(1);
}

const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
if (!existsSync(nextCli)) {
  console.error("\n[dev] Falta `node_modules`. Ejecuta: npm install\n");
  process.exit(1);
}

const userArgs = process.argv.slice(2);
const useTurbo =
  userArgs.includes("--turbopack") ||
  userArgs.includes("--turbo") ||
  process.env.NEXT_DEV_TURBO === "1";
const nextArgs = useTurbo
  ? ["dev", ...userArgs]
  : ["dev", "--webpack", ...userArgs];

const child = spawn(process.execPath, [nextCli, ...nextArgs], {
  stdio: "inherit",
  env: process.env,
  cwd: root,
});
child.on("exit", (c) => process.exit(c == null ? 0 : c));
