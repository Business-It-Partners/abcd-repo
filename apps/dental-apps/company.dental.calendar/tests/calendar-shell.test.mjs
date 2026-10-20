import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readText = (relative) => readFileSync(resolve(appRoot, relative), 'utf8');
const packageJson = JSON.parse(readText('package.json'));
const manifest = JSON.parse(readText('app.manifest.json'));
const metadata = JSON.parse(readText('app.json'));
const html = readText('src/index.html');
const css = readText('src/app.css');

test('package metadata and manifest identify a capability-free Calendar 1.0.0 app', () => {
  assert.equal(packageJson.name, 'company.dental.calendar');
  assert.equal(packageJson.version, '1.0.0');
  assert.deepEqual(Object.keys(manifest).sort(), ['apiMajor', 'appId', 'capabilities', 'entry', 'publisher', 'sdkMajor', 'version']);
  assert.equal(manifest.appId, packageJson.name);
  assert.equal(manifest.publisher, 'company');
  assert.equal(manifest.version, '1.0.0');
  assert.equal(manifest.entry, 'src/index.html');
  assert.equal(manifest.sdkMajor, 1);
  assert.equal(manifest.apiMajor, 1);
  assert.deepEqual(manifest.capabilities, []);
});

test('trusted metadata matches Calendar identity, module, and visibility capability', () => {
  assert.deepEqual(Object.keys(metadata).sort(), ['allowedRoles', 'anyCapabilities', 'appId', 'description', 'excludedRoles', 'format', 'icon', 'modules', 'title']);
  assert.equal(metadata.format, 1);
  assert.equal(metadata.appId, manifest.appId);
  assert.equal(metadata.title, 'Calendar');
  assert.equal(metadata.icon, 'assets/calendar.png');
  assert.deepEqual(metadata.anyCapabilities, ['calendar.access']);
  assert.deepEqual(metadata.excludedRoles, []);
  assert.deepEqual(metadata.allowedRoles, []);
  assert.deepEqual(metadata.modules, [{
    id: 'calendar',
    label: 'Calendar',
    tab: 'calendar',
    capability: 'calendar.access',
  }]);
});

test('placeholder page centers the Calendar label and marks its staging version', () => {
  assert.match(html, /<title>Calendar<\/title>/);
  assert.match(html, /<h1 id="app-title">Calendar<\/h1>/);
  assert.match(html, /<p class="preview-indicator" role="status">Staging preview · v1\.0\.0<\/p>/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /script-src 'none'/);
  assert.match(css, /\.app-shell\s*\{[^}]*display:\s*grid;[^}]*place-items:\s*center/s);
  assert.match(css, /text-align:\s*center/);
});

test('placeholder has no calendar workflow, network, storage, or credential handling', () => {
  const content = `${html}\n${css}`;
  assert.doesNotMatch(html, /<(?:form|input|button|textarea|select)\b/i);
  assert.doesNotMatch(content, /\b(?:fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB)\b|\/v1\/|dentalApp|clinic\.api/i);
  assert.doesNotMatch(content, /patientId|appointmentId|authorization|password|clientSecret|access_token|refresh_token/i);
  assert.doesNotMatch(content, /https?:\/\//i);
});

test('bundled Calendar artwork is a bounded PNG derived from the main app thumbnail', () => {
  const iconPath = resolve(appRoot, metadata.icon);
  const icon = readFileSync(iconPath);
  const sourceArtwork = readFileSync(resolve(appRoot, '../../../src/assets/dock/calendar.png'));

  assert.deepEqual(readdirSync(resolve(appRoot, 'assets')), ['calendar.png']);
  assert.deepEqual([...icon.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(icon.readUInt32BE(16) <= 512);
  assert.ok(icon.readUInt32BE(20) <= 512);
  assert.ok(icon.length < sourceArtwork.length);
  assert.ok(statSync(iconPath).size < 2 * 1024 * 1024);
});
