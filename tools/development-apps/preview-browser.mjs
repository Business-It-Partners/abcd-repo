import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const appIds = [
  'company.dental.followups.m17', 'company.dental.appointments.m17', 'company.dental.work-entry.m17',
  'company.dental.patient-record.m17', 'company.dental.treatment-progress.m17', 'company.dental.lab-tracker.m17',
  'company.dental.finance.m17', 'company.dental.staff.m17', 'company.dental.m17.treatment-protocols',
  'company.dental.calendar.m17',
];

function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} needs a value`);
  return value;
}

const appId = option('--app');
if (!appIds.includes(appId)) {
  console.error(`Choose one first-party app with --app. Available: ${appIds.join(', ')}`);
  process.exit(2);
}
const sourceRoot = fs.realpathSync(path.resolve(option('--source-root') || toolRoot));
const sourcePackage = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'package.json'), 'utf8'));
if (sourcePackage.name !== 'electron-desktop-prototype') throw new Error('--source-root must point to a Dental OS checkout');
const appRoot = path.join(sourceRoot, 'apps', 'dental-apps', appId);
const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'app.manifest.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
const packageMetadata = JSON.parse(fs.readFileSync(path.join(appRoot, 'app.json'), 'utf8'));
if (manifest.appId !== appId || packageJson.name !== appId || packageMetadata.appId !== appId) throw new Error('The selected source package has mismatched app identity.');
const icon = fs.readFileSync(path.join(appRoot, packageMetadata.icon));
const sampleDataPath = path.join(appRoot, 'preview', 'api-responses.json');
const apiResponses = fs.existsSync(sampleDataPath) ? JSON.parse(fs.readFileSync(sampleDataPath, 'utf8')) : {};
if (!apiResponses || typeof apiResponses !== 'object' || Array.isArray(apiResponses)) throw new Error('preview/api-responses.json must be a JSON object.');
const config = {
  manifest,
  app: { id: appId },
  packageMetadata,
  iconDataUrl: `data:image/png;base64,${icon.toString('base64')}`,
  apiResponses,
};

const dentalUi = path.join(sourceRoot, 'packages', 'dental-ui', 'src', 'shared');
const source = path.join(appRoot, 'src');
const aliases = {
  standard: [
    { find: '@/shared', replacement: dentalUi },
    { find: '@', replacement: source },
  ],
  'company.dental.patient-record.m17': [
    { find: /^@\/shared\//, replacement: path.join(appRoot, 'vendor/dental-saas/apps/clinic-web/src/shared') + '/' },
    { find: /^@\/features\//, replacement: path.join(appRoot, 'vendor/dental-saas/apps/clinic-web/src/features') + '/' },
    { find: /^@\/shell\//, replacement: path.join(appRoot, 'vendor/dental-saas/apps/clinic-web/src/shell') + '/' },
    { find: /^@\//, replacement: source + '/' },
  ],
  'company.dental.work-entry.m17': [
    { find: '@/shared/money', replacement: path.join(source, 'shared/money') },
    { find: '@/shared/ui/ConfirmDialog', replacement: path.join(source, 'shared/ui/ConfirmDialog.tsx') },
    { find: '@/shared', replacement: dentalUi },
    { find: '@', replacement: source },
  ],
  'company.dental.finance.m17': [
    { find: '@/shared/dates/MonthPicker', replacement: path.join(source, 'shared/dates/MonthPicker.tsx') },
    { find: '@/shared', replacement: dentalUi },
    { find: '@', replacement: source },
  ],
  'company.dental.lab-tracker.m17': [
    { find: '@/shared/ui/ConfirmDialog', replacement: path.join(source, 'shared/ui/ConfirmDialog.tsx') },
    { find: '@/shared/dates/MonthPicker', replacement: path.join(source, 'shared/dates/MonthPicker.tsx') },
    { find: '@/shared', replacement: dentalUi },
    { find: '@', replacement: source },
  ],
  'company.dental.staff.m17': [
    { find: /^@\/shared\/dates\/MonthPicker$/, replacement: path.join(source, 'shared/dates/MonthPicker.tsx') },
    { find: /^@\/shared\//, replacement: dentalUi + '/' },
    { find: /^@\//, replacement: source + '/' },
  ],
}[appId] ?? [
  { find: '@/shared', replacement: dentalUi },
  { find: '@', replacement: source },
];

const bridgeUrl = `/@fs/${path.join(toolRoot, 'tools/development-apps/browser-bridge.mjs').replaceAll(path.sep, '/')}`;
const server = await createServer({
  configFile: false,
  root: appRoot,
  base: '/',
  plugins: [
    react(),
    {
      name: 'dental-os-browser-preview-bridge',
      transformIndexHtml() {
        const safeConfig = JSON.stringify(config).replaceAll('<', '\\u003c');
        return { tags: [
          { tag: 'script', children: `window.__DENTAL_BROWSER_PREVIEW__=${safeConfig};`, injectTo: 'head' },
          { tag: 'script', attrs: { type: 'module', src: bridgeUrl }, injectTo: 'head' },
        ] };
      },
    },
  ],
  resolve: { alias: aliases },
  server: {
    host: '127.0.0.1',
    port: Number(option('--port') || 4179),
    strictPort: false,
    open: false,
    fs: { allow: [...new Set([sourceRoot, toolRoot])] },
    headers: {
      'Content-Security-Policy': "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws://127.0.0.1:*; media-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'",
    },
  },
});

await server.listen();
console.log(`Browser source preview: ${server.resolvedUrls?.local[0] ?? `http://127.0.0.1:${server.config.server.port}/`}`);
console.log(`App: ${appId} · source: ${sourceRoot} · HMR on · synthetic demo session/data · writes and native file access disabled`);
console.log('Stop this preview with Ctrl+C. No Dental OS package is built or published.');

const shutdown = async () => { await server.close(); process.exit(0); };
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
