import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const app = path.join(root, 'apps/dental-apps/company.dental.lab-tracker.m17');

await build({
  configFile: false,
  root: app,
  base: './',
  resolve: { alias: [
    { find: '@/shared/ui/ConfirmDialog', replacement: path.join(app, 'src/shared/ui/ConfirmDialog.tsx') },
    { find: '@/shared/dates/MonthPicker', replacement: path.join(app, 'src/shared/dates/MonthPicker.tsx') },
    { find: '@/shared', replacement: path.join(root, 'packages/dental-ui/src/shared') },
    { find: '@', replacement: path.join(app, 'src') },
  ] },
  oxc: { jsx: { runtime: 'automatic' } },
  build: {
    outDir: 'dist', emptyOutDir: true, sourcemap: false, reportCompressedSize: false,
    rollupOptions: { output: { entryFileNames: 'assets/app.js', chunkFileNames: 'assets/chunk-[hash].js', assetFileNames: 'assets/app.css' } },
  },
});

fs.cpSync(path.join(app, 'assets'), path.join(app, 'dist/assets'), { recursive: true });
fs.copyFileSync(path.join(app, 'app.json'), path.join(app, 'dist/app.json'));
