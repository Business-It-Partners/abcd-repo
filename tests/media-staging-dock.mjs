// Opt-in local Dock-app media acceptance. Uses synthetic data and Cloudflare staging only.
import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

if (process.env.DENTAL_OS_STAGING_ACCEPTANCE !== 'true' || !process.env.DENTAL_OS_STAGING_CREDENTIAL_FILE || !process.env.DENTAL_OS_STAGING_IMAGE_FILE) {
  throw Error('Explicit staging media Dock acceptance, protected credentials, and a real image file are required');
}

const require = createRequire(import.meta.url);
const { FirebaseClient } = require('../dist-electron/identity/client.js');
const { loadDevelopmentCredentials } = require('../dist-electron/identity/devCredentials.js');
const { staging } = require('../dist-electron/sdk/environment.js');
const { stagingDistribution } = require('../dist-electron/distribution/staging.js');
const credentialFile = process.env.DENTAL_OS_STAGING_CREDENTIAL_FILE;
const imageFile = process.env.DENTAL_OS_STAGING_IMAGE_FILE;
const credentialStat = await fs.lstat(credentialFile);
if (!credentialStat.isFile() || credentialStat.isSymbolicLink() || credentialStat.nlink !== 1 || credentialStat.size > 4096 || (process.platform !== 'win32' && (credentialStat.mode & 0o077) !== 0)) {
  throw Error('Unsafe staging credential input');
}
let credentials = loadDevelopmentCredentials(credentialFile);
if (!credentials) throw Error('Protected staging credentials unavailable');
const imageStat = await fs.lstat(imageFile);
if (!imageStat.isFile() || imageStat.isSymbolicLink() || imageStat.nlink !== 1 || imageStat.size < 1024 || imageStat.size > 10 * 1024 * 1024 || path.extname(imageFile).toLowerCase() !== '.jpg') {
  throw Error('Unsafe staging image input; a regular JPEG between 1 KiB and 10 MiB is required');
}
const image = await fs.readFile(imageFile);
if (image[0] !== 0xff || image[1] !== 0xd8 || image[2] !== 0xff) throw Error('Staging image is not a JPEG file');

const authDiagnosticFile = path.join(os.tmpdir(), `dental-os-staging-auth-${process.pid}-${randomUUID()}.json`);
const env = { ...process.env };
for (const key of ['ELECTRON_RUN_AS_NODE', 'DEBUG', 'PWDEBUG']) delete env[key];
env.DENTAL_OS_AUTH_DIAGNOSTIC_FILE = authDiagnosticFile;
const root = path.resolve(import.meta.dirname, '..');
const appId = 'company.dental.patient-record';
const filename = path.basename(imageFile);
const checksum = createHash('sha256').update(image).digest('hex');
const checks = [];
let app, shell, guest, patientId, passed = false, cleaned = false, phase = 'preflight';
const privateJournalFile = path.join(os.tmpdir(), `dental-os-media-dock-${process.pid}-${Date.now()}.json`);
const journal = { environment: 'cloudfare-staging', marker: `dental-os-media-${randomUUID()}`, patientId: null, assetId: null, phase, checks, auth: null, image: { filename, bytes: image.length, sha256: checksum, source: 'https://commons.wikimedia.org/wiki/File:Dental_Panorama_X-ray.jpg', author: 'Farhang Amini', license: 'https://creativecommons.org/licenses/by/4.0/' } };
const saveJournal = () => fs.writeFile(privateJournalFile, JSON.stringify(journal, null, 2) + '\n', { mode: 0o600 });
const check = (name, condition) => {
  if (!condition) throw Error('Acceptance check failed');
  checks.push(name);
  journal.phase = phase;
  void saveJournal();
  console.log('PASS ' + name);
};
const hashBytes = bytes => createHash('sha256').update(bytes).digest('hex');

async function readSafeAuthDiagnostic() {
  try {
    const stat = await fs.lstat(authDiagnosticFile);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 256 || (process.platform !== 'win32' && (stat.mode & 0o077) !== 0)) return null;
    const value = JSON.parse(await fs.readFile(authDiagnosticFile, 'utf8'));
    if (!['firebase-sign-in', 'clinic-session-resolve', 'session-install'].includes(value?.stage) || !['started', 'complete', 'denied', 'unavailable', 'other', 'timeout'].includes(value?.outcome)) return null;
    return { stage: value.stage, outcome: value.outcome };
  } catch { return null; }
}

