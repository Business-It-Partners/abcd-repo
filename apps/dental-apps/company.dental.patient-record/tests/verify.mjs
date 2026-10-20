import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const readText = relative => readFile(path.join(root, relative), 'utf8');
const manifest = JSON.parse(await readText('app.manifest.json'));
const metadata = JSON.parse(await readText('app.json'));
const html = await readText(manifest.entry);
const css = await readText('src/app.css');

test('package identity is Patient Record 1.0.0 and requests no app capabilities', () => {
  assert.deepEqual(Object.keys(manifest).sort(), [
    'apiMajor', 'appId', 'capabilities', 'entry', 'publisher', 'sdkMajor', 'version',
  ]);
  assert.equal(manifest.appId, 'company.dental.patient-record');
  assert.equal(manifest.publisher, 'company');
  assert.equal(manifest.version, '1.0.0');
  assert.equal(manifest.entry, 'src/index.html');
  assert.equal(manifest.sdkMajor, 1);
  assert.equal(manifest.apiMajor, 1);
  assert.deepEqual(manifest.capabilities, []);
});

test('trusted app metadata exposes exactly the Patient Record module and icon', () => {
  assert.equal(metadata.appId, manifest.appId);
  assert.equal(metadata.title, 'Patient Record');
  assert.equal(metadata.icon, 'assets/patients.png');
  assert.deepEqual(metadata.anyCapabilities, ['patient_record.access']);
  assert.deepEqual(metadata.modules, [{
    id: 'patient-record', label: 'Patient Record', tab: 'patient-record', capability: 'patient_record.access',
  }]);
});

test('the placeholder is centered, marked as staging, and has no workflow or network code', () => {
  assert.match(html, /<h1 id="app-title">Patient Record<\/h1>/);
  assert.match(html, /<p class="preview-indicator" role="status">Staging preview · v1\.0\.0<\/p>/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /script-src 'none'/);
  assert.match(html, /frame-ancestors 'none'/);
  assert.doesNotMatch(html, /<script\b|<form\b|<input\b|<button\b/i);
  assert.doesNotMatch(html, /https?:\/\/|\/v1\/|fetch\s*\(|XMLHttpRequest|WebSocket|EventSource/i);
  assert.match(css, /\.app-shell\s*\{[^}]*display:\s*grid;[^}]*place-items:\s*center/s);
  assert.doesNotMatch(css, /https?:\/\/|url\s*\(|@import/i);
});

test('bundled icon is the optimized existing Dental OS dock artwork', async () => {
  const iconPath = path.join(root, metadata.icon);
  const icon = await readFile(iconPath);
  const originalIcon = await readFile(path.join(root, '../../../src/assets/dock/patients.png'));
  assert.deepEqual([...icon.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(icon.readUInt32BE(16), 512);
  assert.equal(icon.readUInt32BE(20), 512);
  assert.ok(icon.length < originalIcon.length);
  assert.ok((await stat(iconPath)).size < 2 * 1024 * 1024);
});
