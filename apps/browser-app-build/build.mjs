import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { build } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const packageDir = path.dirname(fileURLToPath(import.meta.url));
const dentalUi = path.join(root, 'packages/dental-ui/src/shared');
const buildDependencies = path.join(packageDir, 'node_modules');
const workEntry = path.join(root, 'apps/dental-apps/company.dental.work-entry.m17');
const patientRecord = path.join(root, 'apps/dental-apps/company.dental.patient-record.m17');
const appointments = path.join(root, 'apps/dental-apps/company.dental.appointments.m17');
const followups = path.join(root, 'apps/dental-apps/company.dental.followups.m17');
const staff = path.join(root, 'apps/dental-apps/company.dental.staff.m17');
const lab = path.join(root, 'apps/dental-apps/company.dental.lab-tracker.m17');

const applications = [
  {
    id: 'workentry', title: 'Work Entry', version: '1.0.2', name: 'DentalOSWorkEntry',
    appDir: workEntry, entry: path.join(workEntry, 'src/main.tsx'),
    aliases: [
      { find: /^@\/shared\/money\//, replacement: path.join(workEntry, 'src/shared/money') + '/' },
      { find: /^@\/shared\/ui\/ConfirmDialog$/, replacement: path.join(workEntry, 'src/shared/ui/ConfirmDialog.tsx') },
      { find: /^@\/shared\//, replacement: dentalUi + '/' },
      { find: /^@\//, replacement: path.join(workEntry, 'src') + '/' },
    ],
    manifestName: 'workEntry',
  },
  {
    id: 'patients', title: 'Patients', version: '1.0.2', name: 'DentalOSPatientRecord',
    appDir: patientRecord, entry: path.join(patientRecord, 'src/main.tsx'),
    aliases: [
      { find: /^@\/shared\/api\/httpClient$/, replacement: path.join(patientRecord, 'src/browserClinicApiError.ts') },
      { find: /^@\/shared\/ui\/StandardPageScroll$/, replacement: path.join(dentalUi, 'ui/StandardPageScroll.tsx') },
      { find: /^@\/shared\//, replacement: path.join(patientRecord, 'vendor/dental-saas/apps/clinic-web/src/shared') + '/' },
      { find: /^@\/features\//, replacement: path.join(patientRecord, 'vendor/dental-saas/apps/clinic-web/src/features') + '/' },
      { find: /^@\/shell\//, replacement: path.join(patientRecord, 'vendor/dental-saas/apps/clinic-web/src/shell') + '/' },
      { find: /^@\//, replacement: path.join(patientRecord, 'src') + '/' },
    ],
    manifestName: 'patientRecord',
  },
  {
    id: 'appointments', title: 'Appointments', version: '1.0.9', name: 'DentalOSAppointments',
    appDir: appointments, entry: path.join(appointments, 'src/main.tsx'),
    aliases: [
      { find: /^@\/shared\//, replacement: dentalUi + '/' },
      { find: /^@\//, replacement: path.join(appointments, 'src') + '/' },
    ],
    manifestName: 'appointments',
  },
  {
    id: 'followups', title: 'Follow-ups', version: '1.0.6', name: 'DentalOSFollowups',
    appDir: followups, entry: path.join(followups, 'src/main.tsx'),
    aliases: [
      { find: /^@\/shared\//, replacement: dentalUi + '/' },
      { find: /^@\/features\//, replacement: path.join(followups, 'src/features') + '/' },
      { find: /^@\/shell\//, replacement: path.join(followups, 'src/shell') + '/' },
      { find: /^@\//, replacement: path.join(followups, 'src') + '/' },
    ],
    manifestName: 'followups',
  },
  {
    id: 'staff', title: 'Staff', version: '1.0.4', name: 'DentalOSStaff',
    appDir: staff, entry: path.join(staff, 'src/main.tsx'),
    aliases: [
      { find: /^@\/shared\/dates\/MonthPicker$/, replacement: path.join(staff, 'src/shared/dates/MonthPicker.tsx') },
      { find: /^@\/shared\//, replacement: dentalUi + '/' },
      { find: /^@\/features\//, replacement: path.join(staff, 'src/features') + '/' },
      { find: /^@\//, replacement: path.join(staff, 'src') + '/' },
    ],
    manifestName: 'staff',
  },
  {
    id: 'lab', title: 'Lab Tracker', version: '1.0.3', name: 'DentalOSLabTracker',
    appDir: lab, entry: path.join(lab, 'src/main.tsx'),
    aliases: [
      { find: /^@\/shared\/ui\/ConfirmDialog$/, replacement: path.join(lab, 'src/shared/ui/ConfirmDialog.tsx') },
      { find: /^@\/shared\/dates\/MonthPicker$/, replacement: path.join(lab, 'src/shared/dates/MonthPicker.tsx') },
      { find: /^@\/shared\//, replacement: dentalUi + '/' },
      { find: /^@\/features\//, replacement: path.join(lab, 'src/features') + '/' },
      { find: /^@\/shell\//, replacement: path.join(lab, 'src/shell') + '/' },
      { find: /^@\/sdk\//, replacement: path.join(lab, 'src/sdk') + '/' },
      { find: /^@\//, replacement: path.join(lab, 'src') + '/' },
    ],
    manifestName: 'lab',
  },
];

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const integrity = bytes => `sha256-${createHash('sha256').update(bytes).digest('base64')}`;

async function buildApplication(app) {
  const tempDir = await mkdtemp(path.join(tmpdir(), `dental-os-${app.id}-`));
  try {
    await build({
      configFile: false,
      root: packageDir,
      base: '/apps/',
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      resolve: {
        alias: [
          { find: 'react/jsx-runtime', replacement: path.join(buildDependencies, 'react/jsx-runtime.js') },
          { find: 'react-dom/client', replacement: path.join(buildDependencies, 'react-dom/client.js') },
          { find: 'react-dom', replacement: path.join(buildDependencies, 'react-dom/index.js') },
          { find: 'react', replacement: path.join(buildDependencies, 'react/index.js') },
          { find: 'lucide-react', replacement: path.join(buildDependencies, 'lucide-react/dist/esm/lucide-react.mjs') },
          { find: '@sbmdkl/nepali-date-converter', replacement: path.join(buildDependencies, '@sbmdkl/nepali-date-converter/dist/@sbmdkl/nepali-date-converter.es.js') },
          ...app.aliases,
        ],
        dedupe: ['react', 'react-dom'],
      },
      esbuild: { jsx: 'automatic' },
      build: {
        outDir: tempDir,
        emptyOutDir: true,
        copyPublicDir: false,
        assetsInlineLimit: 50 * 1024 * 1024,
        cssCodeSplit: false,
        lib: { entry: app.entry, name: app.name, formats: ['iife'], fileName: () => `${app.id}.v1.js` },
        rollupOptions: { output: { assetFileNames: `${app.id}.v1.[ext]` } },
        minify: 'oxc', reportCompressedSize: false, sourcemap: false,
      },
    });
    const script = await readFile(path.join(tempDir, `${app.id}.v1.js`));
    const style = await readFile(path.join(tempDir, `${app.id}.v1.css`));
    const styleText = new TextDecoder('utf-8', { fatal: true }).decode(style);
    const scriptSri = integrity(script);
    const styleCspHash = integrity(style).slice('sha256-'.length);
    const scriptCspHash = scriptSri.slice('sha256-'.length);
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="referrer" content="no-referrer" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${scriptCspHash}'; style-src 'sha256-${styleCspHash}'; style-src-attr 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'" />
    <title>${app.title}</title>
    <style>${styleText}</style>
    <script defer src="/apps/${app.id}.v1.js" integrity="${scriptSri}" crossorigin="anonymous"></script>
  </head>
  <body><div id="root"><main role="status">Opening ${app.title}…</main></div></body>
</html>
`;
    await writeFile(path.join(root, `apps/${app.id}.v1.js`), script);
    await writeFile(path.join(root, `apps/${app.id}.v1.css`), style);
    await writeFile(path.join(root, `apps/${app.id}.v1.html`), html);
    const bundle = {
      entry: `/apps/${app.id}.v1.html`, entrySha256: sha256(Buffer.from(html)),
      script: `/apps/${app.id}.v1.js`, scriptSha256: sha256(script),
      style: `/apps/${app.id}.v1.css`, styleSha256: sha256(style),
    };
    const appManifest = path.join(app.appDir, 'asset-manifest.js');
    await writeFile(appManifest, `export const ${app.manifestName}Bundle = Object.freeze(${JSON.stringify(bundle, null, 2)});\nexport const ${app.manifestName}Version = ${JSON.stringify(app.version)};\n`);
    console.log(`Built ${app.title} ${app.version}: ${script.byteLength} JS bytes, ${style.byteLength} CSS bytes.`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

const requested = process.argv.find(argument => argument.startsWith('--apps='))?.slice('--apps='.length)
  .split(',').filter(Boolean);
const selected = requested ? applications.filter(app => requested.includes(app.id)) : applications;
if (requested && selected.length !== requested.length) throw new Error('Unknown browser app id in --apps.');
for (const app of selected) await buildApplication(app);