async function publicFeed() {
  const hashes = {};
  for (const name of ['catalogue/staging.json', 'update-policy/staging.json']) {
    const response = await fetch(new URL(name, stagingDistribution.publicBase), { redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error('Staging public metadata read failed');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 65536) throw Error('Public metadata bound');
    hashes[name] = hashBytes(bytes);
  }
  return hashes;
}

async function stagingRequest(token, method, requestPath, body, key) {
  if (!requestPath.startsWith('/v1/') || requestPath.includes('..') || requestPath.includes('%') || !token) throw Error('Staging request fence');
  const url = new URL(requestPath, staging.apiBase);
  if (url.origin !== staging.apiBase) throw Error('Staging origin fence');
  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(key ? { 'idempotency-key': key } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'manual',
    signal: AbortSignal.timeout(30000),
  });
  if (response.status >= 300 && response.status < 400) throw Error('Staging redirect denied');
  let value;
  if (response.status !== 204) {
    const text = await response.text();
    if (text.length > 262144) throw Error('Staging response bound');
    try { value = JSON.parse(text); } catch { throw Error(`Staging returned HTTP ${response.status}`); }
  }
  if (!response.ok) throw Error(`Staging returned HTTP ${response.status}`);
  return { status: response.status, value };
}

async function cleanupSyntheticMedia() {
  if (!patientId || !credentials) return;
  phase = 'synthetic-media-cleanup';
  const auth = new FirebaseClient();
  const tokens = await auth.signIn(credentials.email, credentials.password, AbortSignal.timeout(20000));
  const clinic = await auth.resolve(tokens.idToken, AbortSignal.timeout(20000));
  if (clinic.role !== 'admin' || !clinic.capabilities.includes('patient_record.access')) throw Error('Synthetic cleanup identity is not authorised');
  const listed = await stagingRequest(tokens.idToken, 'GET', `/v1/patients/${patientId}/media`);
  const media = listed.value?.media;
  if (!Array.isArray(media) || media.length > 1 || media.some(item => item.patientId !== patientId || item.displayFilename !== filename || item.checksum !== checksum || item.status !== 'active')) {
    throw Error('Synthetic media ownership check failed; nothing was withdrawn');
  }
  for (const item of media) {
    const result = await stagingRequest(tokens.idToken, 'POST', `/v1/patient-media/${item.mediaAssetId}/withdraw`, { reason: 'Synthetic Dental OS staging media test cleanup' }, randomUUID());
    if (result.status !== 204) throw Error('Synthetic media withdrawal was not confirmed');
    journal.assetId = item.mediaAssetId;
    await saveJournal();
  }
  const after = await stagingRequest(tokens.idToken, 'GET', `/v1/patients/${patientId}/media`);
  if (!Array.isArray(after.value?.media) || after.value.media.length !== 0) throw Error('Active synthetic media remained after withdrawal');
  journal.patientId = patientId;
  await saveJournal();
  cleaned = true;
  check('only the synthetic image was withdrawn; no active image remains', true);
}

