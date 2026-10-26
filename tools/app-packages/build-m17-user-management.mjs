import { build } from "vite";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const app = path.join(root, "apps/dental-apps/company.dental.user-management.m17");
const dentalUi = path.join(root, "packages/dental-ui/src/shared");

await build({
  configFile: false,
  root: app,
  base: "./",
  resolve: {
    alias: [
      { find: /^@\/shared\//, replacement: dentalUi + "/" },
      { find: /^@\//, replacement: path.join(app, "src") + "/" },
    ],
  },
  oxc: { jsx: { runtime: "automatic" } },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/app.js",
        chunkFileNames: ({ name }) => "assets/chunk-" + String(name ?? "app").toLowerCase().replace(/[^a-z0-9_-]/g, "-") + ".js",
        assetFileNames: "assets/app.css",
      },
    },
  },
});

fs.cpSync(path.join(app, "assets"), path.join(app, "dist/assets"), { recursive: true });
fs.copyFileSync(path.join(app, "app.json"), path.join(app, "dist/app.json"));
