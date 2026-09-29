import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    // El hook de persistencia levanta una base temporal con
    // "prisma migrate deploy", que en maquinas lentas tarda mas de 10 s.
    hookTimeout: 30000,
  },
});
