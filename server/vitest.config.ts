import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"], setupFiles: ["src/test/setup.ts"] },
  resolve: { alias: { "@shared": fileURLToPath(new URL("../shared/", import.meta.url)) } },
});
