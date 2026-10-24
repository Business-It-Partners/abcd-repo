import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readText = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Follow-ups M17 package has its own current release identity', () => {
  const pkg = JSON.parse(readText('package.json'));
  const manifest = JSON.parse(readText('app.manifest.json'));
  const metadata = JSON.parse(readText('app.json'));
  assert.equal(pkg.name, 'company.dental.followups.m17');
  assert.equal(pkg.version, '1.0.3');
  assert.equal(manifest.appId, pkg.name);
  assert.equal(manifest.version, '1.0.3');
  assert.equal(metadata.appId, pkg.name);
  assert.equal(metadata.title, 'Follow-ups');
  assert.deepEqual(manifest.capabilities, ['clinic.app.followups', 'clinic.api.request', 'session.context']);
});

test('Follow-ups M17 source keeps API calls behind the Dental OS SDK', () => {
  const source = readText('src/main.tsx') + readText('src/features/follow-ups/api.ts');
  assert.match(source, /sdk\.initialize\('company\.dental\.followups\.m17'\)/);
  assert.match(source, /ClinicClient/);
  assert.doesNotMatch(source, /company\.dental\.followups['"]/);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|axios\s*\(/);
});

test('Follow-ups M17 builder targets only its new app directory', () => {
  const pkg = JSON.parse(readText('package.json'));
  const builder = fs.readFileSync(path.resolve(root, '../../../tools/app-packages/build-followups-m17.mjs'), 'utf8');
  assert.equal(pkg.scripts.build, 'node ../../../tools/app-packages/build-followups-m17.mjs');
  assert.match(builder, /company\.dental\.followups\.m17/);
});
