import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readText = (relative) => readFileSync(resolve(appRoot, relative), 'utf8');
const manifest = JSON.parse(readText('app.manifest.json'));
const metadata = JSON.parse(readText('app.json'));
const html = readText('src/index.html');
const css = readText('src/app.css');

test('package manifest is a capability-free Work Entry 1.0.0 app', () => {
  assert.deepEqual(Object.keys(manifest).sort(), ['apiMajor', 'appId', 'capabilities', 'entry', 'publisher', 'sdkMajor', 'version']);
  assert.equal(manifest.appId, 'company.dental.work-entry');
  assert.equal(manifest.publisher, 'company');
  assert.equal(manifest.version, '1.0.0');
  assert.equal(manifest.entry, 'src/index.html');
  assert.equal(manifest.sdkMajor, 1);
  assert.equal(manifest.apiMajor, 1);
  assert.deepEqual(manifest.capabilities, []);
});

test('trusted app metadata names one Work Entry module and uses the copied dock art', () => {
  assert.equal(metadata.format, 1);
  assert.equal(metadata.appId, manifest.appId);
  assert.equal(metadata.title, 'Work Entry');
  assert.equal(metadata.icon, 'assets/workentry.png');
  assert.deepEqual(metadata.anyCapabilities, ['work_entry.access']);
  assert.deepEqual(metadata.modules, [{ id: 'work-entry', label: 'Work Entry', tab: 'work-entry', capability: 'work_entry.access' }]);
  assert.deepEqual(metadata.excludedRoles, []);
  assert.deepEqual(metadata.allowedRoles, []);
});

test('placeholder page centers the exact label and clearly marks its staging version', () => {
  assert.match(html, /<title>Work Entry<\/title>/);
  assert.match(html, /<h1 id="app-title">Work Entry<\/h1>/);
  assert.match(html, /<p class="preview-indicator" role="status">Staging preview · v1\.0\.0<\/p>/);
  assert.doesNotMatch(html, /<img\b/);
  assert.match(html, /connect-src 'none'/);
  assert.match(css, /\.app-shell\s*\{[^}]*display:\s*grid;[^}]*place-items:\s*center/s);
  assert.match(css, /text-align:\s*center/);
});

test('placeholder includes no workflow controls, business API, browser storage or credentials', () => {
  const content = `${html}\n${css}`;
  assert.doesNotMatch(html, /<(?:form|input|button|textarea|select)\b/i);
  assert.doesNotMatch(content, /\b(?:fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB)\b|\/v1\/|dentalApp|clinic\.api/i);
  assert.doesNotMatch(content, /https?:\/\//i);
});

test('copied Work Entry PNG stays within dentalpkg file limits', () => {
  const artworkPath = resolve(appRoot, metadata.icon);
  const artwork = readFileSync(artworkPath);
  assert.deepEqual([...artwork.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(statSync(artworkPath).size < 2 * 1024 * 1024);
});
