import { build } from 'vite';
import { existsSync, cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const outRoot = path.join(root, 'apps/browser/dist');
const apps = {
  appointments: 'appointments.m17',
  patients: 'patient-record.m17',
  calendar: 'calendar.m17',
  finance: 'finance.m17',
  followups: 'followups.m17',
  staff: 'staff.m17',
  lab: 'lab-tracker.m17',
  treatment: 'treatment-progress.m17',
  protocols: 'm17.treatment-protocols',
  workentry: 'work-entry.m17',
};
const ids = process.argv.slice(2);
const targets = ids.length ? ids : Object.keys(apps);
if (!targets.length || targets.some(id => !Object.hasOwn(apps, id))) {
  console.error('Usage: npm run build:apps -- [appointments|patients|calendar|finance|followups|staff|lab|treatment|protocols|workentry] ...');
  process.exit(1);
}
const dentalUi = path.join(root, 'packages/dental-ui/src/shared');
for (const id of targets) {
  const app = path.join(root, 'apps/dental-apps/company.dental.' + apps[id]);
  if (!existsSync(path.join(app, 'src/main.tsx')) || !existsSync(path.join(app, 'index.html'))) {
    throw new Error('M17 source missing for ' + id);
  }
  const appSrc = path.join(app, 'src');
  const aliases = [];
  if (id === 'patients') {
    const saas = path.join(app, 'vendor/dental-saas/apps/clinic-web/src');
    aliases.push(
      { find: /^@\/shared\//, replacement: path.join(saas, 'shared') + '/' },
      { find: /^@\/features\//, replacement: path.join(saas, 'features') + '/' },
      { find: /^@\/shell\//, replacement: path.join(saas, 'shell') + '/' },
    );
  } else {
    if (id === 'finance' || id === 'staff' || id === 'lab') {
      aliases.push({ find: '@/shared/dates/MonthPicker', replacement: path.join(appSrc, 'shared/dates/MonthPicker.tsx') });
    }
    if (id === 'lab' || id === 'workentry') {
      aliases.push({ find: '@/shared/ui/ConfirmDialog', replacement: path.join(appSrc, 'shared/ui/ConfirmDialog.tsx') });
    }
    if (id === 'workentry') {
      aliases.push({ find: '@/shared/money', replacement: path.join(appSrc, 'shared/money') });
    }
    aliases.push({ find: '@/shared', replacement: dentalUi });
  }
  aliases.push({ find: '@', replacement: appSrc });
  const outDir = path.join(outRoot, id);
  console.log('Building original M17 React UI for browser:', id);
  await build({
    configFile: false,
    root: app,
    base: '/apps/browser/dist/' + id + '/',
    resolve: { alias: aliases },
    oxc: { jsx: { runtime: 'automatic' } },
    build: {
      outDir,
      emptyOutDir: true,
      sourcemap: false,
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/app.js',
          chunkFileNames: 'assets/chunk-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  });
  if (existsSync(path.join(app, 'assets'))) {
    mkdirSync(path.join(outDir, 'assets'), { recursive: true });
    cpSync(path.join(app, 'assets'), path.join(outDir, 'assets'), { recursive: true });
  }
  writeFileSync(path.join(outDir, 'browser-port.json'), JSON.stringify({
    source: 'company.dental.' + apps[id], appId: id, transport: 'MessageChannel',
    status: 'read-only', built: new Date().toISOString(),
  }, null, 2));
}
console.log('Browser M17 builds complete. No installer, app store or Electron runtime generated.');
