import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(app, relative), 'utf8');

test('M17 Work Entry declares its host-mediated patient radiograph capabilities', () => {
  const manifest = JSON.parse(read('app.manifest.json'));
  const packageMetadata = JSON.parse(read('package.json'));
  const metadata = JSON.parse(read('app.json'));
  assert.equal(manifest.appId, 'company.dental.work-entry.m17');
  assert.equal(manifest.version, packageMetadata.version);
  assert.deepEqual(manifest.capabilities, ['clinic.app.work-entry', 'clinic.api.request', 'clinic.media.read', 'clinic.media.upload', 'session.context']);
  assert.equal(metadata.appId, manifest.appId);
  assert.equal(metadata.modules[0].id, 'work-entry');
  assert.deepEqual(metadata.anyCapabilities, ['work_entry.access']);
});

test('Work Entry business adapters use the host SDK and preserve the atomic commit route', () => {
  const source = [
    'src/main.tsx',
    'src/sdk/client.ts',
    'src/sdk/commands.ts',
    'src/features/work-entry/api.ts',
    'src/features/work-entry/WorkEntryWorkspace.tsx',
  ].map(read).join('\n');
  assert.match(source, /ClinicClient/);
  assert.match(source, /\/v1\/work-entry\/commit/);
  assert.match(source, /entry\.commandId/);
  assert.match(source, /The original save is unresolved/);
  assert.doesNotMatch(source, /getIdToken|clinicAuth|firebaseAuth|fetch\s*\(/i);
});

test('existing-case edits and the final clinical commit use separate persisted command keys', () => {
  const source = read('src/features/work-entry/components/CaseEntryView.tsx');
  assert.match(source, /commandId:\s*encounterDraftCommandId\("work-entry-case-update"\)/);
  assert.match(source, /encounterCommandIdRef\.current\s*=\s*encounterDraftCommandId\("work-entry"\)/);
  assert.match(source, /clearEncounterDraftId\("work-entry-case-update"\)/);
});

test('Open Case combines Today’s Work and stage completion in the plan without reordering stages', () => {
  const source = read('src/features/work-entry/components/CaseEntryView.tsx');
  const routes = read('src/features/work-entry/workEntryRouteState.ts');
  const workspace = read('src/features/work-entry/WorkEntryWorkspace.tsx');
  assert.match(source, /filter\(\(wizardStep\) => wizardStep\.n !== 4\)/);
  assert.match(source, /"Today.s Work"/);
  assert.match(source, /showCompletionCheckboxes=\{existingCaseWorkflow\}/);
  assert.match(source, /checked=\{stage\.doneToday\}/);
  assert.match(source, /setGroupStage\(group\.gid, stage\.key, \{ doneToday: event\.currentTarget\.checked \}\)/);
  assert.match(source, /stage\.doneToday && !stage\.alreadyCompleted/);
  assert.match(workspace, /plannedCompletedStages:\s*completedStages/);
  assert.match(source, /step === 4 && !existingCaseWorkflow/);
  assert.doesNotMatch(source, /data-drag-handle|reorderGroupStage|draggable/);
  assert.match(routes, /work:\s*2/);
  assert.match(routes, /plan:\s*2/);
  assert.match(routes, /2:\s*"work"/);
  assert.doesNotMatch(routes, /4:\s*"work"/);
});

test('radiographs are uploaded, previewed, listed, and withdrawn through approved host APIs', () => {
  const source = read('src/features/patients/media/RadiographUploader.tsx');
  const mediaApi = read('src/features/patients/media/api.ts');
  assert.match(source, /type="file"/);
  assert.match(source, /uploadPatientMedia/);
  assert.match(source, /viewPatientMedia/);
  assert.match(source, /Removed by clinician from Work Entry/);
  assert.match(source, /preview will disappear after the service confirms/);
  assert.match(mediaApi, /clinic\.media\.upload/);
  assert.match(mediaApi, /clinic\.media\.read/);
  assert.match(mediaApi, /\/v1\/patient-media\//);
  assert.doesNotMatch(mediaApi, /fetch\s*\(|getIdToken|clinicAuth|firebaseAuth/i);
});

test('source import record pins the production SaaS revision and records adaptations', () => {
  const pin = JSON.parse(read('SOURCE_IMPORT.json'));
  assert.equal(pin.revision, 'f44d3e30ca6f79cba61e32601c53d58826500201');
  assert.equal(pin.branch, 'production');
  assert.equal(pin.appId, 'company.dental.work-entry.m17');
  assert.ok(pin.imports.length >= 50);
  assert.ok(pin.contractReferences.some(reference => reference.source.endsWith('workEntry.routes.ts')));
  assert.ok(pin.imports.every(item => /^[a-f0-9]{64}$/.test(item.sourceSha256)));
});