try {
  saveJournal();
  phase = 'staging-preflight';
  const feedBefore = await publicFeed();
  journal.feedBefore = feedBefore;
  await saveJournal();
  const appSource = ['index.html', 'app.js', 'app.css', 'assets/media-test.svg'].map(name => {
    const bytes = require('node:fs').readFileSync(path.join(root, 'fixtures/runtime-apps/media-upload', name));
    return `${name}:${hashBytes(bytes)}`;
  }).join('\n');
  journal.privateFixtureSha256 = hashBytes(appSource);
  await saveJournal();

  phase = 'private-staging-dock-launch';
  app = await electron.launch({ args: [root, ...profileArgs, '--identity-staging', '--identity-stage-diagnostics', '--runtime-fixtures', '--media-upload-staging-fixtures'], env, timeout: 30000 });
  shell = await app.firstWindow();
  shell.setDefaultTimeout(30000);
  await shell.getByRole('heading', { name: 'Sign in to your clinic' }).waitFor();
  await shell.waitForFunction(() => document.querySelector('[data-session-phase]')?.dataset.sessionPhase === 'signed-out');

  phase = 'real-staging-session';
  await shell.getByLabel('Email', { exact: true }).fill(credentials.email);
  await shell.getByLabel('Password', { exact: true }).fill(credentials.password);
  await shell.getByRole('button', { name: 'Sign in', exact: true }).click();
  await shell.waitForFunction(() => {
    const phase = document.querySelector('[data-session-phase]')?.dataset.sessionPhase;
    return !!document.querySelector('.clinic-widget-menu > summary') || phase === 'unavailable' || (phase === 'signed-out' && !!document.querySelector('[role="alert"]'));
  }, undefined, { timeout: 30000 });
  let session = await shell.evaluate(() => window.desktop.identity.view());
  if (session.phase !== 'ready') {
    journal.auth = { status: session.phase === 'unavailable' ? 'unavailable' : 'denied', diagnostic: await readSafeAuthDiagnostic() };
    await saveJournal();
    throw Error('Staging clinic sign-in did not reach a ready session');
  }
  journal.auth = { status: 'ready' };
  check('real staging clinic admin session is ready', session.phase === 'ready' && session.mode === 'staging' && session.role === 'admin');

  phase = 'sign-out-session-reset';
  const signedInGeneration = session.generation;
  await shell.locator('.clinic-widget-menu > summary').click();
  await shell.getByRole('button', { name: 'Sign out', exact: true }).click();
  await shell.getByRole('heading', { name: 'Sign in to your clinic' }).waitFor();
  const signedOut = await shell.evaluate(() => window.desktop.identity.view());
  check('sign out clears the clinic context and advances the session generation', signedOut.phase === 'signed-out' && signedOut.generation > signedInGeneration && !signedOut.userLabel && !signedOut.clinicLabel && !signedOut.role && !signedOut.remembered);
  await shell.getByLabel('Email', { exact: true }).fill(credentials.email);
  await shell.getByLabel('Password', { exact: true }).fill(credentials.password);
  await shell.getByRole('button', { name: 'Sign in', exact: true }).click();
  await shell.waitForFunction(() => !!document.querySelector('.clinic-widget-menu > summary'), undefined, { timeout: 30000 });
  session = await shell.evaluate(() => window.desktop.identity.view());
  check('a fresh sign-in restores the staging clinic session after logout', session.phase === 'ready' && session.mode === 'staging' && session.role === 'admin' && session.generation > signedOut.generation);

  phase = 'private-dock-app';
  const dock = shell.locator(`[data-dock-app="${appId}"]`);
  await dock.waitFor({ state: 'visible', timeout: 30000 });
  check('the private signed media test package is present in the Dock', await dock.getAttribute('aria-label') === 'Media Upload Test');
  await dock.click();
  await shell.waitForFunction(id => document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase === 'ready', appId, { timeout: 30000 });
  for (let index = 0; index < 150; index++) {
    guest = app.context().pages().find(page => !page.isClosed() && page.url().startsWith(`dental-fixture://${appId}/`));
    if (guest) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!guest) throw Error('Private Dock app did not create a runtime page');
  await guest.getByRole('heading', { name: 'Media Upload Test', exact: true }).waitFor();
  await guest.getByRole('button', { name: 'Connect SDK', exact: true }).click();
  await guest.getByText('Connected through the Dental OS host broker.', { exact: true }).waitFor();
  check('the test app connects through its signed exact-release host grant', true);

  phase = 'synthetic-patient';
  await guest.locator('#captured-on').fill('2026-10-22');
  await guest.getByRole('button', { name: 'Create synthetic patient', exact: true }).click();
  await guest.getByText(/^Synthetic patient ready:/).waitFor();
  const patientText = await guest.locator('#patient').textContent();
  patientId = patientText?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0];
  if (!patientId) throw Error('Synthetic patient ID was not returned by the app');
  journal.patientId = patientId;
  await saveJournal();
  check('the app created a uniquely labelled synthetic patient through the Worker API', true);

  phase = 'host-mediated-image-upload';
  await guest.getByRole('button', { name: 'Choose image file', exact: true }).click();
  await guest.locator('#image-file').setInputFiles(imageFile);
  await guest.getByText(`${filename} selected · ${image.length} bytes`, { exact: true }).waitFor();
  await guest.getByRole('button', { name: 'Upload test image', exact: true }).click();
  try {
    await guest.getByText(new RegExp(`^Verified ${image.length} bytes by SHA-256 through the Dental OS host broker\\.$`)).waitFor({ timeout: 45000 });
  } catch {
    if (await guest.getByRole('button', { name: 'Reconcile the same upload', exact: true }).isVisible().catch(() => false)) {
      await guest.getByRole('button', { name: 'Reconcile the same upload', exact: true }).click();
      await guest.getByText(new RegExp(`^Verified ${image.length} bytes by SHA-256 through the Dental OS host broker\\.$`)).waitFor({ timeout: 45000 });
    } else if (await guest.getByRole('button', { name: 'Cancel this test transfer', exact: true }).isVisible().catch(() => false)) {
      await guest.getByRole('button', { name: 'Cancel this test transfer', exact: true }).click();
      await guest.waitForTimeout(500);
      throw Error('The Worker did not confirm the synthetic image upload');
    } else throw Error('Host-mediated staging upload or readback failed');
  }
  const verifiedText = await guest.locator('#result').textContent();
  check('the app uploaded the image and verified staging readback size plus SHA-256', verifiedText === `Verified ${image.length} bytes by SHA-256 through the Dental OS host broker.`);
  await app.close();
  app = undefined;
  await cleanupSyntheticMedia();
  const feedAfter = await publicFeed();
  check('public staging catalogue and update policy are unchanged', JSON.stringify(feedBefore) === JSON.stringify(feedAfter));
  journal.feedAfter = feedAfter;
  journal.phase = 'passed';
  await saveJournal();
  passed = true;
} catch (error) {
  if (shell && ['real-staging-session', 'sign-out-session-reset'].includes(phase)) {
    try {
      const session = await shell.evaluate(() => window.desktop.identity.view());
      journal.auth = { status: session.phase, diagnostic: await readSafeAuthDiagnostic() };
      await saveJournal();
    } catch { /* Keep authentication diagnostics limited to the safe private journal. */ }
  }
  console.error(`Private staging media Dock acceptance stopped at ${phase}; credentials, identifiers, and API payloads withheld.`);
  process.exitCode = 1;
} finally {
  if (app) await app.close().catch(() => {});
  if (patientId && credentials && !cleaned) {
    try { await cleanupSyntheticMedia(); }
    catch { console.error('Synthetic media cleanup needs follow-up; private journal retained.'); process.exitCode = 1; }
  }
  if (credentials) { credentials.email = undefined; credentials.password = undefined; }
  await fs.rm(authDiagnosticFile, { force: true });
  const reportPath = path.join(root, 'dental-os_v1_working_info/milestone-15-platform-closeout-and-integration/evidence/P07_MEDIA_UPLOAD_DOCK_STAGING_2026-10-22.json');
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify({
    passed: passed && cleaned,
    date: new Date().toISOString(),
    platform: process.platform,
    sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    privateFixtureSha256: journal.privateFixtureSha256 ?? null,
    environment: 'cloudfare-staging',
    appId,
    checks,
    authStatus: journal.auth?.status ?? 'not-tested',
    authFailureStage: journal.auth?.diagnostic?.stage ?? null,
    authFailureOutcome: journal.auth?.diagnostic?.outcome ?? null,
    testImage: journal.image,
    feedUnchanged: JSON.stringify(journal.feedBefore) === JSON.stringify(journal.feedAfter),
    syntheticPatientCreated: !!patientId,
    activeTestMediaAfterCleanup: cleaned ? 0 : null,
    syntheticPatientRetainedForAudit: !!patientId,
    productionRequests: false,
    publicMediaGrantPublished: false,
    ordinarySessionUploadEnabled: passed && cleaned,
    privateJournalRetained: true,
    scope: 'Locally signed private fixture app launched from the Dock in an isolated Linux runtime; real staging clinic identity with sign-in/sign-out/re-login checks; the standard SessionManager upload gate and exact signed host-broker grant authorize a real public CC BY 4.0 JPEG upload/readback; synthetic patient only. Operator cleanup withdrew any matching active media record; withdrawal retains the private object bytes. This verifies the normal session path for this private fixture but does not publish a public app grant or prove the full 10 MiB patient-image or 25 MiB staff-document boundary, fresh-session recovery, or tenant-negative cases.',
  }, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ passed: passed && cleaned, phase, checks: checks.length, syntheticMediaCleaned: cleaned, authStatus: journal.auth?.status ?? 'not-tested', authStage: journal.auth?.diagnostic?.stage ?? null, authOutcome: journal.auth?.diagnostic?.outcome ?? null }));
}

if (!passed || !cleaned) process.exitCode = 1;
