import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function tailwindIndexAt(root) {
  return path.join(root, "node_modules", "tailwindcss", "index.css");
}

/** Next puede evaluar este archivo con `import.meta.url` bajo `.next/`, creyendo la raíz del repo. Subimos directorios y caemos en `cwd` si hace falta. */
function resolveProjectRoot() {
  const fromConfig = path.dirname(fileURLToPath(import.meta.url));
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

const projectRoot = resolveProjectRoot();

const config = {
  plugins: {
    "@tailwindcss/postcss": {
      base: projectRoot,
    },
  },
};

export default config;
