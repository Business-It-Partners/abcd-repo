import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readText = (relative) => readFileSync(resolve(appRoot, relative), 'utf8');
const manifest = JSON.parse(readText('app.manifest.json'));
const metadata = JSON.parse(readText('app.json'));
const html = readText('src/index.html');
const css = readText('src/app.css');

test('package manifest is a capability-free Patient payments 1.0.0 app', () => {
  assert.deepEqual(Object.keys(manifest).sort(), ['apiMajor', 'appId', 'capabilities', 'entry', 'publisher', 'sdkMajor', 'version']);
  assert.equal(manifest.appId, 'company.dental.patient-payments');
  assert.equal(manifest.publisher, 'company');
  assert.equal(manifest.version, '1.0.0');
  assert.equal(manifest.entry, 'src/index.html');
  assert.equal(manifest.sdkMajor, 1);
  assert.equal(manifest.apiMajor, 1);
  assert.deepEqual(manifest.capabilities, []);
});

test('trusted metadata defines the Reception-only Patient payments module', () => {
  assert.deepEqual(Object.keys(metadata).sort(), ['allowedRoles', 'anyCapabilities', 'appId', 'description', 'excludedRoles', 'format', 'icon', 'modules', 'title']);
  assert.equal(metadata.format, 1);
  assert.equal(metadata.appId, manifest.appId);
  assert.equal(metadata.title, 'Patient payments');
  assert.equal(metadata.icon, 'assets/finance.png');
  assert.deepEqual(metadata.anyCapabilities, ['patient_payments.outstanding.read']);
  assert.deepEqual(metadata.excludedRoles, []);
  assert.deepEqual(metadata.allowedRoles, ['reception']);
  assert.deepEqual(metadata.modules, [{
    id: 'patient-payments',
    label: 'Patient payments',
    tab: 'finance/patient-payments',
    capability: 'patient_payments.outstanding.read',
  }]);
});

test('placeholder page centers the exact label and marks its staging version', () => {
  assert.match(html, /<title>Patient payments<\/title>/);
  assert.match(html, /<h1 id="app-title">Patient payments<\/h1>/);
  assert.match(html, /<p class="preview-indicator" role="status">Staging preview · v1\.0\.0<\/p>/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /script-src 'none'/);
  assert.match(css, /\.app-shell\s*\{[^}]*display:\s*grid;[^}]*place-items:\s*center/s);
  assert.match(css, /text-align:\s*center/);
});

test('placeholder contains no workflows, network calls, credentials, or business storage', () => {
  const content = `${html}\n${css}`;
  assert.doesNotMatch(html, /<(?:form|input|button|textarea|select)\b/i);
  assert.doesNotMatch(content, /\b(?:fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB)\b|\/v1\/|dentalApp|clinic\.api/i);
  assert.doesNotMatch(content, /patientId|authorization|password|clientSecret|access_token|refresh_token/i);
  assert.doesNotMatch(content, /https?:\/\//i);
});

test('bundled thumbnail is the existing main Finance app thumbnail', () => {
  const iconPath = resolve(appRoot, metadata.icon);
  const icon = readFileSync(iconPath);
  const financeIcon = readFileSync(resolve(appRoot, '../company.dental.finance/assets/finance.png'));
  assert.deepEqual(readdirSync(resolve(appRoot, 'assets')), ['finance.png']);
  assert.deepEqual([...icon.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(icon.readUInt32BE(16), 512);
  assert.equal(icon.readUInt32BE(20), 512);
  assert.ok(icon.length < 2 * 1024 * 1024);
  assert.equal(statSync(iconPath).size, financeIcon.length);
  assert.deepEqual(icon, financeIcon);
});
