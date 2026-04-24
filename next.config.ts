import type { NextConfig } from "next";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const requireFromApp = createRequire(path.join(projectRoot, "package.json"));

/** Rutas reales: si en ~ hay un `package.json` extra, Turbopack puede intentar resolver desde `…/Desktop/Apps` y fallar aunque el paquete esté en este repo. */
const tailwindRoot = path.dirname(
  requireFromApp.resolve("tailwindcss/package.json")
);
const tailwindPostcssRoot = path.join(
  projectRoot,
  "node_modules",
  "@tailwindcss",
  "postcss"
);

const nextConfig: NextConfig = {
  // Evita que el “workspace” lo infiera por un `package.json` en `~/` o carpetas superiores.
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
    resolveAlias: {
      tailwindcss: tailwindRoot,
      "tailwindcss/index.css": path.join(tailwindRoot, "index.css"),
      "@tailwindcss/postcss": tailwindPostcssRoot,
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    const alias = config.resolve.alias;
    config.resolve.alias = {
      ...(typeof alias === "object" && !Array.isArray(alias) ? alias : {}),
      tailwindcss: tailwindRoot,
    };
    return config;
  },
};

export default nextConfig;
