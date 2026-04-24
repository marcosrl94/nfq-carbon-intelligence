import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logPath = path.join(root, ".cursor", "debug-8f6c68.log");
fs.mkdirSync(path.dirname(logPath), { recursive: true });

function tailwindIndexAt(r) {
  return path.join(r, "node_modules", "tailwindcss", "index.css");
}

function resolveProjectRootFrom(startDir) {
  const fromConfig = path.resolve(startDir);
  for (const start of [fromConfig, process.cwd()]) {
    let dir = path.resolve(start);
    for (let i = 0; i < 20; i++) {
      if (fs.existsSync(tailwindIndexAt(dir))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return fromConfig;
}

function line(obj) {
  const row = {
    timestamp: Date.now(),
    sessionId: "8f6c68",
    runId: "debug-snapshot",
    ...obj,
  };
  fs.appendFileSync(logPath, JSON.stringify(row) + "\n", "utf8");
  return row;
}

const homePkg = path.join(os.homedir(), "package.json");
const repoPostcssDir = path.dirname(path.join(root, "postcss.config.mjs"));
const fakeNextPostcssDir = path.join(root, ".next", "fake-postcss");

line({
  hypothesisId: "H-cwd",
  message: "runtime paths",
  data: {
    cwd: process.cwd(),
    root,
    cwdMatchesRoot: path.resolve(process.cwd()) === root,
    homePackageJsonExists: fs.existsSync(homePkg),
  },
});

line({
  hypothesisId: "H-postcss",
  message: "resolveProjectRoot parity (mismo algoritmo que postcss.config.mjs)",
  data: {
    fromRepoPostcss: resolveProjectRootFrom(repoPostcssDir),
    fromDotNextFake: resolveProjectRootFrom(fakeNextPostcssDir),
    twFromRepo: fs.existsSync(tailwindIndexAt(resolveProjectRootFrom(repoPostcssDir))),
  },
});

let nextResolved;
let tailwindResolved;
try {
  const req = createRequire(path.join(root, "package.json"));
  const tr = path.dirname(req.resolve("tailwindcss/package.json"));
  tailwindResolved = tr;
  nextResolved = req("next/package.json").version;
} catch (e) {
  line({
    hypothesisId: "H-resolve",
    message: "require resolve fallo",
    data: { error: String(e?.message ?? e) },
  });
}

line({
  hypothesisId: "H-next",
  message: "paquetes",
  data: {
    nextFromNodeModules: nextResolved,
    tailwindPackageDir: tailwindResolved,
  },
});

const bad = [".ts", ".tsx", ".js", ".jsx", ".mjs"]
  .map((e) => [path.join(root, "middleware" + e), path.join(root, "src", "middleware" + e)])
  .flat()
  .filter((p) => fs.existsSync(p));

line({
  hypothesisId: "H-middleware",
  message: "convencion middleware",
  data: { legacyFiles: bad.map((f) => path.relative(root, f)) },
});

console.log("--- debug-snapshot ---");
console.log("Log NDJSON:", logPath);
console.log("cwd vs root:", process.cwd(), "=>", path.resolve(process.cwd()) === root ? "ok" : "DISTINTO (revisar)");
console.log("~/package.json:", fs.existsSync(homePkg) ? "existe (puede confundir resolutores)" : "no");
console.log("postcss base resuelto (desde repo):", resolveProjectRootFrom(repoPostcssDir));
console.log("postcss base si import.meta fuese .next/…:", resolveProjectRootFrom(fakeNextPostcssDir));
console.log("----------------------");
