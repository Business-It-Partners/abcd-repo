import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readText = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const readJson = relative => JSON.parse(readText(relative));

const labels = [
  'Transaction Record',
  'Patient payments',
  'General expenses',
  'Salary payments',
  'Product list',
  'Purchases',
  'Supplier list',
  'Supplier payments',
];
const moduleIds = [
  'transaction-record',
  'patient-payments',
  'general-expenses',
  'salary-payments',
  'product-list',
  'purchases',
  'supplier-list',
  'supplier-payments',
];

test('Finance package is v1.0.1 with no Dental OS SDK capabilities', () => {
  const packageJson = readJson('package.json');
  const manifest = readJson('app.manifest.json');

  assert.equal(packageJson.name, 'company.dental.finance');
  assert.equal(packageJson.version, '1.0.1');
  assert.equal(manifest.appId, packageJson.name);
  assert.equal(manifest.publisher, 'company');
  assert.equal(manifest.version, '1.0.1');
  assert.equal(manifest.entry, 'src/index.html');
  assert.equal(manifest.sdkMajor, 1);
  assert.equal(manifest.apiMajor, 1);
  assert.deepEqual(Object.keys(manifest).sort(), ['apiMajor', 'appId', 'capabilities', 'entry', 'publisher', 'sdkMajor', 'version']);
  assert.deepEqual(manifest.capabilities, []);
});

test('Finance metadata keeps the exact module inventory, IDs, tabs, and M12 access policy', () => {
  const metadata = readJson('app.json');
  const tabs = [
    'finance/transactions',
    'finance/patient-payments',
    'finance/operating-expenses',
    'finance/salary-payouts',
    'finance/products',
    'finance/purchases',
    'finance/suppliers',
    'finance/supplier-payments',
  ];

  assert.deepEqual(Object.keys(metadata).sort(), ['allowedRoles', 'anyCapabilities', 'appId', 'description', 'excludedRoles', 'format', 'icon', 'modules', 'title']);
  assert.equal(metadata.format, 1);
  assert.equal(metadata.appId, 'company.dental.finance');
  assert.equal(metadata.title, 'Finance');
  assert.equal(metadata.icon, 'assets/finance.png');
  assert.deepEqual(metadata.anyCapabilities, ['finance.manage', 'patient_payments.outstanding.read']);
  assert.deepEqual(metadata.excludedRoles, ['reception']);
  assert.deepEqual(metadata.allowedRoles, []);
  assert.deepEqual(metadata.modules.map(module => module.id), moduleIds);
  assert.deepEqual(metadata.modules.map(module => module.label), labels);
  assert.deepEqual(metadata.modules.map(module => module.tab), tabs);
  assert.deepEqual(metadata.modules.map(module => module.capability), [
    'finance.manage',
    'patient_payments.outstanding.read',
    ...Array(6).fill('finance.manage'),
  ]);
});

test('static shell centers the default module title and marks the staging preview', () => {
  const html = readText('src/index.html');
  const css = readText('src/app.css');
  const js = readText('src/app.js');

  assert.match(html, /<title>Transaction Record<\/title>/);
  assert.match(html, /<h1 id="app-title" tabindex="-1">Transaction Record<\/h1>/);
  assert.match(html, /id="active-module" aria-live="polite">Transaction Record<\/span>/);
  assert.match(html, /id="more-apps" type="button" aria-label="More Finance apps"/);
  assert.match(html, /<script src=".\/app.js" defer><\/script>/);
  assert.match(js, /window\.dentalApp\.openAppExplorer\(\)/);
  assert.match(js, /window\.dentalApp\.onModuleSelected\(\(\{ moduleId \}\)/);
  assert.match(js, /heading\.textContent = label/);
  assert.match(js, /activeModule\.textContent = label/);
  assert.match(html, /<p class="preview-indicator" role="status">Staging preview · v1\.0\.1<\/p>/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /script-src 'self'/);
  assert.match(css, /\.app-content\s*\{[^}]*display:\s*grid;[^}]*min-height:\s*calc\(100vh - 44px\);[^}]*place-items:\s*center;/s);
  assert.match(css, /text-align:\s*center/);
});

test('placeholder has no workflows, SaaS calls, patient data, credentials, or local business storage', () => {
  const source = `${readText('src/index.html')}\n${readText('src/app.css')}`;

  assert.doesNotMatch(source, /<(?:form|input|textarea|select)\b/i);
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB)\b|\/v1\/|clinic\.api/i);
  assert.doesNotMatch(source, /patientName|patientId|authorization|password|clientSecret|access_token|refresh_token/i);
  assert.doesNotMatch(source, /https?:\/\//i);
  assert.doesNotMatch(readText('src/app.js'), /\b(?:fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB)\b|\/v1\/|clinic\.api|patientName|patientId|authorization|password|clientSecret|access_token|refresh_token/i);
});

test('the only bundled module thumbnail is an optimized copy of the main Finance artwork', () => {
  const metadata = readJson('app.json');
  const assets = fs.readdirSync(path.join(root, 'assets'));
  const artwork = fs.readFileSync(path.join(root, metadata.icon));
  const original = fs.readFileSync(path.resolve(root, '../../../src/assets/dock/finance.png'));

  assert.deepEqual(assets, ['finance.png']);
  assert.deepEqual([...artwork.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(artwork.readUInt32BE(16), 512);
  assert.equal(artwork.readUInt32BE(20), 512);
  assert.ok(artwork.length < original.length);
  assert.ok(artwork.length < 2 * 1024 * 1024);
  assert.equal(metadata.modules.length, labels.length);
  assert.ok(metadata.modules.every(module => metadata.icon === 'assets/finance.png'));
});
