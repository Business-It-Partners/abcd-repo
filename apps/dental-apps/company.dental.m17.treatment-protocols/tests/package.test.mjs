import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(appRoot, relative), 'utf8');

test('M17 package has the version 1.0.5 update identity and the treatment protocol SDK family', () => {
  const app = JSON.parse(read('app.json'));
  const manifest = JSON.parse(read('app.manifest.json'));
  const pkg = JSON.parse(read('package.json'));
  assert.equal(app.appId, 'company.dental.m17.treatment-protocols');
  assert.equal(manifest.appId, app.appId);
  assert.equal(manifest.version, '1.0.5');
  assert.equal(pkg.name, app.appId);
  assert.equal(pkg.version, manifest.version);
  assert.deepEqual(manifest.capabilities, ['clinic.app.treatment-protocols', 'clinic.api.request', 'session.context']);
  assert.deepEqual(app.anyCapabilities, ['treatment_protocols.manage']);
});

test('renderer uses the OS API bridge and contains no direct network or browser persistence path', () => {
  const source = `${read('src/main.tsx')}\n${read('src/features/treatment-protocols/api.ts')}`;
  assert.match(source, /new ClinicClient\(/);
  assert.match(source, /\/v1\/treatment-protocols/);
  assert.doesNotMatch(source, /\b(fetch|XMLHttpRequest|WebSocket)\s*\(/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
});

test('packaged page blocks renderer network access and keeps inline SaaS styling available', () => {
  const html = read('index.html');
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /style-src 'self' 'unsafe-inline'/);
});
