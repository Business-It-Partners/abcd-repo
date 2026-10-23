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
    { find: /^@\/shared\//, replacement: path.resolve(here, "../../../packages/dental-ui/src/shared") + "/" },
    { find: /^@\//, replacement: path.resolve(here, "src") + "/" },
  ] },
  build: { outDir: "dist", emptyOutDir: true, assetsDir: "assets" },
});
