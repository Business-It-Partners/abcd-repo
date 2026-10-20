import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readText = relative => readFileSync(resolve(appRoot, relative), 'utf8');
const manifest = JSON.parse(readText('app.manifest.json'));
const metadata = JSON.parse(readText('app.json'));
const html = readText('src/index.html');
const css = readText('src/app.css');

test('package manifest is a capability-free Staff 1.0.0 app', () => {
  const packageJson = JSON.parse(readText('package.json'));

  assert.equal(packageJson.name, 'company.dental.staff');
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

test('trusted app metadata declares the Staff module and access capability', () => {
  assert.deepEqual(Object.keys(metadata).sort(), ['allowedRoles', 'anyCapabilities', 'appId', 'description', 'excludedRoles', 'format', 'icon', 'modules', 'title']);
  assert.equal(metadata.format, 1);
  assert.equal(metadata.appId, manifest.appId);
  assert.equal(metadata.title, 'Staff');
  assert.equal(metadata.icon, 'assets/staff.png');
  assert.deepEqual(metadata.anyCapabilities, ['staff.manage']);
  assert.deepEqual(metadata.excludedRoles, []);
  assert.deepEqual(metadata.allowedRoles, []);
  assert.deepEqual(metadata.modules, [{
    id: 'staff',
    label: 'Staff',
    tab: 'staff',
    capability: 'staff.manage',
  }]);
});

test('placeholder page centers Staff and identifies the staging preview', () => {
  assert.match(html, /<title>Staff<\/title>/);
  assert.match(html, /<h1 id="app-title">Staff<\/h1>/);
  assert.match(html, /<p class="preview-indicator" role="status">Staging preview · v1\.0\.0<\/p>/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /script-src 'none'/);
  assert.match(css, /\.app-shell\s*\{[^}]*display:\s*grid;[^}]*place-items:\s*center/s);
  assert.match(css, /text-align:\s*center/);
});

test('placeholder contains no workflows, SaaS calls, storage, or credentials', () => {
  const content = `${html}\n${css}`;

  assert.doesNotMatch(html, /<(?:form|input|button|textarea|select)\b/i);
  assert.doesNotMatch(content, /\b(?:fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB)\b|\/v1\/|dentalApp|clinic\.api/i);
  assert.doesNotMatch(content, /https?:\/\//i);
});

test('bundled Staff thumbnail is a bounded PNG suitable for dentalpkg', () => {
  const artworkPath = resolve(appRoot, metadata.icon);
  const artwork = readFileSync(artworkPath);

  assert.deepEqual([...artwork.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(artwork.readUInt32BE(16) <= 512);
  assert.ok(artwork.readUInt32BE(20) <= 512);
  assert.ok(statSync(artworkPath).size < 2 * 1024 * 1024);
});
