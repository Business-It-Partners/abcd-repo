import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFile(path.join(root, relativePath));
const readText = async relativePath => (await read(relativePath)).toString('utf8');

test('package identity is Appointments 1.0.0 with no app API capabilities', async () => {
  const packageJson = JSON.parse(await readText('package.json'));
  const manifest = JSON.parse(await readText('app.manifest.json'));

  assert.equal(packageJson.name, 'company.dental.appointments');
  assert.equal(packageJson.version, '1.0.0');
  assert.equal(manifest.appId, packageJson.name);
  assert.equal(manifest.publisher, 'company');
  assert.equal(manifest.version, '1.0.0');
  assert.equal(manifest.entry, 'src/index.html');
  assert.equal(manifest.sdkMajor, 1);
  assert.equal(manifest.apiMajor, 1);
  assert.deepEqual(Object.keys(manifest).sort(), ['apiMajor', 'appId', 'capabilities', 'entry', 'publisher', 'sdkMajor', 'version']);
  assert.deepEqual(manifest.capabilities, []);
});

test('the window centers the exact label and clearly marks the staging preview', async () => {
  const html = await readText('src/index.html');
  const css = await readText('src/app.css');

  assert.match(html, /<h1 id="appointments-title">Appointments<\/h1>/);
  assert.match(html, /<p class="preview-indicator" role="status">Staging preview · v1\.0\.0<\/p>/);
  assert.match(css, /\.app-shell\s*\{[^}]*display:\s*grid;[^}]*min-height:\s*100vh;[^}]*place-items:\s*center;/s);
  assert.match(css, /\.preview-indicator\s*\{[^}]*position:\s*absolute;/s);
});

test('the shell has no workflows, business calls, patient data, storage, or credentials', async () => {
  const html = await readText('src/index.html');
  const css = await readText('src/app.css');
  const source = `${html}\n${css}`;

  assert.doesNotMatch(source, /<script\b|<form\b|<input\b|fetch\s*\(|XMLHttpRequest|\/v1\/|dentalApp\.request|window\.desktop/i);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie|patientName|patientId|authorization|password|clientSecret|access_token|refresh_token/i);
  assert.match(html, /connect-src 'none'/);
});

test('the app metadata uses the existing Appointments icon and preview label', async () => {
  const metadata = JSON.parse(await readText('app.json'));
  const artwork = await read(metadata.icon);

  assert.deepEqual(Object.keys(metadata).sort(), ['allowedRoles', 'anyCapabilities', 'appId', 'description', 'excludedRoles', 'format', 'icon', 'modules', 'title']);
  assert.equal(metadata.appId, 'company.dental.appointments');
  assert.equal(metadata.title, 'Appointments');
  assert.equal(metadata.icon, 'assets/appointments.png');
  assert.equal(metadata.modules.length, 1);
  assert.equal(metadata.modules[0].label, 'Appointments');
  assert.equal(metadata.modules[0].capability, 'appointments.access');
  assert.equal(artwork.readUInt32BE(16), 512);
  assert.equal(artwork.readUInt32BE(20), 512);
  const original = await read('../../../src/assets/dock/appointments.png');
  assert.ok(original.readUInt32BE(16) > 512);
  assert.ok(original.readUInt32BE(20) > 512);
  assert.ok(original.length > artwork.length);
});
