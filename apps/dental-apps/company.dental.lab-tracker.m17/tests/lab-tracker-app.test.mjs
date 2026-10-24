import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readText = async relative => (await readFile(path.join(root, relative))).toString('utf8');
const readJson = async relative => JSON.parse(await readText(relative));

test('Lab Tracker package has its own 1.0.3 update identity and two first-party modules', async () => {
  const packageJson = await readJson('package.json');
  const manifest = await readJson('app.manifest.json');
  const app = await readJson('app.json');
  assert.equal(packageJson.name, 'company.dental.lab-tracker.m17');
  assert.equal(packageJson.version, '1.0.3');
  assert.equal(manifest.appId, packageJson.name);
  assert.equal(manifest.version, '1.0.3');
  assert.deepEqual(app.modules.map(module => module.id), ['lab-tracker', 'lab-suppliers']);
  assert.equal(app.appId, packageJson.name);
  assert.equal(app.title, 'Lab Tracker');
  assert.deepEqual(app.anyCapabilities, ['lab_tracker.access']);
  assert.deepEqual(manifest.capabilities, ['clinic.app.lab-tracker', 'clinic.api.request', 'session.context']);
});

test('filterable Lab Tracker pages use the Standard Window 1 table layout', async () => {
  const tracker = await readText('src/features/labs/components/LabTrackerView.tsx');
  const suppliers = await readText('src/features/labs/components/LabsPanel.tsx');
  assert.match(tracker, /<Page sheet standardPage>/);
  assert.match(tracker, /noun="orders"[\s\S]*?standardPage[\s\S]*?filters=/);
  assert.match(suppliers, /standardPage[\s\S]*?filters=/);
  assert.match(suppliers, /PageHeader[\s\S]*?title="Lab supplier record"/);
});

test('Lab Tracker detail summaries omit duplicate helper captions', async () => {
  const tracker = await readText('src/features/labs/components/LabTrackerView.tsx');
  const suppliers = await readText('src/features/labs/components/LabsPanel.tsx');
  assert.doesNotMatch(tracker, /Dispatched date|Choose a supplier to dispatch/);
  assert.doesNotMatch(suppliers, /Add a lab before sending crown, bridge or denture work out/);
});

test('Lab supplier details rely on window Back/Forward without a duplicate page Back button', async () => {
  const detail = await readText('src/features/labs/components/LabSupplierDetailView.tsx');
  assert.doesNotMatch(detail, /back=\{\{/);
});

test('clinic reads and writes use the approved Lab Tracker API paths through ClinicClient', async () => {
  const api = await readText('src/features/labs/api.ts');
  const app = await readText('src/main.tsx');
  assert.match(api, /client\.read<unknown>\('\/v1\/lab-orders'\)/);
  assert.match(api, /client\.read<unknown>\('\/v1\/clinic\/suppliers\?scope=lab'\)/);
  assert.match(api, /\/v1\/lab-orders\/\$\{id\}\/assign/);
  assert.match(api, /\/v1\/lab-orders\/\$\{id\}/);
  assert.match(api, /\/v1\/clinic\/suppliers\/\$\{id\}/);
  assert.match(app, /sdk\.initialize\(APP_ID\)/);
  assert.match(app, /access\.includes\('lab_tracker\.access'\)/);
  assert.match(app, /executeClinicCommand\(command\)/);
  assert.doesNotMatch(`${api}\n${app}`, /\bfetch\s*\(|XMLHttpRequest|authorization|access_token|refresh_token|window\.desktop/);
});

test('workflow uses optimistic row versions, immutable clinical details, and audited cancellation', async () => {
  const app = await readText('src/main.tsx');
  const tracker = await readText('src/features/labs/components/LabTrackerView.tsx');
  const edit = tracker.slice(tracker.indexOf('export function EditLabOrderModal'), tracker.indexOf('// Enhanced Right-Side Drawer Sheet'));
  assert.match(app, /expectedRowVersion: current\.rowVersion/);
  assert.match(app, /status: 'cancelled', receptionNote: reason/);
  assert.match(app, /clearAssignment = true/);
  assert.match(edit, /Clinical request details are read-only after submission/);
  assert.doesNotMatch(edit, /supplierId|procedure:|tooth:|shade:/);
  assert.match(tracker, /Cancelled orders remain here for audit history and cannot be restored/);
  assert.doesNotMatch(tracker, /onRestoreOrder|Restore lab order/);
});

test('source import pins the reviewed Dental SaaS production revision', async () => {
  const source = await readJson('SOURCE_IMPORT.json');
  assert.equal(source.source.repository, 'dental-saas');
  assert.equal(source.source.ref, 'origin/production');
  assert.equal(source.source.commit, 'f44d3e30ca6f79cba61e32601c53d58826500201');
  assert.ok(source.files.some(file => file.path.endsWith('LabTrackerView.tsx')));
  assert.ok(source.files.some(file => file.path.endsWith('labOrders.service.ts')));
  assert.ok(source.files.some(file => file.path.endsWith('suppliers.service.ts')));
});
