import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => readFile(path.join(root, relativePath));
const readText = async relativePath => (await read(relativePath)).toString('utf8');

test('package identity is Lab Tracker 1.0.1 with no SDK capabilities', async () => {
  const packageJson = JSON.parse(await readText('package.json'));
  const manifest = JSON.parse(await readText('app.manifest.json'));

  assert.equal(packageJson.name, 'company.dental.lab-tracker');
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

test('trusted metadata defines the two modules and their access capabilities', async () => {
  const metadata = JSON.parse(await readText('app.json'));

  assert.equal(metadata.appId, 'company.dental.lab-tracker');
  assert.equal(metadata.title, 'Lab Tracker');
  assert.equal(metadata.icon, 'assets/lab.png');
  assert.deepEqual(metadata.anyCapabilities, ['lab_tracker.access']);
  assert.deepEqual(metadata.modules, [
    { id: 'lab-tracker', label: 'Lab Tracker', tab: 'lab-tracker', capability: 'lab_tracker.access' },
    { id: 'lab-supplier-record', label: 'Lab supplier record', tab: 'lab-supplier-record', capability: 'lab_tracker.access' },
  ]);
});

test('the static centered-label shell is staging-marked and cannot access business data', async () => {
  const html = await readText('src/index.html');
  const css = await readText('src/app.css');
  const js = await readText('src/app.js');
  const source = `${html}\n${css}\n${js}`;

  assert.match(html, /<h1 id="app-title">Lab Tracker<\/h1>/);
  assert.match(html, /<p class="preview-indicator" role="status">Staging preview · v1\.0\.1<\/p>/);
  assert.match(html, /<button class="more-apps" id="more-apps" type="button" aria-label="More Lab Tracker apps">/);
  assert.match(html, /<script src="\.\/app\.js" defer><\/script>/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /frame-ancestors 'none'/);
  assert.match(js, /onModuleSelected\(\(\{ moduleId \}\)/);
  assert.match(js, /openAppExplorer\(\)/);
  assert.match(js, /title\.textContent = label/);
  assert.match(js, /activeModule\.textContent = label/);
  assert.doesNotMatch(source, /<form\b|<input\b|fetch\s*\(|XMLHttpRequest|\/v1\/|dentalApp\.request|window\.desktop/i);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie|patientName|patientId|authorization|password|clientSecret|access_token|refresh_token/i);
  assert.match(css, /\.app-shell\s*\{[^}]*display:\s*grid;[^}]*min-height:\s*100vh;[^}]*place-items:\s*center;/s);
});

test('the one bundled app icon is optimized from the existing Lab dock artwork', async () => {
  const metadata = JSON.parse(await readText('app.json'));
  const icon = await read(metadata.icon);
  const original = await read('../../../src/assets/dock/lab.png');

  assert.equal(icon.readUInt32BE(16), 512);
  assert.equal(icon.readUInt32BE(20), 512);
  assert.ok(icon.length < original.length);
  assert.ok((await stat(path.join(root, metadata.icon))).size < 2 * 1024 * 1024);
});
