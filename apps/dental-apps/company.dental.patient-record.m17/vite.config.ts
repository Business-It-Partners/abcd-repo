import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
const here = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root: here,
  base: "./",
  plugins: [react()],
  resolve: { alias: [
    { find: /^@\/shared\//, replacement: path.resolve(here, "vendor/dental-saas/apps/clinic-web/src/shared") + "/" },
    { find: /^@\/features\//, replacement: path.resolve(here, "vendor/dental-saas/apps/clinic-web/src/features") + "/" },
    { find: /^@\/shell\//, replacement: path.resolve(here, "vendor/dental-saas/apps/clinic-web/src/shell") + "/" },
    { find: /^@\//, replacement: path.resolve(here, "src") + "/" },
  ] },
  build: { outDir: "dist", emptyOutDir: true, assetsDir: "assets" },
});
